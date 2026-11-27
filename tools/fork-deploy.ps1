# fork (wakare): put this fork's own changes onto an installed MeguLit without a full build.
# The installed MeguLit.exe embeds web/; it reads the web folder next to it instead only while data/hot-update.json names
# this exe (desktop/src/hot_assets.rs). services/ and core/ always run from disk. So the fork's diff against upstream is
# applied to the installed files (originals kept in cache/fork-backup/<version>), and hot-update.json is written.
# Restart MeguLit afterwards. A MeguLit update replaces these files: run this again after updating.
param(
 [string]$Install = 'E:\MeguLit',
 [string]$Base = '',          # upstream commit the fork changes start from; default: merge-base with upstream/main, else origin's first fork commit parent
 [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Base) {
 $Base = git -C $repo merge-base HEAD upstream/main 2>$null
 if (-not $Base) { $Base = (Get-Content -LiteralPath (Join-Path $repo 'FORK.md') -Raw | Select-String -Pattern 'upstream base: ([0-9a-f]{7,40})').Matches[0].Groups[1].Value }
}
$paths = 'web','services','core'
$patch = Join-Path $env:TEMP ('megulit-fork-' + $PID + '.patch')
git -C $repo diff --binary $Base HEAD -- $paths | Set-Content -LiteralPath $patch -Encoding utf8NoBOM
$files = @(git -C $repo diff --name-only $Base HEAD -- $paths)
if (-not $files.Count) { Write-Output 'No fork changes under web/services/core.'; exit 0 }
$version = (Get-Content -LiteralPath (Join-Path $Install 'data\update-installed.json') -Raw | ConvertFrom-Json).version
$stage = Join-Path $env:TEMP ('megulit-fork-stage-' + $PID)
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($f in $files) { $src = Join-Path $Install $f; if (Test-Path -LiteralPath $src) { New-Item -ItemType Directory -Force (Split-Path -Parent (Join-Path $stage $f)) | Out-Null; Copy-Item -LiteralPath $src (Join-Path $stage $f) } }
Push-Location $stage
try { git apply --ignore-whitespace --check $patch; if ($LASTEXITCODE) { throw "Fork patch does not apply to installed $version" }; if ($DryRun) { Write-Output "Applies cleanly to $version`: $($files -join ', ')"; exit 0 }; git apply --ignore-whitespace $patch; if ($LASTEXITCODE) { throw 'git apply failed' } } finally { Pop-Location }
$backup = Join-Path $Install "cache\fork-backup\$version"
foreach ($f in $files) {
 $dst = Join-Path $Install $f
 if ((Test-Path -LiteralPath $dst) -and -not (Test-Path -LiteralPath (Join-Path $backup $f))) { New-Item -ItemType Directory -Force (Split-Path -Parent (Join-Path $backup $f)) | Out-Null; Copy-Item -LiteralPath $dst (Join-Path $backup $f) }
 New-Item -ItemType Directory -Force (Split-Path -Parent $dst) | Out-Null
 Copy-Item -LiteralPath (Join-Path $stage $f) $dst -Force
}
$exe = Get-Item -LiteralPath (Join-Path $Install 'MeguLit.exe')
$stamp = '{0}-{1}' -f $exe.Length, [Math]::Floor(([DateTimeOffset]$exe.LastWriteTimeUtc).ToUnixTimeMilliseconds())
@{ version = "$version-fork"; from = $version; exe = $stamp; files = $files.Count; at = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $Install 'data\hot-update.json') -Encoding utf8NoBOM
# hand-found hook codes for engines MeguLit does not detect (native/HookBridge.cs InsertFixedCodes)
Copy-Item -LiteralPath (Join-Path $repo 'tools\fork-hook-codes.json') (Join-Path $Install 'data\hook-codes.json') -Force
# hold MeguLit's own updates (services/update.cjs): an update would replace the fork's files; take updates by hand (FORK.md)
'{"hold":true}' | Set-Content -LiteralPath (Join-Path $Install 'data\fork-hold-updates.json') -Encoding utf8NoBOM
Remove-Item -Recurse -Force $stage, $patch
Write-Output "Deployed $($files.Count) fork file(s) onto $version; originals in $backup. Restart MeguLit."

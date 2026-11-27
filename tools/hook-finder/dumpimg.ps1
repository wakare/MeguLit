param([int]$ProcId,[string]$Out)
# copies the main module's mapped image out of the running process (the file's .text is SteamStub-encrypted)
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public static class Di{[DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int a,bool b,int p);[DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,IntPtr n,out IntPtr r);}
"@
$p=Get-Process -Id $ProcId;$m=$p.MainModule;$h=[Di]::OpenProcess(0x0410,$false,$ProcId)
$size=$m.ModuleMemorySize;$buf=New-Object byte[] $size
for($o=0;$o -lt $size;$o+=4096){$pg=New-Object byte[] 4096;$r=[IntPtr]::Zero;if([Di]::ReadProcessMemory($h,[IntPtr]($m.BaseAddress.ToInt64()+$o),$pg,[IntPtr]4096,[ref]$r)){[Array]::Copy($pg,0,$buf,$o,[Math]::Min(4096,$size-$o))}}
[IO.File]::WriteAllBytes($Out,$buf);"dumped $size bytes base 0x{0:x}" -f $m.BaseAddress.ToInt64()

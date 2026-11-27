# wakare/MeguLit fork

Our own fork of [ilynthn/MeguLit](https://github.com/ilynthn/MeguLit), installed at `E:\MeguLit`.
Changes stay small and are marked `fork (wakare)` in comments, so upstream updates merge easily.

upstream base: a8dba67

## What the fork changes

- **Long sentences keep their translation on screen.** When a translation still runs past the bottom after the usual
  shrink, the whole line moves up (never above the game window's top) instead of leaving the translation off screen or
  squeezing it into a tiny scroll box. `web/reader/modules/text-place.js` (anchored layout, e.g. ATRI) and
  `web/reader/modules/game-fit.js` (plain hook reader). Test: `validation/text-place-long-translation.test.cjs`.
- **Lookup card remembers where it was dragged.** The next card opens at that place (pulled back on screen if needed),
  also after a restart (stored in the reader's localStorage, `megulit.fork.lookupPlace`). `web/reader/modules/selection.js`.
  Test: `validation/lookup-card-remember.test.cjs`.
- **Card timing log.** Every card made writes one JSON line to `logs/card-timing.log`: each step and how long it took
  (`lookupWord`, `translationAndFurigana`, `gameMediaRecording`, `pickSentenceVoice`, `ensureSpeech`, `ttsWord`,
  `ttsSentence`, `prepareNoteModel`, `sendToAnki`, `saveToWordBook`), the total, and a later `cardLater` line when vocal
  separation finishes. Screenshots get their own `screenshot` line. `services/card-timing.cjs`, wired in `services/reader.cjs`.

## Putting the fork onto the installed MeguLit (no full build)

`MeguLit.exe` embeds `web/`, but reads the `web` folder next to it while `data/hot-update.json` names that exe
(`desktop/src/hot_assets.rs`); `services/` and `core/` always run from disk. So for changes to `web/`, `services/` and
`core/`, apply the fork's diff to the installed files:

```powershell
pwsh -File tools\fork-deploy.ps1 -Install E:\MeguLit -DryRun   # check it applies
pwsh -File tools\fork-deploy.ps1 -Install E:\MeguLit           # apply, then restart MeguLit
```

Originals are kept in `E:\MeguLit\cache\fork-backup\<version>`. To undo: copy the backup over the install and delete
`data\hot-update.json`.

## Taking a MeguLit update

The deploy script also writes `data\fork-hold-updates.json` (`{"hold":true}`), which makes MeguLit skip its update check
(silent hot updates included), so an update never replaces the fork's files unannounced. To update when we choose:

1. Merge upstream into the fork (`git fetch https://github.com/ilynthn/MeguLit main` and merge), fix conflicts, rerun tests.
2. Delete `E:\MeguLit\data\fork-hold-updates.json`, restart MeguLit and take the update from its card.
3. Run `tools\fork-deploy.ps1` again (it puts the fork's changes on the new version and holds updates again), restart.

## Games MeguLit does not detect: hand-found hook codes

`native/HookBridge.cs` (InsertFixedCodes) inserts the codes in `data/hook-codes.json` right after injection
(`{"<exe>|<exact size>": ["<LunaHook code>", ...]}`; the size part is optional). The list lives in
`tools/fork-hook-codes.json` and `tools/fork-deploy.ps1` copies it. For such a game `core/hook-native.cjs` ignores the GPU
page model (its window state failed there) and the reader draws the line in its own box; the GPU hide still blanks the game's text.

- **Phantom PHANTOM OF INFERNO NITRO ARCHIVE** (幻灵镇魂曲, Steam 3639590, phantom.exe 3,886,152 bytes): a Squirrel engine
  drawing its own glyphs, exe SteamStub-packed, main thread hidden from debuggers. The native behind the script function
  `CountTextLength` (+0x9C320) gets each shown line as UTF-8 in rdx: `HV-24@9C320:phantom.exe`. Found with an in-process
  hardware-breakpoint DLL (vectored handler; an outside debugger crashes this game). A game update changes the address:
  the size in the key then skips the code and the bridge logs it.

Build and install the bridge (MeguLit closed or its HookBridge renamed first):

```powershell
pwsh -File native\Build-HookBridge.ps1 -OutputPath <folder>\HookBridge.exe   # self-test runs at the end
```

## Native KiriKiri hook (MeguLitKrkr32/64.dll)

The fork changes `native/krkrtext/script.inc` (TJS embedded in the DLL): a TextRender game (ATRI) that hides its message
window for a moment and shows the same line again kept its text hidden only until the window hid; now the text layer stays
hidden and the line is reported again when the window returns. Build and install (the game must be restarted to load it):

```powershell
$env:MEGULIT_VS = 'C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat'
$env:MEGULIT_VS_X86 = "$PWD\native\vsx86.cmd"
cmd /c native\krkrtext\build.cmd; cmd /c native\krkrtext\selftest\run.cmd
```

Then copy `native\MeguLitKrkr32.dll` and `MeguLitKrkr64.dll` into `E:\MeguLit\native` (rename the loaded ones first if the
game is running). Each literal piece in script.inc must stay under 8,190 wide characters (split with `)MGLT", LR"MGLT(`).
Logs: `trclear why=...` and the `held=` count in hook-diagnostics.log.

## Full build (not set up on this PC yet)

`Build.ps1` / `Release.ps1` need, besides Node: Rust + cargo (the Tauri shell in `desktop/`), the MSVC C++ toolset
(Visual Studio Build Tools, for the native DLLs and helpers in `native/`), .NET for the C# bridges, and Python for some
native self-tests; `tools/check-env.ps1` lists what is missing. Only needed when changing `desktop/` or `native/`.

## Tests

The reader layout tests drive Edge through playwright-core:

```powershell
$env:MEGULIT_PLAYWRIGHT = '<folder>\node_modules\playwright-core'
node validation\text-place-long-translation.test.cjs
```

`text-place-workarea.test.cjs` fails at its ruby-click check on this PC with upstream's code too (not caused by the fork).

## Network note

GitHub drops long transfers from this PC (through the 7890 proxy and directly). A full clone fails; the working copy at
`D:\Work\MeguLit` is a shallow, blobless, sparse clone. Add folders with `git sparse-checkout add <dir>` and rerun
`git sparse-checkout reapply` until it succeeds. Never run `git checkout -- .` there: it also resets your uncommitted edits.

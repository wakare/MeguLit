# wakare/MeguLit fork

Our own fork of [ilynthn/MeguLit](https://github.com/ilynthn/MeguLit), installed at `E:\MeguLit`.
Changes stay small and are marked `fork (wakare)` in comments, so upstream updates merge easily.

upstream base: a8dba67

## What the fork changes

- **Long sentences keep their translation on screen.** When a translation still runs past the bottom after the usual
  shrink, the whole line moves up (never above the game window's top) instead of leaving the translation off screen or
  squeezing it into a tiny scroll box. `web/reader/modules/text-place.js` (anchored layout, e.g. ATRI) and
  `web/reader/modules/game-fit.js` (plain hook reader). Test: `validation/text-place-long-translation.test.cjs`.
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

Originals are kept in `E:\MeguLit\cache\fork-backup\<version>`. A MeguLit update replaces the files, so run it again
after updating. To undo: copy the backup over the install and delete `data\hot-update.json`.

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

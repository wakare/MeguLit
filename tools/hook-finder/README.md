# hook-finder (fork, wakare)

Tools used to find a text hook for a game MeguLit does not detect (Phantom of Inferno Nitro Archive). Read-only except
`vehbp.dll`, which runs inside the game.

1. `memscan.ps1 -ProcId <pid> -Needle '<a few words on screen>'`: where the line sits in memory (UTF-16 / UTF-8 / Shift-JIS).
2. `dumpimg.ps1`: copy the exe image out of the running game (Steam-packed exes are encrypted on disk), then
   `strs.py` (identifiers), `xref.py` (code that references them) and `pxdis.py` (disassembly, by RVA).
3. `vehbp.cpp` -> `cl /O2 /MT /LD /EHa vehbp.cpp`; write `%TEMP%\vehbp-in.txt` (rw 0=exec/1=write/3=read-write, seconds,
   hits per address, stack 0/1, then up to 4 addresses as hex or `+rva`), load it with `inject.ps1`; hits (registers, the
   Japanese text each register points at, return addresses) go to `%TEMP%\vehbp-out.txt`. It catches breakpoints in a
   vectored handler, so it works where an outside debugger crashes the game (threads hidden from debuggers).
4. A register holding the shown line at a function entry gives the LunaHook code (x64: rcx -1C, rdx -24, r8 -4C, r9 -54;
   V = UTF-8, S = Shift-JIS, Q = UTF-16), e.g. `HV-24@9C320:phantom.exe`; add it to `tools/fork-hook-codes.json`.

// In-process hardware-breakpoint watcher. Loaded into the game; reads addresses from %TEMP%\vehbp-in.txt (hex, one per line,
// first line: rw bits 1=write 3=read/write, second line: seconds), sets DR0-DR3 on every thread, catches the hits in a vectored
// exception handler (works for threads hidden from debuggers), logs RIP, registers and return-address candidates of the main
// module to %TEMP%\vehbp-out.txt, then clears the registers. The handler stays installed so a late hit never reaches the game.
#include <windows.h>
#include <tlhelp32.h>
#include <stdio.h>

static ULONG64 Addr[4]; static int N, Rw = 3, Seconds = 60, PerRip = 3, Stack = 1; static volatile LONG Hits, Armed;
static HANDLE Out; static ULONG64 ModBase, ModEnd; static CRITICAL_SECTION Gate;
static ULONG64 SeenRip[64]; static int SeenN[64]; static int SeenCount;

static void Log(const char *s) { DWORD w; EnterCriticalSection(&Gate); WriteFile(Out, s, (DWORD)strlen(s), &w, NULL); LeaveCriticalSection(&Gate); }

static void SetAll(bool on) {
  DWORD me = GetCurrentThreadId(), pid = GetCurrentProcessId();
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0); if (snap == INVALID_HANDLE_VALUE) return;
  THREADENTRY32 te; te.dwSize = sizeof(te);
  for (BOOL ok = Thread32First(snap, &te); ok; ok = Thread32Next(snap, &te)) {
    if (te.th32OwnerProcessID != pid || te.th32ThreadID == me) continue;
    HANDLE t = OpenThread(THREAD_GET_CONTEXT | THREAD_SET_CONTEXT | THREAD_SUSPEND_RESUME, FALSE, te.th32ThreadID); if (!t) continue;
    if (SuspendThread(t) != (DWORD)-1) {
      CONTEXT c; ZeroMemory(&c, sizeof(c)); c.ContextFlags = CONTEXT_DEBUG_REGISTERS;
      if (GetThreadContext(t, &c)) {
        ULONG64 dr7 = 0; ULONG64 *dr[4] = {&c.Dr0, &c.Dr1, &c.Dr2, &c.Dr3};
        for (int i = 0; i < 4; i++) { *dr[i] = (on && i < N) ? Addr[i] : 0; if (on && i < N) dr7 |= (1ULL << (i * 2)) | ((ULONG64)Rw << (16 + i * 4)); }
        c.Dr6 = 0; c.Dr7 = dr7; SetThreadContext(t, &c);
      }
      ResumeThread(t);
    }
    CloseHandle(t);
  }
  CloseHandle(snap);
}

static LONG CALLBACK Handler(PEXCEPTION_POINTERS e) {
  if (e->ExceptionRecord->ExceptionCode != EXCEPTION_SINGLE_STEP) return EXCEPTION_CONTINUE_SEARCH;
  CONTEXT *c = e->ContextRecord;
  /* every single step is taken as ours: one that arrives while the registers are being cleared can carry Dr6 = 0, and handing it
     on ended the game (0x80000004 at an execution breakpoint) */
  if (!(c->Dr6 & 0xF)) { bool exec = false; for (int i = 0; i < N; i++) if (Addr[i] == c->Rip) exec = true; if (exec) c->EFlags |= 0x10000; c->Dr6 = 0; return EXCEPTION_CONTINUE_EXECUTION; }
  ULONG64 rip = c->Rip; int k = -1;
  EnterCriticalSection(&Gate);
  for (int i = 0; i < SeenCount; i++) if (SeenRip[i] == rip) { k = i; break; }
  if (k < 0 && SeenCount < 64) { k = SeenCount++; SeenRip[k] = rip; SeenN[k] = 0; }
  int n = k >= 0 ? SeenN[k]++ : 99;
  LeaveCriticalSection(&Gate);
  if (n < PerRip && Hits < 200) {
    InterlockedIncrement(&Hits);
    char b[8192]; int p = sprintf_s(b, "HIT tid=%lu rip=+%llx dr6=%llx rsp=%llx\n", GetCurrentThreadId(), rip - ModBase, c->Dr6, c->Rsp);
    /* every register (and every pointer one level behind it) that points at UTF-8 Japanese text */
    const char *names[] = {"rax","rcx","rdx","rbx","rbp","rsi","rdi","r8","r9","r10","r11","r12","r13","r14","r15"};
    ULONG64 regs[] = {c->Rax,c->Rcx,c->Rdx,c->Rbx,c->Rbp,c->Rsi,c->Rdi,c->R8,c->R9,c->R10,c->R11,c->R12,c->R13,c->R14,c->R15};
    for (int r = 0; r < 15 && p < 7000; r++) {
      for (int depth = 0; depth < 2; depth++) {
        ULONG64 a = regs[r]; int off = 0;
        for (int o = 0; o < (depth ? 8 : 1); o++) {
          ULONG64 q = a;
          if (depth) { __try { q = *(ULONG64 *)(a + o * 8); } __except (EXCEPTION_EXECUTE_HANDLER) { break; } off = o * 8; }
          if (q < 0x10000 || q > 0x7FFFFFFFFFFFULL) continue;
          unsigned char t[96]; int len = 0;
          __try { for (; len < 90; len++) { t[len] = ((unsigned char *)q)[len]; if (!t[len]) break; } } __except (EXCEPTION_EXECUTE_HANDLER) { continue; }
          t[len] = 0; int mb = 0; for (int i = 0; i + 2 < len; i++) if (t[i] == 0xE3 && (t[i + 1] == 0x81 || t[i + 1] == 0x82 || t[i + 1] == 0x83)) mb++;
          if (mb >= 2) p += sprintf_s(b + p, sizeof(b) - p, "  %s%s%s+%x=%llx \"%s\"\n", depth ? "[" : "", names[r], depth ? "]" : "", off, q, (char *)t);
        }
      }
    }
    if (Stack) { p += sprintf_s(b + p, sizeof(b) - p, "  stack:"); ULONG64 *sp = (ULONG64 *)c->Rsp;
      for (int i = 0; i < 0x100 && p < 8000; i++) { ULONG64 v; __try { v = sp[i]; } __except (EXCEPTION_EXECUTE_HANDLER) { break; } if (v >= ModBase && v < ModEnd) p += sprintf_s(b + p, sizeof(b) - p, " [%x]+%llx", i * 8, v - ModBase); }
      p += sprintf_s(b + p, sizeof(b) - p, "\n"); }
    Log(b);
  }
  c->Dr6 = 0;
  if (Rw == 0) c->EFlags |= 0x10000; /* resume flag: an execution breakpoint must not fire again on the same instruction */
  return EXCEPTION_CONTINUE_EXECUTION;
}

static DWORD WINAPI Main(LPVOID) {
  char path[MAX_PATH]; GetTempPathA(MAX_PATH, path); char in[MAX_PATH], out[MAX_PATH];
  sprintf_s(in, "%svehbp-in.txt", path); sprintf_s(out, "%svehbp-out.txt", path);
  Out = CreateFileA(out, GENERIC_WRITE, FILE_SHARE_READ, NULL, CREATE_ALWAYS, 0, NULL);
  HMODULE m = GetModuleHandleA(NULL); ModBase = (ULONG64)m; IMAGE_NT_HEADERS *nt = (IMAGE_NT_HEADERS *)((BYTE *)m + ((IMAGE_DOS_HEADER *)m)->e_lfanew); ModEnd = ModBase + nt->OptionalHeader.SizeOfImage;
  FILE *f = NULL; if (fopen_s(&f, in, "r") || !f) { Log("no input\n"); return 0; }
  /* lines: rw (0 exec, 1 write, 3 read/write) / seconds / hits per rip / stack 0|1 / up to 4 addresses (hex, or +rva of the exe) */
  char line[64]; if (fgets(line, sizeof(line), f)) Rw = atoi(line); if (fgets(line, sizeof(line), f)) Seconds = atoi(line);
  if (fgets(line, sizeof(line), f)) PerRip = atoi(line); if (fgets(line, sizeof(line), f)) Stack = atoi(line);
  while (N < 4 && fgets(line, sizeof(line), f)) { ULONG64 a = line[0] == '+' ? ModBase + _strtoui64(line + 1, NULL, 16) : _strtoui64(line, NULL, 16); if (a) Addr[N++] = a; }
  fclose(f);
  char b[256]; sprintf_s(b, "base=%llx n=%d rw=%d seconds=%d\n", ModBase, N, Rw, Seconds); Log(b);
  AddVectoredExceptionHandler(1, Handler);
  SetAll(true); Armed = 1;
  for (int s = 0; s < Seconds * 2 && Hits < 200; s++) { Sleep(500); if (s % 4 == 3) SetAll(true); /* threads created since */ }
  SetAll(false); Sleep(300); SetAll(false); Armed = 0;
  EnterCriticalSection(&Gate); for (int i = 0; i < SeenCount; i++) { sprintf_s(b, "rip +%llx x%d\n", SeenRip[i] - ModBase, SeenN[i]); DWORD w; WriteFile(Out, b, (DWORD)strlen(b), &w, NULL); } LeaveCriticalSection(&Gate);
  Log("done\n"); FlushFileBuffers(Out); CloseHandle(Out); Out = INVALID_HANDLE_VALUE;
  return 0;
}

BOOL APIENTRY DllMain(HMODULE h, DWORD why, LPVOID) {
  if (why == DLL_PROCESS_ATTACH) { InitializeCriticalSection(&Gate); DisableThreadLibraryCalls(h); CreateThread(NULL, 0, Main, NULL, 0, NULL); }
  return TRUE;
}


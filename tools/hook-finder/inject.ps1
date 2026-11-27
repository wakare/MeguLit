param([int]$ProcId,[string]$Dll)
# copies the DLL to a unique name (so a second run loads again) and loads it into the process with CreateRemoteThread(LoadLibraryW)
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;using System.Text;
public static class Inj{
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(int a,bool b,int p);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr h,IntPtr a,IntPtr s,int t,int p);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool WriteProcessMemory(IntPtr h,IntPtr a,byte[] b,IntPtr n,out IntPtr w);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateRemoteThread(IntPtr h,IntPtr sa,IntPtr ss,IntPtr start,IntPtr arg,int f,out int tid);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr m,string n);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string n);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 public static string Load(int pid,string dll){IntPtr h=OpenProcess(0x043A,false,pid);if(h==IntPtr.Zero)return "open "+Marshal.GetLastWin32Error();
  byte[] b=Encoding.Unicode.GetBytes(dll+"\0");IntPtr mem=VirtualAllocEx(h,IntPtr.Zero,new IntPtr(b.Length),0x3000,4);IntPtr w;WriteProcessMemory(h,mem,b,new IntPtr(b.Length),out w);
  IntPtr ll=GetProcAddress(GetModuleHandle("kernel32.dll"),"LoadLibraryW");int tid;IntPtr t=CreateRemoteThread(h,IntPtr.Zero,IntPtr.Zero,ll,mem,0,out tid);if(t==IntPtr.Zero)return "thread "+Marshal.GetLastWin32Error();
  WaitForSingleObject(t,10000);return "loaded tid="+tid;}
}
"@
$copy=Join-Path (Split-Path $Dll) ("vehbp-{0}.dll" -f (Get-Date -Format HHmmssfff));Copy-Item $Dll $copy
[Inj]::Load($ProcId,$copy)

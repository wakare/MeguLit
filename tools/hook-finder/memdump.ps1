param([int]$ProcId,[string]$Addr,[int]$Len=512)
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public static class Md{[DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int a,bool b,int p);[DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,IntPtr n,out IntPtr r);}
"@
$h=[Md]::OpenProcess(0x0410,$false,$ProcId);$a=[Convert]::ToInt64($Addr,16);$b=New-Object byte[] $Len;$r=[IntPtr]::Zero
if(-not [Md]::ReadProcessMemory($h,[IntPtr]$a,$b,[IntPtr]$Len,[ref]$r)){"read failed";exit}
# print UTF-8 text with byte offsets of each line start
$t=[Text.Encoding]::UTF8.GetString($b)
$off=0;foreach($line in ($t -split "`n")){"0x{0:X} | {1}" -f ($a+$off),($line -replace '[\x00-\x1f]','·');$off+=[Text.Encoding]::UTF8.GetByteCount($line)+1}

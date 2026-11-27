param([int]$ProcId,[string]$Needle='「',[int]$Max=40)
# read-only scan of a process's committed private/image memory for a string in UTF-16LE, UTF-8 and Shift-JIS
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public static class Mem{
 [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int a,bool b,int pid);
 [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h,IntPtr addr,byte[] buf,IntPtr size,out IntPtr read);
 [DllImport("kernel32.dll")] public static extern IntPtr VirtualQueryEx(IntPtr h,IntPtr addr,out MBI mbi,IntPtr len);
 [StructLayout(LayoutKind.Sequential)] public struct MBI{public IntPtr BaseAddress;public IntPtr AllocationBase;public uint AllocationProtect;public ushort PartitionId;public IntPtr RegionSize;public uint State;public uint Protect;public uint Type;}
}
"@
$h=[Mem]::OpenProcess(0x0410,$false,$ProcId)
$encs=@{u16=[Text.Encoding]::Unicode;u8=[Text.Encoding]::UTF8;sjis=[Text.Encoding]::GetEncoding(932)}
$pat=@{};foreach($k in $encs.Keys){$pat[$k]=$encs[$k].GetBytes($Needle)}
$addr=[IntPtr]::Zero;$mbi=New-Object Mem+MBI;$hits=@{u16=0;u8=0;sjis=0};$shown=0
while([Mem]::VirtualQueryEx($h,$addr,[ref]$mbi,[IntPtr][Runtime.InteropServices.Marshal]::SizeOf($mbi)) -ne [IntPtr]::Zero){
 $size=[int64]$mbi.RegionSize
 if($mbi.State -eq 0x1000 -and ($mbi.Protect -band 0x66) -and -not ($mbi.Protect -band 0x100) -and $size -lt 512MB){
  $buf=New-Object byte[] $size;$read=[IntPtr]::Zero
  if([Mem]::ReadProcessMemory($h,$mbi.BaseAddress,$buf,[IntPtr]$size,[ref]$read)){
   foreach($k in 'u16','u8','sjis'){$p=$pat[$k];$i=0
    while(($i=[Array]::IndexOf($buf,$p[0],$i)) -ge 0 -and $i -lt $buf.Length-$p.Length){
     $ok=$true;for($j=1;$j -lt $p.Length;$j++){if($buf[$i+$j] -ne $p[$j]){$ok=$false;break}}
     if($ok){$hits[$k]++;if($shown -lt $Max){$s=[Math]::Max(0,$i-8);$len=[Math]::Min(160,$buf.Length-$s);$txt=$encs[$k].GetString($buf,$s,$len) -replace '[\x00-\x1f]','·';"{0} 0x{1:X} type={2:X} {3}" -f $k,([int64]$mbi.BaseAddress+$i),$mbi.Type,$txt;$shown++}}
     $i++}}
  }}
 $addr=[IntPtr]([int64]$mbi.BaseAddress+$size)
}
"hits: u16=$($hits.u16) u8=$($hits.u8) sjis=$($hits.sjis)"



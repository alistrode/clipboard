param([Parameter(Mandatory=$true)][string]$Config)
$ErrorActionPreference='Stop'
$c=[IO.File]::ReadAllText($Config)|ConvertFrom-Json
function Log([string]$value){try{[IO.File]::AppendAllText((Join-Path ([IO.Path]::GetDirectoryName($Config)) 'runtime.log'),[DateTime]::UtcNow.ToString('o')+' recovery '+$value+"`n")}catch{}}
Add-Type 'using System.Runtime.InteropServices; public class ClipboardSession { [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n); }'
[IO.File]::WriteAllText($c.ready,(@{pid=$PID;parent=$c.parent;ready=$true}|ConvertTo-Json -Compress))
Log ('watching '+$c.parent)
while($true){
  if([IO.File]::Exists($c.stop)){Log 'intentional tray exit';break}
  if([ClipboardSession]::GetSystemMetrics(0x2000) -ne 0){Log 'session ending';break}
  $p=Get-Process -Id $c.parent -ErrorAction SilentlyContinue
  if($p -and $p.Path -eq $c.executable){Start-Sleep -Seconds 2;continue}
  # Recheck intent after detecting termination, before launching anything.
  if([IO.File]::Exists($c.stop)){Log 'intentional tray exit';break}
  Log ('unexpected exit '+$c.parent+'; restarting')
  $s=New-Object -ComObject Schedule.Service;$s.Connect();$d=$s.NewTask(0)
  $d.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$d.Principal.LogonType=3;$d.Principal.RunLevel=0
  $d.Settings.ExecutionTimeLimit='PT0S';$d.Settings.DisallowStartIfOnBatteries=$false;$d.Settings.StopIfGoingOnBatteries=$false
  $a=$d.Actions.Create(0);$a.Path=$c.executable
  $a.Arguments=(@($c.args)|ForEach-Object {if($_ -match '\s'){'"'+$_.Replace('"','\"')+'"'}else{$_}})-join ' '
  $t=$s.GetFolder('\').RegisterTaskDefinition(($c.task+'-App'),$d,6,$d.Principal.UserId,$null,3,$null)
  $t.Run($null)|Out-Null
  break
}
foreach($f in @($Config,$c.ready,$c.stop)){if([IO.File]::Exists($f)){[IO.File]::Delete($f)}}

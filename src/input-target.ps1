param([int]$AppPid)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public class ClipboardInputTarget {
  [StructLayout(LayoutKind.Sequential)] public struct RECT {public int left,top,right,bottom;}
  [StructLayout(LayoutKind.Sequential)] public struct GUI {public int cbSize;public uint flags;public IntPtr active,focus,capture,menu,move,caret;public RECT rect;}
  [StructLayout(LayoutKind.Sequential)] struct INPUT {public uint type;public UNION data;}
  [StructLayout(LayoutKind.Explicit)] struct UNION {[FieldOffset(0)] public KEY key;[FieldOffset(0)] public MOUSE mouse;}
  [StructLayout(LayoutKind.Sequential)] struct KEY {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
  [StructLayout(LayoutKind.Sequential)] struct MOUSE {public int x,y;public uint data,flags,time;public UIntPtr extra;}
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr w,out uint pid);
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint id,ref GUI gui);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr w);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr w);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint n,INPUT[] inputs,int size);
  public static long Foreground(){return GetForegroundWindow().ToInt64();}
  public static long OwnerPid(long hwnd){uint pid;GetWindowThreadProcessId(new IntPtr(hwnd),out pid);return pid;}
  public static long Focus(long hwnd){uint pid;uint thread=GetWindowThreadProcessId(new IntPtr(hwnd),out pid);GUI g=new GUI();g.cbSize=Marshal.SizeOf(typeof(GUI));if(thread==0||!GetGUIThreadInfo(thread,ref g))return 0;return g.focus.ToInt64();}
  public static bool Restore(long hwnd,long focus,uint pid,uint appPid){
    IntPtr w=new IntPtr(hwnd);if(!IsWindow(w)||OwnerPid(hwnd)!=pid)throw new Exception("原输入窗口已关闭；内容已复制，请手动粘贴");
    long current=Foreground();
    if(current!=hwnd){if(current!=0&&OwnerPid(current)!=appPid)throw new Exception("当前输入目标已改变；已取消自动粘贴");if(!SetForegroundWindow(w))throw new Exception("系统未恢复原输入窗口；内容已复制，请手动粘贴");Thread.Sleep(60);}
    if(Foreground()!=hwnd||focus==0||Focus(hwnd)!=focus)throw new Exception("原输入控件已改变；已取消自动粘贴");return true;
  }
  static INPUT Key(ushort vk,uint flags){INPUT i=new INPUT();i.type=1;i.data.key.vk=vk;i.data.key.flags=flags;return i;}
  public static bool Paste(long hwnd,long focus,uint pid,uint appPid){
    Restore(hwnd,focus,pid,appPid);
    int[] mods={0x10,0x11,0x12,0x5b,0x5c};bool held=true;
    for(int attempt=0;attempt<40;attempt++){held=false;foreach(int k in mods)if(GetAsyncKeyState(k)<0)held=true;if(!held)break;Thread.Sleep(20);}
    if(held)throw new Exception("请松开修饰键后手动粘贴；内容已复制");
    if(Foreground()!=hwnd||Focus(hwnd)!=focus)throw new Exception("输入目标已改变；已取消自动粘贴");
    INPUT[] keys={Key(0x11,0),Key(0x56,0),Key(0x56,2),Key(0x11,2)};
    uint count=SendInput(4,keys,Marshal.SizeOf(typeof(INPUT)));
    if(count!=4)throw new Exception("系统拒绝自动粘贴；内容已复制，请手动粘贴");return true;
  }
}
'@
while($null -ne ($line=[Console]::ReadLine())){
  $r=$null
  try {
    $r=$line|ConvertFrom-Json
    $value=$null
    switch($r.method){
      capture {$h=[ClipboardInputTarget]::Foreground();$p=[ClipboardInputTarget]::OwnerPid($h);if($h -ne 0 -and $p -ne $AppPid){$value=@{hwnd=[string]$h;focus=[string][ClipboardInputTarget]::Focus($h);pid=$p}}}
      status {$h=[ClipboardInputTarget]::Foreground();$value=@{hwnd=[string]$h;pid=[ClipboardInputTarget]::OwnerPid($h);focus=[string][ClipboardInputTarget]::Focus($h)}}
      paste {$t=$r.target;$value=[ClipboardInputTarget]::Paste([long]$t.hwnd,[long]$t.focus,[uint32]$t.pid,[uint32]$AppPid)}
      restore {$t=$r.target;$value=[ClipboardInputTarget]::Restore([long]$t.hwnd,[long]$t.focus,[uint32]$t.pid,[uint32]$AppPid)}
      default {throw '未知输入目标操作'}
    }
    [Console]::WriteLine((@{id=$r.id;ok=$true;value=$value}|ConvertTo-Json -Compress -Depth 5))
  }catch{[Console]::WriteLine((@{id=$r.id;ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress))}
}

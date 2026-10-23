$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public class ClipboardListener : NativeWindow, IDisposable {
  [DllImport("user32.dll", SetLastError=true)] static extern bool AddClipboardFormatListener(IntPtr hwnd);
  [DllImport("user32.dll", SetLastError=true)] static extern bool RemoveClipboardFormatListener(IntPtr hwnd);
  public ClipboardListener() {
    CreateParams cp = new CreateParams(); cp.Parent = new IntPtr(-3);
    CreateHandle(cp);
    if (!AddClipboardFormatListener(Handle)) throw new System.ComponentModel.Win32Exception();
    Console.WriteLine("READY"); Console.Out.Flush();
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x031D) { Console.WriteLine("CHANGED"); Console.Out.Flush(); }
    base.WndProc(ref m);
  }
  public void Dispose() { RemoveClipboardFormatListener(Handle); DestroyHandle(); }
}
'@
$listener = New-Object ClipboardListener
try { [System.Windows.Forms.Application]::Run() } finally { $listener.Dispose() }

$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.IO;
public class ClipboardListener : NativeWindow, IDisposable {
  [DllImport("user32.dll", SetLastError=true)] static extern bool AddClipboardFormatListener(IntPtr hwnd);
  [DllImport("user32.dll", SetLastError=true)] static extern bool RemoveClipboardFormatListener(IntPtr hwnd);
  delegate IntPtr KeyboardProc(int code, IntPtr message, IntPtr data);
  [StructLayout(LayoutKind.Sequential)] struct KeyboardData { public uint Key, Scan, Flags, Time; public UIntPtr Extra; }
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int kind, KeyboardProc callback, IntPtr module, uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(uint processId);
  [DllImport("kernel32.dll", CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
  KeyboardProc keyboardProc;
  IntPtr keyboardHook;
  Timer modeTimer;
  string modePath;
  int parentPid;
  long lastMode = -1;
  bool winVEnabled, capturing, blockedV, winVQueued;
  DateTime heartbeatAt = DateTime.UtcNow, hookAt = DateTime.UtcNow;
  static bool Down(int key) { return GetAsyncKeyState(key) < 0; }
  IntPtr OnKeyboard(int code, IntPtr message, IntPtr data) {
    if (code >= 0) {
      KeyboardData key = (KeyboardData)Marshal.PtrToStructure(data, typeof(KeyboardData));
      int msg = message.ToInt32(); bool pressed = msg == 0x100 || msg == 0x104; bool released = msg == 0x101 || msg == 0x105;
      if (key.Key == 0x56 && blockedV) { if (released) blockedV = false; return new IntPtr(1); }
      if (key.Key == 0x56 && pressed && (winVEnabled || capturing) && (Down(0x5B) || Down(0x5C)) && !Down(0x10) && !Down(0x11) && !Down(0x12)) {
        blockedV = true;
        // An unused key masks the Start-menu gesture without changing other Win shortcuts.
        keybd_event(0xE8, 0, 0, UIntPtr.Zero); keybd_event(0xE8, 0, 2, UIntPtr.Zero);
        if (parentPid > 0) AllowSetForegroundWindow((uint)parentPid);
        winVQueued = true;
        return new IntPtr(1);
      }
    }
    return CallNextHookEx(keyboardHook, code, message, data);
  }
  void ReadMode() {
    // Keep the low-level callback short; disk and pipe I/O run on the timer.
    if (winVQueued) { winVQueued = false; Console.WriteLine("WINV"); Console.Out.Flush(); }
    if ((DateTime.UtcNow - hookAt).TotalSeconds >= 10) {
      IntPtr fresh = SetWindowsHookEx(13, keyboardProc, GetModuleHandle(null), 0);
      if (fresh == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
      if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook);
      keyboardHook = fresh; hookAt = DateTime.UtcNow;
    }
    if ((DateTime.UtcNow - heartbeatAt).TotalSeconds >= 5) { heartbeatAt = DateTime.UtcNow; Console.WriteLine("HEARTBEAT"); Console.Out.Flush(); }
    if (parentPid > 0) {
      try { using (System.Diagnostics.Process parent = System.Diagnostics.Process.GetProcessById(parentPid)) { if (parent.HasExited) { Application.ExitThread(); return; } } }
      catch { Application.ExitThread(); return; }
    }
    if (String.IsNullOrEmpty(modePath)) return;
    try {
      string content;
      using (FileStream stream = new FileStream(modePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
      using (StreamReader reader = new StreamReader(stream)) { content = reader.ReadToEnd(); }
      string[] parts = content.Trim().Split(' ');
      long sequence = Int64.Parse(parts[0]);
      if (sequence == lastMode) return;
      winVEnabled = parts[1] == "1"; capturing = parts[2] == "1"; lastMode = sequence;
      Console.WriteLine("MODE " + sequence); Console.Out.Flush();
    } catch { }
  }
  public ClipboardListener(string config, int parent) {
    modePath = config; parentPid = parent;
    CreateParams cp = new CreateParams(); cp.Parent = new IntPtr(-3);
    CreateHandle(cp);
    if (!AddClipboardFormatListener(Handle)) throw new System.ComponentModel.Win32Exception();
    keyboardProc = OnKeyboard;
    keyboardHook = SetWindowsHookEx(13, keyboardProc, GetModuleHandle(null), 0);
    if (keyboardHook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
    ReadMode();
    modeTimer = new Timer(); modeTimer.Interval = 50; modeTimer.Tick += delegate { ReadMode(); }; modeTimer.Start();
    Console.WriteLine("KEYBOARD_READY"); Console.Out.Flush();
    Console.WriteLine("READY"); Console.Out.Flush();
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x031D) { Console.WriteLine("CHANGED"); Console.Out.Flush(); }
    base.WndProc(ref m);
  }
  public void Dispose() { if (modeTimer != null) modeTimer.Dispose(); if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook); RemoveClipboardFormatListener(Handle); DestroyHandle(); }
}
'@
$listener = New-Object -TypeName ClipboardListener -ArgumentList @([string]$env:CLIPBOARD_MODE_FILE, [int]$env:CLIPBOARD_PARENT_PID)
try { [System.Windows.Forms.Application]::Run() } finally { $listener.Dispose() }

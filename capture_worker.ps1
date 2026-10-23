$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
public static class ShotNative {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  public class WindowInfo { public int x, y, width, height; public long handle; public uint pid; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
  [DllImport("dwmapi.dll")] public static extern int DwmFlush();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
  public delegate bool EnumCallback(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumCallback callback, IntPtr data);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] public static extern int GetFrame(IntPtr window, int attribute, out Rect rect, int size);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] public static extern int GetCloaked(IntPtr window, int attribute, out int value, int size);
  public static WindowInfo WindowAt(int x, int y, uint excludePid) {
    WindowInfo found = null;
    EnumWindows(delegate(IntPtr window, IntPtr data) {
      uint pid; GetWindowThreadProcessId(window, out pid);
      int cloaked = 0; GetCloaked(window, 14, out cloaked, 4);
      if (pid == excludePid || !IsWindowVisible(window) || IsIconic(window) || cloaked != 0) return true;
      Rect rect;
      if (GetFrame(window, 9, out rect, Marshal.SizeOf(typeof(Rect))) != 0 && !GetWindowRect(window, out rect)) return true;
      if (rect.Right - rect.Left < 2 || rect.Bottom - rect.Top < 2) return true;
      if (x >= rect.Left && x < rect.Right && y >= rect.Top && y < rect.Bottom) {
        found = new WindowInfo { x=rect.Left, y=rect.Top, width=rect.Right-rect.Left, height=rect.Bottom-rect.Top, handle=window.ToInt64(), pid=pid };
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  private static Dictionary<long, uint> hidden = new Dictionary<long, uint>();
  public static long[] HideProcessWindows(uint pid) {
    List<long> handles = new List<long>();
    EnumWindows(delegate(IntPtr window, IntPtr data) {
      uint owner;
      GetWindowThreadProcessId(window, out owner);
      // Minimized windows already expose the desktop; leave them untouched.
      if (owner == pid && IsWindowVisible(window) && !IsIconic(window)) {
        long handle = window.ToInt64(); hidden[handle] = pid; handles.Add(handle);
        ShowWindowAsync(window, 0);
      }
      return true;
    }, IntPtr.Zero);
    Thread.Sleep(140);
    DwmFlush();
    foreach (long handle in handles) {
      if (IsWindowVisible(new IntPtr(handle))) {
        RestoreAll();
        throw new InvalidOperationException("DSH window could not be hidden");
      }
    }
    return handles.ToArray();
  }
  public static void RestoreWindows(long[] handles, uint pid) {
    foreach (long handle in handles) {
      IntPtr window = new IntPtr(handle); uint owner;
      GetWindowThreadProcessId(window, out owner);
      if (IsWindow(window) && owner == pid) ShowWindowAsync(window, 8);
      hidden.Remove(handle);
    }
    Thread.Sleep(50);
  }
  public static void RestoreAll() {
    foreach (KeyValuePair<long, uint> item in hidden) {
      IntPtr window = new IntPtr(item.Key); uint owner;
      GetWindowThreadProcessId(window, out owner);
      if (IsWindow(window) && owner == item.Value) ShowWindowAsync(window, 8);
    }
    hidden.Clear();
    Thread.Sleep(50);
  }
}
"@
try { [ShotNative]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null }
catch { [ShotNative]::SetProcessDPIAware() | Out-Null }
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
try {
while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line -eq 'quit') { break }
  $bitmap = $null
  $graphics = $null
  $stream = $null
  try {
    $cmd = $line | ConvertFrom-Json
    if ($cmd.op -eq 'windowAt') {
      $result = [ShotNative]::WindowAt([int]$cmd.x, [int]$cmd.y, [uint32]$cmd.excludePid)
    } elseif ($cmd.op -eq 'hide') {
      if ([int]$cmd.pid -le 0) { throw 'DSH shell process is unavailable' }
      $handles = [ShotNative]::HideProcessWindows([uint32]$cmd.pid)
      $result = @{ windows=@($handles | ForEach-Object { $_.ToString() }); pid=[int]$cmd.pid }
    } elseif ($cmd.op -eq 'restore') {
      [ShotNative]::RestoreWindows([long[]]@($cmd.windows), [uint32]$cmd.pid)
      $result = @{ restored=$true }
    } elseif ($cmd.op -eq 'focus') {
      $target = [System.Diagnostics.Process]::GetProcessById([int]$cmd.pid)
      $window = $target.MainWindowHandle
      if ($window -ne [IntPtr]::Zero) {
        if ([ShotNative]::IsIconic($window)) { [ShotNative]::ShowWindow($window, 9) | Out-Null }
        else { [ShotNative]::ShowWindow($window, 8) | Out-Null }
        [ShotNative]::SetForegroundWindow($window) | Out-Null
      }
      $result = @{ focused=($window -ne [IntPtr]::Zero) }
    } elseif ($cmd.op -eq 'pointer') {
      $point = New-Object ShotNative+Point
      [ShotNative]::GetCursorPos([ref]$point) | Out-Null
      $result = @{ x=$point.X; y=$point.Y; down=(([ShotNative]::GetAsyncKeyState(1) -band 0x8000) -ne 0) }
    } elseif ($cmd.op -eq 'region') {
      $w = [int]$cmd.width; $h = [int]$cmd.height
      if ($w -lt 1 -or $h -lt 1 -or ([long]$w * $h) -gt 100000000) { throw 'Invalid region dimensions' }
      [ShotNative]::DwmFlush() | Out-Null
      $bitmap = New-Object System.Drawing.Bitmap $w, $h
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen([int]$cmd.x, [int]$cmd.y, 0, 0, $bitmap.Size)
      $stream = New-Object System.IO.MemoryStream
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $result = @{ png=[Convert]::ToBase64String($stream.ToArray()); width=$w; height=$h }
    } else { throw 'Unknown operation' }
    [Console]::Out.WriteLine((@{ ok=$true; result=$result } | ConvertTo-Json -Compress))
  } catch {
    [Console]::Out.WriteLine((@{ ok=$false; error=$_.Exception.Message } | ConvertTo-Json -Compress))
  } finally {
    if ($graphics) { $graphics.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
  }
  [Console]::Out.Flush()
}
} finally { [ShotNative]::RestoreAll() }

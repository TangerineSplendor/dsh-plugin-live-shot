using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Threading;
using System.Web.Script.Serialization;

public static class PickerApi {
  public delegate IntPtr KeyboardProc(int code,IntPtr message,IntPtr data);
  [DllImport("user32.dll")] public static extern IntPtr SetWindowsHookEx(int kind,KeyboardProc callback,IntPtr module,uint thread);
  [DllImport("user32.dll")] public static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
  [DllImport("kernel32.dll")] public static extern IntPtr GetModuleHandle(string name);
  [StructLayout(LayoutKind.Sequential)] public struct RawDevice { public ushort page,usage; public uint flags; public IntPtr target; }
  [StructLayout(LayoutKind.Sequential)] public struct RawHeader { public uint type,size; public IntPtr device,param; }
  [DllImport("user32.dll",SetLastError=true)] public static extern bool RegisterRawInputDevices(RawDevice[] devices,uint count,uint size);
  [DllImport("user32.dll")] public static extern uint GetRawInputData(IntPtr input,uint command,IntPtr data,ref uint size,uint headerSize);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  public delegate bool EnumProc(IntPtr handle,IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr data);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle,out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle,out Rect rect);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr handle,int attribute,out Rect rect,int size);
  [DllImport("dwmapi.dll",EntryPoint="DwmGetWindowAttribute")] public static extern int GetCloaked(IntPtr handle,int attribute,out int cloaked,int size);
  public static Rectangle WindowAt(Point point,Rectangle area) {
    Rectangle result=Rectangle.Empty;
    uint self=(uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    EnumWindows(delegate(IntPtr handle,IntPtr data){
      uint pid;GetWindowThreadProcessId(handle,out pid);int cloaked;
      GetCloaked(handle,14,out cloaked,4);
      if(pid==self||!IsWindowVisible(handle)||IsIconic(handle)||cloaked!=0)return true;
      Rect r;if(DwmGetWindowAttribute(handle,9,out r,16)!=0&&!GetWindowRect(handle,out r))return true;
      Rectangle rect=Rectangle.FromLTRB(r.Left,r.Top,r.Right,r.Bottom);
      if(rect.Width<2||rect.Height<2||!rect.Contains(point))return true;
      result=Rectangle.Intersect(rect,area);return false;
    },IntPtr.Zero);
    return result;
  }
  [StructLayout(LayoutKind.Sequential)] public struct P { public int X,Y; public P(int x,int y){X=x;Y=y;} }
  [StructLayout(LayoutKind.Sequential)] public struct S { public int X,Y; public S(int x,int y){X=x;Y=y;} }
  [StructLayout(LayoutKind.Sequential,Pack=1)] public struct Blend { public byte op,flags,alpha,format; }
  [StructLayout(LayoutKind.Sequential)] public struct Info { public uint size; public int width,height; public ushort planes,bits; public uint compression,imageSize; public int xp,yp; public uint used,important,color; }
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr GetProp(IntPtr window,string name);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern bool SetProp(IntPtr window,string name,IntPtr value);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr RemoveProp(IntPtr window,string name);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr handle,int id,uint mods,uint key);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr handle,int id);
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr handle);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr handle,IntPtr dc);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateDIBSection(IntPtr dc,ref Info info,uint usage,out IntPtr bits,IntPtr section,uint offset);
  [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr value);
  [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr dc);
  [DllImport("user32.dll",SetLastError=true)] public static extern bool UpdateLayeredWindow(IntPtr handle,IntPtr screen,ref P position,ref S size,IntPtr source,ref P origin,uint key,ref Blend blend,uint flags);
}

public class NativeSelectionWindow : Form {
  private readonly Rectangle area;
  private readonly IntPtr foreground;
  private readonly Action<Dictionary<string,object>> done;
  private Bitmap bitmap;
  private Graphics graphics;
  private IntPtr dc,dib,old;
  private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
  private Point start,current;
  private bool dragging,dirty=true,esc;
  private bool finished;
  private Rectangle hover;
  private DateTime hoverTime=DateTime.MinValue;
  private IntPtr keyboardHook;
  private bool rawKeyboard;
  private PickerApi.KeyboardProc keyboardCallback;
  private Dictionary<string,object> outcome;
  private string cancelReason="cancelled";
  public string SourceWindow { get { return foreground.ToInt64().ToString(); } }
  public bool EscapeHotkey { get { return esc; } }
  public bool EscapeHook { get { return keyboardHook!=IntPtr.Zero; } }
  public bool EscapeRawInput { get { return rawKeyboard; } }
  private readonly DateTime opened=DateTime.UtcNow;
  public NativeSelectionWindow(Rectangle bounds,Action<Dictionary<string,object>> closed) {
    done=closed; foreground=PickerApi.GetForegroundWindow();
    area=bounds;
    FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false; TopMost=true;
    AutoScaleMode=AutoScaleMode.None;
    StartPosition=FormStartPosition.Manual; Bounds=area; Cursor=Cursors.Cross;
    Text="DSH native selection";
    timer.Interval=33;
    timer.Tick+=delegate {
      if ((DateTime.UtcNow-opened).TotalSeconds>120) { cancelReason="timeout";Finish(false); return; }
      if ((PickerApi.GetAsyncKeyState(27)&0x8000)!=0 || (PickerApi.GetAsyncKeyState(2)&0x8000)!=0) { cancelReason="cancel-key";Finish(false); return; }
      if (foreground!=IntPtr.Zero && PickerApi.GetForegroundWindow()!=foreground) { cancelReason="foreground-changed";Finish(false); return; }
      if (dirty) Present();
    };
  }
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams { get { var p=base.CreateParams; p.ExStyle|=0x80000|0x8000000|0x80; return p; } }
  protected override void WndProc(ref Message message) {
    if(message.Msg==0xff&&rawKeyboard) {
      uint size=0,header=(uint)Marshal.SizeOf(typeof(PickerApi.RawHeader));
      PickerApi.GetRawInputData(message.LParam,0x10000003,IntPtr.Zero,ref size,header);
      if(size>=header+16&&size<=1024) {
        IntPtr data=Marshal.AllocHGlobal((int)size);
        try {
          uint read=PickerApi.GetRawInputData(message.LParam,0x10000003,data,ref size,header);
          if(read!=uint.MaxValue&&read>=header+16&&Marshal.ReadInt32(data)==1&&Marshal.ReadInt16(data,(int)header+6)==27&&(Marshal.ReadInt16(data,(int)header+2)&1)==0) {
            cancelReason="escape-raw-input";BeginInvoke((Action)delegate{Finish(false);});
          }
        } finally { Marshal.FreeHGlobal(data); }
      }
    }
    if (message.Msg==0x21) { message.Result=new IntPtr(3); return; }
    if (message.Msg==0x312) { cancelReason="escape-hotkey";Finish(false); return; }
    base.WndProc(ref message);
  }
  protected override void OnHandleCreated(EventArgs e) {
    base.OnHandleCreated(e);
    var screen=PickerApi.GetDC(IntPtr.Zero);
    dc=PickerApi.CreateCompatibleDC(screen);
    var info=new PickerApi.Info { size=40,width=area.Width,height=-area.Height,planes=1,bits=32 };
    IntPtr pixels; dib=PickerApi.CreateDIBSection(screen,ref info,0,out pixels,IntPtr.Zero,0);
    PickerApi.ReleaseDC(IntPtr.Zero,screen);
    if (dib==IntPtr.Zero) throw new InvalidOperationException("CreateDIBSection failed");
    old=PickerApi.SelectObject(dc,dib);
    bitmap=new Bitmap(area.Width,area.Height,area.Width*4,PixelFormat.Format32bppPArgb,pixels);
    graphics=Graphics.FromImage(bitmap); graphics.CompositingMode=CompositingMode.SourceCopy;
    esc=PickerApi.RegisterHotKey(Handle,2,0,27); Present();
  }
  protected override void OnShown(EventArgs e) {
    base.OnShown(e);
    // Only Escape is handled. Other keys are neither logged nor modified.
    // Keep callback work short; close the window on the message loop instead.
    keyboardCallback=delegate(int code,IntPtr message,IntPtr data) {
      if(code>=0&&Marshal.ReadInt32(data)==27) {
        if(message.ToInt32()==0x100||message.ToInt32()==0x104)BeginInvoke((Action)delegate{cancelReason="escape-hook";Finish(false);});
        return new IntPtr(1);
      }
      return PickerApi.CallNextHookEx(keyboardHook,code,message,data);
    };
    keyboardHook=PickerApi.SetWindowsHookEx(13,keyboardCallback,PickerApi.GetModuleHandle(null),0);
    rawKeyboard=PickerApi.RegisterRawInputDevices(new[]{new PickerApi.RawDevice { page=1,usage=6,flags=0x100,target=Handle }},1,(uint)Marshal.SizeOf(typeof(PickerApi.RawDevice)));
    timer.Start();
  }
  protected override void OnPaintBackground(PaintEventArgs e) {}
  protected override void OnPaint(PaintEventArgs e) {}
  protected override void OnMouseDown(MouseEventArgs e) {
    if(e.Button==MouseButtons.Right){Finish(false);return;}
    if(e.Button!=MouseButtons.Left)return;
    hover=PickerApi.WindowAt(Cursor.Position,area);
    start=current=e.Location; dragging=true; Capture=true; dirty=true;
  }
  protected override void OnMouseMove(MouseEventArgs e) {
    if(dragging){current=e.Location;dirty=true;}
    else if((DateTime.UtcNow-hoverTime).TotalMilliseconds>=90){hoverTime=DateTime.UtcNow;hover=PickerApi.WindowAt(Cursor.Position,area);dirty=true;}
  }
  protected override void OnMouseUp(MouseEventArgs e) {
    if(e.Button!=MouseButtons.Left||!dragging)return;
    current=e.Location; Capture=false; Finish(true);
  }
  private Rectangle RegionBox() {
    int x=Math.Max(0,Math.Min(area.Width,Math.Min(start.X,current.X)));
    int y=Math.Max(0,Math.Min(area.Height,Math.Min(start.Y,current.Y)));
    int right=Math.Max(0,Math.Min(area.Width,Math.Max(start.X,current.X)));
    int bottom=Math.Max(0,Math.Min(area.Height,Math.Max(start.Y,current.Y)));
    return new Rectangle(x,y,right-x,bottom-y);
  }
  private void Present() {
    if(graphics==null)return;
    graphics.Clear(Color.FromArgb(1,0,0,0));
    if(!dragging&&!hover.IsEmpty)using(var pen=new Pen(Color.FromArgb(255,10,132,255),1))graphics.DrawRectangle(pen,hover.X-area.X,hover.Y-area.Y,hover.Width,hover.Height);
    if(dragging) {
      Rectangle r=RegionBox();
      using(var brush=new SolidBrush(Color.FromArgb(20,0,0,0))) {
        graphics.FillRectangle(brush,0,0,area.Width,r.Top);
        graphics.FillRectangle(brush,0,r.Bottom,area.Width,area.Height-r.Bottom);
        graphics.FillRectangle(brush,0,r.Top,r.Left,r.Height);
        graphics.FillRectangle(brush,r.Right,r.Top,area.Width-r.Right,r.Height);
      }
      if(r.Width>0&&r.Height>0)using(var pen=new Pen(Color.FromArgb(255,7,193,96),2))graphics.DrawRectangle(pen,r);
    }
    graphics.Flush();
    var position=new PickerApi.P(area.X,area.Y); var size=new PickerApi.S(area.Width,area.Height); var origin=new PickerApi.P(0,0);
    var blend=new PickerApi.Blend { alpha=255,format=1 };
    if(!PickerApi.UpdateLayeredWindow(Handle,IntPtr.Zero,ref position,ref size,dc,ref origin,0,ref blend,2))throw new InvalidOperationException("UpdateLayeredWindow failed: "+Marshal.GetLastWin32Error());
    dirty=false;
  }
  private void Finish(bool selected) {
    if(finished)return;finished=true;
    timer.Stop(); Rectangle r=RegionBox();
    if(selected&&Math.Abs(start.X-current.X)<3&&Math.Abs(start.Y-current.Y)<3&&!hover.IsEmpty)r=new Rectangle(hover.X-area.X,hover.Y-area.Y,hover.Width,hover.Height);
    outcome=new Dictionary<string,object>{{"selected",selected&&r.Width>=2&&r.Height>=2},{"reason",selected?"release":cancelReason},{"sourceWindow",SourceWindow},{"foregroundWindow",PickerApi.GetForegroundWindow().ToInt64().ToString()}};
    if(selected&&r.Width>=2&&r.Height>=2){outcome["x"]=area.X+r.X;outcome["y"]=area.Y+r.Y;outcome["width"]=r.Width;outcome["height"]=r.Height;}
    Close();
  }
  public void CancelSelection(){cancelReason="parent-cancel";Finish(false);}
  public void CancelEscape(){cancelReason="escape-admin-bridge";Finish(false);}
  protected override void OnFormClosed(FormClosedEventArgs e) {
    timer.Stop(); timer.Dispose(); if(esc)PickerApi.UnregisterHotKey(Handle,2);
    if(keyboardHook!=IntPtr.Zero){PickerApi.UnhookWindowsHookEx(keyboardHook);keyboardHook=IntPtr.Zero;}
    if(rawKeyboard){PickerApi.RegisterRawInputDevices(new[]{new PickerApi.RawDevice { page=1,usage=6,flags=1,target=IntPtr.Zero }},1,(uint)Marshal.SizeOf(typeof(PickerApi.RawDevice)));rawKeyboard=false;}
    if(graphics!=null)graphics.Dispose(); if(bitmap!=null)bitmap.Dispose();
    if(dc!=IntPtr.Zero){PickerApi.SelectObject(dc,old);PickerApi.DeleteObject(dib);PickerApi.DeleteDC(dc);}
    base.OnFormClosed(e); done(outcome??new Dictionary<string,object>{{"selected",false}});
  }
}

public class NativeSelectionServer : ApplicationContext {
  private class EscapeControl : Control {
    public Action Escape;
    public IntPtr Nonce;
    protected override void WndProc(ref Message message){if(message.Msg==0x8039&&message.WParam==Nonce){if(Escape!=null)Escape();return;}base.WndProc(ref message);}
  }
  private readonly EscapeControl bridge=new EscapeControl();
  private readonly string scriptRoot;
  private readonly IntPtr nonce=new IntPtr((Guid.NewGuid().GetHashCode()&0x3fffffff)+1);
  private System.Windows.Forms.Timer adminWait;
  private readonly JavaScriptSerializer json=new JavaScriptSerializer();
  private NativeSelectionWindow picker;
  private bool closing;
  private void Reply(string id,object result,string error) {
    try{Console.WriteLine(json.Serialize(new Dictionary<string,object>{{"id",id},{"ok",error==null},{"result",result},{"error",error}}));Console.Out.Flush();}catch(System.IO.IOException){}
  }
  private bool AdminReady { get { return PickerApi.GetProp(bridge.Handle,"DshShotEscapeAdmin")==nonce; } }
  public NativeSelectionServer(string root) {
    scriptRoot=root;
    IntPtr handle=bridge.Handle;
    bridge.Nonce=nonce;bridge.Escape=delegate { if(picker!=null)picker.CancelEscape(); };
    if(!PickerApi.SetProp(handle,"DshShotEscapeOwner",nonce))throw new InvalidOperationException("Could not initialize picker owner");
    var input=new Thread(delegate(){
      string line;
      try{while((line=Console.ReadLine())!=null){string command=line;bridge.BeginInvoke((Action)delegate{Command(command);});}}
      catch(Exception){ }
      try{bridge.BeginInvoke((Action)delegate{ExitThread();});}catch(InvalidOperationException){}
    });
    input.IsBackground=true;input.Start();Console.WriteLine("READY");Console.Out.Flush();
  }
  private void Command(string line) {
    string id=null;
    try{
      var cmd=json.Deserialize<Dictionary<string,object>>(line);id=Convert.ToString(cmd["id"]);string op=Convert.ToString(cmd["op"]);
      if(op=="quit"){ExitThread();return;}
      if(op=="adminEscapeStatus"){Reply(id,new { ready=AdminReady },null);return;}
      if(op=="enableAdminEscape"){
        if(AdminReady){Reply(id,new { ready=true },null);return;}
        if(picker!=null||adminWait!=null)throw new InvalidOperationException("Finish selection before enabling game compatibility");
        string script=System.IO.Path.Combine(scriptRoot,"escape_bridge.ps1");
        var launch=new System.Diagnostics.ProcessStartInfo { FileName=System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\v1.0\\powershell.exe"),Arguments="-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\" -OwnerPid "+System.Diagnostics.Process.GetCurrentProcess().Id+" -OwnerWindow "+handleValue()+" -Nonce "+nonce.ToInt64(),UseShellExecute=true,Verb="runas",WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden };
        using(var process=System.Diagnostics.Process.Start(launch)){}
        DateTime deadline=DateTime.UtcNow.AddSeconds(15);string adminRequest=id;
        adminWait=new System.Windows.Forms.Timer();adminWait.Interval=50;
        adminWait.Tick+=delegate {
          if(!AdminReady&&DateTime.UtcNow<deadline)return;
          adminWait.Stop();adminWait.Dispose();adminWait=null;
          Reply(adminRequest,new { ready=AdminReady },AdminReady?null:"Game compatibility helper did not start");
        };
        adminWait.Start();return;
      }
      if(op=="cancel"){if(picker!=null)picker.CancelSelection();Reply(id,new { cancelled=true },null);return;}
      if(op=="status"){Reply(id,new { active=picker!=null, visible=picker!=null&&PickerApi.IsWindowVisible(picker.Handle), handle=picker==null?"0":picker.Handle.ToInt64().ToString(), sourceWindow=picker==null?"0":picker.SourceWindow, foregroundWindow=PickerApi.GetForegroundWindow().ToInt64().ToString(), escapeHook=picker!=null&&picker.EscapeHook, escapeHotkey=picker!=null&&picker.EscapeHotkey, escapeRawInput=picker!=null&&picker.EscapeRawInput, adminEscapeReady=AdminReady, adminEscapeHook=PickerApi.GetProp(bridge.Handle,"DshShotEscapeHook")==nonce },null);return;}
      if(op!="select")throw new InvalidOperationException("Unknown native selection operation");
      if(picker!=null)throw new InvalidOperationException("Native selection already active");
      int x=Convert.ToInt32(cmd["x"]),y=Convert.ToInt32(cmd["y"]),w=Convert.ToInt32(cmd["width"]),h=Convert.ToInt32(cmd["height"]);
      if(w<2||h<2||(long)w*h>100000000)throw new InvalidOperationException("Invalid native selection bounds");
      string request=id;
      picker=new NativeSelectionWindow(new Rectangle(x,y,w,h),delegate(Dictionary<string,object> result){PickerApi.RemoveProp(bridge.Handle,"DshShotEscapeActive");picker=null;Reply(request,result,null);});
      PickerApi.SetProp(bridge.Handle,"DshShotEscapeActive",nonce);
      picker.Show();
    }catch(Exception error){Reply(id,null,error.Message);}
  }
  private string handleValue(){return bridge.Handle.ToInt64().ToString();}
  protected override void ExitThreadCore(){if(closing)return;closing=true;if(adminWait!=null){adminWait.Stop();adminWait.Dispose();}if(picker!=null)picker.CancelSelection();PickerApi.RemoveProp(bridge.Handle,"DshShotEscapeOwner");bridge.Dispose();base.ExitThreadCore();}
  public static void Run(string root){
    try{PickerApi.SetThreadDpiAwarenessContext(new IntPtr(-4));}catch{PickerApi.SetProcessDPIAware();}
    Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
    Application.EnableVisualStyles();Application.Run(new NativeSelectionServer(root));
  }
}

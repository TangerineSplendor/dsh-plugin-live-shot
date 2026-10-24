using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// The elevated process can only request cancellation of its original picker.
// It accepts no commands, files, capture requests, or keyboard text.
public sealed class AdminEscapeBridge : ApplicationContext {
  private delegate IntPtr KeyboardProc(int code,IntPtr message,IntPtr data);
  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr GetProp(IntPtr window,string name);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern bool SetProp(IntPtr window,string name,IntPtr value);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr RemoveProp(IntPtr window,string name);
  [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window,uint message,IntPtr param,IntPtr data);
  [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int kind,KeyboardProc callback,IntPtr module,uint thread);
  [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
  [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string name);
  private readonly IntPtr target,nonce;
  private readonly uint owner;
  private readonly Timer timer=new Timer();
  private readonly KeyboardProc callback;
  private readonly DateTime started=DateTime.UtcNow;
  private IntPtr hook;
  private bool active;
  private bool ValidTarget() {
    uint actual;
    return IsWindow(target)&&GetWindowThreadProcessId(target,out actual)!=0&&actual==owner&&GetProp(target,"DshShotEscapeOwner")==nonce;
  }
  private AdminEscapeBridge(int pid,long window,int value) {
    owner=(uint)pid;target=new IntPtr(window);nonce=new IntPtr(value);
    if(pid<=0||window==0||value<=0||!ValidTarget())throw new InvalidOperationException("Invalid picker owner");
    if(GetProp(target,"DshShotEscapeAdmin")==nonce)throw new InvalidOperationException("Escape bridge already active");
    callback=delegate(int code,IntPtr message,IntPtr data) {
      if(active&&code>=0&&Marshal.ReadInt32(data)==27) {
        int kind=message.ToInt32();
        if((kind==0x100||kind==0x104)&&PostMessage(target,0x8039,nonce,IntPtr.Zero))return new IntPtr(1);
      }
      return CallNextHookEx(hook,code,message,data);
    };
    if(!SetProp(target,"DshShotEscapeAdmin",nonce))throw new InvalidOperationException("Could not acknowledge picker owner");
    timer.Interval=25;
    timer.Tick+=delegate {
      if(!ValidTarget()||(DateTime.UtcNow-started).TotalHours>=12){ExitThread();return;}
      active=GetProp(target,"DshShotEscapeActive")==nonce;
      if(active&&hook==IntPtr.Zero)hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
      if(!active&&hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}
      if(hook!=IntPtr.Zero)SetProp(target,"DshShotEscapeHook",nonce);
      else RemoveProp(target,"DshShotEscapeHook");
    };
    timer.Start();
  }
  protected override void ExitThreadCore() {
    timer.Stop();timer.Dispose();active=false;
    if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}
    if(ValidTarget()){RemoveProp(target,"DshShotEscapeAdmin");RemoveProp(target,"DshShotEscapeHook");}
    base.ExitThreadCore();
  }
  public static void Run(int pid,long window,int nonce) {
    if(!new System.Security.Principal.WindowsPrincipal(System.Security.Principal.WindowsIdentity.GetCurrent()).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator))throw new InvalidOperationException("Administrator confirmation required");
    Application.Run(new AdminEscapeBridge(pid,window,nonce));
  }
}

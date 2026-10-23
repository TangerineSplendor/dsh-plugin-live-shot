# DSH Shot 0.7.0-beta.4

**下载提醒：请使用本页的 `dsh-shot-0.7.0-beta.4-windows-x64.zip`，安装时应显示 `Installed 0.7.0-beta.4`。beta.2 安装器有相机按钮及插图 Client 加载缺陷，重新下载旧版本仍会复现。npm 注册表目前仍是 beta.2，暂时请用本页 ZIP 或 TGZ。**

The live selector now paints a one-alpha-level input surface. On Windows, fully transparent regions can fail native mouse hit testing and let a selection drag hit the application underneath. This almost invisible backdrop keeps mouse input on the selector while the desktop remains live. It is hidden before capturing the selected region; no full-screen preview or early capture was added.

Fix for beta.2 ZIP/explicit-installer users: the global hotkey worked, but the composer camera was absent and completed screenshots stayed queued. The installer used the legacy Loader name while package.json had the public name, so DSH silently skipped the Client half.

All installation paths now use dsh-plugin-live-shot consistently. The installer migrates the legacy entry and preserves settings and custom data paths. No uninstall is required: run install.bat from this version, fully quit DSH from its tray menu, and reopen it.

The Windows CI now runs the actual installer in an isolated fixture and checks Loader/manifest/Client identity, camera registration, completed PNG delivery and acknowledgement. Local migration tests also reproduce the beta.2 failure before verifying the upgrade.

- Live desktop selection with capture only after mouse release; native-resolution region PNG.
- Composer camera button and configurable global shortcut (default Ctrl+Shift+X).
- Window selection, region movement/resizing, annotation, mosaic, text, undo and PNG save.
- Optional remembered Hide DSH setting; Shift+camera reverses it for one capture.
- Enter/double-click inserts into DSH; Ctrl+C copies only; Esc/right-click cancels.
- Portable ZIP installer and npm command; first-run setup for standard bundle installs.
- MIT-licensed plugin source. DSH/Electron binaries and personal configuration are excluded.

## Install

Open DSH once, keep it running, extract the Windows ZIP and double-click install.bat. If asked, select your DeepSeek Harness.exe. Fully quit DSH from the tray menu and reopen it.

With Node.js, the alternative is:

```powershell
npx --yes --package=./dsh-plugin-live-shot-0.7.0-beta.4.tgz dsh-shot install
```

Download the attached `.tgz` first and run the command from its folder. The npm registry still serves beta.2; an unversioned registry install does not include this fix.

## Restart checks

1. Camera and Ctrl+Shift+X: desktop video/clock keeps updating during selection.
2. Window selection, resize and annotation; Hide DSH restores the app after cancel.
3. Enter inserts; Ctrl+C copies only; preferences persist across a full restart.

## Evidence and limits

Core state-machine tests, real Windows PowerShell region capture and isolated-profile installation/startup/removal tests were run locally. Other PCs still need compatibility testing; no claim of universal DSH/RDP compatibility. One monitor per selection, no cross-monitor stitching or long screenshot. Composer insertion depends on DSH paste/drop behavior. The dedicated local Electron helper uses --no-sandbox, context isolation and a network-blocking page CSP.

# DSH Shot 0.7.0-beta.2

First public beta for the official Windows x64 DeepSeek Harness desktop app.

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
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.2 dsh-shot install
```

The npm registry publication may follow the GitHub Release; the attached .tgz can also be used with `npx --package=./dsh-plugin-live-shot-0.7.0-beta.2.tgz dsh-shot install`.

## Restart checks

1. Camera and Ctrl+Shift+X: desktop video/clock keeps updating during selection.
2. Window selection, resize and annotation; Hide DSH restores the app after cancel.
3. Enter inserts; Ctrl+C copies only; preferences persist across a full restart.

## Evidence and limits

Core state-machine tests, real Windows PowerShell region capture and isolated-profile installation/startup/removal tests were run locally. Other PCs still need compatibility testing; no claim of universal DSH/RDP compatibility. One monitor per selection, no cross-monitor stitching or long screenshot. Composer insertion depends on DSH paste/drop behavior. The dedicated local Electron helper uses --no-sandbox, context isolation and a network-blocking page CSP.

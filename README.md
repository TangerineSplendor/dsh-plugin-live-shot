# dsh-plugin-live-shot

[![DSH Market 已收录](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg)](https://dsh.market/)

Windows screenshot and annotation plugin for DeepSeek Harness. Select the **live desktop**, capture only the selected region after releasing the mouse, then insert the image directly into the conversation draft.

Windows 实时桌面截图插件：全局热键、窗口识别、选区调整、标注，以及直接插入 DSH 输入框。

统一名称为 **dsh-plugin-live-shot**，用于 GitHub、DSH Market、npm 和插件显示。此前的 DSH Shot / dsh-screenshot 均指本插件；`dsh-shot` 继续作为安装/卸载命令简称，现有配置和数据目录保持兼容。

[Download Windows ZIP 0.7.0-beta.6](https://github.com/TangerineSplendor/dsh-plugin-live-shot/releases/download/v0.7.0-beta.6/dsh-plugin-live-shot-0.7.0-beta.6-windows-x64.zip) · [Release notes](https://github.com/TangerineSplendor/dsh-plugin-live-shot/releases/tag/v0.7.0-beta.6) · [DSH Market 已确认收录](https://github.com/2BingLing/dsh-market/issues/283#issuecomment-6379257821)

**当前测试版为 `0.7.0-beta.6`。此版统一公开名称和下载包命名，截图行为沿用 beta.5；游戏预框选 Esc 取消仍有已知问题，暂用右键退出。旧 beta.2 的相机/插图安装缺陷已在此前版本修复，该旧版已下架。**

**Beta: 0.7.0-beta.6. Windows 10/11 x64, official DSH desktop only.** Tested on the developer's machine with isolated profiles; compatibility on other machines still needs feedback. macOS, Linux, browser-only DSH and remote Hosts are unsupported.

## Install / 安装

Install and open the official Windows DSH desktop app at least once. Keep DSH running during setup so the installer can find its executable.

**ZIP, no additional Node.js required:** download [dsh-plugin-live-shot-0.7.0-beta.6-windows-x64.zip](https://github.com/TangerineSplendor/dsh-plugin-live-shot/releases/download/v0.7.0-beta.6/dsh-plugin-live-shot-0.7.0-beta.6-windows-x64.zip), extract it completely and run `install.bat`. The installer must print `Installed 0.7.0-beta.6`. If prompted, select your installed `DeepSeek Harness.exe`. Quit DSH completely from its tray menu and reopen it. Do not reuse a beta.2 ZIP or its extracted installer.

**npm, for users who already have Node.js:**

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.6 dsh-shot install
```

Alternatively, download the Release TGZ and use `npx --yes --package=./dsh-plugin-live-shot-0.7.0-beta.6.tgz dsh-shot install` from its folder. Use `dsh-shot install -DshExe "C:\Apps\DeepSeek Harness\DeepSeek Harness.exe"` if automatic detection fails. `-ProfileDir`, `-DshHome` and `-DataDir` support non-default installations. Then fully quit and reopen DSH.

ZIP, npm and standard bundle installations all use `dsh-plugin-live-shot` as the installed directory, Loader entry, manifest name and Client module ID. The installer migrates the old `@local/dsh-shot` entry while preserving its settings and custom data directory. Beta.2 ZIP installations had a name mismatch that prevented the camera and image delivery from loading; upgrade with this installer and completely restart DSH. Standard bundle installations prepare the local runtime on first startup; if automatic discovery fails, use the explicit installer instead.

安装无需管理员权限。ZIP 安装不需要额外 Node 或网络下载；npm 方式需要 Node 和网络获取插件包。辅助运行时均从你本机的 DSH 复制，首次约需数百 MB 空间，不修改 DSH 程序目录。DSH 升级后重新运行安装器。

## Use / 使用

- Click the camera in the composer, or press **Ctrl+Shift+X** from any program. The desktop remains live while selecting; no full-screen preview is captured.
- Hover a window and click to select it, or drag a custom region. After release, move the selection with **↔** or resize its eight handles. Releasing a changed selection captures the new region.
- Rectangle, ellipse, arrow, pen, mosaic, text, undo and PNG save are available.
- **Enter / double-click / Done** inserts into the active DSH composer. **Ctrl+C** copies only. **Right-click** cancels. Esc works in the editor; preselection Esc in games remains a known issue.
- **隐藏 DSH** remembers whether to hide DSH during capture. **Shift+camera** inverts that choice for one capture. Completion or cancellation restores hidden windows.
- **⚙** changes the global shortcut. A conflict or save failure preserves the previous binding.

## Known issue in this beta / 本版已知问题

游戏预框选阶段 Esc 可能无效，暂用右键退出；松手后的编辑器 Esc 已获本机反馈正常。⚙ 中新增手动启用的「管理员游戏兼容」试验入口，需要本人确认 Windows 提示，仅本次辅助进程运行有效。**完整插件实测仍未解决该 Esc 问题，不能将此入口视为已修复或保证有效。**普通截图和安装不请求管理员权限。编辑后移动/调整选区仍使用 Electron，游戏焦点行为尚待进一步验证。

本机用户已确认 B 站视频框选期间恢复可见、游戏原生拖选可用；这不是所有游戏或所有机器的兼容性保证。

## Restart acceptance / 重启后三步验收

1. Use the camera and the global hotkey; select over a moving clock or video and confirm the desktop stays live.
2. Select a window, adjust the region and add annotations; enable **隐藏 DSH**, cancel and confirm DSH returns.
3. Verify Enter inserts, Ctrl+C copies only, and saved hotkey/hide preferences survive another complete restart.

## Uninstall / 卸载

For the explicit installer, run `uninstall.bat`, or:

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.6 dsh-shot uninstall
```

Then completely restart DSH. Default removal retains settings and local runtime. The optional `-RemoveData` also deletes the dedicated data directory, including images saved in its `captures` folder. For a non-default profile, pass the same `-ProfileDir` used to install. If installed as a standard DSH bundle, remove it through that bundle manager instead.

Full path options and troubleshooting: [portable_readme.md](portable_readme.md).

## Limits and local access

One monitor per selection; no cross-monitor stitching or scrolling capture. Window detection covers top-level windows. Protected video and UAC secure desktops follow Windows restrictions. Capture occurs after hiding the overlay and waiting for composition, rather than promising the exact video frame at mouse release.

The plugin registers a global hotkey, reads pointer/window geometry, captures the region you select, and writes the clipboard or a PNG only when requested. It uses an authenticated random-token loopback connection between its local processes. The dedicated Electron helper uses `--no-sandbox` and a local page with context isolation and a network-blocking CSP; it must not load remote pages. The plugin does not upload screenshots or read account keys.

Composer delivery uses DSH's current paste/drop DOM behavior; version changes may require adaptation. Report DSH/Windows versions, monitor scaling, RDP use and the error message in [Issues](https://github.com/TangerineSplendor/dsh-plugin-live-shot/issues). Do not attach account settings or private screenshots.

## Development

No npm dependencies or build step. Runtime files and machine-specific configuration are excluded from public artifacts. On Windows with Node:

```powershell
node --experimental-vm-modules tests/host_test.mjs
node tests/selection_settings_test.mjs
node tests/client_install_test.mjs
node tests/worker_test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build_portable.ps1
```

The worker test captures a small region locally without writing it to disk. Integration tests require an installed DSH and should use isolated profiles.

MIT license for this plugin. DSH/Electron binaries are not included; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent community plugin.

# DSH Shot — Windows 可移植测试包

版本：0.7.0-beta.4。适用于 **Windows 10/11 x64 的官方 DeepSeek Harness 桌面版**。需要先安装并打开过一次 DSH。macOS、Linux、纯浏览器、远程服务器 Host 和其他桌面壳未验证。

## 安装

1. 完整解压 ZIP 到普通本地文件夹，不要直接在压缩包内运行。
2. 保持 DSH 打开，双击 `install.bat`。脚本优先从运行中的 DSH 定位程序；找不到时会弹窗，请选择已安装的 `DeepSeek Harness.exe`。
3. 看到 `Installed` 后，从托盘菜单完整退出 DSH，再重新打开。只关闭主窗口不会加载新版插件。

不需要额外安装 Node.js、不需要管理员权限、不下载依赖。脚本使用 Windows 自带 PowerShell 5.1，并从本机 DSH 复制截图辅助运行时，首次安装约占用数百 MB 本地空间。测试包只包含插件代码，不包含别人的 DSH 程序或个人配置。

安装后可以删除解压目录。插件默认装到 `<DSH_HOME>/profiles/desktop/node_modules/dsh-plugin-live-shot`；运行时、设置和临时文件保存在该 profile 的 `.dsh-shot-data`，不依赖解压路径，不要求任何特定盘符。`DSH_HOME` 未设置时使用用户目录下的 `.dsh`。

## 使用

- 点击输入框左侧相机，或按默认全局热键 **Ctrl+Shift+X**。
- 悬停高亮窗口，单击选择整个窗口；也可以自由拖动框选。
- 松手后用 **↔** 移动选区，或拖动八个手柄缩放；释放后重新抓取真实范围。
- 支持矩形、椭圆、箭头、画笔、马赛克、文字、撤销和 PNG 保存。
- **Enter / 双击 / 完成**：图片进入当前 DSH 输入框。**Ctrl+C**：仅复制图片。**Esc / 右键**：退出。
- 相机旁的 **隐藏 DSH** 会记住选择；Shift+点击相机仅本次反向切换。结束截图后恢复窗口。
- 相机旁 **⚙** 可以修改全局热键。冲突或保存失败时保留原设置。

默认保存对话框定位到插件数据目录的 `captures` 文件夹，也可自行选择 PNG 保存位置。

## 三步验收

1. 重启后点击相机，确认在真实桌面上框选，视频或时钟继续更新。
2. 试窗口识别、选区移动/缩放和标注；开启隐藏 DSH 后取消，确认窗口恢复。
3. 试 Enter 插图、Ctrl+C 复制和自定义热键；再重启，确认偏好仍在。

## 卸载 / 更新

双击 `uninstall.bat`，然后完整重启 DSH。默认保留设置、运行时和已保存图片，重新安装可继续使用。

确认不需要这些数据时，可在 PowerShell 中运行下面的命令彻底清理（也会删除数据目录内的 captures 图片）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveData
```

更新时解压新包并重新运行 `install.bat`。DSH 自身升级后也应重新运行安装脚本，以准备匹配版本的辅助运行时。旧运行时缓存保留在数据目录中。

## 自定义路径 / 无法自动定位

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DshExe "C:\Apps\DeepSeek Harness\DeepSeek Harness.exe"
```

自定义 DSH home 可用 `-DshHome`，完整 profile 路径可用 `-ProfileDir`，专用数据目录可用 `-DataDir`。数据目录必须为空或属于本插件，避免误操作其他文件。卸载自定义 profile 时传入相同的 `-ProfileDir`。

## 已知限制与反馈

- 当前一次框选限于一个显示器；窗口识别只识别顶层窗口。
- 松手后有隐藏覆盖层和等待合成的短暂间隔；视频截图不是对释放时刻的逐帧保证。
- 仅在开发者本机及不同路径下验证过，本包用于收集其他 Windows / DSH 版本的兼容性反馈。
- 辅助 Electron 使用本地专用页面与 `--no-sandbox` 启动参数；页面不加载远程网站。插件会注册全局热键、抓取用户指定选区，并按用户操作写剪贴板或文件。
- 报错时请提供 DSH 版本、Windows 版本、缩放比例、是否 RDP，以及报错原文；不需要发送登录信息或个人配置目录。

`checksums.sha256` 可用于核对包中文件的传输完整性。本插件采用 MIT 许可。源码与更新：https://github.com/TangerineSplendor/dsh-screenshot 。社区收录状态以发布记录为准。

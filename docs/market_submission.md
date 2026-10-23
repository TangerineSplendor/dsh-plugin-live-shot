## 发布与申请状态（2026-10-23）

更新：`0.7.0-beta.3` 修复 beta.2 ZIP 安装后相机消失、截图完成无人接收的问题。安装器现统一 Loader 配置、目录和 manifest 的公开包名，并自动迁移旧名称、保留设置；请使用新版安装器后完整重启 DSH。后续 Release：https://github.com/TangerineSplendor/dsh-screenshot/releases/tag/v0.7.0-beta.3 。

- GitHub Release 已发布：`v0.7.0-beta.2`。
- npm 已发布：https://www.npmjs.com/package/dsh-plugin-live-shot/v/0.7.0-beta.2 。注册表与实际下载的 TGZ 均已核对，和测试通过的 Release TGZ 完全一致。
- DSH Market 申请已提交：https://github.com/2BingLing/dsh-market/issues/283 。已带 `submission` 标签，机器人已确认收到；仍待收录处理，未宣称已获批准。

## 插件信息

- **GitHub 仓库地址**：https://github.com/TangerineSplendor/dsh-screenshot
- **插件类型**：cordis-plugin（包含 Host 与 Client 的 DSH bundle）
- **一句话简介**：Windows 桌面截图插件，支持实时桌面框选、窗口识别、选区标注、全局热键和直接插入 DSH 输入框。
- **作者自述简介**：[希望把截图到提问的操作缩短为一次框选。按热键后保持真实桌面可见，松手才抓选区；支持矩形、椭圆、箭头、画笔、马赛克、文字、撤销与保存，也可以选择截图时隐藏 DSH。Enter 插入输入框，Ctrl+C 只复制。当前为 Windows x64 的公开 beta，欢迎反馈不同 DSH、缩放比例和 RDP 环境的兼容性。]
- **是否已打 dsh-plugin 相关 topic**：尚未设置，通过本 issue 提交候选。

## 安装与版本

- 版本：`0.7.0-beta.2`，MIT。
- Release：https://github.com/TangerineSplendor/dsh-screenshot/releases/tag/v0.7.0-beta.2
- Windows 用户首选下载 Release 的 ZIP，完整解压，双击 `install.bat`。需要已安装并打开过的官方 Windows x64 DSH；找不到时选择 `DeepSeek Harness.exe`。完成后从托盘完整退出 DSH 并重新打开。
- ZIP 无需额外 Node、管理员权限或下载运行时。运行时从用户本机 DSH 准备，不在包中分发 DSH/Electron 二进制或个人配置。
- 附带 `.tgz` 提供 npm 格式的同一插件及 `dsh-shot install` / `uninstall` 入口；详情见 README。标准 bundle 安装声明在根目录 `package.json` 的 `dsh.bundle` 和 `cordis.patch.yml`。
- 默认卸载保留偏好和运行时，显式清理选项见说明。不需要 API Key 或外部服务。

## 验证与限制

本机已验证核心状态机、Windows PowerShell 原生区域抓屏、中文/空格/括号路径下的隔离安装与卸载、npm 安装入口、无预先配置时的运行时准备，以及真实 Electron 启动/取消；公开仓库还包含 Windows CI。其他电脑仍待兼容性反馈，不宣称所有环境端到端可用。

仅支持官方 Windows x64 桌面与本地 Host，一次选区限一个显示器，不支持长截图。输入框交付依赖 DSH 当前 paste/drop 行为。专用 Electron 辅助进程使用 `--no-sandbox`、context isolation 及禁止网络的本地页面 CSP；访问范围和取舍已在 README 公开。

请按 Windows 专用 beta 收录，安装入口优先展示 ZIP/明确安装器，避免套用未实测的通用 CLI 命令。

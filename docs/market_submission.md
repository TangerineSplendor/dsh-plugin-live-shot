# DSH Shot — 市场版本同步

版本：0.7.0-beta.5，Windows x64 公开 beta，MIT。此稿用于同步已收录的插件，不重复申请收录。GitHub/npm 实际发布状态由公开页面和注册表确认。

- 仓库：https://github.com/TangerineSplendor/dsh-screenshot
- Release：https://github.com/TangerineSplendor/dsh-screenshot/releases/tag/v0.7.0-beta.5
- npm：https://www.npmjs.com/package/dsh-plugin-live-shot/v/0.7.0-beta.5
- 已收录申请：https://github.com/2BingLing/dsh-market/issues/283
- topic：dsh-plugin；README 使用市场的已收录徽章。

## 简介与安装

Windows 实时桌面截图插件：全局热键、窗口识别、拖选、标注、可选隐藏 DSH，完成后图片直接插入对话输入框。初始框选由原生非激活窗口绘制自身 UI，松手后才抓原生分辨率选区，随后进入 Electron 编辑器。

下载 Release Windows ZIP，完整解压，运行 install.bat；保持已安装的官方 DSH 打开以便定位。安装后从托盘完整退出并重开。升级保留自定义热键及隐藏偏好。也可使用：

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.5 dsh-shot install
```

ZIP 无需额外 Node、管理员权限或额外下载运行时；从本机 DSH 准备运行时，不分发 DSH/Electron 二进制或个人配置。标准 bundle 声明为根 package.json 的 dsh.bundle 和 cordis.patch.yml。

## 本版变化与明确限制

- 本机反馈 B 站视频框选可见性恢复、游戏原生拖选可用；不宣称所有游戏已兼容。
- **游戏预框选 Esc 取消仍未解决，暂用右键。**新增的可选管理员游戏兼容入口为试验功能，需本人确认 Windows 提示，仅本次运行有效；完整插件实测仍未解决该问题，不可宣传为已修复。松手后编辑器 Esc 已获本机反馈正常。
- 编辑中移动/调整选区仍用 Electron，游戏焦点表现未完成验证；单显示器选区，不支持长截图。输入框交付依赖当前 DSH paste/drop 行为。
- 公开代码含 Windows CI、Host 状态/取消无采样、原生选框、Esc 辅助编译与非法 owner 拒绝，以及隔离安装/Client 协议检查。完整游戏交互不能仅用自动测试结果判定。

优先展示 Windows ZIP 与显式版本 npm 命令。请保留已有收录状态，后续展示以 DSH Market 自身刷新结果为准。

## 本次同步结果（2026-10-24）

GitHub v0.7.0-beta.5 已发布，Windows CI 通过；Release ZIP/TGZ 已重新下载并校验。npm 同版已发布，latest / beta 均指向 beta.5，正常下载地址已可用，TGZ 与 GitHub 附件字节一致。

DSH Market 现有收录仍有效，仓库 dsh-plugin topic 已核对保留，新版 README 与安装命令已公开供其下一轮定时采集。此次查询市场公开快照 generatedAt 为 2026-10-23T22:06:23.256Z，条目仍含 beta.4 的旧 README 缓存；不声称市场页面已显示 beta.5。市场的定时收录/部署由其维护者控制，详见该仓库 README 和 collect-and-deploy 工作流。

本次沿用既有 accepted 收录和仓库定时扫描来源，不重复申请收录。新版本在市场的展示以其完成刷新为准。

# dsh-plugin-live-shot — 市场版本同步

版本：0.7.0-beta.6，Windows x64 公开 beta，MIT。此稿用于名称迁移与同步已收录的插件，不重复申请收录。GitHub Release 与 npm 同版均已公开可下载；latest 已更新，beta 标签状态和市场条目以文末实查为准。

- 仓库：https://github.com/TangerineSplendor/dsh-plugin-live-shot
- Release：https://github.com/TangerineSplendor/dsh-plugin-live-shot/releases/tag/v0.7.0-beta.6
- npm：https://www.npmjs.com/package/dsh-plugin-live-shot/v/0.7.0-beta.6
- 已收录申请：https://github.com/2BingLing/dsh-market/issues/283
- topic：dsh-plugin；README 使用市场的已收录徽章。

## 名称迁移请求

- 旧市场 ID / fullName：TangerineSplendor/dsh-screenshot。
- 新市场 ID / fullName：TangerineSplendor/dsh-plugin-live-shot。
- 统一展示名：dsh-plugin-live-shot；npm 包名原本已为此名，继续保留 dsh-shot 命令简称。
- 这是同一个 GitHub 仓库的重命名（稳定仓库 ID 1431036200），请迁移旧条目并保留已有作者自述和收录状态，避免重复列出。
- 本次仅统一命名，不宣称修复游戏预框选 Esc，也不要求用户卸载或重置设置。

## 简介与安装

Windows 实时桌面截图插件：全局热键、窗口识别、拖选、标注、可选隐藏 DSH，完成后图片直接插入对话输入框。初始框选由原生非激活窗口绘制自身 UI，松手后才抓原生分辨率选区，随后进入 Electron 编辑器。

下载 Release Windows ZIP，完整解压，运行 install.bat；保持已安装的官方 DSH 打开以便定位。安装后从托盘完整退出并重开。升级保留自定义热键及隐藏偏好。也可使用：

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.6 dsh-shot install
```

ZIP 无需额外 Node、管理员权限或额外下载运行时；从本机 DSH 准备运行时，不分发 DSH/Electron 二进制或个人配置。标准 bundle 声明为根 package.json 的 dsh.bundle 和 cordis.patch.yml。

## 本版变化与明确限制

- 本版统一仓库、市场、npm、文档及插件显示名，ZIP 改用同名文件；截图行为沿用 beta.5。
- 本机反馈 B 站视频框选可见性恢复、游戏原生拖选可用；不宣称所有游戏已兼容。
- **游戏预框选 Esc 取消仍未解决，暂用右键。**新增的可选管理员游戏兼容入口为试验功能，需本人确认 Windows 提示，仅本次运行有效；完整插件实测仍未解决该问题，不可宣传为已修复。松手后编辑器 Esc 已获本机反馈正常。
- 编辑中移动/调整选区仍用 Electron，游戏焦点表现未完成验证；单显示器选区，不支持长截图。输入框交付依赖当前 DSH paste/drop 行为。
- 公开代码含 Windows CI、Host 状态/取消无采样、原生选框、Esc 辅助编译与非法 owner 拒绝，以及隔离安装/Client 协议检查。完整游戏交互不能仅用自动测试结果判定。

优先展示 Windows ZIP 与显式版本 npm 命令。请保留已有收录状态，后续展示以 DSH Market 自身刷新结果为准。

## 本次同步结果（2026-10-24）

GitHub v0.7.0-beta.5 已发布，Windows CI 通过；Release ZIP/TGZ 已重新下载并校验。npm 同版已发布，latest / beta 均指向 beta.5，正常下载地址已可用，TGZ 与 GitHub 附件字节一致。

DSH Market 现有收录仍有效，仓库 dsh-plugin topic 已核对保留，新版 README 与安装命令已公开供其下一轮定时采集。此次查询市场公开快照 generatedAt 为 2026-10-23T22:06:23.256Z，条目仍含 beta.4 的旧 README 缓存；不声称市场页面已显示 beta.5。市场的定时收录/部署由其维护者控制，详见该仓库 README 和 collect-and-deploy 工作流。

本次沿用既有 accepted 收录和仓库定时扫描来源，不重复申请收录。新版本在市场的展示以其完成刷新为准。

## 最新查询与待办（2026-10-25）

更名前公开市场数据 generatedAt 为 2026-10-24T22:38:33.47Z（北京时间 10 月 25 日 06:38），旧 ID 条目的 README 缓存和下载链接均已到 beta.5；npm latest / beta 也均为 beta.5。beta.6 在本地准备中，仓库 Rename、实际发版和市场迁移仍待核实。

随后核实：GitHub 仓库已更名且稳定 ID 不变，旧地址已重定向。公开提交 725a21e，v0.7.0-beta.6 的 Windows CI/Release 作业通过，4 个附件重新下载后均与 GitHub SHA-256 digest 匹配。npm 发布 CLI 已返回成功，后续注册表和标签结果见下方最终核对记录。

市场迁移 Issue 未创建：GitHub 连接器返回 403 Resource not accessible by integration。采集器从 repo.full_name/name 生成条目并支持改名去重；但旧名可能走 B2 缓存恢复（14 天真实核实间隔），不能保证下一轮就消除旧条目或迁移作者自述。新仓库仍靠 dsh-plugin topic 进入自动采集；已准备名称迁移稿供提交，实际显示以公开 plugins.json 为准。

最终可用性核对：npm /0.7.0-beta.6 已返回新仓库 URL，latest 为 beta.6，公开 TGZ 已重新下载，SHA-256 与 GitHub Release TGZ 相同。注册表 README 标题为 dsh-plugin-live-shot；在 F:/Codex（源码目录之外）执行公开 npm exec 的 dsh-shot --help 通过。源码目录内执行同名 package 的 npm exec 会被 npm 当作本地 package 而不拉取 bin，已通过换到普通工作目录消除该测试环境干扰。beta 标签切换命令已启动，正在等待用户完成 npm 独立验证。

市场最终查询快照仍为 generatedAt 2026-10-24T22:38:33.47Z，仅有旧名 dsh-screenshot，尚不能宣布市场名称已完成统一。

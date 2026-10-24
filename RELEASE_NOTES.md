# DSH Shot 0.7.0-beta.5

Windows 实时桌面截图测试版。此次发布同步目前本机版本；游戏预框选 Esc 问题仍未解决，暂用右键取消。

## Changes

- 初始框选改为 Windows 原生 layered 非激活窗口，保持真实桌面可见并接收鼠标；悬停识别窗口或自由拖选。预框选只传坐标，松手关闭选框后才抓原生分辨率的选区 PNG，再显示 Electron 编辑器。
- 保留 Electron 原生窗口透明度设置。本机反馈 B 站视频在选框期间恢复可见，游戏原生拖选可用；不保证所有游戏/显卡/环境均通过。
- 设置中增加可选「启用管理员游戏兼容」试验入口，只为活动选框提供独立 Esc 监听。需要本人确认 Windows 提示，退出辅助进程后失效；DSH 和像素抓取进程保持原权限。
- 继续提供相机按钮、自定义全局热键（默认 Ctrl+Shift+X，升级保留用户设置）、隐藏 DSH、标注/撤销/保存、Enter 插图及 Ctrl+C 仅复制。

## Known limitations

**游戏预框选 Esc 仍可能无效。完整插件中的管理员兼容桥接也未通过本机实测，不能作为已修复功能宣传；暂用右键退出。**独立管理员选框测试中 Esc 有效，但不能据此推断集成路径有效。

松手后的编辑器 Esc 已获本机反馈正常。游戏中再次移动/调整选区仍走 Electron，焦点表现未完成验证。仅 Windows x64 官方 DSH 桌面、本地 Host、单显示器选区；没有跨屏拼接或长截图。

## Install

下载本 Release 的 Windows ZIP，完整解压后运行 install.bat。无需卸载旧版；完成后从托盘完整退出 DSH 并重开。ZIP 安装无需额外 Node 或管理员权限。

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.5 dsh-shot install
```

## Restart checks

1. 相机和已保存的全局热键均能唤出；在视频上拖动，检查桌面仍可见，右键退出。
2. 框选松手后检查工具条；Enter 插入 DSH，Ctrl+C 仅复制，隐藏 DSH 后取消应恢复。
3. 在目标游戏中分别检查拖选、松手和取消；Esc 无效时用右键，并按已知问题反馈，不把试验兼容入口当成保证。

## Validation

包含 Host 状态/物理坐标/取消无采样测试、真实 PowerShell 选框启动与复用、Esc 辅助程序编译和非法 owner 拒绝测试、隔离安装及 Client 加载/插图协议检查。自动测试的各自边界不能替代真实游戏键鼠验收。发行包排除 DSH/Electron 二进制、个人配置、登录态和本机诊断文件。

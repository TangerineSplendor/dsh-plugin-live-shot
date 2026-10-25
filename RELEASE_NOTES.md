# dsh-plugin-live-shot 0.7.0-beta.6

统一公开名称的维护版本，截图行为沿用 beta.5。Windows 10/11 x64 官方 DeepSeek Harness 桌面版。

## Changes

- GitHub 仓库、DSH Market、npm、README、插件名称、编辑器标题和通知统一为 dsh-plugin-live-shot。
- Windows ZIP 命名为 dsh-plugin-live-shot-0.7.0-beta.6-windows-x64.zip，与 npm TGZ 使用同一插件名。
- 保留 dsh-shot 安装/卸载命令、Loader ID、接口与数据目录；升级不重置自定义热键、隐藏 DSH 偏好或已保存图片。
- GitHub 旧仓库链接由 GitHub 重定向；旧版安装命令继续可用。npm 包名仍为 dsh-plugin-live-shot。

## Install

完整解压 Windows ZIP，运行 install.bat。或使用已有 Node.js：

```powershell
npx --yes --package=dsh-plugin-live-shot@0.7.0-beta.6 dsh-shot install
```

安装后从托盘完整退出 DSH 并重开。无需先卸载旧版，不需要额外管理员权限。

## Known limitations

游戏预框选 Esc 仍可能无效，暂用右键退出；可选的管理员游戏兼容入口仍为试验，未解决完整插件路径的该问题。编辑中移动/调整选区仍走 Electron，游戏焦点行为尚待验证。单显示器选区，不支持长截图，不保证所有游戏或所有机器兼容。

## Restart checks

1. 重启后检查插件显示名为 dsh-plugin-live-shot，相机和原有全局热键都能唤出。
2. 框选、标注并按 Enter 插入；再试 Ctrl+C 只复制，以及右键取消。
3. 确认自定义热键和隐藏 DSH 偏好仍在；游戏预框选 Esc 无效时用右键退出。

## Validation

发布前运行现有 Host/Client 协议、选区设置、原生选框测试，检查 Windows PowerShell 5.1 语法与 ASCII 编码，构建 ZIP/TGZ 并核对安装身份。实际检查结果记录在交接文档，不把自动检查当作真实游戏兼容性保证。

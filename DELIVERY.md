# 剪贴板项目交付

长期分支：projects/clipboard。Windows、Linux 共用完整 src/ 源码；平台行为差异见 README.md。

## 当前完整运行包

2026-10-27 已同步 Windows 远端活动源码，包括 Win+V 接管、虚拟机前台放行、自带恢复守护、原光标粘贴和界面模式切换。两个既有平台包均已重新组装，沿用各自原有 Electron 运行时，包内完整源码与本分支一致。

| 平台 | 原始归档 | 字节数 | 顺序分块 |
| --- | --- | ---: | --- |
| Windows x64 | clipboard-windows-x64.zip | 158487999 | windows.part001 至 windows.part005 |
| Linux x64 | clipboard-linux-x64.tar.gz | 123347317 | linux.part001 至 linux.part004 |

完整检出后，Windows 运行 Start-Windows.cmd，Linux 运行 Start-Linux.sh。启动器会拼接、校验、解压分块；包内包含 Electron，不要求系统安装 Node。Linux 仍需正常桌面运行库。缓存 .runtime 已存在时启动器会复用它；如更新已有检出目录，应先退出旧程序并将旧缓存移出后再启动，以便使用当前分块。不要移动或删除用户数据目录。

## 校验与验证范围

clipboard-windows-x64.zip：
fd6abdc163a178cf98f34208d2e577cef62ed61532435e9fa7e158dcfe6d9cc2

clipboard-linux-x64.tar.gz：
ee1d1db83c41243a7d70cdc8306316e445540650ad0f9af0406e9215b7479b98

分块的大小、校验值及归档信息见 deliverables/manifest.json。重新组装后已检查完整源码一致性、归档可读性及分块还原完整性；两个运行包内的 src/ 已逐文件核对为当前分支源码。1.0.7 的 12 项源码测试通过，Windows 原生辅助程序编译与语法检查通过；实体快捷键仍须现场验证。

实际平台验收范围见 VALIDATION.md。19 项光标/模式检查来自指定 Windows 10 远端；本次归档组装不新增 Linux、Wayland、实体快捷键、重启或开关机验收结论。Linux 现场 GNOME、启动脚本和输入法配置快照保留在 handoff/，既有未完成事项仍有效。

运行包没有包含用户历史数据库、授权密钥、私密状态或原始调试日志。

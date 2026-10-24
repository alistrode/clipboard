# 剪贴板项目交付

项目长期分支：projects/clipboard。源码和 Windows x64 / Linux x64 运行包在同一分支维护。

## 完整源码

src/、scripts/、tests/、package.json、package-lock.json、MIT LICENSE、THIRD-PARTY.md 及相关文档。开发模式：安装 Node.js 24+，执行 npm ci 后双击 Start-Dev.cmd，或运行 ./start-dev.sh。构建入口 Build.cmd / npm run build。

## Windows 10 x64 包

仓库中 deliverables/windows.part001 至 windows.part006 为完整 ZIP 的顺序分块。原始包 clipboard-windows-x64.zip 为 175625832 字节，SHA-256：

7fdb320d80e193dabd915dda4385bf43b1b490a1fea1617804dbb21428ba62e4

完整下载并解压该分支后，双击根目录 Start-Windows.cmd。脚本自动拼接、校验、解压到当前目录 .runtime/，启动 Clipboard.exe；包含 Electron 运行时，不要求系统 Node 或 Python。后续启动直接复用已解压运行时。

Windows 包已完成官方 Windows x64 运行时组装、PE 格式及全部文件哈希核对；尚未 Windows 10 实机运行，不能视为通过 Win10 兼容性、自启、托盘及剪贴板通知验收。

## Linux x64 包

仓库中 deliverables/linux.part001 至 linux.part005 为完整 TAR.GZ 的顺序分块。原始包 clipboard-linux-x64.tar.gz 为 134978920 字节，SHA-256：

475e2c1c51967bc80d0784ecc81c8f720d3f5b4c460a1d8d87a12fd97ce5ca7f

完整下载并解压该分支后运行 ./Start-Linux.sh。脚本自动拼接、校验、解压并启动，包含 Electron，不要求系统 Node 或 Python；需要正常桌面所需系统库。受限云端验收时显式传入 --no-sandbox，仅用于该测试环境，不会全局更改系统沙箱设置。

已经从 GitHub 下载完整交付包，逐文件核对源码和两平台运行包，并在干净 Linux 目录实际执行一键启动。证据见 docs/ 和 VALIDATION.md；Linux 实机开关机、Wayland、Windows 实机不在已通过范围内。

## 包含与排除

运行包包含应用、运行时、必要库、资源及许可证；未包含用户数据库、凭据、原始运行日志、开发缓存和 node_modules。运行包以分块形式存储以符合 GitHub 单文件限制，启动脚本自动恢复，无须人工拼接或补丁。

2026-10-24 补充：GitHub Windows Server 2022 运行验收已通过，根目录启动器的 PowerShell 兼容问题已修复。记录及截图见 docs/WINDOWS-ACCEPTANCE.md；Windows 10 实机仍未验收。

1.0.1 快捷键修复：取消 Ctrl/Alt 强制条件，支持单键与 Shift、Win 等组合键录入。指定 Acer 电脑已更新，A、F8、Shift+F8、Win+Shift+F8、Escape 保存通过，真实 F8 唤出通过，历史记录与原快捷键偏好保留。证据见 docs/HOTKEY-1.0.1.md。

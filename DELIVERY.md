# 剪贴板项目交付

项目长期分支：projects/clipboard。源码和 Windows x64 / Linux x64 运行包在同一分支维护。

## 完整源码

src/、scripts/、tests/、package.json、package-lock.json、MIT LICENSE、THIRD-PARTY.md 及相关文档。开发模式：安装 Node.js 24+，执行 npm ci 后双击 Start-Dev.cmd，或运行 ./start-dev.sh。构建入口 Build.cmd / npm run build。

## Windows 10 x64 包

仓库中 deliverables/windows.part001 至 windows.part006 为完整 ZIP 的顺序分块。原始包 clipboard-windows-x64.zip 为 175623937 字节，SHA-256：

40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a

完整下载并解压该分支后，双击根目录 Start-Windows.cmd。脚本自动拼接、校验、解压到当前目录 .runtime/，启动 Clipboard.exe；包含 Electron 运行时，不要求系统 Node 或 Python。后续启动直接复用已解压运行时。

Windows 包已完成官方 Windows x64 运行时组装、PE 格式及全部文件哈希核对；尚未 Windows 10 实机运行，不能视为通过 Win10 兼容性、自启、托盘及剪贴板通知验收。

## Linux x64 包

仓库中 deliverables/linux.part001 至 linux.part005 为完整 TAR.GZ 的顺序分块。原始包 clipboard-linux-x64.tar.gz 为 134977093 字节，SHA-256：

fae726ba5a02e5af15d38adc578c08e01ca7b7b904f7518bda907a6f7ba83128

完整下载并解压该分支后运行 ./Start-Linux.sh。脚本自动拼接、校验、解压并启动，包含 Electron，不要求系统 Node 或 Python；需要正常桌面所需系统库。受限云端验收时显式传入 --no-sandbox，仅用于该测试环境，不会全局更改系统沙箱设置。

已经从 GitHub 下载完整交付包，逐文件核对源码和两平台运行包，并在干净 Linux 目录实际执行一键启动。证据见 docs/ 和 VALIDATION.md；Linux 实机开关机、Wayland、Windows 实机不在已通过范围内。

## 包含与排除

运行包包含应用、运行时、必要库、资源及许可证；未包含用户数据库、凭据、原始运行日志、开发缓存和 node_modules。运行包以分块形式存储以符合 GitHub 单文件限制，启动脚本自动恢复，无须人工拼接或补丁。

# GitHub Windows 运行验收

日期：2026-10-24。运行记录：https://github.com/trlstdin/rororororo/actions/runs/40079722838

测试提交：5c772373777b1f0279df81226849e9bed59edf83。

真实环境：GitHub-hosted windows-2022，Microsoft Windows Server 2022 Datacenter，10.0.20348，x64。这是 Windows Server，不是 Windows 10，也没有执行系统重启。

采用仓库内原 Windows 完整运行包，全部分块及完整 ZIP 的 SHA-256 均核对一致；原 ZIP SHA-256 为 40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a。应用二进制未被人工替换。

通过两项数据库自动测试，以及 24 项包完整性和桌面功能检查。功能包括：窗口启动、托盘对象创建、全局快捷键注册、首次注册开机自启、系统剪贴板读写、去重置顶、长文本不截断、界面搜索、左右滑动开关读回真实 Windows 自启状态、Win32 AddClipboardFormatListener 收到真实剪贴板变化、滚动锚点保存、后台新增不改变锚点、实际窗口截图、进程重启后恢复历史和界面状态。

验收中修复了根目录一键启动器的两处兼容问题：Windows PowerShell 5.1 误读无 BOM UTF-8 中文提示；runner 子进程中 Get-FileHash 不可用。最终启动器使用 ASCII 脚本与内置 .NET SHA-256、ZIP 解压，运行时不依赖额外 PowerShell 模块。

证据：windows-os.json、windows-acceptance-result.json、windows-running-popup.png、windows-running-manager.png。截图为 runner 中的真实应用窗口。

未验证：Windows 10 实机、真实开关机恢复、人工托盘点击或快捷键输入、实际鼠标拖动（开关通过指针事件驱动，同时核对系统真实自启状态）、设计稿像素级一致。托盘对象和快捷键注册通过不能替代完整用户桌面手动验收。

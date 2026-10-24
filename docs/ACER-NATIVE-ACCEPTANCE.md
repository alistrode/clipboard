# 指定 Acer 电脑实际运行验收

2026-10-24，用户指定电脑经 versions/1.0 对应的 Cloudflare SSH 方式连接。当前云端出口被隧道拒绝后，通过 GitHub runner 的网络出口登录；SSH 凭据使用 runner 临时 RSA 公钥进行 OAEP-SHA256 加密交接，不写入仓库或日志。

成功记录：https://github.com/trlstdin/rororororo/actions/runs/40084568295

实际系统 build 26200，属于 Windows 11；注册表保留 Windows 10 Home China 字样，连接包标题也写 Win10，不能因此记作 Windows 10 实机通过。

项目位置 E:\xxm\clipboard；采用已有可写 xxm 根目录，不覆盖已有项目。运行包位于 release\win10-40083184338\clipboard-windows-x64，该目录内 Start.cmd 可一键启动。应用是完整官方 Windows Electron 运行时加项目代码，不依赖电脑安装 Node 或 Python。

原始包经过 SFTP 传输并核对 SHA-256：40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a。后续验证复用这个已核验副本，日志中的缓存字节/0.01 秒不是实际网络下载速度。

19 项连接、完整性和桌面检查通过，包括实际账户及机器核验、可写工作区、包哈希、两个窗口可见、托盘对象及快捷键注册、默认自启、已登录桌面会话、去重、长文本、滑块关闭及开启真实 Windows 自启状态、搜索、滚动锚点保存及新增记录时保持位置、两张真实窗口截图、最终正常运行进程确认。

截图 acer-running-popup.png 和 acer-running-manager.png 来自该电脑的隔离验证窗口，展示合成测试记录，未上传用户真实剪贴板内容。随后退出验证实例，按正常采集模式启动应用。正常进程位于会话 1，PID 10048，窗口句柄 8061456；这些是验收时观测值，不是永久 PID。

仍未执行真实开关机；没有把 Windows 11 或 Windows Server 的成功冒称 Windows 10 实机验收。截图不是设计稿像素级一致证明。

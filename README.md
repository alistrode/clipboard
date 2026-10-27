# Clipboard Local

极简本地剪贴板。MIT 开源；纯文本，不做云同步。不设置历史条数、保留天数、单条字数限制；实际仍受磁盘、SQLite 和运行时字符串上限约束。

## 使用

- 默认 Ctrl+Shift+V：打开小窗口。Windows 小窗口默认不激活，保留原输入框的光标与选区；点击记录后在原输入处粘贴。点击搜索框时才接收键盘输入，点选记录后恢复原输入目标。原窗口或输入控件已改变时取消自动粘贴，并保留已复制内容。其他平台仍为点击复制。\n- 小窗口和管理界面都有“每次最新／停留上次”开关，支持点击、左右滑动和键盘操作，自动保存并同步。每次最新会在重开时清空搜索、显示顶部最新记录；停留上次会保留各自的搜索、选中项和滚动锚点。
- 托盘右键：打开剪贴板、管理、退出。关闭窗口隐藏到托盘。
- 管理窗口：搜索、选择删除、双击查看全文、右键操作。
- 开机自启：首次运行默认注册；自启后仅托盘运行。向右拖动开关开启，向左拖动关闭，立即写入系统设置，无保存按钮。失败恢复状态并显示原因。键盘左右方向键同样可操作。
- 快捷键字段：聚焦后按任意键或组合键，松开后自动保存，冲突时保留旧键。单个字母、F1–F24、Shift、Win 等按键录入不再要求 Ctrl/Alt；是否成功取决于系统真实注册结果。录入时暂时停用原快捷键，结束后恢复。
- 相同原文再次捕获只留一条并置顶；空格、换行不同视为不同。普通收集不会改动系统剪贴板。
- 记录仅在应用运行期间捕获。Windows 使用公开 AddClipboardFormatListener 通知，并用每 650ms 的读取兜底；Linux 使用公开接口每 650ms 检查文本。极快速连续复制仍可能漏过中间状态；不安装驱动，不修改系统组件。Wayland 能力受桌面环境限制。
- 历史 SQLite 存在 Electron 用户数据目录；每条独立事务，WAL + synchronous FULL。复制历史不会重复收录。搜索原文，长查询使用 FTS5 trigram，短查询支持中文子串。
- 列表虚拟化；窗口保存搜索、选中项、锚点记录及偏移，后台新增时保持当前浏览位置。

## 开发模式

Node.js 24+；`npm ci` 后运行 `npm run dev` 或 `Start-Dev.cmd` / `./start-dev.sh`。
已有 Electron 时可设置 `CLIPBOARD_ELECTRON` 为可执行文件绝对路径，避免重复下载。默认开发启动无需构建。

## 目录打包

`npm run build` 或 `Build.cmd`。`CLIPBOARD_RUNTIME` 可指定完整 Electron 44.8.0 运行时文件夹；`CLIPBOARD_TARGET=win32` 可用官方 Windows 运行时目录生成 Windows 包。目录复制，无转译或本地模块编译。

产物在相邻 release/ 下。Linux 双击/执行 start.sh；Windows 双击 Start.cmd。运行包包含 Electron，不需要系统 Node。Linux 仍依赖正常桌面所需 GTK/NSS/音频等系统库；本项目不把跨平台构建冒称 Windows 实机验收。

`--background` 仅托盘启动；`--show-manager` 同时打开管理；`--data-dir=/absolute/path` 可隔离数据库。`--test-mode` 仅供自动验收，启用带随机令牌的回环测试接口，正常运行不开启。不要在日常环境使用该模式。

测试：`npm test`。平台实际验收范围见 VALIDATION.md。

Windows 1.0.2：Win+V 由本程序用户态键盘服务接管，只处理 Win+V，退出本程序后释放。录入时单独按 Win/Ctrl/Alt/Shift 不会保存残缺的修饰键；完整 Win+V 可直接录入。

## Windows 与 Linux 的快捷键处理

| 平台 | 实际入口与行为 | 生效范围 |
| --- | --- | --- |
| Windows | src/clipboard-listener.ps1 使用 Windows 低级键盘钩子接管 Win+V，吞掉对应 V 事件并通知 src/main.cjs 打开小窗口；主进程负责就绪确认、心跳检查及键盘服务恢复。src/recovery.cjs 和 src/recovery-worker.cjs 为当前远端实际使用的自带进程恢复实现。 | 运行期间接管；退出后释放，不永久禁用系统快捷键。指定 VirtualBox 的 Ubuntu-24.04-Version-C 窗口在前台时放行到虚拟机，防止宿主机抢走组合键。 |
| Linux X11 | src/main.cjs 通过 Electron globalShortcut 注册应用快捷键，不加载或运行 Windows 钩子。已部署启动包装脚本和 GNOME 配置快照位于 handoff/linux-clipboard-ime-20261026/linux/。 | GNOME 系统组合键冲突由桌面配置处理，不能用 Windows 的拦截机制代替。快照中的 Super+V 是现场设置，干净配置仍使用默认 Ctrl+Shift+V。 |
| Linux Wayland | 由 Electron GlobalShortcutsPortal 与桌面门户提供的能力处理；不使用 Win32 接口。 | 是否允许注册、后台剪贴板访问取决于桌面及门户，未新增可靠性验收结论。 |

Windows 当前活动源码已经同步到本分支的 src/，不再仅保留在交接快照中。Linux 的现有现场脚本和配置快照继续保留原路径，属于该机器的部署资料，不会由启动器自动改写其他机器的 GNOME/IBus 设置。Linux 实体快捷键的未完成验收状态仍见交接说明。


Linux 快捷键与输入法的最新验收状态和防误判规则见 [Linux 验收交接](handoff/linux-clipboard-ime-20261026/linux/ACCEPTANCE.md)。

Windows 1.0.6：系统剪贴板读取由独立进程处理，读取延迟或超时不会阻塞主线程的快捷键与窗口事件；读取失败自动重试。Win+V 钩子只进行按键状态及缓存判断，VirtualBox 前台进程识别放在后台完成。原快捷键和历史数据库继续沿用。

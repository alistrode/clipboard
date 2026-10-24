# Clipboard Local

极简本地剪贴板。MIT 开源；纯文本，不做云同步。不设置历史条数、保留天数、单条字数限制；实际仍受磁盘、SQLite 和运行时字符串上限约束。

## 使用

- 默认 Ctrl+Shift+V：打开小窗口；点击记录复制；Esc 或失焦隐藏。
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

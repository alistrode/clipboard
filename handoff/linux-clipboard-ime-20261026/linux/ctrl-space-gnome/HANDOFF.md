# Ctrl+空格直接切换修正

2026-10-27（北京时间；目标机原始时间为 UTC）。用户明确反馈 Ctrl+空格仍未修好后继续处理。此修正用于 Ubuntu Version-C，不更新 Windows Win+V 的验收结论。

## 已观察

原 GNOME 自定义快捷键绑定旧 toggle-chinese-input；日志有今天的回调结果，但没有足够的实体事件关联，不能把这些记录认作实体链路通过。旧脚本直接设置全局 ibus engine。GNOME Shell 46 的正常 source.activate(true) 还负责桌面当前输入源、布局与 MRU；旧脚本绕过这一流程。读取 IBus 当前上下文的 GetEngine 曾超时，故不宣称已证明原应用输入上下文正常。

桌面外壳与终端具有 QT_IM_MODULE=ibus、XMODIFIERS=@im=ibus；原有 OpenBrowser/Chrome 和前台 v2rayN 未显示这组环境变量。环境变量缺失只是观察，不能单独证明应用未接入输入法。相关应用未被关闭或替换成专门测试输入框。

## 已实际部署

- 自有 GNOME 46 扩展 direct-input-toggle@local：用 Mutter 注册 Ctrl+空格，调用 GNOME 的输入源激活路径，直接在 libpinyin 与 xkb/us 间切换，不创建选择界面，不发出任何按键。
- 使用 IGNORE_AUTOREPEAT 抑制长按自动重复，并对 250ms 内重复回调去抖；未做实体长按验收。
- 解除旧自定义快捷键绑定；保留旧脚本及源码备份，不同时运行两条切换路径。
- 将 GTK 输入法配置为 ibus；写入 environment.d/60-ibus.conf，更新当前用户 systemd/DBus 的 IM 激活环境，im-config -n ibus 固定下一次会话选择。已有进程的环境不能因此被追溯修改，原应用的实际输入仍需验收。
- GNOME Shell 的用户服务设置了 RefuseManualStop，直接 systemctl restart 被拒绝；未修改该服务。实际通过用户服务管理器向该服务主进程发送 SIGTERM，依其现有 Restart=always 重新加载桌面外壳。未重启 X server 或整台虚拟机。

原备份：/home/versiona/xxm/beifen/chinese-input/ctrl-space-20261027T154906Z。含修改前源码 ZIP 和定向设置 JSON，均留在目标机，不含输入内容。安装源码位于 /home/versiona/xxm/chinese-input/dev/direct-toggle-gnome；加载目录为 ~/.local/share/gnome-shell/extensions/direct-input-toggle@local。

## 已完成的组件检查与未通过的验收

实际查询返回扩展 ACTIVE，GetExtensionErrors 为空；状态接口可读；旧自定义 binding 为空；当前 GNOME 源为 ibus:libpinyin，ibus engine 同为 libpinyin；GTK 与激活环境为 ibus；部署源码和加载源码逐字节相同。Shell 从 PID 2153 变为 14175，原 v2rayN/OpenBrowser/Chrome 的 PID 9275/9583/10515 仍存活。PID 仅用于这次事故记录，后续必须重新识别。

第一次检查回调计数为 0，没有调用任何直接切换方法来制造通过。GetStatus 仅提供回调次数、时间和输入源，不提供文字、窗口标题或用户输入；Mutter 回调不是实体事件来源鉴定。只读观察亦不构成实体验收。

**结论：修正已部署、组件检查通过；实体 Ctrl+空格切换和原应用实际中文/英文输入仍未验证，不能写“已修好”。** 也没有重登录、重启或跨应用稳定性验收。用户下一次实际使用后须以真实反馈和定向事件继续定位。

## 脚本

- deploy-direct-toggle.sh：目标机定向备份、编译 schema、安装并加载。内嵌的 tar 仅含旁边公开的扩展源码，不含身份或凭据。最终脚本用实际成功的 Shell 加载方式替代曾被拒绝的 restart；不要重复部署以充当验收。
- activate-direct-toggle.sh：本次实际成功的单独加载与存活检查。不是按键测试。
- verify-direct-toggle.sh、observe-toggle.sh：只读组件检查和限时观察，不发送按键、不读取文本。脚本的组件状态不得等同于实体输入成功。
- rollback-direct-toggle.sh：显式传入原备份目录，禁用扩展并恢复旧设置、旧脚本和原文件存在状态；只做了语法检查，没有实际回滚当前修正。DBus 不提供删除激活环境变量，故 GTK_IM_MODULE 恢复为空值；systemd 环境删除新增的 GTK_IM_MODULE。已启动程序保留其启动时环境，不宣称逐进程恢复。
- inspect-*.sh、check-shell-restart.sh：本次有实际观察结果的定向只读脚本；个别无返回的探测不属于通过证据。run-linux.py / relay-call.cjs 保留实际 Windows→Ubuntu 的受支持 MCP/SSH 命令链，引用外部私密状态和专用密钥路径，不含凭据值；其他环境先恢复合法的原身份和受支持连接入口。

没有上传用户剪贴板、普通输入、私钥、配对码、原始设备状态或运行日志。没有构造注入脚本或把只读状态冒充实体测试。

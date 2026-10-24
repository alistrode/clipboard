# 1.0.1 快捷键录入修复

删除软件对“必须包含 Ctrl 或 Alt”的限制。输入框接受单键、功能键、方向键、Escape、Tab 及 Shift / Ctrl / Alt / Win 组合；Win 保留为 Super，不再错误映射成 Ctrl。按键松开后保存。录入期间暂时停用本应用旧快捷键，避免旧组合抢走录入事件；失焦或隐藏窗口时恢复。系统或快捷键接口拒绝某个键时明确提示，保留原设置，不伪装成功。

自动测试：6 项通过，包含新键名转换及原数据库持久化测试。本地真实窗口完成 A、F8、Shift+F8、Win+Shift+F8、Escape、Ctrl+F 的录入保存检查。

完整 Windows 包运行：https://github.com/trlstdin/rororororo/actions/runs/40091443686 （Windows Server 2022）。

指定 Acer 电脑实际更新：https://github.com/trlstdin/rororororo/actions/runs/40091443746 。该电脑为 Windows 11 build 26200，不能记作 Windows 10 实机。

远端 11 项检查通过：应用源代码及数据备份后更新至 1.0.1；A、F8、Shift+F8、Super+Shift+F8、Escape 录入保存；真实 Windows F8 键成功唤出窗口；历史记录数量更新前后均为 1；原快捷键偏好保留；新版正常窗口继续运行。PID 16928，会话 1，窗口句柄 7671616 是验收时观测值。

历史数据未上传，只记录条数与成功状态。截图 hotkey-unrestricted-manager.png 来自独立验证窗口，F8 为测试值；最终正常实例读取原有历史和快捷键设置。修改前的应用源码备份路径在 hotkey-1.0.1-result.json，数据备份留在用户本机应用数据目录。

没有声称能够接收硬件/系统完全不上报的 Fn 键，也没有绕过系统保留键、安装驱动或修改系统组件。

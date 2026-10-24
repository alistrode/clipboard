# 1.0.2 Win+V

修复录入时把单独 Win 提前保存成 Super 的错误。录入等待主键；单独松开修饰键不会覆盖已保存组合。

Windows 的 Win+V 使用公开用户态 WH_KEYBOARD_LL 接口，仅在选择 Win+V 或录入该组合时接收该组合，避免系统剪贴板窗口抢走按键。没有驱动、内核修改或卸载系统剪贴板。其他快捷键继续使用 Electron 注册接口。设置在服务就绪后保存，错误保留原设置。

完整 Windows 包验收：https://github.com/trlstdin/rororororo/actions/runs/40096050904 。Windows Server 2022 实际 Win+V 唤出通过。

指定 Acer 实机验收：https://github.com/trlstdin/rororororo/actions/runs/40096050901 。这是 Windows 11 build 26200，不是 Windows 10 实机。10 项检查通过，包括原应用/数据备份、单独 Win 不覆盖组合、Win+V 无错误录入、连续两次实际 Win+V 唤出、偏好持久化、原历史记录 3 条保留和正常窗口继续运行。正常进程 PID 26168、会话 1、窗口句柄 57674418 为验收时观测值。

截图来自独立空白测试配置，不含原剪贴板内容。结束测试后已退出测试实例，以原配置启动正常实例，快捷键保存为 Super+V（界面显示 Win + V）。原始数据和备份留在用户机器，仓库只记录条数与验证状态。

# FCU Canary 单台下发结果

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 模式: blocked_before_canary_dispatch
- 设备: BGS01 办公室01
- 命令: setpoint
- 真实写入副作用: 无
- 结论: 未执行或未成功
- 生成时间: 2026-06-17T20:18:08.710Z

## 阻断项

- preflight_not_go: 上线前预检未通过：go_live_blocked
- field_arm_not_ready: 现场 arm-check 未通过：field_arm_blocked
- confirm_phrase_missing: 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE 才允许真实 BA 写入。


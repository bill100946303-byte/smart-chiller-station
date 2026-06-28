# FCU 逐台 Canary 队列

- 站点: 126lnoffice
- 模式: sequential_canary_queue
- 结论: 已生成逐台 Canary 队列
- 预检: NO-GO / go_live_blocked
- 控制写入副作用: 无
- 生成时间: 2026-06-20T04:31:49.871Z

## 汇总

- 队列设备: 2
- 首台 Canary: WSJ01
- 主命令 ready: 2
- 次命令 ready: 2
- 执行要求: 每台先执行主命令，反馈校验通过后才允许进入下一台；次命令在该台主命令反馈正常后执行。

## 当前 P0 阻断

- execution_gate_open: 全局投运闸门未打开：site_authorization_window_active / backend_not_readonly
- confirm_phrase_present: 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。

## 队列

| 顺序 | 设备 | 当前温度 | 当前设定 | 主命令 | 次命令 | 执行命令 |
|---:|---|---:|---:|---|---|---|
| 1 | 卫生间01 WSJ01 | 27.0°C | 26.0°C | setpoint=25.5 | fan_speed=auto | `FCU_CANARY_DEVICE_CODE=WSJ01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch` |
| 2 | 办公室01 BGS01 | 28.0°C | 24.0°C | setpoint=25.5 | fan_speed=auto | `FCU_CANARY_DEVICE_CODE=BGS01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch` |

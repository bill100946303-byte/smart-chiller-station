# FCU 投运门禁检查

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 不可进入真实下发
- verdict: environment_blocked
- 生成时间: 2026-06-17T18:54:49.965Z

## 汇总

- 总 FCU: 29
- 设备侧就绪: 21
- 单台阻断: 8
- 可真实下发: 0

## 阻断项

- P0 device_blocked: 8 台 FCU 存在单台通讯、温度、写点或反馈锁定阻断。
  - 设备: BGS03, BGS04, BGS06, GCBGQ03, QT02, WSJ02, ZHYS, ZZBGS
- P0 global_execution_gate: 全局投运闸门未打开：backend_not_readonly

## 下一步

- P0 处理单台质量阻断: 8台 FCU 通讯报警、温度无效、写点缺失或反馈锁定会阻断自动/手动确认下发。
- P0 打开全局投运闸门: 后端只读总闸 / 子系统写总闸 / BA适配器 backend_not_readonly

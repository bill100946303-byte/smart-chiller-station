# FCU 全量单台控制策略

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 已覆盖当前快照全部 FCU
- 控制写入副作用: 无
- 配置变更: 存在
- 生成时间: 2026-06-18T01:40:46.480Z

## 策略变化

- 原模式: enforced / 原白名单: 29 台
- 新模式: enforced / 新白名单: 29 台
- BA 写适配器: legacy-scene-command
- 全量设备: BGS01, BGS02, BGS03, BGS04, BGS05, BGS06, CWS, DHYS, DTT, GCBGQ01, GCBGQ02, GCBGQ03, JDS, LZBGS, QT01, QT02, QTS, SYS, TNFBQ01, TNFBQ02, WSJ01, WSJ02, XZBGS, YFBGQ01, YFBGQ02, YFBGQ03, YFBGQ04, ZHYS, ZZBGS

## 发现与投运状态

- 上游原始行: 29
- 重复折叠: 0
- 唯一 FCU: 29
- 设备侧就绪: 20
- 单台阻断: 9
- 环境阻断: 20
- 可真实下发: 0
- 全局真实下发: 未允许

## 保护参数

- 舒适区间: 24.5-26.5°C
- 设定范围: 22-28°C
- 设定步长: 0.5°C
- 设定保持: 15 min
- 启停保持: 30 min
- 反馈超时: 120 s
- 回退锁定: 60 min

## 下一步检查

- `npm --prefix apps/chiller-bff run check:fcu-device-control-matrix`
- `FCU_SMALL_BATCH_LIMIT=30 npm --prefix apps/chiller-bff run plan:fcu-small-batch-dispatch`
- `npm --prefix apps/chiller-bff run check:fcu-go-live-preflight`
- `npm --prefix apps/chiller-bff run build:fcu-final-control-runbook`

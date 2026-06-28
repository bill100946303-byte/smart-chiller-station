# FCU 小批量投运策略

- 站点: 126lnoffice
- 结论: 已配置小批量策略
- 控制写入副作用: 无
- 配置变更: 存在
- 生成时间: 2026-06-17T19:12:29.593Z

## 策略变化

- 原模式: enforced / 原白名单: 29 台
- 新模式: enforced / 新白名单: 2 台
- BA 写适配器: legacy-scene-command
- 首批设备: BGS01, LZBGS

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
- `npm --prefix apps/chiller-bff run plan:fcu-small-batch-dispatch`
- `npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch`

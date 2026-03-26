# release-ready-brief 值班展示卡 v1

用途：值班群快速播报“当前放行摘要”，用于先读结论、再做动作。  
命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief --json
```

## 固定读取字段（摘要口径）

- `decision / exitCode`
- `step.releaseReady.* / step.releaseReadyCheck.ok / step.releaseReadyLatest.ok`
- `latest.generatedAt / latest.decision / latest.reasons / latest.advisories`

## 值班约束（必须）

- `brief` 仅摘要，不替代 `release-ready-sync-check` 结论。
- 需要最终放行结论时，必须先确认 `release-ready-sync-check` 通过，再执行群播报。

## 使用边界

- 适用：班次内快速同步当前门禁摘要。
- 不适用：定位根因、替代重算、跳过 `sync/check` 直接判定 GO。

## 证据图（zh/en * dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-brief-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-brief-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-brief-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-brief-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`

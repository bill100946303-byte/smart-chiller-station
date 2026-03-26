# release-ready-sync-latest 值班卡 v1

用途：值班先读 `release-ready-sync` 联动执行结果，再确认最终发布结论摘要。  
适用页面：`/dashboard`、`/system-overview`（zh/en）。

## 两类 latest 的差异（必须区分）

- `release-ready-sync-latest.json`：联动步骤结果  
  含 `steps.releaseReady / steps.releaseReadyCheck / steps.releaseReadyLatest`，用于判断三步链路是否完整执行。
- `release-ready-latest.json`：发布结论结果  
  聚焦最终结论（`decision/reasons/advisories/checks`），用于对外播报放行结论。

一句话口径：前者看“流程有没有跑通”，后者看“结论是什么”。

## 值班固定读法（sync-latest）

1. 先读 `decision / exitCode`（总结果）
2. 再读 `steps.*`（链路步骤状态）
3. 最后读 `releaseReadyLatest` 摘要（最终结论映射）

建议命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --json
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest --json
```

## 页面高亮说明

- 红框：`decision / exitCode` 读取位
- 黄框：`steps` 读取位（联动步骤态）
- 青框：`releaseReadyLatest` 摘要读取位

## 证据图（zh/en + dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-latest-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-latest-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-latest-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-latest-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`

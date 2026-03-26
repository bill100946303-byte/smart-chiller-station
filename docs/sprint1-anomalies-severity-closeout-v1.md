# Sprint1 告警 Severity Closeout v1

本次只回答一个问题：告警线“对外 severity 收口”是否完成。

## 1. 本次复核范围

仅复核会直接影响告警页演示和告警接口合同的链路：

- `apps/chiller-bff/src/adapters/legacyAlarmAdapter.js`
- `apps/chiller-bff/src/services/anomalyService.js`
- `apps/chiller-shell-v1/src/services/bffClient.ts`
- `apps/chiller-shell-v1/src/pages/AlarmPage.tsx`
- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/openapi/examples/anomalies-summary.json`

不计入本次 closeout 的项：

- `dashboard/overview` 的 `alarmSummary.high|medium|low`
- 首页 `RealtimeStatusGrid`
- recommendation 的 `risk/priority`

原因：

- 这些不属于“告警页/告警接口”对外 severity 合同本身。

## 2. 复核结果

当前告警线对外输出已统一为 `critical|major|minor|normal`：

- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js#L12) 的 `anomalies/summary.counts` 已是 `critical/major/minor/normal`
- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L13) 虽仍兼容旧上游 `high|medium|low`，但已在内部归一为四档，不再对外吐旧值
- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L92) 的 `AnomalySummaryDto` 与 [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L106) 的 `AnomalyListDto` 已收口到四档
- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L64) 的摘要卡、recent feed、列表和筛选均已使用四档
- [bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml#L629) 的 `AnomaliesSummaryResponse`、[bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml#L651) 的 `AnomaliesListResponse` 已使用四档
- [anomalies-summary.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/anomalies-summary.json) 当前 example 也已切到四档

结论：`severity 收口完成`

对外残留数：`0`  
是否完成收口（yes/no）：`yes`  
是否阻断告警页演示（yes/no）：`no`

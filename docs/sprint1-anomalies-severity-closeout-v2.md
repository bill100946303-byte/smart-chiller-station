# Sprint1 告警 Severity Closeout v2

本次封账只判断“告警页 / 告警接口 / 告警合同”这条线是否可以签收，不再扩展到 dashboard 兼容链路或 risk 文案。

复核范围：

- `apps/chiller-bff/src/services/anomalyService.js`
- `apps/chiller-bff/src/adapters/legacyAlarmAdapter.js`
- `apps/chiller-shell-v1/src/services/bffClient.ts` 中 `AnomalySummaryDto` / `AnomalyListDto`
- `apps/chiller-shell-v1/src/pages/AlarmPage.tsx`
- `apps/chiller-bff/openapi/bff-v1.yaml` 中 `AnomaliesSummaryResponse` / `AnomaliesListResponse`
- `apps/chiller-bff/openapi/examples/anomalies-summary.json`

复核结论：

- 告警接口对外枚举已统一为 `critical|major|minor|normal`
- 告警页摘要、recent feed、列表、筛选已统一为 `critical|major|minor|normal`
- 告警合同与 example 当前未再向外暴露 `high|medium|low`

说明：

- 当前仍保留的旧三档只出现在 `dashboard overview` 兼容层和 recommendation risk 语义，均不属于本次“告警线对外 severity”封账范围

对外残留数：`0`  
是否完成收口（yes/no）：`yes`  
是否阻断告警页演示（yes/no）：`no`

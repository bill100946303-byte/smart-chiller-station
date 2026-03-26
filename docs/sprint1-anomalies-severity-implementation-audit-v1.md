# Sprint1 告警 Severity 收口落地校验 v1

## 1. 结论

本轮结论：`severity` 收口**尚未完成**。

规范层已经拍板为：

- 统一对外枚举：`critical|major|minor|normal`
- 不允许 dual enum：`no`
- `high|medium|low` 只允许作为 BFF 内部过渡输入，不允许继续作为对外合同输出

但当前实现层仍存在 13 处 `high|medium|low` 残留，覆盖 BFF 输出、前端 DTO、前端展示和 openapi example 四个面。

## 2. 审计范围

- 规范基线：[sprint1-anomalies-severity-final-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-final-v1.md)
- BFF 源码：[legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L13)、[anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js#L15)、[dashboardService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/dashboardService.js#L23)
- Shell 源码：[bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L49)、[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L63)、[RealtimeStatusGrid.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/dashboard/RealtimeStatusGrid.tsx#L18)、[zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L147)
- 联调/样例文档：[sprint1-anomalies-list-regression-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-regression-v1.md)、[anomalies-summary.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/anomalies-summary.json)

## 3. 校验结果

### 3.1 BFF 输出枚举

未一致。

- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L13) 仍把旧源归一为 `high|medium|low`，且 [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L76) 仍按旧三档切 summary。
- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js#L15) 对外 `counts` 仍输出 `high/medium/low` 键。
- [dashboardService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/dashboardService.js#L23) 首页 `alarmSummary` 仍输出 `high/medium/low`。

判断：

- 当前 BFF 对外合同还没有收口到最终四档。
- 这是首要阻断项。

### 3.2 前端 DTO 枚举

未一致。

- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L49) 的 `DashboardOverviewDto.alarmSummary` 仍是 `high|medium|low`。
- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L92) 的 `AnomalySummaryDto` 与 recent feed `severity` 仍是旧枚举。
- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L114) 的 `AnomalyListItemDto.severity` 仍是旧枚举。

判断：

- 前端合同层仍在放大旧枚举，不只是展示没改完。

### 3.3 前端展示文案

未一致。

- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L63) 顶部摘要卡仍取 `counts.high/medium/low`。
- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L92) 的 `severityText`、`severityTone` 和筛选项仍是 `high|medium|low`。
- [RealtimeStatusGrid.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/dashboard/RealtimeStatusGrid.tsx#L18) 首页状态说明仍按“高等级/中等级/低等级”展示。
- [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L147) 与 [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L226) 的三语标签仍保留旧三档。

判断：

- 当前不是“逻辑统一但展示没改完”，而是逻辑层和展示层都还没完全切换。

### 3.4 文档 Example 残留

有一处需要处理，一处可排除。

- [anomalies-summary.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/anomalies-summary.json#L8) 仍使用 `high|medium|low`，这会直接误导联调和抄样例实现，算残留。
- [sprint1-anomalies-list-regression-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-regression-v1.md) 当前未残留旧枚举样例。
- [sprint1-anomalies-severity-final-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-final-v1.md#L26) 虽然多次提到 `high|medium|low`，但这里是在说明旧口径问题，不计入残留数。

## 4. 不计入本次残留的项

以下命中 `high|medium|low`，但语义不是“告警 severity”，不计入本次收口残留：

- recommendation 的 `priority` / `risk`
- 风险文案 copybook 中的 `high|medium|low`

原因：

- 这些字段属于规则风险语义，不属于本轮告警 severity 收口范围。

## 5. 收口顺序建议

1. 先改 BFF 输出：把 adapter/service/dashboard 三层全部收口到 `critical|major|minor|normal`。
2. 再改前端 DTO：确保 `alarmSummary`、`recent feed`、`anomalies/list` 同步切换到四档。
3. 再改页面和 i18n：`AlarmPage`、`RealtimeStatusGrid`、三语标签一次性替换。
4. 最后清样例：把 `openapi/examples/anomalies-summary.json` 改到新口径，避免二次回流。

## 6. 统计

- 残留 `high|medium|low` 数量：`13`
- blocking 项数量：`12`
- warning 项数量：`1`
- 是否已经可以宣布“severity 收口完成”：`no`

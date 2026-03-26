# Sprint1 告警 Severity 收口最终审计 v2

## 1. 结论

按当前仓库最新实现复核后，`anomalies/summary` 与 `anomalies/list` 已经收口到 `critical|major|minor|normal`，但**对外 severity 收口仍未完成**。

这次统计采用“制品级残留”口径：

- 统计单位是“仍会被实现、合同、样例或文档直接消费的一条残留链路”
- 不是全文字符串命中数
- 历史审计/说明性引用不计入残留

本轮结果：

- 残留总数：`22`
- 对外残留数：`20`
- 允许保留的兼容映射：`2`
- 当前是否已完成“对外 severity 收口”：`no`

## 2. 判定边界

### 2.1 允许保留

允许保留的 `high|medium|low` 仅限“只吸收旧值、不再向外吐旧值”的兼容层：

1. [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L13)
   旧上游输入 `high|medium|low` 被归一到 `critical|major|minor|normal`，这是 BFF 内部兼容。
2. [hvacCopybook.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/hvacCopybook.ts#L244)
   前端展示 helper 仍能把旧值安全本地化，这是 UI 兜底兼容。

### 2.2 必须清除

以下一律算“对外残留”，必须清掉：

- BFF 对外输出还在返回 `high|medium|low`
- 前端 DTO 还在定义 `high|medium|low`
- 前端展示仍把旧三档直接展示给用户
- OpenAPI schema / example 仍把旧三档当正式合同
- docs 中仍把旧三档写成当前可用口径

特别说明：

- `dashboard/overview` 虽然看起来像“内部兼容链路”，但它已经是 BFF 对外接口，被 shell 和文档直接消费，所以**不属于允许保留的内部兼容**。

## 3. 分类统计

| 类别 | 允许保留 | 必须清除 | 小计 |
| --- | --- | --- | --- |
| BFF 对外输出残留 | 0 | 1 | 1 |
| BFF 内部兼容映射残留 | 1 | 0 | 1 |
| 前端 DTO 残留 | 0 | 1 | 1 |
| 前端展示残留 | 1 | 3 | 4 |
| OpenAPI/example 残留 | 0 | 3 | 3 |
| 文档残留 | 0 | 12 | 12 |
| 合计 | 2 | 20 | 22 |

## 4. 当前已经完成的部分

这轮与 v1 最大的进展是：

- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js#L13) 已把旧输入归一到 `critical|major|minor|normal`
- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js#L12) 的 `anomalies/summary` 已输出 `counts.critical/major/minor/normal`
- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L64) 已把告警页主展示和筛选切到四档
- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L78) 的 `AnomalySummaryDto` / `AnomalyListItemDto` 已切到四档

也就是说：

- 告警页主链路基本收口了
- 问题主要剩在 dashboard overview 兼容链路、首页展示链路、OpenAPI/example 和旧文档包

## 5. 必须清除的对外残留

### 5.1 BFF 对外输出

- [dashboardService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/dashboardService.js#L23)
  仍把 `critical|major|minor` 映射成 `alarmSummary.high|medium|low` 后返回给 `/dashboard/overview`。

判断：

- 这是当前最核心的代码级对外残留。

### 5.2 前端 DTO

- [bffClient.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/services/bffClient.ts#L47)
  `DashboardOverviewDto.alarmSummary` 仍是 `total/high/medium/low`。

判断：

- 即使 runtime 已改，前端 build-time contract 也还没完成收口。

### 5.3 前端展示

- [RealtimeStatusGrid.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/dashboard/RealtimeStatusGrid.tsx#L18)
  首页实时状态仍直接展示 `high/medium/low`。
- [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L147)
  首页实时状态 copy 仍是“高等级/中等级/低等级”。
- [DashboardPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/DashboardPage.tsx#L207)
  首页异常预览空态仍会给出 `zhCN.severity.low`。

判断：

- 首页展示链路没有跟着告警页一起完全切换。

### 5.4 OpenAPI / Example

- [bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml#L481)
  `AlarmCounts` 仍定义为 `total/high/medium/low`。
- [dashboard-overview.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/dashboard-overview.json#L25)
  `alarmSummary` example 仍是旧三档。
- [anomalies-summary.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/anomalies-summary.json#L8)
  `counts` 与 `latestEvents[].severity` example 仍是旧三档。

判断：

- `anomalies/summary` 的实现已经新口径，但 contract/example 还在反向污染实现认知。

### 5.5 文档

仍会误导 FE/BFF/主控继续沿用旧三档的活跃文档共 `12` 份，集中在：

- 页面迁移 / Sprint1 readiness 文档
- 告警页 data pack / contract pack / HVAC pack
- copy 语义核对文档

代表文件：

- [page-migration-data-readiness-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/page-migration-data-readiness-v1.md#L20)
- [sprint1-trend-alarm-data-ready-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-alarm-data-ready-v1.md#L73)
- [sprint1-alarm-page-data-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-alarm-page-data-pack-v1.md#L41)
- [sprint1-anomalies-list-contract-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-contract-v1.md#L68)
- [sprint1-alarm-page-contract-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-alarm-page-contract-pack-v1.md#L67)
- [sprint1-alarm-page-hvac-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-alarm-page-hvac-pack-v1.md#L37)
- [copy-data-semantics-check-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/copy-data-semantics-check-v1.md#L16)

## 6. 本次不计入残留的项

以下虽然命中 `high|medium|low`，但不计入本次残留统计：

- [sprint1-anomalies-severity-final-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-final-v1.md)
  这是规范文档，提旧枚举是为了说明迁移边界。
- [sprint1-anomalies-severity-implementation-audit-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-implementation-audit-v1.md)
  这是历史审计结果，不是当前合同。
- `recommendation risk/priority` 的 `high|medium|low`
  这是规则风险语义，不是告警 severity 语义。
- `zhCN.severity.high/medium/low` 作为风险文案键位本身
  只要不再被告警展示链路直接消费，就不算本轮对外残留。

## 7. 收口判断

当前判断：

- `anomalies/summary` / `anomalies/list`：收口基本完成
- `dashboard/overview`：未完成
- 首页展示：未完成
- OpenAPI/example：未完成
- docs：未完成

最终结论：

- 残留总数：`22`
- 对外残留数：`20`
- 是否已完成收口：`no`

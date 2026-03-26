# 验收报告字段与 Readiness 基线对齐审计 v1.0

## 1. 审计范围与方法
- 验收输入：`docs/v19.2-acceptance-report.json`
- 基线输入：`docs/non-degraded-readiness-checklist-v1.3.csv`、`docs/readiness-baseline-freeze-v1.8.md`
- 边界：仅做字段/落点对齐审计，不改字段定义、不改 `null_strategy`、不改代码。

对齐口径说明：
- “完全对齐”：验收报告中存在可直接对应的基线判定字段（或同语义聚合字段）。
- “报告独有（基线缺解释）”：验收报告有值，但基线文档未给出该字段的解释或门禁位置。
- “基线独有（报告缺落点）”：基线有明确字段/门禁，但验收报告没有对应的显式字段落点。

## 2. 三列表结果

### 2.1 完全对齐（2）
1. `readiness.nonDegradedReady`  
对应基线：`non-degraded-readiness-checklist-v1.3.csv` 的整体非降级结论（聚合态）。
2. `readiness.ndFailedCount`  
对应基线：readiness blocking 失败数量（聚合态计数）。

### 2.2 报告独有（基线缺解释）（8）
1. `version` / `generatedAt` / `siteId`（报告元信息）
2. `entry.mode` / `entry.port3001Ok`（入口运行态元信息）
3. `contract.ok`（合同通过状态）
4. `stack.ok` / `stack.legacyHealthStatus` / `stack.bffHealthStatus` / `stack.frontendStatus`（栈健康态）
5. `probe.ok` / `probe.file`（探针执行状态与文件路径）
6. `badge.globalPass` / `badge.path`（徽章状态）
7. `endpoints.*.status` / `endpoints.*.overall` / `endpoints.*.ok`（四类接口摘要）
8. `overallPass`（全局通过位）

说明：这些字段在验收报告中有效，但在 readiness 基线文档内未形成逐项“字段级门禁解释”。

### 2.3 基线独有（报告缺落点）（12）
以下条目均来自 `non-degraded-readiness-checklist-v1.3.csv`，但在验收报告缺少逐项显式落点（仅被聚合为 `readiness.nonDegradedReady/ndFailedCount`）：

1. `NDC-001` `station_total_power_kw` `overview.energyCards.totalPowerKw` 数值门禁
2. `NDC-002` `chilled_delta_t_c` `overview.energyCards.chilledDeltaT` 数值门禁
3. `NDC-003` `cooling_delta_t_c` `overview.energyCards.coolingDeltaT` 数值门禁
4. `NDC-004` `cooling_delta_t_c` `trends.series[metric=coolingDeltaT].points[*].v` 趋势门禁
5. `NDC-005` `station_total_power_kw` 单位一致性门禁
6. `NDC-006` `chilled_delta_t_c` 单位一致性门禁
7. `NDC-007` `cooling_delta_t_c` 单位一致性门禁
8. `NDC-008` `station_cop` 单位一致性门禁
9. `NDC-009` `station_total_power_kw` 跨站比较约束门禁
10. `NDC-010` `chilled_delta_t_c` 跨站比较约束门禁
11. `NDC-011` `cooling_delta_t_c` 跨站比较约束门禁
12. `NDC-012` `core_4_metrics` 三语完整性门禁

## 3. Core4 专项对齐

### 3.1 `station_total_power_kw`
- 基线要求：`NDC-001`（值门禁）+ `NDC-005`（单位）+ `NDC-009`（跨站约束）
- 验收落点：无字段级显式落点（仅体现为 `readiness.nonDegradedReady=true` 的聚合结果）
- 结论：基线有、报告缺落点

### 3.2 `chilled_delta_t_c`
- 基线要求：`NDC-002`（值门禁）+ `NDC-006`（单位）+ `NDC-010`（跨站约束）
- 验收落点：无字段级显式落点（仅聚合态体现）
- 结论：基线有、报告缺落点

### 3.3 `cooling_delta_t_c`
- 基线要求：`NDC-003`（overview 值）+ `NDC-004`（trends 值）+ `NDC-007`（单位）+ `NDC-011`（跨站约束）
- 验收落点：无字段级显式落点（仅聚合态体现）
- 结论：基线有、报告缺落点

### 3.4 `station_cop`
- 基线要求：`NDC-008`（单位一致性）及 `v1.8 freeze` 中 core4 证据路径约束
- 验收落点：无 `station_cop` 字段级值或 sourceStatus 分类显式落点
- 结论：基线有、报告缺落点

## 4. 审计结论（v1.0）
- 当前验收报告可表达“聚合通过”，但对 core4 与 warning-open 的“字段级可追溯性”不足。
- 该问题属于可观测性与审计完备性缺口，不直接推翻 `v1.8` 当前放行结论。
- 建议后续在验收报告补充 `core4` 字段级落点（值/单位/compare guard/sourceStatus 关键证据路径），以消除“基线有定义、验收无落点”。

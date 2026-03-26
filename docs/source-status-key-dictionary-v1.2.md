# SourceStatus 中文映射字典 v1.2（短标签优先级）

目标：在 v1.1 收敛规则不变的前提下，仅增强标签层，支持前端折叠态/展开态双层展示。  
约束：不改字段定义，不改 `null_strategy`，不改 key 收敛关系。

## 1. 使用策略（先看）

- 折叠态：优先使用 `shortLabel`（<=6 汉字，移动端优先）。
- 展开态：优先使用 `fullLabel`（完整语义，便于排障）。
- 若命中别名 key，先归并到主 key，再取标签。

## 2. 双层标签映射（主 key）

| 主 key | shortLabel（<=6汉字） | fullLabel（完整语义） |
| --- | --- | --- |
| `energy` | `能耗总览` | `能耗总览来源` |
| `runParams` | `运行参数` | `运行参数趋势来源` |
| `latestAlarmLog` | `最新告警` | `最新告警日志来源` |
| `subsystemSummary` | `子系统` | `子系统概览来源` |
| `ruleMetrics` | `规则聚合` | `规则指标聚合来源` |
| `metric.chilled_delta_t_c` | `冷冻温差` | `规则指标：冷冻水温差` |
| `metric.cooling_delta_t_c` | `冷却温差` | `规则指标：冷却水温差` |
| `metric.station_cop` | `冷站COP` | `规则指标：冷站COP` |
| `metric.station_total_power_kw` | `总站功率` | `规则指标：冷站实时总功率` |
| `energyCurve` | `能耗趋势` | `能耗趋势来源` |
| `devices` | `设备清单` | `设备清单来源` |
| `alarms` | `告警摘要` | `告警摘要来源` |
| `rules` | `规则配置` | `规则配置来源` |
| `dashboardOverview` | `总览聚合` | `总览聚合内部来源` |
| `anomalySummary` | `异常聚合` | `异常聚合内部来源` |

兼容别名（保持 v1.1 不变）：

- `subsystemInfo` -> `subsystemSummary`

## 3. `metric.<snake_case>` 标签生成规则

匹配：

- 正则：`^metric\\.([a-z0-9_]+)$`

生成规则：

- `shortLabel`：优先取 `fieldShortCnMap[field]`；无命中则用 `规则指标`。
- `fullLabel`：优先取 `规则指标：{fieldCnMap[field]}`；无命中则用 `规则指标：{snake_case}`。

示例：

- `metric.chilled_delta_t_c` -> `short=冷冻温差`，`full=规则指标：冷冻水温差`
- `metric.unknown_index_x` -> `short=规则指标`，`full=规则指标：unknown_index_x`

未收录 metric 兜底：

- `shortLabel`：`规则指标`
- `fullLabel`：`规则指标：{snake_case}`
- 风险提示：`未收录 metric 禁止直接用于业务结论。`

## 4. 多语言建议（简版，10个高频 key）

说明：中文为主口径，英文/越南文用于国际化 UI 对照，不改变 key 语义。

| key | zh short | zh full | en short | en full | vi short | vi full |
| --- | --- | --- | --- | --- | --- | --- |
| `energy` | 能耗总览 | 能耗总览来源 | Energy | Energy Overview Source | Năng lượng | Nguồn tổng quan năng lượng |
| `runParams` | 运行参数 | 运行参数趋势来源 | Params | Runtime Parameter Trend Source | Tham số | Nguồn xu hướng tham số vận hành |
| `latestAlarmLog` | 最新告警 | 最新告警日志来源 | Alarms | Latest Alarm Log Source | Báo động | Nguồn nhật ký báo động mới nhất |
| `subsystemSummary` | 子系统 | 子系统概览来源 | Subsys | Subsystem Summary Source | Phân hệ | Nguồn tổng quan phân hệ |
| `ruleMetrics` | 规则聚合 | 规则指标聚合来源 | Rule Agg | Rule Metrics Aggregation Source | Tổng hợp luật | Nguồn tổng hợp chỉ số luật |
| `metric.chilled_delta_t_c` | 冷冻温差 | 规则指标：冷冻水温差 | CHW dT | Rule Metric: Chilled Water Delta-T | DeltaT lạnh | Chỉ số luật: chênh nhiệt nước lạnh |
| `metric.cooling_delta_t_c` | 冷却温差 | 规则指标：冷却水温差 | CW dT | Rule Metric: Cooling Water Delta-T | DeltaT giải nhiệt | Chỉ số luật: chênh nhiệt nước giải nhiệt |
| `metric.station_cop` | 冷站COP | 规则指标：冷站COP | COP | Rule Metric: Station COP | COP trạm | Chỉ số luật: COP trạm lạnh |
| `metric.station_total_power_kw` | 总站功率 | 规则指标：冷站实时总功率 | Power | Rule Metric: Station Total Power | Công suất trạm | Chỉ số luật: tổng công suất trạm lạnh |
| `alarms` | 告警摘要 | 告警摘要来源 | Alarm Sum | Alarm Summary Source | Tổng báo động | Nguồn tóm tắt báo động |

## 5. 输出摘要策略（前端建议）

- 折叠态（列表/卡片头）：`shortLabel + 状态短句`  
  示例：`能耗总览 · 正常`、`冷站COP · 字段缺失或无效`
- 展开态（详情/抽屉）：`fullLabel + endpoint + failHint`  
  示例：`规则指标：冷站COP` + 来源接口 + `冷站COP指标不可用...`

## 6. 与 v1.1 差异说明

新增：

- 明确“折叠态用 shortLabel / 展开态用 fullLabel”的显示优先级策略。
- 增补 `metric.*` 的 short/full 双模板与未收录兜底规则。
- 增补 10 个高频 key 的中英越 short/full 对照表。

不变：

- key 收敛规则不变（主 key / 别名关系保持 v1.1）。
- 状态分类规则、摘要公式、warn/good 判定保持 v1.1。
- 字段定义与 `null_strategy` 不变。


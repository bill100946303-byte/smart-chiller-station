# SourceStatus 中文映射字典 v1.1（收敛版）

目标：在 v1 基础上收敛 key 语义与展示口径，提供前端折叠态高信噪比短标签。  
约束：仅文档/字典；不改字段定义，不改 `null_strategy`。

## 1. 收敛原则

- 单 key 单语义：同义 key 必须归并为“主 key + 兼容别名”。
- 双标签制：每个 key 必须有“短标签（<=6字）+ 完整标签”。
- 判定先统一后展示：先按状态分类规则归类，再映射提示短句。
- 口径透明：技术中间 key 不直接业务化解释。

## 2. Key 收敛表（主 key / 别名 / 标签 / 优先级）

说明：优先级数字越小，折叠态越靠前。

| 主 key | 兼容别名 | 短标签（<=6字） | 完整标签 | 优先级 | 来源接口 | 语义说明（1句） | 失败时推荐主提示 |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| `energy` | - | `能耗总览` | `能耗总览来源` | 10 | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 首页能耗卡片与核心实时量上游来源。 | `能耗总览源不可达，请检查站点能耗接口。` |
| `runParams` | - | `运行参数` | `运行参数趋势来源` | 20 | `/zsqy/homepage/{siteId}/getRunParamsCurve` | 温差等运行参数趋势来源。 | `运行参数趋势源不可达，请检查参数曲线接口。` |
| `latestAlarmLog` | - | `最新告警` | `最新告警日志来源` | 30 | `/zsqy/qsAlarmlog/{siteId}/findNewAlarmLog` | 最新告警事件明细来源。 | `最新告警日志不可达，请检查告警日志接口。` |
| `subsystemSummary` | `subsystemInfo` | `子系统` | `子系统概览来源` | 40 | `/{siteId}/getAllSubsystemInfo` | 子系统在线/离线与告警汇总来源。 | `子系统概览不可达，请检查子系统汇总接口。` |
| `ruleMetrics` | - | `规则聚合` | `规则指标聚合来源` | 50 | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve + getEnergyStatisticsCurve + getRunParamsCurve` | 规则前置聚合输入来源。 | `规则指标聚合源不可达，建议诊断可能降级。` |
| `metric.chilled_delta_t_c` | - | `冷冻温差` | `规则指标：冷冻水温差` | 60 | 同 `energy`（运行时 endpoint 优先） | 规则评估所需冷冻水温差可用性。 | `冷冻水温差指标不可用，请检查温差点位或上游链路。` |
| `metric.cooling_delta_t_c` | - | `冷却温差` | `规则指标：冷却水温差` | 70 | 同 `energy`（运行时 endpoint 优先） | 规则评估所需冷却水温差可用性。 | `冷却水温差指标不可用，请检查温差点位或上游链路。` |
| `metric.station_cop` | - | `冷站COP` | `规则指标：冷站COP` | 80 | 同 `energy`（运行时 endpoint 优先） | 规则评估所需 COP 可用性。 | `冷站COP指标不可用，请检查COP字段或上游链路。` |
| `metric.station_total_power_kw` | - | `总站功率` | `规则指标：冷站实时总功率` | 90 | 同 `energy`（运行时 endpoint 优先） | 规则评估所需总功率可用性。 | `冷站总功率指标不可用，请检查总功率字段或上游链路。` |
| `energyCurve` | - | `能耗趋势` | `能耗趋势来源` | 100 | `/zsqy/homepage/{siteId}/getEnergyStatisticsCurve` | 功率等能耗趋势来源。 | `能耗趋势源不可达，请检查能耗曲线接口。` |
| `devices` | - | `设备清单` | `设备清单来源` | 110 | `/zsqy/drinfo/{siteId}/findObject` | 设备数量/类型与拓扑节点来源。 | `设备清单源不可达，请检查设备台账接口。` |
| `alarms` | - | `告警摘要` | `告警摘要来源` | 120 | `/zsqy/qsAlarmlog/{siteId}/findNewAlarmLog` | 首页总览告警摘要来源。 | `告警摘要源不可达，请检查告警日志接口。` |
| `rules` | - | `规则配置` | `规则配置来源` | 130 | `docs/hvac-rules-v1.yaml` | 规则引擎规则文件来源。 | `规则配置不可读，建议功能已降级。` |
| `dashboardOverview` | - | `总览聚合` | `总览聚合内部来源` | 140 | `/bff/v1/sites/{siteId}/dashboard/overview` | recommendations 对总览聚合的内部依赖。 | `总览聚合不可用，建议结果可能不完整。` |
| `anomalySummary` | - | `异常聚合` | `异常聚合内部来源` | 150 | `/bff/v1/sites/{siteId}/anomalies/summary` | recommendations 对异常聚合的内部依赖。 | `异常聚合不可用，建议结果可能不完整。` |

## 3. 状态分类短句（ok/status/message/error）

| 分类ID | 推荐短句 | 判定规则（按顺序命中） |
| --- | --- | --- |
| `normal` | `正常` | `ok=true` 且 `error` 为空。 |
| `field_invalid` | `字段缺失或无效` | `message/error` 命中 `field_missing_or_invalid`。 |
| `upstream_unreachable` | `上游不可达` | `message/error` 命中 `upstream_unreachable`、`fetch failed`、`timeout`、`ECONN`、`ENOTFOUND` 等网络不可达特征。 |
| `upstream_service_error` | `上游服务异常` | `status >= 500` 或 `status` 为 502/503/504。 |
| `state_abnormal` | `状态异常` | 其他 `ok=false` 但不命中以上规则。 |

推荐展示规则：

- 折叠态只展示以上短句，不直接透出原始 error 文本。
- 展开态可显示原始 `message/error` 作为排障补充。

## 4. 折叠态摘要建议（高信噪比）

### 4.1 summary 公式建议

- `total = sourceStatus.sources.length`
- `abnormal = count(classification != normal)`
- `hard_block = count(classification in [upstream_unreachable, upstream_service_error])`
- `field_issue = count(classification == field_invalid)`
- 推荐摘要文本：
  - `abnormal = 0` -> `来源正常（0/{total}）`
  - `abnormal > 0` -> `来源异常（{abnormal}/{total}）`
  - 可追加子摘要：`阻塞 {hard_block} · 字段问题 {field_issue}`

### 4.2 warn/good 判定

- `good`：`abnormal == 0`
- `warn`：`abnormal > 0`

补充建议：

- 若 `hard_block > 0`，折叠态优先显示“上游不可达/上游服务异常”。
- `ruleMetrics`、`dashboardOverview`、`anomalySummary` 属技术中间 key，仅用于诊断，不单独业务化解读。

## 5. 动态 metric 模板与兜底

动态 key 模板：

- 匹配：`^metric\\.([a-z0-9_]+)$`
- 短标签模板：`{字段中文简称}`（无法命中则用 `规则指标`）
- 完整标签模板：`规则指标：{字段中文名或snake_case}`
- 失败提示模板：`{字段中文名或snake_case}指标不可用，请检查字段映射或上游链路。`

未收录 key 兜底：

- 短标签：`未收录`
- 完整标签：`未收录来源（{rawKey}）`
- 失败提示：`来源语义未收录，请先完成口径校准后再业务化展示。`
- 风险提示：未收录 key 禁止直接用于业务结论。

## 6. 与 v1 差异说明（新增/调整/兼容）

新增：

- 增加“短标签（<=6字）/完整标签”双标签体系。
- 增加 `ok/status/message/error` 到 5 类状态短句规则。
- 增加折叠态 summary 公式与 `warn/good` 判定规则。
- 增加 key 优先级字段，支持折叠态排序。

调整：

- `subsystemInfo` 与 `subsystemSummary` 收敛为主 key `subsystemSummary`，前者作为兼容别名。
- `metric.*` 统一走动态模板，已收录指标仍保留显式映射。

兼容：

- 保持 v1 已有 key 语义与失败主提示不变（文本可微调）。
- 不变更字段定义、不变更 `null_strategy`，仅增强前端展示口径。


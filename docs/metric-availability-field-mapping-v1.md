# Metric Availability <-> Field Dictionary 映射 v1

目的：为规则与前端提供“字段定义 -> 可用性规则”可追踪关系，不改变任何既有字段值与 `null_strategy`。

范围字段（P0）：

- `chilled_delta_t_c`
- `cooling_delta_t_c`
- `station_cop`
- `station_total_power_kw`

## 1. 可追踪映射表

| field_name | field-dictionary(v1.0.1) | availability 章节锚点 | 对齐约束 |
| --- | --- | --- | --- |
| `chilled_delta_t_c` | `docs/field-dictionary.json` 字段 `chilled_delta_t_c`（`null_strategy=return_null`） | `docs/metric-availability-v1.md#1-指标可用性清单p0`（该字段行） | 不改字段值；保持 `return_null` |
| `cooling_delta_t_c` | `docs/field-dictionary.json` 字段 `cooling_delta_t_c`（`null_strategy=return_null`） | `docs/metric-availability-v1.md#1-指标可用性清单p0`（该字段行） | 不改字段值；保持 `return_null` |
| `station_cop` | `docs/field-dictionary.json` 字段 `station_cop`（`null_strategy=return_null`） | `docs/metric-availability-v1.md#1-指标可用性清单p0`（该字段行） | 不改字段值；保持 `return_null`，禁止 `NaN/Infinity` |
| `station_total_power_kw` | `docs/field-dictionary.json` 字段 `station_total_power_kw`（`null_strategy=return_null`） | `docs/metric-availability-v1.md#1-指标可用性清单p0`（该字段行） | 不改字段值；保持 `return_null` |

补充分类映射（四个字段共用）：

- 错误分类定义来源：`docs/metric-availability-v1.md#2-观测输出约定recommendations`
- 差异结论来源：`docs/metric-availability-v1.md#3-与-field-dictionary-v101-差异说明`

## 2. `station_total_power_kw` 主口径与回退链路边界

主口径（不变）：

- 优先使用 `totalPower`（对应 field-dictionary 主口径 `126lnoffice.qstag.totalPower` / `type=2`）。

回退链路（仅用于可用性增强，不改变主口径定义）：

1. `power`
2. 卡片 `title` 命中 `Total Power/总功率` 的 `tagValue`
3. 分项求和：`chiller_power_kw + chilled_pump_power_kw + cooling_pump_power_kw + cooling_tower_power_kw`

边界规则：

- 仅在主口径值缺失/无效（空值或非有限数）时启用回退。
- 一旦主口径可用，必须覆盖回退结果并作为唯一对外口径。
- 回退结果只用于运行时可用性与规则评估连续性，不回写 field-dictionary 口径定义。

## 3. 变更约束

- 本映射文档是追踪层文档，不修改 `docs/field-dictionary.json` 中任何字段值、单位、来源、`null_strategy`。
- 后续若新增规则核心指标，必须先在 `field-dictionary` 定义，再补本映射与 availability 对应锚点。

## 4. 站点切换对字段口径的影响边界

站点切换边界：

- 切换站点（`siteId`）只改变数据来源实例（上游数据对象和取数路径中的站点参数）。
- 切换站点不改变字段定义、单位、`null_strategy`，也不改变本映射文档中的可用性分类语义。

跨站点对比前置条件（必须同时满足）：

- 时间窗一致：比较区间起止时间必须一致。
- 采样频率一致：参与对比的点位粒度/重采样策略一致（例如统一为 5 分钟或 1 小时）。
- 缺失策略一致：`null` 处理、缺失填补和过滤规则一致（含 `upstream_unreachable` 与 `field_missing_or_invalid` 的分类口径一致）。

## 5. 跨站点比较前置约束（v1）

最小比较单元（必须全部满足）：

- 相同时间窗：同起止时间、同时区、同对齐边界（整点/5 分钟点）。
- 相同采样频率：同原始粒度或同重采样规则（例如都按 5 分钟均值）。
- 相同缺失策略：同一 `null` 处理、同一缺失过滤/填补规则。
- 相同错误分类口径：`upstream_unreachable` 与 `field_missing_or_invalid` 的判定规则一致。

### 5.1 四个核心指标可比/不可比场景示例

| 指标 | 可比场景（示例） | 不可比场景（示例） |
| --- | --- | --- |
| `chilled_delta_t_c` | A/B 两站都取同一日 `09:00-12:00`，都按 5 分钟点、缺失值都保留 `null` 并剔除同类异常段后比较中位数。 | A 站按 5 分钟原始点，B 站按 1 小时聚合点，直接比较平均值。 |
| `cooling_delta_t_c` | A/B 两站都以 `overview_data_age_min<=45` 的有效窗口比较，且缺失分类都按同一规则标注。 | A 站把 `field_missing_or_invalid` 当 0 回填，B 站保留 `null`，再比较日均温差。 |
| `station_cop` | A/B 两站均只使用有限数值 COP（剔除无效点），在相同时间窗比较 P50/P90。 | A 站包含无效点（如错误回填导致异常大值），B 站剔除无效点后比较均值。 |
| `station_total_power_kw` | A/B 两站均优先主口径 `totalPower`，且仅在主口径缺失时使用同一回退链路，再比较峰值。 | A 站大量使用分项求和回退，B 站全部为主口径 `totalPower`，但未标注来源占比直接横比。 |

## 6. 站点切换不改变语义核对清单

| 核对项 | `chilled_delta_t_c` | `cooling_delta_t_c` | `station_cop` | `station_total_power_kw` |
| --- | --- | --- | --- | --- |
| 字段名固定 | 是 | 是 | 是 | 是 |
| 单位固定 | ℃ | ℃ | - | kW |
| `null_strategy` 固定 | `return_null` | `return_null` | `return_null` | `return_null` |
| source priority 固定 | `chilledWaterTemperatureDifference -> 冷冻水温差 tagValue` | `chilledOutWaterTemperatureDifference -> 冷却水温差 tagValue` | `coldStationCop/cop -> COP tagValue` | `totalPower -> power -> 总功率tagValue -> 分项求和` |

核对结论使用规则：

- 任一站点若不满足上表任一项，不进入“可比样本集”。
- 仅允许“来源实例变化”（不同 `siteId`），不允许“字段语义变化”。

## 7. 跨站点比较风险简表

| 风险 | 误判后果 | 避免策略 |
| --- | --- | --- |
| 时间窗不一致 | 把负荷时段差异误判为站点能效差异 | 固定统一比较窗口并记录时区、边界对齐方式 |
| 采样频率不一致 | 峰值/波动被平滑或放大，横向排名失真 | 比较前统一重采样到同粒度并标注聚合函数 |
| 缺失策略不一致 | 一站偏高/偏低的系统性偏差 | 统一 `null` 处理与缺失过滤规则，禁止一站补0一站保留空 |
| 错误分类口径不一致 | 把数据链路问题误判为设备/控制问题 | 强制统一 `upstream_unreachable` 与 `field_missing_or_invalid` 判定逻辑 |
| 主口径与回退混用未标识 | 错把数据质量差异当业务差异 | 比较结果附“主口径命中率/回退占比”，超阈值样本不参与横向结论 |

## 8. 巡检清单（Checklist）

用途：可直接作为主控脚本检查项或人工验收模板。每项必须判定为“是/否”。

| 检查项ID | 检查项 | 判定标准（满足即“是”） | 结果（是/否） | 备注 |
| --- | --- | --- | --- | --- |
| CK-01 | 时间窗一致 | 参与比较的所有站点使用相同起止时间、相同时区、相同时间边界对齐方式 |  |  |
| CK-02 | 采样频率一致 | 所有站点原始粒度一致，或已按同一重采样规则统一到同粒度（含同一聚合函数） |  |  |
| CK-03 | 缺失策略一致 | 所有站点对 `null`、缺失点、异常点执行同一处理策略（保留/剔除/填补规则一致） |  |  |
| CK-04 | 错误分类口径一致 | 所有站点使用同一判定逻辑区分 `upstream_unreachable` 与 `field_missing_or_invalid` |  |  |
| CK-05 | 字段语义一致 | 字段名、单位、`null_strategy`、source priority 与本文第 6 节核对清单一致 |  |  |
| CK-06 | 主口径命中率可追踪 | `station_total_power_kw` 已统计主口径命中率与回退占比，并在比较报告标注 |  |  |

### 8.1 四个核心指标“最容易误判”反例

| 指标 | 最容易误判反例（用于巡检拦截） | 对应应拦截检查项 |
| --- | --- | --- |
| `chilled_delta_t_c` | A 站比较窗口含 10:00-12:00 高负荷段，B 站只取 00:00-02:00 低负荷段，仍直接做横向排名。 | CK-01 |
| `cooling_delta_t_c` | A 站 5 分钟点，B 站 1 小时均值点，前端直接对比“当前值”并判定 B 站更优。 | CK-02 |
| `station_cop` | A 站把 `field_missing_or_invalid` 回填为 `0`，B 站保留 `null`；比较日均 COP 得出 A 站显著更差。 | CK-03 / CK-04 |
| `station_total_power_kw` | A 站大量走分项求和回退、B 站基本全是 `totalPower` 主口径，但报告未展示命中率仍直接比较峰值。 | CK-06 |

## 9. 运行时可达性阻塞与口径风险的判别边界

判别原则：

- 运行时可达性阻塞：属于“系统/链路可用性问题”，核心是当前时刻拿不到数据，不应直接下业务口径结论。
- 数据口径风险：属于“语义/比较条件问题”，即使拿到数据也可能不可比或解释错误。
- 先判可达性，再判口径：若可达性未通过，优先处理链路问题；仅在可达性通过后进入口径风险判断。

### 9.1 典型实例与证据字段

| 实例 | 判定类型 | 典型现象 | 应看哪个证据字段 | 判定动作 |
| --- | --- | --- | --- | --- |
| 合同通过但上游不可达 | 运行时可达性阻塞 | `check:contract` 通过，但推荐结果大量 `skipped` 且指标为 `upstream_unreachable` | `sourceStatus.sources[]`（看 `ok=false`、`error`、`message`）；`ruleEvaluation.skippedRuleDetails[]`（看 `category=upstream_unreachable`）；`freshness`（`stale=true`） | 先修复上游连通/超时/鉴权，再做规则与可视化口径判断 |
| 上游可达但字段缺失 | 数据口径风险（字段完整性） | 上游接口 `ok=true`，但指标缺失导致规则跳过 | `sourceStatus.sources[]`（看 `metric.*` 条目 `category=field_missing_or_invalid`）；`ruleEvaluation.skippedRuleDetails[]`（缺失指标明细） | 排查字段映射优先级、点位缺失、值解析规则；不要误判为网络故障 |
| 多站点比较条件不一致 | 数据口径风险（比较条件） | 两站都能取到数据，但横向结论波动异常或反直觉 | `freshness`（时间窗/陈旧状态）；`sourceStatus`（采样与缺失处理执行信息）；`skippedRuleDetails`（分类口径是否一致） | 回到第 5/6/8 节执行 CK-01~CK-06，未全通过则禁止输出横向优劣结论 |

### 9.2 证据字段使用顺序（主控排障建议）

1. `sourceStatus`：先确认可达性与错误分类（是否是链路阻塞）。
2. `freshness`：确认数据是否陈旧，避免拿历史片段做实时判断。
3. `ruleEvaluation.skippedRuleDetails`：定位具体缺失指标及分类，区分“拿不到”与“拿到但不可用”。

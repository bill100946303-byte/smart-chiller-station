# station_cop 数据治理执行规范 v1

目标：将 `station_cop` 缺失场景的治理策略固化为可执行规范。  
边界：不改字段定义，不改 `null_strategy`。

参考输入：
- `docs/station-cop-source-feasibility-v1.md`
- `docs/non-degraded-readiness-checklist-v1.1.csv`

---

## 1. 三层策略总表（可复制）

> 列定义：触发条件 / 处置动作 / 回退条件 / 告警文案

| 层级 | 触发条件 | 处置动作 | 回退条件 | 告警文案 |
| --- | --- | --- | --- | --- |
| 采集层（legacy） | `/getEquipmentEnergyStatisticsCurve` 可达但 `coldStationCop/cop/COP tagValue` 均缺失或非有限值 | 保持主来源优先链：`coldStationCop -> cop -> COP tagValue`；若仍缺失，标记 `field_missing_or_invalid` | 仅允许回退到 `/getRunParamsCurveByTagName(title=COP|冷站COP, tagname=coldStationCop|cop)`；禁止直接计算型回补作为默认值 | `station_cop 主来源缺失：field_missing_or_invalid` |
| 采集层（legacy） | 主接口不可达、超时、5xx | 返回明确上游故障状态，分类为 `upstream_unreachable` | 不用本地常量/历史值硬回填；保留 `null` 输出并上抛状态 | `station_cop 上游不可达：upstream_unreachable` |
| 聚合层（bff） | `recommendations.sourceStatus.sources[key=metric.station_cop].ok=false` | 在 `sourceStatus` 与 `skippedRuleDetails` 同步透出分类与 message；`overview.energyCards.currentCop` 维持 `null` | 不把 `null` 转 `0`；不修改 `station_cop` 字段定义与 `return_null` 策略 | `station_cop 不可用，相关规则降级` |
| 聚合层（bff） | `overview.energyCards.currentCop` 非有限值（NaN/Infinity）或 `<=0` | 视为无效值并置 `null`，并按缺失分类透出原因 | 不使用非有限值进入规则评估；不得放入非降级通过条件 | `station_cop 值无效，已按缺失处理` |
| 聚合层（bff） | 灰度诊断态且主来源全失效 | 可启用“计算型 COP”诊断值（见第 3 节），并显式打标 `computed_fallback=true` | 仅用于诊断展示，不参与非降级门禁，不作为规则放行依据 | `station_cop 计算回补（诊断态）` |
| 展示层（shell） | `currentCop == null` 或 `metric.station_cop` 来源 `ok=false` | 展示降级态文案（缺失/上游不可达），并提示建议可信度下降 | 不显示虚假数值；禁止把 `--` 包装为正常值 | `冷站COP暂不可用，请先排查数据链路` |
| 展示层（shell） | 跨站点比较模式开启且 comparability guard 不满足 | 阻断 `station_cop` 横向结论，仅展示“不可直接比较”提示 | 满足同时间窗/同采样频率/同缺失策略/同错误分类后自动恢复比较 | `跨站点比较条件不一致，已阻断COP横比` |
| 展示层（shell） | 命中计算回补标记 `computed_fallback=true` | 在 UI 明示“诊断态估算值”，不进入默认 KPI 主位 | 一旦直采恢复（连续窗口通过）立即切回直采并去除估算标记 | `当前为诊断估算COP，非生产放行口径` |

---

## 2. 禁止项清单（强约束）

1. 禁止 `totalElectricity`（`kWh` 累计电能）参与 `station_cop` 计算。  
2. 禁止仅用温差（`chilled_delta_t_c` / `cooling_delta_t_c`）推导 `station_cop`。  
3. 禁止将 `station_cop` 缺失值回填为 `0`、`1` 或历史常量并冒充直采值。  
4. 禁止在 `station_cop` 缺失时放宽非降级门禁（`skippedRuleIds/skippedRuleDetails` 不得被忽略）。

---

## 3. 灰度启用条件（仅诊断态可用）

仅当以下条件**全部满足**时，允许临时启用“计算型 COP 回补”：

1. 主来源 `coldStationCop/cop/COP tagValue` 全部不可用。  
2. 分子分母来自同周期数据：`totalCoolingCapacity` 与 `totalPower` 时间差 `<= 5min`。  
3. 数值有效：分子分母均为有限数值，且分母 `> 0`（严格禁止 NaN/Infinity）。  
4. 输出显式打标：`computed_fallback=true`，并在 `sourceStatus` 中可追踪。  
5. 作用范围受限：仅用于诊断态展示，不参与规则放行、非降级判定、跨站点比较结论。

---

## 4. 退出条件（恢复直采后立即退出）

满足以下条件即**立即退出**计算回补并恢复直采：

1. 直采来源恢复：`metric.station_cop` 连续 2 个采样窗口 `ok=true`。  
2. 直采值恢复有效：`currentCop` 连续 2 个窗口为有限值且 `>0`。  
3. 规则侧恢复：`skippedRuleDetails` 中不再出现 `metric=station_cop` 缺失项。  
4. 展示侧恢复：移除 `computed_fallback` 标识，UI 回到标准 COP 展示路径。

---

## 5. 执行边界复述

- 本规范仅定义治理动作与判责，不变更 `station_cop` 字段语义。  
- 不修改 `field-dictionary`、`null_strategy`、接口合同字段。  
- 所有降级与回补行为必须可观测（`sourceStatus` + `ruleEvaluation` + 前端提示一致）。

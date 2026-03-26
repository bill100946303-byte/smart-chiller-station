# station_cop 数据来源可行性评估 v1

目标：盘点旧接口中 `station_cop` 的可用来源与可计算来源，给出启用建议。  
边界：不改字段定义，不改 `null_strategy`。

## 1. 评估口径

- 指标目标：`station_cop`（冷站 COP，单位 `-`）
- 主参考口径：
  - `docs/field-dictionary.json`（`station_cop` 来源与空值策略）
  - `docs/metric-mapping-v1.md`（优先级：`coldStationCop/cop -> COP tagValue`）
  - `apps/chiller-bff/src/adapters/legacyEnergyAdapter.js`（当前实际取数与回退逻辑）

## 2. 主来源（建议默认启用）

| 字段名 | 接口 | 单位 | 可信度 | 风险 | 建议是否启用 |
| --- | --- | --- | --- | --- | --- |
| `coldStationCop` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `-` | 高 | 上游不可达或字段缺失时直接断供 | 是（主口径优先） |
| `cop` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `-` | 中高 | 同名字段可能出现口径歧义（需限定在冷站聚合上下文） | 是（`coldStationCop` 缺失时启用） |
| `tagValue`（`title` 命中 `COP/冷站COP`） | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `-` | 中 | 依赖标题匹配，存在命名漂移风险 | 是（主来源链最后一级回退） |

## 3. 备选来源（条件启用，不建议默认）

| 字段名 | 接口 | 单位 | 可信度 | 风险 | 建议是否启用 |
| --- | --- | --- | --- | --- | --- |
| `value`（`title=冷站COP/COP` + `tagname=coldStationCop/cop`） | `/zsqy/homepage/{siteId}/getRunParamsCurveByTagName` | `-` | 中 | 依赖 `title/tagname` 查询参数，站点命名差异可能导致漏取 | 有条件启用（仅主来源缺失时） |
| `series.points[].value`（`key/label` 命中 `cop`） | `/zsqy/homepage/{siteId}/getEnergyStatisticsCurve` + `/zsqy/homepage/{siteId}/getRunParamsCurve` | `-` | 中低 | 曲线标签不稳定、序列粒度可能与 overview 不一致 | 有条件启用（趋势补偿，不回写主口径） |
| 计算型：`totalCoolingCapacity / totalPower` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `-` | 中低 | `totalCoolingCapacity` 在现场可能长期为 0/null；时间对齐与分母有效性需额外校验 | 有条件启用（仅灰度/诊断态） |
| 计算型：`totalCoolingCapacity / (chiller+chilledPump+coolingPump+coolingTower)` | 同上 | `-` | 低 | 分母含组合建模项（冷却塔组合口径），误差链条更长 | 不建议默认启用（仅调试态） |

## 4. 不可用来源（禁止启用）

| 字段名 | 接口 | 单位 | 可信度 | 风险 | 建议是否启用 |
| --- | --- | --- | --- | --- | --- |
| `totalElectricity` / `electricEnergyOfCoolingStation` 参与 COP 计算 | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve`（及日统计口径） | `kWh` | 不可用 | `kWh` 为累计电能，时间维度与瞬时 COP 不匹配，结论必然失真 | 否 |
| `station_heat_rejection_kw / station_total_power_kw` 作为 COP | 由旧接口派生 | `-` | 不可用 | 该比值不是冷站 COP 定义（物理语义不一致） | 否 |
| 仅用 `chilled_delta_t_c` 或 `cooling_delta_t_c` 直接推 COP | 旧接口温差字段 | `-` | 不可用 | 缺流量维度，无法构成冷量，不具备可计算性 | 否 |

## 5. 计算型 COP 回补结论

结论：**当前版本不允许“计算型 COP 回补”作为默认放行路径（no）。**

仅在以下条件同时满足时，才可在灰度/诊断态临时启用（不替代主口径定义）：

1. 主来源（`coldStationCop/cop/COP tagValue`）全部不可用。
2. `totalCoolingCapacity` 与 `totalPower` 来自同一接口周期，且时间差 `<=5min`。
3. 分子分母均为有限数值，且分母 `>0`（严格禁止 `NaN/Infinity`）。
4. `sourceStatus` 显式标注为计算回补来源（用于前端降级提示，不伪装为主来源直采）。
5. 回补结果仅用于短时可视化兜底，不用于规则放行门禁和跨站点横向结论。

## 6. 三档来源清单（摘要）

- 主来源：`getEquipmentEnergyStatisticsCurve` 的 `coldStationCop -> cop -> COP tagValue`
- 备选来源：`getRunParamsCurveByTagName` COP 查询、趋势曲线 COP 序列、`totalCoolingCapacity/totalPower` 条件计算
- 不可用来源：`totalElectricity`（kWh）参与 COP、散热量比值替代 COP、仅温差推 COP

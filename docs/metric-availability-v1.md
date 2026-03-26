# 规则核心指标可用性清单 v1

适用范围：

- 规则引擎 `recommendations` 评估输入
- 前端建议页/诊断页对缺失原因的解释展示
- 对齐 `field-dictionary.json` `version=1.0.1`

## 1. 指标可用性清单（P0）

| 指标 | 来源接口 | 字段优先级（高 -> 低） | 空值策略 | 陈旧阈值 | 错误分类 |
| --- | --- | --- | --- | --- | --- |
| `chilled_delta_t_c` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 1) `chilledWaterTemperatureDifference` 2) 卡片行 `title` 命中“冷冻水温差”后的 `tagValue` | `return_null`（与 field-dictionary v1.0.1 一致） | 45 分钟（规则使用 `overview_data_age_min > 45` 视为陈旧） | `upstream_unreachable`：接口不可达/超时/5xx；`field_missing_or_invalid`：接口可达但字段缺失、空值或非有限数值 |
| `cooling_delta_t_c` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 1) `chilledOutWaterTemperatureDifference` 2) 卡片行 `title` 命中“冷却水温差”后的 `tagValue` | `return_null`（与 field-dictionary v1.0.1 一致） | 45 分钟（规则使用 `overview_data_age_min > 45` 视为陈旧） | `upstream_unreachable`：接口不可达/超时/5xx；`field_missing_or_invalid`：接口可达但字段缺失、空值或非有限数值 |
| `station_cop` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 1) `coldStationCop` / `cop` 2) 卡片行 `title` 包含 `COP` 的 `tagValue` | `return_null`（与 field-dictionary v1.0.1 一致；禁止 `NaN/Infinity`） | 45 分钟（规则使用 `overview_data_age_min > 45` 视为陈旧） | `upstream_unreachable`：接口不可达/超时/5xx；`field_missing_or_invalid`：接口可达但字段缺失、空值或非有限数值 |
| `station_total_power_kw` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 1) `totalPower` 2) `power` 3) 卡片行 `title` 命中“Total Power/总功率”的 `tagValue` 4) `chiller_power_kw + chilled_pump_power_kw + cooling_pump_power_kw + cooling_tower_power_kw` | `return_null`（与 field-dictionary v1.0.1 一致） | 45 分钟（规则使用 `overview_data_age_min > 45` 视为陈旧） | `upstream_unreachable`：接口不可达/超时/5xx；`field_missing_or_invalid`：接口可达但字段缺失、空值或非有限数值 |

## 2. 观测输出约定（recommendations）

缺失分类透出位置：

- `sourceStatus.sources[]`：
  - `metric.chilled_delta_t_c`
  - `metric.cooling_delta_t_c`
  - `metric.station_cop`
  - `metric.station_total_power_kw`
- `ruleEvaluation.skippedRuleDetails[]`：
  - `missingMetrics[].metric`
  - `missingMetrics[].category`
  - `missingMetrics[].message`

分类定义：

- `upstream_unreachable`：来源接口不可达、超时、网络错误或返回非成功。
- `field_missing_or_invalid`：来源接口成功但字段不存在、值为空、或值为非有限数（含解析后无效值）。

## 3. 与 field-dictionary v1.0.1 差异说明

结论：无冲突，属于补充维度。

- 一致项：
  - 四个指标的字段名、单位和空值策略均与 `field-dictionary v1.0.1` 一致（均为 `return_null`）。
- 补充项（field-dictionary 未覆盖）：
  - 字段优先级（运行时提取链路）
  - 陈旧阈值（规则消费阈值 45 分钟）
  - 错误分类（`upstream_unreachable` / `field_missing_or_invalid`）及输出位置
- 说明项：
  - `station_total_power_kw` 在字典中主口径是 `totalPower`；本清单补充了运行时回退链路（`power`/卡片总功率/分项求和），不改变主口径定义。


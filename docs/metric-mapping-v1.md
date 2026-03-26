# Metric Mapping v1（P0）

本文用于对齐规则引擎 P0 缺失指标在 BFF 的聚合口径，面向前后端与规则配置统一消费。

## 1. P0 指标映射

| 字段名 | 中文名 | 单位 | 来源接口/字段 | 计算口径 | 刷新频率 | 空值策略 |
| --- | --- | --- | --- | --- | --- | --- |
| `max_chilled_pump_freq_hz` | 冷冻泵近60分钟最大频率 | Hz | `/zsqy/homepage/{siteId}/getEnergyStatisticsCurve` + `/zsqy/homepage/{siteId}/getRunParamsCurve`；匹配“冷冻泵 + 频率/Hz”曲线 | 在最近 60 分钟窗口内取曲线最大值；无时间戳时回退使用现有点集 | 5 分钟（随曲线接口） | 无可用点时返回 `0` |
| `chiller_start_stop_count_60m` | 冷机近60分钟启停次数 | 次 | 同上；匹配“冷机/主机 + 运行/启停/状态”曲线 | 近 60 分钟内将值二值化（`>0` 视为运行），统计状态切换次数（0↔1） | 5 分钟 | 无可用点时返回 `0` |
| `chilled_pump_start_stop_count_60m` | 冷冻泵近60分钟启停次数 | 次 | 同上；匹配“冷冻泵 + 运行/启停/状态”曲线 | 同 `chiller_start_stop_count_60m` | 5 分钟 | 无可用点时返回 `0` |
| `cooling_pump_start_stop_count_60m` | 冷却泵近60分钟启停次数 | 次 | 同上；匹配“冷却泵 + 运行/启停/状态”曲线 | 同 `chiller_start_stop_count_60m` | 5 分钟 | 无可用点时返回 `0` |

## 2. 规则基础量可用性说明（P0）

| 字段名 | 中文名 | 单位 | 来源接口/字段 | 计算口径 | 刷新频率 | 空值策略 |
| --- | --- | --- | --- | --- | --- | --- |
| `chilled_delta_t_c` | 冷冻水温差 | ℃ | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve`，优先 `chilledWaterTemperatureDifference`，其次卡片 `title=冷冻水温差` 对应 `tagValue` | 直接取实时温差，不做平滑 | 5 分钟 | `null`，并透出缺失原因 |
| `cooling_delta_t_c` | 冷却水温差 | ℃ | 同上，优先 `chilledOutWaterTemperatureDifference`，其次卡片 `title=冷却水温差` 对应 `tagValue` | 直接取实时温差，不做平滑 | 5 分钟 | `null`，并透出缺失原因 |
| `station_cop` | 冷站 COP | - | 同上，优先 `coldStationCop/cop`，其次卡片 `title` 包含 `COP` 对应 `tagValue` | 直接使用上游 COP；仅接受有限数值 | 5 分钟 | `null`，并透出缺失原因 |

缺失原因透出规范（必须区分两类）：

- `upstream_unreachable`：上游接口不可达或失败；`sourceStatus.error` 使用 `upstream unreachable`。
- `field_missing_or_invalid`：上游可达但字段不存在、为空或非数值；`sourceStatus.error` 使用 `field missing or invalid`。

在 `GET /bff/v1/sites/{siteId}/recommendations` 中的表达：

- `sourceStatus.sources[]` 增加 `metric.chilled_delta_t_c` / `metric.cooling_delta_t_c` / `metric.station_cop` 三条来源状态。
- `ruleEvaluation.skippedRuleDetails[]` 逐条规则给出 `missingMetrics[].metric/category/message`，用于解释 `skippedRuleIds`。

## 3. 关联指标口径说明

### 3.1 `totalElectricity` 口径风险

- 历史字段名 `totalElectricity` 容易被误解为“瞬时电量/功率”。
- 当前统一口径为累计电能 `station_total_energy_kwh`（kWh），仅作为累计量，不参与瞬时功率比较。
- 规则引擎中的功率相关判断统一使用 `station_total_power_kw`（kW）。

### 3.2 `coolingTower` 组合建模规则

- 当前现场无完整“独立冷却塔实体”直采模型，按组合建模处理：
- `cooling_tower_power_kw` 优先取塔侧总功率标签（如 `Cooling Tower Total Power`）。
- 若塔侧功率缺失，按适配器聚合结果回退（保证规则输入可计算，不产生 `NaN/Infinity`）。
- 与字段字典保持一致：`CTF(风机)+CTE(电量虚拟)+CTHDE(散热量虚拟)` 作为业务解释口径。

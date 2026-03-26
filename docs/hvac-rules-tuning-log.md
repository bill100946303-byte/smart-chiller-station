# HVAC Rules Tuning Log (P0)

更新文件：
- `/Users/billchow/Documents/智慧冷冻站/docs/hvac-rules-v1.yaml`

版本变更：
- `hvac-rules-v1` `1.0.0 -> 1.0.1`

## 1) 阈值调整说明（逐条规则）

### `low-delta-t-chilled-loop`
- 调整：`chilled_delta_t_low_c: 2.5 -> 2.0`，`min_load_kw: 80 -> 120`。
- 理由：低负荷工况下温差天然偏小，原阈值容易把部分轻载运行误判为异常；提高负荷门槛并收紧温差阈值可减少边界误报。

### `pump-frequency-too-high`
- 调整：`high_freq_hz: 45 -> 48`，`weak_delta_t_c: 3.0 -> 2.5`。
- 理由：45Hz 在部分工况属于正常调节区间，原规则对“高频+轻微低温差”较敏感；改为更高频且更弱换热才触发，提升告警精度。

### `cooling-side-low-efficiency`
- 调整：`cooling_tower_power_high_kw: 20 -> 25`，`station_cop_low: 3.2 -> 3.0`（`cooling_delta_t_low_c` 保持 `2.0`）。
- 理由：原规则在中等功率与中等 COP 下有误报风险；提高功率门槛并下调 COP 触发线，可更聚焦于“高耗能且明显低效”场景。

### `frequent-start-stop`
- 调整：`chiller_max_count_per_hour: 3 -> 4`，`pump_max_count_per_hour: 4 -> 6`。
- 理由：短时切换在策略切段或检修切换时可能出现，原阈值偏激进；提升计数门槛可避免把可接受的操作波动当作严重短循环。

### `stale-data-detection`
- 调整：`overview_max_age_min: 20 -> 45`，`anomalies_max_age_min: 30 -> 60`，`critical_metric_missing_max: 3 -> 4`。
- 理由：原配置在局部字段缺失时容易过早触发数据陈旧建议；提高时效阈值并抬高缺失阈值，优先识别持续性数据问题，降低“瞬时抖动”误报。

## 2) 命中结果对比（latest aggregate snapshot）

采样命令：
- `node apps/chiller-bff/scripts/probe.js 126lnoffice`

### 调整前（v1.0.0）
- `matchedRuleIds`:
```json
["stale-data-detection"]
```
- `skippedRuleIds`:
```json
[
  "low-delta-t-chilled-loop",
  "pump-frequency-too-high",
  "cooling-side-low-efficiency",
  "frequent-start-stop"
]
```

### 调整后（v1.0.1）
- `matchedRuleIds`:
```json
[]
```
- `skippedRuleIds`:
```json
[
  "low-delta-t-chilled-loop",
  "pump-frequency-too-high",
  "cooling-side-low-efficiency",
  "frequent-start-stop"
]
```

结论：
- 本次调优后，`stale-data-detection` 不再在当前快照中直接命中，误报风险降低。
- 其余 4 条规则仍依赖尚未在聚合层稳定提供的指标（泵频率、启停计数、冷却侧功率），维持 `skip_rule` 行为，不会产生误导卡片。

# 非降级放行字段清单 v1.2 一致性报告

目标：比对 `non-degraded-readiness-checklist-v1.1.csv` 与 `field-display-dictionary-v1.json`，输出可执行的 fail/warn 差异清单。  
边界：不改字段语义，不改 `null_strategy`。

## 1. 输入与比对维度

输入文件：
- `docs/non-degraded-readiness-checklist-v1.1.csv`
- `docs/field-display-dictionary-v1.json`
- `docs/non-degraded-readiness-fields-v1.md`
- `docs/metric-availability-field-mapping-v1.md`

比对维度：
- 字段存在（field_exists）
- 单位一致（unit_consistency）
- 多语言完整（i18n_completeness）
- 比较约束完整（compare_constraint）

重点字段（core 4）：
- `station_total_power_kw`
- `chilled_delta_t_c`
- `cooling_delta_t_c`
- `station_cop`

## 2. 总结

- blocking：4
- warning：8
- 结果文件：`docs/non-degraded-readiness-checklist-v1.2.csv`

判定结论：
- 现状不满足“非降级放行一致性”要求，需先清理 blocking 再处理 warning。

## 3. core 4 差异摘要

| 指标 | 字段存在 | 单位一致 | 多语言完整 | 比较约束完整 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `station_total_power_kw` | 失败（缺 overview 数值门禁） | 失败（缺单位门禁） | 通过（字典已完整） | 失败（缺跨站 guard） | blocking + warning |
| `chilled_delta_t_c` | 失败（缺 overview 数值门禁） | 失败（缺单位门禁） | 通过（字典已完整） | 失败（缺跨站 guard） | blocking + warning |
| `cooling_delta_t_c` | 失败（缺 overview 门禁 + 缺 trends 序列门禁） | 失败（缺单位门禁） | 通过（字典已完整） | 失败（缺跨站 guard） | blocking + warning |
| `station_cop` | 通过（已有 source + value 门禁） | 失败（缺单位门禁） | 通过（字典已完整） | 通过（已有 crossSite guard） | warning |

## 4. fail/warn 结果表说明（供主控消费）

完整结果见：
- `docs/non-degraded-readiness-checklist-v1.2.csv`

字段说明：
- `severity`：`blocking` / `warning`
- `status`：统一为 `fail`（本次仅输出差异项）
- `owner`：`legacy` / `bff` / `shell`
- `fix_priority`：`P0`（blocking）/ `P1`（warning）

## 5. 最小修复顺序（先 blocking）

1. `P0`：补齐 overview 数值门禁  
   - 新增 `overview.energyCards.totalPowerKw/chilledDeltaT/coolingDeltaT` 的 finite 校验（owner=`bff`）。
2. `P0`：补齐 `coolingDeltaT` 趋势门禁  
   - 在 trends core set 中纳入 `coolingDeltaT` 的 `metric/points/value` 校验（owner=`legacy` + `bff`）。
3. `P1`：补齐 core 4 单位一致性门禁  
   - `kW/℃/degC/-` 与展示字典对齐（owner=`bff`）。
4. `P1`：补齐三项跨站比较 guard  
   - `station_total_power_kw/chilled_delta_t_c/cooling_delta_t_c` 复用 `station_cop` guard 模式（owner=`shell`）。
5. `P1`：补 readiness 层三语完整性门禁  
   - 至少对 core 4 建立 `displayName/unitDisplay/shortHint` 三语回归钩子（owner=`shell`）。

## 6. owner 归属规则

- `legacy`：上游趋势源覆盖不足（如 `coolingDeltaT` 序列数据保障）。
- `bff`：放行清单门禁定义与字段/单位映射不足。
- `shell`：跨站比较约束与展示层多语言回归门禁不足。

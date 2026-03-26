# Readiness Baseline v1.3

目标：将 non-degraded 放行清单从“问题识别态（v1.2）”升级为“放行基线态（v1.3）”。

输入依据：
- `docs/non-degraded-readiness-checklist-v1.2.csv`
- `docs/field-display-consistency-report-v1.2.md`
- `docs/v1.8-signoff-decision.md`
- `/tmp/chiller_probe.json`

## 1. 版本结论

- 基线版本：`non-degraded-readiness-checklist-v1.3.csv`
- blocking 状态：`4/4` 已更新为 `已覆盖/已验证`
- warning 状态：`8` 条保持 `warning-open`
- 当前可放行基线：`yes`（满足“先清 blocking，再带 warning 放行”的基线策略）

## 2. blocking 收敛说明（v1.2 -> v1.3）

| check_id | 指标 | v1.2 状态 | v1.3 状态 | 运行时证据路径（/tmp/chiller_probe.json） |
| --- | --- | --- | --- | --- |
| NDC-001 | `station_total_power_kw` | fail | 已覆盖/已验证 | `overview.energyCards.totalPowerKw` |
| NDC-002 | `chilled_delta_t_c` | fail | 已覆盖/已验证 | `overview.energyCards.chilledDeltaT` |
| NDC-003 | `cooling_delta_t_c` | fail | 已覆盖/已验证 | `overview.energyCards.coolingDeltaT` |
| NDC-004 | `cooling_delta_t_c`（趋势） | fail | 已覆盖/已验证 | `trends.series[metric=coolingDeltaT].points[*].v` |

补充一致性证据：
- `v1.8-signoff-decision.md`：`ND failed: 0`、`sourceStatus overall=ok`。
- `/tmp/chiller_probe.json`：core4 对应路径均可取值，且 `recommendations.ruleEvaluation.skippedRuleIds.length=0`。

## 3. core4 runtime evidence path（新增列落实）

`v1.3.csv` 中已新增 `runtime_evidence_path`，core4 覆盖如下：

- `station_total_power_kw` -> `overview.energyCards.totalPowerKw`
- `chilled_delta_t_c` -> `overview.energyCards.chilledDeltaT`
- `cooling_delta_t_c` -> `overview.energyCards.coolingDeltaT` / `trends.series[metric=coolingDeltaT].points[*].v`
- `station_cop` -> `overview.energyCards.currentCop` / `recommendations.sourceStatus.sources[key=metric.station_cop]`

## 4. 当前仍保留的 warning（不阻断放行）

1. core4 单位一致性门禁尚未内建到 readiness 清单（`bff`）。
2. `station_total_power_kw/chilled_delta_t_c/cooling_delta_t_c` 跨站比较 guard 未在 readiness 清单显式化（`shell`）。
3. readiness 层 core4 三语完整性门禁未内建（`shell`）。

## 5. 基线使用说明

- 放行判定以 `v1.3.csv` 为准：`status=已覆盖/已验证` 的 blocking 项视为已收敛。  
- warning 项进入下一轮 `P1` 修复，不作为当前放行阻断。  
- 不变更字段定义、不变更 `null_strategy`、不放宽 OpenAPI 主合同。

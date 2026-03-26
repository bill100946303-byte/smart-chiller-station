# Acceptance 与 Readiness 差异收敛计划 v1.1

## 1. 目标与边界
- 目标：基于 `alignment-v1` 将“报告独有 / 基线独有”转成可执行收敛路线，提升验收可追溯性。
- 输入：`docs/acceptance-readiness-field-alignment-v1.md`、`docs/non-degraded-readiness-checklist-v1.3.csv`、`docs/readiness-baseline-freeze-v1.8.md`
- 边界：不改字段定义、不改 `null_strategy`、不改业务口径。

## 2. 收敛总览
- P0（本周）：先补 core4 字段级验收落点与关键映射，形成“可审计最小闭环”。
- P1（下周）：收敛 warning-open 对应的验收呈现（单位一致性、跨站比较约束、三语完整性）。
- P2（后续）：增强可读性与治理自动化，不影响当前放行。

## 3. P0（本周）

### 3.1 Core4 专项（单列，不合并）
| ID | 核心指标 | 当前缺口 | 收敛动作 | owner | 对放行影响 |
| --- | --- | --- | --- | --- | --- |
| P0-C1 | `station_total_power_kw` | 基线有门禁（NDC-001/005/009），验收报告无字段级落点 | 在验收报告增加 `core4Evidence.station_total_power_kw`，至少包含 `valuePath/unitGate/compareGuard/sourceStatusKey` | bff | yes |
| P0-C2 | `chilled_delta_t_c` | 基线有门禁（NDC-002/006/010），验收报告无字段级落点 | 在验收报告增加 `core4Evidence.chilled_delta_t_c`（同结构） | bff | yes |
| P0-C3 | `cooling_delta_t_c` | 基线有双路径门禁（NDC-003/004/007/011），验收报告无字段级落点 | 在验收报告增加 `core4Evidence.cooling_delta_t_c`，显式区分 `overview` 与 `trends` | bff | yes |
| P0-C4 | `station_cop` | 基线有单位/来源约束，验收报告无字段级落点 | 在验收报告增加 `core4Evidence.station_cop`，含 `valuePath/sourceStatusKey` | bff | yes |

### 3.2 本周非 core4 关键收敛
| ID | 缺口类型 | 收敛动作 | owner | 对放行影响 |
| --- | --- | --- | --- | --- |
| P0-G1 | 基线独有 12 项仅聚合可见 | 在验收报告新增 `baselineTrace`（NDC-001~012 -> 证据路径/状态） | bff | yes |
| P0-G2 | 报告独有字段缺“基线解释” | 新增 `acceptanceFieldPurpose` 小节，解释 `entry/stack/endpoints/overallPass` 与 readiness 的关系 | shell | no |

## 4. P1（下周）
| ID | 主题 | 收敛动作 | owner | 对放行影响 |
| --- | --- | --- | --- | --- |
| P1-1 | 单位一致性可审计 | 将 NDC-005~008 的单位门禁结果写入验收报告（pass/fail + expectedUnit） | bff | no |
| P1-2 | 跨站比较约束可审计 | 将 NDC-009~011 的 compare guard 结果写入验收报告（前置条件四元组） | shell | no |
| P1-3 | 三语完整性门禁可审计 | 将 NDC-012 写入验收报告（zh/en/vi 完整性统计） | shell | no |
| P1-4 | 验收-基线差异自动摘要 | 在验收报告附 `alignmentSummary`（aligned/reportOnly/baselineOnly 计数） | bff | no |

## 5. P2（后续）
| ID | 主题 | 收敛动作 | owner | 对放行影响 |
| --- | --- | --- | --- | --- |
| P2-1 | 历史趋势化 | 保留最近 7 次验收的对齐计数，输出 drift 趋势 | shell | no |
| P2-2 | 巡检联动 | 将 week1 daily/weekly 巡检结论回写验收摘要引用位 | shell | no |
| P2-3 | 异常根因模板化 | 对“上游不可达/字段缺失/比较条件不一致”输出标准诊断模板 | legacy | no |

## 6. 执行顺序（最小收敛路径）
1. 本周先落 `P0-C1~C4`（core4 单列），确保字段级证据可追溯。
2. 同步完成 `P0-G1`，让 NDC-001~012 在验收报告中可逐项对账。
3. `P1` 再补 warning-open 的可审计呈现，不阻断当前放行。

## 7. 结论
- 本计划将 `alignment-v1` 的两类差异转为可执行条目，优先解决 core4 可追溯缺口。
- 当前版本仍可按 `v1.8` 放行结论执行；P0 收敛用于提升下一轮签收可信度与审计完备性。

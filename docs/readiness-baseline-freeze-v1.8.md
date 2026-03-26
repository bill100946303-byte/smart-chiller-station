# V1.8 Baseline Freeze（字段口径 + Readiness v1.3）

目标：冻结 `v1.8` 放行基线，固化 core4 运行证据路径与 warning 分层处置，不影响当前放行。  
输入：
- `docs/non-degraded-readiness-checklist-v1.3.csv`
- `docs/readiness-baseline-v1.3.md`
- `docs/field-display-dictionary-v1.json`

## 1. 冻结结论

- 冻结版本：`v1.8`
- Readiness 基线：`non-degraded-readiness-checklist-v1.3.csv`
- blocking：`4/4 已覆盖/已验证`
- warning-open：`8`（已分层到 P1/P2，不阻断当前放行）
- 当前放行影响：`no`（不影响）

## 2. Core4 冻结证据路径

| 指标 | 运行证据路径（/tmp/chiller_probe.json） | 当前观测说明 |
| --- | --- | --- |
| `station_total_power_kw` | `overview.energyCards.totalPowerKw` | 数值可解析，纳入 blocking 收敛 |
| `chilled_delta_t_c` | `overview.energyCards.chilledDeltaT` | 数值可解析，纳入 blocking 收敛 |
| `cooling_delta_t_c` | `overview.energyCards.coolingDeltaT` + `trends.series[metric=coolingDeltaT].points[*].v` | overview 与 trends 双路径均可取值 |
| `station_cop` | `overview.energyCards.currentCop` + `recommendations.sourceStatus.sources[key=metric.station_cop]` | 已有来源与值路径，保留单位/多语言 warning 作为后续改进 |

## 3. warning-open 分层（不阻断放行）

分层结果（见 `docs/readiness-warning-roadmap-v1.8.csv`）：

- `P1`：3 项（跨站点比较约束 guard）
  - `station_total_power_kw`
  - `chilled_delta_t_c`
  - `cooling_delta_t_c`
- `P2`：5 项（单位一致性 + core4 三语完整性）
  - 单位一致性 4 项（`station_total_power_kw`、`chilled_delta_t_c`、`cooling_delta_t_c`、`station_cop`）
  - 三语完整性 1 项（`core_4_metrics`）

## 4. 上线后监控建议（一页）

### 4.1 字段漂移监控（Field Drift）

| 监控项 | 触发阈值 | owner | 处置建议 |
| --- | --- | --- | --- |
| `sourceStatus.sources[*].key` 新增/缺失 | 与基线 key 集合不一致 | bff | 记录漂移清单并更新映射字典；未收录 key 进入 warning |
| `trends.series[*].metric` 集合漂移 | 缺少 `totalPowerKw/currentCop/chilledDeltaT/coolingDeltaT` 任一 | legacy | 先排查上游接口输出，再校正适配器映射 |
| core4 证据路径断裂 | 路径缺失或不可解析 | bff | 触发 blocking 并回滚到上一稳定版本 |

### 4.2 口径漂移监控（Semantic Drift）

| 监控项 | 触发阈值 | owner | 处置建议 |
| --- | --- | --- | --- |
| 单位口径漂移（kW/℃/-） | 与 `field-display-dictionary-v1.json` 不一致 | bff | 标记 warning，进入 P2 修复并补门禁 |
| 跨站比较前提缺失 | compareMode=crossSite 且 guard 未通过 | shell | 阻断横向结论，仅展示“不可直接比较”提示 |
| `station_cop` 回补口径误用 | 诊断态估算值进入放行判断 | bff | 立即降级并禁止估算值参与规则放行 |

### 4.3 空值漂移监控（Null Drift）

| 监控项 | 触发阈值 | owner | 处置建议 |
| --- | --- | --- | --- |
| core4 空值率（5分钟窗口） | 任一指标空值率 `>20%` | legacy | 优先排查上游可达性与字段映射 |
| `station_cop` 非有限值率 | NaN/Infinity 出现率 `>0` | bff | 立即置 `null` 并输出 `field_missing_or_invalid` 分类 |
| `skippedRuleIds` 异常回升 | 连续 2 个窗口 `>0` | bff | 拉取 `skippedRuleDetails` 做根因归类并触发告警 |

## 5. 冻结边界

- 不修改字段定义。
- 不修改 `null_strategy`。
- 不放宽 OpenAPI 主合同。
- warning 分层仅作为后续迭代路线图，不影响 `v1.8` 当前放行结论。

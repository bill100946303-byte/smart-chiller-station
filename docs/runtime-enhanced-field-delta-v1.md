# Runtime Enhanced Field Delta v1

## 1. 目标与边界
- 目标：补一版“Redis 补齐后 core 字段恢复”的增量说明，覆盖补齐前后变化，并给出可继续巡检的证据路径。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/runtime-live-gap-field-map-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/runtime-completeness-layer-map-v1.md`：**当前不存在**，本次以主控状态文档和 live runtime 接口结果替代
  - 当前运行态接口返回（以主控最新结果为准）
- 当前 live 取证时间：
  - `dashboard/overview`：`2026-03-12T21:29:08Z`
  - `recommendations`：`2026-03-12T21:29:08Z`

## 2. 增量背景
补齐前（`runtime-live-gap-field-map-v1` 基线）：
- 运行态已从 `upstream_unreachable` 收敛到 `field_missing_or_invalid`
- 但 `currentCop` / `chilledDeltaT` / `coolingDeltaT` 仍为 `null`
- `recommendations.ruleEvaluation.skippedRuleIds` 非空

补齐后（主控“Redis 补齐后，运行态从 partial 收敛到 enhanced”）：
- `overview.energy.sourceStatus.message` 从 `coreMetricsMissing=...; homeEnergyEfficiency:rows=0` 切换到 `coreMetricsReady=3/3; homeEnergyEfficiency:rows=25`
- 3 个 core 字段已恢复为可消费值
- `recommendations.ruleEvaluation.skippedRuleIds=[]`

## 3. 字段增量表

| runtime 字段 | before | after | evidence_source | release_impact | next_action |
| --- | --- | --- | --- | --- | --- |
| `overview.energyCards.currentCop` | `2026-03-12T21:15:09Z`：`value=null`；`metric.station_cop.ok=false`；分类 `field_missing_or_invalid`；`energy.message` 含 `coreMetricsMissing` 与 `homeEnergyEfficiency:rows=0` | `2026-03-12T21:29:08Z`：`value=0`；`metric.station_cop.ok=true`；`message=ok: value=0`；`energy.message` 切到 `coreMetricsReady=3/3` 与 `homeEnergyEfficiency:rows=25` | before：`runtime-live-gap-field-map-v1.md` + 该文档作者探针；after：live `curl /dashboard/overview` + `curl /recommendations`；support：`v1.8-signoff-decision.md`（`homeData/energyEfficiency` 回退）与 `v19.2-master-status.md` 第 87 节 | warning | 连续观察 2-3 个 polling 周期；单独确认 `currentCop=0` 是现场真实值还是回退后的地板值，再决定是否用于更强的语义结论。 |
| `overview.energyCards.chilledDeltaT` | `2026-03-12T21:15:09Z`：`value=null`；`metric.chilled_delta_t_c.ok=false`；`skippedRuleIds` 包含 `low-delta-t-chilled-loop`、`pump-frequency-too-high` | `2026-03-12T21:29:08Z`：`value=0.2`；`metric.chilled_delta_t_c.ok=true`；`message=ok: value=0.2` | before：`runtime-live-gap-field-map-v1.md` + 该文档作者探针；after：live `curl /dashboard/overview` + `curl /recommendations`；support：`v19.2-master-status.md` 第 87 节 | info | 连续观察 2-3 个 polling 周期；若持续非空且 sourceStatus 稳定为 `ok=true`，可从 live-gap watch list 移除。 |
| `overview.energyCards.coolingDeltaT` | `2026-03-12T21:15:09Z`：`value=null`；`metric.cooling_delta_t_c.ok=false`；`skippedRuleIds` 包含 `cooling-side-low-efficiency` | `2026-03-12T21:29:08Z`：`value=0.4`；`metric.cooling_delta_t_c.ok=true`；`message=ok: value=0.4` | before：`runtime-live-gap-field-map-v1.md` + 该文档作者探针；after：live `curl /dashboard/overview` + `curl /recommendations`；support：`v19.2-master-status.md` 第 87 节 | info | 连续观察 2-3 个 polling 周期；若持续非空且 sourceStatus 稳定为 `ok=true`，可从 live-gap watch list 移除。 |
| `recommendations.ruleEvaluation.skippedRuleIds` | `2026-03-12T21:15:09Z`：`[low-delta-t-chilled-loop, pump-frequency-too-high, cooling-side-low-efficiency]` | `2026-03-12T21:29:08Z`：`[]` | before：`runtime-live-gap-field-map-v1` 作者探针；after：live `curl /recommendations`；support：`v19.2-master-status.md` 第 87 节 | info | 连续观察 2-3 个 polling 周期；若持续为空，可将“core runtime fields recovered” 视为已稳定。 |

## 4. 关键信号
1. 这次变化不是单纯文案变化，而是字段值本身发生了恢复：
   - `currentCop: null -> 0`
   - `chilledDeltaT: null -> 0.2`
   - `coolingDeltaT: null -> 0.4`
   - `skippedRuleIds: 3 -> 0`
2. 这次恢复与回退链路增强一致：
   - `v1.8-signoff-decision.md` 已声明 `homeData/energyEfficiency` 回退解析用于补齐 `station_cop`、温差核心量
   - 当前 live `energy.message` 也已出现 `homeEnergyEfficiency:rows=25`
3. 当前最值得继续盯的是 `currentCop=0`：
   - 运行态已经“可消费”
   - 但语义上仍建议保留一层人工复核，避免把恢复后的零值直接理解成稳定业务结论

## 5. 与现有文档关系
- `runtime-live-gap-field-map-v1.md` 定义“补齐前的 live gap 基线”。
- 本文档定义“补齐后的字段恢复增量”。
- 若后续要单独沉淀 completeness 分层，可在此基础上再补 `runtime-completeness-layer-map-v1.md`，无需改本次 delta 表。

## 6. 统计与结论
- blocking 数量：`0`
- warning 数量：`1`
- 是否影响默认放行：`no`

说明：
- `warning` 仅针对 `currentCop` 的恢复后语义复核。
- 其余条目为恢复证据或状态收敛，不单独构成默认放行阻断。

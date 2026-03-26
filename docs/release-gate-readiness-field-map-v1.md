# Release Gate 与 Readiness 字段对照 v1

## 1. 目标与边界
- 目标：建立可审计字段关系，统一 `release-gate` 与 `readiness` 的决策口径。
- 边界：不改字段定义、不改 `null_strategy`、不新增业务字段。
- 依据：`scripts/chiller_ctl.sh`、`docs/non-degraded-readiness-checklist-v1.3.csv`、`docs/acceptance-snapshot-freshness-policy-v1.md`。

## 2. 三列表（release gate 字段 -> readiness 字段 -> 决策影响）

| release gate 字段 | readiness 字段 | 决策影响（GO/NO-GO/Advisory） |
| --- | --- | --- |
| `contractOk` | `N/A`（独立合同门禁） | `NO-GO`（`false` 时） |
| `canonicalExists` | `readiness.nonDegradedReady` / `readiness.ndFailedCount` 的可读前提 | `NO-GO`（`false` 时） |
| `canonicalOverallPass` | `readiness.nonDegradedReady` + `readiness.ndFailedCount`（聚合到 canonical 的 `overallPass`） | `NO-GO`（`false` 时） |
| `unavailableSnapshotPresent` | `N/A`（诊断态快照） | `Advisory`（不直接阻断） |
| `canonicalGeneratedAt` | `N/A`（时效计算输入） | `Advisory`（default）/ `NO-GO`（strict 下非 fresh） |
| `canonicalAgeMin` | `N/A`（由 `generatedAt` 计算） | `Advisory`（default）/ `NO-GO`（strict 下非 fresh） |
| `freshness` | `N/A`（时效状态） | `Advisory`（`warn`）/ `NO-GO`（strict 下 `!=fresh`） |
| `strictFreshness` | `N/A`（策略开关） | `GO/NO-GO` 升级开关（`true` 时启用时效阻断） |
| `reasons[]` | 间接映射 `readiness` 与合同/时效门禁失败项 | `NO-GO` 解释层（阻断信号） |
| `advisories[]` | 间接映射诊断与时效提示项 | `Advisory` 解释层（非阻断） |
| `decision` | 汇总 `contractOk + canonicalExists + canonicalOverallPass (+ strictFreshness)` | 最终 `GO/NO-GO` |
| `exitCode` | 同 `decision` | `GO->0` / `NO-GO->1` |

审计备注：
- `release-gate` 不直接读取 `NDC-001~NDC-012` 明细，而是消费 canonical 聚合位（`overallPass`）。
- `readiness` 明细仍是字段口径追溯来源，`release-gate` 是最终放行决策层。

## 3. strictFreshness=true 的升级边界（Advisory -> Blocking）

| 触发字段组合 | default 模式 | strict 模式 | 升级结果 |
| --- | --- | --- | --- |
| `freshness=warn`（`30<=canonicalAgeMin<60`） | `advisories+=freshness_warn`，不直接阻断 | `reasons+=freshness_not_fresh_strict` | 从 `Advisory` 升级为 `NO-GO` |
| `freshness=stale`（`canonicalAgeMin>=60`） | 默认不直接阻断（可伴随重跑建议） | `reasons+=freshness_not_fresh_strict` | 从“可继续”升级为 `NO-GO` |
| `freshness=unknown`（`generatedAt` 缺失/不可解析/异常） | 默认不直接阻断 | `reasons+=freshness_not_fresh_strict` | 从“不确定”升级为 `NO-GO` |

## 4. 字段缺失时默认行为

| 缺失字段/状态 | 默认行为（default） | 严格行为（strict） | 放行影响 |
| --- | --- | --- | --- |
| `docs/v19.2-acceptance-report.json` 缺失 | `canonicalExists=false`，`reasons+=canonical_missing` | 同 default | `NO-GO` |
| canonical `.overallPass` 缺失 | 读取为 `false`（`// false`），`reasons+=canonical_not_pass` | 同 default | `NO-GO` |
| canonical `.generatedAt` 缺失/非法 | `canonicalAgeMin=null`，`freshness=unknown`，默认不直接阻断 | `reasons+=freshness_not_fresh_strict` | default: 通常不阻断；strict: `NO-GO` |
| 合同检查失败（`contractOk=false`） | `reasons+=contract_not_ok` | 同 default | `NO-GO` |
| unavailable 快照缺失 | `unavailableSnapshotPresent=false`，不加 advisory | 同 default | 不影响 |

## 5. 当前默认放行影响结论
- 该对照表为文档固化，不改脚本行为。
- 对当前默认放行结论影响：`no`。

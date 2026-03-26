# Release-Ready 与 Release-Ready-Latest 字段对照 v1

## 1. 目标与边界
- 目标：建立 `release-ready-latest` 可读字段与 `release-ready` 原始字段路径的一致性对照。
- 输入依据：
  - `docs/release-ready-field-semantics-v1.csv`
  - `docs/release-ready-contract-v1.md`
  - `scripts/chiller_ctl.sh`（`release_ready_cmd` / `release_ready_latest_cmd`）
- 边界：不改字段定义，仅固化映射、缺失默认行为与放行影响。

## 2. 三列表（latest 可读字段 -> release-ready 原始字段路径 -> 放行影响）

| latest 可读字段 | release-ready 原始字段路径 | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `decision` | `$.decision` | blocking | 缺失按 `NO-GO` | yes |
| `exitCode` | `$.exitCode` | blocking | 缺失按 `1` | yes |
| `reasons` | `$.reasons[]` | blocking | 缺失按 `["release_ready_field_missing:reasons"]` | yes |
| `advisories` | `$.advisories[]` | advisory | 缺失按 `[]` | no |
| `strictFreshness` | `$.inputs.strictFreshness` | info | 缺失按 `false` | no |
| `runtimeRequired` | `$.inputs.runtimeRequired` | info | 缺失按 `true`（保守） | yes（保守策略） |
| `snapshotDecision` | `$.checks.snapshotDecision` | advisory（用于归因） | 缺失按 `"UNKNOWN"` | no（主决策仍看 `decision`） |
| `consistencyDecision` | `$.checks.consistencyDecision` | blocking（与一致性门禁相关） | 缺失按 `"UNKNOWN"` | yes |
| `diffClass` | `$.diffClass`（镜像自 `$.checks.diffClass`） | advisory | 缺失按 `"error"` | no |
| `runtimeReady` | `$.checks.runtimeReady` | advisory（`runtimeRequired=false`）/blocking（`runtimeRequired=true`） | 缺失按 `null` | conditional |
| `exampleReady` | `$.checks.exampleReady` | advisory | 缺失按 `null` | no |
| `verifyGatesOk` | `$.verifyGatesOk` | blocking | 缺失按 `false` | yes |
| `consistencyOk` | `$.consistencyOk` | blocking | 缺失按 `false` | yes |
| `decisionChanged` | `$.decisionChanged`（镜像自 `$.checks.decisionChanged`） | advisory | 缺失按 `null` | no |
| `hasPrevious` | `$.hasPrevious` | advisory | 缺失按 `null` | no |

## 3. 一致性规则（release-ready vs latest）

1. `decision` 与 `exitCode` 一致：
- `$.decision=="GO"` 时 `$.exitCode` 必须为 `0`；否则应为 `1`。

2. 顶层镜像字段一致：
- `$.diffClass == $.checks.diffClass`
- `$.decisionChanged == $.checks.decisionChanged`

3. 阻断布尔位与 checks 对齐：
- `$.verifyGatesOk == ($.checks.verifyGatesRc == 0)`
- `$.consistencyOk == ($.checks.snapshotConsistencyRc == 0 && $.checks.consistencyDecision == "GO")`

4. 主结论与阻断原因一致：
- `len($.reasons)==0` 时应为 `decision=GO`；非空时应为 `decision=NO-GO`。

## 4. 缺失字段默认行为（Fail-Closed）
- 对 blocking 字段（`decision/exitCode/reasons/verifyGatesOk/consistencyOk`）：缺失按阻断处理。
- 对 advisory/info 字段（`diffClass/decisionChanged/hasPrevious/advisories`）：缺失按可解释降级，不单独阻断。

## 5. 结论
- 本对照表用于消费端校验 `release-ready-latest` 与 `release-ready` 语义一致性。
- 对当前默认放行结论影响：`no`（仅审计约束，不改现有脚本判定链路）。

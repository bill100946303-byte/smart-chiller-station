# Verify-Gates-JSON 字段映射 v1.1

## 1. 目标与边界
- 目标：在 v1 基础上补齐 `failedCount / failedGates[]` 的字段映射，形成可审计口径。
- 边界：不改字段语义，不改 `null_strategy`，仅文档化。
- 依据：
  - `scripts/chiller_ctl.sh` 中 `verify_gates_cmd --json`
  - `docs/verify-gates-json-field-map-v1.md`
  - `docs/verify-gates-latest.json`

## 2. 三列表（字段 -> 来源逻辑 -> 放行影响）

| 字段 | 来源逻辑（字段级） | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `version` | `verify_gates_cmd --json` 固定字面值 `"v1.0"` | info | 校验失败（fail-closed） | no |
| `generatedAt` | `date -u` 生成时间戳 | info | 校验失败（fail-closed） | no |
| `overall` | 由 `passedCount == totalCount(7)` 推导 `PASS/FAIL` | blocking | 缺失按 `FAIL` | yes |
| `passedCount` | `rc1..rc7` 中退出码为 `0` 的计数 | blocking | 缺失按 `0` | yes |
| `totalCount` | 固定 `7`（当前门禁总数） | blocking | 缺失按 `7`；非 `7` 视为校验失败 | yes |
| `gates[].name` | 固定门禁名集合（7 项） | info（语义索引） | 缺失/未知名视为校验失败 | yes（通过合同门禁间接阻断） |
| `gates[].ok` | 对应门禁退出码 `== 0` | blocking | 缺失按 `false` | yes |
| `gates[].exitCode` | 对应门禁原始退出码 | blocking | 缺失按 `1` | yes |
| `failedGates[]` | `(.gates[] \| select(.ok != true) \| .name)` | advisory（排障优先） | 缺失按 `[]`；建议从 `gates[]` 重算 | no（主放行仍看 `overall/exitCode`） |
| `failedCount` | `(.failedGates \| length)` | advisory（排障统计） | 缺失按 `0`；建议重算 | no |

## 3. `gates[].name` 与步骤映射（7/7）

| gates[].name | 对应步骤 |
| --- | --- |
| `acceptance-report` | `npm run check:acceptance-report` |
| `status-json` | `npm run check:status-json` |
| `release-snapshot` | `npm run check:release-snapshot` |
| `release-snapshot-index` | `npm run check:release-snapshot-index` |
| `release-snapshot-diff` | `npm run check:release-snapshot-diff` |
| `release-snapshot-consistency` | `release_snapshot_consistency_cmd --json` |
| `release-ready-brief` | `npm run check:release-ready-brief`（`RELEASE_READY_SYNC_PATH` 输入） |

## 4. v1.1 新增一致性约束
1. `failedCount == length(failedGates[])`。
2. `failedCount == totalCount - passedCount`。
3. `failedGates[]` 应是 `gates[]` 中 `ok != true` 的 `name` 子集，且不应包含未知门禁名。

## 5. 缺失行为口径（Fail-Closed 边界）
1. 阻断字段（`overall/passedCount/totalCount/gates[].ok/gates[].exitCode`）缺失时按失败处理。
2. `failedGates[]/failedCount` 缺失不单独触发阻断，但应在校验中标记为数据完整性告警，并可从 `gates[]` 重算。
3. 若 `gates` 数组长度不为 7 或缺少 `release-ready-brief`，直接失败（fail-closed）。

## 6. 结论
- v1.1 在 v1 基础上新增 `failedCount / failedGates[]` 映射，不改变既有放行判定主链路。
- 是否影响默认放行：`no`。

# Verify-Gates-JSON 字段映射 v1

## 1. 目标与边界
- 目标：固化 `verify-gates --json` 输出字段与来源步骤/门禁项映射。
- 边界：不改字段语义，不改 `null_strategy`，仅文档化。
- 依据：`scripts/chiller_ctl.sh` 的 `verify_gates_cmd --json` 与 `apps/chiller-bff/scripts/check-verify-gates.js`。

## 2. 三列表（json 字段 -> 来源步骤/门禁项 -> 放行影响）

| json 字段 | 来源步骤/门禁项 | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `version` | `verify_gates_cmd --json` 固定字面值 `"v1.0"` | info | 校验失败（fail-closed） | no |
| `generatedAt` | `date -u` 生成时间戳 | info | 校验失败（fail-closed） | no |
| `overall` | 由 `passedCount == totalCount(7)` 推导 `PASS/FAIL` | blocking | 缺失按 `FAIL` | yes |
| `passedCount` | `rc1..rc7` 中通过项计数 | blocking | 缺失按 `0` | yes |
| `totalCount` | 固定 `7`（当前门禁总数） | blocking | 缺失按 `7`；非 7 视为校验失败 | yes |
| `gates[].name` | 7 个固定门禁名（见第 3 节） | info（语义索引） | 缺失/未知名视为校验失败 | yes（通过合同门禁间接阻断） |
| `gates[].ok` | 对应门禁命令退出码是否为 0 | blocking | 缺失按 `false` | yes |
| `gates[].exitCode` | 对应门禁命令原始退出码 | blocking | 缺失按 `1` | yes |

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

## 4. 缺失行为口径（Fail-Closed）
1. 若 `docs/verify-gates-latest.json` 文件缺失：`check:verify-gates` 直接失败（fail-closed）。
2. 若任一最小字段缺失或类型不符：`check:verify-gates` 直接失败（fail-closed）。
3. 若 `gates` 数组长度不为 7 或缺少 `release-ready-brief`：直接失败（fail-closed）。

## 5. 结论
- `verify-gates --json` 是机读门禁快照，主放行语义由 `overall/passedCount/totalCount/gates[].ok` 共同决定。
- 本文档仅补映射，不改变现有门禁逻辑。
- 是否影响默认放行：`no`。

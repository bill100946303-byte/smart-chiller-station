# Verify-Gates 7/7 字段血缘与缺失行为 v1

## 1. 目标与边界
- 目标：固化 `verify-gates`（7/7）门禁项的字段血缘与缺失行为，避免发布判定口径漂移。
- 边界：不改字段语义，不改 `null_strategy`，仅文档说明。
- 依据：`scripts/chiller_ctl.sh` 的 `verify_gates_cmd` 与 bff 合同校验脚本。

## 2. 三列表（门禁项 -> 数据来源文件/命令 -> 放行影响）

| 门禁项 | 数据来源文件/命令 | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `[1/7] acceptance-report contract` | 文件：`docs/v19.2-acceptance-report.json`；命令：`npm run check:acceptance-report` | blocking | 文件缺失/JSON 非法即失败（fail-closed） | yes |
| `[2/7] status-json contract` | 命令：`npm run check:status-json`（内部调用 `chiller_ctl.sh status-json` 多模式） | blocking | 任一模式命令失败或输出非合同即失败（fail-closed） | yes |
| `[3/7] release-snapshot contract` | 文件：`docs/release-snapshot-latest.json`（通过 `RELEASE_SNAPSHOT_PATH` 指定）；命令：`npm run check:release-snapshot` | blocking | 缺文件先尝试自动生成（`release_snapshot_cmd`），仍缺/不合法则失败（fail-closed） | yes |
| `[4/7] release-snapshot-index contract` | 文件：`docs/release-snapshot-index-latest.json`（`RELEASE_SNAPSHOT_INDEX_PATH`）；命令：`npm run check:release-snapshot-index` | blocking | 缺文件先尝试自动生成（`release_snapshot_index_cmd`），仍缺/不合法则失败（fail-closed） | yes |
| `[5/7] release-snapshot-diff contract` | 文件：`docs/release-snapshot-diff-latest.json`（`RELEASE_SNAPSHOT_DIFF_PATH`）；命令：`npm run check:release-snapshot-diff` | blocking | 缺文件先尝试自动生成（`release_snapshot_diff_cmd`），仍缺/不合法则失败（fail-closed） | yes |
| `[6/7] release-snapshot consistency` | 命令：`release_snapshot_consistency_cmd --json`；输入：latest + index | blocking | latest/index 缺失或不一致即 `NO-GO`（fail-closed） | yes |
| `[7/7] release-ready-brief contract` | 文件：`docs/release-ready-sync-latest.json`（`RELEASE_READY_SYNC_PATH`）；命令：`npm run check:release-ready-brief` | blocking | 缺文件先尝试自动生成（`release_ready_sync_cmd --runtime-required=0`），仍缺/不合法则失败（fail-closed） | yes |

## 3. brief-check 专项条目（`RELEASE_READY_SYNC_PATH` 缺失）

| 条目 | 数据来源文件/命令 | 默认行为 | 结论 |
| --- | --- | --- | --- |
| `release-ready-brief-check` 且 `RELEASE_READY_SYNC_PATH` 未显式传入 | 命令：`npm run check:release-ready-brief`（脚本内部回退到 `docs/release-ready-sync-latest.json`） | 若回退路径文件缺失或非法，直接校验失败并退出非 0 | **fail-closed** |

说明：
- 在 `verify-gates` 第 7 步中已显式传入 `RELEASE_READY_SYNC_PATH`，但若目标文件仍不可用，结果同样为 fail-closed。

## 4. 结论
- `verify-gates` 7/7 全部属于阻断门禁（blocking）链路。
- 自动补生成仅是“预恢复尝试”，不改变缺失/非法时的 fail-closed 总原则。
- 对当前默认放行影响：`no`（本次仅文档补充，不改脚本逻辑）。

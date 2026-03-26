# Release-Ready-Sync-Latest 字段映射 v1

## 1. 目标与边界
- 目标：建立 `release-ready-sync-latest` 输出字段到来源字段路径的可审计映射，并标注放行影响。
- 依据：
  - `docs/release-ready-sync-latest-contract-v1.md`
  - `docs/release-ready-sync-latest.json`
  - `scripts/chiller_ctl.sh`（`release_ready_sync_latest_cmd`）
- 边界：仅文档映射，不改字段语义，不改 `null_strategy`，不新增业务字段。

## 2. 三列表（sync-latest 字段 -> 来源字段路径 -> 放行影响）

| sync-latest 字段 | 来源字段路径（`release-ready-sync-latest.json`） | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `decision` | `$.decision` | blocking | `NO-GO` | yes |
| `exitCode` | `$.exitCode` | blocking | `1` | yes |
| `inputs.strictFreshness` | `$.inputs.strictFreshness` | info | `false` | no |
| `inputs.runtimeRequired` | `$.inputs.runtimeRequired` | info | `false` | no |
| `inputs.recompute` | `$.inputs.recompute` | info | `false` | no |
| `steps.releaseReady.ok` | `$.steps.releaseReady.ok` | blocking | `false` | yes |
| `steps.releaseReady.exitCode` | `$.steps.releaseReady.exitCode` | blocking | `1` | yes |
| `steps.releaseReady.mode` | `$.steps.releaseReady.mode` | info | `"unknown"` | no |
| `steps.releaseReadyCheck.ok` | `$.steps.releaseReadyCheck.ok` | blocking | `false` | yes |
| `steps.releaseReadyCheck.exitCode` | `$.steps.releaseReadyCheck.exitCode` | blocking | `1` | yes |
| `steps.releaseReadyLatest.ok` | `$.steps.releaseReadyLatest.ok` | blocking | `false` | yes |
| `steps.releaseReadyLatest.exitCode` | `$.steps.releaseReadyLatest.exitCode` | blocking | `1` | yes |
| `releaseReady` | `$.releaseReady` | advisory | `null` | no |
| `releaseReadyLatest` | `$.releaseReadyLatest` | advisory | `null` | no |

## 3. 判定边界
1. `release-ready-sync-latest` 是只读入口：仅读取 `docs/release-ready-sync-latest.json`，不触发重算。
2. 默认放行应看 `exitCode`（硬门禁），`decision` 作为同口径可读结论。
3. `releaseReady` / `releaseReadyLatest` 主要用于追溯原因与证据，缺失时降级可观测性，不单独阻断默认放行。

## 4. 结论
- 本映射覆盖最小字段：`decision`、`exitCode`、`inputs.*`、`steps.*`、`releaseReady`、`releaseReadyLatest`。
- 是否影响默认放行：`no`（仅文档固化，无脚本逻辑变更）。

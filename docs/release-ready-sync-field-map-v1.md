# Release-Ready-Sync 字段血缘表 v1

## 1. 目标与边界
- 目标：建立 `release-ready-sync` 输出字段与来源步骤（`release-ready / check / latest`）的可审计映射。
- 依据：
  - `docs/release-ready-contract-v1.md`
  - `docs/release-ready-latest-field-map-v1.csv`
  - `scripts/chiller_ctl.sh` 中 `release_ready_sync_cmd`
- 边界：不改字段定义，仅定义字段血缘、缺失默认行为与放行影响。

## 2. 三列表（sync 输出字段 -> 来源步骤 -> 放行影响）

| sync 输出字段 | 来源步骤（release-ready/check/latest） | 放行影响（blocking/advisory/info） | 字段缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `decision` | `release-ready` 步骤退出码（`steps.releaseReady.exitCode`） | advisory（需结合 `exitCode`） | 默认 `NO-GO`（当 `readyRc!=0`） | no |
| `exitCode` | 三步聚合：`release-ready + check + latest` | blocking | 默认 `1`（任一步失败） | yes |
| `inputs.strictFreshness` | sync 入参 | info | 默认 `false` | no |
| `inputs.runtimeRequired` | sync 入参 | info | 默认 `false`（`RUNTIME_REQUIRED=0`） | no |
| `steps.releaseReady.ok` | `release-ready` 命令结果 | blocking | 默认 `false` | yes |
| `steps.releaseReady.exitCode` | `release-ready` 命令退出码 | blocking | 默认 `1` | yes |
| `steps.releaseReadyCheck.ok` | `release-ready-check` 命令结果 | blocking | 默认 `false` | yes |
| `steps.releaseReadyCheck.exitCode` | `release-ready-check` 命令退出码 | blocking | 默认 `1` | yes |
| `steps.releaseReadyLatest.ok` | `release-ready-latest --json` 命令结果 | blocking | 默认 `false` | yes |
| `steps.releaseReadyLatest.exitCode` | `release-ready-latest --json` 命令退出码 | blocking | 默认 `1` | yes |
| `releaseReady` | `release-ready --json` 输出对象（`$ready[0]`） | advisory（解释层） | 默认 `null`（无有效对象时） | no |
| `releaseReadyLatest` | `release-ready-latest --json` 输出对象（`$latest[0]`） | advisory（解释层） | 默认 `null`（无有效对象时） | no |

## 3. 判定边界（必须注意）
1. `decision` 与 `exitCode` 不是同一口径：
- `decision` 只反映 `release-ready` 这一步是否成功。
- `exitCode` 反映三步是否都成功，是 sync 放行的硬门禁。

2. 默认放行应优先使用 `exitCode`：
- `exitCode=0` 才可判定 sync 全链路通过。
- 即使 `decision=GO`，若 `check/latest` 任一步失败，`exitCode` 仍为 `1`，应阻断。

3. `releaseReady/releaseReadyLatest` 为附带快照对象：
- 用于追溯详情，不单独决定放行。

## 4. 缺失默认行为（Fail-Closed）
- 任一步骤状态字段缺失（`steps.*.ok/exitCode`）按失败处理。
- `exitCode` 缺失按 `1` 处理。
- `releaseReady` 与 `releaseReadyLatest` 缺失按 `null`，仅降级可观测性，不单独阻断。

## 5. 结论
- 本文档只固化口径，不改变脚本判定逻辑。
- 对当前默认放行影响：`no`。

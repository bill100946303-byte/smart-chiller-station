# Release-Ready-Sync-Latest 字段必填级别表 v1

## 1. 目标与边界
- 目标：为 `docs/release-ready-sync-latest.json` 固化字段必填级别（`required / nullable / optional`）。
- 输入：
  - `docs/release-ready-sync-field-map-v1.csv`
  - `docs/release-ready-sync-contract-v1.md`
  - `scripts/chiller_ctl.sh`（`release_ready_sync_cmd` 实际输出）
- 边界：不改业务字段定义，仅补字段分级、缺失默认行为、放行影响、owner。

## 2. 字段分级总表（v1）

| 字段路径 | 级别 | 来源步骤 | owner | 缺失默认行为 | 放行影响 | 是否影响默认放行 |
| --- | --- | --- | --- | --- | --- | --- |
| `$.version` | required | sync 聚合输出 | shell | 置为校验失败（fail-closed） | info | no |
| `$.generatedAt` | required | sync 聚合输出 | shell | 置为校验失败（fail-closed） | info | no |
| `$.decision` | required | `release-ready` 步骤退出码映射 | shell | 缺失按 `NO-GO` | advisory（以 `exitCode` 为准） | no |
| `$.exitCode` | required | 三步聚合（ready/check/latest） | shell | 缺失按 `1` | blocking | yes |
| `$.inputs` | required | sync 入参 | shell | 缺失按对象缺失处理 | info | no |
| `$.inputs.strictFreshness` | required | sync 入参 | shell | 缺失按 `false` | info | no |
| `$.inputs.runtimeRequired` | required | sync 入参 | shell | 缺失按 `false` | info | no |
| `$.inputs.recompute` | optional | sync 入参（运行时增强字段） | shell | 缺失按 `false` | info | no |
| `$.steps` | required | sync 聚合输出 | shell | 缺失按步骤全失败 | blocking | yes |
| `$.steps.releaseReady.ok` | required | `release-ready` | shell | 缺失按 `false` | blocking | yes |
| `$.steps.releaseReady.exitCode` | required | `release-ready` | shell | 缺失按 `1` | blocking | yes |
| `$.steps.releaseReady.mode` | optional | `release-ready` 调用模式（`read_latest/recompute`） | shell | 缺失按 `read_latest` | info | no |
| `$.steps.releaseReadyCheck.ok` | required | `release-ready-check` | bff | 缺失按 `false` | blocking | yes |
| `$.steps.releaseReadyCheck.exitCode` | required | `release-ready-check` | bff | 缺失按 `1` | blocking | yes |
| `$.steps.releaseReadyLatest.ok` | required | `release-ready-latest` | shell | 缺失按 `false` | blocking | yes |
| `$.steps.releaseReadyLatest.exitCode` | required | `release-ready-latest` | shell | 缺失按 `1` | blocking | yes |
| `$.releaseReady` | nullable | `release-ready --json` 回填对象 | shell | 缺失按 `null` | advisory | no |
| `$.releaseReadyLatest` | nullable | `release-ready-latest --json` 回填对象 | shell | 缺失按 `null` | advisory | no |

## 3. 分级判定口径
1. `required`：
- 缺失即视为数据不完整，按 fail-closed 处理；若字段属于门禁链路，默认阻断。
2. `nullable`：
- 字段必须存在，但允许值为 `null`；用于“步骤失败但结构可读”。
3. `optional`：
- 兼容增强字段，缺失不影响主门禁；消费者应容忍缺失。

## 4. 兼容说明（contract vs runtime）
- `release-ready-sync-contract-v1.md` 最小契约未强制 `inputs.recompute` 与 `steps.releaseReady.mode`。
- 脚本运行时已输出这两项，v1 将其定级为 `optional`，避免旧消费者回归。

## 5. 结论
- 本文档仅补语义分级，不改变现有脚本判定逻辑。
- 对当前默认放行影响：`no`。

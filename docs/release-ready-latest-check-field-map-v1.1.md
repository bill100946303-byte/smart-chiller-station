# Release-Ready-Latest-Check 字段映射 v1.1

## 1. 目标与边界
- 目标：在 v1 基础上强化 requiredness 口径，补齐字段缺失行为与 fail-open/fail-closed 判定。
- 边界：仅文档，不改字段语义，不改 `null_strategy`，不改现有 check 代码。
- 校验入口：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check`
  - 实际复用 `release_ready_check_cmd`，执行 `npm run check:release-ready`。

## 2. v1.1 字段表（三列表 + requiredness）

| check 字段 | 来源字段路径（优先 latest，失败时 fallback） | 放行影响 | requiredness | missing_default_behavior | fail_open_or_closed | 是否影响默认放行 | check 覆盖状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decision` | `$.decision` / fallback: `release-snapshot-latest.decision` | blocking | required | 缺失或枚举非法直接校验失败 | fail-closed | yes | enforced |
| `exitCode` | `$.exitCode` / fallback: `release-snapshot-latest.exitCode` | blocking | required | 缺失或非 `0/1` 直接校验失败 | fail-closed | yes | enforced |
| `reasons` | `$.reasons[]` / fallback: `release-snapshot-latest.reasons[]` | blocking | required | 缺失或非字符串数组直接校验失败 | fail-closed | yes | enforced |
| `diffClass` | `$.diffClass` / fallback: `release-snapshot-diff-latest.diffClass` | warning | required | 缺失或枚举非法直接校验失败 | fail-closed | no | enforced |
| `decisionChanged` | `$.decisionChanged` / fallback: `release-snapshot-diff-latest.decisionChanged` | warning | nullable | 缺失时按 `null`，仅用于解释层 | fail-open | no | partial（仅字段存在时校验类型） |
| `consistencyOk` | `$.consistencyOk` / fallback: `(release-snapshot-consistency-latest.decision=="GO") or null` | blocking | nullable | 缺失时按 `null`（语义应视为未通过） | fail-open（当前实现） | yes | not_enforced |
| `verifyGatesOk` | `$.verifyGatesOk` / fallback: `null` | blocking | nullable | 缺失时按 `null`（语义应视为未通过） | fail-open（当前实现） | yes | not_enforced |
| `source` | `check_context.loaded.source`（`latest_file` \| `fallback`） | blocking | required | **缺失即判定失败** | **fail-closed** | yes | enforced（加载失败已阻断） |
| `generatedAt` | `$.generatedAt`（latest） | warning | required | 缺失时按 `"unknown"`，用于时效解释 | fail-open（当前实现） | no | not_enforced |

## 3. 最小字段核对结果（v1.1）
已覆盖最小字段：
- `decision`
- `exitCode`
- `reasons`
- `diffClass`
- `decisionChanged`
- `consistencyOk`
- `verifyGatesOk`
- `source`
- `generatedAt`

## 4. 证据路径
- 别名分发（latest-check -> check）：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1927`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1929`
- 主 check 调用：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1603`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1607`
- 字段加载与 source 来源：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:35`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:37`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:81`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:262`
- 当前强校验字段实现：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:91`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:97`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:107`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:113`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:132`

## 5. 统计与结论
- blocking 条目数：`6`
- warning 条目数：`3`
- 是否影响默认放行：`no`（仅文档升级，无执行逻辑变更）

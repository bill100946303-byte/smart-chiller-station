# Release-Ready-Latest-Check 字段映射 v1

## 1. 目标与边界
- 目标：建立 `release-ready-latest-check` 校验字段映射，供门禁审计与值班排障复用。
- 校验入口：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check`
  - 该命令在入口层复用 `release_ready_check_cmd`，实际执行 `npm run check:release-ready`。
- 边界：仅文档，不改字段语义，不改 `null_strategy`。

## 2. 三列表（check 字段 -> 来源字段路径 -> 放行影响）

| check 字段 | 来源字段路径（优先 latest，失败时 fallback） | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 | check 覆盖状态 |
| --- | --- | --- | --- | --- | --- |
| `decision` | `$.decision`（latest）/ fallback: `release-snapshot-latest.decision` | blocking | 缺失或非法时校验失败（fail-closed） | yes | enforced |
| `exitCode` | `$.exitCode`（latest）/ fallback: `release-snapshot-latest.exitCode` | blocking | 缺失或非法时校验失败（fail-closed） | yes | enforced |
| `reasons` | `$.reasons[]`（latest）/ fallback: `release-snapshot-latest.reasons[]` | blocking | 缺失或非数组时校验失败（fail-closed） | yes | enforced |
| `advisories` | `$.advisories[]`（latest）/ fallback: `release-snapshot-latest.advisories[]` | advisory | 缺失或非数组时校验失败 | no | enforced |
| `diffClass` | `$.diffClass`（latest）/ fallback: `release-snapshot-diff-latest.diffClass` | advisory | 缺失或枚举非法时校验失败 | no | enforced |
| `verifyGatesOk` | `$.verifyGatesOk`（latest）/ fallback 固定 `null` | blocking（语义层） | 当前 check 未强校验，缺失不直接报错 | yes（语义层） | not_enforced |
| `consistencyOk` | `$.consistencyOk`（latest）/ fallback: `(release-snapshot-consistency-latest.decision=="GO")` 或 `null` | blocking（语义层） | 当前 check 未强校验，缺失不直接报错 | yes（语义层） | not_enforced |

## 3. 证据路径
- 入口别名分发：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1923`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1927`
- 主 check 调用：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1603`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh:1607`
- 字段来源与 fallback 逻辑：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:5`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:34`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:63`
- 当前强校验字段集合：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js:84`

## 4. 口径说明
1. `release-ready-latest-check` 与 `release-ready-check` 等价（同一函数、同一 npm 脚本）。
2. 本文档的放行影响按语义层定义；`verifyGatesOk/consistencyOk` 当前在 check 脚本中未强约束，属于可观测口径缺口。
3. 默认放行主链路仍以既有 release-ready 决策逻辑为准，本映射不改行为。

## 5. 结论
- 已覆盖最小字段：`decision/exitCode/reasons/advisories/diffClass/verifyGatesOk/consistencyOk`。
- 是否影响默认放行：`no`。

# Verify-Gates-Latest 字段映射 v1

## 1. 目标与边界
- 目标：建立 `verify-gates-latest` 消费字段与来源字段路径映射，供发布判定与排障复用。
- 依据：
  - `docs/verify-gates-latest-contract-v1.md`
  - `docs/verify-gates-latest.json`
  - `scripts/chiller_ctl.sh`（`verify_gates_latest_cmd`）
- 边界：只做文档映射，不改字段语义，不改 `null_strategy`。

## 2. 三列表（latest 字段 -> 来源字段路径 -> 放行影响）

| latest 字段 | 来源字段路径（`verify-gates-latest.json`） | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `overall` | `$.overall` | blocking | `FAIL` | yes |
| `passedCount` | `$.passedCount` | blocking | `0` | yes |
| `failedCount` | `$.failedCount`（若缺失可由 `length($.failedGates // [])` 重算） | advisory | `0` | no |
| `failedGates[]` | `$.failedGates[]`（若缺失可由 `$.gates[] | select(.ok != true) | .name` 重算） | advisory | `[]` | no |
| `gates[].name` | `$.gates[].name` | info（语义索引） | 缺失/未知名按校验失败处理 | yes（通过合同门禁间接阻断） |
| `gates[].ok` | `$.gates[].ok` | blocking | `false` | yes |
| `gates[].exitCode` | `$.gates[].exitCode` | blocking | `1` | yes |
| `generatedAt` | `$.generatedAt` | info | `"unknown"` | no |

## 3. 关联约束
1. `overall == "PASS"` 应与 `passedCount == 7` 一致；否则应为 `FAIL`。
2. `failedCount == length(failedGates[])`。
3. `failedGates[]` 应等于 `gates[]` 中 `ok != true` 的 `name` 集合。

## 4. 判定边界
1. `verify-gates-latest` 本身是只读命令，不执行 gate 重算。
2. 默认放行判断优先看 `overall` 与 `gates[].ok/exitCode`；`failed*` 字段主要用于解释失败原因。
3. 关键阻断字段缺失时按 fail-closed 处理（等价于 gate 未通过）。

## 5. 结论
- 本映射已覆盖最小字段：`overall/passedCount/failedCount/failedGates/gates[].name|ok|exitCode/generatedAt`。
- 是否影响默认放行：`no`（仅文档固化，无逻辑变更）。

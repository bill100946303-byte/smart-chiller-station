# Release-Ready-Brief 字段语义映射 v1

## 1. 目标与边界
- 目标：建立 `release-ready-brief` 输出字段与来源字段路径的三列表映射。
- 边界：仅文档，不新增业务字段，不改 `null_strategy`。
- 数据源：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`（只读）。

## 2. 三列表（brief 字段 -> 来源字段路径 -> 放行影响）

| brief 字段 | 来源字段路径（release-ready-sync-latest） | 放行影响（blocking/advisory/info） | 缺失默认行为 | 是否影响默认放行 |
| --- | --- | --- | --- | --- |
| `decision` | `$.decision` | blocking | `NO-GO` | yes |
| `exitCode` | `$.exitCode` | blocking | `1` | yes |
| `reasons` | `$.releaseReadyLatest.reasons`（brief 输出时回退 `[]`） | blocking（解释层） | `[]` | conditional（随 `decision/exitCode`） |
| `advisories` | `$.releaseReadyLatest.advisories`（brief 输出时回退 `[]`） | advisory | `[]` | no |
| `generatedAt` | `$.releaseReadyLatest.generatedAt`（brief 输出名：`latestGeneratedAt`） | info | `"unknown"` | no |
| `source` | 常量：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json` | info | `"unknown_source"` | no |

## 3. 字段别名说明
- `generatedAt` 是 brief 消费视角字段；在当前 `release-ready-brief --json` 输出中对应键为 `latestGeneratedAt`。
- `source` 为消费端建议补充的只读来源标识，不代表新增业务字段。

## 4. 缺失行为边界
1. 若 sync latest 文件缺失：`release-ready-brief` 命令直接失败（exit=1），需先执行 `release-ready-sync --runtime-required=0 --json`。
2. 若 `releaseReadyLatest` 子对象缺失：`reasons/advisories` 回退为空数组，`generatedAt` 回退 `"unknown"`。
3. 放行判定仍以 `decision + exitCode` 为主，`advisories/generatedAt/source` 为辅助解释字段。

## 5. 结论
- 本映射仅用于 brief 消费口径统一，不改变现有放行链路。
- 是否影响默认放行：`no`。

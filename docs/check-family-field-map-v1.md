# Check-Family 字段映射 v1

## 1. 目标与边界
- 目标：对 `docs/check-family-latest.json` 建立可审计字段映射（字段 -> 来源命令 -> 放行影响）。
- 边界：仅文档，不改字段语义，不改 `null_strategy`，不改现有校验/生成逻辑。
- 校验入口：`cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff && npm run check:check-family`

## 2. 字段映射（三列表 + requiredness）

| 汇总字段 | 来源命令 | 放行影响（blocking/advisory/info） | requiredness | 缺失默认行为 | fail-open/closed | 是否影响默认放行 |
| --- | --- | --- | --- | --- | --- | --- |
| `generatedAt` | `check-family-latest.json` 生成端写入时间（当前仓库未固化专用生成命令，`check:check-family`仅消费校验） | info | required | `"unknown"`（仅展示降级） | fail-open | no |
| `overall` | 由全量 `checks[*]` 结果聚合（`PASS/FAIL`），由生成端写入；`check:check-family`校验枚举 | blocking | required | `FAIL` | fail-closed | yes |
| `passedCount` | 由生成端统计 `count(checks[*].ok==true)`；`check:check-family`做一致性校验 | blocking | required | `0` | fail-closed | yes |
| `totalCount` | 由生成端统计 `checks.length`；`check:check-family`要求 `>=1` 且与 `checks.length` 一致 | blocking | required | `0`（并判失败） | fail-closed | yes |
| `checks[].script` | 每个检查项的命令标识（如 `check:contract`） | blocking | required | `"unknown_script"`（并判失败） | fail-closed | yes |
| `checks[].name` | 兼容别名：由 `checks[].script` 去前缀 `check:` 归一化得到（展示层字段） | advisory | optional | 从 `checks[].script` 派生；无法派生则 `"unknown"` | fail-open | no |
| `checks[].ok` | 执行 `npm run <checks[].script>` 的通过位（`exitCode==0`） | blocking | required | `false` | fail-closed | yes |
| `checks[].exitCode` | 执行 `npm run <checks[].script>` 的原始退出码 | blocking | required | `1` | fail-closed | yes |

## 3. 最小字段覆盖核对
已覆盖最小字段：
- `generatedAt`
- `overall`
- `passedCount`
- `totalCount`
- `checks[].name`
- `checks[].ok`
- `checks[].exitCode`

补充说明：
- 当前 JSON 原生字段是 `checks[].script`，`checks[].name` 为兼容/展示派生字段，不改变原始契约。

## 4. 来源命令边界
1. `check:check-family` 只做“读取+校验”，不负责生成 `check-family-latest.json`。
2. `checks[].ok/exitCode` 的来源命令是对应的 `npm run <checks[].script>`（例如 `npm run check:verify-gates`）。
3. 顶层 `overall/passedCount/totalCount` 为对 `checks[]` 执行结果的聚合字段，建议消费端以此三者为放行判定基线。

## 5. 证据路径
- `check-family` 校验逻辑：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family.js`
- `check-family` 数据文件：
  - `/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- `check:*` 脚本注册：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/package.json`

## 6. 统计与结论
- blocking 条目数：`6`
- warning 条目数：`2`（`advisory + info`）
- 是否影响默认放行：`no`（仅文档固化）

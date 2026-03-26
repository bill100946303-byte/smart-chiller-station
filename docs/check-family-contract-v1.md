# Check Family Contract v1

命令入口：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:check-family
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-check
```

脚本文件：

- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family.js`
- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/sync-check-family.js`

同步入口：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run sync:check-family
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family
```

校验目标文件：

- `/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- 可由环境变量 `CHECK_FAMILY_PATH` 覆盖

## 1. 最小字段契约

顶层字段：

- `/version`: non-empty string
- `/generatedAt`: non-empty string
- `/overall`: `"PASS" | "FAIL"`
- `/passedCount`: integer
- `/totalCount`: integer，且 `>=1`
- `/checks`: array，且至少 1 项

一致性约束：

- `/totalCount == checks.length`
- `/passedCount == count(checks[*].ok == true)`
- `/passedCount` 在 `[0,totalCount]` 范围内

`checks[*]` 字段：

- `/checks[i]/script`: non-empty string，pattern `^check:[a-z0-9-]+$`，且唯一
- `/checks[i]/ok`: boolean
- `/checks[i]/exitCode`: integer
- `/checks[i]/input`: non-empty string
- `/checks[i]/output`: non-empty string
- `/checks[i]/recompute`: boolean

必含脚本项：

- `check:contract`
- `check:verify-gates`
- `check:release-ready-consistency`
- `check:check-family-freshness`
- `check:check-family-brief`
- `check:check-family-consistency`
- `check:release-ready-latest-check`

## 2. 错误格式

统一格式：

- `<json_path>: <error_message>`

示例：

- `/overall: must be one of "PASS" | "FAIL"`
- `/checks[0]/ok: must be boolean`
- `/checks: missing required script "check:verify-gates"`

## 3. SELFTEST（3 条负例）

触发方式：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
CHECK_FAMILY_SELFTEST=1 npm run check:check-family
```

内置负例：

1. 缺失 `overall`
2. `checks` 非数组
3. `checks[0].ok` 非 boolean

通过标准：

- 输出 `Check-family self-check passed: 3/3`
- 3 条均命中路径化错误格式

## 4. 退出码语义

- `0`：正常校验通过 / self-check 3/3 通过
- `1`：正常校验失败 / self-check 失败

## 5. 边界声明

- 不改 `check:contract` 主断言
- 不改 OpenAPI 主 schema
- 本脚本为独立门禁，与 BFF 主合同门禁解耦

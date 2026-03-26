# Check Family Brief Contract v1

命令入口：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run sync:check-family-brief
npm run check:check-family-brief

/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief --json
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-latest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-check
```

脚本文件：

- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/sync-check-family-brief.js`
- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family-brief.js`

## 1. brief 目标文件

- `/Users/billchow/Documents/智慧冷冻站/docs/check-family-brief-latest.json`
- 可由 `CHECK_FAMILY_BRIEF_PATH` 覆盖

## 2. 最小字段契约

- `/version`: non-empty string
- `/generatedAt`: non-empty string
- `/overall`: `"PASS" | "FAIL"`
- `/passedCount`: non-negative integer
- `/totalCount`: integer >= 1
- `/failedCount`: non-negative integer，且满足 `passedCount + failedCount == totalCount`
- `/topFailedChecks`: string[]，最多 3 项
- `/freshness/state`: `"fresh" | "warn" | "stale" | "unknown"`
- `/freshness/ageMinutes`: integer
- `/freshness/warnAgeMin`: integer
- `/freshness/staleAgeMin`: integer
- `/freshness/maxAgeMin`: integer

## 3. 错误格式

统一格式：

- `<json_path>: <error_message>`

示例：

- `/overall: must be one of "PASS" | "FAIL"`
- `/freshness/state: must be one of "fresh" | "warn" | "stale" | "unknown"`
- `/topFailedChecks: must contain at most 3 items`

## 4. SELFTEST

触发方式：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
CHECK_FAMILY_BRIEF_SELFTEST=1 npm run check:check-family-brief
```

覆盖 3 条负例：

1. 缺失 `overall`
2. `freshness.state` 非法枚举
3. `topFailedChecks` 超过 3 项

## 5. 边界声明

- 不改 `check:contract` 主门禁
- 不改 OpenAPI 主 schema
- brief 仅用于值班快读，不替代全量 check-family 审计

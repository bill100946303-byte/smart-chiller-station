# Check Family Freshness Contract v1

命令入口：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:check-family-freshness
```

脚本文件：

- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family-freshness.js`

校验目标文件：

- `/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- 可由 `CHECK_FAMILY_PATH` 覆盖

## 1. Freshness 校验规则

必校验字段：

- `/generatedAt`: non-empty string，且可被 `Date.parse` 解析

年龄阈值：

- 环境变量 `MAX_AGE_MIN` 控制，默认 `60`
- `MAX_AGE_MIN` 必须是非负整数字符串

判定：

- `ageMin < 0`：失败（时间在未来）
- `ageMin > MAX_AGE_MIN`：失败（数据过旧）
- 否则通过

通过输出示例：

- `Check-family-freshness validation passed: <path> (ageMin=<n>, maxAgeMin=<m>)`

## 2. 错误格式

统一格式：

- `<json_path>: <error_message>`

示例：

- `/generatedAt: must be valid ISO datetime`
- `/generatedAt: age 125m exceeds MAX_AGE_MIN=60`
- `/config/MAX_AGE_MIN: must be non-negative integer string`

## 3. SELFTEST（3 条）

触发方式：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
CHECK_FAMILY_FRESHNESS_SELFTEST=1 npm run check:check-family-freshness
```

内置负例：

1. `generatedAt` 缺失
2. `generatedAt` 非法时间字符串
3. `generatedAt` 超过阈值（stale）

通过标准：

- 输出 `Check-family-freshness self-check passed: 3/3`
- 每条负例命中路径化错误

## 4. 退出码

- `0`：正常校验通过 / selftest 通过
- `1`：正常校验失败 / selftest 失败

## 5. 边界声明

- 不改 `check:contract` 主断言
- 不改 OpenAPI 主 schema
- 该门禁为独立 freshness 检查

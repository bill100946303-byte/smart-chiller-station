# check-family-consistency Contract v1

## 1. 目标

校验 `check-family` 与 `check-family-brief` 两份 latest JSON 的语义一致性，防止“brief 看起来通过但 family 实际失败”的误判。

## 2. 命令入口

- npm：
  - `npm run check:check-family-consistency`
- 控制脚本：
  - `./scripts/chiller_ctl.sh check-family-consistency-check`
  - `./scripts/chiller_ctl.sh check-family-consistency-check --selftest`

## 3. 输入文件

- family：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- brief：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-brief-latest.json`

支持环境变量覆盖：

- `CHECK_FAMILY_PATH`
- `CHECK_FAMILY_BRIEF_PATH`

## 4. 最小一致性规则

1. `brief.overall == family.overall`
2. `brief.passedCount == family.passedCount`
3. `brief.totalCount == family.totalCount`
4. `brief.failedCount == family.totalCount - family.passedCount`
5. `brief.topFailedChecks[*]` 必须来自 `family.checks[*].script` 且对应 `ok=false`
6. 当 `family.overall=PASS` 时：
   - `brief.failedCount` 必须为 `0`
   - `brief.topFailedChecks` 必须为空数组

## 5. 错误格式

失败输出统一：

`<json_path>: <error_message>`

示例：

- `/brief/passedCount: must equal family.passedCount`
- `/brief/topFailedChecks[0]: must reference a failed script from family.checks`

## 6. 自检模式

开启：

`CHECK_FAMILY_CONSISTENCY_SELFTEST=1 npm run check:check-family-consistency`

最小覆盖（3 条）：

1. family 缺失 `overall`
2. brief 与 family `passedCount` 不一致
3. brief 的 `topFailedChecks` 引用未知脚本

## 7. 门禁边界

- 该门禁为 `check-family` 家族独立门禁。
- 不影响 `check:contract`。
- 不影响 OpenAPI 主 schema。

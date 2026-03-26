# Check-Family-Consistency Regression v1

## 1) 正常模式

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:check-family-consistency
```

日志摘要：

- `check:check-family-consistency` 已触发 `node scripts/check-check-family-consistency.js`
- 校验通过：`Check-family-consistency validation passed: /Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json <=> /Users/billchow/Documents/智慧冷冻站/docs/check-family-brief-latest.json`

结果：`PASS`

## 2) Selftest 模式

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
CHECK_FAMILY_CONSISTENCY_SELFTEST=1 npm run check:check-family-consistency
```

日志摘要：

- 启动：`Check-family-consistency self-check mode enabled`
- 3/3 命中路径化错误：
- `selfcheck.missing-family-overall: /family/overall: must be string`
- `selfcheck.mismatch-passed-count: /brief/passedCount: must equal family.passedCount`
- `selfcheck.unknown-top-failed-script: /brief/topFailedChecks[0]: must reference a failed script from family.checks`
- 通过：`Check-family-consistency self-check passed: 3/3`

结果：`PASS`

## 3) 解耦声明

- 本门禁是 `check-family` 家族独立契约校验，不属于 `check:contract` 主门禁链路。
- 不修改 OpenAPI 主 schema。
- 失败/通过仅影响 check-family 运维契约视图，不改变 BFF 主合同判定逻辑。

# v19.2 验收报告合同门禁（v1）

## 目标
为 `/Users/billchow/Documents/智慧冷冻站/docs/v19.2-acceptance-report.json` 提供结构化校验，防止报告字段漂移。

## 命令
```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:acceptance-report
```

可选：指定报告路径
```bash
ACCEPTANCE_REPORT_PATH=/abs/path/to/report.json npm run check:acceptance-report
```

自检模式（负例路径校验）
```bash
ACCEPTANCE_REPORT_SELFTEST=1 npm run check:acceptance-report
```
- 自检会基于当前报告构造最小负例，验证报错路径持续输出为 `<json_path>: <error_message>`。
- 当前覆盖：
  - 缺少 `entry.mode`
  - `endpoints.overview.status` 非 3 位数字
  - `badge.globalPass` 非 boolean

## 校验范围（最小必填）
- 顶层：`version` `generatedAt` `siteId` `overallPass`
- 顶层可选：`runtimeUnavailable`（存在时必须为 boolean）
- `entry`：`mode` `port3001Ok`
- `contract`：`ok`
- `stack`：`ok` `legacyHealthStatus` `bffHealthStatus` `frontendStatus`
- `readiness`：`nonDegradedReady`
- `badge`：`globalPass`
- `endpoints`：
  - `overview.status/overall/ok`
  - `trends.status/overall/ok`
  - `anomalies.status/overall/ok`
  - `recommendations.status/overall/ok`

## 报错格式
统一为：
`<json_path>: <error_message>`

示例：
`/endpoints.overview.status: must be 3-digit HTTP status string`

## 边界
- 不修改 `bff-v1.yaml` 主合同。
- 不影响 `npm run check:contract` 的现有强门禁。
- 仅校验验收报告结构，不介入业务规则判定逻辑。

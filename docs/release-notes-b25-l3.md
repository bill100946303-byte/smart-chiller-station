# B25 L3 发布说明

- 更新时间（UTC）：2026-04-01T21:05:00Z
- 更新时间（Asia/Shanghai）：2026-04-02 05:05:00
- 发布范围：`/dashboard`、`/optimize-demo`、BFF `site-scoped realtime context`

## 变更提交

1. `4e347f4 feat(optimize): add L3 history benchmark draft and smoke check`
2. `dc9e9ea fix(bff): prefer runtime project key for site-scoped realtime context`
3. `9dab439 feat(dashboard): fallback to latest usable overview snapshot on data gaps`
4. `18e9aae feat(acceptance): add b25 ui smoke automation and source observability`

## 发布门禁

- 命令：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --runtime-required=0 --json`
- 结果：`decision=GO`，`exitCode=0`，`verifyGatesOk=true`，`consistencyOk=true`
- 备注：存在 advisory `runtime_not_ready_optional`，不阻塞本次治理态发布

## 验收产物

- B25 smoke JSON：`/Users/billchow/Documents/智慧冷冻站/docs/b25-l3-smoke-latest.json`
- B25 smoke Markdown：`/Users/billchow/Documents/智慧冷冻站/docs/b25-l3-smoke-latest.md`
- release-ready 快照：
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.md`

## 守护方案（24h）

- 一键守护命令：
  - `cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff`
  - `npm run check:b25-ui-smoke:guard -- --rounds=24 --interval-minutes=60`
- 结果目录：`/Users/billchow/Documents/智慧冷冻站/docs/b25-smoke-guard`
- 最新日志：`/Users/billchow/Documents/智慧冷冻站/docs/b25-smoke-guard-latest.log`

## 当前结论

- 当前版本满足“治理态可发布”条件。
- Dashboard 已避免“全 --”失明态，Optimize Demo 维持 `501 + context-backed draft` 边界。

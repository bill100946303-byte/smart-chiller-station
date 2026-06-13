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
- 默认行为（已升级）：
  - `strict-ui=1`（严格 UI 冒烟）
  - `suite=1`（先跑 `optimize-l3-smoke` 再跑 `b25-ui-smoke`）
  - `app-base-url=auto`（自动探测 `3006/3001`）
- 可选降级参数：
  - `--strict-ui=0`：CDP 不可用时允许跳过 UI 严格校验
  - `--suite=0`：仅跑 `b25-ui-smoke`
  - `--app-base-url=http://127.0.0.1:3001`：固定前端地址
- 结果目录：`/Users/billchow/Documents/智慧冷冻站/docs/b25-smoke-guard`
- 最新日志：`/Users/billchow/Documents/智慧冷冻站/docs/b25-smoke-guard-latest.log`

## 当前结论

- 当前版本满足“治理态可发布”条件。
- Dashboard 已避免“全 --”失明态，Optimize Demo 维持 `501 + context-backed draft` 边界。

## 2026-04-09 更新

- `tower-approach` 治理态执行链路已继续推进：
  - `towerApproachAdvisor` 执行前检查卡已在 BFF 与 `/optimize-demo` 落地
  - `tower-approach` 专用执行记录、审批/回退、dispatch mode 已落地
- 验收更新：
  - `npm --prefix apps/chiller-bff test`：`75/75` 通过
  - `node scripts/check-contract.js`（在 `apps/chiller-bff` 目录执行）：通过
  - 合同 example 数已更新为 `16`
  - `npm --prefix apps/chiller-shell-v1 run build`：通过
- 当前未完成：
  - 真实 optimize engine
  - `tower-approach` 目标值到 legacy 具体控制点位的映射契约
  - 基于上述映射的真实 dispatch endpoint 现场 shadow 联调

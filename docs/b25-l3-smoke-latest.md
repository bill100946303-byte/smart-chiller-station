# B25 L3 Smoke 验收清单（最新）

## 2026-06-08 本轮补充

- `POST /bff/v1/sites/btwentyfive/optimize` 已从历史 `501 NOT_IMPLEMENTED` 切换为 `200 OK` + `code=OK` + `sourceStatus.optimizeEngine.reasonCode=advisor_result_ready`。
- `towerApproachAdvisor` 已返回冷却塔 Approach AI 闭环结构：`targetApproachC`、`targetTcwsC`、`advisorResult`、`executionMode`、`dispatchReady`、`blockers/warnings`。
- 本轮本地验证：`BFF_BASE_URL=http://127.0.0.1:8792 npm run check:optimize-l3-smoke` 通过 `4/4`；`npm run check:optimize-smoke-suite` 通过 `2/2`。
- UI 子检查在本轮非严格冒烟中因历史 CDP `127.0.0.1:61392` 不可用按脚本设计跳过；API 与前端构建已通过。

- 验收时间（UTC）：2026-04-04T18:39:17.068Z
- 验收时间（Asia/Shanghai）：2026-04-05 02:39:17
- 目标站点：`btwentyfive`
- 环境：`BFF http://127.0.0.1:8788`、`APP http://127.0.0.1:3004`、`CDP http://127.0.0.1:61392/json/list`
- 模式：`B25_UI_SMOKE_STRICT=1`

## Checklist

- [x] `dashboard/overview` 返回 `200`，并有可用核心指标（非全空）
- [x] `POST /bff/v1/sites/btwentyfive/optimize` 仍返回 `501 NOT_IMPLEMENTED`
- [x] `optimize.details.schemes.length === 3`
- [x] UI 严格验收（CDP 可达，三段页面联动 + 执行台全链路通过）
- [x] `towerApproach` live guardrail 已可读取 `minCondenserInletTempC=30.2`
- [x] `check-optimize-smoke-suite` 在远端联调口径下 `3/3` 全通过

## 关键观测

- API：`sourceOverall=ok`，`currentCop=4.9`，`totalPowerKw=711.6`，`totalCoolingCapacity=3813.4`
- Optimize 边界：`NOT_IMPLEMENTED` 仍保持，`schemeCount=3`
- UI：`/dashboard`、`/optimize-demo`、`/trend-analysis` 严格验收通过；执行台状态机 `pending -> approved -> rolled_back` 通过
- 执行台样本：`opx-btwentyfive-1775327974076-es4l63`
- 运行阈值：`apps/chiller-bff/.local/admin.sqlite` 已写入 `btwentyfive.ruleThresholds.towerApproach.minCondenserInletTempC=30.2`
- 2026-04-05 补充：长期运行的 `8788` 已重启并加载最新代码；`B25_ENSURE_RUNTIME_CONFIG=1 TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C=30.2 node apps/chiller-bff/scripts/check-optimize-smoke-suite.js` 在 `APP 3004`、`CDP 61392` 下通过
- 2026-04-08 补充：`check-b25-ui-smoke` 支持专用审批按钮校验开关
  - `B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1` 时，远端只读联调会输出 `towerApproachFlow=ui-disabled-read-only`（可观测跳过）
  - `B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1` 时，当前只读联调按预期失败（`READ_ONLY_MODE`），用于约束“可写环境必跑”
- 2026-04-08 可写验收：`BFF 8787 + APP 3001` 下执行
  - `B25_UI_SMOKE_STRICT=1 B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1 B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1 ... check-b25-ui-smoke.js` 通过
  - 结果命中：`towerApproachFlow=seeded-dedicated-controls`、`towerApproachControlsVerified=true`、`approve-tower-approach`、`rollback-tower-approach`
  - 对应 suite：`check-optimize-smoke-suite.js` 在同口径下 `3/3` 通过
- 2026-04-08 执行适配器补充：`tower-approach` 审批/回退已接入 `off/shadow/enforced` 三模式调度回执链路
  - `enforced` 且未配置 endpoint：审批前阻断（`502 OPTIMIZE_EXECUTION_DISPATCH_FAILED`），状态保持 `pending_approval`
  - `shadow` 且未配置 endpoint：审批/回退继续，`execution.dispatch.lastApprove/lastRollback` 记录失败回执
  - `scripts/ensure-site-runtime-config.js` 已支持注入 `towerApproachDispatchMode` 与 approve/rollback endpoint
  - 默认 `off`，不改变当前治理边界行为

## 结论

- 当前 L3 链路 API + UI 严格冒烟均通过，`towerApproach` guardrail 实机校核也已通过。
- 2026-04 历史口径下 `/optimize` 仍保持治理边界（`501 + context-backed draft`）；2026-06-08 本轮已升级为 `200/OK` 结构化 AI advisor 结果，执行仍受权限、模式、点位映射和 PLC 安全边界治理。
- 当前可继续进入 L4（接近度执行策略）功能迭代；执行适配器链路已就绪，按站点逐步从 `off -> shadow -> enforced` 推进。

# STAGE_REPORT_CURRENT

## 1. 当前阶段总览

当前主仓库已完成一轮“治理式融合 + 页面迁移”主线，核心结论如下：

- 已正式签收页面：`/dashboard`、`/login`、`/alarms`、`/devices`、`/system-overview`、`/scene-control`、`/trend-analysis`
- 已完成二期签收能力：`devices/tree`、`devices/{deviceId}`
- 可演示但暂不正式签收：`/optimize-demo`
- 已落地治理态支撑入口：`/projects`
  - 用于项目选择与目标页回跳
  - 页面 URL 已统一表达 `siteId`
  - 当前仍定位为治理态入口，不作为新业务页签收
- 治理层已落地：
  - `ARCHITECTURE_CURRENT.md`
  - `FIELD_MAPPING_CURRENT.md`
  - `API_SURFACE_CURRENT.md`
  - `THREAD_RULES_CURRENT.md`
  - `FUSION_NEXT_STEPS_CURRENT.md`

## 2. 已正式签收成果

### 2.1 首页 Dashboard

- 路由：`/dashboard`
- 状态：已正式签收
- 已稳定能力：
  - `overview + trends + anomalies + recommendations` 聚合入口
  - KPI 摘要
  - 异常看板
  - 建议区与规则诊断
  - 趋势区诚实降级表达
### 2.2 告警页

- 路由：`/alarms`
- 状态：已正式签收
- 已稳定能力：
  - 告警摘要
  - 最近告警流
  - 真实列表
  - 四档 severity 收口
  - stale / degraded / empty / filtered empty 表达

### 2.3 设备页

- 路由：`/devices`
- 状态：已正式签收
- 已稳定能力：
  - 摘要卡
  - 楼层与分组骨架
  - 真实列表
  - type / floor / page / pageSize 过滤
  - 页面级 sourceStatus / freshness

### 2.4 设备页二期

- 状态：已正式签收
- 已稳定能力：
  - `devices/tree`
  - `devices/{deviceId}`
  - 右侧详情首屏
  - detail runtime 链路
  - 场景页 -> 设备页深链接承接

### 2.5 场景控制页

- 路由：`/scene-control`
- 状态：已正式签收
- 已稳定能力：
  - 2D / 3D 切换
  - 10 / 11 楼切换
  - legacy scene iframe 嵌入
  - quick access / reprobe
  - 同楼层设备上下文
  - 场景页到设备页的深链接流

### 2.6 系统总览页

- 路由：`/system-overview`
- 状态：已正式签收
- 已稳定能力：
  - `overview + topology + recommendations` 真实聚合
  - 系统骨架节点总览
  - 现态 COP / 功率 / 设备规模摘要
- 规则诊断与建议区

### 2.7 登录页

- 路由：`/login`
- 状态：已正式签收
- 已稳定能力：
  - 真实 legacy `/user/login` 承接
  - 受保护路由跳转
  - 登录后回跳原始页面
  - 本地 session 保存与退出清理
  - 来源状态统一表达

### 2.8 趋势页

- 路由：`/trend-analysis`
- 状态：已正式签收
- 已稳定能力：
  - `dashboard/overview + dashboard/trends` 真实消费
  - `24h / 7d` 范围切换
  - `totalPowerKw / currentCop / chilledDeltaT / coolingDeltaT` 多序列趋势
  - stats / freshness / sourceStatus 真实表达
  - 降级、陈旧、空态和指标筛选

## 3. 当前可演示成果

### 3.1 Optimize Demo

- 路由：`/optimize-demo`
- 状态：可演示，暂不正式签收
- 现状：
  - `/optimize` 草案接口可用
  - demo 页可提交并展示 context-backed draft
  - `L3.6` 已落地：执行台已切换 SQLite 持久化，审批/回退权限与审计日志闭环完成
  - `L4 phase 1` 已落地：`towerApproachAdvisor` 接近度执行前检查卡已接入 BFF draft 与 `/optimize-demo` 展示
  - `L4 phase 2` 已落地：`tower-approach` 专用执行台、审批/回退按钮、治理态调度适配器与回执持久化已打通
  - 管理态 runtime-config 已支持写入 `ruleThresholds.towerApproach.minCondenserInletTempC`
  - 管理态 runtime-config 已支持写入 `towerApproachDispatchMode` 与 dispatch endpoint
  - `scripts/ensure-site-runtime-config.js` 可向当前 `adminDbFile` 注入站点运行阈值，供 B25 smoke 与 live guardrail 校验复用
  - 真实 optimize engine 尚未接入
  - 真实 control endpoint 尚未完成正式联调，当前 dispatch 仍主要停留在 `off/shadow/enforced` 治理态能力
  - 当前 AI 优化能力分层定位：`L3（评审与草案）`
  - 冷却塔接近度智能调节定位：`L4（执行层能力）`
  - 当前完成度：`L4 phase 1/2 completed, live dispatch integration pending`
  - 接近度 L4 方案蓝图：`docs/COOLING_TOWER_APPROACH_L4_PLAN_CURRENT.md`

## 4. 已正式纳管接口

当前已进入主合同与 `check:contract` 的关键接口：

- `/bff/v1/sites/{siteId}/dashboard/overview`
- `/bff/v1/sites/{siteId}/dashboard/trends`
- `/bff/v1/sites/{siteId}/anomalies/summary`
- `/bff/v1/sites/{siteId}/anomalies/list`
- `/bff/v1/sites/{siteId}/devices/list`
- `/bff/v1/sites/{siteId}/devices/tree`
- `/bff/v1/sites/{siteId}/devices/{deviceId}`
- `/bff/v1/sites/{siteId}/system/topology`
- `/bff/v1/sites/{siteId}/system/diagram`
- `/bff/v1/sites/{siteId}/recommendations`
- `/bff/v1/sites/{siteId}/optimize`
- `/bff/v1/sites/{siteId}/optimize/executions`
- `/bff/v1/sites/{siteId}/optimize/executions/{executionId}/approve`
- `/bff/v1/sites/{siteId}/optimize/executions/{executionId}/rollback`
- `/bff/v1/sites/{siteId}/optimize/tower-approach/executions`
- `/bff/v1/sites/{siteId}/optimize/tower-approach/executions/{executionId}/approve`
- `/bff/v1/sites/{siteId}/optimize/tower-approach/executions/{executionId}/rollback`

当前主门禁状态：

- `npm run check:contract`：通过
- 当前校验 example 数：`16`

## 5. 当前维护态冒烟结果

2026-03-24 维护态冒烟结论：

- `./scripts/chiller_ctl.sh runtime-status`：`runtimeChain=ok`
- `GET /healthz`：`200`
- `GET /dashboard/overview`：`200`
- `GET /dashboard/trends?range=24h`：`200`
- `GET /anomalies/list?page=1&pageSize=5`：`200`
- `GET /devices/list?page=1&pageSize=5`：`200`
- `GET /system/diagram?layoutMode=auto&scope=full`：`200`
- `GET /recommendations`：`200`
- Playwright 实际导航 `/dashboard`：页面可达，标题为 `Chiller Shell V1`

2026-04-03 B25 L3 冒烟补充（远端联调口径）：

- `check-b25-ui-smoke` 已支持自动优选可用 BFF（默认优先 `8788`，回退 `8787`）
- 严格模式 `B25_UI_SMOKE_STRICT=1` 已通过：`/dashboard`、`/optimize-demo`、`/trend-analysis` 三页联动验收通过
- 可选 guardrail 校验：`B25_ENSURE_RUNTIME_CONFIG=1 TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C=<value> node apps/chiller-bff/scripts/check-optimize-smoke-suite.js`
- `dashboard/overview`：`200`，`currentCop=7.4`，`totalPowerKw=1179.6`
- `POST /optimize`：`501 NOT_IMPLEMENTED`，`schemes.length=3`
- 执行台状态机实测通过：`pending_approval -> approved -> rolled_back`

2026-04-05 B25 L4 guardrail 补充（运行阈值口径）：

- 已向当前 `adminDbFile=/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/.local/admin.sqlite` 写入 `btwentyfive.ruleThresholds.towerApproach.minCondenserInletTempC=30.2`
- 重启长期运行的 `BFF http://127.0.0.1:8788` 后，`SITE_ID=btwentyfive BFF_BASE_URL=http://127.0.0.1:8788 TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C=30.2 node apps/chiller-bff/scripts/check-optimize-l3-smoke.js`：通过
- 进一步实测：`B25_ENSURE_RUNTIME_CONFIG=1 B25_UI_SMOKE_STRICT=1 SITE_ID=btwentyfive BFF_BASE_URL=http://127.0.0.1:8788 APP_BASE_URL=http://127.0.0.1:3004 CDP_LIST_URL=http://127.0.0.1:61392/json/list TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C=30.2 node apps/chiller-bff/scripts/check-optimize-smoke-suite.js`：`3/3` 通过
- 结论：runtime-config -> `towerApproach` guardrail 合并链路已打通，且 `8788` 远端联调严格 smoke 已恢复通过

2026-04-08 B25 L4 专用审批按钮校验补充（执行台拆栏口径）：

- `check-b25-ui-smoke` 新增专用校验开关：
  - `B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1`：尝试验证 `approve-tower-approach / rollback-tower-approach`
  - `B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1`：强制要求可写环境，若命中 `READ_ONLY_MODE` 直接失败
- `check-optimize-smoke-suite` 新增可选子项：当 `B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1` 时，追加 `b25-ui-smoke-tower-approach-controls`
- 远端只读联调实测：
  - `B25_UI_SMOKE_STRICT=1 ... check-optimize-smoke-suite.js`：`2/2` 通过（基线）
  - `B25_UI_SMOKE_STRICT=1 B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1 ... check-optimize-smoke-suite.js`：`3/3` 通过，第三项为 `towerApproachFlow=ui-disabled-read-only`
  - `B25_UI_SMOKE_STRICT=1 B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1 B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1 ... check-b25-ui-smoke.js`：按预期失败，错误为 `READ_ONLY_MODE`
- 结论：`tower-approach` 专用按钮校验已形成“基线通过 + 可写强约束”双口径，可直接用于后续可写环境验收

2026-04-08 B25 L4 专用审批按钮可写验收（本地可写链路）：

- 可写链路：`BFF http://127.0.0.1:8787`（`readOnlyMode=false`） + `APP http://127.0.0.1:3001`
- 严格校验命令：
  - `B25_UI_SMOKE_STRICT=1 B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1 B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1 SITE_ID=btwentyfive BFF_BASE_URL=http://127.0.0.1:8787 APP_BASE_URL=http://127.0.0.1:3001 CDP_LIST_URL=http://127.0.0.1:61392/json/list node apps/chiller-bff/scripts/check-b25-ui-smoke.js`
- 关键结果：
  - `towerApproachFlow=seeded-dedicated-controls`
  - `towerApproachControlsVerified=true`
  - `towerApproachApproveAction=approve-tower-approach`
  - `towerApproachRollbackAction=rollback-tower-approach`
- suite 验证：
  - `B25_UI_SMOKE_STRICT=1 B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS=1 B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS=1 ... node apps/chiller-bff/scripts/check-optimize-smoke-suite.js`：`3/3` 通过
- 推荐脚本入口（`apps/chiller-bff/package.json`）：
  - `npm run check:b25-ui-smoke:controls:required`
  - `npm run check:optimize-smoke-suite:controls:required`
- 结论：`tower-approach` 专用按钮在可写环境的提交/审批/回退闭环已完成严格验收

2026-04-08 B25 L4 执行适配器链路补充（审批后调度）：

- 新增执行适配器：`apps/chiller-bff/src/services/optimizeExecutionDispatchService.js`
- 审批/回退路由已接入调度回执透传与持久化（`execution.dispatch.lastApprove/lastRollback`）：
  - `POST /bff/v1/sites/:siteId/optimize/tower-approach/executions/:executionId/approve`
  - `POST /bff/v1/sites/:siteId/optimize/tower-approach/executions/:executionId/rollback`
  - 通用路由同样对 `tower-approach` 生效
- 调度模式（站点 runtime-config `featureFlags`）：
  - `towerApproachDispatchMode=off`：默认关闭，仅治理态审批链路
  - `towerApproachDispatchMode=shadow`：调度失败不阻断审批/回退，但保留失败回执
  - `towerApproachDispatchMode=enforced`：调度失败直接阻断（`502 OPTIMIZE_EXECUTION_DISPATCH_FAILED`）
- 调度地址（按需配置）：
  - `towerApproachDispatchApproveEndpoint`
  - `towerApproachDispatchRollbackEndpoint`
  - 或 `towerApproachDispatchEndpoint`（approve/rollback 共用）
- 运行配置注入（`apps/chiller-bff/scripts/ensure-site-runtime-config.js`）：
  - 快捷脚本：
    - `npm --prefix apps/chiller-bff run admin:ensure-runtime-config:dispatch:off`
    - `npm --prefix apps/chiller-bff run admin:ensure-runtime-config:dispatch:shadow`
    - `npm --prefix apps/chiller-bff run admin:ensure-runtime-config:dispatch:enforced`
  - 带 endpoint 示例：
    - `env TOWER_APPROACH_DISPATCH_MODE=shadow TOWER_APPROACH_DISPATCH_APPROVE_ENDPOINT=/zsqy/control/{siteId}/towerApproach/approve TOWER_APPROACH_DISPATCH_ROLLBACK_ENDPOINT=/zsqy/control/{siteId}/towerApproach/rollback npm --prefix apps/chiller-bff run admin:ensure-runtime-config`
- 单测结果：
  - `node --test apps/chiller-bff/src/services/optimizeExecutionService.test.js apps/chiller-bff/src/routes/optimizeExecutionRoute.test.js`：`14/14` 通过
  - `npm --prefix apps/chiller-bff test`：`67/67` 通过

2026-04-09 文档与验收收口补充：

- `npm --prefix apps/chiller-bff test`：`75/75` 通过
- `node scripts/check-contract.js`（在 `apps/chiller-bff` 目录执行）：通过
  - 当前合同 example 数：`16`
- `npm --prefix apps/chiller-shell-v1 run build`：通过
- `npm --prefix apps/chiller-bff run check:optimize-smoke-suite:controls:required`：
  - 在当前 Codex 沙箱内失败
  - 失败原因为本地 `127.0.0.1:8787` 访问被 `EPERM` 拦截
  - 该结果属于执行环境限制，不能直接判定为业务回归
- 真实 dispatch 联调阻塞点补充：
  - 仓库内目前能明确确认的 legacy 控制接口是 `GET /zsqy/qstag/{siteId}/doimplements`
  - 该接口要求 `userId/appId/drTypeId/drId/msg` 等设备级上下文
  - 当前 `tower-approach` 执行记录只保存策略值（`targetApproachC/targetTcwsC/rollbackTarget`）
  - 结论：第 3 步真正待补的是“控制点位映射契约”，不是单纯补一个 dispatch URL
  - 映射模板已补：`docs/TOWER_APPROACH_CONTROL_MAPPING_TEMPLATE_CURRENT.md`

2026-04-11 B25 数据口径收口补充（页面级 upstream 判定）：

- 本地错接已基本收口：
  - `work-orders / knowledge -> 140btwentyfive`
  - `imbalance curve -> appId=140`
  - `imbalance table -> path=140btwentyfive + appId=140`
  - `environment` 已通过传感器兼容链恢复并收窄到 `12` 条代理点
- 验证结果：
  - 定向测试 `25/25` 通过
  - `npm run build` 通过
  - 页面级 probe 报告已生成：`docs/b25-upstream-data-latest.json`
- 当前剩余问题已从“本地错接”收敛为“upstream 真空/字段退化”：
  - `work-orders` 多路探测均空
  - `knowledge` 主列表、旧列表、按类型探测均空
  - `imbalance table` 旧 path `140` 返回 `500`，兼容 path 返回 `200` 但缺 `drName/drTypeName`
- 结论：
  - 当前不要再扩大 BFF 业务 fallback
  - `work-orders / knowledge` 按 upstream 真实空处理
  - `imbalance` 按 upstream 数据质量问题升级

## 6. 当前保留治理项

### 6.1 Optimize 真实执行联调未完成

- 当前已完成治理态与可演示态能力：
  - `towerApproachAdvisor` 只读评审
  - `tower-approach` 执行台持久化
  - 审批 / 回退 / 调度回执
- 当前未完成：
  - 真实 optimize engine
  - `targetApproachC/targetTcwsC -> drTypeId/drId/tagName/msg` 的控制点位映射
  - 基于真实控制点位映射的 legacy/control endpoint 联调与现场口径确认

## 7. 当前阶段结论

当前项目已从“新壳搭建”推进到“多页面正式签收 + 治理层固定 + L4 治理态半自动链路已落地”的稳定阶段。

最重要的盘面是：

- 页面迁移主线已经跑通
- 治理层已经固化
- 继续推进时，不应再推倒重来

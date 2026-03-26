# 当前仓库架构与融合边界

## 1. 目标与口径

本文只描述当前仓库的真实落地架构，用于把 GPT-5.4 的“融合建议”改写成适配现状的治理方案。

核心口径：

- 当前项目主轴已经是 `Node + Express BFF + React Shell + legacy 承接 + scripts + docs`
- 当前阶段做的是治理式融合，不是重写式融合
- 目标是继续收口现有能力，而不是新开一套平行主系统

## 2. 当前仓库真实分层

### 2.1 `apps/chiller-bff`

定位：当前标准接口层，也是 legacy 数据承接层。

已确认的真实结构：

- `src/routes/v1.js`
  - 已提供 `dashboard/overview`
  - 已提供 `dashboard/trends`
  - 已提供 `anomalies/summary`
  - 已提供 `anomalies/list`
  - 已提供 `devices/list`
  - 已提供 `devices/tree`
  - 已提供 `devices/{deviceId}`
  - 已提供 `system/topology`
  - 已提供 `recommendations`
- `src/services/*.js`
  - 已形成按领域拆分的聚合服务
  - 已有 `dashboardService / anomalyService / deviceService / topologyService / recommendationService`
  - 已有通用能力 `freshness / fieldPolicyService / sourceStatusService / ruleEngineService`
- `src/adapters/*.js`
  - 已把 legacy 接口访问隔离在 adapter 层
  - 当前主要是 `legacyAlarmAdapter / legacyDeviceAdapter / legacyEnergyAdapter`
- `scripts/*.js`
  - 已承接 release-ready、release-command-center、check-family 等治理链路
  - 说明 BFF 不只是页面接口层，也承接了项目当前的运行态治理与门禁产物生成

当前判断：

- `chiller-bff` 已经是现有仓库的“融合核心”
- 后续统一 service 的抽象，应继续在这里做增量收口，而不是新建平行后端主体

### 2.2 `apps/chiller-shell-v1`

定位：当前新壳前端，承接已迁移页面。

已确认的真实结构：

- 路由入口：
  - `/dashboard`
  - `/trend-analysis`
  - `/alarms`
  - `/devices`
  - `/system-overview`
- 页面实现：
  - `DashboardPage.tsx`
  - `TrendAnalysisPage.tsx`
  - `AlarmPage.tsx`
  - `DeviceOverviewPage.tsx`
  - `SystemOverviewPage.tsx`
- `src/services/bffClient.ts`
  - 已统一消费 BFF 路由
- `public/ui-badge-state-v1.8.json`
  - 已被验收与值班链路直接消费

当前判断：

- 新壳已经不是演示骨架，而是生产化迁移载体
- 页面迁移应继续在 `src/pages` 内推进，不应再新造一个 `web/` 平行目录
- 当前已形成真实入口页体系：
  - `/login`
  - `/dashboard`
  - `/alarms`
  - `/devices`
  - `/system-overview`
  - `/scene-control`

### 2.3 legacy 承接

定位：当前仍是数据与旧静态资产来源，不是本轮要被替换掉的对象。

已确认的真实承接方式：

- `chiller-bff` 通过 adapter 直接请求 `http://127.0.0.1:8098`
- `scripts/manage_3001_entry.sh` 通过 Nginx 在 shell 与 legacy 入口间切换 `3001`
- legacy Nginx 仍挂载：
  - 旧前端根入口
  - `2d` 静态资源
  - `3d` 静态资源
- 当前 legacy 仓库仍保留：
  - jar 后端
  - 旧 Vue 编译产物
  - 2D/3D 资源路径

当前判断：

- legacy 在当前阶段是“内核来源 + 旧资产承接层”
- 它应继续被隔离、被适配、被收口，但不是现在就要消灭的系统

### 2.4 `scripts`

定位：当前项目的运维治理编排层。

已确认的真实职责：

- 本地栈启动/停止：`start_local_stack.sh`、`stop_local_stack.sh`
- 3001 入口切换：`manage_3001_entry.sh`
- 主控入口：`chiller_ctl.sh`
- 验收脚本：`v19_2_acceptance.sh`
- 预检脚本：`release_preflight_v1_8.sh`

当前判断：

- `scripts` 不是临时杂项目录，而是当前治理链路的重要组成
- 在没有更稳定替代前，不建议把这些流程硬拆回页面线程或新服务线程

### 2.5 `docs`

定位：当前项目的合同、验收、门禁、运行态证据层。

已确认的真实职责：

- 页面签收与 UI 复验文档
- BFF 合同与字段映射文档
- release-ready / release-command-center / check-family 最新产物
- HVAC 文案与操作卡片

当前判断：

- `docs` 已承担“治理事实源”的角色
- GPT-5.4 建议里的架构、字段、线程边界，最适合先以文档治理方式补齐，而不是直接改代码形态

## 3. 已完成迁移成果

### 3.1 告警页

当前状态：

- 已接入真实 BFF
- 已完成真实列表模式收口
- `docs/sprint1-alarm-page-final-ui-review-v1.md` 结论为 `首版可联调可演示=yes`

结论：

- 告警页可视为当前仓库已经完成的迁移成果

### 3.2 设备页

当前状态：

- 已接入 `overview + topology + devices/list + devices/tree + devices/{deviceId}`
- `docs/sprint1-device-page-signoff-data-v1.md` 判断为“不阻断正式签收”
- `docs/sprint2-device-page-final-ui-review-v3.md` 结论为：
  - `首版可联调可演示=yes`
  - `正式签收=yes`

结论：

- 设备页迁移主链已形成并完成二期签收
- 当前可视为“已完成正式签收级迁移”

### 3.3 趋势页

当前状态：

- 已真实接入 `dashboard/overview + dashboard/trends`
- `docs/sprint1-trend-page-signoff-data-v2.md` 判断为“数据面不阻断演示”
- `docs/sprint1-trend-page-final-ui-review-v2.md` 判断为“可联调，但未达到稳定演示签收线”

结论：

- 趋势页迁移链路已落地，且已进入真实运行态
- 但当前仍是“已迁移、未闭环”的状态，主要缺口在上游多序列趋势数据，而不是前端重写

### 3.4 `release-command-center` 链路

当前状态：

- `apps/chiller-bff/scripts` 已形成 release-command-center 系列脚本
- `scripts/chiller_ctl.sh` 已把 release-ready、release-command-center、check-family 串成统一值班入口
- `docs/release-command-center-runtime-enhanced-regression-v1.md` 记录当前 `release-command-center=GO`

结论：

- 这条链路已经是当前项目的已落地主控治理能力
- 它应被保留并继续收口，不应因“新架构设想”被推翻

### 3.5 登录与入口闭环

当前状态：

- `/login` 已接入 legacy `/user/login`
- shell 已形成受保护路由守卫
- 登录后可恢复原始受保护页面

结论：

- 当前主仓库入口闭环已经成立
- 后续不需要再单独新建认证前端主项目

## 4. 哪些模块可保留

建议明确保留以下模块与组织方式：

- 保留 `apps/chiller-bff + apps/chiller-shell-v1` 的双应用结构
- 保留 `services + adapters` 的 BFF 分层方式
- 保留 legacy 作为当前上游来源与旧资产承接层
- 保留 `scripts` 作为运行态治理编排入口
- 保留 `docs` 作为合同、验收、门禁与证据层
- 保留 `3001` 入口切换与 shell/legacy 并存机制
- 保留 release-ready / release-command-center / check-family 的文档化产物链

## 5. 哪些模块适合继续抽成统一 service

当前最适合继续统一收口的，不是新建大平台，而是把已有聚合逻辑抽得更稳。

建议优先收口的统一 service 方向：

- 遥测/趋势统一 service
  - 统一 `overview / trends / recommendations` 对能源、温差、COP 的指标口径
- 设备统一 service
  - 统一 `device list / tree / detail / topology` 的设备主数据、树结构、详情状态拼装
- 告警统一 service
  - 统一 `summary / list / severity / stale` 的口径和 fallback
- 来源状态与 freshness 统一 service
  - 当前已有雏形，适合继续沉淀为所有新能力的标准底座
- 规则与建议统一 service
  - 当前 `recommendationService + ruleEngineService` 已存在，可继续作为后续 optimize/assistant 的前置规则底座

当前不建议优先抽象的方向：

- 前端全局重设计式 service 容器
- 单独再造一层“平台核心目录”
- 跨仓库统一 runtime 平台

## 6. 哪些能力仍应后置

### 6.1 optimize / simulate

原因：

- 当前 BFF 主要职责仍是页面聚合与治理链路
- 设备详情与趋势多序列本身仍有真实缺口
- 现在引入优化/仿真会把项目重心从“先收口现有链路”拉偏

结论：

- 后置到当前页面链路和字段口径进一步稳定之后

### 6.2 AI

原因：

- 当前缺的不是聊天入口，而是稳定、统一、可复用的字段语义和服务边界
- 没有先完成字段口径与页面上下文治理，AI 接口会直接继承当前歧义

结论：

- 后置到字段/接口边界完成后，再考虑 `assistant/query`

### 6.3 3D

原因：

- 3D 资产目前仍主要挂在 legacy/Nginx 体系里
- 当前更适合保留旧资源挂载，而不是原生重建 3D 页面合同

结论：

- 当前只做旧资源承接，不做原生 3D 重写

## 7. 不推倒重来的实施边界

本项目后续融合必须遵守以下边界：

- 不新开 Python/FastAPI 主项目替换当前主仓库
- 不把现有 `apps/chiller-bff`、`apps/chiller-shell-v1` 推倒重组为全新目录体系
- 不一次性替换 legacy
- 不把 2D/3D 原生迁移列为当前主线
- 不让多个线程同时重构 `routes/v1.js` 与核心页面目录
- 不把趋势页、设备页当前上游缺口错误归因为“必须重写前端”

可接受的增量方式：

- 在 `chiller-bff` 内继续补 service 与 route
- 在 `chiller-shell-v1` 内继续补页面与状态表达
- 通过 `docs` 固化架构、字段、线程、门禁口径
- 通过 `scripts` 继续稳住运行态治理闭环

## 8. 当前架构结论

当前项目最合理的融合方式是：

- 保留现有主仓库结构
- 继续通过 BFF 统一 legacy 来源
- 继续通过 shell 承接页面迁移
- 继续通过 scripts + docs 固化治理链路

因此，本项目的下一阶段不是“重建主系统”，而是：

- 在现有仓库上做服务收口、字段收口、治理收口
- 在现有盘面上进入稳定维护
- 仅在业务明确批准后再开新能力线

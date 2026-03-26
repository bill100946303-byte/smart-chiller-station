# STAGE_REPORT_CURRENT

## 1. 当前阶段总览

当前主仓库已完成一轮“治理式融合 + 页面迁移”主线，核心结论如下：

- 已正式签收页面：`/dashboard`、`/login`、`/alarms`、`/devices`、`/system-overview`、`/scene-control`、`/trend-analysis`
- 已完成二期签收能力：`devices/tree`、`devices/{deviceId}`
- 可演示但暂不正式签收：`/optimize-demo`
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
  - 真实 optimize engine 尚未接入

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

当前主门禁状态：

- `npm run check:contract`：通过
- 当前校验 example 数：`11`

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

## 6. 当前保留治理项

### 6.1 Optimize 正式实现未启动

- 当前仅为治理态与可演示态
- 尚未接入真实 optimize engine

## 7. 当前阶段结论

当前项目已从“新壳搭建”推进到“多页面正式签收 + 治理层固定 + 扩展能力预留”的稳定阶段。

最重要的盘面是：

- 页面迁移主线已经跑通
- 治理层已经固化
- 继续推进时，不应再推倒重来

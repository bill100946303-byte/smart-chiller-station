# MIGRATION_STAGE_CLOSEOUT_CURRENT

## 1. 目的

本文用于给当前页面迁移阶段做一次封账式总览，固定：

- 哪些页面已经正式签收
- 哪些页面已可演示但暂不签收
- 哪些接口已经正式纳管
- 哪些问题已经降级为观察项

## 2. 页面状态总表

| 页面 | 当前状态 | 说明 |
| --- | --- | --- |
| `/alarms` | 已正式签收 | 告警摘要、最近告警流、真实列表、四档 severity、freshness/sourceStatus 已收口 |
| `/devices` | 已正式签收 | 设备总览页 iteration1 已签收；二期 `tree + detail` 也已正式签收 |
| `/trend-analysis` | 已正式签收 | 页面、数据、合同与真实回归已收口；`24h / 7d` 均已验证多序列连续趋势、stats、freshness 与 sourceStatus |
| `/scene-control` | 已正式签收 | 2D/3D 场景外壳已落地；旧静态资源服务已恢复，ready 态与嵌入态已复核通过 |
| `/dashboard` | 已正式签收 | 真实链路已通；首页聚合入口当前已完成主控签收 |
| `/system-overview` | 已正式签收 | 已改为真实 overview + topology + recommendations 聚合页，当前已完成主控签收 |
| `/login` | 已正式签收 | 当前已接入 legacy `/user/login` 真实认证，并承接受保护路由跳转与 session 恢复 |

## 3. 已正式纳管接口

当前已纳入主合同与 `check:contract` 主门禁的关键接口：

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

当前主门禁校验状态：

- `npm run check:contract`：通过
- 当前 example 数：`11`

## 4. 当前已签收成果

### 4.1 告警页

已签收范围：

- summary
- recent feed
- list
- severity 四档口径
- stale / degraded / empty / filtered empty 表达

legacy 源码拆解边界已固定：

- 新壳 `/alarms` 只承接：
  - 实时报警
  - 报警记录
- 后置：
  - 台账
- 后台配置：
  - 报警设置
  - 设备信息
- 其中 `legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue` 已明确归类为后台配置页，不再视作用户侧设备页来源。

### 4.2 设备页 iteration1

已签收范围：

- 概要摘要
- 设备分组骨架
- 真实列表
- type / floor 筛选
- freshness / sourceStatus 表达

### 4.3 设备页二期

已签收范围：

- `devices/tree`
- `devices/{deviceId}`
- 右侧 detail 首屏
- detail runtime 链路
- 页面级 sourceStatus 汇总

## 5. 当前可演示但未单独签收成果

### Optimize Demo

当前结论：

- 可联调：`yes`
- 可演示：`yes`
- 正式签收：`no`

当前定位：

- 仍为治理态 demo
- 不构成正式业务能力签收

## 6. 已降级为观察项的问题

以下问题仍存在，但不再阻断当前阶段封账：

- 设备详情部分状态字段仍可能为弱语义或观察态
- `recommendations` 仍主要承担诊断与建议作用
- `/system-overview` 已完成聚合签收；后续增强不影响当前结论

## 7. 当前阶段结论

当前页面迁移阶段已经形成以下稳定盘面：

- Dashboard：首页已正式签收
- 登录页：已正式签收
- 告警页：已正式签收
- 设备页：已正式签收
- 设备页二期：已正式签收
- 场景控制页：已正式签收
- 系统总览页：已正式签收
- 趋势页：已正式签收

## 8. 下一阶段建议

1. 先继续维护治理层与主账本，不急于再开新页面主线。
2. 保持 `/optimize-demo` 作为治理态演示，不误报为正式能力。
3. 之后再决定是否进入：
   - `optimize`
   - `simulate`
   - `assistant/query`
   - 2D/3D 深化交互增强

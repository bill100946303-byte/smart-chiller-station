# DEMO_ROUTES_CURRENT

## 1. 目的

本文用于统一说明当前可访问的演示路由、每页当前状态，以及演示时应如何解释页面边界。

## 2. 演示路由清单

| 路由 | 当前状态 | 演示口径 |
| --- | --- | --- |
| `/dashboard` | 已正式签收 | 作为综合入口页稳定展示 overview / trends / anomalies / recommendations 聚合结果 |
| `/login` | 已正式签收 | 作为真实认证入口页演示，可说明当前直接复用 legacy `/user/login` |
| `/alarms` | 已正式签收 | 作为稳定告警页演示，无需额外边界说明 |
| `/devices` | 已正式签收 | 作为稳定设备页演示，含树、详情和分页列表 |
| `/scene-control` | 已正式签收 | 作为稳定 2D/3D 场景入口演示，含楼层切换和设备上下文 |
| `/trend-analysis` | 已正式签收 | 可稳定展示多序列趋势分析、统计摘要、freshness 与来源状态 |
| `/optimize-demo` | 可演示，shadow 验收挂起 | 演示 140/B25 AI 优化建议、诊断可行性矩阵、shadow 审批和人工审阅边界；不代表真实 PLC 闭环已落地 |
| `/system-overview` | 已正式签收 | 当前可作为系统骨架、现态摘要与规则诊断聚合页稳定演示 |

## 3. 演示重点

### `/alarms`

- 强调真实 summary + list 已接通
- 强调 severity 与 sourceStatus 已收口

### `/devices`

- 强调摘要、树、详情、列表已经形成完整链
- 强调场景页与设备页已可深链接联动

### `/scene-control`

- 强调旧场景资产保留，新壳统一承接
- 强调 2D / 3D、10 / 11 楼切换和同楼层设备上下文

### `/trend-analysis`

- 强调多序列趋势、stats、freshness 与 sourceStatus 已真实打通
- 可按正式签收页面演示，不再作为挂起页说明

### `/optimize-demo`

- 强调这是 AI 优化建议 + shadow 审批演示，不是无人值守闭环
- 强调 140/B25 当前 suite 为 `GO_SHADOW_PENDING`，可进入人工审阅，不代表真实下发
- 强调页面展示主机组合、冷却塔 Approach、泵 Delta-T、运行诊断和数据资源可行性矩阵
- 强调诊断矩阵当前为 `4 可做 / 5 疑似 / 1 补点`
- 强调多机并联无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆单台主机 COP
- 现场复核交付包可通过 `check:optimize-demo-140-field-verification-package` 生成，报告为 `docs/optimize-demo-140-field-verification-package-latest.md/html`
- 甲方演示与验收口径见 `docs/OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md`
- 演示前可跑 `check:optimize-demo-140-client-demo-readiness`，结论需为 `CLIENT_DEMO_READY_SHADOW_PENDING`，并确认截图证据 `output/playwright/optimize-demo-140-client-demo-readiness.png` 已纳入报告

## 4. 当前不建议误讲的点

以下能力当前不应在演示时说成“已正式完成”：

- optimize engine 真正落地
- `/optimize-demo` 自动启停主机、自动下发 PLC 或进入 `enforced`
- simulate 能力
- assistant/query 能力
- 2D/3D 节点级深交互或控制下发

## 5. 当前结论

当前对外演示最稳的主路径：

1. `/dashboard`
2. `/alarms`
3. `/devices`
4. `/scene-control`

`/optimize-demo` 可作为 AI 优化建议与 shadow 治理的重点演示页，但对外必须同步说明：当前只到 read-only/shadow/人工审阅，不是正式闭环控制签收。

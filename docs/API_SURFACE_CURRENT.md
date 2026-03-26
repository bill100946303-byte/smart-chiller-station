# API_SURFACE_CURRENT

## 1. 适用范围

本文固定当前 `chiller-bff` 已纳管接口面，并把页面到接口映射、当前状态和后续预留位统一成单一入口文档。

判定来源：

- OpenAPI：`apps/chiller-bff/openapi/bff-v1.yaml`
- Example：`apps/chiller-bff/openapi/examples/*`
- 页面消费：`apps/chiller-shell-v1/src/services/bffClient.ts` 与各页面文件
- 状态依据：`docs/gpt54-fusion-review-v1.md`、`docs/v19.2-master-status.md`、各页面 signoff/demo 文档

状态定义：

- `已签收`：已有明确页面/主控签收结论，可作为稳定对外能力。
- `可演示`：已纳入真实链路，可演示或支撑演示，但未单独作为正式签收对象。
- `观察态`：已存在合同或实现，但当前仍主要承担诊断、辅助或未完全接入页面主链。

## 2. 当前已纳管接口清单

| 方法 | 路径 | 主要消费者 | 当前状态 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | 运维 / 健康探针 | 观察态 | 内部健康检查，不对应业务页签收 |
| `GET` | `/bff/v1/sites/{siteId}/dashboard/overview` | `/dashboard`、`/trend-analysis`、`/devices` | 已签收 | 多页共用核心摘要接口；首页、趋势页与设备页均已稳定消费 |
| `GET` | `/bff/v1/sites/{siteId}/dashboard/trends` | `/dashboard`、`/trend-analysis` | 已签收 | 趋势页回归已通过，`24h / 7d` 多序列趋势、stats、freshness 与 sourceStatus 已稳定展示 |
| `GET` | `/bff/v1/sites/{siteId}/anomalies/summary` | `/dashboard`、`/alarms` | 已签收 | 告警摘要/最近事件口径已完成四档收口 |
| `GET` | `/bff/v1/sites/{siteId}/anomalies/list` | `/alarms` | 已签收 | 告警页正式签收主列表来源 |
| `GET` | `/bff/v1/sites/{siteId}/system/topology` | `/devices`、`/system-overview` | 已签收 | 设备页骨架、分组摘要与系统总览骨架都已稳定消费 |
| `GET` | `/bff/v1/sites/{siteId}/devices/list` | `/devices` | 已签收 | 设备页列表主来源 |
| `GET` | `/bff/v1/sites/{siteId}/devices/tree` | `/devices` | 已签收 | 设备树导航主来源 |
| `GET` | `/bff/v1/sites/{siteId}/devices/{deviceId}` | `/devices` | 已签收 | 设备详情首屏主来源；运行态增强已打通 |
| `GET` | `/bff/v1/sites/{siteId}/system/diagram` | 维护 / 系统图语义聚合 | 观察态 | 合同、example 与服务链已恢复；当前按维护态接口保留，不扩业务范围 |
| `GET` | `/bff/v1/sites/{siteId}/recommendations` | `/dashboard`、`/system-overview` | 已签收 | 当前主要承接建议卡与规则诊断，并已支撑首页与系统总览页签收 |

## 3. 页面 -> 接口映射

### 3.1 当前页面映射总表

| 页面路由 | 当前页面状态 | 当前接口映射 | 备注 |
| --- | --- | --- | --- |
| `/login` | 已签收 | legacy `/user/login`（直连 legacy，不走 BFF） | 当前已作为真实认证入口页，承接受保护路由跳转与 session 恢复 |
| `/dashboard` | 已签收 | `dashboard/overview` + `dashboard/trends` + `anomalies/summary` + `recommendations` | 首页聚合入口已签收；趋势卡片仍按部分回退真实展示 |
| `/trend-analysis` | 已签收 | `dashboard/overview` + `dashboard/trends` | 趋势页已完成回归并正式签收 |
| `/alarms` | 已签收 | `anomalies/summary` + `anomalies/list` | 告警页正式签收 |
| `/devices` | 已签收 | `dashboard/overview` + `system/topology` + `devices/list` + `devices/tree` + `devices/{deviceId}` | 设备页二期已签收 |
| `/system-overview` | 已签收 | `dashboard/overview` + `system/topology` + `recommendations` | 当前已改为真实聚合页；节点详情为诚实摘要，不伪造节点级 telemetry |
| `/scene-control` | 已签收 | 无新增 BFF 接口；页面直接承接 legacy 2D/3D 静态资源 URL 与降级探测 | 当前外壳已落地，legacy 2D/3D 资源已恢复可访问 |
| `/optimize-demo` | 可演示 | `POST /optimize` | 当前承接 explainable draft optimize 演示，不属于正式签收页 |

### 3.2 页面级说明

#### Dashboard

- 作用：驾驶舱摘要页。
- 真实接口：
  - `dashboard/overview`
  - `dashboard/trends`
  - `anomalies/summary`
  - `recommendations`
- 当前判定：`已签收`
- 解释：
  - 运行主链已在 `V1.8` / `V19.2` 主控里通过。
  - 当前首页聚合入口已经具备正式签收条件。
  - 趋势链问题继续单独挂在 `/trend-analysis`，不反向阻断首页。

#### Trend Analysis

- 作用：趋势分析页。
- 真实接口：
  - `dashboard/overview`
  - `dashboard/trends`
- 当前判定：`已签收`
- 解释：
  - 真实回归已确认 `24h / 7d` 下多序列趋势稳定展示。
  - `currentCop / chilledDeltaT / coolingDeltaT` 均已形成带时间戳的连续有效序列。

#### Alarms

- 作用：告警摘要 + recent feed + 正式列表。
- 真实接口：
  - `anomalies/summary`
  - `anomalies/list`
- 当前判定：`已签收`
- 解释：
  - 对外 severity 已收口到四档。
  - 列表、筛选和降级态均已稳定落地。

#### Devices

- 作用：设备页摘要、骨架、树导航、详情首屏。
- 真实接口：
  - `dashboard/overview`
  - `system/topology`
  - `devices/list`
  - `devices/tree`
  - `devices/{deviceId}`
- 当前判定：`已签收`
- 解释：
  - 列表、树、详情已形成完整链路。
  - 当前仍允许个别字段处于观察态，但不再阻断正式签收。

#### System Overview

- 作用：系统总览聚合页。
- 当前真实情况：
  - 页面正式消费 `dashboard/overview`
  - 页面正式消费 `system/topology`
  - 页面正式消费 `recommendations`
  - 节点详情当前展示的是基于 `overview + topology + recommendations` 聚合出的诚实摘要
- 当前判定：`已签收`
- 解释：
  - 页面已经脱离 mock/占位态。
  - 当前已形成稳定的“系统骨架 + 现态摘要 + 规则诊断”聚合页。

#### Scene Control

- 作用：旧 2D / 3D 场景资产的统一外壳入口。
- 当前真实情况：
  - 页面不新增 BFF 业务接口。
  - 页面通过 `runtimeConfig.sceneBaseUrl` 直接拼装 legacy 2D/3D 资源 URL。
  - 当 `127.0.0.1:4000` 不可达时，页面可切换到明确的降级外壳态。
- 当前判定：`已签收`
- 解释：
  - 新壳路由、模式切换、楼层切换、外部打开链接和降级提示都已真实落地。
  - `4000` 端口 legacy 2D/3D 静态资源已恢复，页面默认 ready 态已复核通过。

#### Optimize Demo

- 作用：优化草案接口 `/optimize` 的最小演示页。
- 真实接口：
  - `POST /bff/v1/sites/{siteId}/optimize`
- 当前判定：`可演示`
- 解释：
  - 页面已能真实提交请求并渲染 `context-backed draft` 返回。
  - 当前仍是治理态演示链，不是正式优化业务页。

## 4. 接口面稳定性说明

### 4.1 当前足够稳定的接口面

- `anomalies/summary`
- `anomalies/list`
- `devices/list`
- `devices/tree`
- `devices/{deviceId}`
- `dashboard/overview`
- `dashboard/trends`

原因：

- 路径、查询参数、example 形状和 shell DTO 已经对齐。
- 已纳入主合同或已被真实页面持续消费。
- 已形成明确的签收或演示结论。

### 4.2 当前已纳管但主要处于维护态的接口面

- `/healthz`
原因：

- 健康探针不直接构成业务页合同。

- `/bff/v1/sites/{siteId}/system/diagram`
原因：

- 合同、example、路由与服务链已在当前主仓库中存在。
- 此前 `404` 已确认是 `127.0.0.1:8787` 被 Python `BaseHTTP` 进程占用导致的运行入口问题，不是 `system/diagram` 合同缺失或实现缺失。
- 当前已恢复 Node BFF 对 `8787` 的监听，`/healthz`、`/system/topology` 与 `/system/diagram` 已重新返回 `200`。
- 该项当前仍按维护态接口处理，不借此扩展新能力或重写合同边界。

## 5. 后续预留接口建议

以下接口只作为扩展预留位，当前不要求立即实现：

| 预留路径 | 预留用途 | 当前要求 |
| --- | --- | --- |
| `/bff/v1/sites/{siteId}/optimize` | 优化策略/建议执行入口 | 仅保留命名位；暂不进入当前线程实施 |
| `/bff/v1/sites/{siteId}/simulate` | 仿真或方案推演入口 | 仅保留命名位；暂不进入当前线程实施 |
| `/bff/v1/sites/{siteId}/assistant/query` | 站点助手查询入口 | 仅保留命名位；暂不进入当前线程实施 |

补充治理文档：

- `docs/OPTIMIZE_SIMULATE_ASSISTANT_GOVERNANCE_CURRENT.md`
- `docs/OPTIMIZE_SIMULATE_ASSISTANT_CONTRACT_CURRENT.md`

当前补充状态：

- `/bff/v1/sites/{siteId}/optimize`
  - 已存在草案路由
  - 当前已做请求校验，并返回带有 `overview + anomalies + recommendations` 解释型 details 的 `NOT_IMPLEMENTED`
  - 暂未纳入主合同与 `check:contract`
- `/optimize-demo`
  - 已存在最小演示页
  - 当前承接 draft optimize 请求表单、解释型 steps 与结构化诊断展示
  - 暂不纳入页面签收主线

预留约束：

1. 继续复用现有 `siteId` 作用域。
2. 继续沿用 BFF 统一外层结构风格，不另开平行 API 体系。
3. 需要新增时，应优先继承当前 `freshness/sourceStatus` 诊断风格。
4. 预留接口不得倒逼当前页面立即改造。

## 6. 当前结论

- 当前接口面已经足够支撑后续渐进融合。
- 下一阶段重点不是扩路径数量，而是继续在现有 BFF 面上稳固字段语义和页面接入深度。

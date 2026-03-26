# PHASE1_MAINTENANCE_CLOSEOUT_CURRENT

## 1. 目的

本文用于给当前主仓库的一期迁移主线做一次维护态封版，固定：

- 当前已正式签收页面清单
- 当前治理态 demo 清单
- 当前核心接口与运行态冒烟结果
- 当前冻结边界

## 2. 当前阶段判断

当前项目处于：

- 一期迁移基本完成
- 主干页面已成型并完成签收
- 当前进入稳定维护阶段
- Phase 2 能力继续冻结

## 3. 当前已正式签收页面

- `/login`
- `/dashboard`
- `/system-overview`
- `/alarms`
- `/devices`
- `/scene-control`
- `/trend-analysis`

已正式签收的设备二期能力：

- `devices/tree`
- `devices/{deviceId}`

## 4. 当前治理态 demo

- `/optimize-demo`

当前定位：

- 可联调
- 可演示
- 暂不正式签收
- 不代表真实 optimize engine 已落地

## 5. 当前接口与门禁状态

当前已纳入主合同与 `check:contract` 的关键接口：

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

门禁结果：

- `npm run check:contract`：通过
- 当前校验 example 数：`11`

补充说明：

- `check:contract` 中 real-link-ready 相关输出仍属于 non-blocking 诊断，不单独否决当前封版。

## 6. 当前维护态冒烟结果

2026-03-24 实测结果：

- `./scripts/chiller_ctl.sh runtime-status`：`runtimeChain=ok`
- `GET /healthz`：`200`
- `GET /dashboard/overview`：`200`
- `GET /dashboard/trends?range=24h`：`200`
- `GET /anomalies/list?page=1&pageSize=5`：`200`
- `GET /devices/list?page=1&pageSize=5`：`200`
- `GET /system/diagram?layoutMode=auto&scope=full`：`200`
- `GET /recommendations`：`200`
- Playwright 实际导航 `/dashboard`：页面可达，标题为 `Chiller Shell V1`

## 7. 当前冻结边界

当前继续冻结：

- 正式 optimize engine
- `simulate`
- `assistant`
- 新主业务域
- 大规模页面迁移

当前允许：

- 已签收页面缺陷修复
- 运行配置与必要运维修正
- 治理文档去过时与同步
- `/optimize-demo` 维护，不升级为正式业务页

## 8. 当前结论

当前主仓库一期迁移主线已经完成封版，后续以稳定维护为主。

当前最重要的边界是：

- 不再把 `/trend-analysis` 视为挂起页
- 不把 `/optimize-demo` 误报为正式能力
- 不在未批准前启动 Phase 2 新能力开发

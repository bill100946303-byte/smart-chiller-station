# 真实链路态量化验收（v1.4）

范围：
- 页面：`/dashboard`、`/system-overview`
- 指标：`degraded endpoints 数`、`stale 标记`、`series 非空率`
- 约束：不改 token、不改接口、不改业务逻辑

## 1) 指标定义与计算口径

### M1. Degraded Endpoints Count
- Dashboard 口径：统计 `overview/trends/anomalies/recommendations` 4 个端点里 `sourceStatus.overall != "ok"` 的数量。
- SystemOverview 口径：统计页面直接依赖端点 `recommendations` 是否降级（`0` 或 `1`）。

### M2. Stale Flag
- 口径：`overview/trends/anomalies` 任一 `freshness.stale == true` 记为 `1`，否则 `0`。
- SystemOverview 使用同一链路 stale 代理值（来源同 BFF 聚合链路）。

### M3. Series Non-Empty Rate
- 口径：`non_empty_series / total_series`，其中 `non_empty_series = points.length > 0` 的序列数。
- 当前基于 `trends.series` 统计。

## 2) 当前实测值（本轮）

数据来源：`/tmp/chiller_probe_v14.json`

- Dashboard
- `M1 degraded endpoints = 4/4`
- `M2 stale flag = 1`
- `M3 series non-empty rate = 0/3 (0.0%)`

- SystemOverview
- `M1 degraded endpoints = 1/1`
- `M2 stale flag = 1`（链路代理）
- `M3 series non-empty rate = 0/3 (0.0%)`（链路代理）

## 3) 指标标注截图

Dashboard：
- `docs/screenshots/real-v14-dashboard-metric-degraded.png`
- `docs/screenshots/real-v14-dashboard-metric-stale.png`
- `docs/screenshots/real-v14-dashboard-metric-series_rate.png`

SystemOverview：
- `docs/screenshots/real-v14-system-overview-metric-degraded.png`
- `docs/screenshots/real-v14-system-overview-metric-stale.png`
- `docs/screenshots/real-v14-system-overview-metric-series_rate.png`

## 4) 非降级态“通过”阈值（明确数值）

页面级阈值：
- Dashboard
- `M1 <= 0/4`
- `M2 == 0`
- `M3 >= 80.0%` 且 `non_empty_series >= 2`

- SystemOverview
- `M1 <= 0/1`
- `M2 == 0`
- `M3 >= 80.0%`（链路代理阈值，与 Dashboard 同步）

最终通过规则：
- 上述 6 条阈值全部满足，且连续 2 次采样（间隔 >= 5 分钟）均满足，判定“非降级态通过”。

## 5) 本轮判定

- 判定：**不通过**
- 直接原因：
- `M1` 超阈（Dashboard `4/4`，SystemOverview `1/1`）
- `M2` 超阈（`1`）
- `M3` 超阈（`0.0%`）

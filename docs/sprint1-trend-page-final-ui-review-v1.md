# Sprint1 趋势分析页 Final UI Review v1

## 结论

- 是否达到“首版可联调可演示”：`no`
- 唯一剩余阻塞项：真实运行态下只有 `totalPowerKw` 形成连续有效序列，页面主场景仍退化为“单序列 + 其余指标提示/空值”，不满足首版对“多序列趋势分析页”的演示预期。

## 复验范围

- 页面：`http://127.0.0.1:3001/trend-analysis`
- 时间：`2026-03-13`
- 口径：只看真实运行态，不使用示意图
- 本轮截图状态：
  - desktop live default
  - desktop metric=`totalPowerKw`
  - desktop metric=`currentCop`
  - desktop metric=`chilledDeltaT` filtered empty
  - desktop range=`7d`
  - desktop degraded（阻断 BFF 只为验证真实页面降级分支）
  - mobile live default
  - mobile degraded

说明：

- 本轮没有输出 `stale` 截图，不是漏拍，而是本次真实链路返回 `freshness.stale=false`，无法在不伪造数据的前提下复现 stale 分支。

## 页面是否真实消费到 `trends + overview`

- 结论：`yes`
- 依据 1：页面代码同时调用 `fetchDashboardOverview(runtimeConfig.siteId)` 与 `fetchDashboardTrends(runtimeConfig.siteId, range)`，见 [TrendAnalysisPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx:218)。
- 依据 2：真实 BFF 返回：
  - `overview.energyCards.totalPowerKw = 0.3`
  - `overview.energyCards.chilledDeltaT = 0.2`
  - `overview.energyCards.coolingDeltaT = 0.4`
  - `trends.stats.totalPowerKw.latest = 0.3`
  - `trends.stats.currentCop.latest = 0`
  - `trends.sourceStatus.overall = "partial"`
- 依据 3：真实页面截图已反映这些值：
  - 顶部卡片显示 `0.3 kW / 0.00 / 0.2°C / 0.4°C`
  - 质量卡显示 `2/4`、`2`、`部分回退`、`fresh`
  - 来源状态条显示 `来源状态：1/5 异常`

## 通过项

- 页面已命中新壳，不是旧系统页面。
- `overview + trends` 双接口已被真实消费，页面不是假数据壳。
- 页头范围切换可工作，`24h -> 7d` 后按钮和图表范围标签一致。
- 指标筛选可工作，`总站功率 / 冷站 COP / 冷冻水温差` 会切换到对应图表/提示态。
- 降级态可工作，阻断 BFF 后页面不会白屏，会落到明确的不可用提示。
- 移动端可读，实拍 `430px` 下没有横向滚动或明显重叠。

## 不通过原因

### 唯一阻塞项

- 阻塞项：真实运行态不满足“多序列趋势图”的主演示要求。
- 证据：
  - 默认页显示 `1 条有效指标`
  - `currentCop` 只有单点，切换后只剩“等待连续有效点”提示
  - `chilledDeltaT` / `coolingDeltaT` 没有趋势点，切换后落到空序列提示
  - `trends.sourceStatus.overall = partial`
- 归因：`upstream_interface`
- 不是前端阻塞：
  - 前端已经把 partial、continuity hint、filtered empty、degraded 都正确落出来了
  - 问题在于真实数据还不足以支撑“多序列分析”这件事本身

## 截图清单

- [desktop-live-default](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-live-default.png)
- [desktop-metric-totalPowerKw](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-metric-totalPowerKw.png)
- [desktop-metric-currentCop](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-metric-currentCop.png)
- [desktop-metric-chilledDeltaT-empty](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-metric-chilledDeltaT-empty.png)
- [desktop-range-7d](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-range-7d.png)
- [desktop-degraded](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-desktop-degraded.png)
- [mobile-live-default](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-mobile-live-default.png)
- [mobile-degraded](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-page-final-ui-review-v1-mobile-degraded.png)

## 最终判断

- 这页已经达到“可联调”。
- 这页还没有达到“可演示”。
- 如果主控要把它从 `no` 推到 `yes`，本轮只需要关闭一个条件：
  - 让真实运行态下至少 2 条以上核心指标形成连续有效序列，且默认页不再只剩 `1 条有效指标`。

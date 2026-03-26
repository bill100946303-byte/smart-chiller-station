# Sprint1 趋势分析页 Signoff Decision v1

## 当前结论

- 当前演示结论：`yes`
- 当前正式签收结论：`yes`
- 当前验收状态：`已关闭`

## 一句话理由

- 趋势页已经真实消费 `dashboard/overview + dashboard/trends`，并在 `24h / 7d` 回归下稳定展示 `4` 条带时间戳的连续有效序列、真实 stats、freshness 与 sourceStatus，因此当前已达到正式签收条件。

## 通过项

1. 页面已不是 mock 或示意页，真实消费：
   - `GET /bff/v1/sites/{siteId}/dashboard/overview`
   - `GET /bff/v1/sites/{siteId}/dashboard/trends`
2. 合同层已收口：
   - `generatedAt` 已入主合同
   - `range` 已做 `24h / 7d / 30d` 运行时枚举校验
   - `check:contract` 已通过
3. 页面表达已收口：
   - `fresh / partial / degraded / empty` 不再误导成“暂无来源数据”
   - 指标筛选、范围切换、质量卡、降级提示都能真实反映当前运行态
4. 当前真实运行态下，`dashboard/trends` 已返回：
   - `totalPowerKw`
   - `currentCop`
   - `chilledDeltaT`
   - `coolingDeltaT`
   四条带时间戳的连续序列
5. 真实页面回归已确认：
   - 默认 `24h` 首屏显示 `来源状态：5/5 正常`
   - `可用序列 = 4/4`
   - 多序列趋势图与统计摘要均已渲染
   - 切换到 `7d` 后页面仍能稳定显示多序列趋势

## 历史问题说明

此前阻塞项 `upstream_trend_quality` 已在 2026-03-24 收缩并关闭当前页级阻塞：

- legacy by-tag 原始返回中的时间字段已确认存在于 `name`
- BFF `loadTrendSeries(...)` 曾错误保留不完整温差序列
- 该选择逻辑已完成维护修复
- 本轮回归通过后，趋势页已不再维持“挂起”状态

## 对值班/运营如何介绍这页

- `这页现在可以直接看功率、COP、冷冻水温差、冷却水温差的多序列趋势；页面已能在范围切换下稳定展示连续曲线、统计摘要和来源状态。`

## 当前主控处理方式

- 趋势页前端/BFF 侧本轮不再扩实现
- 当前正式验收已关闭
- 后续只保留：
  - 维护监控
  - 如出现回退，再按回归清单复核

## 相关依据

- [sprint1-trend-page-final-ui-review-v2.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-final-ui-review-v2.md)
- [sprint1-trend-page-demo-decision-v2.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-demo-decision-v2.md)
- [sprint1-trend-page-signoff-data-v2.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-signoff-data-v2.md)
- [sprint1-trend-page-contract-closeout-v2.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-contract-closeout-v2.md)

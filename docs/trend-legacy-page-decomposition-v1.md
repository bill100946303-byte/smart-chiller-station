# 趋势 legacy 页面拆解 v1

## 1. 结论

旧 `energy-test` 不是单一“趋势页”，而是一个把查询、对比、占比、热不平衡等多个能效专题混装在同一 tab 容器里的专题集合页。当前新壳 `/trend-analysis` 已承接其中的“趋势查询主线”，但没有承接 legacy 的全部专题分析能力。

本轮结论：

- 已映射到 `/trend-analysis`：查询区、主趋势图、趋势质量卡、当前值摘要卡、基础指标筛选、范围切换
- 仍属于 legacy 独有能力：能效对比、负荷比重、热不平衡率、能效日历、面向专题页的导出入口
- 受 upstream trend quality 阻塞、当前不能纳入正式签收：多序列连续趋势、稳定统计表、依赖运行参数历史曲线的专题分析
- 当前趋势页未签收的唯一阻塞项是 upstream，不是前端未完成

## 2. 旧页结构证据

旧容器页 [index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue) 通过 `el-tabs` 承载 5 个专题入口：

- `analysis`：能效日历
- `search`：能效查询
- `compare`：能效对比
- `proportion`：负荷比重
- `Rate`：热不平衡率

这说明 legacy 的“趋势页”本质上是专题分析集合，不等于新壳 `/trend-analysis` 当前的单页目标。

## 3. 模块拆解

### 3.1 查询区

legacy 证据：
- [energy-test/search.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/search.vue)
- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)
- [components/formSearch.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/components/formSearch.vue)
- [components/compareSearch.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/components/compareSearch.vue)

legacy 查询区能力：
- 时间范围选择
- 对象或设备选择
- 时间粒度选择
- 对比日期列表
- 导出触发

新壳承接情况：
- [TrendAnalysisPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx) 已承接：
  - 时间范围切换：`24h / 7d / 30d`
  - 指标筛选：`totalPowerKw / currentCop / chilledDeltaT / coolingDeltaT`
  - 基于真实 `overview + trends` 的数据状态表达

判断：
- `/trend-analysis` 已承接“趋势查询主线”的核心查询区
- 但未承接 legacy 的多对象、多日期对比式查询

### 3.2 图表区

legacy 证据：
- [energy-test/search.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/search.vue)
- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)
- [energy-test/compare.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/compare.vue)
- [energy-test/proportion.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/proportion.vue)
- [energy-test/hotbalance.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/hotbalance.vue)

legacy 图表区能力：
- 单专题能效曲线
- 多日期能效对比曲线
- 负荷比重图
- 热不平衡专题图

新壳承接情况：
- `/trend-analysis` 已承接：
  - 多指标趋势主图
  - 范围切换后的单页主趋势分析
  - quality cards 对当前曲线可读性的解释

判断：
- 已承接的是“趋势主图”
- 未承接的是“对比/占比/热不平衡”三类专题图

### 3.3 统计表

legacy 证据：
- [energy-test/search.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/search.vue)
- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)
- [energy-test/compare.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/compare.vue)
- [energy-test/hotbalance.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/hotbalance.vue)

legacy 统计表能力：
- 总值
- 峰值/谷值
- 峰谷发生时间
- 平均值
- `10% 最优平均值 / 10% 最差平均值`
- 热不平衡统计表

新壳承接情况：
- `/trend-analysis` 当前以：
  - 摘要 KPI 卡
  - latest/freshness/source quality 表达
  代替了 legacy 的大统计表

判断：
- 新壳已承接“趋势页首屏统计摘要”
- 未承接 legacy 那种完整统计表格
- 这些统计表当前也不应贸然签收，因为它们高度依赖上游连续序列和统计产物完整度

### 3.4 导出 / 对比 / 专题分析入口

legacy 证据：
- [energy-test/search.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/search.vue)
- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)
- [energy-test/compare.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/compare.vue)
- [energy-test/proportion.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/proportion.vue)
- [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue)

legacy 能力：
- 表格导出
- 曲线导出
- 多日期对比
- 负荷比重专题
- 热不平衡率专题
- 能效日历入口

新壳承接情况：
- `/trend-analysis` 当前没有承接这些专题入口
- 当前页面定位仍是“主趋势分析页”，不是 legacy 专题中心

判断：
- 这些都属于 legacy 独有分析能力
- 不应误判成“前端没做完”
- 当前是产品范围尚未迁入，不是页面漏实现

## 4. `/trend-analysis` 已承接模块

结合 [TrendAnalysisPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx)，当前已承接：

- 趋势查询主线
- 时间范围切换
- 指标筛选
- 趋势主图
- KPI 摘要卡
- 质量卡（ready / missing / source / freshness）
- sourceStatus / degraded / stale / empty 表达
- 基于 `dashboard/overview + dashboard/trends` 的真实数据消费

这部分已经不是示意页或 mock 页，而是真实联调页。

## 5. legacy 独有模块

以下仍属于 legacy 独有专题能力，当前未映射到 `/trend-analysis`：

- 能效日历
- 能效对比
- 负荷比重
- 热不平衡率
- 专题表格导出
- 多对象、多日期对比查询
- `10% 最优/最差平均值` 这类专题统计

这些内容的“未迁移”是页面范围决策，不应归因为当前前端未完成。

## 6. 受 upstream 阻塞的模块

结合 [sprint1-trend-page-signoff-decision-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-signoff-decision-v1.md) 和 [TREND_UPSTREAM_GAP_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/TREND_UPSTREAM_GAP_CURRENT.md)，当前受上游阻塞、不能纳入正式签收的部分是：

- 稳定多序列趋势分析
- 完整统计表
- `currentCop` 连续曲线
- `chilledDeltaT / coolingDeltaT` 连续曲线
- 依赖运行参数历史曲线的专题分析

真实阻塞表现：
- `totalPowerKw` 有稳定连续序列
- `currentCop` 只有单点
- `chilledDeltaT / coolingDeltaT` 没有连续序列
- `trends.sourceStatus.overall` 仍可能为 `partial`

因此结论必须保持：
- 趋势页已可演示
- 正式签收挂起
- 唯一阻塞是 upstream trend quality

## 7. 最终拍板

### 7.1 已承接到 `/trend-analysis`

- 查询区主线
- 趋势主图
- 摘要统计卡
- 指标筛选
- 范围切换
- 降级、陈旧、空态表达

### 7.2 legacy 独有模块

- 能效日历
- 能效对比
- 负荷比重
- 热不平衡率
- 专题导出
- 多日期、多对象对比分析

### 7.3 受 upstream 阻塞模块

- 多序列连续趋势正式签收
- 稳定统计表
- `currentCop / chilledDeltaT / coolingDeltaT` 连续历史曲线
- 依赖运行参数历史曲线的专题分析

## 8. 结论口径

当前趋势问题不能归因于前端未完成。前端和合同层已经完成“趋势查询主线”的真实承接；未签收的根因是 legacy upstream 趋势统计链质量不足，而不是 `/trend-analysis` 页面没有接好。

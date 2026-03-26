# Sprint1 趋势分析页 + 告警页 UI 方案 v1

目标：为 Sprint1 先产出两页的新壳页面结构方案，明确模块、首屏层级、组件复用和桌面端优先布局。

## 输入说明

- 已使用：
  - `/Users/billchow/Documents/智慧冷冻站/docs/page-migration-ui-plan-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/ui-spec-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages`
- 未直接使用：
  - `/Users/billchow/Documents/智慧冷冻站/docs/ui-visual-direction-v1.md`

说明：
- 该路径当前未找到，本稿已按 `ui-spec-v1.md` 与现有壳层视觉体系收口，不影响 Sprint1 结构方案输出。

## Sprint1 目标边界

- 只定义页面壳层、模块拆分、首屏层级和组件复用
- 不在本稿中扩展接口合同
- 不在本稿中处理报表导出、打印态、复杂权限态
- 桌面端优先，移动端仅沿用现有 V1 断点规则

## 一、趋势分析页

页面定位：  
从 `Dashboard` 的趋势卡升级为独立“诊断分析页”，强调多指标对比、范围切换、趋势解释，而不是旧系统报表页。

## 趋势分析页模块拆分

### 1. 页面头部 `TrendAnalysisHeader`

保留：
- 页面标题
- 副标题
- `ReadinessBadge`
- `SourceStatusBanner`

作用：
- 首屏先回答“当前能不能信这页数据”
- 保持与 `Dashboard / SystemOverview` 一致的壳层入口感

### 2. 趋势摘要带 `TrendSummaryStrip`

建议 4 张摘要卡：
- 当前 COP
- 总功率
- 冷冻侧温差
- 冷却侧温差

说明：
- 这里不是 KPI 总览页的复制，而是“当前趋势上下文摘要”
- 卡片建议继续复用 `StatCard`

### 3. 趋势工具条 `TrendRangeToolbar`

建议放在主趋势图上方，包含：
- Range 切换：`24H / 7D / 30D`
- 指标预设切换：`效率 / 功率 / 温差 / 自定义组合`
- 数据说明位：`stale / degraded / aggregated`

不建议首轮加入：
- 复杂时间自定义选择器
- 多层树筛选器

### 4. 主趋势对比区 `TrendComparePanel`

这是本页首屏核心模块。  
建议内容：
- 多序列折线主图
- 图例区
- 最新值 / 最小值 / 最大值小统计

说明：
- 直接复用 `TrendPanel` 的绘制逻辑与空态逻辑
- 但页面级容器应升级为更宽、更高的“主分析卡”

### 5. 趋势解释区 `TrendInsightPanel`

建议放在主图右侧，展示：
- 当前波动一句话解释
- 数据质量说明
- 关联建议动作

说明：
- 这是趋势页与旧报表页最大的差异点
- 不只给图，还要给“为什么”和“下一步”

### 6. 关联异常区 `TrendRelatedAnomalies`

展示：
- 当前时间窗内异常事件
- 与趋势波动相关的风险点

说明：
- 可直接复用异常卡片风格
- 不需要首轮做完整告警列表，保留 3-5 条摘要即可

### 7. 推荐动作区 `TrendRecommendationPanel`

展示：
- 与趋势相关的推荐动作
- 风险等级

说明：
- 继续复用 `RecommendationCard`
- 首轮只做摘要，不做复杂操作流

## 趋势分析页桌面端优先布局

建议使用 12 列布局：

### 首屏

- 第 1 行：`TrendAnalysisHeader`
- 第 2 行：`TrendSummaryStrip`，4 卡横排
- 第 3 行：
  - 左 8 列：`TrendComparePanel`
  - 右 4 列：`TrendInsightPanel`
- 第 4 行：
  - 左 8 列：`TrendRelatedAnomalies`
  - 右 4 列：`TrendRecommendationPanel`

### 首屏层级

1. 先看数据来源可信度
2. 再看主趋势图
3. 再看趋势解释
4. 最后看异常与建议动作

## 二、告警页

页面定位：  
从旧系统的告警管理列表，升级为“风险处置页”。重点不是堆表格，而是先看告警压力，再看待处理项，再看详情和联动。

## 告警页模块拆分

### 1. 页面头部 `AlertOverviewHeader`

保留：
- 页面标题
- 副标题
- `ReadinessBadge`
- `SourceStatusBanner`

作用：
- 明确本页是否处于实时健康态
- 保持新壳一致性

### 2. 告警摘要带 `AlertSummaryStrip`

建议 4 张摘要卡：
- 告警总数
- 高危告警
- 未处理
- 近 24H 新增

说明：
- 复用 `StatCard`
- 高危与未处理两张卡必须进入首屏

### 3. 筛选工具条 `AlertFilterBar`

建议包含：
- 严重等级筛选
- 状态筛选（未处理/处理中/已关闭）
- 来源筛选
- 时间范围切换
- 搜索框

说明：
- 第一阶段不做复杂高级筛选弹窗
- 工具条必须单行可读

### 4. 告警主列表 `AlertListPanel`

建议为主内容核心区，按风险优先级排序。  
每条至少包含：
- 标题
- 时间
- 来源
- 影响对象
- 等级
- 状态

说明：
- 首轮可以是卡片列表或紧凑列表，不必先上重量级表格
- 重点是“值班可扫读”

### 5. 告警详情面板 `AlertDetailPanel`

建议放在右侧，内容包括：
- 告警描述
- 影响范围
- 关联设备/节点
- 推荐动作
- 关联规则/来源状态

说明：
- 详情不建议用旧式弹窗
- 桌面端优先固定右侧详情面板

### 6. 联动诊断区 `AlertDiagnosticPanel`

展示：
- `RuleSkipDetails`
- 来源状态摘要
- 是否由上游降级或字段问题触发

说明：
- 这是新壳的优势模块
- 让告警页不仅“看到报警”，还能“理解报警”

### 7. 关联设备区 `AlertRelatedDevices`

展示：
- 关联设备状态
- 快速跳到设备总览/系统总览

说明：
- 首轮只做摘要联动，不做深度设备编辑

## 告警页桌面端优先布局

建议使用 12 列布局：

### 首屏

- 第 1 行：`AlertOverviewHeader`
- 第 2 行：`AlertSummaryStrip`
- 第 3 行：`AlertFilterBar`
- 第 4 行：
  - 左 7 列：`AlertListPanel`
  - 右 5 列：`AlertDetailPanel`
- 第 5 行：
  - 左 7 列：`AlertDiagnosticPanel`
  - 右 5 列：`AlertRelatedDevices`

### 首屏层级

1. 先看告警压力
2. 再看未处理列表
3. 再看单条详情
4. 最后看诊断解释与设备联动

## 三、可直接复用的现有组件

以下组件建议 Sprint1 直接复用：

- `ReadinessBadge`
- `SourceStatusBanner`
- `SectionCard`
- `StatusPill`
- `StatCard`
- `TrendPanel`
- `RuleSkipDetails`
- `RecommendationCard`

可部分复用的现有能力：

- `DashboardPage` 中趋势空态、降级态、Range 文案逻辑
- `SystemOverviewPage` 中壳层头部与详情卡组织方式
- `useRecommendationDiagnostics` 的诊断与来源状态组合方式

## 四、需要新增的页面级组件

## 趋势分析页

- `TrendAnalysisPage`
- `TrendAnalysisHeader`
- `TrendSummaryStrip`
- `TrendRangeToolbar`
- `TrendComparePanel`
- `TrendInsightPanel`
- `TrendRelatedAnomalies`
- `TrendRecommendationPanel`

## 告警页

- `AlertPage`
- `AlertOverviewHeader`
- `AlertSummaryStrip`
- `AlertFilterBar`
- `AlertListPanel`
- `AlertListItem`
- `AlertDetailPanel`
- `AlertDiagnosticPanel`
- `AlertRelatedDevices`

## 五、组件复用与新增的实现建议

### 趋势页

- `TrendComparePanel` 内部继续调用 `TrendPanel`
- `TrendSummaryStrip` 直接基于 `StatCard`
- `TrendRecommendationPanel` 内部继续用 `RecommendationCard`

### 告警页

- `AlertSummaryStrip` 直接基于 `StatCard`
- 告警等级和状态统一继续用 `StatusPill`
- `AlertDiagnosticPanel` 内部直接复用 `RuleSkipDetails`

## 六、Sprint1 实施建议

先做哪一页：`告警页`

原因：
- 它比趋势页更能补齐当前值班闭环
- 更贴近新壳“风险可视”的主目标
- 完成后可以直接增强 `Dashboard -> 告警 -> 详情` 的操作路径

第二页再做：`趋势分析页`

原因：
- 趋势能力已经在 `Dashboard` 有基础
- 独立成页主要是结构扩展，不是从零起步

## 七、示意图 / 参考图

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-alarm-ui-plan-v1-trend-layout.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-alarm-ui-plan-v1-trend-reuse.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-alarm-ui-plan-v1-alert-layout.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-trend-alarm-ui-plan-v1-alert-reuse.png`

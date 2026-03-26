# 告警页 Sprint1 UI 规格 v1

目标：一次性收口告警页首版 UI 方案，供新壳直接进入开发。  
首版范围固定为：

- 页头摘要
- 告警分级统计
- 最近告警流
- 告警列表首版布局
- 降级态 / 空态 / 陈旧态

不包含：

- 告警详情抽屉
- 复杂筛选器
- 高级搜索
- 批量操作

## 1. 页面信息架构

告警页首版只回答四个问题：

1. 当前告警数据是否可信
2. 当前风险压力有多大
3. 最近发生了什么
4. 值班同学现在应该先看哪些告警

因此页面信息架构固定为：

1. `AlarmPageHeader`
2. `AlarmSummaryStrip`
3. `RecentAlarmFeed`
4. `AlarmListFirstView`
5. `AlarmPageStateNotice`

说明：
- `AlarmPageStateNotice` 不是独立常驻大模块，而是 normal / degraded / stale / empty 四态下插入在对应模块顶部的小提示带
- 首版不放右侧详情区，避免首屏过重

## 2. 组件树

## 页面级

- `AlarmPage`
- `AlarmPageHeader`
- `AlarmSummaryStrip`
- `AlarmMainGrid`
- `RecentAlarmFeed`
- `AlarmListFirstView`
- `AlarmPageStateNotice`

## 区块级

### `AlarmPageHeader`

- `ReadinessBadge`
- `SourceStatusBanner`
- `AlarmHeaderTitle`
- `AlarmHeaderSubtitle`

### `AlarmSummaryStrip`

- `AlarmSummaryCard` x 4

建议四张卡：
- `告警总数`
- `高危告警`
- `未处理`
- `近24H新增`

### `RecentAlarmFeed`

- `SectionCard`
- `RecentAlarmFeedList`
- `RecentAlarmFeedItem` x 3-5

每条至少包含：
- 时间
- 标题
- 来源
- 等级

### `AlarmListFirstView`

- `SectionCard`
- `AlarmListHeader`
- `AlarmListItem` x N
- `AlarmListEmptyState`

每条至少包含：
- 标题
- 时间
- 来源
- 影响对象
- 严重等级
- 状态
- 简短说明

### `AlarmPageStateNotice`

四态统一组件：
- `normal`
- `degraded`
- `stale`
- `empty`

## 3. 首屏布局（桌面端优先）

桌面端基准：`1440px`

## 布局结构

### 第一行

- `AlarmPageHeader`

### 第二行

- `AlarmSummaryStrip`

布局：
- 四卡横排
- 每卡等宽
- 卡间距 `16px`

### 第三行

- 左 `4` 列：`RecentAlarmFeed`
- 右 `8` 列：`AlarmListFirstView`

原因：
- 最近告警流负责“快速扫读”
- 告警列表负责“真正进入处理”
- 列表必须比 feed 更宽，保证首版可读

## 首屏层级

1. 先看 `ReadinessBadge + SourceStatusBanner`
2. 再看 `AlarmSummaryStrip`
3. 再扫 `RecentAlarmFeed`
4. 最后进入 `AlarmListFirstView`

## 4. 900px 以下简化策略

当宽度 `< 900px`：

### 结构变更

- 页面改单列
- `AlarmSummaryStrip` 变为 `2 x 2`
- `RecentAlarmFeed` 放在 `AlarmListFirstView` 上方
- 列表每项改为两段式信息块，不强求一行显示全部字段

### 模块排序

1. `AlarmPageHeader`
2. `AlarmSummaryStrip`
3. `RecentAlarmFeed`
4. `AlarmListFirstView`

### 简化规则

- `RecentAlarmFeed` 只保留最近 `3` 条
- `AlarmListFirstView` 首屏默认只展示 `6` 条
- 二级说明自动换行，不做省略号堆叠
- 不出现横向滚动

## 5. 状态说明

## normal

触发条件：
- 来源正常
- 无降级提示
- 数据时间新鲜
- 列表有数据或确认当前为 0

展示策略：
- `ReadinessBadge` 正常展示
- `SourceStatusBanner` 用 `good`
- `AlarmSummaryStrip` 展示真实统计
- `RecentAlarmFeed` 展示最近 3-5 条
- `AlarmListFirstView` 展示首版列表

文案建议：
- `告警数据正常`

## degraded

触发条件：
- 上游部分接口不可用
- 或仅能拿到部分告警数据

展示策略：
- 页面不白屏
- `SourceStatusBanner` 用 `warn`
- `AlarmPageStateNotice` 插入到 `RecentAlarmFeed` 和 `AlarmListFirstView` 顶部
- 已拿到的数据继续展示，缺失位显示 `--`

文案建议：
- `部分来源不可用，当前仅展示已成功返回的告警数据`

## stale

触发条件：
- 数据可读，但 freshness 已陈旧

展示策略：
- 保留已有列表和统计
- 顶部或列表头部插入陈旧提示
- 不把 stale 误写成服务故障

文案建议：
- `当前展示为最近一次聚合结果，数据时间较旧`

## empty

触发条件：
- 数据返回成功，但当前无告警

展示策略：
- `AlarmSummaryStrip` 显示 `0`
- `RecentAlarmFeed` 显示空态说明
- `AlarmListFirstView` 显示“当前无告警”
- 空态仍保留 `SourceStatusBanner`

文案建议：
- `当前无有效告警，系统处于相对平稳状态`

## 6. 与驾驶舱复用的组件清单

可直接复用：

- `ReadinessBadge`
- `SourceStatusBanner`
- `SectionCard`
- `StatusPill`
- `StatCard`

可复用交互和状态口径：

- `DashboardPage` 的 degraded / stale / empty 文案分层方式
- `DashboardPage` 的来源状态提示组织方式
- `RuleSkipDetails` 的风险解释语气

可复用视觉模式：

- `DashboardPage` 的卡片栅格
- `DashboardPage` 的列表式异常阅读节奏
- `SystemOverviewPage` 的页头控制台结构

## 7. 需要新增的页面级组件

- `AlarmPage`
- `AlarmPageHeader`
- `AlarmSummaryStrip`
- `AlarmSummaryCard`
- `RecentAlarmFeed`
- `RecentAlarmFeedItem`
- `AlarmListFirstView`
- `AlarmListHeader`
- `AlarmListItem`
- `AlarmPageStateNotice`
- `AlarmListEmptyState`

## 8. 不做项清单

首版明确不做：

- 告警详情抽屉
- 复杂筛选器
- 高级搜索
- 多条件组合过滤
- 批量确认/批量关闭
- 导出、打印、报表化视图
- 设备详情深跳转页面

说明：
- 这些能力会显著抬高告警页首版复杂度
- Sprint1 目标是先把“值班能读、能扫、能判”的首屏做稳

## 9. 页面拍板建议

告警页首版是否可直接进入开发：`yes`

理由：
- 页面信息架构已收敛
- 组件复用路径清晰
- 首版范围明确且边界已冻结
- 四态口径已经定义，不会一边开发一边改页面定位

## 10. 示意图 / 参考图

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-desktop-normal.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-desktop-degraded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-desktop-stale.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-mobile-normal.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-mobile-degraded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-ui-spec-v1-mobile-empty.png`

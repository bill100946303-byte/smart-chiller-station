# Sprint2 设备树 + 详情 UI Pack v1

## 结论

- 二期 UI 是否可直接进入开发：`yes`
- 前提：二期只做“树区导航 + 详情首屏工作台”，不扩到控制操作、批量动作、点位级调参。

## 页面定位

二期不是新增一张完全独立的“设备详情页”，而是在现有 [`/devices`](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/DeviceOverviewPage.tsx) 基础上，把当前首版的“摘要 + 分组 + 列表”升级成“总览首屏 + Tree/Detail 工作台”。

目标只有 4 个：

1. 让值班同学先看整体，再进入具体设备。
2. 让树区承担“定位设备”的任务，而不是让长列表承担全部导航。
3. 让右侧详情首屏只负责“值班判断”，不承担控制台职责。
4. 保持与现有 `/devices` 页面视觉语言一致，不新起一套页面体系。

## 与现有 `/devices` 页面如何衔接

建议只保留一个路由：`/devices`。

推荐衔接方式：

1. 顶部 `SourceStatusBanner + 页头 + 摘要卡` 原样保留。
2. 现有“系统骨架 + 楼层与分组 + 设备列表”所在的下半屏，升级为二期工作台。
3. 工作台默认分两种进入方式：
   - 从“系统骨架 / 分组卡”进入：树区自动高亮对应系统组。
   - 从“设备列表行”进入：树区高亮目标设备，右侧直接打开详情首屏。
4. 视觉上建议增加轻量视图切换：
   - `总览`
   - `树与详情`
   默认仍停在 `总览`，避免值班同学一进页就掉进深层结构。

收口建议：

- 一期是“设备总览页”。
- 二期是“设备总览页里的工作台层”。
- 不建议另起 `/devices/detail`，否则导航会变重，也会切断当前摘要和来源状态的上下文。

## 页面信息架构

固定阅读顺序：

1. 来源状态
2. 摘要卡
3. Tree/Detail 工作台
4. 最近异常与同组上下文

工作台内部阅读顺序：

1. 左侧树区先定位设备
2. 右侧设备头部确认“是谁、在哪、是否 stale/degraded”
3. 关键运行值先判断是否异常
4. 最近异常/规则提示只做说明
5. 同组设备上下文帮助值班定位

## 树区 / 详情区布局

### Desktop >= 1180px

推荐栅格：

- 左侧树区：`360px - 400px`
- 右侧详情区：其余自适应

布局顺序：

1. 顶部来源条
2. 摘要卡 4-6 张
3. 下方工作台双列

左侧树区内容：

- 树区标题与说明
- 当前筛选 chips
- 系统组节点
- 楼层分支
- 设备节点
- 当前选中路径摘要

右侧详情区内容：

- 设备头部 Hero
- 关键指标网格
- 最近异常 / Rule Skip / 来源说明
- 同组设备 / 上下文卡

### Tablet 900px - 1179px

- 树区与详情区改为上下结构
- 树区在上，详情在下
- 当前筛选 chips 保留
- Hero 区不再左右分布，改为纵向堆叠

### Mobile < 900px

移动端不做常驻双栏。

推荐策略：

1. 默认折叠树区，只显示“展开设备树”卡片。
2. 用户点开后，从左侧滑出或从顶部展开树抽屉。
3. 默认先展示右侧详情首屏，避免首屏被树结构占满。
4. 关键指标改为 2 列栅格。
5. 最近异常与同组上下文改为纵向卡片。

核心原则：

- 移动端优先看“当前设备是否正常”。
- 树区是导航层，不是常驻阅读层。

## 首版详情区信息架构

右侧详情首屏只保留 4 层。

### 1. 设备头部 Hero

展示：

- 设备名
- 设备编码
- 所属系统
- 所在楼层 / 楼栋
- 当前主状态
- 数据来源
- freshness / stale 标记

作用：

- 先回答“现在看的到底是哪台设备”。

### 2. 关键运行值

首版最多 6 格，按设备类型最小差异化展示。

建议字段：

- 当前功率
- 出水温 / 回水温
- 负荷率 / 频率
- 最近更新时间
- 同组异常数

原则：

- 字段不追求全。
- 只保留值班会用来判断“是否需要继续追”的那一层。
- 缺字段时显示 `--`，并把原因留给来源说明，不做前端推断。

### 3. 最近异常 / Rule 提示

展示：

- 最近异常摘要
- Rule Skip/Recommendation 说明
- 来源受限时的 message

原则：

- 只做说明，不反客为主。
- 不让 Rule 文案盖过设备主状态。
- 不做告警详情抽屉。

### 4. 同组设备 / 上下文

展示：

- 同组设备数
- 邻近设备
- 所属系统路径
- 最近更新时间

作用：

- 帮值班同学快速判断“是单台问题还是一组问题”。

## 状态落点

### normal

- 左树正常可展开、可选中
- 右侧详情完整展示
- Hero 显示 `运行中 / 正常`
- 指标卡显示真实值

### empty

分两类处理：

1. **工作台 empty**
   - 没有任何设备树或设备列表数据
   - 左树显示空态
   - 右侧只保留整体说明

2. **详情 empty**
   - 页面有数据，但用户还没选中设备
   - 左树可用
   - 右侧显示“请选择左侧设备节点”

### partial

- 来源状态为 `warn`
- 左树仍保留导航能力
- 右侧只保留可读字段
- 缺失字段显示 `--`
- 明确写出“当前仅部分字段可读”

partial 不能做成整页失败。  
它的重点是“仍可定位，但不能误读为全量实时数据”。

### degraded

- 顶部先给来源原因
- 左树可用则保留；树本身不可用时改为 skeleton
- 右侧 Hero 继续显示设备身份信息
- 关键运行值只保留 overview/list 仍可读字段
- 最近异常区改成来源说明优先

原则：

- degraded 是“来源受限”，不是“设备全挂”。
- 页面不能白屏。

### stale

- Hero 区必须显示 `stale` pill
- 最近更新时间升为显著字段
- 最近异常区增加“当前为最近有效快照”说明

原则：

- stale 是时间问题，不是结构问题。
- stale 不阻断树区导航。

## 组件拆分建议

可复用现有组件：

- `SourceStatusBanner`
- `SectionCard`
- `StatCard`
- `StatusPill`

建议新增页面级组件：

- `DeviceWorkspaceViewSwitch`
- `DeviceTreePanel`
- `DeviceTreeNode`
- `DeviceSelectionSummary`
- `DeviceDetailHero`
- `DeviceMetricGrid`
- `DeviceRuleContextCard`
- `DevicePeerContextCard`
- `DeviceTreeDrawer`（移动端）

建议新增页面状态组件：

- `DeviceDetailEmptyState`
- `DeviceDetailDegradedState`
- `DeviceDetailStaleNote`

## 首版不做项清单

- 不做控制操作
- 不做批量操作
- 不做点位级调参
- 不做复杂筛选器
- 不做告警详情抽屉
- 不做趋势 drilldown
- 不做 2D/3D 场景联动
- 不做设备台账编辑

## 开发拍板建议

建议直接按以下顺序开发：

1. 保留现有 `/devices` 顶部摘要区不动
2. 新增 `总览 / 树与详情` 视图切换
3. 先做 desktop 双栏工作台
4. 再补 mobile 折叠树抽屉
5. 最后补 partial / degraded / stale / empty 四类状态表达

## 配图说明

以下 8 张图均为**二期结构示意图**，用于开发收口，不代表当前真实运行态截图：

1. [desktop tree + detail normal](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-desktop-tree-detail-normal.png)
2. [desktop tree filtered](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-desktop-tree-filtered.png)
3. [desktop detail empty](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-desktop-detail-empty.png)
4. [desktop degraded](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-desktop-degraded.png)
5. [desktop stale](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-desktop-stale.png)
6. [mobile tree collapsed](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-mobile-tree-collapsed.png)
7. [mobile detail normal](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-mobile-detail-normal.png)
8. [mobile degraded](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint2-device-tree-detail-ui-pack-v1-mobile-degraded.png)


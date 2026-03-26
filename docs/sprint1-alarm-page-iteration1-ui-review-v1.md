# 告警页首版可联调收口 UI 评审 v1

目标：在 `anomalies/list` 已落地的前提下，评审告警页是否已经具备“首版可联调可演示”的最小 UI 条件，并给出一次性收口的页面级方案。

说明：

- 输入文件 `[sprint1-anomalies-list-ui-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-ui-pack-v1.md)` 当前不存在。
- 本稿以当前实现 `[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)`、现有样式 `[global.css](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/styles/global.css)` 和文案包 `[sprint1-anomalies-list-copy-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-copy-v1.md)` 为准收口。

## 1. 结论先行

当前告警页已经从“只有摘要”推进到“摘要 + recent feed + 真实 list 已接入”，但还**不满足**“首版可联调可演示”。

最终判断：

- 是否满足“首版可联调可演示”：`no`

原因不是链路没通，而是页面交互层还缺 3 个最小闭环：

1. 缺 `severity` 最小筛选区
2. 缺分页 / 页大小交互显性入口
3. 缺 `empty / degraded / stale / partial` 四态在列表工具条和列表体里的固定落点

换句话说：

- 数据链路已接上
- 页面还没形成“值班同学一眼就能操作”的第一版

## 2. 当前实现评估

当前 `[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)` 已有：

- 顶部 `SourceStatusBanner`
- 摘要卡
- `RecentAlarmFeed`
- `anomalies/list` 真实列表接入

当前仍缺：

- 筛选区
- 页码状态显示
- 页大小切换
- 列表工具条
- 移动端折叠卡片专用布局
- `partial` 独立提示

因此它更接近：

- `可开发`
- `可继续联调`

但还不是：

- `可演示`

## 3. 筛选区布局

首版筛选区建议放在：

- `RecentAlarmFeed` 右侧主列表顶部
- 即 `AlarmListToolbar` 中

首版只放 2 个交互：

1. `severity` 最小筛选
2. `pageSize` 最小切换

## 3.1 桌面端筛选区

布局建议：

- 左侧：
  - 列表标题 `告警列表`
  - 条数摘要 `第 1 页 · 20 条 / 共 63 条`
- 中间：
  - `severity` segmented pills：
    - `全部`
    - `高`
    - `中`
    - `低`
- 右侧：
  - `每页 10 / 20 / 50`
  - freshness 文本

原因：

- 值班同学先看“是否有高等级”
- `severity` 是告警页首版唯一值得前置的筛选
- 其他筛选会明显扩大联调面

## 3.2 移动端筛选区

布局建议：

- 第一行：
  - `告警列表`
  - `freshness`
- 第二行：
  - `severity` pills 横向换行
- 第三行：
  - `pageSize`
  - `加载更多 / 已显示 6 / 20`

移动端规则：

- 不做复杂下拉
- 不出现横向滚动
- `severity` pills 允许自动换行

## 4. 列表区与最近告警流的并存关系

建议：`并存`

首版角色划分必须明确：

- `RecentAlarmFeed`
  - 只承担“快扫”
  - 只显示最近 3 到 5 条
  - 不承担完整列表职责
- `真实告警列表`
  - 承担页面主体
  - 进入值班处理
  - 提供筛选 / 分页 / 条数信息

不建议首版直接删除 recent feed：

- recent feed 是首屏进入感最强的块
- 列表再真实，也不等于能替代快扫区

不建议只保留 recent feed：

- 无法形成真实列表页
- 无法承接 `anomalies/list` 的分页结构

## 5. 桌面端分页表现

桌面端建议采用最小分页条：

- `上一页`
- `当前页 / 总页数`
- `下一页`
- `每页 10 / 20 / 50`

放置位置：

- 主列表底部

页面行为：

- 切 `severity` 时回到第一页
- 切 `pageSize` 时回到第一页
- 若总条数不足一页，分页条可隐藏，但 `pageSize` 入口仍保留

为什么桌面端要显式分页：

- 演示时需要说明“这不是 recent feed 伪列表”
- 需要让人一眼看懂当前页和总量关系

## 6. 移动端分页表现

移动端建议用：

- `加载更多`
- `已显示 X / total`
- 轻量 `pageSize` 选项

原因：

- 移动端页码跳转器成本高，价值低
- 首版重点是连续阅读，不是跳页管理

建议行为：

- 默认 `pageSize = 6`
- `加载更多` 后追加下一页
- `severity` 切换时重置为首批

## 7. 4 类状态在页面中的具体落点

本轮必须固定 4 类异常阅读态：

- `empty`
- `degraded`
- `stale`
- `partial`

## 7.1 empty

触发条件：

- `items.length == 0`
- 接口返回成功

页面落点：

- 顶部摘要：显示 `0`
- `RecentAlarmFeed`：空态卡
- 主列表工具条：仍保留
- 主列表体：空态卡
- 分页区：隐藏

## 7.2 degraded

触发条件：

- `sourceStatus.overall != ok`
- 或字段缺列但仍可渲染

页面落点：

- 顶部 `SourceStatusBanner`：`warn`
- recent feed 顶部：降级提示带
- 主列表工具条下：降级提示带
- 主列表单元格：缺失列统一 `--`

## 7.3 stale

触发条件：

- `freshness.stale == true`

页面落点：

- 顶部摘要：freshness 卡变 `warn`
- recent feed 顶部：陈旧提示带
- 主列表工具条右侧：明确 freshness
- 主列表工具条下：`stale` 提示带

要求：

- `stale` 必须被写成“时间较旧”
- 不能误写成“服务异常”

## 7.4 partial

触发条件：

- `summary` 成功但 `list` 失败
- 或 `list` 成功但 `summary` 失败

页面落点：

- 顶部 `SourceStatusBanner`：主文案写 `partial`
- 成功的模块继续展示
- 失败的模块显示局部降级提示，不整页清空

具体分支：

- `summary ok + list failed`
  - 摘要正常
  - recent feed 正常
  - 主列表显示 `partial` 空壳 + 原因
- `summary failed + list ok`
  - 摘要卡回退为 `--`
  - 主列表可继续阅读

## 8. 桌面端与移动端目标态

## 8.1 桌面端

应形成：

- 左窄右宽结构
- 右侧主列表明显强于 recent feed
- 工具条、表头、行状态、分页条完整可读

## 8.2 移动端

应形成：

- recent feed 仍在上
- 主列表切为折叠卡片
- `severity` 和 `pageSize` 都可触达
- 底部 `加载更多` 明确存在

## 9. 当前页距离首版可演示还差什么

基于当前 `[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)`，仍缺：

1. `severity` filter pills
2. `page/pageSize` 的可见交互
3. 列表工具条
4. 7 列桌面主表结构
5. 移动端折叠卡片
6. `partial` 态单独口径
7. 文案仍保留旧描述：
   - `首版先复用最近告警流作为列表视图`

这句话在真实 `anomalies/list` 已接入后应当下线。

## 10. 本轮拍板建议

建议主控按以下顺序推进：

1. 先补 `AlarmListToolbar`
2. 再补 `severity` 最小筛选
3. 再补 `page/pageSize`
4. 最后收 `partial` 与移动端卡片

这样收口后，才适合对外演示。

最终结论：

- 是否满足“首版可联调可演示”：`no`

理由：

- `联调` 已经可以开始
- `演示` 还差一层最小操作闭环

## 11. 截图路径

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-desktop-normal-all.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-desktop-filtered-severity.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-desktop-stale.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-desktop-degraded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-mobile-normal.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-mobile-filtered.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-mobile-empty.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-page-iteration1-ui-review-v1-mobile-degraded.png`

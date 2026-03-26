# 告警页列表联调 UI 升级 v1

目标：基于 `GET /bff/v1/sites/{siteId}/anomalies/list` 即将落地的前提，把告警页从“recent feed 复用列表”升级为“真实列表页”的首版 UI 方案，并一次性冻结首版范围。

本轮只处理：

- 列表列定义
- 桌面端表格布局
- 移动端折叠卡片布局
- 分页 / 加载更多最小策略
- empty / degraded / stale 三种异常阅读态
- `RecentAlarmFeed` 与主列表的关系

本轮不处理：

- 告警详情抽屉
- 多条件复杂筛选
- 批量确认 / 批量关闭
- 工单联动
- 历史全量检索中心

## 1. 结论先行

告警页在 `anomalies/list` 落地后，应从“摘要页 + 伪列表”升级为“摘要页 + 真列表页”。

首版建议：

- `RecentAlarmFeed` 保留
- `AlarmList` 升级为页面主体
- 首屏仍采用“双区块”，但权重改为“feed 是快扫，list 是主任务”

最终拍板：

- 首版是否保留“最近告警流 + 列表”双区块：`yes`

原因：

- recent feed 适合值班首屏 5 秒扫读
- 主列表适合进入处理和持续阅读
- 如果 Sprint1 直接删掉 recent feed，首页判断节奏会变慢
- 如果只保留 recent feed，不足以构成真正的告警页

## 2. 页面信息架构调整

在上一版 `AlarmPageHeader + AlarmSummaryStrip + RecentAlarmFeed + AlarmListFirstView` 的基础上，结构升级为：

1. `AlarmPageHeader`
2. `AlarmSummaryStrip`
3. `RecentAlarmFeed`
4. `AlarmListToolbar`
5. `AlarmTableDesktop / AlarmCardListMobile`
6. `AlarmPaginationRail`
7. `AlarmPageStateNotice`

变化点：

- `RecentAlarmFeed` 不再承担“列表替身”职责
- `AlarmListToolbar` 首版只承担“列表标题 + 数据量 + 最小分页提示”
- `AlarmList` 由简单 4 列升级为完整主列表
- `AlarmPaginationRail` 先做最小占位，不引入复杂分页器

## 3. 列表列定义

`anomalies/list` 首版建议采用 7 列结构。

### 3.1 桌面端主列

1. `告警标题`
2. `等级`
3. `状态`
4. `来源`
5. `影响对象`
6. `发生时间`
7. `说明 / 当前值`

### 3.2 列定义说明

#### `告警标题`

- 对应 `items[].title`
- 作为视觉主列
- 一行优先，超长允许两行，最多两行截断

#### `等级`

- 对应 `items[].severity`
- 使用 `StatusPill`
- 色阶：
  - `high` -> `danger`
  - `medium` -> `warn`
  - `low` -> `neutral`

#### `状态`

- 对应 `items[].state`
- Sprint1 先支持：
  - `active`
  - `acked`
  - `cleared`
  - `unknown`
- 仍使用既有 pill 样式，不引入新 token

#### `来源`

- 对应 `items[].source`
- 用于值班判断是 BFF / rule / 上游系统哪一侧产出
- 允许短文本，不做图标系统

#### `影响对象`

- 首版由 `regId` 或映射后对象名承接
- 如果后端暂时只给 `regId`，前端按可读短串展示，不自行猜业务名称

#### `发生时间`

- 对应 `items[].occurredAt`
- 采用绝对时间展示
- 不在首版引入“相对时间 + tooltip”

#### `说明 / 当前值`

- 由 `value` 或附加说明文案承接
- 首版定位是“补充阅读列”
- 允许为空，为空时显示 `--`

## 4. 桌面端表格布局

桌面端基准宽度：`1440px`

## 4.1 模块排布

首屏结构：

- 第一行：`AlarmPageHeader`
- 第二行：`AlarmSummaryStrip`
- 第三行：左 `4` 列 `RecentAlarmFeed`，右 `8` 列 `AlarmListToolbar + AlarmTableDesktop`

说明：

- `RecentAlarmFeed` 高度控制在 3 到 5 条
- `AlarmTableDesktop` 是页面主模块，视觉占比应大于 feed

## 4.2 表格列宽建议

建议 7 列桌面栅格比例：

- 标题：`2.2fr`
- 等级：`0.8fr`
- 状态：`0.9fr`
- 来源：`1fr`
- 影响对象：`1.1fr`
- 发生时间：`1.2fr`
- 说明 / 当前值：`1.4fr`

对应要求：

- 标题和说明列承担主要宽度
- 时间列固定为可读宽度，不压缩成难读短串
- 等级 / 状态列必须稳定对齐

## 4.3 行高与节奏

- 表头高度：`40-44px`
- 数据行高度：`72-84px`
- 每页首版默认展示 `10` 条
- 行与行之间保持卡片式间距，不回退成纯表格线框后台

## 4.4 首版工具条

`AlarmListToolbar` 只包含：

- 列表标题：`告警列表`
- 当前条数摘要：例如 `第 1 页 · 20 条 / 共 63 条`
- 数据 freshness 简述：例如 `数据时间 08:12`

首版不包含：

- 多选框
- 排序菜单
- 复杂筛选面板
- 列显示开关

## 5. 移动端折叠卡片布局

阈值：`<= 900px`

## 5.1 整体结构

- 页面改单列
- `RecentAlarmFeed` 继续在主列表之前
- `AlarmTableDesktop` 切换为 `AlarmCardListMobile`

## 5.2 单条卡片结构

建议一条卡片拆为 4 段：

1. 顶部：
   - 标题
   - 等级 pill
   - 状态 pill
2. 第二行：
   - 来源
   - 影响对象
3. 第三行：
   - 发生时间
4. 第四行：
   - 说明 / 当前值

移动端规则：

- 标题最多 2 行
- 来源与影响对象允许换行
- 时间单独占一行，避免中英文混排挤压
- 不出现横向滚动

## 5.3 移动端条数策略

- 首屏默认 `6` 条
- 底部显示 `加载更多` 按钮占位
- 点击后进入下一批，不在首版引入页码跳转器

## 6. 分页 / 加载更多占位策略

首版最小策略建议按双端区分：

### 桌面端

- 使用轻量 `PaginationRail`
- 展示：
  - `上一页`
  - `当前页 / 总页数`
  - `下一页`
- 如果总数不足一页，不显示分页条

### 移动端

- 使用单按钮 `加载更多`
- 每次追加下一页数据
- 按钮下方显示：
  - `已显示 6 / 20`

### 为什么首版不做完整分页器

- Sprint1 重点是把真实列表主结构接起来
- 首版完整分页器会引入更多交互验证与状态分支
- 对值班同学最关键的是“能看、能读、知道还有更多”

## 7. 状态说明

## 7.1 normal

触发条件：

- `anomalies/list` 可用
- `freshness.stale = false`
- `items` 返回正常

展示策略：

- recent feed 正常展示 3 到 5 条
- 主列表展示真实数据
- 工具条展示条数与页码

文案建议：

- `告警列表已同步，可直接进入处理`

## 7.2 degraded

触发条件：

- `anomalies/list` 部分字段缺失
- 或 `sourceStatus.overall = partial`
- 或列表与摘要仅部分可用

展示策略：

- 顶部来源条继续显示 `warn`
- recent feed 保留，主列表继续展示已拿到的行
- 缺失列统一显示 `--`
- 工具条下插入降级提示带

文案建议：

- `部分来源不可用，当前列表仅展示已成功返回的告警项`

## 7.3 stale

触发条件：

- `freshness.stale = true`

展示策略：

- 保留 recent feed 与列表，不清空
- 在工具条和 feed 顶部标注陈旧提示
- 明确这是“时间旧”，不是“服务挂了”

文案建议：

- `当前列表为最近一次聚合结果，数据时间较旧`

## 7.4 empty

触发条件：

- `items.length = 0`
- 接口返回成功

展示策略：

- 摘要卡显示 `0`
- recent feed 显示空态说明
- 主列表显示空态卡片
- 分页条不显示

文案建议：

- `当前无有效告警，系统处于相对平稳状态`

## 8. 与最近告警流并存还是替换

建议：`并存`

不建议 Sprint1 直接替换成“只剩列表”的原因：

- recent feed 是值班首屏快扫入口
- 主列表是连续处理入口
- 两者任务不同，不是重复建设

建议的角色划分：

- `RecentAlarmFeed`：只保留 3 到 5 条，回答“最近刚发生什么”
- `AlarmList`：承接 10 条或更多，回答“现在应该处理哪些告警”

后续收敛条件：

- 只有当主列表的首屏阅读效率已经明显优于 feed
- 并且移动端阅读也不受损
- 才考虑在 Sprint2 评估是否删掉 recent feed

## 9. 组件建议

建议页面级拆分：

- `AlarmPageHeader`
- `AlarmSummaryStrip`
- `RecentAlarmFeed`
- `AlarmListToolbar`
- `AlarmTableDesktop`
- `AlarmCardListMobile`
- `AlarmPaginationRail`
- `AlarmListStateNotice`
- `AlarmListEmptyState`

建议可复用：

- `SourceStatusBanner`
- `SectionCard`
- `StatCard`
- `StatusPill`
- `ReadinessBadge`

## 10. 开发落地顺序建议

1. 先接 `anomalies/list` contract 与 DTO
2. 再落桌面端 `AlarmTableDesktop`
3. 再落移动端 `AlarmCardListMobile`
4. 最后补 `PaginationRail` 和四态文案

理由：

- 表格主结构是本轮核心
- 分页只是首版最小外壳，不应抢主任务

## 11. 示意图路径

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-desktop-normal.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-desktop-degraded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-desktop-stale.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-mobile-normal.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-mobile-degraded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/sprint1-alarm-list-ui-upgrade-v1-mobile-empty.png`

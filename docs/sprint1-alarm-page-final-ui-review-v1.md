# Sprint1 告警页 Final UI 真实复验 v1

## 1. 复验范围

本轮只基于真实运行态做 final 验收：

- 页面入口：[http://127.0.0.1:3001/alarms](http://127.0.0.1:3001/alarms)
- 页面实现：[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)
- 上轮结论：[sprint1-alarm-page-iteration2-ui-review-v2.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-alarm-page-iteration2-ui-review-v2.md)

说明：

- 本稿全部截图都来自 live `3001/alarms`。
- `desktop degraded / mobile degraded` 通过浏览器会话临时阻断到 `127.0.0.1:8787` 的 live 请求触发页面真实降级分支，不使用示意图，不注入 mock payload。

## 2. 最终结论

- 是否达到“首版可联调可演示”：`yes`

## 3. 通过依据

### 3.1 真实列表模式已经成立

上轮唯一阻塞项是：

- 主列表仍保留旧首版过渡逻辑，未完成真实列表模式收口

本轮已解除，证据如下：

1. 列表标题与辅助文案已改成真实模式
   - [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L201)
   - `sectionList = 告警列表`
   - `listHint = 真实告警列表已接入，最近告警流用于帮助快速浏览最新事件。`
2. 列表表头已明确为 `严重度`
   - [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L315)
3. `filtered empty` 不再回退 recent feed
   - [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L336)
   - [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L348)

真实页证据：

- `severity=normal` 时，主列表 `rows = 0`
- 页面直接显示 `当前筛选条件下没有告警记录。`
- 没有再把 recent events 回退进主列表

### 3.2 严重度筛选在真实页已可联调

真实 BFF 当前返回：

- `counts.critical = 3`
- `counts.major = 0`
- `counts.minor = 0`
- `counts.normal = 0`
- `items[].severity = critical`

页面实际表现：

- 默认态可正常展示 3 条 live 告警
- `severity=critical` 时仍展示 3 条记录
- `severity=normal` 时正确进入 filtered empty

对应实现：

- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L123)
- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L268)

### 3.3 最近告警流 + 主列表双区块关系已清晰

当前真实页里两块职责已经能讲清楚：

- 左侧 `最近告警流`：快扫最新事件
- 右侧 `告警列表`：筛选、分页、主阅读区

这和首版“可演示”标准一致，不再存在“两个区块像同一份列表重复出现且语义不明”的问题。

### 3.4 stale / degraded / filtered empty / mobile 都已可演示

1. `stale`
   - live 列表链路当前确实带 stale 证据
   - 页面默认态可见陈旧提示，不白屏
2. `degraded`
   - 阻断 live BFF 后，页面进入真实降级分支
   - 摘要卡、recent feed、list 都有明确降级落点
   - 无白屏
3. `filtered empty`
   - 真实 `severity=normal` 返回空列表时，页面能正确显示空态
4. `mobile`
   - 820 宽度下，recent feed、筛选、列表、空态、降级态都能正常阅读
   - 未出现主内容丢失

## 4. 验收结论

本轮 final 复验判断为：

- 告警页已达到 `首版可联调可演示`

原因不是“页面已经完全终态”，而是：

- 真实列表链路已接通
- 关键筛选可用
- 空态 / 降级态 / 移动端都能在真实页稳定落地
- 上轮唯一 blocker 已被移除

因此，本页可以从 UI 评审角度进入：

- `联调演示通过`

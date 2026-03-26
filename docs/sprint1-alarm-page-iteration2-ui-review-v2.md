# Sprint1 告警页 Iteration2 UI 真实复验 v2

## 1. 复验范围与方法

本轮只看真实运行态页面：

- 页面入口：[http://127.0.0.1:3001/alarms](http://127.0.0.1:3001/alarms)
- 页面实现：[AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)
- 口径基线：[sprint1-anomalies-severity-final-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-final-v1.md)

说明：

- `desktop normal / critical / filtered empty / stale / mobile normal / mobile filtered empty` 均来自 live `3001` 页面 + live BFF 数据。
- `desktop degraded / mobile degraded` 也基于 live `3001` 页面，但为了触发真实降级分支，在浏览器会话中临时阻断了到 `127.0.0.1:8787` 的 live 请求。
- 本稿没有使用示意图，也没有注入 mock payload。

## 2. 实际运行态证据

### 2.1 BFF 合同值已切到最终枚举

live `anomalies/summary` 与 `anomalies/list` 当前真实返回：

- `counts.critical = 3`
- `counts.major = 0`
- `counts.minor = 0`
- `counts.normal = 0`
- `items[].severity = critical`

因此，合同层已经使用：

- `critical | major | minor | normal`

这一点与 final 文档一致。

### 2.2 页面默认态当前同时带有 stale 证据

当前 live `anomalies/list` 返回：

- `freshness.stale = true`

所以默认页里：

- 总告警卡的说明是 `告警数据已陈旧，请先重跑运行态检查。`
- 但 freshness 卡仍显示 `fresh`

这说明页面已经读到 live stale 信息，但展示层仍存在信息割裂。

### 2.3 filtered empty 在真实页上会误导

live `severity=major` 真实返回：

- `items = []`
- `total = 0`

但页面当前并没有在主列表区显示真正空态，而是因为代码仍保留旧 fallback：

- 当 `items.length === 0` 且 `events.length > 0` 时，列表区回退渲染 recent events

对应代码：

- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L313)
- [AlarmPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx#L336)

这会直接导致：

- 筛选已空，但主列表仍显示 3 条“告警事件”

这是当前最影响演示可信度的真实问题。

## 3. 本轮判断

### 3.1 页面是否已完全使用 `critical|major|minor|normal`

- 结论：`no`

原因分两层：

1. 合同层：`yes`
   - 页面请求和 BFF 返回都已经是 `critical | major | minor | normal`
2. 用户可见文案层：`no`
   - 页面当前展示是 `紧急 / 重要 / 提示 / 正常`
   - final 文档要求是 `紧急 / 严重 / 一般 / 正常`

对应代码：

- [hvacCopybook.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/hvacCopybook.ts#L141)
- [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L203)
- [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L230)

### 3.2 最近告警流 + 列表双区块是否清晰

- 结论：`部分清晰，但未完全收口`

默认态下：

- 左侧 recent feed 负责快扫
- 右侧 list 负责主列表

这件事基本成立。

但 filtered empty 时不成立，因为主列表会回退 recent events。

另外，列表区辅助文案仍然写着：

- `首版先复用最近告警流作为列表视图，完整列表接口在 Sprint 1 后半段补齐。`

对应代码：

- [zhCN.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts#L208)

这句在真实链路已经误导，因为 `anomalies/list` 已经接入。

### 3.3 是否达到“首版可联调可演示”

- 结论：`no`

## 4. 唯一剩余阻塞项

唯一剩余阻塞项：

- `告警页主列表仍保留旧首版过渡逻辑，尚未完全切换为“真实 anomalies/list 为主”的最终模式。`

这个单一阻塞项在真实页里体现为 3 个连锁现象：

1. `filtered empty` 不空，主列表仍回退 recent events
2. 列表辅助文案仍说“复用最近告警流作为列表视图”
3. 严重度可见文案仍停留在过渡词 `重要 / 提示`，没有完成 final 文案 `严重 / 一般`

所以本轮不通过，不是因为链路没通，而是因为：

- live 数据已经到了最终合同层
- 页面还没有把“真实列表模式”这层 UI 语义完全收干净

## 5. 最终结论

- 页面是否已完全使用 `critical|major|minor|normal`：`no`
- 最近告警流 + 列表双区块是否清晰：`部分清晰，但 filtered empty 仍误导`
- 是否达到“首版可联调可演示”：`no`
- 若仍不通过，唯一剩余阻塞项：`主列表仍保留旧首版过渡逻辑，未完成真实列表模式收口`

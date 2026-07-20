# B25_BUSINESS_STATUS_MESSAGE_CURRENT

以下是一段可直接转发给业务方 / 项目方的当前状态说明。

## 1. 短版

`2026-04-11` 最新排查结果：B25 这轮本地数据口径修复已经把已知错接收口了，当前 `work-orders` 和 `knowledge` 为空，已经不是本地打错项目 key，而是上游现网返回为空；`imbalance` 曲线已恢复，但表格仍是上游接口字段不完整。现阶段不建议继续要求前端或 BFF 扩大补数，后续需要 DBA / legacy 侧确认正式数据口径并修复上游返回。

## 2. 稍长版

`2026-04-11` 我们对 B25 又补做了一轮 live upstream 核查。当前可以明确的是：本地 BFF 这边之前的三类错接已经基本修完，`work-orders / knowledge` 已切到正确 key `140btwentyfive`，`imbalance` 也已经修正为曲线走 `appId=140`、表格走 `140btwentyfive + appId=140`。在这个前提下，`work-orders` 和 `knowledge` 依然持续返回空，说明当前更像是上游现网本来就没有可用数据；`imbalance` 则是曲线恢复了，但表格接口虽然能返回 `200`，设备名称和设备类型字段仍缺失，属于上游数据质量问题，不再是本地路由或页面展示问题。

## 3. 当前建议口径

- `work-orders / knowledge`：按 upstream 真实空处理
- `imbalance`：按 upstream 数据质量问题处理
- 当前不要再扩大本地 fallback，也不要再归因为 UI 问题

## 4. 如需附件

- 技术根因总文档：[LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)
- 空数据说明：[B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md)
- `imbalance` 问题单：[B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md)

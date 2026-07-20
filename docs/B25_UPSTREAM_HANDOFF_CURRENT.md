# B25_UPSTREAM_HANDOFF_CURRENT

## 1. 这份文档的用途

这是一份 B25 当前 upstream 交接总览，用于把已经确认的本地收口结论，分发给不同角色，不再让接手方从多份长文档里自行拼结论。

截至 `2026-04-11`，当前统一口径是：

- 本地映射错误已基本收口
- `work-orders / knowledge` 当前按 upstream 真实空处理
- `imbalance` 当前按 upstream 数据质量问题处理
- 当前不要继续扩大 BFF fallback

## 2. 先看什么

如果只需要一份总根因材料，先看：

- [LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)

如果只需要一份 live 快照证据，先看：

- [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

## 3. 不同接手人的建议材料

### 3.1 发给 DBA / legacy / 运维

优先发送：

1. [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md)
2. [LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md)
3. [legacy-site-140-live-check.sql](/Users/billchow/Documents/智慧冷冻站/docs/legacy-site-140-live-check.sql)

用途：

- 确认 `siteId=140` 当前正式归属
- 核对 `appid=140` 与 `140btwentyfive / 140 / 140_data` 的 live 元数据和 schema 去向
- 判断 `work-orders / knowledge` 是否业务上本来就为空
- 判断 `imbalance table` 为什么旧 path `500`、新 path 字段退化

### 3.2 发给负责 `imbalance` 的 upstream/legacy 开发

优先发送：

1. [B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md)
2. [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

用途：

- 单独处理 `imbalance table` 的旧路径 `500`
- 恢复兼容路径的设备字段：
  - `drName`
  - `drTypeName`

### 3.3 发给业务方 / 项目方 / 非技术接口人

优先发送：

1. [B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md)
2. [B25_BUSINESS_STATUS_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_BUSINESS_STATUS_MESSAGE_CURRENT.md)

用途：

- 说明当前 `work-orders / knowledge` 已排除本地错接
- 说明当前空数据更像现网 upstream 真空，而不是页面展示问题
- 降低继续要求前端/BFF 补逻辑的误判

## 4. 当前统一结论

### 4.1 已完成的本地收口

- `work-orders` 已切到 `140btwentyfive`
- `knowledge` 已切到 `140btwentyfive`
- `imbalance curve` 已切到 `appId=140`
- `imbalance table` 已切到 `path=140btwentyfive + appId=140`
- `environment` 已通过传感器兼容链恢复，并收窄到 `12` 条环境代理点

### 4.2 当前剩余问题的归类

- `work-orders`
  - upstream 真实空
- `knowledge`
  - upstream 真实空
- `imbalance table`
  - upstream 数据质量问题

### 4.3 当前不建议再做的事

- 不建议继续扩大 `work-orders / knowledge` 的 BFF fallback
- 不建议再把 `imbalance` 归因为前端展示问题
- 不建议再把当前问题描述成“本地还在打错 key”

## 5. 建议发送顺序

1. 先把 [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md) 发给 DBA / 运维确认正式归属
2. 同时把 [B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md) 作为独立问题单发给 upstream 开发
3. 再把 [B25_BUSINESS_STATUS_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_BUSINESS_STATUS_MESSAGE_CURRENT.md) 发给业务方，统一“当前空数据不是本地错接”的认知

## 6. 相关材料

- [LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)
- [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md)
- [LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md)
- [B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT.md)
- [B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT.md)
- [B25_BUSINESS_STATUS_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/B25_BUSINESS_STATUS_MESSAGE_CURRENT.md)
- [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

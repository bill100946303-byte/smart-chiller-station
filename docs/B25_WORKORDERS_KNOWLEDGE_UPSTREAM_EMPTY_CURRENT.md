# B25_WORKORDERS_KNOWLEDGE_UPSTREAM_EMPTY_CURRENT

## 1. 结论

截至 `2026-04-11`，B25 的 `work-orders` 与 `knowledge` 已经确认命中正确 legacy key `140btwentyfive`，但多路 upstream 探测结果持续为空。

因此，当前更合理的处理方式是：

- `work-orders` 按 upstream 真实空处理
- `knowledge` 按 upstream 真实空处理
- 不再继续扩大本地 BFF fallback

## 2. 已确认事实

### 2.1 `work-orders`

以下接口均已命中 `140btwentyfive`，且返回成功，但没有任何非空数据证据：

1. 主列表：
   - `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=10`
   - 返回 `200`
   - `rowCount=0`
2. 状态筛选：
   - `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=50&state=1`
   - `rowCount=0`
   - `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=50&state=0`
   - `rowCount=0`
3. 概览计数：
   - `GET /zsqy/qsworkorder/140btwentyfive/findEC`
   - 返回 `200`
   - `未处理 / 正在处理 / 处理完毕` 三个计数全为 `0`
4. 旧列表线索：
   - `GET /zsqy/qsworkorder/140btwentyfive/findWorkOrderList`
   - 返回 `200`
   - 但没有返回任何可用列表数据

### 2.2 `knowledge`

以下接口均已命中 `140btwentyfive`，且返回成功，但没有任何非空数据证据：

1. 主列表：
   - `GET /zsqy/instructions/140btwentyfive/findObject?pageCurrent=1&pageSize=50`
   - 返回 `200`
   - `rowCount=0`
2. 旧接口：
   - `GET /zsqy/instructions/140btwentyfive/findAll`
   - 返回 `200`
   - 但没有非空 `data`
3. 按类型探测：
   - `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=72`
   - `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=167`
   - `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=172`
   - `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=174`
   - 全部返回 `200`
   - 但都没有非空文档数据

## 3. 为什么当前按 upstream 真空收口

- 当前已经不是“打错 key”：
  - `work-orders` 与 `knowledge` 都已切到正确 path `140btwentyfive`
- 当前也不是“只主列表为空”：
  - `work-orders` 的主列表、状态列表、概览计数、旧列表线索都为空
  - `knowledge` 的主列表、旧接口、按类型探测都为空
- 因此，现阶段继续在本地补更多 fallback，并不能提供新的可信数据来源

## 4. 当前本地处理边界

- 本地 BFF 已完成必要 remap：
  - `work-orders -> 140btwentyfive`
  - `knowledge -> 140btwentyfive`
- 本地已排除“仍打到 `btwentyfive` 错 key”的问题
- 当前应由 upstream / legacy / DBA 侧确认：
  - 这些业务数据在 B25 现网是否本来就为空
  - 或者是否存在 backing table / view / 默认筛选漂移

## 5. 相关材料

- [LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)
- [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md)
- [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

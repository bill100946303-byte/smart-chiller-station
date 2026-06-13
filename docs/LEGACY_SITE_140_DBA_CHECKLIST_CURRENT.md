# LEGACY_SITE_140_DBA_CHECKLIST_CURRENT

## 1. 当前已知 live 事实

- B25 初始交付 dump 中明确存在：
  - `zsqy_v1.appmanager.appid=140`
  - `appName=btwentyfive`
  - 初始项目库名 `140btwentyfive`
- 但当前直连 live MySQL `192.168.110.250:3306` 已确认：
  - `information_schema.schemata` 中没有：
    - `140btwentyfive`
    - `140`
    - `140_data`
  - 仅有：
    - `126lnoffice`
    - `126lnoffice_data`
  - `zsqy_v1.appmanager` 中查不到 `appid=140`
  - 模糊匹配 `b25` / `foxconn` / `guanlan` 也没有明确候选记录
- `2026-04-11` 已执行页面级 upstream probe，报告见：
  - [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)
  - 本轮摘要：`ready=17`、`failed=1`、`transport=0`
- `work-orders` 已确认命中正确 legacy path：
  - `/zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=10`
  - 返回 `200`，但 `rowCount=0`
  - `state=1` / `state=0` 两条筛选路径也都 `rowCount=0`
  - `/zsqy/qsworkorder/140btwentyfive/findEC` 三个状态计数全为 `0`
  - `/zsqy/qsworkorder/140btwentyfive/findWorkOrderList` 返回 `200`，但没有非空数据证据
- `knowledge` 已确认命中正确 legacy path：
  - `/zsqy/instructions/140btwentyfive/findObject?pageCurrent=1&pageSize=50`
  - 返回 `200`，但 `rowCount=0`
  - `/zsqy/instructions/140btwentyfive/findAll` 返回 `200`，但无非空数据
  - `instructionsTypeid=72/167/172/174` 的 `findAll` 也全部为空
- `imbalance` 已确认是分裂标识，不是单一 key：
  - 曲线接口 `getEnergyAnalysisCurve` 使用 `appId=140`，返回 `200`
  - 表格旧路径 `/zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?...` 返回 `500`
  - 表格兼容路径 `/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140...` 返回 `200`
  - 但兼容路径当前只有：
    - `dataStatisticsList`
    - `tableList.scalarRate`
  - 缺少：
    - `drName`
    - `drTypeName`
- 因此，截至 `2026-04-11`，B25 剩余问题已经不是“本地路由还打错”，而是：
  - live 元数据/Schema 缺失
  - `work-orders` / `knowledge` upstream 真空
  - `imbalance table` upstream 字段退化

## 2. 需要 DBA/运维确认的问题

1. `siteId=140` 当前正式口径到底是什么：
   - 是否永久主链路绑定 `126lnoffice`
   - 还是仍应恢复 `appid=140` / `140btwentyfive`
2. 为什么 live 中央元数据已经没有：
   - `appid=140`
   - `140btwentyfive`
   - `140`
   - `140_data`
3. `work-orders` 与 `knowledge` 当前空数据，究竟是：
   - B25 现网确实没有业务数据
   - 还是 backing table / view / 默认筛选口径已经漂移
4. `imbalance table` 为什么会出现分裂结果：
   - 旧 path `140` 直接 `500`
   - 兼容 path `140btwentyfive + appId=140` 虽 `200`，但只剩比例字段
5. 如果 B25 已正式并入 `126lnoffice`，请给出：
   - 官方映射关系
   - 替代 `appid`
   - 替代项目库名
   - 替代模型/报表路径
6. 如果 B25 仍应保留 `140btwentyfive` 体系，请给出：
   - 缺失 schema 的恢复计划
   - `getEnergyAnalysisDeviceList` 设备字段缺失的修复计划
   - `work-orders` / `knowledge` 数据应存在还是已业务清空的最终说明

## 3. 建议立即执行的 SQL / 接口核查

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('140btwentyfive', '140', '140_data', '126lnoffice', '126lnoffice_data');

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name LIKE '140%' OR schema_name LIKE '%btwentyfive%';

SELECT appid, appName, appexplain, ipaddr, appport, model_ip, model2d_ip, model2d_dataId, template
FROM zsqy_v1.appmanager
WHERE appid = 140;

SELECT appid, appName, appexplain, ipaddr, appport, model_ip, model2d_ip, model2d_dataId, template
FROM zsqy_v1.appmanager
WHERE lower(ifnull(appName, '')) LIKE '%b25%'
   OR lower(ifnull(appexplain, '')) LIKE '%b25%'
   OR lower(ifnull(appexplain, '')) LIKE '%foxconn%'
   OR lower(ifnull(appexplain, '')) LIKE '%guanlan%'
   OR lower(ifnull(model_ip, '')) LIKE '%guanlan%'
   OR lower(ifnull(model2d_ip, '')) LIKE '%guanlan%'
ORDER BY appid;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name IN ('qsworkorder', 'instructions', 'drinfo', 'drtypeinfo', 'qstag', 'homepage_param', 'param_type')
ORDER BY table_name, table_schema;

SHOW CREATE TABLE zsqy_v1.appmanager;
SHOW CREATE TABLE zsqy_v1.appusergroup;
```

建议同步复核以下接口，确认是“真空/退化”还是“映射漂移”：

- `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=10`
- `GET /zsqy/qsworkorder/140btwentyfive/findEC`
- `GET /zsqy/instructions/140btwentyfive/findObject?pageCurrent=1&pageSize=50`
- `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=72`
- `GET /zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
- `GET /zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`

## 4. 如果确认 B25 已永久迁到 `126lnoffice`

1. 请在 legacy/运维口径中明确公告 `siteId=140` 的正式映射
2. 但不要把当前页面级 split identifiers 误判为“本地脏兼容”直接删掉，因为现阶段仍有页面依赖：
   - `work-orders/knowledge -> 140btwentyfive`
   - `imbalance curve -> appId=140`
   - `imbalance table -> path=140btwentyfive + appId=140`
3. 如果计划把这些页面也统一切到 `126lnoffice`，需要先由 upstream 同步修复：
   - `work-orders`
   - `knowledge`
   - `imbalance table`
4. 在 upstream 未统一前，应用侧只能继续维持当前页面级兼容边界

## 5. 如果确认 B25 仍应使用 `140btwentyfive`

1. 先恢复中央库 `zsqy_v1.appmanager` 中 `appid=140` 的正式记录，或提供等价替代映射
2. 恢复或明确替代以下 schema：
   - `140btwentyfive`
   - `140`
   - `140_data`
3. 至少解释或恢复这些对象的正式来源：
   - `140btwentyfive.drinfo`
   - `140btwentyfive.drtypeinfo`
   - `140btwentyfive.qsworkorder`
   - `140btwentyfive.instructions`
   - `140btwentyfive.homepage_param`
   - `140btwentyfive.param_type`
   - `140.qstag`
   - `140_data.tagdata_YYYYMM01`
4. 修复 `imbalance table` 的设备字段缺失，至少补回：
   - `drName`
   - `drTypeName`
5. 明确说明 `work-orders` / `knowledge` 当前是否应为空；如果不应为空，请给出恢复路径

## 6. 当前建议

- 当前本地映射错误已经基本排除，不建议再让应用侧继续扩大业务 fallback
- `work-orders` 与 `knowledge` 当前可按“upstream 真实空”暂时收口，等待 DBA/运维给最终口径
- `imbalance` 当前应按“upstream 数据质量问题”升级，诉求不是“恢复接口可达”，而是“恢复完整设备字段”
- 后续排查建议统一以这三份材料为准：
  - [LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)
  - [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md)
  - [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

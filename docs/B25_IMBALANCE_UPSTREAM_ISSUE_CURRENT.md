# B25_IMBALANCE_UPSTREAM_ISSUE_CURRENT

## 1. 现象

截至 `2026-04-11`，B25 的 `energy-efficiency/imbalance` 已恢复曲线，但表格数据仍不是完整上游结果。

- 曲线接口可正常返回
- 表格旧路径直接返回 `500`
- 表格兼容路径虽然返回 `200`，但仅有比例字段，缺少设备名称和设备类型名称

这说明当前阻塞点已经不是前端或 BFF 是否打错路径，而是 upstream 表格接口本身存在旧路径失效和新路径字段退化两个问题。

## 2. 已确认事实

### 2.1 当前页面级正确口径

- `imbalance curve`
  - 查询参数使用 `appId=140`
- `imbalance table`
  - 路径必须使用 `140btwentyfive`
  - 同时保留查询参数 `appId=140`

### 2.2 已确认的 live 结果

`2026-04-11` 实测：

1. 曲线接口正常：
   - `GET https://www.ssge.com.cn:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
   - 返回 `200`
   - `status=20000`
2. 表格旧路径失效：
   - `GET https://www.ssge.com.cn:8098/zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
   - 返回 `500`
   - body 中为 `Internal Server Error`
3. 表格兼容路径可达但字段退化：
   - `GET https://www.ssge.com.cn:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
   - 返回 `200`
   - `status=20000`
   - `data.dataStatisticsList` 存在
   - `data.tableList` 仅剩 `scalarRate`
   - 缺少：
     - `drName`
     - `drTypeName`

### 2.3 连续样本窗结果一致

对以下三个样本窗连续抽样，结果一致：

- `2026-04-09`
- `2026-04-10`
- `2026-04-11`

当前共性是：

- `dataStatisticsList` 持续存在
- `tableList` 持续只有比例字段
- 没有恢复出设备名
- 没有恢复出设备类型名

因此，这不是单次偶发返回异常，而更像当前 upstream 表格数据源或组装逻辑已经长期退化。

## 3. 复现请求

请 upstream / legacy 侧按以下顺序直接复现：

1. 先请求旧路径：
   - `GET /zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
2. 再请求兼容路径：
   - `GET /zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
3. 对比返回差异：
   - 旧路径为什么直接 `500`
   - 新路径为什么只剩 `scalarRate`
4. 建议同步检查：
   - 该接口当前依赖的 schema / view / mapper
   - `140` 与 `140btwentyfive` 在 energy analysis 模块里的正式映射
   - 设备维度字段是否被 join 丢失、裁剪或视图替换

## 4. 期望修复

1. 明确 `imbalance table` 的正式可用路径，不要再让旧路径 `140` 保持 `500`
2. 在正式可用路径上恢复完整设备字段，至少补回：
   - `drName`
   - `drTypeName`
3. 保持当前已正常的汇总字段继续可用：
   - `acquisitionValue`
   - `scalar`
   - `noScalar`
   - `scalarRate`
4. 如果 B25 正式口径不应再使用 `140btwentyfive + appId=140` 这组 split identifiers，请同步提供：
   - 正式 path
   - 正式 `appId`
   - 切换后的回归验证方式

## 5. 当前本地处理边界

- 本地 BFF 已经按当前 live 事实完成兼容：
  - 曲线走 `appId=140`
  - 表格走 `path=140btwentyfive + appId=140`
- 本地适配层已兼容当前退化 payload，保证页面不再因为结构差异直接报错
- 但本地无法凭空补回 upstream 未返回的 `drName/drTypeName`

因此，这个问题当前应作为 upstream 数据质量问题跟进，而不应继续归因为本地映射或前端展示问题。

## 6. 相关材料

- [LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)
- [LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_MESSAGE_CURRENT.md)
- [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)

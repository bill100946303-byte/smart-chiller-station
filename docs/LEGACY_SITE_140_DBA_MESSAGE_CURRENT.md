# LEGACY_SITE_140_DBA_MESSAGE_CURRENT

`2026-04-11` 我这边对 `siteId=140` / B25 又补做了一轮页面级 upstream probe。当前结论已经比 `2026-04-09` 更明确：剩余问题不再是本地映射错误，而是 live 元数据缺失叠加页面级接口数据质量问题。

已确认事实：

1. B25 初始交付 dump 中明确存在：
   - `zsqy_v1.appmanager.appid=140`
   - `appName=btwentyfive`
   - 初始项目库名 `140btwentyfive`
2. 但当前直连 live MySQL `192.168.110.250:3306` 查到：
   - `information_schema.schemata` 中没有：
     - `140btwentyfive`
     - `140`
     - `140_data`
   - `zsqy_v1.appmanager` 中也查不到 `appid=140`
3. `2026-04-11` 页面级 probe 报告见：
   - [b25-upstream-data-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/b25-upstream-data-latest.json)
   - 本轮摘要：`ready=17`、`failed=1`、`transport=0`
4. `work-orders` 已经命中正确 legacy key `140btwentyfive`，但以下探测全部为空：
   - `findObject`
   - `state=1`
   - `state=0`
   - `findEC`
   - `findWorkOrderList`
5. `knowledge` 也已经命中正确 legacy key `140btwentyfive`，但以下探测全部为空：
   - `findObject`
   - `findAll`
   - `instructionsTypeid=72/167/172/174` 的 `findAll`
6. `imbalance` 当前不是“整体不可用”，而是分裂标识：
   - 曲线 `getEnergyAnalysisCurve` 走 `appId=140`，返回 `200`
   - 表格旧路径 `/zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?...` 返回 `500`
   - 表格兼容路径 `/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140...` 返回 `200`
   - 但兼容路径只返回比例字段，缺少 `drName/drTypeName`

因此，当前更合理的判断是：

- `work-orders` 与 `knowledge` 不是 BFF 还在打错 key，而是 upstream 当前真实空
- `imbalance` 也不是 BFF 适配缺口，而是 upstream 旧路径已坏、新路径字段退化
- 现在需要 DBA / 运维确认的，不再是“前端/BFF 有没有继续补代码”，而是 B25 的正式归属和 legacy 侧最终数据口径

需要你们重点确认这几件事：

1. `siteId=140` 当前正式口径到底是什么：
   - 是否永久主链路绑定 `126lnoffice`
   - 还是仍应恢复 `appid=140` / `140btwentyfive`
2. 为什么 live 中央元数据和 schema 层已经没有：
   - `appid=140`
   - `140btwentyfive`
   - `140`
   - `140_data`
3. `work-orders` / `knowledge` 当前空数据，是业务上确实为空，还是 backing table / view / 默认筛选已经漂移
4. `imbalance table` 为什么会出现：
   - 旧 path `140` 直接 `500`
   - 新 path `140btwentyfive + appId=140` 返回 `200` 但缺少 `drName/drTypeName`

我整理了三份材料，方便直接接手核查：

- 清单：[LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_DBA_CHECKLIST_CURRENT.md)
- SQL：[legacy-site-140-live-check.sql](/Users/billchow/Documents/智慧冷冻站/docs/legacy-site-140-live-check.sql)
- 根因记录：[LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_SITE_140_ROOT_CAUSE_CURRENT.md)

应用侧当前会继续维持现有兼容边界，不再继续扩大业务 fallback：

- 主链路 realtime 仍按现有配置走 `preferredProjectKey=126lnoffice`
- 页面级兼容暂时维持：
  - `work-orders/knowledge -> 140btwentyfive`
  - `imbalance curve -> appId=140`
  - `imbalance table -> path=140btwentyfive + appId=140`

因此，当前更合理的处理方式是维持现有 BFF 兼容边界，等待 DBA / legacy 侧最终归属确认。其中：

- `work-orders / knowledge` 按 upstream 真实空处理
- `imbalance` 按 upstream 数据质量问题升级
- 不再归因为本地适配或前端展示问题

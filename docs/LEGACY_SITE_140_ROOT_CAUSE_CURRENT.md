# LEGACY_SITE_140_ROOT_CAUSE_CURRENT

## 1. 当前结论

`siteId=140` 的 BFF 主链路已经通过 `preferredProjectKey=126lnoffice` 收口。legacy 根因也已经比前一轮更清楚，不再应描述为“先查 8098 抖动”。

当前更准确的结论是：

- 配置/映射层：
  - `140` 的稳定可用 legacy 项目标识当前应指向 `126lnoffice`
  - `140btwentyfive` 是 B25 项目原始建档时就存在的 key，不是前端或 BFF 临时拼错
  - 但它并不是所有页面都可直接作为单一统一 key 使用
  - 截至 `2026-04-11`，B25 页面级口径已经进一步坐实为“分接口分标识”：
    - `work-orders` / `knowledge` 列表路径使用 `140btwentyfive`
    - `imbalance curve` 查询参数使用 `appId=140`
    - `imbalance table` 必须使用路径 `140btwentyfive`，同时保留查询参数 `appId=140`
- legacy 数据/Schema 层：
  - `140btwentyfive`、`140`、`140_data` 在 live MySQL 中当前连 schema 都不存在
  - 因而应用日志里出现的“缺表”本质上是：请求仍在访问一套已经被移除或未恢复的历史库名
  - 这会直接导致 `500`，不是前端误报，也不是 BFF 逻辑导致
  - 从当前交付资料看，更像“现网库/切库副本不完整”，而不是“原始项目定义里本来就没有这些表”
- 页面级数据层：
  - `work-orders` 当前不是“本地映射错了”，而是上游返回真实空数据
  - `knowledge/documents` 当前也不是“本地映射错了”，而是上游返回真实空数据
  - `imbalance` 当前不是“整体不可用”，而是旧表格 path 仍 `500`，兼容 path 已恢复，但上游表格字段退化为仅有比例值，缺少 `drName/drTypeName`
- 排查环境层：
  - `apps/chiller-bff/scripts/check-legacy-site-root-cause.js` 在当前 Codex Node 沙箱里访问 `127.0.0.1:8098` 会被拦，出现假性的 `transport_failed`
  - 因此，前一轮“8098 传输级抖动”的判断应下调为“当前脚本运行环境存在本地回环访问限制”，不能再作为主结论

## 2. 已确认证据

### 2.1 BFF 侧已稳定绕开坏 key

在本地 BFF 重启并加载最新代码后：

- `GET /bff/v1/sites/140/anomalies/summary`
  - 当前直接返回：
    - `/126lnoffice/getAllSubsystemInfo`
    - `/zsqy/qsAlarmlog/126lnoffice/findNewAlarmLog`
  - `sourceStatus.overall=ok`
  - 不再出现先探测 `140btwentyfive` 的链路痕迹

### 2.2 admin DB 已正式落库稳定绑定

当前 `apps/chiller-bff/.local/admin.sqlite` 中：

- `siteId=140`
- `databaseKey=140btwentyfive`
- `modelKey=126lnoffice`
- `preferredProjectKey=126lnoffice`
- `template=1`

### 2.3 2026-04-09 现场 shell curl 证明 8098 当前可达

2026-04-09 05:01:19 CST，直接执行：

- `curl -vk -m 3 http://127.0.0.1:8098/126lnoffice/getAllSubsystemInfo`
  - TCP 连接建立成功
  - HTTP `200 OK`
  - 返回 `<status>20000</status><msg>OK</msg>`

同一轮验证里，直接执行：

- `curl -vk -m 3 http://127.0.0.1:8098/140btwentyfive/getAllSubsystemInfo`
  - TCP 连接建立成功
  - HTTP `500 Server Error`
  - 返回 `<path>/140btwentyfive/getAllSubsystemInfo</path>`

这说明当前主问题不是“8098 没监听”，而是不同标识对应的数据源质量不同。

### 2.4 legacy 日志已坐实缺表/错库

`/private/tmp/chiller-legacy-backend.log` 中已经出现明确 SQL 异常：

- `Table '140btwentyfive.qs_alarmlog' doesn't exist`
  - 对应 `SELECT a.* FROM \`140btwentyfive\`.qs_alarmlog a order by a.time DESC limit 3`
- `Table '140btwentyfive.drinfo' doesn't exist`
- `Table '140.qstag' doesn't exist`
  - 对应 `select * from \`140\`.qstag where tagname=?`
- `Table '140_data.tagdata_20260401' doesn't exist`
- `Table '140_data.tagdata_20260301' doesn't exist`
- `Table '140_data.tagdata_20260201' doesn't exist`
- `Table '140_data.tagdata_20260101' doesn't exist`
- `Table '140_data.tagdata_20251201' doesn't exist`

这已经足够证明：`140` 相关 legacy 库并不完整，失败根因不是单一接口偶发。

### 2.4.1 live MySQL 已进一步坐实：这三套 schema 当前根本不存在

2026-04-09 通过 JDBC 直连 `192.168.110.250:3306` 查询 `information_schema`，结果是：

- `schema_exists 140btwentyfive=no`
- `schema_exists 140=no`
- `schema_exists 140_data=no`
- `schema_exists 126lnoffice=yes`
- `schema_exists 126lnoffice_data=yes`

同时：

- `schema_name LIKE '140%'` 返回 `<none>`
- `schema_name LIKE '%btwentyfive%'` 返回 `<none>`

这说明当前 live MySQL 里并不是“140 系 schema 还在，只是缺几张表”，而是：

- `140btwentyfive`
- `140`
- `140_data`

这三套 schema 当前已经整体不存在。

### 2.5 `126lnoffice` 的关键表链路当前是通的

`/Users/billchow/Documents/智慧冷冻站/logs/coldSite-service.log` 在 2026-04-09 04:54 至 05:00 期间持续出现：

- `select * from \`126lnoffice\`.homepage_param`
- `from \`126lnoffice\`.qstag q LEFT JOIN \`126lnoffice\`.multilingual`
- `from \`126lnoffice\`.drtypeinfo a left join \`126lnoffice\`.pic`

说明此前判断里提到的 `drtypeinfo`、`multilingual`、`homepage_param`，在 `126lnoffice` 这套库下当前确实存在且可查询。

### 2.6 `140 -> 140btwentyfive` 的来源已定位到项目建档数据

前端项目切换逻辑并不是随意拼接：

- `legacy-src-full/web/src/store/modules/project.js`
  - 明确使用 `path = appid + appName`

而 B25 项目交付目录里的中央库 dump 已明确包含：

- `B25/zsqydata.sql`
  - `zsqy_v1.appmanager`:
    - `appid=140`
    - `appName='btwentyfive'`
    - `appexplain='观澜B25'`
  - `zsqy_v1.appusergroup`:
    - `userid=123 -> appid=140`
    - `userid=124 -> appid=140`

这意味着：

- 进入该项目时得到的 legacy path 本来就会是 `140btwentyfive`
- 当前出现 `140btwentyfive`，不是某次回归把 `140 + btwentyfive` 错拼出来，而是这套项目元数据最初就是这样建的

### 2.6.1 但 live `zsqy_v1.appmanager` 中，`appid=140` 现已不存在

同一轮 JDBC 查询里，对 live `zsqy_v1.appmanager` 执行：

- `WHERE appid = 140`
- 模糊匹配 `b25`
- 模糊匹配 `foxconn/guanlan`

结果均为 `<none>`。

这意味着当前线上中央元数据已经和 B25 初始交付 dump 明显分叉：

- 交付 dump 里，`appid=140/appName=btwentyfive` 是存在的
- live 中央库里，这条记录当前已经不存在，也没有任何明显的 B25 候选替代记录

因此当前链路失败，不只是“项目库没了”，而是“中央映射和项目库都已从 live 元数据侧被清空或迁走”。

### 2.7 B25 初始项目库也证明了 `140btwentyfive` 是原始项目库名

`B25/140初始的结构和数据.sql` 中可直接看到：

- 库名就是 `140btwentyfive`
- `appinfo.appname='btwentyfive'`
- `buildinfo.appid=140, appname='btwentyfive'`
- `homepage_param` 在初始 dump 中是存在且有 17 行数据的

这说明当前线上/现网出现的“缺 `homepage_param` / `drinfo` / `qs_alarmlog` / `multilingual` / `param_type`”并不是项目从一开始就没有这些表，而更像是：

- 当前被访问的 `140btwentyfive` 库不是完整初始化后的版本
- 或者后续导库/迁移/切库时出现了结构漂移

### 2.8 B25 交付目录缺少 `140_data` / 增量补丁材料

对 `冷站项目部署` 总目录横向比对后，可以看到：

- 像 `F11`、`深圳福田深港合作区` 这类项目目录，通常会同时保留：
  - 项目主库 dump
  - `*_data` 或“云端/部分数据”材料
  - 后续更新脚本，如 `更新前/更新后/部分数据（更新）*.sql`
- 但 `B25` 目录当前只保留了：
  - `140初始的结构和数据.sql`
  - `zsqydata.sql`
  - `zsqy结构.sql`
  - 通讯表和启动脚本
- 没有发现：
  - `140_data` 或 `140btwentyfive_data` dump
  - B25 专属的“部分数据更新/更新前后/云端结构”脚本

这和当前运行日志里同时报 `140btwentyfive.*`、`140.qstag`、`140_data.tagdata_*` 缺失是吻合的：应用仍在依赖一套“项目库 + 独立 data 库”的历史命名，但 live MySQL 里这三套 schema 已经不存在，而手头交付物里也只保留了 B25 的初始项目库快照，缺少后续 data 库和增量迁移材料。

### 2.9 当前找到的 B25 后续材料，只涉及云端报表瘦身

在 `0、SQL脚本/阿里云数据库业务数据空间整理/云端数据库B25项目执行接口清除数据库空间.txt` 中，B25 相关内容只有：

- 通过 `appId=140` 调用 `/zsqy/repairData/deleteDataForMonths`
- 清理：
  - `reg_value_one_hour`
  - `reg_value_half_hour`
  - `reg_value_ten_min_2023/2024/2025`
- 随后执行 `ALTER TABLE ... ENGINE=INNODB` 和 `ANALYZE TABLE`

这类材料只能解释“历史报表数据瘦身”，不能解释：

- `140btwentyfive.drinfo` 不存在
- `140btwentyfive.qs_alarmlog` 不存在
- `140btwentyfive.homepage_param` 不存在
- `140.qstag` 不存在
- `140_data.tagdata_YYYYMM01` 不存在

因此，当前更合理的判断是：

- B25 至少经历过一次与初始交付物不一致的现网重建、切库、删库或元数据清理
- 丢失的是整套运行所需 schema / 中央映射，不是单纯历史统计数据被清理

### 2.10 `2026-04-11` 页面级 upstream probe 已把 B25 三类剩余问题分开坐实

`2026-04-11` 通过新脚本：

- `apps/chiller-bff/scripts/check-b25-upstream-data.js`

在非沙箱环境实跑，生成：

- `docs/b25-upstream-data-latest.json`

本轮机器快照摘要为：

- `ready=17`
- `failed=1`
- `transport=0`

这说明本轮判断不再依赖手工零散 `curl`，而是已经有一份可重复执行的页面级 upstream 探测快照。

### 2.11 `imbalance` 已确认是“旧 path 500 + 新 path 字段退化”，不是本地适配缺口

`2026-04-11` 这轮 probe 中：

- `curve`
  - `GET /zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
  - 返回 `200`
  - `status=20000`
- `table` 旧路径
  - `GET /zsqy/energyanalysis/140/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
  - 返回 `500`
- `table` 兼容路径
  - `GET /zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11`
  - 返回 `200`
  - `status=20000`

同时，脚本还对 `2026-04-09`、`2026-04-10`、`2026-04-11` 三个样本窗连续抽样，结果一致：

- 都能稳定拿到 `dataStatisticsList`
- 都只能拿到一个仅含 `scalarRate` 的 `tableList`
- 连续三天都没有 `drName`
- 连续三天都没有 `drTypeName`

这意味着：

- `imbalance table` 当前真正可用的 path 应是 `140btwentyfive`
- 但即便 path 改对，上游也只返回汇总比例，不返回设备名称
- 因而当前阻塞点已经不是 BFF 路由或 adapter 兼容，而是 upstream 表结构/字段退化

### 2.12 `work-orders` 当前可以按“upstream 真实空”处理

`2026-04-11` probe 中，以下口径均返回 `200` 且数据为 `0`：

- `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=10`
  - `rowCount=0`
- `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=50&state=1`
  - `rowCount=0`
- `GET /zsqy/qsworkorder/140btwentyfive/findObject?pageCurrent=1&pageSize=50&state=0`
  - `rowCount=0`
- `GET /zsqy/qsworkorder/140btwentyfive/findEC`
  - `未处理=0`
  - `正在处理=0`
  - `处理完毕=0`
- `GET /zsqy/qsworkorder/140btwentyfive/findWorkOrderList`
  - `200 OK`
  - 但没有可用数据

因此，截至 `2026-04-11`，`work-orders` 不仅是当前 BFF 主列表为空，连旧实现线索里的 `findWorkOrderList` 和概览 `findEC` 也没有提供非空证据，当前可按“upstream 真实空”收口。

### 2.13 `knowledge` 当前也可以按“upstream 真实空”处理

`2026-04-11` probe 中：

- `GET /zsqy/instructions/140btwentyfive/findObject?pageCurrent=1&pageSize=50`
  - `rowCount=0`
- `GET /zsqy/instructions/140btwentyfive/findAll`
  - `200 OK`
  - 无 `data`

同一轮还对 B25 当前真实设备类型逐个探测：

- `72 智能楼宇系统`
- `167 电量记录`
- `172 制冷量`
- `174 散热量`

逐个执行：

- `GET /zsqy/instructions/140btwentyfive/findAll?instructionsTypeid=<typeId>`

四个类型全部返回：

- `200 OK`
- `items=[]`

这说明知识库不仅分页主列表为空，连按类型的旧接口也为空，当前没有可用 fallback。

## 3. 为什么之前 probe 会全量 `transport_failed`

本轮已复核出这是运行环境假象，不应继续当成 upstream 事实：

- `node -e "fetch('http://127.0.0.1:8098/...')"` 返回 `fetch failed`，`cause=EPERM`
- `node` 进程内 `execFileSync('curl', ...)` 也会返回 `curl: (7) Failed to connect`
- 但同机 shell 直接执行 `curl -vk` 又能连通并拿到真实 `200/500`

因此：

- 当前 `check-legacy-site-root-cause.js` 的 `transport_failed` 结果，在 Codex 沙箱里只能作为“脚本运行环境受限”的信号
- 不能再据此推导 “8098 正在传输级抖动”

## 4. 当前阻塞点

当前真正未完成的不是 BFF，也不是 `8098` 可达性，而是 legacy 侧的最终归属决策与 upstream 数据质量：

- `siteId=140` 到底应永久绑定 `126lnoffice`
- 还是 `140btwentyfive/140/140_data` 这些库本来就该整套恢复成正式库，并把中央 `appmanager` 记录补回
- `imbalance table` 为什么在兼容 path 下只返回比例字段，不返回 `drName/drTypeName`
- B25 的工单/知识库为什么在主列表、旧列表、按类型列表上都同时为空

如果不先把这个决策做掉，BFF 只能继续维持兼容兜底，不能算根因修复完成。

## 5. 下一步建议

1. 先在 legacy 或配置层确认 `140` 的正式 realtime/database key
2. 如果正式 key 就是 `126lnoffice`
   - 保留当前 `preferredProjectKey=126lnoffice`
   - 同时清理或下线 `140btwentyfive` 相关错误映射，避免后续系统再回退到坏库
   - 对页面级口径继续维持当前兼容：
     - `work-orders/knowledge -> 140btwentyfive`
     - `imbalance curve -> appId=140`
     - `imbalance table -> path=140btwentyfive + appId=140`
   - 但不要再继续扩大 `work-orders/knowledge` 的 BFF fallback，因为当前探测已显示 upstream 本身为空
3. 如果正式 key 应该是 `140btwentyfive`
   - 需要先核对现网为什么把 `appid=140` 和 `140*` schema 从中央库/项目库里整体移除
   - 优先追查是否存在未归档的 `140_data` dump、云端部分数据包、切库记录、删库记录或替代 appid
   - 然后补齐至少以下缺失：
     - `140btwentyfive.qs_alarmlog`
     - `140btwentyfive.drinfo`
     - `140btwentyfive.multilingual`
      - `140btwentyfive.homepage_param`
      - `140btwentyfive.param_type`
      - `140.qstag`
      - `140_data.tagdata_YYYYMM01` 分表
   - 同时补齐 `imbalance table` 的设备字段：
     - `drName`
     - `drTypeName`
4. 后续若继续使用 `check-legacy-site-root-cause.js`
   - 应在非受限 shell 或目标主机上执行
   - 不要再直接用当前 Codex Node 沙箱里的 `transport_failed` 结果判断 8098 健康度
5. 页面级后续排障建议
   - `work-orders` 与 `knowledge` 当前可以明确标注为“upstream 真实空”，不建议继续在 BFF 内做无依据补数
   - `imbalance` 则应转为 upstream 数据质量问题单，主诉求不是“恢复接口可达”，而是“返回完整设备字段”

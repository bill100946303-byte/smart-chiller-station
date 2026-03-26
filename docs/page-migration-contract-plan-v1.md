# 旧页面迁移合同计划 v1

## 1. 评估边界

本次只从现有 BFF 合同与已确认可用的旧接口出发，评估 4 个页面的承接难度与迁移顺序。

输入依据：

- [bff-aggregation-design.md](/Users/billchow/Documents/智慧冷冻站/docs/bff-aggregation-design.md)
- [bff-v1.yaml](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/bff-v1.yaml)
- [release-command-center-contract-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-contract-v1.md)
- [system-findings.md](/Users/billchow/Documents/chiller-station-legacy/docs/system-findings.md)

说明：

- `release-command-center` 属于运维/发布门禁，不提供页面业务数据，本次只把它作为“BFF 当前已具备稳定交付能力”的旁证，不纳入页面接口来源。
- 旧接口存在两类状态：
  - `稳定可复用`
  - `恢复可用但尚未进入 BFF P0 口径`

其中需要特别注意：

- `bff-aggregation-design.md` 仍把 `/api/device/...` 视为首期不建议强依赖
- 但 `system-findings.md` 已记录 `/api/device/126lnoffice/data` 与 `/api/device/126lnoffice/data/tree` 在本地恢复后可返回数据

因此本次对设备相关页面的判断是：

- `旧接口可作为二级来源`
- `但还不应直接视为现成 BFF 主合同`

## 2. 四页总表

| 页面 | 现有 BFF 可复用 | 现有旧接口可复用 | 当前承接判断 | 难度 |
| --- | --- | --- | --- | --- |
| 告警页 | `anomalies/summary` | `/{dbName}/getAllSubsystemInfo`、`/zsqy/qsAlarmlog/{dbName}/findNewAlarmLog` | 摘要版可直接承接；完整版需补新聚合 | 中 |
| 设备总览页 | `dashboard/overview`、`system/topology` | `/zsqy/drinfo/{dbName}/findObject`、`/api/device/{dbName}/data`、`/api/device/{dbName}/data/tree` | 可先承接摘要版/骨架版；完整版需补新聚合 | 中高 |
| 趋势分析页 | `dashboard/trends`、`dashboard/overview` | `/zsqy/homepage/{dbName}/getEnergyStatisticsCurve`、`/zsqy/homepage/{dbName}/getRunParamsCurve`、`/zsqy/homepage/{dbName}/getEquipmentEnergyStatisticsCurve` | 可直接承接 | 低 |
| 2D/3D 场景控制页 | 无现成页面级 BFF 合同 | 旧 2D/3D 静态资源、`/user/login`、`/user/dologin`、`/zsqy/sysmenuinfo/{dbName}/findAllMenu` | 暂时只能 iframe / 外壳承接 | 很高 |

## 3. 分页评估

### 3.1 告警页

现有 BFF 可复用：

- `GET /bff/v1/sites/{siteId}/anomalies/summary`

现有旧接口可复用：

- `GET /{dbName}/getAllSubsystemInfo`
- `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

当前可直接承接的范围：

- 告警总数卡片
- 最近告警列表（最近几条）
- 数据是否陈旧
- 诊断标记，例如 `staleAlarmFeed`

当前缺口：

- 全量告警列表
- 分页 / 筛选 / 按等级过滤
- 告警详情
- 工单联动

结论：

- `摘要版可直接承接`
- `完整版需要新聚合接口`

建议新增接口：

- `GET /bff/v1/sites/{siteId}/anomalies/list`
- 可选后续：`GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`

判断原因：

- 现有 `anomalies/summary` 更像首页摘要与诊断摘要接口，不是完整告警中心接口
- 旧接口 `findNewAlarmLog` 适合最近告警，不足以直接承载告警页完整版

### 3.2 设备总览页

现有 BFF 可复用：

- `GET /bff/v1/sites/{siteId}/dashboard/overview`
- `GET /bff/v1/sites/{siteId}/system/topology`

现有旧接口可复用：

- `GET /zsqy/drinfo/{dbName}/findObject?pageCurrent=1&pageSize=100`
- `GET /api/device/{dbName}/data`
- `GET /api/device/{dbName}/data/tree`

当前可直接承接的范围：

- 设备总数
- 主机 / 冷冻泵 / 冷却泵 / 冷却塔数量
- 楼层 / 分组 / 系统桶骨架
- 基础拓扑节点

当前缺口：

- 设备列表页
- 设备树导航
- 设备实时点位 / 当前状态
- 设备详情面板

额外风险：

- `system/topology` 合同已经存在，但当前 example 仍体现 `sourceStatus.overall=failed`
- 说明该接口方向正确，但“稳定承接完整设备页”还差一层收口
- `/api/device/...` 虽已在旧系统恢复后可返回，但还没有被 BFF 正式吸纳成稳定合同

结论：

- `可先承接摘要版 / 骨架版`
- `完整版需要新聚合接口`

建议新增接口：

- `GET /bff/v1/sites/{siteId}/devices/list`
- `GET /bff/v1/sites/{siteId}/devices/tree`
- `GET /bff/v1/sites/{siteId}/devices/{deviceId}`

判断原因：

- `drinfo` 适合做静态设备清单与分组
- `/api/device/data` 与 `/api/device/data/tree` 更像设备运行态 / 树结构来源，适合作为 BFF 二期增强

### 3.3 趋势分析页

现有 BFF 可复用：

- `GET /bff/v1/sites/{siteId}/dashboard/trends`
- 可选辅助：`GET /bff/v1/sites/{siteId}/dashboard/overview`

现有旧接口可复用：

- `GET /zsqy/homepage/{dbName}/getEnergyStatisticsCurve`
- `GET /zsqy/homepage/{dbName}/getRunParamsCurve`
- `GET /zsqy/homepage/{dbName}/getEquipmentEnergyStatisticsCurve`

当前可直接承接的范围：

- 趋势折线图
- 指标 latest/min/max
- 24h / 7d / 30d 范围切换
- 功率与运行参数统一展示
- 趋势区 sourceStatus / freshness

当前缺口：

- 高级对比分析
- 自定义指标组合
- 导出 / 回放 / 多图联动

结论：

- `当前可直接承接`

建议：

- 首批无需新增聚合接口
- 若后续要做高级分析，再补：
  - `GET /bff/v1/sites/{siteId}/dashboard/trends/compare`
  - 或增加 `metrics=` / `groupBy=` 等查询参数

判断原因：

- 现有 `dashboard/trends` 已经是“前端直接可画图”的结构
- 这是四个页面里与当前 BFF 合同贴合度最高的一页

### 3.4 2D/3D 场景控制页

现有 BFF 可复用：

- `无现成页面级接口`

现有旧接口 / 旧资源可复用：

- 2D 静态页：`http://127.0.0.1:4000/2d/floor/ten/`
- 3D 静态页：`http://127.0.0.1:4000/3d/floor/ten/`
- `GET /user/login`
- `GET /user/dologin`
- `GET /zsqy/sysmenuinfo/{dbName}/findAllMenu`

当前可直接承接的范围：

- 旧页面外壳接入
- 单点登录 / token 透传
- 菜单与跳转入口保留

当前缺口：

- 场景节点模型合同
- 设备点位映射合同
- 控制指令合同
- 2D/3D 与 BFF 的统一状态层

额外风险：

- 旧 2D/3D 当前依赖 Nginx `sub_filter` 和地址重写
- 资源里仍有写死地址
- 这意味着它更像“旧静态应用挂载”，不是已可原生迁移的页面合同

结论：

- `暂时只能 iframe / 外壳承接`

建议：

- 短期：保留旧 2D/3D 页面，以 iframe / 外壳方式接入新壳
- 中期：若要原生迁移，再单独定义：
  - `GET /bff/v1/sites/{siteId}/scene/context`
  - `GET /bff/v1/sites/{siteId}/scene/devices`
  - `POST /bff/v1/sites/{siteId}/scene/commands`

判断原因：

- 当前既没有 BFF 场景合同，也没有稳定的控制面抽象
- 直接原生重做成本最高，且风险最大

## 4. 哪些页面能直接承接

可以直接承接：

- `趋势分析页`

可以先承接摘要版 / 骨架版：

- `告警页`
- `设备总览页`

暂时只能 iframe / 外壳承接：

- `2D/3D 场景控制页`

## 5. 哪些页面需要新聚合接口

明确需要新增聚合接口：

- 告警页
  - `anomalies/list`
  - 可选 `anomalies/{alarmId}`

- 设备总览页
  - `devices/list`
  - `devices/tree`
  - `devices/{deviceId}`

- 2D/3D 场景控制页
  - 若做原生迁移，需新增独立 scene/control 系列接口

当前不必先新增接口：

- 趋势分析页

## 6. 迁移顺序建议（1-4）

### 1. 趋势分析页

原因：

- 现有 `dashboard/trends` 已可直接承接
- 与当前 BFF 合同匹配度最高
- 最容易做出“新前端不拼旧接口”的示范页

### 2. 告警页

原因：

- `anomalies/summary` 已能承接摘要与最近告警
- 在此基础上补一个 `anomalies/list` 即可完成主页面迁移
- 比设备总览页的实时状态整合更容易收口

### 3. 设备总览页

原因：

- 已有 `dashboard/overview + system/topology` 作为基础
- 但完整设备页还需要 BFF 正式包住设备列表 / 树 / 详情
- 适合作为第二批增强页

### 4. 2D/3D 场景控制页

原因：

- 这是明显的旧静态应用 + 地址重写场景
- 当前没有原生 BFF 页面合同
- 应最后迁，或长期保持 iframe/外壳接入

## 7. 建议先迁的 2 页

建议先迁：

1. `趋势分析页`
2. `告警页`

理由：

- 都能较快建立“新页面只吃 BFF”的正向样板
- 一个代表图表聚合，一个代表异常摘要与列表聚合
- 风险明显低于设备实时页和 2D/3D 场景页

# 冷站系统 2.0 BFF / 聚合接口设计

## 1. 设计目标

- 给新首页驾驶舱、系统总览页、异常诊断页、AI 建议页提供可直接渲染的数据。
- 新前端不直接拼旧接口，不接触旧接口中的隐式业务口径。
- 首期优先选用当前 `126lnoffice` 上可稳定返回的数据源；不把当前返回失败的旧接口放进首批强依赖。

建议统一命名：

- `GET /bff/v1/sites/{siteId}/dashboard/overview`
- `GET /bff/v1/sites/{siteId}/dashboard/trends`
- `GET /bff/v1/sites/{siteId}/system/topology`
- `GET /bff/v1/sites/{siteId}/anomalies/summary`
- `GET /bff/v1/sites/{siteId}/recommendations`

其中 `siteId` 直接复用旧库名，例如 `126lnoffice`。

## 2. 当前可复用旧接口

### 2.1 稳定可作为一期来源

1. `GET /zsqy/homepage/{dbName}/getEquipmentEnergyStatisticsCurve`
   - 用途：拿当前设备能耗卡片值。
   - 当前返回结构稳定，字段有 `title`、`tagName`、`tagValue`、`unit`。
   - `126lnoffice` 当前可返回：
     - `Chiller Total Power`
     - `Cooling Tower Total Power`
     - `Chilled Water Pump Total Power`
     - `Condenser Water Pump Total Power`

2. `GET /zsqy/homepage/{dbName}/getEnergyStatisticsCurve`
   - 用途：拿 24 小时功率趋势曲线。
   - 当前返回结构稳定，字段有 `title`、`curveValueList[].name`、`curveValueList[].value`。

3. `GET /zsqy/homepage/{dbName}/getRunParamsCurve`
   - 用途：拿运行参数趋势。
   - 当前返回结构稳定，字段有 `title`、`curveValueList[].name`、`curveValueList[].value`。
   - `126lnoffice` 当前可返回：
     - `冷冻水温差`
     - `冷却水温差`
     - `冷冻出水温度`
     - `冷却回水温度`

4. `GET /zsqy/energycalendar/{dbName}/findTodayEnergy`
   - 用途：当天能效汇总。
   - 当前能返回，但字段是 `m/p/c/e/rte/k` 这类短字段，业务语义不透明。
   - 结论：可作为二级来源或内部调试字段，不建议首期直接映射给新前端。

5. `GET /zsqy/energycalendar/{dbName}/findMonthEnergy`
   - 用途：当月能效汇总。
   - 风险同上，短字段口径未确认。

6. `GET /zsqy/drinfo/{dbName}/findObject?pageCurrent=1&pageSize=100`
   - 用途：设备清单、楼栋楼层、设备类型、图标路径。
   - `126lnoffice` 当前稳定返回 59 条设备。
   - 关键字段：
     - `drid`
     - `drname`
     - `drcode`
     - `drtypeid`
     - `drtypename`
     - `buildid` / `buildname`
     - `floorId` / `floorName`
     - `iconpath`
     - `typeYT`
     - `isEnergy`

7. `GET /{dbName}/getAllSubsystemInfo`
   - 用途：子系统在线离线概况 + 告警总量 + 最近告警。
   - 当前返回字段包括：
     - 多个 `*DeviceInfo` 节点：`deviceOnlineNum`、`deviceTotalNum`、`deviceOfflineNum`
     - 多个 `alarmInfo` 节点：`name`、`value`
     - 多个 `alarmEvent` 节点：最近告警事件

8. `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`
   - 用途：最近告警列表。
   - 当前返回结构稳定，字段包括：
     - `id`
     - `time`
     - `regId`
     - `alarmvalue`
     - `alarmLevel`
     - `alarmRange`
     - `alarmstate`

9. `GET /user/login`
   - 用途：用户名密码登录。
   - 角色：BFF 的认证透传来源，不建议新前端直接依赖。

10. `GET /user/dologin`
    - 用途：token 鉴权。
    - 角色：BFF 的 session/token 校验来源。

11. `GET /zsqy/sysmenuinfo/{dBname}/findAllMenu`
    - 用途：旧菜单权限来源。
    - `126lnoffice` 当前可返回 `OK`，但 `data` 为空。
    - 角色：仅保留作兼容权限来源，不适合作为新页面主数据源。

### 2.2 当前不建议作为一期强依赖

1. `GET /api/homeData/{dbName}/energyEfficiency`
   - 2026-03-11 实测：`{"status":50009,"msg":"查询失败"}`
   - 结论：当前对 `126lnoffice` 不稳定。

2. `GET /api/device/{dbName}/data`
   - 2026-03-11 实测：HTTP 500。
   - Swagger 要求 `mock` 参数，但补齐 `mock=true/false/0/1` 仍未稳定返回。

3. `GET /api/device/{dbName}/data/tree`
   - 2026-03-11 实测：`{"error":"获取待绑定的变量列表树失败"}`
   - 结论：更像设备绑定管理接口，不适合作为新首页/总览页的首期来源。

4. `GET /api/device/{dbName}/device/data`
   - 2026-03-11 实测：HTTP 500。

5. `GET /zsqy/qsAlarmlog/{dbName}/findAlarmListHome`
   - 2026-03-11 实测：`50009 查询失败`。

6. `GET /zsqy/energyanalysis/getEnergyAnalysisPie`
   - 2026-03-11 实测：HTTP 500。

## 3. 新接口清单

## 3.1 `GET /bff/v1/sites/{siteId}/dashboard/overview`

- 目标页面：首页驾驶舱、系统总览页顶部摘要区
- 目标：一次返回当前页首屏卡片需要的全部摘要，不让前端自己拆多个旧接口

建议返回字段：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站",
    "buildingCount": 1,
    "floorCount": 2
  },
  "energyCards": [
    {
      "metricKey": "chiller_total_power",
      "metricName": "Chiller Total Power",
      "value": 7.9,
      "unit": "kW"
    }
  ],
  "deviceSummary": {
    "totalDevices": 59,
    "operationalDeviceCount": 45,
    "meterDeviceCount": 14,
    "deviceTypeCount": 20
  },
  "alarmSummary": {
    "critical": 702,
    "major": 221,
    "minor": 1489,
    "normal": 34977,
    "latestAlarmTime": "2025-11-08 16:07:00"
  },
  "freshness": {
    "generatedAt": "2026-03-11T22:00:00+08:00",
    "alarmDataStale": true
  }
}
```

旧数据来源：

- `/zsqy/homepage/{dbName}/getEquipmentEnergyStatisticsCurve`
- `/zsqy/drinfo/{dbName}/findObject`
- `/{dbName}/getAllSubsystemInfo`
- `/zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

需要聚合计算：

- 需要
- 把旧接口多条 `data` 记录归并为统一 `energyCards`
- 把 `drinfo` 设备清单聚合成设备总数、楼层数、类型数
- 把 `alarmInfo.name` 归一成 `critical/major/minor/normal`
- 计算 `alarmDataStale`

## 3.2 `GET /bff/v1/sites/{siteId}/dashboard/trends`

- 目标页面：首页驾驶舱趋势区、系统总览趋势区、AI 页证据面板
- 目标：把功率趋势和运行参数趋势做成前端直接可画图的统一结构

建议查询参数：

- `range=today|7d|30d`
- `modules=power,run_params`

建议返回字段：

```json
{
  "range": "today",
  "series": [
    {
      "seriesKey": "chiller_total_power",
      "seriesName": "Chiller Total Power",
      "unit": "kW",
      "points": [
        { "ts": "2026-03-11 00:00", "value": 0.3 }
      ],
      "stats": {
        "latest": 0.3,
        "min": 0.3,
        "max": 0.4
      }
    },
    {
      "seriesKey": "chw_delta_t",
      "seriesName": "冷冻水温差",
      "unit": null,
      "points": [
        { "ts": "2026-03-11 00:00", "value": -1.1 }
      ],
      "stats": {
        "latest": -0.4,
        "min": -1.1,
        "max": 1.2
      }
    }
  ]
}
```

旧数据来源：

- `/zsqy/homepage/{dbName}/getEnergyStatisticsCurve`
- `/zsqy/homepage/{dbName}/getRunParamsCurve`

需要聚合计算：

- 需要
- 不同旧曲线结构统一成 `series[]`
- 统一时间轴字段
- 过滤空值、补 `null`
- 计算 `latest/min/max`

## 3.3 `GET /bff/v1/sites/{siteId}/system/topology`

- 目标页面：系统总览页、异常诊断页的设备关系区域
- 目标：先给出“可渲染的系统拓扑骨架”，不是把旧设备接口原样透给前端

建议返回字段：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "buildingName": "6期1栋"
  },
  "summary": {
    "totalDevices": 59,
    "buildingCount": 1,
    "floorCount": 2
  },
  "groups": [
    {
      "groupKey": "roof",
      "groupName": "楼顶",
      "deviceCount": 29
    },
    {
      "groupKey": "floor_10",
      "groupName": "10楼",
      "deviceCount": 30
    }
  ],
  "systemBuckets": [
    {
      "systemKey": "fan_coil",
      "systemName": "风机盘管",
      "deviceCount": 29
    },
    {
      "systemKey": "chiller",
      "systemName": "主机/冷机",
      "deviceCount": 1
    }
  ],
  "nodes": [
    {
      "deviceId": 2,
      "deviceCode": "CH1",
      "deviceName": "1#冷水机",
      "systemKey": "chiller",
      "systemName": "主机/冷机",
      "buildingName": "6期1栋",
      "floorName": "楼顶",
      "deviceUsageType": "operational",
      "iconPath": "/imgs/126lnoffice/Device/ConditioningChillerStopGray.png"
    }
  ]
}
```

旧数据来源：

- `/zsqy/drinfo/{dbName}/findObject`
- `/{dbName}/getAllSubsystemInfo`

需要聚合计算：

- 需要
- `drtypename` 映射成稳定的 `systemKey`
- `typeYT=1/2` 映射成 `operational/meter`
- 聚合楼层、系统桶、设备计数
- 首期不依赖 `/api/device/...` 的实时点位

## 3.4 `GET /bff/v1/sites/{siteId}/anomalies/summary`

- 目标页面：异常诊断页、首页异常摘要卡
- 目标：把告警数量、最新异常、是否陈旧等直接整理好

建议返回字段：

```json
{
  "counts": {
    "critical": 702,
    "major": 221,
    "minor": 1489,
    "normal": 34977
  },
  "latestEvents": [
    {
      "alarmId": 59775,
      "occurredAt": "2025-11-08 16:07:00",
      "regId": 32,
      "severity": "major",
      "state": 0,
      "value": "1"
    }
  ],
  "diagnosisFlags": {
    "hasRecentAlarms": false,
    "alarmDataStale": true
  },
  "sourceStatus": {
    "workOrderLinked": false
  }
}
```

旧数据来源：

- `/{dbName}/getAllSubsystemInfo`
- `/zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`
- 可选：`/zsqy/qsworkorder/{dbName}/findWorkOrderList`

需要聚合计算：

- 需要
- 告警中文等级映射成统一 severity
- 合并两个来源的最近告警
- 计算最近告警是否超过阈值，例如 24h/72h
- 首期不强依赖工单接口，避免空数据拖累主接口

## 3.5 `GET /bff/v1/sites/{siteId}/recommendations`

- 目标页面：AI 建议页
- 目标：前端拿到可直接渲染的建议卡片，而不是自己拼指标、告警、知识库再去调模型

建议返回字段：

```json
{
  "summary": {
    "total": 3,
    "highPriority": 1
  },
  "cards": [
    {
      "id": "rec-001",
      "title": "检查告警数据链路时效",
      "priority": "high",
      "category": "data-quality",
      "reason": "最近告警时间早于当前日期较多，异常页可能展示历史残留告警。",
      "evidence": [
        "latestAlarmTime=2025-11-08 16:07:00",
        "generatedAt=2026-03-11"
      ],
      "actions": [
        "确认告警采集链路是否持续入库",
        "核对 regId=32 对应点位当前状态"
      ],
      "relatedDevices": []
    }
  ],
  "sourceStatus": {
    "ruleEngine": true,
    "aiEngine": false,
    "knowledgeBaseItemCount": 0
  }
}
```

旧数据来源：

- `dashboard/overview` 聚合结果
- `dashboard/trends` 聚合结果
- `anomalies/summary` 聚合结果
- `system/topology` 聚合结果
- `/zsqy/instructions/{dBname}/findAll`
- 未来可选：`/api/ai/deepseek/{dbName}/chat`

需要聚合计算：

- 需要，而且是强聚合
- 首期建议先做规则引擎，不把旧 AI 接口作为强依赖
- 规则引擎输出 `reason/evidence/actions`
- 知识库为空时也要正常返回建议卡片

## 4. 每个接口的作用与定位

| 接口 | 主要作用 | 页面 |
| --- | --- | --- |
| `dashboard/overview` | 首屏摘要卡，一次返回功率、设备、告警、数据新鲜度 | 首页驾驶舱、系统总览 |
| `dashboard/trends` | 趋势图统一输出，前端直接画折线图 | 首页驾驶舱、系统总览、AI 页 |
| `system/topology` | 拓扑骨架、楼层分组、系统分桶、设备节点清单 | 系统总览、异常诊断 |
| `anomalies/summary` | 异常总数、最近异常、是否陈旧、诊断标记 | 异常诊断、首页摘要 |
| `recommendations` | AI/规则建议卡片，前端不拼证据 | AI 建议页 |

## 5. 优先级排序

### P0

1. `dashboard/overview`
2. `dashboard/trends`
3. `anomalies/summary`

原因：

- 这 3 个接口的数据源当前最稳定。
- 能直接支撑新首页驾驶舱。
- 也能为 AI 页提供首批证据上下文。

### P1

4. `system/topology`

原因：

- 设备清单来源稳定，但实时状态来源不稳定。
- 可以先做“静态拓扑 + 设备分桶 + 楼层分组”，后续再补实时点位。

### P2

5. `recommendations`

原因：

- 它依赖前面几个聚合结果更合理。
- 旧知识库当前返回空，旧 AI 接口也不应首期强依赖。
- 应先把推荐卡片 contract 定死，再接规则引擎或 LLM。

## 6. 第一阶段最先开发的 2 到 3 个聚合接口

建议首批只做 3 个：

1. `GET /bff/v1/sites/{siteId}/dashboard/overview`
2. `GET /bff/v1/sites/{siteId}/dashboard/trends`
3. `GET /bff/v1/sites/{siteId}/anomalies/summary`

不建议首批把 `system/topology` 放在最前的原因：

- 当前设备实时接口不稳定。
- 但设备清单接口稳定，所以它适合第二批补齐。

不建议首批把 `recommendations` 放在最前的原因：

- 它本质依赖前面 3 个聚合结果。
- 先把证据层做稳，建议层才不会空转。

## 7. 风险点

1. 旧 `energyEfficiency` 接口当前业务失败
   - 2026-03-11 对 `126lnoffice` 实测返回 `50009 查询失败`
   - 结论：不要把它作为首期首页主来源

2. 旧设备聚合接口当前不稳定
   - `/api/device/{dbName}/data`
   - `/api/device/{dbName}/data/tree`
   - `/api/device/{dbName}/device/data`
   - 当前均未稳定返回
   - 结论：首期拓扑不要依赖这组接口

3. 部分旧能效接口字段语义不透明
   - `findTodayEnergy` / `findMonthEnergy` 中的 `m/p/c/e/rte/k`
   - 结论：没有旧前端口径映射前，不要直接暴露为新前端业务字段

4. 告警数据存在明显陈旧风险
   - `findNewAlarmLog` 与 `getAllSubsystemInfo` 当前最近告警时间为 `2025-11-08`
   - 当前日期为 `2026-03-11`
   - 结论：BFF 必须输出 `freshness/stale` 标记，避免前端把历史告警当实时告警

5. 菜单与知识库数据当前为空
   - `findAllMenu` 返回 `OK` 但无 `data`
   - `instructions/findAll` 返回 `OK` 但无 `data`
   - 结论：权限与 AI 知识增强不能作为首页主链路阻塞条件

## 8. 建议主控下一步

1. 先冻结 3 个 P0 接口 contract
   - `dashboard/overview`
   - `dashboard/trends`
   - `anomalies/summary`

2. 在 BFF 层建立统一数据适配器
   - `legacyEnergyAdapter`
   - `legacyAlarmAdapter`
   - `legacyDeviceAdapter`
   - 不让业务页直接接旧 XML / 旧字段名

3. 给每个 BFF 接口都补 `sourceStatus` 和 `freshness`
   - 明确告诉前端哪些数据是实时、哪些是陈旧、哪些来源失败被降级

4. 单独开一条“旧字段口径确认”任务
   - 专门确认 `findTodayEnergy` / `findMonthEnergy` 的 `m/p/c/e/rte/k` 真实含义
   - 没确认前，不进入新前端正式字段

5. 第二批再接 `system/topology`
   - 先基于 `drinfo/findObject` 做静态拓扑
   - 再评估是否继续修复 `/api/device/...` 这组实时接口

6. 最后接 `recommendations`
   - 先规则引擎
   - 后接模型
   - 推荐页消费的是 BFF 已聚合证据，不直接消费旧接口

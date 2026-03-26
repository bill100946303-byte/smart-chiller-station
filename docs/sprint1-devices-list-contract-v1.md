# Sprint1 `devices/list` 合同 v1

## 1. 结论

本版给设备总览页 Sprint1 的主列表接口一次性收口，目标是让主控可以直接实现，并在后续纳入 OpenAPI 与主门禁。

最终拍板：

- 路径建议：`GET /bff/v1/sites/{siteId}/devices/list`
- `devices/list` 是否属于 Sprint1 P0：`Yes`
- 主控是否可直接实现：`Yes`

一句话口径：

- `dashboard/overview` 负责顶部摘要
- `system/topology` 负责骨架区
- `devices/list` 负责设备总览页主列表区

## 2. 路径定义建议

建议路径固定为：

- `GET /bff/v1/sites/{siteId}/devices/list`

原因：

- 与现有 BFF 命名风格一致
- 和已拍板的 `anomalies/list` 命名对齐
- 页面主列表天然是分页集合接口，不适合放进 `system/topology`

## 3. Query 参数首版最小集

Sprint1 首版最小 query 建议如下：

- `siteId`
  - 位置：path
  - 必填：`Yes`
- `page`
  - 位置：query
  - 必填：`No`
  - 类型：integer
  - 默认值：`1`
- `pageSize`
  - 位置：query
  - 必填：`No`
  - 类型：integer
  - 默认值：`20`
- `type`
  - 位置：query
  - 必填：`No`
  - 类型：string
  - 建议枚举：`chiller|chilledPump|coolingPump|coolingTower|other`
- `floor`
  - 位置：query
  - 必填：`No`
  - 类型：string

Sprint1 不纳入：

- `keyword`
- `status`
- `sort`
- `building`

原因：

- 先把“可浏览 + 可翻页 + 可按设备类型/楼层筛选”做稳
- 不在首版同时引入搜索、排序和复杂筛选，避免接口口径膨胀

## 4. Response Schema 最小字段

### 4.1 顶层最小字段

顶层建议固定为：

- `site`
- `generatedAt`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

字段说明：

- `site`
  - 复用现有 `SiteRef`
- `generatedAt`
  - 当前 BFF 主接口风格已统一保留
- `items`
  - 设备列表数组
- `page/pageSize/total`
  - 设备页主列表必须具备
- `filters`
  - 回显当前筛选条件
- `freshness`
  - 表达运行态增强数据的新鲜度
- `sourceStatus`
  - 表达静态目录与运行态增强来源的可用性

### 4.2 `items[]` 最小字段

`items[]` 最小字段建议固定为：

- `deviceId`
- `deviceCode`
- `deviceName`
- `systemType`
- `floorName`
- `buildingName`
- `usageType`
- `iconPath`
- `status`
- `lastReportAt`

字段口径建议：

- `deviceId`
  - `string`
  - 来源：`drid`
- `deviceCode`
  - `string|null`
  - 来源：`drcode`
- `deviceName`
  - `string`
  - 来源：`drname`
- `systemType`
  - `string`
  - 建议枚举：`chiller|chilledPump|coolingPump|coolingTower|other`
  - 来源：`drtypename/typeYT` 映射
- `floorName`
  - `string|null`
  - 来源：`floorName/floorId`
- `buildingName`
  - `string|null`
  - 来源：`buildname/buildid`
- `usageType`
  - `string`
  - 建议枚举：`operational|meter|unknown`
  - 来源：`typeYT/isEnergy` 映射
- `iconPath`
  - `string|null`
  - 来源：`iconpath`
- `status`
  - `string`
  - 建议枚举：`online|offline|unknown`
  - 来源：运行态增强接口或回退为 `unknown`
- `lastReportAt`
  - `string(date-time)|null`
  - 来源：运行态增强接口，拿不到时为 `null`

### 4.3 `filters` 最小字段

`filters` 建议固定为：

- `type`
- `floor`

字段类型：

- `type: string|null`
- `floor: string|null`

## 5. `freshness / sourceStatus` 是否直透

结论：

- `freshness`：`Yes`
- `sourceStatus`：`Yes`

### 5.1 `freshness`

`devices/list` 的 `freshness` 不是静态目录更新时间，而是：

- 运行态增强字段的 freshness

也就是主要针对：

- `status`
- `lastReportAt`

语义建议：

- 若运行态增强来源成功：
  - `latestTimestamp` 取运行态最近时间戳
  - `stale` / `ageHours` 按现有 `Freshness` 口径计算
- 若运行态增强来源失败或未参与：
  - `latestTimestamp = null`
  - `stale = true`
  - `ageHours = null`

这样前端可以直接做两层渲染：

- 主列表仍可正常显示静态设备目录
- 运行态列可显示“状态暂不可用 / 已降级”

### 5.2 `sourceStatus`

建议 `sourceStatus.sources` 首版至少覆盖：

- `devices`
  - 对应：`/zsqy/drinfo/{dbName}/findObject`
  - 角色：静态目录主来源
- `deviceRuntime`
  - 对应：`/api/device/{dbName}/data`
  - 角色：运行态增强来源

overall 语义建议：

- 两个来源都成功：`ok`
- `devices` 成功、`deviceRuntime` 失败：`partial`
- `devices` 失败：`failed`

这让前端可以只靠结构化字段完成本地化摘要：

- `devices` 失败：列表主数据不可用
- `deviceRuntime` 失败：列表可渲染，但运行态降级

## 6. 是否分页

结论：`Yes`

原因：

- 设备总览页主区域本质是列表
- 当前 `findObject` 返回量已到 59 条，后续站点大概率更多
- 不分页会把列表 contract 锁死在“只适合小站点”的形态

Sprint1 虽然可以先从一次拉全量再内存分页开始实现，但对外合同仍应固定为：

- `page`
- `pageSize`
- `total`

## 7. 是否需要 `total`

结论：`Yes`

原因：

- 没有 `total`，前端无法做标准分页器
- 后续即使支持服务端分页，也不必再改合同
- `total` 对调试筛选结果也很关键

## 8. 是否复用旧接口

## 8.1 `findObject`

结论：`Yes`

角色：

- Sprint1 首版的硬依赖主来源

原因：

- 当前稳定可用
- 字段已足够支撑设备静态主列表
- 已知字段包括：
  - `drid`
  - `drname`
  - `drcode`
  - `drtypename`
  - `buildname`
  - `floorName`
  - `iconpath`
  - `typeYT`
  - `isEnergy`

## 8.2 `getAllSubsystemInfo`

结论：`No`

原因：

- 它更适合全站摘要与告警汇总
- 不适合设备主列表的逐项字段生成
- 设备页 Sprint1 不需要把它塞进 `devices/list` 以免口径混乱

可选用途：

- 后续如果要做页头设备在线/离线统计，再评估是否作为辅助来源

## 8.3 `/api/device/*`

结论：`部分复用`

Sprint1 对 `/api/device/*` 的推荐策略：

- `/api/device/{dbName}/data`
  - `Yes`
  - 作为运行态增强来源
  - 不是首版硬依赖
- `/api/device/{dbName}/data/tree`
  - `No`
  - 这条更适合未来的 `devices/tree`
- `/api/device/{dbName}/device/data`
  - `No`
  - 不纳入 Sprint1 `devices/list`

原因：

- `system-findings.md` 已确认 `data` / `data/tree` 在当前本地环境可返回
- 但 `bff-aggregation-design.md` 仍不建议首期强依赖 `/api/device/...`

所以本版最终拍板为：

- 可以用
- 但只能作为增强，不作为列表成功与否的唯一前提

## 9. 最小 JSON Example 结构

建议最小 example 结构如下：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "generatedAt": "2026-03-14T10:20:30.000Z",
  "items": [
    {
      "deviceId": "2",
      "deviceCode": "CH1",
      "deviceName": "1#冷水机",
      "systemType": "chiller",
      "floorName": "楼顶",
      "buildingName": "6期1栋",
      "usageType": "operational",
      "iconPath": "/imgs/126lnoffice/Device/ConditioningChillerStopGray.png",
      "status": "online",
      "lastReportAt": "2026-03-14T10:15:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 59,
  "filters": {
    "type": null,
    "floor": null
  },
  "freshness": {
    "latestTimestamp": "2026-03-14T10:15:00.000Z",
    "stale": false,
    "ageHours": 0.1
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": [
      {
        "key": "devices",
        "endpoint": "/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200",
        "ok": true,
        "status": 200,
        "message": "OK",
        "error": null,
        "rows": 59
      },
      {
        "key": "deviceRuntime",
        "endpoint": "/api/device/126lnoffice/data",
        "ok": false,
        "status": null,
        "message": null,
        "error": "runtime enhancement unavailable",
        "rows": null
      }
    ]
  }
}
```

这个 example 已经覆盖了 Sprint1 最需要的两种语义：

- 列表主数据可用
- 运行态增强可降级

## 10. 最终拍板

最终拍板如下：

- `devices/list` 是否属于 Sprint1 P0：`Yes`
- 主控是否可直接实现：`Yes`

最小字段清单：

- 顶层：
  - `site`
  - `generatedAt`
  - `items`
  - `page`
  - `pageSize`
  - `total`
  - `filters`
  - `freshness`
  - `sourceStatus`
- `items[]`：
  - `deviceId`
  - `deviceCode`
  - `deviceName`
  - `systemType`
  - `floorName`
  - `buildingName`
  - `usageType`
  - `iconPath`
  - `status`
  - `lastReportAt`

收口结论：

- 这条接口已经足够主控直接实现
- 也已经具备后续纳入 OpenAPI 主合同与 `check:contract` 的基础

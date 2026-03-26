# Sprint1 `anomalies/list` 合同 v1

## 1. 结论

这个接口属于 Sprint1 `P0`，主控可以直接实现。

拍板结论：

- 是否属于 Sprint1 P0：`Yes`
- 主控是否可以直接实现：`Yes`

原因：

- 告警页主体必须有列表接口
- `anomalies/summary` 只能承接摘要，不足以承接主列表
- 首版 contract 已可收敛为“带分页外形的最近告警列表”

## 2. 路径定义建议

建议路径：

- `GET /bff/v1/sites/{siteId}/anomalies/list`

理由：

- 与现有 `anomalies/summary` 命名保持一致
- 语义直观
- 后续扩展 `detail`、`ack`、`workorder` 时也容易形成同一命名族

## 3. Query 参数（首版最小集）

首版最小集建议：

- `siteId`：path，必填
- `page`：query，可选，默认 `1`
- `pageSize`：query，可选，默认 `20`

首版可预留但不强依赖：

- `severity`：`high | medium | low`
- `state`：字符串，可选

建议结论：

- Sprint1 必须支持 `page/pageSize`
- `severity/state` 可以进 contract，但实现上先做可选透传或忽略，不阻塞开工

为什么首版就要带分页：

- 告警页主列表天然是分页语义
- 即便底层当前只是 recent items，接口结构也应先稳定下来
- 后续再补分页会造成前后端 contract 二次变形

## 4. Response Schema 最小字段

建议最小响应结构：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "items": [
    {
      "id": "59775",
      "title": "Alarm event",
      "severity": "high",
      "state": "active",
      "occurredAt": "2025-11-08T08:07:00.000Z",
      "source": "Unknown",
      "regId": "32",
      "value": "1"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 3,
  "filters": {
    "severity": null,
    "state": null
  },
  "freshness": {
    "latestTimestamp": "2025-11-08T08:07:00.000Z",
    "stale": true,
    "ageHours": 2975.5
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": [
      {
        "key": "latestAlarmLog",
        "endpoint": "/zsqy/qsAlarmlog/126lnoffice/findNewAlarmLog",
        "ok": true,
        "status": 200,
        "message": "OK",
        "error": null,
        "rows": 3
      }
    ]
  }
}
```

## 5. 最小字段清单

顶层字段：

- `site`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

`site` 最小字段：

- `siteId`
- `siteName`

`items[]` 最小字段：

- `id`
- `title`
- `severity`
- `state`
- `occurredAt`
- `source`
- `regId`
- `value`

`filters` 最小字段：

- `severity`
- `state`

`freshness` 最小字段：

- `latestTimestamp`
- `stale`
- `ageHours`

`sourceStatus` 最小字段：

- `overall`
- `sources`

## 6. 字段语义建议

### `items[].severity`

建议枚举：

- `high`
- `medium`
- `low`

说明：

- 与现有 `anomalies/summary.latestEvents[].severity` 保持一致

### `items[].state`

首版建议：

- 类型 `string`
- 暂不强制枚举

说明：

- 旧来源状态口径还不够稳定
- Sprint1 先保留字符串，避免过早把状态枚举写死

### `items[].occurredAt`

建议类型：

- ISO datetime string

### `items[].source`

建议：

- 保留字符串
- 作为列表展示辅助字段

## 7. `freshness` / `sourceStatus` 是否直透

结论：

- `Yes`
- 两者都应直透

原因：

- 告警数据存在明显陈旧风险
- 部分来源失败不应直接导致整页失败
- 前端必须能区分“数据可展示但不新鲜”和“上游部分失败”

落地建议：

- `freshness` 用于页面主提示
- `sourceStatus` 用于展开态 / 页脚 / 调试态

## 8. 是否分页

结论：

- `Yes`

Sprint1 也应保留：

- `page`
- `pageSize`

说明：

- 即便当前底层只返回最近几条，分页外形也应先冻结
- 这样前端和 BFF 后续都不用再改协议骨架

## 9. 是否需要 `total`

结论：

- `Yes`

原因：

- 没有 `total`，分页就不完整
- 即便 Sprint1 的 `total` 只是“当前 recent list 总条数”，也比后面再补字段更稳

兼容建议：

- 如果底层暂时只能拿 recent items，则 `total = items.length` 也是可接受的 Sprint1 实现
- 但 contract 上仍保留 `total`

## 10. 建议旧来源与实现边界

主来源：

- `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

辅助来源：

- `GET /{dbName}/getAllSubsystemInfo`

实现边界：

- Sprint1 只承诺“最近告警列表”
- 不承诺完整历史告警中心
- 不依赖 `findAlarmListHome`

## 11. 最小 JSON Example

可直接给主控参考的最小 example：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "items": [
    {
      "id": "59775",
      "title": "Alarm event",
      "severity": "high",
      "state": "active",
      "occurredAt": "2025-11-08T08:07:00.000Z",
      "source": "Unknown",
      "regId": "32",
      "value": "1"
    },
    {
      "id": "59774",
      "title": "Alarm event",
      "severity": "medium",
      "state": "active",
      "occurredAt": "2025-11-08T06:58:20.000Z",
      "source": "Unknown",
      "regId": "31",
      "value": "1"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "filters": {
    "severity": null,
    "state": null
  },
  "freshness": {
    "latestTimestamp": "2025-11-08T08:07:00.000Z",
    "stale": true,
    "ageHours": 2975.5
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": [
      {
        "key": "latestAlarmLog",
        "endpoint": "/zsqy/qsAlarmlog/126lnoffice/findNewAlarmLog",
        "ok": true,
        "status": 200,
        "message": "OK",
        "error": null,
        "rows": 3
      }
    ]
  }
}
```

## 12. 最终拍板

- 是否属于 Sprint1 P0：`Yes`
- 主控是否可以直接实现：`Yes`

建议主控实现口径：

1. 先把 `anomalies/list` 定成分页外形
2. 底层先以 recent list 实现
3. `freshness/sourceStatus` 必带
4. `detail` 与历史增强后置

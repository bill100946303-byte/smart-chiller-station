# Sprint1 `anomalies/list` 合同 v1.2

## 1. 结论

本版用于修正 v1.1 把最终 `severity` 枚举误写成 `high|medium|low` 的问题，并按当前实现重新收口 `anomalies/list`。

结论：

- 当前实现与最终 contract 是否一致：`Yes`
- 是否建议现在就纳入 OpenAPI 主合同：`Yes`

补充说明：

- 当前真正的漂移点不在运行时代码，而在文档与 OpenAPI 仍残留旧口径
- 运行时 `anomalies/list` 已经输出最终统一 severity，不应再沿用 `high|medium|low`

## 2. `severity` 最终枚举

最终枚举固定为：

- `critical`
- `major`
- `minor`
- `normal`

这是 `anomalies/list` 的唯一对外合同口径。

说明：

- `high|medium|low` 只允许作为旧源兼容输入存在于 BFF adapter 内部
- 前端与 OpenAPI 不再继续暴露旧三档枚举
- 缺失或未知等级按现有实现归并为 `minor`

## 3. Query 参数最终集

最终参数集如下：

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
- `severity`
  - 位置：query
  - 必填：`No`
  - 类型：string
  - 枚举：`critical|major|minor|normal`
- `state`
  - 位置：query
  - 必填：`No`
  - 类型：string

收口结论：

- Sprint1 不再扩展 `sort`、`keyword`、`startTime`、`endTime`
- 首版只冻结 `page/pageSize/severity/state`
- `state` 继续保持自由字符串，不冻结枚举

## 4. `items[]` 最小字段最终集

`items[]` 最小字段最终集固定为：

- `id`
- `title`
- `severity`
- `state`
- `occurredAt`
- `source`
- `regId`
- `value`

字段口径：

- `id`：`string`
- `title`：`string`
- `severity`：`critical|major|minor|normal`
- `state`：`string|null`
- `occurredAt`：`string(date-time)|null`
- `source`：`string`
- `regId`：`string|null`
- `value`：`string|null`

说明：

- `regId` 与 `value` 不再视为“仅额外透出”，已经进入最小可联调字段集
- 原因是当前实现稳定返回，且告警页列表首版就需要保留点位与值的追踪能力

## 5. 顶层字段最终集

顶层字段最终集固定为：

- `site`
- `generatedAt`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

其中：

- `generatedAt`：`保留`

保留原因：

- 当前服务层稳定返回
- 对前端“本次响应生成时间”提示与联调排障有价值
- 与现有 overview/trends/anomalies-summary/recommendations 的 BFF 风格一致

## 6. `freshness` / `sourceStatus` 最终结论

结论：

- `freshness`：`直透`
- `sourceStatus`：`直透`

### 6.1 `freshness`

`freshness` 继续作为正式合同字段保留，最小结构为：

- `latestTimestamp`
- `stale`
- `ageHours`

语义：

- 前端要能区分“当前列表为空”与“当前列表为空且数据陈旧/失败”
- 告警页不应只靠 `items.length===0` 判断页面状态

实现备注：

- 当前实现基于 `latestTimestamp` 计算 `freshness`
- 空列表失败态下，`latestTimestamp` 仍可能回退到当前时间，这属于后续可优化的运行时语义，不影响当前结构合同冻结

### 6.2 `sourceStatus`

`sourceStatus` 继续作为正式合同字段保留，最小结构为：

- `overall`
- `sources`

`sources[]` 的最小结构为：

- `key`
- `endpoint`
- `ok`
- `status`
- `message`
- `error`
- `rows`

Sprint1 收口结论：

- `anomalies/list` 当前只要求直透 `latestAlarmLog`
- 不要求本接口首版再额外挂 `subsystemSummary`
- 前端以 `sourceStatus.overall + sources[0]` 就应能完成摘要与展开态说明

## 7. 最小 Example 结构

建议最小 example 结构如下：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "generatedAt": "2026-03-13T10:20:30.000Z",
  "items": [
    {
      "id": "alarm-1001",
      "title": "冷冻水出水温度异常",
      "severity": "critical",
      "state": "active",
      "occurredAt": "2026-03-13T09:58:00.000Z",
      "source": "CH-01",
      "regId": "reg-101",
      "value": "12.4"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "filters": {
    "severity": "critical",
    "state": null
  },
  "freshness": {
    "latestTimestamp": "2026-03-13T09:58:00.000Z",
    "stale": false,
    "ageHours": 0
  },
  "sourceStatus": {
    "overall": "ok",
    "sources": [
      {
        "key": "latestAlarmLog",
        "endpoint": "/zsqy/qsAlarmlog/126lnoffice/findNewAlarmLog",
        "ok": true,
        "status": 200,
        "message": "OK",
        "error": null,
        "rows": 1
      }
    ]
  }
}
```

example 说明：

- 必须体现最终 severity 四档口径中的一个合法值
- 必须包含 `generatedAt`
- 必须体现 `sourceStatus.sources[0].key=latestAlarmLog`
- 最好至少再补一个 `state=null` 的样例，以覆盖可空路径

## 8. 当前实现与最终 contract 的一致性判断

判断：`Yes`

依据：

1. 路由已存在：
   - `GET /bff/v1/sites/{siteId}/anomalies/list`
2. 当前已实现 query 参数：
   - `page`
   - `pageSize`
   - `severity`
   - `state`
3. adapter 当前已输出最终 severity：
   - `critical|major|minor|normal`
4. service 当前已稳定输出：
   - `generatedAt`
   - `freshness`
   - `sourceStatus`
   - `items[]` 最小字段集

不视为阻断差异的事项：

- `site.siteName` 当前仍可能 fallback 为 `siteId`
- `freshness.latestTimestamp` 的空列表失败态语义仍可继续优化
- `state` 仍为自由字符串，尚未冻结枚举

这些都不影响“当前实现与最终 contract 一致”的判断。

## 9. 是否建议现在就纳入 OpenAPI 主合同

结论：`Yes`

原因：

- 结构已经稳定
- query 已经稳定
- severity 已经完成最终收口
- 这是告警页 Sprint1 的 P0 列表接口，继续放在“实现已存在但主合同未纳管”的状态，会增加后续 drift 风险

## 10. 若纳入 OpenAPI 主合同，待改文件清单

建议改动如下：

### 必改

- `apps/chiller-bff/openapi/bff-v1.yaml`
  - 新增 path：`/bff/v1/sites/{siteId}/anomalies/list`
  - 新增或抽取对应 response schema
  - 把告警 severity 统一为 `critical|major|minor|normal`
- `apps/chiller-bff/openapi/examples/anomalies-list.json`
  - 新增 `anomalies/list` example
- `apps/chiller-bff/openapi/examples/anomalies-summary.json`
  - 把旧的 `high|medium|low` 示例同步收口到最终 severity 四档

### 视是否接入主门禁决定

- `apps/chiller-bff/scripts/check-contract.js`
  - 如果要把 `anomalies/list` 一并纳入现有 OpenAPI 主门禁，则需要把该 path 加入 `CONTRACT_PATHS`
  - 同时把 `anomalies-list.json` 纳入 example 校验

收口建议：

- 文档与实现已经可以拍板
- 下一步应直接进入 OpenAPI 和 example 同步，不建议再继续保留旧 severity 三档口径

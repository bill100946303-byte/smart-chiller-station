# Sprint1 `anomalies/list` 联调回归 v1

## 1. 结论

`anomalies/list` 当前可以视为 Sprint1 可联调接口。

当前判断：

- `anomalies/list` 当前是否可视为 Sprint1 可联调接口：`Yes`
- 是否影响 `check:contract` / OpenAPI：`No`

但要把这条接口真正纳入“稳定合同”，还差一步：

- 需要在后续版本把它补进 `openapi/bff-v1.yaml` 与 example

也就是说，当前它已经是：

- `实现上可联调`

但还不是：

- `已进入现有 OpenAPI 主门禁`

## 2. 本次回归依据

代码依据：

- [v1.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/routes/v1.js)
- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js)
- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js)
- [sprint1-anomalies-list-contract-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-contract-v1.md)

运行验证：

- 直接调用服务层 `getAnomalyList(...)`
- 当前本地 8787 未监听，因此没有采用 HTTP 端到端回归
- 但服务层已成功返回完整序列化结构，可用于比对当前实现字段

本次服务层实际返回样本：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "126lnoffice"
  },
  "generatedAt": "2026-03-13T09:47:28.585Z",
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "filters": {
    "severity": null,
    "state": null
  },
  "freshness": {
    "latestTimestamp": "2026-03-13T09:47:28.584Z",
    "stale": false,
    "ageHours": 0
  },
  "sourceStatus": {
    "overall": "failed",
    "sources": [
      {
        "key": "latestAlarmLog",
        "endpoint": "/zsqy/qsAlarmlog/126lnoffice/findNewAlarmLog",
        "ok": false,
        "status": null,
        "message": null,
        "error": "Legacy request error: TypeError: fetch failed",
        "rows": null
      }
    ]
  }
}
```

## 3. 实际返回字段 vs 文档约定字段

### 3.1 已对齐字段

当前实现已覆盖 contract 最小字段：

- `site`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

因此从 Sprint1 首版联调角度看，主骨架已经齐了。

### 3.2 实现多出的字段

当前实现比文档约定多出：

- `generatedAt`

判断：

- 这是合理的额外透出
- 不是首版硬依赖
- 前端可以不消费

### 3.3 当前实现与文档示例的差异

差异 1：

- 文档示例里 `site.siteName` 是 `"6期1栋冷站"`
- 当前实现返回 `"126lnoffice"`

判断：

- 当前属于站点名 fallback
- 不阻塞 Sprint1 联调
- 后续若站点展示要求严格，再补真实站点名映射

差异 2：

- 文档预期主列表有 `items[]`
- 当前服务层样本里 `items=[]`

判断：

- 这是当前运行态上游抓取失败导致
- 不是接口结构缺失
- 不影响“接口可联调”的结构判断

差异 3：

- 文档建议 `sourceStatus` 可以体现更多来源
- 当前实现只挂了 `latestAlarmLog`

判断：

- 这对 Sprint1 列表接口是可接受的
- 因为列表主来源本来就是 `findNewAlarmLog`
- 不是首版必须补的 contract 差异

## 4. 当前已实现 Query 参数

路由层已实现：

- `page`
- `pageSize`
- `severity`
- `state`

代码位置：

- [v1.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/routes/v1.js)
- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js)

当前行为：

- `page/pageSize` 已参与分页切片
- `severity` 已参与过滤
- `state` 已参与过滤

说明：

- 这比最小 contract 更进一步
- 所以当前 query 实现已经达到“可联调 + 可演进”的状态

## 5. 当前已实现 `freshness` / `sourceStatus`

### 5.1 `freshness`

当前已实现：`Yes`

实现位置：

- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js)

当前行为：

- 使用 `computeFreshnessState(...)`
- 基于 `list.latestTimestamp` 生成：
  - `latestTimestamp`
  - `stale`
  - `ageHours`

注意点：

- 当当前页没有任何列表项时，adapter 会回退到 `new Date().toISOString()`
- 所以在上游失败时，`freshness` 可能显示为“刚生成但无数据”

判断：

- 结构已实现
- 语义上仍有优化空间
- 但不阻塞 Sprint1 联调

### 5.2 `sourceStatus`

当前已实现：`Yes`

实现位置：

- [anomalyService.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/services/anomalyService.js)
- [legacyAlarmAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyAlarmAdapter.js)

当前行为：

- 只透出一条主来源：
  - `latestAlarmLog`
- 字段已包含：
  - `key`
  - `endpoint`
  - `ok`
  - `status`
  - `message`
  - `error`
  - `rows`

判断：

- 已满足 Sprint1 列表页的最小降级展示需求

## 6. 哪些字段只是额外透出，不是首版硬依赖

当前可视为“额外透出”的字段：

- `generatedAt`
- `site.siteName` 的具体展示值
- `filters.severity`
- `filters.state`
- `items[].state`
- `items[].regId`
- `items[].value`

说明：

- 这些字段对 Sprint1 很有帮助
- 但即便个别字段后续微调，也不应视为首版 contract 失败

## 7. 下一版还要补什么

建议下一版补齐项：

### 7.1 `state` 口径收敛

当前问题：

- `items[].state` 已实现，但还是自由字符串 / nullable

建议：

- 等旧来源状态口径确认后，再收敛枚举或映射规则

### 7.2 过滤能力收口

当前状态：

- `severity/state` 已实现

建议：

- 下一版明确是否要把它们写进 OpenAPI 正式 query 参数
- 并补 example 覆盖过滤场景

### 7.3 `detail` 接口

建议新增：

- `GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`

原因：

- 当前告警页 still 缺详情抽屉 / 详情页承载接口

### 7.4 OpenAPI / example 纳管

当前最大缺口：

- `anomalies/list` 还没进 `bff-v1.yaml`
- 也没有独立 example

建议：

- 下一版把这条接口正式纳入 OpenAPI
- 再补一份 example
- 之后才能进入 `check:contract` 体系

## 8. 最终判断

### 8.1 当前是否可视为 Sprint1 可联调接口

- `Yes`

原因：

- 路由已接通
- 服务层已实现
- query 参数已存在
- 最小返回骨架已齐
- `freshness/sourceStatus` 已实现

### 8.2 是否影响 `check:contract` / OpenAPI

- `No`

原因：

- 当前 `anomalies/list` 尚未写入现有 `bff-v1.yaml`
- 现有 `check:contract` 只覆盖既有 P0 路由与 example
- 因此这条接口当前处于“实现已可联调，但未纳入主合同门禁”的状态

# 告警页 Sprint1 合同完整包 v1

## 1. 结论先行

告警页 Sprint1 不应再拆成多轮小 contract 任务，建议一次性按下面的边界开工：

- 直接复用：
  - `GET /bff/v1/sites/{siteId}/anomalies/summary`
- 必须新增：
  - `GET /bff/v1/sites/{siteId}/anomalies/list`
- 可以后置：
  - `GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`
  - 工单联动
  - 高级筛选 / 历史全量检索

最终拍板：

- 告警页 Sprint1 是否需要新增 `GET /bff/v1/sites/{siteId}/anomalies/list`：`Yes`
- 是否属于 P0：`Yes`
- 第一版接口联调是否可开工：`Yes`

前提是范围明确收敛为：

- 头部摘要
- 最近告警 / 首版列表
- 数据陈旧提示
- 来源状态提示

而不是一步到位替代旧告警中心全部能力。

## 2. 首版直接复用接口

### 2.1 `GET /bff/v1/sites/{siteId}/anomalies/summary`

角色：

- 告警页头部摘要接口
- 不承担完整列表页职责

当前旧来源：

- `GET /{dbName}/getAllSubsystemInfo`
- `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

最小请求字段：

- `siteId`（path）

最小响应字段：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "counts": {
    "total": 3,
    "high": 1,
    "medium": 1,
    "low": 1
  },
  "latestEvents": [
    {
      "id": "59775",
      "title": "Alarm event",
      "severity": "high",
      "occurredAt": "2025-11-08T08:07:00.000Z",
      "source": "Unknown"
    }
  ],
  "diagnosisFlags": {
    "staleAlarmFeed": true,
    "missingHighSeverity": false
  },
  "freshness": {
    "latestTimestamp": "2025-11-08T08:07:00.000Z",
    "stale": true,
    "ageHours": 2975.5
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": []
  }
}
```

首版承接范围：

- 顶部总数卡
- 最近告警卡
- “数据陈旧”提示
- 源头健康状态

不承接：

- 全量列表
- 分页
- 详情

## 3. 首版必须新增接口

### 3.1 `GET /bff/v1/sites/{siteId}/anomalies/list`

角色：

- 告警页主列表接口
- Sprint1 P0 必须新增

原因：

- `anomalies/summary` 只有摘要和 recent items，不足以承接告警页主体
- 告警页没有列表就无法形成真正可用的一版

### 3.2 建议旧来源

主来源：

- `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

辅助来源：

- `GET /{dbName}/getAllSubsystemInfo`

使用原则：

- Sprint1 先把它定义成“最近告警列表”
- 不把它包装成“完整历史告警中心”
- 不把 `findAlarmListHome` 作为 P0 强依赖

### 3.3 建议 contract

建议接口名：

- `GET /bff/v1/sites/{siteId}/anomalies/list`

建议查询参数：

- `page`：integer，默认 `1`
- `pageSize`：integer，默认 `20`
- `severity`：`high|medium|low`，可选
- `state`：可选

其中：

- `page/pageSize` 建议 Sprint1 就进入 contract
- `severity/state` 可以先做可选，不作为首版硬要求

为什么分页 Sprint1 就要带上：

- 告警页主列表天然是列表语义
- 后续再补分页会导致 contract 二次变形
- 即便第一版底层只拿到 recent items，也应先把列表 contract 定成分页结构

### 3.4 最小请求字段

```http
GET /bff/v1/sites/{siteId}/anomalies/list?page=1&pageSize=20
```

最小请求字段：

- `siteId`
- `page`
- `pageSize`

### 3.5 最小响应字段

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
    "sources": []
  }
}
```

建议字段说明：

- `items[].id`
- `items[].title`
- `items[].severity`
- `items[].state`
- `items[].occurredAt`
- `items[].source`
- `items[].regId`
- `items[].value`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

### 3.6 Sprint1 contract 决策

- 分页：`Yes`
- 详情字段：`最小化`
- 高级筛选：`No`
- 工单字段：`No`
- 历史全量保证：`No`

一句话：

- Sprint1 的 `anomalies/list` 是“有分页外形的最近告警列表接口”

## 4. 可以后置的接口

### 4.1 `GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`

建议后置到 Sprint1.5 或 Sprint2。

原因：

- 第一版先把“能看列表”做出来更重要
- 旧来源是否能稳定提供详情字段，当前证据不足
- 如果直接在 Sprint1 承诺 detail，容易把范围拖散

### 4.2 工单联动接口

例如：

- 工单状态
- 工单跳转
- 告警转工单

建议后置。

原因：

- `bff-aggregation-design.md` 已明确首期不应把工单接口作为主链路强依赖

### 4.3 高级筛选 / 历史检索

例如：

- 时间范围筛选
- 设备筛选
- 关键字搜索
- 历史分页

建议后置。

原因：

- 现有稳定旧来源更像 “recent alarm”
- Sprint1 不应把 contract 定成完整历史中心再反向找旧接口兜

## 5. `freshness` / `sourceStatus` 是否直透

结论：

- `Yes`
- `summary` 和 `list` 都应直透

原因：

### 5.1 告警数据有明显陈旧风险

已有 example 与回归文档都显示：

- 最近告警时间明显早于当前日期
- `staleAlarmFeed=true`
- 告警页如果不直透 `freshness`，前端很容易把历史告警误当成实时告警

### 5.2 旧来源部分成功、部分失败是常态

`anomalies/summary` 当前 example 已体现：

- `subsystemSummary` 成功
- `latestAlarmLog` 成功
- `alarmSeveritySplit` 500
- `alarmDiagnosis` 超时

这正说明：

- `sourceStatus` 不是调试字段，而是页面必需信息

### 5.3 前端需要做稳定降级展示

首版页面至少要能区分：

- 数据可用但陈旧
- 某些来源失败但页面仍可展示
- 主列表只有 recent items，不是完整历史

因此建议：

- 头部摘要区直接消费 `freshness`
- 页面底部或展开态消费 `sourceStatus`

## 6. 告警页首版页面拆分建议

### 6.1 头部区

直接使用：

- `anomalies/summary`

展示：

- 总数
- 分级数量
- 最近一条时间
- 是否陈旧

### 6.2 主列表区

新增：

- `anomalies/list`

展示：

- 最近告警列表
- 分页容器
- 基础筛选容器

### 6.3 详情区

后置：

- `anomalies/{alarmId}`

Sprint1 先不作为联调阻塞。

## 7. 联调风险点

### 7.1 数据陈旧风险

风险：

- 告警列表可能是历史残留，不是实时告警

对策：

- `freshness` 直透
- 页面必须展示 “数据可能陈旧” 提示

### 7.2 旧来源能力上限风险

风险：

- `findNewAlarmLog` 更像 recent list，不是完整历史中心

对策：

- Sprint1 contract 明确只承诺 recent alarm list
- 不在 Sprint1 承诺完整历史筛选

### 7.3 部分来源失败风险

风险：

- 告警拆分、诊断辅助来源可能 500 或 timeout

对策：

- `sourceStatus` 直透
- 页面允许 partial 渲染
- 不把部分来源失败直接等同整页失败

### 7.4 详情能力不确定风险

风险：

- 旧接口未确认可稳定提供完整 detail

对策：

- Sprint1 不把 detail 作为 P0

## 8. 拍板结论

### 8.1 首版直接复用接口

- `GET /bff/v1/sites/{siteId}/anomalies/summary`

### 8.2 首版必须新增接口

- `GET /bff/v1/sites/{siteId}/anomalies/list`

### 8.3 可以后置的接口

- `GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`
- 工单联动相关接口
- 高级筛选 / 历史检索接口

### 8.4 最终判断

- 告警页 Sprint1 是否需要新增 `GET /bff/v1/sites/{siteId}/anomalies/list`：`Yes`
- 是否属于 P0：`Yes`
- 第一版接口联调是否可开工：`Yes`

前提：

- 页面范围按本包收敛
- 不把 Sprint1 目标误写成“完整替代旧告警中心”

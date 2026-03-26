# OPTIMIZE_SIMULATE_ASSISTANT_CONTRACT_CURRENT

## 1. 目标

本文用于给未来三条预留接口固定最小合同边界，避免后续临时拍脑袋定义输入输出。

适用对象：

- `/bff/v1/sites/{siteId}/optimize`
- `/bff/v1/sites/{siteId}/simulate`
- `/bff/v1/sites/{siteId}/assistant/query`

当前状态：

- `预留`
- `未实现`
- `未纳入主合同`

## 2. 统一外层原则

三条接口未来都应遵守以下原则：

1. 继续复用 `siteId` 作用域
2. 响应风格与现有 BFF 一致
3. 如涉及数据质量或来源诊断，应继承：
   - `freshness`
   - `sourceStatus`
4. 不允许直接把页面临时 UI 状态当合同字段
5. 不允许在合同中混入 legacy 原始中文字段名

## 3. `/optimize`

### 3.1 目标

给定明确输入，返回推荐运行方案与解释信息。

### 3.2 最小请求体建议

```json
{
  "context": {
    "siteId": "126lnoffice"
  },
  "inputs": {
    "loadKw": 1200,
    "outdoorTempC": 32.5,
    "mode": "cooling"
  }
}
```

### 3.3 最小响应体建议

```json
{
  "site": {
    "siteId": "126lnoffice"
  },
  "decision": {
    "summary": "recommendation available",
    "confidence": "draft"
  },
  "recommendation": {
    "systemCop": null,
    "totalPowerKw": null,
    "steps": []
  },
  "freshness": {
    "label": "unknown"
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": []
  },
  "generatedAt": "2026-03-14T00:00:00.000Z"
}
```

### 3.4 当前约束

- `systemCop / totalPowerKw` 不得在实现前先承诺一定可算
- `steps` 可以先是规则性建议，不强行绑定控制量

## 4. `/simulate`

### 4.1 目标

对给定输入方案做仿真推演，返回预测结果与边界说明。

### 4.2 最小请求体建议

```json
{
  "context": {
    "siteId": "126lnoffice"
  },
  "scenario": {
    "loadKw": 1200,
    "outdoorTempC": 32.5,
    "candidate": {}
  }
}
```

### 4.3 最小响应体建议

```json
{
  "site": {
    "siteId": "126lnoffice"
  },
  "scenario": {
    "accepted": true
  },
  "result": {
    "systemCop": null,
    "totalPowerKw": null,
    "series": []
  },
  "freshness": {
    "label": "unknown"
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": []
  },
  "generatedAt": "2026-03-14T00:00:00.000Z"
}
```

### 4.4 当前约束

- `series` 只在仿真引擎真实存在时再启用
- 未实现前不应承诺时间粒度

## 5. `/assistant/query`

### 5.1 目标

对站点级问题返回结构化回答与引用依据。

### 5.2 最小请求体建议

```json
{
  "context": {
    "siteId": "126lnoffice"
  },
  "query": {
    "text": "当前冷站状态如何？"
  }
}
```

### 5.3 最小响应体建议

```json
{
  "site": {
    "siteId": "126lnoffice"
  },
  "answer": {
    "summary": "draft",
    "details": [],
    "citations": []
  },
  "freshness": {
    "label": "unknown"
  },
  "sourceStatus": {
    "overall": "partial",
    "sources": []
  },
  "generatedAt": "2026-03-14T00:00:00.000Z"
}
```

### 5.4 当前约束

- `citations` 未来应优先引用：
  - overview
  - trends
  - anomalies
  - devices
  - recommendations
- 不允许绕开现有 BFF 语义直接拼 legacy 原始字段答复

## 6. 错误响应原则

三条接口未来都应沿用当前 BFF 风格：

```json
{
  "ok": false,
  "code": "BAD_REQUEST",
  "error": "Invalid request",
  "requestId": "req-123",
  "details": {}
}
```

建议错误类型至少包括：

- `BAD_REQUEST`
- `NOT_IMPLEMENTED`
- `UPSTREAM_UNAVAILABLE`

## 7. 何时才允许进入主合同

至少满足以下条件后，才建议把这三条路径纳入 `bff-v1.yaml` 与 `check:contract`：

1. 路径语义不再变化
2. 最小请求/响应体已形成稳定样本
3. 已有至少一个真实页面或 demo 页面消费
4. 已明确其 `freshness / sourceStatus` 诊断来源

## 8. 当前主控结论

当前结论：

- 路径命名：已固定
- 最小合同边界：已固定
- 实现状态：未开始
- 主合同状态：未纳入

后续若要实现，应优先从：

- `/optimize`

开始，而不是三条同时开工。

# OPTIMIZE_DRAFT_EXAMPLE_CURRENT

## 1. 目标

本文固定当前 `/optimize` 在真实运行态下的一条代表性 draft 返回，用于后续 review、演示和边界校验。

## 2. 代表性请求

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

## 3. 代表性响应摘要

- HTTP：`501`
- `code`：`NOT_IMPLEMENTED`
- `error`：`Optimize engine is not implemented yet; returning a context-backed draft`

## 4. 代表性 `details`

```json
{
  "site": {
    "siteId": "126lnoffice"
  },
  "decision": {
    "summary": "context-backed draft derived from overview, anomalies (3), and recommendation cards (0); requested scenario loadKw=1200, outdoorTempC=32.5",
    "confidence": "rule-based-draft-stable"
  },
  "request": {
    "loadKw": 1200,
    "outdoorTempC": 32.5,
    "mode": "cooling"
  },
  "recommendation": {
    "systemCop": 0,
    "totalPowerKw": 0.3,
    "steps": [
      "Review active alarms first: critical=3, major=0",
      "Use current station snapshot as draft baseline: COP=0, totalPowerKw=0.3",
      "Current COP snapshot is unavailable or non-positive; keep optimize interpretation at explanatory draft level",
      "Requested scenario fixed for draft review: loadKw=1200, outdoorTempC=32.5, mode=cooling"
    ]
  },
  "diagnostics": [
    "overview.sourceStatus=ok",
    "anomalySummary.sourceStatus=ok, totalAlarms=3",
    "recommendations.sourceStatus=ok, cards=0",
    "ruleEvaluation.matched=0, skipped=0",
    "optimize engine is not implemented; current response is a context-backed draft only"
  ],
  "freshness": {
    "latestTimestamp": "2026-03-14T16:23:00.000Z",
    "stale": false,
    "ageHours": 0.01
  },
  "sourceStatus": {
    "overall": "partial"
  }
}
```

## 5. 这条 example 的正确解读

这条 example 只能解读为：

- optimize 合同与外层结构已经稳定到可演示级别
- 当前草案已经可以引用站点现态、异常和建议层
- 当前草案仍不是优化求解结果

不能解读为：

- 系统已经给出真实最优方案
- `systemCop=0 / totalPowerKw=0.3` 是预测结果
- `confidence=rule-based-draft-stable` 等于“可以执行”

## 6. 当前主控建议

后续如要补 OpenAPI/example，可优先参考本文，但仍不建议现在把 `/optimize` 纳入主合同。

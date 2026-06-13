# OPTIMIZE_DEMO_REVIEW_CURRENT

> 2026-06-12 更新：本文保留为早期 `NOT_IMPLEMENTED/501` 阶段的历史复验记录。当前 `/optimize-demo` 已推进到 `200 OK + towerApproachAdvisor + pumpDeltaTAdvisor + chillerStagingAdvisor + operationalDiagnosticsAdvisor` 的 Advisor 演示阶段。当前状态以 `docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md`、`docs/CHILLER_STAGING_ADVISOR_CURRENT.md` 和 `docs/OPERATIONAL_DIAGNOSTICS_ADVISOR_CURRENT.md` 为准。

## 1. 复验范围

本轮基于真实页面：

- `http://127.0.0.1:3001/optimize-demo`

并实际提交：

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

## 2. 当前页面结论

- `/optimize-demo`：`可演示`
- `/optimize-demo`：`暂不正式签收`

## 3. 通过依据

1. 页面已能稳定提交真实 `POST /bff/v1/sites/{siteId}/optimize` 请求。
2. 合法返回不会再被页面误判为普通错误，而是显示为预期的 `NOT_IMPLEMENTED + draft` 状态。
3. 响应区已经能展示：
   - `decision.summary`
   - `decision.confidence`
   - `recommendation.systemCop`
   - `recommendation.totalPowerKw`
   - `recommendation.steps`
   - `diagnostics`
   - `generatedAt`
4. 来源条已收口为：
   - `优化草案来源`
   - `总览聚合内部来源`
   - `异常聚合内部来源`
   - `建议聚合内部来源`

## 4. 当前不签收的原因

当前阻塞正式签收的不是页面，而是接口仍明确返回：

- `code = NOT_IMPLEMENTED`

所以这页当前只能作为：

- optimize 合同演示页
- draft 解释页

不能作为：

- 已落地真实优化结果页

## 5. 非阻断观察项

- 浏览器控制台仍会记录一次 `POST /optimize` 的 `501` 资源失败日志
- 这与当前设计一致，不阻断 demo 结论

## 6. 当前主控建议

若继续推进 `/optimize`，下一步最合理的是：

1. 补 draft example / review 材料
2. 或继续增强 rule-based draft

不建议当前把 `/optimize-demo` 提前判成正式签收页。

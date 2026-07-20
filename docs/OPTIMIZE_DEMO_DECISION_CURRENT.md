# OPTIMIZE_DEMO_DECISION_CURRENT

> 2026-06-12 更新：本文前半部分描述的是早期 `NOT_IMPLEMENTED` draft 阶段。当前 `/optimize-demo` 已进入 Advisor 演示阶段，`POST /bff/v1/sites/{siteId}/optimize` 在 140/B25 smoke 中返回 `200 / OK`，并展示主机组合、冷却塔接近度、泵温差和运行诊断 Advisor。当前状态以 `docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md` 为准。

## 1. 当前结论

- `/optimize-demo`：`可演示`
- `/optimize`：`暂不正式签收`

## 2. 一句话理由

当前 `/optimize` 已能基于 `dashboard/overview + anomalies/summary + recommendations` 返回解释型 draft，但仍明确返回 `NOT_IMPLEMENTED`，因此适合作为治理态演示链路，不应被当成真实优化结果。

## 3. 当前演示依据

1. `POST /bff/v1/sites/{siteId}/optimize` 已存在，且输入校验稳定。
2. 合法输入会返回结构化 draft details，包括：
   - `decision.summary`
   - `recommendation.systemCop`
   - `recommendation.totalPowerKw`
   - `recommendation.steps`
   - `diagnostics`
   - `freshness/sourceStatus`
3. `/optimize-demo` 已将 `NOT_IMPLEMENTED` 识别为预期 draft 状态，不再把合法返回误显示为真正错误。

## 4. 当前不应越界的点

当前不允许把 `/optimize-demo` 说成：

- 已接真实优化引擎
- 已产出真实最优方案
- 已进入正式业务签收

当前只允许说成：

- optimize 草案入口已存在
- demo 页面已能演示输入、校验和 context-backed draft response

## 5. 值班/演示口径

可对值班/运营这样介绍：

> 这页现在不是“真实优化计算结果”，而是 optimize 接口的最小演示链。它已经能固定输入、校验规则，并结合站点现态返回解释型 draft，后续再接真实优化引擎。

## 6. 当前主控建议

下一步若继续推进 `/optimize`，应优先进入：

1. draft example / review 文档
2. rule-based draft v2
3. 最后才讨论真实 optimize engine

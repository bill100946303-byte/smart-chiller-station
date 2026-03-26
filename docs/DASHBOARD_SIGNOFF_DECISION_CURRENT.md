# DASHBOARD_SIGNOFF_DECISION_CURRENT

## 1. 当前结论

- 当前演示结论：`yes`
- 当前正式签收结论：`yes`

## 2. 一句话理由

- `/dashboard` 已真实消费 `dashboard/overview + dashboard/trends + anomalies/summary + recommendations`，并能把正常数据、部分回退数据与规则诊断映射成可解释首页状态，因此已经满足“聚合入口页”正式签收条件。

## 3. 通过依据

1. 页面真实接入：
   - `GET /bff/v1/sites/{siteId}/dashboard/overview`
   - `GET /bff/v1/sites/{siteId}/dashboard/trends`
   - `GET /bff/v1/sites/{siteId}/anomalies/summary`
   - `GET /bff/v1/sites/{siteId}/recommendations`
2. 当前运行态真实返回：
   - `overview.sourceStatus.overall = ok`
   - `anomalies.sourceStatus.overall = ok`
   - `recommendations.sourceStatus.overall = ok`
   - `trends.sourceStatus.overall = partial`
3. 真实页面已经能诚实表达：
   - `当前 COP 0.00`
   - `总站功率 0.3 kW`
   - `当前异常数 3`
   - 趋势区明确显示“趋势序列暂不可用，等待连续有效点”
   - 建议区明确显示“当前无可执行建议”

## 4. 当前签收边界

当前签收的是：

- 首页聚合入口
- overview / anomalies / recommendations / trends 的聚合编排
- 数据可用时的正常展示
- 数据部分回退时的诚实降级展示

当前不承诺的是：

- 趋势卡等同于“趋势页正式签收”
- 首页本身替代 `/trend-analysis` 的正式趋势能力

这不影响 `/dashboard` 当前作为首页聚合入口签收。

## 5. 对值班/运营如何介绍

- `这页用于先看全站现态摘要、异常数、实时骨架状态、趋势可用性和规则建议；如果趋势区提示部分回退，应转去趋势页看详细情况并保守解读。`

## 6. 当前主控结论

- `/dashboard` 已从“可演示入口页”推进到“已正式签收首页”
- 趋势链问题继续单独挂在 `/trend-analysis` 线上，不反向阻断首页签收

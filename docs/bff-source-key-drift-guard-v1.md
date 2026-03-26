# BFF Source Key 漂移门禁 v1.1

## 1. 目标
- 主合同保持严格，不放松 `SourceEndpointStatus.key` 结构约束。
- 在合同门禁阶段尽早发现来源 key 漂移，避免前端本地化映射失效。

## 2. 变更治理规则
- `key` 变更（重命名/删除）属于兼容性风险，必须在版本说明中显式记录。
- 新增 `key` 时，需同步提供：
  - 前端映射补充任务（中文名称与摘要策略）
  - 发布说明中的“新增来源 key”清单

## 3. 兼容窗口策略（新增 key）
- 建议兼容窗口：至少 1 个发布周期（或 14 天）维持“后端新增 + 前端未消费不报错”状态。
- 兼容窗口内要求：
  - `check-contract` 输出 warning（不直接 fail）
  - 主控确认前端映射补齐计划
- 窗口结束后：
  - 新 key 纳入 allowlist/baseline
  - warning 归零作为收口目标

## 4. 门禁实现（check-contract）
- 扫描 examples 中 `sourceStatus.sources[*].key`：
  - 已知静态 key：allowlist
  - `metric.*`：baseline（当前受控指标 key）
- 对未知 key 输出路径化 warning：
  - `UNKNOWN_STATIC_KEY`
  - `NEW_METRIC_KEY`
- warning 不阻断合同通过，但必须可定位到 JSON 路径并进入主控排期。

## 5. recommendations 联动要求
- 若 `recommendations.sourceStatus` 出现新的 `metric.*` key：
  - 立即提示“前端映射待补”
  - 建议同步更新本地化映射与规则解释文案

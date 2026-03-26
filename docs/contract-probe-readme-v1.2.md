# Contract Probe README v1.2

## 1. 产物位置
- `apps/chiller-bff/openapi/examples/real-link-ready-probe-report.json`
- 由 `npm run check:contract` 自动刷新（非阻断报告）。

## 2. 如何快速阅读
1. 看 `ready`：
- `true`：当前示例达到 real-link-ready。
- `false`：继续看 `summary` 和 `groupedByEndpoint`。
2. 看 `summary.byCategory`：
- `upstream_unreachable`：上游不可达/无状态。
- `upstream_5xx`：上游 5xx。
- `field_missing_or_invalid`：字段缺失或无效。
3. 看 `groupedByEndpoint`：
- 每个端点下已按三类分组并带计数，可直接分派给对应责任团队。
4. 看 `groupedFailures[*].jsonPath`：
- 直接定位到合同示例中的失败节点，便于 UI/Data-Model 联合排查。

## 3. 判责建议（最小口径）
- `upstream_unreachable` -> 运行时连通性/网关/上游可用性。
- `upstream_5xx` -> 上游服务实现与稳定性。
- `field_missing_or_invalid` -> Data-Model 字段映射与口径一致性。

## 4. 判定边界
- 本报告仅增强可读性，不改变主合同 pass/fail 逻辑。
- 主门禁仍以现有 5 个 example 的强校验和 recommendations 专项断言为准。

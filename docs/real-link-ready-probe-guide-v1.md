# Real-Link-Ready Probe 定位指南 v1

## 1. 适用范围
- 命令：`npm run check:contract`
- 关注输出段：
  - `Real-link-ready probe (non-blocking): READY|NOT_READY`
  - `Real-link-ready failure groups`

## 2. 分组含义与责任层
- `group=upstream_unreachable`
  - 含义：上游不可达或无状态（常见为 `status=null` / `upstream_unreachable`）。
  - 责任层：网络连通性、网关、上游可用性。
  - 首查项：endpoint 可达性、超时、DNS/路由、反向代理。

- `group=upstream_5xx`
  - 含义：上游返回 `status>=500`。
  - 责任层：上游服务稳定性或接口实现故障。
  - 首查项：上游服务日志、5xx 比例、接口回归。

- `group=field_missing_or_invalid`
  - 含义：规则诊断输入字段缺失/无效（来自 recommendations 的 `missingMetrics.category`）。
  - 责任层：数据模型映射、字段口径、上游 payload 质量。
  - 首查项：DTO 字段映射、数据字典、字段类型与单位一致性。

## 3. 日志直读方法
1. 先看 `Real-link-ready probe (non-blocking)` 是否 `READY`。
2. 若 `NOT_READY`，读取 `Real-link-ready failure groups`。
3. 按 `group` 的 `count` 排序处理，优先处置计数最高组。
4. 每条明细均带路径与 key/metric，可直接定位到合同样例位置。

## 4. 判定边界
- Probe 为非阻断提示，不改变 `check:contract` 通过/失败规则。
- 当前仍以合同结构与回归断言为阻断条件，probe 仅增强“非降级态”可读性与分责效率。

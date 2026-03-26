# OPTIMIZE_IMPLEMENTATION_PLAN_CURRENT

## 1. 目标

本文把 `/optimize` 从“预留治理”推进到“可实施步骤”，但仍不直接要求当前开写真实优化逻辑。

## 2. 当前定位

`/optimize` 当前应被视为：

- 下一阶段最优先的新能力入口
- 但仍属于 `Sprint0 / 设计与合同准备`

不应被视为：

- 本轮必须交付的业务接口
- recommendation 的别名
- 直接控制设备的执行接口

## 3. 推荐实施顺序

### 第 1 步：先定合同，不写算法

优先固定：

- request schema
- response schema
- 错误响应
- freshness/sourceStatus 是否继承

落点：

- `docs/OPTIMIZE_SIMULATE_ASSISTANT_CONTRACT_CURRENT.md`

### 第 2 步：补输入字段映射

需要单独补一份 `/optimize` 输入字段文档，至少区分：

- 手工输入
- 站点现态输入
- 约束输入
- 暂不支持输入

输出建议文档：

- `docs/OPTIMIZE_INPUT_MAPPING_CURRENT.md`

### 第 3 步：建 service 空壳

当且仅当前两步完成后，才建议新增：

- `apps/chiller-bff/src/services/optimizeService.js`

当前状态补充：

- 这一步已经完成第一版：
  - `apps/chiller-bff/src/services/optimizeService.js`
  - `POST /bff/v1/sites/{siteId}/optimize`
  - 第二版已推进到：
    - 基于 `dashboard/overview + anomalies/summary + recommendations` 的解释型 draft details
    - 基于 source health / alarms / current snapshot 的 rule-based draft v2

初版只做：

- 请求校验
- 统一响应结构
- `NOT_IMPLEMENTED` 或 `draft` 返回

不做：

- 真实优化引擎
- legacy 深调用

### 第 4 步：决定是否开 demo 页

仅当 service 空壳已稳定后，再考虑：

- `/optimize-demo`

初版页面只承接：

- 输入表单
- 结果占位
- 诊断/边界提示

当前状态补充：

- 这一步已完成第一版：
  - `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
  - 路由：`/optimize-demo`
  - 当前已承接：
    - draft optimize 请求
    - 解释型 decision summary
    - context-backed steps
    - diagnostics 展示

### 第 5 步：最后才接真实算法

真实算法接入必须满足：

1. 输入字段稳定
2. 输出字段稳定
3. recommendation 与 optimize 边界不再混淆

## 4. 推荐文件落点

### BFF

- `apps/chiller-bff/src/routes/v1.js`
- `apps/chiller-bff/src/services/optimizeService.js`

### OpenAPI

- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/openapi/examples/optimize-*.json`

### Shell

- `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`

### Docs

- `docs/OPTIMIZE_INPUT_MAPPING_CURRENT.md`
- `docs/OPTIMIZE_SIGNOFF_CRITERIA_CURRENT.md`

## 5. 进入真实实现前的门槛

必须同时满足：

1. `FIELD_MAPPING_CURRENT.md` 持续稳定
2. `API_SURFACE_CURRENT.md` 不再有大范围漂移
3. `THREAD_RULES_CURRENT.md` 已稳定执行
4. `/optimize` 的输入字段映射已完成
5. 主控明确批准从“治理准备”切换到“真实实现”

## 6. 当前主控建议

当前最合理的下一动作只有两个：

1. 先写 `/optimize` 输入字段映射文档
2. 再写 `/optimize` 签收标准文档

不建议当前直接做：

- `/optimize-demo`
- OpenAPI 主合同接入

## 7. 当前一句话结论

`/optimize` 现在已经进入“合同/字段准备 + context-backed 草案链路演示阶段”，但还未进入真实优化实现阶段。

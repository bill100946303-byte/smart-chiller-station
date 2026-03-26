# OPTIMIZE_DRAFT_CLOSEOUT_CURRENT

## 1. 当前阶段结论

- `/optimize`：`可联调`
- `/optimize`：`可演示`
- `/optimize`：`暂不正式签收`

## 2. 当前能力边界

当前 `/optimize` 已具备：

1. 稳定的最小输入边界
   - `loadKw`
   - `outdoorTempC`
   - `mode`
2. 稳定的错误响应结构
   - `BAD_REQUEST`
   - `NOT_IMPLEMENTED`
3. context-backed draft details
4. `/optimize-demo` 最小演示页

当前 `/optimize` 仍不具备：

1. 真实优化求解逻辑
2. 真实候选方案搜索
3. 正式业务签收
4. 主合同纳管

## 3. 当前阶段最合理的定位

当前应把 `/optimize` 定位为：

- 治理态接口草案
- 演示态输入/输出边界
- 未来真实优化能力的桥接层

不应定位为：

- recommendation 的别名
- 已交付业务优化接口
- 可以直接驱动控制执行的接口

## 4. 当前唯一真正缺口

当前阻止 `/optimize` 进入正式签收的唯一核心缺口是：

- **真实 optimize engine 尚未接入**

这意味着后续真正要做的不是继续美化 demo，而是决定：

1. 真优化引擎放在哪里
2. 与 recommendation 的边界怎么保持
3. 结果如何走主合同纳管

## 5. 当前主控建议

当前最合理的后续顺序：

1. 保持 `/optimize` 为 draft / demo 态
2. 不纳入主合同
3. 等真正决定优化引擎接入路线后，再进入真实实现阶段

# OPTIMIZE_SIGNOFF_CRITERIA_CURRENT

## 1. 目标

本文用于提前固定 `/optimize` 未来从“预留治理”推进到“可演示 / 可签收”时的判定标准。

这样后面即使开始实现，也不会边做边改验收口径。

## 2. 当前状态

当前 `/optimize` 状态：

- `预留治理`
- `未实现`
- `未进入 signoff`

## 3. 分层判定

### 3.1 可联调

视为 `/optimize` 可联调，至少需要满足：

1. 路径已存在：
   - `/bff/v1/sites/{siteId}/optimize`
2. request schema 已稳定
3. response schema 已稳定
4. `BAD_REQUEST / NOT_IMPLEMENTED / UPSTREAM_UNAVAILABLE` 错误结构已统一

### 3.2 可演示

视为 `/optimize` 可演示，至少需要满足：

1. 存在最小 demo 承接页，或已有稳定调用方
2. 能接受：
   - `loadKw`
   - `outdoorTempC`
   - `mode`
3. 响应中至少有：
   - `decision.summary`
   - `recommendation.steps`
   - `generatedAt`
   - `sourceStatus`
4. 页面或调用方不会把 `draft/null` 结果误解成真实优化结论

### 3.3 正式签收

视为 `/optimize` 正式签收，至少需要满足：

1. 已通过主合同与 `check:contract`
2. 已有至少一条真实业务链路消费，不再只是空壳 demo
3. 输入缺失、来源异常、结果降级三类情况都有明确表达
4. recommendation 与 optimize 的边界已清楚：
   - recommendation = 规则建议
   - optimize = 显式输入驱动的优化结果
5. 不依赖未稳定的趋势多序列作为硬前提

## 4. 当前不应作为签收条件的项

以下内容当前不应硬塞进 `/optimize` 首版签收条件：

- 设备控制闭环
- PLC/Modbus 下发
- 仿真联动
- AI 助手联动
- 2D/3D 页面联动

这些都属于后续扩展，不应拖住首版。

## 5. 建议的最小 signoff 顺序

### Phase A

合同 ready：

- schema 稳定
- 错误结构稳定
- example 稳定

### Phase B

演示 ready：

- demo 页面存在
- 输入输出可解释
- 页面不误导

### Phase C

正式签收 ready：

- 真实结果逻辑存在
- 主合同纳管
- 至少一轮 final UI / contract / data / rules 复验通过

## 6. 当前主控建议

当前建议不要跳过：

1. 先完成合同与字段映射
2. 再做 service 空壳
3. 再做 demo
4. 最后才谈正式签收

## 7. 当前一句话结论

`/optimize` 未来的签收标准已经可以提前固定，但现在还没有进入真正的验收阶段。

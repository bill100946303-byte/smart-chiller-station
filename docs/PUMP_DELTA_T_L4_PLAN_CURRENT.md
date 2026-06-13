# 冷冻泵/冷却泵温差导向降频 L4 当前版

## 范围

- 执行类型：`pump-delta-t`
- 生命周期：只开放 `shadow` / `assisted`，不开放 `enforced`
- 控制对象：运行中的冷冻泵、冷却泵频率修正量
- 不包含：泵台数启停优化、AI 直接写变频器频率

## AI 输出点

| 点名 | 单位 | 默认值 | 范围 | TTL | 含义 |
| --- | --- | --- | --- | --- | --- |
| `AI_ChwpFreqTrim_Hz` | Hz | 0 | -5 ~ +3 | 300s | 冷冻泵本地 PID 频率修正量 |
| `AI_CwpFreqTrim_Hz` | Hz | 0 | -5 ~ +3 | 300s | 冷却泵本地 PID 频率修正量 |

PLC 必须继续负责频率上下限、斜率、最小流量、PID、联锁、告警闭锁和回退。

## 当前门禁

- 高等级告警或阻断门禁：冻结为 `0Hz`
- 实时快照陈旧：冻结为 `0Hz`
- 冷冻/冷却温差、泵功率、冷机功率、总功率、COP、告警快照缺失：不生成可执行单
- 末端阀位、末端压差、室温、泵实际频率当前作为 assisted 前置补点要求；shadow 允许评审

## 当前动作

- 冷冻水温差低于 4.5℃ 且门禁通过：`AI_ChwpFreqTrim_Hz = -1`
- 冷却水温差低于 4.0℃ 且门禁通过：`AI_CwpFreqTrim_Hz = -1`
- 其它情况：保持 `0Hz`
- 单步限制：1Hz
- 控制周期：5 分钟
- 回退闭锁：15 分钟

## 执行治理

- advisor 在 `/optimize` 响应 `pumpDeltaTAdvisor`
- execution 创建 `pump-delta-t` 执行单
- approve/rollback/dispatch 走通用 `/optimize/executions/{executionId}` 路由
- 默认 shadow 只记录审计回执，不发 PLC 命令
- assisted 只有显式配置下游 endpoint 时才会尝试 POST；否则仍记录审计回执，不写 PLC

## 验证口径

- 每次 shadow/assisted 后观察 30-60 分钟
- 对比同负荷/相近湿球下：
  - `systemCop`
  - `totalPowerKw`
  - `chillerPowerKw`
  - `chilledPumpPowerKw`
  - `coolingPumpPowerKw`
  - `chilledDeltaT`
  - `coolingDeltaT`
  - `activeAlarmCount`
- 通过标准：泵功率下降，冷机功率上升不得抵消泵节能，COP 不劣化，无舒适度或冷凝侧告警。

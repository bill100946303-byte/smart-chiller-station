# 泵温差导向降频 readiness 检查

- 结论：GO_SHADOW_ONLY
- 站点：140
- shadow 就绪：GO
- assisted 就绪：BLOCKED
- dispatchMode：shadow
- 生成时间：2026-06-16T05:25:05.526Z

## 当前 Advisor

- 状态：ready
- executionReady：true
- dispatchReady：true
- 原因：低温差条件成立，已生成运行泵频率小步长降频建议。
- Trim：CHWP -1 Hz / CWP 0 Hz

## 最近 pump-delta-t 执行单

- executionId：opx-140-1781587399499-51v72r
- status：pending_approval
- target：CHWP -1 Hz / CWP 0 Hz
- TTL / hold / lockout：900s / 5min / 15min
- rollback：zero-trim，CHWP 0 Hz / CWP 0 Hz
- timeline：created

## 点位映射

| operation | status | endpoint | CHWP点 | CWP点 | commands |
| --- | --- | --- | --- | --- | --- |
| approve | ready | -- | 是 | 是 | 2 |
| rollback | ready | -- | 是 | 是 | 2 |

## 阻断项

- assisted 前缺 approve/rollback 点位映射或 dispatchMode 未配置为 assisted。

## 风险与提示

- 当前草案仍存在部分降级或缺测信号，建议先稳住风险后再评审优化空间。
- 当前 BFF 未接入末端阀位、关键压差或室温；shadow 可评审，assisted 前必须由 PLC 提供等效保护状态。
- 当前 BFF 未接入泵实际频率；执行前必须由 PLC 完成频率上下限、斜率和最小流量保护。
- assisted 前必须确认 PLC 本地限幅、斜率、最小流量和联锁保护。

## 下一步

- 补 AI_ChwpFreqTrim_Hz / AI_CwpFreqTrim_Hz 到 PLC/SCADA 的 approve 点位映射。
- 补 rollback 到 0Hz 或最近稳定值的回退映射。
- 由 PLC 或 BFF 接入末端压差/阀位/室温、泵实际频率和最小流量保护状态，再评估 assisted。


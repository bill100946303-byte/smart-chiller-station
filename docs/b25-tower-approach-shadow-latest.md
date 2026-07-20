# B25 冷却塔 Approach Shadow 最新样本

- 采样时间：2026-06-10T02:49:35.196Z
- 结论：GO_SHADOW_SAMPLE
- 模式：shadow
- 是否允许 enforced：否
- 是否尝试真实下发：否

## 工况

| 项目 | 数值 |
| --- | --- |
| COP | 6.70 |
| 总功率 | 1391.1 kW |
| 当前负荷 | 9638.1 kW |
| 负荷率 | 38.1% |
| 负荷率来源 | overview.energyCards.currentLoadRate |
| 负荷区间 | low |
| 湿球温度 | 21.5℃ |
| 冷却水回水/Tcws | 24.5℃ |
| 冷却水温差 | 4.5℃ |
| 热平衡偏差 | 13.0% |

## Approach 建议

| 项目 | 数值 |
| --- | --- |
| 当前 Approach | 3.0℃ |
| AI 目标 Approach | 3.0℃ |
| Approach 调整量 | 0.0℃ |
| AI 目标 Tcws | 24.5℃ |
| Tcws 调整量 | 0.0℃ |
| advisor 状态 | ready |
| executionReady | true |

## 执行台

| 项目 | 数值 |
| --- | --- |
| execution total | 4 |
| latest status | rolled_back |
| latest dispatch mode | -- |
| latest rollback ok | -- |

## 阻断项

- 无

## 风险提示

- thermal balance deviation is above 10%; compare savings conservatively

## 下一步

- Keep collecting read-only shadow samples across low/medium/high load bands; do not enable enforced.

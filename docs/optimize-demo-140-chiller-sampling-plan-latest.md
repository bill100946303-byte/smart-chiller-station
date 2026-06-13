# 140 主机组合样本采集计划检查

生成时间：2026-06-12T21:50:23.356Z

结论：`CHILLER_SAMPLING_PLAN_READY_TO_COLLECT`

覆盖状态：`baseline_high_confidence_only`

## 1. 样本覆盖

样本接口：`http://127.0.0.1:8799/bff/v1/sites/140/optimize/chiller-staging/samples?limit=1000`

| 指标 | 数值 |
| --- | ---: |
| 候选组合数 | 8 |
| 已有样本组合数 | 1 |
| >=30 条组合数 | 1 |
| >=100 条组合数 | 1 |
| 可对比目标组合数 | 0 |
| 缺 30 条门槛组合数 | 7 |

## 2. 候选组合计划

| 优先级 | 组合 | 容量 kW | 有效样本 | 置信 | 距 30 条 | 距 100 条 | 负荷率 | 湿球 | 冷站COP |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- |
| P0-baseline | `CH4+CH5+CH7` | 13715.7 | 115 | high | 0 | 0 | 8.7-94.5% | 21.7-32.5C | 0.67-7.47 |
| P0-compare | `CH2+CH5+CH7` | 13715.7 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P0-compare | `CH1+CH5+CH7` | 13715.7 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P1-coverage | `CH3+CH5+CH7` | 13715.7 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P1-coverage | `CH2+CH4+CH7` | 13012.3 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P1-coverage | `CH2+CH4+CH5` | 12308.9 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P1-coverage | `CH4+CH7` | 9143.8 | 0 | insufficient | 30 | 100 | -- | -- | -- |
| P1-coverage | `CH5+CH7` | 9847.2 | 0 | insufficient | 30 | 100 | -- | -- | -- |

## 3. 主机库存边界

| 主机 | 属性 | 额定RT | 额定kW | 可用 | 备注 |
| --- | --- | ---: | ---: | --- | --- |
| CH1 | old_fair | 1100 | 3868.5 | yes | 旧机，状况低于 CH2/CH4。 |
| CH2 | old_better | 1100 | 3868.5 | yes | 旧机，状况好于 CH1/CH3。 |
| CH3 | old_fair | 1100 | 3868.5 | yes | 旧机，状况低于 CH2/CH4。 |
| CH4 | old_better | 1100 | 3868.5 | yes | 旧机，状况好于 CH1/CH3。 |
| CH5 | near_new | 1300 | 4571.9 | yes | 1300RT 次新机。 |
| CH6 | stopped | -- | -- | no | 当前停机状态，容量规格待确认，第一版不进入候选组合。 |
| CH7 | new | 1500 | 5275.3 | yes | 1500RT 规格新机，现场可跑到 1700RT；常规容量余量按 1500RT 额定规格计算。 |

## 4. 下一步

- 继续保留 CH4+CH5+CH7 作为当前基线组合样本，但不要把单一组合样本解释为切换收益。
- 优先等待或人工安排 CH2+CH5+CH7、CH4+CH7、CH5+CH7 等候选组合的安全运行窗口。
- 每个候选组合至少达到 30 条同负荷/湿球/供水温 band 样本后，才允许进入组合间排序。
- 达到 100 条只能说明该组合自身样本高置信；仍需目标组合同工况样本才能承诺切换方向。
- 所有组合切换仍必须人工执行和 shadow 验证，AI 不自动启停主机。

## 5. Blockers / Warnings

Blockers: 无。

Warnings:
- 当前只有一个候选组合有样本，不能做组合间节能排序。
- 缺少达到 30 条的候选对比组合，主机组合 Advisor 仍应保持 keep/continue sampling。
- 当前基线组合可能已达到高置信，但目标组合样本不足，不能单边承诺切换收益。
- CH4+CH5+CH7: COP/负荷口径异常，比较前需按同工况 band 和数据质量过滤。

## 6. 边界

- 本检查只读查询 append-only 样本库，不调用会写样本的 `POST /optimize`。
- 多机并联无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆单机 COP。
- 样本计划 READY 不等于切换建议 READY；候选组合缺同工况样本时仍必须 keep/continue sampling。
- AI 不自动启停主机，不写真实 PLC，不进入 enforced。


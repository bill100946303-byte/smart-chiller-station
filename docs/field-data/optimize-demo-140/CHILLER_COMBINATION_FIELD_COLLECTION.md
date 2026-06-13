# 140 主机组合现场采样清单

更新时间：2026-06-13

## 1. 采样目标

140 站点主机组合优化当前目标不是自动切换主机，而是把不同组合在同负荷、同湿球、同冷冻水供水温附近的实测表现积累起来，支撑 `/optimize-demo` 的 shadow 建议。

当前已知设备边界：

| 主机 | 规格 | 状态口径 | 采样口径 |
| --- | ---: | --- | --- |
| CH1 | 1100RT | 旧机，状态弱于 CH2/CH4 | 不主动切换采样，等待自然运行窗口 |
| CH2 | 1100RT | 旧机，状态好于 CH1/CH3 | P0 对比组合优先采样 |
| CH3 | 1100RT | 旧机，状态弱于 CH2/CH4 | P1 覆盖采样 |
| CH4 | 1100RT | 旧机，状态好于 CH1/CH3，当前基线组合成员 | 继续作为基线组合样本底座 |
| CH5 | 1300RT | 次新机 | P0/P1 组合成员 |
| CH6 | 未确认 | 当前停机 | 第一版不进入候选组合 |
| CH7 | 1500RT | 新机，现场可跑到 1700RT | 容量余量仍按 1500RT 名义规格计算 |

多机并联且没有单台冷冻水流量时，只记录组合 COP / 冷站 COP，不拆单台主机 COP。

## 2. 采样优先级

| 优先级 | 组合 | 目标 | 采样条件 |
| --- | --- | --- | --- |
| P0-baseline | `CH4+CH5+CH7` | 当前基线组合，继续积累稳定样本 | 自然运行即可采样 |
| P0-compare | `CH2+CH5+CH7` | 用状态较好的 CH2 替代 CH4，形成主对比组合 | 仅在现场人工允许切换、无高等级告警、满足最小启停间隔时采样 |
| P0-compare | `CH5+CH7` | 次新机 + 新机两机组合，验证中低负荷效率 | 必须确认容量余量和末端安全 |
| P1-coverage | `CH4+CH7` | CH4 + 新机两机组合，补中低负荷覆盖 | 必须确认容量余量和末端安全 |
| P1-coverage | `CH1+CH5+CH7` | 验证状态较弱旧机组合差异 | 不为了测试主动切换，等待自然运行 |
| P1-coverage | `CH3+CH5+CH7` | 验证状态较弱旧机组合差异 | 不为了测试主动切换，等待自然运行 |
| P1-coverage | `CH2+CH4+CH7` | 两台较好旧机 + 新机组合 | 中高负荷窗口采样 |
| P1-coverage | `CH2+CH4+CH5` | CH7 不可用时的备用组合参考 | 仅作为备用策略样本 |

## 3. 单个采样窗口最低条件

| 检查项 | 最低要求 |
| --- | --- |
| 当前组合稳定运行 | 建议 `>=90min`，启停后前 `15min` 不纳入比较 |
| 容量余量 | 候选组合按名义容量计算，建议 `>=12%` |
| 告警 | `alarmCount=0`，无高等级告警 |
| 数据质量 | 总冷量、总站功率、主机总功率、湿球、冷冻水供水温不 stale |
| 负荷稳定性 | 采样窗口内负荷突变不超过现场约定阈值，建议先按 `±10%` 粗筛 |
| 人工确认 | 有值班员/运维负责人确认，不因采样目的绕过 PLC 本地保护 |

## 4. 需要记录的字段

现场手工复核或导出清单可参考：

- `templates/chiller-combination-sampling-log.template.csv`

核心字段：

| 字段 | 说明 |
| --- | --- |
| `windowStart/windowEnd` | 样本窗口开始/结束时间 |
| `runningCombination` | 例如 `CH4+CH5+CH7` |
| `combinationRunMinutes` | 当前组合连续运行分钟数 |
| `loadKwAvg/loadKwMin/loadKwMax` | 采样窗口系统冷量 |
| `wetBulbCAvg/wetBulbCMin/wetBulbCMax` | 室外湿球 |
| `chilledSupplyTempCAvg` | 冷冻水供水温 |
| `chillerPowerKwAvg` | 主机总功率 |
| `stationPowerKwAvg` | 冷站总功率 |
| `comboCopAvg/stationCopAvg` | 组合 COP / 冷站 COP |
| `alarmCount` | 窗口内告警数量 |
| `manualSwitchApproved/operatorConfirmed` | 是否人工允许、是否值班员确认 |
| `sourceReportId` | 对应 SCADA 报表、趋势导出或 shadow 复核记录编号 |

## 5. 可比较门槛

| 阶段 | 样本门槛 | 允许表达 |
| --- | ---: | --- |
| 采样中 | `1-29` 条 | 只能说明正在积累，不做排序 |
| 低置信比较 | `>=30` 条/组合 | 允许做同工况低置信排序 |
| 高置信比较 | `>=100` 条/组合 | 允许表达较高置信排序，仍只进入 shadow/人工审阅 |

同工况 band 先按以下边界筛选：

| 维度 | 容差 |
| --- | ---: |
| 组合负荷率 | `±10%` |
| 室外湿球 | `±1.5C` |
| 冷冻水供水温 | `±0.5C` |

## 6. 禁止项

- 不为了采样由 AI 自动启停主机。
- 不把 `CH7` 可跑到 1700RT 作为长期额定容量承诺。
- 不把单一组合样本高置信解释为切换节能结论。
- 不在多机并联无单台流量时拆单机实时 COP。
- 不绕过人工审批、PLC 本地保护、最小启停时间和现场安全边界。

## 7. 每日复核命令

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-chiller-sampling-plan
```

期望当前阶段结论：

- `CHILLER_SAMPLING_PLAN_READY_TO_COLLECT`
- `baseline_high_confidence_only`
- 候选对比组合仍需补样本时，不允许生成真实节能承诺。

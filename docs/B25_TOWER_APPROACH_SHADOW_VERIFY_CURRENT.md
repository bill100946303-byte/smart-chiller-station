# B25 冷却塔 Approach Shadow 验证口径

## 1. 当前结论

- 当前状态：允许进入 `shadow` 观察，不允许进入 `enforced` 自动执行。
- 当前链路：`dashboard overview -> optimize advisor -> tower-approach execution governance -> dispatch mapping` 已具备验证条件。
- 当前控制点映射：`GO_REAL_DISPATCH_MAPPING`。
- 当前 Shadow 前置：`GO_SHADOW`。
- 当前核心风险：真实下发点是 `冷却回水手动值 / SY-1-509-41413`，不是独立 `AI_Tcws_Target` 或 `AI_Approach_Target`，必须现场确认 PLC 是否采纳。

## 2. Shadow 验证目标

| 目标 | 验证口径 |
| --- | --- |
| 安全性 | 不触发冷凝器进水低温、塔风机频率下限、冷却水温差异常、高等级告警 |
| 稳定性 | AI 目标值不频繁反向跳变，`Tcws` 与 `Approach` 无持续锯齿振荡 |
| 节能性 | 相近负荷率、相近湿球下，总功率、kW/RT、COP 不劣化，塔风机功率下降需综合冷机功率校核 |
| 可解释性 | 每次建议能追溯到实时值、湿球、负荷率、边界约束、执行台状态 |
| 可回退 | 保持审批/回退链路有效，真实执行前必须可一键回退 |

## 3. Shadow 阶段禁止动作

- 不打开 `towerApproachDispatchMode=enforced`。
- 不把 AI 目标直接写入 PLC 自动目标。
- 不用 `冷却回水目标值`、`冷却回水自动值`、`目标逼近度` 作为写入点；当前这些点按只读处理。
- 不在未确认手自动逻辑前批量修改 `冷却塔温度手自动`。
- 不用单一时刻 COP 证明节能，必须做相近工况对比。

## 4. 采样字段

| 类别 | 字段 |
| --- | --- |
| 工况 | 时间、负荷率、总冷量、冷机运行台数、室外湿球、室外干球、湿度 |
| 冷却水 | `Tcws`、`Tcwd`、冷却水温差、当前 Approach、目标 Approach、目标 `Tcws` |
| 功率 | 总功率、冷机功率、冷却塔风机功率、冷却泵功率、冷冻泵功率 |
| 能效 | COP、kW/RT、热平衡偏差 |
| 执行台 | executionId、状态、审批状态、回退状态、dispatch mode、dispatch receipt |
| 安全 | 高等级告警、传感器缺测、数据陈旧、低温边界、频率上下限 |

## 5. 分层验证步骤

### 5.1 Read-only 基线

1. 保持 dispatch 关闭或 shadow。
2. 每 5 到 10 分钟记录一次 AI 建议值与实时反馈。
3. 至少覆盖高/中/低负荷三个区间。
4. 每个区间至少保留 2 小时连续样本。

### 5.2 Shadow 对比

1. 不真实下发，只记录 AI 目标与现场实际值偏差。
2. 按相近湿球、相近负荷率筛选样本。
3. 对比 `COP / kW/RT / 总功率 / 冷机功率 / 塔风机功率 / 告警次数`。
4. 若 AI 目标频繁越界或收益不稳定，回退到只读建议。

### 5.3 Assisted 前置

进入 assisted 前必须满足：

- `check:tower-approach-control-mapping` 仍为 `GO_REAL_DISPATCH_MAPPING`。
- `check:b25-tower-approach-readiness` 仍为 `GO_SHADOW`。
- 现场确认 `SY-1-509-41413` 在当前手自动模式下会被 PLC 正确采纳。
- PLC 已具备限幅、死区、变化率限制、告警闭锁、手动回退。
- 运维人员确认可在异常时切回原控制策略。

## 6. 当前命令

```bash
npm --prefix apps/chiller-bff test
npm --prefix apps/chiller-bff run check:contract
npm --prefix apps/chiller-shell-v1 run build
npm --prefix apps/chiller-bff run check:optimize-smoke-suite
npm --prefix apps/chiller-bff run check:tower-approach-control-mapping
npm --prefix apps/chiller-bff run check:b25-tower-approach-readiness
npm --prefix apps/chiller-bff run collect:b25-tower-approach-shadow
```

## 7. 当前 Shadow 样本

| 项目 | 当前值 |
| --- | --- |
| 最新样本 | `docs/b25-tower-approach-shadow-latest.md` |
| 连续样本 | `docs/b25-tower-approach-shadow-samples.jsonl` |
| 最新状态 | `GO_SHADOW_SAMPLE` |
| 最新时间 | `2026-06-10T02:49:35.196Z` |
| 负荷率 | `38.1%` |
| 负荷区间 | `low` |
| 负荷率来源 | `overview.energyCards.currentLoadRate` |
| 是否真实下发 | 否 |
| 当前限制 | 热平衡偏差高于 10%，节能对比需保守解释 |

## 8. 退出条件

出现任一情况，立即退出 shadow/assisted 验证：

- 高等级告警增加。
- 冷却水温度逼近厂家最低冷凝器进水边界。
- `Approach` 或 `Tcws` 出现持续振荡。
- 总功率或 kW/RT 在相近工况下明显劣化。
- 数据源 `sourceStatus` 不是 `ok/partial` 可解释状态。
- dispatch 回执语义与现场执行结果不一致。

## 9. 后续建议

商业化落地前，建议 PLC/SCADA 新增独立可写点：

- `AI_Tcws_Target`
- 或 `AI_Approach_Target`

由 PLC 负责最终限幅、死区、防震荡、告警闭锁和回退。AI 只输出建议目标值，不直接绕过 PLC 安全边界。

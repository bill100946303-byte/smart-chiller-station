# 140 主机组合样本采集计划

更新时间：2026-06-13

## 1. 结论

140 站点主机组合 Advisor 下一步不是直接推荐换机，而是先把组合样本覆盖做实。

当前工程口径：

- `CH4+CH5+CH7` 是当前主要基线组合。
- `CH4` 为状况较好的 1100RT 旧机，`CH5` 为 1300RT 次新机，`CH7` 为 1500RT 规格新机。
- `CH7` 现场可跑到 1700RT，但组合容量余量仍按 1500RT 名义规格计算，不能按 1700RT 承诺长期容量。
- `CH6` 当前停机且规格未确认，不进入候选组合。
- 多机并联无单台冷冻水流量时，只积累组合 COP / 冷站 COP，不拆单机实时 COP。

样本治理目标：每个候选组合至少 `30` 条同工况有效样本后才进入低置信比较，至少 `100` 条才允许标为高置信；但高置信只对该组合自身成立，仍需要目标组合同工况样本才能判断切换收益。

`/optimize-demo` 已接入 `chillerStagingAdvisor.sampleGovernance`：页面会显示 `仅基线高置信`、`候选覆盖`、`候选组合样本缺口` 等信息。该口径专门防止把 `CH4+CH5+CH7` 的单组合样本积累误写成可切换节能结论。

## 2. 自动检查命令

只读检查当前 append-only 样本覆盖：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-chiller-sampling-plan
```

输出：

- `docs/optimize-demo-140-chiller-sampling-plan-latest.json`
- `docs/optimize-demo-140-chiller-sampling-plan-latest.md`

该脚本只读查询：

```text
GET /bff/v1/sites/140/optimize/chiller-staging/samples
```

不会调用 `POST /optimize`，因此不会写入新样本，不会创建 shadow 单，不会启停设备。

现场采样执行清单和人工记录表头见：

- `docs/field-data/optimize-demo-140/CHILLER_COMBINATION_FIELD_COLLECTION.md`
- `docs/field-data/optimize-demo-140/templates/chiller-combination-sampling-log.template.csv`

## 3. 候选组合优先级

| 优先级 | 组合 | 目的 | 采样方式 |
| --- | --- | --- | --- |
| P0-baseline | `CH4+CH5+CH7` | 当前基线组合，先形成稳定样本底座 | 自然运行时 append-only 采样 |
| P0-compare | `CH2+CH5+CH7` | 用另一台状况较好的旧机替换 CH4 做对比 | 仅在现场人工允许切换且满足防频繁启停时采样 |
| P0-compare | `CH1+CH5+CH7` | 验证较差旧机组合是否明显低效 | 不主动为了测试切换，可等待自然运行窗口 |
| P1-coverage | `CH3+CH5+CH7` | 验证较差旧机组合 | 不主动为了测试切换，可等待自然运行窗口 |
| P1-coverage | `CH2+CH4+CH7` | 两台较好旧机 + 新机组合 | 中高负荷窗口采样 |
| P1-coverage | `CH2+CH4+CH5` | 新机不可用或低负荷时备用组合参考 | 仅用于覆盖备用策略 |
| P1-coverage | `CH4+CH7` | 中低负荷两机组合 | 需确认容量余量和末端安全 |
| P1-coverage | `CH5+CH7` | 次新机 + 新机两机组合 | 需确认容量余量和末端安全 |

## 4. 有效样本定义

一条有效样本必须同时满足：

| 项 | 要求 |
| --- | --- |
| 运行组合 | 有明确 `runningCombination` / `combinationKey` |
| 系统冷量 | `loadKw > 0` |
| 冷站功率 | `stationPowerKw > 0` |
| 主机总功率 | 有 `chillerPowerKw` 时可计算组合 COP；缺失时只能评价冷站 COP |
| 湿球 | 尽量有 `wetBulbC`，用于同工况分箱 |
| 冷冻供水温 | 尽量有 `chilledSupplyTempC`，用于同工况分箱 |
| 告警 | 样本窗口 `alarmCount = 0` |
| 防震荡 | 当前组合稳定运行建议 `>= 90min`，启停后前 15min 不建议纳入比较 |

同工况比较默认边界：

| 维度 | 容差 |
| --- | ---: |
| 组合负荷率 | `±10%` |
| 室外湿球 | `±1.5C` |
| 冷冻水供水温 | `±0.5C` |

## 5. 升级条件

| 阶段 | 条件 | Advisor 行为 |
| --- | --- | --- |
| 无样本 | 组合样本 0 条 | `unavailable/read_only`，只展示当前组合 |
| 采样中 | 单组合 1-29 条 | `partial/read_only`，继续采样 |
| 基线可用 | 当前组合 >=30 条，目标组合不足 30 条 | 可说明基线样本可用，但不能推荐切换 |
| 可比较 | 当前组合和至少一个目标组合各 >=30 条，且同工况 band 有重叠 | 可进入低置信组合排序和 shadow 建议 |
| 高置信 | 当前组合和目标组合各 >=100 条，且同工况 band 有重叠 | 可表达高置信排序，但仍只允许 shadow/人工审批 |

切换建议还必须满足：

- 候选组合容量余量 `>=12%`。
- 当前组合运行 `>=90min`。
- 无高等级告警。
- 数据未 stale。
- 预计节能 `>=30kW` 或 `>=5%`。

## 6. 现场执行边界

采样计划不是启停计划。

- AI 不为了采样自动切换主机。
- AI 不自动启停主机。
- 候选组合只在现场运行允许、值班员确认、PLC 本地保护满足时采样。
- 所有样本只进入 append-only 证据库。
- 多机窗口不拆单机 COP。
- 若要做人工 shadow 对比，仍按 `shadow_compare_30_60min_same_load_wet_bulb_band` 记录结果。

## 7. 下一步

1. 每天运行 `check:optimize-demo-140-chiller-sampling-plan`，观察候选组合覆盖。
2. `CH4+CH5+CH7` 达到高置信后，优先补 `CH2+CH5+CH7`、`CH5+CH7` 和 `CH4+CH7` 的自然运行或人工批准窗口。
3. 每个组合达到 30 条后，再看同负荷/湿球/供水温 band 是否可比较。
4. 只有目标组合也满足样本、容量、告警和节能门槛，才允许生成 `switch_combination` shadow 建议。

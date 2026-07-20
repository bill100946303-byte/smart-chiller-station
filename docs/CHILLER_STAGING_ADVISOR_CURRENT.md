# CHILLER_STAGING_ADVISOR_CURRENT

## 1. 当前定位

`/optimize-demo` 新增 `chillerStagingAdvisor`，用于主机组合优化演示。

当前只允许：

- 主机组合实测性能排序
- shadow 建议
- 审批演示
- 同工况节能验证口径

当前不允许：

- 自动启停主机
- 真实 PLC 下发
- `enforced` 无人值守闭环
- 多机并联时强行拆分单台主机 COP

## 2. 建模边界

现场没有单台主机冷冻水流量时，数据口径如下：

| 运行场景 | 可以计算 | 不允许声称 |
|---|---|---|
| 单台主机运行 | 单机实测 COP 样本 | 跨工况固定厂家曲线 |
| 多台主机并联 | 主机组合 COP、冷站 COP、组合 kW/RT | 单台主机实时 COP 精确排名 |
| 旧机/新机/大小机混合 | 组合容量、组合负荷率、历史同工况表现 | 简单按台数平均负荷 |

第一版算法以 `combination_empirical_performance` 为依据：同负荷率、相近湿球、相近冷冻供水温下比较历史主机组合表现。

## 3. 关键规则

| 规则 | 当前默认 |
|---|---:|
| 组合样本最小数量 | 30 条 |
| 高置信样本数量 | 100 条 |
| 当前组合最小运行时间 | 90 min |
| 候选组合容量余量 | >= 12% |
| 同负荷率容差 | +/-10% |
| 同湿球容差 | +/-1.5 C |
| 同冷冻供水温容差 | +/-0.5 C |
| 切换收益门槛 | >= 30 kW 或 >= 5% |

不满足样本、容量、告警、新鲜度或防频繁切换条件时，Advisor 必须降级为 `partial` / `unavailable`，不能伪造节能结论。

## 4. 输出口径

`chillerStagingAdvisor` 与 `towerApproachAdvisor`、`pumpDeltaTAdvisor` 并列返回。

核心字段：

- `current.runningCombination`
- `current.combinationPlrPct`
- `current.comboCop`
- `current.stationCop`
- `recommendation.action`
- `recommendation.targetCombination`
- `recommendation.expectedTotalPowerDeltaKw`
- `recommendation.expectedCopDelta`
- `evidence.sampleSummary`
- `evidence.currentCombinationEvidence`
- `evidence.targetCombinationEvidence`
- `evidence.shadowVerificationPlan`
- `sampleGovernance`
- `candidates`
- `blockers`
- `warnings`

`advisorResult.execution.enforcedAllowed` 固定为 `false`。

### `sampleGovernance` 样本治理口径

`sampleGovernance` 用于把“有样本”和“可比较”拆开，避免把单一基线组合样本误解释成可切换节能结论。

| 字段 | 说明 |
|---|---|
| `status` | 样本治理状态：`comparison_candidate_available` / `baseline_high_confidence_only` / `baseline_ready_only` / `collection_started` / `no_samples` |
| `readyForRanking` | 是否至少存在一个非当前候选组合达到同工况样本门槛 |
| `currentCombinationSamples` | 当前组合的累计有效样本数，代表 broad coverage |
| `currentSameBandSamples` | 当前组合在当前负荷/湿球/供水温 band 内的可比样本数 |
| `coveredCandidateCount` | 有任意样本的候选组合数 |
| `sameBandReadyCandidateCount` | 非当前候选组合中达到同工况 30 条门槛的数量 |
| `missingCandidateCoverage` | 最需要补样本的候选组合及缺口 |

状态解释：

| 状态 | 工程含义 | Advisor 行为 |
|---|---|---|
| `comparison_candidate_available` | 当前组合和至少一个目标组合都有同工况样本 | 可进入组合排序和 shadow 评审，但仍需容量、告警、运行时长、节能门槛 |
| `baseline_high_confidence_only` | 当前基线组合累计样本达到 100 条，但目标组合缺同工况样本 | 只能说明基线样本充分，不能承诺换机收益 |
| `baseline_ready_only` | 当前组合达到 30 条，但目标组合不足 | 继续采样，不建议切换 |
| `collection_started` | 已有样本但不足 30 条 | 仅审阅/采样中 |
| `no_samples` | 尚无组合历史样本 | 只展示当前组合和阻断项 |

注意：`totalSamples/currentCombinationSamples` 用于判断样本底座是否充分；`sameBandSamples/currentSameBandSamples` 才能用于同工况排序。没有同工况目标组合样本时，`sampleGovernance` 必须阻止“切换更节能”的表达。

## 5. 样本数据结构

第一版不新建真实控制闭环，样本先通过 BFF 配置/历史上下文聚合，字段口径如下：

| 字段 | 说明 |
|---|---|
| `combination` | 当前运行主机组合，例如 `["OLD-1","NEW-1"]` |
| `sampleCount` | 同组合、同工况历史样本数量 |
| `sampleMinutes` | 累计有效样本分钟数，可选 |
| `loadRatePct` | 组合负荷率 |
| `wetBulbC` | 室外湿球温度 |
| `chilledSupplyTempC` | 冷冻水供水温度 |
| `stationCop` | 冷站 COP，优先用于综合节能判断 |
| `comboCop` | 主机组合 COP，仅代表组合，不拆单机 |
| `kwPerRt` | 冷站 kW/RT，可由冷站总功率与总冷量折算 |
| `stationPowerKw` | 冷站总功率 |
| `chillerPowerKw` | 主机总功率 |
| `alarmCount` | 样本窗口告警数量 |
| `source` | 样本来源 |

支持两类输入：

| 输入类型 | 字段 | 用途 |
|---|---|---|
| 预聚合组合历史 | `combinationHistory` / `chillerCombinationHistory` | 已经按组合、工况窗口汇总好的样本 |
| 原始运行点表 | `runtimeSamples` / `rawSamples` / `chillerRuntimeSamples` | 5min/15min 运行样本，由 BFF 聚合成组合历史 |

原始运行点表最小字段：

- `runningCombination` 或 `activeChillerIds`
- `loadKw`
- `stationPowerKw`
- `chillerPowerKw`，可选；缺失时只评价冷站 COP，组合 COP 降级
- `wetBulbC`
- `chilledSupplyTempC`
- `intervalMinutes`，默认 5min
- `alarmCount`

BFF 默认按以下分箱聚合：

| 分箱 | 默认 |
|---|---:|
| 负荷率 | 5% |
| 湿球 | 1 C |
| 冷冻供水温 | 0.5 C |

学习规则：

- 单台运行窗口：可进入该主机单机 COP 样本池。
- 多台并联窗口：只进入组合 COP / 冷站 COP 样本池。
- 没有单机冷冻水流量时，不得从多机窗口拆分单台 COP。

## 6. 验证口径

shadow 验证采用：

- 方法：`shadow_compare_30_60min_same_load_wet_bulb_band`
- 时长：30-60 min
- 指标：`stationCop`、`comboCop`、`kwPerRt`、`stationPowerTotalKw`、`chillerPowerTotalKw`、`alarmCount`
- 验收：同负荷/相近湿球下冷站 COP 或 kW/RT 改善，且无新增告警。

验证结果记录口径：

| 阶段 | 记录内容 |
|---|---|
| 切换前基线 | 当前组合、负荷、湿球、供水温、冷站 COP、组合 COP、总功率、告警数 |
| 人工执行后观察 | 目标组合、30-60min 同工况窗口、冷站 COP、组合 COP、kW/RT、告警数 |
| 结果判定 | `improved` / `neutral` / `regressed` / `invalid` |
| 无效条件 | 负荷/湿球偏离、告警新增、数据 stale、人工干预导致工况不可比 |

结论：当前功能是工程演示和治理链路，不是正式自动控制功能。

## 7. 140 站点当前接入状态

140 站点（观澜B25）已经可以从实时设备点表读取主机运行反馈：

- 实时来源：`/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0`
- 当前识别到 7 台主机：`CH1` 至 `CH7`
- 当前运行组合按 `运行=1` 推导，示例为：`CH4 + CH5 + CH7`
- 组合主机功率来自各主机 `功率` 点，和 dashboard 的主机总功率用于交叉校验

已按现场反馈补充第一版主机库存配置：

| 主机 | 名义规格 | BFF 额定容量 | 状态/属性 | Advisor 处理 |
|---|---:|---:|---|---|
| CH1 | 1100RT | 3868.5 kW | 旧机，状况低于 CH2/CH4 | 可参与候选，但需历史样本验证 |
| CH2 | 1100RT | 3868.5 kW | 旧机，状况好于 CH1/CH3 | 可参与候选 |
| CH3 | 1100RT | 3868.5 kW | 旧机，状况低于 CH2/CH4 | 可参与候选，但需历史样本验证 |
| CH4 | 1100RT | 3868.5 kW | 旧机，状况好于 CH1/CH3 | 可参与候选，当前运行示例之一 |
| CH5 | 1300RT | 4571.9 kW | 次新机 | 可参与候选，当前运行示例之一 |
| CH6 | 待确认 | 待确认 | 停机状态 | 默认不可用，不进入候选组合 |
| CH7 | 1500RT | 5275.3 kW | 新机，现场可跑到 1700RT | 容量余量按 1500RT 规格算，1700RT 仅作为现场可达上限备注 |

容量边界说明：

- 第一版容量余量按“名义规格”计算，不按短时可达上限扩大组合容量。
- `CH7` 的 1700RT 信息只作为工程备注，不能在 shadow 建议里直接承诺可长期按 1700RT 运行。
- `CH1-CH5 + CH7` 的已知名义容量合计为 7200RT / 25322.4 kW，和当前站点全站额定冷量配置一致；`CH6` 若恢复使用，必须先补厂家规格、可用状态和保护边界。

140 当前仍必须保持 `read_only` / `仅审阅`：

| 缺口 | 影响 |
|---|---|
| 组合历史样本未积累 | 不能比较 `CH4+CH5+CH7` 与其他组合的同工况实测表现 |
| 当前连续运行时长未接入 | 不能严格执行 90min 防频繁切换校验 |
| 多机运行无单台冷冻水流量 | 不能拆分单机实时 COP |
| CH6 规格和可用状态未确认 | 不能把 CH6 放入候选组合 |

因此，140 当前页面可以展示“当前运行组合 + 组合额定容量 + 组合负荷率 + 组合 COP / 冷站 COP + 阻断项”，但不能给出真实换机节能承诺。下一步应补齐：

- 当前组合连续运行时长
- 更长周期的运行样本：运行组合、总冷量、冷站总功率、主机总功率、湿球、冷冻水供水温、告警数
- 人工 shadow 切换后的 30-60min 同工况验证结果
- `CH6` 的名义容量、启用条件、检修/禁用状态

## 8. Append-only 样本积累

当前版本已增加主机组合样本入库，但仍只服务于 advisor 证据，不触发任何真实控制：

- 入库表：`admin_chiller_staging_samples`
- 查询接口：`GET /bff/v1/sites/{siteId}/optimize/chiller-staging/samples`
- 写入触发：调用 `POST /bff/v1/sites/{siteId}/optimize` 生成草案时，如果 `currentLiveSample.status=recordable`，BFF 自动尝试 append-only 写入。
- 节流规则：同一运行组合默认至少间隔 `sampleMinutes`，当前为 5min；间隔不足时返回 `sampleCapture.status=skipped_recent`，不重复写入。
- 回灌规则：下一次生成草案时，已入库样本会作为 `chillerRuntimeSamples` 回灌给 `chillerStagingAdvisor`，用于组合样本数、组合 COP、冷站 COP、kW/RT 聚合。
- 边界：本次实时快照仍标记 `includedInHistory=false`；只有写入样本库后的历史样本才参与下一次聚合，避免“边生成边证明自己”。
- 前端展示：`/optimize-demo` 的“本次采样”卡片展示真实 `sampleCapture.status`，可区分 `已入库`、`节流跳过`、`未入库`、`入库失败`。

样本低于门槛时的状态：

| 样本状态 | Advisor 行为 |
|---|---|
| 0 条 | `unavailable`，阻断项为缺主机组合历史样本 |
| 1-29 条 | `partial/read_only`，阻断项为样本数低于 30 条 |
| ≥30 条 | 可进入候选组合比较，但仍需满足容量余量、告警、运行时长、节能门槛 |
| ≥100 条 | 可标为高置信候选 |

当前 140 实测验证口径：

- 生成草案可写入 `CH4+CH5+CH7` append-only 样本。
- 5 分钟内再次生成：返回 `sampleCapture.status=skipped_recent`，跳过重复入库。
- 最新只读采样计划检查显示：`CH4+CH5+CH7` 有效样本已超过 100 条，达到该组合自身高置信门槛；具体实时计数以 `docs/optimize-demo-140-chiller-sampling-plan-latest.json` 为准。但候选对比组合仍为 0 条，因此不能做组合间节能排序，Advisor 仍必须保持 `keep/continue sampling` 或只读审阅。

## 9. 140 样本采集计划检查

已新增只读采样计划检查：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-chiller-sampling-plan
```

该检查只读查询 `GET /bff/v1/sites/140/optimize/chiller-staging/samples`，不会调用 `POST /optimize`，因此不会写入新样本。

输出文件：

- `docs/optimize-demo-140-chiller-sampling-plan-latest.json`
- `docs/optimize-demo-140-chiller-sampling-plan-latest.md`

状态口径：

| 状态 | 含义 |
|---|---|
| `CHILLER_SAMPLING_PLAN_READY_TO_COLLECT` | 主机库存、候选组合和只读样本接口可用，可以继续按计划采样 |
| `CHILLER_SAMPLING_PLAN_BLOCKED` | 候选组合、主机库存或样本接口缺失，采样计划不可验收 |

注意：采样计划 READY 不等于主机组合切换建议 READY。若只有 `CH4+CH5+CH7` 一个组合有样本，即使该组合达到 100 条，也只能说明基线组合样本较充分；目标组合缺同工况样本时，Advisor 仍应保持 `keep/continue sampling`。

详细计划见 `docs/OPTIMIZE_DEMO_140_CHILLER_SAMPLING_PLAN_CURRENT.md`。

最新检查结果：

| 字段 | 当前结果 |
|---|---|
| 采样计划结论 | `CHILLER_SAMPLING_PLAN_READY_TO_COLLECT` |
| 覆盖状态 | `baseline_high_confidence_only` |
| 候选组合数 | 8 |
| 已有样本组合数 | 1 |
| `CH4+CH5+CH7` 有效样本 | `>=100`，实时计数见 `docs/optimize-demo-140-chiller-sampling-plan-latest.json` |
| 可对比目标组合数 | 0 |
| 工程结论 | 基线组合可继续作为样本底座，但目标组合缺样本，不能承诺切换收益 |

## 10. 2026-06-12 140/B25 早期 smoke 验收证据

本轮曾使用当时代码和真实 140/B25 页面完成端到端 smoke：

```bash
SITE_ID=140 \
BFF_BASE_URL=http://127.0.0.1:8799 \
APP_BASE_URL=http://127.0.0.1:3004 \
CDP_LIST_URL=http://127.0.0.1:61392/json/list \
B25_UI_SMOKE_STRICT=1 \
B25_SMOKE_OUTPUT_PATH=/tmp/chiller-b25-ui-smoke-140.json \
npm --prefix apps/chiller-bff run check:optimize-smoke-suite
```

结果：`2/2` 通过。

与主机组合 Advisor 相关的当时页面证据：

| 字段 | 140/B25 当时结果 |
|---|---|
| 当前主机组合 | `CH4 + CH5 + CH7` |
| 主机组合样本 | `0 / 需30`，继续采样 |
| 推荐动作 | 保持当前 / 继续采样 |
| 阻断原因 | 缺主机组合历史样本，只能方向性审阅 |
| 多机单台 COP | 未展示，仍只展示组合/冷站口径 |
| 真实 PLC | 锁定，不下发 |

该早期结果证明“组合识别、样本口径、阻断逻辑、shadow 审批边界”成立。当前样本库已进展到 `CH4+CH5+CH7` 基线高置信，但仍不能证明“切换组合可节能”，因为目标候选组合缺同工况样本。

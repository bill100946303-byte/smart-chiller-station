# `/optimize-demo` 运行诊断 Advisor 当前说明

## 结论

当前 140/B25 实时点位资源可以支撑 6 类只读诊断的第一版；其中仪表数据可信度诊断已接入可选 24h 趋势窗口和稳态窗口筛选，冷冻水水力平衡诊断已接入低温差持续性趋势判断、水力风险指示和现场复核对象，控制震荡诊断已接入温差锯齿波/总功率 hunting 风险提示和高频控制证据缺口，低温差根因诊断已接入趋势联动排序，泵频 Advisor 已补 shadow 点位映射和 assisted 安全前置条件：

1. 仪表数据可信度诊断
2. 冷冻水水力平衡诊断
3. 控制震荡/频繁启停诊断
4. 低温差根因诊断
5. 冷却塔能力诊断
6. 主机健康与组合样本诊断

同时，`/optimize-demo` 已新增 **数据资源与诊断可行性矩阵**，把拓展项按 A/B/C 档展示：

- A档：现有数据可进入 V1，只做只读诊断或 shadow 证据。
- B档：只能输出疑似风险、待复核和样本治理建议。
- C档：暂不能做正式诊断，只进入点位改造清单。

第一版定位为 `read_only` 诊断和 shadow 评审证据，不新增真实 PLC 下发能力，不进入 `enforced`。`assisted` 只作为后续现场受控执行的 readiness 表达，缺任一安全前置条件时仍锁定为审阅/记录。

最新补充：`chilledHydraulicBalance.current.riskIndicators` 和 `fieldReviewTargets` 已把低温差持续性、支路流量/压差离散、旁通分流、末端安全缺口转成结构化风险排序与现场复核对象；`controlOscillation.current.riskIndicators` 和 `fieldReviewTargets` 已把温差锯齿波、总功率 hunting、频率命令/反馈缺口、启停事件缺口转成只读风险提示和复核对象；`instrumentDataQuality.current.sensorLedgerEvidence` 已接入传感器校准/安装位置台账预检状态；`operationalDiagnosticsAdvisor.summary.fieldVerificationChecklist` 已把 B/C 档缺口转成现场复核清单。该清单只用于点位/资料补齐和置信度提升，不触发审批、dispatch、rollback 或 PLC 写入。

## 可用数据

140/B25 实时设备树当前可提供：

| 类别 | 已有点位能力 | 可支撑诊断 |
| --- | --- | --- |
| 主机 | CH1-CH7 运行、故障、远程、功率、蒸发/冷凝侧温度、部分负荷/状态 | 主机健康、当前组合、组合 COP 证据 |
| 冷冻水泵 | 运行、频率反馈、功率、部分流量 | 低温差、泵侧大流量风险 |
| 冷却水泵 | 运行、频率反馈、功率、部分流量 | 冷却侧低温差、塔泵协同 |
| 冷却塔 | 风机功率/频率、塔侧流量、塔侧压力、阀位状态 | 接近度、塔能力、配水风险 |
| 总管 | 冷冻总管供回水温度/压力、冷却总管供回水温度、湿球温度 | COP/温差/压差/Approach |
| 支路 | 支路供回水温度、回水流量、回水压力 | 水力平衡风险提示 |
| 旁通 | 冷冻旁通/压差调节阀开度反馈 | 低温差根因线索 |

## 140/B25 点位识别字典

140/B25 已增加站点级 `operationalDiagnosticsPointDictionary`，优先于泛化关键词识别：

| 类别 | 识别口径 | 过滤边界 |
| --- | --- | --- |
| 冷冻水泵 | 设备编码 `CHP\d+`，或严格的 `数字#冷冻泵/冷冻水泵` 名称 | 不把冷冻泵出口阀、流量计、水表、总管、支路、旁通点当作泵 |
| 冷却水泵 | 设备编码 `CWP\d+`，或严格的 `数字#冷却泵/冷却水泵` 名称 | 不把冷却泵出口阀、流量计、水表、总管、支路、旁通点当作泵 |
| 冷却塔/塔风机 | 设备编码 `CT\d+`，或严格的冷却塔/塔风机设备名称 | 不把冷却塔阀门、流量计、水表、开到位/关到位状态点当作塔设备 |
| 支路水力点 | `支路数字` 或 `Bxx` 建筑/支路标签 | 只采用瞬时流量、温度、压力；排除累计流量 |
| 冷却塔单元点 | `CT\d+` 或 `数字#冷却塔` 点位 | 只汇总流量、压力、功率、频率、运行；阀门开关状态不单独生成塔单元 |

该字典解决 140 现场“名称包含冷冻泵/冷却塔但本质是阀门或仪表”的误判问题。其它站点未配置字典时仍使用原有关键词兜底。

计数口径：

- `coolingTowerCount` 表示冷却塔组/单元数量。
- `coolingTowerFanCount` 表示塔风机设备行数量。
- `coolingTowerCellCount` 表示已汇总出有效点位的冷却塔单元数量。

## 建模边界

1. 单机 COP 只在单台主机运行窗口学习。
2. 多机并联且无单台冷冻水流量时，只评价主机组合 COP / 冷站 COP，不拆分单台主机实时 COP。
3. 支路流量差异只能提示水力分配风险；缺末端阀位、末端压差和房间温度趋势时，不能直接判定末端阀门故障。
4. 仪表偏移第一版采用实时横向一致性 + 24h 稳态窗口趋势偏移/波动范围；只能输出“疑似偏移、建议复核”，不能直接判定仪表故障或校准结论。
5. 水力平衡趋势第一版只用站级 24h 冷冻水温差/总功率趋势判断低温差是否持续；支路流量、压差、旁通阀仍是实时快照，不伪造支路历史趋势。
6. 控制震荡第一版只用小时级温差/总功率趋势提示锯齿波和 hunting 风险；没有高频命令/反馈、PID 参数和精确启停事件时，不判定 PID 参数错误或频繁启停。
7. 低温差根因趋势联动第一版把“低温差持续性”作为触发证据，再用实时泵频、旁通阀、支路流量比和末端数据缺口生成根因候选排序。
8. 泵频 shadow 映射第一版只记录目标点、回退点和安全前置条件；没有末端安全、PLC 本地保护和泵频反馈闭合时，不允许 assisted 下发。
9. 冷却塔能力第一版以湿球、冷却水温、塔功率/频率、塔侧流量为依据；填料脏堵、布水异常需结合现场巡检或更长趋势确认。

## 仪表数据偏移诊断 V1

数据入口：

- 实时快照：总功率、分项功率、冷站 COP、冷冻水温差、冷却水温差。
- 历史窗口：`dashboard/trends` 的 24h 曲线，当前采用 `currentCop`、`totalPowerKw`、`chilledDeltaT`、`coolingDeltaT`。

稳态窗口筛选：

- 优先使用 24h 制冷量趋势判断稳态。
- 若制冷量趋势缺失，使用冷站总功率作为负荷稳定性的代理信号。
- 当前阈值：至少 4 个有效趋势样本，窗口内制冷量/总功率波动不超过 12%。
- 若找不到稳态窗口，则漂移判断降级为趋势审阅，不输出 COP 偏移告警。

第一版输出：

| 信号 | 判断口径 | 输出边界 |
| --- | --- | --- |
| 冷站 COP | 稳态窗口内首末偏移超过阈值时提示复核 | 只提示冷量表/功率表/工况需核对，不判定仪表坏 |
| 总功率/分项功率闭合 | 分项功率合计与冷站总功率偏差超过阈值时提示复核 | 只提示总表/分表口径需核对，不判定电表故障 |
| 输入负荷/总功率/COP闭合 | 用输入负荷和总功率反算 COP，与现态 COP 比较 | 只提示冷量/功率/负荷口径不一致，不自动修正 COP |
| 冷却水出水/湿球物理边界 | Tcws 低于湿球过多时提示物理边界异常 | 不判定温度传感器损坏，不突破最低冷凝器进水温保护 |
| 总功率/制冷量 | 用于筛选稳态窗口 | 负荷不稳时不做漂移结论 |
| 冷冻水温差 | 稳态窗口内波动过大时提示供回水温度点位/工况切换复核 | 不直接判定温度传感器偏移 |
| 冷却水温差 | 稳态窗口内波动过大时提示冷却水温度点位/塔泵工况复核 | 不直接判定塔侧仪表故障 |

若趋势窗口缺失、样本不足或找不到稳态窗口，`instrumentDataQuality.current.driftWindow.status` 会降级为 `partial/unavailable`，实时闭合校验仍保留。

新增结构化字段：

| 字段 | 用途 | 边界 |
| --- | --- | --- |
| `instrumentDataQuality.current.driftCandidates` | 输出疑似偏移候选，如 COP 稳态漂移、功率闭合偏差、温差波动 | 候选只代表复核对象，不代表故障结论 |
| `instrumentDataQuality.current.crossChecks` | 输出总表/分表、COP 反算、湿球物理边界、稳态窗口等交叉校验 | 只读校验，不写 PLC、不修正测点 |
| `instrumentDataQuality.current.fieldReviewTargets` | 把候选转成现场复核对象和所需证据 | 用于补校准/安装位置台账，不触发审批 |
| `instrumentDataQuality.current.sensorLedgerEvidence` | 传感器校准/安装位置台账预检状态、接受行数、校准过期和缺量程计数 | 只提高复核效率；不判定仪表故障，不自动修正测点 |
| `instrumentDataQuality.current.reviewBoundary` | 对外边界文案 | 不判定仪表故障，不自动修正测点 |

## 冷冻水水力平衡趋势诊断 V1

数据入口：

- 站级趋势：`dashboard/trends` 的 24h `chilledDeltaT`、`totalPowerKw`，用于判断低温差是否在稳定负荷下持续。
- 实时快照：支路流量、支路压力、冷冻总管压差、旁通阀开度、泵频率。

第一版输出：

| 信号 | 判断口径 | 输出边界 |
| --- | --- | --- |
| 稳态窗口 | 沿用制冷量/总功率波动不超过 12%、至少 4 个样本 | 找不到稳态窗口时，只做趋势审阅 |
| 冷冻水温差 | 稳态窗口内均值低于 4.5℃，且低于目标下限占比不低于 60% | 只说明低温差具备持续性 |
| 支路流量/压力 | 实时支路流量比、压力差作为根因线索 | 不外推为全天水力失衡 |
| 旁通阀 | 实时开度大于阈值时提示旁通分流风险 | 需现场阀位和控制模式确认 |

若 `chilledHydraulicBalance.current.trendWindow.persistentLowDeltaT = true`，表示低温差在稳态窗口内具备持续性；是否可以降泵仍需结合末端阀位、室温、末端压差和旁通阀状态确认。

新增结构化字段：

| 字段 | 用途 | 边界 |
| --- | --- | --- |
| `chilledHydraulicBalance.current.riskIndicators` | 输出低温差持续性、支路流量离散、支路压差离散、旁通分流、末端安全缺口 | 只做风险排序，不自动降泵 |
| `chilledHydraulicBalance.current.fieldReviewTargets` | 把风险指示转成现场复核对象，如闭合末端安全、补支路趋势、复核旁通阀 | 只用于补证据，不创建执行单 |
| `chilledHydraulicBalance.current.activeRiskCount` / `gapCount` | 页面摘要显示风险数和证据缺口数 | 不代表故障数量 |
| `chilledHydraulicBalance.current.reviewBoundary` | 对外边界文案 | 不自动降泵，不直接判定末端阀门故障 |

## 控制震荡/频繁启停诊断 V1

数据入口：

- 小时级趋势：`dashboard/trends` 的 24h `chilledDeltaT`、`coolingDeltaT`、`totalPowerKw`，用于提示温差锯齿波和冷站总功率 hunting。
- 实时摘要：泵频率、塔风机频率、当前运行状态，用于说明已有实时反馈但缺高频命令/反馈。

第一版输出：

| 信号 | 判断口径 | 输出边界 |
| --- | --- | --- |
| 冷冻水温差锯齿波 | 趋势方向反转达到阈值且温差波动超过阈值 | 只提示冷冻水侧控制震荡风险，不自动改 PID、不自动降泵 |
| 冷却水温差锯齿波 | 趋势方向反转达到阈值且温差波动超过阈值 | 只提示冷却侧震荡风险，不自动改塔风机或冷却泵控制参数 |
| 冷站总功率 hunting | 总功率方向反转且波动达到阈值 | 只提示功率 hunting 风险，不自动切换设备组合 |
| 频率命令/反馈缺口 | 只有频率实时摘要，缺高频命令值/反馈值/控制模式 | 不判定 PID 参数错误 |
| 频繁启停事件缺口 | 缺主机/泵/塔精确启停事件、最小运行时间和启停延时 | 不判断频繁启停，不自动启停设备 |

新增结构化字段：

| 字段 | 用途 | 边界 |
| --- | --- | --- |
| `controlOscillation.current.riskIndicators` | 输出温差锯齿波、总功率 hunting、频率命令/反馈缺口、启停事件缺口 | 只做只读风险提示 |
| `controlOscillation.current.fieldReviewTargets` | 把风险指示转成现场复核对象，如补命令/反馈高频趋势、启停事件台账、PID/死区/延时参数台账 | 只用于人工复核和点位补齐 |
| `controlOscillation.current.activeRiskCount` / `watchRiskCount` / `gapCount` | 页面摘要显示风险、观察项和证据缺口 | 不代表已确认控制故障 |
| `controlOscillation.current.reviewBoundary` | 对外边界文案 | 不自动改 PID，不自动启停设备 |

当前关键缺口：

- 缺 1min 或更高频的设定值、命令值、反馈值、控制模式历史。
- 缺主机/泵/塔启停事件序列、最小运行/停机时间、加减机/加减塔延时参数。
- 缺 PID、死区、斜率限制和防震荡参数台账。

## 低温差根因趋势联动 V1

数据入口：

- 趋势证据：`chilledHydraulicBalance.current.trendWindow.persistentLowDeltaT`。
- 实时根因线索：冷冻泵平均频率、冷却泵平均频率、旁通阀开度、支路流量最大/最小比。
- shadow 条件：`pumpDeltaTAdvisor.executionReady`。

根因候选：

| 候选 | 触发口径 | 输出边界 |
| --- | --- | --- |
| 低温差持续性 | 稳态窗口内低温差占比达到阈值 | 这是触发证据，不作为最终根因首位 |
| 大流量小温差 / 泵频偏高 | 低温差持续且冷冻泵平均频率偏高 | 只能建议进入 shadow 验证，不自动降泵 |
| 支路水力分配不均 | 实时支路流量最大/最小比偏高 | 缺支路历史趋势时不外推全天失衡 |
| 旁通分流 | 旁通阀实时开度偏高 | 需确认阀门控制模式和反馈可靠性 |
| 末端缺冷风险未闭合 | 缺末端阀位、末端压差和室温趋势 | 这是降泵前的必要前置确认 |

`lowDeltaTRootCause.current.trendLinkage.candidates` 会按状态和优先级排序。第一版默认把“大流量小温差 / 泵频偏高”排在“低温差持续性”之前，因为持续性是证据，泵/水力/旁通才是可行动根因。

## 泵频 shadow 映射与安全前置条件 V1

数据入口：

- `pumpDeltaT.controlTargets.approve.commands`：冷冻泵/冷却泵频率 trim 目标点。
- `pumpDeltaT.controlTargets.rollback.commands`：回退点或回退命令。
- `pumpDeltaT.safetyInputs`：末端压差、末端阀位/室温/缺冷投诉、PLC 本地保护、最小流量保护、泵频反馈映射状态。

第一版输出：

| 信号 | 判断口径 | 输出边界 |
| --- | --- | --- |
| shadow 点位映射 | 识别 approve/rollback 命令中的冷冻泵、冷却泵目标点 | 可提交 shadow 单和审计记录，不代表真实 PLC 已接入 |
| 末端安全 | 末端压差、阀位、室温或投诉状态任一类闭合 | 未闭合时 assisted 锁定，只允许审阅/记录 |
| PLC 本地保护 | 本地保护和最小流量保护均闭合 | 未闭合时不允许受控下发 |
| 泵频反馈 | 有运行泵频反馈或映射确认 | 缺反馈时不能做执行后校验 |

`pumpDeltaTAdvisor.shadowMapping` 暴露映射状态、目标点、回退点和 `assistedDispatchReady`。`pumpDeltaTAdvisor.safetyPreconditions` 暴露末端安全、PLC 保护、泵频反馈和整体 `assistedReady`。当前第一版没有新增真实 PLC 写入能力；即使配置为 `assisted`，只要前置条件不完整，`dispatchReady` 仍为 `false`。

## BFF 字段

`POST /bff/v1/sites/{siteId}/optimize` 新增：

```json
{
  "operationalDiagnosticsAdvisor": {
    "status": "ready | partial | unavailable",
    "executionMode": "read_only",
    "basis": "runtime_point_consistency",
    "summary": {
      "diagnosticReadinessMatrix": {
        "basis": "available_runtime_history_and_safety_signals",
        "controlBoundary": "read_only_or_shadow_only",
        "readyNowCount": 4,
        "directionalCount": 4,
        "pointGapCount": 2,
        "items": []
      },
      "fieldVerificationChecklist": {
        "basis": "diagnostic_readiness_missing_data_to_field_tasks",
        "scope": "optimize_demo_field_verification_only",
        "controlBoundary": "read_only_point_verification_only",
        "p0Count": 4,
        "p1Count": 3,
        "items": []
      }
    },
    "items": [],
    "disclaimers": []
  }
}
```

固定 6 个 `items.key`：

| key | 名称 |
| --- | --- |
| `instrumentDataQuality` | 仪表数据可信度诊断 |
| `chilledHydraulicBalance` | 冷冻水水力平衡诊断 |
| `controlOscillation` | 控制震荡/频繁启停诊断 |
| `lowDeltaTRootCause` | 低温差根因诊断 |
| `coolingTowerCapability` | 冷却塔能力诊断 |
| `chillerHealthCombination` | 主机健康与组合样本诊断 |

## 140 站点当前完善程度

| 诊断项 | 当前可做程度 | 主要缺口 |
| --- | --- | --- |
| 仪表数据可信度 | 中高 | 已接入 24h 趋势偏移复核和稳态窗口筛选；下一步需要校准记录和传感器安装位置确认 |
| 冷冻水水力平衡 | 中+ | 已接入低温差持续性趋势判断、水力风险指示和现场复核对象；缺支路历史趋势、末端阀位、末端压差、室温趋势 |
| 控制震荡/频繁启停 | 中低到中 | 已接入小时级温差锯齿波、总功率 hunting、频率命令/反馈缺口和启停事件缺口；缺高频命令/反馈、PID 参数、精确启停事件 |
| 低温差根因 | 中+ | 已接入趋势联动根因排序和 140 `B25_AI_*` 泵频 shadow 映射模板；真实降泵仍需要现场末端阀位/室温/压差数据闭合 |
| 冷却塔能力 | 中+ | 已内置 140 保守最低冷凝器进水温和 `冷却回水手动值` shadow 映射；当前 live readiness 已达到 `GO_SHADOW`，30℃边界会拆成多步 shadow | 需确认 PLC 是否采纳手动值、厂家最低温边界、塔阀开到位和长周期趋势 |
| 主机健康与组合样本 | 中低到中 | 组合样本仍需持续积累；多机不拆单机 COP |

## 数据资源与诊断可行性矩阵 V1

新增字段：`operationalDiagnosticsAdvisor.summary.diagnosticReadinessMatrix`。

当前矩阵包含 10 项：

| key | 档位 | 当前口径 |
| --- | --- | --- |
| `instrumentDataQuality` | A | 可做 V1：实时闭合校验、24h 稳态窗口偏移复核 |
| `chilledHydraulicBalance` | A/B | 可做 V1：站级低温差持续性、支路实时离散度、旁通风险、现场复核对象 |
| `lowDeltaTRootCause` | A/B | 可做 V1：根因排序和泵频 shadow 前置证据 |
| `coolingTowerCapability` | A | 可做 V1：Approach、塔风机/塔流量一致性 |
| `chillerCombinationOptimization` | A/B | 样本足够时可做 V1；样本不足时只能方向性审阅 |
| `chillerHealthDegradation` | B | 只能疑似判断：同组合/同负荷 COP 漂移和功率偏高线索 |
| `pumpEfficiency` | B/C | 只能疑似判断：频率/功率/压差异常；不能算效率百分比 |
| `valveStiction` | B/C | 只能疑似判断：阀位长期饱和和命令/反馈缺口 |
| `controlOscillation` | B | 只能疑似判断：趋势波动和启停风险 |
| `terminalComfortProtection` | C | 暂不能做：缺末端阀位、末端压差、代表房间温度和投诉/工单联动 |

页面展示原则：

- 显示“可做 V1 / 只能疑似判断 / 暂不能做”。
- 对 B/C 档必须展示缺口和边界。
- 不判定设备故障，不写 PLC，不承诺真实节能。

## 现场复核清单 V1

新增字段：`operationalDiagnosticsAdvisor.summary.fieldVerificationChecklist`。

当前清单包含 7 项：

| key | 优先级 | 任务 | 只读边界 |
| --- | --- | --- | --- |
| `sensor-calibration-installation-ledger` | P0 | 补传感器校准与安装位置台账 | 只提高仪表诊断置信度，不自动修正测点 |
| `terminal-safety-signal-closure` | P0 | 闭合末端安全信号 | 未闭合前泵频建议只能 shadow/审阅 |
| `plc-pump-protection-mapping` | P0 | 确认 PLC 泵频保护与回退点 | 未完成前不允许 assisted/enforced |
| `chiller-combination-sampling-plan` | P0 | 制定主机组合样本采集计划 | 只评价组合，不拆单台 COP，不自动启停 |
| `branch-hydraulic-history-window` | P1 | 补支路水力历史趋势 | 不把实时支路差异外推为全天失衡 |
| `control-command-feedback-event-window` | P1 | 补控制命令/反馈与启停事件台账 | 不自动改 PID，不自动启停设备 |
| `tower-field-inspection-ledger` | P1 | 补冷却塔现场巡检和长周期分摊 | 不突破厂家/PLC 最低水温保护 |

页面展示为“现场复核清单”，与诊断矩阵同卡片展示。该清单的作用是把甲方/现场下一步工作明确化：补哪些点位、要哪些资料、验收口径是什么。它不是控制策略，不创建执行单，不改变任何设备状态。

2026-06-12 23:30 运行态复验证据：

- BFF：`http://127.0.0.1:8799/bff/v1/sites/140/optimize` 已返回 `diagnosticReadinessMatrix`。
- 前端：`http://127.0.0.1:3001/optimize-demo?siteId=140` 登录态页面已显示 `4 可做 / 5 疑似 / 1 补点`。
- 页面已显示 A/A-B/B/C 档位、`不判定设备故障`、`不写 PLC` 和 `真实 PLC 下发锁定`。
- 未点击批准、写入、dispatch 或回退按钮。
- 截图：`output/playwright/optimize-demo-140-diagnostic-readiness-matrix.png`。

2026-06-12 23:35 自动化 gate：

- 新增命令：`BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-readiness`。
- 结果：`DIAGNOSTIC_READINESS_READY`。
- 报告：`docs/optimize-demo-diagnostic-readiness-latest.md` / `docs/optimize-demo-diagnostic-readiness-latest.json`。
- 该 gate 已纳入 `check:optimize-demo-140-shadow-suite` 组件结论；只读取 `/optimize` 响应，不创建、审批、dispatch 或 rollback 执行单。

2026-06-13 现场复核交付包：

- 新增命令：`BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-field-verification-package`。
- 结果：`FIELD_VERIFICATION_PACKAGE_READY`。
- 输出：`docs/optimize-demo-140-field-verification-package-latest.json`、`docs/optimize-demo-140-field-verification-package-latest.md`、`docs/optimize-demo-140-field-verification-package-latest.html`。
- 控制震荡台账模板：`docs/optimize-demo-140-control-command-feedback-template-latest.csv`、`docs/optimize-demo-140-start-stop-event-template-latest.csv`、`docs/optimize-demo-140-control-parameter-template-latest.csv`。
- 控制震荡台账导入：`npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers`，输出 `docs/optimize-demo-140-control-ledger-import-latest.json`、`docs/optimize-demo-140-control-ledger-import-latest.md` 和 3 份规范化 CSV。
- Advisor 接入：`controlOscillation.current.ledgerEvidence` 展示导入状态、输入模式、接受行数、表级状态和只读边界；`READY` 只代表现场证据窗口可复核，不代表自动调参或启停。
- 现场 CSV 预检接入：`controlOscillation.current.ledgerEvidence.preflight` 展示 `FIELD_DATA_PREFLIGHT_*` 状态；页面显示“现场CSV预检”。预检 READY 只代表可以正式导入，不提升当前诊断证据。
- 传感器台账预检接入：`instrumentDataQuality.current.sensorLedgerEvidence` 展示 `SENSOR_LEDGER_PREFLIGHT_*` 状态；页面显示“传感器台账”。当前未投放 `sensor-calibration-installation.csv` 时为 `waiting`，只提示补资料，不影响只读诊断入口。
- 现场采集包 readiness：`npm --prefix apps/chiller-bff run check:optimize-demo-140-field-collection-package` 输出 `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT`；该 gate 只检查采集包说明、模板、正式输入位置和边界，不把模板当现场证据。
- 传感器台账 READY 路径自检：`npm --prefix apps/chiller-bff run check:optimize-demo-140-sensor-ledger-ready-smoke`，输出 `docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.md/json`；该自检使用 `tmp/` 样例台账，不覆盖正式 latest，不作为现场实测证据。
- READY 路径自检：`npm --prefix apps/chiller-bff run check:optimize-demo-140-control-ledger-import`，输出 `docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.md/json`；该自检不覆盖默认 latest，不作为现场实测证据。
- 内容：4 个 P0、3 个 P1 现场复核任务，包含责任角色、需补数据、所需证据、验收标准和只读边界。
- 边界：只作为点位/资料补齐和置信度提升交付物，不创建执行单，不审批，不 dispatch，不写真实 PLC；控制台账模板只用于补齐诊断证据，不自动改 PID，不自动启停设备。

2026-06-12 23:50 登录态 UI smoke：

- 新增命令：`APP_BASE_URL=http://127.0.0.1:3001 BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-ui-smoke`。
- 结果：`UI_DIAGNOSTIC_READINESS_READY`。
- 报告：`docs/optimize-demo-diagnostic-ui-smoke-latest.json`。
- 已验证页面真实显示 `数据资源与诊断可行性`、`4 可做 / 5 疑似 / 1 补点`、`可做 V1 / 只能疑似判断 / 暂不能做`、`不判定设备故障`、`不写 PLC` 和 `真实 PLC 下发锁定`。
- 该 smoke 使用 `diagnostic_readiness_only` 模式，`optimizeExecution.skipped=true` 表示跳过提交、批准、dispatch 和回退链路，不产生控制副作用。

## 执行边界

- 前端 `/optimize-demo` 只展示诊断、blockers/warnings 和证据。
- 不新增真实启停、真实泵频写入、真实塔目标写入。
- 所有诊断项均为 `read_only`。
- 140 已内置塔侧和泵侧 shadow 映射模板；`shadow` 只生成审计记录。
- 泵频 Advisor 的 `assisted` 必须同时具备目标点、回退点、末端安全、PLC 本地保护和泵频反馈，否则锁定为不可下发。
- 可作为后续 shadow 验证、点位补齐和现场调试清单的入口。

## 2026-06-12 140/B25 验收证据

本轮确认 BFF、前端构建、140 readiness 和登录态 UI smoke。`/optimize-demo?siteId=140` 已用本地测试 session 进入页面并生成建议；未点击批准、写入或回退按钮。运行诊断 Advisor 相关证据如下：

| 项目 | 结果 |
| --- | --- |
| 点位覆盖 | `1215点 / 184设备` |
| 点位识别 | `站点字典已应用` |
| 运行主机 | `3` |
| 冷却塔组 | `4 / 6组` |
| 塔风机 | `24 / 39台` |
| 支路/塔单元 | `7 / 6` |
| 诊断项 | 仪表、水力、控制震荡、低温差、冷却塔、主机组合样本均已渲染 |
| 塔侧 shadow 审批演示 | 已创建第一步待审单 `opx-140-1781266624535-ju3qeb`，目标 Tcws `28.0℃`，30℃ guardrail；未 approve，未 dispatch |
| 泵侧 shadow 审批演示 | 当前待审单 `opx-140-1781265213665-wso34v`，CHWP `-1Hz` / CWP `0Hz` |
| UI 复验证据 | `output/playwright/optimize-demo-140-shadow-ui-final.png`；审批卡片可见 30℃ guardrail 和 27.5℃/2.9℃回退目标 |
| shadow governance | `GO_SHADOW_PENDING`；最新 tower/pump 均待审、未 dispatch，报告 `docs/optimize-shadow-governance-latest.md` |
| 执行边界 | 代码与 readiness 明确“不计算多机单台 COP，不新增真实 PLC 下发能力” |

通过命令：

```bash
npm --prefix apps/chiller-bff test
npm --prefix apps/chiller-shell-v1 run build
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:b25-tower-approach-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:pump-delta-t-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-shadow-governance
```

结论：140/B25 的运行诊断第一版已具备演示和现场排查入口价值；仪表偏移 V1 已补 24h 历史窗口和稳态窗口筛选，冷冻水水力平衡 V1 已补低温差持续性趋势判断、风险指示和现场复核对象，控制震荡 V1 已补温差锯齿波/总功率 hunting 方向性诊断和高频控制证据缺口，低温差根因 V1 已补趋势联动排序，塔侧/泵侧已补 140 内置 shadow 映射模板。最新 live readiness：泵侧为 `GO_SHADOW_ONLY` 且 assisted 仍 blocked；塔侧已达到 `GO_SHADOW`，30℃ 保守边界会拆成 ≤0.5℃/步的多步 shadow 验证。当前已创建塔侧第一步待审单，仅停留在 `pending_approval`。

# Runtime Live Gap Regression v1

## 1. 结论

本次问题归类为 `live data completeness`，不是 `contract` 问题。

原因：

- `npm run check:contract` 仍然 `PASS`
- OpenAPI 主合同未漂移
- 运行态独立探针可拉到真实响应
- 当前主要症状是“接口可达、结构合法，但关键业务字段缺失或为空”

一句话判断：

- `服务已通，但字段不全`

## 2. 最新 probe 摘要

### 2.1 Contract probe

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:contract
```

结果：`PASS`

摘要：

- `example-ready=false`
- `runtime-ready=unknown`
- `Real-link-ready runtime probe (non-blocking): UNAVAILABLE`
- `check:contract` 当前主结论仍是合同通过，未发现 schema 级破坏

说明：

- 这里的 `runtime-ready=unknown` 是 `check-contract.js` 对 `http://127.0.0.1:8787` 非阻断探针拉取失败，不等于 OpenAPI 或 example 失效。
- 因此它只能说明“该探针入口当下不可判定”，不能直接推导为“合同错误”。

### 2.2 Live probe

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
node scripts/probe.js 126lnoffice
```

结果：`PASS`

说明：

- 独立运行态探针已成功返回 `overview / anomalies / recommendations`
- 这说明 BFF 聚合链路和上游旧接口当前是可访问的
- 现阶段主要问题已从“连不上”转为“返回里缺关键业务字段”

## 3. 三个接口摘要

### 3.1 overview

当前摘要：

- `sourceStatus.overall=ok`
- `energy/devices/alarms` 均返回成功
- 但 `energyCards.currentCop / chilledDeltaT / coolingDeltaT / totalElectricityKwh / savingPotentialPct` 为 `null`

关键证据：

- `sourceStatus.sources[0].key=energy`
- `status=200`
- `message=OK; coreMetricsMissing=chilled_delta_t_c,cooling_delta_t_c,station_cop; fallback=...rows=0`

判定：

- `overview` 不是接口不可达
- 是上游能返回数据，但核心指标没有取全

### 3.2 anomalies

当前摘要：

- `sourceStatus.overall=ok`
- `subsystemSummary / latestAlarmLog` 均为 `ok=true`
- 当前未见合同层阻塞，也未见字段缺失导致不可渲染

关键证据：

- `counts.total=3`
- `latestEvents` 有数据
- `diagnosisFlags.staleAlarmFeed=true` 是业务观测结果，不是合同失败

判定：

- `anomalies` 当前是已通且可用
- 它在这次回归里主要作为“运行态确实通了”的对照项

### 3.3 recommendations

当前摘要：

- `sourceStatus.overall=partial`
- `rules / dashboardOverview / anomalySummary / ruleMetrics` 已连通
- 但 `metric.chilled_delta_t_c / metric.cooling_delta_t_c / metric.station_cop` 均为 `ok=false, status=200`

关键证据：

- `metric.chilled_delta_t_c.message=field_missing_or_invalid: ...`
- `metric.cooling_delta_t_c.message=field_missing_or_invalid: ...`
- `metric.station_cop.message=field_missing_or_invalid: ...`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category=field_missing_or_invalid`

判定：

- `recommendations` 当前最典型地体现了“服务已通，但字段不全”
- 规则未命中不是因为合同坏了，而是因为运行态缺少冷冻水温差、冷却水温差、冷站 COP 等关键度量

## 4. `upstream_unreachable -> field_missing_or_invalid` 变化说明

这次需要明确区分两类状态：

### 4.1 `upstream_unreachable`

含义：

- 请求没打通，或者探针入口本身不可达
- 常见表现是 `status=null`，或 runtime probe 直接 `fetch failed`

这次体现位置：

- `check:contract` 的 non-blocking runtime probe 仍显示 `runtime-ready=unknown`
- 这是探针入口不可判定，不是字段口径本身缺失

### 4.2 `field_missing_or_invalid`

含义：

- 请求已经成功返回
- 但业务需要的关键字段不存在、为空，或无法映射出目标指标

这次体现位置：

- `recommendations.sourceStatus.sources[*]` 中多个 `metric.*` 项为 `status=200` 但 `ok=false`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category=field_missing_or_invalid`
- `overview.energy` 也给出了 `coreMetricsMissing=...` 的明确提示

### 4.3 本次回归的核心变化

从排障角度看，本次重点不是继续盯 `upstream_unreachable`，而是识别：

- 上游/BFF 已经打通
- 返回结构也符合合同
- 但 live 数据仍不满足业务完整性要求

所以当前主问题已转为：

- `运行态数据完整性不足`

而不是：

- `合同结构错误`
- `OpenAPI 漂移`
- `BFF 完全不可达`

## 5. 与主合同边界

- `check:contract` 结果：`PASS`
- 影响 OpenAPI 主 schema：`No`
- 是否属于合同阻塞：`No`

说明：

- 这次回归记录的是“live data completeness gap”
- 合同层已经允许前端通过 `key / ok / status / category` 稳定区分
  - 不可达
  - 5xx
  - 字段缺失
- 因此前端和 BFF 合同无需回退；应优先推进上游字段补齐或 fallback 能力补齐

## 6. 建议主控下一步

优先级建议：

1. 先对 `recommendations` 补齐 `chilled_delta_t_c / cooling_delta_t_c / station_cop`
2. 再处理 `overview.energyCards` 中的 `currentCop / chilledDeltaT / coolingDeltaT`
3. 保持 `check:contract` 作为结构门禁不变，把“字段完整性”作为运行态专项跟踪

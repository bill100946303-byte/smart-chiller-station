# Sprint1 趋势分析页 / 告警页数据 Ready 清单 v1

## 1. 目标与边界
- 目标：针对 `趋势分析页` 和 `告警页`，把 Sprint1 可直接开工的字段、需要降级占位的字段、以及当前不能开的字段拆开。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/page-migration-data-readiness-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.json`
  - `apps/chiller-shell-v1/src/pages/DashboardPage.tsx`
  - `apps/chiller-shell-v1/src/components/dashboard/TrendPanel.tsx`
- 边界：只判断字段 ready，不改字段定义，不改 `null_strategy`，不新增业务字段。

## 2. 总结论

| 页面 | 当前结论 | 能先开工的部分 | 不能直接完工的部分 | Sprint1 建议 |
| --- | --- | --- | --- | --- |
| 告警页 | `可开工` | 告警等级计数、最近告警流、严重度标签 | 状态流转筛选、进行中/已恢复视图 | 先做 |
| 趋势分析页 | `可部分开工` | 最新值卡片、指标切换、空态/降级态、图表骨架 | 稳定真曲线、连续点校验后的多序列图 | 第二顺位 |

## 3. 状态统计
- `ready`：`6`
- `partial`：`6`
- `missing`：`1`

## 4. 趋势分析页

### 4.1 字段清单

| 字段 | 展示名 | 当前来源 | 状态 | 是否阻断首版 | 可否先降级占位 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `station_total_power_kw` | 冷站总功率 | `/dashboard/overview.energyCards.totalPowerKw` + `/dashboard/trends.stats[metric=totalPowerKw]` | `ready` | 否 | 否 | `overview` 已 live 返回 `0.3`；首版可先做最新值卡片。 |
| `chilled_delta_t_c` | 冷冻水温差 | `/dashboard/overview.energyCards.chilledDeltaT` + `/dashboard/trends.stats[metric=chilledDeltaT]` | `ready` | 否 | 否 | `runtime-enhanced` 已确认 `null -> 0.2`。 |
| `cooling_delta_t_c` | 冷却水温差 | `/dashboard/overview.energyCards.coolingDeltaT` + `/dashboard/trends.stats[metric=coolingDeltaT]` | `ready` | 否 | 否 | `runtime-enhanced` 已确认 `null -> 0.4`。 |
| `station_cop` | 冷站COP | `/dashboard/overview.energyCards.currentCop` + `/dashboard/trends.stats[metric=currentCop]` | `partial` | 否 | 是 | 值已恢复，但当前 `currentCop=0` 仍需语义复核；首版建议支持 `--/待校验` 占位。 |
| `trend_ts` | 趋势时间点 | `/dashboard/trends.series[].points[].t` | `partial` | 是 | 是 | `TrendPanel` 真曲线必须依赖时间轴；本轮 runtime 未稳定复证，可先做空态/降级态。 |
| `trend_value` | 趋势点值 | `/dashboard/trends.series[].points[].v` | `partial` | 是 | 是 | `TrendPanel` 要求至少 3 个连续有效点；当前应先支持 `noSeries/continuityHint`。 |

### 4.2 首版阻断字段
- `trend_ts`
- `trend_value`

阻断原因：
- 对“趋势分析页”而言，真实图表不是装饰字段，而是核心承载。
- `TrendPanel` 依赖 `series[].points[].t/v`，且至少需要 3 个连续有效点，当前只具备样例与结构证据，缺一次稳定 runtime 复证。

### 4.3 可先降级占位的字段
- `station_cop`
  - 建议先显示 `--` 或“待校验”，不要把 `0` 直接业务化成稳定结论。
- `trend_ts`
  - 接口 unavailable 时直接走 `degradedHint + noSeries`。
- `trend_value`
  - 无连续点时显示 continuity hint，不强行画线。

### 4.4 Sprint1 可直接开工范围
- 最新值卡片：
  - `station_total_power_kw`
  - `chilled_delta_t_c`
  - `cooling_delta_t_c`
  - `station_cop`（带占位文案）
- 趋势区骨架：
  - 指标切换
  - 图例
  - 空态/降级态/陈旧态
- 图表真数据联调：
  - 等 `dashboard/trends` 做连续两轮 runtime 可达后再收口

## 5. 告警页

### 5.1 字段清单

| 字段 | 展示名 | 当前来源 | 状态 | 是否阻断首版 | 可否先降级占位 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `alarm_critical_count` | 紧急告警数 | `/dashboard/overview.alarmSummary.high` | `ready` | 否 | 否 | live `overview` 已返回 `high=3`。 |
| `alarm_major_count` | 严重告警数 | `/dashboard/overview.alarmSummary.medium` | `ready` | 否 | 否 | 字段语义和展示名已对齐。 |
| `alarm_minor_count` | 一般告警数 | `/dashboard/overview.alarmSummary.low` | `ready` | 否 | 否 | 首版可直接做分级计数卡。 |
| `anomaly_severity` | 异常等级 | `/anomalies/summary.latestEvents[].severity` | `partial` | 否 | 是 | 结构已定义，但本轮 live 未稳定复证；可先保留 severity badge 位置。 |
| `latest_alarm_time` | 最近告警时间 | `/anomalies/summary.latestEvents[].occurredAt` | `partial` | 否 | 是 | 首版可在缺值时显示 `--`。 |
| `alarm_data_stale` | 告警数据陈旧 | `/anomalies/summary.diagnosisFlags.staleAlarmFeed`（语义近似） | `partial` | 否 | 是 | 当前更像诊断旗标而非正式业务字段；建议先只用于页面提示。 |
| `anomaly_state` | 异常状态 | `/anomalies/summary.latestEvents[].state`（当前未暴露） | `missing` | 是 | 是 | `field-dictionary` 已定义，但当前 DTO 未返回；会阻断“进行中/已恢复”筛选。 |

### 5.2 首版阻断字段
- `anomaly_state`

阻断原因：
- 如果告警页 Sprint1 目标包含“进行中 / 已恢复”标签、筛选或状态分组，当前没有可消费字段。
- 如果 Sprint1 只做“分级计数 + 最近告警流”，则可以绕开这个阻断项先落首版。

### 5.3 可先降级占位的字段
- `anomaly_severity`
  - 若列表接口暂时不稳，可先保留 severity badge 位置，缺值时回退为默认样式。
- `latest_alarm_time`
  - 缺值时显示 `--`，不要伪造“刚刚发生”。
- `alarm_data_stale`
  - 先作为页面顶部提示文案，不直接做业务结论。
- `anomaly_state`
  - 首版直接隐藏状态筛选和状态徽标，后续补齐字段再放开。

### 5.4 Sprint1 可直接开工范围
- 告警计数卡：
  - `alarm_critical_count`
  - `alarm_major_count`
  - `alarm_minor_count`
- 最近告警流：
  - `title`
  - `occurredAt`
  - `source`
  - `severity`（允许降级）
- 顶部提示：
  - `alarm_data_stale` 对应的“数据陈旧”文案占位

## 6. 首版阻断与降级汇总

| 页面 | 首版阻断字段 | 可降级占位字段 |
| --- | --- | --- |
| 趋势分析页 | `trend_ts`、`trend_value` | `station_cop`、`trend_ts`、`trend_value` |
| 告警页 | `anomaly_state`（仅当要做状态流转视图时） | `anomaly_severity`、`latest_alarm_time`、`alarm_data_stale`、`anomaly_state` |

## 7. Sprint1 建议顺序
1. 先做 `告警页`
   - 现成 ready 字段更多，首版可以规避 `anomaly_state`。
2. 再做 `趋势分析页`
   - 先开工卡片、图表骨架、空态/降级态。
   - 真曲线联调放到 `dashboard/trends` 连续两轮 runtime 可达之后。

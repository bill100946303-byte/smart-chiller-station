# 旧页面迁移数据 Readiness v1

## 1. 目标与边界
- 目标：为旧页面迁移提供字段依赖与数据可用性判断，明确哪些页面已经具备迁移条件，哪些仍需先补字段或结构。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-dictionary.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ops-unified-field-map-v1.md`
  - `apps/chiller-shell-v1/src/services/bffClient.ts`
  - `apps/chiller-bff/src/services/topologyService.js`
  - `apps/chiller-bff/openapi/examples/dashboard-trends.json`
  - `apps/chiller-bff/openapi/examples/system-topology.json`
- 边界：仅判断字段与数据 readiness，不改字段定义，不改 `null_strategy`，不评价 UI 视觉。

## 2. 页面级结论

| 页面 | 当前主来源 | 结论 | 判断依据 | 主要 blocker |
| --- | --- | --- | --- | --- |
| 告警页 | `/bff/v1/sites/{siteId}/anomalies/summary` + `/dashboard/overview.alarmSummary` | `partial` | 告警计数、最近事件、严重度语义已建模；`overview` 在 `2026-03-12T21:52:05Z` live 返回 `alarmSummary.total=3/high=3`。 | `anomaly_state` 尚未进入当前 `AnomalySummaryDto`；若旧页依赖“进行中/已恢复”视图，仍需补字段。 |
| 设备总览页 | `/bff/v1/sites/{siteId}/dashboard/overview.deviceSummary` + legacy `drinfo/reg/qstag` | `partial` | 设备总数和四类设备摘要计数已可取；`overview.deviceSummary` live 返回 `59/3/3/3/4`。 | `running_device_count`、`alarm_device_count`、设备明细状态和点位明细尚未统一成单一 BFF 合同。 |
| 趋势分析页 | `/bff/v1/sites/{siteId}/dashboard/trends` + `/dashboard/overview.energyCards` | `partial` | `station_total_power_kw`、`station_cop`、`chilled_delta_t_c`、`cooling_delta_t_c` 已在 `runtime-enhanced-field-delta-v1` 中完成恢复；趋势 DTO 与样例已存在。 | 本轮 live 复取时 `8787` 抖动，趋势接口未稳定复证；`station_cop=0` 仍需继续观察语义。 |
| 2D/3D 场景控制页 | `/bff/v1/sites/{siteId}/topology` + `drinfo.model2dDataId` | `no` | 当前仅有 `summary/groups/nodes/downstream` 的弱拓扑；`system-topology` 样例仍是 `groups=[]`、`sourceStatus.failed`。 | 没有显式 `edges[]`/回路边关系表，`model2dDataId` 绑定不完整，控制点未形成统一 contract。 |

## 3. Ready 统计
- `ready`：`0`
- `partial`：`3`
- `no`：`1`

## 4. 建议先迁的 2 页
1. `告警页`
   - 原因：计数、最近事件、严重度已经有稳定字段语义，距离可迁只差 `anomaly_state` 一类状态补齐。
2. `趋势分析页`
   - 原因：core4 指标的字段定义、展示层命名、runtime 恢复证据都已存在，主要风险是运行态稳定性而不是字段没定义。

说明：
- `设备总览页` 虽然摘要计数成熟，但页面一旦要承接设备卡片、设备状态或点位钻取，就会立刻跨到未统一的设备明细合同，因此排在第三顺位。
- `2D/3D 场景控制页` 当前不建议迁移，优先级应放在补拓扑边与模型绑定。

## 5. 页面拆解

### 5.1 告警页
可直接复用的字段：
- `alarm_critical_count`
- `alarm_major_count`
- `alarm_minor_count`
- `latest_alarm_time`
- `anomaly_severity`

当前 blocker：
- `anomaly_state`
  - `field-dictionary` 已定义，但当前 `AnomalySummaryDto.latestEvents[]` 没有暴露。
  - 若旧页要求区分“进行中/已恢复”，需要补到 BFF summary 合同或单独告警列表合同。

迁移判断：
- 首版只做“当前告警数 + 最近告警流 + 严重度筛选”，可迁。
- 若要完整替代旧告警页状态流转能力，当前仍是 `partial`。

### 5.2 设备总览页
可直接复用的字段：
- `total_devices`
- `deviceSummary.chillerCount`
- `deviceSummary.chilledPumpCount`
- `deviceSummary.coolingPumpCount`
- `deviceSummary.coolingTowerCount`

当前 blocker：
- `running_device_count`
- `alarm_device_count`
- 设备明细状态字段未统一到单一 BFF 返回
- 设备点位和 2D 绑定未形成稳定钻取路径

迁移判断：
- 只迁“设备摘要版”可以做。
- 只要目标包含“设备清单 + 运行态 + 告警态 + 点位详情”，当前仍不足以整页替换旧页。

### 5.3 趋势分析页
可直接复用的字段：
- `station_total_power_kw`
- `station_cop`
- `chilled_delta_t_c`
- `cooling_delta_t_c`
- `trend_ts`
- `trend_value`

当前 blocker：
- `dashboard/trends` 本轮 live 复取未成功，当前只能引用样例与既有恢复文档，尚缺一次稳定 runtime 复证。
- `station_cop` 已恢复为可消费值，但 `currentCop=0` 仍需继续做语义复核。

迁移判断：
- 从字段与口径层看，已经足够支持趋势页首版迁移。
- 从运行态治理看，应把“接口抖动”和“COP 零值语义”作为迁移前检查项。

### 5.4 2D/3D 场景控制页
当前已有：
- `summary`
- `groups`
- `nodes[].id/label/count/downstream`
- `drinfo.model2dDataId`

当前 blocker：
- 无显式 `edges[]`
- 当前 `downstream` 是固定链式关系，不是可维护的真实工艺边
- `groups[]` 与设备绑定信息过弱
- 控制点虽然在 `reg + qstag` 中存在，但没有形成面向场景控制的统一输出

迁移判断：
- 当前只能支撑“示意型拓扑摘要”，不足以承接旧 2D/3D 场景控制页。

## 6. Blocker 字段汇总

| 页面 | blocker 字段/路径 | 问题类型 | 建议 owner |
| --- | --- | --- | --- |
| 告警页 | `anomaly_state` | BFF 合同缺字段 | `bff` |
| 设备总览页 | `running_device_count` | 规则聚合字段未落到 overview/device contract | `bff` |
| 设备总览页 | `alarm_device_count` | 规则聚合字段未落到 overview/device contract | `bff` |
| 设备总览页 | `device detail states/points` | 设备明细合同未统一 | `legacy` + `bff` |
| 趋势分析页 | `trend_ts` / `trend_value` | 当前轮次运行态未稳定复证 | `bff` |
| 趋势分析页 | `station_cop` | 值已恢复但零值语义仍需复核 | `bff` |
| 2D/3D 场景控制页 | `topology.edges[]` | 拓扑边关系缺失 | `legacy` + `bff` |
| 2D/3D 场景控制页 | `drinfo.model2dDataId` | 绑定不完整 | `legacy` |
| 2D/3D 场景控制页 | `control points contract` | 控制点未统一输出 | `legacy` + `bff` |

## 7. 最小迁移顺序建议
1. 先迁 `告警页`
   - 先补 `anomaly_state` 或明确首版不展示恢复态。
2. 再迁 `趋势分析页`
   - 迁移前补一条 runtime 探针，确认 `dashboard/trends` 至少连续两个窗口可达。
3. 第三顺位是 `设备总览页`
   - 先决定目标只做摘要，还是连设备状态清单一起迁。
4. `2D/3D 场景控制页` 暂缓
   - 先补拓扑配置与控制 contract，再谈迁移。

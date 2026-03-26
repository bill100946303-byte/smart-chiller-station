# Sprint1 告警页数据完整包 v1

## 1. 目标与固定范围
- 目标：一次性收敛告警页首版所需的数据准备度，不再拆分“字段”“ready”“增量”多轮。
- 首版页面范围固定为：
  - 顶部摘要计数
  - 最近告警流
  - 告警列表首版
  - `freshness` / `sourceStatus` 提示
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-alarm-data-ready-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-dictionary.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md`
  - `apps/chiller-shell-v1/src/services/bffClient.ts`
  - `apps/chiller-bff/openapi/examples/anomalies-summary.json`
  - `apps/chiller-bff/openapi/examples/real-link-ready-sample.json`
- 边界：只做数据口径和页面可开工判断，不改字段定义，不改 `null_strategy`。

## 2. 总结论
- 告警页首版数据是否可开工：`yes`
- 结论原因：
  - 顶部摘要计数已有稳定字段与展示名映射。
  - 最近告警流和告警列表首版所需的最小合同已经存在：`id/title/severity/occurredAt/source`。
  - `freshness/sourceStatus` 也已有明确 DTO 和样例结构，可支持页面提示条。
- 当前不阻断首版但仍存在的缺口：
  - `anomaly_state` 未进入当前 `AnomalySummaryDto`，因此首版不做“进行中/已恢复”筛选或状态列。
  - `counts.total`、`latestEvents[].title`、`latestEvents[].source` 仍偏 contract-only，尚未完全进入字段字典/展示字典主键体系。
  - `alarm_data_stale` 当前更接近通过 `diagnosisFlags.staleAlarmFeed` + `freshness.stale` 的页面提示语义，而不是独立业务字段直出。

## 3. 状态统计
- `ready`：`3`
- `partial`：`17`
- `missing`：`1`

## 4. 顶部摘要字段清单

| 字段 | 展示名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `counts.total` | 当前告警总数 | `partial` | 合同字段已存在，但还不是字段字典主键；首版可先消费。 |
| `alarm_critical_count` | 紧急告警数 | `ready` | 对应 `counts.high` / `overview.alarmSummary.high`。 |
| `alarm_major_count` | 严重告警数 | `ready` | 对应 `counts.medium` / `overview.alarmSummary.medium`。 |
| `alarm_minor_count` | 一般告警数 | `ready` | 对应 `counts.low` / `overview.alarmSummary.low`。 |
| `latest_alarm_time` | 最近告警时间 | `partial` | 顶部如需展示“最近更新时间/最近触发”，可直接消费；缺值显示 `--`。 |

首版建议：
- 摘要卡直接做 `总数 + critical/major/minor`。
- `counts.total` 优先读合同原值；如果缺失且 `high/medium/low` 三项都存在，再允许前端求和。

## 5. 最近告警字段清单

| 字段 | 展示名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `anomaly_alarm_id` | 告警ID | `partial` | 合同样例存在；若缺失，不要猜业务 ID。 |
| `latestEvents[].title` | 告警标题 | `partial` | 当前是 contract-only 字段；前端可降级为“告警事件”。 |
| `anomaly_occurred_at` | 告警发生时间 | `partial` | 合同样例存在；缺值时显示 `--`。 |
| `anomaly_severity` | 异常等级 | `partial` | 合同样例存在；缺值时隐藏等级徽标或显示未知态。 |
| `latestEvents[].source` | 告警来源 | `partial` | 当前是 contract-only 字段；前端可降级为“未知来源”。 |

首版建议：
- 最近告警流最小展示项固定为：
  - `title`
  - `occurredAt`
  - `source`
  - `severity`
- 不要求 `state`。

## 6. 告警列表最小字段清单

| 字段 | 展示名 | 状态 | 说明 |
| --- | --- | --- | --- |
| `anomaly_alarm_id` | 告警ID | `partial` | 用于列表稳定 key 或后续详情跳转。 |
| `latestEvents[].title` | 告警标题 | `partial` | 缺值时可回退为通用标题。 |
| `anomaly_occurred_at` | 告警发生时间 | `partial` | 缺值只显示 `--`。 |
| `anomaly_severity` | 异常等级 | `partial` | 列表首版可保留等级标签。 |
| `anomaly_state` | 异常状态 | `missing` | 当前 DTO 未暴露；首版直接不做状态列和状态筛选。 |

首版最小列表边界：
- 可以做：
  - 标题
  - 时间
  - 来源
  - 等级
- 不做：
  - “进行中 / 已恢复” 状态列
  - 按状态筛选
  - 基于状态的统计分组

## 7. Freshness / SourceStatus 口径

### 7.1 Freshness
页面建议消费：
- `freshness.latestTimestamp`
- `freshness.stale`
- `freshness.ageHours`

口径说明：
- `latestTimestamp`
  - 代表当前异常聚合中可见的最新事件时间。
- `stale`
  - `true` 时页面应显示“告警数据陈旧”，不能误导为实时。
- `ageHours`
  - 仅用于 tooltip/诊断说明，不建议做主文案核心值。

### 7.2 SourceStatus
页面建议消费：
- `sourceStatus.overall`
- `sourceStatus.sources[key=subsystemSummary]`
- `sourceStatus.sources[key=latestAlarmLog]`

口径说明：
- `overall`
  - 控制页面提示条主色和主文案；`ok/partial/failed` 不可前端猜。
- `subsystemSummary`
  - 表示子系统摘要链路状态，可作为“摘要计数是否可信”的证据。
- `latestAlarmLog`
  - 表示最新告警日志链路状态，可作为“最近告警流/列表是否可信”的证据。
- `alarmSeveritySplit`、`alarmDiagnosis`
  - 若样例中出现，仅作为技术诊断线索，不建议直接业务化展示。

页面提示建议：
- `freshness.stale == true`
  - 展示“告警数据陈旧”。
- `sourceStatus.overall != 'ok'`
  - 展示“部分数据链路异常，请谨慎解读告警列表”。

## 8. Top5 Blockers / 缺口

按当前固定 scope 判断，`blocking=yes` 的硬阻断为 `0`。以下 5 项是最重要的缺口，影响后续增强版：

1. `anomaly_state` 缺失
   - 影响：无法做“进行中 / 已恢复”状态筛选和状态列。
2. `counts.total` 尚未收敛为标准字段主键
   - 影响：总数展示可做，但还不是统一字段字典口径。
3. `latestEvents[].title`
   - 影响：当前是 contract-only 字段，尚未进入统一字段字典。
4. `latestEvents[].source`
   - 影响：当前是 contract-only 字段，尚未进入统一字段字典。
5. `alarm_data_stale` 与当前 DTO 路径未完全一一对应
   - 影响：首版可以提示“陈旧”，但不应把当前路径当成独立业务字段强业务化展示。

补充一条运行态风险：
- 本轮 live 直接探测 `8787 /anomalies/summary` 未连通，因此 latestEvents/freshness/sourceStatus 本次主要依据 DTO 和样例，不算 live 再复证通过。

## 9. 哪些字段可以先 Mock / 降级

可以先 mock 或降级：
- `latestEvents[].title`
  - 可回退为“告警事件”。
- `latestEvents[].source`
  - 可回退为“未知来源”。
- `anomaly_occurred_at` / `latest_alarm_time`
  - 缺值显示 `--`。
- `anomaly_state`
  - 首版直接隐藏状态列、状态筛选。
- `freshness.latestTimestamp`
  - 缺值显示“时间未知”。
- `sourceStatus` 细项
  - 缺少明细时可只保留通用提示条，不强行展开细项。

## 10. 哪些字段绝不能前端猜

绝不能前端猜：
- `alarm_critical_count`
- `alarm_major_count`
- `alarm_minor_count`
- `counts.total`
  - 只有在 `high/medium/low` 三项都存在时才允许求和；否则不可猜。
- `anomaly_severity`
  - 不可根据标题文本猜等级。
- `anomaly_state`
  - 不可根据时间早晚推断“已恢复/进行中”。
- `freshness.stale`
  - 不可默认“HTTP 200 = 新鲜”。
- `sourceStatus.overall`
  - 不可默认“接口通了 = overall ok”。

## 11. 最终判定
- 告警页首版数据是否可开工：`yes`
- 不阻断但当前仍缺的字段：
  - `anomaly_state`
  - `counts.total` 的标准化字段主键
  - `latestEvents[].title` 的字段字典归一
  - `latestEvents[].source` 的字段字典归一
  - `alarm_data_stale` 的正式返回路径统一
- 若后续要升级到“状态筛选 / 状态分组 / 详情跳转稳定 ID / 多条件过滤”，当前要先补：
  - `anomaly_state`
  - 告警列表标准字段字典
  - `anomalies/summary` 的稳定 live 复证

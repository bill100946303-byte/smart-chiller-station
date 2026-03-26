# Sprint1 告警 Severity 最终收口 v1

## 1. 目标与边界
- 目标：把告警页当前最容易造成前后端漂移的 `severity` 口径一次性收口，避免继续双枚举共存。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-list-data-pack-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-dictionary.csv`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.md`
  - `apps/chiller-shell-v1/src/pages/AlarmPage.tsx`
  - `docs/bff-aggregation-design.md`
- 说明：
  - `/Users/billchow/Documents/智慧冷冻站/docs/sprint1-anomalies-severity-mapping-v1.md` 当前不存在，本次直接产出 final 版。
- 边界：只做口径拍板，不改代码，不改字段定义，不改 `null_strategy`。

## 2. 当前证据
1. `field-dictionary.csv` 已把 `anomaly_severity` 定义为：
   - 来源：`qsAlarmlog.alarmLevel + 映射规则`
   - 默认策略：`use_default_minor`
   - 目标枚举：`critical/major/minor/normal`
2. `field-display-dictionary-v1.md` 对 `anomaly_severity` 的展示语义也是：
   - `critical/major/minor`
3. `bff-aggregation-design.md` 已明确：
   - `alarmInfo.name` 归一成 `critical/major/minor/normal`
   - `alarmSummary` 使用 `critical/major/minor/normal`
4. 当前漂移点来自现有样例和前端：
   - `apps/chiller-bff/openapi/examples/anomalies-summary.json` 使用 `high/medium/low`
   - [`AlarmPage.tsx`](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx) 也按 `high/medium/low` 解释并展示

结论：
- 设计基线已经是 `critical/major/minor/normal`
- `high/medium/low` 只是当前壳层样例与页面实现的临时兼容口径

## 3. 最终拍板

### 3.1 BFF 最终统一值
告警 severity 最终统一值固定为：
- `critical`
- `major`
- `minor`
- `normal`

### 3.2 前端展示值
前端展示值建议固定为：

| BFF unified value | zh | en | vi |
| --- | --- | --- | --- |
| `critical` | `紧急` | `Critical` | `Khẩn cấp` |
| `major` | `严重` | `Major` | `Nghiêm trọng` |
| `minor` | `一般` | `Minor` | `Thông thường` |
| `normal` | `正常` | `Normal` | `Bình thường` |

说明：
- 告警页不要复用当前 `zhCN.severity.high/medium/low` 这套风险级标签。
- 告警页的 severity 文案必须单独绑定到告警统一枚举，而不是复用规则风险枚举或当前壳层简化标签。

### 3.3 是否允许 dual enum
- 是否允许 dual enum：`no`

硬规则：
1. 外部合同层不允许同时出现：
   - `critical/major/minor/normal`
   - `high/medium/low`
2. 如果上游原始值是：
   - 中文：`紧急/严重/一般/正常`
   - 临时别名：`high/medium/low`
   - 其他大小写变体
   - 都必须在 BFF 内部先归一，再输出统一枚举
3. 前端不承担双枚举兼容职责
   - 兼容逻辑只允许存在于 BFF adapter / mapper 层

## 4. 旧源所有可能值与最终映射

| 来源层 | 旧源可能值 | BFF 最终统一值 | 前端展示值 | 备注 |
| --- | --- | --- | --- | --- |
| `getAllSubsystemInfo.alarmInfo.name` | `紧急` | `critical` | `紧急` | 旧中文等级 |
| `getAllSubsystemInfo.alarmInfo.name` | `严重` | `major` | `严重` | 旧中文等级 |
| `getAllSubsystemInfo.alarmInfo.name` | `一般` | `minor` | `一般` | 旧中文等级 |
| `getAllSubsystemInfo.alarmInfo.name` | `正常` | `normal` | `正常` | 旧中文等级 |
| `qsAlarmlog.alarmLevel` | `紧急` | `critical` | `紧急` | 按字段字典映射 |
| `qsAlarmlog.alarmLevel` | `严重` | `major` | `严重` | 按字段字典映射 |
| `qsAlarmlog.alarmLevel` | `一般` | `minor` | `一般` | 按字段字典映射 |
| `qsAlarmlog.alarmLevel` | `正常` | `normal` | `正常` | 按字段字典映射 |
| 当前 summary/sample 临时值 | `high` | `critical` | `紧急` | 兼容值，仅允许内部映射 |
| 当前 summary/sample 临时值 | `medium` | `major` | `严重` | 兼容值，仅允许内部映射 |
| 当前 summary/sample 临时值 | `low` | `minor` | `一般` | 兼容值，仅允许内部映射 |
| 缺失/未知 | `null/unknown/空串` | `minor` | `一般` | 跟随 `field-dictionary.csv` 的 `use_default_minor` |

## 5. 缺失时默认行为

缺失时默认行为固定为：
- BFF：
  - 归一后输出 `minor`
  - 原因：`field-dictionary.csv` 已将 `anomaly_severity` 的 `null_strategy` 固定为 `use_default_minor`
- 前端：
  - 不再做第二层 severity 猜测
  - 直接显示 BFF 输出值对应的展示文案

补充边界：
- `severity` 缺失不代表 `state=已恢复`
- `severity` 缺失也不代表 `normal`
- 唯一允许的默认值是 `minor`

## 6. Summary / List / Recent Feed 是否统一
- 是否统一：`yes`

统一规则：
1. `summary`
   - 使用 `critical/major/minor/normal` 四档计数
   - 目标 keys：`counts.critical/counts.major/counts.minor/counts.normal`
2. `anomalies/list`
   - `items[].severity` 使用相同统一枚举
3. `recent feed`
   - `latestEvents[].severity` 使用相同统一枚举

说明：
- 语义统一，不代表每个视图都必须展示四档。
- Sprint1 的 recent feed / list 即使实际只出现 `critical/major/minor`，也不影响统一口径。
- `normal` 仍属于合法统一值，主要用于 summary 统计或后续历史列表。

## 7. 对当前实现的处理建议

当前需要一起收的点：
1. `AnomalySummaryDto.latestEvents[].severity`
   - 从 `"high" | "medium" | "low"` 收口为 `"critical" | "major" | "minor" | "normal"`
2. `AnomalySummaryDto.counts`
   - 从 `high/medium/low` 收口为 `critical/major/minor/normal`
3. [`AlarmPage.tsx`](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx)
   - 当前 `severityText/severityTone` 与 summary cards 都按 `high/medium/low` 写死，需要改成统一枚举
4. 告警页列表表头
   - 当前使用“状态”列承载 severity，后续应改成“等级”或“严重度”

## 8. 最终拍板
- 是否允许 dual enum：`no`
- Sprint1 首版是否统一使用 `high|medium|low`：`no`

最终结论：
- Sprint1 首版应统一使用 `critical|major|minor|normal`
- `high|medium|low` 只允许作为 BFF 内部过渡映射输入，不允许继续作为对外合同输出

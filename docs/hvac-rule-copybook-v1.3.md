# HVAC 规则文案 v1.3（30秒可执行）

目标：在 v1.2 基础上，补“调度员 30 秒可执行”短文案，不改阈值与规则逻辑。  
范围：文案层与 UI 消费结构；兼容 v1.2 既有键。

版本信息：
- copybookVersion: `1.3.0`
- basedOn: `hvac-rule-copybook-v1.2@1.2.0`
- ruleSetRef: `hvac-rules-v1@1.0.1`

## 1) 规则三语短句（shortTitle/shortReason/shortAction）

约束：
- 短句优先，面向 30 秒执行。
- 高风险条目必须含“操作边界”提示（见第 3 节检查结果）。

| ruleId | zh | en | vi |
| --- | --- | --- | --- |
| `low-delta-t-chilled-loop` | `冷冻低温差` / `温差低且有负荷` / `查旁通并微调供水` | `Low Delta-T` / `Delta-T low under load` / `Check bypass, tune CHWS` | `Delta-T thap` / `Delta-T thap khi tai cao` / `Kiem tra bypass, chinh nuoc cap` |
| `pump-frequency-too-high` | `泵频高低效` / `高频但换热增益小` / `每次降2Hz并看压差` | `Pump Hz High` / `High Hz, weak transfer` / `Drop 2Hz, watch dP` | `Tan so bom cao` / `Hz cao, truyen nhiet yeu` / `Giam 2Hz, theo doi dP` |
| `cooling-side-low-efficiency` | `冷却侧低效` / `散热弱且COP低` / `调塔风机并查冷凝器` | `Cooling Low Eff.` / `Weak rejection, low COP` / `Tune fans, check condenser` | `Giai nhiet kem` / `Thai nhiet yeu, COP thap` / `Chinh quat, kiem tra ngung` |
| `frequent-start-stop` | `频繁启停` / `短时启停次数过多` / `锁最小启停，禁手动连启停` | `Frequent Cycling` / `Too many starts/stops` / `Set lockout, no force cycle` | `Dong cat nhieu` / `So lan dong/cat qua day` / `Bat lockout, cam dong/cat tay` |
| `stale-data-detection` | `数据不新鲜` / `关键数据滞后或缺失` / `先恢复链路，单次调参<=0.5C` | `Stale Data` / `Key data delayed/missing` / `Restore feed first, step <=0.5C` | `Du lieu cu` / `Du lieu quan trong tre/thieu` / `Khoi phuc du lieu, buoc <=0.5C` |

## 2) stale 与 station_cop 缺失统一话术

统一字段：
- `shortTitle`
- `shortReason`
- `shortAction`
- `triggerFields`（字段级条件）

### staleMode

- `stale_only`：数据陈旧但无缺指标
- `stale_with_missing`：数据陈旧且有缺指标
- `stale_recovered`：陈旧解除，恢复常规

### stationCopMode

- `cop_missing_lt_30m`：仅 COP 短时缺失
- `cop_missing_ge_30m`：仅 COP 持续缺失
- `cop_recovered_30_120m`：恢复后观察期

> 统一原则：先链路、后调参；恢复后先观察，再放开高风险动作。

## 3) 高风险“操作边界”约束检查结果

检查规则：
- 风险 `high` 的短文案必须含边界约束（如“禁手动连启停”“单次调参<=0.5C”“需复核/二次确认”）。

检查结果（v1.3）：

| 检查项 | 风险 | 边界语句 | 结果 |
| --- | --- | --- | --- |
| `frequent-start-stop.shortAction` | high | `禁手动连启停` / `no force cycle` | 通过 |
| `stale-data-detection.shortAction` | high | `单次调参<=0.5C` / `step <=0.5C` | 通过 |
| `staleMode.stale_with_missing.shortAction` | high | `恢复链路后再调参` | 通过 |
| `stationCopMode.cop_missing_ge_30m.shortAction` | high | `先补数后回放，未恢复不下结论` | 通过 |

结论：高风险短文案均包含可执行边界信息。

## 4) UI 可消费与兼容

兼容策略：
- 保留 v1.2 原键：`ruleCopy.<ruleId>.shortText.*`（zh）不变。
- 新增键：
  - `ruleCopy.<ruleId>.shortTextI18n.{zh,en,vi}.{shortTitle,shortReason,shortAction}`
  - `skippedPlaybook.<category>.shortCopyI18n.{zh,en,vi}.{main,detail,action}`
  - `operationalModes.staleMode.*`
  - `operationalModes.stationCopMode.*`
  - `riskBoundaryCheck`
  - `diffFromV1_2`

## 5) diffFromV1_2

新增：
1. 每条规则三语 30 秒执行短句（`shortTextI18n`）。
2. skipped 分类三语短句（`shortCopyI18n`）。
3. stale 与 station_cop 缺失统一场景话术（同一字段结构）。
4. 高风险“操作边界”检查结果对象（`riskBoundaryCheck`）。

调整：
1. 高频动作文案压缩为“先看-先做”导向，减少长句描述。
2. 高风险短动作明确加入边界约束短语。

不变：
1. ruleId/阈值/evaluator 与判定逻辑不变。
2. v1.2 原有短句键保持可读可用。

## 6) 回滚点

- 当前：`hvac-rule-copybook-v1.3@1.3.0`
- 回滚目标：`hvac-rule-copybook-v1.2@1.2.0`
- 回滚方式：前端词典切回 `hvac-rule-copybook-v1.2.json`，不影响规则引擎判定。

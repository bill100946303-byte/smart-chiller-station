# HVAC 规则诊断短句文案 v1.2（移动端优先）

适用范围：
- 规则文件：`docs/hvac-rules-v1.yaml`（规则逻辑与阈值不变）
- 落点：来源状态条展开态、规则诊断区（Recommendation + RuleSkip）
- 目标：短句优先，降低移动端阅读负担

版本信息：
- copybookVersion: `1.2.0`
- basedOn: `hvac-rule-copybook-v1.1@1.1.0`
- ruleSetRef: `hvac-rules-v1@1.0.1`

## 1) 每条规则短文案三件套

说明：
- `shortTitle` <= 8 字
- `shortReason` <= 18 字
- `shortAction` <= 18 字

| ruleId | shortTitle | shortReason | shortAction |
| --- | --- | --- | --- |
| `low-delta-t-chilled-loop` | 冷冻低温差 | 温差低且负荷不低 | 查旁通并微调供水 |
| `pump-frequency-too-high` | 泵频高低效 | 泵频高但换热提升小 | 每次降2Hz并看压差 |
| `cooling-side-low-efficiency` | 冷却侧低效 | 散热弱且COP偏低 | 调塔风机并查冷凝器 |
| `frequent-start-stop` | 频繁启停 | 短时启停次数过多 | 启用最小启停锁定 |
| `stale-data-detection` | 数据不新鲜 | 关键数据滞后或缺失 | 先恢复链路再调参 |

## 2) Skipped Category 短文案

说明：
- 主提示 <= 12 字
- 详情提示 <= 24 字
- 操作提示 <= 24 字

### `upstream_unreachable`
- 主提示：`上游不可达`
- 详情提示：`未取到上游数据，规则已跳过`
- 操作提示：`按服务→网络→端口顺序排障`

### `field_missing_or_invalid`
- 主提示：`字段异常`
- 详情提示：`关键字段缺失或值无效，已跳过`
- 操作提示：`先查映射，再核单位与采样`

### `unknown`
- 主提示：`状态未识别`
- 详情提示：`未匹配词典模板，已降级展示`
- 操作提示：`按版本→词典→合同顺序核查`

## 3) 风险语气约束（v1.2）

保留规则：
- 高风险文案必须保留：`优先级：P1` + `操作边界`。

语气限制：
- 中低风险文案避免泛化“紧急”措辞。
- 中低风险统一用“建议/请核查/纳入巡检”等中性表达。

## 4) 回滚与兼容

兼容策略：
- `v1.1` 原有键全部保留，前端旧逻辑可直接继续使用。
- `v1.2` 仅新增短句键，不覆盖原字段。

新增键（不破坏）：
- `ruleCopy.<ruleId>.shortText.shortTitle`
- `ruleCopy.<ruleId>.shortText.shortReason`
- `ruleCopy.<ruleId>.shortText.shortAction`
- `skippedPlaybook.<category>.shortCopy.main`
- `skippedPlaybook.<category>.shortCopy.detail`
- `skippedPlaybook.<category>.shortCopy.action`
- `compatibility.addedKeys`
- `diffFromV1_1`

回滚点：
- 当前：`hvac-rule-copybook-v1.2@1.2.0`
- 回滚目标：`hvac-rule-copybook-v1.1@1.1.0`
- 回滚方式：前端切回 `v1.1` 词典即可。

## 5) diffFromV1_1

新增：
- 每条规则增加短文案三件套（标题/原因/动作）。
- 每个 skipped 分类增加短文案三件套（主提示/详情/操作）。
- 增加短句长度约束，便于移动端展开态展示。

调整：
- 文案策略从“执行检查单优先”扩展为“短句优先 + 展开看明细”。

未变更：
- 规则阈值与判定逻辑不变。
- recommendations 合同结构不变。
- v1.1 全量键保持兼容。

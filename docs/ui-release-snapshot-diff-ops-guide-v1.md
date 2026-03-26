# 发布快照前后变化读法 v1

适用对象：值班群、运营同学。  
用途：对比“本次快照 vs 上次快照”，快速判断风险是稳定、升高还是恢复。

## 1) 对比口径（本次 vs 上次）

- 本次：`docs/release-snapshot-latest.json`
- 上次：`docs/release-snapshots/` 中按时间倒序的上一条快照
- 说明：以下字段为**文档层派生读法**，用于值班解读，不改业务判定逻辑。

## 2) 三个变化字段怎么读

### `decisionChanged`
- 定义：`current.decision != previous.decision`
- 读法：
  - `false`：主结论未变，先看原因/提示是否有新增。
  - `true`：主结论已变化，优先判定风险方向（升高或恢复）。

### `reasonsAdded`
- 定义：`current.reasons - previous.reasons`（集合差集）
- 读法：
  - 非空：新增阻断原因，优先处理新增第一项。
  - 空：无新增阻断，继续看 `advisoriesAdded` 判断是否仅告警变化。

### `advisoriesAdded`
- 定义：`current.advisories - previous.advisories`（集合差集）
- 读法：
  - 非空：新增提示风险，不一定阻断，但要同步值班关注。
  - 空：提示层稳定。

## 3) 三种状态卡示例（值班可直接贴）

### A. GO -> GO（稳定）

- 条件示例：
  - `previous.decision=GO`
  - `current.decision=GO`
  - `decisionChanged=false`
- 卡片文案：
  - 标题：`发布快照稳定（GO->GO）`
  - 副句：`主结论未变化，当前风险等级保持稳定。`
  - 差异：`reasonsAdded={none} / advisoriesAdded={...或none}`
- 第一步动作（一句话）：
  - `继续按发布窗口推进，同时记录 advisories 新增项（若有）。`

### B. GO -> NO-GO（风险升高）

- 条件示例：
  - `previous.decision=GO`
  - `current.decision=NO-GO`
  - `decisionChanged=true`
- 卡片文案：
  - 标题：`发布风险升高（GO->NO-GO）`
  - 副句：`主结论从可放行转为阻断，需立即停发。`
  - 差异：`reasonsAdded={首个新增阻断原因}`
- 第一步动作（一句话）：
  - `立即暂停发布，先处理 reasonsAdded 的第一项并复跑 live 快照。`

### C. NO-GO -> GO（恢复）

- 条件示例：
  - `previous.decision=NO-GO`
  - `current.decision=GO`
  - `decisionChanged=true`
- 卡片文案：
  - 标题：`发布状态恢复（NO-GO->GO）`
  - 副句：`阻断状态已解除，但需确认恢复是否稳定。`
  - 差异：`reasonsAdded={none} / advisoriesAdded={...或none}`
- 第一步动作（一句话）：
  - `先复核最近一次修复项与当前 advisories，再进入发布确认。`

## 4) 值班判读顺序（固定）

1. 先看 `decisionChanged`（是否发生主结论变化）。  
2. 再看 `reasonsAdded`（是否新增阻断）。  
3. 最后看 `advisoriesAdded`（是否新增提示风险）。

## 5) 群内口令（可直接复用）

- `GO->GO：稳定，继续推进。`
- `GO->NO-GO：风险升高，立即停发。`
- `NO-GO->GO：状态恢复，复核后推进。`

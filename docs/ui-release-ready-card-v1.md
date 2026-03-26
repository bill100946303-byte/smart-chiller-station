# 发布就绪一屏卡 v1（6/6 门禁 + diff + consistency）

用途：值班同学 1 分钟内完成“可发/不可发/需复核”判断。  
边界：本卡只定义读法，不改任何脚本逻辑。

## 一屏先看什么

### A. 6/6 门禁是否通过

以 `verify-gates` 为准（共 6 项）：
1. acceptance-report contract
2. status-json contract
3. release-snapshot contract
4. release-snapshot-index contract
5. release-snapshot-diff contract
6. release-snapshot consistency

快速信号：
- `release-snapshot-latest.json -> checks.verifyGatesOk=true` 可视作 6/6 通过。
- 若为 `false`，先回看 `verify-gates` 输出中失败段落，不做放行。

### B. 固定阅读顺序（必须）

1. 先看 `decision`（主结论）  
2. 再看 `reasons`（阻断原因）  
3. 最后看 `diffClass`（与上次相比是稳定/升高/恢复）

说明：
- `decision` 来源：`release-snapshot-latest.json`
- `diffClass` 来源：`release-snapshot-diff-latest.json`
- `consistency` 来源：`release-snapshot-consistency-latest.json`

## 三个值班场景（标准动作一句话）

### 场景 1：可发

判定建议：
- `decision=GO`
- `reasons=[]`
- `diffClass in {stable,recovery}`
- `consistency.decision=GO`

标准动作：
- `按发布窗口执行放行，并在群内同步“GO（stable/recovery）”。`

### 场景 2：不可发

判定建议（任一满足）：
- `decision=NO-GO`
- `reasons` 非空
- `diffClass in {risk_up,error}`
- `consistency.decision=NO-GO`

标准动作：
- `立即停发，先处理首个阻断 reason，修复后重跑 snapshot 全链路。`

### 场景 3：需复核

判定建议：
- `decision=GO` 但存在以下任一：
  - `diffClass in {changed,insufficient_history}`
  - `consistency.reasons` 非空
  - `advisories` 新增且业务影响未确认

标准动作：
- `先发“需复核”通知并指定责任人，复核完成后再给最终放行结论。`

## 值班口令（可直接贴群）

- `先看 decision，再看 reasons，再看 diffClass。`
- `decision=NO-GO 或 reasons 非空，直接停发。`
- `index/diff 只做趋势与变化判断，最终仍以本次 snapshot decision 为准。`

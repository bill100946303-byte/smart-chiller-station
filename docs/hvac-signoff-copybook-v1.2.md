# HVAC Signoff Copybook v1.2（上线压缩版）

目标：在 v1.1 基础上提供移动端优先的上线文案，保留三档触发条件并补“值为0但非缺失”解释。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 本版变更范围

- 保留 `NOT_READY / READY_WITH_RISK / READY` 三档状态与触发框架。
- 新增 `mobileShort` 三语短句（标题/一句话/下一步动作），用于移动端直出。
- 新增 `zeroValueButPresent` 文案块，解释“值=0 但数据有效”。
- 保留 v1.1 的 `copy` 字段，兼容现有前端读取路径。

## 2) 三档短句（移动端，短句优先）

长度约束建议（zh 等效）：
- `title` <= 12
- `oneLiner` <= 22
- `nextAction` <= 22

### `NOT_READY`
- zh：`未达签收条件` / `链路或数据仍阻塞` / `先修复后连测2次`
- en：`Not Ready` / `Pipeline or data is still blocked` / `Fix first, pass 2 consecutive checks`
- vi：`Chua san sang` / `Du lieu hoac ket noi van bi nghen` / `Sua truoc, dat 2 lan lien tiep`

### `READY_WITH_RISK`
- zh：`可运行但有风险` / `主链路可用，评估有风险` / `先清跳过与COP缺失`
- en：`Runnable with Risk` / `Core path is up, evaluability risk remains` / `Clear skipped and COP-missing first`
- vi：`Van hanh co rui ro` / `Chuoi chinh san sang, van co rui ro danh gia` / `Xu ly skipped va COP thieu truoc`

### `READY`
- zh：`已达非降级运行` / `签收门槛通过，可稳定运行` / `冻结版本并常规巡检`
- en：`Non-Degraded Ready` / `Signoff gates passed, stable to run` / `Freeze baseline and keep routine checks`
- vi：`Dat phi suy giam` / `Da qua cong ky nhan, van hanh on dinh` / `Dong bang baseline va giam sat dinh ky`

## 3) “值为0但非缺失”解释模板

触发条件（字段级）：
- `sourceStatus.sources[key='metric.station_cop'].ok == true`
- 且存在零值：  
  `overview.energyCards.currentCop == 0`  
  或 `trends.stats[metric='currentCop'].latest == 0`  
  或 `trends.series[metric='currentCop'].points[*].v` 含 `0`
- 且不满足缺失条件：  
  `ruleEvaluation.skippedRuleDetails[].missingMetrics[]` 中不存在 `metric='station_cop'`

三语模板：
- zh
  - 标题：`值为0但数据有效`
  - 一句话：`0 表示当前读数，不等于字段缺失。`
  - 下一步：`先确认 sourceStatus=ok，再结合趋势判断。`
- en
  - Title: `Zero Value, Data Present`
  - One-liner: `A value of 0 is a valid reading, not a missing field.`
  - Next action: `Confirm sourceStatus=ok, then judge with trend context.`
- vi
  - Tieu de: `Gia tri 0 nhung du lieu hop le`
  - Mot cau: `Gia tri 0 la so do hop le, khong phai thieu truong.`
  - Buoc tiep theo: `Xac nhan sourceStatus=ok, sau do danh gia theo xu huong.`

## 4) 与 v1.1 差异（上线版）

1. 新增 `mobileShort` 三语短句，移动端可直接渲染。  
2. 新增 `zeroValueButPresent` 说明，减少“0值=缺失”误报。  
3. 三档触发条件保持不变，仅文案压缩。  
4. 保留 v1.1 `copy` 原字段，确保兼容接入。  

## 5) 回滚点

- 当前：`hvac-signoff-copybook-v1.2@1.2.0`
- 回滚目标：`hvac-signoff-copybook-v1.1@1.1.0`
- 回滚方式：前端切回 v1.1 文案文件，不影响规则引擎。

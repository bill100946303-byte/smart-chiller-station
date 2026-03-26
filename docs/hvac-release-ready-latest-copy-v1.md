# HVAC Release-Ready-Latest 三语值班文案 v1

目标：为 `release-snapshot-latest` 输出 `latest_ready / latest_blocked / latest_unknown` 三类值班文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

必需字段：
- `decision`
- `exitCode`
- `reasons[]`
- `generatedAt`

## 2) 分类顺序（避免重叠）

1. `latest_blocked`
2. `latest_unknown`
3. `latest_ready`

## 3) 三类文案与触发条件

### A) latest_blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `reasons.length > 0`

mobileShort：
- zh
  - 主句：`最新快照受阻`
  - 副句：`当前不可放行`
  - 第一动作：`先处理首个reason`
- en
  - Main: `Latest Blocked`
  - Sub: `Release not allowed now`
  - First action: `Handle the first reason`
- vi
  - Cau chinh: `Snapshot moi bi chan`
  - Cau phu: `Hien tai khong duoc phat hanh`
  - Buoc 1: `Xu ly reason dau tien`

full：
- zh
  - 主句：`最新快照状态：BLOCKED`
  - 副句：`最新快照显示阻断条件已命中，当前禁止放行。`
  - 第一动作：`先按 reasons 首项排障，再重跑 release-snapshot-latest。`
- en
  - Main: `Latest Snapshot Status: BLOCKED`
  - Sub: `The latest snapshot contains blocking conditions, so release is blocked.`
  - First action: `Troubleshoot the first item in reasons, then rerun release-snapshot-latest.`
- vi
  - Cau chinh: `Trang thai snapshot moi nhat: BLOCKED`
  - Cau phu: `Snapshot moi nhat co dieu kien chan, vi vay phat hanh bi chan.`
  - Buoc 1: `Xu ly muc dau trong reasons, sau do chay lai release-snapshot-latest.`

### B) latest_unknown

触发条件（字段级，任一满足）：
- `decision` 缺失或不在 `{"GO","NO-GO"}` 中
- `exitCode` 缺失或不在 `{0,1}` 中
- `generatedAt` 缺失或为空字符串
- `decision == "GO" && exitCode == 1`
- `decision == "NO-GO" && exitCode == 0`

mobileShort：
- zh
  - 主句：`最新状态未知`
  - 副句：`快照字段异常`
  - 第一动作：`先重采最新快照`
- en
  - Main: `Latest Unknown`
  - Sub: `Snapshot fields invalid`
  - First action: `Regenerate latest snapshot`
- vi
  - Cau chinh: `Trang thai moi chua ro`
  - Cau phu: `Truong snapshot khong hop le`
  - Buoc 1: `Tao lai snapshot moi nhat`

full：
- zh
  - 主句：`最新快照状态：UNKNOWN`
  - 副句：`最新快照字段缺失、取值异常或决策与退出码不一致，无法直接用于放行。`
  - 第一动作：`先重跑 release-snapshot 生成有效快照，再判定放行。`
- en
  - Main: `Latest Snapshot Status: UNKNOWN`
  - Sub: `Latest snapshot has missing/invalid fields or decision-exitCode mismatch, so it cannot be used directly for release.`
  - First action: `Rerun release-snapshot to regenerate a valid latest snapshot before deciding release.`
- vi
  - Cau chinh: `Trang thai snapshot moi nhat: UNKNOWN`
  - Cau phu: `Snapshot moi nhat thieu/sai truong hoac khong khop giua decision va exitCode, khong the dung truc tiep de quyet dinh phat hanh.`
  - Buoc 1: `Chay lai release-snapshot de tao snapshot hop le truoc khi quyet dinh phat hanh.`

### C) latest_ready

触发条件（字段级，全部满足）：
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `generatedAt` 存在且非空

mobileShort：
- zh
  - 主句：`最新快照就绪`
  - 副句：`可进入放行`
  - 第一动作：`按窗口执行发布`
- en
  - Main: `Latest Ready`
  - Sub: `Ready for release`
  - First action: `Release in window`
- vi
  - Cau chinh: `Snapshot moi san sang`
  - Cau phu: `San sang de phat hanh`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`最新快照状态：READY`
  - 副句：`最新快照结论为 GO 且无阻断原因，可进入标准放行流程。`
  - 第一动作：`先做发布窗口确认，再按标准步骤放行。`
- en
  - Main: `Latest Snapshot Status: READY`
  - Sub: `Latest snapshot is GO with no blocking reasons, ready for standard release flow.`
  - First action: `Run release-window confirmation first, then proceed with standard release steps.`
- vi
  - Cau chinh: `Trang thai snapshot moi nhat: READY`
  - Cau phu: `Snapshot moi nhat la GO va khong co ly do chan, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do phat hanh theo cac buoc chuan.`

## 4) 前端接入建议

1. 按 `latest_blocked -> latest_unknown -> latest_ready` 顺序首个命中。
2. 移动端优先渲染 `mobileShort`，展开态渲染 `full`。
3. 若字段缺失导致无法命中，回退显示 `latest_unknown`。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。

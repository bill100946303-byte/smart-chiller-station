# HVAC Release-Ready-Sync-Latest 三语播报文案 v1

目标：为 `release-ready-sync-latest` 输出 `sync_ready / sync_partial / sync_blocked` 三态文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `steps.releaseReady.ok`
- `steps.releaseReadyCheck.ok`
- `steps.releaseReadyLatest.ok`

## 2) 匹配顺序（建议）

1. `sync_blocked`
2. `sync_partial`
3. `sync_ready`

## 3) 三态文案

### A) sync_ready

触发条件（字段级，全部满足）：
- `decision == "GO"`
- `exitCode == 0`
- `steps.releaseReady.ok == true`
- `steps.releaseReadyCheck.ok == true`
- `steps.releaseReadyLatest.ok == true`

mobileShort：
- zh
  - 主句：`同步链路就绪`
  - 副句：`三步全部通过`
  - 第一动作：`按窗口执行放行`
- en
  - Main: `Sync Ready`
  - Sub: `All three steps passed`
  - First action: `Release in window`
- vi
  - Cau chinh: `Dong bo san sang`
  - Cau phu: `Ca 3 buoc deu dat`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`同步最新状态：SYNC_READY`
  - 副句：`主结论为 GO，且三步校验均通过，可进入标准放行流程。`
  - 第一动作：`先做发布窗口确认，再执行正式放行。`
- en
  - Main: `Sync-Latest Status: SYNC_READY`
  - Sub: `Decision is GO and all three sync steps passed, ready for standard release flow.`
  - First action: `Run release-window confirmation first, then execute formal release.`
- vi
  - Cau chinh: `Trang thai sync-latest: SYNC_READY`
  - Cau phu: `Decision la GO va ca 3 buoc dong bo deu dat, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do phat hanh chinh thuc.`

### B) sync_partial

触发条件（字段级，任一满足）：
- `decision == "GO" && exitCode == 0` 且任一 `steps.*.ok == false`
- `decision == "NO-GO" && exitCode == 1` 且任一 `steps.*.ok == true`
- `decision == "GO" && exitCode == 1`
- `decision == "NO-GO" && exitCode == 0`

mobileShort：
- zh
  - 主句：`同步部分通过`
  - 副句：`步骤结果不一致`
  - 第一动作：`先补齐失败步骤`
- en
  - Main: `Sync Partial`
  - Sub: `Step results are mixed`
  - First action: `Fix failed steps first`
- vi
  - Cau chinh: `Dong bo mot phan`
  - Cau phu: `Ket qua buoc chua dong nhat`
  - Buoc 1: `Xu ly cac buoc loi truoc`

full：
- zh
  - 主句：`同步最新状态：SYNC_PARTIAL`
  - 副句：`主结论与步骤结果存在不一致，当前仅可视为部分通过。`
  - 第一动作：`先定位 `steps.*.ok=false` 的步骤并修复，再重跑 sync-latest。`
- en
  - Main: `Sync-Latest Status: SYNC_PARTIAL`
  - Sub: `Decision and step results are not fully aligned, so current state is partial.`
  - First action: `Fix steps where steps.*.ok=false, then rerun sync-latest.`
- vi
  - Cau chinh: `Trang thai sync-latest: SYNC_PARTIAL`
  - Cau phu: `Decision va ket qua cac buoc chua khop hoan toan, hien tai chi la trang thai mot phan.`
  - Buoc 1: `Xu ly cac buoc co steps.*.ok=false, sau do chay lai sync-latest.`

### C) sync_blocked

触发条件（字段级，全部满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `steps.releaseReady.ok == false`
- `steps.releaseReadyCheck.ok == false`
- `steps.releaseReadyLatest.ok == false`

mobileShort：
- zh
  - 主句：`同步完全受阻`
  - 副句：`三步全部失败`
  - 第一动作：`先停发并排障`
- en
  - Main: `Sync Blocked`
  - Sub: `All three steps failed`
  - First action: `Stop release and troubleshoot`
- vi
  - Cau chinh: `Dong bo bi chan`
  - Cau phu: `Ca 3 buoc deu loi`
  - Buoc 1: `Dung phat hanh va xu ly su co`

full：
- zh
  - 主句：`同步最新状态：SYNC_BLOCKED`
  - 副句：`主结论为 NO-GO，且三步均失败，当前禁止放行。`
  - 第一动作：`立即停发，按步骤顺序逐项恢复后再重跑。`
- en
  - Main: `Sync-Latest Status: SYNC_BLOCKED`
  - Sub: `Decision is NO-GO and all three steps failed, so release is blocked now.`
  - First action: `Stop release immediately, recover step-by-step, then rerun.`
- vi
  - Cau chinh: `Trang thai sync-latest: SYNC_BLOCKED`
  - Cau phu: `Decision la NO-GO va ca 3 buoc deu loi, hien tai phat hanh bi chan.`
  - Buoc 1: `Dung phat hanh ngay, khoi phuc tung buoc roi chay lai.`

## 4) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。

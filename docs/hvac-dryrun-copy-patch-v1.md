# HVAC Dry-Run 文案补丁 v1

目标：为验收三档文案增加 dry-run 场景副句（预演结果，不代表正式放行）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 触发条件（字段级）

统一前置条件：
- `mode == "dry-run"`

分档条件（沿用 `hvac-acceptance-ops-copy-v1`）：
- `ACCEPT_READY`: `overallPass == true && readiness.nonDegradedReady == true && badge.globalPass == true`
- `ACCEPT_READY_WITH_RISK`:  
  `overallPass == true && (readiness.nonDegradedReady == false || badge.globalPass == false)`  
  或 `overallPass == false && readiness.nonDegradedReady == true && badge.globalPass == true`
- `ACCEPT_NOT_READY`:  
  `overallPass == false && readiness.nonDegradedReady == false`  
  或 `overallPass == false && badge.globalPass == false`

## 2) 三档文案（主句沿用 + dry-run 副句）

## ACCEPT_READY

### zh
- 主句（沿用）：`验收已通过`
- dry-run 副句（新增）：`本次为预演结果，不代表正式放行。`

### en
- Primary (reused): `Acceptance Passed`
- Dry-run subline (new): `This is a dry-run result and does not represent formal release approval.`

### vi
- Cau chinh (giu nguyen): `Nghiem thu da dat`
- Cau phu dry-run (bo sung): `Day la ket qua dry-run, khong dai dien cho phe duyet phat hanh chinh thuc.`

## ACCEPT_READY_WITH_RISK

### zh
- 主句（沿用）：`可发布但有风险`
- dry-run 副句（新增）：`本次为预演结果，不代表正式放行。`

### en
- Primary (reused): `Publish with Risk`
- Dry-run subline (new): `This is a dry-run result and does not represent formal release approval.`

### vi
- Cau chinh (giu nguyen): `Co the phat hanh nhung co rui ro`
- Cau phu dry-run (bo sung): `Day la ket qua dry-run, khong dai dien cho phe duyet phat hanh chinh thuc.`

## ACCEPT_NOT_READY

### zh
- 主句（沿用）：`验收未通过`
- dry-run 副句（新增）：`本次为预演结果，不代表正式放行。`

### en
- Primary (reused): `Acceptance Not Ready`
- Dry-run subline (new): `This is a dry-run result and does not represent formal release approval.`

### vi
- Cau chinh (giu nguyen): `Nghiem thu chua dat`
- Cau phu dry-run (bo sung): `Day la ket qua dry-run, khong dai dien cho phe duyet phat hanh chinh thuc.`

## 3) 渲染顺序建议

- 固定顺序：`主句 -> dry-run 副句`
- 主句保持原风险等级，不被副句替代。
- 副句用于对外口径约束，不改变档位结论。

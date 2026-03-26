# HVAC 放行结论对外话术 v1.0

目标：输出 GO / NO-GO 两档三语话术，并与现有 HVAC 文案口径一致。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 触发字段（字段级）

仅使用以下字段：
- `overallPass`（布尔）
- `contractGate`（布尔）

`contractGate` 兼容取值来源（按顺序）：
1. `contract.ok`
2. `gates.contractOk`

## 2) 两档判定规则

## GO

触发条件（全部满足）：
- `overallPass == true`
- `contractGate == true`

### zh
- 主句：`放行结论：GO`
- 副句：`验收通过且合同门禁通过，可按既定窗口对外发布。`

### en
- Main: `Release Decision: GO`
- Sub: `Acceptance is passed and contract gate is passed, external release is allowed in the planned window.`

### vi
- Cau chinh: `Ket luan phat hanh: GO`
- Cau phu: `Nghiem thu dat va cong contract dat, co the cong bo theo khung thoi gian da dinh.`

## NO-GO

触发条件（任一满足）：
- `overallPass == false`
- `contractGate == false`

### zh
- 主句：`放行结论：NO-GO`
- 副句：`验收或合同门禁未通过，当前禁止对外发布。`

### en
- Main: `Release Decision: NO-GO`
- Sub: `Acceptance or contract gate is not passed, external release is blocked for now.`

### vi
- Cau chinh: `Ket luan phat hanh: NO-GO`
- Cau phu: `Nghiem thu hoac cong contract chua dat, tam thoi khong duoc cong bo ra ngoai.`

## 3) 口径约束

- 对外只发布 `GO/NO-GO` 主结论与对应副句，不混入内部调试信息。
- 若为 dry-run 场景，需叠加 dry-run 副句：`本次为预演结果，不代表正式放行。`

# HVAC 发布快照三语运维文案 v1

目标：为发布快照（release snapshot）提供 GO / NO-GO / UNKNOWN 三态三语文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

必需字段：
- `decision`
- `reasons[]`
- `advisories[]`
- `exitCode`

可选字段：
- `canonicalExists`
- `canonicalOverallPass`
- `strictFreshness`
- `freshness`

## 2) 三种决策态文案（mobileShort + full）

说明：`mobileShort` 中文目标不超过 18 字。

### A. GO

触发条件（字段级）：
- `decision == "GO"`

mobileShort：
- zh
  - 主句：`可放行`
  - 副句：`门禁通过`
  - 第一动作：`按窗口发布`
- en
  - Main: `GO`
  - Sub: `Gate passed`
  - First action: `Release in window`
- vi
  - Cau chinh: `GO`
  - Cau phu: `Cong da dat`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`放行结论：GO`
  - 副句：`当前快照门禁通过，可进入正式发布流程。`
  - 第一动作：`先执行发布窗口确认，再按标准步骤放行。`
- en
  - Main: `Release Decision: GO`
  - Sub: `Current snapshot passes the gates and can enter formal release flow.`
  - First action: `Run release-window confirmation, then proceed with standard release steps.`
- vi
  - Cau chinh: `Ket luan phat hanh: GO`
  - Cau phu: `Snapshot hien tai dat cong va co the vao quy trinh phat hanh chinh thuc.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do phat hanh theo quy trinh chuan.`

### B. NO-GO

触发条件（字段级）：
- `decision == "NO-GO"`

mobileShort：
- zh
  - 主句：`禁止放行`
  - 副句：`存在阻断项`
  - 第一动作：`先修复再复跑`
- en
  - Main: `NO-GO`
  - Sub: `Blocking reason`
  - First action: `Fix then rerun`
- vi
  - Cau chinh: `NO-GO`
  - Cau phu: `Co ly do chan`
  - Buoc 1: `Sua roi chay lai`

full：
- zh
  - 主句：`放行结论：NO-GO`
  - 副句：`当前快照存在阻断原因，暂不允许对外发布。`
  - 第一动作：`先处理首个 reason，再重跑 gate 快照确认。`
- en
  - Main: `Release Decision: NO-GO`
  - Sub: `Current snapshot has blocking reasons and external release is not allowed.`
  - First action: `Resolve the first reason, then rerun release-gate snapshot.`
- vi
  - Cau chinh: `Ket luan phat hanh: NO-GO`
  - Cau phu: `Snapshot hien tai co ly do chan, khong duoc cong bo ra ngoai.`
  - Buoc 1: `Xu ly reason dau tien, sau do chay lai snapshot release-gate.`

### C. UNKNOWN

触发条件（字段级，任一满足）：
- `decision` 缺失
- `decision` 不在 `{"GO","NO-GO"}` 中
- `exitCode` 缺失且 `decision` 无法判定

mobileShort：
- zh
  - 主句：`状态未知`
  - 副句：`快照不完整`
  - 第一动作：`先重采快照`
- en
  - Main: `Unknown`
  - Sub: `Snapshot incomplete`
  - First action: `Refresh snapshot`
- vi
  - Cau chinh: `Khong ro trang thai`
  - Cau phu: `Snapshot chua day du`
  - Buoc 1: `Lay lai snapshot`

full：
- zh
  - 主句：`放行结论：UNKNOWN`
  - 副句：`当前快照字段不完整或决策值异常，不能用于放行判断。`
  - 第一动作：`先重跑 release-gate --json 或 release-gate-latest 生成有效快照。`
- en
  - Main: `Release Decision: UNKNOWN`
  - Sub: `Snapshot is incomplete or decision value is invalid, so it cannot be used for release judgment.`
  - First action: `Rerun release-gate --json or release-gate-latest to generate a valid snapshot.`
- vi
  - Cau chinh: `Ket luan phat hanh: UNKNOWN`
  - Cau phu: `Snapshot thieu truong hoac gia tri decision khong hop le, khong the dung de phan quyet phat hanh.`
  - Buoc 1: `Chay lai release-gate --json hoac release-gate-latest de tao snapshot hop le.`

## 3) reasons / advisories 常见 key 三语短映射（6 keys）

说明：以下为短映射，适合标签或副句区域。

### 3.1 reason: `contract_not_ok`
- 触发：`reasons[] contains "contract_not_ok"`
- zh：`合同门禁未过`
- en：`Contract gate failed`
- vi：`Cong hop dong chua dat`

### 3.2 reason: `canonical_missing`
- 触发：`reasons[] contains "canonical_missing"`
- zh：`缺少验收主报告`
- en：`Canonical report missing`
- vi：`Thieu bao cao canonical`

### 3.3 reason: `canonical_not_pass`
- 触发：`reasons[] contains "canonical_not_pass"`
- zh：`验收结果未通过`
- en：`Acceptance not passed`
- vi：`Nghiem thu chua dat`

### 3.4 reason: `freshness_not_fresh_strict`
- 触发：`reasons[] contains "freshness_not_fresh_strict"`
- zh：`严格时效未达 fresh`
- en：`Strict freshness not fresh`
- vi：`Strict freshness khong fresh`

### 3.5 advisory: `freshness_warn`
- 触发：`advisories[] contains "freshness_warn"`
- zh：`时效预警`
- en：`Freshness warning`
- vi：`Canh bao do tuoi`

### 3.6 advisory: `runtime_unavailable_snapshot_present`
- 触发：`advisories[] contains "runtime_unavailable_snapshot_present"`
- zh：`存在环境受限快照`
- en：`Runtime-limited snapshot present`
- vi：`Co snapshot moi truong han che`

## 4) 展示顺序建议（前端）

1. 先按 `decision` 渲染三态主文案（mobile/full 二选一）。
2. 再显示首个 `reason`（若有）作为主因短映射。
3. 最后显示 `advisories`（非阻断提示，不覆盖主结论）。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。

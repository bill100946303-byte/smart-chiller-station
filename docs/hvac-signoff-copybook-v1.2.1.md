# HVAC Signoff Copybook v1.2.1（环境受限说明补丁）

目标：在三档模板中补“运行态探针不可达”副文案，且保持“先规则结论，后环境说明”。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 补丁范围

- 保留 `NOT_READY / READY_WITH_RISK / READY` 三档触发条件不变。
- 新增环境副文案块：`environmentSubcopy`（zh/en/vi）。
- 新增渲染顺序策略：`primaryFirst=true`，主风险文案先显示，环境说明后显示。
- 新增环境触发标记：`envProbeUnreachable`（由 preflight 字段计算）。

## 2) 环境触发条件（字段级）

输入字段（来自 `v1.8-release-preflight.json`）：
- `gates.stackOk`
- `gates.runtimeRequired`
- `readiness.attribution`
- `readiness.ndFailedCount`

派生标记：
- `envProbeUnreachable = (gates.stackOk == false) OR (readiness.attribution == "upstream_interface" AND readiness.ndFailedCount > 0)`

## 3) 三档环境副文案（zh/en/vi）

## NOT_READY（副文案）
- zh：`环境说明：运行态探针暂不可达，诊断结论来自当前可用后端状态。`
- en：`Environment note: runtime probe is temporarily unreachable; diagnosis is based on currently available backend status.`
- vi：`Ghi chu moi truong: probe runtime tam thoi khong truy cap duoc; ket luan dua tren trang thai backend hien co.`

## READY_WITH_RISK（副文案）
- zh：`环境说明：运行态探针受限，风险判断已按现有后端信号保守处理。`
- en：`Environment note: runtime probe is constrained; risk judgement is conservatively derived from available backend signals.`
- vi：`Ghi chu moi truong: probe runtime bi gioi han; danh gia rui ro duoc xu ly than trong theo tin hieu backend hien co.`

## READY（副文案）
- zh：`环境说明：运行态探针暂不可达，不影响当前非降级签收结论；请继续例行复测。`
- en：`Environment note: runtime probe is temporarily unreachable; current non-degraded signoff remains valid. Continue routine re-checks.`
- vi：`Ghi chu moi truong: probe runtime tam thoi khong truy cap duoc; ket luan ky nhan phi suy giam hien tai van hop le. Tiep tuc tai kiem tra dinh ky.`

## 4) 渲染顺序约束

- 固定顺序：`primaryCopy -> environmentSubcopy`
- 当 `envProbeUnreachable == false` 时，不展示环境副文案。
- 环境副文案禁止覆盖主结论等级（不改变三档状态）。

## 5) 与 v1.2 差异

1. 新增 `environmentSubcopy` 三档三语模板。  
2. 新增 `renderPolicy.primaryFirst` 与 `showEnvironmentSubcopyWhen`。  
3. 新增 `derivedFlags.envProbeUnreachable`。  
4. 三档主触发条件、主文案、规则逻辑保持不变。  

## 6) 回滚点

- 当前：`hvac-signoff-copybook-v1.2.1@1.2.1`
- 回滚目标：`hvac-signoff-copybook-v1.2@1.2.0`
- 回滚方式：前端切回 v1.2 文件，不影响规则引擎判定。

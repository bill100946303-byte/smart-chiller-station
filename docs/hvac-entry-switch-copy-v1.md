# HVAC Entry Switch 文案 v1

目标：补“入口切换后运维提示”文案（仅文案层，不改规则）。  
触发条件字段限制：仅使用 `preflightPass` / `stackOk` / `contractOk` / `shellOk` / `runtimeRequired`。

## 1) ENTRY_SWITCH_SUCCESS

触发条件（全部满足）：
- `preflightPass == true`
- `stackOk == true`
- `contractOk == true`
- `shellOk == true`

三语短文案：
- zh
  - `shortTitle`: `入口切换成功`
  - `shortReason`: `核心链路通过，可切主入口`
  - `shortAction`: `保持巡检并记录切换时间`
- en
  - `shortTitle`: `Entry Switch Success`
  - `shortReason`: `Core gates passed, primary entry is ready`
  - `shortAction`: `Keep routine checks and log switch time`
- vi
  - `shortTitle`: `Chuyen cong vao thanh cong`
  - `shortReason`: `Cong chinh da dat, san sang dung lo vao chinh`
  - `shortAction`: `Duy tri kiem tra dinh ky va ghi lai thoi diem`

## 2) ENTRY_SWITCH_PARTIAL

触发条件（全部满足）：
- `preflightPass == true`
- `stackOk == false`
- `contractOk == true`
- `shellOk == true`
- `runtimeRequired == false`

三语短文案：
- zh
  - `shortTitle`: `入口切换部分可用`
  - `shortReason`: `运行态探针未就绪，但当前允许降依赖切换`
  - `shortAction`: `先小流量验证，再观察稳定性`
- en
  - `shortTitle`: `Entry Switch Partial`
  - `shortReason`: `Runtime probe is unavailable, but fallback switch is allowed`
  - `shortAction`: `Start with small traffic, then monitor stability`
- vi
  - `shortTitle`: `Chuyen cong vao mot phan`
  - `shortReason`: `Probe runtime chua san sang, nhung van cho phep chuyen theo che do du phong`
  - `shortAction`: `Mo nho luu luong truoc, sau do theo doi on dinh`

## 3) ENTRY_SWITCH_BLOCKED

触发条件（任一满足）：
- `preflightPass == false`
- `contractOk == false`
- `shellOk == false`
- `runtimeRequired == true && stackOk == false`

三语短文案：
- zh
  - `shortTitle`: `入口切换受阻`
  - `shortReason`: `关键门禁未通过，禁止切换主入口`
  - `shortAction`: `先修复失败门禁，再执行切换`
- en
  - `shortTitle`: `Entry Switch Blocked`
  - `shortReason`: `Critical gates failed, primary entry switch is blocked`
  - `shortAction`: `Fix failed gates first, then retry switch`
- vi
  - `shortTitle`: `Bi chan chuyen cong vao`
  - `shortReason`: `Cong quan trong chua dat, khong duoc chuyen lo vao chinh`
  - `shortAction`: `Sua cong loi truoc, roi thu chuyen lai`

## 4) 边界声明

- 本文案仅用于入口切换提示，不改变规则判定。
- 不改 `ruleId`、不改阈值、不改 evaluator。

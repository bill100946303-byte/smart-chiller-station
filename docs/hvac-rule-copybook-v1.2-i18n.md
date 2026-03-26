# HVAC 规则文案 v1.2 多语言最小集（EN/VI）

版本信息：
- i18n 版本：`1.2.0-i18n-min`
- 基线：`docs/hvac-rule-copybook-v1.2.json`
- 目标：前端切换 EN/VI 时，高频短文案不回退中文。

## 1) 覆盖范围（最小集）

仅覆盖以下高频字段：
- 5 条规则：`ruleCopy.<ruleId>.shortText.shortTitle|shortReason|shortAction`
- 3 类 skipped：`skippedPlaybook.<category>.shortCopy.main|detail|action`
- 风险短文案：`riskMapping.risk.high|medium|low`

未在以上范围内的字段，统一回退中文（见“中文回退白名单”）。

## 2) EN 最小映射

### 2.1 Rule shortText

| ruleId | shortTitle | shortReason | shortAction |
| --- | --- | --- | --- |
| `low-delta-t-chilled-loop` | Low Delta-T | Low delta-T under load | Check bypass, tune CHWS setpoint |
| `pump-frequency-too-high` | Pump Hz High | High Hz, limited heat-transfer gain | Reduce by 2Hz, watch dP |
| `cooling-side-low-efficiency` | Cooling Side Low Eff. | Weak heat rejection, low COP | Tune tower fans, inspect condenser |
| `frequent-start-stop` | Frequent Cycling | Too many starts/stops in short window | Enable min on/off lockout |
| `stale-data-detection` | Stale Data | Key data delayed or missing | Restore data link before tuning |

### 2.2 Skipped shortCopy

| category | main | detail | action |
| --- | --- | --- | --- |
| `upstream_unreachable` | Upstream Down | No upstream data; rule skipped | Check service -> network -> port |
| `field_missing_or_invalid` | Field Invalid | Required fields missing/invalid; skipped | Check mapping, units, then sampling |
| `unknown` | Unknown Status | No template matched; downgraded view | Check version -> dictionary -> contract |

### 2.3 Risk short

- `high` -> `High risk`
- `medium` -> `Medium risk`
- `low` -> `Low risk`

## 3) VI 最小映射

### 3.1 Rule shortText

| ruleId | shortTitle | shortReason | shortAction |
| --- | --- | --- | --- |
| `low-delta-t-chilled-loop` | Delta-T thấp | Delta-T thấp khi tải vẫn cao | Kiểm tra bypass, chỉnh nước cấp |
| `pump-frequency-too-high` | Tần số bơm cao | Hz cao nhưng trao đổi nhiệt tăng ít | Giảm 2Hz mỗi bước, theo dõi dP |
| `cooling-side-low-efficiency` | Giải nhiệt kém | Thải nhiệt yếu, COP thấp | Chỉnh quạt tháp, kiểm tra bình ngưng |
| `frequent-start-stop` | Đóng cắt nhiều | Số lần start/stop quá dày | Bật khóa thời gian chạy/dừng tối thiểu |
| `stale-data-detection` | Dữ liệu cũ | Thiếu hoặc trễ dữ liệu quan trọng | Khôi phục đường dữ liệu trước khi chỉnh |

### 3.2 Skipped shortCopy

| category | main | detail | action |
| --- | --- | --- | --- |
| `upstream_unreachable` | Nguồn không tới | Không có dữ liệu nguồn; đã bỏ qua | Kiểm tra dịch vụ -> mạng -> cổng |
| `field_missing_or_invalid` | Lỗi trường dữ liệu | Thiếu/sai trường bắt buộc; đã bỏ qua | Kiểm tra map trường, đơn vị rồi lấy mẫu |
| `unknown` | Trạng thái lạ | Không khớp mẫu từ điển; đã hạ cấp hiển thị | Kiểm tra phiên bản -> từ điển -> hợp đồng |

### 3.3 Risk short

- `high` -> `Rủi ro cao`
- `medium` -> `Rủi ro trung bình`
- `low` -> `Rủi ro thấp`

## 4) 中文回退白名单（仍回退中文）

以下字段本轮不做 EN/VI 翻译，前端回退中文：
- `ruleCopy.<ruleId>.nameZh`
- `ruleCopy.<ruleId>.descriptionZh`
- `ruleCopy.<ruleId>.opsAdviceZh`
- `ruleCopy.<ruleId>.executionChecklist.step1|step2|step3`
- `skippedPlaybook.<category>.order[]`
- `skippedPlaybook.<category>.templates[]`
- `riskMapping.severity.critical|major|minor`
- `riskNarrativePolicy.*`
- `fallbackCopy.*`
- `placementTemplates.*`
- `compatibility`
- `diffFromV1`
- `diffFromV1_1`
- `rollback`

## 5) 接入建议（最小改动）

- 前端语言选择顺序：`localeValue ?? zh-CN value`
- 仅对最小集字段走 i18n 覆盖，其他字段沿用 v1.2 中文源。
- 若 `ruleId/category` 未命中 i18n，直接回退 `docs/hvac-rule-copybook-v1.2.json` 的中文短文案。

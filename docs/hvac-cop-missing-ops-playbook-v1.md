# HVAC COP Missing Ops Playbook v1

目标：提供“`station_cop` 缺失但其他指标正常”时的可执行运维话术与动作模板。  
边界：不改阈值、不改 `ruleId`、不改 evaluator / 判定逻辑。

## 1) 字段级判定口径

输入字段：
- `ruleEvaluation.rulesLoaded`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].metric`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
- `sourceStatus.sources[*].key`
- `sourceStatus.sources[*].ok`
- `overview.freshness.stale`
- `trends.freshness.stale`
- `anomalies.freshness.stale`
- `generatedAt`（用于计算持续时长）

派生标记：
- `copMissing`: 存在 `missingMetrics[*].metric === "station_cop"`
- `copMissingOnly`: `copMissing === true` 且不存在其他 `metric != "station_cop"` 的缺失
- `otherMetricsHealthy`: 以下都满足  
  - `sourceStatus.sources[key="metric.chilled_delta_t_c"].ok === true`  
  - `sourceStatus.sources[key="metric.cooling_delta_t_c"].ok === true`  
  - `sourceStatus.sources[key="metric.station_total_power_kw"].ok === true`
- `freshnessStale`: `[overview.freshness.stale, trends.freshness.stale, anomalies.freshness.stale].some(Boolean) === true`
- `copMissingDurationMin`: 连续轮询窗口内 `copMissingOnly && otherMetricsHealthy` 为真时累计分钟
- `copRecoveredDurationMin`: 连续轮询窗口内 `copMissing === false` 且 `sourceStatus.sources[key="metric.station_cop"].ok === true` 为真时累计分钟

路由说明：
- 本 playbook 默认用于 `freshnessStale === false` 的“指标缺失但链路整体稳定”场景。
- 若 `freshnessStale === true`，优先叠加 `docs/hvac-stale-mode-copy-v1.md` 的 stale 文案策略。

## 2) 场景与模板

## S1 短时缺失（<30min）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `copMissingOnly === true`
- `otherMetricsHealthy === true`
- `copMissingDurationMin < 30`

### zh
- 主提示：`COP 指标短时缺失`
- 次提示：`仅 station_cop 暂不可评估，其它关键指标正常，当前以链路抖动或采样延迟优先排查。`
- 三步操作：
  1. `先看`：确认 `metric.station_cop` 最近采样时间与上次有效值，核对是否仅单点断续。
  2. `再做`：检查 COP 字段映射与解析规则（空值/非数值处理），同时核对采集任务最近执行日志。
  3. `验证`：在下一个 5-15 分钟窗口确认 COP 恢复并持续有值，建议卡不再新增 COP 缺失跳过。
- 风险边界：`未恢复前，禁止基于 COP 相关结论做高风险节能调参。`

### en
- Main hint: `Short COP Data Gap`
- Sub hint: `Only station_cop is temporarily non-evaluable while other key metrics are healthy; prioritize transient pipeline or sampling delay checks.`
- 3-step actions:
  1. `Inspect`: Check latest timestamp and last valid value for `metric.station_cop`.
  2. `Act`: Verify COP field mapping/parsing rules and collector run logs.
  3. `Validate`: Confirm COP values return and stay stable in the next 5-15 minute window.
- Risk boundary: `Do not execute high-risk optimization actions based on COP-dependent conclusions before recovery.`

### vi
- Gợi ý chính: `Thiếu COP ngắn hạn`
- Gợi ý phụ: `Chỉ station_cop tạm thời chưa đánh giá được, các chỉ số quan trọng khác vẫn bình thường; ưu tiên kiểm tra trễ lấy mẫu hoặc dao động đường dữ liệu.`
- 3 bước thao tác:
  1. `Quan sát`: Kiểm tra timestamp mới nhất và giá trị hợp lệ gần nhất của `metric.station_cop`.
  2. `Thực hiện`: Rà soát mapping/quy tắc parse COP và log chạy của tác vụ thu thập.
  3. `Xác nhận`: Trong cửa sổ 5-15 phút tiếp theo, COP phải có lại và ổn định.
- Biên giới rủi ro: `Chưa khôi phục thì không thực hiện điều chỉnh tiết kiệm năng lượng rủi ro cao dựa trên COP.`

## S2 持续缺失（>=30min）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `copMissingOnly === true`
- `otherMetricsHealthy === true`
- `copMissingDurationMin >= 30`

### zh
- 主提示：`COP 指标持续缺失`
- 次提示：`station_cop 缺失已持续 >=30 分钟，建议可信度受影响并可能遮蔽冷却侧效率问题。`
- 三步操作：
  1. `先看`：定位缺失类别 `category`（`field_missing_or_invalid` / `upstream_unreachable` / `unknown`）及首次缺失时间。
  2. `再做`：按类别执行专项排障  
     - `field_missing_or_invalid`：修复字段映射、单位、空值转换  
     - `upstream_unreachable`：检查接口可达性、超时、鉴权  
     - `unknown`：核对版本与词典、合同字段
  3. `验证`：连续 2-3 个轮询周期确认 `metric.station_cop.ok === true`，且缺失明细不再出现 station_cop。
- 风险边界：`持续缺失阶段，禁止输出“系统效率改善/恶化”的最终业务结论。`

### en
- Main hint: `Persistent COP Data Loss`
- Sub hint: `station_cop has been missing for >=30 minutes, which degrades recommendation confidence and may hide cooling-side efficiency issues.`
- 3-step actions:
  1. `Inspect`: Identify top missing category and first missing timestamp.
  2. `Act`: Execute category-based remediation (`field_missing_or_invalid` / `upstream_unreachable` / `unknown`).
  3. `Validate`: Ensure `metric.station_cop.ok === true` for 2-3 consecutive polling cycles and no station_cop missing detail remains.
- Risk boundary: `Do not publish final business conclusions on efficiency improvement/degradation while persistent COP missing is active.`

### vi
- Gợi ý chính: `Thiếu COP kéo dài`
- Gợi ý phụ: `station_cop thiếu liên tục >=30 phút, làm giảm độ tin cậy khuyến nghị và có thể che khuất vấn đề hiệu suất phía giải nhiệt.`
- 3 bước thao tác:
  1. `Quan sát`: Xác định category thiếu chính và thời điểm bắt đầu thiếu.
  2. `Thực hiện`: Xử lý theo category (`field_missing_or_invalid` / `upstream_unreachable` / `unknown`).
  3. `Xác nhận`: Đảm bảo `metric.station_cop.ok === true` trong 2-3 chu kỳ liên tiếp và không còn thiếu station_cop.
- Biên giới rủi ro: `Khi thiếu kéo dài, không đưa ra kết luận kinh doanh cuối cùng về cải thiện/suy giảm hiệu suất.`

## S3 恢复后观察期（30-120min）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `copMissing === false`
- `otherMetricsHealthy === true`
- `copRecoveredDurationMin >= 30 && copRecoveredDurationMin <= 120`

### zh
- 主提示：`COP 已恢复，进入观察期`
- 次提示：`station_cop 已恢复可评估，建议在 30-120 分钟内持续观察稳定性后再恢复常规调优节奏。`
- 三步操作：
  1. `先看`：确认 COP 连续值无断点、无异常跳变，并与温差/功率趋势方向一致。
  2. `再做`：恢复常规建议执行，但每次调参保持小步长并记录动作与反馈。
  3. `验证`：观察期结束后无再次缺失，才解除“COP 缺失观察”标签。
- 风险边界：`观察期内仅允许低到中风险动作；高风险动作需二次确认。`

### en
- Main hint: `COP Restored, In Observation Window`
- Sub hint: `station_cop is evaluable again. Keep a 30-120 minute stabilization window before fully returning to normal tuning pace.`
- 3-step actions:
  1. `Inspect`: Confirm continuous COP values without gaps or abnormal spikes, aligned with delta-T/power trends.
  2. `Act`: Resume normal recommendations with small-step tuning and action logging.
  3. `Validate`: Remove COP-observation tag only if no relapse occurs by the end of the window.
- Risk boundary: `During observation, allow only low-to-medium risk actions; high-risk actions require secondary confirmation.`

### vi
- Gợi ý chính: `COP đã khôi phục, vào giai đoạn theo dõi`
- Gợi ý phụ: `station_cop đã đánh giá được trở lại. Duy trì cửa sổ ổn định 30-120 phút trước khi quay lại nhịp tối ưu bình thường.`
- 3 bước thao tác:
  1. `Quan sát`: Xác nhận chuỗi COP liên tục, không đứt đoạn/nhảy bất thường và phù hợp xu hướng delta-T/công suất.
  2. `Thực hiện`: Khôi phục thực thi khuyến nghị với bước điều chỉnh nhỏ và ghi log đầy đủ.
  3. `Xác nhận`: Chỉ gỡ nhãn theo dõi COP khi hết cửa sổ mà không tái thiếu.
- Biên giới rủi ro: `Trong giai đoạn theo dõi chỉ thực hiện tác vụ rủi ro thấp-trung bình; tác vụ rủi ro cao cần xác nhận lần hai.`

## 3) 边界声明

- 不改阈值。
- 不改 `ruleId`。
- 不改 evaluator / 判定逻辑。

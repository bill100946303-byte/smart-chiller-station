# HVAC Rule UI Payload 运行态场景集 v1

用途：提供给前端直连回归的文案场景样例。  
边界：不改阈值、不改 evaluator、不改 ruleId。

基线文件：
- `docs/hvac-rules-v1.yaml`
- `docs/hvac-rule-ui-payload-v1.json`
- `docs/hvac-rule-copybook-v1.2.json`
- `docs/hvac-rule-copybook-v1.2-i18n.json`

## 1) 场景索引（9个）

| 场景ID | 类型 | ruleId | category | sourceKey |
| --- | --- | --- | --- | --- |
| S01 | hit | `low-delta-t-chilled-loop` | `low_delta_t` | `metric.chilled_delta_t_c`, `metric.station_total_power_kw`, `ruleMetrics` |
| S02 | hit | `pump-frequency-too-high` | `high_pump_frequency` | `metric.chilled_delta_t_c`, `ruleMetrics` |
| S03 | hit | `cooling-side-low-efficiency` | `low_cooling_side_efficiency` | `metric.cooling_delta_t_c`, `metric.station_cop`, `ruleMetrics` |
| S04 | hit | `frequent-start-stop` | `frequent_start_stop` | `anomalySummary`, `runParams` |
| S05 | hit | `stale-data-detection` | `stale_data` | `dashboardOverview`, `anomalySummary`, `ruleMetrics` |
| S06 | skip | `low-delta-t-chilled-loop` | `upstream_unreachable` | `runParams` |
| S07 | skip | `cooling-side-low-efficiency` | `field_missing_or_invalid` | `metric.station_cop` |
| S08 | skip | `frequent-start-stop` | `unknown` | `ruleMetrics` |
| S09 | unknown | `unknown-rule-id-demo` | `unknown_rule_id` | `rules` |

## 2) 场景明细

### S01 命中：冷冻侧低温差
- ruleId: `low-delta-t-chilled-loop`
- category: `low_delta_t`
- sourceKey: `metric.chilled_delta_t_c`, `metric.station_total_power_kw`, `ruleMetrics`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 冷冻侧低温差 | 在有一定负荷时，冷冻水温差持续偏低，通常表示换热利用不足或旁通偏大。 | 先查末端阀门与旁通，再校核供水温度设定。 |
| en | Improve chilled-water delta-T | Chilled-water delta-T remains below healthy range under non-trivial load. | Check valve opening and balancing in secondary loop. |
| vi | Chênh nhiệt nước lạnh thấp | Khi tải vẫn đáng kể, chênh nhiệt nước lạnh duy trì thấp, cho thấy trao đổi nhiệt chưa tối ưu hoặc bypass lớn. | Ưu tiên kiểm tra van cuối tuyến và bypass, sau đó hiệu chỉnh nhiệt độ nước cấp lạnh. |

### S02 命中：冷冻泵高频低效
- ruleId: `pump-frequency-too-high`
- category: `high_pump_frequency`
- sourceKey: `metric.chilled_delta_t_c`, `ruleMetrics`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 冷冻泵高频低效 | 泵频长期偏高但温差提升有限，输配能耗可能偏高。 | 下调泵频并观察压差/舒适度，复核压差传感器。 |
| en | Reduce excessive chilled-pump frequency | Pump speed is high while heat transfer gain is weak, indicating avoidable transport energy. | Apply delta-T guided pump VFD reset. |
| vi | Bơm nước lạnh tần số cao, hiệu quả thấp | Tần số bơm duy trì cao nhưng cải thiện chênh nhiệt hạn chế, có dấu hiệu tiêu hao vận chuyển không cần thiết. | Giảm tần số bơm theo từng bước nhỏ và theo dõi chênh áp/độ thoải mái. |

### S03 命中：冷却侧效率偏低
- ruleId: `cooling-side-low-efficiency`
- category: `low_cooling_side_efficiency`
- sourceKey: `metric.cooling_delta_t_c`, `metric.station_cop`, `ruleMetrics`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 冷却侧效率偏低 | 冷却侧功率投入较高但散热效果偏弱，系统COP被拖低。 | 优化塔风机分级与冷却水设定，检查冷凝器污垢。 |
| en | Improve cooling-side heat rejection efficiency | Cooling side consumes meaningful power but rejects heat inefficiently, dragging overall COP. | Tune tower fan staging and condenser-water setpoint reset. |
| vi | Hiệu suất phía giải nhiệt thấp | Phía giải nhiệt tiêu thụ công suất đáng kể nhưng khả năng thải nhiệt yếu, kéo giảm COP toàn trạm. | Tối ưu cấp quạt tháp và điểm đặt nước giải nhiệt, kiểm tra cáu cặn bình ngưng. |

### S04 命中：设备频繁启停
- ruleId: `frequent-start-stop`
- category: `frequent_start_stop`
- sourceKey: `anomalySummary`, `runParams`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 设备频繁启停 | 主机或水泵短时反复启停，存在控制震荡和设备损耗风险。 | 启用最小启停锁定时间，放宽控制死区。 |
| en | Stop short-cycling of chillers/pumps | Frequent start-stop indicates unstable sequence control and increases wear/energy loss. | Apply minimum on/off lockout timers. |
| vi | Thiết bị đóng cắt thường xuyên | Máy chính hoặc bơm đóng/cắt lặp lại trong thời gian ngắn, làm tăng rủi ro dao động điều khiển và hao mòn thiết bị. | Bật khóa thời gian chạy/dừng tối thiểu và nới deadband để giảm dao động. |

### S05 命中：数据新鲜度不足
- ruleId: `stale-data-detection`
- category: `stale_data`
- sourceKey: `dashboardOverview`, `anomalySummary`, `ruleMetrics`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 数据新鲜度不足 | 关键输入数据滞后或缺失，建议可信度下降。 | 优先恢复数据链路，再执行节能优化动作。 |
| en | Data is stale, verify ingestion and adapters | Key input data is stale or missing; optimization recommendations may be unreliable. | Surface stale status in UI and pause aggressive optimization advice. |
| vi | Độ mới dữ liệu suy giảm | Dữ liệu đầu vào quan trọng bị trễ hoặc thiếu, làm giảm độ tin cậy của khuyến nghị tối ưu. | Khôi phục chuỗi thu thập dữ liệu trước, rồi mới điều chỉnh tối ưu. |

### S06 跳过：上游不可达
- ruleId: `low-delta-t-chilled-loop`
- category: `upstream_unreachable`
- sourceKey: `runParams`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 上游不可达 | 上游服务不可达，规则已跳过。请按“服务 -> 网络 -> 端口”顺序排障后重试。 | 排障顺序：服务健康检查 -> 网络可达性 -> 端口监听。 |
| en | Upstream unreachable | Upstream service is unreachable and rule evaluation is skipped in this window. | Troubleshoot in order: service health -> network reachability -> port/listener. |
| vi | Nguồn dữ liệu không truy cập được | Dịch vụ nguồn không truy cập được nên rule bị bỏ qua trong cửa sổ hiện tại. | Xử lý theo thứ tự: dịch vụ -> kết nối mạng -> cổng/listener. |

### S07 跳过：字段缺失或无效
- ruleId: `cooling-side-low-efficiency`
- category: `field_missing_or_invalid`
- sourceKey: `metric.station_cop`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 字段异常 | 关键字段缺失或无效，规则已跳过。请按“映射 -> 单位 -> 采样”顺序排查。 | 排障顺序：字段映射 -> 单位口径 -> 采样连续性。 |
| en | Missing or invalid fields | Required fields are missing or invalid, so the rule cannot be evaluated reliably. | Check in order: field mapping -> unit consistency -> sampling continuity. |
| vi | Thiếu hoặc sai trường dữ liệu | Trường bắt buộc bị thiếu hoặc không hợp lệ, nên rule không thể đánh giá tin cậy. | Kiểm tra theo thứ tự: mapping trường -> thống nhất đơn vị -> liên tục lấy mẫu. |

### S08 跳过：未知跳过类型
- ruleId: `frequent-start-stop`
- category: `unknown`
- sourceKey: `ruleMetrics`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 状态未识别 | 未识别的跳过类型，系统已降级。请先核对版本与词典收录。 | 排障顺序：版本一致性 -> 词典覆盖 -> 合同字段完整性。 |
| en | Unknown skip status | Skip status is not recognized by current dictionary and is rendered in degraded mode. | Check in order: version alignment -> dictionary coverage -> contract fields. |
| vi | Trạng thái bỏ qua chưa xác định | Trạng thái bỏ qua chưa được từ điển hiện tại nhận diện nên hiển thị hạ cấp. | Kiểm tra theo thứ tự: đồng bộ phiên bản -> phạm vi từ điển -> trường hợp đồng. |

### S09 未知：ruleId 未收录（fallback）
- ruleId: `unknown-rule-id-demo`
- category: `unknown_rule_id`
- sourceKey: `rules`

| lang | title | reason | action |
| --- | --- | --- | --- |
| zh | 规则诊断（未命名） | 该规则已触发，但当前版本暂无中文检查单。 | 请联系运维更新词典后再执行调参。 |
| en | Rule Diagnostic (Unmapped) | Rule was triggered, but this version has no mapped copy for the ruleId. | Update dictionary mapping before applying tuning actions. |
| vi | Chẩn đoán quy tắc (chưa ánh xạ) | Rule đã kích hoạt nhưng phiên bản hiện tại chưa có ánh xạ nội dung cho ruleId. | Cập nhật từ điển ánh xạ trước khi thực hiện điều chỉnh. |

## 3) 回归接入建议

- 命中场景：前端直接读取 `rules[].display`（desktop）和 `rules[].displayShort`（mobile）。
- skip 场景：按 `skippedTemplates[category]` 渲染三语文案。
- unknown 场景：`ruleId` 未命中时，走 fallback 文案，且保留原始 `ruleId` 供排障。

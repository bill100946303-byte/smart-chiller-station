# Sprint1 设备总览页 HVAC Pack v1

目标：从业务价值、运维价值和用户感知角度，把设备总览页首版三语口径一次性做完整。

## 1. 结论

- 设备总览页是否适合作为 Sprint1 第三个页面：`yes`
- 理由：趋势页和告警页先承接“发现问题 + 判断问题”，设备总览页更适合作为第三个页面承接“设备在哪里、当前骨架是否完整、值班下一步该去哪个页面”。

## 2. 页面定位

- 对应当前前端 route：`system-overview`
- 页面业务名建议：`设备总览页`

价值判断：

- 业务价值：`中`
- 运维价值：`中`
- 用户感知价值：`高`

说明：

- 业务上，它不直接给出暖通优化结论，但能快速回答“当前冷站骨架是否齐、设备分组是否对、值班从哪里开始看”。
- 运维上，它适合作为巡检入口和定位入口，帮助值班先分辨问题是“设备结构缺口”还是“趋势/告警层问题”。
- 用户感知上，它比规则卡和诊断卡更直观，适合在 Sprint1 前两页打稳后，作为第三页补齐系统完整感。

## 3. 字段边界

字段级触发条件仅使用：

- `deviceSummary`
- `groups`
- `nodes`
- `freshness`
- `sourceStatus`

说明：

- 如果前端实际 payload 使用 `topology.groups` / `topology.nodes`，则先展开为 `groups` / `nodes` 后再命中本包文案。

## 4. 页面主标题 / 副标题

主标题：

- zh：`设备总览`
- en：`Device Overview`
- vi：`Tổng quan thiết bị`

副标题：

- zh：`先看设备规模与拓扑骨架，再判断当前设备链路是否完整、降级或陈旧。`
- en：`Check device scale and topology skeleton first, then judge whether the device chain is complete, degraded, or stale.`
- vi：`Xem quy mô thiết bị và khung topology trước, sau đó đánh giá chuỗi thiết bị hiện tại là đầy đủ, suy giảm hay đã cũ.`

## 5. 值班介绍

页面介绍：

- zh：`设备总览页先回答设备骨架在不在、分组齐不齐、当前值班下一步该转去趋势页还是告警页。`
- en：`The device overview page answers whether the equipment skeleton is present, whether the groups are complete, and whether duty should jump next to the trend page or the alarm page.`
- vi：`Trang tổng quan thiết bị trả lời việc khung thiết bị có hiện diện hay không, các nhóm có đầy đủ hay không, và ca trực nên chuyển sang trang xu hướng hay trang cảnh báo tiếp theo.`

值班顺序：

- zh：`先看 freshness 和 sourceStatus，再看 totalDevices 与拓扑骨架，最后决定是继续巡检还是转趋势/告警页。`
- en：`Check freshness and sourceStatus first, then read totalDevices and the topology skeleton, and finally decide whether to keep inspecting here or switch to the trend/alarm pages.`
- vi：`Xem freshness và sourceStatus trước, sau đó đọc totalDevices và khung topology, cuối cùng quyết định tiếp tục kiểm tra tại đây hay chuyển sang trang xu hướng/cảnh báo.`

## 6. 状态优先级

1. `stale`
2. `degraded`
3. `empty`
4. `normal`

说明：

- `stale` 优先，因为设备页首先要保证当前骨架不是历史快照。
- `degraded` 次之，因为来源链路不完整时，设备数量和拓扑只能作入口参考。
- `empty` 仅用于来源正常但当前未形成可展示设备骨架的情况。

## 7. 四类状态文案

### A. normal

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `deviceSummary.totalDevices > 0`
- `groups.length > 0 OR nodes.length > 0`

mobileShort：

- zh：主句 `设备骨架正常` / 副句 `可作为巡检入口`
- en：Main `Device View Ready` / Sub `Use as inspection entry`
- vi：Câu chính `Khung thiết bị ổn` / Câu phụ `Dùng làm điểm vào kiểm tra`

full：

- zh：主句 `设备总览：NORMAL`；副句 `当前设备总数与拓扑骨架可用，适合先做巡检定位，再决定是否进入趋势页或告警页做进一步判断。`
- en：Main `Device Overview: NORMAL`; Sub `The current device count and topology skeleton are usable, so this page works as the first inspection and routing entry before moving to the trend or alarm page.`
- vi：Câu chính `Tổng quan thiết bị: NORMAL`; Câu phụ `Tổng số thiết bị và khung topology hiện khả dụng, phù hợp để kiểm tra và định vị ban đầu trước khi chuyển sang trang xu hướng hoặc cảnh báo.`

值班第一动作：

- zh：`先看总设备数和拓扑分组是否完整，再决定要继续查设备状态还是转去趋势/告警页。`
- en：`Check total device count and topology grouping first, then decide whether to stay on device status or move to the trend/alarm pages.`
- vi：`Xem tổng số thiết bị và nhóm topology trước, sau đó quyết định tiếp tục ở trang thiết bị hay chuyển sang trang xu hướng/cảnh báo.`

### B. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `设备链路降级` / 副句 `先看来源状态`
- en：Main `Device Chain Degraded` / Sub `Check source state first`
- vi：Câu chính `Chuỗi thiết bị suy giảm` / Câu phụ `Xem trạng thái nguồn trước`

full：

- zh：主句 `设备总览：DEGRADED`；副句 `当前设备链路处于 partial 或 failed，设备数量、分组或节点只可作为入口参考，不适合据此断定设备全貌已完整。`
- en：Main `Device Overview: DEGRADED`; Sub `The device chain is partial or failed, so counts, groups, or nodes should be treated as entry-level hints rather than proof that the full equipment picture is complete.`
- vi：Câu chính `Tổng quan thiết bị: DEGRADED`; Câu phụ `Chuỗi thiết bị đang ở trạng thái partial hoặc failed, vì vậy số lượng, nhóm hoặc nút chỉ nên được xem là gợi ý đầu vào, không phải bằng chứng là bức tranh thiết bị đã đầy đủ.`

值班第一动作：

- zh：`先看 sourceStatus 是哪条设备来源降级，再决定是先补链路还是先继续做有限巡检。`
- en：`Check which device source is degraded in sourceStatus first, then decide whether to repair the chain or continue with limited inspection.`
- vi：`Xem trong sourceStatus nguồn thiết bị nào đang suy giảm trước, sau đó quyết định sửa chuỗi hay tiếp tục kiểm tra trong phạm vi hạn chế.`

### C. stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `设备页已陈旧` / 副句 `先刷新再看`
- en：Main `Device View Stale` / Sub `Refresh before reading`
- vi：Câu chính `Trang thiết bị đã cũ` / Câu phụ `Làm mới trước khi xem`

full：

- zh：主句 `设备总览：STALE`；副句 `当前设备总览时间戳已陈旧，页面更适合作为历史快照参考，不应直接据此判断现场设备刚刚发生的变化。`
- en：Main `Device Overview: STALE`; Sub `The device overview timestamp is stale, so the page is better treated as a historical snapshot and should not be used alone to judge very recent field changes.`
- vi：Câu chính `Tổng quan thiết bị: STALE`; Câu phụ `Dấu thời gian của trang tổng quan thiết bị đã cũ, vì vậy trang này nên được xem như ảnh chụp lịch sử và không nên dùng một mình để đánh giá thay đổi rất gần tại hiện trường.`

值班第一动作：

- zh：`先刷新设备总览并确认 freshness 恢复，再判断当前拓扑和设备数量是否可信。`
- en：`Refresh the device overview first and confirm freshness has recovered, then judge whether the topology and device counts are trustworthy.`
- vi：`Làm mới trang tổng quan thiết bị trước và xác nhận freshness đã hồi phục, sau đó mới đánh giá topology và số lượng thiết bị có đáng tin hay không.`

### D. empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `deviceSummary.totalDevices == 0`
- `groups.length == 0 OR all(groups[].deviceCount == 0)`
- `all(nodes[].count == 0 OR nodes[].count is null)`

mobileShort：

- zh：主句 `暂无设备骨架` / 副句 `先核对映射`
- en：Main `No Device Skeleton` / Sub `Verify mapping first`
- vi：Câu chính `Chưa có khung thiết bị` / Câu phụ `Kiểm tra mapping trước`

full：

- zh：主句 `设备总览：EMPTY`；副句 `当前来源正常但未返回可展示的设备规模或拓扑骨架，更像设备映射尚未形成，不等于站点没有设备。`
- en：Main `Device Overview: EMPTY`; Sub `Sources are healthy, but there is still no displayable device scale or topology skeleton. This usually means the device mapping is not formed yet, not that the site has no equipment.`
- vi：Câu chính `Tổng quan thiết bị: EMPTY`; Câu phụ `Nguồn hiện bình thường nhưng vẫn chưa trả về quy mô thiết bị hoặc khung topology để hiển thị. Điều này thường có nghĩa là mapping thiết bị chưa hình thành, không phải trạm không có thiết bị.`

值班第一动作：

- zh：`先核对设备汇总和拓扑映射是否已生成，再决定是否回退到旧系统设备树核对。`
- en：`Verify device summary and topology mapping first, then decide whether to fall back to the legacy device tree for checking.`
- vi：`Kiểm tra trước xem tổng hợp thiết bị và mapping topology đã được tạo hay chưa, sau đó mới quyết định có quay lại cây thiết bị của hệ cũ để đối soát hay không.`

## 8. 最终建议

- 设备总览页是否适合作为 Sprint1 第三个页面：`yes`
- 理由：它不是最先承接判断链的页面，但很适合作为 Sprint1 第三个页面补齐“设备入口 + 拓扑骨架 + 值班导航”。


# Sprint2 设备页树与详情文案包 v1

目标：把设备页二期的“树 + 详情”三语值班文案一次性补齐，避免代码完成后再补词。

## 1. 结论

- 设备页二期是否适合进入开发：`yes`
- 理由：一期设备页已稳定承接摘要、骨架和列表，旧系统已确认 `/api/device/{dbName}/data` 与 `/api/device/{dbName}/data/tree` 可返回数据，二期只需在现有页面上补树导航与详情面板，不需要推倒重做。

## 2. 页面定位

- 二期新增重点：
  - `设备树导航`
  - `设备详情面板`
- 二期仍不包含：
  - 远程控制操作
  - 批量命令
  - 台账编辑
  - 2D/3D 联动控制

业务定位：

- 树负责回答“先定位到哪一类设备、哪一层、哪一台”。
- 详情负责回答“这台设备当前是什么状态、最近一次上报是否可信、当前该继续看还是转去告警/趋势页”。

## 3. 字段边界

字段级触发条件仅使用：

- `tree`
- `detail`
- `freshness`
- `sourceStatus`
- `status`

字段归一化建议：

- `tree`
  - 表示未来 `devices/tree` 的标准化根对象
  - 至少可包含：`nodes[]`、`selectedId`、`path[]`
- `detail`
  - 表示未来 `devices/{deviceId}` 的标准化根对象
  - 至少可包含：`deviceId`、`deviceName`、`status`、`metrics[]`、`sections[]`、`lastReportAt`
- `status`
  - 表示页面状态辅助根对象
  - 推荐承接：`treeSelection`、`detailPanel`

说明：

- `detail partial` 只表示“详情证据未补齐”，不等于来源链路整体失败。
- `degraded` 只用于来源链路失败或缺失，不和 `partial` 混用。

## 4. 页面主标题 / 副标题

主标题：

- zh：`设备树与详情`
- en：`Device Tree & Detail`
- vi：`Cây thiết bị và chi tiết`

副标题：

- zh：`先用树定位设备，再用详情确认状态、最近上报和当前巡检重点。`
- en：`Locate the device through the tree first, then use the detail panel to confirm state, latest report, and current inspection focus.`
- vi：`Định vị thiết bị bằng cây trước, sau đó dùng vùng chi tiết để xác nhận trạng thái, lần báo cáo gần nhất và trọng tâm kiểm tra hiện tại.`

## 5. 分区文案建议

树区标题：

- zh：`设备树`
- en：`Device Tree`
- vi：`Cây thiết bị`

树区副标题：

- zh：`树区负责快速定位楼层、系统桶和目标设备，不在二期承接批量管理。`
- en：`The tree helps quickly locate floor, system bucket, and target device, without taking on batch management in phase two.`
- vi：`Vùng cây giúp định vị nhanh tầng, nhóm hệ thống và thiết bị mục tiêu, chưa nhận phần quản lý hàng loạt trong giai đoạn hai.`

详情区标题：

- zh：`设备详情`
- en：`Device Detail`
- vi：`Chi tiết thiết bị`

详情区副标题：

- zh：`详情区负责展示当前选中设备的状态、关键字段和最近上报，不直接承接控制操作。`
- en：`The detail panel shows the selected device state, key fields, and latest report, without directly taking on control actions.`
- vi：`Vùng chi tiết dùng để hiển thị trạng thái, các trường chính và lần báo cáo gần nhất của thiết bị đang chọn, chưa trực tiếp nhận thao tác điều khiển.`

## 6. 值班介绍

页面介绍：

- zh：`设备页二期先回答三件事：树里能不能快速找到设备、详情是否足够支持判断、当前是字段未齐还是链路已降级。`
- en：`Phase two of the device page answers three things first: whether the tree can locate a device quickly, whether detail is strong enough to support judgment, and whether the current issue is missing detail fields or a degraded source chain.`
- vi：`Giai đoạn hai của trang thiết bị trước tiên trả lời ba việc: cây có giúp tìm thiết bị nhanh hay không, chi tiết có đủ để hỗ trợ phán đoán hay không, và vấn đề hiện tại là thiếu trường chi tiết hay chuỗi nguồn đã suy giảm.`

值班顺序：

- zh：`先看 freshness 与 sourceStatus，再看树是否可定位，最后看详情是否足够支撑下一步动作。`
- en：`Check freshness and sourceStatus first, then confirm the tree can locate the device, and finally judge whether the detail panel is strong enough to support the next action.`
- vi：`Xem freshness và sourceStatus trước, sau đó xác nhận cây có thể định vị thiết bị, cuối cùng đánh giá vùng chi tiết đã đủ để hỗ trợ bước tiếp theo hay chưa.`

## 7. 状态优先级

1. `stale`
2. `degraded`
3. `detail_partial`
4. `tree_empty`
5. `detail_normal`
6. `tree_normal`

说明：

- `stale` 优先，因为树和详情首先都要建立在当前数据不是历史快照上。
- `degraded` 高于 `detail_partial`，因为链路失败比明细字段未齐更重。
- `tree_empty` 只描述树无法承接导航，不等于详情一定失败。

## 8. 六类状态文案

### A. tree_normal

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `tree.nodes.length > 0`
- `status.treeSelection != "missing"`

mobileShort：

- zh：主句 `设备树已就绪` / 副句 `可直接定位`
- en：Main `Tree Ready` / Sub `Ready to locate`
- vi：Câu chính `Cây thiết bị sẵn sàng` / Câu phụ `Có thể định vị trực tiếp`

full：

- zh：主句 `设备树：TREE_NORMAL`；副句 `当前设备树可用于楼层、系统桶与目标设备定位，值班可先从树进入，再打开详情确认。`
- en：Main `Device Tree: TREE_NORMAL`; Sub `The current tree can be used to locate floor, system bucket, and target device, so duty can start from the tree and then open the detail panel for confirmation.`
- vi：Câu chính `Cây thiết bị: TREE_NORMAL`; Câu phụ `Cây hiện tại có thể dùng để định vị tầng, nhóm hệ thống và thiết bị mục tiêu, vì vậy ca trực có thể bắt đầu từ cây rồi mở vùng chi tiết để xác nhận.`

firstAction：

- zh：`先从树里选中目标设备，再进入详情确认状态和最近上报时间。`
- en：`Select the target device from the tree first, then open detail to confirm state and last report time.`
- vi：`Chọn thiết bị mục tiêu từ cây trước, sau đó mở vùng chi tiết để xác nhận trạng thái và thời điểm báo cáo gần nhất.`

### B. tree_empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `tree.nodes.length == 0`
- `status.treeSelection == "missing" OR tree.selectedId is missing`

mobileShort：

- zh：主句 `设备树为空` / 副句 `先查树源`
- en：Main `Tree Is Empty` / Sub `Check tree source`
- vi：Câu chính `Cây thiết bị trống` / Câu phụ `Kiểm tra nguồn cây`

full：

- zh：主句 `设备树：TREE_EMPTY`；副句 `当前来源正常，但树区没有返回可定位节点，更像树结构尚未生成，不等于站点没有设备。`
- en：Main `Device Tree: TREE_EMPTY`; Sub `Sources are healthy, but the tree returned no navigable nodes. This usually means the tree structure is not generated yet, not that the site has no equipment.`
- vi：Câu chính `Cây thiết bị: TREE_EMPTY`; Câu phụ `Nguồn hiện bình thường nhưng cây không trả về nút điều hướng nào. Điều này thường có nghĩa là cấu trúc cây chưa được tạo, không phải trạm không có thiết bị.`

firstAction：

- zh：`先核对 tree 是否已生成，再决定先回列表定位还是先补 tree 接口。`
- en：`Verify first whether tree data has been generated, then decide whether to fall back to the list for locating or fix the tree endpoint first.`
- vi：`Trước tiên kiểm tra xem dữ liệu cây đã được tạo hay chưa, sau đó mới quyết định quay lại danh sách để định vị hay sửa endpoint cây trước.`

### C. detail_normal

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `status.treeSelection == "selected"`
- `detail.deviceId exists`
- `detail.sections.length > 0 OR detail.metrics.length > 0`
- `detail.status != "unknown"`

mobileShort：

- zh：主句 `详情已就绪` / 副句 `可直接判断`
- en：Main `Detail Ready` / Sub `Ready to judge`
- vi：Câu chính `Chi tiết đã sẵn sàng` / Câu phụ `Có thể phán đoán trực tiếp`

full：

- zh：主句 `设备详情：DETAIL_NORMAL`；副句 `当前选中设备的详情字段已足够支撑值班判断，可直接查看状态、关键指标与最近上报。`
- en：Main `Device Detail: DETAIL_NORMAL`; Sub `The selected device detail is strong enough to support duty judgment, so status, key metrics, and latest report can be reviewed directly.`
- vi：Câu chính `Chi tiết thiết bị: DETAIL_NORMAL`; Câu phụ `Thông tin chi tiết của thiết bị đang chọn đã đủ để hỗ trợ phán đoán ca trực, vì vậy có thể xem trực tiếp trạng thái, chỉ số chính và lần báo cáo gần nhất.`

firstAction：

- zh：`先看设备状态和最近上报，再看关键指标是否支持当前巡检结论。`
- en：`Check device status and latest report first, then confirm whether the key metrics support the current inspection conclusion.`
- vi：`Xem trạng thái thiết bị và lần báo cáo gần nhất trước, sau đó xác nhận các chỉ số chính có hỗ trợ kết luận kiểm tra hiện tại hay không.`

### D. detail_partial

字段级触发条件：

- `freshness.stale == false`
- `status.treeSelection == "selected"`
- `detail.deviceId exists`
- `sourceStatus.overall == "partial" OR detail.sections.length == 0 OR detail.metrics.length == 0 OR detail.status == "unknown"`

mobileShort：

- zh：主句 `详情待补齐` / 副句 `先看缺口`
- en：Main `Detail Partial` / Sub `Check missing parts`
- vi：Câu chính `Chi tiết còn thiếu` / Câu phụ `Xem phần còn thiếu`

full：

- zh：主句 `设备详情：DETAIL_PARTIAL`；副句 `当前选中设备已能打开详情，但状态或关键字段仍未补齐，更适合作为辅助参考，不宜直接下最终判断。`
- en：Main `Device Detail: DETAIL_PARTIAL`; Sub `The selected device detail can already open, but state or key fields are still incomplete. It should be treated as supporting reference rather than final evidence.`
- vi：Câu chính `Chi tiết thiết bị: DETAIL_PARTIAL`; Câu phụ `Thông tin chi tiết của thiết bị đang chọn đã mở được, nhưng trạng thái hoặc các trường chính vẫn chưa đầy đủ. Nên xem đây là tham chiếu hỗ trợ, không phải bằng chứng cuối cùng.`

firstAction：

- zh：`先确认缺的是状态、指标还是最近上报，再决定继续看详情还是先回来源状态排查。`
- en：`Confirm first whether the missing part is state, metrics, or latest report, then decide whether to stay in detail or go back to source-status troubleshooting.`
- vi：`Trước tiên xác nhận phần còn thiếu là trạng thái, chỉ số hay lần báo cáo gần nhất, sau đó mới quyết định tiếp tục xem chi tiết hay quay lại kiểm tra trạng thái nguồn.`

### E. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "failed" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `树详情已降级` / 副句 `先查链路`
- en：Main `Tree/Detail Degraded` / Sub `Check pipeline first`
- vi：Câu chính `Cây/chi tiết suy giảm` / Câu phụ `Kiểm tra chuỗi trước`

full：

- zh：主句 `设备树与详情：DEGRADED`；副句 `当前树或详情来源链路失败，树导航与详情面板都可能不完整，只能作为排障入口，不宜直接演示为完整功能。`
- en：Main `Device Tree & Detail: DEGRADED`; Sub `The current tree or detail source chain has failed, so both the tree and the detail panel may be incomplete. Treat them as troubleshooting entry points, not as complete functionality.`
- vi：Câu chính `Cây và chi tiết thiết bị: DEGRADED`; Câu phụ `Chuỗi nguồn của cây hoặc chi tiết hiện đang lỗi, vì vậy cả điều hướng cây và vùng chi tiết đều có thể không đầy đủ. Hãy xem chúng như điểm vào xử lý sự cố, không phải chức năng hoàn chỉnh.`

firstAction：

- zh：`先恢复 sourceStatus，再判断是树源失败、详情源失败，还是两者都需要补。`
- en：`Recover sourceStatus first, then decide whether the failed part is the tree source, the detail source, or both.`
- vi：`Khôi phục sourceStatus trước, sau đó mới quyết định phần lỗi nằm ở nguồn cây, nguồn chi tiết hay cả hai.`

### F. stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `树详情已陈旧` / 副句 `先刷新再看`
- en：Main `Tree/Detail Stale` / Sub `Refresh before reading`
- vi：Câu chính `Cây/chi tiết đã cũ` / Câu phụ `Làm mới trước khi xem`

full：

- zh：主句 `设备树与详情：STALE`；副句 `当前树和详情基于陈旧数据，节点定位和状态判断更适合作为历史参考，不应直接用于现场刚刚发生的变化判断。`
- en：Main `Device Tree & Detail: STALE`; Sub `The current tree and detail are based on stale data, so node locating and state judgment are better treated as historical reference rather than evidence for very recent site changes.`
- vi：Câu chính `Cây và chi tiết thiết bị: STALE`; Câu phụ `Cây và vùng chi tiết hiện dựa trên dữ liệu đã cũ, vì vậy việc định vị nút và phán đoán trạng thái nên được xem là tham chiếu lịch sử, không phải bằng chứng cho thay đổi vừa xảy ra tại hiện trường.`

firstAction：

- zh：`先刷新树与详情数据，再确认 freshness 恢复后再进行设备定位和状态判断。`
- en：`Refresh tree and detail data first, then proceed with device locating and state judgment only after freshness recovers.`
- vi：`Làm mới dữ liệu cây và chi tiết trước, sau đó chỉ tiếp tục định vị thiết bị và đánh giá trạng thái khi freshness đã hồi phục.`

## 9. 开发建议

- 设备页二期是否适合进入开发：`yes`
- 理由：
  - 一期页面已经稳定承接摘要、骨架和列表，二期只是在现有入口之上增加树和详情，不是重开新页。
  - 旧系统已确认 `GET /api/device/{dbName}/data` 与 `GET /api/device/{dbName}/data/tree` 可返回数据，数据来源方向清楚。
  - 现有合同规划已经明确二期新增：
    - `GET /bff/v1/sites/{siteId}/devices/tree`
    - `GET /bff/v1/sites/{siteId}/devices/{deviceId}`


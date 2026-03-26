# Sprint1 设备总览页 iteration1 文案包 v1

目标：把设备总览页 iteration1 的三语文案和值班口径一次性补齐，覆盖顶部摘要、设备分组/拓扑骨架、真实列表，以及 `degraded / stale / empty / partial` 场景，不包含设备详情和控制操作话术。

## 1. 结论

- 设备总览页 iteration1 是否适合直接给值班/运营演示：`no`
- 理由：当前独立设备页目标路由 [`/devices`](http://127.0.0.1:3001/devices) 仍未落地，访问会回退到登录页；现有 [`/system-overview`](http://127.0.0.1:3001/system-overview) 只承载了设备骨架区，尚未承接真实列表区。

## 2. 页面定位

- 目标业务页：`设备总览页`
- 目标路由：`/devices`
- 当前承载页：`/system-overview`

页面定位说明：

- 顶部摘要负责回答“设备规模是否正常、数据是否新鲜、来源是否可信”。
- 拓扑骨架负责回答“主机/泵/塔主链路是否齐、当前设备分组是否能用于巡检入口”。
- 真实列表负责回答“当前有哪些设备能被逐项查看”，但 iteration1 只承接列表，不承接详情抽屉和控制动作。

## 3. 字段边界

字段级触发条件仅使用：

- `deviceSummary`
- `groups`
- `items`
- `freshness`
- `sourceStatus`

说明：

- `deviceSummary` 对应顶部摘要。
- `groups` 对应分组/拓扑骨架。
- `items` 对应真实设备列表。
- 若运行态 payload 当前只有 `groups` 而无 `items`，应命中 `partial`，而不是误判为 `normal`。

## 4. 页面主标题 / 副标题

主标题：

- zh：`设备总览`
- en：`Device Overview`
- vi：`Tổng quan thiết bị`

副标题：

- zh：`先看设备规模与骨架，再看真实列表是否齐，再决定后续巡检路径。`
- en：`Check device scale and skeleton first, then confirm whether the live list is complete before choosing the next inspection path.`
- vi：`Xem quy mô thiết bị và khung trước, sau đó xác nhận danh sách thực đã đầy đủ hay chưa rồi mới chọn hướng kiểm tra tiếp theo.`

## 5. 分区文案建议

顶部摘要标题：

- zh：`设备摘要`
- en：`Device Summary`
- vi：`Tóm tắt thiết bị`

顶部摘要副标题：

- zh：`用于快速判断设备总量、新鲜度与来源状态。`
- en：`Used to quickly judge total device scale, freshness, and source state.`
- vi：`Dùng để đánh giá nhanh quy mô thiết bị, độ mới dữ liệu và trạng thái nguồn.`

分组 / 拓扑骨架标题：

- zh：`设备骨架`
- en：`Device Skeleton`
- vi：`Khung thiết bị`

分组 / 拓扑骨架副标题：

- zh：`先承接主机、泵、塔主链路和基础分组，不在 iteration1 承接设备控制。`
- en：`Iteration1 carries the main chiller-pump-tower chain and basic grouping only, not device control.`
- vi：`Iteration1 chỉ nhận chuỗi chính máy làm lạnh-bơm-tháp và nhóm cơ bản, chưa nhận phần điều khiển thiết bị.`

真实列表标题：

- zh：`设备列表`
- en：`Device List`
- vi：`Danh sách thiết bị`

真实列表副标题：

- zh：`用于逐项查看当前设备入口；首版只要求可浏览，不承接详情和控制动作。`
- en：`Used to browse live device entries one by one. The first version only needs browsing, not detail or control actions.`
- vi：`Dùng để duyệt từng mục thiết bị thực. Bản đầu chỉ cần xem được danh sách, chưa nhận chi tiết hay thao tác điều khiển.`

## 6. 值班介绍

页面介绍：

- zh：`设备总览页先回答三件事：设备规模是否正常、主链路骨架是否齐、真实设备列表能不能直接作为巡检入口。`
- en：`The device overview page answers three things first: whether device scale looks normal, whether the main skeleton is complete, and whether the live device list is ready to serve as the inspection entry.`
- vi：`Trang tổng quan thiết bị trước tiên trả lời ba việc: quy mô thiết bị có bình thường không, khung chuỗi chính có đầy đủ không, và danh sách thiết bị thực đã sẵn sàng làm điểm vào kiểm tra hay chưa.`

值班顺序：

- zh：`先看 freshness 和 sourceStatus，再看设备摘要和骨架，最后确认真实列表是否齐。`
- en：`Check freshness and sourceStatus first, then read the summary and skeleton, and finally confirm whether the live list is complete.`
- vi：`Xem freshness và sourceStatus trước, sau đó đọc phần tóm tắt và khung, cuối cùng xác nhận danh sách thiết bị thực đã đầy đủ hay chưa.`

## 7. 状态优先级

1. `stale`
2. `degraded`
3. `partial`
4. `empty`
5. `normal`

说明：

- `stale` 优先于其他状态，因为设备页首先要保证不是历史快照。
- `degraded` 表示来源链路已明显失真，优先级高于页面结构不完整。
- `partial` 用于“顶部摘要 / 骨架 / 列表”三块中已有部分可用，但还不足以视为完整设备页。

## 8. 五类状态文案

### A. normal

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `deviceSummary.totalDevices > 0`
- `groups.length > 0`
- `items.length > 0`

mobileShort：

- zh：主句 `设备页已就绪` / 副句 `可直接巡检`
- en：Main `Device Page Ready` / Sub `Ready for inspection`
- vi：Câu chính `Trang thiết bị sẵn sàng` / Câu phụ `Có thể kiểm tra trực tiếp`

full：

- zh：主句 `设备总览：NORMAL`；副句 `顶部摘要、骨架分组和真实列表都已可用，当前页面可直接作为值班巡检入口。`
- en：Main `Device Overview: NORMAL`; Sub `Top summary, skeleton grouping, and the live list are all available, so the page is ready to serve as the duty inspection entry.`
- vi：Câu chính `Tổng quan thiết bị: NORMAL`; Câu phụ `Phần tóm tắt, khung nhóm và danh sách thực đều đã khả dụng, vì vậy trang này có thể được dùng trực tiếp làm điểm vào kiểm tra ca trực.`

firstAction：

- zh：`先看总设备数和骨架分组是否匹配，再沿真实列表逐项进入巡检。`
- en：`Check whether total device count matches the skeleton grouping first, then inspect device entries one by one through the live list.`
- vi：`Trước tiên kiểm tra tổng số thiết bị có khớp với khung nhóm hay không, sau đó đi vào kiểm tra từng mục qua danh sách thực.`

### B. partial

字段级触发条件：

- `freshness.stale == false`
- `deviceSummary.totalDevices > 0`
- `groups.length > 0 OR items.length > 0`
- `sourceStatus.overall == "partial" OR (sourceStatus.overall == "ok" AND (groups.length == 0 OR items.length == 0))`

mobileShort：

- zh：主句 `设备页部分可用` / 副句 `骨架已到位`
- en：Main `Device Page Partial` / Sub `Skeleton is present`
- vi：Câu chính `Trang thiết bị dùng được một phần` / Câu phụ `Khung đã có`

full：

- zh：主句 `设备总览：PARTIAL`；副句 `当前设备摘要或骨架已可用，但真实列表尚未补齐，页面可用于入口判断，不适合作为完整设备页对外演示。`
- en：Main `Device Overview: PARTIAL`; Sub `The device summary or skeleton is already usable, but the live list is still incomplete. The page can be used for entry-level judgment, not as a full device page demo.`
- vi：Câu chính `Tổng quan thiết bị: PARTIAL`; Câu phụ `Phần tóm tắt hoặc khung thiết bị đã dùng được, nhưng danh sách thực vẫn chưa đầy đủ. Trang này có thể dùng để định hướng ban đầu, nhưng chưa phù hợp làm trang thiết bị hoàn chỉnh để demo.`

firstAction：

- zh：`先确认当前缺的是骨架还是列表，再决定继续看骨架还是回退到旧系统核对设备清单。`
- en：`Confirm first whether the missing part is the skeleton or the list, then decide whether to keep using the skeleton or fall back to the legacy system for device inventory checking.`
- vi：`Trước tiên xác nhận phần đang thiếu là khung hay danh sách, sau đó mới quyết định tiếp tục dùng khung hay quay lại hệ cũ để đối soát danh mục thiết bị.`

### C. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "failed" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `设备链路降级` / 副句 `先查来源`
- en：Main `Device Chain Degraded` / Sub `Check sources first`
- vi：Câu chính `Chuỗi thiết bị suy giảm` / Câu phụ `Kiểm tra nguồn trước`

full：

- zh：主句 `设备总览：DEGRADED`；副句 `当前设备来源链路失败或缺失，摘要、骨架和列表都可能不完整，只能作为故障排查入口。`
- en：Main `Device Overview: DEGRADED`; Sub `The device source chain is failed or missing, so summary, skeleton, and list may all be incomplete and should be treated only as troubleshooting entry points.`
- vi：Câu chính `Tổng quan thiết bị: DEGRADED`; Câu phụ `Chuỗi nguồn thiết bị đang lỗi hoặc thiếu, vì vậy phần tóm tắt, khung và danh sách đều có thể không đầy đủ và chỉ nên được dùng như điểm vào xử lý sự cố.`

firstAction：

- zh：`先恢复 sourceStatus，再判断是补设备摘要、骨架还是列表。`
- en：`Recover sourceStatus first, then decide whether the missing piece is the summary, the skeleton, or the list.`
- vi：`Khôi phục sourceStatus trước, sau đó mới quyết định cần bù phần tóm tắt, khung hay danh sách.`

### D. stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `设备页已陈旧` / 副句 `先刷新数据`
- en：Main `Device Page Stale` / Sub `Refresh data first`
- vi：Câu chính `Trang thiết bị đã cũ` / Câu phụ `Làm mới dữ liệu trước`

full：

- zh：主句 `设备总览：STALE`；副句 `当前设备页时间戳已陈旧，摘要、骨架和列表更适合作为历史参考，不应直接用于判断现场刚刚发生的变化。`
- en：Main `Device Overview: STALE`; Sub `The device page timestamp is stale, so summary, skeleton, and list are better treated as historical reference and should not be used alone to judge very recent site changes.`
- vi：Câu chính `Tổng quan thiết bị: STALE`; Câu phụ `Dấu thời gian của trang thiết bị đã cũ, vì vậy phần tóm tắt, khung và danh sách nên được xem như tham chiếu lịch sử, không nên dùng riêng để đánh giá thay đổi vừa xảy ra tại hiện trường.`

firstAction：

- zh：`先刷新设备页并确认 freshness 恢复，再继续看设备规模和列表。`
- en：`Refresh the device page first and confirm freshness has recovered, then continue with device scale and list review.`
- vi：`Làm mới trang thiết bị trước và xác nhận freshness đã hồi phục, sau đó mới tiếp tục xem quy mô thiết bị và danh sách.`

### E. empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `deviceSummary.totalDevices == 0`
- `groups.length == 0`
- `items.length == 0`

mobileShort：

- zh：主句 `暂无设备数据` / 副句 `先核对映射`
- en：Main `No Device Data` / Sub `Verify mapping first`
- vi：Câu chính `Chưa có dữ liệu thiết bị` / Câu phụ `Kiểm tra mapping trước`

full：

- zh：主句 `设备总览：EMPTY`；副句 `当前来源正常但未返回设备摘要、骨架或真实列表，更像设备映射尚未形成，不等于站点没有设备。`
- en：Main `Device Overview: EMPTY`; Sub `Sources are healthy, but device summary, skeleton, and live list are all empty. This usually means the device mapping is not ready yet, not that the site has no equipment.`
- vi：Câu chính `Tổng quan thiết bị: EMPTY`; Câu phụ `Nguồn hiện bình thường nhưng phần tóm tắt, khung và danh sách thực đều đang trống. Điều này thường có nghĩa là mapping thiết bị chưa sẵn sàng, không phải trạm không có thiết bị.`

firstAction：

- zh：`先核对设备汇总、拓扑映射和列表源是否都已产出，再决定是否回退旧系统。`
- en：`Verify first whether device summary, topology mapping, and list source are all produced, then decide whether to fall back to the legacy system.`
- vi：`Trước tiên kiểm tra xem phần tổng hợp thiết bị, mapping topology và nguồn danh sách đã được tạo ra đầy đủ hay chưa, sau đó mới quyết định có quay lại hệ cũ hay không.`

## 9. 当前本地证据

基于 `2026-03-14` 本地核对：

- 目标页 [`/devices`](http://127.0.0.1:3001/devices) 当前不存在，未命中路由后会回退到登录页。
- 当前前端可见的设备承载页仍是 [`/system-overview`](http://127.0.0.1:3001/system-overview)。
- 浏览器内实时请求显示：
  - `dashboard/overview.deviceSummary.totalDevices = 59`
  - `dashboard/overview.freshness.stale = false`
  - `dashboard/overview.sourceStatus.overall = "ok"`
  - `system/topology.groups.length = 59`
  - `system/topology.nodes.length = 5`
  - `system/topology.sourceStatus.overall = "ok"`
- 当前没有已落地的 `items` 列表页承载，因此真实列表区仍缺位。

## 10. 最终建议

- 设备总览页 iteration1 是否适合直接给值班/运营演示：`no`
- 唯一阻塞项：独立设备页的真实列表区尚未落地，当前只能演示摘要与骨架，不能演示完整设备页。


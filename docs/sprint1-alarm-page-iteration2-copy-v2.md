# Sprint1 告警页 iteration2 最终文案收口 v2

目标：把告警页 iteration2 的三语文案正式收口到最终 severity 口径，不再保留混杂表达，并给出“可演示 / 不可演示”的最终值班口径。

## 1. 最终结论

- 是否可直接给值班/运营演示：`no`
- 结论日期：`2026-03-13`
- 原因：
  - 最终文案口径已经收口完成。
  - 但实际页面 [`/alarms`](http://127.0.0.1:3001/alarms) 仍显示：
    - `紧急等级 / 重要等级 / 提示等级`
    - 筛选按钮：`紧急 / 重要 / 提示 / 正常`
    - 列表表头仍为 `状态`
  - 这与最终 severity 口径 `紧急 / 严重 / 一般 / 正常` 不一致，因此当前页面还不适合直接对值班/运营做正式演示。

## 2. Final Severity 最终展示词

告警页对外展示 severity 只允许以下四档：

| unified value | zh | en | vi |
| --- | --- | --- | --- |
| `critical` | `紧急` | `Critical` | `Khẩn cấp` |
| `major` | `严重` | `Major` | `Nghiêm trọng` |
| `minor` | `一般` | `Minor` | `Thông thường` |
| `normal` | `正常` | `Normal` | `Bình thường` |

摘要卡建议展示词：

| unified value | zh | en | vi |
| --- | --- | --- | --- |
| `critical` | `紧急告警` | `Critical Alarms` | `Cảnh báo khẩn cấp` |
| `major` | `严重告警` | `Major Alarms` | `Cảnh báo nghiêm trọng` |
| `minor` | `一般告警` | `Minor Alarms` | `Cảnh báo thông thường` |
| `normal` | `正常告警` | `Normal Alarms` | `Cảnh báo bình thường` |

## 3. 实际页面差异证据

基于 `2026-03-13` 对 [`http://127.0.0.1:3001/alarms`](http://127.0.0.1:3001/alarms) 的页面检查：

- 当前页头摘要卡使用：
  - `紧急等级`
  - `重要等级`
  - `提示等级`
- 当前筛选区使用：
  - `严重度筛选`
  - 按钮：`全部 / 紧急 / 重要 / 提示 / 正常`
- 当前真实列表表头最后一列使用：
  - `状态`
- 当前最近告警流与真实列表中的等级标签使用：
  - `紧急`

结论：

- `critical -> 紧急` 已基本对齐
- `major -> 严重` 尚未落到页面，当前仍是 `重要`
- `minor -> 一般` 尚未落到页面，当前仍是 `提示`
- 列表列名也未从 `状态` 收口到 `等级` / `严重度`

## 4. 旧词禁用清单

以下词汇不应再作为告警页对外用户可见文案：

- zh：
  - `高等级`
  - `中等级`
  - `低等级`
  - `高`
  - `中`
  - `低`
  - `重要`
  - `提示`
- en：
  - `High Severity`
  - `Medium Severity`
  - `Low Severity`
  - `High`
  - `Medium`
  - `Low`
- vi：
  - `Mức cao`
  - `Mức trung bình`
  - `Mức thấp`
  - `Cao`
  - `Trung bình`
  - `Thấp`

说明：

- `重要 / 提示` 在当前页可见，但在最终口径中也应视为待替换旧词。
- 这些词只允许保留在迁移说明、兼容映射或差异核对里，不允许继续作为正式页面话术。

## 5. 最近告警流 + 真实列表并存说明

### 主说明

- zh：`最近告警流看最新触发，真实列表看当前筛选结果。`
- en：`Use the recent stream for the latest triggers, and the real list for the current filtered result.`
- vi：`Dùng luồng cảnh báo gần nhất để xem kích hoạt mới nhất, và dùng danh sách thực để xem kết quả lọc hiện tại.`

### 副说明

- zh：`两块同时出现时，先用最近告警流判断是否集中爆发，再用真实列表做筛选、翻页和逐条核对；不要把最近告警流当完整列表。`
- en：`When both blocks are shown, use the recent stream first to judge whether alarms are clustering, then use the real list for filtering, paging, and row-by-row verification. Do not treat the recent stream as the full list.`
- vi：`Khi cả hai khối cùng xuất hiện, trước tiên dùng luồng cảnh báo gần nhất để xem cảnh báo có đang tập trung bùng lên hay không, sau đó dùng danh sách thực để lọc, phân trang và đối soát từng dòng. Không được xem luồng gần nhất là danh sách đầy đủ.`

## 6. 最终状态文案

### A. list_ready

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length > 0`
- `filters.severity is null`
- `filters.state is null`

mobileShort：

- zh：主句 `列表已就绪` / 副句 `按最终等级看`
- en：Main `List Ready` / Sub `Use final severity`
- vi：Cau chinh `Danh sach da san sang` / Cau phu `Dung muc do cuoi cung`

full：

- zh：主句 `告警页：LIST_READY`；副句 `当前列表已接入、链路正常且数据不陈旧，可直接按“紧急 / 严重 / 一般 / 正常”口径查看告警分布与最近事件。`
- en：Main `Alarm Page: LIST_READY`; Sub `The list is connected, the source chain is healthy, and the data is not stale, so alarms can be reviewed directly with the Critical / Major / Minor / Normal severity model.`
- vi：Cau chinh `Trang bao dong: LIST_READY`; Cau phu `Danh sach da duoc ket noi, chuoi nguon binh thuong va du lieu khong cu, nen co the xem bao dong truc tiep theo muc Khẩn cấp / Nghiêm trọng / Thông thường / Bình thường.`

firstAction：

- zh：`先看紧急与严重告警是否集中在同一来源，再决定是否转趋势页验证。`
- en：`Check whether Critical and Major alarms are clustering on the same source first, then decide whether to move to the trend page for validation.`
- vi：`Trước tiên xem cảnh báo Khẩn cấp và Nghiêm trọng có đang tập trung vào cùng một nguồn hay không, sau đó mới quyết định có chuyển sang trang xu hướng để xác minh hay không.`

### B. list_stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `列表已陈旧` / 副句 `先刷新再讲`
- en：Main `List Is Stale` / Sub `Refresh before briefing`
- vi：Cau chinh `Danh sach da cu` / Cau phu `Lam moi truoc khi thong bao`

full：

- zh：主句 `告警页：LIST_STALE`；副句 `当前列表已接入，但时间戳显示数据陈旧。此时即使看到紧急或严重告警，也应先按历史参考解读，不要直接作为实时判断。`
- en：Main `Alarm Page: LIST_STALE`; Sub `The list is connected, but the timestamp shows stale data. Even if Critical or Major alarms are shown, they should be treated as historical reference first rather than real-time judgment.`
- vi：Cau chinh `Trang bao dong: LIST_STALE`; Cau phu `Danh sach da duoc ket noi, nhung moc thoi gian cho thay du lieu da cu. Ngay cả khi nhìn thấy cảnh báo Khẩn cấp hoặc Nghiêm trọng, vẫn phải xem đó là tham chiếu lịch sử trước, không được dùng trực tiếp cho phán đoán thời gian thực.`

firstAction：

- zh：`先刷新列表或重跑运行态检查，确认 freshness 恢复后再向值班/运营说明当前风险等级。`
- en：`Refresh the list or rerun runtime checks first, then explain the current severity only after freshness recovers.`
- vi：`Lam moi danh sach hoac chay lai kiem tra runtime truoc, sau do chi giai thich muc do hien tai khi freshness da hoi phuc.`

### C. list_degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `列表已降级` / 副句 `先看来源状态`
- en：Main `List Degraded` / Sub `Check source health`
- vi：Cau chinh `Danh sach da giam cap` / Cau phu `Kiem tra tinh trang nguon`

full：

- zh：主句 `告警页：LIST_DEGRADED`；副句 `当前列表链路处于 partial 或 failed。此时紧急 / 严重 / 一般 / 正常分布可能不完整，可用于初筛，不可作为完整依据。`
- en：Main `Alarm Page: LIST_DEGRADED`; Sub `The list pipeline is partial or failed. The Critical / Major / Minor / Normal distribution may be incomplete, so use it for triage but not as a complete basis.`
- vi：Cau chinh `Trang bao dong: LIST_DEGRADED`; Cau phu `Chuoi danh sach hien dang partial hoac failed. Phan bo Khẩn cấp / Nghiêm trọng / Thông thường / Bình thường co the chua day du, vi vay chi nen dung de sang loc ban dau, khong nen xem la can cu day du.`

firstAction：

- zh：`先确认 sourceStatus 是 partial 还是 failed，再决定先补链路还是先人工核对关键告警。`
- en：`Confirm whether sourceStatus is partial or failed first, then decide whether to repair the pipeline or manually verify key alarms.`
- vi：`Xac nhan truoc sourceStatus la partial hay failed, sau do moi quyet dinh sua chuoi nguon hay doi soat thu cong cac bao dong chinh.`

### D. list_empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length == 0`
- `counts.filteredTotal == 0`
- `filters.severity is null`
- `filters.state is null`

mobileShort：

- zh：主句 `当前无告警` / 副句 `不是永久无风险`
- en：Main `No Alarm Now` / Sub `Not risk-free forever`
- vi：Cau chinh `Hien khong co bao dong` / Cau phu `Khong phai an toan mai mai`

full：

- zh：主句 `告警页：LIST_EMPTY`；副句 `当前未见可展示的活动告警，这表示全量列表为空，不等于站点绝对无风险，也不表示“正常告警”正在主导。`
- en：Main `Alarm Page: LIST_EMPTY`; Sub `No active alarm row is currently visible. It means the full list is empty now, not that the site is absolutely risk-free, and not that Normal alarms are dominating.`
- vi：Cau chinh `Trang bao dong: LIST_EMPTY`; Cau phu `Hien chua thay dong bao dong hoat dong nao. Dieu nay co nghia la danh sach day du hien dang trong, khong co nghia la tram hoan toan khong co rui ro, va cung khong co nghia la canh bao Bình thường dang chiem uu the.`

firstAction：

- zh：`先确认没有筛选条件残留，再去趋势页看关键指标是否稳定。`
- en：`Confirm that no filters are still applied first, then check key metric stability on the trend page.`
- vi：`Xac nhan truoc rang khong con bo loc nao dang duoc ap dung, sau do sang trang xu huong de xem cac chi so chinh co on dinh hay khong.`

### E. list_filtered_empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length == 0`
- `counts.filteredTotal == 0`
- `filters.severity is not null OR filters.state is not null`

mobileShort：

- zh：主句 `筛选后为空` / 副句 `先看筛选条件`
- en：Main `Filtered Empty` / Sub `Check filters first`
- vi：Cau chinh `Loc xong khong co du lieu` / Cau phu `Kiem tra bo loc truoc`

full：

- zh：主句 `告警页：LIST_FILTERED_EMPTY`；副句 `当前结果为空，是因为筛选条件下没有命中记录；这不等于全站无告警，只表示当前视图下没有命中“紧急 / 严重 / 一般 / 正常”对应结果。`
- en：Main `Alarm Page: LIST_FILTERED_EMPTY`; Sub `The result is empty because no row matches the current filters. It does not mean the whole site has no alarms; it only means the current view has no matched Critical / Major / Minor / Normal result.`
- vi：Cau chinh `Trang bao dong: LIST_FILTERED_EMPTY`; Cau phu `Ket qua dang trong vi khong co dong nao khop voi bo loc hien tai. Dieu nay khong co nghia la toan tram khong co bao dong; no chi co nghia la o goc nhin hien tai khong co ket qua Khẩn cấp / Nghiêm trọng / Thông thường / Bình thường nao khop.`

firstAction：

- zh：`先口头确认当前 severity/state 筛选条件，再决定保留筛选还是回到全量列表。`
- en：`Confirm the current severity/state filters first, then decide whether to keep the filter or return to the full list.`
- vi：`Truoc tien xac nhan bang loi noi dieu kien loc severity/state hien tai, sau do moi quyet dinh giu nguyen bo loc hay quay lai danh sach day du.`

## 7. 可演示 / 不可演示 一句话值班结论

### 可演示

- zh：`页面口径与最终等级一致，可按正式值班页面演示。`
- en：`The page wording is aligned with the final severity model and can be demonstrated as a formal duty page.`
- vi：`Ngôn ngữ trên trang đã khớp với mô hình severity cuối cùng và có thể demo như một trang trực chính thức.`

### 不可演示

- zh：`页面仍有旧等级词或混用表达，先收口文案再演示。`
- en：`The page still contains old severity terms or mixed wording. Align the copy first before demo.`
- vi：`Trang van con thuat ngu severity cu hoac cach noi bi tron. Hay thong nhat lai copy truoc khi demo.`

## 8. 最终值班口径

- 当前最终值班口径：`不可演示`
- 拍板理由：
  - 文案包已完成
  - 实际页仍未完全替换为最终 severity 词
  - 因此当前更适合做内部联调展示，不适合对值班/运营做正式演示


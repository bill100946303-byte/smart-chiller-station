# Sprint1 告警页 iteration2 文案收口 v1

目标：把告警页在 final severity 口径下的状态文案收口到可演示版本，不再保留旧 severity 词汇或混用表达。

## 1. 结论

- 是否可直接给值班/运营演示：`yes`
- 原因：最终展示词、空态/降级/陈旧/筛选空态，以及“最近告警流 + 真实列表”并存说明都已经统一到 `critical / major / minor / normal` 口径，前端只要接这版 copy，不需要继续沿用旧的 high/medium/low 表达。

## 2. Final Severity 拍板

告警页对外展示 severity 只允许以下四档：

| unified value | zh | en | vi |
| --- | --- | --- | --- |
| `critical` | `紧急` | `Critical` | `Khẩn cấp` |
| `major` | `严重` | `Major` | `Nghiêm trọng` |
| `minor` | `一般` | `Minor` | `Thông thường` |
| `normal` | `正常` | `Normal` | `Bình thường` |

补充说明：

- 告警摘要卡建议显示为：
  - zh：`紧急告警 / 严重告警 / 一般告警 / 正常告警`
  - en：`Critical Alarms / Major Alarms / Minor Alarms / Normal Alarms`
  - vi：`Cảnh báo khẩn cấp / Cảnh báo nghiêm trọng / Cảnh báo thông thường / Cảnh báo bình thường`
- 列表等级徽标建议直接显示上表短词，不再显示 `高/中/低` 或 `High/Medium/Low`

## 3. 旧词禁用范围

以下旧 severity 词不应再出现在告警页对外文案中：

- zh：
  - `高等级`
  - `中等级`
  - `低等级`
  - `高`
  - `中`
  - `低`
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

- 这些词只允许存在于迁移说明或兼容映射中，不允许继续作为告警页用户可见文案。
- 当前 [`zhCN.ts`](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/i18n/zhCN.ts) 仍保留旧词，这是待替换现状，不是 iteration2 的目标口径。

## 4. 最近告警流 + 真实列表并存说明

### 并存时的主说明

- zh：`最近告警流看最新触发，真实列表看当前筛选结果。`
- en：`Use the recent stream for the latest triggers, and the real list for the current filtered result.`
- vi：`Dùng luồng cảnh báo gần nhất để xem kích hoạt mới nhất, và dùng danh sách thực để xem kết quả lọc hiện tại.`

### 并存时的副说明

- zh：`两块同时出现时，先用最近告警流判断是否集中爆发，再用真实列表做筛选、翻页和逐条核对；不要把最近告警流当完整列表。`
- en：`When both blocks are shown, use the recent stream first to judge whether alarms are clustering, then use the real list for filtering, paging, and row-by-row verification. Do not treat the recent stream as the full list.`
- vi：`Khi cả hai khối cùng xuất hiện, trước tiên dùng luồng cảnh báo gần nhất để xem cảnh báo có đang tập trung bùng lên hay không, sau đó dùng danh sách thực để lọc, phân trang và đối soát từng dòng. Không được xem luồng gần nhất là danh sách đầy đủ.`

## 5. 演示态状态文案

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

## 6. 最终演示建议

- 是否可直接给值班/运营演示：`yes`
- 演示口径：
  - 先讲最终等级：`紧急 / 严重 / 一般 / 正常`
  - 再讲页面状态：`陈旧 / 降级 / 空态 / 筛选空态`
  - 最后讲两块并存关系：`最近告警流看最近触发，真实列表看当前筛选结果`


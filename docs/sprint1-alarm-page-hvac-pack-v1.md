# Sprint1 告警页 HVAC 完整包 v1

目标：一次性收口告警页首版的业务价值、运维口径和值班文案，避免后续继续补碎片文案。

## 1. 结论

- 告警页适合作为 Sprint1 第二个页面：`yes`
- 原因：趋势页更适合作为第一个落地页承接“判断链”，告警页更适合作为第二个落地页承接“风险入口 + 分派入口 + 运行态解释”。

## 2. 首版边界

- 本包只覆盖：
  - 页头摘要口径
  - 最近告警列表口径
  - degraded 提示
  - stale 提示
  - 无告警说明
  - 值班第一动作
- 本包不覆盖：
  - 告警详情页
  - 告警状态流转页
  - 进行中 / 已恢复筛选

## 3. 触发条件边界

字段级触发条件仅使用以下字段：

- `counts`
- `latestEvents`
- `freshness`
- `sourceStatus`
- `reasons`
- `advisories`

本版实际主触发仅依赖：

- `counts.total/high/medium/low`
- `latestEvents.length`
- `freshness.stale`
- `freshness.latestTimestamp`
- `freshness.ageHours`
- `sourceStatus.overall`

## 4. 页头与列表固定口径

### 页头主标题建议

- zh: `告警总览`
- en: `Alarm Overview`
- vi: `Tong quan bao dong`

### 页头一句话副标题

- zh: `先看数据是否新鲜，再看最近告警与等级分布。`
- en: `Check freshness first, then review recent alarms and severity mix.`
- vi: `Kiem tra do moi du lieu truoc, sau do xem bao dong gan nhat va phan bo muc do.`

### 最近告警列表口径

- 列表标题：
  - zh: `最近告警`
  - en: `Recent Alarms`
  - vi: `Bao dong gan nhat`
- 列表副标题：
  - zh: `按最新发生时间排序，只作为值班入口，不替代告警详情页。`
  - en: `Sorted by most recent occurrence. Use it as a duty entry point, not a detail page.`
  - vi: `Sap xep theo thoi diem phat sinh moi nhat. Chi dung lam diem vao cho truc, khong thay the trang chi tiet.`

## 5. 四类运行态文案

### A. normal

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `counts.total > 0 OR latestEvents.length > 0`

文案：

- zh 正常态说明：`告警数据新鲜且来源正常，当前页面可作为值班入口查看告警分布与最近事件。`
- en Normal: `Alarm data is fresh and the source chain is healthy. This page can be used as the duty entry for severity mix and recent events.`
- vi Normal: `Du lieu bao dong con moi va chuoi nguon binh thuong. Trang nay co the dung lam diem vao truc de xem phan bo muc do va su kien gan nhat.`

- zh 最近告警列表说明：`列表按发生时间倒序展示最近告警，用来快速判断是否集中在同一设备或同一来源。`
- en Recent list note: `The list is sorted by occurred time in descending order and is used to quickly judge whether alarms cluster on the same device or source.`
- vi Giai thich danh sach: `Danh sach duoc sap xep giam dan theo thoi diem phat sinh, dung de nhin nhanh xem bao dong co tap trung vao cung thiet bi hoac cung nguon hay khong.`

- zh 值班第一动作：`先扫一遍 high/medium/low 分布，再看最近 3 条告警是否集中在同一来源。`
- en First action: `Scan the high/medium/low split first, then check whether the latest three alarms come from the same source.`
- vi Buoc dau tien: `Xem nhanh phan bo high/medium/low truoc, sau do kiem tra 3 bao dong moi nhat co tap trung vao cung mot nguon hay khong.`

### B. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

文案：

- zh degraded 说明：`当前告警链路处于降级态，计数或最近告警列表可能不完整；可以看，但不要当完整放行依据。`
- en Degraded: `The alarm chain is currently degraded. Counts or recent alarm rows may be incomplete, so use this page for triage but not as the sole release basis.`
- vi Degraded: `Chuoi bao dong hien dang o trang thai giam cap. So dem hoac danh sach bao dong gan nhat co the chua day du, vi vay chi nen dung de phan luong, khong nen dung lam can cu phat hanh duy nhat.`

- zh 最近告警列表说明：`最近告警列表可能缺项、缺等级或缺时间，不要把空白直接解读为现场无风险。`
- en Recent list note: `Recent alarm rows may miss entries, severity, or timestamps. Do not read blanks as proof that the site is risk-free.`
- vi Giai thich danh sach: `Danh sach bao dong gan nhat co the thieu ban ghi, thieu muc do hoac thieu thoi gian. Khong duoc hieu o trong la khong co rui ro tai hien truong.`

- zh 值班第一动作：`先确认 sourceStatus 是否为 partial/failed，再决定是先补链路还是先人工核对最近告警。`
- en First action: `Check whether sourceStatus is partial or failed first, then decide whether to fix the chain or manually verify recent alarms.`
- vi Buoc dau tien: `Kiem tra truoc xem sourceStatus co phai la partial hay failed khong, sau do moi quyet dinh sua chuoi nguon hay doi soat thu cong cac bao dong gan nhat.`

### C. stale

字段级触发条件：

- `freshness.stale == true`

文案：

- zh stale 说明：`当前告警数据已陈旧，应先视为历史参考，不要直接据此判断现场已恢复或仍在恶化。stale 不等于系统故障。`
- en Stale: `Alarm data is stale and should be treated as historical reference first. Do not use it alone to claim the site has recovered or worsened. Stale does not mean a system fault.`
- vi Stale: `Du lieu bao dong da cu va truoc tien chi nen xem la tham chieu lich su. Khong duoc chi dua vao no de ket luan hien truong da hoi phuc hay dang xau di. Stale khong dong nghia voi loi he thong.`

- zh 最近告警列表说明：`当前列表更像历史快照，可能与现场状态不同步。`
- en Recent list note: `The current list behaves more like a historical snapshot and may be out of sync with the live site state.`
- vi Giai thich danh sach: `Danh sach hien tai giong anh chup lich su hon va co the khong dong bo voi trang thai song cua hien truong.`

- zh 值班第一动作：`先重跑告警检查或刷新数据，再确认 freshness 恢复后再决定是否派单。`
- en First action: `Rerun the alarm check or refresh the data first, then decide on dispatch only after freshness recovers.`
- vi Buoc dau tien: `Chay lai kiem tra bao dong hoac lam moi du lieu truoc, sau do chi quyet dinh phan cong khi freshness da hoi phuc.`

### D. empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `counts.total == 0`
- `latestEvents.length == 0`

文案：

- zh 无告警时说明：`当前未见活动告警。它表示最近告警流为空，不等于站点绝对无风险。`
- en Empty: `No active alarm is currently visible. It means the recent alarm feed is empty, not that the site is absolutely risk-free.`
- vi Empty: `Hien chua thay bao dong dang hoat dong. Dieu nay co nghia la luong bao dong gan nhat dang trong, khong co nghia la tram hoan toan khong co rui ro.`

- zh 最近告警列表说明：`空列表表示当前没有可展示的活动告警；如需确认风险是否真正解除，仍要结合趋势页。`
- en Recent list note: `An empty list means there is no active alarm row to show now. Use the trend page as well if you need to confirm that the risk has really cleared.`
- vi Giai thich danh sach: `Danh sach trong co nghia la hien tai khong co dong bao dong hoat dong de hien thi. Neu can xac nhan rui ro da thuc su duoc go bo, van phai ket hop voi trang xu huong.`

- zh 值班第一动作：`先确认 freshness/sourceStatus 正常，再结合趋势页看关键指标是否稳定。`
- en First action: `Confirm freshness and sourceStatus are normal first, then check key metrics on the trend page for stability.`
- vi Buoc dau tien: `Xac nhan freshness va sourceStatus binh thuong truoc, sau do xem cac chi so chinh tren trang xu huong co on dinh hay khong.`

## 6. 首版运维口径

- 页头先回答：`当前数据能不能信`
- 告警计数再回答：`风险分布偏向哪里`
- 最近告警列表最后回答：`最近是谁在报、报得是否集中`
- 若 `freshness.stale == true`，优先展示 stale 提示
- 若 `sourceStatus.overall != "ok"` 且未 stale，优先展示 degraded 提示
- 首版不把“无告警”解释成“系统完全正常”，而是解释成“当前未见活动告警”

## 7. Sprint1 拍板建议

- 告警页是否适合作为 Sprint1 第二个页面：`yes`
- 拍板理由：它已经具备 `告警计数 + 最近告警流 + stale/degraded 解释` 这条最小闭环，能在趋势页之后自然接住“发现问题 -> 进入判断”的第二步。


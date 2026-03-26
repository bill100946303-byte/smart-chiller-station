# Sprint1 告警页 iteration1 联调态文案包 v1

目标：在“真实列表已接入、但仍存在 stale / degraded / partial 场景”的前提下，把告警页 iteration1 的三语文案一次性收口，供前端直接接入。

## 1. 结论

- 告警页 iteration1 是否可直接给值班/运营演示：`yes`
- 原因：真实列表链路已经接入，且 `list_ready / list_filtered / list_stale / list_degraded / list_empty` 五类状态都能用字段级条件稳定区分；即使当前站点命中 `list_stale`，也已有明确解释和第一动作，不会把老数据误讲成实时态。

## 2. 当前联调证据

基于 `2026-03-13` 当轮本地 probe 与 list 接口结果：

### 未过滤列表样本

- `items.length = 3`
- `filters.severity = null`
- `filters.state = null`
- `freshness.stale = true`
- `sourceStatus.overall = "ok"`

结论：

- 当前真实站点更接近 `list_stale`
- 含义不是“列表没接通”，而是“列表已接通，但列表按事件时间计算后已陈旧”

### 过滤列表样本（`severity=medium`）

- `items.length = 0`
- `counts.filteredTotal = 0`
- `filters.severity = "medium"`
- `freshness.stale = false`
- `sourceStatus.overall = "ok"`

结论：

- 这类场景更适合 `list_filtered`
- 它不应被误读为 `list_empty`

## 3. 字段边界

字段级触发条件仅使用：

- `items`
- `filters`
- `freshness`
- `sourceStatus`
- `counts`

建议前端适配层补齐以下 `counts` 元信息：

- `counts.total`
  - 含义：当前未过滤总条数
- `counts.filteredTotal`
  - 含义：当前过滤后的总条数

说明：

- 若后端当前只有 `total`，前端可以：
  - `counts.filteredTotal = total`
  - `counts.total` 在未过滤列表下与 `total` 相同；若页面同时保留一份未过滤总数缓存，也可直接复用
- `list_empty` 与 `list_filtered` 的区分，关键不在 `items.length`，而在 `filters` 是否生效

## 4. 状态优先级

1. `list_stale`
2. `list_degraded`
3. `list_filtered`
4. `list_empty`
5. `list_ready`

说明：

- `list_stale` 优先于 `list_filtered`，因为数据时效先于筛选结果解释
- `list_degraded` 优先于 `list_ready`，因为 partial / failed 链路会影响整页可信度
- `list_filtered` 高于 `list_empty`，避免把“筛选后无结果”误讲成“当前没有告警”

## 5. 五类状态文案

### A. list_ready

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length > 0`
- `filters.severity is null`
- `filters.state is null`

mobileShort：

- zh：主句 `列表已就绪` / 副句 `可直接查看`
- en：Main `List Ready` / Sub `Ready to review`
- vi：Cau chinh `Danh sach da san sang` / Cau phu `Co the xem ngay`

full：

- zh：主句 `告警页：LIST_READY`；副句 `当前列表已接入、链路正常且数据不陈旧，可直接用于值班查看最近告警与等级分布。`
- en：Main `Alarm Page: LIST_READY`; Sub `The list is connected, the source chain is healthy, and the data is not stale, so it can be used directly for duty review of recent alarms and severity mix.`
- vi：Cau chinh `Trang bao dong: LIST_READY`; Cau phu `Danh sach da duoc ket noi, chuoi nguon binh thuong va du lieu khong cu, nen co the dung truc tiep de truc va xem bao dong gan nhat cung phan bo muc do.`

firstAction：

- zh：`先看最近 3 条是否来自同一来源，再判断是否需要转到趋势页做验证。`
- en：`Check whether the latest three rows come from the same source first, then decide whether to move to the trend page for validation.`
- vi：`Truoc tien xem 3 dong moi nhat co den tu cung mot nguon hay khong, sau do moi quyet dinh co can chuyen sang trang xu huong de xac minh hay khong.`

### B. list_filtered

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `filters.severity is not null OR filters.state is not null`

mobileShort：

- zh：主句 `筛选结果中` / 副句 `先看筛选条件`
- en：Main `Filtered View` / Sub `Check filters first`
- vi：Cau chinh `Dang xem ket qua loc` / Cau phu `Kiem tra bo loc truoc`

full：

- zh：主句 `告警页：LIST_FILTERED`；副句 `当前列表处于筛选视图，显示的是条件命中的结果；即使结果为空，也不等于全站无告警。`
- en：Main `Alarm Page: LIST_FILTERED`; Sub `The list is in a filtered view and shows only rows matched by the current conditions. Even if the result is empty, it does not mean the whole site has no alarms.`
- vi：Cau chinh `Trang bao dong: LIST_FILTERED`; Cau phu `Danh sach hien dang o che do loc va chi hien thi cac dong khop voi dieu kien hien tai. Ngay ca khi ket qua trong, dieu do khong co nghia la toan tram khong co bao dong.`

firstAction：

- zh：`先口头确认当前 severity/state 筛选条件，再决定是保留筛选查看还是回到全量列表。`
- en：`Confirm the current severity/state filters first, then decide whether to keep the filtered view or return to the full list.`
- vi：`Truoc tien xac nhan bang loi noi dieu kien loc severity/state hien tai, sau do moi quyet dinh giu nguyen che do loc hay quay lai danh sach day du.`

### C. list_stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `列表已陈旧` / 副句 `先刷新再说`
- en：Main `List Is Stale` / Sub `Refresh first`
- vi：Cau chinh `Danh sach da cu` / Cau phu `Lam moi truoc`

full：

- zh：主句 `告警页：LIST_STALE`；副句 `当前列表已接入，但列表时间戳显示数据陈旧，应先按历史参考解读，不要直接据此下实时判断。stale 不等于系统故障。`
- en：Main `Alarm Page: LIST_STALE`; Sub `The list is connected, but its timestamp shows stale data. Treat it as historical reference first and do not use it alone for real-time judgment. Stale does not mean a system fault.`
- vi：Cau chinh `Trang bao dong: LIST_STALE`; Cau phu `Danh sach da duoc ket noi, nhung moc thoi gian cho thay du lieu da cu. Hay xem no la tham chieu lich su truoc va khong duoc chi dua vao no de phan doan thoi gian thuc. Stale khong dong nghia voi loi he thong.`

firstAction：

- zh：`先刷新列表或重跑运行态检查，确认 freshness 恢复后再向值班/运营解释当前风险。`
- en：`Refresh the list or rerun runtime checks first, then explain the current risk to duty or operations only after freshness recovers.`
- vi：`Lam moi danh sach hoac chay lai kiem tra runtime truoc, sau do chi giai thich rui ro hien tai cho truc/van hanh khi freshness da hoi phuc.`

### D. list_degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `列表已降级` / 副句 `先查来源`
- en：Main `List Degraded` / Sub `Check sources first`
- vi：Cau chinh `Danh sach da giam cap` / Cau phu `Kiem tra nguon truoc`

full：

- zh：主句 `告警页：LIST_DEGRADED`；副句 `当前列表链路处于 partial 或 failed，行数、来源列或时间列可能不完整；可用于初筛，不可当完整依据。`
- en：Main `Alarm Page: LIST_DEGRADED`; Sub `The list pipeline is partial or failed, so row count, source, or time columns may be incomplete. Use it for triage, not as a complete basis.`
- vi：Cau chinh `Trang bao dong: LIST_DEGRADED`; Cau phu `Chuoi danh sach hien dang partial hoac failed, vi vay so dong, cot nguon hoac cot thoi gian co the chua day du. Chi nen dung de sang loc ban dau, khong nen xem la can cu day du.`

firstAction：

- zh：`先确认 sourceStatus 是 partial 还是 failed，再决定先补链路还是先人工核对关键告警。`
- en：`Confirm whether sourceStatus is partial or failed first, then decide whether to repair the pipeline or manually verify key alarms.`
- vi：`Xac nhan truoc sourceStatus la partial hay failed, sau do moi quyet dinh sua chuoi nguon hay doi soat thu cong cac bao dong chinh.`

### E. list_empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length == 0`
- `counts.filteredTotal == 0`
- `filters.severity is null`
- `filters.state is null`

mobileShort：

- zh：主句 `当前无告警` / 副句 `不是永久无风险`
- en：Main `No Alarm Now` / Sub `Not zero risk forever`
- vi：Cau chinh `Hien khong co bao dong` / Cau phu `Khong phai khong rui ro mai`

full：

- zh：主句 `告警页：LIST_EMPTY`；副句 `当前未见可展示的活动告警，这表示全量列表为空，不等于站点绝对无风险。`
- en：Main `Alarm Page: LIST_EMPTY`; Sub `No active alarm row is currently visible. It means the full list is empty now, not that the site is absolutely risk-free.`
- vi：Cau chinh `Trang bao dong: LIST_EMPTY`; Cau phu `Hien chua thay dong bao dong hoat dong nao. Dieu nay co nghia la danh sach day du hien dang trong, khong co nghia la tram hoan toan khong co rui ro.`

firstAction：

- zh：`先确认没有筛选条件残留，再去趋势页看关键指标是否稳定。`
- en：`Confirm that no filters are still applied first, then check key metric stability on the trend page.`
- vi：`Xac nhan truoc rang khong con bo loc nao dang duoc ap dung, sau do sang trang xu huong de xem cac chi so chinh co on dinh hay khong.`

## 6. 接入建议

- 页头状态优先使用本包的 5 类状态，不再复用首版“缺列但不阻断”单独态
- 若 `items.length == 0` 且存在筛选条件，优先进入 `list_filtered`
- 若 `items.length == 0` 且无筛选条件，才进入 `list_empty`
- 若 `freshness.stale == true`，无论是否有筛选条件，优先进入 `list_stale`

## 7. 最终建议

- 告警页 iteration1 是否可直接给值班/运营演示：`yes`
- 理由：当前真实站点虽然命中 `list_stale`，但这正好证明 iteration1 文案已经能解释“已接入但不可当实时”的联调态，适合直接演示。


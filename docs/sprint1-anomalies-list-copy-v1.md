# Sprint1 告警列表联调文案包 v1

目标：把告警列表页首版的状态文案和运维动作一次性补全，避免代码落地后继续反复改字。

## 1. 结论

- 列表首版是否适合直接值班使用：`yes`
- 口径：适合作为值班入口页直接使用，但在 `degraded` / `stale` / `field_gap_non_blocking` 三种状态下，只能用于分流和初筛，不能单独替代详情页或完整放行判断。

## 2. 边界

- 仅覆盖告警列表首版文案，不改字段定义。
- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。

## 3. 触发条件边界

字段级触发条件仅使用：

- `list`
- `items`
- `freshness`
- `sourceStatus`

建议前端在列表适配层补齐以下 `list` 元信息：

- `list.total`
- `list.hasMissingOptionalFields`
- `list.missingOptionalFields[]`

说明：

- `list.total` 可直接取列表总条数；如无独立字段，可与 `items.length` 保持一致。
- `list.hasMissingOptionalFields` 用于表示首版列表中存在缺列但不阻断渲染的情况。
- `list.missingOptionalFields[]` 建议只记录首版允许回退的列：
  - `title`
  - `source`
  - `occurredAt`
  - `severity`

## 4. 状态优先级

1. `stale`
2. `degraded`
3. `field_gap_non_blocking`
4. `no_alarm`
5. `normal_with_data`

说明：

- `stale` 优先于其他状态，因为数据时效先于列表内容判断。
- `degraded` 优先于字段缺失，因为链路异常会影响整页可信度。
- `field_gap_non_blocking` 只在链路正常且数据不 stale 时生效。

## 5. 五类状态文案

### A. normal_with_data

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length > 0`
- `list.hasMissingOptionalFields != true`

mobileShort：

- zh：主句 `列表已就绪` / 副句 `可直接值班查看`
- en：Main `List Ready` / Sub `Use for duty now`
- vi：Cau chinh `Danh sach da san sang` / Cau phu `Co the dung de truc ngay`

full：

- zh：主句 `告警列表：NORMAL_WITH_DATA`；副句 `当前列表有数据、来源正常且时效正常，可作为值班入口查看最近告警与等级分布。`
- en：Main `Alarm List: NORMAL_WITH_DATA`; Sub `The list has rows, source health is normal, and freshness is good, so it can be used as the duty entry for recent alarms and severity mix.`
- vi：Cau chinh `Danh sach bao dong: NORMAL_WITH_DATA`; Cau phu `Danh sach hien co du lieu, nguon binh thuong va do moi tot, nen co the dung lam diem vao truc de xem bao dong gan nhat va phan bo muc do.`

firstAction：

- zh：`先看最近 3 条是否来自同一来源，再看高等级告警是否连续出现。`
- en：`Check whether the latest three rows come from the same source first, then see whether high-severity alarms are repeating.`
- vi：`Truoc tien xem 3 dong moi nhat co den tu cung mot nguon hay khong, sau do xem bao dong muc cao co lap lai lien tuc khong.`

### B. no_alarm

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `list.total == 0`
- `items.length == 0`

mobileShort：

- zh：主句 `当前无告警` / 副句 `先看趋势确认`
- en：Main `No Alarm Now` / Sub `Confirm with trends`
- vi：Cau chinh `Hien khong co bao dong` / Cau phu `Can doi chieu voi xu huong`

full：

- zh：主句 `告警列表：NO_ALARM`；副句 `当前未见可展示的活动告警，这表示最近告警流为空，不等于站点绝对无风险。`
- en：Main `Alarm List: NO_ALARM`; Sub `No active alarm row is currently visible. It means the recent alarm feed is empty, not that the site is absolutely risk-free.`
- vi：Cau chinh `Danh sach bao dong: NO_ALARM`; Cau phu `Hien chua thay dong bao dong hoat dong nao. Dieu nay co nghia la luong bao dong gan nhat dang trong, khong co nghia la tram hoan toan khong co rui ro.`

firstAction：

- zh：`先确认 freshness 和 sourceStatus 都正常，再去趋势页看关键指标是否稳定。`
- en：`Confirm freshness and sourceStatus are both normal first, then check the trend page for key metric stability.`
- vi：`Xac nhan freshness va sourceStatus deu binh thuong truoc, sau do sang trang xu huong de xem cac chi so chinh co on dinh khong.`

### C. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `列表降级中` / 副句 `先查链路状态`
- en：Main `List Degraded` / Sub `Check pipeline first`
- vi：Cau chinh `Danh sach dang giam cap` / Cau phu `Kiem tra chuoi nguon truoc`

full：

- zh：主句 `告警列表：DEGRADED`；副句 `当前列表链路处于降级态，列表行数、来源或时间列可能不完整；可以用于初筛，但不要当完整依据。`
- en：Main `Alarm List: DEGRADED`; Sub `The list pipeline is degraded, so row count, source, or time columns may be incomplete. Use it for triage, not as a complete basis.`
- vi：Cau chinh `Danh sach bao dong: DEGRADED`; Cau phu `Chuoi danh sach dang o trang thai giam cap, vi vay so dong, cot nguon hoac cot thoi gian co the chua day du. Chi nen dung de sang loc ban dau, khong nen xem la can cu day du.`

firstAction：

- zh：`先看 sourceStatus 是否为 partial/failed，再决定先补链路还是先人工核对关键告警。`
- en：`Check whether sourceStatus is partial or failed first, then decide whether to repair the pipeline or manually verify key alarms.`
- vi：`Kiem tra truoc xem sourceStatus co phai la partial hay failed khong, sau do moi quyet dinh sua chuoi nguon hay doi soat thu cong cac bao dong chinh.`

### D. stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `列表已陈旧` / 副句 `先刷新再判断`
- en：Main `List Is Stale` / Sub `Refresh before judging`
- vi：Cau chinh `Danh sach da cu` / Cau phu `Lam moi truoc khi danh gia`

full：

- zh：主句 `告警列表：STALE`；副句 `当前列表更像历史快照，应先视为参考信息，不要直接据此判断现场已恢复或仍在恶化。stale 不等于系统故障。`
- en：Main `Alarm List: STALE`; Sub `The current list behaves more like a historical snapshot. Treat it as reference first and do not use it alone to claim the site has recovered or worsened. Stale does not mean a system fault.`
- vi：Cau chinh `Danh sach bao dong: STALE`; Cau phu `Danh sach hien tai giong anh chup lich su hon. Hay xem no la thong tin tham khao truoc va khong duoc chi dua vao no de ket luan hien truong da hoi phuc hay dang xau di. Stale khong dong nghia voi loi he thong.`

firstAction：

- zh：`先重跑列表数据或运行态检查，确认 freshness 恢复后再决定是否派单。`
- en：`Rerun list data or runtime checks first, then decide on dispatch only after freshness recovers.`
- vi：`Chay lai du lieu danh sach hoac kiem tra runtime truoc, sau do chi quyet dinh phan cong khi freshness da hoi phuc.`

### E. field_gap_non_blocking

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `items.length > 0`
- `list.hasMissingOptionalFields == true`

mobileShort：

- zh：主句 `列表字段待补` / 副句 `可看但有缺列`
- en：Main `Fields Need Fill` / Sub `Usable with gaps`
- vi：Cau chinh `Truong danh sach can bo sung` / Cau phu `Van dung duoc nhung con thieu cot`

full：

- zh：主句 `告警列表：FIELD_GAP_NON_BLOCKING`；副句 `当前列表可用，但个别非阻断列存在缺值，应回退为通用文案，不要继续沿用“字段缺口严重”的旧说法。`
- en：Main `Alarm List: FIELD_GAP_NON_BLOCKING`; Sub `The list is usable, but some non-blocking columns are missing. Fallback copy should be used, and the old severe field-gap wording should not be reused.`
- vi：Cau chinh `Danh sach bao dong: FIELD_GAP_NON_BLOCKING`; Cau phu `Danh sach van dung duoc, nhung mot so cot khong gay chan dang bi thieu. Nen dung van ban du phong va khong tiep tuc dung cach noi cu ve thieu truong nghiem trong.`

firstAction：

- zh：`先按回退文案把缺失列展示出来，再看是否影响本轮值班判断。`
- en：`Render the missing columns with fallback copy first, then judge whether the gap affects this duty round.`
- vi：`Truoc tien hien thi cac cot thieu bang van ban du phong, sau do danh gia xem khoang trong nay co anh huong den lan truc nay hay khong.`

## 6. 列表字段缺失回退文案

建议只对以下非阻断列做回退：

- `title`
  - zh: `告警事件`
  - en: `Alarm Event`
  - vi: `Su kien bao dong`
- `source`
  - zh: `未知来源`
  - en: `Unknown Source`
  - vi: `Nguon khong ro`
- `occurredAt`
  - zh: `--`
  - en: `--`
  - vi: `--`
- `severity`
  - zh: `未知`
  - en: `Unknown`
  - vi: `Khong ro`

说明：

- 这些列缺失时不阻断首版列表渲染。
- 不允许前端猜测 `severity` 或根据时间推断状态。

## 7. 最终建议

- 列表首版是否适合直接值班使用：`yes`
- 原因：它已经具备“列表可看 / stale 明示 / degraded 明示 / 缺列回退”这条最小值班链路，足以支持 Sprint1 告警页直接上手。


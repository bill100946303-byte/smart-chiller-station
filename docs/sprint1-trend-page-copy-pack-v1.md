# Sprint1 趋势分析页文案包 v1

目标：把趋势分析页 iteration1 的三语文案、状态口径和值班介绍一次性做完整，避免后面继续补碎片。

## 1. 结论

- 趋势分析页 iteration1 是否适合直接给值班/运营演示：`no`
- 原因：趋势页的文案口径和状态拆分已经齐全，但当前本地页面 [`/trend-analysis`](http://127.0.0.1:3001/trend-analysis) 仍显示 `来源状态：暂无来源数据` 与空图态，没有反映出当前 BFF 已返回的趋势数据，因此还不适合直接对值班/运营演示。

## 2. 字段边界

字段级触发条件仅使用：

- `range`
- `series`
- `stats`
- `freshness`
- `sourceStatus`

说明：

- `range` 作为趋势页唯一显式选择条件，可承担 `filtered empty` 的时间窗语义。
- `series` 与 `stats` 共同决定“有数据”“无有效曲线”“当前窗口为空”。

## 3. 值班介绍

### 页面介绍

- zh：`趋势分析页用来回答三件事：当前变化是不是连续、关键指标有没有同步响应、动作之后曲线有没有变好。`
- en：`The trend page answers three things: whether the change is continuous, whether key metrics respond together, and whether the curve improves after action.`
- vi：`Trang xu hướng trả lời ba việc: biến động có liên tục hay không, các chỉ số chính có phản ứng cùng nhau hay không, và đường xu hướng có tốt lên sau hành động hay không.`

### 值班使用顺序

- zh：`先看时间范围，再看曲线是否有效，最后看统计摘要确认最新/最小/最大。`
- en：`Check the range first, then confirm the curves are valid, and finally read the stats for latest/min/max.`
- vi：`Xem phạm vi thời gian trước, sau đó xác nhận đường xu hướng có hợp lệ hay không, cuối cùng đọc thống kê latest/min/max.`

## 4. 状态优先级

1. `stale`
2. `degraded`
3. `filtered_empty`
4. `no_valid_curves`
5. `normal_with_data`

说明：

- `stale` 优先于其他状态，因为时效先于趋势解读。
- `degraded` 优先于 `normal_with_data`，因为 partial/failed 链路会影响曲线可信度。
- `filtered_empty` 只用于当前时间范围窗口下无结果，不应与“无有效曲线”混用。

## 5. 五类状态文案

### A. normal_with_data

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `series.length > 0`
- `stats.length > 0`
- `any(series[].points.length >= 3)`

mobileShort：

- zh：主句 `趋势已就绪` / 副句 `可直接值班看`
- en：Main `Trend Ready` / Sub `Ready for duty`
- vi：Cau chinh `Xu huong da san sang` / Cau phu `Co the dung de truc`

full：

- zh：主句 `趋势分析：NORMAL_WITH_DATA`；副句 `当前曲线、统计与时效均可用，适合直接判断关键指标是否同步变化以及动作后趋势是否改善。`
- en：Main `Trend Analysis: NORMAL_WITH_DATA`; Sub `Curves, stats, and freshness are all usable, so the page is ready to judge whether key metrics move together and whether the trend improves after action.`
- vi：Cau chinh `Phan tich xu huong: NORMAL_WITH_DATA`; Cau phu `Duong xu huong, thong ke va do moi deu kha dung, nen co the dung trang nay de danh gia xem cac chi so chinh co bien dong dong thoi va xu huong co cai thien sau hanh dong hay khong.`

firstAction：

- zh：`先看当前时间范围内是否有连续曲线，再看最新值和最小/最大是否支持你的判断。`
- en：`Check whether the current range contains continuous curves first, then see whether latest and min/max values support your judgment.`
- vi：`Truoc tien xem trong pham vi hien tai co duong xu huong lien tuc hay khong, sau do xem latest va min/max co ho tro cho phan doan cua ban hay khong.`

### B. stale

字段级触发条件：

- `freshness.stale == true`

mobileShort：

- zh：主句 `趋势已陈旧` / 副句 `先刷新再看`
- en：Main `Trend Is Stale` / Sub `Refresh before reading`
- vi：Cau chinh `Xu huong da cu` / Cau phu `Lam moi truoc khi xem`

full：

- zh：主句 `趋势分析：STALE`；副句 `当前趋势时间戳已陈旧，曲线更适合作为历史参考，不应直接据此判断现场刚刚发生的变化。`
- en：Main `Trend Analysis: STALE`; Sub `The current trend timestamp is stale, so the curves are better treated as historical reference and should not be used alone to judge very recent site changes.`
- vi：Cau chinh `Phan tich xu huong: STALE`; Cau phu `Moc thoi gian xu huong hien tai da cu, vi vay cac duong xu huong nen duoc xem la tham chieu lich su va khong nen duoc dung mot minh de danh gia bien dong rat gan cua hien truong.`

firstAction：

- zh：`先刷新趋势数据，再确认 freshness 恢复后再判断动作是否有效。`
- en：`Refresh the trend data first, then judge whether the action worked only after freshness recovers.`
- vi：`Lam moi du lieu xu huong truoc, sau do chi danh gia hanh dong co hieu qua hay khong khi freshness da hoi phuc.`

### C. degraded

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall != "ok" OR sourceStatus.overall is missing`

mobileShort：

- zh：主句 `趋势已降级` / 副句 `先查链路`
- en：Main `Trend Degraded` / Sub `Check pipeline first`
- vi：Cau chinh `Xu huong da giam cap` / Cau phu `Kiem tra chuoi truoc`

full：

- zh：主句 `趋势分析：DEGRADED`；副句 `当前趋势链路处于 partial 或 failed，曲线和统计可能只有部分可信，可用于方向判断，不应用作完整证据。`
- en：Main `Trend Analysis: DEGRADED`; Sub `The trend pipeline is partial or failed, so curves and stats may be only partially trustworthy. Use them for direction, not as complete evidence.`
- vi：Cau chinh `Phan tich xu huong: DEGRADED`; Cau phu `Chuoi xu huong hien dang partial hoac failed, vi vay duong xu huong va thong ke co the chi dang tin mot phan. Hay dung de nhin huong, khong nen xem la bang chung day du.`

firstAction：

- zh：`先看 sourceStatus 是哪条来源降级，再决定是继续参考现有曲线还是先补链路。`
- en：`Check which source is degraded in sourceStatus first, then decide whether to keep using the current curves or repair the pipeline first.`
- vi：`Truoc tien xem trong sourceStatus la nguon nao dang giam cap, sau do moi quyet dinh se tiep tuc tham khao duong hien tai hay sua chuoi truoc.`

### D. filtered_empty

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `range != "24h"`
- `series.length == 0`
- `stats.length == 0`

mobileShort：

- zh：主句 `当前窗口为空` / 副句 `先看时间范围`
- en：Main `Window Is Empty` / Sub `Check selected range`
- vi：Cau chinh `Cua so hien tai dang trong` / Cau phu `Kiem tra pham vi da chon`

full：

- zh：主句 `趋势分析：FILTERED_EMPTY`；副句 `当前选定时间范围下没有可展示的趋势结果，这更像时间窗口没有命中数据，不等于趋势服务异常。`
- en：Main `Trend Analysis: FILTERED_EMPTY`; Sub `There is no trend result to show in the selected time range. This usually means the window has no matched data, not that the trend service is broken.`
- vi：Cau chinh `Phan tich xu huong: FILTERED_EMPTY`; Cau phu `Khong co ket qua xu huong nao de hien thi trong pham vi thoi gian da chon. Dieu nay thuong co nghia la cua so khong co du lieu phu hop, khong phai dich vu xu huong bi loi.`

firstAction：

- zh：`先切回近24小时确认服务有数据，再决定是否继续看更长时间范围。`
- en：`Switch back to 24h first to confirm the service has data, then decide whether to stay on a longer range.`
- vi：`Truoc tien chuyen ve 24h de xac nhan dich vu co du lieu, sau do moi quyet dinh co tiep tuc dung pham vi dai hon hay khong.`

### E. no_valid_curves

字段级触发条件：

- `freshness.stale == false`
- `sourceStatus.overall == "ok"`
- `series.length > 0 OR stats.length > 0`
- `all(series[].points.length == 0 OR longest_continuous_numeric_run(series[]) < 3) OR all(stats[].latest is null AND stats[].min is null AND stats[].max is null)`

mobileShort：

- zh：主句 `暂无有效曲线` / 副句 `等待连续点`
- en：Main `No Valid Curves` / Sub `Waiting for continuity`
- vi：Cau chinh `Chua co duong hop le` / Cau phu `Dang cho diem lien tuc`

full：

- zh：主句 `趋势分析：NO_VALID_CURVES`；副句 `当前并非完全无数据，而是还没有形成足够连续、可解释的有效曲线，不应过早下趋势结论。`
- en：Main `Trend Analysis: NO_VALID_CURVES`; Sub `This is not a total data outage. The current data has not yet formed curves continuous enough to support a reliable trend conclusion.`
- vi：Cau chinh `Phan tich xu huong: NO_VALID_CURVES`; Cau phu `Day khong phai la mat du lieu hoan toan. Du lieu hien tai van chua hinh thanh duong xu huong du lien tuc de ho tro mot ket luan dang tin cay.`

firstAction：

- zh：`先等待连续有效点补齐，再看统计摘要是否开始稳定。`
- en：`Wait for more continuous valid points first, then check whether the stats begin to stabilize.`
- vi：`Truoc tien cho them diem hop le lien tuc duoc bo sung, sau do xem thong ke co bat dau on dinh hay khong.`

## 6. 当前本地实态

基于 `2026-03-13` 本地检查：

- `dashboard/trends?range=24h` 已返回：
  - `series.length > 0`
  - `stats.length > 0`
  - `freshness.stale = false`
  - `sourceStatus.overall = "partial"`
- 但实际页面 [`/trend-analysis`](http://127.0.0.1:3001/trend-analysis) 仍显示：
  - `来源状态：暂无来源数据`
  - 摘要卡为 `--`
  - 曲线区提示 `数据服务未返回趋势序列`

结论：

- 当前真实联调态更像“页面未正确消费运行态数据”，而不是 pack 本身缺文案。

## 7. 最终建议

- 趋势分析页 iteration1 是否适合直接给值班/运营演示：`no`
- 理由：文案包已齐，但当前页面展示与 BFF 实际返回不一致，还不能作为稳定演示页。


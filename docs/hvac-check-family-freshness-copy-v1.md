# HVAC Check-Family Freshness 值班文案 v1

目标：提供 `fresh / warn / stale` 三态三语播报（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `generatedAt`
- `ageMinutes`
- `state`
- `maxAgeMin`

## 2) 状态优先级

1. `stale`
2. `warn`
3. `fresh`

## 3) 三态文案

### A) fresh

触发条件（字段级，全部满足）：
- 不满足 `stale`
- 不满足 `warn`
- `state == "fresh"`
- `generatedAt` 非空
- `ageMinutes >= 0`
- `ageMinutes <= maxAgeMin * 0.5`

mobileShort：
- zh：主句 `时效新鲜` / 副句 `可继续值班` / 第一动作 `按节奏继续巡检`
- en：Main `Fresh Data` / Sub `Ops can continue` / First action `Continue routine checks`
- vi：Cau chinh `Du lieu con moi` / Cau phu `Co the tiep tuc truc` / Buoc 1 `Tiep tuc kiem tra dinh ky`

full：
- zh：主句 `Check-Family Freshness：FRESH`；副句 `数据时间窗在健康范围内，当前可按标准流程继续执行。`；第一动作 `保持既有巡检节奏，记录本次 generatedAt。`
- en：Main `Check-Family Freshness: FRESH`; Sub `Data is within healthy time window and can follow normal operations.`; First action `Keep normal patrol rhythm and log current generatedAt.`
- vi：Cau chinh `Check-Family Freshness: FRESH`; Cau phu `Du lieu nam trong cua so thoi gian an toan, co the tiep tuc van hanh chuan.`; Buoc 1 `Giu nhip kiem tra thong thuong va ghi lai generatedAt hien tai.`

### B) warn

触发条件（字段级，全部满足）：
- 不满足 `stale`
- `state == "warn"`
- `generatedAt` 非空
- `ageMinutes > maxAgeMin * 0.5`
- `ageMinutes <= maxAgeMin`

mobileShort：
- zh：主句 `时效预警` / 副句 `接近上限` / 第一动作 `先安排重跑窗口`
- en：Main `Freshness Warn` / Sub `Near max age` / First action `Schedule rerun window`
- vi：Cau chinh `Canh bao do tuoi` / Cau phu `Gan nguong toi da` / Buoc 1 `Sap xep cua so chay lai`

full：
- zh：主句 `Check-Family Freshness：WARN`；副句 `数据接近时效上限，建议尽快刷新快照，避免进入 stale。`；第一动作 `先安排最近窗口重跑 check-family，并复核 ageMinutes。`
- en：Main `Check-Family Freshness: WARN`; Sub `Data is approaching max age and should be refreshed soon to avoid stale.`; First action `Schedule the nearest check-family rerun and verify ageMinutes again.`
- vi：Cau chinh `Check-Family Freshness: WARN`; Cau phu `Du lieu dang gan nguong toi da, can lam moi som de tranh stale.`; Buoc 1 `Sap xep chay lai check-family som nhat va kiem tra lai ageMinutes.`

### C) stale

触发条件（字段级，任一满足）：
- `state == "stale"`
- `ageMinutes > maxAgeMin`
- `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `时效陈旧` / 副句 `先刷新再判断` / 第一动作 `立即重跑check-family`
- en：Main `Freshness Stale` / Sub `Refresh before judging` / First action `Rerun check-family now`
- vi：Cau chinh `Do tuoi da cu` / Cau phu `Lam moi truoc khi danh gia` / Buoc 1 `Chay lai check-family ngay`

full：
- zh：主句 `Check-Family Freshness：STALE`；副句 `当前快照已陈旧或时间戳异常，结论可信度下降。`；第一动作 `先重跑 check-family 生成新快照，再继续发布相关判读。`
- en：Main `Check-Family Freshness: STALE`; Sub `Snapshot is stale or timestamp is abnormal, so confidence is reduced.`; First action `Rerun check-family first to generate a fresh snapshot before release interpretation.`
- vi：Cau chinh `Check-Family Freshness: STALE`; Cau phu `Snapshot da cu hoac timestamp bat thuong, do tin cay giam.`; Buoc 1 `Chay lai check-family truoc de tao snapshot moi, roi moi dien giai quyet dinh phat hanh.`

## 4) Stale 说明（防误读）

触发条件（字段级）：
- `state == "stale"` 或 `ageMinutes > maxAgeMin`

专项说明：
- zh：`stale 表示“数据时效过期”，不等于系统故障；请先重跑 check-family 再判断系统状态。`
- en：`Stale means data freshness expired, not necessarily a system fault; rerun check-family before judging system health.`
- vi：`Stale co nghia la du lieu het do tuoi, khong dong nghia loi he thong; hay chay lai check-family truoc khi ket luan.`

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。

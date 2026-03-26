# HVAC Strict Freshness NO-GO Copy v1.0

目标：补齐 strict freshness 触发时的三语 NO-GO 文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

说明：
- 输入文件 `hvac-release-gate-advisories-copy-v1.3.md` 在当前目录未找到。
- 本文案基于 `hvac-release-gate-reasons-copy-v1.2.md` 与 `v19.2-master-status.md` 的现有字段口径生成。

## 1) 字段级触发条件（必需）

- `strictFreshness == true`
- `freshness != "fresh"`

等价枚举：
- `freshness in {"warn","stale","unknown"}`

## 2) 三语 NO-GO 模板（主句）

适用条件：
- `strictFreshness == true && freshness != "fresh"`

### zh
- 主句：`严格时效门禁触发：NO-GO`
- 副句：`当前数据时效未达 fresh，禁止正式放行。`

### en
- Main: `Strict freshness gate triggered: NO-GO`
- Sub: `Current data freshness is not fresh, formal release is blocked.`

### vi
- Cau chinh: `Cong freshness nghiem ngat kich hoat: NO-GO`
- Cau phu: `Do tuoi du lieu khong o muc fresh, chan phat hanh chinh thuc.`

## 3) 三语分态副句（按 freshness 细化）

### A) `freshness == "warn"`
- zh：`时效处于预警区间，严格模式下暂停放行。`
- en：`Freshness is in warning range; strict mode holds release.`
- vi：`Do tuoi dang o muc canh bao; che do strict tam dung phat hanh.`

### B) `freshness == "stale"`
- zh：`数据已陈旧，严格模式下禁止放行。`
- en：`Data is stale; strict mode blocks release.`
- vi：`Du lieu da cu; che do strict chan phat hanh.`

### C) `freshness == "unknown"`
- zh：`时效状态未知，严格模式下禁止放行。`
- en：`Freshness is unknown; strict mode blocks release.`
- vi：`Trang thai do tuoi khong xac dinh; che do strict chan phat hanh.`

## 4) 呈现顺序建议（前端）

1. 先显示主句（NO-GO 结论）。
2. 再按 `freshness` 显示分态副句（warn/stale/unknown）。
3. 若同时存在其他 `reasons`，保留原顺序，不覆盖主阻断结论。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。

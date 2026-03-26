# release-ready-consistency Contract v1

## 1. 目标

把 `release-ready-latest` 与 `check-family`（含 brief 一致性）做联动收口，产出单一可读结论，供值班卡片使用。

## 2. 命令入口

- 同步生成 latest：
  - `npm run sync:release-ready-consistency`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync`
- 独立校验：
  - `npm run check:release-ready-consistency`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check`
- 只读 latest：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-latest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-latest --json`

## 3. latest 文件

- `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-consistency-latest.json`

最小字段：

- `version`
- `generatedAt`
- `decision` (`GO|NO-GO`)
- `exitCode` (`0|1`)
- `reasons[]`
- `advisories[]`
- `steps.releaseReadyLatestCheck`
- `steps.checkFamilyConsistency`
- `steps.checkFamilyOverall`
- `releaseReadyLatest.decision`
- `checkFamilyLatest.overall`
- `checkFamilyBriefLatest.overall`

## 4. 决策规则

`decision=GO` 仅在以下条件同时成立时出现：

1. `check:release-ready-latest-check` 通过
2. `check:check-family-consistency` 通过
3. `releaseReadyLatest.decision == "GO"`
4. `checkFamilyLatest.overall == "PASS"`

否则 `decision=NO-GO`，并在 `reasons[]` 中写入可机读原因 key。

## 5. 错误格式

校验失败统一输出：

`<json_path>: <error_message>`

示例：

- `/decision: must be one of "GO" | "NO-GO"`
- `/steps.checkFamilyConsistency.ok: must be boolean`
- `/reasons: must be empty when decision=GO`

## 6. Selftest

触发：

`RELEASE_READY_CONSISTENCY_SELFTEST=1 npm run check:release-ready-consistency`

覆盖 3 条负例：

1. 缺失 `decision`
2. `steps.checkFamilyConsistency.ok` 类型错误
3. `decision=GO` 但 `reasons` 非空

## 7. 边界声明

- 不影响 `check:contract`。
- 不影响 OpenAPI 主 schema。
- 仅作为值班发布链路收口层，不改业务规则阈值。

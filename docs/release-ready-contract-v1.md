# Release Ready Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --runtime-required=0 --json
```

## 1. 目标

`release-ready` 是发布聚合决策层，统一读取并汇总：

- `verify-gates`
- `release-snapshot`
- `release-snapshot-consistency`
- `release-snapshot-diff`

输出 GO/NO-GO 与阻断原因，便于值班同学单次判定。

## 2. 输出字段（最小契约）

- `version`：字符串，当前 `v1.0`
- `generatedAt`：ISO 时间戳
- `decision`：`GO | NO-GO`
- `exitCode`：`0 | 1`
- `reasons`：字符串数组（阻断）
- `advisories`：字符串数组（非阻断）
- `diffClass`：字符串（顶层兼容字段，等同 `checks.diffClass`）
- `decisionChanged`：`true | false | null`（顶层兼容字段）
- `verifyGatesOk`：布尔（顶层兼容字段）
- `consistencyOk`：布尔（顶层兼容字段）
- `hasPrevious`：`true | false | null`（顶层兼容字段）
- `inputs.strictFreshness`：布尔
- `inputs.runtimeRequired`：布尔
- `checks.verifyGatesRc`：整数
- `checks.releaseSnapshotRc`：整数
- `checks.snapshotConsistencyRc`：整数
- `checks.snapshotDiffRc`：整数
- `checks.snapshotDecision`：字符串
- `checks.consistencyDecision`：字符串
- `checks.diffClass`：字符串
- `checks.decisionChanged`：`true | false | null`
- `checks.verifyGatesRc`：整数（0 代表通过）
- `checks.runtimeReady`：`true | false | null`
- `checks.exampleReady`：`true | false | null`

## 3. 判定规则

`decision=GO` 需同时满足：

1. `verify-gates` 成功
2. `release-snapshot` 结果为 `GO`
3. `release-snapshot-consistency` 结果为 `GO`
4. `release-snapshot-diff` 无执行错误
5. 当 `runtimeRequired=true` 时，`runtimeReady=true`

否则 `decision=NO-GO`。

## 4. 退出码

- `0`：`decision=GO`
- `1`：`decision=NO-GO`

## 5. 产物路径

- JSON：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.json`
- MD：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.md`

## 6. 兼容边界

- 不改 `check:contract` 主门禁
- 不改 OpenAPI 主 schema
- 新字段遵循“只增不减”策略

## 7. 校验脚本配套

- 独立校验：`npm run check:release-ready`
- latest 专项校验：`npm run check:release-ready-latest-check`
- 自检模式：`RELEASE_READY_SELFTEST=1 npm run check:release-ready`
- latest 自检模式：`RELEASE_READY_LATEST_CHECK_SELFTEST=1 npm run check:release-ready-latest-check`
- 命令入口：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check`
- 说明：
  - `release-ready-check` 调用 `check:release-ready`
  - `release-ready-latest-check` 调用 `check:release-ready-latest-check`
- 字段级强校验：
  - `verifyGatesOk` 必须存在且为 `boolean|null`
  - `consistencyOk` 必须存在且为 `boolean|null`
- 说明：校验脚本优先读取 `docs/release-ready-latest.json`；缺失时回退读取 snapshot/diff/consistency 产物，不递归调用 `chiller_ctl.sh`。

## 8. 只读入口（运营）

- 只读查看 latest：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest --json`
- 说明：`release-ready-latest` 不触发新计算，仅输出当前 latest 产物。

## 9. 一键联动入口（运营）

- 一键联动：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --recompute --runtime-required=0`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json`
- 语义：
  1. 默认先读取 `release-ready-latest`（`steps.releaseReady.mode=read_latest`）
  2. 若带 `--recompute`，则先执行 `release-ready`（`steps.releaseReady.mode=recompute`）
  3. 再执行 `release-ready-check`
  4. 最后读取 `release-ready-latest`
- 输出结构：
  - `steps.releaseReady.ok`
  - `steps.releaseReadyCheck.ok`
  - `steps.releaseReadyLatest.ok`
  - 并附带 `releaseReady` 与 `releaseReadyLatest` 子对象，便于值班一次阅读。

## 10. sync 契约校验入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check --selftest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest-check --selftest`
- 说明：
  - 校验对象为 `docs/release-ready-sync-latest.json`
  - 仅校验结构，不触发新计算，不改变放行结果
  - 报错格式统一：`<json_path>: <error_message>`

## 11. brief 摘要入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief --json`
- 说明：
  - 只读 `docs/release-ready-sync-latest.json`
  - 用于值班播报，不触发重算
  - 最小输出：`decision/exitCode/step.*.ok/latestGeneratedAt/latestDecision`

## 12. brief 契约校验入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check --selftest`
- 说明：
  - 校验对象为 `docs/release-ready-sync-latest.json` 的 brief 投影结构
  - 仅校验结构，不触发新计算，不改变放行结果
  - 报错格式统一：`<json_path>: <error_message>`
  - 已纳入 `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates` 第 7 步

## 13. verify-gates 机读输出

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json`
- 输出字段：
  - `overall`：`PASS|FAIL`
  - `passedCount/totalCount`
  - `failedCount/failedGates[]`
  - `gates[]`：`name/ok/exitCode`
- 说明：
  - 文本模式仍保持原样，不影响现有值班流程
  - `--json` 仅增加机读能力，不改变主门禁语义
  - 输出会同步落盘：`docs/verify-gates-latest.json`

## 14. verify-gates 契约校验入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-check --selftest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest-check --selftest`
- 说明：
  - 校验对象为 `docs/verify-gates-latest.json`
  - 仅校验结构，不触发新计算，不改变放行结果
  - 报错格式统一：`<json_path>: <error_message>`
  - 一致性校验：
    - `failedCount == failedGates.length`
    - `failedGates[]` 必须与 `gates[].ok=false` 的门禁名称集合一致
    - `failedGates=[]` 时 `overall` 必须为 `PASS`；非空时必须为 `FAIL`

## 15. verify-gates-latest 只读入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest --json`
- 说明：
  - 只读 `docs/verify-gates-latest.json`
  - 用于值班快速查看上次门禁结果，不触发重算
  - 若文件不存在，先执行 `verify-gates --json`

## 16. release-ready-sync-latest 只读入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest --json`
- 说明：
  - 只读 `docs/release-ready-sync-latest.json`
  - 用于值班快速查看最近一次 sync 联动结果，不触发重算
  - 若文件不存在，先执行 `release-ready-sync --runtime-required=0 --json`

## 17. release-ready-consistency 联动入口

- 命令：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync --json`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-latest`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check`
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check --selftest`
- 说明：
  - 聚合 `release-ready-latest` 与 `check-family consistency` 为单一结论
  - 产物：`docs/release-ready-consistency-latest.json`
  - 不影响 `check:contract` 与 OpenAPI 主 schema

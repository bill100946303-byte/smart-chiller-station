# Release Ready Sync Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json
```

## 1. 目标

`release-ready-sync` 是“发布前同步校验编排”入口。它按固定顺序执行并汇总结果：

1. `release-ready`（生成/刷新 latest 决策产物）
2. `release-ready-check`（执行独立合同校验）
3. `release-ready-latest`（回读 latest 产物，确认可读）

同步结果写入：

- `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`

## 2. 最小输出字段（机读）

以下字段应稳定存在：

- `version`：字符串，当前 `v1.0`
- `generatedAt`：ISO 时间戳
- `decision`：`GO | NO-GO`（由 `steps.releaseReady.ok` 映射）
- `exitCode`：`0 | 1`（三步全成功为 `0`，否则 `1`）
- `inputs.strictFreshness`：布尔
- `inputs.runtimeRequired`：布尔
- `steps.releaseReady.ok`：布尔
- `steps.releaseReady.exitCode`：整数
- `steps.releaseReadyCheck.ok`：布尔
- `steps.releaseReadyCheck.exitCode`：整数
- `steps.releaseReadyLatest.ok`：布尔
- `steps.releaseReadyLatest.exitCode`：整数
- `releaseReady`：对象或 `null`
- `releaseReadyLatest`：对象或 `null`

## 3. Exit Code 语义

- `0`：`release-ready`、`release-ready-check`、`release-ready-latest` 三步全部成功。
- `1`：任一步失败（包含 latest 文件缺失、合同校验失败、上游探针导致 NO-GO）。

判定公式（与实现一致）：

- `exitCode = (readyRc == 0 && checkRc == 0 && latestRc == 0) ? 0 : 1`

## 4. 职责边界（sync vs release-ready-check）

- `release-ready-sync`：编排执行 + 汇总状态 + 产物落盘，负责“是否完成一次同步流程”。
- `release-ready-check`：只做 `release-ready-latest` 合同校验（结构、类型、枚举），不做新计算、不刷新 snapshot。

结论：`sync` 负责“跑流程”，`check` 负责“验合同”；二者可独立执行，也可由 `sync` 内联调用。

## 5. 负例说明（路径化）

统一报错格式建议：

- `<json_path>: <error_message>`

负例 A：步骤失败（`release-ready-check` 失败）

- 现象：`steps.releaseReadyCheck.ok=false` 且 `steps.releaseReadyCheck.exitCode!=0`
- 路径化示例：`/steps/releaseReadyCheck/exitCode: must be 0 when step ok=true`

负例 B：latest 缺失（`release-ready-latest` 读取失败）

- 现象：`steps.releaseReadyLatest.ok=false`，通常伴随 `releaseReadyLatest=null`
- 路径化示例：`/releaseReadyLatest: required object missing (release-ready latest not found)`

## 6. 兼容边界

- 不改 `check:contract` 主门禁。
- 不改 OpenAPI 主 schema。
- 字段演进遵循“只增不减”。

# Release Ready Brief Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief --json
```

## 1. 目标

`release-ready-brief` 是值班摘要入口，基于已有 `release-ready-sync` latest 产物输出“可播报的最小决策信息”。

- 只读来源：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`
- 不触发重算，不触发探针，不写回新文件

## 2. stdout 文本契约（无 `--json`）

输出为按行 `key=value` 的纯文本，最小字段如下：

- `decision`
- `exitCode`
- `step.releaseReady.ok`
- `step.releaseReady.mode`
- `step.releaseReadyCheck.ok`
- `step.releaseReadyLatest.ok`
- `latest.decision`
- `latest.generatedAt`
- `latest.reasons`
- `latest.advisories`

说明：

- `latest.reasons` 与 `latest.advisories` 在空数组时输出 `none`。
- 字段缺失时使用兜底值（如 `unknown`、`false`、`1`），保证值班终端可稳定渲染。

## 3. `--json` 字段契约

输出最小 JSON 字段如下：

- `decision`: string (`"GO" | "NO-GO"`，缺省兜底 `"NO-GO"`)
- `exitCode`: integer (`0 | 1`，缺省兜底 `1`)
- `stepReleaseReadyOk`: boolean
- `stepReleaseReadyMode`: string (`"read_latest" | "recompute" | "unknown"`)
- `stepReleaseReadyCheckOk`: boolean
- `stepReleaseReadyLatestOk`: boolean
- `latestDecision`: string
- `latestGeneratedAt`: string
- `reasons`: string[]
- `advisories`: string[]

## 4. 失败语义

- 参数非法：返回码 `2`，格式 `"[FAIL] Unknown release-ready-brief arg: <arg>"`
- 来源文件缺失：返回码 `1`，并提示先执行：
  - `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json`

## 5. 与 `check:contract` 的关系（解耦）

- `release-ready-brief` 不属于 OpenAPI/BFF 主合同校验链路。
- 不依赖、也不触发 `npm run check:contract`。
- 本文档仅定义运维摘要输出契约，不改变现有主门禁判定。

## 6. 兼容边界

- 不改 OpenAPI 主 schema。
- 不改 `check:contract` 主断言。
- 字段演进遵循“只增不减”，新增字段不破坏既有最小字段消费。

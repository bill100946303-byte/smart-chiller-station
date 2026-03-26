# Check Family Contract Index v1

## 1. 范围

本文汇总 `apps/chiller-bff/package.json` 中 `check:*` 家族脚本的契约入口、输入、输出和副作用，供主控与值班统一消费。

## 2. 统一约定

- 失败信息统一建议按路径格式解析：`<json_path>: <error_message>`。
- 正常通过时，脚本输出单行 `... passed` 或简短统计摘要。
- `--selftest`（若支持）仅做内存负例注入，不修改业务运行时代码。

## 3. 脚本矩阵

| npm script | chiller_ctl 入口（若有） | 主要输入 | 输出格式 | 是否会重算/写入 |
| --- | --- | --- | --- | --- |
| `check:contract` | 无直接别名 | `openapi/bff-v1.yaml` + `openapi/examples/*.json` +（可选）运行态探针 | 文本（PASS/FAIL + 明细）；失败逐条路径化 | 不重算业务；会写 `openapi/examples/source-key-scan-report.json`、`openapi/examples/real-link-ready-probe-report.json` |
| `check:source-keys` | 无直接别名 | `openapi/bff-v1.yaml` + `docs/source-status-key-dictionary-v1.2.json` + `openapi/examples/source-status-summary-cases.json` | 文本摘要 + warning/error | 不重算业务；会写 `openapi/examples/source-key-consistency-report.json` |
| `check:acceptance-report` | `accept-contract` | `docs/v19.2-acceptance-report.json`（可由 `ACCEPTANCE_REPORT_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新报告 |
| `check:status-json` | 无直接别名（脚本内调用 `status-json` 三种模式） | `scripts/chiller_ctl.sh status-json` / `--live` / `--live --strict-freshness` 的 stdout JSON | 文本（按 mode 校验结果） | 不重算业务；会触发 live 读取流程，可能刷新 `docs/release-gate-latest.json` |
| `check:release-snapshot` | 间接用于 `verify-gates` | `docs/release-snapshot-latest.json`（可由 `RELEASE_SNAPSHOT_PATH` 覆盖；缺省回退 legacy preflight 文件） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:release-snapshot-index` | 间接用于 `verify-gates` | `docs/release-snapshot-index-latest.json`（可由 `RELEASE_SNAPSHOT_INDEX_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:release-snapshot-diff` | 间接用于 `verify-gates` | `docs/release-snapshot-diff-latest.json`（可由 `RELEASE_SNAPSHOT_DIFF_PATH` 覆盖；必要时内存派生） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:release-ready` | `release-ready-check` / `release-ready-latest-check` | 优先 `docs/release-ready-latest.json`，缺失时回退 snapshot/diff/consistency latest | 文本（passed/source 或路径化失败） | 不重算，不写新文件 |
| `check:release-ready-consistency` | `release-ready-consistency-check` | `docs/release-ready-consistency-latest.json`（由 `sync:release-ready-consistency` 生成） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:release-ready-sync` | `release-ready-sync-check` / `release-ready-sync-latest-check` | `docs/release-ready-sync-latest.json`（可由 `RELEASE_READY_SYNC_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:release-ready-brief` | `release-ready-brief-check` | `docs/release-ready-sync-latest.json` 的 brief 投影（可由 `RELEASE_READY_SYNC_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:verify-gates` | `verify-gates-check` / `verify-gates-latest-check` | `docs/verify-gates-latest.json`（可由 `VERIFY_GATES_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:check-family` | `check-family-check` | `docs/check-family-latest.json`（可由 `CHECK_FAMILY_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:check-family-freshness` | `check-family-freshness-check` | `docs/check-family-latest.json` + `MAX_AGE_MIN`（默认 60） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:check-family-brief` | `check-family-brief-check` | `docs/check-family-brief-latest.json`（可由 `CHECK_FAMILY_BRIEF_PATH` 覆盖） | 文本（passed 或路径化失败） | 不重算，不写新文件 |
| `check:check-family-consistency` | `check-family-consistency-check` | `docs/check-family-latest.json` + `docs/check-family-brief-latest.json` | 文本（passed 或路径化失败） | 不重算，不写新文件 |

## 4. `--selftest` 覆盖

- 支持 `--selftest` 的入口：`release-ready-latest-check`、`release-ready-sync-check`、`release-ready-brief-check`、`verify-gates-check`（含 latest-check 同义入口）以及部分 npm 直跑脚本环境变量模式。
- `check:status-json`、`check:source-keys`、`check:contract` 当前无统一 `--selftest` CLI 参数。

## 5. 与 `check:contract` 解耦（统一声明）

- `check:contract` 是 BFF OpenAPI + examples 主合同门禁；其通过/失败不自动代表其他 `check:*` 子门禁状态。
- 其余 `check:*` 为独立契约门禁，可单独执行、单独失败、单独修复，不改变 OpenAPI 主 schema 判定规则。
- 新增或调整任一 `check:*` 脚本时，不得隐式放宽 `check:contract` 主断言；若存在联动，需在文档显式声明。

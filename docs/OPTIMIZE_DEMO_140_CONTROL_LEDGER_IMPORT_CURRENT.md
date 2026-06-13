# 140 控制震荡台账导入说明

更新时间：2026-06-13

## 1. 结论

`/optimize-demo` 现场复核链路已新增控制震荡台账导入器，用于把现场 SCADA/PLC 导出的 CSV 归一到三张标准台账：

1. 控制命令/反馈高频趋势
2. 设备启停事件台账
3. PID/死区/延时参数台账

该导入器只做字段规范化、缺口校验和报告输出，不自动改 PID，不自动启停设备，不写真实 PLC，不创建 shadow 执行单。

## 2. 命令

默认命令：

```bash
npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers
```

安全正式导入 gate：

```bash
npm --prefix apps/chiller-bff run promote:optimize-demo-140-field-data-ledgers
```

`promote` 会读取 `docs/optimize-demo-140-field-data-preflight-latest.json` 中的三张现场 CSV 路径。只有预检为 `FIELD_DATA_PREFLIGHT_READY` 时才执行正式导入并覆盖 latest；否则输出 `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`，不覆盖当前正式台账证据。

READY 路径自检：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-control-ledger-import
```

该自检会在 `tmp/` 下生成样例 CSV，验证导入器能把中文/英文表头、启停事件、PID/死区/延时参数归一成 `CONTROL_LEDGER_IMPORT_READY`。自检输出为 `ready-smoke` 文件，不覆盖默认 latest，不作为现场实测证据。

现场 CSV 预检：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-field-data-preflight
```

预检默认读取以下现场投放目录，不覆盖正式 latest 导入报告：

- `docs/field-data/optimize-demo-140/control-command-feedback.csv`
- `docs/field-data/optimize-demo-140/start-stop-event.csv`
- `docs/field-data/optimize-demo-140/control-parameter.csv`

现场投放说明见 `docs/field-data/optimize-demo-140/README.md`。该目录只应放真实现场导出 CSV，不要放空 CSV 或仅表头占位文件。

也可以用环境变量指向现场导出的实际文件：

```bash
OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV=/path/to/control-trend.csv \
OPTIMIZE_DEMO_START_STOP_INPUT_CSV=/path/to/start-stop-events.csv \
OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV=/path/to/control-parameters.csv \
npm --prefix apps/chiller-bff run check:optimize-demo-140-field-data-preflight
```

只有预检达到 `FIELD_DATA_PREFLIGHT_READY` 后，才建议运行 `promote:optimize-demo-140-field-data-ledgers` 覆盖 `docs/optimize-demo-140-control-ledger-import-latest.json`。

默认输入为现场复核包生成的三张模板示例：

- `docs/optimize-demo-140-control-command-feedback-template-latest.csv`
- `docs/optimize-demo-140-start-stop-event-template-latest.csv`
- `docs/optimize-demo-140-control-parameter-template-latest.csv`

使用现场导出 CSV 时，替换输入环境变量：

```bash
OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV=/path/to/control-trend.csv \
OPTIMIZE_DEMO_START_STOP_INPUT_CSV=/path/to/start-stop-events.csv \
OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV=/path/to/control-parameters.csv \
npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers
```

## 3. 输出

导入报告：

- `docs/optimize-demo-140-control-ledger-import-latest.json`
- `docs/optimize-demo-140-control-ledger-import-latest.md`
- `docs/optimize-demo-140-field-data-preflight-latest.json`，现场 CSV 预检报告，不覆盖正式 latest
- `docs/optimize-demo-140-field-data-preflight-latest.md`，现场 CSV 预检报告，不覆盖正式 latest
- `docs/optimize-demo-140-control-ledger-field-preflight-import-latest.json`，预检导入器隔离输出
- `docs/optimize-demo-140-control-ledger-field-preflight-import-latest.md`，预检导入器隔离输出
- `docs/optimize-demo-140-field-data-promote-latest.json`，预检 READY 后正式导入 gate 报告
- `docs/optimize-demo-140-field-data-promote-latest.md`，预检 READY 后正式导入 gate 报告
- `docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.json`，仅用于 READY 路径自检
- `docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.md`，仅用于 READY 路径自检

规范化 CSV：

- `docs/optimize-demo-140-control-command-feedback-normalized-latest.csv`
- `docs/optimize-demo-140-start-stop-event-normalized-latest.csv`
- `docs/optimize-demo-140-control-parameter-normalized-latest.csv`

## 4. 状态口径

| 状态 | 含义 | 是否可作为高置信诊断证据 |
| --- | --- | --- |
| `CONTROL_LEDGER_IMPORT_READY` | 现场导出 CSV 可读，必填字段齐全，无阻断项 | 可以进入控制震荡证据窗口 |
| `CONTROL_LEDGER_IMPORT_PARTIAL` | 字段可读，但存在样例输入、缺回退值、缺审批人或采样周期不足等警告 | 只能方向性复核 |
| `CONTROL_LEDGER_IMPORT_BLOCKED` | 缺文件、CSV 无法解析、必填字段缺失或启停事件类型非法 | 不能作为诊断证据 |

现场预检状态：

| 状态 | 含义 | 下一步 |
| --- | --- | --- |
| `FIELD_DATA_PREFLIGHT_READY` | 三张现场 CSV 已可读取，字段可映射，导入器无 blocker/warning | 运行正式导入命令 |
| `FIELD_DATA_PREFLIGHT_PARTIAL` | 文件可读但仍有 warning，例如采样周期不足、缺回退值或审批人 | 先人工复核，必要时补齐后再正式导入 |
| `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS` | 约定路径或环境变量指向的现场 CSV 不存在 | 把现场导出文件放到约定路径或补环境变量 |
| `FIELD_DATA_PREFLIGHT_BLOCKED` | CSV 解析失败、必填字段缺失或事件类型非法 | 修正现场导出格式后重跑预检 |

正式导入 gate 状态：

| 状态 | 含义 | 是否覆盖正式 latest |
| --- | --- | --- |
| `FIELD_DATA_PROMOTE_READY` | 已基于预检 READY 的现场 CSV 完成正式导入 | 是 |
| `FIELD_DATA_PROMOTE_PARTIAL` | 已导入但仍有 warning，不能高置信使用 | 是，但仍需人工复核 |
| `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT` | 预检报告不存在或未 READY | 否 |
| `FIELD_DATA_PROMOTE_BLOCKED` | 预检 READY 但导入失败或输入文件异常 | 否或导入未成功 |

## 5. 现场数据要求

控制命令/反馈高频趋势：

- 采样周期建议 `<= 60s`。
- 同一时间轴至少包含命令值和反馈值。
- 需要点位编码、点位名称、设备编号、信号角色、数值、单位、质量标记。

设备启停事件台账：

- 事件类型必须归一为 `start` 或 `stop`。
- 需要事件时间、设备编号、前后状态、命令来源、是否有告警。
- 最好补充事件前运行分钟和事件前停机分钟，用于判断最小运行/停机时间。

控制参数台账：

- 需要 PID、死区、延时、斜率、最小运行/停机时间等关键参数。
- 如果只是现场资料回填，`approvedBy` 和 `rollbackValue` 可以为空，但导入器会保留警告。
- 如果未来用于参数调整依据，必须补审批人、回退值、变更单号，并另走人工审批和 PLC 本地保护确认。

## 6. 边界

- 导入结果只进入诊断证据链，不进入真实控制链。
- 不把参数台账解释为“建议立即修改 PID”。
- 不把启停事件台账解释为“建议立即启停主机”。
- 不把命令/反馈偏差直接判定为 PLC 故障，只输出复核线索。

## 7. Advisor 接入口径

`/sites/140/optimize` 会只读读取 `docs/optimize-demo-140-control-ledger-import-latest.json`，并把结果写入：

- `operationalDiagnosticsAdvisor.items[].current.ledgerEvidence`
- `operationalDiagnosticsAdvisor.summary.controlOscillation.ledgerEvidenceStatus`
- `operationalDiagnosticsAdvisor.summary.controlOscillation.ledgerAcceptedRows`

接入规则：

- `CONTROL_LEDGER_IMPORT_READY` 且输入为现场导出 CSV 时，命令/反馈和启停事件缺口可从 `gap` 降为 `watch`，表示已有证据窗口可复核。
- `CONTROL_LEDGER_IMPORT_PARTIAL` 只展示台账状态和接受行数，不提升为高置信控制结论。
- `CONTROL_LEDGER_IMPORT_BLOCKED` 不能作为诊断证据。
- `FIELD_DATA_PREFLIGHT_READY` 只表示现场 CSV 已通过预检，可执行正式导入；在正式导入 latest 前，不提升 `ledgerEvidence.usableForDiagnosis`。
- 即使状态为 `READY`，Advisor 也只做只读证据提示，不自动改 PID、不自动启停设备、不写真实 PLC。
- `/optimize-demo` 控制震荡卡片会同时显示“台账导入”“现场CSV预检”和“正式导入Gate”：台账导入是当前正式诊断证据，现场CSV预检是导入前门禁，正式导入Gate 是 promotion 是否已把现场 CSV 写入 latest 的记录。

## 8. READY 路径自检边界

- `check:optimize-demo-140-control-ledger-import` 使用 `tmp/` 下自动生成的样例 CSV，只验证导入器 READY 路径。
- 自检输出 `ready-smoke` 报告，不覆盖默认 `docs/optimize-demo-140-control-ledger-import-latest.json`。
- `/sites/140/optimize` 默认读取 latest 报告，不读取 ready-smoke；因此样例自检不会让 Advisor 误认为已有现场实测证据。
- 真实交付时必须用现场 SCADA/PLC 导出 CSV 重新运行导入器。

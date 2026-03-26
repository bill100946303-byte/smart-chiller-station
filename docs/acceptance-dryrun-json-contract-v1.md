# Acceptance Dry-Run JSON Contract v1.0

## 1. 目的与边界
- 目的：定义验收脚本 dry-run 模式的最小 JSON 输出契约，供主控/自动化程序机读。
- 边界：
  - 不修改 `apps/chiller-bff/openapi/bff-v1.yaml`。
  - 不影响 `npm run check:contract` 与 `npm run check:acceptance-report` 现有门禁。
  - dry-run 仅用于预览与判定，不作为正式验收归档。

## 2. 输出位置约束
- dry-run **不得覆盖** canonical 文件：
  - `docs/v19.2-acceptance-report.json`
  - `docs/v19.2-acceptance-report.md`
- dry-run 输出仅允许：
  - `stdout`（首选）
  - 临时文件（例如 `/tmp/*.json`）

## 3. 最小字段契约（必须）
```json
{
  "mode": "dry-run",
  "generatedAt": "2026-03-12T05:41:41Z",
  "overallPass": false,
  "runtimeUnavailable": true,
  "gates": {
    "summary": {
      "entryOk": true,
      "contractOk": true,
      "stackOk": false,
      "readinessOk": false,
      "badgeOk": false,
      "endpointOverallOk": false
    }
  }
}
```

## 4. 字段约束
- `mode`
  - 类型：string
  - 固定值：`"dry-run"`
- `generatedAt`
  - 类型：string
  - 建议：UTC ISO-8601 时间戳
- `overallPass`
  - 类型：boolean
- `runtimeUnavailable`
  - 类型：boolean
  - 含义：运行态探测是否整体不可用（网络/端口层不可达）
- `gates.summary`
  - 类型：object
  - 最小子字段（均为 boolean）：
    - `entryOk`
    - `contractOk`
    - `stackOk`
    - `readinessOk`
    - `badgeOk`
    - `endpointOverallOk`

## 5. 判定语义建议
- `overallPass` 建议与 `gates.summary` 联动计算，不直接依赖自由文本日志。
- 当 `runtimeUnavailable=true` 时，允许 `overallPass=false` 且输出原因到日志；该状态用于诊断，不写 canonical。

## 6. 兼容策略
- 允许新增字段（向后兼容），但不得删除本文件定义的最小字段集。
- 读取方应仅依赖本契约字段，不依赖脚本日志文案。

# Release-Gate Output Contract v1.0

## 1. 目标与边界
- 目标：为 `scripts/chiller_ctl.sh release-gate` 定义稳定机读输出契约。
- 边界：
  - 仅文档层定义，不修改主 OpenAPI（`bff-v1`）。
  - 不改变 `npm run check:contract` 现有门禁行为。

## 2. 标准 stdout 结构
`release-gate` 命令输出为固定标题 + 5 行 `key=value`：

```text
== Release Gate ==
contractOk=true|false
canonicalExists=true|false
canonicalOverallPass=true|false
decision=GO|NO-GO
exitCode=0|1
```

## 3. 必备字段（机读）
- `contractOk`
  - 类型：boolean 字符串（`true|false`）
  - 含义：`accept-contract`（即 `npm run check:acceptance-report`）是否通过。
- `canonicalExists`
  - 类型：boolean 字符串
  - 含义：`docs/v19.2-acceptance-report.json` 是否存在。
- `canonicalOverallPass`
  - 类型：boolean 字符串
  - 含义：canonical 报告中的 `.overallPass` 值（不存在或解析失败时视作 `false`）。
- `decision`
  - 类型：枚举字符串：`GO | NO-GO`
- `exitCode`
  - 类型：整数字符串：`0 | 1`

## 4. 判定规则
- `decision=GO` 的充要条件：
  - `contractOk=true`
  - `canonicalExists=true`
  - `canonicalOverallPass=true`
- 否则 `decision=NO-GO`。
- `exitCode` 与 `decision` 一致：
  - `GO -> exitCode=0`
  - `NO-GO -> exitCode=1`

## 5. 退出码语义（正式）
- 进程退出码 `0`：允许放行（release gate pass）。
- 进程退出码 `1`：禁止放行（release gate fail）。

## 6. 机读建议
- 解析方式：按行拆分后匹配 `^[a-zA-Z]+=` 的键值行。
- 建议消费键集合：`contractOk canonicalExists canonicalOverallPass decision exitCode`。
- 不应依赖标题行（`== Release Gate ==`）作为判定依据。

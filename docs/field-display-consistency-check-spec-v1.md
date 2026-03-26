# Field Display Consistency Check Spec v1

目标：为 `field-display-dictionary` 建立自动校验标准，保障前端展示层与字段口径一致。  
边界：不改字段语义，不改 `null_strategy`，不新增业务字段。

## 1. 适用范围

- 被校验文件：
  - `docs/field-display-dictionary-v1.json`
  - `docs/field-dictionary.json`
- 本规范仅定义“展示层一致性”校验，不定义业务计算逻辑校验。

## 2. 校验分级

- `blocking`（阻塞）：必须修复，否则不可发布。
- `warning`（警告）：可发布但需记录风险，建议在下个迭代修复。

建议发布门禁：

- `blocking_count == 0` 才允许通过。
- `warning_count > 0` 允许通过，但需输出风险清单。

## 3. 数据结构前置约定

### 3.1 field-display 结构（必需）

`fields[]` 每项必须包含：

- `fieldKey`
- `displayName.zh/en/vi`
- `unitDisplay.zh/en/vi`
- `shortHint.zh/en/vi`
- `semanticNote`
- `compareConstraint`

`nonBusinessDirectFields[]` 每项必须包含：

- `fieldKey`
- `riskLevel`（`P0` 或 `P1`）
- `whyNotDirect`
- `frontendAlternative`

### 3.2 基础字段源

- 基础字段集合来自 `field-dictionary.json.fields[].field_name`。
- 不允许在 `fields[]` 中出现未定义业务字段。

## 4. 检查项清单

| 检查ID | 检查项 | 规则 | 失败分级 |
| --- | --- | --- | --- |
| `FDCS-001` | 文件可读取与 JSON 可解析 | 两个输入 JSON 文件必须存在且可解析。 | `blocking` |
| `FDCS-002` | 字段存在性（展示字段） | `field-display.fields[*].fieldKey` 必须全部存在于 `field-dictionary.fields[].field_name`。 | `blocking` |
| `FDCS-003` | 不新增业务字段 | `field-display.fields[]` 不得出现任何 `field-dictionary` 未定义 key。 | `blocking` |
| `FDCS-004` | 三语完整性 | `displayName/unitDisplay/shortHint` 的 `zh/en/vi` 均为非空字符串。 | `blocking` |
| `FDCS-005` | 单位一致性 | 单位展示必须与字段单位口径一致（按第 5 节映射规则）；禁止把 `kWh` 展示成 `kW`。 | `blocking` |
| `FDCS-006` | shortHint 长度预算 | 每个 `shortHint.{lang}` 建议 `<=24` 字符；`25-32` 记 `warning`，`>32` 记 `blocking`。 | `warning` / `blocking` |
| `FDCS-007` | 不可直出字段清单完整 | 必须存在 `nonBusinessDirectFields[]`，且至少包含 `legacy.totalElectricity`、`cooling_tower_power_kw`。 | `blocking` |
| `FDCS-008` | 不可直出字段保护信息完整 | `nonBusinessDirectFields[]` 每项必须有 `riskLevel/whyNotDirect/frontendAlternative`。 | `blocking` |
| `FDCS-009` | 受保护字段展示防误导 | `cooling_tower_power_kw` 的展示语义必须显式包含“组合”（`displayName.zh` 或 `semanticNote` 命中即可）。 | `blocking` |
| `FDCS-010` | 历史高风险别名禁直出 | `legacy.totalElectricity` 不得出现在 `fields[]` 业务展示列表。 | `blocking` |
| `FDCS-011` | compareConstraint 完整性 | 每个字段必须提供非空 `compareConstraint`，用于跨站点比较前置提示。 | `warning` |

## 5. 单位一致性判定规则（FDCS-005）

默认按 `field-dictionary.unit` 与 `unitDisplay` 对齐：

| field-dictionary unit | 允许 unitDisplay.zh | 允许 unitDisplay.en | 允许 unitDisplay.vi |
| --- | --- | --- | --- |
| `kW` | `kW` | `kW` | `kW` |
| `kWh` | `kWh` | `kWh` | `kWh` |
| `%` | `%` | `%` | `%` |
| `Hz` | `Hz` | `Hz` | `Hz` |
| `℃` | `℃` | `degC` 或 `°C` | `degC` 或 `°C` |
| `台` | `台` | `units` | `thiet bi` |
| `条` | `条` | `items` | `muc` |
| `次` | `次` | `times` | `lan` |
| `个` | `个` | `items` 或 `count` | `muc` 或 `so luong` |
| `-` | `-` | `-` | `-` |

动态单位例外（允许）：

- `trend_value`
- `trend_min`
- `trend_max`

以上三个字段允许：

- `unitDisplay.zh = 随指标`
- `unitDisplay.en = metric-based`
- `unitDisplay.vi = theo chi so`

## 6. 校验输出格式建议（供脚本实现）

建议输出 JSON：

```json
{
  "specVersion": "1.0.0",
  "status": "pass|fail",
  "summary": {
    "blockingCount": 0,
    "warningCount": 0
  },
  "results": [
    {
      "checkId": "FDCS-001",
      "level": "blocking|warning",
      "passed": true,
      "message": "..."
    }
  ]
}
```

判定规则：

- 任何 `blocking` 失败 => `status=fail`
- 仅 `warning` 失败 => `status=pass`（并保留风险提示）

## 7. 最小执行命令建议（后续接脚本）

当前可先用 Node 单行命令做基础探测：

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('docs/field-dictionary.json','utf8')); JSON.parse(fs.readFileSync('docs/field-display-dictionary-v1.json','utf8')); console.log('json ok');"
```

建议后续脚本统一命令（推荐）：

```bash
node scripts/check-field-display-consistency.mjs \
  --field docs/field-dictionary.json \
  --display docs/field-display-dictionary-v1.json \
  --spec docs/field-display-consistency-check-spec-v1.md \
  --report /tmp/field-display-consistency-report.json \
  --fail-on blocking
```

CI 最小门禁建议：

```bash
node scripts/check-field-display-consistency.mjs --fail-on blocking
```

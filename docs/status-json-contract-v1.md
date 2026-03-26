# Status-JSON Contract v1

## 1. 目标与边界
- 目标：为 `scripts/chiller_ctl.sh status-json` 输出提供独立机读契约与校验入口。
- 边界：
  - 不修改主 OpenAPI schema。
  - 不影响 `npm run check:contract` 现有门禁逻辑。

## 2. 独立校验命令
```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:status-json
```

该命令会依次验证三种参数态：
1. `status-json`
2. `status-json --live`
3. `status-json --live --strict-freshness`

## 3. 最小字段契约（summary）
以下字段在每个参数态下都必须存在于输出 JSON 的 `summary` 节点：
- `summary.entryMode`（non-empty string）
- `summary.releaseDecision`（`GO | NO-GO`）
- `summary.releaseGateSource`（`live | latest_file | none`）
- `summary.recommendedAction`（non-empty string）

## 4. 报错格式
统一使用：

```text
<json_path>: <error_message>
```

示例：
```text
/modes/status-json--live.summary.releaseDecision: must be one of "GO" | "NO-GO"
```

## 5. 设计说明
- 该契约仅约束 `status-json` 的机读基础字段，便于自动化消费 release 决策摘要。
- `check:status-json` 为独立门禁，可单独运行，不与 `check:contract` 绑定。

# Preflight Release-Gate Contract v1

## 1. 目标与边界
- 目标：为 `docs/v1.8-release-preflight.json` 中 `gates/releaseGate` 结构提供可机读契约。
- 边界：
  - 仅文档层定义，不改 `bff-v1` 主 OpenAPI。
  - 不影响 `npm run check:contract` 现有门禁与通过条件。

## 2. 适用对象
- 生成脚本：`scripts/release_preflight_v1_8.sh`
- 消费文件：`docs/v1.8-release-preflight.json`

## 3. 字段契约（最小）

### 3.1 `gates` 节点
- `gates.statusJsonOk`
  - 类型：boolean
  - 含义：`check:status-json` 门禁是否通过（覆盖 `default/live/strict-live` 三态）。
  - 说明：用于补齐“发布决策快照契约”校验，不替代 `check:contract`。
- `gates.releaseGateOk`
  - 类型：boolean
  - 含义：release gate 同步步骤是否通过（`release-gate-latest` 成功）。
- `gates.releaseGateStrictFreshness`
  - 类型：boolean（可选）
  - 含义：是否以 strict freshness 模式执行 release gate。
  - 兼容要求：字段不存在时，消费端按 `false` 处理。

### 3.2 `releaseGate` 节点
- `releaseGate.decision`
  - 类型：string
  - 枚举：`GO | NO-GO`
- `releaseGate.exitCode`
  - 类型：number
  - 枚举：`0 | 1`
- `releaseGate.reasons`
  - 类型：array
  - item：`snake_case` string
  - 语义：阻断原因集合；无命中时返回 `[]`
- `releaseGate.advisories`
  - 类型：array
  - item：`snake_case` string
  - 语义：告警/提示集合；可为空 `[]`

## 4. 机读示例
```json
{
  "gates": {
    "statusJsonOk": true,
    "releaseGateOk": true,
    "releaseGateStrictFreshness": false
  },
  "releaseGate": {
    "decision": "GO",
    "exitCode": 0,
    "reasons": [],
    "advisories": ["runtime_unavailable_snapshot_present", "freshness_warn"]
  }
}
```

## 5. 判定语义（建议）
- 自动化消费优先判断：
  1. `gates.releaseGateOk`
  2. `gates.statusJsonOk`
  3. `releaseGate.decision`
  4. `releaseGate.exitCode`
  5. `releaseGate.reasons`（用于归因）
- `advisories` 仅用于提示，不应单独作为阻断条件。

## 6. 兼容规则
- 新增字段采用“只增不减”：
  - 允许新增新字段/新 reason/advisory key。
  - 历史字段不删除，不改语义。
- 消费端必须容忍未知字段，并忽略无法识别的新增 key（前向兼容）。

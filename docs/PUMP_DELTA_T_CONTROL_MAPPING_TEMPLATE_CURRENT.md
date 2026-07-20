# PUMP_DELTA_T_CONTROL_MAPPING_TEMPLATE_CURRENT

## 1. 目的

这份模板用于收口 `pump-delta-t` 从“温差导向降频建议”到“PLC/SCADA 可审查点位映射”的最后一段契约。

当前边界：

- 第一版只做运行泵频率 Trim，不做泵台数启停优化。
- AI 只输出两个独立修正量：
  - `AI_ChwpFreqTrim_Hz`
  - `AI_CwpFreqTrim_Hz`
- PLC 必须继续负责限幅、斜率、PID、联锁、最小流量、告警闭锁和回退。
- 当前只允许 `shadow/assisted` 审查链路，不开放无人值守 `enforced`。

## 2. 最小交付物

每个站点至少要明确三类映射：

| 类别 | 必填 | 工程说明 |
| --- | --- | --- |
| `approve` | 是 | 审批通过后，两个 AI Trim 应写入哪个 PLC/SCADA 点 |
| `rollback` | 是 | 回退时写 `0Hz` 或最近稳定值到哪个点 |
| `safetyInputs` | assisted 前必须 | PLC 或上位机提供的保护状态，证明末端、最小流量和冷机侧风险已被闭锁 |

如果现场不是单点写入，而是“写设定值 + 触发执行按钮”两步，必须拆成多条命令并定义顺序。

## 3. AI 目标点

| 点名 | 单位 | 默认值 | 范围 | TTL | 说明 |
| --- | --- | --- | --- | --- | --- |
| `AI_ChwpFreqTrim_Hz` | Hz | `0` | `-5 ~ +3` | `300s` | 冷冻泵频率修正量 |
| `AI_CwpFreqTrim_Hz` | Hz | `0` | `-5 ~ +3` | `300s` | 冷却泵频率修正量 |

PLC 侧目标频率建议：

```text
target_freq := local_pid_freq + AI_FreqTrim_Hz
target_freq := LIMIT(target_freq, min_freq, max_freq)
target_freq := RAMP(target_freq, max_step=1Hz, hold=5min)
```

## 4. 映射表模板

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `siteId` | 是 | 站点标识，例如 `141` |
| `operation` | 是 | `approve` 或 `rollback` |
| `controlObjective` | 是 | `targetChwpFreqTrimHz` / `targetCwpFreqTrimHz` / `rollbackTarget.*` |
| `dispatchMode` | 是 | `shadow` 或 `assisted`；不填默认 `shadow` |
| `endpoint` | assisted 前必须 | BFF 写入 PLC/SCADA 或 legacy 网关的接口 |
| `strategy` | assisted 前必须 | `json-command` / `device-reg-command` / `multi-step-command` |
| `chwpTagName` | 是 | 冷冻泵 Trim 写入点，建议固定为 `AI_ChwpFreqTrim_Hz` |
| `cwpTagName` | 是 | 冷却泵 Trim 写入点，建议固定为 `AI_CwpFreqTrim_Hz` |
| `valueSource` | 是 | 执行单字段来源 |
| `valueTransform` | 否 | `round1` / `clamp` / `identity` |
| `requiredContext` | 是 | 至少包含 `siteId/userId/targetPoints/ttlSeconds` |
| `preCommands` | 否 | 主命令前必须写入的命令 |
| `postCommands` | 否 | 写点后必须触发的确认命令 |
| `rollbackPolicy` | 是 | `zero-trim` 或 `lastStableTrim` |
| `owner` | 否 | 现场/自控责任人 |
| `verifiedAt` | 否 | 最近现场确认时间 |

## 5. 建议 JSON 结构

当前代码支持把映射存进 `admin runtime-config`，建议放在：

```json
{
  "ruleThresholds": {
    "pumpDeltaT": {
      "dispatchMode": "shadow",
      "dispatch": {
        "mode": "shadow",
        "approveEndpoint": "TODO",
        "rollbackEndpoint": "TODO",
        "timeoutMs": 8000
      },
      "controlTargets": {
        "approve": {
          "endpoint": "TODO",
          "strategy": "json-command",
          "requiredContext": ["siteId", "userId", "targetPoints", "ttlSeconds"],
          "commandTemplate": "{AI_ChwpFreqTrim_Hz}|{AI_CwpFreqTrim_Hz}",
          "commands": [
            {
              "chwpTagName": "AI_ChwpFreqTrim_Hz",
              "valueSource": "targetChwpFreqTrimHz",
              "valueTransform": "round1"
            },
            {
              "cwpTagName": "AI_CwpFreqTrim_Hz",
              "valueSource": "targetCwpFreqTrimHz",
              "valueTransform": "round1"
            }
          ]
        },
        "rollback": {
          "endpoint": "TODO",
          "strategy": "json-command",
          "requiredContext": ["siteId", "userId", "targetPoints", "rollbackTarget"],
          "commandTemplate": "{AI_ChwpFreqTrim_Hz}|{AI_CwpFreqTrim_Hz}",
          "commands": [
            {
              "chwpTagName": "AI_ChwpFreqTrim_Hz",
              "valueSource": "rollbackTarget.targetChwpFreqTrimHz",
              "valueTransform": "round1"
            },
            {
              "cwpTagName": "AI_CwpFreqTrim_Hz",
              "valueSource": "rollbackTarget.targetCwpFreqTrimHz",
              "valueTransform": "round1"
            }
          ]
        }
      },
      "safetyInputs": {
        "terminalPressureOk": "TODO",
        "terminalValveRiskOk": "TODO",
        "roomTemperatureOk": "TODO",
        "pumpActualFrequencyOk": "TODO",
        "minimumFlowOk": "TODO",
        "condenserRiskOk": "TODO",
        "plcAiTrimProtected": "TODO",
        "manualLockout": "TODO"
      }
    }
  },
  "featureFlags": {
    "pumpDeltaTDispatchMode": "shadow"
  }
}
```

说明：

- `featureFlags.pumpDeltaTDispatchMode` 可覆盖 `ruleThresholds.pumpDeltaT.dispatchMode`。
- 140/B25 已内置一版 `B25_AI_ChwpFreqTrim_Hz` / `B25_AI_CwpFreqTrim_Hz` shadow 模板；这只是影子点命名模板，不等于现场 PLC 已存在真实点。
- 最新 live readiness：140 泵侧已达到 `GO_SHADOW_ONLY`，说明 shadow 目标/回退点和本地 shadow 执行单成立；`assisted` 仍因真实下发点和安全输入未闭合保持 `BLOCKED`。
- 如果现场准备进入 assisted，`dispatchMode` 才能改为 `assisted`。
- 即使误填 `enforced`，BFF 也不得把泵温差优化开放为无人值守执行。

## 6. assisted 前确认清单

| 项目 | assisted 前要求 |
| --- | --- |
| 末端风险 | 末端压差低、阀位大面积接近全开、室温超限时必须闭锁 |
| 冷冻泵保护 | 最小流量、实际频率反馈、手自动状态必须可用 |
| 冷却泵保护 | 冷凝压力、冷却水温、最小流量或 PLC 等效保护必须可用 |
| 节能边界 | 冷机功率上升不得抵消泵功率下降，COP 不得劣化 |
| 回退 | 必须能写回 `0Hz` 或最近稳定 Trim |
| 防震荡 | 5 分钟周期、单次 1Hz、回退后 15 分钟闭锁 |
| 审计 | 执行单、审批人、ACK、实际频率、功率变化必须留痕 |

## 7. 审计命令

写入映射后运行：

```bash
SITE_ID=140 npm --prefix apps/chiller-bff run check:pump-delta-t-readiness
```

输出：

- `docs/pump-delta-t-readiness-latest.json`
- `docs/pump-delta-t-readiness-latest.md`

判定口径：

| 结论 | 含义 |
| --- | --- |
| `GO_SHADOW_ONLY` | shadow 执行单与回退目标成立，但 assisted 点位或安全保护未闭合 |
| `GO_ASSISTED_MAPPING_REVIEW` | 点位映射和保护状态具备 assisted 审查条件，仍需现场联调确认 |
| `BLOCK_SHADOW` | 缺 shadow 建议、执行单或 0Hz 回退目标，不能推进 |

## 8. 下一步建议

1. 140 先用内置 `B25_AI_*` shadow 模板跑 readiness，确认 assisted 仍因安全输入 `TODO` 被锁定。
2. 现场确认真实 PLC/SCADA 点名后，用 admin runtime-config 覆盖 `ruleThresholds.pumpDeltaT.controlTargets`。
3. 跑 readiness 审计，确认不再缺 `AI_ChwpFreqTrim_Hz / AI_CwpFreqTrim_Hz` 或现场等效点映射。
4. 只在 assisted 中验证回执、限幅、斜率、联锁和回退，不直接开放 enforced。
5. 用 30-60 分钟同负荷/相近湿球窗口验证泵功率下降、冷机功率未抵消、COP 不劣化。

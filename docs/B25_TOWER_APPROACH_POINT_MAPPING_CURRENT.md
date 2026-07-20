# B25 冷却塔 Approach 点位取证

## 结论

- 站点：`140 / 140btwentyfive`
- 设备：`drTypeId=77`，`drId=46`，`drName=冰机参数设置`
- 可写目标水温候选：`冷却回水手动值`
- 不建议直接写：`冷却回水目标值`、`冷却回水自动值`、`目标逼近度`，这些点当前为只读。
- 湿球趋势旧点 `506-40689` 不可用；已验证可用点为 `SY-1-509-42048`。
- 当前代码已内置 30℃ 保守最低冷凝器进水温和 `冷却回水手动值 / SY-1-509-41413` shadow 映射；该配置只用于 `/optimize-demo` 审阅和 shadow 记录，不代表真实 PLC assisted 已开通。
- 最新 readiness 结论：塔侧不再因“最低冷凝器进水温缺失”或“单步超过 0.5℃”阻断；当前已生成多步 shadow 计划并达到 `GO_SHADOW`。本次只建议下一步目标，最终 30℃ 边界需分步验证。
- 当前第一步 shadow 待审单：`opx-140-1781266624535-ju3qeb`，目标 Tcws `28.0℃`，guardrail `30℃`；状态 `pending_approval`，未批准、未 dispatch、未写 PLC。
- 登录态 UI 已复验：接近度审批卡片可见 `最低冷凝器进水温 / 30.0 °C / 站点默认` 和回退目标 `Tcws 27.5 °C / 接近度 2.9 °C`；截图在 `output/playwright/optimize-demo-140-shadow-ui-final.png`。
- 演示前置治理检查：`npm --prefix apps/chiller-bff run check:optimize-shadow-governance`，最新报告 `docs/optimize-shadow-governance-latest.md`，结论 `GO_SHADOW_PENDING`。

## 目标控制点候选

| 用途 | drTypeId | drId | regId | regName | tagName | 当前值 | 单位 | 可写 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Approach/Tcws 下发候选 | 77 | 46 | 1031 | 冷却回水手动值 | SY-1-509-41413 | 23.0 | ℃ | 是 | 历史操作记录显示该点可下发并执行成功；适合作为人工/受控模式下的 Tcws 目标候选。 |
| 同义候选 | 77 | 46 | 931 | 冷却塔回水温度手动设定值 | SY-2-509-41413 | 23.0 | ℃ | 是 | 与 1031 语义接近，但历史记录未看到近期直接操作；需现场确认与 1031 的实际 PLC 绑定差异。 |
| 目标值观察 | 77 | 46 | 1032 | 冷却回水目标值 | SY-1-509-41415 | 29.4 | ℃ | 否 | 当前为只读，不能作为 doimplements 写入点。 |
| 自动值观察 | 77 | 46 | 1033 | 冷却回水自动值 | SY-1-509-41417 | 29.4 | ℃ | 否 | 当前为只读，不能作为 doimplements 写入点。 |
| 目标逼近度观察 | 77 | 46 | 1301 | 目标逼近度 | SY-2-521-41399 | 2.9 | ℃ | 否 | 当前为只读，不能作为 AI 目标写入点。 |
| 当前逼近度反馈 | 77 | 46 | 1300 | 当前逼近度 | SY-2-521-41397 | 2.9 | ℃ | 否 | 可用于反馈展示/校验。 |

## 运行边界点

| 用途 | drTypeId | drId | regId | regName | tagName | 当前值 | 单位 | 可写 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 冷却塔温度手自动 | 77 | 46 | 600 | 冷却塔温度手自动 | SY-1-509-41325 | 1 | - | 是 |
| 冷却温度下限 | 77 | 46 | 1030 | 冷却温度下限 | SY-1-509-41411 | 15.0 | ℃ | 是 |
| 最小逼近度 | 77 | 46 | 1297 | 最小逼近度 | SY-2-521-41391 | 2.0 | ℃ | 是 |
| 最大逼近度 | 77 | 46 | 1298 | 最大逼近度 | SY-2-521-41393 | 5.0 | ℃ | 是 |
| 冷却风机频率下限 | 77 | 46 | 581 | 冷却风机频率下限 | SY-1-509-41306 | 15 | Hz | 是 |
| 冷却风机频率上限 | 77 | 46 | 1294 | 冷却风机频率上限 | SY-2-521-41322 | 50 | Hz | 是 |

## 反馈与验证点

| 用途 | drTypeId | drId | regId | regName | tagName | 当前值/验证 | 单位 | 可写 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 湿球温度 | 77 | 46 | 638 | 湿球温度 | SY-1-509-42048 | 趋势 144 点，最新约 26.3 | ℃ | 否 |
| 冷却总管供水温度 | 156 | 128 | 1049 | 当前值 | - | 当前反馈点 | ℃ | 否 |
| 冷却总管回水温度 | 156 | 129 | 1050 | 当前值 | - | 当前反馈点 | ℃ | 否 |
| 1#冷却进水温度 | 156 | 140 | 934 | 实时值 | - | 当前反馈点 | ℃ | 否 |
| 1#冷却出水温度 | 156 | 146 | 940 | 实时值 | - | 当前反馈点 | ℃ | 否 |

## 历史操作证据

- `2025-11-03 15:59:40`：`修改: 冷却回水手动值 的值为: 23.0`，结果包含 `下发成功` 与 `执行成功`。
- `2025-11-03 16:38:44` 等多次：`冷却塔温度手自动` 在 `0(手动)` 与 `1(自动)` 间切换，均有成功记录。
- `2025-11-18` 至 `2026-05-28` 多次：`最小逼近度`、`最大逼近度`、`冷却风机频率上限/下限` 有云端或小程序控制成功记录。

## 内置 runtime-config 基线

当前已作为 140/B25 内置 shadow 基线进入 `resolveSiteRuntimeConfig`。仅作为 `shadow` 审阅和后续 `assisted` 联调草案，不建议直接打开 `enforced`。

```json
{
  "ruleThresholds": {
    "towerApproach": {
      "minCondenserInletTempC": 30,
      "controlTargets": {
        "approve": {
          "endpoint": "/zsqy/qstag/{siteId}/doimplements",
          "strategy": "device-reg-command",
          "requiredContext": ["userId", "appId", "drTypeId", "drId", "tagName"],
          "commandTemplate": "{deviceName}|{targetTcwsC}|{tagName}",
          "commands": [
            {
              "drTypeId": "77",
              "drId": "46",
              "drTypeName": "系统控制",
              "drName": "冰机参数设置",
              "deviceName": "冷却回水手动值",
              "tagName": "SY-1-509-41413",
              "valueSource": "targetTcwsC",
              "valueTransform": "round1"
            }
          ]
        },
        "rollback": {
          "endpoint": "/zsqy/qstag/{siteId}/doimplements",
          "strategy": "device-reg-command",
          "requiredContext": ["userId", "appId", "drTypeId", "drId", "tagName"],
          "commandTemplate": "{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}",
          "commands": [
            {
              "drTypeId": "77",
              "drId": "46",
              "drTypeName": "系统控制",
              "drName": "冰机参数设置",
              "deviceName": "冷却回水手动值",
              "tagName": "SY-1-509-41413",
              "valueSource": "rollbackTarget.targetTcwsC",
              "valueTransform": "round1"
            }
          ]
        }
      }
    }
  }
}
```

## 风险判断

- 当前可写点是“手动值”，不是 PLC 自动目标值。若现场要求保持 `冷却塔温度手自动=自动`，必须确认写入 `冷却回水手动值` 是否会被 PLC 采纳。
- `冷却回水目标值` 和 `目标逼近度` 当前只读，不能直接作为真实下发点。
- 当前 30℃ 保守边界会在低冷却水温工况下把目标抬高；若最终目标与当前值相差超过 0.5℃，Advisor 必须拆成多步 shadow，每步不超过 0.5℃，不得一次性提交最终目标。
- 若后续要完全符合“AI 只写目标、PLC 自动闭环”的架构，建议现场 PLC/SCADA 新增一个明确可写点：`AI_Tcws_Target` 或 `AI_Approach_Target`，由 PLC 内部做限幅、死区和回退。

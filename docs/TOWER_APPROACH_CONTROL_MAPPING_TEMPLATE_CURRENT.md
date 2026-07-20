# TOWER_APPROACH_CONTROL_MAPPING_TEMPLATE_CURRENT

## 1. 目的

这份模板用于收口 `tower-approach` 从“策略目标”到“legacy 可执行控制命令”的最后一段契约。

当前已知事实：

- BFF 执行记录当前只保存策略值：
  - `targetApproachC`
  - `targetTcwsC`
  - `rollbackTarget`
- 现网仓库里可明确确认的 legacy 控制接口是：
  - `GET /zsqy/qstag/{siteId}/doimplements`
- 该接口要求的不是策略值，而是设备/寄存器级上下文：
  - `userId`
  - `appId`
  - `drTypeId`
  - `drId`
  - `msg`

因此，现场必须先补齐“控制点位映射”，再谈真实 `shadow/enforced` 联调。

## 2. 最小交付物

每个站点至少要明确两类映射：

1. `approve`
   - 当审批通过时，`targetApproachC` 或 `targetTcwsC` 应写到哪个控制点
2. `rollback`
   - 当回退时，应恢复到哪个控制点、用哪个值

如果现场不是单点写入，而是“写设定值 + 触发执行按钮”两步，也必须拆成两条命令并按顺序定义。

## 3. 建议采集路径

现有 BFF 已有只读接口可辅助现场工程师采集点位：

1. 设备类型列表
   - `GET /bff/v1/sites/{siteId}/operation-records/device-types`
2. 指定设备类型下的设备列表
   - `GET /bff/v1/sites/{siteId}/operation-records/devices?drTypeId={drTypeId}`
3. 指定设备的寄存器/报表变量列表
   - `GET /bff/v1/sites/{siteId}/report-records/reg-options?drTypeId={drTypeId}&drId={drId}`

这三步至少能把 `drTypeId / drId / regId / regName` 先圈出来。

真正下发前，还需要由现场确认：

- 最终写入使用的 `tagName`
- `msg` 的拼接格式
- 是单点写入还是多点联动
- 写入后是否还要补一个“执行/确认”按钮命令

## 4. 映射表模板

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `siteId` | 是 | 站点标识，例如 `btwentyfive` |
| `operation` | 是 | `approve` 或 `rollback` |
| `controlObjective` | 是 | `targetTcwsC` / `targetApproachC` / `rollbackTarget.targetTcwsC` 等 |
| `legacyEndpoint` | 是 | 当前建议填 `/zsqy/qstag/{siteId}/doimplements` |
| `dispatchStrategy` | 是 | `device-reg-command` / `multi-step-command` |
| `drTypeId` | 是 | 设备类型 ID |
| `drTypeName` | 否 | 设备类型名称，便于人工核对 |
| `drId` | 是 | 设备 ID |
| `drName` | 否 | 设备名称，便于人工核对 |
| `tagName` | 是 | legacy 写入使用的 tag 名 |
| `msgTemplate` | 是 | `doimplements` 的命令模板 |
| `valueSource` | 是 | 值来自哪个执行字段 |
| `valueTransform` | 否 | `identity` / `round1` / `clamp` / 自定义公式 |
| `requiredContext` | 是 | 至少应包含 `userId/appId/drTypeId/drId/tagName` |
| `preCommands` | 否 | 执行主命令前必须先写入的命令 |
| `postCommands` | 否 | 主命令后必须补发的确认命令 |
| `rollbackPolicy` | 否 | `useRollbackTarget` / `fixedValue` / `manualOnly` |
| `owner` | 否 | 现场/运维责任人 |
| `verifiedAt` | 否 | 最近现场确认时间 |
| `remark` | 否 | 任何特殊说明 |

## 5. `msgTemplate` 约定

legacy `doimplements` 当前可见的命令串形态类似：

- `{deviceName}|{valueId}|{tagName}`
- 或多条命令逗号拼接后放进 `msg`

所以模板至少要能回答这三个问题：

1. `valueId` 直接取目标值，还是先把目标值映射为枚举/档位 ID
2. `deviceName` 实际应使用 `drname`、`regName` 还是前端组装名
3. 如果要联动多个点位，顺序是否固定

## 6. 建议 JSON 结构

当前代码已经支持把映射存进 `admin runtime-config`，建议先放在：

```json
{
  "ruleThresholds": {
    "towerApproach": {
      "controlTargets": {
        "approve": {
          "endpoint": "/zsqy/qstag/{siteId}/doimplements",
          "strategy": "device-reg-command",
          "requiredContext": ["userId", "appId", "drTypeId", "drId", "tagName"],
          "commandTemplate": "{deviceName}|{targetTcwsC}|{tagName}",
          "commands": [
            {
              "drTypeId": "TODO",
              "drId": "TODO",
              "tagName": "TODO",
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
              "drTypeId": "TODO",
              "drId": "TODO",
              "tagName": "TODO",
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

说明：

- 这里暂时复用 `ruleThresholds.towerApproach.controlTargets` 作为持久化通道。
- 这是当前工程上的可落地位置，不代表最终命名就是最佳语义。
- 如果后续单独增加 `controlMappings` 配置桶，再整体迁移即可。

## 7. 现场确认清单

在真正接 `shadow` 前，至少要拿到下面这些确认：

1. 最终控制的是“塔出水温设定值”还是“风机频率/档位”。
2. `targetApproachC` 是否需要先换算成 `targetTcwsC` 才能下发。
3. 一个站点是否存在多塔并行下发；如果有，是平均下发还是按塔分配。
4. 回退是回到“当前值 / 最近稳定值 / 固定保底值”中的哪一种。
5. legacy 回执里什么字段代表真正执行成功，而不是仅仅 HTTP 200。

## 8. 下一步建议

1. 先由现场按本模板补一版 `approve/rollback` 点位映射。
2. 用 admin runtime-config 写入 `controlTargets` 草稿。
3. 跑映射审计脚本，确认 `approve/rollback` 都不是 partial/missing。
4. BFF 会按这份映射把 dispatch 从策略值翻译成具体 `doimplements` 命令。
5. 先跑 `shadow/assisted`，确认 `msg` 格式和回执语义后再评估 `enforced`。

审计命令：

```bash
SITE_ID=140 npm --prefix apps/chiller-bff run check:tower-approach-control-mapping
```

输出：

- `docs/tower-approach-control-mapping-latest.json`
- `docs/tower-approach-control-mapping-latest.md`

判定口径：

- `GO_REAL_DISPATCH_MAPPING`：`approve` 与 `rollback` 映射完整，BFF 可把 AI 目标值翻译为 legacy `doimplements` 命令。
- `NO_GO_REAL_DISPATCH_MAPPING`：只允许继续 `shadow` 或只读评审，不允许打开 `assisted/enforced`。

注意：

- 如果 endpoint 直接指向 `/zsqy/qstag/{siteId}/doimplements`，BFF 会使用 `controlTargets.commands` 顺序生成 GET 命令。
- 真正打开 enforced 前，仍必须现场确认 PLC 侧限幅、死区、告警闭锁、回退和 legacy 回执成功字段。

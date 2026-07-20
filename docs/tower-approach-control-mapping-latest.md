# 冷却塔 Approach 控制点映射审计

- 结论：GO_REAL_DISPATCH_MAPPING
- 站点：140
- dispatchMode：shadow
- 真实下发映射就绪：是
- shadow 可无点位映射运行：是
- 使用 legacy doimplements：是
- 生成时间：2026-06-12T03:34:21.557Z

## 映射状态

| operation | status | endpoint | strategy | commands |
| --- | --- | --- | --- | --- |
| approve | ready | /zsqy/qstag/{siteId}/doimplements | device-reg-command | 1 |
| rollback | ready | /zsqy/qstag/{siteId}/doimplements | device-reg-command | 1 |

## 阻断项

- 无

## 风险与提示

- endpoint 指向 legacy doimplements；dispatch 服务会按 controlTargets.commands 顺序翻译并下发 GET 命令，仍需现场确认回执语义。

## 下一步

- 先在 shadow/assisted 中验证 endpoint 回执语义，不直接打开 enforced。
- 确认 PLC 侧最小/最大值、单步限幅、死区、告警闭锁和回退逻辑已上线。

## 命令明细

### approve

- commandTemplate：{deviceName}|{targetTcwsC}|{tagName}
- requiredContext：userId, appId, drTypeId, drId, tagName

| drTypeId | drId | tagName | valueSource | valueTransform |
| --- | --- | --- | --- | --- |
| 77 | 46 | SY-1-509-41413 | targetTcwsC | round1 |

### rollback

- commandTemplate：{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}
- requiredContext：userId, appId, drTypeId, drId, tagName

| drTypeId | drId | tagName | valueSource | valueTransform |
| --- | --- | --- | --- | --- |
| 77 | 46 | SY-1-509-41413 | rollbackTarget.targetTcwsC | round1 |


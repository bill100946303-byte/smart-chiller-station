# Sprint1 `anomalies/list` 数据包 v1

## 1. 目标与边界
- 目标：把 `anomalies/list` 首版字段一次性定清楚，给 BFF 与前端直接开工，不再拆多轮字段确认。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/sprint1-alarm-page-data-pack-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-dictionary.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.json`
  - `apps/chiller-shell-v1/src/pages/AlarmPage.tsx`
  - `docs/page-migration-contract-plan-v1.md`
- 边界：
  - 本文只定义首版列表项字段，不改现有字段字典。
  - 不定义分页、筛选、详情接口。
  - 不把 `anomalies/summary` 直接等同于 `anomalies/list`，只把它视作当前最近告警的 source candidate。

## 2. 当前事实
1. 仓内当前没有 `GET /bff/v1/sites/{siteId}/anomalies/list` 路由或前端 `fetchAnomaliesList` 调用。
2. 当前唯一可复用的异常聚合合同是 `anomalies/summary`，它能提供最近告警的最小列表雏形：
   - `latestEvents[].id`
   - `latestEvents[].title`
   - `latestEvents[].severity`
   - `latestEvents[].occurredAt`
   - `latestEvents[].source`
3. `field-dictionary` 已定义：
   - `anomaly_alarm_id`
   - `anomaly_occurred_at`
   - `anomaly_severity`
   - `anomaly_state`
4. `field-dictionary` 与当前 summary 合同之间仍有两个明显差异：
   - `severity`：字典口径偏 `critical/major/minor`，当前 summary 示例与 `AlarmPage.tsx` 使用 `high/medium/low`
   - `state`：字典已定义，但当前 summary DTO 没暴露
5. 当前 [`AlarmPage.tsx`](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/AlarmPage.tsx) 的“状态”列表列，实际上展示的是 `severity`，不是 `state`。这个语义不能继续带到 `anomalies/list` 合同里。

## 3. 建议的 `anomalies/list` 首版合同

建议最小返回结构：

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "6期1栋冷站"
  },
  "items": [
    {
      "id": "59775",
      "title": "Alarm event",
      "severity": "critical",
      "occurredAt": "2025-11-08T08:07:00.000Z",
      "source": "Unknown",
      "acknowledged": null,
      "state": null
    }
  ]
}
```

口径要求：
- `severity`
  - 首版建议统一输出为 `critical | major | minor`
  - 不建议再把 `high | medium | low` 直接暴露给前端
- `acknowledged`
  - 当前可为 `null`
- `state`
  - 当前可为 `null`

## 4. 字段清单

| 字段 | display_name | source_candidate | current_status | blocking | fallback_strategy | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | 告警ID | `findNewAlarmLog.id`；当前 summary 可见 `latestEvents[].id` | `partial` | `yes` | 缺失时只允许 UI 临时 key，禁止开放详情跳转或持久选择态 | 列表最小集合字段之一。 |
| `title` | 告警标题 | 当前 summary 可见 `latestEvents[].title`；必要时可由 `regId + reg/subinfo` 组合生成 | `partial` | `yes` | 缺值时回退为“告警事件” | 当前仍偏 contract-only，尚未进入统一字段字典。 |
| `severity` | 告警等级 | `qsAlarmlog.alarmLevel + 映射规则`；当前 summary 暴露 `latestEvents[].severity` | `partial` | `yes` | 首版由 BFF 统一映射到 `critical/major/minor`；前端不要兼容双枚举 | 当前最大语义收口点。 |
| `occurredAt` | 告警发生时间 | `findNewAlarmLog.time`；当前 summary 可见 `latestEvents[].occurredAt` | `partial` | `yes` | 缺值显示 `--`，不得伪造最近时间 | 列表最小集合字段之一。 |
| `source` | 告警来源 | 当前 summary 可见 `latestEvents[].source`；必要时可由 `regId` 反查设备/点位 | `partial` | `yes` | 缺值回退为“未知来源” | 当前仍偏 contract-only，尚未进入统一字段字典。 |
| `acknowledged` | 已确认/已处理 | 当前未发现稳定 source candidate | `missing` | `no` | 首版固定返回 `null` 或不返回；前端隐藏确认态列/筛选 | 这是当前真缺失字段。 |
| `state` | 异常状态 | `findNewAlarmLog.alarmstate`；字段字典对应 `anomaly_state` | `partial` | `no` | 首版可返回 `null`；前端隐藏状态列/筛选 | 上游 candidate 已有，但当前 BFF 未暴露。 |

## 5. 首版最小字段集合

`anomalies/list` 首版最小字段集合固定为：
- `id`
- `title`
- `severity`
- `occurredAt`
- `source`

说明：
- 这 5 个字段是首版可渲染列表的最小闭环。
- `acknowledged` 与 `state` 不纳入首版最小集。

## 6. 哪些字段能后补

可以后补：
- `acknowledged`
  - 等确认上游有无“已确认/已处理”字段后再加。
- `state`
  - 等 `findNewAlarmLog.alarmstate` 正式进 BFF list 合同后再加。
- `title` 标准化
  - 后续可从 contract-only 收敛到统一字段字典。
- `source` 标准化
  - 后续可补设备/点位级来源翻译。

## 7. 当前主要阻塞点

1. 真实 `anomalies/list` 端点当前不存在
   - 这会阻断“真实接口联调”。
2. `severity` 枚举仍未统一
   - 字典口径与当前 summary/sample/前端代码不一致。
3. `title` / `source` 还没有稳定进入字段字典主键体系
   - 当前可消费，但仍偏 contract-only。
4. `state` 尚未进入当前 BFF summary/list 合同
   - 这不阻断首版最小列表，但阻断状态列与状态筛选。
5. 当前 `AlarmPage.tsx` 的“状态”列其实展示的是 `severity`
   - 若不改，会继续制造语义漂移。

## 8. 联调结论
- 是否可直接联调：`no`

原因：
- 当前仓内没有 `anomalies/list` 真实接口。
- `severity` 枚举还未收敛到统一口径。
- `state` / `acknowledged` 尚未明确落点。

但可以直接开工：
- `yes`，以本文字段包为合同，BFF 和前端可以并行开发：
  - BFF 按最小字段集合实现 `items[]`
  - 前端按 `id/title/severity/occurredAt/source` 先接首版列表
  - `acknowledged/state` 先隐藏，不做交互入口

# OPTIMIZE_INPUT_MAPPING_CURRENT

## 1. 目标

本文用于固定 `/optimize` 未来实现时的输入字段边界，避免把页面临时状态、legacy 原始字段和优化合同混在一起。

当前状态：

- `预留治理`
- `未实现`

## 2. 输入分层原则

`/optimize` 的输入未来只允许分成 4 类：

1. 手工输入
2. 站点现态输入
3. 约束输入
4. 暂不支持输入

不允许：

- 直接透传 UI 内部 state
- 直接暴露 legacy 中文字段
- 把“缺失时临时猜值”写进主合同

## 3. 手工输入

这些字段适合未来由页面或调用方显式传入。

| 字段 | 类型 | 单位 | 必填建议 | 说明 |
| --- | --- | --- | --- | --- |
| `loadKw` | `number` | `kW` | 是 | 当前工况负荷；作为最核心优化输入 |
| `outdoorTempC` | `number` | `C` | 是 | 室外温度；用于优化上下文 |
| `mode` | `string` | - | 是 | 建议先固定 `cooling` |
| `timeRange` | `string` | - | 否 | 可预留，当前不建议作为首版硬依赖 |

当前主控建议：

- 首版只建议把 `loadKw / outdoorTempC / mode` 作为显式输入

## 4. 站点现态输入

这些字段更适合由 BFF 在站点上下文内补齐，而不是要求调用方手工重复输入。

| 优化语义字段 | 当前来源候选 | 当前状态 | 备注 |
| --- | --- | --- | --- |
| `stationCop` | `dashboard/overview.currentCop` | 观察项 | 当前快照可取，但趋势质量不稳 |
| `totalPowerKw` | `dashboard/overview.totalPowerKw` | 可用 | 可作为结果对照或解释字段 |
| `chilledDeltaT` | `dashboard/overview.chilledDeltaT` | 可用 | 当前更适合作为诊断辅助输入 |
| `coolingDeltaT` | `dashboard/overview.coolingDeltaT` | 可用 | 当前更适合作为诊断辅助输入 |
| `activeAnomalyCount` | `anomalies/summary.counts.*` | 可用 | 可作为保守约束或提示 |
| `deviceAvailability` | `devices/list/tree/detail` | 部分可用 | 当前设备页已签收，但细粒度控制态仍观察中 |

当前主控建议：

- 首版 `/optimize` 不要把这些字段暴露给调用方
- 若需要，统一由 BFF 在 service 内部补齐

## 5. 约束输入

这些字段未来适合单独放在 `constraints` 下。

| 字段 | 类型 | 当前建议 |
| --- | --- | --- |
| `preferEfficiency` | `boolean` | 可预留 |
| `maxChillerCount` | `number` | 可预留 |
| `excludeDevices` | `string[]` | 可预留 |
| `allowPartialData` | `boolean` | 可预留，默认 `false` |

当前主控建议：

- 首版不强推这些字段进最小合同
- 先作为二阶段扩展位保留

## 6. 暂不支持输入

以下内容当前不建议进入 `/optimize` 首版输入：

- 直接控制量：
  - 泵频率
  - 塔频率
  - 主机开停台命令
- 未稳定的历史趋势派生量
- 仅存在于 legacy 页面里的临时变量名
- 需要设备详情 runtime 深链支持但当前还未标准化的字段

## 7. 空值与回退策略

### 7.1 手工输入缺失

- `loadKw` 缺失：直接 `BAD_REQUEST`
- `outdoorTempC` 缺失：直接 `BAD_REQUEST`
- `mode` 缺失：首版允许默认 `cooling`

### 7.2 站点现态缺失

- `stationCop / chilledDeltaT / coolingDeltaT` 缺失：
  - 可以降级为解释缺口
  - 不应直接伪造
- `totalPowerKw` 缺失：
  - 可保留 `null`
  - 但必须在响应中反映 `sourceStatus`

## 8. 推荐的首版最小输入

当前建议未来 `/optimize` 首版只接受：

```json
{
  "context": {
    "siteId": "126lnoffice"
  },
  "inputs": {
    "loadKw": 1200,
    "outdoorTempC": 32.5,
    "mode": "cooling"
  }
}
```

## 9. 当前主控结论

当前 `/optimize` 输入边界已经足够清楚：

- 手工输入：已固定最小集
- 站点现态：以 BFF 内部补齐为主
- 约束输入：仅保留扩展位

下一步若继续推进，应进入：

- `OPTIMIZE_SIGNOFF_CRITERIA_CURRENT.md`
- 然后才允许考虑 `optimizeService.js` 空壳

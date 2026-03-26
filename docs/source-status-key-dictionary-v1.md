# SourceStatus Key 中文映射字典 v1

目的：统一 `sourceStatus.sources[*].key` 的中文名称与口径说明，避免同 key 多译名。  
约束：不改字段定义，不改 `null_strategy`；仅定义展示与解释口径。

参考输入：

- `apps/chiller-bff/openapi/examples/*.json`
- BFF 当前实现产出的 key（含 `metric.*` 动态键）
- `docs/metric-availability-v1.md`
- `docs/field-dictionary.json`（只读）

## 1. 标准 key 映射表（前端可直接消费）

| key | 标准中文名 | 来源接口 | 语义说明（1句） | 失败时推荐主提示 |
| --- | --- | --- | --- | --- |
| `energy` | 能耗总览源 | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | 首页能耗卡片与核心实时量的上游来源。 | `能耗总览源不可达，请检查站点能耗接口。` |
| `runParams` | 运行参数趋势源 | `/zsqy/homepage/{siteId}/getRunParamsCurve` | 运行参数趋势（如温差等）的曲线来源。 | `运行参数趋势源不可达，请检查参数曲线接口。` |
| `latestAlarmLog` | 最新告警日志源 | `/zsqy/qsAlarmlog/{siteId}/findNewAlarmLog` | 最新告警事件列表及时间戳来源。 | `最新告警日志不可达，请检查告警日志接口。` |
| `subsystemInfo` | 子系统概览源（兼容别名） | `/{siteId}/getAllSubsystemInfo` | 子系统在线/离线及告警汇总来源（兼容旧 key）。 | `子系统概览不可达，请检查子系统汇总接口。` |
| `subsystemSummary` | 子系统概览源 | `/{siteId}/getAllSubsystemInfo` | 子系统在线/离线及告警汇总来源（推荐标准 key）。 | `子系统概览不可达，请检查子系统汇总接口。` |
| `ruleMetrics` | 规则指标聚合源 | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve + getEnergyStatisticsCurve + getRunParamsCurve` | 规则引擎前置聚合指标的组合来源。 | `规则指标聚合源不可达，建议诊断可能降级。` |
| `metric.chilled_delta_t_c` | 规则指标：冷冻水温差 | 同 `energy`（按运行时 endpoint 为准） | 规则评估所需 `chilled_delta_t_c` 的可用性状态。 | `冷冻水温差指标不可用，请检查温差点位或上游链路。` |
| `metric.cooling_delta_t_c` | 规则指标：冷却水温差 | 同 `energy`（按运行时 endpoint 为准） | 规则评估所需 `cooling_delta_t_c` 的可用性状态。 | `冷却水温差指标不可用，请检查温差点位或上游链路。` |
| `metric.station_cop` | 规则指标：冷站COP | 同 `energy`（按运行时 endpoint 为准） | 规则评估所需 `station_cop` 的可用性状态。 | `冷站COP指标不可用，请检查COP字段或上游链路。` |
| `metric.station_total_power_kw` | 规则指标：冷站实时总功率 | 同 `energy`（按运行时 endpoint 为准） | 规则评估所需 `station_total_power_kw` 的可用性状态。 | `冷站总功率指标不可用，请检查总功率字段或上游链路。` |
| `energyCurve` | 能耗趋势源 | `/zsqy/homepage/{siteId}/getEnergyStatisticsCurve` | 功率等能耗趋势曲线来源。 | `能耗趋势源不可达，请检查能耗曲线接口。` |
| `devices` | 设备清单源 | `/zsqy/drinfo/{siteId}/findObject` | 设备数量、类型和拓扑节点的基础来源。 | `设备清单源不可达，请检查设备台账接口。` |
| `alarms` | 告警摘要源 | `/zsqy/qsAlarmlog/{siteId}/findNewAlarmLog` | 首页总览中的告警摘要来源。 | `告警摘要源不可达，请检查告警日志接口。` |
| `rules` | 规则配置源 | `docs/hvac-rules-v1.yaml`（运行时配置路径） | 规则引擎加载的规则文件来源。 | `规则配置不可读，建议功能已降级。` |
| `dashboardOverview` | 总览聚合源（BFF内部） | `/bff/v1/sites/{siteId}/dashboard/overview` | recommendations 对总览聚合结果的内部依赖状态。 | `总览聚合不可用，建议结果可能不完整。` |
| `anomalySummary` | 异常聚合源（BFF内部） | `/bff/v1/sites/{siteId}/anomalies/summary` | recommendations 对异常聚合结果的内部依赖状态。 | `异常聚合不可用，建议结果可能不完整。` |

## 2. 动态 key 规则（`metric.<snake_case>`）

统一模板：

- 匹配规则：`^metric\\.([a-z0-9_]+)$`
- 标准中文名：`规则指标：{字段中文名}`；若无法从字段字典命中，则 `规则指标：{snake_case}`
- 来源接口：优先使用运行时 `sourceStatus.sources[i].endpoint`；无 endpoint 时回退 `规则指标聚合源`
- 失败主提示模板：`{字段中文名}指标不可用，请检查字段映射或上游链路。`

示例：

- `metric.chilled_delta_t_c` -> `规则指标：冷冻水温差`
- `metric.station_total_power_kw` -> `规则指标：冷站实时总功率`

## 3. 未收录 key 兜底策略

兜底文案：

- 中文名：`未收录来源`
- 展示名：`未收录来源（{rawKey}）`
- 失败提示：`来源语义未收录，请先完成口径校准后再业务化展示。`

风险提示：

- 未收录 key 仅可用于技术诊断，不可直接出现在业务结论文案中。
- 若该 key 影响规则判定，必须先补齐到本字典，再放开前端业务展示。

## 4. 风险条目（P0/P1）

| 风险ID | 级别 | 风险描述 | 影响 | 处置建议 |
| --- | --- | --- | --- | --- |
| P0-SS-01 | P0 | 同一 key 多个中文译名（如 `subsystemInfo`/`subsystemSummary` 混译） | 前端提示不一致，排障误导 | 强制使用本字典标准中文名，别名统一归并。 |
| P0-SS-02 | P0 | 技术中间 key 直接业务化展示（如 `ruleMetrics`） | 用户误以为是业务指标而非数据链路状态 | `ruleMetrics/dashboardOverview/anomalySummary` 仅用于诊断语境。 |
| P1-SS-01 | P1 | 新增 `metric.*` 未同步字典 | 动态提示退化为原始英文 key | 接入动态模板并定期从 field-dictionary 补齐中文名。 |
| P1-SS-02 | P1 | 未收录 key 被默认“成功业务化” | 口径不透明，语义漂移 | 对未收录 key 强制展示“未收录来源”并打风险标。 |

## 5. 前端接入示例（伪代码）

```ts
// 假设已加载 docs/source-status-key-dictionary-v1.json 为 dict
function resolveSourceKeyMeta(item: { key?: string; endpoint?: string; ok?: boolean; error?: string | null }) {
  const rawKey = String(item.key || "unknown");
  const direct = dict.keyMap[rawKey];

  if (direct) {
    return {
      key: rawKey,
      zhName: direct.zhName,
      sourceEndpoint: item.endpoint || direct.sourceEndpoint,
      semantics: direct.semantics,
      failHint: direct.failHint
    };
  }

  const metricMatch = rawKey.match(/^metric\.([a-z0-9_]+)$/);
  if (metricMatch) {
    const metricField = metricMatch[1];
    const fieldCn = dict.metricFieldCnMap[metricField] || metricField;
    return {
      key: rawKey,
      zhName: `规则指标：${fieldCn}`,
      sourceEndpoint: item.endpoint || dict.dynamicRules.metric.defaultSourceEndpoint,
      semantics: "规则引擎动态指标可用性状态。",
      failHint: `${fieldCn}指标不可用，请检查字段映射或上游链路。`
    };
  }

  return {
    key: rawKey,
    zhName: `${dict.fallback.zhName}（${rawKey}）`,
    sourceEndpoint: item.endpoint || null,
    semantics: dict.fallback.semantics,
    failHint: dict.fallback.failHint
  };
}
```


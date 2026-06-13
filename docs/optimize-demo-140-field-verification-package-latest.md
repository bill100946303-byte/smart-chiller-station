# 140/B25 /optimize-demo 现场复核交付包

- 结论：FIELD_VERIFICATION_PACKAGE_READY
- 站点：140
- BFF：http://127.0.0.1:8787
- 生成时间：2026-06-13T01:34:50.855Z
- 请求：load=1422kW, outdoor=22.9℃, mode=cooling

## 1. 交付定位

把 AI 优化建议的 B/C 档数据缺口转成现场可执行、可验收的点位/资料复核任务。

| 项 | 当前口径 |
| --- | --- |
| 诊断可行性 | 4 可做 V1 / 5 疑似判断 / 1 补点 |
| 现场复核任务 | 4 P0 / 3 P1 |
| 控制边界 | read_only_point_verification_only |
| 推进决策 | 先完成 P0 复核，再提高 Advisor 置信度；未闭合前不得把 shadow 建议升级为 assisted/enforced。 |

## 2. 现场复核任务

| 优先级 | 任务 | 复核对象 | 责任角色 | 验收标准 | 边界 |
| --- | --- | --- | --- | --- | --- |
| P0 | 制定主机组合样本采集计划 | CH4+CH5+CH7 等当前组合及候选组合 | 节能工程师 / 运行值班员 | 每个候选组合形成 >=30 条低置信可用样本，>=100 条才允许高置信表达。 | 多机运行无单台冷冻水流量时仍只评价组合，不拆单台 COP，不自动启停主机。 |
| P0 | 确认 PLC 泵频保护与回退点 | 冷冻泵频率目标点、回退点、最小流量、频率上下限、斜率限制 | PLC 工程师 / 自控工程师 | approve/rollback 点名、反馈点和 PLC 本地保护均完成映射并通过只读核对。 | 未完成前只允许 shadow 记录和人工复核，不允许 assisted/enforced。 |
| P0 | 补传感器校准与安装位置台账 | 冷量表、总功率表、冷冻/冷却供回水温度、湿球温度 | 自控工程师 / 计量校准人员 | 形成点位-位置-量程-校准日期-责任人台账，并能对应到 BFF 点位 key。 | 只用于提高诊断置信度，不自动修正测点、不替代现场校验。 |
| P0 | 闭合末端安全信号 | 代表房间温度、末端阀位、末端压差、缺冷投诉/工单 | 自控工程师 / 运维值班负责人 | 泵降频前可读取末端安全状态，并能明确缺冷时阻断建议。 | 只作为降泵前置保护证据；未闭合前不允许 assisted/enforced，不生成真实降泵命令。 |
| P1 | 补支路水力历史趋势 | 支路流量、支路回水压力、支路供回水温度、旁通阀开度 | 自控工程师 / 水系统调试工程师 | 支路趋势至少覆盖 24h，并能与站级低温差窗口对齐。 | 没有末端阀位/室温时，不直接判定末端阀门故障。 |
| P1 | 补控制命令/反馈与启停事件台账 | 供水温设定/反馈、泵塔频率命令/反馈、旁通阀命令/反馈、主机/泵/塔启停事件 | 自控工程师 / PLC 工程师 | 命令、反馈、运行状态、启停事件和参数台账可按同一时间轴对齐。 | 只用于复核控制震荡风险，不自动改 PID，不自动启停设备。 |
| P1 | 补冷却塔现场巡检和长周期分摊 | 塔单元流量、风机频率/功率、阀门状态、填料/布水巡检 | 运行值班员 / 节能工程师 | 塔单元趋势和现场巡检记录可支撑单塔能力差异复核。 | 只作为塔能力诊断证据，不突破厂家/PLC 最低水温保护。 |

## 3. 任务证据模板

| key | 优先级 | 需补数据 | 需提交证据 | 现场状态 | 证据路径/系统 | 复核人 | 复核结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chiller-combination-sampling-plan | P0 | 组合历史样本 / 当前组合连续运行时间 / 同工况人工切换验证 | 组合连续运行时长 / 同负荷/湿球 band / 组合 COP / 冷站 COP / 人工切换记录 | 待现场复核 |  |  |  |
| plc-pump-protection-mapping | P0 | 末端阀位/室温/压差 / 支路历史趋势 / 真实 PLC 降泵保护状态 | 真实 PLC/SCADA 点名 / 回退目标 / 本地联锁 / 最小流量保护 / 频率反馈 | 待现场复核 |  |  |  |
| sensor-calibration-installation-ledger | P0 | 传感器校准记录 / 安装位置台账 / 冗余仪表或现场热平衡复核 | 点位编号 / 安装位置 / 量程 / 最近校准日期 / 校准责任人 | 待现场复核 |  |  |  |
| terminal-safety-signal-closure | P0 | 代表房间温度 / 末端阀位 / 末端压差 / 缺冷投诉/工单联动 | 至少一类末端安全信号可读 / 采样周期 / 缺冷判定阈值 / 与泵频建议的闭锁关系 | 待现场复核 |  |  |  |
| branch-hydraulic-history-window | P1 | 支路历史趋势 / 末端阀位 / 末端压差 / 代表房间温度 | 24h 支路趋势 / 采样周期 / 支路与末端区域映射 / 异常窗口标记 | 待现场复核 |  |  |  |
| control-command-feedback-event-window | P1 | 高频历史 / 控制命令历史 / PID 参数 / 精确启停事件 | 高频命令/反馈趋势 / PID/死区/斜率/延时参数 / 精确启停事件 / 最小运行/停机时间 | 待现场复核 |  |  |  |
| tower-field-inspection-ledger | P1 | 塔单元长周期分摊 / 填料/布水现场巡检 / 厂家最低冷凝器进水温确认 | 塔单元长周期趋势 / 塔阀开到位 / 填料/布水状态 / 最低冷凝器进水温确认 | 待现场复核 |  |  |  |

## 4. 控制震荡台账模板

用途：control_oscillation_field_ledger_template_v1；责任角色：自控工程师 / PLC 工程师 / 运行值班负责人。

边界：模板只用于补齐控制震荡诊断证据，不自动改 PID，不自动启停设备，不写真实 PLC。

验收：

- 高频趋势、启停事件和参数台账可按同一时间轴对齐。
- 采样周期建议 <= 60 秒；若只能小时级，控制震荡仍只能方向性判断。
- 任何 PID、死区、延时或启停参数调整必须由人工审批和 PLC 本地保护兜底。

### 控制命令/反馈高频趋势

CSV：`docs/optimize-demo-140-control-command-feedback-template-latest.csv`

| 字段 | 中文名 | 必填 | 示例 |
| --- | --- | --- | --- |
| timestamp | 采样时间 | 是 | 2026-06-13T10:00:00+08:00 |
| siteId | 站点ID | 是 | 140 |
| loopKey | 控制回路 | 是 | chilled_water_delta_t |
| equipmentType | 设备类型 | 是 | chilled_pump |
| equipmentId | 设备ID | 是 | CHP4 |
| signalRole | 信号角色 | 是 | frequency_command |
| pointCode | 点位编码 | 是 | B25_AI_CHWP_FREQ_CMD |
| pointName | 点位名称 | 是 | 冷冻泵频率命令 |
| value | 数值 | 是 | 40.0 |
| unit | 单位 | 是 | Hz |
| controlMode | 控制模式 | 否 | auto |
| sampleIntervalSec | 采样周期秒 | 是 | 60 |
| qualityFlag | 质量标记 | 是 | good |
| sourceSystem | 来源系统 | 是 | SCADA |
| remark | 备注 | 否 | 同一时间轴对齐 |

### 设备启停事件台账

CSV：`docs/optimize-demo-140-start-stop-event-template-latest.csv`

| 字段 | 中文名 | 必填 | 示例 |
| --- | --- | --- | --- |
| eventAt | 事件时间 | 是 | 2026-06-13T10:15:00+08:00 |
| siteId | 站点ID | 是 | 140 |
| equipmentType | 设备类型 | 是 | chiller |
| equipmentId | 设备ID | 是 | CH7 |
| eventType | 事件类型 | 是 | start |
| previousStatus | 前状态 | 否 | off |
| nextStatus | 后状态 | 是 | on |
| commandSource | 命令来源 | 否 | operator |
| reasonCode | 原因码 | 否 | load_increase |
| runMinutesBeforeEvent | 事件前运行分钟 | 否 | 180 |
| stopMinutesBeforeEvent | 事件前停机分钟 | 否 | 240 |
| alarmActive | 是否有告警 | 是 | false |
| sourceSystem | 来源系统 | 是 | SCADA |
| remark | 备注 | 否 | 用于最小运行/停机时间统计 |

### PID/死区/延时参数台账

CSV：`docs/optimize-demo-140-control-parameter-template-latest.csv`

| 字段 | 中文名 | 必填 | 示例 |
| --- | --- | --- | --- |
| effectiveAt | 生效时间 | 是 | 2026-06-13T09:00:00+08:00 |
| siteId | 站点ID | 是 | 140 |
| loopKey | 控制回路 | 是 | tower_fan_tcws |
| equipmentType | 设备类型 | 否 | cooling_tower |
| equipmentId | 设备ID | 否 | CT1 |
| parameterKey | 参数键 | 是 | deadband_c |
| parameterName | 参数名称 | 是 | 冷却水温控制死区 |
| value | 参数值 | 是 | 0.5 |
| unit | 单位 | 否 | ℃ |
| previousValue | 上一值 | 否 | 0.8 |
| rollbackValue | 回退值 | 否 | 0.8 |
| changeTicket | 变更单号 | 否 | field-review-001 |
| approvedBy | 批准人 | 否 | 现场负责人 |
| sourceSystem | 来源系统 | 是 | PLC/SCADA |
| remark | 备注 | 否 | 仅记录参数台账，不自动写入 |


## 5. 只读边界

- 不创建执行单
- 不审批
- 不 dispatch
- 不写真实 PLC
- 不自动启停主机
- 不进入 enforced
- 不计算多机单台 COP
- 不判定设备故障
- 不自动改 PID
- 不自动启停设备

## 6. 推荐推进顺序

- 1. 先闭合 P0 复核：制定主机组合样本采集计划；确认 PLC 泵频保护与回退点；补传感器校准与安装位置台账；闭合末端安全信号；验收：P0 任务均形成现场证据、责任人和复核日期。
- 2. 补齐 P1 趋势和巡检证据：补支路水力历史趋势；补控制命令/反馈与启停事件台账；补冷却塔现场巡检和长周期分摊；验收：支路趋势和塔巡检证据能与 24h 运行窗口对齐。
- 3. 回灌 /optimize-demo 置信度：仅把证据用于提高诊断置信度和 shadow 对比质量，不新增真实 PLC 写入链路。；验收：Advisor 仍保持 read_only/shadow，页面和报告不出现自动启停或 enforced 承诺。

## 7. 诊断矩阵摘要

| 项 | 值 |
| --- | --- |
| Advisor 状态 | partial |
| 执行模式 | read_only |
| 矩阵总项 | 10 |
| 可做 V1 | 4 |
| 只能疑似判断 | 5 |
| 暂不能做/补点 | 1 |
| 矩阵控制边界 | read_only_or_shadow_only |
| 复核清单边界 | read_only_point_verification_only |

## 8. 阻断项

- 无

## 9. 警告

- 无

## 10. 验收口径

- 这份交付包只读取 /optimize 建议响应，不创建、审批、dispatch 或 rollback 执行单。
- P0 未闭合前，泵频、主机组合和塔 Approach 只能保持 read_only/shadow。
- 多机运行且无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆分单台主机 COP。
- 仪表偏移、水力平衡、阀门和主机健康类诊断只输出复核建议，不直接判定设备故障。
- 控制震荡台账模板只用于补齐诊断证据，不自动改 PID，不自动启停设备。

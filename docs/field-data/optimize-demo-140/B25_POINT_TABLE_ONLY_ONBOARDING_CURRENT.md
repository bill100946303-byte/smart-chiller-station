# B25 点位表驱动接入口径

## 1. 当前目标

现场只提供 `B25通讯表V4.6.xlsx`，不再要求现场额外填写 4 张 CSV。

系统侧目标改为：

- 用通讯表自动生成点位字典、设备清单、报警点和读写风险清单。
- 用现有 BFF / SCADA / historian 能拿到的数据自动补趋势证据。
- 现场只确认少量高风险点语义，不做大规模人工填表。
- 在缺趋势、校准、PID 参数、启停事件时，不把任务退回现场填表；系统只降低置信度并锁定 assisted/enforced。

## 2. 已能从点位表完成的工作

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| PLC/Modbus 点位字典 | 已生成 | `b25-communication-v46-point-dictionary-normalized.csv` |
| /optimize-demo 关键点位 | 已生成 | `b25-communication-v46-optimize-key-points.csv` |
| 设备清单 | 已生成 | `b25-communication-v46-device-list.csv` |
| 麦克故障点 | 已生成 | `b25-communication-v46-mcquay-fault-points.csv` |
| 写点风险清单 | 已生成 | `b25-point-table-only-write-risk-review-list.csv` |
| 最小现场确认清单 | 已生成 | `b25-point-table-only-minimal-confirmation.csv` |

## 3. 不能再要求现场手工补的表

原计划的 4 张正式现场 CSV 不再作为下一步主目标：

| 原 CSV | 新处理方式 |
| --- | --- |
| `sensor-calibration-installation.csv` | 暂不要求现场填写；校准/安装位置未知时，只降低仪表偏移诊断置信度 |
| `control-command-feedback.csv` | 优先从 BFF/SCADA 历史趋势自动抽取；抽不到则保持趋势证据缺口 |
| `start-stop-event.csv` | 优先从运行状态变化、告警/操作记录推导；抽不到则保持启停事件缺口 |
| `control-parameter.csv` | 优先从通讯表和 PLC 参数点识别；无法确认 PID/死区/延时则不做自动调参 |

这些缺口不能成为让现场填大量表格的理由，只能成为系统边界：

- 不承诺节能量。
- 不判定仪表故障。
- 不自动改 PID。
- 不自动启停设备。
- 不打开 enforced。

## 4. 最少需要现场确认的 6 个问题

现场只需回答或截图确认以下问题：

| 序号 | 问题 | 系统影响 |
| --- | --- | --- |
| 1 | `SY-1-509-41413` 写入后，PLC 是否采纳为冷却水回水/Tcws 目标？ | 未确认前 Tower Approach 只允许 shadow |
| 2 | `SY-1-509-41325` 手自动模式是否影响 `41413` 采纳？ | 模式点禁写，只用于边界判断 |
| 3 | `CHP/CWP 频率修正` 是偏置量还是绝对频率？PLC 是否已有上下限、斜率、最小流量保护？ | 未确认前泵 Delta-T 只允许 shadow |
| 4 | 泵/塔频率反馈点系数 `0.1` 是否等于变频器实际频率？ | 未确认前只作低置信趋势证据 |
| 5 | AI 系统是否明确禁止写主机/泵/塔手动启停和手自动模式点？ | 所有启停/模式类写点加入禁写清单 |
| 6 | 项目是否接受“只提供点位表，不额外填趋势/校准/PID表”的工作边界？ | 系统转为点位表驱动接入 |

## 5. 对当前优化功能的影响

### 冷却塔 Approach

点位表确认：

- `SY冷却回水手动值`：`SY-1-509-41413`，`RW`，权限 `1`。
- `SY冷却回水目标值`：`SY-1-509-41415`，`R`，权限 `0`。
- `SY冷却回水自动值`：`SY-1-509-41417`，`R`，权限 `0`。
- `SY冷却塔温度手自动`：`SY-1-509-41325`，`RW`，权限 `1`，高风险模式类写点。

结论：

- 目前没有独立 `AI_Tcws_Target` 或 `AI_Approach_Target`。
- 可写候选仍是“冷却回水手动值”，不是 AI 专用目标点。
- 保持 `GO_SHADOW` / 人工审阅，不打开 `enforced`。

### 泵 Delta-T

点位表确认：

- 冷冻泵频率修正：`SY-1-509-41307` 到 `SY-1-509-41312`。
- 冷却泵频率修正：`SY-1-509-41313` 到 `SY-1-509-41318`。
- 频率反馈点存在，反馈系数多为 `0.1`。

结论：

- 可以作为 pump delta-T shadow 候选点。
- 但未确认“频率修正”语义和 PLC 保护前，不能进入 assisted。

## 6. 下一步系统目标

下一步不再是“催现场填表”，而是：

1. 将 `B25通讯表V4.6` 派生点位字典接入 BFF runtime point dictionary。
2. 用点位字典自动生成 `/optimize-demo` 的点位证据、禁写清单和 shadow 控制候选。
3. 从现有 BFF/SCADA 历史接口自动抽取趋势、启停和反馈数据。
4. 现场只回答 6 个确认问题。
5. 在确认前，系统维持 read-only / shadow-only。

## 7. 当前交付文件

- `B25通讯表V4.6初审结论.md`
- `b25-communication-v46-point-dictionary-normalized.csv`
- `b25-communication-v46-optimize-key-points.csv`
- `b25-communication-v46-device-list.csv`
- `b25-communication-v46-mcquay-fault-points.csv`
- `b25-point-table-only-write-risk-review-list.csv`
- `b25-point-table-only-minimal-confirmation.csv`


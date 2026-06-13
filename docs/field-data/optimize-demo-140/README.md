# 140 现场 CSV 投放说明

更新时间：2026-06-13

## 1. 用途

本目录用于 `/optimize-demo` 的现场证据投放：

- 控制证据：支撑控制震荡、频繁启停和 PID/死区/延时参数复核。
- 仪表证据：支撑仪表偏移 V1 的传感器校准与安装位置复核。
- 主机组合采样清单：支撑 `CH4+CH5+CH7` 基线组合和候选对比组合的人工采样闭环。

边界必须保持：

- 只做 CSV 预检、正式导入 gate 和只读诊断证据。
- 不自动改 PID。
- 不自动修正测点或补偿仪表读数。
- 不自动启停主机、水泵或冷却塔。
- 不写真实 PLC。
- 不创建、批准或下发 shadow 执行单。

`templates/` 目录只放现场填表/导出对齐用的表头模板，不属于正式证据。不要把模板文件改名后直接作为现场证据投放；正式证据必须来自 SCADA/PLC/上位机导出或现场台账确认。

## 2. 正式 CSV 必须投放的文件

请把现场 SCADA/PLC/上位机导出的 4 张正式 CSV 放到本目录，并保持以下固定文件名。它们分为 1 张仪表证据和 3 张控制证据。

### 2.1 仪表证据

| 文件名 | 内容 | 最低采样/时间要求 |
| --- | --- | --- |
| `sensor-calibration-installation.csv` | 冷量、功率、温度、流量、压力、湿球等关键仪表的点位编码、安装位置、量程、最近/下次校准日期、责任人 | 现场台账确认，不是实时趋势 |

该文件不是 PLC 点表，不用于写入控制系统；它只用于回答“这个疑似偏移点有没有校准记录、装在哪里、量程是否合理”。

可先用 `templates/sensor-calibration-installation.template.csv` 对齐表头，再由现场填入真实台账并另存为 `sensor-calibration-installation.csv`。模板本身不作为现场证据。

### 2.2 控制证据

| 文件名 | 内容 | 最低采样/时间要求 |
| --- | --- | --- |
| `control-command-feedback.csv` | 控制命令和反馈高频趋势，例如泵频给定/反馈、阀位给定/反馈、运行反馈 | 建议采样周期 `<= 60s` |
| `start-stop-event.csv` | 设备启停事件，例如主机、水泵、冷却塔启停 | 事件时间必须准确到分钟级，最好到秒级 |
| `control-parameter.csv` | PID、死区、延时、斜率、最小运行/停机时间等参数台账 | 记录当前生效值，最好包含上一值和回退值 |

可先用以下模板对齐表头，再由现场用 SCADA/PLC/上位机真实导出或台账填入数据，并另存为正式文件名：

| 正式文件 | 表头模板 |
| --- | --- |
| `control-command-feedback.csv` | `templates/control-command-feedback.template.csv` |
| `start-stop-event.csv` | `templates/start-stop-event.template.csv` |
| `control-parameter.csv` | `templates/control-parameter.template.csv` |

不要在本目录放空 CSV 或仅表头 CSV。空文件会让预检进入 `BLOCKED`，不能作为现场证据。

## 2.3 主机组合采样辅助文件

主机组合样本由 BFF append-only 样本库和只读检查命令管理，本目录不直接导入组合样本。现场人工复核可使用：

| 文件 | 内容 | 用途 |
| --- | --- | --- |
| `CHILLER_COMBINATION_FIELD_COLLECTION.md` | 140 主机规格、候选组合、采样条件、禁止项 | 给现场值班员/运维负责人做采样执行边界 |
| `templates/chiller-combination-sampling-log.template.csv` | 主机组合采样窗口记录表头 | 用于人工 shadow 对比、SCADA 报表编号和窗口指标留痕 |

主机组合采样不是启停计划；AI 不为了采样自动切换主机，不写真实 PLC，不拆多机单台 COP。

## 3. 表头要求

导入器支持中文和英文表头别名。现场导出文件不需要完全使用标准字段名，但必须能映射到下列最低字段。

### 3.1 控制命令/反馈高频趋势

最低字段：

| 标准字段 | 可接受表头示例 | 说明 |
| --- | --- | --- |
| `timestamp` | `采样时间`、`时间`、`采集时间`、`timestamp`、`ts` | 采样时间 |
| `loopKey` | `控制回路`、`回路`、`loop` | 例如 `chilled_pump_dp_control`、`tower_fan_control` |
| `equipmentType` | `设备类型`、`类型`、`deviceType` | 例如 `pump`、`tower`、`chiller`、`valve` |
| `equipmentId` | `设备ID`、`设备编号`、`设备` | 例如 `CHWP-1`、`CT-2` |
| `signalRole` | `信号角色`、`角色`、`点位角色` | 例如 `frequency_command`、`frequency_feedback`、`valve_position_command`、`valve_position_feedback` |
| `pointCode` | `点位编码`、`点名`、`tag`、`point` | PLC/SCADA 点名 |
| `pointName` | `点位名称`、`名称`、`描述` | 人可读点位名称 |
| `value` | `数值`、`值`、`当前值`、`采样值` | 采样值 |
| `unit` | `单位`、`uom` | 例如 `Hz`、`%`、`bool` |
| `sampleIntervalSec` | `采样周期秒`、`采样周期`、`intervalSec` | 缺省可按 60s 处理，但建议现场明确提供 |
| `qualityFlag` | `质量标记`、`质量`、`quality` | 建议提供 `good/bad/stale` |
| `sourceSystem` | `来源系统`、`来源`、`系统` | 例如 `SCADA`、`PLC historian` |

`signalRole` 支持常见中文归一：`频率命令`、`频率给定`、`频率反馈`、`阀位命令`、`阀位反馈`、`运行反馈`。

### 3.2 设备启停事件台账

最低字段：

| 标准字段 | 可接受表头示例 | 说明 |
| --- | --- | --- |
| `eventAt` | `事件时间`、`启停时间`、`发生时间`、`timestamp` | 启停发生时间 |
| `equipmentType` | `设备类型`、`类型`、`deviceType` | 例如 `chiller`、`pump`、`tower` |
| `equipmentId` | `设备ID`、`设备编号`、`设备` | 例如 `CH4`、`CH5`、`CH7` |
| `eventType` | `事件类型`、`启停类型`、`动作` | 必须可归一为 `start` 或 `stop` |
| `nextStatus` | `后状态`、`新状态`、`当前状态` | 必须可归一为 `on` 或 `off` |
| `alarmActive` | `是否有告警`、`告警`、`告警状态` | 建议提供 `true/false` |
| `sourceSystem` | `来源系统`、`来源`、`系统` | 例如 `SCADA`、`PLC event log` |

建议补充字段：`previousStatus`、`commandSource`、`reasonCode`、`runMinutesBeforeEvent`、`stopMinutesBeforeEvent`。这些字段用于判断最小运行/停机时间和频繁启停风险。

`eventType` 支持中文归一：`启动`、`开机`、`开` -> `start`；`停止`、`停机`、`关` -> `stop`。

### 3.3 PID/死区/延时参数台账

最低字段：

| 标准字段 | 可接受表头示例 | 说明 |
| --- | --- | --- |
| `effectiveAt` | `生效时间`、`设置时间`、`参数时间`、`修改时间` | 参数当前生效时间 |
| `loopKey` | `控制回路`、`回路`、`loop` | 参数所属回路 |
| `parameterKey` | `参数键`、`参数编码`、`参数ID`、`parameter` | 例如 `kp`、`ki`、`deadband`、`delay_sec`、`min_on_min` |
| `parameterName` | `参数名称`、`参数描述` | 人可读名称 |
| `value` | `参数值`、`数值`、`值` | 当前生效值 |
| `sourceSystem` | `来源系统`、`来源`、`系统` | 例如 `PLC backup`、`SCADA setting` |

建议补充字段：`equipmentType`、`equipmentId`、`unit`、`previousValue`、`rollbackValue`、`changeTicket`、`approvedBy`。缺 `rollbackValue` 或 `approvedBy` 时可以预检，但会保留 warning，不能作为参数调整依据。

### 3.4 传感器校准/安装位置台账

最低字段：

| 标准字段 | 可接受表头示例 | 说明 |
| --- | --- | --- |
| `pointCode` | `点位编码`、`点名`、`tag` | BFF/SCADA 可映射的点位编码 |
| `pointName` | `点位名称`、`名称`、`描述` | 人可读点位名称 |
| `sensorType` | `仪表类型`、`传感器类型` | 例如 `temperature`、`flow`、`power`、`wet_bulb`、`pressure` |
| `location` | `安装位置`、`区域`、`机房位置` | 现场安装区域 |
| `installPosition` | `安装点描述`、`探头位置`、`测点位置` | 具体安装点，如“冷冻水供水总管出站侧” |
| `lastCalibrationDate` | `最近校准日期`、`校准日期` | 最近一次校准日期 |
| `calibrationDueDate` | `下次校准日期`、`校准有效期` | 校准到期日期 |
| `owner` | `责任人`、`维护人` | 现场责任人 |
| `sourceSystem` | `来源系统`、`来源` | 例如 `field_ledger`、`SCADA` |

建议补充字段：`systemSide`、`equipmentId`、`unit`、`rangeLow`、`rangeHigh`、`accuracyClass`、`calibrationProvider`、`remark`。缺量程、精度或关键仪表类型覆盖不足时，预检会进入 `PARTIAL` 或保留 warning。

## 4. 校验流程

1. 发给现场前，先检查采集包本身是否完整：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-field-collection-package
```

该命令只检查说明文件、模板、正式输入位置和边界文案；缺正式 CSV 只作为 warning，不把模板当现场证据。

2. 放入 4 张正式现场 CSV：`sensor-calibration-installation.csv`、`control-command-feedback.csv`、`start-stop-event.csv`、`control-parameter.csv`。
3. 运行预检：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-field-data-preflight
```

该命令会统一运行传感器台账预检和 3 张控制台账导入器预检；当前总报告路径为 `docs/optimize-demo-140-field-data-preflight-latest.json/md`。如果任一正式 CSV 缺失，总状态保持 `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS`。

4. 预检达到 `FIELD_DATA_PREFLIGHT_READY` 后，再运行正式导入 gate：

```bash
npm --prefix apps/chiller-bff run promote:optimize-demo-140-field-data-ledgers
```

5. 如需单独调试传感器校准/安装位置台账，运行：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-sensor-ledger-preflight
```

该命令只读取 `sensor-calibration-installation.csv`，输出隔离报告，不覆盖控制台账，不写 PLC。正常现场流程优先跑第 3 步的 4 文件总预检。

6. 如需先验证传感器台账预检 READY 路径，运行：

```bash
npm --prefix apps/chiller-bff run check:optimize-demo-140-sensor-ledger-ready-smoke
```

该命令使用 `tmp/` 下生成的样例台账，只验证字段映射和报告链路；输出 `docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.json/md`，不覆盖正式 `sensor-ledger-preflight-latest`，不能作为现场实测证据。

7. 复核 `/optimize-demo`：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-readiness
```

8. 甲方演示前做只读客户端验收：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 APP_BASE_URL=http://127.0.0.1:3001 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-client-demo-readiness
```

9. 每日复核主机组合样本覆盖：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-chiller-sampling-plan
```

该命令只读查询 append-only 样本库，不调用会写样本的 `POST /optimize`。

## 5. 状态口径

| 状态 | 含义 | 下一步 |
| --- | --- | --- |
| `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT` | 现场采集包说明、模板和边界口径完整，可发给现场采集 | 正式 CSV 到手后再跑对应 preflight |
| `FIELD_COLLECTION_PACKAGE_BLOCKED` | 采集包缺说明、模板或关键边界文案，或正式输入疑似只复制了模板表头 | 修正文档/模板或删除无效正式输入 |
| `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS` | 4 张正式 CSV 未放齐，或环境变量未指向真实文件 | 补齐现场导出文件 |
| `FIELD_DATA_PREFLIGHT_READY` | 传感器台账与 3 张控制台账均可读、字段可映射、无 blocker/warning | 可以运行正式导入 gate |
| `FIELD_DATA_PREFLIGHT_PARTIAL` | 文件可读但有 warning，例如采样周期不足、缺回退值或审批人 | 人工复核后再决定是否正式导入 |
| `FIELD_DATA_PREFLIGHT_BLOCKED` | 缺必填字段、事件类型非法或 CSV 无法解析 | 修正现场导出格式 |
| `FIELD_DATA_PROMOTE_READY` | 已基于预检 READY 的正式 CSV 覆盖正式 latest 证据 | `/optimize-demo` 可读取现场证据 |
| `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT` | 预检未 READY | 不执行正式导入 |
| `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS` | 传感器台账未放入约定路径 | 补 `sensor-calibration-installation.csv` |
| `SENSOR_LEDGER_PREFLIGHT_READY` | 传感器台账可读、字段可映射、无 blocker/warning | 可作为仪表偏移 V1 的复核证据 |
| `SENSOR_LEDGER_PREFLIGHT_PARTIAL` | 台账可读但存在校准过期、缺量程或覆盖不足 | 人工复核后补齐 |
| `SENSOR_LEDGER_PREFLIGHT_BLOCKED` | 缺必填字段或 CSV 无法解析 | 修正现场导出格式 |
| `SENSOR_LEDGER_PREFLIGHT_READY_SMOKE_READY` | 样例台账 READY 路径自检通过 | 只证明工具链可用，不作为现场证据 |

## 6. 工程边界

即使正式导入达到 `FIELD_DATA_PROMOTE_READY`，它也只说明现场控制证据已进入只读诊断链路：

- 可以提升控制震荡/频繁启停复核的证据质量。
- 可以提升仪表偏移 V1 的复核效率和置信度表达。
- 可以减少“缺高频命令/反馈、缺启停事件、缺参数台账”的 blocker。
- 不能直接生成 PID 修改结论。
- 不能直接判定某个仪表坏了。
- 不能自动修正测点或生成补偿值。
- 不能直接生成设备启停建议。
- 不能绕过人工审批、PLC 本地保护、回退点和安全输入确认。

# COOLING_TOWER_APPROACH_L4_PLAN_CURRENT

## 1. 结论先行

“冷却塔接近度（Approach）智能调节”应归入 `L4`，不建议放在当前 `L3`。

原因：

- 这不是单设备规则，而是“冷机 + 冷却塔 + 冷却泵 + 气象边界”的多变量协同控制。
- 需要明确的设备安全边界（最低冷却水温、最小台数、防喘振/防频繁启停）。
- 需要从“建议”升级到“可执行控制”，属于执行层能力，不再是解释型草案。

## 1.1 当前实现状态

截至 2026-04-09，`L4` 已不再停留在纯蓝图阶段，当前状态应拆成三段理解：

- `phase 1 / 只读评审`：已完成
  - BFF draft 已返回 `towerApproachAdvisor`
  - `/optimize-demo` 已展示“接近度执行前检查卡”
- `phase 2 / 治理态半自动链路`：已完成
  - `tower-approach` 专用执行台已持久化
  - 提交 / 审批 / 回退 / 审计闭环已打通
  - dispatch 适配器与 `off / shadow / enforced` 模式已接入
- `phase 3 / 真实控制联调`：未完成
  - 目前仓库内可明确确认的 legacy 控制接口是 `GET /zsqy/qstag/{siteId}/doimplements`
  - 该接口需要 `userId/appId/drTypeId/drId/msg(tagName 级命令串)` 这类设备/寄存器上下文
  - 当前 `tower-approach` 执行记录只持有 `targetApproachC/targetTcwsC/rollbackTarget`
  - 因此真实阻塞点不是“只差一个 endpoint 配置”，而是“缺从优化目标到具体控制点位的映射契约”
  - 现场可写联调与真实回执口径仍待收口

## 2. 与当前分层的对应关系

### L3（当前）

- 已做：历史对标、收益草案、方案评审、风险状态。
- 已做（L3.6）：执行台持久化（SQLite）、审批/回退权限闭环（platform/site_admin）、审计可追溯。
- 只能做：接近度观测、偏差告警、策略建议。
- 不能做：自动下发冷却塔/冷机控制指令。

### L4（目标）

- 在 L3 基础上新增：
  - 接近度目标自动生成（按负荷率 + 湿球区间 + 历史高效带）。
  - 约束求解（最小冷却水温、机组边界、最小风机频率/台数、变更速率）。
  - 人审通过后执行（半自动闭环）。
  - 可回退（一键回退到固定设定或手动模式）。

### L5（后续）

- 全自动闭环 + 自适应学习（含长期模型自校准与跨季节参数迁移）。

## 3. L4 控制目标（专业口径）

### 3.1 优化目标

在满足系统安全边界前提下，最小化综合功率：

`P_total = P_chiller + P_tower_fan + P_cooling_pump`

### 3.2 核心控制量

- 目标冷却塔接近度：`Approach_sp`
- 或等价目标冷却水供水温：`Tcws_sp = Twb + Approach_sp`

### 3.3 关键观测量

- `Twb`：室外湿球温度（建议主用，干球仅作辅助诊断）。
- `Tcws`：冷却水供水温（塔出水）。
- `Tcwd`：冷却水回水温（塔进水）。
- 冷机负荷率、冷机运行台数、冷却塔风机频率/台数、系统 COP。

## 4. L4 约束与保护（必须先落地）

### 4.1 设备边界

- 冷机最小允许冷凝器进水温（按厂家参数表逐型号配置，不允许硬编码一个全站固定值）。
- 冷却塔风机最小稳定频率、最小开塔台数、启停最小间隔。
- 冷却泵最小流量边界（避免偏离水力稳定区）。

### 4.2 控制稳定性

- 设定值变更斜率限制（例如每次调节不超过 `0.2~0.5℃`）。
- 死区控制（Approach 偏差落入死区时不动作，抑制震荡）。
- 异常冻结（传感器抖动/缺测时保持最近安全设定）。

### 4.3 运行状态门禁

- `ready`：关键传感器完整、设备状态稳定、无高等级告警。
- `caution`：允许建议，不允许自动执行。
- `blocked`：禁止优化调节，仅保底运行。

## 5. L4 建议算法（第一版可执行）

### 5.1 目标设定生成

1. 先按请求/实时负荷率定位负荷区间。
2. 在该区间按湿球带匹配历史高效样本，得到 `Approach_ref_low/median/high`。
3. 依据当前风险门禁选取目标：
  - 稳态优先：`Approach_sp = median`
  - 风险偏高：`Approach_sp = max(current, low)`（更保守）
  - 节能窗口明显：可试探向 `high` 侧（需人审）

### 5.2 执行器分配

- 优先用冷却塔风机变频连续调节。
- 台数切换作为二级动作，满足最小启停间隔。
- 需要时联动冷却泵频率，但必须通过最小流量校核。

### 5.3 在线修正

- 每个控制周期评估“预期收益 vs 实际收益”。
- 若连续 N 个周期收益不达标或风险上升，自动退回保守档。

## 6. 与现有系统的接口落点

### 6.1 BFF（先做）

在现有 `/optimize` draft 的 `details` 上仅追加（不改旧语义）。

当前状态：已完成。

- `towerApproachAdvisor`
  - `status`
  - `currentApproachC`
  - `targetApproachC`
  - `targetTcwsC`
  - `guardrails[]`
  - `executionReady`（仅就绪评估，不代表已执行）

说明：当前仍返回 `501 NOT_IMPLEMENTED`，但 `towerApproachAdvisor` 已作为治理态评审输出稳定提供。

### 6.2 前端（先做）

`/optimize-demo` 增加“接近度执行前检查卡”。

当前状态：已完成。

- 当前接近度、目标接近度、边界约束、禁止原因、建议动作。
- 明确标识“未下发控制，仅评审”。

### 6.3 执行层（治理态已完成，真实联调待补）

- 已新增独立执行接口（与 draft 解耦），支持：
  - 提交执行计划
  - 审批确认
  - 执行回执
  - 回退动作
- 已具备：
  - `tower-approach` 专用执行台持久化
  - 专用审批 / 回退路由
  - dispatch 适配器
  - `off / shadow / enforced` 调度模式
- 当前仍缺：
  - `targetApproachC/targetTcwsC -> drTypeId/drId/tagName/msg` 的控制点位映射
  - 真实设备回执语义校验

## 7. 验收指标（L4）

- 运行安全：0 次越界触发（最低温、最小流量、防喘振边界）。
- 稳定性：控制周期内无持续振荡（设定频繁反向切换需低于阈值）。
- 节能性：在可比工况下，综合功率下降且 COP 不劣化。
- 可解释性：每次调节均可追溯到“样本依据 + 约束校核 + 风险门禁”。

## 8. 现阶段建议任务顺序

1. 先确认 `tower-approach` 对应的真实控制点位映射：目标接近度/目标塔出水温应下发到哪些 `drTypeId/drId/tagName`。
   - 模板：`docs/TOWER_APPROACH_CONTROL_MAPPING_TEMPLATE_CURRENT.md`
2. 在映射明确后，再将 dispatch endpoint 收敛到具体 legacy 控制接口，并以 `shadow` 模式联调。
3. 补齐厂家边界参数配置表（按机组型号），确保最小冷凝器进水温按实例/型号可追溯。
4. 在真实回执稳定后，再评估是否进入 `enforced`。
5. 通过一个月现场数据再决定是否推进 L5 全自动。

## 9. 参考资料（用于策略口径对齐）

- ASHRAE Handbook - Cooling Towers (Ch.40):  
  [https://handbook.ashrae.org/Handbooks/S20/IP/s20_ch40/s20_ch40_ip.aspx](https://handbook.ashrae.org/Handbooks/S20/IP/s20_ch40/s20_ch40_ip.aspx)
- ASHRAE Handbook - Supervisory Operation and Optimization (Ch.43):  
  [https://handbook.ashrae.org/Handbooks/A19/SI/a19_ch43/a19_ch43_si.aspx](https://handbook.ashrae.org/Handbooks/A19/SI/a19_ch43/a19_ch43_si.aspx)
- ASHRAE Handbook - Liquid-Chilling Systems (Ch.43):  
  [https://handbook.ashrae.org/Handbooks/S20/SI/s20_ch43/s20_ch43_si.aspx](https://handbook.ashrae.org/Handbooks/S20/SI/s20_ch43/s20_ch43_si.aspx)
- NREL case study on condenser water supply temperature optimization:  
  [https://research-hub.nrel.gov/en/publications/a-case-study-on-condenser-water-supply-temperature-optimization-w](https://research-hub.nrel.gov/en/publications/a-case-study-on-condenser-water-supply-temperature-optimization-w)
- GB 50189 条文说明公开转录（需以正式文本复核）：  
  [https://linxia.gov.cn/Images/Upload/File/20200723/6373114117401523967292275.pdf](https://linxia.gov.cn/Images/Upload/File/20200723/6373114117401523967292275.pdf)

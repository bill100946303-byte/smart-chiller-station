# 140 `/optimize-demo` 甲方演示与验收说明

更新时间：2026-06-13

## 1. 当前结论

140/B25 的 `/optimize-demo` 当前适合做 **AI 优化建议 + 数据边界透明 + shadow 审批演示**。

当前验收结论：

| 项目 | 当前状态 | 对外口径 |
| --- | --- | --- |
| 页面演示 | 可演示 | 可展示 140 站点真实运行态下的优化建议、诊断矩阵和 shadow 治理链 |
| Advisor 合同 | `ADVISOR_CONTRACT_READY` | 主机组合、冷却塔、泵 Delta-T、运行诊断字段结构已稳定 |
| 诊断矩阵 | `DIAGNOSTIC_READINESS_READY` | 当前数据支撑 `4 可做 / 5 疑似 / 1 补点` |
| 现场复核交付包 | `FIELD_VERIFICATION_PACKAGE_READY` | 4 个 P0、3 个 P1 现场复核任务已可导出 JSON/Markdown/HTML |
| 现场采集包 readiness | `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT` | 现场说明、模板和边界口径可发现场；正式 CSV 未投放只作为 warning |
| 登录态 UI | `UI_DIAGNOSTIC_READINESS_READY` | 页面真实显示诊断矩阵和只读边界 |
| shadow suite | `GO_SHADOW_PENDING` | 可进入人工审阅，不代表真实下发 |
| 控制副作用 | `NO_CONTROL_MUTATION` | 检查过程未提交、审批、dispatch 或回退执行单 |
| 真实闭环 | 未开放 | 不自动启停，不写 PLC，不进入 `enforced` |

一句话给甲方：

> 当前已经能演示 AI 如何基于真实运行数据给出优化建议、风险边界和 shadow 验证流程；本阶段不是自动控制系统，只到人工审阅和影子验证。

## 2. 演示前置条件

演示前先确认本机服务：

| 服务 | 当前验证地址 |
| --- | --- |
| BFF | `http://127.0.0.1:8799` |
| 前端 | `http://127.0.0.1:3001` |
| 页面 | `http://127.0.0.1:3001/optimize-demo?siteId=140` |

页面右侧门禁区已显示“甲方演示 readiness”，当前可见结论为 `CLIENT_DEMO_READY_SHADOW_PENDING`，同时展示 `UI_DIAGNOSTIC_READINESS_READY`、`NO_CONTROL_MUTATION` 和 `read-only / shadow` 边界。

页面截图证据：

- `output/playwright/optimize-demo-140-client-demo-readiness.png`

演示前必须跑：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 APP_BASE_URL=http://127.0.0.1:3001 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-client-demo-readiness
```

该命令会聚合诊断 API gate、登录态 UI smoke、现场复核交付包、现场采集包 readiness、140 shadow suite、页面截图证据和文档入口检查，输出：

- `CLIENT_DEMO_READY_SHADOW_PENDING`：可做甲方演示，但仍只到 shadow/人工审阅。
- `NO_CLIENT_DEMO`：停止动态演示，只讲 blockers/warnings 和数据恢复动作。

底层排查命令：

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-field-verification-package
npm --prefix apps/chiller-bff run check:optimize-demo-140-field-collection-package
APP_BASE_URL=http://127.0.0.1:3001 BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-ui-smoke
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-shadow-suite
```

最低放行条件：

| Gate | 必须结果 |
| --- | --- |
| 诊断 API gate | `DIAGNOSTIC_READINESS_READY` |
| 现场复核交付包 | `FIELD_VERIFICATION_PACKAGE_READY` |
| 现场采集包 readiness | `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT` |
| 诊断 UI smoke | `UI_DIAGNOSTIC_READINESS_READY` |
| 140 shadow suite | `GO_SHADOW_PENDING` |
| 甲方演示 readiness | `CLIENT_DEMO_READY_SHADOW_PENDING` |
| 控制副作用 | `NO_CONTROL_MUTATION` |
| tower | `GO_SHADOW` |
| pump | `GO_SHADOW_ONLY` |
| dispatch | 最新 tower/pump 待审单均为 `none` |

任一 gate 不满足，只能演示静态说明和边界，不能演示 shadow 审批链。

## 3. 建议演示顺序

### 3.1 先讲边界

开场先说明：

- 这是 AI 优化建议模块，不是无人值守闭环控制。
- AI 只输出建议、证据、blockers/warnings 和 shadow 验证方案。
- PLC 安全边界和现场人工确认仍是最终控制前置条件。
- 当前不自动启停主机、不真实下发泵频或冷却水目标。

### 3.2 再讲数据资源与诊断可行性

展示“数据资源与诊断可行性”卡片：

| 档位 | 当前数量 | 说明 |
| --- | ---: | --- |
| 可做 V1 | 4 | 已有实时/趋势数据，可做第一版只读诊断或 shadow 证据 |
| 只能疑似判断 | 5 | 缺关键闭环数据，只能输出风险和复核建议 |
| 暂不能做 | 1 | 当前数据不足，只进入点位改造清单 |

对甲方强调：

- 先把数据可信度和系统边界讲清楚，再谈节能。
- B/C 档不是功能缺陷，是工程边界透明化。
- 缺校准记录、末端阀位、支路历史趋势、单泵流量时，不把疑似问题包装成确定故障。

### 3.3 展示运行诊断 Advisor

建议讲 5 类诊断：

| 诊断项 | 当前可讲内容 | 不能越界 |
| --- | --- | --- |
| 仪表数据可信度 | 实时闭合校验、24h 稳态窗口偏移复核 | 不判定传感器已经损坏 |
| 冷冻水水力平衡 | 站级低温差持续性、支路实时离散度、旁通风险 | 不直接判定末端阀门故障 |
| 低温差根因 | 大流量小温差、旁通、支路分配、末端安全缺口排序 | 不自动降泵 |
| 冷却塔能力 | 湿球、Tcws、Approach、塔风机/流量一致性 | 不承诺自动调塔 |
| 主机健康与组合样本 | 当前组合、组合 COP、冷站 COP、样本置信度 | 多机不拆单台 COP |

### 3.4 展示主机组合优化

140 当前主机边界：

| 主机 | 规格/状态 | 演示口径 |
| --- | --- | --- |
| CH1 | 1100RT 旧机 | 状况低于 CH2/CH4，需样本验证 |
| CH2 | 1100RT 旧机 | 旧机中状态较好，可参与候选 |
| CH3 | 1100RT 旧机 | 状况低于 CH2/CH4，需样本验证 |
| CH4 | 1100RT 旧机 | 状态较好，当前运行组合之一 |
| CH5 | 1300RT 次新机 | 当前运行组合之一 |
| CH6 | 停机状态 | 不进入候选组合 |
| CH7 | 1500RT 新机，可跑到 1700RT | 容量余量按 1500RT 名义规格算，1700RT 只作为现场可达上限备注 |

当前运行组合示例：`CH4 + CH5 + CH7`。

必须说明：

- 多机并联且无单台冷冻水流量时，只评价组合 COP / 冷站 COP。
- 单机 COP 只在单台运行窗口学习。
- 组合样本不足时，只能继续采样和 shadow 复核，不能承诺换机节能。

### 3.5 展示冷却塔 Approach shadow

当前可讲：

- tower readiness 为 `GO_SHADOW`。
- 当前可审阅第一步 shadow 目标，不一次跳到最终目标。
- 最低冷凝器进水温边界按 30℃ 保守处理。
- 节能验证用 30-60min 同负荷/相近湿球 band 比较。

不能讲：

- “系统已经自动调塔”。
- “AI 已经真实下发冷却水目标”。
- “绕过最低冷凝器进水温保护可以多省电”。

### 3.6 展示泵 Delta-T shadow-only

当前可讲：

- 泵侧识别到低温差风险，可给出小步长泵频 trim 建议。
- 当前泵侧是 `GO_SHADOW_ONLY`。
- 末端安全、PLC 本地保护、泵频反馈未闭合前，不进入 assisted。

不能讲：

- “可以直接降泵频”。
- “已经接入真实泵频写入点”。
- “不需要末端压差/阀位/室温也能自动调泵”。

## 4. 验收口径

### 4.1 本阶段可以验收

| 验收项 | 验收标准 | 证据 |
| --- | --- | --- |
| 页面可访问 | `/optimize-demo?siteId=140` 登录态可打开 | `check:optimize-demo-diagnostic-ui-smoke` |
| BFF Advisor 合同 | `/optimize` 返回 `200 / OK` 且包含各 Advisor | `check:optimize-demo-140-shadow-suite` |
| 诊断矩阵 | 显示 `4 可做 / 5 疑似 / 1 补点`，现场复核清单显示 `4 P0 / 2 P1` | `docs/optimize-demo-diagnostic-readiness-latest.md` |
| 现场复核交付包 | 6 项复核任务具备责任角色、需补数据、所需证据、验收标准和只读边界 | `docs/optimize-demo-140-field-verification-package-latest.md`、`docs/optimize-demo-140-field-verification-package-latest.html` |
| UI 边界 | 页面可见不写 PLC、不判定设备故障、真实 PLC 下发锁定、现场复核清单只读边界 | `docs/optimize-demo-diagnostic-ui-smoke-latest.json` |
| shadow 治理 | tower/pump 待审单存在且 dispatch 为空 | `docs/optimize-shadow-governance-latest.md` |
| shadow 验证留档 | 人工验证记录可 append-only 保存，pending 记录可补录复核结果，页面提供 Shadow 复核统计、Advisor 类型筛选、执行单 ID 下钻、单次 shadow 复盘摘要和报告ID/校验码核对，并可导出审计 CSV、Markdown 复盘报告和 HTML 打印版；校验码只用于核对导出件，不是电子签名 | `/bff/v1/sites/140/optimize/shadow-verification-records/export`、`/bff/v1/sites/140/optimize/shadow-verification-records/report?executionId=...`、`/bff/v1/sites/140/optimize/shadow-verification-records/report/print?executionId=...` |
| 控制副作用 | suite 前后执行单未被修改 | `NO_CONTROL_MUTATION` |
| 多机 COP 边界 | 文案和 Advisor 均不拆多机单台 COP | `UI_BOUNDARY_COPY_READY` |
| 甲方演示 readiness | 聚合 API、UI、suite、截图证据、文档入口均通过 | `docs/optimize-demo-140-client-demo-readiness-latest.md` |

### 4.2 本阶段不能验收

| 项目 | 原因 |
| --- | --- |
| 自动启停主机 | 未接真实 PLC，且当前范围禁止自动启停 |
| assisted/enforced 控制 | 缺真实目标点、回退点、安全输入、权限和现场调试 |
| 单台主机实时 COP 排名 | 多机运行无单台冷冻水流量 |
| 主机切换节能结论 | 组合历史样本和人工切换验证仍不足 |
| 泵效率百分比 | 缺单泵流量或泵曲线 |
| 末端舒适性保护闭环 | 缺末端阀位、末端压差、代表房间温度或投诉联动 |

## 5. 甲方问答口径

| 甲方问题 | 建议回答 |
| --- | --- |
| 这个 AI 会不会直接控制设备？ | 当前不会。第一版只做建议、shadow 验证和审批演示，不写真实 PLC。 |
| 能不能自动启停主机？ | 当前不能。主机组合 Advisor 只评价组合实测表现和样本置信度，不做自动启停。 |
| 为什么不算每台主机 COP？ | 多机并联时没有单台冷冻水流量，强拆单机 COP 不可靠。当前只算组合 COP / 冷站 COP。 |
| CH7 能跑 1700RT，为什么容量按 1500RT？ | 1500RT 是名义规格，1700RT 是现场可达上限备注。优化容量余量按名义规格保守计算。 |
| 为什么有些诊断只能疑似判断？ | 缺校准记录、末端数据、支路历史或单泵流量时，工程上不能把风险线索说成确定故障。 |
| shadow 验证怎么证明节能？ | 用 30-60min 同负荷/相近湿球 band 比较 stationCop、comboCop、kW/RT、总功率、主机功率和告警数。 |
| 什么时候能进入真实控制？ | 需要现场点表、目标点/回退点、PLC 本地保护、末端安全信号、权限审计和回退流程全部闭合后另行验收。 |

## 6. 现场交付边界

本阶段交付：

- `/optimize-demo` 页面演示。
- BFF Advisor 响应结构。
- 主机组合、冷却塔、泵 Delta-T、运行诊断的只读/影子建议。
- shadow 审批状态和人工审阅清单。
- 数据资源与诊断可行性矩阵。
- 现场复核交付包：JSON、Markdown、HTML 三种导出件，用于甲方/现场按 P0/P1 补点和资料。
- 自动化验收命令和报告。

本阶段不交付：

- 真实 PLC 写入。
- 冷机自动启停。
- 泵频真实自动调节。
- 冷却塔真实目标自动下发。
- 无人值守闭环。
- 合同结算级节能量 M&V。

## 7. 下一阶段现场补齐清单

| 优先级 | 补齐项 | 用途 |
| --- | --- | --- |
| P0 | 主机组合连续运行时间 | 防频繁切换和组合样本有效性判断 |
| P0 | 主机组合历史样本和人工 shadow 切换记录 | 把主机组合从方向性建议升级为可比较建议 |
| P0 | 末端压差/阀位/室温或缺冷投诉 | 泵频 assisted 前的舒适性保护 |
| P0 | PLC 本地限幅、斜率、最小流量、联锁保护状态 | 所有真实下发前的安全兜底 |
| P1 | 传感器校准记录和安装位置台账 | 提高仪表偏移诊断置信度 |
| P1 | 支路历史趋势 | 提高水力平衡诊断置信度 |
| P1 | 真实目标点和回退点点名 | 从 shadow 走向 assisted 的前置 |
| P2 | 单泵流量或泵曲线 | 后续做水泵效率诊断 |

## 8. 演示风险与回退口径

| 风险 | 回退口径 |
| --- | --- |
| 实时数据源短时失败 | 只演示页面结构、边界治理和历史报告，不演示 live shadow 审批 |
| suite 不是 `GO_SHADOW_PENDING` | 停止审批演示，改为讲 blockers/warnings 和数据恢复动作 |
| 页面数据与报告不一致 | 以最新自动化报告为准，重新刷新页面和重跑 gate |
| 甲方要求现场下发 | 明确当前阶段未交付真实下发，需另走 L4/L5 readiness 和现场联调 |
| 甲方要求节能承诺 | 当前只做 shadow 验证，不作为固定节能承诺或合同结算依据 |

结论：140 `/optimize-demo` 当前已经达到“可演示、可解释、可审计、不可误报为闭环控制”的阶段。下一阶段重点不是继续堆页面，而是补现场点位、安全保护和 shadow 样本，把建议逐步变成可验证的受控优化策略。

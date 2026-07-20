# `/optimize-demo` AI 优化建议模块当前功能摘要

更新时间：2026-06-13

## 1. 当前结论

`/optimize-demo` 已经从早期 `NOT_IMPLEMENTED` 草案页，推进为 140/B25 可演示的 AI 优化 Advisor 页面。

最新 live suite 结论为 `GO_SHADOW_PENDING`：页面、Advisor 合同、诊断可行性矩阵、现场采集包 readiness、UI 边界、控制副作用防护、塔侧 shadow、泵侧 shadow-only 和 shadow 治理均通过；检查过程未审批、未 dispatch、未 rollback、未写真实 PLC。

当前可以对外演示：

- 主机组合优化 Advisor：当前组合识别、组合样本积累、组合实测性能排序边界、shadow 建议。
- 冷却塔接近度 Advisor：接近度目标建议、最低冷凝器进水温 guardrail、阻断原因、shadow 审批边界。
- 泵温差/泵频率修正 Advisor：低温差判断、小步长泵频修正建议、shadow 点位映射、末端/PLC 安全前置条件、shadow 单提交/审批/回退演示。
- 运行诊断 Advisor：仪表数据可信度、24h 仪表偏移复核、稳态窗口筛选、水力平衡 V1 风险指示、控制震荡 V1、低温差根因、冷却塔能力、主机健康与组合样本；已把 B/C 档缺口转成现场复核清单。
- 数据资源与诊断可行性矩阵：按 A/B/C 档展示现有 140/B25 数据能做什么、只能疑似判断什么、暂不能做什么。
- 审批治理链：执行单、待审、历史记录、权限门禁；当前只做只读复核，不做本轮 approve/dispatch/rollback。
- Shadow 验证记录：页面展示验证对象、30-60min 同负荷/湿球 band、验证指标、人工记录状态和“不作为固定节能承诺”边界；已支持 append-only 保存、补录复核结果、Shadow 复核统计、Advisor 类型筛选、执行单 ID 下钻、单次 shadow 复盘摘要、报告ID/校验码核对、带 A4 打印样式和甲方/值班员签字确认区的 Markdown 复盘报告导出、HTML 打印版，以及审计 CSV 导出。

当前不能对外承诺：

- 自动启停主机。
- 自动下发 PLC。
- `enforced` 无人值守闭环。
- `assisted` readiness 不等于现场真实下发；缺目标点、回退点、末端安全、PLC 本地保护或泵频反馈时仍禁止下发。
- 多机并联时拆分单台主机实时 COP。
- 组合历史样本不足时承诺换机节能量。

一句话商业口径：

> 当前模块已经适合做“AI 优化建议 + shadow 审批 + 数据边界透明”的工程演示；还不是正式闭环群控系统。

实时数据失败时，对外口径应降级为：

> 当前可演示 AI 优化建议页面、边界治理和只读诊断；完整 shadow 审批演示需等实时数据源恢复并重新通过 suite。

## 2. 140/B25 当前实测证据

本轮使用隔离端口验证：

- BFF：`http://127.0.0.1:8799`
- 前端：`http://127.0.0.1:3001`
- 站点：`SITE_ID=140`

通过命令：

```bash
npm --prefix apps/chiller-bff test
npm --prefix apps/chiller-shell-v1 run build
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:b25-tower-approach-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:pump-delta-t-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-shadow-governance
npm --prefix apps/chiller-bff run check:optimize-demo-ui-boundary-copy
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-readiness
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-field-verification-package
APP_BASE_URL=http://127.0.0.1:3001 BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-diagnostic-ui-smoke
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-shadow-suite
BFF_BASE_URL=http://127.0.0.1:8799 APP_BASE_URL=http://127.0.0.1:3001 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-client-demo-readiness
```

结果：

- BFF 单测：`229/229` 通过。
- 前端 build：通过。
- 塔侧 readiness：`GO_SHADOW`；塔侧数据门禁 `READY 8/8`，报告已列出 dashboard、总功率、总冷量、Tcws、湿球、湿球趋势、塔风机反馈、活跃主机上下文。
- 泵侧 readiness：`GO_SHADOW_ONLY`。
- shadow governance：`GO_SHADOW_PENDING`。
- UI 边界文案：`UI_BOUNDARY_COPY_READY`。
- 诊断可行性矩阵：`DIAGNOSTIC_READINESS_READY`，报告 `docs/optimize-demo-diagnostic-readiness-latest.md`。
- 现场复核交付包：`FIELD_VERIFICATION_PACKAGE_READY`，输出 `docs/optimize-demo-140-field-verification-package-latest.json/md/html`；包含 4 个 P0、3 个 P1 现场复核任务，且只读边界为 `read_only_point_verification_only`。同时输出 3 份控制震荡台账 CSV 模板，并已新增 `import:optimize-demo-140-control-ledgers` 导入器；仅用于现场回填和证据对齐，不自动改 PID、不自动启停、不写真实 PLC。
- 诊断矩阵 UI smoke：`UI_DIAGNOSTIC_READINESS_READY`，报告 `docs/optimize-demo-diagnostic-ui-smoke-latest.json`；该命令只验证登录态页面渲染和 `/optimize` 响应，`optimizeExecution.skipped=true` 表示故意跳过提交、批准、dispatch 和回退链路。
- 140 shadow suite：`GO_SHADOW_PENDING`，其中 Advisor 合同 `ADVISOR_CONTRACT_READY`、诊断可行性矩阵 `DIAGNOSTIC_READINESS_READY`、现场采集包 `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT`、UI 边界文案 `UI_BOUNDARY_COPY_READY`、控制副作用防护 `NO_CONTROL_MUTATION`、塔侧 `GO_SHADOW`、泵侧 `GO_SHADOW_ONLY`、治理 `GO_SHADOW_PENDING`；统一报告 `docs/optimize-demo-140-shadow-suite-latest.md`。
- 甲方演示 readiness：`CLIENT_DEMO_READY_SHADOW_PENDING`，报告 `docs/optimize-demo-140-client-demo-readiness-latest.md`；聚合 API gate、登录态 UI smoke、shadow suite、页面截图证据和演示说明文档入口。
- 页面人工审阅门禁：`/optimize-demo` 已显示 `140 shadow suite`、`NO_CONTROL_MUTATION`、`GO_SHADOW_PENDING` 和一票否决口径；只用于人工复核，不新增真实下发能力。
- 页面甲方演示 readiness：`/optimize-demo` 已显示 `CLIENT_DEMO_READY_SHADOW_PENDING`、`UI_DIAGNOSTIC_READINESS_READY`、`NO_CONTROL_MUTATION` 和 `read-only / shadow` 边界；截图 `output/playwright/optimize-demo-140-client-demo-readiness.png`。
- 页面 Shadow 验证记录：`/optimize-demo` 已显示验证对象、30-60min 同负荷/湿球 band、验证指标、人工记录状态和“不作为固定节能承诺”边界；支持“保存人工验证记录”“补录复核结果”“Shadow 复核统计”“Advisor 类型筛选”“执行单 ID 下钻”“单次 shadow 复盘摘要”“报告校验”“导出复盘报告”“打开打印版”和“导出审计 CSV”；复盘报告含报告ID、SHA256 校验码、A4 打印样式和甲方/值班员签字确认区，校验码只用于核对导出件，不是电子签名。
- 页面数据资源与诊断可行性：`/optimize-demo` 已显示 `可做 V1 / 只能疑似判断 / 暂不能做` 三类矩阵，并新增“现场复核清单”，把传感器校准/安装位置、末端安全、PLC 泵频保护、主机组合采样、支路趋势和塔巡检转成 P0/P1 只读补齐任务；明确“不判定设备故障、不写 PLC”。
- 页面主机组合样本治理：`/optimize-demo` 已显示 `仅基线高置信`、`样本治理`、`候选覆盖`、`0 可比` 和 `候选组合样本缺口`；页面同时保留“不自动启停”“真实 PLC 下发锁定”和多机不拆单机 COP 边界。
- 现场采集包 readiness：`check:optimize-demo-140-field-collection-package` 已生成 `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT`；报告 `docs/optimize-demo-140-field-collection-package-latest.md`；当前 4 个正式 CSV 仍未投放，只说明采集包可发给现场，不代表已有现场证据。
- 页面仪表台账预检：`/optimize-demo` 的“仪表偏移 V1”区域已接入 `sensorLedgerEvidence`，显示传感器校准/安装位置台账状态；当前现场 CSV 未投放时为 `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS`，只提示补资料，不自动修正测点。
- Playwright 已用本地测试 session 进入 `http://127.0.0.1:3004/optimize-demo?siteId=140` 并完成登录态 UI 复验；未点击批准、写入或回退按钮。
- 2026-06-12 23:30 追加运行态复验：BFF `http://127.0.0.1:8799` 已返回 `diagnosticReadinessMatrix`，前端 fallback 到 `http://127.0.0.1:3001/optimize-demo?siteId=140`，页面已显示 `4 可做 / 5 疑似 / 1 补点`、A/A-B/B/C 档位、`不判定设备故障`、`不写 PLC`；未点击批准、写入或回退按钮。截图：`output/playwright/optimize-demo-140-diagnostic-readiness-matrix.png`。
- 2026-06-12 23:35 追加自动化 gate：`check:optimize-demo-diagnostic-readiness` 已固化上述矩阵验收，并纳入 `check:optimize-demo-140-shadow-suite` 组件表；本检查只读取 `/optimize` 建议响应，不创建、审批、dispatch 或 rollback 执行单。
- 2026-06-12 23:50 追加登录态 UI smoke：`check:optimize-demo-diagnostic-ui-smoke` 已进入 `http://127.0.0.1:3001/optimize-demo?siteId=140`，验证页面包含 `数据资源与诊断可行性`、`4 可做 / 5 疑似 / 1 补点`、`不判定设备故障`、`不写 PLC`、`真实 PLC 下发锁定`，并确认 `controlBoundary=read_only_or_shadow_only`；诊断模式未提交、批准、dispatch 或回退执行单。

核心输出：

| 项目 | 结果 |
|---|---|
| Dashboard API | `200`，overall=`partial` |
| 当前 COP | `6.90` |
| 总站功率 | `1739.2 kW` |
| 总制冷量 | `11688.7 kW` |
| `/optimize` API | `200 / OK` |
| `/optimize-demo` Advisor 卡片 | 登录态 UI 复验通过；截图 `output/playwright/optimize-demo-140-shadow-ui-final.png` |
| 数据资源与诊断可行性卡片 | 登录态 UI 复验通过；`4 可做 / 5 疑似 / 1 补点`；截图 `output/playwright/optimize-demo-140-diagnostic-readiness-matrix.png` |
| 诊断可行性自动检查 | `DIAGNOSTIC_READINESS_READY`；报告 `docs/optimize-demo-diagnostic-readiness-latest.md` |
| 现场复核交付包 | `FIELD_VERIFICATION_PACKAGE_READY`；报告 `docs/optimize-demo-140-field-verification-package-latest.md`，HTML `docs/optimize-demo-140-field-verification-package-latest.html`；控制震荡台账 CSV 模板和导入报告已生成 |
| 诊断矩阵 UI smoke | `UI_DIAGNOSTIC_READINESS_READY`；报告 `docs/optimize-demo-diagnostic-ui-smoke-latest.json`；诊断模式跳过提交/审批/回退 |
| 甲方演示 readiness | `CLIENT_DEMO_READY_SHADOW_PENDING`；报告 `docs/optimize-demo-140-client-demo-readiness-latest.md` |
| 甲方演示 readiness 截图 | `output/playwright/optimize-demo-140-client-demo-readiness.png` |
| 运行诊断点位覆盖 | `1215点 / 184设备` |
| 点位识别 | `站点字典已应用` |
| 当前主机组合 | `CH4 + CH5 + CH7` |
| 冷却塔组 | 当前 suite 可进入塔侧 shadow，具体组数以页面实时点位为准 |
| 塔风机 | 塔风机功率 `63.7 kW`；数据门禁已通过 |
| 泵频 shadow 单 | 当前有待审单 `opx-140-1781265213665-wso34v`；140 内置 shadow 映射模板和安全锁已补单测 |
| 接近度 Advisor | `GO_SHADOW`；本次目标 Tcws `28.0℃`，最终 30℃ 需 5 步 shadow；最新待审单 `opx-140-1781266624535-ju3qeb` |
| 趋势页联动 | `range=30d&metric=currentCop` 已同步 |
| 接近度审批卡片 | 可见最低冷凝器进水温边界、目标 Tcws、回退目标；仍不自动 approve/dispatch |
| shadow governance | `docs/optimize-shadow-governance-latest.md`，最新 tower/pump 均为待审且 `dispatch=none` |
| UI 边界文案 | `docs/optimize-demo-ui-boundary-copy-latest.md`，确认可见文案保留 PLC 锁定、shadow、只读诊断和多机不拆单机 COP 边界 |
| shadow suite | `docs/optimize-demo-140-shadow-suite-latest.md`，当前 `GO_SHADOW_PENDING`；现场采集包 `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT`，正式现场 CSV `0/4` 已投放；塔侧数据门禁 `READY 8/8`，控制副作用防护 `NO_CONTROL_MUTATION` |
| 塔侧数据门禁 | `docs/b25-tower-approach-readiness-latest.md`，列出 dashboard、系统总功率、系统总冷量、Tcws、实时湿球、湿球历史趋势、塔风机反馈、活跃主机上下文 |
| 页面人工审阅门禁 | `/optimize-demo` 右侧卡片显示 suite、Advisor 合同、UI 边界、控制副作用、一票否决；无 approve/dispatch/rollback 新入口 |
| 页面 Shadow 验证记录 | `/optimize-demo` 显示验证对象、观察窗口、对比口径、指标、记录状态、结论边界；支持 append-only 保存、结果复核、只读统计摘要、按 Advisor 类型统计、执行单 ID 下钻、单次 shadow 复盘摘要、报告ID/校验码核对、带打印样式和签字确认区的 Markdown 复盘报告导出、HTML 打印版，以及审计 CSV 导出 |
| 主机组合样本治理 | `/optimize-demo` 已渲染 `sampleGovernance`；当前 `CH4+CH5+CH7` 为 `baseline_high_confidence_only`，候选对比组合 `0` 个，不允许表达切换节能承诺 |
| 传感器台账预检 | `check:optimize-demo-140-sensor-ledger-preflight` 已生成 `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS`；报告 `docs/optimize-demo-140-sensor-ledger-preflight-latest.md`；缺 `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv` |
| 传感器台账 READY 自检 | `check:optimize-demo-140-sensor-ledger-ready-smoke` 已通过；报告 `docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.md`；只证明工具链 READY，不作为现场证据 |
| 人工审阅清单 | `docs/OPTIMIZE_DEMO_140_SHADOW_REVIEW_CHECKLIST_CURRENT.md`，列出 shadow approve 前必须复核的 gate、一票否决项和记录模板 |

## 3. 功能完善程度

| 模块 | 当前完成度 | 工程评价 | 下一步 |
|---|---:|---|---|
| 主机组合 Advisor | 76% | 能表达组合实测性能边界；当前组合 `CH4+CH5+CH7` 有效 append-only 样本已超过 100 条，达到该组合自身高置信门槛；具体实时计数以 `docs/optimize-demo-140-chiller-sampling-plan-latest.json` 为准；已补只读样本采集计划检查、现场采样清单和 `sampleGovernance` 页面治理，能区分“基线组合样本充分”和“目标组合样本不足”；可对比目标组合仍为 0，不能给真实切换收益承诺 | 每天运行 `check:optimize-demo-140-chiller-sampling-plan`，优先补 `CH2+CH5+CH7`、`CH5+CH7`、`CH4+CH7` 等候选组合样本和人工切换验证 |
| 冷却塔接近度 Advisor | 80% | 目标值、guardrail、数据门禁和阻断逻辑已成型；当前 live readiness 为 `GO_SHADOW`，30℃边界会自动拆成 5 步 shadow | 用同负荷/相近湿球窗口做 shadow 验证，继续禁止 assisted/enforced |
| 泵温差/泵频 Advisor | 84% | 能基于低温差给小步长修正，shadow 单已能提交/批准/回退；140 已内置 `B25_AI_*` 影子点模板、回退映射和安全输入 TODO 锁 | 把 `B25_AI_*` 替换/绑定为现场真实 PLC/SCADA 点名，接入泵频反馈和末端安全数据源 |
| 运行诊断 Advisor | 97% | 140 点位字典已解决大量误识别，可做 6 类只读诊断；仪表偏移已输出 `driftCandidates/crossChecks/fieldReviewTargets`，并新增 `sensorLedgerEvidence` 传感器校准/安装位置台账预检；水力平衡已输出 `riskIndicators/fieldReviewTargets/reviewBoundary`；控制震荡已输出温差锯齿波/总功率 hunting、高频控制证据缺口和 `ledgerEvidence` 台账导入状态；READY 路径自检已证明导入器可处理现场导出格式；现场复核清单已把关键缺口转成 P0/P1 任务；已新增现场采集包 readiness、现场 CSV 预检 gate、promotion gate、传感器台账预检和 `docs/field-data/optimize-demo-140/README.md` 投放说明，并接入 `/optimize-demo` 页面状态，避免模板样例误覆盖正式 latest | 现场出发前跑 `check:optimize-demo-140-field-collection-package`；控制 CSV 到手后按投放说明放入三张文件；传感器台账到手后放入 `sensor-calibration-installation.csv` 并跑 `check:optimize-demo-140-sensor-ledger-preflight`，把仪表偏移从疑似复核提升为带台账证据的复核 |
| 数据资源与诊断可行性矩阵 | 86% | BFF 已输出 10 项 A/B/C 可行性矩阵，页面已展示可做 V1、只能疑似判断和暂不能做；现场复核清单已生成 P0/P1 点位/资料补齐任务，能防止把缺数据项包装成强结论 | 后续接入真实点位台账、校准记录和末端数据后动态提升档位 |
| 现场复核交付包 | 88% | 已能从 BFF 实时 Advisor 响应生成 JSON/Markdown/HTML 导出件，覆盖责任角色、需补数据、所需证据、验收标准和控制边界 | 后续可接电子签收、附件归档和现场复核状态回写 |
| 审批治理链 | 80% | 本地 shadow 执行单、权限、审批、回退已跑通 | 接入真实权限体系和审计报表 |
| Shadow 验证记录 | 99% | 页面已展示验证对象、30-60min 同工况窗口、指标和人工记录边界；已接入 append-only 保存、结果复核、Shadow 复核统计、Advisor 类型筛选、执行单 ID 下钻、单次 shadow 复盘摘要、报告ID/SHA256 校验码、带打印样式和签字确认区的 Markdown 复盘报告导出、HTML 打印版，以及审计 CSV 导出，且不改变执行单状态 | 下一步做真实 PDF 归档库或电子签名归档；当前校验码不是电子签名 |
| 真实闭环控制 | 0% | 当前明确禁止 | 需另走 L4/L5 readiness，不应在本阶段开启 |

## 4. 数据资源可支持的扩展项

| 扩展项 | 当前数据是否足够 | 可做版本 | 主要缺口 |
|---|---|---|---|
| 仪表数据偏移诊断 | 部分足够 | V1：实时闭合校验 + 24h 稳态窗口 COP/功率/温差趋势偏移复核 + 候选/交叉校验/现场复核对象 + 传感器台账预检状态 | 需要现场投放 `sensor-calibration-installation.csv`；仍需校准记录、传感器安装位置确认 |
| 冷冻水水力平衡诊断 | 部分足够 | V1：站级低温差持续性趋势 + 实时支路流量/温差/压差异常提示 + 风险指示 + 现场复核对象 | 缺支路历史趋势、末端阀位、末端压差、室温趋势 |
| 控制震荡/频繁启停诊断 | 方向性足够 | V1：小时级温差锯齿波、总功率 hunting、频率命令/反馈缺口、启停事件缺口；现场复核包已输出高频命令/反馈、启停事件和控制参数台账模板；Advisor 已展示台账导入状态、接受行数和现场CSV预检状态；field-data preflight 可在不覆盖 latest 的情况下预检真实 CSV；现场投放说明已固定 `control-command-feedback.csv`、`start-stop-event.csv`、`control-parameter.csv` 三张文件 | 当前导入仍为模板示例 `PARTIAL`，缺真实现场导出后的高频命令/反馈、PID 参数、精确启停事件和最小运行时间 |
| 低温差根因诊断 | 部分足够 | V1：持续低温差趋势 + 大流量小温差/旁通/支路分配/末端缺口根因排序 + 泵频 shadow 安全锁 | `B25_AI_*` 仍是影子点模板，缺末端安全数据源和支路历史趋势 |
| 冷却塔能力诊断 | 部分足够 | V1：湿球、冷却出水、塔风机功率/频率、塔流量一致性 | 缺长周期塔单元分摊、填料/布水现场状态 |
| 主机组合优化 | 部分足够 | V1：组合样本排序和 shadow 建议 | 缺组合历史样本、运行时长、同工况人工切换结果 |
| 主机健康劣化诊断 | 部分足够 | V1：同组合/同负荷下组合 COP 漂移 | 多机无单台流量，不能拆单机 COP |
| 水泵效率诊断 | 不完全足够 | V0：频率/功率/压差异常提示 | 需要单泵流量或泵曲线，至少要有稳定压差和流量口径 |
| 阀门卡滞诊断 | 不完全足够 | V0：开度命令/反馈不一致和长期饱和提示 | 需要阀门命令值、反馈值、控制模式和动作历史 |
| 负荷预测 | 部分足够 | V0：短周期趋势预测 | 需要天气预报、日历、运营时段、历史负荷特征 |
| 节能量 M&V | 部分足够 | V1：同负荷/湿球 band 的 shadow 对比 | 需要更长历史样本和可比工况标记 |

上述评估现在已进入 BFF 响应 `operationalDiagnosticsAdvisor.summary.diagnosticReadinessMatrix`，并在 `/optimize-demo` 页面形成“数据资源与诊断可行性”卡片。卡片只做只读解释：A档可做 V1，B档只能疑似判断，C档暂不能做且只进入补点清单。BFF 同时输出 `operationalDiagnosticsAdvisor.summary.fieldVerificationChecklist`，页面展示“现场复核清单”，把数据缺口落成只读点位/资料补齐任务，不触发审批、dispatch 或 PLC 写入。

## 5. 下一阶段建议

优先级建议如下：

| 优先级 | 任务 | 理由 |
|---|---|---|
| P0 | 按 140 主机组合采样计划补候选组合覆盖 | 当前已有 append-only 样本机制和现场采样清单，下一步要补 `CH2+CH5+CH7`、`CH5+CH7`、`CH4+CH7` 等目标组合覆盖，而不是只堆当前组合 |
| P0 | 现场复核 140 的最低冷凝器进水温边界 | 当前已内置 30℃ 保守 shadow 边界；live readiness 已从“单步超过 0.5℃阻断”变为“多步 shadow 可评审” |
| P1 | 把 140 泵频 shadow 目标点/回退点实配为真实点名 | 当前 `B25_AI_*` 是影子点模板，下一步需要现场 PLC/SCADA 点表确认 |
| P1 | 接入末端安全前置条件数据源 | 当前安全输入保留 `TODO`，降泵前需要末端阀位、末端压差、代表房间温度或缺冷投诉状态 |
| P1 | 补仪表偏移诊断校准/安装位置元数据 | 页面已能输出“仪表偏移 V1”候选、交叉校验、现场复核对象和 `sensorLedgerEvidence` 预检状态；下一步要把现场台账放入 `sensor-calibration-installation.csv` |
| P1 | 补控制命令/反馈和启停事件台账 | 页面已能输出“控制震荡 V1”风险与证据缺口；下一步要把 PID/死区/延时、命令/反馈趋势和启停事件接到点位/历史库 |
| P2 | 做塔单元能力趋势与异常排名 | 需要更细粒度数据，但对现场运维价值高 |

推荐下一步实际开工项：

> 下一步做人工审阅：塔侧第一步 shadow 待审单已创建且 UI 已复验，下一步只能由人工决定是否仅做 shadow approve；泵侧保持 `GO_SHADOW_ONLY`，只补真实点名和安全输入，不开 assisted。

数据资源与拓展诊断的详细可行性矩阵见：

- `docs/OPTIMIZE_DEMO_DATA_RESOURCE_EXTENSION_ROADMAP_CURRENT.md`
- `docs/OPTIMIZE_DEMO_140_CHILLER_SAMPLING_PLAN_CURRENT.md`

人工审阅清单见：

- `docs/OPTIMIZE_DEMO_140_SHADOW_REVIEW_CHECKLIST_CURRENT.md`

甲方演示与验收说明见：

- `docs/OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md`

## 6. 验收边界

任何后续扩展都必须满足：

- 默认 `read_only` 或 `shadow`。
- 不写真实 PLC。
- 不新增自动启停。
- 所有建议必须带 `blockers/warnings`。
- 样本不足时必须降级，不允许伪造节能结论。
- 多机并联无单台冷冻水流量时，只评价组合，不评价单机实时 COP。

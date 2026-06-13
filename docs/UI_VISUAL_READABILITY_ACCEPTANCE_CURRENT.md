# UI 视觉可读性验收记录 CURRENT

更新时间：2026-06-12

## 范围

本记录覆盖 `apps/chiller-shell-v1` 主要业务页面的紧凑版式复核，目标是减少滚动、避免遮挡、保证文字可读，并保持工业 SCADA 风格的信息完整性。

验收视口：

- 桌面极限视口：`1280 x 720`
- 复核口径：首屏可读、无横向溢出、无可见小字、无可见硬裁切、无低对比度文字

## 已复核页面

核心运行页：

- `/dashboard`
- `/system-overview`
- `/alarms`
- `/cold-station-logs`
- `/trend-analysis`
- `/energy-analysis`
- `/energy-efficiency?tab=calendar`
- `/energy-efficiency?tab=proportion`
- `/meter-readings`
- `/energy-parameters`
- `/performance-report`

剩余业务页和入口页：

- `/login`
- `/projects`
- `/operation-records`
- `/report-records`
- `/knowledge-base`
- `/work-orders`
- `/environment-conditions`
- `/devices`
- `/optimize-demo`
- `/scene-control`
- `/video-monitor`

## 当前结论

- 状态：通过当前 1280 x 720 可读性验收。
- 页面级横向溢出：未发现。
- 可见小字：未发现小于 10px 的可见正文/状态文字。
- 可见硬裁切：未发现影响读数或操作的文本裁切。
- 低对比度文字：最终全量扫描为 0；侧边栏数量徽标、项目队列标签、来源状态胶囊、场景按钮和关键操作按钮均已转为高对比样式。
- 临时认证种子：`public/qa-auth-seed.html` 不允许提交，已纳入自动检查。

## 已修复问题

1. 系统总览右侧 `影子验证 / 继续观察` 状态胶囊在低亮度屏幕下偏暗。
   - 处理：改为深色实底渐变、浅色文字、边框和文本阴影。
   - 防回归：`check-visual-readability-contract.js` 检查系统总览状态胶囊颜色、字号和阴影。

2. 项目选择页当前项目卡片上的 `队列 03` 排序标签在绿色背景下对比度偏低。
   - 处理：统一项目队列 rank 胶囊为深绿实底、浅色文字、边框和文本阴影。
   - 防回归：`check-visual-readability-contract.js` 检查项目队列 rank 胶囊颜色、字号和阴影。

3. 告警队列、趋势页激活按钮、能效热平衡阈值标签等此前截图问题已收口。
   - 处理：保留后置 CSS guard，避免深底文字消失、队列行信息被压扁、图表阈值标签过小。
   - 防回归：同一视觉检查脚本已覆盖这些关键 guard。

4. 项目选择页判断栏、性能报告摘要卡、工单管理页头、能耗分析指标卡在 1280 x 720 下存在紧凑容器裁切风险。
   - 处理：新增最高优先级 720p no-clip guard，微调网格行高、状态栏高度、指标卡高度和侧边栏徽标对比度。
   - 防回归：`check-visual-readability-contract.js` 检查项目选择、性能报告、工单管理、能耗分析和侧边栏数量徽标的最终 guard。

5. 能源参数、能耗抄表、性能报告、冷站运行拓扑在最终渲染中仍存在局部值行偏紧、动作按钮越界或 active 按钮低对比。
   - 处理：新增 rendered 720p no-clip pass，收紧能源参数/能耗抄表底部边界卡，调整性能报告查询区和侧栏高度，统一场景 active 按钮、系统总览跳转按钮、操作记录主按钮为深色实底浅色文字。
   - 防回归：`check-visual-readability-contract.js` 检查能源参数、能耗抄表、性能报告、冷站运行拓扑和关键动作按钮的最终 guard。

6. 系统总览拓扑 `末端负荷` 卡在负荷率缺失时显示过长原因，1280 x 720 下出现省略裁切。
   - 处理：节点内改为 `负荷率待回传`、`冷量待回传`，保留工程状态但移除解释性长句。
   - 防回归：`check-visual-readability-contract.js` 检查系统总览负荷节点紧凑缺省文案，并禁止长缺失原因回到小卡片。

7. AI优化建议页生成后，`优化建议` 的执行结果不够突出，关键结论需要从下方内容中寻找。
   - 处理：顶部改为 `优化结果` 聚焦栏，首屏直接展示 `优化建议结果 / 预计功率变化 / 主机组合 / 接近度目标 / 泵频修正` 五项结果卡。
   - 文案：主结果卡使用 `先处理阻塞 / 提交接近度审批 / 继续审阅` 等工程动作词；主机组合压缩为 `CH4+CH5+CH7`，泵频结果压缩为 `0.0/0.0 Hz`，收益无数据时不强行追加单位。
   - 防回归：`check-visual-readability-contract.js` 检查 AI优化建议结果栏高度、两段布局、主结论卡、五项结果网格、收益卡和值字号行高。

8. 全路由复核后，驾驶舱室外边界、告警中心当前建议、能效日历日格数字列仍有紧凑显示风险。
   - 处理：驾驶舱缺测状态合并为 `湿球/干球/接近未传回`；告警中心当前建议压缩为 `仅保守观察`；能效日历日格改为固定标签列和右对齐数字列。
   - 防回归：`check-visual-readability-contract.js` 检查驾驶舱紧凑缺测文案、告警短动作词和能效日历数字列宽/字号/右对齐。

9. 720p 全路由复查后，部分页面底部说明条和场景控制按钮贴近视口底边，存在被浏览器边缘裁掉的风险。
   - 处理：为告警中心、能耗分析、性能报告、操作记录、历史数据和场景控制补充底部安全区；操作记录边界卡和历史数据分页按钮进一步压缩高度。
   - 防回归：`check-visual-readability-contract.js` 检查底部安全区上移、场景按钮高度、操作记录边界卡高度、历史数据分页按钮高度和场景状态上移。

10. 本地只读模式误拦截 `/optimize/tower-approach/advice`，导致 tower-approach readiness 从 UI 可用状态误判为 `NO_GO / HTTP 403`。
    - 处理：只读中间件允许建议生成端点通过，同时保留通用写接口拦截；该端点只计算 AI 目标值，不创建、不审批、不下发执行单。
    - 防回归：`server.test.js` 检查只读 allowlist 允许 `/optimize/tower-approach/advice` 和 `/optimize`，但继续拒绝 `/energy-parameters` 等通用写接口。

## 自动检查

已接入 `apps/chiller-shell-v1/package.json`：

```bash
npm run check
npm run verify
```

`npm run check` 当前包含：

- `check:source-status-dict`
- `check:route-scope`
- `check:ui-visible-copy`
- `check:energy-efficiency-ui`
- `check:visual-readability`

`check:visual-readability` 覆盖：

- 趋势分析页激活按钮对比度 guard
- 能效热平衡阈值标签字号和描边 guard
- 告警队列两行可读 guard
- 系统总览状态胶囊可读 guard
- 项目队列 rank 胶囊可读 guard
- 项目选择页、性能报告、工单管理、能耗分析的 720p no-clip guard
- 能源参数、能耗抄表、性能报告、冷站运行拓扑和关键动作按钮的 rendered 720p no-clip guard
- 来源/状态胶囊对比度 guard
- 侧边栏数量徽标可读 guard
- 工单管理顶部统计、查询区和状态 chip 无遮挡 guard
- 趋势分析序列统计两列完整展示 guard
- 系统总览负荷节点缺省文案完整显示 guard
- 驾驶舱室外边界缺测文案、告警中心短动作词、能效日历日格数字列宽 guard
- 720p 底部安全区 guard
- 临时 QA 认证种子文件禁止提交

## 浏览器实操结果

本地临时前端：

- `http://127.0.0.1:3010`
- QA 会话：只读模拟会话，仅用于页面进入和截图复核
- 视口：`1280 x 720`

实操结果：

- 最新全量 21 个路由：`pageOverflowX=0`，`extraVerticalScroll=0`，`tinyText=0`，`lowContrast=0`，`horizontalOverflow=0`，`viewportLeaks=0`。
- 机器扫描剩余 hardClip 提示主要来自 1x1 无障碍隐藏文字、固定高度卡片的内部滚动/省略区域；已结合截图确认不影响读数和操作。
- 重点复核截图：`/energy-analysis`、`/energy-parameters`、`/meter-readings`、`/performance-report`、`/scene-control`、`/operation-records`。
- 追加复核 `/work-orders`：顶部 4 个统计卡与查询区无覆盖；查询区底部状态条不再被工单列表遮挡；状态 chip 仅保留短状态结论，去掉重复长句。
- 追加复核 `/trend-analysis`：右侧“序列统计”由单列改为两列紧凑卡片，`总站功率 / 冷站 COP / 冷冻水温差 / 冷却水温差` 全部首屏可见。
- 追加复核 `/system-overview`：拓扑 `末端负荷` 节点改为短状态，`负荷率待回传 / 冷量待回传 / 待回传` 均完整显示。
- 追加复核 `/optimize-demo`：生成 AI 建议后，顶部 `优化结果` 栏直接显示 `先处理阻塞`、`预计功率变化`、`CH4+CH5+CH7`、`目标待生成`、`0.0/0.0 Hz`，主结论卡明显高于普通目标卡，且无截断和横向溢出。
- 继续复核 `/optimize-demo`：1280 x 720 真实 DOM 审计 `failures=[]`；5 个结果卡全部渲染，主结果卡字号 `24px / 36px`，普通结果卡字号 `15.5px / 28px`，所有 `strong/small` 均未出现 `scrollWidth > clientWidth` 或 `scrollHeight > clientHeight`。
- 继续复核 BFF 请求头：本地会话使用中文项目名 `B25 冷站 / 联调冷站A / 联调冷站B` 进入页面，控制台 `error=0`、`warning=0`；已用静态检查锁定 Header 非 ASCII 过滤，避免中文项目名触发浏览器 Header 异常。
- 继续复核优化链路：`SITE_ID=140` 下 `check:optimize-smoke-suite` 通过，覆盖 `http-advisor-result`、ready/partial/unavailable fixture、B25 overview API 和 optimize API；脚本内 CDP UI smoke 因本机 `127.0.0.1:61392` 未开放而跳过，前端 UI 已用 Playwright 单独验证。
- 继续复核只读 advice 链路：最新 BFF 8788 下 `/bff/v1/sites/140/optimize/tower-approach/advice` 返回 `200 OK`，`check:b25-tower-approach-readiness` 从 `NO_GO / HTTP 403` 恢复为 `GO_SHADOW / READY`，阻断项为 0，仍保持 shadow 评审边界。
- 追加复核 `/dashboard`、`/alarms`、`/energy-efficiency?tab=calendar`：三页最终 `hardClip=0`，`ellipsisRisk=0`，`tinyText=0`，`viewportLeaks=0`，`extraVerticalScroll=0`。
- 追加复核 `/alarms`、`/energy-analysis`、`/performance-report`、`/operation-records`、`/report-records`、`/scene-control` 底部安全区：稳定态 `hardClip=0`，`viewportLeaks=0`，`pageOverflowX=0`，`extraVerticalScroll=0`。
- 继续复核全量 20 个受保护路由：`hardClip=0`，`bottomRisk=0`，`smallFonts=0`，`extraX=0`，`extraY=0`，`frameworkOverlay=false`，`console error/warn=0`；能耗分析设备树改为内部滚动，底部说明条均保留可见安全间距。
- 多视口复核 `1366x768` 与 `1920x1080`：20 个受保护路由均为 `hardClip=0`，`bottomRisk=0`，`smallFonts=0`，`lowContrast=0`，`overlaps=0`，`extraX=0`，`extraY=0`，`frameworkOverlay=false`，`console error/warn=0`。
- 登录页在清空会话后单独复核：`overflowX=0`，`scrollHeight=720`，`tiny=[]`，`clip=[]`。

最新临时审计产物：

- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/readability-audit.json`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/energy-analysis-1280x720.png`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/energy-parameters-1280x720.png`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/meter-readings-1280x720.png`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/performance-report-1280x720.png`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/scene-control-1280x720.png`
- `/private/tmp/chiller-readability-audit-2026-06-12T01-03-38-085Z/operation-records-1280x720.png`
- `/private/tmp/work-orders-no-overlap-1280x720-v5.png`
- `/private/tmp/trend-analysis-stats-no-clip-1280x720.png`
- `/private/tmp/system-overview-load-node-no-clip-1280x720.png`
- `/private/tmp/optimize-demo-result-spotlight-compact-1280x720.png`
- `/private/tmp/chiller-affected-audit-2026-06-12T10-22/dashboard-1280x720.png`
- `/private/tmp/chiller-affected-audit-2026-06-12T10-22/alarms-1280x720.png`
- `/private/tmp/chiller-affected-audit-2026-06-12T10-22/energy-efficiency-calendar-1280x720.png`
- `/private/tmp/chiller-bottom-safe-dom-audit-2026-06-12T10-50/bottom-dom-audit.json`
- `/private/tmp/chiller-bottom-safe-dom-audit-2026-06-12T10-55/remaining-bottom-dom-audit.json`
- `/private/tmp/chiller-final-dom-audit-2026-06-12-continuation-v2.json`
- `/private/tmp/chiller-multiviewport-dom-audit-2026-06-12.json`
- `/private/tmp/chiller-ai-result-spotlight-2026-06-12/optimize-result-spotlight-1280x720-v2.png`
- `/private/tmp/chiller-ai-result-spotlight-2026-06-12-continuation/optimize-result-spotlight-1280x720-final.png`

## 截图证据

核心运行页：

- `output/playwright/dashboard-1280x720.png`
- `output/playwright/system-overview-1280x720.png`
- `output/playwright/alarms-1280x720.png`
- `output/playwright/cold-station-logs-1280x720.png`
- `output/playwright/trend-analysis-1280x720.png`
- `output/playwright/energy-analysis-1280x720.png`
- `output/playwright/energy-efficiency-calendar-1280x720.png`
- `output/playwright/energy-efficiency-proportion-1280x720.png`
- `output/playwright/meter-readings-1280x720.png`
- `output/playwright/energy-parameters-1280x720.png`
- `output/playwright/performance-report-1280x720.png`

剩余业务页和入口页：

- `output/playwright/remaining-login-clean-1280x720.png`
- `output/playwright/remaining-projects-1280x720.png`
- `output/playwright/remaining-operation-records-1280x720.png`
- `output/playwright/remaining-report-records-1280x720.png`
- `output/playwright/remaining-knowledge-base-1280x720.png`
- `output/playwright/remaining-work-orders-1280x720.png`
- `output/playwright/remaining-environment-conditions-1280x720.png`
- `output/playwright/remaining-devices-1280x720.png`
- `output/playwright/remaining-optimize-demo-1280x720.png`
- `output/playwright/remaining-scene-control-1280x720.png`
- `output/playwright/remaining-video-monitor-1280x720.png`

## 已通过命令

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1
npm run check
npm run build

cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
APP_BASE_URL=http://127.0.0.1:3003 BFF_BASE_URL=http://127.0.0.1:8787 SITE_ID=140 npm run check:optimize-smoke-suite

cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
node --test src/server.test.js
npm test
BFF_BASE_URL=http://127.0.0.1:8788 SITE_ID=140 npm run check:b25-tower-approach-readiness
BFF_BASE_URL=http://127.0.0.1:8788 SITE_ID=140 npm run check:optimize-smoke-suite
```

## 交付注意

- 当前仓库存在大量非本轮 UI 可读性改动，提交前必须按文件和 hunk 复核，避免夹带无关变更。
- `global.css` 为广域大 diff，暂存前必须人工确认本轮页面覆盖和历史页面样式没有冲突。
- 截图证据在 `output/playwright/`，用于验收展示；是否随提交纳入版本库需单独决定。

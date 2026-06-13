# 能效分析页面验收记录 CURRENT

更新时间：2026-06-12

## 范围

本记录仅覆盖 `apps/chiller-shell-v1` 的能效分析页面：

- 路由：`/energy-efficiency`
- 页签：`能效日历`、`能效查询`、`能效对比`、`负荷比重`、`热平衡`
- 视口验收口径：1280 x 720，减少页面滚动，信息完整展示

## 当前交付状态

- 状态：可进入页面验收；本地 1280 x 720 与 Chrome 实操检查均已通过。
- 未提交：本记录、能效 UI 合同脚本、能效页面样式收口和 3 张截图证据仍在工作树中，尚未形成 commit。
- 自动门禁：`npm run check:energy-efficiency-ui`已纳入`npm run check`和`npm run verify`，覆盖最终 no-clip guard，避免回退到裁切、旧文案或负荷比重图表显示不全。
- 提交前范围检查：`npm run check:energy-efficiency-delivery-scope`用于列出本轮建议交付文件、需人工确认文件和被忽略的其它脏改；`STRICT_DELIVERY_SCOPE=1 npm run check:energy-efficiency-delivery-scope`会把人工确认项升级为失败，用于 staging 前拦截依赖漂移；`DELIVERY_SCOPE_TARGET=staged STRICT_DELIVERY_SCOPE=1 npm run check:energy-efficiency-delivery-scope`用于检查已暂存内容是否干净。该命令不接入`verify`，避免工作区状态影响正常构建。
- 级联门禁：能效页末端样式块已纳入顺序检查，`负荷段 no-clip -> 最终 no-clip -> 负荷比重 1280x720 图表适配 -> 最终可读性 -> 外层 viewport guard`必须保持该顺序，防止后续全局紧凑样式覆盖导致脚本误绿。
- 视觉证据：`output/playwright/energy-efficiency-qa/calendar-1280x720.png`、`proportion-1280x720.png`、`thermal-balance-1280x720.png`。
- 注意事项：当前仓库存在大量非本轮改动，合并或提交前应只选择能效分析相关文件，避免夹带其它页面和依赖漂移。

## 已收口项

1. 日历每日框显示完整信息：`能效`、`电量`、`冷量`。
2. 旧文案已移除：`C/P`、`冷热不平衡`、`运行判读`、`源接口兜底`。
3. `热平衡`命名已替代旧的冷热不平衡表达。
4. `分项耗电构成`环图中心值改为同口径的`分项合计`，不再混用月累计总电量。
5. `负荷比重`页直达 URL 后可加载 10 个负荷段，表头加 10 行在首屏可见。
6. `能效日历`首屏内保留顶部 KPI、月度日历、分项耗电构成、日 COP 趋势、负荷比重、运行校核。
7. `日 COP 趋势`中的基准线文案使用`达标线 6.50`，不再使用容易误解为控制限值的`阈值 6.50`。
8. 顶部 KPI 卡片标题、数值、说明行必须完整显示，不能因 720p 压缩产生顶边裁剪。
9. `月度能效日历`标题栏必须提供月份选择和`查询`按钮，查询后按月刷新日历。
10. 首屏必须明确展示`月平均 COP`，辅助口径使用`累计折算 COP`，避免与平均口径混读。
11. `分项耗电构成`必须与当前月查询口径关联，标题右侧显示同一月份和紧凑口径`月均COP`，中心口径显示`月分项合计`。
12. COP 关键展示必须固定两位小数，避免`月平均 COP 6.9`与`累计折算 COP 6.80`这类精度不一致造成误判。
13. 日历和分项环图必须显式展示`当前选择`的月/日口径，入口默认保持`月口径`，点击单日后应显示`日口径`，避免月 KPI 与日分项混读。
14. 顶部主机占比 KPI 必须随分项环图显示`月主机耗电占比`或`日主机耗电占比`，禁止用无口径的`主机耗电占比`与月累计 KPI 混读。
15. 顶部必须显示`口径校核`，明确`累计全口径 / 月分项`或`累计全口径 / 日分项`；当全口径累计与分项合计差异超过 2% 时，必须直接显示`差异 x.x%`，避免把累计电耗、制冷量和分项环图误判为同一统计口径。
16. `负荷比重`摘要必须使用`主负荷段`和同一负荷段的`主负荷段能效`，数值单位保留`COP`，不再展示固定 10 个负荷段平均后没有管理意义的`平均负荷占比`，也不把低样本最高 COP 当作主结论；图中柱状负荷比例和折线 COP 必须有明显的颜色、线宽、点位区分。
17. `热平衡`页必须使用`偏差值域`、`达标带 ±5%`、`热平衡状态`、`热平衡达标率`，趋势图必须直接显示 ±5% 达标带、上下边界线和`+5%/-5%`贴边标记，统计表头必须使用`采样总数`、`达标样本（±5%内）`、`超限样本`，运行校核必须显示`达标率 x%`，不再使用`阈值线`、`最高达标率`、`实测值`、`不达标量`或`x%达标`等容易误解的表达。
18. 未来/未采集日期必须显示`--`，禁止把缺数显示成`能效 0.00`造成真实低效误判。
19. 历史月份数据齐全时`月度状态`必须显示`完整`，仅在确实无数据时显示`待采集`，部分缺口显示`缺数`。
20. COP 趋势卡如果只展示最近窗口，标题必须显示`近N日 COP 趋势`，徽标同时保留完整有效日数量。
21. `能效查询`和`能效对比`趋势图必须显示`COP 值域`，明细表头必须使用`当前 COP`、`平均 COP`、`前10%高效 COP`、`后10%低效 COP`，折线必须比普通细线更醒目，SVG 不得被宽度撑成超高后裁剪，x 轴必须留在可见绘图区底部，禁止回退为泛化的`当前值域`、`整体值`、`平均值`。
22. 1280 x 720 下`能效查询`和`能效对比`左侧统计明细卡必须完整落在视口内；对比页按钮应与日期行收口，隐藏非必要操作说明，禁止底部统计表被外层容器裁切。
23. `热平衡`摘要卡和`热平衡达标统计`表格必须使用同一`采样总数`口径，禁止摘要按曲线点数、表格按统计行总数导致同页数值不一致。
24. B25 项目展示别名`140-B25`、`140B25`必须在 BFF 项目数据口径中规范化为正式 legacy key `140btwentyfive`，确保`能效查询`、`能效对比`和`热平衡`表格不会因前端项目显示码不同而误报空数据。

## 当前渲染验收

本地目标：

- 前端：`http://127.0.0.1:3001/energy-efficiency`
- 项目：观澜B25，`siteId=140`

浏览器实操结果：

- `tab=calendar`：无页面滚动；底部三卡完整可见；首日文本含`能效/电量/冷量`；环图中心显示`月分项合计`，与外圈四项分项耗电同口径；顶部`口径校核`按当前数据输出`差异 6.9%`。
- `tab=calendar` / 1280 x 720：2026-06 默认月口径无页面滚动；底部`近11日 COP 趋势`、`负荷比重`10 个负荷段、`运行校核`全部在首屏可见；卡片内部无裁剪。
- `tab=search`：页签高亮正确；无旧文案；无页面滚动；Chrome 实操有`冷站`统计行，未出现空态文案。
- `tab=compare`：页签高亮正确；无旧文案；无页面滚动；Chrome 实操有`2026-06-11`对比行，未出现空态文案。
- `tab=search` / 1280 x 720：`查询条件`、`COP 统计明细`、`冷站 COP 趋势`全部在视口内；明细表底部 702px，右侧趋势图底部 715px；无文本裁剪。
- `tab=compare` / 1280 x 720：`对比统计明细`底部 698px，`COP 对比趋势`底部 715px；按钮已上移到日期行，`点击下方已选日期可取消`说明已隐藏；无文本裁剪。
- `B25 alias` / BFF 实测：请求头携带`x-chiller-project-key: 140-B25`与`x-chiller-project-database-key: 140B25`时，`energy-efficiency/search`返回`rows=1 / series=1 / axis=45`，`energy-efficiency/compare`返回`rows=3 / series=3 / axis=24`，实际命中 endpoint 均为`/zsqy/energycalendar/140btwentyfive/...`；`energy-efficiency/imbalance`返回`series=1 / stats=1 / devices=1`，曲线 endpoint 保持`appId=140`，表格 endpoint 命中`/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?...appId=140...`。
- `tab=proportion`：直达后等待数据返回，10 行负荷段完整；表头加 10 行全部可见；无页面滚动；右侧图表壳体底部 684px，柱状、折线、双轴和 x 轴标签均在 720p 视口内。Chrome 实操补查显示主负荷段为`80~90% / 31.8%`，主负荷段 COP 为`6.57`，左侧表格与右侧图表一致。
- `tab=imbalance`：页签高亮为`热平衡`；无旧文案；无页面滚动；摘要`采样总数`与统计表`采样总数`一致。
- 控制台：无 `warn` / `error`。
- `1280 x 720` / Playwright 实测：BFF 以`READ_ONLY_MODE=1`运行，`healthz.readOnlyMode=true`；五个页签均无页面级横/纵滚动（`scrollHeight=clientHeight=720`、`scrollWidth=clientWidth=1280`），关键文案完整，无`C/P`、`冷热不平衡`、`运行判读`、`源接口兜底`等旧文案；`负荷比重`10 个负荷段完整；`热平衡`显示`271`条采样、达标率`1.11%`，与实时接口刷新一致。
- `2026-06-11 22:09` / Chrome + Playwright 复测：Chrome 真实视口`1920 x 854`下五个页签均无页面级滚动、无文本裁切、无元素越界；Playwright 独立 QA 会话`1280 x 720`下五个页签均为`scrollHeight=clientHeight=720`、`scrollWidth=clientWidth=1280`，`clipped=[]`、`outOfViewport=[]`、`badTerms=[]`。本轮额外修复日历日框 1-3px 裁切、分项圆环中心值百万量级显示余量、`负荷比重`SVG 被宽度撑高后裁切、`按月/按年`控件固定宽度溢出。
- `scripts/start_local_stack.sh` / 本地栈保护：当 8787 已有 BFF 但 `appMode`、`readOnlyMode`、`legacyBaseUrl`、`realtimeParamsBaseUrl`或`realtimeParamsTimeoutMs`与本次启动参数不一致时，脚本必须移除旧 launchctl 作业并重启 BFF；一致时才允许输出`bff already up`。
- `scripts/start_local_stack.sh` / 前端复用保护：当 3001 已有 Vite 但 `VITE_BFF_BASE_URL`、`VITE_SITE_ID`、`VITE_TREND_RANGE`、`VITE_LEGACY_BASE_URL`、`VITE_APP_MODE`或`VITE_APP_READ_ONLY`与本次启动参数不一致时，脚本必须重启前端并刷新指纹文件；一致时才允许输出`frontend already up`。
- `scripts/start_local_stack.sh` / 自定义前端入口：提供`FRONTEND_BASE_URL`时，脚本必须保留该 URL 作为最终探测目标，禁止在端口循环中覆盖回`http://127.0.0.1:${FRONTEND_PORT}/`。
- `scripts/stop_local_stack.sh` / 指纹清理：停止本地栈时必须同步删除`/tmp/chiller_shell_${APP_MODE}_${FRONTEND_PORT}.env`前端参数指纹，避免后续端口被其它进程占用时误判为同配置前端。

## 自动检查

新增专项脚本：

- `apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js`
- `apps/chiller-shell-v1/scripts/check-energy-efficiency-delivery-scope.js`

已接入：

- `npm run check`
- `npm run verify`

独立提交前检查：

- `npm run check:energy-efficiency-delivery-scope`
- `STRICT_DELIVERY_SCOPE=1 npm run check:energy-efficiency-delivery-scope`
- `DELIVERY_SCOPE_TARGET=staged STRICT_DELIVERY_SCOPE=1 npm run check:energy-efficiency-delivery-scope`

该脚本不阻断正常构建，只报告交付范围：

- 必须存在能效 UI 合同脚本、验收文档和 3 张 1280 x 720 截图证据。
- 建议交付范围：`package.json`中的能效检查命令、能效 UI 合同脚本、能效交付范围脚本、来源状态检查脚本、`zhCN.ts`、`sourceStatusCN.ts`、来源字典、能效页面 TSX、`global.css`能效样式、验收文档和截图。
- staging 建议：能效脚本、来源状态检查脚本、`zhCN.ts`、`sourceStatusCN.ts`、来源字典、能效页面 TSX、验收文档和截图可直接纳入；`package.json`当前只能部分纳入检查命令 hunk，除非确认保留`three`依赖漂移；`global.css`虽然是能效页交付必需项，但当前为广域大 diff，必须人工复核后再暂存。
- 人工确认项：`global.css`广域样式 diff、`package-lock.json`、`three`依赖版本漂移。
- 严格模式：存在人工确认项时退出失败，当前可用于防止把`three`版本漂移和`package-lock.json`误纳入能效页提交。
- 暂存区模式：读取 git index 而不是工作区；完成部分 staging 后，应使用该模式确认已暂存内容不包含`package-lock.json`或`three`依赖漂移，并且确实包含能效页所需的 TSX、CSS、脚本、文档和截图。
- 广域 CSS 复核：普通模式会输出`global.css selector audit`，量化能效选择器与跨页面选择器分布；只有在确认`global.css`大 diff 符合本轮交付边界后，才允许设置`ALLOW_BROAD_CSS_STAGE=1`；若审计存在非能效选择器，还必须单独设置`ALLOW_CROSS_PAGE_CSS_STAGE=1`，再运行`ALLOW_BROAD_CSS_STAGE=1 ALLOW_CROSS_PAGE_CSS_STAGE=1 DELIVERY_SCOPE_TARGET=staged STRICT_DELIVERY_SCOPE=1 npm run check:energy-efficiency-delivery-scope`放行。
- 2026-06-12 审计结果：`global.css`新增 diff 行`56771`，新增选择器类行`22952`，其中`energy-efficiency`相关`2845`、非能效选择器`20107`；主要跨页面 family 为`optimize=1330`、`energy-analysis=980`、`report-record=916`、`environment=650`、`energy-parameter=567`、`knowledge=547`、`meter-reading=543`、`cold-log=525`。该结果证明`global.css`不能按能效页局部样式直接放行。
- staging 操作：普通模式会输出可直接执行的`git add -- ...`命令；`package.json`必须使用`git add -p -- apps/chiller-shell-v1/package.json`只接受 scripts hunk，禁止把`three`依赖漂移一起暂存。
- 其它全仓脏改只统计数量，不作为本轮能效页交付依据。

脚本覆盖：

- 五个页签存在。
- URL `tab` 参数与状态同步，非法 tab 归一到 `calendar`。
- 日历每日框必须显示`能效/电量/冷量`，禁止回退为`E/P/C`或`C/P`。
- 环图中心必须为`分项合计`，禁止回退为`总电量`。
- 环图中心值必须来源于分项合计，禁止再使用`completedPower`。
- `日 COP 趋势`必须显示`达标线 6.50`，禁止回退为`阈值 6.50`。
- `月度能效日历`必须保留月份查询控件和`月平均 COP`展示。
- 月份查询胶囊必须显示当前月份/日期口径和均值，不能只在饼图中显示关联口径。
- 月份查询必须同步提交饼图月口径，`分项耗电构成`必须显示对应月份和紧凑口径`月均COP`。
- 默认进入`能效日历`必须显示月口径，只有点击具体日期后才切换为日口径。
- 顶部主机占比 KPI 必须显示`月主机耗电占比`/`日主机耗电占比`和对应分项口径。
- 顶部 KPI 必须显示`口径校核`和`累计全口径 / 月分项`或`累计全口径 / 日分项`，差异超过 2% 时必须显示`差异 x.x%`，避免把全口径累计与分项环图混读。
- COP 显示必须使用固定两位格式，日历格、月平均、累计折算、趋势统计、负荷 COP 不得回退为单一最大精度格式。
- `当前选择`必须在日历区和分项环图区可见，月查询和单日点击后必须明确区分`月口径`/`日口径`。
- 未采集日必须通过显示层保护输出`--`，不得把缺数 COP 补成`0.00`。
- 月度状态必须区分`完整`、`缺数`、`未完整`、`待采集`，历史整月不得误显示`待采集`。
- 趋势卡必须展示`近N日 COP 趋势`和完整有效日数量，避免把近 11 日窗口误认为整月曲线。
- `负荷比重`摘要必须输出`主负荷段`，并显示该负荷段占比和同一负荷段能效；图中柱状负荷比例和折线 COP 必须用不同样式强化；禁止用`最高负荷占比`、`最佳冷站能效`作为主结论，禁止出现`主负荷段 COP 6.xx COP`这类单位重复。
- `热平衡`趋势图必须显示`偏差值域`、±5% 达标带、上下边界线和`+5%/-5%`贴边标记；页面必须输出`热平衡状态`、`达标带 ±5%`和`热平衡达标率`；统计表头必须写`采样总数`、`达标样本（±5%内）`、`超限样本`，禁止回退为`阈值线`、`最高达标率`、`实测值`、`不达标量`或`x%达标`。
- `热平衡`摘要卡必须写`采样总数`，并优先采用统计表同口径总数，禁止回退为曲线点数口径的`采样点数`。
- `能效查询`和`能效对比`趋势图必须显示`COP 值域`；折线必须比普通细线更醒目；SVG 高度和 x 轴必须在可见绘图区内；表格必须使用 COP 专用表头：`当前 COP`、`平均 COP`、`前10%高效 COP`、`后10%低效 COP`。
- `能效查询`和`能效对比`必须保留 1280 x 720 视口收口规则：统计明细卡紧凑高度、对比页按钮日期行收口、非必要说明隐藏，防止左侧底部卡片被裁切。
- BFF 项目数据上下文必须识别 B25 展示别名，`140-B25 / 140B25`不得覆盖内置正式 key `140btwentyfive`；`热平衡`路由必须透传同一项目数据上下文；自定义项目 key 仍必须保留，不得被误规范化。
- `负荷比重`必须通过统一补齐函数输出 10 个负荷段，表格和日历概览均使用补齐后的行。
- 日历页 720p 首屏适配关键样式必须存在。
- 真实 Chrome 视口下日历页必须保留末尾 viewport guard，防止底部三卡被外层容器裁剪。
- 顶部 KPI 必须保留 readability guard，防止`月平均 COP`、`累计电耗`、`口径校核`等标题裁剪。
- `负荷比重`页必须保留 1280 x 720 图表高度兜底，禁止右侧柱状图、折线、双轴或 x 轴标签被压到视口外。
- 日历页最终 no-clip guard 必须覆盖日框、分项圆环中心值和底部负荷段标签；`负荷比重`页最终 guard 必须覆盖图表 SVG 高度继承和`按月/按年`两等分自适应控件，防止后续紧凑样式覆盖导致回退。
- 能效页末端 CSS 必须检查级联顺序和最终有效覆盖：最终可读性块必须保留 10 行负荷段、日历首屏 56px/322px/148px 行高，最末端 viewport guard 必须锁定外层内容高度并隐藏页面级滚动。
- `check-energy-efficiency-ui-contract.js`必须把最终 no-clip guard 纳入自动检查，至少覆盖日框行高、圆环中心值行高、底部负荷段行高、负荷比重图表高度继承、`按月/按年`控件两等分自适应，禁止只依赖人工截图发现回退。

## 已通过命令

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1
npm run check:energy-efficiency-ui
npm run verify
```

本轮最新验证：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1
npm run check:energy-efficiency-ui
npm run verify
```

BFF 回归：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm test -- --test src/routes/v1.test.js
npm test -- --test src/routes/v1.test.js src/services/energyEfficiencyService.test.js src/adapters/legacyEnergyEfficiencyAdapter.test.js src/lib/site-runtime-config.test.js
npm test
```

B25 别名真实接口核验：

```bash
curl -sS -H x-chiller-site-id:140 -H x-chiller-site-code:B25 -H x-chiller-project-database-key:140B25 -H x-chiller-project-key:140-B25 -H x-chiller-project-template:1 -o /tmp/ee_imbalance_b25_alias.json 'http://127.0.0.1:8787/bff/v1/sites/140/energy-efficiency/imbalance?startDate=2026-06-10&endDate=2026-06-11'
```

本地栈启动保护核验：

```bash
bash -n scripts/start_local_stack.sh
env READ_ONLY_MODE=0 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
curl -fsS http://127.0.0.1:8787/healthz
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
curl -fsS http://127.0.0.1:8787/healthz
env READ_ONLY_MODE=1 REALTIME_PARAMS_TIMEOUT_MS=1600 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
curl -fsS http://127.0.0.1:8787/healthz
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
curl -fsS http://127.0.0.1:8787/healthz
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
env READ_ONLY_MODE=1 SITE_ID=122 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
cat /tmp/chiller_shell_local_3001.env
curl -I 'http://127.0.0.1:3001/energy-efficiency?siteId=140'
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 FRONTEND_BASE_URL='http://127.0.0.1:3001/energy-efficiency?siteId=140' scripts/start_local_stack.sh
APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/stop_local_stack.sh
ls /tmp/chiller_shell_local_3001.env /tmp/chiller_shell_local_3001.pid 2>/dev/null || true
env READ_ONLY_MODE=1 SITE_ID=140 APP_MODE=local BFF_PORT=8787 FRONTEND_PORT=3001 scripts/start_local_stack.sh
cat /tmp/chiller_shell_local_3001.env
```

补充扫描：

```bash
cd /Users/billchow/Documents/智慧冷冻站
git diff --check -- apps/chiller-shell-v1/src/pages/EnergyEfficiencyPage.tsx apps/chiller-shell-v1/src/styles/global.css apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js apps/chiller-shell-v1/package.json
rg -n "C/P|冷热不平衡|冷/热不平衡|运行判读|源接口兜底" apps/chiller-shell-v1/src/pages apps/chiller-shell-v1/src/styles apps/chiller-shell-v1/src/components apps/chiller-shell-v1/src/i18n
```

## 截图证据

重新生成时间：2026-06-11 20:04-20:05，视口：1280 x 720。Chrome 实操补充截图时间：2026-06-11 20:22。

- `/tmp/energy-efficiency-calendar-1280-current.png`
- `/tmp/energy-efficiency-search-1280-current.png`
- `/tmp/energy-efficiency-compare-1280-current.png`
- `/tmp/energy-efficiency-proportion-1280-current.png`
- `/tmp/energy-efficiency-thermal-1280-current.png`
- `/tmp/energy-efficiency-proportion-chrome-current.png`
- `/Users/billchow/Documents/智慧冷冻站/output/playwright/energy-efficiency-imbalance-1280-20260611.png`
- `/Users/billchow/Documents/智慧冷冻站/output/playwright/energy-efficiency-qa/calendar-1280x720.png`
- `/Users/billchow/Documents/智慧冷冻站/output/playwright/energy-efficiency-qa/proportion-1280x720.png`
- `/Users/billchow/Documents/智慧冷冻站/output/playwright/energy-efficiency-qa/thermal-balance-1280x720.png`

## 遗留风险

1. `package.json` / `package-lock.json` 当前存在 `three` 版本从 `^0.183.0` 到 `^0.182.0` 的漂移；该漂移不是本轮能效页验收必须项，合并前需单独确认是否保留。
2. `src/styles/global.css` 累积了大量页面级覆盖规则；当前验收通过，但后续应考虑按页面拆分或收敛样式层级，降低维护成本。
3. `负荷比重`直达页依赖接口返回，渲染验收需等待数据加载完成，实测约 5 秒。

import fs from "node:fs";
import path from "node:path";

// Guards the compact Energy Efficiency workspace from regressing on the
// operator-facing contract that is hard to catch with static route checks.

const SHELL_ROOT = path.resolve(process.cwd());
const PAGE_FILE = path.join(SHELL_ROOT, "src/pages/EnergyEfficiencyPage.tsx");
const STYLE_FILE = path.join(SHELL_ROOT, "src/styles/global.css");
const I18N_FILE = path.join(SHELL_ROOT, "src/i18n/zhCN.ts");

const REQUIRED_TABS = ["calendar", "search", "compare", "proportion", "imbalance"];
const CALENDAR_FINAL_FIT_MARKER = "/* Energy efficiency calendar final balance: bottom cards show all rows/content at 720p. */";
const CALENDAR_TERMINAL_VIEWPORT_MARKER = "/* Energy efficiency calendar terminal viewport guard: keep the complete overview visible in real Chrome. */";
const CALENDAR_KPI_READABILITY_MARKER = "/* Energy efficiency calendar KPI readability guard: prevent top summary text clipping. */";
const CALENDAR_MONTH_QUERY_MARKER = "/* Energy efficiency calendar month query: keep month selection and monthly average visible. */";
const CALENDAR_PIE_ASSOCIATION_MARKER = "/* Energy efficiency calendar pie association: show the same month and COP basis as the calendar query. */";
const CALENDAR_INTERNAL_CLIP_MARKER = "/* Energy efficiency calendar 1280x720 internal clip guard: keep bottom-card contents fully visible. */";
const CALENDAR_LOAD_FINAL_NO_CLIP_MARKER = "/* Energy efficiency calendar load-band final no-clip guard: later day-cell readability rules must not stretch the load rows. */";
const ENERGY_EFFICIENCY_FINAL_NO_CLIP_MARKER = "/* Final energy-efficiency no-clip guard after all compact overrides. */";
const ENERGY_EFFICIENCY_FINAL_READABILITY_MARKER = "/* Final energy-efficiency readability pass: load-band labels should remain legible at 1280x720. */";
const ENERGY_EFFICIENCY_VIEWPORT_GUARD_MARKER = "/* Energy efficiency viewport guard: keep the outer content box inside the 720p shell. */";
const SEARCH_COMPARE_1280_FIT_MARKER = "/* Energy efficiency search/compare 1280x720 fit guard: keep left table fully visible. */";
const PROPORTION_1280_CHART_FIT_MARKER = "/* Energy efficiency proportion 1280x720 chart fit guard: keep chart, bars, and axes inside the viewport. */";
const FORBIDDEN_COPY_PATTERNS = [
  { name: "old C/P unit", pattern: /C\/P/ },
  { name: "old cold-hot imbalance wording", pattern: /冷热不平衡|冷\/热不平衡/ },
  { name: "removed operation judgment card", pattern: /运行判读/ },
  { name: "old source fallback wording", pattern: /源接口兜底/ },
  { name: "old load ratio summary wording", pattern: /平均负荷占比/ },
  { name: "old thermal threshold wording", pattern: /阈值线（±5%）|±5%阈值|建议控制在 -5% 到 5% 内/ },
  { name: "old thermal compliance wording", pattern: /最高达标率/ },
  { name: "feature-coverage filler card", pattern: /能力覆盖/ },
  { name: "ambiguous cumulative COP helper", pattern: /月累计 COP/ },
  { name: "misleading load-ratio peak wording", pattern: /最高负荷占比/ },
  { name: "misleading best-efficiency wording", pattern: /最佳冷站能效/ },
  { name: "generic current-range wording", pattern: /当前值域/ },
  { name: "long explanatory load chart legend", pattern: /表示负荷比例|表示冷站能效/ }
];

function assertIncludes(source, needle, label, errors) {
  if (!source.includes(needle)) {
    errors.push(`${label}: missing \`${needle}\``);
  }
}

function assertNotIncludes(source, needle, label, errors) {
  if (source.includes(needle)) {
    errors.push(`${label}: forbidden \`${needle}\``);
  }
}

function assertPattern(source, pattern, label, errors) {
  if (!pattern.test(source)) {
    errors.push(`${label}: pattern not found ${pattern}`);
  }
}

function main() {
  const pageSource = fs.readFileSync(PAGE_FILE, "utf8");
  const styleSource = fs.readFileSync(STYLE_FILE, "utf8");
  const i18nSource = fs.readFileSync(I18N_FILE, "utf8");
  const combinedSource = `${pageSource}\n${styleSource}\n${i18nSource}`;
  const errors = [];

  REQUIRED_TABS.forEach((tab) => {
    assertPattern(pageSource, new RegExp(`TAB_SET[\\s\\S]*"${tab}"`), `tab set ${tab}`, errors);
    assertPattern(pageSource, new RegExp(`\\{\\s*key:\\s*"${tab}"`), `tab button ${tab}`, errors);
  });

  assertIncludes(pageSource, "const [searchParams, setSearchParams] = useSearchParams();", "URL search params", errors);
  assertIncludes(pageSource, "const urlTab = getActiveTab(searchParams);", "URL tab derivation", errors);
  assertIncludes(pageSource, "setActiveTab((current) => (current === urlTab ? current : urlTab));", "URL to state sync", errors);
  assertIncludes(pageSource, "const tabParam = searchParams.get(\"tab\");", "invalid tab guard", errors);
  assertIncludes(pageSource, "TAB_SET.has(tabParam as TabKey)", "invalid tab allow list", errors);
  assertIncludes(pageSource, "nextParams.set(\"tab\", \"calendar\");", "invalid tab normalization", errors);
  assertIncludes(pageSource, "setSearchParams(nextParams, { replace: true });", "invalid tab replace", errors);
  assertIncludes(pageSource, "const nextParams = new URLSearchParams(searchParams);", "tab switch preserves query", errors);
  assertIncludes(pageSource, "nextParams.set(\"tab\", tab);", "tab switch URL update", errors);
  assertIncludes(pageSource, "setSearchParams(nextParams);", "tab switch history push", errors);

  assertIncludes(pageSource, "/ 能效 ${formatCop(displayRatio)} / 电量 ${formatNumber(displayPower, 1)} / 冷量 ${formatNumber(displayCooling, 1)}", "calendar title labels", errors);
  assertIncludes(pageSource, "<span>能效</span>", "calendar efficiency label", errors);
  assertIncludes(pageSource, "<span>电量</span>", "calendar power label", errors);
  assertIncludes(pageSource, "<span>冷量</span>", "calendar cooling label", errors);
  assertNotIncludes(pageSource, "<span>E</span>", "calendar old efficiency abbreviation", errors);
  assertNotIncludes(pageSource, "<span>P</span>", "calendar old power abbreviation", errors);
  assertNotIncludes(pageSource, "<span>C</span>", "calendar old cooling abbreviation", errors);
  assertIncludes(pageSource, "mode: \"month\",", "calendar default month scope", errors);
  assertIncludes(pageSource, "const overviewDonutTotal = overviewPieTotal > 0 ? overviewPieTotal : null;", "calendar pie total equals segment sum", errors);
  assertIncludes(pageSource, "const overviewPieIsMonthScope = calendarPieQuery?.dateType !== \"1\";", "calendar pie month scope flag", errors);
  assertIncludes(pageSource, "const calendarMonthDayCount = /^\\d{4}-\\d{2}$/.test(overviewMonth)", "calendar month day-count status guard", errors);
  assertIncludes(pageSource, "const calendarMonthStatusLabel = partialToday", "calendar month status label", errors);
  assertIncludes(pageSource, "completedCalendarItems.length >= calendarMonthDayCount", "calendar complete-month status", errors);
  assertIncludes(pageSource, "? \"完整\"", "calendar complete status copy", errors);
  assertIncludes(pageSource, ": \"缺数\"", "calendar missing status copy", errors);
  assertIncludes(pageSource, "const trendWindowLabel = trendPoints.length > 0 ? `近${formatCount(trendPoints.length)}日` : \"近11日\";", "calendar trend window label", errors);
  assertIncludes(pageSource, "const trendBadgeLabel = completedCalendarItems.length > trendPoints.length", "calendar trend badge window guard", errors);
  assertIncludes(pageSource, "<h3>{`${trendWindowLabel} COP 趋势`}</h3>", "calendar trend title window label", errors);
  assertIncludes(pageSource, "<span>{trendBadgeLabel}</span>", "calendar trend badge visible label", errors);
  assertIncludes(pageSource, "function formatCop(value: number | null | undefined): string", "fixed two-decimal COP formatter", errors);
  assertIncludes(pageSource, "const overviewPieScopeKindLabel = overviewPieIsMonthScope ? \"分项口径：月\" : \"分项口径：日\";", "calendar pie scope kind label", errors);
  assertIncludes(pageSource, "const calendarSelectionStatus = overviewPieIsMonthScope", "calendar visible selected scope label", errors);
  assertIncludes(pageSource, "<p>{calendarSelectionStatus}</p>", "calendar selected scope visible copy", errors);
  assertIncludes(pageSource, "const calendarQueryStatusLabel = overviewPieIsMonthScope", "calendar query scope status label", errors);
  assertIncludes(pageSource, "<span>{calendarQueryStatusLabel}</span>", "calendar query visible scope and average", errors);
  assertIncludes(pageSource, "const overviewPieCopLabel = overviewPieIsMonthScope", "calendar pie COP association label", errors);
  assertIncludes(pageSource, "${overviewPieScopeDate || overviewMonth} · 月均COP ${formatCop(averageRatio)}", "calendar pie monthly compact current-scope COP label", errors);
  assertIncludes(pageSource, "${overviewPieScopeDate || \"--\"} · 日COP ${formatCop(selectedDayRatio)}", "calendar pie daily compact current-scope COP label", errors);
  assertIncludes(pageSource, "const overviewDonutScopeLabel = overviewPieIsMonthScope ? \"月分项合计\" : \"日分项合计\";", "calendar pie center scope label", errors);
  assertIncludes(pageSource, "const chillerShareScopeLabel = overviewPieIsMonthScope ? \"月主机耗电占比\" : \"日主机耗电占比\";", "calendar chiller-share scope label", errors);
  assertIncludes(pageSource, "const chillerShareScopeHint = overviewPieIsMonthScope ? \"月分项口径\" : \"日分项口径\";", "calendar chiller-share scope hint", errors);
  assertIncludes(pageSource, "const scopeAuditHint = overviewPieIsMonthScope ? \"累计全口径 / 月分项\" : \"累计全口径 / 日分项\";", "calendar scope audit hint", errors);
  assertIncludes(pageSource, "const scopeAuditDiffPct = (", "calendar scope audit diff calculation", errors);
  assertIncludes(pageSource, "Math.abs(overviewDonutTotal - completedPower) / completedPower", "calendar scope audit diff formula", errors);
  assertIncludes(pageSource, "const scopeAuditStatusLabel = typeof scopeAuditDiffPct === \"number\"", "calendar scope audit dynamic status", errors);
  assertIncludes(pageSource, "`差异 ${formatNumber(scopeAuditDiffPct, 1)}%`", "calendar scope audit visible difference", errors);
  assertIncludes(pageSource, "<section className=\"energy-efficiency-overview-card energy-efficiency-overview-pie-card\">", "calendar pie card class", errors);
  assertIncludes(pageSource, "<span>{overviewPieCopLabel}</span>", "calendar pie visible COP association", errors);
  assertIncludes(pageSource, "<span>{overviewDonutScopeLabel}</span>", "calendar pie center label", errors);
  assertIncludes(pageSource, "<span>{chillerShareScopeLabel}</span>", "calendar chiller-share visible scoped label", errors);
  assertIncludes(pageSource, "<small>{chillerShareScopeHint}</small>", "calendar chiller-share visible scope hint", errors);
  assertIncludes(pageSource, "<span>口径校核</span>", "calendar visible scope audit label", errors);
  assertIncludes(pageSource, "<strong>{scopeAuditStatusLabel}</strong>", "calendar visible scope audit dynamic value", errors);
  assertIncludes(pageSource, "<small>{scopeAuditHint}</small>", "calendar visible scope audit hint", errors);
  assertNotIncludes(pageSource, "<span>总电量</span>", "calendar pie old center label", errors);
  assertNotIncludes(pageSource, "const overviewDonutTotal = isCalendarNumber(completedPower)", "calendar pie mixed total", errors);
  assertIncludes(pageSource, "const calendarMonthInputRef = useRef<HTMLInputElement | null>(null);", "calendar month input ref", errors);
  assertIncludes(pageSource, "function openCalendarMonthPicker(): void", "calendar month picker opener", errors);
  assertIncludes(pageSource, "aria-label=\"月能效日历查询\"", "calendar month query aria label", errors);
  assertIncludes(pageSource, "type=\"month\"", "calendar month query input", errors);
  assertIncludes(pageSource, "const queryMonth = calendarMonthInputRef.current?.value || calendarFilters.month;", "calendar month query reads live input", errors);
  assertIncludes(pageSource, "setCalendarFilters((current) => ({ ...current, month: queryMonth, mode: \"month\" }));", "calendar month query mode", errors);
  assertIncludes(pageSource, "setCalendarQuery({ month: queryMonth });", "calendar month query submit", errors);
  assertIncludes(pageSource, "setCalendarPieQuery({ date: queryMonth, dateType: \"2\" });", "calendar month query submits pie month scope", errors);
  assertIncludes(pageSource, "<span>月平均 COP</span>", "calendar monthly average KPI label", errors);
  assertIncludes(pageSource, "累计折算 COP ${formatCop(monthCoolingPowerRatio)}", "calendar cumulative COP helper", errors);
  assertIncludes(pageSource, "· 月口径 · 均值 ${formatCop(averageRatio)}", "calendar month scope average header pill", errors);
  assertIncludes(pageSource, "const hasDayData = quality.tone !== \"future\" && quality.tone !== \"missing\";", "calendar missing-day display guard", errors);
  assertIncludes(pageSource, "const displayRatio = hasDayData ? ratio : null;", "calendar missing-day COP display guard", errors);
  assertIncludes(pageSource, "const title = `${item.date || \"--\"} / 能效 ${formatCop(displayRatio)}", "calendar title fixed COP label", errors);
  assertIncludes(pageSource, "<span>达标线 6.50</span>", "calendar COP target-line copy", errors);
  assertNotIncludes(pageSource, "<span>阈值 6.50</span>", "calendar COP old threshold copy", errors);
  assertIncludes(pageSource, "const LOAD_BAND_LABELS = Array.from({ length: 10 }", "complete load-band label set", errors);
  assertIncludes(pageSource, "function buildCompleteLoadBandRows(rows: EnergyEfficiencyProportionRowDto[] = []): CompleteLoadBandRow[]", "complete load-band builder", errors);
  assertIncludes(pageSource, "return LOAD_BAND_LABELS.map((label) => {", "complete load-band row fill", errors);
  assertIncludes(pageSource, "const loadBandRows = buildCompleteLoadBandRows(proportionData?.rows || []);", "calendar load-band overview rows", errors);
  assertIncludes(pageSource, "const dominantLoadBand = getDominantLoadBand(loadBandRows);", "calendar dominant load-band overview", errors);
  assertIncludes(pageSource, "function getDominantLoadBand(rows: CompleteLoadBandRow[]): CompleteLoadBandRow | null", "dominant load-band helper", errors);
  assertIncludes(pageSource, "title: zhCN.energyEfficiencyPage.summaryLoadRatio,", "proportion dominant load-band summary", errors);
  assertIncludes(pageSource, "value: dominantLoadBand?.rangeLabel || \"--\",", "proportion dominant load-band value", errors);
  assertIncludes(pageSource, "unit: dominantLoadBand ? `${formatNumber(dominantLoadBand.loadRatioPct, 1)}%` : \"\",", "proportion dominant load-band visible share", errors);
  assertIncludes(pageSource, "const dominantPoint = points.reduce<typeof points[number] | null>", "proportion chart dominant point", errors);
  assertIncludes(pageSource, "<p>{zhCN.energyEfficiencyPage.proportionRatioLabel}</p>", "proportion dominant ratio label", errors);
  assertIncludes(pageSource, "<p>{zhCN.energyEfficiencyPage.proportionEfficiencyLabel}</p>", "proportion dominant COP label", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-proportion-load-bar\"", "proportion load bar visual class", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-proportion-efficiency-line\"", "proportion COP line visual class", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-proportion-efficiency-marker\"", "proportion COP marker visual class", errors);
  assertIncludes(pageSource, "const proportionTableRows = proportionData ? buildCompleteLoadBandRows(proportionData.rows || []) : [];", "proportion table complete rows", errors);
  assertIncludes(pageSource, "proportionTableRows.map((row) => {", "proportion table renders complete rows", errors);
  assertIncludes(pageSource, "function calculateThermalComplianceRate(rows: EnergyEfficiencyImbalanceStatisticRowDto[] = []): number | null", "thermal compliance weighted helper", errors);
  assertIncludes(pageSource, "function getThermalSampleTotal(data: EnergyEfficiencyImbalanceDto | null): number", "thermal sample total helper", errors);
  assertIncludes(pageSource, "const sampleCount = getThermalSampleTotal(data);", "thermal summary uses statistics total", errors);
  assertIncludes(pageSource, "title: zhCN.energyEfficiencyPage.summaryImbalanceStatus,", "thermal explicit status summary", errors);
  assertIncludes(pageSource, "tone: typeof complianceRate === \"number\" && complianceRate >= 95 ? \"good\" : \"warn\"", "thermal compliance warning tone", errors);
  assertIncludes(pageSource, "<h3>运行校核</h3>", "calendar operational check card title", errors);
  assertIncludes(pageSource, "<span>数据状态</span>", "calendar operational check source status", errors);
  assertIncludes(pageSource, "<span>AI门禁</span>", "calendar operational check gate", errors);
  assertIncludes(pageSource, "<span>主负荷段</span>", "calendar operational check load band", errors);
  assertIncludes(pageSource, "<span>热平衡</span>", "calendar operational check thermal balance", errors);
  assertIncludes(pageSource, "title: \"\\u8fbe\\u6807\\u8fb9\\u754c\",", "thermal boundary command label", errors);
  assertIncludes(pageSource, "<p>热平衡偏差达标范围</p>", "thermal pass-band chart copy", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-imbalance-pass-band\"", "thermal pass-band visual fill", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-imbalance-pass-line\"", "thermal pass-band boundary lines", errors);
  assertIncludes(pageSource, "className=\"energy-efficiency-imbalance-threshold-label\"", "thermal pass-band threshold labels", errors);
  assertIncludes(pageSource, "达标带 ±5% · 达标率 ${formatNumber(thermalOverview.complianceRate, 1)}%", "thermal overview compliance-rate copy", errors);
  assertNotIncludes(pageSource, "%达标`", "thermal ambiguous compliance copy", errors);
  assertIncludes(i18nSource, "imbalanceThresholdLabel: \"达标带 ±5%\"", "thermal pass-band i18n", errors);
  assertIncludes(i18nSource, "thermalDeviationRangeLabel: \"偏差值域\"", "thermal deviation range i18n", errors);
  assertIncludes(pageSource, "<p>{zhCN.energyEfficiencyPage.thermalDeviationRangeLabel}</p>", "thermal deviation range label usage", errors);
  assertIncludes(i18nSource, "summaryImbalancePoints: \"采样总数\"", "thermal sample total summary i18n", errors);
  assertIncludes(i18nSource, "summaryImbalanceStatus: \"热平衡状态\"", "thermal status i18n", errors);
  assertIncludes(i18nSource, "summaryImbalanceCompliance: \"热平衡达标率\"", "thermal compliance i18n", errors);
  assertIncludes(i18nSource, "imbalanceStatsAcquisitionValue: \"采样总数\"", "thermal sample total table header", errors);
  assertIncludes(i18nSource, "imbalanceStatsScalar: \"达标样本（±5%内）\"", "thermal in-band sample table header", errors);
  assertIncludes(i18nSource, "imbalanceStatsNoScalar: \"超限样本\"", "thermal out-of-band sample table header", errors);
  assertIncludes(i18nSource, "summaryLoadRatio: \"主负荷段\"", "dominant load-band i18n", errors);
  assertIncludes(i18nSource, "proportionRatioLabel: \"主负荷段占比\"", "dominant load-band chart ratio i18n", errors);
  assertIncludes(i18nSource, "proportionEfficiencyLabel: \"主负荷段 COP\"", "dominant load-band chart COP i18n", errors);
  assertIncludes(i18nSource, "summaryEfficiency: \"主负荷段能效\"", "dominant load-band summary efficiency i18n", errors);
  assertIncludes(i18nSource, "calendarCellEfficiency: \"能效\"", "calendar i18n efficiency label", errors);
  assertIncludes(i18nSource, "calendarCellPower: \"电量\"", "calendar i18n power label", errors);
  assertIncludes(i18nSource, "calendarCellCooling: \"冷量\"", "calendar i18n cooling label", errors);
  assertIncludes(i18nSource, "tableWholeValue: \"当前 COP\"", "search/compare current COP table header", errors);
  assertIncludes(i18nSource, "tableAverage: \"平均 COP\"", "search/compare average COP table header", errors);
  assertIncludes(i18nSource, "copRangeLabel: \"COP 值域\"", "search/compare COP range label", errors);
  assertIncludes(pageSource, "<p>{zhCN.energyEfficiencyPage.copRangeLabel}</p>", "search/compare trend COP range label usage", errors);
  assertIncludes(pageSource, "chartHint: zhCN.energyEfficiencyPage.copRangeLabel", "search/compare section COP range hint", errors);
  assertIncludes(i18nSource, "tableBestAverage: \"前10%高效 COP\"", "search/compare high-efficiency COP table header", errors);
  assertIncludes(i18nSource, "tableWorstAverage: \"后10%低效 COP\"", "search/compare low-efficiency COP table header", errors);
  assertIncludes(pageSource, "title=\"冷站 COP 趋势\"", "search chart professional title", errors);
  assertIncludes(pageSource, "title=\"COP 对比趋势\"", "compare chart professional title", errors);
  assertIncludes(styleSource, ".energy-efficiency-page:is([data-tab=\"search\"], [data-tab=\"compare\"]) .energy-analysis-line-path", "search/compare stronger trend line selector", errors);
  assertIncludes(styleSource, "stroke-width: 2.15 !important;", "search/compare stronger trend line width", errors);
  assertIncludes(styleSource, "grid-template-rows: minmax(0, 1fr) 22px !important;", "search/compare trend chart geometry guard", errors);
  assertIncludes(styleSource, ".energy-efficiency-page:is([data-tab=\"search\"], [data-tab=\"compare\"]) .energy-analysis-chart-interactive", "search/compare chart interactive geometry guard", errors);
  assertIncludes(styleSource, ".energy-efficiency-page:is([data-tab=\"search\"], [data-tab=\"compare\"]) .energy-analysis-x-axis", "search/compare x-axis geometry guard", errors);
  const searchCompare1280Start = styleSource.indexOf(SEARCH_COMPARE_1280_FIT_MARKER);
  if (searchCompare1280Start < 0) {
    errors.push("search/compare 1280x720 fit guard: marker missing");
  } else {
    const searchCompare1280End = styleSource.indexOf(".energy-efficiency-page[data-tab=\"calendar\"] .energy-efficiency-overview-kpi", searchCompare1280Start);
    const searchCompare1280Source = searchCompare1280End > searchCompare1280Start
      ? styleSource.slice(searchCompare1280Start, searchCompare1280End)
      : styleSource.slice(searchCompare1280Start);
    assertIncludes(searchCompare1280Source, "@media (max-width: 1320px) and (max-height: 760px)", "search/compare 1280x720 viewport guard", errors);
    assertIncludes(searchCompare1280Source, ".energy-efficiency-page:is([data-tab=\"search\"], [data-tab=\"compare\"]) > .section-card:nth-child(4)", "search/compare compact table selector", errors);
    assertIncludes(searchCompare1280Source, "height: 142px !important;", "search/compare compact table height", errors);
    assertIncludes(searchCompare1280Source, ".energy-efficiency-page[data-tab=\"compare\"] .energy-efficiency-compare-inline-actions", "compare compact actions selector", errors);
    assertIncludes(searchCompare1280Source, "grid-row: 2;", "compare compact actions row placement", errors);
    assertIncludes(searchCompare1280Source, ".energy-efficiency-page[data-tab=\"compare\"] .energy-efficiency-compare-selection-label em", "compare redundant hint removal selector", errors);
    assertIncludes(searchCompare1280Source, "display: none !important;", "compare redundant hint hidden in compact viewport", errors);
  }

  const finalCalendarFitStart = styleSource.indexOf(CALENDAR_FINAL_FIT_MARKER);
  if (finalCalendarFitStart < 0) {
    errors.push("calendar final 720p fit: marker missing");
  } else {
    const finalCalendarFitSource = styleSource.slice(finalCalendarFitStart);
    assertIncludes(finalCalendarFitSource, "height: 272px !important;", "calendar final main height", errors);
    assertIncludes(finalCalendarFitSource, "height: 160px !important;", "calendar final bottom height", errors);
    assertIncludes(finalCalendarFitSource, "grid-template-rows: 30px minmax(0, 76px) 46px !important;", "calendar final COP card rows", errors);
    assertIncludes(finalCalendarFitSource, "grid-template-columns: 48px minmax(0, 1fr) 36px 32px !important;", "calendar final load row columns", errors);
    assertIncludes(finalCalendarFitSource, "min-height: 11px !important;", "calendar final load row line box", errors);
  }

  const terminalViewportStart = styleSource.indexOf(CALENDAR_TERMINAL_VIEWPORT_MARKER);
  if (terminalViewportStart < 0) {
    errors.push("calendar terminal viewport guard: marker missing");
  } else {
    const terminalViewportSource = styleSource.slice(terminalViewportStart);
    assertIncludes(terminalViewportSource, "grid-template-rows: 70px 272px 160px !important;", "calendar terminal overview rows", errors);
    assertIncludes(terminalViewportSource, "align-content: start !important;", "calendar terminal fixed grid alignment", errors);
    assertIncludes(terminalViewportSource, "height: 70px !important;", "calendar terminal KPI height", errors);
    assertIncludes(terminalViewportSource, "height: 272px !important;", "calendar terminal main height", errors);
    assertIncludes(terminalViewportSource, "height: 160px !important;", "calendar terminal bottom height", errors);
  }

  const kpiReadabilityStart = styleSource.indexOf(CALENDAR_KPI_READABILITY_MARKER);
  if (kpiReadabilityStart < 0) {
    errors.push("calendar KPI readability guard: marker missing");
  } else {
    const kpiReadabilitySource = styleSource.slice(kpiReadabilityStart);
    assertIncludes(kpiReadabilitySource, "grid-template-rows: 70px 332px 131px !important;", "calendar KPI readable overview rows", errors);
    assertIncludes(kpiReadabilitySource, "grid-template-rows: 16px 22px 16px 3px !important;", "calendar KPI readable card rows", errors);
    assertIncludes(kpiReadabilitySource, "font-size: 11.5px !important;", "calendar KPI readable title size", errors);
    assertIncludes(kpiReadabilitySource, "line-height: 16px !important;", "calendar KPI readable title line-height", errors);
    assertIncludes(kpiReadabilitySource, "line-height: 22px !important;", "calendar KPI readable value line-height", errors);
    assertIncludes(kpiReadabilitySource, "height: 332px !important;", "calendar KPI readable main height compensation", errors);
  }

  const monthQueryStart = styleSource.indexOf(CALENDAR_MONTH_QUERY_MARKER);
  if (monthQueryStart < 0) {
    errors.push("calendar month query: marker missing");
  } else {
    const monthQuerySource = styleSource.slice(monthQueryStart);
    assertIncludes(monthQuerySource, ".energy-efficiency-calendar-query", "calendar month query container style", errors);
    assertIncludes(monthQuerySource, ".energy-efficiency-calendar-month-field", "calendar month field style", errors);
    assertIncludes(monthQuerySource, ".energy-efficiency-calendar-query-button", "calendar month query button style", errors);
    assertIncludes(monthQuerySource, "width: 94px !important;", "calendar month input compact width", errors);
    assertIncludes(monthQuerySource, "height: 24px !important;", "calendar month query compact height", errors);
  }

  const pieAssociationStart = styleSource.indexOf(CALENDAR_PIE_ASSOCIATION_MARKER);
  if (pieAssociationStart < 0) {
    errors.push("calendar pie association: marker missing");
  } else {
    const pieAssociationSource = styleSource.slice(pieAssociationStart);
    assertIncludes(pieAssociationSource, ".energy-efficiency-overview-pie-card .energy-efficiency-overview-card-head", "calendar pie association card head", errors);
    assertIncludes(pieAssociationSource, "max-width: 182px !important;", "calendar pie association label width", errors);
    assertIncludes(pieAssociationSource, "text-overflow: ellipsis !important;", "calendar pie association overflow guard", errors);
  }

  assertIncludes(styleSource, ".energy-efficiency-proportion-load-bar", "proportion load bar style", errors);
  assertIncludes(styleSource, ".energy-efficiency-proportion-efficiency-line", "proportion COP line style", errors);
  assertIncludes(styleSource, ".energy-efficiency-proportion-efficiency-marker", "proportion COP marker style", errors);
  const proportion1280ChartFitStart = styleSource.indexOf(PROPORTION_1280_CHART_FIT_MARKER);
  if (proportion1280ChartFitStart < 0) {
    errors.push("proportion 1280x720 chart fit guard: marker missing");
  } else {
    const proportion1280ChartFitSource = styleSource.slice(proportion1280ChartFitStart);
    assertIncludes(proportion1280ChartFitSource, "@media (max-width: 1320px) and (max-height: 760px)", "proportion 1280x720 media guard", errors);
    assertIncludes(proportion1280ChartFitSource, "grid-template-rows: 264px 52px !important;", "proportion shell fixed rows", errors);
    assertIncludes(proportion1280ChartFitSource, "height: 316px !important;", "proportion shell fixed height", errors);
    assertIncludes(proportion1280ChartFitSource, ".energy-efficiency-proportion-chart-interactive", "proportion interactive chart height selector", errors);
    assertIncludes(proportion1280ChartFitSource, "max-height: 264px !important;", "proportion chart max-height guard", errors);
    assertIncludes(proportion1280ChartFitSource, ".energy-efficiency-proportion-x-axis-frame", "proportion x-axis frame selector", errors);
    assertIncludes(proportion1280ChartFitSource, "height: 52px !important;", "proportion x-axis frame height", errors);
  }
  assertIncludes(styleSource, ".energy-efficiency-imbalance-pass-band", "thermal pass-band style", errors);
  assertIncludes(styleSource, ".energy-efficiency-imbalance-pass-line", "thermal pass-line style", errors);
  assertIncludes(styleSource, ".energy-efficiency-imbalance-threshold-label", "thermal threshold label style", errors);

  const internalClipStart = styleSource.indexOf(CALENDAR_INTERNAL_CLIP_MARKER);
  if (internalClipStart < 0) {
    errors.push("calendar 1280x720 internal clip guard: marker missing");
  } else {
    const internalClipSource = styleSource.slice(internalClipStart);
    assertIncludes(internalClipSource, "height: 130px !important;", "calendar internal card height", errors);
    assertIncludes(internalClipSource, "grid-template-rows: 24px minmax(0, 1fr) !important;", "calendar load/coverage rows fit", errors);
    assertIncludes(internalClipSource, "min-height: 8px !important;", "calendar load row compact height", errors);
    assertIncludes(internalClipSource, "font-size: 7.4px !important;", "calendar load row compact text", errors);
    assertIncludes(internalClipSource, "height: 52px !important;", "calendar trend compact height", errors);
    assertIncludes(internalClipSource, "height: 32px !important;", "calendar trend stats compact height", errors);
  }

  const loadFinalNoClipStart = styleSource.indexOf(CALENDAR_LOAD_FINAL_NO_CLIP_MARKER);
  if (loadFinalNoClipStart < 0) {
    errors.push("calendar load-band final no-clip guard: marker missing");
  } else {
    const loadFinalNoClipSource = styleSource.slice(loadFinalNoClipStart);
    assertIncludes(loadFinalNoClipSource, "grid-template-rows: repeat(10, 8px) !important;", "calendar load final row grid", errors);
    assertIncludes(loadFinalNoClipSource, "height: 8px !important;", "calendar load final row height", errors);
    assertIncludes(loadFinalNoClipSource, "font-size: 7.4px !important;", "calendar load final text size", errors);
    assertIncludes(loadFinalNoClipSource, "line-height: 8px !important;", "calendar load final text line-height", errors);
  }

  const finalNoClipStart = styleSource.indexOf(ENERGY_EFFICIENCY_FINAL_NO_CLIP_MARKER);
  if (finalNoClipStart < 0) {
    errors.push("final energy-efficiency no-clip guard: marker missing");
  } else {
    const finalNoClipEnd = styleSource.indexOf(".cold-log-cop-page .cold-log-header", finalNoClipStart);
    const finalNoClipSource = finalNoClipEnd > finalNoClipStart
      ? styleSource.slice(finalNoClipStart, finalNoClipEnd)
      : styleSource.slice(finalNoClipStart);
    assertIncludes(finalNoClipSource, "grid-template-rows: 13px minmax(33px, 1fr) !important;", "final no-clip day cell rows", errors);
    assertIncludes(finalNoClipSource, "grid-auto-rows: 11px !important;", "final no-clip day metric rows", errors);
    assertIncludes(finalNoClipSource, "height: 100% !important;", "final no-clip proportion chart height inheritance", errors);
    assertIncludes(finalNoClipSource, "max-height: 100% !important;", "final no-clip proportion chart max-height", errors);
    assertIncludes(finalNoClipSource, ".energy-efficiency-overview-donut strong", "final no-clip donut center selector", errors);
    assertIncludes(finalNoClipSource, "line-height: 32px !important;", "final no-clip donut center line-height", errors);
    assertIncludes(finalNoClipSource, "grid-template-rows: repeat(10, 12px) !important;", "final no-clip load list rows", errors);
    assertIncludes(finalNoClipSource, "grid-template-columns: 48px minmax(0, 1fr) 34px 30px !important;", "final no-clip load row columns", errors);
    assertIncludes(finalNoClipSource, "line-height: 12px !important;", "final no-clip load row line-height", errors);
    assertIncludes(finalNoClipSource, ".energy-efficiency-proportion-date-type-options", "final no-clip proportion date-type selector", errors);
    assertIncludes(finalNoClipSource, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important;", "final no-clip proportion date-type two-column grid", errors);
    assertIncludes(finalNoClipSource, "overflow: visible !important;", "final no-clip proportion date-type overflow", errors);
    assertIncludes(finalNoClipSource, "flex: 1 1 0 !important;", "final no-clip proportion date-type option flex reset", errors);
  }

  const finalReadabilityStart = styleSource.indexOf(ENERGY_EFFICIENCY_FINAL_READABILITY_MARKER);
  if (finalReadabilityStart < 0) {
    errors.push("final energy-efficiency readability pass: marker missing");
  } else {
    const finalReadabilityEnd = styleSource.indexOf(ENERGY_EFFICIENCY_VIEWPORT_GUARD_MARKER, finalReadabilityStart);
    const finalReadabilitySource = finalReadabilityEnd > finalReadabilityStart
      ? styleSource.slice(finalReadabilityStart, finalReadabilityEnd)
      : styleSource.slice(finalReadabilityStart);
    assertIncludes(finalReadabilitySource, "grid-template-rows: repeat(10, 10px) !important;", "final readability load rows", errors);
    assertIncludes(finalReadabilitySource, "height: 10px !important;", "final readability load row height", errors);
    assertIncludes(finalReadabilitySource, "font-size: 10px !important;", "final readability load row font size", errors);
    assertIncludes(finalReadabilitySource, "line-height: 10px !important;", "final readability load row line-height", errors);
    assertIncludes(finalReadabilitySource, "grid-template-rows: 56px 322px 148px !important;", "final readability calendar overview rows", errors);
    assertIncludes(finalReadabilitySource, "height: 322px !important;", "final readability calendar main height", errors);
    assertIncludes(finalReadabilitySource, "height: 148px !important;", "final readability calendar bottom height", errors);
  }

  const viewportGuardStart = styleSource.indexOf(ENERGY_EFFICIENCY_VIEWPORT_GUARD_MARKER);
  if (viewportGuardStart < 0) {
    errors.push("energy-efficiency viewport guard: marker missing");
  } else {
    const viewportGuardSource = styleSource.slice(viewportGuardStart);
    assertIncludes(viewportGuardSource, ".content.is-subpage-compact.has-secondary-nav:has(> .energy-efficiency-page)", "energy-efficiency outer viewport selector", errors);
    assertIncludes(viewportGuardSource, "height: calc(100vh - 99px) !important;", "energy-efficiency outer viewport height", errors);
    assertIncludes(viewportGuardSource, "overflow: hidden !important;", "energy-efficiency outer viewport overflow guard", errors);
  }

  if (
    loadFinalNoClipStart >= 0
    && finalNoClipStart >= 0
    && proportion1280ChartFitStart >= 0
    && finalReadabilityStart >= 0
    && viewportGuardStart >= 0
  ) {
    const markerOrder = [
      [CALENDAR_LOAD_FINAL_NO_CLIP_MARKER, loadFinalNoClipStart],
      [ENERGY_EFFICIENCY_FINAL_NO_CLIP_MARKER, finalNoClipStart],
      [PROPORTION_1280_CHART_FIT_MARKER, proportion1280ChartFitStart],
      [ENERGY_EFFICIENCY_FINAL_READABILITY_MARKER, finalReadabilityStart],
      [ENERGY_EFFICIENCY_VIEWPORT_GUARD_MARKER, viewportGuardStart]
    ];
    for (let index = 1; index < markerOrder.length; index += 1) {
      const [currentMarker, currentOffset] = markerOrder[index];
      const [previousMarker, previousOffset] = markerOrder[index - 1];
      if (currentOffset <= previousOffset) {
        errors.push(`energy-efficiency CSS terminal guard order: \`${currentMarker}\` must appear after \`${previousMarker}\``);
      }
    }
  }

  FORBIDDEN_COPY_PATTERNS.forEach(({ name, pattern }) => {
    if (pattern.test(combinedSource)) {
      errors.push(`forbidden copy: ${name}`);
    }
  });

  if (errors.length > 0) {
    console.error("Energy efficiency UI contract check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Energy efficiency UI contract check passed.");
  console.log(`- checked tabs: ${REQUIRED_TABS.length}`);
  console.log("- checked URL tab sync and invalid-tab normalization");
  console.log("- checked calendar labels: 能效 / 电量 / 冷量");
  console.log("- checked calendar default month scope, month query and monthly average COP");
  console.log("- checked calendar pie month/COP association");
  console.log("- checked cumulative COP helper wording: 累计折算 COP");
  console.log("- checked calendar COP target-line copy: 达标线 6.50");
  console.log("- checked calendar pie source alignment and 720p bottom-card fit");
  console.log("- checked complete 10-row load-band rendering and dominant-load COP contract");
  console.log("- checked proportion chart visual distinction and thermal pass-band rendering");
  console.log("- checked thermal balance explicit status, sample total, and warning tone");
  console.log("- checked real-Chrome calendar terminal viewport guard");
  console.log("- checked calendar KPI readability guard");
  console.log("- checked 1280x720 calendar bottom-card internal clip guard");
  console.log("- checked 1280x720 search/compare table fit guard");
  console.log("- checked load-band final no-clip guard after day-cell readability overrides");
  console.log("- checked final no-clip guard for calendar day cells, donut center, load rows and proportion controls");
  console.log("- checked terminal cascade order, final readability pass and outer viewport guard");
}

main();

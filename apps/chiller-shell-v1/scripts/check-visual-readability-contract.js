import fs from "node:fs";
import path from "node:path";

// Guards the compact industrial UI against the readability regressions found in
// browser QA: active status text must remain visible and engineering chart labels
// must not collapse below the operator-readable size.

const SHELL_ROOT = path.resolve(process.cwd());
const STYLE_FILE = path.join(SHELL_ROOT, "src/styles/global.css");
const DASHBOARD_PAGE_FILE = path.join(SHELL_ROOT, "src/pages/DashboardPage.tsx");
const ALARM_PAGE_FILE = path.join(SHELL_ROOT, "src/pages/AlarmPage.tsx");
const SYSTEM_OVERVIEW_PAGE_FILE = path.join(SHELL_ROOT, "src/pages/SystemOverviewPage.tsx");
const OPTIMIZE_PAGE_FILE = path.join(SHELL_ROOT, "src/pages/OptimizeDemoPage.tsx");
const BFF_CLIENT_FILE = path.join(SHELL_ROOT, "src/services/bffClient.ts");
const QA_SEED_FILE = path.join(SHELL_ROOT, "public/qa-auth-seed.html");

const TREND_ACTIVE_MARKER =
  "/* Trend control active state: avoid dark text disappearing when gradient rendering is degraded. */";
const TREND_ACTIVE_SELECTOR =
  ".trend-analysis-page--effect .trend-control-row button.is-active";
const TREND_GENERIC_BUTTON_SELECTOR =
  ".trend-analysis-page button,\n.content.is-subpage-compact .trend-analysis-page button";
const THERMAL_LABEL_SELECTOR =
  "html body #root .energy-efficiency-page .energy-efficiency-imbalance-threshold-label";
const THERMAL_BASE_SELECTOR =
  ".energy-efficiency-page .energy-efficiency-imbalance-threshold-label";
const ALARM_QUEUE_GUARD_MARKER =
  "/* Alarm queue final guard: keep row facts readable without expanding page scroll. */";
const SYSTEM_VERDICT_MARKER =
  "/* System overview verdict badge: keep shadow-validation status readable on low-brightness displays. */";
const SYSTEM_VERDICT_SELECTOR =
  ".system-overview-one-screen .system-overview-verdict em";
const PROJECT_RANK_MARKER =
  "/* Project queue rank badge: avoid low-contrast green-on-green badges on the selected card. */";
const PROJECT_RANK_SELECTOR =
  ".project-switch-page .project-switch-rank";
const DENSE_PAGE_GUARD_MARKER =
  "/* 720p final no-clip guard: keep dense audit/status panels readable without adding page scroll. */";
const HIGHEST_PRIORITY_GUARD_MARKER =
  "/* Highest-priority 720p no-clip correction after rendered audit. */";
const NAV_COUNT_SELECTOR = ".nav-module-count";
const PROJECT_PAGE_SELECTOR = ".content.is-subpage-compact > .project-switch-page";
const PERFORMANCE_SIDE_SELECTOR = ".performance-report-page--compact .performance-report-compact-side";
const PERFORMANCE_SUMMARY_PANEL_SELECTOR = ".performance-report-page--compact .performance-report-summary-panel";
const WORK_ORDER_PAGE_SELECTOR = "html body #root .content.is-subpage-compact .work-order-page";
const ENERGY_ANALYSIS_METRIC_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-analysis-compact-page-v2 .energy-analysis-compact-metric";
const STATUS_CHIP_CONTRAST_MARKER =
  "/* Status chip contrast guard: colored pills must remain readable on dark SCADA panels. */";
const ENERGY_TREE_COUNT_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-analysis-compact-page-v2 .energy-analysis-tree-count";
const STATUS_CHIP_WARN_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-analysis-compact-page-v2 .energy-analysis-compact-source-row em.is-warn";
const RENDERED_720P_NO_CLIP_MARKER =
  "/* Rendered 720p no-clip pass: keep compact engineering panels complete at 1280x720. */";
const PERFORMANCE_SUMMARY_FINAL_MARKER =
  "/* Performance report summary final two-row guard: show all four summary facts. */";
const DASHBOARD_COCKPIT_FINAL_MARKER =
  "/* Dashboard cockpit final no-cut guard: small status facts must not clip vertically at 1280x720. */";
const WORK_ORDER_HEADER_FINAL_MARKER =
  "/* Work-order header final no-overlap guard: top status metrics must not be covered by the query panel. */";
const TREND_STATS_FINAL_MARKER =
  "/* Trend series stats final no-clip guard: show every metric statistic in the right panel at 1280x720. */";
const OPTIMIZE_RESULT_SPOTLIGHT_MARKER =
  "/* Optimize advice result emphasis: make the generated outcome read as the primary result. */";
const OPTIMIZE_RESULT_OVERLAP_MARKER =
  "/* Optimize generated-result overlap guard: reserve real space for input scenario review after advice generation. */";
const OPTIMIZE_RESULT_CARD_NO_CLIP_MARKER =
  "/* Optimize result card no-clip guard: keep the five generated outcomes in one row at 1280px. */";
const OPTIMIZE_COMPACT_METRIC_NO_CLIP_MARKER =
  "/* Optimize compact metric no-clip guard: keep power and window values readable in the first viewport. */";
const OPTIMIZE_PAGE_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact:has(> .optimize-page) > .optimize-page";
const OPTIMIZE_INPUT_STATUS_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid";
const OPTIMIZE_INPUT_FORM_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:first-child .optimize-form";
const OPTIMIZE_INPUT_FORM_MAIN_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:first-child .optimize-form-main";
const OPTIMIZE_INPUT_PREFILL_META_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:first-child .optimize-form-prefill-meta";
const OPTIMIZE_INPUT_PREFILL_META_LAST_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:first-child .optimize-form-prefill-meta span:last-child";
const ENERGY_CALENDAR_VALUE_FINAL_MARKER =
  "/* Energy efficiency calendar value final guard: reserve enough width for daily kWh/cooling figures at 1280x720. */";
const BOTTOM_SAFE_AREA_MARKER =
  "/* 720p bottom safe-area guard: keep footer facts and scene controls clear of the viewport edge. */";
const FINAL_FOOTER_CLEARANCE_MARKER =
  "/* Rendered 720p final footer clearance guard: latest cascade wins over dense page overrides. */";
const FINAL_FOOTER_ENERGY_ANALYSIS_PAGE_SELECTOR =
  "html body #root .content.is-subpage-compact > .energy-analysis-compact-page-v2";
const FINAL_FOOTER_ENERGY_ANALYSIS_BOUNDARY_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-analysis-compact-page-v2 .energy-analysis-compact-boundary";
const FINAL_FOOTER_ENERGY_PARAMETER_PAGE_SELECTOR =
  "html body #root .content.is-subpage-compact > .energy-parameter-compact-page-v2";
const FINAL_FOOTER_ENERGY_PARAMETER_BOUNDARY_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-parameter-compact-page-v2 .energy-parameter-compact-boundary";
const FINAL_FOOTER_SCENE_PAGE_SELECTOR =
  "html body #root .content.is-scene-embed-content .scene-embed-page";
const FINAL_FOOTER_SCENE_SWITCHBAR_SELECTOR =
  "html body #root .content.is-scene-embed-content .scene-embed-switchbar";
const FINAL_FOOTER_SCENE_CURRENT_STRONG_SELECTOR =
  "html body #root .content.is-scene-embed-content .scene-embed-current strong";
const FINAL_FOOTER_METER_PAGE_SELECTOR =
  "html body #root .content.is-subpage-compact > .meter-reading-compact-page-v2";
const FINAL_FOOTER_METER_BOUNDARY_SELECTOR =
  "html body #root .content.is-subpage-compact .meter-reading-compact-page-v2 .meter-reading-compact-boundary";
const FINAL_FOOTER_ALARM_FOOTER_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .alarm-page-v2 .alarm-footer-grid";
const FINAL_FOOTER_REPORT_FOOTER_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .report-record-table-footer";
const ENERGY_PARAMETER_FINAL_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact > .energy-parameter-compact-page-v2";
const METER_READING_FINAL_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact > .meter-reading-compact-page-v2";
const PERFORMANCE_FINAL_SIDE_SELECTOR =
  "html body #root .content.is-subpage-compact .performance-report-page--compact .performance-report-compact-side";
const PERFORMANCE_FINAL_QUERY_SELECTOR =
  "html body #root .content.is-subpage-compact .performance-report-page--compact .performance-report-compact-query";
const PERFORMANCE_FINAL_SUMMARY_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .performance-report-page--compact .performance-report-summary-grid";
const PERFORMANCE_FINAL_SUMMARY_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .performance-report-page--compact .performance-report-summary-grid strong";
const DASHBOARD_COCKPIT_CONTROL_SMALL_SELECTOR =
  "html body #root .content.is-dashboard-content .dashboard-cockpit-control-row small";
const SCENE_ACTIVE_SELECTOR =
  "html body #root .content.is-subpage-compact .scene-embed-actions button.active";
const SYSTEM_ACTION_SELECTOR =
  "html body #root .content.is-subpage-compact .system-overview-one-screen .system-overview-actions a";
const OPERATION_RECORD_PRIMARY_SELECTOR =
  "html body #root .content.is-subpage-compact .operation-record-page-v2 .operation-record-button.is-primary";
const WORK_ORDER_FINAL_PAGE_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page";
const WORK_ORDER_FINAL_COMMAND_COPY_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-copy";
const WORK_ORDER_FINAL_DESCRIPTION_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-copy > p:not(.work-order-eyebrow)";
const WORK_ORDER_FINAL_SUMMARY_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-summary-grid";
const WORK_ORDER_FINAL_SIDE_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-side";
const WORK_ORDER_FINAL_STAT_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-stat strong";
const WORK_ORDER_FINAL_SIDE_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-side > strong";
const WORK_ORDER_FINAL_SIDE_COPY_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-command-side > p";
const WORK_ORDER_FINAL_FILTER_COPY_SELECTOR =
  "html body #root .content.is-subpage-compact .work-order-page .work-order-filter-panel > p";
const TREND_FINAL_MAIN_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .trend-analysis-page--effect .trend-main-grid";
const TREND_FINAL_STATS_HINT_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .trend-analysis-page--effect .trend-main-grid > .section-card:nth-child(2) .empty-hint";
const TREND_FINAL_STATS_LIST_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .trend-analysis-page--effect .trend-stat-list--compact";
const TREND_FINAL_STATS_ITEM_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .trend-analysis-page--effect .trend-stat-list--compact .trend-stat-item";
const OPTIMIZE_RESULT_STAGE_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-workspace-stage";
const OPTIMIZE_RESULT_CARD_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-result-card-grid";
const OPTIMIZE_RESULT_CARD_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-result-card-grid strong";
const OPTIMIZE_RESULT_PRIMARY_CARD_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-result-card-grid article.is-primary";
const OPTIMIZE_RESULT_PRIMARY_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-result-card-grid article.is-primary strong";
const OPTIMIZE_RESULT_STAGE_COPY_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-workspace-stage-copy";
const OPTIMIZE_RESULT_STAGE_COPY_BODY_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-workspace-stage-copy p";
const OPTIMIZE_COMPACT_METRIC_CURRENT_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:nth-child(2) .optimize-compact-metric-grid";
const OPTIMIZE_COMPACT_METRIC_BENEFIT_GRID_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid > .section-card:nth-child(3) .optimize-compact-metric-grid";
const OPTIMIZE_COMPACT_METRIC_CARD_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .optimize-page .optimize-input-status-grid .optimize-compact-metric-grid .optimize-response-card :is(strong)";
const ENERGY_CALENDAR_VALUE_DIV_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-efficiency-page.page-enter[data-tab=\"calendar\"] .energy-efficiency-overview-day-metrics div";
const ENERGY_CALENDAR_VALUE_STRONG_SELECTOR =
  "html body #root .content.is-subpage-compact .energy-efficiency-page.page-enter[data-tab=\"calendar\"] .energy-efficiency-overview-day-metrics strong";
const BOTTOM_SAFE_AREA_ALARM_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .alarm-page-v2 .alarm-footer-grid";
const BOTTOM_SAFE_AREA_SCENE_BUTTON_SELECTOR =
  "html body #root .content.is-subpage-compact .scene-embed-toolbar button";
const BOTTOM_SAFE_AREA_OPERATION_ARTICLE_SELECTOR =
  "html body #root .content.is-subpage-compact .operation-record-page-v2 .operation-record-boundary-strip article";
const BOTTOM_SAFE_AREA_REPORT_BUTTON_SELECTOR =
  "html body #root .content.is-subpage-compact.has-secondary-nav .report-record-table-footer .report-record-pagination button";
const BOTTOM_SAFE_AREA_SCENE_STATUS_SELECTOR =
  "html body #root .content.is-subpage-compact .scene-embed-frame-status";
const BOTTOM_SAFE_AREA_SCENE_EMBED_STATUS_SELECTOR =
  "html body #root .content.is-scene-embed-content .scene-embed-frame-status";

function findRuleBlock(source, selector, fromIndex = 0) {
  const start = source.indexOf(selector, fromIndex);
  if (start < 0) {
    return null;
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) {
    return null;
  }
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          end: index + 1,
          text: source.slice(start, index + 1)
        };
      }
    }
  }
  return null;
}

function assertIncludes(source, needle, label, errors) {
  if (!source.includes(needle)) {
    errors.push(`${label}: missing \`${needle}\``);
  }
}

function assertOrder(source, before, after, label, errors) {
  const beforeIndex = source.lastIndexOf(before);
  const afterIndex = source.lastIndexOf(after);
  if (beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex) {
    errors.push(`${label}: expected \`${after}\` after \`${before}\``);
  }
}

function main() {
  const styleSource = fs.readFileSync(STYLE_FILE, "utf8");
  const dashboardSource = fs.readFileSync(DASHBOARD_PAGE_FILE, "utf8");
  const alarmSource = fs.readFileSync(ALARM_PAGE_FILE, "utf8");
  const systemOverviewSource = fs.readFileSync(SYSTEM_OVERVIEW_PAGE_FILE, "utf8");
  const optimizeSource = fs.readFileSync(OPTIMIZE_PAGE_FILE, "utf8");
  const bffClientSource = fs.readFileSync(BFF_CLIENT_FILE, "utf8");
  const errors = [];

  if (fs.existsSync(QA_SEED_FILE)) {
    errors.push("temporary QA auth seed file must not be committed: public/qa-auth-seed.html");
  }

  assertIncludes(styleSource, TREND_ACTIVE_MARKER, "trend active readability guard", errors);
  assertOrder(
    styleSource,
    TREND_GENERIC_BUTTON_SELECTOR,
    TREND_ACTIVE_MARKER,
    "trend active final cascade order",
    errors
  );

  const trendGuardStart = styleSource.indexOf(TREND_ACTIVE_MARKER);
  const trendActiveBlock = findRuleBlock(styleSource, TREND_ACTIVE_SELECTOR, trendGuardStart);
  if (!trendActiveBlock) {
    errors.push("trend active readability guard: selector block missing");
  } else {
    assertIncludes(trendActiveBlock.text, "color: #f4fffb !important;", "trend active readable text color", errors);
    assertIncludes(trendActiveBlock.text, "rgba(18, 138, 103, 0.98)", "trend active dark green background", errors);
    assertIncludes(trendActiveBlock.text, "rgba(18, 93, 135, 0.98)", "trend active dark blue background", errors);
    assertIncludes(trendActiveBlock.text, "text-shadow:", "trend active text-shadow", errors);
    if (/color:\s*#061411\s*!important/.test(trendActiveBlock.text)) {
      errors.push("trend active readable text color: dark-on-dark color returned");
    }
  }

  const thermalBaseBlock = findRuleBlock(styleSource, `\n${THERMAL_BASE_SELECTOR}`);
  const thermalFinalIndex = styleSource.indexOf(THERMAL_LABEL_SELECTOR);
  if (!thermalBaseBlock || thermalFinalIndex < 0 || thermalBaseBlock.start >= thermalFinalIndex) {
    errors.push("thermal threshold final cascade order: expected final override after base rule");
  }
  const thermalOverrideBlock = findRuleBlock(styleSource, THERMAL_LABEL_SELECTOR);
  if (!thermalOverrideBlock) {
    errors.push("thermal threshold readability guard: selector block missing");
  } else {
    assertIncludes(thermalOverrideBlock.text, "font-size: 10.8px !important;", "thermal threshold readable font size", errors);
    assertIncludes(thermalOverrideBlock.text, "stroke-width: 0.42px !important;", "thermal threshold readable stroke", errors);
  }

  assertIncludes(styleSource, ALARM_QUEUE_GUARD_MARKER, "alarm queue readability guard", errors);
  assertIncludes(alarmSource, '"仅保守观察"', "alarm compact gate action copy", errors);
  const alarmGuardStart = styleSource.indexOf(ALARM_QUEUE_GUARD_MARKER);
  const alarmGuardSource = alarmGuardStart >= 0 ? styleSource.slice(alarmGuardStart) : "";
  assertIncludes(alarmGuardSource, ".alarm-page-v2 .alarm-queue-action span", "alarm queue action text guard", errors);
  assertIncludes(alarmGuardSource, "-webkit-line-clamp: 2 !important;", "alarm queue two-line clamp", errors);
  assertIncludes(alarmGuardSource, "line-height: 14px !important;", "alarm queue readable line-height", errors);

  assertIncludes(styleSource, SYSTEM_VERDICT_MARKER, "system overview verdict badge readability guard", errors);
  assertIncludes(dashboardSource, '"湿球/干球/接近未传回"', "dashboard outdoor boundary compact missing copy", errors);
  assertIncludes(systemOverviewSource, '"负荷率待回传"', "system overview load node compact fallback", errors);
  assertIncludes(systemOverviewSource, '"冷量待回传"', "system overview load node compact fallback", errors);
  if (systemOverviewSource.includes("该项目缺少额定制冷量或负荷率字段无法计算")) {
    errors.push("system overview load node compact fallback: long missing-load-rate text returned");
  }

  const systemVerdictStart = styleSource.indexOf(SYSTEM_VERDICT_MARKER);
  const systemVerdictBlock = findRuleBlock(styleSource, SYSTEM_VERDICT_SELECTOR, systemVerdictStart);
  if (!systemVerdictBlock) {
    errors.push("system overview verdict badge readability guard: selector block missing");
  } else {
    assertIncludes(systemVerdictBlock.text, "color: #fff0bf !important;", "system overview verdict badge readable text color", errors);
    assertIncludes(systemVerdictBlock.text, "rgba(94, 60, 18, 0.94)", "system overview verdict badge dark background", errors);
    assertIncludes(systemVerdictBlock.text, "font-size: 10.8px !important;", "system overview verdict badge readable font size", errors);
    assertIncludes(systemVerdictBlock.text, "text-shadow:", "system overview verdict badge text-shadow", errors);
  }

  assertIncludes(styleSource, PROJECT_RANK_MARKER, "project queue rank readability guard", errors);
  const projectRankStart = styleSource.indexOf(PROJECT_RANK_MARKER);
  const projectRankBlock = findRuleBlock(styleSource, PROJECT_RANK_SELECTOR, projectRankStart);
  if (!projectRankBlock) {
    errors.push("project queue rank readability guard: selector block missing");
  } else {
    assertIncludes(projectRankBlock.text, "color: #effff8 !important;", "project queue rank readable text color", errors);
    assertIncludes(projectRankBlock.text, "rgba(18, 113, 84, 0.96)", "project queue rank dark green background", errors);
    assertIncludes(projectRankBlock.text, "font-size: 10.8px !important;", "project queue rank readable font size", errors);
    assertIncludes(projectRankBlock.text, "text-shadow:", "project queue rank text-shadow", errors);
  }

  assertIncludes(styleSource, DENSE_PAGE_GUARD_MARKER, "dense page final no-clip guard", errors);
  const denseGuardStart = styleSource.indexOf(DENSE_PAGE_GUARD_MARKER);
  const navCountBlock = findRuleBlock(styleSource, NAV_COUNT_SELECTOR, denseGuardStart);
  if (!navCountBlock) {
    errors.push("dense page final no-clip guard: nav count selector block missing");
  } else {
    assertIncludes(navCountBlock.text, "color: #f4fbff !important;", "nav module count readable text color", errors);
    assertIncludes(navCountBlock.text, "rgba(27, 65, 91, 0.92)", "nav module count solid dark background", errors);
    assertIncludes(navCountBlock.text, "text-shadow:", "nav module count text-shadow", errors);
  }

  const projectPageBlock = findRuleBlock(styleSource, PROJECT_PAGE_SELECTOR, denseGuardStart);
  if (!projectPageBlock) {
    errors.push("dense page final no-clip guard: project page selector block missing");
  } else {
    assertIncludes(projectPageBlock.text, "grid-template-rows: 120px 86px minmax(0, 1fr) !important;", "project page compact grid rows", errors);
  }

  const performanceSideBlock = findRuleBlock(styleSource, PERFORMANCE_SIDE_SELECTOR, denseGuardStart);
  if (!performanceSideBlock) {
    errors.push("dense page final no-clip guard: performance side selector block missing");
  } else {
    assertIncludes(performanceSideBlock.text, "grid-template-rows: 152px minmax(0, 1fr) 88px !important;", "performance side compact grid rows", errors);
  }

  const performanceSummaryPanelBlock = findRuleBlock(styleSource, PERFORMANCE_SUMMARY_PANEL_SELECTOR, denseGuardStart);
  if (!performanceSummaryPanelBlock) {
    errors.push("dense page final no-clip guard: performance summary panel selector block missing");
  } else {
    assertIncludes(performanceSummaryPanelBlock.text, "min-height: 152px !important;", "performance summary readable panel height", errors);
  }

  assertIncludes(styleSource, HIGHEST_PRIORITY_GUARD_MARKER, "highest priority 720p no-clip correction", errors);
  const highestGuardStart = styleSource.indexOf(HIGHEST_PRIORITY_GUARD_MARKER);
  const workOrderPageBlock = findRuleBlock(styleSource, WORK_ORDER_PAGE_SELECTOR, highestGuardStart);
  if (!workOrderPageBlock) {
    errors.push("highest priority 720p no-clip correction: work-order page selector block missing");
  } else {
    assertIncludes(workOrderPageBlock.text, "grid-template-rows: 132px 156px minmax(0, 1fr) !important;", "work-order compact grid rows", errors);
  }

  const energyAnalysisMetricBlock = findRuleBlock(styleSource, ENERGY_ANALYSIS_METRIC_SELECTOR, highestGuardStart);
  if (!energyAnalysisMetricBlock) {
    errors.push("highest priority 720p no-clip correction: energy-analysis metric selector block missing");
  } else {
    assertIncludes(energyAnalysisMetricBlock.text, "height: 64px !important;", "energy-analysis metric readable height", errors);
    assertIncludes(energyAnalysisMetricBlock.text, "min-height: 64px !important;", "energy-analysis metric readable min-height", errors);
  }

  assertIncludes(styleSource, STATUS_CHIP_CONTRAST_MARKER, "status chip contrast guard", errors);
  const statusChipStart = styleSource.indexOf(STATUS_CHIP_CONTRAST_MARKER);
  const energyTreeCountBlock = findRuleBlock(styleSource, ENERGY_TREE_COUNT_SELECTOR, statusChipStart);
  if (!energyTreeCountBlock) {
    errors.push("status chip contrast guard: energy tree count selector block missing");
  } else {
    assertIncludes(energyTreeCountBlock.text, "color: #eafff5 !important;", "status chip readable good text color", errors);
    assertIncludes(energyTreeCountBlock.text, "rgba(15, 96, 72, 0.94)", "status chip solid good background", errors);
    assertIncludes(energyTreeCountBlock.text, "text-shadow:", "status chip text-shadow", errors);
  }

  const statusWarnBlock = findRuleBlock(styleSource, STATUS_CHIP_WARN_SELECTOR, statusChipStart);
  if (!statusWarnBlock) {
    errors.push("status chip contrast guard: warning selector block missing");
  } else {
    assertIncludes(statusWarnBlock.text, "color: #fff1c7 !important;", "status chip readable warning text color", errors);
    assertIncludes(statusWarnBlock.text, "rgba(100, 67, 21, 0.94)", "status chip solid warning background", errors);
  }

  assertIncludes(styleSource, RENDERED_720P_NO_CLIP_MARKER, "rendered 720p no-clip pass", errors);
  assertOrder(
    styleSource,
    STATUS_CHIP_CONTRAST_MARKER,
    RENDERED_720P_NO_CLIP_MARKER,
    "rendered 720p final cascade order",
    errors
  );
  const renderedGuardStart = styleSource.indexOf(RENDERED_720P_NO_CLIP_MARKER);
  const energyParameterFinalGridBlock = findRuleBlock(styleSource, ENERGY_PARAMETER_FINAL_GRID_SELECTOR, renderedGuardStart);
  if (!energyParameterFinalGridBlock) {
    errors.push("rendered 720p no-clip pass: energy-parameter final grid selector block missing");
  } else {
    assertIncludes(
      energyParameterFinalGridBlock.text,
      "grid-template-rows: 68px 70px minmax(0, 1fr) 34px !important;",
      "energy-parameter final grid rows",
      errors
    );
  }

  const meterReadingFinalGridBlock = findRuleBlock(styleSource, METER_READING_FINAL_GRID_SELECTOR, renderedGuardStart);
  if (!meterReadingFinalGridBlock) {
    errors.push("rendered 720p no-clip pass: meter-reading final grid selector block missing");
  } else {
    assertIncludes(
      meterReadingFinalGridBlock.text,
      "grid-template-rows: 64px 70px minmax(0, 1fr) 34px !important;",
      "meter-reading final grid rows",
      errors
    );
  }

  const performanceFinalSideBlock = findRuleBlock(styleSource, PERFORMANCE_FINAL_SIDE_SELECTOR, renderedGuardStart);
  if (!performanceFinalSideBlock) {
    errors.push("rendered 720p no-clip pass: performance final side selector block missing");
  } else {
    assertIncludes(
      performanceFinalSideBlock.text,
      "grid-template-rows: 148px minmax(0, 1fr) 112px !important;",
      "performance final side grid rows",
      errors
    );
  }

  const performanceFinalQueryBlock = findRuleBlock(styleSource, PERFORMANCE_FINAL_QUERY_SELECTOR, renderedGuardStart);
  if (!performanceFinalQueryBlock) {
    errors.push("rendered 720p no-clip pass: performance query selector block missing");
  } else {
    assertIncludes(
      performanceFinalQueryBlock.text,
      "grid-template-columns: minmax(98px, 1fr) minmax(98px, 1fr) 176px !important;",
      "performance final query grid columns",
      errors
    );
  }

  assertIncludes(styleSource, PERFORMANCE_SUMMARY_FINAL_MARKER, "performance report summary final two-row guard", errors);
  const performanceSummaryFinalStart = styleSource.indexOf(PERFORMANCE_SUMMARY_FINAL_MARKER);
  const performanceFinalSummaryGridBlock = findRuleBlock(
    styleSource,
    PERFORMANCE_FINAL_SUMMARY_GRID_SELECTOR,
    performanceSummaryFinalStart
  );
  if (!performanceFinalSummaryGridBlock) {
    errors.push("rendered 720p no-clip pass: performance summary grid selector block missing");
  } else {
    assertIncludes(
      performanceFinalSummaryGridBlock.text,
      "grid-template-columns: repeat(2, minmax(0, 1fr)) !important;",
      "performance final summary two-column grid",
      errors
    );
    assertIncludes(
      performanceFinalSummaryGridBlock.text,
      "grid-template-rows: repeat(2, 42px) !important;",
      "performance final summary two-row grid",
      errors
    );
  }

  const performanceFinalSummaryStrongBlock = findRuleBlock(
    styleSource,
    PERFORMANCE_FINAL_SUMMARY_STRONG_SELECTOR,
    performanceSummaryFinalStart
  );
  if (!performanceFinalSummaryStrongBlock) {
    errors.push("rendered 720p no-clip pass: performance summary strong selector block missing");
  } else {
    assertIncludes(
      performanceFinalSummaryStrongBlock.text,
      "min-height: 16px !important;",
      "performance final summary value no-cut height",
      errors
    );
    assertIncludes(
      performanceFinalSummaryStrongBlock.text,
      "line-height: 16px !important;",
      "performance final summary value no-cut line-height",
      errors
    );
  }

  const sceneActiveBlock = findRuleBlock(styleSource, SCENE_ACTIVE_SELECTOR, renderedGuardStart);
  if (!sceneActiveBlock) {
    errors.push("rendered 720p no-clip pass: scene active selector block missing");
  } else {
    assertIncludes(sceneActiveBlock.text, "color: #f8fffc !important;", "scene active readable text color", errors);
    assertIncludes(sceneActiveBlock.text, "rgba(18, 119, 88, 0.98)", "scene active dark green background", errors);
    assertIncludes(sceneActiveBlock.text, "rgba(19, 84, 122, 0.98)", "scene active dark blue background", errors);
    assertIncludes(sceneActiveBlock.text, "text-shadow:", "scene active text-shadow", errors);
  }

  const systemActionBlock = findRuleBlock(styleSource, SYSTEM_ACTION_SELECTOR, renderedGuardStart);
  if (!systemActionBlock) {
    errors.push("rendered 720p no-clip pass: system action selector block missing");
  } else {
    assertIncludes(systemActionBlock.text, "color: #f8fffc !important;", "system action readable text color", errors);
    assertIncludes(systemActionBlock.text, "rgba(18, 119, 88, 0.98)", "system action dark green background", errors);
    assertIncludes(systemActionBlock.text, "text-shadow:", "system action text-shadow", errors);
  }

  const operationRecordPrimaryBlock = findRuleBlock(styleSource, OPERATION_RECORD_PRIMARY_SELECTOR, renderedGuardStart);
  if (!operationRecordPrimaryBlock) {
    errors.push("rendered 720p no-clip pass: operation record primary selector block missing");
  } else {
    assertIncludes(operationRecordPrimaryBlock.text, "color: #f8fffc !important;", "operation record primary readable text color", errors);
    assertIncludes(operationRecordPrimaryBlock.text, "rgba(18, 119, 88, 0.98)", "operation record primary dark green background", errors);
    assertIncludes(operationRecordPrimaryBlock.text, "text-shadow:", "operation record primary text-shadow", errors);
  }

  assertIncludes(styleSource, DASHBOARD_COCKPIT_FINAL_MARKER, "dashboard cockpit final no-cut guard", errors);
  const dashboardCockpitFinalStart = styleSource.indexOf(DASHBOARD_COCKPIT_FINAL_MARKER);
  const dashboardControlSmallBlock = findRuleBlock(
    styleSource,
    DASHBOARD_COCKPIT_CONTROL_SMALL_SELECTOR,
    dashboardCockpitFinalStart
  );
  if (!dashboardControlSmallBlock) {
    errors.push("dashboard cockpit final no-cut guard: control row small selector block missing");
  } else {
    assertIncludes(dashboardControlSmallBlock.text, "min-height: 14px !important;", "dashboard control small no-cut height", errors);
    assertIncludes(dashboardControlSmallBlock.text, "line-height: 14px !important;", "dashboard control small no-cut line-height", errors);
  }

  assertIncludes(styleSource, WORK_ORDER_HEADER_FINAL_MARKER, "work-order header final no-overlap guard", errors);
  const workOrderHeaderFinalStart = styleSource.indexOf(WORK_ORDER_HEADER_FINAL_MARKER);
  const workOrderFinalPageBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_PAGE_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderFinalPageBlock) {
    errors.push("work-order header final no-overlap guard: page grid selector block missing");
  } else {
    assertIncludes(
      workOrderFinalPageBlock.text,
      "grid-template-rows: 132px 156px minmax(0, 1fr) !important;",
      "work-order final page grid rows",
      errors
    );
    assertIncludes(workOrderFinalPageBlock.text, "gap: 6px !important;", "work-order final page gap", errors);
  }

  const workOrderCommandCopyBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_COMMAND_COPY_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderCommandCopyBlock) {
    errors.push("work-order header final no-overlap guard: command copy selector block missing");
  } else {
    assertIncludes(
      workOrderCommandCopyBlock.text,
      "grid-template-rows: 13px 25px 24px 50px !important;",
      "work-order command copy fixed rows",
      errors
    );
    assertIncludes(workOrderCommandCopyBlock.text, "overflow: hidden !important;", "work-order command copy bounded overflow", errors);
  }

  const workOrderDescriptionBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_DESCRIPTION_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderDescriptionBlock) {
    errors.push("work-order header final no-overlap guard: redundant description hide selector missing");
  } else {
    assertIncludes(workOrderDescriptionBlock.text, "display: none !important;", "work-order redundant header copy hidden", errors);
  }

  const workOrderSummaryGridBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_SUMMARY_GRID_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderSummaryGridBlock) {
    errors.push("work-order header final no-overlap guard: summary grid selector block missing");
  } else {
    assertIncludes(workOrderSummaryGridBlock.text, "height: 50px !important;", "work-order summary grid fixed height", errors);
    assertIncludes(workOrderSummaryGridBlock.text, "overflow: hidden !important;", "work-order summary grid bounded overflow", errors);
  }

  const workOrderSideBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_SIDE_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderSideBlock) {
    errors.push("work-order header final no-overlap guard: side selector block missing");
  } else {
    assertIncludes(
      workOrderSideBlock.text,
      "grid-template-rows: 13px 28px minmax(0, 1fr) !important;",
      "work-order side fixed rows",
      errors
    );
  }

  const workOrderStatStrongBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_STAT_STRONG_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderStatStrongBlock) {
    errors.push("work-order header final no-overlap guard: stat strong selector block missing");
  } else {
    assertIncludes(workOrderStatStrongBlock.text, "min-height: 21px !important;", "work-order stat value no-cut height", errors);
    assertIncludes(workOrderStatStrongBlock.text, "line-height: 21px !important;", "work-order stat value no-cut line-height", errors);
  }

  const workOrderSideStrongBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_SIDE_STRONG_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderSideStrongBlock) {
    errors.push("work-order header final no-overlap guard: side strong selector block missing");
  } else {
    assertIncludes(workOrderSideStrongBlock.text, "min-height: 28px !important;", "work-order side status no-cut height", errors);
    assertIncludes(workOrderSideStrongBlock.text, "line-height: 28px !important;", "work-order side status no-cut line-height", errors);
  }

  const workOrderSideCopyBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_SIDE_COPY_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderSideCopyBlock) {
    errors.push("work-order header final no-overlap guard: side copy hide selector missing");
  } else {
    assertIncludes(workOrderSideCopyBlock.text, "display: none !important;", "work-order redundant side copy hidden", errors);
  }

  const workOrderFilterCopyBlock = findRuleBlock(styleSource, WORK_ORDER_FINAL_FILTER_COPY_SELECTOR, workOrderHeaderFinalStart);
  if (!workOrderFilterCopyBlock) {
    errors.push("work-order header final no-overlap guard: filter copy hide selector missing");
  } else {
    assertIncludes(workOrderFilterCopyBlock.text, "display: none !important;", "work-order redundant filter copy hidden", errors);
  }

  assertIncludes(styleSource, TREND_STATS_FINAL_MARKER, "trend series stats final no-clip guard", errors);
  const trendStatsFinalStart = styleSource.indexOf(TREND_STATS_FINAL_MARKER);
  const trendFinalMainGridBlock = findRuleBlock(styleSource, TREND_FINAL_MAIN_GRID_SELECTOR, trendStatsFinalStart);
  if (!trendFinalMainGridBlock) {
    errors.push("trend series stats final no-clip guard: main grid selector block missing");
  } else {
    assertIncludes(
      trendFinalMainGridBlock.text,
      "grid-template-columns: minmax(0, 1fr) minmax(340px, 360px) !important;",
      "trend stats final right panel width",
      errors
    );
  }

  const trendFinalStatsHintBlock = findRuleBlock(styleSource, TREND_FINAL_STATS_HINT_SELECTOR, trendStatsFinalStart);
  if (!trendFinalStatsHintBlock) {
    errors.push("trend series stats final no-clip guard: redundant hint hide selector missing");
  } else {
    assertIncludes(trendFinalStatsHintBlock.text, "display: none !important;", "trend stats redundant hint hidden", errors);
  }

  const trendFinalStatsListBlock = findRuleBlock(styleSource, TREND_FINAL_STATS_LIST_SELECTOR, trendStatsFinalStart);
  if (!trendFinalStatsListBlock) {
    errors.push("trend series stats final no-clip guard: stats list selector block missing");
  } else {
    assertIncludes(
      trendFinalStatsListBlock.text,
      "grid-template-columns: repeat(2, minmax(0, 1fr)) !important;",
      "trend stats final two-column list",
      errors
    );
  }

  const trendFinalStatsItemBlock = findRuleBlock(styleSource, TREND_FINAL_STATS_ITEM_SELECTOR, trendStatsFinalStart);
  if (!trendFinalStatsItemBlock) {
    errors.push("trend series stats final no-clip guard: stats item selector block missing");
  } else {
    assertIncludes(trendFinalStatsItemBlock.text, "height: 56px !important;", "trend stats final item height", errors);
    assertIncludes(
      trendFinalStatsItemBlock.text,
      "grid-template-rows: 13px repeat(3, 12px) !important;",
      "trend stats final item rows",
      errors
    );
  }

  assertIncludes(styleSource, OPTIMIZE_RESULT_SPOTLIGHT_MARKER, "optimize result spotlight final guard", errors);
  const optimizeResultSpotlightStart = styleSource.indexOf(OPTIMIZE_RESULT_SPOTLIGHT_MARKER);
  const optimizeResultStageBlock = findRuleBlock(styleSource, OPTIMIZE_RESULT_STAGE_SELECTOR, optimizeResultSpotlightStart);
  if (!optimizeResultStageBlock) {
    errors.push("optimize result spotlight final guard: result stage selector block missing");
  } else {
    assertIncludes(optimizeResultStageBlock.text, "height: 124px !important;", "optimize result stage prominent height", errors);
    assertIncludes(
      optimizeResultStageBlock.text,
      "grid-template-columns: minmax(166px, 0.42fr) minmax(0, 3.2fr) !important;",
      "optimize result stage two-part grid",
      errors
    );
  }

  assertIncludes(optimizeSource, 'label: "本次优化结论"', "optimize result primary label", errors);
  assertIncludes(optimizeSource, "const benefitPowerDeltaLabel =", "optimize result benefit label", errors);
  assertIncludes(optimizeSource, "? \"预计节电功率\"", "optimize result saving label", errors);
  assertIncludes(optimizeSource, "? \"预计增耗功率\"", "optimize result increase label", errors);
  assertIncludes(
    optimizeSource,
    "Math.abs(benefitPowerDeltaKw)",
    "optimize result saving value shown as positive magnitude",
    errors
  );
  assertIncludes(optimizeSource, "`节电率 ${benefitRateMagnitudeSummary}", "optimize result saving rate wording", errors);
  assertIncludes(optimizeSource, "`增耗率 ${benefitRateSummary}", "optimize result increase rate wording", errors);
  assertIncludes(optimizeSource, 'emphasis: "primary" as const', "optimize result primary card flag", errors);
  assertIncludes(optimizeSource, 'emphasis: "benefit" as const', "optimize result benefit card flag", errors);
  assertIncludes(
    optimizeSource,
    'const chillerTargetResultSummary = responseReady ? chillerTargetSummary.replace(/\\s*\\+\\s*/g, "+")',
    "optimize result compact chiller combination",
    errors
  );
  assertIncludes(
    optimizeSource,
    '? `${formatTrimHzCompactValue(pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz)}/${formatTrimHzCompactValue(',
    "optimize result compact pump trim value",
    errors
  );
  assertIncludes(
    optimizeSource,
    'typeof benefitEstimate?.expectedPowerDeltaKw === "number"',
    "optimize result benefit unit only with numeric value",
    errors
  );
  assertIncludes(
    optimizeSource,
    'const benefitResultConfidenceLabel = benefitEstimateConfidenceLabel.replace(/[：:].*$/, "")',
    "optimize result compact benefit confidence label",
    errors
  );
  assertIncludes(
    optimizeSource,
    "note: benefitResultNote",
    "optimize result compact benefit note",
    errors
  );
  assertIncludes(
    bffClientSource,
    '.replace(/[^\\x20-\\x7E]+/g, "")',
    "bff headers strip non-ASCII project labels",
    errors
  );

  const optimizeResultCardGridBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_CARD_GRID_SELECTOR,
    optimizeResultSpotlightStart
  );
  if (!optimizeResultCardGridBlock) {
    errors.push("optimize result spotlight final guard: result card grid selector block missing");
  } else {
    assertIncludes(
      optimizeResultCardGridBlock.text,
      "grid-template-columns: minmax(242px, 1.36fr) minmax(172px, 1fr) repeat(3, minmax(0, 0.76fr)) !important;",
      "optimize result primary-plus-four grid",
      errors
    );
  }

  const optimizeResultCardStrongBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_CARD_STRONG_SELECTOR,
    optimizeResultSpotlightStart
  );
  if (!optimizeResultCardStrongBlock) {
    errors.push("optimize result spotlight final guard: result card strong selector block missing");
  } else {
    assertIncludes(optimizeResultCardStrongBlock.text, "font-size: 18px !important;", "optimize result value readable font", errors);
    assertIncludes(optimizeResultCardStrongBlock.text, "line-height: 34px !important;", "optimize result value no-cut line-height", errors);
  }

  const optimizeResultPrimaryCardBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_PRIMARY_CARD_SELECTOR,
    optimizeResultSpotlightStart
  );
  if (!optimizeResultPrimaryCardBlock) {
    errors.push("optimize result spotlight final guard: primary result card selector block missing");
  } else {
    assertIncludes(optimizeResultPrimaryCardBlock.text, "grid-template-rows: 17px 43px 21px !important;", "optimize result primary card rows", errors);
    assertIncludes(optimizeResultPrimaryCardBlock.text, "border-width: 2px !important;", "optimize result primary card emphasis", errors);
  }

  const optimizeResultPrimaryStrongBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_PRIMARY_STRONG_SELECTOR,
    optimizeResultSpotlightStart
  );
  if (!optimizeResultPrimaryStrongBlock) {
    errors.push("optimize result spotlight final guard: primary result value selector block missing");
  } else {
    assertIncludes(optimizeResultPrimaryStrongBlock.text, "font-size: 28px !important;", "optimize result primary value font", errors);
    assertIncludes(optimizeResultPrimaryStrongBlock.text, "line-height: 43px !important;", "optimize result primary value no-cut line-height", errors);
  }

  assertIncludes(styleSource, OPTIMIZE_RESULT_OVERLAP_MARKER, "optimize generated-result overlap guard", errors);
  const optimizeResultOverlapStart = styleSource.indexOf(OPTIMIZE_RESULT_OVERLAP_MARKER);
  const optimizePageGridBlock = findRuleBlock(styleSource, OPTIMIZE_PAGE_GRID_SELECTOR, optimizeResultOverlapStart);
  if (!optimizePageGridBlock) {
    errors.push("optimize generated-result overlap guard: page grid selector block missing");
  } else {
    assertIncludes(
      optimizePageGridBlock.text,
      "grid-template-rows: 66px 124px 164px auto auto !important;",
      "optimize input row keeps real height after generated result",
      errors
    );
  }

  const optimizeInputStatusGridBlock = findRuleBlock(styleSource, OPTIMIZE_INPUT_STATUS_GRID_SELECTOR, optimizeResultOverlapStart);
  if (!optimizeInputStatusGridBlock) {
    errors.push("optimize generated-result overlap guard: input status grid selector block missing");
  } else {
    assertIncludes(optimizeInputStatusGridBlock.text, "height: 164px !important;", "optimize input grid reserved height", errors);
    assertIncludes(optimizeInputStatusGridBlock.text, "grid-template-rows: minmax(0, 1fr) !important;", "optimize input grid no zero row", errors);
  }

  const optimizeInputFormBlock = findRuleBlock(styleSource, OPTIMIZE_INPUT_FORM_SELECTOR, optimizeResultOverlapStart);
  if (!optimizeInputFormBlock) {
    errors.push("optimize generated-result overlap guard: input form selector block missing");
  } else {
    assertIncludes(optimizeInputFormBlock.text, "grid-template-rows: 78px 34px !important;", "optimize input form keeps fields separate from prefill", errors);
  }

  const optimizeInputFormMainBlock = findRuleBlock(styleSource, OPTIMIZE_INPUT_FORM_MAIN_SELECTOR, optimizeResultOverlapStart);
  if (!optimizeInputFormMainBlock) {
    errors.push("optimize generated-result overlap guard: input form main selector block missing");
  } else {
    assertIncludes(optimizeInputFormMainBlock.text, "grid-template-rows: 44px 28px !important;", "optimize input form button stays below fields", errors);
  }

  const optimizeInputPrefillMetaBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_INPUT_PREFILL_META_SELECTOR,
    optimizeResultOverlapStart
  );
  if (!optimizeInputPrefillMetaBlock) {
    errors.push("optimize generated-result overlap guard: input prefill meta selector block missing");
  } else {
    assertIncludes(optimizeInputPrefillMetaBlock.text, "height: 10px !important;", "optimize input prefill source row stays visible", errors);
    assertIncludes(optimizeInputPrefillMetaBlock.text, "grid-template-columns: minmax(0, 1fr) auto !important;", "optimize input prefill source and time share one compact row", errors);
  }

  const optimizeInputPrefillMetaLastBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_INPUT_PREFILL_META_LAST_SELECTOR,
    optimizeResultOverlapStart
  );
  if (!optimizeInputPrefillMetaLastBlock) {
    errors.push("optimize generated-result overlap guard: input prefill meta last-child selector block missing");
  } else {
    assertIncludes(optimizeInputPrefillMetaLastBlock.text, "grid-column: auto !important;", "optimize input updated time must not wrap to a hidden second row", errors);
  }

  assertIncludes(optimizeSource, 'prefillReady: "已带入当前冷量与湿球"', "optimize input prefill compact ready copy", errors);
  assertIncludes(optimizeSource, "prefillSourceCompactText", "optimize input prefill source uses compact visible copy", errors);
  assertIncludes(optimizeSource, "prefillUpdatedCompactText", "optimize input prefill timestamp uses compact visible copy", errors);
  assertIncludes(
    optimizeSource,
    "function formatPumpRollbackLockout",
    "optimize pump approval lockout detail helper",
    errors
  );
  assertIncludes(
    optimizeSource,
    "闭锁{formatPumpRollbackLockout(pumpDeltaTAdvisor)} · 周期5min · 单步1Hz",
    "optimize pump approval safety detail stays readable",
    errors
  );
  assertIncludes(
    optimizeSource,
    'const OPTIMIZE_COMPACT_PENDING_VALUE = "待补值";',
    "optimize compact missing-value copy is short enough for 720p",
    errors
  );
  assertIncludes(
    optimizeSource,
    "formatCompactPowerKw(baseline.totalPowerKw, 0)",
    "optimize compact total power missing value avoids clipping",
    errors
  );
  assertIncludes(
    optimizeSource,
    "benefitPowerDeltaCompactSummary",
    "optimize compact benefit missing value avoids clipping",
    errors
  );

  assertIncludes(styleSource, OPTIMIZE_RESULT_CARD_NO_CLIP_MARKER, "optimize result card no-clip guard", errors);
  const optimizeResultCardNoClipStart = styleSource.indexOf(OPTIMIZE_RESULT_CARD_NO_CLIP_MARKER);
  const optimizeResultCardNoClipStageBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_STAGE_SELECTOR,
    optimizeResultCardNoClipStart
  );
  if (!optimizeResultCardNoClipStageBlock) {
    errors.push("optimize result card no-clip guard: result stage selector block missing");
  } else {
    assertIncludes(
      optimizeResultCardNoClipStageBlock.text,
      "grid-template-columns: 138px minmax(0, 1fr) !important;",
      "optimize result stage gives enough width to result cards",
      errors
    );
  }

  const optimizeResultStageCopyBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_STAGE_COPY_SELECTOR,
    optimizeResultCardNoClipStart
  );
  if (!optimizeResultStageCopyBlock) {
    errors.push("optimize result card no-clip guard: stage copy selector block missing");
  } else {
    assertIncludes(
      optimizeResultStageCopyBlock.text,
      "grid-template-rows: 18px 44px !important;",
      "optimize result stage copy keeps only label and verdict",
      errors
    );
  }

  const optimizeResultStageCopyBodyBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_STAGE_COPY_BODY_SELECTOR,
    optimizeResultCardNoClipStart
  );
  if (!optimizeResultStageCopyBodyBlock) {
    errors.push("optimize result card no-clip guard: stage copy body selector block missing");
  } else {
    assertIncludes(optimizeResultStageCopyBodyBlock.text, "display: none !important;", "optimize result stage copy removes clipped explanation", errors);
  }

  const optimizeResultCardNoClipGridBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_RESULT_CARD_GRID_SELECTOR,
    optimizeResultCardNoClipStart
  );
  if (!optimizeResultCardNoClipGridBlock) {
    errors.push("optimize result card no-clip guard: result card grid selector block missing");
  } else {
    assertIncludes(
      optimizeResultCardNoClipGridBlock.text,
      "grid-template-rows: minmax(0, 1fr) !important;",
      "optimize result cards stay in one row",
      errors
    );
    assertIncludes(
      optimizeResultCardNoClipGridBlock.text,
      "minmax(204px, 1.15fr)",
      "optimize result primary card keeps readable width",
      errors
    );
    assertIncludes(
      optimizeResultCardNoClipGridBlock.text,
      "minmax(150px, 0.86fr)",
      "optimize result chiller combination keeps readable width",
      errors
    );
    assertIncludes(
      optimizeResultCardNoClipGridBlock.text,
      "minmax(150px, 0.86fr)",
      "optimize result benefit note keeps readable width",
      errors
    );
  }

  assertIncludes(styleSource, OPTIMIZE_COMPACT_METRIC_NO_CLIP_MARKER, "optimize compact metric no-clip guard", errors);
  const optimizeCompactMetricNoClipStart = styleSource.indexOf(OPTIMIZE_COMPACT_METRIC_NO_CLIP_MARKER);
  const optimizeCompactMetricCurrentBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_COMPACT_METRIC_CURRENT_GRID_SELECTOR,
    optimizeCompactMetricNoClipStart
  );
  if (!optimizeCompactMetricCurrentBlock) {
    errors.push("optimize compact metric no-clip guard: current metric grid selector block missing");
  } else {
    assertIncludes(
      optimizeCompactMetricCurrentBlock.text,
      "grid-template-columns: minmax(54px, 0.72fr) minmax(88px, 1.18fr)",
      "optimize current total power gets wider metric column",
      errors
    );
  }

  const optimizeCompactMetricBenefitBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_COMPACT_METRIC_BENEFIT_GRID_SELECTOR,
    optimizeCompactMetricNoClipStart
  );
  if (!optimizeCompactMetricBenefitBlock) {
    errors.push("optimize compact metric no-clip guard: benefit metric grid selector block missing");
  } else {
    assertIncludes(
      optimizeCompactMetricBenefitBlock.text,
      "grid-template-columns: minmax(92px, 1.34fr) minmax(68px, 0.98fr)",
      "optimize benefit power delta gets wider metric column",
      errors
    );
  }

  const optimizeCompactMetricStrongBlock = findRuleBlock(
    styleSource,
    OPTIMIZE_COMPACT_METRIC_CARD_STRONG_SELECTOR,
    optimizeCompactMetricNoClipStart
  );
  if (!optimizeCompactMetricStrongBlock) {
    errors.push("optimize compact metric no-clip guard: metric value selector block missing");
  } else {
    assertIncludes(optimizeCompactMetricStrongBlock.text, "white-space: nowrap !important;", "optimize metric values stay on one line", errors);
    assertIncludes(optimizeCompactMetricStrongBlock.text, "font-size: 13.5px !important;", "optimize metric values keep readable compact size", errors);
  }

  assertIncludes(styleSource, ENERGY_CALENDAR_VALUE_FINAL_MARKER, "energy calendar value final guard", errors);
  const energyCalendarValueFinalStart = styleSource.indexOf(ENERGY_CALENDAR_VALUE_FINAL_MARKER);
  const energyCalendarValueDivBlock = findRuleBlock(
    styleSource,
    ENERGY_CALENDAR_VALUE_DIV_SELECTOR,
    energyCalendarValueFinalStart
  );
  if (!energyCalendarValueDivBlock) {
    errors.push("energy calendar value final guard: metrics row selector block missing");
  } else {
    assertIncludes(
      energyCalendarValueDivBlock.text,
      "grid-template-columns: 20px minmax(0, 1fr) !important;",
      "energy calendar value column width",
      errors
    );
    assertIncludes(energyCalendarValueDivBlock.text, "height: 12px !important;", "energy calendar value row height", errors);
  }

  const energyCalendarValueStrongBlock = findRuleBlock(
    styleSource,
    ENERGY_CALENDAR_VALUE_STRONG_SELECTOR,
    energyCalendarValueFinalStart
  );
  if (!energyCalendarValueStrongBlock) {
    errors.push("energy calendar value final guard: numeric value selector block missing");
  } else {
    assertIncludes(energyCalendarValueStrongBlock.text, "font-size: 10px !important;", "energy calendar numeric value readable font", errors);
    assertIncludes(energyCalendarValueStrongBlock.text, "font-variant-numeric: tabular-nums !important;", "energy calendar numeric alignment", errors);
    assertIncludes(energyCalendarValueStrongBlock.text, "text-align: right !important;", "energy calendar numeric right align", errors);
  }

  assertIncludes(styleSource, BOTTOM_SAFE_AREA_MARKER, "720p bottom safe-area guard", errors);
  const bottomSafeAreaStart = styleSource.indexOf(BOTTOM_SAFE_AREA_MARKER);
  const bottomSafeAreaAlarmBlock = findRuleBlock(styleSource, BOTTOM_SAFE_AREA_ALARM_SELECTOR, bottomSafeAreaStart);
  if (!bottomSafeAreaAlarmBlock) {
    errors.push("720p bottom safe-area guard: footer selector block missing");
  } else {
    assertIncludes(bottomSafeAreaAlarmBlock.text, "transform: translateY(-5px) !important;", "bottom safe-area footer lift", errors);
  }

  const bottomSafeAreaSceneButtonBlock = findRuleBlock(styleSource, BOTTOM_SAFE_AREA_SCENE_BUTTON_SELECTOR, bottomSafeAreaStart);
  if (!bottomSafeAreaSceneButtonBlock) {
    errors.push("720p bottom safe-area guard: scene button selector block missing");
  } else {
    assertIncludes(bottomSafeAreaSceneButtonBlock.text, "height: 32px !important;", "bottom safe-area scene button height", errors);
  }

  const operationArticleHeightStart = styleSource.indexOf(
    `${BOTTOM_SAFE_AREA_OPERATION_ARTICLE_SELECTOR} {\n  height: 40px !important;`,
    bottomSafeAreaStart
  );
  const bottomSafeAreaOperationArticleBlock =
    operationArticleHeightStart >= 0 ? findRuleBlock(styleSource, BOTTOM_SAFE_AREA_OPERATION_ARTICLE_SELECTOR, operationArticleHeightStart) : null;
  if (!bottomSafeAreaOperationArticleBlock) {
    errors.push("720p bottom safe-area guard: operation boundary article selector block missing");
  } else {
    assertIncludes(bottomSafeAreaOperationArticleBlock.text, "height: 40px !important;", "bottom safe-area operation article height", errors);
  }

  const bottomSafeAreaReportButtonBlock = findRuleBlock(styleSource, BOTTOM_SAFE_AREA_REPORT_BUTTON_SELECTOR, bottomSafeAreaStart);
  if (!bottomSafeAreaReportButtonBlock) {
    errors.push("720p bottom safe-area guard: report pagination button selector block missing");
  } else {
    assertIncludes(bottomSafeAreaReportButtonBlock.text, "height: 18px !important;", "bottom safe-area report button height", errors);
  }

  const bottomSafeAreaSceneStatusBlock = findRuleBlock(styleSource, BOTTOM_SAFE_AREA_SCENE_STATUS_SELECTOR, bottomSafeAreaStart);
  if (!bottomSafeAreaSceneStatusBlock) {
    errors.push("720p bottom safe-area guard: scene status selector block missing");
  } else {
    assertIncludes(bottomSafeAreaSceneStatusBlock.text, "transform: translateY(-6px) !important;", "bottom safe-area scene status lift", errors);
  }

  const bottomSafeAreaSceneEmbedStatusBlock = findRuleBlock(
    styleSource,
    BOTTOM_SAFE_AREA_SCENE_EMBED_STATUS_SELECTOR,
    bottomSafeAreaStart
  );
  if (!bottomSafeAreaSceneEmbedStatusBlock) {
    errors.push("720p bottom safe-area guard: scene embed status selector block missing");
  } else {
    assertIncludes(bottomSafeAreaSceneEmbedStatusBlock.text, "transform: translateY(-8px) !important;", "bottom safe-area scene embed status lift", errors);
  }

  assertIncludes(styleSource, FINAL_FOOTER_CLEARANCE_MARKER, "rendered 720p final footer clearance guard", errors);
  const finalFooterClearanceStart = styleSource.indexOf(FINAL_FOOTER_CLEARANCE_MARKER);
  const finalFooterEnergyAnalysisPageBlock = findRuleBlock(
    styleSource,
    FINAL_FOOTER_ENERGY_ANALYSIS_PAGE_SELECTOR,
    finalFooterClearanceStart
  );
  if (!finalFooterEnergyAnalysisPageBlock) {
    errors.push("rendered 720p final footer clearance guard: energy-analysis page selector block missing");
  } else {
    assertIncludes(
      finalFooterEnergyAnalysisPageBlock.text,
      "height: calc(100% - 12px) !important;",
      "energy-analysis final page bottom clearance",
      errors
    );
    assertIncludes(
      finalFooterEnergyAnalysisPageBlock.text,
      "grid-template-rows: 82px 58px minmax(0, 1fr) 68px 28px !important;",
      "energy-analysis final compact rows",
      errors
    );
  }

  const finalFooterEnergyAnalysisBoundaryBlock = findRuleBlock(
    styleSource,
    FINAL_FOOTER_ENERGY_ANALYSIS_BOUNDARY_SELECTOR,
    finalFooterClearanceStart
  );
  if (!finalFooterEnergyAnalysisBoundaryBlock) {
    errors.push("rendered 720p final footer clearance guard: energy-analysis boundary selector block missing");
  } else {
    assertIncludes(finalFooterEnergyAnalysisBoundaryBlock.text, "height: 28px !important;", "energy-analysis boundary compact height", errors);
    assertIncludes(finalFooterEnergyAnalysisBoundaryBlock.text, "transform: translateY(-6px) !important;", "energy-analysis boundary lift", errors);
  }

  const finalFooterEnergyParameterPageBlock = findRuleBlock(
    styleSource,
    FINAL_FOOTER_ENERGY_PARAMETER_PAGE_SELECTOR,
    finalFooterClearanceStart
  );
  if (!finalFooterEnergyParameterPageBlock) {
    errors.push("rendered 720p final footer clearance guard: energy-parameter page selector block missing");
  } else {
    assertIncludes(
      finalFooterEnergyParameterPageBlock.text,
      "height: calc(100% - 12px) !important;",
      "energy-parameter final page bottom clearance",
      errors
    );
    assertIncludes(
      finalFooterEnergyParameterPageBlock.text,
      "grid-template-rows: 66px 66px minmax(0, 1fr) 30px !important;",
      "energy-parameter final compact rows",
      errors
    );
  }

  const finalFooterEnergyParameterBoundaryBlock = findRuleBlock(
    styleSource,
    FINAL_FOOTER_ENERGY_PARAMETER_BOUNDARY_SELECTOR,
    finalFooterClearanceStart
  );
  if (!finalFooterEnergyParameterBoundaryBlock) {
    errors.push("rendered 720p final footer clearance guard: energy-parameter boundary selector block missing");
  } else {
    assertIncludes(finalFooterEnergyParameterBoundaryBlock.text, "height: 30px !important;", "energy-parameter boundary compact height", errors);
    assertIncludes(finalFooterEnergyParameterBoundaryBlock.text, "transform: translateY(-8px) !important;", "energy-parameter boundary lift", errors);
  }

  const finalFooterScenePageBlock = findRuleBlock(styleSource, FINAL_FOOTER_SCENE_PAGE_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterScenePageBlock) {
    errors.push("rendered 720p final footer clearance guard: scene page selector block missing");
  } else {
    assertIncludes(finalFooterScenePageBlock.text, "height: calc(100% - 16px) !important;", "scene page final bottom clearance", errors);
  }

  const finalFooterSceneSwitchbarBlock = findRuleBlock(styleSource, FINAL_FOOTER_SCENE_SWITCHBAR_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterSceneSwitchbarBlock) {
    errors.push("rendered 720p final footer clearance guard: scene switchbar selector block missing");
  } else {
    assertIncludes(finalFooterSceneSwitchbarBlock.text, "height: 46px !important;", "scene switchbar compact height", errors);
    assertIncludes(finalFooterSceneSwitchbarBlock.text, "transform: translateY(-12px) !important;", "scene switchbar lift", errors);
  }

  const finalFooterSceneCurrentStrongBlock = findRuleBlock(
    styleSource,
    FINAL_FOOTER_SCENE_CURRENT_STRONG_SELECTOR,
    finalFooterClearanceStart
  );
  if (!finalFooterSceneCurrentStrongBlock) {
    errors.push("rendered 720p final footer clearance guard: scene current strong selector block missing");
  } else {
    assertIncludes(finalFooterSceneCurrentStrongBlock.text, "line-height: 16px !important;", "scene current title readable line-height", errors);
  }

  const finalFooterMeterPageBlock = findRuleBlock(styleSource, FINAL_FOOTER_METER_PAGE_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterMeterPageBlock) {
    errors.push("rendered 720p final footer clearance guard: meter-reading page selector block missing");
  } else {
    assertIncludes(
      finalFooterMeterPageBlock.text,
      "grid-template-rows: 74px 56px minmax(0, 1fr) 30px !important;",
      "meter-reading final compact rows",
      errors
    );
  }

  const finalFooterMeterBoundaryBlock = findRuleBlock(styleSource, FINAL_FOOTER_METER_BOUNDARY_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterMeterBoundaryBlock) {
    errors.push("rendered 720p final footer clearance guard: meter-reading boundary selector block missing");
  } else {
    assertIncludes(finalFooterMeterBoundaryBlock.text, "height: 30px !important;", "meter-reading boundary compact height", errors);
    assertIncludes(finalFooterMeterBoundaryBlock.text, "transform: translateY(-8px) !important;", "meter-reading boundary lift", errors);
  }

  const finalFooterAlarmFooterBlock = findRuleBlock(styleSource, FINAL_FOOTER_ALARM_FOOTER_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterAlarmFooterBlock) {
    errors.push("rendered 720p final footer clearance guard: alarm footer selector block missing");
  } else {
    assertIncludes(finalFooterAlarmFooterBlock.text, "transform: translateY(-12px) !important;", "alarm footer final lift", errors);
  }

  const finalFooterReportFooterBlock = findRuleBlock(styleSource, FINAL_FOOTER_REPORT_FOOTER_SELECTOR, finalFooterClearanceStart);
  if (!finalFooterReportFooterBlock) {
    errors.push("rendered 720p final footer clearance guard: report footer selector block missing");
  } else {
    assertIncludes(finalFooterReportFooterBlock.text, "transform: translateY(-12px) !important;", "report footer final lift", errors);
  }

  if (errors.length > 0) {
    console.error("Visual readability contract check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Visual readability contract check passed.");
  console.log("- checked trend active-state contrast guard");
  console.log("- checked energy-efficiency threshold label size guard");
  console.log("- checked alarm queue row readability guard");
  console.log("- checked system overview verdict badge readability guard");
  console.log("- checked system overview load node compact fallback copy");
  console.log("- checked project queue rank badge readability guard");
  console.log("- checked dense page no-clip guards for project, performance, work-order, and energy-analysis pages");
  console.log("- checked source/status chip contrast guard");
  console.log("- checked rendered 720p no-clip pass for energy-parameter, meter-reading, performance, scene controls, and key action buttons");
  console.log("- checked dashboard cockpit status line no-cut guard");
  console.log("- checked performance report summary two-row guard");
  console.log("- checked work-order header no-overlap guard");
  console.log("- checked trend series stats no-clip guard");
  console.log("- checked optimize result spotlight guard");
  console.log("- checked energy efficiency calendar value width guard");
  console.log("- checked 720p bottom safe-area guard");
  console.log("- checked rendered 720p final footer clearance guard");
  console.log("- checked temporary QA seed is absent");
}

main();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function rejectText(source, rejected, message) {
  if (source.includes(rejected)) {
    throw new Error(message);
  }
}

const dashboard = read("src/pages/DashboardPage.tsx");
const dashboardStyles = read("src/pages/DashboardExtracted.css");
const dashboardMobileStyles = read("src/pages/DashboardMobile.css");
const localeCopy = read("src/i18n/zhCN.ts");
const dataScopeContract = read("../chiller-bff/src/lib/runtime-data-scope.js");
const bffRoutes = read("../chiller-bff/src/routes/v1.js");
const openApi = read("../chiller-bff/openapi/bff-v1.yaml");
const specification = read("../../docs/ui/MULTI_ENERGY_STATION_NAVIGATION.md");

for (const subsystemType of [
  "chilled_plant",
  "compressed_air",
  "boiler_room",
  "power_monitoring",
  "hvac_terminal"
]) {
  requireText(dashboard, `subsystemType: "${subsystemType}"`, `dashboard matrix is missing ${subsystemType}`);
}

requireText(dashboard, "dashboard-energy-object-matrix", "dashboard energy-object matrix is missing");
rejectText(dashboard, 'buildSiteScopedRoute("/energy-config")', "dashboard retains the removed energy-config route");
requireText(dashboard, "dashboard-physical-station-matrix", "dashboard physical-station registry matrix is missing");
requireText(dashboard, "data-physical-station-empty-action", "dashboard empty station registry has no action hook");
requireText(dashboard, 'buildSiteScopedRoute("/config-center")', "dashboard empty station registry must enter project configuration");
requireText(dashboard, "查看站房登记", "dashboard empty station-registry action copy is missing");
requireText(dashboard, "data-physical-station-id", "dashboard physical-station identity hook is missing");
requireText(dashboard, "data-physical-station-type", "dashboard physical-station parent-type hook is missing");
requireText(dashboard, "data-physical-station-binding", "dashboard station binding-state hook is missing");
requireText(dashboard, "data-physical-station-binding-version", "dashboard station binding-version hook is missing");
requireText(dashboard, "data-physical-station-attention-priority", "dashboard station issue-priority hook is missing");
requireText(dashboard, 'data-physical-station-runtime-evidence="page_required"', "dashboard must defer station runtime evidence to the station page");
requireText(dashboard, "运行证据需进入站房页验证", "dashboard binding/runtime evidence boundary is missing");
requireText(dashboard, "publishedPhysicalStationInstances", "dashboard physical-station matrix source is missing");
requireText(dashboard, "instance.published !== false && isPhysicalStationParentType", "dashboard must list every published physical identity, including inactive stations");
requireText(dashboard, "left.attentionPriority - right.attentionPriority", "dashboard must sort station binding blockers before healthy registrations");
requireText(dashboard, "physicalStationBindingSummary", "dashboard physical-station status summary is missing");
requireText(dashboard, '"查看绑定阻断"', "dashboard pending station action copy is missing");
requireText(dashboard, '"查看停用范围"', "dashboard disabled station action copy is missing");
requireText(dashboard, '"进入站房验运行"', "dashboard bound station action copy is missing");
requireText(dashboard, "data-energy-object-status", "dashboard object truth-state hook is missing");
requireText(dashboard, "data-energy-object-code", "dashboard technical evidence-code hook is missing");
requireText(dashboard, "data-energy-object-kpi", "dashboard KPI participation hook is missing");
requireText(dashboard, "data-energy-object-station-count", "dashboard physical-station count hook is missing");
requireText(dashboard, "data-energy-object-evidence-conflict", "dashboard config/runtime evidence drift is not disclosed");
requireText(dashboard, "配置 / 运行证据冲突", "dashboard cold-plant evidence conflict copy is missing");
requireText(dashboard, 'data-dashboard-overview-scope="project"', "dashboard project scope is not explicit");
requireText(dashboard, "data-dashboard-lifecycle-mode", "dashboard lifecycle-mode hook is missing");
requireText(dashboard, "data-dashboard-view-mode", "dashboard audience-view hook is missing");
requireText(dashboard, 'aria-label="总览信息视角"', "dashboard management/operations view switch is missing");
requireText(dashboard, "管理摘要", "dashboard management summary label is missing");
requireText(dashboard, "运行明细", "dashboard operations detail label is missing");
requireText(dashboard, "DASHBOARD_AUDIENCE_VIEW_STORAGE_KEY", "dashboard view preference is not persisted");
requireText(dashboard, 'data-dashboard-audience-detail="true"', "dashboard engineering-detail disclosure hook is missing");
requireText(dashboard, "data-dashboard-capability-state", "dashboard capability-request state is not exposed");
requireText(dashboard, 'key: "supply_station"', "dashboard supply-station semantic group is missing");
requireText(dashboard, 'label: "供能站房"', "dashboard supply-station group label is missing");
requireText(dashboard, 'key: "distribution_consumption"', "dashboard distribution/consumption group is missing");
requireText(dashboard, 'label: "配用能"', "dashboard distribution/consumption group label is missing");
requireText(dashboard, "data-energy-object-group", "dashboard semantic-group DOM hook is missing");
requireText(dashboard, "appendEnergyStationContextToPath", "dashboard object drilldown does not preserve station context");
requireText(dashboard, "normalizeRouteSiteId(activeSiteId) || activeSiteId", "dashboard object drilldown must normalize configuration aliases to the route-facing project site id");
requireText(dashboard, "resolveUniqueStationInstanceId(matchingStationInstances)", "dashboard unique physical-station drilldown is missing");
requireText(dashboard, '"project_onboarding"', "dashboard onboarding mode is missing");
requireText(dashboard, '"commissioning"', "dashboard commissioning mode is missing");
requireText(dashboard, '"operation"', "dashboard operation mode is missing");
requireText(dashboard, "项目接入总览", "dashboard onboarding conclusion is missing");
requireText(dashboard, "项目联调总览", "dashboard commissioning conclusion is missing");
requireText(dashboard, "综合运行总览", "dashboard operation conclusion is missing");
requireText(dashboard, "const DASHBOARD_CAPABILITY_TIMEOUT_MS = 8_000", "dashboard capability request has no bounded wait");
requireText(dashboard, "Promise.race", "dashboard capability timeout race is missing");
requireText(dashboard, "已停止等待", "dashboard capability timeout is not disclosed to operators");
requireText(dashboard, "项目状态待确认", "dashboard capability failure must fail closed");
requireText(dashboard, 'const registeredStationDisplay = capabilityEvidenceReady', "station total does not fail closed while evidence is unavailable");
requireText(dashboard, 'const configuredEnergyObjectDisplay = capabilityEvidenceReady', "published-object total does not fail closed while evidence is unavailable");
requireText(dashboard, "subsystemCapabilityByType.has(definition.subsystemType)", "published-object total must count registered capability objects independently from runtime status");
requireText(dashboard, 'const unverifiedSubsystemCount = energyObjectItems.filter((item) => item.kind === "unknown").length', "dashboard must separate unverified objects from true anomalies");
requireText(dashboard, '` · 待核 ${unverifiedSubsystemCount}`', "dashboard unverified-object summary copy is missing");
requireText(localeCopy, 'navOperationDashboard: "项目总览"', "shell dashboard label must remain lifecycle-neutral");
requireText(dashboard, "物理站房待登记", "dashboard physical-station boundary is not disclosed");
requireText(dashboard, "演示、快照和未绑定站房数据不参与运行KPI", "dashboard onboarding KPI boundary is missing");
requireText(dashboard, "calculateLoadFluctuationPct", "dashboard load fluctuation is not fail-closed");
requireText(dashboard, "样本不可比，暂不判定", "dashboard invalid trend verdict copy is missing");
requireText(dashboard, "coldOperationalEvidenceReady", "dashboard cold KPI evidence gate is missing");
requireText(dashboard, "dashboard-focus-station", "dashboard compact focus-station card is missing");
requireText(dashboard, 'const focusStationName = "冷冻站"', "dashboard focus card must remain a cold-station type label");
requireText(dashboard, 'const focusStationScopeLabel = "冷站类型级"', "dashboard focus card must disclose its type-level scope");
rejectText(dashboard, 'const focusStationScopeLabel = hasRegisteredStations ? "物理站房"', "dashboard must not relabel type-level data as a physical station");
requireText(dashboard, "进入冷冻站工作台", "dashboard focus-station drilldown is missing");
requireText(dashboard, "告警与诊断分开统计", "dashboard alarm and diagnostic semantics are not separated");
requireText(dashboard, "severityRank: severityRank(item.severityRaw)", "dashboard diagnostic queue must preserve normalized severity evidence");
requireText(dashboard, "const highestDiagnosticSeverityRank = anomalyQueue.reduce", "dashboard project risk must inspect diagnostic severity");
requireText(dashboard, "criticalCount > 0 || highestDiagnosticSeverityRank <= 1", "dashboard project risk must not under-report high diagnostics");
requireText(dashboard, "data-project-highest-risk={riskHighestLevelLabel}", "dashboard aggregate risk evidence hook is missing");
requireText(
  dashboard,
  "fieldScopes",
  "dashboard cold metrics do not consume field-level BFF scope evidence"
);
requireText(dashboard, "chilledPlantMetricsFieldScope?.dataScope", "dashboard cold metric scope key is missing");
requireText(dashboard, 'effectiveSubsystemType === "chilled_plant"', "dashboard cold scope proof is incomplete");
requireText(dashboard, 'applied === true', "dashboard must require an applied BFF scope");
requireText(dashboard, 'filterMode === "fixed_subsystem"', "dashboard fixed-scope mode proof is missing");
requireText(dashboard, 'siteId === activeSiteId', "dashboard scope site proof is missing");
requireText(dashboard, "chilledPlantMetricCoverageVerified", "dashboard KPI field-coverage proof is missing");
requireText(dashboard, "const chilledPlantTrendDataScope = trends?.dataScope", "dashboard trend scope proof is missing");
requireText(dashboard, "冷站指标", "dashboard cold KPI scope copy is missing");
requireText(dashboard, "当前项目 · 告警 / 事件", "project-level alarm scope copy is missing");
requireText(dashboard, 'data-scope="client_device_type"', "device-chain client scope is not disclosed");
requireText(dashboard, "后端接口尚未返回物理站实例过滤证据", "physical-station boundary copy is missing");
requireText(dashboardStyles, "dashboard-ai-observation-badge", "1280px truth-header compaction guard is missing");
requireText(dashboardStyles, "dashboard-view-switch", "dashboard audience-view switch styling is missing");
requireText(dashboardStyles, '[data-dashboard-view-mode="management"]', "dashboard management-density layout is missing");
requireText(dashboardMobileStyles, ".dashboard-view-switch button", "mobile dashboard view switch touch-target guard is missing");
requireText(dashboardStyles, 'data-energy-object-evidence-conflict="true"', "energy-object evidence conflict style is missing");
requireText(dashboardStyles, "dashboard-subsystem-technical-code", "dashboard technical evidence code is not visually secondary");
requireText(dashboardStyles, "dashboard-energy-object-groups", "dashboard semantic-group layout is missing");
requireText(dashboardStyles, "Dashboard physical-station registry terminal guard", "dashboard physical-station registry terminal guard is missing");
requireText(dashboardStyles, "dashboard-physical-station-list", "dashboard physical-station list layout is missing");
requireText(dashboardStyles, "dashboard-physical-station-empty-action", "dashboard station-registry action styling is missing");
requireText(dashboardStyles, "grid-template-columns: repeat(3, minmax(0, 1fr))", "desktop physical-station cards must form a compact matrix");
requireText(dashboardStyles, "issue-first row", "commissioning station issue-first layout guard is missing");
requireText(dashboardStyles, "grid-template-columns: repeat(6, minmax(0, 1fr))", "wide commissioning screens must keep one readable station row");
requireText(dashboardStyles, "min-height: 212px !important", "commissioning energy and station matrices must not be compressed into one row");
requireText(dashboardStyles, "dashboard-energy-object-group-head", "dashboard group header rail is missing");
requireText(dashboardStyles, 'data-energy-object-group="supply_station"', "dashboard supply-station group layout is missing");
requireText(dashboardStyles, 'data-energy-object-group="distribution_consumption"', "dashboard distribution/consumption group layout is missing");
requireText(dashboardStyles, "dashboard-subsystem-scope", "dashboard object station-scope styling is missing");
requireText(dashboardMobileStyles, 'data-energy-object-group="supply_station"', "mobile supply-station group override is missing");
requireText(dashboardMobileStyles, 'data-energy-object-group="distribution_consumption"', "mobile distribution/consumption group override is missing");
requireText(dashboardMobileStyles, "Mobile physical-station registry", "mobile physical-station registry guard is missing");
requireText(dashboardMobileStyles, "@media (min-width: 721px) and (max-width: 1100px)", "tablet/notebook dashboard reflow guard is missing");
requireText(dashboardMobileStyles, ".dashboard-physical-station-list", "mobile physical-station list override is missing");
requireText(dashboardMobileStyles, ".dashboard-physical-station-empty-action", "mobile station-registry action touch-target guard is missing");
requireText(
  dashboardMobileStyles,
  ".dashboard-cockpit-v2[data-dashboard-lifecycle-mode] .dashboard-energy-object-matrix",
  "mobile energy-object matrix must outrank the lifecycle-specific desktop grid"
);
requireText(dashboardMobileStyles, "grid-template-columns: minmax(0, 1fr) !important", "mobile physical-station cards must collapse to one column");
requireText(dashboardMobileStyles, "grid-template-columns: minmax(0, 1fr) !important", "mobile energy-object cards must collapse to one column");
requireText(dashboardStyles, "dashboard-project-readiness-grid", "dashboard onboarding layout is missing");
requireText(dashboardStyles, "dashboard-focus-station-body", "dashboard focus-station layout is missing");
requireText(dashboardStyles, "@media (min-width: 1500px) and (min-height: 900px)", "tall-desktop onboarding layout breakpoint is missing");
requireText(dashboardStyles, "minmax(180px, 0.8fr)", "onboarding action area must not collapse into the operation-mode footer strip");
requireText(dashboardStyles, "grid-auto-flow: dense", "onboarding bento must not leave sparse grid cells");
requireText(dashboardStyles, "Dashboard onboarding desktop readability terminal guard", "normal-desktop onboarding readability guard is missing");
requireText(dashboardStyles, "@media (min-width: 1101px)", "normal-desktop onboarding breakpoint is missing");
requireText(dashboardStyles, "overflow-y: auto !important", "onboarding overview must scroll instead of shrinking evidence text");
requireText(dashboardStyles, "min-height: 126px !important", "onboarding energy-object cards remain too compressed");
requireText(dashboardStyles, "min-height: 116px !important", "onboarding readiness KPI cards remain too compressed");
requireText(dashboardStyles, "min-height: 380px !important", "onboarding decision workbench remains too compressed");
requireText(dashboardStyles, "Dashboard 1280px onboarding energy-matrix guard", "1280px onboarding energy matrix guard is missing");
requireText(dashboardStyles, "@media (min-width: 1101px) and (max-width: 1320px)", "1280px onboarding matrix breakpoint is missing");
requireText(dashboardStyles, "min-height: 228px !important", "1280px onboarding energy matrix remains too compressed");
requireText(dashboard, "data-queue-empty", "dashboard empty alarm queue state hook is missing");
requireText(dashboardStyles, '[data-queue-empty="true"]', "dashboard empty alarm queue must use a dedicated centered state");
requireText(dashboard, "<small title={item.text}>{item.text}</small>", "compact handover rows must disclose their full text");

requireText(dataScopeContract, "buildDashboardOverviewScopeEvidence", "dashboard mixed-scope helper is missing");
requireText(dataScopeContract, '"MIXED_SCOPE_PAYLOAD"', "overview mixed-scope reason is missing");
requireText(dataScopeContract, '"energyCards.currentCop"', "explicit cold KPI field scope is missing");
requireText(dataScopeContract, '"energyCards.outdoorWetBulbC"', "project weather-context scope is missing");
requireText(dataScopeContract, "exclusions: []", "explicit field scopes must not rely on broad exclusions");
requireText(dataScopeContract, '"deviceSummary.chillerCount"', "cold device-count scope is missing");
requireText(dataScopeContract, '"deviceSummary.totalDevices"', "project device-total scope is missing");
requireText(dataScopeContract, "buildSiteAggregateDataScope", "capability site-aggregate scope is missing");
requireText(bffRoutes, "...buildDashboardOverviewScopeEvidence(siteId)", "overview route does not attach mixed-scope evidence");
requireText(
  bffRoutes,
  'withRuntimeDataScope(data, buildFixedSubsystemDataScope(siteId, "chilled_plant"))',
  "trend route does not attach its fixed cold scope"
);
requireText(openApi, "DashboardOverviewFieldScopes", "OpenAPI lacks dashboard field-scope schema");
requireText(openApi, "MIXED_SCOPE_PAYLOAD", "OpenAPI lacks mixed-scope reason");
requireText(openApi, "/bff/v1/sites/{siteId}/capabilities:", "OpenAPI lacks the capability registry route");
requireText(openApi, "/bff/v1/sites/{siteId}/subsystems:", "OpenAPI lacks the subsystem registry route");
requireText(openApi, "RuntimeSubsystemCapabilityListResponse", "OpenAPI lacks the site-aggregate registry schema");
requireText(openApi, "totalCoolingCapacity:", "OpenAPI lacks the dashboard cooling-capacity KPI");
requireText(specification, "BFF 数据范围证据", "data-scope evidence is undocumented");
requireText(specification, "deviceSummary.totalDevices", "project device-total boundary is undocumented");
requireText(specification, "配置与运行证据", "capability/runtime evidence reconciliation is undocumented");
requireText(specification, "运行证据需进入站房页验证", "physical-station overview runtime boundary is undocumented");
requireText(specification, "不得自动创建默认站房", "empty station-registry action boundary is undocumented");
requireText(specification, "不得从 `stationInstances[]` 取第一个站名", "type-level dashboard focus boundary is undocumented");

console.log("Multi-energy dashboard contract passed.");
console.log("- checked five-object status matrix and KPI participation truth");
console.log("- checked mixed overview, cold trend and field-level BFF scope evidence");
console.log("- checked lifecycle adaptation, physical-station registry truth and type-level focus scope");
console.log("- checked persistent management-summary and operations-detail views");

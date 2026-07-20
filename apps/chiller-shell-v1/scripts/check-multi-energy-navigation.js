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

function requireExactStringSet(actualValues, expectedValues, message) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${message}: expected [${expected.join(", ")}], found [${actual.join(", ")}]`);
  }
}

function countText(source, expected) {
  return source.split(expected).length - 1;
}

function readExportedAsyncFunctionBlocks(source) {
  const functionStarts = [...source.matchAll(/^(export\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/gm)].map((match) => ({
    exported: Boolean(match[1]),
    asynchronous: Boolean(match[2]),
    name: match[3],
    index: match.index
  }));
  return functionStarts
    .map((entry, index) => ({
      ...entry,
      source: source.slice(entry.index, functionStarts[index + 1]?.index ?? source.length)
    }))
    .filter((entry) => entry.exported && entry.asynchronous);
}

function readModuleBlock(source, moduleKey) {
  const marker = `key: "${moduleKey}"`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing navigation module: ${moduleKey}`);
  }
  const next = source.indexOf('\n    {\n      key: "', start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

const stationPolicy = read("src/config/energyStationNavigation.ts");
const bffClient = read("src/services/bffClient.ts");
const navigationPolicy = read("src/config/navigationPolicy.ts");
const shell = read("src/layout/AppShell.tsx");
const stationCss = read("src/layout/AppShellStation.css");
const mobileCss = read("src/layout/AppShellMobile.css");
const copy = read("src/i18n/zhCN.ts");
const specification = read("../../docs/ui/MULTI_ENERGY_STATION_NAVIGATION.md");
const scopeMatrix = read("../../docs/ui/SYSTEM_UI_SCOPE_MATRIX.md");
const startLocalStack = read("../../scripts/start_local_stack.sh");
const stopLocalStack = read("../../scripts/stop_local_stack.sh");
const localStackRunbook = read("../../docs/local-stack-runbook.md");
const stationRuntimeScope = read("src/context/StationRuntimeScopeContext.tsx");
const configCenterEntry = read("src/pages/ConfigCenterEntryPage.tsx");
const configCenterEntryStyles = read("src/pages/ConfigCenterEntryExtracted.css");
const deviceOverviewPage = read("src/pages/DeviceOverviewPage.tsx");
const sceneControlPage = read("src/pages/SceneControlPage.tsx");
const sceneControlStyles = read("src/pages/SceneControlExtracted.css");
const aiOverviewPage = read("src/pages/AiOverviewPage.tsx");
const compressedAirPage = read("src/pages/CompressedAirMonitoringPage.tsx");
const boilerRoomPage = read("src/pages/BoilerRoomMonitoringPage.tsx");

requireText(
  shell,
  '!isProjectSelectionRoute && currentNavModule.key === module.key',
  "project selection route must not highlight a business navigation module"
);
const auth = read("src/services/auth.ts");
const projectSelectionPage = read("src/pages/ProjectSelectionPage.tsx");

requireText(
  sceneControlPage,
  '<h1 className="scene-embed-page-heading">冷冻站工艺总览</h1>',
  "cold-station process overview is missing its page-level heading"
);
requireText(
  sceneControlStyles,
  ".scene-embed-page-heading",
  "cold-station process heading must remain visually unobtrusive in the immersive scene"
);

requireText(auth, 'redirectTarget || "/dashboard"', "authenticated default entry must be the project dashboard");
rejectText(auth, 'redirectTarget || "/scene-control"', "authenticated default entry still favors the cold-station workspace");
requireText(projectSelectionPage, ': "/dashboard";', "project selection must default to the project dashboard");
requireText(shell, 'appendSiteIdToPath("/dashboard", nextProject.siteId)', "project switching from the project list must enter the project dashboard");

const configuredBffCandidateIndex = bffClient.indexOf("normalized,\n        ...localDevBaseUrls");
if (configuredBffCandidateIndex < 0) {
  throw new Error("explicit VITE_BFF_BASE_URL must remain the first local BFF candidate");
}
rejectText(
  bffClient,
  "...localDevBaseUrls,\n        normalized,",
  "local development must not override an explicit VITE_BFF_BASE_URL with port 8787"
);

for (const stationType of [
  "chilled_plant",
  "compressed_air",
  "boiler_room",
  "power_monitoring",
  "hvac_terminal"
]) {
  requireText(stationPolicy, `subsystemType: "${stationType}"`, `missing station definition: ${stationType}`);
}

for (const [stationType, semanticGroup] of [
  ["chilled_plant", "supply_station"],
  ["compressed_air", "supply_station"],
  ["boiler_room", "supply_station"],
  ["power_monitoring", "distribution_consumption"],
  ["hvac_terminal", "distribution_consumption"]
]) {
  const stationMarker = `subsystemType: "${stationType}"`;
  const stationStart = stationPolicy.indexOf(stationMarker);
  const stationEnd = stationPolicy.indexOf("\n  {\n    subsystemType:", stationStart + stationMarker.length);
  const stationBlock = stationPolicy.slice(stationStart, stationEnd < 0 ? stationPolicy.length : stationEnd);
  requireText(
    stationBlock,
    `semanticGroup: "${semanticGroup}"`,
    `${stationType} has the wrong energy-object semantic group`
  );
}

requireText(stationPolicy, "ENERGY_OBJECT_SEMANTIC_GROUPS", "energy-object semantic group registry is missing");
requireText(stationPolicy, 'key: "supply_station"', "supply-station semantic group is missing");
requireText(stationPolicy, 'key: "distribution_consumption"', "distribution/consumption semantic group is missing");
requireText(copy, 'navEnergyGroupSupplyStations: "供能站房"', "Chinese supply-station label is missing");
requireText(copy, 'navEnergyGroupDistributionConsumption: "配用能系统"', "Chinese distribution/consumption label is missing");
requireText(copy, 'navEnergyGroupSupplyStations: "Supply Stations"', "English supply-station label is missing");
requireText(copy, 'navEnergyGroupDistributionConsumption: "Distribution & Consumption"', "English distribution/consumption label is missing");
requireText(copy, 'navEnergyGroupSupplyStations: "Trạm cung năng lượng"', "Vietnamese supply-station label is missing");
requireText(copy, 'navEnergyGroupDistributionConsumption: "Phân phối & sử dụng năng lượng"', "Vietnamese distribution/consumption label is missing");

for (const summaryKey of [
  "navStationSummaryChilled",
  "navStationSummaryCompressedAir",
  "navStationSummaryBoiler",
  "navStationSummaryPower",
  "navStationSummaryHvacTerminal"
]) {
  requireText(stationPolicy, `summaryKey: "${summaryKey}"`, `missing station capability summary: ${summaryKey}`);
}

requireText(stationPolicy, 'to: "/auto-twin"', "system twin must be a station function");
requireText(stationPolicy, 'ENERGY_STATION_QUERY_KEY = "station"', "station query contract is missing");
requireText(stationPolicy, 'ENERGY_STATION_INSTANCE_QUERY_KEY = "stationId"', "physical station query contract is missing");
requireText(shell, "formatStationInstanceBindingLabel", "physical station rows must expose runtime-binding state");
requireText(shell, "data-station-registry-action", "empty station registry has no actionable project-config entry");
requireText(
  shell,
  'appendSiteIdToPath("/config-center", currentSiteId)',
  "empty station registry action must preserve only the current project scope"
);
requireText(copy, 'navStationRegistryAction: "查看站房登记"', "Chinese station-registry action copy is missing");
requireText(copy, 'navStationRegistryAction: "View station registry"', "English station-registry action copy is missing");
requireText(copy, 'navStationRegistryAction: "Xem đăng ký trạm"', "Vietnamese station-registry action copy is missing");
requireText(stationCss, ".nav-station-registry-action", "station-registry action styling is missing");
requireText(mobileCss, ".nav-station-registry-action", "mobile station-registry action guard is missing");
requireText(copy, 'navStationBindingPublished: "绑定 v{version} 已发布"', "Chinese published binding label is missing");
requireText(copy, 'navStationBindingUnconfigured: "运行绑定未配置"', "Chinese unconfigured binding label is missing");
requireText(copy, 'navWorkspaceStationInstanceUnsupported: "{scope}类型级（实例筛选未接入）"', "unsupported physical-station workspace scope label is missing");
requireText(shell, 'runtimeBindingMode === "unsupported"', "workspace items must disclose unsupported physical-instance filtering");
requireText(shell, "resolvePublishedStationBindingVersion", "published station binding version helper is missing");
requireText(
  shell,
  'resolveStationRuntimeBindingMode(location.pathname) === "required"',
  "current-page scope label does not distinguish a station-bound runtime route"
);
requireText(
  shell,
  "currentPageStationScopeApplied && currentStationInstance",
  "a verified station-bound page does not name the physical station as its actual data scope"
);
const physicalParentTypesStart = stationPolicy.indexOf("export const PHYSICAL_STATION_PARENT_TYPES");
const physicalParentTypesEnd = stationPolicy.indexOf("] as const", physicalParentTypesStart);
const physicalParentTypesBlock = stationPolicy.slice(physicalParentTypesStart, physicalParentTypesEnd);
for (const parentType of ["chilled_plant", "compressed_air", "boiler_room"]) {
  requireText(
    physicalParentTypesBlock,
    `"${parentType}"`,
    `physical station parent allowlist is missing ${parentType}`
  );
}
rejectText(
  physicalParentTypesBlock,
  "power_monitoring",
  "power monitoring must not be a physical station parent"
);
rejectText(
  physicalParentTypesBlock,
  "hvac_terminal",
  "HVAC terminals must not be a physical station parent"
);
requireText(stationPolicy, "PHYSICAL_STATION_PARENT_TYPES", "physical station parent allowlist is missing");
requireText(stationPolicy, "isPhysicalStationParentType", "physical station parent guard is missing");
requireText(stationPolicy, "readEnergyStationTypeFromSearch", "station query validation helper is missing");
requireText(stationPolicy, "readEnergyStationIdFromSearch", "physical station query reader is missing");
requireText(stationPolicy, "clearEnergyStationInstanceFromSearch", "project switching cannot clear a physical station context");
requireText(
  stationPolicy,
  "export function clearEnergyStationContextFromSearch(search: string): string {",
  "project switching lacks a full station-context clear helper"
);
const clearStationContextStart = stationPolicy.indexOf("export function clearEnergyStationContextFromSearch");
const clearStationContextEnd = stationPolicy.indexOf("\n}\n", clearStationContextStart);
const clearStationContextBlock = stationPolicy.slice(clearStationContextStart, clearStationContextEnd + 3);
requireText(clearStationContextBlock, "params.delete(ENERGY_STATION_QUERY_KEY);", "project switching does not clear station type");
requireText(clearStationContextBlock, "params.delete(ENERGY_STATION_INSTANCE_QUERY_KEY);", "project switching does not clear stationId");
requireText(stationPolicy, "appendEnergyStationContextToPath", "station context path helper is missing");
requireText(bffClient, "RuntimeStationInstanceDto", "frontend physical station DTO is missing");
requireText(bffClient, "stationInstances?: RuntimeStationInstanceDto[]", "capability response lacks physical station identities");
requireText(bffClient, "stationTotal?: number", "capability response lacks physical station total");
requireText(stationPolicy, "STATION_WORKSPACE_ROUTE_POLICIES", "workspace route-scope policy registry is missing");
requireText(stationPolicy, "resolveStationWorkspaceRoutePolicy", "workspace data-scope resolver is missing");
requireText(stationPolicy, "isStationWorkspaceRouteSupported", "workspace station compatibility guard is missing");
requireText(stationPolicy, 'dataScope: "site"', "project-wide unfiltered scope contract is missing");
requireText(stationPolicy, 'dataScope: "station"', "fixed station scope contract is missing");
requireText(stationPolicy, 'dataScope: "device"', "device-selected scope contract is missing");
requireText(stationPolicy, 'const CHILLED_PLANT_ONLY = ["chilled_plant"]', "cold-plant-only route boundary is missing");

const runtimeRequiredRoutesMatch = stationPolicy.match(
  /const STATION_RUNTIME_REQUIRED_ROUTES = new Set\(\[([\s\S]*?)\]\);/
);
if (!runtimeRequiredRoutesMatch) {
  throw new Error("station runtime required-route registry is missing");
}
const runtimeRequiredRoutes = [...runtimeRequiredRoutesMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
requireExactStringSet(
  runtimeRequiredRoutes,
  ["/scene-control", "/compressed-air", "/boiler-room", "/devices", "/ai-overview"],
  "station runtime required-route matrix changed"
);

const runtimeOptionalWorkspaceRoutes = [...stationPolicy.matchAll(
  /\{ route: "([^"]+)", moduleKey: "[^"]+", dataScope: "site"(?:,| \})/g
)].map((match) => match[1]);
requireExactStringSet(
  runtimeOptionalWorkspaceRoutes,
  ["/alarms", "/operation-records", "/work-orders", "/video-monitor"],
  "station runtime optional-route matrix changed"
);

const runtimeUnsupportedWorkspaceRoutes = [...stationPolicy.matchAll(
  /\{ route: "([^"]+)", moduleKey: "[^"]+", dataScope: "(?:station|device)"(?:,| \})/g
)]
  .map((match) => match[1])
  .filter((route) => !runtimeRequiredRoutes.includes(route));
requireExactStringSet(
  runtimeUnsupportedWorkspaceRoutes,
  [
    "/trend-analysis",
    "/energy-analysis",
    "/energy-efficiency",
    "/meter-readings",
    "/performance-report",
    "/report-records",
    "/optimize-demo",
    "/environment-conditions",
    "/operational-diagnostics"
  ],
  "station runtime unsupported workspace-route matrix changed"
);

const runtimeBindingResolverStart = stationPolicy.indexOf("export function resolveStationRuntimeBindingMode");
const runtimeBindingResolverEnd = stationPolicy.indexOf("\n}\n", runtimeBindingResolverStart);
const runtimeBindingResolverBlock = stationPolicy.slice(runtimeBindingResolverStart, runtimeBindingResolverEnd + 3);
requireText(runtimeBindingResolverBlock, 'return "required";', "required station runtime route is not fail-closed");
requireText(
  runtimeBindingResolverBlock,
  'if (workspacePolicy?.dataScope === "site")',
  "project-level station-context routes are not kept optional"
);
requireText(runtimeBindingResolverBlock, 'return "optional";', "optional station runtime route state is missing");
requireText(
  runtimeBindingResolverBlock,
  "if (workspacePolicy || resolveEnergyStationForPath(pathname))",
  "station-associated routes without endpoint support are not classified"
);
requireText(runtimeBindingResolverBlock, 'return "unsupported";', "unsupported station runtime route state is missing");

for (const coldOnlyRoute of [
  "/trend-analysis",
  "/energy-analysis",
  "/energy-efficiency",
  "/meter-readings",
  "/performance-report",
  "/report-records",
  "/ai-overview",
  "/optimize-demo",
  "/devices",
  "/environment-conditions",
  "/operational-diagnostics"
]) {
  requireText(
    stationPolicy,
    `{ route: "${coldOnlyRoute}",`,
    `missing station scope policy for ${coldOnlyRoute}`
  );
}
requireText(stationPolicy, 'capabilityLoadState !== "ready"', "capability failure must not erase station navigation");
requireText(stationPolicy, "perspective.canViewUnconfiguredStations", "unconfigured station visibility must be role-aware");
requireText(navigationPolicy, "canViewUnconfiguredStations", "navigation perspective lacks unconfigured-station permission");

const stationScopedClientFunctionNames = readExportedAsyncFunctionBlocks(bffClient)
  .filter((entry) => entry.source.includes("stationId"))
  .map((entry) => entry.name);
const stationScopeQueryClientFunctionNames = readExportedAsyncFunctionBlocks(bffClient)
  .filter((entry) => entry.source.includes("appendStationScopeQuery("))
  .map((entry) => entry.name);
const allowedStationScopedClientFunctions = [
  "fetchDeviceList",
  "fetchDeviceTree",
  "fetchDeviceDetail",
  "fetchDeviceDetails",
  "fetchRuntimePointSummary"
];
requireExactStringSet(
  stationScopedClientFunctionNames,
  allowedStationScopedClientFunctions,
  "only the five verified runtime client functions may expose stationId"
);
requireExactStringSet(
  stationScopeQueryClientFunctionNames,
  allowedStationScopedClientFunctions,
  "only the five verified runtime client functions may append stationId"
);
if (countText(bffClient, 'search.set("stationId", normalizedStationId);') !== 1) {
  throw new Error("stationId query injection must remain centralized in appendStationScopeQuery");
}
for (const [functionName, endpointFragment] of [
  ["fetchDeviceList", "/devices/list"],
  ["fetchDeviceTree", "/devices/tree"],
  ["fetchDeviceDetail", "/devices/${encodeURIComponent(deviceId)}"],
  ["fetchDeviceDetails", "/devices/details"],
  ["fetchRuntimePointSummary", "/runtime/summary"]
]) {
  const functionBlock = readExportedAsyncFunctionBlocks(bffClient).find((entry) => entry.name === functionName)?.source || "";
  requireText(functionBlock, endpointFragment, `${functionName} no longer targets its approved station-scoped endpoint`);
  requireText(functionBlock, "appendStationScopeQuery(", `${functionName} does not use the centralized station scope query helper`);
}

for (const expectedCheck of [
  'dataScope?.applied === true',
  'dataScope.filterMode === "station_binding"',
  'dataScope.reason === "STATION_RUNTIME_BINDING_APPLIED"',
  'dataScope.siteId === scope.runtimeBindingSiteId',
  'dataScope.stationId === scope.runtimeStationId',
  'dataScope.requestedSubsystemType === scope.stationType',
  'dataScope.effectiveSubsystemType === scope.stationType',
  'dataScope.bindingVersion === scope.bindingVersion'
]) {
  requireText(
    stationRuntimeScope,
    expectedCheck,
    `station runtime response proof is missing: ${expectedCheck}`
  );
}

const stationAwareRuntimePageNames = new Set([
  "DeviceOverviewPage.tsx",
  "SceneControlPage.tsx",
  "AiOverviewPage.tsx",
  "CompressedAirMonitoringPage.tsx",
  "BoilerRoomMonitoringPage.tsx"
]);
const stationNavigationOnlyPageNames = new Set([
  "DashboardPage.tsx"
]);
for (const pageName of fs.readdirSync(path.join(rootDir, "src/pages")).filter((name) => name.endsWith("Page.tsx"))) {
  if (stationAwareRuntimePageNames.has(pageName)) {
    continue;
  }
  if (stationNavigationOnlyPageNames.has(pageName)) {
    const pageSource = read(`src/pages/${pageName}`);
    requireText(pageSource, "data-physical-station-runtime-evidence=\"page_required\"", `${pageName} station links must defer runtime proof to the destination page`);
    for (const runtimeScopeToken of ["useStationRuntimeScope", "appendStationScopeQuery", "fetchRuntimePointSummary"]) {
      rejectText(pageSource, runtimeScopeToken, `${pageName} may preserve station navigation context but must not request station runtime data`);
    }
    continue;
  }
  rejectText(
    read(`src/pages/${pageName}`),
    "stationId",
    `${pageName} must not inject a physical station into project-level or unsupported APIs`
  );
}

if (countText(deviceOverviewPage, "fetchDeviceTree(") !== 1) {
  throw new Error("device page station-scoped tree request count changed without a response-proof review");
}
if (countText(deviceOverviewPage, "fetchDeviceList(") !== 2) {
  throw new Error("device page station-scoped list request count changed without a response-proof review");
}
if (countText(deviceOverviewPage, "fetchDeviceDetails(") !== 1) {
  throw new Error("device page station-scoped batch-detail request count changed without a response-proof review");
}
if (countText(deviceOverviewPage, "fetchDeviceDetail(") !== 1) {
  throw new Error("device page station-scoped detail request count changed without a response-proof review");
}
for (const stationContextKey of [
  "ENERGY_STATION_QUERY_KEY",
  "ENERGY_STATION_INSTANCE_QUERY_KEY"
]) {
  requireText(
    deviceOverviewPage,
    stationContextKey,
    `device page URL canonicalization is missing ${stationContextKey}`
  );
}
requireText(
  deviceOverviewPage,
  "nextParams.set(stationContextKey, stationContextValue);",
  "device page URL canonicalization drops the selected station context"
);
requireText(
  deviceOverviewPage,
  "if (runtimeStationId && !isAppliedStationRuntimeScope(payload.dataScope, stationRuntimeScope))",
  "device tree response is not checked against the selected station binding"
);
if (countText(
  deviceOverviewPage,
  "if (runtimeStationId && !isAppliedStationRuntimeScope(listData.dataScope, stationRuntimeScope))"
) !== 2) {
  throw new Error("every device-list response must be checked against the selected station binding");
}
requireText(
  deviceOverviewPage,
  "if (runtimeStationId && !isAppliedStationRuntimeScope(result.value.dataScope, stationRuntimeScope))",
  "each device batch-detail response is not checked against the selected station binding"
);
requireText(
  deviceOverviewPage,
  "if (runtimeStationId && !isAppliedStationRuntimeScope(result.dataScope, stationRuntimeScope))",
  "device detail response is not checked against the selected station binding"
);

if (countText(sceneControlPage, "fetchRuntimePointSummary(") !== 1) {
  throw new Error("scene page runtime-summary request count changed without a response-proof review");
}
requireText(
  sceneControlPage,
  "if (runtimeStationId && !isAppliedStationRuntimeScope(summary.dataScope, stationRuntimeScope))",
  "scene runtime-summary response is not checked against the selected station binding"
);
if (countText(aiOverviewPage, "fetchRuntimePointSummary(") !== 1) {
  throw new Error("AI page runtime-summary request count changed without a response-proof review");
}
requireText(
  aiOverviewPage,
  "const stationScopeVerified = runtimeSiteScopeVerified && (",
  "AI runtime-summary response is not checked against the selected station binding"
);
requireText(
  aiOverviewPage,
  "!runtimeStationId || isAppliedStationRuntimeScope(runtimeCandidate?.dataScope, stationRuntimeScope)",
  "AI runtime-summary response no longer validates the selected physical station"
);
requireText(aiOverviewPage, "const nextRuntime = stationScopeVerified ? runtimeCandidate : null;", "AI page does not discard unproved station data");

for (const [pageSource, pageLabel] of [
  [compressedAirPage, "compressed-air"],
  [boilerRoomPage, "boiler-room"]
]) {
  if (countText(pageSource, "fetchRuntimePointSummary(") !== 1) {
    throw new Error(`${pageLabel} page runtime-summary request count changed without a response-proof review`);
  }
  requireText(
    pageSource,
    "!isAppliedStationRuntimeScope(summary.dataScope, stationRuntimeScope)",
    `${pageLabel} runtime-summary response is not checked against the selected station binding`
  );
  requireText(
    pageSource,
    "系统未回退到项目级数据",
    `${pageLabel} page does not disclose its fail-closed project-data boundary`
  );
  requireText(
    pageSource,
    'data-station-runtime-applied={runtimeScopeApplied ? "true" : "false"}',
    `${pageLabel} page lacks inspectable station-runtime evidence state`
  );
}

rejectText(shell, "stationRuntimeBindingReady", "a published station binding must not be named or treated as runtime evidence");
requireText(shell, "const stationRuntimeBindingPublished = Boolean(", "published station binding state is not explicit");
requireText(
  shell,
  "runtimeStationId: stationRuntimeBindingPublished ? currentStationInstance?.stationId || null : null",
  "unpublished station bindings can leak into runtime requests"
);
for (const [pageSource, pageLabel] of [
  [deviceOverviewPage, "device"],
  [sceneControlPage, "scene"],
  [aiOverviewPage, "AI"],
  [compressedAirPage, "compressed-air"],
  [boilerRoomPage, "boiler-room"]
]) {
  rejectText(pageSource, "bindingPublished", `${pageLabel} page must derive runtime truth from each response, not publication state`);
}
requireText(deviceOverviewPage, "const stationScopeEvidenceReady = stationCatalogScopeApplied && stationTreeScopeApplied;", "device scope evidence does not require both catalog and tree responses");
requireText(sceneControlPage, "const stationScopedRuntimeSummary = runtimeStationId", "scene runtime truth is not derived from a validated response envelope");
requireText(aiOverviewPage, "runtimeSummary\n                ? `站房筛选已验证", "AI verified label is not conditional on a validated runtime response");

requireText(shell, "fetchSiteCapabilities", "shell does not load station capabilities");
requireText(shell, 'data-nav-section="stations"', "left station section is missing");
requireText(shell, "nav-station-list", "left station list is missing");
requireText(shell, "navObjectDirectoryTitle", "left navigation does not identify itself as the energy-object directory");
requireText(shell, "navObjectDirectoryDescription", "left navigation does not explain type and physical-station selection");
requireText(shell, "visibleEnergyStationGroups", "visible energy objects are not grouped semantically");
requireText(shell, "data-energy-object-semantic-group", "semantic group DOM hook is missing");
requireText(shell, "nav-energy-object-group-label", "semantic group label is missing");
requireText(shell, "registeredStationInstances", "shell does not keep physical stations separate from type capabilities");
requireText(shell, "isPhysicalStationParentType(instance.parentSubsystemType)", "runtime station instances accept non-physical parent types");
requireText(shell, "stationInstancesBySubsystemType", "physical stations are not grouped by parent subsystem type");
requireText(shell, "data-station-type-group", "two-level station group hook is missing");
requireText(shell, "data-station-instance-toggle", "physical station disclosure trigger is missing");
requireText(shell, "data-station-instance-panel", "physical station disclosure panel is missing");
requireText(shell, "data-shell-station-instance-link", "physical station navigation link is missing");
requireText(shell, "data-parent-subsystem-type", "physical station parent identity is not exposed");
rejectText(shell, 'data-nav-section="shared-operations"', "shared operation cards must not remain in the desktop left navigation");
rejectText(shell, 'data-nav-section="system"', "system card must not remain in the desktop left navigation");
const primaryNavSections = [...shell.matchAll(/data-nav-section="([^"]+)"/g)].map((match) => match[1]);
for (const section of primaryNavSections) {
  if (!["global", "stations", "mobile-workspace"].includes(section)) {
    throw new Error(`unexpected primary navigation section: ${section}`);
  }
}
requireText(
  shell,
  'const stationWorkspaceModuleKeys = ["operations", "duty", "analysis", "ai", "diagnostics"] as const;',
  "station workspace must contain exactly run, duty, analysis, AI and diagnostics"
);
requireText(shell, 'const workspaceLevel = associatedWorkspaceStation ? "energy-object" : "project";', "workspace level does not distinguish project and energy-object context");
requireText(shell, "navWorkspaceProjectTitle", "project workspace title is missing");
requireText(shell, "navWorkspaceObjectTitle", "energy-object workspace title is missing");
requireText(shell, "navWorkspaceOverview", "project workspace still mislabels its dashboard entry as station run");
requireText(shell, "data-workspace-level={workspaceLevel}", "workspace level DOM contract is missing");
requireText(shell, "data-workspace-level-label", "desktop workspace level is not visibly labelled");
requireText(shell, "const configWorkspaceAction = configNavigationModule", "global configuration must be modeled separately from the five station workspaces");
const globalConfigHooks = (shell.match(/data-shell-global-config/g) || []).length;
if (globalConfigHooks < 2) {
  throw new Error("global configuration must have separate desktop and mobile entries");
}
const globalConfigScopes = (shell.match(/data-workspace-scope="global"/g) || []).length;
if (globalConfigScopes < 2) {
  throw new Error("desktop and mobile configuration entries must both clear station scope");
}
requireText(shell, "const routeEnergyStation", "route-owned station context is missing");
requireText(shell, "const queryEnergyStation", "query-owned station context is missing");
requireText(shell, "const policyBoundEnergyStation", "single-energy-object route policy is not reflected in navigation context");
requireText(shell, "currentWorkspaceRoutePolicy?.supportedStationTypes?.length === 1", "single-energy-object route inference is not fail-closed");
requireText(shell, "routeEnergyStation || queryEnergyStation || policyBoundEnergyStation", "current energy-object context ignores a route's fixed single-object scope");
requireText(shell, "const requestedQueryEnergyStation", "query station must be resolved before visibility filtering");
requireText(shell, "requestedQueryEnergyStation.visible", "hidden station query is not rejected fail-closed");
requireText(shell, "queryEnergyStationIsSupported", "query station compatibility is not resolved before rendering");
requireText(shell, "rejectedQueryEnergyStation", "incompatible station context is not represented explicitly");
requireText(shell, "routeEnergyStation || queryEnergyStation", "route station must take priority over query station");
requireText(shell, 'data-shell-internal-nav={routeEnergyStation ? "station" : undefined}', "station-internal navigation must be route-owned");
requireText(shell, '"station-workspace"', "station-associated shared scope is not explicit");
requireText(shell, "secondaryNavItems.map", "secondary navigation does not use station-local items");
requireText(
  shell,
  'unfilteredSecondaryNavItems.filter((item) => resolveStationRuntimeBindingMode(item.to) !== "unsupported")',
  "physical-station secondary navigation must hide routes that cannot apply stationId"
);
requireText(shell, "buildContextualNavigationTarget(item.to)", "shared secondary links do not preserve station context");
requireText(shell, "appendEnergyStationContextToPath(item.to, navigationStationType, navigationStationInstanceId)", "workspace child links do not preserve resolved station/stationId context");
requireText(shell, "resolveWorkspaceNavigationStationType", "project workspace links do not materialize fixed single-object route scope");
requireText(shell, "appendSiteIdToPath(\n              appendEnergyStationContextToPath(item.to, navigationStationType, navigationStationInstanceId)", "workspace child links do not preserve siteId with resolved object context");
requireText(shell, "data-shell-station-workspace", "desktop station workspace is missing");
requireText(shell, "data-workspace-current-data-scope", "actual workspace data scope is not visible");
requireText(shell, "navWorkspaceProjectUnfiltered", "project-wide pages do not disclose missing station filtering");
requireText(shell, "navWorkspaceSelectedDevices", "device-selected pages do not disclose their effective scope");
requireText(shell, "navWorkspacePowerProjectAggregate", "power workspace does not disclose current-project aggregation");
requireText(shell, "navWorkspaceHvacFixedFloor", "HVAC terminal workspace does not disclose its fixed-floor scope");
requireText(shell, "resolveEnergyObjectDataScopeLabel(routeEnergyStation)", "route-owned distribution scope is not resolved separately from its object label");
requireText(shell, "resolveEnergyObjectDataScopeLabel(associatedWorkspaceStation)", "run workspace children do not retain truthful distribution scope labels");
requireText(shell, "data-workspace-availability", "unsupported station workspaces lack an availability state");
requireText(shell, "disabled={action.isUnavailable}", "unsupported station workspaces must not open cold-plant pages");
requireText(shell, 'data-workspace-module={action.key}', "workspace module hooks are missing");
requireText(shell, "stationWorkspaceActions", "workspace action registry is missing");
requireText(shell, "sourceItems.map", "workspace child functions are not rendered from the full source inventory");
requireText(
  shell,
  'const stationInstanceSupported = !currentStationInstance || resolveStationRuntimeBindingMode(item.to) !== "unsupported";',
  "physical-station workspaces must not count known scope-guard dead ends as available"
);
requireText(shell, "action.items.length", "workspace child counts are missing");
requireText(shell, "data-workspace-menu-trigger", "workspace expandable trigger hook is missing");
requireText(shell, "data-workspace-panel", "workspace child panel hook is missing");
requireText(shell, "data-workspace-child-link", "workspace child link hook is missing");
requireText(
  shell,
  "return () => window.cancelAnimationFrame(focusFrame);\n  }, [isCompactViewport, isMobileNavOpen]);",
  "mobile drawer initial focus must not rerun when a workspace accordion changes"
);
requireText(
  shell,
  ".filter((element) => element.getClientRects().length > 0);",
  "mobile drawer focus trap must resolve the current visible focus targets"
);
requireText(shell, 'role={isCompactViewport ? "dialog" : undefined}', "mobile drawer must expose dialog semantics");
requireText(
  shell,
  'aria-modal={isCompactViewport && isMobileNavOpen ? "true" : undefined}',
  "open mobile drawer must expose modal semantics"
);
requireText(
  shell,
  'aria-label={isCompactViewport ? zhCN.appShell.navigationDialog : undefined}',
  "mobile drawer dialog must have an accessible name"
);
requireText(shell, 'className="nav-overlay"', "mobile drawer pointer-dismiss overlay is missing");
requireText(shell, 'aria-hidden="true"\n        tabIndex={-1}', "pointer-dismiss overlay must stay out of the accessibility tree and tab order");
requireText(
  shell,
  'document.addEventListener("pointerdown", handleWorkspacePointerDown);',
  "workspace disclosure outside-click handling must support pointer input"
);
requireText(
  shell,
  'document.addEventListener("focusin", handleWorkspaceFocusIn);',
  "workspace disclosure must close after keyboard focus leaves the open root"
);
requireText(
  shell,
  "setIsCompactViewport(event.matches);\n      setOpenWorkspaceMenuKey(null);",
  "workspace disclosure state must not leak across the 900px layout boundary"
);
requireText(
  shell,
  'className="station-workspace-toolbar"\n              role="group"',
  "desktop workspace toolbar lacks group semantics"
);
requireText(
  shell,
  'className="nav-mobile-workspace-panel"\n                          aria-label=',
  "mobile workspace child disclosure lacks a named navigation landmark"
);
requireText(
  shell,
  'className="station-workspace-popover"\n                          aria-label=',
  "desktop workspace child disclosure lacks a named navigation landmark"
);
requireText(shell, "station.summary", "station capability summaries must replace misleading function counts");
rejectText(shell, 'aria-haspopup="true"', "workspace disclosure buttons must not claim an ARIA menu role");
requireText(shell, "PROJECT_SWITCHER_TRIGGER_ID", "project switcher trigger id must be stable");
requireText(shell, "PROJECT_SWITCHER_TREE_ID", "project tree id must be stable");
requireText(shell, 'aria-haspopup="tree"', "grouped project selector must expose a tree popup");
requireText(shell, 'role="tree"', "grouped project selector is missing tree semantics");
requireText(shell, 'role="treeitem"', "project selector entries are missing treeitem semantics");
requireText(shell, "data-project-tree-item", "project selector roving-focus hook is missing");
requireText(shell, "handleProjectDropdownTriggerKeyDown", "project selector trigger keyboard handling is missing");
requireText(shell, "handleProjectTreeItemKeyDown", "project tree keyboard handling is missing");
requireText(shell, "activeProjectTreeItemId", "project tree roving focus state is missing");
requireText(shell, "pendingProjectTreeFocusIntentRef", "project tree open intent must resolve after expansion");
requireText(shell, "aria-owns={isExpanded ? childrenGroupId : undefined}", "project tree group ownership is missing");
requireText(shell, "LOCALE_SWITCHER_TRIGGER_ID", "locale switcher trigger id must be stable");
requireText(shell, "LOCALE_SWITCHER_LISTBOX_ID", "locale listbox id must be stable");
requireText(shell, 'aria-haspopup="listbox"', "locale selector must expose a listbox popup");
requireText(shell, 'role="listbox"', "locale selector is missing listbox semantics");
requireText(shell, 'role="option"', "locale selector entries are missing option semantics");
requireText(shell, "data-locale-option", "locale selector roving-focus hook is missing");
requireText(shell, "handleLocaleDropdownTriggerKeyDown", "locale selector trigger keyboard handling is missing");
requireText(shell, "handleLocaleOptionKeyDown", "locale listbox keyboard handling is missing");
requireText(shell, "activeLocaleOptionId", "locale listbox roving focus state is missing");
for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Enter"]) {
  requireText(shell, `event.key === "${key}"`, `selector keyboard contract is missing ${key}`);
}
requireText(shell, "closeProjectDropdown(true)", "project selector Escape/selection must return focus");
requireText(shell, "closeLocaleDropdown(true)", "locale selector Escape/selection must return focus");
rejectText(shell, '<label className="project-switcher">', "project disclosure must not be wrapped in an invalid label");
rejectText(shell, '<label className="locale-switcher">', "locale disclosure must not be wrapped in an invalid label");
requireText(shell, "currentNavItem ? [currentNavItem]", "shared pages must not duplicate the complete workspace inventory in the secondary row");
requireText(shell, "data-shell-global-config", "global configuration entry is missing");
requireText(shell, 'defaultTo: "/config-center"', "global configuration must use the configuration center as its default entry");
requireText(configCenterEntry, 'data-config-center-scope="project"', "configuration center must disclose project scope");
requireText(configCenterEntry, "ADMIN_ENTRY_PROBE_TIMEOUT_MS = 1_500", "configuration center admin reachability probe is not bounded");
requireText(configCenterEntry, 'mode: "no-cors"', "configuration center cannot safely probe the cross-port admin entry");
requireText(configCenterEntry, "data-admin-entry-state", "configuration center does not disclose admin-entry reachability");
requireText(configCenterEntry, 'adminEntryState === "available"', "configuration center does not prevent a known dead admin link");
requireText(configCenterEntry, "配置中心未启动 · 重试", "configuration center unavailable state has no recovery action");
requireText(configCenterEntry, 'buildAdminProjectUrl(configSiteId, "subsystems")', "configuration center is missing the energy-object entry");
requireText(configCenterEntry, 'buildAdminProjectUrl(configSiteId, "stations")', "configuration center is missing the physical-station registry entry");
requireText(configCenterEntry, "物理站房登记", "configuration center does not expose physical-station registration");
requireText(configCenterEntry, "多站房上线顺序", "configuration center does not explain the multi-station rollout sequence");
requireText(configCenterEntry, "不继承站房上下文", "configuration center project-scope boundary is missing");
requireText(configCenterEntry, "normalizeRouteSiteId", "configuration center must separate the route site id from its admin configuration key");
requireText(configCenterEntryStyles, "config-center-hub-grid", "configuration center hub layout is missing");
requireText(configCenterEntryStyles, ".config-center-admin-state.is-unavailable", "unavailable admin entry has no visible state");
requireText(configCenterEntryStyles, ".config-center-module-card > button", "admin-entry retry action is not styled with module actions");
requireText(configCenterEntryStyles, "@media (max-width: 720px)", "configuration center mobile reflow is missing");
rejectText(configCenterEntry, "打开 3002", "configuration center action copy must describe the destination, not expose only a port number");
requireText(shell, "appendEnergyStationContextToPath(item.to, null)", "global configuration child links must clear station context");
requireText(shell, "data-shell-mobile-station-workspace", "mobile station workspace fallback is missing");
requireText(shell, "data-station-scope-guard", "incompatible station/page combinations must render a blocking boundary");
requireText(shell, "stationScopeGuardActive ? (", "incompatible station/page combinations do not guard the Outlet");
requireText(shell, "data-rejected-station-id", "invalid physical station context is not blocked explicitly");
requireText(shell, "clearEnergyStationContextFromSearch(location.search)", "project switching can leak station/stationId across projects");
rejectText(shell, "clearEnergyStationInstanceFromSearch(location.search)", "project switching still preserves the previous station type");
requireText(shell, "<Outlet />", "compatible routes must continue rendering the routed page");
requireText(stationCss, '[data-status-kind="live"]', "live station state style is missing");
requireText(stationCss, '[data-status-kind="error"]', "error station state style is missing");
requireText(stationCss, "min-height: 44px !important", "mobile station touch target must override the shell navigation baseline");
requireText(stationCss, "min-width: 44px !important", "mobile station disclosure target must remain at least 44px wide");
requireText(stationCss, ".nav-station-instance-toggle", "physical station disclosure style is missing");
requireText(
  stationCss,
  ".nav-station-instance-toggle:focus-visible {\n  outline: 2px solid rgba(103, 206, 250, 0.98);",
  "station disclosure keyboard focus ring is missing"
);
requireText(
  stationCss,
  ".left-nav nav a.nav-station-instance-link:focus-visible {\n  outline: 2px solid rgba(103, 206, 250, 0.98);",
  "station instance keyboard focus ring is missing"
);
requireText(stationCss, ".nav-station-instance-list[hidden]", "physical station disclosure hidden state is unsafe");
requireText(stationCss, ".nav-station-instance-link", "physical station child link style is missing");
requireText(stationCss, ".nav-energy-object-group", "energy-object semantic group style is missing");
requireText(stationCss, ".nav-energy-object-group-label", "energy-object semantic group label style is missing");
requireText(stationCss, ".station-workspace-toolbar", "desktop station workspace style is missing");
requireText(stationCss, ".station-workspace-count", "desktop workspace count style is missing");
requireText(stationCss, ".station-workspace-popover", "desktop workspace popover style is missing");
requireText(stationCss, ".station-workspace-data-scope", "desktop data-scope label style is missing");
requireText(stationCss, ".station-scope-guard", "incompatible station scope guard style is missing");
requireText(stationCss, ".station-workspace-link:disabled", "unavailable workspace state is not visually explicit");
requireText(stationCss, ".nav-mobile-workspace-list", "mobile workspace layout is missing");
requireText(stationCss, ".nav-mobile-workspace-panel", "mobile workspace accordion panel is missing");
requireText(stationCss, ".project-switcher-menu[hidden]", "project disclosure hidden state can be overridden by grid styles");
requireText(stationCss, ".locale-switcher-menu[hidden]", "locale disclosure hidden state can be overridden by grid styles");
requireText(stationCss, "min-height: 44px", "workspace child touch targets must be at least 44px");
requireText(stationCss, "grid-template-columns: minmax(0, 1fr) !important", "narrow mobile secondary navigation must restore a single flexible track");
requireText(stationCss, "grid-template-columns: max-content minmax(max-content, 1fr) max-content !important", "notebook secondary navigation does not reserve the station-local entry track");
requireText(stationCss, "overflow-x: visible !important", "notebook station-local entries can still be hidden in horizontal overflow");
requireText(stationCss, "@media (max-width: 1040px) and (min-width: 901px)", "narrow desktop workspace fallback is missing");
const compactWorkspaceStart = stationCss.indexOf("@media (max-width: 1040px) and (min-width: 901px)");
const compactWorkspaceEnd = stationCss.indexOf("@media (max-width: 900px)", compactWorkspaceStart);
const compactWorkspaceCss = stationCss.slice(compactWorkspaceStart, compactWorkspaceEnd);
const notebookWorkspaceStart = stationCss.indexOf("@media (max-width: 1360px) and (min-width: 901px)");
const notebookWorkspaceCss = stationCss.slice(notebookWorkspaceStart, compactWorkspaceStart);
requireText(notebookWorkspaceCss, ".station-workspace-context", "notebook workspace loses the associated-object truth element");
requireText(notebookWorkspaceCss, "display: inline-flex;", "notebook workspace does not keep the associated object visible");
rejectText(
  notebookWorkspaceCss,
  ".station-workspace-context {\n    display: none;",
  "notebook workspace must not hide the associated object"
);
requireText(compactWorkspaceCss, ".station-workspace-data-scope", "901–1040px layout loses the data-scope truth element");
requireText(compactWorkspaceCss, ".station-workspace-context", "901–1040px layout loses the associated-object truth element");
requireText(compactWorkspaceCss, "display: inline-flex;", "901–1040px layout hides the data-scope truth");
rejectText(
  compactWorkspaceCss,
  ".station-workspace-data-scope {\n    display: none;",
  "901–1040px layout must not hide the data-scope truth"
);
requireText(mobileCss, '.left-nav[data-mobile-nav-state="open"]::after', "open mobile drawer lacks a persistent scroll affordance");
requireText(mobileCss, 'content: "工作区可上下滚动"', "mobile drawer scroll affordance copy is missing");
requireText(mobileCss, "margin-bottom: 36px", "mobile drawer scroll affordance can obscure workspace actions");
requireText(mobileCss, "padding-bottom: 52px !important", "mobile drawer content cannot clear the scroll affordance");
requireText(mobileCss, "min-height: 44px !important", "mobile shell touch targets must remain at least 44px");
requireText(mobileCss, ".left-nav .nav-brand {\n    flex: 0 0 auto !important;", "mobile brand and role card can shrink beneath the navigation scroll region");
requireText(mobileCss, ".left-nav .nav-scroll {\n    min-height: 0 !important;\n    flex: 1 1 0 !important;", "mobile navigation scroll region does not yield to the full brand and role context height");

const fixedWorkspaceInventory = {
  duty: {
    defaultTo: "/alarms",
    routes: ["/alarms", "/operation-records", "/work-orders"]
  },
  analysis: {
    defaultTo: "/trend-analysis",
    routes: ["/trend-analysis", "/energy-analysis", "/energy-efficiency", "/meter-readings", "/performance-report", "/report-records"]
  },
  ai: {
    defaultTo: "/ai-overview",
    routes: ["/ai-overview", "/optimize-demo"]
  },
  diagnostics: {
    defaultTo: "/devices",
    routes: ["/devices", "/video-monitor", "/environment-conditions", "/operational-diagnostics"]
  },
  config: {
    defaultTo: "/config-center",
    routes: ["/config-center", "/energy-parameters", "/knowledge-base"]
  }
};

for (const [moduleKey, contract] of Object.entries(fixedWorkspaceInventory)) {
  const moduleBlock = readModuleBlock(shell, moduleKey);
  requireText(moduleBlock, `defaultTo: "${contract.defaultTo}"`, `${moduleKey} default entry is inconsistent`);
  for (const route of contract.routes) {
    requireText(moduleBlock, `to: "${route}"`, `${moduleKey} is missing workspace child: ${route}`);
  }
  const canonicalItemCount = (moduleBlock.match(/\{ to: "\//g) || []).length;
  if (canonicalItemCount !== contract.routes.length) {
    throw new Error(`${moduleKey} workspace count mismatch: expected ${contract.routes.length}, found ${canonicalItemCount}`);
  }
}

requireText(specification, "项目/园区 → 供能站房类型 → 物理站房实例（可选） → 站内功能", "supply-station information architecture objective is undocumented");
requireText(specification, "项目/园区 → 配用能系统 → 系统内功能", "distribution/consumption information architecture objective is undocumented");
requireText(specification, "配用能系统不是物理站房", "physical station and downstream-system semantic boundary is undocumented");
requireText(specification, "物理站房实例不得与能源类型同级展示", "physical station nesting rule is undocumented");
requireText(specification, "导航可见性不是后端授权", "permission boundary is undocumented");
requireText(specification, "导航关联上下文", "station query truth boundary is undocumented");
requireText(specification, "项目工作区", "project workspace responsibility is undocumented");
requireText(specification, "能源对象工作区", "energy-object workspace responsibility is undocumented");
requireText(specification, "页面作用域策略", "page scope policy is undocumented");
requireText(specification, "未按关联对象筛选", "project-wide unfiltered scope disclosure is undocumented");
requireText(specification, "不渲染 `<Outlet />`", "incompatible route request blocking boundary is undocumented");
requireText(specification, "配置入口不携带 `station`", "global configuration boundary is undocumented");
requireText(specification, "完整功能清单", "workspace child inventory is undocumented");
requireText(specification, "站房能力摘要", "station capability summary rule is undocumented");
requireText(specification, "移动端手风琴", "mobile workspace disclosure behavior is undocumented");
requireText(specification, "stationInstances[]", "physical station registry contract is undocumented");
requireText(specification, "项目切换必须清除旧项目 `stationId`", "cross-project stationId boundary is undocumented");
requireText(specification, "未按物理实例筛选", "physical station filter truth boundary is undocumented");
requireText(specification, "不得自动创建默认站房", "empty station-registry action boundary is undocumented");

for (const [source, sourceName] of [
  [startLocalStack, "local stack startup"],
  [stopLocalStack, "local stack shutdown"]
]) {
  requireText(
    source,
    'FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3001 3003 3004}"',
    `${sourceName} must reserve port 3002 for the administration UI`
  );
  rejectText(
    source,
    "3001 3002 3003",
    `${sourceName} must not reuse the fixed administration UI port as an operator-shell fallback`
  );
}
requireText(localStackRunbook, "`3002` 是 `apps/chiller-admin-v1` 的固定配置中心入口", "local stack runbook is missing the fixed administration UI boundary");
requireText(localStackRunbook, "`3001 3003 3004`", "local stack runbook has the wrong operator-shell fallback order");

for (const route of [
  "/scene-control",
  "/compressed-air",
  "/boiler-room",
  "/power-monitoring",
  "/hvac-terminal",
  "/alarms",
  "/trend-analysis",
  "/ai-overview",
  "/config-center"
]) {
  requireText(scopeMatrix, `\`${route}\``, `system UI scope matrix is missing route: ${route}`);
}
requireText(scopeMatrix, "关联对象", "system UI scope matrix must distinguish the associated object");
requireText(scopeMatrix, "数据范围", "system UI scope matrix must distinguish the actual data scope");
requireText(scopeMatrix, "项目页不得被标成“站房工作区”", "system UI scope matrix does not prohibit project/station workspace confusion");
requireText(scopeMatrix, "每个业务页面必须存在一个页面级主标题", "system UI scope matrix is missing the page-heading acceptance rule");
requireText(scopeMatrix, "3002", "system UI scope matrix is missing the administration UI port boundary");

console.log("Multi-energy station navigation contract passed.");
console.log("- checked supply-station and distribution/consumption semantic grouping");
console.log("- checked energy stations and downstream subsystems are left-navigation workspaces");
console.log("- checked complete child inventories, counts and station capability summaries");
console.log("- checked station-associated workspace, global configuration and mobile disclosure");
console.log("- checked context routing, page scope guards, capability truth, role visibility and keyboard access");
console.log("- checked required/optional/unsupported runtime routes and the five-endpoint stationId allowlist");
console.log("- checked per-response station proof across cold, compressed-air and boiler runtime pages");
console.log("- checked operator/admin port isolation and the project-wide UI scope matrix");

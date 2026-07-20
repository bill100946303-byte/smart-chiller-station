import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(source, expected, label, failures) {
  if (!source.includes(expected)) {
    failures.push(`${label}: missing ${JSON.stringify(expected)}`);
  }
}

function forbidText(source, forbidden, label, failures) {
  if (source.includes(forbidden)) {
    failures.push(`${label}: forbidden ${JSON.stringify(forbidden)}`);
  }
}

function sliceBetween(source, startNeedle, endNeedle, label, failures) {
  const start = source.indexOf(startNeedle);
  const end = start < 0 ? -1 : source.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0 || end <= start) {
    failures.push(`${label}: implementation path is not statically inspectable`);
    return "";
  }
  return source.slice(start, end);
}

const failures = [];
const runtimeConfig = read("src/config/runtimeConfig.ts");
const envExample = read(".env.example");
const dashboard = read("src/pages/DashboardPage.tsx");
const alarms = read("src/pages/AlarmPage.tsx");
const devices = read("src/pages/DeviceOverviewPage.tsx");
const optimize = read("src/pages/OptimizeDemoPage.tsx");
const scene = read("src/pages/SceneControlPage.tsx");
const sceneStyles = read("src/pages/SceneControlExtracted.css");
const plantOverview = read("src/components/scene3d/PlantOverview3D.tsx");
const plantOverviewStyles = read("src/components/scene3d/PlantOverview3D.css");
const plantOverview2d = read("src/components/scene3d/PlantOverview2D.tsx");
const readiness = read("src/components/common/ReadinessBadge.tsx");
const truthBadges = read("src/components/common/OperationalTruthBadges.tsx");
const statusTone = read("src/utils/statusTone.ts");
const appShell = read("src/layout/AppShell.tsx");
const appShellRoleStyles = read("src/layout/AppShellRole.css");
const appShellStationStyles = read("src/layout/AppShellStation.css");
const stationNavigation = read("src/config/energyStationNavigation.ts");
const dashboardStyles = read("src/pages/DashboardExtracted.css");
const aiOverviewStyles = read("src/pages/AiOverviewExtracted.css");
const dashboardMobile = read("src/pages/DashboardMobile.css");
const projectMobile = read("src/pages/ProjectSelectionMobile.css");
const appShellMobile = read("src/layout/AppShellMobile.css");
const compactMobileSafety = read("src/styles/compact-mobile-safety.css");
const loginMobile = read("src/pages/LoginMobile.css");
const controlPolicy = read("src/config/controlPolicy.ts");
const systemOverview = read("src/pages/SystemOverviewPage.tsx");
const aiOverview = read("src/pages/AiOverviewPage.tsx");
const loginPage = read("src/pages/LoginPage.tsx");
const boilerRoom = read("src/pages/BoilerRoomMonitoringPage.tsx");
const stationWorkspacePresentation = read("src/utils/stationWorkspacePresentation.ts");
const runtimePlanPath = sliceBetween(
  plantOverview,
  "function buildRuntimeAnimationPlan(",
  "function resolveLodPath(",
  "B25 runtime plan path",
  failures
);
const shadowSnapshotPairingPath = sliceBetween(
  runtimePlanPath,
  "const shadowEnvelopeReceivedAt =",
  "const shadowReadable =",
  "B25 SHADOW snapshot-pairing path",
  failures
);
const shadowReadablePath = sliceBetween(
  runtimePlanPath,
  "const shadowReadable =",
  "const evidenceLive =",
  "B25 actual shadowReadable gate",
  failures
);
const liveReadablePath = sliceBetween(
  runtimePlanPath,
  "const evidenceLive =",
  "const statePoints =",
  "B25 actual LIVE evidence gate",
  failures
);
const statusBadgePath = sliceBetween(
  plantOverview,
  "function applyEquipmentStatusFilter(",
  "function animateRuntimeStatusMarkers(",
  "B25 LOD status-badge path",
  failures
);
const bodyTintCreationPath = sliceBetween(
  plantOverview,
  "function createRuntimeEquipmentBodyTints(",
  "function createRuntimeStatusMarkers(",
  "B25 runtime-only equipment-body tint creation path",
  failures
);
const hoverRaycastPath = sliceBetween(
  plantOverview,
  "const updateHoverCursor = () => {",
  'renderer.domElement.addEventListener("pointerdown", handlePointerDown);',
  "B25 pointermove hover-raycast path",
  failures
);

requireText(runtimeConfig, "import.meta.env.VITE_APP_READ_ONLY === undefined", "read-only default", failures);
requireText(runtimeConfig, "? true", "read-only fail-closed fallback", failures);
requireText(runtimeConfig, "sceneControlEnabled", "scene control feature gate", failures);
requireText(envExample, "VITE_APP_READ_ONLY=1", "environment read-only default", failures);
requireText(envExample, "VITE_SCENE_CONTROL_ENABLED=0", "environment scene control default", failures);

for (const [label, source] of [
  ["dashboard", dashboard],
  ["alarms", alarms],
  ["devices", devices]
]) {
  requireText(source, "OperationalTruthBadges", `${label} truth badge`, failures);
  requireText(source, "resolveOperationalDataState", `${label} truth resolution`, failures);
}

forbidText(dashboard, ">云端实时<", "dashboard static realtime badge", failures);
forbidText(dashboard, ">PLC保护在线<", "dashboard static PLC badge", failures);
requireText(dashboard, "ENERGY_OBJECT_DEFINITIONS", "dashboard fixed energy-object matrix", failures);
requireText(dashboard, "generatedAt is the BFF aggregation time, not field telemetry evidence", "dashboard source-time boundary", failures);
requireText(dashboard, "overview?.freshness?.latestTimestamp", "dashboard overview source timestamp", failures);
requireText(dashboard, "trends?.freshness?.latestTimestamp", "dashboard trend source timestamp", failures);
requireText(dashboard, "sourceTime={heroSourceTime}", "dashboard source-time badge evidence", failures);
requireText(dashboard, 'sourceTimePendingLabel="待证"', "dashboard unverified source-time copy", failures);
forbidText(dashboard, "sourceTime={heroGeneratedAt}", "dashboard aggregation time must not masquerade as source time", failures);
requireText(truthBadges, 'data-operational-source-time={normalizedSourceTime ? "reported" : "unverified"}', "truth badge source-time evidence hook", failures);
for (const subsystemType of ["chilled_plant", "compressed_air", "boiler_room", "power_monitoring", "hvac_terminal"]) {
  requireText(dashboard, `subsystemType: "${subsystemType}"`, `dashboard energy object ${subsystemType}`, failures);
}
for (const statusCode of ["LIVE", "DEMO", "WAITING", "NOT CONFIGURED"]) {
  requireText(dashboard, `\"${statusCode}\"`, `dashboard energy-object status ${statusCode}`, failures);
}
requireText(dashboard, "data-energy-object-status={item.kind}", "dashboard rendered energy-object truth state", failures);
requireText(dashboard, "data-energy-object-kpi={item.participatesInKpi", "dashboard energy-object KPI participation gate", failures);
requireText(dashboard, "data-energy-object-evidence-conflict", "dashboard capability/runtime conflict hook", failures);
requireText(dashboard, ".fieldScopes", "dashboard consumes field-level data scope", failures);
requireText(dashboard, "overview?.fieldScopes?.chilledPlantMetrics", "dashboard chilled-plant field scope path", failures);
requireText(dashboard, "chilledPlantMetricsDataScope?.applied === true", "dashboard chilled-plant applied scope gate", failures);
requireText(dashboard, 'chilledPlantMetricsDataScope?.effectiveSubsystemType === "chilled_plant"', "dashboard chilled-plant effective scope gate", failures);
requireText(dashboard, 'chilledPlantMetricsDataScope?.filterMode === "fixed_subsystem"', "dashboard chilled-plant filter-mode gate", failures);
requireText(dashboard, "chilledPlantMetricsDataScope?.siteId === activeSiteId", "dashboard chilled-plant site gate", failures);
requireText(dashboard, "chilledPlantMetricCoverageVerified", "dashboard chilled-plant KPI field coverage gate", failures);
requireText(dashboard, "const chilledPlantTrendDataScope = trends?.dataScope", "dashboard trend scope evidence", failures);
requireText(dashboard, "chilledPlantTrendDataScope?.applied === true", "dashboard trend applied scope gate", failures);
requireText(dashboard, 'chilledPlantTrendDataScope?.effectiveSubsystemType === "chilled_plant"', "dashboard trend effective scope gate", failures);
requireText(dashboard, 'chilledPlantTrendDataScope?.filterMode === "fixed_subsystem"', "dashboard trend filter-mode gate", failures);
requireText(dashboard, "chilledPlantTrendDataScope?.siteId === activeSiteId", "dashboard trend site gate", failures);
forbidText(dashboard, "const overviewDataScope", "dashboard must not treat mixed overview root as chilled scope", failures);
requireText(dashboard, "冷站指标 · 固定范围", "dashboard chilled-metric verified scope badge", failures);
requireText(dashboard, "冷站指标 · 范围待核", "dashboard chilled-metric pending scope badge", failures);
requireText(dashboard, "冷站趋势 · 固定范围", "dashboard chilled-trend verified scope badge", failures);
requireText(dashboard, "冷站趋势 · 范围待核", "dashboard chilled-trend pending scope badge", failures);
requireText(dashboard, "冷站指标、冷站设备类主链路与项目级告警", "dashboard mixed KPI section scope label", failures);
requireText(dashboard, 'data-scope="client_device_type"', "dashboard device chain must disclose client-side type scope", failures);
requireText(dashboard, "后端接口尚未返回物理站实例过滤证据", "dashboard physical-station boundary copy", failures);
requireText(dashboard, 'data-scope="project_unfiltered"', "dashboard project alarm card scope", failures);
requireText(dashboard, "当前项目 · 告警 / 事件", "dashboard project-level alarm scope copy", failures);
requireText(dashboardStyles, "Dashboard multi-energy object matrix and field-scope truth", "dashboard multi-energy matrix style marker", failures);
forbidText(alarms, ">云端实时<", "alarm static realtime badge", failures);
forbidText(alarms, ">PLC 保护在线<", "alarm static PLC badge", failures);
forbidText(alarms, ">10 分钟刷新<", "alarm false refresh badge", failures);

requireText(alarms, "不能判定无告警", "alarm unknown-state copy", failures);
requireText(alarms, "isTrustedRealtimeAlarmSummary", "alarm realtime counts need an explicit source and freshness trust gate", failures);
requireText(alarms, 'summary.sourceStatus?.overall === "ok"', "alarm realtime summary source must be healthy", failures);
requireText(alarms, "summary.freshness?.stale === false", "alarm realtime summary freshness must be explicitly verified", failures);
requireText(alarms, "blockingHistoryEvidenceReady", "alarm optimize gate must wait for dedicated blocking-history evidence", failures);
requireText(alarms, "isTrustedBlockingHistoryEvidence", "alarm blocking-history evidence needs an explicit trust gate", failures);
requireText(alarms, "list.filters?.severity === expectedSeverity", "alarm blocking-history evidence must verify the severity filter echo", failures);
requireText(alarms, 'list.filters?.state === "1"', "alarm blocking-history evidence must verify the unresolved-state filter echo", failures);
requireText(alarms, 'severity: "3"', "alarm gate must query unresolved critical history independently", failures);
requireText(alarms, 'severity: "2"', "alarm gate must query unresolved major history independently", failures);
requireText(alarms, 'state: "1"', "alarm gate must query unresolved history explicitly", failures);
requireText(alarms, "unresolvedCriticalHistoryCount", "alarm optimize gate must block unresolved critical history", failures);
requireText(alarms, "unresolvedMajorHistoryCount", "alarm optimize gate must caution on unresolved major history", failures);
requireText(alarms, 'optimizeGate.tone === "danger"', "alarm high-frequency impact must reuse the optimize gate", failures);
requireText(alarms, 'optimizeGate.tone === "warn"', "alarm high-frequency impact must expose degraded evidence", failures);
forbidText(alarms, "当前无闭锁告警；该历史高频点位不阻断本次优化评审。", "alarm high-frequency impact must not contradict unresolved history", failures);
requireText(alarms, "optimizeReviewAllowed", "alarm optimize review must have an explicit allow gate", failures);
requireText(alarms, 'aria-disabled="true"', "alarm optimize review must expose its blocked state", failures);
requireText(devices, "hasKnownActiveAlarmCount", "device alarm known-state guard", failures);
requireText(readiness, "就绪状态待确认", "readiness unknown fallback", failures);

requireText(optimize, "executionPermissions?.canApprove === true", "approval permission fail-closed", failures);
requireText(optimize, "executionPermissions?.canRollback === true", "rollback permission fail-closed", failures);
requireText(optimize, "executionPermissions?.canDispatch === true", "dispatch permission fail-closed", failures);
requireText(optimize, "resolveAuthProjectDisplayName", "optimize diagnostic scope project label", failures);
forbidText(optimize, "现有 140/B25 数据能支撑哪些诊断", "optimize fixed-project diagnostic heading", failures);
requireText(scene, "const sceneControlBlocked = Boolean(plantOverviewProfile) || Boolean(runtimeStationId)", "project/station scene no-write gate", failures);
requireText(scene, "const model2dUrl = plantOverviewProfile?.model2dAssetPath || remoteModel2dUrl", "B25 reviewed local 2D asset preference", failures);
requireText(scene, "<PlantOverview2D", "B25 runtime-aware local 2D renderer", failures);
requireText(plantOverview2d, 'data-plant-2d-evidence={profile.model2dEvidenceMode}', "B25 exact read-only 2D evidence disclosure", failures);
requireText(plantOverview2d, 'data-runtime-binding="exact-deviceid-tagname-read-only"', "B25 2D exact identity and point binding", failures);
requireText(plantOverview2d, 'data-flow-evidence="schematic"', "B25 schematic-only 2D flow evidence", failures);
requireText(plantOverview2d, "resolvePlantOverviewRuntimeSnapshot", "B25 shared 2D and 3D state resolver", failures);
requireText(scene, "if (sceneControlBlocked)", "scene command creation guard", failures);
requireText(scene, "disabled={sceneControlBlocked}", "scene confirm disabled guard", failures);
if ((scene.match(/if \(sceneControlBlocked\)/g) || []).length < 2) {
  failures.push("project/station scene no-write gate must guard both command creation and confirmation");
}
requireText(scene, "本次指令未下发", "scene blocked dispatch outcome", failures);
requireText(plantOverview, 'const [demoAnimationEnabled, setDemoAnimationEnabled] = useState(false)', "B25 demo animation fail-closed default", failures);
requireText(plantOverview, "resolveVerifiedIdentityBindings", "B25 identity coverage runtime validation", failures);
requireText(plantOverview, '"unbound-incomplete"', "B25 incomplete identity coverage state", failures);
requireText(plantOverview, '"live-read-only"', "B25 point-authoritative read-only animation state", failures);
requireText(plantOverview, '"shadow-read-only"', "B25 explicit non-authoritative shadow animation state", failures);
requireText(plantOverview, 'const shadowAnimationAvailable = runtimeEvidenceState !== "LIVE"', "B25 shadow separated from LIVE evidence", failures);
requireText(plantOverview, "runtimeAnimationPlan.shadowReadableEquipmentCount > 0", "B25 shadow state independent of running motion count", failures);
requireText(plantOverview, '"paused-stale"', "B25 stale animation state", failures);
requireText(plantOverview, '"paused-unbound"', "B25 unbound animation state", failures);
requireText(plantOverview, '"schematic-demo"', "B25 explicit demo animation state", failures);
requireText(plantOverview, "action.paused = true", "B25 stale/unbound animation pause", failures);
requireText(plantOverview, "action.timeScale = 0", "B25 stale/unbound zero playback rate", failures);
requireText(plantOverview, "AUTHORITATIVE_TIMESTAMP_BASES", "B25 authoritative timestamp basis allowlist", failures);
requireText(plantOverview, "isAuthoritativeFreshPoint", "B25 per-point observedAt freshness guard", failures);
requireText(plantOverview, "matchingSources.length === 1", "B25 runtime source must be exact and unique", failures);
requireText(plantOverview, "matchingSources[0].fallback === false", "B25 exact non-fallback runtime source-health guard", failures);
requireText(plantOverview, "CODE_OWNED_EVIDENCE_PROFILE_IDS.has", "B25 runtime evidence must use a code-owned decoder profile", failures);
requireText(plantOverview, "readExactNonEmptyString(point.deviceId) === exactDeviceId", "B25 raw exact device identity telemetry join", failures);
requireText(plantOverview, "runtimeSignalBindings", "B25 reviewed exact runtime signal map", failures);
requireText(plantOverview, 'selectorStatus === "POINT_TABLE_DERIVED_READ_ONLY"', "B25 point-table selector status gate", failures);
requireText(plantOverview, "selectorReadOnly === true", "B25 selector read-only boundary", failures);
requireText(plantOverview, 'selectorConfidence === "point_table_exact_read_only"', "B25 point-table exact selector confidence", failures);
requireText(plantOverview, 'transportAliasStatus === "REVIEWED_EXACT_TRANSPORT_ALIAS"', "B25 reviewed exact transport alias gate", failures);
requireText(plantOverview, "resolveReviewedRuntimeTagAlias", "B25 explicit point-table to runtime tag alias", failures);
requireText(plantOverview, "readExactNonEmptyString(point.tagName) === exactTagName", "B25 raw exact tag telemetry join", failures);
requireText(plantOverview, "EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID", "B25 exact 54-equipment runtime identity set", failures);
requireText(plantOverview, "matches.length === 1", "B25 ambiguous point mapping fail-closed guard", failures);
requireText(plantOverview, "runtimeDecision?.motionEnabled === true", "B25 per-clip runtime motion gate", failures);
requireText(plantOverview, "runtimeAnimationPlanRef", "B25 refreshed runtime plan propagation", failures);
requireText(plantOverview, "SHADOW仅按精确唯一运行/故障/远程点", "B25 shadow-value confidence boundary", failures);
requireText(plantOverview, "证据仍为 STALE，水流保持暂停", "B25 shadow must not become LIVE or infer flow", failures);
requireText(plantOverview, "isShadowTransportFresh", "B25 shadow transport timeout guard", failures);
requireText(plantOverview, "HARD_SHADOW_TRANSPORT_MAX_AGE_MS = 30_000", "B25 shadow hard transport-age cap", failures);
requireText(shadowSnapshotPairingPath, "const shadowEnvelopeReceivedAt = readExactNonEmptyString(summary?.pointEvidence?.receivedAt)", "B25 SHADOW same receivedAt envelope identity", failures);
requireText(shadowSnapshotPairingPath, "runningReceivedAt === shadowEnvelopeReceivedAt", "B25 SHADOW running feedback current-envelope membership", failures);
requireText(shadowSnapshotPairingPath, "frequencyReceivedAt === shadowEnvelopeReceivedAt", "B25 SHADOW frequency feedback same-envelope membership", failures);
requireText(shadowSnapshotPairingPath, "const replayPairIdentityPresent = replayPairFields.some(Boolean)", "B25 SHADOW optional replay-identity presence detection", failures);
requireText(shadowSnapshotPairingPath, "const replayPairIdentityComplete = replayPairFields.every(Boolean)", "B25 SHADOW optional replay-identity all-fields requirement", failures);
requireText(shadowSnapshotPairingPath, "!replayPairIdentityPresent\n          || (replayPairIdentityComplete && pairedSnapshotExact)", "B25 SHADOW absent-or-complete exact replay pair", failures);
requireText(shadowReadablePath, "&& pairedShadowSnapshotExact", "B25 same-envelope pair gates actual shadowReadable", failures);
requireText(liveReadablePath, "&& pairedSnapshotExact", "B25 bootId + scanCycleId pair gates actual LIVE evidence", failures);
requireText(plantOverview, 'data-animation-authority={demoAnimationEnabled', "B25 three-mode animation authority disclosure", failures);
requireText(plantOverview, 'data-flow-animation-evidence={demoAnimationEnabled ? "schematic-demo" : "unbound-paused"}', "B25 flow remains paused outside explicit demo", failures);
requireText(plantOverview, "演示动画不代表设备正在运行", "B25 demo does not claim operation", failures);

// Device business state, point-evidence state and animation mode are three
// independent contracts. A missing/expired/bad transport point must never be
// turned into a healthy-looking stopped or standby state.
for (const state of ["running", "fault", "stopped", "standby", "unknown"]) {
  requireText(plantOverview, `\"${state}\"`, `B25 equipment operational state ${state}`, failures);
  requireText(
    plantOverviewStyles,
    `.plant-overview-equipment-state.is-${state}`,
    `B25 equipment state visual ${state}`,
    failures
  );
}
requireText(plantOverview, "type EquipmentOperationalState", "B25 equipment business-state type", failures);
requireText(plantOverview, "type EquipmentStateEvidenceMode", "B25 equipment evidence-state type", failures);
requireText(plantOverview, "resolveEquipmentOperationalState", "B25 equipment state resolver", failures);
requireText(plantOverview, "readStrictBinaryValue", "B25 equipment state strict binary parser", failures);
requireText(plantOverview, "const faultActive = readStrictBinaryValue(faultPoint?.value)", "B25 explicit fault strict-binary value", failures);
requireText(plantOverview, "const remoteEnabled = readStrictBinaryValue(remoteEnabledPoint?.value)", "B25 explicit remote strict-binary value", failures);
requireText(plantOverview, "faultActive === true", "B25 explicit fault precedence", failures);
requireText(plantOverview, "running === true", "B25 explicit running state", failures);
requireText(plantOverview, "remoteEnabled === true", "B25 explicit standby state", failures);
requireText(plantOverview, "stopped_fault_clear_and_remote_disabled", "B25 explicit stopped state", failures);
requireText(plantOverview, "explicit_fault_signal_unavailable", "B25 missing fault evidence becomes UNKNOWN", failures);
requireText(plantOverview, "explicit_running_signal_unavailable", "B25 missing running evidence becomes UNKNOWN", failures);
requireText(plantOverview, "explicit_remote_signal_unavailable", "B25 missing remote evidence becomes UNKNOWN", failures);
requireText(plantOverview, "runtimeSignals?.faultTagName", "B25 exact fault selector join", failures);
requireText(plantOverview, "runtimeSignals?.remoteEnabledTagName", "B25 exact remote selector join", failures);
requireText(plantOverview, "findUniqueExactTagPoint", "B25 status selectors use exact unique points", failures);
requireText(plantOverview, "isShadowReadablePoint", "B25 SHADOW status point quality/TTL gate", failures);
requireText(plantOverview, '!qualityCode.startsWith("BAD")', "B25 BAD status point rejection", failures);
requireText(plantOverview, "isShadowTransportFresh", "B25 expired status transport rejection", failures);
requireText(plantOverview, "sourceReadOnlyHealthy", "B25 unhealthy source status rejection", failures);
requireText(plantOverview, "EQUIPMENT_STATE_COLORS", "B25 runtime-only status marker colors", failures);
requireText(plantOverview, "statusMarkersByEquipmentId", "B25 LOD-local equipment status markers", failures);
requireText(plantOverview, 'data-equipment-status-contract="operational-state-v1"', "B25 equipment status DOM contract", failures);
requireText(plantOverview, "data-equipment-status-marker-count=", "B25 54-marker count disclosure", failures);
forbidText(plantOverview, "createChillerStatusPlacardTexture", "B25 persistent in-model chiller status placard factory", failures);
forbidText(plantOverview, "CHILLER_STATUS_PLACARD_", "B25 persistent in-model chiller status placard sprites", failures);
requireText(plantOverview, "CHILLER_TOP_TO_BOTTOM_ORDER", "B25 explicit CH1-to-CH7 display order", failures);
requireText(plantOverview, "data-chiller-status-count=", "B25 seven-chiller status-count disclosure", failures);
requireText(plantOverview, 'data-chiller-row-order-contract="CH1-top-CH7-bottom"', "B25 CH1-top CH7-bottom row-order contract", failures);
requireText(plantOverview, 'data-chiller-status-display="compact-strip-and-docked-inspector-v3"', "B25 compact chiller strip and docked-inspector visual", failures);
requireText(plantOverview, 'data-chiller-persistent-model-placard-count="0"', "B25 zero persistent chiller placard disclosure", failures);
requireText(plantOverview, 'data-selected-equipment-detail-max-count="0"', "B25 no duplicated selected detail card in 3D HUD", failures);
requireText(plantOverview, 'data-device-hover-metric-mode="exact-device-primary-read-only-v1"', "B25 exact-device hover metric contract", failures);
requireText(plantOverview, 'data-process-metric-layout="world-projected-header-anchors-v1"', "B25 world-projected process metric anchors", failures);
requireText(scene, 'data-plant-device-inspector="docked-read-only-v1"', "B25 docked read-only inspector", failures);
requireText(scene, 'data-plant-device-inspector-control-tabs="0"', "B25 inspector zero control tabs", failures);
requireText(scene, "设备状态与参数仅按精确 deviceId + tagName 读取", "B25 exact metric identity disclosure", failures);
requireText(scene, "无启停、复位、频率设定入口", "B25 inspector visible no-control boundary", failures);
requireText(sceneStyles, ".scene-embed-stage.has-plant-device-inspector .scene-embed-plant-overview", "B25 viewport shrinks beside inspector", failures);
requireText(plantOverview, 'data-blank-canvas-clears-selection="true"', "B25 blank-canvas clear-selection contract", failures);
requireText(plantOverview, 'data-canvas-selection-event-order="pointer-and-click-capture-clear-before-three-pick-v2"', "B25 deterministic pointer/click clear-before-pick ordering", failures);
requireText(plantOverview, 'data-chiller-status-strip-mode="glyph-id-tooltip-v2"', "B25 compact glyph and equipment-id strip contract", failures);
forbidText(plantOverview, "<small>{EQUIPMENT_STATE_LABELS[decision.state]}</small>", "B25 duplicated compact-strip state text", failures);
for (const state of ["running", "fault", "stopped", "standby", "unknown"]) {
  requireText(
    plantOverview,
    `data-equipment-${state}-count=`,
    `B25 equipment ${state} count disclosure`,
    failures
  );
}
requireText(plantOverview, "data-selected-equipment-status=", "B25 selected equipment state disclosure", failures);
requireText(plantOverview, "data-selected-equipment-status-evidence=", "B25 selected equipment evidence disclosure", failures);
requireText(plantOverview, 'data-equipment-status-visual="base-lightband-corner-frame-v1"', "B25 base-lightband and corner-frame status visual contract", failures);
requireText(plantOverview, 'data-equipment-body-status-visual="pbr-preserving-selective-light-tint-v1"', "B25 selective PBR equipment-body tint contract", failures);
requireText(plantOverview, "data-equipment-body-tint-count=", "B25 54-target equipment-body tint count disclosure", failures);
requireText(plantOverview, 'data-equipment-body-tint-parity={bodyTintCount === EXPECTED_CORE_EQUIPMENT_IDS.length ? "PASS" : "FAIL"}', "B25 equipment-body tint parity", failures);
requireText(plantOverview, "data-equipment-body-tint-material-count=", "B25 selective painted-material count disclosure", failures);
requireText(plantOverview, 'data-equipment-body-tint-scope="painted-shell-only-excludes-pipes-flanges-instruments-shafts-and-guards"', "B25 process and safety material exclusion scope", failures);
requireText(plantOverview, 'data-equipment-body-tint-runtime-only="true"', "B25 body tint runtime-only boundary", failures);
requireText(plantOverview, 'data-equipment-body-tint-fault-pulse-only="true"', "B25 body tint FAULT-only pulse boundary", failures);
requireText(bodyTintCreationPath, "sourcePbrMaterial.clone()", "B25 shared PBR materials cloned before tint", failures);
requireText(bodyTintCreationPath, "const isReviewedLatestModel", "B25 body tint restricted to reviewed latest equipment mesh", failures);
requireText(bodyTintCreationPath, 'object.name.toUpperCase().endsWith("__LATEST_MODEL")', "B25 reviewed latest-model GLTF node-name fallback", failures);
requireText(bodyTintCreationPath, "if (!meshObject.geometry || !meshObject.material)", "B25 cross-bundle GLTF mesh capability check", failures);
requireText(bodyTintCreationPath, "const isPbrMaterial = sourcePbrMaterial.isMeshStandardMaterial === true", "B25 GLTF PBR runtime material capability check", failures);
requireText(bodyTintCreationPath, "sourcePbrMaterial.color?.isColor === true", "B25 structural PBR material fallback", failures);
for (const materialName of ["MAT_PAINTED_TEAL", "MAT_PUMP_INDUSTRIAL_BLUE", "MAT_FRP_PANEL_COOLGRAY"]) {
  requireText(plantOverview, `"${materialName}"`, `B25 approved body-tint material ${materialName}`, failures);
}
for (const excludedMaterialName of ["MAT_RUBBER", "MAT_COUPLING_GUARD_YELLOW", "MAT_FASTENER_STEEL", "MAT_CONDENSER_WATER_PIPE", "MAT_FAN_BLADE"]) {
  forbidText(plantOverview, `"${excludedMaterialName}"`, `B25 excluded body-tint material ${excludedMaterialName}`, failures);
}
requireText(statusBadgePath, "loaded.bodyTintsByEquipmentId.forEach", "B25 all active-LOD body tint targets enter status path", failures);
requireText(statusBadgePath, "EQUIPMENT_BODY_TINT_STRENGTHS[state]", "B25 restrained state-specific body tint strengths", failures);
requireText(plantOverview, "baseLightband", "B25 real equipment-base lightband marker primitive", failures);
requireText(plantOverview, "cornerFrame", "B25 real four-corner frame marker primitive", failures);
requireText(plantOverview, "EQUIPMENT_STATE_SHAPES", "B25 non-color status shape mapping", failures);
for (const shape of ["running-play", "fault-alert", "standby-pause", "stopped-square", "unknown-question"]) {
  requireText(plantOverview, `"${shape}"`, `B25 equipment shape ${shape}`, failures);
}
requireText(plantOverview, "applyEquipmentStatusFilter", "B25 filter-only marker dimming path", failures);
requireText(plantOverview, "const filterOpacity = matchesFilter ? 1 : 0.16", "B25 nonmatching marker opacity reduction", failures);
requireText(plantOverview, "marker.root.visible = true", "B25 filtering retains every equipment marker", failures);
requireText(plantOverview, 'marker.baseLightband.visible = evidenceMode === "live"', "B25 LIVE continuous base-lightband visual", failures);
requireText(plantOverview, 'marker.cornerFrame.visible = evidenceMode !== "live"', "B25 hollow/segmented non-LIVE corner-frame visual", failures);
requireText(plantOverview, 'const lodScale = visualContext.activeLod === "LOD0"', "B25 LOD status-semantic scaling", failures);
requireText(statusBadgePath, "loaded.statusMarkersByEquipmentId.forEach", "B25 all 54 active-LOD markers enter badge path", failures);
requireText(statusBadgePath, 'const lodScale = visualContext.activeLod === "LOD0"', "B25 LOD only scales five-state badges", failures);
requireText(statusBadgePath, "marker.badge.scale.set", "B25 LOD scale reaches actual badge", failures);
requireText(statusBadgePath, "marker.badge.visible = true", "B25 all five-state badges stay visible in LOD0/1/2", failures);
requireText(statusBadgePath, "EQUIPMENT_STATE_SHAPES[state].contract", "B25 always-visible badge keeps non-color shape semantics", failures);
forbidText(statusBadgePath, "showBadge", "B25 LOD must not conditionally hide running/standby/stopped badges", failures);
requireText(plantOverview, "navigateEquipmentAnomaly", "B25 read-only anomaly navigation", failures);
requireText(plantOverview, "data-equipment-status-filter=", "B25 active status filter disclosure", failures);
requireText(plantOverview, "data-equipment-filter-match-count=", "B25 filter match-count disclosure", failures);
requireText(plantOverview, 'data-equipment-counts-invariant={equipmentCountsInvariant ? "PASS" : "FAIL"}', "B25 filtering leaves exactly 54 state counts or fails visibly", failures);
requireText(plantOverview, "data-equipment-anomaly-navigation=", "B25 anomaly navigation disclosure", failures);
requireText(plantOverview, "data-equipment-status-lod-semantic-scaling=", "B25 LOD semantic-scaling disclosure", failures);
requireText(plantOverview, 'data-camera-fit="reference-angle-bottom-safe-obb-fit-v6"', "B25 reference-angle bottom-safe OBB camera fit", failures);
requireText(plantOverview, 'data-camera-fit-geometry="visible-mesh-obb-corners"', "B25 real visible-mesh camera fit disclosure", failures);
requireText(plantOverview, "collectVisibleMeshFitPoints", "B25 camera fit excludes empty global AABB corners without clipping meshes", failures);
requireText(plantOverview, 'data-camera-default-view="tower-left-chiller-center-manifold-right-v5"', "B25 reference initial camera contract", failures);
requireText(plantOverview, "const DEFAULT_CAMERA_VIEW_DIRECTION = new Vector3(18, 25, 34).normalize();", "B25 actual reference camera vector", failures);
requireText(plantOverview, 'data-camera-default-direction={DEFAULT_CAMERA_VIEW_DIRECTION_CONTRACT}', "B25 exact default camera direction disclosure", failures);
requireText(plantOverview, 'data-camera-initial-composition="wide-scale-0.89-y-responsive-minus60to96px-more-topdown-bottom-safe-mobile-conservative"', "B25 exact reference composition disclosure", failures);
requireText(plantOverview, 'data-camera-overlay-layout="compact-two-row-v1"', "B25 compact two-row camera overlay disclosure", failures);
requireText(plantOverview, "resolveCameraInitialComposition(viewportWidth, viewportHeight)", "B25 responsive initial camera composition", failures);
requireText(plantOverview, "Math.max(60, Math.round(viewportHeight * 0.087))", "B25 responsive wide-screen bottom-safe vertical offset", failures);
requireText(plantOverview, "return { distanceScale: 0.89, verticalOffsetPx: wideVerticalOffsetPx }", "B25 reference camera scale and bottom-safe vertical offset", failures);
requireText(plantOverviewStyles, ".plant-overview-overlay-stack.is-default-compact", "B25 compact default title overlay", failures);
requireText(plantOverviewStyles, 'grid-template-areas:\n      "quality filters"\n      "anomalies chillers"', "B25 compact two-row status HUD", failures);
requireText(plantOverview, "DEFAULT_CAMERA_VIEW_DIRECTION", "B25 shared reviewed camera direction", failures);
requireText(plantOverviewStyles, ".plant-overview-chiller-status-strip", "B25 visible ordered chiller status strip", failures);
requireText(plantOverviewStyles, ".plant-overview-chiller-status.is-shadow", "B25 chiller SHADOW non-color styling", failures);
requireText(plantOverview, 'data-selected-equipment-status-duration="unavailable"', "B25 selected-device duration unavailable without changedAt", failures);
requireText(plantOverview, 'data-selected-equipment-status-duration-basis="missing-authoritative-changed-at"', "B25 selected-device duration missing authoritative basis", failures);
requireText(scene, "无权威 changedAt", "B25 visible unavailable status duration", failures);
forbidText(plantOverview, "SESSION_STATUS_FIRST_SEEN", "B25 must not fabricate state duration from the page session", failures);
forbidText(plantOverview, "data-selected-equipment-status-duration-seconds", "B25 must not expose invented state-duration seconds", failures);
requireText(plantOverview, "data-equipment-status-shape=", "B25 per-equipment shape semantic", failures);
requireText(plantOverview, "data-equipment-filter-match=", "B25 per-equipment filter match", failures);
requireText(plantOverview, "data-equipment-alarm-state=", "B25 alarm lifecycle separate from business state", failures);
requireText(plantOverview, "data-equipment-diagnostic-state=", "B25 diagnostics separate from business state", failures);
requireText(scene, "告警记录", "B25 selected-device alarm lifecycle visibly separate", failures);
requireText(scene, "诊断结论", "B25 selected-device diagnostics visibly separate", failures);
requireText(plantOverview, 'marker.state === "fault"', "B25 FAULT-only status pulse", failures);
requireText(plantOverview, 'bodyTint.state === "fault"', "B25 FAULT-only equipment-body emissive pulse", failures);
forbidText(plantOverview, ': marker.state === "standby"', "B25 STANDBY status layer must not pulse", failures);
forbidText(plantOverview, ': marker.state === "running"', "B25 RUNNING status layer must not pulse", failures);
for (const attribute of [
  "data-equipment-id=",
  "data-equipment-operational-state=",
  "data-equipment-state-evidence=",
  "data-equipment-state-authority=",
  "data-equipment-state-reason="
]) {
  requireText(plantOverview, attribute, `B25 per-equipment read-only state ${attribute}`, failures);
}
requireText(plantOverviewStyles, ".plant-overview-equipment-state.is-shadow", "B25 SHADOW status marker visual", failures);
requireText(plantOverviewStyles, ".plant-overview-status-filter", "B25 status filter visual", failures);
requireText(plantOverviewStyles, ".plant-overview-anomaly-navigation", "B25 anomaly navigation visual", failures);
requireText(sceneStyles, ".scene-embed-plant-device-kpis", "B25 unavailable status duration visual", failures);
requireText(plantOverviewStyles, ".is-filter-dimmed", "B25 nonmatching status dimming visual", failures);
requireText(plantOverview, "时效不可证", "B25 SHADOW equipment state disclosure", failures);
requireText(plantOverview, "EXPECTED_CORE_EQUIPMENT_IDS", "B25 54 core status-marker identity set", failures);
requireText(plantOverview, 'stateResolution.state === "running"', "B25 non-running business states stop mechanical runtime motion", failures);
requireText(hoverRaycastPath, "activeModel.statusMarkersByEquipmentId.values()", "B25 hover uses only 54 lightweight status proxies", failures);
requireText(hoverRaycastPath, ".map((marker) => marker.root)", "B25 hover maps lightweight marker roots", failures);
requireText(hoverRaycastPath, "raycaster.intersectObjects(statusMarkerRoots, true)", "B25 hover raycasts marker proxies only", failures);
requireText(hoverRaycastPath, "if (hoverRaycastFrame === 0)", "B25 pointermove hover has one pending-frame gate", failures);
requireText(hoverRaycastPath, "window.requestAnimationFrame(updateHoverCursor)", "B25 pointermove hover is requestAnimationFrame-throttled", failures);
forbidText(hoverRaycastPath, "intersectObject(activeModel.root, true)", "B25 pointermove hover must not recurse full high-poly plant", failures);
forbidText(plantOverview, "runtimeSummary.groups", "B25 grouped summary must not drive equipment state", failures);
forbidText(plantOverview, "runtimeSummary?.groups", "B25 optional grouped summary must not drive equipment state", failures);
forbidText(plantOverview, "summary.groups", "B25 grouped summary alias must not drive equipment state", failures);
forbidText(plantOverview, "summary?.groups", "B25 optional grouped summary alias must not drive equipment state", failures);
forbidText(plantOverview, "generatedAt", "B25 generatedAt must never become point observedAt", failures);
forbidText(plantOverview, "SHADOW 实时", "B25 shadow must not claim realtime", failures);
forbidText(plantOverview, "SHADOW LIVE", "B25 shadow must not claim LIVE", failures);
forbidText(plantOverview, "runtimeSummaryRef", "B25 stale summary must not directly drive animation", failures);
forbidText(plantOverview, "resolveRuntimeSignal", "B25 non-authoritative telemetry must not enter live animation", failures);
forbidText(plantOverview, "findUniqueSemanticPoint", "B25 semantic keyword matching must not become authoritative", failures);

for (const state of ["live", "stale", "degraded", "offline", "sample", "unknown"]) {
  requireText(truthBadges, `${state}:`, `truth state ${state}`, failures);
}
requireText(statusTone, "EXPLICIT_NO_ALARM_KEYWORDS", "no-alarm tone precedence", failures);
requireText(statusTone, '"disconnected"', "disconnected warning tone", failures);

requireText(appShell, 'inert={isCompactViewport && !isMobileNavOpen ? true : undefined}', "closed mobile navigation inert", failures);
requireText(appShell, 'event.key === "Escape"', "mobile navigation escape close", failures);
requireText(dashboardMobile, "grid-template-columns: repeat(2, minmax(0, 1fr))", "dashboard mobile KPI grid", failures);
requireText(dashboardMobile, ".dashboard-mobile-system-summary", "dashboard mobile system summary", failures);
requireText(dashboardMobile, "min-height: 44px", "dashboard mobile touch target", failures);
requireText(dashboardMobile, "Multi-station mobile information hierarchy", "dashboard station-first mobile hierarchy", failures);
requireText(dashboardMobile, ".dashboard-subsystem-strip", "dashboard mobile subsystem workspace", failures);
requireText(projectMobile, "grid-template-columns: minmax(0, 1fr)", "project mobile single-column grid", failures);
requireText(projectMobile, "min-height: 44px", "project mobile touch target", failures);
requireText(appShellMobile, ".mobile-nav-toggle", "mobile shell menu target", failures);
requireText(appShellMobile, "min-height: 44px", "mobile shell touch target", failures);
requireText(appShellMobile, "Mobile menu icon geometry guard", "mobile shell menu icon geometry marker", failures);
requireText(appShellMobile, "flex-direction: column !important;", "mobile shell menu strokes must remain stacked", failures);
requireText(appShellMobile, "Multi-station compact mobile shell", "multi-station compact mobile shell", failures);
requireText(appShellMobile, "min-height: 110px", "compact mobile topbar height", failures);
requireText(dashboardMobile, "Mobile dashboard trust-bar density guard", "dashboard mobile trust metadata density marker", failures);
requireText(dashboardMobile, ".operational-truth-badge:nth-child(2)", "dashboard mobile source-time full-row guard", failures);
requireText(dashboardMobile, "min-height: 32px !important;", "dashboard mobile non-interactive status density", failures);
requireText(appShellStationStyles, "Notebook workspace active-label guard", "notebook current workspace label", failures);
requireText(appShellStationStyles, ".station-workspace-link.active > span:not(.station-workspace-count)", "notebook current workspace visible label selector", failures);
requireText(appShellRoleStyles, "Desktop shell readability floor", "operator-perspective desktop text floor", failures);
requireText(appShellStationStyles, "Desktop shell readability floor", "station-shell desktop text floor", failures);
requireText(dashboardStyles, "Desktop operational typography floor", "dashboard operational text floor", failures);
requireText(aiOverviewStyles, "Desktop operational typography floor", "AI operational text floor", failures);
requireText(plantOverviewStyles, "Desktop operational typography floor", "plant overview operational text floor", failures);
requireText(appShell, 'key: "operations"', "multi-station operations module", failures);
requireText(stationNavigation, 'defaultTo: "/boiler-room"', "boiler room navigation", failures);
requireText(appShell, "data-shell-station-link", "left station navigation", failures);
requireText(appShell, 'className="nav-project-title"', "single page-heading hierarchy", failures);
requireText(appShell, 'location.pathname === "/scene-control" || location.pathname === "/auto-twin"', "scene preload route guard", failures);
requireText(compactMobileSafety, ".report-record-table-shell", "mobile report table scroll boundary", failures);
requireText(compactMobileSafety, ".energy-efficiency-tabs", "mobile energy-efficiency tab scroll boundary", failures);
requireText(compactMobileSafety, "Energy-efficiency lazy CSS mobile width guard", "mobile energy-efficiency lazy CSS width guard", failures);
requireText(compactMobileSafety, "Energy-efficiency mobile sequential-flow guard", "mobile energy-efficiency sequential-flow guard", failures);
requireText(compactMobileSafety, "Energy-efficiency mobile KPI reflow", "mobile energy-efficiency KPI reflow guard", failures);
requireText(compactMobileSafety, "Energy-efficiency mobile calendar flow", "mobile energy-efficiency calendar natural-height guard", failures);
requireText(compactMobileSafety, "flex: 0 0 auto !important;", "mobile energy-efficiency KPI grid must not shrink into following content", failures);
requireText(compactMobileSafety, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important;", "mobile energy-efficiency two-column KPI grid", failures);
requireText(compactMobileSafety, "Cold-log mobile table boundary", "mobile cold-log horizontal-scroll guard", failures);
requireText(compactMobileSafety, ".cold-log-table-scroll-hint", "mobile cold-log scroll hint", failures);
requireText(compactMobileSafety, "grid-auto-columns: minmax(0, 1fr) !important;", "mobile energy-efficiency single-column clamp", failures);
requireText(compactMobileSafety, ".operation-record-workspace", "mobile operation-record workspace reflow", failures);
requireText(compactMobileSafety, "min-height: 44px !important;", "shared mobile compact-page touch target", failures);
requireText(compactMobileSafety, "Lazy page CSS mobile cascade guard", "lazy page CSS mobile cascade guard", failures);
requireText(compactMobileSafety, ".energy-analysis-compact-page-v2,", "energy-analysis lazy CSS mobile cascade guard", failures);
requireText(compactMobileSafety, "Energy-analysis mobile density guard", "energy-analysis mobile density guard", failures);
requireText(compactMobileSafety, "Power/device lazy CSS mobile flow guard", "power and device lazy CSS mobile flow guard", failures);
requireText(compactMobileSafety, ".hvac-terminal-page,", "HVAC terminal lazy CSS mobile cascade guard", failures);
requireText(compactMobileSafety, ".trend-analysis-page--effect", "trend-analysis lazy CSS mobile cascade guard", failures);
requireText(compactMobileSafety, "display: flex !important;", "lazy page mobile sequential flow", failures);
requireText(compactMobileSafety, "grid-template-rows: none !important;", "lazy page desktop row reset", failures);
requireText(compactMobileSafety, "grid-auto-rows: minmax(64px, auto) !important;", "mobile metric natural row sizing", failures);
requireText(loginMobile, ".login-card", "mobile login card layout", failures);
requireText(loginMobile, "order: -1", "mobile login form-first order", failures);
requireText(loginMobile, "min-height: 44px", "mobile login touch target", failures);
requireText(loginPage, 'name="username"', "login username form name", failures);
requireText(loginPage, 'name="password"', "login password form name", failures);
requireText(loginPage, "required", "login required-field validation", failures);
requireText(loginPage, 'role="alert"', "login error accessibility alert", failures);
requireText(loginPage, 'aria-live="polite"', "login error announcement", failures);

requireText(controlPolicy, "站点批准参数", "shared approved control policy source", failures);
requireText(dashboard, "controlPolicyPresentation", "dashboard shared control policy", failures);
requireText(systemOverview, "controlPolicyPresentation", "system overview shared control policy", failures);
forbidText(dashboard, "目标 8.5-9.0°C，上限 9.2°C", "dashboard hard-coded chilled-water boundary", failures);
forbidText(dashboard, "泵 ≥35Hz，塔风机 ≥30Hz", "dashboard hard-coded frequency boundary", failures);
forbidText(systemOverview, "<strong>7.5°C</strong>", "system overview hard-coded chilled-water boundary", failures);

requireText(aiOverview, "暂无可评审的 AI 优化建议", "AI offline recommendation block", failures);
requireText(aiOverview, "趋势数据待接入", "AI trend evidence block", failures);
requireText(aiOverview, "不写 PLC", "AI subsystem boundary localized no-write label", failures);
requireText(stationWorkspacePresentation, "formatControlBoundaryMode", "shared localized control-boundary presentation", failures);
requireText(plantOverview, "影子（SHADOW）", "plant overview localized evidence label", failures);
forbidText(aiOverview, "PLC安全边界在线", "AI unverified PLC online claim", failures);
forbidText(aiOverview, 'd="M0 88 L60 78', "AI static COP trend", failures);

requireText(boilerRoom, "data-boiler-room-workspace", "boiler room workspace", failures);
requireText(boilerRoom, "不写 PLC", "boiler room no-write boundary", failures);
requireText(boilerRoom, "AI 只输出目标值建议", "boiler room advisory-only boundary", failures);
requireText(boilerRoom, 'subsystemType === "boiler_room"', "boiler room capability binding", failures);

if (failures.length > 0) {
  console.error("Operational truth UI contract failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Operational truth UI contract passed.");
console.log("- checked shared LIVE/STALE/DEGRADED/OFFLINE/SAMPLE/UNKNOWN states");
console.log("- checked dashboard, alarm and device truth rendering");
console.log("- checked read-only, scene control and optimize permission fail-closed guards");
console.log("- checked B25 LIVE/SHADOW/DEMO display boundaries and shadow-only flow pause");
console.log("- checked B25 business state is separate from evidence/DEMO with a RUNNING-only motion gate");
console.log("- checked base-lightband/corner-frame shapes, FAULT-only pulse, dim-only filters and anomaly navigation");
console.log("- checked unavailable duration does not fabricate changedAt/observedAt and alarm/diagnostic facts remain separate");
console.log("- checked SHADOW same-envelope pump/fan pairing, all-LOD five-state badges and proxy-only throttled hover");
console.log("- checked unknown alarm/readiness states do not render as healthy");
console.log("- checked mobile single-column layout, touch targets and hidden-navigation focus guard");
console.log("- checked desktop operational text floors and notebook current-workspace recognition");
console.log("- checked localized control-boundary, evidence and no-write presentation");

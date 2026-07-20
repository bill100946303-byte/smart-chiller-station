import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHELL_ROOT = path.resolve(SCRIPT_DIR, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(SHELL_ROOT, relativePath), "utf8");
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertNotContains(source, needle, message) {
  if (source.includes(needle)) {
    throw new Error(message);
  }
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function sliceBetween(source, startNeedle, endNeedle, message) {
  const start = source.indexOf(startNeedle);
  const end = start < 0 ? -1 : source.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(message);
  }
  return source.slice(start, end);
}

const appSource = read("src/App.tsx");
const shellSource = read("src/layout/AppShell.tsx");
const stationNavigationSource = read("src/config/energyStationNavigation.ts");
const pageSource = read("src/pages/AutoTwinPage.tsx");
const sceneControlSource = read("src/pages/SceneControlPage.tsx");
const bffClientSource = read("src/services/bffClient.ts");
const sceneControlStyleSource = read("src/pages/SceneControlExtracted.css");
const diagramSource = read("src/components/scene3d/SystemDiagram3D.tsx");
const plantOverviewSource = read("src/components/scene3d/PlantOverview3D.tsx");
const plantOverviewStyleSource = read("src/components/scene3d/PlantOverview3D.css");
const plantOverview2dSource = read("src/components/scene3d/PlantOverview2D.tsx");
const plantOverview2dStyleSource = read("src/components/scene3d/PlantOverview2D.css");
const plantOverviewRegistrySource = read("src/config/plantOverviewRegistry.ts");
const typesSource = read("src/components/scene3d/systemDiagramTypes.ts");
const schematicSource = read("src/components/scene3d/SystemDiagram2D.tsx");
const flowSource = read("src/components/scene3d/systemDiagramFlow.ts");
const inspectorSource = read("src/components/scene3d/SystemDiagramInspector.tsx");
const sampleSource = read("src/components/scene3d/systemDiagramContractSample.ts");
const styleSource = read("src/styles/auto-twin.css");
const mobileTouchSource = read("src/pages/AutoTwinMobileTouch.css");
const modelManifest = JSON.parse(read("public/models/model-manifest-v1.json"));
const b25BindingContract = JSON.parse(
  read("public/models/plant-overview/bindings/b25-plant-overview-binding-v2.json")
);
const runtimePlanPath = sliceBetween(
  plantOverviewSource,
  "function buildRuntimeAnimationPlan(",
  "function resolveLodPath(",
  "B25 runtime plan implementation path must remain statically inspectable."
);
const shadowSnapshotPairingPath = sliceBetween(
  runtimePlanPath,
  "const shadowEnvelopeReceivedAt =",
  "const shadowReadable =",
  "B25 SHADOW running/frequency snapshot-pairing path must remain explicit."
);
const shadowReadablePath = sliceBetween(
  runtimePlanPath,
  "const shadowReadable =",
  "const evidenceLive =",
  "B25 SHADOW readable gate must remain explicit."
);
const liveReadablePath = sliceBetween(
  runtimePlanPath,
  "const evidenceLive =",
  "const statePoints =",
  "B25 LIVE running/frequency evidence gate must remain explicit."
);
const statusBadgePath = sliceBetween(
  plantOverviewSource,
  "function applyEquipmentStatusFilter(",
  "function animateRuntimeStatusMarkers(",
  "B25 LOD status-badge rendering path must remain statically inspectable."
);
const bodyTintCreationPath = sliceBetween(
  plantOverviewSource,
  "function createRuntimeEquipmentBodyTints(",
  "function createRuntimeStatusMarkers(",
  "B25 runtime-only equipment-body tint creation path must remain statically inspectable."
);
const hoverRaycastPath = sliceBetween(
  plantOverviewSource,
  "const updateHoverCursor = () => {",
  'renderer.domElement.addEventListener("pointerdown", handlePointerDown);',
  "B25 hover raycast path must remain statically inspectable."
);
const runtimeSignalBindings = b25BindingContract.runtimeSignalBindings;
const operationalStatePolicy = b25BindingContract.operationalStatePolicy;
const twoDimensionalAsset = b25BindingContract.assets?.twoDimensional;
const reviewedChillerLoadTags = Array.from({ length: 7 }, (_, index) => (
  runtimeSignalBindings?.signals?.[`CH${index + 1}`]?.loadPercentTagName
));
if (
  reviewedChillerLoadTags.some((tagName) => typeof tagName !== "string" || !tagName.startsWith("SY-"))
  || new Set(reviewedChillerLoadTags).size !== 7
) {
  throw new Error("B25 seven chiller load parameters must retain unique reviewed point-table tag names.");
}
if (
  twoDimensionalAsset?.path !== "/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg"
  || twoDimensionalAsset?.presentation !== "physical-scada-2.5d"
  || twoDimensionalAsset?.runtimeBinding !== "runtime-read-only-exact"
  || twoDimensionalAsset?.runtimeParameterBindings !== 54
  || twoDimensionalAsset?.operationalStatePresentation !== "five-state-color-plus-glyph"
  || twoDimensionalAsset?.deviceInspector !== "shared-docked-read-only-v1"
  || twoDimensionalAsset?.flowEvidence !== "schematic"
  || twoDimensionalAsset?.controlBoundary !== "visualization_only_no_ba_plc_write"
) {
  throw new Error("B25 local 2D asset must remain physical, exact read-only runtime-bound, schematic-flow and no-write.");
}
if (
  operationalStatePolicy?.status !== "READ_ONLY_VISUAL_CLASSIFICATION"
  || operationalStatePolicy?.authoritative !== false
  || JSON.stringify(operationalStatePolicy?.requiredSignals) !== JSON.stringify(["running", "fault", "remoteEnabled"])
  || JSON.stringify(operationalStatePolicy?.strictBinaryValues) !== JSON.stringify([false, true, 0, 1, "0", "1"])
  || operationalStatePolicy?.missingInvalidOrConflictingState !== "UNKNOWN"
  || operationalStatePolicy?.motionRule !== "only RUNNING may animate equipment; FAULT, STANDBY, STOPPED and UNKNOWN remain mechanically stopped"
  || operationalStatePolicy?.controlBoundary !== "visualization_only_no_ba_plc_write"
) {
  throw new Error("B25 operational-state policy must remain strict-binary, fail-closed, RUNNING-only motion and no-write.");
}
if (
  operationalStatePolicy?.presentation?.equipmentBodyStatusVisual !== "pbr-preserving-selective-light-tint-v1"
  || operationalStatePolicy?.presentation?.equipmentBodyTintTargets !== 54
  || operationalStatePolicy?.presentation?.equipmentBodyTintRuntimeOnly !== true
  || operationalStatePolicy?.presentation?.equipmentBodyTintFaultPulseOnly !== true
  || operationalStatePolicy?.presentation?.coolingTowerStatusGranularity !== "individual-fan-cell"
  || operationalStatePolicy?.presentation?.chillerPersistentModelPlacards !== 0
  || operationalStatePolicy?.presentation?.chillerStatusStripItems !== 7
  || operationalStatePolicy?.presentation?.chillerStatusStripMode !== "glyph-id-tooltip-v2"
  || operationalStatePolicy?.presentation?.selectedEquipmentDetailCardsMax !== 0
  || operationalStatePolicy?.presentation?.deviceInspectorMode !== "docked-read-only-v1"
  || operationalStatePolicy?.presentation?.deviceInspectorWidthPx !== 360
  || JSON.stringify(operationalStatePolicy?.presentation?.deviceInspectorTabs) !== JSON.stringify(["overview", "trend", "diagnostics", "asset"])
  || operationalStatePolicy?.presentation?.deviceInspectorControlTabs !== 0
  || operationalStatePolicy?.presentation?.deviceInspectorMetricIdentityRule !== "exact_deviceId_plus_tagName_only"
  || operationalStatePolicy?.presentation?.deviceInspectorBlankCanvasAndEscapeClose !== true
  || operationalStatePolicy?.presentation?.deviceHoverMetricMode !== "exact-device-primary-read-only-v1"
  || operationalStatePolicy?.presentation?.processMetricAnchorMode !== "world-projected-header-anchors-v1"
  || operationalStatePolicy?.presentation?.processMetricAnchorCount !== 7
  || operationalStatePolicy?.presentation?.blankCanvasClearsSelection !== true
) {
  throw new Error("B25 state visual must retain 54 body tints, zero persistent/detail placards, a compact strip, seven process anchors and one read-only docked inspector.");
}
if (
  operationalStatePolicy?.presentation?.cameraDefaultView !== "tower-left-chiller-center-manifold-right-v5"
  || JSON.stringify(operationalStatePolicy?.presentation?.cameraDefaultDirection) !== JSON.stringify([18, 25, 34])
  || operationalStatePolicy?.presentation?.cameraFit !== "reference-angle-bottom-safe-obb-fit-v6"
  || operationalStatePolicy?.presentation?.cameraOverlayLayout !== "compact-two-row-v1"
  || operationalStatePolicy?.presentation?.cameraWideInitialDistanceScale !== 0.89
  || JSON.stringify(operationalStatePolicy?.presentation?.cameraWideInitialVerticalOffsetPxRange) !== JSON.stringify([-96, -60])
  || operationalStatePolicy?.presentation?.cameraWideInitialVerticalOffsetPolicy !== "height-proportional-clamp-60-96px-v1"
  || operationalStatePolicy?.presentation?.cameraMobileFitPolicy !== "conservative-no-crop"
) {
  throw new Error("B25 camera presentation must retain the reviewed compact-HUD wide composition and conservative mobile fit.");
}
if (runtimeSignalBindings?.status !== "POINT_TABLE_DERIVED_READ_ONLY") {
  throw new Error("B25 runtime signal selectors must retain the reviewed point-table-derived status.");
}
if (runtimeSignalBindings?.authoritative !== false) {
  throw new Error("B25 runtime signal selectors must remain explicitly read-only and non-authoritative.");
}
if (runtimeSignalBindings?.selectorConfidence !== "point_table_exact_read_only") {
  throw new Error("B25 runtime signal selectors must retain exact point-table selector confidence.");
}
const runtimeSemanticBoundary = String(runtimeSignalBindings?.semanticBoundary || "");
for (const requiredBoundary of [
  "LIVE requires authoritative point time, GOOD quality and replay proof",
  "SHADOW may use only exact unique legacy values",
  "30-second received-envelope TTL",
  "remains STALE/UNVERIFIED",
  "never drives flow",
  "never satisfies runtime acceptance"
]) {
  if (!runtimeSemanticBoundary.includes(requiredBoundary)) {
    throw new Error(`B25 runtime selector semantic boundary is missing: ${requiredBoundary}.`);
  }
}
const runtimeTagAliasRule = runtimeSignalBindings?.runtimeTagAliasRule;
if (
  runtimeTagAliasRule?.status !== "REVIEWED_EXACT_TRANSPORT_ALIAS"
  || runtimeTagAliasRule?.pointTablePrefix !== "SY-"
  || runtimeTagAliasRule?.runtimePrefixSource !== "runtimeId"
) {
  throw new Error("B25 runtime selectors must retain the reviewed SY-to-runtimeId exact transport alias.");
}
const runtimeSignals = Object.values(runtimeSignalBindings?.signals || {});
const runningTags = runtimeSignals.map((signal) => String(signal?.runningTagName || "").trim()).filter(Boolean);
const faultTags = runtimeSignals.map((signal) => String(signal?.faultTagName || "").trim()).filter(Boolean);
const remoteEnabledTags = runtimeSignals.map((signal) => String(signal?.remoteEnabledTagName || "").trim()).filter(Boolean);
const frequencyTags = runtimeSignals.map((signal) => String(signal?.frequencyTagName || "").trim()).filter(Boolean);
const operationalStateTags = [...runningTags, ...faultTags, ...remoteEnabledTags];
const allRuntimeSignalTags = [...operationalStateTags, ...frequencyTags];
if (runtimeSignals.length !== 54 || runningTags.length !== 54 || new Set(runningTags).size !== 54) {
  throw new Error("B25 runtime selectors must contain 54 unique exact running tags.");
}
if (faultTags.length !== 54 || new Set(faultTags).size !== 54) {
  throw new Error("B25 operational-state selectors must contain 54 unique exact explicit fault tags.");
}
if (remoteEnabledTags.length !== 54 || new Set(remoteEnabledTags).size !== 54) {
  throw new Error("B25 operational-state selectors must contain 54 unique exact remote-enabled tags.");
}
if (operationalStateTags.length !== 162 || new Set(operationalStateTags).size !== 162) {
  throw new Error("B25 operational-state contract must contain 162 globally unique exact selectors (54 running + 54 fault + 54 remote).");
}
if (frequencyTags.length !== 47 || new Set(frequencyTags).size !== 47) {
  throw new Error("B25 pump/fan runtime selectors must contain 47 unique exact frequency tags.");
}
if (allRuntimeSignalTags.length !== 209 || new Set(allRuntimeSignalTags).size !== 209) {
  throw new Error("B25 runtime contract must contain 209 globally unique exact selectors (162 state + 47 frequency).");
}
if (!allRuntimeSignalTags.every((tagName) => tagName.startsWith("SY-"))) {
  throw new Error("B25 point-table selectors must all use the reviewed SY- transport prefix.");
}
const runtimeSignalEntries = Object.entries(runtimeSignalBindings?.signals || {});
const resolvedRuntimeTags = runtimeSignalEntries.flatMap(([runtimeId, signal]) => (
  [
    signal?.runningTagName,
    signal?.faultTagName,
    signal?.remoteEnabledTagName,
    signal?.frequencyTagName
  ]
    .filter(Boolean)
    .map((tagName) => `${runtimeId}-${String(tagName).slice("SY-".length)}`)
));
if (resolvedRuntimeTags.length !== 209 || new Set(resolvedRuntimeTags).size !== 209) {
  throw new Error("B25 runtime selectors must resolve to 209 globally unique exact transport tags.");
}
const verifiedRuntimeTagAliasExamples = runtimeTagAliasRule.verifiedExamples || [];
if (verifiedRuntimeTagAliasExamples.length < 4) {
  throw new Error("B25 runtime transport alias must retain the reviewed cross-equipment examples.");
}
for (const example of verifiedRuntimeTagAliasExamples) {
  const resolved = `${example.runtimeId}-${String(example.pointTableCode || "").slice("SY-".length)}`;
  if (!example.pointTableCode?.startsWith("SY-") || resolved !== example.runtimeTagName) {
    throw new Error("B25 reviewed runtime transport alias examples must resolve exactly.");
  }
}

assertContains(appSource, 'path="/auto-twin"', "Auto-twin route must stay registered.");
assertContains(stationNavigationSource, 'to: "/auto-twin"', "Cold-station internal navigation must expose auto-twin.");
assertContains(stationNavigationSource, 'labelKey: "navAutoTwin"', "Auto-twin navigation must stay localized.");
assertContains(
  shellSource,
  'isAutoTwinRoute ? " is-auto-twin-content"',
  "Auto-twin route must keep its dedicated full-height content class."
);

assertContains(pageSource, "fetchSystemDiagram(siteId, {", "Auto-twin must load the diagram contract first.");
assertContains(pageSource, 'layoutMode: "auto"', "Auto-twin must request automatic layout.");
assertContains(pageSource, "scope", "Auto-twin must pass the selected generation scope.");
assertContains(
  pageSource,
  "buildSystemDiagramFromContract",
  "Auto-twin must convert the backend diagram contract into render data."
);
assertContains(
  pageSource,
  "buildRuntimeSystemDiagram",
  "Auto-twin must retain topology plus device runtime fallback generation."
);
assertContains(
  pageSource,
  "SYSTEM_DIAGRAM_CONTRACT_SAMPLE",
  "Auto-twin must retain an explicit non-live sample fallback."
);
assertContains(pageSource, "<SystemDiagram3D", "Auto-twin must render through the shared Three.js diagram.");
assertContains(pageSource, "<SystemDiagram2D", "Auto-twin must default to a verifiable 2D hydraulic diagram.");
assertNotContains(pageSource, "<PlantOverview3D", "The full-plant GLB must be removed from the auto-twin page after migration.");
assertNotContains(pageSource, "getPlantOverviewProfile(", "Auto-twin must no longer own the B25 full-plant profile.");
assertNotContains(pageSource, "plant-overview", "Auto-twin must retain only hydraulic and topology 3D views.");
assertContains(appSource, 'path="/scene-control"', "The cold-station monitoring route must stay registered.");
assertContains(stationNavigationSource, 'to: "/scene-control"', "Run monitoring must expose the cold-station page.");
assertContains(stationNavigationSource, 'labelKey: "navColdStationScene"', "The cold-station navigation label must stay localized.");
assertContains(sceneControlSource, "<PlantOverview3D", "The B25 full-plant GLB must render in cold-station monitoring.");
assertContains(sceneControlSource, "getPlantOverviewProfile(", "Cold-station full-plant access must use the reviewed site profile.");
assertContains(sceneControlSource, "fetchRuntimePointSummary(siteId, {", "Cold-station animation may read only the runtime summary GET client.");
assertContains(sceneControlSource, "signal: requestController.signal", "Cold-station runtime summary requests must remain abortable.");
assertContains(sceneControlSource, "stationId: runtimeStationId", "Cold-station runtime summary requests must carry the selected physical-station scope.");
assertContains(sceneControlSource, "isAppliedStationRuntimeScope(summary.dataScope, stationRuntimeScope)", "Cold-station runtime summary responses must prove the selected physical-station scope before rendering.");
assertContains(sceneControlSource, "const refreshIntervalMs = 10_000", "Cold-station runtime evidence must refresh at the reviewed ten-second cadence.");
assertContains(sceneControlSource, "requestInFlight", "Cold-station runtime evidence refresh must prevent overlapping requests.");
assertContains(sceneControlSource, "window.setTimeout", "Cold-station runtime evidence refresh must schedule only after the current request settles.");
assertContains(sceneControlSource, 'document.addEventListener("visibilitychange"', "Cold-station runtime evidence refresh must pause or resume with page visibility.");
assertContains(sceneControlSource, 'document.removeEventListener("visibilitychange"', "Cold-station runtime evidence visibility listener must be cleaned up.");
assertContains(sceneControlSource, "new AbortController()", "Cold-station runtime evidence requests must have a bounded lifetime.");
assertContains(sceneControlSource, "requestController.abort()", "Cold-station runtime evidence timeout and cleanup must abort a hanging request.");
assertContains(sceneControlSource, "runtimeSummary={sceneRuntimeSummary}", "The local model must receive the scope-checked read-only runtime summary explicitly.");
assertContains(sceneControlSource, "const stationScopedRuntimeSummary = runtimeStationId", "Physical-station model evidence must be derived through an explicit scope gate.");
for (const field of [
  "pointEvidence?: RuntimePointEvidenceDto",
  "evidenceProfileId?: string | null",
  "freshnessPolicy?: RuntimePointFreshnessPolicyDto",
  "observedAt?: string | null",
  "changedAt?: string | null",
  "authoritativeTimestamp?: boolean | null",
  "sourceSequence?: number | null",
  "scanCycleId?: string | null",
  "bootId?: string | null",
  "replayProofPoints?: number | null",
  "missingReplayProofPoints?: number | null",
  "clientRefreshIntervalMs?: number | null",
  "sourceExpectedIntervalMs?: number | null"
]) {
  assertContains(bffClientSource, field, `Runtime point evidence DTO must expose ${field}.`);
}
assertContains(sceneControlSource, 'data-b25-plant-overview-entry="true"', "Cold-station monitoring must expose a testable B25 model entry.");
assertContains(sceneControlSource, 'data-scene-renderer={sceneRenderer}', "B25 local 2D/3D renderers must be distinguishable from remote scenes.");
assertContains(sceneControlSource, '"local-plant-overview-2d"', "The B25 physical 2D asset must use a dedicated local renderer mode.");
assertContains(sceneControlSource, "const model2dUrl = plantOverviewProfile?.model2dAssetPath || remoteModel2dUrl;", "B25 must prefer its reviewed local physical 2D asset over a legacy remote URL.");
assertContains(sceneControlSource, "<PlantOverview2D", "B25 2D must use the local runtime-aware renderer instead of a static iframe.");
assertContains(sceneControlSource, "runtimeSummary={sceneRuntimeSummary}", "B25 2D must receive the same runtime evidence envelope as the 3D renderer.");
assertContains(plantOverview2dSource, 'data-b25-plant-overview-2d={profile.model2dPresentation}', "B25 2D renderer must expose the reviewed physical presentation mode.");
assertContains(plantOverview2dSource, 'data-plant-2d-evidence={profile.model2dEvidenceMode}', "B25 2D renderer must disclose its exact read-only runtime evidence mode.");
assertContains(plantOverview2dSource, 'data-runtime-binding="exact-deviceid-tagname-read-only"', "B25 2D must disclose exact deviceId plus tagName binding.");
assertContains(plantOverview2dSource, 'data-flow-evidence="schematic"', "B25 2D flow must remain explicitly schematic until authoritative flow evidence is bound.");
assertContains(plantOverview2dSource, 'data-scene-control-scope="read-only-no-ba-plc-write"', "B25 2D must retain the no-BA/PLC-write boundary.");
assertContains(plantOverview2dSource, 'data-status-summary-layout="responsive-reserved-region-v1"', "B25 2D status summary must expose its responsive non-overlay layout contract.");
assertContains(plantOverview2dSource, "resolvePlantOverviewRuntimeSnapshot", "B25 2D and 3D must share the exact equipment runtime-state resolver.");
assertContains(plantOverview2dSource, 'data-equipment-operational-state', "B25 2D equipment must expose its five-state operational classification.");
assertContains(plantOverview2dSource, 'data-runtime-point-key', "B25 2D equipment parameters must expose their exact point identity.");
assertContains(plantOverview2dStyleSource, ".is-state-running", "B25 2D must visibly distinguish RUNNING equipment.");
assertContains(plantOverview2dStyleSource, ".is-state-fault", "B25 2D must visibly distinguish FAULT equipment.");
assertContains(plantOverview2dStyleSource, ".is-state-standby", "B25 2D must visibly distinguish STANDBY equipment.");
assertContains(plantOverview2dStyleSource, ".is-state-stopped", "B25 2D must visibly distinguish STOPPED equipment.");
assertContains(plantOverview2dStyleSource, ".is-state-unknown", "B25 2D must visibly distinguish UNKNOWN equipment.");
assertContains(plantOverview2dStyleSource, 'container-name: plant-overview-2d-runtime;', "B25 2D must adapt to its actual scene-stage aspect ratio rather than the browser viewport.");
assertContains(plantOverview2dStyleSource, '@container plant-overview-2d-runtime (min-width: 1400px) and (min-aspect-ratio: 12 / 5)', "B25 2D must use a dedicated status rail on sufficiently wide scene stages.");
assertContains(plantOverview2dStyleSource, 'grid-template-areas: "canvas status";', "B25 2D ultra-wide layout must reserve a non-overlay side rail for status evidence.");
assertContains(sceneControlSource, "const B25_LOCAL_2D_CANVAS_WIDTH = 1920;", "B25 local 2D native fit must use the SVG delivery width.");
assertContains(sceneControlSource, "const B25_LOCAL_2D_CANVAS_HEIGHT = 1080;", "B25 local 2D native fit must use the SVG delivery height.");
assertContains(sceneControlSource, "? SCENE_NATIVE_B25_LOCAL_2D_VIEWPORT", "B25 local 2D must fit the complete 1920x1080 asset rather than crop to a legacy remote viewport.");
assertContains(sceneControlSource, 'mode === "2d" && !localPlantOverview2dActive', "Legacy remote 2D crop-safe offsets must not be applied to the complete B25 SVG.");
assertContains(plantOverviewRegistrySource, 'model2dAssetPath: "/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg"', "B25 profile must register the validated physical 2D SVG.");
assertContains(plantOverviewRegistrySource, 'model2dPresentation: "physical-scada-2.5d"', "B25 profile must retain the physical SCADA presentation contract.");
assertContains(plantOverviewRegistrySource, 'model2dEvidenceMode: "runtime-read-only-exact"', "B25 profile must keep exact read-only 2D runtime binding fail-closed.");
assertContains(sceneControlSource, "!plantOverviewProfile &&", "B25 must never prewarm the replaced remote 3D iframe or authorize scene control.");
assertContains(sceneControlSource, "operationalEvidence={false}", "Identity-only B25 geometry must not be promoted to operational evidence.");
assertContains(sceneControlSource, "embedded", "Cold-station monitoring must use the full-height embedded model variant.");
assertContains(sceneControlSource, "resetViewSignal={sceneFrameResetKeys[\"3d\"]}", "B25 view reset must signal the live renderer without remounting the GLB.");
assertContains(sceneControlSource, "viewportFitSignal=", "B25 renderer must refit after runtime-bar or immersive layout changes.");
assertNotContains(sceneControlSource, 'key={`${plantOverviewProfile.assetId}-${sceneFrameResetKeys["3d"]}`}', "B25 view reset must not reload the manifest, binding contract and GLB.");
assertContains(sceneControlSource, "data-plant-immersive=", "Cold-station shell must expose its local-model immersive state.");
assertContains(sceneControlStyleSource, '.scene-embed-stage[data-scene-renderer="local-plant-overview"]::before', "Local GLB must not be covered by remote-scene decoration layers.");
assertContains(sceneControlStyleSource, '.scene-embed-stage[data-scene-renderer="local-plant-overview-2d"]::before', "Local physical 2D must not be obscured by generic remote-scene decoration layers.");
assertContains(sceneControlStyleSource, ".scene-embed-plant-overview", "Cold-station monitoring must give the local GLB a dedicated stage wrapper.");
assertContains(sceneControlStyleSource, '.scene-embed-shell.is-frame-fullscreen[data-plant-immersive="true"]', "B25 fullscreen must use a dedicated immersive layout contract.");
assertContains(sceneControlStyleSource, ".scene-embed-runtimebar {\n  display: none !important;", "B25 immersive layout must remove the KPI bar from the model viewport.");
assertContains(
  pageSource,
  'useState<AutoTwinView>("hydraulic")',
  "Auto-twin must open on the engineering-oriented hydraulic view."
);
assertContains(
  pageSource,
  "data-auto-twin-source={source}",
  "Auto-twin must expose the active source for UI and acceptance checks."
);
assertContains(
  pageSource,
  "data-auto-twin-view={view}",
  "Auto-twin must expose the selected 2D/3D view for acceptance checks."
);
assertContains(
  pageSource,
  'source !== "sample" && selectedNode?.primaryDeviceId',
  "Sample diagrams must not expose a device-page link."
);
assertContains(
  pageSource,
  'operationalEvidence={source !== "sample"}',
  "Sample diagrams must not render runtime status as operational evidence."
);
assertContains(
  pageSource,
  "auto-twin-sample-watermark",
  "Sample diagrams must carry a visible non-live watermark."
);
assertContains(
  pageSource,
  "本页不下发 BA/PLC",
  "Auto-twin must state its read-only BA/PLC boundary in visible copy."
);
assertNotContains(
  pageSource,
  "submitSceneDeviceCommand",
  "Auto-twin must not import or invoke scene device dispatch."
);
assertNotContains(
  pageSource,
  "runFcuManualControlCommand",
  "Auto-twin must not import or invoke FCU control dispatch."
);

assertContains(diagramSource, "new WebGLRenderer", "System diagram must keep WebGL rendering.");
assertContains(diagramSource, "window.requestAnimationFrame(renderLoop)", "System diagram must keep its animation loop.");
assertContains(diagramSource, "new ResizeObserver", "System diagram must resize with its host.");
assertContains(diagramSource, "createScrollingFlowOverlay", "Three.js pipes must keep scrolling flow overlays.");
assertContains(diagramSource, "RepeatWrapping", "Flow overlays must repeat their arrow texture along the pipe.");
assertContains(diagramSource, "flow.texture.offset.x", "Flow overlays must animate through texture offsets.");
assertContains(diagramSource, "resolveSystemDiagramFlowVisualState", "3D flow must use the shared runtime flow contract.");
assertContains(flowSource, "edge.flowM3h", "Flow speed must accept a runtime flow measurement.");
assertContains(flowSource, "edge.flowActive", "Flow animation must accept a runtime active state.");
assertNotContains(diagramSource, "createFlowPulse", "Legacy floating flow spheres must remain removed.");
assertNotContains(diagramSource, "createFlowArrow(curve", "Legacy discrete cone arrows must remain removed.");
assertContains(typesSource, "flowM3h?: number | null", "Diagram edges must expose optional flow telemetry.");
assertContains(typesSource, 'flowDirection?: "forward" | "reverse"', "Diagram edges must expose optional flow direction.");
assertContains(typesSource, "flowActive?: boolean", "Diagram edges must expose optional running state.");
assertContains(
  diagramSource,
  "zhCN.sceneControl.systemDiagramUnit",
  "System diagram instance units must remain localized."
);
assertContains(
  diagramSource,
  "updateDiagramLabelVisibility",
  "3D labels must apply screen-space distance and collision visibility."
);
assertContains(
  diagramSource,
  "screenLabelBoxesOverlap",
  "3D labels must prevent overlapping label boxes."
);
assertContains(
  diagramSource,
  "data-model-binding={modelBindingState}",
  "3D model binding truth must be visible for acceptance checks."
);
assertContains(
  diagramSource,
  "通用设备模型",
  "3D generic assets must not be presented as site-specific equipment models."
);

assertContains(plantOverviewRegistrySource, '"140"', "B25 plant profile must recognize legacy site 140.");
assertContains(plantOverviewRegistrySource, '"btwentyfive"', "B25 plant profile must recognize the site code.");
assertContains(plantOverviewRegistrySource, '"140btwentyfive"', "B25 plant profile must recognize the database key.");
assertContains(
  plantOverviewRegistrySource,
  'bindingMode: "read-only-complete-core"',
  "B25 full-plant integration must keep complete-core identity coverage and remain read-only."
);
assertContains(
  plantOverviewRegistrySource,
  'bindingContractPath: "/models/plant-overview/bindings/b25-plant-overview-binding-v2.json"',
  "B25 full-plant profile must use the formal v2 identity contract."
);
assertContains(
  plantOverviewRegistrySource,
  "expectedExplicitBindingCount: 54",
  "B25 full-plant profile must lock all 54 explicit identity mappings."
);
assertContains(
  plantOverviewRegistrySource,
  "expectedAnimationCount: 63",
  "B25 full-plant profile must lock the 63 embedded-animation budget."
);
assertContains(
  plantOverviewRegistrySource,
  "expectedRuntimeTargetCount: 62",
  "B25 full-plant profile must lock the 62 runtime-target budget."
);
assertContains(plantOverviewSource, "new GLTFLoader", "Full-plant view must load the GLB with Three.js.");
assertContains(plantOverviewSource, "new AnimationMixer", "Full-plant view must retain embedded GLB animation clips.");
assertContains(plantOverviewSource, "new OrbitControls", "Full-plant view must support engineering inspection controls.");
assertContains(plantOverviewSource, "resolveDesiredLod", "Full-plant view must switch LOD by camera distance.");
assertContains(plantOverviewSource, "loader.setMeshoptDecoder", "Full-plant loader must retain meshopt support.");
assertContains(plantOverviewSource, "runtime_animation_target", "Full-plant view must audit runtime target extras.");
assertContains(plantOverviewSource, "type EquipmentOperationalState", "B25 must define a separate equipment business-state type.");
for (const state of ["running", "fault", "stopped", "standby", "unknown"]) {
  assertContains(plantOverviewSource, `\"${state}\"`, `B25 equipment state must include ${state}.`);
}
assertContains(plantOverviewSource, "type EquipmentStateEvidenceMode", "B25 business state must remain separate from LIVE/SHADOW/STALE/UNBOUND evidence.");
assertContains(plantOverviewSource, "resolveEquipmentOperationalState", "B25 equipment states must use one fail-closed resolver.");
assertContains(plantOverviewSource, "readStrictBinaryValue", "B25 running, fault and remote state points must use strict binary parsing.");
assertContains(plantOverviewSource, "const running = readStrictBinaryValue(runningPoint?.value)", "B25 RUNNING must use strict binary point values.");
assertContains(plantOverviewSource, "const faultActive = readStrictBinaryValue(faultPoint?.value)", "B25 FAULT must use strict binary point values.");
assertContains(plantOverviewSource, "const remoteEnabled = readStrictBinaryValue(remoteEnabledPoint?.value)", "B25 STANDBY/STOPPED must use strict binary point values.");
assertContains(plantOverviewSource, "faultActive === true", "An exact explicit fault bit must take precedence over running.");
assertContains(plantOverviewSource, "running === true", "B25 RUNNING must require an explicit running value.");
assertContains(plantOverviewSource, "remoteEnabled === true", "B25 STANDBY must require an explicit remote-enabled value.");
assertContains(plantOverviewSource, "stopped_fault_clear_and_remote_disabled", "B25 STOPPED must require an explicit remote-disabled value.");
assertContains(plantOverviewSource, "explicit_fault_signal_unavailable", "Missing or unusable explicit fault evidence must degrade to UNKNOWN.");
assertContains(plantOverviewSource, "explicit_running_signal_unavailable", "Missing or unusable explicit running evidence must degrade to UNKNOWN.");
assertContains(plantOverviewSource, "explicit_remote_signal_unavailable", "Missing or unusable explicit remote evidence must degrade to UNKNOWN.");
assertContains(plantOverviewSource, "runtimeSignals?.faultTagName", "B25 FAULT must join the reviewed exact fault selector.");
assertContains(plantOverviewSource, "runtimeSignals?.remoteEnabledTagName", "B25 STANDBY/STOPPED must join the reviewed exact remote selector.");
assertContains(plantOverviewSource, "findUniqueExactTagPoint", "B25 equipment state must use exact unique deviceId + tagName matching.");
assertContains(plantOverviewSource, "isShadowReadablePoint", "BAD, expired or invalid SHADOW status points must fail closed.");
assertContains(plantOverviewSource, '!qualityCode.startsWith("BAD")', "Explicit BAD status points must not classify equipment state.");
assertContains(plantOverviewSource, "isShadowTransportFresh", "Expired SHADOW envelopes must degrade equipment state instead of retaining stale colors.");
assertContains(plantOverviewSource, "sourceReadOnlyHealthy", "Unhealthy or fallback sources must not classify equipment state.");
assertContains(plantOverviewSource, "candidateBindingByEquipmentId", "B25 binding candidates must use an explicit equipment-ID map.");
assertContains(plantOverviewSource, "binding.deviceIdRef ?? binding.deviceId", "B25 model bindings must resolve the reviewed deviceIdRef.");
assertContains(plantOverviewSource, "binding.runtimeGroup", "B25 model bindings must retain the reviewed runtime group.");
assertContains(plantOverviewSource, "binding.runtimeId", "B25 model bindings must retain the reviewed runtime equipment ID.");
assertContains(plantOverviewSource, "applyReadOnlyRuntimeAnimations", "B25 runtime summary may drive animation only through the read-only adapter.");
assertContains(plantOverviewSource, "findNodeByDeviceId", "B25 model selection must resolve exact device IDs.");
assertContains(
  plantOverviewSource,
  "authoritativeBinding = false",
  "B25 read-only identity bindings must never become authoritative runtime nodes."
);
assertContains(
  plantOverviewSource,
  'contract.status !== "FORMAL_READ_ONLY_IDENTITY"',
  "The formal B25 contract must independently verify the complete-core identity map."
);
assertContains(
  plantOverviewSource,
  "if (!authoritativeBinding)",
  "Identity-only B25 mappings must not promote read-only summaries into authoritative runtime nodes."
);
assertContains(plantOverviewSource, "failedLods", "Failed LODs must be quarantined instead of retried per frame.");
assertContains(plantOverviewSource, "releaseLevel", "Inactive LOD resources must be released after a level switch.");
assertContains(plantOverviewSource, "activeModel?.mixer.update(delta)", "Only the active LOD animation mixer may run.");
assertNotContains(
  plantOverviewSource,
  "loaded.forEach((entry) => entry.mixer.update(delta))",
  "Hidden LOD animation mixers must never keep running."
);
assertContains(
  plantOverviewSource,
  ".catch(() => null)",
  "A missing optional B25 binding contract must degrade to UNBOUND instead of blocking the GLB."
);
assertContains(plantOverviewSource, "resolveVerifiedIdentityBindings", "B25 complete-core coverage must be verified at runtime.");
assertContains(plantOverviewSource, 'data-binding-coverage={bindingIdentityVerified ? "full-core-read-only" : "unbound-incomplete"}', "B25 coverage badge must degrade when the runtime contract is incomplete.");
assertContains(plantOverviewSource, '!summary\n    ? "UNBOUND"', "Missing runtime summaries must remain UNBOUND.");
assertContains(plantOverviewSource, '? "LIVE"\n      : "STALE"', "Incomplete or stale point evidence must remain STALE instead of being promoted to LIVE.");
assertContains(plantOverviewSource, "SHADOW仅按精确唯一运行/故障/远程点", "B25 shadow animation must visibly disclose its exact read-only value boundary.");
assertContains(plantOverviewSource, "证据仍为 STALE，水流保持暂停", "B25 shadow animation must visibly preserve STALE evidence and pause flow.");
assertContains(plantOverviewSource, 'data-animation-mode={animationMode}', "B25 animation evidence mode must be exposed for acceptance checks.");
assertContains(plantOverviewSource, 'data-equipment-status-contract="operational-state-v1"', "B25 must expose the equipment operational-state DOM contract.");
assertContains(plantOverviewSource, "data-equipment-status-marker-count={statusMarkerCount}", "B25 must expose the active LOD runtime status-marker count.");
assertContains(plantOverviewSource, "data-equipment-status-expected-marker-count={EXPECTED_CORE_EQUIPMENT_IDS.length}", "B25 must lock the expected marker count to all 54 core devices.");
assertContains(plantOverviewSource, 'data-equipment-status-marker-parity={statusMarkerCount === EXPECTED_CORE_EQUIPMENT_IDS.length ? "PASS" : "FAIL"}', "B25 must fail visible LOD marker parity when the active model has fewer than 54 markers.");
assertNotContains(plantOverviewSource, "createChillerStatusPlacardTexture", "B25 must not recreate persistent in-model chiller state placards.");
assertNotContains(plantOverviewSource, "CHILLER_STATUS_PLACARD_", "B25 must keep the scene free of persistent chiller status placard sprites.");
assertContains(plantOverviewSource, "CHILLER_TOP_TO_BOTTOM_ORDER", "B25 chiller display order must be explicit and stable.");
assertContains(plantOverviewSource, 'data-chiller-status-count={chillerStateRows.length}', "B25 must disclose all seven compact chiller strip items.");
assertContains(plantOverviewSource, 'data-chiller-row-order-contract="CH1-top-CH7-bottom"', "B25 must expose the reviewed CH1-top to CH7-bottom row contract.");
assertContains(plantOverviewSource, 'data-chiller-status-display="compact-strip-and-docked-inspector-v3"', "B25 chiller state must use the compact strip and docked inspector contract.");
assertContains(plantOverviewSource, 'data-chiller-persistent-model-placard-count="0"', "B25 must disclose zero persistent in-model chiller placards.");
assertContains(plantOverviewSource, 'data-selected-equipment-detail-max-count="0"', "B25 must keep selected equipment detail out of the 3D HUD.");
assertContains(plantOverviewSource, 'data-device-hover-metric-mode="exact-device-primary-read-only-v1"', "B25 hover must expose one exact-device primary metric.");
assertContains(plantOverviewSource, 'data-process-metric-anchor-count={processMetrics.length}', "B25 must disclose all seven world-projected process metrics.");
assertContains(plantOverviewSource, 'data-process-metric-layout="world-projected-header-anchors-v1"', "B25 process metrics must remain attached to reviewed header anchors.");
assertContains(sceneControlSource, 'data-plant-device-inspector="docked-read-only-v1"', "B25 equipment details must use the non-modal docked inspector.");
assertContains(sceneControlSource, 'data-plant-device-inspector-control-tabs="0"', "B25 docked inspector must expose zero control tabs.");
assertContains(sceneControlSource, "设备状态与参数仅按精确 deviceId + tagName 读取", "B25 docked inspector must disclose exact metric identity and no aggregate fallback.");
assertContains(sceneControlSource, "无启停、复位、频率设定入口", "B25 docked inspector must visibly disclose its no-control boundary.");
assertContains(sceneControlStyleSource, ".scene-embed-stage.has-plant-device-inspector .scene-embed-plant-overview", "B25 model viewport must shrink and refit beside the inspector.");
assertContains(sceneControlStyleSource, ".scene-embed-plant-device-inspector", "B25 docked inspector must have a scoped visual surface.");
assertContains(plantOverviewSource, 'data-blank-canvas-clears-selection="true"', "B25 blank-canvas clicks must clear selected equipment detail.");
assertContains(plantOverviewSource, "clearCanvasSelectionBeforeThreePick", "B25 must clear canvas selection before the Three.js pick may reselect an exact equipment hit.");
assertContains(plantOverviewSource, 'renderer.domElement.addEventListener("click", handlePointerDown);', "B25 canvas selection must support accessible click events in addition to pointerdown.");
assertContains(plantOverviewSource, 'data-canvas-selection-event-order="pointer-and-click-capture-clear-before-three-pick-v2"', "B25 must disclose deterministic pointer/click clear-before-pick ordering.");
assertContains(plantOverviewSource, 'data-chiller-status-strip-mode="glyph-id-tooltip-v2"', "B25 must disclose the compact glyph and equipment-id strip.");
assertContains(plantOverviewSource, "setSelectedEquipmentId(null);", "B25 blank-canvas selection handling must clear the selected equipment.");
assertNotContains(plantOverviewSource, "<small>{EQUIPMENT_STATE_LABELS[decision.state]}</small>", "B25 compact chiller strip must not duplicate persistent Chinese state text.");
for (const state of ["running", "fault", "stopped", "standby", "unknown"]) {
  assertContains(
    plantOverviewSource,
    `data-equipment-${state}-count={runtimeAnimationPlan.equipmentStateCounts.${state}}`,
    `B25 must expose the ${state} equipment count independently of animation mode.`
  );
}
assertContains(plantOverviewSource, "data-selected-equipment-status=", "B25 selection must disclose the equipment business state.");
assertContains(plantOverviewSource, "data-selected-equipment-status-evidence=", "B25 selection must disclose the independent evidence state.");
assertContains(plantOverviewSource, 'data-equipment-status-visual="base-lightband-corner-frame-v1"', "B25 equipment state must use the reviewed base-lightband and corner-frame visual contract.");
assertContains(plantOverviewSource, 'data-equipment-body-status-visual="pbr-preserving-selective-light-tint-v1"', "B25 equipment bodies must expose the reviewed selective PBR light-tint contract.");
assertContains(plantOverviewSource, "data-equipment-body-tint-count={bodyTintCount}", "B25 must disclose all active-LOD equipment body-tint targets.");
assertContains(plantOverviewSource, 'data-equipment-body-tint-parity={bodyTintCount === EXPECTED_CORE_EQUIPMENT_IDS.length ? "PASS" : "FAIL"}', "B25 must fail visible body-tint parity below 54 targets.");
assertContains(plantOverviewSource, "data-equipment-body-tint-material-count={bodyTintMaterialCount}", "B25 must disclose the selectively cloned painted material count.");
assertContains(plantOverviewSource, 'data-equipment-body-tint-scope="painted-shell-only-excludes-pipes-flanges-instruments-shafts-and-guards"', "B25 body tint must visibly exclude process and safety materials.");
assertContains(plantOverviewSource, 'data-equipment-body-tint-runtime-only="true"', "B25 body tint must remain runtime-only.");
assertContains(plantOverviewSource, 'data-equipment-body-tint-fault-pulse-only="true"', "B25 body tint must pulse only for FAULT.");
assertContains(bodyTintCreationPath, "sourcePbrMaterial.clone()", "B25 body tint must clone materials instead of mutating shared GLB PBR materials.");
assertContains(bodyTintCreationPath, "const isReviewedLatestModel", "B25 body tint must target only reviewed equipment model meshes.");
assertContains(bodyTintCreationPath, 'object.name.toUpperCase().endsWith("__LATEST_MODEL")', "B25 body tint must retain a GLTF-node-name fallback for reviewed latest-model meshes.");
assertContains(bodyTintCreationPath, "if (!meshObject.geometry || !meshObject.material)", "B25 body tint must recognize cross-bundle GLTF meshes structurally.");
assertContains(bodyTintCreationPath, "const isPbrMaterial = sourcePbrMaterial.isMeshStandardMaterial === true", "B25 body tint must recognize GLTF PBR materials by stable runtime capability.");
assertContains(bodyTintCreationPath, "sourcePbrMaterial.color?.isColor === true", "B25 body tint must retain a structural PBR fallback across Three.js bundles.");
for (const materialName of [
  "MAT_PAINTED_TEAL",
  "MAT_PUMP_INDUSTRIAL_BLUE",
  "MAT_FRP_PANEL_COOLGRAY"
]) {
  assertContains(plantOverviewSource, `"${materialName}"`, `B25 body tint material allowlist must retain ${materialName}.`);
}
for (const excludedMaterialName of [
  "MAT_RUBBER",
  "MAT_COUPLING_GUARD_YELLOW",
  "MAT_FASTENER_STEEL",
  "MAT_CONDENSER_WATER_PIPE",
  "MAT_FAN_BLADE"
]) {
  assertNotContains(plantOverviewSource, `"${excludedMaterialName}"`, `B25 body tint allowlist must exclude ${excludedMaterialName}.`);
}
assertContains(statusBadgePath, "loaded.bodyTintsByEquipmentId.forEach", "All 54 active-LOD equipment body targets must pass through the state-tint path.");
assertContains(statusBadgePath, "EQUIPMENT_BODY_TINT_STRENGTHS[state]", "B25 body tint must retain restrained state-specific blend strengths.");
assertContains(plantOverviewSource, 'bodyTint.state === "fault"', "Only FAULT equipment bodies may receive an animated emissive pulse.");
assertContains(plantOverviewSource, "baseLightband", "B25 runtime marker must contain a real equipment-base lightband primitive.");
assertContains(plantOverviewSource, "cornerFrame", "B25 runtime marker must contain a real four-corner frame primitive.");
assertContains(plantOverviewSource, "EQUIPMENT_STATE_SHAPES", "B25 equipment state must have a stable non-color shape mapping.");
for (const shape of ["running-play", "fault-alert", "standby-pause", "stopped-square", "unknown-question"]) {
  assertContains(plantOverviewSource, `"${shape}"`, `B25 equipment state shape must include ${shape}.`);
}
assertContains(plantOverviewSource, "applyEquipmentStatusFilter", "B25 status filtering must use one read-only marker-dimming path.");
assertContains(plantOverviewSource, "const filterOpacity = matchesFilter ? 1 : 0.16", "B25 status filter must dim non-matches instead of rewriting their state.");
assertContains(plantOverviewSource, "marker.root.visible = true", "B25 status filter must keep every equipment marker present.");
assertContains(plantOverviewSource, 'marker.baseLightband.visible = evidenceMode === "live"', "B25 LIVE status must use the continuous base-lightband visual.");
assertContains(plantOverviewSource, 'marker.cornerFrame.visible = evidenceMode !== "live"', "B25 SHADOW/STALE/UNBOUND status must use the hollow or segmented corner-frame visual.");
assertContains(plantOverviewSource, 'const lodScale = visualContext.activeLod === "LOD0"', "B25 LOD must scale status semantics without deleting identity mappings.");
assertContains(statusBadgePath, "loaded.statusMarkersByEquipmentId.forEach", "All 54 active-LOD status proxies must pass through one badge-rendering loop.");
assertContains(statusBadgePath, 'const lodScale = visualContext.activeLod === "LOD0"', "LOD0/LOD1/LOD2 may scale the five-state glyph but not choose whether it exists.");
assertContains(statusBadgePath, "marker.badge.scale.set", "LOD semantic scaling must be applied to the actual status badge.");
assertContains(statusBadgePath, "marker.badge.visible = true", "Every active-LOD equipment badge must remain visible for all five business states.");
assertContains(statusBadgePath, "EQUIPMENT_STATE_SHAPES[state].contract", "The always-visible badge must carry the resolved five-state non-color shape contract.");
assertNotContains(statusBadgePath, "showBadge", "LOD status badges must not use a conditional showBadge path that hides RUNNING/STANDBY/STOPPED glyphs.");
assertContains(plantOverviewSource, "navigateEquipmentAnomaly", "B25 must provide read-only previous/next anomaly navigation.");
assertContains(plantOverviewSource, "data-equipment-status-filter=", "B25 must expose the active read-only status filter.");
assertContains(plantOverviewSource, "data-equipment-filter-match-count=", "B25 must expose filter match count without rewriting state counts.");
assertContains(plantOverviewSource, 'data-equipment-counts-invariant={equipmentCountsInvariant ? "PASS" : "FAIL"}', "B25 must fail visibly unless all five business-state counts still total exactly 54.");
assertContains(plantOverviewSource, "data-equipment-anomaly-navigation=", "B25 must expose anomaly-navigation availability for browser acceptance.");
assertContains(plantOverviewSource, "data-equipment-status-lod-semantic-scaling=", "B25 must expose LOD semantic scaling independently of status identity.");
assertContains(plantOverviewSource, 'data-selected-equipment-status-duration="unavailable"', "B25 must not invent a selected-device status duration without authoritative changedAt.");
assertContains(plantOverviewSource, 'data-selected-equipment-status-duration-basis="missing-authoritative-changed-at"', "B25 selected-device duration must disclose its missing authoritative basis.");
assertContains(sceneControlSource, "无权威 changedAt", "B25 docked inspector must visibly disclose unavailable status duration.");
assertNotContains(plantOverviewSource, "SESSION_STATUS_FIRST_SEEN", "B25 must not fabricate state duration from the page session.");
assertNotContains(plantOverviewSource, "data-selected-equipment-status-duration-seconds", "B25 must not expose invented state-duration seconds.");
assertContains(plantOverviewSource, "data-equipment-status-shape=", "B25 per-equipment registry must expose its non-color shape semantic.");
assertContains(plantOverviewSource, "data-equipment-filter-match=", "B25 per-equipment registry must expose filter match without hiding equipment.");
assertContains(plantOverviewSource, "data-equipment-alarm-state=", "B25 per-equipment alarm lifecycle must remain separate from business state.");
assertContains(plantOverviewSource, "data-equipment-diagnostic-state=", "B25 per-equipment diagnostic state must remain separate from business state.");
assertContains(sceneControlSource, "告警记录", "B25 selected equipment must visibly keep alarm lifecycle separate.");
assertContains(sceneControlSource, "诊断结论", "B25 selected equipment must visibly keep diagnostic evidence separate.");
assertContains(plantOverviewSource, 'marker.state === "fault"', "Only an explicit FAULT marker may use status-layer pulse animation.");
assertNotContains(plantOverviewSource, ': marker.state === "standby"', "STANDBY status markers must remain static instead of pulsing.");
assertNotContains(plantOverviewSource, ': marker.state === "running"', "RUNNING status markers must remain static instead of pulsing.");
for (const attribute of [
  "data-equipment-id=",
  "data-equipment-operational-state=",
  "data-equipment-state-evidence=",
  "data-equipment-state-authority=",
  "data-equipment-state-reason="
]) {
  assertContains(plantOverviewSource, attribute, `B25 per-equipment state registry must expose ${attribute}.`);
}
assertContains(plantOverviewSource, '"shadow-read-only"', "B25 must expose an explicit non-authoritative SHADOW animation mode.");
assertContains(plantOverviewSource, 'const shadowAnimationAvailable = runtimeEvidenceState !== "LIVE"', "B25 SHADOW must remain separate from the authoritative LIVE evidence state.");
assertContains(plantOverviewSource, "runtimeAnimationPlan.shadowReadableEquipmentCount > 0", "B25 SHADOW availability must not depend on whether equipment happens to be running.");
assertContains(plantOverviewSource, 'data-animation-authority={demoAnimationEnabled', "B25 must expose LIVE, SHADOW and DEMO authority separately.");
assertContains(plantOverviewSource, 'data-shadow-equipment-readable=', "B25 must expose exact SHADOW selector coverage for acceptance checks.");
assertContains(plantOverviewSource, 'data-flow-animation-evidence={demoAnimationEnabled ? "schematic-demo" : "unbound-paused"}', "B25 SHADOW and LIVE-without-flow-evidence must keep flow clips paused.");
assertContains(plantOverviewSource, 'const [demoAnimationEnabled, setDemoAnimationEnabled] = useState(false)', "B25 demo animation must default to fail-closed paused.");
assertContains(plantOverviewSource, "action.paused = true", "Every embedded GLB action must initialize or fall back to paused.");
assertContains(plantOverviewSource, "action.timeScale = 0", "Paused B25 animation must have zero playback speed.");
assertContains(plantOverviewSource, "runtimeDecision?.motionEnabled === true", "Actual equipment motion must be gated per authoritative runtime clip.");
assertContains(plantOverviewSource, 'stateResolution.state === "running"', "Only an explicit RUNNING business state may enable mechanical runtime motion.");
assertContains(plantOverviewSource, "matchingSources.length === 1", "Runtime source health must be unique instead of accepting mixed duplicate source entries.");
assertContains(plantOverviewSource, "matchingSources[0].fallback === false", "Fallback status must be explicitly false before runtime evidence can enable LIVE animation.");
assertContains(plantOverviewSource, "isShadowTransportFresh", "B25 SHADOW motion must stop after its read-only transport envelope ages out.");
assertContains(plantOverviewSource, "HARD_SHADOW_TRANSPORT_MAX_AGE_MS = 30_000", "B25 SHADOW transport age must retain the reviewed 30-second hard cap.");
assertContains(plantOverviewSource, "isRuntimeSourceReadOnlyHealthy", "B25 SHADOW must retain a unique healthy non-fallback source gate without weakening LIVE.");
assertContains(plantOverviewSource, "isShadowReadablePoint", "B25 SHADOW must use the exact point-identity guard instead of grouped or fuzzy values.");
assertContains(plantOverviewSource, 'driveMode: RuntimeDriveMode', "Every equipment clip must retain its explicit LIVE, SHADOW or paused drive mode.");
assertContains(plantOverviewSource, 'contractVersion !== "runtime-point-evidence-v1"', "Mixed-version runtime evidence envelopes must fail closed.");
assertContains(plantOverviewSource, "CODE_OWNED_EVIDENCE_PROFILE_IDS.has", "Only a code-owned evidence decoder profile may authorize LIVE point semantics.");
assertContains(plantOverviewSource, "buildReplaySafePointKeys", "Runtime evidence must reject sequence or observation-time regression across polls.");
assertContains(plantOverviewSource, "Number.isSafeInteger(sourceSequence)", "Runtime evidence must require a monotonic integer source sequence.");
assertContains(plantOverviewSource, "scanCycleId !== previous.scanCycleId", "A newer point sequence must also advance the scan-cycle identity.");
assertContains(plantOverviewSource, "!previous.seenBootIds.includes(bootId)", "A retired runtime collector boot must never be accepted again.");
assertContains(plantOverviewSource, "persistRuntimeReplayHistory", "Replay history must survive a component remount or page refresh in the browser session.");
assertContains(plantOverviewSource, "liveMaxAgeMs <= HARD_LIVE_MAX_AGE_MS", "Runtime freshness configuration must never relax the 20-second hard cap.");
assertContains(plantOverviewSource, "maxFutureSkewMs <= HARD_MAX_FUTURE_SKEW_MS", "Runtime freshness configuration must never relax the 2-second future-skew hard cap.");
assertContains(plantOverviewSource, "readExactNonEmptyString(point.pointKey) !== readExactNonEmptyString(point.tagName)", "Runtime pointKey must equal the exact reviewed transport tag without whitespace normalization.");
assertContains(plantOverviewSource, "runningPoint?.bootId === frequencyPoint?.bootId", "Running and frequency evidence must originate from the same collector boot.");
assertContains(plantOverviewSource, "runningPoint?.scanCycleId === frequencyPoint?.scanCycleId", "Running and frequency evidence must originate from the same acquisition cycle.");
assertContains(shadowSnapshotPairingPath, "const shadowEnvelopeReceivedAt = readExactNonEmptyString(summary?.pointEvidence?.receivedAt)", "SHADOW pump/fan motion must use the transport envelope receivedAt as its snapshot identity.");
assertContains(shadowSnapshotPairingPath, "runningReceivedAt === shadowEnvelopeReceivedAt", "SHADOW running feedback must belong to the current receivedAt envelope.");
assertContains(shadowSnapshotPairingPath, "frequencyReceivedAt === shadowEnvelopeReceivedAt", "SHADOW frequency feedback must belong to the same receivedAt envelope as running.");
assertContains(shadowSnapshotPairingPath, "const replayPairIdentityPresent = replayPairFields.some(Boolean)", "SHADOW pairing must detect any partially-present replay identity.");
assertContains(shadowSnapshotPairingPath, "const replayPairIdentityComplete = replayPairFields.every(Boolean)", "SHADOW pairing must require all bootId/scanCycleId fields when any is present.");
assertContains(shadowSnapshotPairingPath, "!replayPairIdentityPresent\n          || (replayPairIdentityComplete && pairedSnapshotExact)", "SHADOW pairing must accept either no replay identity or one complete exact pair, never partial metadata.");
assertContains(shadowReadablePath, "&& pairedShadowSnapshotExact", "The same-envelope/optional-complete replay pair must gate the actual shadowReadable path.");
assertContains(liveReadablePath, "&& pairedSnapshotExact", "LIVE pump/fan motion must continue to require exact bootId + scanCycleId pairing.");
assertContains(plantOverviewSource, 'frequencyPoint?.unit === "Hz"', "Frequency evidence must declare the exact reviewed Hz engineering unit.");
assertContains(plantOverviewSource, "frequencyHz <= 60", "Frequency evidence outside the reviewed engineering range must fail closed.");
assertContains(plantOverviewSource, "readExactNonEmptyString(point.tagName) === exactTagName", "Runtime evidence must join by raw exact tagName.");
assertContains(plantOverviewSource, "readExactNonEmptyString(point.deviceId) === exactDeviceId", "Runtime evidence must join by raw exact deviceId.");
assertContains(plantOverviewSource, "EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID", "Runtime binding verification must lock the exact 54-equipment identity set and groups.");
assertContains(plantOverviewSource, "exactRuntimeSignalSet", "Runtime binding verification must reject missing or extra runtime signal identities.");
assertContains(plantOverviewSource, "resolveReviewedRuntimeTagAlias", "Point-table selectors must use only the reviewed exact transport alias.");
assertContains(plantOverviewSource, 'aliasRule?.status !== "REVIEWED_EXACT_TRANSPORT_ALIAS"', "Unreviewed runtime transport aliases must fail closed.");
assertContains(plantOverviewSource, "const runtimeMotionEnabled = isEquipmentMotion", "Actual runtime evidence must never enable flow clips without exact flow-point bindings.");
assertContains(plantOverviewSource, "demoAnimationEnabled\n      ? isEquipmentMotion || isFlowMotion", "Only an explicit DEMO choice may enable non-authoritative flow motion.");
assertContains(plantOverviewSource, 'aria-pressed={demoAnimationEnabled}', "The DEMO animation control must expose its pressed state.");
assertContains(plantOverviewSource, "演示动画不代表设备正在运行", "The DEMO animation control must visibly reject live-operation semantics.");
assertNotContains(plantOverviewSource, "runtimeSummary.groups", "Grouped runtime summaries must never become equipment-state truth.");
assertNotContains(plantOverviewSource, "runtimeSummary?.groups", "Optional grouped summaries must never become equipment-state truth.");
assertNotContains(plantOverviewSource, "summary.groups", "Grouped summary aliases must never become equipment-state truth.");
assertNotContains(plantOverviewSource, "summary?.groups", "Optional grouped summary aliases must never become equipment-state truth.");
assertNotContains(plantOverviewSource, "SHADOW 实时", "B25 SHADOW must never be labeled as realtime.");
assertNotContains(plantOverviewSource, "SHADOW LIVE", "B25 SHADOW must never be labeled as LIVE.");
assertContains(plantOverviewSource, 'data-camera-fit="reference-angle-bottom-safe-obb-fit-v6"', "B25 camera fit behavior must expose the reviewed reference-angle bottom-safe OBB contract.");
assertContains(plantOverviewSource, 'data-camera-fit-geometry="visible-mesh-obb-corners"', "B25 initial camera must fit real visible mesh corners instead of empty global AABB corners.");
assertContains(plantOverviewSource, "collectVisibleMeshFitPoints", "B25 camera fitting must preserve every visible mesh while removing empty-corner over-padding.");
assertContains(plantOverviewSource, 'data-camera-default-view="tower-left-chiller-center-manifold-right-v5"', "B25 must expose the reviewed tower-left, chiller-center and manifold-right initial camera direction.");
assertContains(plantOverviewSource, "const DEFAULT_CAMERA_VIEW_DIRECTION = new Vector3(18, 25, 34).normalize();", "B25 reference camera vector must drive the actual Three.js camera.");
assertContains(plantOverviewSource, 'const DEFAULT_CAMERA_VIEW_DIRECTION_CONTRACT = "18,25,34"', "B25 reference camera direction must remain explicit and auditable.");
assertContains(plantOverviewSource, 'data-camera-default-direction={DEFAULT_CAMERA_VIEW_DIRECTION_CONTRACT}', "B25 root must disclose the exact default camera direction.");
assertContains(plantOverviewSource, 'data-camera-initial-composition="wide-scale-0.89-y-responsive-minus60to96px-more-topdown-bottom-safe-mobile-conservative"', "B25 root must disclose the reviewed reference-angle initial composition.");
assertContains(plantOverviewSource, 'data-camera-overlay-layout="compact-two-row-v1"', "B25 must disclose its compact two-row default overlay layout.");
assertContains(plantOverviewSource, "resolveCameraInitialComposition(viewportWidth, viewportHeight)", "B25 initial camera must use viewport-aware composition values.");
assertContains(plantOverviewSource, "Math.max(60, Math.round(viewportHeight * 0.087))", "B25 wide initial view must scale its upward composition with the actual canvas height.");
assertContains(plantOverviewSource, "return { distanceScale: 0.89, verticalOffsetPx: wideVerticalOffsetPx }", "B25 wide initial view must retain the reviewed enlargement and responsive bottom-safe upward composition.");
assertContains(plantOverviewSource, "preserveViewDirection", "B25 responsive refit must not overwrite a user-adjusted engineering view.");
assertContains(plantOverviewStyleSource, ".plant-overview-overlay-stack.is-default-compact", "B25 default title overlay must remain compact on desktop.");
assertContains(plantOverviewStyleSource, 'grid-template-areas:\n      "quality filters"\n      "anomalies chillers"', "B25 desktop status HUD must remain a compact two-row grid.");
assertContains(plantOverviewSource, "DEFAULT_CAMERA_VIEW_DIRECTION", "B25 reset and initial load must share one reviewed camera direction.");
assertContains(plantOverviewSource, "resolveCameraFitPadding(viewportWidth, viewportHeight)", "B25 camera padding must respond to the actual viewport.");
assertContains(plantOverviewSource, "cameraHasUserInteracted", "B25 responsive fitting must preserve a user-adjusted engineering view.");
assertContains(plantOverviewSource, "cameraFitRef.current?.reset()", "B25 reset must address the existing Three.js camera.");
assertContains(plantOverviewSource, "cameraFitRef.current?.refit()", "B25 layout changes must refit the existing Three.js camera.");
assertContains(hoverRaycastPath, "activeModel.statusMarkersByEquipmentId.values()", "Hover hit-testing must source only the 54 lightweight status-marker proxies.");
assertContains(hoverRaycastPath, ".map((marker) => marker.root)", "Hover hit-testing must raycast status-marker roots rather than full equipment geometry.");
assertContains(hoverRaycastPath, "raycaster.intersectObjects(statusMarkerRoots, true)", "Hover hit-testing must intersect only lightweight marker proxies.");
assertContains(hoverRaycastPath, "if (hoverRaycastFrame === 0)", "Pointermove hover work must be coalesced to at most one pending animation frame.");
assertContains(hoverRaycastPath, "window.requestAnimationFrame(updateHoverCursor)", "Pointermove hover raycasting must be requestAnimationFrame-throttled.");
assertNotContains(hoverRaycastPath, "intersectObject(activeModel.root, true)", "Pointermove hover must never recursively raycast the full high-poly plant model.");
assertContains(plantOverviewSource, 'data-control-boundary="visualization-only-no-ba-plc-write"', "B25 plant overview must expose the no-BA/PLC-write boundary.");
assertContains(sceneControlSource, "const sceneControlBlocked = Boolean(plantOverviewProfile) || Boolean(runtimeStationId);", "B25 and physical-station scene controls must remain blocked in both 2D and 3D modes.");
assertContains(sceneControlSource, "if (sceneControlBlocked)", "Read-only scene command handlers must fail closed before creating or dispatching a command.");
assertContains(plantOverviewSource, "disposeObject", "Full-plant WebGL resources must be released on unmount.");
assertNotContains(plantOverviewSource, "submitSceneDeviceCommand", "Full-plant view must never dispatch scene commands.");
assertNotContains(plantOverviewSource, "approve", "Full-plant view must never approve control actions.");
assertContains(plantOverviewStyleSource, ".plant-overview-coverage", "B25 coverage warning must remain visible.");
assertContains(plantOverviewStyleSource, ".plant-overview-evidence.is-live", "B25 authoritative LIVE evidence must have a distinct green state.");
assertContains(plantOverviewStyleSource, ".plant-overview-evidence.is-shadow", "B25 SHADOW must have a distinct non-green warning state.");
assertContains(plantOverviewStyleSource, ".plant-overview-evidence.is-demo", "B25 DEMO must have a distinct schematic state.");
assertContains(plantOverviewStyleSource, ".plant-overview-chiller-status-strip", "B25 must visibly render the ordered seven-chiller state strip.");
assertContains(plantOverviewStyleSource, ".plant-overview-chiller-status.is-shadow", "B25 chiller state strip must distinguish non-authoritative SHADOW without relying on color alone.");
for (const state of ["running", "fault", "stopped", "standby", "unknown"]) {
  assertContains(
    plantOverviewStyleSource,
    `.plant-overview-equipment-state.is-${state}`,
    `B25 ${state} equipment status needs a text/shape style in addition to runtime color.`
  );
}
assertContains(plantOverviewStyleSource, ".plant-overview-equipment-state.is-shadow", "B25 SHADOW status needs a distinct unverified visual treatment.");
assertContains(plantOverviewStyleSource, ".plant-overview-status-filter", "B25 read-only status filter must have a visible and scoped control surface.");
assertContains(plantOverviewStyleSource, ".plant-overview-anomaly-navigation", "B25 read-only anomaly navigation must have a visible and scoped control surface.");
assertContains(sceneControlStyleSource, ".scene-embed-plant-device-kpis", "B25 unavailable state duration must remain visibly disclosed in the docked KPI grid.");
assertContains(plantOverviewStyleSource, ".is-filter-dimmed", "B25 non-matching equipment must be dimmed rather than removed.");
assertContains(plantOverviewSource, "EQUIPMENT_STATE_COLORS", "Equipment colors must be runtime marker materials, not baked GLB state variants.");
assertContains(plantOverviewSource, "statusMarkersByEquipmentId", "Each loaded LOD must keep an independent 54-equipment status-marker map.");
assertContains(plantOverviewStyleSource, '[data-binding-coverage="full-core-read-only"]', "B25 complete-core read-only coverage must have a visible style state.");
assertContains(plantOverviewSource, 'className={`plant-overview-overlay-stack${selectedEquipmentId ? " is-inspection-expanded" : " is-default-compact"}`}', "B25 title and truth panel must share one state-aware non-overlapping overlay stack.");
assertContains(plantOverviewSource, "只读设备与数据状态", "B25 no-write boundary must remain visible in collapsed and immersive views.");
assertContains(plantOverviewStyleSource, ".plant-overview-overlay-stack", "B25 overlay stack must have a scoped layout contract.");
if (countOccurrences(plantOverviewSource, "{bindingLabel}") !== 1) {
  throw new Error("B25 binding truth must be rendered exactly once in the visible model surface.");
}
assertContains(sceneControlStyleSource, ".scene-embed-plant-overview .plant-overview-load-status", "Embedded mobile load status must have a scoped position.");
assertContains(sceneControlStyleSource, "bottom: 52px", "Embedded mobile load status must clear the visible footer.");
assertContains(
  plantOverviewStyleSource,
  ".plant-overview-shell .scene-system-diagram-shell-footer",
  "Mobile full-plant footer must use a dedicated non-overlapping layout."
);

const overviewManifestItem = modelManifest.items?.find((item) => item.id === "plant-overview-latest-v2");
if (!overviewManifestItem) {
  throw new Error("Approved model manifest must contain plant-overview-latest-v2.");
}
for (const level of ["LOD0", "LOD1", "LOD2"]) {
  const modelPath = overviewManifestItem.lodPaths?.[level];
  if (!modelPath) {
    throw new Error(`Approved plant overview is missing ${level}.`);
  }
  const absoluteModelPath = path.join(SHELL_ROOT, "public", modelPath.replace(/^\/models\//, "models/"));
  if (!fs.existsSync(absoluteModelPath)) {
    throw new Error(`Approved plant overview ${level} file does not exist: ${absoluteModelPath}`);
  }
}

if (
  b25BindingContract.status !== "FORMAL_READ_ONLY_IDENTITY"
  || b25BindingContract.authoritative !== false
) {
  throw new Error("B25 v2 binding contract must be formal identity-only and globally non-authoritative.");
}
if (
  b25BindingContract.authority?.identity !== true
  || b25BindingContract.authority?.telemetry !== false
  || b25BindingContract.authority?.geometryTopology !== false
) {
  throw new Error("B25 v2 authority must be identity=true, telemetry=false, geometryTopology=false.");
}
if (b25BindingContract.controlBoundary !== "visualization_only_no_ba_plc_write") {
  throw new Error("B25 binding contract must forbid BA/PLC writes.");
}

const accessPolicy = b25BindingContract.accessPolicy || {};
if (
  accessPolicy.readOnly !== true
  || JSON.stringify(accessPolicy.allowedMethods) !== JSON.stringify(["GET"])
  || !Array.isArray(accessPolicy.writeEndpoints)
  || accessPolicy.writeEndpoints.length !== 0
) {
  throw new Error("B25 binding access must be read-only GET with an empty writeEndpoints list.");
}
const reviewedReadEndpoints = new Set([
  "/bff/v1/sites/{siteId}/runtime/summary",
  "/bff/v1/sites/{siteId}/devices/list"
]);
if (
  !Array.isArray(accessPolicy.readEndpoints)
  || accessPolicy.readEndpoints.length !== reviewedReadEndpoints.size
  || accessPolicy.readEndpoints.some((endpoint) => (
    endpoint?.method !== "GET" || !reviewedReadEndpoints.has(endpoint?.path)
  ))
) {
  throw new Error("B25 binding contract may read only the reviewed runtime-summary and device-list GET endpoints.");
}

if (
  b25BindingContract.statePolicy?.finiteValueWithoutAuthoritativePointObservedAt !== "STALE"
  || b25BindingContract.statePolicy?.nullValue !== "UNBOUND"
) {
  throw new Error("B25 point-state boundary must keep finite/no-observedAt as STALE and null as UNBOUND.");
}
if (
  b25BindingContract.statePolicy?.allowedStates?.includes("SHADOW")
  || b25BindingContract.statePolicy?.allowedStates?.includes("DEMO")
) {
  throw new Error("B25 SHADOW and DEMO are display modes and must not become evidence states.");
}
const shadowAnimationPolicy = b25BindingContract.shadowAnimationPolicy || {};
if (
  shadowAnimationPolicy.mode !== "shadow-read-only"
  || shadowAnimationPolicy.evidenceState !== "STALE"
  || shadowAnimationPolicy.authority !== "unverified"
  || shadowAnimationPolicy.maxTransportEnvelopeAgeMs !== 30000
  || shadowAnimationPolicy.transportTimestampField !== "pointEvidence.receivedAt"
  || shadowAnimationPolicy.transportTimestampIsObservedAt !== false
  || shadowAnimationPolicy.exactSelectorRequired !== true
  || shadowAnimationPolicy.sourceHealthyNonFallbackRequired !== true
  || shadowAnimationPolicy.badQualityRejected !== true
  || JSON.stringify(shadowAnimationPolicy.equipmentMotion) !== JSON.stringify(["pump_shaft", "cooling_tower_fan"])
  || shadowAnimationPolicy.flowMotion !== "paused"
  || shadowAnimationPolicy.auditContribution !== "none"
  || shadowAnimationPolicy.controlBoundary !== "visualization_only_no_ba_plc_write"
) {
  throw new Error("B25 SHADOW policy must stay STALE, transport-bounded, equipment-only, audit-neutral and no-write.");
}

const expectedB25Bindings = [
  ...["7", "8", "9", "10", "11", "12", "159"].map((deviceId, index) => ({
    equipmentId: `CH${index + 1}`,
    runtimeGroup: "chillers",
    runtimeId: `CH${index + 1}`,
    deviceId,
    deviceIdRef: deviceId,
    match: "exact"
  })),
  ...["1", "2", "3", "4", "5", "6", "158"].map((deviceId, index) => ({
    equipmentId: `CHWP${index + 1}`,
    runtimeGroup: "chilledPumps",
    runtimeId: `CHP${index + 1}`,
    deviceId,
    deviceIdRef: deviceId,
    match: "explicit_alias"
  })),
  ...["47", "48", "49", "50", "51", "52", "160"].map((deviceId, index) => ({
    equipmentId: `CWP${index + 1}`,
    runtimeGroup: "coolingPumps",
    runtimeId: `CWP${index + 1}`,
    deviceId,
    deviceIdRef: deviceId,
    match: "exact"
  })),
  ...[
    "CTF11", "CTF12", "CTF13", "CTF14", "CTF15", "CTF16",
    "CTF21", "CTF22", "CTF23", "CTF24", "CTF25", "CTF26",
    "CTF31", "CTF32", "CTF33", "CTF34", "CTF35", "CTF36",
    "CTF41", "CTF42", "CTF43", "CTF44", "CTF45", "CTF46",
    "CTF51", "CTF52", "CTF53", "CTF54", "CTF55", "CTF56",
    "CTF61", "CTF62", "CTF63"
  ].map((runtimeId, index) => ({
    equipmentId: `CT${String(index + 1).padStart(2, "0")}`,
    runtimeGroup: "coolingTowers",
    runtimeId,
    deviceId: String(index + 13),
    deviceIdRef: String(index + 13),
    match: "explicit_alias"
  }))
];
const actualB25Bindings = b25BindingContract.bindings || [];
if (actualB25Bindings.length !== 54 || expectedB25Bindings.length !== 54) {
  throw new Error("B25 formal identity contract must contain exactly 54 explicit model mappings.");
}
const actualBindingByEquipmentId = new Map(
  actualB25Bindings.map((binding) => [binding.equipmentId, binding])
);
if (actualBindingByEquipmentId.size !== 54) {
  throw new Error("B25 formal identity contract must not contain duplicate model equipment IDs.");
}
for (const expected of expectedB25Bindings) {
  const actual = actualBindingByEquipmentId.get(expected.equipmentId);
  if (!actual || Object.entries(expected).some(([key, value]) => actual[key] !== value)) {
    throw new Error(`B25 explicit identity mapping is missing or incorrect: ${expected.equipmentId}.`);
  }
}
if (
  new Set(actualB25Bindings.map((binding) => binding.runtimeId)).size !== 54
  || new Set(actualB25Bindings.map((binding) => binding.deviceIdRef)).size !== 54
) {
  throw new Error("B25 runtime IDs and deviceIdRefs must remain one-to-one across all 54 mappings.");
}
const chilledPumpAliases = actualB25Bindings.filter((binding) => binding.equipmentId?.startsWith("CHWP"));
if (
  chilledPumpAliases.length !== 7
  || chilledPumpAliases.some((binding, index) => (
    binding.match !== "explicit_alias" || binding.runtimeId !== `CHP${index + 1}`
  ))
) {
  throw new Error("All seven CHWP model pumps must explicitly alias to B25 CHP1-CHP7.");
}
if (
  b25BindingContract.coverage?.explicitMappings !== "54/54"
  || b25BindingContract.coverage?.chillers !== "7/7"
  || b25BindingContract.coverage?.chilledWaterPumps !== "7/7"
  || b25BindingContract.coverage?.coolingWaterPumps !== "7/7"
  || b25BindingContract.coverage?.coolingTowerFans !== "33/33"
) {
  throw new Error("B25 identity coverage must remain 7CH + 7CHP + 7CWP + 33CTF = 54/54.");
}

const expectedAssetBudget = {
  explicitBindings: 54,
  embeddedAnimations: 63,
  runtimeAnimationTargets: 62
};
for (const [key, value] of Object.entries(expectedAssetBudget)) {
  if (b25BindingContract.assetBudget?.[key] !== value) {
    throw new Error(`B25 binding asset budget ${key} must remain ${value}.`);
  }
}
if (
  overviewManifestItem.bindingContractPath !== "/models/plant-overview/bindings/b25-plant-overview-binding-v2.json"
  || overviewManifestItem.bindingContractStatus !== "FORMAL_READ_ONLY_IDENTITY"
  || overviewManifestItem.authoritative !== false
  || overviewManifestItem.authority?.identity !== true
  || overviewManifestItem.authority?.telemetry !== false
  || overviewManifestItem.authority?.geometryTopology !== false
) {
  throw new Error("Plant-overview manifest metadata must mirror the B25 v2 identity authority boundary.");
}
if (
  overviewManifestItem.controlBoundary?.readOnly !== true
  || JSON.stringify(overviewManifestItem.controlBoundary?.allowedMethods) !== JSON.stringify(["GET"])
  || !Array.isArray(overviewManifestItem.controlBoundary?.writeEndpoints)
  || overviewManifestItem.controlBoundary.writeEndpoints.length !== 0
) {
  throw new Error("Plant-overview manifest metadata must preserve the read-only GET/no-write boundary.");
}
if (overviewManifestItem.siteIdentityCoverage?.explicitBindings !== 54) {
  throw new Error("Plant-overview manifest metadata must lock 54 explicit B25 identity bindings.");
}
for (const level of ["LOD0", "LOD1", "LOD2"]) {
  const contractBudget = b25BindingContract.assetBudget?.lodParity?.[level];
  const manifestBudget = overviewManifestItem.lodAnimationBudget?.[level];
  if (
    contractBudget?.embeddedAnimations !== 63
    || contractBudget?.runtimeAnimationTargets !== 62
    || manifestBudget?.embeddedAnimations !== 63
    || manifestBudget?.runtimeAnimationTargets !== 62
  ) {
    throw new Error(`${level} must stay synchronized at 63 animations and 62 runtime targets.`);
  }
}

assertContains(schematicSource, 'viewBox="0 0 1000 560"', "2D hydraulic diagram must keep a stable engineering canvas.");
assertContains(schematicSource, "markerEnd", "2D hydraulic pipes must expose flow direction.");
assertContains(schematicSource, "markerStart", "2D hydraulic pipes must expose reverse flow direction.");
assertContains(schematicSource, "resolveSystemDiagramFlowVisualState", "2D flow must use the shared runtime flow contract.");
assertContains(schematicSource, 'data-flow-evidence={flowState.evidence}', "2D flow must expose telemetry versus schematic evidence.");
assertContains(schematicSource, 'data-flow-active={flowState.active ? "true" : "false"}', "2D flow must expose active versus stopped state.");
assertContains(schematicSource, 'pathLength="100"', "2D flow segments must use normalized path animation.");
assertContains(schematicSource, "buildSchematicNodeGroups", "2D overview must group same-role equipment instead of stacking device cards.");
assertContains(schematicSource, "buildSchematicEdges", "2D overview must consolidate duplicate role-to-role pipes.");
assertContains(schematicSource, "memberIds.has(selectedNodeId)", "2D grouped equipment must preserve individual-node selection mapping.");
assertContains(schematicSource, "chiller-unit.png", "2D hydraulic diagram must use the real chiller asset.");
assertContains(schematicSource, "cooling-tower.png", "2D hydraulic diagram must use the real cooling-tower asset.");
assertContains(
  inspectorSource,
  "systemDiagramDataContractMissing",
  "Inspector must state when time-series operating points are unavailable."
);
assertContains(
  inspectorSource,
  "operationalEvidence && devicePageHref",
  "Inspector must suppress device links for non-operational evidence."
);

assertContains(sampleSource, 'label: "冷却供水阀门"', "Sample cooling valve must use the corrected supply-side role.");
assertContains(sampleSource, 'id: "edge-ct-to-cwp"', "Cooling-water supply must start at the cooling tower.");
assertContains(sampleSource, 'id: "edge-cwp-to-valve-cooling"', "Cooling-water supply must pass through the cooling pump.");
assertContains(sampleSource, 'id: "edge-valve-cooling-to-chiller"', "Cooling-water supply must enter the chiller after the valve.");
assertContains(sampleSource, 'id: "edge-chiller-to-ct"', "Cooling-water return must close from chiller to tower.");
assertContains(
  sampleSource,
  'id: "edge-chp-to-load"',
  "Chilled-water supply must retain the pump-to-load connection."
);
assertContains(
  diagramSource,
  "zhCN.sceneControl.systemDiagramLoadSide",
  "System diagram load-side label must remain localized."
);

assertContains(
  styleSource,
  ".app-shell > main:has(> .content.is-auto-twin-content)",
  "Auto-twin must size against the shell's remaining viewport row."
);
assertContains(
  styleSource,
  "grid-template-rows: auto auto minmax(0, 1fr);",
  "Auto-twin shell must reserve a flexible, non-overflowing content row."
);
assertContains(
  styleSource,
  ".auto-twin-stage .scene-system-diagram-shell",
  "Auto-twin must keep the Three.js stage unframed and full-width."
);
assertContains(styleSource, ".auto-twin-evidence-drawer", "Generation evidence must stay collapsible.");
assertContains(styleSource, ".auto-twin-sample-watermark", "Sample watermark styling must remain visible.");
assertContains(
  styleSource,
  ".scene-system-diagram-schematic-pipe .is-flow",
  "2D hydraulic flow lines must retain directional animation."
);
assertContains(styleSource, "--flow-duration", "2D flow speed must be driven by the shared flow state.");
assertContains(styleSource, ".scene-system-diagram-schematic-pipe.is-reverse .is-flow", "2D reverse flow must invert animation direction.");
assertContains(styleSource, ".scene-system-diagram-schematic-pipe.is-stopped .is-flow", "2D stopped flow must pause animation.");
assertContains(styleSource, "flex-wrap: nowrap;", "Mobile auto-twin controls must not wrap into an offscreen column.");
assertContains(styleSource, "@media (max-width: 760px)", "Auto-twin must retain its mobile layout contract.");
assertContains(mobileTouchSource, "min-height: 44px", "Auto-twin mobile action controls must keep 44px touch targets.");
assertContains(mobileTouchSource, ".auto-twin-segment button", "Auto-twin view and scope segments need mobile touch coverage.");

console.log("auto-twin UI contract passed");

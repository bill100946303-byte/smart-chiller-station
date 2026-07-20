import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(`${message}: missing ${JSON.stringify(expected)}`);
  }
}

function rejectText(source, rejected, message) {
  if (source.includes(rejected)) {
    throw new Error(`${message}: forbidden ${JSON.stringify(rejected)}`);
  }
}

function requireCount(source, expected, count, message) {
  const actual = source.split(expected).length - 1;
  if (actual !== count) {
    throw new Error(`${message}: expected ${count}, found ${actual}`);
  }
}

const power = read("src/pages/PowerMonitoringPage.tsx");
const terminal = read("src/pages/HvacTerminalMonitoringPage.tsx");
const styles = read("src/pages/DistributionEnergyWorkspace.css");
const terminalStyles = read("src/pages/HvacTerminalExtracted.css");

for (const [label, source, subsystemType, scope] of [
  ["power-monitoring", power, "power_monitoring", "project_aggregate"],
  ["hvac-terminal", terminal, "hvac_terminal", "fixed_floor"]
]) {
  requireText(source, "data-distribution-energy-workspace", `${label} workspace root is not inspectable`);
  requireText(source, `data-subsystem-type="${subsystemType}"`, `${label} subsystem type is missing`);
  requireText(source, `data-object-scope="${scope}"`, `${label} data scope is missing`);
  requireText(source, "distribution-workspace-title", `${label} page title contract is missing`);
  requireCount(source, "<h1", 1, `${label} must expose exactly one H1`);
}

requireText(power, "const byxPayloadReady", "power transport readiness is missing");
requireText(power, "const capabilityData = await fetchSiteCapabilities(siteId);", "power does not load current-site capability before provider data");
requireText(power, 'if (scopedPowerSubsystem?.status !== "enabled")', "power provider access is not blocked for unconfigured sites");
requireText(power, "const nextPowerData = await fetchByxPowerMonitoring(siteId);", "power provider read is missing after capability gate");
requireText(power, "const scopeReady = loadedSiteId === siteId", "power render does not bind payloads to the current site");
if (power.indexOf("fetchSiteCapabilities(siteId)") > power.indexOf("fetchByxPowerMonitoring(siteId)")) {
  throw new Error("power provider is accessed before current-site capability is proven");
}
if (power.indexOf('if (scopedPowerSubsystem?.status !== "enabled")') > power.indexOf("captureByxPowerHistorySnapshot(siteId)")) {
  throw new Error("power history can be written before the current-site capability gate");
}
requireText(power, "dataAgeMs <= FRESHNESS_BAD_MS", "power freshness gate is missing");
requireText(power, "const byxStale", "power stale state is missing");
requireText(power, "数据陈旧，停止判读", "power stale fail-close copy is missing");
requireText(power, "resolveStationMetric", "power fallback metrics do not use shared fail-close semantics");
requireText(power, 'fallbackMetric("1,286", "kW"', "power demo fallback is not explicitly routed");
requireText(power, "setPowerData(null);", "power transport failure does not clear stale payloads");
requireText(power, "data-power-scope-summary", "power current-project scope summary is not inspectable");
requireText(power, "当前范围", "power project-aggregate scope summary is missing");
requireText(power, "当前项目电力汇总", "power project-aggregate scope is not visible");
rejectText(power, "<span>配置中心链路</span>", "power configuration status is still presented as live telemetry");
rejectText(power, "function metricValue(", "power retains optimistic legacy metric fallback");
rejectText(power, 'loading" : "unknown', "power renders raw English source codes");

requireText(terminal, "const fanCoilPayloadReady", "terminal payload readiness is missing");
requireText(terminal, "const fanCoilFreshnessStale", "terminal stale state is missing");
requireText(terminal, "fanCoilAgeMs > HVAC_TERMINAL_STALE_MS", "terminal age gate is missing");
requireText(terminal, "fanCoils?.freshness?.stale === true", "terminal backend freshness evidence is ignored");
requireText(terminal, "BA 快照数据已超过 5 分钟", "terminal stale fail-close copy is missing");
requireText(terminal, "fanCoilReady && fcuExecutionGate?.dispatchAllowed", "terminal aggregate write gate ignores snapshot freshness");
requireText(terminal, "fanCoilReady && selectedCommissioning?.canDispatch", "terminal per-device write gate ignores snapshot freshness");
requireText(terminal, "前端不直写 BA/PLC", "terminal write boundary is missing");
requireText(terminal, "当前范围", "terminal fixed-floor scope summary is missing");
requireText(terminal, "配置中心链路", "terminal configuration status is mislabeled as live telemetry");
requireText(terminal, "setCapabilities(null);", "terminal capability failure does not fail closed");
requireText(terminal, "isCurrentSiteFanCoilSnapshot(snapshot, siteId)", "terminal does not verify snapshot project scope before loading control evidence");
requireText(terminal, "hasFanCoilOperationalEvidence(snapshot)", "terminal loads control evidence without a current operational snapshot");
requireText(terminal, "isCurrentSiteFinalControlStatus(finalStatusResult.value, siteId)", "terminal accepts unscoped final-control evidence");
requireText(terminal, "clearFcuOperationalEvidence();", "terminal does not clear cross-project operational evidence fail-closed");
requireText(terminal, "resolveAuthProjectDisplayName", "terminal demo copy is not bound to the current project");
rejectText(terminal, "盛世绿能办公楼为空调末端演示配置", "terminal demo copy leaks a fixed project name");
requireText(terminal, "data-fcu-evidence-scope-locked", "terminal does not disclose why acceptance evidence is locked");
requireText(terminal, "disabled={!fanCoilReady || finalStatusRefreshing}", "terminal can refresh acceptance without a current-project snapshot");
requireText(terminal, "if (!fanCoilReady || finalStatusRefreshing)", "terminal acceptance refresh handler lacks a snapshot gate");
requireText(terminal, 'data-terminal-runtime-ready={fanCoilReady ? "true" : "false"}', "terminal runtime readiness is not inspectable for layout fail-close");
requireText(terminal, "fcu-control-card--scope-locked", "terminal missing-data state still mounts the full commissioning console");

requireText(styles, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important", "distribution mobile summary is not readable");
requireText(styles, ".power-monitor-summary > div:last-child", "distribution fifth summary item does not span the mobile row");
requireText(styles, ".distribution-energy-workspace.hvac-terminal-page) .power-monitor-hero .power-monitor-summary", "terminal station summary remains hidden by compact desktop CSS");
requireText(styles, ".distribution-critical-banner", "terminal critical warning remains hidden by compact desktop CSS");
requireText(terminalStyles, '.hvac-terminal-page--overview[data-terminal-runtime-ready="false"]', "terminal missing-data overview does not use a compact explicit row contract");
requireText(terminalStyles, ".fcu-scope-lock-grid", "terminal missing-data onboarding steps are not laid out explicitly");
requireText(terminalStyles, "grid-template-columns: minmax(0, 1fr)", "terminal missing-data onboarding is not mobile-readable");

console.log("distribution energy workspace contract OK");

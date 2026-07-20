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

const air = read("src/pages/CompressedAirMonitoringPage.tsx");
const boiler = read("src/pages/BoilerRoomMonitoringPage.tsx");
const status = read("src/utils/stationWorkspacePresentation.ts");
const styles = read("src/pages/EnergyStationWorkspace.css");

for (const [label, source, subsystemType] of [
  ["compressed-air", air, "compressed_air"],
  ["boiler-room", boiler, "boiler_room"]
]) {
  requireText(source, "data-energy-station-workspace", `${label} workspace root is not inspectable`);
  requireText(source, `data-subsystem-type="${subsystemType}"`, `${label} subsystem scope is missing`);
  requireText(source, "data-subsystem-status={statusPresentation.kind}", `${label} status kind is not disclosed`);
  requireText(source, 'data-station-scope={runtimeScopeApplied ? "station_binding"', `${label} type/instance scope is not disclosed`);
  requireText(source, "data-station-runtime-applied={runtimeScopeApplied", `${label} runtime binding application state is not inspectable`);
  requireText(source, "fetchRuntimePointSummary", `${label} physical station does not request its runtime summary`);
  requireText(source, "isAppliedStationRuntimeScope", `${label} does not validate per-response station binding evidence`);
  requireText(source, "stationProcess", `${label} does not consume normalized station-process evidence`);
  requireText(source, `item.parentSubsystemType === "${subsystemType}"`, `${label} station instances are not filtered`);
  requireText(source, "setCapabilities(null);", `${label} capability fetch does not fail closed`);
  requireText(source, "resolveStationMetric", `${label} metrics do not use shared fail-closed semantics`);
  requireText(source, "配置中心链路", `${label} configuration transport label is ambiguous`);
  requireText(source, "接入与控制边界", `${label} access boundary panel is missing`);
  requireText(source, "实体站房登记", `${label} physical station registration is missing`);
  requireText(source, "当前数据范围", `${label} data scope is missing`);
  requireText(source, "station-process-evidence", `${label} process canvas lacks engineering evidence`);
  requireText(source, "数据采集", `${label} acquisition boundary is missing`);
  requireText(source, "优化目标", `${label} optimization objective is missing`);
  requireText(source, "执行方式", `${label} execution mode is missing`);
  requireText(source, "安全回退", `${label} fallback boundary is missing`);
  requireText(source, 'appendSiteIdToPath("/config-center", siteId)', `${label} energy configuration link loses site scope`);
  rejectText(source, 'appendSiteIdToPath("/energy-config", siteId)', `${label} retains the removed energy-config route`);
  requireText(source, 'appendSiteIdToPath("/alarms", siteId)', `${label} alarm link loses site scope`);
  requireText(source, "项目级告警", `${label} alarm link does not disclose project scope`);
  requireCount(source, "<h1", 1, `${label} must expose exactly one H1`);
  rejectText(source, "function metricValue(", `${label} retains optimistic legacy metric fallback`);
}

for (const expected of [
  'case "stale"',
  'case "error"',
  'case "not_configured"',
  'value: "不可用"',
  'note: "数据陈旧，停止判读"',
  'note: "状态待核，停止判读"'
]) {
  requireText(status, expected, "station metric status coverage is incomplete");
}

requireText(air, 'compressedAirMetrics?.pressureBar, "bar", "6.8"', "compressed-air demo pressure must use a consistent bar value");
rejectText(air, 'compressedAirMetrics?.pressureBar, "bar", "0.68"', "compressed-air demo pressure retains the MPa-like value with a bar label");
requireText(air, "resolveAuthProjectDisplayName", "compressed-air demo copy is not bound to the current project");
rejectText(air, "盛世绿能办公楼为空压演示数据", "compressed-air demo copy leaks a fixed project name");
requireText(boiler, '<StatTile title="热媒温度"', "boiler thermal-medium temperature label is missing");
rejectText(boiler, '供回水 / 蒸汽温度', "boiler KPI still merges hot-water and steam measurement semantics");

requireText(styles, "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(280px, 0.8fr)", "desktop station bento is missing");
requireText(styles, ".station-process-card", "process card placement is missing");
requireText(styles, ".station-device-card", "device card placement is missing");
requireText(styles, ".station-boundary-card", "boundary card placement is missing");
requireText(styles, "min-height: 44px", "mobile action target is too small");
requireText(styles, "Mobile station truth-card readability guard", "mobile runtime truth-card readability guard is missing");
requireText(styles, ".power-monitor-subtitle", "mobile station subtitle wrap override is missing");
requireText(styles, "overflow-wrap: anywhere !important", "mobile station runtime truth must wrap instead of ellipsizing");
requireText(styles, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important", "mobile station summary is not readable");
requireText(styles, ".power-monitor-summary > div:last-child", "mobile fifth summary item does not span the row");
requireText(styles, "@media (max-height: 860px) and (min-width: 1440px)", "short desktop layout guard is missing");
requireText(styles, "grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.78fr) minmax(340px, 0.92fr)", "short desktop three-card row is missing");
requireText(styles, "@media (max-height: 860px) and (min-width: 721px) and (max-width: 1439px)", "medium short-screen scroll guard is missing");

console.log("energy station workspace contract OK");

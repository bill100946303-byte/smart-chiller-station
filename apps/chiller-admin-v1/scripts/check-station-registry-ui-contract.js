import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(scriptDir, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(adminRoot, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

function requireAbsent(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(message);
  }
}

function functionBlock(source, name, nextName) {
  const pattern = new RegExp(
    `export async function ${name}\\([\\s\\S]+?\\n}\\n\\nexport async function ${nextName}\\(`
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Cannot locate ${name} contract block`);
  }
  return match[0];
}

const app = read("src/App.tsx");
const siteDetail = read("src/pages/SiteDetailPage.tsx");
const page = read("src/pages/StationRegistryPage.tsx");
const css = read("src/pages/StationRegistryPage.css");
const client = read("src/services/adminClient.ts");
const auth = read("src/services/adminAuth.ts");
const types = read("src/services/adminTypes.ts");
const mocks = read("src/services/adminMocks.ts");

requireText(app, 'path="/sites/:siteId/stations"', "physical station registry route is missing");
requirePattern(siteDetail, /navigate\(`\/sites\/\$\{encodeURIComponent\(siteId\)\}\/stations`\)/, "site detail does not link to the physical station registry");
requireText(page, "data-station-registry-page", "station registry page lacks a stable root hook");
requireText(page, "listStationInstances(session.token", "station registry does not read the real list endpoint");
requireText(page, "listSiteSubsystems(session.token", "station registry does not reconcile parent types with current-site capability state");
requireText(page, "updateStationInstances(", "station registry does not write through the strict client");

for (const field of [
  "stationId",
  "stationName",
  "parentSubsystemType",
  "status",
  "sourceStatus",
  "freshnessStatus",
  "sortOrder",
  "published"
]) {
  requireText(types, `${field}:`, `AdminStationInstance is missing ${field}`);
}

requireText(types, "platformRole: AdminRole | null", "role claims do not preserve platformRole");
requireText(types, "siteRoles: AdminSiteRoleBinding[]", "role claims do not preserve site-scoped roles");
requireText(auth, "roles: normalizeRoleClaims(candidate.roles)", "session parsing drops role claims");
requireText(auth, "roles: normalizeRoleClaims(me.roles)", "login persistence drops role claims");
requirePattern(
  auth,
  /session\.roles\?\.platformRole === "platform_admin"[\s\S]+?binding\.scopeId === normalizedSiteId && binding\.role === "site_admin"/,
  "site write authorization is not based on explicit current-site claims"
);
requireAbsent(
  auth.match(/export function canAdminSessionWriteSite[\s\S]+?\n}/)?.[0] || "",
  /session\.role\s*===/,
  "effective session.role must not authorize current-site writes"
);

const getMeBlock = functionBlock(client, "getAdminMe", "getAdminBackendHealth");
requireText(getMeBlock, "runtimeConfig.useMockData", "admin me mock use is not explicit");
requireText(getMeBlock, 'await requestJson<unknown>("/admin/v1/me"', "real admin me does not use a strict request");
requireText(getMeBlock, "ADMIN_ME_CONTRACT_INVALID", "malformed admin me responses are not rejected");
requireAbsent(getMeBlock, /\|\|\s*createMockMe/, "real admin me response can still fall back to fake roles");

const listBlock = functionBlock(client, "listStationInstances", "updateStationInstances");
const updateBlock = functionBlock(client, "updateStationInstances", "updateSiteSubsystems");
const parentListBlock = functionBlock(client, "listStationParentSubsystems", "listStationInstances");
const physicalParentSetStart = client.indexOf("const PHYSICAL_STATION_PARENT_SUBSYSTEM_TYPES");
const physicalParentSetEnd = client.indexOf("]);", physicalParentSetStart);
const physicalParentSetBlock = client.slice(physicalParentSetStart, physicalParentSetEnd + 3);
for (const parentType of ["chilled_plant", "compressed_air", "boiler_room"]) {
  requireText(physicalParentSetBlock, `"${parentType}"`, `physical station parent allowlist is missing ${parentType}`);
}
requireAbsent(
  physicalParentSetBlock,
  /power_monitoring|hvac_terminal/,
  "distribution/consumption systems must not be selectable as physical station parents"
);
requireText(client, "filterStationParentSubsystems", "station parent registry lacks a physical-parent filter");
requireText(parentListBlock, "filterStationParentSubsystems", "station parent API exposes non-physical subsystem types");
requireText(listBlock, "runtimeConfig.useMockData", "station list mock use is not explicit");
requireText(listBlock, "requestJson<unknown>", "real station list does not use a strict request");
requireAbsent(listBlock, /requestOrMock/, "real station list can silently fall back to mock");
requireText(updateBlock, 'method: "PUT"', "station registry write does not use PUT");
requireText(updateBlock, "assertStationInstanceListContract", "station write response is not contract-checked");
requireAbsent(updateBlock, /requestOrMock/, "real station write can silently fall back to mock");
requireText(client, "responseSiteId !== expectedSiteId", "station response siteId is not verified");
requireText(client, "requiredStationIds.some", "submitted station identities are not verified in the response");
requireText(client, "rawItemInvalid", "raw station response fields are not validated before normalization");
requireText(client, 'typeof item.published !== "boolean"', "published response field is not strictly validated");
requireText(client, "typeof item.sortOrder !== \"number\"", "sortOrder response field is not strictly validated");

requirePattern(
  client,
  /const writeAllowed = ok && readOnlyMode === false/,
  "backend health does not fail closed unless readOnlyMode is explicitly false"
);
const healthBlock = functionBlock(client, "getAdminBackendHealth", "listAdminSites");
requirePattern(
  healthBlock,
  /writeAllowed: false[\s\S]+?source: "unavailable"/,
  "unavailable backend health does not fail closed"
);
requirePattern(
  page,
  /roleWriteAllowed &&[\s\S]+?backendHealth\.writeAllowed &&[\s\S]+?runtimeConfig\.readOnlyMode !== true/,
  "page write gate does not combine site role, server health, and local read-only mode"
);
requireText(page, "latestHealth = await getAdminBackendHealth()", "save does not re-check server health");
requireText(page, "latestStations = await listStationInstances(", "save does not re-read the current server registry");
requireText(page, "latestPersisted?.published", "save does not lock a row that became published remotely");
requireText(page, "persistedRecordLocked", "published rows are not locked in the editor");
requireText(page, "站房身份发布后保持锁定", "published identity lock is not disclosed");
requireText(page, "data-station-create-action", "read-only station registry must keep the create action visible");
requirePattern(
  page,
  /disabled=\{!canWrite \|\| saving\}[\s\S]+?登记站房（只读）/,
  "station create action must disclose and enforce the read-only gate"
);
requireText(page, 'title="可登记供能类型"', "registry summary does not distinguish available parent types from registered types");
requireText(page, "data-station-parent-count", "empty registry does not expose the actual available parent-type count");
requireText(page, "parentCapabilityByType", "station parent choices do not disclose current-site capability state");
requireText(page, "已启用 ${enabledParentTypeCount} · 待配置 ${pendingParentTypeCount}", "parent-type summary does not separate enabled and pending configuration");
requireText(page, "当前写入保护已开启；请在受控配置变更窗口开放后登记", "read-only empty state gives the wrong next step");
requireText(page, "运行数据绑定请在独立页面按草稿、真实验证和发布版本维护", "runtime-binding version separation is not disclosed");
requireText(page, "publishConfirmArmed", "publishing lacks an explicit confirmation gate");
requireText(page, "立即进入 3001 运行端站房清单", "publish confirmation does not disclose immediate visibility");
requireText(page, "本地 MOCK｜不写真实配置库", "explicit mock mode is not visibly separated from the real configuration store");
requireText(
  page,
  "data-station-runtime-status-derived",
  "station identity editor does not disclose that runtime status is evidence-derived"
);
requireAbsent(
  page,
  /<select[^>]+value=\{draft\.(?:sourceStatus|freshnessStatus)\}/,
  "station identity editor still allows operators to declare live/fresh runtime state"
);
requireAbsent(
  page,
  /patchDraft\(\{\s*(?:sourceStatus|freshnessStatus|alarmCount)\s*:/,
  "station identity editor still mutates evidence-derived runtime fields"
);
const stationPayloadStart = page.indexOf("const payload: Partial<AdminStationInstance> = {");
const stationPayloadEnd = page.indexOf("const updated = await updateStationInstances", stationPayloadStart);
const stationPayloadBlock = page.slice(stationPayloadStart, stationPayloadEnd);
requireAbsent(
  stationPayloadBlock,
  /\b(?:sourceStatus|freshnessStatus|alarmCount)\s*:/,
  "station identity PUT still submits operator-authored runtime evidence"
);
requirePattern(
  page,
  /\^\[A-Za-z0-9\]\(\?:\[A-Za-z0-9\._-\]\{0,62\}\[A-Za-z0-9\]\)\?\$/,
  "stationId validation does not match the BFF stable identifier contract"
);

requirePattern(
  mocks,
  /stationInstances\s*=\s*Object\.fromEntries\(sites\.map\(\(site\)\s*=>\s*\[site\.siteId, \[\]/,
  "mock registry must start empty instead of inventing physical stations"
);
requireText(css, ".station-registry-published-lock", "published lock has no visible treatment");
requireText(css, ".station-registry-empty-types", "empty registry parent-type disclosure has no styling");
requireText(css, ".station-registry-actions [data-station-create-action]:disabled", "read-only create action must remain visibly legible");
requireText(css, "@media (max-width: 860px)", "station registry lacks compact responsive layout");
requirePattern(
  css,
  /@media \(max-width: 860px\)[\s\S]+?\.station-registry-hero \.admin-hero-panel \{[\s\S]+?flex: 0 1 auto;/,
  "mobile station hero must reset the desktop flex basis instead of creating a tall empty block"
);
requirePattern(
  css,
  /@media \(max-width: 860px\)[\s\S]+?\.station-registry-page \.admin-summary-grid \{[\s\S]+?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  "mobile station summary must use a compact two-column scan before the empty-state decision"
);
requirePattern(
  css,
  /@media \(max-width: 360px\)[\s\S]+?\.station-registry-page \.admin-summary-grid \{[\s\S]+?grid-template-columns: 1fr;/,
  "narrow mobile station summary must fall back to one column"
);

console.log("station registry UI contract: OK");
console.log("- strict GET/PUT and response identity checks: OK");
console.log("- current-site claims + server health fail-closed gate: OK");
console.log("- empty registry truth + published-row lock + compact mobile summary: OK");

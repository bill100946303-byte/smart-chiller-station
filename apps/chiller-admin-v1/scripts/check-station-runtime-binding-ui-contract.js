import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function rejectText(source, rejected, message) {
  if (source.includes(rejected)) throw new Error(message);
}

const app = read("src/App.tsx");
const page = read("src/pages/StationRuntimeBindingPage.tsx");
const client = read("src/services/adminClient.ts");
const types = read("src/services/adminTypes.ts");
const registry = read("src/pages/StationRegistryPage.tsx");
const bindingStyles = read("src/pages/StationRuntimeBindingPage.css");

requireText(app, "/sites/:siteId/stations/:stationId/runtime-binding", "runtime-binding admin route is missing");
requireText(registry, "运行绑定", "station registry lacks a runtime-binding entry");
requireText(registry, "/runtime-binding", "station registry runtime-binding target is missing");
requireText(page, "data-binding-version-separation", "draft and published heads are not separated visibly");
requireText(page, "保存新草稿不会让已发布版本下线", "draft save continuity disclosure is missing");
requireText(page, "执行真实只读验证", "real read-only validation action is missing");
requireText(page, "发布不等于运行已验证", "publish/runtime-evidence boundary is missing");
requireText(page, "session?.roles?.platformRole === \"platform_admin\"", "platform-admin publish gate is missing");
requireText(page, "selfApprovalBlocked", "editor self-approval gate is missing");
requireText(page, "expectedVersion", "optimistic concurrency token is missing");
requireText(page, "DEVICE_ID_CODE_PAIRING_MISMATCH", "device identity pairing evidence is missing");
requireText(page, "DEVICE_IDS_AMBIGUOUS", "duplicate device-id failure evidence is missing");
requireText(page, "POINT_CODES_AMBIGUOUS", "ambiguous point-code failure evidence is missing");
requireText(page, "PLACEHOLDER_OR_FALLBACK_FORBIDDEN", "placeholder/fallback failure evidence is missing");
requireText(types, "deviceIds?: string[]", "ambiguous device-id result type is missing");
requireText(client, "deviceIds: normalizeStringList(ambiguous.deviceIds)", "ambiguous device-id result normalization is missing");
requireText(client, "saveStationRuntimeBindingDraft", "draft client is missing");
requireText(client, "validateStationRuntimeBindingDraft", "validation client is missing");
requireText(client, "publishStationRuntimeBindingDraft", "publish client is missing");
requireText(client, "STATION_RUNTIME_BINDING_CONTRACT_INVALID", "binding response identity contract is missing");
requireText(types, "draftBinding: AdminStationRuntimeBinding | null", "draft head type is missing");
requireText(types, "publishedBinding: AdminStationRuntimeBinding | null", "published head type is missing");
requireText(client, "item.alarmCount === null", "unknown station alarm count must be contract-valid");
requireText(client, "normalizeSiteSourceStatus(value.sourceStatus)", "site source health must be evidence-derived");
requireText(bindingStyles, ".station-binding-hero .admin-hero-panel {\n    flex: 0 1 auto;", "mobile runtime-binding hero must collapse to content height");
rejectText(page, "password", "runtime-binding UI must not accept credentials");
rejectText(page, "legacyBaseUrl", "runtime-binding UI must not accept arbitrary upstream URLs");

console.log("station runtime binding UI contract: OK");
console.log("- draft/published continuity + expectedVersion: OK");
console.log("- real validation + platform publish + self-approval gate: OK");
console.log("- no credentials/arbitrary URL + unknown alarm truth: OK");
console.log("- mobile hero collapses to content height: OK");

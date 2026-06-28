import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeBooleanEnv(value, fallback = false) {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function normalizeListEnv(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveAppModeLabel(appMode) {
  if (process.env.APP_MODE_LABEL) {
    return process.env.APP_MODE_LABEL;
  }
  if (appMode === "remote-integration") {
    return "远端联调";
  }
  return "本地开发";
}

const appMode = process.env.APP_MODE || "local";

export const config = {
  port: Number(process.env.BFF_PORT || 8787),
  appMode,
  appModeLabel: resolveAppModeLabel(appMode),
  readOnlyMode: normalizeBooleanEnv(process.env.READ_ONLY_MODE, false),
  legacyBaseUrl: (process.env.LEGACY_BASE_URL || "https://www.ssge.com.cn:8098").replace(/\/+$/, ""),
  realtimeParamsBaseUrl:
    (process.env.REALTIME_PARAMS_BASE_URL || "https://ln.szgreenenergy.com").replace(/\/+$/, ""),
  realtimeParamsTimeoutMs: Number(process.env.REALTIME_PARAMS_TIMEOUT_MS || 1500),
  byxPowerBaseUrl: (process.env.BYX_POWER_BASE_URL || "").replace(/\/+$/, ""),
  byxPowerApp: process.env.BYX_POWER_APP || "",
  byxPowerPublicKey: process.env.BYX_POWER_PUBLIC_KEY || "",
  byxPowerLoginId: process.env.BYX_POWER_LOGIN_ID || "",
  byxPowerTimeoutMs: Number(process.env.BYX_POWER_TIMEOUT_MS || 3000),
  byxPowerHistoryDir:
    process.env.BYX_POWER_HISTORY_DIR || path.resolve(__dirname, "../.local/byx-power-history"),
  byxPowerAssignmentFile:
    process.env.BYX_POWER_ASSIGNMENT_FILE || path.resolve(__dirname, "../.local/byx-power-assignments.json"),
  defaultSiteId: process.env.DEFAULT_SITE_ID || "126lnoffice",
  staleThresholdHours: Number(process.env.STALE_THRESHOLD_HOURS || 24),
  adminDbFile: process.env.ADMIN_DB_FILE || path.resolve(__dirname, "../.local/admin.sqlite"),
  controlLedgerImportReportFile:
    process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_JSON ||
    path.resolve(__dirname, "../../../docs/optimize-demo-140-control-ledger-import-latest.json"),
  fieldDataPreflightReportFile:
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON ||
    path.resolve(__dirname, "../../../docs/optimize-demo-140-field-data-preflight-latest.json"),
  fieldDataPromoteReportFile:
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_JSON ||
    path.resolve(__dirname, "../../../docs/optimize-demo-140-field-data-promote-latest.json"),
  sensorLedgerPreflightReportFile:
    process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_JSON ||
    path.resolve(__dirname, "../../../docs/optimize-demo-140-sensor-ledger-preflight-latest.json"),
  fieldCollectionPackageReportFile:
    process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_JSON ||
    path.resolve(__dirname, "../../../docs/optimize-demo-140-field-collection-package-latest.json"),
  adminBootstrapUserIds: normalizeListEnv(process.env.ADMIN_BOOTSTRAP_USER_IDS),
  adminBootstrapUsernames: normalizeListEnv(process.env.ADMIN_BOOTSTRAP_USERNAMES),
  adminDevAuth: normalizeBooleanEnv(process.env.ADMIN_DEV_AUTH, false),
  adminDevAuthToken: process.env.ADMIN_DEV_AUTH_TOKEN || "",
  fieldDictionaryFile:
    process.env.FIELD_DICTIONARY_FILE ||
    path.resolve(__dirname, "../../../docs/field-dictionary.json"),
  hvacRulesFile:
    process.env.HVAC_RULES_FILE || path.resolve(__dirname, "../../../docs/hvac-rules-v1.yaml")
};

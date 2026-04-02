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
  legacyBaseUrl: (process.env.LEGACY_BASE_URL || "http://127.0.0.1:8098").replace(/\/+$/, ""),
  defaultSiteId: process.env.DEFAULT_SITE_ID || "126lnoffice",
  staleThresholdHours: Number(process.env.STALE_THRESHOLD_HOURS || 24),
  adminDbFile:
    process.env.ADMIN_DB_FILE || path.resolve(__dirname, "../.local/admin.sqlite"),
  adminBootstrapUserIds: normalizeListEnv(process.env.ADMIN_BOOTSTRAP_USER_IDS),
  adminBootstrapUsernames: normalizeListEnv(process.env.ADMIN_BOOTSTRAP_USERNAMES),
  fieldDictionaryFile:
    process.env.FIELD_DICTIONARY_FILE ||
    path.resolve(__dirname, "../../../docs/field-dictionary.json"),
  hvacRulesFile:
    process.env.HVAC_RULES_FILE || path.resolve(__dirname, "../../../docs/hvac-rules-v1.yaml")
};

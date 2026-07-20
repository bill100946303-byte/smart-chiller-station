function normalizeBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeCsvList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.replace(/\/+$/, "");
}

function resolveAppMode(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized || "local";
}

function resolveAppModeLabel(appMode: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized) {
    return normalized;
  }
  if (appMode === "remote-integration") {
    return "远端联调";
  }
  return "本地开发";
}

const appMode = resolveAppMode(import.meta.env.VITE_ADMIN_APP_MODE);

export const runtimeConfig = {
  appMode,
  appModeLabel: resolveAppModeLabel(appMode, import.meta.env.VITE_ADMIN_APP_MODE_LABEL),
  readOnlyMode: normalizeBooleanFlag(import.meta.env.VITE_ADMIN_READ_ONLY, false),
  useMockData: normalizeBooleanFlag(import.meta.env.VITE_ADMIN_USE_MOCKS, false),
  devLogin: normalizeBooleanFlag(import.meta.env.VITE_ADMIN_DEV_LOGIN, false),
  adminApiBaseUrl: normalizeUrl(import.meta.env.VITE_ADMIN_API_BASE_URL, "http://127.0.0.1:8787"),
  legacyBaseUrl: normalizeUrl(import.meta.env.VITE_LEGACY_BASE_URL, "http://127.0.0.1:8098"),
  defaultSiteId: (import.meta.env.VITE_ADMIN_DEFAULT_SITE_ID || "126lnoffice").trim(),
  bootstrapUserIds: normalizeCsvList(import.meta.env.VITE_ADMIN_BOOTSTRAP_USER_IDS),
  bootstrapUsernames: normalizeCsvList(import.meta.env.VITE_ADMIN_BOOTSTRAP_USERNAMES)
};

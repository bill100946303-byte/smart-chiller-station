import { getStoredProjectSiteId } from "../services/projectSession";
import { readSiteIdFromSearch } from "../services/siteRouting";

export type TrendRange = "24h" | "7d" | "30d";

function normalizeBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeTrendRange(value: string | undefined): TrendRange {
  if (value === "7d" || value === "30d") {
    return value;
  }
  return "24h";
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
  return "现场调试";
}

function resolveSiteId(): string {
  if (typeof window !== "undefined") {
    const routeSiteId = readSiteIdFromSearch(window.location.search);
    if (routeSiteId) {
      return routeSiteId;
    }
  }
  const storedSiteId = getStoredProjectSiteId();
  if (storedSiteId) {
    return storedSiteId;
  }
  return import.meta.env.VITE_SITE_ID || "126lnoffice";
}

const appMode = resolveAppMode(import.meta.env.VITE_APP_MODE);

export const runtimeConfig = {
  appMode,
  appModeLabel: resolveAppModeLabel(appMode, import.meta.env.VITE_APP_MODE_LABEL),
  readOnlyMode: normalizeBooleanFlag(import.meta.env.VITE_APP_READ_ONLY),
  get siteId() {
    return resolveSiteId();
  },
  trendRange: normalizeTrendRange(import.meta.env.VITE_TREND_RANGE),
  badgeStateUrl: import.meta.env.VITE_UI_BADGE_STATE_URL || "/ui-badge-state-v1.8.json",
  sceneBaseUrl: import.meta.env.VITE_SCENE_BASE_URL || "http://127.0.0.1:4000",
  legacyBaseUrl: import.meta.env.VITE_LEGACY_BASE_URL || "https://www.ssge.com.cn:8098"
};

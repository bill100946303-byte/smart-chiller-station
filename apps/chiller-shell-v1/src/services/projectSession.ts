import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "../utils/browserStorage";

export const PROJECT_STORAGE_KEY = "chiller-shell-project-v1";
export const PROJECT_VISIT_STATS_KEY = "chiller-shell-project-visit-stats-v1";

type StoredProjectSelection = {
  siteId: string;
  siteName?: string;
  selectedAt?: string;
};

export type StoredProjectVisitStat = {
  siteId: string;
  siteName?: string;
  visitCount: number;
  lastVisitedAt?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function getStoredProjectSelection(): StoredProjectSelection | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = safeLocalStorageGet(PROJECT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredProjectSelection>;
    const siteId = toOptionalString(parsed.siteId);
    if (!siteId) {
      return null;
    }
    return {
      siteId,
      siteName: toOptionalString(parsed.siteName),
      selectedAt: toOptionalString(parsed.selectedAt)
    };
  } catch {
    return null;
  }
}

export function getStoredProjectSiteId(): string | null {
  return getStoredProjectSelection()?.siteId || null;
}

export function setStoredProjectSelection(siteId: string, siteName?: string): void {
  if (!isBrowser()) {
    return;
  }

  safeLocalStorageSet(
    PROJECT_STORAGE_KEY,
    JSON.stringify({
      siteId,
      siteName,
      selectedAt: new Date().toISOString()
    } satisfies StoredProjectSelection)
  );
}

export function clearStoredProjectSelection(): void {
  if (!isBrowser()) {
    return;
  }
  safeLocalStorageRemove(PROJECT_STORAGE_KEY);
}

export function getProjectVisitStats(): Record<string, StoredProjectVisitStat> {
  if (!isBrowser()) {
    return {};
  }

  const raw = safeLocalStorageGet(PROJECT_VISIT_STATS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<StoredProjectVisitStat>>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([siteId, value]) => {
        const normalizedSiteId = toOptionalString(value?.siteId) || toOptionalString(siteId);
        if (!normalizedSiteId) {
          return [];
        }
        const visitCount =
          typeof value?.visitCount === "number" && Number.isFinite(value.visitCount) && value.visitCount > 0
            ? value.visitCount
            : 0;
        if (visitCount <= 0) {
          return [];
        }
        return [[
          normalizedSiteId,
          {
            siteId: normalizedSiteId,
            siteName: toOptionalString(value?.siteName),
            visitCount,
            lastVisitedAt: toOptionalString(value?.lastVisitedAt)
          } satisfies StoredProjectVisitStat
        ]];
      })
    );
  } catch {
    return {};
  }
}

export function recordProjectVisit(siteId: string, siteName?: string): void {
  if (!isBrowser()) {
    return;
  }

  const normalizedSiteId = toOptionalString(siteId);
  if (!normalizedSiteId) {
    return;
  }

  const currentStats = getProjectVisitStats();
  const current = currentStats[normalizedSiteId];
  currentStats[normalizedSiteId] = {
    siteId: normalizedSiteId,
    siteName: toOptionalString(siteName) || current?.siteName,
    visitCount: (current?.visitCount || 0) + 1,
    lastVisitedAt: new Date().toISOString()
  };

  safeLocalStorageSet(PROJECT_VISIT_STATS_KEY, JSON.stringify(currentStats));
}

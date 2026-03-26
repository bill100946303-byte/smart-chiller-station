export const PROJECT_STORAGE_KEY = "chiller-shell-project-v1";

type StoredProjectSelection = {
  siteId: string;
  siteName?: string;
  selectedAt?: string;
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

  const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
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

  window.localStorage.setItem(
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
  window.localStorage.removeItem(PROJECT_STORAGE_KEY);
}

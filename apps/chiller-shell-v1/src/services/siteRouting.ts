export const SITE_ID_QUERY_KEY = "siteId";
const SITE_ID_ALIASES: Record<string, string> = {
  "126lnoffice": "126"
};

function normalizeSiteId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeRouteSiteId(value: string | null | undefined): string | null {
  const normalized = normalizeSiteId(value);
  if (!normalized) {
    return null;
  }
  return SITE_ID_ALIASES[normalized.toLowerCase()] || normalized;
}

export function siteIdsEquivalent(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = normalizeRouteSiteId(left);
  const normalizedRight = normalizeRouteSiteId(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function readSiteIdFromSearch(search: string): string | null {
  if (!search) {
    return null;
  }
  return normalizeSiteId(new URLSearchParams(search).get(SITE_ID_QUERY_KEY));
}

export function appendSiteIdToPath(path: string, siteId: string | null | undefined): string {
  const normalizedSiteId = normalizeSiteId(siteId);
  if (!normalizedSiteId) {
    return path;
  }

  const [pathAndSearch, hash = ""] = path.split("#", 2);
  const [pathname = "", search = ""] = pathAndSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set(SITE_ID_QUERY_KEY, normalizedSiteId);
  const nextSearch = params.toString();
  const nextHash = hash ? `#${hash}` : "";
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash}`;
}

export function buildScopedLocationPath(
  pathname: string,
  search: string,
  hash: string,
  siteId: string | null | undefined
): string {
  return appendSiteIdToPath(`${pathname}${search}${hash}`, siteId);
}

const ALARM_DRAFT_TRANSIENT_QUERY_KEYS = [
  "source",
  "create",
  "alarmSiteId",
  "alarmId",
  "regId",
  "alarmTitle",
  "alarmSeverity",
  "alarmOccurredAt",
  "alarmDetail"
] as const;

/**
 * Removes route state that is only valid inside the project that created it.
 * Persistent filters may survive a project switch, but an alarm-derived work
 * order draft must never be carried into a different project.
 */
export function clearCrossProjectTransientContextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  if (params.get("source") === "alarm") {
    ALARM_DRAFT_TRANSIENT_QUERY_KEYS.forEach((key) => params.delete(key));
  }
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

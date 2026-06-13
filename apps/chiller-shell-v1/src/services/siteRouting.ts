export const SITE_ID_QUERY_KEY = "siteId";

function normalizeSiteId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
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

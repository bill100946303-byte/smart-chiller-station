import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEGACY_FCU_EVIDENCE_SITE_ID = "126lnoffice";

const DEFAULT_FCU_EVIDENCE_DIR = fileURLToPath(new URL("../../../../docs/", import.meta.url));

function normalizeSiteId(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim().toLowerCase();
}

export function slugifyFcuEvidenceSiteId(siteId) {
  const normalized = normalizeSiteId(siteId);
  if (/^[a-z0-9][a-z0-9_-]{0,127}$/.test(normalized)) {
    return normalized;
  }
  const readable = normalized
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "site";
  const digest = createHash("sha256").update(normalized || "unknown-site").digest("hex").slice(0, 10);
  return `${readable}-${digest}`;
}

/**
 * Keep the historic 126lnoffice artifacts in the existing flat docs directory,
 * while every additional site receives its own evidence namespace. This makes
 * the migration backward compatible and prevents a refresh for one site from
 * replacing another site's authoritative `*-latest` files.
 */
export function resolveFcuEvidenceDirectory(outputDir = "", siteId = "") {
  const baseDir = outputDir || DEFAULT_FCU_EVIDENCE_DIR;
  const normalizedSiteId = normalizeSiteId(siteId);
  if (!normalizedSiteId || normalizedSiteId === LEGACY_FCU_EVIDENCE_SITE_ID) {
    return baseDir;
  }
  return path.join(baseDir, "sites", slugifyFcuEvidenceSiteId(normalizedSiteId), "fcu-final-control");
}

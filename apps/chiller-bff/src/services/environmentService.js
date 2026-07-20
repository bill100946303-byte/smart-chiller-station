import { loadEnvironmentBuildings, loadEnvironmentConditions } from "../adapters/legacyEnvironmentAdapter.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeProjectKey(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return "";
  }
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : "";
}

function resolveEnvironmentLegacySiteId(config, siteId, options = {}) {
  const candidates = [
    options?.databaseKey,
    ...(Array.isArray(options?.databaseKeyCandidates) ? options.databaseKeyCandidates : []),
    ...(Array.isArray(options?.projectKeyCandidates) ? options.projectKeyCandidates : []),
    options?.projectKey,
    config?.siteSourceConfig?.databaseKey,
    config?.siteSourceConfig?.deviceDataProjectKey,
    config?.siteSourceConfig?.preferredProjectKey,
    config?.siteSourceConfig?.modelKey,
    siteId
  ];
  for (const candidate of candidates) {
    const normalized = normalizeProjectKey(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return normalizeOptionalText(siteId);
}

function resolveSourceInputs(result, fallbackKey) {
  if (Array.isArray(result?.sourceStatuses) && result.sourceStatuses.length > 0) {
    return result.sourceStatuses;
  }
  return [{ key: fallbackKey, ...(result?.sourceStatus || {}) }];
}

export async function getEnvironmentBuildings(config, siteId, options = {}) {
  const buildings = await loadEnvironmentBuildings(
    config.legacyBaseUrl,
    resolveEnvironmentLegacySiteId(config, siteId, options)
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: buildings.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(buildings, "environmentBuildings"))
  };
}

export async function getEnvironmentConditions(config, siteId, options = {}) {
  const legacySiteId = resolveEnvironmentLegacySiteId(config, siteId, options);
  const conditions = await loadEnvironmentConditions(
    config.legacyBaseUrl,
    legacySiteId,
    options
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: conditions.filters,
    items: conditions.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(conditions, "environmentConditions"))
  };
}

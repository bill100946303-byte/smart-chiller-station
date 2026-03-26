import { loadEnvironmentBuildings, loadEnvironmentConditions } from "../adapters/legacyEnvironmentAdapter.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function resolveSourceInputs(result, fallbackKey) {
  if (Array.isArray(result?.sourceStatuses) && result.sourceStatuses.length > 0) {
    return result.sourceStatuses;
  }
  return [{ key: fallbackKey, ...(result?.sourceStatus || {}) }];
}

export async function getEnvironmentBuildings(config, siteId) {
  const buildings = await loadEnvironmentBuildings(config.legacyBaseUrl, siteId);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: buildings.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(buildings, "environmentBuildings"))
  };
}

export async function getEnvironmentConditions(config, siteId, options = {}) {
  const conditions = await loadEnvironmentConditions(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: conditions.filters,
    items: conditions.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(conditions, "environmentConditions"))
  };
}

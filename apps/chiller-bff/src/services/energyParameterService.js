import {
  loadEnergyParameters,
  updateEnergyParameters as updateLegacyEnergyParameters
} from "../adapters/legacyEnergyParameterAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getEnergyParameters(config, siteId) {
  const parameters = await loadEnergyParameters(config.legacyBaseUrl, siteId);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    item: parameters.item,
    freshness: computeFreshnessState(new Date().toISOString(), config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "energyParameters", ...parameters.sourceStatus }])
  };
}

export async function updateEnergyParameters(config, siteId, data) {
  const updated = await updateLegacyEnergyParameters(config.legacyBaseUrl, siteId, data);

  if (!updated.ok) {
    return {
      ok: false,
      status: updated.status,
      endpoint: updated.endpoint,
      error: updated.error || "Legacy update failed"
    };
  }

  return {
    ok: true,
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    message: updated.message || "OK"
  };
}

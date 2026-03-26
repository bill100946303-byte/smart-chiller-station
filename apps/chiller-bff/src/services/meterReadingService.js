import {
  loadMeterReadingExport,
  loadMeterReadings
} from "../adapters/legacyMeterReadingAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getMeterReadings(config, siteId, options = {}) {
  const records = await loadMeterReadings(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: records.filters,
    columns: records.columns,
    items: records.items,
    total: records.total,
    freshness: computeFreshnessState(records.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "meterReadings", ...records.sourceStatus }])
  };
}

export async function getMeterReadingExport(config, siteId, options = {}) {
  return loadMeterReadingExport(config.legacyBaseUrl, siteId, options);
}

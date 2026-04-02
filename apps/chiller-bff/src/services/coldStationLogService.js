import { loadColdStationLog } from "../adapters/legacyColdStationLogAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

export async function getColdStationLog(config, siteId, date, requestContext = {}) {
  const log = await loadColdStationLog(config.legacyBaseUrl, siteId, {
    date,
    projectKey: requestContext?.projectKey
  });

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    date: log.date,
    summary: log.summary,
    items: log.items,
    freshness: computeFreshnessState(log.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "coldStationLog", ...log.sourceStatus }])
  };
}

import { loadB25CloudColdStationLog, shouldUseB25CloudHistory } from "../adapters/b25CloudHistoryAdapter.js";
import { loadColdStationLog } from "../adapters/legacyColdStationLogAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

export async function getColdStationLog(config, siteId, date, requestContext = {}) {
  // Preserve request context from project selector; only data-source base URL is unified to cloud.
  const databaseKey =
    typeof requestContext?.databaseKey === "string" && requestContext.databaseKey.trim()
      ? requestContext.databaseKey.trim()
      : "";
  const databaseKeyCandidates = Array.isArray(requestContext?.databaseKeyCandidates)
    ? requestContext.databaseKeyCandidates
    : [];
  const projectKey =
    typeof requestContext?.projectKey === "string" && requestContext.projectKey.trim()
      ? requestContext.projectKey.trim()
      : "";
  const projectKeyCandidates = Array.isArray(requestContext?.projectKeyCandidates)
    ? requestContext.projectKeyCandidates
    : [];
  const log = shouldUseB25CloudHistory(config, siteId)
    ? await loadB25CloudColdStationLog(config.legacyBaseUrl, siteId, { date })
    : await loadColdStationLog(config.legacyBaseUrl, siteId, {
        date,
        databaseKey,
        databaseKeyCandidates,
        projectKey,
        projectKeyCandidates
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

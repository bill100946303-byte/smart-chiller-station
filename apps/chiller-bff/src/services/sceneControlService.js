import {
  loadSceneLegacyTrend,
  loadSceneOnlineMonitor
} from "../adapters/legacySceneControlAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getSceneLegacyTrend(config, siteId, options = {}) {
  const report = await loadSceneLegacyTrend(config.legacyBaseUrl, siteId, options);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    title: report.title,
    unit: report.unit,
    filters: report.filters,
    points: report.points,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "sceneLegacyTrend", ...(report.sourceStatus || {}) }])
  };
}

export async function getSceneOnlineMonitor(config, siteId) {
  const report = await loadSceneOnlineMonitor(config.legacyBaseUrl, siteId);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    title: report.title,
    unit: report.unit,
    points: report.points,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "sceneOnlineMonitor", ...(report.sourceStatus || {}) }])
  };
}

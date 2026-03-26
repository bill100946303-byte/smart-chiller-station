import {
  loadPerformanceReport,
  loadPerformanceReportExport
} from "../adapters/legacyPerformanceReportAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getPerformanceReport(config, siteId, options = {}) {
  const report = await loadPerformanceReport(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    summaries: report.summaries,
    series: report.series,
    axisLabels: report.axisLabels,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "performanceReport", ...report.sourceStatus }])
  };
}

export async function getPerformanceReportExport(config, siteId, options = {}) {
  return loadPerformanceReportExport(config.legacyBaseUrl, siteId, options);
}

import {
  loadPerformanceReport,
  loadPerformanceReportExport
} from "../adapters/legacyPerformanceReportAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function readPerformanceReportRuntimeConfig(config) {
  return config?.siteSourceConfig && typeof config.siteSourceConfig === "object"
    ? config.siteSourceConfig
    : null;
}

function resolvePerformanceReportLegacySiteId(config, siteId) {
  const runtimeConfig = readPerformanceReportRuntimeConfig(config);
  return (
    normalizeOptionalText(runtimeConfig?.databaseKey)
    || normalizeOptionalText(runtimeConfig?.deviceDataProjectKey)
    || normalizeOptionalText(siteId)
  );
}

function resolvePerformanceReportRequestOptions(config, siteId, options = {}) {
  const runtimeConfig = readPerformanceReportRuntimeConfig(config);
  const normalizedSiteId = normalizeOptionalText(siteId);
  const runtimeKeys = new Set(
    [
      normalizeOptionalText(runtimeConfig?.modelKey),
      normalizeOptionalText(runtimeConfig?.preferredProjectKey),
      normalizeOptionalText(runtimeConfig?.databaseKey),
      normalizeOptionalText(runtimeConfig?.deviceDataProjectKey),
      normalizeOptionalText(runtimeConfig?.legacyAppId)
    ].filter(Boolean)
  );
  const requestedModelKey = normalizeOptionalText(options?.modelKey);
  const preferredModelKey =
    normalizeOptionalText(runtimeConfig?.modelKey)
    || normalizeOptionalText(runtimeConfig?.preferredProjectKey)
    || normalizeOptionalText(runtimeConfig?.databaseKey)
    || requestedModelKey;
  const shouldPreferRuntimeModelKey =
    !requestedModelKey
    || requestedModelKey === normalizedSiteId
    || runtimeKeys.has(requestedModelKey);
  const template =
    normalizeOptionalText(options?.template)
    || normalizeOptionalText(runtimeConfig?.template);

  return {
    ...options,
    ...(shouldPreferRuntimeModelKey && preferredModelKey
      ? { modelKey: preferredModelKey }
      : requestedModelKey
        ? { modelKey: requestedModelKey }
        : {}),
    ...(template ? { template } : {})
  };
}

export async function getPerformanceReport(config, siteId, options = {}) {
  const report = await loadPerformanceReport(
    config.legacyBaseUrl,
    resolvePerformanceReportLegacySiteId(config, siteId),
    resolvePerformanceReportRequestOptions(config, siteId, options)
  );

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
  return loadPerformanceReportExport(
    config.legacyBaseUrl,
    resolvePerformanceReportLegacySiteId(config, siteId),
    resolvePerformanceReportRequestOptions(config, siteId, options)
  );
}

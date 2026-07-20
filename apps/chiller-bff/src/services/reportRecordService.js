import {
  loadReportRecordExport,
  loadReportRecordRegOptions,
  loadReportRecords
} from "../adapters/legacyReportRecordAdapter.js";
import { computeFreshnessState } from "./freshness.js";
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

function resolveReportRecordLegacySiteId(config, siteId) {
  return (
    normalizeOptionalText(config?.siteSourceConfig?.databaseKey)
    || normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey)
    || normalizeOptionalText(siteId)
  );
}

function resolveSourceInputs(result, fallbackKey) {
  if (Array.isArray(result?.sourceStatuses) && result.sourceStatuses.length > 0) {
    return result.sourceStatuses.map((item) => ({
      key: fallbackKey,
      ...item
    }));
  }
  return [{ key: fallbackKey, ...(result?.sourceStatus || {}) }];
}

export async function getReportRecordRegOptions(config, siteId, options = {}) {
  const regs = await loadReportRecordRegOptions(
    config.legacyBaseUrl,
    resolveReportRecordLegacySiteId(config, siteId),
    {
      ...options,
      runtimeConfig: config
    }
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    drTypeId: regs.drTypeId,
    drId: regs.drId,
    items: regs.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(regs, "reportRecordRegs"))
  };
}

export async function getReportRecords(config, siteId, options = {}) {
  const records = await loadReportRecords(
    config.legacyBaseUrl,
    resolveReportRecordLegacySiteId(config, siteId),
    {
      ...options,
      runtimeConfig: config
    }
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: records.filters,
    columns: records.columns,
    items: records.items,
    summaryColumns: records.summaryColumns,
    summaryItems: records.summaryItems,
    chart: records.chart,
    total: records.total,
    page: records.page,
    pageSize: records.pageSize,
    filenamePrefix: records.filenamePrefix,
    freshness: computeFreshnessState(records.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus(resolveSourceInputs(records, "reportRecords"))
  };
}

export async function getReportRecordExport(config, siteId, options = {}) {
  return loadReportRecordExport(
    config.legacyBaseUrl,
    resolveReportRecordLegacySiteId(config, siteId),
    {
      ...options,
      runtimeConfig: config
    }
  );
}

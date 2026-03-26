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

export async function getReportRecordRegOptions(config, siteId, options = {}) {
  const regs = await loadReportRecordRegOptions(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    drTypeId: regs.drTypeId,
    drId: regs.drId,
    items: regs.items,
    sourceStatus: buildSourceStatus([{ key: "reportRecordRegs", ...regs.sourceStatus }])
  };
}

export async function getReportRecords(config, siteId, options = {}) {
  const records = await loadReportRecords(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: records.filters,
    columns: records.columns,
    items: records.items,
    total: records.total,
    page: records.page,
    pageSize: records.pageSize,
    filenamePrefix: records.filenamePrefix,
    freshness: computeFreshnessState(records.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "reportRecords", ...records.sourceStatus }])
  };
}

export async function getReportRecordExport(config, siteId, options = {}) {
  return loadReportRecordExport(config.legacyBaseUrl, siteId, options);
}

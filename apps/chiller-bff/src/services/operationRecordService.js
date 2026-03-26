import {
  loadOperationRecords,
  loadOperationRecordDeviceTypes,
  loadOperationRecordDevices
} from "../adapters/legacyOperationRecordAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getOperationRecords(config, siteId, options = {}) {
  const records = await loadOperationRecords(config.legacyBaseUrl, siteId, options);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: records.items,
    total: records.total,
    page: records.page,
    pageSize: records.pageSize,
    filters: records.filters,
    freshness: computeFreshnessState(records.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "operationRecords", ...records.sourceStatus }])
  };
}

export async function getOperationRecordDeviceTypes(config, siteId) {
  const types = await loadOperationRecordDeviceTypes(config.legacyBaseUrl, siteId);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: types.items,
    sourceStatus: buildSourceStatus([{ key: "operationRecordDeviceTypes", ...types.sourceStatus }])
  };
}

export async function getOperationRecordDevices(config, siteId, drTypeId) {
  const devices = await loadOperationRecordDevices(config.legacyBaseUrl, siteId, drTypeId);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    drTypeId: devices.drTypeId,
    items: devices.items,
    sourceStatus: buildSourceStatus([{ key: "operationRecordDevices", ...devices.sourceStatus }])
  };
}

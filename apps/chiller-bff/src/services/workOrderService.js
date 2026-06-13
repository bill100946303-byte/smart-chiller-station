import {
  createWorkOrder as createLegacyWorkOrder,
  deleteWorkOrder as deleteLegacyWorkOrder,
  loadWorkOrderAssignees,
  loadWorkOrderExport,
  loadWorkOrders,
  updateWorkOrder as updateLegacyWorkOrder
} from "../adapters/legacyWorkOrderAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function resolveWorkOrderLegacySiteId(config, siteId, options = {}) {
  const databaseKey = normalizeOptionalText(options?.databaseKey);
  if (databaseKey) {
    return databaseKey;
  }
  const databaseKeyCandidates = Array.isArray(options?.databaseKeyCandidates)
    ? options.databaseKeyCandidates.map(normalizeOptionalText).filter(Boolean)
    : [];
  if (databaseKeyCandidates.length > 0) {
    return databaseKeyCandidates[0];
  }
  const projectKeyCandidates = Array.isArray(options?.projectKeyCandidates)
    ? options.projectKeyCandidates.map(normalizeOptionalText).filter(Boolean)
    : [];
  if (projectKeyCandidates.length > 0) {
    return projectKeyCandidates[0];
  }
  const projectKey = normalizeOptionalText(options?.projectKey);
  if (projectKey) {
    return projectKey;
  }
  return (
    normalizeOptionalText(config?.siteSourceConfig?.databaseKey)
    || normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey)
    || normalizeOptionalText(config?.siteSourceConfig?.preferredProjectKey)
    || normalizeOptionalText(config?.siteSourceConfig?.modelKey)
    || normalizeOptionalText(siteId)
  );
}

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function buildMutationResult(config, siteId, result) {
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      endpoint: result.endpoint,
      error: result.error || "Legacy update failed"
    };
  }

  return {
    ok: true,
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    message: result.message || "OK"
  };
}

export async function getWorkOrders(config, siteId, options = {}) {
  const orders = await loadWorkOrders(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options),
    options
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: orders.items,
    total: orders.total,
    page: orders.page,
    pageSize: orders.pageSize,
    filters: orders.filters,
    freshness: computeFreshnessState(orders.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "workOrders", ...orders.sourceStatus }])
  };
}

export async function getWorkOrderAssignees(config, siteId, options = {}) {
  const assignees = await loadWorkOrderAssignees(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options)
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: assignees.items,
    sourceStatus: buildSourceStatus([{ key: "workOrderAssignees", ...assignees.sourceStatus }])
  };
}

export async function createWorkOrder(config, siteId, body, options = {}) {
  const result = await createLegacyWorkOrder(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options),
    body
  );
  return buildMutationResult(config, siteId, result);
}

export async function updateWorkOrder(config, siteId, body, options = {}) {
  const result = await updateLegacyWorkOrder(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options),
    body
  );
  return buildMutationResult(config, siteId, result);
}

export async function deleteWorkOrder(config, siteId, orderId, options = {}) {
  const result = await deleteLegacyWorkOrder(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options),
    orderId
  );
  return buildMutationResult(config, siteId, result);
}

export async function getWorkOrderExport(config, siteId, options = {}) {
  return loadWorkOrderExport(
    config.legacyBaseUrl,
    resolveWorkOrderLegacySiteId(config, siteId, options)
  );
}

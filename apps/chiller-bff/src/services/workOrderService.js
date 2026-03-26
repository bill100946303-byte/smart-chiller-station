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
  const orders = await loadWorkOrders(config.legacyBaseUrl, siteId, options);

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

export async function getWorkOrderAssignees(config, siteId) {
  const assignees = await loadWorkOrderAssignees(config.legacyBaseUrl, siteId);

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: assignees.items,
    sourceStatus: buildSourceStatus([{ key: "workOrderAssignees", ...assignees.sourceStatus }])
  };
}

export async function createWorkOrder(config, siteId, body) {
  const result = await createLegacyWorkOrder(config.legacyBaseUrl, siteId, body);
  return buildMutationResult(config, siteId, result);
}

export async function updateWorkOrder(config, siteId, body) {
  const result = await updateLegacyWorkOrder(config.legacyBaseUrl, siteId, body);
  return buildMutationResult(config, siteId, result);
}

export async function deleteWorkOrder(config, siteId, orderId) {
  const result = await deleteLegacyWorkOrder(config.legacyBaseUrl, siteId, orderId);
  return buildMutationResult(config, siteId, result);
}

export async function getWorkOrderExport(config, siteId) {
  return loadWorkOrderExport(config.legacyBaseUrl, siteId);
}

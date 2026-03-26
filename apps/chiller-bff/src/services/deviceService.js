import { loadDeviceDetail, loadDeviceList, loadDeviceTree } from "../adapters/legacyDeviceAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

export async function getDeviceList(config, siteId, options = {}) {
  const list = await loadDeviceList(config.legacyBaseUrl, siteId, {
    ...options,
    placeholderFallback: true
  });
  const freshness = computeFreshnessState(list.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    items: list.items,
    page: list.page,
    pageSize: list.pageSize,
    total: list.total,
    filters: list.filters,
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "devices",
        endpoint: `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=200`,
        ...(list.sourceStatus || {})
      },
      list.fallbackSourceStatus
        ? {
            key: "devicesPlaceholder",
            ...list.fallbackSourceStatus
          }
        : null
    ].filter(Boolean))
  };
}

export async function getDeviceTree(config, siteId, options = {}) {
  const tree = await loadDeviceTree(config.legacyBaseUrl, siteId, {
    ...options,
    placeholderFallback: true
  });
  const freshness = computeFreshnessState(tree.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    tree: tree.root,
    filters: tree.filters,
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "devicesTree",
        ...(tree.sourceStatus?.tree || {})
      },
      {
        key: "devicesCatalog",
        ...(tree.sourceStatus?.catalog || {})
      },
      tree.sourceStatus?.placeholder
        ? {
            key: "devicesPlaceholder",
            ...(tree.sourceStatus.placeholder || {})
          }
        : null
    ].filter(Boolean))
  };
}

export async function getDeviceDetail(config, siteId, deviceId, options = {}) {
  const detail = await loadDeviceDetail(config.legacyBaseUrl, siteId, deviceId, {
    ...options,
    placeholderFallback: true
  });
  const freshness = computeFreshnessState(detail.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    detail: detail.detail,
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "deviceDetailCatalog",
        ...(detail.sourceStatus?.catalog || {})
      },
      {
        key: "deviceDetailTree",
        ...(detail.sourceStatus?.tree || {})
      },
      {
        key: "deviceDetailRuntime",
        ...(detail.sourceStatus?.runtime || {})
      },
      detail.sourceStatus?.placeholder
        ? {
            key: "deviceDetailPlaceholder",
            ...(detail.sourceStatus.placeholder || {})
          }
        : null
    ].filter(Boolean))
  };
}

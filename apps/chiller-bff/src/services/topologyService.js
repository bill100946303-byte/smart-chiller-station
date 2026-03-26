import { loadDeviceSummary } from "../adapters/legacyDeviceAdapter.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

export async function getTopology(config, siteId, requestContext = {}) {
  const device = await loadDeviceSummary(config.legacyBaseUrl, siteId, {
    placeholderFallback: true,
    projectKey: requestContext?.projectKey
  });

  const summary = device.summary || {
    totalDevices: 0,
    chillerCount: 0,
    chilledPumpCount: 0,
    coolingPumpCount: 0,
    coolingTowerCount: 0
  };

  const nodes = [
    { id: "chiller", label: "Chiller Cluster", count: summary.chillerCount, downstream: "chilledPump" },
    { id: "chilledPump", label: "Chilled Pumps", count: summary.chilledPumpCount, downstream: "load" },
    { id: "load", label: "Building Load", count: null, downstream: "coolingPump" },
    { id: "coolingPump", label: "Cooling Pumps", count: summary.coolingPumpCount, downstream: "coolingTower" },
    { id: "coolingTower", label: "Cooling Towers (CTF+CTE+CTHDE)", count: summary.coolingTowerCount, downstream: null }
  ];

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    summary,
    groups: device.groups || [],
    nodes,
    sourceStatus: buildSourceStatus([
      {
        key: "devices",
        endpoint: `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=200`,
        ...device.sourceStatus
      },
      device.fallbackSourceStatus
        ? {
            key: "devicesPlaceholder",
            ...device.fallbackSourceStatus
          }
        : null
    ].filter(Boolean))
  };
}

import {
  loadEnergyEfficiencyCalendar,
  loadEnergyEfficiencyCalendarPie
} from "../adapters/legacyEnergyEfficiencyCalendarAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function resolveLegacyAppId(config, siteId, options = {}) {
  const optionAppId = options?.legacyAppId ?? options?.appId;
  if (typeof optionAppId === "string" && optionAppId.trim()) {
    return optionAppId.trim();
  }
  if (typeof optionAppId === "number" && Number.isFinite(optionAppId)) {
    return String(optionAppId);
  }
  const runtimeAppId = config?.siteSourceConfig?.legacyAppId ?? config?.legacyAppId;
  if (typeof runtimeAppId === "string" && runtimeAppId.trim()) {
    return runtimeAppId.trim();
  }
  if (typeof runtimeAppId === "number" && Number.isFinite(runtimeAppId)) {
    return String(runtimeAppId);
  }
  return siteId;
}

export async function getEnergyEfficiencyCalendar(config, siteId, options = {}) {
  const result = await loadEnergyEfficiencyCalendar(
    config.legacyBaseUrl,
    resolveLegacyAppId(config, siteId, options),
    options
  );
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    month: result.month,
    items: result.items,
    monthSummary: result.monthSummary,
    freshness: computeFreshnessState(result.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([
      { key: "energyEfficiencyCalendar", ...(result.sourceStatus?.calendar || {}) },
      { key: "energyEfficiencyCalendarSummary", ...(result.sourceStatus?.monthSummary || {}) }
    ])
  };
}

export async function getEnergyEfficiencyCalendarPie(config, siteId, options = {}) {
  const result = await loadEnergyEfficiencyCalendarPie(
    config.legacyBaseUrl,
    resolveLegacyAppId(config, siteId, options),
    options
  );
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: result.filters,
    segments: result.segments,
    total: result.total,
    freshness: computeFreshnessState(result.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "energyEfficiencyCalendarPie", ...result.sourceStatus }])
  };
}

import {
  loadMeterReadingExport,
  loadMeterReadings
} from "../adapters/legacyMeterReadingAdapter.js";
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
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function resolveProjectKey(config, options = {}) {
  return (
    normalizeOptionalText(options?.modelKey)
    || normalizeOptionalText(options?.projectKey)
    || normalizeOptionalText(config?.siteSourceConfig?.modelKey)
    || normalizeOptionalText(config?.siteSourceConfig?.preferredProjectKey)
    || normalizeOptionalText(config?.siteSourceConfig?.databaseKey)
  );
}

function resolveIdentifierCandidates(config, siteId, options = {}) {
  const candidates = [];
  if (Array.isArray(options?.databaseKeyCandidates)) {
    candidates.push(...options.databaseKeyCandidates);
  }
  if (typeof options?.databaseKey === "string") {
    candidates.push(options.databaseKey);
  }
  if (typeof config?.siteSourceConfig?.databaseKey === "string") {
    candidates.push(config.siteSourceConfig.databaseKey);
  }
  if (typeof config?.siteSourceConfig?.deviceDataProjectKey === "string") {
    candidates.push(config.siteSourceConfig.deviceDataProjectKey);
  }
  if (Array.isArray(options?.identifierCandidates)) {
    candidates.push(...options.identifierCandidates);
  }
  if (typeof options?.identifier === "string") {
    candidates.push(options.identifier);
  }
  if (Array.isArray(options?.projectKeyCandidates)) {
    candidates.push(...options.projectKeyCandidates);
  }
  if (typeof options?.projectKey === "string") {
    candidates.push(options.projectKey);
  }
  if (typeof config?.siteSourceConfig?.modelKey === "string") {
    candidates.push(config.siteSourceConfig.modelKey);
  }
  if (typeof config?.siteSourceConfig?.legacyAppId === "string") {
    candidates.push(config.siteSourceConfig.legacyAppId);
  }
  candidates.push(siteId);
  return Array.from(new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean)));
}

function resolveSourceInputs(result, fallbackKey) {
  if (Array.isArray(result?.sourceStatuses) && result.sourceStatuses.length > 0) {
    return result.sourceStatuses;
  }
  return [{ key: fallbackKey, ...(result?.sourceStatus || {}) }];
}

export async function getMeterReadings(config, siteId, options = {}) {
  const records = await loadMeterReadings(config.legacyBaseUrl, siteId, {
    ...options,
    modelKey: resolveProjectKey(config, options),
    runtimeConfig: config,
    identifierCandidates: resolveIdentifierCandidates(config, siteId, options)
  });

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: records.filters,
    columns: records.columns,
    items: records.items,
    total: records.total,
    freshness: computeFreshnessState(records.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus(resolveSourceInputs(records, "meterReadings"))
  };
}

export async function getMeterReadingExport(config, siteId, options = {}) {
  return loadMeterReadingExport(config.legacyBaseUrl, siteId, {
    ...options,
    modelKey: resolveProjectKey(config, options),
    runtimeConfig: config,
    identifierCandidates: resolveIdentifierCandidates(config, siteId, options)
  });
}

import {
  loadEnergyEfficiencyCompare,
  loadEnergyEfficiencyImbalance,
  loadEnergyEfficiencyProportion,
  loadEnergyEfficiencySearch
} from "../adapters/legacyEnergyEfficiencyAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function resolveProjectKey(config, options = {}) {
  if (typeof options?.projectKey === "string" && options.projectKey.trim()) {
    return options.projectKey.trim();
  }
  const modelKey = config?.siteSourceConfig?.modelKey;
  if (typeof modelKey === "string" && modelKey.trim()) {
    return modelKey.trim();
  }
  const databaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof databaseKey === "string" && databaseKey.trim()) {
    return databaseKey.trim();
  }
  return "";
}

function resolveDatabaseKey(config, options = {}) {
  if (typeof options?.databaseKey === "string" && options.databaseKey.trim()) {
    return options.databaseKey.trim();
  }
  const databaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof databaseKey === "string" && databaseKey.trim()) {
    return databaseKey.trim();
  }
  const deviceDataProjectKey = config?.siteSourceConfig?.deviceDataProjectKey;
  if (typeof deviceDataProjectKey === "string" && deviceDataProjectKey.trim()) {
    return deviceDataProjectKey.trim();
  }
  return "";
}

function resolveDatabaseKeyCandidates(config, options = {}) {
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
  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
}

function resolveProjectKeyCandidates(config, options = {}) {
  const candidates = [];
  if (Array.isArray(options?.projectKeyCandidates)) {
    candidates.push(...options.projectKeyCandidates);
  }
  if (typeof options?.projectKey === "string") {
    candidates.push(options.projectKey);
  }
  if (typeof config?.siteSourceConfig?.databaseKey === "string") {
    candidates.push(config.siteSourceConfig.databaseKey);
  }
  if (typeof config?.siteSourceConfig?.modelKey === "string") {
    candidates.push(config.siteSourceConfig.modelKey);
  }
  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
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

function resolveLegacyAppIdCandidates(config, siteId, options = {}) {
  const candidates = [];
  if (Array.isArray(options?.appIdCandidates)) {
    candidates.push(...options.appIdCandidates);
  }
  if (Array.isArray(options?.legacyAppIdCandidates)) {
    candidates.push(...options.legacyAppIdCandidates);
  }
  const optionAppId = options?.legacyAppId ?? options?.appId;
  if (optionAppId != null) {
    candidates.push(optionAppId);
  }
  const runtimeAppId = config?.siteSourceConfig?.legacyAppId ?? config?.legacyAppId;
  if (runtimeAppId != null) {
    candidates.push(runtimeAppId);
  }
  candidates.push(siteId);

  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
}

function resolveImbalanceTableIdentifier(config, siteId, options = {}) {
  const explicitIdentifier = options?.tableIdentifier ?? options?.projectKey;
  if (typeof explicitIdentifier === "string" && explicitIdentifier.trim()) {
    return explicitIdentifier.trim();
  }

  const databaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof databaseKey === "string" && databaseKey.trim()) {
    return databaseKey.trim();
  }

  const deviceDataProjectKey = config?.siteSourceConfig?.deviceDataProjectKey;
  if (typeof deviceDataProjectKey === "string" && deviceDataProjectKey.trim()) {
    return deviceDataProjectKey.trim();
  }

  const modelKey = config?.siteSourceConfig?.modelKey;
  if (typeof modelKey === "string" && modelKey.trim()) {
    return modelKey.trim();
  }

  return resolveLegacyAppId(config, siteId, options);
}

function resolveImbalanceTableIdentifierCandidates(config, siteId, options = {}) {
  const candidates = [];

  if (Array.isArray(options?.tableIdentifierCandidates)) {
    candidates.push(...options.tableIdentifierCandidates);
  }
  if (Array.isArray(options?.projectKeyCandidates)) {
    candidates.push(...options.projectKeyCandidates);
  }

  const explicitIdentifier = options?.tableIdentifier ?? options?.projectKey;
  if (explicitIdentifier != null) {
    candidates.push(explicitIdentifier);
  }

  if (typeof config?.siteSourceConfig?.databaseKey === "string") {
    candidates.push(config.siteSourceConfig.databaseKey);
  }
  if (typeof config?.siteSourceConfig?.deviceDataProjectKey === "string") {
    candidates.push(config.siteSourceConfig.deviceDataProjectKey);
  }
  if (typeof config?.siteSourceConfig?.modelKey === "string") {
    candidates.push(config.siteSourceConfig.modelKey);
  }

  const optionAppId = options?.legacyAppId ?? options?.appId;
  if (optionAppId != null) {
    candidates.push(optionAppId);
  }
  const runtimeAppId = config?.siteSourceConfig?.legacyAppId ?? config?.legacyAppId;
  if (runtimeAppId != null) {
    candidates.push(runtimeAppId);
  }

  candidates.push(siteId);

  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
}

export async function getEnergyEfficiencySearch(config, siteId, options = {}) {
  const report = await loadEnergyEfficiencySearch(config.legacyBaseUrl, siteId, {
    ...options,
    databaseKey: resolveDatabaseKey(config, options),
    databaseKeyCandidates: resolveDatabaseKeyCandidates(config, options),
    projectKey: resolveProjectKey(config, options),
    projectKeyCandidates: resolveProjectKeyCandidates(config, options)
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    tableRows: report.tableRows,
    series: report.series,
    axisLabels: report.axisLabels,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "energyEfficiencySearch", ...report.sourceStatus }])
  };
}

export async function getEnergyEfficiencyCompare(config, siteId, options = {}) {
  const report = await loadEnergyEfficiencyCompare(config.legacyBaseUrl, siteId, {
    ...options,
    databaseKey: resolveDatabaseKey(config, options),
    databaseKeyCandidates: resolveDatabaseKeyCandidates(config, options),
    projectKey: resolveProjectKey(config, options),
    projectKeyCandidates: resolveProjectKeyCandidates(config, options)
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    tableRows: report.tableRows,
    series: report.series,
    axisLabels: report.axisLabels,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "energyEfficiencyCompare", ...report.sourceStatus }])
  };
}

export async function getEnergyEfficiencyProportion(config, siteId, options = {}) {
  const report = await loadEnergyEfficiencyProportion(config.legacyBaseUrl, siteId, {
    ...options,
    databaseKey: resolveDatabaseKey(config, options),
    databaseKeyCandidates: resolveDatabaseKeyCandidates(config, options),
    projectKey: resolveProjectKey(config, options),
    projectKeyCandidates: resolveProjectKeyCandidates(config, options)
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    rows: report.rows,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "energyEfficiencyProportion", ...report.sourceStatus }])
  };
}

export async function getEnergyEfficiencyImbalance(config, siteId, options = {}) {
  const report = await loadEnergyEfficiencyImbalance(config.legacyBaseUrl, siteId, {
    ...options,
    databaseKey: resolveDatabaseKey(config, options),
    databaseKeyCandidates: resolveDatabaseKeyCandidates(config, options),
    appId: resolveLegacyAppId(config, siteId, options),
    appIdCandidates: resolveLegacyAppIdCandidates(config, siteId, options),
    tableIdentifier: resolveImbalanceTableIdentifier(config, siteId, options),
    tableIdentifierCandidates: resolveImbalanceTableIdentifierCandidates(config, siteId, options)
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    series: report.series,
    axisLabels: report.axisLabels,
    statisticsRows: report.statisticsRows,
    deviceRows: report.deviceRows,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([
      { key: "energyEfficiencyImbalanceCurve", ...(report.sourceStatus?.curve || {}) },
      { key: "energyEfficiencyImbalanceTable", ...(report.sourceStatus?.deviceList || {}) }
    ])
  };
}

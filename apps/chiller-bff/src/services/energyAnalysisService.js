import { loadEnergyAnalysis, loadEnergyAnalysisTree } from "../adapters/legacyEnergyAnalysisAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function resolveAppId(config, siteId, options = {}) {
  if (typeof options?.appId === "string" && options.appId.trim()) {
    return options.appId.trim();
  }
  const legacyAppId = config?.siteSourceConfig?.legacyAppId;
  if (typeof legacyAppId === "string" && legacyAppId.trim()) {
    return legacyAppId.trim();
  }
  return String(siteId || "").trim();
}

function resolveAppIdCandidates(config, siteId, options = {}) {
  const candidates = [];
  if (Array.isArray(options?.appIdCandidates)) {
    candidates.push(...options.appIdCandidates);
  }
  if (typeof options?.appId === "string") {
    candidates.push(options.appId);
  }
  if (typeof config?.siteSourceConfig?.legacyAppId === "string") {
    candidates.push(config.siteSourceConfig.legacyAppId);
  }
  candidates.push(siteId);
  return Array.from(new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean)));
}

function resolveDatabaseKey(config, siteId, options = {}) {
  if (typeof options?.databaseKey === "string" && options.databaseKey.trim()) {
    return options.databaseKey.trim();
  }
  const runtimeConfig = config?.siteSourceConfig || {};
  if (typeof runtimeConfig.databaseKey === "string" && runtimeConfig.databaseKey.trim()) {
    return runtimeConfig.databaseKey.trim();
  }
  if (typeof runtimeConfig.deviceDataProjectKey === "string" && runtimeConfig.deviceDataProjectKey.trim()) {
    return runtimeConfig.deviceDataProjectKey.trim();
  }
  return String(siteId || "").trim();
}

function resolveModelKey(config, siteId, options = {}) {
  if (typeof options?.modelKey === "string" && options.modelKey.trim()) {
    return options.modelKey.trim();
  }
  if (typeof options?.projectKey === "string" && options.projectKey.trim()) {
    return options.projectKey.trim();
  }
  const runtimeConfig = config?.siteSourceConfig || {};
  if (typeof runtimeConfig.modelKey === "string" && runtimeConfig.modelKey.trim()) {
    return runtimeConfig.modelKey.trim();
  }
  return String(siteId || "").trim();
}

export async function getEnergyAnalysisTree(config, siteId, options = {}) {
  const tree = await loadEnergyAnalysisTree(config.legacyBaseUrl, siteId, {
    appId: resolveAppId(config, siteId),
    appIdCandidates: resolveAppIdCandidates(config, siteId),
    databaseKey: resolveDatabaseKey(config, siteId, options),
    projectKey: typeof options?.projectKey === "string" ? options.projectKey.trim() : "",
    modelKey: resolveModelKey(config, siteId, options),
    language: typeof options?.language === "string" && options.language.trim() ? options.language.trim() : "zh",
    unit: typeof options?.unit === "string" && options.unit.trim() ? options.unit.trim() : "KW",
    template:
      typeof options?.template === "string" && options.template.trim()
        ? options.template.trim()
        : config?.siteSourceConfig?.template || "1"
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: tree.items,
    sourceStatus: buildSourceStatus([
      tree.sourceStatus?.tree || { key: "energyAnalysisTree", ok: false, error: "tree source missing" },
      tree.sourceStatus?.devices || { key: "energyAnalysisDevices", ok: false, error: "device source missing" }
    ])
  };
}

export async function getEnergyAnalysisReport(config, siteId, options = {}) {
  const report = await loadEnergyAnalysis(config.legacyBaseUrl, siteId, {
    ...options,
    appId: resolveAppId(config, siteId, options),
    appIdCandidates: resolveAppIdCandidates(config, siteId, options),
    databaseKey: resolveDatabaseKey(config, siteId, options),
    projectKey: typeof options?.projectKey === "string" ? options.projectKey.trim() : "",
    modelKey: resolveModelKey(config, siteId, options),
    language: typeof options?.language === "string" && options.language.trim() ? options.language.trim() : "zh",
    unit: typeof options?.unit === "string" && options.unit.trim() ? options.unit.trim() : "KW",
    template:
      typeof options?.template === "string" && options.template.trim()
        ? options.template.trim()
        : config?.siteSourceConfig?.template || "1"
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: report.filters,
    summaries: report.summaries,
    series: report.series,
    axisLabels: report.axisLabels,
    unit: report.unit,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([report.sourceStatus])
  };
}

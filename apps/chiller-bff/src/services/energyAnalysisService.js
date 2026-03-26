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

export async function getEnergyAnalysisTree(config, siteId) {
  const tree = await loadEnergyAnalysisTree(config.legacyBaseUrl, siteId);
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
  const report = await loadEnergyAnalysis(config.legacyBaseUrl, siteId, options);
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

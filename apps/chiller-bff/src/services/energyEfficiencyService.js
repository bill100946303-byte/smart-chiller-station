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

export async function getEnergyEfficiencySearch(config, siteId, options = {}) {
  const report = await loadEnergyEfficiencySearch(config.legacyBaseUrl, siteId, options);
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
  const report = await loadEnergyEfficiencyCompare(config.legacyBaseUrl, siteId, options);
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
  const report = await loadEnergyEfficiencyProportion(config.legacyBaseUrl, siteId, options);
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
  const report = await loadEnergyEfficiencyImbalance(config.legacyBaseUrl, siteId, options);
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

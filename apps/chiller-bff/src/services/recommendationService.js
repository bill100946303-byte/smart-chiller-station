import { buildGeneratedAt, applyFieldNullStrategy } from "./fieldPolicyService.js";
import { evaluateRuleCards } from "./ruleEngineService.js";
import { buildSourceStatus } from "./sourceStatusService.js";
import { loadRuleMetrics } from "../adapters/legacyEnergyAdapter.js";

const CORE_RULE_METRICS = [
  {
    metricName: "chilled_delta_t_c",
    energyCardKey: "chilledDeltaT",
    expectedFields: ["冷冻水温差", "chilledWaterTemperatureDifference", "tagValue"]
  },
  {
    metricName: "cooling_delta_t_c",
    energyCardKey: "coolingDeltaT",
    expectedFields: ["冷却水温差", "chilledOutWaterTemperatureDifference", "tagValue"]
  },
  {
    metricName: "station_cop",
    energyCardKey: "currentCop",
    expectedFields: ["冷站COP", "coldStationCop", "cop", "tagValue"]
  },
  {
    metricName: "station_total_power_kw",
    energyCardKey: "totalPowerKw",
    expectedFields: [
      "totalPower",
      "power",
      "tagValue(title=Total Power/总功率)",
      "sum(chiller_power_kw,chilled_pump_power_kw,cooling_pump_power_kw,cooling_tower_power_kw)"
    ]
  }
];

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function healthFromSourceStatus(key, sourceStatus, endpoint) {
  const statusOverall = sourceStatus?.overall;
  const ok = statusOverall === "ok" || statusOverall === "partial";
  return {
    key,
    endpoint,
    ok,
    status: null,
    message: statusOverall || null,
    error: ok ? null : `${key} unavailable`,
    rows: sourceStatus?.sources?.length ?? null
  };
}

function healthFromRuleMetricSources(ruleMetricsStatus, siteId) {
  const sources = Array.isArray(ruleMetricsStatus) ? ruleMetricsStatus : [];
  const okCount = sources.filter((source) => source?.ok).length;
  const overall = okCount === sources.length ? "ok" : okCount === 0 ? "failed" : "partial";
  const ok = overall === "ok" || overall === "partial";
  return {
    key: "ruleMetrics",
    endpoint: [
      `/zsqy/homepage/${siteId}/getEquipmentEnergyStatisticsCurve`,
      `/zsqy/homepage/${siteId}/getEnergyStatisticsCurve`,
      `/zsqy/homepage/${siteId}/getRunParamsCurve`
    ].join(";"),
    ok,
    status: null,
    message: overall,
    error: ok ? null : "ruleMetrics unavailable",
    rows: sources.length
  };
}

function buildCoreMetricObservability(dashboardOverview, siteId) {
  const energyCards = dashboardOverview?.energyCards || {};
  const energySource = dashboardOverview?.sourceStatus?.sources?.find(
    (source) => source?.key === "energy"
  );
  const fallbackEndpoint = `/zsqy/homepage/${siteId}/getEquipmentEnergyStatisticsCurve`;

  const metricContexts = {};
  const sourceEntries = [];

  for (const metric of CORE_RULE_METRICS) {
    const endpoint = String(energySource?.endpoint || fallbackEndpoint);
    const value = asFiniteNumber(energyCards[metric.energyCardKey]);
    const expectedFieldsText = metric.expectedFields.join("|");
    const upstreamUnavailable = !energySource || !energySource.ok;

    let category = "ok";
    let message = "ok";
    let error = null;
    let ok = true;

    if (upstreamUnavailable) {
      category = "upstream_unreachable";
      ok = false;
      message = `upstream_unreachable: ${String(energySource?.error || energySource?.message || "energy source unavailable")}`;
      error = "upstream unreachable";
    } else if (value === null) {
      category = "field_missing_or_invalid";
      ok = false;
      message = `field_missing_or_invalid: expected=${expectedFieldsText}`;
      error = "field missing or invalid";
    } else {
      message = `ok: value=${value}`;
    }

    metricContexts[metric.metricName] = {
      category,
      message,
      endpoint,
      expectedFields: [...metric.expectedFields]
    };

    sourceEntries.push({
      key: `metric.${metric.metricName}`,
      endpoint,
      ok,
      status:
        typeof energySource?.status === "number" && Number.isFinite(energySource.status)
          ? energySource.status
          : null,
      message,
      error,
      rows: typeof energySource?.rows === "number" && Number.isFinite(energySource.rows)
        ? energySource.rows
        : null
    });
  }

  return {
    metricContexts,
    sourceEntries
  };
}

export async function getRecommendations(config, siteId, dashboardOverview, anomalySummary) {
  const ruleMetricResult = await loadRuleMetrics(config.legacyBaseUrl, siteId);
  const coreMetricObservability = buildCoreMetricObservability(dashboardOverview, siteId);
  const evaluated = evaluateRuleCards(
    config,
    dashboardOverview,
    anomalySummary,
    ruleMetricResult?.metrics || null,
    coreMetricObservability.metricContexts
  );
  const cards = evaluated.cards;

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", dashboardOverview?.site?.siteName, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    summary: {
      total: cards.length,
      highRisk: cards.filter((card) => card.risk === "high").length,
      criticalSeverity: cards.filter((card) => card.severity === "critical").length
    },
    cards,
    ruleEvaluation: evaluated.ruleEvaluation,
    sourceStatus: buildSourceStatus([
      evaluated.ruleSource,
      healthFromSourceStatus(
        "dashboardOverview",
        dashboardOverview?.sourceStatus,
        `/bff/v1/sites/${siteId}/dashboard/overview`
      ),
      healthFromSourceStatus(
        "anomalySummary",
        anomalySummary?.sourceStatus,
        `/bff/v1/sites/${siteId}/anomalies/summary`
      ),
      healthFromRuleMetricSources(ruleMetricResult?.sourceStatus, siteId),
      ...coreMetricObservability.sourceEntries
    ])
  };
}

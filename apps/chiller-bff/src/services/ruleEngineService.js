import fs from "node:fs";
import yaml from "js-yaml";
import { applyFieldNullStrategy, countMissingCriticalMetrics } from "./fieldPolicyService.js";

let cachedPath = null;
let cachedMtimeMs = null;
let cachedRuleSet = null;

function loadRuleSet(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (cachedPath === filePath && cachedMtimeMs === stat.mtimeMs && cachedRuleSet) {
      return { ok: true, ruleSet: cachedRuleSet, error: null };
    }
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = yaml.load(text);
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    cachedPath = filePath;
    cachedMtimeMs = stat.mtimeMs;
    cachedRuleSet = { ...parsed, rules };
    return { ok: true, ruleSet: cachedRuleSet, error: null };
  } catch (error) {
    return {
      ok: false,
      ruleSet: null,
      error: `Rule set load failed: ${String(error?.message || error)}`
    };
  }
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compare(left, operator, right) {
  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function buildMetricBag(config, dashboardOverview, anomalySummary, ruleMetrics = null) {
  const energyCards = dashboardOverview?.energyCards || {};
  const overviewAgeMin = asNumber(dashboardOverview?.freshness?.ageHours);
  const anomaliesAgeMin = asNumber(anomalySummary?.freshness?.ageHours);
  const maxChilledPumpFreqHz = asNumber(ruleMetrics?.maxChilledPumpFreqHz) ?? 0;
  const chillerStartStopCount60m = asNumber(ruleMetrics?.chillerStartStopCount60m) ?? 0;
  const chilledPumpStartStopCount60m =
    asNumber(ruleMetrics?.chilledPumpStartStopCount60m) ?? 0;
  const coolingPumpStartStopCount60m =
    asNumber(ruleMetrics?.coolingPumpStartStopCount60m) ?? 0;
  const coolingTowerPowerKw =
    asNumber(ruleMetrics?.coolingTowerPowerKw) ??
    asNumber(energyCards.coolingTowerPowerKw) ??
    0;
  const criticalMissing = countMissingCriticalMetrics({
    station_total_power_kw: energyCards.totalPowerKw,
    station_cop: energyCards.currentCop,
    chilled_delta_t_c: energyCards.chilledDeltaT,
    cooling_delta_t_c: energyCards.coolingDeltaT
  });

  return {
    chilled_delta_t_c: applyFieldNullStrategy(config, "chilled_delta_t_c", energyCards.chilledDeltaT),
    station_total_power_kw: applyFieldNullStrategy(
      config,
      "station_total_power_kw",
      energyCards.totalPowerKw
    ),
    max_chilled_pump_freq_hz: applyFieldNullStrategy(
      config,
      "max_chilled_pump_freq_hz",
      maxChilledPumpFreqHz
    ),
    cooling_delta_t_c: applyFieldNullStrategy(config, "cooling_delta_t_c", energyCards.coolingDeltaT),
    cooling_tower_power_kw: applyFieldNullStrategy(
      config,
      "cooling_tower_power_kw",
      coolingTowerPowerKw
    ),
    station_cop: applyFieldNullStrategy(config, "station_cop", energyCards.currentCop),
    chiller_start_stop_count_60m: applyFieldNullStrategy(
      config,
      "chiller_start_stop_count_60m",
      chillerStartStopCount60m
    ),
    chilled_pump_start_stop_count_60m: applyFieldNullStrategy(
      config,
      "chilled_pump_start_stop_count_60m",
      chilledPumpStartStopCount60m
    ),
    cooling_pump_start_stop_count_60m: applyFieldNullStrategy(
      config,
      "cooling_pump_start_stop_count_60m",
      coolingPumpStartStopCount60m
    ),
    overview_data_age_min: overviewAgeMin === null ? null : Number((overviewAgeMin * 60).toFixed(2)),
    anomalies_data_age_min: anomaliesAgeMin === null ? null : Number((anomaliesAgeMin * 60).toFixed(2)),
    critical_metric_missing_count_5m: criticalMissing
  };
}

function evaluateSingleRule(
  rule,
  metricBag,
  missingMetricPolicy = "skip_rule",
  metricContexts = {}
) {
  const conditions = Array.isArray(rule?.triggerConditions?.conditions)
    ? rule.triggerConditions.conditions
    : [];
  const logic = String(rule?.triggerConditions?.logic || "all").toLowerCase();
  const checks = [];
  let hasMissingMetric = false;

  for (const condition of conditions) {
    const metricName = condition.metric;
    const thresholdValue = asNumber(rule?.thresholds?.[condition.thresholdKey]);
    const metricValue = asNumber(metricBag[metricName]);
    const missingContext = metricContexts?.[metricName] || null;
    if (metricValue === null || thresholdValue === null) {
      hasMissingMetric = true;
      checks.push({
        metric: metricName,
        operator: condition.operator,
        threshold: thresholdValue,
        value: metricValue,
        ok: false,
        missing: true,
        missingCategory: missingContext?.category || "unknown",
        missingMessage: missingContext?.message || null
      });
      continue;
    }

    checks.push({
      metric: metricName,
      operator: condition.operator,
      threshold: thresholdValue,
      value: metricValue,
      ok: compare(metricValue, condition.operator, thresholdValue),
      missing: false
    });
  }

  const validChecks = checks.filter((check) => !check.missing);
  if (missingMetricPolicy === "skip_rule" && validChecks.length === 0) {
    return {
      matched: false,
      skipped: true,
      reason: "missing-metric",
      checks
    };
  }

  if (missingMetricPolicy === "skip_rule" && logic === "all" && hasMissingMetric) {
    return {
      matched: false,
      skipped: true,
      reason: "missing-metric",
      checks
    };
  }

  const matched =
    logic === "any" ? validChecks.some((check) => check.ok) : validChecks.every((check) => check.ok);
  return {
    matched,
    skipped: false,
    reason: matched ? "matched" : "conditions-not-met",
    checks
  };
}

function normalizeCard(rule, evaluation) {
  const card = rule?.bffCard || {};
  const evidence = Array.isArray(card.evidence) ? [...card.evidence] : [];
  for (const check of evaluation.checks.filter((x) => !x.missing)) {
    evidence.push(
      `${check.metric} ${check.operator} ${check.threshold} (observed=${check.value})`
    );
  }

  return {
    id: String(card.id || rule.ruleId),
    title: String(card.title || rule.name || rule.ruleId),
    priority: String(card.priority || "medium"),
    category: String(card.category || rule.class || "optimization"),
    reason: String(card.reason || "Rule matched"),
    evidence,
    actions: Array.isArray(card.actions) ? card.actions : [],
    relatedDevices: Array.isArray(card.relatedDevices) ? card.relatedDevices : [],
    severity: String(card.severity || rule.severity || "minor"),
    risk: String(card.risk || rule.riskLevel || "low"),
    ruleId: rule.ruleId
  };
}

export function evaluateRuleCards(
  config,
  dashboardOverview,
  anomalySummary,
  ruleMetrics = null,
  metricContexts = {}
) {
  const loaded = loadRuleSet(config.hvacRulesFile);
  if (!loaded.ok) {
    return {
      cards: [],
      ruleEvaluation: {
        rulesLoaded: false,
        error: loaded.error,
        ruleSetId: null,
        version: null,
        totalEnabledRules: 0,
        matchedRuleIds: [],
        skippedRuleIds: [],
        skippedRuleDetails: [],
        missingMetricPolicy: null
      },
      ruleSource: {
        key: "rules",
        endpoint: config.hvacRulesFile,
        ok: false,
        status: null,
        message: null,
        error: loaded.error,
        rows: null
      }
    };
  }

  const ruleSet = loaded.ruleSet;
  const metricBag = buildMetricBag(config, dashboardOverview, anomalySummary, ruleMetrics);
  const missingPolicy = String(ruleSet?.defaults?.missingMetricPolicy || "skip_rule");

  const cards = [];
  const matchedRuleIds = [];
  const skippedRuleIds = [];
  const skippedRuleDetails = [];

  for (const rule of ruleSet.rules.filter((r) => r?.enabled !== false)) {
    const evaluation = evaluateSingleRule(rule, metricBag, missingPolicy, metricContexts);
    if (evaluation.skipped) {
      skippedRuleIds.push(rule.ruleId);
      skippedRuleDetails.push({
        ruleId: rule.ruleId,
        reason: evaluation.reason,
        missingMetrics: evaluation.checks
          .filter((check) => check.missing)
          .map((check) => ({
            metric: check.metric,
            category: check.missingCategory || "unknown",
            message: check.missingMessage || null
          }))
      });
      continue;
    }
    if (!evaluation.matched) {
      continue;
    }
    cards.push(normalizeCard(rule, evaluation));
    matchedRuleIds.push(rule.ruleId);
  }

  return {
    cards,
    ruleEvaluation: {
      rulesLoaded: true,
      error: null,
      ruleSetId: ruleSet?.metadata?.ruleSetId || "unknown-rule-set",
      version: ruleSet?.metadata?.version || "unknown",
      totalEnabledRules: ruleSet.rules.filter((r) => r?.enabled !== false).length,
      matchedRuleIds,
      skippedRuleIds,
      skippedRuleDetails,
      missingMetricPolicy: missingPolicy
    },
    ruleSource: {
      key: "rules",
      endpoint: config.hvacRulesFile,
      ok: true,
      status: null,
      message: `${ruleSet?.metadata?.ruleSetId || "unknown-rule-set"}@${ruleSet?.metadata?.version || "unknown"}`,
      error: null,
      rows: ruleSet.rules.filter((r) => r?.enabled !== false).length
    }
  };
}

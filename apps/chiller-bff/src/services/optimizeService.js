import { buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const ALLOWED_MODES = new Set(["cooling"]);

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateOptimizeDraftRequest(body) {
  const inputs = body?.inputs && typeof body.inputs === "object" ? body.inputs : {};
  const loadKw = asFiniteNumber(inputs.loadKw);
  const outdoorTempC = asFiniteNumber(inputs.outdoorTempC);
  const mode = typeof inputs.mode === "string" && inputs.mode.trim() ? inputs.mode.trim() : "cooling";

  if (loadKw === null) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid optimize input: loadKw is required",
      details: {
        field: "inputs.loadKw",
        expected: "finite number"
      }
    };
  }

  if (outdoorTempC === null) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid optimize input: outdoorTempC is required",
      details: {
        field: "inputs.outdoorTempC",
        expected: "finite number"
      }
    };
  }

  if (!ALLOWED_MODES.has(mode)) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: `Invalid optimize input: mode=${mode}`,
      details: {
        field: "inputs.mode",
        allowed: [...ALLOWED_MODES]
      }
    };
  }

  return {
    ok: true,
    request: {
      loadKw,
      outdoorTempC,
      mode
    }
  };
}

function createSourceEntry(key, endpoint, sourceStatus, fallbackMessage) {
  const overall = sourceStatus?.overall || "failed";
  const ok = overall === "ok" || overall === "partial";
  return {
    key,
    endpoint,
    ok,
    status: null,
    message: overall,
    error: ok ? null : fallbackMessage,
    rows: Array.isArray(sourceStatus?.sources) ? sourceStatus.sources.length : null
  };
}

function buildDraftFreshness(overview, anomalies) {
  const freshnessCandidates = [overview?.freshness, anomalies?.freshness].filter(Boolean);
  if (!freshnessCandidates.length) {
    return {
      latestTimestamp: null,
      stale: false,
      ageHours: null
    };
  }

  const latestTimestamp = freshnessCandidates.find((item) => item?.latestTimestamp)?.latestTimestamp ?? null;
  const ageHoursList = freshnessCandidates
    .map((item) => (typeof item?.ageHours === "number" ? item.ageHours : null))
    .filter((item) => item !== null);

  return {
    latestTimestamp,
    stale: freshnessCandidates.some((item) => Boolean(item?.stale)),
    ageHours: ageHoursList.length ? Math.max(...ageHoursList) : null
  };
}

function buildScenarioEstimate(request, overview) {
  const currentCop = asFiniteNumber(overview?.energyCards?.currentCop);
  const currentPowerKw = asFiniteNumber(overview?.energyCards?.totalPowerKw);
  if (currentCop === null || currentCop <= 0 || currentPowerKw === null || currentPowerKw <= 0) {
    return {
      currentCop,
      currentPowerKw,
      estimatedPowerKw: null,
      comparisonRatio: null
    };
  }

  const estimatedPowerKw = Number((request.loadKw / currentCop).toFixed(1));
  const comparisonRatio = Number((estimatedPowerKw / currentPowerKw).toFixed(2));
  return {
    currentCop,
    currentPowerKw,
    estimatedPowerKw,
    comparisonRatio
  };
}

function buildDecisionConfidence(overview, anomalies, recommendations) {
  const overviewOverall = overview?.sourceStatus?.overall || "failed";
  const anomalyOverall = anomalies?.sourceStatus?.overall || "failed";
  const recommendationOverall = recommendations?.sourceStatus?.overall || "failed";
  const allOk = [overviewOverall, anomalyOverall, recommendationOverall].every((item) => item === "ok");

  if (allOk) {
    return "rule-based-draft-stable";
  }

  const anyHealthy = [overviewOverall, anomalyOverall, recommendationOverall].some(
    (item) => item === "ok" || item === "partial"
  );
  if (anyHealthy) {
    return "rule-based-draft-partial";
  }

  return "rule-based-draft-degraded";
}

function dedupeSteps(steps) {
  const normalized = [];
  const seen = new Set();
  for (const step of steps) {
    const text = String(step || "").trim();
    if (!text) {
      continue;
    }
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function buildDraftSteps(request, overview, anomalies, recommendations) {
  const steps = [];
  const counts = anomalies?.counts || {};
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards : [];
  const totalPowerKw = asFiniteNumber(overview?.energyCards?.totalPowerKw);
  const currentCop = asFiniteNumber(overview?.energyCards?.currentCop);
  const scenarioEstimate = buildScenarioEstimate(request, overview);

  if ((counts.critical ?? 0) > 0 || (counts.major ?? 0) > 0) {
    steps.push(
      `Review active alarms first: critical=${counts.critical ?? 0}, major=${counts.major ?? 0}`
    );
  }

  for (const card of cards.slice(0, 3)) {
    const actions = Array.isArray(card?.actions)
      ? card.actions.filter((item) => typeof item === "string" && item.trim())
      : [];
    if (actions.length) {
      steps.push(...actions.slice(0, 2));
      continue;
    }
    if (typeof card?.title === "string" && card.title.trim()) {
      steps.push(`Review recommendation card: ${card.title.trim()}`);
    }
  }

  if (currentCop !== null || totalPowerKw !== null) {
    steps.push(
      `Use current station snapshot as draft baseline: COP=${currentCop ?? "n/a"}, totalPowerKw=${totalPowerKw ?? "n/a"}`
    );
  } else {
    steps.push("Current station efficiency snapshot is incomplete; keep optimize output at draft level.");
  }

  if (scenarioEstimate.comparisonRatio !== null) {
    if (scenarioEstimate.comparisonRatio >= 2) {
      steps.push(
        `Requested scenario implies much higher draft power than the current snapshot (ratio=${scenarioEstimate.comparisonRatio}); treat the draft as directional only`
      );
    } else if (scenarioEstimate.comparisonRatio <= 0.6) {
      steps.push(
        `Requested scenario implies lower draft power than the current snapshot (ratio=${scenarioEstimate.comparisonRatio}); validate whether the current equipment mix can be relaxed`
      );
    }
  } else if (currentCop === null || currentCop <= 0) {
    steps.push(
      "Current COP snapshot is unavailable or non-positive; keep optimize interpretation at explanatory draft level"
    );
  }

  const skippedRules = Array.isArray(recommendations?.ruleEvaluation?.skippedRuleDetails)
    ? recommendations.ruleEvaluation.skippedRuleDetails
    : [];
  if (skippedRules.length) {
    steps.push(
      `Rule diagnostics still have ${skippedRules.length} skipped item(s); keep draft review focused on observable signals first`
    );
  }

  steps.push(
    `Requested scenario fixed for draft review: loadKw=${request.loadKw}, outdoorTempC=${request.outdoorTempC}, mode=${request.mode}`
  );

  return dedupeSteps(steps).slice(0, 5);
}

function buildDraftDiagnostics(overview, anomalies, recommendations) {
  const diagnostics = [];
  const overviewOverall = overview?.sourceStatus?.overall || "unknown";
  const anomalyOverall = anomalies?.sourceStatus?.overall || "unknown";
  const recommendationOverall = recommendations?.sourceStatus?.overall || "unknown";
  const cardCount = Array.isArray(recommendations?.cards) ? recommendations.cards.length : 0;
  const totalAlarms = anomalies?.counts?.total ?? 0;
  const matchedRuleIds = Array.isArray(recommendations?.ruleEvaluation?.matchedRuleIds)
    ? recommendations.ruleEvaluation.matchedRuleIds
    : [];
  const skippedRuleIds = Array.isArray(recommendations?.ruleEvaluation?.skippedRuleIds)
    ? recommendations.ruleEvaluation.skippedRuleIds
    : [];

  diagnostics.push(`overview.sourceStatus=${overviewOverall}`);
  diagnostics.push(`anomalySummary.sourceStatus=${anomalyOverall}, totalAlarms=${totalAlarms}`);
  diagnostics.push(`recommendations.sourceStatus=${recommendationOverall}, cards=${cardCount}`);
  diagnostics.push(
    `ruleEvaluation.matched=${matchedRuleIds.length}, skipped=${skippedRuleIds.length}`
  );
  diagnostics.push("optimize engine is not implemented; current response is a context-backed draft only");

  return diagnostics;
}

function buildDecisionSummary(request, overview, anomalies, recommendations) {
  const totalAlarms = anomalies?.counts?.total ?? 0;
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards.length : 0;
  const scenarioEstimate = buildScenarioEstimate(request, overview);
  const scenarioText =
    scenarioEstimate.comparisonRatio === null
      ? `loadKw=${request.loadKw}, outdoorTempC=${request.outdoorTempC}`
      : `estimatedPowerRatio=${scenarioEstimate.comparisonRatio}`;
  if (cards > 0 || totalAlarms > 0) {
    return `context-backed draft derived from overview, anomalies (${totalAlarms}), and recommendation cards (${cards}); requested scenario ${scenarioText}`;
  }
  return `context-backed draft derived from current station overview; no recommendation cards matched, requested scenario ${scenarioText}`;
}

export function buildOptimizeDraftResponse(config, siteId, request, context = {}) {
  const overview = context.overview || null;
  const anomalies = context.anomalies || null;
  const recommendations = context.recommendations || null;

  return {
    site: {
      siteId
    },
    decision: {
      summary: buildDecisionSummary(request, overview, anomalies, recommendations),
      confidence: buildDecisionConfidence(overview, anomalies, recommendations)
    },
    request: {
      loadKw: request.loadKw,
      outdoorTempC: request.outdoorTempC,
      mode: request.mode
    },
    recommendation: {
      systemCop: asFiniteNumber(overview?.energyCards?.currentCop),
      totalPowerKw: asFiniteNumber(overview?.energyCards?.totalPowerKw),
      steps: buildDraftSteps(request, overview, anomalies, recommendations)
    },
    diagnostics: buildDraftDiagnostics(overview, anomalies, recommendations),
    freshness: buildDraftFreshness(overview, anomalies),
    sourceStatus: buildSourceStatus([
      createSourceEntry(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview?.sourceStatus,
        "dashboard overview unavailable"
      ),
      createSourceEntry(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies?.sourceStatus,
        "anomaly summary unavailable"
      ),
      createSourceEntry(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations?.sourceStatus,
        "recommendations unavailable"
      ),
      {
        key: "optimizeDraft",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: false,
        status: null,
        message: "context-backed draft only",
        error: "not implemented",
        rows: null
      }
    ]),
    generatedAt: buildGeneratedAt(config)
  };
}

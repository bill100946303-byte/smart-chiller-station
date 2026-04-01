import { buildGeneratedAt } from "./fieldPolicyService.js";
import { getEnergyEfficiencyProportion } from "./energyEfficiencyService.js";
import { getEnergyEfficiencyCalendar } from "./energyEfficiencyCalendarService.js";
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

function roundNullable(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

function buildBaseline(overview, anomalies) {
  const energyCards = overview?.energyCards || {};
  return {
    systemCop: asFiniteNumber(energyCards.currentCop),
    totalPowerKw: asFiniteNumber(energyCards.totalPowerKw),
    chilledDeltaT: asFiniteNumber(energyCards.chilledDeltaT),
    coolingDeltaT: asFiniteNumber(energyCards.coolingDeltaT),
    chillerPowerKw: asFiniteNumber(energyCards.chillerPowerKw),
    chilledPumpPowerKw: asFiniteNumber(energyCards.chilledPumpPowerKw),
    coolingPumpPowerKw: asFiniteNumber(energyCards.coolingPumpPowerKw),
    coolingTowerPowerKw: asFiniteNumber(energyCards.coolingTowerPowerKw),
    chilledSupplyTemp: asFiniteNumber(energyCards.chilledSupplyTemp),
    coolingReturnTemp: asFiniteNumber(energyCards.coolingReturnTemp),
    thermalUnbalanceRate: asFiniteNumber(energyCards.thermalUnbalanceRate),
    activeAlarmCount: anomalies?.counts?.total ?? asFiniteNumber(energyCards.activeAnomalyCount)
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

function buildGate(anomalies, decisionConfidence) {
  const critical = anomalies?.counts?.critical ?? 0;
  const major = anomalies?.counts?.major ?? 0;
  if (critical > 0) {
    return {
      level: "blocked",
      title: "暂不建议优化",
      reason: `当前存在 ${critical} 条紧急告警，请先排障后再评审优化草案。`
    };
  }
  if (major > 0 || decisionConfidence !== "rule-based-draft-stable") {
    const reason =
      major > 0
        ? `当前存在 ${major} 条严重告警，建议先稳住风险后再评审优化空间。`
        : "当前草案仍存在部分降级或缺测信号，建议谨慎评审。";
    return {
      level: "caution",
      title: "谨慎评审",
      reason
    };
  }
  return {
    level: "ready",
    title: "可评审",
    reason: "当前草案数据完整度较好，可进入方案对比评审。"
  };
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

function buildDraftDiagnostics(overview, anomalies, recommendations, historyBenchmark) {
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
  diagnostics.push(
    `historyBenchmark.status=${historyBenchmark?.status || "unavailable"}, samples=${historyBenchmark?.sampleCount ?? 0}`
  );
  diagnostics.push("optimize engine is not implemented; current response is a context-backed draft only");

  return diagnostics;
}

function buildRuleEvidence(recommendations) {
  const ruleEvaluation = recommendations?.ruleEvaluation || {};
  const matchedRuleIds = Array.isArray(ruleEvaluation.matchedRuleIds) ? ruleEvaluation.matchedRuleIds : [];
  const skippedRules = Array.isArray(ruleEvaluation.skippedRuleDetails) ? ruleEvaluation.skippedRuleDetails : [];
  const primaryCards = Array.isArray(recommendations?.cards) ? recommendations.cards.slice(0, 3) : [];
  return {
    matchedCount: matchedRuleIds.length,
    skippedCount: skippedRules.length,
    matchedRuleIds,
    skippedRules,
    primaryCards
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function parseMonthLabel(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

function shiftMonthLabel(monthLabel, offset) {
  const normalized = parseMonthLabel(monthLabel);
  if (!normalized) {
    return null;
  }
  const [yearText, monthText] = normalized.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1, 12, 0, 0, 0);
  date.setMonth(date.getMonth() + offset);
  return formatMonthLabel(date);
}

function buildHistoryMonthPlan(now = new Date(), maxMonths = 6) {
  const base = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(base.getTime())) {
    return [];
  }
  base.setDate(1);
  base.setHours(12, 0, 0, 0);
  const currentMonth = formatMonthLabel(base);
  const months = [];
  for (let offset = 0; offset < maxMonths; offset += 1) {
    const monthLabel = shiftMonthLabel(currentMonth, -offset);
    if (monthLabel) {
      months.push(monthLabel);
    }
  }
  return months;
}

function normalizeBucketLabel(value) {
  return String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseBucketRangePercent(value) {
  const normalized = normalizeBucketLabel(value);
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*%?\s*[~\-至]\s*(-?\d+(?:\.\d+)?)\s*%?/);
  if (!match) {
    return null;
  }

  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return { min, max };
}

function bucketContainsLoadRate(range, value) {
  if (!range || typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  const upperInclusive = range.max >= 100 ? value <= range.max : value < range.max;
  return value >= range.min && upperInclusive;
}

function bucketAnchorValue(range, fallback = null) {
  if (!range) {
    return fallback;
  }
  return (range.min + range.max) / 2;
}

function isUsableBenchmarkValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeLoadRatioPct(value) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return null;
  }
  const normalized = numeric <= 1 ? numeric * 100 : numeric;
  return Number(normalized.toFixed(1));
}

function normalizeStationEfficiency(value) {
  return roundNullable(asFiniteNumber(value), 2);
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return roundNullable(sorted[middle], 2);
  }
  return roundNullable((sorted[middle - 1] + sorted[middle]) / 2, 2);
}

function buildReferenceCopSummary(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      low: null,
      median: null,
      high: null
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  return {
    low: roundNullable(sorted[0], 2),
    median: computeMedian(sorted),
    high: roundNullable(sorted.at(-1), 2)
  };
}

const HISTORY_BENCHMARK_MIN_SAMPLES = 3;
const HISTORY_BENCHMARK_WET_BULB_BUCKET_C = 2;
const HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C = 2;

function normalizeWetBulbC(value) {
  const numeric = asFiniteNumber(value);
  return numeric === null ? null : roundNullable(numeric, 1);
}

function buildWetBulbBand(value, bucketSize = HISTORY_BENCHMARK_WET_BULB_BUCKET_C) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return null;
  }

  const size = bucketSize > 0 ? bucketSize : HISTORY_BENCHMARK_WET_BULB_BUCKET_C;
  const lower = Math.floor(numeric / size) * size;
  const upper = lower + size;
  return {
    key: `${lower}-${upper}`,
    label: `${lower}℃~${upper}℃湿球区间`,
    min: lower,
    max: upper
  };
}

function collectWetBulbBands(rows) {
  const uniqueBands = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const band = row?.wetBulbBand;
    if (!band || !band.key) {
      continue;
    }
    if (!uniqueBands.has(band.key)) {
      uniqueBands.set(band.key, band);
    }
  }

  return [...uniqueBands.values()]
    .sort((left, right) => left.min - right.min || left.max - right.max || left.label.localeCompare(right.label))
    .map((band) => band.label);
}

function countUniqueMonths(rows) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => row?.month)
      .filter((month) => typeof month === "string" && month.trim().length > 0)
  ).size;
}

function buildHistoryBenchmarkConfidence(matchingTier) {
  if (matchingTier === "load-wetbulb-strict") {
    return "high";
  }
  if (matchingTier === "load-wetbulb-relaxed") {
    return "medium";
  }
  return "low";
}

function buildHistoryBenchmarkScoreAdjustment(confidence) {
  if (confidence === "high") {
    return 2;
  }
  if (confidence === "low") {
    return -2;
  }
  return 0;
}

function buildHistoryBenchmarkUnavailableResult({
  requestedLoadRatePct,
  requestedWetBulbC,
  ratedCoolingCapacityKw,
  defaultMonths,
  note,
  source = null
}) {
  return {
    mode: "load-band",
    status: "unavailable",
    matchingTier: "unavailable",
    fallbackLevel: 3,
    ratedCoolingCapacityKw,
    requestedLoadRatePct,
    requestedWetBulbC,
    matchedBucketLabel: null,
    matchedWetBulbBand: null,
    matchedWetBulbBands: [],
    wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
    confidence: "low",
    sampleWindow: {
      defaultMonths,
      months: defaultMonths,
      maxMonths: 6
    },
    sampleCount: 0,
    referenceCop: {
      low: null,
      median: null,
      high: null
    },
    currentGap: {
      copDeltaToMedian: null,
      powerDeltaKwToMedian: null
    },
    note,
    links: {
      proportionHref: {
        href: "/energy-efficiency?tab=proportion",
        enabled: true,
        label: "看占比"
      },
      compareHref: {
        href: "/energy-efficiency?tab=compare",
        enabled: true,
        label: "看对比"
      }
    },
    source
  };
}

function pickClosestWetBulbRow(rows, requestedWetBulbC) {
  const candidates = Array.isArray(rows)
    ? rows.filter((row) => typeof row?.wetBulbC === "number" && Number.isFinite(row.wetBulbC))
    : [];
  if (!candidates.length) {
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  if (typeof requestedWetBulbC !== "number" || !Number.isFinite(requestedWetBulbC)) {
    return candidates.sort(
      (left, right) => (right.stationEfficiency ?? 0) - (left.stationEfficiency ?? 0)
    )[0];
  }

  return candidates
    .map((row) => ({
      row,
      distance: Math.abs(row.wetBulbC - requestedWetBulbC)
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        ((right.row.stationEfficiency ?? 0) - (left.row.stationEfficiency ?? 0))
    )[0]?.row || candidates[0];
}

function getRatedCoolingCapacityKw(config) {
  const directValue = asFiniteNumber(config?.ratedCoolingCapacityKw);
  if (directValue !== null && directValue > 0) {
    return directValue;
  }
  const sourceValue = asFiniteNumber(config?.siteSourceConfig?.ratedCoolingCapacityKw);
  if (sourceValue !== null && sourceValue > 0) {
    return sourceValue;
  }
  return null;
}

function buildHistoryBenchmarkSourceEntry(siteId, benchmark, endpointPath = "energy-efficiency/proportion") {
  const status = benchmark?.status || "unavailable";
  return {
    key: "historyBenchmark",
    endpoint: `/bff/v1/sites/${siteId}/${endpointPath}`,
    ok: status !== "unavailable",
    fallback: status === "partial",
    status: null,
    message: status,
    error: status === "unavailable" ? "historical benchmark unavailable" : null,
    rows: benchmark?.sampleCount ?? null
  };
}

function buildBenefitEstimate(request, baseline, benchmark) {
  const median = asFiniteNumber(benchmark?.referenceCop?.median);
  const confidence = benchmark?.confidence || "low";
  const basis = {
    matchingTier: benchmark?.matchingTier || "unavailable",
    fallbackLevel: benchmark?.fallbackLevel ?? 3,
    sampleCount: benchmark?.sampleCount ?? 0,
    monthCount: Array.isArray(benchmark?.sampleWindow?.months) ? benchmark.sampleWindow.months.length : 0,
    matchedMonthCount: benchmark?.matchedMonthCount ?? 0,
    matchedWetBulbBands: Array.isArray(benchmark?.matchedWetBulbBands) ? benchmark.matchedWetBulbBands : []
  };
  if (median === null || median <= 0) {
    return {
      status: benchmark?.status || "unavailable",
      opportunityLevel: "low",
      expectedTargetCop: null,
      expectedTargetPowerKw: null,
      expectedPowerDeltaKw: null,
      expectedPowerDeltaPct: null,
      expectedCopDelta: null,
      confidence,
      basis,
      disclaimer: "历史对标收益为草案估算，不代表真实节能结果"
    };
  }

  const expectedTargetPowerKw = roundNullable(request.loadKw / median, 1);
  const expectedPowerDeltaKw =
    expectedTargetPowerKw !== null && baseline?.totalPowerKw !== null
      ? roundNullable(expectedTargetPowerKw - baseline.totalPowerKw, 1)
      : null;
  const expectedPowerDeltaPct =
    expectedPowerDeltaKw !== null && baseline?.totalPowerKw !== null && baseline.totalPowerKw > 0
      ? roundNullable(expectedPowerDeltaKw / baseline.totalPowerKw, 2)
      : null;
  const expectedCopDelta =
    baseline?.systemCop !== null ? roundNullable(median - baseline.systemCop, 2) : null;

  let opportunityLevel = "low";
  if (expectedPowerDeltaPct !== null) {
    if (expectedPowerDeltaPct <= -0.1) {
      opportunityLevel = "high";
    } else if (expectedPowerDeltaPct <= -0.03) {
      opportunityLevel = "medium";
    }
  } else if (expectedCopDelta !== null && expectedCopDelta >= 0.5) {
    opportunityLevel = "medium";
  }

  return {
    status: benchmark?.status || "partial",
    opportunityLevel,
    expectedTargetCop: roundNullable(median, 2),
    expectedTargetPowerKw,
    expectedPowerDeltaKw,
    expectedPowerDeltaPct,
    expectedCopDelta,
    confidence,
    basis,
    disclaimer: "历史对标收益为草案估算，不代表真实节能结果"
  };
}

function collectActionReadinessSignals(deviceActions) {
  const blockers = [];
  const checkpoints = [];

  for (const action of Array.isArray(deviceActions) ? deviceActions : []) {
    const preconditions = Array.isArray(action?.preconditions)
      ? action.preconditions.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [];
    if (preconditions.length === 0) {
      continue;
    }

    const priority = String(action?.priority || "").toLowerCase();
    if (priority === "high") {
      blockers.push(...preconditions);
      continue;
    }
    checkpoints.push(...preconditions);
  }

  return {
    blockers: dedupeSteps(blockers).slice(0, 4),
    checkpoints: dedupeSteps(checkpoints).slice(0, 4)
  };
}

function clampScore(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildReviewReadiness(baseline, historyBenchmark, gate) {
  const missingSignals = [];
  if (baseline?.systemCop === null || baseline?.systemCop === undefined) {
    missingSignals.push("baseline.systemCop");
  }
  if (baseline?.totalPowerKw === null || baseline?.totalPowerKw === undefined) {
    missingSignals.push("baseline.totalPowerKw");
  }

  const gateLevel = gate?.level || "blocked";
  const historyStatus = historyBenchmark?.status || "unavailable";
  const confidenceAdjustment = buildHistoryBenchmarkScoreAdjustment(historyBenchmark?.confidence);
  const hints = [];

  if (missingSignals.length > 0) {
    hints.push("先补齐现态 COP 与总功率快照，再回到优化草案");
    hints.push("若数据源暂时不稳，先查看设备总览和趋势页确认现态");
    hints.push("缺失信号补齐前，优先采用保守方案");
    return {
      status: "unavailable",
      score: clampScore((missingSignals.length > 1 ? 20 : 35) + confidenceAdjustment),
      reason: `关键现态信号缺失：${missingSignals.join("、")}`,
      missingSignals,
      hints
    };
  }

  if (historyStatus === "unavailable") {
    hints.push("先查看设备总览与趋势页，继续确认当前现态");
    hints.push("历史对标补齐前，先按现态草案进行保守评审");
    hints.push("可优先核对历史占比或日历样本后再回评");
    return {
      status: "partial",
      score: clampScore((gateLevel === "ready" ? 62 : 58) + confidenceAdjustment),
      reason: "历史对标不可用，已回退现态草案",
      missingSignals: ["historyBenchmark.status"],
      hints
    };
  }

  if (historyStatus === "partial") {
    hints.push("历史样本仍不完整，建议先评审保守方案");
    hints.push("可继续查看设备级动作与趋势页，确认关键抓手");
    hints.push("补齐更多历史样本后，再回看效率上限");
    return {
      status: gateLevel === "ready" ? "ready" : "partial",
      score: clampScore((gateLevel === "ready" ? 74 : 66) + confidenceAdjustment),
      reason:
        gateLevel === "ready"
          ? "关键现态齐全，历史对标部分可用，可进入方案评审"
          : "关键现态齐全，但历史对标仅部分可用，建议谨慎评审",
      missingSignals: [],
      hints
    };
  }

  hints.push("先查看设备级动作卡，确认高优先级前置条件");
  hints.push("继续打开趋势页核对 COP 与总功率变化");
  hints.push("若需要稳妥推进，优先从保守方案开始");

  if (gateLevel === "ready") {
    return {
      status: "ready",
      score: clampScore(86 + confidenceAdjustment),
      reason: "关键现态齐全且历史对标已匹配，可进入方案评审",
      missingSignals: [],
      hints
    };
  }

  if (gateLevel === "caution") {
    return {
      status: "partial",
      score: clampScore(68 + confidenceAdjustment),
      reason: "关键现态齐全，但门禁仍提示谨慎，建议先做保守评审",
      missingSignals: [],
      hints
    };
  }

  return {
    status: "partial",
    score: clampScore(58 + confidenceAdjustment),
    reason: "关键现态齐全，但门禁仍被阻断，当前仅适合保守评审",
    missingSignals: [],
    hints
  };
}

function buildBenchmarkSchemeNumbers(request, targetCop, currentCop, currentPowerKw) {
  const normalizedTargetCop = asFiniteNumber(targetCop);
  if (normalizedTargetCop === null || normalizedTargetCop <= 0) {
    return {
      targetPowerKw: null,
      targetCop: null,
      powerDeltaPct: null,
      copDelta: null
    };
  }

  const targetPowerKw = roundNullable(request.loadKw / normalizedTargetCop, 1);
  const powerDeltaPct =
    targetPowerKw !== null && currentPowerKw !== null && currentPowerKw > 0
      ? roundNullable((targetPowerKw - currentPowerKw) / currentPowerKw, 2)
      : null;
  const copDelta =
    currentCop !== null ? roundNullable(normalizedTargetCop - currentCop, 2) : null;

  return {
    targetPowerKw,
    targetCop: roundNullable(normalizedTargetCop, 1),
    powerDeltaPct,
    copDelta
  };
}

function buildScenarioSchemeNumbers(request, scenarioEstimate, multiplier) {
  if (
    scenarioEstimate.estimatedPowerKw === null ||
    scenarioEstimate.currentPowerKw === null ||
    scenarioEstimate.currentCop === null
  ) {
    return {
      targetPowerKw: null,
      targetCop: null,
      powerDeltaPct: null,
      copDelta: null
    };
  }

  const targetPowerKw = roundNullable(scenarioEstimate.estimatedPowerKw * multiplier, 1);
  const targetCop = targetPowerKw && targetPowerKw > 0 ? roundNullable(request.loadKw / targetPowerKw, 1) : null;
  const powerDeltaPct =
    scenarioEstimate.currentPowerKw > 0 && targetPowerKw !== null
      ? roundNullable((targetPowerKw - scenarioEstimate.currentPowerKw) / scenarioEstimate.currentPowerKw, 2)
      : null;
  const copDelta =
    targetCop !== null && scenarioEstimate.currentCop !== null
      ? roundNullable(targetCop - scenarioEstimate.currentCop, 2)
      : null;

  return {
    targetPowerKw,
    targetCop,
    powerDeltaPct,
    copDelta
  };
}

function buildSchemeReadiness(scheme, gate, reviewReadiness, deviceActions, historyBenchmark) {
  const { blockers, checkpoints } = collectActionReadinessSignals(deviceActions);
  const levelSource = String(scheme?.status || "").toLowerCase();
  const gateLevel = gate?.level || "blocked";
  const reviewStatus = reviewReadiness?.status || "unavailable";
  const confidenceAdjustment = buildHistoryBenchmarkScoreAdjustment(historyBenchmark?.confidence);

  let level = "blocked";
  if (gateLevel !== "blocked" && reviewStatus !== "unavailable") {
    if (levelSource === "ready") {
      level = reviewStatus === "ready" ? "ready" : "caution";
    } else if (levelSource === "caution") {
      level = "caution";
    } else {
      level = "blocked";
    }
  }

  let score = 24;
  if (level === "ready") {
    score = 84;
  } else if (level === "caution") {
    score = 64;
  }

  if (reviewStatus === "partial") {
    score -= 4;
  } else if (reviewStatus === "unavailable") {
    score = Math.min(score, 36);
  }

  if (gateLevel === "caution") {
    score -= 3;
  } else if (gateLevel === "blocked") {
    score = Math.min(score, 28);
  }

  if (String(scheme?.key || "") === "efficiencyFirst") {
    score -= level === "ready" ? 3 : 0;
  } else if (String(scheme?.key || "") === "conservative") {
    score += level === "ready" ? 3 : 1;
  }

  score += confidenceAdjustment;

  const reason =
    level === "ready"
      ? "当前方案具备可执行条件，可进入方案评审"
      : level === "caution"
        ? "当前方案可保守评审，建议先核对前置条件"
        : gateLevel === "blocked"
          ? "当前门禁阻断，需先排障再评审"
          : "关键现态或前置条件不足，方案暂不可执行";

  return {
    score: clampScore(score),
    level,
    reason,
    blockers: blockers.length ? blockers : reviewStatus === "unavailable" ? [...(reviewReadiness?.missingSignals || [])] : [],
    checkpoints
  };
}

function buildHistoryBenchmarkContext(reports, monthPlan) {
  const byMonth = new Map();
  if (Array.isArray(reports)) {
    for (const report of reports) {
      const month = parseMonthLabel(report?.filters?.date || report?.month);
      if (month) {
        byMonth.set(month, report);
      }
    }
  } else if (reports && typeof reports === "object") {
    for (const [month, report] of Object.entries(reports)) {
      const normalized = parseMonthLabel(month);
      const reportMonth = parseMonthLabel(report?.filters?.date || report?.month);
      if (normalized) {
        byMonth.set(normalized, report);
      } else if (reportMonth) {
        byMonth.set(reportMonth, report);
      }
    }
  }

  return monthPlan.map((month) => byMonth.get(month) || null);
}

function resolveHistorySourceOk(sourceStatus, preferredKeys = []) {
  if (!sourceStatus || typeof sourceStatus !== "object") {
    return false;
  }
  if (sourceStatus.ok === true || sourceStatus.overall === "ok") {
    return true;
  }

  const sources = Array.isArray(sourceStatus.sources) ? sourceStatus.sources : [];
  if (!sources.length) {
    return false;
  }

  const candidates = preferredKeys.length
    ? sources.filter((source) => preferredKeys.includes(String(source?.key || "")))
    : sources;
  return candidates.some((source) => source?.ok === true);
}

function buildLoadBand(value) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return null;
  }
  if (numeric >= 100) {
    return {
      key: "100+",
      label: "100%+负荷区间",
      min: 100,
      max: Number.POSITIVE_INFINITY
    };
  }
  const lower = Math.max(0, Math.floor(numeric / 10) * 10);
  const upper = lower + 10;
  return {
    key: `${lower}-${upper}`,
    label: `${lower}%~${upper}%负荷区间`,
    min: lower,
    max: upper
  };
}

function buildHistoryCurrentGap(request, baseline, referenceCop) {
  const median = asFiniteNumber(referenceCop?.median);
  return {
    copDeltaToMedian:
      median !== null && baseline?.systemCop !== null
        ? roundNullable(median - baseline.systemCop, 2)
        : null,
    powerDeltaKwToMedian:
      median !== null && baseline?.totalPowerKw !== null
        ? roundNullable(request.loadKw / median - baseline.totalPowerKw, 1)
        : null
  };
}

function normalizeCalendarBenchmarkPoint(item, month, ratedCoolingCapacityKw) {
  const efficiency = normalizeStationEfficiency(item?.efficiency ?? item?.rawEfficiency);
  const cooling = asFiniteNumber(item?.cooling);
  if (!isUsableBenchmarkValue(efficiency) || cooling === null || cooling <= 0 || ratedCoolingCapacityKw <= 0) {
    return null;
  }

  const averageLoadKw = roundNullable(cooling / 24, 1);
  const loadRatePct = roundNullable((averageLoadKw / ratedCoolingCapacityKw) * 100, 1);
  const band = buildLoadBand(loadRatePct);
  if (!band) {
    return null;
  }

  return {
    month,
    date: String(item?.date || ""),
    efficiency,
    cooling,
    averageLoadKw,
    loadRatePct,
    bandKey: band.key,
    bandLabel: band.label
  };
}

function summarizeHistoryCalendarItems({ requestedLoadRatePct, ratedCoolingCapacityKw, rowsByMonth }) {
  const points = rowsByMonth.flatMap((entry) =>
    Array.isArray(entry?.items)
      ? entry.items
          .map((item) => normalizeCalendarBenchmarkPoint(item, entry.month, ratedCoolingCapacityKw))
          .filter(Boolean)
      : []
  );

  if (points.length === 0) {
    return {
      status: "unavailable",
      matchedBucketLabel: null,
      matchedMonthCount: 0,
      matchedWetBulbBands: [],
      sampleCount: 0,
      referenceCop: {
        low: null,
        median: null,
        high: null
      },
      currentGap: {
        copDeltaToMedian: null,
        powerDeltaKwToMedian: null
      }
    };
  }

  const matchedMonthCount = new Set(points.map((point) => point.month)).size;
  const requestedBand = buildLoadBand(requestedLoadRatePct);
  let matchedPoints = requestedBand
    ? points.filter((point) => point.bandKey === requestedBand.key)
    : [];
  let matchedBucketLabel = requestedBand?.label || null;

  if (matchedPoints.length === 0 && requestedLoadRatePct !== null) {
    let bestPoint = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const distance = Math.abs((point.loadRatePct ?? 0) - requestedLoadRatePct);
      if (
        distance < bestDistance ||
        (distance === bestDistance &&
          (bestPoint === null || (point.efficiency ?? 0) > (bestPoint.efficiency ?? 0)))
      ) {
        bestPoint = point;
        bestDistance = distance;
      }
    }
    if (bestPoint) {
      matchedBucketLabel = bestPoint.bandLabel;
      matchedPoints = points.filter((point) => point.bandKey === bestPoint.bandKey);
    }
  }

  if (matchedPoints.length === 0) {
    const fallbackPoint = points[0];
    matchedBucketLabel = fallbackPoint?.bandLabel || null;
    matchedPoints =
      fallbackPoint ? points.filter((point) => point.bandKey === fallbackPoint.bandKey) : [];
  }

  const referenceValues = matchedPoints
    .map((point) => point.efficiency)
    .filter((value) => isUsableBenchmarkValue(value));
  if (referenceValues.length === 0) {
    return {
      status: "unavailable",
      matchedBucketLabel,
      matchedMonthCount,
      matchedWetBulbBands: [],
      sampleCount: 0,
      referenceCop: {
        low: null,
        median: null,
        high: null
      },
      currentGap: {
        copDeltaToMedian: null,
        powerDeltaKwToMedian: null
      }
    };
  }

  const status = matchedMonthCount >= HISTORY_BENCHMARK_MIN_SAMPLES
    ? rowsByMonth.every((entry) => entry?.ok === true)
      ? "ready"
      : "partial"
    : "partial";

  return {
    status,
    matchedBucketLabel,
    matchedMonthCount,
    matchedWetBulbBands: [],
    sampleCount: referenceValues.length,
    referenceCop: buildReferenceCopSummary(referenceValues),
    currentGap: {
      copDeltaToMedian: null,
      powerDeltaKwToMedian: null
    }
  };
}

async function loadHistoryBenchmarkReports(config, siteId, request, baseline, context) {
  const ratedCoolingCapacityKw = getRatedCoolingCapacityKw(config);
  const defaultMonths = buildHistoryMonthPlan(context?.now || new Date(), 6).slice(0, 3);
  if (ratedCoolingCapacityKw === null) {
    return buildHistoryBenchmarkUnavailableResult({
      requestedLoadRatePct: null,
      requestedWetBulbC: normalizeWetBulbC(request.outdoorTempC),
      ratedCoolingCapacityKw: null,
      defaultMonths,
      note: "首版采用草案筛选口径按负荷率区间与湿球边界做匹配，不执行真实控制；当前缺少额定制冷能力，无法完成历史对标。",
      source: buildHistoryBenchmarkSourceEntry(siteId, {
        status: "unavailable",
        sampleCount: 0
      })
    });
  }

  const requestedLoadRatePct = roundNullable((request.loadKw / ratedCoolingCapacityKw) * 100, 1);
  const requestedWetBulbC = normalizeWetBulbC(request.outdoorTempC);
  const monthPlan = buildHistoryMonthPlan(context?.now || new Date(), 6);
  const providedReports = buildHistoryBenchmarkContext(context?.historyBenchmarkReports, monthPlan);
  const rowsByMonth = [];
  let sampledMonths = 0;

  for (const month of monthPlan) {
    let report = providedReports[sampledMonths] || null;
    if (!report) {
      report = await getEnergyEfficiencyProportion(config, siteId, {
        date: month,
        dateType: "2"
      });
    }
    sampledMonths += 1;

    const rows = Array.isArray(report?.rows) ? report.rows : [];
    rowsByMonth.push({
      month,
      ok: resolveHistorySourceOk(report?.sourceStatus, ["energyEfficiencyProportion"]),
      rows
    });

    const summary = summarizeHistoryBenchmarkRows({
      requestedLoadRatePct,
      requestedWetBulbC,
      rowsByMonth
    });

    if (summary.matchingTier !== "unavailable" && summary.matchedMonthCount >= HISTORY_BENCHMARK_MIN_SAMPLES) {
      break;
    }
  }

  const summary = summarizeHistoryBenchmarkRows({
    requestedLoadRatePct,
    requestedWetBulbC,
    rowsByMonth
  });

  if (summary.status !== "unavailable") {
    return {
      mode: "load-band",
      ...summary,
      currentGap: buildHistoryCurrentGap(request, baseline, summary.referenceCop),
      ratedCoolingCapacityKw,
      requestedLoadRatePct,
      sampleWindow: {
        defaultMonths,
        months: rowsByMonth.map((item) => item.month),
        maxMonths: 6
      },
      note:
        summary.matchingTier === "load-wetbulb-strict"
          ? "历史对标采用草案筛选口径按负荷区间与湿球边界匹配，当前命中严格匹配样本，不执行真实控制。"
          : summary.matchingTier === "load-wetbulb-relaxed"
            ? `历史对标采用草案筛选口径按负荷区间与湿球边界匹配，严格样本不足，已放宽到同负荷近邻湿球样本（回退层级 ${summary.fallbackLevel}），不执行真实控制。`
            : summary.matchingTier === "load-only-fallback"
              ? `历史对标采用草案筛选口径按负荷区间与湿球边界匹配，但湿球样本不足，已回退到仅负荷区间匹配（回退层级 ${summary.fallbackLevel}），不执行真实控制。`
              : "历史对标采用草案筛选口径按负荷区间与湿球边界匹配，但当前样本不可用，不执行真实控制。",
      links: {
        proportionHref: {
          href: "/energy-efficiency?tab=proportion",
          enabled: true,
          label: "看占比"
        },
        compareHref: {
          href: "/energy-efficiency?tab=compare",
          enabled: true,
          label: "看对比"
        }
      },
      source: buildHistoryBenchmarkSourceEntry(siteId, {
        status: summary.status,
        sampleCount: summary.sampleCount
      })
    };
  }

  const providedCalendarReports = buildHistoryBenchmarkContext(context?.historyCalendarReports, monthPlan);
  const calendarRowsByMonth = [];
  let sampledCalendarMonths = 0;

  for (const month of monthPlan) {
    let report = providedCalendarReports[sampledCalendarMonths] || null;
    if (!report) {
      report = await getEnergyEfficiencyCalendar(config, siteId, { month });
    }
    sampledCalendarMonths += 1;

    calendarRowsByMonth.push({
      month,
      ok: resolveHistorySourceOk(report?.sourceStatus, ["energyEfficiencyCalendar"]),
      items: Array.isArray(report?.items) ? report.items : []
    });

    const calendarSummary = summarizeHistoryCalendarItems({
      requestedLoadRatePct,
      ratedCoolingCapacityKw,
      rowsByMonth: calendarRowsByMonth
    });

    if (calendarSummary.matchedMonthCount >= HISTORY_BENCHMARK_MIN_SAMPLES) {
      break;
    }
  }

  const calendarSummary = summarizeHistoryCalendarItems({
    requestedLoadRatePct,
    ratedCoolingCapacityKw,
    rowsByMonth: calendarRowsByMonth
  });

  if (calendarSummary.status === "unavailable") {
    return buildHistoryBenchmarkUnavailableResult({
      requestedLoadRatePct,
      requestedWetBulbC,
      ratedCoolingCapacityKw,
      defaultMonths,
      note: "历史对标采用草案筛选口径按负荷区间与湿球边界回退，不执行真实控制；当前占比与日历样本均不可用。",
      source: buildHistoryBenchmarkSourceEntry(siteId, {
        status: "unavailable",
        sampleCount: 0
      })
    });
  }

  return {
    mode: "load-band",
    ...calendarSummary,
    matchingTier: "load-only-fallback",
    fallbackLevel: 2,
    requestedWetBulbC,
    matchedWetBulbBand: null,
    matchedWetBulbBands: [],
    wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
    confidence: buildHistoryBenchmarkConfidence("load-only-fallback"),
    currentGap: buildHistoryCurrentGap(request, baseline, calendarSummary.referenceCop),
    ratedCoolingCapacityKw,
    requestedLoadRatePct,
    sampleWindow: {
      defaultMonths,
      months: calendarRowsByMonth.map((item) => item.month),
      maxMonths: 6
    },
    note:
      "历史对标采用草案筛选口径按负荷区间与湿球边界回退，不执行真实控制；当前历史占比样本不足，已回退到历史日历日均冷量估算。",
    links: {
      proportionHref: {
        href: "/energy-efficiency?tab=proportion",
        enabled: true,
        label: "看占比"
      },
      compareHref: {
        href: "/energy-efficiency?tab=compare",
        enabled: true,
        label: "看对比"
      }
    },
    source: buildHistoryBenchmarkSourceEntry(
      siteId,
      {
        status: calendarSummary.status,
        sampleCount: calendarSummary.sampleCount
      },
      "energy-efficiency/calendar"
    )
  };
}

function summarizeHistoryBenchmarkRows({ requestedLoadRatePct, requestedWetBulbC, rowsByMonth }) {
  const allRows = rowsByMonth.flatMap((entry) =>
    Array.isArray(entry?.rows)
      ? entry.rows.map((row, index) => {
          const rangeLabel = String(row?.rangeLabel || row?.["负荷区间"] || "").trim();
          const loadRatioPct = normalizeLoadRatioPct(row?.loadRatioPct || row?.["负荷比重比例"]);
          const stationEfficiency = normalizeStationEfficiency(row?.stationEfficiency || row?.["冷站效能"]);
          const wetBulbC = normalizeWetBulbC(
            row?.wetBulbC ?? row?.["湿球温度"] ?? row?.["湿球"] ?? row?.["室外湿球温度"] ?? row?.["outdoorWetBulbC"]
          );
          return {
            month: entry.month,
            rowIndex: index,
            ok: entry.ok === true,
            rangeLabel,
            normalizedRangeLabel: normalizeBucketLabel(rangeLabel),
            bucketRangePct: parseBucketRangePercent(rangeLabel),
            loadRatioPct,
            stationEfficiency,
            wetBulbC,
            wetBulbBand: buildWetBulbBand(wetBulbC)
          };
        })
      : []
  );

  const usableRows = allRows.filter(
    (row) => row.rangeLabel && isUsableBenchmarkValue(row.stationEfficiency)
  );
  const requestedWetBulbValue = normalizeWetBulbC(requestedWetBulbC);
  if (usableRows.length === 0) {
    return {
      status: "unavailable",
      matchingTier: "unavailable",
      fallbackLevel: 3,
      requestedWetBulbC: requestedWetBulbValue,
      matchedBucketLabel: null,
      matchedWetBulbBand: null,
      matchedWetBulbBands: [],
      matchedMonthCount: 0,
      wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
      confidence: "low",
      sampleCount: 0,
      referenceCop: {
        low: null,
        median: null,
        high: null
      },
      currentGap: {
        copDeltaToMedian: null,
        powerDeltaKwToMedian: null
      }
    };
  }

  const requestedLoadBand = buildLoadBand(requestedLoadRatePct);
  const requestedWetBulbBand = buildWetBulbBand(requestedWetBulbC);
  const loadMatchedRows = requestedLoadBand
    ? usableRows.filter((row) => bucketContainsLoadRate(row.bucketRangePct, requestedLoadRatePct))
    : [];
  const strictRows = requestedWetBulbBand
    ? loadMatchedRows.filter((row) => row.wetBulbBand?.key === requestedWetBulbBand.key)
    : [];
  const relaxedRows =
    requestedWetBulbC !== null && Number.isFinite(requestedWetBulbC)
      ? loadMatchedRows.filter(
          (row) =>
            row.wetBulbC !== null &&
            Math.abs(row.wetBulbC - requestedWetBulbC) <= HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C
        )
      : [];
  const loadOnlyRows = loadMatchedRows;

  let chosenRows = [];
  let matchingTier = "unavailable";
  let fallbackLevel = 3;
  let matchedWetBulbBand = null;
  let matchedWetBulbBands = [];

  if (strictRows.length >= HISTORY_BENCHMARK_MIN_SAMPLES) {
    chosenRows = strictRows;
    matchingTier = "load-wetbulb-strict";
    fallbackLevel = 0;
    matchedWetBulbBand = requestedWetBulbBand?.label || null;
  } else if (relaxedRows.length >= HISTORY_BENCHMARK_MIN_SAMPLES) {
    chosenRows = relaxedRows;
    matchingTier = "load-wetbulb-relaxed";
    fallbackLevel = 1;
    matchedWetBulbBand = pickClosestWetBulbRow(relaxedRows, requestedWetBulbC)?.wetBulbBand?.label
      || requestedWetBulbBand?.label
      || null;
  } else if (loadOnlyRows.length > 0) {
    chosenRows = loadOnlyRows;
    matchingTier = "load-only-fallback";
    fallbackLevel = 2;
  }

  matchedWetBulbBands = collectWetBulbBands(chosenRows);
  if (!matchedWetBulbBand && matchedWetBulbBands.length > 0) {
    matchedWetBulbBand = matchedWetBulbBands[0];
  }

  if (chosenRows.length === 0) {
    return {
      status: "unavailable",
      matchingTier: "unavailable",
      fallbackLevel: 3,
      requestedWetBulbC: requestedWetBulbValue,
      matchedBucketLabel: requestedLoadBand?.label || null,
      matchedWetBulbBand: null,
      matchedWetBulbBands: [],
      matchedMonthCount: 0,
      wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
      confidence: "low",
      sampleCount: 0,
      referenceCop: {
        low: null,
        median: null,
        high: null
      },
      currentGap: {
        copDeltaToMedian: null,
        powerDeltaKwToMedian: null
      }
    };
  }

  const referenceValues = chosenRows
    .map((row) => row.stationEfficiency)
    .filter((value) => isUsableBenchmarkValue(value));
  if (referenceValues.length === 0) {
    return {
      status: "unavailable",
      matchingTier: "unavailable",
      fallbackLevel: 3,
      requestedWetBulbC: requestedWetBulbValue,
      matchedBucketLabel: requestedLoadBand?.label || chosenRows[0]?.rangeLabel || null,
      matchedWetBulbBand,
      matchedWetBulbBands,
      matchedMonthCount: countUniqueMonths(chosenRows),
      wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
      confidence: "low",
      sampleCount: 0,
      referenceCop: {
        low: null,
        median: null,
        high: null
      },
      currentGap: {
        copDeltaToMedian: null,
        powerDeltaKwToMedian: null
      }
    };
  }

  const summary = buildReferenceCopSummary(referenceValues);
  const matchedMonthCount = countUniqueMonths(chosenRows);
  const status =
    matchedMonthCount >= HISTORY_BENCHMARK_MIN_SAMPLES
      ? rowsByMonth.every((entry) => entry?.ok === true)
        ? "ready"
        : "partial"
      : "partial";
  const representativeRow =
    matchingTier === "load-wetbulb-relaxed"
      ? pickClosestWetBulbRow(chosenRows, requestedWetBulbValue)
      : chosenRows[0];

  return {
    status,
    matchingTier,
    fallbackLevel,
    requestedWetBulbC: requestedWetBulbValue,
    matchedBucketLabel: requestedLoadBand?.label || representativeRow?.rangeLabel || null,
    matchedWetBulbBand,
    matchedWetBulbBands,
    matchedMonthCount,
    wetBulbToleranceC: HISTORY_BENCHMARK_WET_BULB_TOLERANCE_C,
    confidence: buildHistoryBenchmarkConfidence(matchingTier),
    sampleCount: referenceValues.length,
    referenceCop: summary,
    currentGap: {
      copDeltaToMedian: null,
      powerDeltaKwToMedian: null
    }
  };
}

function inferDeviceTypeFallback(primaryCard) {
  const fragments = [
    primaryCard?.ruleId,
    primaryCard?.title,
    primaryCard?.category
  ]
    .filter((item) => typeof item === "string" && item.trim())
    .join(" ")
    .toLowerCase();

  if (fragments.includes("chilled") || fragments.includes("delta-t-chilled")) {
    return "chilledPump";
  }
  if (fragments.includes("cooling-side") || fragments.includes("tower")) {
    return "coolingTower";
  }
  if (fragments.includes("pump") && fragments.includes("cooling")) {
    return "coolingPump";
  }
  return null;
}

function inferTrendMetric(primaryCard) {
  const fragments = [
    primaryCard?.ruleId,
    primaryCard?.title,
    primaryCard?.category
  ]
    .filter((item) => typeof item === "string" && item.trim())
    .join(" ")
    .toLowerCase();

  if (fragments.includes("cop") || fragments.includes("efficiency")) {
    return "currentCop";
  }
  if (fragments.includes("chilled")) {
    return "chilledDeltaT";
  }
  if (fragments.includes("cooling") || fragments.includes("tower")) {
    return "coolingDeltaT";
  }
  return "totalPowerKw";
}

function buildSchemeLinks(siteId, primaryCard) {
  const relatedDeviceId =
    Array.isArray(primaryCard?.relatedDevices) && primaryCard.relatedDevices.length > 0
      ? String(primaryCard.relatedDevices[0])
      : "";
  const typeFallback = inferDeviceTypeFallback(primaryCard);
  const deviceSearch = new URLSearchParams();
  if (relatedDeviceId) {
    deviceSearch.set("deviceId", relatedDeviceId);
  }
  if (typeFallback) {
    deviceSearch.set("type", typeFallback);
  }

  const sceneSearch = new URLSearchParams({
    mode: "2d",
    floor: "10"
  });
  if (relatedDeviceId) {
    sceneSearch.set("deviceId", relatedDeviceId);
  }

  const trendSearch = new URLSearchParams({
    metric: inferTrendMetric(primaryCard),
    range: "24h"
  });

  return {
    devices: {
      href: `/devices${deviceSearch.toString() ? `?${deviceSearch.toString()}` : ""}`,
      enabled: true,
      label: "看设备"
    },
    trends: {
      href: `/trend-analysis?${trendSearch.toString()}`,
      enabled: true,
      label: "看趋势"
    },
    scene: {
      href: `/scene-control?${sceneSearch.toString()}`,
      enabled: true,
      label: "看场景"
    }
  };
}

function buildSchemeActions(primaryCards, fallbackSteps) {
  const cardActions = primaryCards.flatMap((card) =>
    Array.isArray(card?.actions)
      ? card.actions.filter((item) => typeof item === "string" && item.trim()).slice(0, 2)
      : []
  );
  return dedupeSteps([...cardActions, ...fallbackSteps]).slice(0, 4);
}

function rankActionPriority(value) {
  if (value === "high") {
    return 0;
  }
  if (value === "medium") {
    return 1;
  }
  return 2;
}

function buildDeviceActionPlan(request, baseline, historyBenchmark, gate, schemeKey) {
  const actions = [];
  const chilledDeltaT = asFiniteNumber(baseline?.chilledDeltaT);
  const coolingDeltaT = asFiniteNumber(baseline?.coolingDeltaT);
  const systemCop = asFiniteNumber(baseline?.systemCop);
  const totalPowerKw = asFiniteNumber(baseline?.totalPowerKw);
  const chillerPowerKw = asFiniteNumber(baseline?.chillerPowerKw);
  const benchmarkCopMedian = asFiniteNumber(historyBenchmark?.referenceCop?.median);
  const benchmarkCopHigh = asFiniteNumber(historyBenchmark?.referenceCop?.high);

  if (gate?.level === "blocked") {
    actions.push({
      system: "system",
      action: "保持当前运行策略，先排除高等级告警",
      target: "告警清零后再评审优化草案",
      reason: "当前存在紧急告警，任何优化调整都有放大风险",
      risk: "high",
      priority: "high",
      preconditions: ["紧急告警已清零", "主链路人工接管信号已解除"]
    });
    return actions;
  }

  if (chilledDeltaT !== null && chilledDeltaT > 0 && chilledDeltaT < 3) {
    actions.push({
      system: "chilledPump",
      action: "冷冻侧优先抬升温差",
      target: "检查旁通与末端阀位，适度下调冷冻泵频率",
      reason: `当前冷冻温差 ${chilledDeltaT}°C 偏低，存在大流量小温差风险`,
      risk: schemeKey === "efficiencyFirst" ? "medium" : "low",
      priority: "high",
      preconditions: ["冷冻泵具备变频调节能力", "末端阀位与旁通开度可监测"]
    });
  }

  if (coolingDeltaT !== null && coolingDeltaT > 0 && coolingDeltaT < 2.5) {
    actions.push({
      system: "coolingTower",
      action: "冷却侧优先抬升温差",
      target: "复核冷却泵与塔风机协同，避免过度降温",
      reason: `当前冷却温差 ${coolingDeltaT}°C 偏低，冷却侧效率偏弱`,
      risk: schemeKey === "efficiencyFirst" ? "medium" : "low",
      priority: "high",
      preconditions: ["冷却塔风机与冷却泵可联动调节", "冷凝侧关键测点连续可用"]
    });
  }

  if (systemCop !== null && systemCop > 0 && systemCop < 4.2) {
    actions.push({
      system: "chiller",
      action: "提高机组负载集中度",
      target: "优先让主机落在高效率区间，必要时减少并机台数",
      reason: `当前系统 COP ${systemCop} 偏低，主机负载可能被摊薄`,
      risk: schemeKey === "efficiencyFirst" ? "high" : "medium",
      priority: "medium",
      preconditions: ["机组最小负载与防喘振约束满足", "短时启停次数在可接受范围内"]
    });
  }

  if (benchmarkCopMedian !== null && systemCop !== null && systemCop > 0 && benchmarkCopMedian > systemCop) {
    actions.push({
      system: "system",
      action: "靠近历史高效区间运行",
      target: `历史中位 COP ${benchmarkCopMedian}，优先逼近该效率区间`,
      reason: "历史对标显示相同负荷下存在更优效率区间",
      risk: schemeKey === "efficiencyFirst" ? "medium" : "low",
      priority: "medium",
      preconditions: ["历史对标样本状态为已匹配", "当前无高等级告警阻塞"]
    });
  }

  if (
    schemeKey === "efficiencyFirst" &&
    benchmarkCopHigh !== null &&
    systemCop !== null &&
    systemCop > 0 &&
    benchmarkCopHigh > systemCop
  ) {
    actions.push({
      system: "system",
      action: "尝试进入历史最佳效率区",
      target: `历史高位 COP ${benchmarkCopHigh}，需复核塔泵与机组协同`,
      reason: "效率优先方案以历史高效区为锚点",
      risk: "high",
      priority: "medium",
      preconditions: ["值守人员确认可接受中高风险策略", "已完成保守方案下的稳定性核查"]
    });
  }

  if (totalPowerKw !== null && totalPowerKw > 0 && chillerPowerKw !== null && chillerPowerKw > 0) {
    const chillerRatio = chillerPowerKw / totalPowerKw;
    if (chillerRatio < 0.4) {
      actions.push({
        system: "coolingPump",
        action: "关注辅机能耗占比",
        target: "核对泵塔功率分摊，避免辅机功率偏高",
        reason: "当前主机功率占比偏低，辅机可能成为主要能耗",
        risk: "low",
        priority: "low",
        preconditions: ["主机与辅机功率测点均连续可用"]
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      system: "system",
      action: "维持现态观测并补齐关键测点",
      target: "优先确保 COP、总功率、温差连续",
      reason: "可用的效率信号不足以生成设备级动作",
      risk: "low",
      priority: "low",
      preconditions: ["持续回传核心测点后再进入设备级优化"]
    });
  }

  return actions
    .sort((left, right) => rankActionPriority(left?.priority) - rankActionPriority(right?.priority))
    .slice(0, 4);
}

function buildSchemes(
  siteId,
  request,
  gate,
  recommendations,
  fallbackSteps,
  scenarioEstimate,
  baseline,
  historyBenchmark,
  reviewReadiness
) {
  const primaryCards = Array.isArray(recommendations?.cards) ? recommendations.cards.slice(0, 3) : [];
  const primaryCard = primaryCards[0] || null;
  const schemeActions = buildSchemeActions(primaryCards, fallbackSteps);
  const benchmarkReady =
    historyBenchmark?.status === "ready" &&
    historyBenchmark?.referenceCop &&
    historyBenchmark.referenceCop.median !== null;
  const benchmarkLow = asFiniteNumber(historyBenchmark?.referenceCop?.low);
  const benchmarkMedian = asFiniteNumber(historyBenchmark?.referenceCop?.median);
  const benchmarkHigh = asFiniteNumber(historyBenchmark?.referenceCop?.high);
  const schemeConfigs = [
    {
      key: "conservative",
      title: "保守方案",
      label: "保守方案",
      focus: "先稳住风险",
      multiplier: 1.05
    },
    {
      key: "balanced",
      title: "平衡方案",
      label: "平衡方案",
      focus: "兼顾效率与稳定",
      multiplier: 1
    },
    {
      key: "efficiencyFirst",
      title: "节能优先",
      label: "节能优先",
      focus: "优先挖节能空间",
      multiplier: 0.95
    }
  ];

  return schemeConfigs.map((scheme) => {
    let status = "ready";
    let riskLevel = "low";

    if (gate.level === "blocked") {
      status = "blocked";
      riskLevel = "high";
    } else if (gate.level === "caution") {
      if (scheme.key === "conservative") {
        status = "ready";
        riskLevel = "medium";
      } else if (scheme.key === "balanced") {
        status = "caution";
        riskLevel = "medium";
      } else {
        status = "blocked";
        riskLevel = "high";
      }
    } else if (scheme.key === "conservative") {
      riskLevel = "low";
    } else {
      status = scheme.key === "efficiencyFirst" ? "caution" : "ready";
      riskLevel = "medium";
    }

    const schemeNumbers = benchmarkReady
      ? buildBenchmarkSchemeNumbers(
          request,
          scheme.key === "conservative"
            ? (scenarioEstimate.currentCop !== null && benchmarkLow !== null
                ? Math.max(scenarioEstimate.currentCop, benchmarkLow)
                : benchmarkLow)
            : scheme.key === "balanced"
              ? benchmarkMedian
              : benchmarkHigh,
          scenarioEstimate.currentCop,
          scenarioEstimate.currentPowerKw
        )
      : buildScenarioSchemeNumbers(request, scenarioEstimate, scheme.multiplier);

    const deviceActions = buildDeviceActionPlan(request, baseline, historyBenchmark, gate, scheme.key);

    return {
      key: scheme.key,
      title: scheme.title,
      status,
      riskLevel,
      focus: scheme.focus,
      label: scheme.label,
      ...schemeNumbers,
      deviceActions,
      readiness: buildSchemeReadiness(
        {
          key: scheme.key,
          status
        },
        gate,
        reviewReadiness,
        deviceActions,
        historyBenchmark
      ),
      actions: schemeActions,
      links: buildSchemeLinks(siteId, primaryCard)
    };
  });
}

function buildDecisionSummary(request, overview, anomalies, recommendations, historyBenchmark) {
  const totalAlarms = anomalies?.counts?.total ?? 0;
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards.length : 0;
  const scenarioEstimate = buildScenarioEstimate(request, overview);
  const scenarioText =
    scenarioEstimate.comparisonRatio === null
      ? `loadKw=${request.loadKw}, outdoorTempC=${request.outdoorTempC}`
      : `estimatedPowerRatio=${scenarioEstimate.comparisonRatio}`;
  const benchmarkText =
    historyBenchmark?.status && historyBenchmark.status !== "unavailable"
      ? `; historical benchmark ${historyBenchmark.status} (${historyBenchmark.matchedBucketLabel || "load band"}, samples=${historyBenchmark.sampleCount})`
      : "";
  if (cards > 0 || totalAlarms > 0) {
    return `context-backed draft derived from overview, anomalies (${totalAlarms}), and recommendation cards (${cards}); requested scenario ${scenarioText}${benchmarkText}`;
  }
  return `context-backed draft derived from current station overview; no recommendation cards matched, requested scenario ${scenarioText}${benchmarkText}`;
}

export async function buildOptimizeDraftResponse(config, siteId, request, context = {}) {
  const overview = context.overview || null;
  const anomalies = context.anomalies || null;
  const recommendations = context.recommendations || null;
  const decisionConfidence = buildDecisionConfidence(overview, anomalies, recommendations);
  const recommendationSteps = buildDraftSteps(request, overview, anomalies, recommendations);
  const gate = buildGate(anomalies, decisionConfidence);
  const scenarioEstimate = buildScenarioEstimate(request, overview);
  const baseline = buildBaseline(overview, anomalies);
  const historyBenchmarkBundle = await loadHistoryBenchmarkReports(
    config,
    siteId,
    request,
    baseline,
    context
  );
  const { source: historyBenchmarkSource, ...historyBenchmark } = historyBenchmarkBundle;
  const benefitEstimate = buildBenefitEstimate(request, baseline, historyBenchmark);
  const reviewReadiness = buildReviewReadiness(baseline, historyBenchmark, gate);
  const schemes = buildSchemes(
    siteId,
    request,
    gate,
    recommendations,
    recommendationSteps,
    scenarioEstimate,
    baseline,
    historyBenchmark,
    reviewReadiness
  );

  return {
    site: {
      siteId
    },
    decision: {
      summary: buildDecisionSummary(request, overview, anomalies, recommendations, historyBenchmark),
      confidence: decisionConfidence
    },
    request: {
      loadKw: request.loadKw,
      outdoorTempC: request.outdoorTempC,
      mode: request.mode
    },
    recommendation: {
      systemCop: asFiniteNumber(overview?.energyCards?.currentCop),
      totalPowerKw: asFiniteNumber(overview?.energyCards?.totalPowerKw),
      steps: recommendationSteps
    },
    gate,
    baseline,
    historyBenchmark,
    benefitEstimate,
    reviewReadiness,
    schemes,
    ruleEvidence: buildRuleEvidence(recommendations),
    draftLabel: "规则估算草案，仅供方案评审",
    diagnostics: buildDraftDiagnostics(overview, anomalies, recommendations, historyBenchmark),
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
      historyBenchmarkSource || null,
      {
        key: "optimizeDraft",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: false,
        status: null,
        message: "context-backed draft only",
        error: "not implemented",
        rows: null
      }
    ].filter(Boolean)),
    generatedAt: buildGeneratedAt(config)
  };
}

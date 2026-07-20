import { buildGeneratedAt } from "./fieldPolicyService.js";
import { getEnergyEfficiencyProportion } from "./energyEfficiencyService.js";
import { getEnergyEfficiencyCalendar } from "./energyEfficiencyCalendarService.js";
import { buildSourceStatus } from "./sourceStatusService.js";
import { resolveTowerApproachDispatchConfig } from "./optimizeExecutionDispatchService.js";

const ALLOWED_MODES = new Set(["cooling"]);
const METERED_LOAD_SOURCES = new Set(["metered", "live_meter", "cooling_meter", "realtime_meter"]);
const THERMAL_UNBALANCE_CAUTION_RATE = 0.15;
const TOWER_APPROACH_MAX_STEP_C = 0.5;
const TOWER_APPROACH_DEADBAND_C = 0.2;
const TOWER_APPROACH_MAX_PLAUSIBLE_C = 20;
const PUMP_FREQ_TRIM_MIN_HZ = -5;
const PUMP_FREQ_TRIM_MAX_HZ = 3;
const PUMP_FREQ_TRIM_STEP_HZ = 1;
const PUMP_FREQ_TRIM_TTL_SECONDS = 300;
const PUMP_FREQ_TRIM_HOLD_MINUTES = 5;
const PUMP_FREQ_TRIM_ROLLBACK_LOCKOUT_MINUTES = 15;
const CHILLED_DELTA_T_TARGET_BAND_C = {
  low: 4.5,
  high: 6.5,
  label: "冷冻水温差目标区"
};
const COOLING_DELTA_T_TARGET_BAND_C = {
  low: 4,
  high: 6,
  label: "冷却水温差目标区"
};
const CHILLER_STAGING_MIN_SAMPLE_COUNT = 30;
const CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT = 100;
const CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES = 90;
const CHILLER_STAGING_MIN_RESERVE_PCT = 12;
const CHILLER_STAGING_LOAD_RATE_TOLERANCE_PCT = 10;
const CHILLER_STAGING_WET_BULB_TOLERANCE_C = 1.5;
const CHILLER_STAGING_CHWS_TOLERANCE_C = 0.5;
const CHILLER_STAGING_MIN_SAVE_KW = 30;
const CHILLER_STAGING_MIN_SAVE_PCT = 5;
const CHILLER_STAGING_SHADOW_COMPARE_MINUTES = {
  min: 30,
  max: 60
};
const CHILLER_STAGING_RUNTIME_SAMPLE_INTERVAL_MINUTES = 5;
const CHILLER_STAGING_RUNTIME_LOAD_RATE_BUCKET_PCT = 5;
const CHILLER_STAGING_RUNTIME_WET_BULB_BUCKET_C = 1;
const CHILLER_STAGING_RUNTIME_CHWS_BUCKET_C = 0.5;
const KW_PER_RT = 3.5168525;

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asPositiveNumber(value) {
  const normalized = asFiniteNumber(value);
  return normalized !== null && normalized > 0 ? normalized : null;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOptionalTextList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = [];
  const seen = new Set();
  for (const rawItem of value) {
    const item = normalizeOptionalText(rawItem);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    items.push(item);
  }
  return items;
}

function normalizeOptionalNumberMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeOptionalText(rawKey);
    const number = asPositiveNumber(rawValue);
    if (!key || number === null) {
      continue;
    }
    normalized[key] = number;
  }
  return normalized;
}

export function validateOptimizeDraftRequest(body) {
  const inputs = body?.inputs && typeof body.inputs === "object" ? body.inputs : {};
  const loadKw = asFiniteNumber(inputs.loadKw);
  const outdoorTempC = asFiniteNumber(inputs.outdoorTempC);
  const mode = typeof inputs.mode === "string" && inputs.mode.trim() ? inputs.mode.trim() : "cooling";
  const loadSource =
    typeof inputs.loadSource === "string" && inputs.loadSource.trim()
      ? inputs.loadSource.trim()
      : "scenario";
  const equipmentContext =
    inputs.equipmentContext && typeof inputs.equipmentContext === "object" && !Array.isArray(inputs.equipmentContext)
      ? inputs.equipmentContext
      : {};

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
      loadSource,
      outdoorTempC,
      mode,
      equipmentContext: {
        activeChillerIds: normalizeOptionalTextList(equipmentContext.activeChillerIds),
        activeChillerModels: normalizeOptionalTextList(equipmentContext.activeChillerModels)
      }
    }
  };
}

function normalizeSourceIssueDetail(sourceStatus) {
  const sources = Array.isArray(sourceStatus?.sources) ? sourceStatus.sources : [];
  const detail = sources
    .map((source) => `${String(source?.message || "")} ${String(source?.error || "")}`.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  return detail;
}

function resolveSourceHttpStatus(sourceStatus) {
  const sources = Array.isArray(sourceStatus?.sources) ? sourceStatus.sources : [];
  const statuses = sources
    .map((source) => (typeof source?.status === "number" && Number.isFinite(source.status) ? source.status : null))
    .filter((item) => item !== null);
  if (!statuses.length) {
    return null;
  }
  return Math.max(...statuses);
}

function resolveSourceReasonCode(sourceStatus, options = {}) {
  const requiredSnapshot = Array.isArray(options?.requiredSnapshot) ? options.requiredSnapshot : [];
  const hasMissingSnapshot = requiredSnapshot.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const value = item.value;
    return value == null || (typeof value === "number" && !Number.isFinite(value));
  });
  if (hasMissingSnapshot) {
    return options?.missingSnapshotCode || "snapshot_missing";
  }

  if (!sourceStatus || typeof sourceStatus !== "object") {
    return "source_missing";
  }

  const overall = sourceStatus.overall || "failed";
  const issueDetail = normalizeSourceIssueDetail(sourceStatus);
  const statusCode = resolveSourceHttpStatus(sourceStatus);

  if (overall === "ok") {
    return "ready";
  }

  if (
    issueDetail.includes("field_missing_or_invalid") ||
    issueDetail.includes("field missing") ||
    issueDetail.includes("invalid")
  ) {
    return "field_missing_or_invalid";
  }

  if (
    issueDetail.includes("upstream_unreachable") ||
    issueDetail.includes("unreachable") ||
    issueDetail.includes("fetch failed")
  ) {
    return "upstream_unreachable";
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return "upstream_5xx";
  }

  if (typeof statusCode === "number" && statusCode >= 400) {
    return "upstream_4xx";
  }

  if (overall === "partial") {
    return "partial_fallback";
  }

  return "upstream_unavailable";
}

function createSourceEntry(key, endpoint, sourceStatus, fallbackMessage, options = {}) {
  const overall = sourceStatus?.overall || "failed";
  const ok = overall === "ok" || overall === "partial";
  return {
    key,
    endpoint,
    ok,
    reasonCode: resolveSourceReasonCode(sourceStatus, options),
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
  const currentCop = asPositiveNumber(overview?.energyCards?.currentCop);
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
    systemCop: asPositiveNumber(energyCards.currentCop),
    totalPowerKw: asFiniteNumber(energyCards.totalPowerKw),
    chilledDeltaT: asFiniteNumber(energyCards.chilledDeltaT),
    coolingDeltaT: asFiniteNumber(energyCards.coolingDeltaT),
    chillerPowerKw: asFiniteNumber(energyCards.chillerPowerKw),
    chilledPumpPowerKw: asFiniteNumber(energyCards.chilledPumpPowerKw),
    coolingPumpPowerKw: asFiniteNumber(energyCards.coolingPumpPowerKw),
    coolingTowerPowerKw: asFiniteNumber(energyCards.coolingTowerPowerKw),
    chilledSupplyTemp: asFiniteNumber(energyCards.chilledSupplyTemp),
    coolingReturnTemp: asFiniteNumber(energyCards.coolingReturnTemp),
    outdoorWetBulbC: asFiniteNumber(energyCards.outdoorWetBulbC),
    outdoorTempC: asFiniteNumber(energyCards.outdoorTempC),
    outdoorHumidityPct: asFiniteNumber(energyCards.outdoorHumidityPct),
    thermalUnbalanceRate: asFiniteNumber(energyCards.thermalUnbalanceRate),
    activeAlarmCount: anomalies?.counts?.total ?? asFiniteNumber(energyCards.activeAnomalyCount)
  };
}

export function buildOptimizeExecutionFeedbackSnapshot(overview, anomalies, options = {}) {
  return {
    phase: normalizeOptionalText(options.phase) || null,
    capturedAt: normalizeOptionalText(options.capturedAt) || new Date().toISOString(),
    baseline: buildBaseline(overview, anomalies),
    freshness: buildDraftFreshness(overview, anomalies),
    sourceStatus: {
      overview: overview?.sourceStatus?.overall || "unknown",
      anomalies: anomalies?.sourceStatus?.overall || "unknown"
    }
  };
}

function normalizeThermalUnbalanceRate(value) {
  const normalized = asFiniteNumber(value);
  if (normalized === null) {
    return null;
  }
  return Math.abs(normalized) > 1 ? normalized / 100 : normalized;
}

function formatThermalUnbalancePct(value) {
  const normalized = normalizeThermalUnbalanceRate(value);
  return normalized === null ? null : roundNullable(normalized * 100, 1);
}

function isHighThermalUnbalance(value) {
  const normalized = normalizeThermalUnbalanceRate(value);
  return normalized !== null && Math.abs(normalized) >= THERMAL_UNBALANCE_CAUTION_RATE;
}

function isDraftFreshnessStale(config, freshness) {
  if (freshness?.stale === true) {
    return true;
  }
  const thresholdHours = asPositiveNumber(config?.staleThresholdHours);
  return (
    thresholdHours !== null &&
    typeof freshness?.ageHours === "number" &&
    Number.isFinite(freshness.ageHours) &&
    freshness.ageHours > thresholdHours
  );
}

function buildDecisionConfidence(overview, anomalies, recommendations, freshness, config) {
  const overviewOverall = overview?.sourceStatus?.overall || "failed";
  const anomalyOverall = anomalies?.sourceStatus?.overall || "failed";
  const recommendationOverall = recommendations?.sourceStatus?.overall || "failed";
  const allOk = [overviewOverall, anomalyOverall, recommendationOverall].every((item) => item === "ok");

  if (allOk && !isDraftFreshnessStale(config, freshness)) {
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

function buildGate(anomalies, decisionConfidence, baseline, freshness, config, adaptiveGuardrail = null) {
  const critical = anomalies?.counts?.critical ?? 0;
  const major = anomalies?.counts?.major ?? 0;
  const thermalUnbalanceRate = asFiniteNumber(baseline?.thermalUnbalanceRate);
  const freshnessStale = isDraftFreshnessStale(config, freshness);
  const adaptiveReasons = Array.isArray(adaptiveGuardrail?.reasons) ? adaptiveGuardrail.reasons : [];
  const adaptiveCaution = adaptiveGuardrail?.level === "caution" && adaptiveReasons.length > 0;
  if (critical > 0) {
    return {
      level: "blocked",
      title: "暂不建议优化",
      reason: `当前存在 ${critical} 条紧急告警，请先排障后再评审优化草案。`
    };
  }
  if (
    major > 0
    || freshnessStale
    || isHighThermalUnbalance(thermalUnbalanceRate)
    || decisionConfidence !== "rule-based-draft-stable"
    || adaptiveCaution
  ) {
    const reasons = [];
    if (major > 0) {
      reasons.push(`当前存在 ${major} 条严重告警`);
    }
    if (freshnessStale) {
      reasons.push("现态快照已超过新鲜度阈值");
    }
    if (isHighThermalUnbalance(thermalUnbalanceRate)) {
      reasons.push(`热平衡偏差 ${formatThermalUnbalancePct(thermalUnbalanceRate)}% 偏高`);
    }
    reasons.push(...adaptiveReasons);
    if (!reasons.length) {
      reasons.push("当前草案仍存在部分降级或缺测信号");
    }
    return {
      level: "caution",
      title: "谨慎评审",
      reason: `${reasons.join("，")}，建议先稳住风险后再评审优化空间。`
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

function parseNonNegativeInteger(value, fallback = 0) {
  const numeric = asFiniteNumber(value);
  if (numeric === null || numeric < 0) {
    return fallback;
  }
  return Math.floor(numeric);
}

function getSchemeStatusRank(status) {
  if (status === "ready") {
    return 0;
  }
  if (status === "caution") {
    return 1;
  }
  if (status === "blocked") {
    return 2;
  }
  return 3;
}

function getSchemePreferenceRank(key) {
  if (key === "aggressive") {
    return 0;
  }
  if (key === "balanced") {
    return 1;
  }
  if (key === "conservative") {
    return 2;
  }
  return 3;
}

function pickPrimaryScheme(schemes) {
  if (!Array.isArray(schemes) || !schemes.length) {
    return null;
  }
  return [...schemes].sort((left, right) => {
    const statusDiff = getSchemeStatusRank(left?.status) - getSchemeStatusRank(right?.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const readinessLeft = typeof left?.readiness?.score === "number" ? left.readiness.score : -1;
    const readinessRight = typeof right?.readiness?.score === "number" ? right.readiness.score : -1;
    if (readinessLeft !== readinessRight) {
      return readinessRight - readinessLeft;
    }
    return getSchemePreferenceRank(left?.key) - getSchemePreferenceRank(right?.key);
  })[0];
}

function findLatestExecutionByStatus(executions, status, type = null) {
  const items = Array.isArray(executions) ? executions : [];
  return (
    items.find((item) => {
      if (normalizeOptionalText(item?.status) !== status) {
        return false;
      }
      if (type && normalizeOptionalText(item?.execution?.type) !== type) {
        return false;
      }
      return true;
    }) || null
  );
}

function formatExecutionTypeLabel(type) {
  if (type === "tower-approach") {
    return "接近度执行";
  }
  if (type === "scheme") {
    return "方案执行";
  }
  return "执行记录";
}

function formatSchemeLabel(value, fallback = "当前主方案") {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return fallback;
  }
  if (normalized === "aggressive") {
    return "激进方案";
  }
  if (normalized === "balanced") {
    return "平衡方案";
  }
  if (normalized === "conservative") {
    return "保守方案";
  }
  return normalized;
}

function formatSignedDelta(value, digits = 1, unit = "") {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return null;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}${unit}`;
}

function formatExecutionIdentity(record) {
  const execution = record?.execution || {};
  const typeLabel = formatExecutionTypeLabel(normalizeOptionalText(execution.type));
  if (execution.type === "scheme") {
    const schemeLabel = formatSchemeLabel(execution.schemeKey, "方案");
    return `${typeLabel}（${schemeLabel}）`;
  }
  if (execution.type === "tower-approach") {
    const approach = asFiniteNumber(execution.targetApproachC);
    const tcws = asFiniteNumber(execution.targetTcwsC);
    const parts = [];
    if (tcws !== null) {
      parts.push(`冷却水出水温 ${tcws.toFixed(1)} ℃`);
    }
    if (approach !== null) {
      parts.push(`接近度 ${approach.toFixed(1)} ℃`);
    }
    return parts.length ? `${typeLabel}（${parts.join(" / ")}）` : typeLabel;
  }
  return typeLabel;
}

function normalizeObservedSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const baseline =
    value.baseline && typeof value.baseline === "object" && !Array.isArray(value.baseline) ? value.baseline : {};
  const systemCop = asPositiveNumber(baseline.systemCop);
  const totalPowerKw = asFiniteNumber(baseline.totalPowerKw);
  const activeAlarmCount = asFiniteNumber(baseline.activeAlarmCount);
  const thermalUnbalanceRate = asFiniteNumber(baseline.thermalUnbalanceRate);
  const phase = normalizeOptionalText(value.phase) || null;
  const capturedAt = normalizeOptionalText(value.capturedAt) || null;
  if (
    !phase
    && !capturedAt
    && systemCop === null
    && totalPowerKw === null
    && activeAlarmCount === null
    && thermalUnbalanceRate === null
  ) {
    return null;
  }
  return {
    phase,
    capturedAt,
    systemCop,
    totalPowerKw,
    activeAlarmCount,
    thermalUnbalanceRate
  };
}

function normalizeDraftBaselineSnapshot(record) {
  if (!record || typeof record !== "object") {
    return null;
  }
  return normalizeObservedSnapshot({
    phase: "submitted",
    capturedAt: record.createdAt,
    baseline: record?.draft?.baseline
  });
}

function classifyObservedBaselineComparison(comparison) {
  const improvingSignals = [];
  const degradingSignals = [];
  if (typeof comparison?.systemCopDelta === "number") {
    if (comparison.systemCopDelta >= 0.1) {
      improvingSignals.push("cop");
    } else if (comparison.systemCopDelta <= -0.1) {
      degradingSignals.push("cop");
    }
  }
  if (typeof comparison?.totalPowerDeltaKw === "number") {
    if (comparison.totalPowerDeltaKw <= -5) {
      improvingSignals.push("power");
    } else if (comparison.totalPowerDeltaKw >= 5) {
      degradingSignals.push("power");
    }
  }
  if (typeof comparison?.activeAlarmDelta === "number") {
    if (comparison.activeAlarmDelta <= -1) {
      improvingSignals.push("alarm");
    } else if (comparison.activeAlarmDelta >= 1) {
      degradingSignals.push("alarm");
    }
  }
  if (typeof comparison?.thermalUnbalanceDelta === "number") {
    if (comparison.thermalUnbalanceDelta <= -0.02) {
      improvingSignals.push("thermal");
    } else if (comparison.thermalUnbalanceDelta >= 0.02) {
      degradingSignals.push("thermal");
    }
  }
  if (improvingSignals.length && !degradingSignals.length) {
    return "improved";
  }
  if (degradingSignals.length && !improvingSignals.length) {
    return "degraded";
  }
  if (improvingSignals.length || degradingSignals.length) {
    return "mixed";
  }
  return "flat";
}

function buildObservedBaselineComparison(submittedBaselineSnapshot, latestObservedSnapshot) {
  if (!submittedBaselineSnapshot || !latestObservedSnapshot) {
    return null;
  }
  const systemCopDelta =
    submittedBaselineSnapshot.systemCop !== null && latestObservedSnapshot.systemCop !== null
      ? roundNullable(latestObservedSnapshot.systemCop - submittedBaselineSnapshot.systemCop, 2)
      : null;
  const totalPowerDeltaKw =
    submittedBaselineSnapshot.totalPowerKw !== null && latestObservedSnapshot.totalPowerKw !== null
      ? roundNullable(latestObservedSnapshot.totalPowerKw - submittedBaselineSnapshot.totalPowerKw, 1)
      : null;
  const activeAlarmDelta =
    submittedBaselineSnapshot.activeAlarmCount !== null && latestObservedSnapshot.activeAlarmCount !== null
      ? roundNullable(latestObservedSnapshot.activeAlarmCount - submittedBaselineSnapshot.activeAlarmCount, 0)
      : null;
  const submittedThermalUnbalanceRate = normalizeThermalUnbalanceRate(submittedBaselineSnapshot.thermalUnbalanceRate);
  const latestThermalUnbalanceRate = normalizeThermalUnbalanceRate(latestObservedSnapshot.thermalUnbalanceRate);
  const thermalUnbalanceDelta =
    submittedThermalUnbalanceRate !== null && latestThermalUnbalanceRate !== null
      ? roundNullable(latestThermalUnbalanceRate - submittedThermalUnbalanceRate, 4)
      : null;
  if (
    systemCopDelta === null
    && totalPowerDeltaKw === null
    && activeAlarmDelta === null
    && thermalUnbalanceDelta === null
  ) {
    return null;
  }
  const status = classifyObservedBaselineComparison({
    systemCopDelta,
    totalPowerDeltaKw,
    activeAlarmDelta,
    thermalUnbalanceDelta
  });
  const parts = [];
  const copText = formatSignedDelta(systemCopDelta, 2, "");
  const powerText = formatSignedDelta(totalPowerDeltaKw, 1, " kW");
  const alarmText = formatSignedDelta(activeAlarmDelta, 0, "");
  if (copText) {
    parts.push(`COP ${copText}`);
  }
  if (powerText) {
    parts.push(`功率 ${powerText}`);
  }
  if (alarmText) {
    parts.push(`告警 ${alarmText}`);
  }
  if (typeof thermalUnbalanceDelta === "number" && Number.isFinite(thermalUnbalanceDelta) && thermalUnbalanceDelta !== 0) {
    parts.push(`热平衡 ${formatSignedDelta(formatThermalUnbalancePct(thermalUnbalanceDelta), 1, "%")}`);
  }
  return {
    status,
    summary: parts.length ? `相对提交前回采：${parts.join("，")}` : null,
    systemCopDelta,
    totalPowerDeltaKw,
    activeAlarmDelta,
    thermalUnbalanceDelta
  };
}

function buildObservedTargetComparison(record, latestObservedSnapshot) {
  if (!record || record?.execution?.type !== "scheme" || !latestObservedSnapshot) {
    return null;
  }
  const targetCop = asPositiveNumber(record?.execution?.targetCop);
  const targetPowerKw = asFiniteNumber(record?.execution?.targetPowerKw);
  const observedCopGap =
    targetCop !== null && latestObservedSnapshot.systemCop !== null
      ? roundNullable(latestObservedSnapshot.systemCop - targetCop, 2)
      : null;
  const observedPowerGapKw =
    targetPowerKw !== null && latestObservedSnapshot.totalPowerKw !== null
      ? roundNullable(latestObservedSnapshot.totalPowerKw - targetPowerKw, 1)
      : null;
  if (observedCopGap === null && observedPowerGapKw === null) {
    return null;
  }
  const copMet = observedCopGap === null ? null : observedCopGap >= -0.05;
  const powerMet = observedPowerGapKw === null ? null : observedPowerGapKw <= 5;
  let status = "unknown";
  if ((copMet === true || copMet === null) && (powerMet === true || powerMet === null)) {
    status = "met";
  } else if (copMet === false && powerMet === false) {
    status = "missed";
  } else if (copMet !== null || powerMet !== null) {
    status = "partial";
  }
  const parts = [];
  const copText = formatSignedDelta(observedCopGap, 2, "");
  const powerText = formatSignedDelta(observedPowerGapKw, 1, " kW");
  if (copText) {
    parts.push(`COP ${copText}`);
  }
  if (powerText) {
    parts.push(`功率 ${powerText}`);
  }
  if (!parts.length) {
    return {
      status,
      summary: null,
      observedCopGap,
      observedPowerGapKw
    };
  }
  const prefix =
    status === "met"
      ? "相对提交目标已达标"
      : status === "partial"
        ? "相对提交目标部分达标"
        : "相对提交目标仍有偏差";
  return {
    status,
    summary: `${prefix}：${parts.join("，")}`,
    observedCopGap,
    observedPowerGapKw
  };
}

function buildExecutionAdaptiveGuardrail(recentExecutions) {
  const comparableExecutions = [];
  for (const record of Array.isArray(recentExecutions) ? recentExecutions : []) {
    const latestObservedSnapshot = normalizeObservedSnapshot(record?.execution?.feedbackSnapshots?.latest);
    const observedBaselineComparison = buildObservedBaselineComparison(
      normalizeDraftBaselineSnapshot(record),
      latestObservedSnapshot
    );
    const observedTargetComparison = buildObservedTargetComparison(record, latestObservedSnapshot);
    if (!observedBaselineComparison && !observedTargetComparison) {
      continue;
    }
    comparableExecutions.push({
      record,
      observedBaselineComparison,
      observedTargetComparison
    });
  }

  const reasons = [];
  const latestComparableExecution = comparableExecutions[0] || null;
  const latestObservedBaselineStatus = latestComparableExecution?.observedBaselineComparison?.status || null;
  if (latestObservedBaselineStatus === "degraded") {
    reasons.push(
      `最近一次${formatExecutionIdentity(latestComparableExecution.record)}回采相对提交前退化，当前草案自动降级为谨慎评审，优先考虑回退或停发相近目标。`
    );
  }

  const comparableSchemeExecutions = comparableExecutions.filter((item) => item.observedTargetComparison);
  let consecutiveMissedTargets = 0;
  for (const item of comparableSchemeExecutions) {
    if (item.observedTargetComparison.status !== "missed") {
      break;
    }
    consecutiveMissedTargets += 1;
  }
  if (consecutiveMissedTargets >= 2) {
    reasons.push(
      `最近连续 ${consecutiveMissedTargets} 次方案执行回采未达到提交目标，当前草案自动降级为谨慎评审，避免继续放大相近目标。`
    );
  }

  return {
    level: reasons.length ? "caution" : "ready",
    reasons,
    latestObservedBaselineStatus,
    latestObservedTargetStatus: comparableSchemeExecutions[0]?.observedTargetComparison?.status || null,
    consecutiveMissedTargets
  };
}

function formatObservedSnapshotSummary(snapshot) {
  const observed = normalizeObservedSnapshot(snapshot);
  if (!observed) {
    return null;
  }
  const phaseLabel =
    observed.phase === "rolled_back"
      ? "回退后回采"
      : observed.phase === "approved"
        ? "审批后回采"
        : "执行回采";
  const parts = [];
  if (observed.systemCop !== null) {
    parts.push(`COP ${observed.systemCop.toFixed(2)}`);
  }
  if (observed.totalPowerKw !== null) {
    parts.push(`功率 ${observed.totalPowerKw.toFixed(1)} kW`);
  }
  if (observed.activeAlarmCount !== null) {
    parts.push(`告警 ${observed.activeAlarmCount.toFixed(0)}`);
  }
  if (observed.thermalUnbalanceRate !== null) {
    parts.push(`热平衡 ${formatThermalUnbalancePct(observed.thermalUnbalanceRate)}%`);
  }
  if (!parts.length) {
    return null;
  }
  return `${phaseLabel}：${parts.join("，")}`;
}

function formatDispatchModeLabel(mode) {
  if (mode === "shadow") {
    return "shadow";
  }
  if (mode === "enforced") {
    return "enforced";
  }
  if (mode === "off") {
    return "off";
  }
  return "unknown";
}

function buildExecutionOutcomeClass(record) {
  if (!record || typeof record !== "object") {
    return "none";
  }

  const status = normalizeOptionalText(record.status);
  const dispatch =
    record?.execution?.dispatch && typeof record.execution.dispatch === "object" ? record.execution.dispatch : {};
  const latestStatus = normalizeOptionalText(dispatch.latestStatus);
  const approveStatus = normalizeOptionalText(dispatch?.lastApprove?.status);

  if (status === "pending_approval") {
    return "pending_approval";
  }

  if (status === "approved") {
    if (latestStatus === "applied" && approveStatus === "succeeded") {
      return "approved_applied";
    }
    if (approveStatus === "failed" || approveStatus === "skipped" || latestStatus === "apply_pending") {
      return "approved_not_applied";
    }
    return "approved";
  }

  if (status === "rolled_back") {
    if (approveStatus === "succeeded") {
      return "rolled_back_after_apply";
    }
    if (approveStatus === "failed" || approveStatus === "skipped") {
      return "rolled_back_after_failed_apply";
    }
    return "rolled_back";
  }

  return "none";
}

function buildCurrentDraftComparison(primaryScheme, latestApprovedSchemeExecution) {
  if (!primaryScheme || latestApprovedSchemeExecution?.execution?.type !== "scheme") {
    return null;
  }

  const approvedSchemeKey = normalizeOptionalText(latestApprovedSchemeExecution.execution.schemeKey);
  const currentSchemeKey = normalizeOptionalText(primaryScheme.key);
  const currentSchemeLabel = formatSchemeLabel(
    primaryScheme.title || primaryScheme.label || currentSchemeKey,
    "当前主方案"
  );
  const approvedSchemeLabel = formatSchemeLabel(
    latestApprovedSchemeExecution.execution.title || approvedSchemeKey,
    "最近已批准方案"
  );
  const targetPowerDeltaKw =
    typeof primaryScheme.targetPowerKw === "number" && typeof latestApprovedSchemeExecution.execution.targetPowerKw === "number"
      ? roundNullable(primaryScheme.targetPowerKw - latestApprovedSchemeExecution.execution.targetPowerKw, 1)
      : null;
  const targetCopDelta =
    typeof primaryScheme.targetCop === "number" && typeof latestApprovedSchemeExecution.execution.targetCop === "number"
      ? roundNullable(primaryScheme.targetCop - latestApprovedSchemeExecution.execution.targetCop, 2)
      : null;
  const sameScheme = approvedSchemeKey && currentSchemeKey && approvedSchemeKey === currentSchemeKey;
  const hasMeaningfulShift =
    (typeof targetPowerDeltaKw === "number" && Math.abs(targetPowerDeltaKw) >= 5)
    || (typeof targetCopDelta === "number" && Math.abs(targetCopDelta) >= 0.1);

  if (sameScheme && !hasMeaningfulShift) {
    return {
      status: "same-target",
      summary: `当前主方案与最近一次已批准的${approvedSchemeLabel}基本一致，可沿用既有审批边界复核。`,
      targetPowerDeltaKw,
      targetCopDelta
    };
  }

  if (sameScheme) {
    const deltaParts = [];
    const powerText = formatSignedDelta(targetPowerDeltaKw, 1, " kW");
    const copText = formatSignedDelta(targetCopDelta, 2, "");
    if (powerText) {
      deltaParts.push(`功率 ${powerText}`);
    }
    if (copText) {
      deltaParts.push(`COP ${copText}`);
    }
    return {
      status: "changed-target",
      summary: `当前主方案仍是${currentSchemeLabel}，但相对最近一次已批准目标已调整${deltaParts.length ? `（${deltaParts.join("，")}）` : ""}，应重新复核审批边界。`,
      targetPowerDeltaKw,
      targetCopDelta
    };
  }

  return {
    status: "changed-scheme",
    summary: `当前主方案已从${approvedSchemeLabel}切换为${currentSchemeLabel}，说明现态或约束已变化，应重新审阅后再提交。`,
    targetPowerDeltaKw,
    targetCopDelta
  };
}

export function buildExecutionFeedback(schemes, context = {}) {
  const recentExecutions = Array.isArray(context.recentExecutions) ? context.recentExecutions : [];
  const executionOverview =
    context.executionOverview && typeof context.executionOverview === "object" ? context.executionOverview : {};
  const adaptiveGuardrail = buildExecutionAdaptiveGuardrail(recentExecutions);
  const pendingApprovalCount = parseNonNegativeInteger(
    executionOverview.pendingApprovalCount,
    recentExecutions.filter((item) => normalizeOptionalText(item?.status) === "pending_approval").length
  );
  const approvedCount = parseNonNegativeInteger(
    executionOverview.approvedCount,
    recentExecutions.filter((item) => normalizeOptionalText(item?.status) === "approved").length
  );
  const rolledBackCount = parseNonNegativeInteger(
    executionOverview.rolledBackCount,
    recentExecutions.filter((item) => normalizeOptionalText(item?.status) === "rolled_back").length
  );
  const latestExecution = recentExecutions[0] || null;
  const latestPendingExecution = findLatestExecutionByStatus(recentExecutions, "pending_approval");
  const latestApprovedExecution = findLatestExecutionByStatus(recentExecutions, "approved");
  const latestApprovedSchemeExecution = findLatestExecutionByStatus(recentExecutions, "approved", "scheme");
  const latestRolledBackExecution = findLatestExecutionByStatus(recentExecutions, "rolled_back");
  const primaryScheme = pickPrimaryScheme(schemes);
  const currentDraftComparison = buildCurrentDraftComparison(primaryScheme, latestApprovedSchemeExecution);
  const submittedBaselineSnapshot = normalizeDraftBaselineSnapshot(latestExecution);
  const latestObservedSnapshot = normalizeObservedSnapshot(latestExecution?.execution?.feedbackSnapshots?.latest);
  const latestObservedSnapshotSummary = formatObservedSnapshotSummary(latestExecution?.execution?.feedbackSnapshots?.latest);
  const observedBaselineComparison = buildObservedBaselineComparison(submittedBaselineSnapshot, latestObservedSnapshot);
  const observedTargetComparison = buildObservedTargetComparison(latestExecution, latestObservedSnapshot);
  const outcomeClass = buildExecutionOutcomeClass(latestExecution);
  const approveDispatchStatus = normalizeOptionalText(latestExecution?.execution?.dispatch?.lastApprove?.status) || null;
  const approveDispatchCode = normalizeOptionalText(latestExecution?.execution?.dispatch?.lastApprove?.code) || null;
  const approveDispatchMode = normalizeOptionalText(latestExecution?.execution?.dispatch?.lastApprove?.mode) || null;
  const rollbackDispatchStatus = normalizeOptionalText(latestExecution?.execution?.dispatch?.lastRollback?.status) || null;
  const rollbackDispatchCode = normalizeOptionalText(latestExecution?.execution?.dispatch?.lastRollback?.code) || null;
  const latestDispatchStatus = normalizeOptionalText(latestExecution?.execution?.dispatch?.latestStatus) || null;
  const signals = [];

  if (pendingApprovalCount > 0) {
    const pendingLabel = latestPendingExecution
      ? formatExecutionIdentity(latestPendingExecution)
      : "待审批执行对象";
    signals.push(`近期已有 ${pendingApprovalCount} 条待审批执行，先处理${pendingLabel}，避免重复提交相近草案。`);
  }

  if (outcomeClass === "rolled_back_after_apply") {
    signals.push(
      `最近一次${formatExecutionIdentity(latestExecution)}已执行后回退，原因：${latestExecution?.rollback?.reason || "未记录"}。`
    );
  } else if (outcomeClass === "rolled_back_after_failed_apply") {
    signals.push(
      `最近一次${formatExecutionIdentity(latestExecution)}在下发未成功时结束并回退，优先处理控制链路问题（${approveDispatchCode || "dispatch failed"}）。`
    );
  } else if (outcomeClass === "rolled_back" && latestRolledBackExecution?.rollback?.reason) {
    signals.push(
      `最近一次${formatExecutionIdentity(latestRolledBackExecution)}已回退，原因：${latestRolledBackExecution.rollback.reason}。`
    );
  }

  if (
    outcomeClass !== "rolled_back_after_apply"
    && outcomeClass !== "rolled_back_after_failed_apply"
    && outcomeClass !== "rolled_back"
    && latestRolledBackExecution?.rollback?.reason
  ) {
    signals.push(
      `上一条${formatExecutionIdentity(latestRolledBackExecution)}已回退，原因：${latestRolledBackExecution.rollback.reason}。`
    );
  }

  if (outcomeClass === "approved_applied") {
    signals.push(
      `最近一次${formatExecutionIdentity(latestExecution)}已进入 ${formatDispatchModeLabel(approveDispatchMode)} 下发链路，先复核实际效果，再决定是否重复提交。`
    );
  } else if (outcomeClass === "approved_not_applied") {
    signals.push(
      `最近一次${formatExecutionIdentity(latestExecution)}虽已批准，但未真正下发（${approveDispatchCode || approveDispatchStatus || "dispatch pending"}），应先修复执行链路。`
    );
  }

  if (adaptiveGuardrail.level === "caution") {
    signals.push(...adaptiveGuardrail.reasons);
  }

  if (currentDraftComparison?.summary) {
    signals.push(currentDraftComparison.summary);
  } else if (approvedCount > 0 && latestApprovedExecution) {
    signals.push(`最近已有 ${approvedCount} 条批准记录；再次提交前先核对${formatExecutionIdentity(latestApprovedExecution)}的执行边界。`);
  }

  if (latestObservedSnapshotSummary) {
    signals.push(latestObservedSnapshotSummary);
  }

  if (observedBaselineComparison?.summary) {
    signals.push(observedBaselineComparison.summary);
  }

  if (observedTargetComparison?.summary) {
    signals.push(observedTargetComparison.summary);
  }

  if (!signals.length && rolledBackCount > 0) {
    signals.push(`近期已有 ${rolledBackCount} 条回退记录；再次提交前先确认回退原因是否已消除。`);
  }

  const summary =
    signals[0]
    || (latestExecution
      ? `最近一次治理动作是${formatExecutionIdentity(latestExecution)}，当前草案应结合该记录继续审阅。`
      : "当前还没有执行反馈记录，本次建议只能基于现态与历史对标进行评审。");

  return {
    status:
      pendingApprovalCount > 0
        ? "pending"
        : latestRolledBackExecution
          ? "rollback-watch"
          : approvedCount > 0
            ? "approved-history"
            : "idle",
    outcomeClass,
    summary,
    signals: dedupeSteps(signals).slice(0, 3),
    pendingApprovalCount,
    approvedCount,
    rolledBackCount,
    latestExecutionId: normalizeOptionalText(executionOverview.latestExecutionId) || latestExecution?.executionId || null,
    latestExecutionStatus:
      normalizeOptionalText(executionOverview.latestExecutionStatus) || latestExecution?.status || null,
    latestExecutionAt:
      normalizeOptionalText(executionOverview.latestExecutionAt)
      || latestExecution?.updatedAt
      || latestExecution?.createdAt
      || null,
    latestExecutionType: normalizeOptionalText(latestExecution?.execution?.type) || null,
    latestDispatchStatus,
    approveDispatchStatus,
    approveDispatchCode,
    approveDispatchMode,
    rollbackDispatchStatus,
    rollbackDispatchCode,
    latestObservedSnapshot,
    observedBaselineComparison,
    observedTargetComparison,
    currentDraftComparison
  };
}

function buildDraftSteps(request, overview, anomalies, recommendations, baseline, freshness, config) {
  const steps = [];
  const counts = anomalies?.counts || {};
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards : [];
  const totalPowerKw = asFiniteNumber(overview?.energyCards?.totalPowerKw);
  const currentCop = asPositiveNumber(overview?.energyCards?.currentCop);
  const scenarioEstimate = buildScenarioEstimate(request, overview);
  const thermalUnbalanceRate = asFiniteNumber(baseline?.thermalUnbalanceRate);

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

  if (isDraftFreshnessStale(config, freshness)) {
    steps.push("Current live snapshot is stale; validate the latest station state before using this draft for approval");
  }

  if (isHighThermalUnbalance(thermalUnbalanceRate)) {
    steps.push(
      `Thermal unbalance remains high (${formatThermalUnbalancePct(thermalUnbalanceRate)}%); restore loop balance before pursuing efficiency-first moves`
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

function buildDraftDiagnostics(overview, anomalies, recommendations, historyBenchmark, executionFeedback) {
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
  diagnostics.push(
    `executionFeedback.status=${executionFeedback?.status || "idle"}, pending=${executionFeedback?.pendingApprovalCount ?? 0}, approved=${executionFeedback?.approvedCount ?? 0}, rolledBack=${executionFeedback?.rolledBackCount ?? 0}`
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
  availabilityReasonCode = "history_samples_unavailable",
  source = null
}) {
  return {
    mode: "load-band",
    status: "unavailable",
    availabilityReasonCode,
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
  const reasonCode =
    benchmark?.availabilityReasonCode ||
    (status === "ready" ? "history_match_ready" : status === "partial" ? "history_match_partial" : "history_samples_unavailable");
  return {
    key: "historyBenchmark",
    endpoint: `/bff/v1/sites/${siteId}/${endpointPath}`,
    ok: status !== "unavailable",
    fallback: status === "partial",
    reasonCode,
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

function clampNumber(value, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (typeof min === "number" && Number.isFinite(min) && value < min) {
    return min;
  }
  if (typeof max === "number" && Number.isFinite(max) && value > max) {
    return max;
  }
  return value;
}

function buildApproachTargetBand(loadRatePct) {
  const normalized = asFiniteNumber(loadRatePct);
  if (normalized === null) {
    return {
      low: 2.3,
      high: 4.3,
      label: "默认负荷区间"
    };
  }
  if (normalized >= 80) {
    return {
      low: 2.8,
      high: 4.8,
      label: "高负荷区间"
    };
  }
  if (normalized >= 55) {
    return {
      low: 2.3,
      high: 4.3,
      label: "中负荷区间"
    };
  }
  return {
    low: 1.8,
    high: 3.8,
    label: "低负荷区间"
  };
}

function resolveMinCondenserInletTempGuardrail(config, request) {
  const towerApproachConfig =
    config?.towerApproach && typeof config.towerApproach === "object" ? config.towerApproach : {};
  const equipmentContext =
    request?.equipmentContext && typeof request.equipmentContext === "object" ? request.equipmentContext : {};
  const configuredDefaultValue = asPositiveNumber(towerApproachConfig.minCondenserInletTempC);
  const configuredByChiller = normalizeOptionalNumberMap(towerApproachConfig.minCondenserInletTempCByChiller);
  const configuredByModel = normalizeOptionalNumberMap(towerApproachConfig.minCondenserInletTempCByModel);
  const activeChillerIds = normalizeOptionalTextList([
    ...normalizeOptionalTextList(equipmentContext.activeChillerIds),
    ...normalizeOptionalTextList(towerApproachConfig.activeChillerIds)
  ]);
  const activeChillerModels = normalizeOptionalTextList([
    ...normalizeOptionalTextList(equipmentContext.activeChillerModels),
    ...normalizeOptionalTextList(towerApproachConfig.activeChillerModels)
  ]);
  const matchedChillerValues = activeChillerIds
    .map((item) => ({ key: item, value: asPositiveNumber(configuredByChiller[item]) }))
    .filter((item) => item.value !== null);
  const matchedModelValues = activeChillerModels
    .map((item) => ({ key: item, value: asPositiveNumber(configuredByModel[item]) }))
    .filter((item) => item.value !== null);

  if (matchedChillerValues.length > 0) {
    const effectiveValue = Math.max(...matchedChillerValues.map((item) => item.value));
    return {
      value: effectiveValue,
      resolvedBy: "by-chiller",
      matchedKeys: matchedChillerValues.map((item) => item.key),
      message: "目标冷却水温必须高于活跃机组实例中的最高最低温约束。"
    };
  }

  if (matchedModelValues.length > 0) {
    const effectiveValue = Math.max(...matchedModelValues.map((item) => item.value));
    return {
      value: effectiveValue,
      resolvedBy: "by-model",
      matchedKeys: matchedModelValues.map((item) => item.key),
      message: "目标冷却水温必须高于活跃机组型号中的最高最低温约束。"
    };
  }

  if (configuredDefaultValue !== null) {
    return {
      value: configuredDefaultValue,
      resolvedBy: "default",
      matchedKeys: [],
      message: "目标冷却水温必须高于该下限。"
    };
  }

  return {
    value: null,
    resolvedBy: "missing",
    matchedKeys: [],
    message: "缺少机组最低冷凝器进水温配置，当前只允许做建议评审。"
  };
}

function resolveTowerApproachExecutionPolicy(config) {
  const dispatchConfig = resolveTowerApproachDispatchConfig(config);
  const dispatchMode = dispatchConfig.mode || "off";
  const executionMode = dispatchMode === "off" ? "read_only" : dispatchMode;
  const controlTargets =
    config?.towerApproach?.controlTargets && typeof config.towerApproach.controlTargets === "object"
      ? config.towerApproach.controlTargets
      : {};
  const approveTarget =
    controlTargets.approve && typeof controlTargets.approve === "object" ? controlTargets.approve : {};
  const rollbackTarget =
    controlTargets.rollback && typeof controlTargets.rollback === "object" ? controlTargets.rollback : {};
  const approveMappingFields = [
    approveTarget.drTypeId,
    approveTarget.drId,
    approveTarget.tagName,
    approveTarget.msg,
    approveTarget.deviceName,
    approveTarget.commandTemplate
  ].map(normalizeOptionalText);
  const rollbackMappingFields = [
    rollbackTarget.drTypeId,
    rollbackTarget.drId,
    rollbackTarget.tagName,
    rollbackTarget.msg,
    rollbackTarget.deviceName,
    rollbackTarget.commandTemplate
  ].map(normalizeOptionalText);
  const hasControlTargetMapping = Boolean(
    normalizeOptionalText(approveTarget.endpoint)
      || normalizeOptionalText(dispatchConfig.approveEndpoint)
      || approveMappingFields.some(Boolean)
  );
  const hasRollbackMapping = Boolean(
    normalizeOptionalText(rollbackTarget.endpoint)
      || normalizeOptionalText(dispatchConfig.rollbackEndpoint)
      || rollbackMappingFields.some(Boolean)
  );
  return {
    executionMode,
    dispatchMode,
    approveEndpoint: dispatchConfig.approveEndpoint,
    rollbackEndpoint: dispatchConfig.rollbackEndpoint,
    timeoutMs: dispatchConfig.timeoutMs,
    hasControlTargetMapping,
    hasRollbackMapping
  };
}

function buildSignalState({ key, label, value, unit = null, required = true, ok = true, reason = "" }) {
  return {
    key,
    label,
    value,
    unit,
    required,
    ok: Boolean(ok),
    reason: ok ? null : reason
  };
}

function buildTowerApproachObjective() {
  return {
    key: "minimize_total_power",
    formula: "min P_total = P_chiller + P_tower_fan + P_cooling_pump",
    description: "在冷机最低冷凝器进水温、塔风机/冷却泵安全边界和温度变化速率约束内，寻找冷却塔接近度目标。"
  };
}

function buildTowerApproachConstraints(minCondenserGuardrail, targetBandC) {
  return {
    minCondenserInletTempC: minCondenserGuardrail.value,
    targetApproachBandC: targetBandC,
    maxStepC: TOWER_APPROACH_MAX_STEP_C,
    deadbandC: TOWER_APPROACH_DEADBAND_C,
    antiChatter: "PLC侧执行死区、单步限幅、最小保持时间和告警闭锁；AI只给目标值。",
    rollback: "保留提交前冷却水出水温/接近度作为回退目标。"
  };
}

function buildTowerApproachMultiStepPlan({
  currentTcwsC,
  finalTargetTcwsC,
  requestedWetBulbC,
  maxStepC = TOWER_APPROACH_MAX_STEP_C,
  reason = "min_condenser_guardrail"
}) {
  const current = asFiniteNumber(currentTcwsC);
  const finalTarget = asFiniteNumber(finalTargetTcwsC);
  const wetBulb = asFiniteNumber(requestedWetBulbC);
  const stepSize = asFiniteNumber(maxStepC);
  if (current === null || finalTarget === null || wetBulb === null || stepSize === null || stepSize <= 0) {
    return null;
  }

  const delta = roundNullable(finalTarget - current, 3);
  if (delta === null || Math.abs(delta) <= stepSize) {
    return null;
  }

  const direction = delta > 0 ? 1 : -1;
  const stepCount = Math.ceil(Math.abs(delta) / stepSize);
  const steps = [];
  for (let index = 1; index <= stepCount; index += 1) {
    const targetTcwsC =
      index === stepCount ? roundNullable(finalTarget, 1) : roundNullable(current + direction * stepSize * index, 1);
    steps.push({
      index,
      targetTcwsC,
      targetApproachC: targetTcwsC !== null ? roundNullable(targetTcwsC - wetBulb, 1) : null
    });
  }

  const firstStep = steps[0] || null;
  return {
    required: true,
    reason,
    finalTargetTcwsC: roundNullable(finalTarget, 1),
    finalTargetApproachC: roundNullable(finalTarget - wetBulb, 1),
    nextStepTargetTcwsC: firstStep?.targetTcwsC ?? null,
    nextStepTargetApproachC: firstStep?.targetApproachC ?? null,
    stepCount,
    maxStepC: stepSize,
    steps
  };
}

function resolveTowerApproachMeasurement(currentTcwsC, wetBulbC) {
  const tcws = asFiniteNumber(currentTcwsC);
  const wetBulb = asFiniteNumber(wetBulbC);
  if (tcws === null || wetBulb === null) {
    return {
      value: null,
      rawValue: null,
      plausible: false,
      reason: "缺湿球温度或冷却水出水温，无法计算当前接近度。"
    };
  }

  const rawValue = roundNullable(tcws - wetBulb, 1);
  if (rawValue === null) {
    return {
      value: null,
      rawValue: null,
      plausible: false,
      reason: "湿球温度或冷却水出水温无效，无法计算当前接近度。"
    };
  }
  if (rawValue < 0) {
    return {
      value: null,
      rawValue,
      plausible: false,
      reason: "当前接近度计算结果为负值，冷却水出水温低于湿球，疑似湿球温度或冷却水温点位异常。"
    };
  }
  if (rawValue > TOWER_APPROACH_MAX_PLAUSIBLE_C) {
    return {
      value: null,
      rawValue,
      plausible: false,
      reason: "当前接近度超过 20℃，疑似冷却塔温度点位、湿球点位或单位异常。"
    };
  }

  return {
    value: rawValue,
    rawValue,
    plausible: true,
    reason: null
  };
}

function buildTowerApproachAdvisor(config, request, baseline, historyBenchmark, benefitEstimate, gate) {
  const requestedWetBulbC =
    normalizeWetBulbC(baseline?.outdoorWetBulbC) ?? normalizeWetBulbC(request?.outdoorTempC);
  const coolingReturnTemp = asFiniteNumber(baseline?.coolingReturnTemp);
  const currentTcwsC = coolingReturnTemp !== null ? roundNullable(coolingReturnTemp, 1) : null;
  const approachMeasurement = resolveTowerApproachMeasurement(currentTcwsC, requestedWetBulbC);
  const currentApproachC = approachMeasurement.value;
  const currentApproachPlausible = approachMeasurement.plausible;
  const currentApproachReason = approachMeasurement.reason;
  const currentTcwsPlausible =
    currentTcwsC !== null && (approachMeasurement.rawValue === null || currentApproachPlausible);
  const currentTcwsReason =
    currentTcwsC === null
      ? "缺冷却回水温/冷机冷凝器进水温，无法确认当前冷却水出水温。"
      : approachMeasurement.rawValue !== null && !currentApproachPlausible
        ? `冷却水出水温与湿球温度不符合冷却塔物理约束：${currentApproachReason}`
        : "当前冷却水出水温信号可用。";
  const targetBandC = buildApproachTargetBand(historyBenchmark?.requestedLoadRatePct);
  const minCondenserGuardrail = resolveMinCondenserInletTempGuardrail(config, request);
  const configuredMinCondenserInletTempC = minCondenserGuardrail.value;
  const executionPolicy = resolveTowerApproachExecutionPolicy(config);
  const activeChillerIds = normalizeOptionalTextList(request?.equipmentContext?.activeChillerIds);
  const activeChillerModels = normalizeOptionalTextList(request?.equipmentContext?.activeChillerModels);
  const chillerRunningStateOk =
    activeChillerIds.length > 0 || activeChillerModels.length > 0 || asFiniteNumber(baseline?.chillerPowerKw) > 0;
  const towerFanFeedbackOk = asFiniteNumber(baseline?.coolingTowerPowerKw) !== null;
  const totalPowerOk = asFiniteNumber(baseline?.totalPowerKw) !== null;
  let chillerRunningValue = baseline?.chillerPowerKw ?? null;
  if (chillerRunningValue === null && activeChillerIds.length > 0) {
    chillerRunningValue = activeChillerIds.join(",");
  }
  if (chillerRunningValue === null && activeChillerModels.length > 0) {
    chillerRunningValue = activeChillerModels.join(",");
  }

  let targetApproachC = null;
  let rawTargetApproachC = null;
  if (currentApproachPlausible) {
    const opportunityLevel = String(benefitEstimate?.opportunityLevel || "low");
    const adjustment =
      opportunityLevel === "high"
        ? -0.5
        : opportunityLevel === "medium"
          ? -0.2
          : 0;
    rawTargetApproachC = roundNullable(
      clampNumber(currentApproachC + adjustment, targetBandC.low, targetBandC.high),
      1
    );
    targetApproachC = roundNullable(
      clampNumber(
        rawTargetApproachC,
        currentApproachC - TOWER_APPROACH_MAX_STEP_C,
        currentApproachC + TOWER_APPROACH_MAX_STEP_C
      ),
      1
    );
  }

  let targetTcwsC =
    targetApproachC !== null && requestedWetBulbC !== null
      ? roundNullable(requestedWetBulbC + targetApproachC, 1)
      : null;
  let finalTargetApproachC = targetApproachC;
  let finalTargetTcwsC = targetTcwsC;
  let minTempAdjusted = false;
  let minTempStepBlocked = false;
  let multiStepPlan = null;

  if (
    configuredMinCondenserInletTempC !== null &&
    targetTcwsC !== null &&
    requestedWetBulbC !== null &&
    targetTcwsC < configuredMinCondenserInletTempC
  ) {
    minTempAdjusted = true;
    finalTargetTcwsC = roundNullable(configuredMinCondenserInletTempC, 1);
    finalTargetApproachC = roundNullable(configuredMinCondenserInletTempC - requestedWetBulbC, 1);
    multiStepPlan = buildTowerApproachMultiStepPlan({
      currentTcwsC,
      finalTargetTcwsC,
      requestedWetBulbC,
      maxStepC: TOWER_APPROACH_MAX_STEP_C,
      reason: "min_condenser_guardrail"
    });
    if (multiStepPlan?.required) {
      targetTcwsC = multiStepPlan.nextStepTargetTcwsC;
      targetApproachC = multiStepPlan.nextStepTargetApproachC;
      if (targetTcwsC === null || targetApproachC === null) {
        minTempStepBlocked = true;
      }
    } else {
      targetTcwsC = finalTargetTcwsC;
      targetApproachC = finalTargetApproachC;
    }
  }

  const inputSignals = [
    buildSignalState({
      key: "outdoorWetBulbC",
      label: "室外湿球温度",
      value: requestedWetBulbC,
      unit: "℃",
      ok: requestedWetBulbC !== null,
      reason: "缺湿球温度，无法计算接近度设定值 = 冷却水出水温设定值 - 湿球温度。"
    }),
    buildSignalState({
      key: "currentTcwsC",
      label: "冷却水出水温",
      value: currentTcwsC,
      unit: "℃",
      ok: currentTcwsPlausible,
      reason: currentTcwsReason
    }),
    buildSignalState({
      key: "currentApproachC",
      label: "当前接近度",
      value: currentApproachC,
      unit: "℃",
      ok: currentApproachPlausible,
      reason: currentApproachReason || "当前接近度信号可用。"
    }),
    buildSignalState({
      key: "towerFanFeedback",
      label: "冷却塔风机反馈",
      value: baseline?.coolingTowerPowerKw ?? null,
      unit: "kW",
      ok: towerFanFeedbackOk,
      reason: "缺冷却塔风机功率/反馈，AI只能保留只读建议。"
    }),
    buildSignalState({
      key: "chillerRunningState",
      label: "冷机运行状态",
      value: chillerRunningValue,
      unit: typeof baseline?.chillerPowerKw === "number" ? "kW" : null,
      ok: chillerRunningStateOk,
      reason: "缺冷机运行状态或活跃机组上下文，不能进入闭环目标下发。"
    }),
    buildSignalState({
      key: "totalPowerKw",
      label: "系统总功率",
      value: baseline?.totalPowerKw ?? null,
      unit: "kW",
      ok: totalPowerOk,
      reason: "缺系统总功率，节能验证只能降级。"
    }),
    buildSignalState({
      key: "minCondenserInletTempC",
      label: "冷机最低冷凝器进水温",
      value: configuredMinCondenserInletTempC,
      unit: "℃",
      ok: configuredMinCondenserInletTempC !== null,
      reason: "缺厂家最低冷凝器进水温边界，不能进入可下发执行。"
    })
  ];

  const requiredSignalBlockers = inputSignals
    .filter((item) => item.required && !item.ok)
    .map((item) => item.reason || `缺${item.label}`);
  const criticalSignalBlockers = inputSignals
    .filter((item) => ["outdoorWetBulbC", "currentTcwsC", "currentApproachC"].includes(item.key) && !item.ok)
    .map((item) => item.reason || `缺${item.label}`);

  const guardrails = [
    {
      key: "alarmGate",
      status: gate?.level === "blocked" ? "blocked" : "ready",
      value: gate?.level || "blocked",
      message:
        gate?.level === "blocked"
          ? "当前存在阻断门禁，不可进入接近度执行。"
          : "门禁允许继续评审接近度调节建议。"
    },
    {
      key: "chillerMinCondenserInletTempC",
      status: configuredMinCondenserInletTempC === null ? "missing" : "ready",
      value: configuredMinCondenserInletTempC,
      message: minCondenserGuardrail.message,
      resolvedBy: minCondenserGuardrail.resolvedBy,
      matchedKeys: minCondenserGuardrail.matchedKeys
    },
    {
      key: "towerControlStep",
      status: minTempStepBlocked ? "blocked" : "ready",
      value: "≤0.5℃/step",
      message: minTempStepBlocked
        ? "当前目标触及最低冷凝器进水温，但单步变化超过 0.5℃，需人工拆分多步执行。"
        : multiStepPlan?.required
          ? `最终目标触及最低冷凝器进水温，已拆分为 ${multiStepPlan.stepCount} 步 shadow；本次目标变化不超过 0.5℃。`
        : "建议按小步长调整，避免塔风机频繁反向。"
    },
    {
      key: "plcControlPointMapping",
      status: executionPolicy.hasControlTargetMapping ? "ready" : "missing",
      value: executionPolicy.hasControlTargetMapping ? "mapped" : null,
      message: executionPolicy.hasControlTargetMapping
        ? "已具备接近度目标控制点/下发端点映射，可进入对应模式校验。"
        : "缺接近度/冷却水出水温到 PLC/SCADA 控制点位映射，禁止真实下发。"
    }
  ];

  let status = "unavailable";
  let reason = "冷却塔接近度关键信号不足，当前自动降级为只读建议。";

  if (criticalSignalBlockers.length === 0) {
    status = "partial";
    reason = "已具备接近度现态信号，但仍需补齐闭环执行边界。";
    if (requiredSignalBlockers.length === 0 && historyBenchmark?.status === "ready" && targetTcwsC !== null) {
      status = "ready";
      reason = "历史对标与关键保护边界可用，已生成接近度目标建议。";
    }
  }

  if (minTempAdjusted) {
    reason = "目标冷却水温已按机组最低冷凝器进水温自动抬高。";
  }

  if (multiStepPlan?.required) {
    reason = "目标冷却水温受最低冷凝器进水温保护约束，已生成多步 shadow 计划；本次只提交下一步目标。";
  }

  if (minTempStepBlocked) {
    status = "partial";
    reason = "目标冷却水温需抬高到机组最低温边界，但单步超过 0.5℃，必须人工拆分多步执行。";
  }

  if (gate?.level === "blocked") {
    status = "unavailable";
    reason = "当前门禁阻断，接近度调节自动降级为只读建议。";
  }

  const blockers = dedupeSteps([
    ...criticalSignalBlockers,
    ...requiredSignalBlockers.filter((item) => !criticalSignalBlockers.includes(item)),
    ...(gate?.level === "blocked" ? [gate.reason || "当前存在阻断门禁。"] : []),
    ...(minTempStepBlocked ? ["单步目标变化超过 0.5℃，需人工拆分多步执行。"] : [])
  ]);
  const warnings = dedupeSteps([
    ...(executionPolicy.hasControlTargetMapping ? [] : ["控制点未映射，禁止真实 PLC/SCADA 下发。"]),
    ...(executionPolicy.hasRollbackMapping ? [] : ["回退点位未映射，真实下发前必须补齐 rollbackTarget 映射。"]),
    ...(historyBenchmark?.confidence === "low" ? ["历史样本置信度低，节能评估需 shadow 对比验证。"] : []),
    ...(multiStepPlan?.required
      ? [
          `最终冷却水出水温目标 ${multiStepPlan.finalTargetTcwsC}℃ 需分 ${multiStepPlan.stepCount} 步 shadow 验证，本次仅提交 ${multiStepPlan.nextStepTargetTcwsC}℃。`
        ]
      : []),
    ...(gate?.level === "caution" ? [gate.reason || "当前门禁为谨慎评审。"] : [])
  ]);
  const allowedToCreateExecution =
    status === "ready" && blockers.length === 0 && targetApproachC !== null && targetTcwsC !== null;
  const allowedToDispatch =
    allowedToCreateExecution &&
    executionPolicy.executionMode !== "read_only" &&
    (executionPolicy.executionMode === "shadow" || executionPolicy.hasControlTargetMapping);
  const objective = buildTowerApproachObjective();
  const constraints = buildTowerApproachConstraints(minCondenserGuardrail, targetBandC);
  const outputTargets = {
    targetApproachC,
    targetTcwsC,
    finalTargetApproachC,
    finalTargetTcwsC,
    nextStepTargetApproachC: multiStepPlan?.nextStepTargetApproachC ?? targetApproachC,
    nextStepTargetTcwsC: multiStepPlan?.nextStepTargetTcwsC ?? targetTcwsC,
    rawTargetApproachC,
    currentApproachC,
    currentTcwsC,
    targetBandC,
    multiStepPlan,
    targetAdjustedByMinCondenserGuardrail: minTempAdjusted,
    stepLimited:
      (rawTargetApproachC !== null && targetApproachC !== null && rawTargetApproachC !== targetApproachC) ||
      multiStepPlan?.required === true,
    maxStepC: TOWER_APPROACH_MAX_STEP_C,
    deadbandC: TOWER_APPROACH_DEADBAND_C
  };

  return {
    status,
    currentApproachC,
    currentTcwsC,
    requestedWetBulbC,
    targetApproachC,
    targetTcwsC,
    targetBandC,
    executionReady: allowedToCreateExecution,
    dispatchReady: allowedToDispatch,
    executionMode: executionPolicy.executionMode,
    dispatchMode: executionPolicy.dispatchMode,
    controlMode:
      executionPolicy.executionMode === "enforced"
        ? "plc-guarded-enforced"
        : executionPolicy.executionMode === "assisted"
          ? "manual-assisted-dispatch"
          : executionPolicy.executionMode === "shadow"
            ? "shadow-verification"
            : "read-only-advice",
    reason,
    disclaimer: "AI 只输出接近度/冷却水出水温目标值；PLC/SCADA 必须执行限幅、防震荡、告警闭锁和回退。",
    guardrails,
    inputSignals,
    blockers,
    warnings,
    objective,
    constraints,
    outputTargets,
    advisorResult: {
      type: "tower_approach_ai_closed_loop",
      status,
      lifecycleMode: executionPolicy.executionMode,
      objective,
      constraints,
      inputSignals,
      outputTargets,
      execution: {
        approvalRequired: true,
        allowedToCreateExecution,
        allowedToDispatch,
        dispatchMode: executionPolicy.dispatchMode,
        approveEndpointConfigured: Boolean(executionPolicy.approveEndpoint),
        rollbackEndpointConfigured: Boolean(executionPolicy.rollbackEndpoint),
        controlPointMapped: executionPolicy.hasControlTargetMapping,
        rollbackMapped: executionPolicy.hasRollbackMapping
      },
      savingsVerification: {
        method: "shadow_compare_same_load_wet_bulb_band",
        metrics: ["systemCop", "kwPerRt", "totalPowerKw", "chillerPowerKw", "coolingTowerPowerKw", "alarmCount"],
        acceptance: "同负荷/相近湿球工况下 COP 或 kW/RT 改善，且冷机功率上升不得抵消塔风机节能。"
      },
      blockers,
      warnings
    }
  };
}

function normalizePumpDeltaTDispatchMode(config) {
  const featureFlags =
    config?.siteRuntimeAdminConfig?.featureFlags && typeof config.siteRuntimeAdminConfig.featureFlags === "object"
      ? config.siteRuntimeAdminConfig.featureFlags
      : {};
  const pumpDeltaT =
    config?.pumpDeltaT && typeof config.pumpDeltaT === "object"
      ? config.pumpDeltaT
      : {};
  const dispatch =
    pumpDeltaT.dispatch && typeof pumpDeltaT.dispatch === "object"
      ? pumpDeltaT.dispatch
      : {};
  const rawMode = normalizeOptionalText(
    featureFlags.pumpDeltaTDispatchMode
      || dispatch.mode
      || pumpDeltaT.dispatchMode
      || "shadow"
  ).toLowerCase();
  if (rawMode === "off" || rawMode === "read_only" || rawMode === "readonly") {
    return {
      dispatchMode: "off",
      executionMode: "read_only",
      rawMode,
      enforcedDowngraded: false
    };
  }
  if (rawMode === "assisted") {
    return {
      dispatchMode: "assisted",
      executionMode: "assisted",
      rawMode,
      enforcedDowngraded: false
    };
  }
  if (rawMode === "enforced") {
    return {
      dispatchMode: "assisted",
      executionMode: "assisted",
      rawMode,
      enforcedDowngraded: true
    };
  }
  return {
    dispatchMode: "shadow",
    executionMode: "shadow",
    rawMode: rawMode || "shadow",
    enforcedDowngraded: false
  };
}

function hasPumpDeltaTControlMapping(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }
  const directFields = [
    target.endpoint,
    target.drTypeId,
    target.drId,
    target.tagName,
    target.valueSource,
    target.chwpTagName,
    target.cwpTagName,
    target.chilledPumpTrimPoint,
    target.coolingPumpTrimPoint,
    target.commandTemplate
  ].map(normalizeOptionalText);
  if (directFields.some(Boolean)) {
    return true;
  }
  return Array.isArray(target.commands) && target.commands.some((command) => hasPumpDeltaTControlMapping(command));
}

function pickPumpDeltaTPointName(target, keys) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return "";
  }
  for (const key of keys) {
    const value = normalizeOptionalText(target[key]);
    if (value) {
      return value;
    }
  }
  if (Array.isArray(target.commands)) {
    for (const command of target.commands) {
      const value = pickPumpDeltaTPointName(command, keys);
      if (value) {
        return value;
      }
    }
  }
  return "";
}

function isAffirmativeSafetyValue(value) {
  if (value === true) {
    return true;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    return ["true", "ok", "ready", "mapped", "enabled", "protected", "clear", "available", "yes"].includes(
      value.trim().toLowerCase()
    );
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value.ok === true || isAffirmativeSafetyValue(value.status) || isAffirmativeSafetyValue(value.value);
  }
  return false;
}

function pickSafetyInputValue(safetyInputs, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(safetyInputs, key)) {
      return safetyInputs[key];
    }
  }
  return undefined;
}

function buildPumpDeltaTSafetyCheck(safetyInputs, key, label, aliases) {
  const value = pickSafetyInputValue(safetyInputs, aliases);
  return {
    key,
    label,
    configured: value !== undefined,
    ok: isAffirmativeSafetyValue(value),
    value: value === undefined ? null : value
  };
}

function buildPumpDeltaTSafetyProfile(config) {
  const pumpDeltaT =
    config?.pumpDeltaT && typeof config.pumpDeltaT === "object"
      ? config.pumpDeltaT
      : {};
  const safetyInputs =
    pumpDeltaT.safetyInputs && typeof pumpDeltaT.safetyInputs === "object" && !Array.isArray(pumpDeltaT.safetyInputs)
      ? pumpDeltaT.safetyInputs
      : {};
  const terminalChecks = [
    buildPumpDeltaTSafetyCheck(safetyInputs, "terminalDifferentialPressure", "末端压差保护", [
      "terminalDifferentialPressureReady",
      "terminalDifferentialPressureProtected",
      "terminalDpProtected",
      "terminalDpReady"
    ]),
    buildPumpDeltaTSafetyCheck(safetyInputs, "terminalValvePosition", "末端阀位保护", [
      "terminalValvePositionReady",
      "terminalValvePositionProtected",
      "terminalValveReady",
      "terminalValveOpenPctReady"
    ]),
    buildPumpDeltaTSafetyCheck(safetyInputs, "representativeRoomTemperature", "代表房间温度", [
      "representativeRoomTemperatureReady",
      "representativeRoomTempReady",
      "terminalRoomTempReady",
      "roomTemperatureReady"
    ]),
    buildPumpDeltaTSafetyCheck(safetyInputs, "noTerminalComplaint", "末端缺冷投诉清零", [
      "noTerminalColdComplaint",
      "noTerminalHotComplaint",
      "terminalComplaintClear",
      "comfortComplaintClear"
    ])
  ];
  const plcChecks = [
    buildPumpDeltaTSafetyCheck(safetyInputs, "plcPumpTrimProtected", "PLC 本地泵频修正保护", [
      "plcPumpTrimProtected",
      "plcLocalProtectionReady",
      "pumpTrimLocalProtectionReady"
    ]),
    buildPumpDeltaTSafetyCheck(safetyInputs, "minFlowProtected", "最小流量保护", [
      "minFlowProtected",
      "pumpMinFlowProtected",
      "minimumFlowProtected"
    ]),
    buildPumpDeltaTSafetyCheck(safetyInputs, "pumpFrequencyFeedback", "泵频反馈", [
      "pumpFrequencyFeedbackReady",
      "pumpFrequencyFeedbackMapped",
      "runningPumpFrequencyReady"
    ])
  ];
  const terminalSafetyReady = terminalChecks.some((item) => item.ok);
  const plcProtectionReady = plcChecks
    .filter((item) => item.key !== "pumpFrequencyFeedback")
    .every((item) => item.ok);
  const pumpFrequencyFeedbackReady = plcChecks.some((item) => item.key === "pumpFrequencyFeedback" && item.ok);
  const assistedReady = terminalSafetyReady && plcProtectionReady && pumpFrequencyFeedbackReady;
  return {
    status: assistedReady ? "ready" : Object.keys(safetyInputs).length ? "partial" : "missing",
    terminalSafetyReady,
    plcProtectionReady,
    pumpFrequencyFeedbackReady,
    assistedReady,
    terminalChecks,
    plcChecks
  };
}

function buildPumpDeltaTMappingProfile(controlTargets = {}, executionPolicy = {}) {
  const approveTarget =
    controlTargets.approve && typeof controlTargets.approve === "object" ? controlTargets.approve : {};
  const rollbackTarget =
    controlTargets.rollback && typeof controlTargets.rollback === "object" ? controlTargets.rollback : {};
  const chilledPumpPoint =
    pickPumpDeltaTPointName(approveTarget, ["chwpTagName", "chilledPumpTrimPoint", "tagName"]) || "AI_ChwpFreqTrim_Hz";
  const coolingPumpPoint =
    pickPumpDeltaTPointName(approveTarget, ["cwpTagName", "coolingPumpTrimPoint", "tagName"]) || "AI_CwpFreqTrim_Hz";
  return {
    status: executionPolicy.hasControlTargetMapping ? "mapped" : "missing",
    approveMapped: executionPolicy.hasControlTargetMapping,
    rollbackMapped: executionPolicy.hasRollbackMapping,
    targetPoints: {
      chilledPump: chilledPumpPoint,
      coolingPump: coolingPumpPoint,
      unit: "Hz"
    },
    approveCommandCount: Array.isArray(approveTarget.commands) ? approveTarget.commands.length : 0,
    rollbackCommandCount: Array.isArray(rollbackTarget.commands) ? rollbackTarget.commands.length : 0,
    approveStrategy: normalizeOptionalText(approveTarget.strategy) || null,
    rollbackStrategy: normalizeOptionalText(rollbackTarget.strategy) || null
  };
}

function resolvePumpDeltaTExecutionPolicy(config) {
  const pumpDeltaT =
    config?.pumpDeltaT && typeof config.pumpDeltaT === "object"
      ? config.pumpDeltaT
      : {};
  const controlTargets =
    pumpDeltaT.controlTargets && typeof pumpDeltaT.controlTargets === "object"
      ? pumpDeltaT.controlTargets
      : {};
  const approveTarget =
    controlTargets.approve && typeof controlTargets.approve === "object" ? controlTargets.approve : {};
  const rollbackTarget =
    controlTargets.rollback && typeof controlTargets.rollback === "object" ? controlTargets.rollback : {};
  const mode = normalizePumpDeltaTDispatchMode(config);
  const hasControlTargetMapping = hasPumpDeltaTControlMapping(approveTarget);
  const hasRollbackMapping = Boolean(
    hasPumpDeltaTControlMapping(rollbackTarget)
    || normalizeOptionalText(rollbackTarget.mode)
    || asFiniteNumber(rollbackTarget.targetChwpFreqTrimHz) !== null
    || asFiniteNumber(rollbackTarget.targetCwpFreqTrimHz) !== null
  );

  return {
    ...mode,
    hasControlTargetMapping,
    hasRollbackMapping,
    controlTargets
  };
}

function buildPumpDeltaTObjective() {
  return {
    key: "minimize_running_pump_power_without_cop_degradation",
    formula: "min (P_chilled_pump + P_cooling_pump), subject to COP_station >= baseline and chiller/comfort guardrails",
    description: "在舒适度、冷机冷凝侧、最小流量、温差和告警边界内，对运行中的冷冻泵/冷却泵频率给出小步长修正量。"
  };
}

function buildPumpDeltaTConstraints() {
  return {
    trimRangeHz: {
      min: PUMP_FREQ_TRIM_MIN_HZ,
      max: PUMP_FREQ_TRIM_MAX_HZ
    },
    maxStepHz: PUMP_FREQ_TRIM_STEP_HZ,
    ttlSeconds: PUMP_FREQ_TRIM_TTL_SECONDS,
    controlCycleMinutes: PUMP_FREQ_TRIM_HOLD_MINUTES,
    rollbackLockoutMinutes: PUMP_FREQ_TRIM_ROLLBACK_LOCKOUT_MINUTES,
    targetBandsC: {
      chilledDeltaT: CHILLED_DELTA_T_TARGET_BAND_C,
      coolingDeltaT: COOLING_DELTA_T_TARGET_BAND_C
    },
    lifecycle: "只允许 shadow/assisted；AI 不进入 enforced，无人值守闭环由 PLC 禁止。",
    plcResponsibility: "PLC 负责频率限幅、斜率、PID叠加、最小流量、告警闭锁、联锁和回退。"
  };
}

function buildPumpDeltaTAdvisor(config, request, baseline, gate, freshness) {
  const executionPolicy = resolvePumpDeltaTExecutionPolicy(config);
  const mappingProfile = buildPumpDeltaTMappingProfile(executionPolicy.controlTargets, executionPolicy);
  const safetyProfile = buildPumpDeltaTSafetyProfile(config);
  const freshnessStale = isDraftFreshnessStale(config, freshness);
  const chilledDeltaT = asFiniteNumber(baseline?.chilledDeltaT);
  const coolingDeltaT = asFiniteNumber(baseline?.coolingDeltaT);
  const chilledPumpPowerKw = asFiniteNumber(baseline?.chilledPumpPowerKw);
  const coolingPumpPowerKw = asFiniteNumber(baseline?.coolingPumpPowerKw);
  const chillerPowerKw = asFiniteNumber(baseline?.chillerPowerKw);
  const totalPowerKw = asFiniteNumber(baseline?.totalPowerKw);
  const systemCop = asPositiveNumber(baseline?.systemCop);
  const coolingReturnTemp = asFiniteNumber(baseline?.coolingReturnTemp);
  const chilledSupplyTemp = asFiniteNumber(baseline?.chilledSupplyTemp);
  const activeAlarmCount = asFiniteNumber(baseline?.activeAlarmCount);
  const currentWetBulbC = normalizeWetBulbC(baseline?.outdoorWetBulbC) ?? normalizeWetBulbC(request?.outdoorTempC);
  const currentApproachC = resolveTowerApproachMeasurement(coolingReturnTemp, currentWetBulbC).value;

  const inputSignals = [
    buildSignalState({
      key: "freshness",
      label: "实时快照新鲜度",
      value: freshness?.label || (typeof freshness?.ageHours === "number" ? freshness.ageHours : null),
      unit: typeof freshness?.ageHours === "number" ? "h" : null,
      ok: !freshnessStale,
      reason: "关键测点数据陈旧，泵频率修正量必须冻结为 0Hz。"
    }),
    buildSignalState({
      key: "alarmGate",
      label: "高等级告警门禁",
      value: gate?.level || null,
      ok: gate?.level !== "blocked",
      reason: gate?.reason || "当前存在高等级告警或阻断门禁，泵频率修正量必须冻结为 0Hz。"
    }),
    buildSignalState({
      key: "chilledDeltaT",
      label: "冷冻水供回水温差",
      value: chilledDeltaT,
      unit: "℃",
      ok: chilledDeltaT !== null && chilledDeltaT > 0,
      reason: "缺冷冻水温差，不能判断冷冻泵是否存在大流量小温差。"
    }),
    buildSignalState({
      key: "coolingDeltaT",
      label: "冷却水进出水温差",
      value: coolingDeltaT,
      unit: "℃",
      ok: coolingDeltaT !== null && coolingDeltaT > 0,
      reason: "缺冷却水温差，不能判断冷却泵是否存在无效大流量。"
    }),
    buildSignalState({
      key: "chilledPumpPowerKw",
      label: "冷冻泵功率",
      value: chilledPumpPowerKw,
      unit: "kW",
      ok: chilledPumpPowerKw !== null,
      reason: "缺冷冻泵功率，无法验证降频是否真实节能。"
    }),
    buildSignalState({
      key: "coolingPumpPowerKw",
      label: "冷却泵功率",
      value: coolingPumpPowerKw,
      unit: "kW",
      ok: coolingPumpPowerKw !== null,
      reason: "缺冷却泵功率，无法验证降频是否真实节能。"
    }),
    buildSignalState({
      key: "chillerPowerKw",
      label: "冷机功率",
      value: chillerPowerKw,
      unit: "kW",
      ok: chillerPowerKw !== null && chillerPowerKw > 0,
      reason: "缺冷机功率，不能判断冷却泵降频是否被冷机功率上升抵消。"
    }),
    buildSignalState({
      key: "totalPowerKw",
      label: "系统总功率",
      value: totalPowerKw,
      unit: "kW",
      ok: totalPowerKw !== null && totalPowerKw > 0,
      reason: "缺系统总功率，无法做 COP/总功率验证。"
    }),
    buildSignalState({
      key: "systemCop",
      label: "冷站 COP",
      value: systemCop,
      ok: systemCop !== null,
      reason: "缺冷站 COP，不能确认泵降频后系统综合效率不劣化。"
    }),
    buildSignalState({
      key: "activeAlarmCount",
      label: "告警数量",
      value: activeAlarmCount,
      ok: activeAlarmCount !== null,
      reason: "缺告警快照，不能确认告警闭锁条件。"
    }),
    buildSignalState({
      key: "terminalComfortProtection",
      label: "末端压差/阀位/室温保护",
      value: safetyProfile.status,
      required: false,
      ok: safetyProfile.terminalSafetyReady,
      reason: safetyProfile.terminalSafetyReady
        ? "末端安全前置条件已有至少一类保护信号。"
        : "当前 BFF 未接入末端阀位、关键压差或室温；shadow 可评审，assisted 前必须由 PLC 提供等效保护状态。"
    }),
    buildSignalState({
      key: "pumpFrequencyFeedback",
      label: "运行泵频率反馈",
      value: safetyProfile.pumpFrequencyFeedbackReady ? "ready" : null,
      unit: "Hz",
      required: false,
      ok: safetyProfile.pumpFrequencyFeedbackReady,
      reason: safetyProfile.pumpFrequencyFeedbackReady
        ? "已配置泵频反馈或等效确认信号。"
        : "当前 BFF 未接入泵实际频率；执行前必须由 PLC 完成频率上下限、斜率和最小流量保护。"
    }),
    buildSignalState({
      key: "plcPumpTrimProtection",
      label: "PLC 本地保护",
      value: safetyProfile.plcProtectionReady ? "ready" : null,
      required: false,
      ok: safetyProfile.plcProtectionReady,
      reason: safetyProfile.plcProtectionReady
        ? "已配置 PLC 本地泵频修正保护和最小流量保护确认。"
        : "assisted 前必须确认 PLC 本地限幅、斜率、最小流量和联锁保护。"
    })
  ];

  const requiredSignalBlockers = inputSignals
    .filter((item) => item.required && !item.ok)
    .map((item) => item.reason || `缺${item.label}`);
  const gateBlockers = [
    ...(gate?.level === "blocked" ? [gate.reason || "当前存在阻断门禁。"] : []),
    ...(freshnessStale ? ["实时快照已超过新鲜度阈值。"] : [])
  ];
  const blockers = dedupeSteps([...requiredSignalBlockers, ...gateBlockers]);
  const canEvaluate = blockers.length === 0;
  const chilledTrimHz =
    canEvaluate && chilledDeltaT !== null && chilledDeltaT > 0 && chilledDeltaT < CHILLED_DELTA_T_TARGET_BAND_C.low
      ? -PUMP_FREQ_TRIM_STEP_HZ
      : 0;
  const coolingTrimHz =
    canEvaluate && coolingDeltaT !== null && coolingDeltaT > 0 && coolingDeltaT < COOLING_DELTA_T_TARGET_BAND_C.low
      ? -PUMP_FREQ_TRIM_STEP_HZ
      : 0;
  const hasNonZeroTrim = chilledTrimHz !== 0 || coolingTrimHz !== 0;
  const status = blockers.length > 0 ? "unavailable" : "ready";
  const warnings = dedupeSteps([
    ...(gate?.level === "caution" ? [gate.reason || "当前门禁为谨慎评审。"] : []),
    ...(executionPolicy.enforcedDowngraded ? ["pump-delta-t 不允许 enforced，已降级为 assisted。"] : []),
    ...(executionPolicy.hasControlTargetMapping ? [] : ["AI_ChwpFreqTrim_Hz/AI_CwpFreqTrim_Hz 控制点未映射，assisted 前禁止真实下发。"]),
    ...(executionPolicy.hasRollbackMapping ? [] : ["回退点位未映射，真实下发前必须确认可恢复到 0Hz 或最近稳定值。"]),
    ...(executionPolicy.executionMode === "assisted" && !safetyProfile.assistedReady
      ? ["末端安全或 PLC 本地保护前置条件未闭合，assisted 仅允许审阅/记录，不允许下发。"]
      : []),
    ...inputSignals
      .filter((item) => item.required === false && !item.ok)
      .map((item) => item.reason)
  ]);

  const allowedToCreateExecution =
    status === "ready" &&
    hasNonZeroTrim &&
    executionPolicy.executionMode !== "read_only";
  const assistedDispatchReady =
    executionPolicy.executionMode === "assisted" &&
    executionPolicy.hasControlTargetMapping &&
    executionPolicy.hasRollbackMapping &&
    safetyProfile.assistedReady;
  const allowedToDispatch =
    allowedToCreateExecution &&
    (executionPolicy.executionMode === "shadow" || assistedDispatchReady);
  const objective = buildPumpDeltaTObjective();
  const constraints = buildPumpDeltaTConstraints();
  const outputTargets = {
    chilledPumpFreqTrimHz: chilledTrimHz,
    coolingPumpFreqTrimHz: coolingTrimHz,
    rollbackTrimHz: 0,
    trimRangeHz: {
      min: PUMP_FREQ_TRIM_MIN_HZ,
      max: PUMP_FREQ_TRIM_MAX_HZ
    },
    maxStepHz: PUMP_FREQ_TRIM_STEP_HZ,
    ttlSeconds: PUMP_FREQ_TRIM_TTL_SECONDS,
    holdMinutes: PUMP_FREQ_TRIM_HOLD_MINUTES,
    rollbackLockoutMinutes: PUMP_FREQ_TRIM_ROLLBACK_LOCKOUT_MINUTES
  };
  const guardrails = [
    {
      key: "alarmAndFreshnessGate",
      status: blockers.length > 0 ? "blocked" : "ready",
      value: gate?.level || null,
      message: blockers.length > 0 ? blockers.join("；") : "告警与新鲜度门禁允许进入 shadow/assisted 评审。"
    },
    {
      key: "plcLocalPidPreserved",
      status: "ready",
      value: "trim-only",
      message: "AI 只输出频率修正量，不覆盖原有压差 PID、最小流量、上下限和联锁。"
    },
    {
      key: "antiChatter",
      status: "ready",
      value: `±${PUMP_FREQ_TRIM_STEP_HZ}Hz/5min`,
      message: "PLC 侧执行 5 分钟周期、单步 1Hz、连续同向和回退后 15 分钟闭锁。"
    },
    {
      key: "pumpCountOptimization",
      status: "locked",
      value: "disabled",
      message: "第一版只优化运行泵频率，不做泵台数启停优化。"
    },
    {
      key: "plcControlPointMapping",
      status: executionPolicy.hasControlTargetMapping ? "ready" : "missing",
      value: executionPolicy.hasControlTargetMapping ? "mapped" : null,
      message: executionPolicy.hasControlTargetMapping
        ? "已配置泵频率修正量控制点映射，可进入对应模式校验。"
        : "缺 AI_ChwpFreqTrim_Hz/AI_CwpFreqTrim_Hz 到 PLC/SCADA 的控制点映射。"
    },
    {
      key: "terminalSafetyPreconditions",
      status: safetyProfile.assistedReady ? "ready" : "missing",
      value: safetyProfile.status,
      message: safetyProfile.assistedReady
        ? "末端安全、PLC 本地保护和泵频反馈前置条件已配置。"
        : "assisted 前需补末端安全、PLC 本地保护和泵频反馈确认。"
    }
  ];

  const reason =
    blockers.length > 0
      ? "当前存在泵温差降频门禁阻断，输出冻结为 0Hz。"
      : hasNonZeroTrim
        ? "低温差条件成立，已生成运行泵频率小步长降频建议。"
        : "当前温差不低或暂无安全降频空间，保持 0Hz 修正量。";

  return {
    status,
    executionReady: allowedToCreateExecution,
    dispatchReady: allowedToDispatch,
    executionMode: executionPolicy.executionMode,
    dispatchMode: executionPolicy.dispatchMode,
    controlMode:
      executionPolicy.executionMode === "assisted"
        ? "manual-assisted-dispatch"
        : executionPolicy.executionMode === "shadow"
          ? "shadow-verification"
          : "read-only-advice",
    current: {
      chilledDeltaT,
      coolingDeltaT,
      chilledPumpPowerKw,
      coolingPumpPowerKw,
      chillerPowerKw,
      totalPowerKw,
      systemCop,
      chilledSupplyTemp,
      coolingReturnTemp,
      outdoorWetBulbC: currentWetBulbC,
      currentApproachC
    },
    targetPoints: {
      chilledPump: mappingProfile.targetPoints.chilledPump,
      coolingPump: mappingProfile.targetPoints.coolingPump,
      unit: "Hz",
      ttlSeconds: PUMP_FREQ_TRIM_TTL_SECONDS,
      trimRangeHz: {
        min: PUMP_FREQ_TRIM_MIN_HZ,
        max: PUMP_FREQ_TRIM_MAX_HZ
      }
    },
    targetBandsC: {
      chilledDeltaT: CHILLED_DELTA_T_TARGET_BAND_C,
      coolingDeltaT: COOLING_DELTA_T_TARGET_BAND_C
    },
    outputTargets,
    shadowMapping: {
      ...mappingProfile,
      assistedDispatchReady
    },
    safetyPreconditions: safetyProfile,
    reason,
    disclaimer: "AI 只输出 AI_ChwpFreqTrim_Hz/AI_CwpFreqTrim_Hz 修正量；PLC 必须负责限幅、斜率、PID、联锁、告警闭锁和回退。",
    guardrails,
    inputSignals,
    blockers,
    warnings,
    objective,
    constraints,
    advisorResult: {
      type: "pump_delta_t_l4_trim",
      status,
      lifecycleMode: executionPolicy.executionMode,
      objective,
      constraints,
      inputSignals,
      outputTargets,
      execution: {
        approvalRequired: true,
        allowedToCreateExecution,
        allowedToDispatch,
        dispatchMode: executionPolicy.dispatchMode,
        controlPointMapped: executionPolicy.hasControlTargetMapping,
        rollbackMapped: executionPolicy.hasRollbackMapping,
        terminalSafetyReady: safetyProfile.terminalSafetyReady,
        plcProtectionReady: safetyProfile.plcProtectionReady,
        pumpFrequencyFeedbackReady: safetyProfile.pumpFrequencyFeedbackReady,
        assistedDispatchReady,
        targetPoints: [mappingProfile.targetPoints.chilledPump, mappingProfile.targetPoints.coolingPump],
        enforcedAllowed: false
      },
      savingsVerification: {
        method: "shadow_compare_30_60min_same_load_wet_bulb_band",
        metrics: [
          "systemCop",
          "totalPowerKw",
          "chillerPowerKw",
          "chilledPumpPowerKw",
          "coolingPumpPowerKw",
          "chilledDeltaT",
          "coolingDeltaT",
          "activeAlarmCount"
        ],
        acceptance: "泵功率下降且冷机功率上升不得抵消泵节能；同负荷/相近湿球下 COP 不劣化，舒适度与冷凝侧边界无告警。"
      },
      blockers,
      warnings
    }
  };
}

function normalizeChillerCombination(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[+,/，、\s]+/)
      : [];
  return normalizeOptionalTextList(source).slice(0, 12);
}

function buildCombinationKey(value) {
  return normalizeChillerCombination(value)
    .map((item) => item.toUpperCase())
    .sort((left, right) => left.localeCompare(right))
    .join("+");
}

function getChillerStagingConfig(config) {
  const adminConfig =
    config?.siteRuntimeAdminConfig && typeof config.siteRuntimeAdminConfig === "object"
      ? config.siteRuntimeAdminConfig
      : {};
  if (config?.chillerStaging && typeof config.chillerStaging === "object") {
    return config.chillerStaging;
  }
  if (adminConfig?.chillerStaging && typeof adminConfig.chillerStaging === "object") {
    return adminConfig.chillerStaging;
  }
  return {};
}

function readChillerStagingRuntimeContext(context) {
  return context?.chillerStagingRuntimeContext && typeof context.chillerStagingRuntimeContext === "object"
    ? context.chillerStagingRuntimeContext
    : {};
}

function normalizeChillerInventory(config, context = {}) {
  const staging = getChillerStagingConfig(config);
  const runtimeContext = readChillerStagingRuntimeContext(context);
  const inventory = new Map();
  const addChiller = (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }
    const id = normalizeOptionalText(item.id || item.chillerId || item.key || item.name);
    if (!id) {
      return;
    }
    const existing = inventory.get(id) || {};
    const ratedCapacityKw = asPositiveNumber(item.ratedCapacityKw || item.capacityKw || item.coolingCapacityKw);
    const runMinutes = asFiniteNumber(item.runMinutes);
    const offMinutes = asFiniteNumber(item.offMinutes);
    inventory.set(id, {
      ...existing,
      id,
      label: normalizeOptionalText(item.label || item.name) || existing.label || id,
      generation: normalizeOptionalText(item.generation || item.efficiencyClass || item.class) || existing.generation || null,
      ratedCapacityKw: ratedCapacityKw ?? existing.ratedCapacityKw ?? null,
      available: item.available === false || item.enabled === false ? false : existing.available ?? true,
      lockedByOperator: item.lockedByOperator === true || item.locked === true || existing.lockedByOperator === true,
      runMinutes: runMinutes ?? existing.runMinutes ?? null,
      offMinutes: offMinutes ?? existing.offMinutes ?? null
    });
  };

  if (Array.isArray(staging.chillers)) {
    staging.chillers.forEach(addChiller);
  }
  if (Array.isArray(runtimeContext.chillerInventory)) {
    runtimeContext.chillerInventory.forEach(addChiller);
  }
  if (Array.isArray(runtimeContext.chillers)) {
    runtimeContext.chillers.forEach(addChiller);
  }

  const capacityMap =
    staging.chillerCapacityKw && typeof staging.chillerCapacityKw === "object" && !Array.isArray(staging.chillerCapacityKw)
      ? staging.chillerCapacityKw
      : {};
  for (const [rawId, rawCapacity] of Object.entries(capacityMap)) {
    const id = normalizeOptionalText(rawId);
    if (!id) {
      continue;
    }
    const existing = inventory.get(id) || { id, label: id };
    inventory.set(id, {
      ...existing,
      ratedCapacityKw: asPositiveNumber(rawCapacity)
    });
  }

  return inventory;
}

function resolveCurrentChillerCombination(config, request, context = {}) {
  const staging = getChillerStagingConfig(config);
  const requestIds = normalizeChillerCombination(request?.equipmentContext?.activeChillerIds);
  if (requestIds.length) {
    return requestIds;
  }
  const runtimeContext = readChillerStagingRuntimeContext(context);
  const runtimeSource =
    runtimeContext?.equipmentContext?.activeChillerIds ??
    runtimeContext?.activeChillerIds ??
    runtimeContext?.currentCombination;
  if (Array.isArray(runtimeSource)) {
    return normalizeChillerCombination(runtimeSource);
  }
  const configCurrent = normalizeChillerCombination(staging.currentCombination || staging.activeChillerIds);
  if (configCurrent.length) {
    return configCurrent;
  }
  return [];
}

function normalizeCandidateCombinationInput(value) {
  if (Array.isArray(value)) {
    return normalizeChillerCombination(value);
  }
  if (typeof value === "string") {
    return normalizeChillerCombination(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeChillerCombination(value.combination || value.runningCombination || value.targetCombination || value.ids);
  }
  return [];
}

function collectConfiguredCandidateCombinations(config, normalizedHistoryRows, currentCombination) {
  const staging = getChillerStagingConfig(config);
  const candidates = new Map();
  const add = (combination) => {
    const ids = normalizeChillerCombination(combination);
    const key = buildCombinationKey(ids);
    if (key && !candidates.has(key)) {
      candidates.set(key, ids);
    }
  };

  add(currentCombination);
  if (Array.isArray(staging.candidateCombinations)) {
    staging.candidateCombinations.forEach((item) => add(normalizeCandidateCombinationInput(item)));
  }
  normalizedHistoryRows.forEach((row) => add(row.combination));

  return [...candidates.values()];
}

function readChillerRuntimeSampleSources(config, context) {
  const staging = getChillerStagingConfig(config);
  return [
    context?.chillerRuntimeSamples,
    context?.chillerStagingSamples,
    context?.chillerCombinationRuntimeSamples,
    staging.runtimeSamples,
    staging.rawSamples,
    staging.chillerRuntimeSamples
  ].filter((source) => Array.isArray(source));
}

function getRuntimeSampleIntervalMinutes(config) {
  const staging = getChillerStagingConfig(config);
  return (
    asPositiveNumber(staging.runtimeSampleIntervalMinutes)
    ?? asPositiveNumber(staging.sampleIntervalMinutes)
    ?? CHILLER_STAGING_RUNTIME_SAMPLE_INTERVAL_MINUTES
  );
}

function getRuntimeSampleBucketSettings(config) {
  const staging = getChillerStagingConfig(config);
  return {
    loadRatePct:
      asPositiveNumber(staging.runtimeLoadRateBucketPct ?? staging.loadRateBucketPct)
      ?? CHILLER_STAGING_RUNTIME_LOAD_RATE_BUCKET_PCT,
    wetBulbC:
      asPositiveNumber(staging.runtimeWetBulbBucketC ?? staging.wetBulbBucketC)
      ?? CHILLER_STAGING_RUNTIME_WET_BULB_BUCKET_C,
    chilledSupplyTempC:
      asPositiveNumber(staging.runtimeChilledSupplyTempBucketC ?? staging.chilledSupplyTempBucketC)
      ?? CHILLER_STAGING_RUNTIME_CHWS_BUCKET_C
  };
}

function roundToBucket(value, bucketSize, digits = 1) {
  const numeric = asFiniteNumber(value);
  const size = asPositiveNumber(bucketSize);
  if (numeric === null || size === null) {
    return null;
  }
  return roundNullable(Math.round(numeric / size) * size, digits);
}

function computeMedianRounded(values, digits = 2) {
  const finiteValues = Array.isArray(values)
    ? values.filter((value) => typeof value === "number" && Number.isFinite(value))
    : [];
  if (!finiteValues.length) {
    return null;
  }
  const sorted = [...finiteValues].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  return roundNullable(value, digits);
}

function normalizeChillerRuntimeSampleRow(rawRow, config, inventory) {
  if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
    return null;
  }
  const combination = normalizeChillerCombination(
    rawRow.combination
    || rawRow.runningCombination
    || rawRow.activeChillerIds
    || rawRow.chillerIds
    || rawRow.runningChillerIds
  );
  const key = buildCombinationKey(combination);
  if (!key) {
    return null;
  }
  const loadKw = asPositiveNumber(
    rawRow.loadKw
    ?? rawRow.systemCoolingLoadKw
    ?? rawRow.coolingLoadKw
    ?? rawRow.totalCoolingLoadKw
    ?? rawRow.coolingCapacityKw
  );
  const stationPowerKw = asPositiveNumber(
    rawRow.stationPowerKw
    ?? rawRow.stationPowerTotalKw
    ?? rawRow.totalPowerKw
    ?? rawRow.powerKw
  );
  const chillerPowerKw = asPositiveNumber(
    rawRow.chillerPowerKw
    ?? rawRow.chillerPowerTotalKw
    ?? rawRow.chillerPower
  );
  if (loadKw === null || stationPowerKw === null) {
    return null;
  }
  const combinationCapacityKw = sumCombinationCapacityKw(combination, inventory);
  const loadRatePct =
    normalizeLoadRatioPct(rawRow.loadRatePct ?? rawRow.combinationPlrPct ?? rawRow.plrPct)
    ?? (combinationCapacityKw !== null ? roundNullable((loadKw / combinationCapacityKw) * 100, 1) : null);
  const wetBulbC = normalizeWetBulbC(rawRow.wetBulbC ?? rawRow.outdoorWetBulbC ?? rawRow.outdoorTempC);
  const chilledSupplyTempC = asFiniteNumber(rawRow.chilledSupplyTempC ?? rawRow.tchwsC ?? rawRow.chilledSupplyTemp);
  const sampleMinutes =
    asPositiveNumber(rawRow.sampleMinutes ?? rawRow.intervalMinutes ?? rawRow.durationMinutes)
    ?? getRuntimeSampleIntervalMinutes(config);

  const stationCop = roundNullable(loadKw / stationPowerKw, 2);
  const comboCop = chillerPowerKw !== null ? roundNullable(loadKw / chillerPowerKw, 2) : null;
  if (stationCop !== null && stationCop < 1) {
    return null;
  }
  if (comboCop !== null && comboCop < 1) {
    return null;
  }

  return {
    combination,
    key,
    loadKw,
    loadRatePct,
    wetBulbC,
    chilledSupplyTempC,
    stationPowerKw,
    chillerPowerKw,
    stationCop,
    comboCop,
    kwPerRt: buildKwPerRt(stationPowerKw, loadKw),
    sampleMinutes,
    alarmCount: parseNonNegativeInteger(rawRow.alarmCount ?? rawRow.activeAlarmCount ?? rawRow.alarmTotal, 0),
    capturedAt: normalizeOptionalText(rawRow.capturedAt ?? rawRow.timestamp ?? rawRow.ts ?? rawRow.time) || null
  };
}

function aggregateChillerCombinationRuntimeSamples(config, context, inventory) {
  const sampleSources = readChillerRuntimeSampleSources(config, context);
  if (!sampleSources.length) {
    return [];
  }
  const buckets = getRuntimeSampleBucketSettings(config);
  const groups = new Map();
  const addSample = (sample) => {
    if (!sample) {
      return;
    }
    const loadRateBucket = roundToBucket(sample.loadRatePct, buckets.loadRatePct, 1);
    const wetBulbBucket = roundToBucket(sample.wetBulbC, buckets.wetBulbC, 1);
    const chilledSupplyTempBucket = roundToBucket(sample.chilledSupplyTempC, buckets.chilledSupplyTempC, 1);
    const groupKey = [
      sample.key,
      loadRateBucket ?? "load:any",
      wetBulbBucket ?? "wb:any",
      chilledSupplyTempBucket ?? "chws:any"
    ].join("|");
    const existing = groups.get(groupKey) || {
      combination: sample.combination,
      key: sample.key,
      loadRateBucket,
      wetBulbBucket,
      chilledSupplyTempBucket,
      samples: []
    };
    existing.samples.push(sample);
    groups.set(groupKey, existing);
  };

  for (const source of sampleSources) {
    for (const rawRow of source) {
      addSample(normalizeChillerRuntimeSampleRow(rawRow, config, inventory));
    }
  }

  return [...groups.values()]
    .map((group) => {
      const samples = group.samples;
      const sampleCount = samples.length;
      const sampleMinutes = samples.reduce((sum, sample) => sum + (asPositiveNumber(sample.sampleMinutes) ?? 0), 0);
      return {
        combination: group.combination,
        key: group.key,
        sampleCount,
        loadRatePct: computeMedianRounded(samples.map((sample) => sample.loadRatePct), 1) ?? group.loadRateBucket,
        wetBulbC: computeMedianRounded(samples.map((sample) => sample.wetBulbC), 1) ?? group.wetBulbBucket,
        chilledSupplyTempC:
          computeMedianRounded(samples.map((sample) => sample.chilledSupplyTempC), 1) ?? group.chilledSupplyTempBucket,
        stationCop: computeMedianRounded(samples.map((sample) => sample.stationCop), 2),
        comboCop: computeMedianRounded(samples.map((sample) => sample.comboCop), 2),
        stationPowerKw: computeMedianRounded(samples.map((sample) => sample.stationPowerKw), 1),
        chillerPowerKw: computeMedianRounded(samples.map((sample) => sample.chillerPowerKw), 1),
        kwPerRt: computeMedianRounded(samples.map((sample) => sample.kwPerRt), 3),
        sampleMinutes: sampleMinutes > 0 ? roundNullable(sampleMinutes, 1) : null,
        alarmCount: samples.reduce((sum, sample) => sum + parseNonNegativeInteger(sample.alarmCount, 0), 0),
        capturedAt: samples.at(-1)?.capturedAt || null,
        source: "runtime_sample_aggregation"
      };
    })
    .filter((row) => row.sampleCount > 0);
}

function normalizeChillerCombinationHistoryRows(config, context, inventory = normalizeChillerInventory(config, context)) {
  const staging = getChillerStagingConfig(config);
  const sources = [
    context?.chillerCombinationHistory,
    context?.chillerStagingHistory,
    staging.combinationHistory,
    staging.history
  ];
  const rows = [];
  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const rawRow of source) {
      if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
        continue;
      }
      const combination = normalizeChillerCombination(
        rawRow.combination || rawRow.runningCombination || rawRow.targetCombination || rawRow.chillerIds
      );
      const key = buildCombinationKey(combination);
      if (!key) {
        continue;
      }
      rows.push({
        combination,
        key,
        sampleCount: parseNonNegativeInteger(rawRow.sampleCount, 0),
        loadRatePct: normalizeLoadRatioPct(rawRow.loadRatePct ?? rawRow.combinationPlrPct ?? rawRow.plrPct),
        wetBulbC: normalizeWetBulbC(rawRow.wetBulbC ?? rawRow.outdoorWetBulbC),
        chilledSupplyTempC: asFiniteNumber(rawRow.chilledSupplyTempC ?? rawRow.tchwsC ?? rawRow.chilledSupplyTemp),
        stationCop: asPositiveNumber(
          rawRow.stationCopMedian ?? rawRow.stationCop ?? rawRow.stationEfficiency ?? rawRow.systemCop
        ),
        comboCop: asPositiveNumber(rawRow.comboCopMedian ?? rawRow.comboCop ?? rawRow.chillerCop),
        stationPowerKw: asPositiveNumber(
          rawRow.stationPowerKwMedian ?? rawRow.stationPowerKw ?? rawRow.totalPowerKw
        ),
        chillerPowerKw: asPositiveNumber(
          rawRow.chillerPowerKwMedian ?? rawRow.chillerPowerKw ?? rawRow.chillerPowerTotalKw
        ),
        kwPerRt: asPositiveNumber(rawRow.kwPerRt ?? rawRow.kwPerTon ?? rawRow.stationKwPerRt),
        sampleMinutes: asPositiveNumber(
          rawRow.sampleMinutes ?? rawRow.durationMinutes ?? rawRow.totalMinutes ?? rawRow.runningMinutes
        ),
        alarmCount: parseNonNegativeInteger(rawRow.alarmCount ?? rawRow.activeAlarmCount ?? rawRow.alarmTotal, 0),
        capturedAt: normalizeOptionalText(rawRow.capturedAt ?? rawRow.timestamp ?? rawRow.endAt) || null,
        source: normalizeOptionalText(rawRow.source) || null
      });
    }
  }
  return rows.concat(aggregateChillerCombinationRuntimeSamples(config, context, inventory));
}

function sumCombinationCapacityKw(combination, inventory) {
  if (!Array.isArray(combination) || !combination.length) {
    return null;
  }
  let total = 0;
  for (const id of combination) {
    const capacity = asPositiveNumber(inventory.get(id)?.ratedCapacityKw);
    if (capacity === null) {
      return null;
    }
    total += capacity;
  }
  return total > 0 ? roundNullable(total, 1) : null;
}

function getCombinationAvailabilityBlockers(combination, inventory) {
  const blockers = [];
  for (const id of Array.isArray(combination) ? combination : []) {
    const chiller = inventory.get(id);
    if (!chiller) {
      continue;
    }
    if (chiller.available === false) {
      blockers.push(`${id} 当前不可用或检修。`);
    }
    if (chiller.lockedByOperator) {
      blockers.push(`${id} 已被人工锁定。`);
    }
  }
  return blockers;
}

function resolveCurrentCombinationRunMinutes(config, currentCombination, inventory) {
  const staging = getChillerStagingConfig(config);
  const direct = asFiniteNumber(staging.currentRunMinutes ?? staging.currentCombinationRunMinutes);
  if (direct !== null) {
    return direct;
  }
  const activeRunMinutes = normalizeChillerCombination(currentCombination)
    .map((id) => asFiniteNumber(inventory.get(id)?.runMinutes))
    .filter((item) => item !== null);
  if (!activeRunMinutes.length) {
    return null;
  }
  return Math.min(...activeRunMinutes);
}

function isHistoryRowSimilarToCandidate(row, candidate, baseline, requestedWetBulbC) {
  if (!row || row.key !== candidate.key) {
    return false;
  }
  if (
    row.loadRatePct !== null &&
    candidate.combinationPlrPct !== null &&
    Math.abs(row.loadRatePct - candidate.combinationPlrPct) > CHILLER_STAGING_LOAD_RATE_TOLERANCE_PCT
  ) {
    return false;
  }
  if (
    row.wetBulbC !== null &&
    requestedWetBulbC !== null &&
    Math.abs(row.wetBulbC - requestedWetBulbC) > CHILLER_STAGING_WET_BULB_TOLERANCE_C
  ) {
    return false;
  }
  if (
    row.chilledSupplyTempC !== null &&
    baseline?.chilledSupplyTemp !== null &&
    baseline?.chilledSupplyTemp !== undefined &&
    Math.abs(row.chilledSupplyTempC - baseline.chilledSupplyTemp) > CHILLER_STAGING_CHWS_TOLERANCE_C
  ) {
    return false;
  }
  return true;
}

function pickBestChillerCombinationHistoryRow(rows, candidate, baseline, requestedWetBulbC) {
  const strictRows = rows.filter((row) => isHistoryRowSimilarToCandidate(row, candidate, baseline, requestedWetBulbC));
  const fallbackRows = strictRows.length ? strictRows : rows.filter((row) => row.key === candidate.key);
  if (!fallbackRows.length) {
    return null;
  }
  return [...fallbackRows].sort((left, right) => {
    const sampleDiff = right.sampleCount - left.sampleCount;
    if (sampleDiff !== 0) {
      return sampleDiff;
    }
    return (right.stationCop ?? 0) - (left.stationCop ?? 0);
  })[0];
}

function getChillerHistoryMatchTier(row, candidate, baseline, requestedWetBulbC) {
  if (!row || row.key !== candidate?.key) {
    return "no_sample";
  }
  return isHistoryRowSimilarToCandidate(row, candidate, baseline, requestedWetBulbC)
    ? "same_load_wet_bulb_chws_band"
    : "same_combination_fallback";
}

function buildKwPerRt(powerKw, loadKw) {
  const power = asPositiveNumber(powerKw);
  const load = asPositiveNumber(loadKw);
  if (power === null || load === null) {
    return null;
  }
  const rt = load / KW_PER_RT;
  return rt > 0 ? roundNullable(power / rt, 3) : null;
}

function classifyChillerStagingConfidence(sampleCount) {
  if (sampleCount >= CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT) {
    return "high";
  }
  if (sampleCount >= CHILLER_STAGING_MIN_SAMPLE_COUNT) {
    return "medium";
  }
  return "low";
}

function inferChillerStagingAction(currentCombination, targetCombination) {
  const currentKey = buildCombinationKey(currentCombination);
  const targetKey = buildCombinationKey(targetCombination);
  if (!targetKey || currentKey === targetKey) {
    return "keep";
  }
  if (targetCombination.length > currentCombination.length) {
    return targetCombination.length - currentCombination.length === 1 ? "add_one" : "switch_combination";
  }
  if (targetCombination.length < currentCombination.length) {
    return currentCombination.length - targetCombination.length === 1 ? "remove_one" : "switch_combination";
  }
  return "switch_combination";
}

function buildChillerCombinationCandidate({
  combination,
  currentCombination,
  inventory,
  historyRows,
  baseline,
  loadKw,
  requestedWetBulbC
}) {
  const key = buildCombinationKey(combination);
  const combinationCapacityKw = sumCombinationCapacityKw(combination, inventory);
  const combinationPlrPct =
    loadKw !== null && combinationCapacityKw !== null ? roundNullable((loadKw / combinationCapacityKw) * 100, 1) : null;
  const capacityReservePct =
    loadKw !== null && combinationCapacityKw !== null ? roundNullable(((combinationCapacityKw - loadKw) / loadKw) * 100, 1) : null;
  const baseCandidate = {
    key,
    combination,
    runningCount: combination.length,
    combinationCapacityKw,
    combinationPlrPct,
    capacityReservePct
  };
  const historyRow = pickBestChillerCombinationHistoryRow(historyRows, baseCandidate, baseline, requestedWetBulbC);
  const isCurrent = key && key === buildCombinationKey(currentCombination);
  const sampleCount = historyRow?.sampleCount ?? (isCurrent ? 0 : 0);
  const confidence = classifyChillerStagingConfidence(sampleCount);
  const stationPowerKw =
    historyRow?.stationPowerKw ??
    (historyRow?.stationCop !== null && historyRow?.stationCop !== undefined && loadKw !== null
      ? roundNullable(loadKw / historyRow.stationCop, 1)
      : isCurrent
        ? asPositiveNumber(baseline?.totalPowerKw)
        : null);
  const chillerPowerKw =
    historyRow?.chillerPowerKw ??
    (historyRow?.comboCop !== null && historyRow?.comboCop !== undefined && loadKw !== null
      ? roundNullable(loadKw / historyRow.comboCop, 1)
      : isCurrent
        ? asPositiveNumber(baseline?.chillerPowerKw)
        : null);
  const stationCop =
    historyRow?.stationCop ??
    (stationPowerKw !== null && loadKw !== null ? roundNullable(loadKw / stationPowerKw, 2) : null);
  const comboCop =
    historyRow?.comboCop ??
    (chillerPowerKw !== null && loadKw !== null ? roundNullable(loadKw / chillerPowerKw, 2) : null);
  const expectedTotalPowerDeltaKw =
    stationPowerKw !== null && asPositiveNumber(baseline?.totalPowerKw) !== null
      ? roundNullable(stationPowerKw - baseline.totalPowerKw, 1)
      : null;
  const expectedPowerDeltaPct =
    expectedTotalPowerDeltaKw !== null && asPositiveNumber(baseline?.totalPowerKw) !== null
      ? roundNullable((expectedTotalPowerDeltaKw / baseline.totalPowerKw) * 100, 1)
      : null;
  const matchingTier = getChillerHistoryMatchTier(historyRow, baseCandidate, baseline, requestedWetBulbC);
  const kwPerRt = historyRow?.kwPerRt ?? buildKwPerRt(stationPowerKw, loadKw);
  const sampleRole = combination.length === 1 ? "single_chiller_learning_window" : "combination_learning_window";

  const blockers = [
    ...(combinationCapacityKw === null ? ["缺候选组合额定容量，不能校验容量余量。"] : []),
    ...(capacityReservePct !== null && capacityReservePct < CHILLER_STAGING_MIN_RESERVE_PCT
      ? [`候选组合容量余量 ${capacityReservePct}% 低于 ${CHILLER_STAGING_MIN_RESERVE_PCT}%。`]
      : []),
    ...getCombinationAvailabilityBlockers(combination, inventory),
    ...(!isCurrent && sampleCount < CHILLER_STAGING_MIN_SAMPLE_COUNT
      ? [`组合历史样本 ${sampleCount} 条，低于 ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条。`]
      : []),
    ...(!isCurrent && stationPowerKw === null ? ["缺候选组合历史功率或 COP，不能估算切换收益。"] : [])
  ];

  return {
    ...baseCandidate,
    isCurrent,
    sampleCount,
    confidence,
    stationCop,
    comboCop,
    kwPerRt,
    sampleMinutes: historyRow?.sampleMinutes ?? null,
    alarmCount: historyRow?.alarmCount ?? null,
    source: historyRow?.source ?? null,
    matchingTier,
    sampleRole,
    canLearnSingleChillerCop: combination.length === 1,
    canLearnCombinationCop: true,
    estimatedStationPowerKw: stationPowerKw,
    estimatedChillerPowerKw: chillerPowerKw,
    expectedTotalPowerDeltaKw,
    expectedPowerDeltaPct,
    action: inferChillerStagingAction(currentCombination, combination),
    blockers: dedupeSteps(blockers),
    warnings: dedupeSteps([
      ...(!isCurrent && sampleCount < CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT && sampleCount >= CHILLER_STAGING_MIN_SAMPLE_COUNT
        ? [`组合样本 ${sampleCount} 条，未达到高置信 ${CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT} 条。`]
        : []),
      ...(combination.length > 1 ? ["多机并联无单机冷冻水流量，只评价组合 COP/冷站 COP，不拆分单机 COP。"] : [])
    ])
  };
}

function pickChillerCandidateEvidence(candidate) {
  if (!candidate) {
    return null;
  }
  return {
    combination: candidate.combination,
    sampleCount: candidate.sampleCount,
    sampleMinutes: candidate.sampleMinutes,
    confidence: candidate.confidence,
    matchingTier: candidate.matchingTier,
    stationCop: candidate.stationCop,
    comboCop: candidate.comboCop,
    kwPerRt: candidate.kwPerRt,
    stationPowerKw: candidate.estimatedStationPowerKw,
    chillerPowerKw: candidate.estimatedChillerPowerKw,
    alarmCount: candidate.alarmCount,
    source: candidate.source,
    sampleRole: candidate.sampleRole,
    canLearnSingleChillerCop: candidate.canLearnSingleChillerCop === true,
    note: candidate.canLearnSingleChillerCop
      ? "单台运行窗口可作为该主机单机 COP 样本。"
      : "多机并联窗口只作为组合 COP/冷站 COP 样本，不拆分单台主机 COP。"
  };
}

function buildCurrentChillerLiveSample({
  currentCombination,
  currentCandidate,
  loadKw,
  loadSource,
  loadBasis,
  requestLoadKw,
  requestedWetBulbC,
  baseline,
  sampleIntervalMinutes,
  capturedAt
}) {
  const combination = normalizeChillerCombination(currentCombination);
  const stationPowerKw = asPositiveNumber(baseline?.totalPowerKw);
  const chillerPowerKw = asPositiveNumber(baseline?.chillerPowerKw);
  const hasCoreSignals =
    combination.length > 0 &&
    loadKw !== null &&
    stationPowerKw !== null &&
    chillerPowerKw !== null;
  const runningCount = combination.length;
  return {
    status: hasCoreSignals ? "recordable" : "unavailable",
    source: "current_realtime_snapshot",
    includedInHistory: false,
    capturedAt: normalizeOptionalText(capturedAt) || new Date().toISOString(),
    reason: hasCoreSignals
      ? "本次实时快照可作为后续样本入库候选；当前响应不把单次快照计入历史样本，不据此承诺节能。"
      : "当前实时快照缺少运行组合、系统冷量、冷站总功率或主机总功率，暂不能形成采样点。",
    combination,
	    runningCount,
	    loadKw,
    loadSource,
    loadBasis,
    requestLoadKw,
	    loadRatePct: currentCandidate?.combinationPlrPct ?? null,
    wetBulbC: requestedWetBulbC,
    chilledSupplyTempC: asFiniteNumber(baseline?.chilledSupplyTemp),
    stationPowerKw,
	    chillerPowerKw,
	    stationCop:
	      asPositiveNumber(baseline?.systemCop) ??
	      (loadKw !== null && stationPowerKw !== null ? roundNullable(loadKw / stationPowerKw, 2) : null),
	    comboCop:
	      loadKw !== null && chillerPowerKw !== null ? roundNullable(loadKw / chillerPowerKw, 2) : null,
	    kwPerRt: buildKwPerRt(stationPowerKw, loadKw),
    alarmCount: parseNonNegativeInteger(baseline?.activeAlarmCount, 0),
    sampleMinutes: sampleIntervalMinutes,
    sampleRole: runningCount === 1 ? "single_chiller_learning_window" : "combination_learning_window",
    canLearnSingleChillerCop: runningCount === 1,
    canLearnCombinationCop: runningCount >= 1,
    requiredAccumulation: {
      minSampleCount: CHILLER_STAGING_MIN_SAMPLE_COUNT,
      highConfidenceSampleCount: CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT,
      note: "连续采样入库后，才进入组合实测性能排序；多机窗口仍只学习组合 COP / 冷站 COP。"
    }
  };
}

function buildChillerStagingSavingsVerification() {
  return {
    method: "shadow_compare_30_60min_same_load_wet_bulb_band",
    durationMinutes: CHILLER_STAGING_SHADOW_COMPARE_MINUTES,
    metrics: ["stationCop", "comboCop", "kwPerRt", "stationPowerTotalKw", "chillerPowerTotalKw", "alarmCount"],
    comparisonBands: {
      loadRateTolerancePct: CHILLER_STAGING_LOAD_RATE_TOLERANCE_PCT,
      wetBulbToleranceC: CHILLER_STAGING_WET_BULB_TOLERANCE_C,
      chilledSupplyTempToleranceC: CHILLER_STAGING_CHWS_TOLERANCE_C
    },
    acceptance: "同负荷/相近湿球下冷站 COP 或 kW/RT 改善，且无新增告警；多机运行不得声称单机 COP 已精确拆分。"
  };
}

function buildChillerStagingEvidence({
  currentCombination,
  currentCandidate,
  targetCandidate,
  candidates,
  historyRows,
	  currentRunMinutes,
	  loadKw,
  loadSource,
  loadBasis,
  requestLoadKw,
	  requestedWetBulbC,
  baseline,
  sampleIntervalMinutes,
  capturedAt
}) {
  const currentRunningCount = Array.isArray(currentCombination) ? currentCombination.length : 0;
  const target = targetCandidate || currentCandidate || null;
  const comparableCandidates = candidates.filter(
    (candidate) => candidate.sampleCount > 0 && candidate.matchingTier === "same_load_wet_bulb_chws_band"
  );
  const highConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === "high");
  const lowConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === "low");
  const sampleTotal = historyRows.reduce((sum, row) => sum + parseNonNegativeInteger(row.sampleCount, 0), 0);
  const currentEvidence = pickChillerCandidateEvidence(currentCandidate);
  const targetEvidence = pickChillerCandidateEvidence(target);
  const currentLiveSample = buildCurrentChillerLiveSample({
    currentCombination,
	    currentCandidate,
	    loadKw,
    loadSource,
    loadBasis,
    requestLoadKw,
	    requestedWetBulbC,
    baseline,
    sampleIntervalMinutes,
    capturedAt
  });

  return {
    learningBoundary: {
      singleChillerCopLearning: "only_when_single_chiller_running",
      multiChillerCop: "combination_only_without_single_chilled_water_flow",
      message: "单机 COP 只在单台运行窗口学习；多机并联无单机流量时，只评价组合 COP / 冷站 COP。"
    },
    currentWindow: {
      runningCombination: currentCombination,
      runningCount: currentRunningCount,
      currentRunMinutes,
      canLearnSingleChillerCop: currentRunningCount === 1,
      canLearnCombinationCop: currentRunningCount >= 1,
      sampleRole: currentRunningCount === 1 ? "single_chiller_learning_window" : "combination_learning_window"
    },
    currentLiveSample,
	    comparisonWindow: {
	      loadKw,
      loadSource,
      loadBasis,
      requestLoadKw,
	      wetBulbC: requestedWetBulbC,
      chilledSupplyTempC: asFiniteNumber(baseline?.chilledSupplyTemp),
      loadRateTolerancePct: CHILLER_STAGING_LOAD_RATE_TOLERANCE_PCT,
      wetBulbToleranceC: CHILLER_STAGING_WET_BULB_TOLERANCE_C,
      chilledSupplyTempToleranceC: CHILLER_STAGING_CHWS_TOLERANCE_C
    },
    sampleSummary: {
      historyRowCount: historyRows.length,
      sampleTotal,
      candidateCombinationCount: candidates.length,
      comparableCandidateCount: comparableCandidates.length,
      highConfidenceCandidateCount: highConfidenceCandidates.length,
      lowConfidenceCandidateCount: lowConfidenceCandidates.length,
      currentCombinationSamples: currentCandidate?.sampleCount ?? 0,
      targetCombinationSamples: target?.sampleCount ?? 0,
      minSampleCount: CHILLER_STAGING_MIN_SAMPLE_COUNT,
      highConfidenceSampleCount: CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT
    },
    currentCombinationEvidence: currentEvidence,
    targetCombinationEvidence: targetEvidence,
    shadowVerificationPlan: {
      ...buildChillerStagingSavingsVerification(),
      requiredBeforeSubmit: [
        `目标组合样本 >= ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条`,
        `当前组合稳定运行 >= ${CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES} 分钟`,
        `候选组合容量余量 >= ${CHILLER_STAGING_MIN_RESERVE_PCT}%`,
        `预计节能 >= ${CHILLER_STAGING_MIN_SAVE_KW} kW 或 >= ${CHILLER_STAGING_MIN_SAVE_PCT}%`
      ],
      resultRecording: {
        status: "not_started",
        allowedResultTypes: ["improved", "neutral", "regressed", "invalid"],
        note: "人工执行组合切换后再记录 30-60 分钟同工况 shadow 对比结果。"
      }
    }
  };
}

function buildChillerStagingSampleGovernance({ currentCombination, candidates, historyRows }) {
  const currentKey = buildCombinationKey(currentCombination);
  const sampleByCombination = new Map();
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const key = normalizeOptionalText(row?.key) || buildCombinationKey(row?.combination);
    if (!key) {
      continue;
    }
    const existing = sampleByCombination.get(key) || {
      combinationKey: key,
      combination: normalizeChillerCombination(row?.combination),
      totalSamples: 0,
      totalSampleMinutes: 0
    };
    existing.totalSamples += parseNonNegativeInteger(row?.sampleCount, 0);
    existing.totalSampleMinutes += asPositiveNumber(row?.sampleMinutes) ?? 0;
    sampleByCombination.set(key, existing);
  }

  const candidateCoverage = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const key = normalizeOptionalText(candidate?.key) || buildCombinationKey(candidate?.combination);
    const aggregate = sampleByCombination.get(key) || null;
    const totalSamples = aggregate?.totalSamples ?? 0;
    const sameBandSamples = parseNonNegativeInteger(candidate?.sampleCount, 0);
    return {
      combinationKey: key,
      combination: normalizeChillerCombination(candidate?.combination),
      isCurrent: candidate?.isCurrent === true,
      totalSamples,
      sameBandSamples,
      totalSampleMinutes: aggregate?.totalSampleMinutes ? roundNullable(aggregate.totalSampleMinutes, 1) : 0,
      broadConfidence: classifyChillerStagingConfidence(totalSamples),
      sameBandConfidence: classifyChillerStagingConfidence(sameBandSamples),
      deficitToMin: Math.max(0, CHILLER_STAGING_MIN_SAMPLE_COUNT - sameBandSamples),
      deficitToHigh: Math.max(0, CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT - sameBandSamples),
      matchingTier: candidate?.matchingTier || "no_sample",
      capacityReservePct: candidate?.capacityReservePct ?? null,
      blockers: Array.isArray(candidate?.blockers) ? candidate.blockers : []
    };
  });

  const currentCoverage = candidateCoverage.find((item) => item.combinationKey === currentKey) || null;
  const nonCurrentCoverage = candidateCoverage.filter((item) => !item.isCurrent);
  const broadReadyCandidateCount = nonCurrentCoverage.filter(
    (item) => item.totalSamples >= CHILLER_STAGING_MIN_SAMPLE_COUNT
  ).length;
  const sameBandReadyCandidateCount = nonCurrentCoverage.filter(
    (item) => item.sameBandSamples >= CHILLER_STAGING_MIN_SAMPLE_COUNT
  ).length;
  const highConfidenceCandidateCount = candidateCoverage.filter(
    (item) => item.totalSamples >= CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT
  ).length;
  const coveredCandidateCount = candidateCoverage.filter((item) => item.totalSamples > 0).length;
  const currentTotalSamples = currentCoverage?.totalSamples ?? 0;
  const currentSameBandSamples = currentCoverage?.sameBandSamples ?? 0;
  const readyForRanking =
    currentSameBandSamples >= CHILLER_STAGING_MIN_SAMPLE_COUNT && sameBandReadyCandidateCount > 0;
  const coverageStatus =
    readyForRanking
      ? "comparison_candidate_available"
      : currentTotalSamples >= CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT
        ? "baseline_high_confidence_only"
        : currentTotalSamples >= CHILLER_STAGING_MIN_SAMPLE_COUNT
          ? "baseline_ready_only"
          : coveredCandidateCount > 0
            ? "collection_started"
            : "no_samples";
  const missingCandidateCoverage = nonCurrentCoverage
    .filter((item) => item.sameBandSamples < CHILLER_STAGING_MIN_SAMPLE_COUNT)
    .sort((left, right) => {
      const totalDiff = right.totalSamples - left.totalSamples;
      if (totalDiff !== 0) {
        return totalDiff;
      }
      return left.combinationKey.localeCompare(right.combinationKey);
    })
    .slice(0, 5)
    .map((item) => ({
      combinationKey: item.combinationKey,
      combination: item.combination,
      totalSamples: item.totalSamples,
      sameBandSamples: item.sameBandSamples,
      deficitToMin: item.deficitToMin,
      deficitToHigh: item.deficitToHigh,
      matchingTier: item.matchingTier
    }));
  const summary =
    coverageStatus === "comparison_candidate_available"
      ? "已有候选组合达到同工况样本门槛，可进入组合排序和 shadow 评审。"
      : coverageStatus === "baseline_high_confidence_only"
        ? "当前基线组合样本已较充分，但目标候选组合缺同工况样本，不能承诺切换收益。"
        : coverageStatus === "baseline_ready_only"
          ? "当前基线组合样本已达到 30 条门槛，但候选组合仍不足，继续采样。"
          : coverageStatus === "collection_started"
            ? "主机组合样本已开始积累，但尚未达到比较门槛。"
            : "尚无可用主机组合历史样本，只能展示当前组合。";

  return {
    status: coverageStatus,
    readyForRanking,
    summary,
    currentCombinationKey: currentKey || null,
    currentCombinationSamples: currentTotalSamples,
    currentSameBandSamples,
    coveredCandidateCount,
    candidateCombinationCount: candidateCoverage.length,
    broadReadyCandidateCount,
    sameBandReadyCandidateCount,
    highConfidenceCandidateCount,
    minSampleCount: CHILLER_STAGING_MIN_SAMPLE_COUNT,
    highConfidenceSampleCount: CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT,
    candidateCoverage,
    missingCandidateCoverage,
    boundary:
      "采样治理只说明组合样本覆盖；目标组合缺同工况样本时必须 keep/continue sampling，不自动启停主机。"
  };
}

function buildChillerStagingObjective() {
  return {
    key: "minimize_station_power_by_empirical_combination",
    formula: "min P_station = P_chiller_combo + P_chwp + P_cwp + P_tower",
    description: "在无单台冷冻水流量的多机并联系统中，按主机组合实测冷站 COP/总功率进行排序，只输出 shadow 组合建议。"
  };
}

function buildChillerStagingAdvisor(config, request, baseline, historyBenchmark, gate, freshness, context = {}) {
  const inventory = normalizeChillerInventory(config, context);
  const currentCombination = resolveCurrentChillerCombination(config, request, context);
  const currentKey = buildCombinationKey(currentCombination);
  const historyRows = normalizeChillerCombinationHistoryRows(config, context, inventory);
  const candidateCombinations = collectConfiguredCandidateCombinations(config, historyRows, currentCombination);
  const coolingLoad = deriveRealtimeCoolingLoadForAdvisor(request, baseline);
  const loadKw = coolingLoad.loadKw;
  const requestedWetBulbC =
    normalizeWetBulbC(baseline?.outdoorWetBulbC) ?? normalizeWetBulbC(request?.outdoorTempC);
  const freshnessStale = isDraftFreshnessStale(config, freshness);
  const currentRunMinutes = resolveCurrentCombinationRunMinutes(config, currentCombination, inventory);
  const currentCapacityKw = sumCombinationCapacityKw(currentCombination, inventory);
  const currentCombinationPlrPct =
    loadKw !== null && currentCapacityKw !== null ? roundNullable((loadKw / currentCapacityKw) * 100, 1) : null;
  const chillerPowerTotalKw = asPositiveNumber(baseline?.chillerPowerKw);
  const stationPowerTotalKw = asPositiveNumber(baseline?.totalPowerKw);
  const comboCop =
    loadKw !== null && chillerPowerTotalKw !== null ? roundNullable(loadKw / chillerPowerTotalKw, 2) : null;
  const stationCop =
    asPositiveNumber(baseline?.systemCop) ??
    (loadKw !== null && stationPowerTotalKw !== null ? roundNullable(loadKw / stationPowerTotalKw, 2) : null);

  const inputSignals = [
    buildSignalState({
      key: "runningCombination",
      label: "当前主机组合",
      value: currentCombination.length ? currentCombination.join("+") : null,
      ok: currentCombination.length > 0,
      reason: "缺当前运行主机组合，不能做组合性能排序。"
    }),
    buildSignalState({
      key: "systemCoolingLoadKw",
      label: "系统总冷量",
      value: loadKw,
      unit: "kW",
      ok: loadKw !== null && loadKw > 0,
      reason: "缺系统总冷量，不能计算组合负荷率。"
    }),
    buildSignalState({
      key: "chillerPowerTotalKw",
      label: "运行主机总功率",
      value: chillerPowerTotalKw,
      unit: "kW",
      ok: chillerPowerTotalKw !== null && chillerPowerTotalKw > 0,
      reason: "缺运行主机总功率，不能计算组合 COP。"
    }),
    buildSignalState({
      key: "stationPowerTotalKw",
      label: "冷站总功率",
      value: stationPowerTotalKw,
      unit: "kW",
      ok: stationPowerTotalKw !== null && stationPowerTotalKw > 0,
      reason: "缺冷站总功率，不能比较冷站 COP。"
    }),
    buildSignalState({
      key: "combinationCapacityKw",
      label: "当前组合额定容量",
      value: currentCapacityKw,
      unit: "kW",
      ok: currentCapacityKw !== null,
      reason: "缺当前组合额定容量，不能校验负荷率与容量余量。"
    }),
    buildSignalState({
      key: "historyCombinationSamples",
      label: "组合历史样本",
      value: historyRows.length,
      ok: historyRows.length > 0,
      reason: "缺主机组合历史样本，只能保留方向性审阅。"
    }),
    buildSignalState({
      key: "freshness",
      label: "实时快照新鲜度",
      value: freshness?.label || (typeof freshness?.ageHours === "number" ? freshness.ageHours : null),
      unit: typeof freshness?.ageHours === "number" ? "h" : null,
      ok: !freshnessStale,
      reason: "实时快照已超过新鲜度阈值，禁止提交主机组合 shadow 单。"
    })
  ];

  const requiredSignalBlockers = inputSignals
    .filter((item) => item.required && !item.ok)
    .map((item) => item.reason || `缺${item.label}`);
  const currentRunBlockers =
    currentRunMinutes !== null && currentRunMinutes < CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES
      ? [`当前组合运行 ${currentRunMinutes} 分钟，低于 ${CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES} 分钟防频繁切换窗口。`]
      : [];
  const gateBlockers = [
    ...(gate?.level === "blocked" ? [gate.reason || "当前存在阻断门禁。"] : []),
    ...(freshnessStale ? ["实时快照已超过新鲜度阈值。"] : [])
  ];
  const candidates = candidateCombinations
    .map((combination) =>
      buildChillerCombinationCandidate({
        combination,
        currentCombination,
        inventory,
        historyRows,
        baseline,
        loadKw,
        requestedWetBulbC
      })
    )
    .filter((candidate) => candidate.key);
  const currentCandidate = candidates.find((candidate) => candidate.key === currentKey) || null;
  const switchCandidates = candidates
    .filter((candidate) => !candidate.isCurrent)
    .filter((candidate) => candidate.blockers.length === 0)
    .filter((candidate) => {
      const saveKw =
        typeof candidate.expectedTotalPowerDeltaKw === "number" ? -candidate.expectedTotalPowerDeltaKw : null;
      const savePct = typeof candidate.expectedPowerDeltaPct === "number" ? -candidate.expectedPowerDeltaPct : null;
      return (
        saveKw !== null &&
        savePct !== null &&
        (saveKw >= CHILLER_STAGING_MIN_SAVE_KW || savePct >= CHILLER_STAGING_MIN_SAVE_PCT)
      );
    })
    .sort((left, right) => {
      const powerDiff = (left.estimatedStationPowerKw ?? Number.POSITIVE_INFINITY)
        - (right.estimatedStationPowerKw ?? Number.POSITIVE_INFINITY);
      if (powerDiff !== 0) {
        return powerDiff;
      }
      return right.sampleCount - left.sampleCount;
    });
  const targetCandidate = switchCandidates[0] || currentCandidate || candidates[0] || null;
  const recommendationAction = targetCandidate?.isCurrent ? "keep" : targetCandidate?.action || "keep";
  const historySampleTotal = historyRows.reduce((sum, row) => sum + parseNonNegativeInteger(row.sampleCount, 0), 0);
  const noSwitchReason =
    candidates.length <= 1
      ? "缺可比较的候选主机组合，保持当前组合。"
      : "未发现满足样本、容量余量和节能门槛的候选组合，保持当前组合。";
  const recommendation = {
    action: recommendationAction,
    targetCombination: targetCandidate?.combination || currentCombination,
    expectedTotalPowerDeltaKw: targetCandidate?.isCurrent ? 0 : targetCandidate?.expectedTotalPowerDeltaKw ?? null,
    expectedCopDelta:
      !targetCandidate || targetCandidate.isCurrent || targetCandidate.stationCop === null || stationCop === null
        ? targetCandidate?.isCurrent ? 0 : null
        : roundNullable(targetCandidate.stationCop - stationCop, 2),
    reason: targetCandidate && !targetCandidate.isCurrent
      ? "相近负荷和湿球工况下，目标组合历史冷站 COP/总功率表现更优，建议进入 shadow 验证。"
      : noSwitchReason
  };
  const savingsVerification = buildChillerStagingSavingsVerification();
  const evidence = buildChillerStagingEvidence({
    currentCombination,
    currentCandidate,
    targetCandidate,
    candidates,
    historyRows,
	    currentRunMinutes,
	    loadKw,
    loadSource: coolingLoad.source,
    loadBasis: coolingLoad.basis,
    requestLoadKw: coolingLoad.requestLoadKw,
	    requestedWetBulbC,
    baseline,
    sampleIntervalMinutes: getRuntimeSampleIntervalMinutes(config),
    capturedAt:
      context?.now instanceof Date
        ? context.now.toISOString()
        : normalizeOptionalText(context?.now)
  });
  const sampleGovernance = buildChillerStagingSampleGovernance({
    currentCombination,
    candidates,
    historyRows
  });

  const sampleWarnings = [
    ...(historySampleTotal > 0 && historySampleTotal < CHILLER_STAGING_MIN_SAMPLE_COUNT
      ? [`组合历史样本 ${historySampleTotal} 条，低于 ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条，继续采样后再比较组合表现。`]
      : []),
    ...(historyRows.length > 0 && !switchCandidates.length
      ? ["当前候选组合未同时满足样本数量、容量余量和切换收益门槛。"]
      : []),
    ...candidates
      .filter((candidate) => !candidate.isCurrent && candidate.sampleCount > 0 && candidate.sampleCount < CHILLER_STAGING_MIN_SAMPLE_COUNT)
      .map((candidate) => `${candidate.combination.join("+")} 样本 ${candidate.sampleCount} 条，低于 ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条。`)
      .slice(0, 3),
    ...(currentCombination.length > 1 ? ["多机并联无单机冷冻水流量，不计算单机实时 COP。"] : ["单机运行窗口可积累单机 COP 样本。"]),
    ...(gate?.level === "caution" ? [gate.reason || "当前门禁为谨慎评审。"] : []),
    ...(historyBenchmark?.confidence === "low" ? ["历史同工况基准置信度低，主机组合建议必须做 shadow 对比。"] : [])
  ];
  const blockers = dedupeSteps([
    ...requiredSignalBlockers,
    ...(historySampleTotal > 0 && historySampleTotal < CHILLER_STAGING_MIN_SAMPLE_COUNT
      ? [`组合历史样本 ${historySampleTotal} 条，低于 ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条，仅可继续采样审阅。`]
      : []),
    ...currentRunBlockers,
    ...gateBlockers,
    ...(recommendationAction !== "keep" ? targetCandidate?.blockers || [] : [])
  ]);
  const status =
    requiredSignalBlockers.length > 0
      ? "unavailable"
      : blockers.length > 0 || switchCandidates.length === 0
        ? "partial"
        : "ready";
  const executionReady = status === "ready" && recommendationAction !== "keep" && blockers.length === 0;
  const objective = buildChillerStagingObjective();
  const constraints = {
    minSampleCount: CHILLER_STAGING_MIN_SAMPLE_COUNT,
    highConfidenceSampleCount: CHILLER_STAGING_HIGH_CONFIDENCE_SAMPLE_COUNT,
    minCurrentRunMinutes: CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES,
    minCapacityReservePct: CHILLER_STAGING_MIN_RESERVE_PCT,
    loadRateTolerancePct: CHILLER_STAGING_LOAD_RATE_TOLERANCE_PCT,
    wetBulbToleranceC: CHILLER_STAGING_WET_BULB_TOLERANCE_C,
    chilledSupplyTempToleranceC: CHILLER_STAGING_CHWS_TOLERANCE_C,
    minSwitchSavingKw: CHILLER_STAGING_MIN_SAVE_KW,
    minSwitchSavingPct: CHILLER_STAGING_MIN_SAVE_PCT,
    antiChatter: "当前组合至少稳定运行 90 分钟；AI 只输出 shadow 建议，不直接启停主机。"
  };

  return {
    status,
    executionReady,
    dispatchReady: false,
    executionMode: executionReady ? "shadow" : "read_only",
    dispatchMode: "shadow",
    basis: "combination_empirical_performance",
    confidence: targetCandidate?.confidence || "low",
	    current: {
	      runningCombination: currentCombination,
	      runningCount: currentCombination.length,
	      combinationCapacityKw: currentCapacityKw,
	      systemCoolingLoadKw: loadKw,
      loadSource: coolingLoad.source,
      loadBasis: coolingLoad.basis,
      requestLoadKw: coolingLoad.requestLoadKw,
	      combinationPlrPct: currentCombinationPlrPct,
      chillerPowerTotalKw,
      stationPowerTotalKw,
      comboCop,
      stationCop,
      currentRunMinutes
    },
    recommendation,
    evidence,
    sampleEvidence: evidence,
    sampleGovernance,
    candidates: candidates
      .sort((left, right) => {
        if (left.isCurrent !== right.isCurrent) {
          return left.isCurrent ? -1 : 1;
        }
        return (left.estimatedStationPowerKw ?? Number.POSITIVE_INFINITY)
          - (right.estimatedStationPowerKw ?? Number.POSITIVE_INFINITY);
      })
      .slice(0, 5),
    reason: recommendation.reason,
    disclaimer: "无单台冷冻水流量时，多机运行只评价主机组合 COP/冷站 COP；AI 不输出单机实时 COP 排名，不直接启停主机。",
    guardrails: [
      {
        key: "noSingleMachineCopSplit",
        status: "ready",
        value: currentCombination.length > 1 ? "combo-only" : "single-window",
        message: currentCombination.length > 1
          ? "当前为多机并联，未接入单机冷冻水流量，禁止拆分单机 COP。"
          : "当前单机运行窗口可作为该机实测样本。"
      },
      {
        key: "capacityReserve",
        status:
          targetCandidate?.capacityReservePct !== null && targetCandidate?.capacityReservePct < CHILLER_STAGING_MIN_RESERVE_PCT
            ? "blocked"
            : targetCandidate?.capacityReservePct === null
              ? "missing"
              : "ready",
        value: targetCandidate?.capacityReservePct ?? null,
        message: `候选组合容量余量需不低于 ${CHILLER_STAGING_MIN_RESERVE_PCT}%。`
      },
      {
        key: "antiChatter",
        status: currentRunBlockers.length ? "blocked" : "ready",
        value: currentRunMinutes,
        message: `当前组合需稳定运行至少 ${CHILLER_STAGING_MIN_CURRENT_RUN_MINUTES} 分钟。`
      },
      {
        key: "executionBoundary",
        status: "ready",
        value: "shadow-only",
        message: "第一版只允许 shadow 建议和人工审批演示，禁止 enforced。"
      }
    ],
    inputSignals,
    blockers,
    warnings: dedupeSteps([
      ...sampleWarnings,
      ...(targetCandidate?.warnings || [])
    ]),
    objective,
    constraints,
    savingsVerification,
    advisorResult: {
      type: "chiller_staging_combination_advisor",
      status,
      lifecycleMode: executionReady ? "shadow" : "read_only",
      objective,
      constraints,
      inputSignals,
      execution: {
        approvalRequired: true,
        allowedToCreateExecution: executionReady,
        allowedToDispatch: false,
        dispatchMode: "shadow",
        controlPointMapped: false,
        rollbackMapped: false,
        enforcedAllowed: false
      },
      savingsVerification: {
        ...savingsVerification
      },
      blockers,
      warnings: dedupeSteps(sampleWarnings)
    }
  };
}

function readOperationalPointSummary(context) {
  const runtimeContext = readChillerStagingRuntimeContext(context);
  return runtimeContext?.pointSummary && typeof runtimeContext.pointSummary === "object"
    ? runtimeContext.pointSummary
    : null;
}

function readOperationalDiagnosticsHistoryWindow(context) {
  const candidates = [
    context?.operationalDiagnosticsHistoryWindow,
    context?.dashboardTrends,
    context?.trends
  ];
  return candidates.find((item) => item && typeof item === "object" && !Array.isArray(item)) || null;
}

function finiteNumberList(values) {
  return Array.isArray(values)
    ? values.filter((value) => typeof value === "number" && Number.isFinite(value))
    : [];
}

function averageRounded(values, digits = 1) {
  const finiteValues = finiteNumberList(values);
  if (!finiteValues.length) {
    return null;
  }
  return roundNullable(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length, digits);
}

function sumRounded(values, digits = 1) {
  const finiteValues = finiteNumberList(values);
  if (!finiteValues.length) {
    return null;
  }
  return roundNullable(finiteValues.reduce((sum, value) => sum + value, 0), digits);
}

function buildSpreadSummary(values, digits = 1) {
  const finiteValues = finiteNumberList(values).filter((value) => value > 0);
  if (finiteValues.length < 2) {
    return {
      count: finiteValues.length,
      min: finiteValues[0] ?? null,
      max: finiteValues[0] ?? null,
      ratio: null,
      range: null
    };
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  return {
    count: finiteValues.length,
    min: roundNullable(min, digits),
    max: roundNullable(max, digits),
    ratio: min > 0 ? roundNullable(max / min, 1) : null,
    range: roundNullable(max - min, digits)
  };
}

function buildDiagnosticEvidence(key, label, value, unit = null) {
  return {
    key,
    label,
    value: value ?? null,
    unit
  };
}

function normalizeDiagnosticItemStatus(hasInputs, blockers, warnings = []) {
  if (!hasInputs) {
    return "unavailable";
  }
  if (Array.isArray(blockers) && blockers.length > 0) {
    return "partial";
  }
  if (Array.isArray(warnings) && warnings.length > 0) {
    return "ready";
  }
  return "ready";
}

function confidenceFromPointCoverage(pointSummary, fallback = "low") {
  const registerPoints = asFiniteNumber(pointSummary?.counts?.registerPoints);
  if (registerPoints !== null && registerPoints >= 500) {
    return "high";
  }
  if (registerPoints !== null && registerPoints >= 120) {
    return "medium";
  }
  return fallback;
}

function normalizeTrendMetricKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pickTrendSeries(historyWindow, metricKeys) {
  const series = Array.isArray(historyWindow?.series) ? historyWindow.series : [];
  const wanted = new Set(metricKeys.map(normalizeTrendMetricKey));
  return series.find((item) => wanted.has(normalizeTrendMetricKey(item?.metric))) || null;
}

function normalizeTrendPoints(seriesItem) {
  const points = Array.isArray(seriesItem?.points) ? seriesItem.points : [];
  return points
    .map((point, index) => {
      const value = asFiniteNumber(point?.v ?? point?.value);
      if (value === null) {
        return null;
      }
      const timestampValue = point?.t ?? point?.timestamp ?? point?.time;
      const timestampMs = Date.parse(String(timestampValue || ""));
      return {
        value,
        timestamp: Number.isFinite(timestampMs) ? timestampMs : null,
        rawTimestamp: typeof timestampValue === "string" ? timestampValue : null,
        index
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.timestamp !== null && right.timestamp !== null) {
        return left.timestamp - right.timestamp;
      }
      return left.index - right.index;
    });
}

function summarizeTrendPointSpread(points) {
  const values = Array.isArray(points) ? points.map((point) => point.value).filter((value) => Number.isFinite(value)) : [];
  if (!values.length) {
    return {
      sampleCount: 0,
      min: null,
      max: null,
      mean: null,
      range: null,
      rangePct: null
    };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    sampleCount: values.length,
    min,
    max,
    mean,
    range: max - min,
    rangePct: mean !== 0 ? ((max - min) / Math.abs(mean)) * 100 : null
  };
}

function pickBestStableTrendWindow(points, options = {}) {
  const minimumSamples = options.minimumSamples ?? 4;
  const maxRangePct = options.maxRangePct ?? 12;
  let best = null;
  for (let start = 0; start < points.length; start += 1) {
    for (let end = start + minimumSamples - 1; end < points.length; end += 1) {
      const windowPoints = points.slice(start, end + 1);
      const spread = summarizeTrendPointSpread(windowPoints);
      if (spread.sampleCount < minimumSamples || spread.rangePct === null || spread.rangePct > maxRangePct) {
        continue;
      }
      const firstPoint = windowPoints[0];
      const lastPoint = windowPoints[windowPoints.length - 1];
      const durationHours =
        firstPoint.timestamp !== null && lastPoint.timestamp !== null && lastPoint.timestamp > firstPoint.timestamp
          ? (lastPoint.timestamp - firstPoint.timestamp) / 3600000
          : spread.sampleCount - 1;
      const candidate = {
        points: windowPoints,
        spread,
        startMs: firstPoint.timestamp,
        endMs: lastPoint.timestamp,
        startAt: firstPoint.rawTimestamp,
        endAt: lastPoint.rawTimestamp,
        durationHours
      };
      if (
        !best ||
        candidate.spread.sampleCount > best.spread.sampleCount ||
        (candidate.spread.sampleCount === best.spread.sampleCount && candidate.durationHours > best.durationHours) ||
        (
          candidate.spread.sampleCount === best.spread.sampleCount &&
          candidate.durationHours === best.durationHours &&
          candidate.spread.rangePct < best.spread.rangePct
        )
      ) {
        best = candidate;
      }
    }
  }
  return best;
}

function buildInstrumentSteadyStateWindow(historyWindow) {
  const loadSeries = pickTrendSeries(historyWindow, [
    "totalCoolingCapacity",
    "coolingLoadKw",
    "systemCoolingLoadKw",
    "totalCooling"
  ]);
  const powerSeries = pickTrendSeries(historyWindow, ["totalPowerKw", "powerKw", "totalPower"]);
  const basisSeries = loadSeries || powerSeries;
  const basisMetric = loadSeries ? "totalCoolingCapacity" : powerSeries ? "totalPowerKw" : null;
  const basisLabel = loadSeries ? "制冷量" : powerSeries ? "冷站总功率" : null;
  const minimumSamples = 4;
  const maxRangePct = 12;
  const points = normalizeTrendPoints(basisSeries);
  const fullSpread = summarizeTrendPointSpread(points);
  if (!basisSeries || points.length < minimumSamples) {
    return {
      status: "unavailable",
      basisMetric,
      basisLabel,
      sampleCount: points.length,
      totalSampleCount: points.length,
      thresholdRangePct: maxRangePct,
      fullRangePct: fullSpread.rangePct !== null ? roundNullable(fullSpread.rangePct, 1) : null,
      reason: "缺少可用于稳态判断的制冷量/总功率趋势样本。"
    };
  }

  const stableWindow = pickBestStableTrendWindow(points, {
    minimumSamples,
    maxRangePct
  });
  if (!stableWindow) {
    return {
      status: "unstable",
      basisMetric,
      basisLabel,
      sampleCount: 0,
      totalSampleCount: points.length,
      thresholdRangePct: maxRangePct,
      fullRangePct: fullSpread.rangePct !== null ? roundNullable(fullSpread.rangePct, 1) : null,
      reason: `${basisLabel} 24h 波动未形成满足 ${maxRangePct}% 阈值的稳态窗口。`
    };
  }

  return {
    status: "ready",
    basisMetric,
    basisLabel,
    sampleCount: stableWindow.spread.sampleCount,
    totalSampleCount: points.length,
    thresholdRangePct: maxRangePct,
    rangePct: roundNullable(stableWindow.spread.rangePct, 1),
    startAt: stableWindow.startAt,
    endAt: stableWindow.endAt,
    startMs: stableWindow.startMs,
    endMs: stableWindow.endMs,
    durationHours: roundNullable(stableWindow.durationHours, 1),
    reason: `${basisLabel} 稳态窗口样本 ${stableWindow.spread.sampleCount} 个，波动 ${roundNullable(stableWindow.spread.rangePct, 1)}%。`
  };
}

function buildTrendMetricDrift(seriesItem, metric, label, options = {}) {
  const digits = options.digits ?? 1;
  const allPoints = normalizeTrendPoints(seriesItem);
  const points =
    options.windowStartMs !== null &&
    options.windowStartMs !== undefined &&
    options.windowEndMs !== null &&
    options.windowEndMs !== undefined
      ? allPoints.filter(
          (point) =>
            point.timestamp !== null &&
            point.timestamp >= options.windowStartMs &&
            point.timestamp <= options.windowEndMs
        )
      : allPoints;
  const sampleCount = points.length;
  if (sampleCount === 0) {
    return {
      metric,
      label,
      status: "missing",
      sampleCount,
      totalSampleCount: allPoints.length,
      unit: options.unit || null
    };
  }

  const values = points.map((point) => point.value);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const first = firstPoint.value;
  const last = lastPoint.value;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const range = max - min;
  const drift = last - first;
  const durationHours =
    firstPoint.timestamp !== null && lastPoint.timestamp !== null && lastPoint.timestamp > firstPoint.timestamp
      ? (lastPoint.timestamp - firstPoint.timestamp) / 3600000
      : null;

  return {
    metric,
    label,
    status: sampleCount >= (options.minimumSamples ?? 6) ? "ready" : "insufficient",
    sampleCount,
    totalSampleCount: allPoints.length,
    unit: options.unit || null,
    windowBasis: options.windowBasis || "full_window",
    first: roundNullable(first, digits),
    last: roundNullable(last, digits),
    min: roundNullable(min, digits),
    max: roundNullable(max, digits),
    mean: roundNullable(mean, digits),
    range: roundNullable(range, digits),
    drift: roundNullable(drift, digits),
    driftPct: first !== 0 ? roundNullable((drift / Math.abs(first)) * 100, 1) : null,
    rangePct: mean !== 0 ? roundNullable((range / Math.abs(mean)) * 100, 1) : null,
    slopePerHour: durationHours !== null && durationHours > 0 ? roundNullable(drift / durationHours, digits + 1) : null,
    firstAt: firstPoint.rawTimestamp,
    lastAt: lastPoint.rawTimestamp,
    durationHours: durationHours !== null ? roundNullable(durationHours, 1) : null
  };
}

function buildInstrumentDriftWindow(historyWindow) {
  if (!historyWindow || typeof historyWindow !== "object" || Array.isArray(historyWindow)) {
    return {
      status: "unavailable",
      range: null,
      generatedAt: null,
      reason: "缺 24h 历史趋势窗口。",
      steadyState: {
        status: "unavailable",
        reason: "缺 24h 历史趋势窗口。"
      },
      metrics: []
    };
  }

  const steadyState = buildInstrumentSteadyStateWindow(historyWindow);
  const windowOptions =
    steadyState.status === "ready"
      ? {
          windowStartMs: steadyState.startMs,
          windowEndMs: steadyState.endMs,
          windowBasis: "steady_state_window"
        }
      : {
          windowBasis: "full_window_unstable"
        };
  const metricSpecs = [
    { metric: "currentCop", keys: ["currentCop", "cop"], label: "冷站COP", digits: 2 },
    { metric: "totalPowerKw", keys: ["totalPowerKw", "powerKw", "totalPower"], label: "冷站总功率", unit: "kW" },
    { metric: "chilledDeltaT", keys: ["chilledDeltaT", "chilledDt"], label: "冷冻水温差", unit: "℃" },
    { metric: "coolingDeltaT", keys: ["coolingDeltaT", "coolingDt"], label: "冷却水温差", unit: "℃" }
  ];
  const metrics = metricSpecs.map((spec) =>
    buildTrendMetricDrift(
      pickTrendSeries(historyWindow, spec.keys),
      spec.metric,
      spec.label,
      {
        digits: spec.digits ?? 1,
        unit: spec.unit || null,
        minimumSamples: 6,
        ...windowOptions
      }
    )
  );
  const readyCount = metrics.filter((item) => item.status === "ready").length;
  const observedCount = metrics.filter((item) => item.sampleCount > 0).length;
  const metricStatus =
    readyCount === metricSpecs.length
      ? "ready"
      : readyCount > 0 || observedCount > 0
        ? "partial"
        : "unavailable";
  const status = metricStatus === "ready" && steadyState.status !== "ready" ? "partial" : metricStatus;

  return {
    status,
    range: historyWindow.range || null,
    generatedAt: historyWindow.generatedAt || null,
    sourceOverall: historyWindow.sourceStatus?.overall || null,
    readyMetricCount: readyCount,
    observedMetricCount: observedCount,
    steadyState,
    metrics
  };
}

function pickDriftMetric(driftWindow, metric) {
  const metrics = Array.isArray(driftWindow?.metrics) ? driftWindow.metrics : [];
  return metrics.find((item) => item.metric === metric) || null;
}

function filterTrendPointsByWindow(points, steadyState) {
  if (
    steadyState?.status !== "ready" ||
    steadyState.startMs === null ||
    steadyState.startMs === undefined ||
    steadyState.endMs === null ||
    steadyState.endMs === undefined
  ) {
    return Array.isArray(points) ? points : [];
  }
  return (Array.isArray(points) ? points : []).filter(
    (point) =>
      point.timestamp !== null &&
      point.timestamp >= steadyState.startMs &&
      point.timestamp <= steadyState.endMs
  );
}

function summarizeThresholdTrend(points, threshold, digits = 1) {
  const values = (Array.isArray(points) ? points : [])
    .map((point) => point.value)
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    return {
      sampleCount: 0,
      belowCount: 0,
      belowPct: null,
      mean: null,
      min: null,
      max: null
    };
  }
  const belowCount = values.filter((value) => value < threshold).length;
  return {
    sampleCount: values.length,
    belowCount,
    belowPct: roundNullable((belowCount / values.length) * 100, 1),
    mean: roundNullable(values.reduce((sum, value) => sum + value, 0) / values.length, digits),
    min: roundNullable(Math.min(...values), digits),
    max: roundNullable(Math.max(...values), digits)
  };
}

function buildChilledHydraulicTrendWindow(historyWindow) {
  if (!historyWindow || typeof historyWindow !== "object" || Array.isArray(historyWindow)) {
    return {
      status: "unavailable",
      range: null,
      reason: "缺 24h 历史趋势窗口，不能判断低温差是否持续。",
      steadyState: {
        status: "unavailable",
        reason: "缺 24h 历史趋势窗口。"
      },
      chilledDeltaT: {
        sampleCount: 0,
        belowCount: 0,
        belowPct: null,
        mean: null,
        min: null,
        max: null
      },
      persistentLowDeltaT: false
    };
  }

  const steadyState = buildInstrumentSteadyStateWindow(historyWindow);
  const chilledDeltaSeries = pickTrendSeries(historyWindow, ["chilledDeltaT", "chilledDt"]);
  const chilledDeltaPoints = normalizeTrendPoints(chilledDeltaSeries);
  const selectedPoints =
    steadyState.status === "ready"
      ? filterTrendPointsByWindow(chilledDeltaPoints, steadyState)
      : chilledDeltaPoints;
  const chilledDeltaT = summarizeThresholdTrend(
    selectedPoints,
    CHILLED_DELTA_T_TARGET_BAND_C.low,
    1
  );
  const hasEnoughTrend = chilledDeltaT.sampleCount >= 4;
  const persistentLowDeltaT =
    hasEnoughTrend &&
    chilledDeltaT.mean !== null &&
    chilledDeltaT.mean < CHILLED_DELTA_T_TARGET_BAND_C.low &&
    chilledDeltaT.belowPct !== null &&
    chilledDeltaT.belowPct >= 60;
  const status =
    !hasEnoughTrend
      ? "unavailable"
      : steadyState.status === "ready"
        ? "ready"
        : "partial";

  return {
    status,
    range: historyWindow.range || null,
    generatedAt: historyWindow.generatedAt || null,
    reason:
      status === "ready"
        ? `稳态窗口内冷冻水温差均值 ${chilledDeltaT.mean}℃，低于目标下限占比 ${chilledDeltaT.belowPct}%。`
        : status === "partial"
          ? `${steadyState.reason || "负荷未形成稳态窗口"}，低温差趋势只能作为方向性审阅。`
          : "缺冷冻水温差趋势样本，不能判断低温差是否持续。",
    steadyState,
    chilledDeltaT,
    persistentLowDeltaT,
    evidenceBoundary: "当前 24h 趋势只覆盖冷冻水温差/总功率等站级指标；支路流量、压差、旁通阀仍使用实时快照，不伪造支路历史趋势。"
  };
}

function normalizeHydraulicRiskStatus(status) {
  return ["active", "watch", "normal", "gap", "unknown"].includes(status) ? status : "unknown";
}

function buildHydraulicRiskIndicators({
  trendWindow,
  chilledDeltaT,
  differentialPressureKpa,
  bypassValveOpenPct,
  branchFlowSpread,
  branchPressureSpread
}) {
  const persistentLowDeltaT = trendWindow?.persistentLowDeltaT === true;
  const trendReady = trendWindow?.status === "ready";
  const chilledDeltaLow = chilledDeltaT !== null && chilledDeltaT < CHILLED_DELTA_T_TARGET_BAND_C.low;
  const indicators = [
    {
      key: "persistent_low_delta_t",
      label: "低温差持续性",
      status: persistentLowDeltaT ? "active" : trendReady ? "normal" : "unknown",
      severity: persistentLowDeltaT ? "high" : trendReady ? "info" : "low",
      confidence: trendReady ? "medium" : "low",
      value: trendWindow?.chilledDeltaT?.belowPct ?? null,
      unit: "%",
      threshold: "稳态窗口低于目标下限占比 >= 60%",
      reason: persistentLowDeltaT
        ? `稳态窗口内低温差占比 ${trendWindow.chilledDeltaT?.belowPct ?? "--"}%，说明低温差不是瞬时扰动。`
        : trendReady
          ? "稳态窗口未证明低温差持续。"
          : "缺稳态趋势窗口，不能判断低温差是否持续。",
      evidence: [
        trendWindow?.reason || "",
        chilledDeltaLow ? `实时冷冻水温差 ${chilledDeltaT}℃ 低于 ${CHILLED_DELTA_T_TARGET_BAND_C.low}℃。` : ""
      ].filter(Boolean),
      requiredEvidence: ["24h 冷冻水温差趋势", "同负荷稳态窗口", "运行组合事件"],
      reviewTarget: "站级冷冻水温差趋势和负荷稳态窗口",
      boundary: "只说明低温差持续性，不自动降泵。"
    },
    {
      key: "branch_flow_imbalance",
      label: "支路流量离散",
      status:
        branchFlowSpread?.ratio !== null && branchFlowSpread?.ratio > 3
          ? "active"
          : branchFlowSpread?.count >= 2
            ? "watch"
            : "unknown",
      severity: branchFlowSpread?.ratio !== null && branchFlowSpread?.ratio > 3 ? "medium" : "low",
      confidence: branchFlowSpread?.count >= 3 ? "medium" : "low",
      value: branchFlowSpread?.ratio ?? null,
      unit: "ratio",
      threshold: "最大/最小流量比 > 3",
      reason:
        branchFlowSpread?.ratio !== null
          ? `实时支路流量最大/最小比 ${branchFlowSpread.ratio}。`
          : "缺可比对的支路流量点，不能判断支路流量离散。",
      evidence: [`支路流量样本数 ${branchFlowSpread?.count ?? 0}`],
      requiredEvidence: ["支路流量历史趋势", "支路与末端区域映射", "支路回水温度"],
      reviewTarget: "支路流量、支路供回水温度和末端区域映射",
      boundary: "实时支路差异只作为水力风险线索，不能外推为全天水力失衡。"
    },
    {
      key: "branch_pressure_spread",
      label: "支路压差离散",
      status:
        branchPressureSpread?.range !== null && branchPressureSpread?.range > 30
          ? "active"
          : branchPressureSpread?.count >= 2
            ? "watch"
            : "unknown",
      severity: branchPressureSpread?.range !== null && branchPressureSpread?.range > 30 ? "medium" : "low",
      confidence: branchPressureSpread?.count >= 3 ? "medium" : "low",
      value: branchPressureSpread?.range ?? null,
      unit: "kPa",
      threshold: "支路压力差范围 > 30 kPa",
      reason:
        branchPressureSpread?.range !== null
          ? `实时支路压力差范围 ${branchPressureSpread.range} kPa。`
          : "缺可比对的支路压力点，不能判断支路压差离散。",
      evidence: [
        `支路压力样本数 ${branchPressureSpread?.count ?? 0}`,
        differentialPressureKpa !== null ? `总管压差 ${differentialPressureKpa} kPa` : ""
      ].filter(Boolean),
      requiredEvidence: ["支路压差历史趋势", "远近端支路映射", "压差控制点位置"],
      reviewTarget: "远近端支路压差、总管压差和压差控制点",
      boundary: "只提示远近端压差分布需复核，不自动改压差设定。"
    },
    {
      key: "bypass_short_circuit",
      label: "旁通分流",
      status:
        bypassValveOpenPct === null
          ? "unknown"
          : bypassValveOpenPct > 5
            ? "active"
            : "normal",
      severity: bypassValveOpenPct !== null && bypassValveOpenPct > 5 ? "high" : "info",
      confidence: bypassValveOpenPct !== null ? "medium" : "low",
      value: bypassValveOpenPct,
      unit: "%",
      threshold: "旁通阀开度 > 5%",
      reason:
        bypassValveOpenPct !== null
          ? `冷冻旁通阀反馈开度 ${bypassValveOpenPct}%。`
          : "缺旁通阀开度反馈，不能判断旁通分流。",
      evidence: ["旁通阀开度实时快照"],
      requiredEvidence: ["旁通阀开度趋势", "旁通阀命令/反馈", "泵频变化窗口"],
      reviewTarget: "冷冻旁通阀命令、反馈和趋势",
      boundary: "只提示旁通分流风险，不直接判定阀门卡滞。"
    },
    {
      key: "terminal_safety_gap",
      label: "末端安全缺口",
      status: "gap",
      severity: persistentLowDeltaT || chilledDeltaLow ? "high" : "medium",
      confidence: "low",
      value: null,
      unit: null,
      threshold: "降泵前必须闭合末端阀位/室温/末端压差",
      reason: "缺末端阀位、室温和末端压差趋势，不能确认水力调整或降泵后末端仍安全。",
      evidence: ["当前仅有站级和支路实时线索"],
      requiredEvidence: ["代表房间温度", "末端阀位", "末端压差", "缺冷投诉/工单"],
      reviewTarget: "代表末端安全信号",
      boundary: "末端安全信号未闭合前，不允许 assisted/enforced，不自动降泵。"
    }
  ];

  return indicators.map((item) => ({
    ...item,
    status: normalizeHydraulicRiskStatus(item.status)
  }));
}

function buildHydraulicFieldReviewTargets(riskIndicators) {
  const targets = [];
  const addTarget = (target) => {
    if (!target?.key || targets.some((item) => item.key === target.key)) {
      return;
    }
    targets.push(target);
  };
  const byKey = new Map((Array.isArray(riskIndicators) ? riskIndicators : []).map((item) => [item.key, item]));
  const persistentLowDeltaT = byKey.get("persistent_low_delta_t");
  const branchFlow = byKey.get("branch_flow_imbalance");
  const branchPressure = byKey.get("branch_pressure_spread");
  const bypass = byKey.get("bypass_short_circuit");
  const terminalGap = byKey.get("terminal_safety_gap");

  if (terminalGap?.status === "gap") {
    addTarget({
      key: "terminal-safety-signal-closure",
      priority: "P0",
      title: "闭合末端安全信号",
      trigger: terminalGap.reason,
      requiredEvidence: terminalGap.requiredEvidence,
      acceptanceCriteria: "泵降频或水力调整建议前，可读取末端安全状态并能明确缺冷阻断条件。",
      boundary: terminalGap.boundary
    });
  }

  if (persistentLowDeltaT?.status === "active") {
    addTarget({
      key: "pump-delta-t-shadow-safety-review",
      priority: "P0",
      title: "复核低温差降泵 shadow 前置条件",
      trigger: persistentLowDeltaT.reason,
      requiredEvidence: ["末端安全信号", "旁通阀状态", "泵频反馈", "PLC 本地最小流量/频率保护"],
      acceptanceCriteria: "低温差持续、末端不缺冷、旁通状态明确且 PLC 本地保护闭合后，才允许提交 shadow 审阅。",
      boundary: "只允许 shadow 审阅，不自动降泵，不写 PLC。"
    });
  }

  if (["active", "watch", "unknown"].includes(branchFlow?.status) || ["active", "watch", "unknown"].includes(branchPressure?.status)) {
    addTarget({
      key: "branch-hydraulic-history-window",
      priority: branchFlow?.status === "active" || branchPressure?.status === "active" ? "P0" : "P1",
      title: "补支路水力历史趋势",
      trigger: [branchFlow?.reason, branchPressure?.reason].filter(Boolean).join("；"),
      requiredEvidence: ["24h 支路流量趋势", "24h 支路压差趋势", "支路供回水温度", "支路与末端区域映射"],
      acceptanceCriteria: "支路趋势至少覆盖 24h，并能与站级低温差稳态窗口对齐。",
      boundary: "不把单次实时差异外推为全天失衡，不直接判定末端阀门故障。"
    });
  }

  if (["active", "unknown"].includes(bypass?.status)) {
    addTarget({
      key: "bypass-valve-position-review",
      priority: bypass?.status === "active" ? "P0" : "P1",
      title: "复核冷冻旁通阀状态",
      trigger: bypass.reason,
      requiredEvidence: ["旁通阀命令值", "旁通阀反馈值", "旁通阀趋势", "阀门控制模式"],
      acceptanceCriteria: "旁通阀命令/反馈/趋势闭合后，再判断是否存在旁通分流或执行器异常。",
      boundary: "只做旁通状态复核，不直接判定阀门卡滞。"
    });
  }

  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  return targets.sort((left, right) => {
    const priorityDelta = (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function normalizeOscillationRiskStatus(status) {
  return ["active", "watch", "normal", "gap", "unknown"].includes(status) ? status : "unknown";
}

function countTrendDirectionChanges(points, deadband = 0) {
  const values = Array.isArray(points) ? points.map((point) => point.value).filter((value) => Number.isFinite(value)) : [];
  let lastSign = 0;
  let directionChangeCount = 0;
  let meaningfulDeltaCount = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (Math.abs(delta) <= deadband) {
      continue;
    }
    const sign = delta > 0 ? 1 : -1;
    meaningfulDeltaCount += 1;
    if (lastSign !== 0 && sign !== lastSign) {
      directionChangeCount += 1;
    }
    lastSign = sign;
  }
  return {
    meaningfulDeltaCount,
    directionChangeCount
  };
}

function buildOscillationTrendSignal(historyWindow, spec) {
  const seriesItem = pickTrendSeries(historyWindow, spec.keys);
  const points = normalizeTrendPoints(seriesItem);
  const spread = summarizeTrendPointSpread(points);
  const direction = countTrendDirectionChanges(points, spec.deadband ?? 0);
  const sampleCount = spread.sampleCount || 0;
  const hasEnoughSamples = sampleCount >= (spec.minimumSamples ?? 4);
  const range = spread.range !== null ? roundNullable(spread.range, spec.digits ?? 1) : null;
  const rangePct = spread.rangePct !== null ? roundNullable(spread.rangePct, 1) : null;
  const minRange = spec.activeRange ?? null;
  const minRangePct = spec.activeRangePct ?? null;
  const activeByRange =
    (minRange !== null && spread.range !== null && spread.range >= minRange) ||
    (minRangePct !== null && spread.rangePct !== null && spread.rangePct >= minRangePct);
  const watchByRange =
    (spec.watchRange !== null && spec.watchRange !== undefined && spread.range !== null && spread.range >= spec.watchRange) ||
    (spec.watchRangePct !== null && spec.watchRangePct !== undefined && spread.rangePct !== null && spread.rangePct >= spec.watchRangePct);
  const active =
    hasEnoughSamples &&
    direction.directionChangeCount >= (spec.activeDirectionChanges ?? 3) &&
    activeByRange;
  const watch =
    hasEnoughSamples &&
    !active &&
    (
      direction.directionChangeCount >= (spec.watchDirectionChanges ?? 2) ||
      watchByRange
    );

  const status = !hasEnoughSamples ? "gap" : active ? "active" : watch ? "watch" : "normal";
  const reason =
    status === "active"
      ? `${spec.label}在趋势窗口内方向反转 ${direction.directionChangeCount} 次，波动 ${range ?? "--"}${spec.unit || ""}${rangePct !== null ? ` / ${rangePct}%` : ""}。`
      : status === "watch"
        ? `${spec.label}存在波动线索，方向反转 ${direction.directionChangeCount} 次，需结合控制命令/反馈复核。`
        : status === "normal"
          ? `${spec.label}当前趋势未触发锯齿波或 hunting 阈值。`
          : `缺 ${spec.label} 有效趋势样本，不能判断控制震荡。`;

  return {
    metric: spec.metric,
    label: spec.label,
    status,
    sampleCount,
    meaningfulDeltaCount: direction.meaningfulDeltaCount,
    directionChangeCount: direction.directionChangeCount,
    min: spread.min !== null ? roundNullable(spread.min, spec.digits ?? 1) : null,
    max: spread.max !== null ? roundNullable(spread.max, spec.digits ?? 1) : null,
    mean: spread.mean !== null ? roundNullable(spread.mean, spec.digits ?? 1) : null,
    range,
    rangePct,
    unit: spec.unit || null,
    threshold: spec.threshold,
    reason
  };
}

function normalizeControlLedgerTable(table) {
  if (!table || typeof table !== "object") {
    return null;
  }
  const blockers = Array.isArray(table.blockers) ? table.blockers.filter(Boolean) : [];
  const warnings = Array.isArray(table.warnings) ? table.warnings.filter(Boolean) : [];
  const rowCount = asFiniteNumber(table.rowCount) ?? 0;
  const acceptedRowCount = asFiniteNumber(table.acceptedRowCount) ?? 0;
  const inputMode = normalizeOptionalText(table.inputMode) || "unknown";
  const status =
    blockers.length > 0
      ? "blocked"
      : inputMode === "field_export" && acceptedRowCount > 0
        ? "ready"
        : acceptedRowCount > 0
          ? "partial"
          : "missing";
  return {
    key: normalizeOptionalText(table.key),
    title: normalizeOptionalText(table.title),
    status,
    inputMode,
    inputPath: normalizeOptionalText(table.inputPath),
    outputPath: normalizeOptionalText(table.outputPath),
    rowCount,
    acceptedRowCount,
    blockers,
    warnings
  };
}

function normalizeControlLedgerImportEvidence(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      status: "unavailable",
      importStatus: "CONTROL_LEDGER_IMPORT_UNAVAILABLE",
      evidenceMode: "missing",
      usableForDiagnosis: false,
      generatedAt: null,
      reportPath: null,
      totalRows: 0,
      acceptedRows: 0,
      blockersCount: 0,
      warningsCount: 0,
      tables: [],
      tableStatus: {},
      blockers: [],
      warnings: ["未接入控制震荡台账导入报告。"]
    };
  }

  const tables = (Array.isArray(report.tables) ? report.tables : [])
    .map(normalizeControlLedgerTable)
    .filter(Boolean);
  const tableStatus = Object.fromEntries(tables.map((table) => [table.key, table]));
  const blockers = dedupeSteps([
    ...(Array.isArray(report.blockers) ? report.blockers : []),
    ...tables.flatMap((table) => table.blockers.map((item) => `${table.title || table.key}: ${item}`))
  ]);
  const warnings = dedupeSteps([
    ...(Array.isArray(report.warnings) ? report.warnings : []),
    ...tables.flatMap((table) => table.warnings.map((item) => `${table.title || table.key}: ${item}`))
  ]);
  const importStatus = normalizeOptionalText(report.status) || "CONTROL_LEDGER_IMPORT_UNAVAILABLE";
  const hasTemplateSample = tables.some((table) => table.inputMode === "template_sample");
  const hasFieldExport = tables.some((table) => table.inputMode === "field_export");
  const requiredKeys = ["control_command_feedback_trend", "start_stop_event_ledger", "control_parameter_ledger"];
  const requiredTablesReady = requiredKeys.every((key) => tableStatus[key]?.status === "ready");
  const acceptedRows = asFiniteNumber(report.summary?.acceptedRows) ?? tables.reduce((sum, table) => sum + table.acceptedRowCount, 0);
  const totalRows = asFiniteNumber(report.summary?.totalRows) ?? tables.reduce((sum, table) => sum + table.rowCount, 0);
  const status =
    blockers.length > 0 || importStatus === "CONTROL_LEDGER_IMPORT_BLOCKED"
      ? "blocked"
      : importStatus === "CONTROL_LEDGER_IMPORT_READY" && requiredTablesReady
        ? "ready"
        : acceptedRows > 0
          ? "partial"
          : "unavailable";
  const usableForDiagnosis =
    status === "ready" &&
    requiredTablesReady &&
    hasFieldExport &&
    !hasTemplateSample &&
    acceptedRows > 0;

  return {
    status,
    importStatus,
    evidenceMode: hasTemplateSample ? "template_sample" : hasFieldExport ? "field_export" : "missing",
    usableForDiagnosis,
    generatedAt: report.generatedAt || null,
    reportPath: normalizeOptionalText(report.sourceFile) || normalizeOptionalText(report.outputs?.json) || null,
    totalRows,
    acceptedRows,
    blockersCount: blockers.length,
    warningsCount: warnings.length,
    tables,
    tableStatus,
    blockers,
    warnings,
    controlBoundary:
      normalizeOptionalText(report.controlBoundary) ||
      "控制台账只用于诊断证据，不自动改 PID，不自动启停设备，不写真实 PLC。"
  };
}

function readControlLedgerImportEvidence(context) {
  return normalizeControlLedgerImportEvidence(
    context?.controlLedgerImportReport ||
      context?.controlOscillationLedgerImportReport ||
      context?.controlLedgerEvidence ||
      null
  );
}

function normalizeFieldDataPreflightEvidence(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      status: "unavailable",
      finalDecision: "FIELD_DATA_PREFLIGHT_UNAVAILABLE",
      readyForImport: false,
      generatedAt: null,
      reportPath: null,
      acceptedRows: 0,
      totalRows: 0,
      blockersCount: 0,
      warningsCount: 0,
      inputCount: 0,
      missingInputCount: 0,
      inputs: [],
      blockers: [],
      warnings: ["未接入现场 CSV 预检报告。"],
      controlBoundary: "现场 CSV 预检只校验文件、字段和格式，不自动改 PID，不自动启停设备，不写真实 PLC。"
    };
  }

  const finalDecision = normalizeOptionalText(report.finalDecision) || "FIELD_DATA_PREFLIGHT_UNAVAILABLE";
  const inputs = (Array.isArray(report.inputs) ? report.inputs : []).map((input) => ({
    key: normalizeOptionalText(input.key),
    title: normalizeOptionalText(input.title) || normalizeOptionalText(input.key),
    path: normalizeOptionalText(input.path),
    exists: input.exists === true,
    mode: normalizeOptionalText(input.mode) || "unknown",
    requiredForReady: input.requiredForReady === true
  }));
  const missingInputCount = inputs.filter((input) => input.requiredForReady && input.exists !== true).length;
  const blockers = dedupeSteps(Array.isArray(report.blockers) ? report.blockers : []);
  const warnings = dedupeSteps(Array.isArray(report.warnings) ? report.warnings : []);
  const importSummary = report.import && typeof report.import === "object" ? report.import : {};
  const status =
    finalDecision === "FIELD_DATA_PREFLIGHT_READY"
      ? "ready"
      : finalDecision === "FIELD_DATA_PREFLIGHT_PARTIAL"
        ? "partial"
        : finalDecision === "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS"
          ? "waiting"
          : finalDecision === "FIELD_DATA_PREFLIGHT_BLOCKED"
            ? "blocked"
            : "unavailable";

  return {
    status,
    finalDecision,
    readyForImport: status === "ready",
    generatedAt: report.generatedAt || null,
    reportPath: normalizeOptionalText(report.sourceFile) || normalizeOptionalText(report.reportFiles?.json) || null,
    acceptedRows: asFiniteNumber(importSummary.acceptedRows) || 0,
    totalRows: asFiniteNumber(importSummary.totalRows) || 0,
    blockersCount: asFiniteNumber(importSummary.blockersCount) ?? blockers.length,
    warningsCount: asFiniteNumber(importSummary.warningsCount) ?? warnings.length,
    inputCount: inputs.length,
    missingInputCount,
    inputs,
    blockers,
    warnings,
    importStatus: normalizeOptionalText(importSummary.status) || "CONTROL_LEDGER_IMPORT_UNAVAILABLE",
    controlBoundary:
      normalizeOptionalText(report.controlBoundary) ||
      "现场 CSV 预检只校验文件、字段和格式，不自动改 PID，不自动启停设备，不写真实 PLC。"
  };
}

function readFieldDataPreflightEvidence(context) {
  return normalizeFieldDataPreflightEvidence(
    context?.fieldDataPreflightReport ||
      context?.controlLedgerFieldDataPreflightReport ||
      context?.fieldDataPreflightEvidence ||
      null
  );
}

function normalizeFieldDataPromoteEvidence(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      status: "unavailable",
      finalDecision: "FIELD_DATA_PROMOTE_UNAVAILABLE",
      formalImportReady: false,
      generatedAt: null,
      reportPath: null,
      acceptedRows: 0,
      totalRows: 0,
      blockersCount: 0,
      warningsCount: 0,
      importStatus: "CONTROL_LEDGER_IMPORT_UNAVAILABLE",
      preflightDecision: null,
      blockers: [],
      warnings: ["未接入现场 CSV 正式导入 gate 报告。"],
      controlBoundary: "正式导入 gate 只记录台账导入状态，不自动改 PID，不自动启停设备，不写真实 PLC。"
    };
  }

  const finalDecision = normalizeOptionalText(report.finalDecision) || "FIELD_DATA_PROMOTE_UNAVAILABLE";
  const importSummary = report.import && typeof report.import === "object" ? report.import : {};
  const blockers = dedupeSteps(Array.isArray(report.blockers) ? report.blockers : []);
  const warnings = dedupeSteps(Array.isArray(report.warnings) ? report.warnings : []);
  const status =
    finalDecision === "FIELD_DATA_PROMOTE_READY"
      ? "ready"
      : finalDecision === "FIELD_DATA_PROMOTE_PARTIAL"
        ? "partial"
        : finalDecision === "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT"
          ? "waiting"
          : finalDecision === "FIELD_DATA_PROMOTE_BLOCKED"
            ? "blocked"
            : "unavailable";

  return {
    status,
    finalDecision,
    formalImportReady: status === "ready",
    generatedAt: report.generatedAt || null,
    reportPath: normalizeOptionalText(report.sourceFile) || normalizeOptionalText(report.reportFiles?.json) || null,
    acceptedRows: asFiniteNumber(importSummary.acceptedRows) || 0,
    totalRows: asFiniteNumber(importSummary.totalRows) || 0,
    blockersCount: asFiniteNumber(importSummary.blockersCount) ?? blockers.length,
    warningsCount: asFiniteNumber(importSummary.warningsCount) ?? warnings.length,
    importStatus: normalizeOptionalText(importSummary.status) || "CONTROL_LEDGER_IMPORT_UNAVAILABLE",
    preflightDecision: normalizeOptionalText(report.preflight?.finalDecision),
    blockers,
    warnings,
    controlBoundary:
      normalizeOptionalText(report.controlBoundary) ||
      "正式导入 gate 只记录台账导入状态，不自动改 PID，不自动启停设备，不写真实 PLC。"
  };
}

function readFieldDataPromoteEvidence(context) {
  return normalizeFieldDataPromoteEvidence(
    context?.fieldDataPromoteReport ||
      context?.controlLedgerFieldDataPromoteReport ||
      context?.fieldDataPromoteEvidence ||
      null
  );
}

function normalizeSensorLedgerPreflightEvidence(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      status: "unavailable",
      finalDecision: "SENSOR_LEDGER_PREFLIGHT_UNAVAILABLE",
      readyForReview: false,
      generatedAt: null,
      reportPath: null,
      acceptedRows: 0,
      totalRows: 0,
      blockersCount: 0,
      warningsCount: 0,
      missingInputCount: 0,
      expiredCalibrationCount: 0,
      missingRangeCount: 0,
      inputs: [],
      blockers: [],
      warnings: ["未接入传感器校准/安装位置台账预检报告。"],
      controlBoundary: "传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。"
    };
  }

  const finalDecision = normalizeOptionalText(report.finalDecision) || "SENSOR_LEDGER_PREFLIGHT_UNAVAILABLE";
  const inputs = (Array.isArray(report.inputs) ? report.inputs : [])
    .map((input) => ({
      key: normalizeOptionalText(input.key),
      title: normalizeOptionalText(input.title) || normalizeOptionalText(input.key),
      path: normalizeOptionalText(input.path),
      exists: input.exists === true,
      mode: normalizeOptionalText(input.mode) || "unknown",
      requiredForReady: input.requiredForReady === true
    }))
    .filter((input) => input.key || input.title);
  const missingInputCount = inputs.filter((input) => input.requiredForReady && input.exists !== true).length;
  const blockers = dedupeSteps(Array.isArray(report.blockers) ? report.blockers : []);
  const warnings = dedupeSteps(Array.isArray(report.warnings) ? report.warnings : []);
  const summary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const status =
    finalDecision === "SENSOR_LEDGER_PREFLIGHT_READY"
      ? "ready"
      : finalDecision === "SENSOR_LEDGER_PREFLIGHT_PARTIAL"
        ? "partial"
        : finalDecision === "SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS"
          ? "waiting"
          : finalDecision === "SENSOR_LEDGER_PREFLIGHT_BLOCKED"
            ? "blocked"
            : "unavailable";

  return {
    status,
    finalDecision,
    readyForReview: status === "ready",
    generatedAt: report.generatedAt || null,
    reportPath: normalizeOptionalText(report.sourceFile) || normalizeOptionalText(report.reportFiles?.json) || null,
    acceptedRows: asFiniteNumber(summary.acceptedRows) || 0,
    totalRows: asFiniteNumber(summary.totalRows) || 0,
    blockersCount: asFiniteNumber(summary.blockersCount) ?? blockers.length,
    warningsCount: asFiniteNumber(summary.warningsCount) ?? warnings.length,
    missingInputCount,
    expiredCalibrationCount: asFiniteNumber(summary.expiredCalibrationCount) || 0,
    missingRangeCount: asFiniteNumber(summary.missingRangeCount) || 0,
    sensorTypeCount: asFiniteNumber(summary.sensorTypeCount) || 0,
    pointCodeCount: asFiniteNumber(summary.pointCodeCount) || 0,
    inputs,
    normalizedOutput: normalizeOptionalText(report.normalizedOutput) || null,
    blockers,
    warnings,
    controlBoundary:
      normalizeOptionalText(report.controlBoundary) ||
      "传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。"
  };
}

function readSensorLedgerPreflightEvidence(context) {
  return normalizeSensorLedgerPreflightEvidence(
    context?.sensorLedgerPreflightReport ||
      context?.sensorCalibrationInstallationLedgerReport ||
      context?.sensorLedgerEvidence ||
      null
  );
}

function normalizeFieldCollectionPackageEvidence(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      status: "unavailable",
      finalDecision: "FIELD_COLLECTION_PACKAGE_UNAVAILABLE",
      readyToCollect: false,
      generatedAt: null,
      reportPath: null,
      formalInputCount: 0,
      missingFormalInputCount: 0,
      presentFormalInputCount: 0,
      templateCount: 0,
      blockersCount: 0,
      warningsCount: 0,
      formalInputs: [],
      blockers: [],
      warnings: ["未接入现场采集包 readiness 报告。"],
      controlBoundary: "现场采集包 readiness 只校验说明、模板、正式输入位置和边界；不写 PLC、不创建 shadow 单、不判断真实节能。"
    };
  }

  const finalDecision = normalizeOptionalText(report.finalDecision) || "FIELD_COLLECTION_PACKAGE_UNAVAILABLE";
  const formalInputs = (Array.isArray(report.formalInputs) ? report.formalInputs : [])
    .map((input) => ({
      key: normalizeOptionalText(input.key),
      label: normalizeOptionalText(input.label) || normalizeOptionalText(input.key),
      path: normalizeOptionalText(input.path),
      status: normalizeOptionalText(input.status) || "unknown",
      lineCount: asFiniteNumber(input.lineCount) || 0
    }))
    .filter((input) => input.key || input.label);
  const blockers = dedupeSteps(Array.isArray(report.blockers) ? report.blockers : []);
  const warnings = dedupeSteps(Array.isArray(report.warnings) ? report.warnings : []);
  const status =
    finalDecision === "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT"
      ? "ready_to_collect"
      : finalDecision === "FIELD_COLLECTION_PACKAGE_BLOCKED"
        ? "blocked"
        : "unavailable";
  const presentFormalInputCount = formalInputs.filter((input) => input.status === "present_with_rows").length;
  const missingFormalInputCount = formalInputs.filter((input) => input.status === "missing").length;

  return {
    status,
    finalDecision,
    readyToCollect: status === "ready_to_collect",
    generatedAt: report.generatedAt || null,
    reportPath: normalizeOptionalText(report.sourceFile) || normalizeOptionalText(report.reportFiles?.json) || null,
    formalInputCount: formalInputs.length,
    missingFormalInputCount,
    presentFormalInputCount,
    templateCount: Array.isArray(report.templates) ? report.templates.length : 0,
    blockersCount: blockers.length,
    warningsCount: warnings.length,
    formalInputs,
    blockers,
    warnings,
    controlBoundary:
      normalizeOptionalText(report.controlBoundary) ||
      "现场采集包 readiness 只校验说明、模板、正式输入位置和边界；不写 PLC、不创建 shadow 单、不判断真实节能。"
  };
}

function readFieldCollectionPackageEvidence(context) {
  return normalizeFieldCollectionPackageEvidence(
    context?.fieldCollectionPackageReport ||
      context?.fieldCollectionPackageEvidence ||
      context?.fieldDataCollectionPackageReport ||
      null
  );
}

function buildControlOscillationRiskIndicators({ historyWindow, pointSummary, ledgerEvidence }) {
  const chilledDeltaSignal = buildOscillationTrendSignal(historyWindow, {
    metric: "chilledDeltaT",
    keys: ["chilledDeltaT", "chilledDt"],
    label: "冷冻水温差锯齿波",
    unit: "℃",
    deadband: 0.15,
    activeRange: 0.6,
    watchRange: 0.4,
    activeDirectionChanges: 3,
    watchDirectionChanges: 2,
    threshold: "方向反转 >= 3 且波动 >= 0.6℃"
  });
  const coolingDeltaSignal = buildOscillationTrendSignal(historyWindow, {
    metric: "coolingDeltaT",
    keys: ["coolingDeltaT", "coolingDt"],
    label: "冷却水温差锯齿波",
    unit: "℃",
    deadband: 0.15,
    activeRange: 0.6,
    watchRange: 0.4,
    activeDirectionChanges: 3,
    watchDirectionChanges: 2,
    threshold: "方向反转 >= 3 且波动 >= 0.6℃"
  });
  const powerSignal = buildOscillationTrendSignal(historyWindow, {
    metric: "totalPowerKw",
    keys: ["totalPowerKw", "powerKw", "totalPower"],
    label: "冷站总功率 hunting",
    unit: "kW",
    deadband: 15,
    activeRange: 120,
    activeRangePct: 6,
    watchRange: 80,
    watchRangePct: 4,
    activeDirectionChanges: 3,
    watchDirectionChanges: 2,
    threshold: "方向反转 >= 3 且波动 >= 120kW 或 >= 6%"
  });
  const pumpFrequency = pointSummary?.keySignals?.pumpFrequency || {};
  const towerFrequency = pointSummary?.keySignals?.towerFrequency || {};
  const hasFrequencySnapshot =
    asFiniteNumber(pumpFrequency.chilledAvgHz) !== null ||
    asFiniteNumber(pumpFrequency.coolingAvgHz) !== null ||
    asFiniteNumber(towerFrequency.avgHz) !== null;
  const commandFeedbackTable = ledgerEvidence?.tableStatus?.control_command_feedback_trend || null;
  const startStopTable = ledgerEvidence?.tableStatus?.start_stop_event_ledger || null;
  const commandFeedbackReady = ledgerEvidence?.usableForDiagnosis === true && commandFeedbackTable?.status === "ready";
  const startStopReady = ledgerEvidence?.usableForDiagnosis === true && startStopTable?.status === "ready";

  const trendIndicator = (signal, options = {}) => ({
    key: options.key,
    label: signal.label,
    status: normalizeOscillationRiskStatus(signal.status),
    severity: signal.status === "active" ? options.activeSeverity || "medium" : signal.status === "gap" ? "medium" : "low",
    confidence: signal.status === "gap" ? "low" : "medium",
    value: signal.directionChangeCount,
    unit: "次",
    threshold: signal.threshold,
    reason: signal.reason,
    evidence: [
      `样本 ${signal.sampleCount} 个`,
      signal.range !== null ? `波动 ${signal.range}${signal.unit || ""}` : "",
      signal.rangePct !== null ? `波动率 ${signal.rangePct}%` : ""
    ].filter(Boolean),
    requiredEvidence: options.requiredEvidence,
    reviewTarget: options.reviewTarget,
    boundary: options.boundary,
    metric: signal.metric,
    sampleCount: signal.sampleCount,
    range: signal.range,
    rangePct: signal.rangePct,
    directionChangeCount: signal.directionChangeCount
  });

  return [
    trendIndicator(chilledDeltaSignal, {
      key: "chilled_delta_t_sawtooth",
      activeSeverity: "high",
      requiredEvidence: ["冷冻供回水温度高频趋势", "冷冻泵频率命令/反馈", "供水温设定值", "旁通阀命令/反馈"],
      reviewTarget: "冷冻水温差、冷冻泵频率和供水温控制回路",
      boundary: "只提示温差锯齿波风险，不自动改 PID、不自动降泵。"
    }),
    trendIndicator(coolingDeltaSignal, {
      key: "cooling_delta_t_sawtooth",
      requiredEvidence: ["冷却供回水温度高频趋势", "冷却泵频率命令/反馈", "塔风机频率命令/反馈", "冷却水温设定值"],
      reviewTarget: "冷却水温差、冷却泵和冷却塔控制回路",
      boundary: "只提示冷却侧震荡风险，不自动改塔风机或冷却泵控制参数。"
    }),
    trendIndicator(powerSignal, {
      key: "station_power_hunting",
      activeSeverity: "medium",
      requiredEvidence: ["冷站总功率高频趋势", "主机/泵/塔启停状态", "频率命令/反馈", "运行组合事件"],
      reviewTarget: "冷站功率 hunting 与设备状态切换",
      boundary: "只提示功率 hunting 风险，不自动切换设备组合。"
    }),
    {
      key: "frequency_command_feedback_gap",
      label: "泵塔频率命令/反馈缺口",
      status: commandFeedbackReady ? "watch" : "gap",
      severity: "medium",
      confidence: commandFeedbackReady ? "medium" : "low",
      value: commandFeedbackReady ? commandFeedbackTable.acceptedRowCount : null,
      unit: commandFeedbackReady ? "行" : null,
      threshold: "需高频命令值、反馈值和控制模式同步记录",
      reason: commandFeedbackReady
        ? `已导入 ${commandFeedbackTable.acceptedRowCount} 行现场命令/反馈高频台账，可用于下一步证据窗口复核；V1 仍不直接判定 PID 参数错误。`
        : hasFrequencySnapshot
          ? "当前只有泵/塔频率实时摘要，缺高频命令/反馈历史，不能判断 PID hunting 或执行器跟随问题。"
          : "缺泵/塔频率命令和反馈历史，不能判断控制回路震荡。",
      evidence: [
        commandFeedbackReady ? `命令/反馈台账 ${commandFeedbackTable.acceptedRowCount} 行` : "",
        asFiniteNumber(pumpFrequency.chilledAvgHz) !== null ? `冷冻泵均频 ${pumpFrequency.chilledAvgHz}Hz` : "",
        asFiniteNumber(pumpFrequency.coolingAvgHz) !== null ? `冷却泵均频 ${pumpFrequency.coolingAvgHz}Hz` : "",
        asFiniteNumber(towerFrequency.avgHz) !== null ? `塔风机均频 ${towerFrequency.avgHz}Hz` : ""
      ].filter(Boolean),
      requiredEvidence: ["泵频命令", "泵频反馈", "塔频命令", "塔频反馈", "控制模式"],
      reviewTarget: "泵塔频率命令/反馈高频趋势",
      boundary: "缺命令/反馈闭合前，不判定 PID 参数错误，不自动改 PID。"
    },
    {
      key: "start_stop_event_gap",
      label: "频繁启停事件缺口",
      status: startStopReady ? "watch" : "gap",
      severity: "medium",
      confidence: startStopReady ? "medium" : "low",
      value: startStopReady ? startStopTable.acceptedRowCount : null,
      unit: startStopReady ? "行" : null,
      threshold: "需精确启停事件、最小运行时间和启停延时",
      reason: startStopReady
        ? `已导入 ${startStopTable.acceptedRowCount} 行现场启停事件台账，可用于最小运行/停机时间复核；V1 不自动启停设备。`
        : "当前缺主机/泵/塔精确启停事件和最小运行时间，不能判断频繁启停。",
      evidence: startStopReady
        ? [`启停事件台账 ${startStopTable.acceptedRowCount} 行`]
        : ["仅可从实时运行状态看到当前开停，缺事件序列。"],
      requiredEvidence: ["主机启停事件", "泵启停事件", "塔风机启停事件", "最小运行/停止时间", "加减机延时参数"],
      reviewTarget: "设备启停事件台账和防频繁启停参数",
      boundary: "只提示启停事件缺口，不自动启停设备，不自动修改加减机延时。"
    }
  ].map((item) => ({
    ...item,
    status: normalizeOscillationRiskStatus(item.status)
  }));
}

function buildControlOscillationFieldReviewTargets(riskIndicators) {
  const targets = [];
  const addTarget = (target) => {
    if (!target?.key || targets.some((item) => item.key === target.key)) {
      return;
    }
    targets.push(target);
  };
  const indicators = Array.isArray(riskIndicators) ? riskIndicators : [];
  const hasTrendRisk = indicators.some((item) => item.status === "active" || item.status === "watch");
  const hasFrequencyGap = indicators.some((item) => item.key === "frequency_command_feedback_gap");
  const hasStartStopGap = indicators.some((item) => item.key === "start_stop_event_gap");

  if (hasTrendRisk || hasFrequencyGap) {
    addTarget({
      key: "control-command-feedback-history-window",
      priority: hasTrendRisk ? "P0" : "P1",
      title: "补控制命令/反馈高频趋势",
      trigger: hasTrendRisk ? "温差或功率趋势存在锯齿波/hunting 线索。" : "缺频率命令/反馈高频历史。",
      requiredEvidence: ["供水温设定/反馈", "泵频命令/反馈", "塔频命令/反馈", "旁通阀命令/反馈", "控制模式"],
      acceptanceCriteria: "命令、反馈、运行状态和采样周期可对齐，能区分负荷扰动、执行器跟随和 PID hunting。",
      boundary: "只用于复核控制震荡风险，不自动改 PID，不自动写 PLC。"
    });
  }

  if (hasStartStopGap) {
    addTarget({
      key: "start-stop-event-ledger",
      priority: "P1",
      title: "补设备启停事件与最小运行时间台账",
      trigger: "缺精确启停事件时不能判断频繁启停。",
      requiredEvidence: ["主机启停时间", "泵启停时间", "塔风机启停时间", "最小运行时间", "加减机/加减塔延时"],
      acceptanceCriteria: "可统计启停次数、最短运行/停机时间，并能与告警和负荷窗口对齐。",
      boundary: "只输出防频繁启停风险，不自动启停设备。"
    });
  }

  addTarget({
    key: "pid-deadband-delay-parameter-ledger",
    priority: "P1",
    title: "补 PID、死区和延时参数台账",
    trigger: "判断控制震荡需要知道 PID、死区、斜率限制和启停延时配置。",
    requiredEvidence: ["PID 参数", "控制死区", "斜率限制", "加减设备延时", "手自动模式"],
    acceptanceCriteria: "形成可审阅参数台账，变更前后能留痕并可回退。",
    boundary: "台账只用于人工调参评审，不自动改 PID、不自动改延时。"
  });

  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  return targets.sort((left, right) => {
    const priorityDelta = (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function buildControlOscillationDiagnostic(
  pointSummary,
  historyWindow = null,
  ledgerEvidence = null,
  fieldDataPreflightEvidence = null,
  fieldDataPromoteEvidence = null
) {
  const hasHistoryWindow = Array.isArray(historyWindow?.series) && historyWindow.series.length > 0;
  const normalizedLedgerEvidence = ledgerEvidence || normalizeControlLedgerImportEvidence(null);
  const normalizedFieldDataPreflightEvidence = fieldDataPreflightEvidence || normalizeFieldDataPreflightEvidence(null);
  const normalizedFieldDataPromoteEvidence = fieldDataPromoteEvidence || normalizeFieldDataPromoteEvidence(null);
  const hasLedgerEvidence = normalizedLedgerEvidence.status !== "unavailable";
  const hasInputs = hasHistoryWindow || Boolean(pointSummary) || hasLedgerEvidence;
  const riskIndicators = buildControlOscillationRiskIndicators({ historyWindow, pointSummary, ledgerEvidence: normalizedLedgerEvidence });
  const fieldReviewTargets = buildControlOscillationFieldReviewTargets(riskIndicators);
  const activeRiskCount = riskIndicators.filter((item) => item.status === "active").length;
  const watchRiskCount = riskIndicators.filter((item) => item.status === "watch").length;
  const gapCount = riskIndicators.filter((item) => item.status === "gap" || item.status === "unknown").length;
  const sampleCounts = riskIndicators
    .map((item) => asFiniteNumber(item.sampleCount))
    .filter((value) => value !== null);
  const maxDirectionChangeCount = Math.max(
    0,
    ...riskIndicators
      .map((item) => asFiniteNumber(item.directionChangeCount))
      .filter((value) => value !== null)
  );
  const trendStatus =
    !hasHistoryWindow
      ? "unavailable"
      : activeRiskCount > 0
        ? "active"
        : watchRiskCount > 0
          ? "watch"
          : "normal";
  const blockers = hasInputs ? [] : ["缺趋势窗口、运行状态和频率反馈，不能做控制震荡/频繁启停诊断。"];
  const warnings = dedupeSteps([
    ...(activeRiskCount > 0 ? [`控制震荡 V1 形成 ${activeRiskCount} 个风险指示，需人工复核控制命令/反馈。`] : []),
    ...(watchRiskCount > 0 ? [`控制震荡 V1 有 ${watchRiskCount} 个观察项，建议补高频趋势。`] : []),
    ...(gapCount > 0 ? [`控制震荡 V1 仍有 ${gapCount} 个证据缺口，不能下 PID 或启停结论。`] : []),
    ...(normalizedLedgerEvidence.status === "ready"
      ? ["控制震荡台账导入已 READY，可作为高频命令/反馈和启停事件证据窗口，但仍不自动改 PID 或启停。"]
      : []),
    ...(normalizedLedgerEvidence.status === "partial"
      ? ["控制震荡台账导入为 PARTIAL，只能用于方向性复核，不能提升为高置信控制结论。"]
      : []),
    ...(normalizedLedgerEvidence.status === "blocked"
      ? ["控制震荡台账导入存在阻断项，不能作为诊断证据。"]
      : []),
    ...(normalizedFieldDataPreflightEvidence.status === "ready" && normalizedLedgerEvidence.usableForDiagnosis !== true
      ? ["现场 CSV 预检已 READY，但尚未正式导入 latest；页面仍按正式导入报告判断诊断证据。"]
      : []),
    ...(normalizedFieldDataPreflightEvidence.status === "waiting"
      ? ["现场 CSV 预检正在等待三张现场导出文件，不作为诊断证据。"]
      : []),
    ...(normalizedFieldDataPromoteEvidence.status === "ready" && normalizedLedgerEvidence.usableForDiagnosis !== true
      ? ["现场 CSV 正式导入 gate 已 READY，但正式台账 latest 尚未被当前 Advisor 识别为可用证据。"]
      : []),
    ...(normalizedFieldDataPromoteEvidence.status === "waiting"
      ? ["现场 CSV 正式导入 gate 等待预检 READY，不覆盖当前正式台账证据。"]
      : []),
    ...(!hasHistoryWindow ? ["缺 24h 趋势窗口，只能生成控制点位补齐建议。"] : []),
    ...(normalizedLedgerEvidence.usableForDiagnosis
      ? ["已补现场台账后，下一步仍需人工对齐负荷扰动、告警和控制模式，不能直接判定 PID 参数错误。"]
      : ["当前缺高频命令/反馈、PID 参数和精确启停事件，不能判断 PID 参数错误或频繁启停。"])
  ]);
  const status =
    !hasInputs
      ? "unavailable"
      : gapCount > 0
        ? "partial"
        : "ready";
  const confidence = normalizedLedgerEvidence.usableForDiagnosis && hasHistoryWindow ? "medium" : "low";

  return {
    key: "controlOscillation",
    title: "控制震荡/频繁启停诊断",
    status,
    confidence,
    current: {
      trendWindow: {
        status: trendStatus,
        range: historyWindow?.range || null,
        generatedAt: historyWindow?.generatedAt || null,
        sampleCount: sampleCounts.length ? Math.max(...sampleCounts) : 0,
        maxDirectionChangeCount,
        reason:
          trendStatus === "active"
            ? "小时级趋势存在锯齿波/hunting 线索，需补高频命令/反馈复核。"
            : trendStatus === "watch"
              ? "小时级趋势存在波动线索，暂不能形成控制参数结论。"
              : trendStatus === "normal"
                ? "小时级趋势未触发第一版震荡阈值。"
                : "缺 24h 趋势窗口。"
      },
      riskIndicators,
      fieldReviewTargets,
      activeRiskCount,
      watchRiskCount,
      gapCount,
      ledgerEvidence: {
        status: normalizedLedgerEvidence.status,
        importStatus: normalizedLedgerEvidence.importStatus,
        evidenceMode: normalizedLedgerEvidence.evidenceMode,
        usableForDiagnosis: normalizedLedgerEvidence.usableForDiagnosis,
        generatedAt: normalizedLedgerEvidence.generatedAt,
        reportPath: normalizedLedgerEvidence.reportPath,
        totalRows: normalizedLedgerEvidence.totalRows,
        acceptedRows: normalizedLedgerEvidence.acceptedRows,
        blockersCount: normalizedLedgerEvidence.blockersCount,
        warningsCount: normalizedLedgerEvidence.warningsCount,
        preflight: {
          status: normalizedFieldDataPreflightEvidence.status,
          finalDecision: normalizedFieldDataPreflightEvidence.finalDecision,
          readyForImport: normalizedFieldDataPreflightEvidence.readyForImport,
          generatedAt: normalizedFieldDataPreflightEvidence.generatedAt,
          reportPath: normalizedFieldDataPreflightEvidence.reportPath,
          acceptedRows: normalizedFieldDataPreflightEvidence.acceptedRows,
          totalRows: normalizedFieldDataPreflightEvidence.totalRows,
          blockersCount: normalizedFieldDataPreflightEvidence.blockersCount,
          warningsCount: normalizedFieldDataPreflightEvidence.warningsCount,
          inputCount: normalizedFieldDataPreflightEvidence.inputCount,
          missingInputCount: normalizedFieldDataPreflightEvidence.missingInputCount,
          importStatus: normalizedFieldDataPreflightEvidence.importStatus,
          inputs: normalizedFieldDataPreflightEvidence.inputs.map((input) => ({
            key: input.key,
            title: input.title,
            path: input.path,
            exists: input.exists,
            mode: input.mode,
            requiredForReady: input.requiredForReady
          })),
          controlBoundary: normalizedFieldDataPreflightEvidence.controlBoundary
        },
        promotion: {
          status: normalizedFieldDataPromoteEvidence.status,
          finalDecision: normalizedFieldDataPromoteEvidence.finalDecision,
          formalImportReady: normalizedFieldDataPromoteEvidence.formalImportReady,
          generatedAt: normalizedFieldDataPromoteEvidence.generatedAt,
          reportPath: normalizedFieldDataPromoteEvidence.reportPath,
          acceptedRows: normalizedFieldDataPromoteEvidence.acceptedRows,
          totalRows: normalizedFieldDataPromoteEvidence.totalRows,
          blockersCount: normalizedFieldDataPromoteEvidence.blockersCount,
          warningsCount: normalizedFieldDataPromoteEvidence.warningsCount,
          importStatus: normalizedFieldDataPromoteEvidence.importStatus,
          preflightDecision: normalizedFieldDataPromoteEvidence.preflightDecision,
          controlBoundary: normalizedFieldDataPromoteEvidence.controlBoundary
        },
        tables: normalizedLedgerEvidence.tables.map((table) => ({
          key: table.key,
          title: table.title,
          status: table.status,
          inputMode: table.inputMode,
          rowCount: table.rowCount,
          acceptedRowCount: table.acceptedRowCount,
          outputPath: table.outputPath
        })),
        controlBoundary: normalizedLedgerEvidence.controlBoundary
      },
      reviewBoundary: "控制震荡 V1 只输出温差锯齿波、总功率 hunting、频率/启停事件缺口和现场复核对象；不自动改 PID，不自动启停设备。"
    },
    findings: dedupeSteps([
      hasHistoryWindow ? `控制震荡 V1 已读取 ${historyWindow.range || "24h"} 趋势窗口。` : "",
      activeRiskCount > 0 ? `控制震荡 V1 形成 ${activeRiskCount} 个风险指示。` : "",
      watchRiskCount > 0 ? `控制震荡 V1 有 ${watchRiskCount} 个观察项。` : "",
      normalizedLedgerEvidence.usableForDiagnosis ? `控制震荡台账导入 READY，已接受 ${normalizedLedgerEvidence.acceptedRows} 行现场证据。` : "",
      normalizedFieldDataPreflightEvidence.readyForImport && !normalizedLedgerEvidence.usableForDiagnosis
        ? "现场 CSV 预检 READY，需执行正式导入后才进入诊断证据。"
        : "",
      gapCount > 0 ? `仍有 ${gapCount} 个高频控制/启停证据缺口。` : ""
    ]),
    blockers,
    warnings,
    evidence: [
      buildDiagnosticEvidence("oscillationActiveRiskCount", "控制震荡风险", activeRiskCount),
      buildDiagnosticEvidence("oscillationWatchRiskCount", "控制震荡观察项", watchRiskCount),
      buildDiagnosticEvidence("oscillationGapCount", "控制震荡证据缺口", gapCount),
      buildDiagnosticEvidence("oscillationMaxDirectionChangeCount", "最大方向反转次数", maxDirectionChangeCount),
      buildDiagnosticEvidence("controlLedgerImportStatus", "控制台账导入状态", normalizedLedgerEvidence.status)
    ],
    suggestions: [
      "先补命令/反馈高频趋势，再判断 PID、死区、斜率限制或执行器跟随问题。",
      "频繁启停必须基于精确启停事件和最小运行时间统计，不用实时状态快照替代事件台账。",
      "任何 PID、延时或启停参数调整都应由 PLC 本地保护兜底，并经过人工审批和可回退记录。"
    ]
  };
}

function buildInstrumentDriftWarnings(driftWindow) {
  if (!driftWindow || driftWindow.status === "unavailable") {
    return [];
  }
  const cop = pickDriftMetric(driftWindow, "currentCop");
  const power = pickDriftMetric(driftWindow, "totalPowerKw");
  const chilledDeltaT = pickDriftMetric(driftWindow, "chilledDeltaT");
  const coolingDeltaT = pickDriftMetric(driftWindow, "coolingDeltaT");
  const warnings = [];
  if (driftWindow.steadyState?.status === "unstable") {
    warnings.push(
      `24h ${driftWindow.steadyState.basisLabel || "负荷"}未形成稳态窗口，仪表漂移判断降级为趋势审阅。`
    );
  }
  if (driftWindow.steadyState?.status === "unavailable") {
    warnings.push("缺少可用于稳态判断的制冷量/总功率趋势，仪表漂移判断降级。");
  }
  if (
    driftWindow.steadyState?.status === "ready" &&
    cop?.status === "ready" &&
    cop.driftPct !== null &&
    Math.abs(cop.driftPct) >= 10
  ) {
    warnings.push(
      `稳态窗口内冷站COP首末偏移 ${cop.driftPct}%，需结合湿球核对冷量表或功率表是否漂移。`
    );
  }
  if (power?.status === "ready" && power.rangePct !== null && power.rangePct >= 35) {
    warnings.push(
      `24h 总功率波动范围 ${power.rangePct}%，负荷不稳时漂移诊断只作提示，建议切稳态窗口复核。`
    );
  }
  if (chilledDeltaT?.status === "ready" && chilledDeltaT.range !== null && chilledDeltaT.range >= 2) {
    warnings.push(`24h 冷冻水温差波动 ${chilledDeltaT.range}℃，需复核供回水温度点位和工况切换。`);
  }
  if (coolingDeltaT?.status === "ready" && coolingDeltaT.range !== null && coolingDeltaT.range >= 2) {
    warnings.push(`24h 冷却水温差波动 ${coolingDeltaT.range}℃，需复核冷却水温度点位和塔泵工况。`);
  }
  if (driftWindow.status === "partial") {
    warnings.push("历史趋势窗口样本不完整，仪表漂移诊断只输出方向性复核建议。");
  }
  return dedupeSteps(warnings);
}

function normalizeReviewStatus(status) {
  return ["review", "normal", "insufficient"].includes(status) ? status : "insufficient";
}

function normalizeLoadSource(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "scenario";
}

function isMeasuredCoolingLoadSource(value) {
  return METERED_LOAD_SOURCES.has(normalizeLoadSource(value));
}

function deriveRealtimeCoolingLoadForAdvisor(request, baseline) {
  const requestLoadKw = asPositiveNumber(request?.loadKw);
  const requestLoadSource = normalizeLoadSource(request?.loadSource);
  if (isMeasuredCoolingLoadSource(requestLoadSource) && requestLoadKw !== null) {
    return {
      loadKw: requestLoadKw,
      source: requestLoadSource,
      basis: "request_metered_cooling_load",
      requestLoadKw
    };
  }

  const directBaselineLoadKw = asPositiveNumber(
    baseline?.systemCoolingLoadKw ??
    baseline?.coolingLoadKw ??
    baseline?.totalCoolingLoadKw ??
    baseline?.totalCoolingCapacityKw ??
    baseline?.totalCoolingCapacity
  );
  if (directBaselineLoadKw !== null) {
    return {
      loadKw: directBaselineLoadKw,
      source: "baseline_cooling_load",
      basis: "baseline_cooling_load",
      requestLoadKw
    };
  }

  const systemCop = asPositiveNumber(baseline?.systemCop);
  const stationPowerKw = asPositiveNumber(baseline?.totalPowerKw);
  if (systemCop !== null && stationPowerKw !== null) {
    return {
      loadKw: roundNullable(systemCop * stationPowerKw, 1),
      source: "baseline_system_cop_total_power",
      basis: "derived_from_station_cop_and_power",
      requestLoadKw
    };
  }

  return {
    loadKw: requestLoadKw,
    source: requestLoadSource,
    basis: requestLoadKw !== null ? "request_scenario_fallback" : "unavailable",
    requestLoadKw
  };
}

function buildInstrumentCrossChecks({
  subtotalDeltaPct,
  copDeltaPct,
  subtotalPowerKw,
  totalPowerKw,
  calculatedCop,
  systemCop,
  loadSource,
  baseline,
  request,
  driftWindow
}) {
  const currentWetBulbC = normalizeWetBulbC(baseline?.outdoorWetBulbC) ?? normalizeWetBulbC(request?.outdoorTempC);
  const currentTcwsC = asFiniteNumber(baseline?.coolingReturnTemp);
  const approachMeasurement = resolveTowerApproachMeasurement(currentTcwsC, currentWetBulbC);
  const currentApproachC = approachMeasurement.value;
  const checks = [
    {
      key: "power_meter_closure",
      label: "总功率/分项功率闭合",
      status:
        subtotalDeltaPct === null
          ? "insufficient"
          : Math.abs(subtotalDeltaPct) > 15
            ? "review"
            : "normal",
      value: subtotalDeltaPct,
      unit: "%",
      threshold: "abs <= 15%",
      evidence: `分项合计 ${subtotalPowerKw ?? "--"} kW / 总功率 ${totalPowerKw ?? "--"} kW`,
      reviewTarget: "冷站总电表、主机/泵/塔分项电表和计量口径",
      boundary: "只提示计量闭合偏差，不判定电表故障。"
    },
    {
      key: "cop_closure",
      label: "冷量/总功率/COP闭合",
      status:
        copDeltaPct === null
          ? "insufficient"
          : Math.abs(copDeltaPct) > 15
            ? "review"
            : "normal",
      value: copDeltaPct,
      unit: "%",
      threshold: "abs <= 15%",
      evidence:
        calculatedCop === null
          ? `负荷来源 ${normalizeLoadSource(loadSource)}；未声明为实测冷量，跳过 COP 闭合。`
          : `反算 COP ${calculatedCop} / 现态 COP ${systemCop ?? "--"}`,
      reviewTarget: "独立冷量表、总功率表和实时负荷来源",
      boundary: "只有独立实测冷量可用于 COP 闭合；场景输入不判定仪表偏移，不自动修正 COP。"
    },
    {
      key: "wet_bulb_physical_boundary",
      label: "冷却水出水/湿球物理边界",
      status:
        currentWetBulbC === null || currentTcwsC === null
          ? "insufficient"
          : !approachMeasurement.plausible
            ? "review"
            : "normal",
      value: currentApproachC,
      unit: "℃",
      threshold: `0℃ <= Approach <= ${TOWER_APPROACH_MAX_PLAUSIBLE_C}℃`,
      evidence:
        approachMeasurement.rawValue !== null && !approachMeasurement.plausible
          ? `Tcws ${currentTcwsC ?? "--"}℃ / 湿球 ${currentWetBulbC ?? "--"}℃ / 原始差值越界`
          : `Tcws ${currentTcwsC ?? "--"}℃ / 湿球 ${currentWetBulbC ?? "--"}℃`,
      reviewTarget: "湿球温度、冷却塔出水温度和安装位置",
      boundary: approachMeasurement.reason || "只提示物理边界异常，不判定温度传感器损坏。"
    },
    {
      key: "trend_steady_state",
      label: "24h稳态窗口",
      status: driftWindow?.steadyState?.status === "ready" ? "normal" : "review",
      value: driftWindow?.steadyState?.rangePct ?? driftWindow?.steadyState?.fullRangePct ?? null,
      unit: "%",
      threshold: `<= ${driftWindow?.steadyState?.thresholdRangePct ?? 12}%`,
      evidence: driftWindow?.steadyState?.reason || "缺少稳态窗口。",
      reviewTarget: "同负荷/相近湿球历史窗口",
      boundary: "负荷不稳时，漂移判断降级为趋势审阅。"
    }
  ];

  return checks.map((item) => ({
    ...item,
    status: normalizeReviewStatus(item.status)
  }));
}

function buildInstrumentDriftCandidates({ driftWindow, crossChecks }) {
  const candidates = [];
  const pushCandidate = (candidate) => {
    if (!candidate?.key) {
      return;
    }
    candidates.push({
      confidence: candidate.confidence || "low",
      status: normalizeReviewStatus(candidate.status),
      severity: candidate.severity || "info",
      ...candidate
    });
  };
  const steadyReady = driftWindow?.steadyState?.status === "ready";
  const cop = pickDriftMetric(driftWindow, "currentCop");
  const power = pickDriftMetric(driftWindow, "totalPowerKw");
  const chilledDeltaT = pickDriftMetric(driftWindow, "chilledDeltaT");
  const coolingDeltaT = pickDriftMetric(driftWindow, "coolingDeltaT");
  const powerClosure = (crossChecks || []).find((item) => item.key === "power_meter_closure");
  const copClosure = (crossChecks || []).find((item) => item.key === "cop_closure");
  const wetBulbBoundary = (crossChecks || []).find((item) => item.key === "wet_bulb_physical_boundary");

  if (cop?.status === "ready" && cop.driftPct !== null && Math.abs(cop.driftPct) >= 10) {
    pushCandidate({
      key: "cop_steady_state_drift",
      metric: "currentCop",
      label: steadyReady ? "稳态 COP 首末偏移" : "COP 趋势偏移",
      status: steadyReady ? "review" : "insufficient",
      severity: steadyReady ? "medium" : "low",
      confidence: steadyReady ? "medium" : "low",
      value: cop.driftPct,
      unit: "%",
      threshold: "abs >= 10%",
      suspectedSignals: ["冷量表", "总功率表", "负荷/湿球工况标签"],
      reason: steadyReady
        ? `稳态窗口内冷站 COP 首末偏移 ${cop.driftPct}%。`
        : `COP 首末偏移 ${cop.driftPct}%，但负荷未稳定，只能趋势审阅。`,
      requiredEvidence: ["同负荷/湿球窗口", "冷量表校准", "总功率表校准", "运行工况记录"],
      boundary: "只提示冷量表/功率表/工况需核对，不判定仪表故障。"
    });
  }

  if (powerClosure?.status === "review") {
    pushCandidate({
      key: "power_meter_closure_gap",
      metric: "powerClosure",
      label: "功率计量闭合偏差",
      status: "review",
      severity: "medium",
      confidence: "medium",
      value: powerClosure.value,
      unit: "%",
      threshold: powerClosure.threshold,
      suspectedSignals: ["冷站总电表", "主机分表", "水泵分表", "冷却塔分表"],
      reason: `总功率与分项功率偏差 ${powerClosure.value}%。`,
      requiredEvidence: ["总表/分表点名", "计量范围", "同期抄表", "电表倍率"],
      boundary: powerClosure.boundary
    });
  }

  if (copClosure?.status === "review") {
    pushCandidate({
      key: "cop_closure_gap",
      metric: "copClosure",
      label: "COP 反算闭合偏差",
      status: "review",
      severity: "medium",
      confidence: "medium",
      value: copClosure.value,
      unit: "%",
      threshold: copClosure.threshold,
      suspectedSignals: ["冷量表", "总功率表", "实时负荷来源"],
      reason: `按实测冷量与总功率反算 COP 与现态 COP 偏差 ${copClosure.value}%。`,
      requiredEvidence: ["冷量表口径", "实时负荷来源", "总功率表口径", "采样时间对齐"],
      boundary: copClosure.boundary
    });
  }

  if (wetBulbBoundary?.status === "review") {
    pushCandidate({
      key: "wet_bulb_boundary_violation",
      metric: "coolingApproach",
      label: "湿球物理边界异常",
      status: "review",
      severity: "high",
      confidence: "medium",
      value: wetBulbBoundary.value,
      unit: "℃",
      threshold: wetBulbBoundary.threshold,
      suspectedSignals: ["湿球温度", "冷却塔出水温度", "安装位置"],
      reason: wetBulbBoundary.evidence,
      requiredEvidence: ["湿球仪表位置", "冷却水温度安装位置", "现场温湿度复核"],
      boundary: wetBulbBoundary.boundary
    });
  }

  if (power?.status === "ready" && power.rangePct !== null && power.rangePct >= 35) {
    pushCandidate({
      key: "total_power_unstable_window",
      metric: "totalPowerKw",
      label: "总功率波动过大",
      status: "insufficient",
      severity: "low",
      confidence: "low",
      value: power.rangePct,
      unit: "%",
      threshold: "rangePct >= 35%",
      suspectedSignals: ["负荷波动", "运行组合变化", "总功率表"],
      reason: `24h 总功率波动范围 ${power.rangePct}%，需先切稳态窗口。`,
      requiredEvidence: ["运行组合事件", "负荷趋势", "总功率趋势"],
      boundary: "负荷不稳时不能把波动直接判为仪表偏移。"
    });
  }

  if (chilledDeltaT?.status === "ready" && chilledDeltaT.range !== null && chilledDeltaT.range >= 2) {
    pushCandidate({
      key: "chilled_delta_t_spread",
      metric: "chilledDeltaT",
      label: "冷冻水温差波动",
      status: "review",
      severity: "medium",
      confidence: "medium",
      value: chilledDeltaT.range,
      unit: "℃",
      threshold: "range >= 2℃",
      suspectedSignals: ["冷冻供水温度", "冷冻回水温度", "工况切换"],
      reason: `24h 冷冻水温差波动 ${chilledDeltaT.range}℃。`,
      requiredEvidence: ["供回水温度点位位置", "泵频变化", "阀门/旁通状态", "负荷窗口"],
      boundary: "不直接判定温度传感器偏移，需结合工况切换复核。"
    });
  }

  if (coolingDeltaT?.status === "ready" && coolingDeltaT.range !== null && coolingDeltaT.range >= 2) {
    pushCandidate({
      key: "cooling_delta_t_spread",
      metric: "coolingDeltaT",
      label: "冷却水温差波动",
      status: "review",
      severity: "medium",
      confidence: "medium",
      value: coolingDeltaT.range,
      unit: "℃",
      threshold: "range >= 2℃",
      suspectedSignals: ["冷却供水温度", "冷却回水温度", "塔泵工况"],
      reason: `24h 冷却水温差波动 ${coolingDeltaT.range}℃。`,
      requiredEvidence: ["冷却水温度点位位置", "塔风机频率", "冷却泵频率", "塔阀状态"],
      boundary: "不直接判定塔侧仪表故障，需结合塔泵工况复核。"
    });
  }

  if (!candidates.length) {
    pushCandidate({
      key: "no_strong_drift_candidate",
      metric: "instrumentDataQuality",
      label: "暂无强偏移候选",
      status: driftWindow?.status === "unavailable" ? "insufficient" : "normal",
      severity: "info",
      confidence: driftWindow?.status === "ready" ? "medium" : "low",
      value: null,
      unit: null,
      threshold: null,
      suspectedSignals: [],
      reason:
        driftWindow?.status === "unavailable"
          ? "缺 24h 历史趋势窗口，不能形成偏移候选。"
          : "现有闭合校验和趋势窗口未触发强偏移候选。",
      requiredEvidence: ["传感器校准台账", "安装位置台账"],
      boundary: "未触发候选不等于仪表已校准，只表示当前窗口未见强异常。"
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2, info: 3 };
  const statusRank = { review: 0, insufficient: 1, normal: 2 };
  return candidates.sort((left, right) => {
    const statusDelta = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    const severityDelta = (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function buildInstrumentFieldReviewTargets(driftCandidates, crossChecks) {
  const targets = [];
  const addTarget = (target) => {
    if (!target?.key || targets.some((item) => item.key === target.key)) {
      return;
    }
    targets.push(target);
  };
  const reviewCandidates = (Array.isArray(driftCandidates) ? driftCandidates : []).filter(
    (item) => item.status === "review" || item.status === "insufficient"
  );
  for (const candidate of reviewCandidates) {
    if (["cop_steady_state_drift", "cop_closure_gap"].includes(candidate.key)) {
      addTarget({
        key: "cooling-load-and-power-meter-review",
        priority: "P0",
        title: "复核冷量表与总功率表闭合",
        trigger: candidate.reason,
        requiredEvidence: ["冷量表校准日期", "总功率表校准日期", "采样时间对齐", "负荷来源说明"],
        acceptanceCriteria: "同一稳态窗口内冷量、总功率和 COP 口径可闭合，偏差来源可解释。",
        boundary: "不自动修正 COP，不把疑似偏移当成仪表故障结论。"
      });
    }
    if (candidate.key === "power_meter_closure_gap") {
      addTarget({
        key: "submeter-scope-review",
        priority: "P0",
        title: "复核总表/分表计量范围",
        trigger: candidate.reason,
        requiredEvidence: ["总表点名", "主机/泵/塔分表点名", "电表倍率", "计量范围图"],
        acceptanceCriteria: "总表与分项表计量边界明确，分项合计偏差在可解释范围内。",
        boundary: "只做计量口径复核，不写入或修正电表点。"
      });
    }
    if (candidate.key === "wet_bulb_boundary_violation") {
      addTarget({
        key: "wet-bulb-and-tcws-location-review",
        priority: "P0",
        title: "复核湿球与冷却水温度安装位置",
        trigger: candidate.reason,
        requiredEvidence: ["湿球仪表位置", "冷却水温度探头位置", "现场手持表复核", "采样时间"],
        acceptanceCriteria: "湿球和冷却水温度不存在物理边界冲突，安装位置和量程有记录。",
        boundary: "不绕过最低冷凝器进水温保护，不判定传感器损坏。"
      });
    }
    if (["chilled_delta_t_spread", "cooling_delta_t_spread"].includes(candidate.key)) {
      addTarget({
        key: `${candidate.metric}-temperature-pair-review`,
        priority: "P1",
        title: `${candidate.label}供回水温度复核`,
        trigger: candidate.reason,
        requiredEvidence: ["供水温度安装位置", "回水温度安装位置", "同期泵/塔/阀状态", "工况切换记录"],
        acceptanceCriteria: "温差波动可由工况解释，或形成待校准点位清单。",
        boundary: "不直接判定温度点偏移，先排除工况切换。"
      });
    }
  }
  if (!targets.length) {
    addTarget({
      key: "sensor-ledger-baseline",
      priority: "P1",
      title: "建立仪表校准与安装位置基线",
      trigger:
        (Array.isArray(crossChecks) && crossChecks.length
          ? "当前未触发强偏移候选，但缺校准/安装位置台账仍会限制置信度。"
          : "缺可用交叉校验证据。"),
      requiredEvidence: ["点位编号", "安装位置", "量程", "最近校准日期", "责任人"],
      acceptanceCriteria: "形成可映射到 BFF 点位 key 的仪表台账。",
      boundary: "台账只用于提高诊断置信度，不自动修正测点。"
    });
  }
  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  return targets.sort((left, right) => {
    const priorityDelta = (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function buildInstrumentDataQualityDiagnostic(
  pointSummary,
  request,
  baseline,
  freshness,
  config,
  historyWindow = null,
  sensorLedgerEvidence = null
) {
  const registerPoints = asFiniteNumber(pointSummary?.counts?.registerPoints);
  const deviceRows = asFiniteNumber(pointSummary?.counts?.deviceRows);
  const freshnessStale = isDraftFreshnessStale(config, freshness);
  const driftWindow = buildInstrumentDriftWindow(historyWindow);
  const copDriftMetric = pickDriftMetric(driftWindow, "currentCop");
  const totalPowerKw = asPositiveNumber(baseline?.totalPowerKw);
  const systemCop = asPositiveNumber(baseline?.systemCop);
  const loadKw = asPositiveNumber(request?.loadKw);
  const loadSource = normalizeLoadSource(request?.loadSource);
  const canUseLoadForCopClosure = isMeasuredCoolingLoadSource(loadSource);
  const subtotalPowerKw = sumRounded([
    asFiniteNumber(baseline?.chillerPowerKw),
    asFiniteNumber(baseline?.chilledPumpPowerKw),
    asFiniteNumber(baseline?.coolingPumpPowerKw),
    asFiniteNumber(baseline?.coolingTowerPowerKw)
  ]);
  const subtotalDeltaPct =
    subtotalPowerKw !== null && totalPowerKw !== null && totalPowerKw > 0
      ? roundNullable(((subtotalPowerKw - totalPowerKw) / totalPowerKw) * 100, 1)
      : null;
  const calculatedCop =
    canUseLoadForCopClosure && loadKw !== null && totalPowerKw !== null && totalPowerKw > 0
      ? roundNullable(loadKw / totalPowerKw, 2)
      : null;
  const copDeltaPct =
    calculatedCop !== null && systemCop !== null && systemCop > 0
      ? roundNullable(((calculatedCop - systemCop) / systemCop) * 100, 1)
      : null;
  const crossChecks = buildInstrumentCrossChecks({
    subtotalDeltaPct,
    copDeltaPct,
    subtotalPowerKw,
    totalPowerKw,
    calculatedCop,
    systemCop,
    loadSource,
    baseline,
    request,
    driftWindow
  });
  const driftCandidates = buildInstrumentDriftCandidates({
    driftWindow,
    crossChecks
  });
	  const fieldReviewTargets = buildInstrumentFieldReviewTargets(driftCandidates, crossChecks);
  const normalizedSensorLedgerEvidence =
    sensorLedgerEvidence || normalizeSensorLedgerPreflightEvidence(null);
	  const missingCoreSignals = [
    ["冷站COP", systemCop],
    ["总功率", totalPowerKw],
    ["冷冻水温差", asFiniteNumber(baseline?.chilledDeltaT)],
    ["冷却水温差", asFiniteNumber(baseline?.coolingDeltaT)]
  ]
    .filter(([, value]) => value === null)
    .map(([label]) => label);
  const blockers = dedupeSteps([
    ...(!pointSummary ? ["缺实时寄存器摘要，不能做仪表数据可信度诊断。"] : []),
    ...(missingCoreSignals.length ? [`核心能效信号缺失：${missingCoreSignals.join("、")}。`] : [])
  ]);
  const warnings = dedupeSteps([
    ...(freshnessStale ? ["实时快照已超过新鲜度阈值，诊断仅可作为方向性审阅。"] : []),
    ...(subtotalDeltaPct !== null && Math.abs(subtotalDeltaPct) > 15
      ? [`功率分项合计与总功率偏差 ${subtotalDeltaPct}%，需核对总表/分表口径。`]
      : []),
	    ...(canUseLoadForCopClosure && copDeltaPct !== null && Math.abs(copDeltaPct) > 15
	      ? [`按实测冷量与总功率反算 COP 与现态 COP 偏差 ${copDeltaPct}%，需核对冷量口径。`]
	      : []),
    ...(normalizedSensorLedgerEvidence.status === "waiting" || normalizedSensorLedgerEvidence.status === "unavailable"
      ? ["缺传感器校准/安装位置台账，仪表偏移 V1 只能保持疑似复核口径。"]
      : []),
    ...(normalizedSensorLedgerEvidence.status === "partial"
      ? ["传感器台账预检为 partial，存在校准过期、缺量程或覆盖不足，不能提升为高置信仪表结论。"]
      : []),
    ...(normalizedSensorLedgerEvidence.status === "blocked"
      ? ["传感器台账预检 blocked，需先修正现场 CSV 后再用于仪表复核。"]
      : []),
		    ...(asFiniteNumber(baseline?.outdoorWetBulbC) === null && asFiniteNumber(request?.outdoorTempC) === null
		      ? ["缺湿球温度，塔侧诊断和同工况对比会降级。"]
		      : []),
	    ...buildInstrumentDriftWarnings(driftWindow)
	  ]);

	  return {
    key: "instrumentDataQuality",
    title: "仪表数据可信度诊断",
    status: normalizeDiagnosticItemStatus(Boolean(pointSummary), blockers, warnings),
    confidence: blockers.length ? "low" : confidenceFromPointCoverage(pointSummary, "medium"),
    current: {
      deviceRows,
      registerPoints,
	      subtotalPowerKw,
	      totalPowerKw,
      loadKw,
      loadSource,
      canUseLoadForCopClosure,
	      subtotalDeltaPct,
	      systemCop,
	      calculatedCop,
	      copDeltaPct,
	      freshnessStale,
		      driftWindow,
		      crossChecks,
		      driftCandidates,
		      fieldReviewTargets,
      sensorLedgerEvidence: normalizedSensorLedgerEvidence,
		      reviewBoundary: "仪表偏移 V1 只输出疑似候选和复核对象，不判定仪表故障，不自动修正测点。"
	    },
	    findings: dedupeSteps([
	      pointSummary ? `当前实时树包含 ${deviceRows ?? 0} 个设备块、${registerPoints ?? 0} 个寄存器点。` : "",
	      subtotalDeltaPct === null
	        ? "当前不能完成总功率与分项功率交叉校验。"
	        : `总功率与分项功率偏差 ${subtotalDeltaPct}%。`,
		      calculatedCop === null
		        ? `负荷输入来源为 ${loadSource}，未作为实测冷量参与 COP 闭合。`
		        : `按实测冷量/总功率反算 COP 为 ${calculatedCop}。`,
	      driftWindow.status === "unavailable"
	        ? "当前缺 24h 历史趋势窗口，暂不能做仪表漂移复核。"
	        : `24h 趋势窗口状态 ${driftWindow.status}，可用于仪表偏移方向性复核。`,
	      driftWindow.steadyState?.reason || "",
	      copDriftMetric?.driftPct !== null && copDriftMetric?.driftPct !== undefined
	        ? `冷站COP首末偏移 ${copDriftMetric.driftPct}%。`
	        : "",
		      driftCandidates.some((item) => item.status === "review")
		        ? `仪表偏移 V1 形成 ${driftCandidates.filter((item) => item.status === "review").length} 个待复核候选。`
		        : "仪表偏移 V1 当前未形成强偏移候选。",
      normalizedSensorLedgerEvidence.status === "ready"
        ? `传感器台账预检 READY，已接受 ${normalizedSensorLedgerEvidence.acceptedRows} 条校准/安装位置记录。`
        : `传感器台账预检状态 ${normalizedSensorLedgerEvidence.status}，仍需补现场校准/安装位置证据。`
		    ]),
	    blockers,
	    warnings,
	    evidence: [
	      buildDiagnosticEvidence("registerPoints", "寄存器点数", registerPoints),
	      buildDiagnosticEvidence("currentCopDriftPct", "24h COP首末偏移", copDriftMetric?.driftPct ?? null, "%"),
	      buildDiagnosticEvidence("steadyStateRangePct", "稳态窗口波动", driftWindow.steadyState?.rangePct ?? null, "%"),
	      buildDiagnosticEvidence("loadSource", "负荷输入来源", loadSource),
			      buildDiagnosticEvidence("totalPowerKw", "冷站总功率", totalPowerKw, "kW"),
		      buildDiagnosticEvidence("subtotalPowerKw", "分项功率合计", subtotalPowerKw, "kW"),
		      buildDiagnosticEvidence("systemCop", "现态冷站COP", systemCop),
      buildDiagnosticEvidence("sensorLedgerAcceptedRows", "传感器台账接受行数", normalizedSensorLedgerEvidence.acceptedRows, "行")
		    ],
		    suggestions: [
		      "保持总表、分表、冷量和温差口径同步校验。",
		      "用 24h 趋势先筛查疑似偏移；真正校准结论仍需现场仪表、流量和热平衡复核。",
		      "后续可增加稳态窗口自动筛选：同负荷/相近湿球下检查冷量、电量、温度与流量闭合偏差。",
      "补齐传感器校准/安装位置台账后，再提高仪表偏移候选的复核优先级；仍不自动修正测点。"
		    ]
	  };
	}

function buildChilledHydraulicBalanceDiagnostic(pointSummary, baseline, historyWindow = null) {
  const chilledWater = pointSummary?.keySignals?.chilledWater || {};
  const branches = Array.isArray(pointSummary?.groups?.branches) ? pointSummary.groups.branches : [];
  const branchFlowSpread = buildSpreadSummary(branches.map((item) => item?.flowM3h));
  const branchPressureSpread = buildSpreadSummary(
    branches.map((item) => asFiniteNumber(item?.returnPressureKpa) ?? asFiniteNumber(item?.supplyPressureKpa))
  );
  const trendWindow = buildChilledHydraulicTrendWindow(historyWindow);
  const chilledDeltaT = asFiniteNumber(baseline?.chilledDeltaT) ?? asFiniteNumber(chilledWater.deltaTC);
  const differentialPressureKpa = asFiniteNumber(chilledWater.differentialPressureKpa);
  const bypassValveOpenPct = asFiniteNumber(chilledWater.bypassValveOpenPct);
  const riskIndicators = buildHydraulicRiskIndicators({
    trendWindow,
    chilledDeltaT,
    differentialPressureKpa,
    bypassValveOpenPct,
    branchFlowSpread,
    branchPressureSpread
  });
  const fieldReviewTargets = buildHydraulicFieldReviewTargets(riskIndicators);
  const activeRiskCount = riskIndicators.filter((item) => item.status === "active").length;
  const gapCount = riskIndicators.filter((item) => item.status === "gap" || item.status === "unknown").length;
  const hasInputs =
    chilledDeltaT !== null ||
    differentialPressureKpa !== null ||
    branchFlowSpread.count > 0 ||
    bypassValveOpenPct !== null;
  const blockers = hasInputs ? [] : ["缺冷冻水总管压差、支路流量/压力和旁通阀开度，不能做水力平衡诊断。"];
  const warnings = dedupeSteps([
    ...(chilledDeltaT !== null && chilledDeltaT < CHILLED_DELTA_T_TARGET_BAND_C.low
      ? [`冷冻水温差 ${chilledDeltaT}℃ 低于目标下限 ${CHILLED_DELTA_T_TARGET_BAND_C.low}℃。`]
      : []),
    ...(bypassValveOpenPct !== null && bypassValveOpenPct > 5
      ? [`冷冻旁通阀开度 ${bypassValveOpenPct}%，存在旁通分流风险。`]
      : []),
    ...(branchFlowSpread.ratio !== null && branchFlowSpread.ratio > 3
      ? [`支路流量最大/最小比 ${branchFlowSpread.ratio}，存在水力分配不均风险，需结合末端阀位确认。`]
      : []),
    ...(branchPressureSpread.range !== null && branchPressureSpread.range > 30
      ? [`支路压力差范围 ${branchPressureSpread.range} kPa，需复核远近端压差分布。`]
      : []),
    ...(trendWindow.persistentLowDeltaT
      ? [`稳态窗口内冷冻水温差低于目标占比 ${trendWindow.chilledDeltaT.belowPct}%，低温差具备持续性。`]
      : []),
    ...(trendWindow.status === "partial" ? [trendWindow.reason] : []),
    ...(trendWindow.status === "unavailable" ? ["缺冷冻水温差历史趋势，当前只能做实时水力平衡快照判断。"] : []),
    "当前缺支路流量/压差/旁通阀历史趋势，不能把实时支路差异外推为全天水力失衡。",
    "当前缺末端阀位/室温趋势，不能把支路流量差异直接判为末端故障。"
  ]);

  return {
    key: "chilledHydraulicBalance",
    title: "冷冻水水力平衡诊断",
    status: normalizeDiagnosticItemStatus(hasInputs, blockers, warnings),
    confidence: branchFlowSpread.count >= 3 || differentialPressureKpa !== null ? "medium" : "low",
    current: {
      chilledDeltaT,
      supplyPressureKpa: asFiniteNumber(chilledWater.supplyPressureKpa),
      returnPressureKpa: asFiniteNumber(chilledWater.returnPressureKpa),
      differentialPressureKpa,
      bypassValveOpenPct,
      branchFlowSpread,
      branchPressureSpread,
      trendWindow,
      riskIndicators,
      fieldReviewTargets,
      activeRiskCount,
      gapCount,
      reviewBoundary: "水力平衡 V1 只输出水力失衡风险排序、低温差持续性和现场复核对象；不自动降泵，不直接判定末端阀门故障。"
    },
    findings: dedupeSteps([
      differentialPressureKpa !== null ? `冷冻总管压差约 ${differentialPressureKpa} kPa。` : "",
      branchFlowSpread.ratio !== null ? `支路流量最大/最小比约 ${branchFlowSpread.ratio}。` : "",
      bypassValveOpenPct !== null ? `冷冻旁通阀反馈开度 ${bypassValveOpenPct}%。` : "",
      trendWindow.status !== "unavailable" ? trendWindow.reason : "",
      activeRiskCount > 0 ? `水力平衡 V1 形成 ${activeRiskCount} 个风险指示。` : "水力平衡 V1 当前未形成强风险指示。",
      gapCount > 0 ? `水力平衡 V1 仍有 ${gapCount} 个证据缺口。` : ""
    ]),
    blockers,
    warnings,
    evidence: [
      buildDiagnosticEvidence("chilledDeltaT", "冷冻水温差", chilledDeltaT, "℃"),
      buildDiagnosticEvidence("trendChilledDeltaTMean", "趋势温差均值", trendWindow.chilledDeltaT.mean, "℃"),
      buildDiagnosticEvidence("trendLowDeltaTPct", "低温差占比", trendWindow.chilledDeltaT.belowPct, "%"),
      buildDiagnosticEvidence("differentialPressureKpa", "冷冻总管压差", differentialPressureKpa, "kPa"),
      buildDiagnosticEvidence("bypassValveOpenPct", "旁通阀开度", bypassValveOpenPct, "%"),
      buildDiagnosticEvidence("branchFlowRatio", "支路流量比", branchFlowSpread.ratio),
      buildDiagnosticEvidence("hydraulicActiveRiskCount", "水力风险指示", activeRiskCount),
      buildDiagnosticEvidence("hydraulicGapCount", "水力证据缺口", gapCount)
    ],
    suggestions: [
      "先对比支路流量、支路回水温度和总管压差，再判断是否需要水力平衡调整。",
      "若低温差在稳态窗口内持续，再结合旁通阀、泵频和支路流量比决定是否进入泵降频 shadow 验证。",
      "补齐末端阀位、末端压差、支路历史趋势和代表房间温度后，可升级为根因定位。"
    ]
  };
}

function buildLowDeltaTRootCauseLinkage({
  chilledLow,
  coolingLow,
  chilledPumpAvgHz,
  coolingPumpAvgHz,
  bypassValveOpenPct,
  branchFlowSpread,
  hydraulicTrendWindow,
  pumpDeltaTAdvisor
}) {
  const persistentLowDeltaT = hydraulicTrendWindow?.persistentLowDeltaT === true;
  const rootCauseCandidates = [];
  const addCandidate = (candidate) => {
    if (!candidate?.key) {
      return;
    }
    rootCauseCandidates.push(candidate);
  };

  addCandidate({
    key: "persistentLowDeltaT",
    title: "低温差持续性",
    status: persistentLowDeltaT ? "active" : hydraulicTrendWindow?.status === "ready" ? "inactive" : "unknown",
    priority: "medium",
    confidence: hydraulicTrendWindow?.status === "ready" ? "medium" : "low",
    reason: persistentLowDeltaT
      ? `稳态窗口内冷冻水温差低于目标占比 ${hydraulicTrendWindow.chilledDeltaT?.belowPct ?? null}%。`
      : "当前未证明低温差在稳态窗口内持续，先保持趋势观察。"
  });

  addCandidate({
    key: "overPumping",
    title: "大流量小温差 / 泵频偏高",
    status: persistentLowDeltaT && chilledPumpAvgHz !== null && chilledPumpAvgHz >= 38 ? "active" : "watch",
    priority: persistentLowDeltaT && chilledPumpAvgHz !== null && chilledPumpAvgHz >= 38 ? "high" : "medium",
    confidence: persistentLowDeltaT && chilledPumpAvgHz !== null ? "medium" : "low",
    reason:
      chilledPumpAvgHz !== null
        ? `冷冻泵平均频率约 ${chilledPumpAvgHz} Hz，需结合末端不缺冷条件判断是否可小步降频。`
        : "缺冷冻泵频率反馈，不能判断是否存在大流量小温差。"
  });

  addCandidate({
    key: "hydraulicDistribution",
    title: "支路水力分配不均",
    status: branchFlowSpread.ratio !== null && branchFlowSpread.ratio > 3 ? "active" : "watch",
    priority: branchFlowSpread.ratio !== null && branchFlowSpread.ratio > 3 ? "medium" : "low",
    confidence: branchFlowSpread.count >= 3 ? "medium" : "low",
    reason:
      branchFlowSpread.ratio !== null
        ? `实时支路流量最大/最小比约 ${branchFlowSpread.ratio}，可能造成部分支路过流量、回水温度被稀释。`
        : "缺支路流量，不能判断水力分配不均。"
  });

  addCandidate({
    key: "bypassShortCircuit",
    title: "旁通分流",
    status: bypassValveOpenPct !== null && bypassValveOpenPct > 5 ? "active" : "watch",
    priority: bypassValveOpenPct !== null && bypassValveOpenPct > 5 ? "high" : "low",
    confidence: bypassValveOpenPct !== null ? "medium" : "low",
    reason:
      bypassValveOpenPct !== null
        ? `冷冻旁通阀反馈开度 ${bypassValveOpenPct}%。`
        : "缺旁通阀开度反馈。"
  });

  if (coolingLow) {
    addCandidate({
      key: "coolingSideOverFlow",
      title: "冷却侧低温差",
      status: "active",
      priority: "medium",
      confidence: coolingPumpAvgHz !== null ? "medium" : "low",
      reason:
        coolingPumpAvgHz !== null
          ? `冷却水温差偏低且冷却泵平均频率约 ${coolingPumpAvgHz} Hz，需复核冷却泵流量和塔泵协同。`
          : "冷却水温差偏低，需复核冷却泵流量和塔泵协同。"
    });
  }

  addCandidate({
    key: "terminalUnknown",
    title: "末端缺冷风险未闭合",
    status: "unknown",
    priority: chilledLow || persistentLowDeltaT ? "medium" : "low",
    confidence: "low",
    reason: "缺末端阀位、末端压差和代表房间温度趋势，不能确认降泵后末端是否仍安全。"
  });

  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2
  };
  const statusRank = {
    active: 0,
    watch: 1,
    unknown: 2,
    inactive: 3
  };
  const rankedCandidates = [...rootCauseCandidates].sort((left, right) => {
    const statusDiff = (statusRank[left.status] ?? 4) - (statusRank[right.status] ?? 4);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return (priorityRank[left.priority] ?? 3) - (priorityRank[right.priority] ?? 3);
  });

  return {
    status:
      rankedCandidates.some((item) => item.status === "active")
        ? "active"
        : hydraulicTrendWindow?.status === "ready"
          ? "watch"
          : "partial",
    persistentLowDeltaT,
    hydraulicTrendStatus: hydraulicTrendWindow?.status || "unavailable",
    pumpShadowReady: pumpDeltaTAdvisor?.executionReady === true,
    trendDataBoundary: {
      pumpFrequencyHistoryAvailable: false,
      branchHistoryAvailable: false,
      terminalHistoryAvailable: false
    },
    candidates: rankedCandidates
  };
}

function buildLowDeltaTRootCauseDiagnostic(pointSummary, baseline, pumpDeltaTAdvisor, hydraulicTrendWindow = null) {
  const chilledDeltaT = asFiniteNumber(baseline?.chilledDeltaT);
  const coolingDeltaT = asFiniteNumber(baseline?.coolingDeltaT);
  const chilledPumpAvgHz = asFiniteNumber(pointSummary?.keySignals?.pumpFrequency?.chilledAvgHz);
  const coolingPumpAvgHz = asFiniteNumber(pointSummary?.keySignals?.pumpFrequency?.coolingAvgHz);
  const bypassValveOpenPct = asFiniteNumber(pointSummary?.keySignals?.chilledWater?.bypassValveOpenPct);
  const branches = Array.isArray(pointSummary?.groups?.branches) ? pointSummary.groups.branches : [];
  const branchFlowSpread = buildSpreadSummary(branches.map((item) => item?.flowM3h));
  const hasInputs = chilledDeltaT !== null || coolingDeltaT !== null;
  const chilledLow = chilledDeltaT !== null && chilledDeltaT < CHILLED_DELTA_T_TARGET_BAND_C.low;
  const coolingLow = coolingDeltaT !== null && coolingDeltaT < COOLING_DELTA_T_TARGET_BAND_C.low;
  const trendLinkage = buildLowDeltaTRootCauseLinkage({
    chilledLow,
    coolingLow,
    chilledPumpAvgHz,
    coolingPumpAvgHz,
    bypassValveOpenPct,
    branchFlowSpread,
    hydraulicTrendWindow,
    pumpDeltaTAdvisor
  });
  const activeRootCauseTitles = trendLinkage.candidates
    .filter((item) => item.status === "active")
    .map((item) => item.title);
  const blockers = hasInputs ? [] : ["缺冷冻/冷却水温差，不能诊断低温差根因。"];
  const warnings = dedupeSteps([
    ...(chilledLow ? [`冷冻水温差 ${chilledDeltaT}℃ 偏低，优先查大流量小温差。`] : []),
    ...(coolingLow ? [`冷却水温差 ${coolingDeltaT}℃ 偏低，优先查冷却泵过流量或塔泵协同。`] : []),
    ...(trendLinkage.persistentLowDeltaT ? ["趋势已证明冷冻侧低温差具备持续性，根因排序优先级上调。"] : []),
    ...(activeRootCauseTitles.length ? [`低温差根因候选：${activeRootCauseTitles.join("、")}。`] : []),
    ...(bypassValveOpenPct !== null && bypassValveOpenPct > 5
      ? [`旁通阀开度 ${bypassValveOpenPct}%，可能拉低冷冻水温差。`]
      : []),
    ...(branchFlowSpread.ratio !== null && branchFlowSpread.ratio > 3
      ? ["支路流量差异大，可能造成部分支路过流量、回水温度被稀释。"]
      : []),
    ...(pumpDeltaTAdvisor?.executionReady === true
      ? ["泵温差 Advisor 已生成小步降频 shadow 条件，可作为验证动作。"]
      : ["当前仅诊断根因，不自动下调泵频。"])
  ]);
  const findings = dedupeSteps([
    chilledLow || coolingLow
      ? "当前存在低温差诊断触发条件。"
      : "当前温差未低于第一版诊断阈值，继续观察趋势即可。",
    trendLinkage.persistentLowDeltaT ? "稳态窗口显示冷冻侧低温差具备持续性。" : "",
    chilledPumpAvgHz !== null ? `运行冷冻泵平均频率约 ${chilledPumpAvgHz} Hz。` : "",
    coolingPumpAvgHz !== null ? `运行冷却泵平均频率约 ${coolingPumpAvgHz} Hz。` : "",
    trendLinkage.candidates.length ? `当前根因首位：${trendLinkage.candidates[0].title}。` : ""
  ]);

  return {
    key: "lowDeltaTRootCause",
    title: "低温差根因诊断",
    status: normalizeDiagnosticItemStatus(hasInputs, blockers, warnings),
    confidence: pointSummary ? "medium" : "low",
    current: {
      chilledDeltaT,
      coolingDeltaT,
      chilledPumpAvgHz,
      coolingPumpAvgHz,
      bypassValveOpenPct,
      branchFlowSpread,
      trendLinkage
    },
    findings,
    blockers,
    warnings,
    evidence: [
      buildDiagnosticEvidence("chilledDeltaT", "冷冻水温差", chilledDeltaT, "℃"),
      buildDiagnosticEvidence("coolingDeltaT", "冷却水温差", coolingDeltaT, "℃"),
      buildDiagnosticEvidence("persistentLowDeltaT", "持续低温差", trendLinkage.persistentLowDeltaT),
      buildDiagnosticEvidence("chilledPumpAvgHz", "冷冻泵平均频率", chilledPumpAvgHz, "Hz"),
      buildDiagnosticEvidence("coolingPumpAvgHz", "冷却泵平均频率", coolingPumpAvgHz, "Hz")
    ],
    suggestions: [
      "先确认旁通阀、支路流量、泵频率和末端阀位，再进入泵降频 shadow 验证。",
      "若低温差持续且末端不缺冷，优先把冷冻泵小步降频作为 shadow 验证动作；若末端缺冷，先做水力平衡。",
      "若温差低且末端不缺冷，优先小步降低泵频；若末端缺冷，先处理水力分配。"
    ]
  };
}

function buildCoolingTowerCapabilityDiagnostic(pointSummary, baseline, towerApproachAdvisor) {
  const wetBulbC =
    asFiniteNumber(towerApproachAdvisor?.requestedWetBulbC)
    ?? asFiniteNumber(baseline?.outdoorWetBulbC)
    ?? asFiniteNumber(pointSummary?.keySignals?.weather?.wetBulbC);
  const currentTcwsC =
    asFiniteNumber(towerApproachAdvisor?.currentTcwsC)
    ?? asFiniteNumber(baseline?.coolingReturnTemp)
    ?? asFiniteNumber(pointSummary?.keySignals?.coolingWater?.returnTempC);
  const fallbackApproachMeasurement = resolveTowerApproachMeasurement(currentTcwsC, wetBulbC);
  const advisorApproachC = asFiniteNumber(towerApproachAdvisor?.currentApproachC);
  const currentApproachC = advisorApproachC ?? fallbackApproachMeasurement.value;
  const towerPowerKw = asFiniteNumber(baseline?.coolingTowerPowerKw);
  const towerAvgHz = asFiniteNumber(pointSummary?.keySignals?.towerFrequency?.avgHz);
  const coolingTowerCells = Array.isArray(pointSummary?.groups?.coolingTowerCells)
    ? pointSummary.groups.coolingTowerCells
    : [];
  const towerFlowSpread = buildSpreadSummary(coolingTowerCells.map((item) => item?.flowM3h));
  const hasInputs =
    currentApproachC !== null ||
    fallbackApproachMeasurement.rawValue !== null ||
    coolingTowerCells.length > 0 ||
    towerPowerKw !== null;
  const blockers = hasInputs ? [] : ["缺湿球、冷却水温或冷却塔运行反馈，不能诊断冷却塔能力。"];
  if (
    advisorApproachC === null &&
    fallbackApproachMeasurement.rawValue !== null &&
    !fallbackApproachMeasurement.plausible
  ) {
    blockers.push(fallbackApproachMeasurement.reason || "接近度计算结果不符合物理约束。");
  }
  const warnings = dedupeSteps([
    ...(currentApproachC !== null && currentApproachC > 6
      ? [`接近度 ${currentApproachC}℃ 偏高，需复核塔风机、布水、填料和冷却水流量。`]
      : []),
    ...(towerFlowSpread.ratio !== null && towerFlowSpread.ratio > 3
      ? [`冷却塔支路流量最大/最小比 ${towerFlowSpread.ratio}，需结合阀门开到位确认是否配水不均。`]
      : []),
    ...(towerApproachAdvisor?.status === "unavailable"
      ? "接近度 Advisor 当前不可用，塔能力诊断只保留点位体检。"
      : [])
  ]);

  return {
    key: "coolingTowerCapability",
    title: "冷却塔能力诊断",
    status: normalizeDiagnosticItemStatus(hasInputs, blockers, warnings),
    confidence: currentApproachC !== null && wetBulbC !== null ? "medium" : "low",
    current: {
      wetBulbC,
      currentTcwsC,
      currentApproachC,
      targetApproachC: asFiniteNumber(towerApproachAdvisor?.targetApproachC),
      targetTcwsC: asFiniteNumber(towerApproachAdvisor?.targetTcwsC),
      towerPowerKw,
      towerAvgHz,
      towerFlowSpread
    },
    findings: dedupeSteps([
      currentApproachC !== null ? `当前冷却塔接近度约 ${currentApproachC}℃。` : "",
      towerPowerKw !== null ? `冷却塔功率约 ${towerPowerKw} kW。` : "",
      towerFlowSpread.ratio !== null ? `塔侧流量最大/最小比约 ${towerFlowSpread.ratio}。` : ""
    ]),
    blockers,
    warnings,
    evidence: [
      buildDiagnosticEvidence("wetBulbC", "湿球温度", wetBulbC, "℃"),
      buildDiagnosticEvidence("currentTcwsC", "冷却塔出水/冷机冷凝器进水温", currentTcwsC, "℃"),
      buildDiagnosticEvidence("currentApproachC", "接近度", currentApproachC, "℃"),
      buildDiagnosticEvidence("towerFlowRatio", "塔侧流量比", towerFlowSpread.ratio)
    ],
    suggestions: [
      "接近度偏高时，优先查塔风机频率、塔进出水阀、布水和填料脏堵。",
      "接近度正常但塔功率高时，再评估塔风机降频 shadow 验证。"
    ]
  };
}

function buildChillerHealthCombinationDiagnostic(pointSummary, chillerStagingAdvisor) {
  const chillers = Array.isArray(pointSummary?.groups?.chillers) ? pointSummary.groups.chillers : [];
  const runningChillers = chillers.filter((item) => item?.running);
  const runningCombination =
    chillerStagingAdvisor?.current?.runningCombination && Array.isArray(chillerStagingAdvisor.current.runningCombination)
      ? chillerStagingAdvisor.current.runningCombination
      : runningChillers.map((item) => item.id).filter(Boolean);
  const sampleSummary = chillerStagingAdvisor?.evidence?.sampleSummary || chillerStagingAdvisor?.sampleEvidence?.sampleSummary || {};
  const sampleTotal = asFiniteNumber(sampleSummary.sampleTotal);
  const currentCombinationSamples = asFiniteNumber(sampleSummary.currentCombinationSamples);
  const targetCombinationSamples = asFiniteNumber(sampleSummary.targetCombinationSamples);
  const hasInputs = runningCombination.length > 0 || chillers.length > 0 || Boolean(chillerStagingAdvisor);
  const blockers = dedupeSteps([
    ...(!hasInputs ? ["缺主机运行点位和主机组合 Advisor，不能诊断主机健康与组合样本。"] : []),
    ...(chillerStagingAdvisor?.status === "unavailable" ? chillerStagingAdvisor.blockers || [] : [])
  ]).slice(0, 5);
  const warnings = dedupeSteps([
    ...(sampleTotal !== null && sampleTotal < CHILLER_STAGING_MIN_SAMPLE_COUNT
      ? [`组合样本总量 ${sampleTotal} 条，低于 ${CHILLER_STAGING_MIN_SAMPLE_COUNT} 条。`]
      : []),
    ...(targetCombinationSamples !== null && targetCombinationSamples > 0 && targetCombinationSamples < CHILLER_STAGING_MIN_SAMPLE_COUNT
      ? [`推荐组合样本 ${targetCombinationSamples} 条，仍为低置信。`]
      : []),
    ...(runningCombination.length > 1
      ? ["当前为多机并联，且无单台冷冻水流量，不计算单机实时 COP。"]
      : ["当前单机运行窗口可沉淀该主机单机 COP 样本。"]),
    ...(runningChillers.some((item) => item.faultActive === true) ? ["存在运行主机故障信号，禁止组合切换建议升级。"] : [])
  ]);

  return {
    key: "chillerHealthCombination",
    title: "主机健康与组合样本诊断",
    status: normalizeDiagnosticItemStatus(hasInputs, blockers, warnings),
    confidence: chillerStagingAdvisor?.confidence || (sampleTotal >= CHILLER_STAGING_MIN_SAMPLE_COUNT ? "medium" : "low"),
    current: {
      runningCombination,
      runningCount: runningCombination.length,
      chillerPowerTotalKw: asFiniteNumber(chillerStagingAdvisor?.current?.chillerPowerTotalKw),
      comboCop: asFiniteNumber(chillerStagingAdvisor?.current?.comboCop),
      stationCop: asFiniteNumber(chillerStagingAdvisor?.current?.stationCop),
      sampleTotal,
      currentCombinationSamples,
      targetCombinationSamples,
      recommendationAction: chillerStagingAdvisor?.recommendation?.action || null,
      targetCombination: chillerStagingAdvisor?.recommendation?.targetCombination || []
    },
    findings: dedupeSteps([
      runningCombination.length ? `当前运行组合：${runningCombination.join("+")}。` : "",
      sampleTotal !== null ? `已归集组合样本 ${sampleTotal} 条。` : "",
      chillerStagingAdvisor?.recommendation?.reason || ""
    ]),
    blockers,
    warnings,
    evidence: [
      buildDiagnosticEvidence("runningCount", "运行主机台数", runningCombination.length),
      buildDiagnosticEvidence("comboCop", "主机组合COP", asFiniteNumber(chillerStagingAdvisor?.current?.comboCop)),
      buildDiagnosticEvidence("stationCop", "冷站COP", asFiniteNumber(chillerStagingAdvisor?.current?.stationCop)),
      buildDiagnosticEvidence("sampleTotal", "组合样本总量", sampleTotal)
    ],
    suggestions: [
      "继续积累单机窗口和组合窗口样本，按同负荷/相近湿球/相近供水温比较。",
      "主机健康诊断后续可加入同负荷下功率偏高、冷凝温差异常、启停次数和故障率。"
    ]
  };
}

function buildDiagnosticReadinessMatrix({
  pointSummary,
  historyWindow,
  items,
  towerApproachAdvisor,
  pumpDeltaTAdvisor,
  chillerStagingAdvisor,
  controlLedgerEvidence
}) {
  const itemByKey = new Map((Array.isArray(items) ? items : []).map((item) => [item.key, item]));
  const counts = pointSummary?.counts || {};
  const keywordCounts = counts.keywordCounts || {};
  const registerPoints = asFiniteNumber(counts.registerPoints);
  const branchCount = asFiniteNumber(counts.branchCount);
  const pumpFrequency = pointSummary?.keySignals?.pumpFrequency || {};
  const hasHistoryWindow = Array.isArray(historyWindow?.series) && historyWindow.series.length > 0;
  const hasPumpFrequency =
    asFiniteNumber(pumpFrequency.chilledAvgHz) !== null || asFiniteNumber(pumpFrequency.coolingAvgHz) !== null;
  const hasPumpPower =
    asFiniteNumber(pointSummary?.keySignals?.power?.runningChilledPumpPowerKw) !== null ||
    asFiniteNumber(pointSummary?.keySignals?.power?.runningCoolingPumpPowerKw) !== null;
  const hasValveSignals =
    asFiniteNumber(pointSummary?.keySignals?.chilledWater?.bypassValveOpenPct) !== null ||
    asFiniteNumber(keywordCounts["阀"]) !== null;
  const sampleSummary = chillerStagingAdvisor?.evidence?.sampleSummary || chillerStagingAdvisor?.sampleEvidence?.sampleSummary || {};
  const chillerSampleTotal = asFiniteNumber(sampleSummary.sampleTotal);
  const chillerSampleReady =
    chillerStagingAdvisor?.status === "ready" && chillerSampleTotal !== null && chillerSampleTotal >= CHILLER_STAGING_MIN_SAMPLE_COUNT;
  const terminalSafetyReady = pumpDeltaTAdvisor?.safetyPreconditions?.terminalSafetyReady === true;
  const plcProtectionReady = pumpDeltaTAdvisor?.safetyPreconditions?.plcProtectionReady === true;
  const pumpFrequencyFeedbackReady = pumpDeltaTAdvisor?.safetyPreconditions?.pumpFrequencyFeedbackReady === true;

  const normalizeEntryStatus = (status, fallback = "unavailable") =>
    status === "ready" || status === "partial" || status === "unavailable" ? status : fallback;
  const entry = ({
    key,
    title,
    tier,
    status,
    currentFeasibility,
    firstVersionOutput,
    availableData,
    missingData,
    boundary,
    allowedMode,
    confidence
  }) => ({
    key,
    title,
    tier,
    status: normalizeEntryStatus(status),
    currentFeasibility,
    firstVersionOutput,
    availableData: dedupeSteps(availableData).slice(0, 6),
    missingData: dedupeSteps(missingData).slice(0, 6),
    boundary,
    allowedMode,
    confidence
  });

  const instrumentItem = itemByKey.get("instrumentDataQuality");
  const hydraulicItem = itemByKey.get("chilledHydraulicBalance");
  const lowDeltaItem = itemByKey.get("lowDeltaTRootCause");
  const towerItem = itemByKey.get("coolingTowerCapability");
  const chillerItem = itemByKey.get("chillerHealthCombination");
  const controlOscillationItem = itemByKey.get("controlOscillation");
  const ledgerReady = controlLedgerEvidence?.usableForDiagnosis === true;
  const matrixItems = [
    entry({
      key: "instrumentDataQuality",
      title: "仪表数据偏移诊断",
      tier: "A",
      status: instrumentItem?.status,
      currentFeasibility: instrumentItem?.status === "unavailable" ? "point_gap" : "can_do_v1",
      firstVersionOutput: "实时闭合校验、24h 稳态窗口 COP/功率/温差偏移复核。",
      availableData: [
        registerPoints !== null ? `${registerPoints} 个实时寄存器点` : "",
        hasHistoryWindow ? "24h COP/总功率/温差趋势" : "",
        "冷站总功率、分项功率、COP、冷冻/冷却温差"
      ],
      missingData: ["传感器校准记录", "安装位置台账", "冗余仪表或现场热平衡复核"],
      boundary: "只能提示疑似偏移和复核对象，不判定设备故障，不自动修正测点。",
      allowedMode: "read_only",
      confidence: instrumentItem?.confidence || "medium"
    }),
    entry({
      key: "chilledHydraulicBalance",
      title: "冷冻水水力平衡诊断",
      tier: "A/B",
      status: hydraulicItem?.status,
      currentFeasibility: hydraulicItem?.status === "unavailable" ? "point_gap" : "can_do_v1",
      firstVersionOutput: "站级低温差持续性、实时支路流量/压力离散度、旁通分流风险。",
      availableData: [
        branchCount !== null ? `${branchCount} 个支路线索` : "",
        hasHistoryWindow ? "24h 冷冻水温差和总功率趋势" : "",
        "冷冻总管供回水温度/压差、旁通阀反馈"
      ],
      missingData: ["支路历史趋势", "末端阀位", "末端压差", "代表房间温度"],
      boundary: "可做水力失衡风险提示，不能把实时支路差异外推为全天失衡或末端阀门故障。",
      allowedMode: "read_only",
      confidence: hydraulicItem?.confidence || "medium"
    }),
    entry({
      key: "lowDeltaTRootCause",
      title: "低温差根因诊断",
      tier: "A/B",
      status: lowDeltaItem?.status,
      currentFeasibility: lowDeltaItem?.status === "unavailable" ? "point_gap" : "can_do_v1",
      firstVersionOutput: "持续低温差、大流量小温差、旁通、支路分配和末端安全缺口排序。",
      availableData: [
        hasHistoryWindow ? "24h 低温差持续性趋势" : "",
        hasPumpFrequency ? "运行泵频率反馈" : "",
        "实时温差、泵频、旁通阀和支路线索"
      ],
      missingData: ["末端阀位/室温/压差", "支路历史趋势", "真实 PLC 降泵保护状态"],
      boundary: "只支持根因排序和 shadow 验证建议，不能自动降泵。",
      allowedMode: "read_only",
      confidence: lowDeltaItem?.confidence || "medium"
    }),
    entry({
      key: "coolingTowerCapability",
      title: "冷却塔能力诊断",
      tier: "A",
      status: towerItem?.status,
      currentFeasibility: towerItem?.status === "unavailable" ? "point_gap" : "can_do_v1",
      firstVersionOutput: "湿球、冷却水出水、Approach、塔风机/塔流量一致性复核。",
      availableData: ["实时湿球", "冷却水温度", "塔风机功率/频率", "塔侧流量/压力线索"],
      missingData: ["塔单元长周期分摊", "填料/布水现场巡检", "厂家最低冷凝器进水温确认"],
      boundary: "只生成 Approach shadow 证据，不承诺自动调塔或突破最低水温保护。",
      allowedMode: towerApproachAdvisor?.executionMode === "shadow" ? "shadow_review" : "read_only",
      confidence: towerItem?.confidence || "medium"
    }),
    entry({
      key: "chillerCombinationOptimization",
      title: "主机组合优化",
      tier: "A/B",
      status: chillerStagingAdvisor?.status || chillerItem?.status,
      currentFeasibility:
        chillerStagingAdvisor?.status === "unavailable"
          ? "point_gap"
          : chillerSampleReady
            ? "can_do_v1"
            : "directional_review",
      firstVersionOutput: "当前组合、组合容量、组合负荷率、组合 COP/冷站 COP、候选组合样本置信度。",
      availableData: ["当前运行组合", "主机总功率", "冷站功率/COP", chillerSampleTotal !== null ? `组合样本 ${chillerSampleTotal} 条` : ""],
      missingData: ["组合历史样本", "当前组合连续运行时间", "同工况人工切换验证"],
      boundary: "多机无单台冷冻水流量时只评价组合，不拆分单台主机实时 COP，不自动启停主机。",
      allowedMode: "shadow_review",
      confidence: chillerStagingAdvisor?.confidence || chillerItem?.confidence || "low"
    }),
    entry({
      key: "chillerHealthDegradation",
      title: "主机健康劣化诊断",
      tier: "B",
      status: chillerItem?.status === "unavailable" ? "unavailable" : "partial",
      currentFeasibility: chillerItem?.status === "unavailable" ? "point_gap" : "directional_review",
      firstVersionOutput: "同组合/同负荷下冷站 COP 漂移、功率偏高和故障风险提示。",
      availableData: ["主机运行状态", "主机功率", "组合 COP/冷站 COP", "告警数量"],
      missingData: ["单台冷冻水流量", "厂家 COP 曲线", "压缩机细码/维护记录"],
      boundary: "只能输出健康风险线索；多机运行时不能做单机实时 COP 排名。",
      allowedMode: "read_only",
      confidence: "low"
    }),
    entry({
      key: "pumpEfficiency",
      title: "水泵效率诊断",
      tier: "B/C",
      status: hasPumpFrequency || hasPumpPower ? "partial" : "unavailable",
      currentFeasibility: hasPumpFrequency || hasPumpPower ? "directional_review" : "point_gap",
      firstVersionOutput: "频率/功率/压差异常、疑似偏离高效区提示。",
      availableData: [hasPumpFrequency ? "泵频率反馈" : "", hasPumpPower ? "泵功率反馈" : "", "部分总管压差/流量线索"],
      missingData: ["单泵流量", "泵曲线", "稳定压差口径", "阀位和并联泵分摊"],
      boundary: "不能输出水泵效率百分比或高置信节能结论。",
      allowedMode: "read_only",
      confidence: "low"
    }),
    entry({
      key: "valveStiction",
      title: "阀门卡滞/执行器诊断",
      tier: "B/C",
      status: hasValveSignals ? "partial" : "unavailable",
      currentFeasibility: hasValveSignals ? "directional_review" : "point_gap",
      firstVersionOutput: "阀位长期饱和、旁通分流和命令/反馈缺口提示。",
      availableData: [hasValveSignals ? "阀门/旁通反馈线索" : "", "实时阀类点位关键词"],
      missingData: ["阀门命令值", "阀门反馈值", "控制模式", "动作历史"],
      boundary: "只生成检修线索，不能直接判定阀门卡死。",
      allowedMode: "read_only",
      confidence: "low"
    }),
    entry({
      key: "controlOscillation",
      title: "控制震荡/频繁启停诊断",
      tier: "B",
      status: controlOscillationItem?.status || (hasHistoryWindow ? "partial" : "unavailable"),
      currentFeasibility: controlOscillationItem?.status === "unavailable" ? "point_gap" : "directional_review",
      firstVersionOutput: ledgerReady
        ? "温差锯齿波、总功率 hunting、现场命令/反馈台账、启停事件台账和控制参数台账证据窗口。"
        : "温差锯齿波、总功率 hunting、频率命令/反馈缺口和启停事件缺口。",
      availableData: [
        hasHistoryWindow ? "24h COP/总功率/温差趋势" : "",
        "运行状态和频率实时摘要",
        ledgerReady ? `控制台账导入 READY，${controlLedgerEvidence.acceptedRows} 行现场证据` : ""
      ],
      missingData: ledgerReady
        ? ["人工对齐负荷扰动/告警/控制模式", "参数变更审批与回退记录"]
        : ["高频历史", "控制命令历史", "PID 参数", "精确启停事件"],
      boundary: "只能提示震荡风险，不自动改 PID，不自动启停设备。",
      allowedMode: "read_only",
      confidence: controlOscillationItem?.confidence || "low"
    }),
    entry({
      key: "terminalComfortProtection",
      title: "末端舒适/缺冷风险诊断",
      tier: "C",
      status: terminalSafetyReady ? "partial" : "unavailable",
      currentFeasibility: terminalSafetyReady ? "directional_review" : "point_gap",
      firstVersionOutput: "代表末端缺冷风险、降泵前安全闭锁和投诉状态复核。",
      availableData: [terminalSafetyReady ? "已有部分末端安全信号" : "", plcProtectionReady ? "PLC 本地保护已配置" : "", pumpFrequencyFeedbackReady ? "泵频反馈已闭合" : ""],
      missingData: ["代表房间温度", "末端阀位", "末端压差", "缺冷投诉/工单联动"],
      boundary: "未闭合末端安全前，泵频建议只能 shadow/审阅，不允许 assisted 或 enforced。",
      allowedMode: "point_plan",
      confidence: terminalSafetyReady ? "low" : "low"
    })
  ];
  const readyNowCount = matrixItems.filter((item) => item.currentFeasibility === "can_do_v1").length;
  const directionalCount = matrixItems.filter((item) => item.currentFeasibility === "directional_review").length;
  const pointGapCount = matrixItems.filter((item) => item.currentFeasibility === "point_gap").length;

  return {
    basis: "available_runtime_history_and_safety_signals",
    scope: "optimize_demo_read_only_extension",
    total: matrixItems.length,
    readyNowCount,
    directionalCount,
    pointGapCount,
    controlBoundary: "read_only_or_shadow_only",
    boundaryNotes: [
      "A档可进入 /optimize-demo 作为 V1 只读诊断或 shadow 证据。",
      "B档只能输出疑似风险、待复核和样本治理建议。",
      "C档只进入点位改造清单，不能输出正式诊断结论。",
      "所有项均不新增真实 PLC 下发、自动启停或 enforced 能力。"
    ],
    items: matrixItems
  };
}

function buildFieldVerificationChecklist(diagnosticReadinessMatrix) {
  const matrixItems = Array.isArray(diagnosticReadinessMatrix?.items) ? diagnosticReadinessMatrix.items : [];
  const itemByKey = new Map(matrixItems.map((item) => [item?.key, item]).filter(([key]) => typeof key === "string" && key));
  const pickMissingData = (key, fallback = []) => {
    const item = itemByKey.get(key);
    return dedupeSteps(Array.isArray(item?.missingData) ? item.missingData : fallback).slice(0, 6);
  };
  const buildTask = ({
    key,
    priority,
    title,
    sourceDiagnosticKey,
    sourceTier,
    verificationTarget,
    requiredEvidence,
    reason,
    missingData,
    acceptanceCriteria,
    boundary,
    ownerRole,
    allowedMode = "field_review_only"
  }) => ({
    key,
    priority,
    title,
    sourceDiagnosticKey,
    sourceTier,
    verificationTarget,
    requiredEvidence: dedupeSteps(requiredEvidence).slice(0, 5),
    reason,
    missingData: dedupeSteps(missingData).slice(0, 6),
    acceptanceCriteria,
    boundary,
    ownerRole,
    allowedMode
  });
  const tasks = [
    buildTask({
      key: "sensor-calibration-installation-ledger",
      priority: "P0",
      title: "补传感器校准与安装位置台账",
      sourceDiagnosticKey: "instrumentDataQuality",
      sourceTier: itemByKey.get("instrumentDataQuality")?.tier || "A",
      verificationTarget: "冷量表、总功率表、冷冻/冷却供回水温度、湿球温度",
      requiredEvidence: ["点位编号", "安装位置", "量程", "最近校准日期", "校准责任人"],
      reason: "仪表偏移诊断当前只能提示疑似偏移；缺校准和安装位置时不能判定仪表故障。",
      missingData: pickMissingData("instrumentDataQuality", ["传感器校准记录", "安装位置台账"]),
      acceptanceCriteria: "形成点位-位置-量程-校准日期-责任人台账，并能对应到 BFF 点位 key。",
      boundary: "只用于提高诊断置信度，不自动修正测点、不替代现场校验。",
      ownerRole: "自控工程师 / 计量校准人员"
    }),
    buildTask({
      key: "terminal-safety-signal-closure",
      priority: "P0",
      title: "闭合末端安全信号",
      sourceDiagnosticKey: "terminalComfortProtection",
      sourceTier: itemByKey.get("terminalComfortProtection")?.tier || "C",
      verificationTarget: "代表房间温度、末端阀位、末端压差、缺冷投诉/工单",
      requiredEvidence: ["至少一类末端安全信号可读", "采样周期", "缺冷判定阈值", "与泵频建议的闭锁关系"],
      reason: "末端安全未闭合时，泵频建议只能 shadow/审阅，不能进入 assisted 或 enforced。",
      missingData: pickMissingData("terminalComfortProtection", ["代表房间温度", "末端阀位", "末端压差"]),
      acceptanceCriteria: "泵降频前可读取末端安全状态，并能明确缺冷时阻断建议。",
      boundary: "只作为降泵前置保护证据；未闭合前不允许 assisted/enforced，不生成真实降泵命令。",
      ownerRole: "自控工程师 / 运维值班负责人"
    }),
    buildTask({
      key: "plc-pump-protection-mapping",
      priority: "P0",
      title: "确认 PLC 泵频保护与回退点",
      sourceDiagnosticKey: "lowDeltaTRootCause",
      sourceTier: itemByKey.get("lowDeltaTRootCause")?.tier || "A/B",
      verificationTarget: "冷冻泵频率目标点、回退点、最小流量、频率上下限、斜率限制",
      requiredEvidence: ["真实 PLC/SCADA 点名", "回退目标", "本地联锁", "最小流量保护", "频率反馈"],
      reason: "当前低温差根因可排序，但真实降泵必须由 PLC 本地保护兜底。",
      missingData: pickMissingData("lowDeltaTRootCause", ["真实 PLC 降泵保护状态", "末端阀位/室温/压差"]),
      acceptanceCriteria: "approve/rollback 点名、反馈点和 PLC 本地保护均完成映射并通过只读核对。",
      boundary: "未完成前只允许 shadow 记录和人工复核，不允许 assisted/enforced。",
      ownerRole: "PLC 工程师 / 自控工程师"
    }),
    buildTask({
      key: "chiller-combination-sampling-plan",
      priority: "P0",
      title: "制定主机组合样本采集计划",
      sourceDiagnosticKey: "chillerCombinationOptimization",
      sourceTier: itemByKey.get("chillerCombinationOptimization")?.tier || "A/B",
      verificationTarget: "CH4+CH5+CH7 等当前组合及候选组合",
      requiredEvidence: ["组合连续运行时长", "同负荷/湿球 band", "组合 COP", "冷站 COP", "人工切换记录"],
      reason: "组合样本不足时只能 keep/continue sampling，不能承诺换机节能。",
      missingData: pickMissingData("chillerCombinationOptimization", ["组合历史样本", "当前组合连续运行时间", "同工况人工切换验证"]),
      acceptanceCriteria: "每个候选组合形成 >=30 条低置信可用样本，>=100 条才允许高置信表达。",
      boundary: "多机运行无单台冷冻水流量时仍只评价组合，不拆单台 COP，不自动启停主机。",
      ownerRole: "节能工程师 / 运行值班员"
    }),
    buildTask({
      key: "branch-hydraulic-history-window",
      priority: "P1",
      title: "补支路水力历史趋势",
      sourceDiagnosticKey: "chilledHydraulicBalance",
      sourceTier: itemByKey.get("chilledHydraulicBalance")?.tier || "A/B",
      verificationTarget: "支路流量、支路回水压力、支路供回水温度、旁通阀开度",
      requiredEvidence: ["24h 支路趋势", "采样周期", "支路与末端区域映射", "异常窗口标记"],
      reason: "当前水力平衡能做站级低温差趋势和实时支路线索，但不能把实时差异外推为全天失衡。",
      missingData: pickMissingData("chilledHydraulicBalance", ["支路历史趋势", "末端阀位", "末端压差"]),
      acceptanceCriteria: "支路趋势至少覆盖 24h，并能与站级低温差窗口对齐。",
      boundary: "没有末端阀位/室温时，不直接判定末端阀门故障。",
      ownerRole: "自控工程师 / 水系统调试工程师"
    }),
    buildTask({
      key: "control-command-feedback-event-window",
      priority: "P1",
      title: "补控制命令/反馈与启停事件台账",
      sourceDiagnosticKey: "controlOscillation",
      sourceTier: itemByKey.get("controlOscillation")?.tier || "B",
      verificationTarget: "供水温设定/反馈、泵塔频率命令/反馈、旁通阀命令/反馈、主机/泵/塔启停事件",
      requiredEvidence: ["高频命令/反馈趋势", "PID/死区/斜率/延时参数", "精确启停事件", "最小运行/停机时间"],
      reason: "控制震荡/频繁启停第一版只能从小时级趋势提示风险，缺高频控制数据时不能判定 PID 或启停问题。",
      missingData: pickMissingData("controlOscillation", ["高频历史", "控制命令历史", "PID 参数", "精确启停事件"]),
      acceptanceCriteria: "命令、反馈、运行状态、启停事件和参数台账可按同一时间轴对齐。",
      boundary: "只用于复核控制震荡风险，不自动改 PID，不自动启停设备。",
      ownerRole: "自控工程师 / PLC 工程师"
    }),
    buildTask({
      key: "tower-field-inspection-ledger",
      priority: "P1",
      title: "补冷却塔现场巡检和长周期分摊",
      sourceDiagnosticKey: "coolingTowerCapability",
      sourceTier: itemByKey.get("coolingTowerCapability")?.tier || "A",
      verificationTarget: "塔单元流量、风机频率/功率、阀门状态、填料/布水巡检",
      requiredEvidence: ["塔单元长周期趋势", "塔阀开到位", "填料/布水状态", "最低冷凝器进水温确认"],
      reason: "Approach shadow 可做，但塔能力劣化需要长周期分摊和现场状态支撑。",
      missingData: pickMissingData("coolingTowerCapability", ["塔单元长周期分摊", "填料/布水现场巡检"]),
      acceptanceCriteria: "塔单元趋势和现场巡检记录可支撑单塔能力差异复核。",
      boundary: "只作为塔能力诊断证据，不突破厂家/PLC 最低水温保护。",
      ownerRole: "运行值班员 / 节能工程师"
    })
  ];
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  const sortedTasks = tasks.sort((left, right) => {
    const leftRank = priorityOrder[left.priority] ?? 99;
    const rightRank = priorityOrder[right.priority] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.key.localeCompare(right.key);
  });
  return {
    basis: "diagnostic_readiness_missing_data_to_field_tasks",
    scope: "optimize_demo_field_verification_only",
    controlBoundary: "read_only_point_verification_only",
    total: sortedTasks.length,
    p0Count: sortedTasks.filter((item) => item.priority === "P0").length,
    p1Count: sortedTasks.filter((item) => item.priority === "P1").length,
    items: sortedTasks
  };
}

function buildOperationalDiagnosticsAdvisor(
  config,
  request,
  baseline,
  gate,
  freshness,
  context,
  towerApproachAdvisor,
  pumpDeltaTAdvisor,
  chillerStagingAdvisor
) {
  const pointSummary = readOperationalPointSummary(context);
  const historyWindow = readOperationalDiagnosticsHistoryWindow(context);
  const controlLedgerEvidence = readControlLedgerImportEvidence(context);
  const fieldDataPreflightEvidence = readFieldDataPreflightEvidence(context);
  const fieldDataPromoteEvidence = readFieldDataPromoteEvidence(context);
  const sensorLedgerPreflightEvidence = readSensorLedgerPreflightEvidence(context);
  const fieldCollectionPackageEvidence = readFieldCollectionPackageEvidence(context);
  const driftWindow = buildInstrumentDriftWindow(historyWindow);
  const hydraulicTrendWindow = buildChilledHydraulicTrendWindow(historyWindow);
  const items = [
    buildInstrumentDataQualityDiagnostic(
      pointSummary,
      request,
      baseline,
      freshness,
      config,
      historyWindow,
      sensorLedgerPreflightEvidence
    ),
    buildChilledHydraulicBalanceDiagnostic(pointSummary, baseline, historyWindow),
    buildControlOscillationDiagnostic(pointSummary, historyWindow, controlLedgerEvidence, fieldDataPreflightEvidence, fieldDataPromoteEvidence),
    buildLowDeltaTRootCauseDiagnostic(pointSummary, baseline, pumpDeltaTAdvisor, hydraulicTrendWindow),
    buildCoolingTowerCapabilityDiagnostic(pointSummary, baseline, towerApproachAdvisor),
    buildChillerHealthCombinationDiagnostic(pointSummary, chillerStagingAdvisor)
  ];
  const diagnosticReadinessMatrix = buildDiagnosticReadinessMatrix({
    pointSummary,
    historyWindow,
    items,
    towerApproachAdvisor,
    pumpDeltaTAdvisor,
    chillerStagingAdvisor,
    controlLedgerEvidence
  });
  const fieldVerificationChecklist = buildFieldVerificationChecklist(diagnosticReadinessMatrix);
  const lowDeltaTRootCauseItem = items.find((item) => item.key === "lowDeltaTRootCause");
  const lowDeltaTrendLinkage = lowDeltaTRootCauseItem?.current?.trendLinkage || null;
  const controlOscillationItem = items.find((item) => item.key === "controlOscillation");
  const controlOscillationCurrent = controlOscillationItem?.current || null;
  const readyCount = items.filter((item) => item.status === "ready").length;
  const partialCount = items.filter((item) => item.status === "partial").length;
  const unavailableCount = items.filter((item) => item.status === "unavailable").length;
  const blockerCount = items.reduce((sum, item) => sum + (Array.isArray(item.blockers) ? item.blockers.length : 0), 0);
  const warningCount = items.reduce((sum, item) => sum + (Array.isArray(item.warnings) ? item.warnings.length : 0), 0);
  const status =
    unavailableCount === items.length
      ? "unavailable"
      : unavailableCount > 0 || partialCount > 0
        ? "partial"
        : "ready";

  return {
    status,
    executionMode: "read_only",
    basis: "runtime_point_consistency",
    summary: {
      readyCount,
      partialCount,
      unavailableCount,
      blockerCount,
      warningCount,
      pointCoverage: pointSummary?.counts || {
        deviceRows: 0,
        registerPoints: 0
      },
	      pointDictionary: pointSummary?.pointDictionary || {
	        applied: false,
	        source: null
	      },
	      historyWindow: {
	        status: driftWindow.status,
	        range: driftWindow.range,
	        readyMetricCount: driftWindow.readyMetricCount || 0,
	        observedMetricCount: driftWindow.observedMetricCount || 0,
	        steadyState: driftWindow.steadyState
	          ? {
	              status: driftWindow.steadyState.status,
	              basisMetric: driftWindow.steadyState.basisMetric || null,
	              sampleCount: driftWindow.steadyState.sampleCount || 0,
	              thresholdRangePct: driftWindow.steadyState.thresholdRangePct ?? null,
	        rangePct: driftWindow.steadyState.rangePct ?? null
	      }
	    : null
	      },
	      hydraulicTrend: {
	        status: hydraulicTrendWindow.status,
	        range: hydraulicTrendWindow.range,
	        persistentLowDeltaT: hydraulicTrendWindow.persistentLowDeltaT,
	        sampleCount: hydraulicTrendWindow.chilledDeltaT?.sampleCount || 0,
	        lowDeltaTPct: hydraulicTrendWindow.chilledDeltaT?.belowPct ?? null
	      },
		      lowDeltaTRootCause: {
	        status: lowDeltaTrendLinkage?.status || "unavailable",
	        persistentLowDeltaT: lowDeltaTrendLinkage?.persistentLowDeltaT === true,
	        topCandidate: Array.isArray(lowDeltaTrendLinkage?.candidates) && lowDeltaTrendLinkage.candidates.length
	          ? lowDeltaTrendLinkage.candidates[0].key
	          : null,
	        pumpShadowReady: lowDeltaTrendLinkage?.pumpShadowReady === true
		      },
      instrumentDataQuality: {
        status: items.find((item) => item.key === "instrumentDataQuality")?.status || "unavailable",
        sensorLedgerPreflightStatus: sensorLedgerPreflightEvidence.status,
        sensorLedgerReadyForReview: sensorLedgerPreflightEvidence.readyForReview === true,
        sensorLedgerAcceptedRows: sensorLedgerPreflightEvidence.acceptedRows || 0,
        sensorLedgerExpiredCalibrationCount: sensorLedgerPreflightEvidence.expiredCalibrationCount || 0,
        sensorLedgerMissingRangeCount: sensorLedgerPreflightEvidence.missingRangeCount || 0
      },
      fieldCollectionPackageEvidence: {
        status: fieldCollectionPackageEvidence.status,
        finalDecision: fieldCollectionPackageEvidence.finalDecision,
        readyToCollect: fieldCollectionPackageEvidence.readyToCollect === true,
        generatedAt: fieldCollectionPackageEvidence.generatedAt,
        reportPath: fieldCollectionPackageEvidence.reportPath,
        formalInputCount: fieldCollectionPackageEvidence.formalInputCount,
        missingFormalInputCount: fieldCollectionPackageEvidence.missingFormalInputCount,
        presentFormalInputCount: fieldCollectionPackageEvidence.presentFormalInputCount,
        templateCount: fieldCollectionPackageEvidence.templateCount,
        blockersCount: fieldCollectionPackageEvidence.blockersCount,
        warningsCount: fieldCollectionPackageEvidence.warningsCount,
        formalInputs: fieldCollectionPackageEvidence.formalInputs,
        controlBoundary: fieldCollectionPackageEvidence.controlBoundary
      },
		      controlOscillation: {
	        status: controlOscillationItem?.status || "unavailable",
	        activeRiskCount: controlOscillationCurrent?.activeRiskCount ?? 0,
	        watchRiskCount: controlOscillationCurrent?.watchRiskCount ?? 0,
	        gapCount: controlOscillationCurrent?.gapCount ?? 0,
	        maxDirectionChangeCount: controlOscillationCurrent?.trendWindow?.maxDirectionChangeCount ?? 0,
	        ledgerEvidenceStatus: controlOscillationCurrent?.ledgerEvidence?.status || "unavailable",
	        ledgerEvidenceMode: controlOscillationCurrent?.ledgerEvidence?.evidenceMode || "missing",
	        ledgerAcceptedRows: controlOscillationCurrent?.ledgerEvidence?.acceptedRows || 0,
	        ledgerUsableForDiagnosis: controlOscillationCurrent?.ledgerEvidence?.usableForDiagnosis === true,
	        fieldDataPreflightStatus: controlOscillationCurrent?.ledgerEvidence?.preflight?.status || "unavailable",
	        fieldDataPreflightReadyForImport: controlOscillationCurrent?.ledgerEvidence?.preflight?.readyForImport === true,
	        fieldDataPreflightMissingInputCount: controlOscillationCurrent?.ledgerEvidence?.preflight?.missingInputCount || 0,
	        fieldDataPromoteStatus: controlOscillationCurrent?.ledgerEvidence?.promotion?.status || "unavailable",
	        fieldDataPromoteFormalImportReady: controlOscillationCurrent?.ledgerEvidence?.promotion?.formalImportReady === true
	      },
	      diagnosticReadinessMatrix,
	      fieldVerificationChecklist,
	      gateLevel: gate?.level || null
	    },
	    items,
	    disclaimers: [
	      "本 Advisor 只做诊断和 shadow 评审证据，不新增真实 PLC 下发能力。",
	      "无单台冷冻水流量时，多机运行只评价组合 COP / 冷站 COP，不计算多机单台 COP。",
	      "仪表漂移第一版只基于 24h 趋势输出疑似复核建议，不直接判定仪表故障或校准结论。",
	      "控制震荡第一版只提示温差锯齿波、总功率 hunting 和启停证据缺口，不自动改 PID，不自动启停设备。"
	    ]
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

function buildReviewReadiness(baseline, historyBenchmark, gate, freshness, config) {
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
  const thermalUnbalanceRate = asFiniteNumber(baseline?.thermalUnbalanceRate);
  const freshnessStale = isDraftFreshnessStale(config, freshness);
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

  if (freshnessStale) {
    hints.push("先刷新 dashboard/overview 与 anomaly summary，确认 live 快照已恢复到新鲜窗口");
    hints.push("快照未恢复前，只允许做方向性评审，不要直接提交审批");
    hints.push("若现场状态变化较快，先核对趋势页再回到优化页");
    return {
      status: "partial",
      score: clampScore(59 + confidenceAdjustment),
      reason: "现态快照已超出新鲜度阈值，当前只适合方向性评审",
      missingSignals: [],
      hints
    };
  }

  if (isHighThermalUnbalance(thermalUnbalanceRate)) {
    hints.push("先处理冷冻/冷却侧热平衡，再评审节能优先方案");
    hints.push("优先核对温差、旁通和泵塔协同，不要直接追求更低功率");
    hints.push("热平衡恢复后，再回看 benchmark 锚定的效率区间");
    return {
      status: gateLevel === "ready" ? "partial" : "partial",
      score: clampScore((gateLevel === "ready" ? 64 : 58) + confidenceAdjustment),
      reason: `热平衡偏差 ${formatThermalUnbalancePct(thermalUnbalanceRate)}% 偏高，建议先恢复平衡再推进优化`,
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
      availabilityReasonCode: "rated_cooling_capacity_missing",
      note: "首版采用草案筛选口径按负荷率区间与湿球边界做匹配，不执行真实控制；当前缺少额定制冷能力，无法完成历史对标。",
      source: buildHistoryBenchmarkSourceEntry(siteId, {
        status: "unavailable",
        availabilityReasonCode: "rated_cooling_capacity_missing",
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
    const availabilityReasonCode =
      summary.matchingTier === "load-wetbulb-strict"
        ? "history_match_strict"
        : summary.matchingTier === "load-wetbulb-relaxed"
          ? "history_match_relaxed"
          : summary.matchingTier === "load-only-fallback"
            ? "history_match_load_only"
            : summary.status === "partial"
              ? "history_match_partial"
              : "history_match_ready";

    return {
      mode: "load-band",
      ...summary,
      availabilityReasonCode,
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
        availabilityReasonCode,
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
      availabilityReasonCode: "history_samples_unavailable",
      note: "历史对标采用草案筛选口径按负荷区间与湿球边界回退，不执行真实控制；当前占比与日历样本均不可用。",
      source: buildHistoryBenchmarkSourceEntry(siteId, {
        status: "unavailable",
        availabilityReasonCode: "history_samples_unavailable",
        sampleCount: 0
      })
    });
  }

  return {
    mode: "load-band",
    ...calendarSummary,
    availabilityReasonCode: "history_calendar_fallback",
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
        availabilityReasonCode: "history_calendar_fallback",
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

function buildDeviceActionPlan(request, baseline, historyBenchmark, gate, schemeKey, freshness, config) {
  const actions = [];
  const chilledDeltaT = asFiniteNumber(baseline?.chilledDeltaT);
  const coolingDeltaT = asFiniteNumber(baseline?.coolingDeltaT);
  const systemCop = asFiniteNumber(baseline?.systemCop);
  const totalPowerKw = asFiniteNumber(baseline?.totalPowerKw);
  const chillerPowerKw = asFiniteNumber(baseline?.chillerPowerKw);
  const benchmarkCopMedian = asFiniteNumber(historyBenchmark?.referenceCop?.median);
  const benchmarkCopHigh = asFiniteNumber(historyBenchmark?.referenceCop?.high);
  const thermalUnbalanceRate = asFiniteNumber(baseline?.thermalUnbalanceRate);

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

  if (isDraftFreshnessStale(config, freshness)) {
    actions.push({
      system: "system",
      action: "先确认实时快照是否仍代表现场",
      target: "刷新 overview 与 anomaly summary 后再推进审批",
      reason: "当前 live 快照已超出新鲜度阈值，策略只应作为方向性参考",
      risk: "medium",
      priority: "high",
      preconditions: ["dashboard/overview 已恢复到新鲜窗口", "关键测点最近一轮刷新成功"]
    });
  }

  if (isHighThermalUnbalance(thermalUnbalanceRate)) {
    actions.push({
      system: "system",
      action: "优先恢复热平衡",
      target: "先查冷冻/冷却侧温差、旁通与泵塔协同，再考虑追求更低功率",
      reason: `当前热平衡偏差 ${formatThermalUnbalancePct(thermalUnbalanceRate)}% 偏高，先恢复系统平衡比追求效率更重要`,
      risk: schemeKey === "efficiencyFirst" ? "high" : "medium",
      priority: "high",
      preconditions: ["冷热侧关键温差连续可用", "现场确认旁通与泵塔控制可调整"]
    });
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
  reviewReadiness,
  freshness,
  config
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

    const deviceActions = buildDeviceActionPlan(request, baseline, historyBenchmark, gate, scheme.key, freshness, config);

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

function buildDecisionSummary(request, overview, anomalies, recommendations, historyBenchmark, executionFeedback) {
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
    const executionText = executionFeedback?.summary ? `; execution feedback ${executionFeedback.summary}` : "";
    return `context-backed draft derived from overview, anomalies (${totalAlarms}), and recommendation cards (${cards}); requested scenario ${scenarioText}${benchmarkText}${executionText}`;
  }
  const executionText = executionFeedback?.summary ? `; execution feedback ${executionFeedback.summary}` : "";
  return `context-backed draft derived from current station overview; no recommendation cards matched, requested scenario ${scenarioText}${benchmarkText}${executionText}`;
}

export async function buildOptimizeDraftResponse(config, siteId, request, context = {}) {
  const overview = context.overview || null;
  const anomalies = context.anomalies || null;
  const recommendations = context.recommendations || null;
  const recentExecutions = Array.isArray(context.recentExecutions) ? context.recentExecutions : [];
  const baseline = buildBaseline(overview, anomalies);
  const freshness = buildDraftFreshness(overview, anomalies);
  const decisionConfidence = buildDecisionConfidence(overview, anomalies, recommendations, freshness, config);
  const recommendationSteps = buildDraftSteps(request, overview, anomalies, recommendations, baseline, freshness, config);
  const adaptiveGuardrail = buildExecutionAdaptiveGuardrail(recentExecutions);
  const gate = buildGate(anomalies, decisionConfidence, baseline, freshness, config, adaptiveGuardrail);
  const scenarioEstimate = buildScenarioEstimate(request, overview);
  const historyBenchmarkBundle = await loadHistoryBenchmarkReports(
    config,
    siteId,
    request,
    baseline,
    context
  );
  const { source: historyBenchmarkSource, ...historyBenchmark } = historyBenchmarkBundle;
  const benefitEstimate = buildBenefitEstimate(request, baseline, historyBenchmark);
  const reviewReadiness = buildReviewReadiness(baseline, historyBenchmark, gate, freshness, config);
  const towerApproachAdvisor = buildTowerApproachAdvisor(
    config,
    request,
    baseline,
    historyBenchmark,
    benefitEstimate,
    gate
  );
  const pumpDeltaTAdvisor = buildPumpDeltaTAdvisor(
    config,
    request,
    baseline,
    gate,
    freshness
  );
  const chillerStagingAdvisor = buildChillerStagingAdvisor(
    config,
    request,
    baseline,
    historyBenchmark,
    gate,
    freshness,
    context
  );
  const operationalDiagnosticsAdvisor = buildOperationalDiagnosticsAdvisor(
    config,
    request,
    baseline,
    gate,
    freshness,
    context,
    towerApproachAdvisor,
    pumpDeltaTAdvisor,
    chillerStagingAdvisor
  );
  const schemes = buildSchemes(
    siteId,
    request,
    gate,
    recommendations,
    recommendationSteps,
    scenarioEstimate,
    baseline,
    historyBenchmark,
    reviewReadiness,
    freshness,
    config
  );
  const executionFeedback = buildExecutionFeedback(schemes, {
    ...context,
    recentExecutions
  });

  return {
    site: {
      siteId
    },
    decision: {
      summary: buildDecisionSummary(request, overview, anomalies, recommendations, historyBenchmark, executionFeedback),
      confidence: decisionConfidence
    },
    request: {
      loadKw: request.loadKw,
      outdoorTempC: request.outdoorTempC,
      mode: request.mode
    },
    recommendation: {
      systemCop: asPositiveNumber(overview?.energyCards?.currentCop),
      totalPowerKw: asFiniteNumber(overview?.energyCards?.totalPowerKw),
      steps: recommendationSteps
    },
    gate,
    baseline,
    historyBenchmark,
    benefitEstimate,
    towerApproachAdvisor,
    pumpDeltaTAdvisor,
    chillerStagingAdvisor,
    operationalDiagnosticsAdvisor,
    reviewReadiness,
    executionFeedback,
    schemes,
    ruleEvidence: buildRuleEvidence(recommendations),
    draftLabel: "主机组合 / 冷却塔接近度 / 泵温差导向 L4 建议",
    diagnostics: buildDraftDiagnostics(overview, anomalies, recommendations, historyBenchmark, executionFeedback),
    freshness,
    sourceStatus: buildSourceStatus([
      createSourceEntry(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview?.sourceStatus,
        "dashboard overview unavailable",
        {
          missingSnapshotCode: "baseline_snapshot_missing",
          requiredSnapshot: [
            {
              key: "baseline.systemCop",
              value: baseline?.systemCop
            },
            {
              key: "baseline.totalPowerKw",
              value: baseline?.totalPowerKw
            }
          ]
        }
      ),
      createSourceEntry(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies?.sourceStatus,
        "anomaly summary unavailable",
        {
          missingSnapshotCode: "alarm_snapshot_missing",
          requiredSnapshot: [
            {
              key: "anomalies.counts.total",
              value: anomalies?.counts?.total
            }
          ]
        }
      ),
      createSourceEntry(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations?.sourceStatus,
        "recommendations unavailable",
        {
          missingSnapshotCode: "recommendation_cards_missing",
          requiredSnapshot: [
            {
              key: "recommendations.cards",
              value: Array.isArray(recommendations?.cards) ? recommendations.cards.length : null
            }
          ]
        }
      ),
      context?.chillerStagingRuntimeContext?.sourceStatus
        ? createSourceEntry(
            "chillerStagingRuntime",
            `/bff/v1/sites/${siteId}/devices/tree`,
            context.chillerStagingRuntimeContext.sourceStatus,
            "chiller staging runtime context unavailable",
            {
              missingSnapshotCode: "chiller_staging_runtime_missing",
              requiredSnapshot: [
                {
                  key: "chillerStagingRuntime.currentCombination",
                  value: Array.isArray(context.chillerStagingRuntimeContext.currentCombination)
                    ? context.chillerStagingRuntimeContext.currentCombination.length
                    : null
                }
              ]
            }
          )
        : null,
      historyBenchmarkSource || null,
      {
        key: "optimizeEngine",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: true,
        reasonCode: "advisor_result_ready",
        status: null,
        message: "chiller staging, tower approach and pump delta-t advisor result generated",
        error: null,
        rows: null
      },
      {
        key: "pumpDeltaTAdvisor",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: pumpDeltaTAdvisor.status !== "unavailable",
        reasonCode:
          pumpDeltaTAdvisor.status === "ready"
            ? "pump_delta_t_advisor_ready"
            : pumpDeltaTAdvisor.status === "partial"
              ? "pump_delta_t_advisor_partial"
              : "pump_delta_t_advisor_blocked",
        status: null,
        message: pumpDeltaTAdvisor.reason,
        error: null,
        rows: null
      },
      {
        key: "chillerStagingAdvisor",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: chillerStagingAdvisor.status !== "unavailable",
        reasonCode:
          chillerStagingAdvisor.status === "ready"
            ? "chiller_staging_advisor_ready"
            : chillerStagingAdvisor.status === "partial"
              ? "chiller_staging_advisor_partial"
              : "chiller_staging_advisor_blocked",
        status: null,
        message: chillerStagingAdvisor.reason,
        error: null,
        rows: Array.isArray(chillerStagingAdvisor.candidates) ? chillerStagingAdvisor.candidates.length : null
      },
      {
        key: "operationalDiagnosticsAdvisor",
        endpoint: `/bff/v1/sites/${siteId}/optimize`,
        ok: operationalDiagnosticsAdvisor.status !== "unavailable",
        reasonCode:
          operationalDiagnosticsAdvisor.status === "ready"
            ? "operational_diagnostics_ready"
            : operationalDiagnosticsAdvisor.status === "partial"
              ? "operational_diagnostics_partial"
              : "operational_diagnostics_unavailable",
        status: null,
        message: `ready=${operationalDiagnosticsAdvisor.summary.readyCount}, partial=${operationalDiagnosticsAdvisor.summary.partialCount}, unavailable=${operationalDiagnosticsAdvisor.summary.unavailableCount}`,
        error: operationalDiagnosticsAdvisor.status === "unavailable" ? "operational diagnostics unavailable" : null,
        rows: Array.isArray(operationalDiagnosticsAdvisor.items) ? operationalDiagnosticsAdvisor.items.length : null
      }
    ].filter(Boolean)),
    generatedAt: buildGeneratedAt(config)
  };
}

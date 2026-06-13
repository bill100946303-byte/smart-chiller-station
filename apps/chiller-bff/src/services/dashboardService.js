import { loadDeviceSummary } from "../adapters/legacyDeviceAdapter.js";
import { loadEnergyOverview, loadTrendSeries } from "../adapters/legacyEnergyAdapter.js";
import { loadRealtimeHomepageSnapshot } from "../adapters/legacyHomepageRealtimeAdapter.js";
import { loadRealtimeParametersSnapshot } from "../adapters/realtimeParametersAdapter.js";
import { loadB25CloudTrendSeries, shouldUseB25CloudHistory } from "../adapters/b25CloudHistoryAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { annotateSourceEntry, buildSourceStatus } from "./sourceStatusService.js";

const DASHBOARD_TRENDS_CACHE_TTL_MS = 5 * 1000;
const dashboardTrendsCache = new Map();
const TEN_MINUTE_TREND_STEP_MS = 10 * 60 * 1000;
const TREND_RANGE_SPECS = {
  "24h": { count: 24, stepMs: 60 * 60 * 1000, unit: "hour" },
  "7d": { count: 7 * 24, stepMs: 60 * 60 * 1000, unit: "hour" },
  "30d": { count: 30 * 24, stepMs: 60 * 60 * 1000, unit: "hour" }
};

function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTimestampMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function floorToUtcHour(ms) {
  const date = new Date(ms);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0
  );
}

function floorToUtcDay(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
}

function resolveTrendRangeSpec(range, options = {}) {
  const baseSpec = TREND_RANGE_SPECS[range] || TREND_RANGE_SPECS["24h"];
  const preferredStepMs =
    typeof options.stepMs === "number" && Number.isFinite(options.stepMs) && options.stepMs > 0
      ? options.stepMs
      : null;
  if (range === "24h" && preferredStepMs !== null && preferredStepMs < baseSpec.stepMs) {
    return {
      ...baseSpec,
      count: Math.floor((24 * 60 * 60 * 1000) / preferredStepMs),
      stepMs: preferredStepMs,
      unit: "interval"
    };
  }
  return baseSpec;
}

function floorTrendBucket(ms, range, spec = resolveTrendRangeSpec(range)) {
  if (spec.unit === "day") {
    return floorToUtcDay(ms);
  }
  if (spec.unit === "interval") {
    return Math.floor(ms / spec.stepMs) * spec.stepMs;
  }
  return floorToUtcHour(ms);
}

function pickTrendAnchorTimestamp(series, fallbackTimestamp) {
  const fallbackMs = parseTimestampMs(fallbackTimestamp);
  const pointTimes = Array.isArray(series)
    ? series
        .flatMap((item) => (Array.isArray(item?.points) ? item.points : []))
        .map((point) => parseTimestampMs(point?.t))
        .filter((value) => value !== null)
    : [];
  if (pointTimes.length > 0) {
    return Math.max(...pointTimes);
  }
  return fallbackMs ?? Date.now();
}

function buildTrendBuckets(range, anchorMs, options = {}) {
  const spec = resolveTrendRangeSpec(range, options);
  const end = floorTrendBucket(anchorMs, range, spec);
  const start = end - (spec.count - 1) * spec.stepMs;
  return Array.from({ length: spec.count }, (_, index) => start + index * spec.stepMs);
}

function averageTrendValues(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) {
    return null;
  }
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(3));
}

function normalizeTrendSeriesForRange(series, range, latestTimestamp, options = {}) {
  const normalizedRange = TREND_RANGE_SPECS[range] ? range : "24h";
  const anchorMs = pickTrendAnchorTimestamp(series, latestTimestamp);
  const spec = resolveTrendRangeSpec(normalizedRange, options);
  const buckets = buildTrendBuckets(normalizedRange, anchorMs, options);
  const bucketSet = new Set(buckets);
  const bucketStart = buckets[0];
  const bucketEnd = buckets.at(-1);

  return (Array.isArray(series) ? series : []).map((item) => {
    const groups = new Map();
    const sortedPoints = (Array.isArray(item?.points) ? item.points : [])
      .map((point, index) => ({
        timestamp: parseTimestampMs(point?.t),
        value: asFiniteNumber(point?.v),
        index
      }))
      .filter((point) => point.timestamp !== null)
      .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index);

    for (const point of sortedPoints) {
      const bucket = floorTrendBucket(point.timestamp, normalizedRange, spec);
      if (bucket < bucketStart || bucket > bucketEnd || !bucketSet.has(bucket)) {
        continue;
      }
      if (!groups.has(bucket)) {
        groups.set(bucket, []);
      }
      if (point.value !== null) {
        groups.get(bucket).push(point.value);
      }
    }

    return {
      ...item,
      points: buckets.map((bucket) => ({
        t: new Date(bucket).toISOString(),
        v: spec.unit === "day" ? averageTrendValues(groups.get(bucket) || []) : (groups.get(bucket)?.at(-1) ?? null)
      }))
    };
  });
}

function buildTrendStats(series) {
  return (Array.isArray(series) ? series : []).map((seriesItem) => {
    const values = (seriesItem.points || [])
      .map((point) => point.v)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    return {
      metric: seriesItem.metric,
      latest: values.at(-1) ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null
    };
  });
}

function resolveDatabasePathKey(siteId, requestContext = {}) {
  return (
    asTrimmedText(requestContext?.databaseKey) ||
    asTrimmedText(requestContext?.projectKey) ||
    asTrimmedText(siteId)
  );
}

function buildDashboardTrendsCacheKey(config, siteId, range, requestContext = {}) {
  const projectKeyCandidates = Array.isArray(requestContext?.projectKeyCandidates)
    ? requestContext.projectKeyCandidates.map(asTrimmedText).filter(Boolean).sort()
    : [];
  return JSON.stringify([
    asTrimmedText(config?.legacyBaseUrl),
    asTrimmedText(siteId),
    asTrimmedText(range),
    asTrimmedText(requestContext?.projectKey),
    ...projectKeyCandidates,
    asTrimmedText(requestContext?.userId),
    asTrimmedText(requestContext?.template),
    asTrimmedText(requestContext?.deviceDataProjectKey)
  ]);
}

export function shouldUseRequestedB25CloudHistory(config, siteId, requestContext = {}) {
  if (!shouldUseB25CloudHistory(config, siteId)) {
    return false;
  }

  const requestedKeys = new Set(
    [
      requestContext?.projectKey,
      ...(Array.isArray(requestContext?.projectKeyCandidates) ? requestContext.projectKeyCandidates : [])
    ]
      .map(asTrimmedText)
      .filter(Boolean)
  );

  if (requestedKeys.size === 0) {
    return false;
  }

  const b25Keys = new Set(
    [
      config?.siteSourceConfig?.databaseKey,
      config?.siteSourceConfig?.deviceDataProjectKey
    ]
      .map(asTrimmedText)
      .filter(Boolean)
  );

  for (const key of requestedKeys) {
    if (b25Keys.has(key)) {
      return true;
    }
  }

  return false;
}

export function normalizeEfficiencyMetric(value) {
  const normalized = asFiniteNumber(value);
  return normalized !== null && normalized > 0 ? normalized : null;
}

function pickFirstMetric(...values) {
  for (const value of values) {
    const normalized = asFiniteNumber(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

function pickFirstEfficiencyMetric(...values) {
  for (const value of values) {
    const normalized = normalizeEfficiencyMetric(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

function deriveCoolingCapacity(metrics) {
  const directValue = asFiniteNumber(metrics?.totalCoolingCapacity);
  if (directValue !== null) {
    return directValue;
  }

  const candidates = [
    [metrics?.currentCop, metrics?.totalPowerKw],
    [metrics?.chillerCop, metrics?.chillerPowerKw],
    [metrics?.chilledPumpConveyingCoefficient, metrics?.chilledPumpPowerKw],
    [metrics?.coolingPumpConveyingCoefficient, metrics?.coolingPumpPowerKw],
    [metrics?.coolingTowerConveyingCoefficient, metrics?.coolingTowerPowerKw]
  ];

  for (const [left, right] of candidates) {
    const factor = asFiniteNumber(left);
    const base = asFiniteNumber(right);
    if (factor !== null && base !== null && factor > 0 && base > 0) {
      return Number((factor * base).toFixed(1));
    }
  }

  return null;
}

function resolveRatedCoolingCapacityKw(config) {
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

export function deriveLoadRatePct(totalCoolingCapacity, ratedCoolingCapacityKw) {
  if (
    typeof totalCoolingCapacity !== "number" ||
    !Number.isFinite(totalCoolingCapacity) ||
    totalCoolingCapacity < 0 ||
    typeof ratedCoolingCapacityKw !== "number" ||
    !Number.isFinite(ratedCoolingCapacityKw) ||
    ratedCoolingCapacityKw <= 0
  ) {
    return null;
  }

  return Number(((totalCoolingCapacity / ratedCoolingCapacityKw) * 100).toFixed(1));
}

function hasCompleteOverviewCoreMetrics(metrics) {
  return [
    normalizeEfficiencyMetric(metrics?.currentCop),
    metrics?.totalPowerKw,
    metrics?.chilledDeltaT,
    metrics?.coolingDeltaT
  ].every((value) => typeof value === "number" && Number.isFinite(value));
}

function hasAnyOverviewCoreMetrics(metrics) {
  return [
    normalizeEfficiencyMetric(metrics?.currentCop),
    asFiniteNumber(metrics?.totalPowerKw),
    asFiniteNumber(metrics?.chilledDeltaT),
    asFiniteNumber(metrics?.coolingDeltaT)
  ].some((value) => value !== null);
}

function hasCompleteTrendCoreMetrics(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return false;
  }

  const requiredMetrics = new Set(["chilled_delta_t", "cooling_delta_t"]);
  for (const item of series) {
    const metric = String(item?.metric || "");
    if (!requiredMetrics.has(metric)) {
      continue;
    }
    const hasPoints = Array.isArray(item?.points) && item.points.some((point) => typeof point?.v === "number");
    if (hasPoints) {
      requiredMetrics.delete(metric);
    }
  }

  return requiredMetrics.size === 0;
}

function hasCompleteTrendDashboardMetrics(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return false;
  }

  const requiredMetrics = new Set(["totalPowerKw", "currentCop", "chilledDeltaT", "coolingDeltaT"]);
  for (const item of series) {
    const metric = String(item?.metric || "");
    if (!requiredMetrics.has(metric)) {
      continue;
    }
    const hasPoints = Array.isArray(item?.points) && item.points.some((point) => typeof point?.v === "number");
    if (hasPoints) {
      requiredMetrics.delete(metric);
    }
  }

  return requiredMetrics.size === 0;
}

function fallbackEnergyCards() {
  return {
    currentCop: null,
    totalPowerKw: null,
    currentLoadRate: null,
    totalElectricityKwh: null,
    savingPotentialPct: null,
    totalCoolingCapacity: null,
    activeAnomalyCount: null,
    chilledDeltaT: null,
    coolingDeltaT: null,
    chillerPowerKw: null,
    chilledPumpPowerKw: null,
    coolingPumpPowerKw: null,
    coolingTowerPowerKw: null,
    chillerCop: null,
    chilledPumpConveyingCoefficient: null,
    coolingTowerConveyingCoefficient: null,
    coolingPumpConveyingCoefficient: null,
    thermalUnbalanceRate: null,
    chilledSupplyTemp: null,
    coolingReturnTemp: null,
    outdoorTempC: null,
    outdoorHumidityPct: null,
    outdoorWetBulbC: null,
    dewPointC: null
  };
}

function normalizeAlarmSummary(anomalySummary) {
  return {
    total: anomalySummary?.counts?.total ?? 0,
    high: anomalySummary?.counts?.critical ?? 0,
    medium: anomalySummary?.counts?.major ?? 0,
    low: anomalySummary?.counts?.minor ?? 0
  };
}

function pickAlarmSourceForOverview(anomalySummary, siteId, requestContext = {}) {
  const fromAnomalies = anomalySummary?.sourceStatus?.sources?.find(
    (source) => source?.key === "latestAlarmLog"
  );
  if (fromAnomalies) {
    return {
      key: "alarms",
      endpoint: fromAnomalies.endpoint,
      ok: fromAnomalies.ok,
      status: fromAnomalies.status,
      message: fromAnomalies.message,
      error: fromAnomalies.error,
      rows: fromAnomalies.rows
    };
  }

  const databasePathKey = resolveDatabasePathKey(siteId, requestContext);
  return {
    key: "alarms",
    endpoint: `/zsqy/qsAlarmlog/${databasePathKey}/findNewAlarmLog`,
    ok: false,
    status: null,
    message: null,
    error: "Anomaly source status unavailable",
    rows: null
  };
}

function pickLaterTimestamp(...timestamps) {
  const normalized = timestamps.filter(Boolean).map((value) => Date.parse(value));
  const latest = normalized.filter(Number.isFinite).sort((a, b) => a - b).at(-1);
  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
}

function needsRealtimeEnergyFallback(metrics) {
  if (!metrics || typeof metrics !== "object") {
    return true;
  }
  return !hasCompleteOverviewCoreMetrics(metrics);
}

function needsRealtimeTrendFallback(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return true;
  }
  return series.every((item) => !Array.isArray(item?.points) || item.points.length === 0);
}

function buildRealtimeSource(sourceStatus, baseUrl) {
  if (!sourceStatus) {
    return null;
  }
  return annotateSourceEntry({
    key: "homepageRealtime",
    endpoint: sourceStatus.endpoint,
    ok: sourceStatus.ok,
    status: sourceStatus.status,
    message: sourceStatus.message,
    error: sourceStatus.error,
    rows: sourceStatus.rows
  }, {
    baseUrl,
    interfaceKind: "homepage-realtime"
  });
}

function buildRealtimeParametersSource(sourceStatus, baseUrl) {
  if (!sourceStatus) {
    return null;
  }
  return annotateSourceEntry({
    key: "realtimeParameters",
    endpoint: sourceStatus.endpoint,
    ok: sourceStatus.ok,
    status: sourceStatus.status,
    message: sourceStatus.message,
    error: sourceStatus.error,
    rows: sourceStatus.rows
  }, {
    baseUrl,
    interfaceKind: "wx-device-list-realtime-parameters"
  });
}

function mapSourceEntries(items, metadata = {}) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => annotateSourceEntry(item, metadata));
}

export async function getDashboardOverview(config, siteId, anomalySummary = null, requestContext = {}) {
  const databasePathKey = resolveDatabasePathKey(siteId, requestContext);
  const realtimeParamsBaseUrl =
    asTrimmedText(config?.siteSourceConfig?.realtimeParamsBaseUrl) ||
    asTrimmedText(config?.realtimeParamsBaseUrl);
  const realtimeParamsPromise = realtimeParamsBaseUrl
    ? loadRealtimeParametersSnapshot(realtimeParamsBaseUrl, siteId, {
        databaseKey: requestContext?.databaseKey,
        databaseKeyCandidates: requestContext?.databaseKeyCandidates,
        projectKey: requestContext?.projectKey,
        projectKeyCandidates: requestContext?.projectKeyCandidates,
        siteSourceConfig: config?.siteSourceConfig,
        timeoutMs: config?.realtimeParamsTimeoutMs
      })
    : Promise.resolve(null);
  const [energy, device, realtimeParameters] = await Promise.all([
    loadEnergyOverview(config.legacyBaseUrl, siteId, requestContext),
    loadDeviceSummary(config.legacyBaseUrl, siteId, {
      databaseKey: requestContext?.databaseKey,
      databaseKeyCandidates: requestContext?.databaseKeyCandidates,
      projectKey: requestContext?.projectKey
    }),
    realtimeParamsPromise
  ]);
  const realtimeSnapshot =
    requestContext?.userId && needsRealtimeEnergyFallback(energy.metrics)
      ? await loadRealtimeHomepageSnapshot(config.legacyBaseUrl, siteId, requestContext)
      : null;
  const mergedMetrics = {
    totalPowerKw: pickFirstMetric(
      energy.metrics?.totalPowerKw,
      realtimeSnapshot?.overview?.metrics?.totalPowerKw,
      realtimeParameters?.metrics?.totalPowerKw
    ),
    currentCop: pickFirstEfficiencyMetric(
      energy.metrics?.currentCop,
      realtimeSnapshot?.overview?.metrics?.currentCop,
      realtimeParameters?.metrics?.currentCop
    ),
    totalElectricityKwh: pickFirstMetric(
      energy.metrics?.totalElectricityKwh,
      realtimeSnapshot?.overview?.metrics?.totalElectricityKwh,
      realtimeParameters?.metrics?.totalElectricityKwh
    ),
    chilledDeltaT: pickFirstMetric(
      energy.metrics?.chilledDeltaT,
      realtimeSnapshot?.overview?.metrics?.chilledDeltaT,
      realtimeParameters?.metrics?.chilledDeltaT
    ),
    coolingDeltaT: pickFirstMetric(
      energy.metrics?.coolingDeltaT,
      realtimeSnapshot?.overview?.metrics?.coolingDeltaT,
      realtimeParameters?.metrics?.coolingDeltaT
    ),
    totalCoolingCapacity: pickFirstMetric(
      energy.metrics?.totalCoolingCapacity,
      realtimeSnapshot?.overview?.metrics?.totalCoolingCapacity,
      realtimeParameters?.metrics?.totalCoolingCapacity
    ),
    chillerPowerKw: pickFirstMetric(
      energy.metrics?.chillerPowerKw,
      realtimeSnapshot?.overview?.metrics?.chillerPowerKw
    ),
    chilledPumpPowerKw: pickFirstMetric(
      energy.metrics?.chilledPumpPowerKw,
      realtimeSnapshot?.overview?.metrics?.chilledPumpPowerKw
    ),
    coolingPumpPowerKw: pickFirstMetric(
      energy.metrics?.coolingPumpPowerKw,
      realtimeSnapshot?.overview?.metrics?.coolingPumpPowerKw
    ),
    coolingTowerPowerKw: pickFirstMetric(
      energy.metrics?.coolingTowerPowerKw,
      realtimeSnapshot?.overview?.metrics?.coolingTowerPowerKw
    ),
    chillerCop: pickFirstEfficiencyMetric(
      energy.metrics?.chillerCop,
      realtimeSnapshot?.overview?.metrics?.chillerCop,
      realtimeParameters?.metrics?.chillerCop
    ),
    chilledPumpConveyingCoefficient:
      pickFirstEfficiencyMetric(
        energy.metrics?.chilledPumpConveyingCoefficient,
        realtimeSnapshot?.overview?.metrics?.chilledPumpConveyingCoefficient,
        realtimeParameters?.metrics?.chilledPumpConveyingCoefficient
      ),
    coolingTowerConveyingCoefficient:
      pickFirstEfficiencyMetric(
        energy.metrics?.coolingTowerConveyingCoefficient,
        realtimeSnapshot?.overview?.metrics?.coolingTowerConveyingCoefficient,
        realtimeParameters?.metrics?.coolingTowerConveyingCoefficient
      ),
    coolingPumpConveyingCoefficient:
      pickFirstEfficiencyMetric(
        energy.metrics?.coolingPumpConveyingCoefficient,
        realtimeSnapshot?.overview?.metrics?.coolingPumpConveyingCoefficient,
        realtimeParameters?.metrics?.coolingPumpConveyingCoefficient
      ),
    thermalUnbalanceRate: pickFirstMetric(
      energy.metrics?.thermalUnbalanceRate,
      realtimeSnapshot?.overview?.metrics?.thermalUnbalanceRate,
      realtimeParameters?.metrics?.thermalUnbalanceRate
    ),
    chilledSupplyTemp: pickFirstMetric(
      energy.metrics?.chilledSupplyTemp,
      realtimeSnapshot?.overview?.metrics?.chilledSupplyTemp,
      realtimeParameters?.metrics?.chilledSupplyTemp
    ),
    coolingReturnTemp: pickFirstMetric(
      energy.metrics?.coolingReturnTemp,
      realtimeSnapshot?.overview?.metrics?.coolingReturnTemp,
      realtimeParameters?.metrics?.coolingReturnTemp
    ),
    outdoorTempC: pickFirstMetric(
      energy.metrics?.outdoorTempC,
      realtimeSnapshot?.overview?.metrics?.outdoorTempC,
      realtimeParameters?.metrics?.outdoorTempC
    ),
    outdoorHumidityPct: pickFirstMetric(
      energy.metrics?.outdoorHumidityPct,
      realtimeSnapshot?.overview?.metrics?.outdoorHumidityPct,
      realtimeParameters?.metrics?.outdoorHumidityPct
    ),
    outdoorWetBulbC: pickFirstMetric(
      energy.metrics?.outdoorWetBulbC,
      realtimeSnapshot?.overview?.metrics?.outdoorWetBulbC,
      realtimeParameters?.metrics?.outdoorWetBulbC
    ),
    dewPointC: pickFirstMetric(
      energy.metrics?.dewPointC,
      realtimeSnapshot?.overview?.metrics?.dewPointC,
      realtimeParameters?.metrics?.dewPointC
    )
  };
  mergedMetrics.totalCoolingCapacity = deriveCoolingCapacity(mergedMetrics);
  const ratedCoolingCapacityKw = resolveRatedCoolingCapacityKw(config);
  const latestTimestamp = pickLaterTimestamp(
    energy.latestTimestamp,
    realtimeSnapshot?.overview?.latestTimestamp,
    realtimeParameters?.latestTimestamp
  );

  const freshness = computeFreshnessState(latestTimestamp, config.staleThresholdHours);
  const realtimeSource = buildRealtimeSource(realtimeSnapshot?.sourceStatus, config.legacyBaseUrl);
  const realtimeParametersSource = buildRealtimeParametersSource(
    realtimeParameters?.sourceStatus,
    realtimeParamsBaseUrl
  );
  const hasRealtimeSupplement = realtimeSource?.ok === true || realtimeParametersSource?.ok === true;
  const realtimeCoversOverview =
    hasRealtimeSupplement &&
    freshness.stale !== true &&
    hasCompleteOverviewCoreMetrics(mergedMetrics);
  const energyCards =
    hasAnyOverviewCoreMetrics(mergedMetrics) || mergedMetrics.totalElectricityKwh !== null
    ? {
        currentCop: applyFieldNullStrategy(config, "station_cop", mergedMetrics.currentCop),
        totalPowerKw: applyFieldNullStrategy(
          config,
          "station_total_power_kw",
          mergedMetrics.totalPowerKw
        ),
        currentLoadRate: deriveLoadRatePct(
          mergedMetrics.totalCoolingCapacity,
          ratedCoolingCapacityKw
        ),
        totalElectricityKwh: applyFieldNullStrategy(
          config,
          "station_total_energy_kwh",
          mergedMetrics.totalElectricityKwh
        ),
        savingPotentialPct: null,
        activeAnomalyCount: anomalySummary?.counts?.total ?? null,
        totalCoolingCapacity: mergedMetrics.totalCoolingCapacity,
        chilledDeltaT: applyFieldNullStrategy(
          config,
          "chilled_delta_t_c",
          mergedMetrics.chilledDeltaT
        ),
        coolingDeltaT: applyFieldNullStrategy(
          config,
          "cooling_delta_t_c",
          mergedMetrics.coolingDeltaT
        ),
        chillerPowerKw: mergedMetrics.chillerPowerKw,
        chilledPumpPowerKw: mergedMetrics.chilledPumpPowerKw,
        coolingPumpPowerKw: mergedMetrics.coolingPumpPowerKw,
        coolingTowerPowerKw: mergedMetrics.coolingTowerPowerKw,
        chillerCop: mergedMetrics.chillerCop,
        chilledPumpConveyingCoefficient: mergedMetrics.chilledPumpConveyingCoefficient,
        coolingTowerConveyingCoefficient: mergedMetrics.coolingTowerConveyingCoefficient,
        coolingPumpConveyingCoefficient: mergedMetrics.coolingPumpConveyingCoefficient,
        thermalUnbalanceRate: mergedMetrics.thermalUnbalanceRate,
        chilledSupplyTemp: mergedMetrics.chilledSupplyTemp,
        coolingReturnTemp: mergedMetrics.coolingReturnTemp,
        outdoorTempC: mergedMetrics.outdoorTempC,
        outdoorHumidityPct: mergedMetrics.outdoorHumidityPct,
        outdoorWetBulbC: mergedMetrics.outdoorWetBulbC,
        dewPointC: mergedMetrics.dewPointC
      }
    : fallbackEnergyCards();

  const normalizedDeviceSummary = {
    totalDevices: applyFieldNullStrategy(
      config,
      "total_devices",
      device.summary?.totalDevices ?? 0
    ),
    chillerCount: device.summary?.chillerCount ?? 0,
    chilledPumpCount: device.summary?.chilledPumpCount ?? 0,
    coolingPumpCount: device.summary?.coolingPumpCount ?? 0,
    coolingTowerCount: device.summary?.coolingTowerCount ?? 0
  };

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    energyCards,
    deviceSummary: normalizedDeviceSummary,
    alarmSummary: normalizeAlarmSummary(anomalySummary),
    freshness,
    sourceStatus: buildSourceStatus(
      [
        !realtimeCoversOverview || energy.sourceStatus?.ok === true
          ? annotateSourceEntry({ key: "energy", ...energy.sourceStatus }, {
              baseUrl: config.legacyBaseUrl,
              interfaceKind: "legacy-homepage-energy"
            })
          : null,
        realtimeSource,
        realtimeParametersSource,
        annotateSourceEntry({ key: "devices", ...device.sourceStatus }, {
          baseUrl: config.legacyBaseUrl,
          interfaceKind: "legacy-device-catalog"
        }),
        pickAlarmSourceForOverview(anomalySummary, siteId, requestContext)
      ].filter(Boolean)
    )
  };
}

async function computeDashboardTrends(config, siteId, range = "24h", requestContext = {}) {
  const databasePathKey = resolveDatabasePathKey(siteId, requestContext);
  if (shouldUseRequestedB25CloudHistory(config, siteId, requestContext)) {
    const trend = await loadB25CloudTrendSeries(config.legacyBaseUrl, siteId, { range });
    const series = normalizeTrendSeriesForRange(trend.series || [], range, trend.latestTimestamp, {
      stepMs: TEN_MINUTE_TREND_STEP_MS
    });
    const freshness = computeFreshnessState(
      trend.latestTimestamp,
      config.staleThresholdHours
    );
    const stats = buildTrendStats(series);

    return {
      site: {
        siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
        siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
      },
      generatedAt: buildGeneratedAt(config),
      range,
      series,
      stats,
      freshness,
      sourceStatus: buildSourceStatus(
        mapSourceEntries(trend.sourceStatus, {
          baseUrl: config.legacyBaseUrl
        })
      )
    };
  }

  const trend = await loadTrendSeries(config.legacyBaseUrl, siteId, {
    ...requestContext,
    range
  });
  const shouldUseRealtimeFallback = needsRealtimeTrendFallback(trend.series);
  const realtimeSnapshot =
    requestContext?.userId && shouldUseRealtimeFallback
      ? await loadRealtimeHomepageSnapshot(config.legacyBaseUrl, siteId, requestContext)
      : null;
  const realtimeSeries = Array.isArray(realtimeSnapshot?.trends?.series)
    ? realtimeSnapshot.trends.series
    : [];
  const rawSeries = shouldUseRealtimeFallback && realtimeSeries.length > 0 ? realtimeSeries : trend.series || [];
  const latestTrendTimestamp = pickLaterTimestamp(trend.latestTimestamp, realtimeSnapshot?.trends?.latestTimestamp);
  const series = normalizeTrendSeriesForRange(rawSeries, range, latestTrendTimestamp);
  const realtimeSource = buildRealtimeSource(realtimeSnapshot?.sourceStatus, config.legacyBaseUrl);
  const realtimeCoversTrends =
    shouldUseRealtimeFallback &&
    realtimeSource?.ok === true &&
    hasCompleteTrendCoreMetrics(series);
  const trendCoversDashboardMetrics = hasCompleteTrendDashboardMetrics(series);
  const usableTrendSources = Array.isArray(trend.sourceStatus)
    ? trend.sourceStatus.filter((item) => item?.ok)
    : [];
  const freshness = computeFreshnessState(
    latestTrendTimestamp,
    config.staleThresholdHours
  );

  const stats = buildTrendStats(series);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    range,
    series,
    stats,
    freshness,
    sourceStatus: buildSourceStatus(
      realtimeCoversTrends
        ? [realtimeSource].filter(Boolean)
        : trendCoversDashboardMetrics && usableTrendSources.length > 0
          ? mapSourceEntries(usableTrendSources, {
              baseUrl: config.legacyBaseUrl
            })
          : Array.isArray(trend.sourceStatus) && trend.sourceStatus.length > 0
        ? [
            ...mapSourceEntries(trend.sourceStatus, {
              baseUrl: config.legacyBaseUrl
            }),
            realtimeSource
          ].filter(Boolean)
        : [
            annotateSourceEntry({
              key: "energyCurve",
              endpoint: `/zsqy/homepage/${databasePathKey}/getEnergyStatisticsCurve`,
              ok: false,
              status: null,
              message: null,
              error: "trend source status unavailable",
              rows: null
            }, {
              baseUrl: config.legacyBaseUrl,
              interfaceKind: "legacy-homepage-energy-curve"
            }),
            annotateSourceEntry({
              key: "runParams",
              endpoint: `/zsqy/homepage/${databasePathKey}/getRunParamsCurve`,
              ok: false,
              status: null,
              message: null,
              error: "trend source status unavailable",
              rows: null
            }, {
              baseUrl: config.legacyBaseUrl,
              interfaceKind: "legacy-homepage-run-params"
            }),
            realtimeSource
          ]
              .filter(Boolean)
    )
  };
}

export async function getDashboardTrends(config, siteId, range = "24h", requestContext = {}) {
  const cacheKey = buildDashboardTrendsCacheKey(config, siteId, range, requestContext);
  const now = Date.now();
  const cached = dashboardTrendsCache.get(cacheKey);
  if (cached) {
    if (cached.pending === true) {
      return cached.promise;
    }
    if (cached.expiresAt > now) {
      return cached.promise;
    }
    dashboardTrendsCache.delete(cacheKey);
  }

  const entry = {
    pending: true,
    expiresAt: 0,
    promise: null
  };
  const promise = computeDashboardTrends(config, siteId, range, requestContext)
    .then((result) => {
      entry.pending = false;
      entry.expiresAt = Date.now() + DASHBOARD_TRENDS_CACHE_TTL_MS;
      return result;
    })
    .catch((error) => {
      dashboardTrendsCache.delete(cacheKey);
      throw error;
    });
  entry.promise = promise;
  dashboardTrendsCache.set(cacheKey, entry);
  return promise;
}

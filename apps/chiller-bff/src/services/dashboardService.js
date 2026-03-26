import { loadDeviceSummary } from "../adapters/legacyDeviceAdapter.js";
import { loadEnergyOverview, loadTrendSeries } from "../adapters/legacyEnergyAdapter.js";
import { loadRealtimeHomepageSnapshot } from "../adapters/legacyHomepageRealtimeAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function fallbackEnergyCards() {
  return {
    currentCop: null,
    totalPowerKw: null,
    currentLoadRate: null,
    totalElectricityKwh: null,
    savingPotentialPct: null,
    activeAnomalyCount: null,
    chilledDeltaT: null,
    coolingDeltaT: null
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

function pickAlarmSourceForOverview(anomalySummary, siteId) {
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

  return {
    key: "alarms",
    endpoint: `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`,
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
  return [metrics.totalPowerKw, metrics.currentCop, metrics.chilledDeltaT, metrics.coolingDeltaT].every(
    (value) => value === null || value === undefined
  );
}

function needsRealtimeTrendFallback(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return true;
  }
  return series.every((item) => !Array.isArray(item?.points) || item.points.length === 0);
}

function buildRealtimeSource(sourceStatus) {
  if (!sourceStatus) {
    return null;
  }
  return {
    key: "homepageRealtime",
    endpoint: sourceStatus.endpoint,
    ok: sourceStatus.ok,
    status: sourceStatus.status,
    message: sourceStatus.message,
    error: sourceStatus.error,
    rows: sourceStatus.rows
  };
}

export async function getDashboardOverview(config, siteId, anomalySummary = null, requestContext = {}) {
  const [energy, device] = await Promise.all([
    loadEnergyOverview(config.legacyBaseUrl, siteId),
    loadDeviceSummary(config.legacyBaseUrl, siteId, {
      projectKey: requestContext?.projectKey
    })
  ]);
  const realtimeSnapshot =
    requestContext?.userId && needsRealtimeEnergyFallback(energy.metrics)
      ? await loadRealtimeHomepageSnapshot(config.legacyBaseUrl, siteId, requestContext)
      : null;
  const mergedMetrics = {
    totalPowerKw: energy.metrics?.totalPowerKw ?? realtimeSnapshot?.overview?.metrics?.totalPowerKw ?? null,
    currentCop: energy.metrics?.currentCop ?? realtimeSnapshot?.overview?.metrics?.currentCop ?? null,
    totalElectricityKwh: energy.metrics?.totalElectricityKwh ?? null,
    chilledDeltaT: energy.metrics?.chilledDeltaT ?? realtimeSnapshot?.overview?.metrics?.chilledDeltaT ?? null,
    coolingDeltaT: energy.metrics?.coolingDeltaT ?? realtimeSnapshot?.overview?.metrics?.coolingDeltaT ?? null
  };
  const latestTimestamp = pickLaterTimestamp(
    energy.latestTimestamp,
    realtimeSnapshot?.overview?.latestTimestamp
  );

  const freshness = computeFreshnessState(latestTimestamp, config.staleThresholdHours);
  const energyCards =
    !needsRealtimeEnergyFallback(mergedMetrics) || mergedMetrics.totalElectricityKwh !== null
    ? {
        currentCop: applyFieldNullStrategy(config, "station_cop", mergedMetrics.currentCop),
        totalPowerKw: applyFieldNullStrategy(
          config,
          "station_total_power_kw",
          mergedMetrics.totalPowerKw
        ),
        currentLoadRate: null,
        totalElectricityKwh: applyFieldNullStrategy(
          config,
          "station_total_energy_kwh",
          mergedMetrics.totalElectricityKwh
        ),
        savingPotentialPct: null,
        activeAnomalyCount: anomalySummary?.counts?.total ?? null,
        chilledDeltaT: applyFieldNullStrategy(
          config,
          "chilled_delta_t_c",
          mergedMetrics.chilledDeltaT
        ),
        coolingDeltaT: applyFieldNullStrategy(
          config,
          "cooling_delta_t_c",
          mergedMetrics.coolingDeltaT
        )
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
        { key: "energy", ...energy.sourceStatus },
        buildRealtimeSource(realtimeSnapshot?.sourceStatus),
        { key: "devices", ...device.sourceStatus },
        pickAlarmSourceForOverview(anomalySummary, siteId)
      ].filter(Boolean)
    )
  };
}

export async function getDashboardTrends(config, siteId, range = "24h", requestContext = {}) {
  const trend = await loadTrendSeries(config.legacyBaseUrl, siteId);
  const shouldUseRealtimeFallback = needsRealtimeTrendFallback(trend.series);
  const realtimeSnapshot =
    requestContext?.userId && shouldUseRealtimeFallback
      ? await loadRealtimeHomepageSnapshot(config.legacyBaseUrl, siteId, requestContext)
      : null;
  const realtimeSeries = Array.isArray(realtimeSnapshot?.trends?.series)
    ? realtimeSnapshot.trends.series
    : [];
  const series = shouldUseRealtimeFallback && realtimeSeries.length > 0 ? realtimeSeries : trend.series || [];
  const freshness = computeFreshnessState(
    pickLaterTimestamp(trend.latestTimestamp, realtimeSnapshot?.trends?.latestTimestamp),
    config.staleThresholdHours
  );

  const stats = series.map((s) => {
    const values = s.points.map((p) => p.v).filter((v) => typeof v === "number");
    const latest = values.at(-1) ?? null;
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    return {
      metric: s.metric,
      latest,
      min,
      max
    };
  });

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
      Array.isArray(trend.sourceStatus) && trend.sourceStatus.length > 0
        ? [...trend.sourceStatus, buildRealtimeSource(realtimeSnapshot?.sourceStatus)].filter(Boolean)
        : [
            {
              key: "energyCurve",
              endpoint: `/zsqy/homepage/${siteId}/getEnergyStatisticsCurve`,
              ok: false,
              status: null,
              message: null,
              error: "trend source status unavailable",
              rows: null
            },
            {
              key: "runParams",
              endpoint: `/zsqy/homepage/${siteId}/getRunParamsCurve`,
              ok: false,
              status: null,
              message: null,
              error: "trend source status unavailable",
              rows: null
            },
            buildRealtimeSource(realtimeSnapshot?.sourceStatus)
          ]
              .filter(Boolean)
    )
  };
}

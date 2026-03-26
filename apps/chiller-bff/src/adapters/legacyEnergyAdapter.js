import { deepArrayProbe, fetchLegacyJson, toIsoTimestamp } from "../lib/http.js";

function asNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function pickLatestByTime(items, timeKeys = ["time", "createTime", "savetime", "updateTime"]) {
  let winner = null;
  let winnerTs = 0;

  for (const item of items) {
    const raw = timeKeys.map((k) => item?.[k]).find(Boolean);
    const iso = toIsoTimestamp(raw);
    if (!iso) {
      continue;
    }
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && ts > winnerTs) {
      winner = item;
      winnerTs = ts;
    }
  }

  return winner;
}

function text(value) {
  return String(value || "").trim();
}

function compactKey(value) {
  return text(value).toLowerCase().replace(/\s+/g, "");
}

function guessLabel(row) {
  return (
    row?.title ||
    row?.name ||
    row?.metric ||
    row?.objName ||
    row?.param_name ||
    row?.paramName ||
    row?.reg_name ||
    row?.regName ||
    row?.tagName ||
    row?.tagname ||
    row?.tagnameCN ||
    row?.tagnameCNEN ||
    ""
  );
}

function guessUnit(row) {
  return row?.unit || row?.units || row?.runParamsCurveVO?.unit || null;
}

function parseCurvePoints(row) {
  const nestedCurveList =
    row?.curveValueList?.curveValueList ||
    row?.runParamsCurveVO?.curveValueList?.curveValueList ||
    row?.runParamsCurveVO?.curveValueList ||
    row?.curveValueList;
  const rawPoints =
    nestedCurveList ||
    row?.points ||
    row?.series ||
    [];

  if (!Array.isArray(rawPoints)) {
    return [];
  }

  return rawPoints
    .map((point, index) => {
      const ts =
        toIsoTimestamp(point?.time || point?.ts || point?.timestamp || point?.name || point?.x) ||
        null;
      const value = asNumber(point?.value ?? point?.v ?? point?.y ?? point?.tagvalue);
      return {
        ts,
        value,
        _index: index
      };
    })
    .filter((point) => point.value !== null)
    .sort((a, b) => {
      const at = a.ts ? Date.parse(a.ts) : Number.NaN;
      const bt = b.ts ? Date.parse(b.ts) : Number.NaN;
      if (Number.isFinite(at) && Number.isFinite(bt)) {
        return at - bt;
      }
      return a._index - b._index;
    })
    .map(({ ts, value }) => ({ ts, value }));
}

function getRecentPoints(points, windowMinutes = 60) {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }
  const withTs = points.filter((point) => point.ts && Number.isFinite(Date.parse(point.ts)));
  if (!withTs.length) {
    return points;
  }

  const latestTs = Math.max(...withTs.map((point) => Date.parse(point.ts)));
  const cutoff = latestTs - windowMinutes * 60 * 1000;
  const filtered = withTs.filter((point) => Date.parse(point.ts) >= cutoff);
  return filtered.length ? filtered : withTs;
}

function countStateTransitions(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }
  let transitions = 0;
  let lastState = null;

  for (const point of points) {
    const state = point.value > 0 ? 1 : 0;
    if (lastState === null) {
      lastState = state;
      continue;
    }
    if (state !== lastState) {
      transitions += 1;
    }
    lastState = state;
  }
  return transitions;
}

function includesAny(target, patterns) {
  return patterns.some((pattern) => target.includes(pattern));
}

const RUN_PARAM_BY_TAG_SPECS = {
  chilledDeltaT: {
    sourceKey: "runParamsByTag.chilledDeltaT",
    label: "冷冻水温差",
    tagname: "chilledWaterTemperatureDifference",
    title: "冷冻水温差"
  },
  coolingDeltaT: {
    sourceKey: "runParamsByTag.coolingDeltaT",
    label: "冷却水温差",
    tagname: "chilledOutWaterTemperatureDifference",
    title: "冷却水温差"
  }
};

const COP_FALLBACK_QUERIES = [
  { title: "冷站COP", tagname: "coldStationCop" },
  { title: "COP", tagname: "coldStationCop" },
  { title: "冷站COP", tagname: "cop" },
  { title: "COP", tagname: "cop" }
];

function buildRunParamByTagEndpoint(siteId, query) {
  const params = new URLSearchParams();
  if (query?.title) {
    params.set("title", query.title);
  }
  if (query?.tagname) {
    params.set("tagname", query.tagname);
  }
  if (query?.date) {
    params.set("date", query.date);
  }
  const suffix = params.toString();
  return `/zsqy/homepage/${siteId}/getRunParamsCurveByTagName${suffix ? `?${suffix}` : ""}`;
}

function parseFlatPointRows(rows) {
  return rows
    .map((row, index) => {
      const ts =
        toIsoTimestamp(row?.time || row?.name || row?.createTime || row?.savetime || row?.updateTime) ||
        null;
      const value = asNumber(row?.value ?? row?.tagValue ?? row?.tagvalue ?? row?.metricValue);
      return {
        ts,
        value,
        _index: index
      };
    })
    .filter((point) => point.value !== null)
    .sort((a, b) => {
      const at = a.ts ? Date.parse(a.ts) : Number.NaN;
      const bt = b.ts ? Date.parse(b.ts) : Number.NaN;
      if (Number.isFinite(at) && Number.isFinite(bt)) {
        return at - bt;
      }
      return a._index - b._index;
    })
    .map(({ ts, value }) => ({ ts, value }));
}

function latestNumericValue(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (point && typeof point.value === "number" && Number.isFinite(point.value)) {
      return point.value;
    }
  }
  return null;
}

function hasAnyTimestamp(points) {
  return Array.isArray(points) && points.some((point) => point?.ts && Number.isFinite(Date.parse(point.ts)));
}

function pickSnapshotArray(payload, candidates) {
  for (const getter of candidates) {
    const value = getter(payload);
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return [];
}

function extractHomeEnergySnapshot(payload) {
  const rightRows = pickSnapshotArray(payload, [
    (root) => root?.data?.rightdata,
    (root) => root?.rightdata,
    (root) => root?.data?.data,
    (root) => root?.data
  ]);
  const timedRows = pickSnapshotArray(payload, [
    (root) => root?.data?.data,
    (root) => root?.data,
    (root) => root?.rightdata
  ]);

  const metrics = {
    totalPowerKw: null,
    currentCop: null,
    chilledDeltaT: null,
    coolingDeltaT: null
  };

  for (const row of rightRows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const key = compactKey(text(row?.tagname || row?.tagName || row?.paramName || row?.title));
    const value =
      asNumber(row?.tagvalue) ??
      asNumber(row?.tagValue) ??
      asNumber(row?.tagvalueRT) ??
      asNumber(row?.value);
    if (value === null) {
      continue;
    }

    if (metrics.totalPowerKw === null && includesAny(key, ["totalpower", "总功率"])) {
      metrics.totalPowerKw = value;
    } else if (metrics.currentCop === null && includesAny(key, ["coldstationcop", "stationcop", "冷站效率", "冷站cop", "cop"])) {
      metrics.currentCop = value;
    } else if (
      metrics.chilledDeltaT === null &&
      includesAny(key, ["chilledwatertemperaturedifference", "冷冻水温差", "chilleddeltat"])
    ) {
      metrics.chilledDeltaT = value;
    } else if (
      metrics.coolingDeltaT === null &&
      includesAny(key, ["chilledoutwatertemperaturedifference", "冷却水温差", "coolingdeltat"])
    ) {
      metrics.coolingDeltaT = value;
    }
  }

  const latest = pickLatestByTime(timedRows) || timedRows.at(-1) || {};
  const latestTimestamp = toIsoTimestamp(latest?.time || latest?.createTime || latest?.savetime || latest?.updateTime);

  return {
    metrics,
    latestTimestamp,
    rowCount: rightRows.length + timedRows.length
  };
}

async function loadHomeEnergySnapshot(baseUrl, siteId) {
  const endpoint = `/api/homeData/${siteId}/energyEfficiency`;
  const response = await fetchLegacyJson(baseUrl, endpoint);
  if (!response.ok) {
    return {
      sourceStatus: {
        key: "homeEnergyEfficiency",
        endpoint,
        ok: false,
        status: response.status ?? null,
        message: null,
        error: response.error,
        rows: null
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  const extracted = extractHomeEnergySnapshot(response.payload);
  return {
    sourceStatus: {
      key: "homeEnergyEfficiency",
      endpoint,
      ok: true,
      status: response.status ?? null,
      message: extractMessage(response.payload, "OK"),
      error: null,
      rows: extracted.rowCount
    },
    metrics: extracted.metrics,
    latestTimestamp: extracted.latestTimestamp
  };
}

async function loadRunParamByTag(baseUrl, siteId, spec) {
  const endpoint = buildRunParamByTagEndpoint(siteId, spec);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  if (!response.ok) {
    return {
      sourceStatus: {
        key: spec.sourceKey || "runParamsByTag",
        endpoint,
        ok: false,
        status: response.status ?? null,
        message: null,
        error: response.error,
        rows: null
      },
      series: {
        label: spec.label || spec.title || spec.tagname || "runParamsByTag",
        key: compactKey(spec.label || spec.title || spec.tagname || "runParamsByTag"),
        unit: null,
        points: []
      }
    };
  }

  const rows = deepArrayProbe(response.payload);
  const points = parseFlatPointRows(rows);
  return {
    sourceStatus: {
      key: spec.sourceKey || "runParamsByTag",
      endpoint,
      ok: true,
      status: response.status ?? null,
      message: extractMessage(response.payload, "OK"),
      error: null,
      rows: rows.length
    },
    series: {
      label:
        spec.label ||
        rows.find((row) => text(row?.tagName || row?.title || row?.name))?.tagName ||
        spec.title ||
        spec.tagname ||
        "runParamsByTag",
      key: compactKey(spec.label || spec.title || spec.tagname || "runParamsByTag"),
      unit: null,
      points
    }
  };
}

function extractEquipmentMetrics(rows) {
  const metrics = {
    totalPowerKw: null,
    currentCop: null,
    totalElectricityKwh: null,
    totalCoolingCapacity: null,
    chilledDeltaT: null,
    coolingDeltaT: null,
    coolingTowerPowerKw: null,
    chilledPumpPowerKw: null,
    coolingPumpPowerKw: null,
    chillerPowerKw: null
  };

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    if (metrics.totalPowerKw === null) {
      metrics.totalPowerKw = asNumber(row.totalPower) ?? asNumber(row.power) ?? null;
    }
    if (metrics.currentCop === null) {
      metrics.currentCop = asNumber(row.coldStationCop) ?? asNumber(row.cop) ?? null;
    }
    if (metrics.totalElectricityKwh === null) {
      metrics.totalElectricityKwh = asNumber(row.totalElectricity) ?? asNumber(row.electricity) ?? null;
    }
    if (metrics.totalCoolingCapacity === null) {
      metrics.totalCoolingCapacity = asNumber(row.totalCoolingCapacity) ?? null;
    }
    if (metrics.chilledDeltaT === null) {
      metrics.chilledDeltaT = asNumber(row.chilledWaterTemperatureDifference) ?? null;
    }
    if (metrics.coolingDeltaT === null) {
      metrics.coolingDeltaT = asNumber(row.chilledOutWaterTemperatureDifference) ?? null;
    }

    const label = compactKey(guessLabel(row));
    const value =
      asNumber(row.tagValue) ??
      asNumber(row.tagvalue) ??
      asNumber(row.value) ??
      asNumber(row.val) ??
      asNumber(row.metricValue);

    if (value === null) {
      continue;
    }

    if (includesAny(label, ["chillertotalpower", "主机总功率", "冷机总功率"])) {
      metrics.chillerPowerKw = value;
    } else if (
      includesAny(label, [
        "chilledwaterpumptotalpower",
        "chilledpumptotalpower",
        "冷冻泵总功率"
      ])
    ) {
      metrics.chilledPumpPowerKw = value;
    } else if (
      includesAny(label, [
        "condenserwaterpumptotalpower",
        "coolingwaterpumptotalpower",
        "coolingpumptotalpower",
        "冷却泵总功率"
      ])
    ) {
      metrics.coolingPumpPowerKw = value;
    } else if (
      includesAny(label, ["coolingtowertotalpower", "towertotalpower", "冷却塔总功率"])
    ) {
      metrics.coolingTowerPowerKw = value;
    } else if (includesAny(label, ["totalelectricity", "总电量", "总电能"])) {
      metrics.totalElectricityKwh = value;
    } else if (includesAny(label, ["totalpower", "总功率"])) {
      metrics.totalPowerKw = value;
    } else if (includesAny(label, ["cop"])) {
      metrics.currentCop = value;
    } else if (includesAny(label, ["冷冻水温差", "chilledwatertemperaturedifference", "chilleddeltat"])) {
      metrics.chilledDeltaT = value;
    } else if (includesAny(label, ["冷却水温差", "chilledoutwatertemperaturedifference", "coolingdeltat"])) {
      metrics.coolingDeltaT = value;
    }
  }

  if (metrics.totalPowerKw === null) {
    const parts = [
      metrics.chillerPowerKw,
      metrics.chilledPumpPowerKw,
      metrics.coolingPumpPowerKw,
      metrics.coolingTowerPowerKw
    ].filter((x) => x !== null);
    if (parts.length) {
      metrics.totalPowerKw = Number(parts.reduce((sum, val) => sum + val, 0).toFixed(3));
    }
  }

  return metrics;
}

function parseSeriesFromPayload(payload) {
  const rows = deepArrayProbe(payload);
  if (
    rows.length > 0 &&
    rows.every(
      (row) =>
        row &&
        typeof row === "object" &&
        (Object.prototype.hasOwnProperty.call(row, "name") ||
          Object.prototype.hasOwnProperty.call(row, "time")) &&
        (Object.prototype.hasOwnProperty.call(row, "value") ||
          Object.prototype.hasOwnProperty.call(row, "tagValue") ||
          Object.prototype.hasOwnProperty.call(row, "tagvalue"))
    )
  ) {
    const points = parseFlatPointRows(rows);
    if (!points.length) {
      return [];
    }
    const sample = rows[0] || {};
    const label = text(sample?.title || sample?.tagName || sample?.name || "Run Params");
    return [
      {
        label,
        key: compactKey(label),
        unit: guessUnit(sample),
        points
      }
    ];
  }

  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const label = text(guessLabel(row));
      return {
        label,
        key: compactKey(label),
        unit: guessUnit(row),
        points: parseCurvePoints(row)
      };
    })
    .filter((series) => series.label && series.points.length > 0);
}

function pickSeriesForMetric(seriesList, category) {
  const candidates = seriesList.filter((series) => {
    const key = series.key;
    const hasRunSignal =
      includesAny(key, ["运行", "run", "启停", "start", "stop", "状态"]) ||
      /(ch|chp|cwp)\d*[-_]?502-400(02|10|18|26)/i.test(series.label);
    if (!hasRunSignal) {
      return false;
    }
    if (category === "chiller") {
      return (
        includesAny(key, ["冷机", "主机", "chiller"]) ||
        /\bch\d+\b/i.test(series.label)
      ) && !includesAny(key, ["chp", "cwp", "冷冻泵", "冷却泵"]);
    }
    if (category === "chilledPump") {
      return includesAny(key, ["冷冻泵", "chilledpump", "chilledwaterpump", "chp"]);
    }
    if (category === "coolingPump") {
      return includesAny(key, ["冷却泵", "coolingpump", "coolingwaterpump", "cwp"]);
    }
    return false;
  });

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((a, b) => b.points.length - a.points.length)[0];
}

function pickChilledPumpFreqSeries(seriesList) {
  const candidates = seriesList.filter((series) => {
    const key = series.key;
    const hasPump = includesAny(key, ["冷冻泵", "chilledpump", "chilledwaterpump", "chp"]);
    const hasFreq = includesAny(key, ["频率", "hz", "frequency"]);
    return hasPump && hasFreq;
  });

  if (!candidates.length) {
    return null;
  }
  return candidates.sort((a, b) => b.points.length - a.points.length)[0];
}

export async function loadEnergyOverview(baseUrl, siteId) {
  const endpoint = `/zsqy/homepage/${siteId}/getEquipmentEnergyStatisticsCurve`;
  const result = await fetchLegacyJson(baseUrl, endpoint);
  if (!result.ok) {
    return {
      sourceStatus: {
        endpoint,
        ok: false,
        status: result.status ?? null,
        message: null,
        error: result.error
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  const rows = deepArrayProbe(result.payload);
  const latest = pickLatestByTime(rows) || rows.at(-1) || {};
  const extracted = extractEquipmentMetrics(rows);

  const metrics = {
    totalPowerKw: extracted.totalPowerKw,
    currentCop: extracted.currentCop,
    totalElectricityKwh: extracted.totalElectricityKwh,
    totalCoolingCapacity: extracted.totalCoolingCapacity,
    chilledDeltaT: extracted.chilledDeltaT,
    coolingDeltaT: extracted.coolingDeltaT
  };

  const fallbackStatuses = [];
  let homeSnapshot = null;

  const ensureHomeSnapshot = async () => {
    if (homeSnapshot === null) {
      homeSnapshot = await loadHomeEnergySnapshot(baseUrl, siteId);
      fallbackStatuses.push(homeSnapshot.sourceStatus);
    }
    return homeSnapshot;
  };
  if (metrics.chilledDeltaT === null) {
    const fallback = await loadRunParamByTag(baseUrl, siteId, RUN_PARAM_BY_TAG_SPECS.chilledDeltaT);
    fallbackStatuses.push(fallback.sourceStatus);
    metrics.chilledDeltaT = latestNumericValue(fallback.series.points);
    if (metrics.chilledDeltaT === null) {
      const snapshot = await ensureHomeSnapshot();
      metrics.chilledDeltaT = asNumber(snapshot?.metrics?.chilledDeltaT);
    }
  }
  if (metrics.coolingDeltaT === null) {
    const fallback = await loadRunParamByTag(baseUrl, siteId, RUN_PARAM_BY_TAG_SPECS.coolingDeltaT);
    fallbackStatuses.push(fallback.sourceStatus);
    metrics.coolingDeltaT = latestNumericValue(fallback.series.points);
    if (metrics.coolingDeltaT === null) {
      const snapshot = await ensureHomeSnapshot();
      metrics.coolingDeltaT = asNumber(snapshot?.metrics?.coolingDeltaT);
    }
  }
  if (metrics.currentCop === null) {
    for (const query of COP_FALLBACK_QUERIES) {
      const fallback = await loadRunParamByTag(baseUrl, siteId, {
        sourceKey: "runParamsByTag.currentCop",
        label: "冷站COP",
        ...query
      });
      fallbackStatuses.push(fallback.sourceStatus);
      const value = latestNumericValue(fallback.series.points);
      if (value !== null) {
        metrics.currentCop = value;
        break;
      }
    }
    if (metrics.currentCop === null) {
      const snapshot = await ensureHomeSnapshot();
      metrics.currentCop = asNumber(snapshot?.metrics?.currentCop);
    }
  }
  if (metrics.totalPowerKw === null) {
    const snapshot = await ensureHomeSnapshot();
    metrics.totalPowerKw = asNumber(snapshot?.metrics?.totalPowerKw);
  }

  const missingCoreMetrics = [];
  if (metrics.chilledDeltaT === null) missingCoreMetrics.push("chilled_delta_t_c");
  if (metrics.coolingDeltaT === null) missingCoreMetrics.push("cooling_delta_t_c");
  if (metrics.currentCop === null) missingCoreMetrics.push("station_cop");

  const parsedLatestTimestamp = toIsoTimestamp(
    latest.time || latest.createTime || latest.savetime || latest.updateTime
  );
  const latestTimestamp =
    parsedLatestTimestamp ||
    homeSnapshot?.latestTimestamp ||
    (rows.length > 0 ? new Date().toISOString() : null);
  const fallbackSummary = fallbackStatuses
    .map((status) => `${status.key}:${status.ok ? `rows=${status.rows ?? 0}` : "failed"}`)
    .join(",");

  return {
    sourceStatus: {
      endpoint,
      ok: true,
      status: result.status ?? null,
      message:
        missingCoreMetrics.length > 0
          ? `${extractMessage(result.payload, "OK")}; coreMetricsMissing=${missingCoreMetrics.join(",")}${fallbackSummary ? `; fallback=${fallbackSummary}` : ""}`
          : `${extractMessage(result.payload, "OK")}; coreMetricsReady=3/3${fallbackSummary ? `; fallback=${fallbackSummary}` : ""}`,
      rows: rows.length
    },
    metrics,
    latestTimestamp
  };
}

export async function loadTrendSeries(baseUrl, siteId) {
  const endpoints = {
    energyCurve: `/zsqy/homepage/${siteId}/getEnergyStatisticsCurve`,
    runParams: `/zsqy/homepage/${siteId}/getRunParamsCurve`
  };

  const [energyCurveRes, runParamsRes] = await Promise.all([
    fetchLegacyJson(baseUrl, endpoints.energyCurve),
    fetchLegacyJson(baseUrl, endpoints.runParams)
  ]);

  const baseSourceStatus = [
    {
      key: "energyCurve",
      endpoint: endpoints.energyCurve,
      ok: energyCurveRes.ok,
      status: energyCurveRes.status ?? null,
      message: energyCurveRes.ok ? extractMessage(energyCurveRes.payload, "OK") : null,
      error: energyCurveRes.ok ? null : energyCurveRes.error,
      rows: energyCurveRes.ok ? deepArrayProbe(energyCurveRes.payload).length : null
    },
    {
      key: "runParams",
      endpoint: endpoints.runParams,
      ok: runParamsRes.ok,
      status: runParamsRes.status ?? null,
      message: runParamsRes.ok ? extractMessage(runParamsRes.payload, "OK") : null,
      error: runParamsRes.ok ? null : runParamsRes.error,
      rows: runParamsRes.ok ? deepArrayProbe(runParamsRes.payload).length : null
    }
  ];

  const parsedSeries = [energyCurveRes, runParamsRes]
    .filter((res) => res.ok)
    .flatMap((res) => parseSeriesFromPayload(res.payload));

  const hasUsableSeries = (patterns) =>
    parsedSeries.some(
      (series) => includesAny(series.key, patterns) && hasAnyTimestamp(series.points)
    );

  const fallbackSpecs = [];
  if (
    !hasUsableSeries([
      "冷冻水温差",
      "chilleddeltat",
      "chilledwatertemperaturedifference"
    ])
  ) {
    fallbackSpecs.push(RUN_PARAM_BY_TAG_SPECS.chilledDeltaT);
  }
  if (
    !hasUsableSeries([
      "冷却水温差",
      "coolingdeltat",
      "chilledoutwatertemperaturedifference"
    ])
  ) {
    fallbackSpecs.push(RUN_PARAM_BY_TAG_SPECS.coolingDeltaT);
  }

  const fallbackResults = await Promise.all(
    fallbackSpecs.map((spec) => loadRunParamByTag(baseUrl, siteId, spec))
  );
  let copFallbackResults = [];
  let copFallbackSeries = null;
  if (!parsedSeries.some((series) => includesAny(series.key, ["cop"]))) {
    for (const query of COP_FALLBACK_QUERIES) {
      const fallback = await loadRunParamByTag(baseUrl, siteId, {
        sourceKey: "runParamsByTag.currentCop",
        label: "冷站COP",
        ...query
      });
      copFallbackResults.push(fallback);
      if (Array.isArray(fallback.series?.points) && fallback.series.points.length > 0) {
        copFallbackSeries = {
          ...fallback.series,
          key: "currentcop",
          label: "冷站COP"
        };
        break;
      }
    }
  }
  const fallbackSeries = fallbackResults
    .map((item) => item.series)
    .filter((series) => Array.isArray(series.points) && series.points.length > 0);
  if (copFallbackSeries) {
    fallbackSeries.push(copFallbackSeries);
  }
  const sourceStatus = [...baseSourceStatus];
  const allFallbackResults = [...fallbackResults, ...copFallbackResults];
  const fallbackAttempted = allFallbackResults.length;
  const fallbackOk = allFallbackResults.filter((item) => item.sourceStatus.ok).length;
  const fallbackRows = allFallbackResults.reduce(
    (sum, item) => sum + (typeof item.sourceStatus.rows === "number" ? item.sourceStatus.rows : 0),
    0
  );
  if (fallbackAttempted > 0) {
    const runParamsIndex = sourceStatus.findIndex((item) => item.key === "runParams");
    if (runParamsIndex >= 0) {
      const current = sourceStatus[runParamsIndex];
      const messagePrefix = current.message || "fallback-applied";
      sourceStatus[runParamsIndex] = {
        ...current,
        message: `${messagePrefix}; fallbackByTag=${fallbackOk}/${fallbackAttempted}`,
        rows:
          typeof current.rows === "number"
            ? current.rows
            : fallbackRows > 0
              ? fallbackRows
              : current.rows
      };
    }
  }
  let homeSnapshot = null;
  const ensureHomeSnapshot = async () => {
    if (homeSnapshot === null) {
      homeSnapshot = await loadHomeEnergySnapshot(baseUrl, siteId);
    }
    return homeSnapshot;
  };

  const hasCopSeries = () =>
    parsedSeries.concat(fallbackSeries).some((series) => includesAny(series.key, ["cop"]));
  if (!hasCopSeries()) {
    const snapshot = await ensureHomeSnapshot();
    const copValue = asNumber(snapshot?.metrics?.currentCop);
    if (copValue !== null) {
      const ts = snapshot.latestTimestamp || new Date().toISOString();
      fallbackSeries.push({
        label: "冷站COP",
        key: "currentcop",
        unit: null,
        points: [{ ts, value: copValue }]
      });
      fallbackResults.push({
        sourceStatus: snapshot.sourceStatus,
        series: {
          label: "冷站COP",
          key: "currentcop",
          unit: null,
          points: [{ ts, value: copValue }]
        }
      });
    }
  }

  const allSeries = [...parsedSeries, ...fallbackSeries];

  const latestTimestamp = (() => {
    const points = allSeries.flatMap((series) => series.points || []);
    const dated = points.filter((point) => point.ts && Number.isFinite(Date.parse(point.ts)));
    if (!dated.length) {
      return points.length > 0 ? new Date().toISOString() : null;
    }
    const latestTs = Math.max(...dated.map((point) => Date.parse(point.ts)));
    return new Date(latestTs).toISOString();
  })();

  const findSeries = (predicate) => {
    const matches = allSeries.filter(predicate);
    if (!matches.length) {
      return null;
    }
    return matches.sort((a, b) => {
      const aHasTs = hasAnyTimestamp(a.points) ? 1 : 0;
      const bHasTs = hasAnyTimestamp(b.points) ? 1 : 0;
      if (aHasTs !== bHasTs) {
        return bHasTs - aHasTs;
      }
      return (b.points?.length || 0) - (a.points?.length || 0);
    })[0];
  };
  const convertPoints = (series) =>
    (series?.points || []).map((point) => ({
      t: point.ts,
      v: point.value
    }));

  const totalPowerSeries = findSeries((series) =>
    includesAny(series.key, ["totalpower", "总功率"])
  );
  const copSeries = findSeries((series) => includesAny(series.key, ["cop"]));
  const chilledDeltaSeries = findSeries((series) =>
    includesAny(series.key, ["冷冻水温差", "chilleddeltat", "chilledwatertemperaturedifference"])
  );
  const coolingDeltaSeries = findSeries((series) =>
    includesAny(series.key, ["冷却水温差", "coolingdeltat", "chilledoutwatertemperaturedifference"])
  );

  const series = [
    {
      metric: "totalPowerKw",
      label: totalPowerSeries?.label || "Total Power",
      points: convertPoints(totalPowerSeries)
    },
    {
      metric: "currentCop",
      label: copSeries?.label || "COP",
      points: convertPoints(copSeries)
    },
    {
      metric: "chilledDeltaT",
      label: chilledDeltaSeries?.label || "Chilled Delta-T",
      points: convertPoints(chilledDeltaSeries)
    },
    {
      metric: "coolingDeltaT",
      label: coolingDeltaSeries?.label || "Cooling Delta-T",
      points: convertPoints(coolingDeltaSeries)
    }
  ];

  const hasRequiredFallbackMetrics = (() => {
    const metricSet = new Set(
      allSeries
        .filter((series) => Array.isArray(series.points) && series.points.length > 0)
        .map((series) => {
          const key = series.key || "";
          if (includesAny(key, ["cop"])) return "cop";
          if (includesAny(key, ["冷冻水温差", "chilleddeltat", "chilledwatertemperaturedifference"])) return "chilled";
          if (includesAny(key, ["冷却水温差", "coolingdeltat", "chilledoutwatertemperaturedifference"])) return "cooling";
          return null;
        })
        .filter(Boolean)
    );
    return metricSet.has("cop") && metricSet.has("chilled") && metricSet.has("cooling");
  })();

  const runParamsIndex = sourceStatus.findIndex((item) => item.key === "runParams");
  if (runParamsIndex >= 0 && !sourceStatus[runParamsIndex].ok && hasRequiredFallbackMetrics) {
    const current = sourceStatus[runParamsIndex];
    sourceStatus[runParamsIndex] = {
      ...current,
      ok: true,
      status: 200,
      message: `${current.message || "fallback-applied"}; fallbackCoverage=required-metrics`,
      error: null
    };
  }

  return {
    sourceStatus,
    series,
    latestTimestamp
  };
}

export async function loadRuleMetrics(baseUrl, siteId) {
  const endpoints = [
    `/zsqy/homepage/${siteId}/getEquipmentEnergyStatisticsCurve`,
    `/zsqy/homepage/${siteId}/getEnergyStatisticsCurve`,
    `/zsqy/homepage/${siteId}/getRunParamsCurve`
  ];

  const responses = await Promise.all(endpoints.map((endpoint) => fetchLegacyJson(baseUrl, endpoint)));

  const sourceStatus = responses.map((res, index) => ({
    endpoint: endpoints[index],
    ok: res.ok,
    status: res.status ?? null,
    message: res.ok ? extractMessage(res.payload, "OK") : null,
    error: res.ok ? null : res.error,
    rows: res.ok ? deepArrayProbe(res.payload).length : null
  }));

  const equipmentRows = responses[0]?.ok ? deepArrayProbe(responses[0].payload) : [];
  const equipmentMetrics = extractEquipmentMetrics(equipmentRows);

  const curveSeries = responses
    .slice(1)
    .filter((res) => res.ok)
    .flatMap((res) => parseSeriesFromPayload(res.payload));

  const freqSeries = pickChilledPumpFreqSeries(curveSeries);
  const recentFreqPoints = getRecentPoints(freqSeries?.points || [], 60);
  const maxChilledPumpFreqHz =
    recentFreqPoints.length > 0
      ? Number(Math.max(...recentFreqPoints.map((point) => point.value)).toFixed(3))
      : 0;

  const chillerRunSeries = pickSeriesForMetric(curveSeries, "chiller");
  const chilledPumpRunSeries = pickSeriesForMetric(curveSeries, "chilledPump");
  const coolingPumpRunSeries = pickSeriesForMetric(curveSeries, "coolingPump");

  const chillerStartStopCount60m = countStateTransitions(getRecentPoints(chillerRunSeries?.points || [], 60));
  const chilledPumpStartStopCount60m = countStateTransitions(
    getRecentPoints(chilledPumpRunSeries?.points || [], 60)
  );
  const coolingPumpStartStopCount60m = countStateTransitions(
    getRecentPoints(coolingPumpRunSeries?.points || [], 60)
  );

  return {
    sourceStatus,
    metrics: {
      maxChilledPumpFreqHz: Number.isFinite(maxChilledPumpFreqHz) ? maxChilledPumpFreqHz : 0,
      chillerStartStopCount60m: Number.isFinite(chillerStartStopCount60m)
        ? chillerStartStopCount60m
        : 0,
      chilledPumpStartStopCount60m: Number.isFinite(chilledPumpStartStopCount60m)
        ? chilledPumpStartStopCount60m
        : 0,
      coolingPumpStartStopCount60m: Number.isFinite(coolingPumpStartStopCount60m)
        ? coolingPumpStartStopCount60m
        : 0,
      coolingTowerPowerKw:
        asNumber(equipmentMetrics.coolingTowerPowerKw) ??
        asNumber(equipmentMetrics.totalPowerKw) ??
        0
    }
  };
}

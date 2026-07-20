import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

const B25_PROJECT_KEY = "140btwentyfive";
const B25_TIMEZONE_OFFSET = "+08:00";
const RT_KW = 3.517;

const TREND_METRIC_MAP = {
  totalPower: { key: "totalPower", drId: 127, regId: 914, label: "冷站总电量", cumulative: true },
  totalCooling: { key: "totalCooling", drId: 126, regId: 913, label: "冷冻主管累计制冷量", cumulative: true },
  chilledSupply: { key: "chilledSupply", drId: 93, regId: 880, label: "冷冻总管供水温度" },
  chilledReturn: { key: "chilledReturn", drId: 94, regId: 881, label: "冷冻总管回水温度" },
  coolingSupply: { key: "coolingSupply", drId: 128, regId: 1049, label: "冷却总管供水温度" },
  coolingReturn: { key: "coolingReturn", drId: 129, regId: 1050, label: "冷却总管回水温度" }
};

const COLD_LOG_CUMULATIVE_METRICS = {
  systemPower: { key: "systemPower", drId: 127, regId: 914, label: "冷站总电量", cumulative: true },
  totalCooling: { key: "totalCooling", drId: 126, regId: 913, label: "冷冻主管累计制冷量", cumulative: true },
  hostPower: { key: "hostPower", drId: 110, regId: 897, label: "CH总电量", cumulative: true },
  refrigeratingPumpPower: { key: "refrigeratingPumpPower", drId: 103, regId: 890, label: "CHP总电量", cumulative: true },
  coolingPumpPower: { key: "coolingPumpPower", drId: 124, regId: 911, label: "CWP总电量", cumulative: true },
  coolingTowerPower: { key: "coolingTowerPower", drId: 117, regId: 904, label: "CT总电量", cumulative: true }
};

const COLD_LOG_TEMPERATURE_METRICS = {
  chilledWaterOutputTemperature: {
    key: "chilledWaterOutputTemperature",
    drId: 93,
    regId: 880,
    label: "冷冻总管供水温度"
  },
  chilledWaterInputTemperature: {
    key: "chilledWaterInputTemperature",
    drId: 94,
    regId: 881,
    label: "冷冻总管回水温度"
  },
  coolingWaterOutputTemperature: {
    key: "coolingWaterOutputTemperature",
    drId: 128,
    regId: 1049,
    label: "冷却总管供水温度"
  },
  coolingWaterInputTemperature: {
    key: "coolingWaterInputTemperature",
    drId: 129,
    regId: 1050,
    label: "冷却总管回水温度"
  }
};

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(input) {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  return formatDate(new Date());
}

function addDays(dateText, days) {
  const base = new Date(`${dateText}T00:00:00${B25_TIMEZONE_OFFSET}`);
  if (Number.isNaN(base.getTime())) {
    return dateText;
  }
  base.setUTCDate(base.getUTCDate() + days);
  return formatDate(base);
}

function buildDateList(range, endDateText) {
  const days =
    range === "7d"
      ? 7
      : range === "30d"
        ? 30
        : 2;
  return Array.from({ length: days }, (_, index) => addDays(endDateText, index - (days - 1)));
}

function buildTimestamp(dateText, clockText) {
  const normalizedClock = asTrimmedString(clockText);
  if (!normalizedClock) {
    return null;
  }
  const parts = normalizedClock.split(":");
  if (parts.length < 2) {
    return null;
  }
  const hour = String(parts[0] || "").padStart(2, "0");
  const minute = String(parts[1] || "").padStart(2, "0");
  const second = String(parts[2] || "00").padStart(2, "0");
  const parsed = new Date(`${dateText}T${hour}:${minute}:${second}${B25_TIMEZONE_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseClockFromHistoryName(value) {
  const normalized = asTrimmedString(value);
  const match = normalized.match(/(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : null;
}

function isLegacyStatusOk(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    normalized === "20000" ||
    normalized === "200" ||
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "true"
  );
}

function isPayloadOk(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (payload.ok === false || payload.success === false) {
    return false;
  }
  if (payload.ok === true || payload.success === true) {
    return true;
  }
  if (payload.status != null) {
    return isLegacyStatusOk(payload.status);
  }
  if (payload.code != null) {
    return isLegacyStatusOk(payload.code);
  }
  return true;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function buildHistoryEndpoint(projectKey, metric, dateText) {
  const search = new URLSearchParams();
  search.set("dateType", "1");
  search.set("drId", String(metric.drId));
  search.set("date", dateText);
  search.set("regId", String(metric.regId));
  return `/zsqy/reg/${projectKey}/findRegHistoryByDrid?${search.toString()}`;
}

function parseHistoryPoints(payload, dateText) {
  const rows = deepArrayProbe({ data: payload?.data?.curveValueList ?? payload?.curveValueList ?? payload });
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const clockText = parseClockFromHistoryName(row.name);
      const ts = buildTimestamp(dateText, clockText);
      if (!ts) {
        return null;
      }
      return {
        ts,
        value: asNumber(row.value)
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
}

function trimTrailingFrozenCumulativePoints(points = []) {
  const normalized = points
    .filter((point) => point?.ts)
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const validPoints = normalized.filter((point) => typeof point?.value === "number");
  if (validPoints.length < 2) {
    return {
      validPoints,
      trimmedTailCount: 0
    };
  }

  const lastValidPoint = validPoints.at(-1);
  const lastValidTime = Date.parse(lastValidPoint?.ts || "");
  const hasPlaceholderTail = normalized.some((point) => {
    const pointTime = Date.parse(point.ts);
    return Number.isFinite(pointTime) && pointTime > lastValidTime && point.value == null;
  });

  if (!hasPlaceholderTail) {
    return {
      validPoints,
      trimmedTailCount: 0
    };
  }

  let endIndex = validPoints.length - 1;
  while (endIndex > 0 && validPoints[endIndex].value <= validPoints[endIndex - 1].value) {
    endIndex -= 1;
  }

  const cleaned = validPoints.slice(0, endIndex + 1);
  return {
    validPoints: cleaned,
    trimmedTailCount: Math.max(0, validPoints.length - cleaned.length)
  };
}

async function fetchMetricDay(baseUrl, projectKey, metric, dateText) {
  const endpoint = buildHistoryEndpoint(projectKey, metric, dateText);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = response.ok && isPayloadOk(response.payload);
  const points = usable ? parseHistoryPoints(response.payload, dateText) : [];
  const validPoints = points.filter((point) => typeof point?.value === "number");
  return {
    metric,
    date: dateText,
    endpoint,
    ok: usable,
    status: response.status ?? null,
    message: extractMessage(response.payload, usable ? "OK" : null),
    error: usable ? null : response.error || extractMessage(response.payload, "Cloud history request failed"),
    points,
    validPoints,
    latestTimestamp: validPoints.length > 0 ? validPoints.at(-1).ts : null
  };
}

async function fetchMetricRange(baseUrl, projectKey, metric, dates) {
  const days = await Promise.all(dates.map((dateText) => fetchMetricDay(baseUrl, projectKey, metric, dateText)));
  const pointsByTs = new Map();
  for (const day of days) {
    for (const point of day.points) {
      if (!point?.ts || pointsByTs.has(point.ts)) {
        continue;
      }
      pointsByTs.set(point.ts, point);
    }
  }
  const points = Array.from(pointsByTs.values()).sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const { validPoints, trimmedTailCount } = metric.cumulative
    ? trimTrailingFrozenCumulativePoints(points)
    : {
        validPoints: points.filter((point) => typeof point?.value === "number"),
        trimmedTailCount: 0
      };
  const okDays = days.filter((day) => day.ok).length;
  const latestTimestamp = validPoints.length > 0 ? validPoints.at(-1).ts : null;
  return {
    metric,
    days,
    points,
    validPoints,
    latestTimestamp,
    sourceStatus: {
      key: metric.key,
      endpoint: `/zsqy/reg/${projectKey}/findRegHistoryByDrid`,
      ok: validPoints.length > 0,
      status: okDays > 0 ? 200 : days.at(-1)?.status ?? null,
      message:
        validPoints.length > 0
          ? `${metric.label}; rangeDays=${dates.length}; daysOk=${okDays}/${dates.length}; points=${validPoints.length}${trimmedTailCount > 0 ? `; tailTrimmed=${trimmedTailCount}` : ""}`
          : `${metric.label}; rangeDays=${dates.length}; daysOk=${okDays}/${dates.length}`,
      error:
        validPoints.length > 0
          ? null
          : days.find((day) => day.error)?.error || "Cloud history points unavailable",
      rows: validPoints.length,
      interfaceKind: "cloud-reg-history",
      originLabel: "B25云端历史"
    }
  };
}

function pairPoints(leftPoints = [], rightPoints = []) {
  const rightMap = new Map(
    rightPoints
      .filter((point) => point?.ts)
      .map((point) => [point.ts, point])
  );
  return leftPoints
    .filter((point) => point?.ts && rightMap.has(point.ts))
    .map((point) => ({
      left: point,
      right: rightMap.get(point.ts)
    }));
}

function deriveIntervalSeries(cumulativePoints = [], toValue) {
  const valid = cumulativePoints
    .filter((point) => point?.ts && typeof point?.value === "number")
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const derived = [];
  for (let index = 1; index < valid.length; index += 1) {
    const previous = valid[index - 1];
    const current = valid[index];
    const deltaHours = (Date.parse(current.ts) - Date.parse(previous.ts)) / 3_600_000;
    if (!Number.isFinite(deltaHours) || deltaHours <= 0) {
      continue;
    }
    const diff = current.value - previous.value;
    const value = toValue(diff, deltaHours, previous, current);
    derived.push({
      ts: current.ts,
      value: value == null || !Number.isFinite(value) ? null : Number(value.toFixed(2))
    });
  }
  return derived;
}

function deriveDiffSeries(leftPoints = [], rightPoints = [], projector) {
  return pairPoints(leftPoints, rightPoints).map(({ left, right }) => {
    const value = projector(left.value, right.value);
    return {
      ts: left.ts,
      value: value == null || !Number.isFinite(value) ? null : Number(value.toFixed(2))
    };
  });
}

function averageValues(values = []) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) {
    return null;
  }
  const sum = valid.reduce((accumulator, value) => accumulator + value, 0);
  return Number((sum / valid.length).toFixed(2));
}

function downsampleHourly(points = []) {
  const buckets = new Map();
  for (const point of points) {
    if (!point?.ts) {
      continue;
    }
    const bucketKey = point.ts.slice(0, 13);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push(point.value);
  }
  return Array.from(buckets.entries())
    .map(([bucketKey, values]) => ({
      ts: `${bucketKey}:00:00.000Z`,
      value: averageValues(values)
    }))
    .filter((point) => point.value !== null)
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
}

function toTrendPoints(points = [], range) {
  const normalized = range === "24h" ? points : downsampleHourly(points);
  return normalized.map((point) => ({
    t: point.ts,
    v: point.value
  }));
}

function latestTimestampFromRanges(ranges = []) {
  const values = ranges
    .map((item) => item?.latestTimestamp)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (!values.length) {
    return null;
  }
  return new Date(Math.max(...values)).toISOString();
}

function buildBoundaryMap(points = []) {
  return new Map(
    points
      .filter((point) => point?.ts && typeof point?.value === "number")
      .map((point) => [point.ts, point.value])
  );
}

function buildIntervalLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return asTrimmedString(timestamp);
  }
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sliceHourPoints(points = [], startTimestamp, endTimestamp) {
  const startMs = Date.parse(startTimestamp);
  const endMs = Date.parse(endTimestamp);
  return points.filter((point) => {
    const pointMs = Date.parse(point.ts);
    return Number.isFinite(pointMs) && pointMs >= startMs && pointMs < endMs && typeof point.value === "number";
  });
}

function tonHoursFromCoolingKwh(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number((value / RT_KW).toFixed(2));
}

function buildHourlyItems(dateText, cumulativeSeries, temperatureSeries) {
  const boundaryMaps = Object.fromEntries(
    Object.entries(cumulativeSeries).map(([key, points]) => [key, buildBoundaryMap(points)])
  );
  const dayStart = `${dateText}T00:00:00${B25_TIMEZONE_OFFSET}`;
  const items = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const startTimestamp = new Date(new Date(dayStart).getTime() + hour * 3_600_000).toISOString();
    const endTimestamp = new Date(new Date(dayStart).getTime() + (hour + 1) * 3_600_000).toISOString();
    const systemStart = boundaryMaps.systemPower?.get(startTimestamp);
    const systemEnd = boundaryMaps.systemPower?.get(endTimestamp);
    const coolingStart = boundaryMaps.totalCooling?.get(startTimestamp);
    const coolingEnd = boundaryMaps.totalCooling?.get(endTimestamp);

    if (typeof systemStart !== "number" || typeof systemEnd !== "number") {
      continue;
    }

    const rawSystemPower = systemEnd - systemStart;
    if (!Number.isFinite(rawSystemPower) || rawSystemPower < 0) {
      continue;
    }

    const rawCoolingKwh =
      typeof coolingStart === "number" && typeof coolingEnd === "number"
        ? coolingEnd - coolingStart
        : null;
    const systemCoolingCapacity = tonHoursFromCoolingKwh(rawCoolingKwh);

    const hostStart = boundaryMaps.hostPower?.get(startTimestamp);
    const hostEnd = boundaryMaps.hostPower?.get(endTimestamp);
    const chilledPumpStart = boundaryMaps.refrigeratingPumpPower?.get(startTimestamp);
    const chilledPumpEnd = boundaryMaps.refrigeratingPumpPower?.get(endTimestamp);
    const coolingPumpStart = boundaryMaps.coolingPumpPower?.get(startTimestamp);
    const coolingPumpEnd = boundaryMaps.coolingPumpPower?.get(endTimestamp);
    const coolingTowerStart = boundaryMaps.coolingTowerPower?.get(startTimestamp);
    const coolingTowerEnd = boundaryMaps.coolingTowerPower?.get(endTimestamp);

    const hostPower =
      typeof hostStart === "number" && typeof hostEnd === "number" ? Number((hostEnd - hostStart).toFixed(2)) : null;
    const refrigeratingPumpPower =
      typeof chilledPumpStart === "number" && typeof chilledPumpEnd === "number"
        ? Number((chilledPumpEnd - chilledPumpStart).toFixed(2))
        : null;
    const coolingPumpPower =
      typeof coolingPumpStart === "number" && typeof coolingPumpEnd === "number"
        ? Number((coolingPumpEnd - coolingPumpStart).toFixed(2))
        : null;
    const coolingTowerPower =
      typeof coolingTowerStart === "number" && typeof coolingTowerEnd === "number"
        ? Number((coolingTowerEnd - coolingTowerStart).toFixed(2))
        : null;

    const hourlyTemperatures = Object.fromEntries(
      Object.entries(temperatureSeries).map(([key, points]) => [
        key,
        averageValues(sliceHourPoints(points, startTimestamp, endTimestamp).map((point) => point.value))
      ])
    );

    items.push({
      id: `cold-station-log-${dateText}-${hour + 1}`,
      time: buildIntervalLabel(startTimestamp),
      timestamp: startTimestamp,
      systemCoolingCapacity,
      systemPower: Number(rawSystemPower.toFixed(2)),
      hostPower,
      refrigeratingPumpPower,
      coolingPumpPower,
      coolingTowerPower,
      systemEfficiency:
        systemCoolingCapacity && systemCoolingCapacity > 0
          ? Number((rawSystemPower / systemCoolingCapacity).toFixed(3))
          : null,
      hostEfficiency:
        systemCoolingCapacity && systemCoolingCapacity > 0 && typeof hostPower === "number"
          ? Number((hostPower / systemCoolingCapacity).toFixed(3))
          : null,
      refrigerationPumpConveyingCoefficient:
        systemCoolingCapacity && systemCoolingCapacity > 0 && typeof refrigeratingPumpPower === "number" && refrigeratingPumpPower > 0
          ? Number((systemCoolingCapacity / refrigeratingPumpPower).toFixed(3))
          : null,
      coolingPumpConveyingCoefficient:
        systemCoolingCapacity && systemCoolingCapacity > 0 && typeof coolingPumpPower === "number" && coolingPumpPower > 0
          ? Number((systemCoolingCapacity / coolingPumpPower).toFixed(3))
          : null,
      coolingTowerConveyingCoefficient:
        systemCoolingCapacity && systemCoolingCapacity > 0 && typeof coolingTowerPower === "number" && coolingTowerPower > 0
          ? Number((systemCoolingCapacity / coolingTowerPower).toFixed(3))
          : null,
      chilledWaterInputTemperature: hourlyTemperatures.chilledWaterInputTemperature ?? null,
      chilledWaterOutputTemperature: hourlyTemperatures.chilledWaterOutputTemperature ?? null,
      coolingWaterInputTemperature: hourlyTemperatures.coolingWaterInputTemperature ?? null,
      coolingWaterOutputTemperature: hourlyTemperatures.coolingWaterOutputTemperature ?? null
    });
  }

  return items;
}

export function shouldUseB25CloudHistory(config, siteId) {
  const databaseKey = asTrimmedString(config?.siteSourceConfig?.databaseKey);
  const deviceDataProjectKey = asTrimmedString(config?.siteSourceConfig?.deviceDataProjectKey);
  return siteId === "btwentyfive" || databaseKey === B25_PROJECT_KEY || deviceDataProjectKey === B25_PROJECT_KEY;
}

export async function loadB25CloudTrendSeries(baseUrl, _siteId, options = {}) {
  const endDateText = normalizeDate(options.date);
  const dates = buildDateList(options.range || "24h", endDateText);
  const metricResults = await Promise.all(
    Object.values(TREND_METRIC_MAP).map((metric) => fetchMetricRange(baseUrl, B25_PROJECT_KEY, metric, dates))
  );
  const metricLookup = Object.fromEntries(metricResults.map((result) => [result.metric.key, result]));

  const totalPowerDerived = deriveIntervalSeries(metricLookup.totalPower.validPoints, (diff, deltaHours) =>
    diff >= 0 ? diff / deltaHours : null
  );
  const currentCopDerived = pairPoints(metricLookup.totalPower.validPoints, metricLookup.totalCooling.validPoints)
    .map(({ left, right }, index, list) => {
      if (index === 0) {
        return null;
      }
      const previous = list[index - 1];
      const deltaPower = left.value - previous.left.value;
      const deltaCooling = right.value - previous.right.value;
      if (!Number.isFinite(deltaPower) || !Number.isFinite(deltaCooling) || deltaPower <= 0 || deltaCooling <= 0) {
        return {
          ts: left.ts,
          value: null
        };
      }
      return {
        ts: left.ts,
        value: Number((deltaCooling / deltaPower).toFixed(3))
      };
    })
    .filter(Boolean);
  const chilledDeltaDerived = deriveDiffSeries(
    metricLookup.chilledReturn.validPoints,
    metricLookup.chilledSupply.validPoints,
    (leftValue, rightValue) => leftValue - rightValue
  );
  // 冷却总管命名沿用源系统，但按冷机进/出水方向计算温差时需要取供水减回水，保证温差为正。
  const coolingDeltaDerived = deriveDiffSeries(
    metricLookup.coolingSupply.validPoints,
    metricLookup.coolingReturn.validPoints,
    (leftValue, rightValue) => leftValue - rightValue
  );

  return {
    sourceStatus: metricResults.map((result) => result.sourceStatus),
    series: [
      {
        metric: "totalPowerKw",
        label: "总站功率",
        points: toTrendPoints(totalPowerDerived, options.range || "24h")
      },
      {
        metric: "currentCop",
        label: "冷站 COP",
        points: toTrendPoints(currentCopDerived, options.range || "24h")
      },
      {
        metric: "chilledDeltaT",
        label: "冷冻水温差",
        points: toTrendPoints(chilledDeltaDerived, options.range || "24h")
      },
      {
        metric: "coolingDeltaT",
        label: "冷却水温差",
        points: toTrendPoints(coolingDeltaDerived, options.range || "24h")
      }
    ],
    latestTimestamp: latestTimestampFromRanges([
      ...metricResults,
      { latestTimestamp: totalPowerDerived.at(-1)?.ts || null },
      { latestTimestamp: currentCopDerived.at(-1)?.ts || null },
      { latestTimestamp: chilledDeltaDerived.at(-1)?.ts || null },
      { latestTimestamp: coolingDeltaDerived.at(-1)?.ts || null }
    ])
  };
}

export async function loadB25CloudColdStationLog(baseUrl, _siteId, options = {}) {
  const dateText = normalizeDate(options.date);
  const nextDateText = addDays(dateText, 1);
  const todayText = formatDate(new Date());
  const cumulativeDates = dateText < todayText ? [dateText, nextDateText] : [dateText];

  const cumulativeResults = await Promise.all(
    Object.values(COLD_LOG_CUMULATIVE_METRICS).map((metric) => fetchMetricRange(baseUrl, B25_PROJECT_KEY, metric, cumulativeDates))
  );
  const temperatureResults = await Promise.all(
    Object.values(COLD_LOG_TEMPERATURE_METRICS).map((metric) => fetchMetricRange(baseUrl, B25_PROJECT_KEY, metric, [dateText]))
  );

  const cumulativeLookup = Object.fromEntries(cumulativeResults.map((result) => [result.metric.key, result.validPoints]));
  const temperatureLookup = Object.fromEntries(temperatureResults.map((result) => [result.metric.key, result.validPoints]));
  const items = buildHourlyItems(dateText, cumulativeLookup, temperatureLookup);
  const sumField = (field) => {
    const values = items
      .map((item) => item?.[field])
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    if (!values.length) {
      return null;
    }
    return Number(values.reduce((accumulator, value) => accumulator + value, 0).toFixed(2));
  };

  const inputPower = sumField("systemPower");
  const outputCoolingCapacity = sumField("systemCoolingCapacity");
  const hostPower = sumField("hostPower");
  const refrigeratingPumpPower = sumField("refrigeratingPumpPower");
  const coolingPumpPower = sumField("coolingPumpPower");
  const coolingTowerPower = sumField("coolingTowerPower");

  return {
    date: dateText,
    summary: {
      inputPower,
      outputCoolingCapacity,
      systemHeatDissipation: null,
      systemEfficiency:
        inputPower && outputCoolingCapacity && outputCoolingCapacity > 0
          ? Number((inputPower / outputCoolingCapacity).toFixed(3))
          : null,
      hostPower,
      refrigeratingPumpPower,
      coolingPumpPower,
      coolingTowerPower
    },
    items,
    latestTimestamp: latestTimestampFromRanges([...cumulativeResults, ...temperatureResults]),
    sourceStatus: {
      endpoint: `/zsqy/reg/${B25_PROJECT_KEY}/findRegHistoryByDrid`,
      ok: items.length > 0,
      status: items.length > 0 ? 200 : cumulativeResults.at(-1)?.sourceStatus?.status ?? null,
      message:
        items.length > 0
          ? `B25云端历史已拼接小时日志; cumulative=${cumulativeResults.length}; temperatures=${temperatureResults.length}; rows=${items.length}`
          : `B25云端历史未生成小时日志; cumulative=${cumulativeResults.length}; temperatures=${temperatureResults.length}`,
      error:
        items.length > 0
          ? null
          : cumulativeResults.find((result) => result.sourceStatus.error)?.sourceStatus.error || "Cloud history log unavailable",
      rows: items.length,
      interfaceKind: "cloud-reg-history",
      originLabel: "B25云端历史"
    }
  };
}

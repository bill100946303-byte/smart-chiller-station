import { requestLegacy, toIsoTimestamp } from "../lib/http.js";

const REALTIME_PARAMETERS_CACHE_TTL_MS = 5 * 1000;
const realtimeParametersCache = new Map();

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeBaseUrl(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

function normalizeProjectKey(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return "";
  }
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : "";
}

function normalizeTimeoutMs(value, fallback = 1500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(10_000, Math.max(300, Math.floor(parsed)));
}

function resolveDatabasePathKey(siteId, options = {}) {
  const candidates = [
    options?.databaseKey,
    ...(Array.isArray(options?.databaseKeyCandidates) ? options.databaseKeyCandidates : []),
    options?.siteSourceConfig?.databaseKey,
    options?.siteSourceConfig?.deviceDataProjectKey,
    options?.siteSourceConfig?.preferredProjectKey,
    options?.projectKey,
    ...(Array.isArray(options?.projectKeyCandidates) ? options.projectKeyCandidates : []),
    options?.siteSourceConfig?.modelKey,
    siteId
  ];
  for (const candidate of candidates) {
    const normalized = normalizeProjectKey(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function resolveModelKey(siteId, options = {}, fallbackPathKey = "") {
  const candidates = [
    options?.projectKey,
    ...(Array.isArray(options?.projectKeyCandidates) ? options.projectKeyCandidates : []),
    options?.siteSourceConfig?.modelKey,
    options?.siteSourceConfig?.preferredProjectKey,
    options?.databaseKey,
    ...(Array.isArray(options?.databaseKeyCandidates) ? options.databaseKeyCandidates : []),
    options?.siteSourceConfig?.databaseKey,
    siteId
  ];
  for (const candidate of candidates) {
    const normalized = normalizeProjectKey(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return normalizeProjectKey(fallbackPathKey);
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function isStatusOk(value) {
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
    return isStatusOk(payload.status);
  }
  if (payload.code != null) {
    return isStatusOk(payload.code);
  }
  return true;
}

function asNumber(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
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

function normalizeTagName(value) {
  return normalizeOptionalText(String(value || "")).toLowerCase();
}

function normalizeSearchText(value) {
  return normalizeOptionalText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, "");
}

function buildRowSearchText(row, groupName = "") {
  if (!row || typeof row !== "object") {
    return normalizeSearchText(groupName);
  }
  return [
    groupName,
    row.tagName,
    row.tagname,
    row.regName,
    row.regname,
    row.name,
    row.title,
    row.label,
    row.description,
    row.explain,
    row.regExplain,
    row.alarmexplain,
    row.pointName,
    row.paramName,
    row.showName
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join("|");
}

function extractRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const groups = Array.isArray(payload?.data) ? payload.data : [];
  const rows = [];

  for (const group of groups) {
    const groupRows = Array.isArray(group?.data) ? group.data : [];
    for (const row of groupRows) {
      if (!row || typeof row !== "object") {
        continue;
      }
      rows.push({
        ...row,
        groupName: normalizeOptionalText(group?.groupName) || null
      });
    }
  }

  if (rows.length > 0) {
    return rows;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data.filter((row) => row && typeof row === "object");
  }

  return [];
}

function pickMetric(rows, aliases = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const aliasSet = new Set(aliases.map(normalizeTagName).filter(Boolean));
  for (const row of rows) {
    const tagName = normalizeTagName(row?.tagName || row?.tagname);
    if (!aliasSet.has(tagName)) {
      continue;
    }
    const value = asNumber(row?.tagValue ?? row?.tagvalue ?? row?.value);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function pickMetricByMatcher(rows, matcher) {
  if (!Array.isArray(rows) || rows.length === 0 || typeof matcher !== "function") {
    return null;
  }
  for (const row of rows) {
    const tagName = normalizeTagName(row?.tagName || row?.tagname);
    const groupName = normalizeTagName(row?.groupName);
    const searchText = buildRowSearchText(row, groupName);
    const value = asNumber(row?.tagValue ?? row?.tagvalue ?? row?.value);
    if (value === null) {
      continue;
    }
    if (matcher({ tagName, groupName, searchText, value, row })) {
      return value;
    }
  }
  return null;
}

function pickMetricWithFallback(rows, aliases, matcher) {
  const exact = pickMetric(rows, aliases);
  return exact !== null ? exact : pickMetricByMatcher(rows, matcher);
}

function isWeatherGroup(groupName) {
  return groupName.includes("\u5929\u6c14") || groupName.includes("weather");
}

function hasOutdoorContext(searchText) {
  return (
    /室外|户外|户外环境|外气|天气|气象|室外环境|室外空气/.test(searchText) ||
    /outdoor|outside|ambient|weather|oat|oa/.test(searchText)
  );
}

function isLikelyOutdoorTemperature({ tagName, groupName, searchText, value }) {
  if (value < -40 || value > 70) {
    return false;
  }
  if (/^rht(?:-|$)/.test(tagName)) {
    return true;
  }
  if (
    hasOutdoorContext(searchText) &&
    (/温度|干球|temperature|temp|drybulb|drybulbtemp/.test(searchText)) &&
    !/湿度|湿球|露点|humidity|wetbulb|dew/.test(searchText)
  ) {
    return true;
  }
  return (
    isWeatherGroup(groupName) &&
    (/温度|temperature|temp|干球|drybulb/.test(searchText)) &&
    !/湿度|湿球|露点|humidity|wetbulb|dew/.test(searchText)
  );
}

function isLikelyOutdoorHumidity({ tagName, groupName, searchText, value }) {
  if (value < 0 || value > 100) {
    return false;
  }
  if (/^rhh(?:-|$)/.test(tagName)) {
    return true;
  }
  if (
    hasOutdoorContext(searchText) &&
    (/湿度|相对湿度|humidity|relativehumidity|\brh\b/.test(searchText)) &&
    !/设定|上限|下限|setting|setpoint|limit/.test(searchText)
  ) {
    return true;
  }
  return (
    isWeatherGroup(groupName) &&
    (/湿度|humidity|relativehumidity|\brh\b/.test(searchText)) &&
    !/设定|上限|下限|setting|setpoint|limit/.test(searchText)
  );
}

function isLikelyOutdoorWetBulb({ tagName, groupName, searchText, value }) {
  if (value < -20 || value > 60) {
    return false;
  }
  return (
    tagName.includes("wetbulb") ||
    /湿球|wetbulb|wetbulbtemperature/.test(searchText) ||
    (
      isWeatherGroup(groupName) &&
      !/^rhh(?:-|$)/.test(tagName) &&
      !/^rht(?:-|$)/.test(tagName) &&
      !tagName.includes("tdtemperature") &&
      !tagName.includes("dew") &&
      !/湿度|humidity|露点|dew/.test(searchText)
    )
  );
}

function pickLatestTimestamp(payload, rows) {
  const timestamps = [];
  const payloadCandidates = [
    payload?.time,
    payload?.timestamp,
    payload?.dataTime,
    payload?.createTime,
    payload?.updateTime
  ];
  for (const candidate of payloadCandidates) {
    const normalized = toIsoTimestamp(candidate);
    if (normalized) {
      timestamps.push(normalized);
    }
  }
  for (const row of rows || []) {
    const normalized = toIsoTimestamp(
      row?.time || row?.timestamp || row?.createTime || row?.updateTime
    );
    if (normalized) {
      timestamps.push(normalized);
    }
  }
  if (timestamps.length === 0) {
    return null;
  }
  const latest = timestamps
    .map((item) => Date.parse(item))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .at(-1);
  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
}

function buildMetrics(rows) {
  return {
    totalPowerKw: pickMetric(rows, ["totalPower"]),
    currentCop: pickMetric(rows, ["coldStationCop", "cop"]),
    totalElectricityKwh: pickMetric(rows, ["totalElectricity"]),
    totalCoolingCapacity: pickMetric(rows, ["totalCoolingCapacity"]),
    chilledDeltaT: pickMetric(rows, ["chilledWaterTemperatureDifference"]),
    coolingDeltaT: pickMetric(rows, ["chilledOutWaterTemperatureDifference"]),
    chillerCop: pickMetric(rows, ["chillerCop"]),
    chilledPumpConveyingCoefficient: pickMetric(rows, ["chilledWaterPumpCop"]),
    coolingTowerConveyingCoefficient: pickMetric(rows, ["coolingTowerCop"]),
    coolingPumpConveyingCoefficient: pickMetric(rows, ["coolingWaterPumpCop"]),
    thermalUnbalanceRate: pickMetric(rows, ["thermalUnbalanceRate"]),
    chilledSupplyTemp: pickMetric(rows, [
      "coolingRturnWaterTemperature",
      "chilledWaterSupplyTemperature"
    ]),
    coolingReturnTemp: pickMetric(rows, [
      "coolingWaterTemperature",
      "coolingWaterReturnTemperature"
    ]),
    outdoorTempC: pickMetricWithFallback(
      rows,
      [
        "506-40631",
        "outdoorTemperature",
        "outdoorTemp",
        "outdoorAirTemperature",
        "ambientTemperature",
        "weatherTemperature"
      ],
      isLikelyOutdoorTemperature
    ),
    outdoorHumidityPct: pickMetricWithFallback(
      rows,
      [
        "506-40633",
        "outdoorHumidity",
        "outdoorRelativeHumidity",
        "outdoorRh",
        "ambientHumidity",
        "weatherHumidity"
      ],
      isLikelyOutdoorHumidity
    ),
    outdoorWetBulbC: pickMetricWithFallback(
      rows,
      ["506-40635", "502-40889", "outdoorWetBulb", "wetBulbTemperature"],
      isLikelyOutdoorWetBulb
    ),
    dewPointC: pickMetric(rows, ["tdtemperature", "dewPoint", "dewPointTemperature"])
  };
}

function buildEndpoint(pathProjectKey, modelKey) {
  const search = new URLSearchParams();
  search.set("modelKey", modelKey || pathProjectKey);
  return `/wx/device/${pathProjectKey}/listRealTimeParameters?${search.toString()}`;
}

function buildCacheKey(baseUrl, pathProjectKey, modelKey, timeoutMs) {
  return JSON.stringify([baseUrl, pathProjectKey, modelKey, timeoutMs]);
}

async function loadRealtimeParametersSnapshotInternal(baseUrl, siteId, options = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const pathProjectKey = resolveDatabasePathKey(siteId, options);
  const modelKey = resolveModelKey(siteId, options, pathProjectKey);
  const timeoutMs = normalizeTimeoutMs(options?.timeoutMs, 1500);

  if (!normalizedBaseUrl) {
    return {
      sourceStatus: {
        key: "realtimeParameters",
        endpoint: null,
        ok: false,
        status: null,
        message: null,
        error: "Realtime parameters base url missing",
        rows: null
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  if (!pathProjectKey) {
    return {
      sourceStatus: {
        key: "realtimeParameters",
        endpoint: null,
        ok: false,
        status: null,
        message: null,
        error: "Realtime parameters database path key missing",
        rows: null
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  const endpoint = buildEndpoint(pathProjectKey, modelKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await requestLegacy(normalizedBaseUrl, endpoint, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return {
      sourceStatus: {
        key: "realtimeParameters",
        endpoint,
        ok: false,
        status: response.status ?? null,
        message: null,
        error: response.error || "Realtime parameters request failed",
        rows: null
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  const payload = response.payload;
  if (!isPayloadOk(payload)) {
    return {
      sourceStatus: {
        key: "realtimeParameters",
        endpoint,
        ok: false,
        status: response.status ?? null,
        message: extractMessage(payload, null),
        error: "Realtime parameters payload status indicates failure",
        rows: null
      },
      metrics: null,
      latestTimestamp: null
    };
  }

  const rows = extractRows(payload);
  const latestTimestamp = pickLatestTimestamp(payload, rows);
  const timestampMissing = rows.length > 0 && !latestTimestamp;
  return {
    sourceStatus: {
      key: "realtimeParameters",
      endpoint,
      ok: true,
      status: response.status ?? null,
      message: `${extractMessage(payload, "OK")}${timestampMissing ? "; timestampMissing=true" : ""}`,
      error: null,
      rows: rows.length
    },
    metrics: buildMetrics(rows),
    latestTimestamp
  };
}

export async function loadRealtimeParametersSnapshot(baseUrl, siteId, options = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const pathProjectKey = resolveDatabasePathKey(siteId, options);
  const modelKey = resolveModelKey(siteId, options, pathProjectKey);
  const timeoutMs = normalizeTimeoutMs(options?.timeoutMs, 1500);
  const cacheKey = buildCacheKey(normalizedBaseUrl, pathProjectKey, modelKey, timeoutMs);
  const now = Date.now();
  const cached = realtimeParametersCache.get(cacheKey);

  if (cached) {
    if (cached.pending === true) {
      return cached.promise;
    }
    if (cached.expiresAt > now) {
      return cached.promise;
    }
    realtimeParametersCache.delete(cacheKey);
  }

  const entry = {
    pending: true,
    expiresAt: 0,
    promise: null
  };
  const promise = loadRealtimeParametersSnapshotInternal(baseUrl, siteId, options)
    .then((result) => {
      if (result?.sourceStatus?.ok) {
        entry.pending = false;
        entry.expiresAt = Date.now() + REALTIME_PARAMETERS_CACHE_TTL_MS;
        return result;
      }
      realtimeParametersCache.delete(cacheKey);
      return result;
    })
    .catch((error) => {
      realtimeParametersCache.delete(cacheKey);
      throw error;
    });
  entry.promise = promise;
  realtimeParametersCache.set(cacheKey, entry);
  return promise;
}

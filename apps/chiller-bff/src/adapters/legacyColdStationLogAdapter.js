import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

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

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
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

function isLegacyPayloadFailed(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  if (payload.ok === false || payload.success === false) {
    return true;
  }

  if (payload.ok === true || payload.success === true) {
    return false;
  }

  if (payload.status != null) {
    return !isLegacyStatusOk(payload.status);
  }

  if (payload.code != null) {
    return !isLegacyStatusOk(payload.code);
  }

  return false;
}

function isLegacyResponseUsable(response) {
  return response.ok && !isLegacyPayloadFailed(response.payload);
}

function buildIdentifierCandidates(
  siteId,
  projectKey,
  projectKeyCandidates = [],
  databaseKey = "",
  databaseKeyCandidates = []
) {
  const dbCandidates = Array.isArray(databaseKeyCandidates) ? databaseKeyCandidates : [];
  const extraCandidates = Array.isArray(projectKeyCandidates) ? projectKeyCandidates : [];
  return Array.from(
    new Set(
      [...dbCandidates, databaseKey, ...extraCandidates, projectKey, siteId]
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )
  );
}

function buildIdentifierProbeSummary(attempts = []) {
  return attempts
    .map((attempt) => {
      if (attempt?.usable) {
        return `${attempt.identifier}:rows=${attempt.rows ?? 0}`;
      }
      return `${attempt?.identifier || "unknown"}:failed`;
    })
    .join(",");
}

function buildEndpoint(siteId, date) {
  const search = new URLSearchParams();
  search.set("date", date);
  return `/zsqy/lengzhanrecords/${siteId}/getLengZhanRecords?${search.toString()}`;
}

function pickPayloadData(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  if (payload && typeof payload === "object") {
    return payload;
  }
  return null;
}

function normalizeSummary(data) {
  return {
    inputPower: asNumber(data?.inputPower),
    outputCoolingCapacity: asNumber(data?.outputCoolingCapacity),
    systemHeatDissipation: asNumber(data?.systemHeatDissipation),
    systemEfficiency: asNumber(data?.systemEfficiency),
    hostPower: asNumber(data?.hostPower),
    refrigeratingPumpPower: asNumber(data?.refrigeratingPumpPower),
    coolingPumpPower: asNumber(data?.coolingPumpPower),
    coolingTowerPower: asNumber(data?.coolingTowerPower)
  };
}

function getDetailRows(payloadData) {
  const directRows = payloadData?.lengZhanRecordsDetailVOList;
  if (Array.isArray(directRows)) {
    return directRows;
  }
  if (directRows && typeof directRows === "object") {
    return deepArrayProbe({ data: directRows }).filter((item) => item && typeof item === "object");
  }
  return [];
}

function buildRowTimestamp(date, value) {
  const time = String(value || "").trim();
  if (!time) {
    return null;
  }
  const match = time.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) {
    return null;
  }
  const [, hourRaw, minuteRaw, secondRaw] = match;
  const hour = String(hourRaw).padStart(2, "0");
  const minute = String(minuteRaw || "0").padStart(2, "0");
  const second = String(secondRaw || "0").padStart(2, "0");
  const parsed = new Date(`${date}T${hour}:${minute}:${second}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeRow(row, index, date) {
  const time = String(row?.time || row?.hour || `${index + 1}`).trim();
  return {
    id: `cold-station-log-${date}-${index + 1}`,
    time,
    timestamp: buildRowTimestamp(date, time),
    systemCoolingCapacity: asNumber(row?.systemCoolingCapacity),
    systemPower: asNumber(row?.systemPower),
    hostPower: asNumber(row?.hostPower),
    refrigeratingPumpPower: asNumber(row?.refrigeratingPumpPower),
    coolingPumpPower: asNumber(row?.coolingPumpPower),
    coolingTowerPower: asNumber(row?.coolingTowerPower),
    systemEfficiency: asNumber(row?.systemEfficiency),
    hostEfficiency: asNumber(row?.hostEfficiency),
    refrigerationPumpConveyingCoefficient: asNumber(row?.refrigerationPumpConveyingCoefficient),
    coolingPumpConveyingCoefficient: asNumber(row?.coolingPumpConveyingCoefficient),
    coolingTowerConveyingCoefficient: asNumber(row?.coolingTowerConveyingCoefficient),
    chilledWaterInputTemperature: asNumber(row?.chilledWaterInputTemperature),
    chilledWaterOutputTemperature: asNumber(row?.chilledWaterOutputTemperature),
    coolingWaterInputTemperature: asNumber(row?.coolingWaterInputTemperature),
    coolingWaterOutputTemperature: asNumber(row?.coolingWaterOutputTemperature)
  };
}

async function fetchAcrossIdentifiers(baseUrl, siteId, date, options = {}) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const attempts = [];
  let firstUsable = null;
  let firstUsableWithRows = null;

  for (const identifier of identifiers) {
    const endpoint = buildEndpoint(identifier, date);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    const payloadData = isLegacyResponseUsable(response) ? pickPayloadData(response.payload) : null;
    const rows = payloadData ? getDetailRows(payloadData).length : null;
    const attempt = {
      identifier,
      endpoint,
      response,
      payloadData,
      rows,
      usable: isLegacyResponseUsable(response)
    };
    attempts.push(attempt);
    if (!firstUsable && attempt.usable) {
      firstUsable = attempt;
    }
    if (!firstUsableWithRows && attempt.usable && typeof rows === "number" && rows > 0) {
      firstUsableWithRows = attempt;
      break;
    }
  }

  return {
    attempts,
    selected: firstUsableWithRows || firstUsable || null
  };
}

export async function loadColdStationLog(baseUrl, siteId, options = {}) {
  const date = normalizeDate(options.date);
  const lookup = await fetchAcrossIdentifiers(baseUrl, siteId, date, options);
  const attempts = Array.isArray(lookup?.attempts) ? lookup.attempts : [];
  const selected = lookup?.selected;
  const fallbackEndpoint = buildEndpoint(asTrimmedString(siteId), date);
  const fetchedAt = new Date().toISOString();
  const payloadData = selected?.usable ? selected.payloadData : null;
  const detailRows = getDetailRows(payloadData);
  const summary = normalizeSummary(payloadData);
  const items = detailRows.map((row, index) => normalizeRow(row, index, date));
  const probeSummary = buildIdentifierProbeSummary(attempts);
  const probeSuffix =
    attempts.length > 1 && probeSummary
      ? `; identifierProbe=${probeSummary}; selected=${selected?.identifier || "none"}`
      : "";
  const detailRowsMissing = selected?.usable && items.length === 0;
  const integritySuffix = detailRowsMissing ? `${probeSuffix}; detailRows=0` : probeSuffix;
  const message = selected?.usable
    ? `${extractMessage(selected.response.payload, "OK") || "OK"}${integritySuffix}`
    : null;
  const failedAttempt = attempts.at(-1);
  const failedPayload = failedAttempt?.response?.payload;
  const failedMessage = extractMessage(failedPayload, null);
  const sourceOk = Boolean(selected?.usable) && !detailRowsMissing;

  return {
    date,
    summary,
    items,
    latestTimestamp: sourceOk ? fetchedAt : null,
    sourceStatus: {
      endpoint: selected?.endpoint || failedAttempt?.endpoint || fallbackEndpoint,
      ok: sourceOk,
      status: selected?.response?.status ?? failedAttempt?.response?.status ?? null,
      message: message || failedMessage,
      rows: selected?.usable ? items.length : null,
      error: sourceOk
        ? null
        : detailRowsMissing
          ? "Legacy detail rows missing"
          : failedAttempt?.response?.error || failedMessage || "Legacy request failed"
    }
  };
}

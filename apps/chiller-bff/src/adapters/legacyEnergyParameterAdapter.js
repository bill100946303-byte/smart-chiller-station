import { fetchLegacyJson } from "../lib/http.js";

const LOCAL_TIMEZONE_OFFSET = "+08:00";

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function normalizePeriodList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asTrimmedString(item)).filter(Boolean);
  }
  return asTrimmedString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDateValue(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{13}$/.test(normalized) || /^\d{10}$/.test(normalized)) {
    const multiplier = normalized.length === 10 ? 1000 : 1;
    const parsed = new Date(Number(normalized) * multiplier);
    if (Number.isFinite(parsed.getTime())) {
      const shifted = new Date(parsed.getTime() + 8 * 60 * 60 * 1000);
      const year = shifted.getUTCFullYear();
      const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
      const day = String(shifted.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  return normalized;
}

function encodeDateValue(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return "";
  }
  if (/^\d{10,13}$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = Date.parse(`${normalized}T00:00:00.000${LOCAL_TIMEZONE_OFFSET}`);
    return Number.isFinite(parsed) ? String(parsed) : normalized;
  }
  return normalized;
}

function normalizeRecord(item) {
  return {
    id: asTrimmedString(item?.id),
    schemeName: asTrimmedString(item?.schemeName),
    startPeriod: normalizeDateValue(item?.startPeriod),
    endPeriod: normalizeDateValue(item?.endPeriod),
    peakPeriod: normalizePeriodList(item?.peakPeriod),
    peakPrice: asTrimmedString(item?.peakPrice),
    averagePeriod: normalizePeriodList(item?.averagePeriod),
    averagePrice: asTrimmedString(item?.averagePrice),
    valleyPeriod: normalizePeriodList(item?.valleyPeriod),
    valleyPrice: asTrimmedString(item?.valleyPrice),
    sharpTime: normalizePeriodList(item?.sharpTime),
    sharpPrice: asTrimmedString(item?.sharpPrice)
  };
}

function encodeRecord(input) {
  return {
    ...input,
    startPeriod: encodeDateValue(input?.startPeriod),
    endPeriod: encodeDateValue(input?.endPeriod),
    peakPeriod: Array.isArray(input?.peakPeriod) ? input.peakPeriod.join(",") : "",
    averagePeriod: Array.isArray(input?.averagePeriod) ? input.averagePeriod.join(",") : "",
    valleyPeriod: Array.isArray(input?.valleyPeriod) ? input.valleyPeriod.join(",") : "",
    sharpTime: Array.isArray(input?.sharpTime) ? input.sharpTime.join(",") : ""
  };
}

function buildGetEndpoint(siteId) {
  return `/zsqy/energyparameters/${siteId}/findAll`;
}

function buildUpdateEndpoint(siteId) {
  return `/zsqy/energyparameters/${siteId}/update`;
}

export async function loadEnergyParameters(baseUrl, siteId) {
  const endpoint = buildGetEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data && typeof payload.data === "object"
      ? [payload.data]
    : Array.isArray(payload)
      ? payload
      : [];
  const record = rows.length > 0 ? normalizeRecord(rows[0]) : null;

  return {
    item: record,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? rows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function updateEnergyParameters(baseUrl, siteId, data) {
  const endpoint = buildUpdateEndpoint(siteId);
  let response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(encodeRecord(data || {}))
    });
  } catch (error) {
    return {
      ok: false,
      status: null,
      endpoint,
      error: `Legacy request error: ${String(error)}`,
      message: null
    };
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    endpoint,
    message: extractMessage(payload, response.ok ? "OK" : null),
    error: response.ok ? null : `Legacy request failed: ${response.status}`
  };
}

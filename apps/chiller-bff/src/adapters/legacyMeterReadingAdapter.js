import { fetchLegacyBinary, fetchLegacyJson } from "../lib/http.js";

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

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date, kind) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = kind === "end" ? "23" : "00";
  const minute = kind === "end" ? "59" : "00";
  const second = kind === "end" ? "59" : "00";
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function normalizeDateTimeInput(value, kind = "start") {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return formatDateTime(new Date(), kind);
}

function buildMeterReadingEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  return `/zsqy/reportmanage/${siteId}/findEnergyCoolingCapacity?${search.toString()}`;
}

function buildMeterReadingExportEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  return `/zsqy/reportmanage/${siteId}/exportCoolingCapacity?${search.toString()}`;
}

function normalizeCellValue(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function normalizeRow(row) {
  const output = {};
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return output;
  }

  Object.entries(row).forEach(([key, value]) => {
    output[String(key)] = normalizeCellValue(value);
  });
  return output;
}

function collectColumns(rows) {
  const columns = [];
  const seen = new Set();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });
  return columns;
}

function parseFilename(contentDisposition, fallback) {
  const raw = asTrimmedString(contentDisposition, "");
  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch (_error) {
      return utfMatch[1];
    }
  }
  const plainMatch = raw.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    try {
      return decodeURIComponent(plainMatch[1]);
    } catch (_error) {
      return plainMatch[1];
    }
  }
  return fallback;
}

export async function loadMeterReadings(baseUrl, siteId, options = {}) {
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const endpoint = buildMeterReadingEndpoint(siteId, { startTime, endTime });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rowsRaw = Array.isArray(payload?.data?.records)
    ? payload.data.records
    : Array.isArray(payload?.records)
      ? payload.records
      : [];
  const rows = rowsRaw.map(normalizeRow);
  const columns = collectColumns(rows);

  return {
    filters: {
      startTime,
      endTime
    },
    columns,
    items: rows,
    total: rows.length,
    latestTimestamp: fetchedAt,
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

export async function loadMeterReadingExport(baseUrl, siteId, options = {}) {
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const endpoint = buildMeterReadingExportEndpoint(siteId, { startTime, endTime });
  const response = await fetchLegacyBinary(baseUrl, endpoint);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status ?? null,
      endpoint,
      error: response.error || "Legacy export failed",
      contentType: response.headers?.contentType || "application/octet-stream",
      filename: `meter-reading-${siteId}.xls`,
      data: null
    };
  }

  return {
    ok: true,
    status: response.status,
    endpoint,
    error: null,
    contentType: response.headers?.contentType || "application/vnd.ms-excel",
    filename: parseFilename(response.headers?.contentDisposition, `meter-reading-${siteId}.xls`),
    data: response.data
  };
}

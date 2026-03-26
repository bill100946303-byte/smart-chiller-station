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

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toNullableFilterId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value).trim() || null;
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

function normalizeDateTimeInput(value, kind = "start") {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return formatDateTime(new Date(), kind);
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

function normalizeRegOption(item, index) {
  return {
    id: asTrimmedString(item?.typemodeid || item?.regId || item?.id || `reg-${index + 1}`),
    label: asTrimmedString(item?.regNameCNEN || item?.regName || item?.name || `reg-${index + 1}`)
  };
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

function buildRegOptionEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("drtypeid", String(options.drTypeId));
  search.set("drId", String(options.drId));
  return `/zsqy/Drtypemode/${siteId}/findAllDrTypeModeByDrTypeId?${search.toString()}`;
}

function buildReportRecordEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("pageCurrent", String(options.page));
  search.set("pageSize", String(options.pageSize));
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("drTypeId", String(options.drTypeId));
  search.set("drId", String(options.drId));
  if (options.regIds.length > 0) {
    search.set("regIds", options.regIds.join(","));
  }
  return `/zsqy/reportmanage/${siteId}/findByTimeSpace?${search.toString()}`;
}

function buildReportRecordExportEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("drTypeId", String(options.drTypeId));
  search.set("drId", String(options.drId));
  if (options.regIds.length > 0) {
    search.set("regIds", options.regIds.join(","));
  }
  return `/zsqy/reportmanage/${siteId}/export?${search.toString()}`;
}

export async function loadReportRecordRegOptions(baseUrl, siteId, options = {}) {
  const drTypeId = toNullableFilterId(options.drTypeId) || "0";
  const drId = toNullableFilterId(options.drId) || "0";
  const endpoint = buildRegOptionEndpoint(siteId, { drTypeId, drId });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return {
    drTypeId,
    drId,
    items: rows.map(normalizeRegOption),
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

export async function loadReportRecords(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const drTypeId = toNullableFilterId(options.drTypeId) || "0";
  const drId = toNullableFilterId(options.drId) || "0";
  const regIds = Array.isArray(options.regIds)
    ? options.regIds.map((item) => asTrimmedString(item, "")).filter(Boolean)
    : [];
  const endpoint = buildReportRecordEndpoint(siteId, {
    page,
    pageSize,
    startTime,
    endTime,
    drTypeId,
    drId,
    regIds
  });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rowsRaw = Array.isArray(payload?.data?.records)
    ? payload.data.records
    : Array.isArray(payload?.records)
      ? payload.records
      : [];
  const rows = rowsRaw.map(normalizeRow);
  const totalRaw = payload?.data?.rowCount ?? payload?.rowCount ?? rows.length;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : rows.length;
  const columns = collectColumns(rows);

  return {
    filters: {
      startTime,
      endTime,
      drTypeId,
      drId,
      regIds
    },
    columns,
    items: rows,
    total,
    page,
    pageSize,
    filenamePrefix: asTrimmedString(payload?.data2, ""),
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

export async function loadReportRecordExport(baseUrl, siteId, options = {}) {
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const drTypeId = toNullableFilterId(options.drTypeId) || "0";
  const drId = toNullableFilterId(options.drId) || "0";
  const regIds = Array.isArray(options.regIds)
    ? options.regIds.map((item) => asTrimmedString(item, "")).filter(Boolean)
    : [];
  const endpoint = buildReportRecordExportEndpoint(siteId, {
    startTime,
    endTime,
    drTypeId,
    drId,
    regIds
  });
  const response = await fetchLegacyBinary(baseUrl, endpoint);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status ?? null,
      endpoint,
      error: response.error || "Legacy export failed",
      contentType: response.headers?.contentType || "application/octet-stream",
      filename: `report-record-${siteId}.xls`,
      data: null
    };
  }

  return {
    ok: true,
    status: response.status,
    endpoint,
    error: null,
    contentType: response.headers?.contentType || "application/vnd.ms-excel",
    filename: parseFilename(response.headers?.contentDisposition, `report-record-${siteId}.xls`),
    data: response.data
  };
}

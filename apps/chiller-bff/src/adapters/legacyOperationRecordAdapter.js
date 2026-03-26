import { fetchLegacyJson } from "../lib/http.js";

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

function toTimestamp(value) {
  const raw = asTrimmedString(value, "");
  if (!raw) {
    return null;
  }
  const date = new Date(raw.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRecord(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.recordId || item?.runrecordid || `op-record-${index + 1}`),
    date: asTrimmedString(item?.date || item?.createTime || item?.time || "--"),
    timestamp: toTimestamp(item?.date || item?.createTime || item?.time),
    details: asTrimmedString(item?.details || item?.content || item?.operationContent || "--"),
    operationResult: asTrimmedString(item?.operationResult || item?.result || item?.status || "--"),
    operationPerson: asTrimmedString(item?.operationPerson || item?.userName || item?.operator || "--")
  };
}

function normalizeTypeNode(node, index, parentId = null) {
  const id = asTrimmedString(node?.drtypeid || node?.id || `type-${index + 1}`);
  const childrenRaw = Array.isArray(node?.drtypeinfoList) ? node.drtypeinfoList : [];
  return {
    id,
    label: asTrimmedString(node?.drtypenameCNEN || node?.drtypename || node?.name || id),
    parentId,
    children: childrenRaw.map((child, childIndex) => normalizeTypeNode(child, childIndex, id))
  };
}

function normalizeDeviceOption(item, index) {
  return {
    id: asTrimmedString(item?.drid || item?.id || `device-${index + 1}`),
    label: asTrimmedString(item?.drnameCNEN || item?.drname || item?.name || `device-${index + 1}`)
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDateInput(value, fallback = formatDate(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function buildOperationRecordEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("pageCurrent", String(options.page));
  search.set("pageSize", String(options.pageSize));
  search.set("startTime", `${options.startDate} 00:00:00`);
  search.set("endTime", `${options.endDate} 23:59:59`);
  if (options.drTypeId != null) {
    search.set("drTypeId", String(options.drTypeId));
  }
  if (options.drId != null) {
    search.set("drId", String(options.drId));
  }
  return `/zsqy/runrecords/${siteId}/findAll?${search.toString()}`;
}

function buildDeviceTypeEndpoint(siteId) {
  return `/zsqy/Drtypeinfo/${siteId}/findAllDrtypeOfDevice`;
}

function buildDeviceOptionEndpoint(siteId, drTypeId) {
  const search = new URLSearchParams();
  search.set("drtypeid", String(drTypeId));
  return `/zsqy/drinfo/${siteId}/findAll?${search.toString()}`;
}

export async function loadOperationRecords(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const drTypeId = toNullableFilterId(options.drTypeId);
  const drId = toNullableFilterId(options.drId);
  const endpoint = buildOperationRecordEndpoint(siteId, {
    page,
    pageSize,
    startDate,
    endDate,
    drTypeId,
    drId
  });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const records = Array.isArray(payload?.data?.records)
    ? payload.data.records
    : Array.isArray(payload?.records)
      ? payload.records
      : [];
  const totalRaw = payload?.data?.rowCount ?? payload?.rowCount ?? records.length;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : records.length;

  return {
    items: records.map(normalizeRecord),
    total,
    page,
    pageSize,
    latestTimestamp: fetchedAt,
    filters: {
      startDate,
      endDate,
      drTypeId,
      drId
    },
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? records.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function loadOperationRecordDeviceTypes(baseUrl, siteId) {
  const endpoint = buildDeviceTypeEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return {
    items: rows.map((item, index) => normalizeTypeNode(item, index)),
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

export async function loadOperationRecordDevices(baseUrl, siteId, drTypeId) {
  const normalizedTypeId = toNullableFilterId(drTypeId) || "0";
  const endpoint = buildDeviceOptionEndpoint(siteId, normalizedTypeId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return {
    drTypeId: normalizedTypeId,
    items: rows.map(normalizeDeviceOption),
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

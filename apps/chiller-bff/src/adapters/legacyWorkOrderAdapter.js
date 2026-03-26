import { fetchLegacyBinary, fetchLegacyJson, requestLegacy } from "../lib/http.js";

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

function isLegacyPayloadOk(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return String(payload.status || "") === "20000" || payload.ok === true;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toNullableFilter(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoTimestamp(value) {
  const normalized = asTrimmedString(value, "");
  if (!normalized) {
    return null;
  }
  const date = new Date(normalized.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeWorkOrder(row, index) {
  return {
    id: asTrimmedString(row?.id || row?.workorderid || `work-order-${index + 1}`),
    deviceTypeId: asTrimmedString(row?.drtypeid),
    deviceTypeName: asTrimmedString(row?.drtypename || "--"),
    deviceId: asTrimmedString(row?.drid),
    deviceName: asTrimmedString(row?.drname || "--"),
    workTime: asTrimmedString(row?.worktime || ""),
    workTimestamp: toIsoTimestamp(row?.worktime),
    workUser: asTrimmedString(row?.workuser || "--"),
    workLevel: toNullableInteger(row?.worklevel),
    executeUser: asTrimmedString(row?.executeuser || "--"),
    executeTime: asTrimmedString(row?.executetime || ""),
    executeTimestamp: toIsoTimestamp(row?.executetime),
    finishTime: asTrimmedString(row?.finishtime || ""),
    finishTimestamp: toIsoTimestamp(row?.finishtime),
    state: toNullableInteger(row?.state),
    workExplain: asTrimmedString(row?.workexplain || "--")
  };
}

function normalizeAssignee(row, index) {
  return {
    id: asTrimmedString(row?.userid || row?.id || `assignee-${index + 1}`),
    username: asTrimmedString(row?.username || row?.name || `assignee-${index + 1}`)
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

function buildWorkOrderListEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("pageCurrent", String(options.page));
  search.set("pageSize", String(options.pageSize));
  if (options.id) {
    search.set("id", options.id);
  }
  if (options.state) {
    search.set("state", options.state);
  }
  if (options.startDate) {
    search.set("startTime", options.startDate);
  }
  if (options.endDate) {
    search.set("endTime", options.endDate);
  }
  return `/zsqy/qsworkorder/${siteId}/findObject?${search.toString()}`;
}

function buildWorkOrderAssigneeEndpoint(siteId) {
  return `/zsqy/appuser/${siteId}/findAll`;
}

function buildWorkOrderSaveEndpoint(siteId) {
  return `/zsqy/qsworkorder/${siteId}/save`;
}

function buildWorkOrderUpdateEndpoint(siteId) {
  return `/zsqy/qsworkorder/${siteId}/update`;
}

function buildWorkOrderDeleteEndpoint(siteId, orderId) {
  const search = new URLSearchParams();
  search.set("ids", orderId);
  return `/zsqy/qsworkorder/${siteId}/delete?${search.toString()}`;
}

function buildWorkOrderExportEndpoint(siteId) {
  return `/zsqy/qsworkorder/${siteId}/export`;
}

async function mutateWorkOrder(baseUrl, endpoint, method, body) {
  const response = await requestLegacy(baseUrl, endpoint, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body || {})
  });
  const payloadOk = isLegacyPayloadOk(response.payload);
  return {
    ok: response.ok && payloadOk,
    status: response.status ?? null,
    endpoint,
    message: extractMessage(response.payload, response.ok ? "OK" : null),
    error:
      response.ok && payloadOk
        ? null
        : response.error || extractMessage(response.payload, "Legacy request failed")
  };
}

export async function loadWorkOrders(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const id = toNullableFilter(options.id);
  const state = toNullableFilter(options.state);
  const startDate = toNullableFilter(options.startDate);
  const endDate = toNullableFilter(options.endDate);
  const endpoint = buildWorkOrderListEndpoint(siteId, {
    page,
    pageSize,
    id,
    state,
    startDate,
    endDate
  });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
  const payloadOk = response.ok && isLegacyPayloadOk(payload);
  const recordsRaw = payloadOk
    ? Array.isArray(payload?.data?.records)
      ? payload.data.records
      : payload?.data?.records
        ? [payload.data.records]
        : []
    : [];
  const totalRaw = payload?.data?.rowCount ?? recordsRaw.length;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : recordsRaw.length;

  return {
    items: recordsRaw.map(normalizeWorkOrder),
    total,
    page,
    pageSize,
    latestTimestamp: fetchedAt,
    filters: {
      id,
      state,
      startDate,
      endDate
    },
    sourceStatus: {
      endpoint,
      ok: payloadOk,
      status: response.status ?? null,
      message: extractMessage(payload, payloadOk ? "OK" : null),
      rows: payloadOk ? recordsRaw.length : null,
      error: payloadOk ? null : response.error || extractMessage(payload, "Legacy request failed")
    }
  };
}

export async function loadWorkOrderAssignees(baseUrl, siteId) {
  const endpoint = buildWorkOrderAssigneeEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
  const payloadOk = response.ok && isLegacyPayloadOk(payload);
  const rows = payloadOk
    ? Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : []
    : [];

  return {
    items: rows.map(normalizeAssignee),
    sourceStatus: {
      endpoint,
      ok: payloadOk,
      status: response.status ?? null,
      message: extractMessage(payload, payloadOk ? "OK" : null),
      rows: payloadOk ? rows.length : null,
      error: payloadOk ? null : response.error || extractMessage(payload, "Legacy request failed")
    }
  };
}

export async function createWorkOrder(baseUrl, siteId, body) {
  return mutateWorkOrder(baseUrl, buildWorkOrderSaveEndpoint(siteId), "POST", body);
}

export async function updateWorkOrder(baseUrl, siteId, body) {
  return mutateWorkOrder(baseUrl, buildWorkOrderUpdateEndpoint(siteId), "PUT", body);
}

export async function deleteWorkOrder(baseUrl, siteId, orderId) {
  const endpoint = buildWorkOrderDeleteEndpoint(siteId, asTrimmedString(orderId, ""));
  const response = await requestLegacy(baseUrl, endpoint, {
    method: "DELETE"
  });
  const payloadOk = isLegacyPayloadOk(response.payload);
  return {
    ok: response.ok && payloadOk,
    status: response.status ?? null,
    endpoint,
    message: extractMessage(response.payload, response.ok ? "OK" : null),
    error:
      response.ok && payloadOk
        ? null
        : response.error || extractMessage(response.payload, "Legacy request failed")
  };
}

export async function loadWorkOrderExport(baseUrl, siteId) {
  const endpoint = buildWorkOrderExportEndpoint(siteId);
  const response = await fetchLegacyBinary(baseUrl, endpoint);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status ?? null,
      endpoint,
      filename: null,
      contentType: response.headers?.contentType || "application/octet-stream",
      data: null,
      error: response.error || "Legacy export failed"
    };
  }

  return {
    ok: true,
    status: response.status ?? null,
    endpoint,
    filename: parseFilename(response.headers?.contentDisposition, `work-order-${siteId}.xls`),
    contentType: response.headers?.contentType || "application/octet-stream",
    data: response.data,
    error: null
  };
}

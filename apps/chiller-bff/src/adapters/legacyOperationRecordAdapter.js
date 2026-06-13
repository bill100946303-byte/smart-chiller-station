import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";
import {
  buildRuntimeDeviceOptions,
  buildRuntimeDeviceTypeNodes,
  isLegacyResponseUsable,
  loadRuntimeReportCatalog
} from "./runtimeReportCatalogAdapter.js";

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

function resolveOperationRecordModelKey(siteId, options = {}) {
  const runtimeSourceConfig =
    options?.runtimeConfig && typeof options.runtimeConfig === "object"
      ? options.runtimeConfig.siteSourceConfig
      : null;
  return (
    asTrimmedString(options.modelKey, "")
    || asTrimmedString(runtimeSourceConfig?.modelKey, "")
    || asTrimmedString(runtimeSourceConfig?.preferredProjectKey, "")
    || asTrimmedString(runtimeSourceConfig?.deviceDataProjectKey, "")
    || asTrimmedString(runtimeSourceConfig?.databaseKey, "")
    || asTrimmedString(siteId, "")
  );
}

function resolveOperationRecordTemplate(options = {}) {
  const runtimeSourceConfig =
    options?.runtimeConfig && typeof options.runtimeConfig === "object"
      ? options.runtimeConfig.siteSourceConfig
      : null;
  return (
    asTrimmedString(options.template, "")
    || asTrimmedString(runtimeSourceConfig?.template, "")
    || "1"
  );
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
  if (options.language) {
    search.set("language", options.language);
  }
  if (options.unit) {
    search.set("unit", options.unit);
  }
  if (options.modelKey) {
    search.set("modelKey", options.modelKey);
  }
  if (options.template) {
    search.set("template", options.template);
  }
  return `/zsqy/runrecords/${siteId}/findAll?${search.toString()}`;
}

function appendLegacyCommonParams(search, options = {}) {
  if (options.language) {
    search.set("language", options.language);
  }
  if (options.unit) {
    search.set("unit", options.unit);
  }
  if (options.modelKey) {
    search.set("modelKey", options.modelKey);
  }
  if (options.template) {
    search.set("template", options.template);
  }
}

function buildDeviceTypeEndpoint(siteId, options = {}) {
  const search = new URLSearchParams();
  appendLegacyCommonParams(search, options);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return `/zsqy/Drtypeinfo/${siteId}/findAllDrtypeOfDevice${suffix}`;
}

function buildDeviceOptionEndpoint(siteId, drTypeId, options = {}) {
  const search = new URLSearchParams();
  search.set("drtypeid", String(drTypeId));
  appendLegacyCommonParams(search, options);
  return `/zsqy/drinfo/${siteId}/findAll?${search.toString()}`;
}

export async function loadOperationRecords(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const drTypeId = toNullableFilterId(options.drTypeId);
  const drId = toNullableFilterId(options.drId);
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = resolveOperationRecordModelKey(siteId, options);
  const template = resolveOperationRecordTemplate(options);
  const endpoint = buildOperationRecordEndpoint(siteId, {
    page,
    pageSize,
    startDate,
    endDate,
    drTypeId,
    drId,
    language,
    unit,
    modelKey,
    template
  });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = isLegacyResponseUsable(response);
  const payload = usable && response.payload && typeof response.payload === "object" ? response.payload : null;
  const records = usable
    ? deepArrayProbe({
      data:
          payload?.data?.records
          ?? payload?.records
          ?? payload?.data
          ?? payload
    }).filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
  const totalRaw = usable ? payload?.data?.rowCount ?? payload?.rowCount ?? records.length : null;
  const total = usable && Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : records.length;

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
      ok: usable,
      status: response.status ?? null,
      message: usable ? extractMessage(response.payload, "OK") : null,
      rows: usable ? records.length : null,
      error: usable ? null : response.error || extractMessage(response.payload, "Legacy operation records unavailable")
    },
    sourceStatuses: [
      {
        endpoint,
        ok: usable,
        status: response.status ?? null,
        message: usable ? extractMessage(response.payload, "OK") : null,
        rows: usable ? records.length : null,
        error: usable ? null : response.error || extractMessage(response.payload, "Legacy operation records unavailable")
      }
    ]
  };
}

export async function loadOperationRecordDeviceTypes(baseUrl, siteId, options = {}) {
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = resolveOperationRecordModelKey(siteId, options);
  const template = resolveOperationRecordTemplate(options);
  const endpoint = buildDeviceTypeEndpoint(siteId, {
    language,
    unit,
    modelKey,
    template
  });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = isLegacyResponseUsable(response);
  const payload = usable && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = usable
    ? Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : []
    : [];
  const sourceStatus = {
    endpoint,
    ok: usable,
    status: response.status ?? null,
    message: usable ? extractMessage(response.payload, "OK") : null,
    rows: usable ? rows.length : null,
    error: usable ? null : response.error || extractMessage(response.payload, "Legacy device types unavailable")
  };

  if (usable) {
    return {
      items: rows.map((item, index) => normalizeTypeNode(item, index)),
      sourceStatus,
      sourceStatuses: [sourceStatus]
    };
  }

  const runtimeCatalog = await loadRuntimeReportCatalog(baseUrl, options.runtimeConfig || { siteSourceConfig: options.siteSourceConfig }, siteId);
  if (runtimeCatalog.sourceStatus.ok) {
    return {
      items: buildRuntimeDeviceTypeNodes(runtimeCatalog.items),
      sourceStatus: runtimeCatalog.sourceStatus,
      sourceStatuses: [sourceStatus, runtimeCatalog.sourceStatus]
    };
  }

  return {
    items: [],
    sourceStatus,
    sourceStatuses: [sourceStatus, runtimeCatalog.sourceStatus]
  };
}

export async function loadOperationRecordDevices(baseUrl, siteId, drTypeId, options = {}) {
  const normalizedTypeId = toNullableFilterId(drTypeId) || "0";
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = resolveOperationRecordModelKey(siteId, options);
  const template = resolveOperationRecordTemplate(options);
  const endpoint = buildDeviceOptionEndpoint(siteId, normalizedTypeId, {
    language,
    unit,
    modelKey,
    template
  });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = isLegacyResponseUsable(response);
  const payload = usable && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = usable
    ? Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : []
    : [];
  const sourceStatus = {
    endpoint,
    ok: usable,
    status: response.status ?? null,
    message: usable ? extractMessage(response.payload, "OK") : null,
    rows: usable ? rows.length : null,
    error: usable ? null : response.error || extractMessage(response.payload, "Legacy device options unavailable")
  };

  if (usable) {
    return {
      drTypeId: normalizedTypeId,
      items: rows.map(normalizeDeviceOption),
      sourceStatus,
      sourceStatuses: [sourceStatus]
    };
  }

  const runtimeCatalog = await loadRuntimeReportCatalog(baseUrl, options.runtimeConfig || { siteSourceConfig: options.siteSourceConfig }, siteId);
  if (runtimeCatalog.sourceStatus.ok) {
    return {
      drTypeId: normalizedTypeId,
      items: buildRuntimeDeviceOptions(runtimeCatalog.items, normalizedTypeId),
      sourceStatus: runtimeCatalog.sourceStatus,
      sourceStatuses: [sourceStatus, runtimeCatalog.sourceStatus]
    };
  }

  return {
    drTypeId: normalizedTypeId,
    items: [],
    sourceStatus,
    sourceStatuses: [sourceStatus, runtimeCatalog.sourceStatus]
  };
}

import http from "node:http";
import https from "node:https";

import { fetchLegacyBinary, fetchLegacyJson, parsePayloadText, requestLegacy } from "../lib/http.js";
import { shouldUseB25CloudHistory } from "./b25CloudHistoryAdapter.js";
import {
  buildRuntimeRegOptions,
  findRuntimeCatalogDevice,
  isLegacyResponseUsable,
  loadRuntimeReportCatalog
} from "./runtimeReportCatalogAdapter.js";

const LOCAL_TIMEZONE_OFFSET = "+08:00";
const PINNED_LEGACY_HOSTS = {
  "www.ssge.com.cn": "198.18.0.5"
};

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

function toArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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

const DETAILED_REPORT_SUMMARY_COLUMNS = [
  "\u5bf9\u8c61",
  "\u603b\u503c",
  "\u5cf0\u503c",
  "\u5cf0\u503c\u51fa\u73b0\u65f6\u95f4",
  "\u8c37\u503c",
  "\u8c37\u503c\u51fa\u73b0\u65f6\u95f4",
  "\u5e73\u5747\u503c"
];

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
    id: asTrimmedString(item?.regId || item?.typemodeid || item?.id || `reg-${index + 1}`),
    label: asTrimmedString(item?.regNameCNEN || item?.regName || item?.name || `reg-${index + 1}`)
  };
}

function normalizeRegOptionRows(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data.filter(isPlainObject);
  }
  if (isPlainObject(payload?.data)) {
    const nestedRows = getFirstArray(payload.data.list, payload.data.rows, payload.data.items, payload.data.data);
    return nestedRows.length > 0 ? nestedRows.filter(isPlainObject) : [payload.data];
  }
  if (Array.isArray(payload)) {
    return payload.filter(isPlainObject);
  }
  return [];
}

function buildCsvData(columns, rows) {
  const normalizedColumns = Array.isArray(columns) && columns.length > 0 ? columns : collectColumns(rows);
  const escape = (value) => {
    if (value == null) {
      return "";
    }
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [];
  if (normalizedColumns.length > 0) {
    lines.push(normalizedColumns.map(escape).join(","));
  }
  rows.forEach((row) => {
    lines.push(normalizedColumns.map((column) => escape(row?.[column])).join(","));
  });

  return new TextEncoder().encode(`\uFEFF${lines.join("\r\n")}`);
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
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, siteId));
  search.set("template", asTrimmedString(options.template, "1"));
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

function normalizeDateInput(value, fallback = null) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }
  return fallback || formatDateTime(new Date(), "start").slice(0, 10);
}

function toLegacyNumericValue(value, fallback = 0) {
  const normalized = asTrimmedString(value, "");
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

function normalizeReportDateType(value) {
  const normalized = asTrimmedString(value, "4");
  return ["1", "2", "3", "4"].includes(normalized) ? normalized : "4";
}

function resolveReportRecordModelKey(siteId, options = {}) {
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

function resolveReportRecordTemplate(options = {}) {
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

function buildDetailedReportCurveEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, siteId));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/reportmanage/${siteId}/getDetailedReportCurve?${search.toString()}`;
}

function normalizeDrRegList(options = {}) {
  const fromPayload = Array.isArray(options.drRegList)
    ? options.drRegList
        .map((item) => {
          const drId = toLegacyNumericValue(item?.drId, null);
          const regIds = Array.isArray(item?.regIds)
            ? item.regIds.map((regId) => toLegacyNumericValue(regId, null)).filter((regId) => regId !== null && regId !== "")
            : [];
          return drId === null || regIds.length === 0 ? null : { drId, regIds };
        })
        .filter(Boolean)
    : [];

  if (fromPayload.length > 0) {
    return fromPayload;
  }

  const drId = toLegacyNumericValue(options.drId, null);
  const regIds = Array.isArray(options.regIds)
    ? options.regIds.map((regId) => toLegacyNumericValue(regId, null)).filter((regId) => regId !== null && regId !== "")
    : [];
  return drId === null || regIds.length === 0 ? [] : [{ drId, regIds }];
}

function buildDetailedReportCurvePayload(options) {
  const startDate = normalizeDateInput(options.startTime, normalizeDateInput(options.startDate));
  const endDate = normalizeDateInput(options.endTime, normalizeDateInput(options.endDate, startDate));
  return {
    time: `${startDate},${endDate}`,
    drTypeId: toLegacyNumericValue(options.drTypeId, 0),
    drId: toLegacyNumericValue(options.drId, 0),
    dateType: toLegacyNumericValue(normalizeReportDateType(options.dateType), 4),
    startTime: startDate,
    endTime: endDate,
    drRegList: normalizeDrRegList(options)
  };
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

function addDays(dateText, days) {
  const baseMs = Date.parse(`${dateText}T00:00:00${LOCAL_TIMEZONE_OFFSET}`);
  if (!Number.isFinite(baseMs)) {
    return dateText;
  }
  const shifted = new Date(baseMs + days * 86_400_000);
  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  return `${year}-${month}-${day}`;
}

function buildDateTextList(startTime, endTime) {
  const startDateText = startTime.slice(0, 10);
  const endDateText = endTime.slice(0, 10);
  const dates = [];
  let current = startDateText;

  for (let index = 0; index < 400 && current <= endDateText; index += 1) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

function parseLocalDateTime(value, kind = "start") {
  const normalized = normalizeDateTimeInput(value, kind);
  return new Date(`${normalized.replace(" ", "T")}${LOCAL_TIMEZONE_OFFSET}`);
}

function parseClockFromHistoryName(value) {
  const normalized = asTrimmedString(value);
  const match = normalized.match(/(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : null;
}

function buildHistoryTimestamp(dateText, clockText) {
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
  const parsed = new Date(`${dateText}T${hour}:${minute}:${second}${LOCAL_TIMEZONE_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseHistoryPoints(payload, dateText) {
  const rows = toArray(
    payload?.data?.curveValueList?.curveValueList
    ?? payload?.data?.curveValueList
    ?? payload?.curveValueList?.curveValueList
    ?? payload?.curveValueList
  );
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const clockText = parseClockFromHistoryName(row.name);
      const ts = buildHistoryTimestamp(dateText, clockText);
      if (!ts) {
        return null;
      }
      const rawValue = asTrimmedString(row.value, "");
      const parsedValue = rawValue === "" ? null : Number(rawValue);
      return {
        ts,
        value: Number.isFinite(parsedValue) ? parsedValue : rawValue || null
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
}

function buildReportHistoryEndpoint(projectKey, dateText, drId, regId) {
  const search = new URLSearchParams();
  search.set("dateType", "1");
  search.set("drId", String(drId));
  search.set("date", dateText);
  search.set("regId", String(regId));
  return `/zsqy/reg/${projectKey}/findRegHistoryByDrid?${search.toString()}`;
}

function normalizeLegacyUrl(baseUrl, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function fetchLegacyJsonWithPinnedHost(baseUrl, path) {
  const url = normalizeLegacyUrl(baseUrl, path);
  const parsedUrl = new URL(url);
  const pinnedHost = PINNED_LEGACY_HOSTS[parsedUrl.hostname];
  if (!pinnedHost) {
    return {
      ok: false,
      status: null,
      url,
      error: "Pinned legacy host is unavailable",
      payload: null
    };
  }

  const requestClient = parsedUrl.protocol === "https:" ? https : http;

  return await new Promise((resolve) => {
    const req = requestClient.request(
      {
        protocol: parsedUrl.protocol,
        hostname: pinnedHost,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        servername: parsedUrl.hostname,
        headers: {
          Host: parsedUrl.host
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          const text = chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : "";
          let payload = null;
          try {
            payload = text ? parsePayloadText(text) : null;
          } catch (error) {
            resolve({
              ok: false,
              status: res.statusCode ?? null,
              url,
              error: `Invalid pinned-host payload: ${String(error)}`,
              payload: null
            });
            return;
          }
          const ok = typeof res.statusCode === "number" && res.statusCode >= 200 && res.statusCode < 300;
          resolve({
            ok,
            status: res.statusCode ?? null,
            url,
            error: ok ? null : `Pinned legacy request failed: ${res.statusCode ?? "unknown"}`,
            payload
          });
        });
      }
    );

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: null,
        url,
        error: `Pinned legacy request error: ${String(error)}`,
        payload: null
      });
    });

    req.end();
  });
}

function formatLocalHistoryLabel(timestamp) {
  const parsed = Date.parse(String(timestamp || ""));
  if (!Number.isFinite(parsed)) {
    return asTrimmedString(timestamp);
  }
  const shifted = new Date(parsed + 8 * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
}

function buildColumnLabels(regOptions) {
  const seen = new Set();
  return regOptions.map((item) => {
    const baseLabel = asTrimmedString(item?.label || item?.id || "测点");
    let label = baseLabel;
    if (seen.has(label)) {
      label = `${baseLabel} (${asTrimmedString(item?.id, "reg")})`;
    }
    seen.add(label);
    return {
      ...item,
      columnLabel: label
    };
  });
}

async function loadCloudReportHistory(baseUrl, siteId, options = {}) {
  const runtimeConfig = options.runtimeConfig || { siteSourceConfig: options.siteSourceConfig };
  if (!shouldUseB25CloudHistory(runtimeConfig, siteId)) {
    return null;
  }

  const runtimeCatalog = await loadRuntimeReportCatalog(baseUrl, runtimeConfig, siteId);
  if (!runtimeCatalog.sourceStatus.ok) {
    return {
      runtimeCatalog,
      sourceStatus: {
        endpoint: runtimeCatalog.sourceStatus.endpoint || "",
        ok: false,
        status: runtimeCatalog.sourceStatus.status ?? null,
        message: null,
        rows: null,
        error: runtimeCatalog.sourceStatus.error || "B25 runtime device collection unavailable",
        fallback: true,
        reasonCode: "b25-runtime-catalog-unavailable",
        interfaceKind: "cloud-reg-history",
        originLabel: "B25云端历史"
      }
    };
  }

  const device = findRuntimeCatalogDevice(runtimeCatalog.items, options.drId, options.drTypeId);
  if (!device) {
    return {
      runtimeCatalog,
      sourceStatus: {
        endpoint: runtimeCatalog.sourceStatus.endpoint || "",
        ok: false,
        status: runtimeCatalog.sourceStatus.status ?? null,
        message: null,
        rows: null,
        error: "B25 runtime device not found for report-record fallback",
        fallback: true,
        reasonCode: "b25-runtime-device-missing",
        interfaceKind: "cloud-reg-history",
        originLabel: "B25云端历史"
      }
    };
  }

  const requestedRegIds = Array.isArray(options.regIds)
    ? options.regIds.map((item) => asTrimmedString(item, "")).filter(Boolean)
    : [];
  const fallbackRegOptions = requestedRegIds.length > 0
    ? buildRuntimeRegOptions(runtimeCatalog.items, options.drTypeId, options.drId)
        .filter((item) => requestedRegIds.includes(asTrimmedString(item?.id)))
    : buildRuntimeRegOptions(runtimeCatalog.items, options.drTypeId, options.drId);
  const regOptions = buildColumnLabels(
    fallbackRegOptions.length > 0
      ? fallbackRegOptions
      : requestedRegIds.map((id) => ({ id, label: id }))
  );

  if (regOptions.length === 0) {
    return {
      runtimeCatalog,
      sourceStatus: {
        endpoint: runtimeCatalog.sourceStatus.endpoint || "",
        ok: false,
        status: runtimeCatalog.sourceStatus.status ?? null,
        message: null,
        rows: null,
        error: "B25 runtime device has no reportable points",
        fallback: true,
        reasonCode: "b25-runtime-reg-missing",
        interfaceKind: "cloud-reg-history",
        originLabel: "B25云端历史"
      }
    };
  }

  const startMs = parseLocalDateTime(options.startTime, "start").getTime();
  const endMs = parseLocalDateTime(options.endTime, "end").getTime();
  const dates = buildDateTextList(options.startTime, options.endTime);
  const projectKey =
    asTrimmedString(runtimeConfig?.siteSourceConfig?.databaseKey)
    || asTrimmedString(runtimeConfig?.siteSourceConfig?.deviceDataProjectKey)
    || "140btwentyfive";

  const regResults = await Promise.all(
    regOptions.map(async (regOption) => {
      const dayResults = await Promise.all(
        dates.map(async (dateText) => {
          const endpoint = buildReportHistoryEndpoint(projectKey, dateText, options.drId, regOption.id);
          const directResponse = await fetchLegacyJson(baseUrl, endpoint);
          const shouldRetryWithPinnedHost =
            directResponse.ok !== true
            && /fetch failed/i.test(asTrimmedString(directResponse.error, ""));
          const response = shouldRetryWithPinnedHost
            ? await fetchLegacyJsonWithPinnedHost(baseUrl, endpoint)
            : directResponse;
          const usable = isLegacyResponseUsable(response);
          const points = usable ? parseHistoryPoints(response.payload, dateText) : [];
          return {
            endpoint,
            response,
            usable,
            points
          };
        })
      );

      return {
        regOption,
        dayResults,
        points: dayResults
          .flatMap((item) => item.points)
          .filter((point) => {
            const pointMs = Date.parse(point.ts);
            return Number.isFinite(pointMs) && pointMs >= startMs && pointMs <= endMs;
          })
      };
    })
  );

  const rowMap = new Map();
  regResults.forEach((result) => {
    result.points.forEach((point) => {
      const row = rowMap.get(point.ts) || {
        时间: formatLocalHistoryLabel(point.ts)
      };
      row[result.regOption.columnLabel] = point.value;
      rowMap.set(point.ts, row);
    });
  });

  const sortedEntries = Array.from(rowMap.entries()).sort(
    (left, right) => Date.parse(left[0]) - Date.parse(right[0])
  );
  const rows = sortedEntries.map(([, row]) => row);
  const latestTimestamp = sortedEntries.length > 0 ? sortedEntries.at(-1)[0] : null;
  const successCount = regResults.filter((item) => item.points.length > 0).length;
  const firstFailedDay = regResults
    .flatMap((item) => item.dayResults)
    .find((item) => !item.usable);
  const sourceStatus = {
    endpoint: `/zsqy/reg/${projectKey}/findRegHistoryByDrid`,
    ok: rows.length > 0,
    status: rows.length > 0 ? 200 : firstFailedDay?.response?.status ?? null,
    message: rows.length > 0
      ? `${device.label}; points=${regOptions.length}; rows=${rows.length}; regsOk=${successCount}/${regOptions.length}`
      : null,
    rows: rows.length,
    error: rows.length > 0
      ? null
      : firstFailedDay?.response?.error || "B25 cloud history report fallback unavailable",
    fallback: true,
    reasonCode: "b25-cloud-history-report-fallback",
    interfaceKind: "cloud-reg-history",
    originLabel: "B25云端历史"
  };

  return {
    runtimeCatalog,
    regOptions,
    rows,
    latestTimestamp,
    sourceStatus
  };
}

function buildExportFilename(siteId, startTime, endTime, extension) {
  const startDateText = startTime.slice(0, 10);
  const endDateText = endTime.slice(0, 10);
  return `report-record-${asTrimmedString(siteId, "site")}-${startDateText}-${endDateText}.${extension}`;
}

function buildMissingRegSelectionSourceStatus(siteId, runtimeConfig) {
  const projectKey =
    asTrimmedString(runtimeConfig?.siteSourceConfig?.databaseKey)
    || asTrimmedString(runtimeConfig?.siteSourceConfig?.deviceDataProjectKey)
    || asTrimmedString(siteId, "140btwentyfive");
  return {
    endpoint: `/zsqy/reg/${projectKey}/findRegHistoryByDrid`,
    ok: false,
    status: 200,
    message: null,
    rows: 0,
    error: "B25 cloud history requires explicit regIds for report-record queries",
    fallback: true,
    reasonCode: "b25-cloud-history-regids-required",
    interfaceKind: "cloud-reg-history",
    originLabel: "B25云端历史"
  };
}

function buildCloudHistoryReportResult(siteId, options, fetchedAt, cloudHistory, sourceStatuses = [cloudHistory?.sourceStatus]) {
  const fullRows = Array.isArray(cloudHistory?.rows) ? cloudHistory.rows.map(normalizeRow) : [];
  const page = toPositiveInteger(options?.page, 1);
  const pageSize = toPositiveInteger(options?.pageSize, 10);
  const offset = (page - 1) * pageSize;
  const pagedRows = fullRows.slice(offset, offset + pageSize);
  const regOptions = Array.isArray(cloudHistory?.regOptions) ? cloudHistory.regOptions : [];

  return {
    filters: {
      startTime: options.startTime,
      endTime: options.endTime,
      drTypeId: options.drTypeId,
      drId: options.drId,
      regIds: options.regIds.length > 0 ? options.regIds : regOptions.map((item) => item.id)
    },
    columns: ["时间", ...regOptions.map((item) => item.columnLabel)],
    items: pagedRows,
    total: fullRows.length,
    page,
    pageSize,
    filenamePrefix: buildExportFilename(siteId, options.startTime, options.endTime, "csv").replace(/\.csv$/i, ""),
    latestTimestamp: cloudHistory?.latestTimestamp || fetchedAt,
    sourceStatus: cloudHistory?.sourceStatus || null,
    sourceStatuses: sourceStatuses.filter(Boolean)
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getFirstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function pickLabel(node, fallback = "") {
  if (!isPlainObject(node)) {
    return fallback;
  }
  return asTrimmedString(
    node.objName
      ?? node.regNameCNEN
      ?? node.regName
      ?? node.drNameCNEN
      ?? node.drnameCNEN
      ?? node.drName
      ?? node.drname
      ?? node.tagNameDescribe
      ?? node.tagName
      ?? node.name
      ?? node.label
      ?? node.title,
    fallback
  );
}

function pickPointTime(point, fallback = "") {
  if (!isPlainObject(point)) {
    return fallback;
  }
  return asTrimmedString(
    point.time
      ?? point.date
      ?? point.datetime
      ?? point.collectTime
      ?? point.createTime
      ?? point.name
      ?? point.label
      ?? point.x,
    fallback
  );
}

function pickPointValue(point) {
  if (!isPlainObject(point)) {
    return point;
  }
  return (
    point.value
    ?? point.tagValue
    ?? point.y
    ?? point.data
    ?? point.val
    ?? point.result
    ?? null
  );
}

function getNestedCurveValueArray(node) {
  if (!isPlainObject(node)) {
    return null;
  }
  const candidates = [
    node.curveValueList,
    node.valueList,
    node.values,
    node.points,
    node.dataList,
    node.curveValueList?.curveValueList,
    node.data?.curveValueList,
    node.runParamsCurveVO?.curveValueList,
    node.runParamsCurveVO?.valueList,
    node.runParamsCurveVO?.values,
    node.runParamsCurveVO?.points,
    node.runParamsCurveVO?.dataList,
    node.runParamsCurveVO?.curveValueList?.curveValueList,
    node.runParamsCurveVO?.data?.curveValueList
  ];
  return candidates.find((candidate) => Array.isArray(candidate)) || null;
}

function hasDetailedCurveSeries(node) {
  if (!isPlainObject(node)) {
    return false;
  }
  return Boolean(getNestedCurveValueArray(node));
}

function findTimeLabels(node, depth = 0) {
  if (depth > 8 || node == null) {
    return [];
  }
  if (Array.isArray(node)) {
    if (node.every((item) => typeof item === "string" || typeof item === "number")) {
      return node.map((item) => String(item));
    }
    for (const item of node) {
      const found = findTimeLabels(item, depth + 1);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }
  if (!isPlainObject(node)) {
    return [];
  }
  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.toLowerCase();
    if (
      Array.isArray(value)
      && /(time|date|axis|category|xlist|xaxis)/i.test(normalizedKey)
      && value.every((item) => typeof item === "string" || typeof item === "number")
    ) {
      return value.map((item) => String(item));
    }
  }
  for (const value of Object.values(node)) {
    const found = findTimeLabels(value, depth + 1);
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

function findTableRows(payload) {
  const candidates = [
    payload?.data?.records,
    payload?.data?.rows,
    payload?.data?.list,
    payload?.data?.items,
    payload?.records,
    payload?.rows,
    payload?.list,
    payload?.items,
    payload?.data
  ];
  const rows = candidates.find(
    (candidate) =>
      Array.isArray(candidate)
      && candidate.some((item) => isPlainObject(item))
      && !candidate.some((item) => hasDetailedCurveSeries(item))
  );
  return Array.isArray(rows) ? rows.map(normalizeRow) : [];
}

function collectDetailedSeries(node, timeLabels, parentLabels = [], depth = 0) {
  if (depth > 8 || node == null) {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectDetailedSeries(item, timeLabels, parentLabels, depth + 1));
  }
  if (!isPlainObject(node)) {
    return [];
  }

  const ownLabel = pickLabel(node, "");
  const nextLabels = ownLabel ? [...parentLabels, ownLabel] : parentLabels;
  const valueArrays = [
    getNestedCurveValueArray(node),
    node.pointList,
    node.data
  ].filter(Array.isArray);

  for (const valueArray of valueArrays) {
    if (valueArray.length === 0) {
      continue;
    }
    const hasPrimitivePoints = valueArray.every(
      (item) => item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    );
    const hasObjectPoints = valueArray.some((item) => isPlainObject(item) && pickPointValue(item) != null);
    if (!hasPrimitivePoints && !hasObjectPoints) {
      continue;
    }
    const label = nextLabels.slice(-2).join("-") || `series-${depth + 1}`;
    const points = valueArray.map((point, index) => ({
      time: hasPrimitivePoints ? (timeLabels[index] || String(index + 1)) : pickPointTime(point, timeLabels[index] || String(index + 1)),
      value: hasPrimitivePoints ? point : pickPointValue(point)
    }));
    return [{ label, points }];
  }

  return Object.entries(node)
    .filter(([key]) => !["values", "valueList", "dataList", "curveValueList", "pointList", "points"].includes(key))
    .flatMap(([, value]) => collectDetailedSeries(value, timeLabels, nextLabels, depth + 1));
}

function pivotDetailedSeries(series) {
  const rowMap = new Map();
  for (const item of series) {
    const label = asTrimmedString(item.label, "value");
    for (const point of item.points || []) {
      const time = asTrimmedString(point?.time, "");
      if (!time) {
        continue;
      }
      const row = rowMap.get(time) || { "\u65f6\u95f4": time };
      row[label] = normalizeCellValue(point.value);
      rowMap.set(time, row);
    }
  }
  return Array.from(rowMap.entries())
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    .map(([, row]) => row);
}

function normalizeDetailedReportRows(payload) {
  const tableRows = findTableRows(payload);
  if (tableRows.length > 0) {
    return tableRows;
  }
  const timeLabels = findTimeLabels(payload);
  const series = collectDetailedSeries(payload, timeLabels);
  return series.length > 0 ? pivotDetailedSeries(series) : [];
}

function toChartNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDetailedReportDataRows(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data.filter(isPlainObject);
  }
  if (Array.isArray(payload?.data?.data)) {
    return payload.data.data.filter(isPlainObject);
  }
  if (isPlainObject(payload?.data)) {
    return [payload.data];
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows.filter(isPlainObject);
  }
  if (Array.isArray(payload?.items)) {
    return payload.items.filter(isPlainObject);
  }
  return [];
}

function getDetailedReportSummaryUnit(row) {
  return asTrimmedString(
    row?.runParamsCurveVO?.unit
      ?? row?.unit
      ?? row?.unitName
      ?? row?.unitText,
    ""
  );
}

function appendSummaryUnit(value, unit) {
  const normalized = normalizeCellValue(value);
  const suffix = asTrimmedString(unit, "");
  if (normalized == null || normalized === "" || !suffix) {
    return normalized;
  }
  const text = String(normalized).trim();
  if (!text || text.toLowerCase().endsWith(suffix.toLowerCase())) {
    return text;
  }
  return `${text} ${suffix}`;
}

function normalizeDetailedReportSummaryRow(row) {
  const unit = getDetailedReportSummaryUnit(row);
  return {
    [DETAILED_REPORT_SUMMARY_COLUMNS[0]]: normalizeCellValue(row?.objName),
    [DETAILED_REPORT_SUMMARY_COLUMNS[1]]: appendSummaryUnit(row?.sumValue, unit),
    [DETAILED_REPORT_SUMMARY_COLUMNS[2]]: appendSummaryUnit(row?.maxValue, unit),
    [DETAILED_REPORT_SUMMARY_COLUMNS[3]]: normalizeCellValue(row?.maxTime),
    [DETAILED_REPORT_SUMMARY_COLUMNS[4]]: appendSummaryUnit(row?.minValue, unit),
    [DETAILED_REPORT_SUMMARY_COLUMNS[5]]: normalizeCellValue(row?.minTime),
    [DETAILED_REPORT_SUMMARY_COLUMNS[6]]: appendSummaryUnit(row?.average, unit)
  };
}

function normalizeDetailedReportSummaryRows(dataRows) {
  return dataRows.map(normalizeDetailedReportSummaryRow).filter((row) => asTrimmedString(row[DETAILED_REPORT_SUMMARY_COLUMNS[0]], ""));
}

function buildDetailedReportChartFromDataRows(dataRows) {
  const rawSeries = dataRows
    .map((row, index) => {
      const curveRows = getNestedCurveValueArray(row);
      if (!Array.isArray(curveRows) || curveRows.length === 0) {
        return null;
      }
      const points = curveRows
        .map((point, pointIndex) => ({
          label:
            point == null || typeof point === "string" || typeof point === "number" || typeof point === "boolean"
              ? String(pointIndex + 1)
              : pickPointTime(point, String(pointIndex + 1)),
          value:
            point == null || typeof point === "string" || typeof point === "number" || typeof point === "boolean"
              ? toChartNumber(point)
              : toChartNumber(pickPointValue(point))
        }))
        .filter((point) => asTrimmedString(point.label, "") && point.value !== null);
      if (points.length === 0) {
        return null;
      }
      return {
        name: pickLabel(row, `series-${index + 1}`),
        points
      };
    })
    .filter(Boolean);

  const labels = [];
  const seenLabels = new Set();
  rawSeries.forEach((item) => {
    item.points.forEach((point) => {
      if (!seenLabels.has(point.label)) {
        seenLabels.add(point.label);
        labels.push(point.label);
      }
    });
  });

  const series = rawSeries.map((item) => {
    const valueByLabel = new Map(item.points.map((point) => [point.label, point.value]));
    return {
      name: item.name,
      values: labels.map((label) => valueByLabel.get(label) ?? null)
    };
  });

  return {
    labels,
    series
  };
}

function buildDetailedReportChart(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      labels: [],
      series: []
    };
  }
  const columns = collectColumns(rows);
  const timeColumn = columns.find((column) => /^(时间|time|date|datetime)$/i.test(String(column))) || columns[0] || "时间";
  const labels = rows.map((row, index) => asTrimmedString(row?.[timeColumn], String(index + 1)));
  const series = columns
    .filter((column) => column !== timeColumn)
    .map((column) => ({
      name: column,
      values: rows.map((row) => toChartNumber(row?.[column]))
    }))
    .filter((item) => item.values.some((value) => typeof value === "number"));

  return {
    labels,
    series
  };
}

export async function loadReportRecordRegOptions(baseUrl, siteId, options = {}) {
  const drTypeId = toNullableFilterId(options.drTypeId) || "0";
  const drId = toNullableFilterId(options.drId) || "0";
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = resolveReportRecordModelKey(siteId, options);
  const template = resolveReportRecordTemplate(options);
  const endpoint = buildRegOptionEndpoint(siteId, {
    drTypeId,
    drId,
    language,
    unit,
    modelKey,
    template
  });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = isLegacyResponseUsable(response);
  const payload = usable && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = usable ? normalizeRegOptionRows(payload) : [];
  const legacySourceStatus = {
    endpoint,
    ok: usable,
    status: response.status ?? null,
    message: usable ? extractMessage(response.payload, "OK") : null,
    rows: usable ? rows.length : null,
    error: usable ? null : response.error || extractMessage(response.payload, "Legacy reg options unavailable")
  };

  if (usable) {
    return {
      drTypeId,
      drId,
      items: rows.map(normalizeRegOption),
      sourceStatus: legacySourceStatus,
      sourceStatuses: [legacySourceStatus]
    };
  }

  const runtimeCatalog = await loadRuntimeReportCatalog(baseUrl, options.runtimeConfig || { siteSourceConfig: options.siteSourceConfig }, siteId);
  if (runtimeCatalog.sourceStatus.ok) {
    return {
      drTypeId,
      drId,
      items: buildRuntimeRegOptions(runtimeCatalog.items, drTypeId, drId),
      sourceStatus: runtimeCatalog.sourceStatus,
      sourceStatuses: [legacySourceStatus, runtimeCatalog.sourceStatus]
    };
  }

  return {
    drTypeId,
    drId,
    items: [],
    sourceStatus: legacySourceStatus,
    sourceStatuses: [legacySourceStatus, runtimeCatalog.sourceStatus]
  };
}

export async function loadReportRecords(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const startTime = normalizeDateInput(options.startTime, normalizeDateInput(options.startDate));
  const endTime = normalizeDateInput(options.endTime, normalizeDateInput(options.endDate, startTime));
  const drTypeId = toNullableFilterId(options.drTypeId) || "0";
  const drId = toNullableFilterId(options.drId) || "0";
  const regIds = Array.isArray(options.regIds)
    ? options.regIds.map((item) => asTrimmedString(item, "")).filter(Boolean)
    : [];
  const dateType = normalizeReportDateType(options.dateType);
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = resolveReportRecordModelKey(siteId, options);
  const template = resolveReportRecordTemplate(options);
  const drRegList = normalizeDrRegList({
    drId,
    regIds,
    drRegList: options.drRegList
  });
  const requestPayload = buildDetailedReportCurvePayload({
    startTime,
    endTime,
    drTypeId,
    drId,
    dateType,
    drRegList
  });
  const endpoint = buildDetailedReportCurveEndpoint(siteId, {
    language,
    unit,
    modelKey,
    template
  });
  const fetchedAt = new Date().toISOString();
  const response = await requestLegacy(baseUrl, endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(requestPayload)
  });
  const usable = isLegacyResponseUsable(response);
  const payload = usable && response.payload && typeof response.payload === "object" ? response.payload : null;
  const dataRows = usable ? getDetailedReportDataRows(payload) : [];
  const summaryRows = normalizeDetailedReportSummaryRows(dataRows);
  const chartFromDataRows = usable ? buildDetailedReportChartFromDataRows(dataRows) : { labels: [], series: [] };
  const chart =
    chartFromDataRows.series.length > 0
      ? chartFromDataRows
      : usable
        ? buildDetailedReportChart(normalizeDetailedReportRows(payload))
        : { labels: [], series: [] };
  const total = summaryRows.length;
  const columns = usable && summaryRows.length > 0 ? DETAILED_REPORT_SUMMARY_COLUMNS : [];
  const legacySourceStatus = {
    endpoint,
    ok: usable,
    status: response.status ?? null,
    message: usable ? extractMessage(response.payload, "OK") : null,
    rows: usable ? summaryRows.length : null,
    error: usable ? null : response.error || extractMessage(response.payload, "Legacy detailed report curve unavailable"),
    interfaceKind: "legacy-reportmanage-detailed-curve",
    originLabel: "Legacy reportmanage getDetailedReportCurve"
  };

  return {
    filters: {
      startTime,
      endTime,
      drTypeId,
      drId,
      regIds,
      dateType,
      drRegList
    },
    columns,
    items: usable ? summaryRows : [],
    summaryColumns: columns,
    summaryItems: usable ? summaryRows : [],
    chart,
    total: usable ? total : 0,
    page,
    pageSize,
    filenamePrefix: asTrimmedString(payload?.data2, ""),
    latestTimestamp: fetchedAt,
    sourceStatus: legacySourceStatus,
    sourceStatuses: [legacySourceStatus]
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

  if (regIds.length === 0 && shouldUseB25CloudHistory(options.runtimeConfig, siteId)) {
    const records = await loadReportRecords(baseUrl, siteId, {
      ...options,
      startTime,
      endTime,
      drTypeId,
      drId,
      regIds,
      page: 1,
      pageSize: 1000000
    });
    if (records.sourceStatus?.ok) {
      return {
        ok: true,
        status: 200,
        endpoint: records.sourceStatus.endpoint || buildReportRecordExportEndpoint(siteId, {
          startTime,
          endTime,
          drTypeId,
          drId,
          regIds
        }),
        error: null,
        contentType: "text/csv; charset=utf-8",
        filename: buildExportFilename(siteId, startTime, endTime, "csv"),
        data: buildCsvData(records.columns, records.items)
      };
    }
    return {
      ok: false,
      status: records.sourceStatus?.status ?? 200,
      endpoint: records.sourceStatus?.endpoint || buildReportRecordExportEndpoint(siteId, {
        startTime,
        endTime,
        drTypeId,
        drId,
        regIds
      }),
      error: records.sourceStatus?.error || "B25 cloud history requires explicit regIds for report-record export",
      contentType: "application/octet-stream",
      filename: buildExportFilename(siteId, startTime, endTime, "csv"),
      data: null
    };
  }

  const endpoint = buildReportRecordExportEndpoint(siteId, {
    startTime,
    endTime,
    drTypeId,
    drId,
    regIds
  });
  const response = await fetchLegacyBinary(baseUrl, endpoint);

  if (response.ok) {
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

  const records = await loadReportRecords(baseUrl, siteId, {
    ...options,
    page: 1,
    pageSize: 1000000
  });
  if (records.sourceStatus?.ok) {
    return {
      ok: true,
      status: 200,
      endpoint: records.sourceStatus.endpoint || endpoint,
      error: null,
      contentType: "text/csv; charset=utf-8",
      filename: buildExportFilename(siteId, startTime, endTime, "csv"),
      data: buildCsvData(records.columns, records.items)
    };
  }

  return {
    ok: false,
    status: response.status ?? null,
    endpoint: records.sourceStatus?.endpoint || endpoint,
    error: response.error || records.sourceStatus?.error || "Legacy export failed",
    contentType: response.headers?.contentType || "application/octet-stream",
    filename: buildExportFilename(siteId, startTime, endTime, "csv"),
    data: null
  };
}

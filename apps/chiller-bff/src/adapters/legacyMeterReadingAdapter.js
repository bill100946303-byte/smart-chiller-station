import { deepArrayProbe, fetchLegacyBinary, fetchLegacyJson } from "../lib/http.js";
import { loadB25CloudColdStationLog, shouldUseB25CloudHistory } from "./b25CloudHistoryAdapter.js";

const LOCAL_TIMEZONE_OFFSET = "+08:00";
const CLOUD_HISTORY_ENDPOINT = "/zsqy/reg/140btwentyfive/findRegHistoryByDrid";

const CLOUD_COLUMN_DEFS = [
  ["时间", (row) => buildCloudDisplayTime(row)],
  ["冷站总电量(kWh)", (row) => row.systemPower],
  ["系统冷量(RT*h)", (row) => row.systemCoolingCapacity],
  ["系统能效(kW/RT)", (row) => row.systemEfficiency],
  ["主机电量(kWh)", (row) => row.hostPower],
  ["主机能效(kW/RT)", (row) => row.hostEfficiency],
  ["冷冻泵电量(kWh)", (row) => row.refrigeratingPumpPower],
  ["冷冻泵输送系数(RT*h/kWh)", (row) => row.refrigerationPumpConveyingCoefficient],
  ["冷却泵电量(kWh)", (row) => row.coolingPumpPower],
  ["冷却泵输送系数(RT*h/kWh)", (row) => row.coolingPumpConveyingCoefficient],
  ["冷却塔电量(kWh)", (row) => row.coolingTowerPower],
  ["冷却塔输送系数(RT*h/kWh)", (row) => row.coolingTowerConveyingCoefficient],
  ["冷冻回水温度(C)", (row) => row.chilledWaterInputTemperature],
  ["冷冻供水温度(C)", (row) => row.chilledWaterOutputTemperature],
  ["冷却回水温度(C)", (row) => row.coolingWaterInputTemperature],
  ["冷却供水温度(C)", (row) => row.coolingWaterOutputTemperature]
];

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

function formatDateText(date) {
  const shifted = new Date(date.getTime() + 8 * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function addDays(dateText, days) {
  const baseMs = Date.parse(`${dateText}T00:00:00${LOCAL_TIMEZONE_OFFSET}`);
  if (!Number.isFinite(baseMs)) {
    return dateText;
  }
  return formatDateText(new Date(baseMs + days * 86_400_000));
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

function buildMeterReadingEndpoint(identifier, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier)));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/reportmanage/${identifier}/findEnergyCoolingCapacity?${search.toString()}`;
}

function buildMeterReadingExportEndpoint(identifier, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier)));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/reportmanage/${identifier}/exportCoolingCapacity?${search.toString()}`;
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

function buildIdentifierCandidates(siteId, options = {}) {
  const candidates = [];
  if (Array.isArray(options.identifierCandidates)) {
    candidates.push(...options.identifierCandidates);
  }
  if (Array.isArray(options.appIdCandidates)) {
    candidates.push(...options.appIdCandidates);
  }
  if (typeof options.identifier === "string") {
    candidates.push(options.identifier);
  }
  if (typeof options.appId === "string") {
    candidates.push(options.appId);
  }
  candidates.push(siteId);
  return Array.from(new Set(candidates.map((item) => asTrimmedString(item)).filter(Boolean)));
}

function buildProbeSummary(attempts = []) {
  return attempts
    .map((attempt) => {
      if (attempt?.usable) {
        return `${attempt.identifier}:rows=${attempt.rows.length}`;
      }
      return `${attempt?.identifier || "unknown"}:failed`;
    })
    .join(",");
}

function extractLegacyRows(payload) {
  const directRows = Array.isArray(payload?.data?.records)
    ? payload.data.records
    : Array.isArray(payload?.records)
      ? payload.records
      : Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : Array.isArray(payload?.rows)
          ? payload.rows
          : null;

  const rowsRaw = Array.isArray(directRows)
    ? directRows
    : deepArrayProbe(payload).filter((item) => item && typeof item === "object" && !Array.isArray(item));

  return rowsRaw.map(normalizeRow);
}

async function probeLegacyMeterReadings(baseUrl, identifiers, options) {
  const attempts = [];
  let firstUsable = null;
  let firstUsableWithRows = null;

  for (const identifier of identifiers) {
    const endpoint = buildMeterReadingEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    const usable = isLegacyResponseUsable(response);
    const rows = usable ? extractLegacyRows(response.payload) : [];
    const attempt = {
      identifier,
      endpoint,
      response,
      usable,
      rows,
      columns: usable ? collectColumns(rows) : []
    };
    attempts.push(attempt);

    if (!firstUsable && usable) {
      firstUsable = attempt;
    }
    if (!firstUsableWithRows && usable && rows.length > 0) {
      firstUsableWithRows = attempt;
      break;
    }
  }

  return {
    attempts,
    selected: firstUsableWithRows || firstUsable || attempts[0] || null
  };
}

async function probeLegacyMeterReadingExport(baseUrl, identifiers, options) {
  const attempts = [];
  let selected = null;

  for (const identifier of identifiers) {
    const endpoint = buildMeterReadingExportEndpoint(identifier, options);
    const response = await fetchLegacyBinary(baseUrl, endpoint);
    const attempt = {
      identifier,
      endpoint,
      response,
      ok: response.ok
    };
    attempts.push(attempt);
    if (!selected && response.ok) {
      selected = attempt;
    }
  }

  return {
    attempts,
    selected: selected || attempts[0] || null
  };
}

function buildLegacyResult(selected, attempts, options) {
  const rows = selected?.usable ? selected.rows : [];
  const columns = selected?.usable ? selected.columns : [];
  const probeSummary = buildProbeSummary(attempts);
  const upstreamMessage = extractMessage(selected?.response?.payload);

  return {
    filters: {
      startTime: options.startTime,
      endTime: options.endTime,
      language: asTrimmedString(options.language, "zh"),
      unit: asTrimmedString(options.unit, "KW"),
      modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, "")),
      template: asTrimmedString(options.template, "1")
    },
    columns,
    items: rows,
    total: rows.length,
    latestTimestamp: new Date().toISOString(),
    sourceStatus: {
      endpoint: selected?.endpoint || "",
      ok: selected?.usable === true,
      status: selected?.response?.status ?? null,
      message:
        selected?.usable === true
          ? [upstreamMessage, `probe=${probeSummary}`, `rows=${rows.length}`].filter(Boolean).join("; ")
          : null,
      error:
        selected?.usable === true
          ? null
          : selected?.response?.error || upstreamMessage || "Legacy meter-reading request failed",
      rows: selected?.usable === true ? rows.length : null,
      interfaceKind: "legacy-reportmanage",
      originLabel: "Legacy reportmanage"
    }
  };
}

function formatLocalDateFromIso(timestamp) {
  const parsed = Date.parse(String(timestamp || ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return formatDateText(new Date(parsed));
}

function buildCloudDisplayTime(row) {
  const dateText = formatLocalDateFromIso(row?.timestamp);
  const intervalText = asTrimmedString(row?.time, "--");
  if (!dateText) {
    return intervalText;
  }
  return `${dateText} ${intervalText}`;
}

function mapCloudRowToMeterReadingRow(row) {
  const output = {};
  CLOUD_COLUMN_DEFS.forEach(([label, getter]) => {
    output[label] = normalizeCellValue(getter(row));
  });
  return output;
}

function filterCloudItems(items, options) {
  const startMs = parseLocalDateTime(options.startTime, "start").getTime();
  const endMs = parseLocalDateTime(options.endTime, "end").getTime();
  return items.filter((item) => {
    const pointMs = Date.parse(String(item?.timestamp || ""));
    return Number.isFinite(pointMs) && pointMs >= startMs && pointMs <= endMs;
  });
}

function pickLatestTimestamp(results = []) {
  const timestamps = results
    .map((item) => Date.parse(String(item?.latestTimestamp || "")))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) {
    return new Date().toISOString();
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

async function loadCloudHistoryFallback(baseUrl, siteId, options, legacyAttempts = []) {
  const dates = buildDateTextList(options.startTime, options.endTime);
  const results = await Promise.all(
    dates.map((date) => loadB25CloudColdStationLog(baseUrl, siteId, { date }))
  );
  const filteredItems = filterCloudItems(
    results.flatMap((result) => (Array.isArray(result?.items) ? result.items : [])),
    options
  );
  const rows = filteredItems.map(mapCloudRowToMeterReadingRow);
  const columns = collectColumns(rows);
  const firstFailedSource = results.find((result) => result?.sourceStatus?.error)?.sourceStatus;
  const anySourceOk = results.some((result) => result?.sourceStatus?.ok);
  const probeSummary = buildProbeSummary(legacyAttempts);

  return {
    filters: {
      startTime: options.startTime,
      endTime: options.endTime
    },
    columns,
    items: rows,
    total: rows.length,
    latestTimestamp: pickLatestTimestamp(results),
    sourceStatus: {
      endpoint: CLOUD_HISTORY_ENDPOINT,
      ok: anySourceOk,
      status: anySourceOk ? 200 : firstFailedSource?.status ?? null,
      message: anySourceOk
        ? [`B25云端历史已生成小时抄表`, `days=${dates.length}`, `rows=${rows.length}`, probeSummary ? `legacyProbe=${probeSummary}` : null]
            .filter(Boolean)
            .join("; ")
        : [`B25云端历史未生成小时抄表`, probeSummary ? `legacyProbe=${probeSummary}` : null]
            .filter(Boolean)
            .join("; "),
      error: anySourceOk ? null : firstFailedSource?.error || "B25 cloud history unavailable",
      rows: rows.length,
      interfaceKind: "cloud-reg-history",
      originLabel: "B25云端历史"
    }
  };
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

function buildExportFilename(siteId, startTime, endTime, extension) {
  const startDateText = startTime.slice(0, 10);
  const endDateText = endTime.slice(0, 10);
  return `meter-reading-${asTrimmedString(siteId, "site")}-${startDateText}-${endDateText}.${extension}`;
}

export async function loadMeterReadings(baseUrl, siteId, options = {}) {
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const identifiers = buildIdentifierCandidates(siteId, options);
  const legacyProbe = await probeLegacyMeterReadings(baseUrl, identifiers, {
    ...options,
    startTime,
    endTime,
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifiers[0] || siteId)),
    template: asTrimmedString(options.template, "1")
  });
  const runtimeConfig = options.runtimeConfig || { siteSourceConfig: options.siteSourceConfig };

  if (
    shouldUseB25CloudHistory(runtimeConfig, siteId) &&
    (legacyProbe.selected?.usable !== true || legacyProbe.selected.rows.length === 0)
  ) {
    const cloudResult = await loadCloudHistoryFallback(baseUrl, siteId, { startTime, endTime }, legacyProbe.attempts);
    if (cloudResult.sourceStatus.ok && (legacyProbe.selected?.usable !== true || cloudResult.total > 0)) {
      return cloudResult;
    }
    if (legacyProbe.selected?.usable !== true) {
      return cloudResult;
    }
  }

  return buildLegacyResult(legacyProbe.selected, legacyProbe.attempts, {
    ...options,
    startTime,
    endTime,
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifiers[0] || siteId)),
    template: asTrimmedString(options.template, "1")
  });
}

export async function loadMeterReadingExport(baseUrl, siteId, options = {}) {
  const startTime = normalizeDateTimeInput(options.startTime, "start");
  const endTime = normalizeDateTimeInput(options.endTime, "end");
  const identifiers = buildIdentifierCandidates(siteId, options);
  const legacyProbe = await probeLegacyMeterReadingExport(baseUrl, identifiers, {
    ...options,
    startTime,
    endTime,
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifiers[0] || siteId)),
    template: asTrimmedString(options.template, "1")
  });

  if (legacyProbe.selected?.ok && legacyProbe.selected.response?.data) {
    return {
      ok: true,
      status: legacyProbe.selected.response.status,
      endpoint: legacyProbe.selected.endpoint,
      error: null,
      contentType: legacyProbe.selected.response.headers?.contentType || "application/vnd.ms-excel",
      filename: parseFilename(
        legacyProbe.selected.response.headers?.contentDisposition,
        buildExportFilename(siteId, startTime, endTime, "xls")
      ),
      data: legacyProbe.selected.response.data
    };
  }

  const records = await loadMeterReadings(baseUrl, siteId, options);
  if (records.sourceStatus?.ok) {
    return {
      ok: true,
      status: 200,
      endpoint: records.sourceStatus.endpoint || legacyProbe.selected?.endpoint || "",
      error: null,
      contentType: "text/csv; charset=utf-8",
      filename: buildExportFilename(siteId, startTime, endTime, "csv"),
      data: buildCsvData(records.columns, records.items)
    };
  }

  return {
    ok: false,
    status: legacyProbe.selected?.response?.status ?? null,
    endpoint: legacyProbe.selected?.endpoint || records.sourceStatus?.endpoint || "",
    error: legacyProbe.selected?.response?.error || records.sourceStatus?.error || "Legacy export failed",
    contentType: legacyProbe.selected?.response?.headers?.contentType || "application/octet-stream",
    filename: buildExportFilename(siteId, startTime, endTime, "csv"),
    data: null
  };
}

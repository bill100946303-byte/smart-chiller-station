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

const METRIC_ENDPOINT_MAP = {
  systemEfficiency: "findSystemEfficiencyByTimeSpace",
  chillerEfficiency: "findChillerEfficiencyByTimeSpace",
  coolingTowerEfficiency: "findCoolingTowerEfficiencyByTimeSpace",
  chilledPumpEfficiency: "findCHPEfficiencyByTimeSpace",
  coolingPumpEfficiency: "findCWPEfficiencyByTimeSpace",
  chilledWaterTemperature: "findChwTemperature",
  chilledWaterTemperatureDiff: "findChwTemperatureDiffByTimeSpace",
  coolingWaterTemperature: "findCwpTemperatureByTimeSpace",
  coolingWaterTemperatureDiff: "findCwpTemperatureDiffByTimeSpace",
  chilledWaterFlow: "findChilledWaterGpmRtByTimeSpace",
  coolingWaterFlow: "findCondenserWaterGpmRtByTimeSpace"
};

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

function toLegacyMetricEndpoint(metric) {
  return METRIC_ENDPOINT_MAP[metric] || METRIC_ENDPOINT_MAP.systemEfficiency;
}

function buildQueryParams(options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
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
  return search;
}

function buildPerformanceReportEndpoint(siteId, options) {
  const endpoint = toLegacyMetricEndpoint(options.metric);
  return `/zsqy/chillerperformancecure/${siteId}/${endpoint}?${buildQueryParams(options).toString()}`;
}

function buildPerformanceReportExportEndpoint(siteId, options) {
  return `/zsqy/chillerperformancecure/${siteId}/exportPdf?${buildQueryParams(options).toString()}`;
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function formatFallbackAxisLabel(index, total) {
  if (total === 10) {
    return `${pad(index + 8)}h`;
  }
  return `${pad(index)}h`;
}

function normalizePoint(item, index, total) {
  return {
    label: asTrimmedString(
      item?.label ?? item?.name ?? item?.time ?? item?.hour ?? item?.x ?? item?.dataTime ?? item?.dateTime,
      formatFallbackAxisLabel(index, total)
    ),
    value: toNullableNumber(item?.value ?? item?.y ?? item?.data)
  };
}

function normalizeSeries(reportItem, reportIndex) {
  const detailRows = coerceArray(reportItem?.chillerPerformanceDetailReportVO);

  return detailRows.map((detailItem, detailIndex) => {
    const rawPoints = coerceArray(detailItem?.perHourDatas);
    const points = rawPoints.map((point, pointIndex) => normalizePoint(point, pointIndex, rawPoints.length));
    const tagNameDescribe = asTrimmedString(reportItem?.tagNameDescribe, `series-${reportIndex + 1}`);
    const dataTime = asTrimmedString(detailItem?.dataTime, "");
    return {
      id: `${asTrimmedString(reportItem?.tagName, `tag-${reportIndex + 1}`)}-${detailIndex + 1}`,
      name: dataTime ? `${tagNameDescribe} ${dataTime}` : tagNameDescribe,
      points
    };
  });
}

function normalizeSummary(reportItem, index) {
  const tagName = asTrimmedString(reportItem?.tagName, `tag-${index + 1}`);
  const label = asTrimmedString(reportItem?.tagNameDescribe, tagName);
  const average = asTrimmedString(reportItem?.totalAvageData, "--");
  return {
    id: `${tagName}-${index + 1}`,
    tagName,
    label,
    average,
    title: `${tagName} ${label}`
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

export async function loadPerformanceReport(baseUrl, siteId, options = {}) {
  const normalizedOptions = {
    metric: asTrimmedString(options.metric, "systemEfficiency"),
    startTime: normalizeDateTimeInput(options.startTime, "start"),
    endTime: normalizeDateTimeInput(options.endTime, "end"),
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey, siteId),
    template: asTrimmedString(options.template, "1")
  };
  const endpoint = buildPerformanceReportEndpoint(siteId, normalizedOptions);
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = coerceArray(payload?.data?.chillerPerformanceReportVO ?? payload?.chillerPerformanceReportVO)
    .filter((item) => item && typeof item === "object");

  const summaries = rows.map(normalizeSummary);
  const series = rows.flatMap(normalizeSeries);
  const axisLabels = series[0]?.points?.map((point) => point.label) || [];

  return {
    filters: normalizedOptions,
    summaries,
    series,
    axisLabels,
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

export async function loadPerformanceReportExport(baseUrl, siteId, options = {}) {
  const normalizedOptions = {
    startTime: normalizeDateTimeInput(options.startTime, "start"),
    endTime: normalizeDateTimeInput(options.endTime, "end"),
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey, siteId),
    template: asTrimmedString(options.template, "1")
  };
  const endpoint = buildPerformanceReportExportEndpoint(siteId, normalizedOptions);
  const response = await fetchLegacyBinary(baseUrl, endpoint);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status ?? null,
      endpoint,
      error: response.error || "Legacy export failed",
      contentType: response.headers?.contentType || "application/pdf",
      filename: `performance-report-${siteId}.pdf`,
      data: null
    };
  }

  return {
    ok: true,
    status: response.status,
    endpoint,
    error: null,
    contentType: response.headers?.contentType || "application/pdf",
    filename: parseFilename(response.headers?.contentDisposition, `performance-report-${siteId}.pdf`),
    data: response.data
  };
}

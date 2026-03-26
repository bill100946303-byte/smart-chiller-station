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

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function normalizeDateInput(value, fallback = formatDate(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

export function normalizeMonthInput(value, fallback = formatMonth(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

export function normalizeYearInput(value, fallback = String(new Date().getFullYear())) {
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => asTrimmedString(item, "")).filter(Boolean)));
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
  }
  return [];
}

function normalizeTimeSpace(value, fallback = "1") {
  const normalized = asTrimmedString(value, fallback);
  return ["1", "2", "3"].includes(normalized) ? normalized : fallback;
}

function normalizeProportionDateType(value, fallback = "2") {
  const normalized = asTrimmedString(value, fallback);
  return ["2", "3"].includes(normalized) ? normalized : fallback;
}

function buildSearchEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("drNameList", options.deviceKeys.join(","));
  search.set("startTime", options.startDate);
  search.set("endTime", options.endDate);
  search.set("timeSpace", options.timeSpace);
  return `/zsqy/energycalendar/${siteId}/findEnergySearch?${search.toString()}`;
}

function buildCompareEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("drName", options.deviceKey);
  search.set("timeList", options.dates.join(","));
  return `/zsqy/energycalendar/${siteId}/findEnergyContrast?${search.toString()}`;
}

function buildProportionEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("date", options.date);
  search.set("dateType", options.dateType);
  return `/zsqy/energycalendar/${siteId}/findLoadSpecificGravity?${search.toString()}`;
}

function buildImbalanceCurveEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("appId", siteId);
  search.set("date", options.endDate);
  search.set("dateType", "0");
  search.set("energyType", "4");
  search.set("startTime", options.startDate);
  search.set("endTime", options.endDate);
  return `/zsqy/energyanalysis/getEnergyAnalysisCurve?${search.toString()}`;
}

function buildImbalanceTableEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("appId", siteId);
  search.set("date", options.endDate);
  search.set("dateType", "0");
  search.set("energyType", "4");
  search.set("startTime", options.startDate);
  search.set("endTime", options.endDate);
  return `/zsqy/energyanalysis/${siteId}/getEnergyAnalysisDeviceList?${search.toString()}`;
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = asTrimmedString(value, "").replace(/,/g, "").replace(/%/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTableRow(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.object || `energy-efficiency-${index + 1}`),
    object: asTrimmedString(item?.object, `对象 ${index + 1}`),
    wholeValue: asTrimmedString(item?.wholeValue, "--"),
    averageValue: asTrimmedString(item?.averageValue, "--"),
    tenPercentGoodAverageValue: asTrimmedString(item?.tenPercentGoodAverageValue, "--"),
    tenPercentBadAverageValue: asTrimmedString(item?.tenPercentBadAverageValue, "--")
  };
}

function normalizeSeriesPoint(item, index) {
  return {
    label: asTrimmedString(item?.time ?? item?.name ?? `point-${index + 1}`),
    value: toNullableNumber(item?.cop ?? item?.value)
  };
}

function normalizeSeries(item, index) {
  const points = Array.isArray(item?.data) ? item.data.map(normalizeSeriesPoint) : [];
  return {
    id: asTrimmedString(item?.id || item?.title || `series-${index + 1}`),
    name: asTrimmedString(item?.title, `series-${index + 1}`),
    points
  };
}

function normalizeReportPayload(payload) {
  const tableRowsRaw = Array.isArray(payload?.data?.tableList)
    ? payload.data.tableList
    : Array.isArray(payload?.tableList)
      ? payload.tableList
      : [];
  const seriesRaw = Array.isArray(payload?.data?.curveList)
    ? payload.data.curveList
    : Array.isArray(payload?.curveList)
      ? payload.curveList
      : [];
  const series = seriesRaw.map(normalizeSeries);
  const axisLabels = series.reduce((current, item) => (
    (item.points?.length || 0) > current.length
      ? (item.points || []).map((point) => point.label || "")
      : current
  ), []);

  return {
    tableRows: tableRowsRaw.map(normalizeTableRow),
    series,
    axisLabels
  };
}

function normalizeProportionRow(item, index) {
  return {
    id: `proportion-${index + 1}`,
    rangeLabel: asTrimmedString(item?.["负荷区间"] || item?.rangeLabel, `range-${index + 1}`),
    loadRatioPct: toNullableNumber(item?.["负荷比重比例"] || item?.loadRatioPct),
    stationEfficiency: toNullableNumber(item?.["冷站效能"] || item?.stationEfficiency)
  };
}

function normalizeImbalancePoint(item, index) {
  return {
    label: asTrimmedString(item?.name ?? item?.time ?? `point-${index + 1}`),
    value: toNullableNumber(item?.value)
  };
}

function normalizeImbalanceSeries(item, index) {
  const points = Array.isArray(item?.curveValueList)
    ? item.curveValueList.map(normalizeImbalancePoint)
    : [];
  return {
    id: asTrimmedString(item?.id || item?.title || `imbalance-series-${index + 1}`),
    name: asTrimmedString(item?.title, `series-${index + 1}`),
    points
  };
}

function normalizeImbalanceStatisticRow(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.acquisitionValue || `imbalance-stat-${index + 1}`),
    acquisitionValue: asTrimmedString(item?.acquisitionValue, `采集值 ${index + 1}`),
    scalar: toNullableNumber(item?.scalar),
    noScalar: toNullableNumber(item?.noScalar),
    scalarRate: toNullableNumber(item?.scalarRate)
  };
}

function normalizeImbalanceDeviceRow(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.drName || `imbalance-device-${index + 1}`),
    deviceName: asTrimmedString(item?.drName, `设备 ${index + 1}`),
    deviceTypeName: asTrimmedString(item?.drTypeName, "--"),
    scalarRate: toNullableNumber(item?.scalarRate)
  };
}

export async function loadEnergyEfficiencySearch(baseUrl, siteId, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const timeSpace = normalizeTimeSpace(options.timeSpace, "1");
  const deviceKeys = normalizeStringList(options.deviceKeys);
  const endpoint = buildSearchEndpoint(siteId, { startDate, endDate, timeSpace, deviceKeys });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const normalized = normalizeReportPayload(payload);

  return {
    filters: {
      startDate,
      endDate,
      timeSpace,
      deviceKeys
    },
    tableRows: normalized.tableRows,
    series: normalized.series,
    axisLabels: normalized.axisLabels,
    latestTimestamp: fetchedAt,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? normalized.tableRows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function loadEnergyEfficiencyCompare(baseUrl, siteId, options = {}) {
  const deviceKey = asTrimmedString(options.deviceKey, "CoolingStation");
  const dates = normalizeStringList(options.dates).map((item) => normalizeDateInput(item, item));
  const endpoint = buildCompareEndpoint(siteId, { deviceKey, dates });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const normalized = normalizeReportPayload(payload);

  return {
    filters: {
      deviceKey,
      dates
    },
    tableRows: normalized.tableRows,
    series: normalized.series,
    axisLabels: normalized.axisLabels,
    latestTimestamp: fetchedAt,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? normalized.tableRows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function loadEnergyEfficiencyProportion(baseUrl, siteId, options = {}) {
  const dateType = normalizeProportionDateType(options.dateType, "2");
  const date = dateType === "3"
    ? normalizeYearInput(options.date)
    : normalizeMonthInput(options.date);
  const endpoint = buildProportionEndpoint(siteId, { date, dateType });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rowsRaw = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const rows = rowsRaw.map(normalizeProportionRow);

  return {
    filters: {
      date,
      dateType
    },
    rows,
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

export async function loadEnergyEfficiencyImbalance(baseUrl, siteId, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const curveEndpoint = buildImbalanceCurveEndpoint(siteId, { startDate, endDate });
  const tableEndpoint = buildImbalanceTableEndpoint(siteId, { startDate, endDate });
  const fetchedAt = new Date().toISOString();

  const [curveResponse, tableResponse] = await Promise.all([
    fetchLegacyJson(baseUrl, curveEndpoint),
    fetchLegacyJson(baseUrl, tableEndpoint)
  ]);

  const curvePayload = curveResponse.ok && curveResponse.payload && typeof curveResponse.payload === "object"
    ? curveResponse.payload
    : null;
  const tablePayload = tableResponse.ok && tableResponse.payload && typeof tableResponse.payload === "object"
    ? tableResponse.payload
    : null;

  const curveRows = Array.isArray(curvePayload?.data)
    ? curvePayload.data
    : Array.isArray(curvePayload)
      ? curvePayload
      : [];
  const tableRows = Array.isArray(tablePayload?.data)
    ? tablePayload.data
    : Array.isArray(tablePayload)
      ? tablePayload
      : [];

  const series = curveRows.map(normalizeImbalanceSeries);
  const axisLabels = series.reduce((current, item) => (
    (item.points?.length || 0) > current.length
      ? (item.points || []).map((point) => point.label || "")
      : current
  ), []);
  const firstTableSection = tableRows[0] || {};
  const statisticsRows = Array.isArray(firstTableSection?.dataStatisticsList)
    ? firstTableSection.dataStatisticsList.map(normalizeImbalanceStatisticRow)
    : [];
  const deviceRows = Array.isArray(firstTableSection?.tableList)
    ? firstTableSection.tableList.map(normalizeImbalanceDeviceRow)
    : [];

  return {
    filters: {
      startDate,
      endDate,
      dateType: "0",
      energyType: "4"
    },
    series,
    axisLabels,
    statisticsRows,
    deviceRows,
    latestTimestamp: fetchedAt,
    sourceStatus: {
      curve: {
        endpoint: curveEndpoint,
        ok: curveResponse.ok,
        status: curveResponse.status ?? null,
        message: curveResponse.ok ? extractMessage(curveResponse.payload, "OK") : null,
        rows: curveResponse.ok ? series.length : null,
        error: curveResponse.ok ? null : curveResponse.error
      },
      deviceList: {
        endpoint: tableEndpoint,
        ok: tableResponse.ok,
        status: tableResponse.status ?? null,
        message: tableResponse.ok ? extractMessage(tableResponse.payload, "OK") : null,
        rows: tableResponse.ok ? statisticsRows.length + deviceRows.length : null,
        error: tableResponse.ok ? null : tableResponse.error
      }
    }
  };
}

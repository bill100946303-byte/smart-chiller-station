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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function normalizeTimeSpace(value, fallback = "1") {
  const normalized = asTrimmedString(value, fallback);
  return ["1", "2", "3"].includes(normalized) ? normalized : fallback;
}

function normalizeProportionDateType(value, fallback = "2") {
  const normalized = asTrimmedString(value, fallback);
  return ["2", "3"].includes(normalized) ? normalized : fallback;
}

function buildIdentifierCandidates(
  siteId,
  projectKey,
  projectKeyCandidates = [],
  databaseKey = "",
  databaseKeyCandidates = []
) {
  const dbCandidates = Array.isArray(databaseKeyCandidates) ? databaseKeyCandidates : [];
  const extraCandidates = Array.isArray(projectKeyCandidates) ? projectKeyCandidates : [];
  return Array.from(
    new Set(
      [...dbCandidates, databaseKey, ...extraCandidates, projectKey, siteId]
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )
  );
}

async function fetchAcrossIdentifiers(
  baseUrl,
  siteId,
  projectKey,
  projectKeyCandidates,
  endpointBuilder,
  databaseKey = "",
  databaseKeyCandidates = []
) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    projectKey,
    projectKeyCandidates,
    databaseKey,
    databaseKeyCandidates
  );
  let selectedIdentifier = asTrimmedString(siteId);
  let selectedEndpoint = endpointBuilder(selectedIdentifier);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };

  for (const identifier of identifiers) {
    const endpoint = endpointBuilder(identifier);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedIdentifier = identifier;
    selectedEndpoint = endpoint;
    selectedResponse = response;
    if (response.ok) {
      break;
    }
  }

  return {
    identifier: selectedIdentifier,
    endpoint: selectedEndpoint,
    response: selectedResponse
  };
}

function buildSearchEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("drNameList", options.deviceKeys.join(","));
  search.set("timeSpace", options.timeSpace);
  search.set("startTime", options.startDate);
  search.set("endTime", options.endDate);
  search.set("language", options.language || "zh");
  search.set("unit", options.unit || "KW");
  search.set("modelKey", options.modelKey || options.projectKey || siteId);
  search.set("template", options.template || "1");
  return `/zsqy/energycalendar/${siteId}/findEnergySearch?${search.toString()}`;
}

function buildCompareEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("drName", options.deviceKey);
  search.set("timeList", options.dates.join(","));
  search.set("timeSpace", options.timeSpace || "1");
  search.set("language", options.language || "zh");
  search.set("unit", options.unit || "KW");
  search.set("modelKey", options.modelKey || options.projectKey || siteId);
  search.set("template", options.template || "1");
  return `/zsqy/energycalendar/${siteId}/findEnergyContrast?${search.toString()}`;
}

function buildProportionEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("date", options.date);
  search.set("dateType", options.dateType);
  search.set("language", options.language || "zh");
  search.set("unit", options.unit || "KW");
  search.set("modelKey", options.modelKey || options.projectKey || siteId);
  search.set("template", options.template || "1");
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

function buildImbalanceTableEndpoint(siteId, appId, options) {
  const search = new URLSearchParams();
  search.set("appId", appId);
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

function pickFirstNumericField(item, keys) {
  for (const key of keys) {
    if (item && Object.prototype.hasOwnProperty.call(item, key)) {
      const parsed = toNullableNumber(item[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeWetBulbValue(item) {
  const wetBulbKeys = [
    "\u6e7f\u7403\u6e29\u5ea6",
    "\u6e7f\u7403",
    "\u5ba4\u5916\u6e7f\u7403\u6e29\u5ea6",
    "\u5ba4\u5916\u6e7f\u7403",
    "\u5ba4\u5916\u6e7f\u7403\u6e29\u5ea6(\u2103)",
    "\u5ba4\u5916\u6e7f\u7403\u6e29\u5ea6(\u00b0C)",
    "婀跨悆娓╁害",
    "婀跨悆",
    "瀹ゅ婀跨悆娓╁害",
    "瀹ゅ婀跨悆",
    "wetBulbC",
    "wetBulb",
    "wetBulbTempC",
    "wet_bulb",
    "wet_bulb_c",
    "outdoorWetBulbC",
    "outdoorWetBulb"
  ];
  return pickFirstNumericField(item, wetBulbKeys);
}

function normalizeTableRow(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.object || `energy-efficiency-${index + 1}`),
    object: asTrimmedString(item?.object, `瀵硅薄 ${index + 1}`),
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
  const points = toArray(item?.data).map(normalizeSeriesPoint);
  return {
    id: asTrimmedString(item?.id || item?.title || `series-${index + 1}`),
    name: asTrimmedString(item?.title, `series-${index + 1}`),
    points
  };
}

function normalizeReportPayload(payload) {
  const tableRowsRaw = toArray(payload?.data?.tableList ?? payload?.tableList);
  const seriesRaw = toArray(payload?.data?.curveList ?? payload?.curveList);
  const normalizedTableRows = tableRowsRaw.map(normalizeTableRow);
  const series = seriesRaw.map((item, index) => normalizeSeries(
    item && typeof item === "object" && !item.title && normalizedTableRows[index]?.object
      ? { ...item, title: normalizedTableRows[index].object }
      : item,
    index
  ));
  const axisLabels = series.reduce((current, item) => (
    (item.points?.length || 0) > current.length
      ? (item.points || []).map((point) => point.label || "")
      : current
  ), []);

  return {
    tableRows: normalizedTableRows,
    series,
    axisLabels
  };
}

function normalizeProportionRow(item, index) {
  return {
    id: `proportion-${index + 1}`,
    rangeLabel: asTrimmedString(
      item?.["\u8d1f\u8377\u533a\u95f4"] ||
      item?.["璐熻嵎鍖洪棿"] ||
      item?.rangeLabel ||
      item?.range ||
      item?.name,
      `range-${index + 1}`
    ),
    loadRatioPct: toNullableNumber(
      item?.["\u8d1f\u8377\u6bd4\u91cd\u6bd4\u4f8b"] ||
      item?.["\u8d1f\u8377\u6bd4\u91cd"] ||
      item?.["璐熻嵎姣旈噸姣斾緥"] ||
      item?.loadRatioPct ||
      item?.ratio ||
      item?.value
    ),
    stationEfficiency: toNullableNumber(
      item?.["\u51b7\u7ad9\u6548\u80fd"] ||
      item?.["鍐风珯鏁堣兘"] ||
      item?.stationEfficiency ||
      item?.efficiency ||
      item?.cop
    ),
    wetBulbC: normalizeWetBulbValue(item)
  };
}

function extractProportionRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const candidates = [
    payload.data,
    payload.rows,
    payload.list,
    payload.tableList,
    payload.result
  ];
  for (const candidate of candidates) {
    const rows = toArray(candidate).filter((item) => item && typeof item === "object");
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

function normalizeImbalancePoint(item, index) {
  return {
    label: asTrimmedString(item?.name ?? item?.time ?? `point-${index + 1}`),
    value: toNullableNumber(item?.value)
  };
}

function extractImbalanceCurveRows(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  const data = payload?.data;
  if (!data || typeof data !== "object") {
    return [];
  }
  if (Array.isArray(data?.curveValueList)) {
    return [
      {
        title: data?.title,
        curveValueList: data.curveValueList
      }
    ];
  }
  if (Array.isArray(data?.curveValueList?.curveValueList)) {
    return [
      {
        title: data?.title,
        curveValueList: data.curveValueList.curveValueList
      }
    ];
  }
  return [];
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
    acquisitionValue: asTrimmedString(item?.acquisitionValue, `閲囬泦鍊?${index + 1}`),
    scalar: toNullableNumber(item?.scalar),
    noScalar: toNullableNumber(item?.noScalar),
    scalarRate: toNullableNumber(item?.scalarRate)
  };
}

function normalizeImbalanceDeviceRow(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.drName || item?.scalarRate || `imbalance-device-${index + 1}`),
    deviceName: asTrimmedString(item?.drName, "--"),
    deviceTypeName: asTrimmedString(item?.drTypeName, "--"),
    scalarRate: toNullableNumber(item?.scalarRate)
  };
}

function extractImbalanceTableSections(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (payload?.data && typeof payload.data === "object") {
    return [payload.data];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && (payload?.dataStatisticsList || payload?.tableList)) {
    return [payload];
  }
  return [];
}

export async function loadEnergyEfficiencySearch(baseUrl, siteId, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const timeSpace = normalizeTimeSpace(options.timeSpace, "1");
  const deviceKeys = normalizeStringList(options.deviceKeys);
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = asTrimmedString(options.modelKey || options.projectKey, "");
  const template = asTrimmedString(options.template, "1");
  const fetchedAt = new Date().toISOString();
  const { endpoint, response } = await fetchAcrossIdentifiers(
    baseUrl,
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    (identifier) => buildSearchEndpoint(identifier, { startDate, endDate, timeSpace, deviceKeys, language, unit, modelKey, template }),
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const normalized = normalizeReportPayload(payload);

  return {
    filters: {
      startDate,
      endDate,
      timeSpace,
      deviceKeys,
      language,
      unit,
      modelKey,
      template
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
  const timeSpace = normalizeTimeSpace(options.timeSpace, "1");
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = asTrimmedString(options.modelKey || options.projectKey, "");
  const template = asTrimmedString(options.template, "1");
  const fetchedAt = new Date().toISOString();
  const { endpoint, response } = await fetchAcrossIdentifiers(
    baseUrl,
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    (identifier) => buildCompareEndpoint(identifier, { deviceKey, dates, timeSpace, language, unit, modelKey, template }),
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const normalized = normalizeReportPayload(payload);

  return {
    filters: {
      deviceKey,
      dates,
      timeSpace,
      language,
      unit,
      modelKey,
      template
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
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = asTrimmedString(options.modelKey || options.projectKey, "");
  const template = asTrimmedString(options.template, "1");
  const fetchedAt = new Date().toISOString();
  const { endpoint, response } = await fetchAcrossIdentifiers(
    baseUrl,
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    (identifier) => buildProportionEndpoint(identifier, { date, dateType, language, unit, modelKey, template }),
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rowsRaw = extractProportionRows(payload);
  const rows = rowsRaw.map(normalizeProportionRow);

  return {
    filters: {
      date,
      dateType,
      language,
      unit,
      modelKey,
      template
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
  const fetchedAt = new Date().toISOString();
  const tableAppId = asTrimmedString(options.appId, asTrimmedString(siteId));
  const curveResult = await fetchAcrossIdentifiers(
    baseUrl,
    siteId,
    options.appId,
    options.appIdCandidates,
    (identifier) => buildImbalanceCurveEndpoint(identifier, { startDate, endDate }),
    "",
    []
  );
  const tableResult = await fetchAcrossIdentifiers(
    baseUrl,
    siteId,
    options.tableIdentifier,
    options.tableIdentifierCandidates,
    (identifier) => buildImbalanceTableEndpoint(identifier, tableAppId, { startDate, endDate }),
    options.databaseKey,
    options.databaseKeyCandidates
  );

  const curveEndpoint = curveResult.endpoint;
  const curveResponse = curveResult.response;
  const tableEndpoint = tableResult.endpoint;
  const tableResponse = tableResult.response;

  const curvePayload = curveResponse.ok && curveResponse.payload && typeof curveResponse.payload === "object"
    ? curveResponse.payload
    : null;
  const tablePayload = tableResponse.ok && tableResponse.payload && typeof tableResponse.payload === "object"
    ? tableResponse.payload
    : null;

  const curveRows = extractImbalanceCurveRows(curvePayload);
  const tableSections = extractImbalanceTableSections(tablePayload);

  const series = curveRows.map(normalizeImbalanceSeries);
  const axisLabels = series.reduce((current, item) => (
    (item.points?.length || 0) > current.length
      ? (item.points || []).map((point) => point.label || "")
      : current
  ), []);
  const statisticsRows = tableSections.flatMap((section) =>
    toArray(section?.dataStatisticsList).map(normalizeImbalanceStatisticRow)
  );
  const deviceRows = tableSections.flatMap((section) =>
    toArray(section?.tableList).map(normalizeImbalanceDeviceRow)
  );

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

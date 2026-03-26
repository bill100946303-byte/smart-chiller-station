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

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function buildCalendarEndpoint(siteId, month) {
  const [year, monthPart] = month.split("-");
  const search = new URLSearchParams();
  search.set("appId", siteId);
  search.set("year", year);
  search.set("month", String(Number(monthPart)));
  return `/zsqy/energycalendar/findEnergyCalendar?${search.toString()}`;
}

function buildMonthSummaryEndpoint(siteId, month) {
  const search = new URLSearchParams();
  search.set("date", month);
  return `/zsqy/energycalendar/${siteId}/findMonthEnergy?${search.toString()}`;
}

function buildPieEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("appId", siteId);
  search.set("date", options.date);
  search.set("dateType", options.dateType);
  search.set("energyType", "1");
  return `/zsqy/energyanalysis/getEnergyAnalysisPie?${search.toString()}`;
}

export function normalizeMonthInput(value, fallback = formatMonth(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

export function normalizeCalendarPieInput(value, dateType) {
  if (dateType === "2") {
    return normalizeMonthInput(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeDateTypeInput(value, fallback = "1") {
  const normalized = asTrimmedString(value, fallback);
  return normalized === "2" ? "2" : "1";
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = asTrimmedString(value, "").replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCalendarItem(item, month) {
  const [year, monthPart] = month.split("-");
  const dayRaw = asTrimmedString(item?.date, "").replace("号", "");
  const day = pad(Number(dayRaw || "0"));
  const fullDate = `${year}-${monthPart}-${day}`;
  const efficiency = toNullableNumber(item?.rte);
  const rawEfficiency = toNullableNumber(item?.e);
  const power = toNullableNumber(item?.p);
  const cooling = toNullableNumber(item?.c);
  const unitPrice = toNullableNumber(item?.m);
  const cost = toNullableNumber(item?.k);
  const hasPrice = item?.m != null && String(item.m).trim() !== "-1";

  return {
    id: fullDate,
    date: fullDate,
    day,
    efficiency,
    rawEfficiency,
    power,
    cooling,
    unitPrice: hasPrice ? unitPrice : null,
    cost: hasPrice ? cost : null,
    hasData: rawEfficiency != null || efficiency != null || power != null || cooling != null
  };
}

function normalizeSummary(summary, month) {
  return {
    id: month,
    date: month,
    day: month.slice(-2),
    efficiency: toNullableNumber(summary?.rte),
    rawEfficiency: toNullableNumber(summary?.e),
    power: toNullableNumber(summary?.p),
    cooling: toNullableNumber(summary?.c),
    unitPrice:
      summary?.m != null && String(summary.m).trim() !== "-1"
        ? toNullableNumber(summary?.m)
        : null,
    cost:
      summary?.m != null && String(summary.m).trim() !== "-1"
        ? toNullableNumber(summary?.k)
        : null,
    hasData: true
  };
}

function normalizePieSegments(payload) {
  const source =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? payload.data
        : payload
      : {};

  const segments = Object.entries(source)
    .filter(([key]) => key !== "msg" && key !== "status")
    .map(([name, rawValue]) => ({
      id: name,
      name,
      value: toNullableNumber(rawValue)
    }))
    .filter((item) => item.value != null);

  const total = segments.reduce((sum, item) => sum + (item.value || 0), 0);
  return { segments, total };
}

export async function loadEnergyEfficiencyCalendar(baseUrl, siteId, options = {}) {
  const month = normalizeMonthInput(options.month);
  const calendarEndpoint = buildCalendarEndpoint(siteId, month);
  const summaryEndpoint = buildMonthSummaryEndpoint(siteId, month);
  const fetchedAt = new Date().toISOString();

  const [calendarResponse, summaryResponse] = await Promise.all([
    fetchLegacyJson(baseUrl, calendarEndpoint),
    fetchLegacyJson(baseUrl, summaryEndpoint)
  ]);

  const calendarPayload =
    calendarResponse.ok && calendarResponse.payload && typeof calendarResponse.payload === "object"
      ? calendarResponse.payload
      : null;
  const summaryPayload =
    summaryResponse.ok && summaryResponse.payload && typeof summaryResponse.payload === "object"
      ? summaryResponse.payload
      : null;

  const calendarRows = Array.isArray(calendarPayload?.data)
    ? calendarPayload.data
    : Array.isArray(calendarPayload)
      ? calendarPayload
      : [];

  const items = calendarRows.map((item) => normalizeCalendarItem(item, month));
  const monthSummary = summaryPayload?.data ? normalizeSummary(summaryPayload.data, month) : null;

  return {
    month,
    items,
    monthSummary,
    latestTimestamp: fetchedAt,
    sourceStatus: {
      calendar: {
        endpoint: calendarEndpoint,
        ok: calendarResponse.ok,
        status: calendarResponse.status ?? null,
        message: calendarResponse.ok ? extractMessage(calendarResponse.payload, "OK") : null,
        rows: calendarResponse.ok ? items.length : null,
        error: calendarResponse.ok ? null : calendarResponse.error
      },
      monthSummary: {
        endpoint: summaryEndpoint,
        ok: summaryResponse.ok,
        status: summaryResponse.status ?? null,
        message: summaryResponse.ok ? extractMessage(summaryResponse.payload, "OK") : null,
        rows: monthSummary ? 1 : 0,
        error: summaryResponse.ok ? null : summaryResponse.error
      }
    }
  };
}

export async function loadEnergyEfficiencyCalendarPie(baseUrl, siteId, options = {}) {
  const dateType = normalizeDateTypeInput(options.dateType, "1");
  const date = normalizeCalendarPieInput(options.date, dateType);
  const endpoint = buildPieEndpoint(siteId, { date, dateType });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const normalized = normalizePieSegments(payload);

  return {
    filters: {
      date,
      dateType
    },
    segments: normalized.segments,
    total: normalized.total,
    latestTimestamp: fetchedAt,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? normalized.segments.length : null,
      error: response.ok ? null : response.error
    }
  };
}

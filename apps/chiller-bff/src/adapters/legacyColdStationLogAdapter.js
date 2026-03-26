import { fetchLegacyJson } from "../lib/http.js";

function asNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(input) {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  return formatDate(new Date());
}

function buildEndpoint(siteId, date) {
  const search = new URLSearchParams();
  search.set("date", date);
  return `/zsqy/lengzhanrecords/${siteId}/getLengZhanRecords?${search.toString()}`;
}

function pickPayloadData(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  if (payload && typeof payload === "object") {
    return payload;
  }
  return null;
}

function normalizeSummary(data) {
  return {
    inputPower: asNumber(data?.inputPower),
    outputCoolingCapacity: asNumber(data?.outputCoolingCapacity),
    systemHeatDissipation: asNumber(data?.systemHeatDissipation),
    systemEfficiency: asNumber(data?.systemEfficiency),
    hostPower: asNumber(data?.hostPower),
    refrigeratingPumpPower: asNumber(data?.refrigeratingPumpPower),
    coolingPumpPower: asNumber(data?.coolingPumpPower),
    coolingTowerPower: asNumber(data?.coolingTowerPower)
  };
}

function buildRowTimestamp(date, value) {
  const time = String(value || "").trim();
  if (!time) {
    return null;
  }
  const match = time.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) {
    return null;
  }
  const [, hourRaw, minuteRaw, secondRaw] = match;
  const hour = String(hourRaw).padStart(2, "0");
  const minute = String(minuteRaw || "0").padStart(2, "0");
  const second = String(secondRaw || "0").padStart(2, "0");
  const parsed = new Date(`${date}T${hour}:${minute}:${second}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeRow(row, index, date) {
  const time = String(row?.time || row?.hour || `${index + 1}`).trim();
  return {
    id: `cold-station-log-${date}-${index + 1}`,
    time,
    timestamp: buildRowTimestamp(date, time),
    systemCoolingCapacity: asNumber(row?.systemCoolingCapacity),
    systemPower: asNumber(row?.systemPower),
    hostPower: asNumber(row?.hostPower),
    refrigeratingPumpPower: asNumber(row?.refrigeratingPumpPower),
    coolingPumpPower: asNumber(row?.coolingPumpPower),
    coolingTowerPower: asNumber(row?.coolingTowerPower),
    systemEfficiency: asNumber(row?.systemEfficiency),
    hostEfficiency: asNumber(row?.hostEfficiency),
    refrigerationPumpConveyingCoefficient: asNumber(row?.refrigerationPumpConveyingCoefficient),
    coolingPumpConveyingCoefficient: asNumber(row?.coolingPumpConveyingCoefficient),
    coolingTowerConveyingCoefficient: asNumber(row?.coolingTowerConveyingCoefficient),
    chilledWaterInputTemperature: asNumber(row?.chilledWaterInputTemperature),
    chilledWaterOutputTemperature: asNumber(row?.chilledWaterOutputTemperature),
    coolingWaterInputTemperature: asNumber(row?.coolingWaterInputTemperature),
    coolingWaterOutputTemperature: asNumber(row?.coolingWaterOutputTemperature)
  };
}

export async function loadColdStationLog(baseUrl, siteId, options = {}) {
  const date = normalizeDate(options.date);
  const endpoint = buildEndpoint(siteId, date);
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payloadData = response.ok ? pickPayloadData(response.payload) : null;
  const detailRows = Array.isArray(payloadData?.lengZhanRecordsDetailVOList)
    ? payloadData.lengZhanRecordsDetailVOList
    : [];
  const items = detailRows.map((row, index) => normalizeRow(row, index, date));

  return {
    date,
    summary: normalizeSummary(payloadData),
    items,
    latestTimestamp: response.ok ? fetchedAt : null,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? items.length : null,
      error: response.ok ? null : response.error
    }
  };
}

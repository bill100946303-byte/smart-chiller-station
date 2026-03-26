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

export function normalizeDateInput(value, fallback = formatDate(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

export function normalizeDateTypeInput(value, fallback = "1") {
  const normalized = asTrimmedString(value, fallback);
  return ["1", "2", "3", "4"].includes(normalized) ? normalized : fallback;
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => asTrimmedString(item, "")).filter(Boolean)));
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
  }
  return [];
}

function buildTypeTreeEndpoint(siteId) {
  return `/zsqy/Drtypeinfo/${siteId}/findAllDrTypeAndDrEnergy`;
}

function buildDeviceListEndpoint(siteId, drTypeId) {
  const search = new URLSearchParams();
  search.set("drtypeid", drTypeId);
  return `/zsqy/drinfo/${siteId}/findAll?${search.toString()}`;
}

function buildEnergyAnalysisEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("startTime", options.startDate);
  search.set("endTime", options.endDate);
  search.set("dateType", options.dateType);
  search.set("drIds", options.deviceIds.join(","));
  return `/zsqy/energyanalysis/${siteId}/getEnergyAnalysisCurveByDr?${search.toString()}`;
}

function extractArray(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = asTrimmedString(value, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePoint(point, index) {
  return {
    label: asTrimmedString(point?.name ?? point?.label ?? point?.time ?? point?.x, `point-${index + 1}`),
    value: toNullableNumber(point?.value ?? point?.y)
  };
}

function normalizeSummaryRow(item, index) {
  const curve = item?.runParamsCurveVO;
  const rawPoints = Array.isArray(curve?.curveValueList) ? curve.curveValueList : [];
  return {
    id: asTrimmedString(item?.objId ?? item?.drid ?? item?.drId ?? `energy-analysis-${index + 1}`),
    objectName: asTrimmedString(item?.objName, `对象 ${index + 1}`),
    sumValue: toNullableNumber(item?.sumValue),
    maxValue: toNullableNumber(item?.maxValue),
    maxTime: asTrimmedString(item?.maxTime, "--"),
    minValue: toNullableNumber(item?.minValue),
    minTime: asTrimmedString(item?.minTime, "--"),
    average: toNullableNumber(item?.average),
    unit: asTrimmedString(curve?.unit, ""),
    points: rawPoints.map(normalizePoint)
  };
}

function normalizeDeviceNode(item, typeNodeId, drTypeId, drTypeLabel, index) {
  const deviceId = asTrimmedString(item?.drid || item?.id || `device-${index + 1}`);
  return {
    id: `device:${deviceId}`,
    label: asTrimmedString(item?.drnameCNEN || item?.drname || item?.name || deviceId),
    nodeType: "device",
    parentId: typeNodeId,
    typeId: drTypeId,
    typeLabel: drTypeLabel,
    deviceId,
    deviceCount: 1,
    childCount: 0,
    children: []
  };
}

function countLeafDevices(nodes) {
  return nodes.reduce((total, node) => total + (typeof node?.deviceCount === "number" ? node.deviceCount : 0), 0);
}

function normalizeTypeNode(item, parentId, nodeType, children = [], fallbackId) {
  const typeId = asTrimmedString(item?.drtypeid || fallbackId, fallbackId);
  return {
    id: `type:${typeId}`,
    label: asTrimmedString(item?.drtypenameCNEN || item?.drtypename || item?.name || typeId),
    nodeType,
    parentId,
    typeId,
    typeLabel: asTrimmedString(item?.drtypenameCNEN || item?.drtypename || item?.name || typeId),
    deviceId: null,
    deviceCount: countLeafDevices(children),
    childCount: children.length,
    children
  };
}

async function loadFullTree(baseUrl, siteId) {
  const endpoint = buildTypeTreeEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const topLevelRows = extractArray(payload).filter((item) => String(item?.isenergy ?? "") === "1");
  const childTypeRows = topLevelRows.flatMap((item) =>
    (Array.isArray(item?.drtypeinfoList) ? item.drtypeinfoList : []).map((child) => ({
      topTypeId: asTrimmedString(item?.drtypeid || ""),
      topTypeLabel: asTrimmedString(item?.drtypenameCNEN || item?.drtypename || item?.name || ""),
      row: child
    }))
  );

  const deviceResponses = await Promise.all(
    childTypeRows.map(async ({ row, topTypeId, topTypeLabel }) => {
      const drTypeId = asTrimmedString(row?.drtypeid || "");
      const deviceEndpoint = buildDeviceListEndpoint(siteId, drTypeId);
      const deviceResponse = await fetchLegacyJson(baseUrl, deviceEndpoint);
      const devicePayload =
        deviceResponse.ok && deviceResponse.payload && typeof deviceResponse.payload === "object"
          ? deviceResponse.payload
          : null;
      const deviceRows = extractArray(devicePayload);
      return {
        topTypeId,
        topTypeLabel,
        drTypeId,
        endpoint: deviceEndpoint,
        response: deviceResponse,
        rows: deviceRows
      };
    })
  );

  const deviceMap = new Map(
    deviceResponses.map((item) => [
      item.drTypeId,
      item.rows.map((device, index) =>
        normalizeDeviceNode(
          device,
          `type:${item.drTypeId}`,
          item.drTypeId,
          asTrimmedString(
            childTypeRows.find((candidate) => asTrimmedString(candidate.row?.drtypeid || "") === item.drTypeId)?.row
              ?.drtypenameCNEN
              || childTypeRows.find((candidate) => asTrimmedString(candidate.row?.drtypeid || "") === item.drTypeId)?.row
                ?.drtypename
              || item.drTypeId
          ),
          index
        )
      )
    ])
  );

  const items = topLevelRows.map((topRow, topIndex) => {
    const topTypeId = asTrimmedString(topRow?.drtypeid || `energy-top-${topIndex + 1}`);
    const children = (Array.isArray(topRow?.drtypeinfoList) ? topRow.drtypeinfoList : []).map((childRow, childIndex) => {
      const childTypeId = asTrimmedString(childRow?.drtypeid || `${topTypeId}-${childIndex + 1}`);
      const devices = deviceMap.get(childTypeId) || [];
      return normalizeTypeNode(childRow, `type:${topTypeId}`, "device_type", devices, childTypeId);
    });
    return normalizeTypeNode(topRow, null, "energy_category", children, topTypeId);
  });

  const deviceStatusOk = deviceResponses.filter((item) => item.response.ok).length;
  return {
    items,
    sourceStatus: {
      tree: {
        key: "energyAnalysisTree",
        endpoint,
        ok: response.ok,
        status: response.status ?? null,
        message: response.ok ? extractMessage(response.payload, "OK") : null,
        rows: response.ok ? topLevelRows.length : null,
        error: response.ok ? null : response.error
      },
      devices: {
        key: "energyAnalysisDevices",
        endpoint: `${buildDeviceListEndpoint(siteId, "{drtypeid}")} x ${childTypeRows.length}`,
        ok: deviceResponses.length === 0 ? response.ok : deviceStatusOk === deviceResponses.length,
        status: deviceResponses.find((item) => !item.response.ok)?.response.status ?? 200,
        message:
          deviceResponses.length === 0
            ? response.ok
              ? extractMessage(response.payload, "OK")
              : null
            : `${deviceStatusOk}/${deviceResponses.length} type catalogs loaded`,
        rows: deviceResponses.reduce((total, item) => total + item.rows.length, 0),
        error:
          deviceResponses.find((item) => !item.response.ok)?.response.error
          || (response.ok ? null : response.error)
      }
    }
  };
}

export async function loadEnergyAnalysisTree(baseUrl, siteId) {
  return loadFullTree(baseUrl, siteId);
}

export async function loadEnergyAnalysis(baseUrl, siteId, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const dateType = normalizeDateTypeInput(options.dateType, "1");
  const deviceIds = normalizeIdList(options.deviceIds);
  const endpoint = buildEnergyAnalysisEndpoint(siteId, {
    startDate,
    endDate,
    dateType,
    deviceIds
  });
  const fetchedAt = new Date().toISOString();
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = extractArray(payload).map(normalizeSummaryRow);
  const axisLabels = rows[0]?.points?.map((point) => point.label) || [];

  return {
    filters: {
      startDate,
      endDate,
      dateType,
      deviceIds
    },
    summaries: rows.map((item) => ({
      id: item.id,
      objectName: item.objectName,
      sumValue: item.sumValue,
      maxValue: item.maxValue,
      maxTime: item.maxTime,
      minValue: item.minValue,
      minTime: item.minTime,
      average: item.average,
      unit: item.unit
    })),
    series: rows.map((item) => ({
      id: item.id,
      name: item.objectName,
      unit: item.unit,
      points: item.points
    })),
    axisLabels,
    unit: asTrimmedString(rows[0]?.unit, ""),
    latestTimestamp: fetchedAt,
    sourceStatus: {
      key: "energyAnalysisCurve",
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? rows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

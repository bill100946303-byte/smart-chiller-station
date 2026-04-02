import { toIsoTimestamp } from "../lib/http.js";

const SNAPSHOT_TTL_MS = 5000;
const CONNECT_TIMEOUT_MS = 3500;
const snapshotCache = new Map();

function text(value) {
  return String(value ?? "").trim();
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function compact(value) {
  return text(value).toLowerCase().replace(/\s+/g, "");
}

function buildRealtimeWsUrl(baseUrl, projectKey, userId, template = "1") {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/accesslog/ws/${userId}&${projectKey}&${template}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildErrorStatus(endpoint, error) {
  return {
    endpoint,
    ok: false,
    status: null,
    message: null,
    error,
    rows: null
  };
}

function buildSuccessStatus(endpoint, rows, message = "Realtime snapshot received") {
  return {
    endpoint,
    ok: true,
    status: 101,
    message,
    error: null,
    rows
  };
}

function normalizeMetricRows(message) {
  if (Array.isArray(message?.rightdata) && message.rightdata.length > 0) {
    return message.rightdata;
  }
  if (Array.isArray(message?.data) && message.data.length > 0) {
    return message.data;
  }
  return [];
}

function normalizeCurveRows(message) {
  if (Array.isArray(message?.curve) && message.curve.length > 0) {
    return message.curve;
  }
  if (Array.isArray(message?.data) && message.data.length > 0 && Array.isArray(message.data[0]?.curveData)) {
    return message.data;
  }
  return [];
}

function findMetricValue(rows, matcher) {
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const key = compact(row.paramName || row.tagname || row.tagName || row.title || row.name);
    const paramType = String(row.paramType ?? row.tagType ?? "");
    if (!matcher({ key, paramType, row })) {
      continue;
    }
    const value =
      asNumber(row.tagvalue) ??
      asNumber(row.tagValue) ??
      asNumber(row.tagvalueRT) ??
      asNumber(row.value);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function deriveLatestTimestamp(rows, curveRows) {
  const timestamps = [];
  for (const row of rows) {
    const iso = toIsoTimestamp(row?.time || row?.createTime || row?.savetime || row?.updateTime);
    if (iso) {
      timestamps.push(iso);
    }
  }
  for (const curve of curveRows) {
    const points = Array.isArray(curve?.curveData) ? curve.curveData : [];
    for (const point of points) {
      const iso = toIsoTimestamp(point?.time || point?.name || point?.ts || point?.timestamp);
      if (iso) {
        timestamps.push(iso);
      }
    }
  }
  if (!timestamps.length) {
    return null;
  }
  return timestamps.sort().at(-1) || null;
}

function mapRealtimeOverview(message) {
  const rows = normalizeMetricRows(message);
  const curveRows = normalizeCurveRows(message);
  const totalCoolingCapacity = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("实时总冷量") ||
      key === compact("总冷量") ||
      key === compact("totalCoolingCapacity") ||
      paramType === "9"
  );
  const chillerPower = findMetricValue(rows, ({ key }) => key === compact("冷机总功率"));
  const coolingTowerPower = findMetricValue(rows, ({ key }) => key === compact("冷却塔总功率"));
  const chilledPumpPower = findMetricValue(rows, ({ key }) => key === compact("冷冻泵总功率"));
  const coolingPumpPower = findMetricValue(rows, ({ key }) => key === compact("冷却泵总功率"));
  const chillerCop = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("冷水机组COP") ||
      key === compact("主机COP") ||
      key === compact("chillerCop") ||
      paramType === "12"
  );
  const chilledPumpConveyingCoefficient = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("冷冻水泵COP") ||
      key === compact("冷冻泵输送系数") ||
      key === compact("chilledWaterPumpCop") ||
      paramType === "13"
  );
  const coolingTowerConveyingCoefficient = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("冷却塔COP") ||
      key === compact("冷却塔输送系数") ||
      key === compact("coolingTowerCop") ||
      paramType === "14"
  );
  const coolingPumpConveyingCoefficient = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("冷却水泵COP") ||
      key === compact("冷却泵输送系数") ||
      key === compact("coolingWaterPumpCop") ||
      paramType === "15"
  );
  const thermalUnbalanceRate = findMetricValue(
    rows,
    ({ key, paramType }) =>
      key === compact("热不平衡率") ||
      key === compact("thermalUnbalanceRate") ||
      paramType === "11"
  );
  const chilledSupplyTemp = findMetricValue(
    rows,
    ({ key }) =>
      key === compact("冷冻出水温度") || key === compact("coolingRturnWaterTemperature")
  );
  const coolingReturnTemp = findMetricValue(
    rows,
    ({ key }) =>
      key === compact("冷却回水温度") || key === compact("coolingWaterTemperature")
  );
  const realTimeTotalPower = findMetricValue(
    rows,
    ({ key, paramType }) => key === compact("实时总功率") || paramType === "16"
  );
  const currentCop = findMetricValue(
    rows,
    ({ key, paramType }) =>
      paramType === "10" || key === compact("冷站COP") || key === compact("coldStationCop")
  );
  const chilledDeltaT = findMetricValue(
    rows,
    ({ key, paramType }) =>
      paramType === "4" ||
      key === compact("冷冻水温差") ||
      key === compact("chilledWaterTemperatureDifference")
  );
  const coolingDeltaT = findMetricValue(
    rows,
    ({ key, paramType }) =>
      paramType === "5" ||
      key === compact("冷却水温差") ||
      key === compact("chilledOutWaterTemperatureDifference")
  );

  const powerParts = [chillerPower, coolingTowerPower, chilledPumpPower, coolingPumpPower].filter(
    (value) => typeof value === "number"
  );
  const totalPowerKw =
    realTimeTotalPower ??
    (powerParts.length > 0 ? powerParts.reduce((sum, value) => sum + value, 0) : null);

  return {
    metrics: {
      totalPowerKw,
      currentCop,
      totalElectricityKwh: null,
      totalCoolingCapacity,
      chilledDeltaT,
      coolingDeltaT,
      chillerPowerKw: chillerPower,
      chilledPumpPowerKw: chilledPumpPower,
      coolingPumpPowerKw: coolingPumpPower,
      coolingTowerPowerKw: coolingTowerPower,
      chillerCop,
      chilledPumpConveyingCoefficient,
      coolingTowerConveyingCoefficient,
      coolingPumpConveyingCoefficient,
      thermalUnbalanceRate,
      chilledSupplyTemp,
      coolingReturnTemp
    },
    latestTimestamp: deriveLatestTimestamp(rows, curveRows),
    rows
  };
}

function normalizeRealtimeMetric(title) {
  const key = compact(title);
  if (key === compact("冷冻水温差") || key === compact("chilledWaterTemperatureDifference")) {
    return "chilled_delta_t";
  }
  if (key === compact("冷却水温差") || key === compact("chilledOutWaterTemperatureDifference")) {
    return "cooling_delta_t";
  }
  if (key === compact("冷冻出水温度") || key === compact("coolingRturnWaterTemperature")) {
    return "chilled_supply_temp";
  }
  if (key === compact("冷却回水温度") || key === compact("coolingWaterTemperature")) {
    return "cooling_return_temp";
  }
  if (key === compact("热水供水温度") || key === compact("HotSupplyTemperature")) {
    return "hot_supply_temp";
  }
  if (key === compact("热水回水温度") || key === compact("HotReturnTemperature")) {
    return "hot_return_temp";
  }
  if (key === compact("热水温差") || key === compact("HotTemperatureDifference")) {
    return "hot_delta_t";
  }
  return key || "unknown_metric";
}

function mapRealtimeTrendSeries(message) {
  const curveRows = normalizeCurveRows(message);
  const series = curveRows
    .map((row) => {
      const label = text(row?.title || row?.tagname || row?.tagName || row?.name || row?.label);
      const points = Array.isArray(row?.curveData)
        ? row.curveData
            .map((point) => ({
              t: toIsoTimestamp(point?.time || point?.name || point?.ts || point?.timestamp),
              v: asNumber(point?.value ?? point?.tagvalue ?? point?.tagValue)
            }))
            .filter((point) => point.t && point.v !== null)
        : [];

      if (!label || points.length === 0) {
        return null;
      }

      return {
        metric: normalizeRealtimeMetric(label),
        label,
        points
      };
    })
    .filter(Boolean);

  return {
    series,
    latestTimestamp: deriveLatestTimestamp(normalizeMetricRows(message), curveRows)
  };
}

async function waitForRealtimeSnapshot(baseUrl, siteId, context) {
  const userId = text(context?.userId);
  const projectKey = text(context?.projectKey) || text(siteId);
  const template = text(context?.template) || "1";
  const endpoint = `/accesslog/ws/${userId}&${projectKey}&${template}`;

  if (!userId) {
    return {
      overview: null,
      trends: null,
      sourceStatus: buildErrorStatus(endpoint, "Missing realtime userId")
    };
  }
  if (typeof WebSocket !== "function") {
    return {
      overview: null,
      trends: null,
      sourceStatus: buildErrorStatus(endpoint, "WebSocket client unavailable in current runtime")
    };
  }

  const socketUrl = buildRealtimeWsUrl(baseUrl, projectKey, userId, template);

  try {
    const snapshot = await new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(socketUrl);
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            socket.close();
          } catch (_error) {
            // ignore close race
          }
          reject(new Error("Realtime homepage snapshot timeout"));
        }
      }, CONNECT_TIMEOUT_MS);

      function finish(handler, payload) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        try {
          socket.close();
        } catch (_error) {
          // ignore close race
        }
        handler(payload);
      }

      socket.addEventListener("open", () => {
        try {
          socket.send(
            JSON.stringify({
              msgType: "curveChange",
              userId,
              template
            })
          );
        } catch (_error) {
          // best effort; some backends push initial data without an explicit request
        }
      });

      socket.addEventListener("message", (event) => {
        if (event.data === "pong") {
          return;
        }
        let payload;
        try {
          payload = JSON.parse(String(event.data || ""));
        } catch (_error) {
          return;
        }
        const type = text(payload?.type);
        if (!["homePageData", "homePageCurveChange", "homePageHotCurveChange"].includes(type)) {
          return;
        }
        finish(resolve, payload);
      });

      socket.addEventListener("error", () => {
        finish(reject, new Error("Realtime homepage websocket failed"));
      });
    });

    const overview = mapRealtimeOverview(snapshot);
    const trends = mapRealtimeTrendSeries(snapshot);
    return {
      overview,
      trends,
      sourceStatus: buildSuccessStatus(
        endpoint,
        normalizeMetricRows(snapshot).length + normalizeCurveRows(snapshot).length,
        `Realtime fallback via ${text(snapshot?.type) || "unknown"}`
      )
    };
  } catch (error) {
    return {
      overview: null,
      trends: null,
      sourceStatus: buildErrorStatus(endpoint, String(error))
    };
  }
}

export async function loadRealtimeHomepageSnapshot(baseUrl, siteId, context) {
  const userId = text(context?.userId);
  const template = text(context?.template) || "1";
  const cacheKey = `${baseUrl}::${siteId}::${userId}::${template}`;
  const now = Date.now();
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = waitForRealtimeSnapshot(baseUrl, siteId, context).finally(() => {
    const entry = snapshotCache.get(cacheKey);
    if (entry && entry.promise === promise && entry.expiresAt <= Date.now()) {
      snapshotCache.delete(cacheKey);
    }
  });
  snapshotCache.set(cacheKey, {
    promise,
    expiresAt: now + SNAPSHOT_TTL_MS
  });
  return promise;
}

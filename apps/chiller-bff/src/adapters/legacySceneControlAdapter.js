import { deepArrayProbe, fetchLegacyJson, toIsoTimestamp } from "../lib/http.js";

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function asNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function normalizeCurvePoints(rows) {
  return rows
    .map((row, index) => {
      const label = asTrimmedString(
        row?.name ?? row?.time ?? row?.createTime ?? row?.savetime ?? row?.updateTime,
        `#${index + 1}`
      );
      const timestamp = toIsoTimestamp(
        row?.time ?? row?.name ?? row?.createTime ?? row?.savetime ?? row?.updateTime
      );
      const value = asNullableNumber(
        row?.value ?? row?.tagValue ?? row?.tagvalue ?? row?.metricValue ?? row?.val
      );
      return {
        label,
        timestamp,
        value,
        _index: index
      };
    })
    .filter((item) => item.value !== null)
    .sort((a, b) => {
      const at = a.timestamp ? Date.parse(a.timestamp) : Number.NaN;
      const bt = b.timestamp ? Date.parse(b.timestamp) : Number.NaN;
      if (Number.isFinite(at) && Number.isFinite(bt)) {
        return at - bt;
      }
      return a._index - b._index;
    })
    .map(({ _index, ...item }) => item);
}

function buildSceneLegacyTrendEndpoint(siteId, options) {
  const search = new URLSearchParams();
  if (options?.title) {
    search.set("title", options.title);
  }
  if (options?.tagname) {
    search.set("tagname", options.tagname);
  }
  if (options?.date) {
    search.set("date", options.date);
  }
  const suffix = search.toString();
  return `/zsqy/homepage/${siteId}/getRunParamsCurveByTagName${suffix ? `?${suffix}` : ""}`;
}

function buildSceneOnlineMonitorEndpoint(siteId) {
  return `/zsqy/monitor/${siteId}/getData`;
}

function findLatestTimestamp(points) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]?.timestamp) {
      return points[index].timestamp;
    }
  }
  return null;
}

function extractOnlineRoot(payload) {
  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload && typeof payload === "object" ? payload : {};
}

export async function loadSceneLegacyTrend(baseUrl, siteId, options = {}) {
  const endpoint = buildSceneLegacyTrendEndpoint(siteId, options);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const rows = response.ok ? deepArrayProbe(response.payload) : [];
  const points = response.ok ? normalizeCurvePoints(rows) : [];
  const firstRow = rows.find((row) => row && typeof row === "object") || null;

  return {
    title: asTrimmedString(options.title || firstRow?.tagName || firstRow?.title || firstRow?.name, ""),
    unit: asTrimmedString(options.unit || firstRow?.unit || firstRow?.units, null),
    filters: {
      tagname: asTrimmedString(options.tagname, ""),
      title: asTrimmedString(options.title, ""),
      date: asTrimmedString(options.date, "")
    },
    points,
    latestTimestamp: findLatestTimestamp(points),
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      error: response.ok ? null : response.error,
      rows: rows.length
    }
  };
}

export async function loadSceneOnlineMonitor(baseUrl, siteId) {
  const endpoint = buildSceneOnlineMonitorEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const root = response.ok ? extractOnlineRoot(response.payload) : {};
  const rows = response.ok
    ? deepArrayProbe(root?.curveValueList ? { data: root.curveValueList } : root)
    : [];
  const points = response.ok ? normalizeCurvePoints(rows) : [];

  return {
    title: asTrimmedString(root?.title, ""),
    unit: asTrimmedString(root?.unit, ""),
    points,
    latestTimestamp: findLatestTimestamp(points),
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      error: response.ok ? null : response.error,
      rows: rows.length
    }
  };
}

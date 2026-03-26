import { deepArrayProbe, fetchLegacyJson, toIsoTimestamp } from "../lib/http.js";

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function guessSeverity(item) {
  const raw = String(item?.alarmlevel || item?.alarmLevel || item?.level || item?.severity || "").toLowerCase();
  if (raw.includes("critical") || raw.includes("high") || raw === "3" || raw === "4") {
    return "critical";
  }
  if (raw.includes("major") || raw.includes("medium") || raw === "2") {
    return "major";
  }
  if (raw.includes("normal") || raw === "0") {
    return "normal";
  }
  return "minor";
}

function normalizeAlarmRow(row, index) {
  return {
    id: String(row?.id || row?.alarmid || row?.alarmId || `evt-${index + 1}`),
    title: String(row?.alarmnote || row?.msg || row?.alarmname || "Alarm event"),
    severity: guessSeverity(row),
    state:
      row?.alarmstate == null && row?.state == null && row?.status == null
        ? null
        : String(row?.alarmstate || row?.state || row?.status || "").trim() || null,
    occurredAt: toIsoTimestamp(row?.alarmtime || row?.createTime || row?.time),
    source: String(row?.drname || row?.deviceName || row?.subName || "Unknown"),
    regId:
      row?.regid == null && row?.regId == null ? null : String(row?.regid || row?.regId || ""),
    value:
      row?.alarmvalue == null && row?.value == null && row?.tagValue == null
        ? null
        : String(row?.alarmvalue || row?.value || row?.tagValue || "")
  };
}

export async function loadAlarmSummary(baseUrl, siteId) {
  const fetchedAt = new Date().toISOString();
  const endpoints = [
    `/${siteId}/getAllSubsystemInfo`,
    `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`
  ];

  const [systemRes, latestAlarmRes] = await Promise.all(
    endpoints.map((path) => fetchLegacyJson(baseUrl, path))
  );

  const sourceStatus = [
    {
      endpoint: endpoints[0],
      ok: systemRes.ok,
      status: systemRes.status ?? null,
      message: systemRes.ok ? extractMessage(systemRes.payload, "OK") : null,
      rows: systemRes.ok ? deepArrayProbe(systemRes.payload).length : null,
      error: systemRes.ok ? null : systemRes.error
    },
    {
      endpoint: endpoints[1],
      ok: latestAlarmRes.ok,
      status: latestAlarmRes.status ?? null,
      message: latestAlarmRes.ok ? extractMessage(latestAlarmRes.payload, "OK") : null,
      rows: latestAlarmRes.ok ? deepArrayProbe(latestAlarmRes.payload).length : null,
      error: latestAlarmRes.ok ? null : latestAlarmRes.error
    }
  ];

  const latestEvents = latestAlarmRes.ok
    ? deepArrayProbe(latestAlarmRes.payload).slice(0, 10).map(normalizeAlarmRow)
    : [];

  const critical = latestEvents.filter((e) => e.severity === "critical").length;
  const major = latestEvents.filter((e) => e.severity === "major").length;
  const minor = latestEvents.filter((e) => e.severity === "minor").length;
  const normal = latestEvents.filter((e) => e.severity === "normal").length;

  const latestEventTimestamp = latestEvents.find((e) => e.occurredAt)?.occurredAt || null;
  const latestTimestamp =
    systemRes.ok || latestAlarmRes.ok ? fetchedAt : latestEventTimestamp;

  return {
    sourceStatus,
    counts: {
      total: latestEvents.length,
      critical,
      major,
      minor,
      normal
    },
    latestEvents,
    latestEventTimestamp,
    latestTimestamp
  };
}

export async function loadAlarmList(baseUrl, siteId, options = {}) {
  const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
  const pageSize = Number.isFinite(Number(options.pageSize))
    ? Math.max(1, Number(options.pageSize))
    : 20;
  const severityFilter =
    typeof options.severity === "string" && options.severity.trim() ? options.severity.trim() : "";
  const stateFilter =
    typeof options.state === "string" && options.state.trim() ? options.state.trim() : "";
  const endpoint = `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`;
  const response = await fetchLegacyJson(baseUrl, endpoint);

  const rows = response.ok ? deepArrayProbe(response.payload).map(normalizeAlarmRow) : [];
  const filteredRows = rows.filter((row) => {
    if (severityFilter && row.severity !== severityFilter) {
      return false;
    }
    if (stateFilter && String(row.state || "").toLowerCase() !== stateFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const offset = (page - 1) * pageSize;
  const items = filteredRows.slice(offset, offset + pageSize);
  const latestTimestamp = items.find((row) => row.occurredAt)?.occurredAt || new Date().toISOString();

  return {
    items,
    total: filteredRows.length,
    page,
    pageSize,
    latestTimestamp,
    filters: {
      severity: severityFilter || null,
      state: stateFilter || null
    },
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? filteredRows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

import { deepArrayProbe, fetchLegacyJson, toIsoTimestamp } from "../lib/http.js";

const ALARM_REG_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const alarmRegCatalogCache = new Map();
const ALARM_STABLE_TOTAL_CACHE_TTL_MS = 20 * 1000;
const alarmStableTotalCache = new Map();

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

function buildIdentifierProbeSummary(attempts = []) {
  return attempts
    .map((attempt) => {
      if (attempt?.usable) {
        return `${attempt.identifier}:rows=${attempt.rows ?? 0}`;
      }
      return `${attempt?.identifier || "unknown"}:failed`;
    })
    .join(",");
}

async function fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, endpointBuilder) {
  const orderedIdentifiers = Array.isArray(identifiers) ? identifiers.filter(Boolean) : [];
  if (orderedIdentifiers.length === 0) {
    return {
      attempts: [],
      selected: null
    };
  }

  const attempts = [];
  const probeIdentifier = async (identifier) => {
    const endpoint = endpointBuilder(identifier);
    const result = await fetchLegacyJson(baseUrl, endpoint);
    const usable = isLegacyResponseUsable(result);
    const rows = usable ? deepArrayProbe(result.payload).length : null;
    return {
      identifier,
      endpoint,
      result,
      rows,
      usable
    };
  };

  const firstAttempt = await probeIdentifier(orderedIdentifiers[0]);
  attempts.push(firstAttempt);
  if (firstAttempt.usable && typeof firstAttempt.rows === "number" && firstAttempt.rows > 0) {
    return {
      attempts,
      selected: firstAttempt
    };
  }

  for (const identifier of orderedIdentifiers.slice(1)) {
    const attempt = await probeIdentifier(identifier);
    attempts.push(attempt);
    if (attempt.usable && typeof attempt.rows === "number" && attempt.rows > 0) {
      return {
        attempts,
        selected: attempt
      };
    }
  }

  const firstUsableWithRows = attempts.find(
    (attempt) => attempt?.usable && typeof attempt.rows === "number" && attempt.rows > 0
  );
  const firstUsable = attempts.find((attempt) => attempt?.usable);

  return {
    attempts,
    selected: firstUsableWithRows || firstUsable || null
  };
}

function normalizeSourceStatus(endpoint, response) {
  const payloadOk = response.ok && !isLegacyPayloadFailed(response.payload);
  return {
    endpoint,
    ok: payloadOk,
    status: response.status ?? null,
    message: extractMessage(response.payload, payloadOk ? "OK" : null),
    rows: payloadOk ? deepArrayProbe(response.payload).length : null,
    error: payloadOk ? null : response.error || extractMessage(response.payload, "Legacy request failed")
  };
}

function toProbeSourceStatus(lookup, fallbackEndpoint) {
  const attempts = Array.isArray(lookup?.attempts) ? lookup.attempts : [];
  const selected = lookup?.selected;
  const probeSummary = buildIdentifierProbeSummary(attempts);
  const probeSuffix =
    attempts.length > 1 && probeSummary
      ? `; identifierProbe=${probeSummary}; selected=${selected?.identifier || "none"}`
      : "";

  if (selected?.usable) {
    const normalized = normalizeSourceStatus(selected.endpoint, selected.result);
    return {
      ...normalized,
      message: `${normalized.message || "OK"}${probeSuffix}`,
      rows: typeof selected.rows === "number" ? selected.rows : normalized.rows
    };
  }

  const failedAttempt = attempts.at(-1);
  const normalized = failedAttempt
    ? normalizeSourceStatus(failedAttempt.endpoint, failedAttempt.result)
    : normalizeSourceStatus(fallbackEndpoint, {
        ok: false,
        status: null,
        error: "Legacy request failed",
        payload: null
      });

  return {
    ...normalized,
    message: normalized.message ? `${normalized.message}${probeSuffix}` : probeSuffix ? `probe-failed${probeSuffix}` : null
  };
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

function normalizeAlarmText(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function isGenericAlarmTitle(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "alarm event" || normalized === "alarmevent" || normalized === "event";
}

function isGenericAlarmSource(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "unknown" || normalized === "unknown source";
}

function pickAlarmText(candidates, isPlaceholder) {
  for (const candidate of candidates) {
    const normalized = normalizeAlarmText(candidate);
    if (!normalized) {
      continue;
    }
    if (typeof isPlaceholder === "function" && isPlaceholder(normalized)) {
      continue;
    }
    return normalized;
  }
  return null;
}

function asArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function toPositiveQueryNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizeDeviceDataQuery(options = {}) {
  const query = options?.defaultDeviceQuery && typeof options.defaultDeviceQuery === "object"
    ? options.defaultDeviceQuery
    : options;
  return {
    build: toPositiveQueryNumber(query?.build),
    floor: toPositiveQueryNumber(query?.floor),
    mock:
      typeof query?.mock === "boolean"
        ? query.mock
        : query?.mock == null
          ? null
          : String(query.mock).trim() === "1" || String(query.mock).trim().toLowerCase() === "true"
  };
}

function buildAlarmRegCatalogEndpoint(projectKey, options = {}) {
  const endpointKind = asTrimmedString(options?.deviceDataEndpointKind || options?.endpointKind);
  const normalizedProjectKey = asTrimmedString(projectKey);
  if (!normalizedProjectKey) {
    return null;
  }

  const query = new URLSearchParams();
  const deviceQuery = normalizeDeviceDataQuery(options);
  if (deviceQuery.build !== null) {
    query.set("build", String(deviceQuery.build));
  }
  if (deviceQuery.floor !== null) {
    query.set("floor", String(deviceQuery.floor));
  }

  if (endpointKind === "api-device-data") {
    if (deviceQuery.mock === true) {
      query.set("mock", "1");
    } else if (deviceQuery.mock === false) {
      query.set("mock", "0");
    }
    const search = query.toString();
    return `/api/device/${normalizedProjectKey}/data${search ? `?${search}` : ""}`;
  }

  if (!endpointKind || endpointKind === "legacy-reg-findAllByDrTypeId") {
    const search = query.toString();
    return `/zsqy/reg/${normalizedProjectKey}/findAllByDrTypeId${search ? `?${search}` : ""}`;
  }

  return null;
}

function getRealtimeCollectionRows(payload) {
  const data = payload?.data;
  return asArray(data).filter((item) => item && typeof item === "object");
}

function getRealtimeRegRows(deviceRow) {
  const raw = deviceRow?.reglist;
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const directChildren = asArray(raw?.reglist);
  if (directChildren.length > 0) {
    return directChildren.filter((item) => item && typeof item === "object");
  }
  return deepArrayProbe(raw).filter((item) => item && typeof item === "object" && item.regId != null);
}

function pickAlarmMetadataTitle(metadata) {
  return pickAlarmText([metadata?.regName, metadata?.tagName], null);
}

function pickAlarmMetadataSource(metadata) {
  return pickAlarmText([metadata?.deviceName, metadata?.deviceTypeName, metadata?.tagName], isGenericAlarmSource);
}

function buildAlarmRegCatalogFromPayload(payload) {
  const catalog = new Map();
  const deviceRows = getRealtimeCollectionRows(payload);

  deviceRows.forEach((deviceRow) => {
    const deviceName = pickAlarmText(
      [deviceRow?.drnameCNEN, deviceRow?.drname, deviceRow?.drUseExplain, deviceRow?.drcode],
      isGenericAlarmSource
    );
    const deviceTypeName = pickAlarmText(
      [deviceRow?.drtypenameCNEN, deviceRow?.drtypename, deviceRow?.drtypenameEN],
      null
    );
    const regRows = getRealtimeRegRows(deviceRow);

    regRows.forEach((regRow) => {
      const regId = normalizeAlarmText(regRow?.regId);
      if (!regId) {
        return;
      }

      const nextMetadata = {
        regName: pickAlarmText([regRow?.regNameCNEN, regRow?.regName, regRow?.regNameEN], null),
        tagName: pickAlarmText([regRow?.tagName], null),
        deviceName,
        deviceTypeName,
        drId: normalizeAlarmText(regRow?.drId || deviceRow?.drid),
        deviceCode: pickAlarmText([deviceRow?.drcode], null)
      };
      const previous = catalog.get(regId) || null;
      const previousScore =
        Number(Boolean(previous?.regName)) * 4 +
        Number(Boolean(previous?.deviceName)) * 3 +
        Number(Boolean(previous?.deviceTypeName)) * 2 +
        Number(Boolean(previous?.tagName));
      const nextScore =
        Number(Boolean(nextMetadata.regName)) * 4 +
        Number(Boolean(nextMetadata.deviceName)) * 3 +
        Number(Boolean(nextMetadata.deviceTypeName)) * 2 +
        Number(Boolean(nextMetadata.tagName));

      if (!previous || nextScore >= previousScore) {
        catalog.set(regId, nextMetadata);
      }
    });
  });

  return catalog;
}

async function loadAlarmRegCatalog(baseUrl, options = {}) {
  const projectKey = asTrimmedString(options?.deviceDataProjectKey || options?.projectKey);
  const endpoint = buildAlarmRegCatalogEndpoint(projectKey, options);
  if (!projectKey || !endpoint) {
    return new Map();
  }

  const cacheKey = JSON.stringify({
    baseUrl,
    endpoint,
    projectKey
  });
  const cached = alarmRegCatalogCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.catalog instanceof Map) {
    return cached.catalog;
  }

  try {
    const response = await fetchLegacyJson(baseUrl, endpoint);
    if (!response.ok) {
      return cached?.catalog instanceof Map ? cached.catalog : new Map();
    }
    const catalog = buildAlarmRegCatalogFromPayload(response.payload);
    alarmRegCatalogCache.set(cacheKey, {
      expiresAt: Date.now() + ALARM_REG_CATALOG_CACHE_TTL_MS,
      catalog
    });
    return catalog;
  } catch (_error) {
    return cached?.catalog instanceof Map ? cached.catalog : new Map();
  }
}

function enrichAlarmRow(row, regCatalog) {
  if (!row || !(regCatalog instanceof Map) || regCatalog.size === 0 || !row.regId) {
    return row;
  }
  const metadata = regCatalog.get(String(row.regId));
  if (!metadata) {
    return row;
  }

  return {
    ...row,
    title: row.title || pickAlarmMetadataTitle(metadata) || row.title,
    source: row.source || pickAlarmMetadataSource(metadata) || row.source
  };
}

function normalizeAlarmRow(row, index) {
  const drName = pickAlarmText([row?.drname, row?.drName, row?.deviceName, row?.subName], isGenericAlarmSource);
  const drTypeName = pickAlarmText(
    [row?.drtypename, row?.drTypeName, row?.drtypenameEN, row?.deviceTypeName, row?.subTypeName],
    null
  );
  const source = drName && drTypeName ? `${drTypeName}-${drName}` : drTypeName || drName || null;
  const alarmLevel = pickAlarmText([row?.alarmlevel, row?.alarmLevel, row?.level, row?.severity], null);
  const alarmTypeName = pickAlarmText([row?.alarmtypename, row?.alarmTypeName, row?.alarmtypenameEN], null);
  const alarmExplain = pickAlarmText(
    [row?.alarmexplain, row?.alarmExplain, row?.alarmcontent, row?.alarmContent],
    null
  );
  const title = pickAlarmText(
    [row?.regname, row?.regName, row?.alarmname, row?.alarmnote, row?.msg],
    isGenericAlarmTitle
  );

  return {
    id: String(row?.id || row?.alarmid || row?.alarmId || `evt-${index + 1}`),
    title,
    severity: guessSeverity(row),
    alarmLevel,
    alarmTypeName,
    state: (() => {
      const rawState = row?.alarmstate ?? row?.state ?? row?.status;
      return rawState == null ? null : String(rawState).trim() || null;
    })(),
    occurredAt: toIsoTimestamp(row?.alarmtime || row?.createTime || row?.time),
    source,
    alarmExplain,
    regId:
      row?.regid == null && row?.regId == null ? null : String(row?.regid || row?.regId || ""),
    value:
      row?.alarmvalue == null && row?.value == null && row?.tagValue == null
        ? null
        : String(row?.alarmvalue || row?.value || row?.tagValue || "")
  };
}

function buildSubsystemSummaryEndpoint(identifier) {
  return `/${identifier}/getAllSubsystemInfo`;
}

function buildLatestAlarmEndpoint(identifier) {
  return `/zsqy/qsAlarmlog/${identifier}/findNewAlarmLog`;
}

function mapSeverityToLegacyAlarmTypeLevel(value) {
  const normalized = asTrimmedString(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "0" || normalized === "1" || normalized === "2" || normalized === "3") {
    return normalized;
  }
  if (normalized === "noalarm" || normalized === "no_alarm" || normalized === "no-alarm") {
    return "0";
  }
  if (normalized === "critical") {
    return "3";
  }
  if (normalized === "major") {
    return "2";
  }
  if (normalized === "minor") {
    return "1";
  }
  if (normalized === "normal") {
    return "0";
  }
  return "";
}

function normalizeAlarmLevelFilterValue(value) {
  return mapSeverityToLegacyAlarmTypeLevel(value);
}

async function recoverRowsForClientPaging(baseUrl, identifier, options, fallbackRows, fallbackTotal) {
  const requestedPageSize = Number.isFinite(Number(options?.pageSize))
    ? Math.max(1, Number(options.pageSize))
    : 20;
  const totalHint = Number.isFinite(Number(fallbackTotal)) ? Math.max(0, Number(fallbackTotal)) : 0;
  const targetPageSize = Math.min(200, Math.max(totalHint, requestedPageSize, 20));
  const endpointBuilder =
    typeof options?.endpointBuilder === "function"
      ? options.endpointBuilder
      : buildHistoryAlarmListEndpoint;
  const endpoint = endpointBuilder(identifier, {
    ...options,
    page: 1,
    pageSize: targetPageSize,
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier))
  });
  const recovered = await fetchLegacyJson(baseUrl, endpoint);
  if (!isLegacyResponseUsable(recovered)) {
    return {
      rows: Array.isArray(fallbackRows) ? fallbackRows : [],
      total: Number.isFinite(Number(fallbackTotal)) ? Math.max(0, Number(fallbackTotal)) : 0
    };
  }

  const rows = extractAlarmListRows(recovered.payload);
  const total = extractAlarmListTotal(recovered.payload, rows.length);

  return {
    rows,
    total
  };
}

function buildStableTotalCacheKey(scope, baseUrl, identifier, options = {}) {
  const alarmTypeLevel =
    asTrimmedString(options.alarmtypelevel) ||
    mapSeverityToLegacyAlarmTypeLevel(options.severity);
  const parts = [
    scope,
    asTrimmedString(baseUrl),
    asTrimmedString(identifier),
    asTrimmedString(options.state),
    alarmTypeLevel,
    asTrimmedString(options.drTypeId || options.drtypeid, "0"),
    asTrimmedString(options.startTime || options.starttime),
    asTrimmedString(options.endTime || options.endtime),
    asTrimmedString(options.language, "zh"),
    asTrimmedString(options.unit, "KW"),
    asTrimmedString(options.modelKey, asTrimmedString(identifier)),
    asTrimmedString(options.template, "1")
  ];
  return JSON.stringify(parts);
}

async function fetchStableAlarmTotal(baseUrl, identifier, options, endpointBuilder, scope, fallbackTotal = 0) {
  const cacheKey = buildStableTotalCacheKey(scope, baseUrl, identifier, options);
  const cached = alarmStableTotalCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && Number.isFinite(Number(cached.total))) {
    return Math.max(0, Math.floor(Number(cached.total)));
  }

  const endpoint = endpointBuilder(identifier, {
    ...options,
    page: 1,
    pageSize: 20,
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier))
  });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  if (!isLegacyResponseUsable(response)) {
    return Number.isFinite(Number(fallbackTotal)) ? Math.max(0, Math.floor(Number(fallbackTotal))) : 0;
  }

  const rows = extractAlarmListRows(response.payload);
  const total = extractAlarmListTotal(response.payload, rows.length);
  const normalizedTotal = Number.isFinite(Number(total)) ? Math.max(0, Math.floor(Number(total))) : rows.length;

  alarmStableTotalCache.set(cacheKey, {
    expiresAt: Date.now() + ALARM_STABLE_TOTAL_CACHE_TTL_MS,
    total: normalizedTotal
  });

  return normalizedTotal;
}

function buildRealtimeAlarmListEndpoint(identifier, options = {}) {
  const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
  const pageSize = Number.isFinite(Number(options.pageSize)) ? Math.max(1, Number(options.pageSize)) : 20;
  const alarmState = asTrimmedString(options.state);
  const alarmTypeLevel =
    asTrimmedString(options.alarmtypelevel) ||
    mapSeverityToLegacyAlarmTypeLevel(options.severity);
  const drTypeId = asTrimmedString(options.drTypeId || options.drtypeid, "0");
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = asTrimmedString(options.modelKey, asTrimmedString(identifier));
  const template = asTrimmedString(options.template, "1");
  const query = new URLSearchParams();
  query.set("pageCurrent", String(Math.max(1, page)));
  query.set("pageSize", String(pageSize));
  query.set("alarmstate", alarmState);
  query.set("alarmtypelevel", alarmTypeLevel);
  query.set("drtypeid", drTypeId);
  query.set("language", language);
  query.set("unit", unit);
  query.set("modelKey", modelKey);
  query.set("template", template);
  return `/zsqy/qsAlarmlog/${identifier}/findAlarm?${query.toString()}`;
}

function buildHistoryAlarmListEndpoint(identifier, options = {}) {
  const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
  const pageSize = Number.isFinite(Number(options.pageSize)) ? Math.max(1, Number(options.pageSize)) : 20;
  const alarmState = asTrimmedString(options.state);
  const alarmTypeLevel =
    asTrimmedString(options.alarmtypelevel) ||
    mapSeverityToLegacyAlarmTypeLevel(options.severity);
  const drTypeId = asTrimmedString(options.drTypeId || options.drtypeid, "0");
  const startTime = asTrimmedString(options.startTime || options.starttime);
  const endTime = asTrimmedString(options.endTime || options.endtime);
  const language = asTrimmedString(options.language, "zh");
  const unit = asTrimmedString(options.unit, "KW");
  const modelKey = asTrimmedString(options.modelKey, asTrimmedString(identifier));
  const template = asTrimmedString(options.template, "1");
  const query = new URLSearchParams();
  query.set("pageCurrent", String(Math.max(1, page)));
  query.set("pageSize", String(pageSize));
  query.set("alarmstate", alarmState);
  query.set("alarmtypelevel", alarmTypeLevel);
  query.set("drtypeid", drTypeId);
  query.set("startTime", startTime);
  query.set("endTime", endTime);
  query.set("language", language);
  query.set("unit", unit);
  query.set("modelKey", modelKey);
  query.set("template", template);
  return `/zsqy/qsAlarmlog/${identifier}/findObject?${query.toString()}`;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractAlarmListRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  const candidates = [
    data?.records,
    data?.rows,
    data?.list,
    data?.data,
    payload?.records,
    payload?.rows,
    payload?.list,
    payload?.data
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return deepArrayProbe(payload);
}

function extractAlarmListTotal(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  const totalCandidates = [
    data?.rowCount,
    data?.totalCount,
    data?.total,
    data?.count,
    payload?.rowCount,
    payload?.totalCount,
    payload?.total,
    payload?.count
  ];
  for (const candidate of totalCandidates) {
    const numeric = toFiniteNumber(candidate);
    if (numeric !== null) {
      return Math.max(0, Math.floor(numeric));
    }
  }
  return fallback;
}

function extractAlarmListPage(payload, fallback = 1) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  const pageCurrentCandidates = [data?.pageCurrent, payload?.pageCurrent];
  for (const candidate of pageCurrentCandidates) {
    const numeric = toFiniteNumber(candidate);
    if (numeric !== null) {
      return Math.max(1, Math.floor(numeric));
    }
  }
  return fallback;
}

function extractAlarmListPageSize(payload, fallback = 20) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  const pageSizeCandidates = [data?.pageSize, payload?.pageSize];
  for (const candidate of pageSizeCandidates) {
    const numeric = toFiniteNumber(candidate);
    if (numeric !== null && numeric > 0) {
      return Math.floor(numeric);
    }
  }
  return fallback;
}

function hasServerPagedAlarmPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  return [
    data?.rowCount,
    data?.totalCount,
    data?.total,
    data?.count,
    payload?.rowCount,
    payload?.totalCount,
    payload?.total,
    payload?.count,
    data?.pageCurrent,
    payload?.pageCurrent
  ].some((value) => value != null);
}

function extractRowsFromLookup(lookup) {
  if (!lookup?.selected?.usable) {
    return [];
  }
  return deepArrayProbe(lookup.selected.result.payload);
}

function extractAlarmListRowsFromLookup(lookup) {
  if (!lookup?.selected?.usable) {
    return [];
  }
  const payload = lookup?.selected?.result?.payload;
  const rows = extractAlarmListRows(payload);
  return rows.length > 0 ? rows : extractRowsFromLookup(lookup);
}

export async function loadAlarmSummary(baseUrl, siteId, options = {}) {
  const fetchedAt = new Date().toISOString();
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const summaryEventLimit = Number.isFinite(Number(options.summaryEventLimit))
    ? Math.max(1, Number(options.summaryEventLimit))
    : 20;
  const realtimeEndpointBuilder = (identifier) =>
    buildRealtimeAlarmListEndpoint(identifier, {
      ...options,
      page: 1,
      pageSize: summaryEventLimit,
      modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier))
    });
  const realtimeFallbackEndpoint = buildRealtimeAlarmListEndpoint(siteId, {
    ...options,
    page: 1,
    pageSize: summaryEventLimit,
    modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, siteId))
  });

  const [systemLookup, realtimeLookup, regCatalog] = await Promise.all([
    fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, buildSubsystemSummaryEndpoint),
    fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, realtimeEndpointBuilder),
    loadAlarmRegCatalog(baseUrl, options)
  ]);

  const sourceStatus = [
    toProbeSourceStatus(systemLookup, buildSubsystemSummaryEndpoint(siteId)),
    toProbeSourceStatus(realtimeLookup, realtimeFallbackEndpoint)
  ];

  const latestEvents = sourceStatus[1].ok
    ? extractAlarmListRowsFromLookup(realtimeLookup)
        .map(normalizeAlarmRow)
        .map((row) => enrichAlarmRow(row, regCatalog))
    : [];

  const critical = latestEvents.filter((e) => e.severity === "critical").length;
  const major = latestEvents.filter((e) => e.severity === "major").length;
  const minor = latestEvents.filter((e) => e.severity === "minor").length;
  const normal = latestEvents.filter((e) => e.severity === "normal").length;

  const latestEventTimestamp = latestEvents.find((e) => e.occurredAt)?.occurredAt || null;
  const latestTimestamp = sourceStatus.some((source) => source.ok) ? fetchedAt : latestEventTimestamp;

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
  const alarmLevelFilter = normalizeAlarmLevelFilterValue(severityFilter);
  const stateFilter =
    typeof options.state === "string" && options.state.trim() ? options.state.trim() : "";
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  const pagedEndpointBuilder = (identifier) =>
    buildHistoryAlarmListEndpoint(identifier, {
      ...options,
      page,
      pageSize,
      severity: severityFilter,
      state: stateFilter,
      modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier))
    });
  const fallbackEndpoint = buildHistoryAlarmListEndpoint(siteId, {
    ...options,
    page,
      pageSize,
      severity: severityFilter,
      state: stateFilter,
      modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, siteId))
  });
  const [pagedLookup, regCatalog] = await Promise.all([
    fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, pagedEndpointBuilder),
    loadAlarmRegCatalog(baseUrl, options)
  ]);

  let lookup = pagedLookup;
  let sourceStatus = toProbeSourceStatus(pagedLookup, fallbackEndpoint);
  let serverPaged = false;
  let forceClientPaging = false;
  let rows = [];
  let total = 0;
  let resolvedPage = page;
  let resolvedPageSize = pageSize;

  if (sourceStatus.ok) {
    const selectedPayload = lookup?.selected?.result?.payload;
    serverPaged = hasServerPagedAlarmPayload(selectedPayload);
    let rawRows = extractAlarmListRows(selectedPayload);
    total = extractAlarmListTotal(selectedPayload, rawRows.length);
    resolvedPage = extractAlarmListPage(selectedPayload, page);
    resolvedPageSize = extractAlarmListPageSize(selectedPayload, pageSize);
    const selectedIdentifier = lookup?.selected?.identifier || siteId;

    if (serverPaged) {
      total = await fetchStableAlarmTotal(
        baseUrl,
        selectedIdentifier,
        {
            ...options,
            severity: severityFilter,
            state: stateFilter,
            modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, selectedIdentifier))
          },
          buildHistoryAlarmListEndpoint,
          "history",
        total
      );
    }

    const shouldRecoverClientPaging =
      serverPaged && (resolvedPage !== page || resolvedPageSize !== pageSize);
    if (shouldRecoverClientPaging) {
      const recovered = await recoverRowsForClientPaging(
        baseUrl,
        selectedIdentifier,
        {
          ...options,
          severity: severityFilter,
          state: stateFilter,
          endpointBuilder: buildHistoryAlarmListEndpoint
        },
        rawRows,
        total
      );
      rawRows = recovered.rows;
      total = recovered.total;
      resolvedPage = page;
      resolvedPageSize = pageSize;
      forceClientPaging = true;
    }

    rows = rawRows.map(normalizeAlarmRow).map((row) => enrichAlarmRow(row, regCatalog));
  } else {
    const realtimeEndpointBuilder = (identifier) =>
      buildRealtimeAlarmListEndpoint(identifier, {
        ...options,
        page,
        pageSize,
        severity: severityFilter,
        state: stateFilter,
        modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, identifier))
      });
    const realtimeFallbackEndpoint = buildRealtimeAlarmListEndpoint(siteId, {
      ...options,
      page,
      pageSize,
      severity: severityFilter,
      state: stateFilter,
      modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, siteId))
    });
    const realtimeLookup = await fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, realtimeEndpointBuilder);
    lookup = realtimeLookup;
    sourceStatus = toProbeSourceStatus(realtimeLookup, realtimeFallbackEndpoint);

    if (sourceStatus.ok) {
      const selectedPayload = lookup?.selected?.result?.payload;
      serverPaged = hasServerPagedAlarmPayload(selectedPayload);
      let rawRows = extractAlarmListRows(selectedPayload);
      total = extractAlarmListTotal(selectedPayload, rawRows.length);
      resolvedPage = extractAlarmListPage(selectedPayload, page);
      resolvedPageSize = extractAlarmListPageSize(selectedPayload, pageSize);
      const selectedIdentifier = lookup?.selected?.identifier || siteId;

      if (serverPaged) {
        total = await fetchStableAlarmTotal(
          baseUrl,
          selectedIdentifier,
          {
            ...options,
            severity: severityFilter,
            state: stateFilter,
            modelKey: asTrimmedString(options.modelKey, asTrimmedString(options.projectKey, selectedIdentifier))
          },
          buildRealtimeAlarmListEndpoint,
          "realtime",
          total
        );
      }

      const shouldRecoverClientPaging =
        serverPaged && (resolvedPage !== page || resolvedPageSize !== pageSize);
      if (shouldRecoverClientPaging) {
        const recovered = await recoverRowsForClientPaging(
          baseUrl,
          selectedIdentifier,
          {
            ...options,
            severity: severityFilter,
            state: stateFilter,
            endpointBuilder: buildRealtimeAlarmListEndpoint
          },
          rawRows,
          total
        );
        rawRows = recovered.rows;
        total = recovered.total;
        resolvedPage = page;
        resolvedPageSize = pageSize;
        forceClientPaging = true;
      }

      rows = rawRows.map(normalizeAlarmRow).map((row) => enrichAlarmRow(row, regCatalog));
    } else {
      const latestAlarmLookup = await fetchLegacyJsonAcrossIdentifiers(baseUrl, identifiers, buildLatestAlarmEndpoint);
      lookup = latestAlarmLookup;
      sourceStatus = toProbeSourceStatus(latestAlarmLookup, buildLatestAlarmEndpoint(siteId));
      rows = sourceStatus.ok
        ? extractRowsFromLookup(latestAlarmLookup).map(normalizeAlarmRow).map((row) => enrichAlarmRow(row, regCatalog))
        : [];
      total = rows.length;
    }
  }

  const filteredRows = rows.filter((row) => {
    if (alarmLevelFilter) {
      const rowAlarmLevel = normalizeAlarmLevelFilterValue(row.alarmLevel || row.severity);
      if (rowAlarmLevel !== alarmLevelFilter) {
        return false;
      }
    }
    if (stateFilter && String(row.state || "").toLowerCase() !== stateFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const useClientPaging = !serverPaged || forceClientPaging;
  const items = useClientPaging
    ? filteredRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    : filteredRows;
  if (useClientPaging) {
    if (!serverPaged) {
      total = filteredRows.length;
    }
    resolvedPage = page;
    resolvedPageSize = pageSize;
  }
  const latestTimestamp =
    items.find((row) => row.occurredAt)?.occurredAt ||
    (sourceStatus.ok ? new Date().toISOString() : null);

  return {
    items,
    total,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    latestTimestamp,
    filters: {
      severity: severityFilter || null,
      state: stateFilter || null
    },
    sourceStatus: {
      ...sourceStatus,
      rows: sourceStatus.ok ? total : null
    }
  };
}

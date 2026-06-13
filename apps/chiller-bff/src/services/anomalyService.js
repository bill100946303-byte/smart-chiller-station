import { loadAlarmList, loadAlarmSummary } from "../adapters/legacyAlarmAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const ANOMALY_LIST_CACHE_TTL_MS = 5 * 1000;
const anomalyListCache = new Map();

function asTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildAnomalyListCacheKey(config, siteId, options = {}) {
  const projectKeyCandidates = Array.isArray(options?.projectKeyCandidates)
    ? options.projectKeyCandidates.map(asTrimmedText).filter(Boolean).sort()
    : [];
  return JSON.stringify([
    asTrimmedText(config?.legacyBaseUrl),
    asTrimmedText(siteId),
    asTrimmedText(options?.page),
    asTrimmedText(options?.pageSize),
    asTrimmedText(options?.severity),
    asTrimmedText(options?.state),
    asTrimmedText(options?.projectKey),
    ...projectKeyCandidates,
    asTrimmedText(options?.deviceDataProjectKey),
    asTrimmedText(options?.deviceDataEndpointKind)
  ]);
}

function resolveProjectKey(config, options = {}) {
  if (typeof options?.projectKey === "string" && options.projectKey.trim()) {
    return options.projectKey.trim();
  }
  const modelKey = config?.siteSourceConfig?.modelKey;
  if (typeof modelKey === "string" && modelKey.trim()) {
    return modelKey.trim();
  }
  const databaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof databaseKey === "string" && databaseKey.trim()) {
    return databaseKey.trim();
  }
  return "";
}

function resolveDatabasePathKey(config, siteId, options = {}) {
  if (typeof options?.databaseKey === "string" && options.databaseKey.trim()) {
    return options.databaseKey.trim();
  }
  if (Array.isArray(options?.databaseKeyCandidates)) {
    const candidate = options.databaseKeyCandidates.find(
      (item) => typeof item === "string" && item.trim()
    );
    if (candidate) {
      return candidate.trim();
    }
  }
  const runtimeDatabaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof runtimeDatabaseKey === "string" && runtimeDatabaseKey.trim()) {
    return runtimeDatabaseKey.trim();
  }
  return String(siteId || "").trim();
}

function resolveProjectKeyCandidates(config, options = {}) {
  const candidates = [];
  if (Array.isArray(options?.projectKeyCandidates)) {
    candidates.push(...options.projectKeyCandidates);
  }
  if (typeof options?.projectKey === "string") {
    candidates.push(options.projectKey);
  }
  if (typeof config?.siteSourceConfig?.databaseKey === "string") {
    candidates.push(config.siteSourceConfig.databaseKey);
  }
  if (typeof config?.siteSourceConfig?.modelKey === "string") {
    candidates.push(config.siteSourceConfig.modelKey);
  }
  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
}

function resolveDeviceDataProjectKey(config, options = {}) {
  if (typeof options?.deviceDataProjectKey === "string" && options.deviceDataProjectKey.trim()) {
    return options.deviceDataProjectKey.trim();
  }
  if (typeof options?.databaseKey === "string" && options.databaseKey.trim()) {
    return options.databaseKey.trim();
  }
  if (Array.isArray(options?.databaseKeyCandidates)) {
    const candidate = options.databaseKeyCandidates.find(
      (item) => typeof item === "string" && item.trim()
    );
    if (candidate) {
      return candidate.trim();
    }
  }
  const runtimeKey = config?.siteSourceConfig?.deviceDataProjectKey;
  if (typeof runtimeKey === "string" && runtimeKey.trim()) {
    return runtimeKey.trim();
  }
  const databaseKey = config?.siteSourceConfig?.databaseKey;
  if (typeof databaseKey === "string" && databaseKey.trim()) {
    return databaseKey.trim();
  }
  return "";
}

function resolveDeviceDataEndpointKind(config, options = {}) {
  if (typeof options?.deviceDataEndpointKind === "string" && options.deviceDataEndpointKind.trim()) {
    return options.deviceDataEndpointKind.trim();
  }
  const firstInterface = Array.isArray(config?.siteSourceConfig?.deviceDataInterfaces)
    ? config.siteSourceConfig.deviceDataInterfaces[0]
    : null;
  return typeof firstInterface?.endpointKind === "string" ? firstInterface.endpointKind.trim() : "";
}

function resolveDefaultDeviceQuery(config, options = {}) {
  if (options?.defaultDeviceQuery && typeof options.defaultDeviceQuery === "object") {
    return options.defaultDeviceQuery;
  }
  return config?.siteSourceConfig?.defaultDeviceQuery || null;
}

export async function getAnomalySummary(config, siteId, options = {}) {
  const databasePathKey = resolveDatabasePathKey(config, siteId, options);
  const alarms = await loadAlarmSummary(config.legacyBaseUrl, siteId, {
    ...options,
    projectKey: resolveProjectKey(config, options),
    projectKeyCandidates: resolveProjectKeyCandidates(config, options),
    deviceDataProjectKey: resolveDeviceDataProjectKey(config, options),
    deviceDataEndpointKind: resolveDeviceDataEndpointKind(config, options),
    defaultDeviceQuery: resolveDefaultDeviceQuery(config, options)
  });
  const freshness = computeFreshnessState(alarms.latestTimestamp, config.staleThresholdHours);
  const latestEventFreshness = computeFreshnessState(
    alarms.latestEventTimestamp,
    config.staleThresholdHours
  );
  const hasAlarmEvents = (alarms.latestEvents?.length ?? 0) > 0;
  const counts = {
    total: alarms.counts?.total ?? 0,
    critical: applyFieldNullStrategy(config, "alarm_critical_count", alarms.counts?.critical ?? 0),
    major: applyFieldNullStrategy(config, "alarm_major_count", alarms.counts?.major ?? 0),
    minor: applyFieldNullStrategy(config, "alarm_minor_count", alarms.counts?.minor ?? 0),
    normal: applyFieldNullStrategy(config, "alarm_normal_count", alarms.counts?.normal ?? 0)
  };

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    counts,
    latestEvents: alarms.latestEvents,
    diagnosisFlags: {
      staleAlarmFeed: applyFieldNullStrategy(
        config,
        "alarm_data_stale",
        hasAlarmEvents ? latestEventFreshness.stale : false,
        false
      ),
      missingHighSeverity: (alarms.counts?.critical ?? 0) === 0
    },
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "subsystemSummary",
        endpoint: `/${databasePathKey}/getAllSubsystemInfo`,
        ...(alarms.sourceStatus[0] || {})
      },
      {
        key: "latestAlarmLog",
        endpoint: `/zsqy/qsAlarmlog/${databasePathKey}/findNewAlarmLog`,
        ...(alarms.sourceStatus[1] || {})
      }
    ])
  };
}

async function computeAnomalyList(config, siteId, options = {}) {
  const databasePathKey = resolveDatabasePathKey(config, siteId, options);
  const list = await loadAlarmList(config.legacyBaseUrl, siteId, {
    ...options,
    projectKey: resolveProjectKey(config, options),
    projectKeyCandidates: resolveProjectKeyCandidates(config, options),
    deviceDataProjectKey: resolveDeviceDataProjectKey(config, options),
    deviceDataEndpointKind: resolveDeviceDataEndpointKind(config, options),
    defaultDeviceQuery: resolveDefaultDeviceQuery(config, options)
  });
  const freshness = computeFreshnessState(list.latestTimestamp, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    items: list.items,
    page: list.page,
    pageSize: list.pageSize,
    total: list.total,
    filters: list.filters,
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "latestAlarmLog",
        endpoint: `/zsqy/qsAlarmlog/${databasePathKey}/findNewAlarmLog`,
        ...(list.sourceStatus || {})
      }
    ])
  };
}

export async function getAnomalyList(config, siteId, options = {}) {
  const cacheKey = buildAnomalyListCacheKey(config, siteId, options);
  const now = Date.now();
  const cached = anomalyListCache.get(cacheKey);
  if (cached) {
    if (cached.pending === true) {
      return cached.promise;
    }
    if (cached.expiresAt > now) {
      return cached.promise;
    }
    anomalyListCache.delete(cacheKey);
  }

  const entry = {
    pending: true,
    expiresAt: 0,
    promise: null
  };
  const promise = computeAnomalyList(config, siteId, options)
    .then((result) => {
      entry.pending = false;
      entry.expiresAt = Date.now() + ANOMALY_LIST_CACHE_TTL_MS;
      return result;
    })
    .catch((error) => {
      anomalyListCache.delete(cacheKey);
      throw error;
    });
  entry.promise = promise;
  anomalyListCache.set(cacheKey, entry);
  return promise;
}

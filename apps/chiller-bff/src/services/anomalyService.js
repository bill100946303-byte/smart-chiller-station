import { loadAlarmList, loadAlarmSummary } from "../adapters/legacyAlarmAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

export async function getAnomalySummary(config, siteId) {
  const alarms = await loadAlarmSummary(config.legacyBaseUrl, siteId);
  const freshness = computeFreshnessState(alarms.latestTimestamp, config.staleThresholdHours);
  const latestEventFreshness = computeFreshnessState(
    alarms.latestEventTimestamp,
    config.staleThresholdHours
  );
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
        latestEventFreshness.stale,
        false
      ),
      missingHighSeverity: (alarms.counts?.critical ?? 0) === 0
    },
    freshness,
    sourceStatus: buildSourceStatus([
      {
        key: "subsystemSummary",
        endpoint: `/${siteId}/getAllSubsystemInfo`,
        ...(alarms.sourceStatus[0] || {})
      },
      {
        key: "latestAlarmLog",
        endpoint: `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`,
        ...(alarms.sourceStatus[1] || {})
      }
    ])
  };
}

export async function getAnomalyList(config, siteId, options = {}) {
  const list = await loadAlarmList(config.legacyBaseUrl, siteId, options);
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
        endpoint: `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`,
        ...(list.sourceStatus || {})
      }
    ])
  };
}

import {
  loadEnergyEfficiencyCalendar,
  loadEnergyEfficiencyCalendarPie
} from "../adapters/legacyEnergyEfficiencyCalendarAdapter.js";
import { loadEnergyAnalysis } from "../adapters/legacyEnergyAnalysisAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const CALENDAR_PIE_FALLBACK_DEVICE_IDS = [
  "chiller",
  "chilledWaterPump",
  "condenserWaterPump",
  "coolingTower"
];

const CALENDAR_PIE_FALLBACK_SEGMENT_ORDER = [
  {
    kind: "chiller",
    label: "\u51b7\u6c34\u673a\u7ec4"
  },
  {
    kind: "chilledWaterPump",
    label: "\u51b7\u51bb\u6c34\u6cf5"
  },
  {
    kind: "condenserWaterPump",
    label: "\u51b7\u5374\u6c34\u6cf5"
  },
  {
    kind: "coolingTower",
    label: "\u51b7\u5374\u5854"
  }
];

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function resolveLegacyAppId(config, siteId, options = {}) {
  const optionAppId = options?.legacyAppId ?? options?.appId;
  if (typeof optionAppId === "string" && optionAppId.trim()) {
    return optionAppId.trim();
  }
  if (typeof optionAppId === "number" && Number.isFinite(optionAppId)) {
    return String(optionAppId);
  }
  const runtimeAppId = config?.siteSourceConfig?.legacyAppId ?? config?.legacyAppId;
  if (typeof runtimeAppId === "string" && runtimeAppId.trim()) {
    return runtimeAppId.trim();
  }
  if (typeof runtimeAppId === "number" && Number.isFinite(runtimeAppId)) {
    return String(runtimeAppId);
  }
  return siteId;
}

function resolveCalendarPieSegmentKind(value) {
  const rawSource = String(value || "").trim().toLowerCase();
  const compactSource = rawSource.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  if (!compactSource) {
    return null;
  }
  if (/chilledwaterpump|chilledpump|冷冻水泵|冷冻泵|鍐峰喕娉|chp/.test(compactSource)) {
    return "chilledWaterPump";
  }
  if (/condenserwaterpump|coolingpump|冷却水泵|冷却泵|鍐峰嵈娉|cwp/.test(compactSource)) {
    return "condenserWaterPump";
  }
  if (/coolingtower|冷却塔|鍐峰嵈濉|ctf|ct/.test(compactSource)) {
    return "coolingTower";
  }
  if (/chiller|冷水主机|冷水机组|主机|冷机|鍐锋按涓绘満|鍐锋按鏈虹粍|涓绘満|鍐锋満|^ch$/.test(compactSource)) {
    return "chiller";
  }
  return null;
}

function shouldUseCalendarPieFallback(segments) {
  const matchedKinds = new Set(
    (Array.isArray(segments) ? segments : [])
      .map((segment) => resolveCalendarPieSegmentKind(segment?.id || segment?.name))
      .filter(Boolean)
  );
  return matchedKinds.size < CALENDAR_PIE_FALLBACK_DEVICE_IDS.length;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildCalendarPieFallbackQuery(filters = {}) {
  const normalizedDateType = filters?.dateType === "2" ? "2" : "1";
  const normalizedDate = String(filters?.date || "").trim();

  if (normalizedDateType === "2" && /^\d{4}-\d{2}$/.test(normalizedDate)) {
    const [yearText, monthText] = normalizedDate.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startDate: `${yearText}-${monthText}-01`,
      endDate: `${yearText}-${monthText}-${pad(lastDay)}`,
      dateType: "2"
    };
  }

  return {
    startDate: normalizedDate,
    endDate: normalizedDate,
    dateType: "1"
  };
}

function buildCalendarPieFallbackSegments(report) {
  const grouped = new Map();

  for (const row of Array.isArray(report?.summaries) ? report.summaries : []) {
    const kind = resolveCalendarPieSegmentKind(row?.id || row?.objectName);
    const value = typeof row?.sumValue === "number" ? row.sumValue : null;
    if (!kind || value == null || value <= 0) {
      continue;
    }
    grouped.set(kind, (grouped.get(kind) || 0) + value);
  }

  return CALENDAR_PIE_FALLBACK_SEGMENT_ORDER.map((item) => ({
    id: item.kind,
    name: item.label,
    value: grouped.get(item.kind) ?? 0
  }));
}

export async function getEnergyEfficiencyCalendar(config, siteId, options = {}) {
  const result = await loadEnergyEfficiencyCalendar(
    config.legacyBaseUrl,
    resolveLegacyAppId(config, siteId, options),
    options
  );
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    month: result.month,
    items: result.items,
    monthSummary: result.monthSummary,
    freshness: computeFreshnessState(result.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([
      { key: "energyEfficiencyCalendar", ...(result.sourceStatus?.calendar || {}) },
      { key: "energyEfficiencyCalendarSummary", ...(result.sourceStatus?.monthSummary || {}) }
    ])
  };
}

export async function getEnergyEfficiencyCalendarPie(config, siteId, options = {}) {
  const legacyAppId = resolveLegacyAppId(config, siteId, options);
  const result = await loadEnergyEfficiencyCalendarPie(config.legacyBaseUrl, legacyAppId, options);
  const sourceEntries = [{ key: "energyEfficiencyCalendarPie", ...result.sourceStatus }];
  let segments = result.segments;
  let total = result.total;

  if (shouldUseCalendarPieFallback(segments)) {
    try {
      const fallbackQuery = buildCalendarPieFallbackQuery(result.filters);
      const fallbackReport = await loadEnergyAnalysis(config.legacyBaseUrl, siteId, {
        appId: legacyAppId,
        startDate: fallbackQuery.startDate,
        endDate: fallbackQuery.endDate,
        dateType: fallbackQuery.dateType,
        deviceIds: CALENDAR_PIE_FALLBACK_DEVICE_IDS,
        categoryQueryDateFormat: fallbackQuery.dateType === "2" ? "month" : "date"
      });
      const fallbackSegments = buildCalendarPieFallbackSegments(fallbackReport);
      const fallbackTotal = fallbackSegments.reduce((sum, item) => sum + (item.value || 0), 0);

      sourceEntries.push({
        key: "energyEfficiencyCalendarPieFallback",
        endpoint: fallbackReport.sourceStatus?.endpoint,
        ok: fallbackReport.sourceStatus?.ok,
        status: fallbackReport.sourceStatus?.status ?? null,
        message: fallbackTotal > 0
          ? "Using energy-analysis category summary fallback"
          : "Energy-analysis fallback returned zero category totals",
        error: fallbackReport.sourceStatus?.error ?? null,
        rows: fallbackSegments.length,
        fallback: true,
        interfaceKind: fallbackReport.sourceStatus?.interfaceKind ?? "bff-builtin",
        originLabel: "\u80fd\u8017\u5206\u6790\u56db\u5206\u7c7b\u515c\u5e95"
      });

      if (fallbackSegments.length === CALENDAR_PIE_FALLBACK_SEGMENT_ORDER.length) {
        segments = fallbackSegments;
        total = fallbackTotal > 0 ? fallbackTotal : total;
      }
    } catch (error) {
      sourceEntries.push({
        key: "energyEfficiencyCalendarPieFallback",
        endpoint: "/zsqy/energyanalysis/getEnergyAnalysisCurve",
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
        rows: 0,
        fallback: true,
        originLabel: "\u80fd\u8017\u5206\u6790\u56db\u5206\u7c7b\u515c\u5e95"
      });
      segments = CALENDAR_PIE_FALLBACK_SEGMENT_ORDER.map((item) => ({
        id: item.kind,
        name: item.label,
        value: 0
      }));
    }
  }

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    filters: result.filters,
    segments,
    total,
    freshness: computeFreshnessState(result.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus(sourceEntries)
  };
}

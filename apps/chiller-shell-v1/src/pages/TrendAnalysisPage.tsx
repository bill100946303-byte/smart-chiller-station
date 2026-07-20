import { startTransition, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import TrendPanel from "../components/dashboard/TrendPanel";
import { runtimeConfig, type TrendRange } from "../config/runtimeConfig";
import useAiDigest from "../hooks/useAiDigest";
import { buildSourceStatusLines } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type AiDigestDto,
  type DashboardOverviewDto,
  type DashboardTrendSeriesDto,
  type DashboardTrendStatDto,
  type DashboardTrendsDto,
  type SourceStatusDto,
  fetchDashboardOverview,
  fetchDashboardTrends
} from "../services/bffClient";

type TrendKpi = {
  key: string;
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type TrendMetricOption = {
  key: string;
  label: string;
  hasSeries: boolean;
  hasValue: boolean;
};

type TrendQualityCard = {
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warn";
};

const METRIC_ORDER = ["totalPowerKw", "currentCop", "chilledDeltaT", "coolingDeltaT"];
const DEFAULT_TREND_RANGE: TrendRange = "24h";
const DEFAULT_TREND_METRIC = "all";
const CHILLED_LOW_DELTA_T = 3;
const CHILLED_READY_DELTA_T = 4;
const COOLING_LOW_DELTA_T = 2.5;
const COOLING_READY_DELTA_T = 3.5;
const LOAD_RATE_LOW_REVIEW_PCT = 35;
const LOAD_RATE_HIGH_REVIEW_PCT = 95;
const TREND_REVIEW_LABEL = "待复核";
const TREND_CURVE_ENDPOINT_LABEL = "曲线末点";
const TREND_LOADING_SOFT_TIMEOUT_MS = 2500;
const TREND_LOADING_SOFT_TIMEOUT_TEXT = "趋势数据暂未回传";
const TREND_COLOR_RULES_TOOLTIP = [
  "COP 提示规则：",
  ">= 5：能效较好，冷量与总功率匹配较优",
  "4.15 ~ 5：能效可接受，需结合负荷率、温差、泵塔功率判断",
  "< 4.15：能效偏低，可能存在低负荷、温差偏弱、泵塔功率偏高或主机效率下降",
  "",
  "冷冻水温差提示规则：",
  "< 3°C：偏低风险，可能存在大流量小温差、旁通、末端阀位或冷冻泵频率问题",
  "3°C ~ 4°C：温差偏弱，建议继续跟踪末端开度、旁通和冷冻泵响应",
  ">= 4°C：温差有效，处于可评审区间，可继续观察收益与舒适边界",
  "",
  "冷却水温差提示规则：",
  "< 2.5°C：偏低风险，可能存在冷却泵、冷却塔或冷凝侧设定不合理",
  "2.5°C ~ 3.5°C：温差偏弱，建议结合室外湿球继续观察冷却塔和冷却泵协同",
  ">= 3.5°C：温差有效，处于可评审区间，可继续评估塔风机与冷凝温重置空间"
].join("\n");
const METRIC_LABELS: Record<string, string> = {
  totalPowerKw: zhCN.trendAnalysis.metricTotalPower,
  currentCop: zhCN.trendAnalysis.metricCop,
  chilledDeltaT: zhCN.trendAnalysis.metricChilledDelta,
  coolingDeltaT: zhCN.trendAnalysis.metricCoolingDelta
};
const TREND_NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

function getTrendNumberFormatter(digits: number): Intl.NumberFormat {
  const normalizedDigits = Math.max(0, Math.min(4, Math.trunc(digits)));
  let formatter = TREND_NUMBER_FORMATTERS.get(normalizedDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: normalizedDigits,
      maximumFractionDigits: normalizedDigits
    });
    TREND_NUMBER_FORMATTERS.set(normalizedDigits, formatter);
  }
  return formatter;
}

function formatValue(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return TREND_REVIEW_LABEL;
  }
  return getTrendNumberFormatter(digits).format(value);
}

function assessCopTone(value: number | null | undefined): "good" | "neutral" | "warn" | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 5) {
    return "good";
  }
  if (value >= 4.15) {
    return "neutral";
  }
  return "warn";
}

function getCopToneClass(metric: string | null | undefined, value: number | null | undefined): string {
  if (metric !== "currentCop") {
    return "";
  }
  const tone = assessCopTone(value);
  return tone ? `trend-cop-value tone-${tone}` : "trend-cop-value";
}

function assessDeltaTone(metric: string | null | undefined, value: number | null | undefined): "good" | "neutral" | "warn" | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (metric === "chilledDeltaT") {
    if (value < CHILLED_LOW_DELTA_T) {
      return "warn";
    }
    if (value < CHILLED_READY_DELTA_T) {
      return "neutral";
    }
    return "good";
  }
  if (metric === "coolingDeltaT") {
    if (value < COOLING_LOW_DELTA_T) {
      return "warn";
    }
    if (value < COOLING_READY_DELTA_T) {
      return "neutral";
    }
    return "good";
  }
  return null;
}

function getMetricToneClass(metric: string | null | undefined, value: number | null | undefined): string {
  if (metric === "currentCop") {
    return getCopToneClass(metric, value);
  }
  if (metric === "currentLoadRate") {
    const tone = assessLoadRateTone(value);
    return tone ? `trend-metric-value tone-${tone}` : "";
  }
  const tone = assessDeltaTone(metric, value);
  return tone ? `trend-metric-value tone-${tone}` : "";
}

function getDeltaToneHint(metric: string | null | undefined, value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  if (metric === "chilledDeltaT") {
    if (value < CHILLED_LOW_DELTA_T) {
      return "偏低风险，可能存在大流量小温差、旁通、末端阀位或冷冻泵频率问题。";
    }
    if (value < CHILLED_READY_DELTA_T) {
      return "温差偏弱，建议继续跟踪末端开度、旁通和冷冻泵响应。";
    }
    return "温差有效，处于可评审区间，可继续观察收益与舒适边界。";
  }
  if (metric === "coolingDeltaT") {
    if (value < COOLING_LOW_DELTA_T) {
      return "偏低风险，可能存在冷却泵、冷却塔或冷凝侧设定不合理。";
    }
    if (value < COOLING_READY_DELTA_T) {
      return "温差偏弱，建议结合室外湿球继续观察冷却塔和冷却泵协同。";
    }
    return "温差有效，处于可评审区间，可继续评估塔风机与冷凝温重置空间。";
  }
  return "";
}

function getCopToneHint(metric: string | null | undefined, value: number | null | undefined): string {
  if (metric !== "currentCop" || typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  if (value >= 5) {
    return "能效较好，说明当前冷量与总功率匹配较优，可继续观察负荷率、泵塔功率和舒适边界。";
  }
  if (value >= 4.15) {
    return "能效处于可接受区间，建议结合负荷率、冷冻/冷却水温差和泵塔功率判断是否还有优化空间。";
  }
  return "能效偏低，可能存在低负荷运行、温差偏弱、泵塔功率偏高或主机效率下降。";
}

function getMetricToneHint(metric: string | null | undefined, value: number | null | undefined): string {
  if (metric === "currentLoadRate") {
    return getLoadRateHint(value);
  }
  return getCopToneHint(metric, value) || getDeltaToneHint(metric, value);
}

function normalizeMetricValue(metric: string, value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (metric === "currentLoadRate") {
    return value >= 0 ? value : null;
  }
  if (metric === "currentCop") {
    return value > 0 ? value : null;
  }
  if (metric === "totalPowerKw") {
    return value >= 0 ? value : null;
  }
  return value;
}

function assessLoadRateTone(value: number | null | undefined): "good" | "neutral" | "warn" | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < LOAD_RATE_LOW_REVIEW_PCT || value > LOAD_RATE_HIGH_REVIEW_PCT) {
    return "warn";
  }
  return "good";
}

function getLoadRateHint(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "当前未回传系统负荷率，COP 对比需要结合冷量与运行台数复核。";
  }
  if (value < LOAD_RATE_LOW_REVIEW_PCT) {
    return "负荷率偏低，COP 容易受低负荷和启停边界影响，暂不宜直接判断节能收益。";
  }
  if (value > LOAD_RATE_HIGH_REVIEW_PCT) {
    return "负荷率接近满载，需优先确认舒适与设备边界，再评估进一步寻优空间。";
  }
  return "处于可评审负荷区间，COP 对比具备工程评审意义。";
}

function getTrendSampleRate(trends: DashboardTrendsDto | null): number | null {
  const series = Array.isArray(trends?.series) ? trends.series : [];
  let totalPoints = 0;
  let validPoints = 0;

  series.forEach((item) => {
    if (!METRIC_ORDER.includes(item.metric || "")) {
      return;
    }
    (item.points || []).forEach((point) => {
      totalPoints += 1;
      if (normalizeMetricValue(item.metric || "", point?.v) !== null) {
        validPoints += 1;
      }
    });
  });

  if (totalPoints <= 0) {
    return null;
  }
  return Math.round((validPoints / totalPoints) * 100);
}

function formatRangeButtonLabel(range: TrendRange): string {
  if (range === "7d") {
    return zhCN.range.button7d;
  }
  if (range === "30d") {
    return zhCN.range.button30d;
  }
  return zhCN.range.button24h;
}

function parseTrendRangeParam(value: string | null, fallback: TrendRange): TrendRange {
  if (value === "24h" || value === "7d" || value === "30d") {
    return value;
  }
  return fallback;
}

function parseTrendMetricParam(value: string | null): string {
  if (!value || value === "all") {
    return "all";
  }
  return METRIC_ORDER.includes(value) ? value : "all";
}

function findStat(stats: DashboardTrendStatDto[] | undefined, metric: string): DashboardTrendStatDto | undefined {
  return stats?.find((item) => item.metric === metric);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function formatCoverageDuration(hours: number | null): string {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours < 0) {
    return TREND_REVIEW_LABEL;
  }
  if (hours >= 48) {
    return `近${formatValue(hours / 24, 1)}天`;
  }
  if (hours >= 1) {
    return `近${getTrendNumberFormatter(0).format(Math.round(hours))}小时`;
  }
  return "不足1小时";
}

function summarizeTrendCoverage(series: DashboardTrendSeriesDto[]): { start: string | null; end: string | null; hours: number | null } {
  const timestamps = series.flatMap((item) =>
    (item.points || [])
      .map((point) => {
        if (!point?.t) {
          return null;
        }
        const parsed = new Date(point.t);
        return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
      })
      .filter((value): value is number => typeof value === "number")
  );

  if (!timestamps.length) {
    return { start: null, end: null, hours: null };
  }

  const startTime = Math.min(...timestamps);
  const endTime = Math.max(...timestamps);
  return {
    start: new Date(startTime).toISOString(),
    end: new Date(endTime).toISOString(),
    hours: Math.max(0, (endTime - startTime) / 3_600_000)
  };
}

function summarizeTrendSource(sourceStatus: SourceStatusDto | null | undefined): string {
  const markers = (sourceStatus?.sources || [])
    .flatMap((item) => [item.endpoint, item.baseUrl, item.interfaceKind, item.originLabel])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (!markers) {
    return "来源待确认";
  }
  if (markers.includes("140btwentyfive") || markers.includes("/zsqy/reg/")) {
    return "当前接入 B25 云端链";
  }
  if (markers.includes("/accesslog/ws")) {
    return "当前接入云端实时补点";
  }
  if (markers.includes("/homepage/")) {
    return "当前仍走驾驶舱趋势链";
  }
  return "当前来源待识别";
}

function summarizeSourceState(overall: SourceStatusDto["overall"] | undefined): string {
  if (overall === "ok") {
    return zhCN.trendAnalysis.sourceStateOk;
  }
  if (overall === "partial") {
    return zhCN.trendAnalysis.sourceStatePartial;
  }
  return zhCN.trendAnalysis.sourceStateFailed;
}

function getAiDigestSummaryText(digest: AiDigestDto | null): string | null {
  return digest?.summary?.summary || digest?.summary?.headline || digest?.summary?.label || null;
}

function getAiDigestNextActionText(digest: AiDigestDto | null): string | null {
  return digest?.nextAction?.summary || digest?.nextAction?.label || null;
}

function buildCoverageHint(range: TrendRange, coverage: { start: string | null; end: string | null; hours: number | null }): string | null {
  const expectedHours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  if (!coverage.start || !coverage.end) {
    return `${formatRangeButtonLabel(range)} 时间轴未回传`;
  }
  if (range !== "24h" && typeof coverage.hours === "number" && coverage.hours < expectedHours * 0.6) {
    return `${formatRangeButtonLabel(range)} 当前仅回传 ${formatCoverageDuration(coverage.hours)}，图表先按已回传窗口展示。`;
  }
  return null;
}

function toMetricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

function readOverviewMetric(overview: DashboardOverviewDto | null, metric: string): number | null {
  const energyCards = overview?.energyCards;
  if (metric === "totalPowerKw") {
    return normalizeMetricValue(metric, energyCards?.totalPowerKw);
  }
  if (metric === "currentCop") {
    return normalizeMetricValue(metric, energyCards?.currentCop);
  }
  if (metric === "chilledDeltaT") {
    return normalizeMetricValue(metric, energyCards?.chilledDeltaT);
  }
  if (metric === "coolingDeltaT") {
    return normalizeMetricValue(metric, energyCards?.coolingDeltaT);
  }
  if (metric === "currentLoadRate") {
    return normalizeMetricValue(metric, energyCards?.currentLoadRate);
  }
  return null;
}

function readLatestTrendMetric(trends: DashboardTrendsDto | null, metric: string): number | null {
  const series = Array.isArray(trends?.series) ? trends.series.find((item) => item.metric === metric) : null;
  if (Array.isArray(series?.points)) {
    for (let index = series.points.length - 1; index >= 0; index -= 1) {
      const normalized = normalizeMetricValue(metric, series.points[index]?.v);
      if (normalized !== null) {
        return normalized;
      }
    }
  }
  return normalizeMetricValue(metric, findStat(trends?.stats, metric)?.latest);
}

function hasUsableTrendSeries(trends: DashboardTrendsDto | null, metric: string): boolean {
  const series = Array.isArray(trends?.series) ? trends.series.find((item) => item.metric === metric) : null;
  if (!Array.isArray(series?.points) || series.points.length === 0) {
    return false;
  }
  return series.points.some((point) => normalizeMetricValue(metric, point?.v) !== null);
}

function readLatestMetric(overview: DashboardOverviewDto | null, trends: DashboardTrendsDto | null, metric: string): number | null {
  return readOverviewMetric(overview, metric) ?? readLatestTrendMetric(trends, metric);
}

function buildMetricOptions(trends: DashboardTrendsDto | null): TrendMetricOption[] {
  const series = Array.isArray(trends?.series) ? trends.series : [];
  const stats = Array.isArray(trends?.stats) ? trends.stats : [];
  const metricKeys = new Set<string>(METRIC_ORDER);

  [...series, ...stats].forEach((item) => {
    if (typeof item?.metric === "string" && item.metric.trim().length > 0) {
      metricKeys.add(item.metric);
    }
  });

  return Array.from(metricKeys)
    .sort((left, right) => {
      const leftIndex = METRIC_ORDER.indexOf(left);
      const rightIndex = METRIC_ORDER.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) {
        return left.localeCompare(right);
      }
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    })
    .map((metric) => {
      const trendSeries = series.find((item) => item.metric === metric);
      const trendStat = stats.find((item) => item.metric === metric);
      const hasSeries = hasUsableTrendSeries(trends, metric);
      const hasValue =
        normalizeMetricValue(metric, trendStat?.latest) !== null ||
        Boolean(trendSeries?.points?.some((point) => normalizeMetricValue(metric, point?.v) !== null));

      return {
        key: metric,
        label: toMetricLabel(metric),
        hasSeries,
        hasValue
      };
    });
}

function buildQualityCards(metricOptions: TrendMetricOption[], sampleRate: number | null): TrendQualityCard[] {
  const readyMetrics = metricOptions.filter((item) => item.hasSeries).length;
  const missingMetrics = metricOptions.filter((item) => !item.hasSeries).length;
  const sampleRateTone = sampleRate === null ? "warn" : sampleRate >= 90 ? "good" : sampleRate >= 75 ? "neutral" : "warn";

  return [
    {
      title: zhCN.trendAnalysis.qualitySeriesReady,
      value: `${readyMetrics}/${metricOptions.length || 0}`,
      detail: readyMetrics > 0 ? "主链路可绘制。" : "无稳定序列。",
      tone: readyMetrics > 0 ? "good" : "warn"
    },
    {
      title: zhCN.trendAnalysis.qualitySeriesMissing,
      value: String(missingMetrics),
      detail: missingMetrics > 0 ? "上游需补齐。" : "未发现缺口。",
      tone: missingMetrics > 0 ? "warn" : "good"
    },
    {
      title: "有效样本率",
      value: sampleRate === null ? TREND_REVIEW_LABEL : `${sampleRate}%`,
      detail: sampleRate === null ? "点位未回传。" : sampleRate >= 75 ? "可支撑评审。" : "样本偏低，需复核。",
      tone: sampleRateTone
    },
    {
      title: "策略状态",
      value: "仅审阅",
      detail: "人工复核",
      tone: "neutral"
    }
  ];
}

function buildDeltaStrategyCard(
  title: string,
  value: number | null,
  lowThreshold: number,
  readyThreshold: number,
  lowHint: string,
  watchHint: string,
  readyHint: string
): TrendQualityCard {
  const isChilledSide = title === zhCN.trendAnalysis.strategyChilledTitle;
  const compactLowHint = isChilledSide ? "查末端阀位、旁通、泵频。" : "查塔接近度、泵频、冷凝设点。";
  const compactWatchHint = isChilledSide ? "温差仍可提升，跟踪末端开度。" : "温差可用，复核塔风机与冷凝温。";
  const compactReadyHint = isChilledSide ? "温差可评审，继续看泵侧节能。" : "温差可评审，继续看塔泵协同。";

  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      title,
      value: zhCN.trendAnalysis.strategyStatePending,
      detail: "无有效数据，先复核采样链路。",
      tone: "warn"
    };
  }

  if (value < lowThreshold) {
    return {
      title,
      value: zhCN.trendAnalysis.strategyStateLow,
      detail: `${formatValue(value, 1)} °C；${compactLowHint || lowHint}`,
      tone: "warn"
    };
  }

  if (value < readyThreshold) {
    return {
      title,
      value: zhCN.trendAnalysis.strategyStateWatch,
      detail: `${formatValue(value, 1)} °C；${compactWatchHint || watchHint}`,
      tone: "neutral"
    };
  }

  return {
    title,
    value: zhCN.trendAnalysis.strategyStateReady,
    detail: `${formatValue(value, 1)} °C；${compactReadyHint || readyHint}`,
    tone: "good"
  };
}

function buildStrategyCards(
  overview: DashboardOverviewDto | null,
  trends: DashboardTrendsDto | null,
  loadError: string | null
): TrendQualityCard[] {
  const chilledDeltaT = readLatestMetric(overview, trends, "chilledDeltaT");
  const coolingDeltaT = readLatestMetric(overview, trends, "coolingDeltaT");
  const sourceBlocked =
    Boolean(loadError)
    || overview?.sourceStatus?.overall === "failed"
    || trends?.sourceStatus?.overall === "failed";
  const chilledLow = typeof chilledDeltaT === "number" && chilledDeltaT < CHILLED_LOW_DELTA_T;
  const coolingLow = typeof coolingDeltaT === "number" && coolingDeltaT < COOLING_LOW_DELTA_T;

  const chilledCard = buildDeltaStrategyCard(
    zhCN.trendAnalysis.strategyChilledTitle,
    chilledDeltaT,
    CHILLED_LOW_DELTA_T,
    CHILLED_READY_DELTA_T,
    zhCN.trendAnalysis.strategyChilledLowHint,
    zhCN.trendAnalysis.strategyChilledWatchHint,
    zhCN.trendAnalysis.strategyChilledReadyHint
  );

  const coolingCard = buildDeltaStrategyCard(
    zhCN.trendAnalysis.strategyCoolingTitle,
    coolingDeltaT,
    COOLING_LOW_DELTA_T,
    COOLING_READY_DELTA_T,
    zhCN.trendAnalysis.strategyCoolingLowHint,
    zhCN.trendAnalysis.strategyCoolingWatchHint,
    zhCN.trendAnalysis.strategyCoolingReadyHint
  );

  let windowValue = zhCN.trendAnalysis.strategyStatePending;
  let windowDetail = "数据不足，先稳住采样口径。";
  let windowTone: TrendQualityCard["tone"] = "warn";

  if (!sourceBlocked && typeof chilledDeltaT === "number" && typeof coolingDeltaT === "number") {
    if (chilledLow && coolingLow) {
      windowValue = zhCN.trendAnalysis.strategyWindowCoordinatedValue;
      windowDetail = "冷热侧均受限，先做协同优化。";
      windowTone = "warn";
    } else if (chilledLow) {
      windowValue = zhCN.trendAnalysis.strategyWindowChilledValue;
      windowDetail = "冷冻侧优先，查温差、旁通、泵频。";
      windowTone = "warn";
    } else if (coolingLow) {
      windowValue = zhCN.trendAnalysis.strategyWindowCoolingValue;
      windowDetail = "冷却侧优先，查塔控、冷凝侧、湿球边界。";
      windowTone = "warn";
    } else {
      windowValue = zhCN.trendAnalysis.strategyWindowCoordinatedValue;
      windowDetail = "可继续评审，用功率拆分定抓手。";
      windowTone = "good";
    }
  } else if (sourceBlocked) {
    windowValue = zhCN.trendAnalysis.strategyStateBlocked;
    windowDetail = "数据降级，先稳住采样口径。";
  }

  return [
    chilledCard,
    coolingCard,
    {
      title: zhCN.trendAnalysis.strategyWindowTitle,
      value: windowValue,
      detail: windowDetail,
      tone: windowTone
    }
  ];
}

function buildTrendKpis(
  overview: DashboardOverviewDto | null,
  trends: DashboardTrendsDto | null,
  fallbackReason: string
): TrendKpi[] {
  const powerTrendValue = readLatestTrendMetric(trends, "totalPowerKw");
  const copTrendValue = readLatestTrendMetric(trends, "currentCop");
  const chilledTrendValue = readLatestTrendMetric(trends, "chilledDeltaT");
  const coolingTrendValue = readLatestTrendMetric(trends, "coolingDeltaT");
  const powerValue = readOverviewMetric(overview, "totalPowerKw") ?? powerTrendValue;
  const copValue = readOverviewMetric(overview, "currentCop") ?? copTrendValue;
  const chilledValue = readOverviewMetric(overview, "chilledDeltaT") ?? chilledTrendValue;
  const coolingValue = readOverviewMetric(overview, "coolingDeltaT") ?? coolingTrendValue;
  const loadRateValue = readOverviewMetric(overview, "currentLoadRate");

  return [
    {
      key: "totalPowerKw",
      title: zhCN.trendAnalysis.summaryPower,
      value: formatValue(powerValue),
      unit: "kW",
      delta: powerTrendValue != null ? `${TREND_CURVE_ENDPOINT_LABEL} ${formatValue(powerTrendValue)}` : fallbackReason,
      tone: powerValue != null ? "good" : "warn"
    },
    {
      key: "currentCop",
      title: zhCN.trendAnalysis.summaryCop,
      value: formatValue(copValue, 2),
      unit: "",
      delta: copTrendValue != null ? `${TREND_CURVE_ENDPOINT_LABEL} ${formatValue(copTrendValue, 2)}` : fallbackReason,
      tone: assessCopTone(copValue) || "warn"
    },
    {
      key: "chilledDeltaT",
      title: zhCN.trendAnalysis.summaryChilledDelta,
      value: formatValue(chilledValue, 1),
      unit: "°C",
      delta: chilledTrendValue != null ? `${TREND_CURVE_ENDPOINT_LABEL} ${formatValue(chilledTrendValue, 1)}` : fallbackReason,
      tone: chilledValue != null ? "neutral" : "warn"
    },
    {
      key: "coolingDeltaT",
      title: zhCN.trendAnalysis.summaryCoolingDelta,
      value: formatValue(coolingValue, 1),
      unit: "°C",
      delta: coolingTrendValue != null ? `${TREND_CURVE_ENDPOINT_LABEL} ${formatValue(coolingTrendValue, 1)}` : fallbackReason,
      tone: coolingValue != null ? "neutral" : "warn"
    },
    {
      key: "currentLoadRate",
      title: "系统负荷率",
      value: formatValue(loadRateValue, 0),
      unit: "%",
      delta: getLoadRateHint(loadRateValue),
      tone: assessLoadRateTone(loadRateValue) || "warn"
    }
  ];
}

export default function TrendAnalysisPage() {
  const { aiDigest } = useAiDigest(runtimeConfig.siteId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState<TrendRange>(() => parseTrendRangeParam(searchParams.get("range"), DEFAULT_TREND_RANGE));
  const [metricFilter, setMetricFilter] = useState<string>(() => parseTrendMetricParam(searchParams.get("metric") || DEFAULT_TREND_METRIC));
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const requestedRange = parseTrendRangeParam(searchParams.get("range"), DEFAULT_TREND_RANGE);
    const requestedMetric = parseTrendMetricParam(searchParams.get("metric") || DEFAULT_TREND_METRIC);
    setRange((prev) => (prev === requestedRange ? prev : requestedRange));
    setMetricFilter((prev) => (prev === requestedMetric ? prev : requestedMetric));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!active) {
        return;
      }
      startTransition(() => {
        setLoadError((prev) => prev || TREND_LOADING_SOFT_TIMEOUT_TEXT);
        setIsLoading(false);
      });
    }, TREND_LOADING_SOFT_TIMEOUT_MS);

    async function load() {
      setLoadError(null);
      setIsLoading(true);
      const [overviewResult, trendsResult] = await Promise.allSettled([
        fetchDashboardOverview(runtimeConfig.siteId),
        fetchDashboardTrends(runtimeConfig.siteId, range)
      ]);

      if (!active) {
        return;
      }
      window.clearTimeout(loadingTimeout);

      const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      const trendsData = trendsResult.status === "fulfilled" ? trendsResult.value : null;
      const failed = [
        overviewData ? null : zhCN.endpoint.overview,
        trendsData ? null : zhCN.endpoint.trends
      ].filter(Boolean);

      startTransition(() => {
        setOverview(overviewData);
        setTrends(trendsData);
        setLoadError(failed.length > 0 ? `${zhCN.dashboard.bffUnavailableReason}（${failed.join("、")}）` : null);
        setIsLoading(false);
      });
    }

    load();
    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
    };
  }, [range]);

  const fallbackReason = loadError || zhCN.dashboard.partialDataset;
  const kpis = buildTrendKpis(overview, trends, fallbackReason);
  const metricOptions = useMemo(() => buildMetricOptions(trends), [trends]);
  const sampleRate = useMemo(() => getTrendSampleRate(trends), [trends]);
  const qualityCards = useMemo(() => buildQualityCards(metricOptions, sampleRate), [metricOptions, sampleRate]);
  const strategyCards = useMemo(() => buildStrategyCards(overview, trends, loadError), [overview, trends, loadError]);

  useEffect(() => {
    if (metricFilter === "all") {
      return;
    }
    if (!metricOptions.some((item) => item.key === metricFilter)) {
      setMetricFilter("all");
    }
  }, [metricFilter, metricOptions]);

  useEffect(() => {
    const rawRange = searchParams.get("range");
    const rawMetric = searchParams.get("metric");
    const rangeSynced = rawRange === range;
    const metricSynced = metricFilter === "all" ? rawMetric === null : rawMetric === metricFilter;
    if (rangeSynced && metricSynced) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("range", range);
    if (metricFilter === "all") {
      nextParams.delete("metric");
    } else {
      nextParams.set("metric", metricFilter);
    }
    setSearchParams(nextParams, { replace: true });
  }, [metricFilter, range, searchParams, setSearchParams]);

  const filteredSeries = useMemo(() => {
    const allSeries = trends?.series || [];
    if (metricFilter === "all") {
      return allSeries;
    }
    return allSeries.filter((item) => item.metric === metricFilter);
  }, [metricFilter, trends?.series]);

  const filteredStats = useMemo(() => {
    const allStats = trends?.stats || [];
    if (metricFilter === "all") {
      return allStats;
    }
    return allStats.filter((item) => item.metric === metricFilter);
  }, [metricFilter, trends?.stats]);

  const selectedMetric = metricOptions.find((item) => item.key === metricFilter);
  const selectedMetricHint =
    metricFilter !== "all" && selectedMetric && !selectedMetric.hasSeries
      ? `${selectedMetric.label} 暂无连续点，先切回全部指标或换一个指标查看。`
      : null;
  const coverage = useMemo(() => summarizeTrendCoverage(filteredSeries), [filteredSeries]);
  const coverageHint = useMemo(() => buildCoverageHint(range, coverage), [coverage, range]);
  const readyMetrics = metricOptions.filter((item) => item.hasSeries).length;
  const sourceOverall = trends?.sourceStatus?.overall || overview?.sourceStatus?.overall;
  const aiDigestSummaryText = getAiDigestSummaryText(aiDigest);
  const aiDigestNextActionText = getAiDigestNextActionText(aiDigest);
  const latestSampleTimestamp = trends?.freshness?.latestTimestamp || overview?.freshness?.latestTimestamp || aiDigest?.freshness?.latestTimestamp || null;
  const sourceLine = loadError
    ? `${zhCN.trendAnalysis.qualitySourceState}：${summarizeSourceState(sourceOverall)} · ${loadError}`
    : `${zhCN.trendAnalysis.qualitySourceState}：${summarizeSourceState(sourceOverall)} · ${summarizeTrendSource(
        trends?.sourceStatus
      )}`;
  const sourceStateLabel = summarizeSourceState(sourceOverall);
  const statusDigestLines = Array.from(new Set(buildSourceStatusLines([overview?.sourceStatus, trends?.sourceStatus], { labelMode: "short" }).filter(Boolean))).slice(0, 4);
  const sourceStatusDetail = statusDigestLines.length > 0 ? statusDigestLines.join(" · ") : sourceLine;
  const headerSummary = coverage.start
    ? `${formatRangeButtonLabel(range)} 实际窗口 ${formatTimestamp(coverage.start)} 至 ${formatTimestamp(coverage.end)} · 最近采样 ${formatTimestamp(
        latestSampleTimestamp
      )} · 可绘制 ${readyMetrics}/${metricOptions.length || 0} 指标`
    : `${formatRangeButtonLabel(range)} 当前未回传可绘制时间轴 · 最近采样 ${formatTimestamp(
        latestSampleTimestamp
      )}`;
  const chartHint =
    coverageHint
    || (metricFilter === "all"
      ? "当前展示全部指标，切换单指标可以更快定位波动。"
      : selectedMetricHint || "当前指标已有连续点，可直接查看波动和统计。");
  const commandTags: Array<{ label: string; value: string; title?: string }> = [
    { label: "站点", value: overview?.site?.siteName || `项目编号 ${runtimeConfig.siteId}` },
    { label: zhCN.trendAnalysis.rangeTitle, value: formatRangeButtonLabel(range) },
    { label: "窗口", value: coverage.start ? `${formatTimestamp(coverage.start)}-${formatTimestamp(coverage.end)}` : "待回传" },
    { label: "趋势链路", value: sourceStateLabel }
  ];
  const sourceCards = [
    {
      label: zhCN.trendAnalysis.qualitySourceState,
      value: sourceStateLabel,
      detail: sourceStatusDetail,
      tone: sourceOverall === "ok" ? "good" : "warn"
    },
    {
      label: zhCN.trendAnalysis.freshnessLatestPrefix,
      value: formatTimestamp(latestSampleTimestamp),
      detail: headerSummary,
      tone: latestSampleTimestamp ? "neutral" : "warn"
    },
    {
      label: zhCN.trendAnalysis.qualitySeriesReady,
      value: `${readyMetrics}/${metricOptions.length || 0}`,
      detail: "主链路可绘制",
      tone: readyMetrics > 0 ? "good" : "warn"
    },
    {
      label: "有效样本率",
      value: sampleRate === null ? TREND_REVIEW_LABEL : `${sampleRate}%`,
      detail: sampleRate === null ? "采样待复核" : "采样覆盖充足",
      tone: sampleRate !== null && sampleRate >= 90 ? "good" : "neutral"
    }
  ];
  const commandStats = kpis.map((item) => {
    const metricValue = item.key === "currentLoadRate" ? readOverviewMetric(overview, "currentLoadRate") : readLatestMetric(overview, trends, item.key);
    const metricHint = getMetricToneHint(item.key, metricValue);
    return {
      key: item.key,
      title: item.title,
      value: item.unit && item.value !== TREND_REVIEW_LABEL ? `${item.value} ${item.unit}` : item.value,
      detail: item.delta,
      valueClassName: getMetricToneClass(item.key, metricValue),
      valueTitle: metricHint
        ? `${item.value}${item.unit && item.value !== TREND_REVIEW_LABEL ? ` ${item.unit}` : ""}：${metricHint}`
        : item.unit && item.value !== TREND_REVIEW_LABEL
          ? `${item.value} ${item.unit}`
          : item.value,
      cardTitle: metricHint
        ? `${item.title}：${item.value}${item.unit && item.value !== TREND_REVIEW_LABEL ? ` ${item.unit}` : ""}。${metricHint}`
        : undefined
    };
  });
  const rangeSwitchControl = (
    <div key="trend-range-switch-inline" className="trend-range-switch trend-range-switch--inline">
      <span>{zhCN.trendAnalysis.rangeTitle}</span>
      {(["24h", "7d", "30d"] as TrendRange[]).map((item) => (
        <button
          key={item}
          type="button"
          className={item === range ? "is-active" : ""}
          onClick={() => {
            if (item !== range) {
              setIsLoading(true);
              setRange(item);
            }
          }}
        >
          {formatRangeButtonLabel(item)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="trend-analysis-page trend-analysis-page--effect page-enter">
      <section className="trend-page-header trend-command-board subpage-command-board">
        <div className="trend-command-copy subpage-command-copy">
          <div className="trend-title-row">
            <h1>{zhCN.trendAnalysis.heading}</h1>
            <span>{aiDigestSummaryText || "多序列联动评审"}</span>
          </div>
          <p>按时间窗口追踪总站功率、冷站 COP 与冷热侧温差，并结合系统负荷率判断节能策略是否稳定生效。</p>
          <div className="trend-command-tags">
            {commandTags.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
            <span className="is-rule-highlight" title={TREND_COLOR_RULES_TOOLTIP}>
              <strong>标色规则</strong>
              <em>可悬停查看</em>
            </span>
          </div>
        </div>
        <div className="trend-source-grid">
          {sourceCards.map((item) => (
            <article key={item.label} className={`trend-source-cell tone-${item.tone}`} title={`${item.label}：${item.value}。${item.detail}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="trend-command-summary-grid trend-kpi-row" aria-label={zhCN.trendAnalysis.sectionHighlights}>
        {commandStats.map((item) => (
          <article key={item.key} className="trend-command-stat trend-kpi-card" title={item.cardTitle}>
            <span>{item.title}</span>
            <strong className={item.valueClassName || undefined} title={item.valueTitle}>
              {item.value}
            </strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <div className="trend-control-row">
        <span>{zhCN.trendAnalysis.filterTitle}</span>
        <div className="trend-metric-filter-actions">
          <button
            type="button"
            className={metricFilter === "all" ? "is-active" : ""}
            onClick={() => {
              if (metricFilter !== "all") {
                setMetricFilter("all");
              }
            }}
          >
            {zhCN.trendAnalysis.filterAllMetrics}
          </button>
          {metricOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={metricFilter === item.key ? "is-active" : ""}
              onClick={() => {
                if (metricFilter !== item.key) {
                  setMetricFilter(item.key);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {rangeSwitchControl}
      </div>

      <div className="trend-page-grid trend-main-grid">
        <SectionCard
          title={zhCN.trendAnalysis.sectionChart}
          action={<span className="dashboard-section-hint">{chartHint}</span>}
        >
          <TrendPanel
            range={range}
            series={filteredSeries}
            stats={filteredStats}
            freshnessStale={Boolean(trends?.freshness?.stale)}
            degradedHint={loadError ? zhCN.trendAnalysis.degraded : null}
            interactive
            loading={isLoading}
          />
        </SectionCard>

        <SectionCard title={zhCN.trendAnalysis.sectionSeriesStats}>
          <p className="empty-hint">当前筛选窗口内的最新、最小、最大与诊断结论。</p>
          {filteredStats.length ? (
            <div className="trend-stat-list trend-stat-list--compact">
              {filteredStats.map((item, index) => (
                <article key={item.metric || `trend-stat-${index + 1}`} className="trend-stat-item">
                  <strong>{toMetricLabel(item.metric || zhCN.trend.defaultTitle)}</strong>
                  <div>
                    <span>{zhCN.trend.latest}</span>
                    <span
                      className={getMetricToneClass(item.metric, item.latest) || undefined}
                      title={getMetricToneHint(item.metric, item.latest) || undefined}
                    >
                      {formatValue(item.latest, 2)}
                    </span>
                  </div>
                  <div>
                    <span>{zhCN.trend.min}</span>
                    <span
                      className={getMetricToneClass(item.metric, item.min) || undefined}
                      title={getMetricToneHint(item.metric, item.min) || undefined}
                    >
                      {formatValue(item.min, 2)}
                    </span>
                  </div>
                  <div>
                    <span>{zhCN.trend.max}</span>
                    <span
                      className={getMetricToneClass(item.metric, item.max) || undefined}
                      title={getMetricToneHint(item.metric, item.max) || undefined}
                    >
                      {formatValue(item.max, 2)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hint">
              {metricFilter === "all" ? zhCN.trendAnalysis.noStats : zhCN.trendAnalysis.metricNoStats}
            </p>
          )}
        </SectionCard>
      </div>

      <div className="trend-bottom-grid">
        <SectionCard
          title={zhCN.trendAnalysis.sectionStrategy}
          action={<span className="dashboard-section-hint">{aiDigestNextActionText || "诊断只输出建议和目标值，执行边界仍由 PLC 与人工审批控制。"}</span>}
        >
          <div className="trend-diagnosis-grid">
            {strategyCards.map((item) => (
              <article key={item.title} className={`trend-quality-card trend-strategy-card tone-${item.tone}`} title={`${item.title}：${item.value}。${item.detail}`}>
                <p>{item.title}</p>
                <strong>{item.value}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="数据质量" action={<span className="dashboard-section-hint">用于判断趋势结论是否可进入节能评审。</span>}>
          <div className="trend-quality-grid trend-quality-grid--compact">
            {qualityCards.map((item) => (
              <article key={item.title} className={`trend-quality-card tone-${item.tone}`} title={`${item.title}：${item.value}。${item.detail}`}>
                <p>{item.title}</p>
                <strong>{item.value}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

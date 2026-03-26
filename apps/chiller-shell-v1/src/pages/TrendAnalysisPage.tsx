import { startTransition, useEffect, useMemo, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import TrendPanel from "../components/dashboard/TrendPanel";
import { runtimeConfig, type TrendRange } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type DashboardOverviewDto,
  type DashboardTrendStatDto,
  type DashboardTrendsDto,
  fetchDashboardOverview,
  fetchDashboardTrends
} from "../services/bffClient";

type TrendKpi = {
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
const METRIC_LABELS: Record<string, string> = {
  totalPowerKw: zhCN.trendAnalysis.metricTotalPower,
  currentCop: zhCN.trendAnalysis.metricCop,
  chilledDeltaT: zhCN.trendAnalysis.metricChilledDelta,
  coolingDeltaT: zhCN.trendAnalysis.metricCoolingDelta
};

function formatValue(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
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

function toMetricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

function buildMetricOptions(trends: DashboardTrendsDto | null): TrendMetricOption[] {
  const series = Array.isArray(trends?.series) ? trends.series : [];
  const stats = Array.isArray(trends?.stats) ? trends.stats : [];
  const metricKeys = new Set<string>();

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
      const hasSeries = (trendSeries?.points?.length ?? 0) > 0;
      const hasValue =
        typeof trendStat?.latest === "number" ||
        Boolean(trendSeries?.points?.some((point) => typeof point?.v === "number"));

      return {
        key: metric,
        label: toMetricLabel(metric),
        hasSeries,
        hasValue
      };
    });
}

function buildQualityCards(
  overview: DashboardOverviewDto | null,
  trends: DashboardTrendsDto | null,
  metricOptions: TrendMetricOption[],
  loadError: string | null
): TrendQualityCard[] {
  const readyMetrics = metricOptions.filter((item) => item.hasSeries).length;
  const missingMetrics = metricOptions.filter((item) => !item.hasSeries).length;
  const sourceOverall = trends?.sourceStatus?.overall || overview?.sourceStatus?.overall || "failed";
  const freshnessTimestamp = trends?.freshness?.latestTimestamp || overview?.freshness?.latestTimestamp || null;
  const freshnessStale = Boolean(trends?.freshness?.stale || overview?.freshness?.stale);

  return [
    {
      title: zhCN.trendAnalysis.qualitySeriesReady,
      value: `${readyMetrics}/${metricOptions.length || 0}`,
      detail:
        readyMetrics > 0 ? zhCN.trendAnalysis.qualitySeriesReadyHint : zhCN.trendAnalysis.qualitySeriesReadyEmpty,
      tone: readyMetrics > 0 ? "good" : "warn"
    },
    {
      title: zhCN.trendAnalysis.qualitySeriesMissing,
      value: String(missingMetrics),
      detail: missingMetrics > 0 ? zhCN.trendAnalysis.qualitySeriesMissingHint : zhCN.trendAnalysis.qualityNoneMissing,
      tone: missingMetrics > 0 ? "warn" : "good"
    },
    {
      title: zhCN.trendAnalysis.qualitySourceState,
      value:
        sourceOverall === "ok"
          ? zhCN.trendAnalysis.sourceStateOk
          : sourceOverall === "partial"
            ? zhCN.trendAnalysis.sourceStatePartial
            : zhCN.trendAnalysis.sourceStateFailed,
      detail: loadError || zhCN.trendAnalysis.sourceStateHint,
      tone: sourceOverall === "ok" ? "good" : "warn"
    },
    {
      title: zhCN.trendAnalysis.qualityFreshness,
      value: freshnessStale ? zhCN.trendAnalysis.freshnessStale : zhCN.trendAnalysis.freshnessFresh,
      detail: `${zhCN.trendAnalysis.freshnessLatestPrefix} ${formatTimestamp(freshnessTimestamp)}`,
      tone: freshnessStale ? "warn" : "neutral"
    }
  ];
}

function buildTrendKpis(
  overview: DashboardOverviewDto | null,
  trends: DashboardTrendsDto | null,
  fallbackReason: string
): TrendKpi[] {
  const energyCards = overview?.energyCards;
  const powerStat = findStat(trends?.stats, "totalPowerKw");
  const copStat = findStat(trends?.stats, "currentCop");
  const chilledStat = findStat(trends?.stats, "chilledDeltaT");
  const coolingStat = findStat(trends?.stats, "coolingDeltaT");
  const stale = Boolean(overview?.freshness?.stale || trends?.freshness?.stale);
  const deltaLabel = stale ? zhCN.trendAnalysis.staleBanner : zhCN.dashboard.deltas.live;

  return [
    {
      title: zhCN.trendAnalysis.summaryPower,
      value: formatValue(energyCards?.totalPowerKw ?? powerStat?.latest),
      unit: "kW",
      delta: powerStat?.latest != null ? `${zhCN.trendAnalysis.latestPrefix} ${formatValue(powerStat.latest)}` : deltaLabel,
      tone: powerStat?.latest != null || energyCards?.totalPowerKw != null ? "good" : "warn"
    },
    {
      title: zhCN.trendAnalysis.summaryCop,
      value: formatValue(energyCards?.currentCop ?? copStat?.latest, 2),
      unit: "",
      delta: copStat?.latest != null ? `${zhCN.trendAnalysis.latestPrefix} ${formatValue(copStat.latest, 2)}` : deltaLabel,
      tone: copStat?.latest != null || energyCards?.currentCop != null ? "good" : "warn"
    },
    {
      title: zhCN.trendAnalysis.summaryChilledDelta,
      value: formatValue(energyCards?.chilledDeltaT ?? chilledStat?.latest, 1),
      unit: "°C",
      delta:
        chilledStat?.latest != null
          ? `${zhCN.trendAnalysis.latestPrefix} ${formatValue(chilledStat.latest, 1)}`
          : fallbackReason,
      tone: chilledStat?.latest != null || energyCards?.chilledDeltaT != null ? "neutral" : "warn"
    },
    {
      title: zhCN.trendAnalysis.summaryCoolingDelta,
      value: formatValue(energyCards?.coolingDeltaT ?? coolingStat?.latest, 1),
      unit: "°C",
      delta:
        coolingStat?.latest != null
          ? `${zhCN.trendAnalysis.latestPrefix} ${formatValue(coolingStat.latest, 1)}`
          : fallbackReason,
      tone: coolingStat?.latest != null || energyCards?.coolingDeltaT != null ? "neutral" : "warn"
    }
  ];
}

export default function TrendAnalysisPage() {
  const [range, setRange] = useState<TrendRange>(runtimeConfig.trendRange);
  const [metricFilter, setMetricFilter] = useState<string>("all");
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadError(null);

      const [overviewResult, trendsResult] = await Promise.allSettled([
        fetchDashboardOverview(runtimeConfig.siteId),
        fetchDashboardTrends(runtimeConfig.siteId, range)
      ]);

      if (!active) {
        return;
      }

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
      });
    }

    load();
    return () => {
      active = false;
    };
  }, [range]);

  const sourceSummary = summarizeSourceStatus([overview?.sourceStatus, trends?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([overview?.sourceStatus, trends?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([overview?.sourceStatus, trends?.sourceStatus], {
    limit: 4,
    labelMode: "short"
  });
  const fallbackReason = loadError || zhCN.dashboard.partialDataset;
  const kpis = buildTrendKpis(overview, trends, fallbackReason);
  const metricOptions = useMemo(() => buildMetricOptions(trends), [trends]);
  const qualityCards = useMemo(
    () => buildQualityCards(overview, trends, metricOptions, loadError),
    [overview, trends, metricOptions, loadError]
  );

  useEffect(() => {
    if (metricFilter === "all") {
      return;
    }
    if (!metricOptions.some((item) => item.key === metricFilter)) {
      setMetricFilter("all");
    }
  }, [metricFilter, metricOptions]);

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
      ? zhCN.trendAnalysis.metricNoPoints
      : null;

  return (
    <div className="trend-analysis-page page-enter">
      <SourceStatusBanner
        summary={loadError ? loadError : sourceSummary.text}
        warn={Boolean(loadError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="trend-page-header">
        <div>
          <h2>{zhCN.trendAnalysis.heading}</h2>
          <p>{zhCN.trendAnalysis.subtitle}</p>
        </div>
        <div className="trend-range-switch">
          <span>{zhCN.trendAnalysis.rangeTitle}</span>
          {(["24h", "7d", "30d"] as TrendRange[]).map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? "is-active" : ""}
              onClick={() => setRange(item)}
            >
              {formatRangeButtonLabel(item)}
            </button>
          ))}
        </div>
      </section>

      <div className="trend-summary-grid">
        {kpis.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            unit={item.unit}
            delta={item.delta}
            tone={item.tone}
          />
        ))}
      </div>

      <div className="trend-quality-grid">
        {qualityCards.map((item) => (
          <article key={item.title} className={`trend-quality-card tone-${item.tone}`}>
            <p>{item.title}</p>
            <strong>{item.value}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </div>

      <div className="trend-page-grid">
        <SectionCard
          title={zhCN.trendAnalysis.sectionChart}
          action={
            <div className="trend-metric-filter">
              <span>{zhCN.trendAnalysis.filterTitle}</span>
              <div className="trend-metric-filter-row">
                <button
                  type="button"
                  className={metricFilter === "all" ? "is-active" : ""}
                  onClick={() => setMetricFilter("all")}
                >
                  {zhCN.trendAnalysis.filterAllMetrics}
                </button>
                {metricOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={metricFilter === item.key ? "is-active" : ""}
                    onClick={() => setMetricFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {selectedMetricHint ? <p className="empty-hint">{selectedMetricHint}</p> : null}
          <TrendPanel
            range={range}
            series={filteredSeries}
            stats={filteredStats}
            freshnessStale={Boolean(trends?.freshness?.stale)}
            degradedHint={loadError ? zhCN.trendAnalysis.degraded : null}
          />
        </SectionCard>

        <SectionCard title={zhCN.trendAnalysis.sectionSeriesStats}>
          {filteredStats.length ? (
            <div className="trend-stat-list">
              {filteredStats.map((item, index) => (
                <article key={item.metric || `trend-stat-${index + 1}`} className="trend-stat-item">
                  <strong>{toMetricLabel(item.metric || zhCN.trend.defaultTitle)}</strong>
                  <div>
                    <span>{zhCN.trend.latest}</span>
                    <span>{formatValue(item.latest, 2)}</span>
                  </div>
                  <div>
                    <span>{zhCN.trend.min}</span>
                    <span>{formatValue(item.min, 2)}</span>
                  </div>
                  <div>
                    <span>{zhCN.trend.max}</span>
                    <span>{formatValue(item.max, 2)}</span>
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
    </div>
  );
}

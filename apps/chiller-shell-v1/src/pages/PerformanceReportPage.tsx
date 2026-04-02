import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, zhCN } from "../i18n/zhCN";
import { getAuthSession } from "../services/auth";
import {
  type PerformanceReportDto,
  exportPerformanceReport,
  fetchPerformanceReport
} from "../services/bffClient";

type FilterState = {
  metric: string;
  startTime: string;
  endTime: string;
};

type MetricOption = {
  id: string;
  label: string;
};

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type StrategyAuditCard = {
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warn";
};

type ChartSeriesView = {
  key: string;
  label: string;
  color: string;
  points: Array<{
    label: string;
    value: number | null;
  }>;
  latest: number | null;
  min: number | null;
  max: number | null;
};

const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];

const METRIC_OPTIONS: MetricOption[] = [
  { id: "systemEfficiency", label: zhCN.performanceReportPage.metricSystemEfficiency },
  { id: "chillerEfficiency", label: zhCN.performanceReportPage.metricChillerEfficiency },
  { id: "coolingTowerEfficiency", label: zhCN.performanceReportPage.metricCoolingTowerEfficiency },
  { id: "chilledPumpEfficiency", label: zhCN.performanceReportPage.metricChilledPumpEfficiency },
  { id: "coolingPumpEfficiency", label: zhCN.performanceReportPage.metricCoolingPumpEfficiency },
  { id: "chilledWaterTemperature", label: zhCN.performanceReportPage.metricChilledWaterTemperature },
  { id: "chilledWaterTemperatureDiff", label: zhCN.performanceReportPage.metricChilledWaterTemperatureDiff },
  { id: "coolingWaterTemperature", label: zhCN.performanceReportPage.metricCoolingWaterTemperature },
  { id: "coolingWaterTemperatureDiff", label: zhCN.performanceReportPage.metricCoolingWaterTemperatureDiff },
  { id: "chilledWaterFlow", label: zhCN.performanceReportPage.metricChilledWaterFlow },
  { id: "coolingWaterFlow", label: zhCN.performanceReportPage.metricCoolingWaterFlow }
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLegacyDateTime(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length === 16 ? `${normalized.replace("T", " ")}:00` : normalized.replace("T", " ");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function mapLegacyLanguage(): string {
  const locale = getCurrentLocale();
  if (locale === "vi-VN") {
    return "vie";
  }
  if (locale === "en-US") {
    return "en";
  }
  return "zh";
}

function getMetricLabel(metric: string): string {
  return METRIC_OPTIONS.find((item) => item.id === metric)?.label || metric;
}

function formatValue(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
}

function buildChartSeries(data: PerformanceReportDto | null): ChartSeriesView[] {
  const series = data?.series || [];
  return series.map((item, index) => {
    const points = (item.points || []).map((point) => ({
      label: point.label || "--",
      value: typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null
    }));
    const numeric = points.map((point) => point.value).filter((value): value is number => typeof value === "number");
    return {
      key: item.id || `series-${index + 1}`,
      label: item.name || `series-${index + 1}`,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points,
      latest: numeric.length > 0 ? numeric[numeric.length - 1] : null,
      min: numeric.length > 0 ? Math.min(...numeric) : null,
      max: numeric.length > 0 ? Math.max(...numeric) : null
    };
  });
}

function buildSummaryCards(data: PerformanceReportDto | null, query: FilterState): SummaryCard[] {
  const seriesCount = data?.series?.length || 0;
  const summaryCount = data?.summaries?.length || 0;
  const sourceReady = data?.sourceStatus?.overall === "ok";

  return [
    {
      title: zhCN.performanceReportPage.summarySeries,
      value: String(seriesCount),
      unit: "",
      delta: zhCN.performanceReportPage.rangeSeries,
      tone: seriesCount > 0 ? "good" : "warn"
    },
    {
      title: zhCN.performanceReportPage.summaryTags,
      value: String(summaryCount),
      unit: "",
      delta: zhCN.performanceReportPage.summaryFilterHint,
      tone: summaryCount > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.performanceReportPage.summaryRange,
      value: `${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`,
      unit: "",
      delta: zhCN.performanceReportPage.summaryFilterHint,
      tone: "neutral"
    },
    {
      title: zhCN.performanceReportPage.summaryState,
      value: sourceReady ? zhCN.performanceReportPage.stateReady : zhCN.performanceReportPage.stateFallback,
      unit: "",
      delta: zhCN.performanceReportPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function buildStrategyAuditCards(
  data: PerformanceReportDto | null,
  query: FilterState,
  loadError: string | null
): StrategyAuditCard[] {
  const normalizedMetric = String(query.metric || "");
  const points = (data?.series || []).flatMap((item) => item.points || []);
  const validPoints = points.filter(
    (point) => typeof point?.value === "number" && Number.isFinite(point.value)
  ).length;
  const hasUsableSeries = (data?.series?.length || 0) > 0 && validPoints > 0 && !loadError;

  let focus = zhCN.performanceReportPage.strategyFocusCoordinated;
  let verify = zhCN.performanceReportPage.strategyVerifyCoordinated;
  if (normalizedMetric === "systemEfficiency") {
    focus = zhCN.performanceReportPage.strategyFocusPlant;
    verify = zhCN.performanceReportPage.strategyVerifyPlant;
  } else if (normalizedMetric === "chillerEfficiency") {
    focus = zhCN.performanceReportPage.strategyFocusChiller;
    verify = zhCN.performanceReportPage.strategyVerifyChiller;
  } else if (
    normalizedMetric === "coolingTowerEfficiency" ||
    normalizedMetric === "coolingPumpEfficiency" ||
    normalizedMetric === "coolingWaterTemperature" ||
    normalizedMetric === "coolingWaterTemperatureDiff"
  ) {
    focus = zhCN.performanceReportPage.strategyFocusCooling;
    verify = zhCN.performanceReportPage.strategyVerifyCooling;
  } else if (
    normalizedMetric === "chilledPumpEfficiency" ||
    normalizedMetric === "chilledWaterTemperature" ||
    normalizedMetric === "chilledWaterTemperatureDiff" ||
    normalizedMetric === "chilledWaterFlow"
  ) {
    focus = zhCN.performanceReportPage.strategyFocusChilled;
    verify = zhCN.performanceReportPage.strategyVerifyChilled;
  }

  return [
    {
      title: zhCN.performanceReportPage.strategyFocusTitle,
      value: hasUsableSeries ? focus : zhCN.performanceReportPage.strategyPending,
      detail: `${zhCN.performanceReportPage.rangeMetric} ${getMetricLabel(query.metric)}`,
      tone: hasUsableSeries ? "good" : "warn"
    },
    {
      title: zhCN.performanceReportPage.strategyVerifyTitle,
      value: hasUsableSeries ? verify : zhCN.performanceReportPage.strategyVerifyPending,
      detail: `${zhCN.performanceReportPage.rangeSeries} ${data?.series?.length || 0}`,
      tone: hasUsableSeries ? "neutral" : "warn"
    },
    {
      title: zhCN.performanceReportPage.strategyReadTitle,
      value: hasUsableSeries ? zhCN.performanceReportPage.strategyReadReady : zhCN.performanceReportPage.strategyReadPending,
      detail: hasUsableSeries
        ? `${zhCN.performanceReportPage.strategyPointCount} ${validPoints}`
        : zhCN.performanceReportPage.strategyReadPendingHint,
      tone: hasUsableSeries ? "good" : "warn"
    }
  ];
}

function PerformanceTrendChart({
  data,
  metricLabel,
  loadError
}: {
  data: PerformanceReportDto | null;
  metricLabel: string;
  loadError: string | null;
}) {
  const renderedSeries = buildChartSeries(data);
  const numericValues = renderedSeries
    .flatMap((item) => item.points.map((point) => point.value))
    .filter((value): value is number => typeof value === "number");
  const axisLabels = data?.axisLabels || renderedSeries[0]?.points?.map((item) => item.label) || [];

  if (renderedSeries.length === 0 || numericValues.length === 0) {
    return (
      <div className="trend-panel">
        <div className="trend-meta">
          <div>
            <strong>{metricLabel}</strong>
            <p>{zhCN.performanceReportPage.sectionChart}</p>
          </div>
        </div>
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">{zhCN.performanceReportPage.empty}</p>
      </div>
    );
  }

  const globalMin = Math.min(...numericValues);
  const globalMax = Math.max(...numericValues);
  const span = globalMax === globalMin ? Math.max(Math.abs(globalMax), 1) : globalMax - globalMin;
  const yTop = 6;
  const yBottom = 94;
  const yRange = yBottom - yTop;

  function toY(value: number): number {
    const ratio = Math.max(0, Math.min(1, (value - globalMin) / span));
    return yBottom - ratio * yRange;
  }

  return (
    <div className="trend-panel">
      <div className="trend-meta">
        <div>
          <strong>{metricLabel}</strong>
          <p>{`${zhCN.performanceReportPage.summarySeries} ${renderedSeries.length}`}</p>
        </div>
        <div>
          <strong>{`${formatValue(globalMin)} / ${formatValue(globalMax)}`}</strong>
          <p>{zhCN.performanceReportPage.rangeSeries}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label="性能报告趋势图">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
          {[20, 40, 60, 80].map((line) => (
            <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          {renderedSeries.map((item) => {
            const drawablePoints = item.points.map((point, index) => {
              if (typeof point.value !== "number") {
                return null;
              }
              const x = item.points.length <= 1 ? 50 : (index / (item.points.length - 1)) * 100;
              return {
                key: `${item.key}-${index}`,
                x,
                y: toY(point.value),
                label: point.label,
                value: point.value
              };
            });

            const segments: string[] = [];
            let currentSegment: Array<{ x: number; y: number }> = [];
            item.points.forEach((point, index) => {
              if (typeof point.value !== "number") {
                if (currentSegment.length > 1) {
                  segments.push(`M ${currentSegment.map((dot) => `${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`).join(" L ")}`);
                }
                currentSegment = [];
                return;
              }
              const x = item.points.length <= 1 ? 50 : (index / (item.points.length - 1)) * 100;
              currentSegment.push({ x, y: toY(point.value) });
            });
            if (currentSegment.length > 1) {
              segments.push(`M ${currentSegment.map((dot) => `${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`).join(" L ")}`);
            }

            return (
              <g key={item.key}>
                {segments.map((segment, index) => (
                  <path key={`${item.key}-seg-${index}`} d={segment} className="trend-line-path" style={{ stroke: item.color }} />
                ))}
                {drawablePoints
                  .filter((point): point is NonNullable<typeof point> => point != null)
                  .map((point) => (
                    <circle
                      key={point.key}
                      cx={point.x}
                      cy={point.y}
                      r={1.4}
                      className="trend-line-dot"
                      style={{ fill: item.color }}
                    >
                      <title>
                        {item.label}: {point.label} / {formatValue(point.value)}
                      </title>
                    </circle>
                  ))}
              </g>
            );
          })}
        </svg>
        <div className="trend-axis performance-axis">
          {axisLabels.map((label, index) => (
            <small key={`${label}-${index}`}>{label}</small>
          ))}
        </div>
      </div>
      <div className="trend-legend">
        {renderedSeries.map((item) => (
          <article key={`legend-${item.key}`} className="trend-legend-item">
            <header>
              <span className="trend-color-dot" style={{ backgroundColor: item.color }} />
              <strong>{item.label}</strong>
            </header>
            <p>
              latest {formatValue(item.latest)} · min {formatValue(item.min)} · max {formatValue(item.max)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function PerformanceReportPage() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const initialFilters = {
    metric: "systemEfficiency",
    startTime: formatDateTimeInput(start),
    endTime: formatDateTimeInput(now)
  };
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<FilterState>(initialFilters);
  const [data, setData] = useState<PerformanceReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const session = getAuthSession();
  const requestContext = {
    language: mapLegacyLanguage(),
    unit: "KW",
    modelKey: session?.defaultProjectKey || runtimeConfig.siteId,
    template: session?.defaultProjectTemplate || "1"
  };

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await fetchPerformanceReport(runtimeConfig.siteId, {
          metric: query.metric,
          startTime: toLegacyDateTime(query.startTime),
          endTime: toLegacyDateTime(query.endTime),
          ...requestContext
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(result);
          setLoadError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(null);
          setLoadError(zhCN.performanceReportPage.degraded);
          setLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [query, requestContext.language, requestContext.modelKey, requestContext.template, requestContext.unit]);

  const sourceSummary = summarizeSourceStatus([data?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([data?.sourceStatus], {
    labelMode: "short"
  });
  const bannerText = exportError
    || loadError
    || (loading ? zhCN.performanceReportPage.loading : sourceSummary.text);
  const summaryCards = buildSummaryCards(data, query);
  const strategyAuditCards = buildStrategyAuditCards(data, query, loadError);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
  }

  function handleSearch() {
    setQuery(filters);
    setExportError(null);
  }

  function handleReset() {
    setFilters(initialFilters);
    setQuery(initialFilters);
    setExportError(null);
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const file = await exportPerformanceReport(runtimeConfig.siteId, {
        startTime: toLegacyDateTime(filters.startTime),
        endTime: toLegacyDateTime(filters.endTime),
        ...requestContext
      });
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || "performance-report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setExportError(zhCN.performanceReportPage.exportFailed);
      });
    }
  }

  return (
    <div className="performance-report-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(loadError || exportError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="performance-report-header">
        <h2>{zhCN.performanceReportPage.heading}</h2>
        <p>{zhCN.performanceReportPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.performanceReportPage.sectionFilters}>
        <div className="performance-report-filter-grid">
          <label className="performance-report-field">
            <span>{zhCN.performanceReportPage.filterMetric}</span>
            <select value={filters.metric} onChange={(event) => updateFilter("metric", event.target.value)}>
              {METRIC_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="performance-report-field">
            <span>{zhCN.performanceReportPage.filterStartTime}</span>
            <input
              type="datetime-local"
              value={filters.startTime}
              max={filters.endTime}
              onChange={(event) => updateFilter("startTime", event.target.value)}
            />
          </label>
          <label className="performance-report-field">
            <span>{zhCN.performanceReportPage.filterEndTime}</span>
            <input
              type="datetime-local"
              value={filters.endTime}
              min={filters.startTime}
              onChange={(event) => updateFilter("endTime", event.target.value)}
            />
          </label>
        </div>
        <div className="performance-report-actions">
          <button type="button" className="performance-report-button is-primary" onClick={handleSearch}>
            {zhCN.performanceReportPage.search}
          </button>
          <button
            type="button"
            className="performance-report-button"
            onClick={handleReset}
            disabled={loading || exporting}
          >
            {zhCN.performanceReportPage.reset}
          </button>
          <button
            type="button"
            className="performance-report-button"
            onClick={handleExport}
            disabled={loading || exporting}
          >
            {exporting ? zhCN.performanceReportPage.exporting : zhCN.performanceReportPage.export}
          </button>
        </div>
      </SectionCard>

      <div className="performance-report-summary-grid">
        {summaryCards.map((item) => (
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

      <SectionCard title={zhCN.performanceReportPage.sectionSummary}>
        <div className="performance-report-meta">
          <span>{`${zhCN.performanceReportPage.rangeMetric} ${getMetricLabel(query.metric)}`}</span>
          <span>{`${zhCN.performanceReportPage.rangeSelected} ${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`}</span>
          <span>{`${zhCN.performanceReportPage.rangeSeries} ${data?.series?.length || 0}`}</span>
          <span>{`${zhCN.performanceReportPage.rangeLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
        </div>
        <div className="performance-report-tag-grid">
          {(data?.summaries || []).map((item) => (
            <article key={item.id || item.title} className="performance-report-tag">
              <strong>{item.label || item.tagName || "--"}</strong>
              <span>{item.tagName || "--"}</span>
              <p>{item.average || "--"}</p>
            </article>
          ))}
          {(data?.summaries || []).length === 0 ? (
            <div className="performance-report-empty-inline">{zhCN.performanceReportPage.empty}</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.performanceReportPage.sectionStrategy}>
        <div className="strategy-audit-grid">
          {strategyAuditCards.map((item) => (
            <article key={item.title} className={`strategy-audit-card tone-${item.tone}`}>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.performanceReportPage.sectionChart}>
        <PerformanceTrendChart data={data} metricLabel={getMetricLabel(query.metric)} loadError={loadError} />
      </SectionCard>
    </div>
  );
}

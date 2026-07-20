import { startTransition, useEffect, useState, type PointerEvent } from "react";
import "./PerformanceReportExtracted.css";
import { runtimeConfig } from "../config/runtimeConfig";
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
  shortLabel: string;
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
const PERFORMANCE_VALUE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2
});
const PERFORMANCE_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0
});

const METRIC_OPTIONS: MetricOption[] = [
  { id: "systemEfficiency", label: zhCN.performanceReportPage.metricSystemEfficiency, shortLabel: "制冷系统效率(kW/Rt)" },
  { id: "chillerEfficiency", label: zhCN.performanceReportPage.metricChillerEfficiency, shortLabel: "冷水机组效率" },
  { id: "coolingTowerEfficiency", label: zhCN.performanceReportPage.metricCoolingTowerEfficiency, shortLabel: "冷却塔效率" },
  { id: "chilledPumpEfficiency", label: zhCN.performanceReportPage.metricChilledPumpEfficiency, shortLabel: "冷冻水泵效率" },
  { id: "coolingPumpEfficiency", label: zhCN.performanceReportPage.metricCoolingPumpEfficiency, shortLabel: "冷却水泵效率" },
  { id: "chilledWaterTemperature", label: zhCN.performanceReportPage.metricChilledWaterTemperature, shortLabel: "冷冻水供/回温度" },
  { id: "chilledWaterTemperatureDiff", label: zhCN.performanceReportPage.metricChilledWaterTemperatureDiff, shortLabel: "冷冻水温差" },
  { id: "coolingWaterTemperature", label: zhCN.performanceReportPage.metricCoolingWaterTemperature, shortLabel: "冷却水供/回温度" },
  { id: "coolingWaterTemperatureDiff", label: zhCN.performanceReportPage.metricCoolingWaterTemperatureDiff, shortLabel: "冷却水温差" },
  { id: "chilledWaterFlow", label: zhCN.performanceReportPage.metricChilledWaterFlow, shortLabel: "冷冻水流量" },
  { id: "coolingWaterFlow", label: zhCN.performanceReportPage.metricCoolingWaterFlow, shortLabel: "冷却水流量" }
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openDateTimePicker(input: HTMLInputElement) {
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch (_error) {
      // Some browsers only allow showPicker during a trusted pointer gesture.
    }
  }
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

function splitMetricLabel(label: string): { name: string; unit: string } {
  const match = label.match(/^(.*?)\(([^)]+)\)$/);
  if (match) {
    return {
      name: match[1].trim(),
      unit: match[2].trim()
    };
  }
  if (label.includes("温度") || label.includes("温差")) {
    return {
      name: label,
      unit: "°C"
    };
  }
  return {
    name: label,
    unit: "--"
  };
}

function formatValue(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return PERFORMANCE_VALUE_FORMATTER.format(value);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return PERFORMANCE_COUNT_FORMATTER.format(value);
}

function formatSeriesDisplayLabel(label: string, metricName: string): string {
  const raw = String(label || "").trim();
  const dateMatch = raw.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  if (metricName && dateMatch) {
    return `${metricName} ${dateMatch[1]}`;
  }
  if (metricName && /efficiency|temperature|flow|kw\/rt/i.test(raw)) {
    return metricName;
  }
  return raw.replace(/kW\/RT/gi, "kW/Rt") || metricName || "--";
}

function buildChartSeries(data: PerformanceReportDto | null, metricName: string): ChartSeriesView[] {
  const series = data?.series || [];
  return series.map((item, index) => {
    const points = (item.points || []).map((point) => ({
      label: point.label || "--",
      value: typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null
    }));
    const numeric = points.map((point) => point.value).filter((value): value is number => typeof value === "number");
    return {
      key: item.id || `series-${index + 1}`,
      label: formatSeriesDisplayLabel(item.name || `series-${index + 1}`, metricName),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points,
      latest: numeric.length > 0 ? numeric[numeric.length - 1] : null,
      min: numeric.length > 0 ? Math.min(...numeric) : null,
      max: numeric.length > 0 ? Math.max(...numeric) : null
    };
  });
}

function summarizeSeries(series: ChartSeriesView[]): {
  seriesCount: number;
  pointCount: number;
  min: number | null;
  max: number | null;
  latest: number | null;
} {
  const numericValues = series
    .flatMap((item) => item.points.map((point) => point.value))
    .filter((value): value is number => typeof value === "number");
  const latest = [...series]
    .reverse()
    .flatMap((item) => [...item.points].reverse().map((point) => point.value))
    .find((value): value is number => typeof value === "number");

  return {
    seriesCount: series.length,
    pointCount: numericValues.length,
    min: numericValues.length > 0 ? Math.min(...numericValues) : null,
    max: numericValues.length > 0 ? Math.max(...numericValues) : null,
    latest: latest ?? null
  };
}

function formatTimeSpan(startTime: string, endTime: string): string {
  const start = new Date(startTime.replace("T", " "));
  const end = new Date(endTime.replace("T", " "));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "--";
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  return `${days}天`;
}

function formatSourceEndpoint(value: string | null | undefined): string {
  const endpoint = String(value || "").trim();
  if (!endpoint) {
    return "--";
  }
  return "性能数据源";
}

function formatCompactAxisLabel(label: string): string {
  const normalized = label.trim();
  const match = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}:\d{2})/);
  if (match) {
    return `${match[2]}-${match[3]} ${match[4]}`;
  }
  return normalized.length > 12 ? `${normalized.slice(0, 12)}...` : normalized;
}

function buildMarkdownReport({
  metricName,
  metricUnit,
  query,
  latestFetchText,
  stats,
  series
}: {
  metricName: string;
  metricUnit: string;
  query: FilterState;
  latestFetchText: string;
  stats: ReturnType<typeof summarizeSeries>;
  series: ChartSeriesView[];
}): string {
  const lines = [
    "# 性能报告",
    "",
    `- 指标：${metricName}`,
    `- 单位：${metricUnit}`,
    `- 时间范围：${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`,
    `- 最近拉取：${latestFetchText}`,
    `- 序列数：${formatCount(stats.seriesCount)}`,
    `- 有效点数：${formatCount(stats.pointCount)}`,
    `- 最新值：${formatValue(stats.latest)}`,
    `- 最小/最大：${formatValue(stats.min)} / ${formatValue(stats.max)}`,
    "",
    "| 序列 | 最新 | 最小 | 最大 |",
    "| --- | ---: | ---: | ---: |",
    ...series.map((item) => `| ${item.label} | ${formatValue(item.latest)} | ${formatValue(item.min)} | ${formatValue(item.max)} |`)
  ];
  return `${lines.join("\n")}\n`;
}

function PerformanceTrendChart({
  renderedSeries,
  axisLabels,
  loadError
}: {
  renderedSeries: ChartSeriesView[];
  axisLabels: string[];
  loadError: string | null;
}) {
  const numericValues = renderedSeries
    .flatMap((item) => item.points.map((point) => point.value))
    .filter((value): value is number => typeof value === "number");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (renderedSeries.length === 0 || numericValues.length === 0) {
    return (
      <div className="performance-report-compact-chart-empty">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint performance-report-empty-hint">{zhCN.performanceReportPage.empty}</p>
      </div>
    );
  }

  const globalMin = Math.min(...numericValues);
  const globalMax = Math.max(...numericValues);
  const span = globalMax === globalMin ? Math.max(Math.abs(globalMax), 1) : globalMax - globalMin;
  const yTop = 6;
  const yBottom = 94;
  const yRange = yBottom - yTop;
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    key: `tick-${ratio}`,
    top: yBottom - ratio * yRange,
    value: globalMin + span * ratio
  }));

  function toY(value: number): number {
    const ratio = Math.max(0, Math.min(1, (value - globalMin) / span));
    return yBottom - ratio * yRange;
  }

  const maxPointCount = Math.max(...renderedSeries.map((item) => item.points.length), 0);
  const activeHoverIndex =
    hoverIndex === null || maxPointCount <= 0 ? null : Math.max(0, Math.min(maxPointCount - 1, hoverIndex));
  const hoverX = activeHoverIndex === null ? null : maxPointCount <= 1 ? 50 : (activeHoverIndex / (maxPointCount - 1)) * 100;
  const hoverLabel =
    activeHoverIndex === null
      ? ""
      : axisLabels[activeHoverIndex] ||
        renderedSeries.find((item) => item.points[activeHoverIndex]?.label)?.points[activeHoverIndex]?.label ||
        `#${activeHoverIndex + 1}`;
  const hoverRows =
    activeHoverIndex === null
      ? []
      : renderedSeries
          .map((item) => {
            const point = item.points[activeHoverIndex];
            if (!point || typeof point.value !== "number") {
              return null;
            }
            return {
              id: `${item.key}-${activeHoverIndex}`,
              label: item.label,
              value: point.value,
              color: item.color
            };
          })
          .filter(
            (item): item is { id: string; label: string; value: number; color: string } => item !== null
          );
  const axisLabelItems =
    axisLabels.length <= 4
      ? axisLabels.map((label, index) => ({
          label,
          index
        }))
      : Array.from(new Set([0, Math.round((axisLabels.length - 1) / 3), Math.round(((axisLabels.length - 1) * 2) / 3), axisLabels.length - 1])).map(
          (index) => ({
            label: axisLabels[index],
            index
          })
        );

  function handleChartPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (maxPointCount <= 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextIndex = maxPointCount <= 1 ? 0 : Math.round(ratio * (maxPointCount - 1));
    setHoverIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  return (
    <div className="performance-report-compact-chart">
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label="性能报告趋势图">
        <div className="performance-report-chart-grid">
          <div className="performance-report-y-axis" aria-hidden="true">
            {yTicks.map((tick) => (
              <span key={tick.key} style={{ top: `${tick.top}%` }}>
                {formatValue(tick.value)}
              </span>
            ))}
          </div>
          <div className="performance-report-chart-plot">
            <div
              className="performance-report-chart-interactive"
              onPointerMove={handleChartPointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
                {yTicks.map((tick) => (
                  <line
                    key={`grid-${tick.key}`}
                    x1="0"
                    y1={tick.top}
                    x2="100"
                    y2={tick.top}
                    className="trend-grid-line"
                  />
                ))}
                {renderedSeries.map((item) => {
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
                    </g>
                  );
                })}
                {hoverX !== null ? (
                  <line x1={hoverX} y1="0" x2={hoverX} y2="100" className="performance-report-hover-line" aria-hidden="true" />
                ) : null}
              </svg>
              {hoverX !== null && hoverRows.length > 0 ? (
                <div className={`performance-report-chart-tooltip${hoverX > 52 ? " is-left" : ""}`} style={{ left: `${hoverX}%` }}>
                  <strong>{hoverLabel}</strong>
                  {hoverRows.map((item) => (
                    <span key={item.id}>
                      <i style={{ backgroundColor: item.color }} />
                      <em>{item.label}</em>
                      <b>{formatValue(item.value)}</b>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="trend-axis performance-axis performance-report-compact-axis">
              {axisLabelItems.map((item) => (
                <small
                  key={`${item.label}-${item.index}`}
                  style={{
                    left: `${axisLabels.length <= 1 ? 0 : (item.index / (axisLabels.length - 1)) * 100}%`
                  }}
                >
                  {formatCompactAxisLabel(item.label)}
                </small>
              ))}
            </div>
          </div>
        </div>
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

  const latestFetchText = formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp);
  const queryMetricLabel = getMetricLabel(query.metric);
  const queryMetricParts = splitMetricLabel(queryMetricLabel);
  const renderedSeries = buildChartSeries(data, queryMetricParts.name);
  const seriesStats = summarizeSeries(renderedSeries);
  const axisLabels = data?.axisLabels || renderedSeries[0]?.points?.map((item) => item.label) || [];
  const querySource = data?.sourceStatus?.sources?.[0];
  const querySourceHealthy = !loadError && data?.sourceStatus?.overall !== "failed";
  const dataAnalyzable = querySourceHealthy && seriesStats.pointCount > 0;
  const interfaceStatusText = loading ? "加载中" : querySourceHealthy ? "数据正常" : "数据异常";
  const timeSpanText = formatTimeSpan(query.startTime, query.endTime);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleMetricChange(metric: string) {
    setFilters((current) => {
      const next = {
        ...current,
        metric
      };
      setQuery(next);
      return next;
    });
  }

  function handleSearch() {
    setQuery(filters);
  }

  function handleReset() {
    setFilters(initialFilters);
    setQuery(initialFilters);
  }

  async function handleExport() {
    setExporting(true);
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
      });
    }
  }

  function handleExportMarkdown() {
    const markdown = buildMarkdownReport({
      metricName: queryMetricParts.name,
      metricUnit: queryMetricParts.unit,
      query,
      latestFetchText,
      stats: seriesStats,
      series: renderedSeries
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const metricName = queryMetricParts.name.replace(/[\\/:*?"<>|\s]+/g, "-");
    link.href = url;
    link.download = `performance-report-${metricName || query.metric}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="performance-report-page performance-report-page--compact page-enter">
      <section className="performance-report-compact-head" aria-labelledby="performance-report-title">
        <div>
          <p className="performance-report-eyebrow">{`${runtimeConfig.appModeLabel} / 分析 / 性能报告`}</p>
          <h1 id="performance-report-title">{zhCN.performanceReportPage.heading}</h1>
        </div>
        <div className="performance-report-compact-status" aria-label="性能报告状态">
          <span className={querySourceHealthy ? "is-good" : "is-warn"}>{interfaceStatusText}</span>
          <span>{`指标 ${formatCount(METRIC_OPTIONS.length)} 项`}</span>
          <span>{`序列 ${formatCount(seriesStats.seriesCount)} 条`}</span>
          <span>{`最近拉取 ${latestFetchText}`}</span>
        </div>
      </section>

      <section className="performance-report-compact-filters" aria-label={zhCN.performanceReportPage.sectionFilters}>
        <div
          className="performance-report-compact-metrics"
          role="radiogroup"
          aria-label={zhCN.performanceReportPage.filterMetric}
        >
          <span className="performance-report-filter-label">{zhCN.performanceReportPage.filterMetric}</span>
          <div className="performance-report-metric-radio-group">
            {METRIC_OPTIONS.map((item) => (
              <label
                key={item.id}
                className={`performance-report-metric-radio${filters.metric === item.id ? " is-active" : ""}`}
                title={item.label}
              >
                <input
                  type="radio"
                  name="performance-report-metric"
                  value={item.id}
                  checked={filters.metric === item.id}
                  onChange={(event) => handleMetricChange(event.target.value)}
                />
                <span>{item.shortLabel}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="performance-report-compact-query">
          <label className="performance-report-field">
            <span>{zhCN.performanceReportPage.filterStartTime}</span>
            <input
              type="datetime-local"
              value={filters.startTime}
              max={filters.endTime}
              onClick={(event) => openDateTimePicker(event.currentTarget)}
              onChange={(event) => updateFilter("startTime", event.target.value)}
            />
          </label>
          <label className="performance-report-field">
            <span>{zhCN.performanceReportPage.filterEndTime}</span>
            <input
              type="datetime-local"
              value={filters.endTime}
              min={filters.startTime}
              onClick={(event) => openDateTimePicker(event.currentTarget)}
              onChange={(event) => updateFilter("endTime", event.target.value)}
            />
          </label>
          <div className="performance-report-actions">
            <button type="button" className="performance-report-button is-primary is-compact-action" onClick={handleSearch}>
              {zhCN.performanceReportPage.search}
            </button>
            <button
              type="button"
              className="performance-report-button is-export-action"
              onClick={handleExport}
              disabled={loading || exporting}
            >
              {exporting ? zhCN.performanceReportPage.exporting : zhCN.performanceReportPage.export}
            </button>
            <button type="button" className="performance-report-button is-export-action" onClick={handleExportMarkdown}>
              导出文本
            </button>
            <button
              type="button"
              className="performance-report-button is-compact-action"
              onClick={handleReset}
              disabled={loading || exporting}
            >
              {zhCN.performanceReportPage.reset}
            </button>
          </div>
        </div>
      </section>

      <section className="performance-report-compact-main" aria-label="性能报告分析结果">
        <article className="performance-report-compact-panel performance-report-compact-chart-panel">
          <header>
            <h3>{`${queryMetricParts.name}趋势`}</h3>
            <span>{`${zhCN.performanceReportPage.rangeSelected} ${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`}</span>
          </header>
          <div className="performance-report-compact-kpis" aria-label="指标摘要">
            <article>
              <span>当前指标</span>
              <strong>{queryMetricParts.name}</strong>
            </article>
            <article>
              <span>单位</span>
              <strong>{queryMetricParts.unit}</strong>
            </article>
            <article>
              <span>{zhCN.performanceReportPage.summarySeries}</span>
              <strong className="is-good">{formatCount(seriesStats.seriesCount)}</strong>
            </article>
            <article>
              <span>最小 / 最大</span>
              <strong>{`${formatValue(seriesStats.min)} / ${formatValue(seriesStats.max)}`}</strong>
            </article>
            <article>
              <span>最新值</span>
              <strong className="is-good">{formatValue(seriesStats.latest)}</strong>
            </article>
          </div>
          <PerformanceTrendChart renderedSeries={renderedSeries} axisLabels={axisLabels} loadError={loadError} />
        </article>

        <aside className="performance-report-compact-side" aria-label="性能报告侧栏">
          <article className="performance-report-compact-panel performance-report-summary-panel">
            <header>
              <h3>{zhCN.performanceReportPage.sectionSummary}</h3>
              <span>当前筛选</span>
            </header>
            <div className="performance-report-summary-grid">
              <article>
                <span>报告指标</span>
                <strong>{queryMetricParts.name}</strong>
              </article>
              <article>
                <span>数据状态</span>
                <strong className={dataAnalyzable ? "is-good" : "is-warn"}>{dataAnalyzable ? "可分析" : "待检查"}</strong>
              </article>
              <article>
                <span>时间跨度</span>
                <strong>{timeSpanText}</strong>
              </article>
              <article>
                <span>展示单位</span>
                <strong>{queryMetricParts.unit}</strong>
              </article>
            </div>
          </article>

          <article className="performance-report-compact-panel performance-report-series-panel">
            <header>
              <h3>序列统计</h3>
              <span>最新 / 最小 / 最大</span>
            </header>
            <div className="performance-report-series-list">
              {renderedSeries.length > 0 ? (
                renderedSeries.map((item) => (
                  <article key={item.key} className="performance-report-series-row">
                    <i style={{ backgroundColor: item.color }} />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{`最小 ${formatValue(item.min)} / 最大 ${formatValue(item.max)}`}</span>
                    </div>
                    <em>{formatValue(item.latest)}</em>
                  </article>
                ))
              ) : (
                <p className="performance-report-compact-empty">{loadError || zhCN.performanceReportPage.empty}</p>
              )}
            </div>
          </article>

          <article className="performance-report-compact-panel performance-report-source-panel">
            <header>
              <h3>数据口径</h3>
              <span>来源校验</span>
            </header>
            <div className="performance-report-source-list">
              <article>
                <span>查询来源</span>
                <strong className={querySourceHealthy ? "is-good" : "is-warn"}>{querySourceHealthy ? "正常" : "异常"}</strong>
                <em>{formatSourceEndpoint(querySource?.endpoint)}</em>
              </article>
              <article>
                <span>导出能力</span>
                <strong className="is-good">可用</strong>
                <em>PDF / 文本报告</em>
              </article>
              <article>
                <span>展示口径</span>
                <strong className="is-good">一致</strong>
                <em>筛选与图表同步</em>
              </article>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

import { useState, type PointerEvent } from "react";
import type { DashboardTrendSeriesDto, DashboardTrendStatDto } from "../../services/bffClient";
import { zhCN } from "../../i18n/zhCN";

type Range = "24h" | "7d" | "30d";

type Point = {
  label: string;
  tooltipLabel: string;
  value: number | null;
};

type TrendSeriesView = {
  key: string;
  label: string;
  color: string;
  points: Point[];
  latest: number | null;
  min: number | null;
  max: number | null;
};

type AxisTick = {
  key: string;
  label: string;
  left: number;
};

const METRIC_PRIORITY = ["totalPowerKw", "currentCop", "chilledDeltaT", "coolingDeltaT"];
const METRIC_LABELS: Record<string, string> = {
  totalPowerKw: zhCN.trendAnalysis.metricTotalPower,
  currentCop: zhCN.trendAnalysis.metricCop,
  chilledDeltaT: zhCN.trendAnalysis.metricChilledDelta,
  coolingDeltaT: zhCN.trendAnalysis.metricCoolingDelta
};
const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b"];
const MIN_CONTINUOUS_POINTS = 3;
const CHILLED_LOW_DELTA_T = 3;
const CHILLED_READY_DELTA_T = 4;
const COOLING_LOW_DELTA_T = 2.5;
const COOLING_READY_DELTA_T = 3.5;
const TREND_PANEL_NUMBER_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function renderTrendLoadingCard() {
  return (
    <div className="trend-loading-card" role="status" aria-live="polite">
      <strong>正在加载趋势数据</strong>
      <span>正在拉取多日小时曲线，请稍候...</span>
    </div>
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatTrendLabel(value: string, range: Range): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  if (range === "24h") {
    return `${String(date.getHours()).padStart(2, "0")}时`;
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours()
  ).padStart(2, "0")}时`;
}

function formatTrendTooltipLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0"
  )}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function downsample(points: Point[], target = 24): Point[] {
  if (points.length <= target) {
    return points;
  }
  const sampled: Point[] = [];
  const step = (points.length - 1) / (target - 1);
  for (let i = 0; i < target; i += 1) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

function getMaxTrendPoints(range: Range, keepFullResolution: boolean): number {
  if (keepFullResolution) {
    if (range === "7d") {
      return 7 * 24;
    }
    if (range === "30d") {
      return 30 * 24;
    }
    return 24;
  }
  return range === "24h" ? 24 : range === "7d" ? 21 : 30;
}

function buildAxisTicks(points: Point[], range: Range, dense = false): AxisTick[] {
  if (points.length === 0) {
    return [];
  }

  if (!dense) {
    const midIndex = Math.floor((points.length - 1) / 2);
    const indexes = Array.from(new Set([0, midIndex, points.length - 1]));
    return indexes.map((index) => ({
      key: `${index}-${points[index]?.label || "--"}`,
      label: points[index]?.label || "--",
      left: points.length <= 1 ? 50 : (index / (points.length - 1)) * 100
    }));
  }

  const step = range === "24h" ? 1 : range === "7d" ? 24 : 72;
  const indexes = points
    .map((_, index) => index)
    .filter((index) => index % step === 0);
  if (!indexes.includes(points.length - 1)) {
    indexes.push(points.length - 1);
  }

  return indexes.map((index) => ({
    key: `${index}-${points[index]?.label || "--"}`,
    label: points[index]?.label || "--",
    left: points.length <= 1 ? 50 : (index / (points.length - 1)) * 100
  }));
}

function metricRank(metric: string | undefined, index: number): number {
  if (!metric) {
    return METRIC_PRIORITY.length + index;
  }
  const ranked = METRIC_PRIORITY.indexOf(metric);
  return ranked >= 0 ? ranked : METRIC_PRIORITY.length + index;
}

function prettifyMetric(metric: string | undefined): string {
  if (!metric) {
    return zhCN.trend.defaultTitle;
  }
  return metric
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getMetricLabel(metric: string | undefined, fallback?: string | null): string {
  if (metric && METRIC_LABELS[metric]) {
    return METRIC_LABELS[metric];
  }
  return fallback || prettifyMetric(metric);
}

function longestValidRun(points: Point[]): number {
  let best = 0;
  let current = 0;
  for (const point of points) {
    if (isFiniteNumber(point.value)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function hasAnyValidPoint(points: Point[]): boolean {
  return points.some((point) => isFiniteNumber(point.value));
}

function formatNumber(value: number | null): string {
  if (!isFiniteNumber(value)) {
    return "--";
  }
  return TREND_PANEL_NUMBER_FORMATTER.format(value);
}

function assessCopTone(value: number | null | undefined): "good" | "neutral" | "warn" | null {
  if (!isFiniteNumber(value) || value <= 0) {
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
  if (!isFiniteNumber(value)) {
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
  const tone = assessDeltaTone(metric, value);
  return tone ? `trend-metric-value tone-${tone}` : "";
}

function getDeltaToneHint(metric: string | null | undefined, value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
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
  if (metric !== "currentCop" || !isFiniteNumber(value) || value <= 0) {
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
  return getCopToneHint(metric, value) || getDeltaToneHint(metric, value);
}

function buildSeriesViews(
  series: DashboardTrendSeriesDto[],
  stats: DashboardTrendStatDto[],
  range: Range,
  keepFullResolution = false
): TrendSeriesView[] {
  const maxPoints = getMaxTrendPoints(range, keepFullResolution);
  const ranked = series
    .map((item, index) => ({ item, rank: metricRank(item.metric, index), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
    .filter((item) => (item.points?.length ?? 0) > 0)
    .slice(0, 4);

  return ranked.map((item, index) => {
    const rawPoints =
      item.points?.map((point) => ({
        timestamp: point.t ? Date.parse(point.t) : Number.NaN,
        label: point.t ? formatTrendLabel(point.t, range) : "--",
        tooltipLabel: point.t ? formatTrendTooltipLabel(point.t) : "--",
        value: isFiniteNumber(point.v) ? point.v : null
      }))
        .sort((left, right) => {
          if (Number.isFinite(left.timestamp) && Number.isFinite(right.timestamp)) {
            return left.timestamp - right.timestamp;
          }
          if (Number.isFinite(left.timestamp)) {
            return -1;
          }
          if (Number.isFinite(right.timestamp)) {
            return 1;
          }
          return 0;
        })
        .map(({ label, tooltipLabel, value }) => ({ label, tooltipLabel, value })) ?? [];
    const points = downsample(rawPoints, maxPoints);
    const numericValues = points.map((point) => point.value).filter(isFiniteNumber);
    const stat = stats.find((candidate) => candidate.metric === item.metric);

    return {
      key: item.metric || `trend-${index + 1}`,
      label: getMetricLabel(item.metric, item.label),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points,
      latest: isFiniteNumber(stat?.latest) ? stat.latest : numericValues[numericValues.length - 1] ?? null,
      min: isFiniteNumber(stat?.min) ? stat.min : (numericValues.length ? Math.min(...numericValues) : null),
      max: isFiniteNumber(stat?.max) ? stat.max : (numericValues.length ? Math.max(...numericValues) : null)
    };
  });
}

export default function TrendPanel({
  range,
  series,
  stats,
  freshnessStale,
  degradedHint,
  interactive = false,
  loading = false
}: {
  range: Range;
  series: DashboardTrendSeriesDto[];
  stats: DashboardTrendStatDto[];
  freshnessStale: boolean;
  degradedHint: string | null;
  interactive?: boolean;
  loading?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const renderedSeries = buildSeriesViews(series, stats, range, interactive);
  const validSeries = renderedSeries.filter((item) =>
    interactive ? hasAnyValidPoint(item.points) : longestValidRun(item.points) >= MIN_CONTINUOUS_POINTS
  );
  const continuityHint =
    renderedSeries.length > 0 && validSeries.length === 0
      ? zhCN.trend.continuityHint
      : null;

  if (renderedSeries.length === 0) {
    return (
      <div className="trend-panel">
        <div className="trend-meta">
          <div>
            <strong>{zhCN.trend.titleLoadPower}</strong>
            <p>
              {zhCN.trend.rangePrefix} {range.toUpperCase()}
            </p>
          </div>
        </div>
        {freshnessStale ? <p className="empty-hint">{zhCN.trend.staleData}</p> : null}
        {degradedHint ? <p className="empty-hint">{degradedHint}</p> : null}
        {loading ? renderTrendLoadingCard() : <p className="empty-hint">{zhCN.trend.noSeries}</p>}
      </div>
    );
  }

  if (validSeries.length === 0) {
    return (
      <div className="trend-panel">
        <div className="trend-meta">
          <div>
            <strong>{zhCN.trend.titleLoadPower}</strong>
            <p>
              {zhCN.trend.rangePrefix} {range.toUpperCase()}
            </p>
          </div>
        </div>
        {freshnessStale ? <p className="empty-hint">{zhCN.trend.staleData}</p> : null}
        {degradedHint ? <p className="empty-hint">{degradedHint}</p> : null}
        {continuityHint ? <p className="empty-hint">{continuityHint}</p> : null}
      </div>
    );
  }

  const allValues = validSeries
    .flatMap((item) => item.points.map((point) => point.value))
    .filter((value): value is number => isFiniteNumber(value));

  if (allValues.length === 0) {
    return (
      <div className="trend-panel">
        <div className="trend-meta">
          <div>
            <strong>{zhCN.trend.titleMultiSeries}</strong>
            <p>
              {zhCN.trend.rangePrefix} {range.toUpperCase()}
            </p>
          </div>
        </div>
        {freshnessStale ? <p className="empty-hint">{zhCN.trend.staleData}</p> : null}
        {degradedHint ? <p className="empty-hint">{degradedHint}</p> : null}
        <p className="empty-hint">{zhCN.trend.emptyValues}</p>
      </div>
    );
  }

  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  const span = globalMax === globalMin ? Math.max(Math.abs(globalMax), 1) : globalMax - globalMin;
  const yTop = 6;
  const yBottom = 94;
  const yRange = yBottom - yTop;
  const primarySeries = [...validSeries].sort((a, b) => b.points.length - a.points.length)[0];
  const axisTicks = buildAxisTicks(primarySeries.points, range, interactive);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    top: yBottom - ratio * yRange,
    value: globalMin + span * ratio
  }));
  const maxPointCount = Math.max(0, ...validSeries.map((item) => item.points.length));

  function toY(value: number): number {
    const ratio = Math.max(0, Math.min(1, (value - globalMin) / span));
    return yBottom - ratio * yRange;
  }

  function getPointX(points: Point[], index: number): number {
    return points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
  }

  function getAlignedHoverPoint(item: TrendSeriesView, targetIndex: number | null, totalCount: number): Point | null {
    if (targetIndex === null || item.points.length === 0) {
      return null;
    }
    const pointIndex =
      totalCount <= 1 || item.points.length <= 1
        ? 0
        : Math.round((targetIndex / (totalCount - 1)) * (item.points.length - 1));
    return item.points[Math.max(0, Math.min(item.points.length - 1, pointIndex))] || null;
  }

  const hoverX =
    interactive && hoverIndex !== null && maxPointCount > 0
      ? maxPointCount <= 1
        ? 50
        : (hoverIndex / (maxPointCount - 1)) * 100
      : null;
  const hoverAnchor = getAlignedHoverPoint(primarySeries, hoverIndex, maxPointCount);
  const hoverLabel = hoverAnchor?.tooltipLabel || hoverAnchor?.label || (hoverIndex !== null ? `#${hoverIndex + 1}` : "");
  const hoverRows =
    hoverIndex !== null
      ? validSeries
          .map((item) => {
            const point = getAlignedHoverPoint(item, hoverIndex, maxPointCount);
            if (!point) {
              return null;
            }
            return {
              key: item.key,
              label: item.label,
              value: point.value,
              color: item.color
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  function handleChartPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || maxPointCount <= 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextIndex = maxPointCount <= 1 ? 0 : Math.round(ratio * (maxPointCount - 1));
    setHoverIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  return (
    <div className="trend-panel">
      <div className="trend-meta">
        <div>
          <strong>{zhCN.trend.titleMultiSeries}</strong>
          <p>
            {zhCN.trend.rangePrefix} {range.toUpperCase()}
          </p>
        </div>
        <div>
          <strong>
            {validSeries.length} {zhCN.trend.activeMetricsSuffix}
          </strong>
          <p>
            {zhCN.trend.globalMinMaxPrefix} {formatNumber(globalMin)} {zhCN.trend.globalMinMaxMiddle} {formatNumber(globalMax)}
          </p>
        </div>
      </div>
      {freshnessStale ? <p className="empty-hint">{zhCN.trend.staleData}</p> : null}
      {degradedHint ? <p className="empty-hint">{degradedHint}</p> : null}
      <div className={`trend-chart-shell${interactive ? " trend-chart-shell--interactive" : ""}${loading ? " is-loading" : ""}`} aria-label="驾驶舱多序列趋势图">
        {interactive ? (
          <div className="trend-analysis-y-axis" aria-hidden="true">
            {yTicks.map((tick) => (
              <span key={`${tick.top}-${tick.value}`} style={{ top: `${tick.top}%` }}>
                {formatNumber(tick.value)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="trend-chart-plot-stack">
          <div
            className={interactive ? "trend-chart-interactive" : undefined}
            onPointerMove={interactive ? handleChartPointerMove : undefined}
            onPointerLeave={interactive ? () => setHoverIndex(null) : undefined}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
              {[20, 40, 60, 80].map((line) => (
                <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
              ))}
              {validSeries.map((item) => {
                const pointsWithCoords = item.points.map((point, index) => {
                  if (!isFiniteNumber(point.value)) {
                    return null;
                  }
                  const x = getPointX(item.points, index);
                  return {
                    key: `${item.key}-${index}`,
                    x,
                    y: toY(point.value),
                    label: point.label,
                    tooltipLabel: point.tooltipLabel,
                    value: point.value
                  };
                });

                const segments: string[] = [];
                let currentSegment: Array<{ x: number; y: number }> = [];
                item.points.forEach((point, index) => {
                  if (!isFiniteNumber(point.value)) {
                    if (currentSegment.length > 1) {
                      segments.push(`M ${currentSegment.map((dot) => `${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`).join(" L ")}`);
                    }
                    currentSegment = [];
                    return;
                  }
                  currentSegment.push({ x: getPointX(item.points, index), y: toY(point.value) });
                });
                if (currentSegment.length > 1) {
                  segments.push(`M ${currentSegment.map((dot) => `${dot.x.toFixed(2)} ${dot.y.toFixed(2)}`).join(" L ")}`);
                }

                return (
                  <g key={item.key}>
                    {segments.map((segment, index) => (
                      <path
                        key={`${item.key}-seg-${index}`}
                        d={segment}
                        className={`trend-line-path${interactive ? " trend-line-path--slim" : ""}`}
                        style={{ stroke: item.color }}
                      />
                    ))}
                    {!interactive
                      ? pointsWithCoords
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
                                {`${item.label}: ${point.tooltipLabel} / ${formatNumber(point.value)}${
                                  getMetricToneHint(item.key, point.value) ? ` · ${getMetricToneHint(item.key, point.value)}` : ""
                                }`}
                              </title>
                            </circle>
                          ))
                      : null}
                  </g>
                );
              })}
              {hoverX !== null ? (
                <g className="trend-hover-layer">
                  <line x1={hoverX} y1="0" x2={hoverX} y2="100" className="trend-hover-line" />
                </g>
              ) : null}
            </svg>
            {hoverX !== null && hoverRows.length > 0 ? (
              <div className={`trend-chart-tooltip${hoverX > 70 ? " is-left" : ""}`} style={{ left: `${hoverX}%` }}>
                <strong>{hoverLabel}</strong>
                {hoverRows.map((item) => (
                  <span key={item.key}>
                    <i style={{ backgroundColor: item.color }} />
                    <em>{item.label}</em>
                    <b
                      className={getMetricToneClass(item.key, item.value) || undefined}
                      title={getMetricToneHint(item.key, item.value) || undefined}
                    >
                      {formatNumber(item.value)}
                    </b>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div
            className={`trend-axis${interactive ? " trend-axis--dense" : ""}`}
            aria-hidden="true"
          >
            {axisTicks.map((tick) => (
              <small key={tick.key} style={interactive ? { left: `${tick.left}%` } : undefined}>
                {tick.label}
              </small>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="trend-chart-loading" role="status" aria-live="polite">
            <strong>正在加载趋势数据</strong>
            <span>时间范围切换后正在重新拉取，请稍候...</span>
          </div>
        ) : null}
      </div>
      <div className="trend-legend">
        {validSeries.map((item) => {
          const latestValue = formatNumber(item.latest);
          const minValue = formatNumber(item.min);
          const maxValue = formatNumber(item.max);
          const legendTitle = `${item.label}：${zhCN.trend.latest} ${latestValue}，${zhCN.trend.min} ${minValue}，${zhCN.trend.max} ${maxValue}`;

          return (
          <article key={`legend-${item.key}`} className="trend-legend-item" title={legendTitle} aria-label={legendTitle}>
            <header>
              <span className="trend-color-dot" style={{ backgroundColor: item.color }} />
              <strong>{item.label}</strong>
              <span
                className={["trend-legend-latest-value", getMetricToneClass(item.key, item.latest)].filter(Boolean).join(" ") || undefined}
                title={getMetricToneHint(item.key, item.latest) || undefined}
              >
                {latestValue}
              </span>
            </header>
          </article>
          );
        })}
      </div>
    </div>
  );
}


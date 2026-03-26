import type { DashboardTrendSeriesDto, DashboardTrendStatDto } from "../../services/bffClient";
import { zhCN } from "../../i18n/zhCN";

type Range = "24h" | "7d" | "30d";

type Point = {
  label: string;
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

const METRIC_PRIORITY = ["totalPowerKw", "currentCop", "chilledDeltaT", "coolingDeltaT"];
const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b"];
const MIN_CONTINUOUS_POINTS = 3;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatTrendLabel(value: string, range: Range): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  if (range === "24h") {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function formatNumber(value: number | null): string {
  if (!isFiniteNumber(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function buildSeriesViews(series: DashboardTrendSeriesDto[], stats: DashboardTrendStatDto[], range: Range): TrendSeriesView[] {
  const maxPoints = range === "24h" ? 24 : range === "7d" ? 21 : 30;
  const ranked = series
    .map((item, index) => ({ item, rank: metricRank(item.metric, index), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
    .filter((item) => (item.points?.length ?? 0) > 0)
    .slice(0, 4);

  return ranked.map((item, index) => {
    const rawPoints =
      item.points?.map((point) => ({
        label: point.t ? formatTrendLabel(point.t, range) : "--",
        value: isFiniteNumber(point.v) ? point.v : null
      })) ?? [];
    const points = downsample(rawPoints, maxPoints);
    const numericValues = points.map((point) => point.value).filter(isFiniteNumber);
    const stat = stats.find((candidate) => candidate.metric === item.metric);

    return {
      key: item.metric || `trend-${index + 1}`,
      label: item.label || prettifyMetric(item.metric),
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
  degradedHint
}: {
  range: Range;
  series: DashboardTrendSeriesDto[];
  stats: DashboardTrendStatDto[];
  freshnessStale: boolean;
  degradedHint: string | null;
}) {
  const renderedSeries = buildSeriesViews(series, stats, range);
  const validSeries = renderedSeries.filter((item) => longestValidRun(item.points) >= MIN_CONTINUOUS_POINTS);
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
        <p className="empty-hint">{zhCN.trend.noSeries}</p>
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
  const midIndex = Math.floor((primarySeries.points.length - 1) / 2);
  const axisLabels = [
    primarySeries.points[0]?.label || "--",
    primarySeries.points[midIndex]?.label || "--",
    primarySeries.points[primarySeries.points.length - 1]?.label || "--"
  ];

  function toY(value: number): number {
    const ratio = Math.max(0, Math.min(1, (value - globalMin) / span));
    return yBottom - ratio * yRange;
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
      <div className="trend-chart-shell" aria-label="驾驶舱多序列趋势图">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
          {[20, 40, 60, 80].map((line) => (
            <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          {validSeries.map((item) => {
            const pointsWithCoords = item.points.map((point, index) => {
              if (!isFiniteNumber(point.value)) {
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
              if (!isFiniteNumber(point.value)) {
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
                {pointsWithCoords
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
                        {item.label}: {point.label} / {formatNumber(point.value)}
                      </title>
                    </circle>
                  ))}
              </g>
            );
          })}
        </svg>
        <div className="trend-axis">
          {axisLabels.map((label, index) => (
            <small key={`${label}-${index}`}>{label}</small>
          ))}
        </div>
      </div>
      <div className="trend-legend">
        {validSeries.map((item) => (
          <article key={`legend-${item.key}`} className="trend-legend-item">
            <header>
              <span className="trend-color-dot" style={{ backgroundColor: item.color }} />
              <strong>{item.label}</strong>
            </header>
            <p>
              {zhCN.trend.latest} {formatNumber(item.latest)} · {zhCN.trend.min} {formatNumber(item.min)} · {zhCN.trend.max}{" "}
              {formatNumber(item.max)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

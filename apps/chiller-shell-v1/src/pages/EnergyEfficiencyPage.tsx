import { startTransition, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type EnergyEfficiencyCalendarDayDto,
  type EnergyEfficiencyCalendarDto,
  type EnergyEfficiencyCalendarPieDto,
  type EnergyEfficiencyImbalanceDto,
  type EnergyEfficiencyProportionDto,
  type EnergyEfficiencyReportDto,
  fetchEnergyEfficiencyCalendar,
  fetchEnergyEfficiencyCalendarPie,
  fetchEnergyEfficiencyCompare,
  fetchEnergyEfficiencyImbalance,
  fetchEnergyEfficiencyProportion,
  fetchEnergyEfficiencySearch
} from "../services/bffClient";

type TabKey = "calendar" | "search" | "compare" | "proportion" | "imbalance";

type CalendarMode = "day" | "month";

type CalendarFilterState = {
  month: string;
  mode: CalendarMode;
  selectedDate: string;
};

type SearchFilterState = {
  deviceKeys: string[];
  startDate: string;
  endDate: string;
  timeSpace: string;
};

type CompareFilterState = {
  deviceKey: string;
  dates: string[];
  dateDraft: string;
};

type ProportionFilterState = {
  dateType: "2" | "3";
  date: string;
};

type ImbalanceFilterState = {
  startDate: string;
  endDate: string;
};

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

const TAB_SET = new Set<TabKey>(["calendar", "search", "compare", "proportion", "imbalance"]);
const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];
const CALENDAR_PIE_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];
const CALENDAR_WEEKDAY_LABELS = [
  zhCN.energyEfficiencyPage.calendarWeekSun,
  zhCN.energyEfficiencyPage.calendarWeekMon,
  zhCN.energyEfficiencyPage.calendarWeekTue,
  zhCN.energyEfficiencyPage.calendarWeekWed,
  zhCN.energyEfficiencyPage.calendarWeekThu,
  zhCN.energyEfficiencyPage.calendarWeekFri,
  zhCN.energyEfficiencyPage.calendarWeekSat
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function addDays(date: Date, offset: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function buildSearchDefaults(): SearchFilterState {
  const now = new Date();
  return {
    deviceKeys: ["CoolingStation"],
    startDate: formatDateInput(addDays(now, -1)),
    endDate: formatDateInput(now),
    timeSpace: "1"
  };
}

function buildCompareDefaults(): CompareFilterState {
  const today = formatDateInput(new Date());
  return {
    deviceKey: "CoolingStation",
    dates: [today],
    dateDraft: today
  };
}

function buildProportionDefaults(): ProportionFilterState {
  const now = new Date();
  return {
    dateType: "2",
    date: formatMonthInput(now)
  };
}

function buildImbalanceDefaults(): ImbalanceFilterState {
  const now = new Date();
  return {
    startDate: formatDateInput(addDays(now, -1)),
    endDate: formatDateInput(now)
  };
}

function buildCalendarDefaults(): CalendarFilterState {
  const now = new Date();
  return {
    month: formatMonthInput(now),
    mode: "day",
    selectedDate: formatDateInput(now)
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function getActiveTab(searchParams: URLSearchParams): TabKey {
  const tab = searchParams.get("tab");
  return TAB_SET.has(tab as TabKey) ? (tab as TabKey) : "calendar";
}

function getDeviceOptions() {
  return [
    {
      value: "CoolingStation",
      label: zhCN.energyEfficiencyPage.deviceCoolingStation
    },
    {
      value: "CoolingWaterPump",
      label: zhCN.energyEfficiencyPage.deviceCoolingWaterPump
    },
    {
      value: "CoolingTower",
      label: zhCN.energyEfficiencyPage.deviceCoolingTower
    },
    {
      value: "ChilledWaterPump",
      label: zhCN.energyEfficiencyPage.deviceChilledWaterPump
    },
    {
      value: "ChillerUnit",
      label: zhCN.energyEfficiencyPage.deviceChillerUnit
    }
  ];
}

function getTimeSpaceLabel(value: string): string {
  if (value === "2") {
    return zhCN.energyEfficiencyPage.timeSpaceDay;
  }
  if (value === "3") {
    return zhCN.energyEfficiencyPage.timeSpaceMonth;
  }
  return zhCN.energyEfficiencyPage.timeSpaceHour;
}

function buildReportSummaryCards(
  data: EnergyEfficiencyReportDto | null,
  mode: TabKey,
  filters: SearchFilterState | CompareFilterState | Omit<CompareFilterState, "dateDraft">
): SummaryCard[] {
  const sourceReady = data?.sourceStatus?.overall === "ok";
  const seriesCount = data?.series?.length || 0;
  const objectCount = data?.tableRows?.length || 0;

  if (mode === "compare") {
    const compareFilters = filters as CompareFilterState;
    return [
      {
        title: zhCN.energyEfficiencyPage.summarySeries,
        value: String(seriesCount),
        unit: zhCN.energyEfficiencyPage.unitSeries,
        delta: zhCN.energyEfficiencyPage.summaryFilterHint,
        tone: seriesCount > 0 ? "good" : "neutral"
      },
      {
        title: zhCN.energyEfficiencyPage.summaryDates,
        value: String(compareFilters.dates.length),
        unit: zhCN.energyEfficiencyPage.unitDates,
        delta: zhCN.energyEfficiencyPage.summaryFilterHint,
        tone: compareFilters.dates.length > 0 ? "neutral" : "warn"
      },
      {
        title: zhCN.energyEfficiencyPage.summaryDevice,
        value: getDeviceOptions().find((item) => item.value === compareFilters.deviceKey)?.label || compareFilters.deviceKey,
        unit: "",
        delta: zhCN.energyEfficiencyPage.summaryCompareHint,
        tone: "neutral"
      },
      {
        title: zhCN.energyEfficiencyPage.summaryState,
        value: sourceReady ? zhCN.energyEfficiencyPage.stateReady : zhCN.energyEfficiencyPage.stateFallback,
        unit: "",
        delta: zhCN.energyEfficiencyPage.summaryStateHint,
        tone: sourceReady ? "good" : "warn"
      }
    ];
  }

  const searchFilters = filters as SearchFilterState;
  return [
    {
      title: zhCN.energyEfficiencyPage.summarySeries,
      value: String(seriesCount),
      unit: zhCN.energyEfficiencyPage.unitSeries,
      delta: zhCN.energyEfficiencyPage.summaryFilterHint,
      tone: seriesCount > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryObjects,
      value: String(objectCount),
      unit: zhCN.energyEfficiencyPage.unitObjects,
      delta: zhCN.energyEfficiencyPage.summaryFilterHint,
      tone: objectCount > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryRange,
      value: `${searchFilters.startDate} ~ ${searchFilters.endDate}`,
      unit: "",
      delta: `${zhCN.energyEfficiencyPage.summaryIntervalPrefix}${getTimeSpaceLabel(searchFilters.timeSpace)}`,
      tone: "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryState,
      value: sourceReady ? zhCN.energyEfficiencyPage.stateReady : zhCN.energyEfficiencyPage.stateFallback,
      unit: "",
      delta: zhCN.energyEfficiencyPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function buildProportionSummaryCards(data: EnergyEfficiencyProportionDto | null): SummaryCard[] {
  const rows = data?.rows || [];
  const numericRatios = rows.map((item) => item.loadRatioPct).filter((value): value is number => typeof value === "number");
  const numericEfficiency = rows.map((item) => item.stationEfficiency).filter((value): value is number => typeof value === "number");
  const averageRatio = numericRatios.length > 0
    ? numericRatios.reduce((sum, value) => sum + value, 0) / numericRatios.length
    : null;
  const bestEfficiency = numericEfficiency.length > 0 ? Math.max(...numericEfficiency) : null;
  const sourceReady = data?.sourceStatus?.overall === "ok";

  return [
    {
      title: zhCN.energyEfficiencyPage.summaryBuckets,
      value: String(rows.length),
      unit: zhCN.energyEfficiencyPage.unitBuckets,
      delta: zhCN.energyEfficiencyPage.summaryFilterHint,
      tone: rows.length > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryLoadRatio,
      value: formatNumber(averageRatio, 1),
      unit: "%",
      delta: zhCN.energyEfficiencyPage.summaryLoadRatioHint,
      tone: averageRatio != null ? "neutral" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryEfficiency,
      value: formatNumber(bestEfficiency, 2),
      unit: "kW/RT",
      delta: zhCN.energyEfficiencyPage.summaryEfficiencyHint,
      tone: bestEfficiency != null ? "good" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryState,
      value: sourceReady ? zhCN.energyEfficiencyPage.stateReady : zhCN.energyEfficiencyPage.stateFallback,
      unit: "",
      delta: zhCN.energyEfficiencyPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function buildImbalanceSummaryCards(
  data: EnergyEfficiencyImbalanceDto | null,
  filters: ImbalanceFilterState
): SummaryCard[] {
  const series = data?.series || [];
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");
  const sampleCount = Math.max(0, ...series.map((item) => item.points?.length || 0));
  const peakValue = numericValues.length > 0 ? Math.max(...numericValues.map((value) => Math.abs(value))) : null;
  const complianceValues = (data?.statisticsRows || [])
    .map((item) => item.scalarRate)
    .filter((value): value is number => typeof value === "number");
  const bestCompliance = complianceValues.length > 0 ? Math.max(...complianceValues) : null;
  const sourceReady = data?.sourceStatus?.overall === "ok";

  return [
    {
      title: zhCN.energyEfficiencyPage.summaryImbalancePoints,
      value: String(sampleCount),
      unit: zhCN.energyEfficiencyPage.unitSeries,
      delta: zhCN.energyEfficiencyPage.summaryFilterHint,
      tone: sampleCount > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryImbalancePeak,
      value: formatNumber(peakValue, 2),
      unit: "%",
      delta: zhCN.energyEfficiencyPage.summaryStateHint,
      tone: peakValue != null ? "warn" : "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryImbalanceCompliance,
      value: formatNumber(bestCompliance, 2),
      unit: "%",
      delta: `${filters.startDate} ~ ${filters.endDate}`,
      tone: bestCompliance != null ? "good" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryState,
      value: sourceReady ? zhCN.energyEfficiencyPage.stateReady : zhCN.energyEfficiencyPage.stateFallback,
      unit: "",
      delta: zhCN.energyEfficiencyPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function buildCalendarEntries(
  month: string,
  items: EnergyEfficiencyCalendarDayDto[] = []
): EnergyEfficiencyCalendarDayDto[] {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return items;
  }
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const byDate = new Map(
    items
      .filter((item) => item.date)
      .map((item) => [item.date as string, item] as const)
  );

  return Array.from({ length: daysInMonth }, (_unused, index) => {
    const day = pad(index + 1);
    const date = `${yearText}-${monthText}-${day}`;
    return byDate.get(date) || {
      id: date,
      date,
      day,
      hasData: false
    };
  });
}

function pickPreferredCalendarDate(items: EnergyEfficiencyCalendarDayDto[], month: string): string {
  const sorted = [...items].sort((left, right) => (left.date || "").localeCompare(right.date || ""));
  const today = formatDateInput(new Date());
  const currentMonth = month === formatMonthInput(new Date());

  if (currentMonth) {
    const todayItem = sorted.find((item) => item.date === today && item.hasData);
    if (todayItem?.date) {
      return todayItem.date;
    }
    const pastWithData = sorted.filter((item) => item.date && item.date <= today && item.hasData);
    if (pastWithData.length > 0) {
      return pastWithData[pastWithData.length - 1]?.date || `${month}-01`;
    }
  }

  const available = sorted.filter((item) => item.date && item.hasData);
  if (available.length > 0) {
    return available[available.length - 1]?.date || `${month}-01`;
  }

  return sorted[0]?.date || `${month}-01`;
}

function getCalendarQuality(item: EnergyEfficiencyCalendarDayDto | null | undefined): {
  tone: "excellent" | "good" | "attention" | "critical" | "missing" | "future";
  label: string;
} {
  const itemDate = item?.date || "";
  const isFuture = Boolean(itemDate) && itemDate > formatDateInput(new Date());

  if (isFuture) {
    return {
      tone: "future",
      label: zhCN.energyEfficiencyPage.calendarQualityFuture
    };
  }

  if (!item?.hasData || typeof item.rawEfficiency !== "number") {
    return {
      tone: "missing",
      label: zhCN.energyEfficiencyPage.calendarQualityMissing
    };
  }

  if (item.rawEfficiency >= 5) {
    return {
      tone: "excellent",
      label: zhCN.energyEfficiencyPage.calendarQualityExcellent
    };
  }
  if (item.rawEfficiency >= 4.1) {
    return {
      tone: "good",
      label: zhCN.energyEfficiencyPage.calendarQualityGood
    };
  }
  if (item.rawEfficiency >= 3.5) {
    return {
      tone: "attention",
      label: zhCN.energyEfficiencyPage.calendarQualityAttention
    };
  }
  return {
    tone: "critical",
    label: zhCN.energyEfficiencyPage.calendarQualityCritical
  };
}

function buildCalendarSummaryCards(
  item: EnergyEfficiencyCalendarDayDto | null,
  mode: CalendarMode,
  sourceReady: boolean
): SummaryCard[] {
  return [
    {
      title: zhCN.energyEfficiencyPage.calendarSelectedPeriod,
      value: item?.date || "--",
      unit: mode === "month" ? zhCN.energyEfficiencyPage.timeSpaceMonth : zhCN.energyEfficiencyPage.timeSpaceDay,
      delta: zhCN.energyEfficiencyPage.calendarSummaryRangeHint,
      tone: "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.calendarSummaryEfficiency,
      value: formatNumber(item?.efficiency, 2),
      unit: "kW/RT",
      delta: zhCN.energyEfficiencyPage.calendarSummaryStateHint,
      tone: typeof item?.efficiency === "number" ? "good" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.calendarSummaryPower,
      value: formatNumber(item?.power, 2),
      unit: "kW*h",
      delta: zhCN.energyEfficiencyPage.calendarSummaryRangeHint,
      tone: typeof item?.power === "number" ? "neutral" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryState,
      value: sourceReady ? zhCN.energyEfficiencyPage.stateReady : zhCN.energyEfficiencyPage.stateFallback,
      unit: "",
      delta: zhCN.energyEfficiencyPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function EnergyEfficiencySeriesChart({
  data,
  loadError
}: {
  data: EnergyEfficiencyReportDto | null;
  loadError: string | null;
}) {
  const series = data?.series || [];
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");

  if (series.length === 0 || numericValues.length === 0) {
    return (
      <div className="trend-panel">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">{zhCN.energyEfficiencyPage.chartEmpty}</p>
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
          <strong>{`${formatNumber(globalMin)} / ${formatNumber(globalMax)}`}</strong>
          <p>{zhCN.energyEfficiencyPage.chartRangeLabel}</p>
        </div>
        <div>
          <strong>{series.length}</strong>
          <p>{zhCN.energyEfficiencyPage.summarySeries}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label={zhCN.energyEfficiencyPage.chartAriaLabel}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
          {[20, 40, 60, 80].map((line) => (
            <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          {series.map((item, seriesIndex) => {
            const points = item.points || [];
            const path = points.reduce((segments, point, pointIndex) => {
              if (typeof point.value !== "number") {
                return segments;
              }
              const x = points.length <= 1 ? 50 : (pointIndex / (points.length - 1)) * 100;
              const y = toY(point.value);
              const prefix = segments.length === 0 ? "M" : "L";
              return `${segments} ${prefix} ${x.toFixed(2)} ${y.toFixed(2)}`.trim();
            }, "");

            return (
              <g key={item.id || `series-${seriesIndex + 1}`}>
                {path ? (
                  <path
                    d={path}
                    fill="none"
                    stroke={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {points.map((point, pointIndex) => {
                  if (typeof point.value !== "number") {
                    return null;
                  }
                  const x = points.length <= 1 ? 50 : (pointIndex / (points.length - 1)) * 100;
                  const y = toY(point.value);
                  return (
                    <circle
                      key={`${item.id || `series-${seriesIndex + 1}`}-${pointIndex + 1}`}
                      cx={x}
                      cy={y}
                      r="1.2"
                      fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="energy-efficiency-legend">
        {series.map((item, index) => (
          <div key={item.id || `legend-${index + 1}`} className="energy-efficiency-legend-item">
            <span
              className="energy-efficiency-legend-dot"
              style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <div>
              <strong>{item.name || zhCN.common.unknown}</strong>
              <p>{formatNumber(item.points?.[(item.points?.length || 1) - 1]?.value ?? null)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnergyEfficiencyProportionChart({
  data,
  loadError
}: {
  data: EnergyEfficiencyProportionDto | null;
  loadError: string | null;
}) {
  const rows = data?.rows || [];
  const ratioValues = rows.map((item) => item.loadRatioPct).filter((value): value is number => typeof value === "number");
  const efficiencyValues = rows.map((item) => item.stationEfficiency).filter((value): value is number => typeof value === "number");

  if (rows.length === 0 || ratioValues.length === 0) {
    return (
      <div className="trend-panel">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">{zhCN.energyEfficiencyPage.proportionEmpty}</p>
      </div>
    );
  }

  const maxRatio = Math.max(...ratioValues, 100);
  const maxEfficiency = efficiencyValues.length > 0 ? Math.max(...efficiencyValues) : 1;
  const barWidth = rows.length === 0 ? 12 : 70 / rows.length;
  const gap = rows.length <= 1 ? 0 : 20 / Math.max(rows.length - 1, 1);

  const points = rows.map((row, index) => {
    const x = 12 + index * (barWidth + gap) + barWidth / 2;
    const barHeight = typeof row.loadRatioPct === "number" ? (row.loadRatioPct / maxRatio) * 62 : 0;
    const lineY = typeof row.stationEfficiency === "number"
      ? 72 - (row.stationEfficiency / maxEfficiency) * 52
      : 72;
    return {
      key: row.id || `row-${index + 1}`,
      x,
      barHeight,
      lineY,
      ratio: row.loadRatioPct,
      efficiency: row.stationEfficiency,
      label: row.rangeLabel || `range-${index + 1}`
    };
  });

  const linePath = points
    .filter((item) => typeof item.efficiency === "number")
    .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x.toFixed(2)} ${item.lineY.toFixed(2)}`)
    .join(" ");

  return (
    <div className="trend-panel">
      <div className="trend-meta">
        <div>
          <strong>{formatNumber(Math.max(...ratioValues), 1)}%</strong>
          <p>{zhCN.energyEfficiencyPage.proportionRatioLabel}</p>
        </div>
        <div>
          <strong>{formatNumber(Math.max(...efficiencyValues), 2)}</strong>
          <p>{zhCN.energyEfficiencyPage.proportionEfficiencyLabel}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="energy-efficiency-proportion-shell" aria-label={zhCN.energyEfficiencyPage.proportionChartAriaLabel}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="energy-efficiency-proportion-chart">
          {[20, 40, 60, 80].map((line) => (
            <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          {points.map((point) => (
            <rect
              key={`bar-${point.key}`}
              x={point.x - barWidth / 2}
              y={72 - point.barHeight}
              width={barWidth}
              height={point.barHeight}
              rx="1.6"
              fill="rgba(99, 230, 255, 0.42)"
              stroke="rgba(99, 230, 255, 0.76)"
              strokeWidth="0.6"
            />
          ))}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="#8ff7d7"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {points.map((point) => (
            typeof point.efficiency === "number" ? (
              <circle key={`dot-${point.key}`} cx={point.x} cy={point.lineY} r="1.4" fill="#8ff7d7" />
            ) : null
          ))}
        </svg>
      </div>
      <div className="energy-efficiency-axis-list">
        {points.map((point) => (
          <div key={`label-${point.key}`} className="energy-efficiency-axis-item">
            <strong>{point.label}</strong>
            <span>{`${formatNumber(point.ratio, 1)}% / ${formatNumber(point.efficiency, 2)}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnergyEfficiencyCalendarPieChart({
  data,
  loadError
}: {
  data: EnergyEfficiencyCalendarPieDto | null;
  loadError: string | null;
}) {
  const segments = (data?.segments || []).filter((item) => typeof item.value === "number" && (item.value || 0) > 0);
  const total = typeof data?.total === "number"
    ? data.total
    : segments.reduce((sum, item) => sum + (item.value || 0), 0);

  if (segments.length === 0 || total <= 0) {
    return (
      <div className="trend-panel">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">{zhCN.energyEfficiencyPage.calendarPieEmpty}</p>
      </div>
    );
  }

  let cursor = 0;
  const stops = segments.map((item, index) => {
    const ratio = ((item.value || 0) / total) * 100;
    const start = cursor;
    const end = cursor + ratio;
    cursor = end;
    return `${CALENDAR_PIE_COLORS[index % CALENDAR_PIE_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return (
    <div className="energy-efficiency-calendar-pie-layout">
      <div className="energy-efficiency-calendar-donut" style={{ backgroundImage: `conic-gradient(${stops.join(", ")})` }}>
        <div className="energy-efficiency-calendar-donut-hole">
          <div>
            <strong>{formatNumber(total, 1)}</strong>
            <span>{zhCN.energyEfficiencyPage.calendarPieTotalLabel}</span>
          </div>
        </div>
      </div>
      <div className="energy-efficiency-calendar-pie-list" aria-label={zhCN.energyEfficiencyPage.calendarPieAriaLabel}>
        {segments.map((item, index) => {
          const value = item.value || 0;
          const ratio = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={item.id || `segment-${index + 1}`} className="energy-efficiency-calendar-pie-item">
              <span
                className="energy-efficiency-legend-dot"
                style={{ backgroundColor: CALENDAR_PIE_COLORS[index % CALENDAR_PIE_COLORS.length] }}
              />
              <div>
                <strong>{item.name || zhCN.common.unknown}</strong>
                <p>{`${formatNumber(value, 1)} kW*h`}</p>
              </div>
              <span>{`${formatNumber(ratio, 1)}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EnergyEfficiencyImbalanceChart({
  data,
  loadError
}: {
  data: EnergyEfficiencyImbalanceDto | null;
  loadError: string | null;
}) {
  const series = data?.series || [];
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");

  if (series.length === 0 || numericValues.length === 0) {
    return (
      <div className="trend-panel">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">{zhCN.energyEfficiencyPage.imbalanceEmpty}</p>
      </div>
    );
  }

  const maxAbs = Math.max(5, ...numericValues.map((value) => Math.abs(value)));
  const yTop = 8;
  const yBottom = 92;
  const yRange = yBottom - yTop;

  function toY(value: number): number {
    const normalized = (value + maxAbs) / (maxAbs * 2 || 1);
    return yBottom - normalized * yRange;
  }

  const thresholdTop = toY(5);
  const thresholdBottom = toY(-5);
  const baseline = toY(0);

  return (
    <div className="trend-panel">
      <div className="trend-meta">
        <div>
          <strong>{`${formatNumber(-maxAbs, 1)} / ${formatNumber(maxAbs, 1)}`}</strong>
          <p>{zhCN.energyEfficiencyPage.chartRangeLabel}</p>
        </div>
        <div>
          <strong>{zhCN.energyEfficiencyPage.imbalanceThresholdLabel}</strong>
          <p>{zhCN.energyEfficiencyPage.summaryStateHint}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label={zhCN.energyEfficiencyPage.imbalanceChartAriaLabel}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
          {[20, 40, 60, 80].map((line) => (
            <line key={`grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          <line x1="0" y1={baseline} x2="100" y2={baseline} stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
          <line
            x1="0"
            y1={thresholdTop}
            x2="100"
            y2={thresholdTop}
            stroke="rgba(255, 76, 137, 0.72)"
            strokeWidth="0.9"
            strokeDasharray="3 2"
          />
          <line
            x1="0"
            y1={thresholdBottom}
            x2="100"
            y2={thresholdBottom}
            stroke="rgba(255, 76, 137, 0.72)"
            strokeWidth="0.9"
            strokeDasharray="3 2"
          />
          {series.map((item, seriesIndex) => {
            const points = item.points || [];
            const path = points.reduce((segments, point, pointIndex) => {
              if (typeof point.value !== "number") {
                return segments;
              }
              const x = points.length <= 1 ? 50 : (pointIndex / (points.length - 1)) * 100;
              const y = toY(point.value);
              const prefix = segments.length === 0 ? "M" : "L";
              return `${segments} ${prefix} ${x.toFixed(2)} ${y.toFixed(2)}`.trim();
            }, "");

            return (
              <g key={item.id || `imbalance-series-${seriesIndex + 1}`}>
                {path ? (
                  <path
                    d={path}
                    fill="none"
                    stroke={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {points.map((point, pointIndex) => {
                  if (typeof point.value !== "number") {
                    return null;
                  }
                  const x = points.length <= 1 ? 50 : (pointIndex / (points.length - 1)) * 100;
                  const y = toY(point.value);
                  return (
                    <circle
                      key={`${item.id || `imbalance-series-${seriesIndex + 1}`}-${pointIndex + 1}`}
                      cx={x}
                      cy={y}
                      r="1.2"
                      fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="energy-efficiency-legend">
        {series.map((item, index) => (
          <div key={item.id || `imbalance-legend-${index + 1}`} className="energy-efficiency-legend-item">
            <span
              className="energy-efficiency-legend-dot"
              style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <div>
              <strong>{item.name || zhCN.common.unknown}</strong>
              <p>{formatNumber(item.points?.[(item.points?.length || 1) - 1]?.value ?? null)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnergyEfficiencyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getActiveTab(searchParams);

  const [calendarFilters, setCalendarFilters] = useState<CalendarFilterState>(buildCalendarDefaults());
  const [imbalanceFilters, setImbalanceFilters] = useState<ImbalanceFilterState>(buildImbalanceDefaults());
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(buildSearchDefaults());
  const [compareFilters, setCompareFilters] = useState<CompareFilterState>(buildCompareDefaults());
  const [proportionFilters, setProportionFilters] = useState<ProportionFilterState>(buildProportionDefaults());

  const [calendarQuery, setCalendarQuery] = useState<{ month: string } | null>(null);
  const [calendarPieQuery, setCalendarPieQuery] = useState<{ date: string; dateType: "1" | "2" } | null>(null);
  const [imbalanceQuery, setImbalanceQuery] = useState<ImbalanceFilterState | null>(null);
  const [searchQuery, setSearchQuery] = useState<SearchFilterState | null>(null);
  const [compareQuery, setCompareQuery] = useState<Omit<CompareFilterState, "dateDraft"> | null>(null);
  const [proportionQuery, setProportionQuery] = useState<ProportionFilterState | null>(null);

  const [calendarData, setCalendarData] = useState<EnergyEfficiencyCalendarDto | null>(null);
  const [calendarPieData, setCalendarPieData] = useState<EnergyEfficiencyCalendarPieDto | null>(null);
  const [imbalanceData, setImbalanceData] = useState<EnergyEfficiencyImbalanceDto | null>(null);
  const [searchData, setSearchData] = useState<EnergyEfficiencyReportDto | null>(null);
  const [compareData, setCompareData] = useState<EnergyEfficiencyReportDto | null>(null);
  const [proportionData, setProportionData] = useState<EnergyEfficiencyProportionDto | null>(null);

  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarPieError, setCalendarPieError] = useState<string | null>(null);
  const [imbalanceError, setImbalanceError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [proportionError, setProportionError] = useState<string | null>(null);

  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarPieLoading, setCalendarPieLoading] = useState(false);
  const [imbalanceLoading, setImbalanceLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [proportionLoading, setProportionLoading] = useState(false);

  const deviceOptions = useMemo(() => getDeviceOptions(), []);
  const calendarEntries = useMemo(
    () => buildCalendarEntries(calendarData?.month || calendarFilters.month, calendarData?.items || []),
    [calendarData, calendarFilters.month]
  );
  const selectedCalendarItem = useMemo(
    () => calendarEntries.find((item) => item.date === calendarFilters.selectedDate) || null,
    [calendarEntries, calendarFilters.selectedDate]
  );
  const activeCalendarItem = calendarFilters.mode === "month"
    ? calendarData?.monthSummary || null
    : selectedCalendarItem;

  useEffect(() => {
    if (TAB_SET.has(activeTab)) {
      return;
    }
    setSearchParams({ tab: "calendar" }, { replace: true });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (activeTab === "calendar" && !calendarQuery) {
      setCalendarQuery({ month: calendarFilters.month });
    }
    if (activeTab === "imbalance" && !imbalanceQuery) {
      setImbalanceQuery(imbalanceFilters);
    }
    if (activeTab === "search" && !searchQuery) {
      setSearchQuery(searchFilters);
    }
    if (activeTab === "compare" && !compareQuery) {
      setCompareQuery({
        deviceKey: compareFilters.deviceKey,
        dates: compareFilters.dates
      });
    }
    if (activeTab === "proportion" && !proportionQuery) {
      setProportionQuery(proportionFilters);
    }
  }, [
    activeTab,
    calendarFilters.month,
    calendarQuery,
    imbalanceFilters,
    imbalanceQuery,
    compareFilters,
    compareQuery,
    proportionFilters,
    proportionQuery,
    searchFilters,
    searchQuery
  ]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!calendarQuery) {
        return;
      }
      setCalendarLoading(true);
      try {
        const result = await fetchEnergyEfficiencyCalendar(runtimeConfig.siteId, calendarQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setCalendarData(result);
          setCalendarError(null);
          setCalendarLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setCalendarData(null);
          setCalendarError(zhCN.energyEfficiencyPage.calendarLoadFailed);
          setCalendarLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [calendarQuery]);

  useEffect(() => {
    if (calendarEntries.length === 0) {
      return;
    }
    const monthPrefix = `${calendarFilters.month}-`;
    const sameMonth = calendarFilters.selectedDate.startsWith(monthPrefix);
    const hasSelected = calendarEntries.some((item) => item.date === calendarFilters.selectedDate);
    if (sameMonth && hasSelected) {
      return;
    }
    const nextSelectedDate = pickPreferredCalendarDate(calendarEntries, calendarFilters.month);
    if (nextSelectedDate === calendarFilters.selectedDate) {
      return;
    }
    setCalendarFilters((current) => ({ ...current, selectedDate: nextSelectedDate }));
  }, [calendarEntries, calendarFilters.month, calendarFilters.selectedDate]);

  useEffect(() => {
    const date = calendarFilters.mode === "month"
      ? (calendarData?.month || calendarFilters.month)
      : calendarFilters.selectedDate;
    if (!date) {
      return;
    }
    const nextPieQuery = {
      date,
      dateType: calendarFilters.mode === "month" ? "2" : "1"
    } as const;
    if (
      calendarPieQuery?.date === nextPieQuery.date
      && calendarPieQuery?.dateType === nextPieQuery.dateType
    ) {
      return;
    }
    setCalendarPieQuery(nextPieQuery);
  }, [calendarData?.month, calendarFilters.mode, calendarFilters.month, calendarFilters.selectedDate, calendarPieQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!calendarPieQuery) {
        return;
      }
      setCalendarPieLoading(true);
      try {
        const result = await fetchEnergyEfficiencyCalendarPie(runtimeConfig.siteId, calendarPieQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setCalendarPieData(result);
          setCalendarPieError(null);
          setCalendarPieLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setCalendarPieData(null);
          setCalendarPieError(zhCN.energyEfficiencyPage.calendarPieLoadFailed);
          setCalendarPieLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [calendarPieQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!imbalanceQuery) {
        return;
      }
      setImbalanceLoading(true);
      try {
        const result = await fetchEnergyEfficiencyImbalance(runtimeConfig.siteId, imbalanceQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setImbalanceData(result);
          setImbalanceError(null);
          setImbalanceLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setImbalanceData(null);
          setImbalanceError(zhCN.energyEfficiencyPage.imbalanceLoadFailed);
          setImbalanceLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [imbalanceQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!searchQuery) {
        return;
      }
      setSearchLoading(true);
      try {
        const result = await fetchEnergyEfficiencySearch(runtimeConfig.siteId, searchQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setSearchData(result);
          setSearchError(null);
          setSearchLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setSearchData(null);
          setSearchError(zhCN.energyEfficiencyPage.searchLoadFailed);
          setSearchLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!compareQuery) {
        return;
      }
      setCompareLoading(true);
      try {
        const result = await fetchEnergyEfficiencyCompare(runtimeConfig.siteId, compareQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setCompareData(result);
          setCompareError(null);
          setCompareLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setCompareData(null);
          setCompareError(zhCN.energyEfficiencyPage.compareLoadFailed);
          setCompareLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [compareQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!proportionQuery) {
        return;
      }
      setProportionLoading(true);
      try {
        const result = await fetchEnergyEfficiencyProportion(runtimeConfig.siteId, proportionQuery);
        if (!active) {
          return;
        }
        startTransition(() => {
          setProportionData(result);
          setProportionError(null);
          setProportionLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setProportionData(null);
          setProportionError(zhCN.energyEfficiencyPage.proportionLoadFailed);
          setProportionLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [proportionQuery]);

  function switchTab(tab: TabKey) {
    setSearchParams({ tab }, { replace: true });
  }

  const activeData = activeTab === "calendar"
    ? calendarData
    : activeTab === "imbalance"
      ? imbalanceData
    : activeTab === "search"
      ? searchData
      : activeTab === "compare"
        ? compareData
        : proportionData;
  const activeStatuses = activeTab === "calendar"
    ? [calendarData?.sourceStatus, calendarPieData?.sourceStatus]
    : [activeData?.sourceStatus];
  const activeLoading = activeTab === "calendar"
    ? (calendarLoading || calendarPieLoading)
    : activeTab === "imbalance"
      ? imbalanceLoading
    : activeTab === "search"
      ? searchLoading
      : activeTab === "compare"
        ? compareLoading
        : proportionLoading;
  const activeError = activeTab === "calendar"
    ? (calendarError || calendarPieError)
    : activeTab === "imbalance"
      ? imbalanceError
    : activeTab === "search"
      ? searchError
      : activeTab === "compare"
        ? compareError
        : proportionError;

  const sourceSummary = summarizeSourceStatus(activeStatuses);
  const sourceStatusLines = buildSourceStatusLines(activeStatuses);
  const sourceStatusLinesCompact = buildSourceStatusLines(activeStatuses, { labelMode: "short" });
  const bannerText = activeError || (activeLoading ? zhCN.energyEfficiencyPage.loading : sourceSummary.text);

  function exportSearchCsv() {
    if (!searchData || (searchData.series?.length || 0) === 0) {
      setSearchError(zhCN.energyEfficiencyPage.exportEmpty);
      return;
    }
    const header = [
      zhCN.energyEfficiencyPage.exportTimeColumn,
      ...(searchData.series || []).map((item) => item.name || zhCN.common.unknown)
    ];
    const maxLength = Math.max(0, ...((searchData.series || []).map((item) => item.points?.length || 0)));
    const rows = Array.from({ length: maxLength }, (_unused, index) => {
      const label =
        searchData.axisLabels?.[index]
        || searchData.series?.[0]?.points?.[index]?.label
        || `point-${index + 1}`;
      return [
        label,
        ...((searchData.series || []).map((item) => formatNumber(item.points?.[index]?.value ?? null)))
      ];
    });
    downloadCsv(zhCN.energyEfficiencyPage.searchExportFileName, [header, ...rows]);
  }

  function exportCompareCsv() {
    if (!compareData || (compareData.series?.length || 0) === 0) {
      setCompareError(zhCN.energyEfficiencyPage.exportEmpty);
      return;
    }
    const header = [
      zhCN.energyEfficiencyPage.exportTimeColumn,
      ...(compareData.series || []).map((item) => item.name || zhCN.common.unknown)
    ];
    const maxLength = Math.max(0, ...((compareData.series || []).map((item) => item.points?.length || 0)));
    const rows = Array.from({ length: maxLength }, (_unused, index) => {
      const label =
        compareData.axisLabels?.[index]
        || compareData.series?.[0]?.points?.[index]?.label
        || `point-${index + 1}`;
      return [
        label,
        ...((compareData.series || []).map((item) => formatNumber(item.points?.[index]?.value ?? null)))
      ];
    });
    downloadCsv(zhCN.energyEfficiencyPage.compareExportFileName, [header, ...rows]);
  }

  function exportProportionCsv() {
    if (!proportionData || (proportionData.rows?.length || 0) === 0) {
      setProportionError(zhCN.energyEfficiencyPage.exportEmpty);
      return;
    }
    const rows = [
      [
        zhCN.energyEfficiencyPage.proportionTableRange,
        zhCN.energyEfficiencyPage.proportionTableRatio,
        zhCN.energyEfficiencyPage.proportionTableEfficiency
      ],
      ...(proportionData.rows || []).map((row) => [
        row.rangeLabel || "--",
        formatNumber(row.loadRatioPct, 1),
        formatNumber(row.stationEfficiency, 2)
      ])
    ];
    downloadCsv(zhCN.energyEfficiencyPage.proportionExportFileName, rows);
  }

  function exportImbalanceCsv() {
    if (!imbalanceData || (imbalanceData.series?.length || 0) === 0) {
      setImbalanceError(zhCN.energyEfficiencyPage.exportEmpty);
      return;
    }

    const header = [
      zhCN.energyEfficiencyPage.exportTimeColumn,
      ...(imbalanceData.series || []).map((item) => item.name || zhCN.common.unknown)
    ];
    const maxLength = Math.max(0, ...((imbalanceData.series || []).map((item) => item.points?.length || 0)));
    const seriesRows = Array.from({ length: maxLength }, (_unused, index) => {
      const label =
        imbalanceData.axisLabels?.[index]
        || imbalanceData.series?.[0]?.points?.[index]?.label
        || `point-${index + 1}`;
      return [
        label,
        ...((imbalanceData.series || []).map((item) => formatNumber(item.points?.[index]?.value ?? null, 2)))
      ];
    });

    const statsRows = [
      [],
      [
        zhCN.energyEfficiencyPage.imbalanceStatsAcquisitionValue,
        zhCN.energyEfficiencyPage.imbalanceStatsScalar,
        zhCN.energyEfficiencyPage.imbalanceStatsNoScalar,
        zhCN.energyEfficiencyPage.imbalanceStatsScalarRate
      ],
      ...((imbalanceData.statisticsRows || []).map((row) => [
        row.acquisitionValue || "--",
        formatNumber(row.scalar, 2),
        formatNumber(row.noScalar, 2),
        `${formatNumber(row.scalarRate, 2)}%`
      ]))
    ];

    const deviceRows = [
      [],
      [
        zhCN.energyEfficiencyPage.imbalanceDeviceName,
        zhCN.energyEfficiencyPage.imbalanceDeviceType,
        zhCN.energyEfficiencyPage.imbalanceDeviceScalarRate
      ],
      ...((imbalanceData.deviceRows || []).map((row) => [
        row.deviceName || "--",
        row.deviceTypeName || "--",
        `${formatNumber(row.scalarRate, 2)}%`
      ]))
    ];

    downloadCsv(zhCN.energyEfficiencyPage.imbalanceExportFileName, [header, ...seriesRows, ...statsRows, ...deviceRows]);
  }

  function renderCalendarTab() {
    const summaryCards = buildCalendarSummaryCards(
      activeCalendarItem,
      calendarFilters.mode,
      Boolean(calendarData?.sourceStatus || calendarPieData?.sourceStatus) && !sourceSummary.warn
    );
    const firstDayOffset = /^\d{4}-\d{2}$/.test(calendarFilters.month)
      ? new Date(`${calendarFilters.month}-01T00:00:00`).getDay()
      : 0;

    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters}>
          <div className="energy-efficiency-filter-grid calendar-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterMonth}</span>
              <input
                type="month"
                value={calendarFilters.month}
                onChange={(event) => {
                  const nextMonth = event.target.value;
                  setCalendarFilters((current) => ({
                    ...current,
                    month: nextMonth,
                    selectedDate: `${nextMonth}-01`
                  }));
                  setCalendarError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterCalendarMode}</span>
              <div className="energy-efficiency-toggle">
                <button
                  type="button"
                  className={calendarFilters.mode === "day" ? "active" : ""}
                  onClick={() => setCalendarFilters((current) => ({ ...current, mode: "day" }))}
                >
                  {zhCN.energyEfficiencyPage.calendarModeDay}
                </button>
                <button
                  type="button"
                  className={calendarFilters.mode === "month" ? "active" : ""}
                  onClick={() => setCalendarFilters((current) => ({ ...current, mode: "month" }))}
                >
                  {zhCN.energyEfficiencyPage.calendarModeMonth}
                </button>
              </div>
            </label>
          </div>
          <div className="energy-efficiency-actions">
            <button
              type="button"
              className="energy-efficiency-button is-primary"
              onClick={() => {
                if (!calendarFilters.month) {
                  setCalendarError(zhCN.energyEfficiencyPage.calendarMonthRequired);
                  return;
                }
                setCalendarQuery({ month: calendarFilters.month });
                setCalendarError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button"
              onClick={() => {
                const next = buildCalendarDefaults();
                setCalendarFilters(next);
                setCalendarQuery({ month: next.month });
                setCalendarError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionSummary}>
          <div className="energy-efficiency-summary-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.calendarSectionTitle}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(calendarData?.generatedAt || calendarData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.calendarMonthLabel} ${calendarFilters.month}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.calendarSelectedLabel} ${activeCalendarItem?.date || "--"}`}</span>
          </div>
          <div className="energy-efficiency-calendar-layout">
            <div className="energy-efficiency-calendar-panel">
              <div className="energy-efficiency-calendar-weekdays">
                {CALENDAR_WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="energy-efficiency-calendar-grid">
                {Array.from({ length: firstDayOffset }, (_unused, index) => (
                  <div key={`spacer-${index + 1}`} className="energy-efficiency-calendar-spacer" />
                ))}
                {calendarEntries.map((item) => {
                  const quality = getCalendarQuality(item);
                  const showMetrics = item.date ? item.date <= formatDateInput(new Date()) : false;
                  return (
                    <button
                      key={item.date || item.id}
                      type="button"
                      className={[
                        "energy-efficiency-calendar-day",
                        `quality-${quality.tone}`,
                        item.date === calendarFilters.selectedDate ? "is-selected" : "",
                        quality.tone === "future" ? "is-future" : ""
                      ].filter(Boolean).join(" ")}
                      onClick={() => {
                        if (!item.date) {
                          return;
                        }
                        setCalendarFilters((current) => ({ ...current, selectedDate: item.date || current.selectedDate, mode: "day" }));
                        setCalendarError(null);
                      }}
                    >
                      <header>
                        <strong>{item.day || "--"}</strong>
                        <span className={`energy-efficiency-calendar-badge quality-${quality.tone}`}>{quality.label}</span>
                      </header>
                      {showMetrics ? (
                        <div className="energy-efficiency-calendar-metrics">
                          <div className="energy-efficiency-calendar-metric">
                            <span>{zhCN.energyEfficiencyPage.calendarCellEfficiency}</span>
                            <strong>{formatNumber(item.efficiency, 2)}</strong>
                          </div>
                          <div className="energy-efficiency-calendar-metric">
                            <span>{zhCN.energyEfficiencyPage.calendarCellPower}</span>
                            <strong>{formatNumber(item.power, 1)}</strong>
                          </div>
                          <div className="energy-efficiency-calendar-metric">
                            <span>{zhCN.energyEfficiencyPage.calendarCellCooling}</span>
                            <strong>{formatNumber(item.cooling, 1)}</strong>
                          </div>
                          {typeof item.unitPrice === "number" ? (
                            <div className="energy-efficiency-calendar-metric">
                              <span>{zhCN.energyEfficiencyPage.calendarCellUnitPrice}</span>
                              <strong>{formatNumber(item.unitPrice, 2)}</strong>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="energy-efficiency-calendar-detail">
              <div className="energy-efficiency-calendar-detail-head">
                <div>
                  <h3>{activeCalendarItem?.date || "--"}</h3>
                  <p>{calendarFilters.mode === "month" ? zhCN.energyEfficiencyPage.calendarModeMonth : zhCN.energyEfficiencyPage.calendarModeDay}</p>
                </div>
                <span className={`energy-efficiency-calendar-badge quality-${getCalendarQuality(activeCalendarItem).tone}`}>
                  {getCalendarQuality(activeCalendarItem).label}
                </span>
              </div>
              <div className="energy-efficiency-calendar-stat-list">
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricEfficiency}</span>
                  <strong>{`${formatNumber(activeCalendarItem?.efficiency, 2)} kW/RT`}</strong>
                </div>
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricRawEfficiency}</span>
                  <strong>{formatNumber(activeCalendarItem?.rawEfficiency, 2)}</strong>
                </div>
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricPower}</span>
                  <strong>{`${formatNumber(activeCalendarItem?.power, 2)} kW*h`}</strong>
                </div>
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricCooling}</span>
                  <strong>{formatNumber(activeCalendarItem?.cooling, 2)}</strong>
                </div>
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricUnitPrice}</span>
                  <strong>{formatNumber(activeCalendarItem?.unitPrice, 2)}</strong>
                </div>
                <div className="energy-efficiency-calendar-stat">
                  <span>{zhCN.energyEfficiencyPage.calendarMetricCost}</span>
                  <strong>{formatNumber(activeCalendarItem?.cost, 2)}</strong>
                </div>
              </div>
              <div className="energy-efficiency-calendar-note">
                <div>{`${zhCN.energyEfficiencyPage.calendarQualityExcellent}: ${zhCN.energyEfficiencyPage.calendarLegendExcellent}`}</div>
                <div>{`${zhCN.energyEfficiencyPage.calendarQualityGood}: ${zhCN.energyEfficiencyPage.calendarLegendGood}`}</div>
                <div>{`${zhCN.energyEfficiencyPage.calendarQualityAttention}: ${zhCN.energyEfficiencyPage.calendarLegendAttention}`}</div>
                <div>{`${zhCN.energyEfficiencyPage.calendarQualityCritical}: ${zhCN.energyEfficiencyPage.calendarLegendCritical}`}</div>
                <div>{`${zhCN.energyEfficiencyPage.calendarQualityMissing}: ${zhCN.energyEfficiencyPage.calendarLegendMissing}`}</div>
              </div>
            </div>
          </div>
          {!calendarLoading && calendarEntries.length === 0 ? <p className="empty-hint">{zhCN.energyEfficiencyPage.calendarEmpty}</p> : null}
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.calendarCompositionTitle}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(calendarPieData?.generatedAt || calendarPieData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.calendarSelectedLabel} ${calendarPieData?.filters?.date || activeCalendarItem?.date || "--"}`}</span>
          </div>
          <EnergyEfficiencyCalendarPieChart data={calendarPieData} loadError={calendarPieError} />
        </SectionCard>
      </>
    );
  }

  function renderSearchTab() {
    const summaryCards = buildReportSummaryCards(searchData, "search", searchQuery || searchFilters);
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters}>
          <div className="energy-efficiency-filter-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDevices}</span>
              <select
                multiple
                value={searchFilters.deviceKeys}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((item) => item.value);
                  setSearchFilters((current) => ({ ...current, deviceKeys: values }));
                  setSearchError(null);
                }}
              >
                {deviceOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterStartDate}</span>
              <input
                type="date"
                value={searchFilters.startDate}
                onChange={(event) => {
                  setSearchFilters((current) => ({ ...current, startDate: event.target.value }));
                  setSearchError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterEndDate}</span>
              <input
                type="date"
                value={searchFilters.endDate}
                onChange={(event) => {
                  setSearchFilters((current) => ({ ...current, endDate: event.target.value }));
                  setSearchError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterTimeSpace}</span>
              <select
                value={searchFilters.timeSpace}
                onChange={(event) => {
                  setSearchFilters((current) => ({ ...current, timeSpace: event.target.value }));
                  setSearchError(null);
                }}
              >
                <option value="1">{zhCN.energyEfficiencyPage.timeSpaceHour}</option>
                <option value="2">{zhCN.energyEfficiencyPage.timeSpaceDay}</option>
                <option value="3">{zhCN.energyEfficiencyPage.timeSpaceMonth}</option>
              </select>
            </label>
          </div>
          <div className="energy-efficiency-actions">
            <button
              type="button"
              className="energy-efficiency-button is-primary"
              onClick={() => {
                if (searchFilters.deviceKeys.length === 0) {
                  setSearchError(zhCN.energyEfficiencyPage.searchDeviceRequired);
                  return;
                }
                if (searchFilters.startDate > searchFilters.endDate) {
                  setSearchError(zhCN.energyEfficiencyPage.invalidRange);
                  return;
                }
                setSearchQuery(searchFilters);
                setSearchError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button"
              onClick={() => {
                const next = buildSearchDefaults();
                setSearchFilters(next);
                setSearchQuery(next);
                setSearchError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
            <button type="button" className="energy-efficiency-button" onClick={exportSearchCsv}>
              {zhCN.energyEfficiencyPage.export}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionSummary}>
          <div className="energy-efficiency-summary-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionChart}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(searchData?.generatedAt || searchData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.rangeSelectionLabel} ${searchFilters.deviceKeys.length}${zhCN.energyEfficiencyPage.unitDevices}`}</span>
          </div>
          <EnergyEfficiencySeriesChart data={searchData} loadError={searchError} />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionTable}>
          <div className="table-scroll-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.tableObject}</th>
                  <th>{zhCN.energyEfficiencyPage.tableWholeValue}</th>
                  <th>{zhCN.energyEfficiencyPage.tableAverage}</th>
                  <th>{zhCN.energyEfficiencyPage.tableBestAverage}</th>
                  <th>{zhCN.energyEfficiencyPage.tableWorstAverage}</th>
                </tr>
              </thead>
              <tbody>
                {(searchData?.tableRows || []).length > 0 ? (
                  (searchData?.tableRows || []).map((row) => (
                    <tr key={row.id || row.object}>
                      <td>{row.object || "--"}</td>
                      <td>{row.wholeValue || "--"}</td>
                      <td>{row.averageValue || "--"}</td>
                      <td>{row.tenPercentGoodAverageValue || "--"}</td>
                      <td>{row.tenPercentBadAverageValue || "--"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="energy-efficiency-empty-inline">
                      {searchLoading ? zhCN.energyEfficiencyPage.loading : zhCN.energyEfficiencyPage.chartEmpty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderCompareTab() {
    const summaryCards = buildReportSummaryCards(compareData, "compare", compareQuery || compareFilters);
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters}>
          <div className="energy-efficiency-filter-grid compare-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDevice}</span>
              <select
                value={compareFilters.deviceKey}
                onChange={(event) => {
                  setCompareFilters((current) => ({ ...current, deviceKey: event.target.value }));
                  setCompareError(null);
                }}
              >
                {deviceOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterCompareDate}</span>
              <div className="energy-efficiency-inline-input">
                <input
                  type="date"
                  value={compareFilters.dateDraft}
                  onChange={(event) => {
                    setCompareFilters((current) => ({ ...current, dateDraft: event.target.value }));
                    setCompareError(null);
                  }}
                />
                <button
                  type="button"
                  className="energy-efficiency-button compact"
                  onClick={() => {
                    const date = compareFilters.dateDraft;
                    if (!date || compareFilters.dates.includes(date)) {
                      return;
                    }
                    setCompareFilters((current) => ({
                      ...current,
                      dates: [...current.dates, date].sort()
                    }));
                  }}
                >
                  {zhCN.energyEfficiencyPage.addDate}
                </button>
              </div>
            </label>
          </div>
          <div className="energy-efficiency-chip-list">
            {compareFilters.dates.map((item) => (
              <button
                key={item}
                type="button"
                className="energy-efficiency-chip action"
                onClick={() => {
                  setCompareFilters((current) => ({
                    ...current,
                    dates: current.dates.filter((date) => date !== item)
                  }));
                  setCompareError(null);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="energy-efficiency-actions">
            <button
              type="button"
              className="energy-efficiency-button is-primary"
              onClick={() => {
                if (compareFilters.dates.length === 0) {
                  setCompareError(zhCN.energyEfficiencyPage.compareDateRequired);
                  return;
                }
                setCompareQuery({
                  deviceKey: compareFilters.deviceKey,
                  dates: [...compareFilters.dates]
                });
                setCompareError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button"
              onClick={() => {
                const next = buildCompareDefaults();
                setCompareFilters(next);
                setCompareQuery({
                  deviceKey: next.deviceKey,
                  dates: next.dates
                });
                setCompareError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
            <button type="button" className="energy-efficiency-button" onClick={exportCompareCsv}>
              {zhCN.energyEfficiencyPage.export}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionSummary}>
          <div className="energy-efficiency-summary-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionChart}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(compareData?.generatedAt || compareData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.rangeSelectionLabel} ${compareFilters.dates.length}${zhCN.energyEfficiencyPage.unitDates}`}</span>
          </div>
          <EnergyEfficiencySeriesChart data={compareData} loadError={compareError} />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionTable}>
          <div className="table-scroll-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.tableObject}</th>
                  <th>{zhCN.energyEfficiencyPage.tableWholeValue}</th>
                  <th>{zhCN.energyEfficiencyPage.tableAverage}</th>
                  <th>{zhCN.energyEfficiencyPage.tableBestAverage}</th>
                  <th>{zhCN.energyEfficiencyPage.tableWorstAverage}</th>
                </tr>
              </thead>
              <tbody>
                {(compareData?.tableRows || []).length > 0 ? (
                  (compareData?.tableRows || []).map((row) => (
                    <tr key={row.id || row.object}>
                      <td>{row.object || "--"}</td>
                      <td>{row.wholeValue || "--"}</td>
                      <td>{row.averageValue || "--"}</td>
                      <td>{row.tenPercentGoodAverageValue || "--"}</td>
                      <td>{row.tenPercentBadAverageValue || "--"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="energy-efficiency-empty-inline">
                      {compareLoading ? zhCN.energyEfficiencyPage.loading : zhCN.energyEfficiencyPage.chartEmpty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderProportionTab() {
    const summaryCards = buildProportionSummaryCards(proportionData);
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters}>
          <div className="energy-efficiency-filter-grid proportion-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDateType}</span>
              <select
                value={proportionFilters.dateType}
                onChange={(event) => {
                  const dateType = event.target.value as "2" | "3";
                  setProportionFilters({
                    dateType,
                    date: dateType === "3" ? String(new Date().getFullYear()) : formatMonthInput(new Date())
                  });
                  setProportionError(null);
                }}
              >
                <option value="2">{zhCN.energyEfficiencyPage.proportionMonth}</option>
                <option value="3">{zhCN.energyEfficiencyPage.proportionYear}</option>
              </select>
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDate}</span>
              {proportionFilters.dateType === "2" ? (
                <input
                  type="month"
                  value={proportionFilters.date}
                  onChange={(event) => {
                    setProportionFilters((current) => ({ ...current, date: event.target.value }));
                    setProportionError(null);
                  }}
                />
              ) : (
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={proportionFilters.date}
                  onChange={(event) => {
                    setProportionFilters((current) => ({ ...current, date: event.target.value }));
                    setProportionError(null);
                  }}
                />
              )}
            </label>
          </div>
          <div className="energy-efficiency-actions">
            <button
              type="button"
              className="energy-efficiency-button is-primary"
              onClick={() => {
                if (!proportionFilters.date) {
                  setProportionError(zhCN.energyEfficiencyPage.proportionDateRequired);
                  return;
                }
                setProportionQuery(proportionFilters);
                setProportionError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button"
              onClick={() => {
                const next = buildProportionDefaults();
                setProportionFilters(next);
                setProportionQuery(next);
                setProportionError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
            <button type="button" className="energy-efficiency-button" onClick={exportProportionCsv}>
              {zhCN.energyEfficiencyPage.export}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionSummary}>
          <div className="energy-efficiency-summary-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.proportionChartTitle}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(proportionData?.generatedAt || proportionData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.proportionSelectedPrefix} ${proportionFilters.date}`}</span>
          </div>
          <EnergyEfficiencyProportionChart data={proportionData} loadError={proportionError} />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionTable}>
          <div className="table-scroll-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.proportionTableRange}</th>
                  <th>{zhCN.energyEfficiencyPage.proportionTableRatio}</th>
                  <th>{zhCN.energyEfficiencyPage.proportionTableEfficiency}</th>
                </tr>
              </thead>
              <tbody>
                {(proportionData?.rows || []).length > 0 ? (
                  (proportionData?.rows || []).map((row) => (
                    <tr key={row.id || row.rangeLabel}>
                      <td>{row.rangeLabel || "--"}</td>
                      <td>{`${formatNumber(row.loadRatioPct, 1)}%`}</td>
                      <td>{formatNumber(row.stationEfficiency, 2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="energy-efficiency-empty-inline">
                      {proportionLoading ? zhCN.energyEfficiencyPage.loading : zhCN.energyEfficiencyPage.proportionEmpty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderImbalanceTab() {
    const summaryCards = buildImbalanceSummaryCards(imbalanceData, imbalanceQuery || imbalanceFilters);
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters}>
          <div className="energy-efficiency-filter-grid proportion-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterImbalanceStartDate}</span>
              <input
                type="date"
                value={imbalanceFilters.startDate}
                onChange={(event) => {
                  setImbalanceFilters((current) => ({ ...current, startDate: event.target.value }));
                  setImbalanceError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterImbalanceEndDate}</span>
              <input
                type="date"
                value={imbalanceFilters.endDate}
                onChange={(event) => {
                  setImbalanceFilters((current) => ({ ...current, endDate: event.target.value }));
                  setImbalanceError(null);
                }}
              />
            </label>
          </div>
          <div className="energy-efficiency-actions">
            <button
              type="button"
              className="energy-efficiency-button is-primary"
              onClick={() => {
                if (!imbalanceFilters.startDate || !imbalanceFilters.endDate) {
                  setImbalanceError(zhCN.energyEfficiencyPage.imbalanceDateRequired);
                  return;
                }
                if (imbalanceFilters.startDate > imbalanceFilters.endDate) {
                  setImbalanceError(zhCN.energyEfficiencyPage.invalidRange);
                  return;
                }
                setImbalanceQuery(imbalanceFilters);
                setImbalanceError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button"
              onClick={() => {
                const next = buildImbalanceDefaults();
                setImbalanceFilters(next);
                setImbalanceQuery(next);
                setImbalanceError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
            <button type="button" className="energy-efficiency-button" onClick={exportImbalanceCsv}>
              {zhCN.energyEfficiencyPage.export}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionSummary}>
          <div className="energy-efficiency-summary-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.imbalanceChartTitle}>
          <div className="energy-efficiency-meta">
            <span>{`${zhCN.energyEfficiencyPage.rangeLatestFetch} ${formatDateTime(imbalanceData?.generatedAt || imbalanceData?.freshness?.latestTimestamp)}`}</span>
            <span>{`${zhCN.energyEfficiencyPage.rangeSelectionLabel} ${imbalanceFilters.startDate} ~ ${imbalanceFilters.endDate}`}</span>
            <span>{zhCN.energyEfficiencyPage.imbalanceThresholdLabel}</span>
          </div>
          <EnergyEfficiencyImbalanceChart data={imbalanceData} loadError={imbalanceError} />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.imbalanceStatisticsTitle}>
          <div className="table-scroll-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.imbalanceStatsAcquisitionValue}</th>
                  <th>{zhCN.energyEfficiencyPage.imbalanceStatsScalar}</th>
                  <th>{zhCN.energyEfficiencyPage.imbalanceStatsNoScalar}</th>
                  <th>{zhCN.energyEfficiencyPage.imbalanceStatsScalarRate}</th>
                </tr>
              </thead>
              <tbody>
                {(imbalanceData?.statisticsRows || []).length > 0 ? (
                  (imbalanceData?.statisticsRows || []).map((row) => (
                    <tr key={row.id || row.acquisitionValue}>
                      <td>{row.acquisitionValue || "--"}</td>
                      <td>{formatNumber(row.scalar, 2)}</td>
                      <td>{formatNumber(row.noScalar, 2)}</td>
                      <td>{`${formatNumber(row.scalarRate, 2)}%`}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="energy-efficiency-empty-inline">
                      {imbalanceLoading ? zhCN.energyEfficiencyPage.loading : zhCN.energyEfficiencyPage.imbalanceEmpty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.imbalanceDevicesTitle}>
          <div className="table-scroll-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.imbalanceDeviceName}</th>
                  <th>{zhCN.energyEfficiencyPage.imbalanceDeviceType}</th>
                  <th>{zhCN.energyEfficiencyPage.imbalanceDeviceScalarRate}</th>
                </tr>
              </thead>
              <tbody>
                {(imbalanceData?.deviceRows || []).length > 0 ? (
                  (imbalanceData?.deviceRows || []).map((row) => (
                    <tr key={row.id || row.deviceName}>
                      <td>{row.deviceName || "--"}</td>
                      <td>{row.deviceTypeName || "--"}</td>
                      <td>{`${formatNumber(row.scalarRate, 2)}%`}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="energy-efficiency-empty-inline">
                      {imbalanceLoading ? zhCN.energyEfficiencyPage.loading : zhCN.energyEfficiencyPage.imbalanceEmpty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <div className="energy-efficiency-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(activeError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="energy-efficiency-header">
        <h2>{zhCN.energyEfficiencyPage.heading}</h2>
        <p>{zhCN.energyEfficiencyPage.subtitle}</p>
      </section>

      <div className="energy-efficiency-tabs">
        <button
          type="button"
          className={activeTab === "calendar" ? "active" : ""}
          onClick={() => switchTab("calendar")}
        >
          {zhCN.energyEfficiencyPage.tabCalendar}
        </button>
        <button
          type="button"
          className={activeTab === "search" ? "active" : ""}
          onClick={() => switchTab("search")}
        >
          {zhCN.energyEfficiencyPage.tabSearch}
        </button>
        <button
          type="button"
          className={activeTab === "compare" ? "active" : ""}
          onClick={() => switchTab("compare")}
        >
          {zhCN.energyEfficiencyPage.tabCompare}
        </button>
        <button
          type="button"
          className={activeTab === "proportion" ? "active" : ""}
          onClick={() => switchTab("proportion")}
        >
          {zhCN.energyEfficiencyPage.tabProportion}
        </button>
        <button
          type="button"
          className={activeTab === "imbalance" ? "active" : ""}
          onClick={() => switchTab("imbalance")}
        >
          {zhCN.energyEfficiencyPage.tabImbalance}
        </button>
      </div>

      {activeTab === "calendar" ? renderCalendarTab() : null}
      {activeTab === "search" ? renderSearchTab() : null}
      {activeTab === "compare" ? renderCompareTab() : null}
      {activeTab === "proportion" ? renderProportionTab() : null}
      {activeTab === "imbalance" ? renderImbalanceTab() : null}
    </div>
  );
}

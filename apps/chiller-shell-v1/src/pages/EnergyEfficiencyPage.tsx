import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import SectionCard from "../components/common/SectionCard";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import useAiDigest from "../hooks/useAiDigest";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type AiDigestDto,
  type ColdStationLogDto,
  type EnergyAnalysisDto,
  type EnergyEfficiencyCalendarDayDto,
  type EnergyEfficiencyCalendarDto,
  type EnergyEfficiencyCalendarPieDto,
  type EnergyEfficiencyCalendarPieSegmentDto,
  type EnergyEfficiencyImbalanceDto,
  type EnergyEfficiencyImbalanceStatisticRowDto,
  type EnergyEfficiencyProportionDto,
  type EnergyEfficiencyProportionRowDto,
  type EnergyEfficiencyReportDto,
  fetchColdStationLogs,
  fetchEnergyAnalysis,
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
  className?: string;
};

type StationEfficiencyTone = "good" | "neutral" | "warn";
type LoadRatioTone = "good" | "neutral" | "warn";

const LOAD_BAND_LABELS = Array.from({ length: 10 }, (_item, index) => `${index * 10}~${(index + 1) * 10}%`);

type CompleteLoadBandRow = EnergyEfficiencyProportionRowDto & {
  rangeLabel: string;
  loadRatioPct: number | null;
  stationEfficiency: number | null;
};

type CalendarTrendPoint = {
  key: string;
  label: string;
  value: number;
  isPartial: boolean;
};

type ThermalBalanceOverview = {
  sampleCount: number;
  failCount: number | null;
  peakAbs: number | null;
  complianceRate: number | null;
  stateLabel: string;
  stateTone: "good" | "warn" | "neutral";
};

function assessStationEfficiencyTone(value: number | null | undefined): StationEfficiencyTone | null {
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

function getStationEfficiencyToneClass(value: number | null | undefined): string {
  const tone = assessStationEfficiencyTone(value);
  return tone ? `tone-${tone}` : "tone-missing";
}

function assessLoadRatioTone(value: number | null | undefined): LoadRatioTone | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 50) {
    return "good";
  }
  if (value >= 20) {
    return "neutral";
  }
  return "warn";
}

function getLoadRatioToneClass(value: number | null | undefined): string {
  const tone = assessLoadRatioTone(value);
  return tone ? `tone-${tone}` : "tone-missing";
}

function getThermalImbalanceToneClass(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "tone-missing";
  }
  return value >= -5 && value <= 5 ? "tone-good" : "tone-warn";
}

function getImbalancePassCountToneClass(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "tone-missing";
  }
  return value > 0 ? "tone-good" : "tone-neutral";
}

function getImbalanceFailCountToneClass(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "tone-missing";
  }
  return value > 0 ? "tone-warn" : "tone-good";
}

const CALENDAR_PIE_FALLBACK_DEVICE_IDS = [
  "chiller",
  "chilledWaterPump",
  "condenserWaterPump",
  "coolingTower"
] as const;
const CALENDAR_PIE_SEGMENT_LABELS: Record<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], string> = {
  chiller: zhCN.energyEfficiencyPage.deviceChillerUnit,
  chilledWaterPump: zhCN.energyEfficiencyPage.deviceChilledWaterPump,
  condenserWaterPump: zhCN.energyEfficiencyPage.deviceCoolingWaterPump,
  coolingTower: zhCN.energyEfficiencyPage.deviceCoolingTower
};

function resolveCalendarPieSegmentKind(value: string | null | undefined): typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number] | null {
  const compactValue = String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  if (!compactValue) {
    return null;
  }
  if (/chilledwaterpump|chilledpump|冷冻水泵|冷冻泵|鍐峰喕娉|chp/.test(compactValue)) {
    return "chilledWaterPump";
  }
  if (/condenserwaterpump|coolingpump|冷却水泵|冷却泵|鍐峰嵈娉|cwp/.test(compactValue)) {
    return "condenserWaterPump";
  }
  if (/coolingtower|冷却塔|鍐峰嵈濉|ctf|ct/.test(compactValue)) {
    return "coolingTower";
  }
  if (/chiller|冷水主机|冷水机组|主机|冷机|鍐锋按涓绘満|鍐锋按鏈虹粍|涓绘満|鍐锋満|^ch$/.test(compactValue)) {
    return "chiller";
  }
  return null;
}

function shouldHydrateCalendarPieFromEnergyAnalysis(data: EnergyEfficiencyCalendarPieDto | null): boolean {
  const positiveSegments = (data?.segments || []).filter((segment) => typeof segment.value === "number" && segment.value > 0);
  const matchedKinds = new Set(
    positiveSegments
      .map((segment) => resolveCalendarPieSegmentKind(segment?.id || segment?.name))
      .filter(Boolean)
  );
  const total = typeof data?.total === "number"
    ? data.total
    : positiveSegments.reduce((sum, segment) => sum + (segment.value || 0), 0);
  return matchedKinds.size < CALENDAR_PIE_FALLBACK_DEVICE_IDS.length || total <= 0;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function buildCalendarPieFallbackRange(date: string, dateType: "1" | "2"): {
  startDate: string;
  endDate: string;
  energyAnalysisDateType: "1" | "2";
} {
  if (dateType === "2") {
    const [yearText, monthText] = date.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startDate: `${yearText}-${monthText}-01`,
      endDate: `${yearText}-${monthText}-${padDatePart(lastDay)}`,
      energyAnalysisDateType: "2"
    };
  }
  return {
    startDate: date,
    endDate: date,
    energyAnalysisDateType: "1"
  };
}

function buildCalendarPieSegmentsFromEnergyAnalysis(report: EnergyAnalysisDto): NonNullable<EnergyEfficiencyCalendarPieDto["segments"]> {
  const grouped = new Map<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], number>();

  for (const row of report.summaries || []) {
    const kind = resolveCalendarPieSegmentKind(row?.id || row?.objectName);
    const value = typeof row?.sumValue === "number" ? row.sumValue : null;
    if (!kind || value == null || value <= 0) {
      continue;
    }
    grouped.set(kind, (grouped.get(kind) || 0) + value);
  }

  return CALENDAR_PIE_FALLBACK_DEVICE_IDS.map((kind) => ({
    id: kind,
    name: CALENDAR_PIE_SEGMENT_LABELS[kind],
    value: grouped.get(kind) ?? 0
  }));
}

function buildEmptyCalendarPieSegments(): NonNullable<EnergyEfficiencyCalendarPieDto["segments"]> {
  return CALENDAR_PIE_FALLBACK_DEVICE_IDS.map((kind) => ({
    id: kind,
    name: CALENDAR_PIE_SEGMENT_LABELS[kind],
    value: 0
  }));
}

function buildCalendarPieSegmentsFromColdStationLog(log: ColdStationLogDto | null): NonNullable<EnergyEfficiencyCalendarPieDto["segments"]> {
  const summary = log?.summary;
  const valueByKind: Record<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], number | null | undefined> = {
    chiller: summary?.hostPower,
    chilledWaterPump: summary?.refrigeratingPumpPower,
    condenserWaterPump: summary?.coolingPumpPower,
    coolingTower: summary?.coolingTowerPower
  };

  return CALENDAR_PIE_FALLBACK_DEVICE_IDS
    .map((kind) => ({
      id: kind,
      name: CALENDAR_PIE_SEGMENT_LABELS[kind],
      value: valueByKind[kind] ?? null
    }))
    .filter((segment) => typeof segment.value === "number" && segment.value > 0);
}

function getCalendarPieSegmentTotal(segments: EnergyEfficiencyCalendarPieSegmentDto[] = []): number {
  return segments.reduce((sum, item) => sum + (typeof item.value === "number" && item.value > 0 ? item.value : 0), 0);
}

function buildCalendarPieSegmentsFromPieData(
  data: EnergyEfficiencyCalendarPieDto | null
): NonNullable<EnergyEfficiencyCalendarPieDto["segments"]> {
  const grouped = new Map<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], number>();

  for (const item of data?.segments || []) {
    const kind = resolveCalendarPieSegmentKind(item.id || item.name);
    const value = typeof item.value === "number" ? item.value : null;
    if (!kind || value == null || value <= 0) {
      continue;
    }
    grouped.set(kind, (grouped.get(kind) || 0) + value);
  }

  return CALENDAR_PIE_FALLBACK_DEVICE_IDS.map((kind) => ({
    id: kind,
    name: CALENDAR_PIE_SEGMENT_LABELS[kind],
    value: grouped.get(kind) ?? 0
  }));
}

function getCalendarMonthDailyDates(month: string, entries: EnergyEfficiencyCalendarDayDto[]): string[] {
  const monthPrefix = `${month}-`;
  const today = formatDateInput(new Date());
  return Array.from(new Set(
    entries
      .filter((item) => item?.hasData && typeof item.date === "string" && item.date.startsWith(monthPrefix) && item.date <= today)
      .map((item) => item.date as string)
      .sort((left, right) => left.localeCompare(right))
  ));
}

async function fetchMonthlyCalendarPieFromDailyEntries(
  siteId: string,
  month: string,
  entries: EnergyEfficiencyCalendarDayDto[]
): Promise<EnergyEfficiencyCalendarPieDto | null> {
  const dates = getCalendarMonthDailyDates(month, entries);
  if (dates.length === 0) {
    return null;
  }

  const grouped = new Map<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], number>();
  let latestGeneratedAt: string | undefined;
  let latestFreshness: EnergyEfficiencyCalendarPieDto["freshness"] | undefined;
  let latestSourceStatus: EnergyEfficiencyCalendarPieDto["sourceStatus"] | undefined;
  const batchSize = 5;

  for (let index = 0; index < dates.length; index += batchSize) {
    const dailyResults = await Promise.all(
      dates.slice(index, index + batchSize).map(async (date) => {
        try {
          const [pieResultState, coldStationLogState] = await Promise.allSettled([
            fetchEnergyEfficiencyCalendarPie(siteId, { date, dateType: "1" }),
            fetchColdStationLogs(siteId, date)
          ]);
          const pieResult = pieResultState.status === "fulfilled" ? pieResultState.value : null;
          const coldStationLog = coldStationLogState.status === "fulfilled" ? coldStationLogState.value : null;
          const coldStationLogSegments = buildCalendarPieSegmentsFromColdStationLog(coldStationLog);
          const coldStationLogTotal = getCalendarPieSegmentTotal(coldStationLogSegments);
          const pieSegments = buildCalendarPieSegmentsFromPieData(pieResult);
          const segments = coldStationLogSegments.length >= 2 && coldStationLogTotal > 0
            ? coldStationLogSegments
            : pieSegments;
          const total = getCalendarPieSegmentTotal(segments);

          if (total <= 0) {
            return null;
          }

          return {
            generatedAt: coldStationLog?.generatedAt || pieResult?.generatedAt,
            freshness: coldStationLog?.freshness || pieResult?.freshness,
            sourceStatus: coldStationLog?.sourceStatus || pieResult?.sourceStatus,
            segments
          };
        } catch (_error) {
          return null;
        }
      })
    );

    for (const daily of dailyResults) {
      if (!daily) {
        continue;
      }
      latestGeneratedAt = daily.generatedAt || latestGeneratedAt;
      latestFreshness = daily.freshness || latestFreshness;
      latestSourceStatus = daily.sourceStatus || latestSourceStatus;
      for (const item of daily.segments) {
        const kind = resolveCalendarPieSegmentKind(item.id || item.name);
        const value = typeof item.value === "number" ? item.value : null;
        if (!kind || value == null || value <= 0) {
          continue;
        }
        grouped.set(kind, (grouped.get(kind) || 0) + value);
      }
    }
  }

  const segments = CALENDAR_PIE_FALLBACK_DEVICE_IDS.map((kind) => ({
    id: kind,
    name: CALENDAR_PIE_SEGMENT_LABELS[kind],
    value: grouped.get(kind) ?? 0
  }));
  const total = getCalendarPieSegmentTotal(segments);
  if (total <= 0) {
    return null;
  }

  return {
    generatedAt: latestGeneratedAt,
    filters: {
      date: month,
      dateType: "2"
    },
    segments,
    total,
    freshness: latestFreshness,
    sourceStatus: latestSourceStatus
  };
}

const TAB_SET = new Set<TabKey>(["calendar", "search", "compare", "proportion", "imbalance"]);
const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];
const CALENDAR_PIE_COLORS: Record<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], string> = {
  chiller: "#20d6c4",
  chilledWaterPump: "#5ac8ff",
  condenserWaterPump: "#9dffe9",
  coolingTower: "#ffc24f"
};
const CALENDAR_PIE_FALLBACK_COLOR = "#67bfd0";
const CALENDAR_PIE_START_ANGLE_DEG = 278;
const CALENDAR_PIE_ANCHOR_RADIUS_X = 25;
const CALENDAR_PIE_ANCHOR_RADIUS_Y = 38.5;
const CALENDAR_PIE_CALLOUT_LAYOUTS: Record<typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number], {
  labelX: number;
  labelY: number;
  leadX: number;
  leadY: number;
  align: "left" | "right" | "center";
}> = {
  chiller: { labelX: 64, labelY: 27, leadX: 70, leadY: 35, align: "left" },
  chilledWaterPump: { labelX: 3, labelY: 77, leadX: 31, leadY: 72, align: "left" },
  condenserWaterPump: { labelX: 3, labelY: 54, leadX: 31, leadY: 57, align: "left" },
  coolingTower: { labelX: 3, labelY: 30, leadX: 29, leadY: 45, align: "left" }
};
const CALENDAR_WEEKDAY_LABELS = [
  zhCN.energyEfficiencyPage.calendarWeekSun,
  zhCN.energyEfficiencyPage.calendarWeekMon,
  zhCN.energyEfficiencyPage.calendarWeekTue,
  zhCN.energyEfficiencyPage.calendarWeekWed,
  zhCN.energyEfficiencyPage.calendarWeekThu,
  zhCN.energyEfficiencyPage.calendarWeekFri,
  zhCN.energyEfficiencyPage.calendarWeekSat
];
const ENERGY_EFFICIENCY_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "calendar", label: zhCN.energyEfficiencyPage.tabCalendar },
  { key: "search", label: zhCN.energyEfficiencyPage.tabSearch },
  { key: "compare", label: zhCN.energyEfficiencyPage.tabCompare },
  { key: "proportion", label: zhCN.energyEfficiencyPage.tabProportion },
  { key: "imbalance", label: zhCN.energyEfficiencyPage.tabImbalance }
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

function normalizeLoadBandLabel(value: string | null | undefined): string | null {
  const label = String(value || "").trim();
  const match = label.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:~|-|至|到)\s*(\d+(?:\.\d+)?)\s*%?/);
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return `${Math.round(start)}~${Math.round(end)}%`;
}

function buildCompleteLoadBandRows(rows: EnergyEfficiencyProportionRowDto[] = []): CompleteLoadBandRow[] {
  if (rows.length === 0) {
    return [];
  }
  const byLabel = new Map<string, EnergyEfficiencyProportionRowDto>();
  for (const row of rows) {
    const label = normalizeLoadBandLabel(row.rangeLabel);
    if (label) {
      byLabel.set(label, row);
    }
  }

  return LOAD_BAND_LABELS.map((label) => {
    const row = byLabel.get(label);
    const loadRatioPct = typeof row?.loadRatioPct === "number" ? row.loadRatioPct : 0;
    const stationEfficiency = typeof row?.stationEfficiency === "number" && row.stationEfficiency > 0 && loadRatioPct > 0
      ? row.stationEfficiency
      : null;
    return {
      ...(row || {}),
      id: row?.id || label,
      rangeLabel: label,
      loadRatioPct,
      stationEfficiency
    };
  });
}

function getDominantLoadBand(rows: CompleteLoadBandRow[]): CompleteLoadBandRow | null {
  return rows.reduce<CompleteLoadBandRow | null>((best, row) => {
    const value = row.loadRatioPct || 0;
    if (value <= 0) {
      return best;
    }
    if (!best || value > (best.loadRatioPct || 0)) {
      return row;
    }
    return best;
  }, null);
}

function calculateThermalComplianceRate(rows: EnergyEfficiencyImbalanceStatisticRowDto[] = []): number | null {
  const passCount = rows.reduce((sum, row) => sum + (typeof row.scalar === "number" && Number.isFinite(row.scalar) ? row.scalar : 0), 0);
  const failCount = rows.reduce((sum, row) => sum + (typeof row.noScalar === "number" && Number.isFinite(row.noScalar) ? row.noScalar : 0), 0);
  if (passCount + failCount > 0) {
    return (passCount / (passCount + failCount)) * 100;
  }
  const rateValues = rows
    .map((item) => item.scalarRate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (rateValues.length === 0) {
    return null;
  }
  return rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length;
}

function parseStatisticTotal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getThermalSampleTotal(data: EnergyEfficiencyImbalanceDto | null): number {
  const rows = data?.statisticsRows || [];
  const passCount = rows.reduce((sum, row) => sum + (typeof row.scalar === "number" && Number.isFinite(row.scalar) ? row.scalar : 0), 0);
  const failCount = rows.reduce((sum, row) => sum + (typeof row.noScalar === "number" && Number.isFinite(row.noScalar) ? row.noScalar : 0), 0);
  if (passCount + failCount > 0) {
    return passCount + failCount;
  }
  const statisticTotal = rows
    .map((row) => parseStatisticTotal(row.acquisitionValue))
    .find((value): value is number => typeof value === "number");
  if (typeof statisticTotal === "number") {
    return statisticTotal;
  }
  const series = data?.series || [];
  return Math.max(0, ...series.map((item) => item.points?.length || 0));
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
    mode: "month",
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

function splitAxisDateTimeLabel(value: string): { primary: string; secondary: string | null } {
  const label = String(value || "").trim();
  if (!label) {
    return { primary: "--", secondary: null };
  }
  const normalized = label.replace("T", " ").trim();
  const fullDateMatch = normalized.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d{1,2}:\d{2})(?::\d{2})?/);
  if (fullDateMatch) {
    return {
      primary: fullDateMatch[1].replace(/[/.]/g, "-"),
      secondary: fullDateMatch[2]
    };
  }
  const shortDateMatch = normalized.match(/^(\d{1,2}[-/.]\d{1,2})\s+(\d{1,2}:\d{2})(?::\d{2})?/);
  if (shortDateMatch) {
    return {
      primary: shortDateMatch[1].replace(/[/.]/g, "-"),
      secondary: shortDateMatch[2]
    };
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      primary: parts[0],
      secondary: parts.slice(1).join(" ")
    };
  }
  return { primary: label, secondary: null };
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: Math.max(0, digits)
  }).format(value);
}

function formatFixedNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  const normalizedDigits = Math.max(0, digits);
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: normalizedDigits,
    maximumFractionDigits: normalizedDigits
  }).format(value);
}

function formatCop(value: number | null | undefined): string {
  return formatFixedNumber(value, 2);
}

function calculateCalendarCoolingPowerRatio(item: EnergyEfficiencyCalendarDayDto | null | undefined): number | null {
  const power = item?.power;
  const cooling = item?.cooling;
  if (
    typeof power === "number"
    && Number.isFinite(power)
    && power > 0
    && typeof cooling === "number"
    && Number.isFinite(cooling)
    && cooling > 0
  ) {
    return cooling / power;
  }

  return firstCalendarNumber(item?.rawEfficiency, item?.efficiency);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(value);
}

const ENERGY_EFFICIENCY_VALUE_UNIT_PREFIX_PATTERN = /^(kw\/rt|kw\*h|kw·h|kw|kwh|rt|rth|%|℃|°c|c|元|吨|t|hz|pa|a|v|m³|m3)/i;

function formatDisplayValue(value: unknown, digits = 2): string {
  if (value == null || value === "") {
    return "--";
  }
  if (typeof value === "number") {
    return formatNumber(value, digits);
  }
  if (typeof value !== "string") {
    return String(value);
  }
  const trimmed = value.trim();
  const numericOnly = trimmed.match(/^-?\d+(?:\.\d+)?$/);
  if (numericOnly) {
    return formatNumber(Number(trimmed), digits);
  }
  const unitMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)(\s*.+)$/);
  const unitText = unitMatch?.[2]?.trimStart() || "";
  if (!unitMatch || !ENERGY_EFFICIENCY_VALUE_UNIT_PREFIX_PATTERN.test(unitText)) {
    return value;
  }
  const numericPrefix = Number(unitMatch[1]);
  return Number.isFinite(numericPrefix) ? `${formatNumber(numericPrefix, digits)}${unitMatch[2]}` : value;
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

function buildCompareWindowLabel(dates: string[]): string {
  if (dates.length === 0) {
    return "--";
  }
  const sorted = [...dates].sort();
  if (sorted.length === 1) {
    return sorted[0] || "--";
  }
  return `${sorted[0]} ~ ${sorted[sorted.length - 1]}`;
}

function getModeGuide(activeTab: TabKey): {
  label: string;
  description: string;
  nextStep: string;
  readingTip: string;
  filtersHint: string;
  summaryHint: string;
  chartHint: string;
  tableHint: string;
} {
  if (activeTab === "calendar") {
    return {
      label: zhCN.energyEfficiencyPage.strategyViewCalendar,
      description: zhCN.energyEfficiencyPage.strategyActionCalendar,
      nextStep: zhCN.energyEfficiencyPage.strategyActionCalendar,
      readingTip: zhCN.energyEfficiencyPage.strategyEvidenceCalendar,
      filtersHint: zhCN.energyEfficiencyPage.filterMonth,
      summaryHint: zhCN.energyEfficiencyPage.calendarSectionTitle,
      chartHint: zhCN.energyEfficiencyPage.calendarCompositionTitle,
      tableHint: zhCN.energyEfficiencyPage.calendarPieBreakdownTitle
    };
  }

  if (activeTab === "search") {
    return {
      label: zhCN.energyEfficiencyPage.strategyViewSearch,
      description: zhCN.energyEfficiencyPage.strategyActionSearch,
      nextStep: zhCN.energyEfficiencyPage.strategyActionSearch,
      readingTip: zhCN.energyEfficiencyPage.strategyEvidenceSearch,
      filtersHint: zhCN.energyEfficiencyPage.sectionFilters,
      summaryHint: zhCN.energyEfficiencyPage.summarySeries,
      chartHint: zhCN.energyEfficiencyPage.copRangeLabel,
      tableHint: zhCN.energyEfficiencyPage.tableObject
    };
  }

  if (activeTab === "compare") {
    return {
      label: zhCN.energyEfficiencyPage.strategyViewCompare,
      description: zhCN.energyEfficiencyPage.strategyActionCompare,
      nextStep: zhCN.energyEfficiencyPage.strategyActionCompare,
      readingTip: zhCN.energyEfficiencyPage.strategyEvidenceCompare,
      filtersHint: zhCN.energyEfficiencyPage.compareSelectedDates,
      summaryHint: zhCN.energyEfficiencyPage.summarySeries,
      chartHint: zhCN.energyEfficiencyPage.copRangeLabel,
      tableHint: zhCN.energyEfficiencyPage.tableObject
    };
  }

  if (activeTab === "proportion") {
    return {
      label: zhCN.energyEfficiencyPage.strategyViewProportion,
      description: zhCN.energyEfficiencyPage.strategyActionProportion,
      nextStep: zhCN.energyEfficiencyPage.strategyActionProportion,
      readingTip: zhCN.energyEfficiencyPage.strategyEvidenceProportion,
      filtersHint: zhCN.energyEfficiencyPage.filterDate,
      summaryHint: zhCN.energyEfficiencyPage.summaryLoadRatio,
      chartHint: zhCN.energyEfficiencyPage.proportionChartAriaLabel,
      tableHint: zhCN.energyEfficiencyPage.proportionTableRange
    };
  }

  return {
    label: zhCN.energyEfficiencyPage.strategyViewImbalance,
    description: zhCN.energyEfficiencyPage.strategyActionImbalance,
    nextStep: zhCN.energyEfficiencyPage.strategyActionImbalance,
    readingTip: zhCN.energyEfficiencyPage.strategyEvidenceImbalance,
    filtersHint: zhCN.energyEfficiencyPage.imbalanceThresholdLabel,
    summaryHint: zhCN.energyEfficiencyPage.summaryImbalancePeak,
    chartHint: zhCN.energyEfficiencyPage.imbalanceChartAriaLabel,
    tableHint: zhCN.energyEfficiencyPage.imbalanceStatisticsTitle
  };
}

function buildProportionSummaryCards(data: EnergyEfficiencyProportionDto | null): SummaryCard[] {
  const rows = data ? buildCompleteLoadBandRows(data.rows || []) : [];
  const dominantLoadBand = getDominantLoadBand(rows);
  return [
    {
      title: zhCN.energyEfficiencyPage.summaryBuckets,
      value: formatCount(rows.length),
      unit: zhCN.energyEfficiencyPage.unitBuckets,
      delta: "",
      tone: "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryLoadRatio,
      value: dominantLoadBand?.rangeLabel || "--",
      unit: dominantLoadBand ? `${formatNumber(dominantLoadBand.loadRatioPct, 1)}%` : "",
      delta: "",
      tone: dominantLoadBand && (dominantLoadBand.loadRatioPct || 0) >= 30 ? "warn" : "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryEfficiency,
      value: formatCop(dominantLoadBand?.stationEfficiency),
      unit: "COP",
      delta: "",
      tone: dominantLoadBand && getStationEfficiencyToneClass(dominantLoadBand.stationEfficiency) === "warn" ? "warn" : "good"
    },
    {
      title: zhCN.energyEfficiencyPage.summarySelectedPeriod,
      value: data?.filters?.date || "--",
      unit: "",
      delta: "",
      tone: "neutral"
    }
  ];
}

function buildThermalBalanceOverview(data: EnergyEfficiencyImbalanceDto | null): ThermalBalanceOverview {
  const values = (data?.series || [])
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const statisticsRows = data?.statisticsRows || [];
  const failValues = statisticsRows
    .map((item) => item.noScalar)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampleCount = Math.max(0, ...((data?.series || []).map((item) => item.points?.length || 0)));
  const peakAbs = values.length > 0 ? Math.max(...values.map((value) => Math.abs(value))) : null;
  const failCount = failValues.length > 0 ? failValues.reduce((sum, value) => sum + value, 0) : null;
  const complianceRate = calculateThermalComplianceRate(statisticsRows);
  const hasData = values.length > 0 || statisticsRows.length > 0;
  const isPass = hasData
    && (peakAbs == null || peakAbs <= 5)
    && (failCount == null || failCount <= 0)
    && (complianceRate == null || complianceRate >= 95);

  return {
    sampleCount,
    failCount,
    peakAbs,
    complianceRate,
    stateLabel: !hasData ? "待数据" : isPass ? "达标" : "需复核",
    stateTone: !hasData ? "neutral" : isPass ? "good" : "warn"
  };
}

function getCalendarCompleteItems(month: string, entries: EnergyEfficiencyCalendarDayDto[]): EnergyEfficiencyCalendarDayDto[] {
  const today = formatDateInput(new Date());
  const currentMonth = month === formatMonthInput(new Date());
  const monthPrefix = `${month}-`;
  return entries.filter((item) => (
    item?.hasData
    && typeof item.date === "string"
    && item.date.startsWith(monthPrefix)
    && (!currentMonth || item.date < today)
    && typeof calculateCalendarCoolingPowerRatio(item) === "number"
  ));
}

function getCalendarPartialToday(month: string, entries: EnergyEfficiencyCalendarDayDto[]): EnergyEfficiencyCalendarDayDto | null {
  const today = formatDateInput(new Date());
  if (month !== formatMonthInput(new Date())) {
    return null;
  }
  return entries.find((item) => item.date === today && item.hasData) || null;
}

function getCalendarBestItem(items: EnergyEfficiencyCalendarDayDto[]): EnergyEfficiencyCalendarDayDto | null {
  return [...items].sort((left, right) => (
    (calculateCalendarCoolingPowerRatio(right) || 0) - (calculateCalendarCoolingPowerRatio(left) || 0)
  ))[0] || null;
}

function getCalendarLowItem(items: EnergyEfficiencyCalendarDayDto[]): EnergyEfficiencyCalendarDayDto | null {
  return [...items].sort((left, right) => (
    (calculateCalendarCoolingPowerRatio(left) || 0) - (calculateCalendarCoolingPowerRatio(right) || 0)
  ))[0] || null;
}

function buildCalendarTrendPoints(
  completedItems: EnergyEfficiencyCalendarDayDto[],
  partialToday: EnergyEfficiencyCalendarDayDto | null
): CalendarTrendPoint[] {
  const items = [...completedItems, ...(partialToday ? [partialToday] : [])]
    .filter((item) => typeof calculateCalendarCoolingPowerRatio(item) === "number")
    .sort((left, right) => (left.date || "").localeCompare(right.date || ""))
    .slice(-11);
  const today = formatDateInput(new Date());

  return items.map((item) => ({
    key: item.date || item.id || String(item.day),
    label: item.day || item.date?.slice(-2) || "--",
    value: calculateCalendarCoolingPowerRatio(item) || 0,
    isPartial: item.date === today
  }));
}

function buildImbalanceSummaryCards(
  data: EnergyEfficiencyImbalanceDto | null,
  filters: ImbalanceFilterState
): SummaryCard[] {
  const series = data?.series || [];
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");
  const sampleCount = getThermalSampleTotal(data);
  const peakValue = numericValues.length > 0 ? Math.max(...numericValues.map((value) => Math.abs(value))) : null;
  const complianceRate = calculateThermalComplianceRate(data?.statisticsRows || []);
  const overview = buildThermalBalanceOverview(data);

  return [
    {
      title: zhCN.energyEfficiencyPage.summaryImbalanceStatus,
      value: overview.stateLabel,
      unit: "",
      delta: `${filters.startDate} ~ ${filters.endDate}`,
      tone: overview.stateTone
    },
    {
      title: zhCN.energyEfficiencyPage.summaryImbalancePoints,
      value: formatCount(sampleCount),
      unit: zhCN.energyEfficiencyPage.unitSeries,
      delta: "",
      tone: "neutral"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryImbalancePeak,
      value: formatNumber(peakValue, 2),
      unit: "%",
      delta: "",
      tone: typeof peakValue === "number" && peakValue <= 5 ? "good" : "warn"
    },
    {
      title: zhCN.energyEfficiencyPage.summaryImbalanceCompliance,
      value: formatFixedNumber(complianceRate, 2),
      unit: "%",
      delta: "",
      tone: typeof complianceRate === "number" && complianceRate >= 95 ? "good" : "warn"
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

function isCalendarNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sumCalendarValues(
  items: EnergyEfficiencyCalendarDayDto[],
  selector: (item: EnergyEfficiencyCalendarDayDto) => number | null | undefined
): number | null {
  let total = 0;
  let count = 0;
  for (const item of items) {
    const value = selector(item);
    if (!isCalendarNumber(value)) {
      continue;
    }
    total += value;
    count += 1;
  }
  return count > 0 ? total : null;
}

function averageCalendarValues(
  items: EnergyEfficiencyCalendarDayDto[],
  selector: (item: EnergyEfficiencyCalendarDayDto) => number | null | undefined
): number | null {
  const total = sumCalendarValues(items, selector);
  if (total == null) {
    return null;
  }
  const count = items.filter((item) => isCalendarNumber(selector(item))).length;
  return count > 0 ? total / count : null;
}

function firstCalendarNumber(...values: Array<number | null | undefined>): number | null {
  const value = values.find(isCalendarNumber);
  return value ?? null;
}

function buildCalendarMonthAggregate(
  month: string,
  items: EnergyEfficiencyCalendarDayDto[] = [],
  summary?: EnergyEfficiencyCalendarDayDto | null
): EnergyEfficiencyCalendarDayDto | null {
  const monthPrefix = `${month}-`;
  const today = formatDateInput(new Date());
  const monthItems = items.filter((item) => (
    item?.hasData
    && typeof item.date === "string"
    && item.date.startsWith(monthPrefix)
    && item.date <= today
  ));
  const efficiencyAverage = averageCalendarValues(monthItems, (item) => item.efficiency);
  const rawEfficiencyAverage = averageCalendarValues(monthItems, (item) => item.rawEfficiency);
  const powerTotal = sumCalendarValues(monthItems, (item) => item.power);
  const coolingTotal = sumCalendarValues(monthItems, (item) => item.cooling);
  const costTotal = sumCalendarValues(monthItems, (item) => item.cost);
  const calculatedEfficiency = isCalendarNumber(coolingTotal) && isCalendarNumber(powerTotal) && powerTotal > 0
    ? coolingTotal / powerTotal
    : null;
  const calculatedUnitPrice = isCalendarNumber(costTotal) && isCalendarNumber(coolingTotal) && coolingTotal > 0
    ? costTotal / coolingTotal
    : null;
  const unitPriceAverage = averageCalendarValues(monthItems, (item) => item.unitPrice);
  const aggregateEfficiency = firstCalendarNumber(calculatedEfficiency, efficiencyAverage, rawEfficiencyAverage, summary?.efficiency, summary?.rawEfficiency);
  const aggregateRawEfficiency = firstCalendarNumber(calculatedEfficiency, rawEfficiencyAverage, efficiencyAverage, summary?.rawEfficiency, summary?.efficiency);
  const aggregatePower = firstCalendarNumber(powerTotal, summary?.power);
  const aggregateCooling = firstCalendarNumber(coolingTotal, summary?.cooling);
  const aggregateCost = firstCalendarNumber(costTotal, summary?.cost);
  const aggregateUnitPrice = firstCalendarNumber(calculatedUnitPrice, summary?.unitPrice, unitPriceAverage);
  const hasData = [
    aggregateEfficiency,
    aggregateRawEfficiency,
    aggregatePower,
    aggregateCooling,
    aggregateUnitPrice,
    aggregateCost
  ].some(isCalendarNumber);

  if (!hasData && !summary?.hasData) {
    return null;
  }

  return {
    id: summary?.id || `${month}-summary`,
    date: month,
    day: month.slice(-2),
    efficiency: aggregateEfficiency,
    rawEfficiency: aggregateRawEfficiency,
    power: aggregatePower,
    cooling: aggregateCooling,
    unitPrice: aggregateUnitPrice,
    cost: aggregateCost,
    hasData: hasData || Boolean(summary?.hasData)
  };
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

function getCalendarQualityShortLabel(tone: ReturnType<typeof getCalendarQuality>["tone"]): string {
  if (tone === "excellent") {
    return "优";
  }
  if (tone === "good") {
    return "良";
  }
  if (tone === "attention") {
    return "关";
  }
  if (tone === "critical") {
    return "弱";
  }
  if (tone === "future") {
    return "未";
  }
  return "缺";
}

function buildAiDigestSummaryLabel(aiDigest: AiDigestDto | null): string | null {
  const label = aiDigest?.summary?.label?.trim();
  if (label) {
    return label;
  }
  const level = aiDigest?.operationsGate?.level;
  if (level === "ready") {
    return "\u7ed3\u679c\u53ef\u7528";
  }
  if (level === "caution") {
    return "\u9700\u5173\u6ce8";
  }
  if (level === "blocked") {
    return "\u9700\u5904\u7406";
  }
  return null;
}

function buildAiDigestSummaryText(aiDigest: AiDigestDto | null): string | null {
  return (
    aiDigest?.summary?.summary?.trim()
    || aiDigest?.operationsGate?.summary?.trim()
    || aiDigest?.nextAction?.summary?.trim()
    || null
  );
}

function buildAiDigestFreshnessLabel(aiDigest: AiDigestDto | null): string | null {
  const freshness = aiDigest?.freshness?.label?.trim();
  if (!freshness) {
    return null;
  }
  if (freshness === "fresh") {
    return "\u6700\u65b0";
  }
  if (freshness === "stale") {
    return "\u504f\u65e7";
  }
  if (freshness === "unknown") {
    return "\u65b0\u9c9c\u5ea6\u672a\u77e5";
  }
  return freshness;
}

function renderEmptyTrendPanel(loadError: string | null, emptyText: string, hint: string) {
  return (
    <div className="trend-panel">
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <p className="empty-hint">{emptyText}</p>
      <p className="empty-hint">{hint}</p>
    </div>
  );
}

function EnergyEfficiencySeriesChart({
  data,
  loadError,
  metaItems = []
}: {
  data: EnergyEfficiencyReportDto | null;
  loadError: string | null;
  metaItems?: Array<{ label: string; value: string }>;
}) {
  const series = data?.series || [];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");

  if (series.length === 0 || numericValues.length === 0) {
    return renderEmptyTrendPanel(loadError, zhCN.energyEfficiencyPage.chartEmpty, "\u8bf7\u5148\u9009\u62e9\u8bbe\u5907\u548c\u65f6\u95f4\u8303\u56f4\uff0c\u518d\u67e5\u770b\u8d8b\u52bf\u3002");
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

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    top: yBottom - ratio * yRange,
    value: globalMin + span * ratio
  }));
  const axisLabels = data?.axisLabels?.length
    ? data.axisLabels
    : series[0]?.points?.map((point) => point.label || "") || [];
  const maxPointCount = Math.max(axisLabels.length, ...series.map((item) => item.points?.length || 0));
  const xTickIndexes = Array.from(
    new Set(
      axisLabels.length <= 1
        ? [0]
        : [0, Math.floor((axisLabels.length - 1) / 2), axisLabels.length - 1]
    )
  ).filter((index) => index >= 0 && index < axisLabels.length);
  const hoverX =
    hoverIndex !== null && maxPointCount > 0 ? (maxPointCount <= 1 ? 50 : (hoverIndex / (maxPointCount - 1)) * 100) : null;
  const hoverLabel =
    hoverIndex !== null
      ? axisLabels[hoverIndex] || series[0]?.points?.[hoverIndex]?.label || `#${hoverIndex + 1}`
      : "";
  const hoverRows =
    hoverIndex !== null
      ? series
          .map((item, seriesIndex) => {
            const value = item.points?.[hoverIndex]?.value;
            if (typeof value !== "number") {
              return null;
            }
            return {
              id: item.id || `hover-series-${seriesIndex + 1}`,
              name: item.name || zhCN.common.unknown,
              value,
              color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length]
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  function handleChartPointerMove(event: { currentTarget: HTMLDivElement; clientX: number }) {
    if (maxPointCount <= 0) {
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
        <div className="energy-analysis-chart-value-range">
          <strong>{`${formatNumber(globalMin)} / ${formatNumber(globalMax)}`}</strong>
          <p>{zhCN.energyEfficiencyPage.copRangeLabel}</p>
        </div>
        {metaItems.length > 0 ? (
          <div className="energy-efficiency-chart-meta-pills" aria-label={zhCN.energyEfficiencyPage.sectionChart}>
            {metaItems.map((item) => (
              <span className="energy-efficiency-chart-meta-pill" key={`${item.label}-${item.value}`}>
                <em>{item.label.replace(/[：:]\s*$/, "")}</em>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <div>
          <strong>{formatCount(series.length)}</strong>
          <p>{zhCN.energyEfficiencyPage.summarySeries}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label={zhCN.energyEfficiencyPage.chartAriaLabel}>
        <div className="energy-analysis-y-axis" aria-hidden="true">
          {yTicks.map((tick) => (
            <span key={`${tick.top}-${tick.value}`} style={{ top: `${tick.top}%` }}>
              {formatNumber(tick.value)}
            </span>
          ))}
        </div>
        <div className="energy-analysis-plot-stack">
          <div
            className="energy-analysis-chart-interactive"
            onPointerMove={handleChartPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
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
                        className="trend-line-path trend-line-path--slim energy-analysis-line-path"
                        fill="none"
                        stroke={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                        strokeWidth="0.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                  </g>
                );
              })}
              {hoverX !== null ? (
                <g className="energy-analysis-hover-layer">
                  <line x1={hoverX} y1="0" x2={hoverX} y2="100" className="energy-analysis-hover-line" />
                </g>
              ) : null}
            </svg>
            {hoverX !== null && hoverRows.length > 0 ? (
              <div
                className={`energy-analysis-chart-tooltip${hoverX > 52 ? " is-left" : ""}`}
                style={{ left: `${hoverX}%` }}
              >
                <strong>{hoverLabel}</strong>
                {hoverRows.map((item) => (
                  <span key={item.id}>
                    <i style={{ backgroundColor: item.color }} />
                    <em>{item.name}</em>
                    <b>{formatNumber(item.value)}</b>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {xTickIndexes.length > 0 ? (
            <div className="energy-analysis-x-axis" aria-hidden="true">
              {xTickIndexes.map((index) => (
                <span key={`${axisLabels[index] || "axis"}-${index + 1}`}>{axisLabels[index] || "--"}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EnergyEfficiencyProportionChart({
  data,
  loadError,
  metaItems = []
}: {
  data: EnergyEfficiencyProportionDto | null;
  loadError: string | null;
  metaItems?: Array<{ label: string; value: string }>;
}) {
  const rows = data ? buildCompleteLoadBandRows(data.rows || []) : [];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const ratioValues = rows.map((item) => item.loadRatioPct).filter((value): value is number => typeof value === "number");
  const efficiencyValues = rows.map((item) => item.stationEfficiency).filter((value): value is number => typeof value === "number");
  const splitAxisLabel = (value: string): string[] => value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (rows.length === 0 || ratioValues.length === 0) {
    return renderEmptyTrendPanel(loadError, zhCN.energyEfficiencyPage.proportionEmpty, "\u8bf7\u5148\u9009\u62e9\u6309\u6708\u6216\u6309\u5e74\u89c6\u56fe\uff0c\u518d\u67e5\u770b\u8d1f\u8377\u6bd4\u91cd\u3002");
  }

  const maxRatio = Math.max(...ratioValues, 100);
  const maxEfficiency = efficiencyValues.length > 0 ? Math.max(...efficiencyValues) : 1;
  const plotWidth = 84 * 1.125;
  const plotEdge = (100 - plotWidth) / 2;
  const plotLeft = plotEdge;
  const plotRight = plotLeft + plotWidth;
  const slotWidth = rows.length === 0 ? plotWidth : plotWidth / rows.length;
  const barWidth = Math.min(2.8, Math.max(1.4, slotWidth * 0.28));
  const plotTopY = 12;
  const plotBottomY = 92;
  const plotHeight = plotBottomY - plotTopY;

  const points = rows.map((row, index) => {
    const x = plotLeft + slotWidth * (index + 0.5);
    const barHeight = typeof row.loadRatioPct === "number" ? (row.loadRatioPct / maxRatio) * plotHeight : 0;
    const lineY = typeof row.stationEfficiency === "number"
      ? plotBottomY - (row.stationEfficiency / maxEfficiency) * plotHeight
      : plotBottomY;
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
  const dominantPoint = points.reduce<typeof points[number] | null>((current, point) => (
    current == null || (point.ratio || 0) > (current.ratio || 0) ? point : current
  ), null);

  const linePaths: string[] = [];
  let currentLinePath: string[] = [];
  points.forEach((point) => {
    if (typeof point.efficiency !== "number") {
      if (currentLinePath.length > 0) {
        linePaths.push(currentLinePath.join(" "));
        currentLinePath = [];
      }
      return;
    }
    currentLinePath.push(`${currentLinePath.length === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.lineY.toFixed(2)}`);
  });
  if (currentLinePath.length > 0) {
    linePaths.push(currentLinePath.join(" "));
  }
  const efficiencyMarkers = points.filter((point) => typeof point.efficiency === "number");
  const axisTickRatios = [1, 0.75, 0.5, 0.25, 0];
  const ratioAxisTicks = axisTickRatios.map((ratio) => ({
    top: plotBottomY - ratio * plotHeight,
    value: maxRatio * ratio
  }));
  const efficiencyAxisTicks = axisTickRatios.map((ratio) => ({
    top: plotBottomY - ratio * plotHeight,
    value: maxEfficiency * ratio
  }));
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverX = hoverPoint?.x ?? null;

  function handleProportionPointerMove(event: { currentTarget: HTMLDivElement; clientX: number }) {
    if (points.length === 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * 100;
    const ratio = Math.max(0, Math.min(0.999999, (svgX - plotLeft) / plotWidth));
    const nextIndex = Math.max(0, Math.min(points.length - 1, Math.floor(ratio * points.length)));
    setHoverIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  return (
    <div className="trend-panel">
      <div className="trend-meta">
        <div>
          <strong>{dominantPoint ? `${formatNumber(dominantPoint.ratio, 1)}%` : "--"}</strong>
          <p>{zhCN.energyEfficiencyPage.proportionRatioLabel}</p>
        </div>
        {metaItems.length > 0 ? (
          <div className="energy-efficiency-chart-meta-pills energy-efficiency-proportion-chart-meta" aria-label={zhCN.energyEfficiencyPage.proportionChartTitle}>
            {metaItems.map((item) => (
              <span className="energy-efficiency-chart-meta-pill" key={`${item.label}-${item.value}`}>
                <em>{item.label.replace(/[：:]\s*$/, "")}</em>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <div>
          <strong>{formatCop(dominantPoint?.efficiency)}</strong>
          <p>{zhCN.energyEfficiencyPage.proportionEfficiencyLabel}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="energy-efficiency-proportion-shell" aria-label={zhCN.energyEfficiencyPage.proportionChartAriaLabel}>
        <div className="energy-efficiency-proportion-chart-frame">
          <div className="energy-efficiency-proportion-y-axis is-left" aria-hidden="true">
            <strong>负荷比例(%)</strong>
            {ratioAxisTicks.map((tick) => (
              <span key={`ratio-${tick.top}`} style={{ top: `${tick.top}%` }}>
                {`${formatNumber(tick.value, tick.value >= 100 ? 0 : 1)}%`}
              </span>
            ))}
          </div>
          <div
            className="energy-efficiency-proportion-chart-interactive"
            onPointerMove={handleProportionPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="energy-efficiency-proportion-chart">
              {ratioAxisTicks.slice(0, -1).map((tick) => (
                <line key={`grid-${tick.top}`} x1={plotLeft} y1={tick.top} x2={plotRight} y2={tick.top} className="trend-grid-line" />
              ))}
              {points.map((point) => (
                <rect
                  className="energy-efficiency-proportion-load-bar"
                  key={`bar-${point.key}`}
                  x={point.x - barWidth / 2}
                  y={plotBottomY - point.barHeight}
                  width={barWidth}
                  height={point.barHeight}
                />
              ))}
              {linePaths.map((linePath, index) => (
                <path
                  className="energy-efficiency-proportion-efficiency-line"
                  key={`efficiency-line-${index + 1}`}
                  d={linePath}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {efficiencyMarkers.map((point) => (
                <circle
                  className="energy-efficiency-proportion-efficiency-marker"
                  key={`efficiency-marker-${point.key}`}
                  cx={point.x}
                  cy={point.lineY}
                  r="0.86"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {hoverX !== null ? (
                <g className="energy-analysis-hover-layer">
                  <line x1={hoverX} y1={plotTopY} x2={hoverX} y2={plotBottomY} className="energy-analysis-hover-line" />
                </g>
              ) : null}
            </svg>
            {hoverPoint ? (
              <div
                className={`energy-analysis-chart-tooltip${hoverX !== null && hoverX > 52 ? " is-left" : ""}`}
                style={{ left: `${hoverPoint.x}%` }}
              >
                <strong className="energy-efficiency-proportion-tooltip-title">
                  {splitAxisLabel(hoverPoint.label).map((part, index) => (
                    <em key={`${hoverPoint.key}-tooltip-${index + 1}`}>{part}</em>
                  ))}
                </strong>
                <span>
                  <i style={{ backgroundColor: "rgba(99, 230, 255, 0.92)" }} />
                  <em>负荷比例</em>
                  <b className={`energy-efficiency-proportion-table-value ${getLoadRatioToneClass(hoverPoint.ratio)}`}>
                    {`${formatNumber(hoverPoint.ratio, 1)}%`}
                  </b>
                </span>
                <span>
                  <i style={{ backgroundColor: "#8ff7d7" }} />
                  <em>冷站能效</em>
                  <b className={`energy-efficiency-proportion-table-value ${getStationEfficiencyToneClass(hoverPoint.efficiency)}`}>
                    {formatCop(hoverPoint.efficiency)}
                  </b>
                </span>
              </div>
            ) : null}
          </div>
          <div className="energy-efficiency-proportion-y-axis is-right" aria-hidden="true">
            <strong>冷站能效(COP)</strong>
            {efficiencyAxisTicks.map((tick) => (
              <span key={`efficiency-${tick.top}`} style={{ top: `${tick.top}%` }}>
                {formatNumber(tick.value, 2)}
              </span>
            ))}
          </div>
        </div>
        <div className="energy-efficiency-proportion-x-axis-frame" aria-hidden="true">
          <span />
          <div
            className="energy-efficiency-proportion-x-axis"
            style={{
              gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
              paddingLeft: `${plotEdge}%`,
              paddingRight: `${plotEdge}%`
            }}
          >
            {points.map((point) => (
              <span key={`axis-${point.key}`} className="energy-efficiency-proportion-x-axis-label">
                {splitAxisLabel(point.label).slice(0, 3).map((part, index) => (
                  <em key={`${point.key}-axis-${index + 1}`}>{part}</em>
                ))}
                <strong className="energy-efficiency-proportion-x-axis-value">
                  <span className={`energy-efficiency-proportion-x-axis-number ${getLoadRatioToneClass(point.ratio)}`}>
                    {`${formatNumber(point.ratio, 1)}%`}
                  </span>
                  <span className="energy-efficiency-proportion-x-axis-separator">/</span>
                  <span className={`energy-efficiency-proportion-x-axis-number ${getStationEfficiencyToneClass(point.efficiency)}`}>
                    {formatCop(point.efficiency)}
                  </span>
                </strong>
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </div>
  );
}

function EnergyEfficiencyImbalanceChart({
  data,
  loadError,
  metaItems = []
}: {
  data: EnergyEfficiencyImbalanceDto | null;
  loadError: string | null;
  metaItems?: Array<{ label: string; value: string }>;
}) {
  const series = data?.series || [];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");

  if (series.length === 0 || numericValues.length === 0) {
    return renderEmptyTrendPanel(loadError, zhCN.energyEfficiencyPage.imbalanceEmpty, "\u8bf7\u5148\u9009\u62e9\u65f6\u95f4\u8303\u56f4\uff0c\u518d\u67e5\u770b\u9608\u503c\u6ce2\u52a8\u3002");
  }

  const maxAbs = 15;
  const yTop = 8;
  const yBottom = 92;
  const yRange = yBottom - yTop;

  function toY(value: number): number {
    const clampedValue = Math.max(-maxAbs, Math.min(maxAbs, value));
    const normalized = (clampedValue + maxAbs) / (maxAbs * 2 || 1);
    return yBottom - normalized * yRange;
  }

  const thresholdTop = toY(5);
  const thresholdBottom = toY(-5);
  const baseline = toY(0);
  const yAxisTicks = [maxAbs, maxAbs / 2, 0, -maxAbs / 2, -maxAbs].map((value) => ({
    value,
    y: toY(value)
  }));
  const longestSeries = series.reduce((current, item) => (
    (item.points?.length || 0) > (current.points?.length || 0) ? item : current
  ), series[0] || {});
  const xAxisLabels = (data?.axisLabels || []).length > 0
    ? (data?.axisLabels || [])
    : (longestSeries.points || []).map((point) => point.label || "");
  const maxXAxisTicks = 5;
  const xTickStep = xAxisLabels.length <= maxXAxisTicks ? 1 : Math.ceil((xAxisLabels.length - 1) / (maxXAxisTicks - 1));
  const xAxisTicks = xAxisLabels
    .map((label, index) => {
      const tickLabel = String(label || index + 1).trim() || String(index + 1);
      const displayLabel = splitAxisDateTimeLabel(tickLabel);
      return {
        label: tickLabel,
        primaryLabel: displayLabel.primary,
        secondaryLabel: displayLabel.secondary,
        index,
        x: xAxisLabels.length <= 1 ? 50 : (index / (xAxisLabels.length - 1)) * 100
      };
    })
    .filter((_tick, index) => index === 0 || index === xAxisLabels.length - 1 || index % xTickStep === 0);
  const maxPointCount = Math.max(0, ...series.map((item) => item.points?.length || 0));
  const activeHoverIndex = hoverIndex !== null && maxPointCount > 0
    ? Math.max(0, Math.min(maxPointCount - 1, hoverIndex))
    : null;
  const hoverX = activeHoverIndex !== null
    ? (maxPointCount <= 1 ? 50 : (activeHoverIndex / (maxPointCount - 1)) * 100)
    : null;
  const hoverLabel = activeHoverIndex !== null
    ? xAxisLabels[activeHoverIndex] || longestSeries.points?.[activeHoverIndex]?.label || `#${activeHoverIndex + 1}`
    : "";
  const hoverRows = activeHoverIndex !== null
    ? series
        .map((item, seriesIndex) => {
          const value = item.points?.[activeHoverIndex]?.value;
          if (typeof value !== "number") {
            return null;
          }
          return {
            id: item.id || `imbalance-hover-${seriesIndex + 1}`,
            name: series.length === 1 ? "热平衡偏差" : (item.name || "热平衡偏差"),
            value,
            color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
            toneClass: getThermalImbalanceToneClass(value)
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  function handleImbalancePointerMove(event: { currentTarget: HTMLDivElement; clientX: number }) {
    if (maxPointCount <= 0) {
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
          <strong>{`${formatNumber(-maxAbs, 1)} / ${formatNumber(maxAbs, 1)}`}</strong>
          <p>{zhCN.energyEfficiencyPage.thermalDeviationRangeLabel}</p>
        </div>
        {metaItems.length > 0 ? (
          <div className="energy-efficiency-chart-meta-pills energy-efficiency-imbalance-chart-meta" aria-label={zhCN.energyEfficiencyPage.imbalanceChartTitle}>
            {metaItems.map((item) => (
              <span className="energy-efficiency-chart-meta-pill" key={`${item.label}-${item.value}`}>
                <em>{item.label.replace(/[：:]\s*$/, "")}</em>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <div>
          <strong>{zhCN.energyEfficiencyPage.imbalanceThresholdLabel}</strong>
          <p>热平衡偏差达标范围</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell energy-efficiency-imbalance-chart-shell" aria-label={zhCN.energyEfficiencyPage.imbalanceChartAriaLabel}>
        <div className="energy-efficiency-imbalance-y-axis" aria-hidden="true">
          {yAxisTicks.map((tick) => (
            <span key={`imbalance-y-${tick.value}`} style={{ top: `${tick.y}%` }}>
              {`${formatNumber(tick.value, Math.abs(tick.value) >= 10 ? 0 : 1)}%`}
            </span>
          ))}
        </div>
        <div
          className="energy-efficiency-imbalance-plot-stack"
          onPointerMove={handleImbalancePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
            {yAxisTicks.map((tick) => (
              <line key={`imbalance-grid-${tick.value}`} x1="0" y1={tick.y} x2="100" y2={tick.y} className="trend-grid-line" />
            ))}
            <line x1="0" y1={yTop} x2="0" y2={yBottom} className="energy-efficiency-imbalance-axis-line" />
            <line x1="0" y1={yBottom} x2="100" y2={yBottom} className="energy-efficiency-imbalance-axis-line" />
            {yAxisTicks.map((tick) => (
              <line key={`imbalance-y-tick-${tick.value}`} x1="0" y1={tick.y} x2="1.4" y2={tick.y} className="energy-efficiency-imbalance-axis-tick" />
            ))}
            {xAxisTicks.map((tick) => (
              <line key={`imbalance-x-tick-${tick.index}`} x1={tick.x} y1={yBottom} x2={tick.x} y2={yBottom + 2.2} className="energy-efficiency-imbalance-axis-tick" />
            ))}
            <rect
              x="0"
              y={thresholdTop}
              width="100"
              height={thresholdBottom - thresholdTop}
              className="energy-efficiency-imbalance-pass-band"
            />
            <line x1="0" y1={baseline} x2="100" y2={baseline} stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
            {hoverX !== null ? (
              <g className="energy-analysis-hover-layer">
                <line x1={hoverX} y1={yTop} x2={hoverX} y2={yBottom} className="energy-analysis-hover-line" />
              </g>
            ) : null}
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
                      strokeWidth="0.45"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </g>
              );
            })}
            <line
              className="energy-efficiency-imbalance-pass-line"
              x1="0"
              y1={thresholdTop}
              x2="100"
              y2={thresholdTop}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="energy-efficiency-imbalance-pass-line"
              x1="0"
              y1={thresholdBottom}
              x2="100"
              y2={thresholdBottom}
              vectorEffect="non-scaling-stroke"
            />
            <text
              className="energy-efficiency-imbalance-threshold-label"
              x="98.5"
              y={thresholdTop - 1.6}
              textAnchor="end"
            >
              +5%
            </text>
            <text
              className="energy-efficiency-imbalance-threshold-label"
              x="98.5"
              y={thresholdBottom + 2.6}
              textAnchor="end"
            >
              -5%
            </text>
          </svg>
          {hoverX !== null && hoverRows.length > 0 ? (
            <div
              className={`energy-analysis-chart-tooltip${hoverX > 52 ? " is-left" : ""}`}
              style={{ left: `${hoverX}%` }}
            >
              <strong>{hoverLabel}</strong>
              {hoverRows.map((row) => (
                <span key={row.id}>
                  <i style={{ backgroundColor: row.color }} />
                  <em>{row.name}</em>
                  <b className={`energy-efficiency-imbalance-value ${row.toneClass}`}>{`${formatNumber(row.value, 2)}%`}</b>
                </span>
              ))}
            </div>
          ) : null}
          <div className="energy-efficiency-imbalance-x-axis" aria-hidden="true">
            {xAxisTicks.map((tick) => (
              <span
                key={`imbalance-x-label-${tick.index}`}
                className={tick.index === 0 ? "is-edge-start" : tick.index === xAxisLabels.length - 1 ? "is-edge-end" : ""}
                style={{ left: `${tick.x}%` }}
                title={tick.label}
              >
                <strong>{tick.primaryLabel}</strong>
                {tick.secondaryLabel ? <em>{tick.secondaryLabel}</em> : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnergyEfficiencyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = getActiveTab(searchParams);
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab);

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
  const { aiDigest } = useAiDigest(runtimeConfig.siteId);

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
  const calendarMonthInputRef = useRef<HTMLInputElement | null>(null);
  const searchStartDateInputRef = useRef<HTMLInputElement | null>(null);
  const searchEndDateInputRef = useRef<HTMLInputElement | null>(null);
  const compareDateInputRef = useRef<HTMLInputElement | null>(null);
  const proportionDateInputRef = useRef<HTMLInputElement | null>(null);
  const imbalanceStartDateInputRef = useRef<HTMLInputElement | null>(null);
  const imbalanceEndDateInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimeSpaceDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isSearchTimeSpaceDropdownOpen, setIsSearchTimeSpaceDropdownOpen] = useState(false);

  useEffect(() => {
    setActiveTab((current) => (current === urlTab ? current : urlTab));
  }, [urlTab]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam || TAB_SET.has(tabParam as TabKey)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "calendar");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const deviceOptions = useMemo(() => getDeviceOptions(), []);
  const calendarEntries = useMemo(
    () => buildCalendarEntries(calendarData?.month || calendarFilters.month, calendarData?.items || []),
    [calendarData, calendarFilters.month]
  );
  const calendarMonthSummary = useMemo(
    () => buildCalendarMonthAggregate(
      calendarData?.month || calendarFilters.month,
      calendarData?.items || [],
      calendarData?.monthSummary || null
    ),
    [calendarData, calendarFilters.month]
  );
  const selectedCalendarItem = useMemo(
    () => calendarEntries.find((item) => item.date === calendarFilters.selectedDate) || null,
    [calendarEntries, calendarFilters.selectedDate]
  );
  const activeCalendarItem = calendarFilters.mode === "month"
    ? calendarMonthSummary
    : selectedCalendarItem;
  const calendarPieDisplayData = calendarPieData;

  useEffect(() => {
    if (!isSearchTimeSpaceDropdownOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && searchTimeSpaceDropdownRef.current?.contains(target)) {
        return;
      }
      setIsSearchTimeSpaceDropdownOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isSearchTimeSpaceDropdownOpen]);

  useEffect(() => {
    if (activeTab === "calendar" && !calendarQuery) {
      setCalendarQuery({ month: calendarFilters.month });
    }
    if ((activeTab === "calendar" || activeTab === "imbalance") && !imbalanceQuery) {
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
    if ((activeTab === "calendar" || activeTab === "proportion") && !proportionQuery) {
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
        const [pieResultState, coldStationLogState] = await Promise.allSettled([
          fetchEnergyEfficiencyCalendarPie(runtimeConfig.siteId, calendarPieQuery),
          calendarPieQuery.dateType === "1"
            ? fetchColdStationLogs(runtimeConfig.siteId, calendarPieQuery.date)
            : Promise.resolve(null)
        ]);
        const pieResult = pieResultState.status === "fulfilled" ? pieResultState.value : null;
        const coldStationLog = coldStationLogState.status === "fulfilled" ? coldStationLogState.value : null;
        const coldStationLogSegments = buildCalendarPieSegmentsFromColdStationLog(coldStationLog);
        const coldStationLogTotal = coldStationLogSegments.reduce((sum, item) => sum + (item.value || 0), 0);
        let resolvedResult: EnergyEfficiencyCalendarPieDto | null = pieResult;

        if (coldStationLogSegments.length >= 2 && coldStationLogTotal > 0) {
          resolvedResult = {
            ...(pieResult || {}),
            site: pieResult?.site || coldStationLog?.site,
            generatedAt: coldStationLog?.generatedAt || pieResult?.generatedAt,
            filters: pieResult?.filters || {
              date: calendarPieQuery.date,
              dateType: calendarPieQuery.dateType
            },
            segments: coldStationLogSegments,
            total: coldStationLogTotal,
            freshness: coldStationLog?.freshness || pieResult?.freshness,
            sourceStatus: coldStationLog?.sourceStatus || pieResult?.sourceStatus
          };
        }

        if (
          (!resolvedResult || shouldHydrateCalendarPieFromEnergyAnalysis(resolvedResult))
          && calendarPieQuery.date
        ) {
          try {
            const fallbackRange = buildCalendarPieFallbackRange(calendarPieQuery.date, calendarPieQuery.dateType);
            const fallbackReport = await fetchEnergyAnalysis(runtimeConfig.siteId, {
              startDate: fallbackRange.startDate,
              endDate: fallbackRange.endDate,
              dateType: fallbackRange.energyAnalysisDateType,
              deviceIds: [...CALENDAR_PIE_FALLBACK_DEVICE_IDS]
            });
            const fallbackSegments = buildCalendarPieSegmentsFromEnergyAnalysis(fallbackReport);
            const fallbackTotal = fallbackSegments.reduce((sum, item) => sum + (item.value || 0), 0);

            if (fallbackSegments.length >= 2 && fallbackTotal > 0) {
              resolvedResult = {
                ...(resolvedResult || pieResult || {}),
                generatedAt: fallbackReport.generatedAt || resolvedResult?.generatedAt || pieResult?.generatedAt,
                filters: resolvedResult?.filters || pieResult?.filters || {
                  date: calendarPieQuery.date,
                  dateType: calendarPieQuery.dateType
                },
                segments: fallbackSegments,
                total: fallbackTotal,
                freshness: fallbackReport.freshness || resolvedResult?.freshness || pieResult?.freshness
              };
            }
          } catch (_fallbackError) {
            // If hydration fails, the guard below prevents a single total from masquerading as a split.
          }
        }
        if (
          calendarPieQuery.dateType === "2"
          && calendarPieQuery.date
          && (!resolvedResult || shouldHydrateCalendarPieFromEnergyAnalysis(resolvedResult))
        ) {
          try {
            const monthlyDailyAggregate = await fetchMonthlyCalendarPieFromDailyEntries(
              runtimeConfig.siteId,
              calendarPieQuery.date,
              calendarEntries
            );
            const monthlyDailyTotal = getCalendarPieSegmentTotal(monthlyDailyAggregate?.segments || []);

            if (monthlyDailyAggregate && monthlyDailyTotal > 0) {
              resolvedResult = {
                ...(resolvedResult || pieResult || {}),
                generatedAt: monthlyDailyAggregate.generatedAt || resolvedResult?.generatedAt || pieResult?.generatedAt,
                filters: {
                  date: calendarPieQuery.date,
                  dateType: calendarPieQuery.dateType
                },
                segments: monthlyDailyAggregate.segments,
                total: monthlyDailyTotal,
                freshness: monthlyDailyAggregate.freshness || resolvedResult?.freshness || pieResult?.freshness,
                sourceStatus: monthlyDailyAggregate.sourceStatus || resolvedResult?.sourceStatus || pieResult?.sourceStatus
              };
            }
          } catch (_monthlyDailyError) {
            // Month view can still fall back to total-only data if daily split aggregation is unavailable.
          }
        }
        if (
          resolvedResult
          && shouldHydrateCalendarPieFromEnergyAnalysis(resolvedResult)
          && getCalendarPieSegmentTotal(buildCalendarPieSegmentsFromPieData(resolvedResult)) <= 0
        ) {
          resolvedResult = {
            ...resolvedResult,
            segments: buildEmptyCalendarPieSegments(),
            total: typeof resolvedResult.total === "number" ? resolvedResult.total : 0
          };
        }
        if (!resolvedResult) {
          throw (
            pieResultState.status === "rejected"
              ? pieResultState.reason
              : new Error(zhCN.energyEfficiencyPage.calendarPieLoadFailed)
          );
        }
        if (!active) {
          return;
        }
        startTransition(() => {
          setCalendarPieData(resolvedResult);
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
  }, [calendarEntries, calendarPieQuery]);

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
    setActiveTab((current) => (current === tab ? current : tab));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams);
  }

  function openDatePicker(input: HTMLInputElement | null): void {
    if (!input) {
      return;
    }
    input.focus();
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (_error) {
        // Some browsers block showPicker without a trusted click.
      }
    }
  }

  function openCalendarMonthPicker(): void {
    openDatePicker(calendarMonthInputRef.current);
  }

  function openSearchStartDatePicker(): void {
    openDatePicker(searchStartDateInputRef.current);
  }

  function openSearchEndDatePicker(): void {
    openDatePicker(searchEndDateInputRef.current);
  }

  function openCompareDatePicker(): void {
    openDatePicker(compareDateInputRef.current);
  }

  function openProportionDatePicker(): void {
    openDatePicker(proportionDateInputRef.current);
  }

  function openImbalanceStartDatePicker(): void {
    openDatePicker(imbalanceStartDateInputRef.current);
  }

  function openImbalanceEndDatePicker(): void {
    openDatePicker(imbalanceEndDateInputRef.current);
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
    ? [calendarData?.sourceStatus, calendarPieDisplayData?.sourceStatus]
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
  const sourceStatusLinesCompact = buildSourceStatusLines(activeStatuses, { labelMode: "short" });
  const bannerText = activeError || (activeLoading ? zhCN.energyEfficiencyPage.loading : sourceSummary.text);
  const digestSummaryLabel = buildAiDigestSummaryLabel(aiDigest);
  const digestSummaryText = buildAiDigestSummaryText(aiDigest);
  const digestFreshnessLabel = buildAiDigestFreshnessLabel(aiDigest);
  const aiDigestTag = aiDigest
    ? {
      label: "AI next step",
      value: aiDigest.nextAction?.label?.trim() || digestFreshnessLabel || digestSummaryLabel || "\u5df2\u63a5\u5165"
    }
    : null;
  const currentModeGuide = getModeGuide(activeTab);
  const activeTabLabel = ENERGY_EFFICIENCY_TABS.find((item) => item.key === activeTab)?.label || zhCN.energyEfficiencyPage.heading;
  const statusDigestLines = [
    aiDigest?.nextAction?.label?.trim() || digestFreshnessLabel || digestSummaryLabel,
    ...sourceStatusLinesCompact
  ].filter(Boolean).slice(0, 3);
  const sourceStateLabel = activeError
    ? "\u9700\u8981\u91cd\u8bd5"
    : activeLoading
      ? zhCN.energyEfficiencyPage.loading
      : sourceSummary.warn
        ? "\u9700\u8981\u5173\u6ce8"
        : "\u7ed3\u679c\u53ef\u7528";
  const displaySourceStateLabel = digestSummaryLabel || sourceStateLabel;
  const displayBannerText = digestSummaryText || bannerText;
  const activeLatestFetchText = activeTab === "calendar"
    ? formatDateTime(
      calendarData?.generatedAt
      || calendarData?.freshness?.latestTimestamp
      || calendarPieData?.generatedAt
      || calendarPieData?.freshness?.latestTimestamp
    )
    : activeTab === "imbalance"
      ? formatDateTime(imbalanceData?.generatedAt || imbalanceData?.freshness?.latestTimestamp)
      : activeTab === "search"
        ? formatDateTime(searchData?.generatedAt || searchData?.freshness?.latestTimestamp)
        : activeTab === "compare"
          ? formatDateTime(compareData?.generatedAt || compareData?.freshness?.latestTimestamp)
          : formatDateTime(proportionData?.generatedAt || proportionData?.freshness?.latestTimestamp);
  const activePrimaryStat = activeTab === "calendar"
    ? {
      title: "\u65e5\u5386\u5929\u6570",
      value: `${formatCount(calendarEntries.length)}\u5929`,
      detail: activeCalendarItem?.date ? `\u5f53\u524d ${activeCalendarItem.date}` : "\u5f85\u9009\u62e9\u65e5\u671f"
    }
    : activeTab === "search"
      ? {
        title: "\u5f53\u524d\u5bf9\u8c61",
        value: `${formatCount(searchData?.tableRows?.length || 0)}${zhCN.energyEfficiencyPage.unitObjects}`,
        detail: `${formatCount(searchFilters.deviceKeys.length)}${zhCN.energyEfficiencyPage.unitDevices} / ${getTimeSpaceLabel(searchFilters.timeSpace)}`
      }
      : activeTab === "compare"
        ? {
          title: "\u5bf9\u6bd4\u65e5\u671f",
          value: `${formatCount(compareFilters.dates.length)}${zhCN.energyEfficiencyPage.unitDates}`,
          detail: deviceOptions.find((item) => item.value === compareFilters.deviceKey)?.label || compareFilters.deviceKey
        }
        : activeTab === "proportion"
          ? {
            title: "\u8d1f\u8377\u533a\u95f4",
            value: `${formatCount(proportionData?.rows?.length || 0)}${zhCN.energyEfficiencyPage.unitBuckets}`,
            detail: `${proportionFilters.dateType === "3" ? zhCN.energyEfficiencyPage.proportionYear : zhCN.energyEfficiencyPage.proportionMonth} ${proportionFilters.date || "--"}`
          }
          : {
            title: "\u70ed\u5e73\u8861\u6821\u9a8c",
            value: `${formatCount(imbalanceData?.statisticsRows?.length || 0)}${zhCN.energyEfficiencyPage.unitObjects}`,
            detail: `${imbalanceFilters.startDate} ~ ${imbalanceFilters.endDate}`
          };
  const proportionDominantBandForCommand = getDominantLoadBand(
    buildCompleteLoadBandRows(proportionData?.rows || [])
  );
  const proportionDominantEfficiencyText = proportionDominantBandForCommand?.stationEfficiency == null
    ? "\u4e3b\u8d1f\u8377\u6bb5 --"
    : `\u4e3b\u8d1f\u8377\u6bb5 ${formatCop(proportionDominantBandForCommand.stationEfficiency)} COP`;
  const activeSecondaryStat = activeTab === "calendar"
    ? {
      title: "\u5f53\u524d\u6a21\u5f0f",
      value: calendarFilters.mode === "month" ? zhCN.energyEfficiencyPage.calendarModeMonth : zhCN.energyEfficiencyPage.calendarModeDay,
      detail: calendarFilters.month || "--"
    }
    : activeTab === "search"
      ? {
        title: "\u67e5\u8be2\u8303\u56f4",
        value: `${searchFilters.startDate} ~ ${searchFilters.endDate}`,
        detail: `${formatCount(searchData?.series?.length || 0)}${zhCN.energyEfficiencyPage.unitSeries}`
      }
      : activeTab === "compare"
        ? {
          title: "\u5bf9\u6bd4\u7a97\u53e3",
          value: buildCompareWindowLabel(compareFilters.dates),
          detail: `${formatCount(compareData?.series?.length || 0)}${zhCN.energyEfficiencyPage.unitSeries}`
        }
        : activeTab === "proportion"
          ? {
            title: "\u7edf\u8ba1\u7c92\u5ea6",
            value: proportionFilters.dateType === "3" ? zhCN.energyEfficiencyPage.proportionYear : zhCN.energyEfficiencyPage.proportionMonth,
            detail: proportionDominantEfficiencyText
        }
          : {
            title: "\u8fbe\u6807\u8fb9\u754c",
            value: zhCN.energyEfficiencyPage.imbalanceThresholdLabel,
            detail: `${formatCount(imbalanceData?.deviceRows?.length || 0)}${zhCN.energyEfficiencyPage.unitDevices}`
          };
  const commandStats = [
    {
      title: zhCN.energyEfficiencyPage.rangeLatestFetch.replace(":", ""),
      value: activeLatestFetchText,
      detail: activeTabLabel
    },
    {
      title: zhCN.energyEfficiencyPage.summaryState,
      value: displaySourceStateLabel,
      detail: statusDigestLines[0] || displayBannerText
    },
    activePrimaryStat,
    activeSecondaryStat
  ];
  const commandTags = activeTab === "calendar"
    ? [
      { label: "\u5f53\u524d\u89c6\u56fe", value: activeTabLabel },
      { label: zhCN.energyEfficiencyPage.filterMonth, value: calendarFilters.month || "--" },
      {
        label: zhCN.energyEfficiencyPage.filterCalendarMode,
        value: calendarFilters.mode === "month" ? zhCN.energyEfficiencyPage.calendarModeMonth : zhCN.energyEfficiencyPage.calendarModeDay
      },
      { label: zhCN.energyEfficiencyPage.calendarSelectedLabel, value: activeCalendarItem?.date || calendarFilters.selectedDate || "--" }
    ]
    : activeTab === "search"
      ? [
        { label: "\u5f53\u524d\u89c6\u56fe", value: activeTabLabel },
        { label: zhCN.energyEfficiencyPage.filterDevices, value: `${formatCount(searchFilters.deviceKeys.length)}${zhCN.energyEfficiencyPage.unitDevices}` },
        { label: zhCN.energyEfficiencyPage.filterTimeSpace, value: getTimeSpaceLabel(searchFilters.timeSpace) },
        { label: zhCN.energyEfficiencyPage.summaryRange, value: `${searchFilters.startDate} ~ ${searchFilters.endDate}` }
      ]
    : activeTab === "compare"
        ? [
          { label: "\u5f53\u524d\u89c6\u56fe", value: activeTabLabel },
          {
            label: zhCN.energyEfficiencyPage.filterDevice,
            value: deviceOptions.find((item) => item.value === compareFilters.deviceKey)?.label || compareFilters.deviceKey
          },
          { label: zhCN.energyEfficiencyPage.summaryDates, value: `${formatCount(compareFilters.dates.length)}${zhCN.energyEfficiencyPage.unitDates}` },
          { label: zhCN.energyEfficiencyPage.summaryRange, value: buildCompareWindowLabel(compareFilters.dates) }
        ]
    : activeTab === "proportion"
          ? [
            { label: "\u5f53\u524d\u89c6\u56fe", value: activeTabLabel },
            {
              label: zhCN.energyEfficiencyPage.filterDateType,
              value: proportionFilters.dateType === "3" ? zhCN.energyEfficiencyPage.proportionYear : zhCN.energyEfficiencyPage.proportionMonth
            },
            { label: zhCN.energyEfficiencyPage.filterDate, value: proportionFilters.date || "--" },
            { label: zhCN.energyEfficiencyPage.summaryBuckets, value: `${formatCount(proportionData?.rows?.length || 0)}${zhCN.energyEfficiencyPage.unitBuckets}` }
          ]
          : [
          { label: "\u5f53\u524d\u89c6\u56fe", value: activeTabLabel },
          { label: zhCN.energyEfficiencyPage.filterImbalanceStartDate, value: imbalanceFilters.startDate || "--" },
          { label: zhCN.energyEfficiencyPage.filterImbalanceEndDate, value: imbalanceFilters.endDate || "--" },
          { label: "\u8fbe\u6807\u8fb9\u754c", value: zhCN.energyEfficiencyPage.imbalanceThresholdLabel }
        ];
  const commandTagsWithDigest = aiDigestTag ? [...commandTags, aiDigestTag] : commandTags;

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
      ...buildCompleteLoadBandRows(proportionData.rows || []).map((row) => [
        row.rangeLabel || "--",
        formatNumber(row.loadRatioPct, 1),
        formatCop(row.stationEfficiency)
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
    const firstDayOffset = /^\d{4}-\d{2}$/.test(calendarFilters.month)
      ? new Date(`${calendarFilters.month}-01T00:00:00`).getDay()
      : 0;
    const overviewMonth = calendarData?.month || calendarFilters.month;
    const calendarMonthDayCount = /^\d{4}-\d{2}$/.test(overviewMonth)
      ? new Date(`${overviewMonth}-01T00:00:00`).getDate()
      : calendarEntries.length;
    const calendarWeekRowCount = Math.max(5, Math.min(6, Math.ceil((firstDayOffset + calendarMonthDayCount) / 7) || 5));
    const completedCalendarItems = getCalendarCompleteItems(overviewMonth, calendarEntries);
    const partialToday = getCalendarPartialToday(overviewMonth, calendarEntries);
    const trendPoints = buildCalendarTrendPoints(completedCalendarItems, partialToday);
    const trendWindowLabel = trendPoints.length > 0 ? `近${formatCount(trendPoints.length)}日` : "近11日";
    const trendBadgeLabel = completedCalendarItems.length > trendPoints.length
      ? `${formatCount(completedCalendarItems.length)}日有效 · ${trendWindowLabel}`
      : `${formatCount(completedCalendarItems.length)}日有效`;
    const calendarMonthStatusLabel = partialToday
      ? "未完整"
      : completedCalendarItems.length <= 0
        ? "待采集"
        : calendarMonthDayCount > 0 && completedCalendarItems.length >= calendarMonthDayCount
          ? "完整"
          : "缺数";
    const completedPower = sumCalendarValues(completedCalendarItems, (item) => item.power);
    const completedCooling = sumCalendarValues(completedCalendarItems, (item) => item.cooling);
    const monthCoolingPowerRatio = isCalendarNumber(completedPower) && completedPower > 0 && isCalendarNumber(completedCooling)
      ? completedCooling / completedPower
      : averageCalendarValues(completedCalendarItems, (item) => calculateCalendarCoolingPowerRatio(item));
    const completeRatioValues = completedCalendarItems
      .map((item) => calculateCalendarCoolingPowerRatio(item))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const averageRatio = completeRatioValues.length > 0
      ? completeRatioValues.reduce((sum, value) => sum + value, 0) / completeRatioValues.length
      : null;
    const bestCalendarItem = getCalendarBestItem(completedCalendarItems);
    const lowCalendarItem = getCalendarLowItem(completedCalendarItems);
    const overviewPieSegments = buildCalendarPieSegmentsFromPieData(calendarPieDisplayData);
    const overviewPieTotal = getCalendarPieSegmentTotal(overviewPieSegments);
    const overviewDonutTotal = overviewPieTotal > 0 ? overviewPieTotal : null;
    const overviewPieIsMonthScope = calendarPieQuery?.dateType !== "1";
    const overviewPieScopeDate = calendarPieQuery?.date || (overviewPieIsMonthScope ? overviewMonth : calendarFilters.selectedDate);
    const selectedDayQuality = getCalendarQuality(selectedCalendarItem);
    const selectedDayRatio = selectedDayQuality.tone !== "future" && selectedDayQuality.tone !== "missing"
      ? calculateCalendarCoolingPowerRatio(selectedCalendarItem)
      : null;
    const overviewPieCopLabel = overviewPieIsMonthScope
      ? `${overviewPieScopeDate || overviewMonth} · 月均COP ${formatCop(averageRatio)}`
      : `${overviewPieScopeDate || "--"} · 日COP ${formatCop(selectedDayRatio)}`;
    const overviewPieScopeKindLabel = overviewPieIsMonthScope ? "分项口径：月" : "分项口径：日";
    const calendarSelectionStatus = overviewPieIsMonthScope
      ? `当前选择 ${overviewPieScopeDate || overviewMonth} · 月口径`
      : `当前选择 ${overviewPieScopeDate || "--"} · 日口径`;
    const calendarQueryStatusLabel = overviewPieIsMonthScope
      ? `${overviewPieScopeDate || overviewMonth} · 月口径 · 均值 ${formatCop(averageRatio)}`
      : `${overviewPieScopeDate || "--"} · 日口径 · 月均 ${formatCop(averageRatio)}`;
    const overviewDonutScopeLabel = overviewPieIsMonthScope ? "月分项合计" : "日分项合计";
    const chillerSegment = overviewPieSegments.find((item) => resolveCalendarPieSegmentKind(item.id || item.name) === "chiller");
    const chillerShare = overviewPieTotal > 0 && chillerSegment?.value
      ? (chillerSegment.value / overviewPieTotal) * 100
      : null;
    const chillerShareScopeLabel = overviewPieIsMonthScope ? "月主机耗电占比" : "日主机耗电占比";
    const chillerShareScopeHint = overviewPieIsMonthScope ? "月分项口径" : "日分项口径";
    const scopeAuditHint = overviewPieIsMonthScope ? "累计全口径 / 月分项" : "累计全口径 / 日分项";
    const scopeAuditDiffPct = (
      isCalendarNumber(completedPower)
      && completedPower > 0
      && isCalendarNumber(overviewDonutTotal)
    )
      ? (Math.abs(overviewDonutTotal - completedPower) / completedPower) * 100
      : null;
    const scopeAuditStatusLabel = typeof scopeAuditDiffPct === "number"
      ? scopeAuditDiffPct <= 2
        ? "已对齐"
        : `差异 ${formatNumber(scopeAuditDiffPct, 1)}%`
      : "待校核";
    const scopeAuditTone = typeof scopeAuditDiffPct !== "number"
      ? "neutral"
      : scopeAuditDiffPct <= 2
        ? "good"
        : "warn";
    let overviewPieCursor = 0;
    const overviewPieSlices: Array<{
      item: EnergyEfficiencyCalendarPieSegmentDto;
      index: number;
      kind: typeof CALENDAR_PIE_FALLBACK_DEVICE_IDS[number] | null;
      color: string;
      ratio: number;
      start: number;
      end: number;
      mid: number;
    }> = [];
    overviewPieSegments.forEach((item, index) => {
      const value = item.value || 0;
      if (value <= 0 || overviewPieTotal <= 0) {
        return;
      }
      const ratio = (value / overviewPieTotal) * 100;
      const start = overviewPieCursor;
      const end = start + ratio;
      overviewPieCursor = end;
      const kind = resolveCalendarPieSegmentKind(item.id || item.name);
      overviewPieSlices.push({
        item,
        index,
        kind,
        color: kind ? CALENDAR_PIE_COLORS[kind] : CALENDAR_PIE_FALLBACK_COLOR,
        ratio,
        start,
        end,
        mid: (start + end) / 2
      });
    });
    const overviewPieStops = overviewPieSlices.map((slice) => (
      `${slice.color} ${slice.start.toFixed(2)}% ${slice.end.toFixed(2)}%`
    ));
    const overviewDonutBackground = overviewPieStops.length > 0
      ? `conic-gradient(from ${CALENDAR_PIE_START_ANGLE_DEG}deg, ${overviewPieStops.join(", ")})`
      : "linear-gradient(135deg, rgba(99, 230, 255, 0.18), rgba(143, 247, 215, 0.08))";
    const overviewPieCallouts = overviewPieSlices.map((slice, calloutIndex) => {
      const layout = slice.kind
        ? CALENDAR_PIE_CALLOUT_LAYOUTS[slice.kind]
        : {
          labelX: calloutIndex % 2 === 0 ? 78 : 22,
          labelY: 20 + calloutIndex * 15,
          leadX: calloutIndex % 2 === 0 ? 70 : 32,
          leadY: 30 + calloutIndex * 12,
          align: calloutIndex % 2 === 0 ? "left" : "right"
        } as const;
      const angle = CALENDAR_PIE_START_ANGLE_DEG + (slice.mid / 100) * 360;
      const angleRadians = (angle * Math.PI) / 180;
      const anchorX = 50 + Math.sin(angleRadians) * CALENDAR_PIE_ANCHOR_RADIUS_X;
      const anchorY = 50 - Math.cos(angleRadians) * CALENDAR_PIE_ANCHOR_RADIUS_Y;
      const labelAnchorX = layout.align === "left"
        ? Math.min(layout.labelX + 21, 94)
        : layout.align === "right"
          ? Math.max(layout.labelX - 21, 6)
          : layout.labelX;
      const leaderPoints = [
        [anchorX, anchorY],
        [layout.leadX, layout.leadY],
        [labelAnchorX, layout.labelY]
      ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      return {
        ...slice,
        layout,
        anchorX,
        anchorY,
        leaderPoints
      };
    });
    const loadBandRows = buildCompleteLoadBandRows(proportionData?.rows || []);
    const dominantLoadBand = getDominantLoadBand(loadBandRows);
    const dominantLoadBandBadge = dominantLoadBand
      ? `${dominantLoadBand.rangeLabel} · ${formatNumber(dominantLoadBand.loadRatioPct, 1)}%`
      : "10段";
    const maxLoadRatio = Math.max(0, ...loadBandRows.map((item) => item.loadRatioPct || 0));
    const thermalOverview = buildThermalBalanceOverview(imbalanceData);
    const gateLevel = aiDigest?.operationsGate?.level;
    const gateLabel = gateLevel === "ready" ? "可审阅" : gateLevel === "blocked" ? "阻塞" : "需复核";
    const gateTone = gateLevel === "ready" ? "good" : gateLevel === "blocked" ? "warn" : "neutral";
    const efficiencyTone = typeof monthCoolingPowerRatio === "number" && monthCoolingPowerRatio >= 6.5
      ? "good"
      : typeof monthCoolingPowerRatio === "number" && monthCoolingPowerRatio < 5.8
        ? "warn"
        : "neutral";
    const trendValues = trendPoints.map((item) => item.value);
    const trendMin = trendValues.length > 0 ? Math.min(...trendValues) : 0;
    const trendMax = trendValues.length > 0 ? Math.max(...trendValues) : 1;
    const trendSpan = trendMax === trendMin ? Math.max(Math.abs(trendMax), 1) : trendMax - trendMin;
    const trendSvgPoints = trendPoints.map((item, index) => {
      const x = trendPoints.length <= 1 ? 50 : 4 + (index / (trendPoints.length - 1)) * 92;
      const y = 88 - ((item.value - trendMin) / trendSpan) * 72;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

    return (
      <>
        <section className="energy-efficiency-overview" aria-label="能效分析总览">
          <div className="energy-efficiency-overview-kpis">
            <article className={`energy-efficiency-overview-kpi tone-${efficiencyTone}`}>
              <span>月平均 COP</span>
              <strong>{formatCop(averageRatio)}</strong>
              <small>{`累计折算 COP ${formatCop(monthCoolingPowerRatio)}`}</small>
            </article>
            <article className="energy-efficiency-overview-kpi tone-neutral">
              <span>累计电耗</span>
              <strong className="energy-efficiency-overview-kpi-value">
                <b>{isCalendarNumber(completedPower) ? formatNumber(completedPower, 0) : "--"}</b>
                {isCalendarNumber(completedPower) ? <em>kWh</em> : null}
              </strong>
              <small>冷站全口径</small>
            </article>
            <article className="energy-efficiency-overview-kpi tone-good">
              <span>累计制冷量</span>
              <strong className="energy-efficiency-overview-kpi-value">
                <b>{isCalendarNumber(completedCooling) ? formatNumber(completedCooling, 0) : "--"}</b>
                {isCalendarNumber(completedCooling) ? <em>kWh</em> : null}
              </strong>
              <small>制冷量全口径</small>
            </article>
            <article className="energy-efficiency-overview-kpi tone-warn">
              <span>{chillerShareScopeLabel}</span>
              <strong>{chillerShare == null ? "--" : `${formatNumber(chillerShare, 1)}%`}</strong>
              <small>{chillerShareScopeHint}</small>
            </article>
            <article className={`energy-efficiency-overview-kpi tone-${scopeAuditTone}`}>
              <span>口径校核</span>
              <strong>{scopeAuditStatusLabel}</strong>
              <small>{scopeAuditHint}</small>
            </article>
          </div>

          <div className="energy-efficiency-overview-main">
            <section className="energy-efficiency-overview-card energy-efficiency-overview-calendar-card">
              <header className="energy-efficiency-overview-card-head">
                <div>
                  <h3>月度能效日历</h3>
                  <p>{calendarSelectionStatus}</p>
                </div>
                <div className="energy-efficiency-calendar-query" aria-label="月能效日历查询">
                  <label className="energy-efficiency-calendar-month-field">
                    <span>月能效日历查询</span>
                    <input
                      ref={calendarMonthInputRef}
                      type="month"
                      value={calendarFilters.month}
                      onClick={openCalendarMonthPicker}
                      onChange={(event) => {
                        const nextMonth = event.target.value || calendarFilters.month;
                        setCalendarFilters((current) => ({ ...current, month: nextMonth }));
                        setCalendarError(null);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="energy-efficiency-calendar-query-button"
                    onClick={() => {
                      const queryMonth = calendarMonthInputRef.current?.value || calendarFilters.month;
                      if (!queryMonth) {
                        return;
                      }
                      setCalendarFilters((current) => ({ ...current, month: queryMonth, mode: "month" }));
                      setCalendarQuery({ month: queryMonth });
                      setCalendarPieQuery({ date: queryMonth, dateType: "2" });
                      setCalendarError(null);
                    }}
                  >
                    查询
                  </button>
                  <span>{calendarQueryStatusLabel}</span>
                </div>
              </header>
              <div className="energy-efficiency-overview-calendar-body">
                <div
                  className="energy-efficiency-overview-calendar-grid"
                  style={{ "--calendar-week-row-count": calendarWeekRowCount } as CSSProperties}
                >
                  {CALENDAR_WEEKDAY_LABELS.map((label) => (
                    <span key={`overview-week-${label}`} className="energy-efficiency-overview-weekday">{label}</span>
                  ))}
                  {Array.from({ length: firstDayOffset }, (_unused, index) => (
                    <span key={`overview-spacer-${index + 1}`} className="energy-efficiency-overview-day is-spacer" />
                  ))}
                  {calendarEntries.map((item) => {
                    const quality = getCalendarQuality(item);
                    const ratio = calculateCalendarCoolingPowerRatio(item);
                    const hasDayData = quality.tone !== "future" && quality.tone !== "missing";
                    const displayRatio = hasDayData ? ratio : null;
                    const displayPower = hasDayData ? item.power : null;
                    const displayCooling = hasDayData ? item.cooling : null;
                    const title = `${item.date || "--"} / 能效 ${formatCop(displayRatio)} / 电量 ${formatNumber(displayPower, 1)} / 冷量 ${formatNumber(displayCooling, 1)}`;
                    return (
                      <button
                        key={`overview-day-${item.date || item.id}`}
                        type="button"
                        className={[
                          "energy-efficiency-overview-day",
                          `quality-${quality.tone}`,
                          item.date === calendarFilters.selectedDate ? "is-selected" : "",
                          item.date === partialToday?.date ? "is-partial" : ""
                        ].filter(Boolean).join(" ")}
                        title={title}
                        onClick={() => {
                          if (!item.date) {
                            return;
                          }
                          setCalendarFilters((current) => ({ ...current, selectedDate: item.date || current.selectedDate, mode: "day" }));
                          setCalendarError(null);
                        }}
                      >
                        <header className="energy-efficiency-overview-day-head">
                          <strong>{item.day || "--"}</strong>
                          <span>{item.date === partialToday?.date ? "当日" : getCalendarQualityShortLabel(quality.tone)}</span>
                        </header>
                        <div className="energy-efficiency-overview-day-metrics">
                          <div className="is-cop">
                            <span>能效</span>
                            <strong>{formatCop(displayRatio)}</strong>
                          </div>
                          <div>
                            <span>电量</span>
                            <strong>{formatNumber(displayPower, 1)}</strong>
                          </div>
                          <div>
                            <span>冷量</span>
                            <strong>{formatNumber(displayCooling, 1)}</strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="energy-efficiency-overview-calendar-stats">
                  <div>
                    <span>最佳日</span>
                    <strong>{bestCalendarItem?.date ? `${bestCalendarItem.date.slice(5)} · ${formatCop(calculateCalendarCoolingPowerRatio(bestCalendarItem))}` : "--"}</strong>
                  </div>
                  <div>
                    <span>低值日</span>
                    <strong>{lowCalendarItem?.date ? `${lowCalendarItem.date.slice(5)} · ${formatCop(calculateCalendarCoolingPowerRatio(lowCalendarItem))}` : "--"}</strong>
                  </div>
                  <div>
                    <span>月平均 COP</span>
                    <strong>{isCalendarNumber(averageRatio) ? `${formatCop(averageRatio)} COP` : "--"}</strong>
                  </div>
                  <div>
                    <span>{overviewPieIsMonthScope ? "月度状态" : "当前选择"}</span>
                    <strong>{overviewPieIsMonthScope ? calendarMonthStatusLabel : `${(overviewPieScopeDate || "--").slice(5)} · 日口径`}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="energy-efficiency-overview-card energy-efficiency-overview-pie-card">
              <header className="energy-efficiency-overview-card-head">
                <div>
                  <h3>分项耗电构成</h3>
                  <p>{overviewPieScopeKindLabel}</p>
                </div>
                <span>{overviewPieCopLabel}</span>
              </header>
              <div className="energy-efficiency-overview-donut-body">
                <div className="energy-efficiency-overview-donut-field">
                  <div className="energy-efficiency-overview-donut-map">
                    {overviewPieCallouts.length > 0 ? (
                      <svg
                        className="energy-efficiency-overview-donut-leaders"
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                      >
                        {overviewPieCallouts.map((item) => (
                          <g key={`overview-pie-line-${item.item.id || item.index + 1}`}>
                            <polyline
                              points={item.leaderPoints}
                              style={{ stroke: item.color }}
                            />
                            <circle
                              cx={item.anchorX}
                              cy={item.anchorY}
                              r="1.25"
                              style={{ fill: item.color }}
                            />
                          </g>
                        ))}
                      </svg>
                    ) : null}
                  <div className="energy-efficiency-overview-donut" style={{ backgroundImage: overviewDonutBackground }}>
                    <div>
                      <span>{overviewDonutScopeLabel}</span>
                      <strong>{isCalendarNumber(overviewDonutTotal) ? formatNumber(overviewDonutTotal, 0) : "--"}</strong>
                      {isCalendarNumber(overviewDonutTotal) ? <small>kWh</small> : null}
                    </div>
                  </div>
                  {overviewPieCallouts.map((item, index) => {
                    return (
                      <div
                        key={`overview-pie-${item.item.id || index + 1}`}
                        className={`energy-efficiency-overview-donut-callout position-${index + 1} align-${item.layout.align}`}
                        style={{
                          "--callout-color": item.color,
                          "--label-x": `${item.layout.labelX}%`,
                          "--label-y": `${item.layout.labelY}%`
                        } as CSSProperties}
                      >
                        <span>{item.item.name || zhCN.common.unknown}</span>
                        <strong>{`${formatNumber(item.item.value, 0)} kWh`}</strong>
                        <small>{`${formatNumber(item.ratio, 1)}%`}</small>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </section>

          </div>

          <div className="energy-efficiency-overview-bottom">
            <section className="energy-efficiency-overview-card">
              <header className="energy-efficiency-overview-card-head">
                <div>
                  <h3>{`${trendWindowLabel} COP 趋势`}</h3>
                  <p>展示最近有效日</p>
                </div>
                <span>{trendBadgeLabel}</span>
              </header>
              <div className="energy-efficiency-overview-trend">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="2" y1="72" x2="98" y2="72" className="energy-efficiency-overview-threshold" />
                  {trendSvgPoints ? (
                    <>
                      <polyline points={trendSvgPoints} className="energy-efficiency-overview-trend-shadow" />
                      <polyline points={trendSvgPoints} className="energy-efficiency-overview-trend-line" />
                    </>
                  ) : null}
                </svg>
                <div className="energy-efficiency-overview-trend-axis">
                  {trendPoints.map((item) => (
                    <span key={`trend-axis-${item.key}`} className={item.isPartial ? "is-partial" : ""}>{item.label}</span>
                  ))}
                </div>
              </div>
              <div className="energy-efficiency-overview-trend-stats">
                <span>{`均值 ${formatCop(averageRatio)}`}</span>
                <span>达标线 6.50</span>
                <span>{`最高 ${formatCop(calculateCalendarCoolingPowerRatio(bestCalendarItem))}`}</span>
                <span>{`最低 ${formatCop(calculateCalendarCoolingPowerRatio(lowCalendarItem))}`}</span>
              </div>
            </section>

            <section className="energy-efficiency-overview-card">
              <header className="energy-efficiency-overview-card-head">
                <div>
                  <h3>负荷比重</h3>
                  <p>10个负荷段与站房能效同步查看</p>
                </div>
                <span>{dominantLoadBandBadge}</span>
              </header>
              <div className="energy-efficiency-overview-load-list">
                {loadBandRows.length > 0 ? loadBandRows.map((row) => {
                  const width = maxLoadRatio > 0 ? ((row.loadRatioPct || 0) / maxLoadRatio) * 100 : 0;
                  return (
                    <div key={`overview-load-${row.rangeLabel}`} className="energy-efficiency-overview-load-row">
                      <span>{row.rangeLabel}</span>
                      <i><b style={{ width: `${width}%` }} /></i>
                      <small>{`${formatNumber(row.loadRatioPct, 1)}%`}</small>
                      <em>{formatCop(row.stationEfficiency)}</em>
                    </div>
                  );
                }) : <p className="empty-hint">负荷比重数据待加载。</p>}
              </div>
            </section>

            <section className="energy-efficiency-overview-card">
              <header className="energy-efficiency-overview-card-head">
                <div>
                  <h3>运行校核</h3>
                  <p>来源、门禁、负荷、热平衡</p>
                </div>
                <span>{gateLabel}</span>
              </header>
              <div className="energy-efficiency-overview-modules">
                <div className={sourceSummary.warn ? "tone-warn" : "tone-good"}>
                  <span>数据状态</span>
                  <strong>{displaySourceStateLabel}</strong>
                  <small>{statusDigestLines[0] || displayBannerText}</small>
                </div>
                <div className={`tone-${gateTone}`}>
                  <span>AI门禁</span>
                  <strong>{gateLabel}</strong>
                  <small>先校验来源</small>
                </div>
                <div>
                  <span>主负荷段</span>
                  <strong>{dominantLoadBand?.rangeLabel || "--"}</strong>
                  <small>{dominantLoadBand ? `${formatNumber(dominantLoadBand.loadRatioPct, 1)}%占比` : "待数据"}</small>
                </div>
                <div className={`tone-${thermalOverview.stateTone}`}>
                  <span>热平衡</span>
                  <strong>{thermalOverview.stateLabel}</strong>
                  <small>{`达标带 ±5% · 达标率 ${formatNumber(thermalOverview.complianceRate, 1)}%`}</small>
                </div>
              </div>
            </section>
          </div>
        </section>

        {!calendarLoading && calendarEntries.length === 0 ? <p className="empty-hint">{zhCN.energyEfficiencyPage.calendarEmpty}</p> : null}
      </>
    );
  }

  function renderSearchTab() {
    const timeSpaceOptions = [
      { value: "1", label: zhCN.energyEfficiencyPage.timeSpaceHour },
      { value: "2", label: zhCN.energyEfficiencyPage.timeSpaceDay },
      { value: "3", label: zhCN.energyEfficiencyPage.timeSpaceMonth }
    ];
    const selectedTimeSpaceLabel = getTimeSpaceLabel(searchFilters.timeSpace);
    const searchChartQuery = searchQuery || searchFilters;
    return (
      <>
        <div className="energy-efficiency-search-filter-layer">
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters} action={<span className="energy-efficiency-section-tip">{currentModeGuide.filtersHint}</span>}>
          <div className="energy-efficiency-filter-grid search-grid">
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDevices}</span>
              <div className="energy-efficiency-device-check-grid" role="group" aria-label={zhCN.energyEfficiencyPage.filterDevices}>
                {deviceOptions.map((item) => (
                  <label
                    key={item.value}
                    className={`energy-efficiency-device-check${searchFilters.deviceKeys.includes(item.value) ? " is-checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={searchFilters.deviceKeys.includes(item.value)}
                      onChange={(event) => {
                        setSearchFilters((current) => {
                          const nextSet = new Set(current.deviceKeys);
                          if (event.target.checked) {
                            nextSet.add(item.value);
                          } else {
                            nextSet.delete(item.value);
                          }
                          return {
                            ...current,
                            deviceKeys: deviceOptions
                              .filter((option) => nextSet.has(option.value))
                              .map((option) => option.value)
                          };
                        });
                        setSearchError(null);
                      }}
                    />
                    <em>{item.label}</em>
                  </label>
                ))}
              </div>
            </label>
            <label className="energy-efficiency-field energy-efficiency-date-field">
              <span>{zhCN.energyEfficiencyPage.filterStartDate}</span>
              <input
                ref={searchStartDateInputRef}
                type="date"
                value={searchFilters.startDate}
                onClick={() => {
                  openSearchStartDatePicker();
                }}
                onChange={(event) => {
                  setSearchFilters((current) => ({ ...current, startDate: event.target.value }));
                  setSearchError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field energy-efficiency-date-field">
              <span>{zhCN.energyEfficiencyPage.filterEndDate}</span>
              <input
                ref={searchEndDateInputRef}
                type="date"
                value={searchFilters.endDate}
                onClick={() => {
                  openSearchEndDatePicker();
                }}
                onChange={(event) => {
                  setSearchFilters((current) => ({ ...current, endDate: event.target.value }));
                  setSearchError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterTimeSpace}</span>
              <div
                className={`energy-analysis-select${isSearchTimeSpaceDropdownOpen ? " is-open" : ""}`}
                ref={searchTimeSpaceDropdownRef}
              >
                <button
                  type="button"
                  className={`energy-analysis-select-trigger${isSearchTimeSpaceDropdownOpen ? " is-open" : ""}`}
                  onClick={() => setIsSearchTimeSpaceDropdownOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={isSearchTimeSpaceDropdownOpen}
                  aria-controls="energy-efficiency-search-timespace-listbox"
                >
                  <span className="energy-analysis-select-trigger-text">{selectedTimeSpaceLabel}</span>
                  <ChevronDown className="energy-analysis-select-caret" size={14} aria-hidden="true" />
                </button>
                {isSearchTimeSpaceDropdownOpen ? (
                  <div
                    id="energy-efficiency-search-timespace-listbox"
                    className="energy-analysis-select-menu"
                    role="listbox"
                    aria-label={zhCN.energyEfficiencyPage.filterTimeSpace}
                  >
                    {timeSpaceOptions.map((item) => {
                      const isActive = item.value === searchFilters.timeSpace;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`energy-analysis-select-option${isActive ? " is-active" : ""}`}
                          onClick={() => {
                            setSearchFilters((current) => ({ ...current, timeSpace: item.value }));
                            setSearchError(null);
                            setIsSearchTimeSpaceDropdownOpen(false);
                          }}
                        >
                          <span className="energy-analysis-select-option-label">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </label>
            <div className="energy-efficiency-actions energy-efficiency-search-inline-actions">
              <button
                type="button"
                className="energy-efficiency-button is-primary"
                onClick={() => {
                  setIsSearchTimeSpaceDropdownOpen(false);
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
                  setIsSearchTimeSpaceDropdownOpen(false);
                  const next = buildSearchDefaults();
                  setSearchFilters(next);
                  setSearchQuery(next);
                  setSearchError(null);
                }}
              >
                {zhCN.energyEfficiencyPage.reset}
              </button>
            </div>
          </div>
        </SectionCard>
        </div>

        <SectionCard
          title="冷站 COP 趋势"
          action={
            <>
              <span className="energy-efficiency-section-tip">{currentModeGuide.chartHint}</span>
              <button type="button" className="energy-efficiency-button" onClick={exportSearchCsv}>
                {zhCN.energyEfficiencyPage.export}
              </button>
            </>
          }
        >
          <EnergyEfficiencySeriesChart
            data={searchData}
            loadError={searchError}
            metaItems={[
              {
                label: zhCN.energyEfficiencyPage.rangeLatestFetch,
                value: formatDateTime(searchData?.generatedAt || searchData?.freshness?.latestTimestamp)
              },
              {
                label: zhCN.energyEfficiencyPage.rangeSelectionLabel,
                value: `${formatCount(searchChartQuery.deviceKeys.length)}${zhCN.energyEfficiencyPage.unitDevices}`
              }
            ]}
          />
        </SectionCard>

        <SectionCard title="COP 统计明细" action={<span className="energy-efficiency-section-tip">{currentModeGuide.tableHint}</span>}>
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
                      <td>{formatDisplayValue(row.wholeValue)}</td>
                      <td>{formatDisplayValue(row.averageValue)}</td>
                      <td>{formatDisplayValue(row.tenPercentGoodAverageValue)}</td>
                      <td>{formatDisplayValue(row.tenPercentBadAverageValue)}</td>
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
    const compareChartQuery = compareQuery || compareFilters;
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters} action={<span className="energy-efficiency-section-tip">{currentModeGuide.filtersHint}</span>}>
          <div className="energy-efficiency-filter-grid compare-grid">
            <div className="energy-efficiency-field">
              <span>{zhCN.energyEfficiencyPage.filterDevice}</span>
              <div className="energy-efficiency-device-check-grid energy-efficiency-device-check-grid-single" role="radiogroup" aria-label={zhCN.energyEfficiencyPage.filterDevice}>
                {deviceOptions.map((item) => (
                  <label
                    key={item.value}
                    className={`energy-efficiency-device-check${compareFilters.deviceKey === item.value ? " is-checked" : ""}`}
                  >
                    <input
                      type="radio"
                      name="energy-efficiency-compare-device"
                      value={item.value}
                      checked={compareFilters.deviceKey === item.value}
                      onChange={(event) => {
                        if (!event.target.checked) {
                          return;
                        }
                        setCompareFilters((current) => ({ ...current, deviceKey: item.value }));
                        setCompareError(null);
                      }}
                    />
                    <em>{item.label}</em>
                  </label>
                ))}
              </div>
            </div>
            <label className="energy-efficiency-field energy-efficiency-date-field">
              <span>{zhCN.energyEfficiencyPage.filterCompareDate}</span>
              <input
                ref={compareDateInputRef}
                type="date"
                value={compareFilters.dateDraft}
                onClick={openCompareDatePicker}
                onChange={(event) => {
                  const date = event.target.value;
                  setCompareFilters((current) => ({
                    ...current,
                    dateDraft: date,
                    dates: date && !current.dates.includes(date)
                      ? [...current.dates, date].sort()
                      : current.dates
                  }));
                  setCompareError(null);
                }}
              />
            </label>
            <div className="energy-efficiency-field energy-efficiency-field-stacked energy-efficiency-compare-selection-field">
              <div className="energy-efficiency-compare-selection-label">
                <span>{zhCN.energyEfficiencyPage.compareSelectedDates}</span>
                <em>点击下方已选日期可取消</em>
              </div>
              <div className="energy-efficiency-compare-selection">
              <div className="energy-efficiency-chip-list-head">
                  <strong>{`${formatCount(compareFilters.dates.length)}${zhCN.energyEfficiencyPage.unitDates}`}</strong>
                </div>
                <div className="energy-efficiency-chip-list energy-efficiency-chip-list-compact">
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
              </div>
            </div>
            <div className="energy-efficiency-actions energy-efficiency-search-inline-actions energy-efficiency-compare-inline-actions">
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
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="COP 对比趋势"
          action={
            <>
              <span className="energy-efficiency-section-tip">{currentModeGuide.chartHint}</span>
              <button type="button" className="energy-efficiency-button" onClick={exportCompareCsv}>
                {zhCN.energyEfficiencyPage.export}
              </button>
            </>
          }
        >
          <EnergyEfficiencySeriesChart
            data={compareData}
            loadError={compareError}
            metaItems={[
              {
                label: zhCN.energyEfficiencyPage.rangeLatestFetch,
                value: formatDateTime(compareData?.generatedAt || compareData?.freshness?.latestTimestamp)
              },
              {
                label: zhCN.energyEfficiencyPage.rangeSelectionLabel,
                value: `${formatCount(compareChartQuery.dates.length)}${zhCN.energyEfficiencyPage.unitDates}`
              }
            ]}
          />
        </SectionCard>

        <SectionCard title="对比统计明细" action={<span className="energy-efficiency-section-tip">{currentModeGuide.tableHint}</span>}>
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
                      <td>{formatDisplayValue(row.wholeValue)}</td>
                      <td>{formatDisplayValue(row.averageValue)}</td>
                      <td>{formatDisplayValue(row.tenPercentGoodAverageValue)}</td>
                      <td>{formatDisplayValue(row.tenPercentBadAverageValue)}</td>
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
    const proportionTableRows = proportionData ? buildCompleteLoadBandRows(proportionData.rows || []) : [];
    return (
      <>
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters} action={<span className="energy-efficiency-section-tip">{currentModeGuide.filtersHint}</span>}>
          <div className="energy-efficiency-filter-grid proportion-grid">
            <div className="energy-efficiency-field energy-efficiency-proportion-date-type-field">
              <span>{zhCN.energyEfficiencyPage.filterDateType}</span>
              <div className="energy-efficiency-device-check-grid energy-efficiency-device-check-grid-single energy-efficiency-proportion-date-type-options" role="radiogroup" aria-label={zhCN.energyEfficiencyPage.filterDateType}>
                {[
                  { value: "2" as const, label: zhCN.energyEfficiencyPage.proportionMonth },
                  { value: "3" as const, label: zhCN.energyEfficiencyPage.proportionYear }
                ].map((item) => (
                  <label
                    key={item.value}
                    className={`energy-efficiency-device-check${proportionFilters.dateType === item.value ? " is-checked" : ""}`}
                  >
                    <input
                      type="radio"
                      name="energy-efficiency-proportion-date-type"
                      value={item.value}
                      checked={proportionFilters.dateType === item.value}
                      onChange={() => {
                        setProportionFilters({
                          dateType: item.value,
                          date: item.value === "3" ? String(new Date().getFullYear()) : formatMonthInput(new Date())
                        });
                        setProportionError(null);
                      }}
                    />
                    <em>{item.label}</em>
                  </label>
                ))}
              </div>
            </div>
            <label className="energy-efficiency-field energy-efficiency-date-field" onClick={openProportionDatePicker}>
              <span>{zhCN.energyEfficiencyPage.filterDate}</span>
              {proportionFilters.dateType === "2" ? (
                <input
                  ref={proportionDateInputRef}
                  type="month"
                  value={proportionFilters.date}
                  onClick={openProportionDatePicker}
                  onChange={(event) => {
                    setProportionFilters((current) => ({ ...current, date: event.target.value }));
                    setProportionError(null);
                  }}
                />
              ) : (
                <input
                  ref={proportionDateInputRef}
                  type="number"
                  min="2000"
                  max="2100"
                  value={proportionFilters.date}
                  onClick={openProportionDatePicker}
                  onChange={(event) => {
                    setProportionFilters((current) => ({ ...current, date: event.target.value }));
                    setProportionError(null);
                  }}
                />
              )}
            </label>
            <button
              type="button"
              className="energy-efficiency-button is-primary energy-efficiency-proportion-action-button"
              onClick={() => {
                if (!proportionFilters.date) {
                  setProportionError(zhCN.energyEfficiencyPage.proportionDateRequired);
                  return;
                }
                setProportionQuery({ ...proportionFilters });
                setProportionError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.search}
            </button>
            <button
              type="button"
              className="energy-efficiency-button energy-efficiency-proportion-action-button"
              onClick={() => {
                const next = buildProportionDefaults();
                setProportionFilters(next);
                setProportionQuery({ ...next });
                setProportionError(null);
              }}
            >
              {zhCN.energyEfficiencyPage.reset}
            </button>
            <div className="energy-efficiency-summary-grid energy-efficiency-proportion-summary-grid energy-efficiency-proportion-inline-summary">
              {summaryCards.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} className={`is-dense summary-strip-card${card.className ? ` ${card.className}` : ""}`} />
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={zhCN.energyEfficiencyPage.proportionChartTitle}
          action={
            <>
              <span className="energy-efficiency-section-tip">{currentModeGuide.chartHint}</span>
              <button type="button" className="energy-efficiency-button" onClick={exportProportionCsv}>
                {zhCN.energyEfficiencyPage.export}
              </button>
            </>
          }
        >
          <EnergyEfficiencyProportionChart
            data={proportionData}
            loadError={proportionError}
            metaItems={[
              {
                label: "\u67f1\u72b6",
                value: "\u8d1f\u8377\u6bd4\u4f8b"
              },
              {
                label: "\u6298\u7ebf",
                value: "\u51b7\u7ad9COP"
              },
              {
                label: zhCN.energyEfficiencyPage.rangeLatestFetch,
                value: formatDateTime(proportionData?.generatedAt || proportionData?.freshness?.latestTimestamp)
              },
              {
                label: zhCN.energyEfficiencyPage.proportionSelectedPrefix,
                value: proportionFilters.date || "--"
              }
            ]}
          />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.sectionTable} action={<span className="energy-efficiency-section-tip">{currentModeGuide.tableHint}</span>}>
          <div className="table-scroll-shell">
            <table className="data-table energy-efficiency-proportion-table">
              <colgroup>
                <col className="energy-efficiency-proportion-table-range-col" />
                <col className="energy-efficiency-proportion-table-ratio-col" />
                <col className="energy-efficiency-proportion-table-efficiency-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>{zhCN.energyEfficiencyPage.proportionTableRange}</th>
                  <th>{zhCN.energyEfficiencyPage.proportionTableRatio}</th>
                  <th>{zhCN.energyEfficiencyPage.proportionTableEfficiency}</th>
                </tr>
              </thead>
              <tbody>
                {proportionTableRows.length > 0 ? (
                  proportionTableRows.map((row) => {
                    const efficiencyToneClass = getStationEfficiencyToneClass(row.stationEfficiency);
                    const loadRatioToneClass = getLoadRatioToneClass(row.loadRatioPct);
                    return (
                      <tr key={row.id || row.rangeLabel}>
                        <td>{row.rangeLabel || "--"}</td>
                        <td className={`energy-efficiency-proportion-table-value ${loadRatioToneClass}`}>
                          {`${formatNumber(row.loadRatioPct, 1)}%`}
                        </td>
                        <td className={`energy-efficiency-proportion-table-value ${efficiencyToneClass}`}>
                          {formatCop(row.stationEfficiency)}
                        </td>
                      </tr>
                    );
                  })
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
        <SectionCard title={zhCN.energyEfficiencyPage.sectionFilters} action={<span className="energy-efficiency-section-tip">{currentModeGuide.filtersHint}</span>}>
          <div className="energy-efficiency-filter-grid imbalance-grid">
            <label className="energy-efficiency-field energy-efficiency-date-field" onClick={openImbalanceStartDatePicker}>
              <span>{zhCN.energyEfficiencyPage.filterImbalanceStartDate}</span>
              <input
                ref={imbalanceStartDateInputRef}
                type="date"
                value={imbalanceFilters.startDate}
                onClick={openImbalanceStartDatePicker}
                onChange={(event) => {
                  setImbalanceFilters((current) => ({ ...current, startDate: event.target.value }));
                  setImbalanceError(null);
                }}
              />
            </label>
            <label className="energy-efficiency-field energy-efficiency-date-field" onClick={openImbalanceEndDatePicker}>
              <span>{zhCN.energyEfficiencyPage.filterImbalanceEndDate}</span>
              <input
                ref={imbalanceEndDateInputRef}
                type="date"
                value={imbalanceFilters.endDate}
                onClick={openImbalanceEndDatePicker}
                onChange={(event) => {
                  setImbalanceFilters((current) => ({ ...current, endDate: event.target.value }));
                  setImbalanceError(null);
                }}
              />
            </label>
            <div className="energy-efficiency-imbalance-actions">
              <button
                type="button"
                className="energy-efficiency-button is-primary energy-efficiency-imbalance-action-button"
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
                className="energy-efficiency-button energy-efficiency-imbalance-action-button"
                onClick={() => {
                  const next = buildImbalanceDefaults();
                  setImbalanceFilters(next);
                  setImbalanceQuery(next);
                  setImbalanceError(null);
                }}
              >
                {zhCN.energyEfficiencyPage.reset}
              </button>
            </div>
            <div className="energy-efficiency-summary-grid energy-efficiency-imbalance-inline-summary">
              {summaryCards.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} unit={card.unit} delta={card.delta} tone={card.tone} className={`is-dense summary-strip-card${card.className ? ` ${card.className}` : ""}`} />
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={zhCN.energyEfficiencyPage.imbalanceChartTitle}
          action={
            <>
              <span className="energy-efficiency-section-tip">{currentModeGuide.chartHint}</span>
              <button type="button" className="energy-efficiency-button" onClick={exportImbalanceCsv}>
                {zhCN.energyEfficiencyPage.export}
              </button>
            </>
          }
        >
          <EnergyEfficiencyImbalanceChart
            data={imbalanceData}
            loadError={imbalanceError}
            metaItems={[
              {
                label: zhCN.energyEfficiencyPage.rangeLatestFetch,
                value: formatDateTime(imbalanceData?.generatedAt || imbalanceData?.freshness?.latestTimestamp)
              },
              {
                label: zhCN.energyEfficiencyPage.rangeSelectionLabel,
                value: `${imbalanceFilters.startDate} ~ ${imbalanceFilters.endDate}`
              }
            ]}
          />
        </SectionCard>

        <SectionCard title={zhCN.energyEfficiencyPage.imbalanceStatisticsTitle} action={<span className="energy-efficiency-section-tip">{currentModeGuide.tableHint}</span>}>
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
                      <td>
                        <span className={`energy-efficiency-imbalance-value ${getImbalancePassCountToneClass(row.scalar)}`}>
                          {formatNumber(row.scalar, 2)}
                        </span>
                      </td>
                      <td>
                        <span className={`energy-efficiency-imbalance-value ${getImbalanceFailCountToneClass(row.noScalar)}`}>
                          {formatNumber(row.noScalar, 2)}
                        </span>
                      </td>
                      <td>
                        {`${formatNumber(row.scalarRate, 2)}%`}
                      </td>
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

      </>
    );
  }

  return (
    <div className="energy-efficiency-page page-enter" data-tab={activeTab}>
      <section className="energy-efficiency-header subpage-command-board">
        <div className="subpage-command-copy energy-efficiency-command-copy">
          <p className="energy-efficiency-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h2>{zhCN.energyEfficiencyPage.heading}</h2>
          <p>{digestSummaryText || zhCN.energyEfficiencyPage.subtitle}</p>
          <div className="energy-efficiency-command-tags" aria-label={zhCN.energyEfficiencyPage.sectionFilters}>
            {commandTagsWithDigest.map((item) => (
              <span key={`${item.label}-${item.value}`}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
          <div className="energy-efficiency-tabs" aria-label={zhCN.energyEfficiencyPage.heading}>
            {ENERGY_EFFICIENCY_TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeTab === item.key ? "is-active" : ""}
                aria-pressed={activeTab === item.key}
                onClick={() => switchTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="energy-efficiency-command-summary-grid">
            {commandStats.map((item) => (
              <article key={`${item.title}-${item.value}`} className="energy-efficiency-command-stat">
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="energy-efficiency-header-status subpage-command-side">
          <span className="energy-efficiency-command-side-label">{zhCN.energyEfficiencyPage.summaryState}</span>
          <strong>{displaySourceStateLabel}</strong>
          <p>{displayBannerText}</p>
          {statusDigestLines.length > 0 ? (
            <div className="energy-efficiency-status-list" aria-label={zhCN.energyEfficiencyPage.summaryState}>
              {statusDigestLines.map((line, index) => (
                <span key={`energy-efficiency-status-${index + 1}-${line}`} className="energy-efficiency-status-chip">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      {activeTab === "calendar" ? renderCalendarTab() : null}
      {activeTab === "search" ? renderSearchTab() : null}
      {activeTab === "compare" ? renderCompareTab() : null}
      {activeTab === "proportion" ? renderProportionTab() : null}
      {activeTab === "imbalance" ? renderImbalanceTab() : null}
    </div>
  );
}

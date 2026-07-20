import { startTransition, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import "./ColdStationLogExtracted.css";
import SectionCard from "../components/common/SectionCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type ColdStationLogDto,
  type ColdStationLogItemDto,
  type SourceEndpointStatusDto,
  fetchColdStationLogs
} from "../services/bffClient";

type SummaryMetricCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type LogColumn = {
  key: keyof ColdStationLogItemDto | "time" | "systemCop" | "hostCop";
  label: string;
  unit?: string;
  digits?: number;
  getValue?: (item: ColdStationLogItemDto) => number | null | undefined;
  emphasized?: boolean;
};

const COLD_LOG_NOT_RETURNED_LABEL = "--";
const COLD_LOG_COP_FACTOR = 3.517;
const COLD_LOG_COP_TARGET = 6.7;

const LOG_COLUMNS: LogColumn[] = [
  { key: "time", label: zhCN.coldStationLogPage.tableTime },
  { key: "systemCoolingCapacity", label: zhCN.coldStationLogPage.tableSystemCoolingCapacity, unit: "RT*h", digits: 1 },
  { key: "systemPower", label: zhCN.coldStationLogPage.tableSystemPower, unit: "kWh", digits: 1 },
  { key: "systemCop", label: "系统COP", unit: "COP", digits: 2, getValue: getSystemCopFromItem, emphasized: true },
  { key: "hostPower", label: zhCN.coldStationLogPage.tableHostPower, unit: "kWh", digits: 1 },
  { key: "hostCop", label: "主机COP", unit: "COP", digits: 2, getValue: getHostCopFromItem },
  { key: "refrigeratingPumpPower", label: zhCN.coldStationLogPage.tableChilledPumpPower, unit: "kWh", digits: 1 },
  { key: "coolingPumpPower", label: zhCN.coldStationLogPage.tableCoolingPumpPower, unit: "kWh", digits: 1 },
  { key: "coolingTowerPower", label: zhCN.coldStationLogPage.tableCoolingTowerPower, unit: "kWh", digits: 1 },
  {
    key: "refrigerationPumpConveyingCoefficient",
    label: zhCN.coldStationLogPage.tableChilledPumpCoefficient,
    digits: 2
  },
  { key: "coolingPumpConveyingCoefficient", label: zhCN.coldStationLogPage.tableCoolingPumpCoefficient, digits: 2 },
  { key: "coolingTowerConveyingCoefficient", label: zhCN.coldStationLogPage.tableCoolingTowerCoefficient, digits: 2 },
  { key: "chilledWaterInputTemperature", label: zhCN.coldStationLogPage.tableChilledWaterIn, unit: "°C", digits: 1 },
  { key: "chilledWaterOutputTemperature", label: zhCN.coldStationLogPage.tableChilledWaterOut, unit: "°C", digits: 1 },
  { key: "coolingWaterInputTemperature", label: zhCN.coldStationLogPage.tableCoolingWaterIn, unit: "°C", digits: 1 },
  { key: "coolingWaterOutputTemperature", label: zhCN.coldStationLogPage.tableCoolingWaterOut, unit: "°C", digits: 1 }
];

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function shouldGroupColdLogUnit(unit?: string): boolean {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  return ["kwh", "rt*h", "rt"].includes(normalizedUnit);
}

function isValidNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function computeCopFromCoolingAndPower(
  coolingCapacity: number | null | undefined,
  power: number | null | undefined
): number | null {
  if (!isValidNumber(coolingCapacity) || !isValidNumber(power) || power <= 0) {
    return null;
  }
  return (coolingCapacity * COLD_LOG_COP_FACTOR) / power;
}

function convertKwPerRtToCop(value: number | null | undefined): number | null {
  if (!isValidNumber(value) || value <= 0) {
    return null;
  }
  return COLD_LOG_COP_FACTOR / value;
}

function getSystemCopFromItem(item: ColdStationLogItemDto): number | null {
  return (
    computeCopFromCoolingAndPower(item.systemCoolingCapacity, item.systemPower) ??
    convertKwPerRtToCop(item.systemEfficiency)
  );
}

function getHostCopFromItem(item: ColdStationLogItemDto): number | null {
  return convertKwPerRtToCop(item.hostEfficiency);
}

function getSystemCopFromData(data: ColdStationLogDto | null): number | null {
  const summary = data?.summary;
  return (
    computeCopFromCoolingAndPower(summary?.outputCoolingCapacity, summary?.inputPower) ??
    convertKwPerRtToCop(summary?.systemEfficiency)
  );
}

function formatPercent(part: number | null | undefined, total: number | null | undefined): string {
  if (!isValidNumber(part) || !isValidNumber(total) || total <= 0) {
    return COLD_LOG_NOT_RETURNED_LABEL;
  }
  return `${formatNumber((part / total) * 100, 0)}%`;
}

function formatNumber(value: number | null | undefined, digits = 1, useGrouping = false): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return COLD_LOG_NOT_RETURNED_LABEL;
  }
  return new Intl.NumberFormat("zh-CN", {
    useGrouping,
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

function formatCountValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return COLD_LOG_NOT_RETURNED_LABEL;
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(value);
}

function stripDataStatusPrefix(value: string): string {
  return value.replace(/^数据状态[:：]\s*/, "").trim();
}

function isB25HistorySource(source: SourceEndpointStatusDto | null | undefined): boolean {
  const fingerprint = [
    source?.originLabel,
    source?.interfaceKind,
    source?.endpoint,
    source?.message
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return fingerprint.includes("b25") || fingerprint.includes("140btwentyfive") || fingerprint.includes("cloud-reg-history");
}

function getColdLogSourceHealthText(
  loadError: string | null,
  loading: boolean,
  warn: boolean
): string {
  if (loadError) {
    return "来源异常";
  }
  if (loading) {
    return "加载中";
  }
  return warn ? "来源需复核" : "来源正常";
}

function getColdLogSourceCaption(loadError: string | null, loading: boolean): string {
  if (loadError) {
    return "请检查冷站日志来源。";
  }
  if (loading) {
    return "正在拉取逐时记录。";
  }
  return "日累计电耗构成。";
}

function buildColdLogStatusDigestLines(
  data: ColdStationLogDto | null,
  fallbackLines: string[],
  sourceSummaryText: string
): string[] {
  const primarySource = data?.sourceStatus?.sources?.[0];
  const siteId = data?.site?.siteId || runtimeConfig.siteId;
  const stationScope = siteId ? String(siteId) : "";
  const chips: string[] = [];

  if (stationScope) {
    chips.push(`站点${stationScope}`);
  }

  chips.push(stripDataStatusPrefix(sourceSummaryText));

  if (isB25HistorySource(primarySource)) {
    chips.push("B25链路");
  }

  if (typeof primarySource?.rows === "number" && Number.isFinite(primarySource.rows)) {
    chips.push(`记录${formatCountValue(primarySource.rows)}条`);
  }

  const uniqueChips = Array.from(new Set(chips.filter(Boolean))).slice(0, 4);
  return uniqueChips.length > 0 ? uniqueChips : fallbackLines;
}

function formatSummaryMetric(
  value: number | null | undefined,
  unit: string,
  digits = 1
): { value: string; unit: string } {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { value: COLD_LOG_NOT_RETURNED_LABEL, unit: "" };
  }
  return { value: formatNumber(value, digits, shouldGroupColdLogUnit(unit)), unit };
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

function formatTimeOnly(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatLogRowTime(item: ColdStationLogItemDto): string {
  if (item.timestamp) {
    return formatTimeOnly(item.timestamp);
  }
  if (item.time && item.time.trim()) {
    return item.time.trim();
  }
  return zhCN.common.timeUnknown;
}

function formatSummaryCardValue(card: SummaryMetricCard | undefined): string {
  if (!card) {
    return "--";
  }
  return card.unit ? `${card.value} ${card.unit}` : card.value;
}

function buildSummaryCards(data: ColdStationLogDto | null): SummaryMetricCard[] {
  const summary = data?.summary;
  const inputPower = formatSummaryMetric(summary?.inputPower, "kWh", 0);
  const outputCoolingCapacity = formatSummaryMetric(summary?.outputCoolingCapacity, "RT*h", 0);
  const systemHeatDissipation = formatSummaryMetric(summary?.systemHeatDissipation, "RT", 0);
  const systemCopValue = getSystemCopFromData(data);
  const systemCop = formatSummaryMetric(systemCopValue, "COP", 2);
  const hostPower = formatSummaryMetric(summary?.hostPower, "kWh", 0);
  const refrigeratingPumpPower = formatSummaryMetric(summary?.refrigeratingPumpPower, "kWh", 0);
  const coolingPumpPower = formatSummaryMetric(summary?.coolingPumpPower, "kWh", 0);
  const coolingTowerPower = formatSummaryMetric(summary?.coolingTowerPower, "kWh", 0);

  return [
    {
      title: zhCN.coldStationLogPage.summaryInputPower,
      value: inputPower.value,
      unit: inputPower.unit,
      delta: "",
      tone: summary?.inputPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryOutputCoolingCapacity,
      value: outputCoolingCapacity.value,
      unit: outputCoolingCapacity.unit,
      delta: "",
      tone: summary?.outputCoolingCapacity != null ? "good" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryHeatDissipation,
      value: systemHeatDissipation.value,
      unit: systemHeatDissipation.unit,
      delta: "",
      tone: summary?.systemHeatDissipation != null ? "neutral" : "warn"
    },
    {
      title: "系统COP",
      value: systemCop.value,
      unit: systemCop.unit,
      delta: "",
      tone: systemCopValue != null ? "good" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryHostPower,
      value: hostPower.value,
      unit: hostPower.unit,
      delta: "",
      tone: summary?.hostPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryChilledPumpPower,
      value: refrigeratingPumpPower.value,
      unit: refrigeratingPumpPower.unit,
      delta: "",
      tone: summary?.refrigeratingPumpPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryCoolingPumpPower,
      value: coolingPumpPower.value,
      unit: coolingPumpPower.unit,
      delta: "",
      tone: summary?.coolingPumpPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryCoolingTowerPower,
      value: coolingTowerPower.value,
      unit: coolingTowerPower.unit,
      delta: "",
      tone: summary?.coolingTowerPower != null ? "neutral" : "warn"
    }
  ];
}

function getLogColumnValue(column: LogColumn, item: ColdStationLogItemDto): number | null | undefined {
  if (column.getValue) {
    return column.getValue(item);
  }
  if (column.key === "time" || column.key === "systemCop" || column.key === "hostCop") {
    return null;
  }
  return item[column.key] as number | null | undefined;
}

export default function ColdStationLogPage() {
  const today = formatDateInput(new Date());
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const hoveredColumnRef = useRef<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [draftDate, setDraftDate] = useState(today);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [data, setData] = useState<ColdStationLogDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await fetchColdStationLogs(runtimeConfig.siteId, selectedDate);
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
          setLoadError(zhCN.coldStationLogPage.degraded);
          setLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadSeed, selectedDate]);

  const sourceSummary = summarizeSourceStatus([data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([data?.sourceStatus], {
    labelMode: "short"
  });
  const summaryCards = buildSummaryCards(data);
  const items = data?.items || [];
  const summary = data?.summary;
  const systemCopValue = getSystemCopFromData(data);
  const coolingPumpPower = summary?.coolingPumpPower;
  const coolingTowerPower = summary?.coolingTowerPower;
  const copSamples = items
    .map((item) => ({
      item,
      time: formatLogRowTime(item),
      value: getSystemCopFromItem(item)
    }))
    .filter((sample): sample is { item: ColdStationLogItemDto; time: string; value: number } => sample.value != null);
  const lowestCopSample = [...copSamples].sort((left, right) => left.value - right.value)[0];
  const lowestCopValue = lowestCopSample?.value ?? null;
  const coolingSidePower =
    isValidNumber(coolingPumpPower) && isValidNumber(coolingTowerPower)
      ? coolingPumpPower + coolingTowerPower
      : null;
  const energySplitCards = [
    {
      label: "主机电耗",
      value: `${formatNumber(summary?.hostPower, 0, true)} kWh`,
      detail: formatPercent(summary?.hostPower, summary?.inputPower)
    },
    {
      label: "冷冻泵",
      value: `${formatNumber(summary?.refrigeratingPumpPower, 0, true)} kWh`,
      detail: formatPercent(summary?.refrigeratingPumpPower, summary?.inputPower)
    },
    {
      label: "冷却侧",
      value: `${formatNumber(coolingSidePower, 0, true)} kWh`,
      detail: formatPercent(coolingSidePower, summary?.inputPower)
    },
    {
      label: "冷却塔",
      value: `${formatNumber(summary?.coolingTowerPower, 0, true)} kWh`,
      detail: formatPercent(summary?.coolingTowerPower, summary?.inputPower)
    }
  ];
  const latestFetchText = formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp);
  const emptyText = loading
    ? zhCN.coldStationLogPage.readinessLoading
    : loadError
      ? loadError
      : `${selectedDate} 暂无逐小时记录，请切换日期后再看。`;
  const sourceSummaryText = loadError
    ? loadError
    : loading
      ? zhCN.coldStationLogPage.readinessLoading
      : sourceSummary.text;
  const sourceStateLabel = loadError
    ? "异常"
    : loading
      ? "加载中"
      : sourceSummary.warn
        ? "兼容模式"
        : "数据就绪";
  const sourceHealthText = getColdLogSourceHealthText(loadError, loading, sourceSummary.warn);
  const sourceCaptionText = getColdLogSourceCaption(loadError, loading);
  const statusDigestLines = buildColdLogStatusDigestLines(
    data,
    Array.from(new Set(sourceStatusLinesCompact.filter(Boolean))).slice(0, 4),
    sourceSummaryText
  );
  const commandStats = [
    {
      title: summaryCards[0]?.title || zhCN.coldStationLogPage.summaryInputPower,
      value: formatSummaryCardValue(summaryCards[0]),
      detail: `${zhCN.coldStationLogPage.rangeSelectedDate} ${selectedDate}`
    },
    {
      title: summaryCards[1]?.title || zhCN.coldStationLogPage.summaryOutputCoolingCapacity,
      value: formatSummaryCardValue(summaryCards[1]),
      detail: `${zhCN.coldStationLogPage.rangeRowCount} ${formatCountValue(items.length)}${zhCN.common.unitItem}`
    },
    {
      title: "系统COP",
      value: systemCopValue != null ? `${formatNumber(systemCopValue, 2)} COP` : COLD_LOG_NOT_RETURNED_LABEL,
      detail: `COP=供冷量×3.517/总电耗，目标≥${COLD_LOG_COP_TARGET.toFixed(2)}`
    },
    {
      title: "低效时段",
      value: lowestCopSample ? `${lowestCopSample.time} / COP ${formatNumber(lowestCopValue, 2)}` : COLD_LOG_NOT_RETURNED_LABEL,
      detail:
        lowestCopValue != null && lowestCopValue < COLD_LOG_COP_TARGET
          ? "低于目标，建议复核冷却侧与负荷匹配"
          : `来源状态：${sourceStateLabel}`
    }
  ];
  const listStageMeta = [
    `${zhCN.coldStationLogPage.rangeSelectedDate} ${selectedDate}`,
    `${zhCN.coldStationLogPage.rangeRowCount} ${formatCountValue(items.length)}${zhCN.common.unitItem}`,
    `${zhCN.coldStationLogPage.rangeLatestFetch} ${latestFetchText}`,
    `来源状态：${sourceStateLabel}`
  ];
  const canApplyDate = Boolean(draftDate) && draftDate !== selectedDate && !loading;

  function handleApplyDate() {
    if (!canApplyDate) {
      return;
    }
    setSelectedDate(draftDate);
  }

  function handleOpenDatePicker(useClickFallback = true) {
    const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!input) {
      return;
    }
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
    if (useClickFallback) {
      input.click();
    }
  }

  function updateHoveredColumn(nextColumnIndex: number | null) {
    const table = tableRef.current;
    if (!table || hoveredColumnRef.current === nextColumnIndex) {
      return;
    }

    if (hoveredColumnRef.current != null) {
      table
        .querySelectorAll<HTMLElement>(`[data-col-index="${hoveredColumnRef.current}"]`)
        .forEach((cell) => cell.classList.remove("is-col-hovered"));
    }

    if (nextColumnIndex != null) {
      table
        .querySelectorAll<HTMLElement>(`[data-col-index="${nextColumnIndex}"]`)
        .forEach((cell) => cell.classList.add("is-col-hovered"));
    }

    hoveredColumnRef.current = nextColumnIndex;
  }

  function handleTableMouseOver(event: ReactMouseEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>("th[data-col-index], td[data-col-index]");
    if (!cell || !tableRef.current?.contains(cell)) {
      return;
    }
    const columnIndex = Number(cell.dataset.colIndex);
    if (Number.isNaN(columnIndex)) {
      return;
    }
    updateHoveredColumn(columnIndex);
  }

  function handleTableMouseLeave() {
    updateHoveredColumn(null);
  }

  return (
    <div className="cold-station-log-page cold-log-cop-page page-enter">
      <section className="cold-log-header subpage-command-board">
        <div className="cold-log-command-copy subpage-command-copy">
          <p className="cold-log-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h1>{zhCN.coldStationLogPage.heading}</h1>
          <p>按日期回看冷站逐小时电耗、供冷量与系统COP，先确认当日效率，再查看下方明细。</p>
          <div className="cold-log-command-summary-grid">
            {commandStats.map((item) => (
              <article key={item.title} className="cold-log-command-stat" title={`${item.title}：${item.value}；${item.detail}`}>
                <span title={item.title}>{item.title}</span>
                <strong title={item.value}>{item.value}</strong>
                <small title={item.detail}>{item.detail}</small>
              </article>
            ))}
            <article className="cold-log-command-stat cold-log-command-filter-card">
              <div className="cold-log-toolbar cold-log-filter-actions">
                <label className="cold-log-date-field" aria-label={zhCN.coldStationLogPage.filterDate}>
                  <span className="cold-log-date-value">{draftDate || COLD_LOG_NOT_RETURNED_LABEL}</span>
                  <input
                    ref={dateInputRef}
                    aria-label={zhCN.coldStationLogPage.filterDate}
                    type="date"
                    value={draftDate}
                    max={today}
                    onChange={(event) => setDraftDate(event.target.value)}
                    onClick={() => handleOpenDatePicker(false)}
                  />
                </label>
                <button type="button" onClick={() => handleOpenDatePicker()}>
                  {zhCN.coldStationLogPage.chooseDate}
                </button>
                <button type="button" onClick={handleApplyDate} disabled={!canApplyDate}>
                  {zhCN.coldStationLogPage.query}
                </button>
                <button type="button" onClick={() => setReloadSeed((value) => value + 1)} disabled={loading}>
                  {loading ? zhCN.coldStationLogPage.refreshLoading : zhCN.coldStationLogPage.refresh}
                </button>
              </div>
            </article>
          </div>
        </div>
        <div className="cold-log-command-side subpage-command-side">
          <span className="cold-log-command-side-label">数据状态</span>
          <strong>{sourceHealthText}</strong>
          <p>{sourceCaptionText}</p>
          {statusDigestLines.length > 0 ? (
            <div className="cold-log-status-list">
              {statusDigestLines.map((item) => (
                <span key={item} className="cold-log-status-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className="cold-log-energy-split" aria-label="电耗构成">
            {energySplitCards.map((item) => (
              <span key={item.label}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </span>
            ))}
          </div>
        </div>
      </section>

      <SectionCard
        title={zhCN.coldStationLogPage.sectionHourly}
        action={<span className="dashboard-section-hint">左侧先看时间，再看能耗和效率</span>}
      >
        <div className="cold-log-table-stage">
          <div className="cold-log-table-stage-copy">
            <strong className="cold-log-table-stage-title">
              <span>{`${selectedDate} 逐小时记录`}</span>
              <span className="cold-log-table-stage-status">{sourceSummaryText}</span>
            </strong>
          </div>
          <div className="cold-log-table-stage-meta">
            {listStageMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        {items.length > 0 ? (
          <div
            className="cold-log-table-shell"
            role="region"
            aria-label="逐小时明细表，可横向滚动查看更多指标"
            tabIndex={0}
          >
            <span className="cold-log-table-scroll-hint">横向滑动查看更多指标</span>
            <table
              ref={tableRef}
              className="cold-log-table"
              onMouseOver={handleTableMouseOver}
              onMouseLeave={handleTableMouseLeave}
            >
              <thead>
                <tr>
                  {LOG_COLUMNS.map((column, columnIndex) => (
                    <th
                      key={String(column.key)}
                      data-col-index={columnIndex}
                      className={column.emphasized || column.key === "systemCoolingCapacity" ? "is-emphasized-head" : undefined}
                    >
                      {column.label}
                      {column.unit ? <small>{column.unit}</small> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || `${selectedDate}-${item.time}`}>
                    {LOG_COLUMNS.map((column, columnIndex) => {
                      if (column.key === "time") {
                        return (
                          <td
                            key={`${item.id || item.time}-time`}
                            data-col-index={columnIndex}
                          >
                            {formatLogRowTime(item)}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={`${item.id || item.time}-${String(column.key)}`}
                          data-col-index={columnIndex}
                        >
                          {formatNumber(
                            getLogColumnValue(column, item),
                            column.digits ?? 1,
                            shouldGroupColdLogUnit(column.unit)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cold-log-empty">
            {emptyText}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

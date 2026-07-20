import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import "./ReportRecordsExtracted.css";
import { ChevronDown } from "lucide-react";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, zhCN } from "../i18n/zhCN";
import {
  type OperationRecordDeviceOptionDto,
  type OperationRecordDeviceOptionsDto,
  type OperationRecordDeviceTypeDto,
  type OperationRecordDeviceTypeNodeDto,
  type ReportRecordDrRegDto,
  type ReportRecordDto,
  type ReportRecordRowDto,
  type ReportRecordRegOptionsDto,
  fetchOperationRecordDeviceTypes,
  fetchOperationRecordDevices,
  fetchReportRecordRegOptions,
  fetchReportRecords
} from "../services/bffClient";

type FilterState = {
  startDate: string;
  endDate: string;
  dateType: string;
  drTypeId: string;
  drId: string;
  regIds: string[];
  drRegMap: Record<string, string[]>;
  drRegMeta: Record<string, ReportRecordSelectionMeta>;
};

type ReportRecordSelectionMeta = {
  drTypeId: string;
  typeLabel: string;
  drId: string;
  deviceLabel: string;
  regLabels: Record<string, string>;
};

type QueryState = {
  startTime: string;
  endTime: string;
  dateType: string;
  drTypeId: string;
  drId: string;
  regIds: string[];
  drRegList: ReportRecordDrRegDto[];
} | null;

type TypeSelectOption = {
  id: string;
  label: string;
};

type ReportRecordRegChipProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

type ReportRecordSelectOption = {
  value: string;
  label: string;
};

type ReportRecordSelectProps = {
  ariaLabel: string;
  disabled?: boolean;
  id: string;
  isOpen: boolean;
  menuId: string;
  onSelect: (value: string) => void;
  onToggle: () => void;
  options: ReportRecordSelectOption[];
  value: string;
};

function ReportRecordRegChip({ active, label, onClick }: ReportRecordRegChipProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const updateOverflow = () => {
      setOverflowing(button.scrollWidth > button.clientWidth + 1);
    };
    updateOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(button);
    return () => observer.disconnect();
  }, [label]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`report-record-reg-chip${active ? " is-active" : ""}`}
      onClick={onClick}
      title={overflowing ? label : undefined}
    >
      {label}
    </button>
  );
}

function ReportRecordSelect({
  ariaLabel,
  disabled = false,
  id,
  isOpen,
  menuId,
  onSelect,
  onToggle,
  options,
  value
}: ReportRecordSelectProps) {
  const activeOption = options.find((item) => item.value === value) || options[0];
  const activeLabel = activeOption?.label || "";

  return (
    <div className={`report-record-select${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
      <button
        type="button"
        className={`report-record-select-trigger${isOpen ? " is-open" : ""}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        disabled={disabled}
      >
        <span className="report-record-select-trigger-text">{activeLabel}</span>
        <ChevronDown className="report-record-select-caret" size={14} aria-hidden="true" />
      </button>
      {isOpen && !disabled ? (
        <div id={menuId} className="report-record-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((item) => {
            const isActive = item.value === value;
            return (
              <button
                key={`${id}-${item.value}`}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`report-record-select-option${isActive ? " is-active" : ""}`}
                onClick={() => onSelect(item.value)}
              >
                <span className="report-record-select-option-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const DATE_TYPE_OPTIONS = [
  { value: "1", label: "\u4e00\u5206\u949f" },
  { value: "2", label: "\u5341\u5206\u949f" },
  { value: "3", label: "\u534a\u5c0f\u65f6" },
  { value: "4", label: "\u4e00\u5c0f\u65f6" }
];

const REPORT_RECORD_SUMMARY_COLUMNS = [
  { label: "对象", keys: ["对象", "objName"] },
  { label: "总值", keys: ["总值", "sumValue"] },
  { label: "峰值", keys: ["峰值", "maxValue"] },
  { label: "峰值出现时间", keys: ["峰值出现时间", "maxTime"] },
  { label: "谷值", keys: ["谷值", "minValue"] },
  { label: "谷值出现时间", keys: ["谷值出现时间", "minTime"] },
  { label: "平均值", keys: ["平均值", "average"] }
];

const REPORT_RECORD_TYPE_SUFFIX_ORDER = [
  "\u4e3b\u673a",
  "\u51b7\u673a",
  "\u51b0\u673a",
  "\u673a\u7ec4",
  "\u51b7\u51bb\u6c34\u6cf5",
  "\u51b7\u51bb\u6cf5",
  "\u51b7\u5374\u6c34\u6cf5",
  "\u51b7\u5374\u6cf5",
  "\u6c34\u6cf5",
  "\u6cf5",
  "\u51b7\u5374\u5854",
  "\u51b7\u5374\u5854\u98ce\u673a",
  "\u51b7\u5854",
  "\u51b7\u5374\u5854\u7ec4",
  "\u7cfb\u7edf\u63a7\u5236",
  "\u7cfb\u7edf\u53c2\u6570",
  "\u9600\u95e8",
  "\u4f20\u611f\u5668",
  "\u6e29\u5ea6",
  "\u6e7f\u5ea6",
  "\u4eea\u8868",
  "\u8868"
];

function normalizeTypeLabel(label: string): string {
  return label.replace(/^[\s-]+/, "").trim();
}

function getEnergyTypeSortGroup(label: string): number {
  if (label.includes("\u70ed\u91cf")) {
    return 3;
  }
  if (label.includes("\u51b7\u91cf")) {
    return 2;
  }
  if (label.includes("\u7535\u91cf")) {
    return 1;
  }
  return 0;
}

const REPORT_RECORD_UNMATCHED_SUFFIX_INDEX = REPORT_RECORD_TYPE_SUFFIX_ORDER.length;

function getTypeSuffixSortIndex(label: string): number {
  const matchedIndex = REPORT_RECORD_TYPE_SUFFIX_ORDER.findIndex((suffix) => label.endsWith(suffix));
  return matchedIndex >= 0 ? matchedIndex : REPORT_RECORD_UNMATCHED_SUFFIX_INDEX;
}

function sortReportRecordTypeOptions(options: TypeSelectOption[]): TypeSelectOption[] {
  return [...options].sort((left, right) => {
    const leftLabel = normalizeTypeLabel(left.label);
    const rightLabel = normalizeTypeLabel(right.label);
    const leftEnergyGroup = getEnergyTypeSortGroup(leftLabel);
    const rightEnergyGroup = getEnergyTypeSortGroup(rightLabel);
    const groupDiff = leftEnergyGroup - rightEnergyGroup;
    if (groupDiff !== 0) {
      return groupDiff;
    }
    if (leftEnergyGroup === 0) {
      const suffixDiff = getTypeSuffixSortIndex(leftLabel) - getTypeSuffixSortIndex(rightLabel);
      if (suffixDiff !== 0) {
        return suffixDiff;
      }
    }
    const nameDiff = leftLabel.localeCompare(rightLabel, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" });
  });
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDrRegList(filters: FilterState): ReportRecordDrRegDto[] {
  const merged = {
    ...filters.drRegMap
  };
  if (filters.drId !== "0") {
    if (filters.regIds.length > 0) {
      merged[filters.drId] = [...filters.regIds];
    } else {
      delete merged[filters.drId];
    }
  }
  return Object.entries(merged)
    .map(([drId, regIds]) => ({
      drId,
      regIds: Array.from(new Set(regIds.map((item) => String(item || "").trim()).filter(Boolean)))
    }))
    .filter((item) => item.drId !== "0" && item.regIds.length > 0);
}

function buildQuery(filters: FilterState): QueryState {
  const startTime = filters.startDate <= filters.endDate ? filters.startDate : filters.endDate;
  const endTime = filters.startDate <= filters.endDate ? filters.endDate : filters.startDate;
  const drRegList = buildDrRegList(filters);
  const primaryDrId = filters.drId !== "0" ? filters.drId : String(drRegList[0]?.drId || "0");
  const primaryTypeId =
    filters.drId !== "0"
      ? filters.drTypeId
      : filters.drRegMeta[primaryDrId]?.drTypeId || filters.drTypeId;
  const primaryRegIds = filters.drId !== "0" ? [...filters.regIds] : [...(drRegList[0]?.regIds || [])].map(String);
  return {
    startTime,
    endTime,
    dateType: filters.dateType,
    drTypeId: primaryTypeId,
    drId: primaryDrId,
    regIds: primaryRegIds,
    drRegList
  };
}

function flattenTypeOptions(nodes: OperationRecordDeviceTypeNodeDto[], depth = 0): TypeSelectOption[] {
  const prefix = depth > 0 ? `${"  ".repeat(Math.max(depth - 1, 0))}- ` : "";
  return nodes.flatMap((node) => {
    const id = String(node.id || "");
    const label = `${prefix}${node.label || id}`;
    const current = id ? [{ id, label }] : [];
    const children = Array.isArray(node.children) ? flattenTypeOptions(node.children, depth + 1) : [];
    return [...current, ...children];
  });
}

function findTypeLabel(options: TypeSelectOption[], id: string): string {
  const matched = options.find((item) => item.id === id)?.label || "";
  const cleaned = matched.replace(/^[\s-]+/, "").trim();
  return cleaned || zhCN.reportRecordPage.filterSelectType;
}

function findDeviceLabel(options: OperationRecordDeviceOptionDto[], id: string): string {
  return options.find((item) => String(item.id || "") === id)?.label || zhCN.reportRecordPage.filterSelectDevice;
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

function formatCellValue(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? formatReportRecordNumber(value) : "--";
  }
  if (typeof value === "string") {
    return formatReportRecordNumericText(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function pickReportRecordCellValue(row: ReportRecordRowDto, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return null;
}

function hasReportRecordSummaryFields(row: ReportRecordRowDto): boolean {
  return REPORT_RECORD_SUMMARY_COLUMNS.some((column) =>
    column.keys.some((key) => Object.prototype.hasOwnProperty.call(row, key))
  );
}

const REPORT_RECORD_CHART_COLORS = [
  "#68e8ff",
  "#8ff0b2",
  "#ffc86b",
  "#ff8f8f",
  "#a9a2ff",
  "#62d7c7",
  "#f7a8ff",
  "#89b9ff",
  "#f3ff7a",
  "#ffb36b",
  "#6fb7ff",
  "#b8ffcf",
  "#ff7ecb",
  "#9bd5ff",
  "#d4a4ff",
  "#7affd4",
  "#ff9a7a",
  "#c7f26b",
  "#7aa7ff",
  "#ffd1f0",
  "#9cffea",
  "#f6d36f",
  "#ff7f9a",
  "#a7ff8a"
];

const REPORT_RECORD_CHART_EXPORT_SHEET = "\u6298\u7ebf\u56fe\u8868";
const REPORT_RECORD_CHART_EXPORT_EMPTY = "\u5f53\u524d\u6298\u7ebf\u56fe\u8868\u6682\u65e0\u53ef\u5bfc\u51fa\u6570\u636e\uff0c\u8bf7\u5148\u67e5\u8be2\u3002";
const REPORT_RECORD_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0
});
const REPORT_RECORD_VALUE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2
});
const REPORT_RECORD_PAGE_SIZE = 10;
const REPORT_RECORD_VALUE_UNIT_PREFIX_PATTERN = /^(kw\/rt|kw|kwh|rt|rth|%|℃|°c|c|元|吨|t|hz|pa|a|v|m³|m3)/i;

function formatReportRecordCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return REPORT_RECORD_COUNT_FORMATTER.format(value);
}

function formatReportRecordNumber(value: number): string {
  return REPORT_RECORD_VALUE_FORMATTER.format(value);
}

function parseNumericDisplayValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatReportRecordNumericText(value: string): string {
  const trimmed = value.trim();
  const numericValue = parseNumericDisplayValue(trimmed);
  if (numericValue != null) {
    return formatReportRecordNumber(numericValue);
  }
  const unitMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)(\s*.+)$/);
  const unitText = unitMatch?.[2]?.trimStart() || "";
  if (!unitMatch || !REPORT_RECORD_VALUE_UNIT_PREFIX_PATTERN.test(unitText)) {
    return value;
  }
  const numericPrefix = Number(unitMatch[1]);
  return Number.isFinite(numericPrefix) ? `${formatReportRecordNumber(numericPrefix)}${unitMatch[2]}` : value;
}

function formatChartNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return formatReportRecordNumber(value);
}

function isReportRecordCopSeries(name: string | null | undefined): boolean {
  const normalized = (name || "").replace(/\s+/g, "").toLowerCase();
  return normalized.includes("cop") || normalized.includes("系统效率");
}

function formatLatestReportRecordCop(chart: ReportRecordDto["chart"] | undefined): string {
  const copSeries = (chart?.series || []).find((item) => isReportRecordCopSeries(item.name));
  const latestValue = (copSeries?.values || [])
    .slice()
    .reverse()
    .find((value) => typeof value === "number" && Number.isFinite(value));
  return typeof latestValue === "number" ? formatReportRecordNumber(latestValue) : "--";
}

function getReportRecordExportSeries(chart: ReportRecordDto["chart"] | undefined) {
  return (chart?.series || []).filter((item) =>
    (item.values || []).some((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function hasReportRecordChartData(chart: ReportRecordDto["chart"] | undefined): boolean {
  return (chart?.labels?.length || 0) > 0 && getReportRecordExportSeries(chart).length > 0;
}

function escapeExcelXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExcelCell(value: string | number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeExcelXml(String(value ?? ""))}</Data></Cell>`;
}

function buildReportRecordChartWorkbook(chart: ReportRecordDto["chart"] | undefined): string {
  const labels = chart?.labels || [];
  const series = getReportRecordExportSeries(chart);
  const rows = [
    ["\u65f6\u95f4", ...series.map((item, index) => item.name || `\u5e8f\u5217 ${index + 1}`)],
    ...labels.map((label, index) => [
      label,
      ...series.map((item) => {
        const value = item.values?.[index];
        return typeof value === "number" && Number.isFinite(value) ? value : "";
      })
    ])
  ];
  const tableRows = rows
    .map((row) => `<Row>${row.map((cell) => buildExcelCell(cell)).join("")}</Row>`)
    .join("");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    `<Worksheet ss:Name="${REPORT_RECORD_CHART_EXPORT_SHEET}">`,
    "<Table>",
    tableRows,
    "</Table>",
    "</Worksheet>",
    "</Workbook>"
  ].join("");
}

function buildReportRecordChartExportFilename(report: ReportRecordDto | null): string {
  const fallbackPrefix = "\u62a5\u8868\u8bb0\u5f55";
  const prefix = String(report?.filenamePrefix || fallbackPrefix)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim() || fallbackPrefix;
  return `${prefix}-${REPORT_RECORD_CHART_EXPORT_SHEET}.xls`;
}

function downloadReportRecordChartExcel(report: ReportRecordDto | null): void {
  const workbook = buildReportRecordChartWorkbook(report?.chart);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildReportRecordChartExportFilename(report);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function ReportRecordLineChart({
  chart,
  loading,
  latestFetchText
}: {
  chart: ReportRecordDto["chart"] | undefined;
  loading: boolean;
  latestFetchText: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const labels = chart?.labels || [];
  const series = (chart?.series || [])
    .filter((item) => (item.values || []).some((value) => typeof value === "number" && Number.isFinite(value)));
  const numericValues = series.flatMap((item) =>
    (item.values || []).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  );

  if (loading) {
    return (
      <div className="report-record-chart-card">
        <div className="report-record-chart-head">
          <div>
            <strong>折线图表</strong>
            <p>正在加载</p>
          </div>
          <div className="report-record-chart-meta">{latestFetchText}</div>
        </div>
        <div className="report-record-chart-empty">正在加载折线图表数据...</div>
      </div>
    );
  }

  if (labels.length === 0 || series.length === 0 || numericValues.length === 0) {
    return (
      <div className="report-record-chart-card">
        <div className="report-record-chart-head">
          <div>
            <strong>折线图表</strong>
            <p>曲线 0 条</p>
          </div>
          <div className="report-record-chart-meta">{latestFetchText}</div>
        </div>
        <div className="report-record-chart-empty">暂无曲线数据</div>
      </div>
    );
  }

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const valueRange = maxValue - minValue || 1;
  const paddedMin = minValue - valueRange * 0.08;
  const paddedMax = maxValue + valueRange * 0.08;
  const paddedRange = paddedMax - paddedMin || 1;
  const lastIndex = Math.max(labels.length - 1, 1);
  const xFor = (index: number) => (index / lastIndex) * 100;
  const yFor = (value: number) => 88 - ((value - paddedMin) / paddedRange) * 76;
  const activeIndex = hoverIndex ?? labels.length - 1;
  const activeLabel = labels[activeIndex] || labels[labels.length - 1] || "--";
  const activeX = xFor(activeIndex);
  const useTwoColumnTooltip = series.length > 15;
  const tooltipClassName = [
    "report-record-chart-tooltip",
    activeX > (useTwoColumnTooltip ? 50 : 58) ? "is-left" : "",
    useTwoColumnTooltip ? "is-two-column" : ""
  ].filter(Boolean).join(" ");
  const axisLabels = [
    labels[0],
    labels[Math.floor(labels.length / 2)],
    labels[labels.length - 1]
  ].filter(Boolean);
  const yTicks = [
    { y: 12, value: paddedMax },
    { y: 31, value: paddedMin + paddedRange * 0.75 },
    { y: 50, value: paddedMin + paddedRange * 0.5 },
    { y: 69, value: paddedMin + paddedRange * 0.25 },
    { y: 88, value: paddedMin }
  ];

  return (
      <div className="report-record-chart-card">
        <div className="report-record-chart-head">
          <div>
            <strong>折线图表</strong>
          <p>{`曲线 ${formatReportRecordCount(series.length)} 条`}</p>
          </div>
        <div className="report-record-chart-meta">{latestFetchText}</div>
      </div>
      <div className="report-record-chart-plot-frame">
        <div className="report-record-chart-y-axis" aria-hidden="true">
          {yTicks.map((tick) => (
            <span key={`y-${tick.y}`} style={{ top: `${tick.y}%` }}>
              {formatChartNumber(tick.value)}
            </span>
          ))}
        </div>
        <div
          className="report-record-chart-plot"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            setHoverIndex(Math.round(ratio * (labels.length - 1)));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="report-record-chart-svg">
            {[12, 31, 50, 69, 88].map((y) => (
              <line key={`grid-${y}`} x1="0" y1={y} x2="100" y2={y} className="report-record-chart-grid-line" />
            ))}
            {series.map((item, index) => {
              const points = (item.values || [])
                .map((value, valueIndex) =>
                  typeof value === "number" && Number.isFinite(value)
                    ? `${xFor(valueIndex).toFixed(2)},${yFor(value).toFixed(2)}`
                    : ""
                )
                .filter(Boolean)
                .join(" ");
              return (
                <polyline
                  key={`${item.name || "series"}-${index + 1}`}
                  points={points}
                  fill="none"
                  stroke={REPORT_RECORD_CHART_COLORS[index % REPORT_RECORD_CHART_COLORS.length]}
                  strokeWidth="0.72"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <line x1={activeX} y1="8" x2={activeX} y2="92" className="report-record-chart-hover-line" />
          </svg>
          <div className={tooltipClassName} style={{ left: `${activeX}%` }}>
            <strong>{activeLabel}</strong>
            {series.map((item, index) => (
              <span key={`tooltip-${item.name || index}`}>
                <i style={{ background: REPORT_RECORD_CHART_COLORS[index % REPORT_RECORD_CHART_COLORS.length] }} />
                <em>{item.name || `序列 ${index + 1}`}</em>
                <b>{formatChartNumber(item.values?.[activeIndex] ?? null)}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="report-record-chart-axis">
        {axisLabels.map((label, index) => (
          <span key={`${label}-${index + 1}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export default function ReportRecordsPage() {
  const locale = getCurrentLocale();
  const today = formatDateInput(new Date());
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    startDate: today,
    endDate: today,
    dateType: "4",
    drTypeId: "0",
    drId: "0",
    regIds: [],
    drRegMap: {},
    drRegMeta: {}
  });
  const [query, setQuery] = useState<QueryState>(null);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ReportRecordDto | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [types, setTypes] = useState<OperationRecordDeviceTypeDto | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<OperationRecordDeviceOptionsDto | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [regs, setRegs] = useState<ReportRecordRegOptionsDto | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<"dateType" | "drTypeId" | "drId" | null>(null);
  const initialAutoLoadedRef = useRef(false);

  useEffect(() => {
    if (!openFilterDropdown) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && filterDropdownRef.current?.contains(target)) {
        return;
      }
      setOpenFilterDropdown(null);
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [openFilterDropdown]);

  useEffect(() => {
    let active = true;

    async function loadTypes() {
      try {
        const result = await fetchOperationRecordDeviceTypes(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(result);
          setTypeError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(null);
          setTypeError(zhCN.reportRecordPage.typeLoadFailed);
        });
      }
    }

    loadTypes();
    return () => {
      active = false;
    };
  }, []);

  const typeOptions = useMemo(() => sortReportRecordTypeOptions(flattenTypeOptions(types?.items || [])), [types]);

  useEffect(() => {
    const firstTypeId = typeOptions[0]?.id;
    if (!firstTypeId) {
      return;
    }
    setFilters((current) => (current.drTypeId === "0" ? { ...current, drTypeId: firstTypeId } : current));
  }, [typeOptions]);

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      if (filters.drTypeId === "0") {
        startTransition(() => {
          setDevices({
            items: [
              {
                id: "0",
                label: zhCN.reportRecordPage.filterSelectDevice
              }
            ]
          });
          setRegs(null);
          setDeviceError(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            drId: "0",
            regIds: []
          }));
        });
        return;
      }

      try {
        const result = await fetchOperationRecordDevices(runtimeConfig.siteId, filters.drTypeId);
        if (!active) {
          return;
        }
        const items = [
          {
            id: "0",
            label: zhCN.reportRecordPage.filterSelectDevice
          },
          ...(result.items || [])
        ];
        const firstActualId = String(items.find((item) => String(item.id || "") !== "0")?.id || "0");

        startTransition(() => {
          setDevices({
            ...result,
            items
          });
          setDeviceError(null);
          setFilters((current) => {
            const currentDeviceStillExists =
              current.drId !== "0" && items.some((item) => String(item.id || "") === current.drId);
            const nextDrId = currentDeviceStillExists ? current.drId : firstActualId;
            return {
              ...current,
              drId: nextDrId,
              regIds: nextDrId !== "0" ? current.drRegMap[nextDrId] || [] : []
            };
          });
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDevices({
            items: [
              {
                id: "0",
                label: zhCN.reportRecordPage.filterSelectDevice
              }
            ]
          });
          setDeviceError(zhCN.reportRecordPage.deviceLoadFailed);
          setRegs(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            drId: "0",
            regIds: []
          }));
        });
      }
    }

    loadDevices();
    return () => {
      active = false;
    };
  }, [filters.drTypeId]);

  useEffect(() => {
    let active = true;

    async function loadRegs() {
      if (filters.drTypeId === "0" || filters.drId === "0") {
        startTransition(() => {
          setRegs(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            regIds: []
          }));
        });
        return;
      }

      try {
        const result = await fetchReportRecordRegOptions(runtimeConfig.siteId, {
          drTypeId: filters.drTypeId,
          drId: filters.drId
        });
        if (!active) {
          return;
        }
        const allowedIds = new Set((result.items || []).map((item) => String(item.id || "")));
        const firstAllowedId = String(result.items?.[0]?.id || "");
        startTransition(() => {
          setRegs(result);
          setRegError(null);
          setFilters((current) => {
            const savedRegIds = current.drId !== "0" ? current.drRegMap[current.drId] || current.regIds : [];
            const retainedRegIds = savedRegIds.filter((item) => allowedIds.has(item));
            const shouldAutoPrimeInitial = !initialAutoLoadedRef.current && current.drId !== "0" && retainedRegIds.length === 0 && Boolean(firstAllowedId);
            const nextRegIds =
              retainedRegIds.length > 0
                ? retainedRegIds
                : shouldAutoPrimeInitial
                  ? [firstAllowedId]
                  : [];
            const nextDrRegMap = {
              ...current.drRegMap
            };
            const nextDrRegMeta = {
              ...current.drRegMeta
            };
            if (current.drId !== "0" && nextRegIds.length > 0) {
              nextDrRegMap[current.drId] = nextRegIds;
              const regLabels = Object.fromEntries(
                (result.items || [])
                  .filter((item) => nextRegIds.includes(String(item.id || "")))
                  .map((item) => [String(item.id || ""), item.label || String(item.id || "")])
              );
              nextDrRegMeta[current.drId] = {
                drTypeId: current.drTypeId,
                typeLabel: findTypeLabel(typeOptions, current.drTypeId),
                drId: current.drId,
                deviceLabel: findDeviceLabel(deviceOptions, current.drId),
                regLabels
              };
            } else if (current.drId !== "0") {
              delete nextDrRegMap[current.drId];
              delete nextDrRegMeta[current.drId];
            }

            if (!initialAutoLoadedRef.current && current.drId !== "0" && nextRegIds.length > 0) {
              setPage(1);
              setQuery(
                buildQuery({
                  ...current,
                  regIds: nextRegIds,
                  drRegMap: nextDrRegMap,
                  drRegMeta: nextDrRegMeta
                })
              );
              initialAutoLoadedRef.current = true;
            }

            return {
              ...current,
              regIds: nextRegIds,
              drRegMap: nextDrRegMap,
              drRegMeta: nextDrRegMeta
            };
          });
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setRegs(null);
          setRegError(zhCN.reportRecordPage.regLoadFailed);
          setFilters((current) => ({
            ...current,
            regIds: []
          }));
        });
      }
    }

    loadRegs();
    return () => {
      active = false;
    };
  }, [filters.drTypeId, filters.drId]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!query) {
        startTransition(() => {
          setLoading(false);
        });
        return;
      }

      setLoading(true);
      try {
        const result = await fetchReportRecords(runtimeConfig.siteId, {
          ...query,
          page,
          pageSize: REPORT_RECORD_PAGE_SIZE
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setReport(result);
          setReportError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setReport(null);
          setReportError(zhCN.reportRecordPage.degraded);
          setLoading(false);
        });
      }
    }

    loadReport();
    return () => {
      active = false;
    };
  }, [query, page]);

  const deviceOptions = devices?.items || [
    {
      id: "0",
      label: zhCN.reportRecordPage.filterSelectDevice
    }
  ];
  const regOptions = regs?.items || [];
  const uniqueRegOptions = useMemo(() => {
    const seen = new Set<string>();
    return regOptions.filter((item, index) => {
      const regId = String(item.id || "");
      if (!regId) {
        return true;
      }
      if (seen.has(regId)) {
        return false;
      }
      seen.add(regId);
      return index >= 0;
    });
  }, [regOptions]);
  const sourceSummary = summarizeSourceStatus([types?.sourceStatus, devices?.sourceStatus, regs?.sourceStatus, report?.sourceStatus]);
  const canExportChart = hasReportRecordChartData(report?.chart);
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [types?.sourceStatus, devices?.sourceStatus, regs?.sourceStatus, report?.sourceStatus],
    {
      labelMode: "short"
    }
  );
  const bannerText =
    exportError ||
    reportError ||
    typeError ||
    deviceError ||
    regError ||
    (loading ? zhCN.reportRecordPage.loading : sourceSummary.text);
  const directSummaryItems = (report?.summaryItems || []).filter(hasReportRecordSummaryFields);
  const fallbackSummaryItems = (report?.items || []).filter(hasReportRecordSummaryFields);
  const items = directSummaryItems.length > 0 ? directSummaryItems : fallbackSummaryItems;
  const total = typeof report?.total === "number" ? report.total : items.length;
  const activeTypeLabel = filters.drTypeId !== "0" ? findTypeLabel(typeOptions, filters.drTypeId) : zhCN.reportRecordPage.filterSelectType;
  const activeDeviceLabel =
    filters.drId !== "0" ? findDeviceLabel(deviceOptions, filters.drId) : zhCN.reportRecordPage.filterSelectDevice;
  const selectedDeviceRegList = buildDrRegList(filters);
  const displayQuery = query || (selectedDeviceRegList.length > 0 || filters.drId !== "0" ? buildQuery(filters) : null);
  const selectedRegItems = uniqueRegOptions.filter((item) => filters.regIds.includes(String(item.id || "")));
  const selectedRegTotal = selectedDeviceRegList.reduce((sum, item) => sum + item.regIds.length, 0);
  const selectedDeviceSummaries = selectedDeviceRegList.map((item) => {
    const drId = String(item.drId);
    const meta = filters.drRegMeta[drId];
    const isCurrentDevice = drId === filters.drId;
    const regLabelLookup = isCurrentDevice
      ? Object.fromEntries(uniqueRegOptions.map((reg) => [String(reg.id || ""), reg.label || String(reg.id || "")]))
      : {};
    return {
      drId,
      drTypeId: meta?.drTypeId || (isCurrentDevice ? filters.drTypeId : ""),
      typeLabel: meta?.typeLabel || activeTypeLabel,
      deviceLabel: meta?.deviceLabel || (isCurrentDevice ? activeDeviceLabel : drId),
      regs: item.regIds.map((regId) => ({
        regId: String(regId),
        label: meta?.regLabels?.[String(regId)] || regLabelLookup[String(regId)] || String(regId)
      }))
    };
  });
  const selectedSelectionTree = Array.from(
    selectedDeviceSummaries
      .reduce((tree, item) => {
        const typeKey = item.drTypeId || item.typeLabel;
        const current = tree.get(typeKey) || {
          typeKey,
          typeLabel: item.typeLabel,
          devices: [] as typeof selectedDeviceSummaries
        };
        current.devices.push(item);
        tree.set(typeKey, current);
        return tree;
      }, new Map<string, { typeKey: string; typeLabel: string; devices: typeof selectedDeviceSummaries }>())
      .values()
  );
  const selectionDeviceLabel =
    selectedDeviceRegList.length > 1 ? `多个设备 ${formatReportRecordCount(selectedDeviceRegList.length)}台` : activeDeviceLabel;
  const dateRangeText =
    filters.startDate === filters.endDate ? filters.startDate : `${filters.startDate} ~ ${filters.endDate}`;
  const intervalLabel = DATE_TYPE_OPTIONS.find((item) => item.value === filters.dateType)?.label || "\u4e00\u5c0f\u65f6";
  const intervalSelectOptions = DATE_TYPE_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label
  }));
  const typeSelectOptions = [
    {
      value: "0",
      label: zhCN.reportRecordPage.filterSelectType
    },
    ...typeOptions.map((item) => ({
      value: item.id,
      label: item.label
    }))
  ];
  const deviceSelectOptions = deviceOptions.map((item) => ({
    value: String(item.id || "0"),
    label: item.label || zhCN.reportRecordPage.filterSelectDevice
  }));
  const pointCoverage =
    uniqueRegOptions.length > 0
      ? `${formatReportRecordCount(selectedRegItems.length)}/${formatReportRecordCount(uniqueRegOptions.length)}`
      : zhCN.reportRecordPage.pointAll;
  const selectedPointsValue = selectedRegTotal > 0
    ? `${formatReportRecordCount(selectedRegTotal)}${zhCN.reportRecordPage.unitPoints}`
    : uniqueRegOptions.length > 0
      ? zhCN.reportRecordPage.tracePointsAll
      : `0${zhCN.reportRecordPage.unitPoints}`;
  const queryStatusLabel = loading
    ? zhCN.reportRecordPage.loading
    : total > 0
      ? zhCN.reportRecordPage.traceReady
      : displayQuery
        ? zhCN.reportRecordPage.traceEmpty
        : zhCN.reportRecordPage.tracePending;
  const statusDigestLines = Array.from(new Set(sourceStatusLinesCompact.filter(Boolean))).slice(0, 3);
  const latestFetchTime = formatDateTime(report?.generatedAt || report?.freshness?.latestTimestamp);
  const sourceStateLabel = sourceSummary.warn ? "异常" : "正常";
  const systemCopValue = formatLatestReportRecordCop(report?.chart);
  const currentReportPage = typeof report?.page === "number" && report.page > 0 ? report.page : page;
  const currentPageSize =
    typeof report?.pageSize === "number" && report.pageSize > 0 ? report.pageSize : REPORT_RECORD_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / currentPageSize));
  const canGoPrev = currentReportPage > 1 && !loading;
  const canGoNext = currentReportPage < totalPages && !loading;
  const traceNextLabel =
    total > 0
      ? zhCN.reportRecordPage.traceNextReady
      : displayQuery
        ? zhCN.reportRecordPage.traceNextEmpty
        : zhCN.reportRecordPage.traceNextPending;
  const metricItems = [
    { label: "来源状态", value: sourceStateLabel, tone: sourceSummary.warn ? "warn" : "good" },
    { label: "系统效率COP", value: systemCopValue },
    { label: zhCN.reportRecordPage.rangeLatestFetch.replace("：", ""), value: latestFetchTime },
    { label: zhCN.reportRecordPage.summaryTotal, value: `${formatReportRecordCount(total)}${zhCN.reportRecordPage.unitRows}` },
    { label: zhCN.reportRecordPage.tracePointsTitle, value: pointCoverage },
    { label: zhCN.reportRecordPage.summaryDevice, value: selectionDeviceLabel }
  ];
  function buildCurrentDeviceSelectionMeta(state: FilterState, drId: string, regIds: string[]): ReportRecordSelectionMeta | null {
    if (drId === "0" || regIds.length === 0) {
      return null;
    }
    const regLabels = Object.fromEntries(
      uniqueRegOptions
        .filter((item) => regIds.includes(String(item.id || "")))
        .map((item) => [String(item.id || ""), item.label || String(item.id || "")])
    );
    return {
      drTypeId: state.drTypeId,
      typeLabel: state.drTypeId === filters.drTypeId ? activeTypeLabel : findTypeLabel(typeOptions, state.drTypeId),
      drId,
      deviceLabel: findDeviceLabel(deviceOptions, drId),
      regLabels
    };
  }

  function commitCurrentSelection(current: FilterState): Pick<FilterState, "drRegMap" | "drRegMeta"> {
    const nextDrRegMap = {
      ...current.drRegMap
    };
    const nextDrRegMeta = {
      ...current.drRegMeta
    };
    if (current.drId !== "0" && current.regIds.length > 0) {
      nextDrRegMap[current.drId] = current.regIds;
      const meta = buildCurrentDeviceSelectionMeta(current, current.drId, current.regIds);
      if (meta) {
        nextDrRegMeta[current.drId] = meta;
      }
    } else if (current.drId !== "0") {
      delete nextDrRegMap[current.drId];
      delete nextDrRegMeta[current.drId];
    }
    return {
      drRegMap: nextDrRegMap,
      drRegMeta: nextDrRegMeta
    };
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
  }

  function openDatePicker(input: HTMLInputElement) {
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (_error) {
        // Some browsers reject showPicker unless the click is a direct user gesture.
      }
    }
  }

  function updateCurrentRegSelection(regIds: string[]) {
    setFilters((current) => {
      const nextRegIds = Array.from(new Set(regIds.map((item) => String(item || "").trim()).filter(Boolean)));
      const nextDrRegMap = {
        ...current.drRegMap
      };
      const nextDrRegMeta = {
        ...current.drRegMeta
      };
      if (current.drId !== "0" && nextRegIds.length > 0) {
        nextDrRegMap[current.drId] = nextRegIds;
        const meta = buildCurrentDeviceSelectionMeta(current, current.drId, nextRegIds);
        if (meta) {
          nextDrRegMeta[current.drId] = meta;
        }
      } else if (current.drId !== "0") {
        delete nextDrRegMap[current.drId];
        delete nextDrRegMeta[current.drId];
      }
      return {
        ...current,
        regIds: nextRegIds,
        drRegMap: nextDrRegMap,
        drRegMeta: nextDrRegMeta
      };
    });
    setExportError(null);
  }

  function handleTypeChange(nextTypeId: string) {
    setFilters((current) => {
      const committed = commitCurrentSelection(current);
      return {
        ...current,
        ...committed,
        drTypeId: nextTypeId,
        drId: "0",
        regIds: []
      };
    });
    setExportError(null);
  }

  function handleDeviceChange(nextDrId: string) {
    setFilters((current) => {
      const committed = commitCurrentSelection(current);
      return {
        ...current,
        ...committed,
        drId: nextDrId,
        regIds: nextDrId !== "0" ? committed.drRegMap[nextDrId] || [] : []
      };
    });
    setExportError(null);
  }

  function toggleReg(regId: string) {
    setFilters((current) => {
      const exists = current.regIds.includes(regId);
      const nextRegIds = exists
        ? current.regIds.filter((item) => item !== regId)
        : [...current.regIds, regId];
      const nextDrRegMap = {
        ...current.drRegMap
      };
      const nextDrRegMeta = {
        ...current.drRegMeta
      };
      if (current.drId !== "0" && nextRegIds.length > 0) {
        nextDrRegMap[current.drId] = nextRegIds;
        const meta = buildCurrentDeviceSelectionMeta(current, current.drId, nextRegIds);
        if (meta) {
          nextDrRegMeta[current.drId] = meta;
        }
      } else if (current.drId !== "0") {
        delete nextDrRegMap[current.drId];
        delete nextDrRegMeta[current.drId];
      }
      return {
        ...current,
        regIds: nextRegIds,
        drRegMap: nextDrRegMap,
        drRegMeta: nextDrRegMeta
      };
    });
  }

  function removeDeviceSelection(drId: string) {
    setFilters((current) => {
      const nextDrRegMap = {
        ...current.drRegMap
      };
      const nextDrRegMeta = {
        ...current.drRegMeta
      };
      delete nextDrRegMap[drId];
      delete nextDrRegMeta[drId];
      return {
        ...current,
        regIds: current.drId === drId ? [] : current.regIds,
        drRegMap: nextDrRegMap,
        drRegMeta: nextDrRegMeta
      };
    });
    setExportError(null);
  }

  function removeTypeSelection(typeKey: string) {
    const targetDrIds = new Set(
      selectedDeviceSummaries
        .filter((item) => (item.drTypeId || item.typeLabel) === typeKey)
        .map((item) => item.drId)
    );
    if (targetDrIds.size === 0) {
      return;
    }
    setFilters((current) => {
      const nextDrRegMap = {
        ...current.drRegMap
      };
      const nextDrRegMeta = {
        ...current.drRegMeta
      };
      targetDrIds.forEach((drId) => {
        delete nextDrRegMap[drId];
        delete nextDrRegMeta[drId];
      });
      return {
        ...current,
        regIds: targetDrIds.has(current.drId) ? [] : current.regIds,
        drRegMap: nextDrRegMap,
        drRegMeta: nextDrRegMeta
      };
    });
    setExportError(null);
  }

  function removePointSelection(drId: string, regId: string) {
    setFilters((current) => {
      const currentRegIds = current.drId === drId ? current.regIds : current.drRegMap[drId] || [];
      const nextRegIds = currentRegIds.filter((item) => String(item) !== regId);
      const nextDrRegMap = {
        ...current.drRegMap
      };
      const nextDrRegMeta = {
        ...current.drRegMeta
      };
      if (nextRegIds.length > 0) {
        nextDrRegMap[drId] = nextRegIds;
        if (nextDrRegMeta[drId]) {
          const nextRegLabels = {
            ...nextDrRegMeta[drId].regLabels
          };
          delete nextRegLabels[regId];
          nextDrRegMeta[drId] = {
            ...nextDrRegMeta[drId],
            regLabels: nextRegLabels
          };
        }
      } else {
        delete nextDrRegMap[drId];
        delete nextDrRegMeta[drId];
      }
      return {
        ...current,
        regIds: current.drId === drId ? nextRegIds : current.regIds,
        drRegMap: nextDrRegMap,
        drRegMeta: nextDrRegMeta
      };
    });
    setExportError(null);
  }

  function handleSearch() {
    setReportError(null);
    setExportError(null);
    const nextQuery = buildQuery(filters);
    if (!nextQuery || nextQuery.drRegList.length === 0) {
      setReportError(zhCN.reportRecordPage.regEmpty);
      return;
    }
    setPage(1);
    setQuery(nextQuery);
  }

  function handleReset() {
    const firstTypeId = typeOptions[0]?.id || "0";
    setReport(null);
    setReportError(null);
    setExportError(null);
    setQuery(null);
    setPage(1);
    setFilters({
      startDate: today,
      endDate: today,
      dateType: "4",
      drTypeId: firstTypeId,
      drId: "0",
      regIds: [],
      drRegMap: {},
      drRegMeta: {}
    });
  }

  async function handleExport() {
    if (!canExportChart) {
      setExportError(REPORT_RECORD_CHART_EXPORT_EMPTY);
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      downloadReportRecordChartExcel(report);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setExportError(zhCN.reportRecordPage.exportFailed);
      });
    }
  }

  return (
    <div className="report-record-page page-enter" data-locale={locale}>
      <section className="report-record-header subpage-command-board">
        <div className="subpage-command-copy report-record-command-copy">
          <p className="report-record-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h1>{zhCN.reportRecordPage.heading}</h1>
        </div>
        <div className="subpage-command-side report-record-command-side">
          <div className="report-record-command-state">
            <article>
              <span>{zhCN.reportRecordPage.traceCoverageTitle}</span>
              <strong>{queryStatusLabel}</strong>
            </article>
            <article>
              <span>当前查询</span>
              <strong>{`${dateRangeText} · ${intervalLabel} · ${selectedPointsValue}`}</strong>
            </article>
          </div>
          {statusDigestLines.length > 0 ? (
            <div className="report-record-status-list" aria-label={zhCN.reportRecordPage.sectionTrace}>
              {statusDigestLines.map((line, index) => (
                <span key={`hero-status-${index + 1}-${line}`} className="report-record-status-chip">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="report-record-header-filter" aria-label={zhCN.reportRecordPage.sectionFilters}>
          <div className="report-record-filter-grid" ref={filterDropdownRef}>
            <label className="report-record-field">
              <span>日期范围·开始</span>
              <input
                type="date"
                value={filters.startDate}
                max={today}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                onClick={(event) => openDatePicker(event.currentTarget)}
              />
            </label>
            <label className="report-record-field">
              <span>日期范围·结束</span>
              <input
                type="date"
                value={filters.endDate}
                max={today}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                onClick={(event) => openDatePicker(event.currentTarget)}
              />
            </label>
            <label className="report-record-field">
              <span>{"\u65f6\u95f4\u95f4\u9694"}</span>
              <ReportRecordSelect
                id="dateType"
                menuId="report-record-date-type-listbox"
                ariaLabel={"\u65f6\u95f4\u95f4\u9694"}
                value={filters.dateType}
                options={intervalSelectOptions}
                isOpen={openFilterDropdown === "dateType"}
                onToggle={() => setOpenFilterDropdown((current) => (current === "dateType" ? null : "dateType"))}
                onSelect={(value) => {
                  updateFilter("dateType", value);
                  setOpenFilterDropdown(null);
                }}
              />
            </label>
            <label className="report-record-field">
              <span>{zhCN.reportRecordPage.filterType}</span>
              <ReportRecordSelect
                id="drTypeId"
                menuId="report-record-dr-type-listbox"
                ariaLabel={zhCN.reportRecordPage.filterType}
                value={filters.drTypeId}
                options={typeSelectOptions}
                isOpen={openFilterDropdown === "drTypeId"}
                onToggle={() => setOpenFilterDropdown((current) => (current === "drTypeId" ? null : "drTypeId"))}
                onSelect={(value) => {
                  handleTypeChange(value);
                  setOpenFilterDropdown(null);
                }}
              />
            </label>
            <label className="report-record-field">
              <span>{zhCN.reportRecordPage.filterDevice}</span>
              <ReportRecordSelect
                id="drId"
                menuId="report-record-dr-listbox"
                ariaLabel={zhCN.reportRecordPage.filterDevice}
                value={filters.drId}
                options={deviceSelectOptions}
                disabled={filters.drTypeId === "0"}
                isOpen={openFilterDropdown === "drId"}
                onToggle={() => {
                  if (filters.drTypeId !== "0") {
                    setOpenFilterDropdown((current) => (current === "drId" ? null : "drId"));
                  }
                }}
                onSelect={(value) => {
                  handleDeviceChange(value);
                  setOpenFilterDropdown(null);
                }}
              />
            </label>
            <div className="report-record-actions report-record-actions-inline">
              <button type="button" className="report-record-button is-primary" onClick={handleSearch}>
                {zhCN.reportRecordPage.search}
              </button>
              <button type="button" className="report-record-button" onClick={handleReset}>
                {zhCN.reportRecordPage.reset}
              </button>
              <button
                type="button"
                className="report-record-button"
                onClick={handleExport}
                disabled={exporting || !canExportChart}
              >
                {exporting ? zhCN.reportRecordPage.exporting : zhCN.reportRecordPage.export}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="report-record-metric-strip" aria-label="历史数据状态">
        {metricItems.map((item) => (
          <article key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="report-record-workspace" aria-label="历史数据曲线与测点">
        <div className="report-record-chart-panel">
          <ReportRecordLineChart
            chart={report?.chart}
            loading={loading}
            latestFetchText={`${zhCN.reportRecordPage.rangeLatestFetch} ${latestFetchTime}`}
          />
        </div>

        <aside className="report-record-side-panel" aria-label="测点与留痕">
          <div className="report-record-side-head">
            <div>
              <strong>测点与留痕</strong>
              <span>{`${formatReportRecordCount(selectedDeviceSummaries.length)}组 · ${formatReportRecordCount(selectedRegTotal)}${zhCN.reportRecordPage.unitPoints} · 覆盖 ${pointCoverage}`}</span>
            </div>
          </div>

          <div className="report-record-side-block">
            <div className="report-record-side-title">
              <strong>已选查询组合</strong>
              <span>{`合计 ${formatReportRecordCount(selectedRegTotal)}${zhCN.reportRecordPage.unitPoints}`}</span>
            </div>
            {selectedDeviceSummaries.length > 0 ? (
              <div className="report-record-selection-tree is-compact">
                {selectedSelectionTree.map((typeNode) => {
                  const typePointTotal = typeNode.devices.reduce((sum, device) => sum + device.regs.length, 0);
                  return (
                    <details key={`selection-type-${typeNode.typeKey}`} className="report-record-selection-tree-type" open>
                      <summary>
                        <span>{typeNode.typeLabel}</span>
                        <em>{`${formatReportRecordCount(typeNode.devices.length)}台 / ${formatReportRecordCount(typePointTotal)}${zhCN.reportRecordPage.unitPoints}`}</em>
                        <button type="button" onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeTypeSelection(typeNode.typeKey);
                        }}>
                          delete
                        </button>
                      </summary>
                      <div className="report-record-selection-tree-devices">
                        {typeNode.devices.map((device) => (
                          <details
                            key={`selection-device-${device.drId}`}
                            className={`report-record-selection-tree-device${device.drId === filters.drId ? " is-current" : ""}`}
                            open
                          >
                            <summary>
                              <span>{device.deviceLabel}</span>
                              <em>{`${formatReportRecordCount(device.regs.length)}${zhCN.reportRecordPage.unitPoints}`}</em>
                              <button type="button" onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                removeDeviceSelection(device.drId);
                              }}>
                                delete
                              </button>
                            </summary>
                            <div className="report-record-selection-tree-points">
                              {device.regs.map((reg) => (
                                <div key={`selection-point-${device.drId}-${reg.regId}`} className="report-record-selection-tree-point">
                                  <span>{reg.label}</span>
                                  <button type="button" onClick={() => removePointSelection(device.drId, reg.regId)}>
                                    delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div className="report-record-empty is-compact">暂无查询组合</div>
            )}
          </div>

          <div className="report-record-side-block is-point-picker">
            <div className="report-record-side-title">
              <strong>{`${zhCN.reportRecordPage.summaryPoints} ${formatReportRecordCount(selectedRegItems.length)}${zhCN.reportRecordPage.unitPoints}`}</strong>
              <span>{pointCoverage}</span>
            </div>
            <div className="report-record-reg-selection-actions">
              <button
                type="button"
                className="report-record-button"
                onClick={() => updateCurrentRegSelection(uniqueRegOptions.map((item) => String(item.id || "")))}
                disabled={uniqueRegOptions.length === 0}
              >
                {zhCN.reportRecordPage.selectAllRegs}
              </button>
              <button
                type="button"
                className="report-record-button"
                onClick={() => updateCurrentRegSelection([])}
                disabled={uniqueRegOptions.length === 0 || filters.regIds.length === 0}
              >
                {zhCN.reportRecordPage.clearRegs}
              </button>
            </div>
            {uniqueRegOptions.length > 0 ? (
              <div className="report-record-reg-grid">
                {uniqueRegOptions.map((item, index) => {
                  const regId = String(item.id || "");
                  const active = filters.regIds.includes(regId);
                  return (
                    <ReportRecordRegChip
                      key={`reg-option-${regId || "unknown"}-${index + 1}`}
                      active={active}
                      label={item.label || regId}
                      onClick={() => toggleReg(regId)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="report-record-empty is-compact">
                {regError || (filters.drId === "0" ? zhCN.reportRecordPage.regEmptyIdle : zhCN.reportRecordPage.regEmpty)}
              </div>
            )}
          </div>

          <div className="report-record-trace-grid" aria-label={zhCN.reportRecordPage.sectionTrace}>
            <article>
              <span>{zhCN.reportRecordPage.sectionTrace}</span>
              <strong>{queryStatusLabel}</strong>
            </article>
            <article>
              <span>{zhCN.reportRecordPage.tracePointsTitle}</span>
              <strong>{selectedPointsValue}</strong>
            </article>
            <article>
              <span>{zhCN.reportRecordPage.traceNextTitle}</span>
              <strong>{traceNextLabel}</strong>
            </article>
          </div>
        </aside>
      </section>

      <section className="report-record-table-panel" aria-label={zhCN.reportRecordPage.sectionTable}>
        <div className="report-record-table-toolbar">
          <div>
            <strong>{zhCN.reportRecordPage.sectionTable}</strong>
            <span>{`对象汇总字段 · ${formatReportRecordCount(total)}${zhCN.reportRecordPage.unitRows} · 当前第${formatReportRecordCount(currentReportPage)}${zhCN.reportRecordPage.pageLabel}`}</span>
          </div>
          <div className="report-record-table-status">
            <span className={sourceSummary.warn ? "is-warn" : "is-good"}>{bannerText}</span>
            <span>{`${zhCN.reportRecordPage.summaryPoints} ${selectedPointsValue}`}</span>
          </div>
        </div>
        <div className="report-record-table-shell" role="region" aria-label="报表记录汇总表，可横向滚动查看更多字段" tabIndex={0}>
          <table className="report-record-table">
            <colgroup>
              <col className="report-record-summary-col-object" />
              <col className="report-record-summary-col-value" />
              <col className="report-record-summary-col-value" />
              <col className="report-record-summary-col-time" />
              <col className="report-record-summary-col-value" />
              <col className="report-record-summary-col-time" />
              <col className="report-record-summary-col-average" />
            </colgroup>
            <thead>
              <tr>
                {REPORT_RECORD_SUMMARY_COLUMNS.map((column) => (
                  <th key={column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, rowIndex) => (
                  <tr key={`report-summary-row-${rowIndex + 1}`}>
                    {REPORT_RECORD_SUMMARY_COLUMNS.map((column) => (
                      <td key={`report-summary-cell-${rowIndex + 1}-${column.label}`}>
                        {formatCellValue(pickReportRecordCellValue(item, column.keys))}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="report-record-empty-row">
                  <td colSpan={REPORT_RECORD_SUMMARY_COLUMNS.length}>
                    {loading ? zhCN.reportRecordPage.loading : zhCN.reportRecordPage.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="report-record-table-footer">
          <span>{`${zhCN.reportRecordPage.pageSizeLabel} ${formatReportRecordCount(currentPageSize)}${zhCN.reportRecordPage.unitRows} · 动态表头 ${formatReportRecordCount(REPORT_RECORD_SUMMARY_COLUMNS.length)}${zhCN.reportRecordPage.unitColumns}`}</span>
          <div className="report-record-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canGoPrev}>
              {zhCN.reportRecordPage.pagePrev}
            </button>
            <strong>{`${formatReportRecordCount(currentReportPage)} / ${formatReportRecordCount(totalPages)}`}</strong>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={!canGoNext}>
              {zhCN.reportRecordPage.pageNext}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

import { startTransition, useEffect, useRef, useState, type PointerEvent } from "react";
import "./EnergyAnalysisShared.css";
import { ChevronDown } from "lucide-react";
import { runtimeConfig } from "../config/runtimeConfig";
import { formatSourceStatusLineCompact, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, zhCN } from "../i18n/zhCN";
import { getAuthSession, getCurrentProject } from "../services/auth";
import {
  type EnergyAnalysisDto,
  type EnergyAnalysisNodeDto,
  type EnergyAnalysisTreeDto,
  fetchEnergyAnalysis,
  fetchEnergyAnalysisTree
} from "../services/bffClient";

type DateTypeValue = "1" | "2" | "3" | "4";

type FilterState = {
  startDate: string;
  endDate: string;
  dateType: DateTypeValue;
  selectedNodeIds: string[];
};

type QueryState = {
  startDate: string;
  endDate: string;
  dateType: DateTypeValue;
  selectedNodeIds: string[];
  deviceIds: string[];
} | null;

type CompactSourceRow = {
  key: string;
  label: string;
  rows: number | null;
  ok: boolean;
};

const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];
const ENERGY_ANALYSIS_VALUE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2
});
const ENERGY_ANALYSIS_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0
});

function mapLegacyLanguage(): string {
  const locale = getCurrentLocale();
  if (locale === "en-US") {
    return "en";
  }
  if (locale === "vi-VN") {
    return "vie";
  }
  return "zh";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, offset: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function buildInitialFilters(): FilterState {
  const now = new Date();
  return {
    startDate: formatDateInput(addDays(now, -1)),
    endDate: formatDateInput(now),
    dateType: "1",
    selectedNodeIds: []
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

function formatValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return ENERGY_ANALYSIS_VALUE_FORMATTER.format(value);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return ENERGY_ANALYSIS_COUNT_FORMATTER.format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `${Math.round(value)}%`;
}

function formatDateType(value: DateTypeValue | null | undefined): string {
  switch (value) {
    case "2":
      return zhCN.energyAnalysisPage.intervalDay;
    case "3":
      return zhCN.energyAnalysisPage.intervalMonth;
    case "4":
      return zhCN.energyAnalysisPage.intervalYear;
    case "1":
    default:
      return zhCN.energyAnalysisPage.intervalHour;
  }
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function collectDescendantIds(node: EnergyAnalysisNodeDto, bucket: string[] = []): string[] {
  const id = String(node.id || "");
  if (id) {
    bucket.push(id);
  }
  (node.children || []).forEach((child) => collectDescendantIds(child, bucket));
  return bucket;
}

function findNodeById(nodes: EnergyAnalysisNodeDto[], targetId: string): EnergyAnalysisNodeDto | null {
  for (const node of nodes) {
    if (String(node.id || "") === targetId) {
      return node;
    }
    const inChildren = findNodeById(node.children || [], targetId);
    if (inChildren) {
      return inChildren;
    }
  }
  return null;
}

function reconcileNodeSelection(node: EnergyAnalysisNodeDto, selectedSet: Set<string>): boolean {
  const id = String(node.id || "");
  const children = node.children || [];
  if (children.length === 0) {
    return id ? selectedSet.has(id) : false;
  }
  const allChildrenSelected = children.every((child) => reconcileNodeSelection(child, selectedSet));
  if (id) {
    if (allChildrenSelected) {
      selectedSet.add(id);
    } else {
      selectedSet.delete(id);
    }
    return selectedSet.has(id);
  }
  return allChildrenSelected;
}

function reconcileSelection(nodes: EnergyAnalysisNodeDto[], selectedSet: Set<string>): void {
  nodes.forEach((node) => {
    reconcileNodeSelection(node, selectedSet);
  });
}

function toggleNodeSelection(
  nodes: EnergyAnalysisNodeDto[],
  selectedNodeIds: string[],
  targetId: string,
  nextChecked: boolean
): string[] {
  const node = findNodeById(nodes, targetId);
  if (!node) {
    return selectedNodeIds;
  }
  const next = new Set(selectedNodeIds);
  collectDescendantIds(node).forEach((id) => {
    if (nextChecked) {
      next.add(id);
    } else {
      next.delete(id);
    }
  });
  reconcileSelection(nodes, next);
  return Array.from(next);
}

function getNodeCheckState(node: EnergyAnalysisNodeDto, selectedSet: Set<string>): { checked: boolean; partial: boolean } {
  const id = String(node.id || "");
  if (id && selectedSet.has(id)) {
    return { checked: true, partial: false };
  }
  const children = node.children || [];
  if (children.length === 0) {
    return { checked: false, partial: false };
  }
  const hasAnyChild = children.some((child) => {
    const childState = getNodeCheckState(child, selectedSet);
    return childState.checked || childState.partial;
  });
  return {
    checked: false,
    partial: hasAnyChild
  };
}

function collectSelectionRoots(
  nodes: EnergyAnalysisNodeDto[],
  selectedSet: Set<string>,
  ancestorSelected = false,
  bucket: EnergyAnalysisNodeDto[] = []
): EnergyAnalysisNodeDto[] {
  nodes.forEach((node) => {
    const id = String(node.id || "");
    const checked = id ? selectedSet.has(id) : false;
    if (checked && !ancestorSelected) {
      bucket.push(node);
      return;
    }
    collectSelectionRoots(node.children || [], selectedSet, ancestorSelected || checked, bucket);
  });
  return bucket;
}

function collectLeafDevices(node: EnergyAnalysisNodeDto, bucket: EnergyAnalysisNodeDto[] = []): EnergyAnalysisNodeDto[] {
  if (node.nodeType === "device" && node.deviceId) {
    bucket.push(node);
    return bucket;
  }
  (node.children || []).forEach((child) => collectLeafDevices(child, bucket));
  return bucket;
}

function dedupeDeviceNodes(nodes: EnergyAnalysisNodeDto[]): EnergyAnalysisNodeDto[] {
  const map = new Map<string, EnergyAnalysisNodeDto>();
  nodes.forEach((node) => {
    const deviceId = String(node.deviceId || "");
    if (deviceId && !map.has(deviceId)) {
      map.set(deviceId, node);
    }
  });
  return Array.from(map.values());
}

function resolveSelectedDevices(selectionRoots: EnergyAnalysisNodeDto[]): EnergyAnalysisNodeDto[] {
  const devices = selectionRoots.flatMap((node) => collectLeafDevices(node));
  return dedupeDeviceNodes(devices);
}

function buildQuery(filters: FilterState, treeItems: EnergyAnalysisNodeDto[]): QueryState {
  const selectedSet = new Set(filters.selectedNodeIds);
  const selectionRoots = collectSelectionRoots(treeItems, selectedSet);
  const devices = resolveSelectedDevices(selectionRoots);
  const selectedNodeIds = selectionRoots.map((node) => String(node.id || "")).filter(Boolean);
  const deviceIds = devices.map((node) => String(node.deviceId || "")).filter(Boolean);

  if (deviceIds.length === 0) {
    return null;
  }

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    dateType: filters.dateType,
    selectedNodeIds,
    deviceIds
  };
}

function buildDefaultSelection(treeItems: EnergyAnalysisNodeDto[]): string[] {
  const firstRoot = treeItems[0];
  return firstRoot ? collectDescendantIds(firstRoot) : [];
}

function collectExpandableNodeIds(nodes: EnergyAnalysisNodeDto[], bucket: string[] = []): string[] {
  nodes.forEach((node, index) => {
    const children = node.children || [];
    const nodeId = String(node.id || `node-${index + 1}`);
    if (children.length > 0 && nodeId) {
      bucket.push(nodeId);
      collectExpandableNodeIds(children, bucket);
    }
  });
  return bucket;
}

function buildCsvContent(data: EnergyAnalysisDto): string {
  const series = data.series || [];
  const axisLabels = data.axisLabels || [];
  const maxLength = Math.max(0, ...series.map((item) => item.points?.length || 0));
  const header = [zhCN.energyAnalysisPage.exportTimeColumn, ...series.map((item) => item.name || zhCN.common.unknown)];
  const rows = Array.from({ length: maxLength }, (_unused, index) => {
    const timeLabel = axisLabels[index] || series[0]?.points?.[index]?.label || `point-${index + 1}`;
    return [
      timeLabel,
      ...series.map((item) => formatValue(item.points?.[index]?.value ?? null))
    ];
  });

  return `\uFEFF${[header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

function hasVisibleEnergyAnalysisSeriesValue(series: NonNullable<EnergyAnalysisDto["series"]>[number]): boolean {
  return (series.points || []).some((point) => (
    typeof point.value === "number" && point.value > 0.1
  ));
}

function isFiniteEnergyValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNegativeEnergyValue(value: number | null | undefined): boolean {
  return isFiniteEnergyValue(value) && value < -0.001;
}

function countNegativeEnergyEvidence(data: EnergyAnalysisDto | null): number {
  const summaryValues = (data?.summaries || []).flatMap((row) => [
    row.sumValue,
    row.maxValue,
    row.minValue,
    row.average
  ]);
  const seriesValues = (data?.series || []).flatMap((series) => (
    (series.points || []).map((point) => point.value)
  ));
  return [...summaryValues, ...seriesValues].filter(isNegativeEnergyValue).length;
}

function formatEnergyEvidenceValue(value: number | null | undefined): string {
  const formatted = formatValue(value);
  return isNegativeEnergyValue(value) ? `待核 ${formatted}` : formatted;
}

function sumSeriesPoints(series: NonNullable<EnergyAnalysisDto["series"]>[number]): number | null {
  const total = (series.points || []).reduce((sum, point) => (
    isFiniteEnergyValue(point.value) ? sum + point.value : sum
  ), 0);
  return total > 0 ? total : null;
}

function resolveEnergyUnit(data: EnergyAnalysisDto | null): string {
  return data?.unit || data?.summaries?.find((row) => row.unit)?.unit || "--";
}

function resolveGlobalEnergyStats(data: EnergyAnalysisDto | null) {
  const summaries = data?.summaries || [];
  const series = data?.series || [];
  const summaryTotals = summaries.map((row) => row.sumValue).filter(isFiniteEnergyValue);
  const seriesTotals = series.map(sumSeriesPoints).filter(isFiniteEnergyValue);
  const totalValue =
    summaryTotals.length > 0
      ? summaryTotals.reduce((sum, value) => sum + value, 0)
      : (seriesTotals.length > 0 ? seriesTotals.reduce((sum, value) => sum + value, 0) : null);
  const peakRow = summaries
    .filter((row) => isFiniteEnergyValue(row.maxValue))
    .sort((a, b) => (b.maxValue || 0) - (a.maxValue || 0))[0] || null;
  const valleyRow = summaries
    .filter((row) => isFiniteEnergyValue(row.minValue))
    .sort((a, b) => (a.minValue || 0) - (b.minValue || 0))[0] || null;
  const averages = summaries.map((row) => row.average).filter(isFiniteEnergyValue);
  const averageValue =
    averages.length > 0
      ? averages.reduce((sum, value) => sum + value, 0) / averages.length
      : null;
  const majorRow = summaries
    .filter((row) => isFiniteEnergyValue(row.sumValue))
    .sort((a, b) => (b.sumValue || 0) - (a.sumValue || 0))[0] || null;

  return {
    totalValue,
    peakValue: peakRow?.maxValue ?? null,
    peakTime: peakRow?.maxTime || "--",
    peakObject: peakRow?.objectName || "--",
    valleyValue: valleyRow?.minValue ?? null,
    valleyTime: valleyRow?.minTime || "--",
    valleyObject: valleyRow?.objectName || "--",
    averageValue,
    majorObject: majorRow?.objectName || "--"
  };
}

function buildEnergyStructureRows(data: EnergyAnalysisDto | null) {
  const summaryRows = (data?.summaries || [])
    .map((row) => ({
      id: row.id || row.objectName || "",
      name: row.objectName || zhCN.common.unknown,
      value: row.sumValue
    }))
    .filter((row): row is { id: string; name: string; value: number } => isFiniteEnergyValue(row.value) && row.value > 0);
  const rows = summaryRows.length > 0
    ? summaryRows
    : (data?.series || [])
        .map((item) => ({
          id: item.id || item.name || "",
          name: item.name || zhCN.common.unknown,
          value: sumSeriesPoints(item)
        }))
        .filter((row): row is { id: string; name: string; value: number } => isFiniteEnergyValue(row.value) && row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((row) => ({
      ...row,
      percent: total > 0 ? (row.value / total) * 100 : null
    }));
}

function EnergyAnalysisTrendChart({
  data,
  loadError
}: {
  data: EnergyAnalysisDto | null;
  loadError: string | null;
}) {
  const rawSeries = data?.series || [];
  const series = rawSeries.filter(hasVisibleEnergyAnalysisSeriesValue);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const numericValues = series
    .flatMap((item) => (item.points || []).map((point) => point.value))
    .filter((value): value is number => typeof value === "number");

  if (series.length === 0 || numericValues.length === 0) {
    const hiddenZeroSeries = rawSeries.length > 0 && series.length === 0;
    return (
      <div className="trend-panel">
        {loadError ? <p className="empty-hint">{loadError}</p> : null}
        <p className="empty-hint">
          {hiddenZeroSeries ? "当前范围曲线值过低，暂无可展示曲线。" : zhCN.energyAnalysisPage.chartEmpty}
        </p>
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
              y: toY(value),
              color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length]
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  function handleChartPointerMove(event: PointerEvent<HTMLDivElement>) {
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
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label={zhCN.energyAnalysisPage.chartAriaLabel}>
        <div className="energy-analysis-y-axis" aria-hidden="true">
          {yTicks.map((tick) => (
            <span key={`${tick.top}-${tick.value}`} style={{ top: `${tick.top}%` }}>
              {formatValue(tick.value)}
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
                    <b>{formatValue(item.value)}</b>
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

export default function EnergyAnalysisPage() {
  const initialFiltersRef = useRef<FilterState>(buildInitialFilters());
  const intervalDropdownRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFiltersRef.current);
  const [query, setQuery] = useState<QueryState>(null);
  const [tree, setTree] = useState<EnergyAnalysisTreeDto | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [data, setData] = useState<EnergyAnalysisDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isIntervalDropdownOpen, setIsIntervalDropdownOpen] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const initialAutoLoadedRef = useRef(false);

  const currentProject = getCurrentProject(getAuthSession());
  const projectSignature = [
    currentProject?.siteId || "",
    currentProject?.siteCode || "",
    currentProject?.databaseKey || "",
    currentProject?.modelKey || "",
    currentProject?.template || ""
  ].join("|");

  useEffect(() => {
    if (!isIntervalDropdownOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && intervalDropdownRef.current?.contains(target)) {
        return;
      }
      setIsIntervalDropdownOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isIntervalDropdownOpen]);

  const requestLanguage = mapLegacyLanguage();

  useEffect(() => {
    let active = true;
    initialAutoLoadedRef.current = false;
    startTransition(() => {
      setTree(null);
      setData(null);
      setQuery(null);
      setTreeError(null);
      setLoadError(null);
      setExportError(null);
      setFilters((current) => ({
        ...current,
        selectedNodeIds: []
      }));
    });

    async function loadTree() {
      try {
        const result = await fetchEnergyAnalysisTree(runtimeConfig.siteId, {
          language: requestLanguage
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setTree(result);
          setTreeError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setTree(null);
          setTreeError(zhCN.energyAnalysisPage.treeLoadFailed);
        });
      }
    }

    loadTree();
    return () => {
      active = false;
    };
  }, [requestLanguage, projectSignature]);

  const treeItems = tree?.items || [];

  useEffect(() => {
    const nextIds = collectExpandableNodeIds(treeItems);
    setExpandedNodeIds((current) => {
      if (current.size === nextIds.length && nextIds.every((id) => current.has(id))) {
        return current;
      }
      return new Set(nextIds);
    });
  }, [treeItems]);

  useEffect(() => {
    if (initialAutoLoadedRef.current || treeItems.length === 0) {
      return;
    }
    const nextFilters = {
      ...buildInitialFilters(),
      selectedNodeIds: buildDefaultSelection(treeItems)
    };
    const nextQuery = buildQuery(nextFilters, treeItems);
    initialAutoLoadedRef.current = true;
    startTransition(() => {
      setFilters(nextFilters);
      setQuery(nextQuery);
      setLoadError(null);
      setExportError(null);
    });
  }, [treeItems]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!query) {
        return;
      }
      setLoading(true);
      try {
        const result = await fetchEnergyAnalysis(runtimeConfig.siteId, {
          ...query,
          language: requestLanguage
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
          setLoadError(zhCN.energyAnalysisPage.degraded);
          setLoading(false);
        });
      }
    }

    loadReport();
    return () => {
      active = false;
    };
  }, [query, requestLanguage]);

  const selectedSet = new Set(filters.selectedNodeIds);
  const selectedRoots = collectSelectionRoots(treeItems, selectedSet);
  const selectedDevices = resolveSelectedDevices(selectedRoots);
  const querySet = new Set(query?.selectedNodeIds || []);
  const queriedDevices = resolveSelectedDevices(collectSelectionRoots(treeItems, querySet));
  const sourceSummary = summarizeSourceStatus([tree?.sourceStatus, data?.sourceStatus]);
  const negativeEnergyEvidenceCount = countNegativeEnergyEvidence(data);
  const energyStatisticsReady = Boolean(data && negativeEnergyEvidenceCount === 0);
  const energyQualityWarning = negativeEnergyEvidenceCount > 0
    ? `检测到 ${formatCount(negativeEnergyEvidenceCount)} 个负能耗值，已停止总量、峰谷和平均值判读；曲线与明细仅保留用于数据排查。`
    : null;
  const bannerText =
    exportError
    || loadError
    || treeError
    || energyQualityWarning
    || (loading ? zhCN.energyAnalysisPage.loading : sourceSummary.text);
  const sourceStateLabel = energyQualityWarning
    ? "数据异常"
    : sourceSummary.warn
      ? zhCN.energyAnalysisPage.stateFallback
      : zhCN.energyAnalysisPage.stateReady;
  const intervalLabel = formatDateType(filters.dateType);
  const intervalOptions: Array<{ value: DateTypeValue; label: string }> = [
    { value: "1", label: zhCN.energyAnalysisPage.intervalHour },
    { value: "2", label: zhCN.energyAnalysisPage.intervalDay },
    { value: "3", label: zhCN.energyAnalysisPage.intervalMonth },
    { value: "4", label: zhCN.energyAnalysisPage.intervalYear }
  ];
  const queryIntervalLabel = formatDateType(query?.dateType || filters.dateType);
  const latestFetchText = formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp);
  const energyStats = resolveGlobalEnergyStats(data);
  const energyUnit = resolveEnergyUnit(data);
  const energyStructureRows = buildEnergyStructureRows(data);
  const objectCount = data?.series?.length || data?.summaries?.length || 0;
  const sourceRows: CompactSourceRow[] = [
    ...(tree?.sourceStatus?.sources || []),
    ...(data?.sourceStatus?.sources || [])
  ].slice(0, 3).map((item, index) => ({
    key: item.key || item.interfaceKind || item.originLabel || `source-${index + 1}`,
    label: formatSourceStatusLineCompact(item),
    rows: typeof item.rows === "number" ? item.rows : null,
    ok: item.ok !== false && item.fallback !== true
  }));
  const commandTags: Array<{ label: string; value: string }> = [
    { label: zhCN.energyAnalysisPage.filterStartDate, value: filters.startDate || "--" },
    { label: zhCN.energyAnalysisPage.filterEndDate, value: filters.endDate || "--" },
    { label: zhCN.energyAnalysisPage.filterDateType, value: intervalLabel },
    { label: zhCN.energyAnalysisPage.selectionDevicesLabel, value: `${formatCount(selectedDevices.length)}${zhCN.energyAnalysisPage.unitDevices}` }
  ];
  const metricCards = [
    {
      title: zhCN.energyAnalysisPage.summaryObjects,
      value: `${formatCount(objectCount)}${zhCN.energyAnalysisPage.unitObjects}`,
      detail: "统计曲线对象",
      tone: "good"
    },
    {
      title: zhCN.energyAnalysisPage.selectionDevicesLabel,
      value: `${formatCount(selectedDevices.length)}${zhCN.energyAnalysisPage.unitDevices}`,
      detail: "设备树叶子节点",
      tone: "neutral"
    },
    {
      title: "总能耗",
      value: energyStatisticsReady ? formatValue(energyStats.totalValue) : "不可用",
      detail: energyStatisticsReady ? `${energyUnit}，当前范围` : "负值待核，停止判读",
      tone: energyStatisticsReady ? "good" : "warn"
    },
    {
      title: zhCN.energyAnalysisPage.tablePeak,
      value: energyStatisticsReady ? formatValue(energyStats.peakValue) : "不可用",
      detail: energyStatisticsReady ? energyStats.peakTime : "负值待核，停止判读",
      tone: "warn"
    },
    {
      title: zhCN.energyAnalysisPage.tableValley,
      value: energyStatisticsReady ? formatValue(energyStats.valleyValue) : "不可用",
      detail: energyStatisticsReady ? energyStats.valleyTime : "负值待核，停止判读",
      tone: energyStatisticsReady ? "neutral" : "warn"
    },
    {
      title: zhCN.energyAnalysisPage.tableAverage,
      value: energyStatisticsReady ? formatValue(energyStats.averageValue) : "不可用",
      detail: energyStatisticsReady
        ? (energyUnit === "--" ? "--" : `${energyUnit} / ${queryIntervalLabel}`)
        : "负值待核，停止判读",
      tone: energyStatisticsReady ? "neutral" : "warn"
    }
  ];

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
    setLoadError(null);
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

  function handleNodeToggle(nodeId: string, nextChecked: boolean) {
    const nextSelectedIds = toggleNodeSelection(treeItems, filters.selectedNodeIds, nodeId, nextChecked);
    setFilters((current) => ({
      ...current,
      selectedNodeIds: nextSelectedIds
    }));
    setExportError(null);
    setLoadError(null);
  }

  function handleNodeExpandToggle(nodeId: string) {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function handleSearch() {
    setIsIntervalDropdownOpen(false);
    if (filters.startDate > filters.endDate) {
      setLoadError(zhCN.energyAnalysisPage.invalidRange);
      return;
    }
    const nextQuery = buildQuery(filters, treeItems);
    if (!nextQuery) {
      setLoadError(zhCN.energyAnalysisPage.selectionRequired);
      return;
    }
    setQuery(nextQuery);
    setExportError(null);
    setLoadError(null);
  }

  function handleReset() {
    setIsIntervalDropdownOpen(false);
    const nextFilters = {
      ...buildInitialFilters(),
      selectedNodeIds: buildDefaultSelection(treeItems)
    };
    setFilters(nextFilters);
    setQuery(buildQuery(nextFilters, treeItems));
    setExportError(null);
    setLoadError(null);
  }

  function handleExport() {
    setIsIntervalDropdownOpen(false);
    if (!data || (data.series?.length || 0) === 0) {
      setExportError(zhCN.energyAnalysisPage.exportEmpty);
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const csv = buildCsvContent(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zhCN.energyAnalysisPage.exportFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setExportError(zhCN.energyAnalysisPage.exportFailed);
      });
    }
  }

  function renderTree(nodes: EnergyAnalysisNodeDto[]) {
    return (
      <ul className="energy-analysis-tree-list">
        {nodes.map((node, index) => {
          const nodeId = String(node.id || `node-${index + 1}`);
          const state = getNodeCheckState(node, selectedSet);
          const hasChildren = (node.children?.length || 0) > 0;
          const isExpanded = hasChildren && expandedNodeIds.has(nodeId);
          return (
            <li key={nodeId}>
              <div
                className={`energy-analysis-tree-node is-${node.nodeType || "unknown"}${hasChildren ? " has-children" : ""}${isExpanded ? " is-expanded" : " is-collapsed"}`}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className={`energy-analysis-tree-toggle${isExpanded ? " is-expanded" : ""}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleNodeExpandToggle(nodeId);
                    }}
                    aria-label={isExpanded ? "折叠节点" : "展开节点"}
                    aria-expanded={isExpanded}
                  >
                    <span className="energy-analysis-tree-toggle-icon" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="energy-analysis-tree-toggle is-placeholder" aria-hidden="true" />
                )}
                <label className="energy-analysis-tree-check">
                  <input
                    type="checkbox"
                    checked={state.checked}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = state.partial;
                      }
                    }}
                    onChange={(event) => handleNodeToggle(nodeId, event.target.checked)}
                  />
                  <span className="energy-analysis-tree-label">{node.label || zhCN.common.unknown}</span>
                </label>
                {typeof node.deviceCount === "number" && node.deviceCount > 0 ? (
                  <span className="energy-analysis-tree-count">
                    {formatCount(node.deviceCount)}
                    {zhCN.energyAnalysisPage.unitDevices}
                  </span>
                ) : null}
              </div>
              {hasChildren && isExpanded ? renderTree(node.children || []) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div
      className="energy-analysis-compact-page-v2 page-enter"
      data-energy-analysis-quality={energyStatisticsReady ? "ready" : negativeEnergyEvidenceCount > 0 ? "invalid" : "pending"}
    >
      <section className="energy-analysis-compact-hero">
        <div className="energy-analysis-compact-hero-copy">
          <span className="energy-analysis-compact-label">{runtimeConfig.appModeLabel}</span>
          <h1>{zhCN.energyAnalysisPage.heading}</h1>
          <div className="energy-analysis-compact-tags" aria-label={zhCN.energyAnalysisPage.sectionFilters}>
            {commandTags.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        </div>
        <aside className={`energy-analysis-compact-status${energyQualityWarning ? " is-quality-invalid" : ""}`} aria-label={zhCN.energyAnalysisPage.summaryState}>
          <span className="energy-analysis-compact-label">{zhCN.energyAnalysisPage.summaryState}</span>
          <strong>{sourceStateLabel}</strong>
          <p>{bannerText}</p>
        </aside>
      </section>

      <section className="energy-analysis-compact-metrics" aria-label={zhCN.energyAnalysisPage.sectionSummary}>
        {metricCards.map((item) => (
          <article key={item.title} className={`energy-analysis-compact-metric is-${item.tone}`}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="energy-analysis-compact-workspace" aria-label="能耗分析工作台">
        <article className="energy-analysis-compact-panel">
          <header className="energy-analysis-compact-panel-head">
            <h3>设备树与查询</h3>
            <span>{`${formatCount(treeItems.length)} 类 / ${formatCount(selectedDevices.length)}${zhCN.energyAnalysisPage.unitDevices}`}</span>
          </header>
          <div className="energy-analysis-compact-panel-body">
            <div className="energy-analysis-compact-filter-grid">
              <label className="energy-analysis-field">
                <span>{zhCN.energyAnalysisPage.filterStartDate}</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => updateFilter("startDate", event.target.value)}
                  onClick={(event) => openDatePicker(event.currentTarget)}
                />
              </label>
              <label className="energy-analysis-field">
                <span>{zhCN.energyAnalysisPage.filterEndDate}</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => updateFilter("endDate", event.target.value)}
                  onClick={(event) => openDatePicker(event.currentTarget)}
                />
              </label>
              <label className="energy-analysis-field is-wide">
                <span>{zhCN.energyAnalysisPage.filterDateType}</span>
                <div
                  className={`energy-analysis-select${isIntervalDropdownOpen ? " is-open" : ""}`}
                  ref={intervalDropdownRef}
                >
                  <button
                    type="button"
                    className={`energy-analysis-select-trigger${isIntervalDropdownOpen ? " is-open" : ""}`}
                    onClick={() => setIsIntervalDropdownOpen((current) => !current)}
                    aria-haspopup="listbox"
                    aria-expanded={isIntervalDropdownOpen}
                    aria-controls="energy-analysis-interval-listbox"
                  >
                    <span className="energy-analysis-select-trigger-text">{intervalLabel}</span>
                    <ChevronDown className="energy-analysis-select-caret" size={14} aria-hidden="true" />
                  </button>
                  {isIntervalDropdownOpen ? (
                    <div
                      id="energy-analysis-interval-listbox"
                      className="energy-analysis-select-menu"
                      role="listbox"
                      aria-label={zhCN.energyAnalysisPage.filterDateType}
                    >
                      {intervalOptions.map((item) => {
                        const isActive = item.value === filters.dateType;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`energy-analysis-select-option${isActive ? " is-active" : ""}`}
                            onClick={() => {
                              updateFilter("dateType", item.value);
                              setIsIntervalDropdownOpen(false);
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
            </div>
            <div className="energy-analysis-actions">
              <button type="button" className="energy-analysis-button is-primary" onClick={handleSearch}>
                {zhCN.energyAnalysisPage.search}
              </button>
              <button type="button" className="energy-analysis-button" onClick={handleReset}>
                {zhCN.energyAnalysisPage.reset}
              </button>
              <button type="button" className="energy-analysis-button" onClick={handleExport}>
                {exporting ? zhCN.energyAnalysisPage.exporting : zhCN.energyAnalysisPage.export}
              </button>
            </div>
            <div className="energy-analysis-compact-tree-shell">
              {treeError ? (
                <p className="empty-hint">{treeError}</p>
              ) : treeItems.length === 0 ? (
                <p className="empty-hint">{zhCN.energyAnalysisPage.treeLoading}</p>
              ) : (
                renderTree(treeItems)
              )}
            </div>
          </div>
        </article>

        <article className="energy-analysis-compact-panel energy-analysis-compact-chart-panel">
          <header className="energy-analysis-compact-panel-head">
            <h3>{zhCN.energyAnalysisPage.sectionChart}</h3>
            <span>{`${zhCN.energyAnalysisPage.rangeLatestFetch} ${latestFetchText}`}</span>
          </header>
          <div className="energy-analysis-compact-panel-body">
            <div className="energy-analysis-compact-chart-top">
              <article><span>{zhCN.energyAnalysisPage.chartRangeLabel}</span><strong>{energyStatisticsReady ? `${formatValue(energyStats.valleyValue)} / ${formatValue(energyStats.peakValue)}` : "不可用"}</strong></article>
              <article><span>{zhCN.energyAnalysisPage.rangeUnitLabel}</span><strong>{energyUnit}</strong></article>
              <article><span>返回对象</span><strong>{`${formatCount(objectCount)}${zhCN.energyAnalysisPage.unitObjects}`}</strong></article>
              <article><span>聚合粒度</span><strong>{queryIntervalLabel}</strong></article>
            </div>
            <div className="energy-analysis-compact-chart-box">
              <div className="energy-analysis-compact-chart-head">
                <strong>多序列趋势</strong>
                <span>{`${zhCN.energyAnalysisPage.rangeSelectionLabel}${formatCount(queriedDevices.length)}${zhCN.energyAnalysisPage.unitDevices}`}</span>
              </div>
              <EnergyAnalysisTrendChart data={data} loadError={loadError} />
            </div>
            <div className="energy-analysis-compact-rank-grid">
              <article><span>峰值对象</span><strong>{energyStatisticsReady ? energyStats.peakObject : "待核"}</strong></article>
              <article><span>谷值对象</span><strong>{energyStatisticsReady ? energyStats.valleyObject : "待核"}</strong></article>
              <article><span>最大占比</span><strong>{energyStatisticsReady ? energyStats.majorObject : "待核"}</strong></article>
            </div>
          </div>
        </article>

        <article className="energy-analysis-compact-panel">
          <header className="energy-analysis-compact-panel-head">
            <h3>来源与结构</h3>
            <span>只读</span>
          </header>
          <div className="energy-analysis-compact-panel-body">
            <div className="energy-analysis-compact-source-list">
              {(sourceRows.length > 0 ? sourceRows : [
                {
                  key: "energy-analysis",
                  label: `能耗曲线：${sourceSummary.warn ? "需复核" : "正常"}`,
                  rows: objectCount,
                  ok: !sourceSummary.warn
                }
              ]).map((item, index) => (
                <article key={`${item.key || index}`} className="energy-analysis-compact-source-row">
                  <span>
                    <strong>{item.label || "数据来源"}</strong>
                    <small>{typeof item.rows === "number" ? `${formatCount(item.rows)} 行` : "行数未知"}</small>
                  </span>
                  <em className={item.ok === false ? "is-warn" : "is-good"}>{item.ok === false ? "复核" : "正常"}</em>
                </article>
              ))}
              <article className="energy-analysis-compact-source-row">
                <span>
                  <strong>导出边界</strong>
                  <small>CSV 按当前查询结果导出</small>
                </span>
                <em className="is-good">可用</em>
              </article>
            </div>
            <div className="energy-analysis-compact-structure">
              {energyStructureRows.length > 0 ? energyStructureRows.map((item) => (
                <div key={item.id || item.name} className="energy-analysis-compact-bar-row">
                  <span>{item.name}</span>
                  <div className="energy-analysis-compact-bar-track">
                    <div style={{ width: `${Math.max(3, Math.min(100, item.percent || 0))}%` }} />
                  </div>
                  <b>{formatPercent(item.percent)}</b>
                </div>
              )) : (
                <div className="energy-analysis-compact-empty">暂无结构占比</div>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="energy-analysis-compact-panel energy-analysis-compact-table-panel">
        <header className="energy-analysis-compact-panel-head">
          <h3>{zhCN.energyAnalysisPage.sectionTable}</h3>
          <span>{`${zhCN.energyAnalysisPage.rangeLatestFetch} ${latestFetchText} · ${zhCN.energyAnalysisPage.rangeUnitLabel} ${energyUnit} · 汇总 ${formatCount(data?.summaries?.length || 0)} 项`}</span>
        </header>
        <div className="energy-analysis-compact-table-wrap" role="region" aria-label="能耗分析汇总表，可横向滚动查看更多字段" tabIndex={0}>
          <table className="energy-analysis-compact-table">
            <colgroup>
              <col className="energy-analysis-table-col-object" />
              <col className="energy-analysis-table-col-number" />
              <col className="energy-analysis-table-col-number" />
              <col className="energy-analysis-table-col-time" />
              <col className="energy-analysis-table-col-number" />
              <col className="energy-analysis-table-col-time" />
              <col className="energy-analysis-table-col-number" />
            </colgroup>
            <thead>
              <tr>
                <th>{zhCN.energyAnalysisPage.tableObject}</th>
                <th>{zhCN.energyAnalysisPage.tableTotal}</th>
                <th>{zhCN.energyAnalysisPage.tablePeak}</th>
                <th>{zhCN.energyAnalysisPage.tablePeakTime}</th>
                <th>{zhCN.energyAnalysisPage.tableValley}</th>
                <th>{zhCN.energyAnalysisPage.tableValleyTime}</th>
                <th>{zhCN.energyAnalysisPage.tableAverage}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.summaries || []).length > 0 ? (
                (data?.summaries || []).map((row, index) => (
                  <tr
                    key={row.id || `${row.objectName || "summary"}-${index + 1}`}
                    className={[row.sumValue, row.maxValue, row.minValue, row.average].some(isNegativeEnergyValue) ? "is-data-invalid" : undefined}
                  >
                    <td>{row.objectName || "--"}</td>
                    <td>{formatEnergyEvidenceValue(row.sumValue)}</td>
                    <td>{formatEnergyEvidenceValue(row.maxValue)}</td>
                    <td>{row.maxTime || "--"}</td>
                    <td>{formatEnergyEvidenceValue(row.minValue)}</td>
                    <td>{row.minTime || "--"}</td>
                    <td>{formatEnergyEvidenceValue(row.average)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="energy-analysis-empty-inline">
                    {loading ? zhCN.energyAnalysisPage.loading : "暂无统计结果"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="energy-analysis-compact-boundary" aria-label="能耗分析边界">
        <article><span>统计口径</span><strong>按设备树选择 + 时间间隔聚合</strong></article>
        <article><span>查询边界</span><strong>开始日期 ≤ 结束日期</strong></article>
        <article><span>导出内容</span><strong>时间列 + 全部对象曲线</strong></article>
        <article><span>页面边界</span><strong>只读分析，不写入现场</strong></article>
      </section>
    </div>
  );
}

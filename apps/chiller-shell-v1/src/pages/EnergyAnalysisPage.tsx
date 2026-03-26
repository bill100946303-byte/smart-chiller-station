import { startTransition, useEffect, useRef, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
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

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

const SERIES_COLORS = ["#63e6ff", "#8ff7d7", "#6fa7ff", "#ffd28b", "#ff8cc6", "#9aa8ff", "#4fd9b8", "#ffb574"];

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
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
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

function buildSummaryCards(
  data: EnergyAnalysisDto | null,
  query: QueryState,
  selectedDeviceCount: number
): SummaryCard[] {
  const seriesCount = data?.series?.length || 0;
  const sourceReady = data?.sourceStatus?.overall === "ok";
  return [
    {
      title: zhCN.energyAnalysisPage.summaryObjects,
      value: String(seriesCount),
      unit: zhCN.energyAnalysisPage.unitObjects,
      delta: zhCN.energyAnalysisPage.summaryFilterHint,
      tone: seriesCount > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.energyAnalysisPage.summaryDevices,
      value: String(selectedDeviceCount),
      unit: zhCN.energyAnalysisPage.unitDevices,
      delta: zhCN.energyAnalysisPage.summaryFilterHint,
      tone: selectedDeviceCount > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.energyAnalysisPage.summaryRange,
      value: `${query?.startDate || "--"} ~ ${query?.endDate || "--"}`,
      unit: "",
      delta: zhCN.energyAnalysisPage.summaryIntervalPrefix + getDateTypeLabel(query?.dateType || "1"),
      tone: "neutral"
    },
    {
      title: zhCN.energyAnalysisPage.summaryState,
      value: sourceReady ? zhCN.energyAnalysisPage.stateReady : zhCN.energyAnalysisPage.stateFallback,
      unit: "",
      delta: zhCN.energyAnalysisPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function getDateTypeLabel(dateType: string): string {
  switch (dateType) {
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

function EnergyAnalysisTrendChart({
  data,
  loadError
}: {
  data: EnergyAnalysisDto | null;
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
        <p className="empty-hint">{zhCN.energyAnalysisPage.chartEmpty}</p>
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
          <strong>{`${formatValue(globalMin)} / ${formatValue(globalMax)}`}</strong>
          <p>{zhCN.energyAnalysisPage.chartRangeLabel}</p>
        </div>
        <div>
          <strong>{series.length}</strong>
          <p>{zhCN.energyAnalysisPage.summaryObjects}</p>
        </div>
      </div>
      {loadError ? <p className="empty-hint">{loadError}</p> : null}
      <div className="trend-chart-shell" aria-label={zhCN.energyAnalysisPage.chartAriaLabel}>
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
      <div className="energy-analysis-legend">
        {series.map((item, index) => (
          <div key={item.id || `legend-${index + 1}`} className="energy-analysis-legend-item">
            <span
              className="energy-analysis-legend-dot"
              style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <div>
              <strong>{item.name || zhCN.common.unknown}</strong>
              <p>{formatValue(item.points?.[(item.points?.length || 1) - 1]?.value ?? null)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnergyAnalysisPage() {
  const initialFiltersRef = useRef<FilterState>(buildInitialFilters());
  const [filters, setFilters] = useState<FilterState>(initialFiltersRef.current);
  const [query, setQuery] = useState<QueryState>(null);
  const [tree, setTree] = useState<EnergyAnalysisTreeDto | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [data, setData] = useState<EnergyAnalysisDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const initialAutoLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadTree() {
      try {
        const result = await fetchEnergyAnalysisTree(runtimeConfig.siteId);
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
  }, []);

  const treeItems = tree?.items || [];

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
        const result = await fetchEnergyAnalysis(runtimeConfig.siteId, query);
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
  }, [query]);

  const selectedSet = new Set(filters.selectedNodeIds);
  const selectedRoots = collectSelectionRoots(treeItems, selectedSet);
  const selectedDevices = resolveSelectedDevices(selectedRoots);
  const querySet = new Set(query?.selectedNodeIds || []);
  const queriedDevices = resolveSelectedDevices(collectSelectionRoots(treeItems, querySet));
  const summaryCards = buildSummaryCards(data, query, queriedDevices.length);
  const sourceSummary = summarizeSourceStatus([tree?.sourceStatus, data?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([tree?.sourceStatus, data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([tree?.sourceStatus, data?.sourceStatus], {
    labelMode: "short"
  });
  const bannerText =
    exportError
    || loadError
    || treeError
    || (loading ? zhCN.energyAnalysisPage.loading : sourceSummary.text);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
    setLoadError(null);
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

  function handleSearch() {
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

  function renderSelectionChips(nodes: EnergyAnalysisNodeDto[], emptyText: string) {
    if (nodes.length === 0) {
      return <p className="energy-analysis-empty-inline">{emptyText}</p>;
    }
    const visibleNodes = nodes.slice(0, 12);
    const overflow = nodes.length - visibleNodes.length;
      return (
      <div className="energy-analysis-chip-list">
        {visibleNodes.map((node, index) => (
          <span key={String(node.id || `${node.label || "chip"}-${index + 1}`)} className="energy-analysis-chip">
            {node.label || zhCN.common.unknown}
          </span>
        ))}
        {overflow > 0 ? <span className="energy-analysis-chip muted">+{overflow}</span> : null}
      </div>
    );
  }

  function renderTree(nodes: EnergyAnalysisNodeDto[]) {
    return (
      <ul className="energy-analysis-tree-list">
        {nodes.map((node, index) => {
          const nodeId = String(node.id || `node-${index + 1}`);
          const state = getNodeCheckState(node, selectedSet);
          return (
            <li key={nodeId}>
              <label className={`energy-analysis-tree-node is-${node.nodeType || "unknown"}`}>
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
                {typeof node.deviceCount === "number" && node.deviceCount > 0 ? (
                  <span className="energy-analysis-tree-count">
                    {node.deviceCount}
                    {zhCN.energyAnalysisPage.unitDevices}
                  </span>
                ) : null}
              </label>
              {(node.children?.length || 0) > 0 ? renderTree(node.children || []) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="energy-analysis-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(treeError || loadError || exportError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="energy-analysis-header">
        <h2>{zhCN.energyAnalysisPage.heading}</h2>
        <p>{zhCN.energyAnalysisPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.energyAnalysisPage.sectionTree}>
        <div className="energy-analysis-tree-grid">
          <div className="energy-analysis-tree-shell">
            <p className="energy-analysis-tree-hint">{zhCN.energyAnalysisPage.treeHint}</p>
            {treeError ? (
              <p className="empty-hint">{treeError}</p>
            ) : treeItems.length === 0 ? (
              <p className="empty-hint">{zhCN.energyAnalysisPage.treeLoading}</p>
            ) : (
              renderTree(treeItems)
            )}
          </div>
          <div className="energy-analysis-selection-shell">
            <div className="energy-analysis-selection-block">
              <strong>{zhCN.energyAnalysisPage.selectionRootsLabel}</strong>
              {renderSelectionChips(selectedRoots, zhCN.energyAnalysisPage.selectionEmpty)}
            </div>
            <div className="energy-analysis-selection-block">
              <strong>{zhCN.energyAnalysisPage.selectionDevicesLabel}</strong>
              {renderSelectionChips(selectedDevices, zhCN.energyAnalysisPage.selectionEmpty)}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={zhCN.energyAnalysisPage.sectionFilters}>
        <div className="energy-analysis-filter-grid">
          <label className="energy-analysis-field">
            <span>{zhCN.energyAnalysisPage.filterStartDate}</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </label>
          <label className="energy-analysis-field">
            <span>{zhCN.energyAnalysisPage.filterEndDate}</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </label>
          <label className="energy-analysis-field">
            <span>{zhCN.energyAnalysisPage.filterDateType}</span>
            <select
              value={filters.dateType}
              onChange={(event) => updateFilter("dateType", event.target.value as DateTypeValue)}
            >
              <option value="1">{zhCN.energyAnalysisPage.intervalHour}</option>
              <option value="2">{zhCN.energyAnalysisPage.intervalDay}</option>
              <option value="3">{zhCN.energyAnalysisPage.intervalMonth}</option>
              <option value="4">{zhCN.energyAnalysisPage.intervalYear}</option>
            </select>
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
      </SectionCard>

      <SectionCard title={zhCN.energyAnalysisPage.sectionSummary}>
        <div className="energy-analysis-summary-grid">
          {summaryCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              unit={card.unit}
              delta={card.delta}
              tone={card.tone}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.energyAnalysisPage.sectionChart}>
        <div className="energy-analysis-chart-meta">
          <span>{`${zhCN.energyAnalysisPage.rangeLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
          <span>{`${zhCN.energyAnalysisPage.rangeUnitLabel} ${data?.unit || "--"}`}</span>
          <span>{`${zhCN.energyAnalysisPage.rangeSelectionLabel} ${queriedDevices.length}${zhCN.energyAnalysisPage.unitDevices}`}</span>
        </div>
        <EnergyAnalysisTrendChart data={data} loadError={loadError} />
      </SectionCard>

      <SectionCard title={zhCN.energyAnalysisPage.sectionTable}>
        <div className="energy-analysis-table-meta">
          <span>{`${zhCN.energyAnalysisPage.rangeLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
          <span>{`${zhCN.energyAnalysisPage.rangeUnitLabel} ${data?.unit || "--"}`}</span>
        </div>
        <div className="table-scroll-shell">
          <table className="data-table energy-analysis-table">
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
                  <tr key={row.id || `${row.objectName || "summary"}-${index + 1}`}>
                    <td>{row.objectName || "--"}</td>
                    <td>{formatValue(row.sumValue)}</td>
                    <td>{formatValue(row.maxValue)}</td>
                    <td>{row.maxTime || "--"}</td>
                    <td>{formatValue(row.minValue)}</td>
                    <td>{row.minTime || "--"}</td>
                    <td>{formatValue(row.average)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="energy-analysis-empty-inline">
                    {loading ? zhCN.energyAnalysisPage.loading : zhCN.energyAnalysisPage.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

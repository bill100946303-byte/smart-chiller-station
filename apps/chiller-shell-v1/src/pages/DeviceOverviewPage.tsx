import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import DeviceModelPreview from "../components/device/DeviceModelPreview";
import { getDeviceModelCatalog, type DeviceModelCategory } from "../config/modelRegistry";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type DashboardOverviewDto,
  type DeviceDetailDto,
  type DeviceListDto,
  type DeviceListItemDto,
  type SourceStatusDto,
  type DeviceTreeDto,
  type DeviceTreeNodeDto,
  type SystemTopologyDto,
  fetchDashboardOverview,
  fetchDeviceDetail,
  fetchDeviceList,
  fetchDeviceTree,
  fetchSystemTopology
} from "../services/bffClient";

type DeviceSummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type FloorGroup = {
  floor: string;
  count: number;
};

type ProcessGroup = {
  label: string;
  count: number;
};

type DeviceDetailRecord = {
  label: string;
  deviceCode: string;
  systemType: string;
  floorName: string;
  buildingName: string;
  lastReportAt: string;
  nodeType: string;
  childCount: string;
  pointCount: string;
  deviceIdRef: string;
  runStatusText: string;
  alarmStatusText: string;
  usageType: string;
  isVirtual: string;
};

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSizeParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return parsed === 8 || parsed === 12 || parsed === 20 ? parsed : fallback;
}

function parseOptionalSceneMode(value: string | null): "2d" | "3d" | null {
  if (value === "2d" || value === "3d") {
    return value;
  }
  return null;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return String(value);
}

function mapSystemTypeLabel(value: string | null | undefined): string {
  if (value === "chiller") {
    return zhCN.devicePage.systemTypeChiller;
  }
  if (value === "chilledPump") {
    return zhCN.devicePage.systemTypeChilledPump;
  }
  if (value === "coolingPump") {
    return zhCN.devicePage.systemTypeCoolingPump;
  }
  if (value === "coolingTower") {
    return zhCN.devicePage.systemTypeCoolingTower;
  }
  return zhCN.devicePage.systemTypeOther;
}

function mapSourceStateLabel(value: string | undefined): string {
  if (value === "ok") {
    return zhCN.devicePage.sourceStateOk;
  }
  if (value === "partial") {
    return zhCN.devicePage.sourceStatePartial;
  }
  return zhCN.devicePage.sourceStateFailed;
}

function mapSourceStateTone(value: string | undefined): "good" | "warn" | "danger" {
  if (value === "ok") {
    return "good";
  }
  if (value === "partial") {
    return "warn";
  }
  return "danger";
}

function mapDeviceStatusLabel(value: string | null | undefined): string {
  if (value === "online") {
    return "在线";
  }
  if (value === "offline") {
    return "离线";
  }
  if (value === "unknown" || !value) {
    return zhCN.devicePage.statusUnknown;
  }
  return value;
}

function mapTreeNodeTypeLabel(value: string | null | undefined): string {
  if (value === "root") {
    return zhCN.devicePage.treeNodeRoot;
  }
  if (value === "group") {
    return zhCN.devicePage.treeNodeGroup;
  }
  if (value === "device") {
    return zhCN.devicePage.treeNodeDevice;
  }
  return zhCN.devicePage.treeNodePoint;
}

function isMeaningfulSpaceValue(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  const lowered = normalized.toLowerCase();
  return !["unknown", "未知", "默认", "0", "null", "undefined", "-", "--"].includes(lowered);
}

function getDisplaySpaceValue(value: string | null | undefined, fallback: string): string {
  return isMeaningfulSpaceValue(value) ? String(value).trim() : fallback;
}

function hasFallbackSource(sourceStatus: SourceStatusDto | null | undefined): boolean {
  return Boolean(sourceStatus?.sources?.some((item) => item.fallback === true));
}

function buildSummaryCards(
  overview: DashboardOverviewDto | null,
  topology: SystemTopologyDto | null,
  partialActive: boolean
): DeviceSummaryCard[] {
  const summary = overview?.deviceSummary || topology?.summary || null;
  const freshness = overview?.freshness;
  const freshnessLabel = freshness?.stale
    ? zhCN.devicePage.freshnessStale
    : freshness?.latestTimestamp
      ? zhCN.devicePage.freshnessFresh
      : zhCN.devicePage.freshnessWarn;
  const partialLabel = partialActive ? zhCN.devicePage.partial : zhCN.dashboard.readyBanner;

  return [
    {
      title: zhCN.devicePage.summaryTotal,
      value: formatCount(summary?.totalDevices),
      unit: zhCN.common.unitItem,
      delta: partialLabel,
      tone: partialActive ? "warn" : "good"
    },
    {
      title: zhCN.devicePage.summaryChiller,
      value: formatCount(summary?.chillerCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.devicePage.systemTypeChiller,
      tone: "neutral"
    },
    {
      title: zhCN.devicePage.summaryChilledPump,
      value: formatCount(summary?.chilledPumpCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.devicePage.systemTypeChilledPump,
      tone: "neutral"
    },
    {
      title: zhCN.devicePage.summaryCoolingPump,
      value: formatCount(summary?.coolingPumpCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.devicePage.systemTypeCoolingPump,
      tone: "neutral"
    },
    {
      title: zhCN.devicePage.summaryCoolingTower,
      value: formatCount(summary?.coolingTowerCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.devicePage.systemTypeCoolingTower,
      tone: "neutral"
    },
    {
      title: zhCN.devicePage.summaryFreshness,
      value: freshnessLabel,
      unit: "",
      delta: freshness?.latestTimestamp || zhCN.devicePage.partial,
      tone: freshness?.stale ? "warn" : "good"
    }
  ];
}

function buildFloorGroups(topology: SystemTopologyDto | null): FloorGroup[] {
  const grouped = new Map<string, number>();
  for (const item of topology?.groups || []) {
    const floor = getDisplaySpaceValue(item.floor, "");
    if (!floor) {
      continue;
    }
    grouped.set(floor, (grouped.get(floor) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([floor, count]) => ({ floor, count }))
    .sort((left, right) => right.count - left.count);
}

function buildProcessGroups(topology: SystemTopologyDto | null): ProcessGroup[] {
  const grouped = new Map<string, number>();
  for (const item of topology?.groups || []) {
    const label = mapSystemTypeLabel(item.type);
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function flattenTree(root: DeviceTreeNodeDto | null | undefined) {
  const nodes: DeviceTreeNodeDto[] = [];
  const index = new Map<string, DeviceTreeNodeDto>();

  function walk(node: DeviceTreeNodeDto | null | undefined) {
    if (!node?.id) {
      return;
    }
    nodes.push(node);
    index.set(node.id, node);
    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(root);
  return { nodes, index };
}

function findFirstDeviceNode(root: DeviceTreeNodeDto | null | undefined): DeviceTreeNodeDto | null {
  if (!root) {
    return null;
  }
  if (root.nodeType === "device") {
    return root;
  }
  for (const child of root.children || []) {
    const found = findFirstDeviceNode(child);
    if (found) {
      return found;
    }
  }
  return null;
}

function buildDeviceDetailRecord(
  node: DeviceTreeNodeDto | null,
  currentPageItems: DeviceListItemDto[],
  detailDto: DeviceDetailDto | null
): DeviceDetailRecord | null {
  if (!node) {
    return null;
  }

  const matchedDevice =
    currentPageItems.find((item) => item.deviceId && item.deviceId === node.deviceIdRef) || null;
  const detail = detailDto?.detail || null;
  const merged = {
    deviceName: detail?.deviceName || matchedDevice?.deviceName || node.deviceName || node.label || zhCN.common.unknown,
    deviceCode: detail?.deviceCode || matchedDevice?.deviceCode || node.deviceCode || zhCN.common.unknown,
    systemType: matchedDevice?.systemType || node.systemType || null,
    floorName: detail?.floorName || matchedDevice?.floorName || node.floorName || "",
    buildingName: detail?.buildingName || matchedDevice?.buildingName || node.buildingName || "",
    status: mapDeviceStatusLabel(matchedDevice?.status || node.status || zhCN.devicePage.statusUnknown),
    lastReportAt: detail?.latestUpdateAt || matchedDevice?.lastReportAt || node.lastReportAt || zhCN.common.timeUnknown,
    runStatusText: detail?.runStatusText || zhCN.devicePage.detailValuePending,
    alarmStatusText: detail?.alarmStatusText || zhCN.devicePage.detailValuePending,
    usageType: detail?.usageType || matchedDevice?.usageType || zhCN.common.unknown,
    isVirtual:
      detail?.isVirtual == null
        ? zhCN.devicePage.detailValuePending
        : detail.isVirtual
          ? zhCN.devicePage.detailVirtualYes
          : zhCN.devicePage.detailVirtualNo,
    deviceIdRef: node.deviceIdRef || zhCN.common.unknown
  };

  return {
    label: merged.deviceName,
    deviceCode: merged.deviceCode,
    systemType: mapSystemTypeLabel(merged.systemType),
    floorName: merged.floorName,
    buildingName: merged.buildingName,
    lastReportAt: merged.lastReportAt,
    nodeType: mapTreeNodeTypeLabel(node.nodeType),
    childCount: formatCount(node.childCount),
    pointCount: formatCount(detail?.pointCount ?? node.childCount),
    deviceIdRef: merged.deviceIdRef,
    runStatusText: merged.runStatusText,
    alarmStatusText: merged.alarmStatusText,
    usageType: merged.usageType,
    isVirtual: merged.isVirtual
  };
}

function renderDeviceRow(
  item: DeviceListItemDto,
  index: number,
  isSelected: boolean,
  onSelect: (deviceId: string | undefined) => void,
  spaceHierarchyEnabled: boolean
) {
  const floorText = getDisplaySpaceValue(item.floorName, zhCN.devicePage.processViewValue);
  const buildingText = getDisplaySpaceValue(
    item.buildingName,
    spaceHierarchyEnabled ? zhCN.common.unknown : zhCN.devicePage.processViewCompact
  );
  return (
    <button
      key={item.deviceId || `device-row-${index + 1}`}
      type="button"
      className={isSelected ? "device-table-row is-selected" : "device-table-row"}
      onClick={() => onSelect(item.deviceId)}
    >
      <span className="device-cell device-cell-primary" data-label={zhCN.devicePage.sectionList}>
        <strong>{item.deviceName || zhCN.common.unknown}</strong>
        <small>
          {item.deviceCode || zhCN.common.unknown}
          {item.isPlaceholder ? ` · ${zhCN.devicePage.placeholderLabel}` : ""}
        </small>
      </span>
      <span className="device-cell" data-label={zhCN.devicePage.filterType}>{mapSystemTypeLabel(item.systemType)}</span>
      <span className="device-cell" data-label={spaceHierarchyEnabled ? zhCN.devicePage.filterFloor : zhCN.devicePage.tableUsageType}>
        {spaceHierarchyEnabled ? floorText : item.usageType || mapSystemTypeLabel(item.systemType)}
      </span>
      <span className="device-cell" data-label={spaceHierarchyEnabled ? zhCN.devicePage.detailBuilding : zhCN.devicePage.tableView}>
        {spaceHierarchyEnabled ? buildingText : zhCN.devicePage.processViewCompact}
      </span>
      <span className="device-cell" data-label={zhCN.devicePage.detailStatus}>
        <StatusPill label={mapDeviceStatusLabel(item.status)} tone="neutral" />
      </span>
    </button>
  );
}

function renderTreeNode(
  node: DeviceTreeNodeDto,
  selectedId: string | null,
  onSelect: (node: DeviceTreeNodeDto) => void,
  level = 0
) {
  const selectable = node.nodeType === "device" || node.nodeType === "point";
  return (
    <li key={node.id} className="device-tree-item">
      <button
        type="button"
        className={selectedId === node.id ? "device-tree-button is-selected" : "device-tree-button"}
        onClick={() => onSelect(node)}
        disabled={!selectable}
        style={{ paddingLeft: `${14 + level * 14}px` }}
      >
        <span className="device-tree-main">
          <strong>{node.label || zhCN.common.unknown}</strong>
          <small>{mapTreeNodeTypeLabel(node.nodeType)}</small>
        </span>
        <span className="device-tree-meta">
          <StatusPill label={`${formatCount(node.childCount)} ${zhCN.common.unitItem}`} tone="neutral" />
        </span>
      </button>
      {(node.children || []).length > 0 ? (
        <ul className="device-tree-list nested">
          {(node.children || []).map((child) => renderTreeNode(child, selectedId, onSelect, level + 1))}
        </ul>
      ) : null}
    </li>
  );
}

export default function DeviceOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [topology, setTopology] = useState<SystemTopologyDto | null>(null);
  const [deviceList, setDeviceList] = useState<DeviceListDto | null>(null);
  const [deviceTree, setDeviceTree] = useState<DeviceTreeDto | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<DeviceDetailDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() => parsePageSizeParam(searchParams.get("pageSize"), 12));
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") || "");
  const [floorFilter, setFloorFilter] = useState(() => searchParams.get("floor") || "");
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [forcedModelCategory, setForcedModelCategory] = useState<DeviceModelCategory | null>(null);
  const requestedDeviceId = searchParams.get("deviceId");
  const requestedFloor = searchParams.get("floor") || "";
  const requestedType = searchParams.get("type") || "";
  const requestedPage = parsePageParam(searchParams.get("page"), 1);
  const requestedPageSize = parsePageSizeParam(searchParams.get("pageSize"), 12);
  const requestedSceneMode = parseOptionalSceneMode(searchParams.get("sceneMode"));
  const requestedSceneNodeId = searchParams.get("sceneNodeId") || "";

  useEffect(() => {
    if (requestedFloor === floorFilter) {
      return;
    }
    setFloorFilter(requestedFloor);
    setPage(1);
  }, [requestedFloor, floorFilter]);

  useEffect(() => {
    if (requestedType === typeFilter) {
      return;
    }
    setTypeFilter(requestedType);
    setPage(1);
  }, [requestedType, typeFilter]);

  useEffect(() => {
    if (requestedPage === page) {
      return;
    }
    setPage(requestedPage);
  }, [requestedPage, page]);

  useEffect(() => {
    if (requestedPageSize === pageSize) {
      return;
    }
    setPageSize(requestedPageSize);
  }, [requestedPageSize, pageSize]);

  useEffect(() => {
    let active = true;

    async function load() {
      const [overviewResult, topologyResult, listResult, treeResult] = await Promise.allSettled([
        fetchDashboardOverview(runtimeConfig.siteId),
        fetchSystemTopology(runtimeConfig.siteId),
        fetchDeviceList(runtimeConfig.siteId, {
          page,
          pageSize,
          type: typeFilter || undefined,
          floor: floorFilter || undefined
        }),
        fetchDeviceTree(runtimeConfig.siteId)
      ]);

      if (!active) {
        return;
      }

      startTransition(() => {
        const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
        const topologyData = topologyResult.status === "fulfilled" ? topologyResult.value : null;
        const listData = listResult.status === "fulfilled" ? listResult.value : null;
        const treeData = treeResult.status === "fulfilled" ? treeResult.value : null;
        const failedCount = [overviewData, topologyData, listData, treeData].filter((item) => item == null).length;

        setOverview(overviewData);
        setTopology(topologyData);
        setDeviceList(listData);
        setDeviceTree(treeData);
        setListError(listResult.status === "rejected" ? zhCN.devicePage.listLoadFailed : null);
        setTreeError(treeResult.status === "rejected" ? zhCN.devicePage.treeLoadFailed : null);

        if (failedCount === 4) {
          setLoadError(zhCN.devicePage.degraded);
        } else if (failedCount > 0) {
          setLoadError(zhCN.dashboard.partialDataset);
        } else {
          setLoadError(null);
        }
      });
    }

    load();
    return () => {
      active = false;
    };
  }, [floorFilter, page, pageSize, typeFilter]);

  const items = deviceList?.items || [];
  const total = typeof deviceList?.total === "number" ? deviceList.total : items.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const topologyNodes = topology?.nodes || [];
  const treeRoot = deviceTree?.tree || null;
  const treeState = useMemo(() => flattenTree(treeRoot), [treeRoot]);
  const firstDeviceNode = useMemo(() => findFirstDeviceNode(treeRoot), [treeRoot]);
  const selectedTreeNode =
    (selectedTreeNodeId ? treeState.index.get(selectedTreeNodeId) : null) || firstDeviceNode || treeRoot;
  const selectedDeviceId = selectedTreeNode?.deviceIdRef || null;
  const sceneContextDeviceId = selectedDeviceId || requestedDeviceId || null;
  const pageSourceStatuses = [
    overview?.sourceStatus,
    topology?.sourceStatus,
    deviceList?.sourceStatus,
    deviceTree?.sourceStatus,
    selectedDeviceId ? deviceDetail?.sourceStatus : null
  ];
  const sourceSummary = summarizeSourceStatus(pageSourceStatuses);
  const sourceStatusLines = buildSourceStatusLines(pageSourceStatuses);
  const sourceStatusLinesCompact = buildSourceStatusLines(pageSourceStatuses, {
    limit: 4,
    labelMode: "short"
  });

  const partialActive = !loadError && sourceSummary.warn;
  const topologyPlaceholderActive = hasFallbackSource(topology?.sourceStatus);
  const listPlaceholderActive = hasFallbackSource(deviceList?.sourceStatus);
  const cards = buildSummaryCards(overview, topology, partialActive);
  const floorGroups = useMemo(() => buildFloorGroups(topology), [topology]);
  const processGroups = useMemo(() => buildProcessGroups(topology), [topology]);
  const modelCatalog = useMemo(() => getDeviceModelCatalog(), []);
  const detailRecordWithDto = buildDeviceDetailRecord(selectedTreeNode || null, items, deviceDetail);
  const detailSourceSummary = summarizeSourceStatus([deviceDetail?.sourceStatus]);
  const detailSourceLinesCompact = buildSourceStatusLines([deviceDetail?.sourceStatus], {
    limit: 3,
    labelMode: "short"
  });
  const detailHasRuntimeGap = Boolean(
    deviceDetail?.sourceStatus?.sources?.some(
      (item) => item.key === "deviceDetailRuntime" && item.ok === false
    )
  );
  const detailPlaceholderActive =
    deviceDetail?.detail?.isPlaceholder === true || hasFallbackSource(deviceDetail?.sourceStatus);
  const spaceHierarchyEnabled = useMemo(() => {
    if (floorGroups.length > 0) {
      return true;
    }
    if (items.some((item) => isMeaningfulSpaceValue(item.floorName) || isMeaningfulSpaceValue(item.buildingName))) {
      return true;
    }
    if (
      isMeaningfulSpaceValue(deviceDetail?.detail?.floorName) ||
      isMeaningfulSpaceValue(deviceDetail?.detail?.buildingName)
    ) {
      return true;
    }
    return false;
  }, [deviceDetail?.detail?.buildingName, deviceDetail?.detail?.floorName, floorGroups.length, items]);
  const typeOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const group of topology?.groups || []) {
      if (typeof group.type === "string" && group.type.trim().length > 0) {
        keys.add(group.type);
      }
    }
    return Array.from(keys);
  }, [topology]);
  const floorOptions = useMemo(() => floorGroups.map((item) => item.floor), [floorGroups]);

  useEffect(() => {
    if (!spaceHierarchyEnabled && floorFilter) {
      setFloorFilter("");
      setPage(1);
    }
  }, [floorFilter, spaceHierarchyEnabled]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (floorFilter) {
      nextParams.set("floor", floorFilter);
    }
    if (typeFilter) {
      nextParams.set("type", typeFilter);
    }
    if (page > 1) {
      nextParams.set("page", String(page));
    }
    if (pageSize !== 12) {
      nextParams.set("pageSize", String(pageSize));
    }
    if (sceneContextDeviceId) {
      nextParams.set("deviceId", sceneContextDeviceId);
    }
    if (requestedSceneMode) {
      nextParams.set("sceneMode", requestedSceneMode);
    }
    if (requestedSceneNodeId) {
      nextParams.set("sceneNodeId", requestedSceneNodeId);
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    setSearchParams(nextParams, { replace: true });
  }, [
    floorFilter,
    page,
    pageSize,
    requestedSceneMode,
    requestedSceneNodeId,
    searchParams,
    sceneContextDeviceId,
    setSearchParams,
    typeFilter
  ]);

  useEffect(() => {
    if (requestedDeviceId) {
      const requestedNode = treeState.nodes.find((node) => node.deviceIdRef === requestedDeviceId);
      if (requestedNode?.id && requestedNode.id !== selectedTreeNodeId) {
        setSelectedTreeNodeId(requestedNode.id);
        return;
      }
    }
    if (!selectedTreeNodeId && firstDeviceNode?.id) {
      setSelectedTreeNodeId(firstDeviceNode.id);
      return;
    }
    if (selectedTreeNodeId && !treeState.index.has(selectedTreeNodeId) && firstDeviceNode?.id) {
      setSelectedTreeNodeId(firstDeviceNode.id);
    }
  }, [firstDeviceNode?.id, requestedDeviceId, selectedTreeNodeId, treeState.index, treeState.nodes]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!selectedDeviceId) {
        setDeviceDetail(null);
        setDetailError(null);
        return;
      }
      try {
        const result = await fetchDeviceDetail(runtimeConfig.siteId, selectedDeviceId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setDeviceDetail(result);
          setDetailError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDeviceDetail(null);
          setDetailError(zhCN.devicePage.detailLoadFailed);
        });
      }
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedDeviceId]);

  function onChangeTypeFilter(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  function onChangeFloorFilter(value: string) {
    setFloorFilter(value);
    setPage(1);
  }

  function onSelectDevice(deviceId: string | undefined) {
    if (!deviceId) {
      return;
    }
    const matchedNode = treeState.nodes.find((node) => node.deviceIdRef === deviceId);
    if (matchedNode?.id) {
      setSelectedTreeNodeId(matchedNode.id);
    }
  }

  return (
    <div className="device-page page-enter">
      <SourceStatusBanner
        summary={loadError ? loadError : sourceSummary.text}
        warn={Boolean(loadError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="device-page-header">
        <div>
          <h2>{zhCN.devicePage.heading}</h2>
          <p>{zhCN.devicePage.subtitle}</p>
        </div>
        <div className="device-page-header-actions">
          {floorFilter ? (
            <Link
              className="scene-open-link"
              to={`/scene-control?mode=${encodeURIComponent(requestedSceneMode || "2d")}&floor=${encodeURIComponent(floorFilter === "11楼" ? "11" : "10")}${sceneContextDeviceId ? `&deviceId=${encodeURIComponent(sceneContextDeviceId)}` : ""}${requestedSceneNodeId ? `&nodeId=${encodeURIComponent(requestedSceneNodeId)}` : ""}`}
            >
              {zhCN.devicePage.backToScene}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="device-summary-grid">
        {cards.map((item) => (
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

      <div className="device-page-grid">
        <SectionCard title={zhCN.devicePage.sectionTopology}>
          <p className="empty-hint">{zhCN.devicePage.topologyHint}</p>
          {topologyPlaceholderActive ? <p className="empty-hint">{zhCN.devicePage.placeholderNote}</p> : null}
          {topologyNodes.length > 0 ? (
            <div className="device-topology-grid">
              {topologyNodes.map((node) => (
                <article key={node.id} className="device-topology-node">
                  <div>
                    <strong>{node.label || zhCN.common.unknown}</strong>
                    <p>{mapSourceStateLabel(topology?.sourceStatus?.overall)}</p>
                  </div>
                  <StatusPill label={`${formatCount(node.count)} ${zhCN.common.unitItem}`} tone="neutral" />
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hint">{zhCN.devicePage.empty}</p>
          )}
        </SectionCard>

        <SectionCard title={zhCN.devicePage.sectionGroups}>
          <p className="empty-hint">
            {spaceHierarchyEnabled ? zhCN.devicePage.groupsHint : zhCN.devicePage.processGroupsHint}
          </p>
          {spaceHierarchyEnabled && floorGroups.length > 0 ? (
            <div className="device-floor-grid">
              {floorGroups.slice(0, 10).map((item) => (
                <article key={item.floor} className="device-floor-card">
                  <strong>{item.floor}</strong>
                  <p>{`${item.count}${zhCN.common.unitItem}`}</p>
                </article>
              ))}
            </div>
          ) : !spaceHierarchyEnabled && processGroups.length > 0 ? (
            <div className="device-floor-grid">
              {processGroups.map((item) => (
                <article key={item.label} className="device-floor-card">
                  <strong>{item.label}</strong>
                  <p>{`${item.count}${zhCN.common.unitItem}`}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hint">{zhCN.devicePage.empty}</p>
          )}
        </SectionCard>
      </div>

      <div className="device-detail-layout">
        <SectionCard title={zhCN.devicePage.sectionTree}>
          <p className="empty-hint">{treeError ? treeError : zhCN.devicePage.treeHint}</p>
          {treeRoot?.children && treeRoot.children.length > 0 ? (
            <ul className="device-tree-list">
              {treeRoot.children.map((node) => renderTreeNode(node, selectedTreeNodeId, (nextNode) => setSelectedTreeNodeId(nextNode.id || null)))}
            </ul>
          ) : (
            <p className="empty-hint">{zhCN.devicePage.empty}</p>
          )}
        </SectionCard>

        <SectionCard title={zhCN.devicePage.sectionDetail}>
          <p className="empty-hint">{zhCN.devicePage.detailHint}</p>
          {detailPlaceholderActive ? <p className="empty-hint">{zhCN.devicePage.detailPlaceholderNote}</p> : null}
          {detailRecordWithDto ? (
            <div className="device-detail-card">
              <header className="device-detail-header">
                <div>
                  <strong>{detailRecordWithDto.label}</strong>
                  <p>{detailRecordWithDto.deviceCode}</p>
                </div>
                <div className="device-detail-meta">
                  <StatusPill label={detailRecordWithDto.nodeType} tone="neutral" />
                  {detailPlaceholderActive ? (
                    <StatusPill label={zhCN.devicePage.placeholderLabel} tone="warn" />
                  ) : null}
                  <StatusPill
                    label={`${zhCN.sourceBanner.summaryPrefix}${mapSourceStateLabel(deviceDetail?.sourceStatus?.overall)}`}
                    tone={mapSourceStateTone(deviceDetail?.sourceStatus?.overall)}
                  />
                </div>
              </header>

              {detailSourceLinesCompact.length > 0 ? (
                <div className="device-detail-source">
                  {detailSourceLinesCompact.map((line) => (
                    <small key={line}>{line}</small>
                  ))}
                </div>
              ) : null}

              <div className="device-model-switch">
                <div className="device-model-switch-header">
                  <strong>{zhCN.devicePage.modelSwitchTitle}</strong>
                  <small>{zhCN.devicePage.modelSwitchHint}</small>
                </div>
                <div className="device-model-switch-row">
                  <button
                    type="button"
                    className={forcedModelCategory === null ? "device-model-switch-button active" : "device-model-switch-button"}
                    onClick={() => setForcedModelCategory(null)}
                  >
                    {zhCN.devicePage.modelSwitchAuto}
                  </button>
                  {modelCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={forcedModelCategory === item.category ? "device-model-switch-button active" : "device-model-switch-button"}
                      onClick={() => setForcedModelCategory(item.category)}
                    >
                      {item.displayName}
                    </button>
                  ))}
                </div>
              </div>

              <DeviceModelPreview
                deviceName={detailRecordWithDto.label}
                systemType={detailRecordWithDto.systemType}
                forcedCategory={forcedModelCategory}
              />

              <div className="device-detail-grid">
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailType}</span>
                  <strong>{detailRecordWithDto.systemType}</strong>
                </article>
                {spaceHierarchyEnabled ? (
                  <>
                    <article className="device-detail-item">
                      <span>{zhCN.devicePage.detailFloor}</span>
                      <strong>{getDisplaySpaceValue(detailRecordWithDto.floorName, zhCN.common.unknown)}</strong>
                    </article>
                    <article className="device-detail-item">
                      <span>{zhCN.devicePage.detailBuilding}</span>
                      <strong>{getDisplaySpaceValue(detailRecordWithDto.buildingName, zhCN.common.unknown)}</strong>
                    </article>
                  </>
                ) : (
                  <article className="device-detail-item">
                    <span>{zhCN.devicePage.detailViewMode}</span>
                    <strong>{zhCN.devicePage.processViewValue}</strong>
                  </article>
                )}
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailStatus}</span>
                  <strong>{detailRecordWithDto.runStatusText}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailLastReport}</span>
                  <strong>{detailRecordWithDto.lastReportAt}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailChildren}</span>
                  <strong>{detailRecordWithDto.childCount}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailUsageType}</span>
                  <strong>{detailRecordWithDto.usageType}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailAlarmStatus}</span>
                  <strong>{detailRecordWithDto.alarmStatusText}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailVirtual}</span>
                  <strong>{detailRecordWithDto.isVirtual}</strong>
                </article>
                <article className="device-detail-item">
                  <span>{zhCN.devicePage.detailPoints}</span>
                  <strong>{detailRecordWithDto.pointCount}</strong>
                </article>
              </div>

              <div className="device-detail-footnote">
                <span>{`${zhCN.devicePage.detailDeviceRef} ${detailRecordWithDto.deviceIdRef}`}</span>
                <span>
                  {detailError
                    ? detailError
                    : detailHasRuntimeGap
                      ? zhCN.devicePage.detailRuntimeFallback
                      : detailSourceSummary.warn
                        ? zhCN.devicePage.detailRuntimeFallback
                        : zhCN.devicePage.detailRuntimeNote}
                </span>
              </div>
            </div>
          ) : (
            <div className="device-detail-card">
              <div className="device-model-switch">
                <div className="device-model-switch-header">
                  <strong>{zhCN.devicePage.modelSwitchTitle}</strong>
                  <small>{zhCN.devicePage.modelSwitchHint}</small>
                </div>
                <div className="device-model-switch-row">
                  {modelCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={forcedModelCategory === item.category || (forcedModelCategory === null && item.category === "chiller")
                        ? "device-model-switch-button active"
                        : "device-model-switch-button"}
                      onClick={() => setForcedModelCategory(item.category)}
                    >
                      {item.displayName}
                    </button>
                  ))}
                </div>
              </div>
              <DeviceModelPreview
                deviceName={forcedModelCategory ? modelCatalog.find((item) => item.category === forcedModelCategory)?.displayName || zhCN.devicePage.systemTypeChiller : zhCN.devicePage.systemTypeChiller}
                systemType={zhCN.devicePage.systemTypeChiller}
                forcedCategory={forcedModelCategory || "chiller"}
              />
              <p className="empty-hint">{zhCN.devicePage.detailEmpty}</p>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={zhCN.devicePage.sectionList}>
        <div className="device-list-toolbar">
          <div className="device-filter-group">
            <label>
              <span>{zhCN.devicePage.filterType}</span>
              <select value={typeFilter} onChange={(event) => onChangeTypeFilter(event.target.value)}>
                <option value="">{zhCN.devicePage.filterAll}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {mapSystemTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            {spaceHierarchyEnabled ? (
              <label>
                <span>{zhCN.devicePage.filterFloor}</span>
                <select value={floorFilter} onChange={(event) => onChangeFloorFilter(event.target.value)}>
                  <option value="">{zhCN.devicePage.filterAll}</option>
                  {floorOptions.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="empty-hint">{zhCN.devicePage.noSpatialHierarchyHint}</div>
            )}
          </div>

          <div className="device-pagination-meta">
            <span>{`${zhCN.devicePage.summaryTotal} ${total}${zhCN.common.unitItem}`}</span>
            <div className="device-page-size">
              {[8, 12, 20].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={pageSize === size ? "alarm-filter-button active" : "alarm-filter-button"}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                >
                  {`${size}${zhCN.common.unitItem}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="empty-hint">
          {listError
            ? listError
            : listPlaceholderActive
              ? `${zhCN.devicePage.placeholderNote} · ${zhCN.devicePage.pageLabel} ${page}/${pageCount}`
            : partialActive
              ? zhCN.devicePage.partial
              : `${zhCN.devicePage.listHint} · ${zhCN.devicePage.pageLabel} ${page}/${pageCount}`}
        </p>

        {items.length > 0 ? (
          <div className="device-table">
            <div className="device-table-head">
              <span>{zhCN.devicePage.tableDevice}</span>
              <span>{zhCN.devicePage.tableType}</span>
              <span>{spaceHierarchyEnabled ? zhCN.devicePage.tableFloor : zhCN.devicePage.tableUsageType}</span>
              <span>{spaceHierarchyEnabled ? zhCN.devicePage.tableBuilding : zhCN.devicePage.tableView}</span>
              <span>{zhCN.devicePage.tableStatus}</span>
            </div>
            {items.map((item, index) =>
              renderDeviceRow(
                item,
                index,
                Boolean(selectedTreeNode?.deviceIdRef && selectedTreeNode.deviceIdRef === item.deviceId),
                onSelectDevice,
                spaceHierarchyEnabled
              )
            )}
            <div className="alarm-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                {zhCN.devicePage.pagePrev}
              </button>
              <span>{`${zhCN.devicePage.pageLabel} ${page}/${pageCount}`}</span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                {zhCN.devicePage.pageNext}
              </button>
            </div>
          </div>
        ) : listError || loadError ? (
          <p className="empty-hint">{zhCN.devicePage.degraded}</p>
        ) : typeFilter || floorFilter ? (
          <p className="empty-hint">{zhCN.devicePage.filteredEmpty}</p>
        ) : (
          <p className="empty-hint">{zhCN.devicePage.empty}</p>
        )}
      </SectionCard>
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatusPill from "../components/common/StatusPill";
import DeviceModelPreview from "../components/device/DeviceModelPreview";
import SystemDiagram3D from "../components/scene3d/SystemDiagram3D";
import {
  buildRuntimeSystemDiagram,
  buildSystemDiagramFromContract,
  MAIN_LOOP_SYSTEM_DIAGRAM
} from "../components/scene3d/systemDiagramMock";
import { SYSTEM_DIAGRAM_CONTRACT_SAMPLE } from "../components/scene3d/systemDiagramContractSample";
import type { SystemDiagramTopology as SceneSystemDiagramTopology } from "../components/scene3d/systemDiagramTypes";
import { getDeviceModelCatalog, type DeviceModelCategory } from "../config/modelRegistry";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type DeviceDetailDto,
  type DeviceListItemDto,
  type SceneLegacyPointDto,
  type SceneLegacyTrendDto,
  type SceneOnlineMonitorDto,
  type SystemTopologyDto,
  fetchDeviceDetail,
  fetchDeviceList,
  fetchSceneLegacyTrend,
  fetchSceneOnlineMonitor,
  fetchSystemDiagram,
  fetchSystemTopology
} from "../services/bffClient";

type SceneMode = "2d" | "3d";
type SceneFloor = "10" | "11";
type ProbeState = "checking" | "ready" | "failed";
type DevicePanelState = "loading" | "ready" | "failed";
type LegacySceneView = "default" | "dialog" | "online" | "video";
type SceneLegacyDialogState = {
  date: string;
  tagname: string;
  title: string;
  unit: string;
};

function floorSlug(floor: SceneFloor): string {
  return floor === "10" ? "ten" : "eleven";
}

function buildSceneUrl(mode: SceneMode, floor: SceneFloor): string {
  return `${runtimeConfig.sceneBaseUrl}/${mode}/floor/${floorSlug(floor)}/`;
}

function buildSceneDeviceFloorName(floor: SceneFloor): string {
  return floor === "10" ? "10楼" : "11楼";
}

function buildSceneDeviceFloorQuery(floor: SceneFloor): number {
  return floor === "10" ? 1 : 2;
}

function parseMode(value: string | null): SceneMode {
  return value === "3d" ? "3d" : "2d";
}

function parseFloor(value: string | null): SceneFloor {
  return value === "11" ? "11" : "10";
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveLegacySceneView(searchParams: URLSearchParams): LegacySceneView {
  const explicit = searchParams.get("legacyView");
  if (explicit === "dialog" || explicit === "online" || explicit === "video") {
    return explicit;
  }
  return searchParams.get("tagname") ? "dialog" : "default";
}

function buildSceneLegacyDialogState(searchParams: URLSearchParams): SceneLegacyDialogState {
  return {
    date: searchParams.get("date") || formatDateInput(new Date()),
    tagname: searchParams.get("tagname") || "",
    title: searchParams.get("name") || searchParams.get("title") || "",
    unit: searchParams.get("unit") || ""
  };
}

function formatSceneMetricValue(value: number | null | undefined, unit: string | null | undefined = null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.common.unknown;
  }
  const formatted = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function buildSceneChartAxisLabels(points: SceneLegacyPointDto[]): string[] {
  if (points.length <= 6) {
    return points.map((item) => item.label || "--");
  }
  const step = Math.max(1, Math.ceil((points.length - 1) / 5));
  return points
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index === 0 || index === points.length - 1 || index % step === 0)
    .map(({ item }) => item.label || "--");
}

function downloadSceneCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const escapeCell = (value: string | number | null) => {
    const raw = value == null ? "" : String(value);
    return `"${raw.replace(/"/g, "\"\"")}"`;
  };
  const content = [headers, ...rows].map((row) => row.map((cell) => escapeCell(cell)).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function findSystemDiagramNodeByDeviceId(
  topology: SceneSystemDiagramTopology,
  deviceId: string | null | undefined
) {
  if (!deviceId) {
    return null;
  }

  return (
    topology.nodes.find(
      (node) => node.primaryDeviceId === deviceId || (node.deviceIds || []).includes(deviceId)
    ) || null
  );
}

function normalizeSceneMessageValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

const LEGACY_SCENE_BRIDGE_ALIASES: Array<{
  deviceId: string;
  nodeCandidates: string[];
  valueCandidates: string[];
}> = [
  {
    deviceId: "2",
    nodeCandidates: ["chiller-01", "device-ch-1"],
    valueCandidates: ["2", "CH001", "CH1", "1号冷机", "1#冷水机"]
  },
  {
    deviceId: "1",
    nodeCandidates: ["pump-chilled-01", "device-chp-1"],
    valueCandidates: ["1", "CHP001", "CHP1", "1号冷冻泵", "1#冷冻泵"]
  },
  {
    deviceId: "5",
    nodeCandidates: ["pump-cooling-01", "device-cwp-1"],
    valueCandidates: ["5", "CWP001", "CWP1", "1号冷却泵", "1#冷却泵"]
  },
  {
    deviceId: "3",
    nodeCandidates: ["tower-01", "device-ct-1"],
    valueCandidates: ["3", "CT001", "CTF1", "冷却塔组", "冷却塔01"]
  },
  {
    deviceId: "4",
    nodeCandidates: [],
    valueCandidates: ["4", "PLC001", "联动模式柜", "群控制柜"]
  }
];

function collectSceneMessageCandidates(
  payload: Record<string, unknown>,
  bucket: string[]
) {
  const pushCandidate = (value: string) => {
    bucket.push(value);
    if (value.includes("|")) {
      value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => bucket.push(item));
    }

    const normalized = value.toUpperCase();
    const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
      [/^CH0*(\d+)$/, (match) => `CH${match[1]}`],
      [/^CHP0*(\d+)$/, (match) => `CHP${match[1]}`],
      [/^CWP0*(\d+)$/, (match) => `CWP${match[1]}`],
      [/^CT0*(\d+)$/, (match) => `CTF${match[1]}`]
    ];

    for (const [pattern, resolver] of patterns) {
      const matched = normalized.match(pattern);
      if (matched) {
        bucket.push(resolver(matched));
      }
    }
  };

  const directKeys = ["deviceId", "nodeId", "id", "code", "label", "name", "modelname", "model"];
  for (const key of directKeys) {
    const value = normalizeSceneMessageValue(payload[key]);
    if (!value) {
      continue;
    }
    pushCandidate(value);
  }

  const nested = payload.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    collectSceneMessageCandidates(nested as Record<string, unknown>, bucket);
  }
}

function resolveSceneIframeSelection(
  payload: Record<string, unknown>,
  sceneDevices: DeviceListItemDto[],
  topology: SceneSystemDiagramTopology
) {
  const bucket: string[] = [];
  collectSceneMessageCandidates(payload, bucket);
  const candidates = Array.from(new Set(bucket));

  if (candidates.length === 0) {
    return { deviceId: null, nodeId: null };
  }

  const lowerCandidates = candidates.map((item) => item.toLowerCase());
  const matchedDevice =
    sceneDevices.find((item) => {
      const values = [item.deviceId, item.deviceCode, item.deviceName]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return values.some((value) => lowerCandidates.includes(value));
    }) || null;

  const matchedNode =
    topology.nodes.find((item) => {
      const values = [item.id, item.primaryDeviceId, item.label, item.primaryDeviceLabel]
        .concat(item.deviceIds || [])
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return values.some((value) => lowerCandidates.includes(value));
    }) ||
    findSystemDiagramNodeByDeviceId(topology, matchedDevice?.deviceId) ||
    null;

  const matchedAlias =
    LEGACY_SCENE_BRIDGE_ALIASES.find((alias) =>
      alias.valueCandidates.some((value) => lowerCandidates.includes(value.toLowerCase()))
    ) || null;
  const aliasNode =
    matchedAlias
      ? topology.nodes.find((item) =>
          matchedAlias.nodeCandidates.some((value) => value.toLowerCase() === item.id.toLowerCase())
        ) || findSystemDiagramNodeByDeviceId(topology, matchedAlias.deviceId)
      : null;

  return {
    deviceId: matchedDevice?.deviceId || matchedNode?.primaryDeviceId || matchedAlias?.deviceId || null,
    nodeId: matchedNode?.id || aliasNode?.id || null
  };
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

function normalizeSceneModelSystemType(
  detail: DeviceDetailDto["detail"] | null,
  listItem: DeviceListItemDto | null
): string {
  const candidates = [
    detail?.deviceTypeName,
    listItem?.usageType,
    listItem?.deviceName
  ].filter(Boolean) as string[];

  for (const value of candidates) {
    const normalized = value.toLowerCase();
    if (value.includes("冷机") || normalized.includes("chiller")) {
      return zhCN.devicePage.systemTypeChiller;
    }
    if (value.includes("冷冻泵") || normalized.includes("chilled pump")) {
      return zhCN.devicePage.systemTypeChilledPump;
    }
    if (value.includes("冷却泵") || normalized.includes("cooling pump")) {
      return zhCN.devicePage.systemTypeCoolingPump;
    }
    if (value.includes("冷却塔") || normalized.includes("cooling tower")) {
      return zhCN.devicePage.systemTypeCoolingTower;
    }
    if (value.includes("阀")) {
      return "工业阀门";
    }
  }

  return zhCN.devicePage.systemTypeChiller;
}

function resolveSceneModelCategory(systemType: string) {
  if (systemType === zhCN.devicePage.systemTypeChiller) {
    return "chiller";
  }
  if (systemType === zhCN.devicePage.systemTypeChilledPump || systemType === zhCN.devicePage.systemTypeCoolingPump) {
    return "pump";
  }
  if (systemType === zhCN.devicePage.systemTypeCoolingTower) {
    return "cooling-tower";
  }
  if (systemType.includes("阀")) {
    return "valve";
  }
  return null;
}

function SceneLegacyTrendChart({
  points,
  title,
  unit,
  ariaLabel
}: {
  points: SceneLegacyPointDto[];
  title: string;
  unit: string | null | undefined;
  ariaLabel: string;
}) {
  const numericValues = points
    .map((item) => (typeof item.value === "number" && Number.isFinite(item.value) ? item.value : null))
    .filter((item): item is number => item !== null);
  const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const max = numericValues.length > 0 ? Math.max(...numericValues) : 1;
  const span = max - min || Math.max(Math.abs(max), 1);
  const toY = (value: number) => 90 - ((value - min) / span) * 76;
  const axisLabels = buildSceneChartAxisLabels(points);

  const segments: string[] = [];
  let currentSegment: Array<{ x: number; y: number }> = [];
  points.forEach((point, index) => {
    if (typeof point.value !== "number" || !Number.isFinite(point.value)) {
      if (currentSegment.length > 1) {
        segments.push(`M ${currentSegment.map((item) => `${item.x.toFixed(2)} ${item.y.toFixed(2)}`).join(" L ")}`);
      }
      currentSegment = [];
      return;
    }
    const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
    currentSegment.push({ x, y: toY(point.value) });
  });
  if (currentSegment.length > 1) {
    segments.push(`M ${currentSegment.map((item) => `${item.x.toFixed(2)} ${item.y.toFixed(2)}`).join(" L ")}`);
  }

  return (
    <div className="scene-compat-chart-block">
      <div className="scene-compat-chart-head">
        <strong>{title}</strong>
        <small>{unit || zhCN.sceneControl.compatUnitPending}</small>
      </div>
      <div className="trend-chart-shell" aria-label={ariaLabel}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-lines">
          {[20, 40, 60, 80].map((line) => (
            <line key={`scene-grid-${line}`} x1="0" y1={line} x2="100" y2={line} className="trend-grid-line" />
          ))}
          {segments.map((segment, index) => (
            <path
              key={`scene-segment-${index}`}
              d={segment}
              className="trend-line-path"
              style={{ stroke: "rgba(105, 228, 255, 0.92)" }}
            />
          ))}
          {points.map((point, index) => {
            if (typeof point.value !== "number" || !Number.isFinite(point.value)) {
              return null;
            }
            const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
            return (
              <circle
                key={`scene-point-${index}`}
                cx={x}
                cy={toY(point.value)}
                r={1.4}
                className="trend-line-dot"
                style={{ fill: "rgba(143, 247, 215, 0.96)" }}
              >
                <title>
                  {point.label || "--"} / {formatSceneMetricValue(point.value, unit)}
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="trend-axis">
          {axisLabels.map((label, index) => (
            <small key={`${label}-${index}`}>{label}</small>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SceneControlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<SceneMode>(() => parseMode(searchParams.get("mode")));
  const [floor, setFloor] = useState<SceneFloor>(() => parseFloor(searchParams.get("floor")));
  const [probeState, setProbeState] = useState<ProbeState>("checking");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [devicePanelState, setDevicePanelState] = useState<DevicePanelState>("loading");
  const [sceneDevices, setSceneDevices] = useState<DeviceListItemDto[]>([]);
  const [sceneTopology, setSceneTopology] = useState<SystemTopologyDto | null>(null);
  const [sceneSystemDiagram, setSceneSystemDiagram] = useState<SceneSystemDiagramTopology | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedSceneDiagramNodeId, setSelectedSceneDiagramNodeId] = useState<string | null>(null);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<DeviceDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [forcedModelCategory, setForcedModelCategory] = useState<DeviceModelCategory | null>(null);
  const diagramMode = searchParams.get("diagram") === "contract-sample" ? "contract-sample" : "runtime";
  const requestedDeviceId = searchParams.get("deviceId");
  const requestedNodeId = searchParams.get("nodeId");
  const legacySceneView = resolveLegacySceneView(searchParams);
  const legacyDialogTagnameParam = searchParams.get("tagname") || "";
  const legacyDialogTitleParam = searchParams.get("name") || searchParams.get("title") || "";
  const legacyDialogUnitParam = searchParams.get("unit") || "";
  const legacyDialogDateParam = searchParams.get("date") || formatDateInput(new Date());
  const [legacyDialogFilters, setLegacyDialogFilters] = useState<SceneLegacyDialogState>(() =>
    buildSceneLegacyDialogState(searchParams)
  );
  const [legacyDialogQuery, setLegacyDialogQuery] = useState<SceneLegacyDialogState>(() =>
    buildSceneLegacyDialogState(searchParams)
  );
  const [legacyTrendData, setLegacyTrendData] = useState<SceneLegacyTrendDto | null>(null);
  const [legacyTrendLoading, setLegacyTrendLoading] = useState(false);
  const [legacyTrendError, setLegacyTrendError] = useState<string | null>(null);
  const [onlineMonitorData, setOnlineMonitorData] = useState<SceneOnlineMonitorDto | null>(null);
  const [onlineMonitorLoading, setOnlineMonitorLoading] = useState(false);
  const [onlineMonitorError, setOnlineMonitorError] = useState<string | null>(null);

  const sceneUrl = useMemo(() => buildSceneUrl(mode, floor), [mode, floor]);
  const legacyAssetLabel = mode === "2d" ? zhCN.sceneControl.mode2d : zhCN.sceneControl.mode3d;
  const warn = probeState !== "ready";
  const systemDiagramSourceLabel =
    diagramMode === "contract-sample"
      ? zhCN.sceneControl.systemDiagramSourceSample
      : sceneSystemDiagram
        ? zhCN.sceneControl.systemDiagramSourceContract
        : sceneTopology || sceneDevices.length > 0
          ? zhCN.sceneControl.systemDiagramSourceRuntime
          : zhCN.sceneControl.systemDiagramSourceMock;
  const systemDiagramTopology = useMemo(
    () => sceneSystemDiagram || (sceneTopology || sceneDevices.length > 0
      ? buildRuntimeSystemDiagram(sceneTopology, sceneDevices)
      : MAIN_LOOP_SYSTEM_DIAGRAM),
    [sceneDevices, sceneSystemDiagram, sceneTopology]
  );

  useEffect(() => {
    const nextMode = parseMode(searchParams.get("mode"));
    const nextFloor = parseFloor(searchParams.get("floor"));
    setMode((current) => (current === nextMode ? current : nextMode));
    setFloor((current) => (current === nextFloor ? current : nextFloor));
  }, [searchParams]);

  useEffect(() => {
    const currentMode = searchParams.get("mode");
    const currentFloor = searchParams.get("floor");
    const currentDeviceId = searchParams.get("deviceId");
    const currentNodeId = searchParams.get("nodeId");
    if (
      currentMode === mode &&
      currentFloor === floor &&
      currentDeviceId === (selectedDeviceId || null) &&
      currentNodeId === (selectedSceneDiagramNodeId || null)
    ) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", mode);
    nextParams.set("floor", floor);
    if (selectedDeviceId) {
      nextParams.set("deviceId", selectedDeviceId);
    } else {
      nextParams.delete("deviceId");
    }
    if (selectedSceneDiagramNodeId) {
      nextParams.set("nodeId", selectedSceneDiagramNodeId);
    } else {
      nextParams.delete("nodeId");
    }
    setSearchParams(nextParams, { replace: true });
  }, [mode, floor, searchParams, selectedDeviceId, selectedSceneDiagramNodeId, setSearchParams]);

  useEffect(() => {
    if (legacySceneView !== "dialog") {
      return;
    }
    const next = {
      date: legacyDialogDateParam,
      tagname: legacyDialogTagnameParam,
      title: legacyDialogTitleParam,
      unit: legacyDialogUnitParam
    };
    setLegacyDialogFilters(next);
    setLegacyDialogQuery(next);
  }, [
    legacyDialogDateParam,
    legacyDialogTagnameParam,
    legacyDialogTitleParam,
    legacyDialogUnitParam,
    legacySceneView
  ]);

  useEffect(() => {
    let active = true;
    if (legacySceneView !== "dialog") {
      setLegacyTrendLoading(false);
      setLegacyTrendError(null);
      setLegacyTrendData(null);
      return () => {
        active = false;
      };
    }
    if (!legacyDialogQuery.tagname) {
      setLegacyTrendLoading(false);
      setLegacyTrendData(null);
      setLegacyTrendError(zhCN.sceneControl.compatDialogMissingTagname);
      return () => {
        active = false;
      };
    }

    setLegacyTrendLoading(true);
    setLegacyTrendError(null);

    async function loadLegacyTrend() {
      try {
        const today = formatDateInput(new Date());
        const result = await fetchSceneLegacyTrend(runtimeConfig.siteId, {
          tagname: legacyDialogQuery.tagname,
          title: legacyDialogQuery.title,
          unit: legacyDialogQuery.unit,
          date: legacyDialogQuery.date === today ? null : legacyDialogQuery.date
        });
        if (!active) {
          return;
        }
        setLegacyTrendData(result);
        setLegacyTrendLoading(false);
      } catch {
        if (!active) {
          return;
        }
        setLegacyTrendData(null);
        setLegacyTrendLoading(false);
        setLegacyTrendError(zhCN.sceneControl.compatDialogLoadFailed);
      }
    }

    loadLegacyTrend();
    return () => {
      active = false;
    };
  }, [legacyDialogQuery, legacySceneView]);

  useEffect(() => {
    let active = true;
    if (legacySceneView !== "online") {
      setOnlineMonitorLoading(false);
      setOnlineMonitorError(null);
      setOnlineMonitorData(null);
      return () => {
        active = false;
      };
    }

    setOnlineMonitorLoading(true);
    setOnlineMonitorError(null);

    async function loadOnlineMonitor() {
      try {
        const result = await fetchSceneOnlineMonitor(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        setOnlineMonitorData(result);
        setOnlineMonitorLoading(false);
      } catch {
        if (!active) {
          return;
        }
        setOnlineMonitorData(null);
        setOnlineMonitorLoading(false);
        setOnlineMonitorError(zhCN.sceneControl.compatOnlineLoadFailed);
      }
    }

    loadOnlineMonitor();
    return () => {
      active = false;
    };
  }, [legacySceneView]);

  useEffect(() => {
    let active = true;
    setFrameLoaded(false);
    setProbeState("checking");

    async function probeScene() {
      try {
        await fetch(sceneUrl, { mode: "no-cors", cache: "no-store" });
        if (!active) {
          return;
        }
        setProbeState("ready");
      } catch {
        if (!active) {
          return;
        }
        setProbeState("failed");
      }
    }

    probeScene();
    return () => {
      active = false;
    };
  }, [sceneUrl, refreshKey]);

  useEffect(() => {
    const allowedOrigin = new URL(runtimeConfig.sceneBaseUrl).origin;

    const applySceneBridgeSelection = (deviceId: string | null, nodeId: string | null) => {
      const node = nodeId ? systemDiagramTopology.nodes.find((item) => item.id === nodeId) || null : null;
      const resolvedDeviceId = deviceId || node?.primaryDeviceId || null;

      if (node) {
        setSelectedSceneDiagramNodeId(node.id);
        if (
          node.category === "chiller" ||
          node.category === "pump" ||
          node.category === "cooling-tower" ||
          node.category === "valve"
        ) {
          setForcedModelCategory(node.category);
        } else {
          setForcedModelCategory(null);
        }
      } else {
        setSelectedSceneDiagramNodeId(null);
        setForcedModelCategory(null);
      }

      if (resolvedDeviceId) {
        setSelectedDeviceId(resolvedDeviceId);
      }
    };

    const handleSceneMessage = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin) {
        return;
      }
      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) {
        return;
      }

      const selection = resolveSceneIframeSelection(
        event.data as Record<string, unknown>,
        sceneDevices,
        systemDiagramTopology
      );

      if (!selection.deviceId && !selection.nodeId) {
        return;
      }

      applySceneBridgeSelection(selection.deviceId, selection.nodeId);
    };

    window.addEventListener("message", handleSceneMessage);
    return () => {
      window.removeEventListener("message", handleSceneMessage);
    };
  }, [sceneDevices, systemDiagramTopology]);

  useEffect(() => {
    let active = true;
    setDevicePanelState("loading");
    setSelectedDeviceDetail(null);
    setSceneDevices([]);
    setSceneSystemDiagram(null);

    async function loadSceneDevices() {
      try {
        const forcedContractDiagram =
          diagramMode === "contract-sample" ? buildSystemDiagramFromContract(SYSTEM_DIAGRAM_CONTRACT_SAMPLE) : null;
        const [deviceResult, topologyResult, diagramResult] = await Promise.allSettled([
          fetchDeviceList(runtimeConfig.siteId, {
            page: 1,
            pageSize: 12,
            floor: buildSceneDeviceFloorName(floor)
          }),
          fetchSystemTopology(runtimeConfig.siteId),
          fetchSystemDiagram(runtimeConfig.siteId, {
            layoutMode: "auto",
            scope: "full"
          })
        ]);
        if (!active) {
          return;
        }
        const items = deviceResult.status === "fulfilled" ? deviceResult.value.items || [] : [];
        const diagram =
          forcedContractDiagram ||
          (diagramResult.status === "fulfilled" ? buildSystemDiagramFromContract(diagramResult.value) : null);
        setSceneDevices(items);
        setSceneTopology(topologyResult.status === "fulfilled" ? topologyResult.value : null);
        setSceneSystemDiagram(diagram);
        setDevicePanelState(
          items.length > 0 || topologyResult.status === "fulfilled" || Boolean(diagram) ? "ready" : "failed"
        );
      } catch {
        if (!active) {
          return;
        }
        setSceneTopology(null);
        setSceneSystemDiagram(null);
        setDevicePanelState("failed");
      }
    }

    loadSceneDevices();
    return () => {
      active = false;
    };
  }, [diagramMode, floor]);

  useEffect(() => {
    let active = true;
    if (!selectedDeviceId) {
      setSelectedDeviceDetail(null);
      return;
    }
    const deviceId = selectedDeviceId;

    setDetailLoading(true);
    async function loadDeviceDetail() {
      try {
        const detail = await fetchDeviceDetail(runtimeConfig.siteId, deviceId, {
          build: 1,
          floor: buildSceneDeviceFloorQuery(floor)
        });
        if (!active) {
          return;
        }
        setSelectedDeviceDetail(detail);
      } catch {
        if (!active) {
          return;
        }
        setSelectedDeviceDetail(null);
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    loadDeviceDetail();
    return () => {
      active = false;
    };
  }, [selectedDeviceId, floor]);

  const summary =
    probeState === "ready"
      ? frameLoaded
        ? zhCN.sceneControl.bannerReady
        : zhCN.sceneControl.bannerLoading
      : probeState === "checking"
        ? zhCN.sceneControl.bannerChecking
        : zhCN.sceneControl.bannerFailed;

  const sceneStateLabel =
    probeState === "ready"
      ? zhCN.sceneControl.stateEmbedded
      : probeState === "checking"
        ? zhCN.sceneControl.stateChecking
        : zhCN.sceneControl.stateDegraded;

  const detailLines = [
    `${zhCN.sceneControl.detailMode}: ${legacyAssetLabel}`,
    `${zhCN.sceneControl.detailFloor}: ${floor}${zhCN.sceneControl.floorSuffix}`,
    `${zhCN.sceneControl.detailLegacyRoute}: ${sceneUrl}`,
    `${zhCN.sceneControl.detailStrategy}: ${zhCN.sceneControl.strategyEmbed}`
  ];

  const previewTone = probeState === "ready" ? (frameLoaded ? "good" : "neutral") : "warn";
  const selectedSceneDevice = sceneDevices.find((item) => item.deviceId === selectedDeviceId) || null;
  const selectedSceneDetail = selectedDeviceDetail?.detail || null;
  const selectedSceneFloorName = selectedSceneDevice?.floorName || buildSceneDeviceFloorName(floor);
  const selectedSceneBuildingName = selectedSceneDevice?.buildingName || zhCN.common.unknown;
  const selectedModelSystemType = normalizeSceneModelSystemType(selectedSceneDetail, selectedSceneDevice);
  const selectedModelName = selectedSceneDevice?.deviceName || zhCN.sceneControl.modelExperimentFallbackName;
  const selectedModelCategory = forcedModelCategory || resolveSceneModelCategory(selectedModelSystemType);
  const modelCatalog = getDeviceModelCatalog();
  const selectedNodeFromDevice = useMemo(
    () => findSystemDiagramNodeByDeviceId(systemDiagramTopology, selectedDeviceId),
    [selectedDeviceId, systemDiagramTopology]
  );
  const scenePresets: Array<{ mode: SceneMode; floor: SceneFloor }> = [
    { mode: "2d", floor: "10" },
    { mode: "2d", floor: "11" },
    { mode: "3d", floor: "10" },
    { mode: "3d", floor: "11" }
  ];
  const selectedDiagramNode =
    systemDiagramTopology.nodes.find((item) => item.id === selectedSceneDiagramNodeId) ||
    selectedNodeFromDevice ||
    systemDiagramTopology.nodes[0] ||
    null;
  const selectedDiagramDeviceHref =
    selectedDiagramNode?.primaryDeviceId
      ? `/devices?floor=${encodeURIComponent(buildSceneDeviceFloorName(floor))}&deviceId=${encodeURIComponent(selectedDiagramNode.primaryDeviceId)}&sceneMode=${encodeURIComponent(mode)}&sceneNodeId=${encodeURIComponent(selectedDiagramNode.id)}`
      : null;
  const activeCompatData = legacySceneView === "dialog" ? legacyTrendData : legacySceneView === "online" ? onlineMonitorData : null;
  const activeCompatPoints = activeCompatData?.points || [];
  const activeCompatTitle =
    legacySceneView === "dialog"
      ? legacyTrendData?.title || legacyDialogQuery.title || zhCN.sceneControl.compatDialogFallbackTitle
      : legacySceneView === "online"
        ? onlineMonitorData?.title || zhCN.sceneControl.compatOnlineFallbackTitle
        : "";
  const activeCompatUnit =
    legacySceneView === "dialog"
      ? legacyTrendData?.unit || legacyDialogQuery.unit || null
      : legacySceneView === "online"
        ? onlineMonitorData?.unit || null
        : null;
  const activeCompatLoading =
    legacySceneView === "dialog" ? legacyTrendLoading : legacySceneView === "online" ? onlineMonitorLoading : false;
  const activeCompatError =
    legacySceneView === "dialog" ? legacyTrendError : legacySceneView === "online" ? onlineMonitorError : null;
  const compatSourceSummary = useMemo(
    () => summarizeSourceStatus([activeCompatData?.sourceStatus]),
    [activeCompatData?.sourceStatus]
  );
  const compatSourceLines = useMemo(
    () => buildSourceStatusLines([activeCompatData?.sourceStatus]),
    [activeCompatData?.sourceStatus]
  );
  const compatBannerText =
    legacySceneView === "dialog"
      ? activeCompatLoading
        ? zhCN.sceneControl.compatDialogLoading
        : activeCompatError || zhCN.sceneControl.compatDialogReady
      : legacySceneView === "online"
        ? activeCompatLoading
          ? zhCN.sceneControl.compatOnlineLoading
          : activeCompatError || zhCN.sceneControl.compatOnlineReady
        : "";
  const compatNumericPoints = activeCompatPoints.filter(
    (item): item is SceneLegacyPointDto & { value: number } =>
      typeof item.value === "number" && Number.isFinite(item.value)
  );
  const compatLatestPoint =
    compatNumericPoints.length > 0 ? compatNumericPoints[compatNumericPoints.length - 1] : null;
  const compatMaxPoint =
    compatNumericPoints.length > 0
      ? compatNumericPoints.reduce((current, item) => (item.value > current.value ? item : current))
      : null;
  const compatMinPoint =
    compatNumericPoints.length > 0
      ? compatNumericPoints.reduce((current, item) => (item.value < current.value ? item : current))
      : null;

  useEffect(() => {
    if (devicePanelState !== "ready") {
      return;
    }

    const matchedRequestedNode =
      (requestedNodeId && systemDiagramTopology.nodes.find((node) => node.id === requestedNodeId)) || null;
    const matchedRequestedDevice =
      (requestedDeviceId && sceneDevices.find((item) => item.deviceId === requestedDeviceId)) || null;
    const preferredNode =
      matchedRequestedNode ||
      findSystemDiagramNodeByDeviceId(systemDiagramTopology, matchedRequestedDevice?.deviceId) ||
      (selectedSceneDiagramNodeId
        ? systemDiagramTopology.nodes.find((node) => node.id === selectedSceneDiagramNodeId) || null
        : null) ||
      findSystemDiagramNodeByDeviceId(systemDiagramTopology, selectedDeviceId) ||
      systemDiagramTopology.nodes[0] ||
      null;
    const preferredDeviceId =
      matchedRequestedDevice?.deviceId ||
      preferredNode?.primaryDeviceId ||
      selectedDeviceId ||
      sceneDevices[0]?.deviceId ||
      null;

    if (preferredNode?.id && preferredNode.id !== selectedSceneDiagramNodeId) {
      setSelectedSceneDiagramNodeId(preferredNode.id);
    }

    if (preferredDeviceId !== selectedDeviceId) {
      setSelectedDeviceId(preferredDeviceId);
    }

    if (preferredNode) {
      if (
        preferredNode.category === "chiller" ||
        preferredNode.category === "pump" ||
        preferredNode.category === "cooling-tower" ||
        preferredNode.category === "valve"
      ) {
        setForcedModelCategory(preferredNode.category);
      } else {
        setForcedModelCategory(null);
      }
    }
  }, [
    devicePanelState,
    requestedDeviceId,
    requestedNodeId,
    sceneDevices,
    selectedDeviceId,
    selectedSceneDiagramNodeId,
    systemDiagramTopology
  ]);

  const handleSystemDiagramSelect = (nodeId: string) => {
    const node = systemDiagramTopology.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    setSelectedSceneDiagramNodeId(node.id);
    if (node.category === "chiller" || node.category === "pump" || node.category === "cooling-tower" || node.category === "valve") {
      setForcedModelCategory(node.category);
    } else {
      setForcedModelCategory(null);
    }
    if (node.primaryDeviceId) {
      setSelectedDeviceId(node.primaryDeviceId);
    }
  };

  const handleSceneDeviceSelect = (deviceId: string | null) => {
    setSelectedDeviceId(deviceId);
    const matchedNode = findSystemDiagramNodeByDeviceId(systemDiagramTopology, deviceId);
    if (matchedNode) {
      setSelectedSceneDiagramNodeId(matchedNode.id);
      if (
        matchedNode.category === "chiller" ||
        matchedNode.category === "pump" ||
        matchedNode.category === "cooling-tower" ||
        matchedNode.category === "valve"
      ) {
        setForcedModelCategory(matchedNode.category);
      }
    } else {
      setSelectedSceneDiagramNodeId(null);
      setForcedModelCategory(null);
    }
  };

  const handleLegacyDialogSearch = () => {
    if (!legacyDialogFilters.tagname) {
      setLegacyTrendError(zhCN.sceneControl.compatDialogMissingTagname);
      return;
    }
    setLegacyDialogQuery({
      ...legacyDialogFilters,
      date: legacyDialogFilters.date || formatDateInput(new Date())
    });
  };

  const handleLegacyDialogExport = () => {
    if (legacySceneView !== "dialog" || compatNumericPoints.length === 0) {
      return;
    }
    const filename = `${activeCompatTitle || zhCN.sceneControl.compatDialogFallbackTitle}-${legacyDialogQuery.date}.csv`;
    downloadSceneCsv(
      filename,
      [zhCN.sceneControl.compatTableTime, activeCompatTitle || zhCN.sceneControl.compatTableValue],
      compatNumericPoints.map((item) => [item.label || "--", item.value])
    );
  };

  return (
    <div className="scene-page page-enter">
      <SourceStatusBanner
        summary={summary}
        warn={warn}
        detailLines={detailLines}
        detailLinesCompact={detailLines}
      />

      <section className="scene-page-header">
        <div>
          <h2>{zhCN.sceneControl.heading}</h2>
          <p>{zhCN.sceneControl.subtitle}</p>
        </div>
        <div className="scene-header-actions">
          <button type="button" className="scene-secondary-action" onClick={() => setRefreshKey((value) => value + 1)}>
            {zhCN.sceneControl.refreshProbe}
          </button>
          <a className="scene-open-link" href={sceneUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            {zhCN.sceneControl.openExternal}
          </a>
        </div>
      </section>

      <div className="scene-summary-grid">
        <article className="scene-summary-card">
          <span>{zhCN.sceneControl.summaryMode}</span>
          <strong>{legacyAssetLabel}</strong>
          <small>{zhCN.sceneControl.summaryModeHint}</small>
        </article>
        <article className="scene-summary-card">
          <span>{zhCN.sceneControl.summaryFloor}</span>
          <strong>{floor}{zhCN.sceneControl.floorSuffix}</strong>
          <small>{zhCN.sceneControl.summaryFloorHint}</small>
        </article>
        <article className="scene-summary-card">
          <span>{zhCN.sceneControl.summaryState}</span>
          <strong>{sceneStateLabel}</strong>
          <small>{zhCN.sceneControl.summaryStateHint}</small>
        </article>
      </div>

      {legacySceneView === "video" ? (
        <SectionCard title={zhCN.sceneControl.sectionLegacyVideo}>
          <div className="scene-compat-empty">
            <strong>{zhCN.sceneControl.compatVideoTitle}</strong>
            <p>{zhCN.sceneControl.compatVideoBody}</p>
          </div>
        </SectionCard>
      ) : legacySceneView !== "default" ? (
        <SectionCard
          title={
            legacySceneView === "dialog"
              ? zhCN.sceneControl.sectionLegacyTrend
              : zhCN.sceneControl.sectionOnlineMonitor
          }
        >
          <SourceStatusBanner
            summary={compatBannerText}
            warn={Boolean(activeCompatError) || compatSourceSummary.warn}
            detailLines={compatSourceLines}
            detailLinesCompact={compatSourceLines}
          />

          <div className="scene-compat-header">
            <div>
              <strong>
                {legacySceneView === "dialog"
                  ? zhCN.sceneControl.compatDialogTitle
                  : zhCN.sceneControl.compatOnlineTitle}
              </strong>
              <p>
                {legacySceneView === "dialog"
                  ? zhCN.sceneControl.compatDialogBody
                  : zhCN.sceneControl.compatOnlineBody}
              </p>
            </div>
            {legacySceneView === "dialog" ? (
              <div className="scene-compat-actions">
                <button type="button" className="scene-secondary-action" onClick={handleLegacyDialogSearch}>
                  {zhCN.sceneControl.compatSearch}
                </button>
                <button
                  type="button"
                  className="scene-secondary-action"
                  onClick={handleLegacyDialogExport}
                  disabled={compatNumericPoints.length === 0}
                >
                  {zhCN.sceneControl.compatExport}
                </button>
              </div>
            ) : null}
          </div>

          {legacySceneView === "dialog" ? (
            <div className="scene-compat-filter-grid">
              <label className="scene-compat-field">
                <span>{zhCN.sceneControl.compatMetricName}</span>
                <input value={legacyDialogFilters.title} readOnly />
              </label>
              <label className="scene-compat-field">
                <span>{zhCN.sceneControl.compatTagname}</span>
                <input value={legacyDialogFilters.tagname} readOnly />
              </label>
              <label className="scene-compat-field">
                <span>{zhCN.sceneControl.compatDate}</span>
                <input
                  type="date"
                  value={legacyDialogFilters.date}
                  onChange={(event) =>
                    setLegacyDialogFilters((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}

          {activeCompatLoading ? (
            <p className="empty-hint">{zhCN.sceneControl.compatLoading}</p>
          ) : activeCompatError ? (
            <p className="empty-hint">{activeCompatError}</p>
          ) : compatNumericPoints.length === 0 ? (
            <p className="empty-hint">
              {legacySceneView === "online"
                ? zhCN.sceneControl.compatOnlineEmpty
                : zhCN.sceneControl.compatEmpty}
            </p>
          ) : (
            <div className="scene-compat-grid">
              <div className="scene-compat-main">
                <div className="detail-grid">
                  <article>
                    <label>{zhCN.sceneControl.compatSummaryLatest}</label>
                    <strong>{formatSceneMetricValue(compatLatestPoint?.value, activeCompatUnit)}</strong>
                    <small className="scene-compat-card-hint">{compatLatestPoint?.label || zhCN.common.unknown}</small>
                  </article>
                  <article>
                    <label>{zhCN.sceneControl.compatSummaryPeak}</label>
                    <strong>{formatSceneMetricValue(compatMaxPoint?.value, activeCompatUnit)}</strong>
                    <small className="scene-compat-card-hint">{compatMaxPoint?.label || zhCN.common.unknown}</small>
                  </article>
                  <article>
                    <label>{zhCN.sceneControl.compatSummaryLowest}</label>
                    <strong>{formatSceneMetricValue(compatMinPoint?.value, activeCompatUnit)}</strong>
                    <small className="scene-compat-card-hint">{compatMinPoint?.label || zhCN.common.unknown}</small>
                  </article>
                  <article>
                    <label>{zhCN.sceneControl.compatSummaryPoints}</label>
                    <strong>{compatNumericPoints.length}</strong>
                    <small className="scene-compat-card-hint">{zhCN.sceneControl.compatSummaryPointsHint}</small>
                  </article>
                </div>

                <SceneLegacyTrendChart
                  points={activeCompatPoints}
                  title={activeCompatTitle}
                  unit={activeCompatUnit}
                  ariaLabel={
                    legacySceneView === "dialog"
                      ? zhCN.sceneControl.compatDialogChartAria
                      : zhCN.sceneControl.compatOnlineChartAria
                  }
                />
              </div>

              <aside className="scene-compat-side">
                <div className="scene-compat-meta">
                  <article>
                    <label>{zhCN.sceneControl.compatDataTitle}</label>
                    <strong>{activeCompatTitle || zhCN.common.unknown}</strong>
                  </article>
                  <article>
                    <label>{zhCN.sceneControl.compatDataUnit}</label>
                    <strong>{activeCompatUnit || zhCN.sceneControl.compatUnitPending}</strong>
                  </article>
                  <article>
                    <label>{zhCN.sceneControl.compatDataSource}</label>
                    <strong>
                      {legacySceneView === "dialog"
                        ? zhCN.sceneControl.compatDataSourceDialog
                        : zhCN.sceneControl.compatDataSourceOnline}
                    </strong>
                  </article>
                </div>

                {legacySceneView === "dialog" ? (
                  <div className="scene-compat-table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th>{zhCN.sceneControl.compatTableTime}</th>
                          <th>{activeCompatTitle || zhCN.sceneControl.compatTableValue}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compatNumericPoints.slice().reverse().map((item, index) => (
                          <tr key={`${item.label || "scene-row"}-${index}`}>
                            <td>{item.label || "--"}</td>
                            <td>{formatSceneMetricValue(item.value, activeCompatUnit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="scene-compat-note">
                    <strong>{zhCN.sceneControl.compatOnlineNoteTitle}</strong>
                    <p>{zhCN.sceneControl.compatOnlineNoteBody}</p>
                  </div>
                )}
              </aside>
            </div>
          )}
        </SectionCard>
      ) : null}

      <div className="scene-layout">
        <SectionCard title={zhCN.sceneControl.sectionControls}>
          <div className="scene-controls">
            <div className="scene-toggle-group">
              <span>{zhCN.sceneControl.controlMode}</span>
              <div className="scene-toggle-row">
                <button
                  type="button"
                  className={mode === "2d" ? "active" : ""}
                  onClick={() => setMode("2d")}
                >
                  {zhCN.sceneControl.mode2d}
                </button>
                <button
                  type="button"
                  className={mode === "3d" ? "active" : ""}
                  onClick={() => setMode("3d")}
                >
                  {zhCN.sceneControl.mode3d}
                </button>
              </div>
            </div>

            <div className="scene-toggle-group">
              <span>{zhCN.sceneControl.controlFloor}</span>
              <div className="scene-toggle-row">
                <button
                  type="button"
                  className={floor === "10" ? "active" : ""}
                  onClick={() => setFloor("10")}
                >
                  10{zhCN.sceneControl.floorSuffix}
                </button>
                <button
                  type="button"
                  className={floor === "11" ? "active" : ""}
                  onClick={() => setFloor("11")}
                >
                  11{zhCN.sceneControl.floorSuffix}
                </button>
              </div>
            </div>

            <div className="scene-notes">
              <article>
                <label>{zhCN.sceneControl.noteEmbed}</label>
                <strong>{zhCN.sceneControl.noteEmbedValue}</strong>
              </article>
              <article>
                <label>{zhCN.sceneControl.noteEngine}</label>
                <strong>{zhCN.sceneControl.noteEngineValue}</strong>
              </article>
              <article>
                <label>{zhCN.sceneControl.noteScope}</label>
                <strong>{zhCN.sceneControl.noteScopeValue}</strong>
              </article>
            </div>

            <div className="scene-toggle-group">
              <span>{zhCN.sceneControl.sectionQuickAccess}</span>
              <div className="scene-preset-grid">
                {scenePresets.map((preset) => {
                  const active = preset.mode === mode && preset.floor === floor;
                  const label = `${preset.mode === "2d" ? zhCN.sceneControl.mode2d : zhCN.sceneControl.mode3d} · ${preset.floor}${zhCN.sceneControl.floorSuffix}`;
                  return (
                    <button
                      key={`${preset.mode}-${preset.floor}`}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => {
                        setMode(preset.mode);
                        setFloor(preset.floor);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="scene-toggle-group">
              <span>{zhCN.sceneControl.sectionLinkedDevices}</span>
              {devicePanelState === "failed" ? (
                <div className="scene-device-panel scene-device-panel-empty">
                  <strong>{zhCN.sceneControl.linkedDevicesFailed}</strong>
                  <p>{zhCN.sceneControl.linkedDevicesFailedHint}</p>
                </div>
              ) : devicePanelState === "loading" ? (
                <div className="scene-device-panel scene-device-panel-empty">
                  <strong>{zhCN.sceneControl.linkedDevicesLoading}</strong>
                </div>
              ) : (
                <div className="scene-device-panel">
                  <div className="scene-device-list">
                    {sceneDevices.map((item, index) => {
                      const active = item.deviceId === selectedDeviceId;
                      return (
                        <button
                          key={item.deviceId || `${item.deviceCode || "scene-device"}-${index + 1}`}
                          type="button"
                          className={active ? "scene-device-button active" : "scene-device-button"}
                          onClick={() => handleSceneDeviceSelect(item.deviceId || null)}
                        >
                          <strong>{item.deviceName || zhCN.common.unknown}</strong>
                          <small>{item.deviceCode || zhCN.common.unknown}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="scene-device-detail">
                    {selectedSceneDevice ? (
                      <>
                        <div className="scene-device-detail-header">
                          <strong>{selectedSceneDevice.deviceName || zhCN.common.unknown}</strong>
                          <StatusPill
                            label={detailLoading ? zhCN.sceneControl.stateChecking : mapDeviceStatusLabel(selectedSceneDevice.status)}
                            tone={detailLoading ? "neutral" : "good"}
                          />
                        </div>
                        <p>{selectedSceneDevice.deviceCode || zhCN.common.unknown}</p>
                        <dl>
                          <div>
                            <dt>{zhCN.devicePage.detailType}</dt>
                            <dd>{selectedSceneDetail?.deviceTypeName || selectedSceneDevice.usageType || zhCN.common.unknown}</dd>
                          </div>
                          <div>
                            <dt>{zhCN.devicePage.detailFloor}</dt>
                            <dd>{selectedSceneFloorName}</dd>
                          </div>
                          <div>
                            <dt>{zhCN.devicePage.detailBuilding}</dt>
                            <dd>{selectedSceneBuildingName}</dd>
                          </div>
                          <div>
                            <dt>{zhCN.devicePage.detailStatus}</dt>
                            <dd>{selectedSceneDetail?.runStatusText || zhCN.devicePage.detailValuePending}</dd>
                          </div>
                          <div>
                            <dt>{zhCN.devicePage.detailAlarmStatus}</dt>
                            <dd>{selectedSceneDetail?.alarmStatusText || zhCN.devicePage.detailValuePending}</dd>
                          </div>
                          <div>
                            <dt>{zhCN.devicePage.detailLastReport}</dt>
                            <dd>{selectedSceneDetail?.latestUpdateAt || selectedSceneDevice.lastReportAt || zhCN.common.timeUnknown}</dd>
                          </div>
                        </dl>
                        {selectedSceneDevice.deviceId ? (
                          <Link
                            className="scene-open-link scene-device-link"
                            to={`/devices?floor=${encodeURIComponent(buildSceneDeviceFloorName(floor))}&deviceId=${encodeURIComponent(selectedSceneDevice.deviceId)}&sceneMode=${encodeURIComponent(mode)}${selectedSceneDiagramNodeId ? `&sceneNodeId=${encodeURIComponent(selectedSceneDiagramNodeId)}` : ""}`}
                          >
                            {zhCN.sceneControl.openInDevicePage}
                          </Link>
                        ) : null}
                      </>
                    ) : (
                      <div className="scene-device-panel-empty">
                        <strong>{zhCN.sceneControl.linkedDevicesEmpty}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={zhCN.sceneControl.sectionPreview}
          action={<StatusPill label={sceneStateLabel} tone={previewTone} />}
        >
          <div className="scene-preview-grid">
            <div className="scene-preview-main">
              <div className="scene-preview">
                {probeState === "failed" ? (
                  <div className="scene-fallback">
                    <strong>{zhCN.sceneControl.previewUnavailableTitle}</strong>
                    <p>{zhCN.sceneControl.previewUnavailableBody}</p>
                    <small>{sceneUrl}</small>
                  </div>
                ) : (
                  <iframe
                    key={`${sceneUrl}-${refreshKey}`}
                    title={`scene-${mode}-${floor}`}
                    src={sceneUrl}
                    onLoad={() => setFrameLoaded(true)}
                  />
                )}
              </div>
            </div>

            <aside className="scene-model-lab">
              <div className="scene-model-lab-copy">
                <span>{zhCN.sceneControl.modelExperimentEyebrow}</span>
                <strong>{zhCN.sceneControl.modelExperimentTitleReady}</strong>
                <p>{zhCN.sceneControl.modelExperimentBodyReady}</p>
              </div>

              <div className="device-model-switch">
                <div className="device-model-switch-header">
                  <strong>{zhCN.sceneControl.modelSwitchTitle}</strong>
                  <small>{zhCN.sceneControl.modelSwitchHint}</small>
                </div>
                <div className="device-model-switch-row">
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

              <div className="scene-model-catalog">
                {modelCatalog.map((item) => {
                  const active = item.category === selectedModelCategory;
                  const tone = item.intakeStatus === "ready" ? "good" : "neutral";
                  return (
                    <div key={item.id} className={active ? "scene-model-chip active" : "scene-model-chip"}>
                      <strong>{item.displayName}</strong>
                      <StatusPill
                        label={item.intakeStatus === "ready" ? zhCN.sceneControl.modelCatalogReady : zhCN.sceneControl.modelCatalogPlanned}
                        tone={tone}
                      />
                    </div>
                  );
                })}
              </div>

              <DeviceModelPreview
                deviceName={selectedModelName}
                systemType={selectedModelSystemType}
                forcedCategory={forcedModelCategory}
              />

              <SystemDiagram3D
                topology={systemDiagramTopology}
                selectedNodeId={selectedSceneDiagramNodeId}
                onNodeSelect={(node) => handleSystemDiagramSelect(node.id)}
                devicePageHref={selectedDiagramDeviceHref}
              />

              <div className="scene-system-diagram-source">
                <span>{zhCN.sceneControl.systemDiagramSourceLabel}</span>
                <strong>{systemDiagramSourceLabel}</strong>
              </div>

              <div className="scene-model-lab-note">
                <strong>{zhCN.sceneControl.modelExperimentNoteTitle}</strong>
                <p>{zhCN.sceneControl.modelExperimentNoteBody}</p>
              </div>
            </aside>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

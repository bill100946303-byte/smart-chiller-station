import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { PlantOverviewSiteProfile } from "../../config/plantOverviewRegistry";
import type { RuntimePointSummaryDto } from "../../services/bffClient";
import {
  loadRuntimeReplayHistory,
  persistRuntimeReplayHistory,
  resolvePlantOverviewRuntimeSnapshot,
  type EquipmentOperationalState,
  type PlantOverviewEquipmentMetric,
  type PlantOverviewEquipmentSelection,
  type PlantOverviewRuntimeEquipmentView,
  type RuntimeReplayHistoryEntry
} from "./PlantOverview3D";
import "./PlantOverview2D.css";

type PlantOverview2DProps = {
  profile: PlantOverviewSiteProfile;
  runtimeSummary: RuntimePointSummaryDto | null;
  runtimeScopeKey: string;
  inspectedEquipmentId?: string | null;
  onEquipmentSelectionChange?: (selection: PlantOverviewEquipmentSelection | null) => void;
  onReady?: () => void;
};

type LoadState = "loading" | "ready" | "error";

const STATE_GLYPHS: Record<EquipmentOperationalState, string> = {
  running: "▶",
  fault: "▲!",
  standby: "Ⅱ",
  stopped: "■",
  unknown: "?"
};

const STATE_LABELS: Record<EquipmentOperationalState, string> = {
  running: "运行",
  fault: "故障",
  standby: "待机",
  stopped: "停机",
  unknown: "未确认"
};

function formatMetricValue(metric: PlantOverviewEquipmentMetric | undefined, compact: boolean): string {
  if (!metric || metric.value === null) {
    return "--";
  }
  const digits = compact ? 0 : 1;
  return `${metric.value.toFixed(digits)}${metric.unit}`;
}

function resolvePrimaryMetric(view: PlantOverviewRuntimeEquipmentView): PlantOverviewEquipmentMetric | undefined {
  return view.selection.runtimeGroup === "chillers"
    ? view.metrics.find((metric) => metric.key === "loadPercent")
    : view.metrics.find((metric) => metric.key === "frequencyHz");
}

function pointStateFor(
  view: PlantOverviewRuntimeEquipmentView,
  metric: PlantOverviewEquipmentMetric | undefined
): "LIVE" | "STALE" | "FAULT" | "UNBOUND" {
  if (view.selection.state === "fault") {
    return "FAULT";
  }
  if (!metric || metric.value === null || metric.evidenceMode === "unbound") {
    return "UNBOUND";
  }
  return metric.evidenceMode === "live" ? "LIVE" : "STALE";
}

function updateEquipmentRuntimeVisual(
  documentNode: Document,
  equipmentId: string,
  view: PlantOverviewRuntimeEquipmentView,
  selectedEquipmentId: string | null
): void {
  const equipment = documentNode.querySelector<SVGGElement>(`[data-id="${equipmentId}"]`);
  if (!equipment) {
    return;
  }
  const { selection } = view;
  const stateGlyph = STATE_GLYPHS[selection.state];
  const primaryMetric = resolvePrimaryMetric(view);
  const pointState = pointStateFor(view, primaryMetric);
  const isCompact = selection.runtimeGroup === "coolingTowers";
  const metricText = formatMetricValue(primaryMetric, isCompact);
  const parameterText = isCompact
    ? `${stateGlyph}${metricText}`
    : `${stateGlyph} ${metricText}`;
  const evidenceText = selection.evidenceMode === "shadow"
    ? "SHADOW · 时效不可证"
    : selection.evidenceMode.toUpperCase();

  equipment.classList.add(
    "runtime-equipment",
    `is-state-${selection.state}`,
    `is-evidence-${selection.evidenceMode}`
  );
  if (selectedEquipmentId === equipmentId) {
    equipment.classList.add("is-selected");
  }
  equipment.setAttribute("data-runtime-equipment", "true");
  equipment.setAttribute("data-equipment-operational-state", selection.state);
  equipment.setAttribute("data-equipment-state-evidence", selection.evidenceMode);
  equipment.setAttribute("data-equipment-status-shape", `${selection.state}-${stateGlyph}`);
  equipment.setAttribute("data-runtime-motion-enabled", view.motionEnabled ? "true" : "false");
  equipment.setAttribute("data-runtime-playback-rate", view.playbackRate.toFixed(3));
  equipment.setAttribute("role", "button");
  equipment.setAttribute("tabindex", "0");
  equipment.setAttribute("aria-label", `${equipmentId} ${STATE_LABELS[selection.state]}，${metricText}，${evidenceText}`);

  const pointBinding = equipment.querySelector<SVGGElement>(`.point-binding[data-model-id="${equipmentId}"]`);
  if (pointBinding) {
    pointBinding.setAttribute("data-point-state", pointState);
    pointBinding.setAttribute("data-evidence", primaryMetric?.evidenceMode || "unbound");
    pointBinding.setAttribute("data-observed-at", primaryMetric?.observedAt || "");
    pointBinding.setAttribute("data-runtime-point-key", primaryMetric?.pointKey || "");
    const textNode = pointBinding.querySelector("text");
    if (textNode) {
      textNode.textContent = parameterText;
    }
  }

  const titleNode = documentNode.createElementNS("http://www.w3.org/2000/svg", "title");
  titleNode.textContent = `${equipmentId} · ${STATE_LABELS[selection.state]} · ${metricText} · ${evidenceText}`;
  equipment.insertBefore(titleNode, equipment.firstChild);
}

function buildRuntimeSvg(
  source: string,
  snapshot: ReturnType<typeof resolvePlantOverviewRuntimeSnapshot>,
  selectedEquipmentId: string | null
): string {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, "image/svg+xml");
  const root = documentNode.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || root.getAttribute("data-point-binding-count") !== "64") {
    throw new Error("B25 2D SVG contract mismatch");
  }

  root.setAttribute("data-runtime-binding", "exact-deviceid-tagname-read-only");
  root.setAttribute("data-runtime-evidence", snapshot.evidenceState);
  root.setAttribute("data-runtime-identity-verified", snapshot.identityVerified ? "true" : "false");
  root.setAttribute("data-runtime-state-readable-count", String(snapshot.readableEquipmentStateCount));
  root.setAttribute("data-runtime-live-state-count", String(snapshot.liveEquipmentStateCount));
  root.setAttribute("data-runtime-shadow-state-count", String(snapshot.shadowEquipmentStateCount));
  root.setAttribute("data-flow-evidence", "schematic");
  root.setAttribute("data-control-boundary", "read-only-no-ba-plc-write");

  snapshot.equipmentById.forEach((view, equipmentId) => {
    updateEquipmentRuntimeVisual(documentNode, equipmentId, view, selectedEquipmentId);
  });

  const headerStatus = [...documentNode.querySelectorAll("#header text")].find((node) => node.textContent === "UNBOUND");
  if (headerStatus) {
    const readable = snapshot.readableEquipmentStateCount;
    headerStatus.textContent = snapshot.evidenceState === "LIVE"
      ? `LIVE ${readable}/54`
      : snapshot.shadowEquipmentStateCount > 0
        ? `SHADOW ${readable}/54`
        : `${snapshot.evidenceState} ${readable}/54`;
  }

  const legendText = documentNode.querySelector("#legend .status-text");
  if (legendText) {
    legendText.textContent = snapshot.shadowEquipmentStateCount > 0
      ? "SHADOW：精确值可读，时效不可证"
      : snapshot.evidenceState === "LIVE"
        ? "LIVE：权威时间与重放证据通过"
        : "STALE/UNBOUND：不推断设备状态";
  }

  return new XMLSerializer().serializeToString(root);
}

function closestRuntimeEquipment(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('[data-runtime-equipment="true"]') : null;
}

export default function PlantOverview2D({
  profile,
  runtimeSummary,
  runtimeScopeKey,
  inspectedEquipmentId = null,
  onEquipmentSelectionChange,
  onReady
}: PlantOverview2DProps) {
  const [svgSource, setSvgSource] = useState("");
  const [bindingContract, setBindingContract] = useState<unknown>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadMessage, setLoadMessage] = useState("正在读取2D模型与运行点位合同");
  const [runtimeClockMs, setRuntimeClockMs] = useState(() => Date.now());
  const replayHistoryRef = useRef<Map<string, RuntimeReplayHistoryEntry>>(
    loadRuntimeReplayHistory(runtimeScopeKey)
  );
  const readyReportedRef = useRef(false);

  useEffect(() => {
    replayHistoryRef.current = loadRuntimeReplayHistory(runtimeScopeKey);
  }, [runtimeScopeKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setRuntimeClockMs(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setLoadMessage("正在读取2D模型与运行点位合同");
    setSvgSource("");
    setBindingContract(null);
    readyReportedRef.current = false;
    Promise.all([
      fetch(profile.model2dAssetPath, { cache: "no-cache", signal: controller.signal }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`2D SVG HTTP ${response.status}`);
        }
        return await response.text();
      }),
      fetch(profile.bindingContractPath, { cache: "no-cache", signal: controller.signal }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`绑定合同 HTTP ${response.status}`);
        }
        return await response.json() as unknown;
      })
    ]).then(([source, contract]) => {
      if (controller.signal.aborted) {
        return;
      }
      setSvgSource(source);
      setBindingContract(contract);
      setLoadState("ready");
      setLoadMessage("2D运行态已按精确设备点位接入");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoadState("error");
        setLoadMessage(error instanceof Error ? error.message : "2D运行态加载失败");
      }
    });
    return () => controller.abort();
  }, [profile.bindingContractPath, profile.model2dAssetPath]);

  useEffect(() => {
    if ((loadState === "ready" || loadState === "error") && !readyReportedRef.current) {
      readyReportedRef.current = true;
      onReady?.();
    }
  }, [loadState, onReady]);

  const snapshot = useMemo(() => resolvePlantOverviewRuntimeSnapshot(
    runtimeSummary,
    bindingContract,
    profile.expectedExplicitBindingCount,
    runtimeClockMs,
    replayHistoryRef.current
  ), [bindingContract, profile.expectedExplicitBindingCount, runtimeClockMs, runtimeSummary]);

  useEffect(() => {
    persistRuntimeReplayHistory(runtimeScopeKey, replayHistoryRef.current);
  }, [runtimeScopeKey, snapshot]);

  const runtimeSvgResult = useMemo(() => {
    if (!svgSource || loadState !== "ready") {
      return { svg: "", error: "" };
    }
    try {
      return { svg: buildRuntimeSvg(svgSource, snapshot, inspectedEquipmentId), error: "" };
    } catch (error) {
      return {
        svg: "",
        error: error instanceof Error ? error.message : "2D模型运行态渲染失败"
      };
    }
  }, [inspectedEquipmentId, loadState, snapshot, svgSource]);
  const runtimeSvg = runtimeSvgResult.svg;

  const selectEquipment = (element: Element | null) => {
    const equipmentId = element?.getAttribute("data-id") || "";
    const view = snapshot.equipmentById.get(equipmentId);
    if (view) {
      onEquipmentSelectionChange?.(view.selection);
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const equipment = closestRuntimeEquipment(event.target);
    if (equipment) {
      selectEquipment(equipment);
    } else {
      onEquipmentSelectionChange?.(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const equipment = closestRuntimeEquipment(event.target);
    if (equipment) {
      event.preventDefault();
      selectEquipment(equipment);
    }
  };

  const stateCounts = snapshot.stateCounts;
  const evidenceLabel = snapshot.evidenceState === "LIVE"
    ? "LIVE"
    : snapshot.shadowEquipmentStateCount > 0
      ? "SHADOW · 时效不可证"
      : snapshot.evidenceState;

  return (
    <div
      className="plant-overview-2d-runtime"
      data-b25-plant-overview-2d={profile.model2dPresentation}
      data-plant-2d-evidence={profile.model2dEvidenceMode}
      data-runtime-binding="exact-deviceid-tagname-read-only"
      data-runtime-evidence={snapshot.evidenceState}
      data-flow-evidence="schematic"
      data-scene-control-scope="read-only-no-ba-plc-write"
      data-status-summary-layout="responsive-reserved-region-v1"
      data-runtime-state-readable-count={snapshot.readableEquipmentStateCount}
    >
      <div className="plant-overview-2d-layout">
        {runtimeSvg ? (
          <div
            className="plant-overview-2d-svg"
            role="application"
            aria-label="B25冷站二维运行总览，点击设备查看状态与关键参数"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            dangerouslySetInnerHTML={{ __html: runtimeSvg }}
          />
        ) : (
          <div className={`plant-overview-2d-load is-${loadState}`} role="status">
            <strong>{loadState === "error" ? "2D运行态不可用" : "2D运行态加载中"}</strong>
            <span>{runtimeSvgResult.error || loadMessage}</span>
          </div>
        )}
        <div className="plant-overview-2d-state-summary" aria-label="设备运行状态汇总">
          <strong>设备运行态</strong>
          <span className="is-running">▶ 运行 {stateCounts.running}</span>
          <span className="is-fault">▲! 故障 {stateCounts.fault}</span>
          <span className="is-standby">Ⅱ 待机 {stateCounts.standby}</span>
          <span className="is-stopped">■ 停机 {stateCounts.stopped}</span>
          <span className="is-unknown">? 未确认 {stateCounts.unknown}</span>
          <small>{evidenceLabel} · {snapshot.readableEquipmentStateCount}/{snapshot.expectedEquipmentCount}</small>
        </div>
      </div>
    </div>
  );
}

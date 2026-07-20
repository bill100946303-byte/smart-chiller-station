import { CircleDot } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import chilledPumpImage from "../../assets/dashboard-chain/chilled-pump.png";
import chillerImage from "../../assets/dashboard-chain/chiller-unit.png";
import coolingPumpImage from "../../assets/dashboard-chain/cooling-pump.png";
import coolingTowerImage from "../../assets/dashboard-chain/cooling-tower.png";
import loadImage from "../../assets/dashboard-chain/terminal-load.png";
import { zhCN } from "../../i18n/zhCN";
import { resolveSystemDiagramFlowVisualState } from "./systemDiagramFlow";
import { buildSystemDiagramLayout } from "./systemDiagramLayout";
import SystemDiagramInspector, {
  getSystemDiagramStatusLabel,
  getSystemDiagramTypeLabel
} from "./SystemDiagramInspector";
import type {
  SystemDiagramEdge,
  SystemDiagramEdgeKind,
  SystemDiagramLayoutRole,
  SystemDiagramResolvedNode,
  SystemDiagramTopology
} from "./systemDiagramTypes";

type SystemDiagram2DProps = {
  topology: SystemDiagramTopology;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: SystemDiagramResolvedNode) => void;
  devicePageHref?: string | null;
  operationalEvidence?: boolean;
};

type SystemDiagramViewMode = "all" | "chilled" | "cooling";

type SchematicPosition = {
  x: number;
  y: number;
};

type SchematicNodeGroup = {
  node: SystemDiagramResolvedNode;
  representative: SystemDiagramResolvedNode;
  memberIds: Set<string>;
};

const SCHEMATIC_POSITIONS: Record<SystemDiagramLayoutRole, SchematicPosition> = {
  chiller: { x: 430, y: 290 },
  "valve-chilled": { x: 300, y: 165 },
  "chilled-pump": { x: 145, y: 165 },
  load: { x: 145, y: 415 },
  "valve-cooling": { x: 565, y: 165 },
  "cooling-pump": { x: 720, y: 165 },
  "cooling-tower": { x: 860, y: 400 }
};

const PIPE_COLORS: Record<SystemDiagramEdgeKind, string> = {
  "chilled-supply": "#69e4ff",
  "chilled-return": "#38a9ff",
  "cooling-supply": "#8ff7d7",
  "cooling-return": "#ffc56d"
};

function getViewModeLabel(viewMode: SystemDiagramViewMode) {
  if (viewMode === "chilled") {
    return zhCN.sceneControl.systemDiagramFilterChilled;
  }
  if (viewMode === "cooling") {
    return zhCN.sceneControl.systemDiagramFilterCooling;
  }
  return zhCN.sceneControl.systemDiagramFilterAll;
}

function getNodeImage(node: SystemDiagramResolvedNode) {
  if (node.layoutRole === "chiller") {
    return chillerImage;
  }
  if (node.layoutRole === "chilled-pump") {
    return chilledPumpImage;
  }
  if (node.layoutRole === "cooling-pump") {
    return coolingPumpImage;
  }
  if (node.layoutRole === "cooling-tower") {
    return coolingTowerImage;
  }
  if (node.layoutRole === "load") {
    return loadImage;
  }
  return null;
}

function buildSchematicPath(from: SchematicPosition, to: SchematicPosition, index: number) {
  const directionOffset = index % 2 === 0 ? -12 : 12;
  const midX = (from.x + to.x) / 2 + directionOffset;
  return `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
}

function markerId(topologyId: string, kind: SystemDiagramEdgeKind) {
  return `flow-${topologyId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${kind}`;
}

function buildFlowStyle(speed: number, activeOpacity: number): CSSProperties {
  const durationSeconds = Math.max(0.85, 3.1 - speed * 7.5);
  return {
    "--flow-duration": `${durationSeconds.toFixed(2)}s`,
    "--flow-opacity": activeOpacity.toFixed(3)
  } as CSSProperties;
}

function buildSchematicNodeGroups(nodes: SystemDiagramResolvedNode[]): SchematicNodeGroup[] {
  const nodesByRole = new Map<SystemDiagramLayoutRole, SystemDiagramResolvedNode[]>();
  nodes.forEach((node) => {
    const members = nodesByRole.get(node.layoutRole) || [];
    members.push(node);
    nodesByRole.set(node.layoutRole, members);
  });

  return Array.from(nodesByRole.values()).map((members) => {
    const representative = members[0];
    const instanceCount = members.reduce((total, node) => total + Math.max(node.instanceCount || 1, 1), 0);
    const status = members.some((node) => node.status === "alert")
      ? "alert"
      : members.some((node) => node.status === "running")
        ? "running"
        : "standby";
    return {
      representative,
      memberIds: new Set(members.map((node) => node.id)),
      node: {
        ...representative,
        id: `schematic-group-${representative.layoutRole}`,
        label: getSystemDiagramTypeLabel(representative),
        status,
        instanceCount,
        deviceIds: members.flatMap((node) => node.deviceIds || [])
      }
    };
  });
}

function buildSchematicEdges(
  edges: SystemDiagramEdge[],
  nodes: SystemDiagramResolvedNode[]
): SystemDiagramEdge[] {
  const roleByNodeId = new Map(nodes.map((node) => [node.id, node.layoutRole]));
  const groupedEdges = new Map<string, SystemDiagramEdge>();

  edges.forEach((edge) => {
    const fromRole = roleByNodeId.get(edge.from);
    const toRole = roleByNodeId.get(edge.to);
    if (!fromRole || !toRole) {
      return;
    }
    const key = `${edge.kind}:${fromRole}:${toRole}`;
    const existing = groupedEdges.get(key);
    if (!existing) {
      groupedEdges.set(key, {
        ...edge,
        id: `schematic-edge-${key}`,
        from: fromRole,
        to: toRole
      });
      return;
    }

    if (typeof edge.flowM3h === "number" && Number.isFinite(edge.flowM3h)) {
      existing.flowM3h = (typeof existing.flowM3h === "number" && Number.isFinite(existing.flowM3h)
        ? existing.flowM3h
        : 0) + edge.flowM3h;
    }
    if (edge.flowActive === true || existing.flowActive === true) {
      existing.flowActive = true;
    } else if (edge.flowActive === false && existing.flowActive === false) {
      existing.flowActive = false;
    }
  });

  return Array.from(groupedEdges.values());
}

export default function SystemDiagram2D({
  topology,
  selectedNodeId = null,
  onNodeSelect,
  devicePageHref = null,
  operationalEvidence = true
}: SystemDiagram2DProps) {
  const [viewMode, setViewMode] = useState<SystemDiagramViewMode>("all");
  const filteredTopology = useMemo(() => {
    if (viewMode === "all") {
      return topology;
    }
    const visibleLayoutRoles = viewMode === "chilled"
      ? new Set<SystemDiagramLayoutRole>(["chiller", "chilled-pump", "valve-chilled", "load"])
      : new Set<SystemDiagramLayoutRole>(["chiller", "cooling-pump", "valve-cooling", "cooling-tower"]);
    const visibleEdgeKinds = viewMode === "chilled"
      ? new Set<SystemDiagramEdgeKind>(["chilled-supply", "chilled-return"])
      : new Set<SystemDiagramEdgeKind>(["cooling-supply", "cooling-return"]);
    return {
      ...topology,
      nodes: topology.nodes.filter((node) => visibleLayoutRoles.has(node.layoutRole)),
      edges: topology.edges.filter((edge) => visibleEdgeKinds.has(edge.kind))
    };
  }, [topology, viewMode]);
  const resolved = useMemo(() => buildSystemDiagramLayout(filteredTopology), [filteredTopology]);
  const nodeGroups = useMemo(() => buildSchematicNodeGroups(resolved.nodes), [resolved.nodes]);
  const schematicEdges = useMemo(
    () => buildSchematicEdges(resolved.edges, resolved.nodes),
    [resolved.edges, resolved.nodes]
  );
  const nodePositions = useMemo<Map<string, SchematicPosition>>(() => {
    return new Map(
      nodeGroups.map(({ node }) => [node.layoutRole, SCHEMATIC_POSITIONS[node.layoutRole] || { x: 500, y: 280 }])
    );
  }, [nodeGroups]);
  const selectedResolvedNode = resolved.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedGroup = nodeGroups.find((group) => selectedNodeId && group.memberIds.has(selectedNodeId)) || nodeGroups[0] || null;
  const selectedNode = selectedResolvedNode || selectedGroup?.node || null;
  const statusLabel = getSystemDiagramStatusLabel(selectedNode, operationalEvidence);

  return (
    <section className="scene-system-diagram-card scene-system-diagram-card--schematic">
      <div className="scene-system-diagram-shell scene-system-diagram-schematic-shell">
        <div className="scene-system-diagram-shell-hud">
          <div className="scene-system-diagram-shell-copy">
            <span>{zhCN.sceneControl.systemDiagramViewHydraulic} · {getViewModeLabel(viewMode)}</span>
            <strong>{selectedNode ? selectedNode.label : resolved.title}</strong>
            <small>
              {selectedNode
                ? `${getSystemDiagramTypeLabel(selectedNode)} · ${selectedNode.instanceCount || 1} ${zhCN.sceneControl.systemDiagramUnit}`
                : resolved.description}
            </small>
          </div>
          <div className="scene-system-diagram-schematic-filters" role="group" aria-label={zhCN.sceneControl.systemDiagramEyebrow}>
            <button type="button" className={viewMode === "all" ? "active" : ""} onClick={() => setViewMode("all")}>
              {zhCN.sceneControl.systemDiagramFilterAll}
            </button>
            <button type="button" className={viewMode === "chilled" ? "active" : ""} onClick={() => setViewMode("chilled")}>
              {zhCN.sceneControl.systemDiagramFilterChilled}
            </button>
            <button type="button" className={viewMode === "cooling" ? "active" : ""} onClick={() => setViewMode("cooling")}>
              {zhCN.sceneControl.systemDiagramFilterCooling}
            </button>
          </div>
        </div>

        <div className="scene-system-diagram-schematic-scroll">
          <div className="scene-system-diagram-schematic-canvas">
            <svg viewBox="0 0 1000 560" role="img" aria-label={resolved.title}>
              <defs>
                {(Object.keys(PIPE_COLORS) as SystemDiagramEdgeKind[]).map((kind) => (
                  <marker
                    key={kind}
                    id={markerId(resolved.id, kind)}
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill={PIPE_COLORS[kind]} />
                  </marker>
                ))}
              </defs>
              {schematicEdges.map((edge, index) => {
                const from = nodePositions.get(edge.from);
                const to = nodePositions.get(edge.to);
                if (!from || !to) {
                  return null;
                }
                const path = buildSchematicPath(from, to, index);
                const flowState = resolveSystemDiagramFlowVisualState(edge);
                const flowMarker = `url(#${markerId(resolved.id, edge.kind)})`;
                return (
                  <g
                    key={edge.id}
                    className={`scene-system-diagram-schematic-pipe is-${edge.kind}${flowState.direction < 0 ? " is-reverse" : ""}${flowState.active ? "" : " is-stopped"}${flowState.evidence === "schematic" ? " is-schematic" : ""}`}
                    data-flow-evidence={flowState.evidence}
                    data-flow-direction={flowState.direction < 0 ? "reverse" : "forward"}
                    data-flow-active={flowState.active ? "true" : "false"}
                    style={buildFlowStyle(flowState.speed, flowState.activeOpacity)}
                    aria-label={`${edge.kind} · ${flowState.evidence === "telemetry" ? "流量驱动" : "示意流向"}`}
                  >
                    <path className="is-glow" d={path} />
                    <path
                      className="is-base"
                      d={path}
                      style={{ stroke: PIPE_COLORS[edge.kind] }}
                      markerStart={flowState.direction < 0 ? flowMarker : undefined}
                      markerEnd={flowState.direction > 0 ? flowMarker : undefined}
                    />
                    <path
                      className="is-flow"
                      d={path}
                      pathLength="100"
                      style={{ stroke: PIPE_COLORS[edge.kind] }}
                    />
                  </g>
                );
              })}
            </svg>

            {nodeGroups.map(({ node, representative, memberIds }) => {
              const position = nodePositions.get(node.layoutRole);
              if (!position) {
                return null;
              }
              const image = getNodeImage(node);
              const isSelected = selectedNodeId ? memberIds.has(selectedNodeId) : selectedGroup?.node.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`scene-system-diagram-schematic-node${isSelected ? " is-selected" : ""}${operationalEvidence ? "" : " is-sample"}`}
                  style={{ left: `${position.x / 10}%`, top: `${position.y / 5.6}%` }}
                  onClick={() => onNodeSelect?.(representative)}
                  aria-pressed={isSelected}
                >
                  <span className="scene-system-diagram-schematic-node-visual">
                    {image ? <img src={image} alt="" /> : <CircleDot size={26} />}
                  </span>
                  <span className="scene-system-diagram-schematic-node-copy">
                    <small>{getSystemDiagramTypeLabel(node)}</small>
                    <strong>{node.label}</strong>
                    <em>{node.instanceCount || 1} {zhCN.sceneControl.systemDiagramUnit}</em>
                  </span>
                  <i>{operationalEvidence ? getSystemDiagramStatusLabel(node, true) : statusLabel}</i>
                </button>
              );
            })}

            <span className="scene-system-diagram-schematic-loop is-chilled">
              {zhCN.sceneControl.systemDiagramFilterChilled}
            </span>
            <span className="scene-system-diagram-schematic-loop is-cooling">
              {zhCN.sceneControl.systemDiagramFilterCooling}
            </span>
          </div>
        </div>

        <div className="scene-system-diagram-shell-footer">
          <span>{operationalEvidence ? resolved.title : zhCN.sceneControl.systemDiagramSampleDevice}</span>
          <strong>
            {resolved.nodes.length} {zhCN.sceneControl.systemDiagramNodes} / {resolved.edges.length} {zhCN.sceneControl.systemDiagramEdges}
          </strong>
        </div>
      </div>

      <SystemDiagramInspector
        selectedNode={selectedNode}
        devicePageHref={devicePageHref}
        operationalEvidence={operationalEvidence}
      />
    </section>
  );
}

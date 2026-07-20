import type { SystemDiagramEdge } from "./systemDiagramTypes";

export type SystemDiagramFlowVisualState = {
  measuredFlowM3h: number | null;
  normalizedFlow: number;
  speed: number;
  direction: 1 | -1;
  active: boolean;
  activeOpacity: number;
  evidence: "telemetry" | "schematic";
};

export function resolveSystemDiagramFlowVisualState(
  edge: SystemDiagramEdge
): SystemDiagramFlowVisualState {
  const measuredFlowM3h = typeof edge.flowM3h === "number" && Number.isFinite(edge.flowM3h)
    ? edge.flowM3h
    : null;
  const normalizedFlow = measuredFlowM3h === null
    ? 0.36
    : Math.min(1, Math.abs(measuredFlowM3h) / 800);
  const direction = edge.flowDirection === "reverse"
    || (measuredFlowM3h !== null && measuredFlowM3h < 0)
    ? -1
    : 1;
  const active = edge.flowActive
    ?? (measuredFlowM3h === null || Math.abs(measuredFlowM3h) > 0.01);
  const evidence = measuredFlowM3h !== null
    || edge.flowDirection !== undefined
    || edge.flowActive !== undefined
    ? "telemetry"
    : "schematic";

  return {
    measuredFlowM3h,
    normalizedFlow,
    speed: 0.08 + normalizedFlow * 0.2,
    direction,
    active,
    activeOpacity: 0.6 + normalizedFlow * 0.28,
    evidence
  };
}

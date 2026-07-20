import type { DeviceModelCategory } from "../../config/modelRegistry";

export type SystemDiagramNodeStatus = "running" | "standby" | "alert";
export type SystemDiagramRenderableCategory = DeviceModelCategory | "load";

export type SystemDiagramLayoutRole =
  | "chiller"
  | "chilled-pump"
  | "cooling-pump"
  | "cooling-tower"
  | "load"
  | "valve-chilled"
  | "valve-cooling";

export type SystemDiagramEdgeKind =
  | "chilled-supply"
  | "chilled-return"
  | "cooling-supply"
  | "cooling-return";

export type SystemDiagramNode = {
  id: string;
  label: string;
  category: SystemDiagramRenderableCategory;
  systemType: string;
  layoutRole: SystemDiagramLayoutRole;
  status: SystemDiagramNodeStatus;
  instanceCount?: number;
  primaryDeviceLabel?: string | null;
  primaryDeviceId?: string | null;
  deviceIds?: string[];
  position?: [number, number, number];
  rotationY?: number;
  targetHeight?: number;
};

export type SystemDiagramEdge = {
  id: string;
  from: string;
  to: string;
  kind: SystemDiagramEdgeKind;
  via?: Array<[number, number, number]>;
  flowM3h?: number | null;
  flowDirection?: "forward" | "reverse";
  flowActive?: boolean;
};

export type SystemDiagramTopology = {
  id: string;
  title: string;
  description: string;
  nodes: SystemDiagramNode[];
  edges: SystemDiagramEdge[];
};

export type SystemDiagramResolvedNode = SystemDiagramNode & {
  position: [number, number, number];
  rotationY: number;
  targetHeight: number;
};

export type SystemDiagramResolvedTopology = Omit<SystemDiagramTopology, "nodes"> & {
  nodes: SystemDiagramResolvedNode[];
};

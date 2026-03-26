import type {
  SystemDiagramLayoutRole,
  SystemDiagramResolvedNode,
  SystemDiagramResolvedTopology,
  SystemDiagramTopology
} from "./systemDiagramTypes";

const ROLE_LAYOUT: Record<
  SystemDiagramLayoutRole,
  {
    position: [number, number, number];
    rotationY: number;
    targetHeight: number;
  }
> = {
  chiller: {
    position: [0, 0, 0],
    rotationY: Math.PI * 0.12,
    targetHeight: 1.8
  },
  "chilled-pump": {
    position: [-5.8, 0, 4.2],
    rotationY: Math.PI * 0.72,
    targetHeight: 1.15
  },
  "cooling-pump": {
    position: [5.8, 0, 2.7],
    rotationY: Math.PI * 0.28,
    targetHeight: 1.15
  },
  "cooling-tower": {
    position: [6.6, 0, -5.2],
    rotationY: Math.PI * 1.05,
    targetHeight: 2.2
  },
  load: {
    position: [-0.2, 0, 6.1],
    rotationY: 0,
    targetHeight: 1.45
  },
  "valve-chilled": {
    position: [-3.0, 0, 2.6],
    rotationY: Math.PI * 0.18,
    targetHeight: 1
  },
  "valve-cooling": {
    position: [3.1, 0, 0.8],
    rotationY: Math.PI * 1.12,
    targetHeight: 1
  }
};

function resolveNodeLayout(node: SystemDiagramTopology["nodes"][number]): SystemDiagramResolvedNode {
  const roleLayout = ROLE_LAYOUT[node.layoutRole];
  return {
    ...node,
    position: node.position || roleLayout.position,
    rotationY: node.rotationY ?? roleLayout.rotationY,
    targetHeight: node.targetHeight ?? roleLayout.targetHeight
  };
}

export function buildSystemDiagramLayout(topology: SystemDiagramTopology): SystemDiagramResolvedTopology {
  return {
    ...topology,
    nodes: topology.nodes.map(resolveNodeLayout)
  };
}

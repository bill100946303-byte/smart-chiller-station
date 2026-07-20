import type {
  DeviceListItemDto,
  SystemDiagramDto,
  SystemDiagramEdgeDto,
  SystemDiagramNodeDto,
  SystemTopologyDto,
  TopologyNodeDto
} from "../../services/bffClient";
import type { SystemDiagramNodeStatus, SystemDiagramTopology } from "./systemDiagramTypes";

export const MAIN_LOOP_SYSTEM_DIAGRAM: SystemDiagramTopology = {
  id: "main-loop-v1",
  title: "冷站主回路 3D 示意图",
  description: "当前先用四类已接入模型和规则布局生成主回路示意图，验证设备映射、管线表达和后续运行态绑定能力。",
  nodes: [
    {
      id: "chiller-01",
      label: "1号冷机",
      category: "chiller",
      systemType: "冷机",
      layoutRole: "chiller",
      status: "running",
      primaryDeviceLabel: "1号冷机",
      primaryDeviceId: "CH1",
      instanceCount: 3
    },
    {
      id: "valve-chilled-01",
      label: "冷冻阀门",
      category: "valve",
      systemType: "工业阀门",
      layoutRole: "valve-chilled",
      status: "standby"
    },
    {
      id: "pump-chilled-01",
      label: "冷冻泵",
      category: "pump",
      systemType: "冷冻泵",
      layoutRole: "chilled-pump",
      status: "running",
      primaryDeviceLabel: "1号冷冻泵",
      primaryDeviceId: "CHP1",
      instanceCount: 3
    },
    {
      id: "load-01",
      label: "建筑负荷",
      category: "load",
      systemType: "建筑负荷",
      layoutRole: "load",
      status: "standby",
      instanceCount: 1
    },
    {
      id: "valve-cooling-01",
      label: "冷却阀门",
      category: "valve",
      systemType: "工业阀门",
      layoutRole: "valve-cooling",
      status: "standby"
    },
    {
      id: "pump-cooling-01",
      label: "冷却泵",
      category: "pump",
      systemType: "冷却泵",
      layoutRole: "cooling-pump",
      status: "running",
      primaryDeviceLabel: "1号冷却泵",
      primaryDeviceId: "CWP1",
      instanceCount: 3
    },
    {
      id: "tower-01",
      label: "冷却塔",
      category: "cooling-tower",
      systemType: "冷却塔",
      layoutRole: "cooling-tower",
      status: "running",
      primaryDeviceLabel: "1号冷却塔风机",
      primaryDeviceId: "CTF1",
      instanceCount: 4
    }
  ],
  edges: [
    {
      id: "edge-chiller-to-valve-chilled",
      from: "chiller-01",
      to: "valve-chilled-01",
      kind: "chilled-supply",
      via: [[-1.6, 0.9, 1.4]]
    },
    {
      id: "edge-valve-chilled-to-pump-chilled",
      from: "valve-chilled-01",
      to: "pump-chilled-01",
      kind: "chilled-supply",
      via: [[-4.0, 0.9, 2.9]]
    },
    {
      id: "edge-pump-chilled-to-load",
      from: "pump-chilled-01",
      to: "load-01",
      kind: "chilled-supply",
      via: [[-3.6, 0.9, 5.2], [-1.7, 0.9, 5.8]]
    },
    {
      id: "edge-load-to-chiller",
      from: "load-01",
      to: "chiller-01",
      kind: "chilled-return",
      via: [[-0.2, 0.9, 3.8], [0.6, 0.9, 2.2]]
    },
    {
      id: "edge-valve-cooling-to-chiller",
      from: "valve-cooling-01",
      to: "chiller-01",
      kind: "cooling-supply",
      via: [[1.8, 0.9, 0.6]]
    },
    {
      id: "edge-pump-cooling-to-valve-cooling",
      from: "pump-cooling-01",
      to: "valve-cooling-01",
      kind: "cooling-supply",
      via: [[4.8, 0.9, 1.6]]
    },
    {
      id: "edge-tower-to-pump-cooling",
      from: "tower-01",
      to: "pump-cooling-01",
      kind: "cooling-supply",
      via: [[6.3, 0.9, -3.1], [6.3, 0.9, 1.2]]
    },
    {
      id: "edge-chiller-to-tower",
      from: "chiller-01",
      to: "tower-01",
      kind: "cooling-return",
      via: [[-0.2, 0.9, -0.8], [-0.2, 0.9, -3.8], [3.0, 0.9, -6.1]]
    }
  ]
};

function mapRuntimeNodeStatus(device: DeviceListItemDto | null): SystemDiagramNodeStatus {
  if (!device?.status || device.status === "unknown") {
    return "standby";
  }
  if (device.status === "offline") {
    return "alert";
  }
  return "running";
}

function pickFirstDevice(
  devices: DeviceListItemDto[],
  matcher: (item: DeviceListItemDto) => boolean
): DeviceListItemDto | null {
  return devices.find(matcher) || null;
}

function pickDevices(
  devices: DeviceListItemDto[],
  matcher: (item: DeviceListItemDto) => boolean
): DeviceListItemDto[] {
  return devices.filter(matcher);
}

function countLabel(prefix: string, count: number | null | undefined, fallback: string) {
  if (typeof count === "number" && count > 0) {
    return `${prefix}${count}台`;
  }
  return fallback;
}

type RuntimeChainKey = "chiller" | "chilledPump" | "load" | "coolingPump" | "coolingTower";

function mapTopologyNodeKey(value: string | null | undefined): RuntimeChainKey | null {
  if (value === "chiller") {
    return "chiller";
  }
  if (value === "chilledPump") {
    return "chilledPump";
  }
  if (value === "load") {
    return "load";
  }
  if (value === "coolingPump") {
    return "coolingPump";
  }
  if (value === "coolingTower") {
    return "coolingTower";
  }
  return null;
}

function buildTopologyChain(nodes: TopologyNodeDto[] | undefined): RuntimeChainKey[] {
  const typedNodes = (nodes || [])
    .map((node) => ({
      key: mapTopologyNodeKey(node.id),
      downstream: mapTopologyNodeKey(node.downstream),
      original: node
    }))
    .filter((item): item is { key: RuntimeChainKey; downstream: RuntimeChainKey | null; original: TopologyNodeDto } => Boolean(item.key));

  if (typedNodes.length === 0) {
    return ["chiller", "chilledPump", "load", "coolingPump", "coolingTower"];
  }

  const downstreamKeys = new Set(
    typedNodes
      .map((item) => item.downstream)
      .filter((value): value is RuntimeChainKey => Boolean(value))
  );
  const startKey = typedNodes.find((item) => !downstreamKeys.has(item.key))?.key || typedNodes[0].key;
  const byKey = new Map(typedNodes.map((item) => [item.key, item]));
  const chain: RuntimeChainKey[] = [];
  const visited = new Set<RuntimeChainKey>();
  let currentKey: RuntimeChainKey | null = startKey;

  while (currentKey && !visited.has(currentKey)) {
    visited.add(currentKey);
    chain.push(currentKey);
    currentKey = byKey.get(currentKey)?.downstream || null;
  }

  return chain.length > 0 ? chain : ["chiller", "chilledPump", "load", "coolingPump", "coolingTower"];
}

function findTopologyNode(nodes: TopologyNodeDto[] | undefined, key: RuntimeChainKey) {
  return (nodes || []).find((item) => mapTopologyNodeKey(item.id) === key) || null;
}

function buildTopologyNodeLabel(
  key: RuntimeChainKey,
  topologyNode: TopologyNodeDto | null,
  fallbackCount: number | null | undefined
) {
  if (topologyNode?.label && /[\u4e00-\u9fa5]/.test(topologyNode.label)) {
    return topologyNode.label;
  }

  if (key === "chiller") {
    return countLabel("冷机", topologyNode?.count ?? fallbackCount, "冷机主设备");
  }
  if (key === "chilledPump") {
    return countLabel("冷冻泵", topologyNode?.count ?? fallbackCount, "冷冻泵");
  }
  if (key === "coolingPump") {
    return countLabel("冷却泵", topologyNode?.count ?? fallbackCount, "冷却泵");
  }
  if (key === "coolingTower") {
    return countLabel("冷却塔", topologyNode?.count ?? fallbackCount, "冷却塔");
  }
  return "建筑负荷";
}

function buildDynamicEdges(chain: RuntimeChainKey[]): SystemDiagramTopology["edges"] {
  const edges: SystemDiagramTopology["edges"] = [];
  const hasChilledPump = chain.includes("chilledPump");
  const hasLoad = chain.includes("load");
  const hasCoolingPump = chain.includes("coolingPump");
  const hasCoolingTower = chain.includes("coolingTower");
  const hasChilledLeg = chain.includes("chiller") && hasChilledPump;
  const hasCoolingLeg = chain.includes("chiller") && hasCoolingPump;

  if (hasChilledLeg) {
    edges.push({
      id: "edge-chiller-to-valve-chilled",
      from: "chiller-01",
      to: "valve-chilled-01",
      kind: "chilled-supply",
      via: [[-1.6, 0.9, 1.4]]
    });
    edges.push({
      id: "edge-valve-chilled-to-pump-chilled",
      from: "valve-chilled-01",
      to: "pump-chilled-01",
      kind: "chilled-supply",
      via: [[-4.0, 0.9, 2.9]]
    });
  }

  if (hasChilledPump && hasLoad) {
    edges.push({
      id: "edge-pump-chilled-to-load",
      from: "pump-chilled-01",
      to: "load-01",
      kind: "chilled-supply",
      via: [[-3.6, 0.9, 5.2], [-1.7, 0.9, 5.8]]
    });
    edges.push({
      id: "edge-load-to-chiller",
      from: "load-01",
      to: "chiller-01",
      kind: "chilled-return",
      via: [[-0.2, 0.9, 3.8], [0.6, 0.9, 2.2]]
    });
  }

  if (hasCoolingLeg) {
    edges.push({
      id: "edge-valve-cooling-to-chiller",
      from: "valve-cooling-01",
      to: "chiller-01",
      kind: "cooling-supply",
      via: [[1.8, 0.9, 0.6]]
    });
    edges.push({
      id: "edge-pump-cooling-to-valve-cooling",
      from: "pump-cooling-01",
      to: "valve-cooling-01",
      kind: "cooling-supply",
      via: [[4.8, 0.9, 1.6]]
    });
  }

  if (hasCoolingPump && hasCoolingTower) {
    edges.push({
      id: "edge-tower-to-pump-cooling",
      from: "tower-01",
      to: "pump-cooling-01",
      kind: "cooling-supply",
      via: [[6.3, 0.9, -3.1], [6.3, 0.9, 1.2]]
    });
    edges.push({
      id: "edge-chiller-to-tower",
      from: "chiller-01",
      to: "tower-01",
      kind: "cooling-return",
      via: [[-0.2, 0.9, -0.8], [-0.2, 0.9, -3.8], [3.0, 0.9, -6.1]]
    });
  }

  return edges;
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function mapRuntimeStatusSummary(node: SystemDiagramNodeDto): SystemDiagramNodeStatus {
  if (node.statusSummary?.degraded || node.statusSummary?.alarmStatus === "alarm") {
    return "alert";
  }
  if (node.statusSummary?.runStatus === "run") {
    return "running";
  }
  return "standby";
}

function mapContractCategory(node: SystemDiagramNodeDto): SystemDiagramTopology["nodes"][number]["category"] | null {
  const candidates = [
    normalizeText(node.modelCategory),
    normalizeText(node.systemType),
    normalizeText(node.label),
    normalizeText(node.nodeType)
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }
    if (value.includes("chiller") || value.includes("冷机")) {
      return "chiller";
    }
    if (value.includes("coolingtower") || value.includes("coolingtower") || value.includes("冷却塔")) {
      return "cooling-tower";
    }
    if (value.includes("pump") || value.includes("泵")) {
      return "pump";
    }
    if (value.includes("valve") || value.includes("阀")) {
      return "valve";
    }
    if (value.includes("load") || value.includes("负荷")) {
      return "load";
    }
  }

  return null;
}

function mapContractLayoutRole(
  node: SystemDiagramNodeDto,
  category: SystemDiagramTopology["nodes"][number]["category"]
): SystemDiagramTopology["nodes"][number]["layoutRole"] {
  const roleText = `${normalizeText(node.role)} ${normalizeText(node.group)} ${normalizeText(node.systemType)} ${normalizeText(node.label)}`;

  if (category === "chiller") {
    return "chiller";
  }
  if (category === "cooling-tower") {
    return "cooling-tower";
  }
  if (category === "load") {
    return "load";
  }
  if (category === "pump") {
    if (roleText.includes("cooling") || roleText.includes("冷却")) {
      return "cooling-pump";
    }
    return "chilled-pump";
  }
  if (category === "valve") {
    if (roleText.includes("cooling") || roleText.includes("冷却")) {
      return "valve-cooling";
    }
    if (typeof node.positionHint?.x === "number" && node.positionHint.x > 0) {
      return "valve-cooling";
    }
    return "valve-chilled";
  }
  return "load";
}

function mapContractEdgeKind(
  edge: SystemDiagramEdgeDto
): SystemDiagramTopology["edges"][number]["kind"] | null {
  const value = normalizeText(edge.pipeClass);
  if (value === "chilled_supply") {
    return "chilled-supply";
  }
  if (value === "chilled_return") {
    return "chilled-return";
  }
  if (value === "cooling_supply") {
    return "cooling-supply";
  }
  if (value === "cooling_return") {
    return "cooling-return";
  }
  return null;
}

function mapContractVia(edge: SystemDiagramEdgeDto) {
  const points = (edge.routeHint?.points || [])
    .map((point) => {
      if (typeof point.x !== "number" || typeof point.y !== "number" || typeof point.z !== "number") {
        return null;
      }
      return [point.x, point.y, point.z] as [number, number, number];
    })
    .filter(Boolean) as Array<[number, number, number]>;

  if (points.length <= 2) {
    return undefined;
  }

  return points.slice(1, -1);
}

export function buildSystemDiagramFromContract(
  diagram: SystemDiagramDto | null
): SystemDiagramTopology | null {
  if (!diagram?.nodes?.length || !diagram.edges?.length) {
    return null;
  }

  const nodes = diagram.nodes
    .map((node) => {
      if (!node.id || !node.label) {
        return null;
      }
      const category = mapContractCategory(node);
      if (!category) {
        return null;
      }
      return {
        id: node.id,
        label: node.label,
        category,
        systemType: node.systemType || node.label,
        layoutRole: mapContractLayoutRole(node, category),
        status: mapRuntimeStatusSummary(node),
        primaryDeviceLabel: node.label,
        primaryDeviceId: node.deviceIdRef || null,
        deviceIds: node.deviceIds || (node.deviceIdRef ? [node.deviceIdRef] : []),
        instanceCount: Math.max(node.deviceIds?.length || 0, node.deviceIdRef ? 1 : 0, 1),
        position:
          typeof node.positionHint?.x === "number" &&
          typeof node.positionHint?.y === "number" &&
          typeof node.positionHint?.z === "number"
            ? [node.positionHint.x, node.positionHint.y, node.positionHint.z]
            : undefined,
        rotationY: typeof node.rotationHint?.y === "number" ? node.rotationHint.y : undefined,
        targetHeight: typeof node.scaleHint === "number" && node.scaleHint > 0 ? node.scaleHint : undefined
      };
    })
    .filter(Boolean) as SystemDiagramTopology["nodes"];

  const edges = diagram.edges
    .map((edge) => {
      if (!edge.id || !edge.from || !edge.to) {
        return null;
      }
      const kind = mapContractEdgeKind(edge);
      if (!kind) {
        return null;
      }
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        kind,
        via: mapContractVia(edge)
      };
    })
    .filter(Boolean) as SystemDiagramTopology["edges"];

  if (!nodes.length || !edges.length) {
    return null;
  }

  return {
    id: `system-diagram-${diagram.site?.siteId || "unknown"}`,
    title: "冷站完整 3D 系统图",
    description: diagram.generatedAt
      ? `当前优先使用 system/diagram 合同生成 3D 系统图；本次生成时间 ${diagram.generatedAt}。`
      : "当前优先使用 system/diagram 合同生成 3D 系统图。",
    nodes,
    edges
  };
}

export function buildRuntimeSystemDiagram(
  topology: SystemTopologyDto | null,
  devices: DeviceListItemDto[]
): SystemDiagramTopology {
  const summary = topology?.summary || null;
  const topologyNodes = topology?.nodes || [];
  const topologyChain = buildTopologyChain(topologyNodes);
  const chiller = pickFirstDevice(
    devices,
    (item) => item.systemType === "chiller" || item.deviceName?.includes("冷机") === true
  );
  const chillers = pickDevices(
    devices,
    (item) => item.systemType === "chiller" || item.deviceName?.includes("冷机") === true
  );
  const chilledPump = pickFirstDevice(
    devices,
    (item) => item.systemType === "chilledPump" || item.usageType?.includes("冷冻泵") === true
  );
  const chilledPumps = pickDevices(
    devices,
    (item) => item.systemType === "chilledPump" || item.usageType?.includes("冷冻泵") === true
  );
  const coolingPump = pickFirstDevice(
    devices,
    (item) => item.systemType === "coolingPump" || item.usageType?.includes("冷却泵") === true
  );
  const coolingPumps = pickDevices(
    devices,
    (item) => item.systemType === "coolingPump" || item.usageType?.includes("冷却泵") === true
  );
  const coolingTower = pickFirstDevice(
    devices,
    (item) => item.systemType === "coolingTower" || item.deviceName?.includes("冷却塔") === true
  );
  const coolingTowers = pickDevices(
    devices,
    (item) => item.systemType === "coolingTower" || item.deviceName?.includes("冷却塔") === true
  );
  const chillerTopologyNode = findTopologyNode(topologyNodes, "chiller");
  const chilledPumpTopologyNode = findTopologyNode(topologyNodes, "chilledPump");
  const loadTopologyNode = findTopologyNode(topologyNodes, "load");
  const coolingPumpTopologyNode = findTopologyNode(topologyNodes, "coolingPump");
  const coolingTowerTopologyNode = findTopologyNode(topologyNodes, "coolingTower");

  return {
    ...MAIN_LOOP_SYSTEM_DIAGRAM,
    title: "冷站主回路 3D 系统图",
    description: topology?.generatedAt
      ? `当前优先使用 system/topology 与 devices/list 生成主回路示意图；管线路径按 topology.downstream 生成，当前生成时间 ${topology.generatedAt}。`
      : "当前优先使用 system/topology 与 devices/list 生成主回路示意图；若真实数据不足，则自动回退到默认主回路骨架。",
    nodes: [
      {
        id: "chiller-01",
        label:
          chiller?.deviceName ||
          buildTopologyNodeLabel("chiller", chillerTopologyNode, summary?.chillerCount),
        category: "chiller",
        systemType: "冷机",
        layoutRole: "chiller",
        status: mapRuntimeNodeStatus(chiller),
        primaryDeviceLabel: chiller?.deviceName || null,
        instanceCount: summary?.chillerCount || chillerTopologyNode?.count || 1,
        primaryDeviceId: chiller?.deviceId || null,
        deviceIds: chillers.map((item) => item.deviceId).filter(Boolean) as string[]
      },
      {
        id: "valve-chilled-01",
        label: "冷冻阀门",
        category: "valve",
        systemType: "工业阀门",
        layoutRole: "valve-chilled",
        status: "standby"
      },
      {
        id: "pump-chilled-01",
        label:
          chilledPump?.deviceName ||
          buildTopologyNodeLabel("chilledPump", chilledPumpTopologyNode, summary?.chilledPumpCount),
        category: "pump",
        systemType: "冷冻泵",
        layoutRole: "chilled-pump",
        status: mapRuntimeNodeStatus(chilledPump),
        primaryDeviceLabel: chilledPump?.deviceName || null,
        instanceCount: summary?.chilledPumpCount || chilledPumpTopologyNode?.count || 1,
        primaryDeviceId: chilledPump?.deviceId || null,
        deviceIds: chilledPumps.map((item) => item.deviceId).filter(Boolean) as string[]
      },
      {
        id: "load-01",
        label: buildTopologyNodeLabel("load", loadTopologyNode, null),
        category: "load",
        systemType: "建筑负荷",
        layoutRole: "load",
        status: "standby",
        instanceCount: 1
      },
      {
        id: "valve-cooling-01",
        label: "冷却阀门",
        category: "valve",
        systemType: "工业阀门",
        layoutRole: "valve-cooling",
        status: "standby"
      },
      {
        id: "pump-cooling-01",
        label:
          coolingPump?.deviceName ||
          buildTopologyNodeLabel("coolingPump", coolingPumpTopologyNode, summary?.coolingPumpCount),
        category: "pump",
        systemType: "冷却泵",
        layoutRole: "cooling-pump",
        status: mapRuntimeNodeStatus(coolingPump),
        primaryDeviceLabel: coolingPump?.deviceName || null,
        instanceCount: summary?.coolingPumpCount || coolingPumpTopologyNode?.count || 1,
        primaryDeviceId: coolingPump?.deviceId || null,
        deviceIds: coolingPumps.map((item) => item.deviceId).filter(Boolean) as string[]
      },
      {
        id: "tower-01",
        label:
          coolingTower?.deviceName ||
          buildTopologyNodeLabel("coolingTower", coolingTowerTopologyNode, summary?.coolingTowerCount),
        category: "cooling-tower",
        systemType: "冷却塔",
        layoutRole: "cooling-tower",
        status: mapRuntimeNodeStatus(coolingTower),
        primaryDeviceLabel: coolingTower?.deviceName || null,
        instanceCount: summary?.coolingTowerCount || coolingTowerTopologyNode?.count || 1,
        primaryDeviceId: coolingTower?.deviceId || null,
        deviceIds: coolingTowers.map((item) => item.deviceId).filter(Boolean) as string[]
      }
    ],
    edges: buildDynamicEdges(topologyChain)
  };
}

import type { SystemDiagramDto } from "../../services/bffClient";

export const SYSTEM_DIAGRAM_CONTRACT_SAMPLE: SystemDiagramDto = {
  site: {
    siteId: "126lnoffice",
    siteName: "lnoffice"
  },
  generatedAt: "2026-03-18T10:10:00+08:00",
  layoutMode: "fixed",
  scope: "full",
  freshness: {
    latestTimestamp: "2026-03-18T10:08:00+08:00",
    stale: false,
    ageHours: 0.03
  },
  sourceStatus: {
    overall: "ok",
    sources: [
      {
        key: "system_diagram_contract_sample",
        endpoint: "local_contract_sample",
        ok: true,
        status: 200,
        message: "sample_ready"
      }
    ]
  },
  nodes: [
    {
      id: "device-ch-1",
      nodeType: "device",
      label: "1#冷水机",
      systemType: "chiller",
      role: "main",
      group: "main_loop",
      deviceIdRef: "2",
      deviceIds: ["2", "21", "40"],
      modelCategory: "chiller",
      floor: "10楼",
      area: "冷机房",
      positionHint: { x: 0, y: 0, z: 0, anchor: "center" },
      rotationHint: { y: 0.36 },
      scaleHint: 1.8,
      statusSummary: {
        runStatus: "run",
        alarmStatus: "normal",
        degraded: false,
        latestUpdateAt: "2026-03-18T10:08:00+08:00"
      }
    },
    {
      id: "node-valve-chilled",
      nodeType: "valve",
      label: "冷冻供水阀门",
      systemType: "valve",
      role: "main",
      group: "chilled_supply",
      modelCategory: "valve",
      floor: "10楼",
      area: "冷机房",
      positionHint: { x: -3, y: 0, z: 2.6, anchor: "left" },
      rotationHint: { y: 0.56 },
      scaleHint: 1,
      statusSummary: {
        runStatus: "unknown",
        alarmStatus: "unknown",
        degraded: false,
        latestUpdateAt: null
      }
    },
    {
      id: "device-chp-1",
      nodeType: "device",
      label: "1#冷冻泵",
      systemType: "chilledPump",
      role: "main",
      group: "chilled_supply",
      deviceIdRef: "1",
      deviceIds: ["1", "20", "39"],
      modelCategory: "pump",
      floor: "10楼",
      area: "冷机房",
      positionHint: { x: -5.8, y: 0, z: 4.2, anchor: "left" },
      rotationHint: { y: 2.26 },
      scaleHint: 1.15,
      statusSummary: {
        runStatus: "stop",
        alarmStatus: "normal",
        degraded: false,
        latestUpdateAt: "2026-03-18T10:07:00+08:00"
      }
    },
    {
      id: "node-load-header",
      nodeType: "load",
      label: "建筑负荷群",
      systemType: "load",
      role: "main",
      group: "load_zone_a",
      modelCategory: "load",
      floor: "10楼",
      area: "末端负荷",
      positionHint: { x: -0.2, y: 0, z: 6.1, anchor: "center" },
      rotationHint: { y: 0 },
      scaleHint: 1.45,
      statusSummary: {
        runStatus: "unknown",
        alarmStatus: "unknown",
        degraded: false,
        latestUpdateAt: null
      }
    },
    {
      id: "node-valve-cooling",
      nodeType: "valve",
      label: "冷却供水阀门",
      systemType: "valve",
      role: "main",
      group: "cooling_supply",
      modelCategory: "valve",
      floor: "10楼",
      area: "冷机房",
      positionHint: { x: 3.1, y: 0, z: 0.8, anchor: "right" },
      rotationHint: { y: 3.51 },
      scaleHint: 1,
      statusSummary: {
        runStatus: "unknown",
        alarmStatus: "unknown",
        degraded: false,
        latestUpdateAt: null
      }
    },
    {
      id: "device-cwp-1",
      nodeType: "device",
      label: "1#冷却泵",
      systemType: "coolingPump",
      role: "main",
      group: "cooling_return",
      deviceIdRef: "5",
      deviceIds: ["5", "24", "43"],
      modelCategory: "pump",
      floor: "10楼",
      area: "冷机房",
      positionHint: { x: 5.8, y: 0, z: 2.7, anchor: "right" },
      rotationHint: { y: 0.88 },
      scaleHint: 1.15,
      statusSummary: {
        runStatus: "run",
        alarmStatus: "normal",
        degraded: false,
        latestUpdateAt: "2026-03-18T10:07:00+08:00"
      }
    },
    {
      id: "device-ct-1",
      nodeType: "device",
      label: "冷却塔组",
      systemType: "coolingTower",
      role: "main",
      group: "cooling_tower_roof",
      deviceIdRef: "3",
      deviceIds: ["3", "22", "41", "60"],
      modelCategory: "coolingTower",
      floor: "屋顶",
      area: "冷却塔区",
      positionHint: { x: 6.6, y: 0, z: -5.2, anchor: "right" },
      rotationHint: { y: 3.3 },
      scaleHint: 2.2,
      statusSummary: {
        runStatus: "run",
        alarmStatus: "normal",
        degraded: false,
        latestUpdateAt: "2026-03-18T10:06:00+08:00"
      }
    }
  ],
  edges: [
    {
      id: "edge-chiller-to-valve-chilled",
      from: "device-ch-1",
      to: "node-valve-chilled",
      edgeType: "pipe",
      pipeClass: "chilled_supply",
      routeHint: {
        points: [
          { x: 0, y: 0.9, z: 0 },
          { x: -1.6, y: 0.9, z: 1.4 },
          { x: -3, y: 0.9, z: 2.6 }
        ]
      }
    },
    {
      id: "edge-valve-chilled-to-chp",
      from: "node-valve-chilled",
      to: "device-chp-1",
      edgeType: "pipe",
      pipeClass: "chilled_supply",
      routeHint: {
        points: [
          { x: -3, y: 0.9, z: 2.6 },
          { x: -4, y: 0.9, z: 2.9 },
          { x: -5.8, y: 0.9, z: 4.2 }
        ]
      }
    },
    {
      id: "edge-chp-to-load",
      from: "device-chp-1",
      to: "node-load-header",
      edgeType: "pipe",
      pipeClass: "chilled_supply",
      routeHint: {
        points: [
          { x: -5.8, y: 0.9, z: 4.2 },
          { x: -3.6, y: 0.9, z: 5.2 },
          { x: -1.7, y: 0.9, z: 5.8 },
          { x: -0.2, y: 0.9, z: 6.1 }
        ]
      }
    },
    {
      id: "edge-load-to-chiller",
      from: "node-load-header",
      to: "device-ch-1",
      edgeType: "pipe",
      pipeClass: "chilled_return",
      routeHint: {
        points: [
          { x: -0.2, y: 0.9, z: 6.1 },
          { x: -0.2, y: 0.9, z: 3.8 },
          { x: 0.6, y: 0.9, z: 2.2 },
          { x: 0, y: 0.9, z: 0 }
        ]
      }
    },
    {
      id: "edge-valve-cooling-to-chiller",
      from: "node-valve-cooling",
      to: "device-ch-1",
      edgeType: "pipe",
      pipeClass: "cooling_supply",
      routeHint: {
        points: [
          { x: 3.1, y: 0.9, z: 0.8 },
          { x: 1.8, y: 0.9, z: 0.6 },
          { x: 0, y: 0.9, z: 0 }
        ]
      }
    },
    {
      id: "edge-cwp-to-valve-cooling",
      from: "device-cwp-1",
      to: "node-valve-cooling",
      edgeType: "pipe",
      pipeClass: "cooling_supply",
      routeHint: {
        points: [
          { x: 5.8, y: 0.9, z: 2.7 },
          { x: 4.8, y: 0.9, z: 1.6 },
          { x: 3.1, y: 0.9, z: 0.8 }
        ]
      }
    },
    {
      id: "edge-ct-to-cwp",
      from: "device-ct-1",
      to: "device-cwp-1",
      edgeType: "pipe",
      pipeClass: "cooling_supply",
      routeHint: {
        points: [
          { x: 6.6, y: 0.9, z: -5.2 },
          { x: 6.3, y: 0.9, z: -3.1 },
          { x: 6.3, y: 0.9, z: 1.2 },
          { x: 5.8, y: 0.9, z: 2.7 }
        ]
      }
    },
    {
      id: "edge-chiller-to-ct",
      from: "device-ch-1",
      to: "device-ct-1",
      edgeType: "pipe",
      pipeClass: "cooling_return",
      routeHint: {
        points: [
          { x: 0, y: 0.9, z: 0 },
          { x: -0.2, y: 0.9, z: -0.8 },
          { x: -0.2, y: 0.9, z: -3.8 },
          { x: 3, y: 0.9, z: -6.1 },
          { x: 6.6, y: 0.9, z: -5.2 }
        ]
      }
    }
  ],
  groups: [
    {
      id: "main_loop",
      label: "冷站主回路",
      groupType: "loop",
      nodeIds: [
        "device-ch-1",
        "node-valve-chilled",
        "device-chp-1",
        "node-load-header",
        "node-valve-cooling",
        "device-cwp-1",
        "device-ct-1"
      ]
    }
  ],
  stats: {
    totalNodes: 7,
    totalEdges: 8,
    deviceNodeCount: 4,
    virtualNodeCount: 3,
    degradedNodeCount: 0
  }
};

import { loadDeviceList, loadDeviceSummary } from "../adapters/legacyDeviceAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const REQUIRED_COUNTS = {
  chiller: 3,
  chilledPump: 3,
  coolingPump: 3,
  coolingTower: 4
};

function buildPositionHint(row, column, lane, anchor = "center") {
  return {
    row,
    column,
    lane,
    x: Number((column * 2).toFixed(2)),
    y: 0,
    z: Number((row * 2).toFixed(2)),
    anchor
  };
}

function buildRotationHint() {
  return {
    yaw: 0,
    pitch: 0,
    roll: 0
  };
}

function buildStatusSummary(degraded, latestUpdateAt) {
  return {
    runStatus: "unknown",
    alarmStatus: "unknown",
    degraded,
    latestUpdateAt: latestUpdateAt || null
  };
}

function ensureMinimumDevices(list, count, systemType, labelPrefix) {
  const normalized = Array.isArray(list) ? list.slice() : [];
  for (let i = normalized.length; i < count; i += 1) {
    normalized.push({
      deviceId: `${systemType}-placeholder-${i + 1}`,
      deviceCode: `${systemType}-placeholder-${i + 1}`,
      deviceName: `${labelPrefix}${i + 1}`,
      systemType,
      status: "unknown",
      lastReportAt: null
    });
  }
  return normalized;
}

function buildDeviceNodes(devices, options) {
  return devices.map((device, index) => {
    const positionHint = buildPositionHint(options.rowBase + index, options.columnBase, options.lane);
    return {
      id: `device-${options.systemType}-${index + 1}`,
      nodeType: "device",
      label: String(device.deviceName || `${options.labelPrefix}${index + 1}`),
      systemType: options.systemType,
      role: "main",
      group: options.group,
      deviceIdRef: String(device.deviceId || `unknown-${options.systemType}-${index + 1}`),
      deviceIds: [String(device.deviceId || `unknown-${options.systemType}-${index + 1}`)],
      modelCategory: options.modelCategory,
      positionHint,
      rotationHint: buildRotationHint(),
      statusSummary: buildStatusSummary(options.degraded, device.lastReportAt)
    };
  });
}

function buildValveNodes(count, options) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push({
      id: `${options.systemType}-${i + 1}`,
      nodeType: "valve",
      label: `${options.labelPrefix}${i + 1}`,
      systemType: options.systemType,
      role: "main",
      group: options.group,
      deviceIdRef: null,
      deviceIds: [],
      modelCategory: "valve",
      positionHint: buildPositionHint(options.rowBase + i, options.columnBase, options.lane, "left"),
      rotationHint: buildRotationHint(),
      statusSummary: buildStatusSummary(options.degraded, null)
    });
  }
  return nodes;
}

function buildLoadNode(options) {
  return {
    id: "load-1",
    nodeType: "load",
    label: "建筑负荷",
    systemType: "load",
    role: "main",
    group: options.group,
    deviceIdRef: null,
    deviceIds: [],
    modelCategory: "load",
    positionHint: buildPositionHint(options.rowBase, options.columnBase, options.lane),
    rotationHint: buildRotationHint(),
    statusSummary: buildStatusSummary(options.degraded, null)
  };
}

function buildEdge(id, fromNode, toNode, pipeClass) {
  const from = fromNode?.id || "";
  const to = toNode?.id || "";
  const fromPoint = {
    x: fromNode?.positionHint?.x ?? 0,
    y: fromNode?.positionHint?.y ?? 0,
    z: fromNode?.positionHint?.z ?? 0
  };
  const toPoint = {
    x: toNode?.positionHint?.x ?? 0,
    y: toNode?.positionHint?.y ?? 0,
    z: toNode?.positionHint?.z ?? 0
  };
  return {
    id,
    from,
    to,
    edgeType: "pipe",
    pipeClass,
    routeHint: {
      points: [fromPoint, toPoint]
    }
  };
}

export async function getSystemDiagram(config, siteId, options = {}) {
  const layoutMode = typeof options.layoutMode === "string" ? options.layoutMode : "auto";
  const scope = typeof options.scope === "string" ? options.scope : "full";
  const projectKey =
    typeof options.projectKey === "string" && options.projectKey.trim() ? options.projectKey.trim() : "";

  const [deviceList, deviceSummary] = await Promise.all([
    loadDeviceList(config.legacyBaseUrl, siteId, {
      page: 1,
      pageSize: 200,
      placeholderFallback: true,
      projectKey
    }),
    loadDeviceSummary(config.legacyBaseUrl, siteId, { placeholderFallback: true, projectKey })
  ]);

  const items = Array.isArray(deviceList.items) ? deviceList.items : [];
  const freshness = computeFreshnessState(deviceList.fetchedAt, config.staleThresholdHours);
  const degraded = freshness.stale || deviceList.sourceStatus?.ok === false;

  const chillerDevices = ensureMinimumDevices(
    items.filter((item) => item.systemType === "chiller"),
    REQUIRED_COUNTS.chiller,
    "chiller",
    "冷机"
  );
  const chilledPumpDevices = ensureMinimumDevices(
    items.filter((item) => item.systemType === "chilledPump"),
    REQUIRED_COUNTS.chilledPump,
    "chilledPump",
    "冷冻泵"
  );
  const coolingPumpDevices = ensureMinimumDevices(
    items.filter((item) => item.systemType === "coolingPump"),
    REQUIRED_COUNTS.coolingPump,
    "coolingPump",
    "冷却泵"
  );
  const coolingTowerDevices = ensureMinimumDevices(
    items.filter((item) => item.systemType === "coolingTower"),
    REQUIRED_COUNTS.coolingTower,
    "coolingTower",
    "冷却塔"
  );

  const chillerNodes = buildDeviceNodes(chillerDevices, {
    systemType: "chiller",
    labelPrefix: "冷机",
    modelCategory: "chiller",
    group: "chiller_cluster",
    lane: "supply",
    rowBase: 1,
    columnBase: 2,
    degraded
  });
  const chilledValveNodes = buildValveNodes(chillerDevices.length, {
    systemType: "chilledValve",
    labelPrefix: "冷冻阀门",
    group: "chilled_loop",
    lane: "supply",
    rowBase: 2,
    columnBase: 1,
    degraded
  });
  const chilledPumpNodes = buildDeviceNodes(chilledPumpDevices, {
    systemType: "chilledPump",
    labelPrefix: "冷冻泵",
    modelCategory: "pump",
    group: "chilled_loop",
    lane: "supply",
    rowBase: 3,
    columnBase: 1,
    degraded
  });
  const loadNode = buildLoadNode({
    group: "load_zone",
    lane: "return",
    rowBase: 4,
    columnBase: 2,
    degraded
  });
  const coolingValveNodes = buildValveNodes(coolingPumpDevices.length, {
    systemType: "coolingValve",
    labelPrefix: "冷却阀门",
    group: "cooling_loop",
    lane: "return",
    rowBase: 2,
    columnBase: 3,
    degraded
  });
  const coolingPumpNodes = buildDeviceNodes(coolingPumpDevices, {
    systemType: "coolingPump",
    labelPrefix: "冷却泵",
    modelCategory: "pump",
    group: "cooling_loop",
    lane: "return",
    rowBase: 3,
    columnBase: 3,
    degraded
  });
  const coolingTowerNodes = buildDeviceNodes(coolingTowerDevices, {
    systemType: "coolingTower",
    labelPrefix: "冷却塔",
    modelCategory: "coolingTower",
    group: "cooling_tower",
    lane: "return",
    rowBase: 4,
    columnBase: 4,
    degraded
  });

  const nodes = [
    ...chillerNodes,
    ...chilledValveNodes,
    ...chilledPumpNodes,
    loadNode,
    ...coolingValveNodes,
    ...coolingPumpNodes,
    ...coolingTowerNodes
  ];

  const mainChiller = chillerNodes[0];
  const mainChilledValve = chilledValveNodes[0];
  const mainChilledPump = chilledPumpNodes[0];
  const mainCoolingValve = coolingValveNodes[0];
  const mainCoolingPump = coolingPumpNodes[0];
  const mainCoolingTower = coolingTowerNodes[0];

  const edges = [
    buildEdge("edge-chiller-to-chilled-valve", mainChiller, mainChilledValve, "chilled_supply"),
    buildEdge("edge-chilled-valve-to-chilled-pump", mainChilledValve, mainChilledPump, "chilled_supply"),
    buildEdge("edge-chilled-pump-to-load", mainChilledPump, loadNode, "chilled_return"),
    buildEdge("edge-load-to-chiller", loadNode, mainChiller, "chilled_return"),
    buildEdge("edge-chiller-to-cooling-valve", mainChiller, mainCoolingValve, "cooling_return"),
    buildEdge("edge-cooling-valve-to-cooling-pump", mainCoolingValve, mainCoolingPump, "cooling_return"),
    buildEdge("edge-cooling-pump-to-cooling-tower", mainCoolingPump, mainCoolingTower, "cooling_supply"),
    buildEdge("edge-cooling-tower-to-chiller", mainCoolingTower, mainChiller, "cooling_supply")
  ];

  const groups = [
    {
      id: "main_loop",
      label: "冷站主回路",
      groupType: "loop",
      nodeIds: [
        mainChiller?.id,
        mainChilledValve?.id,
        mainChilledPump?.id,
        loadNode?.id,
        mainCoolingValve?.id,
        mainCoolingPump?.id,
        mainCoolingTower?.id
      ].filter(Boolean)
    }
  ];

  const deviceNodeCount = nodes.filter((node) => node.nodeType === "device").length;
  const virtualNodeCount = nodes.length - deviceNodeCount;
  const degradedNodeCount = nodes.filter((node) => node.statusSummary?.degraded).length;

  const sourceStatus = buildSourceStatus([
    {
      key: "devices",
      endpoint: deviceSummary.sourceStatus?.endpoint || `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=200`,
      ok: deviceSummary.sourceStatus?.ok ?? false,
      status: deviceSummary.sourceStatus?.status ?? null,
      message: deviceSummary.sourceStatus?.message ?? null,
      error: deviceSummary.sourceStatus?.error ?? null,
      rows: deviceSummary.sourceStatus?.rows ?? null
    },
    {
      key: "devicesList",
      endpoint: deviceList.sourceStatus?.endpoint || `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=200`,
      ok: deviceList.sourceStatus?.ok ?? false,
      status: deviceList.sourceStatus?.status ?? null,
      message: deviceList.sourceStatus?.message ?? null,
      error: deviceList.sourceStatus?.error ?? null,
      rows: deviceList.sourceStatus?.rows ?? null
    },
    deviceSummary.fallbackSourceStatus
      ? {
          key: "devicesPlaceholderSummary",
          ...deviceSummary.fallbackSourceStatus
        }
      : null,
    deviceList.fallbackSourceStatus
      ? {
          key: "devicesPlaceholderList",
          ...deviceList.fallbackSourceStatus
        }
      : null
  ].filter(Boolean));

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    layoutMode,
    scope,
    freshness,
    sourceStatus,
    nodes,
    edges,
    groups,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      deviceNodeCount,
      virtualNodeCount,
      degradedNodeCount
    }
  };
}

import { loadDeviceSummary } from "../adapters/legacyDeviceAdapter.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function asTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveDatabasePathKey(siteId, requestContext = {}) {
  return (
    asTrimmedText(requestContext?.databaseKey) ||
    asTrimmedText(requestContext?.projectKey) ||
    asTrimmedText(siteId)
  );
}

function buildNodeExamples(groups = [], systemType) {
  if (!Array.isArray(groups) || !systemType) {
    return [];
  }
  return Array.from(
    new Set(
      groups
        .filter((item) => asTrimmedText(item?.type) === systemType)
        .map((item) => asTrimmedText(item?.name))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN", { numeric: true, sensitivity: "base" }));
}

function countNodeGroups(groups = [], systemType) {
  if (!Array.isArray(groups) || !systemType) {
    return 0;
  }
  return groups.filter((item) => asTrimmedText(item?.type) === systemType).length;
}

function buildValveExampleLines(groups = []) {
  if (!Array.isArray(groups)) {
    return [];
  }
  const bucket = new Map();
  groups
    .filter((item) => asTrimmedText(item?.type) === "valve")
    .forEach((item) => {
      const name = asTrimmedText(item?.name);
      if (!name) {
        return;
      }
      const category = asTrimmedText(item?.typeName) || "阀门";
      const names = bucket.get(category) || [];
      names.push(name);
      bucket.set(category, names);
    });

  return Array.from(bucket.entries())
    .sort((left, right) => left[0].localeCompare(right[0], "zh-Hans-CN", { numeric: true, sensitivity: "base" }))
    .map(([category, names]) => {
      const sortedNames = Array.from(new Set(names)).sort((left, right) =>
        left.localeCompare(right, "zh-Hans-CN", { numeric: true, sensitivity: "base" })
      );
      return `${category}：${sortedNames.join("、")}`;
    });
}

function deriveNodeStatus(count, fallback = "stable") {
  if (typeof count !== "number" || Number.isNaN(count)) {
    return fallback;
  }
  return count > 0 ? "running" : "alert";
}

export async function getTopology(config, siteId, requestContext = {}) {
  const databasePathKey = resolveDatabasePathKey(siteId, requestContext);
  const device = await loadDeviceSummary(config.legacyBaseUrl, siteId, {
    placeholderFallback: true,
    databaseKey: requestContext?.databaseKey,
    databaseKeyCandidates: requestContext?.databaseKeyCandidates,
    projectKey: requestContext?.projectKey,
    projectKeyCandidates: requestContext?.projectKeyCandidates
  });

  const summary = device.summary || {
    totalDevices: 0,
    chillerCount: 0,
    chilledPumpCount: 0,
    coolingPumpCount: 0,
    coolingTowerCount: 0
  };
  const groups = Array.isArray(device.groups) ? device.groups : [];
  const hotWaterPumpCount = countNodeGroups(groups, "hotWaterPump");
  const valveCount = countNodeGroups(groups, "valve");
  const hasHotWaterPump = hotWaterPumpCount > 0;
  const hasValveGroup = valveCount > 0;
  const coolingTowerDownstream = hasHotWaterPump ? "hotWaterPump" : hasValveGroup ? "valveGroup" : null;
  const hotWaterPumpDownstream = hasValveGroup ? "valveGroup" : null;

  const nodes = [
    {
      id: "chiller",
      label: "冷机群组(CH+LCH+MCH+HCH+FCH)",
      count: summary.chillerCount,
      downstream: "chilledPump",
      status: deriveNodeStatus(summary.chillerCount),
      examples: buildNodeExamples(groups, "chiller")
    },
    {
      id: "chilledPump",
      label: "Chilled Pumps",
      count: summary.chilledPumpCount,
      downstream: "load",
      status: deriveNodeStatus(summary.chilledPumpCount),
      examples: buildNodeExamples(groups, "chilledPump")
    },
    {
      id: "load",
      label: "Building Load",
      count: null,
      downstream: "coolingPump",
      status: deriveNodeStatus(summary.totalDevices, "stable"),
      examples: []
    },
    {
      id: "coolingPump",
      label: "Cooling Pumps",
      count: summary.coolingPumpCount,
      downstream: "coolingTower",
      status: deriveNodeStatus(summary.coolingPumpCount),
      examples: buildNodeExamples(groups, "coolingPump")
    },
    {
      id: "coolingTower",
      label: "冷却塔组 (CTF+CT)",
      count: summary.coolingTowerCount,
      downstream: coolingTowerDownstream,
      status: deriveNodeStatus(summary.coolingTowerCount),
      examples: buildNodeExamples(groups, "coolingTower")
    }
  ];

  if (hasHotWaterPump) {
    nodes.push({
      id: "hotWaterPump",
      label: "热水泵组(HWP)",
      count: hotWaterPumpCount,
      downstream: hotWaterPumpDownstream,
      status: deriveNodeStatus(hotWaterPumpCount),
      examples: buildNodeExamples(groups, "hotWaterPump")
    });
  }

  if (hasValveGroup) {
    nodes.push({
      id: "valveGroup",
      label: "阀门组",
      count: valveCount,
      downstream: null,
      status: deriveNodeStatus(valveCount),
      examples: buildNodeExamples(groups, "valve"),
      exampleLines: buildValveExampleLines(groups)
    });
  }

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    summary,
    groups,
    nodes,
    sourceStatus: buildSourceStatus(
      [
        {
          key: "devices",
          endpoint: `/zsqy/drinfo/${databasePathKey}/findObject?pageCurrent=1&pageSize=200`,
          ...device.sourceStatus
        },
        device.fallbackSourceStatus
          ? {
              key: "devicesPlaceholder",
              ...device.fallbackSourceStatus
            }
          : null
      ].filter(Boolean)
    )
  };
}

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = path.resolve(APP_ROOT, "../..");
const SVG_RELATIVE = "apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg";
const POINT_CONTRACT_RELATIVE = "apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2-point-bindings.json";
const PORT_CONTRACT_RELATIVE = "apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2-port-anchors.json";
const PNG_RELATIVE = "output/blender/chilled-water-plant-overview-latest-v2-2d.png";
const PNG_PROVENANCE_RELATIVE = "output/blender/chilled-water-plant-overview-latest-v2-2d-provenance.json";
const RENDER_REPORT_RELATIVE = "output/blender/2d-physical-assets/scada-component-render-report.json";
const REPORT_RELATIVE = "output/blender/chilled-water-plant-overview-latest-v2-2d-validation.json";

const CHILLER_COUNT = 7;
const TOWER_GROUP_FAN_COUNTS = [6, 6, 6, 6, 6, 3];
const TOWER_GROUP_COUNT = TOWER_GROUP_FAN_COUNTS.length;
const TOWER_FAN_COUNT = TOWER_GROUP_FAN_COUNTS.reduce((total, count) => total + count, 0);
const LOAD_COUNT = 4;
const EXPECTED_PROCESS_PORT_COUNT = 132;
const EXPECTED_POINT_BINDING_COUNT = 64;
const EXPECTED_FLOW_EDGE_COUNT = 122;
const EXPECTED_DECLARED_CROSSOVER_COUNT = 20;

const absolute = (relativePath) => path.join(WORKSPACE_ROOT, relativePath);
const svgPath = absolute(SVG_RELATIVE);
const pointContractPath = absolute(POINT_CONTRACT_RELATIVE);
const portContractPath = absolute(PORT_CONTRACT_RELATIVE);
const pngPath = absolute(PNG_RELATIVE);
const provenancePath = absolute(PNG_PROVENANCE_RELATIVE);
const renderReportPath = absolute(RENDER_REPORT_RELATIVE);
const reportPath = absolute(REPORT_RELATIVE);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function countClass(source, className) {
  return Array.from(source.matchAll(/class="([^"]*)"/g))
    .filter((match) => match[1].split(/\s+/).includes(className))
    .length;
}

function readRootAttribute(source, attribute) {
  return source.match(new RegExp(`${attribute}="([^"]+)"`))?.[1] ?? null;
}

function readTagAttribute(tag, attribute) {
  return tag?.match(new RegExp(`${attribute}="([^"]+)"`))?.[1] ?? null;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-7) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-7 && b[0] >= Math.min(a[0], c[0]) - 1e-7 &&
    b[1] <= Math.max(a[1], c[1]) + 1e-7 && b[1] >= Math.min(a[1], c[1]) - 1e-7;
}

function samePoint(a, b) {
  return distance(a, b) < 1e-7;
}

function segmentsIntersect(a, b, c, d) {
  if ([a, b].some((first) => [c, d].some((second) => samePoint(first, second)))) {
    return false;
  }
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function circuitFamily(circuit) {
  if (circuit.startsWith("cooling-")) return "cooling";
  if (circuit.startsWith("chilled-")) return "chilled";
  return null;
}

function circuitDirection(circuit) {
  if (circuit.includes("supply")) return "supply";
  if (circuit.includes("return")) return "return";
  return null;
}

function pairKey(first, second) {
  return [first, second].sort().join("::");
}

function unintendedIntersectionsWhere(edges, declaredCrossovers, shouldCompare) {
  const findings = [];
  const declaredPairs = new Set(declaredCrossovers.map((crossover) => pairKey(crossover.overEdgeId, crossover.underEdgeId)));
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    const first = edges[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const second = edges[secondIndex];
      if (!shouldCompare(first, second)) continue;
      for (let a = 0; a < first.path.length - 1; a += 1) {
        for (let b = 0; b < second.path.length - 1; b += 1) {
          if (segmentsIntersect(first.path[a], first.path[a + 1], second.path[b], second.path[b + 1])) {
            if (declaredPairs.has(pairKey(first.id, second.id))) continue;
            findings.push({ first: first.id, second: second.id, firstSegment: a, secondSegment: b });
          }
        }
      }
    }
  }
  return findings;
}

function scanActiveDuplicateAssets() {
  const roots = [
    absolute("apps/chiller-shell-v1/public/models"),
    absolute("output/blender")
  ];
  const findings = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entryPath === absolute("output/blender/quarantine")) continue;
        walk(entryPath);
      } else if (/\.blend1$/i.test(entry.name) || /\s[23](?=\.[^.]+$)/.test(entry.name)) {
        findings.push(path.relative(WORKSPACE_ROOT, entryPath));
      }
    }
  };
  roots.forEach((root) => walk(root));
  return findings.sort();
}

const svg = fs.readFileSync(svgPath, "utf8");
const pointContract = JSON.parse(fs.readFileSync(pointContractPath, "utf8"));
const portContract = JSON.parse(fs.readFileSync(portContractPath, "utf8"));
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const renderReport = JSON.parse(fs.readFileSync(renderReportPath, "utf8"));
const png = fs.readFileSync(pngPath);
const pngSignatureValid = png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const pngWidth = pngSignatureValid ? png.readUInt32BE(16) : null;
const pngHeight = pngSignatureValid ? png.readUInt32BE(20) : null;

const counts = {
  chillers: countClass(svg, "chiller"),
  chilledPumps: countClass(svg, "chilled-pump"),
  coolingPumps: countClass(svg, "cooling-pump"),
  towerGroups: countClass(svg, "tower-group"),
  towerUnits: countClass(svg, "tower-unit"),
  fans: (svg.match(/href="#fan"/g) || []).length,
  loadNodes: countClass(svg, "load-node"),
  loadLoops: countClass(svg, "load-loop"),
  processPortAnchors: countClass(svg, "port-anchor"),
  pointBindings: countClass(svg, "point-binding"),
  flowEdges: countClass(svg, "flow-edge")
};
const declaredCounts = {
  chillers: Number(readRootAttribute(svg, "data-chiller-count")),
  chilledPumps: Number(readRootAttribute(svg, "data-chilled-pump-count")),
  coolingPumps: Number(readRootAttribute(svg, "data-cooling-pump-count")),
  towerGroups: Number(readRootAttribute(svg, "data-tower-group-count")),
  fansPerTowerGroup: (readRootAttribute(svg, "data-fans-per-tower-group") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number),
  fans: Number(readRootAttribute(svg, "data-fan-count")),
  loads: Number(readRootAttribute(svg, "data-load-count")),
  processPorts: Number(readRootAttribute(svg, "data-process-port-count")),
  pointBindings: Number(readRootAttribute(svg, "data-point-binding-count")),
  flowEdges: Number(readRootAttribute(svg, "data-flow-edge-count")),
  portTolerancePx: Number(readRootAttribute(svg, "data-port-tolerance-px"))
};

const allAnchors = new Map([
  ...portContract.processPortAnchors.map((anchor) => [anchor.id, [anchor.x, anchor.y]]),
  ...portContract.systemAnchors.map((anchor) => [anchor.id, [anchor.x, anchor.y]])
]);
const endpointGaps = portContract.flowEdges.flatMap((edge) => {
  const startAnchor = allAnchors.get(edge.startAnchor);
  const endAnchor = allAnchors.get(edge.endAnchor);
  return [
    { edge: edge.id, endpoint: "start", gapPx: startAnchor ? distance(edge.start, startAnchor) : Infinity },
    { edge: edge.id, endpoint: "end", gapPx: endAnchor ? distance(edge.end, endAnchor) : Infinity }
  ];
});
const maxPortGapPx = Math.max(...endpointGaps.map((entry) => entry.gapPx));
const referencedAnchors = new Set(portContract.flowEdges.flatMap((edge) => [edge.startAnchor, edge.endAnchor]));
const unreferencedProcessPorts = portContract.processPortAnchors
  .map((anchor) => anchor.id)
  .filter((id) => !referencedAnchors.has(id));

const loadIds = Array.from(svg.matchAll(/class="load-loop"\s+data-load-id="([^"]+)"/g), (match) => match[1]);
const duplicateLoadIds = loadIds.filter((id, index) => loadIds.indexOf(id) !== index);
const closedLoadLoops = Array.from({ length: LOAD_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const loadId = `LOAD-${number}`;
  const supply = portContract.flowEdges.find((edge) => edge.id === `DISTRIBUTOR_${number}_TO_${loadId}`);
  const returned = portContract.flowEdges.find((edge) => edge.id === `${loadId}_TO_COLLECTOR_${number}`);
  return Boolean(
    supply && returned &&
    supply.startAnchor === `DISTRIBUTOR__PORT_DISTRIBUTOR_BRANCH_${number}` &&
    supply.endAnchor === `${loadId}__SUPPLY_IN` &&
    returned.startAnchor === `${loadId}__RETURN_OUT` &&
    returned.endAnchor === `COLLECTOR__PORT_COLLECTOR_BRANCH_${number}` &&
    svg.includes(`data-load-id="${loadId}" data-loop-closed="true"`)
  );
}).filter(Boolean).length;

const declaredCrossovers = portContract.declaredCrossovers ?? [];
const unintendedIntersections = unintendedIntersectionsWhere(
  portContract.flowEdges,
  declaredCrossovers,
  (first, second) =>
    circuitFamily(first.circuit) === circuitFamily(second.circuit) &&
    circuitDirection(first.circuit) !== circuitDirection(second.circuit)
);
const unintendedLoadReturnIntersections = unintendedIntersectionsWhere(
  portContract.flowEdges,
  declaredCrossovers,
  (first, second) => first.circuit === "chilled-return-load" && second.circuit === "chilled-return-load"
);
const pumpInstances = Array.from({ length: CHILLER_COUNT }, (_, index) => [
  `CWP${index + 1}`,
  `CHWP${index + 1}`
]).flat();
const pumpHorizontalAnchorErrors = pumpInstances.filter((instanceId) => {
  const ports = portContract.processPortAnchors.filter((anchor) => anchor.instanceId === instanceId);
  return ports.length !== 2 || Math.abs(ports[0].y - ports[1].y) > 1e-7;
});

const chillerSourcePorts = Object.fromEntries(renderReport.assets.chiller.ports.map((port) => [port.name, port]));
const chillerHorizontalPairMaxElevationGapM = Math.max(
  Math.abs(chillerSourcePorts.PORT_CHW_IN.position_m[2] - chillerSourcePorts.PORT_CHW_OUT.position_m[2]),
  Math.abs(chillerSourcePorts.PORT_CW_IN.position_m[2] - chillerSourcePorts.PORT_CW_OUT.position_m[2])
);

const manifoldBranchAnchors = portContract.processPortAnchors.filter((anchor) => /PORT_(DISTRIBUTOR|COLLECTOR)_BRANCH_/.test(anchor.sourcePortId));
const manifoldBranchOrderValid = ["DISTRIBUTOR", "COLLECTOR"].every((instanceId) => {
  const values = manifoldBranchAnchors.filter((anchor) => anchor.instanceId === instanceId).sort((a, b) => a.sourcePortId.localeCompare(b.sourcePortId));
  return values.length === 4 && values.every((anchor, index) => index === 0 || anchor.y > values[index - 1].y);
});

const pointStatesValid = pointContract.bindings.every((binding) =>
  pointContract.allowedStates.includes(binding.state) && binding.readOnly === true
);
const unboundValuesHonest = pointContract.bindings.every((binding) =>
  binding.state !== "UNBOUND" || (binding.value === null && binding.observedAt === null)
);

const expectedTowerRuntimeMappings = TOWER_GROUP_FAN_COUNTS.flatMap((fanCount, groupIndex) => {
  const fanOffset = TOWER_GROUP_FAN_COUNTS.slice(0, groupIndex).reduce((total, count) => total + count, 0);
  return Array.from({ length: fanCount }, (_, unitIndex) => ({
    modelId: `CT${String(fanOffset + unitIndex + 1).padStart(2, "0")}`,
    runtimeId: `CTF${groupIndex + 1}${unitIndex + 1}`,
    runtimeGroup: "coolingTowers"
  }));
});
const expectedChilledPumpRuntimeMappings = Array.from({ length: CHILLER_COUNT }, (_, index) => ({
  modelId: `CHWP${index + 1}`,
  runtimeId: `CHP${index + 1}`,
  runtimeGroup: "chilledPumps"
}));
const bindingMappingKeys = new Set(pointContract.bindings.map((binding) =>
  `${binding.modelId ?? ""}|${binding.runtimeId ?? ""}|${binding.runtimeGroup ?? ""}`
));
const towerRuntimeMappingsValid = expectedTowerRuntimeMappings.every((mapping) =>
  bindingMappingKeys.has(`${mapping.modelId}|${mapping.runtimeId}|${mapping.runtimeGroup}`)
);
const chilledPumpRuntimeMappingsValid = expectedChilledPumpRuntimeMappings.every((mapping) =>
  bindingMappingKeys.has(`${mapping.modelId}|${mapping.runtimeId}|${mapping.runtimeGroup}`)
);

const towerGroupTags = Array.from(svg.matchAll(/<g class="equipment tower-group"[^>]*>/g), (match) => match[0]);
const towerGroupFanCounts = towerGroupTags.map((tag) => Number(readTagAttribute(tag, "data-fan-count")));

const physicalAssets = Object.fromEntries(["chiller", "pump", "tower"].map((assetName) => {
  const reportAsset = renderReport.assets[assetName];
  const imageTag = svg.match(new RegExp(`<image[^>]*data-asset="${assetName}"[^>]*>`, "s"))?.[0] ?? null;
  const declaredSourceSha256 = readTagAttribute(imageTag, "data-source-sha256");
  const declaredRenderSha256 = readTagAttribute(imageTag, "data-render-sha256");
  const href = readTagAttribute(imageTag, "href");
  return [assetName, {
    source: reportAsset.source,
    render: reportAsset.output,
    reportStatus: reportAsset.status,
    projection: reportAsset.camera?.projection,
    background: reportAsset.background,
    transparentPixelRatio: reportAsset.transparent_pixel_ratio,
    expectedSourceSha256: reportAsset.source_sha256,
    declaredSourceSha256,
    expectedRenderSha256: reportAsset.output_sha256,
    declaredRenderSha256,
    actualRenderSha256: sha256File(absolute(reportAsset.output)),
    embeddedAsTransparentPng: /^data:image\/png;base64,/.test(href ?? "")
  }];
}));

const activeDuplicateAssets = scanActiveDuplicateAssets();
const forbiddenComponentMatches = svg.match(/(?:isolation[ -]?valve|check[ -]?valve|y[ -]?strainer|隔离阀|止回阀|Y型过滤器)/gi) ?? [];

const checks = {
  equipmentCounts:
    counts.chillers === CHILLER_COUNT && counts.chilledPumps === CHILLER_COUNT && counts.coolingPumps === CHILLER_COUNT &&
    counts.towerGroups === TOWER_GROUP_COUNT && counts.towerUnits === TOWER_FAN_COUNT && counts.fans === TOWER_FAN_COUNT,
  declaredCountsMatch:
    declaredCounts.chillers === counts.chillers && declaredCounts.chilledPumps === counts.chilledPumps &&
    declaredCounts.coolingPumps === counts.coolingPumps && declaredCounts.towerGroups === counts.towerGroups &&
    JSON.stringify(declaredCounts.fansPerTowerGroup) === JSON.stringify(TOWER_GROUP_FAN_COUNTS) &&
    declaredCounts.fans === counts.fans && declaredCounts.loads === counts.loadNodes &&
    declaredCounts.processPorts === counts.processPortAnchors && declaredCounts.pointBindings === counts.pointBindings &&
    declaredCounts.flowEdges === counts.flowEdges,
  towerFansAlongX:
    towerGroupTags.length === TOWER_GROUP_COUNT &&
    JSON.stringify(towerGroupFanCounts) === JSON.stringify(TOWER_GROUP_FAN_COUNTS) &&
    (svg.match(/data-fan-axis="X"/g) || []).length === TOWER_GROUP_COUNT,
  explicitB25RuntimeMappings:
    readRootAttribute(svg, "data-b25-runtime-mapping") === "explicit-model-to-read-only-runtime-id" &&
    towerRuntimeMappingsValid && chilledPumpRuntimeMappingsValid,
  separatedVerticalManifolds:
    readRootAttribute(svg, "data-manifold-layout") === "stacked-same-x-separated" &&
    svg.includes("data-shared-center-x=\"1471\"") && svg.includes("同一纵向轴线上分开放置"),
  closedLoadLoops:
    counts.loadNodes === LOAD_COUNT && counts.loadLoops === LOAD_COUNT &&
    duplicateLoadIds.length === 0 && closedLoadLoops === LOAD_COUNT,
  noSupplyReturnCrossings: unintendedIntersections.length === 0,
  noUndeclaredLoadReturnCrossings: unintendedLoadReturnIntersections.length === 0,
  declaredCrossoversExplicit:
    Number(readRootAttribute(svg, "data-declared-crossover-count")) === EXPECTED_DECLARED_CROSSOVER_COUNT &&
    portContract.counts.declaredCrossovers === EXPECTED_DECLARED_CROSSOVER_COUNT &&
    (svg.match(/class="declared-crossover"/g) || []).length === EXPECTED_DECLARED_CROSSOVER_COUNT &&
    portContract.declaredCrossovers.every((crossover) => crossover.type === "non-connecting-bridge"),
  exactPointAndFlowCounts:
    counts.pointBindings === EXPECTED_POINT_BINDING_COUNT && pointContract.bindings.length === EXPECTED_POINT_BINDING_COUNT &&
    counts.flowEdges === EXPECTED_FLOW_EDGE_COUNT && portContract.counts.flowEdges === EXPECTED_FLOW_EDGE_COUNT,
  flowEvidenceBoundary:
    readRootAttribute(svg, "data-flow-evidence") === "schematic" &&
    portContract.flowEdges.every((edge) => edge.evidenceState === "UNBOUND") && svg.includes("流向动画仅为工艺示意"),
  flowDirectionAndAnimation:
    portContract.flowEdges.every((edge) => edge.direction === "start-to-end") &&
    svg.includes("@keyframes water") && svg.includes("pathLength=\"100\"") && svg.includes("animation-play-state:paused"),
  fanAnimation: svg.includes("@keyframes spin") && svg.includes("class=\"fan-spin\""),
  physicalRenderStyle: readRootAttribute(svg, "data-render-style") === "physical-scada-2.5d",
  referenceLayout: readRootAttribute(svg, "data-layout-reference") === "tower-left-chiller-center-load-right",
  renderReportPass: renderReport.status === "PASS" && portContract.renderReportSha256 === sha256File(renderReportPath),
  transparentOrthographicAssets: Object.values(physicalAssets).every((asset) =>
    asset.reportStatus === "PASS" && asset.projection === "orthographic" && asset.background === "transparent_rgba" &&
    asset.transparentPixelRatio > 0.02 && asset.embeddedAsTransparentPng
  ),
  physicalAssetHashesMatch: Object.values(physicalAssets).every((asset) =>
    asset.expectedSourceSha256 === asset.declaredSourceSha256 &&
    asset.expectedRenderSha256 === asset.declaredRenderSha256 &&
    asset.expectedRenderSha256 === asset.actualRenderSha256
  ),
  blenderPortContract:
    portContract.status === "PASS" && counts.processPortAnchors === EXPECTED_PROCESS_PORT_COUNT &&
    portContract.counts.processPorts === EXPECTED_PROCESS_PORT_COUNT &&
    new Set(portContract.processPortAnchors.map((anchor) => anchor.id)).size === EXPECTED_PROCESS_PORT_COUNT &&
    portContract.processPortAnchors.every((anchor) => anchor.sourcePortId && anchor.semanticRole && anchor.sourcePositionM && anchor.sourceNormal),
  portEndpointTolerance: Number.isFinite(maxPortGapPx) && maxPortGapPx <= declaredCounts.portTolerancePx && unreferencedProcessPorts.length === 0,
  pumpPortsHorizontal: pumpHorizontalAnchorErrors.length === 0,
  chillerSourcePairsHorizontal: chillerHorizontalPairMaxElevationGapM <= 0.005,
  manifoldPortsOrderedAndAligned: manifoldBranchOrderValid,
  readOnlyPointContract:
    pointContract.status === "PASS" && pointContract.contract === "read-only-evidence-v1" &&
    pointContract.controlBoundary.includes("no PLC writes") && pointStatesValid && unboundValuesHonest &&
    counts.pointBindings === pointContract.bindings.length,
  pngDimensionsAndProvenance:
    pngSignatureValid && pngWidth === 1920 && pngHeight === 1080 && provenance.status === "PASS" &&
    provenance.width === 1920 && provenance.height === 1080 &&
    provenance.svgSha256 === sha256File(svgPath) && provenance.pngSha256 === sha256File(pngPath),
  forbiddenComponentsZero: forbiddenComponentMatches.length === 0,
  activeDuplicateAssetsZero: activeDuplicateAssets.length === 0,
  noBrandLogo: !/(约克|\bYORK\b)/i.test(svg)
};

const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
const report = {
  generatedAt: new Date().toISOString(),
  status,
  truthPaths: {
    svg: SVG_RELATIVE,
    png: PNG_RELATIVE,
    pointContract: POINT_CONTRACT_RELATIVE,
    portContract: PORT_CONTRACT_RELATIVE,
    renderReport: RENDER_REPORT_RELATIVE,
    pngProvenance: PNG_PROVENANCE_RELATIVE
  },
  counts,
  declaredCounts,
  topology: {
    loadIds,
    duplicateLoadIds,
    closedLoadLoops,
    maxPortGapPx,
    unreferencedProcessPorts,
    unintendedSupplyReturnIntersections: unintendedIntersections,
    unintendedLoadReturnIntersections,
    declaredCrossovers: portContract.declaredCrossovers,
    pumpHorizontalAnchorErrors,
    chillerHorizontalPairMaxElevationGapM,
    manifoldBranchOrderValid
  },
  b25RuntimeMappings: {
    towerFans: expectedTowerRuntimeMappings,
    chilledPumps: expectedChilledPumpRuntimeMappings,
    towerRuntimeMappingsValid,
    chilledPumpRuntimeMappingsValid
  },
  pointEvidence: {
    allowedStates: pointContract.allowedStates,
    bindings: pointContract.bindings.length,
    allReadOnly: pointStatesValid,
    allCurrentValuesUnbound: unboundValuesHonest
  },
  physicalAssets,
  png: {
    signatureValid: pngSignatureValid,
    width: pngWidth,
    height: pngHeight,
    svgSha256: sha256File(svgPath),
    pngSha256: sha256File(pngPath),
    provenanceStatus: provenance.status
  },
  forbiddenComponents: {
    isolationValves: 0,
    checkValves: 0,
    yStrainers: 0,
    matches: forbiddenComponentMatches
  },
  activeDuplicateAssets,
  visualReview: {
    required: true,
    targets: ["full preview", "six tower groups / 33 fans", "seven plant trains", "stacked manifolds and four single-node load loops"],
    note: "Machine validation does not replace visual review of text clearance and perceived pipe density."
  },
  checks
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`plant 2D validation ${status}`);
console.log(`- equipment: ${counts.chillers} chillers, ${counts.chilledPumps} chilled pumps, ${counts.coolingPumps} cooling pumps, ${counts.towerGroups} tower groups, ${counts.fans} fans`);
console.log(`- topology: ${closedLoadLoops}/${LOAD_COUNT} load loops, ${counts.processPortAnchors} Blender ports, ${counts.flowEdges} flow edges, max endpoint gap ${maxPortGapPx.toFixed(3)} px`);
console.log(`- evidence: ${pointContract.bindings.length} read-only point bindings, current state UNBOUND`);
console.log(`- preview: ${pngWidth}x${pngHeight}, provenance ${provenance.status}`);
console.log(`- report: ${REPORT_RELATIVE}`);

if (status !== "PASS") {
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  console.error(`failed checks: ${failed.join(", ")}`);
  process.exitCode = 1;
}

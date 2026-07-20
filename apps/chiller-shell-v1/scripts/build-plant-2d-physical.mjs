import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = path.resolve(APP_ROOT, "../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output/blender");
const PUBLIC_2D_DIR = path.join(APP_ROOT, "public/models/plant-overview/2d");
const SVG_PATH = path.join(PUBLIC_2D_DIR, "chilled-water-plant-overview-latest-v2.svg");
const POINT_CONTRACT_PATH = path.join(PUBLIC_2D_DIR, "chilled-water-plant-overview-latest-v2-point-bindings.json");
const PORT_CONTRACT_PATH = path.join(PUBLIC_2D_DIR, "chilled-water-plant-overview-latest-v2-port-anchors.json");
const PNG_PATH = path.join(OUTPUT_DIR, "chilled-water-plant-overview-latest-v2-2d.png");
const PNG_PROVENANCE_PATH = path.join(OUTPUT_DIR, "chilled-water-plant-overview-latest-v2-2d-provenance.json");
const RENDER_REPORT_PATH = path.join(OUTPUT_DIR, "2d-physical-assets/scada-component-render-report.json");

const CHILLER_COUNT = 7;
const TOWER_GROUP_FAN_COUNTS = [6, 6, 6, 6, 6, 3];
const TOWER_GROUP_COUNT = TOWER_GROUP_FAN_COUNTS.length;
const TOWER_FAN_COUNT = TOWER_GROUP_FAN_COUNTS.reduce((total, count) => total + count, 0);
const LOAD_COUNT = 4;
const EXPECTED_PROCESS_PORT_COUNT = CHILLER_COUNT * 8 + TOWER_FAN_COUNT * 2 + LOAD_COUNT * 2 + 2;
const EXPECTED_POINT_BINDING_COUNT = CHILLER_COUNT * 3 + TOWER_FAN_COUNT + LOAD_COUNT * 2 + 2;
const EXPECTED_FLOW_EDGE_COUNT = CHILLER_COUNT * 6 + TOWER_FAN_COUNT * 2 + LOAD_COUNT * 2 + 6;
const EXPECTED_DECLARED_CROSSOVER_COUNT = CHILLER_COUNT * 2 + (LOAD_COUNT * (LOAD_COUNT - 1)) / 2;
const TOWER_FAN_OFFSETS = TOWER_GROUP_FAN_COUNTS.map((_, index) =>
  TOWER_GROUP_FAN_COUNTS.slice(0, index).reduce((total, count) => total + count, 0)
);

fs.mkdirSync(PUBLIC_2D_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function relativeToWorkspace(filePath) {
  return path.relative(WORKSPACE_ROOT, filePath);
}

const renderReport = JSON.parse(fs.readFileSync(RENDER_REPORT_PATH, "utf8"));
if (renderReport.status !== "PASS") {
  throw new Error(`transparent component render report is not PASS: ${renderReport.status}`);
}

const renderReportSha256 = sha256File(RENDER_REPORT_PATH);
const embeddedAssets = Object.fromEntries(["chiller", "pump", "tower"].map((assetName) => {
  const record = renderReport.assets?.[assetName];
  if (!record || record.status !== "PASS" || record.background !== "transparent_rgba" || record.camera?.projection !== "orthographic") {
    throw new Error(`${assetName} transparent orthographic render metadata is invalid`);
  }
  const imagePath = path.join(WORKSPACE_ROOT, record.output);
  const imageBytes = fs.readFileSync(imagePath);
  const outputSha256 = sha256Bytes(imageBytes);
  if (outputSha256 !== record.output_sha256) {
    throw new Error(`${assetName} render sha256 does not match report`);
  }
  return [assetName, {
    dataUri: `data:image/png;base64,${imageBytes.toString("base64")}`,
    outputSha256,
    sourceSha256: record.source_sha256,
    source: record.source,
    render: record.output,
    ports: record.ports
  }];
}));

function getSourcePort(assetName, sourcePortId) {
  const record = renderReport.assets?.[assetName];
  const port = record?.ports?.find((candidate) => candidate.name === sourcePortId);
  if (!port) {
    throw new Error(`missing Blender source port ${assetName}:${sourcePortId}`);
  }
  return port;
}

const processPortAnchors = [];
const systemAnchors = [];
const flowEdges = [];
const pointBindings = [];
const declaredCrossovers = [];

function portAnchor(instanceId, assetName, sourcePortId, x, y, anchorMode) {
  const sourcePort = getSourcePort(assetName, sourcePortId);
  const id = `${instanceId}__${sourcePortId}`;
  const anchor = {
    id,
    instanceId,
    assetName,
    sourcePortId,
    semanticRole: sourcePort.role,
    x,
    y,
    sourcePositionM: sourcePort.position_m,
    sourceNormal: sourcePort.connection_normal,
    nominalDiameterMm: sourcePort.nominal_diameter_mm,
    renderAnchorUv: sourcePort.anchor_uv ?? null,
    anchorMode
  };
  processPortAnchors.push(anchor);
  return {
    ...anchor,
    markup: `<circle id="${id}" class="port-anchor" cx="${x}" cy="${y}" r="4.5"
      data-instance-id="${instanceId}" data-asset="${assetName}" data-source-port-id="${sourcePortId}"
      data-semantic-role="${sourcePort.role}" data-source-position-m="${sourcePort.position_m.join(",")}"
      data-source-normal="${sourcePort.connection_normal}" data-dn-mm="${sourcePort.nominal_diameter_mm ?? ""}"
      data-render-anchor-uv="${sourcePort.anchor_uv?.join(",") ?? "metadata-only"}"
      data-anchor-mode="${anchorMode}" data-anchor-source="blender-port-metadata"/>`
  };
}

function systemAnchor(id, x, y, role) {
  const anchor = { id, x, y, role };
  systemAnchors.push(anchor);
  return {
    ...anchor,
    markup: `<circle id="${id}" class="system-anchor" cx="${x}" cy="${y}" r="2" data-system-role="${role}"/>`
  };
}

function polyline(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

function flowEdge({ id, start, end, points = [start, end], colorClass, marker, circuit, evidenceState = "UNBOUND" }) {
  const d = polyline(points);
  const record = {
    id,
    startAnchor: start.id,
    endAnchor: end.id,
    start: [start.x, start.y],
    end: [end.x, end.y],
    circuit,
    evidenceState,
    direction: "start-to-end",
    path: points.map((point) => [point.x, point.y])
  };
  flowEdges.push(record);
  return `<g class="flow-edge" data-edge-id="${id}" data-start-anchor="${start.id}" data-end-anchor="${end.id}"
      data-start-x="${start.x}" data-start-y="${start.y}" data-end-x="${end.x}" data-end-y="${end.y}"
      data-circuit="${circuit}" data-evidence-state="${evidenceState}" data-flow-direction="start-to-end"
      data-animation-mode="schematic" data-flow-active="unbound">
    <path class="pipe-base ${colorClass}" d="${d}" pathLength="100"/>
    <path class="flow ${colorClass}" d="${d}" pathLength="100" marker-end="${marker}"/>
  </g>`;
}

function declaredCrossover({ id, x, y, overEdgeId, underEdgeId, colorClass }) {
  declaredCrossovers.push({ id, x, y, overEdgeId, underEdgeId, type: "non-connecting-bridge" });
  return `<g class="declared-crossover" data-crossover-id="${id}" data-over-edge="${overEdgeId}" data-under-edge="${underEdgeId}" data-connected="false">
    <circle cx="${x}" cy="${y}" r="8" class="crossover-mask"/>
    <path d="M${x - 9} ${y}Q${x} ${y - 10} ${x + 9} ${y}" class="crossover-bridge ${colorClass}"/>
  </g>`;
}

function pointBinding({
  id,
  endpoint,
  selector,
  unit,
  label,
  x,
  y,
  width = 106,
  align = "middle",
  modelId = null,
  runtimeId = null,
  runtimeGroup = null
}) {
  const binding = {
    id,
    endpoint,
    selector,
    unit,
    state: "UNBOUND",
    value: null,
    observedAt: null,
    readOnly: true,
    modelId,
    runtimeId,
    runtimeGroup,
    layout: { x, y, width, height: 24 },
    liveRequirement: "finite value + healthy related source + authoritative field timestamp within threshold"
  };
  pointBindings.push(binding);
  const textX = align === "start" ? x + 8 : x + width / 2;
  return `<g class="point-binding" data-point-id="${id}" data-point-state="UNBOUND" data-evidence="unbound"
      data-endpoint="${endpoint}" data-selector="${selector}" data-unit="${unit}" data-read-only="true"
      data-model-id="${modelId ?? ""}" data-runtime-id="${runtimeId ?? ""}" data-runtime-group="${runtimeGroup ?? ""}">
    <rect x="${x}" y="${y}" width="${width}" height="24" rx="7"/>
    <text x="${textX}" y="${y + 17}" text-anchor="${align}">${label} --${unit ? ` ${unit}` : ""}</text>
  </g>`;
}

function physicalSymbol(id, assetName, width, height) {
  const asset = embeddedAssets[assetName];
  return `<symbol id="${id}" viewBox="0 0 ${width} ${height}">
    <ellipse cx="${width / 2}" cy="${height - 8}" rx="${width * 0.42}" ry="7" class="asset-shadow"/>
    <image class="physical-image" data-asset="${assetName}" data-source-sha256="${asset.sourceSha256}"
      data-render-sha256="${asset.outputSha256}" data-render-report-sha256="${renderReportSha256}"
      href="${asset.dataUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
  </symbol>`;
}

function towerGroup(index) {
  const y = 145 + index * 145;
  const groupId = `CTG${String(index + 1).padStart(2, "0")}`;
  const runtimeGroupId = `CT${index + 1}`;
  const fanCount = TOWER_GROUP_FAN_COUNTS[index];
  const cellStartX = 120 + ((6 - fanCount) * 80) / 2;
  const cellXs = Array.from({ length: fanCount }, (_, unitIndex) => cellStartX + unitIndex * 80);
  const supplyHeader = systemAnchor(`${groupId}__CWS_HEADER`, 625, y + 130, "cooling-supply-group-header");
  const returnHeader = systemAnchor(`${groupId}__CWR_HEADER`, 650, y + 112, "cooling-return-group-header");
  const units = Array.from({ length: fanCount }, (_, unitIndex) => {
    const x = cellXs[unitIndex];
    const globalFanIndex = TOWER_FAN_OFFSETS[index] + unitIndex + 1;
    const unitId = `CT${String(globalFanIndex).padStart(2, "0")}`;
    const runtimeId = `CTF${index + 1}${unitIndex + 1}`;
    const inPort = portAnchor(unitId, "tower", "PORT_CW_IN", x + 3, y + 75, "projected-role-to-group-return");
    const outPort = portAnchor(unitId, "tower", "PORT_CW_OUT", x + 67, y + 75, "projected-role-to-group-supply");
    const returnTap = systemAnchor(`${unitId}__CWR_TAP`, inPort.x, y + 112, "cooling-return-branch-tap");
    const supplyTap = systemAnchor(`${unitId}__CWS_TAP`, outPort.x, y + 130, "cooling-supply-branch-tap");
    const towerFrequency = pointBinding({
      id: `${unitId}.frequencyHz`,
      endpoint: "/runtime/summary",
      selector: `groups.coolingTowers[id=${runtimeId}].frequencyHz`,
      unit: "Hz",
      label: "频",
      x: x + 8,
      y: y + 82,
      width: 54,
      modelId: unitId,
      runtimeId,
      runtimeGroup: "coolingTowers"
    });
    return `<g class="tower-unit" data-id="${unitId}" data-runtime-id="${runtimeId}" data-runtime-group="coolingTowers">
      ${flowEdge({ id: `${unitId}__CWR_TO_IN`, start: returnTap, end: inPort, points: [returnTap, inPort], colorClass: "cool-return", marker: "url(#arrow-yellow)", circuit: "cooling-return" })}
      ${flowEdge({ id: `${unitId}__OUT_TO_CWS`, start: outPort, end: supplyTap, points: [outPort, supplyTap], colorClass: "cool-supply", marker: "url(#arrow-green)", circuit: "cooling-supply" })}
      <use href="#physical-tower" x="${x}" y="${y + 18}" width="70" height="60"/>
      <use href="#fan" x="${x + 23}" y="${y + 20}" width="24" height="24"/>
      <text x="${x + 35}" y="${y + 15}" text-anchor="middle" class="device-tag">${unitId}</text>
      ${towerFrequency}${inPort.markup}${outPort.markup}${returnTap.markup}${supplyTap.markup}
    </g>`;
  }).join("\n");
  return `<g class="equipment tower-group" data-group="${groupId}" data-runtime-group-id="${runtimeGroupId}" data-fan-count="${fanCount}" data-fan-axis="X">
    <rect x="68" y="${y}" width="542" height="136" rx="14" class="equipment-zone"/>
    <text x="89" y="${y + 68}" text-anchor="middle" class="group-title"
      transform="rotate(-90 89 ${y + 68})">${groupId} · ${fanCount}风机</text>
    <path class="tower-branch cool-return" d="M76 ${y + 112}H650"/>
    <path class="tower-branch cool-supply" d="M76 ${y + 130}H625"/>
    ${units}${supplyHeader.markup}${returnHeader.markup}
  </g>`;
}

const rowY = Array.from({ length: CHILLER_COUNT }, (_, index) => 142 + index * 124);

function plantRow(index) {
  const y = rowY[index];
  const number = String(index + 1);
  const cwpId = `CWP${number}`;
  const chillerId = `CH${number}`;
  const chwpId = `CHWP${number}`;
  const chwpRuntimeId = `CHP${number}`;

  const coolingSupplyTap = systemAnchor(`${cwpId}__CWS_HEADER_TAP`, 625, y + 39, "cooling-supply-header-tap");
  const coolingReturnTap = systemAnchor(`${chillerId}__CWR_HEADER_TAP`, 650, y + 82, "cooling-return-header-tap");
  const chilledSupplyTap = systemAnchor(`${chwpId}__CHWS_HEADER_TAP`, 1360, y + 39, "chilled-supply-header-tap");
  const chilledReturnTap = systemAnchor(`${chillerId}__CHWR_HEADER_TAP`, 1405, y + 82, "chilled-return-header-tap");

  const cwpSuction = portAnchor(cwpId, "pump", "PORT_SUCTION_IN", 665, y + 39, "installed-rz-minus90-left");
  const cwpDischarge = portAnchor(cwpId, "pump", "PORT_DISCHARGE_OUT", 835, y + 39, "installed-rz-minus90-right");
  const cwIn = portAnchor(chillerId, "chiller", "PORT_CW_IN", 890, y + 30, "semantic-left-pair-lower-y-order");
  const cwOut = portAnchor(chillerId, "chiller", "PORT_CW_OUT", 890, y + 67, "semantic-left-pair-higher-y-order");
  const chwOut = portAnchor(chillerId, "chiller", "PORT_CHW_OUT", 1110, y + 30, "semantic-right-pair-higher-y-order");
  const chwIn = portAnchor(chillerId, "chiller", "PORT_CHW_IN", 1110, y + 67, "semantic-right-pair-lower-y-order");
  const chwpSuction = portAnchor(chwpId, "pump", "PORT_SUCTION_IN", 1140, y + 39, "installed-rz-minus90-left");
  const chwpDischarge = portAnchor(chwpId, "pump", "PORT_DISCHARGE_OUT", 1310, y + 39, "installed-rz-minus90-right");

  const pipes = [
    flowEdge({ id: `${cwpId}__CWS_TO_SUCTION`, start: coolingSupplyTap, end: cwpSuction, colorClass: "cool-supply", marker: "url(#arrow-green)", circuit: "cooling-supply" }),
    flowEdge({ id: `${cwpId}__DISCHARGE_TO_${chillerId}__CW_IN`, start: cwpDischarge, end: cwIn, points: [cwpDischarge, { x: 865, y: y + 39 }, cwIn], colorClass: "cool-supply", marker: "url(#arrow-green)", circuit: "cooling-supply" }),
    flowEdge({ id: `${chillerId}__CW_OUT_TO_CWR`, start: cwOut, end: coolingReturnTap, points: [cwOut, { x: 870, y: y + 82 }, coolingReturnTap], colorClass: "cool-return", marker: "url(#arrow-yellow)", circuit: "cooling-return" }),
    flowEdge({ id: `${chillerId}__CHW_OUT_TO_${chwpId}__SUCTION`, start: chwOut, end: chwpSuction, points: [chwOut, { x: 1125, y: y + 39 }, chwpSuction], colorClass: "chilled-supply", marker: "url(#arrow-cyan)", circuit: "chilled-supply" }),
    flowEdge({ id: `${chwpId}__DISCHARGE_TO_CHWS`, start: chwpDischarge, end: chilledSupplyTap, colorClass: "chilled-supply", marker: "url(#arrow-cyan)", circuit: "chilled-supply" }),
    flowEdge({ id: `${chillerId}__CHWR_TO_CHW_IN`, start: chilledReturnTap, end: chwIn, points: [chilledReturnTap, { x: 1125, y: y + 82 }, chwIn], colorClass: "chilled-return", marker: "url(#arrow-blue)", circuit: "chilled-return" })
  ].join("\n");
  const coolingCrossover = declaredCrossover({
    id: `${cwpId}__CWS_OVER_CWR`, x: 650, y: y + 39,
    overEdgeId: `${cwpId}__CWS_TO_SUCTION`, underEdgeId: "CWR_HEADER", colorClass: "cool-supply"
  });
  const chilledCrossover = declaredCrossover({
    id: `${chillerId}__CHWR_OVER_CHWS`, x: 1360, y: y + 82,
    overEdgeId: `${chillerId}__CHWR_TO_CHW_IN`, underEdgeId: "CHWS_HEADER", colorClass: "chilled-return"
  });

  const cwpPoint = pointBinding({ id: `${cwpId}.frequencyHz`, endpoint: "/runtime/summary", selector: `groups.coolingPumps[id=${cwpId}].frequencyHz`, unit: "Hz", label: "频率", x: 697, y: y + 90, width: 106, modelId: cwpId, runtimeId: cwpId, runtimeGroup: "coolingPumps" });
  const chillerPoint = pointBinding({ id: `${chillerId}.currentPercent`, endpoint: "/runtime/summary", selector: `groups.chillers[id=${chillerId}].currentPercent`, unit: "%", label: "负荷", x: 947, y: y + 90, width: 106, modelId: chillerId, runtimeId: chillerId, runtimeGroup: "chillers" });
  const chwpPoint = pointBinding({ id: `${chwpId}.frequencyHz`, endpoint: "/runtime/summary", selector: `groups.chilledPumps[id=${chwpRuntimeId}].frequencyHz`, unit: "Hz", label: "频率", x: 1172, y: y + 90, width: 106, modelId: chwpId, runtimeId: chwpRuntimeId, runtimeGroup: "chilledPumps" });

  return `<g class="plant-row" data-row="${number}" data-topology="CWS-CWP-CH-CWR|CHWS-CHWP-CH-CHWR">
    <g class="row-pipes">${pipes}</g>
    ${coolingCrossover}${chilledCrossover}
    <g class="equipment cooling-pump" data-id="${cwpId}"><use href="#physical-pump" x="665" y="${y + 4}" width="170" height="72"/><g class="device-id-chip"><rect x="720" y="${y + 2}" width="60" height="20" rx="6"/><text x="750" y="${y + 16}" text-anchor="middle">${cwpId}</text></g>${cwpPoint}${cwpSuction.markup}${cwpDischarge.markup}</g>
    <g class="equipment chiller" data-id="${chillerId}"><use href="#physical-chiller" x="890" y="${y - 8}" width="220" height="98"/><g class="device-id-chip"><rect x="970" y="${y - 4}" width="60" height="20" rx="6"/><text x="1000" y="${y + 10}" text-anchor="middle">${chillerId}</text></g>${chillerPoint}${cwIn.markup}${cwOut.markup}${chwOut.markup}${chwIn.markup}</g>
    <g class="equipment chilled-pump" data-id="${chwpId}"><use href="#physical-pump" x="1140" y="${y + 4}" width="170" height="72"/><g class="device-id-chip"><rect x="1193" y="${y + 2}" width="64" height="20" rx="6"/><text x="1225" y="${y + 16}" text-anchor="middle">${chwpId}</text></g>${chwpPoint}${chwpSuction.markup}${chwpDischarge.markup}</g>
    ${coolingSupplyTap.markup}${coolingReturnTap.markup}${chilledSupplyTap.markup}${chilledReturnTap.markup}
  </g>`;
}

function loadLoop(index) {
  const number = String(index + 1).padStart(2, "0");
  const loadId = `LOAD-${number}`;
  const cardY = 174 + index * 180;
  const centerY = cardY + 46;
  const supplyPort = systemAnchor(`${loadId}__SUPPLY_IN`, 1580, centerY - 14, "load-chilled-supply-in");
  const returnPort = systemAnchor(`${loadId}__RETURN_OUT`, 1730, centerY + 14, "load-chilled-return-out");
  const distributorPort = portAnchor(`DISTRIBUTOR`, "manifold", `PORT_DISTRIBUTOR_BRANCH_${number}`, 1500, 195 + index * 50, "vertical-installed-branch-top-to-bottom");
  const collectorPort = portAnchor(`COLLECTOR`, "manifold", `PORT_COLLECTOR_BRANCH_${number}`, 1500, 870 + index * 40, "vertical-installed-branch-top-to-bottom");
  const supplyLaneX = 1560 - index * 15;
  const returnLaneX = 1760 + index * 40;

  const supply = flowEdge({
    id: `DISTRIBUTOR_${number}_TO_${loadId}`,
    start: distributorPort,
    end: supplyPort,
    points: [distributorPort, { x: supplyLaneX, y: distributorPort.y }, { x: supplyLaneX, y: supplyPort.y }, supplyPort],
    colorClass: "chilled-supply",
    marker: "url(#arrow-cyan)",
    circuit: "chilled-supply-load"
  });
  const returned = flowEdge({
    id: `${loadId}_TO_COLLECTOR_${number}`,
    start: returnPort,
    end: collectorPort,
    points: [returnPort, { x: returnLaneX, y: returnPort.y }, { x: returnLaneX, y: collectorPort.y }, collectorPort],
    colorClass: "chilled-return",
    marker: "url(#arrow-blue)",
    circuit: "chilled-return-load"
  });
  const returnCrossovers = Array.from({ length: index }, (_, previousIndex) => {
    const previousNumber = String(previousIndex + 1).padStart(2, "0");
    return declaredCrossover({
      id: `${loadId}__RETURN_OVER_LOAD_${previousNumber}`,
      x: 1760 + previousIndex * 40,
      y: returnPort.y,
      overEdgeId: `${loadId}_TO_COLLECTOR_${number}`,
      underEdgeId: `LOAD-${previousNumber}_TO_COLLECTOR_${previousNumber}`,
      colorClass: "chilled-return"
    });
  }).join("");

  const supplyTemp = pointBinding({ id: `${loadId}.supplyTempC`, endpoint: "/runtime/summary", selector: `groups.branches[${index}].supplyTempC`, unit: "°C", label: "供温", x: 1590, y: cardY + 36, width: 126, align: "start" });
  const returnTemp = pointBinding({ id: `${loadId}.returnTempC`, endpoint: "/runtime/summary", selector: `groups.branches[${index}].returnTempC`, unit: "°C", label: "回温", x: 1590, y: cardY + 64, width: 126, align: "start" });
  return `<g id="load-loop-${number}" class="load-loop" data-load-id="${loadId}" data-loop-closed="true">
    ${supply}${returned}${returnCrossovers}
    <g class="load-node" data-node-id="${loadId}" data-supply-port="${supplyPort.id}" data-return-port="${returnPort.id}">
      <rect x="1580" y="${cardY}" width="150" height="102" rx="13" class="load-card"/>
      <text x="1594" y="${cardY + 25}" class="load-label">${loadId} 末端负荷</text>
      ${supplyTemp}${returnTemp}${supplyPort.markup}${returnPort.markup}
    </g>
    ${distributorPort.markup}${collectorPort.markup}
  </g>`;
}

const coolingSupplyTop = systemAnchor("CWS_HEADER_TOP", 625, 125, "cooling-supply-header-top");
const coolingSupplyBottom = systemAnchor("CWS_HEADER_BOTTOM", 625, 970, "cooling-supply-header-bottom");
const coolingReturnTop = systemAnchor("CWR_HEADER_TOP", 650, 125, "cooling-return-header-top");
const coolingReturnBottom = systemAnchor("CWR_HEADER_BOTTOM", 650, 970, "cooling-return-header-bottom");
const chilledSupplyTop = systemAnchor("CHWS_HEADER_TOP", 1360, 125, "chilled-supply-header-top");
const chilledSupplyBottom = systemAnchor("CHWS_HEADER_BOTTOM", 1360, 970, "chilled-supply-header-bottom");
const chilledReturnTop = systemAnchor("CHWR_HEADER_TOP", 1405, 125, "chilled-return-header-top");
const chilledReturnBottom = systemAnchor("CHWR_HEADER_BOTTOM", 1405, 970, "chilled-return-header-bottom");
const distributorMain = portAnchor("DISTRIBUTOR", "manifold", "PORT_DISTRIBUTOR_MAIN_IN", 1471, 155, "vertical-installed-main-top");
const collectorMain = portAnchor("COLLECTOR", "manifold", "PORT_COLLECTOR_MAIN_OUT", 1471, 1005, "vertical-installed-main-bottom");

const chilledHeaderFlow = pointBinding({ id: "CHW.HEADER.flowM3h", endpoint: "/runtime/summary", selector: "keySignals.chilledWater.flowM3h", unit: "m³/h", label: "流量", x: 1240, y: 104, width: 106 });
const coolingHeaderFlow = pointBinding({ id: "CW.HEADER.flowM3h", endpoint: "/runtime/summary", selector: "keySignals.coolingWater.flowM3h", unit: "m³/h", label: "流量", x: 489, y: 104, width: 106 });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
  role="img" aria-labelledby="svg-title svg-description"
  data-chiller-count="${CHILLER_COUNT}" data-chilled-pump-count="${CHILLER_COUNT}" data-cooling-pump-count="${CHILLER_COUNT}"
  data-tower-group-count="${TOWER_GROUP_COUNT}" data-fans-per-tower-group="${TOWER_GROUP_FAN_COUNTS.join(",")}" data-fan-count="${TOWER_FAN_COUNT}" data-load-count="${LOAD_COUNT}"
  data-process-port-count="${EXPECTED_PROCESS_PORT_COUNT}" data-point-binding-count="${EXPECTED_POINT_BINDING_COUNT}" data-flow-edge-count="${EXPECTED_FLOW_EDGE_COUNT}"
  data-port-tolerance-px="1" data-declared-crossover-count="${EXPECTED_DECLARED_CROSSOVER_COUNT}" data-flow-evidence="schematic"
  data-point-contract="read-only-evidence-v1" data-point-states="LIVE STALE FAULT UNBOUND"
  data-b25-runtime-mapping="explicit-model-to-read-only-runtime-id"
  data-render-style="physical-scada-2.5d" data-layout-reference="tower-left-chiller-center-load-right"
  data-manifold-layout="stacked-same-x-separated">
  <title id="svg-title">冷站数字孪生实物感SCADA二维水力图</title>
  <desc id="svg-description">B25正式版：六组横流冷却塔共三十三台风机、七台冷却泵、七台主机、七台冷冻泵、上下同轴分集水器与四个独立供回水闭环负荷。所有点位均为只读绑定；缺少现场值和时效证据时显示UNBOUND。</desc>
  <defs>
    <radialGradient id="bg" cx="58%" cy="48%" r="74%"><stop offset="0" stop-color="#17445b"/><stop offset=".48" stop-color="#0b2940"/><stop offset="1" stop-color="#041422"/></radialGradient>
    <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#2b6576" stroke-opacity=".11"/></pattern>
    <filter id="glow" x="-35%" y="-50%" width="170%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="equipment-shadow" x="-25%" y="-30%" width="150%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000814" flood-opacity=".86"/></filter>
    <marker id="arrow-green" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L12 6 0 12Z" fill="#70e39b"/></marker>
    <marker id="arrow-yellow" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L12 6 0 12Z" fill="#d6d77b"/></marker>
    <marker id="arrow-cyan" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L12 6 0 12Z" fill="#66dff5"/></marker>
    <marker id="arrow-blue" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L12 6 0 12Z" fill="#439ef4"/></marker>
    ${physicalSymbol("physical-chiller", "chiller", 220, 98)}
    ${physicalSymbol("physical-pump", "pump", 170, 72)}
    ${physicalSymbol("physical-tower", "tower", 112, 92)}
    <symbol id="fan" viewBox="-20 -20 40 40"><circle r="18" fill="#092131" stroke="#71e6ef" stroke-width="2"/><g class="fan-spin" fill="#9bf8ee"><path d="M0-3C4-17 13-13 12-7 11-1 5 2 0 3Z"/><path d="M3 0C17 4 13 13 7 12 1 11-2 5-3 0Z"/><path d="M0 3C-4 17-13 13-12 7-11 1-5-2 0-3Z"/><path d="M-3 0C-17-4-13-13-7-12-1-11 2-5 3 0Z"/></g><circle r="3" fill="#e7ffff"/></symbol>
    <linearGradient id="vessel" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#506a73"/><stop offset=".20" stop-color="#d9e7eb"/><stop offset=".48" stop-color="#829ba4"/><stop offset=".76" stop-color="#f0f6f7"/><stop offset="1" stop-color="#607781"/></linearGradient>
    <style>
      text{font-family:"PingFang SC","Microsoft YaHei",sans-serif;fill:#e8f3f5}.title{font-size:28px;font-weight:760}.subtitle{font-size:14px;fill:#94b7c0}.device-tag{font-size:15px;font-weight:720;fill:#a4f5bf}.device-id-chip rect{fill:#061b28;fill-opacity:.88;stroke:#4c8b96;stroke-width:1}.device-id-chip text{font-size:13px;font-weight:760;fill:#a4f5bf}.group-title{font-size:13px;font-weight:720;fill:#b5f4ca}.telemetry{font-size:13px;fill:#d9e8ec}.evidence{font-size:12px;fill:#8fb2bc}.load-label{font-size:15px;font-weight:750}.equipment{filter:url(#equipment-shadow)}.equipment-zone{fill:#081c2a;fill-opacity:.57;stroke:#3c7d8a;stroke-width:1.4}.asset-shadow{fill:#00121c;opacity:.65}.physical-image{filter:url(#equipment-shadow)}.pipe-base,.tower-branch{fill:none;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;opacity:.30}.tower-branch{stroke-width:5;opacity:.62}.flow{fill:none;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:10 17;animation:water 5.2s linear infinite;filter:url(#glow)}.cool-supply{stroke:#70e39b}.cool-return{stroke:#d6d77b}.chilled-supply{stroke:#66dff5}.chilled-return{stroke:#439ef4}.crossover-mask{fill:#0b2d43;stroke:#0b2d43;stroke-width:2}.crossover-bridge{fill:none;stroke-width:5;stroke-linecap:round;filter:url(#glow)}.fan-spin{transform-box:fill-box;transform-origin:center;animation:spin 9s linear infinite}.header-chip{fill:#0a2636;stroke:#3f7482}.manifold{fill:url(#vessel);stroke:#c6e0e6;stroke-width:2}.manifold-label{font-size:15px;font-weight:750}.footer-note{font-size:12px;fill:#91aab1}.status-off{fill:#526b73}.status-text{font-size:13px;fill:#adc2c7}.point-binding rect{fill:#061b28;fill-opacity:.91;stroke:#416b77;stroke-width:1}.point-binding text{font-size:12px;fill:#c7d9dd}.point-binding[data-point-state="UNBOUND"] rect{stroke-dasharray:3 3}.port-anchor{fill:#07151e;stroke:#f5fbfc;stroke-width:1.2}.system-anchor{fill:none;stroke:none}.load-card{fill:#0a2433;stroke:#4f8795;stroke-width:1.5}.load-node{filter:url(#equipment-shadow)}@keyframes water{to{stroke-dashoffset:-81}}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.flow,.fan-spin{animation-play-state:paused}}
    </style>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/><rect width="1920" height="1080" fill="url(#grid)"/>
  <rect x="24" y="24" width="1872" height="1032" rx="22" fill="none" stroke="#2d6574" stroke-width="2"/>
  <g id="header"><text x="62" y="68" class="title">冷站数字孪生 · 实物SCADA二维水力总览</text><text x="62" y="96" class="subtitle">透明正交设备渲染｜源模型端口锚定｜只读点位证据｜无品牌标识</text>
    <g transform="translate(1060 42)"><rect width="150" height="40" rx="9" class="header-chip"/><text x="75" y="26" text-anchor="middle">主机 7台</text><rect x="160" width="174" height="40" rx="9" class="header-chip"/><text x="247" y="26" text-anchor="middle">水泵 7+7台</text><rect x="344" width="252" height="40" rx="9" class="header-chip"/><text x="470" y="26" text-anchor="middle">塔 6组 / 33风机</text><rect x="606" width="130" height="40" rx="9" class="header-chip"/><text x="671" y="26" text-anchor="middle">UNBOUND</text></g>
  </g>
  <g id="background-headers">
    ${flowEdge({ id: "CWS_HEADER", start: coolingSupplyBottom, end: coolingSupplyTop, colorClass: "cool-supply", marker: "url(#arrow-green)", circuit: "cooling-supply-header" })}
    ${flowEdge({ id: "CWR_HEADER", start: coolingReturnTop, end: coolingReturnBottom, colorClass: "cool-return", marker: "url(#arrow-yellow)", circuit: "cooling-return-header" })}
    ${flowEdge({ id: "CHWS_HEADER", start: chilledSupplyBottom, end: chilledSupplyTop, colorClass: "chilled-supply", marker: "url(#arrow-cyan)", circuit: "chilled-supply-header" })}
    ${flowEdge({ id: "CHWR_HEADER", start: chilledReturnBottom, end: chilledReturnTop, colorClass: "chilled-return", marker: "url(#arrow-blue)", circuit: "chilled-return-header" })}
    <text x="595" y="126" text-anchor="end" class="group-title">冷却水干管</text>${coolingHeaderFlow}
    <text x="1338" y="126" text-anchor="end" class="group-title">冷冻水干管</text>${chilledHeaderFlow}
    ${coolingSupplyTop.markup}${coolingSupplyBottom.markup}${coolingReturnTop.markup}${coolingReturnBottom.markup}${chilledSupplyTop.markup}${chilledSupplyBottom.markup}${chilledReturnTop.markup}${chilledReturnBottom.markup}
  </g>
  <g id="tower-field" aria-label="六组横流冷却塔，风机数量依次为六、六、六、六、六、三，组内沿X轴排列">${Array.from({ length: TOWER_GROUP_COUNT }, (_, index) => towerGroup(index)).join("\n")}</g>
  <g id="plant-trains" aria-label="七套主机、冷却泵、冷冻泵列">${rowY.map((_, index) => plantRow(index)).join("\n")}</g>
  <g id="manifold-main-connections">
    ${flowEdge({ id: "CHWS_TO_DISTRIBUTOR_MAIN", start: chilledSupplyTop, end: distributorMain, points: [chilledSupplyTop, { x: 1360, y: 112 }, { x: 1471, y: 112 }, distributorMain], colorClass: "chilled-supply", marker: "url(#arrow-cyan)", circuit: "chilled-supply-main" })}
    ${flowEdge({ id: "COLLECTOR_MAIN_TO_CHWR", start: collectorMain, end: chilledReturnBottom, points: [collectorMain, { x: 1471, y: 1010 }, { x: 1405, y: 1010 }, chilledReturnBottom], colorClass: "chilled-return", marker: "url(#arrow-blue)", circuit: "chilled-return-main" })}
  </g>
  <g id="manifolds" aria-label="分水器与集水器在同一纵向轴线上分开放置" data-shared-center-x="1471">
    <rect x="1442" y="155" width="58" height="220" rx="29" class="manifold"/><text x="1471" y="145" text-anchor="middle" class="manifold-label">分水器</text>
    <rect x="1442" y="845" width="58" height="160" rx="29" class="manifold"/><text x="1471" y="835" text-anchor="middle" class="manifold-label">集水器</text>
    ${distributorMain.markup}${collectorMain.markup}
  </g>
  <g id="load-loops" aria-label="四个独立供回水闭环负荷">${Array.from({ length: LOAD_COUNT }, (_, index) => loadLoop(index)).join("\n")}</g>
  <g id="plc" transform="translate(1812 40)" aria-label="PLC只读状态"><rect width="68" height="58" rx="7" fill="#aab5b8" stroke="#e8f1f3"/><rect x="9" y="9" width="27" height="30" rx="2" fill="#243840"/><rect x="14" y="14" width="17" height="11" fill="#52b6ca"/><circle cx="46" cy="16" r="3" fill="#526b73"/><circle cx="46" cy="28" r="3" fill="#526b73"/><text x="34" y="51" text-anchor="middle" fill="#13242b" font-size="11">PLC-01</text></g>
  <g id="legend" transform="translate(70 1024)"><circle r="6" fill="#70e39b"/><text x="14" y="5" class="footer-note">冷却供水</text><circle cx="105" r="6" fill="#d6d77b"/><text x="119" y="5" class="footer-note">冷却回水</text><circle cx="210" r="6" fill="#66dff5"/><text x="224" y="5" class="footer-note">冷冻供水</text><circle cx="315" r="6" fill="#439ef4"/><text x="329" y="5" class="footer-note">冷冻回水</text><circle cx="430" r="6" class="status-off"/><text x="444" y="5" class="status-text">UNBOUND：无现场值/时效证据</text></g>
  <text x="1870" y="1042" text-anchor="end" class="footer-note">流向动画仅为工艺示意｜数值不造假｜不用于判断运行状态或向PLC下发控制</text>
</svg>\n`;

if (processPortAnchors.length !== EXPECTED_PROCESS_PORT_COUNT) {
  throw new Error(`expected ${EXPECTED_PROCESS_PORT_COUNT} Blender-backed process port anchors, found ${processPortAnchors.length}`);
}
if (new Set(processPortAnchors.map((anchor) => anchor.id)).size !== processPortAnchors.length) {
  throw new Error("duplicate process port anchor ids detected");
}
if (new Set(pointBindings.map((binding) => binding.id)).size !== pointBindings.length) {
  throw new Error("duplicate point binding ids detected");
}
if (pointBindings.length !== EXPECTED_POINT_BINDING_COUNT) {
  throw new Error(`expected ${EXPECTED_POINT_BINDING_COUNT} point bindings, found ${pointBindings.length}`);
}
if (flowEdges.length !== EXPECTED_FLOW_EDGE_COUNT) {
  throw new Error(`expected ${EXPECTED_FLOW_EDGE_COUNT} flow edges, found ${flowEdges.length}`);
}
if (declaredCrossovers.length !== EXPECTED_DECLARED_CROSSOVER_COUNT) {
  throw new Error(`expected ${EXPECTED_DECLARED_CROSSOVER_COUNT} declared non-connecting crossovers, found ${declaredCrossovers.length}`);
}

fs.writeFileSync(SVG_PATH, svg);
const generatedAt = new Date().toISOString();
const pointContract = {
  generatedAt,
  status: pointBindings.every((binding) => binding.readOnly && binding.state === "UNBOUND" && binding.value === null) ? "PASS" : "FAIL",
  contract: "read-only-evidence-v1",
  allowedStates: ["LIVE", "STALE", "FAULT", "UNBOUND"],
  stateSemantics: {
    LIVE: "finite value, healthy related source, and authoritative field timestamp within threshold",
    STALE: "value exists but authoritative field timestamp is absent or outside threshold",
    FAULT: "explicit equipment fault evidence only; source degradation is not a fault",
    UNBOUND: "no finite value or no authoritative point mapping"
  },
  controlBoundary: "presentation-only; no PLC writes, setpoints, or control commands",
  bindings: pointBindings
};
const portContract = {
  generatedAt,
  status:
    processPortAnchors.length === EXPECTED_PROCESS_PORT_COUNT &&
    flowEdges.length === EXPECTED_FLOW_EDGE_COUNT &&
    declaredCrossovers.length === EXPECTED_DECLARED_CROSSOVER_COUNT &&
    renderReport.status === "PASS" ? "PASS" : "FAIL",
  contract: "blender-port-anchor-v1",
  tolerancePx: 1,
  renderReport: relativeToWorkspace(RENDER_REPORT_PATH),
  renderReportSha256,
  counts: { processPorts: processPortAnchors.length, systemAnchors: systemAnchors.length, flowEdges: flowEdges.length, declaredCrossovers: declaredCrossovers.length },
  manifoldLayout: "stacked-same-x-separated",
  processPortAnchors,
  systemAnchors,
  flowEdges,
  declaredCrossovers
};
fs.writeFileSync(POINT_CONTRACT_PATH, `${JSON.stringify(pointContract, null, 2)}\n`);
fs.writeFileSync(PORT_CONTRACT_PATH, `${JSON.stringify(portContract, null, 2)}\n`);

await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(PNG_PATH);
const pngMetadata = await sharp(PNG_PATH).metadata();
const provenance = {
  generatedAt,
  status: pngMetadata.width === 1920 && pngMetadata.height === 1080 ? "PASS" : "FAIL",
  svg: relativeToWorkspace(SVG_PATH),
  svgSha256: sha256File(SVG_PATH),
  png: relativeToWorkspace(PNG_PATH),
  pngSha256: sha256File(PNG_PATH),
  width: pngMetadata.width,
  height: pngMetadata.height,
  renderer: "sharp/libvips"
};
fs.writeFileSync(PNG_PROVENANCE_PATH, `${JSON.stringify(provenance, null, 2)}\n`);

if (pointContract.status !== "PASS" || portContract.status !== "PASS" || provenance.status !== "PASS") {
  throw new Error(`2D physical SCADA contracts failed: points=${pointContract.status} ports=${portContract.status} preview=${provenance.status}`);
}

console.log("plant 2D physical SCADA layout generated");
console.log(`- svg: ${relativeToWorkspace(SVG_PATH)}`);
console.log(`- png: ${relativeToWorkspace(PNG_PATH)} ${pngMetadata.width}x${pngMetadata.height}`);
console.log(`- Blender-backed process ports: ${processPortAnchors.length}`);
console.log(`- closed load loops: 4`);
console.log(`- point bindings: ${pointBindings.length}, all UNBOUND/read-only`);

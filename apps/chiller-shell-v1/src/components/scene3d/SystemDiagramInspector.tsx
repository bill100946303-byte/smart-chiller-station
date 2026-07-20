import { Activity, ArrowRight } from "lucide-react";
import { zhCN } from "../../i18n/zhCN";
import type { SystemDiagramNode, SystemDiagramResolvedNode } from "./systemDiagramTypes";

type SystemDiagramInspectorProps = {
  selectedNode: SystemDiagramResolvedNode | null;
  devicePageHref?: string | null;
  operationalEvidence?: boolean;
};

export function getSystemDiagramStatusLabel(
  node: SystemDiagramResolvedNode | null,
  operationalEvidence: boolean
) {
  if (!operationalEvidence) {
    return zhCN.sceneControl.systemDiagramSampleStatus;
  }
  if (node?.status === "running") {
    return zhCN.topologyStatus.running;
  }
  if (node?.status === "alert") {
    return zhCN.topologyStatus.alert;
  }
  return zhCN.topologyStatus.stable;
}

export function getSystemDiagramTypeLabel(node: SystemDiagramNode | null) {
  if (!node) {
    return zhCN.common.unknown;
  }
  if (node.layoutRole === "chiller") {
    return zhCN.sceneControl.systemDiagramTypeChiller;
  }
  if (node.layoutRole === "chilled-pump") {
    return zhCN.sceneControl.systemDiagramTypeChilledPump;
  }
  if (node.layoutRole === "cooling-pump") {
    return zhCN.sceneControl.systemDiagramTypeCoolingPump;
  }
  if (node.layoutRole === "cooling-tower") {
    return zhCN.sceneControl.systemDiagramTypeCoolingTower;
  }
  if (node.layoutRole === "load") {
    return zhCN.sceneControl.systemDiagramTypeLoad;
  }
  if (node.layoutRole === "valve-chilled") {
    return zhCN.sceneControl.systemDiagramTypeChilledValve;
  }
  if (node.layoutRole === "valve-cooling") {
    return zhCN.sceneControl.systemDiagramTypeCoolingValve;
  }
  return node.systemType || zhCN.common.unknown;
}

const METRICS = [
  { key: "supply", label: () => zhCN.sceneControl.systemDiagramMetricSupplyTemp, unit: "°C" },
  { key: "return", label: () => zhCN.sceneControl.systemDiagramMetricReturnTemp, unit: "°C" },
  { key: "flow", label: () => zhCN.sceneControl.systemDiagramMetricFlow, unit: "m³/h" },
  { key: "power", label: () => zhCN.sceneControl.systemDiagramMetricPower, unit: "kW" }
];

export default function SystemDiagramInspector({
  selectedNode,
  devicePageHref = null,
  operationalEvidence = true
}: SystemDiagramInspectorProps) {
  const statusLabel = getSystemDiagramStatusLabel(selectedNode, operationalEvidence);
  const primaryDevice = operationalEvidence && selectedNode?.primaryDeviceId
    ? `${selectedNode.primaryDeviceLabel || zhCN.common.unknown} · ${selectedNode.primaryDeviceId}`
    : zhCN.sceneControl.systemDiagramSampleDevice;

  return (
    <>
      {selectedNode ? (
        <div className="scene-system-diagram-selection">
          <div className="scene-system-diagram-selection-header">
            <div>
              <span>{zhCN.sceneControl.systemDiagramSelectionEyebrow}</span>
              <strong>{selectedNode.label}</strong>
            </div>
            <em className={operationalEvidence ? "is-operational" : "is-sample"}>{statusLabel}</em>
          </div>
          <div className="scene-system-diagram-selection-grid">
            <div className="scene-system-diagram-selection-item">
              <label>{zhCN.sceneControl.systemDiagramSelectionSystemType}</label>
              <strong>{getSystemDiagramTypeLabel(selectedNode)}</strong>
            </div>
            <div className="scene-system-diagram-selection-item">
              <label>
                {operationalEvidence
                  ? zhCN.sceneControl.systemDiagramSelectionInstances
                  : zhCN.sceneControl.systemDiagramConfiguredInstances}
              </label>
              <strong>{selectedNode.instanceCount || 1} {zhCN.sceneControl.systemDiagramUnit}</strong>
            </div>
            <div className="scene-system-diagram-selection-item is-wide">
              <label>{zhCN.sceneControl.systemDiagramSelectionPrimaryDevice}</label>
              <strong>{primaryDevice}</strong>
            </div>
          </div>

          <div className="scene-system-diagram-data-evidence">
            <div className="scene-system-diagram-data-head">
              <span><Activity size={13} /> {zhCN.sceneControl.systemDiagramOperationalData}</span>
              <em>{zhCN.sceneControl.systemDiagramMetricUnavailable}</em>
            </div>
            <dl>
              {METRICS.map((metric) => (
                <div key={metric.key}>
                  <dt>{metric.label()}</dt>
                  <dd><strong>--</strong><small>{metric.unit}</small></dd>
                </div>
              ))}
            </dl>
            <small>{zhCN.sceneControl.systemDiagramDataContractMissing}</small>
          </div>

          {operationalEvidence && devicePageHref ? (
            <a className="scene-system-diagram-link" href={devicePageHref}>
              {zhCN.sceneControl.systemDiagramOpenDevicePage}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="scene-system-diagram-legend">
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#69e4ff" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendChilledSupply}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#38a9ff" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendChilledReturn}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#8ff7d7" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendCoolingSupply}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#ffc56d" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendCoolingReturn}</small>
        </div>
        <div className="scene-system-diagram-legend-item is-flow">
          <span><ArrowRight size={12} /></span>
          <small>{zhCN.sceneControl.systemDiagramFlowDirection}</small>
        </div>
        <div className="scene-system-diagram-legend-item is-status">
          <span className={operationalEvidence ? "is-live" : "is-sample"} />
          <small>{statusLabel}</small>
        </div>
      </div>

      <details className="scene-system-diagram-reading-note">
        <summary>{zhCN.sceneControl.systemDiagramReadingSummary}</summary>
        <ul>
          <li>
            {operationalEvidence
              ? zhCN.sceneControl.systemDiagramReadingCluster
              : zhCN.sceneControl.systemDiagramSampleDevice}
          </li>
          <li>
            {operationalEvidence
              ? zhCN.sceneControl.systemDiagramReadingPrimary
              : zhCN.sceneControl.systemDiagramDataContractMissing}
          </li>
          <li>{zhCN.sceneControl.systemDiagramReadingValve}</li>
        </ul>
      </details>
    </>
  );
}

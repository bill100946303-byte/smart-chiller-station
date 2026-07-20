import {
  Box,
  Boxes,
  ChevronDown,
  CircleAlert,
  Database,
  GitBranch,
  Map,
  Network,
  RefreshCw,
  ShieldCheck,
  Workflow
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SystemDiagram2D from "../components/scene3d/SystemDiagram2D";
import SystemDiagram3D from "../components/scene3d/SystemDiagram3D";
import { getSystemDiagramTypeLabel } from "../components/scene3d/SystemDiagramInspector";
import { SYSTEM_DIAGRAM_CONTRACT_SAMPLE } from "../components/scene3d/systemDiagramContractSample";
import {
  buildRuntimeSystemDiagram,
  buildSystemDiagramFromContract,
  MAIN_LOOP_SYSTEM_DIAGRAM
} from "../components/scene3d/systemDiagramMock";
import type {
  SystemDiagramResolvedNode,
  SystemDiagramTopology
} from "../components/scene3d/systemDiagramTypes";
import { runtimeConfig } from "../config/runtimeConfig";
import { useShellProjectDisplay } from "../context/ShellProjectDisplayContext";
import { getCurrentLocale, type LocaleCode, zhCN } from "../i18n/zhCN";
import {
  type SystemDiagramDto,
  fetchDeviceList,
  fetchSystemDiagram,
  fetchSystemTopology
} from "../services/bffClient";
import {
  getAuthSession,
  getCurrentProject,
  resolveAuthProjectDisplayName
} from "../services/auth";
import "../styles/auto-twin.css";
import "./AutoTwinMobileTouch.css";

type AutoTwinScope = "full" | "main_loop";
type AutoTwinSource = "contract" | "runtime" | "sample";
type AutoTwinView = "hydraulic" | "three-d";

type AutoTwinCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  scopeAria: string;
  scopeFull: string;
  scopeMain: string;
  viewAria: string;
  viewHydraulic: string;
  view3d: string;
  regenerate: string;
  generating: string;
  readOnly: string;
  readOnlyDetail: string;
  source: string;
  sourceContract: string;
  sourceRuntime: string;
  sourceSample: string;
  sourceContractDetail: string;
  sourceRuntimeDetail: string;
  sourceSampleDetail: string;
  nodes: string;
  edges: string;
  boundDevices: string;
  generatedAt: string;
  notLive: string;
  unverified: string;
  sampleWatermark: string;
  evidenceSummary: string;
  evidenceDetail: string;
  modelStage: string;
  relationStage: string;
  layoutStage: string;
  bindingStage: string;
  stageReady: string;
  stageFallback: string;
  sceneTitle: string;
  sceneContractDescription: string;
  sceneRuntimeDescription: string;
  sceneSampleDescription: string;
};

const AUTO_TWIN_COPY: Record<LocaleCode, AutoTwinCopy> = {
  "zh-CN": {
    eyebrow: "配置驱动数字孪生",
    title: "自动生成冷站系统图",
    subtitle: "设备模型、管网关系、运行状态和布局提示统一生成，不依赖外部固定画面。",
    scopeAria: "自动孪生生成范围",
    scopeFull: "全站系统",
    scopeMain: "主回路",
    viewAria: "系统图视图",
    viewHydraulic: "二维水力图",
    view3d: "三维场景",
    regenerate: "重新生成",
    generating: "生成中",
    readOnly: "只读模型预览",
    readOnlyDetail: "本页不下发 BA/PLC，不修改点表和控制参数。",
    source: "生成来源",
    sourceContract: "自动拓扑合同",
    sourceRuntime: "运行态骨架回退",
    sourceSample: "合同样例",
    sourceContractDetail: "已读取 system/diagram 自动布局合同。",
    sourceRuntimeDetail: "完整合同不可用，当前由 topology 与设备清单生成。",
    sourceSampleDetail: "数据服务未连接，当前样例仅验证生成和渲染能力，不作为运行依据。",
    nodes: "节点",
    edges: "管段",
    boundDevices: "设备绑定",
    generatedAt: "生成时间",
    notLive: "非实时样例",
    unverified: "未验证",
    sampleWatermark: "SAMPLE · 非实时",
    evidenceSummary: "生成依据",
    evidenceDetail: "设备模型、拓扑、布局与运行绑定状态",
    modelStage: "设备模型",
    relationStage: "拓扑关系",
    layoutStage: "自动布局",
    bindingStage: "运行绑定",
    stageReady: "已生成",
    stageFallback: "降级",
    sceneTitle: "冷站自动孪生系统图",
    sceneContractDescription: "由 system/diagram 合同生成，设备、管段和布局提示均来自项目配置。",
    sceneRuntimeDescription: "由运行态拓扑和设备清单生成，完整合同恢复后自动切换。",
    sceneSampleDescription: "当前使用合同样例验证 Three.js 自动布局与模型装配。"
  },
  "en-US": {
    eyebrow: "Configuration-driven digital twin",
    title: "Auto-generated chiller system",
    subtitle: "Device models, pipe relations, runtime status, and layout hints are generated without a fixed external scene.",
    scopeAria: "Auto-twin generation scope",
    scopeFull: "Full system",
    scopeMain: "Main loop",
    viewAria: "System diagram view",
    viewHydraulic: "2D hydraulic",
    view3d: "3D scene",
    regenerate: "Regenerate",
    generating: "Generating",
    readOnly: "Read-only model preview",
    readOnlyDetail: "This page does not dispatch BA/PLC commands or modify point mappings and control parameters.",
    source: "Generation source",
    sourceContract: "Auto-topology contract",
    sourceRuntime: "Runtime skeleton fallback",
    sourceSample: "Contract sample",
    sourceContractDetail: "Loaded the system/diagram auto-layout contract.",
    sourceRuntimeDetail: "The complete contract is unavailable; topology and the device list are generating this view.",
    sourceSampleDetail: "The data service is offline. This sample validates generation and rendering only and is not operational evidence.",
    nodes: "Nodes",
    edges: "Pipe segments",
    boundDevices: "Device bindings",
    generatedAt: "Generated",
    notLive: "Non-live sample",
    unverified: "Unverified",
    sampleWatermark: "SAMPLE · NON-LIVE",
    evidenceSummary: "Generation evidence",
    evidenceDetail: "Device models, topology, layout, and runtime binding status",
    modelStage: "Device models",
    relationStage: "Topology",
    layoutStage: "Auto layout",
    bindingStage: "Runtime binding",
    stageReady: "Generated",
    stageFallback: "Fallback",
    sceneTitle: "Auto-generated chiller digital twin",
    sceneContractDescription: "Generated from the system/diagram contract; devices, pipes, and layout hints come from project configuration.",
    sceneRuntimeDescription: "Generated from runtime topology and the device list; the complete contract takes over when restored.",
    sceneSampleDescription: "A contract sample is validating Three.js auto layout and model assembly."
  },
  "vi-VN": {
    eyebrow: "Digital twin theo cấu hình",
    title: "Tự động tạo hệ thống trạm lạnh",
    subtitle: "Mô hình thiết bị, quan hệ đường ống, trạng thái vận hành và gợi ý bố cục được tạo mà không phụ thuộc cảnh ngoài cố định.",
    scopeAria: "Phạm vi tạo auto-twin",
    scopeFull: "Toàn hệ thống",
    scopeMain: "Vòng chính",
    viewAria: "Chế độ xem sơ đồ",
    viewHydraulic: "Sơ đồ thủy lực 2D",
    view3d: "Cảnh 3D",
    regenerate: "Tạo lại",
    generating: "Đang tạo",
    readOnly: "Xem mô hình chỉ đọc",
    readOnlyDetail: "Trang này không phát lệnh BA/PLC và không sửa ánh xạ điểm hoặc tham số điều khiển.",
    source: "Nguồn tạo",
    sourceContract: "Hợp đồng topology tự động",
    sourceRuntime: "Dự phòng khung vận hành",
    sourceSample: "Mẫu hợp đồng",
    sourceContractDetail: "Đã đọc hợp đồng auto-layout system/diagram.",
    sourceRuntimeDetail: "Hợp đồng đầy đủ chưa khả dụng; topology và danh sách thiết bị đang tạo màn hình này.",
    sourceSampleDetail: "Dịch vụ dữ liệu chưa kết nối. Mẫu này chỉ xác thực khả năng tạo và hiển thị, không dùng làm bằng chứng vận hành.",
    nodes: "Nút",
    edges: "Đoạn ống",
    boundDevices: "Liên kết thiết bị",
    generatedAt: "Thời gian tạo",
    notLive: "Mẫu không realtime",
    unverified: "Chưa xác minh",
    sampleWatermark: "SAMPLE · KHÔNG REALTIME",
    evidenceSummary: "Bằng chứng tạo sơ đồ",
    evidenceDetail: "Mô hình thiết bị, topology, bố cục và liên kết vận hành",
    modelStage: "Mô hình thiết bị",
    relationStage: "Topology",
    layoutStage: "Bố cục tự động",
    bindingStage: "Liên kết vận hành",
    stageReady: "Đã tạo",
    stageFallback: "Dự phòng",
    sceneTitle: "Digital twin trạm lạnh tự động",
    sceneContractDescription: "Được tạo từ hợp đồng system/diagram; thiết bị, đường ống và gợi ý bố cục đến từ cấu hình dự án.",
    sceneRuntimeDescription: "Được tạo từ topology vận hành và danh sách thiết bị; hợp đồng đầy đủ sẽ thay thế khi khôi phục.",
    sceneSampleDescription: "Mẫu hợp đồng đang xác thực auto-layout Three.js và lắp ráp mô hình."
  }
};

function formatGeneratedAt(value: string | null | undefined, locale: LocaleCode): string {
  if (!value) {
    return "--";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(timestamp);
}

function localizeTopology(
  topology: SystemDiagramTopology,
  source: AutoTwinSource,
  copy: AutoTwinCopy
): SystemDiagramTopology {
  const description = source === "contract"
    ? copy.sceneContractDescription
    : source === "runtime"
      ? copy.sceneRuntimeDescription
      : copy.sceneSampleDescription;
  const localized = {
    ...topology,
    title: copy.sceneTitle,
    description
  };
  if (source !== "sample") {
    return localized;
  }

  return {
    ...localized,
    nodes: localized.nodes.map((node) => ({
      ...node,
      label: getSystemDiagramTypeLabel(node),
      systemType: getSystemDiagramTypeLabel(node),
      status: "standby",
      primaryDeviceLabel: null,
      primaryDeviceId: null,
      deviceIds: []
    }))
  };
}

function countBoundDevices(topology: SystemDiagramTopology): number {
  const deviceIds = new Set<string>();
  topology.nodes.forEach((node) => {
    (node.deviceIds || []).forEach((deviceId) => {
      if (deviceId) {
        deviceIds.add(deviceId);
      }
    });
    if (node.primaryDeviceId) {
      deviceIds.add(node.primaryDeviceId);
    }
  });
  return deviceIds.size;
}

function countPositionedNodes(diagram: SystemDiagramDto | null, topology: SystemDiagramTopology): number {
  if (diagram?.nodes?.length) {
    return diagram.nodes.filter(
      (node) =>
        typeof node.positionHint?.x === "number" &&
        typeof node.positionHint?.y === "number" &&
        typeof node.positionHint?.z === "number"
    ).length;
  }
  return topology.nodes.filter((node) => Boolean(node.position)).length;
}

export default function AutoTwinPage() {
  const locale = getCurrentLocale();
  const copy = AUTO_TWIN_COPY[locale];
  const session = getAuthSession();
  const currentProject = getCurrentProject(session);
  const shellProjectDisplayName = useShellProjectDisplay();
  const projectName = shellProjectDisplayName || resolveAuthProjectDisplayName(currentProject, zhCN.appShell.projectPending);
  const siteId = currentProject?.siteId || runtimeConfig.siteId;
  const [scope, setScope] = useState<AutoTwinScope>("full");
  const [view, setView] = useState<AutoTwinView>("hydraulic");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<AutoTwinSource>("sample");
  const [diagram, setDiagram] = useState<SystemDiagramDto | null>(null);
  const [topology, setTopology] = useState<SystemDiagramTopology>(() => {
    const sampleTopology = buildSystemDiagramFromContract(SYSTEM_DIAGRAM_CONTRACT_SAMPLE) || MAIN_LOOP_SYSTEM_DIAGRAM;
    return localizeTopology(sampleTopology, "sample", copy);
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAutoTwin() {
      setLoading(true);
      try {
        const nextDiagram = await fetchSystemDiagram(siteId, {
          layoutMode: "auto",
          scope
        });
        const contractTopology = buildSystemDiagramFromContract(nextDiagram);
        if (!contractTopology) {
          throw new Error("system_diagram_contract_empty");
        }
        if (!active) {
          return;
        }
        const localized = localizeTopology(contractTopology, "contract", copy);
        setDiagram(nextDiagram);
        setTopology(localized);
        setSource("contract");
        setSelectedNodeId((current) => localized.nodes.some((node) => node.id === current) ? current : localized.nodes[0]?.id || null);
        return;
      } catch {
        // The page degrades to runtime topology and then to the explicit contract sample.
      }

      const [topologyResult, deviceResult] = await Promise.allSettled([
        fetchSystemTopology(siteId),
        fetchDeviceList(siteId, { page: 1, pageSize: 200 })
      ]);
      if (!active) {
        return;
      }

      const runtimeTopologyDto = topologyResult.status === "fulfilled" ? topologyResult.value : null;
      const runtimeDevices = deviceResult.status === "fulfilled" ? deviceResult.value.items || [] : [];
      const hasRuntimeEvidence = Boolean(runtimeTopologyDto?.nodes?.length || runtimeDevices.length);

      if (hasRuntimeEvidence) {
        const runtimeTopology = localizeTopology(
          buildRuntimeSystemDiagram(runtimeTopologyDto, runtimeDevices),
          "runtime",
          copy
        );
        setDiagram(null);
        setTopology(runtimeTopology);
        setSource("runtime");
        setSelectedNodeId((current) => runtimeTopology.nodes.some((node) => node.id === current) ? current : runtimeTopology.nodes[0]?.id || null);
        setLoading(false);
        return;
      }

      const sampleTopology = localizeTopology(
        buildSystemDiagramFromContract(SYSTEM_DIAGRAM_CONTRACT_SAMPLE) || MAIN_LOOP_SYSTEM_DIAGRAM,
        "sample",
        copy
      );
      setDiagram(null);
      setTopology(sampleTopology);
      setSource("sample");
      setSelectedNodeId((current) => sampleTopology.nodes.some((node) => node.id === current) ? current : sampleTopology.nodes[0]?.id || null);
      setLoading(false);
    }

    void loadAutoTwin().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [copy, refreshVersion, scope, siteId]);

  const sourceLabel = source === "contract"
    ? copy.sourceContract
    : source === "runtime"
      ? copy.sourceRuntime
      : copy.sourceSample;
  const sourceDetail = source === "contract"
    ? copy.sourceContractDetail
    : source === "runtime"
      ? copy.sourceRuntimeDetail
      : copy.sourceSampleDetail;
  const sourceTimestamp = source === "sample"
    ? copy.notLive
    : formatGeneratedAt(diagram?.generatedAt, locale);
  const boundDeviceCount = useMemo(() => countBoundDevices(topology), [topology]);
  const positionedNodeCount = useMemo(() => countPositionedNodes(diagram, topology), [diagram, topology]);
  const selectedNode = topology.nodes.find((node) => node.id === selectedNodeId) || topology.nodes[0] || null;
  const devicePageHref = source !== "sample" && selectedNode?.primaryDeviceId
    ? `/devices?siteId=${encodeURIComponent(siteId)}&deviceId=${encodeURIComponent(selectedNode.primaryDeviceId)}`
    : null;
  const pipeline = [
    {
      key: "models",
      icon: <Boxes size={15} />,
      label: copy.modelStage,
      value: String(new Set(topology.nodes.map((node) => node.category)).size),
      ready: topology.nodes.length > 0
    },
    {
      key: "relations",
      icon: <GitBranch size={15} />,
      label: copy.relationStage,
      value: String(topology.edges.length),
      ready: topology.edges.length > 0
    },
    {
      key: "layout",
      icon: <Map size={15} />,
      label: copy.layoutStage,
      value: `${positionedNodeCount}/${topology.nodes.length}`,
      ready: positionedNodeCount > 0 || topology.nodes.length > 0
    },
    {
      key: "binding",
      icon: <Database size={15} />,
      label: copy.bindingStage,
      value: source === "sample" ? copy.unverified : String(boundDeviceCount),
      ready: boundDeviceCount > 0 && source !== "sample"
    }
  ];

  function handleNodeSelect(node: SystemDiagramResolvedNode) {
    setSelectedNodeId(node.id);
  }

  return (
    <div
      className="auto-twin-page"
      data-auto-twin-source={source}
      data-auto-twin-scope={scope}
      data-auto-twin-view={view}
    >
      <header className="auto-twin-header">
        <div className="auto-twin-heading">
          <span><Network size={15} /> {copy.eyebrow}</span>
          <h1>{projectName} · {copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="auto-twin-actions">
          <div className="auto-twin-segment auto-twin-view-segment" role="group" aria-label={copy.viewAria}>
            <button
              type="button"
              className={view === "hydraulic" ? "active" : ""}
              onClick={() => setView("hydraulic")}
              title={copy.viewHydraulic}
            >
              <Workflow size={14} />
              <span>{copy.viewHydraulic}</span>
            </button>
            <button
              type="button"
              className={view === "three-d" ? "active" : ""}
              onClick={() => setView("three-d")}
              title={copy.view3d}
            >
              <Box size={14} />
              <span>{copy.view3d}</span>
            </button>
          </div>
          <div className="auto-twin-segment" role="group" aria-label={copy.scopeAria}>
            <button
              type="button"
              className={scope === "full" ? "active" : ""}
              onClick={() => setScope("full")}
            >
              {copy.scopeFull}
            </button>
            <button
              type="button"
              className={scope === "main_loop" ? "active" : ""}
              onClick={() => setScope("main_loop")}
            >
              {copy.scopeMain}
            </button>
          </div>
          <button
            type="button"
            className="auto-twin-refresh"
            onClick={() => setRefreshVersion((current) => current + 1)}
            disabled={loading}
            title={copy.regenerate}
          >
            <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
            <span>{loading ? copy.generating : copy.regenerate}</span>
          </button>
        </div>
      </header>

      <div className={`auto-twin-sourcebar is-${source}`} role="status" aria-live="polite">
        <div className="auto-twin-source-main">
          {source === "sample" ? <CircleAlert size={17} /> : <Database size={17} />}
          <span>{copy.source}</span>
          <strong>{sourceLabel}</strong>
          <small>{sourceDetail}</small>
        </div>
        <dl className="auto-twin-source-stats">
          <div><dt>{copy.nodes}</dt><dd>{topology.nodes.length}</dd></div>
          <div><dt>{copy.edges}</dt><dd>{topology.edges.length}</dd></div>
          <div><dt>{copy.boundDevices}</dt><dd>{source === "sample" ? copy.unverified : boundDeviceCount}</dd></div>
          <div><dt>{copy.generatedAt}</dt><dd>{sourceTimestamp}</dd></div>
        </dl>
      </div>

      <div className="auto-twin-boundary">
        <ShieldCheck size={16} />
        <strong>{copy.readOnly}</strong>
        <span>{copy.readOnlyDetail}</span>
      </div>

      <details className="auto-twin-evidence-drawer">
        <summary>
          <span><Database size={14} /> {copy.evidenceSummary}</span>
          <small>{copy.evidenceDetail}</small>
          <ChevronDown size={15} />
        </summary>
        <div className="auto-twin-pipeline" aria-label={copy.eyebrow}>
          {pipeline.map((stage, index) => (
            <div key={stage.key} className={stage.ready ? "is-ready" : "is-fallback"}>
              <span>{stage.icon}</span>
              <small>{stage.label}</small>
              <strong>{stage.value}</strong>
              <em>{stage.ready ? copy.stageReady : copy.stageFallback}</em>
              {index < pipeline.length - 1 ? <i aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </details>

      <main className="auto-twin-stage">
        {source === "sample" ? (
          <div className="auto-twin-sample-watermark" aria-hidden="true">{copy.sampleWatermark}</div>
        ) : null}
        {view === "hydraulic" ? (
          <SystemDiagram2D
            topology={topology}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            devicePageHref={devicePageHref}
            operationalEvidence={source !== "sample"}
          />
        ) : (
          <SystemDiagram3D
            topology={topology}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            devicePageHref={devicePageHref}
            operationalEvidence={source !== "sample"}
          />
        )}
        {loading ? (
          <div className="auto-twin-loading" role="status">
            <RefreshCw size={18} className="is-spinning" />
            <span>{copy.generating}</span>
          </div>
        ) : null}
      </main>
    </div>
  );
}

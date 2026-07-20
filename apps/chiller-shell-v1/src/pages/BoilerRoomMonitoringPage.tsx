import { BellRing, ChevronRight, Droplets, Flame, Gauge, RefreshCw, Settings2, ShieldCheck, Thermometer, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./PowerMonitoringShared.css";
import "./EnergyStationWorkspace.css";
import "./BoilerRoomMonitoringPage.css";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentProject, resolveEnergyConfigSiteId } from "../services/auth";
import {
  fetchRuntimePointSummary,
  fetchSiteCapabilities,
  type RuntimePointSummaryDto,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto
} from "../services/bffClient";
import { appendSiteIdToPath } from "../services/siteRouting";
import { isAppliedStationRuntimeScope, useStationRuntimeScope } from "../context/StationRuntimeScopeContext";
import { getSubsystemStatusPresentation } from "../utils/subsystemStatus";
import { formatStationProcessState, resolveStationMetric } from "../utils/stationWorkspacePresentation";

type Tone = "good" | "warn" | "neutral";

const BOILER_REFRESH_MS = 20_000;

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  return getSubsystemStatusPresentation(item).detailLabel;
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  return getSubsystemStatusPresentation(item).tone;
}

function formatSourceStatus(value: string | undefined, loading: boolean): string {
  if (value === "ok") return "正常";
  if (value === "partial") return "部分可用";
  if (value === "failed") return "失败";
  return loading ? "加载中" : "未知";
}

function formatDataStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  return getSubsystemStatusPresentation(item).dataLabel;
}

function StatTile({
  title,
  value,
  unit,
  note,
  tone
}: {
  title: string;
  value: string;
  unit?: string;
  note: string;
  tone: Tone;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <p className="stat-title">{title}</p>
      <div className="stat-main">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <span className={`status-pill ${tone}`}>{note}</span>
    </div>
  );
}

function ProcessRow({
  label,
  enabled,
  note,
  state
}: {
  label: string;
  enabled: boolean;
  note: string;
  state: string;
}) {
  return (
    <article className="power-feeder-row">
      <div>
        <strong>{label}</strong>
        <span>{enabled ? note : "未配置，不参与统计"}</span>
      </div>
      <div className="power-feeder-track" aria-hidden="true">
        <i style={{ width: "0%" }} />
      </div>
      <em>{enabled ? state : "--"}</em>
    </article>
  );
}

export default function BoilerRoomMonitoringPage() {
  const currentProject = getCurrentProject();
  const siteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const stationRuntimeScope = useStationRuntimeScope();
  const runtimeStationId = stationRuntimeScope.stationType === "boiler_room"
    ? stationRuntimeScope.runtimeStationId
    : null;
  const runtimeSiteId = stationRuntimeScope.runtimeBindingSiteId || siteId;
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [runtimeErrorText, setRuntimeErrorText] = useState("");
  const [capabilities, setCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimePointSummaryDto | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorText("");
    setRuntimeErrorText("");
    const [capabilityResult, runtimeResult] = await Promise.allSettled([
      fetchSiteCapabilities(siteId),
      runtimeStationId
        ? fetchRuntimePointSummary(runtimeSiteId, { stationId: runtimeStationId })
        : Promise.resolve(null)
    ]);
    if (capabilityResult.status === "fulfilled") {
      setCapabilities(capabilityResult.value);
    } else {
      setCapabilities(null);
      setErrorText(capabilityResult.reason instanceof Error
        ? capabilityResult.reason.message
        : "锅炉房配置读取失败");
    }
    if (runtimeResult.status === "fulfilled") {
      const summary = runtimeResult.value;
      if (
        runtimeStationId
        && summary
        && !isAppliedStationRuntimeScope(summary.dataScope, stationRuntimeScope)
      ) {
        setRuntimeSummary(null);
        setRuntimeErrorText("站房数据范围证据校验失败，已阻止显示项目级数据");
      } else {
        setRuntimeSummary(summary);
      }
    } else {
      setRuntimeSummary(null);
      setRuntimeErrorText(runtimeResult.reason instanceof Error
        ? runtimeResult.reason.message
        : "锅炉房实例运行数据读取失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), BOILER_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, runtimeSiteId, stationRuntimeScope.scopeKey]);

  const boilerSubsystem = useMemo(
    () => capabilities?.items?.find((item) => item.subsystemType === "boiler_room") || null,
    [capabilities]
  );
  const statusPresentation = getSubsystemStatusPresentation(boilerSubsystem);
  const configEnabled = boilerSubsystem?.status === "enabled";
  const demoData = statusPresentation.kind === "demo";
  const realDataReady = statusPresentation.realDataReady;
  const requiredRoles = (boilerSubsystem?.requiredPointRoles || []).filter((item) => item.required !== false);
  const optionalRoles = (boilerSubsystem?.requiredPointRoles || []).filter((item) => item.required === false);
  const pointProgress = boilerSubsystem?.pointMappingProgress || 0;
  const roleSummary = configEnabled && requiredRoles.length ? `模板 ${pointProgress}% / ${requiredRoles.length}类` : "未配置";
  const requiredPackage = requiredRoles.length
    ? requiredRoles.map((item) => item.label).join(" / ")
    : "燃气量 / 产汽或供热量 / 压力 / 温度 / 运行状态 / 告警";
  const optionalPackage = optionalRoles.length
    ? optionalRoles.map((item) => item.label).join(" / ")
    : "烟气含氧量 / 排烟温度 / 给水温度 / 连排与补水";
  const physicalStations = (capabilities?.stationInstances || []).filter(
    (item) => item.parentSubsystemType === "boiler_room"
  );
  const publishedStations = physicalStations.filter((item) => item.published && item.enabled !== false);
  const stationProcess = runtimeSummary?.stationProcess;
  const boilerMetrics = stationProcess?.metrics?.boilerRoom;
  const runtimeScopeApplied = Boolean(
    runtimeStationId
    && runtimeSummary
    && isAppliedStationRuntimeScope(runtimeSummary.dataScope, stationRuntimeScope)
  );
  const stationRegistrationLabel = loading
    ? "同步中"
    : runtimeStationId && runtimeScopeApplied
      ? `绑定 v${stationProcess?.station?.bindingVersion ?? stationRuntimeScope.bindingVersion ?? "-"} 已应用`
      : errorText
      ? "不可用"
      : physicalStations.length
        ? `${publishedStations.length}/${physicalStations.length} 已发布`
        : "类型级 / 未登记站房";
  const stationScopeLabel = runtimeStationId
    ? stationRuntimeScope.stationName || runtimeStationId
    : physicalStations.length
      ? `${physicalStations.length} 个实体站房`
      : "锅炉房类型级";
  const pointState = runtimeStationId
    ? runtimeErrorText
      ? "读取失败"
      : stationProcess?.readiness === "ready"
        ? `${stationProcess.operatingState?.runningPointCount ?? 0} 个运行信号有效`
        : stationProcess?.readiness === "partial"
          ? "点位证据不完整"
          : "等待站房点位"
    : formatStationProcessState(statusPresentation);
  const runtimeMetric = (
    value: number | null | undefined,
    unit: string,
    demoValue: string,
    waitingNote: string,
    liveNote: string
  ) => {
    if (!runtimeStationId) {
      return resolveStationMetric({
        status: statusPresentation,
        loading,
        errorText,
        demoValue,
        demoUnit: unit,
        waitingNote,
        liveNote
      });
    }
    if (loading) {
      return { value: "--", unit, note: "读取站房绑定数据", tone: "neutral" as const };
    }
    if (runtimeErrorText || !runtimeScopeApplied) {
      return { value: "--", unit, note: "未通过站房范围校验", tone: "warn" as const };
    }
    if (value == null) {
      return { value: "--", unit, note: "站房点位未映射", tone: "warn" as const };
    }
    return {
      value: String(value),
      unit,
      note: stationProcess?.timestampStatus === "authoritative"
        ? "站房实时点位"
        : "站房点位已隔离 · 时间戳待证",
      tone: stationProcess?.timestampStatus === "authoritative" ? "good" as const : "warn" as const
    };
  };
  const powerMetric = runtimeMetric(boilerMetrics?.powerKw, "kW", "42", "等待锅炉房电表", "实时能力已接入，指标接口待接");
  const pressureMetric = runtimeMetric(boilerMetrics?.pressureMpa, "MPa", "0.82", "等待压力变送器", "实时能力已接入，指标接口待接");
  const flowMetric = runtimeMetric(boilerMetrics?.thermalMediumFlow, boilerMetrics?.thermalMediumFlowUnit || "m3/h", "35.6", "等待热媒流量计", "实时能力已接入，指标接口待接");
  const temperatureMetric = runtimeMetric(boilerMetrics?.temperatureC, "°C", "82.5", "等待温度测点", "实时能力已接入，指标接口待接");
  const hasRuntimeRole = (role: string) => Boolean(
    stationProcess?.roleMeasurements?.some((item) => item.role === role && item.matched)
  );
  const boilerUnitState = runtimeStationId
    ? hasRuntimeRole("status") ? "运行信号已读" : "运行点位未映射"
    : pointState;
  const combustionState = runtimeStationId ? "燃气 / 燃烧点位未映射" : pointState;
  const waterSystemState = runtimeStationId
    ? hasRuntimeRole("temperature") ? "温度已读，水位 / 泵状态未映射" : "给水点位未映射"
    : pointState;
  const headerState = runtimeStationId
    ? hasRuntimeRole("pressure") && hasRuntimeRole("flow") && hasRuntimeRole("temperature")
      ? "压力 / 流量 / 温度已读"
      : "母管点位不完整"
    : pointState;
  const processRows = [
    { label: "锅炉机组", note: "启停状态 / 负荷率 / 故障", state: boilerUnitState },
    { label: "燃烧与燃气", note: "燃气流量 / 阀组状态 / 空燃比", state: combustionState },
    { label: "给水与循环", note: "给水温度 / 水位 / 循环泵", state: waterSystemState },
    { label: "蒸汽或热水母管", note: "压力 / 温度 / 流量 / 供回温", state: headerState }
  ];

  return (
    <div
      className="power-monitor-page energy-station-workspace boiler-room-page"
      data-energy-station-workspace
      data-boiler-room-workspace
      data-subsystem-type="boiler_room"
      data-subsystem-status={statusPresentation.kind}
      data-station-scope={runtimeScopeApplied ? "station_binding" : physicalStations.length ? "station_instances" : "subsystem_type"}
      data-station-runtime-applied={runtimeScopeApplied ? "true" : "false"}
    >
      <section className="section-card power-monitor-hero boiler-room-hero">
        <header className="section-card-header">
          <div>
            <h1 className="station-workspace-title">{runtimeStationId ? stationScopeLabel : "锅炉房监控"}</h1>
            <p className="power-monitor-subtitle">电功率、系统压力、热媒流量、热媒温度与运行状态。蒸汽或热水类型、温度测点位置以站房配置为准；热效率和单位燃耗仅在测量及计算合同具备后显示。</p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${statusTone(boilerSubsystem)}`}>{formatStatus(boilerSubsystem)}</span>
            <span className="status-pill neutral">只读建议</span>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {errorText ? <div className="source-banner warn">{errorText}</div> : null}
          {runtimeErrorText ? (
            <div className="source-banner warn">{runtimeErrorText}。系统未回退到项目级数据。</div>
          ) : null}
          {runtimeScopeApplied ? (
            <div className={`source-banner${stationProcess?.timestampStatus === "authoritative" ? "" : " warn"}`}>
              已按 {stationScopeLabel} 发布绑定筛选 {stationProcess?.coverage?.selectedDeviceCount ?? 0} 台设备、
              {stationProcess?.coverage?.selectedPointCount ?? 0} 个点位；
              {stationProcess?.timestampStatus === "authoritative"
                ? "源时间戳可验证。"
                : "当前仅证明站房隔离与点位可读，尚不能标记为 LIVE。"}
            </div>
          ) : null}
          {statusPresentation.kind === "waiting" && !runtimeStationId ? (
            <div className="source-banner warn">当前仅发布锅炉房只读点位角色模板，等待现场 PLC / 网关点位绑定；系统不会下发燃烧器或阀门指令。</div>
          ) : null}
          {demoData && !runtimeStationId ? (
            <div className="source-banner">当前为锅炉房演示数据，仅用于方案展示与界面验收，不代表真实 PLC / 网关实时接入。</div>
          ) : null}
          <div className="power-monitor-summary">
            <div><span>配置中心链路</span><strong>{formatSourceStatus(capabilities?.sourceStatus?.overall, loading)}</strong></div>
            <div><span>点位角色模板</span><strong>{roleSummary}</strong></div>
            <div><span>实时数据</span><strong>{runtimeStationId
              ? runtimeScopeApplied
                ? stationProcess?.timestampStatus === "authoritative"
                  ? "站房实时点位"
                  : "站房点位可读 / 时间戳待证"
                : "站房范围未通过"
              : formatDataStatus(boilerSubsystem)}</strong></div>
            <div><span>控制边界</span><strong>不写 PLC</strong></div>
            <div><span>人工确认</span><strong>优化建议必审</strong></div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title="锅炉房电功率" {...powerMetric} />
        <StatTile title="系统压力" {...pressureMetric} />
        <StatTile title="热媒流量" {...flowMetric} />
        <StatTile title="热媒温度" {...temperatureMetric} />
      </div>

      <div className="power-monitor-layout">
        <section className="section-card station-process-card boiler-process-card">
          <header className="section-card-header">
            <h2>锅炉工艺链路</h2>
            <span className="status-pill neutral">只读监视</span>
          </header>
          <div className="section-card-body">
            <div className="station-process-canvas">
              <div className={`power-single-line boiler-single-line${configEnabled ? " is-enabled" : ""}`}>
                <div className="power-node power-node-source boiler-source-node">
                  <Flame size={20} />
                  <strong>锅炉房</strong>
                  <span>{runtimeStationId ? boilerUnitState : demoData ? "演示数据" : realDataReady ? "实时已接入" : configEnabled ? "实时待接入" : "未配置"}</span>
                </div>
                <div className="power-bus" aria-hidden="true" />
                <div className="power-node-grid">
                  <div className="power-node"><Flame size={18} /><strong>燃烧系统</strong><span>{combustionState}</span></div>
                  <div className="power-node"><Droplets size={18} /><strong>给水系统</strong><span>{waterSystemState}</span></div>
                  <div className="power-node"><Gauge size={18} /><strong>压力母管</strong><span>{headerState}</span></div>
                  <div className="power-node"><Thermometer size={18} /><strong>热媒温度</strong><span>{runtimeStationId ? hasRuntimeRole("temperature") ? "温度点位已读" : "温度点位未映射" : pointState}</span></div>
                </div>
              </div>
              <div className="station-process-evidence" aria-label="锅炉房全链路边界">
                <div><span>数据采集</span><strong>功率 / 压力 / 流量 / 温度 / 状态</strong></div>
                <div><span>优化目标</span><strong>热效率 / 燃耗（合同建立后）</strong></div>
                <div><span>执行方式</span><strong>目标值建议 / 人工确认</strong></div>
                <div><span>安全回退</span><strong>PLC 联锁与原控制</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card station-device-card">
          <header className="section-card-header">
            <h2>设备与运行状态</h2>
            <span className="status-pill neutral">人工复核</span>
          </header>
          <div className="section-card-body">
            <div className="power-feeder-list">
              {processRows.map((item) => <ProcessRow key={item.label} enabled={configEnabled} {...item} />)}
            </div>
          </div>
        </section>

        <section className="section-card station-boundary-card">
          <header className="section-card-header">
            <h2>接入与控制边界</h2>
            <span className="status-pill neutral">站房关联</span>
          </header>
          <div className="section-card-body">
            <div className="station-readiness-list">
              <div className="station-readiness-row"><span>当前数据范围</span><strong>{stationScopeLabel}</strong></div>
              <div className="station-readiness-row"><span>实体站房登记</span><strong>{stationRegistrationLabel}</strong></div>
              <div className="station-readiness-row"><span>点位映射</span><strong>{roleSummary}</strong></div>
              <div className="station-readiness-row"><span>数据判读</span><strong>{statusPresentation.dataLabel}</strong></div>
            </div>
            <div className="source-banner station-boundary-note"><ShieldCheck size={14} /> PLC 保留低水位、超压、熄火、燃气泄漏及联锁保护；AI 只输出目标值建议。</div>
            <div className="source-banner station-boundary-note"><Waves size={14} /> 必需点位：{requiredPackage}。可选增强：{optionalPackage}。</div>
            <div className="station-workspace-actions">
              <Link to={appendSiteIdToPath("/config-center", siteId)}><span><Settings2 size={14} /> 能源配置</span><ChevronRight size={14} /></Link>
              <Link to={appendSiteIdToPath("/alarms", siteId)}><span><BellRing size={14} /> 项目级告警</span><ChevronRight size={14} /></Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

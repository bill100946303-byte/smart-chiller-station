import { BellRing, ChevronRight, Cylinder, Gauge, RefreshCw, Settings2, ShieldCheck, Wind, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./PowerMonitoringShared.css";
import "./EnergyStationWorkspace.css";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  getCurrentProject,
  resolveAuthProjectDisplayName,
  resolveEnergyConfigSiteId
} from "../services/auth";
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
import {
  formatControlBoundaryMode,
  formatStationProcessState,
  resolveStationMetric
} from "../utils/stationWorkspacePresentation";

type Tone = "good" | "warn" | "neutral";

const AIR_REFRESH_MS = 20_000;

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  return getSubsystemStatusPresentation(item).detailLabel;
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  return getSubsystemStatusPresentation(item).tone;
}

function formatSourceStatus(value: string | undefined, loading: boolean): string {
  if (value === "ok") {
    return "正常";
  }
  if (value === "partial") {
    return "部分可用";
  }
  if (value === "failed") {
    return "失败";
  }
  return loading ? "加载中" : "未知";
}

function formatAirDataStatus(item: RuntimeSubsystemCapabilityDto | null): string {
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

export default function CompressedAirMonitoringPage() {
  const currentProject = getCurrentProject();
  const siteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const projectLabel = resolveAuthProjectDisplayName(currentProject, "当前项目");
  const stationRuntimeScope = useStationRuntimeScope();
  const runtimeStationId = stationRuntimeScope.stationType === "compressed_air"
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
        : "空压站配置读取失败");
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
        : "空压站实例运行数据读取失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, AIR_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, runtimeSiteId, stationRuntimeScope.scopeKey]);

  const airSubsystem: RuntimeSubsystemCapabilityDto | null = useMemo(() => {
    return capabilities?.items?.find((item) => item.subsystemType === "compressed_air") || null;
  }, [capabilities]);

  const statusPresentation = getSubsystemStatusPresentation(airSubsystem);
  const configEnabled = airSubsystem?.status === "enabled";
  const demoData = statusPresentation.kind === "demo";
  const realDataReady = statusPresentation.realDataReady;
  const boundaryMode = airSubsystem?.controlBoundary?.mode || "read_only";
  const requiredRoles = (airSubsystem?.requiredPointRoles || []).filter((item) => item.required !== false);
  const optionalRoles = (airSubsystem?.requiredPointRoles || []).filter((item) => item.required === false);
  const pointProgress = airSubsystem?.pointMappingProgress || 0;
  const roleSummary = configEnabled && requiredRoles.length ? `模板 ${pointProgress}% / ${requiredRoles.length}类` : "未配置";
  const accessPackageLabel = requiredRoles.length
    ? requiredRoles.map((item) => item.label).join(" / ")
    : "空压功率 / 管网压力 / 供气流量 / 运行状态 / 告警";
  const optionalPackageLabel = optionalRoles.length
    ? optionalRoles.map((item) => item.label).join(" / ")
    : "干燥机露点 / 单耗与泄漏诊断";
  const physicalStations = (capabilities?.stationInstances || []).filter(
    (item) => item.parentSubsystemType === "compressed_air"
  );
  const publishedStations = physicalStations.filter((item) => item.published && item.enabled !== false);
  const stationProcess = runtimeSummary?.stationProcess;
  const compressedAirMetrics = stationProcess?.metrics?.compressedAir;
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
      : "空压站类型级";
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
  const powerMetric = runtimeMetric(compressedAirMetrics?.powerKw, "kW", "286", "等待电表实时量", "实时能力已接入，指标接口待接");
  const pressureMetric = runtimeMetric(compressedAirMetrics?.pressureBar, "bar", "6.8", "等待压力变送器", "实时能力已接入，指标接口待接");
  const flowMetric = runtimeMetric(compressedAirMetrics?.flowNm3Min, "Nm3/min", "49.2", "等待流量计", "实时能力已接入，指标接口待接");
  const specificPowerMetric = runtimeMetric(compressedAirMetrics?.specificEnergyKwhNm3, "kWh/Nm3", "0.096", "等待功率与流量同步", "实时能力已接入，指标接口待接");
  const hasRuntimeRole = (role: string) => Boolean(
    stationProcess?.roleMeasurements?.some((item) => item.role === role && item.matched)
  );
  const compressorState = runtimeStationId
    ? hasRuntimeRole("status") ? "运行信号已读" : "运行点位未映射"
    : pointState;
  const postTreatmentState = runtimeStationId
    ? hasRuntimeRole("temperature") ? "露点信号已读" : "露点点位未映射"
    : pointState;
  const storageTankState = runtimeStationId ? "储气罐点位未映射" : pointState;
  const networkState = runtimeStationId
    ? hasRuntimeRole("pressure") && hasRuntimeRole("flow")
      ? "压力 / 流量已读"
      : "管网点位不完整"
    : pointState;
  const processRows = [
    { label: "空压机组", note: "台数 / 加卸载 / 运行状态", state: compressorState },
    { label: "后处理", note: "干燥机 / 过滤器 / 露点", state: postTreatmentState },
    { label: "储气罐", note: "压力缓冲 / 波动诊断", state: storageTankState },
    { label: "管网", note: "压力 / 流量 / 泄漏风险", state: networkState }
  ];

  return (
    <div
      className="power-monitor-page energy-station-workspace compressed-air-page"
      data-energy-station-workspace
      data-subsystem-type="compressed_air"
      data-subsystem-status={statusPresentation.kind}
      data-station-scope={runtimeScopeApplied ? "station_binding" : physicalStations.length ? "station_instances" : "subsystem_type"}
      data-station-runtime-applied={runtimeScopeApplied ? "true" : "false"}
    >
      <section className="section-card power-monitor-hero">
        <header className="section-card-header">
          <div>
            <h1 className="station-workspace-title">{runtimeStationId ? stationScopeLabel : "空压站监控"}</h1>
            <p className="power-monitor-subtitle">空压功率、管网压力、供气流量、单耗、后处理与泄漏风险。未接入实时数据不显示假 KPI。</p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${statusTone(airSubsystem)}`}>{formatStatus(airSubsystem)}</span>
            <span className="status-pill neutral">{formatControlBoundaryMode(boundaryMode)}</span>
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
            <div className="source-banner warn">
              当前未接入真实空压实时数据；已发布的是只读点位角色模板，等待现场 PLC / 网关点位绑定。
            </div>
          ) : null}
          {demoData && !runtimeStationId ? (
            <div className="source-banner">
              {projectLabel}为空压演示数据；仅用于甲方演示和界面验收，不代表真实 PLC / 网关实时接入。
            </div>
          ) : null}
          <div className="power-monitor-summary">
            <div>
              <span>配置中心链路</span>
              <strong>{formatSourceStatus(capabilities?.sourceStatus?.overall, loading)}</strong>
            </div>
            <div>
              <span>点位角色模板</span>
              <strong>{roleSummary}</strong>
            </div>
            <div>
              <span>实时数据</span>
              <strong>{runtimeStationId
                ? runtimeScopeApplied
                  ? stationProcess?.timestampStatus === "authoritative"
                    ? "站房实时点位"
                    : "站房点位可读 / 时间戳待证"
                  : "站房范围未通过"
                : formatAirDataStatus(airSubsystem)}</strong>
            </div>
            <div>
              <span>站房登记</span>
              <strong>{stationRegistrationLabel}</strong>
            </div>
            <div>
              <span>控制边界</span>
              <strong>不写 PLC</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title="空压站功率" {...powerMetric} />
        <StatTile title="管网压力" {...pressureMetric} />
        <StatTile title="供气流量" {...flowMetric} />
        <StatTile title="单位气耗" {...specificPowerMetric} />
      </div>

      <div className="power-monitor-layout">
        <section className="section-card station-process-card">
          <header className="section-card-header">
            <h2>空压工艺链路</h2>
            <span className="status-pill neutral">只读</span>
          </header>
          <div className="section-card-body">
            <div className="station-process-canvas">
              <div className={`power-single-line${configEnabled ? " is-enabled" : ""}`}>
                <div className="power-node power-node-source">
                  <Wind size={20} />
                  <strong>空压机房</strong>
                  <span>{runtimeStationId ? pointState : demoData ? "演示数据" : realDataReady ? "实时已接入" : configEnabled ? "实时待接入" : "未配置"}</span>
                </div>
                <div className="power-bus" aria-hidden="true" />
                <div className="power-node-grid">
                  <div className="power-node">
                    <Zap size={18} />
                    <strong>空压机组</strong>
                  <span>{runtimeStationId ? compressorState : demoData ? "演示运行" : realDataReady ? "运行状态已回传" : configEnabled ? "运行状态待接入" : "未配置"}</span>
                  </div>
                  <div className="power-node">
                    <Gauge size={18} />
                    <strong>管网压力</strong>
                    <span>{runtimeStationId ? networkState : demoData ? "演示压力" : realDataReady ? "压力已回传" : configEnabled ? "压力待接入" : "未配置"}</span>
                  </div>
                  <div className="power-node">
                    <Cylinder size={18} />
                    <strong>储气罐</strong>
                    <span>{runtimeStationId ? storageTankState : demoData ? "演示缓冲" : realDataReady ? "缓冲状态已回传" : configEnabled ? "缓冲状态待接入" : "可扩展"}</span>
                  </div>
                  <div className="power-node">
                    <ShieldCheck size={18} />
                    <strong>控制边界</strong>
                    <span>{configEnabled ? "不写 PLC" : "未参与"}</span>
                  </div>
                </div>
              </div>
              <div className="station-process-evidence" aria-label="空压站全链路边界">
                <div><span>数据采集</span><strong>功率 / 压力 / 流量 / 运行</strong></div>
                <div><span>优化目标</span><strong>单耗 / 压力 / 泄漏风险</strong></div>
                <div><span>执行方式</span><strong>影子建议 / 人工确认</strong></div>
                <div><span>安全回退</span><strong>PLC 原控制逻辑</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card station-device-card">
          <header className="section-card-header">
            <h2>设备与诊断</h2>
            <span className="status-pill neutral">无假数据</span>
          </header>
          <div className="section-card-body">
            <div className="power-feeder-list">
              {processRows.map((item) => (
                <ProcessRow key={item.label} enabled={configEnabled} label={item.label} note={item.note} state={item.state} />
              ))}
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
            <div className="source-banner station-boundary-note"><ShieldCheck size={14} /> 第一版只做只读诊断和影子建议；不调台数、不下发加载卸载命令。</div>
            <div className="source-banner station-boundary-note"><Gauge size={14} /> 必需点位：{accessPackageLabel}。可选增强：{optionalPackageLabel}。</div>
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

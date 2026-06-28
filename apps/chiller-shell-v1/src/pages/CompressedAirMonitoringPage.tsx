import { Cylinder, Gauge, RefreshCw, ShieldCheck, Wind, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentProject, resolveEnergyConfigSiteId } from "../services/auth";
import {
  fetchSiteCapabilities,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto
} from "../services/bffClient";

type Tone = "good" | "warn" | "neutral";

const AIR_REFRESH_MS = 20_000;

function waitingForRealData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return item?.status === "enabled" && item.sourceStatus === "waiting_points";
}

function isDemoData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return item?.status === "enabled" && item.sourceStatus === "demo_data";
}

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  if (isDemoData(item)) {
    return "演示数据 / 只读";
  }
  if (waitingForRealData(item)) {
    return "配置已发布 / 待接实时";
  }
  if (item?.status === "enabled") {
    return "已接入实时";
  }
  if (item?.status === "not_configured") {
    return "未配置 / 可接入";
  }
  if (item?.status === "not_applicable") {
    return "不适用";
  }
  return item?.status || "未知";
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  if (isDemoData(item)) {
    return "neutral";
  }
  if (waitingForRealData(item)) {
    return "warn";
  }
  if (item?.status === "enabled") {
    return "good";
  }
  if (item?.status === "not_configured") {
    return "warn";
  }
  return "neutral";
}

function metricValue(configEnabled: boolean, realDataReady: boolean, demoData: boolean, demoValue: string): string {
  if (!configEnabled) {
    return "未配置";
  }
  if (demoData) {
    return demoValue;
  }
  return realDataReady ? "待刷新" : "待接入";
}

function formatBoundaryMode(value: string): string {
  if (value === "shadow") {
    return "影子建议";
  }
  if (value === "assisted") {
    return "人工确认";
  }
  if (value === "enforced") {
    return "闭环预留";
  }
  return "只读";
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
  if (isDemoData(item)) {
    return "演示数据";
  }
  if (waitingForRealData(item)) {
    return "待接现场点";
  }
  if (item?.sourceStatus === "ok") {
    return "实时正常";
  }
  if (item?.status === "enabled") {
    return item.sourceStatus || "待核对";
  }
  return "不参与";
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
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [capabilities, setCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorText("");
    try {
      const data = await fetchSiteCapabilities(siteId);
      setCapabilities(data);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "空压站配置读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, AIR_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const airSubsystem: RuntimeSubsystemCapabilityDto | null = useMemo(() => {
    return capabilities?.items?.find((item) => item.subsystemType === "compressed_air") || null;
  }, [capabilities]);

  const configEnabled = airSubsystem?.status === "enabled";
  const demoData = isDemoData(airSubsystem);
  const realDataReady = configEnabled && !waitingForRealData(airSubsystem) && !demoData;
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
  const processRows = [
    { label: "空压机组", note: "台数 / 加卸载 / 运行状态", state: "待现场点" },
    { label: "后处理", note: "干燥机 / 过滤器 / 露点", state: "待点位" },
    { label: "储气罐", note: "压力缓冲 / 波动诊断", state: "待点位" },
    { label: "管网", note: "压力 / 流量 / 泄漏风险", state: "待现场点" }
  ];

  return (
    <div className="power-monitor-page">
      <section className="section-card power-monitor-hero">
        <header className="section-card-header">
          <div>
            <h3>空压站监控</h3>
            <p className="power-monitor-subtitle">空压功率、管网压力、供气流量、单耗、后处理与泄漏风险。未接入实时数据不显示假 KPI。</p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${statusTone(airSubsystem)}`}>{formatStatus(airSubsystem)}</span>
            <span className="status-pill neutral">{formatBoundaryMode(boundaryMode)}</span>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {errorText ? <div className="source-banner warn">{errorText}</div> : null}
          {waitingForRealData(airSubsystem) ? (
            <div className="source-banner warn">
              当前未接入真实空压实时数据；已发布的是只读点位角色模板，等待现场 PLC / 网关点位绑定。
            </div>
          ) : null}
          {demoData ? (
            <div className="source-banner">
              盛世绿能办公楼为空压演示数据；仅用于甲方演示和界面验收，不代表真实 PLC / 网关实时接入。
            </div>
          ) : null}
          <div className="power-monitor-summary">
            <div>
              <span>配置状态</span>
              <strong>{formatSourceStatus(capabilities?.sourceStatus?.overall, loading)}</strong>
            </div>
            <div>
              <span>点位角色模板</span>
              <strong>{roleSummary}</strong>
            </div>
            <div>
              <span>实时数据</span>
              <strong>{formatAirDataStatus(airSubsystem)}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title="空压站功率" value={metricValue(configEnabled, realDataReady, demoData, "286")} unit={realDataReady || demoData ? "kW" : undefined} note={demoData ? "演示数据" : configEnabled ? "等待电表实时量" : "未接入"} tone={demoData ? "neutral" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="管网压力" value={metricValue(configEnabled, realDataReady, demoData, "0.68")} unit={realDataReady || demoData ? "bar" : undefined} note={demoData ? "演示数据" : configEnabled ? "等待压力变送器" : "未接入"} tone={demoData ? "neutral" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="供气流量" value={metricValue(configEnabled, realDataReady, demoData, "49.2")} unit={realDataReady || demoData ? "Nm3/min" : undefined} note={demoData ? "演示数据" : configEnabled ? "等待流量计" : "未接入"} tone={demoData ? "neutral" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="单位气耗" value={metricValue(configEnabled, realDataReady, demoData, "0.096")} unit={realDataReady || demoData ? "kWh/Nm3" : undefined} note={demoData ? "演示数据" : configEnabled ? "等待功率与流量同步" : "未接入"} tone={demoData ? "neutral" : configEnabled ? "warn" : "neutral"} />
      </div>

      <div className="power-monitor-layout">
        <section className="section-card">
          <header className="section-card-header">
            <h3>空压工艺链路</h3>
            <span className="status-pill neutral">只读</span>
          </header>
          <div className="section-card-body">
            <div className={`power-single-line${configEnabled ? " is-enabled" : ""}`}>
              <div className="power-node power-node-source">
                <Wind size={20} />
                <strong>空压机房</strong>
                <span>{demoData ? "演示数据" : realDataReady ? "实时已接入" : configEnabled ? "实时待接入" : "未配置"}</span>
              </div>
              <div className="power-bus" aria-hidden="true" />
              <div className="power-node-grid">
                <div className="power-node">
                  <Zap size={18} />
                  <strong>空压机组</strong>
                  <span>{demoData ? "演示运行" : realDataReady ? "运行状态已回传" : configEnabled ? "运行状态待接入" : "未配置"}</span>
                </div>
                <div className="power-node">
                  <Gauge size={18} />
                  <strong>管网压力</strong>
                  <span>{demoData ? "演示压力" : realDataReady ? "压力已回传" : configEnabled ? "压力待接入" : "未配置"}</span>
                </div>
                <div className="power-node">
                  <Cylinder size={18} />
                  <strong>储气罐</strong>
                  <span>{demoData ? "演示缓冲" : realDataReady ? "缓冲状态已回传" : configEnabled ? "缓冲状态待接入" : "可扩展"}</span>
                </div>
                <div className="power-node">
                  <ShieldCheck size={18} />
                  <strong>控制边界</strong>
                  <span>{configEnabled ? "不写 PLC" : "未参与"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card">
          <header className="section-card-header">
            <h3>设备与诊断</h3>
            <span className="status-pill neutral">无假数据</span>
          </header>
          <div className="section-card-body">
            <div className="power-feeder-list">
              {processRows.map((item) => (
                <ProcessRow key={item.label} enabled={configEnabled} label={item.label} note={item.note} state={demoData ? "演示" : realDataReady ? "已回传" : item.state} />
              ))}
            </div>
            <div className="source-banner" style={{ marginTop: 14 }}>
              必需只读点位：{accessPackageLabel}。可选增强：{optionalPackageLabel}。
            </div>
            <div className="source-banner" style={{ marginTop: 10 }}>
              第一版只做只读诊断和影子建议，不调整空压机台数、不下发加载卸载命令。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

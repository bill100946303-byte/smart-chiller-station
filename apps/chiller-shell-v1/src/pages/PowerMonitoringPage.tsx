import { Activity, AlertTriangle, ClipboardCheck, Download, ListChecks, PlugZap, RefreshCw, ShieldCheck, Table2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./PowerMonitoringShared.css";
import "./DistributionEnergyWorkspace.css";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentProject, resolveEnergyConfigSiteId } from "../services/auth";
import {
  captureByxPowerHistorySnapshot,
  fetchByxPowerAssignmentCheck,
  fetchByxPowerMonitoring,
  fetchByxPowerAssignmentCsv,
  fetchSiteCapabilities,
  type ByxPowerAssignmentCheckDto,
  type ByxPowerDeviceDto,
  type ByxPowerHistorySampleDto,
  type ByxPowerMonitoringDto,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto
} from "../services/bffClient";
import {
  getSubsystemStatusPresentation,
  isSubsystemDemoData
} from "../utils/subsystemStatus";
import { formatControlBoundaryMode, resolveStationMetric } from "../utils/stationWorkspacePresentation";

type Tone = "good" | "warn" | "neutral";
type PowerDetailTab = "overview" | "quality" | "analysis" | "assignment" | "devices";
type ByxPowerCategorySummaryDto = NonNullable<NonNullable<ByxPowerMonitoringDto["summary"]>["categorySummaries"]>[number];

const POWER_REFRESH_MS = 20_000;
const FRESHNESS_WARN_MS = 2 * 60 * 1000;
const FRESHNESS_BAD_MS = 5 * 60 * 1000;

function isDemoData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return isSubsystemDemoData(item);
}

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  return getSubsystemStatusPresentation(item).detailLabel;
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  return getSubsystemStatusPresentation(item).tone;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "待实时";
  }
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function finiteNumber(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${Math.round(Number(value))}%`;
}

function formatAge(ms: number | null): string {
  if (!Number.isFinite(ms)) {
    return "待更新";
  }
  const seconds = Math.max(0, Math.round(Number(ms) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}min`;
  }
  return `${Math.round(minutes / 60)}h`;
}

function toneFromPercent(value: number, warnAt: number, goodAt: number): Tone {
  if (value >= goodAt) {
    return "good";
  }
  if (value >= warnAt) {
    return "warn";
  }
  return "neutral";
}

function trendDelta(latest: number | null, previous: number | null): number | null {
  if (!Number.isFinite(latest) || !Number.isFinite(previous)) {
    return null;
  }
  return Number(latest) - Number(previous);
}

function sanitizePowerProviderCopy(value: string): string {
  return value
    .replace(/百益信/g, "电力接口")
    .replace(/BYX_POWER_[A-Z_]+/g, "电力接口参数")
    .replace(/\bBYX\b/gi, "电力接口");
}

function formatPowerMissingConfig(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "接口域名、应用标识、公钥、登录标识";
  }
  const labels = new Map<string, string>([
    ["BYX_POWER_BASE_URL", "接口域名"],
    ["BYX_POWER_APP", "应用标识"],
    ["BYX_POWER_PUBLIC_KEY", "公钥"],
    ["BYX_POWER_LOGIN_ID", "登录标识"]
  ]);
  return values.map((value) => labels.get(value) || sanitizePowerProviderCopy(value)).join("、");
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

function formatShare(value: number | null | undefined, total: number | null | undefined): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || Number(total) <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100)));
}

function diagnosticLabel(device: ByxPowerDeviceDto): string {
  const labels = (device.diagnosticFlags || [])
    .map((flag) => flag.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join("、") : "正常";
}

function assignmentDisplay(device: ByxPowerDeviceDto): string {
  if (device.assignmentStatus === "confirmed") {
    const detail = device.ownerConfirmedLocation || device.ownerConfirmedPanel || device.ownerConfirmedSystem;
    return detail ? `已确认 · ${detail}` : "已确认";
  }
  return "待现场确认";
}

function assignmentCheckCompactMessage(check: ByxPowerAssignmentCheckDto): string {
  const summary = check.summary || {};
  const confirmed = summary.confirmedDeviceCount ?? 0;
  const total = summary.deviceCount ?? 0;
  const unmatched = summary.unmatchedAssignmentCount ?? 0;
  return `归属确认 ${confirmed}/${total}｜未匹配 ${unmatched}｜状态：${check.ok ? "通过" : "阻断"}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function findCategorySampleValue(sample: ByxPowerHistorySampleDto | undefined, category: string | undefined): number | null {
  if (!sample || !category) {
    return null;
  }
  const item = (sample.categories || []).find((candidate) => candidate.category === category);
  return Number.isFinite(item?.totalActivePowerKw) ? Number(item?.totalActivePowerKw) : null;
}

function formatDelta(value: number | null): string {
  if (!Number.isFinite(value)) {
    return "趋势待积累";
  }
  const numeric = Number(value);
  if (Math.abs(numeric) < 0.005) {
    return "持平";
  }
  return `${numeric > 0 ? "+" : ""}${formatNumber(numeric)} kW`;
}

function hasDiagnostic(device: ByxPowerDeviceDto, code: string): boolean {
  return (device.diagnosticFlags || []).some((flag) => flag.code === code);
}

function FeederRow({
  item,
  totalPowerKw,
  deltaKw
}: {
  item: ByxPowerCategorySummaryDto;
  totalPowerKw: number | null | undefined;
  deltaKw: number | null;
}) {
  const share = formatShare(item.totalActivePowerKw, totalPowerKw);
  const diagnosticCount = item.diagnosticDeviceCount || 0;
  return (
    <article className="power-feeder-row">
      <div>
        <strong>{item.label || item.category || "未归类"}</strong>
        <span>
          {item.deviceCount ?? 0} 台 / {item.onlineDeviceCount ?? 0} 台在线
          {diagnosticCount > 0 ? ` / ${diagnosticCount} 台关注` : ""}
        </span>
      </div>
      <div className="power-feeder-track" aria-hidden="true">
        <i style={{ width: `${share}%` }} />
      </div>
      <em>
        {formatNumber(item.totalActivePowerKw)} kW
        <small>{formatDelta(deltaKw)}</small>
      </em>
    </article>
  );
}

export default function PowerMonitoringPage() {
  const currentProject = getCurrentProject();
  const siteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [capabilityWarning, setCapabilityWarning] = useState("");
  const [exportingAssignment, setExportingAssignment] = useState(false);
  const [capabilities, setCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);
  const [powerData, setPowerData] = useState<ByxPowerMonitoringDto | null>(null);
  const [assignmentCheck, setAssignmentCheck] = useState<ByxPowerAssignmentCheckDto | null>(null);
  const [categoryHistory, setCategoryHistory] = useState<ByxPowerHistorySampleDto[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<PowerDetailTab>("overview");
  const [loadedSiteId, setLoadedSiteId] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorText("");
    setCapabilityWarning("");
    setAssignmentCheck(null);
    if (loadedSiteId !== siteId) {
      setCapabilities(null);
      setPowerData(null);
      setCategoryHistory([]);
    }
    try {
      const capabilityData = await fetchSiteCapabilities(siteId);
      const scopedPowerSubsystem = capabilityData.items?.find((item) => item.subsystemType === "power_monitoring") || null;
      setCapabilities(capabilityData);

      if (scopedPowerSubsystem?.status !== "enabled") {
        setPowerData(null);
        setCategoryHistory([]);
        setLoadedSiteId(siteId);
        return;
      }

      const nextPowerData = await fetchByxPowerMonitoring(siteId);
      setPowerData(nextPowerData);
      if (nextPowerData.ok) {
        const [historyResult, assignmentCheckResult] = await Promise.allSettled([
          captureByxPowerHistorySnapshot(siteId),
          fetchByxPowerAssignmentCheck(siteId)
        ]);
        if (historyResult.status === "fulfilled") {
          const history = historyResult.value;
          setCategoryHistory(history.samples || []);
        } else {
          setCapabilityWarning((current) => current || "电力趋势快照暂未写入，当前仅展示实时数据。");
        }
        if (assignmentCheckResult.status === "fulfilled") {
          setAssignmentCheck(assignmentCheckResult.value);
        } else {
          setCapabilityWarning((current) => current || "电力归属校验暂不可用，当前仅展示实时电参。");
        }
      } else {
        setCategoryHistory([]);
      }
      setLoadedSiteId(siteId);
    } catch (error) {
      setCapabilities(null);
      setPowerData(null);
      setCategoryHistory([]);
      setLoadedSiteId("");
      setErrorText(sanitizePowerProviderCopy(error instanceof Error ? error.message : "电力监控配置读取失败"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, POWER_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function exportAssignmentCsv() {
    if (!byxReady) {
      return;
    }
    setExportingAssignment(true);
    setErrorText("");
    try {
      const file = await fetchByxPowerAssignmentCsv(siteId);
      downloadBlob(file.blob, file.filename || `byx-power-assignment-${siteId}.csv`);
    } catch (error) {
      setErrorText(sanitizePowerProviderCopy(error instanceof Error ? error.message : "归属确认表导出失败"));
    } finally {
      setExportingAssignment(false);
    }
  }

  const scopeReady = loadedSiteId === siteId;
  const powerSubsystem: RuntimeSubsystemCapabilityDto | null = useMemo(() => {
    if (!scopeReady) {
      return null;
    }
    return capabilities?.items?.find((item) => item.subsystemType === "power_monitoring") || null;
  }, [capabilities, scopeReady]);

  const statusPresentation = getSubsystemStatusPresentation(powerSubsystem);
  const enabled = powerSubsystem?.status === "enabled";
  const demoData = isDemoData(powerSubsystem);
  const byxPayloadReady = Boolean(scopeReady && enabled && powerData?.ok && powerData.configured);
  const generatedAtMs = Number.isFinite(Date.parse(powerData?.generatedAt || ""))
    ? Date.parse(powerData?.generatedAt || "")
    : null;
  const dataAgeMs = generatedAtMs == null ? null : Math.max(0, Date.now() - generatedAtMs);
  const byxReady = Boolean(byxPayloadReady && dataAgeMs != null && dataAgeMs <= FRESHNESS_BAD_MS);
  const byxStale = Boolean(byxPayloadReady && !byxReady);
  const byxWaitingConfig = powerData?.configured === false;
  const initialLoading = loading && !powerData;
  const runtimeReady = byxReady || enabled;
  const displayedStatusLabel = byxReady
    ? "电力网关已接入"
    : byxStale
      ? "数据陈旧 / 停止判读"
      : initialLoading
        ? "加载中"
        : formatStatus(powerSubsystem);
  const displayedStatusTone: Tone = byxReady ? "good" : byxStale ? "warn" : initialLoading ? "neutral" : statusTone(powerSubsystem);
  const boundaryMode = powerSubsystem?.controlBoundary?.mode || "read_only";
  const boundaryLabel = byxReady || boundaryMode === "read_only"
    ? "控制未接入"
    : formatControlBoundaryMode(boundaryMode);
  const powerDevices = useMemo<ByxPowerDeviceDto[]>(() => {
    return (powerData?.projects || []).flatMap((project) => project.devices || []);
  }, [powerData]);
  const categoryRows = powerData?.summary?.categorySummaries || [];
  const latestCategoryHistory = categoryHistory[categoryHistory.length - 1];
  const previousCategoryHistory = categoryHistory.length > 1 ? categoryHistory[categoryHistory.length - 2] : undefined;
  const rankedPowerDevices = useMemo(() => {
    return [...powerDevices].sort((left, right) => (right.activePowerKw || 0) - (left.activePowerKw || 0));
  }, [powerDevices]);
  const projectNodes = (powerData?.projects || []).slice(0, 2);
  const diagnosticDeviceCount = powerData?.summary?.diagnosticDeviceCount || 0;
  const confirmedAssignmentCount = powerData?.assignmentMap?.confirmedDeviceCount || 0;
  const totalDeviceCount = powerData?.summary?.deviceCount || 0;
  const onlineDeviceCount = powerData?.summary?.onlineDeviceCount || 0;
  const offlineDeviceCount = powerData?.summary?.offlineDeviceCount ?? Math.max(0, totalDeviceCount - onlineDeviceCount);
  const projectCount = powerData?.summary?.projectCount || 0;
  const fallbackMetric = (demoValue: string, demoUnit: string, waitingNote: string) => {
    if (byxStale) {
      return { value: "不可用", note: "数据陈旧，停止判读", tone: "warn" as const };
    }
    return resolveStationMetric({
      status: statusPresentation,
      loading: initialLoading,
      errorText,
      demoValue,
      demoUnit,
      waitingNote,
      liveNote: waitingNote
    });
  };
  const totalPowerMetric = byxReady
    ? { value: formatNumber(powerData?.summary?.totalActivePowerKw), unit: "kW", note: "实时数据", tone: "good" as const }
    : fallbackMetric("1,286", "kW", "等待电力接口");
  const totalEnergyMetric = byxReady
    ? { value: formatNumber(powerData?.summary?.totalEnergyKwh), unit: "kWh", note: "累计电量", tone: "good" as const }
    : fallbackMetric("18,420", "kWh", "等待累计电量");
  const onlineDeviceMetric = byxReady
    ? { value: String(powerData?.summary?.onlineDeviceCount ?? 0), unit: "台", note: "电表/断路器在线", tone: "good" as const }
    : fallbackMetric("12", "台", "等待设备清单");
  const powerFactorMetric = byxReady
    ? { value: formatNumber(powerData?.summary?.avgPowerFactor, 3), note: "带负荷设备平均", tone: "good" as const }
    : fallbackMetric("0.96", "", "等待功率因数");
  const assignmentSummary = assignmentCheck?.summary;
  const assignmentEntryCount = assignmentSummary?.assignmentEntryCount ?? powerData?.assignmentMap?.entryCount ?? 0;
  const matchedAssignmentCount = assignmentSummary?.matchedDeviceCount ?? powerData?.assignmentMap?.matchedDeviceCount ?? 0;
  const unconfirmedAssignmentCount =
    assignmentSummary?.unconfirmedDeviceCount ?? Math.max(0, totalDeviceCount - confirmedAssignmentCount);
  const unmatchedAssignmentCount = assignmentSummary?.unmatchedAssignmentCount ?? 0;
  const assignmentCoverage = formatShare(confirmedAssignmentCount, totalDeviceCount);
  const diagnosticDevices = rankedPowerDevices.filter((device) => (device.diagnosticFlags || []).length > 0).slice(0, 5);
  const assignmentGateState = assignmentCheck?.ok ? "通过" : "阻断";
  const onlineRate = formatShare(onlineDeviceCount, totalDeviceCount);
  const freshnessTone: Tone =
    !byxReady || dataAgeMs == null ? "neutral" : dataAgeMs <= FRESHNESS_WARN_MS ? "good" : dataAgeMs <= FRESHNESS_BAD_MS ? "warn" : "neutral";
  const requiredMeterFields = powerDevices.length * 5;
  const validMeterFields = powerDevices.reduce((sum, device) => {
    return sum +
      (Number.isFinite(device.activePowerKw) ? 1 : 0) +
      (Number.isFinite(device.energyKwh) ? 1 : 0) +
      (Number.isFinite(device.powerFactor) ? 1 : 0) +
      (Number.isFinite(device.temperatureC) ? 1 : 0) +
      (Number.isFinite(device.leakageCurrentMa) ? 1 : 0);
  }, 0);
  const meterCompleteness = formatShare(validMeterFields, requiredMeterFields);
  const missingMeterDeviceCount = powerDevices.filter((device) => {
    return !Number.isFinite(device.activePowerKw) || !Number.isFinite(device.energyKwh) || !Number.isFinite(device.powerFactor);
  }).length;
  const dataQualityReady = Boolean(byxReady && freshnessTone === "good" && onlineRate >= 95 && meterCompleteness >= 90);
  const formalCategoryReady = Boolean(dataQualityReady && assignmentCheck?.ok);
  const latestTotalPowerKw = finiteNumber(latestCategoryHistory?.totalActivePowerKw ?? powerData?.summary?.totalActivePowerKw);
  const previousTotalPowerKw = finiteNumber(previousCategoryHistory?.totalActivePowerKw);
  const totalPowerDeltaKw = trendDelta(latestTotalPowerKw, previousTotalPowerKw);
  const topCategory = categoryRows[0];
  const topCategoryShare = formatShare(topCategory?.totalActivePowerKw, powerData?.summary?.totalActivePowerKw);
  const topThreePowerKw = rankedPowerDevices.slice(0, 3).reduce((sum, device) => sum + (finiteNumber(device.activePowerKw) || 0), 0);
  const topThreeShare = formatShare(topThreePowerKw, powerData?.summary?.totalActivePowerKw);
  const lowPowerFactorDevices = powerDevices.filter((device) => {
    const power = finiteNumber(device.activePowerKw) || 0;
    const powerFactor = finiteNumber(device.powerFactor);
    return hasDiagnostic(device, "low_power_factor") || (power > 0.05 && Number.isFinite(powerFactor) && Number(powerFactor) < 0.85);
  });
  const voltageAbnormalDevices = powerDevices.filter((device) => hasDiagnostic(device, "voltage_out_of_range"));
  const hotDevices = powerDevices.filter((device) => (finiteNumber(device.temperatureC) || 0) >= 60);
  const leakageDevices = powerDevices.filter((device) => (finiteNumber(device.leakageCurrentMa) || 0) >= 30);
  const closedLowPowerDevices = powerDevices.filter((device) => device.switchClosed && (finiteNumber(device.activePowerKw) || 0) <= 0.02);
  const currentHour = new Date().getHours();
  const isNightWindow = currentHour >= 20 || currentHour < 7;
  const nightLoadFlag = Boolean(isNightWindow && (powerData?.summary?.totalActivePowerKw || 0) >= 1);
  const qualityItems = [
    {
      title: "数据新鲜度",
      value: formatAge(dataAgeMs),
      detail: freshnessTone === "good" ? "实时刷新正常" : "需核对接口刷新",
      tone: freshnessTone
    },
    {
      title: "在线率",
      value: formatPercent(onlineRate),
      detail: `${onlineDeviceCount}/${totalDeviceCount} 台在线`,
      tone: toneFromPercent(onlineRate, 90, 98)
    },
    {
      title: "电参完整率",
      value: formatPercent(meterCompleteness),
      detail: `${missingMeterDeviceCount} 台需核对`,
      tone: toneFromPercent(meterCompleteness, 90, 98)
    },
    {
      title: "归属覆盖",
      value: formatPercent(assignmentCoverage),
      detail: assignmentCheck?.ok ? "分项门禁通过" : "未达正式分项",
      tone: assignmentCheck?.ok ? "good" : "warn"
    }
  ];
  const analysisIssues = [
    {
      title: "功率因数偏低",
      value: `${lowPowerFactorDevices.length} 台`,
      detail: lowPowerFactorDevices.length > 0 ? "优先核对补偿与轻载回路" : "当前未触发",
      tone: lowPowerFactorDevices.length > 0 ? "warn" : "good"
    },
    {
      title: "温度/漏电风险",
      value: `${hotDevices.length + leakageDevices.length} 台`,
      detail: hotDevices.length > 0 || leakageDevices.length > 0 ? "需现场复核保护值" : "当前未触发",
      tone: hotDevices.length + leakageDevices.length > 0 ? "warn" : "good"
    },
    {
      title: "电压越界",
      value: `${voltageAbnormalDevices.length} 台`,
      detail: voltageAbnormalDevices.length > 0 ? "需核对电源质量" : "当前未触发",
      tone: voltageAbnormalDevices.length > 0 ? "warn" : "good"
    },
    {
      title: "夜间负荷",
      value: nightLoadFlag ? `${formatNumber(powerData?.summary?.totalActivePowerKw)} kW` : "正常",
      detail: nightLoadFlag ? "非工作时段仍有负荷" : "未触发夜间观察",
      tone: nightLoadFlag ? "warn" : "good"
    }
  ];
  const detailTabs: Array<{ id: PowerDetailTab; label: string; meta: string }> = [
    {
      id: "overview",
      label: "接入总览",
      meta: byxReady ? `${projectCount}项/${onlineDeviceCount}/${totalDeviceCount}` : "待接入"
    },
    {
      id: "quality",
      label: "数据质量",
      meta: byxReady ? `${formatPercent(onlineRate)}/${formatPercent(meterCompleteness)}` : "待接入"
    },
    {
      id: "analysis",
      label: "用电分析",
      meta: byxReady ? `${categoryRows.length}类/${diagnosticDeviceCount}关注` : "待接入"
    },
    {
      id: "assignment",
      label: "回路归属",
      meta: assignmentCheck?.ok ? "校验通过" : "阻断"
    },
    {
      id: "devices",
      label: "设备明细",
      meta: byxReady ? `${rankedPowerDevices.length}台` : "待接入"
    }
  ];

  return (
    <div
      className="power-monitor-page distribution-energy-workspace power-distribution-workspace"
      data-distribution-energy-workspace
      data-subsystem-type="power_monitoring"
      data-subsystem-status={byxReady ? "live" : byxStale ? "stale" : statusPresentation.kind}
      data-object-scope="project_aggregate"
    >
      <section className="section-card power-monitor-hero">
        <header className="section-card-header">
          <div>
            <h1 className="distribution-workspace-title">电力监控</h1>
            <p className="power-monitor-subtitle">电力只读电参｜用途分项｜归属门禁</p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${displayedStatusTone}`}>{displayedStatusLabel}</span>
            <span className="status-pill neutral">{boundaryLabel}</span>
            <button type="button" onClick={() => void exportAssignmentCsv()} disabled={exportingAssignment || !byxReady}>
              <Download size={14} />
              {exportingAssignment ? "导出中" : "导出归属确认表"}
            </button>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {errorText ? <div className="source-banner warn">{errorText}</div> : null}
          {capabilityWarning ? <div className="source-banner warn">{capabilityWarning}</div> : null}
          {demoData && !byxReady ? (
            <div className="source-banner">
              当前站点能力表仍标记为只读数据源，请以电力实时采集状态为准。
            </div>
          ) : null}
          {byxWaitingConfig ? (
            <div className="source-banner warn">
              电力接口待配置：{formatPowerMissingConfig(powerData?.missingConfig)}。
            </div>
          ) : null}
          {byxStale ? (
            <div className="source-banner warn">电力网关返回的数据已超过 5 分钟，当前停止能耗与诊断判读；请恢复刷新链路后再使用。</div>
          ) : null}
          {byxReady ? (
            <div className={`source-banner power-status-summary ${assignmentCheck?.ok ? "good" : "warn"}`}>
              <span>电力网关已接入</span>
              <span>归属确认 {confirmedAssignmentCount}/{totalDeviceCount}</span>
              <span>未匹配 {unmatchedAssignmentCount}</span>
              <span>状态：{assignmentGateState}</span>
            </div>
          ) : null}
          <div className="power-monitor-summary">
            <div data-power-scope-summary>
              <span>当前范围</span>
              <strong>当前项目电力汇总</strong>
            </div>
            <div>
              <span>设备总数</span>
              <strong>{byxReady ? `${powerData?.summary?.deviceCount ?? 0} 台` : "--"}</strong>
            </div>
            <div>
              <span>在线</span>
              <strong>{byxReady ? `${powerData?.summary?.onlineDeviceCount ?? 0} 台` : "--"}</strong>
            </div>
            <div>
              <span>诊断关注</span>
              <strong>{byxReady ? `${diagnosticDeviceCount} 台` : "--"}</strong>
            </div>
            <div>
              <span>归属确认</span>
              <strong>{byxReady ? `${confirmedAssignmentCount}/${totalDeviceCount}` : "--"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title="总有功功率" {...totalPowerMetric} />
        <StatTile title="累计电量" {...totalEnergyMetric} />
        <StatTile title="在线设备" {...onlineDeviceMetric} />
        <StatTile title="平均功率因数" {...powerFactorMetric} />
      </div>

      <section className="power-detail-stage" data-active-tab={activeDetailTab}>
        <header className="power-detail-stage-head">
          <div className="power-detail-tabs" role="tablist" aria-label="电力监测二级页面">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeDetailTab === tab.id ? "is-active" : ""}
                role="tab"
                aria-selected={activeDetailTab === tab.id}
                onClick={() => setActiveDetailTab(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{tab.meta}</strong>
              </button>
            ))}
          </div>
        </header>

        <div className="power-detail-body">
          {activeDetailTab === "overview" ? (
            <div className="power-detail-panel power-detail-panel-overview" role="tabpanel">
              <article className="power-detail-card power-detail-card-flow">
                <div className="power-detail-card-head">
                  <div>
                    <span>接入链路</span>
                    <strong>电力只读网关</strong>
                  </div>
                  <span className="status-pill neutral">只读边界</span>
                </div>
                <div className={`power-single-line power-single-line-secondary${runtimeReady ? " is-enabled" : ""}`}>
                  <div className="power-node power-node-source">
                    <Zap size={20} />
                    <strong>电力只读网关</strong>
                    <span>{byxReady ? `${projectCount} 个项目 / ${totalDeviceCount} 台设备` : initialLoading ? "读取中" : demoData ? "只读数据" : enabled ? "待配置" : "未配置"}</span>
                  </div>
                  <div className="power-bus" aria-hidden="true" />
                  <div className="power-node-grid">
                    {byxReady && projectNodes.length > 0 ? projectNodes.map((project) => (
                      <div className="power-node" key={project.projectId || project.projectName}>
                        <PlugZap size={18} />
                        <strong>{project.projectName || project.projectId || "未命名项目"}</strong>
                        <span>{project.devices?.length || 0} 台设备</span>
                      </div>
                    )) : null}
                    <div className="power-node">
                      <Activity size={18} />
                      <strong>用途分项</strong>
                      <span>{byxReady ? `${categoryRows.length} 类 / ${formatNumber(powerData?.summary?.totalActivePowerKw)} kW` : demoData ? "只读分项" : enabled ? "分项待回传" : "可扩展"}</span>
                    </div>
                    <div className="power-node">
                      <ShieldCheck size={18} />
                      <strong>控制边界</strong>
                      <span>{runtimeReady ? "控制未接入" : "未参与"}</span>
                    </div>
                  </div>
                </div>
              </article>

              <article className={`power-detail-card power-gate-card ${assignmentCheck?.ok ? "is-good" : "is-warn"}`}>
                <div className="power-detail-card-head">
                  <div>
                    <span>回路归属门禁</span>
                    <strong>{assignmentCheck?.ok ? "校验通过" : "阻断下游分项口径"}</strong>
                  </div>
                  {assignmentCheck?.ok ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="power-gate-meter" aria-label={`归属确认覆盖率 ${assignmentCoverage}%`}>
                  <i style={{ width: `${assignmentCoverage}%` }} />
                </div>
                <div className="power-gate-metrics">
                  <div>
                    <span>确认覆盖</span>
                    <strong>{confirmedAssignmentCount}/{totalDeviceCount}</strong>
                  </div>
                  <div>
                    <span>待确认</span>
                    <strong>{unconfirmedAssignmentCount}</strong>
                  </div>
                  <div>
                    <span>未匹配</span>
                    <strong>{unmatchedAssignmentCount}</strong>
                  </div>
                </div>
              </article>

              <article className="power-detail-card power-feeder-card">
                <div className="power-detail-card-head">
                  <div>
                    <span>用途分项</span>
                    <strong>{categoryHistory.length > 1 ? `${categoryHistory.length} 个趋势样本` : "实时分项"}</strong>
                  </div>
                  <ListChecks size={18} />
                </div>
                {byxReady && categoryRows.length > 0 ? (
                  <div className="power-feeder-list power-feeder-list-compact">
                    {categoryRows.slice(0, 5).map((item) => {
                      const latestValue = findCategorySampleValue(latestCategoryHistory, item.category);
                      const previousValue = findCategorySampleValue(previousCategoryHistory, item.category);
                      const deltaKw = Number.isFinite(latestValue) && Number.isFinite(previousValue)
                        ? Number(latestValue) - Number(previousValue)
                        : null;
                      return (
                        <FeederRow
                          key={item.category || item.label}
                          item={item}
                          totalPowerKw={powerData?.summary?.totalActivePowerKw}
                          deltaKw={deltaKw}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="source-banner warn">实时数据分项未返回，等待项目数据。</div>
                )}
              </article>
            </div>
          ) : null}

          {activeDetailTab === "quality" ? (
            <div className="power-detail-panel power-detail-panel-quality" role="tabpanel">
              <article className={`power-detail-card power-gate-card power-quality-primary ${dataQualityReady ? "is-good" : "is-warn"}`}>
                <div className="power-detail-card-head">
                  <div>
                    <span>P0 数据门禁</span>
                    <strong>{dataQualityReady ? "实时数据可信" : "先稳数据质量"}</strong>
                  </div>
                  {dataQualityReady ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="power-quality-status-grid">
                  {qualityItems.map((item) => (
                    <div className={`power-quality-item tone-${item.tone}`} key={item.title}>
                      <span>{item.title}</span>
                      <strong>{item.value}</strong>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className={`power-detail-card power-gate-card ${formalCategoryReady ? "is-good" : "is-warn"}`}>
                <div className="power-detail-card-head">
                  <div>
                    <span>分项启用条件</span>
                    <strong>{formalCategoryReady ? "可输出正式分项" : "等待归属确认"}</strong>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <div className="power-gate-meter is-large" aria-label={`P0 完成度 ${Math.min(100, Math.round((onlineRate + meterCompleteness + assignmentCoverage) / 3))}%`}>
                  <i style={{ width: `${Math.min(100, Math.round((onlineRate + meterCompleteness + assignmentCoverage) / 3))}%` }} />
                </div>
                <div className="power-gate-metrics is-wide">
                  <div>
                    <span>离线</span>
                    <strong>{offlineDeviceCount}</strong>
                  </div>
                  <div>
                    <span>缺电参</span>
                    <strong>{missingMeterDeviceCount}</strong>
                  </div>
                  <div>
                    <span>待确认</span>
                    <strong>{unconfirmedAssignmentCount}</strong>
                  </div>
                  <div>
                    <span>未匹配</span>
                    <strong>{unmatchedAssignmentCount}</strong>
                  </div>
                </div>
              </article>

              <article className="power-detail-card power-next-actions">
                <div className="power-detail-card-head">
                  <div>
                    <span>P0 下一步</span>
                    <strong>先闭环归属与质量</strong>
                  </div>
                  <ClipboardCheck size={18} />
                </div>
                <ol>
                  <li><strong>确认回路归属</strong><span>覆盖率达到门禁后启用正式分项。</span></li>
                  <li><strong>核对缺口设备</strong><span>优先处理离线、缺电参、诊断关注。</span></li>
                  <li><strong>保留只读边界</strong><span>电力监控只做采集、分析、导出。</span></li>
                </ol>
              </article>
            </div>
          ) : null}

          {activeDetailTab === "analysis" ? (
            <div className="power-detail-panel power-detail-panel-analysis" role="tabpanel">
              <article className="power-detail-card power-analysis-primary">
                <div className="power-detail-card-head">
                  <div>
                    <span>P1 用电结构</span>
                    <strong>{topCategory?.label || "等待分项"}</strong>
                  </div>
                  <span className="status-pill neutral">{formatPercent(topCategoryShare)} 占比</span>
                </div>
                <div className="power-analysis-summary-grid">
                  <div>
                    <span>总功率</span>
                    <strong>{formatNumber(powerData?.summary?.totalActivePowerKw)} kW</strong>
                  </div>
                  <div>
                    <span>功率变化</span>
                    <strong>{formatDelta(totalPowerDeltaKw)}</strong>
                  </div>
                  <div>
                    <span>Top3 集中度</span>
                    <strong>{formatPercent(topThreeShare)}</strong>
                  </div>
                  <div>
                    <span>平均功率因数</span>
                    <strong>{formatNumber(powerData?.summary?.avgPowerFactor, 3)}</strong>
                  </div>
                </div>
              </article>

              <article className="power-detail-card power-rank-card">
                <div className="power-detail-card-head">
                  <div>
                    <span>分项功率排行</span>
                    <strong>{categoryRows.length} 类</strong>
                  </div>
                  <ListChecks size={18} />
                </div>
                <div className="power-rank-list">
                  {categoryRows.slice(0, 5).map((item) => {
                    const share = formatShare(item.totalActivePowerKw, powerData?.summary?.totalActivePowerKw);
                    return (
                      <div className="power-rank-row" key={item.category || item.label}>
                        <div>
                          <strong>{item.label || item.category || "未归类"}</strong>
                          <span>{item.deviceCount ?? 0} 台 / {item.diagnosticDeviceCount ?? 0} 关注</span>
                        </div>
                        <div className="power-feeder-track" aria-hidden="true">
                          <i style={{ width: `${share}%` }} />
                        </div>
                        <em>{formatNumber(item.totalActivePowerKw)} kW</em>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="power-detail-card power-insight-card">
                <div className="power-detail-card-head">
                  <div>
                    <span>异常诊断</span>
                    <strong>{analysisIssues.filter((item) => item.tone === "warn").length} 项关注</strong>
                  </div>
                  <AlertTriangle size={18} />
                </div>
                <div className="power-insight-list">
                  {analysisIssues.map((item) => (
                    <div className={`power-insight-item tone-${item.tone}`} key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <em>{item.value}</em>
                    </div>
                  ))}
                  {closedLowPowerDevices.length > 0 ? (
                    <div className="power-insight-item tone-warn">
                      <div>
                        <strong>合闸低负荷</strong>
                        <span>疑似待机或空载回路</span>
                      </div>
                      <em>{closedLowPowerDevices.length} 台</em>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          ) : null}

          {activeDetailTab === "assignment" ? (
            <div className="power-detail-panel power-detail-panel-assignment" role="tabpanel">
              <article className={`power-detail-card power-assignment-primary ${assignmentCheck?.ok ? "is-good" : "is-warn"}`}>
                <div className="power-detail-card-head">
                  <div>
                    <span>门禁状态</span>
                    <strong>{assignmentCheck?.ok ? "可用于分项报表" : "等待现场确认表"}</strong>
                  </div>
                  {assignmentCheck?.ok ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                </div>
                <p>{assignmentCheckCompactMessage(assignmentCheck || { ok: false, summary: { confirmedDeviceCount: confirmedAssignmentCount, deviceCount: totalDeviceCount, unmatchedAssignmentCount } })}</p>
                <div className="power-assignment-blockers">
                  {(assignmentCheck?.blockingItems || []).slice(0, 4).map((item) => (
                    <span key={item.key || item.message}>{item.key || item.message || "blocking_item"}</span>
                  ))}
                  {!assignmentCheck?.blockingItems?.length ? <span>当前无额外阻断项</span> : null}
                </div>
              </article>

              <article className="power-detail-card">
                <div className="power-detail-card-head">
                  <div>
                    <span>现场回填进度</span>
                    <strong>{assignmentCoverage}% 覆盖</strong>
                  </div>
                  <span className="status-pill neutral">{assignmentEntryCount} 行映射</span>
                </div>
                <div className="power-gate-meter is-large" aria-label={`归属确认覆盖率 ${assignmentCoverage}%`}>
                  <i style={{ width: `${assignmentCoverage}%` }} />
                </div>
                <div className="power-gate-metrics is-wide">
                  <div>
                    <span>已确认</span>
                    <strong>{confirmedAssignmentCount}</strong>
                  </div>
                  <div>
                    <span>已匹配</span>
                    <strong>{matchedAssignmentCount}</strong>
                  </div>
                  <div>
                    <span>待确认</span>
                    <strong>{unconfirmedAssignmentCount}</strong>
                  </div>
                  <div>
                    <span>未匹配</span>
                    <strong>{unmatchedAssignmentCount}</strong>
                  </div>
                </div>
              </article>

              <article className="power-detail-card power-next-actions">
                <div className="power-detail-card-head">
                  <div>
                    <span>下一步</span>
                    <strong>二级确认流程</strong>
                  </div>
                  <ClipboardCheck size={18} />
                </div>
                <ol>
                  <li><strong>导出确认表</strong><span>生成设备清单。</span></li>
                  <li><strong>现场回填</strong><span>补用途、位置、回路。</span></li>
                  <li><strong>导入复核</strong><span>通过后启用分项口径。</span></li>
                </ol>
              </article>
            </div>
          ) : null}

          {activeDetailTab === "devices" ? (
            <div className="power-detail-panel power-detail-panel-devices" role="tabpanel">
              {byxReady && rankedPowerDevices.length > 0 ? (
                <div className="power-device-table-wrap" role="region" aria-label="电力设备明细表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="power-device-table">
                    <thead>
                      <tr>
                        <th>设备</th>
                        <th>用途</th>
                        <th>状态</th>
                        <th>功率 kW</th>
                        <th>电量 kWh</th>
                        <th>功率因数</th>
                        <th>温度</th>
                        <th>漏电流</th>
                        <th>诊断</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedPowerDevices.map((device) => (
                        <tr key={device.deviceId || device.deviceName}>
                          <td>
                            <strong>{device.deviceName || device.deviceId || "--"}</strong>
                            <span>{device.deviceId || device.deviceTypeName || "--"}</span>
                          </td>
                          <td>
                            <strong>{device.categoryLabel || "未归类"}</strong>
                            <span>{assignmentDisplay(device)}</span>
                          </td>
                          <td>{device.online ? "在线" : "离线"} / {device.switchClosed ? "合闸" : "分闸"}</td>
                          <td>{formatNumber(device.activePowerKw)}</td>
                          <td>{formatNumber(device.energyKwh)}</td>
                          <td>{formatNumber(device.powerFactor, 3)}</td>
                          <td>{formatNumber(device.temperatureC)} °C</td>
                          <td>{formatNumber(device.leakageCurrentMa, 2)} mA</td>
                          <td>{diagnosticLabel(device)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="source-banner warn">暂无设备明细。</div>
              )}

              <aside className="power-detail-card power-device-side">
                <div className="power-detail-card-head">
                  <div>
                    <span>诊断关注</span>
                    <strong>{diagnosticDeviceCount} 台</strong>
                  </div>
                  <Table2 size={18} />
                </div>
                <div className="power-device-focus-list">
                  {diagnosticDevices.length > 0 ? diagnosticDevices.map((device) => (
                    <div key={device.deviceId || device.deviceName}>
                      <strong>{device.deviceName || device.deviceId || "--"}</strong>
                      <span>{diagnosticLabel(device)}</span>
                    </div>
                  )) : <p>当前无诊断关注设备。</p>}
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

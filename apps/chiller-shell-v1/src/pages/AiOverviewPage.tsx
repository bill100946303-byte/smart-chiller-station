import {
  Activity,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  Snowflake,
  Sparkles,
  TriangleAlert,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  isAppliedStationRuntimeScope,
  useStationRuntimeScope
} from "../context/StationRuntimeScopeContext";
import {
  fetchDashboardOverview,
  fetchDashboardOverviewForProject,
  fetchRuntimePointSummary,
  fetchSiteCapabilities,
  type DashboardOverviewDto,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto,
  type RuntimePointSummaryDto
} from "../services/bffClient";
import {
  getCurrentProject,
  resolveAuthProjectDisplayName,
  resolveEnergyConfigSiteId
} from "../services/auth";
import { siteIdsEquivalent } from "../services/siteRouting";
import {
  getSubsystemStatusPresentation,
  isSubsystemDemoData,
  isSubsystemRealDataReady,
  isSubsystemWaitingForRealData
} from "../utils/subsystemStatus";
import { formatControlBoundaryMode } from "../utils/stationWorkspacePresentation";
import "./AiOverviewExtracted.css";
import "./AiOverviewTruth.css";

type Tone = "good" | "warn" | "info";

function formatAdvisorStatus(value: string): string {
  switch (value) {
    case "ready":
      return "已就绪";
    case "enabled":
      return "已启用";
    case "disabled":
      return "已停用";
    case "error":
      return "异常";
    case "not_configured":
      return "未配置";
    default:
      return value || "未配置";
  }
}

type KpiCard = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  status: string;
  tone: Tone;
};

type EquipmentCard = {
  layoutRole: "chiller" | "chilled-pump" | "load" | "telemetry" | "cooling-pump" | "cooling-tower";
  name: string;
  value: string;
  unit?: string;
  status: string;
  tone: Tone;
  note: string;
  progress: number;
};

type Recommendation = {
  id: string;
  title: string;
  current: string;
  advice: string;
  benefit: string;
  risk: "低" | "中";
  actionLabel: string;
  detail: string;
};

type SubsystemAdvice = {
  id: string;
  name: string;
  statusLabel: string;
  statusTone: Tone;
  adviceLabel: string;
  boundaryLabel: string;
  mappingLabel: string;
  detail: string;
};

const AI_OVERVIEW_REFRESH_MS = 15_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, digits = 1, fallback = "待实时"): string {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatInteger(value: number | null | undefined, fallback = "待实时"): string {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function formatCop(value: number | null | undefined): string {
  return formatNumber(value, 2, "待实时");
}

function formatKw(value: number | null | undefined): string {
  return formatInteger(value);
}

function formatPercent(value: number | null | undefined, fallback = "待评估"): string {
  return isFiniteNumber(value) ? `${formatNumber(value, 1)}%` : fallback;
}

function formatTemp(value: number | null | undefined, fallback = "待实时"): string {
  return isFiniteNumber(value) ? `${formatNumber(value, 1)}℃` : fallback;
}

function formatHz(value: number | null | undefined, fallback = "待实时"): string {
  return isFiniteNumber(value) ? `${formatNumber(value, 1)}Hz` : fallback;
}

function formatCountRatio(running: number | null | undefined, total: number | null | undefined): string {
  if (!isFiniteNumber(running) || !isFiniteNumber(total) || total <= 0) {
    return "待实时";
  }
  return `${Math.round(running)}/${Math.round(total)}`;
}

function ratioProgress(running: number | null | undefined, total: number | null | undefined, fallback = 35): number {
  if (!isFiniteNumber(running) || !isFiniteNumber(total) || total <= 0) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round((running / total) * 100)));
}

function runtimeReady(summary: RuntimePointSummaryDto | null): boolean {
  return summary?.status === "ready" && (summary.counts?.registerPoints ?? 0) > 0;
}

function formatRunningIds(ids: string[] | undefined, fallback: string): string {
  const values = (ids || []).filter(Boolean);
  if (values.length === 0) {
    return fallback;
  }
  return values.slice(0, 6).join("/");
}

function getCoolingTowerFanStats(summary: RuntimePointSummaryDto | null): { total: number | null; running: number | null } {
  const fanRows = (summary?.groups?.coolingTowers || []).filter((item) => /^CTF/i.test(item.id || ""));
  if (fanRows.length > 0) {
    return {
      total: fanRows.length,
      running: fanRows.filter((item) => item.running).length
    };
  }
  return {
    total: summary?.counts?.coolingTowerFanCount ?? null,
    running: summary?.counts?.runningCoolingTowerFanCount ?? null
  };
}

function getCoolingTowerCellStats(summary: RuntimePointSummaryDto | null): { total: number | null; running: number | null } {
  const cells = summary?.groups?.coolingTowerCells || [];
  if (cells.length > 0) {
    return {
      total: cells.length,
      running: cells.filter((item) => item.running).length
    };
  }
  return {
    total: summary?.counts?.coolingTowerCellCount ?? summary?.counts?.coolingTowerCount ?? null,
    running: summary?.counts?.runningCoolingTowerCount ?? null
  };
}

function buildKpiCards(
  overview: DashboardOverviewDto | null,
  summary: RuntimePointSummaryDto | null,
  scopeLabel: string
): KpiCard[] {
  const energy = overview?.energyCards;
  const registerPoints = summary?.counts?.registerPoints ?? null;
  const runtimeStatus = runtimeReady(summary) ? "实时" : "待接通";

  return [
    {
      label: "系统COP",
      value: formatCop(energy?.currentCop),
      note: isFiniteNumber(energy?.totalPowerKw)
        ? `总功率 ${formatNumber(energy.totalPowerKw, 1)} kW`
        : "总功率待回传",
      status: energy?.currentCop != null ? "实时" : "待回传",
      tone: energy?.currentCop != null ? "good" : "warn"
    },
    {
      label: "节能潜力",
      value: formatPercent(energy?.savingPotentialPct),
      note: "仅作影子测算，需 M&V 基线复核",
      status: energy?.savingPotentialPct != null ? "待复核" : "待模型",
      tone: energy?.savingPotentialPct != null ? "info" : "warn"
    },
    {
      label: "当前负荷",
      value: formatKw(energy?.totalCoolingCapacity),
      unit: "kW",
      note: isFiniteNumber(energy?.currentLoadRate)
        ? `负荷率 ${formatNumber(energy.currentLoadRate, 1)}%`
        : "负荷率待回传",
      status: energy?.totalCoolingCapacity != null ? "实时" : "待回传",
      tone: energy?.totalCoolingCapacity != null ? "good" : "warn"
    },
    {
      label: "实时点数",
      value: formatInteger(registerPoints),
      unit: registerPoints != null ? "点" : undefined,
      note: isFiniteNumber(summary?.counts?.deviceRows)
        ? `设备行 ${formatInteger(summary.counts.deviceRows, "--")} 行`
        : `${scopeLabel}实时点位待恢复`,
      status: runtimeStatus,
      tone: runtimeReady(summary) ? "good" : "warn"
    }
  ];
}

function buildEquipmentCards(overview: DashboardOverviewDto | null, summary: RuntimePointSummaryDto | null): EquipmentCard[] {
  const counts = summary?.counts || {};
  const signals = summary?.keySignals || {};
  const towerCells = getCoolingTowerCellStats(summary);
  const towerFans = getCoolingTowerFanStats(summary);
  const activeChillerIds = summary?.summary?.activeChillerIds || summary?.summary?.runningCombination || [];
  const realTimeTone: Tone = runtimeReady(summary) ? "good" : "warn";

  return [
    {
      layoutRole: "chiller",
      name: "冷机",
      value: formatCountRatio(counts.runningChillerCount, counts.chillerCount),
      status: counts.runningChillerCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `运行组合 ${formatRunningIds(activeChillerIds, "待实时")}`,
      progress: ratioProgress(counts.runningChillerCount, counts.chillerCount)
    },
    {
      layoutRole: "chilled-pump",
      name: "冷冻泵",
      value: formatCountRatio(counts.runningChilledPumpCount, counts.chilledPumpCount),
      status: counts.runningChilledPumpCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `均频 ${formatHz(signals.pumpFrequency?.chilledAvgHz)} · ΔT ${formatTemp(signals.chilledWater?.deltaTC)}`,
      progress: ratioProgress(counts.runningChilledPumpCount, counts.chilledPumpCount)
    },
    {
      layoutRole: "load",
      name: "负荷侧",
      value: formatKw(overview?.energyCards?.totalCoolingCapacity),
      unit: overview?.energyCards?.totalCoolingCapacity != null ? "kW" : undefined,
      status: overview?.energyCards?.totalCoolingCapacity != null ? "实时" : "待回传",
      tone: overview?.energyCards?.totalCoolingCapacity != null ? "good" : "warn",
      note: isFiniteNumber(overview?.energyCards?.currentLoadRate)
        ? `负荷率 ${formatNumber(overview.energyCards.currentLoadRate, 1)}%`
        : "负荷率待回传",
      progress: isFiniteNumber(overview?.energyCards?.currentLoadRate)
        ? Math.max(0, Math.min(100, overview.energyCards.currentLoadRate))
        : 35
    },
    {
      layoutRole: "telemetry",
      name: "数据回传",
      value: runtimeReady(summary) ? "在线" : "待实时",
      status: runtimeReady(summary) ? "已接入" : "异常",
      tone: realTimeTone,
      note: `寄存器 ${formatInteger(counts.registerPoints, "--")} 点 · 设备 ${formatInteger(counts.deviceRows, "--")} 行`,
      progress: runtimeReady(summary) ? 100 : 35
    },
    {
      layoutRole: "cooling-pump",
      name: "冷却泵",
      value: formatCountRatio(counts.runningCoolingPumpCount, counts.coolingPumpCount),
      status: counts.runningCoolingPumpCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `均频 ${formatHz(signals.pumpFrequency?.coolingAvgHz)} · ΔT ${formatTemp(signals.coolingWater?.deltaTC)}`,
      progress: ratioProgress(counts.runningCoolingPumpCount, counts.coolingPumpCount)
    },
    {
      layoutRole: "cooling-tower",
      name: "冷却塔",
      value: formatCountRatio(towerCells.running, towerCells.total),
      unit: towerCells.total != null ? "组" : undefined,
      status: towerCells.running != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `风机 ${formatCountRatio(towerFans.running, towerFans.total)} · 均频 ${formatHz(signals.towerFrequency?.avgHz)}`,
      progress: ratioProgress(towerCells.running, towerCells.total)
    }
  ];
}

function buildRecommendations(summary: RuntimePointSummaryDto | null): Recommendation[] {
  const counts = summary?.counts || {};
  const signals = summary?.keySignals || {};
  const towerCells = getCoolingTowerCellStats(summary);
  const towerFans = getCoolingTowerFanStats(summary);
  const ready = runtimeReady(summary);

  return [
    {
      id: "tower-count",
      title: "冷却塔台数优化",
      current: ready
        ? `当前 ${formatCountRatio(towerCells.running, towerCells.total)}组，风机 ${formatCountRatio(towerFans.running, towerFans.total)}台，均频 ${formatHz(signals.towerFrequency?.avgHz)}`
        : "实时运行数待接入",
      advice: ready
        ? `结合湿球 ${formatTemp(signals.weather?.wetBulbC)} 复核出塔水温口径后，再生成台数/频率影子建议`
        : "先恢复冷却塔运行、频率和湿球实时值",
      benefit: "待模型评估",
      risk: "低",
      actionLabel: "查看",
      detail: "冷却塔建议必须同时满足湿球温度、冷却水出塔温度、最低冷凝温度、风机最低频率和加减塔延时。当前只做 shadow 评审，实时接通后仍需人工确认，不能自动下发 PLC。"
    },
    {
      id: "cooling-pump",
      title: "冷却泵频率复核",
      current: ready
        ? `当前 ${formatCountRatio(counts.runningCoolingPumpCount, counts.coolingPumpCount)}台，均频 ${formatHz(signals.pumpFrequency?.coolingAvgHz)}，温差 ${formatTemp(signals.coolingWater?.deltaTC)}`
        : "冷却泵频率反馈待实时接入",
      advice: ready
        ? "先用冷却水温差、主机冷凝压力和泵最低频率边界判断是否允许微调"
        : "先恢复冷却泵运行/频率反馈",
      benefit: "待模型评估",
      risk: "中",
      actionLabel: "查看",
      detail: "冷却泵优化不能只看频率，应同时校验冷却水流量、主机冷凝侧压差、冷却水温差和低频保护。AI只输出建议值，PLC负责最低频率、联锁和故障回退。"
    },
    {
      id: "chilled-pump",
      title: "冷冻泵频率微调",
      current: ready
        ? `当前 ${formatCountRatio(counts.runningChilledPumpCount, counts.chilledPumpCount)}台，均频 ${formatHz(signals.pumpFrequency?.chilledAvgHz)}，温差 ${formatTemp(signals.chilledWater?.deltaTC)}`
        : "冷冻泵频率反馈待实时接入",
      advice: ready
        ? "以末端压差、旁通阀和最不利末端温度为前置约束，再生成Hz修正"
        : "先恢复冷冻泵运行/频率反馈",
      benefit: "待模型评估",
      risk: "中",
      actionLabel: "查看",
      detail: "冷冻泵降频必须避免末端供冷不足和压差锯齿波。建议逻辑需要压差死区、变化率限制、最小保持时间和人工确认，不能仅凭平均频率直接下发。"
    }
  ];
}

function isWaitingForRealData(item: RuntimeSubsystemCapabilityDto): boolean {
  return isSubsystemWaitingForRealData(item);
}

function isDemoData(item: RuntimeSubsystemCapabilityDto): boolean {
  return isSubsystemDemoData(item);
}

function formatSubsystemStatus(item: RuntimeSubsystemCapabilityDto): string {
  return getSubsystemStatusPresentation(item).compactLabel;
}

function getSubsystemTone(item: RuntimeSubsystemCapabilityDto): Tone {
  const tone = getSubsystemStatusPresentation(item).tone;
  return tone === "neutral" ? "info" : tone;
}

function buildSubsystemAdvice(
  capabilities: RuntimeSubsystemCapabilityListDto | null,
  projectLabel: string
): SubsystemAdvice[] {
  const items = capabilities?.items || [];
  return items.map((item) => {
    const configEnabled = item.status === "enabled";
    const demoData = isDemoData(item);
    const waitingForData = isWaitingForRealData(item);
    const realDataReady = isSubsystemRealDataReady(item);
    const statusView = getSubsystemStatusPresentation(item);
    const sourceFault = statusView.kind === "stale" || statusView.kind === "error" || statusView.kind === "unknown";
    const reserved = item.reserved || item.status === "not_applicable";
    const boundaryMode = item.controlBoundary?.mode || "read_only";
    const advisorStatus = configEnabled ? item.advisorPluginStatus || "not_configured" : "不参与";
    return {
      id: item.subsystemType,
      name: item.displayName || item.subsystemType,
      statusLabel: formatSubsystemStatus(item),
      statusTone: getSubsystemTone(item),
      adviceLabel: realDataReady
        ? "可进入跨系统分析"
        : demoData
          ? "演示建议，不接入真实控制"
        : waitingForData
          ? "配置已发布，待现场数据"
        : sourceFault && configEnabled
          ? "数据状态异常，暂停建议"
        : reserved
          ? "预留，不参与"
          : "待点位映射",
      boundaryLabel: `${formatControlBoundaryMode(boundaryMode)} / ${item.controlBoundary?.writeEnabled ? "写入配置已开启" : "不写 PLC"}`,
      mappingLabel: configEnabled
        ? realDataReady
          ? `映射 ${item.pointMappingProgress || 0}%`
          : demoData
            ? `演示模板 ${item.pointMappingProgress || 0}%`
          : waitingForData
            ? `模板 ${item.pointMappingProgress || 0}%`
            : `映射 ${item.pointMappingProgress || 0}% · ${statusView.compactLabel}`
        : "不参与统计",
      detail: realDataReady
        ? `建议器${formatAdvisorStatus(advisorStatus)}，可作为 AI 建议输入；控制边界仍以配置中心发布版本为准。`
        : demoData
          ? `建议器${formatAdvisorStatus(advisorStatus)}只用于${projectLabel}演示；输出为只读建议，不代表真实现场数据，不触发 PLC 写入。`
        : waitingForData
          ? "已发布只读点位模板，但真实空压/子系统实时数据未接入；不生成实时 KPI、不参与节能统计，先完成 PLC/网关点位绑定。"
        : sourceFault && configEnabled
          ? `当前${statusView.detailLabel}；暂停实时 KPI、节能统计与 AI 建议，先恢复数据链路并复核时间戳。`
        : reserved
          ? "当前项目不适用，仅保留未来扩展入口，不计入运行 KPI 和建议数量。"
          : "当前未配置，不生成假 KPI、不推送节能建议；先在 3002 完成点位角色映射和发布。"
    };
  });
}

export default function AiOverviewPage() {
  const currentProject = getCurrentProject();
  const stationRuntimeScope = useStationRuntimeScope();
  const runtimeStationId = stationRuntimeScope.runtimeStationId;
  const siteId = currentProject?.siteId || runtimeConfig.siteId;
  const configSiteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const projectLabel = resolveAuthProjectDisplayName(currentProject, "当前项目");
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimePointSummaryDto | null>(null);
  const [capabilities, setCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string>("");

  useEffect(() => {
    setOverview(null);
    setRuntimeSummary(null);
    setCapabilities(null);
    setLoadError(null);
    setApprovedIds([]);
    setExpandedId("");
  }, [stationRuntimeScope.scopeKey]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function load() {
      if (!runtimeStationId) {
        void fetchSiteCapabilities(configSiteId)
          .then((capabilityResult) => {
            if (active) {
              setCapabilities(
                siteIdsEquivalent(capabilityResult.site?.siteId, configSiteId)
                  ? capabilityResult
                  : null
              );
            }
          })
          .catch(() => {
            if (active) {
              setCapabilities(null);
            }
          });
      }

      const runtimeSiteId = runtimeStationId
        ? stationRuntimeScope.runtimeBindingSiteId
        : siteId;
      if (!runtimeSiteId) {
        if (active) {
          setLoadError("站房运行绑定缺少数据源站点");
        }
        return;
      }

      const [overviewResult, runtimeResult] = await Promise.allSettled([
        runtimeStationId
          ? Promise.resolve(null)
          : currentProject
            ? fetchDashboardOverviewForProject(currentProject)
            : fetchDashboardOverview(siteId),
        fetchRuntimePointSummary(runtimeSiteId, { stationId: runtimeStationId })
      ]);

      if (!active) {
        return;
      }

      const overviewCandidate = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      const overviewScopeVerified = !overviewCandidate || siteIdsEquivalent(overviewCandidate.site?.siteId, siteId);
      const nextOverview = overviewScopeVerified ? overviewCandidate : null;
      const runtimeCandidate = runtimeResult.status === "fulfilled" ? runtimeResult.value : null;
      const runtimeSiteScopeVerified = !runtimeCandidate || siteIdsEquivalent(runtimeCandidate.site?.siteId, runtimeSiteId);
      const stationScopeVerified = runtimeSiteScopeVerified && (
        !runtimeStationId || isAppliedStationRuntimeScope(runtimeCandidate?.dataScope, stationRuntimeScope)
      );
      const nextRuntime = stationScopeVerified ? runtimeCandidate : null;
      setOverview(nextOverview);
      setRuntimeSummary(nextRuntime);

      if (!overviewScopeVerified) {
        setLoadError("能效总览未证明当前项目范围，已拒绝展示");
      } else if (!runtimeSiteScopeVerified) {
        setLoadError("实时摘要未证明当前数据源站点，已拒绝展示");
      } else if (runtimeStationId && !stationScopeVerified) {
        setLoadError("站房实时摘要未证明当前物理站房筛选，已拒绝展示");
      } else if (runtimeStationId && !nextRuntime) {
        setLoadError("站房实时摘要未回传");
      } else if (runtimeStationId) {
        setLoadError(null);
      } else if (!nextOverview && !nextRuntime) {
        setLoadError("实时链路暂不可用");
      } else if (!nextRuntime) {
        setLoadError("设备实时摘要未回传");
      } else if (!nextOverview) {
        setLoadError("能效总览未回传");
      } else {
        setLoadError(null);
      }

      timer = window.setTimeout(load, AI_OVERVIEW_REFRESH_MS);
    }

    void load();

    return () => {
      active = false;
      if (timer != null) {
        window.clearTimeout(timer);
      }
    };
  }, [
    configSiteId,
    runtimeStationId,
    siteId,
    stationRuntimeScope.runtimeBindingSiteId,
    stationRuntimeScope.scopeKey
  ]);

  const runtimeOnline = runtimeReady(runtimeSummary);
  const recommendations = useMemo(
    () => runtimeStationId && stationRuntimeScope.stationType !== "chilled_plant"
      ? []
      : buildRecommendations(runtimeSummary),
    [runtimeStationId, runtimeSummary, stationRuntimeScope.stationType]
  );
  const subsystemAdvice = useMemo(
    () => buildSubsystemAdvice(capabilities, projectLabel),
    [capabilities, projectLabel]
  );
  const enabledSubsystemCount = subsystemAdvice.filter((item) => item.statusLabel === "已接入").length;
  const demoSubsystemCount = subsystemAdvice.filter((item) => item.statusLabel === "演示数据").length;
  const waitingSubsystemCount = subsystemAdvice.filter((item) => item.statusLabel === "待接实时").length;
  const configurableSubsystemCount = subsystemAdvice.filter((item) => item.statusLabel === "未配置").length;
  const subsystemCapabilitySummary = capabilities
    ? `${enabledSubsystemCount} 实时接入 / ${demoSubsystemCount} 演示数据 / ${waitingSubsystemCount} 待接实时 / ${configurableSubsystemCount} 待配置`
    : "配置读取中";
  const pendingCount = runtimeOnline ? recommendations.length - approvedIds.length : 0;
  const primaryKpis = useMemo(
    () => [
      ...buildKpiCards(overview, runtimeSummary, projectLabel),
      {
        label: "待确认建议",
        value: runtimeOnline ? String(Math.max(0, pendingCount)) : "--",
        unit: runtimeOnline ? "条" : undefined,
        note: runtimeReady(runtimeSummary) ? "基于实时摘要的影子建议" : "等待实时摘要恢复",
        status: runtimeOnline ? (pendingCount > 0 ? "需处理" : "已收口") : "不可判定",
        tone: runtimeOnline && pendingCount === 0 ? "good" as const : "warn" as const
      }
    ],
    [overview, pendingCount, projectLabel, runtimeOnline, runtimeSummary]
  );
  const equipmentCards = useMemo(() => buildEquipmentCards(overview, runtimeSummary), [overview, runtimeSummary]);
  const chilledWater = runtimeSummary?.keySignals?.chilledWater;
  const coolingWater = runtimeSummary?.keySignals?.coolingWater;
  const weather = runtimeSummary?.keySignals?.weather;
  const copLabel = formatCop(overview?.energyCards?.currentCop);
  const generatedAt = runtimeSummary?.generatedAt || overview?.generatedAt || "";
  const stationScopeLabel = stationRuntimeScope.stationName || "当前物理站房";

  function toggleApprove(id: string) {
    if (!runtimeOnline) {
      return;
    }
    const wasApproved = approvedIds.includes(id);
    setApprovedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
    setExpandedId(wasApproved ? id : "");
  }

  return (
    <div className="ai-overview-page page-enter">
      <header className="ai-overview-header">
        <div>
          <span className="ai-overview-kicker">
            {runtimeStationId ? `${stationScopeLabel} · 站房运行摘要` : `${projectLabel} · 项目级 AI 节能建议`}
          </span>
          <h1>{runtimeStationId ? `${stationScopeLabel} AI只读建议` : "智慧冷冻站 AI优化总览"}</h1>
        </div>
        <div className="ai-overview-mode-row" aria-label="运行模式">
          <span className="ai-mode-chip warn"><Sparkles size={14} />影子建议模式</span>
          <span className="ai-mode-chip warn"><ShieldCheck size={14} />安全边界待站点确认</span>
          <span className={`ai-mode-chip ${runtimeOnline ? "good" : "warn"}`}>
            <Activity size={14} />{runtimeOnline ? "实时寄存器在线" : "实时摘要待恢复"}
          </span>
          {runtimeStationId ? (
            <span className={`ai-mode-chip ${runtimeSummary ? "good" : "warn"}`}>
              <ShieldCheck size={14} />
              {runtimeSummary
                ? `站房筛选已验证 · v${stationRuntimeScope.bindingVersion ?? "-"}`
                : "站房筛选待验证"}
            </span>
          ) : null}
          <span className="ai-mode-chip">人工确认仅形成评审记录</span>
        </div>
      </header>

      <section className="ai-kpi-strip" aria-label="关键指标">
        {primaryKpis.map((item) => (
          <article className={`ai-kpi-card tone-${item.tone}`} key={item.label}>
            <div className="ai-card-label">
              <span>{item.label}</span>
              <em>{item.status}</em>
            </div>
            <strong>
              {item.value}
              {item.unit ? <small>{item.unit}</small> : null}
            </strong>
            <p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="ai-overview-main">
        <div className="ai-plant-panel">
          <div className="ai-panel-title">
            <h3>{runtimeStationId ? `${stationScopeLabel}设备链路与运行状态` : "当前项目冷站设备链路与运行状态"}</h3>
            <span>{loadError || (generatedAt ? `实时摘要 ${new Date(generatedAt).toLocaleTimeString("zh-CN", { hour12: false })}` : "冷冻水环路 / 冷却水环路 / 数据回传链路")}</span>
          </div>
          <div className="ai-plant-network" aria-label="冷站设备链路">
            <div className="ai-flow ai-flow-chilled" />
            <div className="ai-flow ai-flow-cooling" />
            <div className="ai-flow ai-flow-data" />
            <div className="ai-water-pill ai-water-pill-left">
              <Snowflake size={15} />
              冷冻侧 ΔT <strong>{formatTemp(chilledWater?.deltaTC)}</strong> · {formatTemp(chilledWater?.supplyTempC)} / {formatTemp(chilledWater?.returnTempC)}
            </div>
            <div className="ai-water-pill ai-water-pill-right">
              <Waves size={15} />
              冷却侧 ΔT <strong>{formatTemp(coolingWater?.deltaTC)}</strong> · 湿球 {formatTemp(weather?.wetBulbC)}
            </div>
            {equipmentCards.map((item) => (
              <article className={`ai-equipment-card equipment-${item.layoutRole} tone-${item.tone}`} key={item.name}>
                <div className="ai-equipment-head">
                  <span>{item.name}</span>
                  <em>{item.status}</em>
                </div>
                <strong>
                  {item.value}
                  {item.unit ? <small>{item.unit}</small> : null}
                </strong>
                <div className="ai-progress" aria-hidden="true">
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="ai-rec-panel">
          <div className="ai-panel-title">
            <h3>AI优化建议队列</h3>
            <span>{runtimeOnline ? "实时摘要驱动" : "等待实时摘要"}</span>
          </div>
          <div className="ai-shadow-card">
            <div>
              <strong>影子建议模式</strong>
              <p>AI只建议不接管，PLC保留低温、防冻、启停间隔等硬保护。</p>
            </div>
          </div>
          <div className="ai-subsystem-advice-panel" aria-label={runtimeStationId ? "站房AI范围" : "跨系统AI建议中心"}>
            <div className="ai-subsystem-advice-title">
              <strong>{runtimeStationId ? "当前站房 AI 范围" : "跨系统 AI 建议中心"}</strong>
              <span>{runtimeStationId ? "不混入项目级或其他站房数据" : subsystemCapabilitySummary}</span>
            </div>
            <div className="ai-subsystem-advice-grid">
              {runtimeStationId ? (
                <article className={`ai-subsystem-advice-card tone-${runtimeSummary ? "good" : "warn"}`}>
                  <div className="ai-subsystem-advice-head">
                    <strong>{stationScopeLabel}</strong>
                    <span>{runtimeSummary ? "筛选已验证" : "等待证据"}</span>
                  </div>
                  <div className="ai-subsystem-advice-meta">
                    <em>绑定版本 v{stationRuntimeScope.bindingVersion ?? "-"}</em>
                    <em>只读影子建议</em>
                  </div>
                  <p>当前仅使用站房运行摘要；项目 COP、项目告警和跨系统能力不会作为该站房建议输入。</p>
                </article>
              ) : subsystemAdvice.map((item) => (
                <article className={`ai-subsystem-advice-card tone-${item.statusTone}`} key={item.id}>
                  <div className="ai-subsystem-advice-head">
                    <strong>{item.name}</strong>
                    <span>{item.statusLabel}</span>
                  </div>
                  <div className="ai-subsystem-advice-meta">
                    <em>{item.adviceLabel}</em>
                    <em>{item.mappingLabel}</em>
                  </div>
                  <p>{item.boundaryLabel}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="ai-rec-list">
            {!runtimeOnline ? (
              <div className="ai-rec-unavailable" role="status">
                <strong>暂无可评审的 AI 优化建议</strong>
                <p>先恢复实时摘要、关键点位质量和站点控制边界；数据未确认前不生成收益、风险或批准状态。</p>
              </div>
            ) : recommendations.map((item) => {
              const isApproved = approvedIds.includes(item.id);
              const isExpanded = expandedId === item.id;
              return (
                <article className={`ai-rec-row${isApproved ? " is-approved" : ""}`} key={item.id}>
                  <button
                    type="button"
                    className="ai-rec-main"
                    onClick={() => setExpandedId(isExpanded ? "" : item.id)}
                    aria-expanded={isExpanded}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>{isApproved ? "已确认" : "待确认"}</small>
                    </span>
                    <p>{item.current}，{item.advice}。</p>
                  </button>
                  <div className="ai-rec-metrics">
                    <span><small>预计收益</small><b>{item.benefit}</b></span>
                    <span><small>风险</small><b>{item.risk}</b></span>
                    <button type="button" onClick={() => toggleApprove(item.id)}>
                      {isApproved ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
                      {isApproved ? "撤回" : item.actionLabel}
                    </button>
                  </div>
                  {isExpanded ? <p className="ai-rec-detail">{item.detail}</p> : null}
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="ai-bottom-grid">
        <article className="ai-chart-card">
          <div className="ai-panel-title">
            <h3>系统COP趋势</h3>
            <span>当前 {copLabel} · 趋势待时序数据</span>
          </div>
          <div className="ai-chart-unavailable" role="status">
            <strong>趋势数据待接入</strong>
            <p>当前仅有摘要值，不能绘制上升或下降趋势；接入带时间戳的 COP 序列后再展示实际曲线与基线。</p>
          </div>
        </article>

        <article className="ai-constraint-panel">
          <div className="ai-panel-title">
            <h3>约束边界与回退条件</h3>
            <span>PLC硬保护优先</span>
          </div>
          <div className="ai-constraint-grid">
            <span><ShieldCheck size={14} /><b>最低冷冻出水温度</b></span>
            <span><Gauge size={14} /><b>冷机最小运行时间</b></span>
            <span><TriangleAlert size={14} /><b>冷却塔防振荡死区</b></span>
            <span><Activity size={14} /><b>异常告警自动回退</b></span>
          </div>
        </article>

        <article className="ai-audit-panel">
          <div className="ai-panel-title">
            <h3>复核与审计</h3>
            <span>进入建议复核</span>
          </div>
          <div className="ai-audit-copy">
            规则触发、数据质量、约束与验证记录集中复核。
          </div>
        </article>
      </section>
    </div>
  );
}

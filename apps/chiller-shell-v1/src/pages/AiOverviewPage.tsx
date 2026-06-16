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
  fetchDashboardOverview,
  fetchRuntimePointSummary,
  type DashboardOverviewDto,
  type RuntimePointSummaryDto
} from "../services/bffClient";

type Tone = "good" | "warn" | "info";

type KpiCard = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  status: string;
  tone: Tone;
};

type EquipmentCard = {
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

function buildKpiCards(overview: DashboardOverviewDto | null, summary: RuntimePointSummaryDto | null): KpiCard[] {
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
        : "B25实时寄存器待恢复",
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
      name: "冷机",
      value: formatCountRatio(counts.runningChillerCount, counts.chillerCount),
      status: counts.runningChillerCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `运行组合 ${formatRunningIds(activeChillerIds, "待实时")}`,
      progress: ratioProgress(counts.runningChillerCount, counts.chillerCount)
    },
    {
      name: "冷冻泵",
      value: formatCountRatio(counts.runningChilledPumpCount, counts.chilledPumpCount),
      status: counts.runningChilledPumpCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `均频 ${formatHz(signals.pumpFrequency?.chilledAvgHz)} · ΔT ${formatTemp(signals.chilledWater?.deltaTC)}`,
      progress: ratioProgress(counts.runningChilledPumpCount, counts.chilledPumpCount)
    },
    {
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
      name: "数据回传",
      value: runtimeReady(summary) ? "在线" : "待实时",
      status: runtimeReady(summary) ? "已接入" : "异常",
      tone: realTimeTone,
      note: `寄存器 ${formatInteger(counts.registerPoints, "--")} 点 · 设备 ${formatInteger(counts.deviceRows, "--")} 行`,
      progress: runtimeReady(summary) ? 100 : 35
    },
    {
      name: "冷却泵",
      value: formatCountRatio(counts.runningCoolingPumpCount, counts.coolingPumpCount),
      status: counts.runningCoolingPumpCount != null ? "运行" : "待实时",
      tone: realTimeTone,
      note: `均频 ${formatHz(signals.pumpFrequency?.coolingAvgHz)} · ΔT ${formatTemp(signals.coolingWater?.deltaTC)}`,
      progress: ratioProgress(counts.runningCoolingPumpCount, counts.coolingPumpCount)
    },
    {
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

export default function AiOverviewPage() {
  const siteId = runtimeConfig.siteId;
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimePointSummaryDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string>("");

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function load() {
      const [overviewResult, runtimeResult] = await Promise.allSettled([
        fetchDashboardOverview(siteId),
        fetchRuntimePointSummary(siteId)
      ]);

      if (!active) {
        return;
      }

      const nextOverview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      const nextRuntime = runtimeResult.status === "fulfilled" ? runtimeResult.value : null;
      setOverview(nextOverview);
      setRuntimeSummary(nextRuntime);

      if (!nextOverview && !nextRuntime) {
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
  }, [siteId]);

  const recommendations = useMemo(() => buildRecommendations(runtimeSummary), [runtimeSummary]);
  const pendingCount = recommendations.length - approvedIds.length;
  const primaryKpis = useMemo(
    () => [
      ...buildKpiCards(overview, runtimeSummary),
      {
        label: "待确认建议",
        value: String(Math.max(0, pendingCount)),
        unit: "条",
        note: runtimeReady(runtimeSummary) ? "基于实时摘要的影子建议" : "等待实时摘要恢复",
        status: pendingCount > 0 ? "需处理" : "已收口",
        tone: pendingCount > 0 ? "warn" as const : "good" as const
      }
    ],
    [overview, pendingCount, runtimeSummary]
  );
  const equipmentCards = useMemo(() => buildEquipmentCards(overview, runtimeSummary), [overview, runtimeSummary]);
  const runtimeOnline = runtimeReady(runtimeSummary);
  const chilledWater = runtimeSummary?.keySignals?.chilledWater;
  const coolingWater = runtimeSummary?.keySignals?.coolingWater;
  const weather = runtimeSummary?.keySignals?.weather;
  const copLabel = formatCop(overview?.energyCards?.currentCop);
  const generatedAt = runtimeSummary?.generatedAt || overview?.generatedAt || "";

  function toggleApprove(id: string) {
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
          <span className="ai-overview-kicker">B25 中央空调能源站 · AI节能控制演示</span>
          <h2>智慧冷冻站 AI优化总览</h2>
        </div>
        <div className="ai-overview-mode-row" aria-label="运行模式">
          <span className="ai-mode-chip warn"><Sparkles size={14} />影子建议模式</span>
          <span className="ai-mode-chip good"><ShieldCheck size={14} />PLC安全边界在线</span>
          <span className={`ai-mode-chip ${runtimeOnline ? "good" : "warn"}`}>
            <Activity size={14} />{runtimeOnline ? "实时寄存器在线" : "实时摘要待恢复"}
          </span>
          <span className="ai-mode-chip">人工确认后下发</span>
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
            <h3>冷站设备链路与运行状态</h3>
            <span>{loadError || (generatedAt ? `实时摘要 ${new Date(generatedAt).toLocaleTimeString("zh-CN", { hour12: false })}` : "冷冻水环路 / 冷却水环路 / 数据回传链路")}</span>
          </div>
          <div className="ai-plant-network" aria-label="冷站设备链路">
            <div className="ai-flow ai-flow-chilled" />
            <div className="ai-flow ai-flow-cooling" />
            <div className="ai-flow ai-flow-data" />
            <div className="ai-water-pill ai-water-pill-left">
              <Snowflake size={15} />
              冷冻供/回 <strong>{formatTemp(chilledWater?.supplyTempC)} / {formatTemp(chilledWater?.returnTempC)}</strong> · ΔT {formatTemp(chilledWater?.deltaTC)}
            </div>
            <div className="ai-water-pill ai-water-pill-right">
              <Waves size={15} />
              冷却侧温差 <strong>{formatTemp(coolingWater?.deltaTC)}</strong> · 湿球 {formatTemp(weather?.wetBulbC)}
            </div>
            {equipmentCards.map((item, index) => (
              <article className={`ai-equipment-card equipment-${index} tone-${item.tone}`} key={item.name}>
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
          <div className="ai-rec-list">
            {recommendations.map((item) => {
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
            <span>当前 {copLabel} · 目标待模型复核</span>
          </div>
          <svg className="ai-line-chart" viewBox="0 0 420 116" preserveAspectRatio="none" aria-label="系统COP趋势">
            <path d="M0 88 L60 78 L120 80 L180 66 L240 58 L300 52 L360 42 L420 37" />
            <path className="baseline" d="M0 96 L60 92 L120 91 L180 83 L240 76 L300 74 L360 70 L420 68" />
            <circle cx="420" cy="37" r="5" />
          </svg>
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

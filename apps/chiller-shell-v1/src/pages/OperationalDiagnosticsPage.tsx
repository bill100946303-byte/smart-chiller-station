import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { getAuthSession, getCurrentProject } from "../services/auth";
import { postOptimizeDraft, type OptimizeDraftDetailsDto, type OptimizeDraftResponseDto } from "../services/bffClient";

type DiagnosticTone = "good" | "warn" | "danger" | "neutral";

type DiagnosticEvidence = {
  key?: string;
  label?: string;
  value?: number | string | null;
  unit?: string | null;
};

type DiagnosticReadinessItem = {
  key?: string;
  title?: string;
  tier?: string;
  status?: string;
  currentFeasibility?: string;
  firstVersionOutput?: string;
  availableData?: string[];
  missingData?: string[];
  boundary?: string;
  allowedMode?: string;
  confidence?: string;
};

type FieldReviewTask = {
  key?: string;
  priority?: string;
  title?: string;
  sourceDiagnosticKey?: string;
  sourceTier?: string;
  verificationTarget?: string;
  requiredEvidence?: string[];
  reason?: string;
  missingData?: string[];
  acceptanceCriteria?: string;
  boundary?: string;
  ownerRole?: string;
};

type DiagnosticItem = {
  key?: string;
  title?: string;
  status?: string;
  confidence?: string;
  current?: Record<string, unknown>;
  findings?: string[];
  blockers?: string[];
  warnings?: string[];
  evidence?: DiagnosticEvidence[];
  suggestions?: string[];
};

type PriorityAction = {
  key: string;
  priority: "P0" | "P1";
  title: string;
};

type ExecutiveConclusion = {
  tone: DiagnosticTone;
  title: string;
  detail: string;
};

type OperationalDiagnosticsAdvisor = {
  status?: string;
  executionMode?: string;
  basis?: string;
  summary?: {
    readyCount?: number | null;
    partialCount?: number | null;
    unavailableCount?: number | null;
    blockerCount?: number | null;
    warningCount?: number | null;
    gateLevel?: string | null;
    pointDictionary?: {
      applied?: boolean | null;
      source?: string | null;
    };
    pointCoverage?: Record<string, number | string | null | undefined>;
    diagnosticReadinessMatrix?: {
      total?: number | null;
      readyNowCount?: number | null;
      directionalCount?: number | null;
      pointGapCount?: number | null;
      boundaryNotes?: string[];
      items?: DiagnosticReadinessItem[];
    };
    fieldVerificationChecklist?: {
      total?: number | null;
      p0Count?: number | null;
      p1Count?: number | null;
      controlBoundary?: string | null;
      items?: FieldReviewTask[];
    };
    fieldCollectionPackageEvidence?: {
      status?: string;
      finalDecision?: string;
      readyToCollect?: boolean | null;
      formalInputCount?: number | null;
      missingFormalInputCount?: number | null;
      templateCount?: number | null;
      reportPath?: string | null;
      controlBoundary?: string | null;
    };
  };
  items?: DiagnosticItem[];
  disclaimers?: string[];
};

type DraftWithOperationalDiagnostics = OptimizeDraftDetailsDto & {
  operationalDiagnosticsAdvisor?: OperationalDiagnosticsAdvisor;
};

const DEFAULT_LOAD_KW = 1200;
const DEFAULT_WET_BULB_C = 32.5;

const DIAGNOSTIC_ORDER = [
  "instrumentDataQuality",
  "chilledHydraulicBalance",
  "controlOscillation",
  "lowDeltaTRootCause",
  "coolingTowerCapability",
  "chillerHealthCombination"
];

const ACTION_BY_DIAGNOSTIC_KEY: Record<string, PriorityAction> = {
  instrumentDataQuality: {
    key: "instrumentDataQuality",
    priority: "P0",
    title: "核对冷量、总功率和 COP 口径，先排除仪表偏移。"
  },
  chilledHydraulicBalance: {
    key: "chilledHydraulicBalance",
    priority: "P0",
    title: "复核支路流量、支路回水温度和总管压差，确认水力失衡范围。"
  },
  controlOscillation: {
    key: "controlOscillation",
    priority: "P1",
    title: "补齐命令/反馈高频趋势，再判断 PID、死区和启停延时。"
  },
  lowDeltaTRootCause: {
    key: "lowDeltaTRootCause",
    priority: "P1",
    title: "末端不缺冷时，只做冷冻泵小步降频 shadow 验证。"
  },
  coolingTowerCapability: {
    key: "coolingTowerCapability",
    priority: "P0",
    title: "校验湿球温度与冷却水温点位，解除冷却塔能力诊断阻断。"
  },
  chillerHealthCombination: {
    key: "chillerHealthCombination",
    priority: "P1",
    title: "继续积累同负荷/相近湿球的主机组合样本，不计算多机单台 COP。"
  }
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "待补值";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatOptionalValue(value: unknown, unit?: unknown): string {
  const normalizedUnit = typeof unit === "string" && unit.trim() ? ` ${unit.trim()}` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${formatNumber(value, Math.abs(value) >= 100 ? 0 : 1)}${normalizedUnit}`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "待补值";
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item != null && typeof item === "object" && !Array.isArray(item))
    : [];
}

function dedupeText(items: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  items.forEach((item) => {
    const next = item?.trim();
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    output.push(next);
  });
  return output;
}

function localizeStatus(status: string | undefined): string {
  if (status === "ready") {
    return "诊断可用";
  }
  if (status === "partial") {
    return "仅审阅";
  }
  if (status === "unavailable") {
    return "信号不足";
  }
  if (status === "active") {
    return "风险成立";
  }
  if (status === "watch") {
    return "观察";
  }
  if (status === "normal") {
    return "未触发";
  }
  if (status === "gap") {
    return "缺口";
  }
  if (status === "review") {
    return "待复核";
  }
  if (status === "insufficient" || status === "unknown") {
    return "证据不足";
  }
  return status?.trim() || "待确认";
}

function localizeMode(mode: string | undefined): string {
  if (mode === "read_only") {
    return "只读诊断";
  }
  if (mode === "shadow_review") {
    return "shadow审阅";
  }
  if (mode === "point_plan") {
    return "补点计划";
  }
  return mode?.trim() || "只读诊断";
}

function localizeFeasibility(value: string | undefined): string {
  if (value === "can_do_v1") {
    return "可做 V1";
  }
  if (value === "directional_review") {
    return "只能疑似判断";
  }
  if (value === "point_gap") {
    return "暂不能做";
  }
  return value?.trim() || "待评估";
}

function statusTone(status: string | undefined): DiagnosticTone {
  if (status === "ready" || status === "normal") {
    return "good";
  }
  if (status === "active" || status === "blocked") {
    return "danger";
  }
  if (status === "partial" || status === "gap" || status === "review" || status === "waiting") {
    return "warn";
  }
  return "neutral";
}

function confidenceLabel(value: string | undefined): string {
  if (value === "high") {
    return "高置信";
  }
  if (value === "medium") {
    return "中置信";
  }
  if (value === "low") {
    return "低置信";
  }
  return value?.trim() || "待评估";
}

function summarizeItem(item: DiagnosticItem): string {
  return (
    item.blockers?.[0] ||
    item.warnings?.[0] ||
    item.findings?.[0] ||
    item.suggestions?.[0] ||
    "等待诊断证据。"
  );
}

function buildExecutiveConclusion(
  advisor: OperationalDiagnosticsAdvisor | undefined,
  summary: OperationalDiagnosticsAdvisor["summary"] | undefined,
  items: DiagnosticItem[]
): ExecutiveConclusion {
  if (!advisor) {
    return {
      tone: "neutral",
      title: "正在读取运行诊断",
      detail: "等待实时数据和历史样本返回。"
    };
  }

  const blockerCount =
    toFiniteNumber(summary?.blockerCount) ??
    items.reduce((total, item) => total + (Array.isArray(item.blockers) ? item.blockers.length : 0), 0);
  const partialCount = toFiniteNumber(summary?.partialCount) ?? 0;
  const firstBlocker = dedupeText(items.flatMap((item) => item.blockers || []))[0];
  const firstWarning = dedupeText(items.flatMap((item) => item.warnings || []))[0];

  if (blockerCount > 0) {
    return {
      tone: "danger",
      title: `先处理 ${formatNumber(blockerCount, 0)} 个阻断，再做优化验证`,
      detail: firstBlocker || "存在阻断项，当前只保留审阅和现场复核。"
    };
  }

  if (advisor?.status === "unavailable") {
    return {
      tone: "danger",
      title: "数据不足，暂不输出优化建议",
      detail: firstWarning || "关键点位缺失，当前只适合补点和台账核对。"
    };
  }

  if (partialCount > 0 || advisor?.status === "partial") {
    return {
      tone: "warn",
      title: `可做只读诊断，${formatNumber(partialCount, 0)} 项降级`,
      detail: firstWarning || "建议先完成 P0 现场复核，再进入 shadow 对比。"
    };
  }

  return {
    tone: "good",
    title: "可进入 shadow 验证",
    detail: "未发现硬阻断，按优先级执行现场复核和短时对比。"
  };
}

function collectTopRisks(items: DiagnosticItem[]) {
  const blockers = dedupeText(items.flatMap((item) => item.blockers || [])).slice(0, 3);
  const warnings = dedupeText(items.flatMap((item) => item.warnings || []))
    .filter((warning) => !blockers.includes(warning))
    .slice(0, 3);
  return { blockers, warnings };
}

function buildPriorityActions(items: DiagnosticItem[]): PriorityAction[] {
  const presentKeys = new Set(items.map((item) => item.key).filter((key): key is string => Boolean(key)));
  const actions = Object.values(ACTION_BY_DIAGNOSTIC_KEY).filter((action) => presentKeys.has(action.key));
  return actions
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority === "P0" ? -1 : 1;
      }
      return DIAGNOSTIC_ORDER.indexOf(left.key) - DIAGNOSTIC_ORDER.indexOf(right.key);
    })
    .slice(0, 5);
}

function resolveActiveSiteId(): string {
  const currentProject = getCurrentProject(getAuthSession());
  return currentProject?.siteId || runtimeConfig.siteId || "140";
}

function readDraftDetails(response: OptimizeDraftResponseDto): DraftWithOperationalDiagnostics | null {
  const details = response.details || response.details;
  if (!details || Array.isArray(details)) {
    return null;
  }
  return details as DraftWithOperationalDiagnostics;
}

function renderTextList(
  items: string[],
  emptyText: string,
  options: { limit?: number; emptyAsNull?: boolean } = {}
) {
  const cleaned = dedupeText(items);
  if (!cleaned.length) {
    return options.emptyAsNull ? null : <p className="operational-diagnostics-empty">{emptyText}</p>;
  }
  const limit = options.limit ?? cleaned.length;
  const visibleItems = cleaned.slice(0, limit);
  const remaining = cleaned.length - visibleItems.length;
  return (
    <ul className="operational-diagnostics-list">
      {visibleItems.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
      {remaining > 0 ? <li className="operational-diagnostics-more">另 {remaining} 项</li> : null}
    </ul>
  );
}

function renderRecordCards(records: Array<Record<string, unknown>>, emptyText: string, limit = 3) {
  if (!records.length) {
    return emptyText ? <p className="operational-diagnostics-empty">{emptyText}</p> : null;
  }
  const visibleRecords = records.slice(0, limit);
  const remaining = records.length - visibleRecords.length;
  return (
    <div className="operational-diagnostics-record-grid">
      {visibleRecords.map((record, index) => {
        const label =
          typeof record.label === "string" && record.label.trim()
            ? record.label
            : typeof record.title === "string" && record.title.trim()
              ? record.title
              : `记录 ${index + 1}`;
        const status = typeof record.status === "string" ? record.status : undefined;
        const reason = typeof record.reason === "string" ? record.reason : typeof record.evidence === "string" ? record.evidence : "";
        const target = typeof record.reviewTarget === "string" ? record.reviewTarget : "";
        const trigger = typeof record.trigger === "string" ? record.trigger : "";
        const requiredEvidence = asTextArray(record.requiredEvidence);
        const evidence = asTextArray(record.evidence);
        return (
          <article className="operational-diagnostics-record-card" key={`${label}-${index}`}>
            <div className="operational-diagnostics-record-head">
              <strong>{label}</strong>
              <StatusPill label={localizeStatus(status)} tone={statusTone(status)} />
            </div>
            <span>{formatOptionalValue(record.value, record.unit)}</span>
            {reason ? <p>{reason}</p> : null}
            {target ? <small>复核对象：{target}</small> : null}
            {trigger ? <small>触发：{trigger}</small> : null}
            {evidence.length ? <small>证据：{evidence.slice(0, 3).join(" / ")}</small> : null}
            {requiredEvidence.length ? <small>需补：{requiredEvidence.slice(0, 3).join(" / ")}</small> : null}
          </article>
        );
      })}
      {remaining > 0 ? (
        <article className="operational-diagnostics-record-card is-more">
          <strong>另 {remaining} 项</strong>
          <p>进入现场复核清单统一处理。</p>
        </article>
      ) : null}
    </div>
  );
}

function renderDiagnosticItem(item: DiagnosticItem) {
  const current = item.current || {};
  const crossChecks = asRecordArray(current.crossChecks);
  const driftCandidates = asRecordArray(current.driftCandidates);
  const riskIndicators = asRecordArray(current.riskIndicators);
  const fieldTargets = asRecordArray(current.fieldReviewTargets);
  const ledgerEvidence = current.ledgerEvidence as Record<string, unknown> | undefined;
  const sensorLedgerEvidence = current.sensorLedgerEvidence as Record<string, unknown> | undefined;
  const trendWindow = current.trendWindow as Record<string, unknown> | undefined;

  return (
    <SectionCard
      key={item.key || item.title}
      title={item.title || "诊断项"}
      action={
        <div className="operational-diagnostics-actions-inline">
          <StatusPill label={localizeStatus(item.status)} tone={statusTone(item.status)} />
          <StatusPill label={confidenceLabel(item.confidence)} tone={item.confidence === "high" ? "good" : "warn"} />
        </div>
      }
    >
      <div className="operational-diagnostics-item">
        <div className="operational-diagnostics-item-summary">
          <strong>结论</strong>
          <p>{summarizeItem(item)}</p>
        </div>

        <div className="operational-diagnostics-metric-row">
          {(item.evidence || []).slice(0, 4).map((evidence, index) => (
            <article className="operational-diagnostics-metric" key={evidence.key || evidence.label || index}>
              <span>{evidence.label || evidence.key || "证据"}</span>
              <strong>{formatOptionalValue(evidence.value, evidence.unit)}</strong>
            </article>
          ))}
        </div>

        <div className="operational-diagnostics-detail-grid">
          <article className={item.blockers?.length ? "is-danger" : ""}>
            <h4>阻断</h4>
            {renderTextList(item.blockers || [], "无阻断", { limit: 2 })}
          </article>
          <article className={item.warnings?.length ? "is-warn" : ""}>
            <h4>风险</h4>
            {renderTextList(item.warnings || [], "无明显风险", { limit: 2 })}
          </article>
          <article className="is-action">
            <h4>下一步</h4>
            {renderTextList(item.suggestions || [], "保持观察", { limit: 2 })}
          </article>
          <article>
            <h4>关键证据</h4>
            {renderTextList(item.findings || [], "等待证据", { limit: 2 })}
          </article>
        </div>

        {trendWindow ? (
          <div className="operational-diagnostics-ledger">
            <strong>趋势窗口</strong>
            <span>状态：{localizeStatus(typeof trendWindow.status === "string" ? trendWindow.status : undefined)}</span>
            {typeof trendWindow.reason === "string" ? <span>{trendWindow.reason}</span> : null}
            {typeof trendWindow.sampleCount === "number" ? <span>样本：{formatNumber(trendWindow.sampleCount)}</span> : null}
          </div>
        ) : null}

        {ledgerEvidence || sensorLedgerEvidence ? (
          <div className="operational-diagnostics-ledger">
            <strong>台账/预检证据</strong>
            {ledgerEvidence ? (
              <>
                <span>控制台账：{localizeStatus(String(ledgerEvidence.status || ledgerEvidence.importStatus || "待确认"))}</span>
                <span>可用于诊断：{ledgerEvidence.usableForDiagnosis ? "是" : "否"}</span>
                <span>接受行数：{formatNumber(toFiniteNumber(ledgerEvidence.acceptedRows), 0)} / {formatNumber(toFiniteNumber(ledgerEvidence.totalRows), 0)}</span>
              </>
            ) : null}
            {sensorLedgerEvidence ? (
              <>
                <span>传感器台账：{localizeStatus(String(sensorLedgerEvidence.status || sensorLedgerEvidence.finalDecision || "待确认"))}</span>
                <span>可复核：{sensorLedgerEvidence.readyForReview ? "是" : "否"}</span>
                <span>接受行数：{formatNumber(toFiniteNumber(sensorLedgerEvidence.acceptedRows), 0)} / {formatNumber(toFiniteNumber(sensorLedgerEvidence.totalRows), 0)}</span>
              </>
            ) : null}
          </div>
        ) : null}

        {fieldTargets.length ? (
          <div className="operational-diagnostics-review-targets">
            <strong>现场复核</strong>
            {renderRecordCards(fieldTargets, "", 2)}
          </div>
        ) : null}
        {riskIndicators.length && !fieldTargets.length ? renderRecordCards(riskIndicators, "", 2) : null}
        {driftCandidates.length && !fieldTargets.length ? renderRecordCards(driftCandidates, "", 2) : null}
        {crossChecks.length && !fieldTargets.length ? renderRecordCards(crossChecks, "", 2) : null}
      </div>
    </SectionCard>
  );
}

export default function OperationalDiagnosticsPage() {
  const activeSiteId = resolveActiveSiteId();
  const [details, setDetails] = useState<DraftWithOperationalDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  async function loadDiagnostics() {
    setLoading(true);
    setError(null);
    try {
      const response = await postOptimizeDraft(activeSiteId, {
        context: { siteId: activeSiteId },
        inputs: {
          loadKw: DEFAULT_LOAD_KW,
          loadSource: "scenario",
          outdoorTempC: DEFAULT_WET_BULB_C,
          mode: "cooling"
        }
      });
      const nextDetails = readDraftDetails(response);
      setDetails(nextDetails);
      setLoadedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "运行诊断加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    postOptimizeDraft(activeSiteId, {
      context: { siteId: activeSiteId },
        inputs: {
          loadKw: DEFAULT_LOAD_KW,
          loadSource: "scenario",
          outdoorTempC: DEFAULT_WET_BULB_C,
          mode: "cooling"
        }
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setDetails(readDraftDetails(response));
        setLoadedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "运行诊断加载失败。");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSiteId]);

  const advisor = details?.operationalDiagnosticsAdvisor;
  const hasAdvisor = Boolean(advisor);
  const summary = advisor?.summary;
  const coverage = summary?.pointCoverage || {};
  const readinessMatrix = summary?.diagnosticReadinessMatrix;
  const fieldChecklist = summary?.fieldVerificationChecklist;
  const collectionPackage = summary?.fieldCollectionPackageEvidence;
  const orderedItems = useMemo(() => {
    const items = Array.isArray(advisor?.items) ? advisor.items : [];
    return items.slice().sort((left, right) => {
      const leftIndex = DIAGNOSTIC_ORDER.indexOf(left.key || "");
      const rightIndex = DIAGNOSTIC_ORDER.indexOf(right.key || "");
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
  }, [advisor?.items]);
  const conclusion = useMemo(() => buildExecutiveConclusion(advisor, summary, orderedItems), [advisor, orderedItems, summary]);
  const topRisks = useMemo(() => collectTopRisks(orderedItems), [orderedItems]);
  const priorityActions = useMemo(() => buildPriorityActions(orderedItems), [orderedItems]);
  const primaryAction = priorityActions[0];
  const followUpActions = priorityActions.slice(1);

  const optimizeHref = `/optimize-demo?siteId=${encodeURIComponent(activeSiteId)}`;

  return (
    <div className="operational-diagnostics-page">
      <header className="operational-diagnostics-hero subpage-command-board">
        <div className="operational-diagnostics-hero-copy subpage-command-copy">
          <span>站点 {activeSiteId} / 只读诊断</span>
          <h2>工程诊断结论</h2>
          <p>{conclusion.title}</p>
        </div>
        <div className="operational-diagnostics-hero-actions subpage-command-side">
          <StatusPill label={localizeStatus(advisor?.status)} tone={statusTone(advisor?.status)} />
          <StatusPill label={localizeMode(advisor?.executionMode)} tone="warn" />
          <button type="button" onClick={loadDiagnostics} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            {loading ? "刷新中..." : "刷新诊断"}
          </button>
          <Link to={optimizeHref}>
            <ArrowLeft size={14} aria-hidden="true" />
            返回优化建议
          </Link>
        </div>
      </header>

      {error ? (
        <section className="operational-diagnostics-error" role="alert">
          <strong>运行诊断加载失败</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section className={`operational-diagnostics-decision-board is-${conclusion.tone}`} aria-label="工程诊断结论">
        <article className="operational-diagnostics-conclusion-card">
          <span>当前结论</span>
          <strong>{conclusion.title}</strong>
          <p>{conclusion.detail}</p>
          {loadedAt ? <small>刷新：{loadedAt}</small> : null}
        </article>
        <article className="operational-diagnostics-action-card">
          <div>
            <span>优先动作</span>
            <strong>{primaryAction ? `${primaryAction.priority}｜${primaryAction.title}` : "等待诊断数据"}</strong>
          </div>
          <ol className="operational-diagnostics-action-list">
            {followUpActions.length ? (
              followUpActions.map((action) => (
                <li className={`is-${action.priority.toLowerCase()}`} key={action.key}>
                  <em>{action.priority}</em>
                  <span>{action.title}</span>
                </li>
              ))
            ) : primaryAction ? (
              <li className="is-confirm">
                <em>确认</em>
                <span>完成首项后刷新诊断，复核阻断/风险是否解除。</span>
              </li>
            ) : (
              <li className="is-confirm">
                <em>--</em>
                <span>等待诊断数据。</span>
              </li>
            )}
          </ol>
        </article>
        <article className="operational-diagnostics-risk-card">
          <div>
            <span>阻断/风险</span>
            <strong>{formatNumber(topRisks.blockers.length, 0)} 阻断 / {formatNumber(topRisks.warnings.length, 0)} 风险</strong>
          </div>
          {renderTextList(
            [...topRisks.blockers, ...topRisks.warnings],
            "当前无硬阻断，按建议进入 shadow 验证。",
            { limit: 4 }
          )}
        </article>
      </section>

      {hasAdvisor ? (
        <section className="operational-diagnostics-kpis" aria-label="运行诊断摘要">
          <article>
            <span>诊断覆盖</span>
            <strong>{formatNumber(summary?.readyCount, 0)} 可用 / {formatNumber(summary?.partialCount, 0)} 降级</strong>
            <small>不可用 {formatNumber(summary?.unavailableCount, 0)} · blocker {formatNumber(summary?.blockerCount, 0)}</small>
          </article>
          <article>
            <span>点位覆盖</span>
            <strong>{formatNumber(toFiniteNumber(coverage.registerPoints), 0)}</strong>
            <small>设备 {formatNumber(toFiniteNumber(coverage.deviceRows), 0)} · 支路 {formatNumber(toFiniteNumber(coverage.branchCount), 0)}</small>
          </article>
          <article>
            <span>运行设备</span>
            <strong>主机 {formatNumber(toFiniteNumber(coverage.runningChillerCount), 0)}</strong>
            <small>冷冻泵 {formatNumber(toFiniteNumber(coverage.runningChilledPumpCount), 0)} · 冷却泵 {formatNumber(toFiniteNumber(coverage.runningCoolingPumpCount), 0)}</small>
          </article>
          <article>
            <span>冷却塔</span>
            <strong>{formatNumber(toFiniteNumber(coverage.runningCoolingTowerCount), 0)} / {formatNumber(toFiniteNumber(coverage.coolingTowerCount), 0)} 组</strong>
            <small>风机 {formatNumber(toFiniteNumber(coverage.runningCoolingTowerFanCount), 0)} / {formatNumber(toFiniteNumber(coverage.coolingTowerFanCount), 0)} 台</small>
          </article>
          <article>
            <span>数据资源</span>
            <strong>{formatNumber(readinessMatrix?.readyNowCount, 0)} 可做 / {formatNumber(readinessMatrix?.directionalCount, 0)} 疑似</strong>
            <small>{formatNumber(readinessMatrix?.pointGapCount, 0)} 项补点</small>
          </article>
          <article>
            <span>现场复核</span>
            <strong>{formatNumber(fieldChecklist?.total, 0)} 项</strong>
            <small>P0 {formatNumber(fieldChecklist?.p0Count, 0)} · P1 {formatNumber(fieldChecklist?.p1Count, 0)}</small>
          </article>
        </section>
      ) : (
        <section className="operational-diagnostics-loading-panel" aria-label="运行诊断加载状态">
          <strong>{loading ? "正在读取诊断数据" : "暂无诊断数据"}</strong>
          <span>{loading ? "读取站点运行点位、历史样本和诊断证据。" : "请刷新或检查 BFF 数据链路。"}</span>
        </section>
      )}

      <div className="operational-diagnostics-boundary-strip" aria-label="安全边界">
        <span>只读</span>
        <span>shadow 验证</span>
        <span>不下发 PLC</span>
        <span>不自动启停</span>
        <span>多机无单机流量不算单机 COP</span>
      </div>

      <section className="operational-diagnostics-detail-stack" aria-label="运行诊断完整明细">
        {loading && !advisor ? (
          <SectionCard title="运行诊断加载中" action={<StatusPill label="读取中" tone="neutral" />}>
            <p className="operational-diagnostics-empty">读取中...</p>
          </SectionCard>
        ) : null}
        {orderedItems.map(renderDiagnosticItem)}
      </section>

      <SectionCard title="现场复核对象" action={<StatusPill label={`${formatNumber(fieldChecklist?.total, 0)} 项任务`} tone="warn" />}>
        <div className="operational-diagnostics-field-grid">
          {(fieldChecklist?.items || []).map((task) => (
            <article className={task.priority === "P0" ? "is-p0" : ""} key={task.key || task.title}>
              <div>
                <span>{task.priority || "P1"} · {task.sourceTier || "待分档"}档</span>
                <StatusPill label={task.ownerRole || "现场复核"} tone={task.priority === "P0" ? "warn" : "neutral"} />
              </div>
              <strong>{task.title || "现场复核任务"}</strong>
              <p>{task.verificationTarget || "待确认复核对象。"}</p>
              <small>证据：{(task.requiredEvidence || []).slice(0, 4).join(" / ") || "待补"}</small>
              <small>缺口：{(task.missingData || []).slice(0, 3).join(" / ") || "暂无"}</small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="数据可用性" action={<StatusPill label={`${formatNumber(readinessMatrix?.total, 0)} 项`} tone="warn" />}>
        <div className="operational-diagnostics-readiness-grid">
          {(readinessMatrix?.items || []).map((item) => (
            <article key={item.key || item.title}>
              <div>
                <span>{item.tier || "待分档"}档 · {localizeMode(item.allowedMode)}</span>
                <StatusPill label={localizeFeasibility(item.currentFeasibility)} tone={item.currentFeasibility === "can_do_v1" ? "good" : "warn"} />
              </div>
              <strong>{item.title || "诊断项"}</strong>
              <small>已有：{(item.availableData || []).slice(0, 3).join(" / ") || "待补"}</small>
              <small>缺口：{(item.missingData || []).slice(0, 3).join(" / ") || "暂无"}</small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="现场采集包状态" action={<StatusPill label={collectionPackage?.finalDecision || "待确认"} tone={collectionPackage?.readyToCollect ? "good" : "warn"} />}>
        <div className="operational-diagnostics-collection">
          <article>
            <span>正式输入</span>
            <strong>{formatNumber(collectionPackage?.formalInputCount, 0)}</strong>
            <small>缺失 {formatNumber(collectionPackage?.missingFormalInputCount, 0)} · 模板 {formatNumber(collectionPackage?.templateCount, 0)}</small>
          </article>
          <article>
            <span>报告路径</span>
            <strong>{collectionPackage?.reportPath || "待生成"}</strong>
            <small>{collectionPackage?.controlBoundary || fieldChecklist?.controlBoundary || "只读采集包，不写 PLC。"}</small>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}

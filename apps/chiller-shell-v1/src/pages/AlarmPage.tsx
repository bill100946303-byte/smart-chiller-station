import { startTransition, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { getSeverityCopy } from "../i18n/hvacCopybook";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type AnomalyListDto,
  type AnomalyListItemDto,
  type AnomalySummaryDto,
  fetchAnomalyList,
  fetchAnomalySummary
} from "../services/bffClient";
import { getDisplayAnomalySourceLabel, getDisplayAnomalyTitle } from "../utils/anomalyPresentation";
import { resolveUnifiedStatusTone } from "../utils/statusTone";

type OptimizeGate = {
  label: string;
  reason: string;
  action: string;
  tone: "good" | "warn" | "danger";
};

type AlarmSeverityFilter = "" | "0" | "1" | "2" | "3";
type AlarmSeverityCode = Exclude<AlarmSeverityFilter, "">;

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE = 5;
const ALARM_SEVERITY_OPTIONS: Array<{ value: AlarmSeverityFilter; label: string }> = [
  { value: "", label: zhCN.alarmPage.filterAll },
  { value: "3", label: zhCN.severity.critical },
  { value: "2", label: zhCN.severity.major },
  { value: "1", label: zhCN.severity.minor },
  { value: "0", label: zhCN.alarmPage.filterNoAlarm }
];

const EMPTY_ALARM_SEVERITY_TOTALS: Record<AlarmSeverityCode, number | null> = {
  "3": null,
  "2": null,
  "1": null,
  "0": null
};

function parsePageParam(value: string | null, fallback = 1): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parsePageSizeParam(value: string | null, fallback = DEFAULT_PAGE_SIZE): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
    return parsed;
  }
  return fallback;
}

function parseSeverityFilterParam(value: string | null): AlarmSeverityFilter {
  if (value === "0" || value === "1" || value === "2" || value === "3") {
    return value;
  }
  if (value === "normal") {
    return "0";
  }
  if (value === "minor") {
    return "1";
  }
  if (value === "major") {
    return "2";
  }
  if (value === "critical") {
    return "3";
  }
  if (value === "noalarm" || value === "no_alarm" || value === "no-alarm") {
    return "0";
  }
  return "";
}

function formatOccurredAt(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function formatCompactDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`;
}

function formatClockLabel(value: string | null | undefined): string {
  if (!value) {
    return "--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateStatus(value: string | null | undefined): string {
  if (!value) {
    return "等待刷新时间";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "等待刷新时间";
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} 已更新`;
}

function toDisplayNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return String(value);
}

function formatAlarmExplain(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || zhCN.common.unknown;
}

function formatAlarmTypeName(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || zhCN.common.unknown;
}

function formatAlarmState(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized === "0") {
    return zhCN.alarmPage.stateRecovered;
  }
  if (normalized === "1") {
    return zhCN.alarmPage.statePendingRecover;
  }
  return zhCN.common.unknown;
}

function formatOptionalText(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || zhCN.common.unknown;
}

function formatKnownCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "--";
}

function alarmLevelFilterLabel(value: AlarmSeverityFilter): string {
  if (value === "3") {
    return zhCN.severity.critical;
  }
  if (value === "2") {
    return zhCN.severity.major;
  }
  if (value === "1") {
    return zhCN.severity.minor;
  }
  if (value === "0") {
    return zhCN.alarmPage.filterNoAlarm;
  }
  return zhCN.alarmPage.filterAll;
}

function severityTone(
  value: "critical" | "major" | "minor" | "normal" | null | undefined
): "good" | "warn" | "danger" | "neutral" {
  if (value === "critical") {
    return "danger";
  }
  if (value === "major" || value === "minor") {
    return "warn";
  }
  if (value === "normal") {
    return "good";
  }
  return "neutral";
}

function severityText(value: "critical" | "major" | "minor" | "normal" | undefined): string {
  return getSeverityCopy(value || null);
}

function resolveHistoricalTotal(
  totals: Record<AlarmSeverityCode, number | null>,
  fallback: number | null
): number | null {
  const values = Object.values(totals);
  if (values.every((value): value is number => typeof value === "number" && Number.isFinite(value))) {
    return values.reduce((sum, value) => sum + value, 0);
  }
  return fallback;
}

function buildAlarmListRequestKey(
  siteId: string,
  page: number,
  pageSize: number,
  severity: AlarmSeverityFilter
): string {
  return [siteId, page, pageSize, severity || "all"].join("|");
}

function getGateDisplay(gate: OptimizeGate): { label: string; detail: string; action: string } {
  if (gate.tone === "danger") {
    return {
      label: "暂停评审",
      detail: "存在优化闭锁告警；先完成故障处置，再恢复策略评审。",
      action: gate.action
    };
  }
  if (gate.tone === "warn") {
    return {
      label: "暂缓评审",
      detail: "存在告警或数据降级信号；仅允许保守观察，不进入自动执行。",
      action: gate.action
    };
  }
  return {
    label: "允许评审",
    detail: "无优化闭锁告警；允许人工评审，不自动下发。",
    action: gate.action
  };
}

function getGateStageAction(gate: OptimizeGate): string {
  if (gate.tone === "danger") {
    return "暂停节能动作";
  }
  if (gate.tone === "warn") {
    return "仅保守观察";
  }
  return "进入人工评审";
}

function buildAlarmIssueKey(item: AnomalyListItemDto): string {
  return [
    getDisplayAnomalyTitle({ title: item.title, regId: item.regId }),
    getDisplayAnomalySourceLabel(item.source)
  ].join("::");
}

function buildAlarmAction(item: AnomalyListItemDto): { title: string; detail: string } {
  const title = getDisplayAnomalyTitle({ title: item.title, regId: item.regId });
  const source = getDisplayAnomalySourceLabel(item.source);
  const normalized = `${title}${source}`.toLowerCase();

  if (normalized.includes("t102") || normalized.includes("冷冻总管供水温度")) {
    return {
      title: "复核传感器与设定区间",
      detail: "核对采样/上下限，观察30分钟。"
    };
  }

  if (item.severity === "critical") {
    return {
      title: "先现场确认故障",
      detail: "确认联锁和保护状态，闭锁解除后再评审。"
    };
  }

  if (item.severity === "major") {
    return {
      title: "并入高频问题跟踪",
      detail: "核对报警条件和恢复记录。"
    };
  }

  return {
    title: "交接班跟踪",
    detail: "记录恢复状态，必要时合并到运维工单。"
  };
}

function formatAlarmRowDetail(item: AnomalyListItemDto, alarmExplain: string): string {
  if (item.value) {
    return `记录值 ${item.value}`;
  }
  return alarmExplain;
}

function buildOptimizeGate(summary: AnomalySummaryDto | null, loadError: string | null): OptimizeGate {
  const counts = summary?.counts;
  const stale = Boolean(summary?.freshness?.stale);

  if (typeof counts?.critical === "number" && counts.critical > 0) {
    return {
      label: zhCN.alarmPage.gateBlocked,
      reason: zhCN.alarmPage.gateReasonCritical,
      action: zhCN.alarmPage.gateActionBlocked,
      tone: "danger"
    };
  }

  if (typeof counts?.major === "number" && counts.major > 0) {
    return {
      label: zhCN.alarmPage.gateCaution,
      reason: zhCN.alarmPage.gateReasonMajor,
      action: zhCN.alarmPage.gateActionCaution,
      tone: "warn"
    };
  }

  if (loadError || stale || summary?.sourceStatus?.overall === "failed") {
    return {
      label: zhCN.alarmPage.gateCaution,
      reason: zhCN.alarmPage.gateReasonStale,
      action: zhCN.alarmPage.gateActionCaution,
      tone: "warn"
    };
  }

  return {
    label: zhCN.alarmPage.gateReady,
    reason: zhCN.alarmPage.gateReasonReady,
    action: zhCN.alarmPage.gateActionReady,
    tone: "good"
  };
}

export default function AlarmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<AnomalySummaryDto | null>(null);
  const [alarmList, setAlarmList] = useState<AnomalyListDto | null>(null);
  const [severityTotals, setSeverityTotals] =
    useState<Record<AlarmSeverityCode, number | null>>(EMPTY_ALARM_SEVERITY_TOTALS);
  const [summaryRequestFailed, setSummaryRequestFailed] = useState(false);
  const [listRequestFailed, setListRequestFailed] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [loadedListRequestKey, setLoadedListRequestKey] = useState("");
  const page = parsePageParam(searchParams.get("page"), 1);
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const severityFilter = parseSeverityFilterParam(searchParams.get("severity"));
  const currentListRequestKey = buildAlarmListRequestKey(runtimeConfig.siteId, page, pageSize, severityFilter);

  function syncListSearchParams(next: {
    page?: number;
    pageSize?: number;
    severity?: AlarmSeverityFilter;
  }) {
    const nextPage = parsePageParam(String(next.page ?? page), 1);
    const nextPageSize = parsePageSizeParam(String(next.pageSize ?? pageSize), DEFAULT_PAGE_SIZE);
    const nextSeverity = next.severity ?? severityFilter;
    const nextParams = new URLSearchParams(searchParams);

    if (nextSeverity) {
      nextParams.set("severity", nextSeverity);
    } else {
      nextParams.delete("severity");
    }

    if (nextPage > 1) {
      nextParams.set("page", String(nextPage));
    } else {
      nextParams.delete("page");
    }

    if (nextPageSize !== DEFAULT_PAGE_SIZE) {
      nextParams.set("pageSize", String(nextPageSize));
    } else {
      nextParams.delete("pageSize");
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      const result = await Promise.allSettled([fetchAnomalySummary(runtimeConfig.siteId)]);
      if (!active) {
        return;
      }
      const [summaryResult] = result;

      startTransition(() => {
        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
          setSummaryRequestFailed(false);
        } else {
          setSummary(null);
          setSummaryRequestFailed(true);
        }
      });
    }

    loadSummary();
    return () => {
      active = false;
    };
  }, [runtimeConfig.siteId]);

  useEffect(() => {
    let active = true;
    const requestKey = buildAlarmListRequestKey(runtimeConfig.siteId, page, pageSize, severityFilter);

    async function loadList() {
      setListLoading(true);
      setListError(null);
      const result = await Promise.allSettled([
        fetchAnomalyList(runtimeConfig.siteId, {
          page,
          pageSize,
          severity: severityFilter || undefined
        })
      ]);
      if (!active) {
        return;
      }
      const [listResult] = result;

      startTransition(() => {
        if (listResult.status === "fulfilled") {
          setAlarmList(listResult.value);
          setLoadedListRequestKey(requestKey);
          setListError(null);
          setListRequestFailed(false);
          setListLoading(false);
        } else {
          setAlarmList(null);
          setLoadedListRequestKey(requestKey);
          setListError(zhCN.alarmPage.listLoadFailed);
          setListRequestFailed(true);
          setListLoading(false);
        }
      });
    }

    loadList();
    return () => {
      active = false;
    };
  }, [page, pageSize, severityFilter, runtimeConfig.siteId]);

  useEffect(() => {
    let active = true;

    async function loadSeverityTotals() {
      const severityCodes: AlarmSeverityCode[] = ["3", "2", "1", "0"];
      const results = await Promise.allSettled(
        severityCodes.map((severity) =>
          fetchAnomalyList(runtimeConfig.siteId, {
            page: 1,
            pageSize: 1,
            severity
          })
        )
      );
      if (!active) {
        return;
      }

      const nextTotals: Record<AlarmSeverityCode, number | null> = { ...EMPTY_ALARM_SEVERITY_TOTALS };
      results.forEach((result, index) => {
        const severity = severityCodes[index];
        nextTotals[severity] =
          result.status === "fulfilled" && typeof result.value.total === "number"
            ? result.value.total
            : null;
      });
      startTransition(() => {
        setSeverityTotals(nextTotals);
      });
    }

    loadSeverityTotals();
    return () => {
      active = false;
    };
  }, [runtimeConfig.siteId]);

  const loadError =
    summaryRequestFailed && listRequestFailed
      ? zhCN.alarmPage.degraded
      : summaryRequestFailed || listRequestFailed
        ? zhCN.dashboard.partialDataset
        : null;

  const listMatchesCurrentRequest = loadedListRequestKey === currentListRequestKey;
  const visibleAlarmList = listMatchesCurrentRequest ? alarmList : null;
  const sourceSummary = summarizeSourceStatus([summary?.sourceStatus, visibleAlarmList?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([summary?.sourceStatus, visibleAlarmList?.sourceStatus], {
    limit: 4,
    labelMode: "short"
  });

  const events = summary?.latestEvents || [];
  const items = visibleAlarmList?.items || [];
  const filteredTotal = typeof visibleAlarmList?.total === "number" ? visibleAlarmList.total : items.length;
  const historyTotalFallback = listMatchesCurrentRequest
    ? filteredTotal
    : typeof alarmList?.total === "number"
      ? alarmList.total
      : null;
  const historyTotal = resolveHistoricalTotal(severityTotals, historyTotalFallback);
  const historyTotalText = formatKnownCount(historyTotal);
  const pageCount = filteredTotal > 0 ? Math.max(1, Math.ceil(filteredTotal / pageSize)) : 1;
  const optimizeGate = buildOptimizeGate(summary, loadError);
  const gateDisplay = getGateDisplay(optimizeGate);
  const gateStageAction = getGateStageAction(optimizeGate);
  const counts = summary?.counts;
  const currentActiveCount = typeof counts?.total === "number" ? counts.total : events.length;
  const currentCriticalCount = typeof counts?.critical === "number" ? counts.critical : 0;
  const currentMajorCount = typeof counts?.major === "number" ? counts.major : 0;
  const optimizeBlockCount = currentCriticalCount + currentMajorCount;
  const freshness = summary?.freshness || visibleAlarmList?.freshness || null;
  const freshnessLabel = freshness?.stale
    ? zhCN.alarmPage.freshnessStale
    : freshness?.latestTimestamp
      ? zhCN.alarmPage.freshnessFresh
      : zhCN.alarmPage.freshnessWarn;
  const freshnessTimestamp =
    summary?.freshness?.latestTimestamp || visibleAlarmList?.generatedAt || visibleAlarmList?.freshness?.latestTimestamp || null;
  const activeSeverityLabel = alarmLevelFilterLabel(severityFilter);
  const sourceSummaryText = loadError ? loadError : sourceSummary.text;
  const statusDigestLines = Array.from(new Set(sourceStatusLinesCompact.filter(Boolean))).slice(0, 4);
  const severityFilterViews = ALARM_SEVERITY_OPTIONS.map((option) => ({
    ...option,
    count: option.value === "" ? historyTotal : severityTotals[option.value as AlarmSeverityCode]
  }));
  const issueGroups = Array.from(
    items
      .reduce<
        Map<
          string,
          {
            key: string;
            title: string;
            source: string;
            count: number;
            sample: AnomalyListItemDto;
          }
        >
      >((groups, item) => {
        const key = buildAlarmIssueKey(item);
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
          return groups;
        }
        groups.set(key, {
          key,
          title: getDisplayAnomalyTitle({ title: item.title, regId: item.regId }),
          source: getDisplayAnomalySourceLabel(item.source),
          count: 1,
          sample: item
        });
        return groups;
      }, new Map())
      .values()
  ).sort((left, right) => right.count - left.count);
  const focusIssue = issueGroups[0] || null;
  const focusAction = focusIssue ? buildAlarmAction(focusIssue.sample) : null;
  const kpiCards = [
    {
      title: "当前活跃告警",
      value: `${toDisplayNumber(currentActiveCount)}${zhCN.common.unitItem}`,
      detail: currentActiveCount > 0 ? "存在需先确认的实时告警" : "当前无闭锁告警"
    },
    {
      title: "优化闭锁告警",
      value: `${toDisplayNumber(optimizeBlockCount)}${zhCN.common.unitItem}`,
      detail: `紧急 ${currentCriticalCount} · 严重 ${currentMajorCount}`
    },
    {
      title: "历史告警事件",
      value: `${historyTotalText}${zhCN.common.unitItem}`,
      detail: "用于复盘高频点位"
    },
    {
      title: "最近刷新时间",
      value: formatClockLabel(freshnessTimestamp),
      detail: formatDateStatus(freshnessTimestamp)
    }
  ];
  const listStageMeta = [
    `当前活跃 ${currentActiveCount} · 历史 ${historyTotalText}`,
    `当前筛选 ${activeSeverityLabel}`,
    `第 ${page} / ${pageCount} 页 · 每页 ${pageSize} 项`
  ];
  const queueHint = listError
    ? listError
    : listLoading || !listMatchesCurrentRequest
      ? `正在加载${activeSeverityLabel}告警；加载完成后刷新列表与分页。`
    : `按当前筛选展示历史告警；当前页 ${page}/${pageCount}，筛选或分页会即时刷新。`;
  const recentFlowTitle = events.length > 0 ? `当前实时 ${events.length}${zhCN.common.unitItem}` : "当前实时";
  const dataSourceDetail =
    visibleAlarmList?.freshness?.stale
      ? "历史列表为归档事件，当前准入以实时摘要为准。"
      : "实时摘要与历史列表均已接入。";

  useEffect(() => {
    if (!alarmList || page <= pageCount) {
      return;
    }
    syncListSearchParams({ page: pageCount });
  }, [alarmList, page, pageCount]);

  function onChangeSeverityFilter(value: AlarmSeverityFilter) {
    syncListSearchParams({
      severity: value,
      page: 1
    });
  }

  function onChangePageSize(value: number) {
    syncListSearchParams({
      pageSize: value,
      page: 1
    });
  }

  function renderAlarmQueueRow(item: AnomalyListItemDto, index: number) {
    const title = getDisplayAnomalyTitle({ title: item.title, regId: item.regId });
    const source = getDisplayAnomalySourceLabel(item.source);
    const alarmExplain = formatAlarmExplain(item.alarmExplain);
    const configuredAlarmTypeName = formatAlarmTypeName(item.alarmTypeName);
    const alarmTypeName =
      configuredAlarmTypeName === zhCN.common.unknown ? severityText(item.severity || undefined) : configuredAlarmTypeName;
    const alarmState = formatAlarmState(item.state);
    const alarmSeverityTone = severityTone(item.severity);
    const alarmStateTone = resolveUnifiedStatusTone(alarmState);
    const action = buildAlarmAction(item);
    const rowKey = item.id || `${buildAlarmIssueKey(item)}-${index + 1}`;

    return (
      <article key={rowKey} className="alarm-queue-row">
        <div className="alarm-queue-severity">
          <span className={`alarm-severity-badge tone-${alarmSeverityTone}`}>{alarmTypeName}</span>
        </div>
        <div className="alarm-queue-event">
          <strong>{title}</strong>
          <span>{formatAlarmRowDetail(item, alarmExplain)}</span>
        </div>
        <div className="alarm-queue-source">
          <strong>{source}</strong>
          <span>{`点位 ${formatOptionalText(item.regId)}`}</span>
        </div>
        <div className="alarm-queue-time">
          <strong title={formatOccurredAt(item.occurredAt)}>{formatCompactDateTime(item.occurredAt)}</strong>
          <span>{visibleAlarmList?.freshness?.stale ? "历史待复核" : freshnessLabel}</span>
        </div>
        <div className="alarm-queue-state">
          <span className={`status-tone-text tone-${alarmStateTone}`}>{alarmState}</span>
        </div>
        <div className="alarm-queue-action">
          <strong>{action.title}</strong>
          <span>{action.detail}</span>
        </div>
      </article>
    );
  }

  return (
    <div className="alarm-page alarm-page-v2 page-enter">
      <section className="alarm-command-hero">
        <div className="alarm-hero-copy">
          <p className="alarm-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h2>告警处置中心</h2>
          <p>先确认当前闭锁告警，再复核历史高频事件；AI 优化仅在准入放行后进入人工评审，不直接下发。</p>
        </div>
        <div className="alarm-hero-actions" aria-label="告警页面快捷入口">
          <span className="alarm-hero-chip tone-good">云端实时</span>
          <span className="alarm-hero-chip">AI 建议需审批</span>
          <span className="alarm-hero-chip">PLC 保护在线</span>
          <span className="alarm-hero-chip">10 分钟刷新</span>
        </div>
      </section>

      <section className="alarm-kpi-grid" aria-label="告警决策摘要">
        {kpiCards.map((item) => (
          <article key={item.title} className="alarm-kpi-card">
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
        <article className={`alarm-kpi-card alarm-kpi-card-wide tone-${optimizeGate.tone}`}>
          <div>
            <span>优化准入状态</span>
            <strong>{gateDisplay.label}</strong>
            <small>{gateDisplay.detail}</small>
          </div>
          <div className="alarm-gate-actions">
            <Link className="alarm-gate-link secondary" to={`/system-overview?siteId=${runtimeConfig.siteId}`}>
              查看控制边界
            </Link>
            <Link className="alarm-gate-link primary" to={`/optimize-demo?siteId=${runtimeConfig.siteId}`}>
              进入评审
            </Link>
          </div>
        </article>
      </section>

      <div className="alarm-workbench">
        <section className="alarm-queue-panel">
          <header className="alarm-panel-header">
            <div>
              <h3>告警处置队列</h3>
              <p>{queueHint}</p>
            </div>
            <div className="alarm-filter-actions" aria-label="告警等级筛选">
              {severityFilterViews.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  data-severity-filter={option.value || "all"}
                  aria-pressed={severityFilter === option.value}
                  className={severityFilter === option.value ? "alarm-filter-button active" : "alarm-filter-button"}
                  onClick={() => onChangeSeverityFilter(option.value)}
                >
                  <span>{option.label}</span>
                  <em>{formatKnownCount(option.count)}</em>
                </button>
              ))}
            </div>
          </header>

          <div className="alarm-stage-strip">
            <div>
              <span>列表口径</span>
              <strong>{listStageMeta[0]}</strong>
            </div>
            <div>
              <span>当前建议</span>
              <strong>{gateStageAction}</strong>
            </div>
            <div>
              <span>分页</span>
              <strong>{listStageMeta[2]}</strong>
            </div>
          </div>

          <div className="alarm-page-size-row" aria-label="每页条数">
            <span>每页显示</span>
            <div className="alarm-page-size">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  data-page-size={size}
                  className={pageSize === size ? "alarm-filter-button active" : "alarm-filter-button"}
                  onClick={() => onChangePageSize(size)}
                >
                  {`${size}${zhCN.common.unitItem}`}
                </button>
              ))}
            </div>
          </div>

          {listLoading || !listMatchesCurrentRequest ? (
            <p className="alarm-empty">正在加载当前筛选告警...</p>
          ) : items.length > 0 ? (
            <div className="alarm-queue-table" role="table" aria-label="告警历史处置队列">
              <div className="alarm-queue-head" role="row">
                <span>等级</span>
                <span>事件 / 点位</span>
                <span>来源</span>
                <span>发生时间</span>
                <span>状态</span>
                <span>处置建议</span>
              </div>
              <div className="alarm-queue-body">
                {items.map(renderAlarmQueueRow)}
              </div>
            </div>
          ) : listError || loadError ? (
            <p className="alarm-empty">{zhCN.alarmPage.degraded}</p>
          ) : severityFilter ? (
            <p className="alarm-empty">{zhCN.alarmPage.filteredEmpty}</p>
          ) : filteredTotal === 0 ? (
            <p className="alarm-empty">{zhCN.alarmPage.noEvents}</p>
          ) : null}

          <div className="alarm-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => syncListSearchParams({ page: Math.max(1, page - 1) })}
            >
              {zhCN.alarmPage.pagePrev}
            </button>
            <span>{`${zhCN.alarmPage.pageLabel} ${page}/${pageCount}`}</span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => syncListSearchParams({ page: Math.min(pageCount, page + 1) })}
            >
              {zhCN.alarmPage.pageNext}
            </button>
          </div>
        </section>

        <aside className="alarm-side-column" aria-label="告警原因与实时流">
          <section className="alarm-side-panel">
            <header className="alarm-side-header">
              <h3>高频原因聚合</h3>
              <span>按当前筛选聚合</span>
            </header>
            {focusIssue ? (
              <div className="alarm-focus-stack">
                <div className="alarm-focus-card">
                  <span>最高频点位</span>
                  <strong>{focusIssue.title}</strong>
                  <em>{`当前页 ${focusIssue.count}${zhCN.common.unitItem}`}</em>
                </div>
                <div className="alarm-focus-card">
                  <span>影响判断</span>
                  <p>
                    {currentActiveCount > 0
                      ? "存在当前活跃告警；先完成现场复核，再进入优化评审。"
                      : "当前无闭锁告警；该历史高频点位不阻断本次优化评审。"}
                  </p>
                </div>
                <div className="alarm-focus-card">
                  <span>建议处置</span>
                  <p>{focusAction?.detail}</p>
                </div>
              </div>
            ) : (
              <p className="alarm-empty">当前筛选下暂无可聚合的历史告警。</p>
            )}
          </section>

          <section className="alarm-side-panel">
            <header className="alarm-side-header">
              <h3>最近告警流</h3>
              <span>{recentFlowTitle}</span>
            </header>
            {events.length > 0 ? (
              <ul className="alarm-recent-list">
                {events.slice(0, 4).map((item, index) => {
                  const eventKey = item.id || `recent-event-${index + 1}`;
                  const eventStateText = formatAlarmState(item.state);
                  const eventStateTone = resolveUnifiedStatusTone(eventStateText);
                  return (
                    <li key={eventKey}>
                      <div>
                        <strong>{getDisplayAnomalyTitle({ title: item.title, regId: item.regId })}</strong>
                        <span>{formatCompactDateTime(item.occurredAt)}</span>
                      </div>
                      <em className={`status-tone-text tone-${eventStateTone}`}>{eventStateText}</em>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="alarm-empty">当前没有实时告警事件。历史事件已归并到左侧处置队列。</p>
            )}
          </section>
        </aside>
      </div>

      <section className="alarm-footer-grid" aria-label="告警交接口径">
        <article>
          <span>规则门禁</span>
          <strong>{gateDisplay.label}</strong>
          <small>{gateDisplay.detail}</small>
        </article>
        <article>
          <span>数据来源</span>
          <strong>{loadError ? "链路降级" : sourceSummaryText}</strong>
          <small>{statusDigestLines[0] || dataSourceDetail}</small>
        </article>
        <article>
          <span>交接班提醒</span>
          <strong>{focusIssue ? `${focusIssue.title} 继续闭环` : "暂无高频历史事件"}</strong>
          <small>{focusAction?.detail || "保持当前观察频率。"}</small>
        </article>
      </section>
    </div>
  );
}

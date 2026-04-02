import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
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

type AlarmSummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type OptimizeGate = {
  label: string;
  reason: string;
  action: string;
  tone: "good" | "warn" | "danger";
};

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

function toDisplayNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return String(value);
}

function buildSummaryCards(data: AnomalySummaryDto | null, fallbackReason: string): AlarmSummaryCard[] {
  const counts = data?.counts;
  const freshness = data?.freshness;
  const tone = freshness?.stale ? "warn" : "good";
  const freshnessLabel = freshness?.stale
    ? zhCN.alarmPage.freshnessStale
    : freshness?.latestTimestamp
      ? zhCN.alarmPage.freshnessFresh
      : zhCN.alarmPage.freshnessWarn;

  return [
    {
      title: zhCN.alarmPage.summaryTotal,
      value: toDisplayNumber(counts?.total),
      unit: zhCN.common.unitItem,
      delta: fallbackReason,
      tone: typeof counts?.total === "number" && counts.total > 0 ? "warn" : "good"
    },
    {
      title: zhCN.alarmPage.summaryHigh,
      value: toDisplayNumber(counts?.critical),
      unit: zhCN.common.unitItem,
      delta: zhCN.severity.critical,
      tone: typeof counts?.critical === "number" && counts.critical > 0 ? "warn" : "good"
    },
    {
      title: zhCN.alarmPage.summaryMedium,
      value: toDisplayNumber(counts?.major),
      unit: zhCN.common.unitItem,
      delta: zhCN.severity.major,
      tone: "neutral"
    },
    {
      title: zhCN.alarmPage.summaryLow,
      value: toDisplayNumber(counts?.minor),
      unit: zhCN.common.unitItem,
      delta: zhCN.severity.minor,
      tone: "neutral"
    },
    {
      title: zhCN.alarmPage.summaryNormal,
      value: toDisplayNumber(counts?.normal),
      unit: zhCN.common.unitItem,
      delta: zhCN.severity.normal,
      tone: "good"
    },
    {
      title: zhCN.alarmPage.summaryFreshness,
      value: freshnessLabel,
      unit: "",
      delta: freshness?.latestTimestamp || fallbackReason,
      tone
    }
  ];
}

function severityTone(
  value: "critical" | "major" | "minor" | "normal" | undefined
): "warn" | "danger" | "neutral" {
  if (value === "critical") {
    return "danger";
  }
  if (value === "major") {
    return "warn";
  }
  return "neutral";
}

function severityText(value: "critical" | "major" | "minor" | "normal" | undefined): string {
  return getSeverityCopy(value || null);
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
  const [summary, setSummary] = useState<AnomalySummaryDto | null>(null);
  const [alarmList, setAlarmList] = useState<AnomalyListDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [severityFilter, setSeverityFilter] = useState<
    "" | "critical" | "major" | "minor" | "normal"
  >("");

  useEffect(() => {
    let active = true;

    async function load() {
      const [summaryResult, listResult] = await Promise.allSettled([
        fetchAnomalySummary(runtimeConfig.siteId),
        fetchAnomalyList(runtimeConfig.siteId, {
          page,
          pageSize,
          severity: severityFilter || undefined
        })
      ]);
      if (!active) {
        return;
      }

      startTransition(() => {
        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        } else {
          setSummary(null);
        }

        if (listResult.status === "fulfilled") {
          setAlarmList(listResult.value);
          setListError(null);
        } else {
          setAlarmList(null);
          setListError(zhCN.alarmPage.listLoadFailed);
        }

        if (summaryResult.status === "rejected" && listResult.status === "rejected") {
          setLoadError(zhCN.alarmPage.degraded);
        } else if (summaryResult.status === "rejected" || listResult.status === "rejected") {
          setLoadError(zhCN.dashboard.partialDataset);
        } else {
          setLoadError(null);
        }
      });
    }

    load();
    return () => {
      active = false;
    };
  }, [page, pageSize, severityFilter]);

  const sourceSummary = summarizeSourceStatus([summary?.sourceStatus, alarmList?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([summary?.sourceStatus, alarmList?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([summary?.sourceStatus, alarmList?.sourceStatus], {
    limit: 4,
    labelMode: "short"
  });

  const fallbackReason = loadError
    ? zhCN.dashboard.bffUnavailableReason
      : summary?.freshness?.stale || alarmList?.freshness?.stale
      ? zhCN.alarmPage.stale
      : zhCN.dashboard.readyBanner;

  const cards = buildSummaryCards(summary, fallbackReason);
  const events = summary?.latestEvents || [];
  const items = alarmList?.items || [];
  const total = typeof alarmList?.total === "number" ? alarmList.total : items.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const optimizeGate = buildOptimizeGate(summary, loadError);

  function onChangeSeverityFilter(value: "" | "critical" | "major" | "minor" | "normal") {
    setSeverityFilter(value);
    setPage(1);
  }

  function onChangePageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  function renderAlarmListRow(item: AnomalyListItemDto, index: number) {
    return (
      <div key={item.id || `alarm-row-${index + 1}`} className="alarm-table-row">
        <span className="alarm-cell alarm-cell-title" data-label={zhCN.dashboard.alarmEvent}>
          {item.title || zhCN.dashboard.alarmEvent}
        </span>
        <span className="alarm-cell" data-label={zhCN.alarmPage.eventSourcePrefix}>
          {item.source || zhCN.dashboard.unknownSource}
        </span>
        <span className="alarm-cell" data-label={zhCN.alarmPage.eventTimePrefix}>
          {formatOccurredAt(item.occurredAt)}
        </span>
        <span className="alarm-cell alarm-cell-severity" data-label={zhCN.alarmPage.eventSeverityPrefix}>
          {severityText(item.severity ?? undefined)}
        </span>
      </div>
    );
  }

  return (
    <div className="alarm-page page-enter">
      <SourceStatusBanner
        summary={loadError ? loadError : sourceSummary.text}
        warn={Boolean(loadError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="alarm-page-header">
        <h2>{zhCN.alarmPage.heading}</h2>
        <p>{zhCN.alarmPage.subtitle}</p>
      </section>

      <div className="alarm-summary-grid">
        {cards.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            unit={item.unit}
            delta={item.delta}
            tone={item.tone}
          />
        ))}
      </div>

      <SectionCard title={zhCN.alarmPage.sectionGate}>
        <p className="empty-hint">{zhCN.alarmPage.gateHint}</p>
        <div className="alarm-gate-grid">
          <article className={`alarm-gate-card tone-${optimizeGate.tone}`}>
            <span>{zhCN.alarmPage.gateLevelTitle}</span>
            <strong>{optimizeGate.label}</strong>
          </article>
          <article className={`alarm-gate-card tone-${optimizeGate.tone}`}>
            <span>{zhCN.alarmPage.gateReasonTitle}</span>
            <strong>{optimizeGate.reason}</strong>
          </article>
          <article className={`alarm-gate-card tone-${optimizeGate.tone}`}>
            <span>{zhCN.alarmPage.gateActionTitle}</span>
            <strong>{optimizeGate.action}</strong>
          </article>
        </div>
      </SectionCard>

      <div className="alarm-page-grid">
        <SectionCard title={zhCN.alarmPage.sectionRecent}>
          {events.length > 0 ? (
            <ul className="anomaly-list">
              {events.map((item, index) => (
                <li key={item.id || `recent-event-${index + 1}`}>
                  <div>
                    <strong>{item.title || zhCN.dashboard.alarmEvent}</strong>
                    <p>
                      {zhCN.alarmPage.eventTimePrefix} {formatOccurredAt(item.occurredAt)} · {zhCN.alarmPage.eventSourcePrefix}{" "}
                      {item.source || zhCN.dashboard.unknownSource}
                    </p>
                  </div>
                  <StatusPill label={severityText(item.severity)} tone={severityTone(item.severity)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-hint">{zhCN.alarmPage.noEvents}</p>
          )}
        </SectionCard>

        <SectionCard title={zhCN.alarmPage.sectionList}>
          <div className="alarm-list-toolbar">
            <div className="alarm-filter-group">
              <span>{zhCN.alarmPage.filterLabel}</span>
              <div className="alarm-filter-actions">
                {[
                  { value: "", label: zhCN.alarmPage.filterAll },
                  { value: "critical", label: zhCN.severity.critical },
                  { value: "major", label: zhCN.severity.major },
                  { value: "minor", label: zhCN.severity.minor },
                  { value: "normal", label: zhCN.severity.normal }
                ].map((option) => (
                  <button
                    key={option.value || "all"}
                    type="button"
                    className={severityFilter === option.value ? "alarm-filter-button active" : "alarm-filter-button"}
                    onClick={() =>
                      onChangeSeverityFilter(
                        option.value as "" | "critical" | "major" | "minor" | "normal"
                      )
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="alarm-pagination-meta">
              <span>{`${zhCN.alarmPage.summaryTotal} ${total}${zhCN.common.unitItem}`}</span>
              <div className="alarm-page-size">
                {[5, 10, 20].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={pageSize === size ? "alarm-filter-button active" : "alarm-filter-button"}
                    onClick={() => onChangePageSize(size)}
                  >
                    {`${size}${zhCN.common.unitItem}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="empty-hint">
            {listError
              ? listError
              : `${zhCN.alarmPage.listHint} · ${zhCN.alarmPage.pageLabel} ${page}/${pageCount}`}
          </p>
          {items.length > 0 ? (
            <div className="alarm-table">
              <div className="alarm-table-head">
                <span>{zhCN.dashboard.alarmEvent}</span>
                <span>{zhCN.alarmPage.eventSourcePrefix}</span>
                <span>{zhCN.alarmPage.eventTimePrefix}</span>
                <span>{zhCN.alarmPage.eventSeverityPrefix}</span>
              </div>
              {items.map(renderAlarmListRow)}
              <div className="alarm-pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  {zhCN.alarmPage.pagePrev}
                </button>
                <span>{`${zhCN.alarmPage.pageLabel} ${page}/${pageCount}`}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  {zhCN.alarmPage.pageNext}
                </button>
              </div>
            </div>
          ) : listError || loadError ? (
            <p className="empty-hint">{zhCN.alarmPage.degraded}</p>
          ) : severityFilter ? (
            <p className="empty-hint">{zhCN.alarmPage.filteredEmpty}</p>
          ) : total === 0 ? (
            <p className="empty-hint">{zhCN.alarmPage.noEvents}</p>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

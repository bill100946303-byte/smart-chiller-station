import { startTransition, useEffect, useState } from "react";
import ReadinessBadge from "../components/common/ReadinessBadge";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import RuleSkipDetails from "../components/dashboard/RuleSkipDetails";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import { runtimeConfig } from "../config/runtimeConfig";
import useRecommendationDiagnostics from "../hooks/useRecommendationDiagnostics";
import { getRiskCopy, getRuleCopy, preferChineseText } from "../i18n/hvacCopybook";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type DashboardOverviewDto,
  type RecommendationDto,
  type SourceStatusDto,
  type SystemTopologyDto,
  type TopologyNodeDto,
  fetchDashboardOverview,
  fetchSystemTopology
} from "../services/bffClient";

type OverviewStat = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type OverviewRecommendation = {
  id: string;
  title: string;
  description: string;
  impact: string;
  risk: string;
};

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return String(value);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function formatTopologyStatus(value: string | null | undefined): string {
  if (value === "running") {
    return zhCN.topologyStatus.running;
  }
  if (value === "stable") {
    return zhCN.topologyStatus.stable;
  }
  if (value === "alert") {
    return zhCN.topologyStatus.alert;
  }
  return zhCN.common.unknown;
}

function topologyTone(value: string | null | undefined): "good" | "neutral" | "warn" {
  if (value === "running") {
    return "good";
  }
  if (value === "alert") {
    return "warn";
  }
  return "neutral";
}

function isMeaningfulSpaceValue(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  const lowered = normalized.toLowerCase();
  return !["unknown", "未知", "默认", "0", "null", "undefined", "-", "--"].includes(lowered);
}

function hasFallbackSource(sourceStatus: SourceStatusDto | null | undefined): boolean {
  return Boolean(sourceStatus?.sources?.some((item) => item.fallback === true));
}

function buildSummaryCards(
  overview: DashboardOverviewDto | null,
  topology: SystemTopologyDto | null,
  recommendation: RecommendationDto | null,
  partialActive: boolean
): OverviewStat[] {
  const cards = overview?.energyCards;
  const summary = topology?.summary || null;
  const freshnessText = overview?.freshness?.latestTimestamp
    ? formatTimestamp(overview.freshness.latestTimestamp)
    : zhCN.systemOverview.freshnessPending;

  return [
    {
      title: zhCN.systemOverview.summaryCop,
      value: formatNumber(cards?.currentCop, 2),
      unit: "",
      delta: partialActive ? zhCN.systemOverview.deltaPartial : zhCN.systemOverview.deltaLive,
      tone: partialActive ? "warn" : "good"
    },
    {
      title: zhCN.systemOverview.summaryPower,
      value: formatNumber(cards?.totalPowerKw, 1),
      unit: "kW",
      delta: zhCN.systemOverview.deltaOverview,
      tone: cards?.totalPowerKw != null ? "good" : "warn"
    },
    {
      title: zhCN.systemOverview.summaryDevices,
      value: formatCount(summary?.totalDevices),
      unit: zhCN.common.unitItem,
      delta: zhCN.systemOverview.deltaTopology,
      tone: "neutral"
    },
    {
      title: zhCN.systemOverview.summaryRecommendations,
      value: formatCount(recommendation?.summary?.total),
      unit: zhCN.common.unitItem,
      delta: zhCN.systemOverview.deltaDiagnostics,
      tone: "neutral"
    },
    {
      title: zhCN.systemOverview.summaryFreshness,
      value: overview?.freshness?.stale ? zhCN.systemOverview.freshnessStale : zhCN.systemOverview.freshnessFresh,
      unit: "",
      delta: freshnessText,
      tone: overview?.freshness?.stale ? "warn" : "good"
    }
  ];
}

function buildRecommendationCards(
  recommendation: RecommendationDto | null,
  fallbackReason: string
): OverviewRecommendation[] {
  if (!recommendation?.cards || recommendation.cards.length === 0) {
    return [
      {
        id: "system-rec-fallback",
        title: zhCN.systemOverview.recommendationFallbackTitle,
        description: fallbackReason,
        impact: zhCN.systemOverview.recommendationFallbackImpact,
        risk: zhCN.severity.medium
      }
    ];
  }

  return recommendation.cards.slice(0, 3).map((item, index) => {
    const ruleCopy = getRuleCopy(item.ruleId);
    return {
      id: item.id || `system-rec-${index + 1}`,
      title: preferChineseText(item.title, ruleCopy?.nameZh || zhCN.systemOverview.recommendationFallbackTitle),
      description: preferChineseText(
        item.reason || item.evidence?.[0],
        ruleCopy?.descriptionZh || zhCN.systemOverview.recommendationFallbackReason
      ),
      impact: preferChineseText(
        item.actions?.[0],
        ruleCopy?.opsAdviceZh || zhCN.systemOverview.recommendationFallbackImpact
      ),
      risk: getRiskCopy(item.risk)
    };
  });
}

function buildNodeDetail(
  node: TopologyNodeDto | null,
  overview: DashboardOverviewDto | null,
  recommendation: RecommendationDto | null
) {
  const firstRecommendation = recommendation?.cards?.[0] || null;
  return [
    {
      label: zhCN.systemOverview.labels.node,
      value: node?.label || zhCN.common.unknown
    },
    {
      label: zhCN.systemOverview.labels.status,
      value: formatTopologyStatus(node?.downstream || "stable")
    },
    {
      label: zhCN.systemOverview.labels.currentPower,
      value:
        overview?.energyCards?.totalPowerKw != null
          ? `${formatNumber(overview.energyCards.totalPowerKw, 1)} kW`
          : zhCN.systemOverview.pendingValue
    },
    {
      label: zhCN.systemOverview.labels.systemCop,
      value:
        overview?.energyCards?.currentCop != null
          ? formatNumber(overview.energyCards.currentCop, 2)
          : zhCN.systemOverview.pendingValue
    },
    {
      label: zhCN.systemOverview.labels.risk,
      value: firstRecommendation?.title || zhCN.systemOverview.noRecommendation
    },
    {
      label: zhCN.systemOverview.labels.action,
      value: firstRecommendation?.actions?.[0] || zhCN.systemOverview.noAction
    }
  ];
}

export default function SystemOverviewPage() {
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [topology, setTopology] = useState<SystemTopologyDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const {
    recommendation,
    ruleEvaluation,
    diagnosticHint,
    loading: recommendationLoading,
    loadError: recommendationLoadError
  } = useRecommendationDiagnostics(runtimeConfig.siteId);

  useEffect(() => {
    let active = true;

    async function load() {
      const [overviewResult, topologyResult] = await Promise.allSettled([
        fetchDashboardOverview(runtimeConfig.siteId),
        fetchSystemTopology(runtimeConfig.siteId)
      ]);

      if (!active) {
        return;
      }

      startTransition(() => {
        const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
        const topologyData = topologyResult.status === "fulfilled" ? topologyResult.value : null;
        setOverview(overviewData);
        setTopology(topologyData);

        if (!overviewData && !topologyData) {
          setLoadError(zhCN.systemOverview.degraded);
        } else if (!overviewData || !topologyData) {
          setLoadError(zhCN.systemOverview.partial);
        } else {
          setLoadError(null);
        }
      });
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const topologyNodes = topology?.nodes || [];
  const selectedNode = topologyNodes.find((item) => item.id === selectedNodeId) || topologyNodes[0] || null;
  const pageSourceStatuses = [overview?.sourceStatus, topology?.sourceStatus, recommendation?.sourceStatus];
  const sourceSummary = summarizeSourceStatus(pageSourceStatuses);
  const sourceStatusLines = buildSourceStatusLines(pageSourceStatuses);
  const sourceStatusLinesCompact = buildSourceStatusLines(pageSourceStatuses, { limit: 4, labelMode: "short" });
  const sourceBannerText = recommendationLoading
    ? zhCN.sourceBanner.loading
    : loadError
      ? loadError
      : recommendationLoadError
        ? zhCN.sourceBanner.degradedRecommendationUnavailable
        : sourceSummary.text;
  const sourceWarnActive = Boolean(loadError) || Boolean(recommendationLoadError) || sourceSummary.warn;
  const topologyPlaceholderActive = hasFallbackSource(topology?.sourceStatus);
  const spaceHierarchyEnabled = Boolean(
    topology?.groups?.some((item) => isMeaningfulSpaceValue(item.floor))
  );
  const summaryCards = buildSummaryCards(overview, topology, recommendation, sourceSummary.warn);
  const recommendationCards = buildRecommendationCards(
    recommendation,
    recommendationLoadError || zhCN.systemOverview.recommendationFallbackReason
  );
  const detailItems = buildNodeDetail(selectedNode, overview, recommendation);
  const heroCards = summaryCards.slice(0, 3);

  useEffect(() => {
    if (!selectedNodeId && topologyNodes[0]?.id) {
      setSelectedNodeId(topologyNodes[0].id);
    }
  }, [selectedNodeId, topologyNodes]);

  return (
    <div className="system-page page-enter">
      <ReadinessBadge pageKey="systemOverview" />
      <SourceStatusBanner
        summary={sourceBannerText}
        warn={sourceWarnActive}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="system-hero">
        <div className="system-header">
          <p className="system-hero-eyebrow">{zhCN.systemOverview.sectionSummary}</p>
          <h2>{zhCN.systemOverview.heading}</h2>
          <p>{zhCN.systemOverview.subtitle}</p>
          <div className="system-hero-status">
            <StatusPill
              label={sourceWarnActive ? zhCN.systemOverview.partial : zhCN.systemOverview.freshnessFresh}
              tone={sourceWarnActive ? "warn" : "good"}
            />
            <span>{sourceBannerText}</span>
          </div>
        </div>
        <div className="system-hero-grid">
          {heroCards.map((item) => (
            <article key={`hero-${item.title}`} className={`system-hero-card tone-${item.tone}`}>
              <span>{item.title}</span>
              <strong>
                {item.value}
                {item.unit ? <em>{item.unit}</em> : null}
              </strong>
              <small>{item.delta}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="system-summary-grid">
        {summaryCards.map((item) => (
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

      <div className="system-layout">
        <SectionCard title={zhCN.systemOverview.sectionTopology}>
          <p className="empty-hint">{zhCN.systemOverview.topologyHint}</p>
          {!spaceHierarchyEnabled ? (
            <p className="empty-hint">{zhCN.systemOverview.topologyProcessModeNote}</p>
          ) : null}
          {topologyPlaceholderActive ? <p className="empty-hint">{zhCN.systemOverview.topologyFallbackNote}</p> : null}
          {topologyNodes.length > 0 ? (
            <div className="topology-column">
              {topologyNodes.map((node) => (
                <article
                  key={node.id || node.label}
                  className={selectedNode?.id === node.id ? "topology-node is-selected" : "topology-node"}
                >
                  <button type="button" className="topology-node-button" onClick={() => setSelectedNodeId(node.id || null)}>
                    <div>
                      <h4>{node.label || zhCN.common.unknown}</h4>
                      <p>{`${zhCN.systemOverview.labels.nodeCount} ${formatCount(node.count)}${zhCN.common.unitItem}`}</p>
                    </div>
                    <StatusPill label={formatTopologyStatus(node.downstream)} tone={topologyTone(node.downstream)} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hint">{zhCN.systemOverview.emptyTopology}</p>
          )}
        </SectionCard>

        <SectionCard title={zhCN.systemOverview.sectionNodeDetail}>
          <p className="empty-hint">{zhCN.systemOverview.detailHint}</p>
          {selectedNode ? (
            <div className="detail-grid">
              {detailItems.map((item) => (
                <article key={item.label}>
                  <label>{item.label}</label>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hint">{zhCN.systemOverview.emptyDetail}</p>
          )}
        </SectionCard>
      </div>

      <div className="system-layout system-layout-secondary">
        <SectionCard title={zhCN.systemOverview.sectionRecommendations}>
          <p className="empty-hint">{zhCN.systemOverview.recommendationsHint}</p>
          <div className="recommendation-list">
            {recommendationCards.map((item) => (
              <RecommendationCard key={item.id} item={item} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={zhCN.systemOverview.sectionRuleSkip}>
          <p className="empty-hint">{diagnosticHint}</p>
          {sourceStatusLines.length > 0 ? <p className="empty-hint">{sourceStatusLines.join("；")}</p> : null}
          <RuleSkipDetails ruleEvaluation={ruleEvaluation} />
        </SectionCard>
      </div>
    </div>
  );
}

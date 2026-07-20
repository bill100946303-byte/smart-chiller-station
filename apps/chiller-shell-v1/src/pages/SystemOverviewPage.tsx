import { startTransition, useEffect, useState, type ReactNode } from "react";
import "./SystemOverviewExtracted.css";
import ReadinessBadge from "../components/common/ReadinessBadge";
import type { ReadinessBadgeViewModel } from "../components/common/ReadinessBadge";
import { runtimeConfig } from "../config/runtimeConfig";
import { controlPolicyPresentation } from "../config/controlPolicy";
import { useShellProjectDisplay } from "../context/ShellProjectDisplayContext";
import useAiDigest from "../hooks/useAiDigest";
import useRecommendationDiagnostics from "../hooks/useRecommendationDiagnostics";
import { getRiskCopy, preferChineseText } from "../i18n/hvacCopybook";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, type LocaleCode, zhCN } from "../i18n/zhCN";
import { resolveUnifiedStatusTone } from "../utils/statusTone";
import {
  type AiDigestDto,
  type DashboardOverviewDto,
  type RecommendationDto,
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

type MetricTone = "neutral" | "good" | "warn" | "danger";
type EfficiencyMetricTone = Exclude<MetricTone, "danger">;

type NodeDetailItem = {
  label: string;
  value: string;
  tone?: MetricTone;
};

type OverviewRecommendation = {
  id: string;
  title: string;
  description: string;
  impact: string;
  risk: string;
  diagnosisSummary: string;
  diagnosisItems: string[];
  actionItems: string[];
  verificationItems: string[];
};

type SystemFocus = {
  domain: string;
  reason: string;
  action: string;
  tone: "good" | "warn" | "neutral";
};

const CHILLED_DELTA_T_LOW = 3;
const COOLING_DELTA_T_LOW = 2.5;
const SYSTEM_OVERVIEW_AUTO_REFRESH_MS = 15_000;
const TOPOLOGY_LABEL_MAP = {
  "zh-CN": {
    "chiller cluster": "冷机群组",
    "chilled pumps": "冷冻泵组",
    "building load": "建筑负荷",
    "cooling pumps": "冷却泵组",
    "cooling towers": "冷却塔群"
  },
  "en-US": {
    "chiller cluster": "Chiller Cluster",
    "chilled pumps": "Chilled Pumps",
    "building load": "Building Load",
    "cooling pumps": "Cooling Pumps",
    "cooling towers": "Cooling Towers"
  },
  "vi-VN": {
    "chiller cluster": "Cụm Chiller",
    "chilled pumps": "Cụm bơm nước lạnh",
    "building load": "Phụ tải tòa nhà",
    "cooling pumps": "Cụm bơm giải nhiệt",
    "cooling towers": "Cụm tháp giải nhiệt"
  }
} as const;

function buildReadinessBadgeText(pass: boolean, locale: LocaleCode): string {
  if (locale === "en-US") {
    return pass ? "Non-Degraded: PASS" : "Non-Degraded: NOT PASS";
  }
  if (locale === "vi-VN") {
    return pass ? "Phi suy giam: Dat" : "Phi suy giam: Chua dat";
  }
  return pass ? "\u975E\u964D\u7EA7\u6001\uFF1A\u901A\u8FC7" : "\u975E\u964D\u7EA7\u6001\uFF1A\u672A\u901A\u8FC7";
}

function buildReadinessPendingText(locale: LocaleCode): string {
  if (locale === "en-US") {
    return "Non-Degraded: Checking";
  }
  if (locale === "vi-VN") {
    return "Phi suy giam: Dang kiem tra";
  }
  return "\u975E\u964D\u7EA7\u6001\uFF1A\u68C0\u6D4B\u4E2D";
}

function localizeTopologyLabel(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.unknown;
  }
  const locale = getCurrentLocale();
  const trimmed = value.trim();
  const match = /^([^(]+?)(\s*\(.*\))?$/.exec(trimmed);
  const baseLabel = (match?.[1] || trimmed).trim().toLowerCase();
  const suffix = match?.[2] || "";
  const translatedBase =
    TOPOLOGY_LABEL_MAP[locale][baseLabel as keyof typeof TOPOLOGY_LABEL_MAP["zh-CN"]] || null;
  if (!translatedBase) {
    return value;
  }
  return `${translatedBase}${suffix}`;
}

function isBuildingLoadNode(node: TopologyNodeDto | null | undefined): boolean {
  const label = node?.label?.trim();
  if (!label) {
    return false;
  }
  const normalized = label.toLowerCase();
  const localizedNormalized = localizeTopologyLabel(label).toLowerCase();
  return (
    normalized === "building load"
    || normalized.startsWith("building load(")
    || normalized.startsWith("building load ")
    || localizedNormalized === "建筑负荷"
    || localizedNormalized.startsWith("建筑负荷(")
    || localizedNormalized.startsWith("建筑负荷 ")
  );
}

const SYSTEM_NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

function getSystemNumberFormatter(digits: number): Intl.NumberFormat {
  const key = String(digits);
  const cached = SYSTEM_NUMBER_FORMATTERS.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  SYSTEM_NUMBER_FORMATTERS.set(key, formatter);
  return formatter;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return getSystemNumberFormatter(digits).format(value);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(value);
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function dedupeTextLines(lines: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  lines.forEach((item) => {
    const normalized = String(item || "").replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    resolved.push(normalized);
  });
  return resolved;
}

function normalizeDisplayText(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isSiteIdOnlyDisplay(value: string | null | undefined, siteId: string): boolean {
  const normalized = normalizeDisplayText(value).toLowerCase();
  const normalizedSiteId = normalizeDisplayText(siteId).toLowerCase();
  if (!normalized || !normalizedSiteId) {
    return false;
  }
  return normalized === normalizedSiteId || normalized === `site ${normalizedSiteId}` || normalized === `项目编号 ${normalizedSiteId}`;
}

function pickSiteDisplayName(siteId: string, ...candidates: Array<string | null | undefined>): string {
  const normalizedCandidates = candidates.map(normalizeDisplayText).filter(Boolean);
  return (
    normalizedCandidates.find((candidate) => !isSiteIdOnlyDisplay(candidate, siteId))
    || normalizedCandidates[0]
    || ""
  );
}

function buildSiteTitleLine(siteId: string, displayName: string): string {
  const normalizedSiteId = normalizeDisplayText(siteId);
  const normalizedDisplayName = normalizeDisplayText(displayName);
  if (!normalizedDisplayName || isSiteIdOnlyDisplay(normalizedDisplayName, normalizedSiteId)) {
    return `项目编号 ${normalizedSiteId}`;
  }
  if (normalizedDisplayName.includes(normalizedSiteId)) {
    return normalizedDisplayName;
  }
  return `${normalizedDisplayName} · 项目编号 ${normalizedSiteId}`;
}

function resolveAdaptiveDiagnosisThresholds(energy: DashboardOverviewDto["energyCards"] | null | undefined): {
  loadRate: number | null;
  chilledDeltaTMin: number;
  coolingDeltaTMin: number;
  systemCopMin: number;
  chillerPowerShareMax: number;
} {
  const loadRate = toFiniteNumber(energy?.currentLoadRate);
  if (loadRate == null) {
    return {
      loadRate: null,
      chilledDeltaTMin: CHILLED_DELTA_T_LOW,
      coolingDeltaTMin: COOLING_DELTA_T_LOW,
      systemCopMin: 4.15,
      chillerPowerShareMax: 0.62
    };
  }

  if (loadRate < 25) {
    return {
      loadRate,
      chilledDeltaTMin: 2.2,
      coolingDeltaTMin: 1.8,
      systemCopMin: 3.2,
      chillerPowerShareMax: 0.75
    };
  }
  if (loadRate < 45) {
    return {
      loadRate,
      chilledDeltaTMin: 2.7,
      coolingDeltaTMin: 2.2,
      systemCopMin: 3.7,
      chillerPowerShareMax: 0.68
    };
  }
  if (loadRate < 75) {
    return {
      loadRate,
      chilledDeltaTMin: 3.0,
      coolingDeltaTMin: 2.5,
      systemCopMin: 4.15,
      chillerPowerShareMax: 0.62
    };
  }
  return {
    loadRate,
    chilledDeltaTMin: 3.2,
    coolingDeltaTMin: 2.8,
    systemCopMin: 3.9,
    chillerPowerShareMax: 0.6
  };
}

function buildRecommendationInsight(
  card: NonNullable<RecommendationDto["cards"]>[number],
  overview: DashboardOverviewDto | null,
  recommendation: RecommendationDto | null,
  sourceWarnActive: boolean
): Pick<OverviewRecommendation, "diagnosisSummary" | "diagnosisItems" | "actionItems" | "verificationItems"> {
  const energy = overview?.energyCards;
  const currentCop = toFiniteNumber(energy?.currentCop);
  const chilledDeltaT = toFiniteNumber(energy?.chilledDeltaT);
  const coolingDeltaT = toFiniteNumber(energy?.coolingDeltaT);
  const chillerPowerKw = toFiniteNumber(energy?.chillerPowerKw);
  const totalPowerKw = toFiniteNumber(energy?.totalPowerKw);
  const adaptiveThresholds = resolveAdaptiveDiagnosisThresholds(energy);
  const recommendationSourceState = recommendation?.sourceStatus?.overall;
  const hasSourceRisk =
    sourceWarnActive
    || overview?.freshness?.stale === true
    || recommendationSourceState === "partial"
    || recommendationSourceState === "failed";

  const chilledLow = chilledDeltaT != null && chilledDeltaT < adaptiveThresholds.chilledDeltaTMin;
  const coolingLow = coolingDeltaT != null && coolingDeltaT < adaptiveThresholds.coolingDeltaTMin;
  const lowSystemCop = currentCop != null && currentCop > 0 && currentCop < adaptiveThresholds.systemCopMin;
  const chillerShare =
    totalPowerKw != null && totalPowerKw > 0 && chillerPowerKw != null
      ? chillerPowerKw / totalPowerKw
      : null;
  const chillerShareHigh = chillerShare != null && chillerShare >= adaptiveThresholds.chillerPowerShareMax;
  const ruleId = String(card.ruleId || "").trim();

  const upstreamReasons = dedupeTextLines([
    preferChineseText(card.reason, ""),
    ...(card.evidence || []).map((item) => preferChineseText(item, ""))
  ]);
  const upstreamActions = dedupeTextLines((card.actions || []).map((item) => preferChineseText(item, "")));

  const diagnosisItems = dedupeTextLines([
    upstreamReasons[0],
    chilledLow
      ? `冷冻温差当前 ${formatNumber(chilledDeltaT, 1)}°C，低于当前工况阈值 ${adaptiveThresholds.chilledDeltaTMin.toFixed(1)}°C，存在“大流量小温差”风险。`
      : null,
    coolingLow
      ? `冷却温差当前 ${formatNumber(coolingDeltaT, 1)}°C，低于当前工况阈值 ${adaptiveThresholds.coolingDeltaTMin.toFixed(1)}°C，冷却侧换热效率偏弱。`
      : null,
    lowSystemCop
      ? `系统实时能效当前 ${formatNumber(currentCop, 2)}，低于当前工况阈值（>= ${adaptiveThresholds.systemCopMin.toFixed(2)}），存在额外电耗风险。`
      : null,
    chillerShareHigh
      ? `主机功率占比约 ${(chillerShare * 100).toFixed(0)}%，高于当前工况阈值 ${(adaptiveThresholds.chillerPowerShareMax * 100).toFixed(0)}%，建议优先核查机组组合与负载落点。`
      : null,
    adaptiveThresholds.loadRate != null
      ? `本次诊断采用自适应阈值（按当前负荷率 ${formatNumber(adaptiveThresholds.loadRate, 1)}% 计算），适配不同项目规模与负荷段。`
      : "当前负荷率未回传，已使用通用阈值进行诊断。",
    hasSourceRisk
      ? "当前存在部分来源异常或数据陈旧信号，建议先确认口径稳定，再执行大幅策略调整。"
      : null,
    ruleId
      ? `触发规则：${ruleId}。`
      : null
  ]);

  const actionItems = dedupeTextLines([
    ...upstreamActions,
    chilledLow ? "优先核查末端旁通、二次阀开度和冷冻泵频率，先消除大流量小温差。" : null,
    chilledLow ? "以 2-5Hz 小步长回调冷冻泵频率，每步观察 10-15 分钟后再继续。" : null,
    coolingLow ? "核查冷却塔风机分级与冷却泵协同，避免只盯固定出水温设定。" : null,
    coolingLow ? "检查冷凝侧换热面污染与塔侧工况，必要时安排清洗或维保。" : null,
    lowSystemCop || chillerShareHigh ? "复核当前主机开机台数与负载率分配，避免低负载多机并联运行。" : null,
    hasSourceRisk ? "先恢复异常来源并确认时间戳连续刷新，再执行高影响调参动作。" : null,
    "执行调整后请保留操作记录，便于班组交接和效果复盘。"
  ]).slice(0, 5);

  const verificationItems = dedupeTextLines([
    chilledLow ? `复核冷冻温差是否回升到 >= ${adaptiveThresholds.chilledDeltaTMin.toFixed(1)}°C，且稳定维持 15 分钟以上。` : null,
    coolingLow ? `复核冷却温差是否回升到 >= ${adaptiveThresholds.coolingDeltaTMin.toFixed(1)}°C，且无明显反复震荡。` : null,
    lowSystemCop ? `复核系统实时能效是否恢复到 >= ${adaptiveThresholds.systemCopMin.toFixed(2)}，且总站功率同步下降。` : null,
    chillerShareHigh ? "复核主机功率占比是否回落到合理区间，并确认泵塔功率未异常抬升。" : null,
    hasSourceRisk ? "复核来源状态是否恢复“正常”，并确认新鲜度持续更新。" : null,
    "复核处置后 15-30 分钟内高优先级告警未继续新增。"
  ]);

  const diagnosisSummary =
    diagnosisItems[0]
    || (
      chilledLow
        ? "当前主要风险落在冷冻侧温差偏低，建议先稳流量再看能效。"
        : coolingLow
          ? "当前主要风险落在冷却侧换热偏弱，建议优先核查塔泵协同。"
          : lowSystemCop
            ? "当前系统实时能效偏弱，建议从主机组合与输送链路协同排查。"
            : hasSourceRisk
              ? "当前数据链路存在异常信号，建议先稳口径再推进策略优化。"
              : "当前建议项已触发，请按处置步骤执行并复核关键指标。"
    );

  return {
    diagnosisSummary,
    diagnosisItems: diagnosisItems.length > 0 ? diagnosisItems : ["当前建议已触发，建议结合现场工况复核执行边界。"],
    actionItems: actionItems.length > 0 ? actionItems : ["建议保持当前策略，并持续观察趋势与告警变化。"],
    verificationItems:
      verificationItems.length > 0
        ? verificationItems
        : ["复核关键指标在 15-30 分钟窗口内持续改善。"]
  };
}

function renderMetricInlineText(text: string): ReactNode {
  const inlineMetricPattern = /(-?\d[\d,]*(?:\.\d+)?)(\s*(?:kW|kWh|KW|°C|℃|%|项|台|秒|s|小时|h|COP|RT|Rt|m³\/h|m3\/h|GPM\/RT|gpm\/rt|kW\/Rt|kW\/RT))?/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null = inlineMetricPattern.exec(text);

  while (match) {
    const full = match[0] || "";
    const numberPart = match[1] || "";
    const unitPart = match[2] || "";
    const start = match.index;
    const end = start + full.length;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <span key={`metric-number-${tokenIndex}`} className="system-metric-inline-number">
        {numberPart}
      </span>
    );
    if (unitPart) {
      nodes.push(
        <span key={`metric-unit-${tokenIndex}`} className="system-metric-inline-unit">
          {unitPart}
        </span>
      );
    }

    tokenIndex += 1;
    lastIndex = end;
    match = inlineMetricPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? <>{nodes}</> : text;
}

function assessThresholdMetricTone(
  value: number | null | undefined,
  excellentMin: number,
  goodMin: number
): EfficiencyMetricTone | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value >= excellentMin) {
    return "good";
  }
  if (value >= goodMin) {
    return "neutral";
  }
  return "warn";
}

function assessSystemEfficiencyTone(value: number | null | undefined): EfficiencyMetricTone | null {
  return assessThresholdMetricTone(value, 5, 4.15);
}

function assessChillerEfficiencyTone(value: number | null | undefined): EfficiencyMetricTone | null {
  return assessThresholdMetricTone(value, 5.7, 5.2);
}

function assessChilledPumpEfficiencyTone(value: number | null | undefined): EfficiencyMetricTone | null {
  return assessThresholdMetricTone(value, 45.9, 41.7);
}

function assessCoolingPumpEfficiencyTone(value: number | null | undefined): EfficiencyMetricTone | null {
  return assessThresholdMetricTone(value, 53.5, 48.6);
}

function assessCoolingTowerEfficiencyTone(value: number | null | undefined): EfficiencyMetricTone | null {
  return assessThresholdMetricTone(value, 108.5, 98.6);
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

function resolveTopologyStatus(node: TopologyNodeDto | null | undefined): "running" | "stable" | "alert" {
  if (!node) {
    return "stable";
  }
  if (node.status === "running" || node.status === "stable" || node.status === "alert") {
    return node.status;
  }
  if (node.downstream === "running" || node.downstream === "stable" || node.downstream === "alert") {
    return node.downstream;
  }
  if (typeof node.count === "number" && !Number.isNaN(node.count)) {
    return node.count > 0 ? "running" : "alert";
  }
  return "stable";
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
  const systemEfficiencyTone = assessSystemEfficiencyTone(cards?.currentCop);

  return [
    {
      title: zhCN.systemOverview.summaryCop,
      value: formatNumber(cards?.currentCop, 2),
      unit: "",
      delta: "",
      tone: systemEfficiencyTone || (partialActive ? "warn" : "neutral")
    },
    {
      title: zhCN.systemOverview.summaryPower,
      value: formatNumber(cards?.totalPowerKw, 1),
      unit: "kW",
      delta: "",
      tone: cards?.totalPowerKw != null ? "good" : "warn"
    },
    {
      title: zhCN.systemOverview.summaryDevices,
      value: formatCount(summary?.totalDevices),
      unit: zhCN.common.unitItem,
      delta: "",
      tone: "neutral"
    },
    {
      title: zhCN.systemOverview.summaryRecommendations,
      value: formatCount(recommendation?.summary?.total),
      unit: zhCN.common.unitItem,
      delta: "",
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
  overview: DashboardOverviewDto | null,
  sourceWarnActive: boolean,
  fallbackReason: string
): OverviewRecommendation[] {
  if (!recommendation?.cards || recommendation.cards.length === 0) {
    const fallbackInsight = buildRecommendationInsight(
      {
        id: "system-rec-fallback",
        reason: fallbackReason,
        actions: [zhCN.systemOverview.recommendationFallbackImpact]
      },
      overview,
      recommendation,
      sourceWarnActive
    );
    return [
      {
        id: "system-rec-fallback",
        title: zhCN.systemOverview.recommendationFallbackTitle,
        description: fallbackReason,
        impact: zhCN.systemOverview.recommendationFallbackImpact,
        risk: zhCN.severity.medium,
        diagnosisSummary: fallbackInsight.diagnosisSummary,
        diagnosisItems: fallbackInsight.diagnosisItems,
        actionItems: fallbackInsight.actionItems,
        verificationItems: fallbackInsight.verificationItems
      }
    ];
  }

  return recommendation.cards.slice(0, 3).map((item, index) => {
    const insight = buildRecommendationInsight(item, overview, recommendation, sourceWarnActive);
    const fallbackDescription = item.ruleId
      ? `规则 ${item.ruleId} 已触发，建议优先处理关键能效约束。`
      : zhCN.systemOverview.recommendationFallbackReason;
    return {
      id: item.id || `system-rec-${index + 1}`,
      title: preferChineseText(item.title, zhCN.systemOverview.recommendationFallbackTitle),
      description: preferChineseText(
        item.reason || item.evidence?.[0],
        fallbackDescription
      ),
      impact: preferChineseText(
        item.actions?.[0],
        "优先执行稳态调整动作，并持续观察关键指标变化。"
      ),
      risk: getRiskCopy(item.risk),
      diagnosisSummary: insight.diagnosisSummary,
      diagnosisItems: insight.diagnosisItems,
      actionItems: insight.actionItems,
      verificationItems: insight.verificationItems
    };
  });
}

function buildNodeDetail(
  node: TopologyNodeDto | null,
  overview: DashboardOverviewDto | null,
  recommendation: RecommendationDto | null
): NodeDetailItem[] {
  const cards = overview?.energyCards;
  const firstRecommendation = recommendation?.cards?.[0] || null;
  const nodeStatus = resolveTopologyStatus(node);
  const resolvedCurrentPowerKw =
    node?.id === "chiller"
      ? cards?.chillerPowerKw
      : node?.id === "chilledPump"
        ? cards?.chilledPumpPowerKw
        : node?.id === "coolingPump"
          ? cards?.coolingPumpPowerKw
          : node?.id === "coolingTower"
            ? cards?.coolingTowerPowerKw
            : cards?.totalPowerKw;
  const resolvedPowerLabel =
    node?.id === "chiller"
      ? "主机总功率"
      : node?.id === "chilledPump"
        ? "冷冻泵总功率"
        : node?.id === "coolingPump"
          ? "冷却泵总功率"
          : node?.id === "coolingTower"
            ? "冷却塔总功率"
            : zhCN.systemOverview.summaryPower;
  const resolvedEfficiencyLabel =
    node?.id === "chiller"
      ? "主机能效"
      : node?.id === "chilledPump"
        ? "冷冻泵输送系数"
        : node?.id === "coolingPump"
          ? "冷却泵输送系数"
          : node?.id === "coolingTower"
            ? "冷却塔输送系数"
            : zhCN.systemOverview.labels.systemCop;
  const resolvedEfficiencyValue =
    node?.id === "chiller"
      ? cards?.chillerCop
      : node?.id === "chilledPump"
        ? cards?.chilledPumpConveyingCoefficient
        : node?.id === "coolingPump"
          ? cards?.coolingPumpConveyingCoefficient
          : node?.id === "coolingTower"
            ? cards?.coolingTowerConveyingCoefficient
            : cards?.currentCop;
  const resolvedEfficiencyTone =
    node?.id === "chiller"
      ? assessChillerEfficiencyTone(resolvedEfficiencyValue)
      : node?.id === "chilledPump"
        ? assessChilledPumpEfficiencyTone(resolvedEfficiencyValue)
        : node?.id === "coolingPump"
          ? assessCoolingPumpEfficiencyTone(resolvedEfficiencyValue)
          : node?.id === "coolingTower"
            ? assessCoolingTowerEfficiencyTone(resolvedEfficiencyValue)
            : assessSystemEfficiencyTone(resolvedEfficiencyValue);
  return [
    {
      label: zhCN.systemOverview.labels.node,
      value: localizeTopologyLabel(node?.label)
    },
    {
      label: zhCN.systemOverview.labels.status,
      value: formatTopologyStatus(nodeStatus),
      tone: resolveUnifiedStatusTone(formatTopologyStatus(nodeStatus))
    },
    {
      label: resolvedPowerLabel,
      value:
        typeof resolvedCurrentPowerKw === "number" && Number.isFinite(resolvedCurrentPowerKw)
          ? `${formatNumber(resolvedCurrentPowerKw, 1)} kW`
          : zhCN.systemOverview.pendingValue
    },
    {
      label: resolvedEfficiencyLabel,
      value:
        typeof resolvedEfficiencyValue === "number" && Number.isFinite(resolvedEfficiencyValue)
          ? formatNumber(resolvedEfficiencyValue, 2)
          : zhCN.systemOverview.pendingValue,
      tone: resolvedEfficiencyTone || "neutral"
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

function deriveSystemFocus(
  overview: DashboardOverviewDto | null,
  recommendation: RecommendationDto | null
): SystemFocus {
  const cards = overview?.energyCards;
  const currentCop = cards?.currentCop;
  const chillerPower = cards?.chillerPowerKw;
  const chilledPumpPower = cards?.chilledPumpPowerKw;
  const coolingPower = (cards?.coolingPumpPowerKw || 0) + (cards?.coolingTowerPowerKw || 0);
  const chilledDeltaT = cards?.chilledDeltaT;
  const coolingDeltaT = cards?.coolingDeltaT;
  const fallbackAction = recommendation?.cards?.[0]?.actions?.[0] || null;

  if (
    typeof chillerPower !== "number"
    && typeof chilledDeltaT !== "number"
    && typeof coolingDeltaT !== "number"
  ) {
    return {
      domain: zhCN.systemOverview.focusPending,
      reason: zhCN.systemOverview.focusPendingReason,
      action: zhCN.systemOverview.focusPendingAction,
      tone: "warn"
    };
  }

  if (typeof chilledDeltaT === "number" && chilledDeltaT < CHILLED_DELTA_T_LOW) {
    return {
      domain: zhCN.systemOverview.focusChilled,
      reason: zhCN.systemOverview.focusChilledReason,
      action: fallbackAction || zhCN.systemOverview.focusChilledAction,
      tone: "warn"
    };
  }

  if (typeof coolingDeltaT === "number" && coolingDeltaT < COOLING_DELTA_T_LOW) {
    return {
      domain: zhCN.systemOverview.focusCooling,
      reason: zhCN.systemOverview.focusCoolingReason,
      action: fallbackAction || zhCN.systemOverview.focusCoolingAction,
      tone: "warn"
    };
  }

  if (
    typeof chillerPower === "number"
    && chillerPower > Math.max(chilledPumpPower || 0, coolingPower || 0)
    && typeof currentCop === "number"
    && currentCop > 0
    && currentCop < 4.5
  ) {
    return {
      domain: zhCN.systemOverview.focusChiller,
      reason: zhCN.systemOverview.focusChillerReason,
      action: fallbackAction || zhCN.systemOverview.focusChillerAction,
      tone: "warn"
    };
  }

  return {
    domain: zhCN.systemOverview.focusCoordinated,
    reason: zhCN.systemOverview.focusCoordinatedReason,
    action: fallbackAction || zhCN.systemOverview.focusCoordinatedAction,
    tone: "good"
  };
}

function mapAiDigestTone(tone: string | undefined): SystemFocus["tone"] {
  if (tone === "positive") {
    return "good";
  }
  if (tone === "caution" || tone === "danger") {
    return "warn";
  }
  return "neutral";
}

function buildSystemFocusFromDigest(aiDigest: AiDigestDto | null, fallback: SystemFocus): SystemFocus {
  if (!aiDigest?.summary?.label && !aiDigest?.summary?.headline && !aiDigest?.nextAction?.label) {
    return fallback;
  }

  return {
    domain: aiDigest.summary?.label || fallback.domain,
    reason: aiDigest.summary?.summary || aiDigest.summary?.headline || fallback.reason,
    action: aiDigest.nextAction?.label || aiDigest.nextAction?.summary || fallback.action,
    tone: mapAiDigestTone(aiDigest.summary?.tone)
  };
}

export default function SystemOverviewPage() {
  const shellProjectDisplayName = useShellProjectDisplay();
  const { aiDigest } = useAiDigest(runtimeConfig.siteId);
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [topology, setTopology] = useState<SystemTopologyDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readinessChecked, setReadinessChecked] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshCountdownSeconds, setRefreshCountdownSeconds] = useState(
    Math.round(SYSTEM_OVERVIEW_AUTO_REFRESH_MS / 1000)
  );
  const {
    recommendation,
    ruleEvaluation,
    diagnosticHint,
    loading: recommendationLoading,
    loadError: recommendationLoadError
  } = useRecommendationDiagnostics(runtimeConfig.siteId);

  useEffect(() => {
    if (nextRefreshAt == null) {
      setRefreshCountdownSeconds(Math.round(SYSTEM_OVERVIEW_AUTO_REFRESH_MS / 1000));
      return;
    }
    const refreshDeadline = nextRefreshAt;

    function syncCountdown() {
      const remainingSeconds = Math.max(0, Math.ceil((refreshDeadline - Date.now()) / 1000));
      setRefreshCountdownSeconds(remainingSeconds);
    }

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [nextRefreshAt]);

  const refreshCountdownLabel = nextRefreshAt == null ? "刷新中" : `${refreshCountdownSeconds}s`;

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshTimer: number | null = null;

    function scheduleRefreshWithDelay(delayMs: number) {
      if (!active) {
        return;
      }
      const nextAt = Date.now() + delayMs;
      setNextRefreshAt(nextAt);
      setRefreshCountdownSeconds(Math.max(0, Math.ceil(delayMs / 1000)));
      refreshTimer = window.setTimeout(() => {
        setNextRefreshAt(null);
        void load();
      }, delayMs);
    }

    async function load() {
      if (refreshing) {
        return;
      }
      refreshing = true;
      try {
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
          setReadinessChecked(true);
        });
      } finally {
        refreshing = false;
        scheduleRefreshWithDelay(SYSTEM_OVERVIEW_AUTO_REFRESH_MS);
      }
    }

    void load();
    return () => {
      active = false;
      setNextRefreshAt(null);
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [runtimeConfig.siteId]);

  const topologyNodes = topology?.nodes || [];
  const orderedTopologyNodes = [...topologyNodes].sort((left, right) => {
    return Number(isBuildingLoadNode(right)) - Number(isBuildingLoadNode(left));
  });
  const topologyDisplayNodes = orderedTopologyNodes.filter((item) => !isBuildingLoadNode(item));
  const selectedNode =
    topologyDisplayNodes.find((item) => item.id === selectedNodeId) || topologyDisplayNodes[0] || null;
  const selectedNodeLabel = localizeTopologyLabel(selectedNode?.label);
  const pageSourceStatuses = [overview?.sourceStatus, topology?.sourceStatus, recommendation?.sourceStatus];
  const sourceSummary = summarizeSourceStatus(pageSourceStatuses);
  const sourceWarnActive = Boolean(loadError) || Boolean(recommendationLoadError) || sourceSummary.warn;
  const locale = getCurrentLocale();
  const liveReadinessBadge: ReadinessBadgeViewModel = readinessChecked
    ? {
        pass: !sourceWarnActive,
        text: buildReadinessBadgeText(!sourceWarnActive, locale)
      }
    : {
        pass: false,
        text: buildReadinessPendingText(locale)
      };
  const statusDigestLines = Array.from(new Set(buildSourceStatusLines(pageSourceStatuses, {
    labelMode: "short"
  }).filter(Boolean))).slice(0, 4);
  const sourceCommandText = aiDigest?.summary?.summary || (loadError || recommendationLoadError
    ? "数据状态：部分异常"
    : sourceSummary.warn
      ? "数据状态：异常"
      : "数据状态：正常");
  const summaryCards = buildSummaryCards(overview, topology, recommendation, sourceSummary.warn);
  const recommendationCards = buildRecommendationCards(
    recommendation,
    overview,
    sourceWarnActive,
    recommendationLoadError || zhCN.systemOverview.recommendationFallbackReason
  );
  const buildingLoadNode = orderedTopologyNodes.find((item) => isBuildingLoadNode(item)) || null;
  const detailItems = buildNodeDetail(selectedNode, overview, recommendation);
  const focus = buildSystemFocusFromDigest(aiDigest, deriveSystemFocus(overview, recommendation));
  const cards = overview?.energyCards || null;
  const summary = topology?.summary || overview?.deviceSummary || null;
  const chilledSupplyTemp = toFiniteNumber(cards?.chilledSupplyTemp);
  const chilledDeltaT = toFiniteNumber(cards?.chilledDeltaT);
  const chilledReturnTemp =
    chilledSupplyTemp != null && chilledDeltaT != null ? chilledSupplyTemp + chilledDeltaT : null;
  const coolingReturnTemp = toFiniteNumber(cards?.coolingReturnTemp);
  const coolingDeltaT = toFiniteNumber(cards?.coolingDeltaT);
  const coolingSupplyTemp =
    coolingReturnTemp != null && coolingDeltaT != null ? coolingReturnTemp + coolingDeltaT : null;
  const wetBulbTemp = toFiniteNumber(cards?.outdoorWetBulbC);
  const towerApproach =
    coolingReturnTemp != null && wetBulbTemp != null ? coolingReturnTemp - wetBulbTemp : null;
  const towerApproachHealthy = towerApproach != null && towerApproach <= 4.5;
  const pendingApprovalCount =
    aiDigest?.metrics?.pendingApprovalCount
    ?? aiDigest?.governance?.pendingApprovalCount
    ?? recommendation?.summary?.total
    ?? null;
  const primaryRecommendation = recommendationCards[0] || null;
  const detailPreviewItems = detailItems.slice(0, 3);
  const physicalPumpCount = (summary?.chilledPumpCount || 0) + (summary?.coolingPumpCount || 0);
  const physicalSummary = `冷机 ${formatCount(summary?.chillerCount)} / 泵 ${formatCount(physicalPumpCount)} / 塔 ${formatCount(summary?.coolingTowerCount)}`;
  const optimizeHref = `/optimize-demo?siteId=${encodeURIComponent(runtimeConfig.siteId)}`;
  const auditHref = `/operation-records?siteId=${encodeURIComponent(runtimeConfig.siteId)}`;
  const siteTitle = pickSiteDisplayName(
    runtimeConfig.siteId,
    shellProjectDisplayName,
    overview?.site?.siteName,
    topology?.site?.siteName
  );
  const siteTitleLine = buildSiteTitleLine(runtimeConfig.siteId, siteTitle);
  const refreshBadgeText = `自动刷新 ${refreshCountdownLabel}`;
  const overviewKpis = [
    {
      label: "系统综合COP",
      value: formatNumber(cards?.currentCop, 2),
      detail:
        typeof cards?.savingPotentialPct === "number" && Number.isFinite(cards.savingPotentialPct)
          ? `节能潜力 ${formatNumber(cards.savingPotentialPct, 1)}%`
          : sourceWarnActive ? "数据陈旧，先复核来源" : summaryCards[0]?.delta || "实时采集口径",
      tone: summaryCards[0]?.tone || "neutral"
    },
    {
      label: "站房负荷率",
      value: typeof cards?.currentLoadRate === "number" ? `${formatNumber(cards.currentLoadRate, 0)}%` : "--",
      detail: "按当前冷量/额定冷量计算",
      tone: "neutral" as const
    },
    {
      label: "冷冻水供/回",
      value:
        chilledSupplyTemp != null && chilledReturnTemp != null
          ? `${formatNumber(chilledSupplyTemp, 1)} / ${formatNumber(chilledReturnTemp, 1)}°C`
          : chilledDeltaT != null ? `ΔT ${formatNumber(chilledDeltaT, 1)}°C` : "--",
      detail:
        chilledSupplyTemp != null && chilledReturnTemp != null
          ? `ΔT ${formatNumber(chilledDeltaT, 1)}°C`
          : chilledDeltaT != null ? "供/回温度待接入" : "温差待回传",
      tone: chilledDeltaT != null && chilledDeltaT >= CHILLED_DELTA_T_LOW ? "good" as const : "warn" as const
    },
    {
      label: "控制边界",
      value:
        pendingApprovalCount != null && pendingApprovalCount > 0
          ? `${formatCount(pendingApprovalCount)}条待审`
          : "AI建议 / PLC保护",
      detail: "真实下发锁定，审批后仍受PLC限幅",
      tone: "warn" as const
    }
  ];
  const topologyLookup = new Map(topologyDisplayNodes.map((node) => [node.id || localizeTopologyLabel(node.label), node]));
  const getTopologyNode = (id: string, label: string) =>
    topologyLookup.get(id) || topologyDisplayNodes.find((node) => localizeTopologyLabel(node.label).includes(label)) || null;
  const loadMetricLines = dedupeTextLines([
    typeof cards?.currentLoadRate === "number" ? `负荷率 ${formatNumber(cards.currentLoadRate, 1)}%` : "负荷率待回传",
    typeof cards?.totalCoolingCapacity === "number" ? `冷量 ${formatNumber(cards.totalCoolingCapacity, 0)} kW` : "冷量待回传"
  ]).slice(0, 2);
  const equipmentCards = [
    {
      id: "load",
      label: "末端负荷",
      subtitle: "建筑侧负荷",
      meta: loadMetricLines.length > 0 ? loadMetricLines : ["负荷关键值待回传"],
      status: cards?.currentLoadRate != null ? "负荷稳定" : "待回传",
      tone: "neutral" as const,
      node: buildingLoadNode
    },
    {
      id: "chilledPump",
      label: "冷冻水泵组",
      subtitle: `${formatCount(summary?.chilledPumpCount)}台 · 权限待核验`,
      meta: [
        cards?.chilledPumpPowerKw != null ? `功率 ${formatNumber(cards.chilledPumpPowerKw, 1)} kW` : "功率待回传",
        chilledDeltaT != null ? `冷冻ΔT ${formatNumber(chilledDeltaT, 1)}°C` : "冷冻ΔT待回传"
      ],
      status: "AI建议需审批",
      tone: "warn" as const,
      node: getTopologyNode("chilledPump", "冷冻")
    },
    {
      id: "chiller",
      label: "冷水机组",
      subtitle: `${formatCount(summary?.chillerCount)}台物理设备`,
      meta: [
        cards?.chillerPowerKw != null ? `主机功率 ${formatNumber(cards.chillerPowerKw, 1)} kW` : "主机功率待回传",
        cards?.chillerCop != null ? `主机COP ${formatNumber(cards.chillerCop, 2)}` : `系统COP ${formatNumber(cards?.currentCop, 2)}`,
        "防频启停由PLC保证"
      ],
      status: "组合稳定优先",
      tone: "good" as const,
      node: getTopologyNode("chiller", "冷机")
    },
    {
      id: "coolingPump",
      label: "冷却水泵组",
      subtitle: `${formatCount(summary?.coolingPumpCount)}台 · 权限待核验`,
      meta: [
        cards?.coolingPumpPowerKw != null ? `功率 ${formatNumber(cards.coolingPumpPowerKw, 1)} kW` : "功率待回传",
        coolingDeltaT != null ? `冷却ΔT ${formatNumber(coolingDeltaT, 1)}°C` : "冷却ΔT待回传"
      ],
      status: "维持当前",
      tone: "good" as const,
      node: getTopologyNode("coolingPump", "冷却泵")
    },
    {
      id: "coolingTower",
      label: "冷却塔",
      subtitle: `${formatCount(summary?.coolingTowerCount)}组 · 湿球跟踪`,
      meta: [
        coolingReturnTemp != null ? `低温侧 ${formatNumber(coolingReturnTemp, 1)}°C` : "低温侧待回传",
        towerApproach != null ? `接近度 ${formatNumber(towerApproach, 1)}°C` : "接近度待接入",
        "风机低频保护"
      ],
      status: towerApproach == null ? "待回传" : towerApproachHealthy ? "接近度良好" : "需复核",
      tone: towerApproach == null ? "neutral" as const : towerApproachHealthy ? "good" as const : "warn" as const,
      node: getTopologyNode("coolingTower", "冷却塔")
    }
  ];
  const concernItems = dedupeTextLines([
    primaryRecommendation?.id === "system-rec-fallback"
      ? (recommendationLoading ? null : "建议服务未返回可用建议，保持影子审阅")
      : primaryRecommendation?.diagnosisItems?.[0],
    ruleEvaluation?.matchedRuleIds?.length ? `已触发规则 ${ruleEvaluation.matchedRuleIds.slice(0, 2).join(" / ")}` : null,
    !recommendationLoading && diagnosticHint !== zhCN.diagnostics.loading ? `规则诊断：${diagnosticHint}` : null,
    sourceWarnActive ? sourceCommandText : null,
    towerApproach != null
      ? `接近度 ${formatNumber(towerApproach, 1)}°C ${towerApproachHealthy ? "良好，不应误标异常" : "偏高，需复核塔侧"}`
      : "接近度需接入湿球与冷却水低温侧数据"
  ]).slice(0, 3);
  const evidenceCards = [
    {
      label: "采集质量",
      value: `${formatCount(summary?.totalDevices)} 点/设备`,
      note: sourceWarnActive ? "存在来源异常或陈旧信号" : "采集协议与点位口径正常",
      tone: sourceWarnActive ? "warn" : "good"
    },
    {
      label: "物理设备",
      value: physicalSummary,
      note: "总览只展示主链路，强制/本地状态进设备页核验",
      tone: "neutral"
    },
    {
      label: "AI优化",
      value:
        pendingApprovalCount != null && pendingApprovalCount > 0
          ? `${formatCount(pendingApprovalCount)}条建议待审`
          : `${formatCount(recommendation?.summary?.total)}条建议`,
      note: "AI不直接写PLC，不闭环控制",
      tone: "warn"
    }
  ];

  useEffect(() => {
    if (!selectedNodeId && topologyDisplayNodes[0]?.id) {
      setSelectedNodeId(topologyDisplayNodes[0].id);
    }
  }, [selectedNodeId, topologyDisplayNodes]);

  return (
    <div className="system-page system-overview-one-screen page-enter">
      <ReadinessBadge pageKey="systemOverview" liveViewModel={liveReadinessBadge} />

      <header className="system-overview-topbar" aria-label="系统总览标题">
        <div className="system-overview-title-block">
          <span>{runtimeConfig.appModeLabel}</span>
          <h1>{zhCN.systemOverview.heading}</h1>
          <p>{siteTitleLine} · {sourceCommandText}</p>
        </div>
        <div className="system-overview-badges" aria-label="系统状态">
          <span className={sourceWarnActive ? "is-warn" : "is-good"}>{sourceWarnActive ? "来源需复核" : "数据链路正常"}</span>
          <span className="is-warn">真实下发锁定</span>
          <span>AI建议待审批</span>
          <span>{refreshBadgeText}</span>
        </div>
      </header>

      <section className="system-overview-kpis" aria-label="关键指标">
        {overviewKpis.map((item) => (
          <article key={item.label} className={`system-overview-kpi tone-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="system-overview-workbench">
        <article className="system-overview-topology" aria-label="冷站运行拓扑">
          <div className="system-overview-panel-head">
            <div>
              <h2>冷站运行拓扑</h2>
              <p>供回水、冷却水、设备状态和AI控制边界在同一张工程图内闭环</p>
            </div>
            <span>当前聚焦：{selectedNodeLabel}</span>
          </div>
          <div className="system-overview-canvas">
            <span className="system-overview-zone is-chilled">冷冻水侧：供回水稳定性</span>
            <span className="system-overview-zone is-cooling">冷却水侧：接近度{towerApproachHealthy ? "良好" : "需复核"}</span>
            <span className="system-overview-pipe is-chilled-supply" />
            <span className="system-overview-pipe is-chilled-supply-drop" />
            <span className="system-overview-pipe is-chilled-return" />
            <span className="system-overview-pipe is-chilled-return-drop" />
            <span className="system-overview-pipe is-cooling-supply" />
            <span className="system-overview-pipe is-cooling-supply-drop" />
            <span className="system-overview-pipe is-cooling-return" />
            <span className="system-overview-pipe is-cooling-return-drop" />
            <span className="system-overview-pipe-label is-chilled-supply-label">
              冷冻水供水 {chilledSupplyTemp != null ? `${formatNumber(chilledSupplyTemp, 1)}°C` : "--"}
            </span>
            <span className="system-overview-pipe-label is-chilled-return-label">
              冷冻水回水 {chilledReturnTemp != null ? `${formatNumber(chilledReturnTemp, 1)}°C` : "--"}
            </span>
            <span className="system-overview-pipe-label is-cooling-supply-label">
              冷却水出水 {coolingSupplyTemp != null ? `${formatNumber(coolingSupplyTemp, 1)}°C` : "--"}
            </span>
            <span className="system-overview-pipe-label is-cooling-return-label">
              冷却水回水 {coolingReturnTemp != null ? `${formatNumber(coolingReturnTemp, 1)}°C` : "--"}
            </span>
            {equipmentCards.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`system-overview-equipment is-${item.id} tone-${item.tone}${selectedNode?.id && item.node?.id === selectedNode.id ? " is-selected" : ""}`}
                onClick={() => setSelectedNodeId(item.node?.id || item.id)}
              >
                <strong>
                  <span />
                  {item.label}
                </strong>
                <small>{item.subtitle}</small>
                {item.meta.map((line) => (
                  <em key={`${item.id}-${line}`}>{renderMetricInlineText(line)}</em>
                ))}
                <b>{item.status}</b>
              </button>
            ))}
            <div className="system-overview-boundary">
              <strong>AI只输出建议值，PLC执行安全边界</strong>
              <p>限幅 · 步长 · 最小频率 · 供水温度上限 · 故障闭锁 · 人工审批</p>
              <div>
                <span className="is-warn">真实PLC下发：锁定</span>
                <span>建议进入审批队列</span>
              </div>
            </div>
          </div>
        </article>

        <aside className="system-overview-diagnosis" aria-label="运行诊断">
          <div className="system-overview-panel-head">
            <div>
              <h2>运行诊断</h2>
              <p>当前系统可优化，但不可真实下发</p>
            </div>
          </div>
          <section className="system-overview-verdict">
            <span>本轮结论</span>
            <strong>{primaryRecommendation?.title || focus.domain}</strong>
            <em>{pendingApprovalCount != null && pendingApprovalCount > 0 ? "需人工审批 / 待审建议" : "影子验证 / 继续观察"}</em>
          </section>
          <section className="system-overview-concerns">
            <h3>工程关注点</h3>
            {concernItems.map((item) => (
              <article
                key={item}
                className={item.includes("接近度") && towerApproachHealthy ? "tone-good" : "tone-warn"}
              >
                <strong>{renderMetricInlineText(item)}</strong>
              </article>
            ))}
          </section>
          <section className="system-overview-plc-rules">
            <h3>{`控制保护边界 · ${controlPolicyPresentation.statusLabel}`}</h3>
            <div><span>泵最低频率</span><strong>按现场变频器下限</strong></div>
            <div><span>单步调节</span><strong>{controlPolicyPresentation.stepRateBoundary}</strong></div>
            <div><span>冷冻供水上限</span><strong>{controlPolicyPresentation.chilledSupplyBoundary}</strong></div>
            <div><span>故障/告警</span><strong className="tone-warn">立即回退</strong></div>
          </section>
          <section className="system-overview-node-preview">
            <h3>当前节点</h3>
            {detailPreviewItems.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong className={`tone-${item.tone || "neutral"}`}>{item.value}</strong>
              </div>
            ))}
          </section>
          <div className="system-overview-actions">
            <a href={optimizeHref}>查看AI建议</a>
            <a href={auditHref}>查看审计</a>
          </div>
        </aside>
      </section>

      <section className="system-overview-evidence" aria-label="运行证据链">
        <div className="system-overview-evidence-copy">
          <h2>运行证据链</h2>
          <p>总览页只保留态势、风险和跳转依据；AI审批、设备远程切换、真实下发进入专页。</p>
        </div>
        {evidenceCards.map((item) => (
          <article key={item.label} className={`tone-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
        {statusDigestLines.slice(0, 2).map((item) => (
          <span key={item} className="system-overview-source-chip">
            {item}
          </span>
        ))}
      </section>
    </div>
  );
}

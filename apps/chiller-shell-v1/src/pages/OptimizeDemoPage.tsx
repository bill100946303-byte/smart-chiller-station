import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import { getAuthSession, getCurrentProject } from "../services/auth";
import {
  type DashboardOverviewDto,
  type OptimizeDraftDetailsDto,
  type OptimizeDraftErrorDto,
  type SceneLegacyTrendDto,
  fetchDashboardOverview,
  fetchSceneLegacyTrend,
  postOptimizeDraft
} from "../services/bffClient";

type DraftGate = {
  level?: "ready" | "caution" | "blocked" | string;
  title?: string;
  reason?: string;
};

type DraftBaseline = {
  systemCop?: number | null;
  totalPowerKw?: number | null;
  chilledDeltaT?: number | null;
  coolingDeltaT?: number | null;
  chillerPowerKw?: number | null;
  chilledPumpPowerKw?: number | null;
  coolingPumpPowerKw?: number | null;
  coolingTowerPowerKw?: number | null;
  chilledSupplyTemp?: number | null;
  coolingReturnTemp?: number | null;
  thermalUnbalanceRate?: number | null;
  activeAlarmCount?: number | null;
};

type DraftHistoryBenchmark = {
  status?: "ready" | "partial" | "unavailable" | string;
  mode?: "load-band" | string;
  ratedCoolingCapacityKw?: number | null;
  requestedLoadRatePct?: number | null;
  matchedBucketLabel?: string;
  matchingTier?: "load-wetbulb-strict" | "load-wetbulb-relaxed" | "load-only-fallback" | "unavailable" | string;
  fallbackLevel?: number | null;
  requestedWetBulbC?: number | null;
  matchedWetBulbBand?: string;
  matchedWetBulbBands?: string[];
  wetBulbToleranceC?: number | null;
  confidence?: "high" | "medium" | "low" | string;
  sampleWindow?:
    | {
        defaultMonths?: string[];
        months?: string[];
        maxMonths?: number | null;
      }
    | string
    | string[];
  sampleCount?: number | null;
  referenceCop?: {
    low?: number | null;
    median?: number | null;
    high?: number | null;
  };
  currentGap?: {
    copDeltaToMedian?: number | null;
    powerDeltaKwToMedian?: number | null;
  };
  note?: string;
  links?: {
    proportionHref?: DraftLink;
    compareHref?: DraftLink;
  };
};

type DraftBenefitBasis = {
  matchingTier?: string;
  fallbackLevel?: number | null;
  sampleCount?: number | null;
  monthCount?: number | null;
  matchedWetBulbBand?: string;
  matchedWetBulbBands?: string[];
  requestedWetBulbC?: number | null;
  wetBulbToleranceC?: number | null;
};

type DraftBenefitEstimate = {
  status?: "ready" | "partial" | "unavailable" | string;
  opportunityLevel?: "low" | "medium" | "high" | string;
  confidence?: "high" | "medium" | "low" | string;
  expectedTargetCop?: number | null;
  expectedTargetPowerKw?: number | null;
  expectedPowerDeltaKw?: number | null;
  expectedPowerDeltaPct?: number | null;
  expectedCopDelta?: number | null;
  basis?: DraftBenefitBasis;
  disclaimer?: string;
};

type DraftReviewReadiness = {
  status?: "ready" | "partial" | "unavailable" | string;
  score?: number | null;
  reason?: string;
  missingSignals?: string[];
  hints?: string[];
};

type DraftLink = {
  href?: string;
  enabled?: boolean;
  label?: string;
};

type DraftDeviceAction = {
  system?: string;
  action?: string;
  target?: string;
  reason?: string;
  risk?: "low" | "medium" | "high" | string;
  priority?: "high" | "medium" | "low" | string;
  preconditions?: string[];
};

type DraftScheme = {
  key?: "conservative" | "balanced" | "efficiencyFirst" | string;
  title?: string;
  status?: "ready" | "caution" | "blocked" | string;
  riskLevel?: "low" | "medium" | "high" | string;
  focus?: string;
  label?: string;
  targetPowerKw?: number | null;
  targetCop?: number | null;
  powerDeltaPct?: number | null;
  copDelta?: number | null;
  deviceActions?: DraftDeviceAction[];
  readiness?: {
    score?: number | null;
    level?: "ready" | "caution" | "blocked" | string;
    reason?: string;
    blockers?: string[];
    checkpoints?: string[];
  };
  actions?: string[];
  links?: {
    devices?: DraftLink;
    trends?: DraftLink;
    scene?: DraftLink;
  };
};

type DraftPrimaryCard = {
  id?: string;
  title?: string;
  reason?: string;
  severity?: string;
  risk?: string;
  actions?: string[];
};

type DraftSkippedRule = {
  ruleId?: string;
  reason?: string;
  missingMetrics?: Array<{
    metric?: string;
    category?: string;
    message?: string | null;
  }>;
};

type DraftRuleEvidence = {
  matchedCount?: number;
  skippedCount?: number;
  matchedRuleIds?: string[];
  skippedRules?: DraftSkippedRule[];
  primaryCards?: DraftPrimaryCard[];
};

type ExtendedOptimizeDraftDetails = OptimizeDraftDetailsDto & {
  gate?: DraftGate;
  baseline?: DraftBaseline;
  historyBenchmark?: DraftHistoryBenchmark;
  benefitEstimate?: DraftBenefitEstimate;
  reviewReadiness?: DraftReviewReadiness;
  schemes?: DraftScheme[];
  ruleEvidence?: DraftRuleEvidence;
  draftLabel?: string;
};

type AutoPrefillKind = "loading" | "ready" | "partial" | "error";

type AutoPrefillState = {
  kind: AutoPrefillKind;
  loadSource: string | null;
  wetBulbSource: string | null;
  refreshedAt: string | null;
};

const WET_BULB_TAG_NAME = "506-40689";
const CHILLED_STRATEGY_LOW_DELTA_T = 3;
const COOLING_STRATEGY_LOW_DELTA_T = 2.5;

function localizeOptimizeConfidence(value: string | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (value === "rule-based-draft-stable") {
    return "规则型稳定草案";
  }
  if (value === "rule-based-draft-partial") {
    return "规则型部分草案";
  }
  if (value === "rule-based-draft-degraded") {
    return "规则型降级草案";
  }
  return value;
}

function localizeOptimizeSummary(text: string | undefined): string {
  if (!text) {
    return zhCN.optimizeDemo.pendingValue;
  }

  let match = text.match(
    /^context-backed draft derived from overview, anomalies \((\d+)\), and recommendation cards \((\d+)\); requested scenario (.+)$/
  );
  if (match) {
    const [, alarms, cards, scenario] = match;
    return `当前草案基于总览、异常（${alarms}）和建议卡片（${cards}）生成；请求场景为 ${scenario}`;
  }

  match = text.match(
    /^context-backed draft derived from current station overview; no recommendation cards matched, requested scenario (.+)$/
  );
  if (match) {
    return `当前草案基于站点现态总览生成；当前没有匹配的建议卡片；请求场景为 ${match[1]}`;
  }

  return text;
}

function localizeDeviceSystem(value: string | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.deviceActionSystemUnknown;
  }
  if (value === "chiller") {
    return zhCN.optimizeDemo.deviceActionSystemChiller;
  }
  if (value === "chilledPump") {
    return zhCN.optimizeDemo.deviceActionSystemChilledPump;
  }
  if (value === "coolingPump") {
    return zhCN.optimizeDemo.deviceActionSystemCoolingPump;
  }
  if (value === "coolingTower") {
    return zhCN.optimizeDemo.deviceActionSystemCoolingTower;
  }
  if (value === "system") {
    return zhCN.optimizeDemo.deviceActionSystemSystem;
  }
  return value;
}

function localizeDeviceRisk(value: string | undefined): string {
  if (value === "low") {
    return zhCN.optimizeDemo.deviceActionRiskLow;
  }
  if (value === "medium") {
    return zhCN.optimizeDemo.deviceActionRiskMedium;
  }
  if (value === "high") {
    return zhCN.optimizeDemo.deviceActionRiskHigh;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeDevicePriority(value: string | undefined): string {
  if (value === "high") {
    return zhCN.optimizeDemo.deviceActionPriorityHigh;
  }
  if (value === "medium") {
    return zhCN.optimizeDemo.deviceActionPriorityMedium;
  }
  if (value === "low") {
    return zhCN.optimizeDemo.deviceActionPriorityLow;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeOptimizeStep(step: string): string {
  let match = step.match(/^Review active alarms first: critical=(\d+), major=(\d+)$/);
  if (match) {
    return `优先核查当前活动告警：紧急=${match[1]}，严重=${match[2]}`;
  }

  match = step.match(/^Review recommendation card: (.+)$/);
  if (match) {
    return `优先查看建议卡片：${match[1]}`;
  }

  match = step.match(/^Use current station snapshot as draft baseline: COP=(.+), totalPowerKw=(.+)$/);
  if (match) {
    return `以当前站点现态作为草案基线：COP=${match[1]}，总功率=${match[2]}`;
  }

  if (step === "Current station efficiency snapshot is incomplete; keep optimize output at draft level.") {
    return "当前站点能效快照不完整，优化结果维持在解释型草案层级。";
  }

  match = step.match(
    /^Requested scenario implies much higher draft power than the current snapshot \(ratio=(.+)\); treat the draft as directional only$/
  );
  if (match) {
    return `请求场景推导出的草案功率显著高于当前快照（倍率=${match[1]}），当前草案仅作方向性参考。`;
  }

  match = step.match(
    /^Requested scenario implies lower draft power than the current snapshot \(ratio=(.+)\); validate whether the current equipment mix can be relaxed$/
  );
  if (match) {
    return `请求场景推导出的草案功率低于当前快照（倍率=${match[1]}），请核查当前设备组合是否存在放宽空间。`;
  }

  if (step === "Current COP snapshot is unavailable or non-positive; keep optimize interpretation at explanatory draft level") {
    return "当前 COP 快照不可用或不为正值，优化解释维持在说明型草案层级。";
  }

  match = step.match(
    /^Rule diagnostics still have (\d+) skipped item\(s\); keep draft review focused on observable signals first$/
  );
  if (match) {
    return `规则诊断仍有 ${match[1]} 个跳过项；当前草案请优先依据可观测信号进行判断。`;
  }

  match = step.match(/^Requested scenario fixed for draft review: loadKw=(.+), outdoorTempC=(.+), mode=(.+)$/);
  if (match) {
    return `本次草案评审固定场景：负荷=${match[1]} kW，室外湿球=${match[2]} ℃，模式=${match[3]}`;
  }

  return step;
}

function localizeOptimizeDiagnostic(item: string): string {
  let match = item.match(/^overview\.sourceStatus=(.+)$/);
  if (match) {
    return `总览来源状态=${match[1]}`;
  }

  match = item.match(/^anomalySummary\.sourceStatus=(.+), totalAlarms=(\d+)$/);
  if (match) {
    return `异常摘要来源状态=${match[1]}，异常总数=${match[2]}`;
  }

  match = item.match(/^recommendations\.sourceStatus=(.+), cards=(\d+)$/);
  if (match) {
    return `建议来源状态=${match[1]}，卡片数=${match[2]}`;
  }

  match = item.match(/^ruleEvaluation\.matched=(\d+), skipped=(\d+)$/);
  if (match) {
    return `规则评估：命中=${match[1]}，跳过=${match[2]}`;
  }

  if (item === "optimize engine is not implemented; current response is a context-backed draft only") {
    return "优化引擎尚未实现；当前响应仅为基于现态的解释型草案。";
  }

  return item;
}

function localizeOptimizeError(text: string | undefined): string | undefined {
  if (!text) {
    return text;
  }
  if (text === "Optimize engine is not implemented yet; returning a context-backed draft") {
    return "优化引擎尚未实现；当前返回基于现态的解释型草案。";
  }
  return text;
}

function readOptimizeDetails(error: OptimizeDraftErrorDto | null): OptimizeDraftDetailsDto | null {
  if (!error?.details || Array.isArray(error.details)) {
    return null;
  }
  const details = error.details as Record<string, unknown>;
  if (!("decision" in details) && !("sourceStatus" in details)) {
    return null;
  }
  return details as OptimizeDraftDetailsDto;
}

function mapOptimizeStatusLabel(code: string | undefined, fallback: string): string {
  if (!code) {
    return fallback;
  }
  if (code === "NOT_IMPLEMENTED") {
    return zhCN.optimizeDemo.statusDraft;
  }
  if (code === "UNKNOWN") {
    return zhCN.optimizeDemo.statusUnknown;
  }
  return code;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const percent = value * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

function formatFlexiblePercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const percent = Math.abs(value) > 1.5 ? value : value * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

function formatRatioPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const percent = Math.abs(value) > 1.5 ? value : value * 100;
  return `${percent.toFixed(2)}%`;
}

function formatDelta(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function asExtendedDetails(details: OptimizeDraftDetailsDto | null): ExtendedOptimizeDraftDetails | null {
  if (!details) {
    return null;
  }
  return details as ExtendedOptimizeDraftDetails;
}

function localizeGateLevel(level: string | undefined): string {
  if (level === "ready") {
    return zhCN.optimizeDemo.gateReady;
  }
  if (level === "caution") {
    return zhCN.optimizeDemo.gateCaution;
  }
  if (level === "blocked") {
    return zhCN.optimizeDemo.gateBlocked;
  }
  return zhCN.optimizeDemo.gateUnknown;
}

function mapGateTone(level: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (level === "ready") {
    return "good";
  }
  if (level === "caution") {
    return "warn";
  }
  if (level === "blocked") {
    return "danger";
  }
  return "neutral";
}

function localizeRiskLevel(level: string | undefined): string {
  if (level === "low") {
    return zhCN.optimizeDemo.riskLow;
  }
  if (level === "medium") {
    return zhCN.optimizeDemo.riskMedium;
  }
  if (level === "high") {
    return zhCN.optimizeDemo.riskHigh;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function mapRiskTone(level: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (level === "low") {
    return "good";
  }
  if (level === "medium") {
    return "warn";
  }
  if (level === "high") {
    return "danger";
  }
  return "neutral";
}

function localizeBenchmarkStatus(status: string | undefined): string {
  if (status === "ready") {
    return zhCN.optimizeDemo.historyBenchmarkStatusReady;
  }
  if (status === "partial") {
    return zhCN.optimizeDemo.historyBenchmarkStatusPartial;
  }
  if (status === "unavailable") {
    return zhCN.optimizeDemo.historyBenchmarkStatusUnavailable;
  }
  return zhCN.optimizeDemo.historyBenchmarkStatusUnavailable;
}

function mapBenchmarkTone(status: string | undefined): "good" | "warn" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial") {
    return "warn";
  }
  return "neutral";
}

function localizeBenefitEstimateStatus(status: string | undefined): string {
  if (status === "ready") {
    return zhCN.optimizeDemo.benefitEstimateStatusReady;
  }
  if (status === "partial") {
    return zhCN.optimizeDemo.benefitEstimateStatusPartial;
  }
  if (status === "unavailable") {
    return zhCN.optimizeDemo.benefitEstimateStatusUnavailable;
  }
  return zhCN.optimizeDemo.benefitEstimateStatusUnavailable;
}

function localizeReviewReadinessStatus(status: string | undefined): string {
  if (status === "ready") {
    return zhCN.optimizeDemo.reviewReadinessStatusReady;
  }
  if (status === "partial") {
    return zhCN.optimizeDemo.reviewReadinessStatusPartial;
  }
  if (status === "unavailable") {
    return zhCN.optimizeDemo.reviewReadinessStatusUnavailable;
  }
  return zhCN.optimizeDemo.reviewReadinessStatusUnavailable;
}

function localizeReviewReadinessSummary(status: string | undefined): string {
  if (status === "ready") {
    return zhCN.optimizeDemo.reviewReadinessSummaryReady;
  }
  if (status === "partial") {
    return zhCN.optimizeDemo.reviewReadinessSummaryPartial;
  }
  if (status === "unavailable") {
    return zhCN.optimizeDemo.reviewReadinessSummaryUnavailable;
  }
  return zhCN.optimizeDemo.reviewReadinessSummaryUnavailable;
}

function mapReviewReadinessTone(status: string | undefined): "good" | "warn" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial") {
    return "warn";
  }
  return "neutral";
}

function localizeSchemeReadinessLevel(level: string | undefined): string {
  if (level === "ready") {
    return zhCN.optimizeDemo.schemeReadinessLevelReady;
  }
  if (level === "caution") {
    return zhCN.optimizeDemo.schemeReadinessLevelCaution;
  }
  if (level === "blocked") {
    return zhCN.optimizeDemo.schemeReadinessLevelBlocked;
  }
  return zhCN.optimizeDemo.schemeReadinessLevelBlocked;
}

function localizeOpportunityLevel(level: string | undefined): string {
  if (level === "low") {
    return zhCN.optimizeDemo.benefitOpportunityLow;
  }
  if (level === "medium") {
    return zhCN.optimizeDemo.benefitOpportunityMedium;
  }
  if (level === "high") {
    return zhCN.optimizeDemo.benefitOpportunityHigh;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function mapOpportunityTone(level: string | undefined): "good" | "warn" | "neutral" {
  if (level === "high") {
    return "good";
  }
  if (level === "medium") {
    return "warn";
  }
  return "neutral";
}

function localizeBenchmarkMatchingTier(value: string | undefined): string {
  if (value === "load-wetbulb-strict") {
    return zhCN.optimizeDemo.historyBenchmarkMatchingTierStrict;
  }
  if (value === "load-wetbulb-relaxed") {
    return zhCN.optimizeDemo.historyBenchmarkMatchingTierRelaxed;
  }
  if (value === "load-only-fallback") {
    return zhCN.optimizeDemo.historyBenchmarkMatchingTierLoadOnly;
  }
  if (value === "unavailable") {
    return zhCN.optimizeDemo.historyBenchmarkMatchingTierUnavailable;
  }
  return value || zhCN.optimizeDemo.pendingValue;
}

function localizeBenchmarkConfidence(value: string | undefined): string {
  if (value === "high") {
    return zhCN.optimizeDemo.historyBenchmarkConfidenceHigh;
  }
  if (value === "medium") {
    return zhCN.optimizeDemo.historyBenchmarkConfidenceMedium;
  }
  if (value === "low") {
    return zhCN.optimizeDemo.historyBenchmarkConfidenceLow;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeBenefitConfidence(value: string | undefined): string {
  if (value === "high") {
    return zhCN.optimizeDemo.benefitEstimateConfidenceHigh;
  }
  if (value === "medium") {
    return zhCN.optimizeDemo.benefitEstimateConfidenceMedium;
  }
  if (value === "low") {
    return zhCN.optimizeDemo.benefitEstimateConfidenceLow;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeSchemeTitle(key: string | undefined, fallback: string | undefined): string {
  if (key === "conservative") {
    return zhCN.optimizeDemo.schemeConservative;
  }
  if (key === "balanced") {
    return zhCN.optimizeDemo.schemeBalanced;
  }
  if (key === "efficiencyFirst") {
    return zhCN.optimizeDemo.schemeEfficiencyFirst;
  }
  return fallback || zhCN.optimizeDemo.pendingValue;
}

function localizeSchemeFocus(key: string | undefined, fallback: string | undefined): string {
  if (key === "conservative") {
    return zhCN.optimizeDemo.focusConservative;
  }
  if (key === "balanced") {
    return zhCN.optimizeDemo.focusBalanced;
  }
  if (key === "efficiencyFirst") {
    return zhCN.optimizeDemo.focusEfficiencyFirst;
  }
  return fallback || zhCN.optimizeDemo.pendingValue;
}

function localizeSchemeAnchoring(hasBenchmark: boolean): { label: string; hint: string } {
  if (hasBenchmark) {
    return {
      label: zhCN.optimizeDemo.schemeAnchoringHistory,
      hint: zhCN.optimizeDemo.schemeAnchoringHistoryHint
    };
  }
  return {
    label: zhCN.optimizeDemo.schemeAnchoringFallback,
    hint: zhCN.optimizeDemo.schemeAnchoringFallbackHint
  };
}

function mapConfidenceTone(level: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (level === "high") {
    return "good";
  }
  if (level === "medium") {
    return "warn";
  }
  if (level === "low") {
    return "danger";
  }
  return "neutral";
}

function deriveSchemeStrategy(
  scheme: DraftScheme,
  baseline: DraftBaseline
): { label: string; detail: string } {
  const chilledLow =
    typeof baseline.chilledDeltaT === "number"
    && Number.isFinite(baseline.chilledDeltaT)
    && baseline.chilledDeltaT < CHILLED_STRATEGY_LOW_DELTA_T;
  const coolingLow =
    typeof baseline.coolingDeltaT === "number"
    && Number.isFinite(baseline.coolingDeltaT)
    && baseline.coolingDeltaT < COOLING_STRATEGY_LOW_DELTA_T;

  if (scheme.key === "conservative") {
    return {
      label: zhCN.optimizeDemo.strategyRiskFirst,
      detail: zhCN.optimizeDemo.strategyRiskFirstHint
    };
  }

  if (chilledLow && !coolingLow) {
    return {
      label: zhCN.optimizeDemo.strategyChilledSide,
      detail: zhCN.optimizeDemo.strategyChilledSideHint
    };
  }

  if (coolingLow && !chilledLow) {
    return {
      label: zhCN.optimizeDemo.strategyCoolingSide,
      detail: zhCN.optimizeDemo.strategyCoolingSideHint
    };
  }

  if (scheme.key === "efficiencyFirst" && !chilledLow) {
    return {
      label: zhCN.optimizeDemo.strategyCoolingSide,
      detail: zhCN.optimizeDemo.strategyCoolingSideHint
    };
  }

  return {
    label: zhCN.optimizeDemo.strategyCoordinated,
    detail: zhCN.optimizeDemo.strategyCoordinatedHint
  };
}

function localizeSkippedRuleReason(reason: string | undefined): string {
  if (reason === "missing-metric") {
    return "缺测跳过";
  }
  return reason || zhCN.optimizeDemo.pendingValue;
}

function localizeMissingMetricCategory(category: string | undefined): string {
  if (category === "upstream_unreachable") {
    return "上游不可达";
  }
  if (category === "field_missing_or_invalid") {
    return "字段缺失或无效";
  }
  if (category === "unknown") {
    return "未知缺测";
  }
  return category || zhCN.optimizeDemo.pendingValue;
}

function normalizeBaseline(
  baseline: DraftBaseline | undefined,
  details: OptimizeDraftDetailsDto | null
): DraftBaseline {
  return {
    ...baseline,
    systemCop: baseline?.systemCop ?? details?.recommendation?.systemCop ?? null,
    totalPowerKw: baseline?.totalPowerKw ?? details?.recommendation?.totalPowerKw ?? null
  };
}

function formatScenarioMode(value: string | undefined): string {
  if (value === "cooling") {
    return zhCN.optimizeDemo.modeCooling;
  }
  return value || zhCN.optimizeDemo.pendingValue;
}

function formatInputValue(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatSampleWindow(
  value:
    | {
        defaultMonths?: string[];
        months?: string[];
        maxMonths?: number | null;
      }
    | string
    | string[]
    | undefined
): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (Array.isArray(value)) {
    return value.length ? value.join("、") : zhCN.optimizeDemo.pendingValue;
  }
  if (typeof value === "object") {
    const months = Array.isArray(value.months) ? value.months : Array.isArray(value.defaultMonths) ? value.defaultMonths : [];
    return months.length ? months.join("、") : zhCN.optimizeDemo.pendingValue;
  }
  return value;
}

function formatMatchingTierFallbackLevel(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return `L${value}`;
}

function formatBenefitBasisSummary(basis: DraftBenefitBasis | undefined): string {
  if (!basis) {
    return zhCN.optimizeDemo.benefitEstimateBasisEmpty;
  }

  const parts: string[] = [];
  if (typeof basis.sampleCount === "number" && Number.isFinite(basis.sampleCount)) {
    parts.push(`${zhCN.optimizeDemo.benefitEstimateBasisSampleCount} ${formatNumber(basis.sampleCount, 0)}`);
  }
  if (typeof basis.monthCount === "number" && Number.isFinite(basis.monthCount)) {
    parts.push(`${zhCN.optimizeDemo.benefitEstimateBasisMonthCount} ${formatNumber(basis.monthCount, 0)}`);
  }
  if (basis.matchingTier) {
    parts.push(`${zhCN.optimizeDemo.benefitEstimateBasisTier} ${localizeBenchmarkMatchingTier(basis.matchingTier)}`);
  }
  if (typeof basis.fallbackLevel === "number" && Number.isFinite(basis.fallbackLevel)) {
    parts.push(`${zhCN.optimizeDemo.benefitEstimateBasisFallbackLevel} ${formatMatchingTierFallbackLevel(basis.fallbackLevel)}`);
  }
  if (basis.matchedWetBulbBand) {
    parts.push(`${zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBand} ${basis.matchedWetBulbBand}`);
  }
  if (Array.isArray(basis.matchedWetBulbBands) && basis.matchedWetBulbBands.length) {
    parts.push(`${zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBands} ${basis.matchedWetBulbBands.join("、")}`);
  }
  if (typeof basis.requestedWetBulbC === "number" && Number.isFinite(basis.requestedWetBulbC)) {
    parts.push(`${zhCN.optimizeDemo.historyBenchmarkRequestedWetBulb} ${formatNumber(basis.requestedWetBulbC, 1)} ℃`);
  }
  if (typeof basis.wetBulbToleranceC === "number" && Number.isFinite(basis.wetBulbToleranceC)) {
    parts.push(`${zhCN.optimizeDemo.historyBenchmarkWetBulbTolerance} ±${formatNumber(basis.wetBulbToleranceC, 1)} ℃`);
  }
  return parts.length ? parts.join(" / ") : zhCN.optimizeDemo.benefitEstimateBasisEmpty;
}

function formatPrefillTimestamp(value: string | null | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return value.replace("T", " ").slice(0, 16);
}

function pickLatestTimestamp(...values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  values.forEach((value) => {
    if (!value) {
      return;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > latestMs) {
      latest = value;
      latestMs = parsed;
      return;
    }
    if (!Number.isFinite(parsed) && !latest) {
      latest = value;
    }
  });
  return latest;
}

function readAutoLoadCandidate(overview: DashboardOverviewDto | null | undefined): {
  value: number | null;
  source: string | null;
  timestamp: string | null;
} {
  const cards = overview?.energyCards;
  const timestamp = overview?.generatedAt ?? null;
  if (typeof cards?.totalCoolingCapacity === "number" && Number.isFinite(cards.totalCoolingCapacity) && cards.totalCoolingCapacity > 0) {
    return {
      value: cards.totalCoolingCapacity,
      source: zhCN.optimizeDemo.prefillLoadSourceDirect,
      timestamp
    };
  }
  if (
    typeof cards?.currentCop === "number" &&
    Number.isFinite(cards.currentCop) &&
    cards.currentCop > 0 &&
    typeof cards?.totalPowerKw === "number" &&
    Number.isFinite(cards.totalPowerKw) &&
    cards.totalPowerKw > 0
  ) {
    return {
      value: cards.currentCop * cards.totalPowerKw,
      source: zhCN.optimizeDemo.prefillLoadSourceDerived,
      timestamp
    };
  }
  return {
    value: null,
    source: null,
    timestamp
  };
}

function readLatestWetBulbCandidate(trend: SceneLegacyTrendDto | null | undefined): {
  value: number | null;
  source: string | null;
  timestamp: string | null;
} {
  const points = Array.isArray(trend?.points) ? [...trend.points].reverse() : [];
  const latestPoint = points.find(
    (point) => typeof point?.value === "number" && Number.isFinite(point.value)
  );
  if (!latestPoint || typeof latestPoint.value !== "number") {
    return {
      value: null,
      source: null,
      timestamp: trend?.generatedAt ?? null
    };
  }
  return {
    value: latestPoint.value,
    source: zhCN.optimizeDemo.prefillWetBulbSourceLatestPoint,
    timestamp: latestPoint.timestamp ?? trend?.generatedAt ?? null
  };
}

export default function OptimizeDemoPage() {
  const currentProject = getCurrentProject(getAuthSession());
  const activeSiteId = currentProject?.siteCode || runtimeConfig.siteId;
  const [loadKw, setLoadKw] = useState("1200");
  const [outdoorWetBulbC, setOutdoorWetBulbC] = useState("32.5");
  const [mode, setMode] = useState("cooling");
  const [submitting, setSubmitting] = useState(false);
  const [resultError, setResultError] = useState<OptimizeDraftErrorDto | null>(null);
  const [autoPrefill, setAutoPrefill] = useState<AutoPrefillState>({
    kind: "loading",
    loadSource: null,
    wetBulbSource: null,
    refreshedAt: null
  });
  const loadDirtyRef = useRef(false);
  const wetBulbDirtyRef = useRef(false);
  const autoPrefillRequestIdRef = useRef(0);

  const details = readOptimizeDetails(resultError);
  const extendedDetails = asExtendedDetails(details);
  const isDraftResponse = resultError?.code === "NOT_IMPLEMENTED" && Boolean(details);
  const hasValidationError = Boolean(resultError) && !isDraftResponse;
  const sourceSummary = summarizeSourceStatus([details?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([details?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([details?.sourceStatus], {
    limit: 4,
    labelMode: "short"
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await postOptimizeDraft(activeSiteId, {
        context: {
          siteId: activeSiteId
        },
        inputs: {
          loadKw: Number(loadKw),
          outdoorTempC: Number(outdoorWetBulbC),
          mode
        }
      });
      setResultError(null);
    } catch (error) {
      const payload = (error as { payload?: OptimizeDraftErrorDto })?.payload || {
        code: "UNKNOWN",
        error: String((error as Error)?.message || error)
      };
      setResultError(payload);
    } finally {
      setSubmitting(false);
    }
  }

  const responseReady = Boolean(details);
  const requestDelta =
    details?.request?.loadKw != null && details?.request?.outdoorTempC != null
      ? `${details.request.loadKw} kW / ${details.request.outdoorTempC} °C`
      : zhCN.optimizeDemo.pendingHint;
  const statusLabel = mapOptimizeStatusLabel(resultError?.code, zhCN.optimizeDemo.statusDraft);
  const localizedError = localizeOptimizeError(resultError?.error);
  const gate = extendedDetails?.gate;
  const baseline = normalizeBaseline(extendedDetails?.baseline, details);
  const historyBenchmark = extendedDetails?.historyBenchmark;
  const benefitEstimate = extendedDetails?.benefitEstimate;
  const reviewReadiness = extendedDetails?.reviewReadiness;
  const schemes = Array.isArray(extendedDetails?.schemes) ? extendedDetails.schemes : [];
  const ruleEvidence = extendedDetails?.ruleEvidence;
  const stepCount = details?.recommendation?.steps?.length ?? 0;
  const matchedRuleIds =
    ruleEvidence?.matchedRuleIds?.filter((item): item is string => typeof item === "string" && item.trim().length > 0) ?? [];
  const skippedRules = Array.isArray(ruleEvidence?.skippedRules) ? ruleEvidence.skippedRules : [];
  const skippedRulePreview = skippedRules.slice(0, 3);
  const skippedRuleOverflow = skippedRules.slice(3);
  const historyBenchmarkStatusLabel = localizeBenchmarkStatus(historyBenchmark?.status);
  const historyBenchmarkStatusTone = mapBenchmarkTone(historyBenchmark?.status);
  const benefitEstimateStatusLabel = localizeBenefitEstimateStatus(benefitEstimate?.status);
  const benefitEstimateStatusTone = mapBenchmarkTone(benefitEstimate?.status);
  const reviewReadinessStatusLabel = localizeReviewReadinessStatus(reviewReadiness?.status);
  const reviewReadinessStatusTone = mapReviewReadinessTone(reviewReadiness?.status);
  const historyBenchmarkModeLabel =
    historyBenchmark?.mode === "load-band"
      ? zhCN.optimizeDemo.historyBenchmarkModeLoadBand
      : historyBenchmark?.mode || zhCN.optimizeDemo.historyBenchmarkModeLoadBand;
  const historyBenchmarkMatchingTierLabel = localizeBenchmarkMatchingTier(historyBenchmark?.matchingTier);
  const historyBenchmarkConfidenceLabel = localizeBenchmarkConfidence(historyBenchmark?.confidence);
  const historyBenchmarkMatchedWetBulbBandsSummary =
    Array.isArray(historyBenchmark?.matchedWetBulbBands) && historyBenchmark.matchedWetBulbBands.length
      ? historyBenchmark.matchedWetBulbBands.join("、")
      : zhCN.optimizeDemo.pendingValue;
  const historyBenchmarkMatchingQualityParts: string[] = [];
  if (historyBenchmark?.matchingTier) {
    historyBenchmarkMatchingQualityParts.push(historyBenchmarkMatchingTierLabel);
  }
  if (typeof historyBenchmark?.fallbackLevel === "number") {
    historyBenchmarkMatchingQualityParts.push(
      `${zhCN.optimizeDemo.historyBenchmarkFallbackLevel} ${formatMatchingTierFallbackLevel(historyBenchmark.fallbackLevel)}`
    );
  }
  if (typeof historyBenchmark?.requestedWetBulbC === "number") {
    historyBenchmarkMatchingQualityParts.push(
      `${zhCN.optimizeDemo.historyBenchmarkRequestedWetBulb} ${formatNumber(historyBenchmark.requestedWetBulbC, 1)} ℃`
    );
  }
  if (historyBenchmark?.matchedWetBulbBand) {
    historyBenchmarkMatchingQualityParts.push(
      `${zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBand} ${historyBenchmark.matchedWetBulbBand}`
    );
  }
  if (Array.isArray(historyBenchmark?.matchedWetBulbBands) && historyBenchmark.matchedWetBulbBands.length) {
    historyBenchmarkMatchingQualityParts.push(
      `${zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBands} ${historyBenchmarkMatchedWetBulbBandsSummary}`
    );
  }
  if (historyBenchmark?.confidence) {
    historyBenchmarkMatchingQualityParts.push(
      `${zhCN.optimizeDemo.historyBenchmarkConfidence} ${historyBenchmarkConfidenceLabel}`
    );
  }
  const historyBenchmarkMatchingQualitySummary = historyBenchmarkMatchingQualityParts.length
    ? `${zhCN.optimizeDemo.historyBenchmarkMatchingQualityTitle}：${historyBenchmarkMatchingQualityParts.join("，")}`
    : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending;
  const benefitEstimateConfidenceLabel = localizeBenefitConfidence(benefitEstimate?.confidence);
  const benefitEstimateBasisSummary = formatBenefitBasisSummary(benefitEstimate?.basis);
  const benefitEstimateSummaryParts: string[] = [];
  if (benefitEstimate?.confidence) {
    benefitEstimateSummaryParts.push(`${zhCN.optimizeDemo.benefitEstimateConfidence}：${benefitEstimateConfidenceLabel}`);
  }
  if (benefitEstimate?.basis) {
    benefitEstimateSummaryParts.push(`${zhCN.optimizeDemo.benefitEstimateBasis} ${benefitEstimateBasisSummary}`);
  }
  const benefitEstimateConfidenceSummary = benefitEstimateSummaryParts.length
    ? benefitEstimateSummaryParts.join("，")
    : zhCN.optimizeDemo.benefitEstimateBasisEmpty;
  const historyBenchmarkProportionLink = historyBenchmark?.links?.proportionHref;
  const historyBenchmarkCompareLink = historyBenchmark?.links?.compareHref;
  const historyBenchmarkProportionEnabled = historyBenchmarkProportionLink
    ? Boolean(historyBenchmarkProportionLink.enabled && historyBenchmarkProportionLink.href)
    : true;
  const historyBenchmarkCompareEnabled = historyBenchmarkCompareLink
    ? Boolean(historyBenchmarkCompareLink.enabled && historyBenchmarkCompareLink.href)
    : true;
  const historyBenchmarkProportionHref = historyBenchmarkProportionLink?.href || "/energy-efficiency?tab=proportion";
  const historyBenchmarkCompareHref = historyBenchmarkCompareLink?.href || "/energy-efficiency?tab=compare";
  const historyBenchmarkProportionLabel =
    historyBenchmark?.links?.proportionHref?.label || zhCN.optimizeDemo.historyBenchmarkLinkProportion;
  const historyBenchmarkCompareLabel =
    historyBenchmark?.links?.compareHref?.label || zhCN.optimizeDemo.historyBenchmarkLinkCompare;
  const powerSplitTotal = useMemo(
    () =>
      [baseline.chillerPowerKw, baseline.chilledPumpPowerKw, baseline.coolingPumpPowerKw, baseline.coolingTowerPowerKw]
        .filter((item): item is number => typeof item === "number" && item > 0)
        .reduce((sum, item) => sum + item, 0),
    [baseline.chilledPumpPowerKw, baseline.chillerPowerKw, baseline.coolingPumpPowerKw, baseline.coolingTowerPowerKw]
  );
  const powerSplitRows = [
    {
      label: zhCN.optimizeDemo.baselineChillerPower,
      value: baseline.chillerPowerKw,
      ratio: powerSplitTotal > 0 && typeof baseline.chillerPowerKw === "number" ? baseline.chillerPowerKw / powerSplitTotal : 0
    },
    {
      label: zhCN.optimizeDemo.baselinePumpPower,
      value: baseline.chilledPumpPowerKw,
      ratio:
        powerSplitTotal > 0 && typeof baseline.chilledPumpPowerKw === "number" ? baseline.chilledPumpPowerKw / powerSplitTotal : 0
    },
    {
      label: zhCN.optimizeDemo.baselineCoolingPumpPower,
      value: baseline.coolingPumpPowerKw,
      ratio:
        powerSplitTotal > 0 && typeof baseline.coolingPumpPowerKw === "number" ? baseline.coolingPumpPowerKw / powerSplitTotal : 0
    },
    {
      label: zhCN.optimizeDemo.baselineTowerPower,
      value: baseline.coolingTowerPowerKw,
      ratio:
        powerSplitTotal > 0 && typeof baseline.coolingTowerPowerKw === "number" ? baseline.coolingTowerPowerKw / powerSplitTotal : 0
    }
  ];

  const autoPrefillMessage =
    autoPrefill.kind === "loading"
      ? zhCN.optimizeDemo.prefillLoading
      : autoPrefill.kind === "ready"
        ? zhCN.optimizeDemo.prefillReady
        : autoPrefill.kind === "partial"
          ? zhCN.optimizeDemo.prefillPartial
          : zhCN.optimizeDemo.prefillError;

  async function hydrateCurrentScenario(force = false) {
    const requestId = autoPrefillRequestIdRef.current + 1;
    autoPrefillRequestIdRef.current = requestId;
    setAutoPrefill((current) => ({
      ...current,
      kind: "loading"
    }));

    const [overviewResult, wetBulbResult] = await Promise.allSettled([
      fetchDashboardOverview(activeSiteId),
      fetchSceneLegacyTrend(activeSiteId, {
        tagname: WET_BULB_TAG_NAME,
        title: zhCN.optimizeDemo.prefillWetBulbTitle,
        unit: "℃"
      })
    ]);

    if (autoPrefillRequestIdRef.current !== requestId) {
      return;
    }

    const loadCandidate =
      overviewResult.status === "fulfilled"
        ? readAutoLoadCandidate(overviewResult.value)
        : { value: null, source: null, timestamp: null };
    const wetBulbCandidate =
      wetBulbResult.status === "fulfilled"
        ? readLatestWetBulbCandidate(wetBulbResult.value)
        : { value: null, source: null, timestamp: null };

    let appliedCount = 0;

    if (typeof loadCandidate.value === "number" && Number.isFinite(loadCandidate.value)) {
      if (force || !loadDirtyRef.current) {
        setLoadKw(formatInputValue(loadCandidate.value, 0));
        appliedCount += 1;
      }
    } else if (!force && !loadDirtyRef.current) {
      setLoadKw("");
    }

    if (typeof wetBulbCandidate.value === "number" && Number.isFinite(wetBulbCandidate.value)) {
      if (force || !wetBulbDirtyRef.current) {
        setOutdoorWetBulbC(formatInputValue(wetBulbCandidate.value, 1));
        appliedCount += 1;
      }
    } else if (!force && !wetBulbDirtyRef.current) {
      setOutdoorWetBulbC("");
    }

    setAutoPrefill({
      kind: appliedCount === 2 ? "ready" : appliedCount === 1 ? "partial" : "error",
      loadSource: loadCandidate.source,
      wetBulbSource: wetBulbCandidate.source,
      refreshedAt: pickLatestTimestamp(loadCandidate.timestamp, wetBulbCandidate.timestamp)
    });
  }

  useEffect(() => {
    void hydrateCurrentScenario(false);
    return () => {
      autoPrefillRequestIdRef.current += 1;
    };
  }, [activeSiteId]);

  return (
    <div className="optimize-page page-enter">
      <SourceStatusBanner
        summary={
          responseReady
            ? sourceSummary.text
            : hasValidationError
              ? localizedError || zhCN.optimizeDemo.bannerIdle
              : zhCN.optimizeDemo.bannerIdle
        }
        warn={hasValidationError || sourceSummary.warn}
        detailLines={responseReady ? sourceStatusLines : []}
        detailLinesCompact={responseReady ? sourceStatusLinesCompact : []}
      />

      <section className="optimize-page-header">
        <h2>{zhCN.optimizeDemo.heading}</h2>
        <p>{zhCN.optimizeDemo.subtitle}</p>
      </section>

      <div className="optimize-summary-grid">
        <StatCard
          title={zhCN.optimizeDemo.summaryRoute}
          value={zhCN.optimizeDemo.summaryRouteValue}
          unit=""
          delta={`${zhCN.optimizeDemo.summaryRouteHint} /bff/v1/sites/{siteId}/optimize`}
          tone="good"
        />
        <StatCard
          title={zhCN.optimizeDemo.summaryStatus}
          value={statusLabel}
          unit=""
          delta={
            isDraftResponse
              ? zhCN.optimizeDemo.summaryStatusDraftHint
              : localizedError || zhCN.optimizeDemo.summaryStatusHint
          }
          tone={hasValidationError ? "warn" : "neutral"}
        />
        <StatCard
          title={zhCN.optimizeDemo.summaryInput}
          value={responseReady ? zhCN.optimizeDemo.requestAccepted : zhCN.optimizeDemo.requestPending}
          unit=""
          delta={requestDelta}
          tone={responseReady ? "good" : "neutral"}
        />
      </div>

      <div className="optimize-page-grid">
        <SectionCard title={zhCN.optimizeDemo.sectionInputs}>
          <form className="optimize-form" onSubmit={handleSubmit}>
            <label>
              <span>{zhCN.optimizeDemo.inputLoadKw}</span>
              <input
                type="number"
                step="1"
                value={loadKw}
                onChange={(event) => {
                  loadDirtyRef.current = true;
                  setLoadKw(event.target.value);
                }}
              />
            </label>
            <label>
              <span>{zhCN.optimizeDemo.inputOutdoorTempC}</span>
              <input
                type="number"
                step="0.1"
                value={outdoorWetBulbC}
                onChange={(event) => {
                  wetBulbDirtyRef.current = true;
                  setOutdoorWetBulbC(event.target.value);
                }}
              />
            </label>
            <label>
              <span>{zhCN.optimizeDemo.inputMode}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="cooling">{zhCN.optimizeDemo.modeCooling}</option>
              </select>
            </label>
            <div className="optimize-form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? zhCN.optimizeDemo.submitLoading : zhCN.optimizeDemo.submit}
              </button>
              <small>{zhCN.optimizeDemo.formFootnote}</small>
            </div>
            <div className={`optimize-form-prefill optimize-form-prefill-${autoPrefill.kind}`}>
              <div className="optimize-form-prefill-head">
                <small>{autoPrefillMessage}</small>
                <button
                  type="button"
                  className="optimize-form-refresh"
                  disabled={autoPrefill.kind === "loading"}
                  onClick={() => {
                    loadDirtyRef.current = false;
                    wetBulbDirtyRef.current = false;
                    void hydrateCurrentScenario(true);
                  }}
                >
                  {zhCN.optimizeDemo.prefillRefresh}
                </button>
              </div>
              <div className="optimize-form-prefill-meta">
                <span>
                  {zhCN.optimizeDemo.prefillLoadSourceLabel}：
                  {autoPrefill.loadSource || zhCN.optimizeDemo.pendingValue}
                </span>
                <span>
                  {zhCN.optimizeDemo.prefillWetBulbSourceLabel}：
                  {autoPrefill.wetBulbSource || zhCN.optimizeDemo.pendingValue}
                </span>
                <span>
                  {zhCN.optimizeDemo.prefillUpdatedAtLabel}：
                  {formatPrefillTimestamp(autoPrefill.refreshedAt)}
                </span>
              </div>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={zhCN.optimizeDemo.sectionWindow}>
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>{gate?.title || zhCN.optimizeDemo.gateLevel}</strong>
                <p>{gate?.reason || zhCN.optimizeDemo.gateReasonPending}</p>
              </div>
              <StatusPill label={localizeGateLevel(gate?.level)} tone={mapGateTone(gate?.level)} />
            </div>

            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.draftLabelTitle}</span>
                <strong>{extendedDetails?.draftLabel || zhCN.optimizeDemo.draftLabelFallback}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.gateReason}</span>
                <strong>{gate?.reason || zhCN.optimizeDemo.pendingValue}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseSummary}</span>
                <strong>{localizeOptimizeSummary(details?.decision?.summary)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseConfidence}</span>
                <strong>{localizeOptimizeConfidence(details?.decision?.confidence)}</strong>
              </article>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={zhCN.optimizeDemo.sectionReadiness}>
        <div className="optimize-response">
          <div className="optimize-response-header">
            <div>
              <strong>{reviewReadiness?.reason || zhCN.optimizeDemo.reviewReadinessTitle}</strong>
              <p>{localizeReviewReadinessSummary(reviewReadiness?.status)}</p>
            </div>
            <StatusPill label={reviewReadinessStatusLabel} tone={reviewReadinessStatusTone} />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.reviewReadinessScore}</span>
              <strong>
                {typeof reviewReadiness?.score === "number" ? `${reviewReadiness.score.toFixed(0)}` : zhCN.optimizeDemo.pendingValue}
              </strong>
              <small>{zhCN.optimizeDemo.estimateBadge}</small>
            </article>
            <article className="optimize-response-card optimize-response-card-wide">
              <span>{zhCN.optimizeDemo.reviewReadinessReason}</span>
              <strong>{reviewReadiness?.reason || zhCN.optimizeDemo.reviewReadinessPending}</strong>
              <small>{zhCN.optimizeDemo.reviewReadinessSupport}</small>
            </article>
          </div>

          <div className="optimize-response-grid">
            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.reviewReadinessMissingSignals}</h4>
              {reviewReadiness?.missingSignals?.length ? (
                <div className="optimize-inline-list">
                  {reviewReadiness.missingSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
              ) : (
                <p>{zhCN.optimizeDemo.reviewReadinessNoMissingSignals}</p>
              )}
            </div>
            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.reviewReadinessHints}</h4>
              {reviewReadiness?.hints?.length ? (
                <ul>
                  {reviewReadiness.hints.map((hint, index) => (
                    <li key={`${hint}-${index + 1}`}>{hint}</li>
                  ))}
                </ul>
              ) : (
                <p>{zhCN.optimizeDemo.reviewReadinessNoHints}</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="optimize-page-grid">
        <SectionCard title={zhCN.optimizeDemo.sectionBaseline}>
          <div className="optimize-response">
            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineCop}</span>
                <strong>{formatNumber(baseline.systemCop, 2)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselinePower}</span>
                <strong>{formatNumber(baseline.totalPowerKw)} kW</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineChilledDelta}</span>
                <strong>{formatNumber(baseline.chilledDeltaT)} °C</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineCoolingDelta}</span>
                <strong>{formatNumber(baseline.coolingDeltaT)} °C</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineChillerPower}</span>
                <strong>{formatNumber(baseline.chillerPowerKw)} kW</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineActiveAlarms}</span>
                <strong>{formatNumber(baseline.activeAlarmCount, 0)}</strong>
              </article>
            </div>

            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.baselineSupplementTitle}</h4>
              <div className="optimize-baseline-meta">
                <p>{zhCN.optimizeDemo.baselinePumpPower}：{formatNumber(baseline.chilledPumpPowerKw)} kW</p>
                <p>{zhCN.optimizeDemo.baselineCoolingPumpPower}：{formatNumber(baseline.coolingPumpPowerKw)} kW</p>
                <p>{zhCN.optimizeDemo.baselineTowerPower}：{formatNumber(baseline.coolingTowerPowerKw)} kW</p>
                <p>{zhCN.optimizeDemo.baselineChilledSupplyTemp}：{formatNumber(baseline.chilledSupplyTemp)} °C</p>
                <p>{zhCN.optimizeDemo.baselineCoolingReturnTemp}：{formatNumber(baseline.coolingReturnTemp)} °C</p>
                <p>{zhCN.optimizeDemo.baselineThermalUnbalanceRate}：{formatPercent(baseline.thermalUnbalanceRate)}</p>
              </div>
            </div>

            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.baselinePowerSplitTitle}</h4>
              {powerSplitTotal > 0 ? (
                <div className="optimize-power-split-list">
                  {powerSplitRows.map((row) => (
                    <div key={row.label} className="optimize-power-split-item">
                      <div className="optimize-power-split-meta">
                        <span>{row.label}</span>
                        <strong>{formatNumber(row.value)} kW</strong>
                      </div>
                      <div className="optimize-power-split-track">
                        <span
                          className="optimize-power-split-fill"
                          style={{ width: `${Math.max(6, row.ratio * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{zhCN.optimizeDemo.baselinePowerSplitEmpty}</p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.optimizeDemo.requestScenarioTitle}>
          <div className="optimize-response">
            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.requestScenarioLoad}</span>
                <strong>
                  {details?.request?.loadKw != null ? `${details.request.loadKw} kW` : zhCN.optimizeDemo.pendingValue}
                </strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.requestScenarioOutdoor}</span>
                <strong>
                  {details?.request?.outdoorTempC != null
                    ? `${details.request.outdoorTempC} °C`
                    : zhCN.optimizeDemo.pendingValue}
                </strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.requestScenarioMode}</span>
                <strong>{formatScenarioMode(details?.request?.mode)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseSteps}</span>
                <strong>{stepCount > 0 ? `${stepCount}` : zhCN.optimizeDemo.pendingValue}</strong>
              </article>
            </div>
            {!responseReady ? <p>{zhCN.optimizeDemo.requestScenarioPending}</p> : null}
          </div>
        </SectionCard>
      </div>

      <div className="optimize-page-grid optimize-insight-grid">
        <SectionCard title={zhCN.optimizeDemo.sectionHistoryBenchmark}>
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>{historyBenchmarkModeLabel}</strong>
                <p>{zhCN.optimizeDemo.historyBenchmarkSubtitle}</p>
              </div>
              <div className="optimize-scheme-badges">
                <StatusPill label={historyBenchmarkStatusLabel} tone={historyBenchmarkStatusTone} />
                <StatusPill label={historyBenchmarkConfidenceLabel} tone={mapConfidenceTone(historyBenchmark?.confidence)} />
              </div>
            </div>

            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkCapacity}</span>
                <strong>
                  {formatNumber(historyBenchmark?.ratedCoolingCapacityKw)} kW
                </strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkRequestedLoadRate}</span>
                <strong>
                  {formatRatioPercent(historyBenchmark?.requestedLoadRatePct)}
                </strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkMatchedBucket}</span>
                <strong>{historyBenchmark?.matchedBucketLabel || zhCN.optimizeDemo.pendingValue}</strong>
                <small>{zhCN.optimizeDemo.historyBenchmarkModeLoadBand}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkSampleWindow}</span>
                <strong>{formatSampleWindow(historyBenchmark?.sampleWindow)}</strong>
                <small>{zhCN.optimizeDemo.historyBenchmarkWetBulbNote}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkSampleCount}</span>
                <strong>{formatNumber(historyBenchmark?.sampleCount, 0)}</strong>
                <small>{zhCN.optimizeDemo.historyBenchmarkWetBulbNote}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.historyBenchmarkReferenceCop}</span>
                <strong>
                  {[
                    `低 ${formatNumber(historyBenchmark?.referenceCop?.low, 2)}`,
                    `中位 ${formatNumber(historyBenchmark?.referenceCop?.median, 2)}`,
                    `高 ${formatNumber(historyBenchmark?.referenceCop?.high, 2)}`
                  ].join(" / ")}
                </strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card optimize-response-card-wide">
                <span>{zhCN.optimizeDemo.historyBenchmarkCurrentGap}</span>
                <strong>
                  {[
                    `COP ${formatDelta(historyBenchmark?.currentGap?.copDeltaToMedian)}`,
                    `功率 ${formatNumber(historyBenchmark?.currentGap?.powerDeltaKwToMedian)} kW`
                  ].join(" / ")}
                </strong>
                <small>{zhCN.optimizeDemo.historyBenchmarkWetBulbNote}</small>
              </article>
            </div>

            <div className="optimize-response-block">
              <h4>{historyBenchmarkModeLabel}</h4>
              <p>{historyBenchmark?.note || zhCN.optimizeDemo.historyBenchmarkPending}</p>
              <small>{zhCN.optimizeDemo.historyBenchmarkWetBulbNote}</small>
              <div className="optimize-benchmark-links">
                {historyBenchmarkCompareEnabled ? (
                  <a
                    className="scene-open-link"
                    href={historyBenchmarkCompareHref}
                    aria-label={historyBenchmarkCompareLabel}
                  >
                    {historyBenchmarkCompareLabel}
                  </a>
                ) : (
                  <span className="scene-open-link is-disabled">{historyBenchmarkCompareLabel}</span>
                )}
                {historyBenchmarkProportionEnabled ? (
                  <a
                    className="scene-open-link"
                    href={historyBenchmarkProportionHref}
                    aria-label={historyBenchmarkProportionLabel}
                  >
                    {historyBenchmarkProportionLabel}
                  </a>
                ) : (
                  <span className="scene-open-link is-disabled">{historyBenchmarkProportionLabel}</span>
                )}
              </div>
            </div>

            <div className="optimize-response-block optimize-matching-quality">
              <h4>{zhCN.optimizeDemo.historyBenchmarkMatchingQualityTitle}</h4>
              <p>{historyBenchmarkMatchingQualitySummary}</p>
              <div className="optimize-matching-quality-grid">
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkMatchingTier}</span>
                  <strong>{historyBenchmarkMatchingTierLabel}</strong>
                  <small>
                    {historyBenchmark?.matchingTier
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkFallbackLevel}</span>
                  <strong>{formatMatchingTierFallbackLevel(historyBenchmark?.fallbackLevel)}</strong>
                  <small>
                    {typeof historyBenchmark?.fallbackLevel === "number"
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkRequestedWetBulb}</span>
                  <strong>
                    {typeof historyBenchmark?.requestedWetBulbC === "number"
                      ? `${formatNumber(historyBenchmark.requestedWetBulbC, 1)} ℃`
                      : zhCN.optimizeDemo.pendingValue}
                  </strong>
                  <small>
                    {typeof historyBenchmark?.requestedWetBulbC === "number"
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBand}</span>
                  <strong>{historyBenchmark?.matchedWetBulbBand || zhCN.optimizeDemo.pendingValue}</strong>
                  <small>
                    {historyBenchmark?.matchedWetBulbBand
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card optimize-response-card-wide">
                  <span>{zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBands}</span>
                  <strong>{historyBenchmarkMatchedWetBulbBandsSummary}</strong>
                  <small>
                    {Array.isArray(historyBenchmark?.matchedWetBulbBands) && historyBenchmark.matchedWetBulbBands.length
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkWetBulbTolerance}</span>
                  <strong>
                    {typeof historyBenchmark?.wetBulbToleranceC === "number"
                      ? `±${formatNumber(historyBenchmark.wetBulbToleranceC, 1)} ℃`
                      : zhCN.optimizeDemo.pendingValue}
                  </strong>
                  <small>
                    {typeof historyBenchmark?.wetBulbToleranceC === "number"
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
                <article className="optimize-response-card optimize-matching-quality-card">
                  <span>{zhCN.optimizeDemo.historyBenchmarkConfidence}</span>
                  <strong>{historyBenchmarkConfidenceLabel}</strong>
                  <small>
                    {historyBenchmark?.confidence
                      ? zhCN.optimizeDemo.historyBenchmarkWetBulbNote
                      : zhCN.optimizeDemo.historyBenchmarkMatchingQualityPending}
                  </small>
                </article>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={zhCN.optimizeDemo.sectionBenefitEstimate}>
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>{zhCN.optimizeDemo.benefitEstimateSubtitle}</strong>
                <p>{benefitEstimate?.disclaimer || zhCN.optimizeDemo.benefitEstimatePending}</p>
              </div>
              <div className="optimize-scheme-badges">
                <StatusPill label={benefitEstimateStatusLabel} tone={benefitEstimateStatusTone} />
                <StatusPill
                  label={localizeOpportunityLevel(benefitEstimate?.opportunityLevel)}
                  tone={mapOpportunityTone(benefitEstimate?.opportunityLevel)}
                />
                <StatusPill label={benefitEstimateConfidenceLabel} tone={mapConfidenceTone(benefitEstimate?.confidence)} />
              </div>
            </div>

            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.benefitEstimateOpportunity}</span>
                <strong>{localizeOpportunityLevel(benefitEstimate?.opportunityLevel)}</strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.benefitEstimateTargetCop}</span>
                <strong>{formatNumber(benefitEstimate?.expectedTargetCop, 2)}</strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.benefitEstimateTargetPower}</span>
                <strong>{formatNumber(benefitEstimate?.expectedTargetPowerKw)} kW</strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.benefitEstimatePowerDelta}</span>
                <strong>{formatNumber(benefitEstimate?.expectedPowerDeltaKw)} kW</strong>
                <small>{formatFlexiblePercent(benefitEstimate?.expectedPowerDeltaPct)}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.benefitEstimateCopDelta}</span>
                <strong>{formatDelta(benefitEstimate?.expectedCopDelta)}</strong>
                <small>{zhCN.optimizeDemo.estimateBadge}</small>
              </article>
            </div>

            <div className="optimize-response-block optimize-confidence">
              <h4>{zhCN.optimizeDemo.benefitEstimateConfidenceTitle}</h4>
              <p>{benefitEstimateConfidenceSummary}</p>
              <div className="optimize-matching-quality-grid optimize-basis-grid">
                <article className="optimize-response-card optimize-basis-card">
                  <span>{zhCN.optimizeDemo.benefitEstimateConfidence}</span>
                  <strong>{benefitEstimateConfidenceLabel}</strong>
                  <small>
                    {benefitEstimate?.confidence
                      ? zhCN.optimizeDemo.benefitEstimateDisclaimer
                      : zhCN.optimizeDemo.benefitEstimateBasisEmpty}
                  </small>
                </article>
                <article className="optimize-response-card optimize-basis-card optimize-response-card-wide">
                  <span>{zhCN.optimizeDemo.benefitEstimateBasis}</span>
                  <strong>{benefitEstimateBasisSummary}</strong>
                  <small>
                    {benefitEstimate?.basis
                      ? zhCN.optimizeDemo.benefitEstimateDisclaimer
                      : zhCN.optimizeDemo.benefitEstimateBasisEmpty}
                  </small>
                </article>
                <article className="optimize-response-card optimize-basis-card optimize-response-card-wide">
                  <span>{zhCN.optimizeDemo.historyBenchmarkMatchedWetBulbBands}</span>
                  <strong>
                    {Array.isArray(benefitEstimate?.basis?.matchedWetBulbBands) &&
                    benefitEstimate?.basis?.matchedWetBulbBands?.length
                      ? benefitEstimate.basis.matchedWetBulbBands.join("、")
                      : zhCN.optimizeDemo.pendingValue}
                  </strong>
                  <small>
                    {Array.isArray(benefitEstimate?.basis?.matchedWetBulbBands) &&
                    benefitEstimate?.basis?.matchedWetBulbBands?.length
                      ? zhCN.optimizeDemo.benefitEstimateDisclaimer
                      : zhCN.optimizeDemo.benefitEstimateBasisEmpty}
                  </small>
                </article>
              </div>
            </div>

            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.benefitEstimateDisclaimer}</h4>
              <p>{benefitEstimate?.disclaimer || zhCN.optimizeDemo.benefitEstimatePending}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={zhCN.optimizeDemo.sectionSchemes}>
        <div className="optimize-schemes-grid">
          {schemes.length ? (
            schemes.map((scheme) => {
              const strategy = deriveSchemeStrategy(scheme, baseline);
              const hasBenchmark = historyBenchmark?.status === "ready";
              const anchoring = localizeSchemeAnchoring(hasBenchmark);
              const schemeReadiness = scheme.readiness;
              return (
              <article key={scheme.key || scheme.title} className="optimize-scheme-card">
                <div className="optimize-scheme-head">
                  <div>
                    <strong>{localizeSchemeTitle(scheme.key, scheme.title || scheme.label)}</strong>
                    <p>{localizeSchemeFocus(scheme.key, scheme.focus)}</p>
                  </div>
                  <div className="optimize-scheme-badges">
                    <StatusPill label={localizeGateLevel(scheme.status)} tone={mapGateTone(scheme.status)} />
                    <StatusPill label={localizeRiskLevel(scheme.riskLevel)} tone={mapRiskTone(scheme.riskLevel)} />
                  </div>
                </div>

                <div className="optimize-scheme-strategy">
                  <span>{zhCN.optimizeDemo.schemeStrategyTitle}</span>
                  <div className="optimize-inline-list">
                    <span>{strategy.label}</span>
                  </div>
                  <p>{strategy.detail}</p>
                </div>

                <div className="optimize-scheme-anchor">
                  <span>{zhCN.optimizeDemo.schemeAnchoringTitle}</span>
                  <div className="optimize-inline-list">
                    <span>{anchoring.label}</span>
                  </div>
                  <p>{anchoring.hint}</p>
                </div>

                <div className="optimize-response-grid">
                  <article className="optimize-response-card">
                    <span>{zhCN.optimizeDemo.schemeTargetPower}</span>
                    <strong>{formatNumber(scheme.targetPowerKw)} kW</strong>
                    <small>{zhCN.optimizeDemo.estimateBadge}</small>
                  </article>
                  <article className="optimize-response-card">
                    <span>{zhCN.optimizeDemo.schemeTargetCop}</span>
                    <strong>{formatNumber(scheme.targetCop, 2)}</strong>
                    <small>{zhCN.optimizeDemo.estimateBadge}</small>
                  </article>
                  <article className="optimize-response-card">
                    <span>{zhCN.optimizeDemo.schemePowerDelta}</span>
                    <strong>{formatPercent(scheme.powerDeltaPct)}</strong>
                    <small>{zhCN.optimizeDemo.estimateBadge}</small>
                  </article>
                  <article className="optimize-response-card">
                    <span>{zhCN.optimizeDemo.schemeCopDelta}</span>
                    <strong>{formatDelta(scheme.copDelta)}</strong>
                    <small>{zhCN.optimizeDemo.estimateBadge}</small>
                  </article>
                </div>

                <div className="optimize-response-block">
                  <h4>{zhCN.optimizeDemo.schemeActions}</h4>
                  {scheme.actions?.length ? (
                    <ul>
                      {scheme.actions.map((item, index) => (
                        <li key={`${scheme.key || "scheme"}-${index + 1}`}>{localizeOptimizeStep(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{zhCN.optimizeDemo.schemeActionsEmpty}</p>
                  )}
                </div>
                <div className="optimize-response-block">
                  <h4>{zhCN.optimizeDemo.schemeDeviceActions}</h4>
                  {scheme.deviceActions?.length ? (
                    <div className="optimize-device-action-list">
                      {scheme.deviceActions.map((item, index) => (
                        <article
                          key={`${scheme.key || "scheme"}-device-${index + 1}`}
                          className="optimize-device-action-card"
                        >
                          <div className="optimize-device-action-head">
                            <span>{localizeDeviceSystem(item.system)}</span>
                            <div className="optimize-device-action-tags">
                              <strong>
                                {zhCN.optimizeDemo.deviceActionRisk}：{localizeDeviceRisk(item.risk)}
                              </strong>
                              <strong>
                                {zhCN.optimizeDemo.deviceActionPriority}：{localizeDevicePriority(item.priority)}
                              </strong>
                            </div>
                          </div>
                          <p>{item.action || zhCN.optimizeDemo.pendingValue}</p>
                          {item.target ? (
                            <small>
                              {zhCN.optimizeDemo.deviceActionTarget}：{item.target}
                            </small>
                          ) : null}
                          {item.reason ? (
                            <small>
                              {zhCN.optimizeDemo.deviceActionReason}：{item.reason}
                            </small>
                          ) : null}
                          {item.preconditions?.length ? (
                            <div className="optimize-device-action-preconditions">
                              <span>{zhCN.optimizeDemo.deviceActionPreconditions}</span>
                              <ul>
                                {item.preconditions.map((condition, conditionIndex) => (
                                  <li key={`${scheme.key || "scheme"}-device-${index + 1}-condition-${conditionIndex + 1}`}>
                                    {condition}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>{zhCN.optimizeDemo.schemeDeviceActionsEmpty}</p>
                  )}
                </div>

                <div className="optimize-response-block">
                  <h4>{zhCN.optimizeDemo.schemeReadinessTitle}</h4>
                  {schemeReadiness ? (
                    <div className="optimize-readiness">
                      <div className="optimize-readiness-head">
                        <div className="optimize-readiness-score">
                          <span>{zhCN.optimizeDemo.schemeReadinessScore}</span>
                          <strong>
                            {typeof schemeReadiness.score === "number"
                              ? `${schemeReadiness.score.toFixed(0)}`
                              : zhCN.optimizeDemo.pendingValue}
                          </strong>
                        </div>
                        <StatusPill
                          label={localizeSchemeReadinessLevel(schemeReadiness.level)}
                          tone={mapGateTone(schemeReadiness.level)}
                        />
                      </div>
                      <div className="optimize-readiness-reason">
                        <span>{zhCN.optimizeDemo.schemeReadinessReason}</span>
                        <p>{schemeReadiness.reason || zhCN.optimizeDemo.schemeReadinessPending}</p>
                      </div>
                      <div className="optimize-readiness-grid">
                        <div className="optimize-readiness-block">
                          <span>{zhCN.optimizeDemo.schemeReadinessBlockers}</span>
                          {schemeReadiness.blockers?.length ? (
                            <ul>
                              {schemeReadiness.blockers.map((item, index) => (
                                <li key={`${scheme.key || "scheme"}-blocker-${index + 1}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{zhCN.optimizeDemo.schemeReadinessNoBlockers}</p>
                          )}
                        </div>
                        <div className="optimize-readiness-block">
                          <span>{zhCN.optimizeDemo.schemeReadinessCheckpoints}</span>
                          {schemeReadiness.checkpoints?.length ? (
                            <ul>
                              {schemeReadiness.checkpoints.map((item, index) => (
                                <li key={`${scheme.key || "scheme"}-checkpoint-${index + 1}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{zhCN.optimizeDemo.schemeReadinessNoCheckpoints}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>{zhCN.optimizeDemo.schemeReadinessEmpty}</p>
                  )}
                </div>

                <div className="optimize-scheme-links">
                  {(["devices", "trends", "scene"] as const).map((key) => {
                    const link = scheme.links?.[key];
                    const label =
                      key === "devices"
                        ? zhCN.optimizeDemo.linkDevices
                        : key === "trends"
                          ? zhCN.optimizeDemo.linkTrends
                          : zhCN.optimizeDemo.linkScene;
                    return link?.enabled && link.href ? (
                      <a key={`${scheme.key || "scheme"}-${key}`} className="scene-open-link" href={link.href}>
                        {link.label || label}
                      </a>
                    ) : (
                      <span key={`${scheme.key || "scheme"}-${key}`} className="scene-open-link is-disabled">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </article>
              );
            })
          ) : (
            <div className="optimize-response-block">
              <p>{zhCN.optimizeDemo.pendingHint}</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.optimizeDemo.sectionEvidence}>
        <div className="optimize-response">
          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.evidenceMatchedCount}</span>
              <strong>{formatNumber(ruleEvidence?.matchedCount, 0)}</strong>
            </article>
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.evidenceSkippedCount}</span>
              <strong>{formatNumber(ruleEvidence?.skippedCount, 0)}</strong>
            </article>
          </div>

          <div className="optimize-response-block">
            <h4>{zhCN.optimizeDemo.evidenceMatchedRuleIds}</h4>
            {matchedRuleIds.length ? (
              <div className="optimize-inline-list">
                {matchedRuleIds.map((ruleId) => (
                  <span key={ruleId}>{ruleId}</span>
                ))}
              </div>
            ) : (
              <p>{zhCN.optimizeDemo.evidenceNoMatchedRuleIds}</p>
            )}
          </div>

          <div className="optimize-response-block">
            <h4>{zhCN.optimizeDemo.evidencePrimaryCards}</h4>
            {ruleEvidence?.primaryCards?.length ? (
              <ul>
                {ruleEvidence.primaryCards.map((card) => (
                  <li key={card.id || card.title}>
                    {card.title || zhCN.optimizeDemo.pendingValue}
                    {card.reason ? `：${card.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{zhCN.optimizeDemo.evidenceNoPrimaryCards}</p>
            )}
          </div>

          <div className="optimize-response-block">
            <h4>{zhCN.optimizeDemo.evidenceSkippedRules}</h4>
            {skippedRules.length ? (
              <ul>
                {skippedRulePreview.map((rule) => (
                  <li key={rule.ruleId}>
                    <strong>{rule.ruleId || zhCN.optimizeDemo.pendingValue}</strong>
                    <div>{zhCN.optimizeDemo.evidenceRuleReason}：{localizeSkippedRuleReason(rule.reason)}</div>
                    {rule.missingMetrics?.length ? (
                      <div>
                        {zhCN.optimizeDemo.evidenceMissingMetrics}：
                        {rule.missingMetrics
                          .map(
                            (metric) =>
                              `${metric.metric || zhCN.optimizeDemo.pendingValue}（${localizeMissingMetricCategory(metric.category)}）`
                          )
                          .join("、")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{zhCN.optimizeDemo.evidenceNoSkippedRules}</p>
            )}
            {skippedRuleOverflow.length ? (
              <details className="optimize-more-details">
                <summary>
                  {zhCN.optimizeDemo.evidenceSkippedRules}
                  {`（+${skippedRuleOverflow.length}）`}
                </summary>
                <ul>
                  {skippedRuleOverflow.map((rule, index) => (
                    <li key={`${rule.ruleId || "skipped"}-${index + 1}`}>
                      <strong>{rule.ruleId || zhCN.optimizeDemo.pendingValue}</strong>
                      <div>{zhCN.optimizeDemo.evidenceRuleReason}：{localizeSkippedRuleReason(rule.reason)}</div>
                      {rule.missingMetrics?.length ? (
                        <div>
                          {zhCN.optimizeDemo.evidenceMissingMetrics}：
                          {rule.missingMetrics
                            .map(
                              (metric) =>
                                `${metric.metric || zhCN.optimizeDemo.pendingValue}（${localizeMissingMetricCategory(metric.category)}）`
                            )
                            .join("、")}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={zhCN.optimizeDemo.sectionDiagnostics}>
        <div className="optimize-response">
          <div className="optimize-response-block">
            <h4>{zhCN.optimizeDemo.responseDiagnostics}</h4>
            {details?.diagnostics?.length ? (
              <ul>
                {details.diagnostics.map((item, index) => (
                  <li key={`${item}-${index + 1}`}>{localizeOptimizeDiagnostic(item)}</li>
                ))}
              </ul>
            ) : (
              <p>
                {hasValidationError
                  ? localizedError || zhCN.optimizeDemo.diagnosticsEmpty
                  : zhCN.optimizeDemo.diagnosticsEmpty}
              </p>
            )}
            <small>{details?.generatedAt || zhCN.optimizeDemo.generatedAtPending}</small>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

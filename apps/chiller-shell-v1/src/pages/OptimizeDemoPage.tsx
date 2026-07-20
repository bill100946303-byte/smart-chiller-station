import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, type LocaleCode, zhCN } from "../i18n/zhCN";
import { getAuthSession, getCurrentProject, resolveAuthProjectDisplayName } from "../services/auth";
import "./OptimizeDemoExtracted.css";
import {
  type DashboardOverviewDto,
  type OptimizeDraftDetailsDto,
  type OptimizeDraftErrorDto,
  type OptimizeExecutionRecordDto,
  type SceneLegacyTrendDto,
  type ShadowVerificationRecordDto,
  type ShadowVerificationSummaryDto,
  approveOptimizeExecution,
  approveTowerApproachExecution,
  createOptimizeExecution,
  createShadowVerificationRecord,
  createTowerApproachExecution,
  dispatchOptimizeExecution,
  exportShadowVerificationRecords,
  exportShadowVerificationReviewPrintPage,
  exportShadowVerificationReviewReport,
  fetchDashboardOverview,
  fetchOptimizeExecutions,
  fetchDashboardOverviewForProject,
  fetchShadowVerificationRecords,
  fetchSceneLegacyTrend,
  postOptimizeDraft,
  rollbackOptimizeExecution,
  rollbackTowerApproachExecution
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

type DraftTowerApproachAdvisor = {
  status?: "ready" | "partial" | "unavailable" | string;
  currentApproachC?: number | null;
  currentTcwsC?: number | null;
  requestedWetBulbC?: number | null;
  targetApproachC?: number | null;
  targetTcwsC?: number | null;
  targetBandC?: {
    low?: number | null;
    high?: number | null;
    label?: string;
  };
  executionReady?: boolean;
  dispatchReady?: boolean;
  executionMode?: "read_only" | "shadow" | "assisted" | "enforced" | string;
  dispatchMode?: "off" | "shadow" | "assisted" | "enforced" | string;
  controlMode?: string;
  reason?: string;
  disclaimer?: string;
  blockers?: string[];
  warnings?: string[];
  inputSignals?: Array<{
    key?: string;
    label?: string;
    value?: number | string | null;
    unit?: string | null;
    required?: boolean;
    ok?: boolean;
    reason?: string | null;
  }>;
  outputTargets?: {
    targetApproachC?: number | null;
    targetTcwsC?: number | null;
    rawTargetApproachC?: number | null;
    currentApproachC?: number | null;
    currentTcwsC?: number | null;
    finalTargetApproachC?: number | null;
    finalTargetTcwsC?: number | null;
    nextStepTargetApproachC?: number | null;
    nextStepTargetTcwsC?: number | null;
    maxStepC?: number | null;
    deadbandC?: number | null;
    targetAdjustedByMinCondenserGuardrail?: boolean;
    stepLimited?: boolean;
    multiStepPlan?: {
      required?: boolean;
      reason?: string;
      finalTargetTcwsC?: number | null;
      finalTargetApproachC?: number | null;
      nextStepTargetTcwsC?: number | null;
      nextStepTargetApproachC?: number | null;
      stepCount?: number | null;
      maxStepC?: number | null;
      steps?: Array<{
        index?: number | null;
        targetTcwsC?: number | null;
        targetApproachC?: number | null;
      }>;
    } | null;
  };
  constraints?: {
    minCondenserInletTempC?: number | null;
  };
  objective?: {
    formula?: string;
    description?: string;
  };
  advisorResult?: {
    lifecycleMode?: string;
    execution?: {
      allowedToCreateExecution?: boolean;
      allowedToDispatch?: boolean;
      controlPointMapped?: boolean;
      rollbackMapped?: boolean;
      dispatchMode?: string;
    };
    savingsVerification?: {
      method?: string;
      metrics?: string[];
      acceptance?: string;
    };
    blockers?: string[];
    warnings?: string[];
  };
  guardrails?: DraftTowerApproachGuardrail[];
};

type DraftTowerApproachGuardrail = {
  key?: string;
  status?: "ready" | "missing" | "blocked" | string;
  value?: number | string | null;
  message?: string;
  resolvedBy?: "by-chiller" | "by-model" | "default" | "missing" | string;
  matchedKeys?: string[];
};

type DraftPumpDeltaTAdvisor = {
  status?: "ready" | "partial" | "unavailable" | string;
  executionReady?: boolean;
  dispatchReady?: boolean;
  executionMode?: "read_only" | "shadow" | "assisted" | string;
  dispatchMode?: "off" | "shadow" | "assisted" | string;
  controlMode?: string;
  current?: {
    chilledDeltaT?: number | null;
    coolingDeltaT?: number | null;
    chilledPumpPowerKw?: number | null;
    coolingPumpPowerKw?: number | null;
    chillerPowerKw?: number | null;
    totalPowerKw?: number | null;
    systemCop?: number | null;
    currentApproachC?: number | null;
  };
  targetPoints?: {
    chilledPump?: string;
    coolingPump?: string;
    ttlSeconds?: number | null;
    trimRangeHz?: {
      min?: number | null;
      max?: number | null;
    };
  };
  targetBandsC?: {
    chilledDeltaT?: {
      low?: number | null;
      high?: number | null;
      label?: string;
    };
    coolingDeltaT?: {
      low?: number | null;
      high?: number | null;
      label?: string;
    };
  };
  outputTargets?: {
    chilledPumpFreqTrimHz?: number | null;
    coolingPumpFreqTrimHz?: number | null;
    rollbackTrimHz?: number | null;
    maxStepHz?: number | null;
    ttlSeconds?: number | null;
    holdMinutes?: number | null;
    rollbackLockoutMinutes?: number | null;
    trimRangeHz?: {
      min?: number | null;
      max?: number | null;
    };
  };
  reason?: string;
  disclaimer?: string;
  blockers?: string[];
  warnings?: string[];
  inputSignals?: Array<{
    key?: string;
    label?: string;
    value?: number | string | null;
    unit?: string | null;
    required?: boolean;
    ok?: boolean;
    reason?: string | null;
  }>;
  guardrails?: Array<{
    key?: string;
    status?: "ready" | "missing" | "blocked" | "locked" | string;
    value?: number | string | null;
    message?: string;
  }>;
  objective?: {
    formula?: string;
    description?: string;
  };
  advisorResult?: {
    lifecycleMode?: string;
    execution?: {
      allowedToCreateExecution?: boolean;
      allowedToDispatch?: boolean;
      controlPointMapped?: boolean;
      rollbackMapped?: boolean;
      dispatchMode?: string;
    };
    savingsVerification?: {
      method?: string;
      metrics?: string[];
      acceptance?: string;
    };
  };
};

type DraftChillerStagingCandidate = {
  key?: string;
  combination?: string[];
  runningCount?: number | null;
  combinationCapacityKw?: number | null;
  combinationPlrPct?: number | null;
  capacityReservePct?: number | null;
  sampleCount?: number | null;
  confidence?: "high" | "medium" | "low" | string;
  stationCop?: number | null;
  comboCop?: number | null;
  kwPerRt?: number | null;
  sampleMinutes?: number | null;
  alarmCount?: number | null;
  source?: string | null;
  matchingTier?: string;
  sampleRole?: string;
  canLearnSingleChillerCop?: boolean;
  canLearnCombinationCop?: boolean;
  estimatedStationPowerKw?: number | null;
  expectedTotalPowerDeltaKw?: number | null;
  expectedPowerDeltaPct?: number | null;
  action?: string;
  blockers?: string[];
  warnings?: string[];
  isCurrent?: boolean;
};

type DraftChillerStagingEvidencePoint = {
  combination?: string[];
  sampleCount?: number | null;
  sampleMinutes?: number | null;
  confidence?: "high" | "medium" | "low" | string;
  matchingTier?: string;
  stationCop?: number | null;
  comboCop?: number | null;
  kwPerRt?: number | null;
  stationPowerKw?: number | null;
  chillerPowerKw?: number | null;
  alarmCount?: number | null;
  source?: string | null;
  sampleRole?: string;
  canLearnSingleChillerCop?: boolean;
  note?: string;
};

type DraftChillerStagingEvidence = {
  learningBoundary?: {
    singleChillerCopLearning?: string;
    multiChillerCop?: string;
    message?: string;
  };
  currentWindow?: {
    runningCombination?: string[];
    runningCount?: number | null;
    currentRunMinutes?: number | null;
    canLearnSingleChillerCop?: boolean;
    canLearnCombinationCop?: boolean;
    sampleRole?: string;
  };
  currentLiveSample?: {
    status?: "recordable" | "unavailable" | string;
    source?: string;
    includedInHistory?: boolean;
    reason?: string;
    combination?: string[];
    runningCount?: number | null;
    loadKw?: number | null;
    loadRatePct?: number | null;
    wetBulbC?: number | null;
    chilledSupplyTempC?: number | null;
    stationPowerKw?: number | null;
    chillerPowerKw?: number | null;
    stationCop?: number | null;
    comboCop?: number | null;
    kwPerRt?: number | null;
    alarmCount?: number | null;
    sampleMinutes?: number | null;
    sampleRole?: string;
    canLearnSingleChillerCop?: boolean;
    canLearnCombinationCop?: boolean;
    requiredAccumulation?: {
      minSampleCount?: number | null;
      highConfidenceSampleCount?: number | null;
      note?: string;
    };
  };
  comparisonWindow?: {
    loadKw?: number | null;
    wetBulbC?: number | null;
    chilledSupplyTempC?: number | null;
    loadRateTolerancePct?: number | null;
    wetBulbToleranceC?: number | null;
    chilledSupplyTempToleranceC?: number | null;
  };
  sampleSummary?: {
    historyRowCount?: number | null;
    sampleTotal?: number | null;
    candidateCombinationCount?: number | null;
    comparableCandidateCount?: number | null;
    highConfidenceCandidateCount?: number | null;
    lowConfidenceCandidateCount?: number | null;
    currentCombinationSamples?: number | null;
    targetCombinationSamples?: number | null;
    minSampleCount?: number | null;
    highConfidenceSampleCount?: number | null;
  };
  currentCombinationEvidence?: DraftChillerStagingEvidencePoint | null;
  targetCombinationEvidence?: DraftChillerStagingEvidencePoint | null;
  shadowVerificationPlan?: {
    method?: string;
    durationMinutes?: {
      min?: number | null;
      max?: number | null;
    };
    metrics?: string[];
    acceptance?: string;
    requiredBeforeSubmit?: string[];
    resultRecording?: {
      status?: string;
      note?: string;
    };
  };
};

type DraftChillerStagingSampleCapture = {
  status?: "recorded" | "skipped_recent" | "skipped" | "failed" | string;
  reason?: string;
  combinationKey?: string | null;
  sampleId?: string | null;
  capturedAt?: string | null;
  latestSampleId?: string | null;
  latestSampleAt?: string | null;
  minIntervalMinutes?: number | null;
};

type DraftChillerStagingSampleGovernance = {
  status?: string;
  readyForRanking?: boolean;
  summary?: string;
  currentCombinationKey?: string | null;
  currentCombinationSamples?: number | null;
  currentSameBandSamples?: number | null;
  coveredCandidateCount?: number | null;
  candidateCombinationCount?: number | null;
  broadReadyCandidateCount?: number | null;
  sameBandReadyCandidateCount?: number | null;
  highConfidenceCandidateCount?: number | null;
  minSampleCount?: number | null;
  highConfidenceSampleCount?: number | null;
  missingCandidateCoverage?: Array<{
    combinationKey?: string;
    combination?: string[];
    totalSamples?: number | null;
    sameBandSamples?: number | null;
    deficitToMin?: number | null;
    deficitToHigh?: number | null;
    matchingTier?: string;
  }>;
  boundary?: string;
};

type DraftChillerStagingAdvisor = {
  status?: "ready" | "partial" | "unavailable" | string;
  executionReady?: boolean;
  dispatchReady?: boolean;
  executionMode?: "read_only" | "shadow" | string;
  dispatchMode?: "off" | "shadow" | string;
  basis?: "combination_empirical_performance" | string;
  confidence?: "high" | "medium" | "low" | string;
  current?: {
    runningCombination?: string[];
    runningCount?: number | null;
    combinationCapacityKw?: number | null;
    systemCoolingLoadKw?: number | null;
    combinationPlrPct?: number | null;
    chillerPowerTotalKw?: number | null;
    stationPowerTotalKw?: number | null;
    comboCop?: number | null;
    stationCop?: number | null;
    currentRunMinutes?: number | null;
  };
  recommendation?: {
    action?: "keep" | "switch_combination" | "add_one" | "remove_one" | "rebalance" | string;
    targetCombination?: string[];
    expectedTotalPowerDeltaKw?: number | null;
    expectedCopDelta?: number | null;
    reason?: string;
  };
  evidence?: DraftChillerStagingEvidence;
  sampleEvidence?: DraftChillerStagingEvidence;
  sampleCapture?: DraftChillerStagingSampleCapture;
  sampleGovernance?: DraftChillerStagingSampleGovernance;
  candidates?: DraftChillerStagingCandidate[];
  reason?: string;
  disclaimer?: string;
  blockers?: string[];
  warnings?: string[];
  savingsVerification?: {
    method?: string;
    durationMinutes?: {
      min?: number | null;
      max?: number | null;
    };
    metrics?: string[];
    acceptance?: string;
  };
  advisorResult?: {
    lifecycleMode?: string;
    execution?: {
      allowedToCreateExecution?: boolean;
      allowedToDispatch?: boolean;
      dispatchMode?: string;
      enforcedAllowed?: boolean;
    };
    savingsVerification?: {
      method?: string;
      durationMinutes?: {
        min?: number | null;
        max?: number | null;
      };
      metrics?: string[];
      acceptance?: string;
    };
  };
};

type DraftOperationalDiagnosticEvidence = {
  key?: string;
  label?: string;
  value?: number | string | null;
  unit?: string | null;
};

type DraftInstrumentReviewStatus = "review" | "normal" | "insufficient" | string;

type DraftInstrumentCrossCheck = {
  key?: string;
  label?: string;
  status?: DraftInstrumentReviewStatus;
  value?: number | string | null;
  unit?: string | null;
  threshold?: string | null;
  evidence?: string;
  reviewTarget?: string;
  boundary?: string;
};

type DraftInstrumentDriftCandidate = {
  key?: string;
  metric?: string;
  label?: string;
  status?: DraftInstrumentReviewStatus;
  severity?: "high" | "medium" | "low" | "info" | string;
  confidence?: "high" | "medium" | "low" | string;
  value?: number | string | null;
  unit?: string | null;
  threshold?: string | null;
  suspectedSignals?: string[];
  reason?: string;
  requiredEvidence?: string[];
  boundary?: string;
};

type DraftInstrumentFieldReviewTarget = {
  key?: string;
  priority?: "P0" | "P1" | "P2" | string;
  title?: string;
  trigger?: string;
  requiredEvidence?: string[];
  acceptanceCriteria?: string;
  boundary?: string;
};

type DraftSensorLedgerEvidence = {
  status?: string;
  finalDecision?: string;
  readyForReview?: boolean;
  acceptedRows?: number | null;
  totalRows?: number | null;
  expiredCalibrationCount?: number | null;
  missingRangeCount?: number | null;
  missingInputCount?: number | null;
  warningsCount?: number | null;
  blockersCount?: number | null;
  reportPath?: string | null;
  controlBoundary?: string;
};

type DraftInstrumentDiagnosticCurrent = {
  reviewBoundary?: string;
  crossChecks?: DraftInstrumentCrossCheck[];
  driftCandidates?: DraftInstrumentDriftCandidate[];
  fieldReviewTargets?: DraftInstrumentFieldReviewTarget[];
  sensorLedgerEvidence?: DraftSensorLedgerEvidence;
  driftWindow?: {
    status?: string;
    steadyState?: {
      status?: string;
      basisMetric?: string | null;
      sampleCount?: number | null;
      thresholdRangePct?: number | null;
      rangePct?: number | null;
      fullRangePct?: number | null;
      reason?: string;
    };
  };
};

type DraftHydraulicRiskStatus = "active" | "watch" | "normal" | "gap" | "unknown" | string;

type DraftHydraulicRiskIndicator = {
  key?: string;
  label?: string;
  status?: DraftHydraulicRiskStatus;
  severity?: "high" | "medium" | "low" | "info" | string;
  confidence?: "high" | "medium" | "low" | string;
  value?: number | string | null;
  unit?: string | null;
  threshold?: string | null;
  reason?: string;
  evidence?: string[];
  requiredEvidence?: string[];
  reviewTarget?: string;
  boundary?: string;
};

type DraftHydraulicFieldReviewTarget = {
  key?: string;
  priority?: "P0" | "P1" | "P2" | string;
  title?: string;
  trigger?: string;
  requiredEvidence?: string[];
  acceptanceCriteria?: string;
  boundary?: string;
};

type DraftHydraulicDiagnosticCurrent = {
  chilledDeltaT?: number | null;
  differentialPressureKpa?: number | null;
  bypassValveOpenPct?: number | null;
  activeRiskCount?: number | null;
  gapCount?: number | null;
  reviewBoundary?: string;
  riskIndicators?: DraftHydraulicRiskIndicator[];
  fieldReviewTargets?: DraftHydraulicFieldReviewTarget[];
  trendWindow?: {
    status?: string;
    reason?: string;
    persistentLowDeltaT?: boolean;
    chilledDeltaT?: {
      sampleCount?: number | null;
      belowPct?: number | null;
      mean?: number | null;
    };
  };
};

type DraftControlOscillationRiskStatus = "active" | "watch" | "normal" | "gap" | "unknown" | string;

type DraftControlOscillationRiskIndicator = {
  key?: string;
  label?: string;
  status?: DraftControlOscillationRiskStatus;
  severity?: "high" | "medium" | "low" | "info" | string;
  confidence?: "high" | "medium" | "low" | string;
  value?: number | string | null;
  unit?: string | null;
  threshold?: string | null;
  reason?: string;
  evidence?: string[];
  requiredEvidence?: string[];
  reviewTarget?: string;
  boundary?: string;
  sampleCount?: number | null;
  range?: number | null;
  rangePct?: number | null;
  directionChangeCount?: number | null;
};

type DraftControlOscillationFieldReviewTarget = {
  key?: string;
  priority?: "P0" | "P1" | "P2" | string;
  title?: string;
  trigger?: string;
  requiredEvidence?: string[];
  acceptanceCriteria?: string;
  boundary?: string;
};

type DraftControlOscillationLedgerEvidence = {
  status?: "ready" | "partial" | "blocked" | "unavailable" | string;
  importStatus?: string;
  evidenceMode?: "field_export" | "template_sample" | "missing" | string;
  usableForDiagnosis?: boolean;
  generatedAt?: string | null;
  reportPath?: string | null;
  totalRows?: number | null;
  acceptedRows?: number | null;
  blockersCount?: number | null;
  warningsCount?: number | null;
  controlBoundary?: string;
  preflight?: {
    status?: "ready" | "partial" | "waiting" | "blocked" | "unavailable" | string;
    finalDecision?: string;
    readyForImport?: boolean;
    generatedAt?: string | null;
    reportPath?: string | null;
    acceptedRows?: number | null;
    totalRows?: number | null;
    blockersCount?: number | null;
    warningsCount?: number | null;
    inputCount?: number | null;
    missingInputCount?: number | null;
    importStatus?: string;
    controlBoundary?: string;
  };
  promotion?: {
    status?: "ready" | "partial" | "waiting" | "blocked" | "unavailable" | string;
    finalDecision?: string;
    formalImportReady?: boolean;
    generatedAt?: string | null;
    reportPath?: string | null;
    acceptedRows?: number | null;
    totalRows?: number | null;
    blockersCount?: number | null;
    warningsCount?: number | null;
    importStatus?: string;
    preflightDecision?: string | null;
    controlBoundary?: string;
  };
  tables?: Array<{
    key?: string;
    title?: string;
    status?: string;
    inputMode?: string;
    rowCount?: number | null;
    acceptedRowCount?: number | null;
    outputPath?: string;
  }>;
};

type DraftControlOscillationDiagnosticCurrent = {
  activeRiskCount?: number | null;
  watchRiskCount?: number | null;
  gapCount?: number | null;
  reviewBoundary?: string;
  riskIndicators?: DraftControlOscillationRiskIndicator[];
  fieldReviewTargets?: DraftControlOscillationFieldReviewTarget[];
  ledgerEvidence?: DraftControlOscillationLedgerEvidence;
  trendWindow?: {
    status?: string;
    reason?: string;
    sampleCount?: number | null;
    maxDirectionChangeCount?: number | null;
  };
};

type DraftOperationalDiagnosticItem = {
  key?: string;
  title?: string;
  status?: "ready" | "partial" | "unavailable" | string;
  confidence?: "high" | "medium" | "low" | string;
  current?: Record<string, unknown>;
  findings?: string[];
  blockers?: string[];
  warnings?: string[];
  evidence?: DraftOperationalDiagnosticEvidence[];
  suggestions?: string[];
};

type DraftDiagnosticReadinessItem = {
  key?: string;
  title?: string;
  tier?: "A" | "A/B" | "B" | "B/C" | "C" | string;
  status?: "ready" | "partial" | "unavailable" | string;
  currentFeasibility?: "can_do_v1" | "directional_review" | "point_gap" | string;
  firstVersionOutput?: string;
  availableData?: string[];
  missingData?: string[];
  boundary?: string;
  allowedMode?: "read_only" | "shadow_review" | "point_plan" | string;
  confidence?: "high" | "medium" | "low" | string;
};

type DraftDiagnosticReadinessMatrix = {
  basis?: string;
  scope?: string;
  total?: number | null;
  readyNowCount?: number | null;
  directionalCount?: number | null;
  pointGapCount?: number | null;
  controlBoundary?: string;
  boundaryNotes?: string[];
  items?: DraftDiagnosticReadinessItem[];
};

type DraftFieldVerificationTask = {
  key?: string;
  priority?: "P0" | "P1" | "P2" | string;
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
  allowedMode?: "field_review_only" | string;
};

type DraftFieldVerificationChecklist = {
  basis?: string;
  scope?: string;
  controlBoundary?: string;
  total?: number | null;
  p0Count?: number | null;
  p1Count?: number | null;
  items?: DraftFieldVerificationTask[];
};

type DraftOperationalDiagnosticsAdvisor = {
  status?: "ready" | "partial" | "unavailable" | string;
  executionMode?: "read_only" | string;
  basis?: "runtime_point_consistency" | string;
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
    pointCoverage?: {
      deviceRows?: number | null;
      registerPoints?: number | null;
      runningChillerCount?: number | null;
      runningChilledPumpCount?: number | null;
      runningCoolingPumpCount?: number | null;
      coolingTowerCount?: number | null;
      runningCoolingTowerCount?: number | null;
      coolingTowerFanCount?: number | null;
      runningCoolingTowerFanCount?: number | null;
      branchCount?: number | null;
      coolingTowerCellCount?: number | null;
    };
    diagnosticReadinessMatrix?: DraftDiagnosticReadinessMatrix;
    fieldVerificationChecklist?: DraftFieldVerificationChecklist;
    fieldCollectionPackageEvidence?: {
      status?: string;
      finalDecision?: string;
      readyToCollect?: boolean | null;
      generatedAt?: string | null;
      reportPath?: string | null;
      formalInputCount?: number | null;
      missingFormalInputCount?: number | null;
      presentFormalInputCount?: number | null;
      templateCount?: number | null;
      blockersCount?: number | null;
      warningsCount?: number | null;
      formalInputs?: Array<{
        key?: string | null;
        label?: string | null;
        path?: string | null;
        status?: string | null;
        lineCount?: number | null;
      }>;
      controlBoundary?: string | null;
    };
  };
  items?: DraftOperationalDiagnosticItem[];
  disclaimers?: string[];
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
  towerApproachAdvisor?: DraftTowerApproachAdvisor;
  pumpDeltaTAdvisor?: DraftPumpDeltaTAdvisor;
  chillerStagingAdvisor?: DraftChillerStagingAdvisor;
  operationalDiagnosticsAdvisor?: DraftOperationalDiagnosticsAdvisor;
  reviewReadiness?: DraftReviewReadiness;
  schemes?: DraftScheme[];
  ruleEvidence?: DraftRuleEvidence;
  draftLabel?: string;
};

type AutoPrefillKind = "loading" | "ready" | "partial" | "error";
type AutoPrefillReasonCode =
  | "prefill_overview_request_failed"
  | "prefill_load_snapshot_missing"
  | "prefill_wet_bulb_request_failed"
  | "prefill_wet_bulb_points_missing";

type AutoPrefillCandidate = {
  value: number | null;
  source: string | null;
  timestamp: string | null;
  reasonCode: AutoPrefillReasonCode | null;
};

type AutoPrefillState = {
  kind: AutoPrefillKind;
  loadSource: string | null;
  wetBulbSource: string | null;
  refreshedAt: string | null;
  reasonCodes: AutoPrefillReasonCode[];
};

type ShadowVerificationReviewOutcome = "improved" | "neutral" | "regressed" | "invalid";
type ShadowVerificationTypeFilter = "all" | "chiller-staging" | "tower-approach" | "pump-delta-t";
type ShadowVerificationExecutionFilter = string;

const SHADOW_VERIFICATION_REVIEW_OUTCOMES: Array<{
  outcome: ShadowVerificationReviewOutcome;
  label: string;
}> = [
  { outcome: "improved", label: "标记改善" },
  { outcome: "neutral", label: "标记持平" },
  { outcome: "regressed", label: "标记退化" },
  { outcome: "invalid", label: "标记无效" }
];

const SHADOW_VERIFICATION_TYPE_FILTERS: Array<{
  value: ShadowVerificationTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "chiller-staging", label: "主机组合" },
  { value: "tower-approach", label: "冷却塔" },
  { value: "pump-delta-t", label: "泵 Delta-T" }
];

function resolveOptimizeActiveSiteId(
  project: { siteId?: string; siteCode?: string; modelKey?: string } | null | undefined
): string {
  const siteId = typeof project?.siteId === "string" ? project.siteId.trim() : "";
  if (siteId) {
    return siteId;
  }

  const siteCode = typeof project?.siteCode === "string" ? project.siteCode.trim() : "";
  if (siteCode) {
    return siteCode;
  }

  const modelKey = typeof project?.modelKey === "string" ? project.modelKey.trim() : "";
  if (modelKey) {
    return modelKey;
  }

  return runtimeConfig.siteId;
}

const WET_BULB_TAG_NAME = "SY-1-509-42048";
const PREFILL_AUTO_REFRESH_MS = 60_000;
const OPTIMIZE_COMPACT_PENDING_VALUE = "待补值";
function getOptimizeLocale(): LocaleCode {
  return getCurrentLocale();
}

function toChineseFallbackByKey(key: string): string {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes("pendingvalue")) return "暂无有效数据";
  if (normalizedKey.includes("pendinghint")) return "等待生成AI建议";
  if (normalizedKey.includes("towerapproachcurrentapproach")) return "当前接近度";
  if (normalizedKey.includes("towerapproachtargetapproach")) return "目标接近度";
  if (normalizedKey.includes("towerapproachcurrenttcws")) return "当前冷却水出水温";
  if (normalizedKey.includes("towerapproachtargettcws")) return "目标冷却水出水温";
  if (normalizedKey.includes("towerapproachtargetband")) return "接近度目标区间";
  if (normalizedKey.includes("towerapproachcontrolmode")) return "控制模式";
  if (normalizedKey.includes("towerapproachguardrail")) return "PLC保护边界";
  if (normalizedKey.includes("inputloadkw")) return "当前负荷（kW）";
  if (normalizedKey.includes("inputoutdoortempc")) return "室外湿球温度（℃）";
  if (normalizedKey.includes("inputmode")) return "运行模式";
  if (normalizedKey.includes("modecooling")) return "制冷";
  if (normalizedKey.includes("prefillloading")) return "正在自动读取当前工况...";
  if (normalizedKey.includes("prefillready")) return "已带入当前冷量与湿球";
  if (normalizedKey.includes("prefillpartial")) return "已带入部分工况";
  if (normalizedKey.includes("prefillerror")) return "自动取数失败，可手动输入。";
  if (normalizedKey.includes("prefillrefresh")) return "重新带入当前值";
  if (normalizedKey.includes("prefillloadsourcedirect")) return "现态总制冷量快照";
  if (normalizedKey.includes("prefillloadsourcederived")) return "按当前 COP x 总功率估算";
  if (normalizedKey.includes("prefillloadsource")) return "负荷来源";
  if (normalizedKey.includes("prefillwetbulbsourcelatestpoint")) return "室外湿球趋势最新点";
  if (normalizedKey.includes("prefillwetbulbsource")) return "湿球来源";
  if (normalizedKey.includes("prefillwetbulbtitle")) return "室外湿球温度";
  if (normalizedKey.includes("prefillupdatedat")) return "最近带入";
  if (normalizedKey.includes("prefillreasonoverviewrequestfailed")) return "总览取数失败，无法自动带入负荷。";
  if (normalizedKey.includes("prefillreasonloadsnapshotmissing")) return "当前负荷快照缺失，请手动填写负荷。";
  if (normalizedKey.includes("prefillreasonwetbulbrequestfailed")) return "湿球趋势取数失败，无法自动带入湿球。";
  if (normalizedKey.includes("prefillreasonwetbulbpointsmissing")) return "没有可用湿球点，请手动填写湿球。";
  if (normalizedKey.includes("executionapprovenote")) return "值班人员已审批";
  if (normalizedKey.includes("executionrollbackreason")) return "人工回退到安全边界";
  if (normalizedKey.includes("executionapprove")) return "审批通过";
  if (normalizedKey.includes("executionrollback")) return "回退";
  if (normalizedKey.includes("executiondispatch")) return "写入影子记录";
  if (normalizedKey.includes("executionsubmitscheme")) return "提交主方案审批";
  if (normalizedKey.includes("executionsubmittower")) return "提交接近度审批";
  if (normalizedKey.includes("executionlatestid")) return "历史执行单";
  if (normalizedKey.includes("executionlateststatus")) return "最近状态";
  if (normalizedKey.includes("executionlatestupdatedat")) return "最近更新时间";
  if (normalizedKey.includes("executionlatesttarget")) return "目标摘要";
  if (normalizedKey.includes("executionhistory")) return "执行审计记录";
  if (normalizedKey.includes("schemeanchoring")) return "对标依据";
  if (normalizedKey.includes("schemereadiness")) return "方案准备度";
  if (normalizedKey.includes("deviceaction")) return "设备动作";
  if (normalizedKey.includes("benefitestimate")) return "节能验证估算";
  if (normalizedKey.includes("historybenchmark")) return "历史同工况对标";
  if (normalizedKey.includes("baseline")) return "当前基线";
  if (normalizedKey.includes("evidence")) return "规则证据";
  if (normalizedKey.includes("diagnostics")) return "诊断信息";
  if (normalizedKey.includes("response")) return "AI建议结果";
  if (normalizedKey.includes("requestscenario")) return "请求工况";
  if (normalizedKey.includes("gate")) return "优化门禁";
  if (/heading/i.test(key)) return "AI优化建议与影子验证";
  if (/subtitle|note|hint|disclaimer|summary|reason|footnote/i.test(key)) return "暂无可用说明，请先生成AI建议或核对数据源";
  if (/section/i.test(key)) return "优化功能区";
  if (/status/i.test(key)) return "状态";
  if (/pending|loading/i.test(key)) return "处理中";
  if (/ready|approved/i.test(key)) return "已就绪";
  if (/score|confidence/i.test(key)) return "评分";
  if (/title|label/i.test(key)) return "工程项";
  if (/input|form|submit|refresh|action/i.test(key)) return "影子动作";
  if (/mode/i.test(key)) return "模式";
  if (/target|value|count|window|tier|level/i.test(key)) return "工程指标";
  return "暂无有效数据";
}

function toVietnameseFallbackByKey(key: string): string {
  if (/heading/i.test(key)) return "Demo tối ưu";
  if (/subtitle|note|hint|disclaimer|summary|reason|footnote/i.test(key)) return "Nội dung chờ bổ sung";
  if (/section/i.test(key)) return "Khu chức năng";
  if (/status/i.test(key)) return "Trạng thái";
  if (/pending|loading/i.test(key)) return "Đang xử lý";
  if (/ready|approved/i.test(key)) return "Sẵn sàng";
  if (/score|confidence/i.test(key)) return "Điểm";
  if (/title|label/i.test(key)) return "Tiêu đề";
  if (/input|form|submit|refresh|action/i.test(key)) return "Thao tác";
  if (/mode/i.test(key)) return "Chế độ";
  if (/target|value|count|window|tier|level/i.test(key)) return "Chỉ số";
  return "Đang cập nhật";
}

function translateEnglishUiText(locale: LocaleCode, key: string, text: string): string {
  const original = text.trim();
  if (!original) {
    return original;
  }
  if (!/[A-Za-z]/.test(original)) {
    return original;
  }
  if (locale === "en-US") {
    return original;
  }

  const replaceAll = (source: string, pairs: Array<[string, string]>): string =>
    pairs.reduce((acc, [from, to]) => acc.replace(new RegExp(from, "gi"), to), source);

  if (locale === "zh-CN") {
    const exactMap: Record<string, string> = {
      heading: "AI优化建议与影子验证",
      sectionInputs: "输入参数",
      sectionBaseline: "当前基线",
      sectionHistoryBenchmark: "历史对标",
      sectionReadiness: "复核就绪度",
      sectionSchemes: "方案对比",
      sectionEvidence: "规则证据",
      requestAccepted: "已接收",
      requestDraftReturned: "已生成AI建议",
      requestPending: "待提交",
      statusDraft: "AI建议",
      statusUnknown: "数据异常",
      pendingValue: "暂无有效数据",
      pendingHint: "等待生成AI建议",
      inputLoadKw: "当前负荷（kW）",
      inputOutdoorTempC: "室外湿球温度（℃）",
      inputMode: "运行模式",
      modeCooling: "制冷",
      submit: "生成AI建议",
      submitLoading: "生成中...",
      formFootnote: "系统会优先读取当前冷量和室外湿球，AI只输出目标值建议，不直接下发PLC。",
      summaryRoute: "治理入口",
      summaryRouteValue: "优化建议",
      summaryRouteHint: "统一审批入口",
      summaryStatus: "请求状态",
      summaryStatusHint: "等待生成建议",
      summaryStatusDraftHint: "当前返回AI目标值建议，执行仍受权限、模式、点位映射和PLC边界控制。",
      summaryInput: "输入工况",
      sectionWindow: "数据可信度",
      sectionBenefitEstimate: "节能验证",
      sectionTowerApproach: "接近度执行前检查",
      sectionDiagnostics: "诊断信息",
      sectionResponse: "AI建议结果",
      prefillLoading: "读取当前工况...",
      prefillReady: "已带入当前冷量与湿球",
      prefillPartial: "已带入部分工况",
      prefillError: "自动取数失败，可手动输入。",
      prefillRefresh: "重新带入当前值",
      prefillLoadSourceLabel: "负荷来源",
      prefillLoadSourceDirect: "现态总制冷量快照",
      prefillLoadSourceDerived: "按当前 COP x 总功率估算",
      prefillWetBulbSourceLabel: "湿球来源",
      prefillWetBulbSourceLatestPoint: "室外湿球趋势最新点",
      prefillWetBulbTitle: "室外湿球温度",
      prefillUpdatedAtLabel: "最近带入",
      prefillReasonOverviewRequestFailed: "总览取数失败，无法自动带入负荷。",
      prefillReasonLoadSnapshotMissing: "当前负荷快照缺失，请手动填写负荷。",
      prefillReasonWetBulbRequestFailed: "湿球趋势取数失败，无法自动带入湿球。",
      prefillReasonWetBulbPointsMissing: "没有可用湿球点，请手动填写湿球。",
      historyBenchmarkSubtitle: "按负荷率和湿球区间匹配历史高效工况；样本不足时逐级降级，不能直接作为节能承诺。",
      historyBenchmarkModeLoadBand: "负荷区间对标",
      historyBenchmarkStatusReady: "已匹配",
      historyBenchmarkStatusPartial: "部分匹配",
      historyBenchmarkStatusUnavailable: "样本不足",
      historyBenchmarkMatchingQualityTitle: "匹配质量",
      historyBenchmarkMatchingTier: "匹配层级",
      historyBenchmarkMatchingTierStrict: "负荷+湿球严格匹配",
      historyBenchmarkMatchingTierRelaxed: "负荷+湿球放宽匹配",
      historyBenchmarkMatchingTierLoadOnly: "仅负荷匹配",
      historyBenchmarkMatchingTierUnavailable: "暂无可用样本",
      historyBenchmarkFallbackLevel: "降级层级",
      historyBenchmarkRequestedWetBulb: "请求湿球",
      historyBenchmarkMatchedWetBulbBand: "匹配湿球区间",
      historyBenchmarkMatchedWetBulbBands: "覆盖湿球区间",
      historyBenchmarkWetBulbTolerance: "湿球容差",
      historyBenchmarkConfidence: "匹配置信度",
      historyBenchmarkConfidenceHigh: "高置信度",
      historyBenchmarkConfidenceMedium: "中置信度",
      historyBenchmarkConfidenceLow: "低置信度：样本少或匹配降级",
      historyBenchmarkMatchingQualityPending: "暂无匹配质量数据，请先补齐历史样本和湿球点位。",
      historyBenchmarkCapacity: "额定制冷量",
      historyBenchmarkRequestedLoadRate: "请求负荷率",
      historyBenchmarkMatchedBucket: "匹配负荷区间",
      historyBenchmarkSampleWindow: "样本月份",
      historyBenchmarkSampleCount: "样本数量",
      historyBenchmarkReferenceCop: "参考COP区间",
      historyBenchmarkCurrentGap: "当前偏差",
      historyBenchmarkWetBulbNote: "首期只做同负荷/相近湿球筛选，不直接执行控制。",
      historyBenchmarkPending: "历史对标样本不足，请先补齐同负荷和湿球区间数据。",
      historyBenchmarkLinkProportion: "查看能效分布",
      historyBenchmarkLinkCompare: "查看历史对比",
      benefitEstimateSubtitle: "收益为历史同工况估算，只用于影子验证前的工程判断，不作为固定节能承诺。",
      benefitEstimateStatusReady: "已估算",
      benefitEstimateStatusPartial: "部分估算",
      benefitEstimateStatusUnavailable: "无法估算",
      benefitOpportunityLow: "低节能机会",
      benefitOpportunityMedium: "中等节能机会",
      benefitOpportunityHigh: "高节能机会",
      benefitEstimateOpportunity: "节能机会",
      benefitEstimateConfidenceTitle: "置信度与依据",
      benefitEstimateConfidence: "收益置信度",
      benefitEstimateConfidenceHigh: "高置信度",
      benefitEstimateConfidenceMedium: "中置信度",
      benefitEstimateConfidenceLow: "低置信度：需影子验证",
      benefitEstimateBasis: "估算依据",
      benefitEstimateBasisSampleCount: "样本数量",
      benefitEstimateBasisMonthCount: "样本月份",
      benefitEstimateBasisTier: "匹配层级",
      benefitEstimateBasisFallbackLevel: "降级层级",
      benefitEstimateBasisEmpty: "暂无收益置信度依据，请先补齐样本数量、月份和匹配层级。",
      benefitEstimateTargetCop: "目标COP",
      benefitEstimateTargetPower: "目标总功率",
      benefitEstimatePowerDelta: "功率差值",
      benefitEstimateCopDelta: "COP差值",
      benefitEstimateDisclaimer: "历史对标收益为工程估算，不代表真实节能结果。",
      benefitEstimatePending: "暂无收益估算，请先补齐历史同工况样本。",
      towerApproachSubtitle: "冷却塔接近度只输出目标值建议，PLC负责限幅、防震荡、闭锁和回退。",
      towerApproachStatusReady: "建议可评审",
      towerApproachStatusPartial: "需人工复核",
      towerApproachStatusUnavailable: "信号不足",
      towerApproachCurrentApproach: "当前接近度",
      towerApproachTargetApproach: "目标接近度",
      towerApproachCurrentTcws: "当前冷却水出水温",
      towerApproachTargetTcws: "目标冷却水出水温",
      towerApproachTargetBand: "接近度目标区间",
      towerApproachControlMode: "控制模式",
      towerApproachControlModeManual: "人工审批后执行",
      towerApproachExecutionReady: "执行准备度",
      towerApproachExecutionReadyYes: "可创建影子审批单",
      towerApproachExecutionReadyNo: "仅允许审阅",
      towerApproachExecutionSupport: "AI只输出目标值，不直接控制塔风机频率。",
      towerApproachGuardrails: "PLC保护边界",
      towerApproachGuardrailStatusReady: "边界有效",
      towerApproachGuardrailStatusMissing: "边界缺失",
      towerApproachGuardrailStatusBlocked: "边界阻断",
      towerApproachNoGuardrails: "暂无PLC边界检查结果，请先补齐控制点映射。",
      towerApproachDisclaimerTitle: "执行边界说明",
      towerApproachPending: "等待生成接近度目标值；缺信号时只允许只读建议。",
      reviewReadinessTitle: "复核准备度",
      reviewReadinessStatusReady: "可复核",
      reviewReadinessStatusPartial: "需补数据",
      reviewReadinessStatusUnavailable: "未就绪",
      reviewReadinessSummaryReady: "当前建议可继续复核，下一步检查动作和历史对标。",
      reviewReadinessSummaryPartial: "当前建议可审阅，但仍需补齐关键数据后再创建影子审批单。",
      reviewReadinessSummaryUnavailable: "当前建议未就绪，缺少关键实时信号。",
      reviewReadinessScore: "准备度评分",
      reviewReadinessReason: "复核原因",
      reviewReadinessMissingSignals: "缺失信号",
      reviewReadinessNoMissingSignals: "未发现新增缺失信号。",
      reviewReadinessHints: "复核提示",
      reviewReadinessNoHints: "暂无额外复核提示。",
      reviewReadinessSupport: "评分越高，越适合进入审批；评分低时应先补点位或核对现态。",
      reviewReadinessPending: "暂无复核准备度数据。",
      schemeAnchoringTitle: "对标依据",
      schemeAnchoringHistory: "参考历史高效区间",
      schemeAnchoringFallback: "回退到当前现态估算",
      schemeAnchoringHistoryHint: "方案参考相近负荷与湿球区间的历史高效样本。",
      schemeAnchoringFallbackHint: "历史样本不足，当前仅按现态做保守估算。",
      estimateBadge: "工程估算",
      schemeStatus: "方案状态",
      schemeRisk: "风险等级",
      schemeFocus: "当前抓手",
      schemeTargetPower: "目标总功率",
      schemeTargetCop: "目标COP",
      schemePowerDelta: "功率差值",
      schemeCopDelta: "COP差值",
      schemeActions: "动作清单",
      schemeActionsEmpty: "暂无动作。",
      schemeDeviceActions: "设备级动作",
      schemeDeviceActionsEmpty: "暂无设备级建议。",
      schemeReadinessTitle: "方案准备度",
      schemeReadinessLevelReady: "可运行",
      schemeReadinessLevelCaution: "需确认",
      schemeReadinessLevelBlocked: "被阻断",
      schemeReadinessScore: "准备度评分",
      schemeReadinessReason: "复核原因",
      schemeReadinessBlockers: "阻塞项",
      schemeReadinessNoBlockers: "暂无硬阻塞。",
      schemeReadinessCheckpoints: "检查项",
      schemeReadinessNoCheckpoints: "暂无额外检查项。",
      schemeReadinessEmpty: "暂无方案准备度评分。",
      schemeReadinessPending: "等待后端生成准备度判断。",
      deviceActionSystem: "目标系统",
      deviceActionRisk: "风险等级",
      deviceActionPriority: "优先级",
      deviceActionTarget: "建议目标",
      deviceActionReason: "原因",
      deviceActionSystemSystem: "系统",
      deviceActionSystemChiller: "冷机",
      deviceActionSystemChilledPump: "冷冻泵",
      deviceActionSystemCoolingPump: "冷却泵",
      deviceActionSystemCoolingTower: "冷却塔",
      deviceActionSystemUnknown: "未知设备",
      deviceActionRiskLow: "低风险",
      deviceActionRiskMedium: "中风险",
      deviceActionRiskHigh: "高风险",
      deviceActionPriorityHigh: "高优先级",
      deviceActionPriorityMedium: "中优先级",
      deviceActionPriorityLow: "低优先级",
      deviceActionPreconditions: "前置条件",
      schemeStrategyTitle: "策略分类",
      schemeConservative: "保守方案",
      schemeBalanced: "均衡方案",
      schemeEfficiencyFirst: "效率优先方案",
      focusConservative: "先稳风险边界",
      focusBalanced: "兼顾能效与稳定",
      focusEfficiencyFirst: "优先挖掘节能空间",
      strategyRiskFirst: "风险优先",
      strategyChilledSide: "冷冻侧优先",
      strategyCoolingSide: "冷却侧优先",
      strategyCoordinated: "冷热侧协同",
      strategyRiskFirstHint: "先处理告警、保护和数据质量，再谈节能动作。",
      strategyChilledSideHint: "优先检查冷冻水温差、旁通和冷冻泵响应。",
      strategyCoolingSideHint: "优先检查室外湿球、冷却塔接近度和冷凝侧设点。",
      strategyCoordinatedHint: "冷热两侧一起复核，避免单侧优化拖低全站COP。",
      riskLow: "低风险",
      riskMedium: "中风险",
      riskHigh: "高风险",
      linkDevices: "看设备",
      linkTrends: "看趋势",
      linkScene: "看场景",
      linkUnavailable: "链接待映射",
      sectionExecutionHub: "影子验证治理",
      executionHubSubtitle: "执行单治理链路",
      executionHubPending: "生成AI建议后再创建影子记录。",
      executionStatusPendingApproval: "待审批",
      executionStatusApproved: "已批准",
      executionStatusRolledBack: "已回退",
      executionPendingCount: "待审批",
      executionLatestId: "历史执行单",
      executionLatestStatus: "历史状态",
      executionLatestUpdatedAt: "最近更新时间",
      executionLatestTarget: "历史目标",
      executionActionsTitle: "审批与回退",
      executionSubmitScheme: "主方案",
      executionSubmitTower: "接近度",
      executionApprove: "审批通过",
      executionRollback: "回退",
      executionRefresh: "刷新记录",
      executionLoading: "加载中...",
      executionSubmitting: "处理中...",
      executionApproveNoteDefault: "值班人员已审批",
      executionRollbackReasonDefault: "人工回退到安全边界",
      executionErrorFallback: "影子验证治理接口调用失败",
      executionForbiddenError: "只有平台管理员或本站管理员可以审批、写入影子记录或回退。",
      executionHistoryTitle: "执行审计记录",
      executionHistoryEmpty: "暂无执行记录。",
      executionHistoryApprovedAt: "审批时间",
      executionHistoryRolledBackAt: "回退时间",
      executionHistoryTimeline: "审计时间线",
      executionHistoryTimelineEmpty: "暂无审计动作。",
      executionActionCreated: "已创建",
      executionActionApproved: "已审批",
      executionActionRolledBack: "已回退",
      evidenceMatchedCount: "命中规则",
      evidenceSkippedCount: "跳过规则",
      evidenceMatchedRuleIds: "命中规则ID",
      evidenceNoMatchedRuleIds: "暂无命中规则ID。",
      evidencePrimaryCards: "主要建议卡",
      evidenceSkippedRules: "跳过规则明细",
      evidenceNoPrimaryCards: "暂无主要建议卡。",
      evidenceNoSkippedRules: "暂无跳过规则。",
      evidenceMissingMetrics: "缺失指标",
      evidenceRuleReason: "跳过原因",
      diagnosticsEmpty: "暂无诊断信息。",
      stepsEmpty: "暂无AI解释步骤，请先生成建议。",
      generatedAtPending: "暂无生成时间",
      gateLevel: "优化门禁",
      gateReason: "当前判断",
      gateReady: "可复核",
      gateCaution: "谨慎复核",
      gateBlocked: "禁止推进",
      gateUnknown: "等待判断",
      gateReasonPending: "请先生成AI建议，再判断是否可创建影子记录。",
      baselineCop: "当前COP",
      baselinePower: "当前总功率",
      baselineChilledDelta: "冷冻水温差",
      baselineCoolingDelta: "冷却水温差",
      baselineChillerPower: "冷机功率",
      baselineActiveAlarms: "当前告警数",
      baselineSupplementTitle: "基线细节",
      baselinePumpPower: "冷冻泵功率",
      baselineCoolingPumpPower: "冷却泵功率",
      baselineTowerPower: "冷却塔功率",
      baselineChilledSupplyTemp: "冷冻水供水温",
      baselineCoolingReturnTemp: "冷却水回水温",
      baselineThermalUnbalanceRate: "冷热量不平衡率",
      baselinePowerSplitTitle: "分系统功率拆分",
      baselinePowerSplitEmpty: "暂无分系统功率拆分数据。"
    };
    if (exactMap[key]) {
      return exactMap[key];
    }
    const translated = replaceAll(original, [
      ["Optimize Demo", "AI优化建议与影子验证"],
      ["Optimize", "优化"],
      ["Demo", "演示"],
      ["Draft", "草案"],
      ["Current", "当前"],
      ["History", "历史"],
      ["Benchmark", "对标"],
      ["Review", "复核"],
      ["Window", "窗口"],
      ["Status", "状态"],
      ["Pending", "待处理"],
      ["Ready", "就绪"],
      ["Approved", "已批准"],
      ["Scheme", "方案"],
      ["Comparison", "对比"],
      ["Evidence", "证据"],
      ["Rule", "规则"],
      ["Inputs", "输入参数"],
      ["Input", "输入"],
      ["Mode", "模式"],
      ["Loading", "加载中"],
      ["Submit", "提交"],
      ["Refresh", "刷新"],
      ["Score", "评分"],
      ["Reason", "原因"],
      ["Summary", "摘要"],
      ["Confidence", "置信度"],
      ["Target", "目标"],
      ["Power", "功率"],
      ["Delta", "差值"],
      ["Benefit", "收益"],
      ["Opportunity", "机会"],
      ["Action", "动作"],
      ["Actions", "动作"],
      ["Unknown Error", "未知错误"],
      ["Unknown", "未知"],
      ["Unavailable", "不可用"]
    ]);
    if (/[A-Za-z]{4,}/.test(translated)) {
      return toChineseFallbackByKey(key);
    }
    return translated;
  }

  const viExactMap: Record<string, string> = {
    heading: "Demo tối ưu",
    sectionInputs: "Tham số đầu vào",
    sectionWindow: "Cửa sổ đánh giá",
    sectionBaseline: "Đường cơ sở hiện tại",
    sectionHistoryBenchmark: "Đối chuẩn lịch sử",
    sectionBenefitEstimate: "Ước tính lợi ích",
    sectionTowerApproach: "Kiểm tra approach trước thực thi",
    sectionReadiness: "Mức sẵn sàng đánh giá",
    sectionSchemes: "So sánh phương án",
    sectionEvidence: "Bằng chứng quy tắc",
    sectionResponse: "Mô tả kết quả",
    submit: "Gửi đề xuất",
    submitLoading: "Đang gửi...",
    pendingValue: "Đang cập nhật",
    pendingHint: "Đang chờ yêu cầu",
    requestAccepted: "Đã nhận",
    requestPending: "Chờ gửi"
  };
  if (viExactMap[key]) {
    return viExactMap[key];
  }
  const viTranslated = replaceAll(original, [
    ["Optimize Demo", "Demo tối ưu"],
    ["Optimize", "Tối ưu"],
    ["Demo", "Trình diễn"],
    ["Draft", "Bản nháp"],
    ["Current", "Hiện tại"],
    ["History", "Lịch sử"],
    ["Benchmark", "Đối chuẩn"],
    ["Review", "Đánh giá"],
    ["Window", "Cửa sổ"],
    ["Status", "Trạng thái"],
    ["Pending", "Đang chờ"],
    ["Ready", "Sẵn sàng"],
    ["Scheme", "Phương án"],
    ["Comparison", "So sánh"],
    ["Evidence", "Bằng chứng"],
    ["Rule", "Quy tắc"],
    ["Inputs", "Đầu vào"],
    ["Input", "Đầu vào"],
    ["Mode", "Chế độ"],
    ["Loading", "Đang tải"],
    ["Submit", "Gửi"],
    ["Refresh", "Làm mới"],
    ["Score", "Điểm"],
    ["Reason", "Lý do"],
    ["Summary", "Tóm tắt"],
    ["Confidence", "Độ tin cậy"],
    ["Target", "Mục tiêu"],
    ["Power", "Công suất"],
    ["Delta", "Chênh lệch"],
    ["Benefit", "Lợi ích"],
    ["Opportunity", "Cơ hội"],
    ["Action", "Hành động"],
    ["Unknown Error", "Lỗi chưa xác định"],
    ["Unknown", "Không xác định"],
    ["Unavailable", "Không khả dụng"]
  ]);
  if (/[A-Za-z]{4,}/.test(viTranslated)) {
    return toVietnameseFallbackByKey(key);
  }
  return viTranslated;
}

function ensureOptimizeDemoLocaleText(): void {
  const locale = getOptimizeLocale();
  if (locale === "en-US") {
    return;
  }
  const copy = zhCN.optimizeDemo as Record<string, unknown>;
  Object.keys(copy).forEach((key) => {
    const value = copy[key];
    if (typeof value === "string") {
      copy[key] = translateEnglishUiText(locale, key, value);
    }
  });
}

function localeText(zh: string, en: string, vi: string): string {
  const locale = getOptimizeLocale();
  if (locale === "en-US") {
    return en;
  }
  if (locale === "vi-VN") {
    return vi;
  }
  return zh;
}

function preferLocaleValue(raw: string | null | undefined, localizedFallback: string): string {
  const locale = getOptimizeLocale();
  const normalized = String(raw || "").trim();
  if (!normalized) {
    return localizedFallback;
  }
  if (locale === "en-US") {
    return normalized;
  }
  const looksEnglishOrCode = /^[A-Za-z0-9_./:\- +()]+$/.test(normalized);
  return looksEnglishOrCode ? localizedFallback : normalized;
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

function parseOptionalFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function formatInputValue(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

const OPTIMIZE_NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

function getOptimizeNumberFormatter(digits: number): Intl.NumberFormat {
  const normalizedDigits = Math.max(0, Math.min(6, Math.trunc(Number.isFinite(digits) ? digits : 0)));
  let formatter = OPTIMIZE_NUMBER_FORMATTERS.get(normalizedDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: normalizedDigits,
      maximumFractionDigits: normalizedDigits
    });
    OPTIMIZE_NUMBER_FORMATTERS.set(normalizedDigits, formatter);
  }
  return formatter;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return getOptimizeNumberFormatter(digits).format(value);
}

function localizeFormalInputStatus(status: string | null | undefined): string {
  switch (String(status || "").trim()) {
    case "present_with_rows":
      return "已投放";
    case "present_header_only":
      return "仅表头";
    case "missing":
      return "未投放";
    default:
      return "待确认";
  }
}

function formatTemperature(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return `${formatNumber(value, 1)} °C`;
}

function formatCompactNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return OPTIMIZE_COMPACT_PENDING_VALUE;
  }
  return formatNumber(value, digits);
}

function formatCompactTemperature(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return OPTIMIZE_COMPACT_PENDING_VALUE;
  }
  return `${formatNumber(value, 1)} °C`;
}

function formatCompactPowerKw(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return OPTIMIZE_COMPACT_PENDING_VALUE;
  }
  return `${formatNumber(value, digits)} kW`;
}

function formatFlexiblePercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const percent = Math.abs(value) > 1.5 ? value : value * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${getOptimizeNumberFormatter(2).format(percent)}%`;
}

function normalizeActionTone(tone: string): "neutral" | "good" | "warn" {
  if (tone === "good") {
    return "good";
  }
  if (tone === "neutral") {
    return "neutral";
  }
  return "warn";
}

function formatDelta(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${getOptimizeNumberFormatter(2).format(value)}`;
}

function asExtendedDetails(details: OptimizeDraftDetailsDto | null): ExtendedOptimizeDraftDetails | null {
  if (!details) {
    return null;
  }
  return details as ExtendedOptimizeDraftDetails;
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

function mapReviewReadinessTone(status: string | undefined): "good" | "warn" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial") {
    return "warn";
  }
  return "neutral";
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

function localizeChillerStagingStatus(status: string | undefined): string {
  if (status === "ready") {
    return "组合建议可评审";
  }
  if (status === "partial") {
    return "样本/边界待补齐";
  }
  if (status === "unavailable") {
    return "组合信号不足";
  }
  return "组合信号不足";
}

function localizeChillerStagingAction(action: string | undefined): string {
  if (action === "switch_combination") {
    return "切换组合";
  }
  if (action === "add_one") {
    return "增加主机";
  }
  if (action === "remove_one") {
    return "减少主机";
  }
  if (action === "rebalance") {
    return "负荷重分配";
  }
  if (action === "keep") {
    return "保持当前";
  }
  return preferLocaleValue(action, "保持当前");
}

function localizeChillerStagingMatchTier(value: string | undefined): string {
  if (value === "same_load_wet_bulb_chws_band") {
    return "同负荷/湿球/供水温区间";
  }
  if (value === "same_combination_fallback") {
    return "同组合历史兜底";
  }
  if (value === "no_sample") {
    return "暂无可用样本";
  }
  return preferLocaleValue(value, zhCN.optimizeDemo.pendingValue);
}

function localizeHistoryBenchmarkMatchingTier(value: string | undefined): string {
  if (value === "load-wetbulb-strict") {
    return "负荷+湿球严格匹配";
  }
  if (value === "load-wetbulb-relaxed") {
    return "负荷+湿球放宽匹配";
  }
  if (value === "load-only-fallback") {
    return "仅负荷匹配";
  }
  if (value === "unavailable") {
    return "暂无可用样本";
  }
  return preferLocaleValue(value, zhCN.optimizeDemo.pendingValue);
}

function localizeChillerStagingSampleRole(value: string | undefined): string {
  if (value === "single_chiller_learning_window") {
    return "单机学习窗口";
  }
  if (value === "combination_learning_window") {
    return "组合学习窗口";
  }
  return preferLocaleValue(value, "组合学习窗口");
}

function localizeChillerSampleGovernanceStatus(value: string | undefined): string {
  if (value === "comparison_candidate_available") {
    return "可进入组合对比";
  }
  if (value === "baseline_high_confidence_only") {
    return "仅基线高置信";
  }
  if (value === "baseline_ready_only") {
    return "基线样本可用";
  }
  if (value === "collection_started") {
    return "采样中";
  }
  if (value === "no_samples") {
    return "无样本";
  }
  return preferLocaleValue(value, "采样待确认");
}

function mapChillerSampleGovernanceTone(value: string | undefined): "neutral" | "good" | "warn" {
  if (value === "comparison_candidate_available") {
    return "good";
  }
  if (value === "baseline_high_confidence_only" || value === "baseline_ready_only" || value === "collection_started") {
    return "warn";
  }
  return "neutral";
}

function localizeShadowVerificationMethod(value: string | undefined): string {
  if (value === "shadow_compare_30_60min_same_load_wet_bulb_band") {
    return "30-60min 同负荷/湿球 band 对比";
  }
  if (value === "same_load_wet_bulb_chws_band") {
    return "同负荷/湿球/供水温 band 对比";
  }
  return preferLocaleValue(value, "30-60min 同负荷/湿球 band 对比");
}

function localizeShadowVerificationMetric(value: string): string {
  if (value === "stationCop") {
    return "冷站COP";
  }
  if (value === "comboCop") {
    return "组合COP";
  }
  if (value === "kwPerRt") {
    return "kW/RT";
  }
  if (value === "stationPowerTotalKw") {
    return "冷站总功率";
  }
  if (value === "chillerPowerTotalKw") {
    return "主机总功率";
  }
  if (value === "alarmCount") {
    return "告警数";
  }
  return preferLocaleValue(value, value);
}

function localizeChillerSampleCaptureStatus(status: string | undefined, liveStatus: string | undefined): string {
  if (status === "recorded") {
    return "已入库";
  }
  if (status === "skipped_recent") {
    return "节流跳过";
  }
  if (status === "skipped") {
    return "未入库";
  }
  if (status === "failed") {
    return "入库失败";
  }
  if (liveStatus === "recordable") {
    return "可记录";
  }
  return "待补信号";
}

function localizeOperationalDiagnosticStatus(status: string | undefined): string {
  if (status === "ready") {
    return "诊断可用";
  }
  if (status === "partial") {
    return "仅审阅";
  }
  if (status === "unavailable") {
    return "信号不足";
  }
  return "信号不足";
}

function localizeOperationalDiagnosticMode(mode: string | undefined): string {
  if (mode === "read_only") {
    return "只读诊断";
  }
  return preferLocaleValue(mode, "只读诊断");
}

function formatOperationalEvidenceValue(item: DraftOperationalDiagnosticEvidence | undefined): string {
  const value = item?.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const unit = typeof item?.unit === "string" && item.unit.trim() ? ` ${item.unit}` : "";
    return `${formatNumber(value, Math.abs(value) >= 100 ? 0 : 1)}${unit}`;
  }
  if (typeof value === "string" && value.trim()) {
    return preferLocaleValue(value, zhCN.optimizeDemo.pendingValue);
  }
  return zhCN.optimizeDemo.pendingValue;
}

function formatInstrumentReviewValue(value: number | string | null | undefined, unit?: string | null): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalizedUnit = typeof unit === "string" && unit.trim() ? ` ${unit.trim()}` : "";
    return `${formatNumber(value, Math.abs(value) >= 100 ? 0 : 1)}${normalizedUnit}`;
  }
  if (typeof value === "string" && value.trim()) {
    return preferLocaleValue(value, zhCN.optimizeDemo.pendingValue);
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeInstrumentReviewStatus(status: string | undefined): string {
  if (status === "review") {
    return "待复核";
  }
  if (status === "normal") {
    return "未触发";
  }
  if (status === "insufficient") {
    return "证据不足";
  }
  return preferLocaleValue(status, "证据不足");
}

function mapInstrumentReviewTone(
  status: string | undefined,
  severity?: string | undefined
): "good" | "warn" | "danger" | "neutral" {
  if (status === "review") {
    return severity === "high" ? "danger" : "warn";
  }
  if (status === "normal") {
    return "good";
  }
  if (status === "insufficient") {
    return "neutral";
  }
  return "neutral";
}

function localizeHydraulicRiskStatus(status: string | undefined): string {
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
  if (status === "unknown") {
    return "证据不足";
  }
  return preferLocaleValue(status, "证据不足");
}

function mapHydraulicRiskTone(
  status: string | undefined,
  severity?: string | undefined
): "good" | "warn" | "danger" | "neutral" {
  if (status === "active") {
    return severity === "high" ? "danger" : "warn";
  }
  if (status === "gap") {
    return "warn";
  }
  if (status === "watch" || status === "unknown") {
    return "neutral";
  }
  if (status === "normal") {
    return "good";
  }
  return "neutral";
}

function localizeControlOscillationRiskStatus(status: string | undefined): string {
  return localizeHydraulicRiskStatus(status);
}

function mapControlOscillationRiskTone(
  status: string | undefined,
  severity?: string | undefined
): "good" | "warn" | "danger" | "neutral" {
  return mapHydraulicRiskTone(status, severity);
}

function localizeControlLedgerEvidenceStatus(status: string | undefined): string {
  if (status === "ready") {
    return "台账 READY";
  }
  if (status === "partial") {
    return "台账 PARTIAL";
  }
  if (status === "blocked") {
    return "台账 BLOCKED";
  }
  if (status === "unavailable") {
    return "未接入";
  }
  return preferLocaleValue(status, "未接入");
}

function mapControlLedgerEvidenceTone(status: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial") {
    return "warn";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "neutral";
}

function localizeFieldDataPreflightStatus(status: string | undefined): string {
  if (status === "ready") {
    return "预检 READY";
  }
  if (status === "partial") {
    return "预检 PARTIAL";
  }
  if (status === "waiting") {
    return "等待 CSV";
  }
  if (status === "blocked") {
    return "预检 BLOCKED";
  }
  return "未接入";
}

function mapFieldDataPreflightTone(status: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial" || status === "waiting") {
    return "warn";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "neutral";
}

function localizeFieldDataPromoteStatus(status: string | undefined): string {
  if (status === "ready") {
    return "导入 READY";
  }
  if (status === "partial") {
    return "导入 PARTIAL";
  }
  if (status === "waiting") {
    return "等待预检";
  }
  if (status === "blocked") {
    return "导入 BLOCKED";
  }
  return "未接入";
}

function mapFieldDataPromoteTone(status: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (status === "ready") {
    return "good";
  }
  if (status === "partial" || status === "waiting") {
    return "warn";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "neutral";
}

function summarizeOperationalDiagnosticItem(item: DraftOperationalDiagnosticItem): string {
  const blockers = Array.isArray(item.blockers) ? item.blockers : [];
  const warnings = Array.isArray(item.warnings) ? item.warnings : [];
  const findings = Array.isArray(item.findings) ? item.findings : [];
  return preferLocaleValue(blockers[0] || warnings[0] || findings[0], "等待诊断证据。");
}

function localizeDiagnosticReadinessFeasibility(value: string | undefined): string {
  if (value === "can_do_v1") {
    return "可做 V1";
  }
  if (value === "directional_review") {
    return "只能疑似判断";
  }
  if (value === "point_gap") {
    return "暂不能做";
  }
  return preferLocaleValue(value, "待评估");
}

function mapDiagnosticReadinessFeasibilityTone(value: string | undefined): "good" | "warn" | "danger" | "neutral" {
  if (value === "can_do_v1") {
    return "good";
  }
  if (value === "directional_review") {
    return "warn";
  }
  if (value === "point_gap") {
    return "danger";
  }
  return "neutral";
}

function localizeDiagnosticAllowedMode(value: string | undefined): string {
  if (value === "read_only") {
    return "只读诊断";
  }
  if (value === "shadow_review") {
    return "shadow审阅";
  }
  if (value === "point_plan") {
    return "补点计划";
  }
  return preferLocaleValue(value, "只读诊断");
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

function localizeExecutionStatus(status: string | undefined): string {
  if (status === "pending_approval") {
    return zhCN.optimizeDemo.executionStatusPendingApproval;
  }
  if (status === "approved") {
    return zhCN.optimizeDemo.executionStatusApproved;
  }
  if (status === "rolled_back") {
    return zhCN.optimizeDemo.executionStatusRolledBack;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function localizeExecutionType(type: string | undefined): string {
  if (type === "tower-approach") {
    return zhCN.optimizeDemo.executionSubmitTower;
  }
  if (type === "pump-delta-t") {
    return "泵温差降频";
  }
  if (type === "scheme") {
    return zhCN.optimizeDemo.executionSubmitScheme;
  }
  return preferLocaleValue(type, zhCN.optimizeDemo.pendingValue);
}

function localizeShadowVerificationType(type: string | undefined): string {
  if (type === "chiller-staging") {
    return "主机组合";
  }
  if (type === "tower-approach") {
    return "冷却塔";
  }
  if (type === "pump-delta-t") {
    return "泵 Delta-T";
  }
  if (type === "all") {
    return "全部";
  }
  return preferLocaleValue(type, "未知类型");
}

function compactShadowExecutionId(executionId: string | undefined): string {
  const normalized = typeof executionId === "string" ? executionId.trim() : "";
  if (!normalized) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (normalized.length <= 18) {
    return normalized;
  }
  return `...${normalized.slice(-12)}`;
}

function localizeExecutionTimelineAction(action: string | undefined): string {
  if (action === "created") {
    return zhCN.optimizeDemo.executionActionCreated;
  }
  if (action === "approved") {
    return zhCN.optimizeDemo.executionActionApproved;
  }
  if (action === "rolled_back") {
    return zhCN.optimizeDemo.executionActionRolledBack;
  }
  return preferLocaleValue(action, zhCN.optimizeDemo.pendingValue);
}

function localizeExecutionMetaLabel(label: string | undefined): string {
  const locale = getOptimizeLocale();
  if (label === "equipmentContext") {
    if (locale === "en-US") {
      return "Equipment Context";
    }
    if (locale === "vi-VN") {
      return "Ngu canh thiet bi";
    }
    return "设备上下文";
  }
  if (label === "guardrailSnapshot") {
    if (locale === "en-US") {
      return "Guardrail Snapshot";
    }
    if (locale === "vi-VN") {
      return "Anh chup gioi han";
    }
    return "边界快照";
  }
  if (label === "rollbackTarget") {
    if (locale === "en-US") {
      return "Rollback Target";
    }
    if (locale === "vi-VN") {
      return "Muc tieu hoan tac";
    }
    return "回退目标";
  }
  return preferLocaleValue(label, zhCN.optimizeDemo.pendingValue);
}

function formatExecutionTargetSummary(record: OptimizeExecutionRecordDto | undefined): string {
  if (!record) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (record.execution?.type === "tower-approach") {
    return `${formatTemperature(record.execution?.targetApproachC)} / ${formatTemperature(record.execution?.targetTcwsC)}`;
  }
  if (record.execution?.type === "pump-delta-t") {
    return `冷冻泵修正 ${formatTrimHz(record.execution?.targetChwpFreqTrimHz)} / 冷却泵修正 ${formatTrimHz(
      record.execution?.targetCwpFreqTrimHz
    )}`;
  }
  return `${formatNumber(record.execution?.targetCop, 2)} COP / ${formatNumber(record.execution?.targetPowerKw)} kW`;
}

function formatTrimHz(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} Hz`;
}

function formatTrimHzCompactValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)}`;
}

function formatPumpTrimWindow(advisor: DraftPumpDeltaTAdvisor | undefined): string {
  const ttlSeconds = advisor?.outputTargets?.ttlSeconds ?? advisor?.targetPoints?.ttlSeconds ?? 300;
  const trimMinHz = advisor?.outputTargets?.trimRangeHz?.min ?? advisor?.targetPoints?.trimRangeHz?.min ?? -5;
  const trimMaxHz = advisor?.outputTargets?.trimRangeHz?.max ?? advisor?.targetPoints?.trimRangeHz?.max ?? 3;
  return `${formatNumber(ttlSeconds, 0)}s · ${formatTrimHz(trimMinHz)}~${formatTrimHz(trimMaxHz)}`;
}

function formatPumpRollbackLockout(advisor: DraftPumpDeltaTAdvisor | undefined): string {
  const rollbackLockoutMinutes = advisor?.outputTargets?.rollbackLockoutMinutes ?? 15;
  return `${formatNumber(rollbackLockoutMinutes, 0)}min`;
}

function formatChillerCombination(value: string[] | undefined): string {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return items.length ? items.join(" + ") : zhCN.optimizeDemo.pendingValue;
}

function formatKwDelta(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)} kW`;
}

function formatDirectPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.optimizeDemo.pendingValue;
  }
  return `${formatNumber(value, 1)}%`;
}

function formatMinuteRange(range: { min?: number | null; max?: number | null } | undefined): string {
  const min = range?.min;
  const max = range?.max;
  if (typeof min === "number" && Number.isFinite(min) && typeof max === "number" && Number.isFinite(max)) {
    return `${formatNumber(min, 0)}-${formatNumber(max, 0)} min`;
  }
  if (typeof min === "number" && Number.isFinite(min)) {
    return `${formatNumber(min, 0)} min`;
  }
  return zhCN.optimizeDemo.pendingValue;
}

function findTowerApproachMinGuardrail(
  advisor: DraftTowerApproachAdvisor | undefined
): DraftTowerApproachGuardrail | undefined {
  return advisor?.guardrails?.find((item) => item.key === "chillerMinCondenserInletTempC");
}

function deriveEquipmentContextFromAdvisor(advisor: DraftTowerApproachAdvisor | undefined): {
  activeChillerIds?: string[];
  activeChillerModels?: string[];
} {
  const minGuardrail = findTowerApproachMinGuardrail(advisor);
  const matchedKeys = Array.isArray(minGuardrail?.matchedKeys)
    ? minGuardrail.matchedKeys.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (minGuardrail?.resolvedBy === "by-chiller" && matchedKeys.length > 0) {
    return {
      activeChillerIds: matchedKeys
    };
  }
  if (minGuardrail?.resolvedBy === "by-model" && matchedKeys.length > 0) {
    return {
      activeChillerModels: matchedKeys
    };
  }
  return {};
}

function buildTowerApproachExecutionActions(advisor: DraftTowerApproachAdvisor | undefined): string[] {
  if (!advisor) {
    return [];
  }
  const actions: string[] = [];
  if (typeof advisor.targetApproachC === "number") {
    actions.push(`目标接近度 ${formatNumber(advisor.targetApproachC, 1)} °C`);
  }
  if (typeof advisor.targetTcwsC === "number") {
    actions.push(`目标冷却供水温 ${formatNumber(advisor.targetTcwsC, 1)} °C`);
  }
  const multiStepPlan = advisor.outputTargets?.multiStepPlan;
  if (multiStepPlan?.required === true && typeof multiStepPlan.stepCount === "number" && multiStepPlan.stepCount > 1) {
    actions.push(
      `多步 shadow 第 1/${formatNumber(multiStepPlan.stepCount, 0)} 步，最终目标 ${formatTemperature(
        multiStepPlan.finalTargetTcwsC
      )}`
    );
  }
  const minGuardrail = findTowerApproachMinGuardrail(advisor);
  if (typeof minGuardrail?.value === "number") {
    const resolvedBy =
      minGuardrail.resolvedBy === "by-chiller"
        ? "按机组实例"
        : minGuardrail.resolvedBy === "by-model"
          ? "按机组型号"
          : "按站点默认值";
    const matchedKeys =
      Array.isArray(minGuardrail.matchedKeys) && minGuardrail.matchedKeys.length
        ? ` (${minGuardrail.matchedKeys.join(", ")})`
        : "";
    actions.push(`最低冷凝器进水温约束 ${formatNumber(minGuardrail.value, 1)} °C，${resolvedBy}${matchedKeys}`);
  }
  if (advisor.reason) {
    actions.push(preferLocaleValue(advisor.reason, zhCN.optimizeDemo.pendingValue));
  }
  return Array.from(new Set(actions.filter((item) => item.trim().length > 0)));
}

function buildPumpDeltaTExecutionActions(advisor: DraftPumpDeltaTAdvisor | undefined): string[] {
  if (!advisor) {
    return [];
  }
  const actions: string[] = [];
  const chwpTrim = advisor.outputTargets?.chilledPumpFreqTrimHz;
  const cwpTrim = advisor.outputTargets?.coolingPumpFreqTrimHz;
  if (typeof chwpTrim === "number") {
    actions.push(`冷冻泵频率修正 ${formatTrimHz(chwpTrim)}`);
  }
  if (typeof cwpTrim === "number") {
    actions.push(`冷却泵频率修正 ${formatTrimHz(cwpTrim)}`);
  }
  if (typeof advisor.outputTargets?.maxStepHz === "number") {
    actions.push(`单步限幅 ${formatTrimHz(advisor.outputTargets.maxStepHz)}/周期`);
  }
  if (typeof advisor.outputTargets?.holdMinutes === "number") {
    actions.push(`控制周期 ${formatNumber(advisor.outputTargets.holdMinutes, 0)} 分钟`);
  }
  if (typeof advisor.outputTargets?.rollbackLockoutMinutes === "number") {
    actions.push(`回退后闭锁 ${formatNumber(advisor.outputTargets.rollbackLockoutMinutes, 0)} 分钟`);
  }
  if (advisor.reason) {
    actions.push(preferLocaleValue(advisor.reason, zhCN.optimizeDemo.pendingValue));
  }
  return Array.from(new Set(actions.filter((item) => item.trim().length > 0)));
}

function formatExecutionActions(actions: string[] | undefined): string {
  const items = Array.isArray(actions)
    ? actions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return items.length > 0 ? items.join("；") : zhCN.optimizeDemo.pendingValue;
}

function formatExecutionEquipmentContext(record: OptimizeExecutionRecordDto | undefined): string {
  const activeChillerIds = record?.execution?.equipmentContext?.activeChillerIds || [];
  const activeChillerModels = record?.execution?.equipmentContext?.activeChillerModels || [];
  const parts: string[] = [];
  const locale = getOptimizeLocale();
  const chillerPrefix = locale === "en-US" ? "chiller" : locale === "vi-VN" ? "chiller" : "冷机";
  const modelPrefix = locale === "en-US" ? "model" : locale === "vi-VN" ? "mo hinh" : "模型";
  if (activeChillerIds.length > 0) {
    parts.push(`${chillerPrefix} ${activeChillerIds.join(", ")}`);
  }
  if (activeChillerModels.length > 0) {
    parts.push(`${modelPrefix} ${activeChillerModels.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" / ") : zhCN.optimizeDemo.pendingValue;
}

function formatExecutionGuardrailSnapshot(record: OptimizeExecutionRecordDto | undefined): string {
  const snapshot = record?.execution?.guardrailSnapshot;
  if (!snapshot) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const guardrailLabel =
    snapshot.key === "chillerMinCondenserInletTempC"
      ? "最低冷凝器进水温"
      : preferLocaleValue(snapshot.key, zhCN.optimizeDemo.pendingValue);
  const value =
    snapshot.value == null
      ? zhCN.optimizeDemo.pendingValue
      : typeof snapshot.value === "number"
        ? `${formatNumber(snapshot.value, 1)} °C`
        : String(snapshot.value);
  const resolvedBy =
    snapshot.resolvedBy === "by-chiller"
      ? "按机组实例"
      : snapshot.resolvedBy === "by-model"
        ? "按机组型号"
        : snapshot.resolvedBy === "default"
          ? "站点默认"
          : preferLocaleValue(snapshot.resolvedBy, zhCN.optimizeDemo.pendingValue);
  const matchedKeys =
    Array.isArray(snapshot.matchedKeys) && snapshot.matchedKeys.length > 0
      ? ` (${snapshot.matchedKeys.join(", ")})`
      : "";
  return `${guardrailLabel} / ${value} / ${resolvedBy}${matchedKeys}`;
}

function formatExecutionRollbackTarget(record: OptimizeExecutionRecordDto | undefined): string {
  const rollbackTarget = record?.execution?.rollbackTarget;
  if (!rollbackTarget) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const parts: string[] = [];
  if (rollbackTarget.mode) {
    parts.push(preferLocaleValue(rollbackTarget.mode, zhCN.optimizeDemo.pendingValue));
  }
  if (typeof rollbackTarget.targetTcwsC === "number") {
    parts.push(`Tcws ${formatNumber(rollbackTarget.targetTcwsC, 1)} °C`);
  }
  if (typeof rollbackTarget.targetApproachC === "number") {
    const locale = getOptimizeLocale();
    parts.push(`${locale === "en-US" ? "Approach" : locale === "vi-VN" ? "Approach" : "接近度"} ${formatNumber(rollbackTarget.targetApproachC, 1)} °C`);
  }
  if (typeof rollbackTarget.targetChwpFreqTrimHz === "number") {
    parts.push(`冷冻泵修正 ${formatTrimHz(rollbackTarget.targetChwpFreqTrimHz)}`);
  }
  if (typeof rollbackTarget.targetCwpFreqTrimHz === "number") {
    parts.push(`冷却泵修正 ${formatTrimHz(rollbackTarget.targetCwpFreqTrimHz)}`);
  }
  if (rollbackTarget.reason) {
    parts.push(preferLocaleValue(rollbackTarget.reason, zhCN.optimizeDemo.pendingValue));
  }
  return parts.length > 0 ? parts.join(" / ") : zhCN.optimizeDemo.pendingValue;
}

function renderExecutionHistoryItems(records: OptimizeExecutionRecordDto[]) {
  if (!records.length) {
    return <p>{zhCN.optimizeDemo.executionHistoryEmpty}</p>;
  }

  return (
    <div className="optimize-execution-history">
      {records.map((record) => (
        <details
          key={record.executionId || `${record.updatedAt || "execution"}-${record.status || "unknown"}`}
          className="optimize-execution-history-item"
        >
          <summary className="optimize-execution-history-summary">
            <span>{record.executionId || zhCN.optimizeDemo.pendingValue}</span>
            <span>{localizeExecutionStatus(record.status)}</span>
            <span>{record.updatedAt || zhCN.optimizeDemo.pendingValue}</span>
          </summary>
          <div className="optimize-execution-history-body">
            <div className="optimize-execution-history-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.summaryStatus}</span>
                <strong>{localizeExecutionType(record.execution?.type)}</strong>
                <small>{preferLocaleValue(record.execution?.title, zhCN.optimizeDemo.pendingValue)}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionLatestTarget}</span>
                <strong>{formatExecutionTargetSummary(record)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionHistoryApprovedAt}</span>
                <strong>{record.approvedAt || zhCN.optimizeDemo.pendingValue}</strong>
                <small>{record.approvedBy || zhCN.optimizeDemo.pendingValue}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionHistoryRolledBackAt}</span>
                <strong>{record.rolledBackAt || zhCN.optimizeDemo.pendingValue}</strong>
                <small>{record.rolledBackBy || zhCN.optimizeDemo.pendingValue}</small>
              </article>
            </div>

            {record.execution?.type === "tower-approach" ? (
              <div className="optimize-execution-history-grid">
                <article className="optimize-response-card">
                  <span>{localizeExecutionMetaLabel("equipmentContext")}</span>
                  <strong>{formatExecutionEquipmentContext(record)}</strong>
                </article>
                <article className="optimize-response-card">
                  <span>{localizeExecutionMetaLabel("guardrailSnapshot")}</span>
                  <strong>{formatExecutionGuardrailSnapshot(record)}</strong>
                </article>
                <article className="optimize-response-card">
                  <span>{localizeExecutionMetaLabel("rollbackTarget")}</span>
                  <strong>{formatExecutionRollbackTarget(record)}</strong>
                </article>
              </div>
            ) : null}

            {record.execution?.type === "pump-delta-t" ? (
              <div className="optimize-execution-history-grid">
                <article className="optimize-response-card">
                  <span>AI目标点</span>
                  <strong>冷冻泵频率修正 / 冷却泵频率修正</strong>
                  <small>{`TTL ${formatNumber(record.execution?.ttlSeconds, 0)} s`}</small>
                </article>
                <article className="optimize-response-card">
                  <span>保持与回退闭锁</span>
                  <strong>{`${formatNumber(record.execution?.holdMinutes, 0)} min / ${formatNumber(record.execution?.rollbackLockoutMinutes, 0)} min`}</strong>
                </article>
                <article className="optimize-response-card">
                  <span>{localizeExecutionMetaLabel("rollbackTarget")}</span>
                  <strong>{formatExecutionRollbackTarget(record)}</strong>
                </article>
              </div>
            ) : null}

            <div className="optimize-execution-timeline">
              <span>{zhCN.optimizeDemo.gateReason}</span>
              <p>{preferLocaleValue(record.execution?.reason, zhCN.optimizeDemo.pendingValue)}</p>
            </div>

            <div className="optimize-execution-timeline">
              <span>{zhCN.optimizeDemo.executionActionsTitle}</span>
              <p>{formatExecutionActions(record.execution?.actions)}</p>
            </div>

            <div className="optimize-execution-timeline">
              <span>{zhCN.optimizeDemo.executionHistoryTimeline}</span>
              {record.timeline?.length ? (
                <ul>
                  {record.timeline.map((entry, index) => (
                    <li key={`${entry.at || "timeline"}-${entry.action || "action"}-${index + 1}`}>
                      <strong>{localizeExecutionTimelineAction(entry.action)}</strong>
                      <span>{entry.at || zhCN.optimizeDemo.pendingValue}</span>
                      <small>{entry.actorUserId || zhCN.optimizeDemo.pendingValue}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{zhCN.optimizeDemo.executionHistoryTimelineEmpty}</p>
              )}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function extractBffErrorMessage(error: unknown): string {
  const payload = (error as { payload?: { error?: string; code?: string } })?.payload;
  const status = (error as { status?: number })?.status;
  if (payload?.code === "ADMIN_FORBIDDEN" || status === 403) {
    return zhCN.optimizeDemo.executionForbiddenError;
  }
  if (payload?.error) {
    return payload.error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return zhCN.optimizeDemo.executionErrorFallback;
}

function formatTowerApproachBand(
  value:
    | {
        low?: number | null;
        high?: number | null;
        label?: string;
      }
    | undefined
): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const low = typeof value.low === "number" ? value.low : null;
  const high = typeof value.high === "number" ? value.high : null;
  if (low === null || high === null) {
    return preferLocaleValue(value.label, zhCN.optimizeDemo.pendingValue);
  }
  const label = value.label ? `（${value.label}）` : "";
  return `${formatNumber(low, 1)} ~ ${formatNumber(high, 1)} °C ${label}`.trim();
}

function localizeTowerApproachExecutionMode(value: string | undefined): string {
  if (value === "read_only" || value === "off") {
    return "只读";
  }
  if (value === "shadow") {
    return "影子验证";
  }
  if (value === "assisted") {
    return "人工辅助";
  }
  if (value === "enforced") {
    return "强制执行";
  }
  return preferLocaleValue(value, "只读");
}

function localizeShadowVerificationOutcome(value: string | undefined): string {
  if (value === "improved") {
    return "改善";
  }
  if (value === "neutral") {
    return "持平";
  }
  if (value === "regressed") {
    return "退化";
  }
  if (value === "invalid") {
    return "无效";
  }
  if (value === "pending") {
    return "待观察";
  }
  return preferLocaleValue(value, "待观察");
}

function getShadowVerificationSourceRecordId(record: ShadowVerificationRecordDto): string | null {
  if (typeof record.sourceRecordId === "string" && record.sourceRecordId.trim()) {
    return record.sourceRecordId.trim();
  }
  const raw = record.payload?.sourceRecordId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

const SHADOW_VERIFICATION_RT_TO_KW = 3.5168525;
const SHADOW_VERIFICATION_RELATIVE_TOLERANCE = 0.25;

function getShadowMetricNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isRelativeMismatch(observed: number, expected: number, tolerance = SHADOW_VERIFICATION_RELATIVE_TOLERANCE): boolean {
  if (!Number.isFinite(observed) || !Number.isFinite(expected) || expected <= 0) {
    return false;
  }
  return Math.abs(observed - expected) / expected > tolerance;
}

function getShadowVerificationMetricConsistencyIssue(record: ShadowVerificationRecordDto | null | undefined): string | null {
  const metrics = record?.metrics;
  if (!metrics) {
    return null;
  }
  const loadKw = getShadowMetricNumber(metrics.loadKw);
  const stationPowerKw = getShadowMetricNumber(metrics.stationPowerKw);
  const stationCop = getShadowMetricNumber(metrics.stationCop);
  const kwPerRt = getShadowMetricNumber(metrics.kwPerRt);

  if (stationCop !== null && kwPerRt !== null) {
    const expectedKwPerRt = SHADOW_VERIFICATION_RT_TO_KW / stationCop;
    if (isRelativeMismatch(kwPerRt, expectedKwPerRt)) {
      return "COP 与 kW/RT 不一致，需复核记录口径。";
    }
  }
  if (loadKw !== null && stationPowerKw !== null && stationCop !== null) {
    const expectedCop = loadKw / stationPowerKw;
    if (isRelativeMismatch(stationCop, expectedCop)) {
      return "负荷、总功率与 COP 不一致，需复核记录口径。";
    }
  }
  if (loadKw !== null && stationPowerKw !== null && kwPerRt !== null) {
    const expectedKwPerRt = stationPowerKw / (loadKw / SHADOW_VERIFICATION_RT_TO_KW);
    if (isRelativeMismatch(kwPerRt, expectedKwPerRt)) {
      return "负荷、总功率与 kW/RT 不一致，需复核记录口径。";
    }
  }
  return null;
}

function normalizeShadowVerificationRecordForDisplay(record: ShadowVerificationRecordDto): ShadowVerificationRecordDto {
  const issue = getShadowVerificationMetricConsistencyIssue(record);
  if (!issue) {
    return record;
  }
  return {
    ...record,
    outcome: record.outcome && record.outcome !== "pending" ? "invalid" : record.outcome,
    invalidReason: record.invalidReason || issue
  };
}

function formatShadowVerificationKeyMetrics(record: ShadowVerificationRecordDto | null | undefined): string {
  if (!record) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (getShadowVerificationMetricConsistencyIssue(record)) {
    return "指标待复核";
  }
  return `COP ${formatNumber(record.metrics?.stationCop, 2)} / kWRT ${formatNumber(record.metrics?.kwPerRt, 3)}`;
}

function buildShadowVerificationReviewNote(outcome: ShadowVerificationReviewOutcome, sourceRecordId: string): string {
  return `人工复核：${localizeShadowVerificationOutcome(outcome)}；sourceRecordId=${sourceRecordId}；append-only 新增记录，不修改原记录。`;
}

function buildFallbackShadowVerificationSummary(records: ShadowVerificationRecordDto[]): ShadowVerificationSummaryDto {
  const buildCounts = (sourceRecords: ShadowVerificationRecordDto[]) => {
    const counts = {
      pending: 0,
      improved: 0,
      neutral: 0,
      regressed: 0,
      invalid: 0
    };
    for (const record of sourceRecords) {
      const outcome = typeof record.outcome === "string" ? record.outcome.trim().toLowerCase() : "";
      if (outcome === "pending" || outcome === "improved" || outcome === "neutral" || outcome === "regressed" || outcome === "invalid") {
        counts[outcome] += 1;
      }
    }
    const reviewedCount = counts.improved + counts.neutral + counts.regressed + counts.invalid;
    return {
      ...counts,
      reviewedCount,
      comparableCount: counts.improved + counts.neutral + counts.regressed
    };
  };
  const counts = {
    pending: 0,
    improved: 0,
    neutral: 0,
    regressed: 0,
    invalid: 0
  };
  for (const record of records) {
    const outcome = typeof record.outcome === "string" ? record.outcome.trim().toLowerCase() : "";
    if (outcome === "pending" || outcome === "improved" || outcome === "neutral" || outcome === "regressed" || outcome === "invalid") {
      counts[outcome] += 1;
    }
  }
  const groups = new Map<string, ShadowVerificationRecordDto[]>();
  for (const record of records) {
    const verificationType =
      typeof record.verificationType === "string" && record.verificationType.trim()
        ? record.verificationType.trim()
        : "unknown";
    const group = groups.get(verificationType) || [];
    group.push(record);
    groups.set(verificationType, group);
  }
  const byVerificationType = Array.from(groups.entries())
    .map(([verificationType, sourceRecords]) => {
      const groupCounts = buildCounts(sourceRecords);
      return {
        verificationType,
        total: sourceRecords.length,
        pendingCount: groupCounts.pending,
        reviewedCount: groupCounts.reviewedCount,
        comparableCount: groupCounts.comparableCount,
        improvedCount: groupCounts.improved,
        neutralCount: groupCounts.neutral,
        regressedCount: groupCounts.regressed,
        invalidCount: groupCounts.invalid
      };
    })
    .sort((left, right) => left.verificationType.localeCompare(right.verificationType));
  const latestReviewed = records.find((record) => record.outcome && record.outcome !== "pending") || null;
  return {
    basis: "client_listed_append_only_shadow_verification_records",
    verificationType: "all",
    executionId: "all",
    total: records.length,
    sampledCount: records.length,
    pendingCount: counts.pending,
    reviewedCount: counts.improved + counts.neutral + counts.regressed + counts.invalid,
    comparableCount: counts.improved + counts.neutral + counts.regressed,
    improvedCount: counts.improved,
    neutralCount: counts.neutral,
    regressedCount: counts.regressed,
    invalidCount: counts.invalid,
    latestOutcome: latestReviewed?.outcome || null,
    latestReviewedAt: latestReviewed?.recordedAt || null,
    byVerificationType,
    controlMutation: false,
    executionMutation: false,
    acceptanceBoundary: "shadow_verification_summary_only_not_savings_commitment"
  };
}

function formatPrefillTimestamp(value: string | null | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ").slice(0, 16);
  }
  const pad = (input: number): string => String(input).padStart(2, "0");
  return [
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  ].join(" ");
}

function formatPrefillCompactTimestamp(value: string | null | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ").slice(11, 16) || value.replace("T", " ").slice(0, 16);
  }
  const pad = (input: number): string => String(input).padStart(2, "0");
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function compactPrefillSourceLabel(value: string | null | undefined): string {
  const normalized = preferLocaleValue(value, "待确认");
  return normalized
    .replace("现态总制冷量快照", "现态冷量")
    .replace("场景控制实时湿球", "实时湿球")
    .replace("实时湿球温度", "实时湿球");
}

function readAutoLoadCandidate(overview: DashboardOverviewDto | null | undefined): AutoPrefillCandidate {
  const cards = overview?.energyCards;
  const timestamp = overview?.generatedAt ?? overview?.freshness?.latestTimestamp ?? null;
  if (typeof cards?.totalCoolingCapacity === "number" && Number.isFinite(cards.totalCoolingCapacity) && cards.totalCoolingCapacity > 0) {
    return {
      value: cards.totalCoolingCapacity,
      source: zhCN.optimizeDemo.prefillLoadSourceDirect,
      timestamp,
      reasonCode: null
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
      timestamp,
      reasonCode: null
    };
  }
  return {
    value: null,
    source: null,
    timestamp,
    reasonCode: "prefill_load_snapshot_missing"
  };
}

function readOverviewWetBulbCandidate(overview: DashboardOverviewDto | null | undefined): AutoPrefillCandidate {
  const wetBulbC = overview?.energyCards?.outdoorWetBulbC;
  const timestamp = overview?.generatedAt ?? overview?.freshness?.latestTimestamp ?? null;
  if (typeof wetBulbC === "number" && Number.isFinite(wetBulbC)) {
    return {
      value: wetBulbC,
      source: localeText(
        "场景控制实时湿球",
        "Scene-control live wet-bulb",
        "Wet-bulb thoi gian thuc cua dieu khien canh"
      ),
      timestamp,
      reasonCode: null
    };
  }
  return {
    value: null,
    source: null,
    timestamp,
    reasonCode: null
  };
}

function readLatestWetBulbCandidate(trend: SceneLegacyTrendDto | null | undefined): AutoPrefillCandidate {
  const points = Array.isArray(trend?.points) ? [...trend.points].reverse() : [];
  const latestPoint = points.find(
    (point) => typeof point?.value === "number" && Number.isFinite(point.value)
  );
  if (!latestPoint || typeof latestPoint.value !== "number") {
    return {
      value: null,
      source: null,
      timestamp: trend?.generatedAt ?? trend?.freshness?.latestTimestamp ?? null,
      reasonCode: "prefill_wet_bulb_points_missing"
    };
  }
  return {
    value: latestPoint.value,
    source: zhCN.optimizeDemo.prefillWetBulbSourceLatestPoint,
    timestamp: latestPoint.timestamp ?? trend?.generatedAt ?? trend?.freshness?.latestTimestamp ?? null,
    reasonCode: null
  };
}

export default function OptimizeDemoPage() {
  ensureOptimizeDemoLocaleText();
  const currentProject = getCurrentProject(getAuthSession());
  const activeSiteId = resolveOptimizeActiveSiteId(currentProject);
  const activeProjectLabel = resolveAuthProjectDisplayName(currentProject, "当前项目");
  const operationalDiagnosticsHref = `/operational-diagnostics?siteId=${encodeURIComponent(activeSiteId)}`;
  const showInlineOperationalDiagnosticsDetails = false;
  const activeProjectContextKey = [
    currentProject?.siteId,
    currentProject?.modelKey,
    currentProject?.databaseKey,
    currentProject?.template
  ].join("::");
  const [loadKw, setLoadKw] = useState("1200");
  const [outdoorWetBulbC, setOutdoorWetBulbC] = useState("32.5");
  const [mode, setMode] = useState("cooling");
  const [submitting, setSubmitting] = useState(false);
  const [resultError, setResultError] = useState<OptimizeDraftErrorDto | null>(null);
  const [executions, setExecutions] = useState<OptimizeExecutionRecordDto[]>([]);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionSubmitting, setExecutionSubmitting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [shadowVerificationRecords, setShadowVerificationRecords] = useState<ShadowVerificationRecordDto[]>([]);
  const [shadowVerificationSummary, setShadowVerificationSummary] = useState<ShadowVerificationSummaryDto | null>(null);
  const [shadowVerificationTypeFilter, setShadowVerificationTypeFilter] = useState<ShadowVerificationTypeFilter>("all");
  const [shadowVerificationExecutionFilter, setShadowVerificationExecutionFilter] =
    useState<ShadowVerificationExecutionFilter>("all");
  const [shadowVerificationLoading, setShadowVerificationLoading] = useState(false);
  const [shadowVerificationSubmitting, setShadowVerificationSubmitting] = useState(false);
  const [shadowVerificationExporting, setShadowVerificationExporting] = useState(false);
  const [shadowVerificationReportExporting, setShadowVerificationReportExporting] = useState(false);
  const [shadowVerificationPrintOpening, setShadowVerificationPrintOpening] = useState(false);
  const [shadowVerificationReviewingId, setShadowVerificationReviewingId] = useState<string | null>(null);
  const [shadowVerificationError, setShadowVerificationError] = useState<string | null>(null);
  const [autoPrefill, setAutoPrefill] = useState<AutoPrefillState>({
    kind: "loading",
    loadSource: null,
    wetBulbSource: null,
    refreshedAt: null,
    reasonCodes: []
  });
  const loadDirtyRef = useRef(false);
  const wetBulbDirtyRef = useRef(false);
  const autoPrefillRequestIdRef = useRef(0);

  const details = readOptimizeDetails(resultError);
  const extendedDetails = asExtendedDetails(details);
  const isStructuredOptimizeResponse = Boolean(details) && (
    resultError?.ok === true ||
    resultError?.code === "OK" ||
    resultError?.code === "NOT_IMPLEMENTED"
  );
  const hasValidationError = Boolean(resultError) && !isStructuredOptimizeResponse;
  const parsedLoadKwInput = parseOptionalFiniteNumber(loadKw);
  const parsedOutdoorTempCInput = parseOptionalFiniteNumber(outdoorWetBulbC);
  const canSubmitOptimize =
    typeof parsedLoadKwInput === "number" && typeof parsedOutdoorTempCInput === "number" && !submitting;
  const sourceSummary = summarizeSourceStatus([details?.sourceStatus]);

  async function reloadExecutions() {
    setExecutionLoading(true);
    try {
      const executionResult = await fetchOptimizeExecutions(activeSiteId, { limit: 12 });
      setExecutions(Array.isArray(executionResult.items) ? executionResult.items : []);
      setExecutionError(null);
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionLoading(false);
    }
  }

  async function reloadShadowVerificationRecords(
    filter = shadowVerificationTypeFilter,
    executionFilter = shadowVerificationExecutionFilter
  ) {
    setShadowVerificationLoading(true);
    const normalizedExecutionFilter =
      typeof executionFilter === "string" && executionFilter.trim() ? executionFilter.trim() : "all";
    try {
      const recordResult = await fetchShadowVerificationRecords(activeSiteId, {
        limit: 100,
        verificationType: filter === "all" ? undefined : filter,
        executionId: normalizedExecutionFilter === "all" ? undefined : normalizedExecutionFilter
      });
      setShadowVerificationRecords(Array.isArray(recordResult.items) ? recordResult.items : []);
      setShadowVerificationSummary(recordResult.summary || null);
      setShadowVerificationError(null);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationLoading(false);
    }
  }

  async function submitTowerApproachExecution() {
    if (!details) {
      return;
    }
    setExecutionSubmitting(true);
    const towerActions = buildTowerApproachExecutionActions(towerApproachAdvisor);
    const minGuardrail = findTowerApproachMinGuardrail(towerApproachAdvisor);
    try {
      await createTowerApproachExecution(activeSiteId, {
        draft: {
          generatedAt: details.generatedAt,
          gateLevel: gate?.level,
          baseline: {
            systemCop: baseline.systemCop ?? null,
            totalPowerKw: baseline.totalPowerKw ?? null,
            activeAlarmCount: baseline.activeAlarmCount ?? null,
            thermalUnbalanceRate: baseline.thermalUnbalanceRate ?? null
          }
        },
        execution: {
          type: "tower-approach",
          title:
            typeof towerApproachAdvisor?.targetTcwsC === "number"
              ? `冷却塔接近度执行建议（Tcws ${formatNumber(towerApproachAdvisor.targetTcwsC, 1)} °C）`
              : "冷却塔接近度执行建议",
          targetApproachC: towerApproachAdvisor?.targetApproachC ?? null,
          targetTcwsC: towerApproachAdvisor?.targetTcwsC ?? null,
          equipmentContext: deriveEquipmentContextFromAdvisor(towerApproachAdvisor),
          guardrailSnapshot: minGuardrail
            ? {
                key: minGuardrail.key || null,
                status: minGuardrail.status || null,
                value: minGuardrail.value ?? null,
                message: minGuardrail.message || null,
                resolvedBy: minGuardrail.resolvedBy || null,
                matchedKeys: Array.isArray(minGuardrail.matchedKeys) ? minGuardrail.matchedKeys : []
              }
            : null,
          rollbackTarget: {
            mode: "manual",
            targetTcwsC: towerApproachAdvisor?.currentTcwsC ?? null,
            targetApproachC: towerApproachAdvisor?.currentApproachC ?? null,
            reason: "回退到提交前现态"
          },
          reason:
            minGuardrail?.resolvedBy && Array.isArray(minGuardrail?.matchedKeys) && minGuardrail.matchedKeys.length
              ? `${preferLocaleValue(towerApproachAdvisor?.reason, zhCN.optimizeDemo.pendingValue)} [${
                  minGuardrail.resolvedBy
                }:${minGuardrail.matchedKeys.join(",")}]`
              : towerApproachAdvisor?.reason
                ? preferLocaleValue(towerApproachAdvisor.reason, zhCN.optimizeDemo.pendingValue)
                : null,
          actions: towerActions
        },
        approval: {
          required: true
        }
      });
      await reloadExecutions();
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionSubmitting(false);
    }
  }

  async function submitPumpDeltaTExecution() {
    if (!details) {
      return;
    }
    setExecutionSubmitting(true);
    const pumpActions = buildPumpDeltaTExecutionActions(pumpDeltaTAdvisor);
    try {
      await createOptimizeExecution(activeSiteId, {
        draft: {
          generatedAt: details.generatedAt,
          gateLevel: gate?.level,
          baseline: {
            systemCop: baseline.systemCop ?? null,
            totalPowerKw: baseline.totalPowerKw ?? null,
            activeAlarmCount: baseline.activeAlarmCount ?? null,
            thermalUnbalanceRate: baseline.thermalUnbalanceRate ?? null
          }
        },
        execution: {
          type: "pump-delta-t",
          title: `冷冻泵/冷却泵温差导向降频（冷冻泵修正 ${formatTrimHz(
            pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz
          )} / 冷却泵修正 ${formatTrimHz(pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz)}）`,
          targetChwpFreqTrimHz: pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz ?? null,
          targetCwpFreqTrimHz: pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz ?? null,
          ttlSeconds: pumpDeltaTAdvisor?.outputTargets?.ttlSeconds ?? 300,
          holdMinutes: pumpDeltaTAdvisor?.outputTargets?.holdMinutes ?? 5,
          rollbackLockoutMinutes: pumpDeltaTAdvisor?.outputTargets?.rollbackLockoutMinutes ?? 15,
          targetPoints: {
            chilledPump: "AI_ChwpFreqTrim_Hz",
            coolingPump: "AI_CwpFreqTrim_Hz"
          },
          rollbackTarget: {
            mode: "zero-trim",
            targetChwpFreqTrimHz: 0,
            targetCwpFreqTrimHz: 0,
            reason: "回退到 0Hz 修正量"
          },
          reason: pumpDeltaTAdvisor?.reason
            ? preferLocaleValue(pumpDeltaTAdvisor.reason, zhCN.optimizeDemo.pendingValue)
            : null,
          actions: pumpActions
        },
        approval: {
          required: true
        }
      });
      await reloadExecutions();
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionSubmitting(false);
    }
  }

  async function approveExecution(record: OptimizeExecutionRecordDto) {
    const executionId = record.executionId;
    if (!executionId) {
      return;
    }
    setExecutionSubmitting(true);
    try {
      if (record.execution?.type === "tower-approach") {
        await approveTowerApproachExecution(activeSiteId, executionId, {
          note: zhCN.optimizeDemo.executionApproveNoteDefault
        });
      } else {
        await approveOptimizeExecution(activeSiteId, executionId, {
          note: zhCN.optimizeDemo.executionApproveNoteDefault
        });
      }
      await reloadExecutions();
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionSubmitting(false);
    }
  }

  async function rollbackExecution(record: OptimizeExecutionRecordDto) {
    const executionId = record.executionId;
    if (!executionId) {
      return;
    }
    setExecutionSubmitting(true);
    try {
      if (record.execution?.type === "tower-approach") {
        await rollbackTowerApproachExecution(activeSiteId, executionId, {
          reason: zhCN.optimizeDemo.executionRollbackReasonDefault
        });
      } else {
        await rollbackOptimizeExecution(activeSiteId, executionId, {
          reason: zhCN.optimizeDemo.executionRollbackReasonDefault
        });
      }
      await reloadExecutions();
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionSubmitting(false);
    }
  }

  async function dispatchExecution(record: OptimizeExecutionRecordDto) {
    const executionId = record.executionId;
    if (!executionId) {
      return;
    }
    setExecutionSubmitting(true);
    try {
      await dispatchOptimizeExecution(activeSiteId, executionId, {
        note:
          record.execution?.type === "pump-delta-t"
            ? "按当前模式写入泵频率修正量影子记录"
            : "按当前模式写入冷却塔接近度影子记录"
      });
      await reloadExecutions();
    } catch (error) {
      setExecutionError(extractBffErrorMessage(error));
    } finally {
      setExecutionSubmitting(false);
    }
  }

  async function saveShadowVerificationRecord() {
    if (!details) {
      return;
    }
    setShadowVerificationSubmitting(true);
    try {
      const latestExecutionId =
        pendingTowerApproachExecution?.executionId ||
        pendingPumpDeltaTExecution?.executionId ||
        towerApproachLatestExecution?.executionId ||
        pumpDeltaTLatestExecution?.executionId ||
        null;
      await createShadowVerificationRecord(activeSiteId, {
        record: {
          executionId: latestExecutionId,
          verificationType: "chiller-staging",
          targetLabel: shadowVerificationObjectSummary,
          outcome: "pending",
          windowMinutes:
            typeof chillerVerification?.durationMinutes?.max === "number"
              ? chillerVerification.durationMinutes.max
              : 60,
          metrics: {
            loadKw: chillerStagingAdvisor?.current?.systemCoolingLoadKw ?? details.request?.loadKw ?? null,
            wetBulbC: details.request?.outdoorTempC ?? null,
            stationCop: chillerStagingAdvisor?.current?.stationCop ?? null,
            comboCop: chillerStagingAdvisor?.current?.comboCop ?? null,
            kwPerRt: chillerCurrentEvidence?.kwPerRt ?? chillerCurrentLiveSample?.kwPerRt ?? null,
            stationPowerKw: chillerStagingAdvisor?.current?.stationPowerTotalKw ?? null,
            chillerPowerKw: chillerStagingAdvisor?.current?.chillerPowerTotalKw ?? null,
            alarmCount: chillerCurrentLiveSample?.alarmCount ?? baseline.activeAlarmCount ?? 0
          },
          note: "人工保存 shadow 验证记录；30-60min 同负荷/湿球 band 后再补充 improved/neutral/regressed/invalid 判定。",
          recordedAt: new Date().toISOString()
        }
      });
      const nextExecutionFilter = latestExecutionId || "all";
      setShadowVerificationTypeFilter("chiller-staging");
      setShadowVerificationExecutionFilter(nextExecutionFilter);
      await reloadShadowVerificationRecords("chiller-staging", nextExecutionFilter);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationSubmitting(false);
    }
  }

  async function exportShadowVerificationRecordsCsv() {
    setShadowVerificationExporting(true);
    try {
      const file = await exportShadowVerificationRecords(activeSiteId, {
        limit: 500,
        verificationType: shadowVerificationTypeFilter === "all" ? undefined : shadowVerificationTypeFilter,
        executionId:
          shadowVerificationExecutionFilter === "all" ? undefined : shadowVerificationExecutionFilter
      });
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || `shadow-verification-records-${activeSiteId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShadowVerificationError(null);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationExporting(false);
    }
  }

  async function exportSingleShadowReviewReport() {
    if (shadowVerificationExecutionFilter === "all") {
      setShadowVerificationError("请先选择单个执行单，再导出单次 shadow 复盘报告。");
      return;
    }
    setShadowVerificationReportExporting(true);
    try {
      const file = await exportShadowVerificationReviewReport(activeSiteId, {
        executionId: shadowVerificationExecutionFilter,
        limit: 500,
        verificationType: shadowVerificationTypeFilter === "all" ? undefined : shadowVerificationTypeFilter
      });
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        file.filename || `shadow-review-${activeSiteId}-${shadowVerificationExecutionFilter}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShadowVerificationError(null);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationReportExporting(false);
    }
  }

  async function openSingleShadowReviewPrintPage() {
    if (shadowVerificationExecutionFilter === "all") {
      setShadowVerificationError("请先选择单个执行单，再打开复盘打印版。");
      return;
    }
    setShadowVerificationPrintOpening(true);
    try {
      const file = await exportShadowVerificationReviewPrintPage(activeSiteId, {
        executionId: shadowVerificationExecutionFilter,
        limit: 500,
        verificationType: shadowVerificationTypeFilter === "all" ? undefined : shadowVerificationTypeFilter
      });
      const url = window.URL.createObjectURL(file.blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const link = document.createElement("a");
        link.href = url;
        link.download =
          file.filename || `shadow-review-${activeSiteId}-${shadowVerificationExecutionFilter}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60_000);
      setShadowVerificationError(null);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationPrintOpening(false);
    }
  }

  async function reviewShadowVerificationRecord(
    record: ShadowVerificationRecordDto,
    outcome: ShadowVerificationReviewOutcome
  ) {
    const sourceRecordId = record.recordId;
    if (!sourceRecordId) {
      return;
    }
    const reviewKey = `${sourceRecordId}:${outcome}`;
    setShadowVerificationReviewingId(reviewKey);
    try {
      await createShadowVerificationRecord(activeSiteId, {
        record: {
          sourceRecordId,
          executionId: record.executionId ?? null,
          verificationType: record.verificationType || "chiller-staging",
          targetLabel: record.targetLabel || "shadow 验证",
          outcome,
          windowMinutes: record.windowMinutes ?? 60,
          metrics: record.metrics || {},
          note: buildShadowVerificationReviewNote(outcome, sourceRecordId),
          invalidReason: outcome === "invalid" ? "人工复核标记为无效样本，不纳入节能判断。" : null,
          recordedAt: new Date().toISOString()
        }
      });
      const reviewType: ShadowVerificationTypeFilter =
        record.verificationType === "tower-approach" ||
        record.verificationType === "pump-delta-t" ||
        record.verificationType === "chiller-staging"
          ? record.verificationType
          : shadowVerificationTypeFilter;
      const nextExecutionFilter = record.executionId || shadowVerificationExecutionFilter || "all";
      setShadowVerificationTypeFilter(reviewType);
      setShadowVerificationExecutionFilter(nextExecutionFilter);
      await reloadShadowVerificationRecords(reviewType, nextExecutionFilter);
      setShadowVerificationError(null);
    } catch (error) {
      setShadowVerificationError(extractBffErrorMessage(error));
    } finally {
      setShadowVerificationReviewingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLoadKw = parseOptionalFiniteNumber(loadKw);
    const parsedOutdoorTempC = parseOptionalFiniteNumber(outdoorWetBulbC);

    if (typeof parsedLoadKw !== "number" || typeof parsedOutdoorTempC !== "number") {
      setResultError({
        code: "BAD_REQUEST",
        error:
          typeof parsedLoadKw !== "number"
            ? "Invalid optimize input: loadKw is required"
            : "Invalid optimize input: outdoorTempC is required"
      });
      return;
    }

    loadDirtyRef.current = true;
    wetBulbDirtyRef.current = true;
    setSubmitting(true);
    try {
      const payload = await postOptimizeDraft(activeSiteId, {
        context: {
          siteId: activeSiteId
        },
        inputs: {
          loadKw: parsedLoadKw,
          outdoorTempC: parsedOutdoorTempC,
          mode,
          equipmentContext: deriveEquipmentContextFromAdvisor(towerApproachAdvisor)
        }
      });
      setResultError(payload);
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
  const requestStatusLabel = responseReady
    ? "已生成建议"
    : zhCN.optimizeDemo.requestPending;
  const requestDelta =
    details?.request?.loadKw != null && details?.request?.outdoorTempC != null
      ? `${details.request.loadKw} kW / ${details.request.outdoorTempC} °C`
      : zhCN.optimizeDemo.pendingHint;
  const gate = extendedDetails?.gate;
  const baseline = normalizeBaseline(extendedDetails?.baseline, details);
  const historyBenchmark = extendedDetails?.historyBenchmark;
  const benefitEstimate = extendedDetails?.benefitEstimate;
  const towerApproachAdvisor = extendedDetails?.towerApproachAdvisor;
  const pumpDeltaTAdvisor = extendedDetails?.pumpDeltaTAdvisor;
  const chillerStagingAdvisor = extendedDetails?.chillerStagingAdvisor;
  const operationalDiagnosticsAdvisor = extendedDetails?.operationalDiagnosticsAdvisor;
  const reviewReadiness = extendedDetails?.reviewReadiness;
  const executionHub = extendedDetails?.executionHub;
  const towerApproachExecutions = executions.filter((item) => item?.execution?.type === "tower-approach");
  const towerApproachLatestExecution = towerApproachExecutions[0];
  const towerApproachExecutionHistory = towerApproachExecutions.slice(0, 10);
  const pendingTowerApproachExecution = towerApproachExecutions.find((item) => item?.status === "pending_approval");
  const approvedTowerApproachExecution = towerApproachExecutions.find((item) => item?.status === "approved");
  const pumpDeltaTExecutions = executions.filter((item) => item?.execution?.type === "pump-delta-t");
  const pumpDeltaTLatestExecution = pumpDeltaTExecutions[0];
  const pumpDeltaTExecutionHistory = pumpDeltaTExecutions.slice(0, 10);
  const pendingPumpDeltaTExecution = pumpDeltaTExecutions.find((item) => item?.status === "pending_approval");
  const approvedPumpDeltaTExecution = pumpDeltaTExecutions.find((item) => item?.status === "approved");
  const towerApproachExecutionReady = towerApproachAdvisor?.executionReady === true;
  const pumpDeltaTStatusLabel =
    pumpDeltaTAdvisor?.status === "ready"
      ? "建议可评审"
      : pumpDeltaTAdvisor?.status === "partial"
        ? "需人工复核"
        : "信号不足";
  const pumpDeltaTStatusTone = mapBenchmarkTone(pumpDeltaTAdvisor?.status);
  const pumpDeltaTExecutionReady = pumpDeltaTAdvisor?.executionReady === true;
  const chillerStagingStatusLabel = localizeChillerStagingStatus(chillerStagingAdvisor?.status);
  const chillerStagingStatusTone = mapBenchmarkTone(chillerStagingAdvisor?.status);
  const chillerStagingExecutionReady = chillerStagingAdvisor?.executionReady === true;
  const chillerStagingExecutionLabel = chillerStagingExecutionReady ? "可创建影子单" : "仅允许审阅";
  const chillerStagingExecutionTone: "good" | "warn" | "neutral" = chillerStagingExecutionReady ? "good" : "warn";
  const reviewReadinessStatusLabel = localizeReviewReadinessStatus(reviewReadiness?.status);
  const reviewReadinessStatusTone = mapReviewReadinessTone(reviewReadiness?.status);
  const benefitEstimateConfidenceLabel = localizeBenefitConfidence(benefitEstimate?.confidence);
  const readOnlyMode = runtimeConfig.readOnlyMode;
  const executionPermissions = executionHub?.permissions;
  const canApproveByPermission = executionPermissions?.canApprove === true;
  const canRollbackByPermission = executionPermissions?.canRollback === true;
  const canDispatchByPermission = executionPermissions?.canDispatch === true;
  const towerApproachLifecycleMode = localizeTowerApproachExecutionMode(
    towerApproachAdvisor?.advisorResult?.lifecycleMode || towerApproachAdvisor?.executionMode || towerApproachAdvisor?.dispatchMode
  );
  const towerApproachDispatchReady = towerApproachAdvisor?.advisorResult?.execution?.allowedToDispatch === true;
  const pumpDeltaTExecutionPolicy = pumpDeltaTAdvisor?.advisorResult?.execution;
  const pumpDeltaTLifecycleRaw =
    pumpDeltaTAdvisor?.advisorResult?.lifecycleMode || pumpDeltaTAdvisor?.executionMode || pumpDeltaTAdvisor?.dispatchMode;
  const pumpDeltaTDispatchReady = pumpDeltaTExecutionPolicy?.allowedToDispatch === true;
  const pumpDeltaTControlPointMapped = pumpDeltaTExecutionPolicy?.controlPointMapped === true;
  const pumpDeltaTRollbackMapped = pumpDeltaTExecutionPolicy?.rollbackMapped === true;
  const pumpDeltaTAssistedReady = Boolean(
    pumpDeltaTLifecycleRaw === "assisted" && pumpDeltaTControlPointMapped && pumpDeltaTRollbackMapped
  );
  const pumpDeltaTBoundaryLabel = pumpDeltaTAssistedReady ? "人工辅助待复核" : "仅影子验证";
  const pumpDeltaTMappingLabel =
    pumpDeltaTControlPointMapped && pumpDeltaTRollbackMapped ? "点位与回退已映射" : "缺 PLC 点位或回退映射";
  const inputSignals = Array.isArray(towerApproachAdvisor?.inputSignals) ? towerApproachAdvisor.inputSignals : [];
  const readySignalCount = inputSignals.filter((signal) => signal.ok).length;
  const signalQualityLabel = responseReady && inputSignals.length
    ? `${readySignalCount}/${inputSignals.length}`
    : "待生成";
  const towerBlockers = [
    ...(Array.isArray(towerApproachAdvisor?.blockers) ? towerApproachAdvisor.blockers : []),
    ...(gate?.level === "blocked" && gate.reason ? [gate.reason] : [])
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const pumpBlockers = [
    ...(Array.isArray(pumpDeltaTAdvisor?.blockers) ? pumpDeltaTAdvisor.blockers : []),
    ...(gate?.level === "blocked" && gate.reason ? [gate.reason] : [])
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const chillerBlockers = [
    ...(Array.isArray(chillerStagingAdvisor?.blockers) ? chillerStagingAdvisor.blockers : []),
    ...(gate?.level === "blocked" && gate.reason ? [gate.reason] : [])
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const compactBlockers = Array.from(new Set([...chillerBlockers, ...towerBlockers, ...pumpBlockers])).slice(0, 3);
  const headerSubtitle = responseReady
    ? localeText(
        `站点 ${activeSiteId} · 主机组合、冷却塔接近度与泵频率修正的 L4 治理和影子验证。`,
        `Site ${activeSiteId} · L4 governance and shadow verification for chiller staging, Tower Approach, and pump delta-T trim.`,
        `Site ${activeSiteId} · Quản trị L4 và xác minh shadow cho tổ hợp chiller, Approach và delta-T bom.`
      )
    : localeText(
        `站点 ${activeSiteId} · 先固定负荷和湿球，再生成主机组合、接近度与泵温差建议。`,
        `Site ${activeSiteId} · Lock load and wet bulb first, then generate chiller staging, Approach, and pump delta-T advice.`,
        `Site ${activeSiteId} · Cố định tải và bầu ướt trước, sau đó tạo khuyến nghị tổ hợp chiller, Approach và delta-T bom.`
      );
  const pageModeLabel = readOnlyMode
    ? localeText("只读演示", "Read-only Demo", "Chỉ xem demo")
    : towerApproachLifecycleMode;
  const pageModeHint = readOnlyMode
    ? localeText("保留审阅与历史记录，不允许执行。", "Review and history are available; execution is blocked.", "Cho phép xem và lịch sử; không cho phép thực thi.")
    : localeText("允许创建影子审批单，真实 PLC 下发仍锁定。", "Shadow approval records can be created; real PLC dispatch remains locked.", "Co the tao phieu shadow; phat lenh PLC that van bi khoa.");
  const canSubmitTowerApproach = Boolean(towerApproachExecutionReady && !executionSubmitting && !readOnlyMode);
  const canApproveTowerApproach = Boolean(
    pendingTowerApproachExecution && !executionSubmitting && !readOnlyMode && canApproveByPermission
  );
  const canRollbackTowerApproach = Boolean(
    approvedTowerApproachExecution && !executionSubmitting && !readOnlyMode && canRollbackByPermission
  );
  const canDispatchTowerApproach = Boolean(
    approvedTowerApproachExecution &&
    towerApproachDispatchReady &&
    !executionSubmitting &&
    !readOnlyMode &&
    canDispatchByPermission
  );
  const canSubmitPumpDeltaT = Boolean(pumpDeltaTExecutionReady && !executionSubmitting && !readOnlyMode);
  const canApprovePumpDeltaT = Boolean(
    pendingPumpDeltaTExecution && !executionSubmitting && !readOnlyMode && canApproveByPermission
  );
  const canRollbackPumpDeltaT = Boolean(
    approvedPumpDeltaTExecution && !executionSubmitting && !readOnlyMode && canRollbackByPermission
  );
  const canDispatchPumpDeltaT = Boolean(
    approvedPumpDeltaTExecution &&
    pumpDeltaTDispatchReady &&
    pumpDeltaTAssistedReady &&
    !executionSubmitting &&
    !readOnlyMode &&
    canDispatchByPermission
  );
  const towerActionState = !responseReady
    ? {
        label: "等待建议",
        hint: "先生成一份完整评估，再判断是否需要提交接近度审批。",
        tone: "neutral" as const
      }
    : readOnlyMode
      ? {
          label: "只读",
          hint: "当前环境只允许审阅，接近度目标不会进入审批。",
          tone: "warn" as const
      }
      : towerBlockers.length
        ? {
          label: "被阻断",
          hint: towerBlockers[0],
          tone: "warn" as const
        }
      : pendingTowerApproachExecution
        ? {
            label: "待审批",
            hint: "已有接近度目标在审批队列中，先处理当前审批。",
            tone: "warn" as const
          }
        : approvedTowerApproachExecution
          ? {
              label: "历史已批",
              hint: "当前显示的是历史影子批准单，复核现态后再处理记录回退。",
              tone: "good" as const
            }
          : canSubmitTowerApproach
            ? {
                label: "可提交",
                hint: "接近度目标、数据和边界已满足创建影子审批单条件。",
                tone: "good" as const
              }
            : {
                label: towerApproachExecutionReady ? "继续判断" : "继续观察",
                hint: preferLocaleValue(towerApproachAdvisor?.reason, zhCN.optimizeDemo.towerApproachPending),
                tone: towerApproachExecutionReady ? "neutral" : "warn" as const
              };
  const pumpActionState = !responseReady
    ? {
        label: "等待建议",
        hint: "先生成完整评估，再判断是否提交泵降频影子审批单。",
        tone: "neutral" as const
      }
    : readOnlyMode
      ? {
          label: "只读",
          hint: "当前环境只允许审阅，泵频率修正量不会进入审批。",
          tone: "warn" as const
        }
      : pumpBlockers.length
        ? {
            label: "被阻断",
            hint: pumpBlockers[0],
            tone: "warn" as const
          }
        : pendingPumpDeltaTExecution
          ? {
              label: "影子待审",
              hint: "已有泵温差降频影子审批单在审批队列中。",
              tone: "warn" as const
            }
          : approvedPumpDeltaTExecution
            ? {
                label: "影子已批",
                hint: "当前已有泵温差降频影子批准记录，继续观察验证窗口。",
                tone: "good" as const
              }
            : canSubmitPumpDeltaT
              ? {
                  label: "可提影子审批",
                  hint: "低温差降频条件成立，可提交影子评审单；当前不写 PLC。",
                  tone: "good" as const
                }
              : {
                  label: pumpDeltaTExecutionReady ? "影子观察" : "继续观察",
                  hint: preferLocaleValue(pumpDeltaTAdvisor?.reason, "等待低温差降频条件成立。"),
                  tone: pumpDeltaTExecutionReady ? "neutral" : "warn" as const
                };
  const chillerActionState = !responseReady
    ? {
        label: "等待建议",
        hint: "先生成完整评估，再判断主机组合是否可进入影子验证。",
        tone: "neutral" as const
      }
    : readOnlyMode
      ? {
          label: "只读",
          hint: "当前环境只允许审阅，主机组合建议不会进入执行链路。",
          tone: "warn" as const
        }
      : chillerBlockers.length
        ? {
            label: "被阻断",
            hint: chillerBlockers[0],
            tone: "warn" as const
          }
        : chillerStagingExecutionReady
          ? {
              label: "可创建影子单",
              hint: preferLocaleValue(
                chillerStagingAdvisor?.recommendation?.reason || chillerStagingAdvisor?.reason,
                "主机组合建议可进入影子验证；当前不做真实启停。"
              ),
              tone: "good" as const
            }
          : {
              label: "仅审阅",
              hint: preferLocaleValue(
                chillerStagingAdvisor?.reason,
                "缺少组合样本或安全边界，当前只保留方向性审阅。"
              ),
              tone: chillerStagingAdvisor?.status === "partial" ? "warn" as const : "neutral" as const
            };
  const chillerCandidates = Array.isArray(chillerStagingAdvisor?.candidates)
    ? chillerStagingAdvisor.candidates.slice(0, 4)
    : [];
  const chillerEvidence = chillerStagingAdvisor?.evidence || chillerStagingAdvisor?.sampleEvidence;
  const chillerSampleSummary = chillerEvidence?.sampleSummary;
  const chillerCurrentEvidence = chillerEvidence?.currentCombinationEvidence;
  const chillerTargetEvidence = chillerEvidence?.targetCombinationEvidence;
  const chillerCurrentLiveSample = chillerEvidence?.currentLiveSample;
  const chillerSampleCapture = chillerStagingAdvisor?.sampleCapture;
  const chillerSampleGovernance = chillerStagingAdvisor?.sampleGovernance;
  const chillerMissingCandidateCoverage = Array.isArray(chillerSampleGovernance?.missingCandidateCoverage)
    ? chillerSampleGovernance.missingCandidateCoverage.slice(0, 3)
    : [];
  const chillerVerification =
    chillerEvidence?.shadowVerificationPlan ||
    chillerStagingAdvisor?.savingsVerification ||
    chillerStagingAdvisor?.advisorResult?.savingsVerification;
  const operationalDiagnosticItems = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items
        .filter(
          (item) =>
            item?.key !== "instrumentDataQuality" &&
            item?.key !== "chilledHydraulicBalance" &&
            item?.key !== "controlOscillation"
        )
        .slice(0, 5)
    : [];
  const instrumentDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "instrumentDataQuality")
    : undefined;
  const hydraulicDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "chilledHydraulicBalance")
    : undefined;
  const controlOscillationDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "controlOscillation")
    : undefined;
  const lowDeltaTRootCauseDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "lowDeltaTRootCause")
    : undefined;
  const coolingTowerCapabilityDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "coolingTowerCapability")
    : undefined;
  const chillerHealthCombinationDiagnosticItem = Array.isArray(operationalDiagnosticsAdvisor?.items)
    ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "chillerHealthCombination")
    : undefined;
  const instrumentDiagnosticCurrent =
    instrumentDiagnosticItem?.current && typeof instrumentDiagnosticItem.current === "object"
      ? (instrumentDiagnosticItem.current as DraftInstrumentDiagnosticCurrent)
      : undefined;
  const hydraulicDiagnosticCurrent =
    hydraulicDiagnosticItem?.current && typeof hydraulicDiagnosticItem.current === "object"
      ? (hydraulicDiagnosticItem.current as DraftHydraulicDiagnosticCurrent)
      : undefined;
  const controlOscillationDiagnosticCurrent =
    controlOscillationDiagnosticItem?.current && typeof controlOscillationDiagnosticItem.current === "object"
      ? (controlOscillationDiagnosticItem.current as DraftControlOscillationDiagnosticCurrent)
      : undefined;
  const instrumentDriftCandidates = Array.isArray(instrumentDiagnosticCurrent?.driftCandidates)
    ? instrumentDiagnosticCurrent.driftCandidates.slice(0, 4)
    : [];
  const instrumentCrossChecks = Array.isArray(instrumentDiagnosticCurrent?.crossChecks)
    ? instrumentDiagnosticCurrent.crossChecks.slice(0, 4)
    : [];
  const instrumentFieldReviewTargets = Array.isArray(instrumentDiagnosticCurrent?.fieldReviewTargets)
    ? instrumentDiagnosticCurrent.fieldReviewTargets.slice(0, 3)
    : [];
  const instrumentSensorLedgerEvidence = instrumentDiagnosticCurrent?.sensorLedgerEvidence;
  const instrumentSensorLedgerStatus = instrumentSensorLedgerEvidence?.status || "unavailable";
  const instrumentSensorLedgerSummary =
    instrumentSensorLedgerEvidence?.readyForReview
      ? `${formatNumber(instrumentSensorLedgerEvidence.acceptedRows, 0)} 条可复核`
      : instrumentSensorLedgerStatus === "partial"
        ? `${formatNumber(instrumentSensorLedgerEvidence?.acceptedRows, 0)} 条 / 过期 ${formatNumber(
            instrumentSensorLedgerEvidence?.expiredCalibrationCount,
            0
          )} / 缺量程 ${formatNumber(instrumentSensorLedgerEvidence?.missingRangeCount, 0)}`
        : instrumentSensorLedgerStatus === "waiting"
          ? "等待传感器台账 CSV"
          : instrumentSensorLedgerStatus === "blocked"
            ? `${formatNumber(instrumentSensorLedgerEvidence?.blockersCount, 0)} 个阻断项`
            : "未接入台账";
  const instrumentReviewCandidateCount = instrumentDriftCandidates.filter((item) => item.status === "review").length;
  const instrumentNormalCheckCount = instrumentCrossChecks.filter((item) => item.status === "normal").length;
  const instrumentV1Summary =
    responseReady && instrumentDiagnosticCurrent
      ? `${formatNumber(instrumentReviewCandidateCount, 0)} 待复核 / ${formatNumber(instrumentNormalCheckCount, 0)} 正常`
      : zhCN.optimizeDemo.pendingValue;
  const instrumentSteadyStateSummary =
    instrumentDiagnosticCurrent?.driftWindow?.steadyState?.status === "ready"
      ? `稳态 ${formatNumber(instrumentDiagnosticCurrent.driftWindow.steadyState.sampleCount, 0)} 样本 / 波动 ${formatNumber(
          instrumentDiagnosticCurrent.driftWindow.steadyState.rangePct,
          1
        )}%`
      : preferLocaleValue(
          instrumentDiagnosticCurrent?.driftWindow?.steadyState?.reason,
          "稳态窗口不足，趋势审阅。"
        );
  const hydraulicRiskIndicators = Array.isArray(hydraulicDiagnosticCurrent?.riskIndicators)
    ? hydraulicDiagnosticCurrent.riskIndicators.slice(0, 5)
    : [];
  const hydraulicFieldReviewTargets = Array.isArray(hydraulicDiagnosticCurrent?.fieldReviewTargets)
    ? hydraulicDiagnosticCurrent.fieldReviewTargets.slice(0, 4)
    : [];
  const hydraulicActiveRiskCount =
    typeof hydraulicDiagnosticCurrent?.activeRiskCount === "number"
      ? hydraulicDiagnosticCurrent.activeRiskCount
      : hydraulicRiskIndicators.filter((item) => item.status === "active").length;
  const hydraulicGapCount =
    typeof hydraulicDiagnosticCurrent?.gapCount === "number"
      ? hydraulicDiagnosticCurrent.gapCount
      : hydraulicRiskIndicators.filter((item) => item.status === "gap" || item.status === "unknown").length;
  const hydraulicNormalCount = hydraulicRiskIndicators.filter((item) => item.status === "normal").length;
  const hydraulicV1Summary =
    responseReady && hydraulicDiagnosticCurrent
      ? `${formatNumber(hydraulicActiveRiskCount, 0)} 风险 / ${formatNumber(hydraulicGapCount, 0)} 缺口`
      : zhCN.optimizeDemo.pendingValue;
  const hydraulicTrendSummary =
    hydraulicDiagnosticCurrent?.trendWindow?.status === "ready"
      ? `均值 ${formatNumber(hydraulicDiagnosticCurrent.trendWindow.chilledDeltaT?.mean, 1)}℃ / 低温差 ${formatNumber(
          hydraulicDiagnosticCurrent.trendWindow.chilledDeltaT?.belowPct,
          0
        )}%`
      : preferLocaleValue(
          hydraulicDiagnosticCurrent?.trendWindow?.reason,
          "缺稳态趋势窗口，只做实时快照审阅。"
        );
  const controlOscillationRiskIndicators = Array.isArray(controlOscillationDiagnosticCurrent?.riskIndicators)
    ? controlOscillationDiagnosticCurrent.riskIndicators.slice(0, 5)
    : [];
  const controlOscillationFieldReviewTargets = Array.isArray(controlOscillationDiagnosticCurrent?.fieldReviewTargets)
    ? controlOscillationDiagnosticCurrent.fieldReviewTargets.slice(0, 4)
    : [];
  const controlOscillationActiveRiskCount =
    typeof controlOscillationDiagnosticCurrent?.activeRiskCount === "number"
      ? controlOscillationDiagnosticCurrent.activeRiskCount
      : controlOscillationRiskIndicators.filter((item) => item.status === "active").length;
  const controlOscillationWatchRiskCount =
    typeof controlOscillationDiagnosticCurrent?.watchRiskCount === "number"
      ? controlOscillationDiagnosticCurrent.watchRiskCount
      : controlOscillationRiskIndicators.filter((item) => item.status === "watch").length;
  const controlOscillationGapCount =
    typeof controlOscillationDiagnosticCurrent?.gapCount === "number"
      ? controlOscillationDiagnosticCurrent.gapCount
      : controlOscillationRiskIndicators.filter((item) => item.status === "gap" || item.status === "unknown").length;
  const controlOscillationNormalCount = controlOscillationRiskIndicators.filter((item) => item.status === "normal").length;
  const controlOscillationLedgerEvidence = controlOscillationDiagnosticCurrent?.ledgerEvidence;
  const controlOscillationLedgerStatus = controlOscillationLedgerEvidence?.status || "unavailable";
  const controlOscillationLedgerAcceptedRows =
    typeof controlOscillationLedgerEvidence?.acceptedRows === "number" ? controlOscillationLedgerEvidence.acceptedRows : null;
  const controlOscillationLedgerMode =
    controlOscillationLedgerEvidence?.evidenceMode === "field_export"
      ? "现场导出"
      : controlOscillationLedgerEvidence?.evidenceMode === "template_sample"
        ? "模板示例"
        : "未接入";
  const controlOscillationLedgerSummary =
    controlOscillationLedgerStatus === "ready"
      ? `${formatNumber(controlOscillationLedgerAcceptedRows, 0)} 行 / ${controlOscillationLedgerMode}`
      : controlOscillationLedgerStatus === "partial"
        ? `${formatNumber(controlOscillationLedgerAcceptedRows, 0)} 行 / 仅方向性复核`
        : controlOscillationLedgerStatus === "blocked"
          ? `${formatNumber(controlOscillationLedgerEvidence?.blockersCount, 0)} 阻断 / 不作证据`
          : "等待现场 CSV 导入";
  const controlOscillationFieldPreflight = controlOscillationLedgerEvidence?.preflight;
  const controlOscillationFieldPreflightStatus = controlOscillationFieldPreflight?.status || "unavailable";
  const controlOscillationFieldPreflightSummary =
    controlOscillationFieldPreflightStatus === "ready"
      ? `${formatNumber(controlOscillationFieldPreflight?.acceptedRows, 0)} 行可正式导入`
      : controlOscillationFieldPreflightStatus === "partial"
        ? `${formatNumber(controlOscillationFieldPreflight?.warningsCount, 0)} 警告 / 先复核`
        : controlOscillationFieldPreflightStatus === "waiting"
          ? `缺 ${formatNumber(controlOscillationFieldPreflight?.missingInputCount, 0)} 个 CSV`
          : controlOscillationFieldPreflightStatus === "blocked"
            ? `${formatNumber(controlOscillationFieldPreflight?.blockersCount, 0)} 阻断 / 修正格式`
            : "未接入预检报告";
  const controlOscillationFieldPromotion = controlOscillationLedgerEvidence?.promotion;
  const controlOscillationFieldPromotionStatus = controlOscillationFieldPromotion?.status || "unavailable";
  const controlOscillationFieldPromotionSummary =
    controlOscillationFieldPromotionStatus === "ready"
      ? `${formatNumber(controlOscillationFieldPromotion?.acceptedRows, 0)} 行已正式导入`
      : controlOscillationFieldPromotionStatus === "partial"
        ? `${formatNumber(controlOscillationFieldPromotion?.warningsCount, 0)} 警告 / 先复核`
        : controlOscillationFieldPromotionStatus === "waiting"
          ? "等待预检 READY"
          : controlOscillationFieldPromotionStatus === "blocked"
            ? `${formatNumber(controlOscillationFieldPromotion?.blockersCount, 0)} 阻断 / 不导入`
            : "未接入导入 gate";
  const controlOscillationV1Summary =
    responseReady && controlOscillationDiagnosticCurrent
      ? `${formatNumber(controlOscillationActiveRiskCount, 0)} 风险 / ${formatNumber(controlOscillationGapCount, 0)} 缺口`
      : zhCN.optimizeDemo.pendingValue;
  const controlOscillationTrendSummary =
    controlOscillationDiagnosticCurrent?.trendWindow?.status === "active" ||
    controlOscillationDiagnosticCurrent?.trendWindow?.status === "watch" ||
    controlOscillationDiagnosticCurrent?.trendWindow?.status === "normal"
      ? `样本 ${formatNumber(controlOscillationDiagnosticCurrent.trendWindow.sampleCount, 0)} / 最大反转 ${formatNumber(
          controlOscillationDiagnosticCurrent.trendWindow.maxDirectionChangeCount,
          0
        )} 次`
      : preferLocaleValue(
          controlOscillationDiagnosticCurrent?.trendWindow?.reason,
          "缺高频趋势，先做点位复核。"
        );
  const operationalDiagnosticSummary = operationalDiagnosticsAdvisor?.summary;
  const diagnosticReadinessMatrix = operationalDiagnosticSummary?.diagnosticReadinessMatrix;
  const diagnosticReadinessItems = Array.isArray(diagnosticReadinessMatrix?.items)
    ? diagnosticReadinessMatrix.items.slice(0, 10)
    : [];
  const fieldVerificationChecklist = operationalDiagnosticSummary?.fieldVerificationChecklist;
  const fieldVerificationTasks = Array.isArray(fieldVerificationChecklist?.items)
    ? fieldVerificationChecklist.items.slice(0, 6)
    : [];
  const fieldVerificationSummary =
    responseReady && fieldVerificationChecklist
      ? `${formatNumber(fieldVerificationChecklist.p0Count, 0)} P0 / ${formatNumber(
          fieldVerificationChecklist.p1Count,
          0
        )} P1`
      : zhCN.optimizeDemo.pendingValue;
  const fieldCollectionPackageEvidence = operationalDiagnosticSummary?.fieldCollectionPackageEvidence;
  const fieldCollectionPackageStatus =
    responseReady && fieldCollectionPackageEvidence
      ? fieldCollectionPackageEvidence.finalDecision || fieldCollectionPackageEvidence.status || zhCN.optimizeDemo.pendingValue
      : zhCN.optimizeDemo.pendingValue;
  const fieldCollectionFormalInputSummary =
    responseReady && fieldCollectionPackageEvidence
      ? `${formatNumber(fieldCollectionPackageEvidence.presentFormalInputCount, 0)} 已投放 / ${formatNumber(
          fieldCollectionPackageEvidence.missingFormalInputCount,
          0
        )} 未投放`
      : zhCN.optimizeDemo.pendingValue;
  const fieldCollectionFormalInputs = responseReady && Array.isArray(fieldCollectionPackageEvidence?.formalInputs)
    ? fieldCollectionPackageEvidence.formalInputs.slice(0, 6)
    : [];
  const diagnosticReadinessSummary =
    responseReady && diagnosticReadinessMatrix
      ? `${formatNumber(diagnosticReadinessMatrix.readyNowCount, 0)} 可做 / ${formatNumber(
          diagnosticReadinessMatrix.directionalCount,
          0
        )} 疑似 / ${formatNumber(diagnosticReadinessMatrix.pointGapCount, 0)} 补点`
      : zhCN.optimizeDemo.pendingValue;
  const clientDemoReadinessRows = [
    {
      label: "演示 readiness",
      value: "CLIENT_DEMO_READY_SHADOW_PENDING",
      note: "甲方演示前一键 gate"
    },
    {
      label: "诊断矩阵",
      value: diagnosticReadinessSummary,
      note: "A档可做；B/C档保留边界"
    },
    {
      label: "现场采集包",
      value: fieldCollectionPackageStatus,
      note: "只证明采集包可发现场"
    },
    {
      label: "正式 CSV",
      value: fieldCollectionFormalInputSummary,
      note: "未投放不阻断 shadow 演示"
    },
    {
      label: "页面 smoke",
      value: "UI_DIAGNOSTIC_READINESS_READY",
      note: "登录态页面已验证"
    },
    {
      label: "控制副作用",
      value: "NO_CONTROL_MUTATION",
      note: "不提交、不审批、不回退"
    },
    {
      label: "执行范围",
      value: "read-only / shadow",
      note: "无真实启停，无真实 PLC 写入"
    }
  ];
  const operationalDiagnosticStatusLabel = localizeOperationalDiagnosticStatus(operationalDiagnosticsAdvisor?.status);
  const operationalDiagnosticModeLabel = localizeOperationalDiagnosticMode(operationalDiagnosticsAdvisor?.executionMode);
  const operationalDiagnosticPointCount = operationalDiagnosticSummary?.pointCoverage?.registerPoints;
  const operationalDiagnosticReadySummary = responseReady
    ? `${formatNumber(operationalDiagnosticSummary?.readyCount, 0)}可用 / ${formatNumber(
        operationalDiagnosticSummary?.partialCount,
        0
      )}降级`
    : zhCN.optimizeDemo.pendingValue;
  const operationalDiagnosticCoverageSummary = responseReady
    ? `${formatNumber(operationalDiagnosticPointCount, 0)}点 / ${formatNumber(
        operationalDiagnosticSummary?.pointCoverage?.deviceRows,
        0
      )}设备`
    : zhCN.optimizeDemo.pendingValue;
  const operationalDiagnosticPointDictionaryApplied =
    operationalDiagnosticSummary?.pointDictionary?.applied === true;
  const operationalDiagnosticPointDictionaryLabel = responseReady
    ? operationalDiagnosticPointDictionaryApplied
      ? "站点字典已应用"
      : "通用关键词识别"
    : zhCN.optimizeDemo.pendingValue;
  const operationalDiagnosticTowerSummary = responseReady
    ? `${formatNumber(operationalDiagnosticSummary?.pointCoverage?.runningCoolingTowerCount, 0)} / ${formatNumber(
        operationalDiagnosticSummary?.pointCoverage?.coolingTowerCount,
        0
      )}组`
    : zhCN.optimizeDemo.pendingValue;
  const operationalDiagnosticTowerFanSummary = responseReady
    ? `${formatNumber(operationalDiagnosticSummary?.pointCoverage?.runningCoolingTowerFanCount, 0)} / ${formatNumber(
        operationalDiagnosticSummary?.pointCoverage?.coolingTowerFanCount,
        0
      )}台`
    : zhCN.optimizeDemo.pendingValue;
  const diagnosticSpotlightCards = [
    {
      key: "instrument-data-quality",
      title: "仪表数据偏移",
      statusLabel: instrumentDiagnosticItem
        ? localizeOperationalDiagnosticStatus(instrumentDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: instrumentV1Summary,
      summary: instrumentSteadyStateSummary,
      evidence:
        instrumentDriftCandidates[0]?.reason ||
        instrumentCrossChecks[0]?.evidence ||
        "基于 COP、功率、温差和稳态窗口做交叉校验。",
      boundary: "不判定仪表故障，不自动修正测点。",
      tone:
        instrumentReviewCandidateCount > 0
          ? "warn"
          : mapBenchmarkTone(instrumentDiagnosticItem?.status)
    },
    {
      key: "hydraulic-balance",
      title: "水力平衡",
      statusLabel: hydraulicDiagnosticItem
        ? localizeOperationalDiagnosticStatus(hydraulicDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: hydraulicV1Summary,
      summary: hydraulicTrendSummary,
      evidence:
        hydraulicRiskIndicators[0]?.reason ||
        "结合冷冻水温差、支路线索、旁通和末端安全信号复核。",
      boundary: "不自动降泵，不直接判定末端阀门故障。",
      tone:
        hydraulicActiveRiskCount > 0 || hydraulicGapCount > 0
          ? "warn"
          : mapBenchmarkTone(hydraulicDiagnosticItem?.status)
    },
    {
      key: "control-oscillation",
      title: "控制震荡",
      statusLabel: controlOscillationDiagnosticItem
        ? localizeOperationalDiagnosticStatus(controlOscillationDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: controlOscillationV1Summary,
      summary: controlOscillationTrendSummary,
      evidence:
        controlOscillationRiskIndicators[0]?.reason ||
        `${controlOscillationLedgerSummary}；${controlOscillationFieldPreflightSummary}`,
      boundary: "不自动改 PID，不自动启停设备。",
      tone:
        controlOscillationActiveRiskCount > 0 || controlOscillationGapCount > 0
          ? "warn"
          : mapBenchmarkTone(controlOscillationDiagnosticItem?.status)
    },
    {
      key: "low-delta-t-root-cause",
      title: "低温差根因",
      statusLabel: lowDeltaTRootCauseDiagnosticItem
        ? localizeOperationalDiagnosticStatus(lowDeltaTRootCauseDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: localizeOperationalDiagnosticStatus(lowDeltaTRootCauseDiagnosticItem?.status),
      summary: lowDeltaTRootCauseDiagnosticItem
        ? summarizeOperationalDiagnosticItem(lowDeltaTRootCauseDiagnosticItem)
        : "等待低温差趋势和泵频证据。",
      evidence:
        lowDeltaTRootCauseDiagnosticItem?.findings?.[0] ||
        lowDeltaTRootCauseDiagnosticItem?.warnings?.[0] ||
        "持续低温差、大流量小温差、旁通和末端安全缺口排序。",
      boundary: "只输出根因候选和验证动作，不直接下控制结论。",
      tone: mapBenchmarkTone(lowDeltaTRootCauseDiagnosticItem?.status)
    },
    {
      key: "cooling-tower-capability",
      title: "冷却塔能力",
      statusLabel: coolingTowerCapabilityDiagnosticItem
        ? localizeOperationalDiagnosticStatus(coolingTowerCapabilityDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: localizeOperationalDiagnosticStatus(coolingTowerCapabilityDiagnosticItem?.status),
      summary: coolingTowerCapabilityDiagnosticItem
        ? summarizeOperationalDiagnosticItem(coolingTowerCapabilityDiagnosticItem)
        : "等待湿球、冷却水出水和塔风机证据。",
      evidence:
        coolingTowerCapabilityDiagnosticItem?.findings?.[0] ||
        coolingTowerCapabilityDiagnosticItem?.warnings?.[0] ||
        "复核湿球、逼近度、塔风机和塔单元运行一致性。",
      boundary: "只做塔能力体检和影子证据，不直接改塔风机。",
      tone: mapBenchmarkTone(coolingTowerCapabilityDiagnosticItem?.status)
    },
    {
      key: "chiller-health-combination",
      title: "主机健康/组合样本",
      statusLabel: chillerHealthCombinationDiagnosticItem
        ? localizeOperationalDiagnosticStatus(chillerHealthCombinationDiagnosticItem.status)
        : zhCN.optimizeDemo.pendingValue,
      value: localizeOperationalDiagnosticStatus(chillerHealthCombinationDiagnosticItem?.status),
      summary: chillerHealthCombinationDiagnosticItem
        ? summarizeOperationalDiagnosticItem(chillerHealthCombinationDiagnosticItem)
        : "等待组合样本和主机功率证据。",
      evidence:
        chillerHealthCombinationDiagnosticItem?.findings?.[0] ||
        chillerHealthCombinationDiagnosticItem?.warnings?.[0] ||
        "多机无单台流量时只评价组合 COP / 冷站 COP。",
      boundary: "不计算多机单台 COP，不自动启停主机。",
      tone: mapBenchmarkTone(chillerHealthCombinationDiagnosticItem?.status)
    }
  ] as const;
  const approachDecisionState = !responseReady
    ? {
        label: "待生成",
        headline: "先生成接近度目标值",
        summary: "当前还没有 AI 目标值，先确认负荷和湿球输入。",
        boundary: "只允许生成建议，不创建执行单。",
        tone: "neutral" as const
      }
    : readOnlyMode
      ? {
          label: "只读",
          headline: "当前仅允许审阅",
          summary: "可以核对目标值、数据质量和历史记录，但不能写入影子记录或真实下发。",
          boundary: "执行按钮受只读模式锁定。",
          tone: "warn" as const
        }
      : towerBlockers.length
        ? {
            label: "被阻断",
            headline: "不允许进入执行队列",
            summary: towerBlockers[0],
            boundary: "先补齐阻塞信号或处理保护边界。",
            tone: "warn" as const
          }
        : pendingTowerApproachExecution
          ? {
              label: "待审批",
              headline: "已有接近度执行单待审批",
              summary: "先处理当前执行单，不重复创建目标。",
              boundary: "审批后只生成影子记录，真实 PLC 仍锁定。",
              tone: "warn" as const
            }
          : approvedTowerApproachExecution
            ? {
                label: "历史已批",
                headline: "已有历史接近度影子单",
                summary: "这是历史批准记录，复核本次工况后再决定是否回退记录。",
                boundary: "当前只处理影子记录，真实 PLC 下发锁定。",
                tone: "good" as const
              }
            : canSubmitTowerApproach
              ? {
                  label: "可提交",
                  headline: "接近度目标值可进入审批",
                  summary: preferLocaleValue(towerApproachAdvisor?.reason, "目标值已生成。"),
                  boundary: pageModeHint,
                  tone: "good" as const
                }
              : {
                  label: towerApproachExecutionReady ? "可评审" : "继续观察",
                  headline: towerApproachExecutionReady ? "目标值可评审" : "缺少进入执行的前提",
                  summary: preferLocaleValue(towerApproachAdvisor?.reason, zhCN.optimizeDemo.towerApproachPending),
                  boundary: towerApproachExecutionReady ? pageModeHint : "当前只保留建议，不创建影子记录。",
                  tone: towerApproachExecutionReady ? "neutral" as const : "warn" as const
                };
  const nextAction = !responseReady
    ? {
        label: "生成AI建议",
        hint: "先固定当前负荷和湿球，生成接近度/冷却水出水温目标。",
        tone: "neutral" as const
      }
    : canSubmitTowerApproach
      ? {
                  label: "提交接近度审批",
          hint: towerActionState.hint,
          tone: "good" as const
        }
      : canApproveTowerApproach
        ? {
            label: "处理接近度审批",
            hint: "接近度目标已进入审批队列，先处理当前治理动作。",
            tone: "warn" as const
          }
        : canRollbackTowerApproach
          ? {
              label: "复核历史影子单",
              hint: "当前已有历史批准记录，复核本次工况后再决定是否回退记录。",
              tone: "warn" as const
            }
          : readOnlyMode
            ? {
                label: "继续审阅",
                hint: "当前环境只读，先核对目标值、边界和历史记录。",
                tone: "warn" as const
              }
            : towerBlockers.length
              ? {
                  label: "先处理阻塞",
                  hint: towerBlockers[0],
                  tone: "warn" as const
                }
              : {
                  label: "继续观察",
                  hint: approachDecisionState.boundary,
                  tone: "neutral" as const
                };
  const approachTargetSummary = responseReady
    ? `${formatTemperature(towerApproachAdvisor?.targetApproachC)} / ${formatTemperature(towerApproachAdvisor?.targetTcwsC)}`
    : zhCN.optimizeDemo.pendingValue;
  const approachTargetResultSummary =
    responseReady &&
    typeof towerApproachAdvisor?.targetApproachC === "number" &&
    typeof towerApproachAdvisor?.targetTcwsC === "number"
      ? approachTargetSummary
      : responseReady
        ? "目标待生成"
        : "待生成";
  const pumpTrimSummary = responseReady
    ? `冷冻泵修正 ${formatTrimHz(pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz)} / 冷却泵修正 ${formatTrimHz(
        pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz
      )}`
    : zhCN.optimizeDemo.pendingValue;
  const pumpTrimResultSummary = responseReady
    ? `${formatTrimHzCompactValue(pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz)}/${formatTrimHzCompactValue(
        pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz
      )} Hz`
    : "待生成";
  const chillerTargetSummary = responseReady
    ? formatChillerCombination(chillerStagingAdvisor?.recommendation?.targetCombination)
    : zhCN.optimizeDemo.pendingValue;
  const chillerTargetResultSummary = responseReady ? chillerTargetSummary.replace(/\s*\+\s*/g, "+") : "待生成";
  const towerApproachMaxStepC =
    typeof towerApproachAdvisor?.outputTargets?.maxStepC === "number" ? towerApproachAdvisor.outputTargets.maxStepC : 0.5;
  const towerApproachMultiStepPlan = towerApproachAdvisor?.outputTargets?.multiStepPlan;
  const towerApproachSafetySummary =
    towerApproachMultiStepPlan?.required === true && typeof towerApproachMultiStepPlan.stepCount === "number"
      ? `多步 ${formatNumber(towerApproachMultiStepPlan.stepCount, 0)} 步 · 本次 ${formatTemperature(
          towerApproachMultiStepPlan.nextStepTargetTcwsC
        )} · 最终 ${formatTemperature(towerApproachMultiStepPlan.finalTargetTcwsC)}`
      : `限幅 ${formatNumber(towerApproachMaxStepC, 1)}℃/步 · 仅影子验证`;
  const rollbackTriggerSummary = "COP下降、出水越限、告警升级或设备切本地";
  const pumpTrimSafetySummary = formatPumpTrimWindow(pumpDeltaTAdvisor);
  const optimizeCommandTags = [
    { label: localeText("治理态", "Mode", "Chế độ"), value: pageModeLabel },
    { label: localeText("本次建议", "Advice", "Khuyến nghị"), value: requestStatusLabel },
    { label: localeText("首要动作", "Primary Action", "Hành động chính"), value: nextAction.label }
  ];
  const optimizeResultBlockerSummary = compactBlockers[0]?.includes("缺运行主机总功率")
    ? "缺主机功率，COP待核"
    : compactBlockers[0] || null;
  const optimizeDecisionResult = !responseReady
    ? {
        value: "待生成",
        note: "先生成AI建议",
        body: "生成后显示执行结论、建议目标、预计功率变化和安全边界。",
        tone: "neutral" as const
      }
    : compactBlockers.length
      ? {
          value: "暂不执行",
          note: optimizeResultBlockerSummary || "阻塞待处理",
          body: `结论：暂不进入执行队列。原因：${compactBlockers[0]}`,
          tone: "warn" as const
        }
      : readOnlyMode
        ? {
            value: "仅影子审阅",
            note: "真实PLC锁定",
            body: "结论：本次仅输出目标值和收益估算，不创建审批单，不下发PLC。",
            tone: "warn" as const
          }
        : canSubmitTowerApproach
          ? {
              value: "可提审批",
              note: "接近度目标满足准入",
              body: "结论：目标值可提交影子审批，真实PLC仍由保护边界锁定。",
              tone: "good" as const
            }
          : canApproveTowerApproach
            ? {
                value: "待人工审批",
                note: "处理现有审批单",
                body: "结论：已有目标进入审批队列，先处理当前影子审批。",
                tone: "warn" as const
              }
            : canRollbackTowerApproach
              ? {
                  value: "复核影子单",
                  note: "历史记录已批准",
                  body: "结论：已有历史批准记录，先复核现态和回退边界。",
                  tone: "warn" as const
                }
              : {
                  value: nextAction.label,
                  note: "仅允许影子审批",
                  body: `结论：${nextAction.label}。目标值仅进入影子审批，真实PLC仍锁定。`,
                  tone: nextAction.tone
                };
  const optimizeWorkspaceLabel = responseReady ? "控制边界" : "生成状态";
  const optimizeWorkspaceHeadline = responseReady
    ? optimizeDecisionResult.value === "暂不执行"
      ? "边界锁定"
      : readOnlyMode
        ? "只读审阅"
        : "影子待审批"
    : "待生成建议";
  const optimizeWorkspaceBody = responseReady
    ? optimizeDecisionResult.value === "暂不执行"
      ? "保留诊断结论，不进入执行队列。"
      : "建议值进入影子流程，真实PLC保持锁定。"
    : optimizeDecisionResult.body;
  const optimizeWorkspaceMeta = [
    `${localeText(responseReady ? "本次生成" : "待生成", responseReady ? "Generated" : "Pending", responseReady ? "Da tao" : "Cho tao")} ${requestDelta}`,
    `${localeText("数据", "Signals", "Tín hiệu")} ${signalQualityLabel}`,
    `主机 ${chillerTargetSummary}`,
    `接近度 ${approachTargetSummary}`,
    `泵 ${pumpTrimSummary}`
  ];
  const benefitPowerDeltaKw =
    responseReady && typeof benefitEstimate?.expectedPowerDeltaKw === "number"
      ? benefitEstimate.expectedPowerDeltaKw
      : null;
  const benefitPowerDeltaIsSaving = typeof benefitPowerDeltaKw === "number" && benefitPowerDeltaKw < 0;
  const benefitPowerDeltaIsIncrease = typeof benefitPowerDeltaKw === "number" && benefitPowerDeltaKw > 0;
  const benefitPowerDeltaSummary =
    typeof benefitPowerDeltaKw === "number"
      ? `${formatNumber(benefitPowerDeltaIsSaving ? Math.abs(benefitPowerDeltaKw) : benefitPowerDeltaKw)} kW`
      : responseReady
        ? zhCN.optimizeDemo.pendingValue
        : "待生成";
  const benefitPowerDeltaLabel =
    benefitPowerDeltaIsSaving
      ? "对标节电空间"
      : benefitPowerDeltaIsIncrease
        ? "对标增耗风险"
        : "对标功率变化";
  const benefitRateSummary = responseReady
    ? formatFlexiblePercent(benefitEstimate?.expectedPowerDeltaPct)
    : zhCN.optimizeDemo.pendingValue;
  const benefitRateMagnitudeSummary =
    responseReady && typeof benefitEstimate?.expectedPowerDeltaPct === "number"
      ? formatFlexiblePercent(Math.abs(benefitEstimate.expectedPowerDeltaPct)).replace(/^\+/, "")
      : zhCN.optimizeDemo.pendingValue;
  const benefitResultTone =
    responseReady && typeof benefitEstimate?.expectedPowerDeltaKw === "number"
      ? benefitEstimate.expectedPowerDeltaKw < 0
        ? benefitEstimate.confidence === "high"
          ? "good"
          : "warn"
        : benefitEstimate.expectedPowerDeltaKw > 0
          ? "danger"
          : "neutral"
      : mapConfidenceTone(benefitEstimate?.confidence);
  const benefitResultConfidenceLabel = benefitEstimateConfidenceLabel.replace(/[：:].*$/, "");
  const benefitResultNote = responseReady
    ? typeof benefitEstimate?.expectedPowerDeltaPct === "number"
      ? benefitPowerDeltaIsSaving
        ? `对标节电率 ${benefitRateMagnitudeSummary} · ${benefitResultConfidenceLabel}`
        : benefitPowerDeltaIsIncrease
          ? `对标增耗率 ${benefitRateSummary} · ${benefitResultConfidenceLabel}`
          : `${benefitRateSummary} · ${benefitResultConfidenceLabel}`
      : benefitResultConfidenceLabel
    : "待计算收益";
  const approachTargetResultValue =
    responseReady && typeof towerApproachAdvisor?.targetTcwsC === "number"
      ? `冷却水 ${formatTemperature(towerApproachAdvisor.targetTcwsC)}`
      : approachTargetResultSummary;
  const approachTargetResultNote =
    responseReady && typeof towerApproachAdvisor?.targetApproachC === "number"
      ? `接近度 ${formatTemperature(towerApproachAdvisor.targetApproachC)} · ${towerActionState.label}`
      : towerActionState.label;
  const pumpTrimResultValue =
    responseReady && typeof pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz === "number"
      ? `冷冻 ${formatTrimHzCompactValue(pumpDeltaTAdvisor.outputTargets.chilledPumpFreqTrimHz)} Hz`
      : pumpTrimResultSummary;
  const pumpTrimResultNote =
    responseReady && typeof pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz === "number"
      ? `冷却 ${formatTrimHzCompactValue(pumpDeltaTAdvisor.outputTargets.coolingPumpFreqTrimHz)} Hz · ${pumpActionState.label}`
      : pumpActionState.label;
  const optimizeResultCards = [
    {
      label: "本次优化结论",
      value: optimizeDecisionResult.value,
      note: optimizeDecisionResult.note,
      tone: optimizeDecisionResult.tone,
      emphasis: "primary" as const
    },
    {
      label: benefitPowerDeltaLabel,
      value: benefitPowerDeltaSummary,
      note: benefitResultNote,
      tone: benefitResultTone,
      emphasis: "benefit" as const
    },
    {
      label: "冷机组合",
      value: chillerTargetResultSummary,
      note: chillerActionState.label,
      tone: chillerActionState.tone
    },
    {
      label: "冷却水目标",
      value: approachTargetResultValue,
      note: approachTargetResultNote,
      tone: towerActionState.tone
    },
    {
      label: "泵频修正",
      value: pumpTrimResultValue,
      note: pumpTrimResultNote,
      tone: pumpActionState.tone
    }
  ];
  const benefitSampleSummary = responseReady
    ? formatNumber(historyBenchmark?.sampleCount, 0)
    : zhCN.optimizeDemo.pendingValue;
  const benefitVerificationWindowSummary = responseReady
    ? formatMinuteRange(chillerVerification?.durationMinutes)
    : zhCN.optimizeDemo.pendingValue;
  const benefitMatchingTierSummary = responseReady
    ? localizeHistoryBenchmarkMatchingTier(benefitEstimate?.basis?.matchingTier || historyBenchmark?.matchingTier)
    : zhCN.optimizeDemo.pendingValue;
  const benefitConfidenceCompactSummary = responseReady
    ? benefitResultConfidenceLabel
    : OPTIMIZE_COMPACT_PENDING_VALUE;
  const chillerSampleTotalSummary = responseReady
    ? `${formatNumber(chillerSampleSummary?.sampleTotal, 0)} / 需30`
    : zhCN.optimizeDemo.pendingValue;
  const chillerCurrentCombinationSummary = formatChillerCombination(chillerStagingAdvisor?.current?.runningCombination);
  const chillerTargetCombinationSummary = formatChillerCombination(chillerStagingAdvisor?.recommendation?.targetCombination);
  const shadowVerificationTargetSummary =
    chillerTargetCombinationSummary === zhCN.optimizeDemo.pendingValue
      ? chillerCurrentCombinationSummary
      : chillerTargetCombinationSummary;
  const chillerSampleActionSummary = chillerBlockers.length ? "继续采样" : localizeChillerStagingAction(chillerStagingAdvisor?.recommendation?.action);
  const chillerSampleGovernanceLabel = localizeChillerSampleGovernanceStatus(chillerSampleGovernance?.status);
  const chillerSampleGovernanceTone = mapChillerSampleGovernanceTone(chillerSampleGovernance?.status);
  const chillerSampleGovernanceSummary = preferLocaleValue(
    chillerSampleGovernance?.summary,
    "等待组合样本覆盖检查。"
  );
  const chillerCompareReadySummary = `${formatNumber(chillerSampleGovernance?.sameBandReadyCandidateCount, 0)} 可比 / ${formatNumber(
    chillerSampleGovernance?.coveredCandidateCount,
    0
  )} 已覆盖`;
  const shadowVerificationMetrics = Array.isArray(chillerVerification?.metrics) && chillerVerification.metrics.length
    ? chillerVerification.metrics
    : ["stationCop", "comboCop", "kwPerRt", "stationPowerTotalKw", "chillerPowerTotalKw", "alarmCount"];
  const shadowVerificationMetricSummary = shadowVerificationMetrics
    .map((metric) => localizeShadowVerificationMetric(metric))
    .join(" / ");
  const shadowVerificationWindowSummary =
    responseReady && benefitVerificationWindowSummary !== zhCN.optimizeDemo.pendingValue
      ? benefitVerificationWindowSummary
      : responseReady
        ? "30-60 min"
        : zhCN.optimizeDemo.pendingValue;
  const shadowVerificationObjectSummary = responseReady
    ? `${chillerCurrentCombinationSummary} -> ${shadowVerificationTargetSummary}`
    : zhCN.optimizeDemo.pendingValue;
  const shadowVerificationRecordStatus = responseReady
    ? preferLocaleValue(chillerEvidence?.shadowVerificationPlan?.resultRecording?.status, "待人工记录")
    : zhCN.optimizeDemo.pendingValue;
  const shadowVerificationRecordNote = responseReady
    ? preferLocaleValue(
        chillerEvidence?.shadowVerificationPlan?.resultRecording?.note,
        "只记录人工审阅后的观察窗口，不自动生成节能承诺。"
      )
    : zhCN.optimizeDemo.pendingValue;
  const shadowVerificationRows = [
    {
      label: "验证对象",
      value: shadowVerificationObjectSummary,
      note: "主机组合 shadow 验证"
    },
    {
      label: "观察窗口",
      value: shadowVerificationWindowSummary,
      note: "同负荷/湿球 band"
    },
    {
      label: "对比口径",
      value: localizeShadowVerificationMethod(chillerVerification?.method),
      note: "shadow_compare_30_60min_same_load_wet_bulb_band"
    },
    {
      label: "验证指标",
      value: shadowVerificationMetricSummary,
      note: "不拆多机单台 COP"
    },
    {
      label: "记录状态",
      value: shadowVerificationRecordStatus,
      note: shadowVerificationRecordNote
    },
    {
      label: "结论边界",
      value: preferLocaleValue(chillerVerification?.acceptance, "只作为同工况 shadow 对比，不作为固定节能承诺。"),
      note: "人工确认后再归档"
    },
    {
      label: "节能承诺",
      value: "不作为固定节能承诺",
      note: "真实收益以人工记录和审计报表为准"
    }
  ];
  const displayShadowVerificationRecords = shadowVerificationRecords.map(normalizeShadowVerificationRecordForDisplay);
  const shadowVerificationHasMetricIssues = displayShadowVerificationRecords.some((record) => record.invalidReason);
  const recentShadowVerificationRecords = displayShadowVerificationRecords.slice(0, 3);
  const effectiveShadowVerificationSummary =
    shadowVerificationHasMetricIssues
      ? buildFallbackShadowVerificationSummary(displayShadowVerificationRecords)
      : shadowVerificationSummary || buildFallbackShadowVerificationSummary(displayShadowVerificationRecords);
  const shadowReviewArchive =
    shadowVerificationExecutionFilter !== "all" ? effectiveShadowVerificationSummary.archive : null;
  const shadowReviewChecksumLabel = shadowReviewArchive?.checksumShort
    ? `${(shadowReviewArchive.checksumAlgorithm || "sha256").toUpperCase()} ${shadowReviewArchive.checksumShort}`
    : shadowVerificationExecutionFilter === "all"
      ? "未选择执行单"
      : "待生成";
  const shadowReviewReportIdLabel =
    shadowReviewArchive?.reportId || (shadowVerificationExecutionFilter === "all" ? "请选择单个执行单" : "导出报告内置");
  const shadowVerificationExecutionOptions = (() => {
    const options = new Map<string, { value: string; label: string; note: string }>();
    options.set("all", {
      value: "all",
      label: "全部执行单",
      note: "全局只读统计"
    });
    const addOption = (executionId: string | null | undefined, type: string | null | undefined, note: string) => {
      const normalized = typeof executionId === "string" ? executionId.trim() : "";
      if (!normalized || options.has(normalized)) {
        return;
      }
      const normalizedType = typeof type === "string" ? type : undefined;
      const typeLabel =
        normalizedType === "chiller-staging" || normalizedType === "tower-approach" || normalizedType === "pump-delta-t"
          ? localizeShadowVerificationType(normalizedType)
          : localizeExecutionType(normalizedType);
      options.set(normalized, {
        value: normalized,
        label: `${typeLabel} · ${compactShadowExecutionId(normalized)}`,
        note
      });
    };
    for (const execution of executions) {
      addOption(execution.executionId, execution.execution?.type, "执行单");
    }
    for (const record of displayShadowVerificationRecords) {
      addOption(record.executionId, record.verificationType, "验证记录");
    }
    if (shadowVerificationExecutionFilter !== "all" && !options.has(shadowVerificationExecutionFilter)) {
      addOption(shadowVerificationExecutionFilter, undefined, "当前下钻");
    }
    return Array.from(options.values());
  })();
  const selectedShadowVerificationExecutionLabel =
    shadowVerificationExecutionFilter === "all"
      ? "全部执行单"
      : compactShadowExecutionId(shadowVerificationExecutionFilter);
  const selectedShadowVerificationRecords =
    shadowVerificationExecutionFilter === "all"
      ? []
      : displayShadowVerificationRecords.filter((record) => record.executionId === shadowVerificationExecutionFilter);
  const selectedShadowVerificationLatestReview =
    selectedShadowVerificationRecords.find((record) => record.outcome && record.outcome !== "pending") || null;
  const selectedShadowVerificationLatestRecord =
    selectedShadowVerificationLatestReview || selectedShadowVerificationRecords[0] || null;
  const selectedShadowVerificationTypeLabels = Array.from(
    new Set(
      selectedShadowVerificationRecords
        .map((record) => localizeShadowVerificationType(record.verificationType))
        .filter((value) => value && value !== "未知类型")
    )
  );
  const singleShadowReviewStatus =
    shadowVerificationExecutionFilter === "all"
      ? "未选择执行单"
      : shadowVerificationLoading
        ? "加载中"
        : !selectedShadowVerificationRecords.length
          ? "暂无记录"
          : effectiveShadowVerificationSummary.regressedCount
            ? "需复盘"
            : effectiveShadowVerificationSummary.invalidCount && !effectiveShadowVerificationSummary.comparableCount
              ? "样本无效"
              : selectedShadowVerificationLatestReview
                ? localizeShadowVerificationOutcome(selectedShadowVerificationLatestReview.outcome)
                : "待观察";
  const singleShadowReviewRows = [
    {
      label: "执行单",
      value: selectedShadowVerificationExecutionLabel,
      note: shadowVerificationExecutionFilter === "all" ? "请选择单个执行单" : "单次 shadow 复盘"
    },
    {
      label: "复盘状态",
      value: singleShadowReviewStatus,
      note: "只读汇总"
    },
    {
      label: "报告校验",
      value: shadowReviewChecksumLabel,
      note: shadowReviewReportIdLabel
    },
    {
      label: "Advisor",
      value: selectedShadowVerificationTypeLabels.length
        ? selectedShadowVerificationTypeLabels.join(" / ")
        : zhCN.optimizeDemo.pendingValue,
      note: "按当前下钻记录识别"
    },
    {
      label: "记录范围",
      value:
        shadowVerificationExecutionFilter === "all"
          ? "未下钻"
          : `${formatNumber(effectiveShadowVerificationSummary.sampledCount, 0)} 条`,
      note: `${formatNumber(effectiveShadowVerificationSummary.reviewedCount, 0)} 已复核 / ${formatNumber(
        effectiveShadowVerificationSummary.pendingCount,
        0
      )} 待观察`
    },
    {
      label: "关键指标",
      value: formatShadowVerificationKeyMetrics(selectedShadowVerificationLatestRecord),
      note: selectedShadowVerificationLatestRecord
        ? `负荷 ${formatNumber(selectedShadowVerificationLatestRecord.metrics?.loadKw, 0)}kW / 湿球 ${formatNumber(
            selectedShadowVerificationLatestRecord.metrics?.wetBulbC,
            1
          )}℃`
        : "等待人工记录"
    },
    {
      label: "导出范围",
      value: shadowVerificationExecutionFilter === "all" ? "全部筛选记录" : "当前执行单 CSV",
      note: "不改执行单"
    },
    {
      label: "审计边界",
      value: "append-only / 不承诺节能",
      note: "不审批、不 dispatch、不 rollback"
    },
    {
      label: "控制副作用",
      value: effectiveShadowVerificationSummary.controlMutation === false ? "none" : "需复核",
      note: "不写真实 PLC"
    }
  ];
  const shadowVerificationSummaryRows = [
    {
      label: "执行单",
      value: selectedShadowVerificationExecutionLabel,
      note: "下钻筛选"
    },
    {
      label: "总记录",
      value: shadowVerificationLoading
        ? "加载中"
        : `${formatNumber(effectiveShadowVerificationSummary.total, 0)} 条`,
      note: `统计样本 ${formatNumber(effectiveShadowVerificationSummary.sampledCount, 0)} 条`
    },
    {
      label: "已复核",
      value: `${formatNumber(effectiveShadowVerificationSummary.reviewedCount, 0)} 条`,
      note: "improved / neutral / regressed / invalid"
    },
    {
      label: "待观察",
      value: `${formatNumber(effectiveShadowVerificationSummary.pendingCount, 0)} 条`,
      note: "pending"
    },
    {
      label: "改善/持平",
      value: `${formatNumber(effectiveShadowVerificationSummary.improvedCount, 0)} / ${formatNumber(
        effectiveShadowVerificationSummary.neutralCount,
        0
      )}`,
      note: "同工况 shadow 对比"
    },
    {
      label: "退化/无效",
      value: `${formatNumber(effectiveShadowVerificationSummary.regressedCount, 0)} / ${formatNumber(
        effectiveShadowVerificationSummary.invalidCount,
        0
      )}`,
      note: "需复盘或剔除样本"
    },
    {
      label: "控制影响",
      value: effectiveShadowVerificationSummary.controlMutation === false ? "none" : "需复核",
      note: "只读统计，不改执行单"
    }
  ];
  const shadowVerificationTypeSummaryRows =
    Array.isArray(effectiveShadowVerificationSummary.byVerificationType) &&
    effectiveShadowVerificationSummary.byVerificationType.length
      ? effectiveShadowVerificationSummary.byVerificationType
      : [];
  const canSaveShadowVerificationRecord = Boolean(responseReady && !shadowVerificationSubmitting && !shadowVerificationReviewingId);
  const canExportSingleShadowReviewReport =
    shadowVerificationExecutionFilter !== "all" && !shadowVerificationReportExporting;
  const canOpenSingleShadowReviewPrintPage =
    shadowVerificationExecutionFilter !== "all" && !shadowVerificationPrintOpening;
  const shadowVerificationRecordCountSummary = shadowVerificationLoading
    ? "加载中"
    : `${formatNumber(shadowVerificationRecords.length, 0)} 条`;
  const informationCompletenessRows = [
    { label: "重复项", value: "已收敛", note: "影子/下发状态保留一次" },
    { label: "遗漏项", value: "未发现", note: "目标、边界、收益、动作齐全" },
    { label: "空白块", value: "已压缩", note: "三列密度一致" },
    { label: "下滚量", value: "减少", note: "关键决策首屏可见" }
  ];
  const chillerPrimaryBlockers = chillerBlockers.slice(0, 2);
  const pumpPrimaryBlockers = pumpBlockers.slice(0, 2);
  const autoPrefillMessage =
    autoPrefill.kind === "loading"
      ? zhCN.optimizeDemo.prefillLoading
      : autoPrefill.kind === "ready"
        ? zhCN.optimizeDemo.prefillReady
        : autoPrefill.kind === "partial"
          ? zhCN.optimizeDemo.prefillPartial
          : zhCN.optimizeDemo.prefillError;
  const submitButtonText = submitting
    ? zhCN.optimizeDemo.submitLoading
    : responseReady
      ? "重新生成建议"
      : zhCN.optimizeDemo.submit;
  const prefillSourceText =
    autoPrefill.kind === "loading"
      ? "正在读取"
      : `${preferLocaleValue(autoPrefill.loadSource, "待确认")} / ${preferLocaleValue(autoPrefill.wetBulbSource, "待确认")}`;
  const prefillUpdatedText = autoPrefill.kind === "loading" ? "读取中" : formatPrefillTimestamp(autoPrefill.refreshedAt);
  const prefillSourceCompactText =
    autoPrefill.kind === "loading"
      ? "读取中"
      : `${compactPrefillSourceLabel(autoPrefill.loadSource)} / ${compactPrefillSourceLabel(autoPrefill.wetBulbSource)}`;
  const prefillUpdatedCompactText =
    autoPrefill.kind === "loading" ? "读取中" : formatPrefillCompactTimestamp(autoPrefill.refreshedAt);

  async function hydrateCurrentScenario(force = false) {
    const requestId = autoPrefillRequestIdRef.current + 1;
    autoPrefillRequestIdRef.current = requestId;
    setAutoPrefill((current) => ({
      ...current,
      kind: "loading",
      reasonCodes: []
    }));

    const overviewRequest = currentProject?.siteId
      ? fetchDashboardOverviewForProject(currentProject)
      : fetchDashboardOverview(activeSiteId);

    const [overviewResult, wetBulbResult] = await Promise.allSettled([
      overviewRequest,
      fetchSceneLegacyTrend(activeSiteId, {
        tagname: WET_BULB_TAG_NAME,
        title: zhCN.optimizeDemo.prefillWetBulbTitle,
        unit: "℃"
      })
    ]);

    if (autoPrefillRequestIdRef.current !== requestId) {
      return;
    }

    const prefillReasonCodes: AutoPrefillReasonCode[] = [];

    const loadCandidate =
      overviewResult.status === "fulfilled"
        ? readAutoLoadCandidate(overviewResult.value)
        : { value: null, source: null, timestamp: null, reasonCode: "prefill_overview_request_failed" as const };
    const overviewWetBulbCandidate =
      overviewResult.status === "fulfilled" ? readOverviewWetBulbCandidate(overviewResult.value) : null;
    const wetBulbCandidate =
      overviewWetBulbCandidate?.value !== null && overviewWetBulbCandidate?.value !== undefined
        ? overviewWetBulbCandidate
        : wetBulbResult.status === "fulfilled"
          ? readLatestWetBulbCandidate(wetBulbResult.value)
          : { value: null, source: null, timestamp: null, reasonCode: "prefill_wet_bulb_request_failed" as const };

    let appliedCount = 0;

    if (typeof loadCandidate.value === "number" && Number.isFinite(loadCandidate.value)) {
      if (force || !loadDirtyRef.current) {
        setLoadKw(formatInputValue(loadCandidate.value, 0));
        appliedCount += 1;
      }
    } else if (!force && !loadDirtyRef.current) {
      setLoadKw("");
    }
    if (loadCandidate.reasonCode) {
      prefillReasonCodes.push(loadCandidate.reasonCode);
    }

    if (typeof wetBulbCandidate.value === "number" && Number.isFinite(wetBulbCandidate.value)) {
      if (force || !wetBulbDirtyRef.current) {
        setOutdoorWetBulbC(formatInputValue(wetBulbCandidate.value, 1));
        appliedCount += 1;
      }
    } else if (!force && !wetBulbDirtyRef.current) {
      setOutdoorWetBulbC("");
    }
    if (wetBulbCandidate.reasonCode) {
      prefillReasonCodes.push(wetBulbCandidate.reasonCode);
    }

    setAutoPrefill({
      kind: appliedCount === 2 ? "ready" : appliedCount === 1 ? "partial" : "error",
      loadSource: loadCandidate.source,
      wetBulbSource: wetBulbCandidate.source,
      refreshedAt: new Date().toISOString(),
      reasonCodes: [...new Set(prefillReasonCodes)]
    });
  }

  useEffect(() => {
    loadDirtyRef.current = false;
    wetBulbDirtyRef.current = false;
    void hydrateCurrentScenario(true);
    return () => {
      autoPrefillRequestIdRef.current += 1;
    };
  }, [activeProjectContextKey, activeSiteId]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      if (responseReady) {
        return;
      }
      if (loadDirtyRef.current && wetBulbDirtyRef.current) {
        return;
      }
      void hydrateCurrentScenario(false);
    }, PREFILL_AUTO_REFRESH_MS);

    function handleVisibilityChange() {
      if (document.hidden) {
        return;
      }
      if (responseReady) {
        return;
      }
      if (loadDirtyRef.current && wetBulbDirtyRef.current) {
        return;
      }
      void hydrateCurrentScenario(false);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeProjectContextKey, activeSiteId, responseReady]);

  useEffect(() => {
    setExecutions([]);
    setShadowVerificationRecords([]);
    setShadowVerificationSummary(null);
    setExecutionError(null);
    setShadowVerificationError(null);
    void reloadExecutions();
    void reloadShadowVerificationRecords();
  }, [activeSiteId, details?.generatedAt, shadowVerificationTypeFilter, shadowVerificationExecutionFilter]);

  function renderShadowVerificationRecordPanel() {
    return (
      <div className="optimize-response">
        <div className="optimize-response-header">
          <div>
            <strong>人工保存 shadow 观察记录</strong>
            <p>append-only 记录，可补录复核结果和导出审计 CSV；不审批、不 dispatch、不 rollback、不写真实 PLC。</p>
          </div>
          <div className="optimize-execution-actions">
            <button
              type="button"
              className={
                canSaveShadowVerificationRecord
                  ? "scene-open-link optimize-action-button"
                  : "scene-open-link optimize-action-button is-disabled"
              }
              disabled={!canSaveShadowVerificationRecord}
              onClick={() => {
                void saveShadowVerificationRecord();
              }}
            >
              {shadowVerificationSubmitting ? "保存中" : "保存人工验证记录"}
            </button>
            <button
              type="button"
              className={
                shadowVerificationExporting
                  ? "scene-open-link optimize-action-button is-disabled"
                  : "scene-open-link optimize-action-button is-secondary"
              }
              disabled={shadowVerificationExporting}
              onClick={() => {
                void exportShadowVerificationRecordsCsv();
              }}
            >
              {shadowVerificationExporting ? "导出中" : "导出审计 CSV"}
            </button>
          </div>
        </div>

        <div className="optimize-boundary-list optimize-boundary-list-compact">
          {shadowVerificationRows.map((item) => (
            <span key={item.label}>
              <strong>{item.label}</strong>
              <em>{item.value}</em>
            </span>
          ))}
        </div>

        <div className="optimize-response">
          <strong>Advisor 类型筛选</strong>
          <p>按主机组合、冷却塔、泵 Delta-T 分开查看 shadow 验证结果；筛选只影响统计和列表，不改变执行单。</p>
          <div className="optimize-execution-actions">
            {SHADOW_VERIFICATION_TYPE_FILTERS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={
                  shadowVerificationTypeFilter === item.value
                    ? "scene-open-link optimize-action-button is-secondary"
                    : "scene-open-link optimize-action-button"
                }
                onClick={() => {
                  setShadowVerificationTypeFilter(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="optimize-response">
          <strong>执行单 ID 下钻</strong>
          <p>按单个 shadow 执行单查看观察记录、复核结果和导出内容；筛选只影响统计和列表，不改变执行单。</p>
          <div className="optimize-execution-actions">
            {shadowVerificationExecutionOptions.map((item) => (
              <button
                type="button"
                key={item.value}
                title={item.note}
                className={
                  shadowVerificationExecutionFilter === item.value
                    ? "scene-open-link optimize-action-button is-secondary"
                    : "scene-open-link optimize-action-button"
                }
                onClick={() => {
                  setShadowVerificationExecutionFilter(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {shadowVerificationError ? <p>{shadowVerificationError}</p> : null}

        <div className="optimize-response">
          <strong>影子复核统计</strong>
          <p>只读统计摘要，不作为固定节能承诺，不改变执行单状态。</p>
          <div className="optimize-boundary-list optimize-boundary-list-compact">
            {shadowVerificationSummaryRows.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
                <small>{item.note}</small>
              </span>
            ))}
          </div>
        </div>

        <div className="optimize-response">
          <strong>单次 shadow 复盘摘要</strong>
          <p>
            选择执行单后汇总该单观察记录、复核结论、关键指标和导出范围；报告ID/校验码用于核对页面、Markdown 和打印版一致，不是电子签名；导出报告含 A4 打印样式和甲方/值班员签字确认区，只做审计复盘，不作为节能结算依据。
          </p>
          <div className="optimize-execution-actions">
            <button
              type="button"
              className={
                canExportSingleShadowReviewReport
                  ? "scene-open-link optimize-action-button is-secondary"
                  : "scene-open-link optimize-action-button is-disabled"
              }
              disabled={!canExportSingleShadowReviewReport}
              onClick={() => {
                void exportSingleShadowReviewReport();
              }}
            >
              {shadowVerificationReportExporting ? "导出中" : "导出复盘报告"}
            </button>
            <button
              type="button"
              className={
                canOpenSingleShadowReviewPrintPage
                  ? "scene-open-link optimize-action-button is-secondary"
                  : "scene-open-link optimize-action-button is-disabled"
              }
              disabled={!canOpenSingleShadowReviewPrintPage}
              onClick={() => {
                void openSingleShadowReviewPrintPage();
              }}
            >
              {shadowVerificationPrintOpening ? "打开中" : "打开打印版"}
            </button>
          </div>
          <div className="optimize-boundary-list optimize-boundary-list-compact">
            {singleShadowReviewRows.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
                <small>{item.note}</small>
              </span>
            ))}
          </div>
        </div>

        <div className="optimize-response">
          <strong>按 Advisor 类型统计</strong>
          <p>主机组合 / 冷却塔 / 泵 Delta-T 分组只读汇总，不作为节能结算依据。</p>
          {shadowVerificationTypeSummaryRows.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {shadowVerificationTypeSummaryRows.map((item) => (
                <article className="optimize-response-card" key={item.verificationType || "unknown"}>
                  <span>{localizeShadowVerificationType(item.verificationType)}</span>
                  <strong>{`${formatNumber(item.reviewedCount, 0)} 已复核 / ${formatNumber(item.pendingCount, 0)} 待观察`}</strong>
                  <small>
                    {[
                      `总 ${formatNumber(item.total, 0)}`,
                      `改善 ${formatNumber(item.improvedCount, 0)}`,
                      `持平 ${formatNumber(item.neutralCount, 0)}`,
                      `退化 ${formatNumber(item.regressedCount, 0)}`,
                      `无效 ${formatNumber(item.invalidCount, 0)}`
                    ].join(" / ")}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p>暂无可统计记录；保存 shadow 验证记录后再按 Advisor 类型查看。</p>
          )}
        </div>

        <details className="optimize-more-details">
          <summary>最近记录 {shadowVerificationRecordCountSummary}</summary>
          {recentShadowVerificationRecords.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {recentShadowVerificationRecords.map((record) => {
                const sourceRecordId = getShadowVerificationSourceRecordId(record);
                const metricIssue = getShadowVerificationMetricConsistencyIssue(record);
                const canReviewRecord = Boolean(record.recordId && record.outcome === "pending" && !sourceRecordId);
                return (
                  <article className="optimize-response-card" key={record.recordId || `${record.recordedAt}-${record.targetLabel}`}>
                    <span>{localizeShadowVerificationOutcome(record.outcome)}</span>
                    <strong>{record.targetLabel || record.verificationType || "shadow 验证"}</strong>
                    <small>
                      {metricIssue
                        ? [formatPrefillTimestamp(record.recordedAt), "指标待复核", metricIssue].join(" / ")
                        : [
                            formatPrefillTimestamp(record.recordedAt),
                            `冷站COP ${formatNumber(record.metrics?.stationCop, 2)}`,
                            `kW/RT ${formatNumber(record.metrics?.kwPerRt, 3)}`,
                            `告警 ${formatNumber(record.metrics?.alarmCount, 0)}`
                          ].join(" / ")}
                    </small>
                    {sourceRecordId ? <small>{`复核源记录 ${sourceRecordId}`}</small> : null}
                    {canReviewRecord ? (
                      <div className="optimize-execution-actions">
                        {SHADOW_VERIFICATION_REVIEW_OUTCOMES.map((item) => {
                          const reviewKey = `${record.recordId}:${item.outcome}`;
                          const reviewing = shadowVerificationReviewingId === reviewKey;
                          return (
                            <button
                              type="button"
                              key={item.outcome}
                              className={
                                shadowVerificationReviewingId
                                  ? "scene-open-link optimize-action-button is-disabled"
                                  : "scene-open-link optimize-action-button is-secondary"
                              }
                              disabled={Boolean(shadowVerificationReviewingId)}
                              onClick={() => {
                                void reviewShadowVerificationRecord(record, item.outcome);
                              }}
                            >
                              {reviewing ? "保存中" : item.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无人工验证记录；保存后仅进入 append-only 审计记录，不改变执行单状态。</p>
          )}
        </details>
      </div>
    );
  }

  return (
    <div className="optimize-page page-enter">
      <section className="optimize-page-header subpage-command-board">
        <div className="optimize-command-copy subpage-command-copy">
          <p className="optimize-command-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h1>{zhCN.optimizeDemo.heading}</h1>
          <p>{headerSubtitle}</p>
          <div className="optimize-command-tags">
            {optimizeCommandTags.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        </div>
        <div className="optimize-command-side subpage-command-side">
          <div className="optimize-command-note">
            <strong>{approachDecisionState.headline}</strong>
            <p>{nextAction.hint}</p>
          </div>
          <div className="optimize-scheme-badges">
            <StatusPill
              label={requestStatusLabel}
              tone={responseReady ? "good" : hasValidationError || sourceSummary.warn ? "warn" : "neutral"}
            />
            <StatusPill label="真实PLC锁定" tone="warn" />
          </div>
        </div>
      </section>

      <div className={`optimize-workspace-stage tone-${nextAction.tone}${responseReady ? " is-ready" : " is-pending"}`}>
        <div className="optimize-workspace-stage-copy">
          <span>{optimizeWorkspaceLabel}</span>
          <strong>{optimizeWorkspaceHeadline}</strong>
          <p>{optimizeWorkspaceBody}</p>
        </div>
        <div className="optimize-result-card-grid" aria-label="优化建议结果">
          {optimizeResultCards.map((item) => (
            <article key={item.label} className={`tone-${item.tone}${item.emphasis ? ` is-${item.emphasis}` : ""}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
        <div className="optimize-workspace-stage-meta" aria-label="生成口径">
          {optimizeWorkspaceMeta.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="optimize-input-status-grid">
        <SectionCard title="输入工况">
          <form className="optimize-form" onSubmit={handleSubmit}>
            <div className="optimize-form-main">
              <div className="optimize-form-grid">
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
              </div>
              <div className="optimize-form-actions">
                <button type="submit" disabled={!canSubmitOptimize}>
                  {submitButtonText}
                </button>
              </div>
            </div>
            <div className={"optimize-form-prefill optimize-form-prefill-" + autoPrefill.kind}>
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
                <span title={`来源：${prefillSourceText}`}>
                  来源：
                  {prefillSourceCompactText}
                </span>
                <span title={`${zhCN.optimizeDemo.prefillUpdatedAtLabel}：${prefillUpdatedText}`}>
                  {zhCN.optimizeDemo.prefillUpdatedAtLabel}：
                  {prefillUpdatedCompactText}
                </span>
              </div>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="当前工况与能效"
          action={<StatusPill label={reviewReadinessStatusLabel} tone={reviewReadinessStatusTone} />}
        >
          <div className="optimize-compact-metric-grid">
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.baselineCop}</span>
              <strong>{formatCompactNumber(baseline.systemCop, 2)}</strong>
            </article>
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.baselinePower}</span>
              <strong>{formatCompactPowerKw(baseline.totalPowerKw, 0)}</strong>
            </article>
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.towerApproachCurrentApproach}</span>
              <strong>{formatCompactTemperature(towerApproachAdvisor?.currentApproachC)}</strong>
            </article>
            <article className="optimize-response-card">
              <span>{zhCN.optimizeDemo.baselineActiveAlarms}</span>
              <strong>{formatCompactNumber(baseline.activeAlarmCount, 0)}</strong>
            </article>
          </div>
        </SectionCard>

        <SectionCard
          title="历史对标依据"
          action={<StatusPill label={benefitEstimateConfidenceLabel} tone={mapConfidenceTone(benefitEstimate?.confidence)} />}
        >
          <div className="optimize-compact-metric-grid">
            <article className="optimize-response-card">
              <span>匹配口径</span>
              <strong>{benefitMatchingTierSummary}</strong>
            </article>
            <article className="optimize-response-card">
              <span>置信度</span>
              <strong>{benefitConfidenceCompactSummary}</strong>
            </article>
            <article className="optimize-response-card">
              <span>样本</span>
              <strong>{benefitSampleSummary}</strong>
            </article>
            <article className="optimize-response-card">
              <span>验证窗</span>
              <strong>{benefitVerificationWindowSummary}</strong>
            </article>
          </div>
        </SectionCard>
      </div>

      {!responseReady ? (
        <section className="optimize-empty-state" aria-live="polite">
          <div>
            <strong>等待生成本次建议</strong>
            <p>先确认当前负荷、室外湿球和运行模式；生成后再展示主机组合、接近度、泵频率修正与影子验证。</p>
          </div>
          <span>真实 PLC 下发锁定</span>
        </section>
      ) : (
        <>
      <div className="optimize-decision-workbench">
        <div className="optimize-decision-primary">
      <SectionCard
        title="主机组合优化"
        action={
          <div className="optimize-scheme-badges">
            <StatusPill label={chillerStagingStatusLabel} tone={chillerStagingStatusTone} />
            <StatusPill label={chillerStagingExecutionLabel} tone={chillerStagingExecutionTone} />
            <StatusPill label={chillerSampleGovernanceLabel} tone={chillerSampleGovernanceTone} />
            <StatusPill label={chillerActionState.label} tone={normalizeActionTone(chillerActionState.tone)} />
          </div>
        }
      >
        <div className="optimize-response">
          <div className="optimize-response-header">
            <div>
              <strong>{chillerSampleActionSummary}</strong>
              <p>{chillerActionState.hint}</p>
            </div>
            <StatusPill label={localizeBenefitConfidence(chillerStagingAdvisor?.confidence)} tone={mapConfidenceTone(chillerStagingAdvisor?.confidence)} />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card optimize-response-card-wide">
              <span>当前运行组合</span>
              <strong>{formatChillerCombination(chillerStagingAdvisor?.current?.runningCombination)}</strong>
              <small>多机无单台流量时只评价组合 COP / 冷站 COP</small>
            </article>
            <article className="optimize-response-card optimize-response-card-wide">
              <span>推荐目标组合</span>
              <strong>{formatChillerCombination(chillerStagingAdvisor?.recommendation?.targetCombination)}</strong>
              <small>{preferLocaleValue(chillerStagingAdvisor?.recommendation?.reason, "等待组合样本与边界校验。")}</small>
            </article>
            <article className="optimize-response-card">
              <span>组合负荷率</span>
              <strong>{formatDirectPercent(chillerStagingAdvisor?.current?.combinationPlrPct)}</strong>
              <small>容量 {formatNumber(chillerStagingAdvisor?.current?.combinationCapacityKw, 0)} kW</small>
            </article>
            <article className="optimize-response-card">
              <span>主机组合 COP</span>
              <strong>{formatNumber(chillerStagingAdvisor?.current?.comboCop, 2)}</strong>
              <small>主机总功率 {formatNumber(chillerStagingAdvisor?.current?.chillerPowerTotalKw, 0)} kW</small>
            </article>
            <article className="optimize-response-card">
              <span>冷站 COP</span>
              <strong>{formatNumber(chillerStagingAdvisor?.current?.stationCop, 2)}</strong>
              <small>冷站总功率 {formatNumber(chillerStagingAdvisor?.current?.stationPowerTotalKw, 0)} kW</small>
            </article>
            <article className="optimize-response-card">
              <span>预计总功率变化</span>
              <strong>{formatKwDelta(chillerStagingAdvisor?.recommendation?.expectedTotalPowerDeltaKw)}</strong>
              <small>COP变化 {formatDelta(chillerStagingAdvisor?.recommendation?.expectedCopDelta)}</small>
            </article>
          </div>

          {chillerPrimaryBlockers.length ? (
            <div className="optimize-response-block optimize-decision-panel">
              <h4>阻塞</h4>
              <ul className="optimize-decision-list is-blockers">
                {chillerPrimaryBlockers.map((item, index) => (
                  <li key={item + "-" + String(index + 1)}>{preferLocaleValue(item, zhCN.optimizeDemo.pendingValue)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="optimize-more-details">
            <summary>样本与候选</summary>
	            <div className="optimize-response-grid optimize-response-grid-execution">
	              <article className="optimize-response-card optimize-response-card-wide">
	                <span>样本治理</span>
	                <strong>{chillerSampleGovernanceLabel}</strong>
	                <small>{chillerSampleGovernanceSummary}</small>
	              </article>
	              <article className="optimize-response-card">
	                <span>样本总量</span>
	                <strong>{chillerSampleTotalSummary}</strong>
                <small>
                  候选 {formatNumber(chillerSampleSummary?.candidateCombinationCount, 0)} / 同工况{" "}
                  {formatNumber(chillerSampleSummary?.comparableCandidateCount, 0)}
                </small>
              </article>
              <article className="optimize-response-card">
                <span>当前组合样本</span>
                <strong>{formatNumber(chillerSampleSummary?.currentCombinationSamples, 0)}</strong>
                <small>{localizeChillerStagingMatchTier(chillerCurrentEvidence?.matchingTier)}</small>
              </article>
	              <article className="optimize-response-card">
	                <span>候选覆盖</span>
	                <strong>{chillerCompareReadySummary}</strong>
	                <small>
	                  高置信 {formatNumber(chillerSampleGovernance?.highConfidenceCandidateCount, 0)} / 候选{" "}
	                  {formatNumber(chillerSampleGovernance?.candidateCombinationCount, 0)}
	                </small>
	              </article>
	              <article className="optimize-response-card">
	                <span>本次采样</span>
	                <strong>
	                  {localizeChillerSampleCaptureStatus(chillerSampleCapture?.status, chillerCurrentLiveSample?.status)}
                </strong>
                <small>
                  {preferLocaleValue(
                    chillerSampleCapture?.reason,
                    `${formatNumber(chillerCurrentLiveSample?.sampleMinutes, 0)} min / ${localizeChillerStagingSampleRole(
                      chillerCurrentLiveSample?.sampleRole
                    )}`
                  )}
                </small>
              </article>
              <article className="optimize-response-card">
                <span>推荐组合样本</span>
                <strong>{formatNumber(chillerSampleSummary?.targetCombinationSamples, 0)}</strong>
                <small>{localizeChillerStagingMatchTier(chillerTargetEvidence?.matchingTier)}</small>
              </article>
              <article className="optimize-response-card">
                <span>shadow 验证</span>
                <strong>{formatMinuteRange(chillerVerification?.durationMinutes)}</strong>
                <small>{preferLocaleValue(chillerVerification?.method, "同负荷湿球区间对比")}</small>
              </article>
            </div>

	            {chillerCandidates.length ? (
	              <div className="optimize-response-grid optimize-response-grid-execution">
                {chillerCandidates.map((candidate, index) => (
                  <article className="optimize-response-card" key={candidate.key || `${index + 1}`}>
                    <span>{candidate.isCurrent ? "当前组合" : localizeChillerStagingAction(candidate.action)}</span>
                    <strong>{formatChillerCombination(candidate.combination)}</strong>
                    <small>
                      {[
                        `样本 ${formatNumber(candidate.sampleCount, 0)}`,
                        `冷站COP ${formatNumber(candidate.stationCop, 2)}`,
                        `kW/RT ${formatNumber(candidate.kwPerRt, 3)}`,
                        `余量 ${formatDirectPercent(candidate.capacityReservePct)}`,
                        localizeChillerStagingSampleRole(candidate.sampleRole)
                      ].join(" / ")}
                    </small>
                  </article>
                ))}
	              </div>
	            ) : (
	              <p>暂无候选组合样本；先积累单机运行窗口和组合运行窗口。</p>
	            )}

	            {chillerMissingCandidateCoverage.length ? (
	              <div className="optimize-response-block optimize-decision-panel">
	                <h4>候选组合样本缺口</h4>
	                <ul className="optimize-decision-list">
	                  {chillerMissingCandidateCoverage.map((item) => (
	                    <li key={item.combinationKey || formatChillerCombination(item.combination)}>
	                      {formatChillerCombination(item.combination)}：同工况样本 {formatNumber(item.sameBandSamples, 0)}，距 30 条还缺{" "}
	                      {formatNumber(item.deficitToMin, 0)}；总样本 {formatNumber(item.totalSamples, 0)}
	                    </li>
	                  ))}
	                </ul>
	              </div>
	            ) : null}
	          </details>
        </div>
      </SectionCard>
        </div>

        <div className="optimize-decision-side-stack">
        <SectionCard
          title="数据可信度"
          action={
            <div className="optimize-scheme-badges">
              <StatusPill label={sourceSummary.text} tone={sourceSummary.warn ? "warn" : "good"} />
              <StatusPill label={reviewReadinessStatusLabel} tone={reviewReadinessStatusTone} />
            </div>
          }
        >
          <div className="optimize-response">
            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>信号完整度</span>
                <strong>{signalQualityLabel}</strong>
                <small>关键闭环信号</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineCop}</span>
                <strong>{formatNumber(baseline.systemCop, 2)}</strong>
                <small>{zhCN.optimizeDemo.baselinePower} {formatNumber(baseline.totalPowerKw)} kW</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineCoolingReturnTemp}</span>
                <strong>{formatTemperature(baseline.coolingReturnTemp)}</strong>
                <small>冷机冷凝器进水温 = 冷却塔出水温</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.baselineTowerPower}</span>
                <strong>{formatNumber(baseline.coolingTowerPowerKw)} kW</strong>
                <small>{zhCN.optimizeDemo.baselineActiveAlarms} {formatNumber(baseline.activeAlarmCount, 0)}</small>
              </article>
            </div>

          </div>
        </SectionCard>

        <SectionCard
          title="信息完整性检查"
          action={<StatusPill label="无遗漏" tone="good" />}
        >
          <div className="optimize-response">
            <div className="optimize-response-grid">
              {informationCompletenessRows.map((item) => (
                <article className="optimize-response-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </article>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="甲方演示 readiness"
          action={<StatusPill label="CLIENT_DEMO_READY_SHADOW_PENDING" tone="warn" />}
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              {clientDemoReadinessRows.map((item) => (
                <span key={item.label} title={item.note}>
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </span>
              ))}
            </div>
            {fieldCollectionFormalInputs.length ? (
              <div className="optimize-response-block optimize-decision-panel">
                <h4>正式 CSV 缺口明细</h4>
                <ul className="optimize-decision-list is-checks">
                  {fieldCollectionFormalInputs.map((item) => (
                    <li key={item.key || item.path || item.label || "formal-input"}>
                      <strong>{item.label || item.key || "现场 CSV"}</strong>
                      ：{item.path || "待确认路径"} · {localizeFormalInputStatus(item.status)}
                      {item.status === "present_with_rows" ? ` · ${formatNumber(item.lineCount, 0)} 行` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="人工审阅门禁"
          action={<StatusPill label="仅审阅" tone="warn" />}
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              <span>
                <strong>suite</strong>
                <em>先跑 140 shadow suite</em>
              </span>
              <span>
                <strong>Advisor 合同</strong>
                <em>ADVISOR_CONTRACT_READY</em>
              </span>
              <span>
                <strong>UI 边界</strong>
                <em>UI_BOUNDARY_COPY_READY</em>
              </span>
              <span>
                <strong>控制副作用</strong>
                <em>NO_CONTROL_MUTATION</em>
              </span>
              <span>
                <strong>塔侧</strong>
                <em>GO_SHADOW</em>
              </span>
              <span>
                <strong>泵侧</strong>
                <em>GO_SHADOW_ONLY</em>
              </span>
              <span>
                <strong>治理</strong>
                <em>GO_SHADOW_PENDING</em>
              </span>
              <span>
                <strong>一票否决</strong>
                <em>任一 gate 失败停止审阅</em>
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="影子验证记录"
          action={<StatusPill label="人工记录" tone="warn" />}
        >
          {renderShadowVerificationRecordPanel()}
        </SectionCard>

        <SectionCard
          title="安全边界与回退"
          action={<StatusPill label="真实 PLC 下发锁定" tone="warn" />}
        >
          <div className="optimize-boundary-list">
            <span>
              <strong>AI 输出</strong>
              <em>只给目标值/建议值</em>
            </span>
            <span>
              <strong>真实下发</strong>
              <em>禁用，PLC仅做保护</em>
            </span>
            <span>
              <strong>审批动作</strong>
              <em>{nextAction.label}</em>
            </span>
            <span>
              <strong>接近度</strong>
              <em>{towerApproachSafetySummary}</em>
            </span>
            <span>
              <strong>泵频修正</strong>
              <em>{pumpTrimSafetySummary}</em>
            </span>
            <span>
              <strong>回退触发</strong>
              <em>{rollbackTriggerSummary}</em>
            </span>
            <span>
              <strong>回退动作</strong>
              <em>目标回提；频率修正归零</em>
            </span>
          </div>
        </SectionCard>
      </div>
      </div>

      <SectionCard
        title="数据资源与诊断可行性"
        action={<StatusPill label={diagnosticReadinessSummary} tone={diagnosticReadinessMatrix ? "warn" : "neutral"} />}
      >
        <div className="optimize-response">
          <div className="optimize-response-header">
            <div>
              <strong>现有 {activeProjectLabel} 数据能支撑哪些诊断</strong>
              <p>A档可做 V1；B档只能疑似判断；C档暂不能做，只进入补点清单。所有内容只读诊断，不判定设备故障，不写 PLC。</p>
            </div>
            <StatusPill label="真实 PLC 下发锁定" tone="warn" />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>可做 V1</span>
              <strong>{formatNumber(diagnosticReadinessMatrix?.readyNowCount, 0)}</strong>
              <small>现有实时/趋势数据可支撑</small>
            </article>
            <article className="optimize-response-card">
              <span>只能疑似判断</span>
              <strong>{formatNumber(diagnosticReadinessMatrix?.directionalCount, 0)}</strong>
              <small>输出风险和复核建议</small>
            </article>
            <article className="optimize-response-card">
              <span>暂不能做</span>
              <strong>{formatNumber(diagnosticReadinessMatrix?.pointGapCount, 0)}</strong>
              <small>只进入点位改造清单</small>
            </article>
            <article className="optimize-response-card">
              <span>执行边界</span>
              <strong>只读/shadow</strong>
              <small>无真实启停，不开放 enforced</small>
            </article>
          </div>

          {diagnosticReadinessItems.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {diagnosticReadinessItems.map((item) => {
                const tierLabel = typeof item.tier === "string" && item.tier.trim() ? item.tier.trim() : "待分档";
                const availableSummary = Array.isArray(item.availableData)
                  ? item.availableData.filter(Boolean).slice(0, 2).join(" / ")
                  : "";
                const missingSummary = Array.isArray(item.missingData)
                  ? item.missingData.filter(Boolean).slice(0, 2).join(" / ")
                  : "";
                return (
                  <article className="optimize-response-card" key={item.key || item.title}>
                    <span>
                      {tierLabel}档 · {localizeDiagnosticAllowedMode(item.allowedMode)}
                    </span>
                    <strong>{localizeDiagnosticReadinessFeasibility(item.currentFeasibility)}</strong>
                    <small>{preferLocaleValue(item.title, "诊断项")}</small>
                    <small>{preferLocaleValue(item.firstVersionOutput, "等待诊断定义。")}</small>
                    {availableSummary ? <small>已有：{availableSummary}</small> : null}
                    {missingSummary ? <small>缺口：{missingSummary}</small> : null}
                    <StatusPill
                      label={localizeDiagnosticReadinessFeasibility(item.currentFeasibility)}
                      tone={mapDiagnosticReadinessFeasibilityTone(item.currentFeasibility)}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无数据资源矩阵；实时点位缺失时只保留审阅，不输出诊断承诺。</p>
          )}

          <div className="optimize-response-header optimize-response-header-secondary">
            <div>
              <strong>现场复核清单</strong>
              <p>把 B/C 档数据缺口转成只读点位/资料补齐任务；用于提高诊断置信度，不触发审批、dispatch 或 PLC 写入。</p>
            </div>
            <StatusPill label={fieldVerificationSummary} tone={fieldVerificationChecklist ? "warn" : "neutral"} />
          </div>

          {fieldVerificationTasks.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {fieldVerificationTasks.map((task) => {
                const missingSummary = Array.isArray(task.missingData)
                  ? task.missingData.filter(Boolean).slice(0, 2).join(" / ")
                  : "";
                const evidenceSummary = Array.isArray(task.requiredEvidence)
                  ? task.requiredEvidence.filter(Boolean).slice(0, 2).join(" / ")
                  : "";
                return (
                  <article className="optimize-response-card" key={task.key || task.title}>
                    <span>
                      {String(task.priority || "P1").trim()} · {String(task.sourceTier || "待分档").trim()}档
                    </span>
                    <strong>{preferLocaleValue(task.title, "现场复核任务")}</strong>
                    <small>{preferLocaleValue(task.verificationTarget, "待确认复核对象")}</small>
                    {missingSummary ? <small>缺口：{missingSummary}</small> : null}
                    {evidenceSummary ? <small>证据：{evidenceSummary}</small> : null}
                    <small>{preferLocaleValue(task.acceptanceCriteria, "形成现场复核记录后再提高置信度。")}</small>
                    <small>{preferLocaleValue(task.boundary, "只读复核，不写 PLC。")}</small>
                    <StatusPill
                      label={String(task.priority || "P1").trim()}
                      tone={task.priority === "P0" ? "warn" : "neutral"}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无现场复核清单；数据缺口未形成前不提升诊断承诺。</p>
          )}

          <details className="optimize-more-details">
            <summary>可行性边界</summary>
            <ul className="optimize-decision-list">
              {(diagnosticReadinessMatrix?.boundaryNotes || [
                "A档可进入 /optimize-demo 作为 V1 只读诊断或 shadow 证据。",
                "B档只能输出疑似风险、待复核和样本治理建议。",
                "C档只进入点位改造清单，不能输出正式诊断结论。"
              ]).map((item, index) => (
                <li key={item + "-" + String(index + 1)}>{preferLocaleValue(item, "只读诊断边界。")}</li>
              ))}
            </ul>
          </details>
        </div>
      </SectionCard>

      <div className="optimize-diagnostic-showcase" aria-label="本次建议诊断依据">
        <div className="optimize-response-header">
          <div>
            <strong>本次建议诊断依据</strong>
            <p>关键结论、证据摘要、控制边界；完整诊断在运行诊断页审阅。</p>
          </div>
          <div className="optimize-diagnostic-summary-actions">
            <StatusPill label={operationalDiagnosticReadySummary} tone={mapBenchmarkTone(operationalDiagnosticsAdvisor?.status)} />
            <Link to={operationalDiagnosticsHref}>查看完整运行诊断</Link>
          </div>
        </div>

        <div className="optimize-diagnostic-spotlight-grid">
          {diagnosticSpotlightCards.map((card) => (
            <article className={`optimize-diagnostic-spotlight-card tone-${card.tone}`} key={card.key}>
              <div className="optimize-diagnostic-spotlight-head">
                <span>{card.title}</span>
                <StatusPill label={card.statusLabel} tone={card.tone} />
              </div>
              <strong>{card.value}</strong>
              <p>{preferLocaleValue(card.summary, "等待诊断证据。")}</p>
              <small>{preferLocaleValue(card.evidence, "等待现场复核证据。")}</small>
              <em>{card.boundary}</em>
            </article>
          ))}
        </div>
      </div>

      {showInlineOperationalDiagnosticsDetails ? (
      <SectionCard
        title="运行诊断 Advisor"
        action={
          <div className="optimize-scheme-badges">
            <StatusPill label={operationalDiagnosticStatusLabel} tone={mapBenchmarkTone(operationalDiagnosticsAdvisor?.status)} />
            <StatusPill label={operationalDiagnosticModeLabel} tone="warn" />
          </div>
        }
      >
        <div className="optimize-response">
          <div className="optimize-response-header">
            <div>
              <strong>仪表、水力、控制震荡、低温差、冷却塔和主机样本只读诊断</strong>
              <p>基于组合实测性能和实时点位一致性生成 shadow 证据；不计算多机单台 COP，不新增 PLC 下发能力。</p>
            </div>
            <StatusPill label={operationalDiagnosticReadySummary} tone={mapBenchmarkTone(operationalDiagnosticsAdvisor?.status)} />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>诊断覆盖</span>
              <strong>{operationalDiagnosticCoverageSummary}</strong>
              <small>实时寄存器摘要</small>
            </article>
            <article className="optimize-response-card">
              <span>点位识别</span>
              <strong>{operationalDiagnosticPointDictionaryLabel}</strong>
              <small>
                {operationalDiagnosticPointDictionaryApplied
                  ? "按站点字典过滤阀门/累计量"
                  : "未配置站点字典时仅方向性审阅"}
              </small>
            </article>
            <article className="optimize-response-card">
              <span>可用/降级</span>
              <strong>{operationalDiagnosticReadySummary}</strong>
              <small>
                不可用 {formatNumber(operationalDiagnosticSummary?.unavailableCount, 0)} / 告警{" "}
                {formatNumber(operationalDiagnosticSummary?.warningCount, 0)}
              </small>
            </article>
            <article className="optimize-response-card">
              <span>运行主机</span>
              <strong>{formatNumber(operationalDiagnosticSummary?.pointCoverage?.runningChillerCount, 0)}</strong>
              <small>只做组合与健康证据</small>
            </article>
            <article className="optimize-response-card">
              <span>冷却塔组</span>
              <strong>{operationalDiagnosticTowerSummary}</strong>
              <small>运行组数 / 总组数</small>
            </article>
            <article className="optimize-response-card">
              <span>塔风机</span>
              <strong>{operationalDiagnosticTowerFanSummary}</strong>
              <small>运行风机 / 风机设备行</small>
            </article>
            <article className="optimize-response-card">
              <span>支路/塔单元</span>
              <strong>
                {formatNumber(operationalDiagnosticSummary?.pointCoverage?.branchCount, 0)} /{" "}
                {formatNumber(operationalDiagnosticSummary?.pointCoverage?.coolingTowerCellCount, 0)}
              </strong>
              <small>水力平衡与塔能力线索</small>
            </article>
          </div>

          <div className="optimize-response-header optimize-response-header-secondary">
            <div>
              <strong>仪表偏移 V1</strong>
              <p>只输出疑似偏移候选、交叉校验和现场复核对象；不判定仪表故障，不自动修正测点。</p>
            </div>
            <StatusPill label={instrumentV1Summary} tone={instrumentReviewCandidateCount > 0 ? "warn" : "neutral"} />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>稳态窗口</span>
              <strong>{localizeInstrumentReviewStatus(instrumentDiagnosticCurrent?.driftWindow?.steadyState?.status === "ready" ? "normal" : "insufficient")}</strong>
              <small>{instrumentSteadyStateSummary}</small>
            </article>
            <article className="optimize-response-card">
              <span>复核边界</span>
              <strong>只读</strong>
              <small>{preferLocaleValue(instrumentDiagnosticCurrent?.reviewBoundary, "不判定仪表故障，不自动修正测点。")}</small>
            </article>
            <article className="optimize-response-card">
              <span>传感器台账</span>
              <strong>{localizeFieldDataPreflightStatus(instrumentSensorLedgerStatus)}</strong>
              <small>{instrumentSensorLedgerSummary}</small>
              <small>
                {instrumentSensorLedgerEvidence?.readyForReview
                  ? "只提高现场复核效率，不自动修正测点"
                  : "缺台账时只保留疑似复核口径"}
              </small>
              <StatusPill
                label={localizeFieldDataPreflightStatus(instrumentSensorLedgerStatus)}
                tone={mapFieldDataPreflightTone(instrumentSensorLedgerStatus)}
              />
            </article>
          </div>

          {instrumentDriftCandidates.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {instrumentDriftCandidates.map((candidate) => {
                const suspectedSignals = Array.isArray(candidate.suspectedSignals)
                  ? candidate.suspectedSignals.filter(Boolean).slice(0, 3).join(" / ")
                  : "";
                const requiredEvidence = Array.isArray(candidate.requiredEvidence)
                  ? candidate.requiredEvidence.filter(Boolean).slice(0, 3).join(" / ")
                  : "";
                return (
                  <article className="optimize-response-card" key={candidate.key || candidate.label}>
                    <span>{preferLocaleValue(candidate.label, "仪表偏移候选")}</span>
                    <strong>{localizeInstrumentReviewStatus(candidate.status)}</strong>
                    <small>
                      {formatInstrumentReviewValue(candidate.value, candidate.unit)}
                      {candidate.threshold ? ` / 阈值 ${candidate.threshold}` : ""}
                    </small>
                    <small>{preferLocaleValue(candidate.reason, "等待稳定窗口和交叉校验证据。")}</small>
                    {suspectedSignals ? <small>复核对象：{suspectedSignals}</small> : null}
                    {requiredEvidence ? <small>证据：{requiredEvidence}</small> : null}
                    <small>{preferLocaleValue(candidate.boundary, "只输出疑似复核，不判定故障。")}</small>
                    <StatusPill
                      label={localizeInstrumentReviewStatus(candidate.status)}
                      tone={mapInstrumentReviewTone(candidate.status, candidate.severity)}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无仪表偏移详情；缺 24h 趋势或实时闭合信号时只保留方向性审阅。</p>
          )}

          {instrumentCrossChecks.length ? (
            <details className="optimize-more-details">
              <summary>仪表交叉校验</summary>
              <div className="optimize-response-grid optimize-response-grid-execution">
                {instrumentCrossChecks.map((check) => (
                  <article className="optimize-response-card" key={check.key || check.label}>
                    <span>{preferLocaleValue(check.label, "交叉校验")}</span>
                    <strong>{localizeInstrumentReviewStatus(check.status)}</strong>
                    <small>
                      {formatInstrumentReviewValue(check.value, check.unit)}
                      {check.threshold ? ` / 阈值 ${check.threshold}` : ""}
                    </small>
                    <small>{preferLocaleValue(check.evidence, "等待证据。")}</small>
                    <small>{preferLocaleValue(check.reviewTarget, "待确认复核对象。")}</small>
                    <small>{preferLocaleValue(check.boundary, "只读复核。")}</small>
                  </article>
                ))}
              </div>
            </details>
          ) : null}

          {instrumentFieldReviewTargets.length ? (
            <details className="optimize-more-details">
              <summary>仪表现场复核对象</summary>
              <div className="optimize-response-grid optimize-response-grid-execution">
                {instrumentFieldReviewTargets.map((target) => {
                  const requiredEvidence = Array.isArray(target.requiredEvidence)
                    ? target.requiredEvidence.filter(Boolean).slice(0, 4).join(" / ")
                    : "";
                  return (
                    <article className="optimize-response-card" key={target.key || target.title}>
                      <span>{String(target.priority || "P1").trim()}</span>
                      <strong>{preferLocaleValue(target.title, "现场复核对象")}</strong>
                      <small>{preferLocaleValue(target.trigger, "由仪表偏移候选触发。")}</small>
                      {requiredEvidence ? <small>证据：{requiredEvidence}</small> : null}
                      <small>{preferLocaleValue(target.acceptanceCriteria, "形成复核记录后再提高置信度。")}</small>
                      <small>{preferLocaleValue(target.boundary, "不自动修正测点。")}</small>
                    </article>
                  );
                })}
              </div>
            </details>
          ) : null}

          <div className="optimize-response-header optimize-response-header-secondary">
            <div>
              <strong>水力平衡 V1</strong>
              <p>只输出水力失衡风险排序、低温差持续性和现场复核对象；不自动降泵，不直接判定末端阀门故障。</p>
            </div>
            <StatusPill label={hydraulicV1Summary} tone={hydraulicActiveRiskCount > 0 || hydraulicGapCount > 0 ? "warn" : "neutral"} />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>低温差趋势</span>
              <strong>
                {hydraulicDiagnosticCurrent?.trendWindow?.persistentLowDeltaT ? "持续" : localizeOperationalDiagnosticStatus(hydraulicDiagnosticItem?.status)}
              </strong>
              <small>{hydraulicTrendSummary}</small>
            </article>
            <article className="optimize-response-card">
              <span>水力风险指示</span>
              <strong>
                {formatNumber(hydraulicActiveRiskCount, 0)} / {formatNumber(hydraulicRiskIndicators.length, 0)}
              </strong>
              <small>
                缺口 {formatNumber(hydraulicGapCount, 0)} / 正常 {formatNumber(hydraulicNormalCount, 0)}
              </small>
            </article>
            <article className="optimize-response-card">
              <span>现场复核对象</span>
              <strong>{formatNumber(hydraulicFieldReviewTargets.length, 0)}</strong>
              <small>支路趋势、旁通状态和末端安全信号</small>
            </article>
            <article className="optimize-response-card">
              <span>复核边界</span>
              <strong>只读</strong>
              <small>{preferLocaleValue(hydraulicDiagnosticCurrent?.reviewBoundary, "不自动降泵，不直接判定末端阀门故障。")}</small>
            </article>
          </div>

          {hydraulicRiskIndicators.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {hydraulicRiskIndicators.map((indicator) => {
                const evidence = Array.isArray(indicator.evidence)
                  ? indicator.evidence.filter(Boolean).slice(0, 2).join(" / ")
                  : "";
                const requiredEvidence = Array.isArray(indicator.requiredEvidence)
                  ? indicator.requiredEvidence.filter(Boolean).slice(0, 3).join(" / ")
                  : "";
                return (
                  <article className="optimize-response-card" key={indicator.key || indicator.label}>
                    <span>{preferLocaleValue(indicator.label, "水力风险指示")}</span>
                    <strong>{localizeHydraulicRiskStatus(indicator.status)}</strong>
                    <small>
                      {formatInstrumentReviewValue(indicator.value, indicator.unit)}
                      {indicator.threshold ? ` / 阈值 ${indicator.threshold}` : ""}
                    </small>
                    <small>{preferLocaleValue(indicator.reason, "等待支路和末端证据。")}</small>
                    {evidence ? <small>证据：{evidence}</small> : null}
                    {indicator.reviewTarget ? <small>复核对象：{preferLocaleValue(indicator.reviewTarget, "现场复核对象")}</small> : null}
                    {requiredEvidence ? <small>需补：{requiredEvidence}</small> : null}
                    <small>{preferLocaleValue(indicator.boundary, "只读风险提示，不自动控制。")}</small>
                    <StatusPill
                      label={localizeHydraulicRiskStatus(indicator.status)}
                      tone={mapHydraulicRiskTone(indicator.status, indicator.severity)}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无水力平衡详情；缺支路、旁通或趋势信号时只保留方向性审阅。</p>
          )}

          {hydraulicFieldReviewTargets.length ? (
            <details className="optimize-more-details">
              <summary>水力现场复核对象</summary>
              <div className="optimize-response-grid optimize-response-grid-execution">
                {hydraulicFieldReviewTargets.map((target) => {
                  const requiredEvidence = Array.isArray(target.requiredEvidence)
                    ? target.requiredEvidence.filter(Boolean).slice(0, 4).join(" / ")
                    : "";
                  return (
                    <article className="optimize-response-card" key={target.key || target.title}>
                      <span>{String(target.priority || "P1").trim()}</span>
                      <strong>{preferLocaleValue(target.title, "水力现场复核对象")}</strong>
                      <small>{preferLocaleValue(target.trigger, "由水力风险指示触发。")}</small>
                      {requiredEvidence ? <small>证据：{requiredEvidence}</small> : null}
                      <small>{preferLocaleValue(target.acceptanceCriteria, "形成复核记录后再提高置信度。")}</small>
                      <small>{preferLocaleValue(target.boundary, "不自动降泵，不直接判定末端阀门故障。")}</small>
                    </article>
                  );
                })}
              </div>
            </details>
          ) : null}

          <div className="optimize-response-header optimize-response-header-secondary">
            <div>
              <strong>控制震荡 V1</strong>
              <p>只输出温差锯齿波、总功率 hunting、频率/启停事件缺口和现场复核对象；不自动改 PID，不自动启停设备。</p>
            </div>
            <StatusPill
              label={controlOscillationV1Summary}
              tone={controlOscillationActiveRiskCount > 0 || controlOscillationGapCount > 0 ? "warn" : "neutral"}
            />
          </div>

          <div className="optimize-response-grid">
            <article className="optimize-response-card">
              <span>趋势窗口</span>
              <strong>{localizeControlOscillationRiskStatus(controlOscillationDiagnosticCurrent?.trendWindow?.status)}</strong>
              <small>{controlOscillationTrendSummary}</small>
            </article>
            <article className="optimize-response-card">
              <span>控制风险指示</span>
              <strong>
                {formatNumber(controlOscillationActiveRiskCount, 0)} / {formatNumber(controlOscillationRiskIndicators.length, 0)}
              </strong>
              <small>
                观察 {formatNumber(controlOscillationWatchRiskCount, 0)} / 缺口 {formatNumber(controlOscillationGapCount, 0)} / 正常{" "}
                {formatNumber(controlOscillationNormalCount, 0)}
              </small>
            </article>
            <article className="optimize-response-card">
              <span>现场复核对象</span>
              <strong>{formatNumber(controlOscillationFieldReviewTargets.length, 0)}</strong>
              <small>命令/反馈高频趋势、启停事件和 PID 参数台账</small>
            </article>
            <article className="optimize-response-card">
              <span>台账导入</span>
              <strong>{localizeControlLedgerEvidenceStatus(controlOscillationLedgerStatus)}</strong>
              <small>{controlOscillationLedgerSummary}</small>
              <small>
                {controlOscillationLedgerEvidence?.usableForDiagnosis
                  ? "只作为证据窗口，不自动改 PID 或启停"
                  : "样本不足或未接入时只审阅"}
              </small>
              <StatusPill
                label={localizeControlLedgerEvidenceStatus(controlOscillationLedgerStatus)}
                tone={mapControlLedgerEvidenceTone(controlOscillationLedgerStatus)}
              />
            </article>
            <article className="optimize-response-card">
              <span>现场CSV预检</span>
              <strong>{localizeFieldDataPreflightStatus(controlOscillationFieldPreflightStatus)}</strong>
              <small>{controlOscillationFieldPreflightSummary}</small>
              <small>
                {controlOscillationFieldPreflight?.readyForImport
                  ? "需正式导入 latest 后才作为诊断证据"
                  : "只校验文件和字段，不改变当前证据"}
              </small>
              <StatusPill
                label={localizeFieldDataPreflightStatus(controlOscillationFieldPreflightStatus)}
                tone={mapFieldDataPreflightTone(controlOscillationFieldPreflightStatus)}
              />
            </article>
            <article className="optimize-response-card">
              <span>正式导入Gate</span>
              <strong>{localizeFieldDataPromoteStatus(controlOscillationFieldPromotionStatus)}</strong>
              <small>{controlOscillationFieldPromotionSummary}</small>
              <small>
                {controlOscillationFieldPromotion?.formalImportReady
                  ? "已进入正式 latest，仍只读诊断"
                  : "预检未 READY 时不覆盖正式证据"}
              </small>
              <StatusPill
                label={localizeFieldDataPromoteStatus(controlOscillationFieldPromotionStatus)}
                tone={mapFieldDataPromoteTone(controlOscillationFieldPromotionStatus)}
              />
            </article>
            <article className="optimize-response-card">
              <span>复核边界</span>
              <strong>只读</strong>
              <small>{preferLocaleValue(controlOscillationDiagnosticCurrent?.reviewBoundary, "不自动改 PID，不自动启停设备。")}</small>
            </article>
          </div>

          {controlOscillationRiskIndicators.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {controlOscillationRiskIndicators.map((indicator) => {
                const evidence = Array.isArray(indicator.evidence)
                  ? indicator.evidence.filter(Boolean).slice(0, 3).join(" / ")
                  : "";
                const requiredEvidence = Array.isArray(indicator.requiredEvidence)
                  ? indicator.requiredEvidence.filter(Boolean).slice(0, 3).join(" / ")
                  : "";
                return (
                  <article className="optimize-response-card" key={indicator.key || indicator.label}>
                    <span>{preferLocaleValue(indicator.label, "控制风险指示")}</span>
                    <strong>{localizeControlOscillationRiskStatus(indicator.status)}</strong>
                    <small>
                      {formatInstrumentReviewValue(indicator.value, indicator.unit)}
                      {indicator.threshold ? ` / 阈值 ${indicator.threshold}` : ""}
                    </small>
                    <small>{preferLocaleValue(indicator.reason, "等待命令/反馈和启停事件证据。")}</small>
                    {evidence ? <small>证据：{evidence}</small> : null}
                    {indicator.reviewTarget ? <small>复核对象：{preferLocaleValue(indicator.reviewTarget, "现场复核对象")}</small> : null}
                    {requiredEvidence ? <small>需补：{requiredEvidence}</small> : null}
                    <small>{preferLocaleValue(indicator.boundary, "只读风险提示，不自动改控制参数。")}</small>
                    <StatusPill
                      label={localizeControlOscillationRiskStatus(indicator.status)}
                      tone={mapControlOscillationRiskTone(indicator.status, indicator.severity)}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无控制震荡详情；缺趋势、命令/反馈或启停事件时只保留方向性审阅。</p>
          )}

          {controlOscillationFieldReviewTargets.length ? (
            <details className="optimize-more-details">
              <summary>控制震荡现场复核对象</summary>
              <div className="optimize-response-grid optimize-response-grid-execution">
                {controlOscillationFieldReviewTargets.map((target) => {
                  const requiredEvidence = Array.isArray(target.requiredEvidence)
                    ? target.requiredEvidence.filter(Boolean).slice(0, 4).join(" / ")
                    : "";
                  return (
                    <article className="optimize-response-card" key={target.key || target.title}>
                      <span>{String(target.priority || "P1").trim()}</span>
                      <strong>{preferLocaleValue(target.title, "控制震荡现场复核对象")}</strong>
                      <small>{preferLocaleValue(target.trigger, "由控制震荡风险指示触发。")}</small>
                      {requiredEvidence ? <small>证据：{requiredEvidence}</small> : null}
                      <small>{preferLocaleValue(target.acceptanceCriteria, "形成复核记录后再提高置信度。")}</small>
                      <small>{preferLocaleValue(target.boundary, "不自动改 PID，不自动启停设备。")}</small>
                    </article>
                  );
                })}
              </div>
            </details>
          ) : null}

          {operationalDiagnosticItems.length ? (
            <div className="optimize-response-grid optimize-response-grid-execution">
              {operationalDiagnosticItems.map((item) => {
                const primaryEvidence = Array.isArray(item.evidence) ? item.evidence.slice(0, 2) : [];
                return (
                  <article className="optimize-response-card" key={item.key || item.title}>
                    <span>{preferLocaleValue(item.title, "诊断项")}</span>
                    <strong>{localizeOperationalDiagnosticStatus(item.status)}</strong>
                    <small>{summarizeOperationalDiagnosticItem(item)}</small>
                    {primaryEvidence.length ? (
                      <small>
                        {primaryEvidence
                          .map((evidence) => `${preferLocaleValue(evidence.label, "证据")} ${formatOperationalEvidenceValue(evidence)}`)
                          .join(" / ")}
                      </small>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>暂无运行诊断摘要；缺实时点位时只保留审阅，不输出可执行承诺。</p>
          )}

          <details className="optimize-more-details">
            <summary>诊断边界</summary>
            <ul className="optimize-decision-list">
              {(operationalDiagnosticsAdvisor?.disclaimers || [
                "本 Advisor 只做只读诊断和 shadow 评审证据。",
                "多机运行无单台冷冻水流量时，不计算单台主机 COP。"
              ]).map((item, index) => (
                <li key={item + "-" + String(index + 1)}>{preferLocaleValue(item, "只读诊断边界。")}</li>
              ))}
            </ul>
          </details>
        </div>
      </SectionCard>
      ) : null}

      <div className="optimize-governance-grid">
        <SectionCard
          title="接近度影子审批"
          action={
            <div className="optimize-scheme-badges">
              <StatusPill label={towerActionState.label} tone={normalizeActionTone(towerActionState.tone)} />
            </div>
          }
        >
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>{nextAction.label}</strong>
                <p>{nextAction.hint}</p>
              </div>
              <StatusPill label={pageModeLabel} tone={readOnlyMode ? "warn" : "neutral"} />
            </div>

            <details className="optimize-more-details optimize-action-details" open>
              <summary>审批动作</summary>
              <div className="optimize-execution-actions is-secondary">
                <button
                  type="button"
                  className={
                    canSubmitTowerApproach
                      ? "scene-open-link optimize-action-button is-primary"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="submit-tower-approach"
                  disabled={!canSubmitTowerApproach}
                  onClick={() => {
                    void submitTowerApproachExecution();
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "提交接近度审批"}
                </button>
                <button
                  type="button"
                  className={
                    canApproveTowerApproach
                      ? "scene-open-link optimize-action-button is-approve"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="approve-tower-approach"
                  disabled={!canApproveTowerApproach}
                  onClick={() => {
                    if (pendingTowerApproachExecution?.executionId) {
                      void approveExecution(pendingTowerApproachExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "批准影子记录"}
                </button>
                <button
                  type="button"
                  className={
                    canDispatchTowerApproach
                      ? "scene-open-link optimize-action-button is-shadow"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="dispatch-tower-approach"
                  disabled={!canDispatchTowerApproach}
                  onClick={() => {
                    if (approvedTowerApproachExecution?.executionId) {
                      void dispatchExecution(approvedTowerApproachExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "写入影子记录"}
                </button>
                <button
                  type="button"
                  className={
                    canRollbackTowerApproach
                      ? "scene-open-link optimize-action-button is-danger"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="rollback-tower-approach"
                  disabled={!canRollbackTowerApproach}
                  onClick={() => {
                    if (approvedTowerApproachExecution?.executionId) {
                      void rollbackExecution(approvedTowerApproachExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "回退影子记录"}
                </button>
                <button
                  type="button"
                  className={
                    details
                      ? "scene-open-link optimize-action-button is-secondary"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="refresh"
                  disabled={!details || executionLoading}
                  onClick={() => {
                    void reloadExecutions();
                  }}
                >
                  {executionLoading ? zhCN.optimizeDemo.executionLoading : zhCN.optimizeDemo.executionRefresh}
                </button>
              </div>
              {executionError ? <p>{executionError}</p> : null}
            </details>

            <div className="optimize-response-grid optimize-response-grid-execution">
              <article className="optimize-response-card optimize-response-card-wide">
                <span>本次建议</span>
                <strong>
                  {formatTemperature(towerApproachAdvisor?.targetApproachC)} / {formatTemperature(towerApproachAdvisor?.targetTcwsC)}
                </strong>
                <small>{requestDelta}</small>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionLatestId}</span>
                <strong>{towerApproachLatestExecution?.executionId || zhCN.optimizeDemo.pendingValue}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionLatestStatus}</span>
                <strong>{localizeExecutionStatus(towerApproachLatestExecution?.status)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.executionLatestTarget}</span>
                <strong>{formatExecutionTargetSummary(towerApproachLatestExecution)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{localizeExecutionMetaLabel("guardrailSnapshot")}</span>
                <strong>{formatExecutionGuardrailSnapshot(towerApproachLatestExecution)}</strong>
              </article>
              <article className="optimize-response-card optimize-response-card-wide">
                <span>{localizeExecutionMetaLabel("rollbackTarget")}</span>
                <strong>{formatExecutionRollbackTarget(towerApproachLatestExecution)}</strong>
              </article>
            </div>

            <details className="optimize-more-details">
              <summary>接近度影子记录</summary>
              {renderExecutionHistoryItems(towerApproachExecutionHistory)}
            </details>
          </div>
        </SectionCard>

        <SectionCard
          title="泵频率修正影子审批"
          action={
            <div className="optimize-scheme-badges">
              <StatusPill label={pumpDeltaTStatusLabel} tone={pumpDeltaTStatusTone} />
              <StatusPill label={pumpActionState.label} tone={normalizeActionTone(pumpActionState.tone)} />
            </div>
          }
        >
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>泵频率修正目标</strong>
              </div>
              <StatusPill
                label={pumpDeltaTBoundaryLabel}
                tone="neutral"
              />
            </div>

            <details className="optimize-more-details optimize-action-details" open>
              <summary>审批动作</summary>
              <div className="optimize-execution-actions is-secondary">
                <button
                  type="button"
                  className={
                    canSubmitPumpDeltaT
                      ? "scene-open-link optimize-action-button is-primary"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="submit-pump-delta-t"
                  disabled={!canSubmitPumpDeltaT}
                  onClick={() => {
                    void submitPumpDeltaTExecution();
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "提交泵频审批"}
                </button>
                <button
                  type="button"
                  className={
                    canApprovePumpDeltaT
                      ? "scene-open-link optimize-action-button is-approve"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="approve-pump-delta-t"
                  disabled={!canApprovePumpDeltaT}
                  onClick={() => {
                    if (pendingPumpDeltaTExecution?.executionId) {
                      void approveExecution(pendingPumpDeltaTExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "批准泵影子记录"}
                </button>
                <button
                  type="button"
                  className={
                    canDispatchPumpDeltaT
                      ? "scene-open-link optimize-action-button is-shadow"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="dispatch-pump-delta-t"
                  disabled={!canDispatchPumpDeltaT}
                  onClick={() => {
                    if (approvedPumpDeltaTExecution?.executionId) {
                      void dispatchExecution(approvedPumpDeltaTExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : pumpDeltaTAssistedReady ? "写入泵影子记录" : "PLC锁定"}
                </button>
                <button
                  type="button"
                  className={
                    canRollbackPumpDeltaT
                      ? "scene-open-link optimize-action-button is-danger"
                      : "scene-open-link optimize-action-button is-disabled"
                  }
                  data-execution-action="rollback-pump-delta-t"
                  disabled={!canRollbackPumpDeltaT}
                  onClick={() => {
                    if (approvedPumpDeltaTExecution?.executionId) {
                      void rollbackExecution(approvedPumpDeltaTExecution);
                    }
                  }}
                >
                  {executionSubmitting ? zhCN.optimizeDemo.executionSubmitting : "回退泵影子记录"}
                </button>
              </div>
              {executionError ? <p>{executionError}</p> : null}
            </details>

            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>冷冻水温差</span>
                <strong>{formatTemperature(pumpDeltaTAdvisor?.current?.chilledDeltaT)}</strong>
                <small>{formatTowerApproachBand(pumpDeltaTAdvisor?.targetBandsC?.chilledDeltaT)}</small>
              </article>
              <article className="optimize-response-card">
                <span>冷冻泵修正量</span>
                <strong>{formatTrimHz(pumpDeltaTAdvisor?.outputTargets?.chilledPumpFreqTrimHz)}</strong>
                <small>冷冻泵频率修正点</small>
              </article>
              <article className="optimize-response-card">
                <span>冷却水温差</span>
                <strong>{formatTemperature(pumpDeltaTAdvisor?.current?.coolingDeltaT)}</strong>
                <small>{formatTowerApproachBand(pumpDeltaTAdvisor?.targetBandsC?.coolingDeltaT)}</small>
              </article>
              <article className="optimize-response-card">
                <span>冷却泵修正量</span>
                <strong>{formatTrimHz(pumpDeltaTAdvisor?.outputTargets?.coolingPumpFreqTrimHz)}</strong>
                <small>冷却泵频率修正点</small>
              </article>
              <article className="optimize-response-card optimize-response-card-wide">
                <span>有效时长 / 限幅 / 回退闭锁</span>
                <strong>{pumpTrimSafetySummary}</strong>
                <small>闭锁{formatPumpRollbackLockout(pumpDeltaTAdvisor)} · 周期5min · 单步1Hz</small>
              </article>
              <article className="optimize-response-card">
                <span>真实下发</span>
                <strong>{pumpDeltaTAssistedReady ? "可写影子记录" : "PLC锁定"}</strong>
                <small>{pumpDeltaTMappingLabel}</small>
              </article>
            </div>

            {pumpPrimaryBlockers.length ? (
              <div className="optimize-response-block optimize-decision-panel">
                <h4>阻塞</h4>
                <ul className="optimize-decision-list is-blockers">
                  {pumpPrimaryBlockers.map((item, index) => (
                    <li key={item + '-' + String(index + 1)}>{preferLocaleValue(item, zhCN.optimizeDemo.pendingValue)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="optimize-more-details">
              <summary>泵降频影子记录</summary>
              <div className="optimize-response-grid optimize-response-grid-execution">
                <article className="optimize-response-card">
                  <span>{zhCN.optimizeDemo.executionLatestId}</span>
                  <strong>{pumpDeltaTLatestExecution?.executionId || zhCN.optimizeDemo.pendingValue}</strong>
                </article>
                <article className="optimize-response-card">
                  <span>{zhCN.optimizeDemo.executionLatestStatus}</span>
                  <strong>{localizeExecutionStatus(pumpDeltaTLatestExecution?.status)}</strong>
                </article>
                <article className="optimize-response-card">
                  <span>{zhCN.optimizeDemo.executionLatestTarget}</span>
                  <strong>{formatExecutionTargetSummary(pumpDeltaTLatestExecution)}</strong>
                </article>
              </div>
              {renderExecutionHistoryItems(pumpDeltaTExecutionHistory)}
            </details>
          </div>
        </SectionCard>

        <SectionCard
          title="边界与主机组合"
          action={<StatusPill label="真实PLC锁定" tone="warn" />}
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              <span>
                <strong>AI输出</strong>
                <em>仅目标值/建议值</em>
              </span>
              <span>
                <strong>PLC边界</strong>
                <em>限幅、防震荡、闭锁、回退</em>
              </span>
              <span>
                <strong>回退触发</strong>
                <em>{rollbackTriggerSummary}</em>
              </span>
              <span>
                <strong>主机组合</strong>
                <em>{chillerCurrentCombinationSummary}，保持当前</em>
              </span>
              <span>
                <strong>阻塞原因</strong>
                <em>{compactBlockers[0] || "暂无新增阻塞"}</em>
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="optimize-support-grid">
        <SectionCard
          title="数据可信度"
          action={
            <div className="optimize-scheme-badges">
              <StatusPill label={sourceSummary.text} tone={sourceSummary.warn ? "warn" : "good"} />
              <StatusPill label={reviewReadinessStatusLabel} tone={reviewReadinessStatusTone} />
            </div>
          }
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              <span>
                <strong>信号完整度</strong>
                <em>{signalQualityLabel}</em>
              </span>
              <span>
                <strong>当前COP</strong>
                <em>{formatNumber(baseline.systemCop, 2)}</em>
              </span>
              <span>
                <strong>冷却塔功率</strong>
                <em>{formatNumber(baseline.coolingTowerPowerKw)} kW</em>
              </span>
              <span>
                <strong>告警数</strong>
                <em>{formatNumber(baseline.activeAlarmCount, 0)}</em>
              </span>
            </div>
          </div>
        </SectionCard>

	        <SectionCard
	          title="主机组合样本"
	          action={<StatusPill label={chillerSampleGovernanceLabel} tone={chillerSampleGovernanceTone} />}
	        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              <span>
                <strong>当前组合</strong>
                <em>{chillerCurrentCombinationSummary}</em>
              </span>
              <span>
                <strong>样本总量</strong>
                <em>{chillerSampleTotalSummary}</em>
              </span>
	              <span>
	                <strong>当前组合样本</strong>
	                <em>{formatNumber(chillerSampleGovernance?.currentCombinationSamples ?? chillerSampleSummary?.currentCombinationSamples, 0)}</em>
	              </span>
	              <span>
	                <strong>可比目标</strong>
	                <em>{formatNumber(chillerSampleGovernance?.sameBandReadyCandidateCount, 0)} 个</em>
	              </span>
	              <span>
	                <strong>推荐动作</strong>
                <em>{chillerSampleActionSummary}</em>
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="信息完整性检查" action={<StatusPill label="无遗漏" tone="good" />}>
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              {informationCompletenessRows.map((item) => (
                <span key={item.label}>
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="甲方演示 readiness"
          action={<StatusPill label="CLIENT_DEMO_READY_SHADOW_PENDING" tone="warn" />}
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              {clientDemoReadinessRows.map((item) => (
                <span key={item.label} title={item.note}>
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </span>
              ))}
            </div>
            {fieldCollectionFormalInputs.length ? (
              <div className="optimize-response-block optimize-decision-panel">
                <h4>正式 CSV 缺口明细</h4>
                <ul className="optimize-decision-list is-checks">
                  {fieldCollectionFormalInputs.map((item) => (
                    <li key={item.key || item.path || item.label || "formal-input"}>
                      <strong>{item.label || item.key || "现场 CSV"}</strong>
                      ：{item.path || "待确认路径"} · {localizeFormalInputStatus(item.status)}
                      {item.status === "present_with_rows" ? ` · ${formatNumber(item.lineCount, 0)} 行` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="人工审阅门禁"
          action={<StatusPill label="仅审阅" tone="warn" />}
        >
          <div className="optimize-response">
            <div className="optimize-boundary-list optimize-boundary-list-compact">
              <span>
                <strong>suite</strong>
                <em>先跑 140 shadow suite</em>
              </span>
              <span>
                <strong>Advisor 合同</strong>
                <em>ADVISOR_CONTRACT_READY</em>
              </span>
              <span>
                <strong>UI 边界</strong>
                <em>UI_BOUNDARY_COPY_READY</em>
              </span>
              <span>
                <strong>控制副作用</strong>
                <em>NO_CONTROL_MUTATION</em>
              </span>
              <span>
                <strong>塔侧</strong>
                <em>GO_SHADOW</em>
              </span>
              <span>
                <strong>泵侧</strong>
                <em>GO_SHADOW_ONLY</em>
              </span>
              <span>
                <strong>治理</strong>
                <em>GO_SHADOW_PENDING</em>
              </span>
              <span>
                <strong>一票否决</strong>
                <em>任一 gate 失败停止审阅</em>
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="影子验证记录"
          action={<StatusPill label="人工记录" tone="warn" />}
        >
          {renderShadowVerificationRecordPanel()}
        </SectionCard>
      </div>
        </>
      )}

    </div>
  );
}

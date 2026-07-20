import { buildGeneratedAt } from "./fieldPolicyService.js";
import {
  buildExecutionFeedback,
  buildOptimizeExecutionFeedbackSnapshot
} from "./optimizeService.js";
import { listOptimizeExecutions, getOptimizeExecutionOverview } from "./optimizeExecutionService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const THERMAL_UNBALANCE_CAUTION_RATE = 0.15;

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dedupeTextList(items, limit = 6) {
  const values = Array.isArray(items) ? items : [];
  return Array.from(
    new Set(
      values
        .map((item) => normalizeOptionalText(item))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function buildFreshnessSnapshot(freshness) {
  const latestTimestamp = normalizeOptionalText(freshness?.latestTimestamp) || null;
  const stale = freshness?.stale === true;
  return {
    label: latestTimestamp ? (stale ? "stale" : "fresh") : "unknown",
    latestTimestamp,
    stale,
    ageHours: typeof freshness?.ageHours === "number" && Number.isFinite(freshness.ageHours) ? freshness.ageHours : null
  };
}

function buildDatasetSourceEntry(key, endpoint, data, fallbackMessage) {
  const overall = data?.sourceStatus?.overall || "failed";
  const sources = Array.isArray(data?.sourceStatus?.sources) ? data.sourceStatus.sources : [];
  const ok = overall === "ok" || overall === "partial";
  return {
    key,
    endpoint,
    ok,
    fallback: overall === "partial" || sources.some((source) => source?.fallback === true),
    reasonCode: ok ? "ready" : "unavailable",
    status: null,
    message: overall,
    error: ok ? null : fallbackMessage,
    rows: sources.length > 0 ? sources.length : null
  };
}

function buildExecutionSourceEntry(siteId, recentExecutions, executionOverview) {
  return {
    key: "optimizeExecutions",
    endpoint: `/bff/v1/sites/${siteId}/optimize/executions`,
    ok: true,
    fallback: false,
    reasonCode: "ready",
    status: null,
    message: "ok",
    error: null,
    rows: Array.isArray(recentExecutions)
      ? recentExecutions.length
      : asFiniteNumber(executionOverview?.pendingApprovalCount) ?? 0
  };
}

function createIssue(code, domain, level, message) {
  return {
    code,
    domain,
    level,
    message
  };
}

function buildOperationsAssessment(baseline, anomalies, freshness, sourceStatus, recommendations) {
  const blockers = [];
  const risks = [];
  const criticalCount = anomalies?.counts?.critical ?? 0;
  const majorCount = anomalies?.counts?.major ?? 0;
  const totalAlarmCount = anomalies?.counts?.total ?? 0;
  const thermalUnbalanceRate = asFiniteNumber(baseline?.thermalUnbalanceRate);
  const highRiskRecommendationCount = recommendations?.summary?.highRisk ?? 0;

  if (sourceStatus?.overall === "failed") {
    blockers.push(
      createIssue("source_status_failed", "data", "blocked", "当前 AI 依赖数据源不可用，应先修复数据链路。")
    );
  } else if (sourceStatus?.overall === "partial") {
    risks.push(
      createIssue("source_status_partial", "data", "caution", "当前 AI 依赖数据源部分降级，建议带着保守边界使用。")
    );
  }

  if (freshness?.stale === true) {
    blockers.push(
      createIssue(
        "data_stale",
        "data",
        "blocked",
        "当前关键数据已陈旧，先核对原始页面或现场，再决定是否发起新一轮优化。"
      )
    );
  }

  if (criticalCount > 0) {
    blockers.push(
      createIssue(
        "critical_alarm_present",
        "operations",
        "blocked",
        `当前存在 ${criticalCount} 条 critical 告警，应先稳定运行。`
      )
    );
  }

  if (majorCount > 0) {
    blockers.push(
      createIssue(
        "major_alarm_present",
        "operations",
        "blocked",
        `当前存在 ${majorCount} 条 major 告警，应先处理异常再推进优化。`
      )
    );
  }

  if (totalAlarmCount > 0 && criticalCount === 0 && majorCount === 0) {
    risks.push(
      createIssue(
        "active_alarm_present",
        "operations",
        "caution",
        `当前仍有 ${totalAlarmCount} 条活动告警，建议带着观察边界推进。`
      )
    );
  }

  if (thermalUnbalanceRate !== null && thermalUnbalanceRate >= THERMAL_UNBALANCE_CAUTION_RATE) {
    risks.push(
      createIssue(
        "thermal_unbalance_high",
        "operations",
        "caution",
        `当前热不平衡率 ${thermalUnbalanceRate.toFixed(2)} 偏高，建议优先收敛系统平衡。`
      )
    );
  }

  if (highRiskRecommendationCount > 0) {
    risks.push(
      createIssue(
        "high_risk_recommendations",
        "optimization",
        "caution",
        `当前存在 ${highRiskRecommendationCount} 条高风险建议，提交前应明确审批边界。`
      )
    );
  }

  const level = blockers.length > 0 ? "blocked" : risks.length > 0 ? "caution" : "ready";
  const summary =
    blockers[0]?.message
    || risks[0]?.message
    || "当前数据与治理状态允许进入下一轮优化评审。";

  return {
    level,
    summary,
    reasonCodes: [...blockers, ...risks].map((item) => item.code),
    blockers,
    risks
  };
}

function buildGovernanceSnapshot(executionFeedback) {
  return {
    status: executionFeedback?.status || "idle",
    summary: executionFeedback?.summary || "当前没有治理执行记录。",
    outcomeClass: executionFeedback?.outcomeClass || "none",
    pendingApprovalCount: executionFeedback?.pendingApprovalCount ?? 0,
    approvedCount: executionFeedback?.approvedCount ?? 0,
    rolledBackCount: executionFeedback?.rolledBackCount ?? 0,
    latestExecutionId: executionFeedback?.latestExecutionId || null,
    latestExecutionStatus: executionFeedback?.latestExecutionStatus || null,
    latestExecutionAt: executionFeedback?.latestExecutionAt || null,
    latestExecutionType: executionFeedback?.latestExecutionType || null,
    latestDispatchStatus: executionFeedback?.latestDispatchStatus || null,
    approveDispatchStatus: executionFeedback?.approveDispatchStatus || null,
    approveDispatchCode: executionFeedback?.approveDispatchCode || null,
    approveDispatchMode: executionFeedback?.approveDispatchMode || null,
    rollbackDispatchStatus: executionFeedback?.rollbackDispatchStatus || null,
    rollbackDispatchCode: executionFeedback?.rollbackDispatchCode || null,
    latestObservedSnapshot: executionFeedback?.latestObservedSnapshot || null,
    observedBaselineComparison: executionFeedback?.observedBaselineComparison || null,
    observedTargetComparison: executionFeedback?.observedTargetComparison || null,
    signals: Array.isArray(executionFeedback?.signals) ? executionFeedback.signals : []
  };
}

function buildGovernanceAssessment(governance) {
  const blockers = [];
  const risks = [];

  if ((governance?.pendingApprovalCount ?? 0) > 0) {
    blockers.push(
      createIssue(
        "pending_approval_exists",
        "governance",
        "blocked",
        `当前已有 ${governance.pendingApprovalCount} 条待审批治理动作，应先处理审批结果。`
      )
    );
  }

  if (governance?.status === "rollback-watch") {
    risks.push(
      createIssue("rollback_watch", "governance", "caution", governance.summary || "最近治理动作处于回退观察态。")
    );
  }

  if (governance?.observedBaselineComparison?.status === "degraded") {
    risks.push(
      createIssue(
        "observed_baseline_degraded",
        "governance",
        "caution",
        governance.observedBaselineComparison.summary || "最近一次执行回采相对提交前退化。"
      )
    );
  }

  if (governance?.observedTargetComparison?.status === "missed") {
    risks.push(
      createIssue(
        "observed_target_missed",
        "governance",
        "caution",
        governance.observedTargetComparison.summary || "最近一次执行回采未达到提交目标。"
      )
    );
  }

  return {
    blockers,
    risks
  };
}

function buildRecommendationSnapshot(recommendations) {
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards : [];
  const primaryCard = cards[0] || null;
  return {
    total: cards.length,
    highRisk: recommendations?.summary?.highRisk ?? cards.filter((card) => card?.risk === "high").length,
    criticalSeverity:
      recommendations?.summary?.criticalSeverity ?? cards.filter((card) => card?.severity === "critical").length,
    primaryTitle: normalizeOptionalText(primaryCard?.title) || null,
    primaryReason: normalizeOptionalText(primaryCard?.reason) || null,
    primaryActions: dedupeTextList(primaryCard?.actions, 3)
  };
}

function buildMetricsSnapshot(baseline, anomalies, recommendationSnapshot, governance) {
  return {
    systemCop: asFiniteNumber(baseline?.systemCop),
    totalPowerKw: asFiniteNumber(baseline?.totalPowerKw),
    activeAlarmCount: anomalies?.counts?.total ?? asFiniteNumber(baseline?.activeAlarmCount),
    thermalUnbalanceRate: asFiniteNumber(baseline?.thermalUnbalanceRate),
    recommendationCount: recommendationSnapshot.total,
    highRiskRecommendationCount: recommendationSnapshot.highRisk,
    pendingApprovalCount: governance.pendingApprovalCount,
    approvedExecutionCount: governance.approvedCount,
    rolledBackExecutionCount: governance.rolledBackCount
  };
}

function buildStage(operationsGate, governance, recommendationSnapshot) {
  if ((governance?.pendingApprovalCount ?? 0) > 0) {
    return "await-approval";
  }
  if (operationsGate.level === "blocked") {
    return "stabilize";
  }
  if (governance?.status === "rollback-watch") {
    return "rollback-watch";
  }
  if (governance?.latestObservedSnapshot) {
    return "observe-outcome";
  }
  if (recommendationSnapshot.total > 0) {
    return "optimize-ready";
  }
  return "monitor";
}

function buildSummary(stage, operationsGate, governance, recommendationSnapshot, freshness, sourceStatus) {
  let label = "持续观察";
  let headline = "当前以持续观察为主";
  let tone = "neutral";

  if (stage === "stabilize") {
    label = "先稳态";
    headline = "先稳定运行，再谈优化";
    tone = "danger";
  } else if (stage === "await-approval") {
    label = "待审批";
    headline = "当前已有待审批治理动作";
    tone = "caution";
  } else if (stage === "rollback-watch") {
    label = "回退观察";
    headline = "最近治理记录进入回退观察";
    tone = "danger";
  } else if (stage === "observe-outcome") {
    label = "回采观察";
    headline = "最近治理动作已有回采结果";
    tone = "caution";
  } else if (stage === "optimize-ready") {
    label = "可评审";
    headline = "当前可进入新一轮优化评审";
    tone = "positive";
  }

  const confidence =
    sourceStatus?.overall === "ok" && freshness?.stale !== true
      ? "high"
      : sourceStatus?.overall === "partial" && freshness?.stale !== true
        ? "medium"
        : "low";

  const summary =
    stage === "stabilize"
      ? operationsGate.summary
      : stage === "await-approval"
        ? governance.summary
        : stage === "rollback-watch"
          ? governance.summary
          : stage === "observe-outcome"
            ? governance.summary
            : recommendationSnapshot.total > 0
              ? `${headline}，当前有 ${recommendationSnapshot.total} 条建议可供评审。`
              : `${headline}，当前未识别出需要立即发起的治理动作。`;

  return {
    stage,
    label,
    headline,
    summary,
    tone,
    confidence
  };
}

function buildNextAction(siteId, operationsGate, governance, recommendationSnapshot, blockers, risks) {
  if ((governance?.pendingApprovalCount ?? 0) > 0) {
    return {
      code: "review-pending-execution",
      label: "先处理待审批治理动作",
      summary: governance.summary,
      endpoint: `/bff/v1/sites/${siteId}/optimize/executions`
    };
  }

  if (operationsGate.level === "blocked") {
    return {
      code: "resolve-operations-blockers",
      label: "先处理运行阻塞项",
      summary: blockers[0]?.message || operationsGate.summary,
      endpoint: `/bff/v1/sites/${siteId}/anomalies/summary`
    };
  }

  if (governance?.status === "rollback-watch") {
    return {
      code: "inspect-rollback-history",
      label: "先复核回退原因与链路",
      summary: risks[0]?.message || governance.summary,
      endpoint: `/bff/v1/sites/${siteId}/optimize/executions`
    };
  }

  if (governance?.latestObservedSnapshot) {
    return {
      code: "review-observed-outcome",
      label: "先核对执行回采效果",
      summary:
        governance?.observedBaselineComparison?.summary
        || governance?.observedTargetComparison?.summary
        || governance.summary,
      endpoint: `/bff/v1/sites/${siteId}/optimize/executions`
    };
  }

  if (recommendationSnapshot.total > 0) {
    return {
      code: "open-optimize-draft",
      label: "进入新一轮优化评审",
      summary:
        recommendationSnapshot.primaryTitle
          ? `优先审阅“${recommendationSnapshot.primaryTitle}”对应方案。`
          : "当前已有建议卡，可进入优化评审。",
      endpoint: `/bff/v1/sites/${siteId}/optimize`
    };
  }

  return {
    code: "continue-monitoring",
    label: "继续观察站点现态",
    summary: "当前未出现必须立即推进的新治理动作，保持监控即可。",
    endpoint: `/bff/v1/sites/${siteId}/dashboard/overview`
  };
}

function buildSignals(operationsGate, governance, recommendationSnapshot, freshness) {
  const signals = [];

  if (operationsGate.summary) {
    signals.push(operationsGate.summary);
  }

  if (governance?.summary) {
    signals.push(governance.summary);
  }

  if (Array.isArray(governance?.signals)) {
    signals.push(...governance.signals);
  }

  if (recommendationSnapshot.primaryTitle) {
    signals.push(`当前首要建议：${recommendationSnapshot.primaryTitle}。`);
  }

  if (freshness?.latestTimestamp) {
    signals.push(`当前 AI 参考数据最新时间为 ${freshness.latestTimestamp}。`);
  }

  return dedupeTextList(signals, 5);
}

export async function buildSiteAiDigestResponse(config, siteId, context = {}) {
  const adminStore = context.adminStore || config?.adminStore;
  const overview = context.overview || null;
  const anomalies = context.anomalies || null;
  const recommendations = context.recommendations || null;
  const executionOverview =
    context.executionOverview && typeof context.executionOverview === "object"
      ? context.executionOverview
      : getOptimizeExecutionOverview(siteId, { adminStore });
  const recentExecutions = Array.isArray(context.recentExecutions)
    ? context.recentExecutions
    : listOptimizeExecutions(siteId, { limit: 6, adminStore }).items;

  const snapshot = buildOptimizeExecutionFeedbackSnapshot(overview, anomalies, { phase: "digest" });
  const freshness = buildFreshnessSnapshot(snapshot.freshness);
  const executionFeedback = buildExecutionFeedback([], {
    executionOverview,
    recentExecutions
  });
  const governance = buildGovernanceSnapshot(executionFeedback);
  const recommendationSnapshot = buildRecommendationSnapshot(recommendations);
  const sourceStatus = buildSourceStatus([
    buildDatasetSourceEntry(
      "dashboardOverview",
      `/bff/v1/sites/${siteId}/dashboard/overview`,
      overview,
      "dashboard overview unavailable"
    ),
    buildDatasetSourceEntry(
      "anomalySummary",
      `/bff/v1/sites/${siteId}/anomalies/summary`,
      anomalies,
      "anomaly summary unavailable"
    ),
    buildDatasetSourceEntry(
      "recommendations",
      `/bff/v1/sites/${siteId}/recommendations`,
      recommendations,
      "recommendations unavailable"
    ),
    buildExecutionSourceEntry(siteId, recentExecutions, executionOverview)
  ]);
  const operationsGate = buildOperationsAssessment(
    snapshot.baseline,
    anomalies,
    freshness,
    sourceStatus,
    recommendations
  );
  const governanceAssessment = buildGovernanceAssessment(governance);
  const blockers = [...operationsGate.blockers, ...governanceAssessment.blockers];
  const risks = [...operationsGate.risks, ...governanceAssessment.risks];
  const summary = buildSummary(
    buildStage(operationsGate, governance, recommendationSnapshot),
    operationsGate,
    governance,
    recommendationSnapshot,
    freshness,
    sourceStatus
  );

  return {
    site: {
      siteId,
      siteName: overview?.site?.siteName || anomalies?.site?.siteName || siteId
    },
    summary,
    operationsGate,
    governance,
    nextAction: buildNextAction(siteId, operationsGate, governance, recommendationSnapshot, blockers, risks),
    blockers,
    risks,
    signals: buildSignals(operationsGate, governance, recommendationSnapshot, freshness),
    metrics: buildMetricsSnapshot(snapshot.baseline, anomalies, recommendationSnapshot, governance),
    recommendations: recommendationSnapshot,
    freshness,
    sourceStatus,
    generatedAt: buildGeneratedAt(config)
  };
}

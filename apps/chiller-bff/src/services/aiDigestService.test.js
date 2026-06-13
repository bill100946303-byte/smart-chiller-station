import test from "node:test";
import assert from "node:assert/strict";

import { createAdminStore } from "../lib/admin-db.js";
import {
  approveOptimizeExecution,
  createOptimizeExecution,
  rollbackOptimizeExecution,
  validateCreateOptimizeExecutionRequest
} from "./optimizeExecutionService.js";
import { buildSiteAiDigestResponse } from "./aiDigestService.js";

const baseOverview = {
  site: {
    siteId: "btwentyfive",
    siteName: "B25"
  },
  energyCards: {
    currentCop: 4.2,
    totalPowerKw: 229.5,
    chilledDeltaT: 5.4,
    coolingDeltaT: 4.2,
    chillerPowerKw: 140,
    chilledPumpPowerKw: 36,
    coolingPumpPowerKw: 31,
    coolingTowerPowerKw: 22,
    chilledSupplyTemp: 7.1,
    coolingReturnTemp: 31.8,
    thermalUnbalanceRate: 0.08
  },
  freshness: {
    latestTimestamp: "2026-04-09T18:00:00.000+08:00",
    stale: false,
    ageHours: 0.5
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "overview", ok: true }]
  }
};

const baseAnomalies = {
  site: {
    siteId: "btwentyfive",
    siteName: "B25"
  },
  counts: {
    total: 1,
    critical: 0,
    major: 0,
    minor: 1
  },
  freshness: {
    latestTimestamp: "2026-04-09T17:55:00.000+08:00",
    stale: false,
    ageHours: 0.6
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "anomalies", ok: true }]
  }
};

const baseRecommendations = {
  summary: {
    total: 1,
    highRisk: 1,
    criticalSeverity: 0
  },
  cards: [
    {
      title: "优化冷却塔风机级数",
      reason: "当前冷却侧效率一般，存在进一步降功率空间。",
      risk: "high",
      severity: "major",
      actions: ["先核对冷却水温差", "再评审冷却塔风机级数"]
    }
  ],
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "recommendations", ok: true }]
  }
};

function createTestConfig(adminStore) {
  return {
    staleThresholdHours: 6,
    adminStore
  };
}

function createValidatedExecutionRequest(overrides = {}) {
  const result = validateCreateOptimizeExecutionRequest({
    draft: {
      baseline: {
        systemCop: 4.2,
        totalPowerKw: 229.5,
        activeAlarmCount: 1,
        thermalUnbalanceRate: 0.08
      }
    },
    execution: {
      type: "scheme",
      schemeKey: "balanced",
      title: "平衡方案",
      targetCop: 4.5,
      targetPowerKw: 220
    },
    approval: {
      required: true
    },
    ...overrides
  });
  assert.equal(result.ok, true);
  return result.request;
}

test("buildSiteAiDigestResponse blocks optimization when major alarms exist", async () => {
  const digest = await buildSiteAiDigestResponse(createTestConfig(null), "btwentyfive", {
    overview: baseOverview,
    anomalies: {
      ...baseAnomalies,
      counts: {
        total: 2,
        critical: 0,
        major: 1,
        minor: 1
      }
    },
    recommendations: baseRecommendations,
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 0,
      rolledBackCount: 0,
      latestExecutionId: null,
      latestExecutionStatus: null,
      latestExecutionAt: null
    },
    recentExecutions: []
  });

  assert.equal(digest.summary.stage, "stabilize");
  assert.equal(digest.summary.label, "先稳态");
  assert.equal(digest.operationsGate.level, "blocked");
  assert.ok(digest.blockers.some((item) => item.code === "major_alarm_present"));
  assert.equal(digest.nextAction.code, "resolve-operations-blockers");
});

test("buildSiteAiDigestResponse reads pending governance state from execution store", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  t.after(() => {
    adminStore.close();
  });

  const created = createOptimizeExecution("btwentyfive", createValidatedExecutionRequest(), {
    userId: "operator",
    adminStore,
    requestId: "req-create-pending"
  });

  const digest = await buildSiteAiDigestResponse(createTestConfig(adminStore), "btwentyfive", {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations
  });

  assert.equal(digest.summary.stage, "await-approval");
  assert.equal(digest.governance.status, "pending");
  assert.equal(digest.governance.latestExecutionId, created.executionId);
  assert.ok(digest.blockers.some((item) => item.code === "pending_approval_exists"));
  assert.equal(digest.nextAction.code, "review-pending-execution");
});

test("buildSiteAiDigestResponse exposes observed outcome after approved execution", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  t.after(() => {
    adminStore.close();
  });

  const created = createOptimizeExecution("btwentyfive", createValidatedExecutionRequest(), {
    userId: "operator",
    adminStore,
    requestId: "req-create-approved"
  });

  const approved = approveOptimizeExecution(
    "btwentyfive",
    created.executionId,
    {
      feedbackSnapshot: {
        phase: "approved",
        capturedAt: "2026-04-09T18:35:00.000+08:00",
        baseline: {
          systemCop: 4.6,
          totalPowerKw: 214.2,
          activeAlarmCount: 0,
          thermalUnbalanceRate: 0.06
        }
      },
      dispatch: {
        operation: "approve",
        mode: "shadow",
        status: "succeeded",
        code: "DISPATCH_OK"
      }
    },
    {
      userId: "site-admin",
      adminStore,
      requestId: "req-approve"
    }
  );
  assert.equal(approved.ok, true);

  const digest = await buildSiteAiDigestResponse(createTestConfig(adminStore), "btwentyfive", {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations
  });

  assert.equal(digest.summary.stage, "observe-outcome");
  assert.equal(digest.governance.status, "approved-history");
  assert.equal(digest.governance.observedBaselineComparison?.status, "improved");
  assert.equal(digest.governance.observedTargetComparison?.status, "met");
  assert.equal(digest.nextAction.code, "review-observed-outcome");
  assert.ok(digest.signals.some((item) => item.includes("审批后回采")));
});

test("buildSiteAiDigestResponse marks rollback-watch after execution rollback", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  t.after(() => {
    adminStore.close();
  });

  const created = createOptimizeExecution("btwentyfive", createValidatedExecutionRequest(), {
    userId: "operator",
    adminStore,
    requestId: "req-create-rollback"
  });

  const approved = approveOptimizeExecution(
    "btwentyfive",
    created.executionId,
    {
      feedbackSnapshot: {
        phase: "approved",
        capturedAt: "2026-04-09T18:35:00.000+08:00",
        baseline: {
          systemCop: 4.4,
          totalPowerKw: 222.8,
          activeAlarmCount: 0,
          thermalUnbalanceRate: 0.07
        }
      }
    },
    {
      userId: "site-admin",
      adminStore,
      requestId: "req-approve-rollback"
    }
  );
  assert.equal(approved.ok, true);

  const rolledBack = rollbackOptimizeExecution(
    "btwentyfive",
    created.executionId,
    {
      reason: "现场振荡，回退到手动",
      feedbackSnapshot: {
        phase: "rolled_back",
        capturedAt: "2026-04-09T18:50:00.000+08:00",
        baseline: {
          systemCop: 4.1,
          totalPowerKw: 231.4,
          activeAlarmCount: 1,
          thermalUnbalanceRate: 0.09
        }
      }
    },
    {
      userId: "site-admin",
      adminStore,
      requestId: "req-rollback"
    }
  );
  assert.equal(rolledBack.ok, true);

  const digest = await buildSiteAiDigestResponse(createTestConfig(adminStore), "btwentyfive", {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations
  });

  assert.equal(digest.summary.stage, "rollback-watch");
  assert.equal(digest.governance.status, "rollback-watch");
  assert.ok(digest.risks.some((item) => item.code === "rollback_watch"));
  assert.equal(digest.nextAction.code, "inspect-rollback-history");
});

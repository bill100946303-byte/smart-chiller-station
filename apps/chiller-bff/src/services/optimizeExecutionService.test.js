import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createAdminStore } from "../lib/admin-db.js";
import {
  __resetOptimizeExecutionStoreForTest,
  approveOptimizeExecution,
  createOptimizeExecution,
  getOptimizeExecutionOverview,
  listOptimizeExecutions,
  rollbackOptimizeExecution,
  validateCreateOptimizeExecutionRequest
} from "./optimizeExecutionService.js";

function createTempDbFile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "optimize-execution-"));
  return {
    dbFile: path.join(tempDir, "admin.sqlite"),
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

test("validateCreateOptimizeExecutionRequest rejects missing execution payload", () => {
  const result = validateCreateOptimizeExecutionRequest({});
  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateCreateOptimizeExecutionRequest accepts scheme payload and normalizes actions", () => {
  const result = validateCreateOptimizeExecutionRequest({
    draft: {
      baseline: {
        systemCop: 4.5,
        totalPowerKw: 220.4,
        activeAlarmCount: 1,
        thermalUnbalanceRate: 0.08
      }
    },
    execution: {
      type: "scheme",
      schemeKey: "balanced",
      actions: ["先稳住", "先稳住", "再提效"]
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.request.execution.actions, ["先稳住", "再提效"]);
  assert.deepEqual(result.request.draft.baseline, {
    systemCop: 4.5,
    totalPowerKw: 220.4,
    activeAlarmCount: 1,
    thermalUnbalanceRate: 0.08
  });
});

test("validateCreateOptimizeExecutionRequest accepts tower-approach payload with formal guardrail fields", () => {
  const result = validateCreateOptimizeExecutionRequest({
    execution: {
      type: "tower-approach",
      title: "冷却塔接近度执行草案",
      targetApproachC: 2.1,
      targetTcwsC: 29.8,
      equipmentContext: {
        activeChillerIds: [" ch-01 ", "ch-01", "ch-02"],
        activeChillerModels: [" YK-01 ", "YK-01"]
      },
      guardrailSnapshot: {
        key: "chillerMinCondenserInletTempC",
        status: "ready",
        value: 30.2,
        message: "目标冷却水温必须高于活跃机组实例中的最高最低温约束。",
        resolvedBy: "by-chiller",
        matchedKeys: ["ch-01", "ch-02", "ch-02"]
      },
      rollbackTarget: {
        mode: "manual",
        targetTcwsC: 31.5,
        reason: "回退到人工固定设定"
      },
      actions: ["按 0.5℃/step 下调", "观察 2 个周期", "按 0.5℃/step 下调"]
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.request.execution.equipmentContext, {
    activeChillerIds: ["ch-01", "ch-02"],
    activeChillerModels: ["YK-01"]
  });
  assert.deepEqual(result.request.execution.guardrailSnapshot, {
    key: "chillerMinCondenserInletTempC",
    status: "ready",
    value: 30.2,
    message: "目标冷却水温必须高于活跃机组实例中的最高最低温约束。",
    resolvedBy: "by-chiller",
    matchedKeys: ["ch-01", "ch-02"]
  });
  assert.deepEqual(result.request.execution.rollbackTarget, {
    mode: "manual",
    targetTcwsC: 31.5,
    targetApproachC: null,
    reason: "回退到人工固定设定"
  });
  assert.deepEqual(result.request.execution.actions, ["按 0.5℃/step 下调", "观察 2 个周期"]);
});

test("validateCreateOptimizeExecutionRequest rejects tower-approach payload without explicit targets", () => {
  const result = validateCreateOptimizeExecutionRequest({
    execution: {
      type: "tower-approach",
      title: "冷却塔接近度执行草案"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateCreateOptimizeExecutionRequest accepts pump-delta-t trim payload", () => {
  const result = validateCreateOptimizeExecutionRequest({
    execution: {
      type: "pump-delta-t",
      title: "泵温差导向降频",
      targetChwpFreqTrimHz: -1,
      targetCwpFreqTrimHz: -1,
      ttlSeconds: 300,
      holdMinutes: 5,
      rollbackLockoutMinutes: 15,
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
      actions: ["AI_ChwpFreqTrim_Hz -1.0 Hz", "AI_CwpFreqTrim_Hz -1.0 Hz"]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.request.execution.type, "pump-delta-t");
  assert.equal(result.request.execution.targetChwpFreqTrimHz, -1);
  assert.equal(result.request.execution.targetCwpFreqTrimHz, -1);
  assert.equal(result.request.execution.ttlSeconds, 300);
  assert.deepEqual(result.request.execution.targetPoints, {
    chilledPump: "AI_ChwpFreqTrim_Hz",
    coolingPump: "AI_CwpFreqTrim_Hz"
  });
  assert.deepEqual(result.request.execution.rollbackTarget, {
    mode: "zero-trim",
    targetTcwsC: null,
    targetApproachC: null,
    targetChwpFreqTrimHz: 0,
    targetCwpFreqTrimHz: 0,
    reason: "回退到 0Hz 修正量"
  });
});

test("validateCreateOptimizeExecutionRequest rejects pump-delta-t trim outside allowed range", () => {
  const result = validateCreateOptimizeExecutionRequest({
    execution: {
      type: "pump-delta-t",
      targetChwpFreqTrimHz: -6
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
  assert.equal(result.details.range.min, -5);
  assert.equal(result.details.range.max, 3);
});

test("execution records persist across admin store reopen", () => {
  __resetOptimizeExecutionStoreForTest();
  const fixture = createTempDbFile();

  try {
    const request = validateCreateOptimizeExecutionRequest({
      draft: {
        baseline: {
          systemCop: 4.6,
          totalPowerKw: 228.1,
          activeAlarmCount: 1,
          thermalUnbalanceRate: 0.06
        }
      },
      execution: {
        type: "scheme",
        schemeKey: "balanced",
        title: "平衡方案",
        targetCop: 4.8,
        targetPowerKw: 220
      },
      approval: {
        required: true
      }
    });
    assert.equal(request.ok, true);

    const firstStore = createAdminStore({ dbFile: fixture.dbFile });
    const created = createOptimizeExecution("btwentyfive", request.request, {
      userId: "operator",
      adminStore: firstStore,
      requestId: "req-create"
    });
    assert.equal(created.status, "pending_approval");
    assert.equal(created.execution.schemeKey, "balanced");
    assert.equal(created.draft?.baseline?.systemCop, 4.6);
    firstStore.close();

    const secondStore = createAdminStore({ dbFile: fixture.dbFile });
    const list = listOptimizeExecutions("btwentyfive", {
      limit: 10,
      adminStore: secondStore
    });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].executionId, created.executionId);
    assert.equal(list.items[0].status, "pending_approval");
    assert.equal(list.items[0].draft?.baseline?.totalPowerKw, 228.1);

    const overview = getOptimizeExecutionOverview("btwentyfive", { adminStore: secondStore });
    assert.equal(overview.pendingApprovalCount, 1);
    assert.equal(overview.approvedCount, 0);
    assert.equal(overview.rolledBackCount, 0);
    assert.equal(overview.latestExecutionId, created.executionId);
    secondStore.close();
  } finally {
    fixture.cleanup();
  }
});

test("tower-approach execution persists formal execution fields across admin store reopen", () => {
  __resetOptimizeExecutionStoreForTest();
  const fixture = createTempDbFile();

  try {
    const request = validateCreateOptimizeExecutionRequest({
      execution: {
        type: "tower-approach",
        title: "冷却塔接近度执行草案",
        targetApproachC: 2.1,
        targetTcwsC: 29.8,
        equipmentContext: {
          activeChillerIds: ["ch-01"],
          activeChillerModels: ["YK-01"]
        },
        guardrailSnapshot: {
          key: "chillerMinCondenserInletTempC",
          status: "ready",
          value: 30.2,
          resolvedBy: "by-chiller",
          matchedKeys: ["ch-01"]
        },
        rollbackTarget: {
          mode: "manual",
          targetTcwsC: 31.5
        }
      },
      approval: {
        required: true
      }
    });
    assert.equal(request.ok, true);

    const firstStore = createAdminStore({ dbFile: fixture.dbFile });
    const created = createOptimizeExecution("btwentyfive", request.request, {
      userId: "operator",
      adminStore: firstStore,
      requestId: "req-create-tower"
    });
    assert.equal(created.execution.type, "tower-approach");
    assert.deepEqual(created.execution.equipmentContext, {
      activeChillerIds: ["ch-01"],
      activeChillerModels: ["YK-01"]
    });
    assert.equal(created.execution.guardrailSnapshot?.resolvedBy, "by-chiller");
    assert.equal(created.execution.rollbackTarget?.targetTcwsC, 31.5);
    firstStore.close();

    const secondStore = createAdminStore({ dbFile: fixture.dbFile });
    const list = listOptimizeExecutions("btwentyfive", {
      limit: 10,
      adminStore: secondStore
    });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].execution.type, "tower-approach");
    assert.equal(list.items[0].execution.guardrailSnapshot?.value, 30.2);
    assert.deepEqual(list.items[0].execution.guardrailSnapshot?.matchedKeys, ["ch-01"]);
    assert.equal(list.items[0].execution.rollbackTarget?.targetTcwsC, 31.5);
    secondStore.close();
  } finally {
    fixture.cleanup();
  }
});

test("listOptimizeExecutions supports execution type filtering", () => {
  __resetOptimizeExecutionStoreForTest();
  const adminStore = createAdminStore({ dbFile: ":memory:" });

  try {
    const schemeRequest = validateCreateOptimizeExecutionRequest({
      execution: {
        type: "scheme",
        schemeKey: "balanced"
      }
    });
    assert.equal(schemeRequest.ok, true);

    const towerRequest = validateCreateOptimizeExecutionRequest({
      execution: {
        type: "tower-approach",
        title: "冷却塔接近度执行草案",
        targetTcwsC: 29.8
      }
    });
    assert.equal(towerRequest.ok, true);
    const pumpRequest = validateCreateOptimizeExecutionRequest({
      execution: {
        type: "pump-delta-t",
        title: "泵温差导向降频",
        targetChwpFreqTrimHz: -1
      }
    });
    assert.equal(pumpRequest.ok, true);

    createOptimizeExecution("btwentyfive", schemeRequest.request, {
      userId: "operator",
      adminStore,
      requestId: "req-scheme"
    });
    createOptimizeExecution("btwentyfive", towerRequest.request, {
      userId: "operator",
      adminStore,
      requestId: "req-tower"
    });
    createOptimizeExecution("btwentyfive", pumpRequest.request, {
      userId: "operator",
      adminStore,
      requestId: "req-pump"
    });

    const towerOnly = listOptimizeExecutions("btwentyfive", {
      type: "tower-approach",
      limit: 10,
      adminStore
    });
    assert.equal(towerOnly.total, 1);
    assert.equal(towerOnly.items[0].execution.type, "tower-approach");

    const schemeOnly = listOptimizeExecutions("btwentyfive", {
      type: "scheme",
      limit: 10,
      adminStore
    });
    assert.equal(schemeOnly.total, 1);
    assert.equal(schemeOnly.items[0].execution.type, "scheme");

    const pumpOnly = listOptimizeExecutions("btwentyfive", {
      type: "pump-delta-t",
      limit: 10,
      adminStore
    });
    assert.equal(pumpOnly.total, 1);
    assert.equal(pumpOnly.items[0].execution.type, "pump-delta-t");
    assert.equal(pumpOnly.items[0].execution.targetChwpFreqTrimHz, -1);
  } finally {
    adminStore.close();
  }
});

test("approve and rollback keep state-machine constraints and emit optimize execution audits", () => {
  __resetOptimizeExecutionStoreForTest();
  const adminStore = createAdminStore({ dbFile: ":memory:" });

  try {
    const request = validateCreateOptimizeExecutionRequest({
      execution: {
        type: "scheme",
        schemeKey: "efficiencyFirst"
      },
      approval: {
        required: true
      }
    });
    assert.equal(request.ok, true);

    const created = createOptimizeExecution("btwentyfive", request.request, {
      userId: "operator",
      adminStore,
      requestId: "req-create"
    });

    const rollbackBeforeApprove = rollbackOptimizeExecution(
      "btwentyfive",
      created.executionId,
      { reason: "not yet" },
      { userId: "site-admin", adminStore, requestId: "req-rollback-before" }
    );
    assert.equal(rollbackBeforeApprove.ok, false);
    assert.equal(rollbackBeforeApprove.status, 409);
    assert.equal(rollbackBeforeApprove.code, "CONFLICT");

    const approved = approveOptimizeExecution(
      "btwentyfive",
      created.executionId,
      {
        note: "值班长通过",
        feedbackSnapshot: {
          phase: "approved",
          capturedAt: "2026-04-08T10:00:01.000Z",
          baseline: {
            systemCop: 4.7,
            totalPowerKw: 218.5,
            activeAlarmCount: 0
          }
        },
        dispatch: {
          operation: "approve",
          mode: "shadow",
          status: "succeeded",
          code: "DISPATCH_OK",
          endpoint: "http://127.0.0.1:18080/mock/approve",
          submittedAt: "2026-04-08T10:00:00.000Z",
          completedAt: "2026-04-08T10:00:00.200Z",
          httpStatus: 200,
          response: {
            ok: true
          }
        }
      },
      { userId: "site-admin", adminStore, requestId: "req-approve" }
    );
    assert.equal(approved.ok, true);
    assert.equal(approved.execution.status, "approved");
    assert.equal(approved.execution.approval.status, "approved");
    assert.equal(approved.execution.approvedBy, "site-admin");
    assert.equal(approved.execution.execution?.dispatch?.lastApprove?.status, "succeeded");
    assert.equal(approved.execution.execution?.feedbackSnapshots?.latest?.phase, "approved");
    assert.equal(approved.execution.execution?.feedbackSnapshots?.approve?.baseline?.systemCop, 4.7);

    const duplicateApprove = approveOptimizeExecution(
      "btwentyfive",
      created.executionId,
      {},
      { userId: "site-admin", adminStore, requestId: "req-approve-duplicate" }
    );
    assert.equal(duplicateApprove.ok, false);
    assert.equal(duplicateApprove.status, 409);
    assert.equal(duplicateApprove.code, "CONFLICT");

    const rolledBack = rollbackOptimizeExecution(
      "btwentyfive",
      created.executionId,
      {
        reason: "现场振荡，回退到手动",
        feedbackSnapshot: {
          phase: "rolled_back",
          capturedAt: "2026-04-08T10:00:06.000Z",
          baseline: {
            systemCop: 4.2,
            totalPowerKw: 230.8,
            activeAlarmCount: 1
          }
        },
        dispatch: {
          operation: "rollback",
          mode: "shadow",
          status: "succeeded",
          code: "DISPATCH_OK",
          endpoint: "http://127.0.0.1:18080/mock/rollback",
          submittedAt: "2026-04-08T10:00:05.000Z",
          completedAt: "2026-04-08T10:00:05.180Z",
          httpStatus: 200,
          response: {
            ok: true
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
    assert.equal(rolledBack.execution.status, "rolled_back");
    assert.equal(rolledBack.execution.rollback.status, "completed");
    assert.equal(rolledBack.execution.rolledBackBy, "site-admin");
    assert.equal(rolledBack.execution.execution?.dispatch?.lastRollback?.status, "succeeded");
    assert.equal(rolledBack.execution.execution?.feedbackSnapshots?.latest?.phase, "rolled_back");
    assert.equal(rolledBack.execution.execution?.feedbackSnapshots?.rollback?.baseline?.systemCop, 4.2);

    const duplicateRollback = rollbackOptimizeExecution(
      "btwentyfive",
      created.executionId,
      {
        reason: "second rollback"
      },
      {
        userId: "site-admin",
        adminStore,
        requestId: "req-rollback-duplicate"
      }
    );
    assert.equal(duplicateRollback.ok, false);
    assert.equal(duplicateRollback.status, 409);
    assert.equal(duplicateRollback.code, "CONFLICT");

    const overview = getOptimizeExecutionOverview("btwentyfive", { adminStore });
    assert.equal(overview.pendingApprovalCount, 0);
    assert.equal(overview.approvedCount, 0);
    assert.equal(overview.rolledBackCount, 1);

    const auditLogs = adminStore.listAuditLogs(
      {
        siteId: "btwentyfive",
        limit: 50
      },
      {
        allowAllSites: true
      }
    );

    const createLog = auditLogs.find((item) => item.action === "optimize.execution.create");
    const approveLog = auditLogs.find((item) => item.action === "optimize.execution.approve");
    const rollbackLog = auditLogs.find((item) => item.action === "optimize.execution.rollback");

    assert.ok(createLog);
    assert.ok(approveLog);
    assert.ok(rollbackLog);
    assert.equal(createLog?.targetType, "optimize_execution");
    assert.equal(createLog?.after?.status, "pending_approval");
    assert.equal(approveLog?.before?.status, "pending_approval");
    assert.equal(approveLog?.after?.status, "approved");
    assert.equal(rollbackLog?.before?.status, "approved");
    assert.equal(rollbackLog?.after?.status, "rolled_back");
  } finally {
    adminStore.close();
  }
});

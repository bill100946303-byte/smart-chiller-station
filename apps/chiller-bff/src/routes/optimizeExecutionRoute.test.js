import test from "node:test";
import assert from "node:assert/strict";

import { createAdminStore } from "../lib/admin-db.js";
import { createApp } from "../server.js";

function createTestConfig(overrides = {}) {
  return {
    port: 0,
    appMode: "test",
    appModeLabel: "测试",
    readOnlyMode: false,
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "btwentyfive",
    staleThresholdHours: 24,
    adminDbFile: ":memory:",
    adminBootstrapUserIds: [],
    adminBootstrapUsernames: [],
    fieldDictionaryFile: "",
    hvacRulesFile: "",
    ...overrides
  };
}

async function startTestServer(adminStore) {
  const { app } = createApp(createTestConfig(), {
    adminStore,
    adminAuthService: {
      async authenticateToken(token) {
        return {
          userId: token,
          username: token,
          token
        };
      },
      async fetchProjectRoster() {
        return [];
      }
    }
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

function buildHeaders(userId) {
  return {
    "content-type": "application/json",
    "x-chiller-user-id": userId
  };
}

test("optimize execution approve/rollback enforces platform_admin or same-site site_admin", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, platformActor, {});
  adminStore.createSite({ siteId: "site-other", siteName: "Other" }, platformActor, {});
  adminStore.createSiteMember(
    "btwentyfive",
    {
      userId: "site-admin-b25",
      username: "site-admin-b25",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "site-other",
    {
      userId: "site-admin-other",
      username: "site-admin-other",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "btwentyfive",
    {
      userId: "auditor-b25",
      username: "auditor-b25",
      role: "auditor"
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        type: "scheme",
        schemeKey: "balanced"
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  const executionId = createdPayload.execution?.executionId;
  assert.ok(executionId);

  const approveByAuditor = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("auditor-b25"),
      body: JSON.stringify({})
    }
  );
  assert.equal(approveByAuditor.status, 403);
  const auditorPayload = await approveByAuditor.json();
  assert.equal(auditorPayload.code, "ADMIN_FORBIDDEN");

  const approveByOtherSiteAdmin = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-other"),
      body: JSON.stringify({})
    }
  );
  assert.equal(approveByOtherSiteAdmin.status, 403);
  const otherSitePayload = await approveByOtherSiteAdmin.json();
  assert.equal(otherSitePayload.code, "ADMIN_FORBIDDEN");

  const approveBySiteAdmin = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({
        note: "值班站点管理员审批"
      })
    }
  );
  assert.equal(approveBySiteAdmin.status, 200);
  const approvedPayload = await approveBySiteAdmin.json();
  assert.equal(approvedPayload.execution?.status, "approved");

  const rollbackByPlatformAdmin = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/rollback`,
    {
      method: "POST",
      headers: buildHeaders("platform-admin"),
      body: JSON.stringify({
        reason: "平台管理员回退"
      })
    }
  );
  assert.equal(rollbackByPlatformAdmin.status, 200);
  const rollbackPayload = await rollbackByPlatformAdmin.json();
  assert.equal(rollbackPayload.execution?.status, "rolled_back");
});

test("optimize execution create accepts tower-approach formal fields over HTTP", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      draft: {
        generatedAt: "2026-04-10T09:00:00.000+08:00",
        gateLevel: "ready",
        baseline: {
          systemCop: 4.6,
          totalPowerKw: 228.4,
          activeAlarmCount: 1,
          thermalUnbalanceRate: 0.07
        }
      },
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
          targetTcwsC: 31.5,
          reason: "回退到人工固定设定"
        },
        actions: ["按 0.5℃/step 下调", "观察 2 个周期"]
      },
      approval: {
        required: true
      }
    })
  });

  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  assert.equal(createdPayload.execution?.execution?.type, "tower-approach");
  assert.deepEqual(createdPayload.execution?.execution?.equipmentContext, {
    activeChillerIds: ["ch-01"],
    activeChillerModels: ["YK-01"]
  });
  assert.equal(createdPayload.execution?.execution?.guardrailSnapshot?.resolvedBy, "by-chiller");
  assert.deepEqual(createdPayload.execution?.execution?.guardrailSnapshot?.matchedKeys, ["ch-01"]);
  assert.equal(createdPayload.execution?.execution?.rollbackTarget?.targetTcwsC, 31.5);
  assert.equal(createdPayload.execution?.draft?.baseline?.systemCop, 4.6);
});

test("generic optimize execution routes handle pump-delta-t shadow governance", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      draft: {
        generatedAt: "2026-04-10T09:00:00.000+08:00",
        gateLevel: "ready",
        baseline: {
          systemCop: 4.6,
          totalPowerKw: 228.4,
          activeAlarmCount: 0,
          thermalUnbalanceRate: 0.07
        }
      },
      execution: {
        type: "pump-delta-t",
        title: "冷冻泵/冷却泵温差导向降频",
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
      },
      approval: {
        required: true
      }
    })
  });

  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  const executionId = createdPayload.execution?.executionId;
  assert.ok(executionId);
  assert.equal(createdPayload.execution?.execution?.type, "pump-delta-t");
  assert.equal(createdPayload.execution?.execution?.targetChwpFreqTrimHz, -1);
  assert.equal(createdPayload.execution?.execution?.targetCwpFreqTrimHz, -1);
  assert.equal(createdPayload.execution?.execution?.rollbackTarget?.targetChwpFreqTrimHz, 0);

  const approveResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("platform-admin"),
      body: JSON.stringify({
        note: "平台管理员审批泵温差降频"
      })
    }
  );
  assert.equal(approveResponse.status, 200);
  const approvedPayload = await approveResponse.json();
  assert.equal(approvedPayload.execution?.status, "approved");
  assert.equal(approvedPayload.dispatch?.code, "DISPATCH_SHADOW_RECORDED");
  assert.equal(approvedPayload.dispatch?.response?.command?.targetChwpFreqTrimHz, -1);
  assert.equal(approvedPayload.dispatch?.response?.command?.targetPoints?.chilledPump, "AI_ChwpFreqTrim_Hz");

  const dispatchResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/dispatch`,
    {
      method: "POST",
      headers: buildHeaders("platform-admin"),
      body: JSON.stringify({})
    }
  );
  assert.equal(dispatchResponse.status, 200);
  const dispatchPayload = await dispatchResponse.json();
  assert.equal(dispatchPayload.executionType, "pump-delta-t");
  assert.equal(dispatchPayload.dispatch?.code, "DISPATCH_SHADOW_RECORDED");
  assert.equal(dispatchPayload.execution?.execution?.dispatch?.lastDispatch?.operation, "dispatch");
});

test("tower-approach dedicated execution routes create and list only tower-approach records", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const schemeResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        type: "scheme",
        schemeKey: "balanced"
      }
    })
  });
  assert.equal(schemeResponse.status, 201);

  const towerResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        title: "冷却塔接近度执行草案",
        targetApproachC: 2.1,
        targetTcwsC: 29.8
      }
    })
  });
  assert.equal(towerResponse.status, 201);
  const towerPayload = await towerResponse.json();
  assert.equal(towerPayload.executionType, "tower-approach");
  assert.equal(towerPayload.execution?.execution?.type, "tower-approach");

  const towerListResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions?limit=10`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(towerListResponse.status, 200);
  const towerListPayload = await towerListResponse.json();
  assert.equal(towerListPayload.executionType, "tower-approach");
  assert.equal(towerListPayload.total, 1);
  assert.equal(towerListPayload.items?.[0]?.execution?.type, "tower-approach");

  const filteredGenericListResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions?type=tower-approach&limit=10`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(filteredGenericListResponse.status, 200);
  const filteredGenericListPayload = await filteredGenericListResponse.json();
  assert.equal(filteredGenericListPayload.total, 1);
  assert.equal(filteredGenericListPayload.items?.[0]?.execution?.type, "tower-approach");
});

test("tower-approach dedicated approve and rollback routes only mutate tower-approach records", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});
  adminStore.createSiteMember(
    "btwentyfive",
    {
      userId: "site-admin-b25",
      username: "site-admin-b25",
      role: "site_admin"
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const schemeResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        type: "scheme",
        schemeKey: "balanced"
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(schemeResponse.status, 201);
  const schemePayload = await schemeResponse.json();
  const schemeExecutionId = schemePayload.execution?.executionId;
  assert.ok(schemeExecutionId);

  const towerResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        targetTcwsC: 29.8,
        targetApproachC: 2.1
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(towerResponse.status, 201);
  const towerPayload = await towerResponse.json();
  const towerExecutionId = towerPayload.execution?.executionId;
  assert.ok(towerExecutionId);

  const approveSchemeThroughTowerRoute = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions/${encodeURIComponent(schemeExecutionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({})
    }
  );
  assert.equal(approveSchemeThroughTowerRoute.status, 409);
  const approveSchemePayload = await approveSchemeThroughTowerRoute.json();
  assert.equal(approveSchemePayload.code, "CONFLICT");

  const approveTowerResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions/${encodeURIComponent(towerExecutionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({
        note: "接近度专用审批"
      })
    }
  );
  assert.equal(approveTowerResponse.status, 200);
  const approveTowerPayload = await approveTowerResponse.json();
  assert.equal(approveTowerPayload.executionType, "tower-approach");
  assert.equal(approveTowerPayload.execution?.status, "approved");

  const rollbackTowerResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions/${encodeURIComponent(towerExecutionId)}/rollback`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({
        reason: "接近度专用回退"
      })
    }
  );
  assert.equal(rollbackTowerResponse.status, 200);
  const rollbackTowerPayload = await rollbackTowerResponse.json();
  assert.equal(rollbackTowerPayload.executionType, "tower-approach");
  assert.equal(rollbackTowerPayload.execution?.status, "rolled_back");
});

test("tower-approach dedicated approve blocks when dispatch mode is enforced and endpoint is missing", async (t) => {
  const siteId = "no-tower-endpoint";
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId, siteName: "No Tower Endpoint" }, actor, {});
  adminStore.createSiteMember(
    siteId,
    {
      userId: "site-admin-no-tower-endpoint",
      username: "site-admin-no-tower-endpoint",
      role: "site_admin"
    },
    actor,
    {}
  );
  adminStore.upsertRuntimeConfig(
    siteId,
    {
      featureFlags: {
        towerApproachDispatchMode: "enforced"
      }
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/${siteId}/optimize/tower-approach/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        targetTcwsC: 29.8,
        targetApproachC: 2.1
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  const executionId = createdPayload.execution?.executionId;
  assert.ok(executionId);

  const approveResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/${siteId}/optimize/tower-approach/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-no-tower-endpoint"),
      body: JSON.stringify({
        note: "尝试审批"
      })
    }
  );
  assert.equal(approveResponse.status, 502);
  const approvePayload = await approveResponse.json();
  assert.equal(approvePayload.code, "OPTIMIZE_EXECUTION_DISPATCH_FAILED");
  assert.equal(approvePayload.details?.dispatch?.code, "DISPATCH_ENDPOINT_MISSING");

  const listResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/${siteId}/optimize/tower-approach/executions?limit=10`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  const execution = listPayload.items?.find((item) => item?.executionId === executionId);
  assert.equal(execution?.status, "pending_approval");
});

test("tower-approach dedicated approve and rollback record shadow dispatch without downstream endpoint", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});
  adminStore.createSiteMember(
    "btwentyfive",
    {
      userId: "site-admin-b25",
      username: "site-admin-b25",
      role: "site_admin"
    },
    actor,
    {}
  );
  adminStore.upsertRuntimeConfig(
    "btwentyfive",
    {
      featureFlags: {
        towerApproachDispatchMode: "shadow"
      }
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        targetTcwsC: 29.8,
        targetApproachC: 2.1
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  const executionId = createdPayload.execution?.executionId;
  assert.ok(executionId);

  const approveResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions/${encodeURIComponent(executionId)}/approve`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({
        note: "shadow 审批"
      })
    }
  );
  assert.equal(approveResponse.status, 200);
  const approvePayload = await approveResponse.json();
  assert.equal(approvePayload.dispatch?.status, "succeeded");
  assert.equal(approvePayload.dispatch?.code, "DISPATCH_SHADOW_RECORDED");
  assert.equal(approvePayload.dispatch?.response?.shadow, true);
  assert.equal(approvePayload.execution?.execution?.dispatch?.lastApprove?.status, "succeeded");
  assert.equal(approvePayload.execution?.execution?.dispatch?.latestStatus, "applied");
  assert.equal(approvePayload.execution?.status, "approved");

  const rollbackResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions/${encodeURIComponent(executionId)}/rollback`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({
        reason: "shadow 回退"
      })
    }
  );
  assert.equal(rollbackResponse.status, 200);
  const rollbackPayload = await rollbackResponse.json();
  assert.equal(rollbackPayload.dispatch?.status, "succeeded");
  assert.equal(rollbackPayload.dispatch?.code, "DISPATCH_SHADOW_RECORDED");
  assert.equal(rollbackPayload.dispatch?.response?.shadow, true);
  assert.equal(rollbackPayload.execution?.execution?.dispatch?.lastRollback?.status, "succeeded");
  assert.equal(rollbackPayload.execution?.execution?.dispatch?.latestStatus, "rolled_back");
  assert.equal(rollbackPayload.execution?.status, "rolled_back");
});

test("generic dispatch route persists tower-approach dispatch receipt after approval", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});
  adminStore.createSiteMember(
    "btwentyfive",
    {
      userId: "site-admin-b25",
      username: "site-admin-b25",
      role: "site_admin"
    },
    actor,
    {}
  );
  adminStore.upsertRuntimeConfig(
    "btwentyfive",
    {
      featureFlags: {
        towerApproachDispatchMode: "shadow"
      }
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/tower-approach/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      execution: {
        targetTcwsC: 29.8,
        targetApproachC: 2.1
      },
      approval: {
        required: false
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  const executionId = createdPayload.execution?.executionId;
  assert.ok(executionId);
  assert.equal(createdPayload.execution?.status, "approved");

  const dispatchResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions/${encodeURIComponent(executionId)}/dispatch`,
    {
      method: "POST",
      headers: buildHeaders("site-admin-b25"),
      body: JSON.stringify({})
    }
  );
  assert.equal(dispatchResponse.status, 200);
  const dispatchPayload = await dispatchResponse.json();
  assert.equal(dispatchPayload.dispatch?.status, "succeeded");
  assert.equal(dispatchPayload.dispatch?.operation, "dispatch");
  assert.equal(dispatchPayload.dispatch?.code, "DISPATCH_SHADOW_RECORDED");
  assert.equal(dispatchPayload.dispatch?.response?.shadow, true);
  assert.equal(dispatchPayload.execution?.status, "approved");
  assert.equal(dispatchPayload.execution?.execution?.dispatch?.lastDispatch?.status, "succeeded");
  assert.equal(dispatchPayload.execution?.execution?.dispatch?.lastDispatch?.operation, "dispatch");
  assert.equal(dispatchPayload.execution?.execution?.dispatch?.latestStatus, "applied");
});

test("shadow verification record routes append evidence without mutating executions", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, actor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const createExecutionResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      draft: {
        generatedAt: "2026-06-12T08:00:00.000Z",
        gateLevel: "ready"
      },
      execution: {
        type: "tower-approach",
        title: "冷却塔接近度 shadow",
        targetApproachC: 3.5,
        targetTcwsC: 28,
        rollbackTarget: {
          mode: "manual",
          targetTcwsC: 27.5
        }
      },
      approval: {
        required: true
      }
    })
  });
  assert.equal(createExecutionResponse.status, 201);
  const createdExecutionPayload = await createExecutionResponse.json();
  const executionId = createdExecutionPayload.execution?.executionId;
  assert.ok(executionId);

  const recordResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      record: {
        executionId,
        verificationType: "tower-approach",
        targetLabel: "Tcws 28.0℃",
        outcome: "pending",
        windowMinutes: 45,
        metrics: {
          loadKw: 11688.7,
          wetBulbC: 24.3,
          stationCop: 6.9,
          kwPerRt: 0.52,
          stationPowerKw: 1739.2,
          chillerPowerKw: 1510.4,
          alarmCount: 0
        },
        note: "人工记录 30-60min 同负荷湿球窗口。"
      }
    })
  });
  assert.equal(recordResponse.status, 201);
  const recordPayload = await recordResponse.json();
  assert.equal(recordPayload.ok, true);
  assert.equal(recordPayload.controlMutation, false);
  assert.equal(recordPayload.record?.executionId, executionId);
  assert.equal(recordPayload.record?.outcome, "pending");
  assert.equal(recordPayload.record?.payload?.controlMutation, false);

  const listResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records?executionId=${encodeURIComponent(
      executionId
    )}`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.basis, "append_only_shadow_verification_records");
  assert.equal(listPayload.total, 1);
  assert.equal(listPayload.summary?.executionId, executionId);
  assert.equal(listPayload.items?.[0]?.recordId, recordPayload.record?.recordId);

  const reviewResponse = await fetch(`${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records`, {
    method: "POST",
    headers: buildHeaders("operator"),
    body: JSON.stringify({
      record: {
        sourceRecordId: recordPayload.record?.recordId,
        executionId,
        verificationType: "tower-approach",
        targetLabel: "Tcws 28.0℃",
        outcome: "improved",
        windowMinutes: 45,
        metrics: {
          loadKw: 11688.7,
          wetBulbC: 24.3,
          stationCop: 7.05,
          kwPerRt: 0.49,
          stationPowerKw: 1665.8,
          chillerPowerKw: 1450.2,
          alarmCount: 0
        },
        note: "人工复核：同负荷湿球窗口表现改善。"
      }
    })
  });
  assert.equal(reviewResponse.status, 201);
  const reviewPayload = await reviewResponse.json();
  assert.equal(reviewPayload.ok, true);
  assert.equal(reviewPayload.controlMutation, false);
  assert.equal(reviewPayload.record?.outcome, "improved");
  assert.equal(reviewPayload.record?.sourceRecordId, recordPayload.record?.recordId);
  assert.equal(reviewPayload.record?.payload?.sourceRecordId, recordPayload.record?.recordId);

  const reviewedListResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records?executionId=${encodeURIComponent(
      executionId
    )}`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(reviewedListResponse.status, 200);
  const reviewedListPayload = await reviewedListResponse.json();
  assert.equal(reviewedListPayload.total, 2);
  const { archive: reviewedArchive, ...reviewedSummary } = reviewedListPayload.summary || {};
  assert.match(reviewedArchive?.reportId || "", new RegExp(`^shr-btwentyfive-${executionId}-[a-f0-9]{12}$`));
  assert.equal(reviewedArchive?.checksumAlgorithm, "sha256");
  assert.match(reviewedArchive?.checksum || "", /^[a-f0-9]{64}$/);
  assert.equal(reviewedArchive?.checksumShort, reviewedArchive?.checksum?.slice(0, 16));
  assert.equal(reviewedArchive?.canonicalBasis, "append_only_shadow_review_report_v1");
  assert.equal(reviewedArchive?.recordCount, 2);
  assert.deepEqual(reviewedSummary, {
    basis: "listed_append_only_shadow_verification_records",
    verificationType: "all",
    executionId,
    total: 2,
    sampledCount: 2,
    pendingCount: 1,
    reviewedCount: 1,
    comparableCount: 1,
    improvedCount: 1,
    neutralCount: 0,
    regressedCount: 0,
    invalidCount: 0,
    latestOutcome: "improved",
    latestReviewedAt: reviewPayload.record?.recordedAt,
    byVerificationType: [
      {
        verificationType: "tower-approach",
        total: 2,
        pendingCount: 1,
        reviewedCount: 1,
        comparableCount: 1,
        improvedCount: 1,
        neutralCount: 0,
        regressedCount: 0,
        invalidCount: 0
      }
    ],
    controlMutation: false,
    executionMutation: false,
    acceptanceBoundary: "shadow_verification_summary_only_not_savings_commitment"
  });
  assert.deepEqual(
    reviewedListPayload.items?.map((item) => item.outcome),
    ["improved", "pending"]
  );

  const filteredListResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records?verificationType=tower-approach&executionId=${encodeURIComponent(
      executionId
    )}&limit=10`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(filteredListResponse.status, 200);
  const filteredListPayload = await filteredListResponse.json();
  assert.equal(filteredListPayload.summary?.verificationType, "tower-approach");
  assert.equal(filteredListPayload.summary?.executionId, executionId);
  assert.equal(filteredListPayload.summary?.total, 2);
  assert.equal(filteredListPayload.summary?.reviewedCount, 1);
  assert.equal(filteredListPayload.summary?.byVerificationType?.[0]?.verificationType, "tower-approach");
  const filteredArchive = filteredListPayload.summary?.archive;
  assert.match(filteredArchive?.reportId || "", new RegExp(`^shr-btwentyfive-${executionId}-[a-f0-9]{12}$`));
  assert.match(filteredArchive?.checksum || "", /^[a-f0-9]{64}$/);
  assert.equal(filteredArchive?.checksumAlgorithm, "sha256");
  assert.equal(filteredArchive?.canonicalBasis, "append_only_shadow_review_report_v1");
  assert.equal(filteredArchive?.recordCount, 2);

  const exportResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records/export?executionId=${encodeURIComponent(
      executionId
    )}`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") || "", /text\/csv/);
  assert.match(exportResponse.headers.get("content-disposition") || "", /shadow-verification-records-btwentyfive\.csv/);
  const csv = await exportResponse.text();
  assert.match(csv, /recordId,siteId,executionId,verificationType,targetLabel,outcome/);
  assert.match(csv, /recordedBy,sourceRecordId,controlMutation,appendOnly/);
  assert.match(csv, new RegExp(recordPayload.record?.recordId || "missing-record-id"));
  assert.match(csv, new RegExp(reviewPayload.record?.recordId || "missing-review-record-id"));
  assert.match(csv, /tower-approach/);
  assert.match(csv, /pending/);
  assert.match(csv, /improved/);
  assert.match(csv, new RegExp(recordPayload.record?.recordId || "missing-source-record-id"));
  assert.match(csv, /false,true/);

  const reportMissingExecutionResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records/report`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(reportMissingExecutionResponse.status, 400);
  const reportMissingExecutionPayload = await reportMissingExecutionResponse.json();
  assert.equal(reportMissingExecutionPayload.details?.boundary, "single_shadow_review_report_requires_execution_id");

  const reportResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records/report?executionId=${encodeURIComponent(
      executionId
    )}&verificationType=tower-approach`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(reportResponse.status, 200);
  assert.match(reportResponse.headers.get("content-type") || "", /text\/markdown/);
  assert.match(reportResponse.headers.get("content-disposition") || "", /shadow-review-btwentyfive-/);
  assert.equal(reportResponse.headers.get("x-shadow-review-checksum-algorithm"), "sha256");
  assert.equal(reportResponse.headers.get("x-shadow-review-checksum"), filteredArchive?.checksum);
  assert.equal(reportResponse.headers.get("x-shadow-review-report-id"), filteredArchive?.reportId);
  const reportMarkdown = await reportResponse.text();
  assert.match(reportMarkdown, /# Shadow 复盘报告/);
  assert.match(reportMarkdown, new RegExp(executionId));
  assert.match(reportMarkdown, new RegExp(filteredArchive?.reportId || "missing-report-id"));
  assert.match(reportMarkdown, new RegExp(`SHA256:${filteredArchive?.checksum || "missing-checksum"}`));
  assert.match(reportMarkdown, /append_only_shadow_review_report_v1/);
  assert.match(reportMarkdown, /不代表电子签名或归档写入/);
  assert.match(reportMarkdown, /append-only shadow 验证记录/);
  assert.match(reportMarkdown, /不审批、不 dispatch、不 rollback、不写真实 PLC/);
  assert.match(reportMarkdown, /不作为节能结算依据/);
  assert.match(reportMarkdown, /@media print/);
  assert.match(reportMarkdown, /打印样式：A4 竖版/);
  assert.match(reportMarkdown, /甲方\/值班员签字确认区/);
  assert.match(reportMarkdown, /甲方代表/);
  assert.match(reportMarkdown, /运行值班员/);
  assert.match(reportMarkdown, /签字仅确认本次 shadow 复盘记录完整/);
  assert.match(reportMarkdown, /tower-approach/);
  assert.match(reportMarkdown, /pending/);
  assert.match(reportMarkdown, /improved/);
  assert.match(reportMarkdown, new RegExp(recordPayload.record?.recordId || "missing-source-record-id"));

  const printMissingExecutionResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records/report/print`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(printMissingExecutionResponse.status, 400);
  const printMissingExecutionPayload = await printMissingExecutionResponse.json();
  assert.equal(printMissingExecutionPayload.details?.boundary, "single_shadow_review_print_requires_execution_id");

  const printResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/shadow-verification-records/report/print?executionId=${encodeURIComponent(
      executionId
    )}&verificationType=tower-approach`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(printResponse.status, 200);
  assert.match(printResponse.headers.get("content-type") || "", /text\/html/);
  assert.match(printResponse.headers.get("content-disposition") || "", /shadow-review-btwentyfive-/);
  assert.equal(printResponse.headers.get("x-shadow-review-checksum-algorithm"), "sha256");
  assert.equal(printResponse.headers.get("x-shadow-review-checksum"), filteredArchive?.checksum);
  assert.equal(printResponse.headers.get("x-shadow-review-report-id"), filteredArchive?.reportId);
  const printHtml = await printResponse.text();
  assert.match(printHtml, /<!doctype html>/);
  assert.match(printHtml, /打印 \/ 另存 PDF/);
  assert.match(printHtml, new RegExp(filteredArchive?.reportId || "missing-report-id"));
  assert.match(printHtml, new RegExp(`SHA256:${filteredArchive?.checksum || "missing-checksum"}`));
  assert.match(printHtml, /append_only_shadow_review_report_v1/);
  assert.match(printHtml, /不代表电子签名或归档写入/);
  assert.match(printHtml, /@page \{ size: A4 portrait/);
  assert.match(printHtml, /甲方\/值班员签字确认区/);
  assert.match(printHtml, /签字仅确认本次 shadow 复盘记录完整/);
  assert.match(printHtml, /不审批、不 dispatch、不 rollback、不写真实 PLC/);
  assert.match(printHtml, new RegExp(executionId));

  const executionListResponse = await fetch(
    `${server.baseUrl}/bff/v1/sites/btwentyfive/optimize/executions?type=tower-approach&limit=1`,
    {
      headers: buildHeaders("operator")
    }
  );
  assert.equal(executionListResponse.status, 200);
  const executionListPayload = await executionListResponse.json();
  const execution = executionListPayload.items?.[0];
  assert.equal(execution?.executionId, executionId);
  assert.equal(execution?.status, "pending_approval");
  assert.equal(execution?.approval?.status, "pending");
  assert.equal(Boolean(execution?.execution?.dispatch), false);
  assert.deepEqual(
    (execution?.timeline || []).map((item) => item.action),
    ["created"]
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

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

async function startTestServer(adminStore, configOverrides = {}) {
  const { app } = createApp(createTestConfig(configOverrides), {
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

async function startRuntimeBindingSourceServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    res.setHeader("content-type", "application/json");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "read-only source" }));
      return;
    }
    if (req.url?.startsWith("/zsqy/drinfo/station-db/findObject")) {
      res.end(JSON.stringify({
        data: [
          { drid: "1", drcode: "CH1", drname: "1#冷机", drtypename: "主机", typeYT: "1" },
          { drid: "2", drcode: "CH2", drname: "2#冷机", drtypename: "主机", typeYT: "1" }
        ]
      }));
      return;
    }
    if (req.url?.startsWith("/zsqy/reg/station-db/findObject")) {
      res.end(JSON.stringify({
        data: [
          { drId: "1", drcode: "CH1", tagName: "CH1-RUN", regName: "运行" },
          { drId: "2", drcode: "CH2", tagName: "CH2-RUN", regName: "运行" }
        ]
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve runtime binding source server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function buildHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-chiller-user-id": token
  };
}

function buildActiveAuthorizationWindow() {
  const now = Date.now();
  return {
    siteAuthorizationWindowStart: new Date(now - 60 * 60 * 1000).toISOString(),
    siteAuthorizationWindowEnd: new Date(now + 60 * 60 * 1000).toISOString()
  };
}

test("admin runtime-config route accepts JSON-string payloads and persists tower approach thresholds", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, platformActor, {});
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

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const updateResponse = await fetch(`${server.baseUrl}/admin/v1/sites/btwentyfive/runtime-config`, {
    method: "PUT",
    headers: buildHeaders("site-admin-b25"),
    body: JSON.stringify({
      energyParamsJson: JSON.stringify({ dailyTargetCop: 5.5 }),
      ruleThresholdsJson: JSON.stringify({
        towerApproach: {
          minCondenserInletTempC: 30.2
        }
      }),
      featureFlagsJson: JSON.stringify({
        enableOptimization: true
      })
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatedPayload = await updateResponse.json();
  assert.equal(updatedPayload.runtimeConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempC, 30.2);
  assert.equal(updatedPayload.runtimeConfig?.energyParams?.dailyTargetCop, 5.5);
  assert.equal(updatedPayload.runtimeConfig?.featureFlags?.enableOptimization, true);

  const getResponse = await fetch(`${server.baseUrl}/admin/v1/sites/btwentyfive/runtime-config`, {
    headers: buildHeaders("site-admin-b25")
  });
  assert.equal(getResponse.status, 200);
  const fetchedPayload = await getResponse.json();
  assert.equal(fetchedPayload.runtimeConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempC, 30.2);
  assert.equal(fetchedPayload.runtimeConfig?.version, 1);
  assert.deepEqual(fetchedPayload.runtimeConfig?.ruleThresholds?.towerApproach?.controlTargets, undefined);
});

test("admin FCU control-policy route persists field authorization gates without secret text", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.upsertSiteSubsystems(
    "126lnoffice",
    {
      items: [
        {
          subsystemType: "hvac_terminal",
          status: "enabled",
          sourceStatus: "ok",
          published: true,
          controlBoundary: {
            mode: "enforced",
            writeEnabled: true
          }
        }
      ]
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const updateResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-policy`, {
    method: "PUT",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      policy: {
        enabled: true,
        defaultMode: "enforced",
        dispatchAdapter: "legacy-scene-command",
        whitelist: ["LZBGS"],
        fieldAuthorization: {
          siteAuthorizationStatus: "approved",
          siteAuthorizationBy: "业主值班长",
          ...buildActiveAuthorizationWindow(),
          baWriteConfirmArmed: true,
          finalRolloutConfirmArmed: true,
          commissioningOwner: "平台工程师",
          baOwner: "BA工程师",
          notes: "现场值守，禁止记录真实确认短语。"
        }
      }
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatePayload = await updateResponse.json();
  assert.equal(updatePayload.policy?.fieldAuthorization?.siteAuthorizationStatus, "approved");
  assert.equal(updatePayload.policy?.fieldAuthorization?.baWriteConfirmArmed, true);
  assert.equal(updatePayload.policy?.fieldAuthorization?.finalRolloutConfirmArmed, true);
  assert.equal(JSON.stringify(updatePayload).includes("I_UNDERSTAND_REAL_BA_WRITE"), false);

  const getResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-policy`, {
    headers: buildHeaders("site-admin-office")
  });
  assert.equal(getResponse.status, 200);
  const getPayload = await getResponse.json();
  assert.equal(getPayload.policy?.fieldAuthorization?.siteAuthorizationBy, "业主值班长");
  assert.equal(getPayload.policy?.fieldAuthorization?.commissioningOwner, "平台工程师");

  const runtimeResponse = await fetch(`${server.baseUrl}/bff/v1/sites/126/hvac-terminal/fan-coils/control-policy`);
  assert.equal(runtimeResponse.status, 200);
  const runtimePayload = await runtimeResponse.json();
  assert.equal(runtimePayload.site?.siteId, "126lnoffice");
  assert.equal(runtimePayload.policy?.fieldAuthorization?.siteAuthorizationStatus, "approved");
  assert.equal(runtimePayload.policy?.fieldAuthorization?.baWriteConfirmArmed, true);
  assert.equal(runtimePayload.policy?.fieldAuthorization?.finalRolloutConfirmArmed, true);
  assert.equal(runtimePayload.executionGate?.authorizationStatus, "approved");
  assert.equal(runtimePayload.executionGate?.blockedReasons?.includes("site_authorization_approved"), false);
  assert.equal(runtimePayload.executionGate?.blockedReasons?.includes("ba_write_confirm_armed"), false);
  assert.equal(runtimePayload.executionGate?.blockedReasons?.includes("final_rollout_confirm_armed"), false);
  assert.equal(runtimePayload.executionGate?.blockedReasons?.includes("subsystem_write_enabled"), false);
});

test("admin FCU control-policy route rejects incomplete approved field authorization", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const missingOwnersResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-policy`, {
    method: "PUT",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      policy: {
        enabled: true,
        defaultMode: "enforced",
        dispatchAdapter: "legacy-scene-command",
        whitelist: ["BGS01"],
        fieldAuthorization: {
          siteAuthorizationStatus: "approved",
          baWriteConfirmArmed: true,
          finalRolloutConfirmArmed: true
        }
      }
    })
  });
  assert.equal(missingOwnersResponse.status, 400);
  const missingOwnersPayload = await missingOwnersResponse.json();
  assert.equal(missingOwnersPayload.code, "BAD_REQUEST");
  assert.equal(missingOwnersPayload.details?.fields?.includes("fieldAuthorization.siteAuthorizationBy"), true);
  assert.equal(missingOwnersPayload.details?.fields?.includes("fieldAuthorization.siteAuthorizationWindowStart"), true);

  const invalidWindowResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-policy`, {
    method: "PUT",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      policy: {
        enabled: true,
        defaultMode: "enforced",
        dispatchAdapter: "legacy-scene-command",
        whitelist: ["BGS01"],
        fieldAuthorization: {
          siteAuthorizationStatus: "approved",
          siteAuthorizationBy: "业主值班长",
          siteAuthorizationWindowStart: "2026-06-18T11:00",
          siteAuthorizationWindowEnd: "2026-06-18T09:00",
          baWriteConfirmArmed: true,
          finalRolloutConfirmArmed: true,
          commissioningOwner: "平台工程师",
          baOwner: "BA工程师"
        }
      }
    })
  });
  assert.equal(invalidWindowResponse.status, 400);
  const invalidWindowPayload = await invalidWindowResponse.json();
  assert.equal(invalidWindowPayload.code, "BAD_REQUEST");
  assert.equal(invalidWindowPayload.details?.fields?.includes("fieldAuthorization.siteAuthorizationWindowEnd"), true);
});

test("admin FCU field-remediation-status exposes onsite blockers without control mutation", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-field-status-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  writeJson(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json"), {
    ok: false,
    controlMutation: false,
    summary: {
      totalWorkOrders: 8,
      openCount: 8,
      requiresFieldSignoff: true
    },
    outputs: {
      signoffInputCsv: path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv")
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03"
      }
    ]
  });
  writeJson(path.join(outputDir, "fcu-field-remediation-execution-pack-latest.json"), {
    ok: false,
    controlMutation: false,
    summary: {
      totalDevices: 8,
      openP0Devices: 8,
      reasonCounts: {
        communication_alarm: 8,
        zero_temperature: 4
      }
    },
    executionOrder: [
      {
        phase: "restore_communication",
        deviceCount: 8,
        deviceCodes: ["BGS03"]
      }
    ]
  });
  writeJson(path.join(outputDir, "fcu-field-remediation-signoff-latest.json"), {
    ok: false,
    controlMutation: false,
    summary: {
      expectedWorkOrders: 8,
      completeRows: 0,
      openRows: 8,
      signoffComplete: false
    },
    openRecords: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        issues: ["handledBy_missing"]
      }
    ],
    releaseMatrix: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        canEnterCanary: false
      }
    ]
  });
  writeJson(path.join(outputDir, "fcu-field-remediation-return-template-latest.json"), {
    ok: true,
    controlMutation: false,
    dispatch: false,
    summary: {
      deviceCount: 8,
      communicationBlocked: 8,
      temperatureBlocked: 4,
      setpointBlocked: 6,
      signoffCompleteRows: 0,
      signoffExpectedRows: 8
    },
    requiredColumns: ["workOrderId", "deviceCode", "handledBy", "releaseDecision"],
    devices: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        currentEvidence: {
          reasons: ["communication_alarm"]
        },
        requiredValues: {
          communicationAlarmAfter: "必填：0"
        }
      }
    ],
    outputs: {
      json: path.join(outputDir, "fcu-field-remediation-return-template-latest.json"),
      markdown: path.join(outputDir, "fcu-field-remediation-return-template-latest.md"),
      csv: path.join(outputDir, "fcu-field-remediation-return-template-latest.csv")
    },
    rerunCommands: [
      "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff"
    ],
    safetyBoundary: ["本模板只用于现场回填和复核，不产生 BA/PLC 写入。"]
  });
  writeJson(path.join(outputDir, "fcu-field-handoff-pack-latest.json"), {
    ok: false,
    controlMutation: false,
    dispatch: false,
    conclusion: "最终门禁未通过，本包只用于现场消缺和签核，不允许真实 BA/PLC 写入。",
    summary: {
      totalWorkOrders: 8,
      openP0Devices: 8,
      staleSignoffRows: 1,
      signoffCompleteRows: 0,
      signoffExpectedRows: 8,
      finalGatePassed: false,
      canaryReady: false,
      nextAllowedStep: "先清理过期签核行，生成 current-only 输入表。"
    },
    devices: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        reasonLabels: ["通讯报警"],
        todayAction: "先恢复通讯报警，再做温度和设定反馈复核。"
      }
    ],
    outputFiles: {
      json: path.join(outputDir, "fcu-field-handoff-pack-latest.json"),
      markdown: path.join(outputDir, "fcu-field-handoff-pack-latest.md"),
      csv: path.join(outputDir, "fcu-field-handoff-pack-latest.csv"),
      currentOnlyCsv: path.join(outputDir, "fcu-field-remediation-signoff-current-only-latest.csv")
    }
  });
  writeJson(path.join(outputDir, "fcu-final-control-worklist-latest.json"), {
    ok: false,
    verdict: "worklist_open",
    controlMutation: false,
    fieldRemediationPlaybook: {
      fieldReady: false,
      firstCanary: "BGS01",
      canaryBlockedByField: true,
      deviceCount: 8,
      reasonGroups: [
        {
          reason: "communication_alarm",
          devices: ["BGS03"]
        }
      ],
      recommendedOrder: ["先处理 communication_alarm"],
      devices: [
        {
          workOrderId: "FCU-P0-BGS03",
          deviceCode: "BGS03",
          deviceName: "办公室03",
          reasons: ["communication_alarm"],
          reasonLabels: ["通讯报警未恢复"],
          missingFields: ["handledBy"],
          fieldPriority: ["通讯恢复", "写点映射复核", "现场双人签核"]
        }
      ]
    }
  });
  writeJson(path.join(outputDir, "fcu-final-control-gates-latest.json"), {
    ok: false,
    controlMutation: false,
    summary: {
      gateCount: 8,
      passed: 0,
      blocked: 8,
      canaryReady: false
    },
    blockers: [
      {
        label: "现场签字",
        value: "0/8",
        blocker: "现场签字未完成"
      }
    ],
    nextActions: [
      {
        priority: "P0",
        phase: "field_signoff",
        action: "补齐 FCU 现场消缺签字"
      }
    ]
  });

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-status`, {
    headers: buildHeaders("site-admin-office")
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.summary?.openWorkOrders, 8);
  assert.equal(payload.summary?.openP0Devices, 8);
  assert.equal(payload.summary?.signoffComplete, false);
  assert.equal(payload.summary?.finalGatePassed, false);
  assert.equal(payload.workOrders?.items?.[0]?.deviceCode, "BGS03");
  assert.equal(payload.executionPack?.reasonCounts?.communication_alarm, 8);
  assert.equal(payload.signoff?.openRecords?.[0]?.workOrderId, "FCU-P0-BGS03");
  assert.equal(payload.returnTemplate?.summary?.deviceCount, 8);
  assert.equal(payload.returnTemplate?.summary?.communicationBlocked, 8);
  assert.equal(payload.returnTemplate?.devices?.[0]?.deviceCode, "BGS03");
  assert.match(payload.returnTemplate?.outputs?.csv || "", /fcu-field-remediation-return-template-latest\.csv$/);
  assert.equal(payload.returnTemplate?.controlMutation, false);
  assert.equal(payload.returnTemplate?.dispatch, false);
  assert.equal(payload.handoff?.summary?.openP0Devices, 8);
  assert.equal(payload.handoff?.devices?.[0]?.deviceCode, "BGS03");
  assert.match(payload.handoff?.outputFiles?.json || "", /fcu-field-handoff-pack-latest\.json$/);
  assert.equal(payload.handoff?.controlMutation, false);
  assert.equal(payload.handoff?.dispatch, false);
  assert.equal(payload.fieldRemediationPlaybook?.deviceCount, 8);
  assert.equal(payload.fieldRemediationPlaybook?.canaryBlockedByField, true);
  assert.equal(payload.fieldRemediationPlaybook?.reasonGroups?.[0]?.reason, "communication_alarm");
  assert.equal(payload.fieldRemediationPlaybook?.devices?.[0]?.fieldPriority?.[0], "通讯恢复");
  assert.equal(payload.finalControlGates?.blockers?.[0]?.label, "现场签字");
  assert.equal(typeof payload.reportStatuses?.workOrders?.sourceFile, "string");
  assert.equal(typeof payload.reportStatuses?.returnTemplate?.sourceFile, "string");

  const forbiddenResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-status`, {
    headers: buildHeaders("unknown-user")
  });
  assert.equal(forbiddenResponse.status, 403);
});

test("admin FCU signoff preview validates pasted CSV without persisting", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-preview-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  writeJson(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json"), {
    ok: false,
    siteId: "126lnoffice",
    controlMutation: false,
    summary: {
      totalWorkOrders: 1,
      openCount: 1
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师",
        currentEvidence: {
          zoneTemperatureC: 0,
          setpointC: 0,
          communicationAlarm: true,
          reasons: ["communication_alarm"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "必填：5-45",
          writePointMappingChecked: "必填：yes/no",
          twoSampleNormal: "必填：yes/no",
          localManualLockout: "必填：none/manual/lockout",
          releaseDecision: "必填：hold/recheck/release"
        },
        plannedAction: ["复位通讯报警"],
        releaseCriteria: ["communicationAlarm=0"]
      }
    ]
  });

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const csv = [
    "workOrderId,deviceCode,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes",
    "FCU-P0-BGS03,BGS03,张工,2026-06-18T10:00:00+08:00,0,24,,yes,yes,none,release,李工,2026-06-18T10:05:00+08:00,现场复核"
  ].join("\n");
  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/preview`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({ signoffCsvText: csv })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.persisted, false);
  assert.equal(payload.ok, true);
  assert.equal(payload.summary?.completeRows, 1);
  assert.equal(payload.summary?.signoffComplete, true);
  assert.equal(payload.releaseMatrix?.[0]?.signoffComplete, true);
  assert.equal(fs.existsSync(path.join(outputDir, "signoff-preview.json")), false);

  const badResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/preview`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({ signoffCsvText: "workOrderId,deviceCode\nFCU-P0-BGS03,BGS03\n" })
  });
  assert.equal(badResponse.status, 200);
  const badPayload = await badResponse.json();
  assert.equal(badPayload.ok, false);
  assert.equal(badPayload.summary?.missingColumns?.includes("handledBy"), true);
});

test("admin FCU signoff promote persists CSV with explicit confirmation only", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-promote-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "auditor-office",
      username: "auditor-office",
      role: "auditor"
    },
    platformActor,
    {}
  );

  writeJson(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json"), {
    ok: false,
    siteId: "126lnoffice",
    controlMutation: false,
    summary: {
      totalWorkOrders: 1,
      openCount: 1
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师",
        currentEvidence: {
          zoneTemperatureC: 0,
          setpointC: 0,
          communicationAlarm: true,
          reasons: ["communication_alarm"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "必填：5-45",
          writePointMappingChecked: "必填：yes/no",
          twoSampleNormal: "必填：yes/no",
          localManualLockout: "必填：none/manual/lockout",
          releaseDecision: "必填：hold/recheck/release"
        },
        plannedAction: ["复位通讯报警"],
        releaseCriteria: ["communicationAlarm=0"]
      }
    ]
  });
  fs.writeFileSync(
    path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"),
    "workOrderId,deviceCode,handledBy\nFCU-P0-OLD,OLD,旧记录\n"
  );

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const csv = [
    "workOrderId,deviceCode,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes",
    "FCU-P0-BGS03,BGS03,张工,2026-06-18T10:00:00+08:00,0,24,,yes,yes,none,release,李工,2026-06-18T10:05:00+08:00,现场复核"
  ].join("\n");

  const auditorResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/promote`, {
    method: "POST",
    headers: buildHeaders("auditor-office"),
    body: JSON.stringify({
      signoffCsvText: csv,
      confirmPhrase: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT"
    })
  });
  assert.equal(auditorResponse.status, 403);

  const missingConfirmResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/promote`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({ signoffCsvText: csv })
  });
  assert.equal(missingConfirmResponse.status, 400);

  const badCsvResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/promote`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      signoffCsvText: "workOrderId,deviceCode\nFCU-P0-BGS03,BGS03\n",
      confirmPhrase: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT"
    })
  });
  assert.equal(badCsvResponse.status, 400);

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/promote`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      signoffCsvText: csv,
      confirmPhrase: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT"
    })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.persisted, true);
  assert.equal(payload.promote?.fileMutation, true);
  assert.equal(payload.signoff?.summary?.completeRows, 1);
  assert.equal(typeof payload.signoff?.summary?.signoffComplete, "boolean");
  assert.equal(typeof payload.refreshedStatus?.summary?.signoffComplete, "boolean");
  assert.equal(payload.finalControlGates?.controlMutation, false);
  assert.equal(payload.finalControlRunbook?.controlMutation, false);
  assert.equal(payload.finalControlRunbook?.dispatch, false);
  assert.equal(typeof payload.finalControlRunbook?.verdict, "string");
  assert.equal(payload.evidenceConsistency?.controlMutation, false);
  assert.equal(payload.evidenceConsistency?.dispatch, false);
  assert.equal(typeof payload.evidenceConsistency?.verdict, "string");
  const signoffInput = fs.readFileSync(path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"), "utf8");
  assert.match(signoffInput, /FCU-P0-BGS03/);
  assert.doesNotMatch(signoffInput, /FCU-P0-OLD/);
  assert.equal(fs.readdirSync(outputDir).some((item) => item.startsWith("fcu-field-remediation-signoff-input-latest-backup-")), true);
});

test("admin FCU field-remediation refresh regenerates final gates without control mutation", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-field-refresh-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "auditor-office",
      username: "auditor-office",
      role: "auditor"
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const forbiddenResponse = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-status/refresh`, {
    method: "POST",
    headers: buildHeaders("auditor-office"),
    body: JSON.stringify({})
  });
  assert.equal(forbiddenResponse.status, 403);

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-status/refresh`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({})
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.mode, "refresh");
  assert.equal(payload.scripts?.finalControlGates?.accepted, true);
  assert.equal(payload.scripts?.handoff?.accepted, true);
  assert.equal(payload.status?.finalControlGates?.controlMutation, false);
  assert.equal(payload.status?.handoff?.controlMutation, false);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-gates-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-handoff-pack-latest.json")), true);
});

test("admin FCU signoff row save updates one work order while preserving other rows", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-row-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  writeJson(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json"), {
    ok: false,
    siteId: "126lnoffice",
    controlMutation: false,
    summary: {
      totalWorkOrders: 2,
      openCount: 2
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师"
      },
      {
        workOrderId: "FCU-P0-BGS04",
        priority: "P0",
        deviceCode: "BGS04",
        deviceName: "办公室04",
        owner: "BA/自控工程师"
      }
    ]
  });
  fs.writeFileSync(
    path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"),
    [
      "workOrderId,deviceCode,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes",
      "FCU-P0-BGS04,BGS04,王工,2026-06-18T09:00,0,25,26,yes,yes,none,hold,赵工,2026-06-18T09:10,保留行"
    ].join("\n")
  );

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/row`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({
      confirmPhrase: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT",
      record: {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        handledBy: "张工",
        handledAt: "2026-06-18T10:00",
        communicationAlarmAfter: "0",
        zoneTemperatureAfterC: "24.5",
        setpointFeedbackAfterC: "26",
        writePointMappingChecked: "yes",
        twoSampleNormal: "yes",
        localManualLockout: "none",
        releaseDecision: "release",
        reviewedBy: "李工",
        reviewedAt: "2026-06-18T10:10",
        notes: "单台复核"
      }
    })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.fileMutation, true);
  assert.equal(payload.csvUpdate?.rowCount, 2);
  assert.equal(payload.scripts?.finalControlWorklist?.accepted, true);
  assert.equal(payload.scripts?.finalControlRunbook?.accepted, true);
  assert.equal(payload.scripts?.evidenceConsistency?.accepted, true);
  assert.equal(payload.finalControlGates?.summary?.signoffExpectedRows, 2);
  assert.equal(payload.finalControlRunbook?.controlMutation, false);
  assert.equal(payload.finalControlRunbook?.dispatch, false);
  assert.equal(typeof payload.finalControlRunbook?.verdict, "string");
  assert.equal(payload.evidenceConsistency?.controlMutation, false);
  assert.equal(payload.evidenceConsistency?.dispatch, false);
  const csv = fs.readFileSync(path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"), "utf8");
  assert.match(csv, /FCU-P0-BGS03/);
  assert.match(csv, /单台复核/);
  assert.match(csv, /FCU-P0-BGS04/);
  assert.match(csv, /保留行/);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-worklist-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-runbook-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-evidence-consistency-latest.json")), true);
});

test("admin FCU signoff clean-promote removes stale rows without control mutation", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-clean-promote-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  writeJson(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json"), {
    ok: false,
    siteId: "126lnoffice",
    controlMutation: false,
    summary: {
      totalWorkOrders: 1,
      openCount: 1
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师"
      }
    ]
  });
  fs.writeFileSync(
    path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"),
    [
      "workOrderId,deviceCode,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes",
      "FCU-P0-BGS03,BGS03,张工,2026-06-18T10:00,0,24,26,yes,yes,none,hold,李工,2026-06-18T10:10,有效行",
      "FCU-P0-OLD,OLD,王工,2026-06-18T09:00,0,25,26,yes,yes,none,hold,赵工,2026-06-18T09:10,旧行"
    ].join("\n")
  );

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-remediation-signoff/clean-promote`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({ confirmPhrase: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT" })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.fileMutation, true);
  assert.equal(payload.clean?.summary?.staleRows, 1);
  assert.equal(payload.promote?.fileMutation, true);
  assert.equal(payload.signoff?.summary?.ignoredRows, 0);
  assert.equal(payload.finalControlGates?.summary?.signoffExpectedRows, 1);
  const csv = fs.readFileSync(path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv"), "utf8");
  assert.match(csv, /FCU-P0-BGS03/);
  assert.doesNotMatch(csv, /FCU-P0-OLD/);
  assert.equal(fs.readdirSync(outputDir).some((item) => item.startsWith("fcu-field-remediation-signoff-input-latest-backup-")), true);
});

test("admin FCU field-arm-package creates per-device canary evidence without dispatch", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-field-arm-package-"));
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, platformActor, {});
  adminStore.createSiteMember(
    "126lnoffice",
    {
      userId: "site-admin-office",
      username: "site-admin-office",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore, { fcuFinalControlOutputDir: outputDir });
  t.after(async () => {
    await server.close();
    adminStore.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-arm-package`, {
    method: "POST",
    headers: buildHeaders("site-admin-office"),
    body: JSON.stringify({ deviceCode: "BGS03" })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.controlMutation, false);
  assert.equal(payload.dispatch, false);
  assert.equal(payload.deviceCode, "BGS03");
  assert.equal(payload.scripts?.canaryWindow?.accepted, true);
  assert.equal(payload.scripts?.fieldArmPackage?.accepted, true);
  assert.equal(Array.isArray(payload.fieldArmPackage?.checklist), true);
  assert.equal(typeof payload.baWriteAdapterReadiness?.verdict, "string");
  assert.equal(payload.baWriteAdapterReadiness?.controlMutation, false);
  assert.equal(typeof payload.canaryFeedbackMonitor?.verdict, "string");
  assert.equal(payload.canaryFeedbackMonitor?.controlMutation, false);
  assert.equal(payload.canaryFeedbackMonitor?.dispatch, false);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-canary-window-bgs03.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-arm-package-bgs03.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-closeout-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-signoff-latest.json")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-return-template-latest.json")), true);
  const tempWorklist = JSON.parse(fs.readFileSync(path.join(outputDir, "fcu-final-control-worklist-latest.json"), "utf8"));
  assert.match(tempWorklist.fieldPackages?.fieldRemediationCloseout?.json || "", new RegExp(outputDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(tempWorklist.fieldPackages?.fieldRemediationSignoff?.json || "", new RegExp(outputDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(tempWorklist.fieldPackages?.fieldReturnTemplate?.json || "", new RegExp(outputDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("admin runtime-config route persists tower approach controlTargets mapping payloads", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, platformActor, {});
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

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const updateResponse = await fetch(`${server.baseUrl}/admin/v1/sites/btwentyfive/runtime-config`, {
    method: "PUT",
    headers: buildHeaders("site-admin-b25"),
    body: JSON.stringify({
      ruleThresholdsJson: JSON.stringify({
        towerApproach: {
          controlTargets: {
            approve: {
              endpoint: "/zsqy/qstag/{siteId}/doimplements",
              strategy: "device-reg-command",
              requiredContext: ["userId", "appId", "drTypeId", "drId", "tagName"]
            }
          }
        }
      })
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatedPayload = await updateResponse.json();
  assert.equal(
    updatedPayload.runtimeConfig?.ruleThresholds?.towerApproach?.controlTargets?.approve?.endpoint,
    "/zsqy/qstag/{siteId}/doimplements"
  );
  assert.deepEqual(
    updatedPayload.runtimeConfig?.ruleThresholds?.towerApproach?.controlTargets?.approve?.requiredContext,
    ["userId", "appId", "drTypeId", "drId", "tagName"]
  );
});

test("admin runtime-config route rejects invalid JSON-string payloads", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "btwentyfive", siteName: "B25" }, platformActor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/sites/btwentyfive/runtime-config`, {
    method: "PUT",
    headers: buildHeaders("platform-admin"),
    body: JSON.stringify({
      ruleThresholdsJson: "{invalid-json"
    })
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.code, "BAD_REQUEST");
  assert.equal(payload.details?.field, "ruleThresholds");
});

test("admin source-config route persists preferredProjectKey", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "140", siteName: "B25 Numeric" }, platformActor, {});

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const updateResponse = await fetch(`${server.baseUrl}/admin/v1/sites/140/source-config`, {
    method: "PUT",
    headers: buildHeaders("platform-admin"),
    body: JSON.stringify({
      databaseKey: "140btwentyfive",
      modelKey: "126lnoffice",
      preferredProjectKey: "126lnoffice",
      template: "1"
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatedPayload = await updateResponse.json();
  assert.equal(updatedPayload.sourceConfig?.preferredProjectKey, "126lnoffice");
  assert.equal(updatedPayload.sourceConfig?.databaseKey, "140btwentyfive");
  assert.equal(updatedPayload.effectiveSourceConfig?.deviceDataProjectKey, "140btwentyfive");
  assert.equal(updatedPayload.effectiveSourceConfig?.defaultDeviceQuery?.build, 1);
  assert.equal(updatedPayload.effectiveSourceConfig?.defaultDeviceQuery?.floor, 0);
  assert.equal(updatedPayload.effectiveSourceConfig?.defaultDeviceQuery?.mock, false);
  assert.equal(updatedPayload.effectiveSourceConfig?.deviceDataInterfaces?.[0]?.endpoint,
    "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0");

  const getResponse = await fetch(`${server.baseUrl}/admin/v1/sites/140/source-config`, {
    headers: buildHeaders("platform-admin")
  });
  assert.equal(getResponse.status, 200);
  const fetchedPayload = await getResponse.json();
  assert.equal(fetchedPayload.sourceConfig?.preferredProjectKey, "126lnoffice");
  assert.equal(fetchedPayload.sourceConfig?.modelKey, "126lnoffice");
  assert.equal(fetchedPayload.effectiveSourceConfig?.deviceDataProjectKey, "140btwentyfive");
  assert.equal(fetchedPayload.effectiveSourceConfig?.deviceDataInterfaces?.[0]?.label, "观澜B25");
});

test("energy config admin routes enforce read and write roles", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "site-energy", siteName: "综合能源站" }, platformActor, {});
  adminStore.createSiteMember(
    "site-energy",
    {
      userId: "site-admin-energy",
      username: "site-admin-energy",
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "site-energy",
    {
      userId: "auditor-energy",
      username: "auditor-energy",
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

  const readResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/subsystems`, {
    headers: buildHeaders("auditor-energy")
  });
  assert.equal(readResponse.status, 200);
  const readPayload = await readResponse.json();
  assert.ok(readPayload.items.some((item) => item.subsystemType === "power_monitoring"));

  const previewResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/point-role-mappings/import-preview`, {
    method: "POST",
    headers: buildHeaders("auditor-energy"),
    body: JSON.stringify({
      subsystemType: "power_monitoring",
      text: "总进线有功功率,P_MAIN_KW,kW"
    })
  });
  assert.equal(previewResponse.status, 200);
  const previewPayload = await previewResponse.json();
  assert.equal(previewPayload.preview?.items?.[0]?.pointRole, "power");
  assert.equal(previewPayload.preview?.items?.[0]?.writable, false);

  const deniedWriteResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/subsystems`, {
    method: "PUT",
    headers: buildHeaders("auditor-energy"),
    body: JSON.stringify({
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled"
        }
      ]
    })
  });
  assert.equal(deniedWriteResponse.status, 403);

  const siteAdminWriteResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/subsystems`, {
    method: "PUT",
    headers: buildHeaders("site-admin-energy"),
    body: JSON.stringify({
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled",
          controlBoundary: {
            mode: "shadow"
          }
        }
      ]
    })
  });
  assert.equal(siteAdminWriteResponse.status, 200);
  const siteAdminWritePayload = await siteAdminWriteResponse.json();
  const power = siteAdminWritePayload.items.find((item) => item.subsystemType === "power_monitoring");
  assert.equal(power?.status, "enabled");
  assert.equal(power?.controlBoundary?.mode, "shadow");
  assert.equal(power?.controlBoundary?.writeEnabled, false);

  const deniedStationWriteResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
    method: "PUT",
    headers: buildHeaders("auditor-energy"),
    body: JSON.stringify({
      items: [
        {
          stationId: "chilled-a",
          stationName: "冷冻站 A",
          parentSubsystemType: "chilled_plant"
        }
      ]
    })
  });
  assert.equal(deniedStationWriteResponse.status, 403);

  const stationWriteResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
    method: "PUT",
    headers: buildHeaders("site-admin-energy"),
    body: JSON.stringify({
      items: [
        {
          stationId: "chilled-a",
          stationName: "冷冻站 A",
          parentSubsystemType: "chilled_plant",
          status: "enabled",
          published: true
        }
      ]
    })
  });
  assert.equal(stationWriteResponse.status, 200);
  const stationWritePayload = await stationWriteResponse.json();
  assert.equal(stationWritePayload.items?.[0]?.stationId, "chilled-a");

  const invalidStationParentResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
    method: "PUT",
    headers: buildHeaders("site-admin-energy"),
    body: JSON.stringify({
      items: [
        {
          stationId: "terminal-east",
          stationName: "东区末端",
          parentSubsystemType: "hvac_terminal"
        }
      ]
    })
  });
  assert.equal(invalidStationParentResponse.status, 400);
  const invalidStationParentPayload = await invalidStationParentResponse.json();
  assert.equal(invalidStationParentPayload.details?.field, "parentSubsystemType");
  assert.deepEqual(invalidStationParentPayload.details?.allowed, [
    "chilled_plant",
    "compressed_air",
    "boiler_room"
  ]);

  const invalidStationIdResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
    method: "PUT",
    headers: buildHeaders("site-admin-energy"),
    body: JSON.stringify({
      items: [
        {
          stationId: "冷冻站 B",
          stationName: "冷冻站 B",
          parentSubsystemType: "chilled_plant"
        }
      ]
    })
  });
  assert.equal(invalidStationIdResponse.status, 400);
  assert.equal((await invalidStationIdResponse.json()).details?.field, "stationId");

  for (const [field, value] of [
    ["status", "ready"],
    ["published", "true"],
    ["sortOrder", -1]
  ]) {
    const invalidContractResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
      method: "PUT",
      headers: buildHeaders("site-admin-energy"),
      body: JSON.stringify({
        items: [
          {
            stationId: `invalid-${field}`,
            stationName: `非法 ${field} 站房`,
            parentSubsystemType: "chilled_plant",
            status: "not_configured",
            published: false,
            sortOrder: 90,
            [field]: value
          }
        ]
      })
    });
    assert.equal(invalidContractResponse.status, 400);
    assert.equal((await invalidContractResponse.json()).details?.field, field);
  }

  const duplicateStationNameResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations`, {
    method: "PUT",
    headers: buildHeaders("site-admin-energy"),
    body: JSON.stringify({
      items: [
        {
          stationId: "chilled-b",
          stationName: "冷冻站 A",
          parentSubsystemType: "chilled_plant"
        }
      ]
    })
  });
  assert.equal(duplicateStationNameResponse.status, 409);
  assert.equal((await duplicateStationNameResponse.json()).details?.conflictingStationId, "chilled-a");

  const stationReadResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/stations?publishedOnly=true`, {
    headers: buildHeaders("auditor-energy")
  });
  assert.equal(stationReadResponse.status, 200);
  const stationReadPayload = await stationReadResponse.json();
  assert.equal(stationReadPayload.total, 1);
  assert.equal(stationReadPayload.items?.[0]?.parentSubsystemType, "chilled_plant");

  const publishResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/config-versions/cfg-route-test/publish`, {
    method: "POST",
    headers: buildHeaders("platform-admin"),
    body: JSON.stringify({
      summary: "route permission test"
    })
  });
  assert.equal(publishResponse.status, 200);
  const publishPayload = await publishResponse.json();
  assert.equal(publishPayload.version?.versionId, "cfg-route-test");
  assert.equal(publishPayload.version?.status, "published");

  const versionListResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/config-versions`, {
    headers: buildHeaders("auditor-energy")
  });
  assert.equal(versionListResponse.status, 200);
  const versionListPayload = await versionListResponse.json();
  assert.equal(versionListPayload.total, 1);
  assert.equal(versionListPayload.items?.[0]?.versionId, "cfg-route-test");
  assert.equal(versionListPayload.items?.[0]?.siteId, "site-energy");
  assert.equal(versionListPayload.items?.[0]?.payload, undefined);

  const rollbackResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-energy/config-versions/cfg-route-test/rollback`, {
    method: "POST",
    headers: buildHeaders("platform-admin")
  });
  assert.equal(rollbackResponse.status, 200);
  const rollbackPayload = await rollbackResponse.json();
  assert.equal(rollbackPayload.version?.versionId, "cfg-route-test");
  assert.equal(rollbackPayload.version?.status, "rolled_back");
});

test("station registry writes remain blocked when the BFF is globally read-only", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "site-read-only", siteName: "只读能源站" }, platformActor, {});
  adminStore.createSiteMember(
    "site-read-only",
    {
      userId: "site-admin-read-only",
      username: "site-admin-read-only",
      role: "site_admin"
    },
    platformActor,
    {}
  );

  const server = await startTestServer(adminStore, { readOnlyMode: true });
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const readResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-read-only/stations`, {
    headers: buildHeaders("site-admin-read-only")
  });
  assert.equal(readResponse.status, 200);

  const writeResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-read-only/stations`, {
    method: "PUT",
    headers: buildHeaders("site-admin-read-only"),
    body: JSON.stringify({
      items: [
        {
          stationId: "chilled-01",
          stationName: "1号冷冻站",
          parentSubsystemType: "chilled_plant"
        }
      ]
    })
  });
  assert.equal(writeResponse.status, 403);
  const payload = await writeResponse.json();
  assert.equal(payload.code, "READ_ONLY_MODE");
  assert.equal(adminStore.listStationInstances("site-read-only").total, 0);
});

test("station registry write permission is evaluated for the requested site", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const platformActor = {
    userId: "platform-admin",
    username: "platform-admin"
  };
  const mixedUserId = "mixed-site-user";

  adminStore.bootstrapPlatformAdmin(platformActor, {});
  adminStore.createSite({ siteId: "site-write", siteName: "可维护站点" }, platformActor, {});
  adminStore.createSite({ siteId: "site-audit", siteName: "只审计站点" }, platformActor, {});
  adminStore.createSiteMember(
    "site-write",
    {
      userId: mixedUserId,
      username: mixedUserId,
      role: "site_admin"
    },
    platformActor,
    {}
  );
  adminStore.createSiteMember(
    "site-audit",
    {
      userId: mixedUserId,
      username: mixedUserId,
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

  const writableResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-write/stations`, {
    method: "PUT",
    headers: buildHeaders(mixedUserId),
    body: JSON.stringify({
      items: [
        {
          stationId: "air-01",
          stationName: "1号空压站",
          parentSubsystemType: "compressed_air"
        }
      ]
    })
  });
  assert.equal(writableResponse.status, 200);

  const forbiddenResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-audit/stations`, {
    method: "PUT",
    headers: buildHeaders(mixedUserId),
    body: JSON.stringify({
      items: [
        {
          stationId: "air-02",
          stationName: "2号空压站",
          parentSubsystemType: "compressed_air"
        }
      ]
    })
  });
  assert.equal(forbiddenResponse.status, 403);
  assert.equal(adminStore.listStationInstances("site-write").total, 1);
  assert.equal(adminStore.listStationInstances("site-audit").total, 0);
});

test("station runtime binding routes enforce draft, real validation, and independent publish roles", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const source = await startRuntimeBindingSourceServer();
  const platformCreator = { userId: "platform-creator", username: "platform-creator" };
  const platformPublisher = { userId: "platform-publisher", username: "platform-publisher" };

  adminStore.bootstrapPlatformAdmin(platformCreator, {});
  adminStore.bootstrapPlatformAdmin(platformPublisher, {});
  adminStore.createSite({ siteId: "site-binding", siteName: "综合能源站" }, platformCreator, {});
  adminStore.createSiteMember(
    "site-binding",
    { userId: "binding-editor", username: "binding-editor", role: "site_admin" },
    platformCreator,
    {}
  );
  adminStore.createSiteMember(
    "site-binding",
    { userId: "binding-auditor", username: "binding-auditor", role: "auditor" },
    platformCreator,
    {}
  );
  adminStore.upsertStationInstances("site-binding", {
    items: [{
      stationId: "chilled-a",
      stationName: "冷冻站 A",
      parentSubsystemType: "chilled_plant",
      status: "enabled",
      published: true
    }]
  }, platformCreator, {});

  const server = await startTestServer(adminStore, { legacyBaseUrl: source.baseUrl });
  t.after(async () => {
    await server.close();
    await source.close();
    adminStore.close();
  });
  const bindingUrl = `${server.baseUrl}/admin/v1/sites/site-binding/stations/chilled-a/runtime-binding`;

  const forbiddenEvidenceResponse = await fetch(`${server.baseUrl}/admin/v1/sites/site-binding/stations`, {
    method: "PUT",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({
      items: [{
        stationId: "chilled-a",
        stationName: "冷冻站 A",
        parentSubsystemType: "chilled_plant",
        sourceStatus: "ok",
        freshnessStatus: "fresh",
        alarmCount: 0
      }]
    })
  });
  assert.equal(forbiddenEvidenceResponse.status, 400);
  assert.deepEqual((await forbiddenEvidenceResponse.json()).details?.fields, [
    "sourceStatus",
    "freshnessStatus",
    "alarmCount"
  ]);

  const auditorWriteResponse = await fetch(bindingUrl, {
    method: "PUT",
    headers: buildHeaders("binding-auditor"),
    body: JSON.stringify({
      expectedVersion: 0,
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: ["CH1-RUN"] }
    })
  });
  assert.equal(auditorWriteResponse.status, 403);

  const draftResponse = await fetch(bindingUrl, {
    method: "PUT",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({
      expectedVersion: 0,
      source: { databaseKey: "station-db", projectKey: "station-project", template: "1" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: ["CH1-RUN"] },
      notes: "冷冻站 A 设备边界"
    })
  });
  assert.equal(draftResponse.status, 200);
  const draftPayload = await draftResponse.json();
  assert.equal(draftPayload.draftVersion, 1);
  assert.equal(draftPayload.publishedVersion, null);
  assert.equal(draftPayload.draftBinding?.status, "draft");
  assert.ok(draftPayload.draftBinding?.payloadHash);

  const getDraftResponse = await fetch(bindingUrl, {
    headers: buildHeaders("binding-auditor")
  });
  assert.equal(getDraftResponse.status, 200);
  const getDraftPayload = await getDraftResponse.json();
  assert.equal(getDraftPayload.draftBinding?.bindingVersion, 1);
  assert.equal(getDraftPayload.publishedBinding, null);

  const validateResponse = await fetch(`${bindingUrl}/validate`, {
    method: "POST",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({ expectedVersion: 1 })
  });
  assert.equal(validateResponse.status, 200);
  const validatePayload = await validateResponse.json();
  assert.equal(validatePayload.validation?.ok, true);
  assert.equal(validatePayload.validation?.matched?.deviceCount, 1);
  assert.equal(validatePayload.validation?.matched?.pointCount, 1);
  assert.equal(validatePayload.validation?.sourceEvidence?.mock, false);
  assert.equal(validatePayload.binding?.validatedHash, validatePayload.binding?.payloadHash);
  assert.ok(validatePayload.validation?.catalogHash);
  assert.equal(source.requests.every((item) => item.method === "GET"), true);

  const siteAdminPublishResponse = await fetch(`${bindingUrl}/publish`, {
    method: "POST",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({ expectedVersion: 1 })
  });
  assert.equal(siteAdminPublishResponse.status, 403);

  const publishResponse = await fetch(`${bindingUrl}/publish`, {
    method: "POST",
    headers: buildHeaders("platform-publisher"),
    body: JSON.stringify({ expectedVersion: 1 })
  });
  assert.equal(publishResponse.status, 200);
  const publishPayload = await publishResponse.json();
  assert.equal(publishPayload.binding?.status, "published");
  assert.equal(publishPayload.draftVersion, null);
  assert.equal(publishPayload.publishedVersion, 1);

  const secondDraftResponse = await fetch(bindingUrl, {
    method: "PUT",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({
      expectedVersion: 1,
      source: { databaseKey: "station-db", projectKey: "station-project", template: "1" },
      selectors: { deviceIds: ["2"], deviceCodes: ["CH2"], pointCodes: ["CH2-RUN"] }
    })
  });
  assert.equal(secondDraftResponse.status, 200);
  const secondDraftPayload = await secondDraftResponse.json();
  assert.equal(secondDraftPayload.draftVersion, 2);
  assert.equal(secondDraftPayload.publishedVersion, 1);
  assert.equal(secondDraftPayload.publishedBinding?.selectors?.deviceIds?.[0], "1");
  assert.equal(secondDraftPayload.draftBinding?.selectors?.deviceIds?.[0], "2");

  const staleDraftResponse = await fetch(bindingUrl, {
    method: "PUT",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({
      expectedVersion: 1,
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: [] }
    })
  });
  assert.equal(staleDraftResponse.status, 409);
  const stalePayload = await staleDraftResponse.json();
  assert.equal(stalePayload.details?.expectedVersion, 1);
  assert.equal(stalePayload.details?.currentVersion, 2);

  const invalidDraftResponse = await fetch(bindingUrl, {
    method: "PUT",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({
      expectedVersion: 2,
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["missing-device"], deviceCodes: ["MISSING"], pointCodes: [] }
    })
  });
  assert.equal(invalidDraftResponse.status, 200);
  assert.equal((await invalidDraftResponse.json()).draftVersion, 3);

  const failedValidationResponse = await fetch(`${bindingUrl}/validate`, {
    method: "POST",
    headers: buildHeaders("binding-editor"),
    body: JSON.stringify({ expectedVersion: 3 })
  });
  assert.equal(failedValidationResponse.status, 422);
  const failedValidationPayload = await failedValidationResponse.json();
  assert.equal(failedValidationPayload.ok, false);
  assert.equal(failedValidationPayload.code, "STATION_RUNTIME_BINDING_VALIDATION_FAILED");
  assert.equal(failedValidationPayload.validation?.ok, false);
  assert.ok(failedValidationPayload.validation?.errors?.includes("DEVICE_IDS_UNMATCHED"));
  assert.equal(failedValidationPayload.publishedVersion, 1);
});

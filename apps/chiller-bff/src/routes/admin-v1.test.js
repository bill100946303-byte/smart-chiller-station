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

function buildHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-chiller-user-id": token
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

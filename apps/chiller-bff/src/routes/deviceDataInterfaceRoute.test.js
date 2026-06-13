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

test("device-data-interfaces route exposes builtin project interface defaults for 140", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "140", siteName: "B25 Numeric" }, actor, {});
  adminStore.upsertSourceConfig(
    "140",
    {
      databaseKey: "140btwentyfive",
      modelKey: "126lnoffice",
      preferredProjectKey: "126lnoffice",
      template: "1"
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const response = await fetch(`${server.baseUrl}/bff/v1/sites/140/device-data-interfaces`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.siteId, "140");
  assert.equal(payload.projectKey, "140btwentyfive");
  assert.deepEqual(payload.defaultQuery, {
    build: 1,
    floor: 0,
    mock: false
  });
  assert.equal(payload.items?.length, 1);
  assert.equal(payload.items?.[0]?.projectKey, "140btwentyfive");
  assert.equal(payload.items?.[0]?.endpointKind, "legacy-reg-findAllByDrTypeId");
  assert.equal(payload.items?.[0]?.endpoint, "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0");
});

test("device-data-interfaces route prefers api-device variant when project has multiple interface entries", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "platform-admin",
    username: "platform-admin"
  };

  adminStore.bootstrapPlatformAdmin(actor, {});
  adminStore.createSite({ siteId: "126lnoffice", siteName: "Office" }, actor, {});
  adminStore.upsertSourceConfig(
    "126lnoffice",
    {
      databaseKey: "126lnoffice",
      modelKey: "126lnoffice"
    },
    actor,
    {}
  );

  const server = await startTestServer(adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const response = await fetch(`${server.baseUrl}/bff/v1/sites/126lnoffice/device-data-interfaces`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.projectKey, "126lnoffice");
  assert.deepEqual(payload.defaultQuery, {
    build: 1,
    floor: 1,
    mock: true
  });
  assert.equal(payload.items?.length, 2);
  assert.equal(payload.items?.[0]?.endpoint, "/api/device/126lnoffice/data?mock=1&build=1&floor=1");
  assert.equal(payload.items?.[1]?.endpoint, "/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=2");
});

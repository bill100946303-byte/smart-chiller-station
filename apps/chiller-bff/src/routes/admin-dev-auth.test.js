import test from "node:test";
import assert from "node:assert/strict";

import { createAdminStore } from "../lib/admin-db.js";
import { createApp } from "../server.js";

function createTestConfig(overrides = {}) {
  return {
    port: 0,
    appMode: "local",
    appModeLabel: "本地开发",
    readOnlyMode: false,
    legacyBaseUrl: "http://127.0.0.1:1",
    defaultSiteId: "140",
    staleThresholdHours: 24,
    adminDbFile: ":memory:",
    adminBootstrapUserIds: [],
    adminBootstrapUsernames: ["admin"],
    adminDevAuth: false,
    adminDevAuthToken: "",
    fieldDictionaryFile: "",
    hvacRulesFile: "",
    ...overrides
  };
}

async function startServer(config, adminStore) {
  const { app } = createApp(config, { adminStore });
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

function buildHeaders() {
  return {
    authorization: "Bearer mock-token-admin",
    "x-chiller-user-id": "admin"
  };
}

test("local admin dev auth remains disabled unless explicitly enabled", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  adminStore.createSite({ siteId: "140", siteName: "观澜 B25" }, { userId: "seed", username: "seed" });
  const server = await startServer(createTestConfig({ adminDevAuth: false }), adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const response = await fetch(`${server.baseUrl}/admin/v1/me`, {
    headers: buildHeaders()
  });
  assert.equal(response.status, 401);
});

test("local admin dev auth bootstraps an admin session for real admin routes", async (t) => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  adminStore.createSite({ siteId: "140", siteName: "观澜 B25" }, { userId: "seed", username: "seed" });
  adminStore.upsertSiteSubsystems(
    "140",
    {
      items: [
        {
          subsystemType: "compressed_air",
          status: "enabled",
          controlBoundary: {
            mode: "read_only"
          }
        }
      ]
    },
    { userId: "seed", username: "seed" }
  );
  const server = await startServer(createTestConfig({ adminDevAuth: true }), adminStore);
  t.after(async () => {
    await server.close();
    adminStore.close();
  });

  const meResponse = await fetch(`${server.baseUrl}/admin/v1/me`, {
    headers: buildHeaders()
  });
  assert.equal(meResponse.status, 200);
  const me = await meResponse.json();
  assert.equal(me.role, "platform_admin");
  assert.ok(me.visibleSites.some((site) => site.siteId === "140"));

  const subsystemResponse = await fetch(`${server.baseUrl}/admin/v1/sites/140/subsystems`, {
    headers: buildHeaders()
  });
  assert.equal(subsystemResponse.status, 200);
  const payload = await subsystemResponse.json();
  const compressedAir = payload.items.find((item) => item.subsystemType === "compressed_air");
  assert.equal(compressedAir?.status, "enabled");
  assert.equal(compressedAir?.controlBoundary?.writeEnabled, false);
});

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

function mockLegacyFetch(originalFetch) {
  const legacyBaseUrl = "http://127.0.0.1:8098/";

  return async (url, init) => {
    const target = String(url);

    if (!target.startsWith(legacyBaseUrl)) {
      return originalFetch(url, init);
    }

    if (target.endsWith("/140/getAllSubsystemInfo")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/qsAlarmlog/140/findNewAlarmLog")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/drinfo/140/findObject?pageCurrent=1&pageSize=200")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/140/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-13 09:00:00",
            totalPower: 228.4,
            coldStationCop: 4.6,
            chilledWaterTemperatureDifference: 4.1,
            chilledOutWaterTemperatureDifference: 4.8,
            totalCoolingCapacity: 1056.2,
            chillerPower: 153.8,
            chilledPumpPower: 24.3,
            coolingPumpPower: 19.1,
            coolingTowerPower: 31.2,
            thermalUnbalanceRate: 0.12
          }
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/140/getEnergyStatisticsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/zsqy/homepage/140/getRunParamsCurve")) {
      return new Response(
        JSON.stringify([
          {
            metric: "chiller",
            points: [{ time: "2026-04-13 08:55:00", v: 1 }]
          },
          {
            metric: "chilledPump",
            points: [{ time: "2026-04-13 08:55:00", v: 1 }]
          },
          {
            metric: "coolingPump",
            points: [{ time: "2026-04-13 08:55:00", v: 1 }]
          },
          {
            title: "总功率",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 228.4 }]
            }
          },
          {
            title: "冷站COP",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.6 }]
            }
          },
          {
            title: "冷冻水温差",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.1 }]
            }
          },
          {
            title: "冷却水温差",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.8 }]
            }
          }
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected legacy URL: ${target}`);
  };
}

test("ai digest route returns await-approval summary for pending executions", async (t) => {
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

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockLegacyFetch(originalFetch);
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const createResponse = await fetch(`${server.baseUrl}/bff/v1/sites/140/optimize/executions`, {
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

  const response = await fetch(`${server.baseUrl}/bff/v1/sites/140/ai/digest`, {
    headers: buildHeaders("operator")
  });
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.summary?.stage, "await-approval");
  assert.equal(payload.governance?.status, "pending");
  assert.equal(payload.nextAction?.code, "review-pending-execution");
  assert.equal(payload.governance?.pendingApprovalCount, 1);
  assert.ok(Array.isArray(payload.signals));
});

import test from "node:test";
import assert from "node:assert/strict";

import { createAdminStore } from "./lib/admin-db.js";
import { createReadOnlyMiddleware, isAllowedReadOnlyV1Write } from "./server.js";

test("bootstrapPlatformAdmin grants the first platform admin and importSites preserves admin-edited fields", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "u-1",
    username: "admin"
  };

  const bootstrap = adminStore.bootstrapPlatformAdmin(actor, {
    requestId: "req-1"
  });
  assert.equal(bootstrap.binding.role, "platform_admin");

  const importedIds = adminStore.importSites(
    [
      {
        siteId: "site-a",
        siteCode: "A100",
        siteName: "Alpha 站点",
        city: "Shanghai",
        databaseKey: "site-aA100",
        modelKey: "m1",
        preferredProjectKey: "stable-k1",
        template: "t1",
        controlMode: "auto",
        ipAddress: "10.0.0.1",
        port: "8080"
      }
    ],
    actor,
    {
      requestId: "req-2"
    }
  );
  assert.deepEqual(importedIds, ["site-a"]);

  adminStore.updateSite(
    "site-a",
    {
      siteName: "手工改名站点",
      ownerName: "Bill"
    },
    actor,
    {
      requestId: "req-3"
    }
  );

  adminStore.importSites(
    [
      {
        siteId: "site-a",
        siteCode: "A100-NEW",
        siteName: "不会覆盖的新名字",
        city: "Suzhou",
        databaseKey: "site-aA100-NEW",
        modelKey: "m2",
        preferredProjectKey: "stable-k2",
        template: "t2",
        controlMode: "manual",
        ipAddress: "10.0.0.2",
        port: "8081"
      }
    ],
    actor,
    {
      requestId: "req-4"
    }
  );

  const site = adminStore.getSite("site-a");
  assert.equal(site.siteName, "手工改名站点");
  assert.equal(site.ownerName, "Bill");
  assert.equal(site.city, "Shanghai");
  assert.equal(site.sourceConfig.modelKey, "m1");
  assert.equal(site.sourceConfig.preferredProjectKey, "stable-k1");

  adminStore.close();
});

test("createSite rejects duplicate site ids", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "u-1",
    username: "admin"
  };

  adminStore.createSite(
    {
      siteId: "site-a",
      siteName: "Alpha"
    },
    actor,
    {
      requestId: "req-1"
    }
  );

  assert.throws(
    () =>
      adminStore.createSite(
        {
          siteId: "site-a",
          siteName: "Duplicate"
        },
        actor,
        {
          requestId: "req-2"
        }
      ),
    /Site already exists/
  );

  adminStore.close();
});

test("site-level member bindings restrict visible sites", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  const actor = {
    userId: "u-1",
    username: "admin"
  };

  adminStore.createSite({ siteId: "site-a", siteName: "Alpha" }, actor, {});
  adminStore.createSite({ siteId: "site-b", siteName: "Beta" }, actor, {});
  adminStore.createSiteMember(
    "site-b",
    {
      userId: "u-2",
      username: "site-admin",
      role: "site_admin"
    },
    actor,
    {
      requestId: "req-3"
    }
  );

  const context = adminStore.getAdminContext("u-2");
  const visibleSites = adminStore.listSites(
    {},
    {
      allowAllSites: false,
      siteIds: context.siteRoles.map((item) => item.scopeId)
    }
  );

  assert.equal(visibleSites.length, 1);
  assert.equal(visibleSites[0].siteId, "site-b");
  adminStore.close();
});

test("createReadOnlyMiddleware blocks admin writes while allowing safe methods", () => {
  const middleware = createReadOnlyMiddleware({
    appConfig: {
      appMode: "remote-integration",
      appModeLabel: "远端联调",
      readOnlyMode: true,
      legacyBaseUrl: "http://127.0.0.1:8098"
    }
  });

  let nextCalled = false;
  middleware(
    {
      method: "GET",
      requestId: "req-1"
    },
    {
      status() {
        throw new Error("GET should not be blocked");
      }
    },
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);

  let blockedStatus = 0;
  let blockedBody = null;
  middleware(
    {
      method: "POST",
      requestId: "req-2"
    },
    {
      status(code) {
        blockedStatus = code;
        return this;
      },
      json(body) {
        blockedBody = body;
      }
    },
    () => {
      throw new Error("POST should be blocked");
    }
  );

  assert.equal(blockedStatus, 403);
  assert.equal(blockedBody.code, "READ_ONLY_MODE");
});

test("read-only v1 allowlist permits advisory endpoints without opening generic writes", () => {
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/140/optimize/tower-approach/advice"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/140/optimize"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/control-cycle"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/control-command"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/canary-window"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/field-arm-package"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/canary-dispatch"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/final-control-status/refresh"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/126lnoffice/hvac-terminal/fan-coils/final-control-rollout"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/141/power-monitoring/byx/history/snapshots"
    }),
    true
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/140/scene/device-command"
    }),
    false
  );
  assert.equal(
    isAllowedReadOnlyV1Write({
      method: "POST",
      path: "/sites/140/energy-parameters"
    }),
    false
  );
});

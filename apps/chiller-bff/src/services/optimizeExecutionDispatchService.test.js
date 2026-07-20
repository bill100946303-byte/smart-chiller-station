import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTowerApproachLegacyControlRequests,
  dispatchTowerApproachExecution,
  resolveTowerApproachDispatchConfig
} from "./optimizeExecutionDispatchService.js";

function buildTowerExecution(overrides = {}) {
  return {
    executionId: "opx-140-test",
    execution: {
      type: "tower-approach",
      targetApproachC: 2.1,
      targetTcwsC: 29.14,
      rollbackTarget: {
        mode: "current",
        targetApproachC: 2.6,
        targetTcwsC: 29.64
      },
      ...overrides
    }
  };
}

function buildSiteConfig(controlTargets) {
  return {
    legacyBaseUrl: "http://legacy.example",
    siteSourceConfig: {
      legacyAppId: "140",
      databaseKey: "140btwentyfive",
      modelKey: "126lnoffice",
      template: "1"
    },
    towerApproach: {
      dispatch: {
        mode: "enforced"
      },
      controlTargets
    }
  };
}

function buildControlTargets() {
  return {
    approve: {
      endpoint: "/zsqy/qstag/{siteId}/doimplements",
      strategy: "device-reg-command",
      requiredContext: ["userId", "appId", "drTypeId", "drId", "tagName"],
      commandTemplate: "{deviceName}|{targetTcwsC}|{tagName}",
      commands: [
        {
          drTypeId: "tower-setpoint",
          drId: "ct-01",
          drName: "冷却塔出水设定",
          tagName: "TCWS_SP",
          valueSource: "targetTcwsC",
          valueTransform: "round1"
        }
      ]
    },
    rollback: {
      endpoint: "/zsqy/qstag/{siteId}/doimplements",
      strategy: "device-reg-command",
      requiredContext: ["userId", "appId", "drTypeId", "drId", "tagName"],
      commandTemplate: "{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}",
      commands: [
        {
          drTypeId: "tower-setpoint",
          drId: "ct-01",
          drName: "冷却塔出水设定",
          tagName: "TCWS_SP",
          valueSource: "rollbackTarget.targetTcwsC",
          valueTransform: "round1"
        }
      ]
    }
  };
}

test("buildTowerApproachLegacyControlRequests maps B25 targetTcwsC to legacy doimplements query", () => {
  const plan = buildTowerApproachLegacyControlRequests({
    siteId: "140",
    siteConfig: buildSiteConfig(buildControlTargets()),
    execution: buildTowerExecution(),
    operation: "dispatch"
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.requests.length, 1);
  const request = plan.requests[0];
  const url = new URL(request.endpoint);

  assert.equal(url.pathname, "/zsqy/qstag/140btwentyfive/doimplements");
  assert.equal(url.searchParams.get("userId"), "150");
  assert.equal(url.searchParams.get("appId"), "140");
  assert.equal(url.searchParams.get("drTypeId"), "tower-setpoint");
  assert.equal(url.searchParams.get("drId"), "ct-01");
  assert.equal(url.searchParams.get("modelKey"), "140btwentyfive");
  assert.equal(url.searchParams.get("msg"), "冷却塔出水设定|29.1|TCWS_SP");
});

test("buildTowerApproachLegacyControlRequests maps rollbackTarget to legacy doimplements query", () => {
  const plan = buildTowerApproachLegacyControlRequests({
    siteId: "140",
    siteConfig: buildSiteConfig(buildControlTargets()),
    execution: buildTowerExecution(),
    operation: "rollback"
  });

  assert.equal(plan.ok, true);
  const url = new URL(plan.requests[0].endpoint);
  assert.equal(url.searchParams.get("msg"), "冷却塔出水设定|29.6|TCWS_SP");
});

test("resolveTowerApproachDispatchConfig reads control target endpoints", () => {
  const dispatchConfig = resolveTowerApproachDispatchConfig(buildSiteConfig(buildControlTargets()));

  assert.equal(dispatchConfig.mode, "enforced");
  assert.equal(dispatchConfig.approveEndpoint, "/zsqy/qstag/{siteId}/doimplements");
  assert.equal(dispatchConfig.rollbackEndpoint, "/zsqy/qstag/{siteId}/doimplements");
});

test("dispatchTowerApproachExecution sends legacy doimplements commands as GET requests", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return String(name).toLowerCase() === "content-type" ? "application/json" : null;
        }
      },
      async text() {
        return JSON.stringify({ ok: true });
      }
    };
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const receipt = await dispatchTowerApproachExecution({
    siteId: "140",
    siteConfig: buildSiteConfig(buildControlTargets()),
    execution: buildTowerExecution(),
    operation: "dispatch",
    actorUserId: "site-admin-b25",
    requestId: "req-dispatch"
  });

  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.code, "DISPATCH_OK");
  assert.equal(receipt.response.legacyDoimplements, true);
  assert.equal(receipt.response.commandCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.ok(calls[0].url.includes("/zsqy/qstag/140btwentyfive/doimplements?"));
  assert.ok(calls[0].url.includes("msg=%E5%86%B7%E5%8D%B4%E5%A1%94%E5%87%BA%E6%B0%B4%E8%AE%BE%E5%AE%9A%7C29.1%7CTCWS_SP"));
});

test("dispatchTowerApproachExecution blocks legacy doimplements when control mapping is missing", async () => {
  const receipt = await dispatchTowerApproachExecution({
    siteId: "140",
    siteConfig: {
      legacyBaseUrl: "http://legacy.example",
      siteSourceConfig: {
        legacyAppId: "140",
        databaseKey: "140btwentyfive"
      },
      towerApproach: {
        dispatch: {
          mode: "enforced",
          approveEndpoint: "/zsqy/qstag/{siteId}/doimplements"
        }
      }
    },
    execution: buildTowerExecution(),
    operation: "dispatch"
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.code, "DISPATCH_CONTROL_MAPPING_INCOMPLETE");
  assert.ok(receipt.response.blockers.includes("approve 映射缺失"));
});

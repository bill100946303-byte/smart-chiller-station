import test from "node:test";
import assert from "node:assert/strict";

import { dispatchFcuControlCycle } from "./fcuControlService.js";
import { submitSceneDeviceCommand } from "./sceneControlService.js";

const config = {
  legacyBaseUrl: "http://127.0.0.1:8098"
};

const command = {
  drId: "47",
  drTypeId: "9",
  regName: "频率给定",
  value: "35",
  tagName: "CWP1-1-509-42007"
};

test("submitSceneDeviceCommand blocks every B25 site alias before upstream execution", async () => {
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];
  globalThis.fetch = async (input) => {
    upstreamRequests.push(String(input));
    throw new Error("B25 service guard must block before upstream fetch");
  };

  try {
    for (const siteId of ["140", "B25", "140-b25", "btwentyfive", "140_btwentyfive"]) {
      const result = await submitSceneDeviceCommand(config, siteId, command);

      assert.equal(result.ok, false, siteId);
      assert.equal(result.code, "B25_READ_ONLY_SCOPE", siteId);
      assert.equal(result.status, 403, siteId);
      assert.equal(result.controlMutation, false, siteId);
      assert.equal(result.dispatch, false, siteId);
      assert.equal(result.sourceStatus.overall, "failed", siteId);
      assert.equal(result.sourceStatus.sources[0].reasonCode, "B25_READ_ONLY_SCOPE", siteId);
    }

    assert.deepEqual(upstreamRequests, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submitSceneDeviceCommand blocks B25 aliases carried by service identity options", async () => {
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];
  globalThis.fetch = async (input) => {
    upstreamRequests.push(String(input));
    throw new Error("B25 service guard must block before upstream fetch");
  };

  const cases = [
    { siteId: "B25" },
    { siteCode: "140B25" },
    { appId: 140 },
    { projectKey: "btwentyfive" },
    { projectKeyCandidates: ["126lnoffice", "140-btwentyfive"] },
    { databaseKey: "140btwentyfive" },
    { databaseKeyCandidates: ["126lnoffice", "b-25"] },
    { preferredProjectKey: "140" },
    { modelKey: "140_b25" }
  ];

  try {
    for (const options of cases) {
      const result = await submitSceneDeviceCommand(config, "126", command, options);
      assert.equal(result.ok, false, JSON.stringify(options));
      assert.equal(result.code, "B25_READ_ONLY_SCOPE", JSON.stringify(options));
      assert.equal(result.controlMutation, false, JSON.stringify(options));
      assert.equal(result.dispatch, false, JSON.stringify(options));
    }

    assert.deepEqual(upstreamRequests, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("B25 service rejection makes an otherwise armed FCU dispatch fail without upstream mutation", async () => {
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];
  globalThis.fetch = async (input) => {
    upstreamRequests.push(String(input));
    throw new Error("B25 FCU dispatch must not reach upstream fetch");
  };

  const cycle = {
    policy: {
      defaultMode: "enforced",
      dispatchAdapter: "legacy-scene-command"
    },
    summary: {
      controlMutation: false
    },
    decisions: [{
      status: "ready",
      deviceId: "47",
      drTypeId: "9",
      deviceCode: "FCU-01",
      deviceName: "1#风机盘管",
      commands: [{
        pointName: "设置温度",
        tagName: "FCU-01-SETPOINT",
        value: "24",
        commandType: "setpoint"
      }]
    }]
  };

  try {
    const dispatched = await dispatchFcuControlCycle(cycle, {
      readOnlyMode: false,
      dispatchCommand: (request) => submitSceneDeviceCommand(config, "126", request, {
        appId: "126",
        projectKey: "140btwentyfive"
      })
    });

    assert.equal(dispatched.decisions[0].status, "dispatch_failed");
    assert.equal(dispatched.decisions[0].dispatch.status, "failed");
    assert.equal(dispatched.decisions[0].dispatch.controlMutation, false);
    assert.equal(dispatched.summary.dispatchFailedCount, 1);
    assert.equal(dispatched.summary.controlMutation, false);
    assert.deepEqual(upstreamRequests, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submitSceneDeviceCommand does not treat a non-identity userId 140 as B25 scope", async () => {
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];
  globalThis.fetch = async (input) => {
    upstreamRequests.push(String(input));
    return new Response(JSON.stringify({ code: 200, msg: "OK", data: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const result = await submitSceneDeviceCommand(config, "126", command, {
      userId: "140",
      appId: "126",
      projectKey: "126lnoffice",
      databaseKey: "126lnoffice"
    });

    assert.equal(result.ok, true);
    assert.equal(result.code, undefined);
    assert.equal(upstreamRequests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

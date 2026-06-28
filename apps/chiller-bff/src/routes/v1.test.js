import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";

import {
  buildV1Router,
  readDashboardRequestContext,
  readDeviceIdsQuery,
  readProjectDataRequestContext,
  readRealtimeRequestContext
} from "./v1.js";

function buildRequest(options = {}) {
  const headers = options.headers || {};
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );
  return {
    params: {
      siteId: options.siteId || "btwentyfive"
    },
    query: options.query ?? {},
    body: options.body ?? null,
    siteRuntimeConfig: options.siteRuntimeConfig ?? null,
    get(name) {
      return normalizedHeaders.get(String(name).toLowerCase());
    }
  };
}

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function buildActiveAuthorizationWindow() {
  const now = Date.now();
  return {
    siteAuthorizationWindowStart: new Date(now - 60 * 60 * 1000).toISOString(),
    siteAuthorizationWindowEnd: new Date(now + 60 * 60 * 1000).toISOString()
  };
}

function writeFcuFinalControlGatesReport(outputDir, overrides = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    gateCount: 8,
    passed: 8,
    blocked: 0,
    canaryReady: true,
    ...(overrides.summary || {})
  };
  fs.writeFileSync(
    path.join(outputDir, "fcu-final-control-gates-latest.json"),
    JSON.stringify(
      {
        ok: true,
        summary,
        controlMutation: false,
        ...overrides
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outputDir, "fcu-final-control-evidence-consistency-latest.json"),
    JSON.stringify(
      {
        ok: true,
        verdict: "evidence_consistent",
        summary: {
          issueCount: 0,
          staleSignoffRows: 0,
          signoffCompleteRows: summary.signoffCompleteRows ?? 1,
          signoffExpectedRows: summary.signoffExpectedRows ?? 1,
          openP0Devices: 0,
          finalGatePassed: true,
          canaryReady: true
        },
        issues: [],
        controlMutation: false,
        dispatch: false
      },
      null,
      2
    )
  );
}

test("readRealtimeRequestContext keeps explicit header project key and ignores runtime remap keys", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "btwentyfive"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice",
        databaseKey: "140观澜B25",
        template: "1"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["btwentyfive"]);
  assert.equal(context.template, "");
});

test("readRealtimeRequestContext preserves explicit header project key when it differs from route siteId", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "custom-project-key"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice",
        databaseKey: "140观澜B25"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "custom-project-key");
  assert.deepEqual(context.projectKeyCandidates, ["custom-project-key", "btwentyfive"]);
});

test("readRealtimeRequestContext falls back to route siteId when header and body project keys are missing", () => {
  const request = buildRequest({
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["btwentyfive"]);
});

test("readRealtimeRequestContext uses body project key and template when headers are absent", () => {
  const request = buildRequest({
    body: {
      context: {
        projectKey: "140btwentyfive",
        template: "1"
      }
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readProjectDataRequestContext prefers runtime device data project key for model-key aliases", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "126lnoffice"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readProjectDataRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readProjectDataRequestContext falls back to runtime device data project key when headers are absent", () => {
  const request = buildRequest({
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readProjectDataRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readProjectDataRequestContext normalizes B25 display aliases to runtime data key", () => {
  const request = buildRequest({
    siteId: "140",
    headers: {
      "x-chiller-site-id": "140",
      "x-chiller-site-code": "B25",
      "x-chiller-project-database-key": "140B25",
      "x-chiller-project-key": "140-B25",
      "x-chiller-project-template": "1"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readProjectDataRequestContext(request);

  assert.equal(context.databaseKey, "140btwentyfive");
  assert.deepEqual(context.databaseKeyCandidates, ["140btwentyfive", "126lnoffice", "140B25", "140"]);
  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "140-B25", "140"]);
  assert.equal(context.template, "1");
});

test("energy-efficiency imbalance route uses B25 data key for table endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-06-11&dateType=0&energyType=4&startTime=2026-06-10&endTime=2026-06-11") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        data: {
          title: "热平衡",
          curveValueList: {
            curveValueList: [
              { name: "2026-06-10 00:10", value: "1.2" }
            ]
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-06-11&dateType=0&energyType=4&startTime=2026-06-10&endTime=2026-06-11") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        data: {
          dataStatisticsList: {
            acquisitionValue: "采样总数",
            scalar: "10",
            noScalar: "2",
            scalarRate: "80"
          },
          tableList: {
            drName: "1#冷水机组",
            drTypeName: "主机",
            scalarRate: "2.8"
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  const app = express();
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "140",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6
  }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/140/energy-efficiency/imbalance?startDate=2026-06-10&endDate=2026-06-11`,
      {
        headers: {
          "x-chiller-site-id": "140",
          "x-chiller-site-code": "B25",
          "x-chiller-project-database-key": "140B25",
          "x-chiller-project-key": "140-B25",
          "x-chiller-project-template": "1"
        }
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.sourceStatus.overall, "ok");
    assert.equal(payload.series.length, 1);
    assert.equal(payload.statisticsRows.length, 1);
    assert.equal(payload.deviceRows.length, 1);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-06-11&dateType=0&energyType=4&startTime=2026-06-10&endTime=2026-06-11",
      "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-06-11&dateType=0&energyType=4&startTime=2026-06-10&endTime=2026-06-11"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("runtime summary route exposes B25 realtime point counts and frequency feedback", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (input) => {
    const target = String(input);
    requests.push(target);

    if (target.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          { drid: "1", drname: "1#冷水机组", drtypename: "主机", drcode: "CH1" },
          { drid: "2", drname: "2#冷水机组", drtypename: "主机", drcode: "CH2" },
          { drid: "47", drname: "1#冷却泵", drtypename: "冷却泵", drcode: "CWP1" },
          { drid: "48", drname: "2#冷却泵", drtypename: "冷却泵", drcode: "CWP2" }
        ]
      });
    }

    if (target.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({
        data: [
          {
            drid: "1",
            drname: "1#冷水机组",
            drtypename: "主机",
            drcode: "CH1",
            reglist: [
              { regName: "运行", tagValue: "0" },
              { regName: "功率", tagValue: "0" }
            ]
          },
          {
            drid: "2",
            drname: "2#冷水机组",
            drtypename: "主机",
            drcode: "CH2",
            reglist: [
              { regName: "运行", tagValue: "1" },
              { regName: "功率", tagValue: "456" }
            ]
          },
          {
            drid: "47",
            drname: "1#冷却泵",
            drtypename: "冷却泵",
            drcode: "CWP1",
            reglist: [
              { regName: "运行", tagValue: "0" },
              { regName: "频率反馈", tagValue: "0" }
            ]
          },
          {
            drid: "48",
            drname: "2#冷却泵",
            drtypename: "冷却泵",
            drcode: "CWP2",
            reglist: [
              { regName: "运行", tagValue: "1" },
              { regName: "频率反馈", tagValue: "33.2" }
            ]
          },
          {
            drid: "53",
            drname: "1#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT1",
            reglist: [
              { regName: "功率", tagValue: "5.1" },
              { regName: "运行", tagValue: "1" },
              { regName: "频率反馈", tagValue: "31.4" }
            ]
          },
          {
            drid: "900",
            drname: "室外环境",
            drtypename: "环境",
            drcode: "RHT",
            reglist: [
              { regName: "湿球温度", tagValue: "25.4" }
            ]
          }
        ]
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  const app = express();
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "140",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6
  }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/140/runtime/summary`,
      {
        headers: {
          "x-chiller-site-id": "140",
          "x-chiller-site-code": "B25",
          "x-chiller-project-key": "140-B25"
        }
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ready");
    assert.equal(payload.sourceStatus.overall, "ok");
    assert.equal(payload.counts.chillerCount, 2);
    assert.equal(payload.counts.runningChillerCount, 1);
    assert.equal(payload.counts.coolingPumpCount, 2);
    assert.equal(payload.counts.runningCoolingPumpCount, 1);
    assert.equal(payload.keySignals.pumpFrequency.coolingAvgHz, 33.2);
    assert.equal(payload.keySignals.weather.wetBulbC, 25.4);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200",
      "http://127.0.0.1:8098/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("readProjectDataRequestContext preserves explicit custom header project key", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "custom-project-key"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readProjectDataRequestContext(request);

  assert.equal(context.projectKey, "custom-project-key");
  assert.deepEqual(context.projectKeyCandidates, ["custom-project-key", "btwentyfive"]);
  assert.equal(context.template, "");
});

test("readDashboardRequestContext prefers runtime databaseKey when request only carries route site id", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "btwentyfive"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readDashboardRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readDashboardRequestContext normalizes runtime alias keys to databaseKey for dashboard routes", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "126lnoffice"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readDashboardRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readDashboardRequestContext falls back to runtime databaseKey when headers are absent", () => {
  const request = buildRequest({
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readDashboardRequestContext(request);

  assert.equal(context.projectKey, "140btwentyfive");
  assert.deepEqual(context.projectKeyCandidates, ["140btwentyfive", "126lnoffice", "btwentyfive"]);
  assert.equal(context.template, "1");
});

test("readDashboardRequestContext preserves explicit custom header project key when it differs from route and runtime defaults", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "custom-project-key"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        preferredProjectKey: "126lnoffice",
        modelKey: "126lnoffice",
        databaseKey: "140btwentyfive",
        deviceDataProjectKey: "140btwentyfive",
        template: "1"
      }
    }
  });

  const context = readDashboardRequestContext(request);

  assert.equal(context.projectKey, "custom-project-key");
  assert.deepEqual(context.projectKeyCandidates, ["custom-project-key", "btwentyfive"]);
  assert.equal(context.template, "");
});

test("readDeviceIdsQuery splits comma separated ids and dedupes empty values", () => {
  const request = buildRequest({
    query: {
      ids: "53,54,53,,58"
    }
  });

  const result = readDeviceIdsQuery(request);

  assert.deepEqual(result, ["53", "54", "58"]);
});

test("readDeviceIdsQuery flattens repeated ids query entries", () => {
  const request = buildRequest({
    query: {
      ids: ["53,54", "58", "54"]
    }
  });

  const result = readDeviceIdsQuery(request);

  assert.deepEqual(result, ["53", "54", "58"]);
});

test("config center runtime routes resolve office numeric alias for FCU terminal pages", async () => {
  const requestedSiteIds = [];
  const adminStore = {
    getSiteCapabilities(siteId) {
      requestedSiteIds.push(`capabilities:${siteId}`);
      return {
        siteId,
        generatedAt: "2026-06-18T00:00:00.000Z",
        items: [
          {
            siteId,
            subsystemType: "hvac_terminal",
            displayName: "空调末端",
            status: "enabled",
            published: true,
            controlBoundary: {
              mode: "enforced",
              writeEnabled: true
            }
          }
        ],
        total: 1
      };
    },
    listSiteSubsystems(siteId) {
      requestedSiteIds.push(`subsystems:${siteId}`);
      return {
        siteId,
        generatedAt: "2026-06-18T00:00:00.000Z",
        items: [
          {
            siteId,
            subsystemType: "hvac_terminal",
            displayName: "空调末端",
            status: "enabled",
            published: true
          }
        ],
        total: 1
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true
  }, { adminStore }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const capabilitiesResponse = await fetch(`http://127.0.0.1:${port}/bff/v1/sites/126/capabilities`);
    const capabilitiesPayload = await capabilitiesResponse.json();
    const subsystemsResponse = await fetch(`http://127.0.0.1:${port}/bff/v1/sites/126/subsystems`);
    const subsystemsPayload = await subsystemsResponse.json();

    assert.equal(capabilitiesResponse.status, 200);
    assert.equal(subsystemsResponse.status, 200);
    assert.deepEqual(requestedSiteIds, ["capabilities:126lnoffice", "subsystems:126lnoffice"]);
    assert.equal(capabilitiesPayload.site.siteId, "126lnoffice");
    assert.equal(capabilitiesPayload.items[0]?.subsystemType, "hvac_terminal");
    assert.equal(capabilitiesPayload.items[0]?.status, "enabled");
    assert.equal(subsystemsPayload.site.siteId, "126lnoffice");
    assert.equal(subsystemsPayload.items[0]?.subsystemType, "hvac_terminal");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU control cycle previews without BA write and dispatches only after explicit confirmation", async () => {
  const originalFetch = globalThis.fetch;
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-control-dispatch-gate-test-"));
  writeFcuFinalControlGatesReport(outputDir);
  const commandRequests = [];
  let setpointFeedbackValue = "25";
  let hvacWriteEnabled = true;

  globalThis.fetch = async (input) => {
    const target = String(input);

    if (target.includes("/zsqy/drinfo/126lnoffice/findObject?")) {
      return createJsonResponse({
        data: [
          {
            drid: "1001",
            drname: "办公室01-BGS01",
            drtypename: "风机盘管",
            drcode: "BGS01",
            drtypeid: "2001"
          },
          {
            drid: "1002",
            drname: "办公室02-BGS02",
            drtypename: "风机盘管",
            drcode: "BGS02",
            drtypeid: "2001"
          }
        ]
      });
    }

    if (target.includes("/zsqy/reg/126lnoffice/findAllByDrTypeId?")) {
      return createJsonResponse({
        data: [
          {
            drid: "1001",
            drname: "办公室01-BGS01",
            drtypename: "风机盘管",
            drcode: "BGS01",
            drtypeid: "2001",
            reglist: [
              { regName: "运行", tagValue: "1", regReadWrite: "1" },
              { regName: "通讯报警", tagValue: "0", regReadWrite: "1" },
              { regName: "内置温度", tagValue: "27.5", regReadWrite: "1" },
              { regName: "设置温度反馈", tagValue: setpointFeedbackValue, regReadWrite: "1" },
              { regName: "设置温度", tagValue: "25", regReadWrite: "2", tagName: "TAG_SETPOINT" },
              { regName: "风速模式", tagValue: "0", regReadWrite: "2", tagName: "TAG_FAN_SPEED" },
              { regName: "手动启动", tagValue: "0", regReadWrite: "2", tagName: "TAG_START" },
              { regName: "手动停止", tagValue: "0", regReadWrite: "2", tagName: "TAG_STOP" },
              { regName: "阀门状态", tagValue: "1", regReadWrite: "1" }
            ]
          },
          {
            drid: "1002",
            drname: "办公室02-BGS02",
            drtypename: "风机盘管",
            drcode: "BGS02",
            drtypeid: "2001",
            reglist: [
              { regName: "运行", tagValue: "1", regReadWrite: "1" },
              { regName: "通讯报警", tagValue: "0", regReadWrite: "1" },
              { regName: "内置温度", tagValue: "28.2", regReadWrite: "1" },
              { regName: "设置温度反馈", tagValue: setpointFeedbackValue, regReadWrite: "1" },
              { regName: "设置温度", tagValue: "25", regReadWrite: "2", tagName: "TAG_SETPOINT_BGS02" },
              { regName: "风速模式", tagValue: "0", regReadWrite: "2", tagName: "TAG_FAN_SPEED_BGS02" },
              { regName: "手动启动", tagValue: "0", regReadWrite: "2", tagName: "TAG_START_BGS02" },
              { regName: "手动停止", tagValue: "0", regReadWrite: "2", tagName: "TAG_STOP_BGS02" },
              { regName: "阀门状态", tagValue: "1", regReadWrite: "1" }
            ]
          }
        ]
      });
    }

    if (target.includes("/zsqy/qstag/126lnoffice/doimplements?")) {
      commandRequests.push(target);
      return createJsonResponse({
        status: "20000",
        msg: "OK"
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  const records = [];
  const adminStore = {
    getFcuControlPolicy() {
      return {
        policy: {
          enabled: true,
          defaultMode: "enforced",
          targetLowC: 24.5,
          targetHighC: 26.5,
          minSetpointC: 22,
          maxSetpointC: 28,
          setpointStepC: 0.5,
          setpointDwellMinutes: 15,
          startStopDwellMinutes: 30,
          dailyMaxSetpointShiftC: 2,
          validTempMinC: 5,
          validTempMaxC: 45,
          feedbackTimeoutSeconds: 120,
          rollbackLockoutMinutes: 60,
          allowStartStop: true,
          allowSetpoint: true,
          allowFanSpeed: true,
          occupied: true,
          dispatchAdapter: "legacy-scene-command",
          fieldAuthorization: {
            siteAuthorizationStatus: "approved",
            siteAuthorizationBy: "业主值班长",
            ...buildActiveAuthorizationWindow(),
            baWriteConfirmArmed: true,
            finalRolloutConfirmArmed: true,
            commissioningOwner: "平台工程师",
            baOwner: "BA工程师"
          },
          whitelist: ["BGS01", "BGS02"],
          deviceOverrides: {}
        }
      };
    },
    getSiteCapabilities() {
      return {
        items: [
          {
            subsystemType: "hvac_terminal",
            status: "enabled",
            sourceStatus: "ok",
            controlBoundary: {
              mode: "enforced",
              writeEnabled: hvacWriteEnabled
            }
          }
        ]
      };
    },
    listFcuControlRecords() {
      return {
        items: records
      };
    },
    createFcuControlRecord(_siteId, decision) {
      const record = {
        ...decision,
        recordId: `rec-${records.length + 1}`
      };
      records.unshift(record);
      return record;
    },
    getFcuControlRecord(_siteId, recordId) {
      return records.find((record) => record.recordId === recordId) || null;
    },
    verifyFcuControlRecordFeedback(_siteId, recordId, verification) {
      const index = records.findIndex((record) => record.recordId === recordId);
      if (index < 0) {
        return null;
      }
      records[index] = {
        ...records[index],
        ...verification
      };
      return records[index];
    }
  };

  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: false,
    fcuFinalControlOutputDir: outputDir
  }, { adminStore }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const commissioningResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/commissioning-status?build=1&floor=1&deviceCode=BGS02`,
      {
        headers: {
          "x-chiller-project-key": "126lnoffice"
        }
      }
    );
    const commissioningPayload = await commissioningResponse.json();
    assert.equal(commissioningResponse.status, 200);
    assert.equal(commissioningPayload.targetDeviceCode, "BGS02");
    assert.equal(commissioningPayload.commissioningStatus.device.deviceCode, "BGS02");
    assert.equal(commissioningPayload.commissioningStatus.deviceReady, true);
    assert.equal(commissioningPayload.commissioningStatus.canDispatch, true);
    assert.equal(commissioningPayload.commissioningStatus.conditions.find((item) => item.key === "setpoint_writable")?.ok, true);
    assert.equal(commissioningPayload.commissioningStatus.finalGate.deviceCode, "BGS02");
    assert.equal(commissioningPayload.commissioningStatus.finalGate.controlMutation, false);
    assert.equal(commissioningPayload.commissioningStatus.finalGate.items.some((item) => item.key === "device_readiness" && item.ok === true), true);
    assert.equal(commissioningPayload.commissioningStatus.finalGate.items.some((item) => item.key === "canary_sequence"), true);
    assert.equal(commissioningPayload.commissioningStatus.finalGate.items.some((item) => item.key === "device_feedback" && item.ok === false), true);

    const aliasDeviceCommissioningResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/commissioning-status?build=1&floor=1&device=BGS02`,
      {
        headers: {
          "x-chiller-project-key": "126lnoffice"
        }
      }
    );
    const aliasDeviceCommissioningPayload = await aliasDeviceCommissioningResponse.json();
    assert.equal(aliasDeviceCommissioningResponse.status, 200);
    assert.equal(aliasDeviceCommissioningPayload.targetDeviceCode, "BGS02");
    assert.equal(aliasDeviceCommissioningPayload.commissioningStatus.device.deviceCode, "BGS02");
    assert.equal(aliasDeviceCommissioningPayload.commissioningStatus.finalGate.deviceCode, "BGS02");

    for (const deviceCode of ["BGS01", "BGS02"]) {
      const preflightResponse = await originalFetch(
        `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-preflight?build=1&floor=1&deviceCode=${deviceCode}`,
        {
          headers: {
            "x-chiller-project-key": "126lnoffice"
          }
        }
      );
      const preflightPayload = await preflightResponse.json();
      assert.equal(preflightResponse.status, 200);
      assert.equal(preflightPayload.targetDeviceCode, deviceCode);
      assert.equal(preflightPayload.controlMutation, false);
      assert.equal(preflightPayload.authorizationGate.ready, true);
      assert.equal(preflightPayload.executionGate.dispatchAllowed, true);
      assert.equal(preflightPayload.fieldArmCheck.ok, true);
      assert.equal(preflightPayload.commissioningStatus.device.deviceCode, deviceCode);
      assert.equal(preflightPayload.commissioningStatus.deviceReady, true);
      assert.equal(preflightPayload.commissioningStatus.canDispatch, true);
      assert.equal(preflightPayload.commissioningStatus.finalGate.deviceCode, deviceCode);
      assert.equal(preflightPayload.verdict, "canary_ready");
      assert.equal(preflightPayload.actionPlan.some((item) => item.key === "execute_canary"), true);
      const canaryAction = preflightPayload.actionPlan.find((item) => item.key === "execute_canary");
      assert.equal(canaryAction?.owner, "平台工程师 + 现场值班");
      assert.equal(canaryAction?.writesControl, true);
      assert.match(canaryAction?.acceptance || "", /feedback_confirmed/);
    }

    const commissioningListResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/commissioning-status?build=1&floor=1`,
      {
        headers: {
          "x-chiller-project-key": "126lnoffice"
        }
      }
    );
    const commissioningListPayload = await commissioningListResponse.json();
    assert.equal(commissioningListResponse.status, 200);
    assert.equal(commissioningListPayload.targetDeviceCode, null);
    assert.equal(commissioningListPayload.summary.total, 2);
    assert.equal(commissioningListPayload.summary.deviceReady, 2);
    assert.equal(commissioningListPayload.summary.canDispatch, 2);
    assert.equal(commissioningListPayload.items.length, 2);
    assert.equal(commissioningListPayload.items.some((item) => item.device.deviceCode === "BGS01"), true);
    assert.equal(commissioningListPayload.report.verdict, "ready_for_control");
    assert.equal(commissioningListPayload.report.releaseCandidateDeviceCodes.length, 2);
    assert.equal(commissioningListPayload.report.nextActions.some((item) => item.action === "逐台小批量确认下发"), true);
    assert.equal(commissioningListPayload.items.every((item) => item.finalGate?.items?.length >= 6), true);

    const aliasCommissioningListResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126/hvac-terminal/fan-coils/commissioning-status?build=1&floor=1`,
      {
        headers: {
          "x-chiller-project-key": "126"
        }
      }
    );
    const aliasCommissioningListPayload = await aliasCommissioningListResponse.json();
    assert.equal(aliasCommissioningListResponse.status, 200);
    assert.equal(aliasCommissioningListPayload.summary.total, 2);
    assert.equal(aliasCommissioningListPayload.items.some((item) => item.device.deviceCode === "BGS01"), true);
    assert.equal(aliasCommissioningListPayload.items.some((item) => item.device.deviceCode === "BGS02"), true);

    const fieldArmResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-arm-check?build=1&floor=1`,
      {
        headers: {
          "x-chiller-project-key": "126lnoffice"
        }
      }
    );
    const fieldArmPayload = await fieldArmResponse.json();
    assert.equal(fieldArmResponse.status, 200);
    assert.equal(fieldArmPayload.ok, true);
    assert.equal(fieldArmPayload.verdict, "field_arm_ready");
    assert.equal(fieldArmPayload.firstCanary, "BGS01");
    assert.equal(fieldArmPayload.policy.whitelistCount, 2);
    assert.equal(fieldArmPayload.commissioningSummary.total, 2);
    assert.equal(fieldArmPayload.commissioningSummary.deviceReady, 2);
    assert.equal(fieldArmPayload.commissioningSummary.canDispatch, 2);
    assert.equal(fieldArmPayload.checks.find((item) => item.key === "execution_gate_open")?.ok, true);
    assert.equal(fieldArmPayload.nextActions.some((item) => item.action === "执行 Canary 首台真实下发"), true);
    assert.equal(fieldArmPayload.nextActions.some((item) => item.action === "反馈校验与失败回退"), true);

    const response = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-cycle?build=1&floor=1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: "{}"
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.dispatchRequested, false);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.summary.controlMutation, false);
    assert.equal(payload.summary.readyCount, 2);
    assert.equal(payload.persisted.inserted, 2);
    assert.equal(records[0]?.dryRun, true);
    assert.equal(commandRequests.length, 0);

    const broadDispatchResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-cycle?build=1&floor=1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({ dispatch: true })
      }
    );
    const broadDispatchPayload = await broadDispatchResponse.json();
    assert.equal(broadDispatchResponse.status, 409);
    assert.equal(broadDispatchPayload.code, "SINGLE_DEVICE_REQUIRED");
    assert.equal(broadDispatchPayload.dispatchAllowed, false);
    assert.equal(broadDispatchPayload.controlMutation, false);
    assert.equal(commandRequests.length, 0);

    const dispatchResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-cycle?build=1&floor=1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({ dispatch: true, deviceCode: "BGS02" })
      }
    );
    const dispatchPayload = await dispatchResponse.json();

    assert.equal(dispatchResponse.status, 201);
    assert.equal(dispatchPayload.dispatchRequested, true);
    assert.equal(dispatchPayload.dispatchAllowed, true);
    assert.equal(dispatchPayload.executionGate.dispatchAllowed, true);
    assert.equal(dispatchPayload.targetDeviceCode, "BGS02");
    assert.equal(dispatchPayload.controlMutation, true);
    assert.equal(dispatchPayload.summary.controlMutation, true);
    assert.equal(dispatchPayload.summary.dispatchedCount, 1);
    assert.equal(dispatchPayload.summary.total, 1);
    assert.equal(records[0]?.deviceCode, "BGS02");
    assert.equal(records[0]?.dryRun, false);
    const bgs02DispatchRecordId = records[0]?.recordId;
    assert.equal(commandRequests.length, 2);
    assert.match(decodeURIComponent(commandRequests.join("\n")), /设置温度\|24\.5\|TAG_SETPOINT_BGS02/);
    assert.match(decodeURIComponent(commandRequests.join("\n")), /风速模式\|auto\|TAG_FAN_SPEED_BGS02/);
    assert.doesNotMatch(decodeURIComponent(commandRequests.join("\n")), /TAG_SETPOINT(?!_BGS02)|TAG_FAN_SPEED(?!_BGS02)/);

    const manualPreviewResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-command?build=1&floor=1&deviceCode=BGS01`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({
          dispatch: false,
          command: {
            setpointC: 24
          }
        })
      }
    );
    const manualPreviewPayload = await manualPreviewResponse.json();
    assert.equal(manualPreviewResponse.status, 201);
    assert.equal(manualPreviewPayload.commandMode, "manual");
    assert.equal(manualPreviewPayload.dispatchRequested, false);
    assert.equal(manualPreviewPayload.summary.readyCount, 1);
    assert.equal(manualPreviewPayload.summary.controlMutation, false);
    assert.equal(records[0]?.deviceCode, "BGS01");
    assert.equal(records[0]?.dryRun, true);
    assert.equal(commandRequests.length, 2);

    const manualDispatchResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-command?build=1&floor=1&deviceCode=BGS01`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({
          dispatch: true,
          command: {
            fanSpeed: "high"
          }
        })
      }
    );
    const manualDispatchPayload = await manualDispatchResponse.json();
    assert.equal(manualDispatchResponse.status, 201);
    assert.equal(manualDispatchPayload.dispatchRequested, true);
    assert.equal(manualDispatchPayload.dispatchAllowed, true);
    assert.equal(manualDispatchPayload.executionGate.conditions.find((item) => item.key === "subsystem_write_enabled")?.ok, true);
    assert.equal(manualDispatchPayload.targetDeviceCode, "BGS01");
    assert.equal(manualDispatchPayload.summary.dispatchedCount, 1);
    assert.equal(records[0]?.deviceCode, "BGS01");
    assert.equal(records[0]?.dryRun, false);
    assert.equal(commandRequests.length, 3);
    assert.match(decodeURIComponent(commandRequests[2]), /风速模式\|high\|TAG_FAN_SPEED/);

    writeFcuFinalControlGatesReport(outputDir, {
      ok: false,
      summary: {
        gateCount: 8,
        passed: 0,
        blocked: 8,
        canaryReady: false
      }
    });
    const blockedByFinalGateResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-command?build=1&floor=1&deviceCode=BGS01`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({
          dispatch: true,
          command: {
            fanSpeed: "medium"
          }
        })
      }
    );
    const blockedByFinalGatePayload = await blockedByFinalGateResponse.json();
    assert.equal(blockedByFinalGateResponse.status, 201);
    assert.equal(blockedByFinalGatePayload.dispatchRequested, true);
    assert.equal(blockedByFinalGatePayload.dispatchAllowed, false);
    assert.equal(blockedByFinalGatePayload.finalDispatchGate.dispatchAllowed, false);
    assert.equal(blockedByFinalGatePayload.finalDispatchGate.blockedReasons.includes("final_control_gates_passed"), true);
    assert.equal(blockedByFinalGatePayload.controlMutation, false);
    assert.equal(records[0]?.dryRun, true);
    assert.equal(commandRequests.length, 3);
    writeFcuFinalControlGatesReport(outputDir);

    hvacWriteEnabled = false;
    const blockedByBoundaryResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-command?build=1&floor=1&deviceCode=BGS02`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: JSON.stringify({
          dispatch: true,
          command: {
            fanSpeed: "low"
          }
        })
      }
    );
    const blockedByBoundaryPayload = await blockedByBoundaryResponse.json();
    assert.equal(blockedByBoundaryResponse.status, 201);
    assert.equal(blockedByBoundaryPayload.dispatchRequested, true);
    assert.equal(blockedByBoundaryPayload.dispatchAllowed, false);
    assert.equal(blockedByBoundaryPayload.executionGate.blockedReasons.includes("subsystem_write_enabled"), true);
    assert.equal(blockedByBoundaryPayload.controlMutation, false);
    assert.equal(records[0]?.dryRun, true);
    assert.equal(commandRequests.length, 3);

    const blockedFieldArmResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-arm-check?build=1&floor=1`,
      {
        headers: {
          "x-chiller-project-key": "126lnoffice"
        }
      }
    );
    const blockedFieldArmPayload = await blockedFieldArmResponse.json();
    assert.equal(blockedFieldArmResponse.status, 200);
    assert.equal(blockedFieldArmPayload.ok, false);
    assert.equal(blockedFieldArmPayload.verdict, "field_arm_blocked");
    assert.equal(blockedFieldArmPayload.commissioningSummary.deviceReady, 2);
    assert.equal(blockedFieldArmPayload.commissioningSummary.canDispatch, 0);
    assert.equal(blockedFieldArmPayload.checks.find((item) => item.key === "execution_gate_open")?.ok, false);
    assert.equal(blockedFieldArmPayload.blockingItems.some((item) => item.key === "execution_gate_open"), true);
    assert.equal(blockedFieldArmPayload.nextActions.some((item) => item.action === "打开空调末端子系统写总闸"), true);
    assert.equal(blockedFieldArmPayload.nextActions.some((item) => item.action === "重跑 Arm-Check 后执行 Canary 首台"), true);
    hvacWriteEnabled = true;

    setpointFeedbackValue = "24.5";
    const verifyResponse = await originalFetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-records/${encodeURIComponent(bgs02DispatchRecordId)}/verify-feedback?build=1&floor=1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chiller-project-key": "126lnoffice"
        },
        body: "{}"
      }
    );
    const verifyPayload = await verifyResponse.json();
    assert.equal(verifyResponse.status, 200);
    assert.equal(verifyPayload.record.status, "feedback_partial");
    assert.equal(verifyPayload.feedback.status, "partial");
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(outputDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU final control status endpoint exposes read-only evidence", async () => {
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/final-control-status`
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.scope, "fcu_all_device_final_control");
    assert.equal(typeof payload.finalControlGates?.ok, "boolean");
    assert.equal(payload.finalControlGates?.controlMutation, false);
    assert.equal(Array.isArray(payload.finalControlGates?.blockers), true);
    assert.equal(typeof payload.finalCompletion?.ok, "boolean");
    assert.equal(typeof payload.reportStatuses?.finalControlGates?.status, "string");
    assert.equal(typeof payload.reportStatuses?.finalCompletion?.status, "string");
    assert.equal(typeof payload.reportStatuses?.canaryExecutionPackage?.status, "string");
    assert.equal(typeof payload.reportStatuses?.baWriteAdapterReadiness?.status, "string");
    assert.equal(typeof payload.reportStatuses?.canaryFeedbackMonitor?.status, "string");
    assert.equal(typeof payload.reportStatuses?.canaryWindow?.status, "string");
    assert.equal(typeof payload.reportStatuses?.fieldArmPackage?.status, "string");
    assert.equal(typeof payload.reportStatuses?.finalRunbook?.status, "string");
    assert.equal(typeof payload.reportStatuses?.evidenceConsistency?.status, "string");
    assert.equal(typeof payload.evidenceConsistency?.ok, "boolean");
    assert.equal(payload.evidenceConsistency?.controlMutation, false);
    assert.equal(payload.evidenceConsistency?.dispatch, false);
    assert.equal(typeof payload.finalRunbook?.verdict, "string");
    assert.equal(payload.canaryExecutionPackage?.controlMutation, undefined);
    const canaryPackageDeviceCode = payload.canaryExecutionPackage?.canary?.deviceCode || "";
    const baWriteAdapterDeviceCode = payload.baWriteAdapterReadiness?.canary?.deviceCode || "";
    const feedbackMonitorDeviceCode = payload.canaryFeedbackMonitor?.canary?.deviceCode || "";
    assert.match(canaryPackageDeviceCode, /^[A-Z0-9]+$/);
    assert.equal(baWriteAdapterDeviceCode, canaryPackageDeviceCode);
    assert.match(feedbackMonitorDeviceCode, /^[A-Z0-9]+$/);
    assert.equal(payload.canaryWindow?.controlMutation, false);
    assert.match(payload.baWriteAdapterReadiness?.outputs?.csv || "", /fcu-ba-write-adapter-readiness-latest\.csv$/);
    assert.match(payload.canaryFeedbackMonitor?.outputs?.markdown || "", /fcu-canary-feedback-monitor-latest\.md$/);
    assert.match(payload.canaryExecutionPackage?.outputs?.json || "", /fcu-canary-execution-package-latest\.json$/);
    assert.match(payload.finalWorklist?.fieldPackages?.canaryExecution?.markdown || "", /fcu-canary-execution-package-latest\.md$/);
    assert.match(payload.finalWorklist?.fieldPackages?.baWriteAdapterReadiness?.json || "", /fcu-ba-write-adapter-readiness-latest\.json$/);
    assert.match(payload.finalWorklist?.fieldPackages?.canaryFeedbackMonitor?.csv || "", /fcu-canary-feedback-monitor-latest\.csv$/);
    assert.match(payload.finalWorklist?.fieldPackages?.canaryWindow?.json || "", /fcu-canary-window-latest\.json$/);
    assert.match(payload.finalWorklist?.fieldPackages?.fieldRemediationCloseout?.markdown || "", /fcu-field-remediation-closeout-latest\.md$/);
    assert.equal(typeof payload.finalWorklist?.fieldPackages?.fieldRemediationCloseout?.readyForCanary, "boolean");
    assert.match(payload.finalWorklist?.fieldPackages?.fieldHandoff?.json || "", /fcu-field-handoff-pack-latest\.json$/);
    assert.equal(typeof payload.finalWorklist?.fieldPackages?.fieldHandoff?.nextAllowedStep, "string");
    assert.match(
      payload.finalWorklist?.fieldPackages?.fieldRemediationSignoff?.releaseMatrixCsv || "",
      /fcu-field-remediation-signoff-latest-release-matrix\.csv$/
    );
    assert.equal(
      Array.isArray(payload.finalWorklist?.fieldPackages?.fieldRemediationSignoff?.releaseMatrix),
      true
    );
    assert.equal(payload.fieldArmPackage?.controlMutation, false);
    assert.equal(Array.isArray(payload.fieldArmPackage?.checklist), true);
    assert.equal(Array.isArray(payload.fieldArmPackage?.blockers), true);
    assert.equal(Array.isArray(payload.sourceStatus?.entries), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "canaryExecutionPackage"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "baWriteAdapterReadiness"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "canaryFeedbackMonitor"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "canaryWindow"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "fieldArmPackage"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "finalControlGates"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "evidenceConsistency"), true);
    assert.equal(payload.sourceStatus.entries.some((item) => item.key === "finalControlFieldExecutionPack"), true);
    assert.equal(payload.finalControlFieldExecutionPack?.controlMutation, false);
    assert.equal(payload.finalControlFieldExecutionPack?.dispatch, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU final control status refresh regenerates read-only evidence without control mutation", async () => {
  const app = express();
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-refresh-test-"));
  app.use(express.json());
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      readOnlyMode: true
    });
  });
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true,
    fcuFinalControlOutputDir: outputDir
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/final-control-status/refresh`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.refresh?.status, "completed");
    assert.equal(payload.refresh?.acceptedExitCodes?.includes(2), true);
    assert.equal(Array.isArray(payload.refresh?.scripts), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "finalCompletion"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "finalWorklist"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "fieldArmPackage"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "finalControlGates"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "finalRunbook"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "finalControlFieldExecutionPack"), true);
    assert.equal(payload.refresh.scripts.some((item) => item.key === "evidenceConsistency"), true);
    assert.equal(payload.finalControlGates?.controlMutation, false);
    assert.equal(payload.finalControlFieldExecutionPack?.controlMutation, false);
    assert.equal(payload.finalControlFieldExecutionPack?.dispatch, false);
    assert.equal(payload.finalControlFieldExecutionPack?.outputFiles?.json?.startsWith(outputDir), true);
    assert.equal(payload.evidenceConsistency?.controlMutation, false);
    assert.equal(payload.evidenceConsistency?.dispatch, false);
    assert.equal(typeof payload.finalControlGates?.summary?.gateCount, "number");
    assert.equal(payload.fieldArmPackage?.controlMutation, false);
    assert.equal(payload.sourceStatus?.entries?.some((item) => item.key === "finalControlGates"), true);
    assert.equal(payload.sourceStatus?.entries?.some((item) => item.key === "finalCompletion"), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-gates-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-gates-latest.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-completion-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-execution-pack-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-execution-pack-latest.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-worklist-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-runbook-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-field-execution-pack-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-final-control-evidence-consistency-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-canary-readiness-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-closeout-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-work-orders-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-signoff-input-latest.csv")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-signoff-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-return-template-latest.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-arm-package-latest.json")), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU canary window endpoint generates single-device package without control mutation", async () => {
  const app = express();
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-window-route-test-"));
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true,
    fcuFinalControlOutputDir: outputDir
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/canary-window?deviceCode=LZBGS`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceCode: "LZBGS" })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.deviceCode, "LZBGS");
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.canary?.deviceCode, "LZBGS");
    assert.match(payload.outputs?.json || "", /fcu-canary-window-lzbgs\.json$/);
    assert.equal(payload.outputs?.json?.startsWith(outputDir), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-canary-window-lzbgs.json")), true);
    assert.match(payload.command || "", /FCU_CANARY_DEVICE_CODE=LZBGS/);
    assert.equal(payload.sourceStatus?.entries?.some((item) => item.key === "canaryWindow"), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU field arm package endpoint generates per-device package without control mutation", async () => {
  const app = express();
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-arm-route-test-"));
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true,
    fcuFinalControlOutputDir: outputDir
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/field-arm-package?device=LZBGS`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceCode: "LZBGS" })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.deviceCode, "LZBGS");
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.fieldArmPackage?.deviceCode, "LZBGS");
    assert.equal(payload.fieldArmPackage?.controlMutation, false);
    assert.equal(Array.isArray(payload.fieldArmPackage?.checklist), true);
    assert.equal(payload.fieldArmPackage.checklist.some((item) => item.key === "canary_dispatch" && item.writesControl === true), true);
    assert.match(payload.fieldArmPackage?.outputs?.json || "", /fcu-field-arm-package-lzbgs\.json$/);
    assert.equal(payload.fieldArmPackage?.outputs?.json?.startsWith(outputDir), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-arm-package-lzbgs.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "fcu-field-remediation-return-template-latest.json")), true);
    assert.equal(payload.sourceStatus?.entries?.some((item) => item.key === "fieldArmPackage"), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU canary dispatch endpoint blocks real writes in read-only mode", async () => {
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/canary-dispatch?deviceCode=BGS01`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceCode: "BGS01",
          confirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE"
        })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "READ_ONLY_MODE");
    assert.equal(payload.deviceCode, "BGS01");
    assert.equal(payload.dispatchAllowed, false);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.blockers.some((item) => item.key === "backend_read_only"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU final control rollout endpoint blocks before script execution when gates are unsafe", async () => {
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: true
  }, {}));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/final-control-rollout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE",
          finalRolloutConfirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE"
        })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "READ_ONLY_MODE");
    assert.equal(payload.dispatchAllowed, false);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.blockers.some((item) => item.key === "backend_read_only"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU final control rollout endpoint requires both real-write confirmations", async () => {
  const adminStore = {
    getFcuControlPolicy() {
      return {
        policy: {
          enabled: true,
          defaultMode: "enforced",
          dispatchAdapter: "legacy-scene-command",
          whitelist: ["BGS01"],
          fieldAuthorization: {
            siteAuthorizationStatus: "approved",
            siteAuthorizationBy: "业主值班长",
            ...buildActiveAuthorizationWindow(),
            baWriteConfirmArmed: true,
            finalRolloutConfirmArmed: true,
            commissioningOwner: "平台工程师",
            baOwner: "BA工程师"
          }
        }
      };
    },
    getSiteCapabilities() {
      return {
        items: [
          {
            subsystemType: "hvac_terminal",
            status: "enabled",
            sourceStatus: "ok",
            controlBoundary: {
              mode: "enforced",
              writeEnabled: true
            }
          }
        ]
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: false
  }, { adminStore }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/final-control-rollout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE"
        })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "FINAL_CONTROL_ROLLOUT_BLOCKED");
    assert.equal(payload.dispatchAllowed, false);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.executionGate?.dispatchAllowed, true);
    assert.equal(payload.blockers.some((item) => item.key === "final_rollout_confirm_phrase_missing"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU canary dispatch endpoint blocks when field authorization gates are not ready", async () => {
  const adminStore = {
    getFcuControlPolicy() {
      return {
        policy: {
          enabled: true,
          defaultMode: "enforced",
          dispatchAdapter: "legacy-scene-command",
          whitelist: ["BGS01"],
          fieldAuthorization: {
            siteAuthorizationStatus: "requested",
            baWriteConfirmArmed: false,
            finalRolloutConfirmArmed: false
          }
        }
      };
    },
    getSiteCapabilities() {
      return {
        items: [
          {
            subsystemType: "hvac_terminal",
            status: "enabled",
            sourceStatus: "ok",
            controlBoundary: {
              mode: "enforced",
              writeEnabled: true
            }
          }
        ]
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: false
  }, { adminStore }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/canary-dispatch?deviceCode=BGS01`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceCode: "BGS01",
          confirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE"
        })
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "EXECUTION_GATE_BLOCKED");
    assert.equal(payload.dispatchAllowed, false);
    assert.equal(payload.controlMutation, false);
    assert.equal(payload.executionGate?.dispatchAllowed, false);
    assert.equal(payload.executionGate?.blockedReasons?.includes("site_authorization_approved"), true);
    assert.equal(payload.executionGate?.blockedReasons?.includes("ba_write_confirm_armed"), true);
    assert.equal(payload.executionGate?.blockedReasons?.includes("final_rollout_confirm_armed"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("FCU runtime execution gate blocks approved authorization outside active window", async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-control-policy-final-gate-test-"));
  writeFcuFinalControlGatesReport(outputDir, {
    ok: false,
    summary: {
      gateCount: 8,
      passed: 0,
      blocked: 8,
      canaryReady: false
    }
  });
  const adminStore = {
    getFcuControlPolicy() {
      return {
        policy: {
          enabled: true,
          defaultMode: "enforced",
          dispatchAdapter: "legacy-scene-command",
          whitelist: ["BGS01"],
          fieldAuthorization: {
            siteAuthorizationStatus: "approved",
            siteAuthorizationBy: "业主值班长",
            siteAuthorizationWindowStart: "2020-01-01T09:00:00.000Z",
            siteAuthorizationWindowEnd: "2020-01-01T11:00:00.000Z",
            baWriteConfirmArmed: true,
            finalRolloutConfirmArmed: true,
            commissioningOwner: "平台工程师",
            baOwner: "BA工程师"
          }
        }
      };
    },
    getSiteCapabilities() {
      return {
        items: [
          {
            subsystemType: "hvac_terminal",
            status: "enabled",
            sourceStatus: "ok",
            controlBoundary: {
              mode: "enforced",
              writeEnabled: true
            }
          }
        ]
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use("/bff/v1", buildV1Router({
    defaultSiteId: "126lnoffice",
    legacyBaseUrl: "http://127.0.0.1:8098",
    staleThresholdHours: 6,
    readOnlyMode: false,
    fcuFinalControlOutputDir: outputDir
  }, { adminStore }));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/bff/v1/sites/126lnoffice/hvac-terminal/fan-coils/control-policy`
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.executionGate?.authorizationStatus, "approved");
    assert.equal(payload.executionGate?.authorizationOwnerReady, true);
    assert.equal(payload.executionGate?.authorizationWindowConfigured, true);
    assert.equal(payload.executionGate?.authorizationWindowActive, false);
    assert.equal(payload.executionGate?.dispatchAllowed, false);
    assert.equal(payload.executionGate?.blockedReasons?.includes("site_authorization_window_active"), true);
    assert.equal(payload.finalDispatchGate?.dispatchAllowed, false);
    assert.equal(payload.finalDispatchGate?.blockedReasons?.includes("final_control_gates_passed"), true);
    assert.equal(payload.finalDispatchGate?.blockedReasons?.includes("final_canary_ready"), true);
    assert.equal(payload.finalDispatchGate?.summary?.blocked, 8);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

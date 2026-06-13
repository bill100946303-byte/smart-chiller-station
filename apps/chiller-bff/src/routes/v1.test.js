import test from "node:test";
import assert from "node:assert/strict";

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

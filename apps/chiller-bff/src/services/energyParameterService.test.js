import assert from "node:assert/strict";
import test from "node:test";

import {
  getEnergyParameters,
  updateEnergyParameters
} from "./energyParameterService.js";

function buildRuntimeConfig() {
  return {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    staleThresholdHours: 6,
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive"
    }
  };
}

test("getEnergyParameters remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/energyparameters/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: {
        id: "1",
        schemeName: "深圳电价",
        startPeriod: "1672502400000",
        endPeriod: "1703952000000",
        peakPeriod: "10:00",
        peakPrice: "1.10",
        averagePeriod: "08:00",
        averagePrice: "0.75",
        valleyPeriod: "00:00",
        valleyPrice: "0.31",
        sharpTime: "21:00",
        sharpPrice: "1.10"
      }
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getEnergyParameters(buildRuntimeConfig(), "btwentyfive");

    assert.ok(
      requests.some((item) => item.includes("/zsqy/energyparameters/140btwentyfive/findAll")),
      "expected B25 siteId to normalize to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.item?.schemeName, "深圳电价");
    assert.equal(result.item?.startPeriod, "2023-01-01");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateEnergyParameters remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/energyparameters/140btwentyfive/update")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({ status: "20000", msg: "OK", ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await updateEnergyParameters(buildRuntimeConfig(), "btwentyfive", {
      id: "1",
      schemeName: "深圳电价",
      startPeriod: "2023-01-01",
      endPeriod: "2023-12-31",
      peakPeriod: ["10:00"],
      peakPrice: "1.10",
      averagePeriod: ["08:00"],
      averagePrice: "0.75",
      valleyPeriod: ["00:00"],
      valleyPrice: "0.31",
      sharpTime: ["21:00"],
      sharpPrice: "1.10"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/energyparameters/140btwentyfive/update")),
      "expected B25 update path to normalize to runtime databaseKey"
    );
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

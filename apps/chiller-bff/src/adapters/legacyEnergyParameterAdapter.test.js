import assert from "node:assert/strict";
import test from "node:test";

import {
  loadEnergyParameters,
  updateEnergyParameters
} from "./legacyEnergyParameterAdapter.js";

test("loadEnergyParameters normalizes singleton payload and epoch dates for B25 cloud endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (!target.includes("/zsqy/energyparameters/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: {
        id: "1",
        schemeName: "2023年深圳市工商业电价价目表",
        startPeriod: "1672502400000",
        endPeriod: "1703952000000",
        peakPeriod: "10:00,11:00",
        peakPrice: "1.1081",
        averagePeriod: "07:00,08:00",
        averagePrice: "0.7556",
        valleyPeriod: "00:00,01:00",
        valleyPrice: "0.3116",
        sharpTime: "21:00",
        sharpPrice: "1.1081"
      }
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await loadEnergyParameters("https://www.ssge.com.cn:8098", "140btwentyfive");

    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.sourceStatus.rows, 1);
    assert.equal(result.item?.schemeName, "2023年深圳市工商业电价价目表");
    assert.equal(result.item?.startPeriod, "2023-01-01");
    assert.equal(result.item?.endPeriod, "2023-12-31");
    assert.deepEqual(result.item?.peakPeriod, ["10:00", "11:00"]);
    assert.deepEqual(result.item?.sharpTime, ["21:00"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateEnergyParameters encodes date inputs back to epoch milliseconds", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (!target.includes("/zsqy/energyparameters/140btwentyfive/update")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    requestBody = options?.body ? JSON.parse(String(options.body)) : null;
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: null
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await updateEnergyParameters("https://www.ssge.com.cn:8098", "140btwentyfive", {
      id: "1",
      schemeName: "深圳电价",
      startPeriod: "2023-01-01",
      endPeriod: "2023-12-31",
      peakPeriod: ["10:00", "11:00"],
      averagePeriod: ["07:00"],
      valleyPeriod: ["00:00"],
      sharpTime: ["21:00"],
      peakPrice: "1.1081",
      averagePrice: "0.7556",
      valleyPrice: "0.3116",
      sharpPrice: "1.1081"
    });

    assert.equal(result.ok, true);
    assert.equal(requestBody?.startPeriod, "1672502400000");
    assert.equal(requestBody?.endPeriod, "1703952000000");
    assert.equal(requestBody?.peakPeriod, "10:00,11:00");
    assert.equal(requestBody?.sharpTime, "21:00");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

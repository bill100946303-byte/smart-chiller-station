import assert from "node:assert/strict";
import test from "node:test";

import { loadColdStationLog } from "./legacyColdStationLogAdapter.js";

test("loadColdStationLog probes projectKeyCandidates until a usable identifier with rows succeeds", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (
      target.endsWith(
        "/zsqy/lengzhanrecords/140btwentyfive/getLengZhanRecords?date=2026-04-10"
      )
    ) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            lengZhanRecordsDetailVOList: []
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (
      target.endsWith(
        "/zsqy/lengzhanrecords/126lnoffice/getLengZhanRecords?date=2026-04-10"
      )
    ) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            inputPower: "120.5",
            systemEfficiency: "4.98",
            lengZhanRecordsDetailVOList: [
              {
                time: "1",
                systemCoolingCapacity: "56.2",
                systemPower: "11.3"
              }
            ]
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadColdStationLog("http://127.0.0.1:8098", "btwentyfive", {
      date: "2026-04-10",
      projectKey: "140btwentyfive",
      projectKeyCandidates: ["140btwentyfive", "126lnoffice"]
    });

    assert.equal(result.sourceStatus.ok, true);
    assert.equal(
      result.sourceStatus.endpoint,
      "/zsqy/lengzhanrecords/126lnoffice/getLengZhanRecords?date=2026-04-10"
    );
    assert.match(result.sourceStatus.message || "", /selected=126lnoffice/);
    assert.equal(result.sourceStatus.rows, 1);
    assert.equal(result.summary.inputPower, 120.5);
    assert.equal(result.summary.systemEfficiency, 4.98);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].time, "1");
    assert.equal(result.items[0].systemCoolingCapacity, 56.2);
    assert.equal(result.items[0].systemPower, 11.3);
    assert.ok(
      requests.includes(
        "http://127.0.0.1:8098/zsqy/lengzhanrecords/140btwentyfive/getLengZhanRecords?date=2026-04-10"
      )
    );
    assert.ok(
      requests.includes(
        "http://127.0.0.1:8098/zsqy/lengzhanrecords/126lnoffice/getLengZhanRecords?date=2026-04-10"
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadColdStationLog treats HTTP 200 payload ok=false as a failed legacy source", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/zsqy/lengzhanrecords/btwentyfive/getLengZhanRecords?date=2026-04-10")) {
      return new Response(
        JSON.stringify({
          ok: false,
          msg: "查询失败"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadColdStationLog("http://127.0.0.1:8098", "btwentyfive", {
      date: "2026-04-10"
    });

    assert.equal(result.items.length, 0);
    assert.equal(result.latestTimestamp, null);
    assert.equal(result.sourceStatus.ok, false);
    assert.equal(result.sourceStatus.status, 200);
    assert.equal(result.sourceStatus.message, "查询失败");
    assert.equal(result.sourceStatus.error, "查询失败");
    assert.equal(result.sourceStatus.rows, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadColdStationLog unwraps XML-shaped nested detail rows", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/zsqy/lengzhanrecords/126lnoffice/getLengZhanRecords?date=2026-04-10")) {
      return new Response(
        JSON.stringify({
          status: "20000",
          msg: "OK",
          data: {
            inputPower: "54.1",
            lengZhanRecordsDetailVOList: {
              lengZhanRecordsDetailVOList: [
                {
                  time: " 00:00",
                  systemCoolingCapacity: "0.00",
                  systemPower: "0.30"
                },
                {
                  time: " 01:00",
                  systemCoolingCapacity: "0.00",
                  systemPower: "0.30"
                }
              ]
            }
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadColdStationLog("http://127.0.0.1:8098", "126lnoffice", {
      date: "2026-04-10"
    });

    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.sourceStatus.rows, 2);
    assert.equal(result.summary.inputPower, 54.1);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].time, "00:00");
    assert.equal(result.items[0].systemPower, 0.3);
    assert.equal(result.items[1].time, "01:00");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadColdStationLog marks summary-only payloads without detail rows as failed", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/zsqy/lengzhanrecords/126lnoffice/getLengZhanRecords?date=2026-04-10")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            inputPower: "54.1",
            hostPower: "44.1",
            lengZhanRecordsDetailVOList: []
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadColdStationLog("http://127.0.0.1:8098", "126lnoffice", {
      date: "2026-04-10"
    });

    assert.equal(result.summary.inputPower, 54.1);
    assert.equal(result.items.length, 0);
    assert.equal(result.latestTimestamp, null);
    assert.equal(result.sourceStatus.ok, false);
    assert.equal(result.sourceStatus.rows, 0);
    assert.match(result.sourceStatus.message || "", /detailRows=0/);
    assert.equal(result.sourceStatus.error, "Legacy detail rows missing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

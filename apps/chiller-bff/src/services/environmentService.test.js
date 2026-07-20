import assert from "node:assert/strict";
import test from "node:test";

import { getEnvironmentBuildings, getEnvironmentConditions } from "./environmentService.js";

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

test("getEnvironmentBuildings remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/buildinfo/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: [
        {
          buildid: "1",
          buildname: "1鍙锋ゼ"
        }
      ]
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getEnvironmentBuildings(buildRuntimeConfig(), "btwentyfive");

    assert.ok(
      requests.some((item) => item.includes("/zsqy/buildinfo/140btwentyfive/findAll")),
      "expected environment buildings request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "1");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnvironmentConditions remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/condition/140btwentyfive/findObject")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: [
        {
          id: "condition-1",
          buildingId: "1",
          monitoringSite: "1F-A-01",
          temperatureValue: "24.6",
          humidityValue: "55"
        }
      ]
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getEnvironmentConditions(buildRuntimeConfig(), "btwentyfive", {
      buildingId: "1",
      cooledAir: "0",
      monitoringSite: "1F"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/condition/140btwentyfive/findObject")),
      "expected environment conditions request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.filters.buildingId, "1");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].monitoringSite, "1F-A-01");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnvironmentConditions prefers request databaseKey over request projectKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/condition/140btwentyfive/findObject")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: []
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getEnvironmentConditions(buildRuntimeConfig(), "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      cooledAir: "1"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/condition/140btwentyfive/findObject?CooledAir=1")),
      "expected environment path segment to use databaseKey instead of projectKey"
    );
    assert.equal(result.site.siteId, "140");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnvironmentConditions returns empty fallback items when no fan-coil devices are available", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.includes("/zsqy/condition/140btwentyfive/findObject")) {
      return new Response(
        "<Map><timestamp>1775897284687</timestamp><status>404</status><error>Not Found</error></Map>",
        {
          status: 404,
          headers: {
            "content-type": "application/xml"
          }
        }
      );
    }

    if (target.includes("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        ok: true,
        data: [
          {
            drid: "169",
            buildid: "1",
            drname: "B13渚涙按娓╁害",
            drtypename: "娓╁害浼犳劅鍣?"
          },
          {
            drid: "96",
            buildid: "1",
            drname: "瀹ゅ婀垮害",
            drtypename: "瀹ゅ婀垮害"
          },
          {
            drid: "167",
            buildid: "1",
            drname: "B13渚涙按鍘嬪姏",
            drtypename: "鍘嬪姏浼犳劅鍣?"
          }
        ]
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.includes("drId=169")) {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
          currentPage: 1,
          pageSize: 200,
          rowCount: 1,
          pageCount: 1,
          records: {
            records: {
              regId: "1",
              regName: "B13渚涙按娓╁害",
              tagName: "AI_B13_SUPPLY_TEMP",
              newtagvalue: "8.8"
            }
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.includes("drId=96")) {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
          currentPage: 1,
          pageSize: 200,
          rowCount: 1,
          pageCount: 1,
          records: {
            records: {
              regId: "2",
              regName: "瀹ゅ婀垮害",
              tagName: "AI_OUTDOOR_HUMIDITY",
              newtagvalue: "55.0"
            }
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await getEnvironmentConditions(buildRuntimeConfig(), "btwentyfive", {
      buildingId: "1",
      cooledAir: "0"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/condition/140btwentyfive/findObject")),
      "expected environment conditions to try the primary condition endpoint first"
    );
    assert.equal(
      requests.some((item) => item.includes("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=169")),
      false
    );
    assert.equal(result.items.length, 0);
    assert.equal(result.sourceStatus.overall, "partial");
    assert.equal(
      result.sourceStatus.sources?.some((item) => item.reasonCode === "b25-environment-sensor-compatibility"),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

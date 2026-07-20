import assert from "node:assert/strict";
import test from "node:test";

import { getColdStationLog } from "./coldStationLogService.js";

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

function buildHistoryPayload(rows) {
  return JSON.stringify({
    status: "20000",
    msg: "OK",
    ok: true,
    data: {
      curveValueList: rows
    }
  });
}

test("getColdStationLog uses B25 cloud history instead of legacy lengzhanrecords", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    requests.push(target.toString());

    if (target.pathname.includes("/lengzhanrecords/")) {
      throw new Error(`Unexpected legacy cold-station request: ${target}`);
    }

    const drId = Number(target.searchParams.get("drId"));
    const regId = Number(target.searchParams.get("regId"));
    const date = target.searchParams.get("date");
    assert.equal(date, dateText);

    const payloads = new Map([
      ["127:914", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "100.0" },
        { name: `${date.slice(5)} 01:00`, value: "110.0" },
        { name: `${date.slice(5)} 02:00`, value: "122.0" }
      ])],
      ["126:913", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "200.00" },
        { name: `${date.slice(5)} 01:00`, value: "235.17" },
        { name: `${date.slice(5)} 02:00`, value: "270.34" }
      ])],
      ["110:897", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "70.0" },
        { name: `${date.slice(5)} 01:00`, value: "77.0" },
        { name: `${date.slice(5)} 02:00`, value: "86.0" }
      ])],
      ["103:890", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "20.0" },
        { name: `${date.slice(5)} 01:00`, value: "22.0" },
        { name: `${date.slice(5)} 02:00`, value: "25.0" }
      ])],
      ["124:911", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "30.0" },
        { name: `${date.slice(5)} 01:00`, value: "33.0" },
        { name: `${date.slice(5)} 02:00`, value: "37.0" }
      ])],
      ["117:904", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "10.0" },
        { name: `${date.slice(5)} 01:00`, value: "11.0" },
        { name: `${date.slice(5)} 02:00`, value: "13.0" }
      ])],
      ["93:880", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "8.0" },
        { name: `${date.slice(5)} 00:50`, value: "8.2" },
        { name: `${date.slice(5)} 01:00`, value: "8.1" },
        { name: `${date.slice(5)} 01:50`, value: "8.3" }
      ])],
      ["94:881", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "12.0" },
        { name: `${date.slice(5)} 00:50`, value: "12.2" },
        { name: `${date.slice(5)} 01:00`, value: "12.1" },
        { name: `${date.slice(5)} 01:50`, value: "12.3" }
      ])],
      ["128:1049", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "31.0" },
        { name: `${date.slice(5)} 00:50`, value: "31.2" },
        { name: `${date.slice(5)} 01:00`, value: "31.1" },
        { name: `${date.slice(5)} 01:50`, value: "31.3" }
      ])],
      ["129:1050", buildHistoryPayload([
        { name: `${date.slice(5)} 00:00`, value: "27.0" },
        { name: `${date.slice(5)} 00:50`, value: "27.2" },
        { name: `${date.slice(5)} 01:00`, value: "27.1" },
        { name: `${date.slice(5)} 01:50`, value: "27.3" }
      ])]
    ]);

    const payload = payloads.get(`${drId}:${regId}`);
    if (!payload) {
      throw new Error(`Unexpected cloud history request: ${target}`);
    }

    return new Response(payload, {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getColdStationLog(buildRuntimeConfig(), "btwentyfive", dateText);

    assert.ok(
      requests.some((item) => item.includes("/zsqy/reg/140btwentyfive/findRegHistoryByDrid")),
      "expected B25 cold station log to use cloud history endpoint"
    );
    assert.ok(
      requests.every((item) => !item.includes("/lengzhanrecords/")),
      "expected service to bypass legacy lengzhanrecords for B25"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.summary.inputPower, 22);
    assert.equal(result.items.length, 2);
    assert.equal(result.sourceStatus.overall, "ok");
    assert.equal(result.sourceStatus.sources?.[0]?.originLabel, "B25云端历史");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

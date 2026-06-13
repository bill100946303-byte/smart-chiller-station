import assert from "node:assert/strict";
import test from "node:test";

import {
  loadB25CloudColdStationLog,
  loadB25CloudTrendSeries,
  shouldUseB25CloudHistory
} from "./b25CloudHistoryAdapter.js";

function buildHistoryPayload(points) {
  return JSON.stringify({
    status: "20000",
    msg: "OK",
    ok: true,
    data: {
      curveValueList: points.map((point) => ({
        name: point.name,
        value: point.value
      }))
    }
  });
}

test("shouldUseB25CloudHistory detects B25 site and source keys", () => {
  assert.equal(shouldUseB25CloudHistory({}, "btwentyfive"), true);
  assert.equal(
    shouldUseB25CloudHistory(
      {
        siteSourceConfig: {
          databaseKey: "140btwentyfive"
        }
      },
      "custom-site"
    ),
    true
  );
  assert.equal(shouldUseB25CloudHistory({}, "other-site"), false);
});

test("loadB25CloudTrendSeries derives B25 trend metrics from cloud history points", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const drId = Number(target.searchParams.get("drId"));
    const regId = Number(target.searchParams.get("regId"));
    const date = target.searchParams.get("date");
    assert.equal(date, "2026-04-10");

    if (drId === 127 && regId === 914) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "100.0" },
          { name: "04-10 00:10", value: "101.0" },
          { name: "04-10 00:20", value: "102.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 126 && regId === 913) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "200.0" },
          { name: "04-10 00:10", value: "206.0" },
          { name: "04-10 00:20", value: "212.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 93 && regId === 880) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "8.0" },
          { name: "04-10 00:10", value: "8.0" },
          { name: "04-10 00:20", value: "8.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 94 && regId === 881) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "12.0" },
          { name: "04-10 00:10", value: "12.0" },
          { name: "04-10 00:20", value: "13.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 128 && regId === 1049) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "31.0" },
          { name: "04-10 00:10", value: "32.0" },
          { name: "04-10 00:20", value: "33.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 129 && regId === 1050) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "27.0" },
          { name: "04-10 00:10", value: "28.0" },
          { name: "04-10 00:20", value: "29.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadB25CloudTrendSeries("https://www.ssge.com.cn:8098", "btwentyfive", {
      range: "24h",
      date: "2026-04-10"
    });

    const totalPowerSeries = result.series.find((item) => item.metric === "totalPowerKw");
    const copSeries = result.series.find((item) => item.metric === "currentCop");
    const chilledDeltaSeries = result.series.find((item) => item.metric === "chilledDeltaT");
    const coolingDeltaSeries = result.series.find((item) => item.metric === "coolingDeltaT");

    assert.equal(totalPowerSeries?.points?.length, 2);
    assert.equal(totalPowerSeries?.points?.[0]?.v, 6);
    assert.equal(totalPowerSeries?.points?.[1]?.v, 6);
    assert.equal(copSeries?.points?.length, 2);
    assert.equal(copSeries?.points?.[0]?.v, 6);
    assert.equal(copSeries?.points?.[1]?.v, 6);
    assert.deepEqual(
      chilledDeltaSeries?.points?.map((point) => point.v),
      [4, 4, 5]
    );
    assert.deepEqual(
      coolingDeltaSeries?.points?.map((point) => point.v),
      [4, 4, 4]
    );
    assert.equal(result.sourceStatus.length, 6);
    assert.equal(result.sourceStatus.every((item) => item.ok), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadB25CloudTrendSeries trims frozen cumulative tail points when cloud history stops updating", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const drId = Number(target.searchParams.get("drId"));
    const regId = Number(target.searchParams.get("regId"));
    const date = target.searchParams.get("date");
    assert.equal(date, "2026-04-10");

    if (drId === 127 && regId === 914) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "100.0" },
          { name: "04-10 00:10", value: "101.0" },
          { name: "04-10 00:20", value: "101.0" },
          { name: "04-10 00:30", value: "" },
          { name: "04-10 00:40", value: "" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 126 && regId === 913) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "200.0" },
          { name: "04-10 00:10", value: "206.0" },
          { name: "04-10 00:20", value: "206.0" },
          { name: "04-10 00:30", value: "" },
          { name: "04-10 00:40", value: "" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 93 && regId === 880) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "8.0" },
          { name: "04-10 00:10", value: "8.0" },
          { name: "04-10 00:20", value: "8.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 94 && regId === 881) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "12.0" },
          { name: "04-10 00:10", value: "12.0" },
          { name: "04-10 00:20", value: "12.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 128 && regId === 1049) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "31.0" },
          { name: "04-10 00:10", value: "31.0" },
          { name: "04-10 00:20", value: "31.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (drId === 129 && regId === 1050) {
      return new Response(
        buildHistoryPayload([
          { name: "04-10 00:00", value: "27.0" },
          { name: "04-10 00:10", value: "27.0" },
          { name: "04-10 00:20", value: "27.0" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadB25CloudTrendSeries("https://www.ssge.com.cn:8098", "btwentyfive", {
      range: "24h",
      date: "2026-04-10"
    });

    const totalPowerSeries = result.series.find((item) => item.metric === "totalPowerKw");
    const copSeries = result.series.find((item) => item.metric === "currentCop");
    const totalPowerSource = result.sourceStatus.find((item) => item.key === "totalPower");

    assert.deepEqual(
      totalPowerSeries?.points?.map((point) => point.v),
      [6]
    );
    assert.deepEqual(
      copSeries?.points?.map((point) => point.v),
      [6]
    );
    assert.match(totalPowerSource?.message || "", /tailTrimmed=1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadB25CloudColdStationLog builds hourly rows and summary from cloud history points", async () => {
  const originalFetch = globalThis.fetch;
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
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
      throw new Error(`Unexpected URL: ${target}`);
    }
    return new Response(payload, {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await loadB25CloudColdStationLog("https://www.ssge.com.cn:8098", "btwentyfive", {
      date: dateText
    });

    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.items.length, 2);
    assert.equal(result.summary.inputPower, 22);
    assert.equal(result.summary.outputCoolingCapacity, 20);
    assert.equal(result.summary.systemEfficiency, 1.1);
    assert.equal(result.summary.hostPower, 16);
    assert.equal(result.summary.refrigeratingPumpPower, 5);
    assert.equal(result.summary.coolingPumpPower, 7);
    assert.equal(result.summary.coolingTowerPower, 3);
    assert.equal(result.items[0].systemPower, 10);
    assert.equal(result.items[0].systemCoolingCapacity, 10);
    assert.equal(result.items[0].systemEfficiency, 1);
    assert.equal(result.items[0].hostPower, 7);
    assert.equal(result.items[0].coolingWaterInputTemperature, 27.1);
    assert.equal(result.items[0].coolingWaterOutputTemperature, 31.1);
    assert.equal(result.items[1].systemPower, 12);
    assert.equal(result.items[1].systemCoolingCapacity, 10);
    assert.equal(result.items[1].systemEfficiency, 1.2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

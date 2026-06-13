import assert from "node:assert/strict";
import test from "node:test";

import { getMeterReadings } from "./meterReadingService.js";

function formatDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

function buildB25HistoryResponder(dateText) {
  const payloads = new Map([
    ["127:914", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "100.0" },
      { name: `${dateText.slice(5)} 01:00`, value: "110.0" },
      { name: `${dateText.slice(5)} 02:00`, value: "122.0" }
    ])],
    ["126:913", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "200.00" },
      { name: `${dateText.slice(5)} 01:00`, value: "235.17" },
      { name: `${dateText.slice(5)} 02:00`, value: "270.34" }
    ])],
    ["110:897", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "70.0" },
      { name: `${dateText.slice(5)} 01:00`, value: "77.0" },
      { name: `${dateText.slice(5)} 02:00`, value: "86.0" }
    ])],
    ["103:890", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "20.0" },
      { name: `${dateText.slice(5)} 01:00`, value: "22.0" },
      { name: `${dateText.slice(5)} 02:00`, value: "25.0" }
    ])],
    ["124:911", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "30.0" },
      { name: `${dateText.slice(5)} 01:00`, value: "33.0" },
      { name: `${dateText.slice(5)} 02:00`, value: "37.0" }
    ])],
    ["117:904", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "10.0" },
      { name: `${dateText.slice(5)} 01:00`, value: "11.0" },
      { name: `${dateText.slice(5)} 02:00`, value: "13.0" }
    ])],
    ["93:880", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "8.0" },
      { name: `${dateText.slice(5)} 00:50`, value: "8.2" },
      { name: `${dateText.slice(5)} 01:00`, value: "8.1" },
      { name: `${dateText.slice(5)} 01:50`, value: "8.3" }
    ])],
    ["94:881", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "12.0" },
      { name: `${dateText.slice(5)} 00:50`, value: "12.2" },
      { name: `${dateText.slice(5)} 01:00`, value: "12.1" },
      { name: `${dateText.slice(5)} 01:50`, value: "12.3" }
    ])],
    ["128:1049", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "31.0" },
      { name: `${dateText.slice(5)} 00:50`, value: "31.2" },
      { name: `${dateText.slice(5)} 01:00`, value: "31.1" },
      { name: `${dateText.slice(5)} 01:50`, value: "31.3" }
    ])],
    ["129:1050", buildHistoryPayload([
      { name: `${dateText.slice(5)} 00:00`, value: "27.0" },
      { name: `${dateText.slice(5)} 00:50`, value: "27.2" },
      { name: `${dateText.slice(5)} 01:00`, value: "27.1" },
      { name: `${dateText.slice(5)} 01:50`, value: "27.3" }
    ])]
  ]);

  return (target) => {
    const url = new URL(String(target));
    if (!url.pathname.endsWith("/findRegHistoryByDrid")) {
      return null;
    }
    assert.equal(url.searchParams.get("date"), dateText);
    const payload = payloads.get(`${url.searchParams.get("drId")}:${url.searchParams.get("regId")}`);
    return payload || null;
  };
}

test("getMeterReadings probes legacy aliases and falls back to B25 cloud history", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const dateText = formatDateText(new Date());
  const startTime = `${dateText} 00:00:00`;
  const endTime = `${dateText} 23:59:59`;
  const respondHistory = buildB25HistoryResponder(dateText);

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    const parsed = new URL(target);

    if (parsed.pathname === "/zsqy/reportmanage/140/findEnergyCoolingCapacity") {
      assert.equal(parsed.searchParams.get("startTime"), startTime);
      assert.equal(parsed.searchParams.get("endTime"), endTime);
      return new Response(JSON.stringify({ ok: false, msg: "legacy 140 unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    if (parsed.pathname === "/zsqy/reportmanage/140btwentyfive/findEnergyCoolingCapacity") {
      assert.equal(parsed.searchParams.get("startTime"), startTime);
      assert.equal(parsed.searchParams.get("endTime"), endTime);
      return new Response(JSON.stringify({ ok: false, msg: "legacy 140btwentyfive unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    if (parsed.pathname === "/zsqy/reportmanage/btwentyfive/findEnergyCoolingCapacity") {
      assert.equal(parsed.searchParams.get("startTime"), startTime);
      assert.equal(parsed.searchParams.get("endTime"), endTime);
      return new Response(JSON.stringify({ ok: false, msg: "legacy btwentyfive unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    const historyPayload = respondHistory(target);
    if (historyPayload) {
      return new Response(historyPayload, {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getMeterReadings(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140",
          databaseKey: "140btwentyfive"
        }
      },
      "btwentyfive",
      {
        startTime,
        endTime
      }
    );

    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.columns.includes("时间"), true);
    assert.equal(result.sourceStatus.overall, "ok");
    const expectedQuery = `startTime=${startTime.replace(" ", "+").replace(/:/g, "%3A")}&endTime=${endTime.replace(" ", "+").replace(/:/g, "%3A")}&language=zh&unit=KW&modelKey=140btwentyfive&template=1`;
    assert.deepEqual(requests.slice(0, 3), [
      `http://127.0.0.1:8098/zsqy/reportmanage/140btwentyfive/findEnergyCoolingCapacity?${expectedQuery}`,
      `http://127.0.0.1:8098/zsqy/reportmanage/140/findEnergyCoolingCapacity?${expectedQuery}`,
      `http://127.0.0.1:8098/zsqy/reportmanage/btwentyfive/findEnergyCoolingCapacity?${expectedQuery}`
    ]);
    assert.ok(
      requests.some((url) => url.includes("/zsqy/reg/140btwentyfive/findRegHistoryByDrid?")),
      "expected a B25 cloud history fallback request"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { loadMeterReadingExport, loadMeterReadings } from "./legacyMeterReadingAdapter.js";

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

function createFetchStub(dateText, startTime, endTime) {
  const respondHistory = buildB25HistoryResponder(dateText);

  return async (url) => {
    const target = String(url);
    const parsed = new URL(target);

    if (
      parsed.pathname === "/zsqy/reportmanage/140/findEnergyCoolingCapacity" ||
      parsed.pathname === "/zsqy/reportmanage/140btwentyfive/findEnergyCoolingCapacity" ||
      parsed.pathname === "/zsqy/reportmanage/btwentyfive/findEnergyCoolingCapacity"
    ) {
      assert.equal(parsed.searchParams.get("startTime"), startTime);
      assert.equal(parsed.searchParams.get("endTime"), endTime);
      return new Response(JSON.stringify({ ok: false, msg: "legacy reportmanage unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    if (
      parsed.pathname === "/zsqy/reportmanage/140/exportCoolingCapacity" ||
      parsed.pathname === "/zsqy/reportmanage/140btwentyfive/exportCoolingCapacity" ||
      parsed.pathname === "/zsqy/reportmanage/btwentyfive/exportCoolingCapacity"
    ) {
      assert.equal(parsed.searchParams.get("startTime"), startTime);
      assert.equal(parsed.searchParams.get("endTime"), endTime);
      return new Response("legacy export unavailable", {
        status: 500,
        headers: { "content-type": "text/plain" }
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
}

test("loadMeterReadings falls back to B25 cloud history and returns a tabular DTO", async () => {
  const originalFetch = globalThis.fetch;
  const dateText = formatDateText(new Date());
  const startTime = `${dateText} 00:00:00`;
  const endTime = `${dateText} 23:59:59`;
  globalThis.fetch = createFetchStub(dateText, startTime, endTime);

  try {
    const result = await loadMeterReadings("http://127.0.0.1:8098", "btwentyfive", {
      startTime,
      endTime,
      identifierCandidates: ["140", "140btwentyfive"],
      runtimeConfig: {
        siteSourceConfig: {
          databaseKey: "140btwentyfive"
        }
      }
    });

    assert.equal(result.total, 2);
    assert.equal(result.columns[0], "时间");
    assert.equal(result.items[0]["时间"], `${dateText} 00:00`);
    assert.equal(result.items[0]["冷站总电量(kWh)"], 10);
    assert.equal(result.items[0]["系统冷量(RT*h)"], 10);
    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.sourceStatus.interfaceKind, "cloud-reg-history");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadMeterReadingExport falls back to CSV export when legacy export is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const dateText = formatDateText(new Date());
  const startTime = `${dateText} 00:00:00`;
  const endTime = `${dateText} 23:59:59`;
  globalThis.fetch = createFetchStub(dateText, startTime, endTime);

  try {
    const result = await loadMeterReadingExport("http://127.0.0.1:8098", "btwentyfive", {
      startTime,
      endTime,
      identifierCandidates: ["140", "140btwentyfive"],
      runtimeConfig: {
        siteSourceConfig: {
          databaseKey: "140btwentyfive"
        }
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.contentType, "text/csv; charset=utf-8");
    assert.match(result.filename || "", /\.csv$/);
    const text = new TextDecoder().decode(result.data);
    assert.match(text, /时间,冷站总电量\(kWh\),系统冷量\(RT\*h\)/);
    assert.match(text, new RegExp(`${dateText} 00:00`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

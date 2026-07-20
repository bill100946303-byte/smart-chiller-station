import test from "node:test";
import assert from "node:assert/strict";

import {
  getEnergyEfficiencyCalendar,
  getEnergyEfficiencyCalendarPie
} from "./energyEfficiencyCalendarService.js";

test("getEnergyEfficiencyCalendar prefers runtime legacy app id while preserving requested site identity", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).endsWith("/zsqy/energycalendar/findEnergyCalendar?appId=140&year=2026&month=4")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              date: "1号",
              rte: "8.44",
              p: "19969.5",
              c: "168521",
              m: "-1",
              k: "-1"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (String(url).endsWith("/zsqy/energycalendar/140/findMonthEnergy?date=2026-04")) {
      return new Response(
        JSON.stringify({
          data: {
            rte: "8.44",
            p: "19969.5",
            c: "168521",
            m: "-1",
            k: "-1"
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await getEnergyEfficiencyCalendar(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140"
        }
      },
      "btwentyfive",
      {
        month: "2026-04"
      }
    );

    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.month, "2026-04");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].date, "2026-04-01");
    assert.equal(result.items[0].efficiency, 8.44);
    assert.equal(result.items[0].power, 19969.5);
    assert.equal(result.items[0].cooling, 168521);
    assert.equal(result.sourceStatus.overall, "ok");
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energycalendar/findEnergyCalendar?appId=140&year=2026&month=4",
      "http://127.0.0.1:8098/zsqy/energycalendar/140/findMonthEnergy?date=2026-04"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnergyEfficiencyCalendarPie falls back to energy-analysis category summaries when pie payload is aggregated", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisPie?appId=140&date=2026-04-15&dateType=1&energyType=1") {
      return new Response(
        JSON.stringify({
          status: "20000",
          msg: "OK",
          data: {
            Freezing: "7285303.3"
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

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-15&dateType=1&energyType=1") {
      return new Response(
        JSON.stringify({
          status: "20000",
          msg: "OK",
          data: [
            {
              title: "冷水主机",
              unit: "kWh",
              curveValueList: [
                {
                  name: "04-15 00:10",
                  value: "25160"
                }
              ]
            },
            {
              title: "冷冻泵",
              unit: "kWh",
              curveValueList: [
                {
                  name: "04-15 00:10",
                  value: "2443.1"
                }
              ]
            },
            {
              title: "冷却泵",
              unit: "kWh",
              curveValueList: [
                {
                  name: "04-15 00:10",
                  value: "1994.2"
                }
              ]
            },
            {
              title: "冷却塔",
              unit: "kWh",
              curveValueList: [
                {
                  name: "04-15 00:10",
                  value: "1123.7"
                }
              ]
            }
          ]
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
    const result = await getEnergyEfficiencyCalendarPie(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140"
        }
      },
      "btwentyfive",
      {
        date: "2026-04-15",
        dateType: "1"
      }
    );

    assert.equal(result.site.siteId, "btwentyfive");
    assert.deepEqual(
      (result.segments || []).map((item) => item.name),
      ["冷水机组", "冷冻水泵", "冷却水泵", "冷却塔"]
    );
    assert.deepEqual(
      (result.segments || []).map((item) => item.value),
      [25160, 2443.1, 1994.2, 1123.7]
    );
    assert.equal(result.total, 30721);
    assert.equal(result.sourceStatus.overall, "partial");
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisPie?appId=140&date=2026-04-15&dateType=1&energyType=1",
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-15&dateType=1&energyType=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnergyEfficiencyCalendarPie uses four category monthly totals for month view", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisPie?appId=140&date=2026-04&dateType=2&energyType=1") {
      return new Response(
        JSON.stringify({
          status: "20000",
          msg: "OK",
          data: {
            Freezing: "998877"
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

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04&dateType=2&energyType=1") {
      return new Response(
        JSON.stringify({
          status: "20000",
          msg: "OK",
          data: [
            {
              title: "\u51b7\u6c34\u4e3b\u673a",
              unit: "kWh",
              curveValueList: [{ name: "2026-04", value: "1000" }]
            },
            {
              title: "\u51b7\u51bb\u6c34\u6cf5",
              unit: "kWh",
              curveValueList: [{ name: "2026-04", value: "200" }]
            },
            {
              title: "\u51b7\u5374\u6c34\u6cf5",
              unit: "kWh",
              curveValueList: [{ name: "2026-04", value: "300" }]
            },
            {
              title: "\u51b7\u5374\u5854",
              unit: "kWh",
              curveValueList: [{ name: "2026-04", value: "400" }]
            }
          ]
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
    const result = await getEnergyEfficiencyCalendarPie(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140"
        }
      },
      "btwentyfive",
      {
        date: "2026-04",
        dateType: "2"
      }
    );

    assert.deepEqual(
      (result.segments || []).map((item) => item.name),
      ["\u51b7\u6c34\u673a\u7ec4", "\u51b7\u51bb\u6c34\u6cf5", "\u51b7\u5374\u6c34\u6cf5", "\u51b7\u5374\u5854"]
    );
    assert.deepEqual(
      (result.segments || []).map((item) => item.value),
      [1000, 200, 300, 400]
    );
    assert.equal(result.total, 1900);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisPie?appId=140&date=2026-04&dateType=2&energyType=1",
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04&dateType=2&energyType=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

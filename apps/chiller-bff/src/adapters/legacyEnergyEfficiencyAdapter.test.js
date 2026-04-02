import assert from "node:assert/strict";
import test from "node:test";

import { loadEnergyEfficiencyProportion } from "./legacyEnergyEfficiencyAdapter.js";

test("loadEnergyEfficiencyProportion falls back to projectKey when siteId legacy path fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).endsWith("/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=2026-04&dateType=2")) {
      return new Response(
        "<Map><timestamp>1775023241976</timestamp><status>500</status><error>Internal Server Error</error></Map>",
        {
          status: 500,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    if (String(url).endsWith("/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              "负荷区间": "80%~90%,6800~7600,1934~2161",
              "负荷比重比例": "18.5",
              "冷站效能": "4.92"
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadEnergyEfficiencyProportion("http://127.0.0.1:8098", "btwentyfive", {
      projectKey: "126lnoffice",
      date: "2026-04",
      dateType: "2"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(
      result.sourceStatus?.endpoint,
      "/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2"
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].rangeLabel, "80%~90%,6800~7600,1934~2161");
    assert.equal(result.rows[0].loadRatioPct, 18.5);
    assert.equal(result.rows[0].stationEfficiency, 4.92);
    assert.equal(result.rows[0].wetBulbC, null);
    assert.equal(
      requests[0],
      "http://127.0.0.1:8098/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyProportion normalizes wet bulb fields from proportion rows", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=2026-04&dateType=2")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              "负荷区间": "50%~60%负荷区间",
              "负荷比重比例": "21.2",
              "冷站效能": "5.18",
              "室外湿球温度": "27.6"
            },
            {
              "负荷区间": "60%~70%负荷区间",
              "负荷比重比例": "18.3",
              "冷站效能": "5.04",
              wetBulbC: "28.4"
            },
            {
              "负荷区间": "70%~80%负荷区间",
              "负荷比重比例": "15.1",
              "冷站效能": "4.97",
              "室外湿球温度": "",
              wetBulbC: "29.1"
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadEnergyEfficiencyProportion("http://127.0.0.1:8098", "btwentyfive", {
      date: "2026-04",
      dateType: "2"
    });

    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[0].wetBulbC, 27.6);
    assert.equal(result.rows[1].wetBulbC, 28.4);
    assert.equal(result.rows[2].wetBulbC, 29.1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

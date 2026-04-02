import test from "node:test";
import assert from "node:assert/strict";

import { getEnergyEfficiencyCalendar } from "./energyEfficiencyCalendarService.js";

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

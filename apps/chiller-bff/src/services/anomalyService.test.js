import assert from "node:assert/strict";
import test from "node:test";

import { getAnomalySummary } from "./anomalyService.js";

test("getAnomalySummary marks sourceStatus failed when alarm payload returns ok=false", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/140/getAllSubsystemInfo")) {
      return new Response(JSON.stringify({ error: "missing drtypeinfo" }), {
        status: 500,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.includes("/zsqy/qsAlarmlog/140/findAlarm?")) {
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
    const result = await getAnomalySummary(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6
      },
      "140"
    );

    assert.equal(result.counts.total, 0);
    assert.deepEqual(result.latestEvents, []);
    assert.equal(result.freshness.latestTimestamp, null);
    assert.equal(result.freshness.stale, true);
    assert.equal(result.diagnosisFlags.staleAlarmFeed, false);
    assert.equal(result.sourceStatus.overall, "failed");
    assert.equal(result.sourceStatus.sources[0]?.key, "subsystemSummary");
    assert.equal(result.sourceStatus.sources[0]?.ok, false);
    assert.equal(result.sourceStatus.sources[0]?.status, 500);
    assert.equal(result.sourceStatus.sources[1]?.key, "latestAlarmLog");
    assert.equal(result.sourceStatus.sources[1]?.ok, false);
    assert.equal(result.sourceStatus.sources[1]?.status, 200);
    assert.equal(result.sourceStatus.sources[1]?.message, "查询失败");
    assert.equal(result.sourceStatus.sources[1]?.error, "查询失败");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getAnomalySummary reuses runtime siteSourceConfig identifiers when siteId legacy path is broken", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.endsWith("/140btwentyfive/getAllSubsystemInfo")) {
      return new Response(JSON.stringify({ error: "missing drtypeinfo" }), {
        status: 500,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/126lnoffice/getAllSubsystemInfo")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            alarmEvent: [
              {
                id: 59787,
                time: "2026-04-07 14:21:20.000",
                alarmLevel: 3,
                alarmstate: 0,
                alarmvalue: 1
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

    if (target.includes("/zsqy/qsAlarmlog/140btwentyfive/findAlarm?")) {
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

    if (target.includes("/zsqy/qsAlarmlog/126lnoffice/findAlarm?")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: [
            {
              id: 59787,
              time: "2026-04-07 14:21:20.000",
              alarmLevel: 3,
              alarmstate: 0,
              alarmvalue: 1
            },
            {
              id: 59786,
              time: "2026-04-07 13:00:40.000",
              alarmLevel: 2,
              alarmstate: 0,
              alarmvalue: 1
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
    const result = await getAnomalySummary(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "140btwentyfive",
          modelKey: "126lnoffice"
        }
      },
      "140"
    );

    assert.equal(result.counts.total, 2);
    assert.equal(result.sourceStatus.overall, "ok");
    assert.equal(result.sourceStatus.sources[0]?.endpoint, "/126lnoffice/getAllSubsystemInfo");
    assert.match(result.sourceStatus.sources[1]?.endpoint || "", /^\/zsqy\/qsAlarmlog\/126lnoffice\/findAlarm\?/);
    assert.match(result.sourceStatus.sources[0]?.message || "", /selected=126lnoffice/);
    assert.match(result.sourceStatus.sources[1]?.message || "", /selected=126lnoffice/);
    assert.ok(
      !requests.includes("http://127.0.0.1:8098/140/getAllSubsystemInfo"),
      "runtime siteSourceConfig fallback should avoid retrying the raw siteId path once a usable key succeeds"
    );
    assert.ok(
      !requests.some((item) => item.includes("http://127.0.0.1:8098/zsqy/qsAlarmlog/140/findAlarm?")),
      "runtime siteSourceConfig fallback should avoid retrying the raw siteId alarm path once a usable key succeeds"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

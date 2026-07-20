import assert from "node:assert/strict";
import test from "node:test";
import { loadRealtimeParametersSnapshot } from "./realtimeParametersAdapter.js";

test("loadRealtimeParametersSnapshot does not fabricate freshness when rows have no timestamp", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).includes("/wx/device/141afour/listRealTimeParameters")) {
      return new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: [
            {
              groupName: "冷站",
              data: [
                { tagName: "totalPower", tagValue: 103.2 },
                { tagName: "coldStationCop", tagValue: 3 },
                { tagName: "chilledWaterTemperatureDifference", tagValue: 1 }
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadRealtimeParametersSnapshot("http://127.0.0.1:8098", "141", {
      databaseKey: "141afour",
      projectKey: "141afour"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(result.sourceStatus?.rows, 3);
    assert.equal(result.metrics?.totalPowerKw, 103.2);
    assert.equal(result.metrics?.currentCop, 3);
    assert.equal(result.latestTimestamp, null);
    assert.match(result.sourceStatus?.message || "", /timestampMissing=true/);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

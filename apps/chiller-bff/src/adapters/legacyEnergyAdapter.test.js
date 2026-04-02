import assert from "node:assert/strict";
import test from "node:test";
import { loadEnergyOverview } from "./legacyEnergyAdapter.js";

test("loadEnergyOverview falls back to projectKey when siteId legacy path fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).endsWith("/zsqy/homepage/btwentyfive/getEquipmentEnergyStatisticsCurve")) {
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

    if (String(url).endsWith("/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-01 08:00:00",
            totalPower: 16.9,
            coldStationCop: 5.8,
            chilledWaterTemperatureDifference: 4.4,
            chilledOutWaterTemperatureDifference: 4.9
          }
        ]),
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
    const result = await loadEnergyOverview("http://127.0.0.1:8098", "btwentyfive", {
      projectKey: "126lnoffice"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(result.sourceStatus?.endpoint, "/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
    assert.equal(result.metrics?.totalPowerKw, 16.9);
    assert.equal(result.metrics?.currentCop, 5.8);
    assert.equal(result.metrics?.chilledDeltaT, 4.4);
    assert.equal(result.metrics?.coolingDeltaT, 4.9);
    assert.equal(requests[0], "http://127.0.0.1:8098/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
    assert.ok(
      requests.includes("http://127.0.0.1:8098/api/homeData/126lnoffice/energyEfficiency"),
      "expected homeData fallback to reuse the projectKey path"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

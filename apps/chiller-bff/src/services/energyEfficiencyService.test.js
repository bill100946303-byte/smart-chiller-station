import assert from "node:assert/strict";
import test from "node:test";

import { getEnergyEfficiencyImbalance } from "./energyEfficiencyService.js";

test("getEnergyEfficiencyImbalance uses legacyAppId for B25 app-scoped endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
          title: "Thermal unbalance rate",
          curveValueList: {
            curveValueList: [
              { name: "2026-04-10 00:10", value: "1.2" },
              { name: "2026-04-10 00:20", value: "2.4" }
            ]
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
          dataStatisticsList: {
            acquisitionValue: "采集值",
            scalar: "5.1",
            noScalar: "4.8",
            scalarRate: "6.3"
          },
          tableList: {
            drName: "1#冷水机组",
            drTypeName: "主机",
            scalarRate: "2.8"
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getEnergyEfficiencyImbalance(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140",
          databaseKey: "140btwentyfive",
          modelKey: "126lnoffice"
        }
      },
      "btwentyfive",
      {
        startDate: "2026-04-10",
        endDate: "2026-04-11"
      }
    );

    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.series.length, 1);
    assert.equal(result.series[0].points.length, 2);
    assert.equal(result.statisticsRows.length, 1);
    assert.equal(result.deviceRows.length, 1);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11",
      "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

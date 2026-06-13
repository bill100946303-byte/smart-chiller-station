import assert from "node:assert/strict";
import test from "node:test";

import { getReportRecords } from "./reportRecordService.js";

function buildRuntimeConfig() {
  return {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    staleThresholdHours: 6,
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive",
      modelKey: "140btwentyfive-1",
      template: "1"
    }
  };
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("getReportRecords keeps response site stable while posting detailed report curve to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let postedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    requests.push(target);
    if (target.includes("/zsqy/reportmanage/140btwentyfive/getDetailedReportCurve")) {
      assert.equal(init.method, "POST");
      postedPayload = JSON.parse(String(init.body || "{}"));
      return jsonResponse({
        status: "20000",
        msg: "OK",
        ok: true,
        data: [
          {
            objName: "3#冷水机组-功率",
            sumValue: "30.3",
            maxValue: "20.1",
            maxTime: "2026-05-11 01:00:00",
            minValue: "10.2",
            minTime: "2026-05-11 00:00:00",
            average: "99.99",
            runParamsCurveVO: {
              unit: "KW",
              curveValueList: [
                { name: "2026-05-11 00:00:00", value: "10.2" },
                { name: "2026-05-11 01:00:00", value: "20.1" }
              ]
            }
          }
        ]
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await getReportRecords(buildRuntimeConfig(), "btwentyfive", {
      startTime: "2026-05-11",
      endTime: "2026-05-12",
      drTypeId: "75",
      drId: "9",
      regIds: ["519"],
      dateType: "4"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/reportmanage/140btwentyfive/getDetailedReportCurve")),
      "expected detailed report path to normalize to runtime databaseKey"
    );
    assert.ok(
      requests.some((item) => item.includes("modelKey=140btwentyfive-1")),
      "expected runtime modelKey in cloud query"
    );
    assert.deepEqual(postedPayload?.drRegList, [{ drId: 9, regIds: [519] }]);
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.total, 1);
    assert.equal(result.items[0]["对象"], "3#冷水机组-功率");
    assert.equal(result.items[0]["平均值"], "99.99 KW");
    assert.equal(result.summaryItems[0]["平均值"], "99.99 KW");
    assert.deepEqual(result.chart.series?.[0]?.values, [10.2, 20.1]);
    assert.equal(result.sourceStatus.overall, "ok");
    assert.equal(result.sourceStatus.sources?.[0]?.ok, true);
    assert.equal(result.sourceStatus.sources?.[0]?.originLabel, "Legacy reportmanage getDetailedReportCurve");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

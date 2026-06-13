import assert from "node:assert/strict";
import test from "node:test";

import {
  loadReportRecordRegOptions,
  loadReportRecords
} from "./legacyReportRecordAdapter.js";

function buildRuntimeConfig() {
  return {
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive",
      deviceDataInterfaces: [
        {
          projectKey: "140btwentyfive",
          endpointKind: "legacy-reg-findAllByDrTypeId",
          build: 1,
          floor: 0,
          label: "B25"
        }
      ],
      defaultDeviceQuery: {
        build: 1,
        floor: 0
      }
    }
  };
}

function buildRuntimeCatalogPayload() {
  return {
    status: "20000",
    msg: "OK",
    ok: true,
    data: [
      {
        drid: 127,
        drnameCNEN: "Main Meter",
        drtypeid: 187,
        drtypenameCNEN: "Meter",
        reglist: {
          reglist: [
            {
              regId: 914,
              regName: "Power"
            },
            {
              regId: 915,
              regName: "Cooling"
            }
          ]
        }
      }
    ]
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

test("report-record reg options fall back to runtime device collection when Drtypemode is semantically failed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/zsqy/Drtypemode/140btwentyfive/findAllDrTypeModeByDrTypeId")) {
      return jsonResponse({ status: "50009", msg: "failed", ok: false });
    }
    if (target.includes("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return jsonResponse(buildRuntimeCatalogPayload());
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await loadReportRecordRegOptions("https://www.ssge.com.cn:8098", "140btwentyfive", {
      drTypeId: "187",
      drId: "127",
      runtimeConfig: buildRuntimeConfig()
    });

    assert.deepEqual(result.items, [
      { id: "914", label: "Power" },
      { id: "915", label: "Cooling" }
    ]);
    assert.equal(result.sourceStatuses?.length, 2);
    assert.equal(result.sourceStatuses?.[0]?.ok, false);
    assert.equal(result.sourceStatuses?.[1]?.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("report-record reg options accept single-object Drtypemode payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/zsqy/Drtypemode/119csix/findAllDrTypeModeByDrTypeId")) {
      return jsonResponse({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
          regId: "1868",
          regName: "大冰机冷冻冷量",
          drtypeid: "188",
          typemodeid: "1868"
        }
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await loadReportRecordRegOptions("https://www.ssge.com.cn:8098", "119csix", {
      drTypeId: "188",
      drId: "109",
      language: "zh",
      unit: "RT",
      modelKey: "119csix",
      template: "1",
      runtimeConfig: buildRuntimeConfig()
    });

    assert.deepEqual(result.items, [{ id: "1868", label: "大冰机冷冻冷量" }]);
    assert.equal(result.sourceStatuses?.[0]?.rows, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("report-record data posts getDetailedReportCurve payload with selected device reg groups", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let postedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    requests.push({ target, init });
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
          },
          {
            objName: "3#冷水机组-电量",
            sumValue: "12",
            maxValue: "7",
            maxTime: "2026-05-11 01:00:00",
            minValue: "5",
            minTime: "2026-05-11 00:00:00",
            average: "6",
            runParamsCurveVO: {
              unit: "KW/h",
              curveValueList: [
                { name: "2026-05-11 00:00:00", value: "5" },
                { name: "2026-05-11 01:00:00", value: "7" }
              ]
            }
          }
        ],
        data2: "detail-report"
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await loadReportRecords("https://www.ssge.com.cn:8098", "140btwentyfive", {
      startTime: "2026-05-11",
      endTime: "2026-05-12",
      drTypeId: "75",
      drId: "9",
      dateType: "4",
      drRegList: [
        { drId: "8", regIds: ["475", "474"] },
        { drId: "9", regIds: ["519", "520"] }
      ],
      language: "zh",
      unit: "KW",
      modelKey: "140btwentyfive-1",
      template: "1",
      runtimeConfig: buildRuntimeConfig()
    });

    assert.ok(
      requests.some(({ target }) => target.includes("/zsqy/reportmanage/140btwentyfive/getDetailedReportCurve?")),
      "expected detailed report curve endpoint"
    );
    assert.ok(
      requests.some(({ target }) => target.includes("modelKey=140btwentyfive-1")),
      "expected project modelKey in query"
    );
    assert.deepEqual(postedPayload, {
      time: "2026-05-11,2026-05-12",
      drTypeId: 75,
      drId: 9,
      dateType: 4,
      startTime: "2026-05-11",
      endTime: "2026-05-12",
      drRegList: [
        { drId: 8, regIds: [475, 474] },
        { drId: 9, regIds: [519, 520] }
      ]
    });
    assert.deepEqual(result.columns, ["对象", "总值", "峰值", "峰值出现时间", "谷值", "谷值出现时间", "平均值"]);
    assert.equal(result.total, 2);
    assert.equal(result.items[0]["对象"], "3#冷水机组-功率");
    assert.equal(result.items[0]["总值"], "30.3 KW");
    assert.equal(result.items[0]["峰值"], "20.1 KW");
    assert.equal(result.items[0]["峰值出现时间"], "2026-05-11 01:00:00");
    assert.equal(result.items[0]["谷值"], "10.2 KW");
    assert.equal(result.items[0]["谷值出现时间"], "2026-05-11 00:00:00");
    assert.equal(result.items[0]["平均值"], "99.99 KW");
    assert.deepEqual(result.summaryColumns, ["对象", "总值", "峰值", "峰值出现时间", "谷值", "谷值出现时间", "平均值"]);
    assert.equal(result.summaryItems[0]["平均值"], "99.99 KW");
    assert.deepEqual(result.chart.labels, ["2026-05-11 00:00:00", "2026-05-11 01:00:00"]);
    assert.deepEqual(result.chart.series?.[0], {
      name: "3#冷水机组-功率",
      values: [10.2, 20.1]
    });
    assert.deepEqual(result.chart.series?.[1], {
      name: "3#冷水机组-电量",
      values: [5, 7]
    });
    assert.equal(result.sourceStatuses?.[0]?.ok, true);
    assert.equal(result.sourceStatuses?.[0]?.originLabel, "Legacy reportmanage getDetailedReportCurve");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("report-record data accepts single-object detailed report payload", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/zsqy/reportmanage/140btwentyfive/getDetailedReportCurve")) {
      assert.equal(init.method, "POST");
      return jsonResponse({
        status: "20000",
        msg: "OK",
        ok: true,
        data: {
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
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await loadReportRecords("https://www.ssge.com.cn:8098", "140btwentyfive", {
      startTime: "2026-05-11",
      endTime: "2026-05-12",
      drTypeId: "75",
      drId: "9",
      dateType: "4",
      drRegList: [{ drId: "9", regIds: ["174"] }],
      language: "zh",
      unit: "KW",
      modelKey: "140btwentyfive-1",
      template: "1",
      runtimeConfig: buildRuntimeConfig()
    });

    assert.equal(result.total, 1);
    assert.equal(result.items[0]["对象"], "3#冷水机组-功率");
    assert.equal(result.items[0]["总值"], "30.3 KW");
    assert.equal(result.items[0]["平均值"], "99.99 KW");
    assert.deepEqual(result.chart.labels, ["2026-05-11 00:00:00", "2026-05-11 01:00:00"]);
    assert.deepEqual(result.chart.series?.[0]?.values, [10.2, 20.1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("report-record data falls back to current drId and regIds when drRegList is omitted", async () => {
  const originalFetch = globalThis.fetch;
  let postedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/zsqy/reportmanage/140btwentyfive/getDetailedReportCurve")) {
      postedPayload = JSON.parse(String(init.body || "{}"));
      return jsonResponse({ status: "20000", msg: "OK", ok: true, data: { rows: [] } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    await loadReportRecords("https://www.ssge.com.cn:8098", "140btwentyfive", {
      startTime: "2026-05-11",
      endTime: "2026-05-12",
      drTypeId: "75",
      drId: "9",
      regIds: ["519", "520"],
      runtimeConfig: buildRuntimeConfig()
    });

    assert.deepEqual(postedPayload?.drRegList, [{ drId: 9, regIds: [519, 520] }]);
    assert.equal(postedPayload?.dateType, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

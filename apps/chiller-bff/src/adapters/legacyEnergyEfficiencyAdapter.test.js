import assert from "node:assert/strict";
import test from "node:test";

import {
  loadEnergyEfficiencyCompare,
  loadEnergyEfficiencyImbalance,
  loadEnergyEfficiencyProportion,
  loadEnergyEfficiencySearch
} from "./legacyEnergyEfficiencyAdapter.js";

test("loadEnergyEfficiencySearch uses database-key path and legacy query parameters", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findEnergySearch?drNameList=CoolingTower%2CChillerUnit&timeSpace=1&startTime=2026-05-05&endTime=2026-05-06&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        data: []
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
    const result = await loadEnergyEfficiencySearch("http://127.0.0.1:8098", "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      modelKey: "140btwentyfive-1",
      template: "1",
      language: "zh",
      unit: "KW",
      startDate: "2026-05-05",
      endDate: "2026-05-06",
      timeSpace: "1",
      deviceKeys: ["CoolingTower", "ChillerUnit"]
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(
      result.sourceStatus?.endpoint,
      "/zsqy/energycalendar/140btwentyfive/findEnergySearch?drNameList=CoolingTower%2CChillerUnit&timeSpace=1&startTime=2026-05-05&endTime=2026-05-06&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    );
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findEnergySearch?drNameList=CoolingTower%2CChillerUnit&timeSpace=1&startTime=2026-05-05&endTime=2026-05-06&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencySearch normalizes single XML table and curve objects", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target === "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findEnergySearch?drNameList=CoolingStation&timeSpace=1&startTime=2026-05-05&endTime=2026-05-06&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(`
        <SysResult>
          <status>20000</status>
          <msg>OK</msg>
          <data>
            <tableList>
              <averageValue>7.68</averageValue>
              <tenPercentGoodAverageValue>8.16</tenPercentGoodAverageValue>
              <tenPercentBadAverageValue>7.10</tenPercentBadAverageValue>
              <wholeValue>7.69</wholeValue>
              <object>冷站</object>
            </tableList>
            <curveList>
              <data>
                <coolingValue>7312.7</coolingValue>
                <energyValue>921.9</energyValue>
                <cop>7.93</cop>
                <time>05-05 00:00</time>
              </data>
              <data>
                <coolingValue>7396.8</coolingValue>
                <energyValue>962.5</energyValue>
                <cop>7.68</cop>
                <time>05-05 01:00</time>
              </data>
            </curveList>
          </data>
        </SysResult>
      `, {
        status: 200,
        headers: {
          "content-type": "application/xml;charset=UTF-8"
        }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadEnergyEfficiencySearch("http://127.0.0.1:8098", "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      modelKey: "140btwentyfive-1",
      template: "1",
      language: "zh",
      unit: "KW",
      startDate: "2026-05-05",
      endDate: "2026-05-06",
      timeSpace: "1",
      deviceKeys: ["CoolingStation"]
    });

    assert.equal(result.tableRows.length, 1);
    assert.equal(result.tableRows[0].object, "冷站");
    assert.equal(result.series.length, 1);
    assert.equal(result.series[0].name, "冷站");
    assert.equal(result.series[0].points.length, 2);
    assert.equal(result.series[0].points[0].label, "05-05 00:00");
    assert.equal(result.series[0].points[0].value, 7.93);
    assert.deepEqual(result.axisLabels, ["05-05 00:00", "05-05 01:00"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyCompare uses database-key path and legacy contrast parameters", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findEnergyContrast?drName=CoolingStation&timeList=2026-05-08%2C2026-05-09%2C2026-05-07%2C2026-05-06&timeSpace=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        data: []
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
    const result = await loadEnergyEfficiencyCompare("http://127.0.0.1:8098", "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      modelKey: "140btwentyfive-1",
      template: "1",
      language: "zh",
      unit: "KW",
      deviceKey: "CoolingStation",
      dates: ["2026-05-08", "2026-05-09", "2026-05-07", "2026-05-06"]
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(
      result.sourceStatus?.endpoint,
      "/zsqy/energycalendar/140btwentyfive/findEnergyContrast?drName=CoolingStation&timeList=2026-05-08%2C2026-05-09%2C2026-05-07%2C2026-05-06&timeSpace=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    );
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findEnergyContrast?drName=CoolingStation&timeList=2026-05-08%2C2026-05-09%2C2026-05-07%2C2026-05-06&timeSpace=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyProportion uses database-key path and legacy load-specific-gravity parameters", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findLoadSpecificGravity?date=2026-05&dateType=2&language=vie&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(JSON.stringify({
        status: "20000",
        msg: "OK",
        data: []
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
    const result = await loadEnergyEfficiencyProportion("http://127.0.0.1:8098", "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      modelKey: "140btwentyfive-1",
      template: "1",
      language: "vie",
      unit: "KW",
      date: "2026-05",
      dateType: "2"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(
      result.sourceStatus?.endpoint,
      "/zsqy/energycalendar/140btwentyfive/findLoadSpecificGravity?date=2026-05&dateType=2&language=vie&unit=KW&modelKey=140btwentyfive-1&template=1"
    );
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energycalendar/140btwentyfive/findLoadSpecificGravity?date=2026-05&dateType=2&language=vie&unit=KW&modelKey=140btwentyfive-1&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyProportion normalizes XML load-specific-gravity rows", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/zsqy/energycalendar/140btwentyfive/findLoadSpecificGravity?date=2026-05&dateType=2&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1")) {
      return new Response(
        "<SysResult><status>20000</status><msg>OK</msg>" +
          "<data><\u8d1f\u8377\u6bd4\u91cd\u6bd4\u4f8b>0.53</\u8d1f\u8377\u6bd4\u91cd\u6bd4\u4f8b><\u51b7\u7ad9\u6548\u80fd>6.35</\u51b7\u7ad9\u6548\u80fd><\u8d1f\u8377\u533a\u95f4>0%~10%,0~1004.7,0~285.7</\u8d1f\u8377\u533a\u95f4></data>" +
          "<data><\u8d1f\u8377\u6bd4\u91cd\u6bd4\u4f8b>6.91</\u8d1f\u8377\u6bd4\u91cd\u6bd4\u4f8b><\u51b7\u7ad9\u6548\u80fd>6.3</\u51b7\u7ad9\u6548\u80fd><\u8d1f\u8377\u533a\u95f4>20%~30%,2009.3~3014,571.3~857</\u8d1f\u8377\u533a\u95f4></data>" +
          "<data2/><ok>true</ok></SysResult>",
        {
          status: 200,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadEnergyEfficiencyProportion("http://127.0.0.1:8098", "140", {
      databaseKey: "140btwentyfive",
      projectKey: "140btwentyfive-1",
      modelKey: "140btwentyfive-1",
      template: "1",
      language: "zh",
      unit: "KW",
      date: "2026-05",
      dateType: "2"
    });

    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].rangeLabel, "0%~10%,0~1004.7,0~285.7");
    assert.equal(result.rows[0].loadRatioPct, 0.53);
    assert.equal(result.rows[0].stationEfficiency, 6.35);
    assert.equal(result.rows[1].rangeLabel, "20%~30%,2009.3~3014,571.3~857");
    assert.equal(result.rows[1].loadRatioPct, 6.91);
    assert.equal(result.rows[1].stationEfficiency, 6.3);
    assert.equal(result.sourceStatus?.rows, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyProportion falls back to projectKey when siteId legacy path fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).endsWith("/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=2026-04&dateType=2&language=zh&unit=KW&modelKey=btwentyfive&template=1")) {
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

    if (String(url).endsWith("/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2&language=zh&unit=KW&modelKey=126lnoffice&template=1")) {
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
      "/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2&language=zh&unit=KW&modelKey=126lnoffice&template=1"
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].rangeLabel, "80%~90%,6800~7600,1934~2161");
    assert.equal(result.rows[0].loadRatioPct, 18.5);
    assert.equal(result.rows[0].stationEfficiency, 4.92);
    assert.equal(result.rows[0].wetBulbC, null);
    assert.equal(
      requests[0],
      "http://127.0.0.1:8098/zsqy/energycalendar/126lnoffice/findLoadSpecificGravity?date=2026-04&dateType=2&language=zh&unit=KW&modelKey=126lnoffice&template=1"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyEfficiencyProportion normalizes wet bulb fields from proportion rows", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=2026-04&dateType=2&language=zh&unit=KW&modelKey=btwentyfive&template=1")) {
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

test("loadEnergyEfficiencyImbalance uses project-key path for table while retaining appId query", async () => {
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
              { name: "2026-04-10 00:10", value: "1.2" }
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
            acquisitionValue: "246",
            scalar: "220",
            noScalar: "26",
            scalarRate: "89.43"
          },
          tableList: {
            scalarRate: "89.43"
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
    const result = await loadEnergyEfficiencyImbalance("http://127.0.0.1:8098", "btwentyfive", {
      appId: "140",
      tableIdentifier: "140btwentyfive",
      startDate: "2026-04-10",
      endDate: "2026-04-11"
    });

    assert.equal(result.series.length, 1);
    assert.equal(result.statisticsRows.length, 1);
    assert.equal(result.deviceRows.length, 1);
    assert.equal(result.statisticsRows[0].acquisitionValue, "246");
    assert.equal(result.deviceRows[0].deviceName, "--");
    assert.equal(result.deviceRows[0].scalarRate, 89.43);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11",
      "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisDeviceList?appId=140&date=2026-04-11&dateType=0&energyType=4&startTime=2026-04-10&endTime=2026-04-11"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

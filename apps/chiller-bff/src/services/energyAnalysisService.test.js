import assert from "node:assert/strict";
import test from "node:test";

import { getEnergyAnalysisReport, getEnergyAnalysisTree } from "./energyAnalysisService.js";

test("getEnergyAnalysisReport ignores parent/category selection without concrete drIds", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getEnergyAnalysisReport(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          legacyAppId: "140",
          databaseKey: "140btwentyfive",
          modelKey: "140btwentyfive-1",
          template: "1"
        }
      },
      "btwentyfive",
      {
        startDate: "2026-04-10",
        endDate: "2026-04-10",
        dateType: "1",
        deviceIds: ["chiller", "energy-type:169"]
      }
    );

    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.filters.startDate, "2026-04-10");
    assert.deepEqual(result.series, []);
    assert.deepEqual(result.summaries, []);
    assert.equal(result.sourceStatus.overall, "failed");
    assert.deepEqual(requests, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnergyAnalysisTree loads cloud energy groups and group devices", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/Drtypeinfo/140btwentyfive/findAllDrTypeAndDrEnergy?language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(
        "<SysResult><status>20000</status><msg>OK</msg><data><drtypeid>167</drtypeid><drtypename>电量记录</drtypename><drtypeinfoList><drtypeinfoList><drtypeid>169</drtypeid><drtypename>冷水主机电量</drtypename><drTypeCode>CHE</drTypeCode></drtypeinfoList></drtypeinfoList></data></SysResult>",
        {
          status: 200,
          headers: {
            "content-type": "application/xml"
          }
        }
      );
    }

    if (target === "http://127.0.0.1:8098/zsqy/drinfo/140btwentyfive/findAll?drtypeid=167&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response("<SysResult><status>20000</status><msg>OK</msg><data2/><ok>true</ok></SysResult>", {
        status: 200,
        headers: {
          "content-type": "application/xml"
        }
      });
    }

    if (target === "http://127.0.0.1:8098/zsqy/drinfo/140btwentyfive/findAll?drtypeid=169&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(
        "<SysResult><status>20000</status><msg>OK</msg><data><drid>74</drid><drname>CH1电量</drname><drtypeid>169</drtypeid></data><data><drid>75</drid><drname>CH2电量</drname><drtypeid>169</drtypeid></data></SysResult>",
        {
          status: 200,
          headers: {
            "content-type": "application/xml"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getEnergyAnalysisTree(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "140btwentyfive",
          modelKey: "140btwentyfive-1",
          template: "1"
        }
      },
      "140",
      {
        language: "zh",
        unit: "KW"
      }
    );

    assert.equal(result.items[0]?.label, "电量记录");
    assert.equal(result.items[0]?.children?.[0]?.label, "冷水主机电量");
    assert.equal(result.items[0]?.children?.[0]?.children?.length, 2);
    assert.equal(result.items[0]?.children?.[0]?.children?.[0]?.deviceId, "74");
    assert.equal(result.sourceStatus.overall, "ok");
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/Drtypeinfo/140btwentyfive/findAllDrTypeAndDrEnergy?language=zh&unit=KW&modelKey=140btwentyfive-1&template=1",
      "http://127.0.0.1:8098/zsqy/drinfo/140btwentyfive/findAll?drtypeid=167&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1",
      "http://127.0.0.1:8098/zsqy/drinfo/140btwentyfive/findAll?drtypeid=169&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnergyAnalysisReport uses selected drIds with curve-by-device endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisCurveByDr?startTime=2026-04-29&endTime=2026-04-30&drIds=74,75&dateType=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1") {
      return new Response(
        "<SysResult><status>20000</status><msg>OK</msg><data><runParamsCurveVO><title>3.00</title><unit>kWh</unit><curveValueList><curveValueList><name>04-29 0:00</name><value>1</value></curveValueList><curveValueList><name>04-29 1:00</name><value>2</value></curveValueList></curveValueList></runParamsCurveVO><objName>CH1电量</objName><sumValue>3.00</sumValue><maxValue>2.00</maxValue><maxTime>04-29 1:00</maxTime><minValue>1.00</minValue><minTime>04-29 0:00</minTime><average>1.50</average></data></SysResult>",
        {
          status: 200,
          headers: {
            "content-type": "application/xml"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getEnergyAnalysisReport(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "140btwentyfive",
          modelKey: "140btwentyfive-1",
          template: "1"
        }
      },
      "140",
      {
        startDate: "2026-04-29",
        endDate: "2026-04-30",
        dateType: "1",
        deviceIds: ["74", "75"],
        language: "zh",
        unit: "KW"
      }
    );

    assert.equal(result.series[0]?.name, "CH1电量");
    assert.equal(result.series[0]?.points?.length, 2);
    assert.equal(result.summaries[0]?.sumValue, 3);
    assert.equal(result.sourceStatus.sources[0]?.endpoint, "/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisCurveByDr?startTime=2026-04-29&endTime=2026-04-30&drIds=74,75&dateType=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1");
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/140btwentyfive/getEnergyAnalysisCurveByDr?startTime=2026-04-29&endTime=2026-04-30&drIds=74,75&dateType=1&language=zh&unit=KW&modelKey=140btwentyfive-1&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEnergyAnalysisReport keeps explicit zero aggregate curves with empty point values", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target === "http://127.0.0.1:8098/zsqy/energyanalysis/119csix/getEnergyAnalysisCurveByDr?startTime=2026-04-29&endTime=2026-04-30&drIds=73,113&dateType=1&language=zh&unit=KW&modelKey=119csix&template=1") {
      return new Response(
        "<SysResult><status>20000</status><msg>OK</msg>" +
          "<data><runParamsCurveVO><title>0.00</title><unit>kWh</unit><curveValueList>" +
          "<curveValueList><name>04-29 0:00</name><value></value></curveValueList>" +
          "<curveValueList><name>04-29 1:00</name><value></value></curveValueList>" +
          "</curveValueList></runParamsCurveVO><objName>CHP total</objName><sumValue>0.00</sumValue><maxValue>0.00</maxValue><maxTime>04-29 0:00</maxTime><minValue>0.00</minValue><minTime>04-29 0:00</minTime><average>0.00</average></data>" +
          "<data><runParamsCurveVO><title>3.00</title><unit>kWh</unit><curveValueList>" +
          "<curveValueList><name>04-29 0:00</name><value>1</value></curveValueList>" +
          "<curveValueList><name>04-29 1:00</name><value>2</value></curveValueList>" +
          "</curveValueList></runParamsCurveVO><objName>LZ total</objName><sumValue>3.00</sumValue><maxValue>2.00</maxValue><maxTime>04-29 1:00</maxTime><minValue>1.00</minValue><minTime>04-29 0:00</minTime><average>1.50</average></data></SysResult>",
        {
          status: 200,
          headers: {
            "content-type": "application/xml"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await getEnergyAnalysisReport(
      {
        legacyBaseUrl: "http://127.0.0.1:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "119csix",
          modelKey: "119csix",
          template: "1"
        }
      },
      "119",
      {
        startDate: "2026-04-29",
        endDate: "2026-04-30",
        dateType: "1",
        deviceIds: ["73", "113"],
        language: "zh",
        unit: "KW"
      }
    );

    const zeroSeries = result.series.find((item) => item.name === "CHP total");
    assert.ok(zeroSeries);
    assert.deepEqual(zeroSeries.points.map((point) => point.value), [0, 0]);
    const zeroSummary = result.summaries.find((item) => item.objectName === "CHP total");
    assert.equal(zeroSummary?.sumValue, 0);
    assert.equal(result.series.length, 2);
    assert.deepEqual(requests, [
      "http://127.0.0.1:8098/zsqy/energyanalysis/119csix/getEnergyAnalysisCurveByDr?startTime=2026-04-29&endTime=2026-04-30&drIds=73,113&dateType=1&language=zh&unit=KW&modelKey=119csix&template=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

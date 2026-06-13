import assert from "node:assert/strict";
import test from "node:test";

import { loadPerformanceReport } from "./legacyPerformanceReportAdapter.js";

function buildSingletonPerformanceXml() {
  return `
    <SysResult>
      <status>20000</status>
      <msg>OK</msg>
      <data>
        <chillerPerformanceReportVO>
          <tagNameDescribe>system efficiency kW/RT</tagNameDescribe>
          <tagName>系统能效</tagName>
          <totalAvageData>0.46</totalAvageData>
          <chillerPerformanceDetailReportVO>
            <dataTime>2026-04-10</dataTime>
            <perDayAvageData>0.47</perDayAvageData>
            <weekDay>FRIDAY</weekDay>
            <perHourDatas>
              <dataTime>2026-04-10 08:00:00</dataTime>
              <weekDay>FRIDAY</weekDay>
              <value>0.46</value>
            </perHourDatas>
          </chillerPerformanceDetailReportVO>
        </chillerPerformanceReportVO>
      </data>
      <ok>true</ok>
    </SysResult>
  `.replace(/\n\s+/g, "");
}

test("loadPerformanceReport parses singleton XML objects into summary and series rows", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(buildSingletonPerformanceXml(), {
      status: 200,
      headers: {
        "content-type": "application/xml"
      }
    });
  };

  try {
    const result = await loadPerformanceReport("https://www.ssge.com.cn:8098", "140btwentyfive", {
      metric: "systemEfficiency",
      startTime: "2026-04-10 00:00:00",
      endTime: "2026-04-10 23:59:59",
      language: "zh",
      unit: "KW",
      modelKey: "126lnoffice",
      template: "1"
    });

    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/zsqy\/chillerperformancecure\/140btwentyfive\/findSystemEfficiencyByTimeSpace\?/);
    assert.equal(result.summaries.length, 1);
    assert.equal(result.summaries[0].tagName, "系统能效");
    assert.equal(result.summaries[0].average, "0.46");
    assert.equal(result.series.length, 1);
    assert.equal(result.series[0].name, "system efficiency kW/RT 2026-04-10");
    assert.equal(result.series[0].points.length, 1);
    assert.equal(result.series[0].points[0].label, "2026-04-10 08:00:00");
    assert.equal(result.series[0].points[0].value, 0.46);
    assert.deepEqual(result.axisLabels, ["2026-04-10 08:00:00"]);
    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.sourceStatus.rows, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { getPerformanceReport, getPerformanceReportExport } from "./performanceReportService.js";

function buildPerformanceXml() {
  return `
    <SysResult>
      <status>20000</status>
      <msg>OK</msg>
      <data>
        <chillerPerformanceReportVO>
          <tagNameDescribe>system efficiency kW/RT</tagNameDescribe>
          <tagName>系统能效</tagName>
          <totalAvageData>0.52</totalAvageData>
          <chillerPerformanceDetailReportVO>
            <dataTime>2026-04-10</dataTime>
            <perDayAvageData>0.52</perDayAvageData>
            <weekDay>FRIDAY</weekDay>
            <perHourDatas>
              <dataTime>2026-04-10 08:00:00</dataTime>
              <weekDay>FRIDAY</weekDay>
              <value>0.50</value>
            </perHourDatas>
            <perHourDatas>
              <dataTime>2026-04-10 09:00:00</dataTime>
              <weekDay>FRIDAY</weekDay>
              <value>0.54</value>
            </perHourDatas>
          </chillerPerformanceDetailReportVO>
        </chillerPerformanceReportVO>
      </data>
      <ok>true</ok>
    </SysResult>
  `.replace(/\n\s+/g, "");
}

test("getPerformanceReport remaps B25 aliases to runtime databaseKey and keeps response site id stable", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(buildPerformanceXml(), {
      status: 200,
      headers: {
        "content-type": "application/xml"
      }
    });
  };

  try {
    const result = await getPerformanceReport(
      {
        legacyBaseUrl: "https://www.ssge.com.cn:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "140btwentyfive",
          modelKey: "126lnoffice",
          preferredProjectKey: "126lnoffice",
          template: "1"
        }
      },
      "btwentyfive",
      {
        metric: "systemEfficiency",
        startTime: "2026-04-05 00:00:00",
        endTime: "2026-04-11 23:59:59",
        language: "zh",
        unit: "KW",
        modelKey: "btwentyfive"
      }
    );

    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/zsqy\/chillerperformancecure\/140btwentyfive\/findSystemEfficiencyByTimeSpace\?/);
    assert.match(requests[0], /modelKey=126lnoffice/);
    assert.match(requests[0], /template=1/);
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.series.length, 1);
    assert.equal(result.series[0].points.length, 2);
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getPerformanceReportExport reuses runtime databaseKey and normalized modelKey for B25 export", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename*=UTF-8''performance-report-b25.pdf"
      }
    });
  };

  try {
    const result = await getPerformanceReportExport(
      {
        legacyBaseUrl: "https://www.ssge.com.cn:8098",
        staleThresholdHours: 6,
        siteSourceConfig: {
          databaseKey: "140btwentyfive",
          modelKey: "126lnoffice",
          preferredProjectKey: "126lnoffice",
          template: "1"
        }
      },
      "btwentyfive",
      {
        startTime: "2026-04-05 00:00:00",
        endTime: "2026-04-11 23:59:59",
        language: "zh",
        unit: "KW",
        modelKey: "btwentyfive"
      }
    );

    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/zsqy\/chillerperformancecure\/140btwentyfive\/exportPdf\?/);
    assert.match(requests[0], /modelKey=126lnoffice/);
    assert.match(requests[0], /template=1/);
    assert.equal(result.ok, true);
    assert.equal(result.filename, "performance-report-b25.pdf");
    assert.equal(result.contentType, "application/pdf");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

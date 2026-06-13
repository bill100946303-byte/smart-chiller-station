import assert from "node:assert/strict";
import test from "node:test";

import { loadAlarmList, loadAlarmSummary } from "./legacyAlarmAdapter.js";

test("loadAlarmSummary marks source as failed when legacy latest-alarm payload reports not ok", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/140/getAllSubsystemInfo")) {
      return new Response(JSON.stringify({ error: "missing" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    if (target.includes("/zsqy/qsAlarmlog/140/findAlarm?")) {
      return new Response(
        JSON.stringify({ ok: false, msg: "query failed" }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (target.endsWith("/zsqy/qsAlarmlog/140/findNewAlarmLog")) {
      return new Response(
        JSON.stringify({ ok: false, msg: "query failed" }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadAlarmSummary("http://127.0.0.1:8098", "140");
    assert.equal(result.counts.total, 0);
    assert.equal(result.sourceStatus[0]?.ok, false);
    assert.equal(result.sourceStatus[1]?.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadAlarmSummary keeps full latest stream and maps alarmexplain", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.endsWith("/140/getAllSubsystemInfo")) {
      return new Response(JSON.stringify({ ok: true, data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (target.includes("/zsqy/qsAlarmlog/140/findAlarm?")) {
      const records = Array.from({ length: 12 }).map((_, index) => ({
        id: 7000 + index,
        time: "2026-04-09 16:41:20.000",
        alarmLevel: 2,
        alarmexplain: `alarm-explain-${index + 1}`,
        drname: "A区",
        drtypename: "风机盘管"
      }));
      return new Response(JSON.stringify({ ok: true, data: { records, rowCount: 12, pageCurrent: 0, pageSize: 20 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadAlarmSummary("http://127.0.0.1:8098", "140");
    assert.equal(result.latestEvents.length, 12);
    assert.equal(result.latestEvents[0]?.alarmExplain, "alarm-explain-1");
    assert.equal(result.latestEvents[0]?.source, "风机盘管-A区");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadAlarmList prefers findObject endpoint and keeps upstream total/page metadata", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.includes("/zsqy/qsAlarmlog/126lnoffice/findObject?")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            records: [
              {
                id: 9001,
                time: "2026-04-07 14:21:20.000",
                alarmLevel: 3,
                alarmstate: 0,
                alarmvalue: 1,
                alarmexplain: "Condenser pressure is above threshold",
                alarmtypename: "紧急",
                regName: "冷机高压告警",
                drname: "1号冷机",
                drtypename: "主机"
              }
            ],
            rowCount: 18,
            pageCurrent: 0,
            pageSize: 10
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadAlarmList("http://127.0.0.1:8098", "126lnoffice", {
      page: 1,
      pageSize: 10,
      severity: "3",
      template: "1"
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, "9001");
    assert.equal(result.items[0]?.title, "冷机高压告警");
    assert.equal(result.items[0]?.alarmLevel, "3");
    assert.equal(result.items[0]?.alarmTypeName, "紧急");
    assert.equal(result.items[0]?.source, "主机-1号冷机");
    assert.equal(result.items[0]?.state, "0");
    assert.equal(result.items[0]?.alarmExplain, "Condenser pressure is above threshold");
    assert.equal(result.total, 18);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 10);
    assert.match(result.sourceStatus.endpoint || "", /\/findObject\?/);
    assert.ok(
      requests.some((item) => item.includes("/zsqy/qsAlarmlog/126lnoffice/findObject?")),
      "expected findObject to be requested"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadAlarmList falls back to findAlarm when findObject is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.includes("/zsqy/qsAlarmlog/140/findObject?")) {
      return new Response(JSON.stringify({ ok: false, msg: "query failed" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (target.includes("/zsqy/qsAlarmlog/140/findAlarm?")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            records: [
              {
                id: 7001,
                time: "2026-04-09 16:41:20.000",
                alarmLevel: 3,
                alarmstate: 0,
                alarmvalue: 1
              }
            ],
            rowCount: 1,
            pageCurrent: 0,
            pageSize: 10
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadAlarmList("http://127.0.0.1:8098", "140", {
      page: 1,
      pageSize: 10
    });

    assert.equal(result.total, 1);
    assert.equal(result.items[0]?.id, "7001");
    assert.match(result.sourceStatus.endpoint || "", /\/findAlarm\?/);
    assert.ok(
      requests.some((item) => item.includes("/zsqy/qsAlarmlog/140/findObject?")),
      "expected to try findObject first"
    );
    assert.ok(
      requests.some((item) => item.includes("/zsqy/qsAlarmlog/140/findAlarm?")),
      "expected to fallback to findAlarm"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadAlarmList enriches placeholder rows via runtime reg catalog", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = String(url);

    if (target.includes("/zsqy/qsAlarmlog/140/findObject?")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: {
            records: [
              {
                id: 59788,
                time: "2026-04-09 16:41:20.000",
                alarmLevel: 3,
                alarmstate: 0,
                alarmvalue: 1,
                drname: "",
                regId: 32,
                regName: "",
                alarmname: "",
                alarmnote: "Alarm event"
              }
            ],
            rowCount: 1,
            pageCurrent: 0,
            pageSize: 20
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (target.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return new Response(
        `
        <SysResult>
          <status>20000</status>
          <msg>OK</msg>
          <data>
            <drid>3</drid>
            <drname>3#Chilled Pump</drname>
            <drtypename>Pump</drtypename>
            <reglist>
              <reglist>
                <regId>32</regId>
                <regName>Auto/Manual</regName>
                <drId>3</drId>
                <tagName>CHP3-1-509-41032</tagName>
              </reglist>
            </reglist>
          </data>
          <ok>true</ok>
        </SysResult>
        `,
        {
          status: 200,
          headers: { "content-type": "application/xml" }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadAlarmList("http://127.0.0.1:8098", "140", {
      deviceDataProjectKey: "140btwentyfive",
      deviceDataEndpointKind: "legacy-reg-findAllByDrTypeId",
      defaultDeviceQuery: { build: 1, floor: 0 }
    });

    assert.equal(result.total, 1);
    assert.equal(result.items[0]?.title, "Auto/Manual");
    assert.equal(result.items[0]?.source, "3#Chilled Pump");
    assert.equal(result.items[0]?.regId, "32");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadAlarmList recovers client paging when upstream page cursor/pageSize are unstable", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    if (target.pathname.includes("/zsqy/qsAlarmlog/143hthree/findObject")) {
      const pageCurrent = Number(target.searchParams.get("pageCurrent") || "0");
      const pageSize = Number(target.searchParams.get("pageSize") || "10");
      const allRows = Array.from({ length: 14 }).map((_, index) => ({
        id: 1000 + index + 1,
        time: "2026-04-17 18:00:00.000",
        alarmLevel: 0,
        alarmstate: 1,
        alarmtypename: "不报警",
        regName: `点位-${index + 1}`,
        drname: "测试备品室",
        drtypename: "风机盘管"
      }));

      if (pageCurrent === 1 && pageSize >= 14) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              records: allRows,
              rowCount: 14,
              pageCurrent: 0,
              pageSize
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            records: allRows.slice(0, 10),
            rowCount: 14,
            pageCurrent: 0,
            pageSize: 10
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target.toString()}`);
  };

  try {
    const page2 = await loadAlarmList("http://127.0.0.1:8098", "143hthree", {
      page: 2,
      pageSize: 10
    });
    assert.equal(page2.items.length, 4);
    assert.equal(page2.items[0]?.id, "1011");
    assert.equal(page2.pageSize, 10);

    const page1Size5 = await loadAlarmList("http://127.0.0.1:8098", "143hthree", {
      page: 1,
      pageSize: 5
    });
    assert.equal(page1Size5.items.length, 5);
    assert.equal(page1Size5.pageSize, 5);
    assert.equal(page1Size5.total, 14);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

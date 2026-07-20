import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDeviceDetail,
  loadDeviceDetails,
  loadDeviceList,
  loadDeviceRegisterCollection,
  loadDeviceTree
} from "./legacyDeviceAdapter.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function createXmlResponse(payload, status = 200) {
  return new Response(payload, {
    status,
    headers: {
      "content-type": "application/xml"
    }
  });
}

test("loadDeviceRegisterCollection performs one GET and groups flat XML registers by drId", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, options) => {
    const url = String(input);
    requests.push({ url, method: options?.method });
    if (!url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000")) {
      throw new Error(`Unexpected request: ${url}`);
    }
    return createXmlResponse(`
      <SysResult>
        <data>
          <records>
            <drId>7</drId><drcode>CH1</drcode><drname>1#冷水机组</drname>
            <drtypename>主机</drtypename><regName>运行</regName>
            <tagName>SY-1-509-40950</tagName><newtagvalue>1</newtagvalue>
          </records>
          <records>
            <drId>7</drId><drcode>CH1</drcode><drname>1#冷水机组</drname>
            <drtypename>主机</drtypename><regName>故障</regName>
            <tagName>SY-1-509-40952</tagName><newtagvalue>0</newtagvalue>
          </records>
          <records>
            <drId>8</drId><drcode>CH2</drcode><drname>2#冷水机组</drname>
            <drtypename>主机</drtypename><regName>运行</regName>
            <tagName>SY-1-509-40953</tagName><newtagvalue>0</newtagvalue>
          </records>
        </data>
      </SysResult>
    `);
  };

  try {
    const result = await loadDeviceRegisterCollection(
      "https://www.ssge.com.cn:8098",
      "140",
      { databaseKey: "140btwentyfive" }
    );

    assert.equal(result.sourceStatus.ok, true);
    assert.equal(result.records.length, 3);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.drid, "7");
    assert.equal(result.rows[0]?.reglist?.length, 2);
    assert.deepEqual(requests, [{
      url: "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000",
      method: "GET"
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("station device list filters by immutable id, checks code, and recomputes pagination", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /\/zsqy\/drinfo\/station-db\/findObject\?pageCurrent=1&pageSize=200$/);
    return createJsonResponse({
      data: [
        { drid: "1", drcode: "CH1", drname: "1#冷机", drtypename: "主机" },
        // A later catalog drift reusing CH1 must not widen the id allowlist.
        { drid: "2", drcode: "CH1", drname: "伪重复编码设备", drtypename: "主机" },
        { drid: "3", drcode: "CH3", drname: "3#冷机", drtypename: "主机" }
      ]
    });
  };

  try {
    const result = await loadDeviceList("https://example.invalid", "site-a", {
      databaseKey: "station-db",
      allowedDeviceIds: ["1"],
      allowedDeviceCodes: ["CH1"],
      page: 1,
      pageSize: 1,
      placeholderFallback: false
    });

    assert.equal(result.total, 1);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 1);
    assert.deepEqual(result.items.map((item) => item.deviceId), ["1"]);
    assert.equal(result.sourceStatus.rows, 1);
    assert.equal(result.fallbackSourceStatus, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duplicate allowed device ids fail closed for station list and tree", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/zsqy/drinfo/station-db/findObject")) {
      return createJsonResponse({
        data: [
          { drid: "1", drcode: "A", drname: "重复设备 A", typeYT: "1" },
          { drid: "1", drcode: "B", drname: "重复设备 B", typeYT: "1" }
        ]
      });
    }
    if (url.includes("/api/device/station-db/data/tree")) {
      return createJsonResponse({ data: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const options = {
      databaseKey: "station-db",
      allowedDeviceIds: ["1"],
      allowedDeviceCodes: [],
      placeholderFallback: false
    };
    const list = await loadDeviceList("https://example.invalid", "site-a", options);
    assert.equal(list.sourceStatus.ok, false);
    assert.equal(list.sourceStatus.reasonCode, "STATION_DEVICE_IDS_AMBIGUOUS");
    assert.equal(list.total, 0);
    assert.deepEqual(list.items, []);

    const tree = await loadDeviceTree("https://example.invalid", "site-a", options);
    assert.equal(tree.sourceStatus.catalog.ok, false);
    assert.equal(tree.sourceStatus.catalog.reasonCode, "STATION_DEVICE_IDS_AMBIGUOUS");
    assert.equal(tree.sourceStatus.tree.reasonCode, "STATION_DEVICE_IDS_AMBIGUOUS");
    assert.equal(tree.root, null);
    assert.deepEqual(tree.catalogRows, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("station tree falls back only to the filtered real catalog and never placeholder data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/device/station-db/data/tree")) {
      return createJsonResponse({ data: [] });
    }
    if (url.includes("/zsqy/drinfo/station-db/findObject")) {
      return createJsonResponse({
        data: [
          { drid: "1", drcode: "CH1", drname: "1#冷机", drtypename: "主机" },
          { drid: "2", drcode: "CH2", drname: "2#冷机", drtypename: "主机" }
        ]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceTree("https://example.invalid", "site-a", {
      databaseKey: "station-db",
      allowedDeviceIds: ["2"],
      allowedDeviceCodes: ["CH2"],
      placeholderFallback: false
    });
    const devices = (result.root?.children || []).flatMap((group) => group.children || []);

    assert.deepEqual(devices.map((item) => item.deviceIdRef), ["2"]);
    assert.deepEqual(result.catalogRows.map((item) => item.deviceId), ["2"]);
    assert.equal(result.sourceStatus.placeholder, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("station detail keeps placeholder fallback disabled when the real catalog is empty", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/device/station-db/data/tree")) {
      return createJsonResponse({ data: [] });
    }
    if (url.includes("/zsqy/drinfo/station-db/findObject")) {
      return createJsonResponse({ data: [] });
    }
    if (url.includes("/zsqy/reg/station-db/findObject")) {
      return createJsonResponse({ data: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceDetail("https://example.invalid", "site-a", "1", {
      databaseKey: "station-db",
      allowedDeviceIds: ["1"],
      allowedDeviceCodes: ["CH1"],
      placeholderFallback: false
    });

    assert.equal(result.detail, null);
    assert.equal(result.sourceStatus.placeholder, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("station detail rejects mixed-device registers even when upstream ignores the drId query", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/device/station-db/data/tree")) {
      return createJsonResponse({ data: [] });
    }
    if (url.includes("/zsqy/drinfo/station-db/findObject")) {
      return createJsonResponse({
        data: [{ drid: "1", drcode: "CH1", drname: "1#冷机", drtypename: "主机", typeYT: "1" }]
      });
    }
    if (url.includes("/zsqy/reg/station-db/findObject")) {
      return createJsonResponse({
        data: [{ drId: "OUTSIDE", tagName: "CH1-RUN", regName: "运行", newtagvalue: "1" }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceDetail("https://example.invalid", "site-a", "1", {
      databaseKey: "station-db",
      allowedDeviceIds: ["1"],
      allowedDeviceCodes: ["CH1"],
      allowedPointCodes: ["CH1-RUN"],
      placeholderFallback: false
    });

    assert.equal(result.detail?.deviceId, "1");
    assert.equal(result.detail?.runStatusText, null);
    assert.equal(result.sourceStatus.runtime?.ok, false);
    assert.equal(result.sourceStatus.runtime?.rows, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadDeviceTree prefers configured realtime collection endpoint over legacy tree endpoint", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "7",
            drname: "1#冷水机组",
            drtypename: "主机",
            drcode: "CH1"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({
        data: [
          {
            drid: "7",
            drname: "1#冷水机组",
            drtypename: "主机",
            drcode: "CH1",
            reglist: [
              {
                regName: "运行",
                tagValue: "1",
                tagTime: "2026-04-09 17:00:00"
              },
              {
                regName: "通讯报警",
                tagValue: "0",
                tagTime: "2026-04-09 17:00:00"
              }
            ]
          }
        ]
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceTree("https://www.ssge.com.cn:8098", "140", {
      projectKey: "140btwentyfive",
      realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
      build: "1",
      floor: "0",
      placeholderFallback: true
    });

    assert.equal(
      result.sourceStatus?.tree?.endpoint,
      "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
    );
    assert.equal(result.sourceStatus?.tree?.ok, true);
    assert.equal(result.filters?.floor, 0);
    assert.equal(result.root?.children?.[0]?.children?.[0]?.status, "running");
    assert.deepEqual(requests, [
      "https://www.ssge.com.cn:8098/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadDeviceDetail maps cooling tower runtime from cooling tower fan proxies in realtime collection", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "53",
            drname: "1#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT1",
            drUseExplain: "1#冷却塔",
            typeYT: "1"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({
        data: [
          {
            drid: "53",
            drname: "1#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT1",
            reglist: [
              {
                regName: "功率",
                tagValue: "10.5",
                tagTime: "2026-04-09 17:00:00"
              }
            ]
          },
          {
            drid: "13",
            drname: "1#冷却塔风机1",
            drtypename: "冷却塔风机",
            drcode: "CTF11",
            reglist: [
              {
                regName: "运行",
                newtagvalue: "1",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              },
              {
                regName: "故障",
                newtagvalue: "0",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              },
              {
                regName: "远程",
                newtagvalue: "1",
                tagTime: "2026-04-09 17:05:00"
              }
            ]
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=53")) {
      return createJsonResponse({
        data: {
          records: [
            {
              regName: "功率",
              newtagvalue: "10.5",
              tagTime: "2026-04-09 17:00:00"
            }
          ]
        }
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceDetail("https://www.ssge.com.cn:8098", "140", "53", {
      projectKey: "140btwentyfive",
      realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
      build: "1",
      floor: "0",
      placeholderFallback: true
    });

    assert.equal(result.detail?.deviceName, "1#冷却塔");
    assert.equal(result.detail?.runStatusText, "运行中");
    assert.equal(result.detail?.alarmStatusText, "正常");
    assert.equal(
      result.sourceStatus?.runtime?.endpoint,
      "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
    );
    assert.equal(result.sourceStatus?.runtime?.fallback, true);
    assert.match(String(result.sourceStatus?.runtime?.message), /cooling tower runtime mapped from 1 fan points/);
    assert.deepEqual(requests, [
      "https://www.ssge.com.cn:8098/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=53"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadDeviceDetails reuses shared tree sources for multiple cooling towers", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "53",
            drname: "1#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT1",
            drUseExplain: "1#冷却塔",
            typeYT: "1"
          },
          {
            drid: "54",
            drname: "2#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT2",
            drUseExplain: "2#冷却塔",
            typeYT: "1"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({
        data: [
          {
            drid: "53",
            drname: "1#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT1",
            reglist: [
              {
                regName: "功率",
                tagValue: "10.5",
                tagTime: "2026-04-09 17:00:00"
              }
            ]
          },
          {
            drid: "54",
            drname: "2#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT2",
            reglist: [
              {
                regName: "功率",
                tagValue: "12.0",
                tagTime: "2026-04-09 17:00:00"
              }
            ]
          },
          {
            drid: "13",
            drname: "1#冷却塔风机1",
            drtypename: "冷却塔风机",
            drcode: "CTF11",
            reglist: [
              {
                regName: "运行",
                newtagvalue: "1",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              }
            ]
          },
          {
            drid: "19",
            drname: "2#冷却塔风机1",
            drtypename: "冷却塔风机",
            drcode: "CTF21",
            reglist: [
              {
                regName: "运行",
                newtagvalue: "0",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              }
            ]
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=53")) {
      return createJsonResponse({
        data: {
          records: [
            {
              regName: "功率",
              newtagvalue: "10.5",
              tagTime: "2026-04-09 17:00:00"
            }
          ]
        }
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=54")) {
      return createJsonResponse({
        data: {
          records: [
            {
              regName: "功率",
              newtagvalue: "12.0",
              tagTime: "2026-04-09 17:00:00"
            }
          ]
        }
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceDetails("https://www.ssge.com.cn:8098", "140", ["53", "54"], {
      projectKey: "140btwentyfive",
      realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
      build: "1",
      floor: "0",
      placeholderFallback: true,
      batchSize: 2
    });

    assert.equal(result.items?.length, 2);
    assert.equal(result.items?.[0]?.detail?.runStatusText, "运行中");
    assert.equal(result.items?.[1]?.detail?.runStatusText, "已停止");
    assert.deepEqual(requests, [
      "https://www.ssge.com.cn:8098/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=53",
      "https://www.ssge.com.cn:8098/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=54"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadDeviceDetail does not mark cooling tower running when fan run signals are 0 and frequency noise is below fallback threshold", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "57",
            drname: "5#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT5",
            drUseExplain: "5#冷却塔",
            typeYT: "1"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({
        data: [
          {
            drid: "57",
            drname: "5#冷却塔",
            drtypename: "冷却塔组",
            drcode: "CT5",
            reglist: [
              {
                regName: "功率",
                tagValue: "0.0",
                tagTime: "2026-04-09 17:00:00"
              }
            ]
          },
          {
            drid: "37",
            drname: "5#冷却塔风机1",
            drtypename: "冷却塔风机",
            drcode: "CTF51",
            reglist: [
              {
                regName: "运行",
                newtagvalue: "0",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              },
              {
                regName: "故障",
                newtagvalue: "0",
                showStatus: "0",
                tagTime: "2026-04-09 17:05:00"
              },
              {
                regName: "频率反馈",
                newtagvalue: "1.0",
                tagTime: "2026-04-09 17:05:00"
              }
            ]
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=200&drId=57")) {
      return createJsonResponse({
        data: {
          records: [
            {
              regName: "功率",
              newtagvalue: "0.0",
              tagTime: "2026-04-09 17:00:00"
            }
          ]
        }
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await loadDeviceDetail("https://www.ssge.com.cn:8098", "140", "57", {
      projectKey: "140btwentyfive",
      realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
      build: "1",
      floor: "0",
      placeholderFallback: true
    });

    assert.equal(result.detail?.deviceName, "5#冷却塔");
    assert.equal(result.detail?.runStatusText, "已停止");
    assert.equal(result.detail?.alarmStatusText, "正常");
    assert.match(String(result.sourceStatus?.runtime?.message), /cooling tower runtime mapped from 1 fan points/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

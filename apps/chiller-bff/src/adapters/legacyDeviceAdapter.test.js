import test from "node:test";
import assert from "node:assert/strict";

import { loadDeviceDetail, loadDeviceDetails, loadDeviceTree } from "./legacyDeviceAdapter.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

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

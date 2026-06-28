import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuntimePointSummary,
  getFanCoilTerminalSnapshot,
  resolveDeviceProjectKey,
  resolveDeviceQueryDefaults,
  resolveDeviceRealtimeInterface
} from "./deviceService.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function runtimeRow({ drcode, drname, drtypename = "", regs = [] }) {
  return {
    drcode,
    drname,
    drtypename,
    reglist: regs.map(([regName, value]) => ({
      regName,
      newtagvalue: value
    }))
  };
}

const b25PointDictionary = {
  source: "test_b25_dictionary",
  deviceSelectors: {
    chilledPumps: {
      codePatterns: ["^CHP\\d+$"],
      namePatterns: ["^\\d+#冷冻泵$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|支路|旁通"]
    },
    coolingPumps: {
      codePatterns: ["^CWP\\d+$"],
      namePatterns: ["^\\d+#冷却泵$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|支路|旁通"]
    },
    coolingTowers: {
      codePatterns: ["^CT\\d+$"],
      namePatterns: ["^\\d+#冷却塔$", "^\\d+#冷却塔风机$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|开到位|关到位"]
    }
  },
  branchLabels: {
    allowedNamePatterns: ["支路\\s*\\d+", "\\bB\\d{1,2}\\b"],
    excludePatterns: ["累计", "冷却塔", "冷却泵", "冷冻泵", "主机"]
  },
  coolingTowerCellLabels: {
    allowedNamePatterns: ["^CT\\d+\\b", "\\d+\\s*#?\\s*冷却塔"],
    excludePatterns: ["阀|开到位|关到位"]
  }
};

test("resolveDeviceQueryDefaults falls back to site source config defaults", () => {
  const config = {
    siteSourceConfig: {
      defaultDeviceQuery: {
        build: 1,
        floor: 0,
        mock: false
      }
    }
  };

  const result = resolveDeviceQueryDefaults(config, {});
  assert.deepEqual(result, {
    build: "1",
    floor: "0",
    mock: false
  });
});

test("resolveDeviceQueryDefaults preserves explicit query overrides", () => {
  const config = {
    siteSourceConfig: {
      defaultDeviceQuery: {
        build: 1,
        floor: 0,
        mock: false
      }
    }
  };

  const result = resolveDeviceQueryDefaults(config, {
    build: "2",
    floor: "6",
    mock: "true"
  });
  assert.deepEqual(result, {
    build: "2",
    floor: "6",
    mock: true
  });
});

test("resolveDeviceProjectKey prefers explicit request projectKey when configured", () => {
  const config = {
    siteSourceConfig: {
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  const result = resolveDeviceProjectKey(config, {
    projectKey: "126lnoffice"
  });

  assert.equal(result, "126lnoffice");
});

test("resolveDeviceProjectKey falls back to configured projectKey when explicit key is missing", () => {
  const config = {
    siteSourceConfig: {
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  const result = resolveDeviceProjectKey(config, {});

  assert.equal(result, "140btwentyfive");
});

test("resolveDeviceProjectKey falls back to explicit projectKey when no configured project key", () => {
  const config = {
    siteSourceConfig: {}
  };

  const result = resolveDeviceProjectKey(config, {
    projectKey: "126lnoffice"
  });

  assert.equal(result, "126lnoffice");
});

test("resolveDeviceRealtimeInterface returns configured project data interface", () => {
  const config = {
    siteSourceConfig: {
      deviceDataInterfaces: [
        {
          endpointKind: "legacy-reg-findAllByDrTypeId",
          endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
        }
      ]
    }
  };

  const result = resolveDeviceRealtimeInterface(config);

  assert.equal(result?.endpointKind, "legacy-reg-findAllByDrTypeId");
});

test("getFanCoilTerminalSnapshot maps 10F fan coil runtime and keeps write points disabled", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "19",
            drname: "办公室01",
            drtypename: "风机盘管",
            drcode: "BGS01"
          },
          {
            drid: "20",
            drname: "办公室02",
            drtypename: "风机盘管",
            drcode: "BGS02"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=1")) {
      return createJsonResponse({
        status: "20000",
        msg: "OK",
        data: [
          {
            drid: "19",
            drname: "办公室01",
            drtypename: "风机盘管",
            drcode: "BGS01",
            reglist: {
              reglist: [
                { regName: "运行", tagName: "BGS01-502-40069", tagValue: "1", regReadWrite: "1", tagTime: "5" },
                { regName: "通讯报警", tagName: "BGS01-502-40070", tagValue: "0", tagAlarmState: "0", regReadWrite: "1", tagTime: "5" },
                { regName: "内置温度", tagName: "BGS01-506-40187", tagValue: "26.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "阀门状态", tagName: "BGS01-506-40189", tagValue: "1.0", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度反馈", tagName: "BGS01-506-40191", tagValue: "24.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度", tagName: "BGS01-508-40133", tagValue: "20.0", regUnits: "℃", regReadWrite: "2", tagTime: "5" }
              ]
            }
          },
          {
            drid: "20",
            drname: "办公室02",
            drtypename: "风机盘管",
            drcode: "BGS02",
            reglist: {
              reglist: [
                { regName: "运行", tagName: "BGS02-502-40073", tagValue: "0", regReadWrite: "1", tagTime: "5" },
                { regName: "通讯报警", tagName: "BGS02-502-40074", tagValue: "1", tagAlarmState: "1", regReadWrite: "1", tagTime: "5" },
                { regName: "内置温度", tagName: "BGS02-506-40203", tagValue: "27.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "阀门状态", tagName: "BGS02-506-40205", tagValue: "0.0", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度", tagName: "BGS02-508-40149", tagValue: "20.0", regUnits: "℃", regReadWrite: "2", tagTime: "5" }
              ]
            }
          }
        ]
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await getFanCoilTerminalSnapshot({
      legacyBaseUrl: "https://www.ssge.com.cn:8098",
      staleThresholdHours: 1,
      siteSourceConfig: {
        deviceDataProjectKey: "126lnoffice",
        databaseKey: "126lnoffice"
      }
    }, "126lnoffice", {
      build: "1",
      floor: "1"
    });

    assert.equal(result.subsystemType, "hvac_terminal");
    assert.equal(result.equipmentType, "fan_coil");
    assert.equal(result.floorName, "10楼");
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.runningCount, 1);
    assert.equal(result.summary.communicationAlarmCount, 1);
    assert.equal(result.summary.comfortEligibleCount, 1);
    assert.equal(result.summary.excludedFromComfortStatsCount, 1);
    assert.equal(result.summary.averageZoneTemperatureC, 26);
    assert.equal(result.summary.averageValveOpenPct, 50);
    assert.equal(result.summary.qualityStatus, "attention");
    assert.equal(result.items[0].deviceCode, "BGS01");
    assert.equal(result.items[0].zoneTemperatureC, 26);
    assert.equal(result.items[0].quality.status, "ok");
    assert.equal(result.items[1].quality.status, "invalid");
    assert.deepEqual(result.items[1].quality.flags, ["communication_alarm", "stopped"]);
    assert.equal(result.items[0].points.setpoint.writable, true);
    assert.equal(result.items[0].points.setpoint.writeAllowed, false);
    assert.equal(result.items[0].rawTagTime, "5");
    assert.equal(result.timestampBasis, "bff_fetch_time");
    assert.equal(result.sourceStatus.overall, "ok");
    assert.deepEqual(requests, [
      "https://www.ssge.com.cn:8098/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200",
      "https://www.ssge.com.cn:8098/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildRuntimePointSummary applies 140/B25 point dictionary before generic keyword matching", () => {
  const rows = [
    runtimeRow({
      drcode: "CHP4",
      drname: "4#冷冻泵",
      regs: [
        ["运行", 1],
        ["频率反馈", 40],
        ["功率", 37]
      ]
    }),
    runtimeRow({
      drcode: "CHPV4",
      drname: "4#冷冻泵出口阀",
      regs: [
        ["运行", 1],
        ["开到位", 1]
      ]
    }),
    runtimeRow({
      drcode: "CWP5",
      drname: "5#冷却泵",
      regs: [
        ["运行", 1],
        ["频率反馈", 38],
        ["功率", 30]
      ]
    }),
    runtimeRow({
      drcode: "CWPV5",
      drname: "5#冷却泵出口阀",
      regs: [["开到位", 1]]
    }),
    runtimeRow({
      drcode: "CT1",
      drname: "1#冷却塔风机",
      regs: [
        ["运行", 1],
        ["频率反馈", 33],
        ["功率", 4]
      ]
    }),
    runtimeRow({
      drcode: "CTV2",
      drname: "2#冷却塔进水阀",
      regs: [
        ["开到位", 1],
        ["关到位", 0]
      ]
    }),
    runtimeRow({
      drcode: "B25-BR1",
      drname: "支路1冷冻水",
      regs: [
        ["累计流量", 999999],
        ["回水流量", 1220],
        ["供水温度", 8.4],
        ["回水温度", 12.7],
        ["回水压力", 398]
      ]
    }),
    runtimeRow({
      drcode: "B12-FM",
      drname: "B12冷冻回水流量计",
      regs: [
        ["累计流量", 880000],
        ["瞬时流量", 333]
      ]
    }),
    runtimeRow({
      drcode: "CTFM1",
      drname: "1#冷却塔流量计",
      regs: [["流量", 105]]
    })
  ];

  const summary = buildRuntimePointSummary(rows, [], {
    operationalDiagnosticsPointDictionary: b25PointDictionary
  });

  assert.equal(summary.basis, "legacy_realtime_register_summary_with_site_dictionary");
  assert.equal(summary.pointDictionary.applied, true);
  assert.equal(summary.counts.chilledPumpCount, 1);
  assert.equal(summary.counts.runningChilledPumpCount, 1);
  assert.equal(summary.counts.coolingPumpCount, 1);
  assert.equal(summary.counts.runningCoolingPumpCount, 1);
  assert.equal(summary.counts.coolingTowerCount, 1);
  assert.equal(summary.counts.runningCoolingTowerCount, 1);
  assert.equal(summary.counts.coolingTowerFanCount, 1);
  assert.equal(summary.counts.runningCoolingTowerFanCount, 1);
  assert.deepEqual(summary.groups.chilledPumps.map((item) => item.id), ["CHP4"]);
  assert.deepEqual(summary.groups.coolingPumps.map((item) => item.id), ["CWP5"]);
  assert.deepEqual(summary.groups.coolingTowers.map((item) => item.id), ["CT1"]);

  const branch1 = summary.groups.branches.find((item) => item.label === "支路1");
  const b12 = summary.groups.branches.find((item) => item.label === "B12");
  assert.equal(branch1?.flowM3h, 1220);
  assert.equal(branch1?.deltaTC, 4.3);
  assert.equal(b12?.flowM3h, 333);
  assert.equal(summary.groups.branches.some((item) => item.flowM3h === 999999 || item.flowM3h === 880000), false);

  assert.deepEqual(summary.groups.coolingTowerCells.map((item) => item.label), ["CT1"]);
  assert.equal(summary.groups.coolingTowerCells[0]?.flowM3h, 105);
});

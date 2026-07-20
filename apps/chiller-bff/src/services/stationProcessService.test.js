import assert from "node:assert/strict";
import test from "node:test";

import { buildStationProcessSummary } from "./stationProcessService.js";

function point(pointKey, value, unit, overrides = {}) {
  return {
    pointKey,
    tagName: pointKey,
    value,
    unit,
    qualityCode: "GOOD",
    observedAt: "2026-07-19T08:00:00.000Z",
    authoritativeTimestamp: true,
    deviceId: "301",
    deviceCode: "AIR-01",
    ...overrides
  };
}

test("station process summary derives compressed-air metrics only from exact mapped points", () => {
  const summary = buildStationProcessSummary({
    binding: {
      siteId: "site-a",
      stationId: "air-01",
      stationName: "空压站 1",
      parentSubsystemType: "compressed_air",
      bindingVersion: 2,
      selectors: {
        deviceIds: ["301"],
        pointCodes: ["AIR-POWER", "AIR-PRESSURE", "AIR-FLOW", "AIR-RUN", "AIR-ALARM"]
      }
    },
    runtimeSummary: {
      pointEvidence: {
        points: [
          point("AIR-POWER", 286, "kW"),
          point("AIR-PRESSURE", 0.68, "bar"),
          point("AIR-FLOW", 49.2, "Nm3/min"),
          point("AIR-RUN", 1, ""),
          point("AIR-ALARM", 0, ""),
          point("UNBOUND-POWER", 9999, "kW")
        ]
      }
    },
    pointMappings: [
      { mappingId: "1", pointRole: "power", pointName: "空压站总功率", pointCode: "AIR-POWER", unit: "kW", required: true },
      { mappingId: "2", pointRole: "pressure", pointName: "管网压力", pointCode: "AIR-PRESSURE", unit: "bar", required: true },
      { mappingId: "3", pointRole: "flow", pointName: "供气流量", pointCode: "AIR-FLOW", unit: "Nm3/min", required: true },
      { mappingId: "4", pointRole: "status", pointName: "运行状态", pointCode: "AIR-RUN", unit: "", required: true },
      { mappingId: "5", pointRole: "alarm", pointName: "空压站告警", pointCode: "AIR-ALARM", unit: "", required: true },
      { mappingId: "6", pointRole: "power", pointName: "未绑定功率", pointCode: "UNBOUND-POWER", unit: "kW" }
    ],
    requiredPointRoles: [
      { role: "power", required: true },
      { role: "pressure", required: true },
      { role: "flow", required: true },
      { role: "status", required: true },
      { role: "alarm", required: true }
    ]
  });

  assert.equal(summary.readiness, "ready");
  assert.equal(summary.timestampStatus, "authoritative");
  assert.equal(summary.metrics.compressedAir.powerKw, 286);
  assert.equal(summary.metrics.compressedAir.pressureBar, 0.68);
  assert.equal(summary.metrics.compressedAir.flowNm3Min, 49.2);
  assert.equal(summary.metrics.compressedAir.specificEnergyKwhNm3, 0.0969);
  assert.equal(summary.roleMeasurements.some((item) => item.pointCode === "UNBOUND-POWER"), false);
  assert.equal(summary.operatingState.runningPointCount, 1);
  assert.equal(summary.operatingState.activeAlarmPointCount, 0);
});

test("station process summary remains partial when required evidence is missing", () => {
  const summary = buildStationProcessSummary({
    binding: {
      siteId: "site-a",
      stationId: "boiler-01",
      stationName: "锅炉房 1",
      parentSubsystemType: "boiler_room",
      bindingVersion: 1,
      selectors: { deviceIds: ["401"], pointCodes: ["BOILER-PRESSURE"] }
    },
    runtimeSummary: {
      pointEvidence: {
        points: [point("BOILER-PRESSURE", 8.2, "bar", { authoritativeTimestamp: false, observedAt: null })]
      }
    },
    pointMappings: [
      { pointRole: "pressure", pointName: "系统压力", pointCode: "BOILER-PRESSURE", unit: "MPa", required: true }
    ],
    requiredPointRoles: [
      { role: "pressure", required: true },
      { role: "flow", required: true }
    ]
  });

  assert.equal(summary.readiness, "partial");
  assert.equal(summary.timestampStatus, "unverified");
  assert.deepEqual(summary.missingRequiredRoles, ["flow"]);
  assert.equal(summary.metrics.boilerRoom.pressureMpa, 0.82);
  assert.equal(summary.metrics.boilerRoom.thermalMediumFlow, null);
});

test("station process summary ignores unsupported station types", () => {
  assert.equal(buildStationProcessSummary({ binding: { parentSubsystemType: "chilled_plant" } }), null);
});

import test from "node:test";
import assert from "node:assert/strict";

import { createAdminStore } from "./admin-db.js";

test("admin store appends and lists chiller staging samples", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  try {
    const actor = { userId: "platform-admin", username: "Platform Admin" };
    adminStore.createSite({ siteId: "140", siteName: "B25" }, actor, {});

    const first = adminStore.createChillerStagingSample(
      "140",
      {
        combination: ["CH4", "CH5", "CH7"],
        loadKw: 9548,
        loadRatePct: 69.6,
        wetBulbC: 21.8,
        stationPowerKw: 1358.9,
        chillerPowerKw: 1101,
        comboCop: 8.67,
        stationCop: 7.03,
        kwPerRt: 0.501,
        sampleMinutes: 5,
        alarmCount: 0,
        capturedAt: "2026-06-10T05:10:00.000Z",
        source: "current_realtime_snapshot"
      },
      actor,
      { requestId: "req-sample-1" }
    );
    const second = adminStore.createChillerStagingSample(
      "140",
      {
        combination: ["CH4", "CH5", "CH7"],
        loadKw: 9560,
        wetBulbC: 21.9,
        stationPowerKw: 1360,
        chillerPowerKw: 1103,
        sampleMinutes: 5,
        capturedAt: "2026-06-10T05:15:00.000Z"
      },
      actor,
      { requestId: "req-sample-2" }
    );

    assert.notEqual(first.sampleId, second.sampleId);
    assert.equal(first.combinationKey, "CH4+CH5+CH7");
    assert.equal(first.sample.includedInHistory, true);
    assert.equal(first.sample.persistedSample, true);
    assert.deepEqual(first.sample.combination, ["CH4", "CH5", "CH7"]);

    const list = adminStore.listChillerStagingSamples("140", {
      combinationKey: "CH4+CH5+CH7",
      limit: 10
    });
    assert.equal(list.total, 2);
    assert.equal(list.items.length, 2);
    assert.equal(list.items[0].capturedAt, "2026-06-10T05:15:00.000Z");
    assert.equal(list.items[1].capturedAt, "2026-06-10T05:10:00.000Z");
    assert.equal(list.items[0].sample.stationCop, 7.03);

    const latest = adminStore.getLatestChillerStagingSample("140", {
      combinationKey: "CH4+CH5+CH7"
    });
    assert.equal(latest.sampleId, second.sampleId);
  } finally {
    adminStore.close();
  }
});

test("admin store appends and filters shadow verification records", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  try {
    const actor = { userId: "platform-admin", username: "Platform Admin" };
    adminStore.createSite({ siteId: "140", siteName: "B25" }, actor, {});

    const first = adminStore.createShadowVerificationRecord(
      "140",
      {
        executionId: "opx-140-shadow-1",
        verificationType: "chiller-staging",
        targetLabel: "CH4 + CH5 + CH7",
        outcome: "improved",
        windowMinutes: 45,
        metrics: {
          loadKw: 11688.7,
          wetBulbC: 24.3,
          stationCop: 6.9,
          comboCop: 7.4,
          kwPerRt: 0.52,
          stationPowerKw: 1739.2,
          chillerPowerKw: 1510.4,
          alarmCount: 0
        },
        note: "同负荷湿球窗口表现改善。",
        recordedAt: "2026-06-12T08:00:00.000Z"
      },
      actor,
      { requestId: "req-shadow-verification-1" }
    );
    const second = adminStore.createShadowVerificationRecord(
      "140",
      {
        executionId: "opx-140-shadow-2",
        verificationType: "tower-approach",
        targetLabel: "Tcws 28.0℃",
        outcome: "neutral",
        windowMinutes: 30,
        metrics: {
          stationCop: 6.8,
          alarmCount: 0
        },
        recordedAt: "2026-06-12T08:30:00.000Z"
      },
      actor,
      { requestId: "req-shadow-verification-2" }
    );

    assert.notEqual(first.recordId, second.recordId);
    assert.equal(first.appendOnly, undefined);
    assert.equal(first.payload.appendOnly, true);
    assert.equal(first.payload.controlMutation, false);
    assert.equal(first.metrics.stationCop, 6.9);
    assert.equal(first.outcome, "improved");

    const all = adminStore.listShadowVerificationRecords("140", { limit: 10 });
    assert.equal(all.total, 2);
    assert.equal(all.items.length, 2);
    assert.equal(all.items[0].recordId, second.recordId);

    const filtered = adminStore.listShadowVerificationRecords("140", {
      executionId: "opx-140-shadow-1",
      limit: 10
    });
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].recordId, first.recordId);

    assert.throws(
      () =>
        adminStore.createShadowVerificationRecord(
          "140",
          {
            outcome: "auto-dispatch"
          },
          actor,
          {}
        ),
      /outcome is invalid/
    );
  } finally {
    adminStore.close();
  }
});

test("admin store appends hvac terminal samples with interval guard and timeline summary", () => {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  try {
    const actor = { userId: "platform-admin", username: "Platform Admin" };
    adminStore.createSite({ siteId: "126lnoffice", siteName: "盛世绿能办公楼" }, actor, {});

    const snapshot = {
      building: "盛世绿能办公楼",
      floor: "1",
      floorName: "10楼",
      sampledAt: "2026-06-17T12:00:00.000Z",
      summary: {
        dataStatus: "ok"
      },
      items: [
        {
          deviceId: "19",
          deviceCode: "BGS01",
          deviceName: "办公室01",
          floorName: "10楼",
          sampledAt: "2026-06-17T12:00:00.000Z",
          zoneTemperatureC: 26,
          setpointC: 24,
          running: true,
          valveOpen: true,
          valveOpenPct: 100,
          fanSpeedState: 1,
          communicationAlarm: false,
          quality: {
            status: "ok",
            flags: [],
            comfortEligible: true
          }
        },
        {
          deviceId: "20",
          deviceCode: "BGS02",
          deviceName: "办公室02",
          floorName: "10楼",
          sampledAt: "2026-06-17T12:00:00.000Z",
          zoneTemperatureC: 0,
          setpointC: 20,
          running: false,
          valveOpen: false,
          valveOpenPct: 0,
          fanSpeedState: 0,
          communicationAlarm: true,
          quality: {
            status: "invalid",
            flags: ["zero_temperature", "invalid_temperature", "communication_alarm", "stopped"],
            comfortEligible: false
          }
        }
      ]
    };

    const first = adminStore.appendHvacTerminalSnapshotSamples("126lnoffice", snapshot, actor, {
      floor: "1",
      minIntervalSeconds: 60,
      requestId: "req-hvac-1"
    });
    assert.equal(first.status, "recorded");
    assert.equal(first.inserted, 2);

    const duplicate = adminStore.appendHvacTerminalSnapshotSamples("126lnoffice", snapshot, actor, {
      floor: "1",
      minIntervalSeconds: 60,
      requestId: "req-hvac-2"
    });
    assert.equal(duplicate.status, "skipped_recent");
    assert.equal(duplicate.inserted, 0);

    const list = adminStore.listHvacTerminalSamples("126lnoffice", { floor: "1", limit: 10 });
    assert.equal(list.total, 2);
    assert.equal(list.items.some((item) => item.deviceCode === "BGS01"), true);
    assert.equal(list.items.find((item) => item.deviceCode === "BGS02")?.communicationAlarm, true);

    const timeline = adminStore.listHvacTerminalSampleTimeline("126lnoffice", { floor: "1", limit: 10 });
    assert.equal(timeline.items.length, 1);
    assert.equal(timeline.items[0].total, 2);
    assert.equal(timeline.items[0].comfortEligibleCount, 1);
    assert.equal(timeline.items[0].communicationAlarmCount, 1);
    assert.equal(timeline.items[0].zeroTemperatureCount, 1);
    assert.equal(timeline.items[0].averageZoneTemperatureC, 26);
  } finally {
    adminStore.close();
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  dispatchFcuControlCycle,
  evaluateFcuControlCycle,
  evaluateFcuDeviceCommissioningStatus,
  evaluateManualFcuControlCommand,
  normalizeFcuControlPolicy,
  verifyFcuControlRecordFeedback
} from "./fcuControlService.js";

function buildFcu(overrides = {}) {
  return {
    deviceCode: "FCU-01",
    deviceName: "办公室01-BGS01",
    zoneTemperatureC: 27.5,
    setpointC: 25,
    setpointFeedbackC: 25,
    running: true,
    communicationAlarm: false,
    quality: {
      status: "ok",
      flags: []
    },
    points: {
      setpoint: {
        writable: true,
        pointName: "设置温度",
        tagName: "TAG_SETPOINT"
      },
      fanSpeedMode: {
        writable: true,
        pointName: "风速模式",
        tagName: "TAG_FAN_SPEED"
      },
      manualStart: {
        writable: true,
        pointName: "手动启动",
        tagName: "TAG_START"
      },
      manualStop: {
        writable: true,
        pointName: "手动停止",
        tagName: "TAG_STOP"
      }
    },
    ...overrides
  };
}

function buildSnapshot(items) {
  return {
    site: {
      siteId: "126lnoffice"
    },
    items
  };
}

test("FCU control blocks invalid temperature and communication alarm", () => {
  const policy = normalizeFcuControlPolicy({
    defaultMode: "enforced",
    whitelist: ["FCU-01"]
  });
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([
      buildFcu({
        zoneTemperatureC: 0,
        communicationAlarm: true,
        quality: {
          status: "invalid",
          flags: ["zero_temperature", "invalid_temperature"]
        }
      })
    ]),
    policy,
    []
  );

  assert.equal(cycle.summary.blockedCount, 1);
  assert.equal(cycle.decisions[0].status, "blocked");
  assert.ok(cycle.decisions[0].blockReasons.includes("communication_alarm"));
  assert.ok(cycle.decisions[0].blockReasons.includes("invalid_temperature"));
  assert.equal(cycle.decisions[0].dispatch.controlMutation, false);
});

test("FCU enforced mode requires whitelist before command generation", () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: []
    }),
    []
  );

  assert.equal(cycle.decisions[0].status, "blocked");
  assert.ok(cycle.decisions[0].blockReasons.includes("not_whitelisted"));
  assert.equal(cycle.summary.commandCount, 0);
});

test("FCU commissioning reports device-ready while global gate blocks dispatch", () => {
  const status = evaluateFcuDeviceCommissioningStatus(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      dispatchAdapter: "legacy-scene-command",
      whitelist: ["FCU-01"]
    }),
    [],
    {
      executionGate: {
        dispatchAllowed: false,
        blockedReasons: ["backend_not_readonly"]
      }
    }
  );

  assert.equal(status.deviceReady, true);
  assert.equal(status.canDispatch, false);
  assert.equal(status.status, "environment_blocked");
  assert.equal(status.conditions.find((item) => item.key === "global_execution_gate")?.ok, false);
  assert.equal(status.conditions.find((item) => item.key === "setpoint_writable")?.ok, true);
});

test("FCU commissioning blocks invalid single-device quality", () => {
  const status = evaluateFcuDeviceCommissioningStatus(
    buildSnapshot([
      buildFcu({
        zoneTemperatureC: 0,
        communicationAlarm: true,
        quality: {
          status: "invalid",
          flags: ["invalid_temperature"]
        }
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"]
    }),
    [],
    {
      executionGate: {
        dispatchAllowed: true
      }
    }
  );

  assert.equal(status.deviceReady, false);
  assert.equal(status.canDispatch, false);
  assert.equal(status.status, "blocked");
  assert.ok(status.controlBlockReasons.includes("communication_alarm"));
  assert.equal(status.conditions.find((item) => item.key === "temperature_valid")?.ok, false);
});

test("FCU commissioning blocks out-of-bounds setpoint feedback before closed-loop control", () => {
  const status = evaluateFcuDeviceCommissioningStatus(
    buildSnapshot([
      buildFcu({
        setpointFeedbackC: 35
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      minSetpointC: 22,
      maxSetpointC: 28
    }),
    [],
    {
      executionGate: {
        dispatchAllowed: true
      }
    }
  );

  assert.equal(status.deviceReady, false);
  assert.equal(status.canDispatch, false);
  assert.equal(status.status, "blocked");
  assert.ok(status.controlBlockReasons.includes("setpoint_feedback_out_of_bounds"));
  assert.equal(status.conditions.find((item) => item.key === "setpoint_feedback_valid")?.ok, false);
});

test("FCU shadow mode generates setpoint advice without control mutation", () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "shadow"
    }),
    []
  );

  assert.equal(cycle.decisions[0].status, "shadow");
  assert.equal(cycle.decisions[0].actionKind, "setpoint");
  assert.equal(cycle.decisions[0].commands[0].value, 24.5);
  assert.equal(cycle.decisions[0].dispatch.status, "shadow_only");
  assert.equal(cycle.decisions[0].dispatch.controlMutation, false);
});

test("FCU control blocks out-of-bounds setpoint feedback instead of issuing a large clamp", () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([
      buildFcu({
        zoneTemperatureC: 31,
        setpointFeedbackC: 35
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command",
      minSetpointC: 22,
      maxSetpointC: 28,
      dailyMaxSetpointShiftC: 0
    }),
    []
  );

  assert.equal(cycle.summary.blockedCount, 1);
  assert.equal(cycle.summary.commandCount, 0);
  assert.equal(cycle.decisions[0].status, "blocked");
  assert.ok(cycle.decisions[0].blockReasons.includes("setpoint_feedback_out_of_bounds"));
});

test("FCU enforced mode records command but blocks dispatch without adapter", () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "none"
    }),
    []
  );

  assert.equal(cycle.decisions[0].status, "blocked");
  assert.equal(cycle.decisions[0].commands.length, 1);
  assert.equal(cycle.decisions[0].dispatch.code, "dispatch_adapter_missing");
  assert.equal(cycle.decisions[0].dispatch.controlMutation, false);
});

test("FCU dispatch sends ready enforced commands through adapter", async () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([
      buildFcu({
        deviceId: "1001",
        deviceTypeId: "2001"
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command"
    }),
    []
  );
  const calls = [];
  const dispatched = await dispatchFcuControlCycle(cycle, {
    dispatchCommand: async (command) => {
      calls.push(command);
      return {
        ok: true,
        status: 200,
        message: "OK",
        command
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].drId, "1001");
  assert.equal(calls[0].drTypeId, "2001");
  assert.equal(calls[0].regName, "设置温度");
  assert.equal(dispatched.decisions[0].status, "dispatched");
  assert.equal(dispatched.summary.controlMutation, true);
});

test("FCU dispatch is skipped in local read-only mode", async () => {
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([
      buildFcu({
        deviceId: "1001",
        deviceTypeId: "2001"
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command"
    }),
    []
  );
  let called = false;
  const dispatched = await dispatchFcuControlCycle(cycle, {
    readOnlyMode: true,
    dispatchCommand: async () => {
      called = true;
      return { ok: true };
    }
  });

  assert.equal(called, false);
  assert.equal(dispatched.decisions[0].status, "ready");
  assert.equal(dispatched.summary.controlMutation, false);
});

test("FCU setpoint command is held after daily setpoint shift limit is reached", () => {
  const earlierToday = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command",
      dailyMaxSetpointShiftC: 2
    }),
    [
      {
        deviceCode: "FCU-01",
        actionKind: "setpoint",
        createdAt: earlierToday,
        snapshot: {
          setpointC: 26
        },
        commands: [
          {
            commandType: "setpoint",
            value: 25
          }
        ]
      },
      {
        deviceCode: "FCU-01",
        actionKind: "setpoint",
        createdAt: earlierToday,
        snapshot: {
          setpointC: 25
        },
        commands: [
          {
            commandType: "setpoint",
            value: 24
          }
        ]
      }
    ]
  );

  assert.equal(cycle.decisions[0].status, "held");
  assert.equal(cycle.decisions[0].reason, "daily_setpoint_shift_guard");
  assert.equal(cycle.decisions[0].commands.length, 0);
});

test("FCU dry-run preview records do not activate dwell or daily shift guards", () => {
  const now = new Date().toISOString();
  const cycle = evaluateFcuControlCycle(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command",
      dailyMaxSetpointShiftC: 2
    }),
    [
      {
        dryRun: true,
        deviceCode: "FCU-01",
        actionKind: "setpoint",
        createdAt: now,
        snapshot: {
          setpointC: 25
        },
        commands: [
          {
            commandType: "setpoint",
            value: 24.5
          }
        ]
      }
    ]
  );

  assert.equal(cycle.decisions[0].status, "ready");
  assert.equal(cycle.decisions[0].actionKind, "setpoint");
  assert.equal(cycle.decisions[0].commands[0].value, 24.5);
});

test("FCU manual setpoint command is ready only for whitelisted enforced device", () => {
  const cycle = evaluateManualFcuControlCommand(
    buildSnapshot([buildFcu()]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command"
    }),
    [],
    {
      setpointC: 24
    }
  );

  assert.equal(cycle.summary.readyCount, 1);
  assert.equal(cycle.decisions[0].status, "ready");
  assert.equal(cycle.decisions[0].actionKind, "setpoint");
  assert.deepEqual(cycle.decisions[0].manualCommand, {
    start: false,
    stop: false,
    setpointC: 24,
    fanSpeed: ""
  });
  assert.equal(cycle.decisions[0].commands[0].commandType, "setpoint");
  assert.equal(cycle.decisions[0].commands[0].value, 24);
});

test("FCU manual command is blocked by communication alarm and invalid temperature", () => {
  const cycle = evaluateManualFcuControlCommand(
    buildSnapshot([
      buildFcu({
        communicationAlarm: true,
        zoneTemperatureC: 0,
        quality: {
          status: "invalid",
          flags: ["invalid_temperature"]
        }
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command"
    }),
    [],
    {
      start: true
    }
  );

  assert.equal(cycle.summary.blockedCount, 1);
  assert.equal(cycle.decisions[0].status, "blocked");
  assert.ok(cycle.decisions[0].blockReasons.includes("communication_alarm"));
  assert.ok(cycle.decisions[0].blockReasons.includes("invalid_temperature"));
  assert.equal(cycle.decisions[0].commands.length, 0);
});

test("FCU manual command dispatches through adapter only after confirmation", async () => {
  const cycle = evaluateManualFcuControlCommand(
    buildSnapshot([
      buildFcu({
        deviceId: "1001",
        deviceTypeId: "2001"
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      whitelist: ["FCU-01"],
      dispatchAdapter: "legacy-scene-command"
    }),
    [],
    {
      fanSpeed: "high"
    }
  );
  const dryRunCalls = [];
  const dryRun = await dispatchFcuControlCycle(cycle, {
    readOnlyMode: true,
    dispatchCommand: async (command) => {
      dryRunCalls.push(command);
      return { ok: true };
    }
  });
  const confirmedCalls = [];
  const confirmed = await dispatchFcuControlCycle(cycle, {
    readOnlyMode: false,
    dispatchCommand: async (command) => {
      confirmedCalls.push(command);
      return { ok: true };
    }
  });

  assert.equal(dryRunCalls.length, 0);
  assert.equal(dryRun.decisions[0].status, "ready");
  assert.equal(confirmedCalls.length, 1);
  assert.equal(confirmedCalls[0].regName, "风速模式");
  assert.equal(confirmedCalls[0].value, "high");
  assert.equal(confirmed.decisions[0].status, "dispatched");
  assert.equal(confirmed.summary.controlMutation, true);
});

test("FCU feedback verification confirms matched setpoint feedback", () => {
  const record = {
    recordId: "rec-1",
    deviceCode: "FCU-01",
    status: "dispatched",
    actionKind: "setpoint",
    createdAt: new Date().toISOString(),
    commands: [
      {
        commandType: "setpoint",
        pointKey: "setpoint",
        value: 24.5
      }
    ]
  };

  const verified = verifyFcuControlRecordFeedback(
    record,
    buildSnapshot([
      buildFcu({
        setpointFeedbackC: 24.5
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      dispatchAdapter: "legacy-scene-command"
    })
  );

  assert.equal(verified.status, "feedback_confirmed");
  assert.equal(verified.feedback.status, "confirmed");
  assert.equal(verified.feedback.results[0].matched, true);
});

test("FCU feedback verification locks mismatched feedback after timeout", () => {
  const record = {
    recordId: "rec-1",
    deviceCode: "FCU-01",
    status: "dispatched",
    actionKind: "setpoint",
    createdAt: "2026-06-18T00:00:00.000Z",
    commands: [
      {
        commandType: "setpoint",
        pointKey: "setpoint",
        value: 24.5
      }
    ]
  };

  const verified = verifyFcuControlRecordFeedback(
    record,
    buildSnapshot([
      buildFcu({
        setpointFeedbackC: 25.5
      })
    ]),
    normalizeFcuControlPolicy({
      defaultMode: "enforced",
      dispatchAdapter: "legacy-scene-command",
      feedbackTimeoutSeconds: 60
    }),
    {
      now: "2026-06-18T00:02:01.000Z"
    }
  );

  assert.equal(verified.status, "feedback_mismatch_locked");
  assert.equal(verified.feedback.status, "mismatch");
  assert.equal(verified.feedback.timeoutExceeded, true);
});

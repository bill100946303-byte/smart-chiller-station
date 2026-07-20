import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildExpectedSignals,
  compareReplaySamples,
  deriveOperationalState,
  deriveAuditStatus,
  evaluateReplaySequence,
  freshnessPolicyPass,
  inspectPointKeyContract,
  inspectRuntimeSource,
  isExpectedPointIdentity,
  isExpectedSignalUnit,
  isRegisteredEvidenceProfileId,
  readFrequencyHz,
  readStrictBinaryValue
} from "./check-b25-runtime-point-evidence.js";

function sample(overrides = {}) {
  return {
    pointKey: "CHP1-1-509-42001",
    sourceKey: "chillerStagingRuntime",
    deviceId: "1",
    tagName: "CHP1-1-509-42001",
    unit: "Hz",
    value: 45,
    observedAt: "2026-07-18T00:00:00.000Z",
    timestampBasis: "edge_poll_complete",
    authoritativeTimestamp: true,
    qualityCode: "GOOD",
    sourceSequence: 10,
    scanCycleId: "boot-a:10",
    bootId: "boot-a",
    ...overrides
  };
}

test("frequency parser never turns null, boolean or blank input into a false zero", () => {
  for (const value of [null, undefined, false, true, "", "   ", [], {}]) {
    assert.equal(readFrequencyHz(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
  assert.equal(readFrequencyHz(0), 0);
  assert.equal(readFrequencyHz("0"), 0);
  assert.equal(readFrequencyHz(60), 60);
  assert.equal(readFrequencyHz(60.1), null);
});

test("operational state binary parser accepts only exact binary values", () => {
  for (const value of [false, 0, "0"]) {
    assert.equal(readStrictBinaryValue(value), false);
  }
  for (const value of [true, 1, "1"]) {
    assert.equal(readStrictBinaryValue(value), true);
  }
  for (const value of [
    null,
    undefined,
    -1,
    2,
    0.5,
    "",
    " 0",
    "1 ",
    "true",
    "false",
    "on",
    "running",
    "运行",
    [],
    {}
  ]) {
    assert.equal(readStrictBinaryValue(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test("operational state truth table is fault-first and fail-safe", () => {
  assert.equal(deriveOperationalState({ running: 1, fault: 1, remoteEnabled: 1 }), "FAULT");
  assert.equal(deriveOperationalState({ running: null, fault: "1", remoteEnabled: null }), "FAULT");
  assert.equal(deriveOperationalState({ running: 1, fault: 0, remoteEnabled: 1 }), "RUNNING");
  assert.equal(deriveOperationalState({ running: "1", fault: "0", remoteEnabled: "0" }), "RUNNING");
  assert.equal(deriveOperationalState({ running: 0, fault: 0, remoteEnabled: 1 }), "STANDBY");
  assert.equal(deriveOperationalState({ running: false, fault: false, remoteEnabled: false }), "STOPPED");
  assert.equal(deriveOperationalState({ running: 0, fault: null, remoteEnabled: 1 }), "UNKNOWN");
  assert.equal(deriveOperationalState({ running: 0, fault: 0, remoteEnabled: null }), "UNKNOWN");
  assert.equal(deriveOperationalState({ running: 2, fault: 0, remoteEnabled: 1 }), "UNKNOWN");
  assert.equal(deriveOperationalState({ running: 0, fault: 0, remoteEnabled: "true" }), "UNKNOWN");
  assert.equal(deriveOperationalState({
    running: 1,
    fault: 1,
    remoteEnabled: 1,
    evidenceUsable: false
  }), "UNKNOWN");
  assert.equal(deriveOperationalState(), "UNKNOWN");
});

test("binding has 162 exact state selectors plus 47 frequency selectors", () => {
  const binding = JSON.parse(fs.readFileSync(new URL(
    "../../chiller-shell-v1/public/models/plant-overview/bindings/b25-plant-overview-binding-v2.json",
    import.meta.url
  ), "utf8"));
  const pointRows = fs.readFileSync(new URL(
    "../../../docs/field-data/optimize-demo-140/b25-communication-v46-point-dictionary-normalized.csv",
    import.meta.url
  ), "utf8")
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","));
  const expectedSignals = buildExpectedSignals(binding);
  const bySignal = Object.fromEntries(
    ["running", "fault", "remoteEnabled", "frequencyHz"].map((signal) => [
      signal,
      expectedSignals.filter((item) => item.signal === signal)
    ])
  );

  assert.equal(Object.keys(binding.runtimeSignalBindings.signals).length, 54);
  assert.equal(bySignal.running.length, 54);
  assert.equal(bySignal.fault.length, 54);
  assert.equal(bySignal.remoteEnabled.length, 54);
  assert.equal(bySignal.frequencyHz.length, 47);
  assert.equal(bySignal.running.length + bySignal.fault.length + bySignal.remoteEnabled.length, 162);
  assert.equal(expectedSignals.length, 209);
  assert.equal(new Set(expectedSignals.map((item) => item.runtimeTagName)).size, 209);

  const pointNameSuffixBySignal = {
    running: "运行",
    fault: "故障",
    remoteEnabled: "远程"
  };
  for (const [signal, suffix] of Object.entries(pointNameSuffixBySignal)) {
    for (const expected of bySignal[signal]) {
      const exactRows = pointRows.filter((row) => row[1] === `${expected.runtimeId}${suffix}`);
      assert.equal(exactRows.length, 1, `${expected.runtimeId} ${signal} must resolve to one exact row`);
      assert.equal(expected.pointTableCode, exactRows[0][21]);
      assert.equal(expected.runtimeTagName, expected.pointTableCode.replace(/^SY-/, `${expected.runtimeId}-`));
    }
  }

  assert.deepEqual(binding.operationalStatePolicy.allowedStates, [
    "RUNNING",
    "FAULT",
    "STANDBY",
    "STOPPED",
    "UNKNOWN"
  ]);
  assert.deepEqual(binding.operationalStatePolicy.requiredSignals, [
    "running",
    "fault",
    "remoteEnabled"
  ]);
  assert.equal(binding.operationalStatePolicy.authoritative, false);
  assert.equal(binding.operationalStatePolicy.controlBoundary, "visualization_only_no_ba_plc_write");
  assert.deepEqual(binding.accessPolicy.allowedMethods, ["GET"]);
  assert.deepEqual(binding.accessPolicy.writeEndpoints, []);
});

test("runtime source must have exactly one matching healthy non-fallback source", () => {
  const healthy = {
    pointEvidence: { sourceKey: "chillerStagingRuntime" },
    sourceStatus: {
      sources: [{ key: "chillerStagingRuntime", ok: true, fallback: false }]
    }
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(inspectRuntimeSource(healthy)).filter(([key]) => key !== "source")),
    { sourceKey: "chillerStagingRuntime", matches: 1, exactUnique: true, healthy: true }
  );
  assert.equal(inspectRuntimeSource({
    ...healthy,
    sourceStatus: { sources: [healthy.sourceStatus.sources[0], healthy.sourceStatus.sources[0]] }
  }).exactUnique, false);
  assert.equal(inspectRuntimeSource({
    ...healthy,
    sourceStatus: { sources: [{ key: "chillerStagingRuntime", ok: true, fallback: true }] }
  }).healthy, false);
  assert.equal(inspectRuntimeSource({
    ...healthy,
    pointEvidence: { sourceKey: " chillerStagingRuntime " }
  }).exactUnique, false);
});

test("evidence profile allowlist uses exact code-owned ID", () => {
  assert.equal(isRegisteredEvidenceProfileId("opcua-datavalue-v1"), true);
  assert.equal(isRegisteredEvidenceProfileId(" opcua-datavalue-v1 "), false);
  assert.equal(isRegisteredEvidenceProfileId(null), false);
});

test("point keys are globally unique and must equal tagName", () => {
  assert.equal(inspectPointKeyContract([
    { pointKey: "A", tagName: "A" },
    { pointKey: "B", tagName: "B" }
  ]).pass, true);
  const duplicate = inspectPointKeyContract([
    { pointKey: "A", tagName: "A" },
    { pointKey: "A", tagName: "A" }
  ]);
  assert.equal(duplicate.uniquePass, false);
  assert.deepEqual(duplicate.duplicatePointKeys, [{ pointKey: "A", count: 2 }]);
  assert.equal(inspectPointKeyContract([{ pointKey: "A", tagName: "B" }]).identityPass, false);
  assert.equal(inspectPointKeyContract([{ pointKey: " A ", tagName: " A " }]).pass, false);
});

test("expected identity is exact and frequency unit is case-sensitive Hz", () => {
  const point = sample();
  const expected = {
    runtimeTagName: point.tagName,
    deviceId: point.deviceId,
    signal: "frequencyHz"
  };
  assert.equal(isExpectedPointIdentity(point, expected), true);
  assert.equal(isExpectedPointIdentity({ ...point, pointKey: "different" }, expected), false);
  assert.equal(isExpectedPointIdentity({ ...point, pointKey: `${point.pointKey} ` }, expected), false);
  assert.equal(isExpectedSignalUnit(point, "frequencyHz"), true);
  assert.equal(isExpectedSignalUnit({ ...point, unit: "hz" }, "frequencyHz"), false);
  assert.equal(isExpectedSignalUnit({ ...point, unit: " Hz " }, "frequencyHz"), false);
  assert.equal(isExpectedSignalUnit({ ...point, unit: null }, "frequencyHz"), false);
});

test("future skew zero is a valid strict freshness policy", () => {
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: 0 }), true);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: null }), false);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: false }), false);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: "" }), false);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 0, maxFutureSkewMs: 0 }), false);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: -1 }), false);
  assert.equal(freshnessPolicyPass({ liveMaxAgeMs: 20_000, maxFutureSkewMs: 2_001 }), false);
});

test("same boot accepts only a complete identical sample or monotonic advance", () => {
  const first = sample();
  assert.deepEqual(compareReplaySamples(first, { ...first }), {
    pass: true,
    reason: "COMPLETE_SAMPLE_REPEATED",
    kind: "same"
  });
  assert.equal(compareReplaySamples(first, sample({
    value: 46,
    sourceSequence: 11,
    scanCycleId: "boot-a:11",
    observedAt: "2026-07-18T00:00:01.000Z"
  })).pass, true);
  assert.equal(compareReplaySamples(first, sample({ value: 46 })).reason, "SAME_BOOT_SAMPLE_CONFLICT");
  assert.equal(compareReplaySamples(first, sample({
    sourceSequence: 11,
    scanCycleId: "boot-a:11",
    observedAt: "2026-07-17T23:59:59.000Z"
  })).reason, "OBSERVED_AT_REGRESSED");
  assert.equal(compareReplaySamples(first, sample({
    sourceSequence: 11,
    scanCycleId: "boot-a:11",
    observedAt: "2026-07-18T00:00:01"
  })).reason, "MISSING_REPLAY_PROOF");
});

test("boot changes require later observation time and A-B-A is rejected", () => {
  const bootA = sample();
  const bootB = sample({
    bootId: "boot-b",
    sourceSequence: 0,
    scanCycleId: "boot-b:0",
    observedAt: "2026-07-18T00:00:01.000Z"
  });
  const bootAAgain = sample({
    sourceSequence: 12,
    scanCycleId: "boot-a:12",
    observedAt: "2026-07-18T00:00:02.000Z"
  });
  assert.equal(compareReplaySamples(bootA, bootB).reason, "BOOT_ADVANCED");
  const replay = evaluateReplaySequence(bootB, bootAAgain, {
    lastSample: bootA,
    retiredBootIds: []
  });
  assert.equal(replay.pass, false);
  assert.equal(replay.reason, "BOOT_ID_REUSED");
  assert.equal(compareReplaySamples(bootA, {
    ...bootB,
    observedAt: bootA.observedAt
  }).reason, "BOOT_OBSERVED_AT_NOT_ADVANCED");
});

test("single snapshot, unregistered profile and blocked flow cannot produce top-level PASS", () => {
  const baseline = {
    contractShapePass: true,
    controlBoundaryPass: true,
    structuralEvidencePass: true,
    replayIntegrityViolationCount: 0,
    dualSnapshotPass: true,
    evidenceProfileRegisteredPass: true,
    sourceHealthy: true,
    selectorCoveragePass: true,
    liveEvidencePass: true,
    replayContinuityPass: true,
    flowAnimationEvidencePass: true
  };
  assert.equal(deriveAuditStatus(baseline), "PASS");
  assert.equal(deriveAuditStatus({ ...baseline, dualSnapshotPass: false }), "BLOCKED_UPSTREAM_POINT_EVIDENCE");
  assert.equal(
    deriveAuditStatus({ ...baseline, evidenceProfileRegisteredPass: false }),
    "BLOCKED_UPSTREAM_POINT_EVIDENCE"
  );
  assert.equal(
    deriveAuditStatus({ ...baseline, flowAnimationEvidencePass: false }),
    "BLOCKED_UPSTREAM_POINT_EVIDENCE"
  );
});

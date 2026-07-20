import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const BFF_BASE_URL = String(process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SITE_ID = String(process.env.SITE_ID || "140");
const OUTPUT_PATH = path.resolve(
  process.env.B25_RUNTIME_POINT_EVIDENCE_OUTPUT
    || path.join(REPO_ROOT, "docs/field-data/optimize-demo-140/b25-runtime-point-evidence-audit-latest.json")
);
const BINDING_PATH = path.join(
  REPO_ROOT,
  "apps/chiller-shell-v1/public/models/plant-overview/bindings/b25-plant-overview-binding-v2.json"
);
const AUTHORITATIVE_TIMESTAMP_BASES = new Set([
  "source_observed_at",
  "edge_poll_complete",
  "opcua_server_timestamp",
  "historian_event_time"
]);
const REPLAY_INTEGRITY_FAILURES = new Set([
  "POINT_KEY_CHANGED",
  "BOOT_ID_REUSED",
  "SAME_BOOT_SAMPLE_CONFLICT",
  "SOURCE_SEQUENCE_NOT_ADVANCED",
  "SCAN_CYCLE_NOT_ADVANCED",
  "OBSERVED_AT_REGRESSED",
  "BOOT_OBSERVED_AT_NOT_ADVANCED"
]);
const REGISTERED_EVIDENCE_PROFILE_IDS = new Set(["opcua-datavalue-v1"]);
const RUNTIME_SOURCE_KEY = "chillerStagingRuntime";
const HARD_LIVE_MAX_AGE_MS = 20_000;
const HARD_MAX_FUTURE_SKEW_MS = 2_000;
const REPLAY_HISTORY_VERSION = "runtime-point-replay-history-v1";

function normalize(value) {
  return String(value ?? "").trim();
}

function isExactNonBlankString(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function exactString(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function readFiniteNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExplicitTimezoneTimestamp(value) {
  if (!isExactNonBlankString(value) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampSnapshotDelayMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(Math.trunc(parsed), 5_000)) : 250;
}

function resolveRuntimeTagName(aliasRule, runtimeId, pointTableCode) {
  const code = normalize(pointTableCode);
  const pointTablePrefix = normalize(aliasRule?.pointTablePrefix);
  if (
    aliasRule?.status !== "REVIEWED_EXACT_TRANSPORT_ALIAS"
    || aliasRule?.runtimePrefixSource !== "runtimeId"
    || !pointTablePrefix
    || !code.startsWith(pointTablePrefix)
  ) {
    return null;
  }
  return `${runtimeId}-${code.slice(pointTablePrefix.length)}`;
}

export function readStrictBinaryValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : null;
  }
  return value === "1" ? true : value === "0" ? false : null;
}

export function readRunningValue(value) {
  return readStrictBinaryValue(value);
}

export function deriveOperationalState({
  running,
  fault,
  remoteEnabled,
  evidenceUsable = true
} = {}) {
  if (evidenceUsable !== true) {
    return "UNKNOWN";
  }
  const faultValue = readStrictBinaryValue(fault);
  if (faultValue === true) {
    return "FAULT";
  }
  const runningValue = readStrictBinaryValue(running);
  const remoteEnabledValue = readStrictBinaryValue(remoteEnabled);
  if (faultValue === null || runningValue === null || remoteEnabledValue === null) {
    return "UNKNOWN";
  }
  if (runningValue) {
    return "RUNNING";
  }
  return remoteEnabledValue ? "STANDBY" : "STOPPED";
}

export function readFrequencyHz(value) {
  const parsed = readFiniteNumber(value);
  return parsed !== null && parsed >= 0 && parsed <= 60 ? parsed : null;
}

function hasValidSignalValue(point, signal) {
  if (["running", "fault", "remoteEnabled"].includes(signal)) {
    return readStrictBinaryValue(point?.value) !== null;
  }
  if (signal === "frequencyHz") {
    return readFrequencyHz(point?.value) !== null;
  }
  return false;
}

export function isExpectedPointIdentity(point, expected) {
  return Boolean(
    point
    && point.pointKey === expected.runtimeTagName
    && point.tagName === expected.runtimeTagName
    && point.pointKey === point.tagName
    && exactString(point.deviceId) === expected.deviceId
    && point.sourceKey === RUNTIME_SOURCE_KEY
  );
}

export function isExpectedSignalUnit(point, signal) {
  return signal !== "frequencyHz" || point?.unit === "Hz";
}

function isFreshAuthoritativePoint(point, expected, sourceHealthy, policy, nowMs) {
  if (
    !isExpectedPointIdentity(point, expected)
    || !sourceHealthy
    || !isExpectedSignalUnit(point, expected.signal)
    || !hasValidSignalValue(point, expected.signal)
    || normalize(point.qualityCode).toUpperCase() !== "GOOD"
    || point.authoritativeTimestamp !== true
    || !AUTHORITATIVE_TIMESTAMP_BASES.has(normalize(point.timestampBasis))
    || !hasReplayProof(point)
  ) {
    return false;
  }
  const observedAtMs = parseExplicitTimezoneTimestamp(point.observedAt);
  if (observedAtMs === null) {
    return false;
  }
  const configuredLiveMaxAgeMs = readFiniteNumber(policy?.liveMaxAgeMs);
  const configuredMaxFutureSkewMs = readFiniteNumber(policy?.maxFutureSkewMs);
  const liveMaxAgeMs = configuredLiveMaxAgeMs !== null && configuredLiveMaxAgeMs > 0
    ? Math.min(configuredLiveMaxAgeMs, HARD_LIVE_MAX_AGE_MS)
    : HARD_LIVE_MAX_AGE_MS;
  const maxFutureSkewMs = configuredMaxFutureSkewMs !== null && configuredMaxFutureSkewMs >= 0
    ? Math.min(configuredMaxFutureSkewMs, HARD_MAX_FUTURE_SKEW_MS)
    : HARD_MAX_FUTURE_SKEW_MS;
  const ageMs = nowMs - observedAtMs;
  return ageMs >= -maxFutureSkewMs && ageMs <= liveMaxAgeMs;
}

export function inspectRuntimeSource(payload) {
  const sourceKey = payload?.pointEvidence?.sourceKey;
  const sources = Array.isArray(payload?.sourceStatus?.sources) ? payload.sourceStatus.sources : [];
  const matches = sources.filter((source) => source?.key === sourceKey);
  const exactUnique = sourceKey === RUNTIME_SOURCE_KEY && matches.length === 1;
  const source = exactUnique ? matches[0] : null;
  return {
    sourceKey,
    matches: matches.length,
    exactUnique,
    healthy: exactUnique && source?.ok === true && source?.fallback === false,
    source
  };
}

export function isRegisteredEvidenceProfileId(profileId) {
  return typeof profileId === "string" && REGISTERED_EVIDENCE_PROFILE_IDS.has(profileId);
}

export function inspectPointKeyContract(points) {
  const list = Array.isArray(points) ? points : [];
  const pointKeys = list.map((point) => point?.pointKey);
  const missingPointKeys = pointKeys.filter((pointKey) => !isExactNonBlankString(pointKey)).length;
  const counts = new Map();
  for (const pointKey of pointKeys.filter(isExactNonBlankString)) {
    counts.set(pointKey, (counts.get(pointKey) || 0) + 1);
  }
  const duplicatePointKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([pointKey, count]) => ({ pointKey, count }));
  const pointKeyTagNameMismatches = list
    .filter((point) => (
      !isExactNonBlankString(point?.pointKey)
      || !isExactNonBlankString(point?.tagName)
      || point.pointKey !== point.tagName
    ))
    .map((point) => ({
      pointKey: point?.pointKey ?? null,
      tagName: point?.tagName ?? null
    }));
  return {
    pass: missingPointKeys === 0 && duplicatePointKeys.length === 0 && pointKeyTagNameMismatches.length === 0,
    uniquePass: missingPointKeys === 0 && duplicatePointKeys.length === 0,
    identityPass: pointKeyTagNameMismatches.length === 0,
    pointCount: list.length,
    uniquePointKeys: counts.size,
    missingPointKeys,
    duplicatePointKeys,
    pointKeyTagNameMismatches
  };
}

function hasReplayProof(point) {
  return Boolean(
    point
    && isExactNonBlankString(point.pointKey)
    && Number.isSafeInteger(point.sourceSequence)
    && point.sourceSequence >= 0
    && isExactNonBlankString(point.scanCycleId)
    && isExactNonBlankString(point.bootId)
    && parseExplicitTimezoneTimestamp(point.observedAt) !== null
  );
}

function toReplaySample(point) {
  if (!point) {
    return null;
  }
  return {
    pointKey: exactString(point.pointKey),
    sourceKey: exactString(point.sourceKey),
    deviceId: exactString(point.deviceId),
    tagName: exactString(point.tagName),
    unit: exactString(point.unit),
    value: point.value,
    observedAt: exactString(point.observedAt),
    timestampBasis: exactString(point.timestampBasis),
    authoritativeTimestamp: point.authoritativeTimestamp === true,
    qualityCode: exactString(point.qualityCode),
    sourceSequence: point.sourceSequence,
    scanCycleId: exactString(point.scanCycleId),
    bootId: exactString(point.bootId)
  };
}

function replayFingerprint(point) {
  const sample = toReplaySample(point);
  return sample ? JSON.stringify({ ...sample, valueType: typeof point.value }) : "";
}

export function compareReplaySamples(previousPoint, currentPoint, retiredBootIds = []) {
  if (!hasReplayProof(previousPoint) || !hasReplayProof(currentPoint)) {
    return { pass: false, reason: "MISSING_REPLAY_PROOF", kind: null };
  }
  const previous = toReplaySample(previousPoint);
  const current = toReplaySample(currentPoint);
  if (previous.pointKey !== current.pointKey) {
    return { pass: false, reason: "POINT_KEY_CHANGED", kind: null };
  }
  const retired = new Set(
    (Array.isArray(retiredBootIds) ? retiredBootIds : []).filter(isExactNonBlankString)
  );
  if (retired.has(current.bootId)) {
    return { pass: false, reason: "BOOT_ID_REUSED", kind: null };
  }
  if (previous.bootId === current.bootId) {
    if (replayFingerprint(previousPoint) === replayFingerprint(currentPoint)) {
      return { pass: true, reason: "COMPLETE_SAMPLE_REPEATED", kind: "same" };
    }
    if (current.sourceSequence <= previous.sourceSequence) {
      return {
        pass: false,
        reason: current.sourceSequence === previous.sourceSequence
          ? "SAME_BOOT_SAMPLE_CONFLICT"
          : "SOURCE_SEQUENCE_NOT_ADVANCED",
        kind: null
      };
    }
    if (current.scanCycleId === previous.scanCycleId) {
      return { pass: false, reason: "SCAN_CYCLE_NOT_ADVANCED", kind: null };
    }
    if (parseExplicitTimezoneTimestamp(current.observedAt) < parseExplicitTimezoneTimestamp(previous.observedAt)) {
      return { pass: false, reason: "OBSERVED_AT_REGRESSED", kind: null };
    }
    return { pass: true, reason: "SAME_BOOT_MONOTONIC_ADVANCE", kind: "advance" };
  }
  if (parseExplicitTimezoneTimestamp(current.observedAt) <= parseExplicitTimezoneTimestamp(previous.observedAt)) {
    return { pass: false, reason: "BOOT_OBSERVED_AT_NOT_ADVANCED", kind: null };
  }
  return { pass: true, reason: "BOOT_ADVANCED", kind: "boot" };
}

function normalizePriorReplayState(priorState) {
  const retiredBootIds = [...new Set(
    (Array.isArray(priorState?.retiredBootIds) ? priorState.retiredBootIds : [])
      .filter(isExactNonBlankString)
  )];
  return {
    lastSample: hasReplayProof(priorState?.lastSample) ? toReplaySample(priorState.lastSample) : null,
    retiredBootIds
  };
}

export function evaluateReplaySequence(firstPoint, secondPoint, priorState = null) {
  const originalState = normalizePriorReplayState(priorState);
  if (!hasReplayProof(firstPoint) || !hasReplayProof(secondPoint)) {
    return {
      pass: false,
      reason: "MISSING_REPLAY_PROOF",
      transitions: [],
      nextState: originalState
    };
  }
  const retired = new Set(originalState.retiredBootIds);
  const transitions = [];
  let previous = originalState.lastSample;
  for (const current of [firstPoint, secondPoint]) {
    const currentBootId = exactString(current?.bootId);
    if (!previous) {
      if (retired.has(currentBootId)) {
        return {
          pass: false,
          reason: "BOOT_ID_REUSED",
          transitions,
          nextState: originalState
        };
      }
      previous = current;
      continue;
    }
    const result = compareReplaySamples(previous, current, [...retired]);
    transitions.push(result);
    if (!result.pass) {
      return {
        pass: false,
        reason: result.reason,
        transitions,
        nextState: originalState
      };
    }
    if (exactString(previous.bootId) !== currentBootId) {
      retired.add(exactString(previous.bootId));
    }
    previous = current;
  }
  const lastBootId = exactString(previous.bootId);
  retired.delete(lastBootId);
  return {
    pass: true,
    reason: transitions.at(-1)?.reason || "TWO_SNAPSHOT_BASELINE_ESTABLISHED",
    transitions,
    nextState: {
      lastSample: toReplaySample(previous),
      retiredBootIds: [...retired].filter(isExactNonBlankString)
    }
  };
}

export function deriveAuditStatus({
  contractShapePass,
  controlBoundaryPass,
  structuralEvidencePass,
  replayIntegrityViolationCount,
  dualSnapshotPass,
  evidenceProfileRegisteredPass,
  sourceHealthy,
  selectorCoveragePass,
  liveEvidencePass,
  replayContinuityPass,
  flowAnimationEvidencePass
}) {
  if (
    !contractShapePass
    || !controlBoundaryPass
    || !structuralEvidencePass
    || replayIntegrityViolationCount > 0
  ) {
    return "FAIL_CONTRACT";
  }
  if (
    !dualSnapshotPass
    || !evidenceProfileRegisteredPass
    || !sourceHealthy
    || !selectorCoveragePass
    || !liveEvidencePass
    || !replayContinuityPass
    || !flowAnimationEvidencePass
  ) {
    return "BLOCKED_UPSTREAM_POINT_EVIDENCE";
  }
  return "PASS";
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function readPriorReplayHistory() {
  try {
    const report = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    const history = report?.replayHistory;
    if (
      history?.version === REPLAY_HISTORY_VERSION
      && exactString(history?.siteId) === SITE_ID
      && history?.sourceKey === RUNTIME_SOURCE_KEY
      && history?.points
      && typeof history.points === "object"
    ) {
      return history;
    }
  } catch {
    // The first audit has no prior replay history. Two current snapshots are still mandatory.
  }
  return {
    version: REPLAY_HISTORY_VERSION,
    siteId: SITE_ID,
    sourceKey: RUNTIME_SOURCE_KEY,
    points: {}
  };
}

async function fetchSnapshot(endpoint) {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(endpoint, {
      headers: {
        "x-chiller-site-id": SITE_ID,
        "x-chiller-site-code": "B25",
        "x-chiller-project-key": "140btwentyfive",
        "x-chiller-database-key": "140btwentyfive"
      }
    });
    const payload = await response.json();
    return { captured: true, fetchedAt, response, payload, error: null };
  } catch (error) {
    return {
      captured: false,
      fetchedAt,
      response: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function buildExpectedSignals(binding) {
  const aliasRule = binding?.runtimeSignalBindings?.runtimeTagAliasRule;
  const signals = binding?.runtimeSignalBindings?.signals || {};
  const bindingByRuntimeId = new Map(
    (Array.isArray(binding?.bindings) ? binding.bindings : []).map((item) => [normalize(item.runtimeId), item])
  );
  const expectedSignals = [];
  for (const [runtimeId, selector] of Object.entries(signals)) {
    const identity = bindingByRuntimeId.get(runtimeId);
    for (const [signal, pointTableCode] of [
      ["running", selector?.runningTagName],
      ["fault", selector?.faultTagName],
      ["remoteEnabled", selector?.remoteEnabledTagName],
      ["frequencyHz", selector?.frequencyTagName]
    ]) {
      if (!pointTableCode) {
        continue;
      }
      expectedSignals.push({
        equipmentId: identity?.equipmentId || null,
        runtimeId,
        deviceId: normalize(identity?.deviceIdRef ?? identity?.deviceId),
        signal,
        pointTableCode,
        runtimeTagName: resolveRuntimeTagName(aliasRule, runtimeId, pointTableCode)
      });
    }
  }
  return expectedSignals;
}

export function summarizeSignalCategories(evaluatedSignals) {
  return Object.fromEntries(
    ["running", "fault", "remoteEnabled", "frequencyHz"].map((signal) => {
      const signals = evaluatedSignals.filter((item) => item.signal === signal);
      return [signal, {
        expected: signals.length,
        firstSnapshotUniqueMatched: signals.filter((item) => item.firstSnapshotMatches === 1).length,
        uniqueMatched: signals.filter((item) => item.matches === 1).length,
        replayValidated: signals.filter((item) => item.replayPass).length,
        live: signals.filter((item) => item.live).length
      }];
    })
  );
}

function findExpectedMatches(points, expected) {
  return points.filter((point) => (
    exactString(point?.deviceId) === expected.deviceId
    && point?.tagName === expected.runtimeTagName
  ));
}

export function freshnessPolicyPass(policy) {
  const liveMaxAgeMs = readFiniteNumber(policy?.liveMaxAgeMs);
  const maxFutureSkewMs = readFiniteNumber(policy?.maxFutureSkewMs);
  return liveMaxAgeMs !== null
    && liveMaxAgeMs > 0
    && liveMaxAgeMs <= HARD_LIVE_MAX_AGE_MS
    && maxFutureSkewMs !== null
    && maxFutureSkewMs >= 0
    && maxFutureSkewMs <= HARD_MAX_FUTURE_SKEW_MS;
}

async function main() {
  const evaluatedAt = new Date().toISOString();
  const binding = JSON.parse(fs.readFileSync(BINDING_PATH, "utf8"));
  const expectedSignals = buildExpectedSignals(binding);
  const expectedSignalCategories = summarizeSignalCategories(expectedSignals);
  const priorReplayHistory = readPriorReplayHistory();
  const endpoint = `${BFF_BASE_URL}/bff/v1/sites/${encodeURIComponent(SITE_ID)}/runtime/summary`;
  const firstSnapshot = await fetchSnapshot(endpoint);
  if (!firstSnapshot.captured) {
    writeReport({
      status: "BLOCKED_RUNTIME_SUMMARY_UNAVAILABLE",
      evaluatedAt,
      siteId: SITE_ID,
      endpoint,
      error: firstSnapshot.error,
      checks: {
        dualSnapshot: "BLOCKED_FIRST_SNAPSHOT_UNAVAILABLE",
        flowAnimationEvidence: "BLOCKED_NO_EXPLICIT_INSTANT_FLOW_BINDING"
      },
      counts: {
        snapshotCount: 0,
        expectedEquipmentBindings: Object.keys(binding?.runtimeSignalBindings?.signals || {}).length,
        expectedSignals: expectedSignals.length,
        expectedOperationalStateSelectors: expectedSignals.filter((item) => item.signal !== "frequencyHz").length,
        expectedRunningSignals: expectedSignalCategories.running.expected,
        expectedFaultSignals: expectedSignalCategories.fault.expected,
        expectedRemoteEnabledSignals: expectedSignalCategories.remoteEnabled.expected,
        expectedFrequencySignals: expectedSignalCategories.frequencyHz.expected,
        signalCategories: expectedSignalCategories
      },
      replayHistory: priorReplayHistory,
      truthPath: OUTPUT_PATH
    });
    process.exitCode = 2;
    return;
  }

  const snapshotDelayMs = clampSnapshotDelayMs(process.env.B25_AUDIT_SNAPSHOT_DELAY_MS);
  if (snapshotDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, snapshotDelayMs));
  }
  const secondSnapshot = await fetchSnapshot(endpoint);
  const snapshots = secondSnapshot.captured ? [firstSnapshot, secondSnapshot] : [firstSnapshot];
  const currentSnapshot = snapshots.at(-1);
  const response = currentSnapshot.response;
  const payload = currentSnapshot.payload;
  const evidence = payload?.pointEvidence;
  const points = Array.isArray(evidence?.points) ? evidence.points : [];
  const firstEvidence = firstSnapshot.payload?.pointEvidence;
  const firstPoints = Array.isArray(firstEvidence?.points) ? firstEvidence.points : [];
  const sourceInspections = snapshots.map((snapshot) => inspectRuntimeSource(snapshot.payload));
  const runtimeSourceInspection = sourceInspections.at(-1);
  const sourceStatusExactUniquePass = snapshots.length > 0
    && sourceInspections.every((inspection) => inspection.exactUnique);
  const sourceHealthy = snapshots.length === 2
    && sourceInspections.every((inspection) => inspection.healthy);
  const pointKeyContracts = [inspectPointKeyContract(firstPoints)];
  if (secondSnapshot.captured) {
    pointKeyContracts.push(inspectPointKeyContract(points));
  }
  const globalPointKeyUniquenessPass = pointKeyContracts.length > 0
    && pointKeyContracts.every((contract) => contract.uniquePass);
  const pointKeyTagNameIdentityPass = pointKeyContracts.length > 0
    && pointKeyContracts.every((contract) => contract.identityPass);
  const evidenceProfileIds = snapshots.map((snapshot) => (
    snapshot.payload?.pointEvidence?.evidenceProfileId
  ));
  const evidenceProfileRegisteredPass = snapshots.length === 2
    && evidenceProfileIds.every(isRegisteredEvidenceProfileId)
    && new Set(evidenceProfileIds).size === 1;
  const updatedReplayHistoryPoints = { ...priorReplayHistory.points };

  const evaluatedSignals = expectedSignals.map((expected) => {
    const firstMatches = findExpectedMatches(firstPoints, expected);
    const currentMatches = findExpectedMatches(points, expected);
    const firstPoint = firstMatches.length === 1 ? firstMatches[0] : null;
    const point = currentMatches.length === 1 ? currentMatches[0] : null;
    const identityPass = isExpectedPointIdentity(firstPoint, expected)
      && isExpectedPointIdentity(point, expected);
    const unitPass = isExpectedSignalUnit(firstPoint, expected.signal)
      && isExpectedSignalUnit(point, expected.signal);
    const replayReady = snapshots.length === 2
      && evidenceProfileRegisteredPass
      && sourceHealthy
      && firstMatches.length === 1
      && currentMatches.length === 1;
    const replay = replayReady
      ? evaluateReplaySequence(firstPoint, point, priorReplayHistory.points?.[expected.runtimeTagName])
      : {
          pass: false,
          reason: snapshots.length !== 2
            ? "SECOND_SNAPSHOT_UNAVAILABLE"
            : !evidenceProfileRegisteredPass
              ? "EVIDENCE_PROFILE_NOT_REGISTERED"
              : !sourceHealthy
                ? "SOURCE_NOT_HEALTHY_NON_FALLBACK"
                : firstMatches.length !== 1
                  ? "FIRST_SNAPSHOT_POINT_NOT_UNIQUE"
                  : "SECOND_SNAPSHOT_POINT_NOT_UNIQUE",
          transitions: [],
          nextState: normalizePriorReplayState(priorReplayHistory.points?.[expected.runtimeTagName])
        };
    if (replay.pass) {
      updatedReplayHistoryPoints[expected.runtimeTagName] = replay.nextState;
    }
    const live = identityPass
      && unitPass
      && replay.pass
      && isFreshAuthoritativePoint(point, expected, sourceHealthy, payload?.freshnessPolicy, Date.now());
    return {
      ...expected,
      matches: currentMatches.length,
      firstSnapshotMatches: firstMatches.length,
      secondSnapshotMatches: secondSnapshot.captured ? currentMatches.length : 0,
      pointKey: point?.pointKey || null,
      tagName: point?.tagName || null,
      unit: point?.unit ?? null,
      observedAt: point?.observedAt || null,
      qualityCode: point?.qualityCode || null,
      timestampBasis: point?.timestampBasis || null,
      sourceSequence: point?.sourceSequence ?? null,
      scanCycleId: point?.scanCycleId || null,
      bootId: point?.bootId || null,
      identityPass,
      unitPass,
      replayPass: replay.pass,
      replayReason: replay.reason,
      live,
      reason: currentMatches.length === 0
        ? "POINT_NOT_EXPOSED_BY_RUNTIME_API"
        : currentMatches.length > 1
          ? "AMBIGUOUS_POINT_MATCH"
          : firstMatches.length !== 1
            ? "POINT_NOT_UNIQUE_IN_FIRST_SNAPSHOT"
            : !identityPass
              ? "POINT_KEY_TAG_NAME_SOURCE_OR_DEVICE_IDENTITY_MISMATCH"
              : !unitPass
                ? "FREQUENCY_UNIT_NOT_EXACT_HZ"
                : !replay.pass
                  ? replay.reason
                  : live
                    ? "LIVE"
                    : "POINT_VALUE_TIME_QUALITY_OR_REPLAY_PROOF_NOT_AUTHORITATIVE"
    };
  });

  const expectedSignalCount = evaluatedSignals.length;
  const uniqueMatchedSignalCount = evaluatedSignals.filter((item) => item.matches === 1).length;
  const firstSnapshotUniqueMatchedSignalCount = evaluatedSignals
    .filter((item) => item.firstSnapshotMatches === 1).length;
  const liveSignalCount = evaluatedSignals.filter((item) => item.live).length;
  const replayValidatedSignalCount = evaluatedSignals.filter((item) => item.replayPass).length;
  const replayIntegrityViolationCount = evaluatedSignals
    .filter((item) => REPLAY_INTEGRITY_FAILURES.has(item.replayReason)).length;
  const equipmentIds = [...new Set(evaluatedSignals.map((item) => item.equipmentId).filter(Boolean))];
  const liveEquipmentCount = equipmentIds.filter((equipmentId) => (
    evaluatedSignals.filter((item) => item.equipmentId === equipmentId).every((item) => item.live)
  )).length;
  const signalCategories = summarizeSignalCategories(evaluatedSignals);
  const operationalStateSignals = evaluatedSignals.filter((item) => item.signal !== "frequencyHz");
  const operationalStateSelectorCount = operationalStateSignals.length;
  const liveOperationalStateEquipmentCount = equipmentIds.filter((equipmentId) => (
    operationalStateSignals
      .filter((item) => item.equipmentId === equipmentId)
      .every((item) => item.live)
  )).length;
  const frequencySignals = evaluatedSignals.filter((item) => item.signal === "frequencyHz");
  const frequencyUnitViolationCount = frequencySignals.filter((item) => (
    item.firstSnapshotMatches === 1
    && item.secondSnapshotMatches === 1
    && !item.unitPass
  )).length;
  const frequencyUnitCoveragePass = frequencySignals.every((item) => (
    item.firstSnapshotMatches === 1
    && item.secondSnapshotMatches === 1
    && item.unitPass
  ));
  const controlBoundaryPass = binding?.controlBoundary === "visualization_only_no_ba_plc_write"
    && binding?.accessPolicy?.readOnly === true
    && JSON.stringify(binding?.accessPolicy?.allowedMethods) === JSON.stringify(["GET"])
    && Array.isArray(binding?.accessPolicy?.writeEndpoints)
    && binding.accessPolicy.writeEndpoints.length === 0;
  const firstFreshnessPolicyPass = freshnessPolicyPass(firstSnapshot.payload?.freshnessPolicy);
  const currentFreshnessPolicyPass = freshnessPolicyPass(payload?.freshnessPolicy);
  const allFreshnessPoliciesPass = snapshots.length > 0
    && firstFreshnessPolicyPass
    && currentFreshnessPolicyPass;
  const aliasRule = binding?.runtimeSignalBindings?.runtimeTagAliasRule;
  const operationalStatePolicy = binding?.operationalStatePolicy;
  const dualSnapshotPass = snapshots.length === 2
    && snapshots.every((snapshot) => snapshot.response?.ok === true);
  const contractShapePass = snapshots.every((snapshot) => (
      snapshot.payload?.pointEvidence?.contractVersion === "runtime-point-evidence-v1"
      && snapshot.payload?.pointEvidence?.sourceKey === RUNTIME_SOURCE_KEY
    ))
    && binding?.runtimeSignalBindings?.status === "POINT_TABLE_DERIVED_READ_ONLY"
    && binding?.runtimeSignalBindings?.authoritative === false
    && binding?.runtimeSignalBindings?.selectorConfidence === "point_table_exact_read_only"
    && aliasRule?.status === "REVIEWED_EXACT_TRANSPORT_ALIAS"
    && equipmentIds.length === 54
    && allFreshnessPoliciesPass
    && operationalStatePolicy?.status === "READ_ONLY_VISUAL_CLASSIFICATION"
    && operationalStatePolicy?.authoritative === false
    && operationalStatePolicy?.controlBoundary === "visualization_only_no_ba_plc_write"
    && JSON.stringify(operationalStatePolicy?.allowedStates)
      === JSON.stringify(["RUNNING", "FAULT", "STANDBY", "STOPPED", "UNKNOWN"])
    && JSON.stringify(operationalStatePolicy?.requiredSignals)
      === JSON.stringify(["running", "fault", "remoteEnabled"])
    && signalCategories.running.expected === 54
    && signalCategories.fault.expected === 54
    && signalCategories.remoteEnabled.expected === 54
    && signalCategories.frequencyHz.expected === 47
    && operationalStateSelectorCount === 162
    && expectedSignalCount === 209
    && expectedSignals.every((item) => isExactNonBlankString(item.runtimeTagName))
    && new Set(expectedSignals.map((item) => item.runtimeTagName)).size === expectedSignalCount;
  const selectorCoveragePass = uniqueMatchedSignalCount === expectedSignalCount;
  const liveEvidencePass = liveSignalCount === expectedSignalCount;
  const replayContinuityPass = replayValidatedSignalCount === expectedSignalCount;
  const structuralEvidencePass = sourceStatusExactUniquePass
    && globalPointKeyUniquenessPass
    && pointKeyTagNameIdentityPass
    && frequencyUnitViolationCount === 0;
  // B25 currently has no reviewed instantaneous flow selectors. This explicit false gate
  // prevents equipment-only motion evidence from being misreported as a complete LIVE twin.
  const flowAnimationEvidencePass = false;
  const status = deriveAuditStatus({
    contractShapePass,
    controlBoundaryPass,
    structuralEvidencePass,
    replayIntegrityViolationCount,
    dualSnapshotPass,
    evidenceProfileRegisteredPass,
    sourceHealthy,
    selectorCoveragePass,
    liveEvidencePass,
    replayContinuityPass,
    flowAnimationEvidencePass
  });

  const replayHistory = {
    version: REPLAY_HISTORY_VERSION,
    siteId: SITE_ID,
    sourceKey: RUNTIME_SOURCE_KEY,
    updatedAt: new Date().toISOString(),
    points: Object.fromEntries(
      expectedSignals
        .map((expected) => [expected.runtimeTagName, updatedReplayHistoryPoints[expected.runtimeTagName]])
        .filter(([, state]) => state?.lastSample)
    )
  };
  const report = {
    status,
    evaluatedAt,
    siteId: SITE_ID,
    endpoint,
    httpStatus: response?.status ?? null,
    sourceKey: evidence?.sourceKey || null,
    evidenceProfileId: evidence?.evidenceProfileId || null,
    sourceHealthy,
    sourceStatus: runtimeSourceInspection?.source || null,
    snapshots: snapshots.map((snapshot, index) => ({
      index: index + 1,
      fetchedAt: snapshot.fetchedAt,
      httpStatus: snapshot.response?.status ?? null,
      responseOk: snapshot.response?.ok === true,
      sourceMatches: sourceInspections[index]?.matches ?? 0,
      sourceHealthy: sourceInspections[index]?.healthy ?? false,
      runtimeRegisterPoints: Array.isArray(snapshot.payload?.pointEvidence?.points)
        ? snapshot.payload.pointEvidence.points.length
        : 0
    })),
    secondSnapshotError: secondSnapshot.error,
    checks: {
      contractShape: contractShapePass ? "PASS" : "FAIL",
      freshnessPolicy: allFreshnessPoliciesPass ? "PASS" : "FAIL",
      dualSnapshot: dualSnapshotPass ? "PASS" : "BLOCKED",
      evidenceProfileRegistered: evidenceProfileRegisteredPass ? "PASS" : "BLOCKED",
      sourceStatusExactUnique: sourceStatusExactUniquePass ? "PASS" : "FAIL",
      sourceHealthNonFallback: sourceHealthy ? "PASS" : "BLOCKED",
      globalPointKeyUniqueness: globalPointKeyUniquenessPass ? "PASS" : "FAIL",
      pointKeyTagNameIdentity: pointKeyTagNameIdentityPass ? "PASS" : "FAIL",
      frequencyUnit: frequencyUnitViolationCount > 0
        ? "FAIL"
        : frequencyUnitCoveragePass
          ? "PASS"
          : "BLOCKED",
      selectorCoverageBySignal: Object.fromEntries(
        Object.entries(signalCategories).map(([signal, counts]) => [
          signal,
          counts.uniqueMatched === counts.expected ? "PASS" : "BLOCKED"
        ])
      ),
      selectorCoverage: selectorCoveragePass ? "PASS" : "BLOCKED",
      replayContinuity: replayIntegrityViolationCount > 0
        ? "FAIL"
        : replayContinuityPass
          ? "PASS"
          : "BLOCKED",
      liveEvidenceCoverage: liveEvidencePass ? "PASS" : "BLOCKED",
      liveEvidenceCoverageBySignal: Object.fromEntries(
        Object.entries(signalCategories).map(([signal, counts]) => [
          signal,
          counts.live === counts.expected ? "PASS" : "BLOCKED"
        ])
      ),
      flowAnimationEvidence: "BLOCKED_NO_EXPLICIT_INSTANT_FLOW_BINDING",
      controlBoundary: controlBoundaryPass ? "PASS" : "FAIL"
    },
    counts: {
      snapshotCount: snapshots.length,
      runtimeRegisterPoints: points.length,
      firstSnapshotRuntimeRegisterPoints: firstPoints.length,
      uniquePointKeys: pointKeyContracts.at(-1)?.uniquePointKeys ?? 0,
      firstSnapshotUniquePointKeys: pointKeyContracts[0]?.uniquePointKeys ?? 0,
      duplicatePointKeys: pointKeyContracts.reduce(
        (sum, contract) => sum + contract.duplicatePointKeys.length,
        0
      ),
      pointKeyTagNameMismatches: pointKeyContracts.reduce(
        (sum, contract) => sum + contract.pointKeyTagNameMismatches.length,
        0
      ),
      sourceStatusMatches: runtimeSourceInspection?.matches ?? 0,
      registeredEvidenceProfiles: REGISTERED_EVIDENCE_PROFILE_IDS.size,
      expectedEquipmentBindings: equipmentIds.length,
      expectedMotionEquipmentBindings: 47,
      expectedSignals: expectedSignalCount,
      expectedUniqueSelectors: expectedSignalCount,
      expectedOperationalStateSelectors: operationalStateSelectorCount,
      expectedRunningSignals: signalCategories.running.expected,
      expectedFaultSignals: signalCategories.fault.expected,
      expectedRemoteEnabledSignals: signalCategories.remoteEnabled.expected,
      expectedFrequencySignals: frequencySignals.length,
      signalCategories,
      firstSnapshotUniqueMatchedSignals: firstSnapshotUniqueMatchedSignalCount,
      uniqueMatchedSignals: uniqueMatchedSignalCount,
      missingOrAmbiguousSignals: expectedSignalCount - uniqueMatchedSignalCount,
      frequencyUnitViolations: frequencyUnitViolationCount,
      replayValidatedSignals: replayValidatedSignalCount,
      replayIntegrityViolations: replayIntegrityViolationCount,
      liveSignals: liveSignalCount,
      liveEquipment: liveEquipmentCount,
      liveOperationalStateEquipment: liveOperationalStateEquipmentCount,
      authoritativeRuntimePoints: evidence?.summary?.authoritativeTimestampPoints ?? null,
      missingTimestampRuntimePoints: evidence?.summary?.missingTimestampPoints ?? null,
      goodQualityRuntimePoints: evidence?.summary?.goodQualityPoints ?? null,
      replayProofRuntimePoints: evidence?.summary?.replayProofPoints ?? null,
      missingReplayProofRuntimePoints: evidence?.summary?.missingReplayProofPoints ?? null
    },
    pointKeyContractViolations: pointKeyContracts.map((contract, index) => ({
      snapshot: index + 1,
      missingPointKeys: contract.missingPointKeys,
      duplicatePointKeys: contract.duplicatePointKeys,
      pointKeyTagNameMismatches: contract.pointKeyTagNameMismatches
    })),
    blockedSignals: evaluatedSignals.filter((item) => !item.live),
    replayHistory,
    disclaimers: [
      "tagTime=5 is a legacy storage-period value and is not observedAt.",
      "generatedAt, fetchedAt and receivedAt are not accepted as authoritative point observation time.",
      "A PASS requires two runtime snapshots; a complete repeated sample or a monotonic same-boot advance is allowed.",
      "A PASS requires a code-owned evidenceProfileId from the audit allowlist; B25 is blocked until its decoder is registered.",
      "A boot change requires later observedAt, and a retired bootId cannot be reused (A-B-A is rejected).",
      "Frequency feedback accepts neither null, boolean nor blank values as zero and requires exact unit Hz.",
      "Frequency feedback scaling and VFD parity remain pending field confirmation.",
      "Operational state uses exact binary running, fault and remote-enabled selectors: explicit fault wins; missing, invalid or unusable evidence is UNKNOWN.",
      "Communication failure never implies FAULT, and only RUNNING may drive mechanical equipment animation.",
      "No explicit instantaneous flow binding exists, so flow animation evidence blocks top-level PASS.",
      "This audit is read-only and does not enable BA or PLC writes."
    ],
    truthPath: OUTPUT_PATH
  };
  writeReport(report);
  if (status !== "PASS") {
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}

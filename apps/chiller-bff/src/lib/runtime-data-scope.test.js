import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardOverviewScopeEvidence,
  buildFixedSubsystemDataScope,
  buildProjectUnfilteredDataScope,
  buildSiteAggregateDataScope,
  buildStationBindingDataScope,
  withRuntimeDataScope
} from "./runtime-data-scope.js";

test("buildFixedSubsystemDataScope reports an endpoint-enforced scope", () => {
  assert.deepEqual(buildFixedSubsystemDataScope(" 126lnoffice ", "chilled_plant"), {
    siteId: "126lnoffice",
    requestedSubsystemType: null,
    effectiveSubsystemType: "chilled_plant",
    stationId: null,
    filterMode: "fixed_subsystem",
    applied: true,
    reason: "ENDPOINT_FIXED_SCOPE"
  });
});

test("withRuntimeDataScope appends evidence without mutating the service payload", () => {
  const payload = { generatedAt: "2026-07-19T00:00:00.000Z" };
  const dataScope = buildFixedSubsystemDataScope("126lnoffice", "chilled_plant");
  const result = withRuntimeDataScope(payload, dataScope);

  assert.notEqual(result, payload);
  assert.equal("dataScope" in payload, false);
  assert.equal(result.dataScope, dataScope);
});

test("buildProjectUnfilteredDataScope never reports navigation context as applied", () => {
  assert.deepEqual(buildProjectUnfilteredDataScope("126lnoffice", "MIXED_SCOPE_PAYLOAD"), {
    siteId: "126lnoffice",
    requestedSubsystemType: null,
    effectiveSubsystemType: null,
    stationId: null,
    filterMode: "project_unfiltered",
    applied: false,
    reason: "MIXED_SCOPE_PAYLOAD"
  });
});

test("buildSiteAggregateDataScope identifies a project-wide object registry", () => {
  const scope = buildSiteAggregateDataScope("126lnoffice");
  assert.equal(scope.filterMode, "site_aggregate");
  assert.equal(scope.applied, true);
  assert.equal(scope.effectiveSubsystemType, null);
  assert.equal(scope.reason, "SITE_AGGREGATE");
});

test("buildStationBindingDataScope carries the exact published binding evidence", () => {
  const scope = buildStationBindingDataScope("site-a", {
    stationId: "chilled-a",
    parentSubsystemType: "chilled_plant",
    bindingVersion: 7,
    payloadHash: "hash-v7",
    selectors: {
      deviceIds: ["device-1", "device-2"],
      deviceCodes: ["CH1", "CH2"],
      pointCodes: ["run", "fault"]
    },
    validation: {
      matched: { deviceCount: 2 }
    }
  });

  assert.deepEqual(scope, {
    siteId: "site-a",
    requestedSubsystemType: "chilled_plant",
    effectiveSubsystemType: "chilled_plant",
    stationId: "chilled-a",
    filterMode: "station_binding",
    applied: true,
    reason: "STATION_RUNTIME_BINDING_APPLIED",
    bindingVersion: 7,
    payloadHash: "hash-v7",
    matchedDeviceCount: 2,
    cacheKey: "site-a:chilled-a:v7",
    selectorCounts: {
      deviceIds: 2,
      deviceCodes: 2,
      pointCodes: 2
    }
  });
});

test("dashboard overview separates cold metrics from project aggregates", () => {
  const evidence = buildDashboardOverviewScopeEvidence("126lnoffice");

  assert.equal(evidence.dataScope.applied, false);
  assert.equal(evidence.dataScope.reason, "MIXED_SCOPE_PAYLOAD");
  assert.equal(evidence.fieldScopes.chilledPlantMetrics.dataScope.applied, true);
  assert.equal(
    evidence.fieldScopes.chilledPlantMetrics.dataScope.effectiveSubsystemType,
    "chilled_plant"
  );
  assert.deepEqual(evidence.fieldScopes.chilledPlantMetrics.exclusions, []);
  assert.ok(
    evidence.fieldScopes.chilledPlantMetrics.fieldPaths.includes("energyCards.currentCop")
  );
  assert.equal(
    evidence.fieldScopes.chilledPlantMetrics.fieldPaths.includes("energyCards.outdoorWetBulbC"),
    false
  );
  assert.equal(evidence.fieldScopes.projectAggregate.dataScope.applied, false);
  assert.ok(
    evidence.fieldScopes.projectAggregate.fieldPaths.includes("deviceSummary.totalDevices")
  );
  assert.ok(
    evidence.fieldScopes.projectAggregate.fieldPaths.includes("energyCards.outdoorWetBulbC")
  );
});

test("fixed subsystem scope rejects missing identifiers", () => {
  assert.throws(() => buildFixedSubsystemDataScope("", "chilled_plant"), /siteId is required/);
  assert.throws(() => buildFixedSubsystemDataScope("126lnoffice", ""), /subsystemType is required/);
});

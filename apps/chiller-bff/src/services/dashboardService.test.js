import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommunicationPowerEvidence,
  buildTrendBuckets,
  deriveLoadRatePct,
  normalizeEfficiencyMetric,
  normalizeTrendSeriesForRange,
  pickCommunicationLatestTimestamp,
  resetCommunicationPowerObservations,
  shouldUseRequestedB25CloudHistory
} from "./dashboardService.js";

test("deriveLoadRatePct returns percentage when cooling capacities are available", () => {
  assert.equal(deriveLoadRatePct(1200, 2400), 50);
  assert.equal(deriveLoadRatePct(750, 1000), 75);
});

test("deriveLoadRatePct returns null when rated cooling capacity is missing or invalid", () => {
  assert.equal(deriveLoadRatePct(1200, null), null);
  assert.equal(deriveLoadRatePct(null, 2400), null);
  assert.equal(deriveLoadRatePct(1200, 0), null);
});

test("normalizeEfficiencyMetric treats non-positive values as unavailable", () => {
  assert.equal(normalizeEfficiencyMetric(5.2), 5.2);
  assert.equal(normalizeEfficiencyMetric(0), null);
  assert.equal(normalizeEfficiencyMetric(-1), null);
  assert.equal(normalizeEfficiencyMetric(null), null);
});

test("communication freshness ignores energy-only timestamps", () => {
  assert.equal(
    pickCommunicationLatestTimestamp(
      {
        latestTimestamp: null,
        sourceStatus: {
          ok: true,
          message: "OK; timestampMissing=true",
          rows: 17
        }
      },
      null
    ),
    null
  );
});

test("communication freshness uses latest realtime sample timestamp", () => {
  assert.equal(
    pickCommunicationLatestTimestamp(
      { latestTimestamp: "2026-06-22T03:20:00.000Z" },
      { overview: { latestTimestamp: "2026-06-22T03:10:00.000Z" } }
    ),
    "2026-06-22T03:20:00.000Z"
  );
});

test("communication power evidence starts with collecting state", () => {
  resetCommunicationPowerObservations();
  const result = buildCommunicationPowerEvidence("site-141", 103.2, Date.parse("2026-06-22T04:00:00.000Z"));

  assert.equal(result.status, "collecting");
  assert.equal(result.latestTimestamp, null);
  assert.equal(result.totalPowerKw, 103.2);
  assert.equal(result.sampleCount, 1);
});

test("communication power evidence infers online when total power changes", () => {
  resetCommunicationPowerObservations();
  buildCommunicationPowerEvidence("site-141", 103.2, Date.parse("2026-06-22T04:00:00.000Z"));
  const result = buildCommunicationPowerEvidence("site-141", 106.5, Date.parse("2026-06-22T04:03:00.000Z"));

  assert.equal(result.basis, "power_change");
  assert.equal(result.status, "changed");
  assert.equal(result.latestTimestamp, "2026-06-22T04:03:00.000Z");
  assert.equal(result.previousPowerKw, 103.2);
  assert.equal(result.deltaKw, 3.3);
});

test("communication power evidence marks long unchanged power as suspected frozen link", () => {
  resetCommunicationPowerObservations();
  buildCommunicationPowerEvidence("site-141", 103.2, Date.parse("2026-06-22T04:00:00.000Z"));
  const result = buildCommunicationPowerEvidence("site-141", 103.3, Date.parse("2026-06-22T04:31:00.000Z"));

  assert.equal(result.basis, "power_stable");
  assert.equal(result.status, "stable_suspect");
  assert.equal(result.latestTimestamp, null);
  assert.equal(result.sampleCount, 2);
});

test("shouldUseRequestedB25CloudHistory only enables B25 cloud history when request context explicitly carries B25 key", () => {
  const config = {
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  assert.equal(
    shouldUseRequestedB25CloudHistory(config, "140", {
      projectKey: "126lnoffice",
      projectKeyCandidates: ["126lnoffice", "140"]
    }),
    false
  );

  assert.equal(
    shouldUseRequestedB25CloudHistory(config, "140", {
      projectKey: "140btwentyfive",
      projectKeyCandidates: ["140btwentyfive", "140"]
    }),
    true
  );
});

test("24h trend buckets preserve a full day at ten-minute resolution", () => {
  const end = Date.parse("2026-06-15T10:20:00.000Z");
  const buckets = buildTrendBuckets("24h", end, { stepMs: 10 * 60 * 1000 });

  assert.equal(buckets.length, 145);
  assert.equal(new Date(buckets[0]).toISOString(), "2026-06-14T10:20:00.000Z");
  assert.equal(new Date(buckets.at(-1)).toISOString(), "2026-06-15T10:20:00.000Z");
  assert.equal(buckets[1] - buckets[0], 10 * 60 * 1000);
});

test("24h trend normalization keeps ten-minute points across the whole window", () => {
  const normalized = normalizeTrendSeriesForRange(
    [
      {
        metric: "currentCop",
        label: "冷站COP",
        points: [
          { t: "2026-06-14T10:20:00.000Z", v: 5.8 },
          { t: "2026-06-14T10:30:00.000Z", v: 5.9 },
          { t: "2026-06-15T10:20:00.000Z", v: 6.2 }
        ]
      }
    ],
    "24h",
    "2026-06-15T10:20:00.000Z",
    { stepMs: 10 * 60 * 1000 }
  );

  const points = normalized[0].points;
  assert.equal(points.length, 145);
  assert.deepEqual(points.slice(0, 3), [
    { t: "2026-06-14T10:20:00.000Z", v: 5.8 },
    { t: "2026-06-14T10:30:00.000Z", v: 5.9 },
    { t: "2026-06-14T10:40:00.000Z", v: null }
  ]);
  assert.deepEqual(points.at(-1), { t: "2026-06-15T10:20:00.000Z", v: 6.2 });
});

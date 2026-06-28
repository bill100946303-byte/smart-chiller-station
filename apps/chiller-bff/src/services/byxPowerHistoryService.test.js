import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendByxPowerHistorySnapshot,
  buildByxPowerHistorySample,
  getByxPowerHistory
} from "./byxPowerHistoryService.js";

function buildPowerData(generatedAt, overrides = {}) {
  const overrideValue = (key, fallback) => (
    Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback
  );
  return {
    ok: true,
    generatedAt,
    site: { siteId: "141", siteName: "141" },
    summary: {
      projectCount: 2,
      deviceCount: 34,
      onlineDeviceCount: 34,
      diagnosticDeviceCount: overrideValue("diagnosticDeviceCount", 1),
      totalActivePowerKw: overrideValue("totalActivePowerKw", 2.3),
      totalEnergyKwh: overrideValue("totalEnergyKwh", 39970),
      avgPowerFactor: overrideValue("avgPowerFactor", 0.67),
      categorySummaries: [
        {
          category: "lighting",
          label: "照明",
          deviceCount: 8,
          onlineDeviceCount: 8,
          diagnosticDeviceCount: 0,
          totalActivePowerKw: overrideValue("lightingKw", 1.1),
          totalEnergyKwh: 15660,
          avgPowerFactor: 0.57
        },
        {
          category: "outlet",
          label: "插座",
          deviceCount: 16,
          onlineDeviceCount: 16,
          diagnosticDeviceCount: 1,
          totalActivePowerKw: overrideValue("outletKw", 0.9),
          totalEnergyKwh: 16340,
          avgPowerFactor: overrideValue("outletAvgPowerFactor", 0.68)
        }
      ]
    }
  };
}

test("buildByxPowerHistorySample creates read-only category trend sample", () => {
  const sample = buildByxPowerHistorySample(buildPowerData("2026-06-22T08:00:00.000Z"));

  assert.equal(sample.mode, "read_only_history");
  assert.equal(sample.provider, "byx");
  assert.equal(sample.deviceCount, 34);
  assert.equal(sample.categories.length, 2);
  assert.equal(sample.categories[0].category, "lighting");
});

test("buildByxPowerHistorySample keeps missing numeric fields as null", () => {
  const sample = buildByxPowerHistorySample(buildPowerData("2026-06-22T08:00:00.000Z", {
    avgPowerFactor: null,
    outletAvgPowerFactor: null
  }));

  assert.equal(sample.avgPowerFactor, null);
  assert.equal(sample.categories.find((item) => item.category === "outlet")?.avgPowerFactor, null);
});

test("appendByxPowerHistorySnapshot persists deduped local-file history and series", () => {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-history-"));
  const config = { byxPowerHistoryDir: historyDir };

  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:00:00.000Z", {
    totalActivePowerKw: 2.1,
    lightingKw: 1.0
  }), { limit: 10 });
  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:01:00.000Z", {
    totalActivePowerKw: 2.4,
    lightingKw: 1.2
  }), { limit: 10 });
  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:01:00.000Z", {
    totalActivePowerKw: 2.5,
    lightingKw: 1.3
  }), { limit: 10 });

  const history = getByxPowerHistory(config, "141", { limit: 10 });
  assert.equal(history.ok, true);
  assert.equal(history.mode, "read_only_history");
  assert.equal(history.summary.sampleCount, 2);
  assert.equal(history.summary.latestTotalActivePowerKw, 2.5);
  assert.equal(history.series.find((item) => item.category === "lighting")?.points.length, 2);
  assert.equal(history.series.find((item) => item.category === "lighting")?.points[1].v, 1.3);
});

test("appendByxPowerHistorySnapshot respects retention limit", () => {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-history-limit-"));
  const config = { byxPowerHistoryDir: historyDir };

  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:00:00.000Z"), { limit: 2 });
  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:01:00.000Z"), { limit: 2 });
  appendByxPowerHistorySnapshot(config, "141", buildPowerData("2026-06-22T08:02:00.000Z"), { limit: 2 });

  const history = getByxPowerHistory(config, "141", { limit: 10 });
  assert.equal(history.summary.sampleCount, 2);
  assert.equal(history.summary.firstCapturedAt, "2026-06-22T08:01:00.000Z");
  assert.equal(history.summary.lastCapturedAt, "2026-06-22T08:02:00.000Z");
});

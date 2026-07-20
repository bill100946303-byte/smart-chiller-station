import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildByxPowerAssignmentHandoff } from "./build-byx-power-assignment-handoff.js";
import { checkByxPowerAssignmentHandoff } from "./check-byx-power-assignment-handoff.js";

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-handoff-check-"));
  try {
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildPowerData() {
  return {
    ok: true,
    configured: true,
    generatedAt: "2026-06-22T13:00:00.000Z",
    site: {
      siteId: "140",
      siteName: "观澜B25"
    },
    summary: {
      projectCount: 1,
      deviceCount: 2,
      onlineDeviceCount: 2,
      diagnosticDeviceCount: 1
    },
    projects: [
      {
        projectId: "P1",
        projectName: "盛世绿能电话厅",
        devices: [
          {
            deviceId: "D1",
            deviceName: "办公室灯",
            deviceTypeName: "1PNL",
            category: "lighting",
            categoryLabel: "照明",
            suggestedCategory: "lighting",
            suggestedCategoryLabel: "照明",
            assignmentStatus: "unconfirmed",
            online: true,
            switchClosed: false,
            activePowerKw: 0.12,
            energyKwh: 10,
            powerFactor: 0.8,
            voltageV: 233,
            currentA: 0.6,
            temperatureC: 36,
            leakageCurrentMa: 0,
            diagnosticFlags: []
          },
          {
            deviceId: "D2",
            deviceName: "卡5插座",
            deviceTypeName: "1PNL",
            category: "outlet",
            categoryLabel: "插座",
            suggestedCategory: "outlet",
            suggestedCategoryLabel: "插座",
            assignmentStatus: "unconfirmed",
            online: true,
            switchClosed: false,
            activePowerKw: 0.03,
            energyKwh: 20,
            powerFactor: 0.37,
            voltageV: 234,
            currentA: 0.3,
            temperatureC: 51,
            leakageCurrentMa: 0,
            diagnosticFlags: [
              {
                code: "low_power_factor",
                label: "功率因数偏低"
              }
            ]
          }
        ]
      }
    ]
  };
}

test("checkByxPowerAssignmentHandoff passes generated read-only handoff files", () => {
  withTempDir((tempDir) => {
    buildByxPowerAssignmentHandoff(buildPowerData(), { outputDir: tempDir });
    const result = checkByxPowerAssignmentHandoff({ siteId: "140", outputDir: tempDir });

    assert.equal(result.ok, true);
    assert.equal(result.controlMutation, false);
    assert.equal(result.boundary, "read_only_no_open_close_no_scene_execute");
    assert.equal(result.summary.deviceCount, 2);
    assert.equal(result.summary.boundaryCounts.read_only_no_open_close_no_scene_execute, 2);
    assert.deepEqual(result.blockingItems, []);
  });
});

test("checkByxPowerAssignmentHandoff blocks missing generated files", () => {
  withTempDir((tempDir) => {
    const result = checkByxPowerAssignmentHandoff({ siteId: "140", outputDir: tempDir });

    assert.equal(result.ok, false);
    assert.ok(result.blockingItems.some((item) => item.key === "csv_missing"));
    assert.ok(result.blockingItems.some((item) => item.key === "markdown_missing"));
    assert.ok(result.blockingItems.some((item) => item.key === "summaryJson_missing"));
  });
});

test("checkByxPowerAssignmentHandoff blocks CSV boundary drift", () => {
  withTempDir((tempDir) => {
    const summary = buildByxPowerAssignmentHandoff(buildPowerData(), { outputDir: tempDir });
    const csv = fs.readFileSync(summary.files.csv, "utf8")
      .replace(/read_only_no_open_close_no_scene_execute/, "write_enabled_unexpected");
    fs.writeFileSync(summary.files.csv, csv, "utf8");

    const result = checkByxPowerAssignmentHandoff({ siteId: "140", outputDir: tempDir });
    assert.equal(result.ok, false);
    assert.ok(result.blockingItems.some((item) => item.key === "boundary_count_mismatch"));
    assert.ok(result.blockingItems.some((item) => item.key === "csv_boundary_not_read_only"));
  });
});

test("checkByxPowerAssignmentHandoff blocks Markdown missing safety copy", () => {
  withTempDir((tempDir) => {
    const summary = buildByxPowerAssignmentHandoff(buildPowerData(), { outputDir: tempDir });
    const markdown = fs.readFileSync(summary.files.markdown, "utf8").replace("/Api/OpenOrClose", "OpenCloseRemoved");
    fs.writeFileSync(summary.files.markdown, markdown, "utf8");

    const result = checkByxPowerAssignmentHandoff({ siteId: "140", outputDir: tempDir });
    assert.equal(result.ok, false);
    assert.ok(result.blockingItems.some((item) => item.key === "markdown_missing_boundary_text"));
  });
});


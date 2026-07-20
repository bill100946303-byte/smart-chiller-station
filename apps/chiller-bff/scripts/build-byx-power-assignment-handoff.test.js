import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildByxPowerAssignmentHandoff,
  buildHandoffMarkdown
} from "./build-byx-power-assignment-handoff.js";

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-handoff-"));
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

test("buildByxPowerAssignmentHandoff writes CSV, Markdown, and summary JSON with read-only boundary", () => {
  withTempDir((tempDir) => {
    const summary = buildByxPowerAssignmentHandoff(buildPowerData(), { outputDir: tempDir });

    assert.equal(summary.ok, true);
    assert.equal(summary.controlMutation, false);
    assert.equal(summary.boundary, "read_only_no_open_close_no_scene_execute");
    assert.equal(summary.summary.deviceCount, 2);
    assert.equal(summary.summary.reviewStatusCounts["待业主确认"], 1);
    assert.equal(summary.summary.reviewStatusCounts["需复核诊断"], 1);
    assert.equal(summary.summary.boundaryCounts.read_only_no_open_close_no_scene_execute, 2);
    assert.equal(summary.checks.allRowsReadOnly, true);
    assert.equal(summary.checks.openCloseConnected, false);
    assert.equal(summary.checks.sceneExecuteConnected, false);
    assert.equal(summary.checks.plcWriteConnected, false);

    const csv = fs.readFileSync(summary.files.csv, "utf8");
    const markdown = fs.readFileSync(summary.files.markdown, "utf8");
    const json = JSON.parse(fs.readFileSync(summary.files.summaryJson, "utf8"));

    assert.equal(csv.charCodeAt(0), 0xFEFF);
    assert.match(csv, /"控制边界"/);
    assert.match(csv, /read_only_no_open_close_no_scene_execute/);
    assert.match(markdown, /不接分合闸/);
    assert.match(markdown, /不反写 PLC/);
    assert.equal(json.controlMutation, false);
    assert.equal(json.summary.deviceCount, 2);
  });
});

test("buildByxPowerAssignmentHandoff rejects unavailable BYX data", () => {
  withTempDir((tempDir) => {
    assert.throws(
      () => buildByxPowerAssignmentHandoff({
        ok: false,
        configured: false,
        missingConfig: ["BYX_POWER_BASE_URL"]
      }, { outputDir: tempDir }),
      /BYX power config missing/
    );
  });
});

test("buildHandoffMarkdown includes import and validation commands for the target site", () => {
  const markdown = buildHandoffMarkdown({
    siteId: "140",
    files: {
      csv: path.join(process.cwd(), "docs/byx/byx-power-assignment-140-latest.csv")
    },
    summary: {
      projectCount: 1,
      deviceCount: 2,
      onlineDeviceCount: 2,
      diagnosticDeviceCount: 1,
      confirmedDeviceCount: 0,
      unconfirmedDeviceCount: 2,
      reviewStatusCounts: {
        "待业主确认": 1,
        "需复核诊断": 1
      },
      categoryCounts: {
        "照明": 1,
        "插座": 1
      }
    }
  });

  assert.match(markdown, /--site-id=140 --merge/);
  assert.match(markdown, /check:byx-power-assignments -- --site-id=140/);
  assert.match(markdown, /\/Api\/OpenOrClose/);
  assert.match(markdown, /\/Api\/Scene\/Execute/);
});


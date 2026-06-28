import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkByxPowerAssignments } from "./check-byx-power-assignments.js";

async function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-assignment-check-"));
  try {
    return await callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildConfig(publicKey, assignmentFile) {
  return {
    defaultSiteId: "140",
    byxPowerBaseUrl: "https://byx.example.com",
    byxPowerApp: "ssln",
    byxPowerPublicKey: publicKey,
    byxPowerLoginId: "office-login",
    byxPowerTimeoutMs: 1000,
    byxPowerAssignmentFile: assignmentFile
  };
}

function mockByxFetch(devices) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(new URLSearchParams(init.body).get("loginid"), "office-login");
    return new Response(JSON.stringify({
      state: true,
      data: [
        {
          projectId: "P1",
          projectName: "盛世绿能电话厅",
          deviceList: devices
        }
      ]
    }), { status: 200 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function writeAssignmentFile(filePath, assignments) {
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    assignments
  }), "utf8");
}

test("checkByxPowerAssignments passes when confirmed assignments match live BYX devices", async () => {
  await withTempDir(async (tempDir) => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const assignmentFile = path.join(tempDir, "assignments.json");
    writeAssignmentFile(assignmentFile, [
      {
        siteId: "140",
        projectId: "P1",
        deviceId: "D1",
        deviceName: "办公室灯",
        category: "lighting",
        system: "办公配电",
        location: "办公室",
        panel: "AL-1/01",
        status: "confirmed"
      }
    ]);
    const restoreFetch = mockByxFetch([
      {
        deviceId: "D1",
        deviceName: "办公室灯",
        deviceTypeName: "1PNL",
        infoBody: {
          status: "01",
          state: "0",
          yggl: 120,
          ygnl: 10,
          glys: 0.8
        }
      }
    ]);

    try {
      const summary = await checkByxPowerAssignments({
        siteId: "140",
        assignmentFile,
        minConfirmed: 1
      }, buildConfig(publicKey, assignmentFile));
      assert.equal(summary.ok, true);
      assert.equal(summary.controlMutation, false);
      assert.equal(summary.summary.deviceCount, 1);
      assert.equal(summary.summary.confirmedDeviceCount, 1);
      assert.equal(summary.summary.unmatchedAssignmentCount, 0);
      assert.equal(summary.blockingItems.length, 0);
      assert.equal(summary.sampleConfirmedDevices[0].ownerConfirmedPanel, "AL-1/01");
    } finally {
      restoreFetch();
    }
  });
});

test("checkByxPowerAssignments blocks when assignment file is missing", async () => {
  await withTempDir(async (tempDir) => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const assignmentFile = path.join(tempDir, "missing.json");
    const restoreFetch = mockByxFetch([
      {
        deviceId: "D1",
        deviceName: "办公室灯",
        infoBody: {
          status: "01",
          state: "0",
          yggl: 120
        }
      }
    ]);

    try {
      const summary = await checkByxPowerAssignments({
        siteId: "140",
        assignmentFile,
        minConfirmed: 1
      }, buildConfig(publicKey, assignmentFile));
      assert.equal(summary.ok, false);
      assert.equal(summary.summary.confirmedDeviceCount, 0);
      assert.ok(summary.blockingItems.some((item) => item.key === "assignment_file_missing"));
      assert.ok(summary.blockingItems.some((item) => item.key === "confirmed_coverage_too_low"));
    } finally {
      restoreFetch();
    }
  });
});

test("checkByxPowerAssignments reports stale assignment rows that no longer match live devices", async () => {
  await withTempDir(async (tempDir) => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const assignmentFile = path.join(tempDir, "assignments.json");
    writeAssignmentFile(assignmentFile, [
      {
        siteId: "140",
        projectId: "P1",
        deviceId: "D-STALE",
        deviceName: "旧设备",
        category: "lighting",
        status: "confirmed"
      }
    ]);
    const restoreFetch = mockByxFetch([
      {
        deviceId: "D1",
        deviceName: "办公室灯",
        infoBody: {
          status: "01",
          state: "0",
          yggl: 120
        }
      }
    ]);

    try {
      const summary = await checkByxPowerAssignments({
        siteId: "140",
        assignmentFile,
        minConfirmed: 0
      }, buildConfig(publicKey, assignmentFile));
      assert.equal(summary.ok, false);
      assert.equal(summary.summary.assignmentEntryCount, 1);
      assert.equal(summary.summary.matchedDeviceCount, 0);
      assert.equal(summary.summary.unmatchedAssignmentCount, 1);
      assert.ok(summary.blockingItems.some((item) => item.key === "unmatched_assignments"));
    } finally {
      restoreFetch();
    }
  });
});

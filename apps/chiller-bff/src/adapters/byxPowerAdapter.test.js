import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildByxPowerAssignmentCsv, buildByxPowerAssignmentRows, buildByxSign, getByxPowerMonitoring } from "./byxPowerAdapter.js";

test("getByxPowerMonitoring reports waiting_config when credentials are missing", async () => {
  const payload = await getByxPowerMonitoring({}, "126lnoffice");

  assert.equal(payload.ok, false);
  assert.equal(payload.configured, false);
  assert.deepEqual(payload.missingConfig, [
    "BYX_POWER_BASE_URL",
    "BYX_POWER_APP",
    "BYX_POWER_PUBLIC_KEY",
    "BYX_POWER_LOGIN_ID"
  ]);
  assert.equal(payload.sourceStatus.overall, "failed");
  assert.equal(payload.sourceStatus.sources[0].reasonCode, "waiting_config");
});

test("getByxPowerMonitoring normalizes BYX project list payload", async () => {
  const originalFetch = globalThis.fetch;
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(init.headers["byx-app"], "ssln");
    assert.equal(new URLSearchParams(init.body).get("loginid"), "office-login");
    return new Response(JSON.stringify({
      state: true,
      data: [
        {
          projectId: "p1",
          projectName: "盛世绿能办公楼",
          deviceList: [
            {
              deviceId: "m1",
              deviceName: "总进线",
              deviceTypeName: "智能断路器",
              infoBody: {
                status: "01",
                state: "1",
                yggl: 12340,
                ygnl: 100.5,
                glys: 0.96,
                dl: 20,
                dy: 220
              }
            },
            {
              deviceId: "m2",
              deviceName: "冷站馈线",
              deviceTypeName: "智能电表",
              infoBody: {
                status: "02",
                state: "0",
                yggl: 3000,
                zydl: 20,
                glys: 0.9
              }
            }
          ]
        }
      ]
    }), { status: 200 });
  };

  try {
    const payload = await getByxPowerMonitoring({
      byxPowerBaseUrl: "https://byx.example.com",
      byxPowerApp: "ssln",
      byxPowerPublicKey: publicKey,
      byxPowerLoginId: "office-login",
      byxPowerTimeoutMs: 1000
    }, "126lnoffice");

    assert.equal(payload.ok, true);
    assert.equal(payload.configured, true);
    assert.equal(payload.summary.projectCount, 1);
    assert.equal(payload.summary.deviceCount, 2);
    assert.equal(payload.summary.onlineDeviceCount, 1);
    assert.equal(payload.summary.totalActivePowerKw, 15.34);
    assert.equal(payload.summary.totalEnergyKwh, 120.5);
    assert.equal(payload.summary.avgPowerFactor, 0.93);
    assert.equal(payload.summary.diagnosticDeviceCount, 1);
    assert.ok(payload.summary.categorySummaries.some((item) => item.category === "chiller_plant"));
    assert.equal(payload.summary.categorySummaries.find((item) => item.category === "chiller_plant")?.label, "冷站动力");
    assert.equal(payload.projects[0].devices[0].switchClosed, true);
    assert.equal(payload.projects[0].devices[1].category, "chiller_plant");
    assert.equal(payload.projects[0].devices[1].categoryLabel, "冷站动力");
    assert.equal(payload.projects[0].devices[1].diagnosticFlags[0].code, "offline");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getByxPowerMonitoring overlays owner-confirmed circuit assignments", async () => {
  const originalFetch = globalThis.fetch;
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const assignmentFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "byx-assignment-")), "assignments.json");
  fs.writeFileSync(assignmentFile, JSON.stringify({
    version: 1,
    assignments: [
      {
        siteId: "141",
        projectId: "p1",
        deviceId: "m1",
        category: "后勤用电",
        system: "办公配电",
        location: "茶水间",
        panel: "AL-1/05",
        status: "confirmed",
        note: "业主确认照明名称实际为后勤回路"
      }
    ]
  }), "utf8");

  globalThis.fetch = async () => new Response(JSON.stringify({
    state: true,
    data: [
      {
        projectId: "p1",
        projectName: "盛世绿能电话厅",
        deviceList: [
          {
            deviceId: "m1",
            deviceName: "办公室灯",
            deviceTypeName: "1PNL",
            infoBody: {
              status: "01",
              state: "0",
              yggl: 120,
              ygnl: 103.4,
              glys: 0.72
            }
          }
        ]
      }
    ]
  }), { status: 200 });

  try {
    const payload = await getByxPowerMonitoring({
      byxPowerBaseUrl: "https://byx.example.com",
      byxPowerApp: "ssln",
      byxPowerPublicKey: publicKey,
      byxPowerLoginId: "office-login",
      byxPowerTimeoutMs: 1000,
      byxPowerAssignmentFile: assignmentFile
    }, "141");

    const device = payload.projects[0].devices[0];
    assert.equal(device.suggestedCategory, "lighting");
    assert.equal(device.category, "logistics");
    assert.equal(device.categoryLabel, "后勤用电");
    assert.equal(device.assignmentStatus, "confirmed");
    assert.equal(device.ownerConfirmedLocation, "茶水间");
    assert.equal(payload.assignmentMap.confirmedDeviceCount, 1);
    assert.equal(payload.summary.categorySummaries[0].category, "logistics");
    assert.equal(payload.sourceStatus.sources.find((source) => source.key === "byxPowerAssignmentMap")?.rows, 1);

    const rows = buildByxPowerAssignmentRows(payload);
    assert.equal(rows[0].suggestedCategoryLabel, "照明");
    assert.equal(rows[0].reviewLabel, "已确认");
    assert.equal(rows[0].ownerConfirmedCategory, "后勤用电");
    assert.equal(rows[0].ownerConfirmedPanel, "AL-1/05");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getByxPowerMonitoring reports invalid_signing_key for an incomplete BYX public key", async () => {
  const payload = await getByxPowerMonitoring({
    byxPowerBaseUrl: "https://byx.example.com",
    byxPowerApp: "ssln",
    byxPowerPublicKey:
      "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHj5pbXCi5jM0aJFqKeHO0wzctsyuQbpu5s715E62Ncg1q2AdQE2VGmd3XQdwgoUlguNVH5cBSrEVpzYBwIM/mBW/E84rtyXWcq+GHSlk0K6UI09l1SnsmnksLlcZ6jXu8UHr23w6TvvQN1ggAxQ+HGojcfEoXQIDAQAB",
    byxPowerLoginId: "office-login",
    byxPowerTimeoutMs: 1000
  }, "126lnoffice");

  assert.equal(payload.ok, false);
  assert.equal(payload.configured, true);
  assert.equal(payload.sourceStatus.sources[0].reasonCode, "invalid_signing_key");
});

test("buildByxSign returns an RSA encrypted base64 signature", () => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const signature = buildByxSign(1782000000, publicKey);
  assert.match(signature, /^[A-Za-z0-9+/]+=*$/);
  assert.ok(signature.length > 100);
});

test("buildByxPowerAssignmentCsv exports owner confirmation columns with read-only boundary", () => {
  const powerData = {
    ok: true,
    site: { siteId: "141", siteName: "141" },
    generatedAt: "2026-06-22T08:00:00.000Z",
    projects: [
      {
        projectId: "p1",
        projectName: "盛世绿能电话厅",
        devices: [
          {
            deviceId: "d1",
            deviceName: "厨房",
            deviceTypeName: "1PNL",
            category: "logistics",
            categoryLabel: "后勤用电",
            online: true,
            switchClosed: false,
            activePowerKw: 0.12,
            energyKwh: 103.4,
            powerFactor: 0.47,
            voltageV: 221,
            currentA: 1.2,
            temperatureC: 53,
            leakageCurrentMa: 1.47,
            diagnosticFlags: [{ code: "low_power_factor", label: "功率因数偏低" }]
          }
        ]
      }
    ]
  };

  const rows = buildByxPowerAssignmentRows(powerData);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reviewStatus, "need_diagnostic_review");
  assert.equal(rows[0].controlBoundary, "read_only_no_open_close_no_scene_execute");

  const csv = buildByxPowerAssignmentCsv(powerData);
  assert.match(csv, /"业主确认用途"/);
  assert.match(csv, /"功率因数偏低"/);
  assert.match(csv, /"read_only_no_open_close_no_scene_execute"/);
});

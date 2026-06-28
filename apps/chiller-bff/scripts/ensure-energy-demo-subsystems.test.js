import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createAdminStore } from "../src/lib/admin-db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "ensure-energy-demo-subsystems.js");

const actor = {
  userId: "test",
  username: "test"
};

function runScript(args) {
  const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function withTempStore(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chiller-energy-demo-"));
  const dbFile = path.join(tempDir, "admin.sqlite");
  try {
    callback(dbFile);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("ensure-energy-demo-subsystems publishes B25 as cold-plant only and clears non-chiller mappings", () => {
  withTempStore((dbFile) => {
    const adminStore = createAdminStore({ dbFile });
    adminStore.createSite(
      {
        siteId: "140",
        siteName: "观澜 B25",
        status: "active"
      },
      actor
    );
    adminStore.upsertPointRoleMappings(
      "140",
      {
        subsystemType: "compressed_air",
        items: [
          {
            pointRole: "power",
            pointName: "历史空压演示功率",
            pointCode: "OLD_AIR_TOTAL_KW",
            required: true,
            writable: false
          }
        ]
      },
      actor
    );
    adminStore.close();

    const summary = runScript([
      `--db-file=${dbFile}`,
      "--profile=b25-cold-only",
      "--site-id=140",
      "--version-id=test-b25-cold-only"
    ]);
    const repeated = runScript([
      `--db-file=${dbFile}`,
      "--profile=b25-cold-only",
      "--site-id=140",
      "--version-id=test-b25-cold-only"
    ]);
    assert.deepEqual(summary.enabledSubsystems, ["chilled_plant"]);
    assert.deepEqual(repeated.enabledSubsystems, ["chilled_plant"]);
    assert.equal(summary.sourceStatusBySubsystem.chilled_plant, "ok");
    assert.equal(summary.sourceStatusBySubsystem.compressed_air, "not_configured");
    assert.equal(summary.mappingRowsBySubsystem.chilled_plant, 5);
    assert.equal(summary.mappingRowsBySubsystem.compressed_air, 0);
    assert.equal(summary.writeEnabledBySubsystem.chilled_plant, false);

    const verifiedStore = createAdminStore({ dbFile });
    const capabilities = verifiedStore.getSiteCapabilities("140", { publishedOnly: true });
    const chilledPlant = capabilities.items.find((item) => item.subsystemType === "chilled_plant");
    const compressedAir = capabilities.items.find((item) => item.subsystemType === "compressed_air");
    const powerMonitoring = capabilities.items.find((item) => item.subsystemType === "power_monitoring");
    const boilerRoom = capabilities.items.find((item) => item.subsystemType === "boiler_room");
    const hvacTerminal = capabilities.items.find((item) => item.subsystemType === "hvac_terminal");
    assert.equal(chilledPlant?.status, "enabled");
    assert.equal(chilledPlant?.sourceStatus, "ok");
    assert.equal(chilledPlant?.pointMappingProgress, 100);
    for (const item of [compressedAir, powerMonitoring, boilerRoom, hvacTerminal]) {
      assert.equal(item?.status, "not_configured");
      assert.equal(item?.sourceStatus, "not_configured");
      assert.deepEqual(item?.kpis, []);
      assert.equal(item?.alarmCount, null);
      assert.deepEqual(item?.advisorBindings, []);
    }

    const airMappings = verifiedStore.listPointRoleMappings("140", {
      subsystemType: "compressed_air"
    });
    assert.equal(airMappings.items.length, 0);
    verifiedStore.close();
  });
});

test("ensure-energy-demo-subsystems publishes Shengshi Green Energy office as all-system demo data", () => {
  withTempStore((dbFile) => {
    const summary = runScript([
      `--db-file=${dbFile}`,
      "--profile=office-all-systems-demo",
      "--site-id=126lnoffice",
      "--version-id=test-office-all-systems"
    ]);
    const repeated = runScript([
      `--db-file=${dbFile}`,
      "--profile=office-all-systems-demo",
      "--site-id=126lnoffice",
      "--version-id=test-office-all-systems"
    ]);

    assert.equal(summary.siteName, "盛世绿能办公楼");
    assert.equal(repeated.siteName, "盛世绿能办公楼");
    assert.deepEqual(summary.enabledSubsystems, [
      "chilled_plant",
      "power_monitoring",
      "compressed_air",
      "boiler_room",
      "hvac_terminal"
    ]);
    for (const subsystemType of summary.enabledSubsystems) {
      assert.equal(summary.sourceStatusBySubsystem[subsystemType], "demo_data");
      assert.equal(summary.pointMappingProgressBySubsystem[subsystemType], 100);
      assert.equal(summary.writeEnabledBySubsystem[subsystemType], subsystemType === "hvac_terminal");
      assert.ok(summary.mappingRowsBySubsystem[subsystemType] > 0);
    }
    assert.deepEqual(summary.fcuControlPolicy, {
      enabled: true,
      defaultMode: "enforced",
      dispatchAdapter: "legacy-scene-command",
      whitelistCount: 29,
      allowStartStop: true,
      allowSetpoint: true,
      allowFanSpeed: true
    });

    const verifiedStore = createAdminStore({ dbFile });
    const site = verifiedStore.getSite("126lnoffice");
    assert.equal(site?.siteName, "盛世绿能办公楼");
    const capabilities = verifiedStore.getSiteCapabilities("126lnoffice", { publishedOnly: true });
    const enabled = capabilities.items.filter((item) => item.status === "enabled" && item.reserved !== true);
    assert.equal(enabled.length, 5);
    for (const item of enabled) {
      assert.equal(item.sourceStatus, "demo_data");
      assert.equal(item.freshnessStatus, "demo_data");
      if (item.subsystemType === "hvac_terminal") {
        assert.equal(item.controlBoundary?.mode, "enforced");
        assert.equal(item.controlBoundary?.writeEnabled, true);
      } else {
        assert.equal(item.controlBoundary?.mode, "read_only");
        assert.equal(item.controlBoundary?.writeEnabled, false);
      }
      assert.equal(item.advisorBindings.length, 1);
      assert.equal(item.advisorBindings[0]?.status, "demo_data");
      assert.equal(item.pointMappingProgress, 100);
    }
    const fcuControlPolicy = verifiedStore.getFcuControlPolicy("126lnoffice");
    assert.equal(fcuControlPolicy?.policy?.defaultMode, "enforced");
    assert.equal(fcuControlPolicy?.policy?.dispatchAdapter, "legacy-scene-command");
    assert.equal(fcuControlPolicy?.policy?.whitelist?.length, 29);
    assert.equal(fcuControlPolicy?.policy?.allowStartStop, true);
    assert.equal(fcuControlPolicy?.policy?.allowSetpoint, true);
    assert.equal(fcuControlPolicy?.policy?.allowFanSpeed, true);
    verifiedStore.close();
  });
});

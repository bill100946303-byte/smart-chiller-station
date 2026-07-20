import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createAdminStore } from "./admin-db.js";

const actor = {
  userId: "planner",
  username: "planner"
};

function createStoreWithSite() {
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  adminStore.createSite(
    {
      siteId: "site-energy",
      siteName: "综合能源站测试",
      status: "active"
    },
    actor
  );
  return adminStore;
}

test("energy config migrations are idempotent across admin store restarts", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chiller-admin-energy-"));
  const dbFile = path.join(tempDir, "admin.sqlite");
  try {
    const firstStore = createAdminStore({ dbFile });
    firstStore.createSite(
      {
        siteId: "site-energy",
        siteName: "综合能源站测试",
        status: "active"
      },
      actor
    );
    firstStore.close();

    const secondStore = createAdminStore({ dbFile });
    const capabilities = secondStore.getSiteCapabilities("site-energy", { publishedOnly: true });
    assert.equal(capabilities.items.length, 9);
    assert.ok(capabilities.items.some((item) => item.subsystemType === "power_monitoring"));
    secondStore.close();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("energy config seeds default subsystem capabilities without fake KPI for unconfigured systems", () => {
  const adminStore = createStoreWithSite();
  const registry = adminStore.listSubsystemRegistry();
  assert.ok(registry.some((item) => item.subsystemType === "chilled_plant"));
  assert.ok(registry.some((item) => item.subsystemType === "power_monitoring"));
  const airRegistry = registry.find((item) => item.subsystemType === "compressed_air");
  assert.deepEqual(
    airRegistry?.pointRoles.filter((item) => item.required !== false).map((item) => item.role),
    ["power", "pressure", "flow", "status", "alarm"]
  );

  const capabilities = adminStore.getSiteCapabilities("site-energy", { publishedOnly: true });
  const chilledPlant = capabilities.items.find((item) => item.subsystemType === "chilled_plant");
  const power = capabilities.items.find((item) => item.subsystemType === "power_monitoring");
  const compressedAir = capabilities.items.find((item) => item.subsystemType === "compressed_air");

  assert.equal(chilledPlant?.status, "enabled");
  assert.equal(power?.status, "not_configured");
  assert.deepEqual(power?.kpis, []);
  assert.equal(power?.alarmCount, null);
  assert.deepEqual(power?.advisorBindings, []);
  assert.equal(compressedAir?.status, "not_configured");

  adminStore.close();
});

test("energy config compressed-air import preview recognizes read-only access package roles", () => {
  const adminStore = createStoreWithSite();
  const preview = adminStore.previewPointRoleMappingImport("site-energy", {
    subsystemType: "compressed_air",
    text: [
      "空压站总功率,AIR_TOTAL_KW,kW",
      "管网压力,AIR_NET_BAR,bar",
      "供气流量,AIR_FLOW_NM3_MIN,Nm3/min",
      "空压机加载状态,AIR_COMP_LOAD_STATUS,",
      "空压站故障报警,AIR_ALARM_STATUS,",
      "干燥机露点,AIR_DRYER_DEW_TEMP,°C",
      "空压单耗,AIR_SPECIFIC_KWH_NM3,kWh/Nm3",
      "空压机启停命令,AIR_START_CMD,"
    ].join("\n")
  });

  assert.deepEqual(
    preview.items.map((item) => item.pointRole),
    ["power", "pressure", "flow", "status", "alarm", "temperature", "feedback", "command"]
  );
  assert.equal(preview.items[7].writable, false);
  assert.ok(preview.items[7].warnings.some((item) => item.includes("写点")));
  assert.equal(preview.acceptedRows, 7);

  adminStore.close();
});

test("energy config updates subsystem boundary and previews point import without enabling writes", () => {
  const adminStore = createStoreWithSite();
  const updated = adminStore.upsertSiteSubsystems(
    "site-energy",
    {
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled",
          mode: "monitoring",
          controlBoundary: {
            mode: "shadow",
            approvalRequired: true,
            plcProtectionRequired: true,
            rollbackRequired: true
          },
          advisorBinding: {
            pluginKey: "power_advisor",
            status: "available",
            mode: "monitoring"
          }
        }
      ]
    },
    actor
  );
  const power = updated.items.find((item) => item.subsystemType === "power_monitoring");
  assert.equal(power?.status, "enabled");
  assert.equal(power?.controlBoundary.mode, "shadow");
  assert.equal(power?.controlBoundary.writeEnabled, false);
  assert.equal(power?.advisorBindings[0]?.pluginKey, "power_advisor");

  const preview = adminStore.previewPointRoleMappingImport("site-energy", {
    subsystemType: "power_monitoring",
    text: "总进线有功功率,P_MAIN_KW,kW\n控制命令,P_MAIN_CMD,"
  });
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.items[0].pointRole, "power");
  assert.equal(preview.items[1].writable, false);
  assert.ok(preview.items[1].warnings.some((item) => item.includes("写点")));

  adminStore.close();
});

test("energy config publish and rollback restores subsystem snapshots", () => {
  const adminStore = createStoreWithSite();
  adminStore.upsertSiteSubsystems(
    "site-energy",
    {
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled",
          controlBoundary: {
            mode: "shadow"
          }
        }
      ]
    },
    actor
  );
  adminStore.publishConfigVersion("site-energy", "cfg-test", actor);
  adminStore.upsertSiteSubsystems(
    "site-energy",
    {
      items: [
        {
          subsystemType: "power_monitoring",
          status: "not_configured"
        }
      ]
    },
    actor
  );
  assert.equal(
    adminStore.getSiteCapabilities("site-energy", { publishedOnly: true }).items.find((item) => item.subsystemType === "power_monitoring")?.status,
    "not_configured"
  );

  const rollback = adminStore.rollbackConfigVersion("site-energy", "cfg-test", actor);
  assert.equal(rollback.version.status, "rolled_back");
  assert.equal(
    adminStore.getSiteCapabilities("site-energy", { publishedOnly: true }).items.find((item) => item.subsystemType === "power_monitoring")?.status,
    "enabled"
  );

  adminStore.close();
});

test("energy config versions are listed per site and allow reused version ids", () => {
  const adminStore = createStoreWithSite();
  adminStore.createSite(
    {
      siteId: "site-energy-air",
      siteName: "冷站加空压示例",
      status: "active"
    },
    actor
  );
  adminStore.upsertSiteSubsystems(
    "site-energy-air",
    {
      items: [
        {
          subsystemType: "compressed_air",
          status: "enabled",
          controlBoundary: {
            mode: "shadow"
          },
          advisorBinding: {
            pluginKey: "compressed_air_advisor",
            status: "available",
            mode: "monitoring"
          }
        }
      ]
    },
    actor
  );

  adminStore.publishConfigVersion("site-energy", "cfg-demo", actor, {
    summary: "冷站-only 示例"
  });
  adminStore.publishConfigVersion("site-energy-air", "cfg-demo", actor, {
    summary: "冷站+空压 示例"
  });

  const firstSiteVersions = adminStore.listConfigVersions("site-energy");
  const secondSiteVersions = adminStore.listConfigVersions("site-energy-air");

  assert.equal(firstSiteVersions.items.length, 1);
  assert.equal(firstSiteVersions.items[0].versionId, "cfg-demo");
  assert.equal(firstSiteVersions.items[0].siteId, "site-energy");
  assert.equal(firstSiteVersions.items[0].summary, "冷站-only 示例");
  assert.equal(firstSiteVersions.items[0].payload, undefined);
  assert.equal(secondSiteVersions.items.length, 1);
  assert.equal(secondSiteVersions.items[0].versionId, "cfg-demo");
  assert.equal(secondSiteVersions.items[0].siteId, "site-energy-air");
  assert.equal(secondSiteVersions.items[0].summary, "冷站+空压 示例");

  adminStore.close();
});

test("published config versions are immutable within a site", () => {
  const adminStore = createStoreWithSite();
  const before = adminStore.publishConfigVersion("site-energy", "cfg-immutable", actor, {
    summary: "first snapshot"
  });

  adminStore.upsertSiteSubsystems(
    "site-energy",
    {
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled"
        }
      ]
    },
    actor
  );

  assert.throws(
    () =>
      adminStore.publishConfigVersion("site-energy", "cfg-immutable", actor, {
        summary: "attempted overwrite"
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "CONFLICT");
      assert.equal(error.details?.versionId, "cfg-immutable");
      return true;
    }
  );

  const rollback = adminStore.rollbackConfigVersion("site-energy", "cfg-immutable", actor);
  assert.equal(rollback.version.summary, "first snapshot");
  assert.deepEqual(rollback.version.payload, before.payload);
  adminStore.close();
});

test("energy config publishedOnly excludes unpublished subsystems and publish rollback writes audit logs", () => {
  const adminStore = createStoreWithSite();
  adminStore.upsertSiteSubsystems(
    "site-energy",
    {
      items: [
        {
          subsystemType: "power_monitoring",
          status: "enabled",
          published: false,
          kpis: [{ key: "demandKw", value: 1200 }],
          advisorBinding: {
            pluginKey: "power_advisor",
            status: "available"
          }
        }
      ]
    },
    actor
  );

  const publishedOnlyBefore = adminStore.getSiteCapabilities("site-energy", { publishedOnly: true });
  assert.equal(
    publishedOnlyBefore.items.some((item) => item.subsystemType === "power_monitoring"),
    false
  );
  const fullCapabilities = adminStore.getSiteCapabilities("site-energy");
  assert.equal(
    fullCapabilities.items.find((item) => item.subsystemType === "power_monitoring")?.status,
    "enabled"
  );

  adminStore.publishConfigVersion("site-energy", "cfg-audit", actor);
  const publishedOnlyAfter = adminStore.getSiteCapabilities("site-energy", { publishedOnly: true });
  assert.equal(
    publishedOnlyAfter.items.find((item) => item.subsystemType === "power_monitoring")?.status,
    "enabled"
  );

  adminStore.rollbackConfigVersion("site-energy", "cfg-audit", actor);
  const audits = adminStore.listAuditLogs({ siteId: "site-energy", limit: 20 }, { allowAllSites: true });
  assert.ok(audits.some((item) => item.action === "site.config-version.publish" && item.targetId === "cfg-audit"));
  assert.ok(audits.some((item) => item.action === "site.config-version.rollback" && item.targetId === "cfg-audit"));

  adminStore.close();
});

test("energy config keeps physical station instances separate from subsystem capabilities", () => {
  const adminStore = createStoreWithSite();
  const staged = adminStore.upsertStationInstances(
    "site-energy",
    {
      items: [
        {
          stationId: "chilled-a",
          stationName: "冷冻站 A",
          parentSubsystemType: "chilled_plant",
          status: "enabled",
          sortOrder: 10
        },
        {
          stationId: "chilled-b",
          stationName: "冷冻站 B",
          parentSubsystemType: "chilled_plant",
          status: "not_configured",
          sortOrder: 20
        },
        {
          stationId: "air-01",
          stationName: "空压站 1",
          parentSubsystemType: "compressed_air",
          status: "not_configured",
          sortOrder: 30
        }
      ]
    },
    actor
  );

  assert.deepEqual(staged.items.map((item) => item.stationId), ["chilled-a", "chilled-b", "air-01"]);
  assert.equal(staged.items[0].published, false);
  assert.equal(staged.items[0].sourceStatus, "not_configured");
  assert.equal(staged.items[0].freshnessStatus, "not_configured");
  assert.equal(staged.items[0].alarmCount, null);
  assert.equal(
    adminStore.getSiteCapabilities("site-energy", { publishedOnly: true }).stationTotal,
    0
  );

  adminStore.publishConfigVersion("site-energy", "cfg-stations", actor);
  const published = adminStore.getSiteCapabilities("site-energy", { publishedOnly: true });
  assert.equal(published.stationTotal, 3);
  assert.deepEqual(
    published.stationInstances.map((item) => item.parentSubsystemType),
    ["chilled_plant", "chilled_plant", "compressed_air"]
  );
  assert.equal(published.items.filter((item) => item.subsystemType === "chilled_plant").length, 1);

  adminStore.upsertStationInstances(
    "site-energy",
    {
      items: [
        {
          stationId: "chilled-a",
          stationName: "已改名冷冻站",
          parentSubsystemType: "chilled_plant"
        }
      ]
    },
    actor
  );
  adminStore.rollbackConfigVersion("site-energy", "cfg-stations", actor);
  assert.equal(
    adminStore.listStationInstances("site-energy").items.find((item) => item.stationId === "chilled-a")?.stationName,
    "冷冻站 A"
  );
  const rolledBackPublishedStations = adminStore.listStationInstances("site-energy", {
    publishedOnly: true
  });
  assert.equal(rolledBackPublishedStations.total, 3);
  assert.equal(
    rolledBackPublishedStations.items.find((item) => item.stationId === "chilled-a")?.published,
    true
  );
  assert.ok(
    adminStore.listAuditLogs({ siteId: "site-energy", limit: 50 }, { allowAllSites: true })
      .some((item) => item.action === "site.station-instances.update")
  );

  assert.throws(
    () => adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "invalid-parent",
            stationName: "未知站房",
            parentSubsystemType: "unknown_energy_type"
          }
        ]
      },
      actor
    ),
    /Unknown subsystem type/
  );

  for (const parentSubsystemType of ["power_monitoring", "hvac_terminal"]) {
    assert.throws(
      () => adminStore.upsertStationInstances(
        "site-energy",
        {
          items: [
            {
              stationId: `invalid-${parentSubsystemType}`,
              stationName: `非站房对象 ${parentSubsystemType}`,
              parentSubsystemType
            }
          ]
        },
        actor
      ),
      (error) => (
        error?.status === 400
        && error?.details?.field === "parentSubsystemType"
        && error?.details?.allowed?.includes("chilled_plant")
        && !error?.details?.allowed?.includes(parentSubsystemType)
      )
    );
    assert.throws(
      () => adminStore.listStationInstances("site-energy", { parentSubsystemType }),
      (error) => error?.status === 400 && error?.details?.field === "parentSubsystemType"
    );
  }

  assert.throws(
    () => adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "冷冻站 A",
            stationName: "非法标识站房",
            parentSubsystemType: "chilled_plant"
          }
        ]
      },
      actor
    ),
    (error) => error?.status === 400 && error?.details?.field === "stationId"
  );

  assert.throws(
    () => adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "chilled-c",
            stationName: "冷冻站 A",
            parentSubsystemType: "chilled_plant"
          }
        ]
      },
      actor
    ),
    (error) => error?.status === 409 && error?.details?.conflictingStationId === "chilled-a"
  );

  for (const [field, value] of [
    ["status", "ready"],
    ["published", "true"],
    ["sortOrder", -1]
  ]) {
    assert.throws(
      () => adminStore.upsertStationInstances(
        "site-energy",
        {
          items: [
            {
              stationId: "strict-contract",
              stationName: "严格合同测试站房",
              parentSubsystemType: "chilled_plant",
              status: "enabled",
              published: false,
              sortOrder: 90,
              [field]: value
            }
          ]
        },
        actor
      ),
      (error) => error?.status === 400 && error?.details?.field === field
    );
    assert.equal(
      adminStore.listStationInstances("site-energy").items.some((item) => item.stationId === "strict-contract"),
      false
    );
  }

  assert.throws(
    () => adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "runtime-evidence-forbidden",
            stationName: "禁止人工证据站房",
            parentSubsystemType: "chilled_plant",
            sourceStatus: "ok",
            freshnessStatus: "fresh",
            alarmCount: 0
          }
        ]
      },
      actor
    ),
    (error) => error?.status === 400
      && error?.details?.fields?.includes("sourceStatus")
      && error?.details?.fields?.includes("freshnessStatus")
      && error?.details?.fields?.includes("alarmCount")
  );

  adminStore.close();
});

test("station registry filters legacy nonphysical rows and rejects unsafe rollback atomically", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chiller-station-semantics-"));
  const dbFile = path.join(tempDir, "admin.sqlite");
  let adminStore;
  try {
    adminStore = createAdminStore({ dbFile });
    adminStore.createSite(
      {
        siteId: "site-energy",
        siteName: "综合能源站测试",
        status: "active"
      },
      actor
    );
    adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "chilled-safe",
            stationName: "安全冷冻站",
            parentSubsystemType: "chilled_plant"
          }
        ]
      },
      actor
    );
    adminStore.publishConfigVersion("site-energy", "cfg-unsafe-snapshot", actor);
    adminStore.close();
    adminStore = null;

    const sqlite = new DatabaseSync(dbFile);
    const versionRow = sqlite.prepare(
      "SELECT payload_json FROM admin_config_versions WHERE site_id = ? AND version_id = ?"
    ).get("site-energy", "cfg-unsafe-snapshot");
    const unsafeSnapshot = JSON.parse(versionRow.payload_json);
    unsafeSnapshot.stationInstances.items[0].parentSubsystemType = "hvac_terminal";
    sqlite.prepare(
      "UPDATE admin_config_versions SET payload_json = ? WHERE site_id = ? AND version_id = ?"
    ).run(JSON.stringify(unsafeSnapshot), "site-energy", "cfg-unsafe-snapshot");
    const timestamp = new Date().toISOString();
    sqlite.prepare(
      `
        INSERT INTO admin_station_instances (
          site_id, station_id, station_name, parent_subsystem_type, status,
          source_status, freshness_status, alarm_count, sort_order, published,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "site-energy",
      "legacy-terminal",
      "历史末端脏数据",
      "hvac_terminal",
      "not_configured",
      "not_configured",
      "not_configured",
      0,
      999,
      1,
      timestamp,
      timestamp
    );
    sqlite.close();

    adminStore = createAdminStore({ dbFile });
    assert.deepEqual(
      adminStore.listStationInstances("site-energy").items.map((item) => item.stationId),
      ["chilled-safe"]
    );
    adminStore.upsertStationInstances(
      "site-energy",
      {
        items: [
          {
            stationId: "chilled-safe",
            stationName: "已修改安全冷冻站",
            parentSubsystemType: "chilled_plant"
          }
        ]
      },
      actor
    );

    assert.throws(
      () => adminStore.rollbackConfigVersion("site-energy", "cfg-unsafe-snapshot", actor),
      (error) => error?.status === 400 && error?.details?.field === "parentSubsystemType"
    );
    assert.equal(
      adminStore.listStationInstances("site-energy").items[0]?.stationName,
      "已修改安全冷冻站"
    );
  } finally {
    adminStore?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

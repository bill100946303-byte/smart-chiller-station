import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { createAdminStore } from "./admin-db.js";

const editor = { userId: "site-editor", username: "site-editor" };
const publisher = { userId: "platform-publisher", username: "platform-publisher" };

function createStoreWithPublishedStation(dbFile = ":memory:", stationId = "chilled-a") {
  const store = createAdminStore({ dbFile });
  store.createSite({ siteId: "site-runtime", siteName: "运行绑定测试项目" }, publisher, {});
  store.upsertStationInstances(
    "site-runtime",
    {
      items: [
        {
          stationId,
          stationName: "冷冻站 A",
          parentSubsystemType: "chilled_plant",
          status: "enabled",
          published: true
        }
      ]
    },
    publisher,
    {}
  );
  return store;
}

function saveDraft(store, expectedVersion, overrides = {}, stationId = "chilled-a", actor = editor) {
  return store.upsertStationRuntimeBinding(
    "site-runtime",
    stationId,
    {
      expectedVersion,
      source: {
        databaseKey: "station_db",
        projectKey: "station_project",
        template: "1",
        ...(overrides.source || {})
      },
      selectors: {
        deviceIds: ["device-1"],
        deviceCodes: ["CH1"],
        pointCodes: ["TAG-1"],
        ...(overrides.selectors || {})
      },
      notes: overrides.notes || null
    },
    actor,
    {}
  );
}

function validateDraft(store, binding, ok = true, stationId = "chilled-a") {
  const effectiveSource = {
    legacyBaseUrl: "https://example.invalid",
    databaseKey: "station_db",
    projectKey: "station_project",
    template: "1",
    realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
    build: "1",
    floor: "1",
    mock: false
  };
  return store.recordStationRuntimeBindingValidation(
    "site-runtime",
    stationId,
    binding.bindingVersion,
    {
      ok,
      payloadHash: binding.payloadHash,
      checkedAt: "2026-07-19T01:00:00.000Z",
      matched: { deviceCount: ok ? 1 : 0 },
      unmatched: { deviceIds: ok ? [] : ["device-1"] },
      errors: ok ? [] : ["DEVICE_IDS_UNMATCHED"],
      effectiveSource,
      effectiveSourceHash: createHash("sha256")
        .update(JSON.stringify(effectiveSource))
        .digest("hex"),
      sourceEvidence: {
        mock: false,
        placeholder: false,
        fallback: false
      }
    },
    editor,
    {}
  );
}

test("station runtime binding keeps published head active while a new draft is edited", () => {
  const store = createStoreWithPublishedStation();
  const draftV1 = saveDraft(store, 0);
  assert.equal(draftV1.status, "draft");
  assert.equal(draftV1.bindingVersion, 1);
  assert.equal(store.getStationRuntimeBinding("site-runtime", "chilled-a", { view: "published" }), null);

  const validatedV1 = validateDraft(store, draftV1);
  assert.equal(validatedV1.status, "validated");
  const publishedV1 = store.publishStationRuntimeBinding(
    "site-runtime",
    "chilled-a",
    1,
    publisher,
    {}
  );
  assert.equal(publishedV1.status, "published");
  assert.equal(publishedV1.bindingVersion, 1);

  const draftV2 = saveDraft(store, 1, {
    selectors: {
      deviceIds: ["device-2"],
      deviceCodes: ["CH2"],
      pointCodes: ["TAG-2"]
    }
  });
  const editingState = store.getStationRuntimeBindingState("site-runtime", "chilled-a");
  assert.equal(editingState.draftVersion, 2);
  assert.equal(editingState.publishedVersion, 1);
  assert.equal(editingState.draftBinding.payloadHash, draftV2.payloadHash);
  assert.deepEqual(
    store.getStationRuntimeBinding("site-runtime", "chilled-a", { view: "published" }).selectors.deviceIds,
    ["device-1"]
  );

  validateDraft(store, draftV2);
  const publishedV2 = store.publishStationRuntimeBinding(
    "site-runtime",
    "chilled-a",
    2,
    publisher,
    {}
  );
  assert.equal(publishedV2.bindingVersion, 2);
  assert.deepEqual(publishedV2.selectors.deviceIds, ["device-2"]);
  const finalState = store.getStationRuntimeBindingState("site-runtime", "chilled-a");
  assert.equal(finalState.draftVersion, null);
  assert.equal(finalState.publishedVersion, 2);

  assert.throws(
    () => saveDraft(store, 1),
    (error) => error?.status === 409 && error?.details?.currentVersion === 2
  );
  store.close();
});

test("station runtime binding publish rejects self approval and overlapping published devices", () => {
  const store = createStoreWithPublishedStation();
  store.upsertStationInstances(
    "site-runtime",
    {
      items: [
        {
          stationId: "chilled-b",
          stationName: "冷冻站 B",
          parentSubsystemType: "chilled_plant",
          status: "enabled",
          published: true
        }
      ]
    },
    publisher,
    {}
  );

  const first = saveDraft(store, 0);
  validateDraft(store, first);
  assert.throws(
    () => store.publishStationRuntimeBinding("site-runtime", "chilled-a", 1, editor, {}),
    (error) => error?.status === 409 && /different from every editor/.test(error.message)
  );
  store.publishStationRuntimeBinding("site-runtime", "chilled-a", 1, publisher, {});

  const second = saveDraft(store, 0, {}, "chilled-b");
  validateDraft(store, second, true, "chilled-b");
  assert.throws(
    () => store.publishStationRuntimeBinding("site-runtime", "chilled-b", 1, publisher, {}),
    (error) => error?.status === 409 && Array.isArray(error?.details?.conflicts)
  );
  store.close();
});

test("legacy single-row bindings migrate once into an unvalidated draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "station-binding-migration-"));
  const dbFile = path.join(tempDir, "admin.sqlite");
  let store = createStoreWithPublishedStation(dbFile);
  store.close();

  const db = new DatabaseSync(dbFile);
  db.exec(`
    CREATE TABLE admin_station_runtime_bindings (
      site_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      status TEXT NOT NULL,
      binding_version INTEGER NOT NULL,
      database_key TEXT,
      project_key TEXT,
      template TEXT,
      device_ids_json TEXT NOT NULL,
      device_codes_json TEXT NOT NULL,
      point_codes_json TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, station_id)
    );
  `);
  db.prepare(`
    INSERT INTO admin_station_runtime_bindings (
      site_id, station_id, status, binding_version, database_key, project_key,
      template, device_ids_json, device_codes_json, point_codes_json, notes,
      created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, 'active', 4, ?, ?, '1', ?, ?, ?, NULL, ?, ?, ?, ?)
  `).run(
    "site-runtime",
    "chilled-a",
    "legacy_db",
    "legacy_project",
    JSON.stringify(["legacy-device"]),
    JSON.stringify(["CH9"]),
    JSON.stringify([]),
    "2026-07-19T00:00:00.000Z",
    "2026-07-19T00:00:00.000Z",
    editor.userId,
    editor.userId
  );
  db.close();

  store = createAdminStore({ dbFile });
  const state = store.getStationRuntimeBindingState("site-runtime", "chilled-a");
  assert.equal(state.draftVersion, 4);
  assert.equal(state.publishedVersion, null);
  assert.equal(state.draftBinding.status, "draft");
  assert.equal(state.draftBinding.validatedHash, null);
  assert.deepEqual(state.draftBinding.selectors.deviceIds, ["legacy-device"]);
  store.close();

  store = createAdminStore({ dbFile });
  const restarted = store.getStationRuntimeBindingState("site-runtime", "chilled-a");
  assert.equal(restarted.draftVersion, 4);
  assert.equal(restarted.publishedVersion, null);
  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("config rollback appends an unvalidated draft and clears live head without deleting history", () => {
  const store = createStoreWithPublishedStation();
  try {
    const draftV1 = saveDraft(store, 0, {
      selectors: { deviceIds: ["device-1"], deviceCodes: ["CH1"] }
    });
    validateDraft(store, draftV1);
    store.publishStationRuntimeBinding("site-runtime", "chilled-a", 1, publisher, {});
    store.publishConfigVersion("site-runtime", "cfg-v1", publisher, {});

    const draftV2 = saveDraft(store, 1, {
      selectors: { deviceIds: ["device-2"], deviceCodes: ["CH2"] }
    });
    validateDraft(store, draftV2);
    store.publishStationRuntimeBinding("site-runtime", "chilled-a", 2, publisher, {});

    const rolledBack = store.rollbackConfigVersion("site-runtime", "cfg-v1", publisher, {});
    const state = store.getStationRuntimeBindingState("site-runtime", "chilled-a");

    assert.equal(rolledBack.version.status, "rolled_back");
    assert.equal(state.publishedVersion, null);
    assert.equal(state.publishedBinding, null);
    assert.equal(state.draftVersion, 3);
    assert.equal(state.draftBinding.status, "draft");
    assert.equal(state.draftBinding.validatedHash, null);
    assert.equal(state.draftBinding.validation, null);
    assert.deepEqual(state.draftBinding.selectors.deviceIds, ["device-1"]);
    assert.equal(
      store.getStationRuntimeBinding("site-runtime", "chilled-a", { bindingVersion: 1 })?.bindingVersion,
      1
    );
    const historicalV2 = store.getStationRuntimeBinding(
      "site-runtime",
      "chilled-a",
      { bindingVersion: 2 }
    );
    assert.equal(historicalV2?.bindingVersion, 2);
    assert.equal(historicalV2?.status, "superseded");
  } finally {
    store.close();
  }
});

test("rollback to a snapshot without bindings invalidates later validated drafts", () => {
  const store = createStoreWithPublishedStation();
  try {
    store.publishConfigVersion("site-runtime", "cfg-empty", publisher, {});
    const validatedDraft = saveDraft(store, 0);
    validateDraft(store, validatedDraft);
    assert.equal(
      store.getStationRuntimeBindingState("site-runtime", "chilled-a").draftBinding?.status,
      "validated"
    );

    store.rollbackConfigVersion("site-runtime", "cfg-empty", publisher, {});
    const state = store.getStationRuntimeBindingState("site-runtime", "chilled-a");
    assert.equal(state.draftVersion, null);
    assert.equal(state.publishedVersion, null);
    assert.equal(
      store.getStationRuntimeBinding("site-runtime", "chilled-a", { bindingVersion: 1 })?.status,
      "superseded"
    );
    assert.throws(
      () => store.publishStationRuntimeBinding("site-runtime", "chilled-a", 1, publisher, {}),
      (error) => error?.status === 409
    );
  } finally {
    store.close();
  }
});

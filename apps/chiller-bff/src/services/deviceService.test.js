import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuntimePointSummary,
  getChillerStagingRuntimeContext,
  getFanCoilTerminalSnapshot,
  resolveCodeOwnedRuntimePointEvidenceDecoder,
  resolveDeviceProjectKey,
  resolveDeviceQueryDefaults,
  resolveDeviceRealtimeInterface,
  validateStationRuntimeBindingSource
} from "./deviceService.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("station binding validation persists real catalog and point evidence without fallback", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    requests.push({ url, method: options?.method || "GET" });
    if (url.endsWith("/zsqy/drinfo/station-db/findObject?pageCurrent=1&pageSize=5000")) {
      return createJsonResponse({
        data: [
          { drid: "1", drcode: "CH1", drname: "1#冷机", drtypename: "主机", typeYT: "1" },
          { drid: "2", drcode: "CH2", drname: "2#冷机", drtypename: "主机", typeYT: "1" }
        ]
      });
    }
    if (url.endsWith("/zsqy/reg/station-db/findObject?pageCurrent=1&pageSize=5000")) {
      return createJsonResponse({
        data: [
          { drId: "1", drcode: "CH1", tagName: "CH1-RUN", regName: "运行" },
          { drId: "2", drcode: "CH2", tagName: "CH2-RUN", regName: "运行" }
        ]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await validateStationRuntimeBindingSource({
      legacyBaseUrl: "https://example.invalid",
      staleThresholdHours: 6,
      siteSourceConfig: { databaseKey: "station-db" }
    }, "site-a", {
      payloadHash: "payload-v1",
      source: { databaseKey: "station-db" },
      selectors: {
        deviceIds: ["1", "2"],
        deviceCodes: ["CH1", "CH2"],
        pointCodes: ["CH1-RUN", "CH2-RUN"]
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.payloadHash, "payload-v1");
    assert.equal(result.selectorMode, "exact_allowlist");
    assert.equal(result.matchAll, false);
    assert.equal(result.matched.deviceCount, 2);
    assert.equal(result.matched.pointCount, 2);
    assert.deepEqual(result.errors, []);
    assert.equal(result.sourceEvidence.mock, false);
    assert.equal(result.sourceEvidence.placeholder, false);
    assert.equal(result.sourceEvidence.fallback, false);
    assert.ok(result.catalogHash);
    assert.equal(result.effectiveSource.legacyBaseUrl, "https://example.invalid");
    assert.equal(result.effectiveSource.databaseKey, "station-db");
    assert.equal(result.effectiveSource.mock, false);
    assert.equal(
      result.effectiveSourceHash,
      (await import("node:crypto")).createHash("sha256")
        .update(JSON.stringify(result.effectiveSource))
        .digest("hex")
    );
    assert.ok(result.checkedAt);
    assert.deepEqual(requests.map((item) => item.method), ["GET", "GET"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("station binding validation fails closed on zero rows, id/code drift, and ambiguous points", async () => {
  const originalFetch = globalThis.fetch;
  let mode = "empty";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/zsqy/drinfo/station-db/findObject")) {
      if (mode === "empty") {
        return createJsonResponse({ data: [] });
      }
      if (mode === "business-failure") {
        return createJsonResponse({
          status: 50000,
          msg: "business failure",
          data: [{ drid: "1", drcode: "CH1", drname: "1#冷机", typeYT: "1" }]
        });
      }
      if (mode === "same-device") {
        return createJsonResponse({
          data: [{ drid: "1", drcode: "CH1", drname: "1#冷机", typeYT: "1" }]
        });
      }
      if (mode === "duplicate-id") {
        return createJsonResponse({
          data: [
            { drid: "1", drcode: "A", drname: "重复设备 A", typeYT: "1" },
            { drid: "1", drcode: "B", drname: "重复设备 B", typeYT: "1" }
          ]
        });
      }
      return createJsonResponse({
        data: [
          { drid: "1", drcode: "DUP", drname: "1#冷机", drtypename: "主机", typeYT: "1" },
          { drid: "2", drcode: "DUP", drname: "2#冷机", drtypename: "主机", typeYT: "1" }
        ]
      });
    }
    if (url.includes("/zsqy/reg/station-db/findObject")) {
      if (mode === "same-device") {
        return createJsonResponse({
          data: [
            { drId: "1", drcode: "CH1", tagName: "RUN", regName: "运行" },
            { drId: "1", drcode: "CH1", tagName: "RUN", regName: "备用运行" }
          ]
        });
      }
      return createJsonResponse({
        data: [
          { drId: "1", drcode: "DUP", tagName: "RUN" },
          { drId: "2", drcode: "DUP", tagName: "RUN" }
        ]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const base = {
      legacyBaseUrl: "https://example.invalid",
      staleThresholdHours: 6,
      siteSourceConfig: { databaseKey: "station-db" }
    };
    const empty = await validateStationRuntimeBindingSource(base, "site-a", {
      payloadHash: "empty",
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: [] }
    });
    assert.equal(empty.ok, false);
    assert.ok(empty.errors.includes("CATALOG_EMPTY"));
    assert.ok(empty.errors.includes("DEVICE_IDS_UNMATCHED"));

    mode = "ambiguous";
    const ambiguous = await validateStationRuntimeBindingSource(base, "site-a", {
      payloadHash: "ambiguous",
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1", "2"], deviceCodes: ["DUP", "DUP"], pointCodes: ["RUN"] }
    });
    assert.equal(ambiguous.ok, false);
    assert.ok(ambiguous.errors.includes("DEVICE_ID_CODE_PAIRING_MISMATCH"));
    assert.ok(ambiguous.errors.includes("POINT_CODES_AMBIGUOUS"));

    mode = "same-device";
    const sameDeviceAmbiguous = await validateStationRuntimeBindingSource(base, "site-a", {
      payloadHash: "same-device",
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: ["RUN"] }
    });
    assert.equal(sameDeviceAmbiguous.ok, false);
    assert.ok(sameDeviceAmbiguous.errors.includes("POINT_CODES_AMBIGUOUS"));

    mode = "business-failure";
    const businessFailure = await validateStationRuntimeBindingSource(base, "site-a", {
      payloadHash: "business-failure",
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: ["CH1"], pointCodes: [] }
    });
    assert.equal(businessFailure.ok, false);
    assert.ok(businessFailure.errors.includes("CATALOG_UNAVAILABLE"));
    assert.equal(businessFailure.sourceEvidence.catalog?.status, 200);
    assert.match(businessFailure.sourceEvidence.catalog?.error || "", /business response failed/i);

    mode = "duplicate-id";
    const duplicateId = await validateStationRuntimeBindingSource(base, "site-a", {
      payloadHash: "duplicate-id",
      source: { databaseKey: "station-db" },
      selectors: { deviceIds: ["1"], deviceCodes: [], pointCodes: [] }
    });
    assert.equal(duplicateId.ok, false);
    assert.ok(duplicateId.errors.includes("DEVICE_IDS_AMBIGUOUS"));
    assert.deepEqual(duplicateId.ambiguous.deviceIds, ["1"]);
    assert.equal(duplicateId.matched.deviceCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function runtimeRow({ drcode, drname, drtypename = "", regs = [] }) {
  return {
    drcode,
    drname,
    drtypename,
    reglist: regs.map(([regName, value]) => ({
      regName,
      newtagvalue: value
    }))
  };
}

const b25PointDictionary = {
  source: "test_b25_dictionary",
  deviceSelectors: {
    chilledPumps: {
      codePatterns: ["^CHP\\d+$"],
      namePatterns: ["^\\d+#冷冻泵$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|支路|旁通"]
    },
    coolingPumps: {
      codePatterns: ["^CWP\\d+$"],
      namePatterns: ["^\\d+#冷却泵$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|支路|旁通"]
    },
    coolingTowers: {
      codePatterns: ["^CT\\d+$"],
      namePatterns: ["^\\d+#冷却塔$", "^\\d+#冷却塔风机$"],
      excludeNamePatterns: ["阀|流量计|水表|总管|开到位|关到位"]
    }
  },
  branchLabels: {
    allowedNamePatterns: ["支路\\s*\\d+", "\\bB\\d{1,2}\\b"],
    excludePatterns: ["累计", "冷却塔", "冷却泵", "冷冻泵", "主机"]
  },
  coolingTowerCellLabels: {
    allowedNamePatterns: ["^CT\\d+\\b", "\\d+\\s*#?\\s*冷却塔"],
    excludePatterns: ["阀|开到位|关到位"]
  }
};

function createReadOnlyRuntimeEnrichmentConfig() {
  return {
    enabled: true,
    mode: "read-only",
    allowedMethod: "GET",
    endpointKind: "legacy-reg-findObject-all",
    pageSize: 5000,
    exactDeviceCodes: ["CH1", "CHP1"],
    exactSignalRegisterNames: {
      running: "运行",
      faultActive: "故障",
      remoteEnabled: "远程",
      frequencyHz: "频率反馈"
    },
    exactTagNamesByDeviceCode: {
      CH1: {
        running: "SY-1-509-40950",
        faultActive: "SY-1-509-40952",
        remoteEnabled: "SY-1-509-40951"
      },
      CHP1: {
        running: "SY-1-509-40005",
        faultActive: "SY-1-509-40006",
        remoteEnabled: "SY-1-509-40004",
        frequencyHz: "SY-1-509-42001"
      }
    },
    exactTagAliasRule: {
      transform: "replace-leading-prefix-only",
      sourcePrefix: "SY-",
      runtimePrefixTemplate: "{deviceCode}-"
    },
    expectedSignalCounts: {
      running: 2,
      faultActive: 2,
      remoteEnabled: 2,
      frequencyHz: 1
    },
    expectedEquipmentCount: 2
  };
}

function createB25RuntimeServiceConfig() {
  return {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    staleThresholdHours: 1,
    operationalDiagnosticsPointDictionary: b25PointDictionary,
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive",
      defaultDeviceQuery: { build: 1, floor: 0, mock: false },
      deviceDataInterfaces: [{
        projectKey: "140btwentyfive",
        endpointKind: "legacy-reg-findAllByDrTypeId",
        endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
        build: 1,
        floor: 0,
        mock: false
      }],
      readOnlyRuntimeEnrichment: createReadOnlyRuntimeEnrichmentConfig()
    }
  };
}

test("resolveDeviceQueryDefaults falls back to site source config defaults", () => {
  const config = {
    siteSourceConfig: {
      defaultDeviceQuery: {
        build: 1,
        floor: 0,
        mock: false
      }
    }
  };

  const result = resolveDeviceQueryDefaults(config, {});
  assert.deepEqual(result, {
    build: "1",
    floor: "0",
    mock: false
  });
});

test("resolveDeviceQueryDefaults preserves explicit query overrides", () => {
  const config = {
    siteSourceConfig: {
      defaultDeviceQuery: {
        build: 1,
        floor: 0,
        mock: false
      }
    }
  };

  const result = resolveDeviceQueryDefaults(config, {
    build: "2",
    floor: "6",
    mock: "true"
  });
  assert.deepEqual(result, {
    build: "2",
    floor: "6",
    mock: true
  });
});

test("resolveDeviceProjectKey prefers explicit request projectKey when configured", () => {
  const config = {
    siteSourceConfig: {
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  const result = resolveDeviceProjectKey(config, {
    projectKey: "126lnoffice"
  });

  assert.equal(result, "126lnoffice");
});

test("resolveDeviceProjectKey falls back to configured projectKey when explicit key is missing", () => {
  const config = {
    siteSourceConfig: {
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  const result = resolveDeviceProjectKey(config, {});

  assert.equal(result, "140btwentyfive");
});

test("resolveDeviceProjectKey falls back to explicit projectKey when no configured project key", () => {
  const config = {
    siteSourceConfig: {}
  };

  const result = resolveDeviceProjectKey(config, {
    projectKey: "126lnoffice"
  });

  assert.equal(result, "126lnoffice");
});

test("resolveDeviceRealtimeInterface returns configured project data interface", () => {
  const config = {
    siteSourceConfig: {
      deviceDataInterfaces: [
        {
          endpointKind: "legacy-reg-findAllByDrTypeId",
          endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
        }
      ]
    }
  };

  const result = resolveDeviceRealtimeInterface(config);

  assert.equal(result?.endpointKind, "legacy-reg-findAllByDrTypeId");
});

test("getChillerStagingRuntimeContext enriches B25 exact state points with one read-only collection GET", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, options) => {
    const url = String(input);
    requests.push({ url, method: options?.method });
    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({ data: [
        { drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机" },
        { drid: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵" }
      ] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({ data: [
        {
          drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机",
          reglist: [{ regName: "功率", tagName: "CH1-509-43001", newtagvalue: "420" }]
        },
        {
          drid: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵",
          reglist: [{ regName: "出口压力", tagName: "CHP1-509-43002", newtagvalue: "310" }]
        }
      ] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000")) {
      return createJsonResponse({ data: [
        { drId: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机", regName: "运行", tagName: "CH1-1-509-40950", newtagvalue: "1" },
        { drId: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机", regName: "故障", tagName: "CH1-1-509-40952", newtagvalue: "0" },
        { drId: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机", regName: "远程", tagName: "CH1-1-509-40951", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵", regName: "运行", tagName: "CHP1-1-509-40005", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵", regName: "故障", tagName: "CHP1-1-509-40006", newtagvalue: "0" },
        { drId: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵", regName: "远程", tagName: "CHP1-1-509-40004", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵", regName: "频率反馈", tagName: "CHP1-1-509-42001", newtagvalue: "41.2" },
        { drId: "999", drcode: "CHP99", drname: "非核心泵", drtypename: "冷冻水泵", regName: "运行", tagName: "SY-1-509-49999", newtagvalue: "1" },
        { drId: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机", regName: "手动启动", tagName: "SY-1-509-41001", newtagvalue: "0" }
      ] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await getChillerStagingRuntimeContext(
      createB25RuntimeServiceConfig(),
      "140"
    );
    const points = result.pointSummary.pointEvidence.points;
    const runtimeSource = result.sourceStatus.sources.find((item) => item.key === "chillerStagingRuntime");

    assert.equal(runtimeSource?.ok, true);
    assert.equal(runtimeSource?.fallback, false);
    assert.match(runtimeSource?.message || "", /7 points\/2 devices/);
    assert.equal(points.filter((point) => point.semanticKey === "running").length, 2);
    assert.equal(points.filter((point) => point.semanticKey === "faultActive").length, 2);
    assert.equal(points.filter((point) => point.semanticKey === "remoteEnabled").length, 2);
    assert.equal(points.filter((point) => point.semanticKey === "frequencyHz").length, 1);
    assert.equal(points.some((point) => point.regName === "功率"), true);
    assert.equal(points.some((point) => point.regName === "出口压力"), true);
    assert.equal(points.some((point) => point.regName === "手动启动"), false);
    assert.equal(points.some((point) => point.deviceCode === "CHP99"), false);
    assert.equal(points.every((point) => point.observedAt === null), true);
    assert.equal(result.chillers[0]?.running, true);
    assert.equal(result.chillers[0]?.faultActive, false);
    assert.equal(result.chillers[0]?.remoteEnabled, true);
    assert.equal(requests.filter((item) => item.url.includes("pageSize=5000")).length, 1);
    assert.equal(requests.every((item) => item.method === "GET"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getChillerStagingRuntimeContext marks chillerStagingRuntime unhealthy when B25 enrichment fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({ data: [
        { drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机" }
      ] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({ data: [
        {
          drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机",
          reglist: [{ regName: "运行", tagName: "SY-1-509-40950", newtagvalue: "1" }]
        }
      ] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000")) {
      return createJsonResponse({ message: "upstream unavailable" }, 503);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await getChillerStagingRuntimeContext(
      createB25RuntimeServiceConfig(),
      "140"
    );
    const runtimeSource = result.sourceStatus.sources.find((item) => item.key === "chillerStagingRuntime");

    assert.equal(runtimeSource?.ok, false);
    assert.equal(runtimeSource?.fallback, false);
    assert.equal(runtimeSource?.reasonCode, "read_only_runtime_enrichment_failed");
    assert.match(runtimeSource?.error || "", /Legacy request failed: 503/);
    assert.equal(result.sourceStatus.overall, "partial");
    assert.equal(result.pointSummary.pointEvidence.points.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getChillerStagingRuntimeContext fails closed when an exact B25 signal tag drifts", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/zsqy/drinfo/140btwentyfive/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({ data: [
        { drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机" },
        { drid: "21", drcode: "CHP1", drname: "1#冷冻泵", drtypename: "冷冻水泵" }
      ] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return createJsonResponse({ data: [{
        drid: "7", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机",
        reglist: [{ regName: "功率", tagName: "CH1-509-43001", newtagvalue: "420" }]
      }] });
    }
    if (url.endsWith("/zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000")) {
      return createJsonResponse({ data: [
        { drId: "7", drcode: "CH1", regName: "运行", tagName: "CH1-1-509-40950 ", newtagvalue: "1" },
        { drId: "7", drcode: "CH1", regName: "故障", tagName: "CH1-1-509-40952", newtagvalue: "0" },
        { drId: "7", drcode: "CH1", regName: "远程", tagName: "CH1-1-509-40951", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", regName: "运行", tagName: "CHP1-1-509-40005", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", regName: "故障", tagName: "CHP1-1-509-40006", newtagvalue: "0" },
        { drId: "21", drcode: "CHP1", regName: "远程", tagName: "CHP1-1-509-40004", newtagvalue: "1" },
        { drId: "21", drcode: "CHP1", regName: "频率反馈", tagName: "CHP1-1-509-42001", newtagvalue: "41.2" }
      ] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await getChillerStagingRuntimeContext(
      createB25RuntimeServiceConfig(),
      "140"
    );
    const runtimeSource = result.sourceStatus.sources.find((item) => item.key === "chillerStagingRuntime");

    assert.equal(runtimeSource?.ok, false);
    assert.equal(runtimeSource?.fallback, false);
    assert.match(runtimeSource?.error || "", /CH1\.running tag mismatch/);
    assert.match(runtimeSource?.error || "", /running exact signal coverage 1\/2/);
    assert.equal(result.pointSummary.pointEvidence.points.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getChillerStagingRuntimeContext does not call full register collection without explicit site enrichment", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({ data: [{ drid: "1", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机" }] });
    }
    if (url.endsWith("/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=1")) {
      return createJsonResponse({ data: [{
        drid: "1", drcode: "CH1", drname: "1#冷水机组", drtypename: "主机",
        reglist: [{ regName: "运行", tagName: "CH1-502-40001", newtagvalue: "1" }]
      }] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    await getChillerStagingRuntimeContext({
      legacyBaseUrl: "https://www.ssge.com.cn:8098",
      siteSourceConfig: {
        databaseKey: "126lnoffice",
        deviceDataProjectKey: "126lnoffice",
        defaultDeviceQuery: { build: 1, floor: 1, mock: false },
        deviceDataInterfaces: [{ endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 1, mock: false }]
      }
    }, "126lnoffice");

    assert.equal(requests.some((url) => url.includes("pageSize=5000")), false);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getFanCoilTerminalSnapshot maps 10F fan coil runtime and keeps write points disabled", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200")) {
      return createJsonResponse({
        data: [
          {
            drid: "19",
            drname: "办公室01",
            drtypename: "风机盘管",
            drcode: "BGS01"
          },
          {
            drid: "20",
            drname: "办公室02",
            drtypename: "风机盘管",
            drcode: "BGS02"
          }
        ]
      });
    }

    if (url.endsWith("/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=1")) {
      return createJsonResponse({
        status: "20000",
        msg: "OK",
        data: [
          {
            drid: "19",
            drname: "办公室01",
            drtypename: "风机盘管",
            drcode: "BGS01",
            reglist: {
              reglist: [
                { regName: "运行", tagName: "BGS01-502-40069", tagValue: "1", regReadWrite: "1", tagTime: "5" },
                { regName: "通讯报警", tagName: "BGS01-502-40070", tagValue: "0", tagAlarmState: "0", regReadWrite: "1", tagTime: "5" },
                { regName: "内置温度", tagName: "BGS01-506-40187", tagValue: "26.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "阀门状态", tagName: "BGS01-506-40189", tagValue: "1.0", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度反馈", tagName: "BGS01-506-40191", tagValue: "24.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度", tagName: "BGS01-508-40133", tagValue: "20.0", regUnits: "℃", regReadWrite: "2", tagTime: "5" }
              ]
            }
          },
          {
            drid: "20",
            drname: "办公室02",
            drtypename: "风机盘管",
            drcode: "BGS02",
            reglist: {
              reglist: [
                { regName: "运行", tagName: "BGS02-502-40073", tagValue: "0", regReadWrite: "1", tagTime: "5" },
                { regName: "通讯报警", tagName: "BGS02-502-40074", tagValue: "1", tagAlarmState: "1", regReadWrite: "1", tagTime: "5" },
                { regName: "内置温度", tagName: "BGS02-506-40203", tagValue: "27.0", regUnits: "℃", regReadWrite: "1", tagTime: "5" },
                { regName: "阀门状态", tagName: "BGS02-506-40205", tagValue: "0.0", regReadWrite: "1", tagTime: "5" },
                { regName: "设置温度", tagName: "BGS02-508-40149", tagValue: "20.0", regUnits: "℃", regReadWrite: "2", tagTime: "5" }
              ]
            }
          }
        ]
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await getFanCoilTerminalSnapshot({
      legacyBaseUrl: "https://www.ssge.com.cn:8098",
      staleThresholdHours: 1,
      siteSourceConfig: {
        deviceDataProjectKey: "126lnoffice",
        databaseKey: "126lnoffice"
      }
    }, "126lnoffice", {
      build: "1",
      floor: "1"
    });

    assert.equal(result.subsystemType, "hvac_terminal");
    assert.equal(result.equipmentType, "fan_coil");
    assert.equal(result.floorName, "10楼");
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.runningCount, 1);
    assert.equal(result.summary.communicationAlarmCount, 1);
    assert.equal(result.summary.comfortEligibleCount, 1);
    assert.equal(result.summary.excludedFromComfortStatsCount, 1);
    assert.equal(result.summary.averageZoneTemperatureC, 26);
    assert.equal(result.summary.averageValveOpenPct, 50);
    assert.equal(result.summary.qualityStatus, "attention");
    assert.equal(result.items[0].deviceCode, "BGS01");
    assert.equal(result.items[0].zoneTemperatureC, 26);
    assert.equal(result.items[0].quality.status, "ok");
    assert.equal(result.items[1].quality.status, "invalid");
    assert.deepEqual(result.items[1].quality.flags, ["communication_alarm", "stopped"]);
    assert.equal(result.items[0].points.setpoint.writable, true);
    assert.equal(result.items[0].points.setpoint.writeAllowed, false);
    assert.equal(result.items[0].rawTagTime, "5");
    assert.equal(result.timestampBasis, "bff_fetch_time");
    assert.equal(result.sourceStatus.overall, "ok");
    assert.deepEqual(requests, [
      "https://www.ssge.com.cn:8098/zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200",
      "https://www.ssge.com.cn:8098/zsqy/reg/126lnoffice/findAllByDrTypeId?build=1&floor=1"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildRuntimePointSummary applies 140/B25 point dictionary before generic keyword matching", () => {
  const rows = [
    runtimeRow({
      drcode: "CHP4",
      drname: "4#冷冻泵",
      regs: [
        ["运行", 1],
        ["频率反馈", 40],
        ["功率", 37]
      ]
    }),
    runtimeRow({
      drcode: "CHPV4",
      drname: "4#冷冻泵出口阀",
      regs: [
        ["运行", 1],
        ["开到位", 1]
      ]
    }),
    runtimeRow({
      drcode: "CWP5",
      drname: "5#冷却泵",
      regs: [
        ["运行", 1],
        ["频率反馈", 38],
        ["功率", 30]
      ]
    }),
    runtimeRow({
      drcode: "CWPV5",
      drname: "5#冷却泵出口阀",
      regs: [["开到位", 1]]
    }),
    runtimeRow({
      drcode: "CT1",
      drname: "1#冷却塔风机",
      regs: [
        ["运行", 1],
        ["频率反馈", 33],
        ["功率", 4]
      ]
    }),
    runtimeRow({
      drcode: "CTV2",
      drname: "2#冷却塔进水阀",
      regs: [
        ["开到位", 1],
        ["关到位", 0]
      ]
    }),
    runtimeRow({
      drcode: "B25-BR1",
      drname: "支路1冷冻水",
      regs: [
        ["累计流量", 999999],
        ["回水流量", 1220],
        ["供水温度", 8.4],
        ["回水温度", 12.7],
        ["回水压力", 398]
      ]
    }),
    runtimeRow({
      drcode: "B12-FM",
      drname: "B12冷冻回水流量计",
      regs: [
        ["累计流量", 880000],
        ["瞬时流量", 333]
      ]
    }),
    runtimeRow({
      drcode: "CTFM1",
      drname: "1#冷却塔流量计",
      regs: [["流量", 105]]
    })
  ];

  const summary = buildRuntimePointSummary(rows, [], {
    operationalDiagnosticsPointDictionary: b25PointDictionary
  });

  assert.equal(summary.basis, "legacy_realtime_register_summary_with_site_dictionary");
  assert.equal(summary.pointDictionary.applied, true);
  assert.equal(summary.counts.chilledPumpCount, 1);
  assert.equal(summary.counts.runningChilledPumpCount, 1);
  assert.equal(summary.counts.coolingPumpCount, 1);
  assert.equal(summary.counts.runningCoolingPumpCount, 1);
  assert.equal(summary.counts.coolingTowerCount, 1);
  assert.equal(summary.counts.runningCoolingTowerCount, 1);
  assert.equal(summary.counts.coolingTowerFanCount, 1);
  assert.equal(summary.counts.runningCoolingTowerFanCount, 1);
  assert.deepEqual(summary.groups.chilledPumps.map((item) => item.id), ["CHP4"]);
  assert.deepEqual(summary.groups.coolingPumps.map((item) => item.id), ["CWP5"]);
  assert.deepEqual(summary.groups.coolingTowers.map((item) => item.id), ["CT1"]);

  const branch1 = summary.groups.branches.find((item) => item.label === "支路1");
  const b12 = summary.groups.branches.find((item) => item.label === "B12");
  assert.equal(branch1?.flowM3h, 1220);
  assert.equal(branch1?.deltaTC, 4.3);
  assert.equal(b12?.flowM3h, 333);
  assert.equal(summary.groups.branches.some((item) => item.flowM3h === 999999 || item.flowM3h === 880000), false);

  assert.deepEqual(summary.groups.coolingTowerCells.map((item) => item.label), ["CT1"]);
  assert.equal(summary.groups.coolingTowerCells[0]?.flowM3h, 105);
});

test("buildRuntimePointSummary keeps relative tagTime out of authoritative observedAt", () => {
  const receivedAt = "2026-07-18T04:09:01.810Z";
  const rows = [
    {
      drid: "pump-device-1",
      drcode: "CWP1",
      drname: "1#冷却泵",
      reglist: [
        {
          regId: "reg-frequency-1",
          regName: "频率反馈",
          tagName: "SY-1-509-42008",
          tagValue: "38.5",
          regUnits: "Hz",
          tagTime: "5"
        }
      ]
    }
  ];

  const summary = buildRuntimePointSummary(rows, [], { receivedAt });
  const point = summary.pointEvidence.points[0];

  assert.deepEqual(summary.freshnessPolicy, {
    clientRefreshIntervalMs: 10000,
    sourceExpectedIntervalMs: null,
    liveMaxAgeMs: 20000,
    maxFutureSkewMs: 2000
  });
  assert.equal(summary.pointEvidence.contractVersion, "runtime-point-evidence-v1");
  assert.equal(summary.pointEvidence.sourceKey, "chillerStagingRuntime");
  assert.equal(summary.pointEvidence.evidenceProfileId, null);
  assert.equal(summary.pointEvidence.receivedAt, receivedAt);
  assert.deepEqual(summary.pointEvidence.summary, {
    totalPoints: 1,
    authoritativeTimestampPoints: 0,
    missingTimestampPoints: 1,
    goodQualityPoints: 0,
    replayProofPoints: 0,
    missingReplayProofPoints: 1
  });
  assert.equal(point.pointKey, "SY-1-509-42008");
  assert.equal(point.sourceKey, "chillerStagingRuntime");
  assert.equal(point.semanticKey, "frequencyHz");
  assert.equal(point.deviceId, "pump-device-1");
  assert.equal(point.deviceCode, "CWP1");
  assert.equal(point.regId, "reg-frequency-1");
  assert.equal(point.regName, "频率反馈");
  assert.equal(point.tagName, "SY-1-509-42008");
  assert.equal(point.unit, "Hz");
  assert.equal(point.value, 38.5);
  assert.equal(point.rawTagTime, "5");
  assert.equal(point.receivedAt, receivedAt);
  assert.equal(point.observedAt, null);
  assert.equal(point.changedAt, null);
  assert.equal(point.timestampBasis, "missing_source_timestamp");
  assert.equal(point.authoritativeTimestamp, false);
  assert.equal(point.qualityCode, "UNKNOWN");
  assert.equal(point.sourceSequence, null);
  assert.equal(point.scanCycleId, null);
  assert.equal(point.bootId, null);
});

test("buildRuntimePointSummary separates observation time from value-change time", () => {
  const rows = [
    {
      drid: "tower-device-1",
      drcode: "CT1",
      drname: "1#冷却塔风机",
      receivedAt: "2026-07-18T04:34:56.400Z",
      scanCycleId: "edge-cycle-183921",
      bootId: "edge-boot-20260718-001",
      reglist: [
        {
          regId: "reg-running-1",
          regName: "运行",
          newtagvalue: "1",
          sourceTimestamp: "2026-07-18T12:34:50+08:00",
          serverTimestamp: "2026-07-18T12:34:56+08:00",
          sourceProtocol: "OPC UA",
          sourceSequence: 183921,
          tagTime: "2026-07-18T12:34:50+08:00",
          qualityCode: "GOOD"
        },
        {
          regId: "reg-frequency-1",
          regName: "频率反馈",
          tagName: "CT1-FREQ",
          newtagvalue: "33.2",
          sourceTimestamp: "2026-07-18T12:34:51+08:00",
          sourceSequence: 183922,
          qualityCode: "0"
        }
      ]
    }
  ];

  const summary = buildRuntimePointSummary(rows, [], {
    runtimePointEvidenceDecoder: resolveCodeOwnedRuntimePointEvidenceDecoder("opcua-datavalue-v1")
  });
  const runningPoint = summary.pointEvidence.points.find((point) => point.regName === "运行");
  const frequencyPoint = summary.pointEvidence.points.find((point) => point.regName === "频率反馈");

  assert.equal(runningPoint.pointKey, "tower-device-1:reg-running-1");
  assert.equal(summary.pointEvidence.evidenceProfileId, "opcua-datavalue-v1");
  assert.equal(runningPoint.semanticKey, "running");
  assert.equal(runningPoint.observedAt, "2026-07-18T04:34:56.000Z");
  assert.equal(runningPoint.timestampBasis, "opcua_server_timestamp");
  assert.equal(runningPoint.changedAt, "2026-07-18T04:34:50.000Z");
  assert.equal(runningPoint.changedTimestampBasis, "source_timestamp");
  assert.equal(runningPoint.authoritativeTimestamp, true);
  assert.equal(runningPoint.qualityCode, "GOOD");
  assert.equal(runningPoint.sourceSequence, 183921);
  assert.equal(runningPoint.scanCycleId, "edge-cycle-183921");
  assert.equal(runningPoint.bootId, "edge-boot-20260718-001");

  assert.equal(frequencyPoint.pointKey, "CT1-FREQ");
  assert.equal(frequencyPoint.observedAt, null);
  assert.equal(frequencyPoint.timestampBasis, "missing_source_timestamp");
  assert.equal(frequencyPoint.changedAt, "2026-07-18T04:34:51.000Z");
  assert.equal(frequencyPoint.authoritativeTimestamp, false);
  assert.equal(frequencyPoint.sourceSequence, 183922);
  assert.deepEqual(summary.pointEvidence.summary, {
    totalPoints: 2,
    authoritativeTimestampPoints: 1,
    missingTimestampPoints: 1,
    goodQualityPoints: 2,
    replayProofPoints: 2,
    missingReplayProofPoints: 0
  });
});

test("buildRuntimePointSummary never promotes absolute legacy tagTime to observedAt", () => {
  const summary = buildRuntimePointSummary([
    {
      drid: "chiller-device-1",
      drcode: "CH1",
      drname: "1#主机",
      reglist: [
        {
          regId: "reg-power-1",
          regName: "输入功率",
          newtagvalue: "452.1",
          tagTime: "2026-07-18T12:34:50+08:00"
        }
      ]
    }
  ], [], {});
  const point = summary.pointEvidence.points[0];

  assert.equal(point.observedAt, null);
  assert.equal(point.timestampBasis, "missing_source_timestamp");
  assert.equal(point.changedAt, "2026-07-18T04:34:50.000Z");
  assert.equal(point.changedTimestampBasis, "legacy_tag_time");
  assert.equal(point.authoritativeTimestamp, false);
});

test("buildRuntimePointSummary rejects untrusted generic serverTimestamp and caps LIVE thresholds", () => {
  const summary = buildRuntimePointSummary([
    {
      drid: "pump-device-2",
      drcode: "CWP2",
      drname: "2#冷却泵",
      reglist: [
        {
          regId: "reg-running-2",
          regName: "运行",
          newtagvalue: "1",
          observedAt: "2026-07-18T12:34:57+08:00",
          serverTimestamp: "2026-07-18T12:34:56+08:00",
          timestampBasis: "opcua_server_timestamp",
          sourceProtocol: "OPC UA",
          sourceSequence: 999,
          scanCycleId: "forged-cycle",
          bootId: "forged-boot",
          qualityCode: "GOOD"
        }
      ]
    }
  ], [], {
    runtimePointFreshnessPolicy: {
      liveMaxAgeMs: 86_400_000,
      maxFutureSkewMs: 60_000
    }
  });
  const point = summary.pointEvidence.points[0];

  assert.equal(point.observedAt, null);
  assert.equal(point.timestampBasis, "missing_source_timestamp");
  assert.equal(point.qualityCode, "UNKNOWN");
  assert.equal(point.sourceSequence, null);
  assert.equal(point.scanCycleId, null);
  assert.equal(point.bootId, null);
  assert.deepEqual(summary.freshnessPolicy, {
    clientRefreshIntervalMs: 10000,
    sourceExpectedIntervalMs: null,
    liveMaxAgeMs: 20000,
    maxFutureSkewMs: 2000
  });
});

test("buildRuntimePointSummary preserves zero future skew as a strict fail-closed policy", () => {
  const summary = buildRuntimePointSummary([], [], {
    runtimePointFreshnessPolicy: {
      liveMaxAgeMs: 5000,
      maxFutureSkewMs: 0
    }
  });

  assert.deepEqual(summary.freshnessPolicy, {
    clientRefreshIntervalMs: 10000,
    sourceExpectedIntervalMs: null,
    liveMaxAgeMs: 5000,
    maxFutureSkewMs: 0
  });
});

test("unknown runtime evidence profiles stay fail closed", () => {
  assert.equal(resolveCodeOwnedRuntimePointEvidenceDecoder("payload-selected-profile"), null);
});

test("a trusted evidence profile cannot promote a missing value to GOOD", () => {
  const summary = buildRuntimePointSummary([{
    drid: "device-null-value",
    reglist: [{
      regId: "reg-null-value",
      regName: "运行",
      tagName: "NULL-VALUE-RUN",
      serverTimestamp: "2026-07-18T12:34:56+08:00",
      qualityCode: "GOOD",
      sourceSequence: 1,
      scanCycleId: "cycle-1",
      bootId: "boot-1"
    }]
  }], [], {
    runtimePointEvidenceDecoder: resolveCodeOwnedRuntimePointEvidenceDecoder("opcua-datavalue-v1")
  });

  assert.equal(summary.pointEvidence.points[0].value, null);
  assert.equal(summary.pointEvidence.points[0].qualityCode, "BAD");
});

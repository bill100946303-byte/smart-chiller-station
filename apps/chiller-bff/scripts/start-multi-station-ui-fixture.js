import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { config as baseConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { createApp } from "../src/server.js";

export const MULTI_STATION_FIXTURE_SITE_ID = "ui-multi-station";

const FIXTURE_ACTOR = {
  userId: "ui-acceptance-fixture",
  username: "ui-acceptance-fixture"
};

const FIXTURE_BINDING_EDITOR = {
  userId: "ui-acceptance-binding-editor",
  username: "ui-acceptance-binding-editor"
};

const FIXTURE_BINDING_PUBLISHER = {
  userId: "ui-acceptance-binding-publisher",
  username: "ui-acceptance-binding-publisher"
};

const FIXTURE_DEVICES = [
  {
    drid: "101",
    drcode: "CH-A-01",
    drname: "A站 1#冷水机组",
    drtypename: "主机",
    typeYT: "1",
    points: [
      { pointCode: "CH-A-01-RUN", regName: "运行状态", value: "1", unit: "" }
    ]
  },
  {
    drid: "201",
    drcode: "CH-B-01",
    drname: "B站 1#冷水机组",
    drtypename: "主机",
    typeYT: "1",
    points: [
      { pointCode: "CH-B-01-RUN", regName: "运行状态", value: "1", unit: "" }
    ]
  },
  {
    drid: "301",
    drcode: "AIR-01",
    drname: "空压站 1#空压机",
    drtypename: "空压机",
    typeYT: "3",
    points: [
      { pointCode: "AIR-01-POWER", regName: "空压站总功率", value: "286", unit: "kW" },
      { pointCode: "AIR-01-PRESSURE", regName: "管网压力", value: "0.68", unit: "bar" },
      { pointCode: "AIR-01-FLOW", regName: "供气流量", value: "49.2", unit: "Nm3/min" },
      { pointCode: "AIR-01-RUN", regName: "运行状态", value: "1", unit: "" },
      { pointCode: "AIR-01-ALARM", regName: "空压站告警", value: "0", unit: "" },
      { pointCode: "AIR-01-DEW-POINT", regName: "干燥机露点", value: "-20", unit: "°C" }
    ]
  },
  {
    drid: "401",
    drcode: "BOILER-01",
    drname: "锅炉房 1#锅炉",
    drtypename: "锅炉",
    typeYT: "4",
    points: [
      { pointCode: "BOILER-01-POWER", regName: "锅炉房电功率", value: "42", unit: "kW" },
      { pointCode: "BOILER-01-PRESSURE", regName: "系统压力", value: "0.82", unit: "MPa" },
      { pointCode: "BOILER-01-FLOW", regName: "热媒流量", value: "35.6", unit: "m3/h" },
      { pointCode: "BOILER-01-TEMPERATURE", regName: "供回水或蒸汽温度", value: "82.5", unit: "°C" },
      { pointCode: "BOILER-01-RUN", regName: "锅炉状态", value: "1", unit: "" }
    ]
  }
];

function normalizePort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : fallback;
}

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
}

function createFixtureUpstreamApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.use((req, res) => {
    const requestPath = req.path;

    if (requestPath === "/user/login") {
      res.type("application/xml").send([
        "<response>",
        "<status>20000</status>",
        "<msg>fixture login ok</msg>",
        "<token>fixture-token</token>",
        "<data><user>",
        "<id>fixture-observer</id>",
        "<userId>fixture-observer</userId>",
        "<username>多站房验收员</username>",
        "<role>0</role>",
        "</user></data>",
        "</response>"
      ].join(""));
      return;
    }

    if (requestPath === "/user/dologin") {
      res.json({
        status: 20000,
        data: {
          id: "fixture-observer",
          username: "多站房验收员",
          role: "0",
          appusergroup: [
            {
              appid: MULTI_STATION_FIXTURE_SITE_ID,
              appName: "multiStation",
              appexplain: "多能源站 UI 验收园区",
              key: MULTI_STATION_FIXTURE_SITE_ID,
              template: "1",
              city: "深圳市"
            },
            {
              appid: "fixture-spare-1",
              appName: "fixtureSpare1",
              appexplain: "验收备用项目 1",
              key: "fixture-spare-1",
              template: "1",
              city: "深圳市"
            },
            {
              appid: "fixture-spare-2",
              appName: "fixtureSpare2",
              appexplain: "验收备用项目 2",
              key: "fixture-spare-2",
              template: "1",
              city: "深圳市"
            }
          ]
        }
      });
      return;
    }

    if (
      requestPath === "/zsqy/manager/findAllByCondition"
      || requestPath === "/zsqy/appusergroup/findObjectByProvinces"
    ) {
      res.type("application/xml").send("<response><status>20000</status></response>");
      return;
    }

    if (requestPath.includes("/zsqy/drinfo/") && requestPath.endsWith("/findObject")) {
      res.json({
        status: 20000,
        data: FIXTURE_DEVICES.map(({ points: _points, ...device }) => device)
      });
      return;
    }

    if (requestPath.includes("/api/device/") && requestPath.endsWith("/data/tree")) {
      res.json({ status: 20000, data: [] });
      return;
    }

    if (requestPath.includes("/zsqy/reg/") && requestPath.endsWith("/findAllByDrTypeId")) {
      res.json({
        status: 20000,
        data: FIXTURE_DEVICES.map((device) => ({
          drid: device.drid,
          drcode: device.drcode,
          drname: device.drname,
          drtypename: device.drtypename,
          reglist: device.points.map((point) => ({
            tagName: point.pointCode,
            regName: point.regName,
            regUnits: point.unit,
            newtagvalue: point.value
          }))
        }))
      });
      return;
    }

    if (requestPath.includes("/zsqy/reg/") && requestPath.endsWith("/findObject")) {
      const deviceId = String(req.query.drId || "");
      const device = FIXTURE_DEVICES.find((item) => item.drid === deviceId);
      res.json({
        status: 20000,
        data: device
          ? device.points.map((point) => ({
              drId: device.drid,
              drcode: device.drcode,
              tagName: point.pointCode,
              regName: point.regName,
              regUnits: point.unit,
              newtagvalue: point.value
            }))
          : []
      });
      return;
    }

    res.json({ status: 20000, data: [], rows: [] });
  });

  return app;
}

function seedPublishedBinding(adminStore, stationId, device, upstreamBaseUrl) {
  const draft = adminStore.upsertStationRuntimeBinding(
    MULTI_STATION_FIXTURE_SITE_ID,
    stationId,
    {
      expectedVersion: 0,
      source: {
        databaseKey: "ui-multi-station-db",
        projectKey: "ui-multi-station-project",
        template: "1"
      },
      selectors: {
        deviceIds: [device.drid],
        deviceCodes: [device.drcode],
        pointCodes: device.points.map((point) => point.pointCode)
      }
    },
    FIXTURE_BINDING_EDITOR,
    {}
  );
  const effectiveSource = {
    legacyBaseUrl: upstreamBaseUrl,
    databaseKey: "ui-multi-station-db",
    projectKey: "ui-multi-station-project",
    template: "1",
    realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
    build: "1",
    floor: "1",
    mock: false
  };
  adminStore.recordStationRuntimeBindingValidation(
    MULTI_STATION_FIXTURE_SITE_ID,
    stationId,
    draft.bindingVersion,
    {
      ok: true,
      payloadHash: draft.payloadHash,
      checkedAt: new Date().toISOString(),
      matched: {
        deviceCount: 1,
        pointCount: device.points.length
      },
      effectiveSource,
      effectiveSourceHash: createHash("sha256")
        .update(JSON.stringify(effectiveSource))
        .digest("hex"),
      errors: []
    },
    FIXTURE_BINDING_EDITOR,
    {}
  );
  adminStore.publishStationRuntimeBinding(
    MULTI_STATION_FIXTURE_SITE_ID,
    stationId,
    draft.bindingVersion,
    FIXTURE_BINDING_PUBLISHER,
    {}
  );
}

function seedMultiStationStore(adminStore, upstreamBaseUrl) {
  adminStore.createSite(
    {
      siteId: MULTI_STATION_FIXTURE_SITE_ID,
      siteName: "多能源站 UI 验收园区",
      status: "active"
    },
    FIXTURE_ACTOR,
    {}
  );
  adminStore.upsertSiteSubsystems(
    MULTI_STATION_FIXTURE_SITE_ID,
    {
      items: [
        { subsystemType: "chilled_plant", status: "enabled", mode: "monitoring" },
        { subsystemType: "compressed_air", status: "enabled", mode: "monitoring" },
        { subsystemType: "boiler_room", status: "enabled", mode: "monitoring" },
        { subsystemType: "power_monitoring", status: "enabled", mode: "monitoring" },
        { subsystemType: "hvac_terminal", status: "enabled", mode: "monitoring" }
      ]
    },
    FIXTURE_ACTOR,
    {}
  );
  adminStore.upsertStationInstances(
    MULTI_STATION_FIXTURE_SITE_ID,
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
          status: "enabled",
          sortOrder: 20
        },
        {
          stationId: "chilled-c",
          stationName: "冷冻站 C（待绑定）",
          parentSubsystemType: "chilled_plant",
          status: "enabled",
          sortOrder: 25
        },
        {
          stationId: "air-01",
          stationName: "空压站 1",
          parentSubsystemType: "compressed_air",
          status: "enabled",
          sortOrder: 30
        },
        {
          stationId: "boiler-01",
          stationName: "锅炉房 1",
          parentSubsystemType: "boiler_room",
          status: "enabled",
          sortOrder: 40
        },
        {
          stationId: "boiler-02",
          stationName: "锅炉房 2",
          parentSubsystemType: "boiler_room",
          status: "not_configured",
          sortOrder: 50
        }
      ]
    },
    FIXTURE_ACTOR,
    {}
  );
  adminStore.upsertPointRoleMappings(
    MULTI_STATION_FIXTURE_SITE_ID,
    {
      subsystemType: "compressed_air",
      items: [
        { pointRole: "power", pointName: "空压站总功率", pointCode: "AIR-01-POWER", unit: "kW", required: true },
        { pointRole: "pressure", pointName: "管网压力", pointCode: "AIR-01-PRESSURE", unit: "bar", required: true },
        { pointRole: "flow", pointName: "供气流量", pointCode: "AIR-01-FLOW", unit: "Nm3/min", required: true },
        { pointRole: "status", pointName: "运行状态", pointCode: "AIR-01-RUN", unit: "", required: true },
        { pointRole: "alarm", pointName: "空压站告警", pointCode: "AIR-01-ALARM", unit: "", required: true },
        { pointRole: "temperature", pointName: "干燥机露点", pointCode: "AIR-01-DEW-POINT", unit: "°C", required: false }
      ]
    },
    FIXTURE_ACTOR,
    {}
  );
  adminStore.upsertPointRoleMappings(
    MULTI_STATION_FIXTURE_SITE_ID,
    {
      subsystemType: "boiler_room",
      items: [
        { pointRole: "power", pointName: "锅炉房电功率", pointCode: "BOILER-01-POWER", unit: "kW", required: false },
        { pointRole: "pressure", pointName: "系统压力", pointCode: "BOILER-01-PRESSURE", unit: "MPa", required: true },
        { pointRole: "flow", pointName: "热媒流量", pointCode: "BOILER-01-FLOW", unit: "m3/h", required: true },
        { pointRole: "temperature", pointName: "供回水或蒸汽温度", pointCode: "BOILER-01-TEMPERATURE", unit: "°C", required: true },
        { pointRole: "status", pointName: "锅炉状态", pointCode: "BOILER-01-RUN", unit: "", required: true }
      ]
    },
    FIXTURE_ACTOR,
    {}
  );
  adminStore.publishConfigVersion(
    MULTI_STATION_FIXTURE_SITE_ID,
    "multi-station-ui-v1",
    FIXTURE_ACTOR,
    {}
  );
  seedPublishedBinding(adminStore, "chilled-a", FIXTURE_DEVICES[0], upstreamBaseUrl);
  seedPublishedBinding(adminStore, "chilled-b", FIXTURE_DEVICES[1], upstreamBaseUrl);
  seedPublishedBinding(adminStore, "air-01", FIXTURE_DEVICES[2], upstreamBaseUrl);
  seedPublishedBinding(adminStore, "boiler-01", FIXTURE_DEVICES[3], upstreamBaseUrl);
}

export async function createMultiStationUiFixture(options = {}) {
  const host = options.host || "127.0.0.1";
  const upstreamPort = normalizePort(options.upstreamPort, 0);
  const bffPort = normalizePort(options.bffPort, 0);
  const upstreamServer = await listen(createFixtureUpstreamApp(), upstreamPort, host);
  const resolvedUpstreamPort = upstreamServer.address().port;
  const upstreamBaseUrl = `http://${host}:${resolvedUpstreamPort}`;
  const adminStore = createAdminStore({ dbFile: ":memory:" });
  try {
    seedMultiStationStore(adminStore, upstreamBaseUrl);
  } catch (error) {
    adminStore.close();
    await closeServer(upstreamServer);
    throw error;
  }

  const appConfig = {
    ...baseConfig,
    port: bffPort,
    appMode: "local",
    appModeLabel: "多站房验收",
    readOnlyMode: true,
    defaultSiteId: MULTI_STATION_FIXTURE_SITE_ID,
    legacyBaseUrl: upstreamBaseUrl,
    adminDbFile: ":memory:",
    adminDevAuth: false
  };
  const { app } = createApp(appConfig, { adminStore });
  let bffServer;
  try {
    bffServer = await listen(app, bffPort, host);
  } catch (error) {
    adminStore.close();
    await closeServer(upstreamServer);
    throw error;
  }
  const resolvedBffPort = bffServer.address().port;

  return {
    siteId: MULTI_STATION_FIXTURE_SITE_ID,
    bffUrl: `http://${host}:${resolvedBffPort}`,
    upstreamUrl: upstreamBaseUrl,
    async close() {
      await closeServer(bffServer);
      adminStore.close();
      await closeServer(upstreamServer);
    }
  };
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === entryFile) {
  const fixture = await createMultiStationUiFixture({
    host: "127.0.0.1",
    bffPort: normalizePort(process.env.MULTI_STATION_FIXTURE_BFF_PORT, 8791),
    upstreamPort: normalizePort(process.env.MULTI_STATION_FIXTURE_UPSTREAM_PORT, 8792)
  });
  console.log(`[multi-station-ui-fixture] BFF ${fixture.bffUrl}`);
  console.log(`[multi-station-ui-fixture] siteId ${fixture.siteId}`);
  console.log(`[multi-station-ui-fixture] upstream ${fixture.upstreamUrl}`);
  console.log("[multi-station-ui-fixture] isolated=true readOnly=true adminDb=:memory:");

  let closing = false;
  const shutdown = async () => {
    if (closing) {
      return;
    }
    closing = true;
    await fixture.close();
  };
  process.once("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  createMultiStationUiFixture,
  MULTI_STATION_FIXTURE_SITE_ID
} from "./start-multi-station-ui-fixture.js";

test("multi-station UI fixture exposes isolated physical-station data across energy types", async () => {
  const fixture = await createMultiStationUiFixture();
  const siteBaseUrl = `${fixture.bffUrl}/bff/v1/sites/${MULTI_STATION_FIXTURE_SITE_ID}`;

  try {
    const healthResponse = await fetch(`${fixture.bffUrl}/healthz`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.readOnlyMode, true);
    assert.equal(health.adminDbFile, ":memory:");
    assert.equal(health.adminDevAuth, false);

    const loginResponse = await fetch(`${fixture.upstreamUrl}/user/login?username=fixture&password=fixture`);
    const loginBody = await loginResponse.text();
    assert.equal(loginResponse.status, 200);
    assert.match(loginBody, /<token>fixture-token<\/token>/);

    const profileResponse = await fetch(`${fixture.upstreamUrl}/user/dologin?token=fixture-token`);
    const profile = await profileResponse.json();
    assert.equal(profileResponse.status, 200);
    assert.equal(profile.data.appusergroup.length, 3);
    assert.equal(profile.data.appusergroup[0].appid, MULTI_STATION_FIXTURE_SITE_ID);
    assert.equal(profile.data.appusergroup[0].appName, "multiStation");

    const capabilitiesResponse = await fetch(`${siteBaseUrl}/capabilities`);
    const capabilities = await capabilitiesResponse.json();
    assert.equal(capabilitiesResponse.status, 200);
    assert.equal(capabilities.stationTotal, 6);
    assert.deepEqual(
      capabilities.stationInstances.map((item) => item.stationId),
      ["chilled-a", "chilled-b", "chilled-c", "air-01", "boiler-01", "boiler-02"]
    );
    assert.deepEqual(
      capabilities.stationInstances
        .filter((item) => item.parentSubsystemType === "chilled_plant")
        .map((item) => [item.stationId, item.bindingState, item.publishedBindingVersion]),
      [
        ["chilled-a", "published", 1],
        ["chilled-b", "published", 1],
        ["chilled-c", "unconfigured", null]
      ]
    );
    assert.equal(
      capabilities.stationInstances.find((item) => item.stationId === "air-01")?.bindingState,
      "published"
    );
    assert.equal(
      capabilities.stationInstances.find((item) => item.stationId === "boiler-01")?.bindingState,
      "published"
    );
    assert.equal(
      capabilities.stationInstances.find((item) => item.stationId === "chilled-c")?.bindingState,
      "unconfigured"
    );

    for (const [stationId, expectedDeviceId] of [
      ["chilled-a", "101"],
      ["chilled-b", "201"]
    ]) {
      const response = await fetch(`${siteBaseUrl}/runtime/summary?stationId=${stationId}`);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.counts.deviceRows, 1);
      assert.equal(payload.dataScope.applied, true);
      assert.equal(payload.dataScope.stationId, stationId);
      assert.equal(payload.dataScope.bindingVersion, 1);

      const deviceResponse = await fetch(
        `${siteBaseUrl}/devices/list?stationId=${stationId}&page=1&pageSize=10`
      );
      const devicePayload = await deviceResponse.json();
      assert.equal(deviceResponse.status, 200);
      assert.deepEqual(devicePayload.items.map((item) => item.deviceId), [expectedDeviceId]);
    }

    const airResponse = await fetch(`${siteBaseUrl}/runtime/summary?stationId=air-01`);
    const airPayload = await airResponse.json();
    assert.equal(airResponse.status, 200);
    assert.equal(airPayload.dataScope.applied, true);
    assert.equal(airPayload.dataScope.stationId, "air-01");
    assert.equal(airPayload.dataScope.effectiveSubsystemType, "compressed_air");
    assert.equal(airPayload.stationProcess.readiness, "ready");
    assert.equal(airPayload.stationProcess.metrics.compressedAir.powerKw, 286);
    assert.equal(airPayload.stationProcess.metrics.compressedAir.pressureBar, 0.68);
    assert.equal(airPayload.stationProcess.metrics.compressedAir.flowNm3Min, 49.2);
    assert.equal(airPayload.stationProcess.metrics.compressedAir.specificEnergyKwhNm3, 0.0969);
    assert.equal(airPayload.stationProcess.operatingState.activeAlarmPointCount, 0);
    const airDevicesResponse = await fetch(
      `${siteBaseUrl}/devices/list?stationId=air-01&page=1&pageSize=10`
    );
    assert.deepEqual((await airDevicesResponse.json()).items.map((item) => item.deviceId), ["301"]);

    const coldUnboundResponse = await fetch(`${siteBaseUrl}/runtime/summary?stationId=chilled-c`);
    assert.equal(coldUnboundResponse.status, 409);
    assert.equal((await coldUnboundResponse.json()).code, "STATION_RUNTIME_SCOPE_NOT_CONFIGURED");

    const boilerResponse = await fetch(`${siteBaseUrl}/runtime/summary?stationId=boiler-01`);
    const boilerPayload = await boilerResponse.json();
    assert.equal(boilerResponse.status, 200);
    assert.equal(boilerPayload.dataScope.applied, true);
    assert.equal(boilerPayload.dataScope.stationId, "boiler-01");
    assert.equal(boilerPayload.dataScope.effectiveSubsystemType, "boiler_room");
    assert.equal(boilerPayload.stationProcess.readiness, "ready");
    assert.equal(boilerPayload.stationProcess.metrics.boilerRoom.powerKw, 42);
    assert.equal(boilerPayload.stationProcess.metrics.boilerRoom.pressureMpa, 0.82);
    assert.equal(boilerPayload.stationProcess.metrics.boilerRoom.thermalMediumFlow, 35.6);
    assert.equal(boilerPayload.stationProcess.metrics.boilerRoom.temperatureC, 82.5);
    const boilerDevicesResponse = await fetch(
      `${siteBaseUrl}/devices/list?stationId=boiler-01&page=1&pageSize=10`
    );
    assert.deepEqual((await boilerDevicesResponse.json()).items.map((item) => item.deviceId), ["401"]);

    const boilerInactiveResponse = await fetch(`${siteBaseUrl}/runtime/summary?stationId=boiler-02`);
    assert.equal(boilerInactiveResponse.status, 409);
    assert.equal((await boilerInactiveResponse.json()).code, "STATION_RUNTIME_SCOPE_INACTIVE");

    const unknownResponse = await fetch(`${siteBaseUrl}/runtime/summary?stationId=missing-station`);
    assert.equal(unknownResponse.status, 404);
    assert.equal((await unknownResponse.json()).code, "STATION_RUNTIME_SCOPE_NOT_FOUND");
  } finally {
    await fixture.close();
  }
});

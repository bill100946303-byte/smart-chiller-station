import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

const ROOM_MONITOR_DEVICE_PAGE_SIZE = 200;
const ROOM_MONITOR_DEVICE_TYPE_IDS = new Set(["192"]);
const ROOM_MONITOR_DEVICE_KEYWORDS = ["风机盘管"];

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function isLegacyPayloadOk(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return String(payload.status || "") === "20000" || payload.ok === true;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function toFiniteNumber(value) {
  const normalized = asTrimmedString(value, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractLegacyRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload?.data?.records)) {
    return payload.data.records.filter((item) => item && typeof item === "object");
  }

  if (Array.isArray(payload?.records)) {
    return payload.records.filter((item) => item && typeof item === "object");
  }

  const probed = deepArrayProbe(payload?.data ?? payload);
  return probed.filter((item) => item && typeof item === "object");
}

function normalizeBuilding(item, index) {
  return {
    id: asTrimmedString(item?.buildid || item?.id || `build-${index + 1}`),
    name: asTrimmedString(item?.buildname || item?.name || `build-${index + 1}`),
    description: asTrimmedString(item?.buildExplain || item?.description || ""),
    modelUrl: asTrimmedString(item?.modelIp || item?.model2dIp || ""),
    template: asTrimmedString(item?.template || "")
  };
}

function normalizeCondition(item, index) {
  return {
    id: asTrimmedString(item?.id || item?.conditionid || `condition-${index + 1}`),
    buildingId: asTrimmedString(item?.buildingId || item?.buildid || ""),
    monitoringSite: asTrimmedString(item?.monitoringSite || item?.name || `monitor-${index + 1}`),
    temperatureValue: asTrimmedString(item?.temperatureValue || ""),
    humidityValue: asTrimmedString(item?.humidityValue || ""),
    temperatureSetting: asTrimmedString(item?.temperatureSetting || ""),
    temperatureMax: asTrimmedString(item?.temperatureMax || ""),
    temperatureDeviation: asTrimmedString(item?.temperatureDeviation || ""),
    humiditySetting: asTrimmedString(item?.humiditySetting || ""),
    humidityMax: asTrimmedString(item?.humidityMax || ""),
    humidityDeviation: asTrimmedString(item?.humidityDeviation || ""),
    temperatureTagName: asTrimmedString(item?.temperatureTagname || ""),
    humidityTagName: asTrimmedString(item?.humidityTagname || ""),
    supplyAirTagName: asTrimmedString(item?.supplyairTagname || ""),
    returnAirTagName: asTrimmedString(item?.returnairTagname || ""),
    supplyAirValue: asTrimmedString(item?.supplyAirValue || ""),
    returnAirValue: asTrimmedString(item?.returnAirValue || "")
  };
}

function buildEnvironmentBuildingEndpoint(siteId) {
  return `/zsqy/buildinfo/${siteId}/findAll`;
}

function buildEnvironmentConditionEndpoint(siteId, options) {
  const search = new URLSearchParams();
  if (options.buildingId) {
    search.set("buildingId", options.buildingId);
  }
  if (options.cooledAir) {
    search.set("CooledAir", options.cooledAir);
  }
  if (options.monitoringSite) {
    search.set("monitoringSite", options.monitoringSite);
  }
  const query = search.toString();
  return `/zsqy/condition/${siteId}/findObject${query ? `?${query}` : ""}`;
}

function buildEnvironmentDeviceCatalogEndpoint(siteId) {
  return `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=${ROOM_MONITOR_DEVICE_PAGE_SIZE}`;
}

function buildEnvironmentRegisterEndpoint(siteId, deviceId) {
  return `/zsqy/reg/${siteId}/findObject?pageCurrent=1&pageSize=200&drId=${encodeURIComponent(deviceId)}`;
}

function normalizePrimarySourceStatus(endpoint, response, payload, rows) {
  const payloadOk = response.ok && isLegacyPayloadOk(payload);
  return {
    key: "environmentConditionsLegacy",
    endpoint,
    ok: payloadOk,
    status: response.status ?? null,
    message: extractMessage(payload, payloadOk ? "OK" : null),
    rows: payloadOk ? rows.length : null,
    error: payloadOk ? null : response.error || extractMessage(payload, "Legacy request failed")
  };
}

function normalizeRoomDevice(item, index) {
  return {
    deviceId: asTrimmedString(item?.drid || item?.id || `environment-device-${index + 1}`),
    buildingId: asTrimmedString(item?.buildid || item?.buildingId || ""),
    buildingName: asTrimmedString(item?.buildname || item?.buildingName || ""),
    monitoringSite: asTrimmedString(item?.drname || item?.monitoringSite || item?.name || `monitor-${index + 1}`),
    floorName: asTrimmedString(item?.floorName || item?.floor || ""),
    deviceTypeId: asTrimmedString(item?.drtypeid || item?.deviceTypeId || ""),
    deviceTypeName: asTrimmedString(item?.drtypename || item?.deviceTypeName || "")
  };
}

function normalizeRegister(item, index) {
  const rawValue = item?.newtagvalue ?? item?.tagValue ?? item?.qstagvalue ?? item?.showStatus ?? "";
  return {
    id: asTrimmedString(item?.regId || item?.id || `environment-reg-${index + 1}`),
    name: asTrimmedString(item?.regName || item?.name || ""),
    tagName: asTrimmedString(item?.tagName || item?.tagname || ""),
    units: asTrimmedString(item?.regUnits || item?.units || ""),
    readWrite: asTrimmedString(item?.regReadWrite || item?.readWrite || ""),
    value: asTrimmedString(rawValue, ""),
    numericValue: toFiniteNumber(rawValue),
    statusText: asTrimmedString(item?.showStatus || ""),
    raw: item
  };
}

function containsKeyword(value, keywords) {
  const normalized = asTrimmedString(value, "");
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword));
}

function matchesMonitoringSite(monitoringSite, keyword) {
  const normalizedSite = asTrimmedString(monitoringSite, "").toLowerCase();
  const normalizedKeyword = asTrimmedString(keyword, "").toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return normalizedSite.includes(normalizedKeyword);
}

function isRoomMonitorDevice(item) {
  const typeId = asTrimmedString(item?.drtypeid || item?.deviceTypeId || "");
  const typeName = asTrimmedString(item?.drtypename || item?.deviceTypeName || "");
  if (ROOM_MONITOR_DEVICE_TYPE_IDS.has(typeId)) {
    return true;
  }
  return containsKeyword(typeName, ROOM_MONITOR_DEVICE_KEYWORDS);
}

function pickRegister(registers, predicate) {
  return registers.find((item) => predicate(item)) || null;
}

function isTemperatureRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  if (name.includes("送风") || name.includes("回风") || name.includes("设定")) {
    return false;
  }
  return name.includes("内置温度") || name.includes("室内温度") || name === "温度";
}

function isTemperatureSettingRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  if (name.includes("设定温度") || name.includes("温度设定") || name.includes("目标温度")) {
    return true;
  }
  return name.includes("温度") && register?.readWrite === "2" && !name.includes("模式") && !name.includes("内置");
}

function isHumidityRegister(register) {
  const name = asTrimmedString(register?.name || "");
  return Boolean(name) && name.includes("湿度") && !name.includes("设定");
}

function isHumiditySettingRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  if (name.includes("设定湿度") || name.includes("湿度设定") || name.includes("目标湿度")) {
    return true;
  }
  return name.includes("湿度") && register?.readWrite === "2";
}

function isSupplyAirRegister(register) {
  const name = asTrimmedString(register?.name || "");
  return Boolean(name) && name.includes("送风") && name.includes("温度");
}

function isReturnAirRegister(register) {
  const name = asTrimmedString(register?.name || "");
  return Boolean(name) && name.includes("回风") && name.includes("温度");
}

function inferCoolingOn(registers) {
  const currentFanSpeedRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "当前风速状态" || name.includes("风速状态");
  });

  if (currentFanSpeedRegister?.numericValue != null) {
    return currentFanSpeedRegister.numericValue > 0;
  }

  const fanSpeedRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "风速" || (name.includes("风速") && !name.includes("当前"));
  });

  if (fanSpeedRegister?.numericValue != null) {
    return fanSpeedRegister.numericValue > 0;
  }

  const runningRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "运行" || name.includes("运行状态") || name.includes("空调开关");
  });

  if (runningRegister) {
    if (runningRegister.numericValue != null) {
      return runningRegister.numericValue > 0;
    }
    const stateText = asTrimmedString(runningRegister.statusText || runningRegister.value || "");
    if (stateText.includes("开") || stateText.includes("运行")) {
      return true;
    }
    if (stateText.includes("关") || stateText.includes("停")) {
      return false;
    }
  }

  const modeRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "模式" || name.includes("温控器模式");
  });
  if (modeRegister?.numericValue != null) {
    return modeRegister.numericValue > 0;
  }

  return null;
}

function normalizeFallbackCondition(device, registers, index) {
  const temperatureRegister = pickRegister(registers, isTemperatureRegister);
  const temperatureSettingRegister = pickRegister(registers, isTemperatureSettingRegister);
  const humidityRegister = pickRegister(registers, isHumidityRegister);
  const humiditySettingRegister = pickRegister(registers, isHumiditySettingRegister);
  const supplyAirRegister = pickRegister(registers, isSupplyAirRegister);
  const returnAirRegister = pickRegister(registers, isReturnAirRegister);

  return {
    id: asTrimmedString(device?.deviceId || `condition-${index + 1}`),
    buildingId: asTrimmedString(device?.buildingId || ""),
    monitoringSite: asTrimmedString(device?.monitoringSite || `monitor-${index + 1}`),
    temperatureValue: asTrimmedString(temperatureRegister?.value || ""),
    humidityValue: asTrimmedString(humidityRegister?.value || ""),
    temperatureSetting: asTrimmedString(temperatureSettingRegister?.value || ""),
    temperatureMax: "",
    temperatureDeviation: "",
    humiditySetting: asTrimmedString(humiditySettingRegister?.value || ""),
    humidityMax: "",
    humidityDeviation: "",
    temperatureTagName: asTrimmedString(temperatureRegister?.tagName || ""),
    humidityTagName: asTrimmedString(humidityRegister?.tagName || ""),
    supplyAirTagName: asTrimmedString(supplyAirRegister?.tagName || ""),
    returnAirTagName: asTrimmedString(returnAirRegister?.tagName || ""),
    supplyAirValue: asTrimmedString(supplyAirRegister?.value || ""),
    returnAirValue: asTrimmedString(returnAirRegister?.value || "")
  };
}

async function loadEnvironmentConditionFallback(baseUrl, siteId, options, primarySourceStatus) {
  const catalogEndpoint = buildEnvironmentDeviceCatalogEndpoint(siteId);
  const catalogResponse = await fetchLegacyJson(baseUrl, catalogEndpoint);
  const catalogPayload = catalogResponse.payload && typeof catalogResponse.payload === "object" ? catalogResponse.payload : null;
  const catalogPayloadOk = catalogResponse.ok && isLegacyPayloadOk(catalogPayload);
  const catalogRows = catalogPayloadOk ? extractLegacyRows(catalogPayload) : [];
  const roomDevices = catalogRows
    .filter(isRoomMonitorDevice)
    .map(normalizeRoomDevice)
    .filter((item) => (!options.buildingId || item.buildingId === options.buildingId))
    .filter((item) => matchesMonitoringSite(item.monitoringSite, options.monitoringSite));

  const catalogSourceStatus = {
    key: "environmentConditionsCatalog",
    endpoint: catalogEndpoint,
    ok: catalogPayloadOk,
    status: catalogResponse.status ?? null,
    message: extractMessage(catalogPayload, catalogPayloadOk ? "OK" : null),
    rows: catalogPayloadOk ? roomDevices.length : null,
    error: catalogPayloadOk ? null : catalogResponse.error || extractMessage(catalogPayload, "Legacy request failed")
  };

  if (!catalogPayloadOk || roomDevices.length === 0) {
    return {
      items: [],
      sourceStatuses: [primarySourceStatus, catalogSourceStatus]
    };
  }

  const runtimeResults = await Promise.all(
    roomDevices.map(async (device) => {
      const endpoint = buildEnvironmentRegisterEndpoint(siteId, device.deviceId);
      const response = await fetchLegacyJson(baseUrl, endpoint);
      const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
      const payloadOk = response.ok && isLegacyPayloadOk(payload);
      const rows = payloadOk ? extractLegacyRows(payload).map(normalizeRegister) : [];
      return {
        device,
        endpoint,
        payload,
        payloadOk,
        registers: rows,
        coolingOn: payloadOk ? inferCoolingOn(rows) : null,
        sourceStatus: {
          endpoint,
          ok: payloadOk,
          status: response.status ?? null,
          message: extractMessage(payload, payloadOk ? "OK" : null),
          rows: payloadOk ? rows.length : null,
          error: payloadOk ? null : response.error || extractMessage(payload, "Legacy request failed")
        }
      };
    })
  );

  const visibleResults = runtimeResults.filter((result) => {
    if (!result.payloadOk) {
      return false;
    }
    if (options.cooledAir === "1") {
      return result.coolingOn === true;
    }
    return true;
  });

  const runtimeSuccessCount = runtimeResults.filter((item) => item.payloadOk).length;
  const runtimeFailureCount = runtimeResults.length - runtimeSuccessCount;
  const firstRuntimeFailure = runtimeResults.find((item) => !item.payloadOk)?.sourceStatus || null;
  const runtimeSourceStatus = {
    key: "environmentConditionsRuntime",
    endpoint: `/zsqy/reg/${siteId}/findObject?pageCurrent=1&pageSize=200&drId=*`,
    ok: runtimeResults.length > 0 && runtimeFailureCount === 0,
    status: runtimeFailureCount === 0 ? 200 : runtimeSuccessCount > 0 ? 206 : firstRuntimeFailure?.status ?? null,
    message:
      runtimeFailureCount === 0
        ? "OK"
        : runtimeSuccessCount > 0
          ? `${runtimeSuccessCount}/${runtimeResults.length} runtime endpoints succeeded`
          : null,
    rows: visibleResults.length,
    error:
      runtimeFailureCount === 0
        ? null
        : runtimeSuccessCount > 0
          ? `${runtimeFailureCount} runtime endpoints failed`
          : firstRuntimeFailure?.error || "Legacy request failed"
  };

  return {
    items: visibleResults.map((result, index) => normalizeFallbackCondition(result.device, result.registers, index)),
    sourceStatuses: [primarySourceStatus, catalogSourceStatus, runtimeSourceStatus]
  };
}

export async function loadEnvironmentBuildings(baseUrl, siteId) {
  const endpoint = buildEnvironmentBuildingEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
  const payloadOk = response.ok && isLegacyPayloadOk(payload);
  const rows = payloadOk ? toArray(payload?.data) : [];

  return {
    items: rows.map(normalizeBuilding),
    sourceStatus: {
      endpoint,
      ok: payloadOk,
      status: response.status ?? null,
      message: extractMessage(payload, payloadOk ? "OK" : null),
      rows: payloadOk ? rows.length : null,
      error: payloadOk ? null : response.error || extractMessage(payload, "Legacy request failed")
    }
  };
}

export async function loadEnvironmentConditions(baseUrl, siteId, options = {}) {
  const normalizedOptions = {
    buildingId: asTrimmedString(options.buildingId || ""),
    cooledAir: asTrimmedString(options.cooledAir || ""),
    monitoringSite: asTrimmedString(options.monitoringSite || "")
  };
  const endpoint = buildEnvironmentConditionEndpoint(siteId, normalizedOptions);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
  const payloadOk = response.ok && isLegacyPayloadOk(payload);
  const rows = payloadOk ? toArray(payload?.data) : [];
  const primarySourceStatus = normalizePrimarySourceStatus(endpoint, response, payload, rows);

  if (payloadOk && rows.length > 0) {
    return {
      filters: {
        buildingId: normalizedOptions.buildingId || null,
        cooledAir: normalizedOptions.cooledAir || null,
        monitoringSite: normalizedOptions.monitoringSite || null
      },
      items: rows.map(normalizeCondition),
      sourceStatuses: [primarySourceStatus]
    };
  }

  const fallback = await loadEnvironmentConditionFallback(baseUrl, siteId, normalizedOptions, primarySourceStatus);

  return {
    filters: {
      buildingId: normalizedOptions.buildingId || null,
      cooledAir: normalizedOptions.cooledAir || null,
      monitoringSite: normalizedOptions.monitoringSite || null
    },
    items: fallback.items,
    sourceStatuses: fallback.sourceStatuses
  };
}

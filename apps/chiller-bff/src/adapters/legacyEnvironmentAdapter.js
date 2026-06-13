import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

const ROOM_MONITOR_DEVICE_PAGE_SIZE = 200;
const ROOM_MONITOR_DEVICE_TYPE_IDS = new Set(["192"]);
const ROOM_MONITOR_DEVICE_KEYWORDS = [
  "\u98ce\u673a\u76d8\u7ba1",
  "\u76d8\u7ba1\u98ce\u673a",
  "\u98ce\u76d8",
  "\u7a7a\u8c03\u7bb1",
  "\u65b0\u98ce",
  "\u672b\u7aef",
  "\u73af\u5883",
  "\u6e29\u6e7f\u5ea6",
  "FCU"
];
const ENVIRONMENT_FALLBACK_DEVICE_SCAN_LIMIT = 80;
const legacyCondition404Cache = new Set();

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

  if (Array.isArray(payload?.data?.records?.records)) {
    return payload.data.records.records.filter((item) => item && typeof item === "object");
  }

  if (Array.isArray(payload?.data?.records)) {
    return payload.data.records.filter((item) => item && typeof item === "object");
  }

  if (Array.isArray(payload?.records?.records)) {
    return payload.records.records.filter((item) => item && typeof item === "object");
  }

  if (Array.isArray(payload?.records)) {
    return payload.records.filter((item) => item && typeof item === "object");
  }

  const singletonNestedRecord = payload?.data?.records?.records ?? payload?.records?.records;
  if (singletonNestedRecord && typeof singletonNestedRecord === "object" && !Array.isArray(singletonNestedRecord)) {
    return [singletonNestedRecord];
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

function parseBuildFloorFromProjectKey(projectKey) {
  const normalized = asTrimmedString(projectKey, "");
  if (!normalized || !normalized.includes("-")) {
    return null;
  }
  const parts = normalized.split("-");
  const build = toFiniteNumber(parts[1]);
  const floor = parts.length >= 3 ? toFiniteNumber(parts[2]) : null;
  return {
    build: build == null ? null : String(Math.max(0, Math.floor(build))),
    floor: floor == null ? null : String(Math.max(0, Math.floor(floor)))
  };
}

function resolveBuildFloorScope(options = {}) {
  const fromProjectKey = parseBuildFloorFromProjectKey(options.projectKey);
  const build = asTrimmedString(options.build || fromProjectKey?.build || "");
  const floor = asTrimmedString(options.floor || fromProjectKey?.floor || "");
  return {
    build: build || null,
    floor: floor || null
  };
}

function matchesBuildFloorScope(device, scope) {
  if (!scope?.build && !scope?.floor) {
    return true;
  }
  if (scope.build && asTrimmedString(device?.buildingId || "") !== scope.build) {
    return false;
  }
  if (scope.floor && asTrimmedString(device?.floorId || "") !== scope.floor) {
    return false;
  }
  return true;
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
    floorId: asTrimmedString(item?.floorId || item?.floorid || ""),
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
  const normalizedLower = normalized.toLowerCase();
  return keywords.some((keyword) => normalizedLower.includes(asTrimmedString(keyword, "").toLowerCase()));
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
  const normalized = name.toLowerCase();
  const hasTempToken = /\u6e29\u5ea6/.test(name) || /\btemp(?:erature)?\b/.test(normalized);
  if (!hasTempToken) {
    return false;
  }
  if (/\u9001\u98ce|\u56de\u98ce/.test(name) || /\b(supply|return)\s*air\b/.test(normalized)) {
    return false;
  }
  if (/\u8bbe\u5b9a|\u76ee\u6807/.test(name) || /\b(setpoint|setting|target)\b/.test(normalized)) {
    return false;
  }
  if (/\u6e7f\u5ea6|\u6e7f\u7403|\u9732\u70b9/.test(name) || /\b(humidity|rh|dew)\b/.test(normalized)) {
    return false;
  }
  if (/\u6a21\u5f0f/.test(name) || /\bmode\b/.test(normalized)) {
    return false;
  }
  return true;
}

function isTemperatureSettingRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  const normalized = name.toLowerCase();
  const hasTempToken = /\u6e29\u5ea6/.test(name) || /\btemp(?:erature)?\b/.test(normalized);
  if (!hasTempToken) {
    return false;
  }
  if (/\u8bbe\u5b9a|\u76ee\u6807/.test(name) || /\b(setpoint|setting|target)\b/.test(normalized)) {
    return true;
  }
  return register?.readWrite === "2"
    && !/\u6a21\u5f0f/.test(name)
    && !/\bmode\b/.test(normalized)
    && !/\u9001\u98ce|\u56de\u98ce/.test(name)
    && !/\b(supply|return)\s*air\b/.test(normalized);
}

function isHumidityRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  const normalized = name.toLowerCase();
  const hasHumidityToken = /\u6e7f\u5ea6/.test(name) || /\b(humidity|rh)\b/.test(normalized);
  if (!hasHumidityToken) {
    return false;
  }
  return !/\u8bbe\u5b9a|\u76ee\u6807/.test(name) && !/\b(setpoint|setting|target)\b/.test(normalized);
}

function isHumiditySettingRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  const normalized = name.toLowerCase();
  const hasHumidityToken = /\u6e7f\u5ea6/.test(name) || /\b(humidity|rh)\b/.test(normalized);
  if (!hasHumidityToken) {
    return false;
  }
  if (/\u8bbe\u5b9a|\u76ee\u6807/.test(name) || /\b(setpoint|setting|target)\b/.test(normalized)) {
    return true;
  }
  return register?.readWrite === "2";
}

function isSupplyAirRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  const normalized = name.toLowerCase();
  return (/\u9001\u98ce/.test(name) && /\u6e29\u5ea6/.test(name))
    || /\b(supply|sa)\s*air\b/.test(normalized)
    || /\bsupply\s*temp\b/.test(normalized);
}

function isReturnAirRegister(register) {
  const name = asTrimmedString(register?.name || "");
  if (!name) {
    return false;
  }
  const normalized = name.toLowerCase();
  return (/\u56de\u98ce/.test(name) && /\u6e29\u5ea6/.test(name))
    || /\b(return|ra)\s*air\b/.test(normalized)
    || /\breturn\s*temp\b/.test(normalized);
}

function inferCoolingOn(registers) {
  const currentFanSpeedRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return /\u5f53\u524d\u98ce\u901f\u72b6\u6001/.test(name) || /\u98ce\u901f\u72b6\u6001/.test(name);
  });

  if (currentFanSpeedRegister?.numericValue != null) {
    return currentFanSpeedRegister.numericValue > 0;
  }

  const fanSpeedRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "\u98ce\u901f" || (/\u98ce\u901f/.test(name) && !/\u5f53\u524d/.test(name));
  });

  if (fanSpeedRegister?.numericValue != null) {
    return fanSpeedRegister.numericValue > 0;
  }

  const runningRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "\u8fd0\u884c" || /\u8fd0\u884c\u72b6\u6001/.test(name) || /\u7a7a\u8c03\u5f00\u5173/.test(name);
  });

  if (runningRegister) {
    if (runningRegister.numericValue != null) {
      return runningRegister.numericValue > 0;
    }
    const stateText = asTrimmedString(runningRegister.statusText || runningRegister.value || "");
    if (/\u5f00|\u8fd0\u884c/.test(stateText)) {
      return true;
    }
    if (/\u5173|\u505c/.test(stateText)) {
      return false;
    }
  }

  const modeRegister = pickRegister(registers, (item) => {
    const name = asTrimmedString(item?.name || "");
    return name === "\u6a21\u5f0f" || /\u6e29\u63a7\u5668\u6a21\u5f0f/.test(name);
  });
  if (modeRegister?.numericValue != null) {
    return modeRegister.numericValue > 0;
  }

  return null;
}

function hasEnvironmentSignal(registers) {
  if (!Array.isArray(registers) || registers.length === 0) {
    return false;
  }
  return registers.some((register) =>
    isTemperatureRegister(register)
    || isTemperatureSettingRegister(register)
    || isHumidityRegister(register)
    || isHumiditySettingRegister(register)
    || isSupplyAirRegister(register)
    || isReturnAirRegister(register)
  );
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

async function loadEnvironmentConditionFallback(baseUrl, siteId, options) {
  const catalogEndpoint = buildEnvironmentDeviceCatalogEndpoint(siteId);
  const catalogResponse = await fetchLegacyJson(baseUrl, catalogEndpoint);
  const catalogPayload = catalogResponse.payload && typeof catalogResponse.payload === "object" ? catalogResponse.payload : null;
  const catalogPayloadOk = catalogResponse.ok && isLegacyPayloadOk(catalogPayload);
  const catalogRows = catalogPayloadOk ? extractLegacyRows(catalogPayload) : [];
  const catalogDevices = catalogRows
    .map(normalizeRoomDevice)
    .filter((item) => matchesMonitoringSite(item.monitoringSite, options.monitoringSite));
  const buildFloorScope = resolveBuildFloorScope(options);
  const buildingScopedDevices = options.buildingId
    ? catalogDevices.filter((item) => item.buildingId === options.buildingId)
    : catalogDevices;
  const scopedDevices = buildingScopedDevices.filter((item) => matchesBuildFloorScope(item, buildFloorScope));
  const catalogScopedDevices = catalogDevices.filter((item) => matchesBuildFloorScope(item, buildFloorScope));
  const hasBuildFloorScope = Boolean(buildFloorScope.build || buildFloorScope.floor);
  const effectiveCatalogDevices =
    scopedDevices.length > 0
      ? scopedDevices
      : catalogScopedDevices.length > 0
        ? catalogScopedDevices
        : hasBuildFloorScope
          ? []
          : buildingScopedDevices.length > 0
            ? buildingScopedDevices
            : catalogDevices;
  const roomDevices = effectiveCatalogDevices.filter(isRoomMonitorDevice);
  const fallbackDevices = roomDevices.slice(0, ENVIRONMENT_FALLBACK_DEVICE_SCAN_LIMIT);

  const catalogSourceStatus = {
    key: "environmentConditionsCatalog",
    endpoint: catalogEndpoint,
    ok: catalogPayloadOk,
    status: catalogResponse.status ?? null,
    message: extractMessage(catalogPayload, catalogPayloadOk ? "OK" : null),
    rows: catalogPayloadOk ? fallbackDevices.length : null,
    error: catalogPayloadOk ? null : catalogResponse.error || extractMessage(catalogPayload, "Legacy request failed")
  };

  if (!catalogPayloadOk || fallbackDevices.length === 0) {
    return {
      items: [],
      sourceStatuses: [catalogSourceStatus]
    };
  }

  const runtimeResults = await Promise.all(
    fallbackDevices.map(async (device) => {
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
    if (!hasEnvironmentSignal(result.registers)) {
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
    fallback: false,
    reasonCode: null,
    originLabel: null,
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
    sourceStatuses: [catalogSourceStatus, runtimeSourceStatus]
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
    monitoringSite: asTrimmedString(options.monitoringSite || ""),
    projectKey: asTrimmedString(options.projectKey || ""),
    build: asTrimmedString(options.build || ""),
    floor: asTrimmedString(options.floor || "")
  };
  const endpoint = buildEnvironmentConditionEndpoint(siteId, normalizedOptions);
  const shouldSkipPrimary = legacyCondition404Cache.has(siteId);
  let payloadOk = false;
  let rows = [];
  let primarySourceStatus = null;

  if (!shouldSkipPrimary) {
    const response = await fetchLegacyJson(baseUrl, endpoint);
    const payload = response.payload && typeof response.payload === "object" ? response.payload : null;
    payloadOk = response.ok && isLegacyPayloadOk(payload);
    rows = payloadOk ? toArray(payload?.data) : [];
    primarySourceStatus = normalizePrimarySourceStatus(endpoint, response, payload, rows);
    if (response.status === 404) {
      legacyCondition404Cache.add(siteId);
    }
  } else {
    primarySourceStatus = {
      key: "environmentConditionsLegacy",
      endpoint,
      ok: false,
      status: 404,
      message: "Skipped after cached 404",
      rows: null,
      error: "Legacy condition endpoint unavailable (cached 404)"
    };
  }

  if (payloadOk) {
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

  const fallback = await loadEnvironmentConditionFallback(baseUrl, siteId, normalizedOptions);
  const fallbackSources = Array.isArray(fallback.sourceStatuses) ? fallback.sourceStatuses : [];
  const hasFallbackSuccess = fallbackSources.some((source) => source?.ok === true && Number(source?.rows || 0) > 0);
  const shouldSuppressPrimarySource =
    primarySourceStatus?.ok === false &&
    Number(primarySourceStatus?.status) === 404 &&
    hasFallbackSuccess;
  const sourceStatuses = shouldSuppressPrimarySource
    ? fallbackSources
    : [primarySourceStatus, ...fallbackSources].filter(Boolean);

  return {
    filters: {
      buildingId: normalizedOptions.buildingId || null,
      cooledAir: normalizedOptions.cooledAir || null,
      monitoringSite: normalizedOptions.monitoringSite || null
    },
    items: fallback.items,
    sourceStatuses
  };
}






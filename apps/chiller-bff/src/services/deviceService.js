import {
  loadDeviceDetail,
  loadDeviceDetails,
  loadDeviceList,
  loadDeviceRegisterCollection,
  loadDeviceTree
} from "../adapters/legacyDeviceAdapter.js";
import { createHash } from "node:crypto";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { annotateSourceEntry, buildSourceStatus } from "./sourceStatusService.js";

function normalizeOptionalText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

export function resolveDeviceQueryDefaults(config, options = {}) {
  const defaults =
    config?.siteSourceConfig?.defaultDeviceQuery &&
    typeof config.siteSourceConfig.defaultDeviceQuery === "object"
      ? config.siteSourceConfig.defaultDeviceQuery
      : {};
  const build = normalizeOptionalText(options.build) || normalizeOptionalText(defaults.build);
  const floor = normalizeOptionalText(options.floor) || normalizeOptionalText(defaults.floor);
  const mock = normalizeOptionalBoolean(options.mock);
  const defaultMock = normalizeOptionalBoolean(defaults.mock);
  return {
    ...options,
    ...(build ? { build } : {}),
    ...(floor ? { floor } : {}),
    ...(typeof mock === "boolean" ? { mock } : typeof defaultMock === "boolean" ? { mock: defaultMock } : {})
  };
}

export function resolveDeviceProjectKey(config, options = {}) {
  const explicitKey = normalizeOptionalText(options.projectKey);
  if (explicitKey) {
    return explicitKey;
  }
  const configuredKey = normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey);
  return configuredKey;
}

export function resolveDeviceDatabaseKey(config, options = {}) {
  const explicitDatabaseKey = normalizeOptionalText(options.databaseKey);
  if (explicitDatabaseKey) {
    return explicitDatabaseKey;
  }
  const databaseCandidates = Array.isArray(options?.databaseKeyCandidates)
    ? options.databaseKeyCandidates.map((item) => normalizeOptionalText(item)).filter(Boolean)
    : [];
  if (databaseCandidates.length > 0) {
    return databaseCandidates[0];
  }
  const configuredDatabaseKey = normalizeOptionalText(config?.siteSourceConfig?.databaseKey);
  if (configuredDatabaseKey) {
    return configuredDatabaseKey;
  }
  const configuredDeviceDataProjectKey = normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey);
  if (configuredDeviceDataProjectKey) {
    return configuredDeviceDataProjectKey;
  }
  const configuredPreferredProjectKey = normalizeOptionalText(config?.siteSourceConfig?.preferredProjectKey);
  if (configuredPreferredProjectKey) {
    return configuredPreferredProjectKey;
  }
  return "";
}

export function resolveDeviceRealtimeInterface(config) {
  const items = Array.isArray(config?.siteSourceConfig?.deviceDataInterfaces)
    ? config.siteSourceConfig.deviceDataInterfaces
    : [];
  return items.find((item) => normalizeOptionalText(item?.endpointKind)) || null;
}

function resolveInterfaceKind(interfaceKind, fallbackKind) {
  return normalizeOptionalText(interfaceKind) || fallbackKind;
}

function shouldSuppressDeviceTreeSourceForDetail(sourceStatus) {
  const treeOk = sourceStatus?.tree?.ok === true;
  if (treeOk) {
    return false;
  }
  const catalogOk = sourceStatus?.catalog?.ok === true;
  if (!catalogOk) {
    return false;
  }
  const treeStatus = sourceStatus?.tree?.status;
  const treeMessage = normalizeOptionalText(sourceStatus?.tree?.message).toLowerCase();
  const treeError = normalizeOptionalText(sourceStatus?.tree?.error).toLowerCase();
  const hasPayloadUnavailableHint =
    treeMessage.includes("payload unavailable") || treeError.includes("payload unavailable");
  return Number(treeStatus) === 200 && hasPayloadUnavailableHint;
}

function buildDeviceDetailSourceStatus(config, realtimeInterface, sourceStatus, keyPrefix = "deviceDetail") {
  const suppressTreeSource = shouldSuppressDeviceTreeSourceForDetail(sourceStatus);
  return buildSourceStatus([
    annotateSourceEntry({
      key: `${keyPrefix}Catalog`,
      ...(sourceStatus?.catalog || {})
    }, {
      baseUrl: config.legacyBaseUrl,
      interfaceKind: "legacy-device-catalog"
    }),
    suppressTreeSource
      ? null
      : annotateSourceEntry({
        key: `${keyPrefix}Tree`,
        ...(sourceStatus?.tree || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: resolveInterfaceKind(realtimeInterface?.endpointKind, "api-device-tree")
      }),
    sourceStatus?.runtime
      ? annotateSourceEntry({
        key: `${keyPrefix}Runtime`,
        ...(sourceStatus.runtime || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: resolveInterfaceKind(realtimeInterface?.endpointKind, "legacy-device-runtime")
      })
      : null,
    sourceStatus?.placeholder
      ? {
        key: `${keyPrefix}Placeholder`,
        ...(sourceStatus.placeholder || {})
      }
      : null
  ].filter(Boolean));
}

function asArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickFirstFiniteNumber(...values) {
  for (const value of values) {
    const number = asFiniteNumber(value);
    if (number !== null) {
      return number;
    }
  }
  return null;
}

function getRuntimeRegisters(row) {
  const raw = row?.reglist?.reglist ?? row?.reglist;
  return asArray(raw).filter((item) => item && typeof item === "object");
}

function resolveReadOnlyRuntimeEnrichment(config) {
  const enrichment = config?.siteSourceConfig?.readOnlyRuntimeEnrichment;
  if (!enrichment || typeof enrichment !== "object" || Array.isArray(enrichment)) {
    return null;
  }
  if (
    enrichment.enabled !== true ||
    normalizeOptionalText(enrichment.mode) !== "read-only" ||
    normalizeOptionalText(enrichment.allowedMethod).toUpperCase() !== "GET" ||
    normalizeOptionalText(enrichment.endpointKind) !== "legacy-reg-findObject-all"
  ) {
    return null;
  }
  const exactDeviceCodes = asArray(enrichment.exactDeviceCodes)
    .map((item) => normalizeOptionalText(item).toUpperCase())
    .filter(Boolean);
  const exactSignalRegisterNames = enrichment.exactSignalRegisterNames;
  const exactTagNamesByDeviceCode = enrichment.exactTagNamesByDeviceCode;
  const exactTagAliasRule = enrichment.exactTagAliasRule;
  if (
    exactDeviceCodes.length === 0 ||
    !exactSignalRegisterNames ||
    typeof exactSignalRegisterNames !== "object" ||
    Array.isArray(exactSignalRegisterNames) ||
    !exactTagNamesByDeviceCode ||
    typeof exactTagNamesByDeviceCode !== "object" ||
    Array.isArray(exactTagNamesByDeviceCode) ||
    normalizeOptionalText(exactTagAliasRule?.transform) !== "replace-leading-prefix-only" ||
    !normalizeOptionalText(exactTagAliasRule?.sourcePrefix) ||
    normalizeOptionalText(exactTagAliasRule?.runtimePrefixTemplate) !== "{deviceCode}-"
  ) {
    return null;
  }
  return {
    ...enrichment,
    exactDeviceCodes,
    exactTagNamesByDeviceCode,
    exactTagAliasRule,
    pageSize: Number.isFinite(Number(enrichment.pageSize)) && Number(enrichment.pageSize) > 0
      ? Math.floor(Number(enrichment.pageSize))
      : 5000
  };
}

function readExactIdentifier(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  const raw = String(value);
  return raw && raw === raw.trim() ? raw : "";
}

function resolveExactRuntimeTagName(sourceTagName, deviceCode, enrichmentConfig) {
  const sourceTag = readExactIdentifier(sourceTagName);
  const exactDeviceCode = readExactIdentifier(deviceCode);
  const sourcePrefix = readExactIdentifier(enrichmentConfig?.exactTagAliasRule?.sourcePrefix);
  if (!sourceTag || !exactDeviceCode || !sourcePrefix || !sourceTag.startsWith(sourcePrefix)) {
    return "";
  }
  return `${exactDeviceCode}-${sourceTag.slice(sourcePrefix.length)}`;
}

function runtimeRowDeviceId(row) {
  return normalizeOptionalText(row?.drid ?? row?.drId ?? row?.deviceId ?? row?.id);
}

function runtimeRowDeviceCode(row) {
  return normalizeOptionalText(row?.drcode ?? row?.drCode ?? row?.deviceCode).toUpperCase();
}

function runtimeRegisterTagName(record) {
  return normalizeOptionalText(record?.tagName ?? record?.tagname);
}

function mergeExactReadOnlyRuntimeRegisters(baseRows, enrichmentRows, enrichmentConfig) {
  const allowedDeviceCodes = new Set(enrichmentConfig.exactDeviceCodes);
  const exactTagNamesByDeviceCode = enrichmentConfig.exactTagNamesByDeviceCode;
  const signalNameEntries = Object.entries(enrichmentConfig.exactSignalRegisterNames)
    .map(([semanticKey, regName]) => [semanticKey, normalizeOptionalText(regName)])
    .filter(([, regName]) => Boolean(regName));
  const semanticKeyByRegisterName = new Map(
    signalNameEntries.map(([semanticKey, regName]) => [regName, semanticKey])
  );
  const selectedByMergeKey = new Map();
  const selectedRowsByDeviceId = new Map();
  const selectedEquipmentCodes = new Set();
  const signalCounts = Object.fromEntries(signalNameEntries.map(([semanticKey]) => [semanticKey, 0]));
  const validationErrors = [];
  const contractDeviceCodes = Object.keys(exactTagNamesByDeviceCode)
    .map((code) => normalizeOptionalText(code).toUpperCase())
    .filter(Boolean);
  if (
    contractDeviceCodes.length !== allowedDeviceCodes.size ||
    contractDeviceCodes.some((code) => !allowedDeviceCodes.has(code))
  ) {
    validationErrors.push("exact tag selector devices do not match exactDeviceCodes");
  }
  const contractSignalCounts = Object.fromEntries(signalNameEntries.map(([semanticKey]) => [semanticKey, 0]));
  const contractTagNames = new Set();
  for (const deviceCode of allowedDeviceCodes) {
    const selectors = exactTagNamesByDeviceCode[deviceCode];
    if (!selectors || typeof selectors !== "object" || Array.isArray(selectors)) {
      validationErrors.push(`missing exact tag selectors for ${deviceCode}`);
      continue;
    }
    for (const [semanticKey] of signalNameEntries) {
      const sourceTagName = readExactIdentifier(selectors[semanticKey]);
      if (!sourceTagName) {
        continue;
      }
      const expectedTagName = resolveExactRuntimeTagName(
        sourceTagName,
        deviceCode,
        enrichmentConfig
      );
      if (!expectedTagName) {
        validationErrors.push(`invalid exact tag alias contract for ${deviceCode}.${semanticKey}`);
        continue;
      }
      contractSignalCounts[semanticKey] = (contractSignalCounts[semanticKey] || 0) + 1;
      if (contractTagNames.has(expectedTagName)) {
        validationErrors.push(`duplicate exact tag selector ${expectedTagName}`);
      }
      contractTagNames.add(expectedTagName);
    }
  }
  for (const [semanticKey, expectedValue] of Object.entries(enrichmentConfig.expectedSignalCounts || {})) {
    const expectedCount = Number(expectedValue);
    if (
      Number.isFinite(expectedCount) &&
      expectedCount >= 0 &&
      contractSignalCounts[semanticKey] !== expectedCount
    ) {
      validationErrors.push(
        `${semanticKey} tag contract coverage ${contractSignalCounts[semanticKey] || 0}/${expectedCount}`
      );
    }
  }

  for (const row of Array.isArray(enrichmentRows) ? enrichmentRows : []) {
    const deviceId = runtimeRowDeviceId(row);
    const deviceCode = runtimeRowDeviceCode(row);
    if (!deviceId || !allowedDeviceCodes.has(deviceCode)) {
      continue;
    }
    for (const record of getRuntimeRegisters(row)) {
      const recordDeviceId = readExactIdentifier(record?.drId ?? record?.drid ?? record?.deviceId);
      const recordDeviceCode = readExactIdentifier(record?.drcode ?? record?.drCode ?? record?.deviceCode);
      const regName = readExactIdentifier(record?.regName ?? record?.regname);
      const semanticKey = semanticKeyByRegisterName.get(regName);
      const tagName = readExactIdentifier(record?.tagName ?? record?.tagname);
      if (
        !semanticKey ||
        !recordDeviceId ||
        !recordDeviceCode ||
        recordDeviceId !== deviceId ||
        recordDeviceCode !== deviceCode ||
        !allowedDeviceCodes.has(recordDeviceCode)
      ) {
        continue;
      }
      const expectedTagName = resolveExactRuntimeTagName(
        exactTagNamesByDeviceCode[deviceCode]?.[semanticKey],
        deviceCode,
        enrichmentConfig
      );
      if (!expectedTagName || tagName !== expectedTagName) {
        validationErrors.push(
          `${deviceCode}.${semanticKey} tag mismatch: ${tagName || "missing"}`
        );
        continue;
      }
      const mergeKey = `${deviceId}\u0000${tagName}`;
      if (selectedByMergeKey.has(mergeKey)) {
        validationErrors.push(`duplicate exact register selector ${deviceId}+${tagName}`);
        continue;
      }
      selectedByMergeKey.set(mergeKey, { deviceId, deviceCode, semanticKey, record });
      selectedEquipmentCodes.add(deviceCode);
      signalCounts[semanticKey] = (signalCounts[semanticKey] || 0) + 1;
      if (!selectedRowsByDeviceId.has(deviceId)) {
        selectedRowsByDeviceId.set(deviceId, {
          ...row,
          drid: deviceId,
          drcode: deviceCode,
          reglist: []
        });
      }
      selectedRowsByDeviceId.get(deviceId).reglist.push(record);
    }
  }

  const expectedEquipmentCount = Number(enrichmentConfig.expectedEquipmentCount);
  if (
    Number.isFinite(expectedEquipmentCount) &&
    expectedEquipmentCount >= 0 &&
    selectedEquipmentCodes.size !== expectedEquipmentCount
  ) {
    validationErrors.push(
      `exact equipment coverage ${selectedEquipmentCodes.size}/${expectedEquipmentCount}`
    );
  }
  for (const [semanticKey, expectedValue] of Object.entries(enrichmentConfig.expectedSignalCounts || {})) {
    const expectedCount = Number(expectedValue);
    if (Number.isFinite(expectedCount) && expectedCount >= 0 && signalCounts[semanticKey] !== expectedCount) {
      validationErrors.push(
        `${semanticKey} exact signal coverage ${signalCounts[semanticKey] || 0}/${expectedCount}`
      );
    }
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      rows: Array.isArray(baseRows) ? baseRows : [],
      selectedPointCount: selectedByMergeKey.size,
      selectedEquipmentCount: selectedEquipmentCodes.size,
      signalCounts,
      error: validationErrors.join("; ")
    };
  }

  const baseSourceRows = Array.isArray(baseRows) ? baseRows : [];
  const mergedRows = baseSourceRows.map((row) => ({
    ...row,
    reglist: [...getRuntimeRegisters(row)]
  }));
  const rowIndexByDeviceId = new Map(
    mergedRows.map((row, index) => [runtimeRowDeviceId(row), index]).filter(([deviceId]) => Boolean(deviceId))
  );

  for (const [deviceId, selectedRow] of selectedRowsByDeviceId.entries()) {
    const existingIndex = rowIndexByDeviceId.get(deviceId);
    if (existingIndex === undefined) {
      rowIndexByDeviceId.set(deviceId, mergedRows.length);
      mergedRows.push(selectedRow);
      continue;
    }
    const existingRow = mergedRows[existingIndex];
    const selectedTagNames = new Set(selectedRow.reglist.map(runtimeRegisterTagName).filter(Boolean));
    const preservedRegisters = getRuntimeRegisters(existingRow).filter((record) => {
      const tagName = runtimeRegisterTagName(record);
      return !tagName || !selectedTagNames.has(tagName);
    });
    mergedRows[existingIndex] = {
      ...existingRow,
      reglist: [...selectedRow.reglist, ...preservedRegisters]
    };
  }

  return {
    ok: true,
    rows: mergedRows,
    selectedPointCount: selectedByMergeKey.size,
    selectedEquipmentCount: selectedEquipmentCodes.size,
    signalCounts,
    error: null
  };
}

function findRuntimeRegister(row, names) {
  const allowedNames = new Set(names.map((item) => normalizeOptionalText(item)));
  return getRuntimeRegisters(row).find((record) => allowedNames.has(normalizeOptionalText(record?.regName))) || null;
}

function readRuntimeValue(record) {
  if (!record || typeof record !== "object") {
    return null;
  }
  return pickFirstFiniteNumber(record.newtagvalue, record.tagValue, record.qstagvalue, record.tagvalue);
}

function readRuntimeText(record) {
  if (!record || typeof record !== "object") {
    return "";
  }
  return normalizeOptionalText(record.newtagvalue ?? record.tagValue ?? record.qstagvalue ?? record.tagvalue ?? record.showStatus);
}

function readRuntimePoint(row, names, key, label) {
  const record = findRuntimeRegister(row, names);
  if (!record) {
    return null;
  }
  const numericValue = readRuntimeValue(record);
  const readWrite = normalizeOptionalText(record.regReadWrite ?? record.regreadwrite);
  const tagAlarmState = asFiniteNumber(record.tagAlarmState ?? record.tagalarmstate);
  const isAlarm = asFiniteNumber(record.isAlarm ?? record.isalarm);
  return {
    key,
    label,
    pointName: normalizeOptionalText(record.regName) || label,
    tagName: normalizeOptionalText(record.tagName),
    value: readRuntimeText(record),
    numericValue,
    unit: normalizeOptionalText(record.regUnits ?? record.regunits) || null,
    writable: readWrite === "2",
    writeAllowed: false,
    rawTagTime: normalizeOptionalText(record.tagTime) || null,
    alarmActive: tagAlarmState != null ? tagAlarmState > 0 : isAlarm === 1 && numericValue != null ? numericValue > 0 : null
  };
}

function isFanCoilRuntimeRow(row) {
  const typeName = normalizeOptionalText(row?.drtypename || row?.deviceTypeName || row?.drtypenameCNEN);
  if (/风机盘管|fan\s*coil|fcu/i.test(typeName)) {
    return true;
  }
  const registers = getRuntimeRegisters(row);
  return Boolean(
    findRuntimeRegister(row, ["内置温度"]) &&
    registers.some((record) => ["当前风速状态", "风速模式", "阀门状态"].includes(normalizeOptionalText(record?.regName)))
  );
}

function roundTo(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function averageNumbers(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function valueAsBool(point) {
  if (!point || typeof point.numericValue !== "number") {
    return null;
  }
  return point.numericValue > 0;
}

function buildFanCoilQuality({ zoneTemperatureC, running, communicationAlarm }) {
  const flags = [];
  if (zoneTemperatureC === null || zoneTemperatureC === undefined) {
    flags.push("missing_temperature");
  } else if (zoneTemperatureC === 0) {
    flags.push("zero_temperature");
    flags.push("invalid_temperature");
  } else if (!validComfortTemperature(zoneTemperatureC)) {
    flags.push("out_of_range_temperature");
    flags.push("invalid_temperature");
  }
  if (communicationAlarm === true) {
    flags.push("communication_alarm");
  }
  if (running === false) {
    flags.push("stopped");
  }

  const comfortEligible =
    validComfortTemperature(zoneTemperatureC) &&
    zoneTemperatureC !== 0 &&
    communicationAlarm !== true;
  const status =
    flags.includes("communication_alarm") || flags.includes("invalid_temperature") || flags.includes("missing_temperature")
      ? "invalid"
      : "ok";

  return {
    status,
    flags,
    comfortEligible,
    excludedFromComfortStats: !comfortEligible
  };
}

function normalizeFanCoilRow(row, sampledAt) {
  const registers = getRuntimeRegisters(row);
  const points = {
    run: readRuntimePoint(row, ["运行"], "run", "运行"),
    communicationAlarm: readRuntimePoint(row, ["通讯报警"], "communicationAlarm", "通讯报警"),
    panelMode: readRuntimePoint(row, ["面板模式"], "panelMode", "面板模式"),
    mode: readRuntimePoint(row, ["模式"], "mode", "模式"),
    manualStart: readRuntimePoint(row, ["手动启动"], "manualStart", "手动启动"),
    manualStop: readRuntimePoint(row, ["手动停止"], "manualStop", "手动停止"),
    fanSpeedState: readRuntimePoint(row, ["当前风速状态"], "fanSpeedState", "当前风速状态"),
    zoneTemperature: readRuntimePoint(row, ["内置温度"], "zoneTemperature", "内置温度"),
    valveState: readRuntimePoint(row, ["阀门状态"], "valveState", "阀门状态"),
    setpointFeedback: readRuntimePoint(row, ["设置温度反馈"], "setpointFeedback", "设置温度反馈"),
    thermostatMode: readRuntimePoint(row, ["温控器模式"], "thermostatMode", "温控器模式"),
    fanSpeedMode: readRuntimePoint(row, ["风速模式"], "fanSpeedMode", "风速模式"),
    setpoint: readRuntimePoint(row, ["设置温度"], "setpoint", "设置温度")
  };
  const compactPoints = Object.fromEntries(Object.entries(points).filter(([, value]) => Boolean(value)));
  const running = valueAsBool(points.run);
  const communicationAlarm = valueAsBool(points.communicationAlarm);
  const valveOpen = valueAsBool(points.valveState);
  const zoneTemperatureC = points.zoneTemperature?.numericValue ?? null;
  const quality = buildFanCoilQuality({
    zoneTemperatureC,
    running,
    communicationAlarm
  });
  const rawTagTimes = Array.from(
    new Set(
      Object.values(compactPoints)
        .map((point) => point?.rawTagTime)
        .filter(Boolean)
    )
  );
  const writablePointCount = registers.filter((record) => normalizeOptionalText(record?.regReadWrite ?? record?.regreadwrite) === "2").length;

  return {
    deviceId: normalizeOptionalText(row?.drid || row?.deviceId || row?.id) || null,
    deviceCode: normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode) || null,
    deviceName: normalizeOptionalText(row?.drname || row?.deviceName || row?.name) || "风机盘管",
    deviceTypeId: normalizeOptionalText(row?.drtypeid || row?.drTypeId || row?.deviceTypeId || row?.typeId) || null,
    deviceTypeName: normalizeOptionalText(row?.drtypename || row?.deviceTypeName || row?.drtypenameCNEN) || "风机盘管",
    floorName: normalizeOptionalText(row?.floorName || row?.floorname) || "10楼",
    buildingName: normalizeOptionalText(row?.buildingName || row?.buildingname) || null,
    sampledAt,
    rawTagTime: rawTagTimes[0] || null,
    pointCount: registers.length,
    writablePointCount,
    readOnlyPointCount: Math.max(0, registers.length - writablePointCount),
    running,
    communicationAlarm,
    alarmActive: communicationAlarm === true,
    zoneTemperatureC,
    setpointC: points.setpoint?.numericValue ?? null,
    setpointFeedbackC: points.setpointFeedback?.numericValue ?? null,
    fanSpeedState: points.fanSpeedState?.numericValue ?? null,
    fanSpeedMode: points.fanSpeedMode?.numericValue ?? null,
    valveOpen,
    valveOpenPct: valveOpen == null ? null : valveOpen ? 100 : 0,
    points: compactPoints,
    quality
  };
}

function validComfortTemperature(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 5 && value <= 45;
}

function fanCoilDedupeKey(item) {
  return normalizeOptionalText(item?.deviceCode || item?.deviceId || item?.deviceName).toUpperCase();
}

function fanCoilQualityScore(item) {
  let score = 0;
  if (item?.communicationAlarm === false) {
    score += 100;
  }
  if (item?.quality?.comfortEligible === true) {
    score += 80;
  }
  if (validComfortTemperature(item?.zoneTemperatureC)) {
    score += 50;
  }
  score += Math.min(40, Number(item?.pointCount || 0));
  const rawTime = Date.parse(item?.rawTagTime || item?.sampledAt || "");
  if (Number.isFinite(rawTime)) {
    score += Math.min(30, Math.max(0, rawTime / 1000 / 60 / 60 / 24 / 365));
  }
  return score;
}

function dedupeFanCoilItems(items) {
  const byKey = new Map();
  let duplicateCollapsedCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const key = fanCoilDedupeKey(item);
    if (!key) {
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    duplicateCollapsedCount += 1;
    if (fanCoilQualityScore(item) > fanCoilQualityScore(existing)) {
      byKey.set(key, item);
    }
  }
  return {
    items: [...byKey.values()].sort((a, b) => {
      const left = normalizeOptionalText(a.deviceCode || a.deviceName);
      const right = normalizeOptionalText(b.deviceCode || b.deviceName);
      return left.localeCompare(right, "zh-Hans-CN", { numeric: true });
    }),
    duplicateCollapsedCount
  };
}

function buildFanCoilSummary(items) {
  const total = items.length;
  const validTemperatures = items
    .filter((item) => item.quality?.comfortEligible === true)
    .map((item) => item.zoneTemperatureC)
    .filter(validComfortTemperature);
  const validSetpoints = items
    .map((item) => (validComfortTemperature(item.setpointFeedbackC) ? item.setpointFeedbackC : item.setpointC))
    .filter(validComfortTemperature);
  const valveValues = items.map((item) => item.valveOpenPct).filter((value) => typeof value === "number");
  const runningCount = items.filter((item) => item.running === true).length;
  const stoppedCount = items.filter((item) => item.running === false).length;
  const alarmCount = items.filter((item) => item.alarmActive === true).length;
  const onlineCount = items.filter((item) => item.communicationAlarm !== true).length;
  const zeroTemperatureCount = items.filter((item) => item.quality?.flags?.includes("zero_temperature")).length;
  const outOfRangeTemperatureCount = items.filter((item) => item.quality?.flags?.includes("out_of_range_temperature")).length;
  const missingTemperatureCount = items.filter((item) => item.quality?.flags?.includes("missing_temperature")).length;
  const excludedFromComfortStatsCount = items.filter((item) => item.quality?.excludedFromComfortStats === true).length;

  return {
    total,
    onlineCount,
    runningCount,
    stoppedCount,
    alarmCount,
    communicationAlarmCount: alarmCount,
    validTemperatureCount: validTemperatures.length,
    invalidTemperatureCount: zeroTemperatureCount + outOfRangeTemperatureCount + missingTemperatureCount,
    zeroTemperatureCount,
    outOfRangeTemperatureCount,
    missingTemperatureCount,
    comfortEligibleCount: validTemperatures.length,
    excludedFromComfortStatsCount,
    averageZoneTemperatureC: roundTo(averageNumbers(validTemperatures), 1),
    averageSetpointC: roundTo(averageNumbers(validSetpoints), 1),
    averageValveOpenPct: roundTo(averageNumbers(valveValues), 0),
    writablePointCount: items.reduce((sum, item) => sum + item.writablePointCount, 0),
    readOnlyPointCount: items.reduce((sum, item) => sum + item.readOnlyPointCount, 0),
    qualityStatus:
      alarmCount > 0 || zeroTemperatureCount > 0 || outOfRangeTemperatureCount > 0 || missingTemperatureCount > 0
        ? "attention"
        : "ok",
    qualityIssues: {
      communicationAlarm: alarmCount,
      zeroTemperature: zeroTemperatureCount,
      outOfRangeTemperature: outOfRangeTemperatureCount,
      missingTemperature: missingTemperatureCount,
      excludedFromComfortStats: excludedFromComfortStatsCount,
      stopped: stoppedCount
    }
  };
}

function isChillerRuntimeRow(row) {
  const code = normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode).toUpperCase();
  const name = normalizeOptionalText(row?.drname || row?.deviceName || row?.name);
  const typeName = normalizeOptionalText(row?.drtypename || row?.deviceTypeName || row?.drtypenameCNEN);
  return /^CH\d+$/i.test(code) || typeName === "主机" || /冷水机组/.test(name);
}

function normalizeChillerRuntimeId(row) {
  const code = normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode).toUpperCase();
  if (/^CH\d+$/i.test(code)) {
    return code;
  }
  const name = normalizeOptionalText(row?.drname || row?.deviceName || row?.name);
  const sequence = name.match(/^(\d+)#/);
  if (sequence) {
    return `CH${sequence[1]}`;
  }
  const deviceId = normalizeOptionalText(row?.drid || row?.deviceId || row?.id);
  return deviceId ? `CH-${deviceId}` : "";
}

function normalizeChillerRuntimeRow(row) {
  if (!row || typeof row !== "object" || !isChillerRuntimeRow(row)) {
    return null;
  }
  const id = normalizeChillerRuntimeId(row);
  if (!id) {
    return null;
  }
  const runRecord = findRuntimeRegister(row, ["运行"]);
  const faultRecord = findRuntimeRegister(row, ["故障"]);
  const remoteRecord = findRuntimeRegister(row, ["远程"]);
  const disabledRecord = findRuntimeRegister(row, ["禁用", "设备禁用"]);
  const powerRecord = findRuntimeRegister(row, ["功率"]);
  const currentPercentRecord = findRuntimeRegister(row, ["压缩机额定电流百分比"]);
  const unitStatusRecord = findRuntimeRegister(row, ["机组状态"]);
  const runtimeRecord = findRuntimeRegister(row, ["累计运行时间"]);
  const runValue = readRuntimeValue(runRecord);
  const faultValue = readRuntimeValue(faultRecord);
  const remoteValue = readRuntimeValue(remoteRecord);
  const disabledValue = readRuntimeValue(disabledRecord);
  const powerKw = readRuntimeValue(powerRecord);
  const currentPercent = readRuntimeValue(currentPercentRecord);
  const unitStatus = readRuntimeValue(unitStatusRecord);
  const runtimeHours = readRuntimeValue(runtimeRecord);
  const status = normalizeOptionalText(row?.status).toLowerCase();
  const running =
    runValue !== null
      ? runValue > 0
      : status === "running" || (powerKw !== null && powerKw > 1);

  return {
    id,
    label: normalizeOptionalText(row?.drname || row?.deviceName || row?.name) || id,
    deviceId: normalizeOptionalText(row?.drid || row?.deviceId || row?.id) || null,
    deviceCode: normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode) || id,
    deviceTypeName: normalizeOptionalText(row?.drtypename || row?.deviceTypeName) || null,
    running,
    available: disabledValue === 1 ? false : true,
    faultActive: faultValue === null ? null : faultValue > 0,
    remoteEnabled: remoteValue === null ? null : remoteValue > 0,
    runSignal: runValue,
    faultSignal: faultValue,
    disabledSignal: disabledValue,
    unitStatus,
    powerKw,
    currentPercent,
    cumulativeRuntimeHours: runtimeHours,
    runningSignalTag: normalizeOptionalText(runRecord?.tagName) || null,
    powerSignalTag: normalizeOptionalText(powerRecord?.tagName) || null
  };
}

function matchesTextParts(text, includes, excludes = []) {
  const source = normalizeOptionalText(text).toLowerCase();
  const includeParts = asArray(includes).map((item) => normalizeOptionalText(item).toLowerCase()).filter(Boolean);
  const excludeParts = asArray(excludes).map((item) => normalizeOptionalText(item).toLowerCase()).filter(Boolean);
  if (!includeParts.length) {
    return false;
  }
  return includeParts.every((part) => source.includes(part)) && !excludeParts.some((part) => source.includes(part));
}

function normalizeRuntimeRowText(row) {
  const code = normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode).toUpperCase();
  const name = normalizeOptionalText(row?.drname || row?.deviceName || row?.name);
  const typeName = normalizeOptionalText(row?.drtypename || row?.deviceTypeName || row?.drtypenameCNEN);
  return {
    code,
    name,
    typeName,
    combined: [code, name, typeName].filter(Boolean).join(" ")
  };
}

function matchesPattern(value, pattern) {
  const source = normalizeOptionalText(value);
  const rawPattern = normalizeOptionalText(pattern);
  if (!source || !rawPattern) {
    return false;
  }
  try {
    return new RegExp(rawPattern, "i").test(source);
  } catch (_error) {
    return source.toLowerCase().includes(rawPattern.toLowerCase());
  }
}

function matchesAnyPattern(value, patterns) {
  return asArray(patterns).some((pattern) => matchesPattern(value, pattern));
}

function hasDeviceSelectorCriteria(selector) {
  return Boolean(
    selector &&
      typeof selector === "object" &&
      (
        asArray(selector.codes).length ||
        asArray(selector.exactCodes).length ||
        asArray(selector.codePatterns).length ||
        asArray(selector.namePatterns).length ||
        asArray(selector.typePatterns).length ||
        asArray(selector.includePatterns).length
      )
  );
}

function matchesDeviceSelector(row, selector) {
  if (!hasDeviceSelectorCriteria(selector)) {
    return false;
  }
  const rowText = normalizeRuntimeRowText(row);
  const exactCodes = new Set(
    asArray(selector.codes || selector.exactCodes).map((item) => normalizeOptionalText(item).toUpperCase()).filter(Boolean)
  );
  const excluded =
    matchesAnyPattern(rowText.combined, selector.excludePatterns) ||
    matchesAnyPattern(rowText.code, selector.excludeCodePatterns) ||
    matchesAnyPattern(rowText.name, selector.excludeNamePatterns) ||
    matchesAnyPattern(rowText.typeName, selector.excludeTypePatterns);
  if (excluded) {
    return false;
  }
  return (
    exactCodes.has(rowText.code) ||
    matchesAnyPattern(rowText.code, selector.codePatterns) ||
    matchesAnyPattern(rowText.name, selector.namePatterns) ||
    matchesAnyPattern(rowText.typeName, selector.typePatterns) ||
    matchesAnyPattern(rowText.combined, selector.includePatterns)
  );
}

function resolveOperationalDiagnosticsPointDictionary(configOrOptions) {
  const direct =
    configOrOptions?.operationalDiagnosticsPointDictionary &&
    typeof configOrOptions.operationalDiagnosticsPointDictionary === "object" &&
    !Array.isArray(configOrOptions.operationalDiagnosticsPointDictionary)
      ? configOrOptions.operationalDiagnosticsPointDictionary
      : null;
  if (direct) {
    return direct;
  }
  const source =
    configOrOptions?.siteSourceConfig?.operationalDiagnosticsPointDictionary &&
    typeof configOrOptions.siteSourceConfig.operationalDiagnosticsPointDictionary === "object" &&
    !Array.isArray(configOrOptions.siteSourceConfig.operationalDiagnosticsPointDictionary)
      ? configOrOptions.siteSourceConfig.operationalDiagnosticsPointDictionary
      : null;
  return source || null;
}

function findRuntimeRegisterByMatchers(row, matchers) {
  const registers = getRuntimeRegisters(row);
  const normalizedMatchers = asArray(matchers).filter((item) => item);
  for (const matcher of normalizedMatchers) {
    const include = Array.isArray(matcher) ? matcher : matcher?.include ?? matcher?.includes ?? matcher;
    const exclude = matcher?.exclude ?? matcher?.excludes ?? [];
    const record = registers.find((item) => matchesTextParts(item?.regName, include, exclude));
    if (record) {
      return record;
    }
  }
  return null;
}

function readRuntimeValueByMatchers(row, matchers) {
  return readRuntimeValue(findRuntimeRegisterByMatchers(row, matchers));
}

function isChilledPumpRuntimeRow(row, pointDictionary = null) {
  const selector = pointDictionary?.deviceSelectors?.chilledPumps;
  if (hasDeviceSelectorCriteria(selector)) {
    return matchesDeviceSelector(row, selector);
  }
  const { code, name, typeName } = normalizeRuntimeRowText(row);
  return /^CHP\d+/i.test(code) || /冷冻.*泵|冷冻泵|冷冻水泵/.test(name) || /冷冻.*泵/.test(typeName);
}

function isCoolingPumpRuntimeRow(row, pointDictionary = null) {
  const selector = pointDictionary?.deviceSelectors?.coolingPumps;
  if (hasDeviceSelectorCriteria(selector)) {
    return matchesDeviceSelector(row, selector);
  }
  const { code, name, typeName } = normalizeRuntimeRowText(row);
  return /^CWP\d+/i.test(code) || /冷却.*泵|冷却泵|冷却水泵/.test(name) || /冷却.*泵/.test(typeName);
}

function isCoolingTowerRuntimeRow(row, pointDictionary = null) {
  const selector = pointDictionary?.deviceSelectors?.coolingTowers;
  if (hasDeviceSelectorCriteria(selector)) {
    return matchesDeviceSelector(row, selector);
  }
  const { code, name, typeName } = normalizeRuntimeRowText(row);
  return /^CT\d+/i.test(code) || /冷却塔|塔风机/.test(name) || /冷却塔|塔风机/.test(typeName);
}

function normalizeRuntimeDeviceId(row, fallbackPrefix = "D") {
  const code = normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode).toUpperCase();
  if (code) {
    return code;
  }
  const name = normalizeOptionalText(row?.drname || row?.deviceName || row?.name);
  const sequence = name.match(/^(\d+)#/);
  if (sequence) {
    return `${fallbackPrefix}${sequence[1]}`;
  }
  const deviceId = normalizeOptionalText(row?.drid || row?.deviceId || row?.id);
  return deviceId ? `${fallbackPrefix}-${deviceId}` : "";
}

function normalizePumpRuntimeRow(row, pumpType) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const id = normalizeRuntimeDeviceId(row, pumpType === "chilled" ? "CHP" : "CWP");
  if (!id) {
    return null;
  }
  const runValue = readRuntimeValueByMatchers(row, ["运行"]);
  const faultValue = readRuntimeValueByMatchers(row, ["故障"]);
  const remoteValue = readRuntimeValueByMatchers(row, ["远程"]);
  const powerKw = readRuntimeValueByMatchers(row, ["功率"]);
  const frequencyHz = readRuntimeValueByMatchers(row, [
    ["频率", "反馈"],
    ["运行", "频率"],
    "频率"
  ]);
  const flowM3h = readRuntimeValueByMatchers(row, ["流量"]);
  const running =
    runValue !== null
      ? runValue > 0
      : (powerKw !== null && powerKw > 1) || (frequencyHz !== null && frequencyHz > 1);

  return {
    id,
    label: normalizeOptionalText(row?.drname || row?.deviceName || row?.name) || id,
    type: pumpType,
    running,
    faultActive: faultValue === null ? null : faultValue > 0,
    remoteEnabled: remoteValue === null ? null : remoteValue > 0,
    powerKw,
    frequencyHz,
    flowM3h
  };
}

function normalizeCoolingTowerRuntimeRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const id = normalizeRuntimeDeviceId(row, "CT");
  if (!id) {
    return null;
  }
  const runValue = readRuntimeValueByMatchers(row, ["运行"]);
  const faultValue = readRuntimeValueByMatchers(row, ["故障"]);
  const powerKw = readRuntimeValueByMatchers(row, ["功率"]);
  const frequencyHz = readRuntimeValueByMatchers(row, [
    ["频率", "反馈"],
    ["运行", "频率"],
    "频率"
  ]);
  const flowM3h = readRuntimeValueByMatchers(row, ["流量"]);
  const running =
    runValue !== null
      ? runValue > 0
      : (powerKw !== null && powerKw > 0.5) || (frequencyHz !== null && frequencyHz > 1);

  return {
    id,
    label: normalizeOptionalText(row?.drname || row?.deviceName || row?.name) || id,
    running,
    faultActive: faultValue === null ? null : faultValue > 0,
    powerKw,
    frequencyHz,
    flowM3h
  };
}

const DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY = Object.freeze({
  clientRefreshIntervalMs: 10000,
  sourceExpectedIntervalMs: null,
  liveMaxAgeMs: 20000,
  maxFutureSkewMs: 2000
});

const CODE_OWNED_RUNTIME_POINT_EVIDENCE_DECODERS = Object.freeze({
  "opcua-datavalue-v1": Object.freeze({
    id: "opcua-datavalue-v1",
    decode(record, row) {
      const observedAt = normalizeAbsoluteTimestamp(
        record?.opcuaServerTimestamp ?? record?.opcua_server_timestamp ?? record?.serverTimestamp ?? record?.server_timestamp
      );
      const explicitQuality = normalizeOptionalText(
        record?.qualityCode ?? record?.quality_code ?? record?.statusCode
      ).toUpperCase();
      const qualityCode = ["0", "GOOD"].includes(explicitQuality)
        ? "GOOD"
        : explicitQuality === "UNCERTAIN"
          ? "UNCERTAIN"
          : ["BAD", "ERROR", "INVALID", "FAILED"].includes(explicitQuality)
            ? "BAD"
            : "UNKNOWN";
      return {
        observedAt,
        timestampBasis: observedAt ? "opcua_server_timestamp" : "missing_source_timestamp",
        qualityCode,
        sourceSequence: normalizeRuntimeSourceSequence(record?.sourceSequence ?? record?.source_sequence),
        scanCycleId: normalizeOptionalText(
          record?.scanCycleId ?? record?.scan_cycle_id ?? row?.scanCycleId ?? row?.scan_cycle_id
        ) || null,
        bootId: normalizeOptionalText(record?.bootId ?? record?.boot_id ?? row?.bootId ?? row?.boot_id) || null
      };
    }
  })
});

// Deliberately empty until a site-specific adapter contract has passed field
// commissioning. Adding a decoder above does not authorize any live site.
const CODE_OWNED_RUNTIME_POINT_EVIDENCE_BINDINGS = Object.freeze({});

export function resolveCodeOwnedRuntimePointEvidenceDecoder(profileId) {
  const normalizedProfileId = normalizeOptionalText(profileId);
  return CODE_OWNED_RUNTIME_POINT_EVIDENCE_DECODERS[normalizedProfileId] || null;
}

function resolveConfiguredRuntimePointEvidenceDecoder({
  config,
  siteId,
  realtimeInterface,
  databaseKey,
  projectKey
}) {
  const profileId = normalizeOptionalText(realtimeInterface?.pointEvidenceProfileId);
  const binding = CODE_OWNED_RUNTIME_POINT_EVIDENCE_BINDINGS[profileId];
  if (!binding) {
    return null;
  }
  const exactBaseUrl = normalizeOptionalText(config?.legacyBaseUrl).replace(/\/+$/, "");
  const matches = normalizeOptionalText(siteId) === binding.siteId
    && normalizeOptionalText(realtimeInterface?.endpointKind) === binding.endpointKind
    && normalizeOptionalText(realtimeInterface?.projectKey) === binding.interfaceProjectKey
    && realtimeInterface?.mock === false
    && exactBaseUrl === binding.legacyBaseUrl
    && normalizeOptionalText(databaseKey) === binding.databaseKey
    && normalizeOptionalText(projectKey) === binding.projectKey;
  return matches ? resolveCodeOwnedRuntimePointEvidenceDecoder(profileId) : null;
}

function normalizeAbsoluteTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value >= 1e12 ? value : value >= 1e9 ? value * 1000 : null;
    if (milliseconds === null) {
      return null;
    }
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }
  if (/^\d{10}(?:\.\d+)?$/.test(normalized) || /^\d{13}$/.test(normalized)) {
    return normalizeAbsoluteTimestamp(Number(normalized));
  }

  // A timezone is mandatory. Naive local timestamps cannot be authoritative
  // because the BFF cannot safely infer the source clock's timezone.
  const zonedDateTime = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
  if (!zonedDateTime.test(normalized)) {
    return null;
  }
  const parsed = new Date(normalized.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decodeTrustedRuntimePointEvidence(record, row, decoder, evidenceValue) {
  if (!decoder || typeof decoder.decode !== "function") {
    return {
      observedAt: null,
      timestampBasis: "missing_source_timestamp",
      qualityCode: evidenceValue === null ? "BAD" : "UNKNOWN",
      sourceSequence: null,
      scanCycleId: null,
      bootId: null
    };
  }
  const decoded = decoder.decode(record, row) || {};
  const observedAt = normalizeAbsoluteTimestamp(decoded.observedAt);
  const normalizedQualityCode = normalizeOptionalText(decoded.qualityCode).toUpperCase();
  return {
    observedAt,
    timestampBasis: observedAt ? normalizeOptionalText(decoded.timestampBasis) || "missing_source_timestamp" : "missing_source_timestamp",
    qualityCode: evidenceValue === null
      ? "BAD"
      : ["GOOD", "BAD", "UNCERTAIN"].includes(normalizedQualityCode)
        ? normalizedQualityCode
        : "UNKNOWN",
    sourceSequence: normalizeRuntimeSourceSequence(decoded.sourceSequence),
    scanCycleId: normalizeOptionalText(decoded.scanCycleId) || null,
    bootId: normalizeOptionalText(decoded.bootId) || null
  };
}

function resolveRuntimeChangedAt(record) {
  const candidates = [
    ["source_changed_at", record?.changedAt ?? record?.changed_at],
    ["source_timestamp", record?.sourceTimestamp ?? record?.source_timestamp ?? record?.plcSourceTimestamp ?? record?.plc_source_timestamp],
    ["legacy_tag_time", record?.tagTime ?? record?.tagtime]
  ];
  for (const [changedTimestampBasis, candidate] of candidates) {
    const changedAt = normalizeAbsoluteTimestamp(candidate);
    if (changedAt) {
      return { changedAt, changedTimestampBasis };
    }
  }
  return { changedAt: null, changedTimestampBasis: "missing_changed_timestamp" };
}

function inferRuntimeSemanticKey(regName) {
  const normalized = normalizeOptionalText(regName);
  if (!normalized) {
    return null;
  }
  if (/\u901a\u8baf.*\u62a5\u8b66|\u901a\u4fe1.*\u62a5\u8b66/.test(normalized)) {
    return "communicationAlarm";
  }
  if (/\u6545\u969c|\u62a5\u8b66/.test(normalized)) {
    return "faultActive";
  }
  if (normalized === "远程") {
    return "remoteEnabled";
  }
  if (/\u9891\u7387/.test(normalized) && /\u8bbe\u5b9a|\u7ed9\u5b9a|\u6307\u4ee4|\u76ee\u6807/.test(normalized)) {
    return "frequencySetpointHz";
  }
  if (/\u9891\u7387/.test(normalized)) {
    return "frequencyHz";
  }
  if (/\u8fd0\u884c|\u542f\u505c|\u5f00\u673a\u72b6\u6001/.test(normalized) && !/\u7d2f\u8ba1|\u65f6\u95f4|\u65f6\u957f|\u6b21\u6570/.test(normalized)) {
    return "running";
  }
  if (/\u6d41\u91cf/.test(normalized) && !/\u7d2f\u8ba1|\u7d2f\u79ef/.test(normalized)) {
    return "flowM3h";
  }
  if (/\u529f\u7387/.test(normalized)) {
    return "powerKw";
  }
  if (/\u538b\u529b|\u538b\u5dee/.test(normalized)) {
    return "pressureKpa";
  }
  if (/\u6e29\u5ea6|\u6e7f\u7403/.test(normalized)) {
    return "temperatureC";
  }
  if (/\u9600.*\u5f00|\u5f00\u5230\u4f4d|\u9600\u4f4d/.test(normalized)) {
    return "valveOpen";
  }
  return null;
}

function buildRuntimePointKey({ deviceId, deviceCode, deviceName, regId, tagName, regName }) {
  if (tagName) {
    return tagName;
  }
  if (deviceId && regId) {
    return `${deviceId}:${regId}`;
  }
  const deviceKey = deviceId || deviceCode || deviceName || "unknown-device";
  const registerKey = regId || regName || "unknown-register";
  return `${deviceKey}:${registerKey}`;
}

function readRuntimeEvidenceValue(record) {
  const rawValue = record?.newtagvalue ?? record?.tagValue ?? record?.qstagvalue ?? record?.tagvalue ?? record?.showStatus;
  const numericValue = asFiniteNumber(rawValue);
  if (numericValue !== null) {
    return numericValue;
  }
  return normalizeOptionalText(rawValue) || null;
}

function normalizeRuntimeSourceSequence(value) {
  const parsed = asFiniteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function buildRuntimePoints(rows, options = {}) {
  const points = [];
  const evidenceDecoder = options?.runtimePointEvidenceDecoder || null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const deviceName = normalizeOptionalText(row?.drname || row?.deviceName || row?.name);
    const deviceCode = normalizeOptionalText(row?.drcode || row?.deviceCode || row?.drCode);
    const deviceTypeName = normalizeOptionalText(row?.drtypename || row?.deviceTypeName || row?.drtypenameCNEN);
    const deviceId = normalizeOptionalText(row?.drid || row?.deviceId || row?.id);
    for (const record of getRuntimeRegisters(row)) {
      const regName = normalizeOptionalText(record?.regName);
      if (!regName) {
        continue;
      }
      const value = readRuntimeValue(record);
      const evidenceValue = readRuntimeEvidenceValue(record);
      const regId = normalizeOptionalText(record?.regId ?? record?.regid ?? record?.id) || null;
      const tagName = normalizeOptionalText(record?.tagName ?? record?.tagname) || null;
      const trustedEvidence = decodeTrustedRuntimePointEvidence(record, row, evidenceDecoder, evidenceValue);
      const { observedAt, timestampBasis } = trustedEvidence;
      const { changedAt, changedTimestampBasis } = resolveRuntimeChangedAt(record);
      const receivedAt = normalizeAbsoluteTimestamp(record?.receivedAt ?? row?.receivedAt ?? options.receivedAt);
      const rawTagTime = normalizeOptionalText(record?.tagTime ?? record?.tagtime) || null;
      const sourceKey = normalizeOptionalText(options.runtimePointSourceKey) || "chillerStagingRuntime";
      const { sourceSequence, scanCycleId, bootId } = trustedEvidence;
      points.push({
        deviceId: deviceId || null,
        deviceCode: deviceCode || null,
        deviceName: deviceName || null,
        deviceTypeName: deviceTypeName || null,
        regId,
        regName,
        tagName,
        unit: normalizeOptionalText(record?.regUnits ?? record?.regunits) || null,
        value,
        evidenceValue,
        pointKey: buildRuntimePointKey({ deviceId, deviceCode, deviceName, regId, tagName, regName }),
        sourceKey,
        semanticKey: inferRuntimeSemanticKey(regName),
        observedAt,
        changedAt,
        receivedAt,
        timestampBasis,
        changedTimestampBasis,
        authoritativeTimestamp: observedAt !== null,
        qualityCode: trustedEvidence.qualityCode,
        sourceSequence,
        scanCycleId,
        bootId,
        rawTagTime,
        fullName: [deviceName, regName].filter(Boolean).join(" ")
      });
    }
  }
  return points;
}

function resolveRuntimePointFreshnessPolicy(options = {}) {
  const configured = options?.runtimePointFreshnessPolicy;
  const readPositiveInteger = (value, fallback, maximum = null) => {
    const parsed = asFiniteNumber(value);
    if (parsed === null || parsed <= 0) {
      return fallback;
    }
    const rounded = Math.round(parsed);
    return maximum === null ? rounded : Math.min(rounded, maximum);
  };
  const readNonNegativeInteger = (value, fallback, maximum = null) => {
    const parsed = asFiniteNumber(value);
    if (parsed === null || parsed < 0) {
      return fallback;
    }
    const rounded = Math.round(parsed);
    return maximum === null ? rounded : Math.min(rounded, maximum);
  };
  return {
    clientRefreshIntervalMs: readPositiveInteger(
      configured?.clientRefreshIntervalMs,
      DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.clientRefreshIntervalMs
    ),
    sourceExpectedIntervalMs:
      configured?.sourceExpectedIntervalMs == null
        ? DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.sourceExpectedIntervalMs
        : readPositiveInteger(configured.sourceExpectedIntervalMs, DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.sourceExpectedIntervalMs),
    liveMaxAgeMs: readPositiveInteger(
      configured?.liveMaxAgeMs,
      DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.liveMaxAgeMs,
      DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.liveMaxAgeMs
    ),
    maxFutureSkewMs: readNonNegativeInteger(
      configured?.maxFutureSkewMs,
      DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.maxFutureSkewMs,
      DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY.maxFutureSkewMs
    )
  };
}

function buildRuntimePointEvidence(points, options = {}) {
  const evidencePoints = points.map((point) => ({
    pointKey: point.pointKey,
    sourceKey: point.sourceKey,
    semanticKey: point.semanticKey,
    deviceId: point.deviceId,
    deviceCode: point.deviceCode,
    regId: point.regId,
    regName: point.regName,
    tagName: point.tagName,
    unit: point.unit,
    value: point.evidenceValue,
    observedAt: point.observedAt,
    changedAt: point.changedAt,
    receivedAt: point.receivedAt,
    timestampBasis: point.timestampBasis,
    changedTimestampBasis: point.changedTimestampBasis,
    authoritativeTimestamp: point.authoritativeTimestamp,
    qualityCode: point.qualityCode,
    sourceSequence: point.sourceSequence,
    scanCycleId: point.scanCycleId,
    bootId: point.bootId,
    rawTagTime: point.rawTagTime
  }));
  const authoritativeTimestampPoints = evidencePoints.filter((point) => point.observedAt !== null).length;
  const goodQualityPoints = evidencePoints.filter((point) => point.qualityCode === "GOOD").length;
  const replayProofPoints = evidencePoints.filter((point) => (
    Number.isSafeInteger(point.sourceSequence)
    && point.sourceSequence >= 0
    && Boolean(point.scanCycleId)
    && Boolean(point.bootId)
  )).length;
  const receivedAt = normalizeAbsoluteTimestamp(options.receivedAt)
    || evidencePoints.map((point) => point.receivedAt).filter(Boolean).sort().at(-1)
    || null;

  return {
    contractVersion: "runtime-point-evidence-v1",
    sourceKey: normalizeOptionalText(options.runtimePointSourceKey) || "chillerStagingRuntime",
    evidenceProfileId: normalizeOptionalText(options?.runtimePointEvidenceDecoder?.id) || null,
    receivedAt,
    points: evidencePoints,
    summary: {
      totalPoints: evidencePoints.length,
      authoritativeTimestampPoints,
      missingTimestampPoints: evidencePoints.length - authoritativeTimestampPoints,
      goodQualityPoints,
      replayProofPoints,
      missingReplayProofPoints: evidencePoints.length - replayProofPoints
    }
  };
}

function findRuntimePointValue(points, matchers) {
  const normalizedMatchers = asArray(matchers).filter(Boolean);
  for (const matcher of normalizedMatchers) {
    const include = Array.isArray(matcher) ? matcher : matcher?.include ?? matcher?.includes ?? matcher;
    const exclude = matcher?.exclude ?? matcher?.excludes ?? [];
    const point = points.find((item) => item.value !== null && matchesTextParts(item.fullName, include, exclude));
    if (point) {
      return point.value;
    }
  }
  return null;
}

function averageFiniteValues(values, digits = 1) {
  const finiteValues = asArray(values).filter((item) => typeof item === "number" && Number.isFinite(item));
  if (!finiteValues.length) {
    return null;
  }
  const value = finiteValues.reduce((sum, item) => sum + item, 0) / finiteValues.length;
  return Number(value.toFixed(digits));
}

function sumFiniteValues(values, digits = 1) {
  const finiteValues = asArray(values).filter((item) => typeof item === "number" && Number.isFinite(item));
  if (!finiteValues.length) {
    return null;
  }
  return Number(finiteValues.reduce((sum, item) => sum + item, 0).toFixed(digits));
}

function isPlausibleInstantFlowM3h(value) {
  const numeric = asFiniteNumber(value);
  return numeric !== null && numeric >= 0 && numeric < 20000;
}

function buildPointKeywordCounts(points) {
  const keywords = ["流量", "压差", "压力", "阀", "开到位", "关到位", "频率", "功率", "电量", "运行", "远程", "手自动", "故障", "温度", "湿球", "冷冻总管", "冷却总管", "供水", "回水"];
  const counts = {};
  for (const keyword of keywords) {
    counts[keyword] = points.filter((point) => normalizeOptionalText(point.fullName).includes(keyword)).length;
  }
  return counts;
}

function isPointExcludedByRules(point, rules) {
  if (!rules || typeof rules !== "object") {
    return false;
  }
  const fullName = normalizeOptionalText(point?.fullName);
  const code = normalizeOptionalText(point?.deviceCode).toUpperCase();
  const name = normalizeOptionalText(point?.deviceName);
  const typeName = normalizeOptionalText(point?.deviceTypeName);
  return (
    matchesAnyPattern(fullName, rules.excludePatterns) ||
    matchesAnyPattern(code, rules.excludeCodePatterns) ||
    matchesAnyPattern(name, rules.excludeNamePatterns) ||
    matchesAnyPattern(typeName, rules.excludeTypePatterns)
  );
}

function isPointAllowedByRules(point, rules) {
  if (!rules || typeof rules !== "object") {
    return true;
  }
  const allowedPatterns = asArray(rules.allowedNamePatterns || rules.includePatterns);
  if (!allowedPatterns.length) {
    return true;
  }
  return matchesAnyPattern(point?.fullName, allowedPatterns);
}

function resolveBranchLabel(point, pointDictionary = null) {
  const rules = pointDictionary?.branchLabels;
  if (isPointExcludedByRules(point, rules) || !isPointAllowedByRules(point, rules)) {
    return "";
  }
  const fullName = normalizeOptionalText(point?.fullName);
  const branchMatch = fullName.match(/支路\s*(\d+)/);
  if (branchMatch) {
    return `支路${branchMatch[1]}`;
  }
  const buildingMatch = fullName.match(/\b(B\d{1,2})\b/i);
  return buildingMatch ? buildingMatch[1].toUpperCase() : "";
}

function collectBranchHydraulicPoints(points, pointDictionary = null) {
  const branches = new Map();
  const ensure = (label) => {
    if (!branches.has(label)) {
      branches.set(label, { label });
    }
    return branches.get(label);
  };
  for (const point of points) {
    if (point.value === null) {
      continue;
    }
    const label = resolveBranchLabel(point, pointDictionary);
    if (!label) {
      continue;
    }
    const fullName = normalizeOptionalText(point.fullName);
    const updates = {};
    if (fullName.includes("流量") && !fullName.includes("累计") && isPlausibleInstantFlowM3h(point.value)) {
      updates.flowM3h = point.value;
    }
    if (fullName.includes("供水") && fullName.includes("温度")) {
      updates.supplyTempC = point.value;
    }
    if (fullName.includes("回水") && fullName.includes("温度")) {
      updates.returnTempC = point.value;
    }
    if (fullName.includes("供水") && fullName.includes("压力")) {
      updates.supplyPressureKpa = point.value;
    }
    if (fullName.includes("回水") && fullName.includes("压力")) {
      updates.returnPressureKpa = point.value;
    }
    if (Object.keys(updates).length > 0) {
      Object.assign(ensure(label), updates);
    }
  }
  return [...branches.values()]
    .map((item) => ({
      ...item,
      deltaTC:
        typeof item.returnTempC === "number" && typeof item.supplyTempC === "number"
          ? Number((item.returnTempC - item.supplyTempC).toFixed(1))
          : null
    }))
    .slice(0, 12);
}

function resolveCoolingTowerCellLabel(point, pointDictionary = null) {
  const rules = pointDictionary?.coolingTowerCellLabels;
  if (isPointExcludedByRules(point, rules) || !isPointAllowedByRules(point, rules)) {
    return "";
  }
  const code = normalizeOptionalText(point?.deviceCode).toUpperCase();
  if (/^CT\d+/.test(code)) {
    return code;
  }
  const fullName = normalizeOptionalText(point?.fullName);
  const match = fullName.match(/(\d+)\s*#?\s*冷却塔/);
  return match ? `CT${match[1]}` : "";
}

function collectCoolingTowerCellPoints(points, pointDictionary = null) {
  const cells = new Map();
  const ensure = (label) => {
    if (!cells.has(label)) {
      cells.set(label, { label });
    }
    return cells.get(label);
  };
  for (const point of points) {
    if (point.value === null) {
      continue;
    }
    const label = resolveCoolingTowerCellLabel(point, pointDictionary);
    if (!label) {
      continue;
    }
    const fullName = normalizeOptionalText(point.fullName);
    const updates = {};
    if (fullName.includes("流量") && !fullName.includes("累计") && isPlausibleInstantFlowM3h(point.value)) {
      updates.flowM3h = point.value;
    }
    if (fullName.includes("压力")) {
      updates.pressureKpa = point.value;
    }
    if (fullName.includes("功率")) {
      updates.powerKw = point.value;
    }
    if (fullName.includes("频率")) {
      updates.frequencyHz = point.value;
    }
    if (fullName.includes("运行")) {
      updates.running = point.value > 0;
    }
    if (Object.keys(updates).length > 0) {
      Object.assign(ensure(label), updates);
    }
  }
  return [...cells.values()].slice(0, 12);
}

function buildChilledWaterSignals(points) {
  const supplyTempC = findRuntimePointValue(points, [
    ["冷冻总管", "供水", "温度"],
    ["冷冻", "总管", "出水", "温度"]
  ]);
  const returnTempC = findRuntimePointValue(points, [
    ["冷冻总管", "回水", "温度"],
    ["冷冻", "总管", "进水", "温度"]
  ]);
  const supplyPressureKpa = findRuntimePointValue(points, [["冷冻总管", "供水", "压力"]]);
  const returnPressureKpa = findRuntimePointValue(points, [["冷冻总管", "回水", "压力"]]);
  const bypassValveOpenPct = findRuntimePointValue(points, [
    ["旁通阀", "开度", "反馈"],
    ["压力调节阀", "开度", "反馈"],
    ["旁通", "开度"]
  ]);
  return {
    supplyTempC,
    returnTempC,
    deltaTC:
      supplyTempC !== null && returnTempC !== null ? Number((returnTempC - supplyTempC).toFixed(1)) : null,
    supplyPressureKpa,
    returnPressureKpa,
    differentialPressureKpa:
      supplyPressureKpa !== null && returnPressureKpa !== null
        ? Number((supplyPressureKpa - returnPressureKpa).toFixed(1))
        : null,
    bypassValveOpenPct
  };
}

function buildCoolingWaterSignals(points) {
  const supplyTempC = findRuntimePointValue(points, [
    ["冷却总管", "供水", "温度"],
    ["冷却", "总管", "出水", "温度"]
  ]);
  const returnTempC = findRuntimePointValue(points, [
    ["冷却总管", "回水", "温度"],
    ["冷却", "总管", "进水", "温度"]
  ]);
  const supplyPressureKpa = findRuntimePointValue(points, [["冷却总管", "供水", "压力"]]);
  const returnPressureKpa = findRuntimePointValue(points, [["冷却总管", "回水", "压力"]]);
  return {
    supplyTempC,
    returnTempC,
    deltaTC:
      supplyTempC !== null && returnTempC !== null ? Number(Math.abs(returnTempC - supplyTempC).toFixed(1)) : null,
    supplyPressureKpa,
    returnPressureKpa,
    differentialPressureKpa:
      supplyPressureKpa !== null && returnPressureKpa !== null
        ? Number(Math.abs(supplyPressureKpa - returnPressureKpa).toFixed(1))
        : null
  };
}

function buildWeatherSignals(points) {
  return {
    wetBulbC: findRuntimePointValue(points, [["湿球", "温度"], "湿球"]),
    outdoorTempC: findRuntimePointValue(points, [["室外", "温度"], ["环境", "温度"]]),
    humidityPct: findRuntimePointValue(points, [["湿度"]])
  };
}

export function buildRuntimePointSummary(rows, chillers, options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const pointDictionary = resolveOperationalDiagnosticsPointDictionary(options);
  const dictionarySource = normalizeOptionalText(pointDictionary?.source);
  const points = buildRuntimePoints(sourceRows, options);
  const pointEvidence = buildRuntimePointEvidence(points, options);
  const freshnessPolicy = resolveRuntimePointFreshnessPolicy(options);
  const chilledPumps = sourceRows
    .filter((row) => isChilledPumpRuntimeRow(row, pointDictionary))
    .map((row) => normalizePumpRuntimeRow(row, "chilled"))
    .filter(Boolean);
  const coolingPumps = sourceRows
    .filter((row) => isCoolingPumpRuntimeRow(row, pointDictionary))
    .map((row) => normalizePumpRuntimeRow(row, "cooling"))
    .filter(Boolean);
  const coolingTowers = sourceRows
    .filter((row) => isCoolingTowerRuntimeRow(row, pointDictionary))
    .map(normalizeCoolingTowerRuntimeRow)
    .filter(Boolean);
  const runningChillers = asArray(chillers).filter((item) => item?.running);
  const runningChilledPumps = chilledPumps.filter((item) => item.running);
  const runningCoolingPumps = coolingPumps.filter((item) => item.running);
  const runningCoolingTowers = coolingTowers.filter((item) => item.running);
  const chilledWater = buildChilledWaterSignals(points);
  const coolingWater = buildCoolingWaterSignals(points);
  const branches = collectBranchHydraulicPoints(points, pointDictionary);
  const coolingTowerCells = collectCoolingTowerCellPoints(points, pointDictionary);
  const runningCoolingTowerCells = coolingTowerCells.filter((item) => item.running);

  return {
    status: points.length ? "ready" : "unavailable",
    basis: pointDictionary ? "legacy_realtime_register_summary_with_site_dictionary" : "legacy_realtime_register_summary",
    pointDictionary: {
      applied: Boolean(pointDictionary),
      source: dictionarySource || null
    },
    pointEvidence,
    freshnessPolicy,
    counts: {
      deviceRows: sourceRows.length,
      registerPoints: points.length,
      chillerCount: asArray(chillers).length,
      runningChillerCount: runningChillers.length,
      chilledPumpCount: chilledPumps.length,
      runningChilledPumpCount: runningChilledPumps.length,
      coolingPumpCount: coolingPumps.length,
      runningCoolingPumpCount: runningCoolingPumps.length,
      coolingTowerCount: coolingTowerCells.length || coolingTowers.length,
      runningCoolingTowerCount: coolingTowerCells.length ? runningCoolingTowerCells.length : runningCoolingTowers.length,
      coolingTowerFanCount: coolingTowers.length,
      runningCoolingTowerFanCount: runningCoolingTowers.length,
      branchCount: branches.length,
      coolingTowerCellCount: coolingTowerCells.length,
      keywordCounts: buildPointKeywordCounts(points)
    },
    keySignals: {
      chilledWater,
      coolingWater,
      weather: buildWeatherSignals(points),
      power: {
        runningChillerPowerKw: sumFiniteValues(runningChillers.map((item) => item.powerKw)),
        runningChilledPumpPowerKw: sumFiniteValues(runningChilledPumps.map((item) => item.powerKw)),
        runningCoolingPumpPowerKw: sumFiniteValues(runningCoolingPumps.map((item) => item.powerKw)),
        runningCoolingTowerPowerKw: sumFiniteValues(runningCoolingTowers.map((item) => item.powerKw))
      },
      pumpFrequency: {
        chilledAvgHz: averageFiniteValues(runningChilledPumps.map((item) => item.frequencyHz)),
        coolingAvgHz: averageFiniteValues(runningCoolingPumps.map((item) => item.frequencyHz))
      },
      towerFrequency: {
        avgHz: averageFiniteValues(runningCoolingTowers.map((item) => item.frequencyHz))
      }
    },
    groups: {
      chillers: asArray(chillers).map((item) => ({
        id: item.id,
        label: item.label,
        running: item.running,
        available: item.available,
        faultActive: item.faultActive,
        remoteEnabled: item.remoteEnabled,
        powerKw: item.powerKw,
        currentPercent: item.currentPercent,
        unitStatus: item.unitStatus
      })),
      chilledPumps,
      coolingPumps,
      coolingTowers,
      branches,
      coolingTowerCells
    },
    disclaimers: [
      "点位摘要仅用于只读诊断与 shadow 评审，不作为 PLC 直接控制依据。",
      "observedAt 仅从上游明确的观测、边缘采集、OPC UA 服务器或历史事件时间字段生成；tagTime、sourceTimestamp 与 BFF 抓取时间不会默认冒充单点观测时间。",
      "多机运行且无单台冷冻水流量时，不从点位摘要拆分单台主机 COP。"
    ]
  };
}

export async function getChillerStagingRuntimeContext(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const readOnlyRuntimeEnrichment = resolveReadOnlyRuntimeEnrichment(config);
  const runtimePointEvidenceDecoder = resolveConfiguredRuntimePointEvidenceDecoder({
    config,
    siteId,
    realtimeInterface,
    databaseKey,
    projectKey
  });
  const runtimeQueryOptions = {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    ...(realtimeInterface?.endpointKind ? { realtimeEndpointKind: realtimeInterface.endpointKind } : {}),
    placeholderFallback: false
  };
  const [tree, registerCollection] = await Promise.all([
    loadDeviceTree(config.legacyBaseUrl, siteId, runtimeQueryOptions),
    readOnlyRuntimeEnrichment
      ? loadDeviceRegisterCollection(config.legacyBaseUrl, siteId, {
          ...runtimeQueryOptions,
          pageSize: readOnlyRuntimeEnrichment.pageSize
        })
      : Promise.resolve(null)
  ]);
  const baseRuntimeRows = Array.isArray(tree.realtimeCollectionRows) ? tree.realtimeCollectionRows : [];
  const enrichmentMerge = readOnlyRuntimeEnrichment && registerCollection?.sourceStatus?.ok
    ? mergeExactReadOnlyRuntimeRegisters(
        baseRuntimeRows,
        registerCollection.rows,
        readOnlyRuntimeEnrichment
      )
    : null;
  const runtimeRows = enrichmentMerge?.ok ? enrichmentMerge.rows : baseRuntimeRows;
  const baseRuntimeSource = tree.sourceStatus?.tree || {};
  const enrichmentError = readOnlyRuntimeEnrichment
    ? registerCollection?.sourceStatus?.ok !== true
      ? registerCollection?.sourceStatus?.error || "Read-only runtime register enrichment unavailable"
      : enrichmentMerge?.ok !== true
        ? enrichmentMerge?.error || "Read-only runtime register enrichment validation failed"
        : null
    : null;
  const combinedRuntimeSource = readOnlyRuntimeEnrichment
    ? {
        ...baseRuntimeSource,
        ok: baseRuntimeSource.ok === true && enrichmentError === null,
        fallback: false,
        status: baseRuntimeSource.ok === true
          ? registerCollection?.sourceStatus?.status ?? baseRuntimeSource.status ?? null
          : baseRuntimeSource.status ?? null,
        message:
          baseRuntimeSource.ok === true && enrichmentError === null
            ? `${normalizeOptionalText(baseRuntimeSource.message) || "OK"}; read-only exact enrichment ${enrichmentMerge.selectedPointCount} points/${enrichmentMerge.selectedEquipmentCount} devices`
            : null,
        rows: runtimeRows.length,
        error:
          baseRuntimeSource.ok !== true
            ? baseRuntimeSource.error || "Primary realtime collection unavailable"
            : enrichmentError,
        reasonCode:
          baseRuntimeSource.ok === true && enrichmentError === null
            ? null
            : "read_only_runtime_enrichment_failed"
      }
    : baseRuntimeSource;
  const receivedAt = registerCollection?.fetchedAt || tree.fetchedAt || null;
  const chillers = runtimeRows
    .map(normalizeChillerRuntimeRow)
    .filter(Boolean);
  const pointSummary = buildRuntimePointSummary(runtimeRows, chillers, {
    ...config,
    receivedAt,
    runtimePointEvidenceDecoder
  });
  const activeChillers = chillers.filter((item) => item.running);
  const activeChillerIds = activeChillers.map((item) => item.id);

  return {
    equipmentContext: {
      activeChillerIds,
      activeChillerModels: activeChillers.map((item) => item.label)
    },
    currentCombination: activeChillerIds,
    chillerInventory: chillers.map((item) => ({
      id: item.id,
      label: item.label,
      available: item.available,
      lockedByOperator: item.faultActive === true,
      deviceId: item.deviceId,
      deviceCode: item.deviceCode
    })),
    chillers,
    pointSummary,
    sourceStatus: buildSourceStatus([
      annotateSourceEntry({
        key: "chillerStagingRuntime",
        ...combinedRuntimeSource
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: readOnlyRuntimeEnrichment
          ? "legacy-reg-readonly-exact-enrichment"
          : resolveInterfaceKind(realtimeInterface?.endpointKind, "legacy-reg-findAllByDrTypeId")
      }),
      annotateSourceEntry({
        key: "chillerStagingCatalog",
        ...(tree.sourceStatus?.catalog || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: "legacy-device-catalog"
      })
    ]),
    summary: {
      chillerCount: chillers.length,
      runningCount: activeChillerIds.length,
      runningCombination: activeChillerIds,
      chillerPowerFromRuntimeKw: activeChillers.reduce(
        (sum, item) => sum + (typeof item.powerKw === "number" ? item.powerKw : 0),
        0
      )
    }
  };
}

export async function getRuntimePointSummary(config, siteId, options = {}) {
  const context = await getChillerStagingRuntimeContext(config, siteId, options);
  const pointSummary = context.pointSummary || {};

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    status: pointSummary.status || "unavailable",
    basis: pointSummary.basis || "legacy_realtime_register_summary",
    pointDictionary: pointSummary.pointDictionary || {
      applied: false,
      source: null
    },
    counts: pointSummary.counts || {},
    keySignals: pointSummary.keySignals || {},
    groups: pointSummary.groups || {},
    pointEvidence: pointSummary.pointEvidence || {
      contractVersion: "runtime-point-evidence-v1",
      sourceKey: "chillerStagingRuntime",
      evidenceProfileId: null,
      receivedAt: null,
      points: [],
      summary: {
        totalPoints: 0,
        authoritativeTimestampPoints: 0,
        missingTimestampPoints: 0,
        goodQualityPoints: 0,
        replayProofPoints: 0,
        missingReplayProofPoints: 0
      }
    },
    freshnessPolicy: pointSummary.freshnessPolicy || { ...DEFAULT_RUNTIME_POINT_FRESHNESS_POLICY },
    summary: {
      ...(context.summary || {}),
      activeChillerIds: context.equipmentContext?.activeChillerIds || [],
      activeChillerModels: context.equipmentContext?.activeChillerModels || []
    },
    disclaimers: pointSummary.disclaimers || [],
    sourceStatus: context.sourceStatus
  };
}

export async function getFanCoilTerminalSnapshot(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const build = normalizeOptionalText(options.build) || "1";
  const floor = normalizeOptionalText(options.floor) || "1";
  const queryOptions = resolveDeviceQueryDefaults(config, {
    ...options,
    build,
    floor,
    mock: false
  });
  const tree = await loadDeviceTree(config.legacyBaseUrl, siteId, {
    ...queryOptions,
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    realtimeEndpointKind: "legacy-reg-findAllByDrTypeId",
    placeholderFallback: false
  });
  const sampledAt = tree.fetchedAt || buildGeneratedAt(config);
  const rows = Array.isArray(tree.realtimeCollectionRows) ? tree.realtimeCollectionRows : [];
  const normalizedItems = rows
    .filter(isFanCoilRuntimeRow)
    .map((row) => normalizeFanCoilRow(row, sampledAt));
  const deduped = dedupeFanCoilItems(normalizedItems);
  const items = deduped.items;
  const summary = buildFanCoilSummary(items);
  const freshness = computeFreshnessState(sampledAt, config.staleThresholdHours);
  const sourceStatus = buildSourceStatus([
    annotateSourceEntry({
      key: "fanCoilRuntime",
      ...(tree.sourceStatus?.tree || {})
    }, {
      baseUrl: config.legacyBaseUrl,
      interfaceKind: "legacy-reg-findAllByDrTypeId"
    }),
    annotateSourceEntry({
      key: "fanCoilCatalog",
      ...(tree.sourceStatus?.catalog || {})
    }, {
      baseUrl: config.legacyBaseUrl,
      interfaceKind: "legacy-device-catalog"
    })
  ]);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    subsystemType: "hvac_terminal",
    equipmentType: "fan_coil",
    building: normalizeOptionalText(options.building) || "盛世绿能办公楼",
    floor,
    floorName: floor === "1" ? "10楼" : `${floor}楼`,
    sampledAt,
    timestampBasis: "bff_fetch_time",
    rawTagTimeNote: "上游 tagTime 当前为相对/周期值，不作为绝对采样时间。",
    items,
    summary: {
      ...summary,
      rawDeviceRows: normalizedItems.length,
      duplicateCollapsedCount: deduped.duplicateCollapsedCount,
      dataStatus: items.length > 0 && sourceStatus.overall !== "failed" ? "ok" : "unavailable"
    },
    freshness,
    sourceStatus,
    disclaimers: [
      "风机盘管数据来自 BA 只读接口，仅用于监测、诊断和影子建议。",
      "regReadWrite=2 的设定、风速、启停等点位只展示，不开放写入，不下发 PLC/BA 控制。",
      "上游 tagTime 不是绝对时间戳，本响应使用 BFF 抓取时间 sampledAt 作为快照时间。"
    ]
  };
}

export async function getDeviceList(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const list = await loadDeviceList(config.legacyBaseUrl, siteId, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    placeholderFallback: options.placeholderFallback !== false
  });
  const freshness = computeFreshnessState(list.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    items: list.items,
    page: list.page,
    pageSize: list.pageSize,
    total: list.total,
    filters: list.filters,
    freshness,
    sourceStatus: buildSourceStatus([
      annotateSourceEntry({
        key: "devices",
        endpoint: `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=200`,
        ...(list.sourceStatus || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: "legacy-device-catalog"
      }),
      list.fallbackSourceStatus
        ? {
            key: "devicesPlaceholder",
            ...list.fallbackSourceStatus
          }
        : null
    ].filter(Boolean))
  };
}

export async function getDeviceTree(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const tree = await loadDeviceTree(config.legacyBaseUrl, siteId, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    ...(realtimeInterface?.endpointKind ? { realtimeEndpointKind: realtimeInterface.endpointKind } : {}),
    placeholderFallback: options.placeholderFallback !== false
  });
  const freshness = computeFreshnessState(tree.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    tree: tree.root,
    filters: tree.filters,
    freshness,
    sourceStatus: buildSourceStatus([
      annotateSourceEntry({
        key: "devicesTree",
        ...(tree.sourceStatus?.tree || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: resolveInterfaceKind(realtimeInterface?.endpointKind, "api-device-tree")
      }),
      annotateSourceEntry({
        key: "devicesCatalog",
        ...(tree.sourceStatus?.catalog || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: "legacy-device-catalog"
      }),
      tree.sourceStatus?.runtime
        ? annotateSourceEntry({
          key: "devicesRuntime",
          ...(tree.sourceStatus.runtime || {})
        }, {
          baseUrl: config.legacyBaseUrl,
          interfaceKind: "legacy-reg-findAllByDrTypeId"
        })
        : null,
      tree.sourceStatus?.placeholder
        ? {
            key: "devicesPlaceholder",
            ...(tree.sourceStatus.placeholder || {})
          }
        : null
    ].filter(Boolean))
  };
}

export async function getDeviceDetail(config, siteId, deviceId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const detail = await loadDeviceDetail(config.legacyBaseUrl, siteId, deviceId, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    ...(realtimeInterface?.endpointKind ? { realtimeEndpointKind: realtimeInterface.endpointKind } : {}),
    placeholderFallback: options.placeholderFallback !== false
  });
  const freshness = computeFreshnessState(detail.fetchedAt, config.staleThresholdHours);

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    detail: detail.detail,
    freshness,
    sourceStatus: buildDeviceDetailSourceStatus(config, realtimeInterface, detail.sourceStatus, "deviceDetail")
  };
}

export async function getDeviceDetails(config, siteId, deviceIds, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const batch = await loadDeviceDetails(config.legacyBaseUrl, siteId, deviceIds, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    ...(realtimeInterface?.endpointKind ? { realtimeEndpointKind: realtimeInterface.endpointKind } : {}),
    placeholderFallback: options.placeholderFallback !== false
  });

  return {
    site: {
      siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
      siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
    },
    generatedAt: buildGeneratedAt(config),
    items: (batch.items || []).map((item) => ({
      deviceId: item.deviceId,
      detail: item.detail,
      freshness: computeFreshnessState(item.fetchedAt, config.staleThresholdHours),
      sourceStatus: buildDeviceDetailSourceStatus(config, realtimeInterface, item.sourceStatus, "deviceDetail")
    })),
    summary: {
      requested: Array.isArray(deviceIds) ? deviceIds.filter((item) => normalizeOptionalText(item)).length : 0,
      resolved: (batch.items || []).filter((item) => item?.detail).length,
      missing: (batch.items || []).filter((item) => !item?.detail).length
    },
    sourceStatus: buildDeviceDetailSourceStatus(config, realtimeInterface, batch.sourceStatus, "deviceDetails")
  };
}

export async function validateStationRuntimeBindingSource(config, siteId, binding) {
  const checkedAt = new Date().toISOString();
  const requestedDeviceIds = Array.isArray(binding?.selectors?.deviceIds)
    ? binding.selectors.deviceIds.map(normalizeOptionalText).filter(Boolean)
    : [];
  const requestedDeviceCodes = Array.isArray(binding?.selectors?.deviceCodes)
    ? binding.selectors.deviceCodes.map((item) => normalizeOptionalText(item).toUpperCase()).filter(Boolean)
    : [];
  const requestedPointCodes = Array.isArray(binding?.selectors?.pointCodes)
    ? binding.selectors.pointCodes.map(normalizeOptionalText).filter(Boolean)
    : [];
  const databaseKey = normalizeOptionalText(binding?.source?.databaseKey)
    || resolveDeviceDatabaseKey(config, {});
  const projectKey = normalizeOptionalText(binding?.source?.projectKey)
    || resolveDeviceProjectKey(config, {});
  const template = normalizeOptionalText(binding?.source?.template)
    || normalizeOptionalText(config?.siteSourceConfig?.template);
  const queryDefaults = resolveDeviceQueryDefaults(config, { mock: false });
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const effectiveSource = {
    legacyBaseUrl: normalizeOptionalText(config?.legacyBaseUrl) || null,
    databaseKey: databaseKey || null,
    projectKey: projectKey || null,
    template: template || null,
    realtimeEndpointKind: normalizeOptionalText(realtimeInterface?.endpointKind) || null,
    build: normalizeOptionalText(queryDefaults.build) || null,
    floor: normalizeOptionalText(queryDefaults.floor) || null,
    mock: false
  };
  const effectiveSourceHash = createHash("sha256")
    .update(JSON.stringify(effectiveSource))
    .digest("hex");
  const catalog = await loadDeviceList(config.legacyBaseUrl, siteId, {
    page: 1,
    pageSize: 10000,
    sourcePageSize: 5000,
    includeAllCatalogRows: true,
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    mock: false,
    placeholderFallback: false
  });
  const catalogItems = Array.isArray(catalog.items) ? catalog.items : [];
  const itemsById = new Map();
  for (const item of catalogItems) {
    const deviceId = normalizeOptionalText(item.deviceId);
    if (!deviceId) {
      continue;
    }
    if (!itemsById.has(deviceId)) {
      itemsById.set(deviceId, []);
    }
    itemsById.get(deviceId).push(item);
  }
  const itemsByCode = new Map();
  for (const item of catalogItems) {
    const code = normalizeOptionalText(item.deviceCode).toUpperCase();
    if (!code) {
      continue;
    }
    if (!itemsByCode.has(code)) {
      itemsByCode.set(code, []);
    }
    itemsByCode.get(code).push(item);
  }
  const ambiguousDeviceIds = [...new Set(requestedDeviceIds.filter((deviceId) => (
    (itemsById.get(deviceId) || []).length > 1
  )))].sort();
  const matchedDevices = requestedDeviceIds
    .map((deviceId) => (itemsById.get(deviceId) || []).length === 1 ? itemsById.get(deviceId)[0] : null)
    .filter(Boolean);
  const unmatchedDeviceIds = requestedDeviceIds.filter((deviceId) => (
    (itemsById.get(deviceId) || []).length === 0
  ));
  const unmatchedDeviceCodes = requestedDeviceCodes.filter((deviceCode) => !itemsByCode.has(deviceCode));
  const selectedDeviceCodes = new Set(
    matchedDevices.map((item) => normalizeOptionalText(item.deviceCode).toUpperCase()).filter(Boolean)
  );
  const configuredDeviceCodes = new Set(requestedDeviceCodes);
  const pairingMismatch = requestedDeviceCodes.length > 0 && (
    requestedDeviceCodes.length !== requestedDeviceIds.length
    || matchedDevices.some((item) => !configuredDeviceCodes.has(normalizeOptionalText(item.deviceCode).toUpperCase()))
    || requestedDeviceCodes.some((code) => !selectedDeviceCodes.has(code))
    || requestedDeviceCodes.some((code) => (itemsByCode.get(code) || []).length !== 1)
  );
  const hasPlaceholder = matchedDevices.some((item) => (
    item?.isPlaceholder === true || item?.isVirtual === true
  ));
  const unselectedVirtualCount = catalogItems.filter((item) => (
    !requestedDeviceIds.includes(normalizeOptionalText(item?.deviceId))
    && (item?.isPlaceholder === true || item?.isVirtual === true)
  )).length;

  let registerCollection = null;
  let unmatchedPointCodes = [];
  let ambiguousPointCodes = [];
  const pointMatches = [];
  if (requestedPointCodes.length > 0) {
    registerCollection = await loadDeviceRegisterCollection(config.legacyBaseUrl, siteId, {
      ...(databaseKey ? { databaseKey } : {}),
      ...(projectKey ? { projectKey } : {}),
      pageSize: 5000
    });
    const selectedIds = new Set(requestedDeviceIds);
    const occurrences = new Map(requestedPointCodes.map((pointCode) => [pointCode, []]));
    for (const record of Array.isArray(registerCollection.records) ? registerCollection.records : []) {
      const deviceId = normalizeOptionalText(record?.drId ?? record?.drid ?? record?.deviceId);
      if (!selectedIds.has(deviceId)) {
        continue;
      }
      const candidateCodes = [
        record?.pointCode,
        record?.tagName,
        record?.tagname,
        record?.regId,
        record?.regid
      ].map(normalizeOptionalText).filter(Boolean);
      for (const pointCode of requestedPointCodes) {
        if (candidateCodes.includes(pointCode)) {
          occurrences.get(pointCode).push({
            deviceId,
            deviceCode: normalizeOptionalText(record?.drcode ?? record?.drCode ?? record?.deviceCode) || null,
            pointCode,
            sourcePointId: normalizeOptionalText(
              record?.pointCode ?? record?.tagName ?? record?.tagname ?? record?.regId ?? record?.regid
            ) || null,
            registerName: normalizeOptionalText(record?.regName ?? record?.regname) || null
          });
        }
      }
    }
    unmatchedPointCodes = requestedPointCodes.filter((pointCode) => (
      (occurrences.get(pointCode) || []).length === 0
    ));
    ambiguousPointCodes = requestedPointCodes.filter((pointCode) => (
      new Set((occurrences.get(pointCode) || []).map((item) => (
        `${item.deviceId}:${item.sourcePointId || ""}:${item.registerName || ""}`
      ))).size > 1
    ));
    for (const [pointCode, matches] of occurrences.entries()) {
      if (matches.length > 0) {
        pointMatches.push({ pointCode, matches });
      }
    }
  }

  const errors = [];
  if (catalog.sourceStatus?.ok !== true) errors.push("CATALOG_UNAVAILABLE");
  if (catalogItems.length === 0) errors.push("CATALOG_EMPTY");
  if (catalog.fallbackSourceStatus || hasPlaceholder) errors.push("PLACEHOLDER_OR_FALLBACK_FORBIDDEN");
  if (requestedDeviceIds.length === 0) errors.push("DEVICE_ALLOWLIST_EMPTY");
  if (unmatchedDeviceIds.length > 0) errors.push("DEVICE_IDS_UNMATCHED");
  if (ambiguousDeviceIds.length > 0) errors.push("DEVICE_IDS_AMBIGUOUS");
  if (unmatchedDeviceCodes.length > 0) errors.push("DEVICE_CODES_UNMATCHED");
  if (pairingMismatch) errors.push("DEVICE_ID_CODE_PAIRING_MISMATCH");
  if (requestedPointCodes.length > 0 && registerCollection?.sourceStatus?.ok !== true) {
    errors.push("POINT_SOURCE_UNAVAILABLE");
  }
  if (unmatchedPointCodes.length > 0) errors.push("POINT_CODES_UNMATCHED");
  if (ambiguousPointCodes.length > 0) errors.push("POINT_CODES_AMBIGUOUS");

  const catalogEvidence = matchedDevices
    .map((item) => ({
      deviceId: normalizeOptionalText(item.deviceId),
      deviceCode: normalizeOptionalText(item.deviceCode).toUpperCase(),
      deviceName: normalizeOptionalText(item.deviceName)
    }))
    .sort((left, right) => left.deviceId.localeCompare(right.deviceId));
  const catalogHash = createHash("sha256")
    .update(JSON.stringify({ devices: catalogEvidence, points: pointMatches }))
    .digest("hex");

  return {
    ok: errors.length === 0,
    payloadHash: binding?.payloadHash || null,
    checkedAt,
    selectorMode: "exact_allowlist",
    matchAll: false,
    matched: {
      deviceCount: matchedDevices.length,
      devices: catalogEvidence,
      pointCount: pointMatches.length,
      points: pointMatches
    },
    unmatched: {
      deviceIds: unmatchedDeviceIds,
      deviceCodes: unmatchedDeviceCodes,
      pointCodes: unmatchedPointCodes
    },
    ambiguous: {
      deviceIds: ambiguousDeviceIds,
      pointCodes: ambiguousPointCodes
    },
    errors,
    catalogHash,
    effectiveSource,
    effectiveSourceHash,
    sourceEvidence: {
      mock: false,
      placeholder: hasPlaceholder,
      fallback: Boolean(catalog.fallbackSourceStatus),
      unselectedVirtualCount,
      catalog: catalog.sourceStatus || null,
      points: registerCollection?.sourceStatus || null
    }
  };
}

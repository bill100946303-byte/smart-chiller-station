import { loadDeviceDetail, loadDeviceDetails, loadDeviceList, loadDeviceTree } from "../adapters/legacyDeviceAdapter.js";
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

function buildRuntimePoints(rows) {
  const points = [];
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
      points.push({
        deviceId: deviceId || null,
        deviceCode: deviceCode || null,
        deviceName: deviceName || null,
        deviceTypeName: deviceTypeName || null,
        regName,
        tagName: normalizeOptionalText(record?.tagName) || null,
        value,
        fullName: [deviceName, regName].filter(Boolean).join(" ")
      });
    }
  }
  return points;
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
  const points = buildRuntimePoints(sourceRows);
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
      "多机运行且无单台冷冻水流量时，不从点位摘要拆分单台主机 COP。"
    ]
  };
}

export async function getChillerStagingRuntimeContext(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const realtimeInterface = resolveDeviceRealtimeInterface(config);
  const tree = await loadDeviceTree(config.legacyBaseUrl, siteId, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    ...(realtimeInterface?.endpointKind ? { realtimeEndpointKind: realtimeInterface.endpointKind } : {}),
    placeholderFallback: false
  });
  const chillers = (Array.isArray(tree.realtimeCollectionRows) ? tree.realtimeCollectionRows : [])
    .map(normalizeChillerRuntimeRow)
    .filter(Boolean);
  const pointSummary = buildRuntimePointSummary(tree.realtimeCollectionRows, chillers, config);
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
        ...(tree.sourceStatus?.tree || {})
      }, {
        baseUrl: config.legacyBaseUrl,
        interfaceKind: resolveInterfaceKind(realtimeInterface?.endpointKind, "legacy-reg-findAllByDrTypeId")
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

export async function getDeviceList(config, siteId, options = {}) {
  const projectKey = resolveDeviceProjectKey(config, options);
  const databaseKey = resolveDeviceDatabaseKey(config, options);
  const list = await loadDeviceList(config.legacyBaseUrl, siteId, {
    ...resolveDeviceQueryDefaults(config, options),
    ...(databaseKey ? { databaseKey } : {}),
    ...(projectKey ? { projectKey } : {}),
    placeholderFallback: true
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
    placeholderFallback: true
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
    placeholderFallback: true
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
    placeholderFallback: true
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

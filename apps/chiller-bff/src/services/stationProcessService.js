const SUPPORTED_STATION_PROCESS_TYPES = new Set([
  "compressed_air",
  "boiler_room"
]);

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}
function asFiniteNumber(value) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnit(value) {
  return normalizeText(value)
    .toLowerCase()
    .replaceAll("³", "3")
    .replaceAll("℃", "°c")
    .replace(/\s+/g, "");
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function convertPowerKw(value, unit) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (["kw", "千瓦"].includes(normalizedUnit)) return round(numeric);
  if (["w", "瓦"].includes(normalizedUnit)) return round(numeric / 1000);
  return null;
}

function convertPressureBar(value, unit) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === "bar") return round(numeric);
  if (normalizedUnit === "mpa") return round(numeric * 10);
  if (normalizedUnit === "kpa") return round(numeric / 100);
  return null;
}

function convertPressureMpa(value, unit) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === "mpa") return round(numeric);
  if (normalizedUnit === "bar") return round(numeric / 10);
  if (normalizedUnit === "kpa") return round(numeric / 1000);
  return null;
}

function convertAirFlowNm3Min(value, unit) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (["nm3/min", "nm3·min-1"].includes(normalizedUnit)) return round(numeric);
  if (["nm3/h", "nm3·h-1"].includes(normalizedUnit)) return round(numeric / 60);
  return null;
}

function convertTemperatureC(value, unit) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  return ["°c", "c"].includes(normalizedUnit) ? round(numeric) : null;
}

function pointMatchesMapping(point, mapping) {
  const pointCode = normalizeText(mapping?.pointCode);
  if (pointCode) {
    return [point?.pointKey, point?.tagName, point?.regId]
      .map(normalizeText)
      .includes(pointCode);
  }
  const pointName = normalizeText(mapping?.pointName);
  return Boolean(pointName && normalizeText(point?.regName) === pointName);
}

function buildRoleMeasurements(pointMappings, evidencePoints, selectedPointCodes) {
  return pointMappings
    .filter((mapping) => {
      const pointCode = normalizeText(mapping?.pointCode);
      return !pointCode || selectedPointCodes.has(pointCode);
    })
    .map((mapping) => {
      const point = evidencePoints.find((candidate) => pointMatchesMapping(candidate, mapping)) || null;
      const configuredUnit = normalizeText(mapping?.unit);
      const sourceUnit = normalizeText(point?.unit);
      return {
        mappingId: normalizeText(mapping?.mappingId) || null,
        role: normalizeText(mapping?.pointRole) || "feedback",
        label: normalizeText(mapping?.pointName) || normalizeText(mapping?.pointCode),
        pointCode: normalizeText(mapping?.pointCode) || null,
        required: mapping?.required === true,
        value: point?.value ?? null,
        unit: sourceUnit || configuredUnit || null,
        configuredUnit: configuredUnit || null,
        sourceUnit: sourceUnit || null,
        qualityCode: normalizeText(point?.qualityCode) || "UNKNOWN",
        observedAt: normalizeText(point?.observedAt) || null,
        authoritativeTimestamp: point?.authoritativeTimestamp === true,
        deviceId: normalizeText(point?.deviceId) || null,
        deviceCode: normalizeText(point?.deviceCode) || null,
        sourcePointKey: normalizeText(point?.pointKey) || null,
        matched: Boolean(point)
      };
    });
}

function selectRoleMeasurement(measurements, role) {
  return measurements.find((item) => item.role === role && item.matched && item.value != null) || null;
}

function buildCompressedAirMetrics(measurements) {
  const power = selectRoleMeasurement(measurements, "power");
  const pressure = selectRoleMeasurement(measurements, "pressure");
  const flow = selectRoleMeasurement(measurements, "flow");
  const temperature = selectRoleMeasurement(measurements, "temperature");
  const powerKw = convertPowerKw(power?.value, power?.unit);
  const pressureBar = convertPressureBar(pressure?.value, pressure?.unit);
  const flowNm3Min = convertAirFlowNm3Min(flow?.value, flow?.unit);
  const dewPointC = convertTemperatureC(temperature?.value, temperature?.unit);
  const specificEnergyKwhNm3 = powerKw !== null && flowNm3Min !== null && flowNm3Min > 0
    ? round(powerKw / (flowNm3Min * 60), 4)
    : null;
  return {
    powerKw,
    pressureBar,
    flowNm3Min,
    specificEnergyKwhNm3,
    dewPointC
  };
}

function buildBoilerRoomMetrics(measurements) {
  const power = selectRoleMeasurement(measurements, "power");
  const pressure = selectRoleMeasurement(measurements, "pressure");
  const flow = selectRoleMeasurement(measurements, "flow");
  const temperature = selectRoleMeasurement(measurements, "temperature");
  return {
    powerKw: convertPowerKw(power?.value, power?.unit),
    pressureMpa: convertPressureMpa(pressure?.value, pressure?.unit),
    thermalMediumFlow: asFiniteNumber(flow?.value),
    thermalMediumFlowUnit: normalizeText(flow?.unit) || null,
    temperatureC: convertTemperatureC(temperature?.value, temperature?.unit)
  };
}

function buildOperatingState(measurements) {
  const statusMeasurements = measurements.filter((item) => item.role === "status" && item.matched);
  const alarmMeasurements = measurements.filter((item) => item.role === "alarm" && item.matched);
  return {
    statusPointCount: statusMeasurements.length,
    runningPointCount: statusMeasurements.filter((item) => (asFiniteNumber(item.value) || 0) > 0).length,
    alarmPointCount: alarmMeasurements.length,
    activeAlarmPointCount: alarmMeasurements.filter((item) => (asFiniteNumber(item.value) || 0) > 0).length
  };
}

export function buildStationProcessSummary({
  binding,
  runtimeSummary,
  pointMappings = [],
  requiredPointRoles = []
} = {}) {
  const subsystemType = normalizeText(binding?.parentSubsystemType);
  if (!SUPPORTED_STATION_PROCESS_TYPES.has(subsystemType)) {
    return null;
  }
  const selectedPointCodes = new Set(
    (Array.isArray(binding?.selectors?.pointCodes) ? binding.selectors.pointCodes : [])
      .map(normalizeText)
      .filter(Boolean)
  );
  const evidencePoints = Array.isArray(runtimeSummary?.pointEvidence?.points)
    ? runtimeSummary.pointEvidence.points
    : [];
  const roleMeasurements = buildRoleMeasurements(
    Array.isArray(pointMappings) ? pointMappings : [],
    evidencePoints,
    selectedPointCodes
  );
  const requiredRoles = Array.from(new Set(
    (Array.isArray(requiredPointRoles) ? requiredPointRoles : [])
      .filter((item) => item?.required !== false)
      .map((item) => normalizeText(item?.role))
      .filter(Boolean)
  ));
  const mappedRequiredRoles = requiredRoles.filter((role) => (
    roleMeasurements.some((item) => item.role === role)
  ));
  const observedRequiredRoles = requiredRoles.filter((role) => (
    roleMeasurements.some((item) => item.role === role && item.matched && item.value != null)
  ));
  const matchedMeasurements = roleMeasurements.filter((item) => item.matched);
  const authoritativeMeasurements = matchedMeasurements.filter((item) => item.authoritativeTimestamp);
  const readiness = requiredRoles.length > 0 && observedRequiredRoles.length === requiredRoles.length
    ? "ready"
    : matchedMeasurements.length > 0
      ? "partial"
      : "blocked";
  const timestampStatus = matchedMeasurements.length === 0
    ? "unavailable"
    : authoritativeMeasurements.length === matchedMeasurements.length
      ? "authoritative"
      : authoritativeMeasurements.length > 0
        ? "partial"
        : "unverified";

  return {
    contractVersion: "station-process-summary-v1",
    station: {
      siteId: normalizeText(binding?.siteId),
      stationId: normalizeText(binding?.stationId),
      stationName: normalizeText(binding?.stationName),
      subsystemType,
      bindingVersion: Number(binding?.bindingVersion) || null
    },
    readiness,
    timestampStatus,
    coverage: {
      selectedDeviceCount: Array.isArray(binding?.selectors?.deviceIds) ? binding.selectors.deviceIds.length : 0,
      selectedPointCount: selectedPointCodes.size,
      observedPointCount: evidencePoints.length,
      configuredRoleMeasurementCount: roleMeasurements.length,
      matchedRoleMeasurementCount: matchedMeasurements.length,
      requiredRoleCount: requiredRoles.length,
      mappedRequiredRoleCount: mappedRequiredRoles.length,
      observedRequiredRoleCount: observedRequiredRoles.length
    },
    missingRequiredRoles: requiredRoles.filter((role) => !observedRequiredRoles.includes(role)),
    roleMeasurements,
    operatingState: buildOperatingState(roleMeasurements),
    metrics: subsystemType === "compressed_air"
      ? { compressedAir: buildCompressedAirMetrics(roleMeasurements) }
      : { boilerRoom: buildBoilerRoomMetrics(roleMeasurements) }
  };
}

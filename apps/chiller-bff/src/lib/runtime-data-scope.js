const FIXED_SUBSYSTEM_REASON = "ENDPOINT_FIXED_SCOPE";

function normalizeRequiredText(value, fieldName) {
  const text = value == null ? "" : String(value).trim();
  if (!text) {
    throw new TypeError(`${fieldName} is required`);
  }
  return text;
}

/**
 * Describes the scope actually enforced by a runtime endpoint.
 *
 * Navigation context must not be copied into this object. `applied: true`
 * means the endpoint/service implementation itself constrained the payload.
 */
export function buildFixedSubsystemDataScope(siteId, subsystemType) {
  return {
    siteId: normalizeRequiredText(siteId, "siteId"),
    requestedSubsystemType: null,
    effectiveSubsystemType: normalizeRequiredText(subsystemType, "subsystemType"),
    stationId: null,
    filterMode: "fixed_subsystem",
    applied: true,
    reason: FIXED_SUBSYSTEM_REASON
  };
}

export function buildProjectUnfilteredDataScope(siteId, reason = "SUBSYSTEM_FILTER_NOT_IMPLEMENTED") {
  return {
    siteId: normalizeRequiredText(siteId, "siteId"),
    requestedSubsystemType: null,
    effectiveSubsystemType: null,
    stationId: null,
    filterMode: "project_unfiltered",
    applied: false,
    reason: normalizeRequiredText(reason, "reason")
  };
}

export function buildSiteAggregateDataScope(siteId) {
  return {
    siteId: normalizeRequiredText(siteId, "siteId"),
    requestedSubsystemType: null,
    effectiveSubsystemType: null,
    stationId: null,
    filterMode: "site_aggregate",
    applied: true,
    reason: "SITE_AGGREGATE"
  };
}

export function buildStationBindingDataScope(siteId, binding) {
  const stationId = normalizeRequiredText(binding?.stationId, "stationId");
  const subsystemType = normalizeRequiredText(
    binding?.parentSubsystemType,
    "parentSubsystemType"
  );
  const bindingVersion = Number(binding?.bindingVersion);
  if (!Number.isSafeInteger(bindingVersion) || bindingVersion <= 0) {
    throw new TypeError("bindingVersion must be a positive integer");
  }
  const deviceIds = Array.isArray(binding?.selectors?.deviceIds)
    ? binding.selectors.deviceIds
    : [];
  const deviceCodes = Array.isArray(binding?.selectors?.deviceCodes)
    ? binding.selectors.deviceCodes
    : [];
  const pointCodes = Array.isArray(binding?.selectors?.pointCodes)
    ? binding.selectors.pointCodes
    : [];
  return {
    siteId: normalizeRequiredText(siteId, "siteId"),
    requestedSubsystemType: subsystemType,
    effectiveSubsystemType: subsystemType,
    stationId,
    filterMode: "station_binding",
    applied: true,
    reason: "STATION_RUNTIME_BINDING_APPLIED",
    bindingVersion,
    payloadHash: normalizeRequiredText(binding?.payloadHash, "payloadHash"),
    matchedDeviceCount: Number(binding?.validation?.matched?.deviceCount) || deviceIds.length,
    cacheKey: `${normalizeRequiredText(siteId, "siteId")}:${stationId}:v${bindingVersion}`,
    selectorCounts: {
      deviceIds: deviceIds.length,
      deviceCodes: deviceCodes.length,
      pointCodes: pointCodes.length
    }
  };
}

export function buildDashboardOverviewScopeEvidence(siteId) {
  const chilledPlantMetricsScope = buildFixedSubsystemDataScope(siteId, "chilled_plant");
  return {
    dataScope: buildProjectUnfilteredDataScope(siteId, "MIXED_SCOPE_PAYLOAD"),
    fieldScopes: {
      chilledPlantMetrics: {
        fieldPaths: [
          "energyCards.currentCop",
          "energyCards.totalPowerKw",
          "energyCards.currentLoadRate",
          "energyCards.totalElectricityKwh",
          "energyCards.savingPotentialPct",
          "energyCards.totalCoolingCapacity",
          "energyCards.chilledDeltaT",
          "energyCards.coolingDeltaT",
          "energyCards.chillerPowerKw",
          "energyCards.chilledPumpPowerKw",
          "energyCards.coolingPumpPowerKw",
          "energyCards.coolingTowerPowerKw",
          "energyCards.chillerCop",
          "energyCards.chilledPumpConveyingCoefficient",
          "energyCards.coolingTowerConveyingCoefficient",
          "energyCards.coolingPumpConveyingCoefficient",
          "energyCards.thermalUnbalanceRate",
          "energyCards.chilledSupplyTemp",
          "energyCards.coolingReturnTemp",
          "deviceSummary.chillerCount",
          "deviceSummary.chilledPumpCount",
          "deviceSummary.coolingPumpCount",
          "deviceSummary.coolingTowerCount"
        ],
        exclusions: [],
        dataScope: chilledPlantMetricsScope
      },
      projectAggregate: {
        fieldPaths: [
          "energyCards.activeAnomalyCount",
          "energyCards.outdoorTempC",
          "energyCards.outdoorHumidityPct",
          "energyCards.outdoorWetBulbC",
          "energyCards.dewPointC",
          "alarmSummary",
          "deviceSummary.totalDevices"
        ],
        exclusions: [],
        dataScope: buildProjectUnfilteredDataScope(siteId)
      }
    }
  };
}

export function withRuntimeDataScope(payload, dataScope) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("runtime payload must be a plain object");
  }
  return {
    ...payload,
    dataScope
  };
}

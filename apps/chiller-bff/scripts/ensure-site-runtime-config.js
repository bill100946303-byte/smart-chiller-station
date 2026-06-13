import path from "node:path";
import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";

function parseStringOption(name, fallback = "") {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const value = arg.slice(name.length + 3).trim();
  return value || fallback;
}

function normalizeOptionalText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseOptionalJsonObject(value, fieldName) {
  if (value == null) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error(`${fieldName} must be a JSON object`);
    } catch (error) {
      throw new Error(`${fieldName} must be valid JSON (${String(error)})`);
    }
  }
  throw new Error(`${fieldName} must be a JSON object`);
}

function parseOptionalNumberMap(value, fieldName) {
  const parsed = parseOptionalJsonObject(value, fieldName);
  if (!parsed) {
    return null;
  }
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const key = normalizeOptionalText(rawKey);
    const number = parseOptionalNumber(rawValue);
    if (!key || number === null || number <= 0) {
      continue;
    }
    normalized[key] = number;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function parseDispatchMode(value, fieldName) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "off" || normalized === "shadow" || normalized === "enforced") {
    return normalized;
  }
  throw new Error(`${fieldName} must be one of: off, shadow, enforced`);
}

function parseOptionalPositiveInteger(value, fieldName) {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return null;
  }
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePlainObjects(baseValue, patchValue) {
  const base = isPlainObject(baseValue) ? baseValue : {};
  const patch = isPlainObject(patchValue) ? patchValue : {};
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      merged[key] = mergePlainObjects(base[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function readPatchFromInputs() {
  const fullPatch = parseOptionalJsonObject(
    parseStringOption("runtime-config-patch-json", process.env.RUNTIME_CONFIG_PATCH_JSON || ""),
    "runtime-config-patch-json"
  );
  const energyParams =
    fullPatch?.energyParams ||
    parseOptionalJsonObject(parseStringOption("energy-params-json", process.env.ENERGY_PARAMS_JSON || ""), "energy-params-json") ||
    {};
  const ruleThresholds =
    fullPatch?.ruleThresholds ||
    parseOptionalJsonObject(
      parseStringOption("rule-thresholds-json", process.env.RULE_THRESHOLDS_JSON || ""),
      "rule-thresholds-json"
    ) ||
    {};
  const featureFlags =
    fullPatch?.featureFlags ||
    parseOptionalJsonObject(
      parseStringOption("feature-flags-json", process.env.FEATURE_FLAGS_JSON || ""),
      "feature-flags-json"
    ) ||
    {};
  const dispatchMode = parseDispatchMode(
    parseStringOption("tower-approach-dispatch-mode", process.env.TOWER_APPROACH_DISPATCH_MODE || ""),
    "tower-approach-dispatch-mode"
  );
  const dispatchEndpoint = normalizeOptionalText(
    parseStringOption("tower-approach-dispatch-endpoint", process.env.TOWER_APPROACH_DISPATCH_ENDPOINT || ""),
    ""
  );
  const dispatchApproveEndpoint = normalizeOptionalText(
    parseStringOption(
      "tower-approach-dispatch-approve-endpoint",
      process.env.TOWER_APPROACH_DISPATCH_APPROVE_ENDPOINT || ""
    ),
    ""
  );
  const dispatchRollbackEndpoint = normalizeOptionalText(
    parseStringOption(
      "tower-approach-dispatch-rollback-endpoint",
      process.env.TOWER_APPROACH_DISPATCH_ROLLBACK_ENDPOINT || ""
    ),
    ""
  );
  const dispatchTimeoutMs = parseOptionalPositiveInteger(
    parseStringOption("tower-approach-dispatch-timeout-ms", process.env.TOWER_APPROACH_DISPATCH_TIMEOUT_MS || ""),
    "tower-approach-dispatch-timeout-ms"
  );

  const minCondenserInletTempC = parseOptionalNumber(
    parseStringOption(
      "min-condenser-inlet-temp-c",
      process.env.TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C || ""
    )
  );
  const minCondenserInletTempCByModel = parseOptionalNumberMap(
    parseStringOption(
      "min-condenser-inlet-temp-c-by-model-json",
      process.env.TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C_BY_MODEL_JSON || ""
    ),
    "min-condenser-inlet-temp-c-by-model-json"
  );
  const minCondenserInletTempCByChiller = parseOptionalNumberMap(
    parseStringOption(
      "min-condenser-inlet-temp-c-by-chiller-json",
      process.env.TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C_BY_CHILLER_JSON || ""
    ),
    "min-condenser-inlet-temp-c-by-chiller-json"
  );

  const towerApproachPatch = {};
  if (minCondenserInletTempC !== null) {
    towerApproachPatch.minCondenserInletTempC = minCondenserInletTempC;
  }
  if (minCondenserInletTempCByModel) {
    towerApproachPatch.minCondenserInletTempCByModel = minCondenserInletTempCByModel;
  }
  if (minCondenserInletTempCByChiller) {
    towerApproachPatch.minCondenserInletTempCByChiller = minCondenserInletTempCByChiller;
  }

  const dispatchFeatureFlagsPatch = {};
  if (dispatchMode) {
    dispatchFeatureFlagsPatch.towerApproachDispatchMode = dispatchMode;
  }
  if (dispatchEndpoint) {
    dispatchFeatureFlagsPatch.towerApproachDispatchEndpoint = dispatchEndpoint;
  }
  if (dispatchApproveEndpoint) {
    dispatchFeatureFlagsPatch.towerApproachDispatchApproveEndpoint = dispatchApproveEndpoint;
  }
  if (dispatchRollbackEndpoint) {
    dispatchFeatureFlagsPatch.towerApproachDispatchRollbackEndpoint = dispatchRollbackEndpoint;
  }
  if (dispatchTimeoutMs !== null) {
    dispatchFeatureFlagsPatch.towerApproachDispatchTimeoutMs = dispatchTimeoutMs;
  }

  return {
    energyParams,
    ruleThresholds:
      Object.keys(towerApproachPatch).length === 0
        ? ruleThresholds
        : mergePlainObjects(ruleThresholds, {
            towerApproach: towerApproachPatch
          }),
    featureFlags:
      Object.keys(dispatchFeatureFlagsPatch).length === 0
        ? featureFlags
        : mergePlainObjects(featureFlags, dispatchFeatureFlagsPatch),
    minCondenserInletTempC,
    minCondenserInletTempCByModel,
    minCondenserInletTempCByChiller,
    dispatchMode,
    dispatchEndpoint: dispatchEndpoint || null,
    dispatchApproveEndpoint: dispatchApproveEndpoint || null,
    dispatchRollbackEndpoint: dispatchRollbackEndpoint || null,
    dispatchTimeoutMs
  };
}

function main() {
  const siteId = normalizeOptionalText(
    parseStringOption("site-id", process.env.SITE_ID || appConfig.defaultSiteId),
    appConfig.defaultSiteId
  );
  const siteName = normalizeOptionalText(parseStringOption("site-name", process.env.SITE_NAME || siteId), siteId);
  const dbFile = path.resolve(parseStringOption("db-file", process.env.ADMIN_DB_FILE || appConfig.adminDbFile));
  const actor = {
    userId: normalizeOptionalText(
      parseStringOption("actor-user-id", process.env.RUNTIME_CONFIG_ACTOR_USER_ID || "runtime-config-bot"),
      "runtime-config-bot"
    ),
    username: normalizeOptionalText(
      parseStringOption("actor-username", process.env.RUNTIME_CONFIG_ACTOR_USERNAME || "runtime-config-bot"),
      "runtime-config-bot"
    )
  };
  const patch = readPatchFromInputs();
  const adminStore = createAdminStore({ dbFile });

  try {
    const existingSite = adminStore.getSite(siteId);
    if (!existingSite) {
      adminStore.createSite(
        {
          siteId,
          siteName,
          status: "active",
          ownerName: actor.username,
          remark: "Auto-created by ensure-site-runtime-config"
        },
        actor,
        {
          requestId: `ensure-runtime-config-create-${siteId}`
        }
      );
    }

    const existingRuntimeConfig = adminStore.getSiteRuntimeConfig(siteId);
    const nextPatch = {
      energyParams: mergePlainObjects(existingRuntimeConfig?.energyParams, patch.energyParams),
      ruleThresholds: mergePlainObjects(existingRuntimeConfig?.ruleThresholds, patch.ruleThresholds),
      featureFlags: mergePlainObjects(existingRuntimeConfig?.featureFlags, patch.featureFlags)
    };

    const runtimeConfig = adminStore.upsertRuntimeConfig(siteId, nextPatch, actor, {
      requestId: `ensure-runtime-config-upsert-${siteId}`
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          dbFile,
          siteId,
          siteName,
          createdSite: !existingSite,
          minCondenserInletTempC:
            runtimeConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempC ?? patch.minCondenserInletTempC,
          minCondenserInletTempCByModel:
            runtimeConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempCByModel ??
            patch.minCondenserInletTempCByModel,
          minCondenserInletTempCByChiller:
            runtimeConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempCByChiller ??
            patch.minCondenserInletTempCByChiller,
          dispatchMode:
            runtimeConfig?.featureFlags?.towerApproachDispatchMode ??
            patch.dispatchMode ??
            null,
          dispatchEndpoint:
            runtimeConfig?.featureFlags?.towerApproachDispatchEndpoint ??
            patch.dispatchEndpoint ??
            null,
          dispatchApproveEndpoint:
            runtimeConfig?.featureFlags?.towerApproachDispatchApproveEndpoint ??
            patch.dispatchApproveEndpoint ??
            null,
          dispatchRollbackEndpoint:
            runtimeConfig?.featureFlags?.towerApproachDispatchRollbackEndpoint ??
            patch.dispatchRollbackEndpoint ??
            null,
          dispatchTimeoutMs:
            runtimeConfig?.featureFlags?.towerApproachDispatchTimeoutMs ??
            patch.dispatchTimeoutMs ??
            null,
          runtimeConfig
        },
        null,
        2
      )}\n`
    );
  } finally {
    adminStore.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ensure-site-runtime-config failed: ${message}\n`);
  process.exit(1);
}

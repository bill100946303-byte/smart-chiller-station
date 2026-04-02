function normalizeLegacyBaseUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

const BUILTIN_SITE_SOURCE_CONFIGS = {
  btwentyfive: {
    legacyAppId: "140",
    modelKey: "126lnoffice",
    template: "1",
    ratedCoolingCapacityKw: 8440.8
  }
};

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function mergeSourceConfig(siteId, sourceConfig) {
  const builtin = BUILTIN_SITE_SOURCE_CONFIGS[siteId] || null;
  const merged = {
    siteId,
    legacyBaseUrl: normalizeOptionalText(sourceConfig?.legacyBaseUrl),
    ipAddress: normalizeOptionalText(sourceConfig?.ipAddress),
    port: normalizeOptionalText(sourceConfig?.port),
    legacyAppId: normalizeOptionalText(sourceConfig?.legacyAppId || builtin?.legacyAppId),
    databaseKey: normalizeOptionalText(sourceConfig?.databaseKey),
    modelKey: normalizeOptionalText(sourceConfig?.modelKey || builtin?.modelKey),
    template: normalizeOptionalText(sourceConfig?.template || builtin?.template),
    ratedCoolingCapacityKw: normalizeOptionalNumber(
      sourceConfig?.ratedCoolingCapacityKw || builtin?.ratedCoolingCapacityKw
    ),
    controlMode: normalizeOptionalText(sourceConfig?.controlMode),
    status: normalizeOptionalText(sourceConfig?.status)
  };

  return Object.values(merged).some(Boolean) ? merged : null;
}

export function resolveSiteRuntimeConfig(baseConfig, adminStore, siteId) {
  if (!siteId) {
    return baseConfig;
  }

  const sourceConfig = adminStore?.getSiteSourceConfig ? adminStore.getSiteSourceConfig(siteId) : null;
  const mergedSourceConfig = mergeSourceConfig(siteId, sourceConfig);
  const overrideBaseUrl = normalizeLegacyBaseUrl(mergedSourceConfig?.legacyBaseUrl);
  if (!overrideBaseUrl && !mergedSourceConfig) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    legacyBaseUrl: overrideBaseUrl || baseConfig.legacyBaseUrl,
    legacyAppId: normalizeOptionalText(mergedSourceConfig?.legacyAppId) || normalizeOptionalText(baseConfig?.legacyAppId),
    ratedCoolingCapacityKw:
      normalizeOptionalNumber(mergedSourceConfig?.ratedCoolingCapacityKw) ??
      normalizeOptionalNumber(baseConfig?.ratedCoolingCapacityKw),
    siteSourceConfig: mergedSourceConfig
  };
}

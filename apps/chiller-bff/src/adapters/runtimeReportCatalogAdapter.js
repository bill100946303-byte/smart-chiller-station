import { fetchLegacyJson } from "../lib/http.js";

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function toArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function isLegacyStatusOk(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    normalized === "20000" ||
    normalized === "200" ||
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "true"
  );
}

export function isLegacyPayloadFailed(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  if (payload.ok === false || payload.success === false) {
    return true;
  }

  if (payload.ok === true || payload.success === true) {
    return false;
  }

  if (payload.status != null) {
    return !isLegacyStatusOk(payload.status);
  }

  if (payload.code != null) {
    return !isLegacyStatusOk(payload.code);
  }

  return false;
}

export function isLegacyResponseUsable(response) {
  return response?.ok === true && !isLegacyPayloadFailed(response.payload);
}

function readRuntimeCollectionInterface(config, siteId) {
  const sourceConfig =
    config?.siteSourceConfig && typeof config.siteSourceConfig === "object"
      ? config.siteSourceConfig
      : {};
  const interfaces = Array.isArray(sourceConfig.deviceDataInterfaces)
    ? sourceConfig.deviceDataInterfaces
    : [];
  const selectedInterface =
    interfaces.find((item) => normalizeOptionalText(item?.endpointKind) === "legacy-reg-findAllByDrTypeId")
    || null;
  const defaultQuery =
    sourceConfig.defaultDeviceQuery && typeof sourceConfig.defaultDeviceQuery === "object"
      ? sourceConfig.defaultDeviceQuery
      : {};
  const projectKey =
    normalizeOptionalText(selectedInterface?.projectKey)
    || normalizeOptionalText(sourceConfig.deviceDataProjectKey)
    || normalizeOptionalText(sourceConfig.databaseKey)
    || normalizeOptionalText(siteId);
  if (!projectKey) {
    return null;
  }

  const buildRaw = selectedInterface?.build ?? defaultQuery.build;
  const floorRaw = selectedInterface?.floor ?? defaultQuery.floor;
  const build = Number.isFinite(Number(buildRaw)) ? Math.max(0, Number(buildRaw)) : null;
  const floor = Number.isFinite(Number(floorRaw)) ? Math.max(0, Number(floorRaw)) : null;

  return {
    projectKey,
    label:
      normalizeOptionalText(selectedInterface?.label)
      || normalizeOptionalText(sourceConfig.siteName)
      || "Runtime设备清单",
    build,
    floor
  };
}

function buildRuntimeCollectionEndpoint(runtimeInterface) {
  const search = new URLSearchParams();
  if (runtimeInterface?.build != null) {
    search.set("build", String(runtimeInterface.build));
  }
  if (runtimeInterface?.floor != null) {
    search.set("floor", String(runtimeInterface.floor));
  }
  const query = search.toString();
  return `/zsqy/reg/${runtimeInterface.projectKey}/findAllByDrTypeId${query ? `?${query}` : ""}`;
}

function normalizeRuntimeReg(row, index) {
  const id =
    normalizeOptionalText(row?.regId != null ? String(row.regId) : "")
    || normalizeOptionalText(row?.typemodeid != null ? String(row.typemodeid) : "")
    || `reg-${index + 1}`;
  return {
    id,
    label:
      normalizeOptionalText(row?.regNameCNEN)
      || normalizeOptionalText(row?.regName)
      || normalizeOptionalText(row?.name)
      || id,
    unit: normalizeOptionalText(row?.regUnits) || null
  };
}

function normalizeRuntimeDevice(row, index) {
  const id =
    normalizeOptionalText(row?.drid != null ? String(row.drid) : "")
    || normalizeOptionalText(row?.id != null ? String(row.id) : "")
    || `device-${index + 1}`;
  const regListRaw =
    row?.reglist && typeof row.reglist === "object"
      ? row.reglist.reglist ?? row.reglist
      : row?.reglist;
  return {
    id,
    label:
      normalizeOptionalText(row?.drnameCNEN)
      || normalizeOptionalText(row?.drname)
      || normalizeOptionalText(row?.name)
      || id,
    drTypeId:
      normalizeOptionalText(row?.drtypeid != null ? String(row.drtypeid) : "")
      || "0",
    drTypeLabel:
      normalizeOptionalText(row?.drtypenameCNEN)
      || normalizeOptionalText(row?.drtypename)
      || normalizeOptionalText(row?.typeName)
      || "未分组",
    regs: toArray(regListRaw)
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map(normalizeRuntimeReg)
  };
}

function parseRuntimeCollectionDevices(payload) {
  return toArray(payload?.data)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .filter((item) => item.drid != null || item.id != null)
    .map(normalizeRuntimeDevice);
}

export async function loadRuntimeReportCatalog(baseUrl, config, siteId) {
  const runtimeInterface = readRuntimeCollectionInterface(config, siteId);
  if (!runtimeInterface) {
    return {
      items: [],
      sourceStatus: {
        endpoint: "",
        ok: false,
        status: null,
        message: null,
        rows: null,
        error: "Runtime device collection is not configured",
        fallback: true,
        reasonCode: "runtime-device-collection-missing",
        interfaceKind: "legacy-reg-findAllByDrTypeId",
        originLabel: "Runtime设备清单"
      }
    };
  }

  const endpoint = buildRuntimeCollectionEndpoint(runtimeInterface);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const usable = isLegacyResponseUsable(response);
  const items = usable ? parseRuntimeCollectionDevices(response.payload) : [];

  return {
    items,
    sourceStatus: {
      endpoint,
      ok: usable,
      status: response.status ?? null,
      message: usable
        ? `${extractMessage(response.payload, "OK")}; devices=${items.length}`
        : null,
      rows: usable ? items.length : null,
      error: usable
        ? null
        : response.error || extractMessage(response.payload, "Runtime device collection unavailable"),
      fallback: true,
      reasonCode: "runtime-device-collection-fallback",
      interfaceKind: "legacy-reg-findAllByDrTypeId",
      originLabel: runtimeInterface.label || "Runtime设备清单"
    }
  };
}

export function buildRuntimeDeviceTypeNodes(items = []) {
  const seen = new Set();
  const nodes = [];
  items.forEach((item) => {
    const id = normalizeOptionalText(item?.drTypeId) || "0";
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    nodes.push({
      id,
      label: normalizeOptionalText(item?.drTypeLabel) || id,
      parentId: null,
      children: []
    });
  });
  return nodes;
}

export function buildRuntimeDeviceOptions(items = [], drTypeId) {
  const normalizedTypeId = normalizeOptionalText(drTypeId);
  return items
    .filter((item) => !normalizedTypeId || normalizeOptionalText(item?.drTypeId) === normalizedTypeId)
    .map((item) => ({
      id: normalizeOptionalText(item?.id) || "0",
      label: normalizeOptionalText(item?.label) || "未命名设备"
    }));
}

export function buildRuntimeRegOptions(items = [], drTypeId, drId) {
  const device = findRuntimeCatalogDevice(items, drId, drTypeId);
  return Array.isArray(device?.regs)
    ? device.regs.map((item) => ({
      id: normalizeOptionalText(item?.id) || "0",
      label: normalizeOptionalText(item?.label) || "未命名测点"
    }))
    : [];
}

export function findRuntimeCatalogDevice(items = [], drId, drTypeId = "") {
  const normalizedDeviceId = normalizeOptionalText(drId);
  const normalizedTypeId = normalizeOptionalText(drTypeId);
  if (!normalizedDeviceId) {
    return null;
  }

  return items.find((item) => {
    if (normalizeOptionalText(item?.id) !== normalizedDeviceId) {
      return false;
    }
    if (!normalizedTypeId) {
      return true;
    }
    return normalizeOptionalText(item?.drTypeId) === normalizedTypeId;
  }) || null;
}

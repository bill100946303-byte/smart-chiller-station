import { constants, publicEncrypt } from "node:crypto";
import fs from "node:fs";
import { buildSourceStatus } from "../services/sourceStatusService.js";

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function finiteNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sumNumbers(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0);
}

function averageNumbers(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function wattsToKw(value) {
  const numeric = finiteNumber(value);
  return numeric == null ? null : numeric / 1000;
}

const BYX_POWER_CATEGORY_ORDER = [
  "chiller_plant",
  "hvac_terminal",
  "lighting",
  "outlet",
  "logistics",
  "weak_current",
  "backup",
  "other"
];

const BYX_POWER_CATEGORY_LABELS = {
  chiller_plant: "冷站动力",
  hvac_terminal: "空调末端",
  lighting: "照明",
  outlet: "插座",
  logistics: "后勤用电",
  weak_current: "弱电/IT",
  backup: "备用/其他",
  other: "未归类"
};

const BYX_POWER_CATEGORY_BY_LABEL = Object.fromEntries(
  Object.entries(BYX_POWER_CATEGORY_LABELS).map(([key, label]) => [label, key])
);

function normalizePowerCategory(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  if (BYX_POWER_CATEGORY_LABELS[text]) {
    return text;
  }
  return BYX_POWER_CATEGORY_BY_LABEL[text] || "";
}

function classifyPowerDevice(rawName) {
  const name = normalizeText(rawName);
  if (!name) {
    return "other";
  }
  if (/冷站|冷机|冷水机|冷冻|冷却|水泵|冷却塔|机房/.test(name)) {
    return "chiller_plant";
  }
  if (/空调|风机盘管|新风|末端/.test(name)) {
    return "hvac_terminal";
  }
  if (/厨房|热水器|茶水|开水|饮水/.test(name)) {
    return "logistics";
  }
  if (/交换机|门禁|弱电|网络|摄像|监控|服务器|机柜/.test(name)) {
    return "weak_current";
  }
  if (/灯|照明|应急/.test(name)) {
    return "lighting";
  }
  if (/插座|墙插|墙面|卡\d|卡位/.test(name)) {
    return "outlet";
  }
  if (/备用/.test(name)) {
    return "backup";
  }
  return "other";
}

function readAssignmentField(raw, ...keys) {
  for (const key of keys) {
    const value = raw?.[key];
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function parseAssignmentPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map((value) => ({ value, key: "" }));
  }
  if (Array.isArray(payload?.assignments)) {
    return payload.assignments.map((value) => ({ value, key: "" }));
  }
  if (payload?.devices && typeof payload.devices === "object" && !Array.isArray(payload.devices)) {
    return Object.entries(payload.devices).map(([key, value]) => ({ value, key }));
  }
  return [];
}

function normalizeAssignmentEntry(raw, key, siteId) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entrySiteId = readAssignmentField(raw, "siteId", "site_id", "站点");
  if (entrySiteId && entrySiteId !== siteId) {
    return null;
  }
  const keyParts = normalizeText(key).split(":");
  const keyDeviceId = keyParts.length > 1 ? keyParts[keyParts.length - 1] : normalizeText(key);
  const keyProjectId = keyParts.length > 1 ? keyParts.slice(0, -1).join(":") : "";
  const projectId = readAssignmentField(raw, "projectId", "project_id", "byxProjectId", "百益信项目ID") || keyProjectId;
  const projectName = readAssignmentField(raw, "projectName", "project_name", "百益信项目");
  const deviceId = readAssignmentField(raw, "deviceId", "device_id", "byxDeviceId", "设备ID", "id") || keyDeviceId;
  const deviceName = readAssignmentField(raw, "deviceName", "device_name", "设备名称");
  if (!deviceId && !deviceName) {
    return null;
  }

  const categoryInput = readAssignmentField(
    raw,
    "category",
    "confirmedCategory",
    "ownerConfirmedCategory",
    "用途",
    "业主确认用途"
  );
  const categoryLabelInput = readAssignmentField(
    raw,
    "categoryLabel",
    "confirmedCategoryLabel",
    "ownerConfirmedCategoryLabel",
    "业主确认用途"
  );
  const normalizedCategory = normalizePowerCategory(categoryInput) || normalizePowerCategory(categoryLabelInput);
  const category = normalizedCategory || (categoryInput || categoryLabelInput ? "other" : "");
  const categoryLabel = categoryLabelInput || BYX_POWER_CATEGORY_LABELS[category] || categoryInput || "";
  const system = readAssignmentField(raw, "system", "ownerConfirmedSystem", "confirmedSystem", "业主确认系统");
  const location = readAssignmentField(raw, "location", "ownerConfirmedLocation", "installLocation", "安装位置");
  const panel = readAssignmentField(raw, "panel", "circuit", "ownerConfirmedPanel", "distributionPanel", "配电箱/回路");
  const fieldNote = readAssignmentField(raw, "fieldNote", "note", "现场备注");
  const updatedAt = readAssignmentField(raw, "updatedAt", "updated_at", "确认时间");
  const explicitStatus = readAssignmentField(raw, "status", "reviewStatus", "复核状态");
  const status = explicitStatus || (categoryLabel || system || location || panel ? "confirmed" : "draft");

  const lookupKeys = new Set();
  if (deviceId) {
    lookupKeys.add(deviceId);
    if (projectId) {
      lookupKeys.add(`${projectId}:${deviceId}`);
    }
  }
  if (deviceName) {
    lookupKeys.add(deviceName);
    if (projectName) {
      lookupKeys.add(`${projectName}:${deviceName}`);
    }
  }

  return {
    projectId,
    projectName,
    deviceId,
    deviceName,
    category,
    categoryLabel,
    system,
    location,
    panel,
    fieldNote,
    updatedAt,
    status,
    lookupKeys: Array.from(lookupKeys).filter(Boolean)
  };
}

function loadByxPowerAssignmentMap(config, siteId) {
  const filePath = normalizeText(config?.byxPowerAssignmentFile);
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      configured: false,
      sourceFile: filePath || null,
      lookup: new Map(),
      entryCount: 0,
      source: {
        key: "byxPowerAssignmentMap",
        endpoint: "local-json-assignment",
        ok: true,
        fallback: false,
        rows: 0,
        interfaceKind: "local-json-assignment",
        message: "BYX power assignment map not configured; using suggested categories"
      }
    };
  }

  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const entries = parseAssignmentPayload(payload)
      .map(({ value, key }) => normalizeAssignmentEntry(value, key, siteId))
      .filter(Boolean);
    const lookup = new Map();
    for (const entry of entries) {
      for (const key of entry.lookupKeys) {
        lookup.set(key, entry);
      }
    }
    return {
      configured: true,
      sourceFile: filePath,
      lookup,
      entryCount: entries.length,
      source: {
        key: "byxPowerAssignmentMap",
        endpoint: "local-json-assignment",
        ok: true,
        fallback: false,
        rows: entries.length,
        interfaceKind: "local-json-assignment",
        message: `BYX power assignment map loaded (${entries.length} confirmed entries)`
      }
    };
  } catch (error) {
    return {
      configured: true,
      sourceFile: filePath,
      lookup: new Map(),
      entryCount: 0,
      source: {
        key: "byxPowerAssignmentMap",
        endpoint: "local-json-assignment",
        ok: false,
        fallback: false,
        rows: 0,
        interfaceKind: "local-json-assignment",
        reasonCode: "assignment_map_invalid",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function findDeviceAssignment(assignmentMap, project, device) {
  const keys = [
    project.projectId && device.deviceId ? `${project.projectId}:${device.deviceId}` : "",
    device.deviceId || "",
    project.projectName && device.deviceName ? `${project.projectName}:${device.deviceName}` : "",
    device.deviceName || ""
  ].filter(Boolean);
  for (const key of keys) {
    const assignment = assignmentMap.lookup.get(key);
    if (assignment) {
      return assignment;
    }
  }
  return null;
}

function applyByxPowerAssignments(projects, assignmentMap) {
  let matchedDeviceCount = 0;
  let confirmedDeviceCount = 0;
  const nextProjects = projects.map((project) => ({
    ...project,
    devices: (project.devices || []).map((device) => {
      const suggestedCategory = device.category || "other";
      const suggestedCategoryLabel = device.categoryLabel || BYX_POWER_CATEGORY_LABELS[suggestedCategory] || BYX_POWER_CATEGORY_LABELS.other;
      const assignment = findDeviceAssignment(assignmentMap, project, device);
      if (!assignment) {
        return {
          ...device,
          suggestedCategory,
          suggestedCategoryLabel,
          assignmentStatus: "unconfirmed",
          ownerConfirmedCategory: "",
          ownerConfirmedCategoryLabel: "",
          ownerConfirmedSystem: "",
          ownerConfirmedLocation: "",
          ownerConfirmedPanel: "",
          assignmentUpdatedAt: "",
          fieldNote: ""
        };
      }
      matchedDeviceCount += 1;
      if (assignment.status === "confirmed") {
        confirmedDeviceCount += 1;
      }
      const category = assignment.category || suggestedCategory;
      const categoryLabel = assignment.categoryLabel || BYX_POWER_CATEGORY_LABELS[category] || suggestedCategoryLabel;
      return {
        ...device,
        suggestedCategory,
        suggestedCategoryLabel,
        category,
        categoryLabel,
        assignmentStatus: assignment.status,
        ownerConfirmedCategory: assignment.category || "",
        ownerConfirmedCategoryLabel: assignment.categoryLabel || "",
        ownerConfirmedSystem: assignment.system || "",
        ownerConfirmedLocation: assignment.location || "",
        ownerConfirmedPanel: assignment.panel || "",
        assignmentUpdatedAt: assignment.updatedAt || "",
        fieldNote: assignment.fieldNote || ""
      };
    })
  }));
  return {
    projects: nextProjects,
    matchedDeviceCount,
    confirmedDeviceCount
  };
}

function buildDeviceDiagnostics(device) {
  const flags = [];
  if (!device.online) {
    flags.push({
      code: "offline",
      level: "warn",
      label: "离线"
    });
  }
  if (Number.isFinite(device.temperatureC) && device.temperatureC >= 55) {
    flags.push({
      code: "high_temperature",
      level: "warn",
      label: "温度偏高"
    });
  }
  if (Number.isFinite(device.leakageCurrentMa) && device.leakageCurrentMa >= 5) {
    flags.push({
      code: "leakage_attention",
      level: "warn",
      label: "漏电流关注"
    });
  }
  if (
    Number.isFinite(device.powerFactor) &&
    Number.isFinite(device.activePowerKw) &&
    device.activePowerKw > 0.02 &&
    device.powerFactor > 0 &&
    device.powerFactor < 0.5
  ) {
    flags.push({
      code: "low_power_factor",
      level: "warn",
      label: "功率因数偏低"
    });
  }
  if (Number.isFinite(device.voltageV) && (device.voltageV < 198 || device.voltageV > 242)) {
    flags.push({
      code: "voltage_out_of_range",
      level: "warn",
      label: "电压越界"
    });
  }
  return flags;
}

function meaningfulPowerFactor(device) {
  if (
    Number.isFinite(device?.powerFactor) &&
    device.powerFactor > 0 &&
    Number.isFinite(device?.activePowerKw) &&
    device.activePowerKw > 0.01
  ) {
    return device.powerFactor;
  }
  return null;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildAssignmentReviewStatus(device) {
  if (device.assignmentStatus === "confirmed") {
    return "owner_confirmed";
  }
  const diagnosticFlags = device.diagnosticFlags || [];
  if (device.category === "other") {
    return "need_category_confirmation";
  }
  if (diagnosticFlags.length > 0) {
    return "need_diagnostic_review";
  }
  if (!Number.isFinite(device.activePowerKw) || !Number.isFinite(device.energyKwh)) {
    return "need_meter_value_check";
  }
  return "ready_for_owner_confirmation";
}

function buildAssignmentReviewLabel(status) {
  if (status === "owner_confirmed") return "已确认";
  if (status === "need_category_confirmation") return "需确认用途";
  if (status === "need_diagnostic_review") return "需复核诊断";
  if (status === "need_meter_value_check") return "需核对电参";
  return "待业主确认";
}

function normalizePublicKey(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  if (text.includes("BEGIN PUBLIC KEY")) {
    return text.replace(/\\n/g, "\n");
  }
  const base64Body = text.replace(/\s+/g, "");
  return `-----BEGIN PUBLIC KEY-----\n${base64Body.match(/.{1,64}/g)?.join("\n") || base64Body}\n-----END PUBLIC KEY-----`;
}

export function buildByxSign(timestampSeconds, publicKey) {
  const normalizedKey = normalizePublicKey(publicKey);
  if (!normalizedKey) {
    throw new Error("BYX public key is not configured");
  }
  const encrypted = publicEncrypt(
    {
      key: normalizedKey,
      padding: constants.RSA_PKCS1_PADDING
    },
    Buffer.from(String(timestampSeconds))
  );
  return encrypted.toString("base64");
}

function buildByxHeaders(config, timestampSeconds = Math.floor(Date.now() / 1000)) {
  return {
    "content-type": "application/x-www-form-urlencoded",
    "byx-app": normalizeText(config.byxPowerApp),
    "byx-t": String(timestampSeconds),
    "byx-sign": buildByxSign(timestampSeconds, config.byxPowerPublicKey)
  };
}

function validateByxConfig(config) {
  const missing = [];
  if (!normalizeText(config.byxPowerBaseUrl)) missing.push("BYX_POWER_BASE_URL");
  if (!normalizeText(config.byxPowerApp)) missing.push("BYX_POWER_APP");
  if (!normalizeText(config.byxPowerPublicKey)) missing.push("BYX_POWER_PUBLIC_KEY");
  if (!normalizeText(config.byxPowerLoginId)) missing.push("BYX_POWER_LOGIN_ID");
  return missing;
}

async function postByxForm(config, path, fields) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config.byxPowerTimeoutMs || 3000));
  try {
    const response = await fetch(`${normalizeText(config.byxPowerBaseUrl)}${path}`, {
      method: "POST",
      headers: buildByxHeaders(config),
      body: new URLSearchParams(fields),
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.message || text || `HTTP ${response.status}`,
        payload
      };
    }
    if (payload?.state === false) {
      return {
        ok: false,
        status: response.status,
        message: payload.message || "BYX API returned state=false",
        payload
      };
    }
    return {
      ok: true,
      status: response.status,
      payload
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildFailedPayload(siteId, generatedAt, reasonCode, message, status = null) {
  return {
    ok: false,
    site: { siteId, siteName: siteId },
    generatedAt,
    provider: "byx",
    mode: "read_only",
    configured: true,
    missingConfig: [],
    summary: {
      projectCount: 0,
      deviceCount: 0,
      onlineDeviceCount: 0,
      offlineDeviceCount: 0,
      totalActivePowerKw: null,
      totalEnergyKwh: null,
      avgPowerFactor: null
    },
    projects: [],
    sourceStatus: buildSourceStatus([
      {
        key: "byxPowerProjectList",
        endpoint: "/Api/Project/List",
        ok: false,
        fallback: false,
        status,
        reasonCode,
        message
      }
    ])
  };
}

function normalizeDevice(raw) {
  const info = raw?.infoBody && typeof raw.infoBody === "object" ? raw.infoBody : {};
  const powerKw = wattsToKw(info.yggl);
  const energyKwh = finiteNumber(info.ygnl ?? info.zydl);
  const status = normalizeText(info.status);
  const switchState = normalizeText(info.state);
  const category = classifyPowerDevice(raw?.deviceName);
  const device = {
    deviceId: normalizeText(raw?.deviceId),
    deviceName: normalizeText(raw?.deviceName),
    deviceTypeName: normalizeText(raw?.deviceTypeName),
    category,
    categoryLabel: BYX_POWER_CATEGORY_LABELS[category] || BYX_POWER_CATEGORY_LABELS.other,
    online: status === "01",
    onlineStatus: status || null,
    switchClosed: switchState === "1",
    switchState: switchState || null,
    currentA: finiteNumber(info.dl),
    voltageV: finiteNumber(info.dy),
    activePowerKw: powerKw == null ? null : round(powerKw, 3),
    energyKwh,
    powerFactor: finiteNumber(info.glys),
    leakageCurrentMa: finiteNumber(info.lddl),
    temperatureC: finiteNumber(info.wd),
    ratedCurrentA: finiteNumber(info.eddl),
    openCloseCount: finiteNumber(info.fhzcs),
    phases: {
      a: {
        currentA: finiteNumber(info.axdl),
        voltageV: finiteNumber(info.axdy),
        powerFactor: finiteNumber(info.axglys),
        activePowerKw: wattsToKw(info.axyggl),
        energyKwh: finiteNumber(info.axygnl ?? info.axydl)
      },
      b: {
        currentA: finiteNumber(info.bxdl),
        voltageV: finiteNumber(info.bxdy),
        powerFactor: finiteNumber(info.bxglys),
        activePowerKw: wattsToKw(info.bxyggl),
        energyKwh: finiteNumber(info.bxygnl ?? info.bxydl)
      },
      c: {
        currentA: finiteNumber(info.cxdl),
        voltageV: finiteNumber(info.cxdy),
        powerFactor: finiteNumber(info.cxglys),
        activePowerKw: wattsToKw(info.cxyggl),
        energyKwh: finiteNumber(info.cxygnl ?? info.cxydl)
      }
    }
  };
  return {
    ...device,
    diagnosticFlags: buildDeviceDiagnostics(device)
  };
}

function normalizeProject(raw) {
  const devices = Array.isArray(raw?.deviceList) ? raw.deviceList.map(normalizeDevice) : [];
  return {
    projectId: normalizeText(raw?.projectId),
    projectName: normalizeText(raw?.projectName),
    devices
  };
}

function summarizeDeviceGroup(category, devices) {
  const onlineDevices = devices.filter((device) => device.online).length;
  const diagnosticDeviceCount = devices.filter((device) => (device.diagnosticFlags || []).length > 0).length;
  return {
    category,
    label: BYX_POWER_CATEGORY_LABELS[category] || BYX_POWER_CATEGORY_LABELS.other,
    deviceCount: devices.length,
    onlineDeviceCount: onlineDevices,
    offlineDeviceCount: devices.length - onlineDevices,
    diagnosticDeviceCount,
    totalActivePowerKw: round(sumNumbers(devices.map((device) => device.activePowerKw)), 2),
    totalEnergyKwh: round(sumNumbers(devices.map((device) => device.energyKwh)), 2),
    avgPowerFactor: round(averageNumbers(devices.map(meaningfulPowerFactor)), 3),
    maxTemperatureC: round(Math.max(...devices.map((device) => device.temperatureC).filter(Number.isFinite)), 1),
    maxLeakageCurrentMa: round(Math.max(...devices.map((device) => device.leakageCurrentMa).filter(Number.isFinite)), 2)
  };
}

function buildCategorySummaries(devices) {
  const groups = new Map();
  for (const device of devices) {
    const category = device.category || "other";
    const current = groups.get(category) || [];
    current.push(device);
    groups.set(category, current);
  }

  return Array.from(groups.entries())
    .map(([category, categoryDevices]) => summarizeDeviceGroup(category, categoryDevices))
    .sort((left, right) => {
      const powerDelta = (right.totalActivePowerKw || 0) - (left.totalActivePowerKw || 0);
      if (Math.abs(powerDelta) > 0.001) {
        return powerDelta;
      }
      const countDelta = right.deviceCount - left.deviceCount;
      if (countDelta !== 0) {
        return countDelta;
      }
      return BYX_POWER_CATEGORY_ORDER.indexOf(left.category) - BYX_POWER_CATEGORY_ORDER.indexOf(right.category);
    });
}

function summarizeProjects(projects) {
  const devices = projects.flatMap((project) => project.devices || []);
  const onlineDevices = devices.filter((device) => device.online).length;
  const diagnosticDeviceCount = devices.filter((device) => (device.diagnosticFlags || []).length > 0).length;
  return {
    projectCount: projects.length,
    deviceCount: devices.length,
    onlineDeviceCount: onlineDevices,
    offlineDeviceCount: devices.length - onlineDevices,
    diagnosticDeviceCount,
    totalActivePowerKw: round(sumNumbers(devices.map((device) => device.activePowerKw)), 2),
    totalEnergyKwh: round(sumNumbers(devices.map((device) => device.energyKwh)), 2),
    avgPowerFactor: round(averageNumbers(devices.map(meaningfulPowerFactor)), 3),
    categorySummaries: buildCategorySummaries(devices)
  };
}

function buildWaitingConfigPayload(siteId, missing) {
  const generatedAt = new Date().toISOString();
  return {
    ok: false,
    site: { siteId, siteName: siteId },
    generatedAt,
    provider: "byx",
    mode: "read_only",
    configured: false,
    missingConfig: missing,
    summary: {
      projectCount: 0,
      deviceCount: 0,
      onlineDeviceCount: 0,
      offlineDeviceCount: 0,
      totalActivePowerKw: null,
      totalEnergyKwh: null,
      avgPowerFactor: null
    },
    projects: [],
    sourceStatus: buildSourceStatus([
      {
        key: "byxPowerProjectList",
        endpoint: "/Api/Project/List",
        ok: false,
        fallback: false,
        reasonCode: "waiting_config",
        message: `BYX power API config missing: ${missing.join(", ")}`
      }
    ])
  };
}

export async function getByxPowerMonitoring(config, siteId) {
  const missing = validateByxConfig(config);
  if (missing.length > 0) {
    return buildWaitingConfigPayload(siteId, missing);
  }

  const generatedAt = new Date().toISOString();
  let result;
  try {
    result = await postByxForm(config, "/Api/Project/List", {
      loginid: normalizeText(config.byxPowerLoginId)
    });
  } catch (error) {
    const reasonCode = error?.code === "ERR_OSSL_UNSUPPORTED" || /asymmetric key|DECODER|public key/i.test(error?.message || "")
      ? "invalid_signing_key"
      : "request_exception";
    const message = reasonCode === "invalid_signing_key"
      ? "BYX power API public key is invalid or incomplete; please provide the full RSA public key."
      : error?.message || "BYX power API request failed";
    return buildFailedPayload(siteId, generatedAt, reasonCode, message);
  }
  if (!result.ok) {
    return buildFailedPayload(
      siteId,
      generatedAt,
      "upstream_failed",
      result.message || "BYX power API request failed",
      result.status || null
    );
  }
  const rawItems = Array.isArray(result.payload?.data) ? result.payload.data : [];
  const assignmentMap = loadByxPowerAssignmentMap(config, siteId);
  const assignmentResult = applyByxPowerAssignments(rawItems.map(normalizeProject), assignmentMap);
  const projects = assignmentResult.projects;
  return {
    ok: true,
    site: { siteId, siteName: siteId },
    generatedAt,
    provider: "byx",
    mode: "read_only",
    configured: true,
    missingConfig: [],
    summary: summarizeProjects(projects),
    assignmentMap: {
      configured: assignmentMap.configured,
      sourceFile: assignmentMap.sourceFile,
      entryCount: assignmentMap.entryCount,
      matchedDeviceCount: assignmentResult.matchedDeviceCount,
      confirmedDeviceCount: assignmentResult.confirmedDeviceCount
    },
    projects,
    sourceStatus: buildSourceStatus([
      {
        key: "byxPowerProjectList",
        endpoint: "/Api/Project/List",
        ok: true,
        fallback: false,
        rows: projects.length,
        message: "BYX power project list loaded"
      },
      assignmentMap.source
    ])
  };
}

export function buildByxPowerAssignmentRows(powerData) {
  const generatedAt = powerData?.generatedAt || new Date().toISOString();
  const rows = [];
  for (const project of powerData?.projects || []) {
    for (const device of project.devices || []) {
      const reviewStatus = buildAssignmentReviewStatus(device);
      rows.push({
        siteId: powerData?.site?.siteId || "",
        generatedAt,
        projectId: project.projectId || "",
        projectName: project.projectName || "",
        deviceId: device.deviceId || "",
        deviceName: device.deviceName || "",
        deviceTypeName: device.deviceTypeName || "",
        suggestedCategory: device.suggestedCategory || device.category || "other",
        suggestedCategoryLabel: device.suggestedCategoryLabel || device.categoryLabel || BYX_POWER_CATEGORY_LABELS.other,
        reviewStatus,
        reviewLabel: buildAssignmentReviewLabel(reviewStatus),
        ownerConfirmedCategory: device.ownerConfirmedCategoryLabel || "",
        ownerConfirmedSystem: device.ownerConfirmedSystem || "",
        ownerConfirmedLocation: device.ownerConfirmedLocation || "",
        ownerConfirmedPanel: device.ownerConfirmedPanel || "",
        online: device.online ? "online" : "offline",
        switchState: device.switchClosed ? "closed" : "open",
        activePowerKw: Number.isFinite(device.activePowerKw) ? device.activePowerKw : "",
        energyKwh: Number.isFinite(device.energyKwh) ? device.energyKwh : "",
        powerFactor: Number.isFinite(device.powerFactor) ? device.powerFactor : "",
        voltageV: Number.isFinite(device.voltageV) ? device.voltageV : "",
        currentA: Number.isFinite(device.currentA) ? device.currentA : "",
        temperatureC: Number.isFinite(device.temperatureC) ? device.temperatureC : "",
        leakageCurrentMa: Number.isFinite(device.leakageCurrentMa) ? device.leakageCurrentMa : "",
        diagnosticFlags: (device.diagnosticFlags || []).map((flag) => flag.label || flag.code).filter(Boolean).join("、"),
        controlBoundary: "read_only_no_open_close_no_scene_execute",
        fieldNote: device.fieldNote || ""
      });
    }
  }
  return rows.sort((left, right) => {
    const projectCompare = left.projectName.localeCompare(right.projectName, "zh-CN");
    if (projectCompare !== 0) return projectCompare;
    const categoryCompare = left.suggestedCategoryLabel.localeCompare(right.suggestedCategoryLabel, "zh-CN");
    if (categoryCompare !== 0) return categoryCompare;
    return left.deviceName.localeCompare(right.deviceName, "zh-CN");
  });
}

export function buildByxPowerAssignmentCsv(powerData) {
  const columns = [
    ["siteId", "站点"],
    ["generatedAt", "生成时间"],
    ["projectId", "百益信项目ID"],
    ["projectName", "百益信项目"],
    ["deviceId", "设备ID"],
    ["deviceName", "设备名称"],
    ["deviceTypeName", "设备类型"],
    ["suggestedCategoryLabel", "系统建议用途"],
    ["reviewLabel", "复核状态"],
    ["ownerConfirmedCategory", "业主确认用途"],
    ["ownerConfirmedSystem", "业主确认系统"],
    ["ownerConfirmedLocation", "安装位置"],
    ["ownerConfirmedPanel", "配电箱/回路"],
    ["online", "在线状态"],
    ["switchState", "开关状态"],
    ["activePowerKw", "当前功率kW"],
    ["energyKwh", "累计电量kWh"],
    ["powerFactor", "功率因数"],
    ["voltageV", "电压V"],
    ["currentA", "电流A"],
    ["temperatureC", "温度C"],
    ["leakageCurrentMa", "漏电流mA"],
    ["diagnosticFlags", "诊断"],
    ["controlBoundary", "控制边界"],
    ["fieldNote", "现场备注"]
  ];
  const rows = buildByxPowerAssignmentRows(powerData);
  return [
    columns.map(([, label]) => csvCell(label)).join(","),
    ...rows.map((row) => columns.map(([key]) => csvCell(row[key])).join(","))
  ].join("\n");
}

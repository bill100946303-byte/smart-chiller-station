import { getByxPowerMonitoring } from "../adapters/byxPowerAdapter.js";

const DEFAULT_MIN_CONFIRMED = 1;

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function flattenDevices(projects) {
  return (projects || []).flatMap((project) => (project.devices || []).map((device) => ({
    projectId: project.projectId || "",
    projectName: project.projectName || "",
    ...device
  })));
}

function summarizeCategories(devices) {
  const buckets = new Map();
  for (const device of devices) {
    const category = normalizeText(device.category) || "other";
    const label = normalizeText(device.categoryLabel) || category;
    const bucket = buckets.get(category) || {
      category,
      label,
      deviceCount: 0,
      confirmedDeviceCount: 0
    };
    bucket.deviceCount += 1;
    if (device.assignmentStatus === "confirmed") {
      bucket.confirmedDeviceCount += 1;
    }
    buckets.set(category, bucket);
  }
  return Array.from(buckets.values()).sort((left, right) => {
    const confirmedDelta = right.confirmedDeviceCount - left.confirmedDeviceCount;
    if (confirmedDelta !== 0) return confirmedDelta;
    return right.deviceCount - left.deviceCount;
  });
}

function normalizeMinConfirmed(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_MIN_CONFIRMED;
  }
  return Math.max(0, Math.trunc(numeric));
}

function buildBlockingItems({ assignmentMap, deviceCount, confirmedDeviceCount, unmatchedAssignmentCount, minConfirmed }) {
  const items = [];
  if (!assignmentMap?.configured) {
    items.push({
      severity: "blocker",
      key: "assignment_file_missing",
      message: "BYX assignment file is not configured or does not exist"
    });
  }
  if (deviceCount <= 0) {
    items.push({
      severity: "blocker",
      key: "no_live_devices",
      message: "BYX live project list returned no devices"
    });
  }
  if (unmatchedAssignmentCount > 0) {
    items.push({
      severity: "blocker",
      key: "unmatched_assignments",
      message: `${unmatchedAssignmentCount} assignment row(s) did not match current BYX devices`
    });
  }
  if (confirmedDeviceCount < minConfirmed) {
    items.push({
      severity: "blocker",
      key: "confirmed_coverage_too_low",
      message: `Confirmed assignment count ${confirmedDeviceCount} is below minConfirmed=${minConfirmed}`
    });
  }
  return items;
}

export async function checkByxPowerAssignments(config, siteId, options = {}) {
  const assignmentFile = normalizeText(options.assignmentFile) || config.byxPowerAssignmentFile || "";
  const minConfirmed = normalizeMinConfirmed(options.minConfirmed);
  const effectiveConfig = {
    ...config,
    byxPowerAssignmentFile: assignmentFile
  };
  const powerData = await getByxPowerMonitoring(effectiveConfig, siteId);
  if (!powerData.ok) {
    return {
      ok: false,
      siteId,
      generatedAt: new Date().toISOString(),
      mode: "read_only_assignment_check",
      controlMutation: false,
      boundary: "read_only_no_open_close_no_scene_execute",
      reasonCode: "byx_power_unavailable",
      message: "BYX live read-only data is unavailable",
      powerData
    };
  }

  const devices = flattenDevices(powerData.projects);
  const assignmentMap = powerData.assignmentMap || {};
  const confirmedDevices = devices.filter((device) => device.assignmentStatus === "confirmed");
  const matchedDeviceCount = Number(assignmentMap.matchedDeviceCount || 0);
  const entryCount = Number(assignmentMap.entryCount || 0);
  const unmatchedAssignmentCount = Math.max(0, entryCount - matchedDeviceCount);
  const blockingItems = buildBlockingItems({
    assignmentMap,
    deviceCount: devices.length,
    confirmedDeviceCount: confirmedDevices.length,
    unmatchedAssignmentCount,
    minConfirmed
  });

  return {
    ok: blockingItems.length === 0,
    siteId,
    generatedAt: new Date().toISOString(),
    mode: "read_only_assignment_check",
    controlMutation: false,
    boundary: "read_only_no_open_close_no_scene_execute",
    assignmentFile,
    summary: {
      projectCount: powerData.summary?.projectCount || 0,
      deviceCount: devices.length,
      assignmentEntryCount: entryCount,
      matchedDeviceCount,
      confirmedDeviceCount: confirmedDevices.length,
      unconfirmedDeviceCount: Math.max(0, devices.length - confirmedDevices.length),
      unmatchedAssignmentCount,
      minConfirmed
    },
    categorySummary: summarizeCategories(devices),
    blockingItems,
    sampleConfirmedDevices: confirmedDevices.slice(0, 5).map((device) => ({
      projectId: device.projectId,
      projectName: device.projectName,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      category: device.category,
      categoryLabel: device.categoryLabel,
      ownerConfirmedSystem: device.ownerConfirmedSystem,
      ownerConfirmedLocation: device.ownerConfirmedLocation,
      ownerConfirmedPanel: device.ownerConfirmedPanel
    })),
    sourceStatus: powerData.sourceStatus
  };
}

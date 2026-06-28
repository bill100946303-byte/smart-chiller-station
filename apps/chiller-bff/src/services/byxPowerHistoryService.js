import fs from "node:fs";
import path from "node:path";
import { buildSourceStatus } from "./sourceStatusService.js";

const DEFAULT_HISTORY_LIMIT = 72;
const MAX_HISTORY_LIMIT = 1000;

function finiteNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeHistoryLimit(value, fallback = DEFAULT_HISTORY_LIMIT) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.trunc(numeric)));
}

function safeSiteFileName(siteId) {
  const normalized = normalizeText(siteId).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "default";
}

function resolveHistoryDir(config) {
  return normalizeText(config?.byxPowerHistoryDir) || path.resolve(process.cwd(), ".local/byx-power-history");
}

function resolveHistoryFile(config, siteId) {
  return path.join(resolveHistoryDir(config), `${safeSiteFileName(siteId)}.jsonl`);
}

function readHistoryLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return { samples: [], invalidLineCount: 0 };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const samples = [];
  let invalidLineCount = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.capturedAt === "string" && Array.isArray(parsed?.categories)) {
        samples.push(parsed);
      } else {
        invalidLineCount += 1;
      }
    } catch (_error) {
      invalidLineCount += 1;
    }
  }
  return { samples, invalidLineCount };
}

function writeHistoryLines(filePath, samples) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, samples.map((sample) => JSON.stringify(sample)).join("\n") + "\n", "utf8");
}

function sortAndDedupeSamples(samples) {
  const byCapturedAt = new Map();
  for (const sample of samples) {
    byCapturedAt.set(sample.capturedAt, sample);
  }
  return Array.from(byCapturedAt.values()).sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
}

export function buildByxPowerHistorySample(powerData) {
  const summary = powerData?.summary || {};
  const categories = (summary.categorySummaries || []).map((item) => ({
    category: normalizeText(item.category) || normalizeText(item.label) || "other",
    label: normalizeText(item.label) || normalizeText(item.category) || "未归类",
    deviceCount: finiteNumber(item.deviceCount) ?? 0,
    onlineDeviceCount: finiteNumber(item.onlineDeviceCount) ?? 0,
    diagnosticDeviceCount: finiteNumber(item.diagnosticDeviceCount) ?? 0,
    totalActivePowerKw: finiteNumber(item.totalActivePowerKw),
    totalEnergyKwh: finiteNumber(item.totalEnergyKwh),
    avgPowerFactor: finiteNumber(item.avgPowerFactor),
    maxTemperatureC: finiteNumber(item.maxTemperatureC),
    maxLeakageCurrentMa: finiteNumber(item.maxLeakageCurrentMa)
  }));

  return {
    capturedAt: powerData?.generatedAt || new Date().toISOString(),
    siteId: powerData?.site?.siteId || "",
    provider: "byx",
    mode: "read_only_history",
    projectCount: finiteNumber(summary.projectCount) ?? 0,
    deviceCount: finiteNumber(summary.deviceCount) ?? 0,
    onlineDeviceCount: finiteNumber(summary.onlineDeviceCount) ?? 0,
    diagnosticDeviceCount: finiteNumber(summary.diagnosticDeviceCount) ?? 0,
    totalActivePowerKw: finiteNumber(summary.totalActivePowerKw),
    totalEnergyKwh: finiteNumber(summary.totalEnergyKwh),
    avgPowerFactor: finiteNumber(summary.avgPowerFactor),
    categories
  };
}

function buildSeries(samples) {
  const buckets = new Map();
  for (const sample of samples) {
    for (const item of sample.categories || []) {
      const category = normalizeText(item.category) || normalizeText(item.label) || "other";
      const bucket = buckets.get(category) || {
        category,
        label: normalizeText(item.label) || category,
        points: []
      };
      bucket.points.push({
        t: sample.capturedAt,
        v: finiteNumber(item.totalActivePowerKw),
        energyKwh: finiteNumber(item.totalEnergyKwh),
        deviceCount: finiteNumber(item.deviceCount) ?? 0,
        diagnosticDeviceCount: finiteNumber(item.diagnosticDeviceCount) ?? 0
      });
      buckets.set(category, bucket);
    }
  }
  return Array.from(buckets.values()).sort((left, right) => {
    const leftLatest = left.points[left.points.length - 1]?.v ?? 0;
    const rightLatest = right.points[right.points.length - 1]?.v ?? 0;
    return rightLatest - leftLatest;
  });
}

function buildHistoryResponse(config, siteId, samples, invalidLineCount, limit) {
  const limitedSamples = sortAndDedupeSamples(samples).slice(-normalizeHistoryLimit(limit));
  const latest = limitedSamples[limitedSamples.length - 1] || null;
  return {
    ok: true,
    site: { siteId, siteName: siteId },
    generatedAt: new Date().toISOString(),
    provider: "byx",
    mode: "read_only_history",
    summary: {
      sampleCount: limitedSamples.length,
      categoryCount: latest?.categories?.length || 0,
      firstCapturedAt: limitedSamples[0]?.capturedAt || null,
      lastCapturedAt: latest?.capturedAt || null,
      latestTotalActivePowerKw: latest?.totalActivePowerKw ?? null,
      latestOnlineDeviceCount: latest?.onlineDeviceCount ?? null,
      latestDiagnosticDeviceCount: latest?.diagnosticDeviceCount ?? null,
      invalidLineCount,
      retentionLimit: normalizeHistoryLimit(limit)
    },
    samples: limitedSamples,
    series: buildSeries(limitedSamples),
    sourceStatus: buildSourceStatus([
      {
        key: "byxPowerHistory",
        endpoint: "local-file-history",
        ok: true,
        fallback: false,
        rows: limitedSamples.length,
        interfaceKind: "local-file-history",
        message: `BYX power history loaded from local runtime storage (${limitedSamples.length} samples)`
      }
    ])
  };
}

export function getByxPowerHistory(config, siteId, options = {}) {
  const limit = normalizeHistoryLimit(options.limit);
  const filePath = resolveHistoryFile(config, siteId);
  const { samples, invalidLineCount } = readHistoryLines(filePath);
  return buildHistoryResponse(config, siteId, samples, invalidLineCount, limit);
}

export function appendByxPowerHistorySnapshot(config, siteId, powerData, options = {}) {
  const limit = normalizeHistoryLimit(options.limit, MAX_HISTORY_LIMIT);
  const filePath = resolveHistoryFile(config, siteId);
  const { samples, invalidLineCount } = readHistoryLines(filePath);
  const sample = buildByxPowerHistorySample(powerData);
  const nextSamples = sortAndDedupeSamples([...samples, sample]).slice(-limit);
  writeHistoryLines(filePath, nextSamples);
  return buildHistoryResponse(config, siteId, nextSamples, invalidLineCount, options.responseLimit || DEFAULT_HISTORY_LIMIT);
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as baseConfig } from "../src/config.js";
import { resolveSiteRuntimeConfig } from "../src/lib/site-runtime-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const BFF_BASE_URL = normalizeText(process.env.BFF_BASE_URL) || "http://127.0.0.1:8787";
const SAMPLE_LIMIT = parsePositiveInteger(process.env.OPTIMIZE_DEMO_CHILLER_SAMPLING_LIMIT, 1000);
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_CHILLER_SAMPLING_STRICT).toLowerCase()
);

const OUTPUT_JSON =
  normalizeText(process.env.OPTIMIZE_DEMO_CHILLER_SAMPLING_PLAN_JSON) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-chiller-sampling-plan-latest.json");
const OUTPUT_MD =
  normalizeText(process.env.OPTIMIZE_DEMO_CHILLER_SAMPLING_PLAN_MD) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-chiller-sampling-plan-latest.md");

const MIN_SAMPLE_COUNT = 30;
const HIGH_CONFIDENCE_SAMPLE_COUNT = 100;
const MIN_CURRENT_RUN_MINUTES = 90;
const SAMPLE_INTERVAL_MINUTES = 5;
const MIN_CAPACITY_RESERVE_PCT = 12;
const RT_TO_KW = 3.5168525;

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(normalizeText(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value, digits = 1) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function combinationKey(combination) {
  if (!Array.isArray(combination)) {
    return "";
  }
  return combination
    .map((item) => normalizeText(String(item)).toUpperCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join("+");
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pushUnique(list, value) {
  const text = normalizeText(value);
  if (text && !list.includes(text)) {
    list.push(text);
  }
}

function readSiteConfig() {
  return resolveSiteRuntimeConfig(baseConfig, null, SITE_ID) || baseConfig;
}

function sumCapacityKw(combination, inventory) {
  if (!Array.isArray(combination) || !combination.length) {
    return null;
  }
  let total = 0;
  for (const id of combination) {
    const chiller = inventory.get(normalizeText(id).toUpperCase());
    const capacity = asFiniteNumber(chiller?.ratedCapacityKw);
    if (capacity === null) {
      return null;
    }
    total += capacity;
  }
  return round(total, 1);
}

function normalizeInventory(chillerStaging) {
  const inventory = new Map();
  for (const item of Array.isArray(chillerStaging?.chillers) ? chillerStaging.chillers : []) {
    const id = normalizeText(item?.id).toUpperCase();
    if (!id) {
      continue;
    }
    inventory.set(id, {
      id,
      label: normalizeText(item?.label) || id,
      generation: normalizeText(item?.generation) || null,
      conditionLevel: normalizeText(item?.conditionLevel) || null,
      conditionNote: normalizeText(item?.conditionNote) || null,
      ratedCapacityRt: asFiniteNumber(item?.ratedCapacityRt),
      ratedCapacityKw: asFiniteNumber(item?.ratedCapacityKw),
      maxPracticalCapacityRt: asFiniteNumber(item?.maxPracticalCapacityRt),
      available: item?.available !== false && item?.lockedByOperator !== true,
      lockedByOperator: item?.lockedByOperator === true
    });
  }
  const capacityMap =
    chillerStaging?.chillerCapacityKw && typeof chillerStaging.chillerCapacityKw === "object"
      ? chillerStaging.chillerCapacityKw
      : {};
  for (const [rawId, rawCapacity] of Object.entries(capacityMap)) {
    const id = normalizeText(rawId).toUpperCase();
    if (!id) {
      continue;
    }
    const existing = inventory.get(id) || { id, label: id };
    inventory.set(id, {
      ...existing,
      ratedCapacityKw: asFiniteNumber(rawCapacity) ?? existing.ratedCapacityKw ?? null,
      ratedCapacityRt:
        existing.ratedCapacityRt ?? (asFiniteNumber(rawCapacity) !== null ? round(rawCapacity / RT_TO_KW, 0) : null)
    });
  }
  return inventory;
}

function normalizeCandidateCombinations(chillerStaging) {
  return (Array.isArray(chillerStaging?.candidateCombinations) ? chillerStaging.candidateCombinations : [])
    .map((combination) => (Array.isArray(combination) ? combination : []))
    .map((combination) => combination.map((item) => normalizeText(String(item)).toUpperCase()).filter(Boolean))
    .filter((combination) => combination.length > 0)
    .filter((combination, index, all) => all.findIndex((item) => combinationKey(item) === combinationKey(combination)) === index);
}

function buildSampleUrl() {
  const base = BFF_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/chiller-staging/samples`, base);
  url.searchParams.set("limit", String(SAMPLE_LIMIT));
  return url.toString();
}

async function fetchSamples(blockers) {
  const url = buildSampleUrl();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      pushUnique(blockers, `样本接口返回非 JSON：HTTP ${response.status}`);
      return {
        url,
        ok: false,
        status: response.status,
        total: 0,
        items: []
      };
    }
    if (!response.ok) {
      pushUnique(blockers, `样本接口 HTTP ${response.status}`);
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      total: Number(payload?.total) || 0,
      basis: payload?.basis || null,
      generatedAt: payload?.generatedAt || null,
      items: Array.isArray(payload?.items) ? payload.items : []
    };
  } catch (error) {
    pushUnique(blockers, `样本接口不可读：${error instanceof Error ? error.message : String(error)}`);
    return {
      url,
      ok: false,
      status: null,
      total: 0,
      items: []
    };
  }
}

function normalizeSample(item) {
  const combination = Array.isArray(item?.combination)
    ? item.combination.map((value) => normalizeText(String(value)).toUpperCase()).filter(Boolean)
    : [];
  const key = normalizeText(item?.combinationKey) || combinationKey(combination);
  const loadKw = asFiniteNumber(item?.loadKw);
  const stationPowerKw = asFiniteNumber(item?.stationPowerKw);
  const chillerPowerKw = asFiniteNumber(item?.chillerPowerKw);
  const stationCop = asFiniteNumber(item?.stationCop);
  const comboCop = asFiniteNumber(item?.comboCop);
  const alarmCount = asFiniteNumber(item?.alarmCount) ?? 0;
  const capturedAt = normalizeText(item?.capturedAt);
  const valid =
    key &&
    loadKw !== null &&
    stationPowerKw !== null &&
    stationPowerKw > 0 &&
    stationCop !== null &&
    stationCop > 0 &&
    alarmCount === 0;
  return {
    key,
    combination,
    capturedAt,
    loadKw,
    loadRatePct: asFiniteNumber(item?.loadRatePct),
    wetBulbC: asFiniteNumber(item?.wetBulbC),
    chilledSupplyTempC: asFiniteNumber(item?.chilledSupplyTempC),
    stationPowerKw,
    chillerPowerKw,
    stationCop,
    comboCop,
    kwPerRt: asFiniteNumber(item?.kwPerRt),
    sampleMinutes: asFiniteNumber(item?.sampleMinutes) ?? SAMPLE_INTERVAL_MINUTES,
    alarmCount,
    valid,
    warning:
      stationCop !== null && (stationCop < 1.5 || stationCop > 12)
        ? "COP/负荷口径异常，比较前需按同工况 band 和数据质量过滤。"
        : null
  };
}

function range(values, digits = 1) {
  const finite = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) {
    return {
      min: null,
      max: null
    };
  }
  return {
    min: round(Math.min(...finite), digits),
    max: round(Math.max(...finite), digits)
  };
}

function summarizeSamples(samples) {
  const groups = new Map();
  for (const sample of samples) {
    const existing = groups.get(sample.key) || {
      combinationKey: sample.key,
      combination: sample.combination,
      sampleCount: 0,
      validSampleCount: 0,
      sampleMinutes: 0,
      firstCapturedAt: null,
      latestCapturedAt: null,
      loadRatePctValues: [],
      wetBulbCValues: [],
      stationCopValues: [],
      comboCopValues: [],
      warnings: []
    };
    existing.sampleCount += 1;
    existing.validSampleCount += sample.valid ? 1 : 0;
    existing.sampleMinutes += sample.sampleMinutes || 0;
    existing.firstCapturedAt =
      !existing.firstCapturedAt || (sample.capturedAt && sample.capturedAt < existing.firstCapturedAt)
        ? sample.capturedAt
        : existing.firstCapturedAt;
    existing.latestCapturedAt =
      !existing.latestCapturedAt || (sample.capturedAt && sample.capturedAt > existing.latestCapturedAt)
        ? sample.capturedAt
        : existing.latestCapturedAt;
    if (sample.loadRatePct !== null) {
      existing.loadRatePctValues.push(sample.loadRatePct);
    }
    if (sample.wetBulbC !== null) {
      existing.wetBulbCValues.push(sample.wetBulbC);
    }
    if (sample.stationCop !== null) {
      existing.stationCopValues.push(sample.stationCop);
    }
    if (sample.comboCop !== null) {
      existing.comboCopValues.push(sample.comboCop);
    }
    pushUnique(existing.warnings, sample.warning);
    groups.set(sample.key, existing);
  }
  return [...groups.values()].map((group) => {
    const sampleCount = group.validSampleCount;
    return {
      combinationKey: group.combinationKey,
      combination: group.combination,
      sampleCount: group.sampleCount,
      validSampleCount: group.validSampleCount,
      sampleMinutes: round(group.sampleMinutes, 1),
      firstCapturedAt: group.firstCapturedAt,
      latestCapturedAt: group.latestCapturedAt,
      confidence:
        sampleCount >= HIGH_CONFIDENCE_SAMPLE_COUNT
          ? "high"
          : sampleCount >= MIN_SAMPLE_COUNT
            ? "low_ready"
            : "insufficient",
      deficitToMin: Math.max(0, MIN_SAMPLE_COUNT - sampleCount),
      deficitToHigh: Math.max(0, HIGH_CONFIDENCE_SAMPLE_COUNT - sampleCount),
      loadRatePctRange: range(group.loadRatePctValues, 1),
      wetBulbCRange: range(group.wetBulbCValues, 1),
      stationCopRange: range(group.stationCopValues, 2),
      comboCopRange: range(group.comboCopValues, 2),
      warnings: group.warnings
    };
  });
}

function buildCandidatePlan(candidateCombinations, inventory, sampleGroups) {
  const sampleByKey = new Map(sampleGroups.map((group) => [group.combinationKey, group]));
  return candidateCombinations.map((combination, index) => {
    const key = combinationKey(combination);
    const sample = sampleByKey.get(key) || null;
    const unavailable = combination
      .map((id) => inventory.get(id))
      .filter((item) => item && item.available === false)
      .map((item) => item.id);
    return {
      priority: index === 0 ? "P0-baseline" : index <= 2 ? "P0-compare" : "P1-coverage",
      combinationKey: key,
      combination,
      capacityKw: sumCapacityKw(combination, inventory),
      sampleCount: sample?.sampleCount ?? 0,
      validSampleCount: sample?.validSampleCount ?? 0,
      sampleMinutes: sample?.sampleMinutes ?? 0,
      confidence: sample?.confidence || "insufficient",
      deficitToMin: sample?.deficitToMin ?? MIN_SAMPLE_COUNT,
      deficitToHigh: sample?.deficitToHigh ?? HIGH_CONFIDENCE_SAMPLE_COUNT,
      latestCapturedAt: sample?.latestCapturedAt || null,
      loadRatePctRange: sample?.loadRatePctRange || { min: null, max: null },
      wetBulbCRange: sample?.wetBulbCRange || { min: null, max: null },
      stationCopRange: sample?.stationCopRange || { min: null, max: null },
      comboCopRange: sample?.comboCopRange || { min: null, max: null },
      availableForPlan: unavailable.length === 0,
      unavailableChillerIds: unavailable,
      warnings: sample?.warnings || []
    };
  });
}

function buildReport({ siteConfig, sampleResponse, blockers }) {
  const chillerStaging = siteConfig?.chillerStaging || {};
  const inventory = normalizeInventory(chillerStaging);
  const candidateCombinations = normalizeCandidateCombinations(chillerStaging);
  if (!candidateCombinations.length) {
    pushUnique(blockers, "未配置候选主机组合，无法形成采样计划。");
  }
  if (!inventory.size) {
    pushUnique(blockers, "未配置主机库存和额定容量，无法校验容量边界。");
  }

  const samples = (sampleResponse.items || []).map(normalizeSample).filter((sample) => sample.key);
  const sampleGroups = summarizeSamples(samples);
  const candidatePlan = buildCandidatePlan(candidateCombinations, inventory, sampleGroups);
  const coveredCandidates = candidatePlan.filter((item) => item.validSampleCount > 0);
  const lowReadyCandidates = candidatePlan.filter((item) => item.validSampleCount >= MIN_SAMPLE_COUNT);
  const highConfidenceCandidates = candidatePlan.filter((item) => item.validSampleCount >= HIGH_CONFIDENCE_SAMPLE_COUNT);
  const compareReadyCandidates = candidatePlan.filter((item) => item.priority !== "P0-baseline" && item.validSampleCount >= MIN_SAMPLE_COUNT);
  const missingMinCandidates = candidatePlan.filter((item) => item.validSampleCount < MIN_SAMPLE_COUNT);
  const unavailableCandidates = candidatePlan.filter((item) => !item.availableForPlan);
  const warnings = [];

  if (coveredCandidates.length === 1) {
    pushUnique(warnings, "当前只有一个候选组合有样本，不能做组合间节能排序。");
  }
  if (!compareReadyCandidates.length) {
    pushUnique(warnings, "缺少达到 30 条的候选对比组合，主机组合 Advisor 仍应保持 keep/continue sampling。");
  }
  if (highConfidenceCandidates.length > 0 && compareReadyCandidates.length === 0) {
    pushUnique(warnings, "当前基线组合可能已达到高置信，但目标组合样本不足，不能单边承诺切换收益。");
  }
  for (const candidate of unavailableCandidates) {
    pushUnique(warnings, `${candidate.combinationKey} 包含不可用主机：${candidate.unavailableChillerIds.join("+")}`);
  }
  for (const candidate of candidatePlan) {
    for (const warning of candidate.warnings) {
      pushUnique(warnings, `${candidate.combinationKey}: ${warning}`);
    }
  }

  const finalDecision = blockers.length
    ? "CHILLER_SAMPLING_PLAN_BLOCKED"
    : "CHILLER_SAMPLING_PLAN_READY_TO_COLLECT";
  const coverageStatus =
    compareReadyCandidates.length > 0
      ? "comparison_candidate_available"
      : highConfidenceCandidates.length > 0
        ? "baseline_high_confidence_only"
        : coveredCandidates.length > 0
          ? "baseline_collection_started"
          : "no_samples";

  return {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    finalDecision,
    coverageStatus,
    basis: "append_only_chiller_staging_sample_governance",
    constraints: {
      minSampleCount: MIN_SAMPLE_COUNT,
      highConfidenceSampleCount: HIGH_CONFIDENCE_SAMPLE_COUNT,
      minCurrentRunMinutes: MIN_CURRENT_RUN_MINUTES,
      minCapacityReservePct: MIN_CAPACITY_RESERVE_PCT,
      sampleIntervalMinutes: SAMPLE_INTERVAL_MINUTES,
      noSingleMachineCopSplit: true,
      noAutoStartStop: true,
      noPlcWrite: true
    },
    sampleSource: {
      endpoint: sampleResponse.url,
      ok: sampleResponse.ok,
      status: sampleResponse.status,
      basis: sampleResponse.basis || null,
      total: sampleResponse.total,
      returnedItems: sampleResponse.items.length,
      generatedAt: sampleResponse.generatedAt || null
    },
    inventory: [...inventory.values()].map((item) => ({
      id: item.id,
      label: item.label,
      generation: item.generation,
      conditionLevel: item.conditionLevel,
      ratedCapacityRt: item.ratedCapacityRt,
      ratedCapacityKw: item.ratedCapacityKw,
      maxPracticalCapacityRt: item.maxPracticalCapacityRt,
      available: item.available,
      lockedByOperator: item.lockedByOperator,
      conditionNote: item.conditionNote
    })),
    summary: {
      candidateCombinationCount: candidatePlan.length,
      coveredCandidateCount: coveredCandidates.length,
      lowReadyCandidateCount: lowReadyCandidates.length,
      highConfidenceCandidateCount: highConfidenceCandidates.length,
      compareReadyCandidateCount: compareReadyCandidates.length,
      missingMinCandidateCount: missingMinCandidates.length,
      totalValidSamples: candidatePlan.reduce((sum, item) => sum + item.validSampleCount, 0)
    },
    candidatePlan,
    nextActions: [
      "继续保留 CH4+CH5+CH7 作为当前基线组合样本，但不要把单一组合样本解释为切换收益。",
      "优先等待或人工安排 CH2+CH5+CH7、CH4+CH7、CH5+CH7 等候选组合的安全运行窗口。",
      "每个候选组合至少达到 30 条同负荷/湿球/供水温 band 样本后，才允许进入组合间排序。",
      "达到 100 条只能说明该组合自身样本高置信；仍需目标组合同工况样本才能承诺切换方向。",
      "所有组合切换仍必须人工执行和 shadow 验证，AI 不自动启停主机。"
    ],
    blockers,
    warnings,
    reportFiles: {
      json: rel(OUTPUT_JSON),
      markdown: rel(OUTPUT_MD)
    }
  };
}

function formatRange(value, unit = "") {
  if (!value || value.min === null || value.max === null) {
    return "--";
  }
  if (value.min === value.max) {
    return `${value.min}${unit}`;
  }
  return `${value.min}-${value.max}${unit}`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 140 主机组合样本采集计划检查");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.finalDecision}\``);
  lines.push("");
  lines.push(`覆盖状态：\`${report.coverageStatus}\``);
  lines.push("");
  lines.push("## 1. 样本覆盖");
  lines.push("");
  lines.push(`样本接口：\`${report.sampleSource.endpoint}\``);
  lines.push("");
  lines.push("| 指标 | 数值 |");
  lines.push("| --- | ---: |");
  lines.push(`| 候选组合数 | ${report.summary.candidateCombinationCount} |`);
  lines.push(`| 已有样本组合数 | ${report.summary.coveredCandidateCount} |`);
  lines.push(`| >=30 条组合数 | ${report.summary.lowReadyCandidateCount} |`);
  lines.push(`| >=100 条组合数 | ${report.summary.highConfidenceCandidateCount} |`);
  lines.push(`| 可对比目标组合数 | ${report.summary.compareReadyCandidateCount} |`);
  lines.push(`| 缺 30 条门槛组合数 | ${report.summary.missingMinCandidateCount} |`);
  lines.push("");
  lines.push("## 2. 候选组合计划");
  lines.push("");
  lines.push("| 优先级 | 组合 | 容量 kW | 有效样本 | 置信 | 距 30 条 | 距 100 条 | 负荷率 | 湿球 | 冷站COP |");
  lines.push("| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- |");
  for (const item of report.candidatePlan) {
    lines.push(
      `| ${item.priority} | \`${item.combinationKey}\` | ${item.capacityKw ?? "--"} | ${item.validSampleCount} | ${item.confidence} | ${item.deficitToMin} | ${item.deficitToHigh} | ${formatRange(item.loadRatePctRange, "%")} | ${formatRange(item.wetBulbCRange, "C")} | ${formatRange(item.stationCopRange)} |`
    );
  }
  lines.push("");
  lines.push("## 3. 主机库存边界");
  lines.push("");
  lines.push("| 主机 | 属性 | 额定RT | 额定kW | 可用 | 备注 |");
  lines.push("| --- | --- | ---: | ---: | --- | --- |");
  for (const item of report.inventory) {
    lines.push(
      `| ${item.id} | ${item.conditionLevel || item.generation || "--"} | ${item.ratedCapacityRt ?? "--"} | ${item.ratedCapacityKw ?? "--"} | ${item.available ? "yes" : "no"} | ${item.conditionNote || "--"} |`
    );
  }
  lines.push("");
  lines.push("## 4. 下一步");
  lines.push("");
  for (const action of report.nextActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("## 5. Blockers / Warnings");
  lines.push("");
  if (report.blockers.length) {
    lines.push("Blockers:");
    for (const item of report.blockers) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("Blockers: 无。");
  }
  lines.push("");
  if (report.warnings.length) {
    lines.push("Warnings:");
    for (const item of report.warnings) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("Warnings: 无。");
  }
  lines.push("");
  lines.push("## 6. 边界");
  lines.push("");
  lines.push("- 本检查只读查询 append-only 样本库，不调用会写样本的 `POST /optimize`。");
  lines.push("- 多机并联无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆单机 COP。");
  lines.push("- 样本计划 READY 不等于切换建议 READY；候选组合缺同工况样本时仍必须 keep/continue sampling。");
  lines.push("- AI 不自动启停主机，不写真实 PLC，不进入 enforced。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const blockers = [];
  const siteConfig = readSiteConfig();
  const sampleResponse = await fetchSamples(blockers);
  const report = buildReport({
    siteConfig,
    sampleResponse,
    blockers
  });
  ensureDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));

  console.log(`optimize-demo 140 chiller sampling plan: ${report.finalDecision}`);
  console.log(
    `coverage=${report.coverageStatus} candidates=${report.summary.candidateCombinationCount} covered=${report.summary.coveredCandidateCount} compareReady=${report.summary.compareReadyCandidateCount} high=${report.summary.highConfidenceCandidateCount}`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`markdown=${OUTPUT_MD}`);
  if (report.blockers.length) {
    console.log(`blockers=${report.blockers.length}`);
    for (const blocker of report.blockers) {
      console.log(`- ${blocker}`);
    }
  }
  if (report.warnings.length) {
    console.log(`warnings=${report.warnings.length}`);
    for (const warning of report.warnings.slice(0, 8)) {
      console.log(`- ${warning}`);
    }
  }
  if (STRICT && report.finalDecision !== "CHILLER_SAMPLING_PLAN_READY_TO_COLLECT") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

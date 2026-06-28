#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const DEFAULT_OUTPUT_DIR = path.resolve(ROOT_DIR, "docs/byx");
const READ_ONLY_BOUNDARY = "read_only_no_open_close_no_scene_execute";

function normalizeText(value) {
  return value == null ? "" : String(value).replace(/^\uFEFF/, "").trim();
}

function parseArgs(argv) {
  const args = {
    siteId: "",
    outputDir: process.env.BYX_POWER_HANDOFF_DIR || DEFAULT_OUTPUT_DIR
  };
  for (const item of argv) {
    if (item.startsWith("--site-id=")) {
      args.siteId = item.slice("--site-id=".length);
    } else if (item.startsWith("--output-dir=")) {
      args.outputDir = item.slice("--output-dir=".length);
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  if (row.length > 1 || normalizeText(row[0])) {
    rows.push(row);
  }
  return rows;
}

function readCsvRecords(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map(normalizeText);
  return rows.slice(1)
    .filter((row) => row.some((value) => normalizeText(value)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeText(row[index])])));
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = normalizeText(row[key]) || "未填写";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function sameCounts(left = {}, right = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Number(left[key] || 0) !== Number(right[key] || 0)) {
      return false;
    }
  }
  return true;
}

function addBlocker(blockingItems, key, message, details = {}) {
  blockingItems.push({
    severity: "blocker",
    key,
    message,
    ...details
  });
}

function expectedFiles(siteId, outputDir) {
  const resolvedOutputDir = path.resolve(outputDir || DEFAULT_OUTPUT_DIR);
  return {
    csv: path.join(resolvedOutputDir, `byx-power-assignment-${siteId}-latest.csv`),
    markdown: path.join(resolvedOutputDir, `byx-power-assignment-${siteId}-handoff.md`),
    summaryJson: path.join(resolvedOutputDir, `byx-power-assignment-${siteId}-summary.json`)
  };
}

export function checkByxPowerAssignmentHandoff(options = {}) {
  const siteId = normalizeText(options.siteId);
  if (!siteId) {
    throw new Error("Missing --site-id=<siteId>");
  }
  const files = expectedFiles(siteId, options.outputDir);
  const blockingItems = [];
  for (const [key, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      addBlocker(blockingItems, `${key}_missing`, `${key} file is missing`, { file: filePath });
    }
  }
  if (blockingItems.length > 0) {
    return {
      ok: false,
      siteId,
      mode: "read_only_assignment_handoff_check",
      controlMutation: false,
      boundary: READ_ONLY_BOUNDARY,
      files,
      summary: null,
      blockingItems
    };
  }

  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(files.summaryJson, "utf8"));
  } catch (error) {
    addBlocker(blockingItems, "summary_json_invalid", error instanceof Error ? error.message : String(error));
    summary = {};
  }
  const csvRecords = readCsvRecords(files.csv);
  const markdown = fs.readFileSync(files.markdown, "utf8");
  const csvBoundaryCounts = countBy(csvRecords, "控制边界");
  const csvReviewStatusCounts = countBy(csvRecords, "复核状态");
  const csvCategoryCounts = countBy(csvRecords, "系统建议用途");
  const expectedDeviceCount = Number(summary?.summary?.deviceCount || 0);

  if (summary?.ok !== true) {
    addBlocker(blockingItems, "summary_not_ok", "summary JSON ok must be true");
  }
  if (summary?.siteId !== siteId) {
    addBlocker(blockingItems, "site_id_mismatch", `summary siteId ${summary?.siteId || ""} does not match ${siteId}`);
  }
  if (summary?.mode !== "read_only_assignment_handoff") {
    addBlocker(blockingItems, "mode_mismatch", "summary mode must be read_only_assignment_handoff");
  }
  if (summary?.controlMutation !== false) {
    addBlocker(blockingItems, "control_mutation_not_false", "summary controlMutation must be false");
  }
  if (summary?.boundary !== READ_ONLY_BOUNDARY) {
    addBlocker(blockingItems, "boundary_mismatch", `summary boundary must be ${READ_ONLY_BOUNDARY}`);
  }
  if (summary?.checks?.allRowsReadOnly !== true) {
    addBlocker(blockingItems, "summary_rows_not_read_only", "summary checks.allRowsReadOnly must be true");
  }
  if (summary?.checks?.openCloseConnected !== false || summary?.checks?.sceneExecuteConnected !== false || summary?.checks?.plcWriteConnected !== false) {
    addBlocker(blockingItems, "write_interface_connected", "summary must keep OpenOrClose, scene execute, and PLC write disconnected");
  }
  if (expectedDeviceCount !== csvRecords.length) {
    addBlocker(blockingItems, "csv_device_count_mismatch", `CSV row count ${csvRecords.length} does not match summary deviceCount ${expectedDeviceCount}`);
  }
  if (!sameCounts(csvBoundaryCounts, summary?.summary?.boundaryCounts)) {
    addBlocker(blockingItems, "boundary_count_mismatch", "CSV boundary counts do not match summary boundaryCounts", {
      csvBoundaryCounts,
      summaryBoundaryCounts: summary?.summary?.boundaryCounts || {}
    });
  }
  if (!sameCounts(csvReviewStatusCounts, summary?.summary?.reviewStatusCounts)) {
    addBlocker(blockingItems, "review_status_count_mismatch", "CSV review status counts do not match summary reviewStatusCounts", {
      csvReviewStatusCounts,
      summaryReviewStatusCounts: summary?.summary?.reviewStatusCounts || {}
    });
  }
  if (!sameCounts(csvCategoryCounts, summary?.summary?.categoryCounts)) {
    addBlocker(blockingItems, "category_count_mismatch", "CSV category counts do not match summary categoryCounts", {
      csvCategoryCounts,
      summaryCategoryCounts: summary?.summary?.categoryCounts || {}
    });
  }
  if (Object.keys(csvBoundaryCounts).length !== 1 || csvBoundaryCounts[READ_ONLY_BOUNDARY] !== csvRecords.length) {
    addBlocker(blockingItems, "csv_boundary_not_read_only", "all CSV rows must keep read_only_no_open_close_no_scene_execute");
  }

  const markdownRequired = [
    "不接分合闸",
    "不接场景执行",
    "不反写 PLC",
    "/Api/OpenOrClose",
    "/Api/Scene/Execute",
    `--site-id=${siteId}`
  ];
  for (const required of markdownRequired) {
    if (!markdown.includes(required)) {
      addBlocker(blockingItems, "markdown_missing_boundary_text", `Markdown missing required text: ${required}`);
    }
  }

  return {
    ok: blockingItems.length === 0,
    siteId,
    generatedAt: new Date().toISOString(),
    mode: "read_only_assignment_handoff_check",
    controlMutation: false,
    boundary: READ_ONLY_BOUNDARY,
    files,
    summary: {
      deviceCount: csvRecords.length,
      expectedDeviceCount,
      boundaryCounts: csvBoundaryCounts,
      reviewStatusCounts: csvReviewStatusCounts,
      categoryCounts: csvCategoryCounts
    },
    blockingItems
  };
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/check-byx-power-assignment-handoff.js --site-id=140 [--output-dir=../../docs/byx]",
    "",
    "Notes:",
    "  - Checks the generated CSV, Markdown handoff, and summary JSON.",
    "  - Does not call BYX, OpenOrClose, scene execution, PLC, or any write API.",
    "  - Exits non-zero when generated handoff files are stale, missing, or not read-only."
  ].join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = checkByxPowerAssignmentHandoff(args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exit(1);
  }
}


#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkByxPowerAssignments as checkByxPowerAssignmentsWithConfig } from "../src/services/byxPowerAssignmentCheckService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const DEFAULT_ASSIGNMENT_FILE = path.resolve(__dirname, "../.local/byx-power-assignments.json");

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function parseEnvValue(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

export function loadLocalEnvDefaults(rootDir = ROOT_DIR) {
  const envFile = path.join(rootDir, "apps/chiller-shell-v1/.env.local");
  if (!fsExists(envFile)) {
    return { loaded: false, envFile };
  }
  const text = fsRead(envFile);
  let loadedCount = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, eqIndex).trim();
    const value = parseEnvValue(normalized.slice(eqIndex + 1));
    if (!process.env[key]) {
      process.env[key] = value;
      loadedCount += 1;
    }
  }
  return { loaded: true, envFile, loadedCount };
}

function fsExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
}

function fsRead(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function buildByxPowerCheckConfigFromEnv() {
  return {
    defaultSiteId: process.env.DEFAULT_SITE_ID || process.env.VITE_SITE_ID || "126lnoffice",
    byxPowerBaseUrl: (process.env.BYX_POWER_BASE_URL || "").replace(/\/+$/, ""),
    byxPowerApp: process.env.BYX_POWER_APP || "",
    byxPowerPublicKey: process.env.BYX_POWER_PUBLIC_KEY || "",
    byxPowerLoginId: process.env.BYX_POWER_LOGIN_ID || "",
    byxPowerTimeoutMs: Number(process.env.BYX_POWER_TIMEOUT_MS || 3000),
    byxPowerAssignmentFile: process.env.BYX_POWER_ASSIGNMENT_FILE || DEFAULT_ASSIGNMENT_FILE
  };
}

function parseArgs(argv) {
  const args = {
    siteId: "",
    assignmentFile: process.env.BYX_POWER_ASSIGNMENT_FILE || DEFAULT_ASSIGNMENT_FILE,
    minConfirmed: 1
  };
  for (const item of argv) {
    if (item.startsWith("--site-id=")) {
      args.siteId = item.slice("--site-id=".length);
    } else if (item.startsWith("--assignment-file=")) {
      args.assignmentFile = item.slice("--assignment-file=".length);
    } else if (item.startsWith("--min-confirmed=")) {
      args.minConfirmed = Number(item.slice("--min-confirmed=".length));
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

export async function checkByxPowerAssignments(options = {}, baseConfig = buildByxPowerCheckConfigFromEnv()) {
  const siteId = normalizeText(options.siteId) || baseConfig.defaultSiteId;
  const assignmentFile = normalizeText(options.assignmentFile) || baseConfig.byxPowerAssignmentFile || DEFAULT_ASSIGNMENT_FILE;
  return checkByxPowerAssignmentsWithConfig({
    ...baseConfig,
    assignmentFile,
    byxPowerAssignmentFile: assignmentFile
  }, siteId, {
    minConfirmed: options.minConfirmed,
    assignmentFile
  });
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/check-byx-power-assignments.js --site-id=140 [--assignment-file=/path/byx-power-assignments.json] [--min-confirmed=1]",
    "",
    "Notes:",
    "  - Reads current BYX devices through /Api/Project/List only.",
    "  - Verifies local assignment JSON coverage and stale rows.",
    "  - Does not call BYX OpenOrClose, scene execution, PLC, or any write API."
  ].join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    loadLocalEnvDefaults();
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const summary = await checkByxPowerAssignments(args);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exit(1);
  }
}

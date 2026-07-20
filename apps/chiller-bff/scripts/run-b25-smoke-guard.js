import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BFF_DIR = path.resolve(ROOT_DIR, "apps/chiller-bff");
const DEFAULT_ROUNDS = 24;
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_OUT_DIR = path.resolve(ROOT_DIR, "docs/b25-smoke-guard");
const DEFAULT_LOG_FILE = path.resolve(ROOT_DIR, "docs/b25-smoke-guard-latest.log");
const DEFAULT_STRICT_UI = true;
const DEFAULT_USE_SUITE = true;
const DEFAULT_APP_BASE_URL = process.env.APP_BASE_URL || "";

function parseNumberOption(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const value = Number(arg.slice(name.length + 3));
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function parseStringOption(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const value = arg.slice(name.length + 3).trim();
  return value ? value : fallback;
}

function parseBooleanOption(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const raw = arg.slice(name.length + 3).trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function appendLog(logFile, message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, line);
  process.stdout.write(line);
}

function runSingleSmoke(outFile, logFile, options) {
  return new Promise((resolve) => {
    const script = options.useSuite
      ? "scripts/check-optimize-smoke-suite.js"
      : "scripts/check-b25-ui-smoke.js";
    const env = {
      ...process.env,
      B25_SMOKE_OUTPUT_PATH: outFile,
      B25_UI_SMOKE_STRICT: options.strictUi ? "1" : "0"
    };
    if (options.appBaseUrl) {
      env.APP_BASE_URL = options.appBaseUrl;
    }

    const child = spawn("node", [script], {
      cwd: BFF_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.on("close", (code) => {
      if (stdout.trim()) {
        appendLog(logFile, `[smoke:stdout] ${stdout.trim()}`);
      }
      if (stderr.trim()) {
        appendLog(logFile, `[smoke:stderr] ${stderr.trim()}`);
      }
      resolve({
        ok: code === 0,
        code: Number(code || 0),
        outFile,
        script
      });
    });
  });
}

async function main() {
  const rounds = parseNumberOption("rounds", DEFAULT_ROUNDS);
  const intervalMinutes = parseNumberOption("interval-minutes", DEFAULT_INTERVAL_MINUTES);
  const outDir = path.resolve(parseStringOption("out-dir", DEFAULT_OUT_DIR));
  const logFile = path.resolve(parseStringOption("log-file", DEFAULT_LOG_FILE));
  const strictUi = parseBooleanOption("strict-ui", DEFAULT_STRICT_UI);
  const useSuite = parseBooleanOption("suite", DEFAULT_USE_SUITE);
  const appBaseUrl = parseStringOption("app-base-url", DEFAULT_APP_BASE_URL);
  const once = hasFlag("once");
  const totalRounds = once ? 1 : rounds;
  const intervalMs = Math.max(1, intervalMinutes) * 60_000;

  fs.mkdirSync(outDir, { recursive: true });
  appendLog(
    logFile,
    `guard started rounds=${totalRounds} intervalMinutes=${intervalMinutes} outDir=${outDir} strictUi=${strictUi} useSuite=${useSuite} appBaseUrl=${appBaseUrl || "auto"}`
  );

  let passed = 0;
  let failed = 0;
  for (let index = 1; index <= totalRounds; index += 1) {
    const fileName = `b25-smoke-${formatStamp()}.json`;
    const outFile = path.resolve(outDir, fileName);
    appendLog(logFile, `round ${index}/${totalRounds} started output=${outFile}`);
    const result = await runSingleSmoke(outFile, logFile, {
      strictUi,
      useSuite,
      appBaseUrl
    });
    if (result.ok) {
      passed += 1;
      appendLog(logFile, `round ${index}/${totalRounds} passed script=${result.script}`);
    } else {
      failed += 1;
      appendLog(logFile, `round ${index}/${totalRounds} failed exit=${result.code} script=${result.script}`);
    }

    if (index < totalRounds) {
      appendLog(logFile, `sleeping ${intervalMinutes} minute(s) before next round`);
      await sleep(intervalMs);
    }
  }

  appendLog(logFile, `guard finished passed=${passed} failed=${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`b25 smoke guard failed: ${message}\n`);
  process.exit(1);
});

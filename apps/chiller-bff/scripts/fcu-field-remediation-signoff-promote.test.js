import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "promote-fcu-field-remediation-signoff-input.js");
const confirmPhrase = "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runNodeScript(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status: status ?? 0, stdout, stderr });
    });
  });
}

function buildFiles(tempDir) {
  return {
    cleanJson: path.join(tempDir, "clean.json"),
    currentCsv: path.join(tempDir, "current.csv"),
    staleCsv: path.join(tempDir, "stale.csv"),
    signoffInput: path.join(tempDir, "signoff-input.csv"),
    outputJson: path.join(tempDir, "promote.json"),
    outputMd: path.join(tempDir, "promote.md")
  };
}

function buildEnv(files, extra = {}) {
  return {
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.cleanJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.signoffInput,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: files.outputMd,
    ...extra
  };
}

function writeCleanFixture(files, currentCsvText = "workOrderId,deviceCode\nFCU-P0-BGS03,BGS03\n") {
  writeText(files.currentCsv, currentCsvText);
  writeText(files.staleCsv, "workOrderId,deviceCode\nFCU-P0-OLD,OLD\n");
  writeJson(files.cleanJson, {
    ok: false,
    summary: {
      currentRows: 1,
      staleRows: 1,
      generatedMissingRows: 0
    },
    outputs: {
      currentCsv: files.currentCsv,
      staleCsv: files.staleCsv
    }
  });
}

test("signoff input promote dry-runs without replacing source when confirm is absent", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-promote-dry-"));
  try {
    const files = buildFiles(tempDir);
    writeCleanFixture(files);
    const original = "workOrderId,deviceCode\nFCU-P0-OLD,OLD\n";
    writeText(files.signoffInput, original);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.mode, "dry_run");
    assert.equal(report.fileMutation, false);
    assert.equal(report.controlMutation, false);
    assert.equal(fs.readFileSync(files.signoffInput, "utf8"), original);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("signoff input promote backs up and replaces source when confirm matches", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-promote-confirm-"));
  try {
    const files = buildFiles(tempDir);
    const current = "workOrderId,deviceCode\nFCU-P0-BGS03,BGS03\n";
    const original = "workOrderId,deviceCode\nFCU-P0-OLD,OLD\n";
    writeCleanFixture(files, current);
    writeText(files.signoffInput, original);

    const result = await runNodeScript(
      buildEnv(files, {
        FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM: confirmPhrase
      })
    );

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.mode, "promote");
    assert.equal(report.fileMutation, true);
    assert.equal(report.promoted.backupWritten, true);
    assert.equal(fs.readFileSync(files.signoffInput, "utf8"), current);
    assert.equal(fs.readFileSync(report.target.backupCsv, "utf8"), original);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("signoff input promote blocks when current csv row count mismatches clean report", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-promote-bad-"));
  try {
    const files = buildFiles(tempDir);
    writeCleanFixture(files, "workOrderId,deviceCode\nFCU-P0-BGS03,BGS03\nFCU-P0-BGS04,BGS04\n");
    writeText(files.signoffInput, "workOrderId,deviceCode\nFCU-P0-OLD,OLD\n");

    const result = await runNodeScript(
      buildEnv(files, {
        FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM: confirmPhrase
      })
    );

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.issues.includes("current_csv_row_count_mismatch"), true);
    assert.equal(report.fileMutation, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-field-remediation-signoff-clean-input.js");

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
    workOrders: path.join(tempDir, "work-orders.json"),
    signoffInput: path.join(tempDir, "signoff-input.csv"),
    outputJson: path.join(tempDir, "clean.json"),
    outputMd: path.join(tempDir, "clean.md"),
    currentCsv: path.join(tempDir, "current.csv"),
    staleCsv: path.join(tempDir, "stale.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.signoffInput,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: files.currentCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: files.staleCsv
  };
}

test("signoff clean input separates current work orders from stale rows without overwriting source", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-clean-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, {
      ok: false,
      siteId: "126lnoffice",
      workOrders: [
        { workOrderId: "FCU-P0-BGS03", priority: "P0", deviceCode: "BGS03", deviceName: "办公室03" },
        { workOrderId: "FCU-P0-BGS04", priority: "P0", deviceCode: "BGS04", deviceName: "办公室04" }
      ]
    });
    const originalInput = [
      "workOrderId,priority,deviceCode,deviceName,handledBy,releaseDecision",
      "FCU-P0-BGS03,P0,BGS03,办公室03,张工,hold",
      "FCU-P0-OLD,P0,OLD,旧设备,旧记录,release",
      ""
    ].join("\n");
    writeText(files.signoffInput, originalInput);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.currentRows, 2);
    assert.equal(report.summary.staleRows, 1);
    assert.equal(report.summary.generatedMissingRows, 1);
    assert.match(fs.readFileSync(files.currentCsv, "utf8"), /FCU-P0-BGS03,P0,BGS03,办公室03,张工,hold/);
    assert.match(fs.readFileSync(files.currentCsv, "utf8"), /FCU-P0-BGS04/);
    assert.doesNotMatch(fs.readFileSync(files.currentCsv, "utf8"), /FCU-P0-OLD/);
    assert.match(fs.readFileSync(files.staleCsv, "utf8"), /FCU-P0-OLD/);
    assert.equal(fs.readFileSync(files.signoffInput, "utf8"), originalInput);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /不覆盖原始现场填写文件/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("signoff clean input passes when there are no stale rows", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-clean-ok-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, {
      ok: false,
      siteId: "126lnoffice",
      workOrders: [{ workOrderId: "FCU-P0-BGS03", priority: "P0", deviceCode: "BGS03", deviceName: "办公室03" }]
    });
    writeText(files.signoffInput, "workOrderId,deviceCode,handledBy\nFCU-P0-BGS03,BGS03,张工\n");

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.staleRows, 0);
    assert.equal(report.summary.currentRows, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

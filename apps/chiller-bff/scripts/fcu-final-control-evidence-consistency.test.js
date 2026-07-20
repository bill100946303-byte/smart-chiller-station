import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "check-fcu-final-control-evidence-consistency.js");

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
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
    runbook: path.join(tempDir, "runbook.json"),
    worklist: path.join(tempDir, "worklist.json"),
    handoff: path.join(tempDir, "handoff.json"),
    signoffClean: path.join(tempDir, "signoff-clean.json"),
    signoff: path.join(tempDir, "signoff.json"),
    returnTemplate: path.join(tempDir, "return-template.json"),
    outputJson: path.join(tempDir, "consistency.json"),
    outputMd: path.join(tempDir, "consistency.md")
  };
}

function buildEnv(files, extra = {}) {
  return {
    FCU_FINAL_CONTROL_RUNBOOK_JSON: files.runbook,
    FCU_FINAL_CONTROL_WORKLIST_JSON: files.worklist,
    FCU_FIELD_HANDOFF_PACK_JSON: files.handoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: files.returnTemplate,
    FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_JSON: files.outputJson,
    FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_MD: files.outputMd,
    FCU_FINAL_CONTROL_EVIDENCE_ALLOW_TMP_OUTPUTS: "true",
    ...extra
  };
}

function writeConsistentFixtures(files, options = {}) {
  const staleRows = options.staleRows ?? 1;
  const completeRows = options.completeRows ?? 0;
  const expectedRows = options.expectedRows ?? 8;
  const openP0Devices = options.openP0Devices ?? 8;
  const outputBase = options.outputBase || path.dirname(files.outputJson);
  writeJson(files.runbook, {
    verdict: "final_dispatch_blocked",
    controlMutation: false,
    dispatch: false,
    summary: {
      finalGatePassed: false,
      canaryReady: false,
      signoffStaleRows: staleRows,
      signoffCompleteRows: completeRows,
      signoffExpectedRows: expectedRows
    }
  });
  writeJson(files.worklist, {
    ok: false,
    controlMutation: false,
    dispatch: false,
    fieldPackages: {
      fieldHandoff: {
        openP0Devices,
        staleSignoffRows: staleRows,
        signoffCompleteRows: completeRows,
        signoffExpectedRows: expectedRows,
        json: files.handoff,
        markdown: path.join(outputBase, "handoff.md"),
        csv: path.join(outputBase, "handoff.csv")
      }
    }
  });
  writeJson(files.handoff, {
    ok: false,
    controlMutation: false,
    dispatch: false,
    summary: {
      openP0Devices,
      staleSignoffRows: staleRows,
      signoffCompleteRows: completeRows,
      signoffExpectedRows: expectedRows
    },
    outputFiles: {
      json: files.handoff,
      markdown: path.join(outputBase, "handoff.md"),
      csv: path.join(outputBase, "handoff.csv"),
      currentOnlyCsv: path.join(outputBase, "current-only.csv"),
      staleCsv: path.join(outputBase, "stale.csv")
    },
    devices: Array.from({ length: openP0Devices }, (_, index) => ({
      deviceCode: `FCU${index + 1}`
    }))
  });
  writeJson(files.signoffClean, {
    ok: false,
    summary: {
      expectedWorkOrders: expectedRows,
      staleRows
    },
    outputs: {
      currentCsv: path.join(outputBase, "current-only.csv"),
      staleCsv: path.join(outputBase, "stale.csv")
    }
  });
  writeJson(files.signoff, {
    ok: false,
    summary: {
      expectedWorkOrders: expectedRows,
      completeRows,
      ignoredRows: staleRows
    },
    outputs: {
      json: files.signoff,
      markdown: path.join(outputBase, "signoff.md")
    }
  });
  writeJson(files.returnTemplate, {
    ok: true,
    summary: {
      deviceCount: expectedRows,
      signoffCompleteRows: completeRows,
      signoffExpectedRows: expectedRows
    },
    sourceFiles: {
      workOrders: path.join(outputBase, "work-orders.json"),
      signoff: files.signoff
    },
    outputs: {
      json: files.returnTemplate,
      markdown: path.join(outputBase, "return-template.md"),
      csv: path.join(outputBase, "return-template.csv")
    }
  });
}

test("final control evidence consistency passes for blocked but aligned evidence", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-evidence-consistency-pass-"));
  try {
    const files = buildFiles(tempDir);
    writeConsistentFixtures(files);
    const result = await runNodeScript(buildEnv(files));
    assert.equal(result.status, 0);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.verdict, "evidence_consistent");
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control evidence consistency fails when stale signoff counts diverge", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-evidence-consistency-stale-"));
  try {
    const files = buildFiles(tempDir);
    writeConsistentFixtures(files);
    const handoff = readJson(files.handoff);
    handoff.summary.staleSignoffRows = 0;
    writeJson(files.handoff, handoff);
    const result = await runNodeScript(buildEnv(files));
    assert.equal(result.status, 2);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.issues.some((item) => item.key === "stale_signoff_rows"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control evidence consistency fails when production evidence points to temp outputs", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-evidence-consistency-temp-"));
  const outputDir = path.join(process.cwd(), "tmp-fcu-evidence-consistency");
  try {
    const files = buildFiles(tempDir);
    writeConsistentFixtures(files, { outputBase: os.tmpdir() });
    const result = await runNodeScript(buildEnv(files, {
      FCU_FINAL_CONTROL_EVIDENCE_ALLOW_TMP_OUTPUTS: "false",
      FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_JSON: path.join(outputDir, "consistency.json"),
      FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_MD: path.join(outputDir, "consistency.md")
    }));
    assert.equal(result.status, 2);
    const report = readJson(path.join(outputDir, "consistency.json"));
    assert.equal(report.issues.some((item) => item.key === "temp_output_path"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

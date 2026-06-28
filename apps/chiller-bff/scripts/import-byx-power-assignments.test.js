import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { importByxPowerAssignments } from "./import-byx-power-assignments.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "import-byx-power-assignments.js");

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "byx-power-assignment-import-"));
  try {
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeCsv(filePath) {
  fs.writeFileSync(filePath, [
    "\uFEFF\"站点\",\"百益信项目ID\",\"百益信项目\",\"设备ID\",\"设备名称\",\"系统建议用途\",\"业主确认用途\",\"业主确认系统\",\"安装位置\",\"配电箱/回路\",\"现场备注\"",
    "\"140\",\"P1\",\"盛世绿能电话厅\",\"D1\",\"办公室灯\",\"照明\",\"后勤用电\",\"办公配电\",\"茶水间\",\"AL-1/05\",\"业主确认，名称不准\"",
    "\"140\",\"P1\",\"盛世绿能电话厅\",\"D2\",\"办公室插座\",\"插座\",\"\",\"\",\"\",\"\",\"\"",
    "\"141\",\"P2\",\"其他项目\",\"D3\",\"其他灯\",\"照明\",\"照明\",\"办公配电\",\"过道\",\"AL-2/01\",\"非本站\""
  ].join("\n"), "utf8");
}

test("importByxPowerAssignments converts owner-confirmed CSV rows into local JSON", () => {
  withTempDir((tempDir) => {
    const input = path.join(tempDir, "assignment.csv");
    const output = path.join(tempDir, "assignments.json");
    writeCsv(input);

    const summary = importByxPowerAssignments({ input, output, siteId: "140" });
    assert.equal(summary.ok, true);
    assert.equal(summary.readRows, 3);
    assert.equal(summary.importedRows, 1);
    assert.equal(summary.outputRows, 1);
    assert.deepEqual(summary.skipped, {
      empty_confirmation: 1,
      site_mismatch: 1
    });

    const payload = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(payload.version, 1);
    assert.equal(payload.assignments.length, 1);
    assert.equal(payload.assignments[0].deviceId, "D1");
    assert.equal(payload.assignments[0].category, "logistics");
    assert.equal(payload.assignments[0].categoryLabel, "后勤用电");
    assert.equal(payload.assignments[0].system, "办公配电");
    assert.equal(payload.assignments[0].note, "业主确认，名称不准");
    assert.equal(payload.assignments[0].status, "confirmed");
  });
});

test("importByxPowerAssignments can include unconfirmed rows as drafts", () => {
  withTempDir((tempDir) => {
    const input = path.join(tempDir, "assignment.csv");
    const output = path.join(tempDir, "assignments.json");
    writeCsv(input);

    const summary = importByxPowerAssignments({ input, output, siteId: "140", includeUnconfirmed: true });
    const payload = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(summary.importedRows, 2);
    assert.equal(payload.assignments.find((item) => item.deviceId === "D2")?.status, "draft");
  });
});

test("importByxPowerAssignments merges existing assignments by device identity", () => {
  withTempDir((tempDir) => {
    const input = path.join(tempDir, "assignment.csv");
    const output = path.join(tempDir, "assignments.json");
    writeCsv(input);
    fs.writeFileSync(output, JSON.stringify({
      version: 1,
      assignments: [
        {
          siteId: "140",
          projectId: "OLD",
          deviceId: "OLD-1",
          deviceName: "旧设备",
          category: "backup",
          status: "confirmed"
        }
      ]
    }), "utf8");

    const summary = importByxPowerAssignments({ input, output, siteId: "140", merge: true });
    const payload = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(summary.outputRows, 2);
    assert.ok(payload.assignments.some((item) => item.deviceId === "OLD-1"));
    assert.ok(payload.assignments.some((item) => item.deviceId === "D1"));
  });
});

test("importByxPowerAssignments rejects unsupported category values", () => {
  withTempDir((tempDir) => {
    const input = path.join(tempDir, "assignment.csv");
    const output = path.join(tempDir, "assignments.json");
    fs.writeFileSync(input, [
      "\"站点\",\"百益信项目ID\",\"百益信项目\",\"设备ID\",\"设备名称\",\"业主确认用途\"",
      "\"140\",\"P1\",\"盛世绿能电话厅\",\"D1\",\"办公室灯\",\"未知用途\""
    ].join("\n"), "utf8");

    assert.throws(
      () => importByxPowerAssignments({ input, output, siteId: "140" }),
      /Unsupported category/
    );
  });
});

test("import-byx-power-assignments CLI prints summary JSON", () => {
  withTempDir((tempDir) => {
    const input = path.join(tempDir, "assignment.csv");
    const output = path.join(tempDir, "assignments.json");
    writeCsv(input);
    const stdout = execFileSync(process.execPath, [
      scriptPath,
      `--input=${input}`,
      `--output=${output}`,
      "--site-id=140"
    ], { encoding: "utf8" });
    const summary = JSON.parse(stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.importedRows, 1);
    assert.equal(fs.existsSync(output), true);
  });
});

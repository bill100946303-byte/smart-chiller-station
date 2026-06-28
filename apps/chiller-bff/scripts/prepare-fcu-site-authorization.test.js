import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createAdminStore } from "../src/lib/admin-db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "prepare-fcu-site-authorization.js");
const siteId = "126lnoffice";

function runScript(env, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: options.cwd || path.resolve(__dirname, ".."),
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
      resolve({
        status: status ?? 0,
        stdout,
        stderr
      });
    });
  });
}

function createTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-site-authorization-"));
  const dbFile = path.join(tempDir, "admin.sqlite");
  const store = createAdminStore({ dbFile });
  store.createSite(
    {
      siteId,
      siteName: "盛世绿能办公楼",
      siteCode: "126OFF",
      status: "active"
    },
    {
      userId: "test",
      username: "test"
    },
    {
      requestId: "test-site"
    }
  );
  store.close?.();
  return { tempDir, dbFile };
}

function activeWindow() {
  const start = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 50 * 60 * 1000).toISOString();
  return { start, end };
}

function baseEnv(dbFile, outputDir) {
  const { start, end } = activeWindow();
  return {
    ADMIN_DB_FILE: dbFile,
    SITE_ID: siteId,
    FCU_SITE_AUTHORIZATION_BY: "业主值班长",
    FCU_COMMISSIONING_OWNER: "平台工程师",
    FCU_BA_OWNER: "BA工程师",
    FCU_SITE_AUTHORIZATION_WINDOW_START: start,
    FCU_SITE_AUTHORIZATION_WINDOW_END: end,
    FCU_BA_WRITE_CONFIRM_ARMED: "true",
    FCU_FINAL_ROLLOUT_CONFIRM_ARMED: "true",
    FCU_SITE_AUTHORIZATION_JSON: path.join(outputDir, "authorization.json"),
    FCU_SITE_AUTHORIZATION_MD: path.join(outputDir, "authorization.md")
  };
}

test("prepare FCU site authorization dry-run does not persist policy", async () => {
  const { tempDir, dbFile } = createTempStore();
  try {
    const env = baseEnv(dbFile, tempDir);
    const result = await runScript(env);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = JSON.parse(fs.readFileSync(env.FCU_SITE_AUTHORIZATION_JSON, "utf8"));
    assert.equal(report.ok, true);
    assert.equal(report.persisted, false);
    assert.equal(report.controlMutation, false);
    assert.equal(report.adminConfigMutation, false);

    const store = createAdminStore({ dbFile });
    try {
      assert.equal(store.getFcuControlPolicy(siteId), null);
    } finally {
      store.close?.();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("prepare FCU site authorization persists only after explicit confirmation", async () => {
  const { tempDir, dbFile } = createTempStore();
  try {
    const env = {
      ...baseEnv(dbFile, tempDir),
      FCU_SITE_AUTHORIZATION_CONFIRM: "I_APPROVE_FCU_SITE_AUTHORIZATION"
    };
    const result = await runScript(env);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = JSON.parse(fs.readFileSync(env.FCU_SITE_AUTHORIZATION_JSON, "utf8"));
    assert.equal(report.ok, true);
    assert.equal(report.persisted, true);
    assert.equal(report.controlMutation, false);
    assert.equal(report.adminConfigMutation, true);

    const store = createAdminStore({ dbFile });
    try {
      const record = store.getFcuControlPolicy(siteId);
      assert.equal(record?.policy?.fieldAuthorization?.siteAuthorizationStatus, "approved");
      assert.equal(record?.policy?.fieldAuthorization?.siteAuthorizationBy, "业主值班长");
      assert.equal(record?.policy?.fieldAuthorization?.commissioningOwner, "平台工程师");
      assert.equal(record?.policy?.fieldAuthorization?.baOwner, "BA工程师");
      assert.equal(record?.policy?.fieldAuthorization?.baWriteConfirmArmed, true);
      assert.equal(record?.policy?.fieldAuthorization?.finalRolloutConfirmArmed, true);
    } finally {
      store.close?.();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("prepare FCU site authorization refuses confirmed persist outside active window", async () => {
  const cases = [
    {
      name: "future",
      start: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      expectedStatus: "授权窗口未开始，禁止写入配置中心"
    },
    {
      name: "expired",
      start: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      end: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expectedStatus: "授权窗口已过期，禁止写入配置中心"
    }
  ];

  for (const item of cases) {
    const { tempDir, dbFile } = createTempStore();
    try {
      const env = {
        ...baseEnv(dbFile, tempDir),
        FCU_SITE_AUTHORIZATION_WINDOW_START: item.start,
        FCU_SITE_AUTHORIZATION_WINDOW_END: item.end,
        FCU_SITE_AUTHORIZATION_CONFIRM: "I_APPROVE_FCU_SITE_AUTHORIZATION"
      };
      const result = await runScript(env);
      assert.equal(result.status, 2, `${item.name}: ${result.stdout || result.stderr}`);
      const report = JSON.parse(fs.readFileSync(env.FCU_SITE_AUTHORIZATION_JSON, "utf8"));
      assert.equal(report.ok, false);
      assert.equal(report.persisted, false);
      assert.equal(report.controlMutation, false);
      assert.equal(report.adminConfigMutation, false);
      assert.equal(report.blockers.some((blocker) => blocker.issue === item.expectedStatus), true);

      const store = createAdminStore({ dbFile });
      try {
        assert.equal(store.getFcuControlPolicy(siteId), null);
      } finally {
        store.close?.();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test("prepare FCU site authorization default output path is stable from repo root cwd", async () => {
  const { tempDir, dbFile } = createTempStore();
  const repoRoot = path.resolve(__dirname, "../../..");
  const defaultJson = path.join(repoRoot, "docs/fcu-site-authorization-latest.json");
  const defaultMd = path.join(repoRoot, "docs/fcu-site-authorization-latest.md");
  const backupJson = fs.existsSync(defaultJson) ? fs.readFileSync(defaultJson) : null;
  const backupMd = fs.existsSync(defaultMd) ? fs.readFileSync(defaultMd) : null;
  const backupJsonStat = fs.existsSync(defaultJson) ? fs.statSync(defaultJson) : null;
  const backupMdStat = fs.existsSync(defaultMd) ? fs.statSync(defaultMd) : null;
  try {
    const env = baseEnv(dbFile, tempDir);
    delete env.FCU_SITE_AUTHORIZATION_JSON;
    delete env.FCU_SITE_AUTHORIZATION_MD;
    const result = await runScript(env, { cwd: repoRoot });
    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, new RegExp(`json=${defaultJson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    const report = JSON.parse(fs.readFileSync(defaultJson, "utf8"));
    assert.equal(report.ok, true);
    assert.equal(report.persisted, false);
    assert.equal(report.controlMutation, false);
  } finally {
    if (backupJson) {
      fs.writeFileSync(defaultJson, backupJson);
      if (backupJsonStat) {
        fs.utimesSync(defaultJson, backupJsonStat.atime, backupJsonStat.mtime);
      }
    } else {
      fs.rmSync(defaultJson, { force: true });
    }
    if (backupMd) {
      fs.writeFileSync(defaultMd, backupMd);
      if (backupMdStat) {
        fs.utimesSync(defaultMd, backupMdStat.atime, backupMdStat.mtime);
      }
    } else {
      fs.rmSync(defaultMd, { force: true });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

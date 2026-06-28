import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const BUILD = normalizeText(process.env.FCU_BUILD) || "1";
const FLOOR = normalizeText(process.env.FCU_FLOOR) || "1";
const TARGET_DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE);
const CANARY_PACKAGE_JSON_DEFAULT =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-execution-package-latest.json");
const OUTPUT_JSON_DEFAULT =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_JSON ||
  path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json");
const OUTPUT_MD_DEFAULT =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_MD ||
  path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.md");
const OUTPUT_CSV_DEFAULT =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_CSV ||
  path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.csv");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function slugifyDeviceCode(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function resolveDevicePath(defaultPath, extension) {
  if (!TARGET_DEVICE_CODE) {
    return defaultPath;
  }
  return defaultPath.replace(/-latest\.[^.]+$/, `-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.${extension}`);
}

const CANARY_PACKAGE_JSON = resolveDevicePath(CANARY_PACKAGE_JSON_DEFAULT, "json");
const OUTPUT_JSON = resolveDevicePath(OUTPUT_JSON_DEFAULT, "json");
const OUTPUT_MD = resolveDevicePath(OUTPUT_MD_DEFAULT, "md");
const OUTPUT_CSV = resolveDevicePath(OUTPUT_CSV_DEFAULT, "csv");

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      path: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      payload: null,
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

async function fetchJson(pathname) {
  const response = await fetch(`${BFF_BASE_URL}${pathname}`);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    payload = { raw: text.slice(0, 500) };
  }
  return {
    ok: response.ok,
    status: response.status,
    url: `${BFF_BASE_URL}${pathname}`,
    payload
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function pushCheck(checks, key, label, ok, severity, evidence, action = "") {
  checks.push({
    key,
    label,
    ok: ok === true,
    severity: severity || "P0",
    evidence: evidence || "",
    action
  });
}

function isValidTemp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 5 && numeric <= 45;
}

function commandMappingReady(command) {
  return Boolean(command?.pointName && command?.tagName && command?.value !== undefined);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU BA 写适配器就绪自检");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- BFF: ${report.bffBaseUrl}`);
  lines.push(`- 目标 FCU: ${report.canary.deviceCode}`);
  lines.push(`- 结论: ${report.verdict}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无，只读自检"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 检查项");
  lines.push("");
  lines.push("| 检查 | 状态 | 级别 | 证据 | 动作 |");
  lines.push("|---|---|---|---|---|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "通过" : "未通过"} | ${check.severity} | ${check.evidence || "--"} | ${check.action || "--"} |`);
  }
  lines.push("");
  lines.push("## 执行边界");
  lines.push("");
  lines.push("- 本脚本不调用 control-cycle dispatch，不写 BA，不写 PLC。");
  lines.push(`- 只有本报告 ok=true 后，才允许进入 ${report.canary.deviceCode} 单台真实写入窗口。`);
  lines.push("- 即使本报告通过，真实写入仍必须由现场授权短语、后端写总闸、单台反馈校验共同约束。");
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const rows = [
    ["key", "label", "ok", "severity", "evidence", "action"],
    ...report.checks.map((check) => [
      check.key,
      check.label,
      check.ok ? "true" : "false",
      check.severity,
      check.evidence,
      check.action
    ])
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
}

async function main() {
  const canaryPackageFile = readJsonFile(CANARY_PACKAGE_JSON);
  const canaryPackage = canaryPackageFile.payload || {};
  const canaryDeviceCode = TARGET_DEVICE_CODE || normalizeText(canaryPackage.canary?.deviceCode) || "BGS01";
  const primaryCommand = canaryPackage.canary?.primaryCommand || null;
  const [health, policyResponse, snapshotResponse] = await Promise.all([
    fetchJson("/healthz"),
    fetchJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-policy`),
    fetchJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`)
  ]);
  const policy = policyResponse.payload?.policy || {};
  const gate = policyResponse.payload?.executionGate || {};
  const snapshotItems = Array.isArray(snapshotResponse.payload?.items) ? snapshotResponse.payload.items : [];
  const canarySnapshot = snapshotItems.find((item) => normalizeText(item.deviceCode) === canaryDeviceCode) || null;
  const checks = [];
  pushCheck(checks, "bff_reachable", "BFF 可访问", health.ok, "P0", `status=${health.status}, ok=${health.payload?.ok}`);
  pushCheck(checks, "backend_write_gate", "后端写入总闸", health.payload?.readOnlyMode === false, "P0", `readOnlyMode=${health.payload?.readOnlyMode}`, "以 READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false 重启 BFF");
  pushCheck(checks, "policy_enforced", "FCU 策略 enforced", policy.enabled === true && policy.defaultMode === "enforced", "P0", `enabled=${policy.enabled}, mode=${policy.defaultMode}`);
  pushCheck(checks, "subsystem_write_enabled", "子系统写总闸", gate.subsystemWriteEnabled === true, "P0", `subsystemWriteEnabled=${gate.subsystemWriteEnabled}, boundary=${gate.boundaryMode}`);
  pushCheck(checks, "adapter_configured", "BA 写适配器已配置", gate.adapterConfigured === true, "P0", `dispatchAdapter=${policy.dispatchAdapter || "none"}`);
  pushCheck(checks, "execution_gate_open", "全局执行闸门", gate.dispatchAllowed === true, "P0", `dispatchAllowed=${gate.dispatchAllowed}, blocked=${(gate.blockedReasons || []).join("/") || "--"}`);
  pushCheck(checks, "whitelist_contains_canary", "白名单包含首台 Canary", (policy.whitelist || []).includes(canaryDeviceCode), "P0", `${canaryDeviceCode} in whitelist=${(policy.whitelist || []).includes(canaryDeviceCode)}`);
  pushCheck(checks, "canary_command_mapping", "Canary 写点映射完整", commandMappingReady(primaryCommand), "P0", `point=${primaryCommand?.pointName || "--"}, tag=${primaryCommand?.tagName || "--"}, value=${primaryCommand?.value ?? "--"}`);
  pushCheck(checks, "canary_snapshot_quality", "Canary 当前快照质量", Boolean(canarySnapshot && canarySnapshot.communicationAlarm !== true && isValidTemp(canarySnapshot.zoneTemperatureC)), "P0", canarySnapshot ? `temp=${canarySnapshot.zoneTemperatureC}, commAlarm=${canarySnapshot.communicationAlarm}` : "snapshot missing");
  pushCheck(checks, "ba_write_confirm", "BA 写入确认短语", normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM) === CONFIRM_PHRASE, "P0", `FCU_SMALL_BATCH_CONFIRM=${normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM) ? "present" : "missing"}`, `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`);
  pushCheck(checks, "final_rollout_confirm", "最终控制总确认短语", normalizeText(process.env.FCU_FINAL_CONTROL_ROLLOUT_CONFIRM) === CONFIRM_PHRASE, "P1", `FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${normalizeText(process.env.FCU_FINAL_CONTROL_ROLLOUT_CONFIRM) ? "present" : "missing"}`, `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE}`);

  const p0Blockers = checks.filter((check) => !check.ok && check.severity === "P0");
  const report = {
    ok: p0Blockers.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    scope: "fcu_ba_write_adapter_readiness",
    verdict: p0Blockers.length === 0 ? "ba_write_adapter_ready" : "ba_write_adapter_blocked",
    controlMutation: false,
    canary: {
      deviceCode: canaryDeviceCode,
      deviceName: canaryPackage.canary?.deviceName || canarySnapshot?.deviceName || canaryDeviceCode,
      command: primaryCommand,
      snapshot: canarySnapshot
        ? {
            zoneTemperatureC: canarySnapshot.zoneTemperatureC ?? null,
            setpointC: canarySnapshot.setpointC ?? null,
            setpointFeedbackC: canarySnapshot.setpointFeedbackC ?? null,
            running: canarySnapshot.running ?? null,
            communicationAlarm: canarySnapshot.communicationAlarm ?? null,
            qualityStatus: canarySnapshot.quality?.status || null
          }
        : null
    },
    checks,
    blockingItems: p0Blockers,
    nextActions: p0Blockers.map((item) => ({
      priority: item.severity,
      action: item.label,
      reason: item.evidence,
      command: item.action
    })),
    evidence: {
      health: { ok: health.ok, status: health.status, readOnlyMode: health.payload?.readOnlyMode },
      policy: { ok: policyResponse.ok, status: policyResponse.status, executionGate: gate },
      snapshot: { ok: snapshotResponse.ok, status: snapshotResponse.status, total: snapshotResponse.payload?.summary?.total || 0 },
      canaryPackage: { ok: canaryPackageFile.ok, path: canaryPackageFile.path, error: canaryPackageFile.error || null }
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    }
  };
  writeReport(report);
  console.log(`FCU_BA_WRITE_ADAPTER_READINESS ok=${report.ok} verdict=${report.verdict} canary=${canaryDeviceCode} blockers=${p0Blockers.length} mutation=false`);
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  console.log(`csv=${OUTPUT_CSV}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});

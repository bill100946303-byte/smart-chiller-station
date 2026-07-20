import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const FIELD_SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const FIELD_CLOSEOUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-closeout-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json");
const BA_ADAPTER_JSON =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_JSON ||
  path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json");
const CANARY_PACKAGE_JSON =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-execution-package-latest.json");
const OUTPUT_JSON =
  process.env.FCU_CANARY_READINESS_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-readiness-latest.json");
const OUTPUT_MD =
  process.env.FCU_CANARY_READINESS_MD ||
  path.resolve(DOCS_DIR, "fcu-canary-readiness-latest.md");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
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
      error: error instanceof Error ? error.message : "read json failed",
      payload: null
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pushGate(gates, gate) {
  gates.push({
    key: gate.key,
    label: gate.label,
    ok: gate.ok === true,
    severity: gate.severity || "P0",
    evidence: gate.evidence || "",
    action: gate.action || ""
  });
}

const GATE_OWNERS = {
  field_signoff_complete: {
    phase: "现场签字",
    owner: "现场/运维",
    sourceKey: "signoff"
  },
  realtime_closeout_ready: {
    phase: "实时消缺",
    owner: "现场/平台",
    sourceKey: "closeout"
  },
  field_arm_ready: {
    phase: "现场授权",
    owner: "现场/BA",
    sourceKey: "fieldArm"
  },
  ba_adapter_ready: {
    phase: "BA写适配器",
    owner: "BA/自控",
    sourceKey: "adapter"
  },
  canary_package_ready: {
    phase: "Canary执行包",
    owner: "平台",
    sourceKey: "canaryPackage"
  },
  no_control_mutation: {
    phase: "安全边界",
    owner: "平台",
    sourceKey: null
  }
};

function buildReadinessPlaybook(gates, evidence) {
  const phasePlan = gates.map((gate) => {
    const meta = GATE_OWNERS[gate.key] || {
      phase: gate.key,
      owner: "平台",
      sourceKey: null
    };
    const source = meta.sourceKey ? evidence[meta.sourceKey] : null;
    return {
      key: gate.key,
      phase: meta.phase,
      owner: meta.owner,
      ready: gate.ok === true,
      blocking: gate.ok !== true,
      severity: gate.severity,
      evidence: gate.evidence,
      sourceFile: source?.path || null,
      sourceReadable: source?.ok === true,
      nextAction: gate.ok === true ? "保持当前证据，继续下一门禁。" : gate.action
    };
  });
  const blockedPhases = phasePlan.filter((item) => item.blocking);
  const firstBlocked = blockedPhases[0] || null;

  return {
    canExecuteCanary: blockedPhases.length === 0,
    readyGateCount: phasePlan.length - blockedPhases.length,
    blockedGateCount: blockedPhases.length,
    firstBlockedPhase: firstBlocked?.phase || null,
    firstBlockedOwner: firstBlocked?.owner || null,
    firstBlockedAction: firstBlocked?.nextAction || null,
    fieldBlocked: blockedPhases.some((item) =>
      ["field_signoff_complete", "realtime_closeout_ready", "field_arm_ready"].includes(item.key)
    ),
    baBlocked: blockedPhases.some((item) => item.key === "ba_adapter_ready"),
    canaryPackageBlocked: blockedPhases.some((item) => item.key === "canary_package_ready"),
    safetyBlocked: blockedPhases.some((item) => item.key === "no_control_mutation"),
    phasePlan,
    safetyBoundary: [
      "readinessPlaybook 只拆解阻断和下一步动作，不放宽任何门禁。",
      "blockedGateCount 不为 0 时，禁止 execute:fcu-canary-dispatch。",
      "controlMutation 必须保持 false，dispatch 必须保持 false。",
      "Canary 只能在现场签字、实时消缺、现场授权、BA写适配器和执行包全部通过后进入。"
    ]
  };
}

function buildReport(files) {
  const signoff = files.signoff.payload || {};
  const closeout = files.closeout.payload || {};
  const fieldArm = files.fieldArm.payload || {};
  const adapter = files.adapter.payload || {};
  const canaryPackage = files.canaryPackage.payload || {};
  const gates = [];

  pushGate(gates, {
    key: "field_signoff_complete",
    label: "现场工单签字完成",
    ok: files.signoff.ok === true && signoff.summary?.signoffComplete === true,
    evidence: `${signoff.summary?.completeRows ?? 0}/${signoff.summary?.expectedWorkOrders ?? "--"} complete`,
    action: "填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff"
  });
  pushGate(gates, {
    key: "realtime_closeout_ready",
    label: "实时消缺关闭",
    ok: files.closeout.ok === true && closeout.summary?.readyForCanary === true,
    evidence: `${closeout.verdict || "missing"} remaining=${closeout.summary?.remainingDeviceCount ?? "--"}`,
    action: "重跑 check:fcu-field-remediation-closeout，必须 field_remediation_ready_for_canary"
  });
  pushGate(gates, {
    key: "field_arm_ready",
    label: "现场 Arm-Check 通过",
    ok: files.fieldArm.ok === true && fieldArm.ok === true && fieldArm.verdict === "field_arm_ready",
    evidence: `${fieldArm.verdict || "missing"} first=${fieldArm.firstCanary || "--"}`,
    action: "重跑 check:fcu-field-arm，现场授权、窗口、确认短语和 readOnly 必须通过"
  });
  pushGate(gates, {
    key: "ba_adapter_ready",
    label: "BA 写适配器通过",
    ok: files.adapter.ok === true && adapter.ok === true && adapter.verdict === "ba_write_adapter_ready",
    evidence: `${adapter.verdict || "missing"} blockers=${Array.isArray(adapter.blockingItems) ? adapter.blockingItems.length : "--"}`,
    action: "重跑 check:fcu-ba-write-adapter-readiness，写点映射、确认短语和执行闸门必须通过"
  });
  pushGate(gates, {
    key: "canary_package_ready",
    label: "首台 Canary 执行包就绪",
    ok:
      files.canaryPackage.ok === true &&
      canaryPackage.ok === true &&
      Array.isArray(canaryPackage.blockers) &&
      canaryPackage.blockers.length === 0,
    evidence: `${canaryPackage.verdict || "missing"} device=${canaryPackage.canary?.deviceCode || "--"}`,
    action: "重跑 build:fcu-canary-execution-package，确保 blockers 为空"
  });
  pushGate(gates, {
    key: "no_control_mutation",
    label: "Readiness 检查无写入副作用",
    ok:
      signoff.controlMutation !== true &&
      closeout.controlMutation !== true &&
      fieldArm.controlMutation !== true &&
      adapter.controlMutation !== true &&
      canaryPackage.controlMutation !== true,
    evidence: "all referenced reports controlMutation=false",
    action: "Readiness 阶段不得调用 execute:* 下发脚本"
  });

  const blockers = gates.filter((gate) => gate.ok !== true);
  const firstCanary =
    canaryPackage.canary?.deviceCode ||
    closeout.summary?.firstCanary ||
    fieldArm.firstCanary ||
    "BGS01";
  const evidence = {
    signoff: { ok: files.signoff.ok, path: files.signoff.path, error: files.signoff.error || null },
    closeout: { ok: files.closeout.ok, path: files.closeout.path, error: files.closeout.error || null },
    fieldArm: { ok: files.fieldArm.ok, path: files.fieldArm.path, error: files.fieldArm.error || null },
    adapter: { ok: files.adapter.ok, path: files.adapter.path, error: files.adapter.error || null },
    canaryPackage: { ok: files.canaryPackage.ok, path: files.canaryPackage.path, error: files.canaryPackage.error || null }
  };
  const readinessPlaybook = buildReadinessPlaybook(gates, evidence);

  return {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: normalizeText(signoff.siteId || closeout.siteId || fieldArm.siteId) || "126lnoffice",
    scope: "fcu_canary_readiness",
    verdict: blockers.length === 0 ? "canary_ready" : "canary_blocked",
    controlMutation: false,
    dispatch: false,
    firstCanary,
    summary: {
      canaryReady: blockers.length === 0,
      gateCount: gates.length,
      blockedCount: blockers.length,
      p0BlockedCount: blockers.filter((gate) => gate.severity === "P0").length
    },
    gates,
    blockers,
    readinessPlaybook,
    nextCommand:
      blockers.length === 0
        ? `FCU_CANARY_DEVICE_CODE=${firstCanary} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
        : "先处理 blockers；禁止执行 execute:fcu-canary-dispatch",
    evidence,
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU Canary Readiness");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 首台 Canary: ${report.firstCanary}`);
  lines.push(`- 结论: ${report.summary.canaryReady ? "可以进入 Canary" : "禁止 Canary"}`);
  lines.push(`- 判定: ${report.verdict}`);
  lines.push(`- 写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 门禁");
  lines.push("");
  lines.push("| 门禁 | 状态 | 证据 | 动作 |");
  lines.push("|---|---|---|---|");
  for (const gate of report.gates) {
    lines.push(`| ${gate.label} | ${gate.ok ? "通过" : "阻断"} | ${gate.evidence || "--"} | ${gate.ok ? "" : gate.action} |`);
  }
  lines.push("");
  lines.push("## Readiness 作战表");
  lines.push("");
  lines.push(`- 可执行 Canary: ${report.readinessPlaybook.canExecuteCanary ? "是" : "否"}`);
  lines.push(`- 通过门禁: ${report.readinessPlaybook.readyGateCount}/${report.summary.gateCount}`);
  lines.push(`- 第一阻断: ${report.readinessPlaybook.firstBlockedPhase || "无"}`);
  lines.push(`- 第一责任: ${report.readinessPlaybook.firstBlockedOwner || "无"}`);
  lines.push(`- 第一动作: ${report.readinessPlaybook.firstBlockedAction || "无"}`);
  lines.push("");
  lines.push("| 阶段 | 责任 | 状态 | 证据 | 来源 | 下一步 |");
  lines.push("|---|---|---|---|---|---|");
  for (const item of report.readinessPlaybook.phasePlan) {
    lines.push(
      `| ${item.phase} | ${item.owner} | ${item.ready ? "通过" : "阻断"} | ${item.evidence || "--"} | ${item.sourceFile || "--"} | ${item.nextAction || "--"} |`
    );
  }
  lines.push("");
  lines.push("## 安全边界");
  lines.push("");
  for (const item of report.readinessPlaybook.safetyBoundary) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push(`- 下一步命令: \`${report.nextCommand}\``);
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

function main() {
  const report = buildReport({
    signoff: readJsonFile(FIELD_SIGNOFF_JSON),
    closeout: readJsonFile(FIELD_CLOSEOUT_JSON),
    fieldArm: readJsonFile(FIELD_ARM_JSON),
    adapter: readJsonFile(BA_ADAPTER_JSON),
    canaryPackage: readJsonFile(CANARY_PACKAGE_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_CANARY_READINESS ok=${report.ok} verdict=${report.verdict} blocked=${report.summary.blockedCount} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}

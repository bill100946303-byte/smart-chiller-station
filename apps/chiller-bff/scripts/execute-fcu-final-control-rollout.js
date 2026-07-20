import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");
const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const FINAL_CONFIRM = normalizeText(process.env.FCU_FINAL_CONTROL_ROLLOUT_CONFIRM);
const SMALL_BATCH_CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM);
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_ROLLOUT_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-rollout-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_ROLLOUT_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-rollout-latest.md");

const SCRIPT_PATHS = {
  smallBatchPlan: path.join(__dirname, "plan-fcu-small-batch-dispatch.js"),
  allDevicePlan: path.join(__dirname, "plan-fcu-all-device-dispatch.js"),
  goLivePreflight: path.join(__dirname, "check-fcu-go-live-preflight.js"),
  fieldArm: path.join(__dirname, "check-fcu-field-arm.js"),
  canaryQueue: path.join(__dirname, "build-fcu-canary-queue.js"),
  finalRunbook: path.join(__dirname, "build-fcu-final-control-runbook.js"),
  canaryPackage: path.join(__dirname, "build-fcu-canary-execution-package.js"),
  baAdapter: path.join(__dirname, "check-fcu-ba-write-adapter-readiness.js"),
  canaryReadiness: path.join(__dirname, "check-fcu-canary-readiness.js"),
  finalGates: path.join(__dirname, "check-fcu-final-control-gates.js"),
  canaryDispatch: path.join(__dirname, "execute-fcu-canary-dispatch.js"),
  smallBatchDispatch: path.join(__dirname, "execute-fcu-small-batch-dispatch.js"),
  allDeviceDispatch: path.join(__dirname, "execute-fcu-all-device-dispatch.js"),
  finalCompletion: path.join(__dirname, "check-fcu-final-control-completion.js"),
  finalWorklist: path.join(__dirname, "build-fcu-final-control-worklist.js")
};

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function runNodeScript(key, extraEnv = {}) {
  const scriptPath = SCRIPT_PATHS[key];
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      BFF_BASE_URL,
      SITE_ID,
      ...extraEnv
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    key,
    scriptPath,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status ?? 0,
    ok: result.status === 0,
    stdout: normalizeText(result.stdout).slice(-4000),
    stderr: normalizeText(result.stderr).slice(-4000)
  };
}

function phaseReport(key, label, result, outputPath = "") {
  return {
    key,
    label,
    ok: result?.ok === true,
    status: result?.status ?? null,
    outputPath,
    stdout: result?.stdout || "",
    stderr: result?.stderr || ""
  };
}

function buildReport(phases, skipped, evidence) {
  const blockers = [];
  if (FINAL_CONFIRM !== CONFIRM_PHRASE) {
    blockers.push({
      key: "final_rollout_confirm_missing",
      label: "最终控制总确认短语",
      message: `必须设置 FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE} 才允许调用真实 Canary/小批量执行脚本。`
    });
  }
  if (SMALL_BATCH_CONFIRM !== CONFIRM_PHRASE) {
    blockers.push({
      key: "small_batch_confirm_missing",
      label: "真实 BA 写入确认短语",
      message: `必须设置 FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}。`
    });
  }
  for (const phase of phases) {
    if (!phase.ok && ["smallBatchPlan", "allDevicePlan", "goLivePreflight", "fieldArm", "canaryReadiness", "finalGates", "allDeviceDispatch", "finalCompletion"].includes(phase.key)) {
      blockers.push({
        key: `${phase.key}_failed`,
        label: phase.label,
        message: `phase exit=${phase.status}`
      });
    }
  }
  const finalCompletion = evidence.finalCompletion || {};
  const finalGates = evidence.finalGates || {};
  const canary = evidence.canaryDispatch || {};
  const smallBatch = evidence.smallBatchExecution || {};
  const allDeviceExecution = evidence.allDeviceExecution || {};
  const controlMutation =
    canary.controlMutation === true ||
    smallBatch.controlMutation === true ||
    allDeviceExecution.controlMutation === true ||
    finalCompletion.controlMutation === true;
  return {
    ok: finalCompletion.ok === true && blockers.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    mode: blockers.length > 0 ? "blocked_or_dry_run" : "rollout_attempted",
    controlMutation,
    confirm: {
      finalRolloutConfirmPresent: FINAL_CONFIRM === CONFIRM_PHRASE,
      smallBatchConfirmPresent: SMALL_BATCH_CONFIRM === CONFIRM_PHRASE
    },
    phases,
    skipped,
    blockers,
    evidence: {
      finalCompletion: finalCompletion
        ? {
            ok: finalCompletion.ok === true,
            verdict: finalCompletion.verdict || null,
            milestones: finalCompletion.milestones || null,
            blockingItems: finalCompletion.blockingItems || []
          }
        : null,
      finalGates: finalGates
        ? {
            ok: finalGates.ok === true,
            summary: finalGates.summary || null,
            blockers: finalGates.blockers || []
          }
        : null,
      canaryDispatch: canary
        ? {
            ok: canary.ok === true,
            mode: canary.mode || null,
            controlMutation: canary.controlMutation === true,
            verification: canary.verification || null
          }
        : null,
      smallBatchExecution: smallBatch
        ? {
            ok: smallBatch.ok === true,
            mode: smallBatch.mode || null,
            controlMutation: smallBatch.controlMutation === true,
            devices: Array.isArray(smallBatch.devices) ? smallBatch.devices.length : 0
          }
        : null,
      allDeviceExecution: allDeviceExecution
        ? {
            ok: allDeviceExecution.ok === true,
            mode: allDeviceExecution.mode || null,
            controlMutation: allDeviceExecution.controlMutation === true,
            waves: Array.isArray(allDeviceExecution.waves) ? allDeviceExecution.waves.length : 0
          }
        : null,
      allDevicePlan: evidence.allDevicePlan
        ? {
            ok: evidence.allDevicePlan.ok === true,
            summary: evidence.allDevicePlan.summary || null,
            firstCanary: evidence.allDevicePlan.firstCanary || null
          }
        : null
    },
    nextActions: buildNextActions(finalCompletion, blockers)
  };
}

function buildNextActions(finalCompletion, blockers) {
  if (finalCompletion?.ok === true) {
    return [
      {
        priority: "P1",
        action: "归档最终控制验收证据",
        reason: "全量 FCU 已反馈确认。"
      }
    ];
  }
  const actions = [];
  if (blockers.some((item) => item.key === "final_rollout_confirm_missing")) {
    actions.push({
      priority: "P0",
      action: "现场授权最终控制总确认",
      command: `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE}`,
      reason: "没有该总确认时编排脚本不会调用真实下发阶段。"
    });
  }
  if (blockers.some((item) => item.key === "small_batch_confirm_missing")) {
    actions.push({
      priority: "P0",
      action: "设置 BA 写入确认短语",
      command: `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`,
      reason: "执行脚本二次确认真实写入。"
    });
  }
  for (const item of finalCompletion?.blockingItems || []) {
    actions.push({
      priority: item.severity || "P0",
      action: item.label || item.key || "处理阻断项",
      reason: item.message || ""
    });
  }
  return actions.slice(0, 8);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制编排结果");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 结论: ${report.ok ? "最终控制完成" : "最终控制未完成"}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 阶段");
  lines.push("");
  lines.push("| 阶段 | 状态 | exit | 产物 |");
  lines.push("|---|---|---:|---|");
  for (const phase of report.phases) {
    lines.push(`| ${phase.label} | ${phase.ok ? "通过" : "未通过"} | ${phase.status ?? "--"} | ${phase.outputPath || "--"} |`);
  }
  for (const phase of report.skipped) {
    lines.push(`| ${phase.label} | 跳过 | -- | ${phase.reason || "--"} |`);
  }
  lines.push("");
  lines.push("## 阻断项");
  lines.push("");
  if (report.blockers.length === 0) {
    lines.push("- 无");
  } else {
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker.key}: ${blocker.message}`);
    }
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  for (const action of report.nextActions) {
    lines.push(`- ${action.priority || "P0"} ${action.action}: ${action.reason || ""}`);
    if (action.command) {
      lines.push(`  - \`${action.command}\``);
    }
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

function defaultSiblingOutput(fileName) {
  return path.join(path.dirname(OUTPUT_JSON), fileName);
}

function childOutputPath(envKey, fileName) {
  return normalizeText(process.env[envKey]) || defaultSiblingOutput(fileName);
}

function buildChildOutputEnv() {
  return {
    FCU_SMALL_BATCH_PLAN_JSON: childOutputPath("FCU_SMALL_BATCH_PLAN_JSON", "fcu-small-batch-dispatch-plan-latest.json"),
    FCU_SMALL_BATCH_PLAN_MD: childOutputPath("FCU_SMALL_BATCH_PLAN_MD", "fcu-small-batch-dispatch-plan-latest.md"),
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: childOutputPath("FCU_ALL_DEVICE_DISPATCH_PLAN_JSON", "fcu-all-device-dispatch-plan-latest.json"),
    FCU_ALL_DEVICE_DISPATCH_PLAN_MD: childOutputPath("FCU_ALL_DEVICE_DISPATCH_PLAN_MD", "fcu-all-device-dispatch-plan-latest.md"),
    FCU_GO_LIVE_PREFLIGHT_JSON: childOutputPath("FCU_GO_LIVE_PREFLIGHT_JSON", "fcu-go-live-preflight-latest.json"),
    FCU_GO_LIVE_PREFLIGHT_MD: childOutputPath("FCU_GO_LIVE_PREFLIGHT_MD", "fcu-go-live-preflight-latest.md"),
    FCU_FIELD_ARM_CHECK_JSON: childOutputPath("FCU_FIELD_ARM_CHECK_JSON", "fcu-field-arm-check-latest.json"),
    FCU_FIELD_ARM_CHECK_MD: childOutputPath("FCU_FIELD_ARM_CHECK_MD", "fcu-field-arm-check-latest.md"),
    FCU_CANARY_QUEUE_JSON: childOutputPath("FCU_CANARY_QUEUE_JSON", "fcu-canary-queue-latest.json"),
    FCU_CANARY_QUEUE_MD: childOutputPath("FCU_CANARY_QUEUE_MD", "fcu-canary-queue-latest.md"),
    FCU_FINAL_CONTROL_RUNBOOK_JSON: childOutputPath("FCU_FINAL_CONTROL_RUNBOOK_JSON", "fcu-final-control-runbook-latest.json"),
    FCU_FINAL_CONTROL_RUNBOOK_MD: childOutputPath("FCU_FINAL_CONTROL_RUNBOOK_MD", "fcu-final-control-runbook-latest.md"),
    FCU_CANARY_EXECUTION_PACKAGE_JSON: childOutputPath("FCU_CANARY_EXECUTION_PACKAGE_JSON", "fcu-canary-execution-package-latest.json"),
    FCU_CANARY_EXECUTION_PACKAGE_MD: childOutputPath("FCU_CANARY_EXECUTION_PACKAGE_MD", "fcu-canary-execution-package-latest.md"),
    FCU_CANARY_EXECUTION_PACKAGE_CSV: childOutputPath("FCU_CANARY_EXECUTION_PACKAGE_CSV", "fcu-canary-execution-package-latest.csv"),
    FCU_BA_WRITE_ADAPTER_READINESS_JSON: childOutputPath("FCU_BA_WRITE_ADAPTER_READINESS_JSON", "fcu-ba-write-adapter-readiness-latest.json"),
    FCU_BA_WRITE_ADAPTER_READINESS_MD: childOutputPath("FCU_BA_WRITE_ADAPTER_READINESS_MD", "fcu-ba-write-adapter-readiness-latest.md"),
    FCU_BA_WRITE_ADAPTER_READINESS_CSV: childOutputPath("FCU_BA_WRITE_ADAPTER_READINESS_CSV", "fcu-ba-write-adapter-readiness-latest.csv"),
    FCU_CANARY_DISPATCH_JSON: childOutputPath("FCU_CANARY_DISPATCH_JSON", "fcu-canary-dispatch-latest.json"),
    FCU_CANARY_DISPATCH_MD: childOutputPath("FCU_CANARY_DISPATCH_MD", "fcu-canary-dispatch-latest.md"),
    FCU_SMALL_BATCH_EXECUTION_JSON: childOutputPath("FCU_SMALL_BATCH_EXECUTION_JSON", "fcu-small-batch-dispatch-execution-latest.json"),
    FCU_SMALL_BATCH_EXECUTION_MD: childOutputPath("FCU_SMALL_BATCH_EXECUTION_MD", "fcu-small-batch-dispatch-execution-latest.md"),
    FCU_ALL_DEVICE_EXECUTION_JSON: childOutputPath("FCU_ALL_DEVICE_EXECUTION_JSON", "fcu-all-device-dispatch-execution-latest.json"),
    FCU_ALL_DEVICE_EXECUTION_MD: childOutputPath("FCU_ALL_DEVICE_EXECUTION_MD", "fcu-all-device-dispatch-execution-latest.md"),
    FCU_FINAL_CONTROL_COMPLETION_JSON: childOutputPath("FCU_FINAL_CONTROL_COMPLETION_JSON", "fcu-final-control-completion-latest.json"),
    FCU_FINAL_CONTROL_COMPLETION_MD: childOutputPath("FCU_FINAL_CONTROL_COMPLETION_MD", "fcu-final-control-completion-latest.md"),
    FCU_FINAL_CONTROL_WORKLIST_JSON: childOutputPath("FCU_FINAL_CONTROL_WORKLIST_JSON", "fcu-final-control-worklist-latest.json"),
    FCU_FINAL_CONTROL_WORKLIST_MD: childOutputPath("FCU_FINAL_CONTROL_WORKLIST_MD", "fcu-final-control-worklist-latest.md"),
    FCU_FINAL_CONTROL_GATES_OUTPUT_DIR: normalizeText(process.env.FCU_FINAL_CONTROL_GATES_OUTPUT_DIR) || path.dirname(OUTPUT_JSON),
    FCU_FINAL_CONTROL_GATES_JSON: childOutputPath("FCU_FINAL_CONTROL_GATES_JSON", "fcu-final-control-gates-latest.json"),
    FCU_FINAL_CONTROL_GATES_MD: childOutputPath("FCU_FINAL_CONTROL_GATES_MD", "fcu-final-control-gates-latest.md"),
    FCU_QUALITY_REMEDIATION_JSON: childOutputPath("FCU_QUALITY_REMEDIATION_JSON", "fcu-quality-remediation-latest.json"),
    FCU_QUALITY_REMEDIATION_MD: childOutputPath("FCU_QUALITY_REMEDIATION_MD", "fcu-quality-remediation-latest.md"),
    FCU_QUALITY_REMEDIATION_CSV: childOutputPath("FCU_QUALITY_REMEDIATION_CSV", "fcu-quality-remediation-latest.csv"),
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: childOutputPath("FCU_FIELD_REMEDIATION_CLOSEOUT_JSON", "fcu-field-remediation-closeout-latest.json"),
    FCU_FIELD_REMEDIATION_CLOSEOUT_MD: childOutputPath("FCU_FIELD_REMEDIATION_CLOSEOUT_MD", "fcu-field-remediation-closeout-latest.md"),
    FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: childOutputPath("FCU_FIELD_REMEDIATION_CLOSEOUT_CSV", "fcu-field-remediation-closeout-latest.csv"),
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: childOutputPath("FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON", "fcu-field-remediation-work-orders-latest.json"),
    FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: childOutputPath("FCU_FIELD_REMEDIATION_WORK_ORDERS_MD", "fcu-field-remediation-work-orders-latest.md"),
    FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: childOutputPath("FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV", "fcu-field-remediation-work-orders-latest.csv"),
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: childOutputPath("FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON", "fcu-field-remediation-execution-pack-latest.json"),
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: childOutputPath("FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD", "fcu-field-remediation-execution-pack-latest.md"),
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: childOutputPath("FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV", "fcu-field-remediation-execution-pack-latest.csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV", "fcu-field-remediation-signoff-input-latest.csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_JSON", "fcu-field-remediation-signoff-latest.json"),
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_MD", "fcu-field-remediation-signoff-latest.md"),
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV", "fcu-field-remediation-signoff-latest.csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON", "fcu-field-remediation-signoff-clean-input-latest.json"),
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD", "fcu-field-remediation-signoff-clean-input-latest.md"),
    FCU_FIELD_REMEDIATION_SIGNOFF_CURRENT_CSV: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_CURRENT_CSV", "fcu-field-remediation-signoff-current-only-latest.csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_STALE_CSV: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_STALE_CSV", "fcu-field-remediation-signoff-stale-rows-latest.csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON", "fcu-field-remediation-signoff-promote-latest.json"),
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: childOutputPath("FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD", "fcu-field-remediation-signoff-promote-latest.md"),
    FCU_CANARY_READINESS_JSON: childOutputPath("FCU_CANARY_READINESS_JSON", "fcu-canary-readiness-latest.json"),
    FCU_CANARY_READINESS_MD: childOutputPath("FCU_CANARY_READINESS_MD", "fcu-canary-readiness-latest.md"),
    FCU_CANARY_FEEDBACK_MONITOR_JSON: childOutputPath("FCU_CANARY_FEEDBACK_MONITOR_JSON", "fcu-canary-feedback-monitor-latest.json"),
    FCU_CANARY_FEEDBACK_MONITOR_MD: childOutputPath("FCU_CANARY_FEEDBACK_MONITOR_MD", "fcu-canary-feedback-monitor-latest.md"),
    FCU_CANARY_FEEDBACK_MONITOR_CSV: childOutputPath("FCU_CANARY_FEEDBACK_MONITOR_CSV", "fcu-canary-feedback-monitor-latest.csv"),
    FCU_CANARY_WINDOW_JSON: childOutputPath("FCU_CANARY_WINDOW_JSON", "fcu-canary-window-latest.json"),
    FCU_CANARY_WINDOW_MD: childOutputPath("FCU_CANARY_WINDOW_MD", "fcu-canary-window-latest.md"),
    FCU_FIELD_ARM_PACKAGE_JSON: childOutputPath("FCU_FIELD_ARM_PACKAGE_JSON", "fcu-field-arm-package-latest.json"),
    FCU_FIELD_ARM_PACKAGE_MD: childOutputPath("FCU_FIELD_ARM_PACKAGE_MD", "fcu-field-arm-package-latest.md"),
    FCU_FIELD_ARM_PACKAGE_CSV: childOutputPath("FCU_FIELD_ARM_PACKAGE_CSV", "fcu-field-arm-package-latest.csv")
  };
}

async function main() {
  const phases = [];
  const skipped = [];
  const childEnv = buildChildOutputEnv();
  phases.push(phaseReport("smallBatchPlan", "生成小批量预演执行单", runNodeScript("smallBatchPlan", childEnv), childEnv.FCU_SMALL_BATCH_PLAN_JSON));
  phases.push(phaseReport("allDevicePlan", "生成全量分批计划", runNodeScript("allDevicePlan", childEnv), childEnv.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON));
  phases.push(phaseReport("goLivePreflight", "上线前预检", runNodeScript("goLivePreflight", childEnv), childEnv.FCU_GO_LIVE_PREFLIGHT_JSON));
  phases.push(phaseReport("canaryQueue", "生成首台 Canary 队列", runNodeScript("canaryQueue", childEnv), childEnv.FCU_CANARY_QUEUE_JSON));
  phases.push(phaseReport("finalRunbook", "生成最终控制 Runbook", runNodeScript("finalRunbook", childEnv), childEnv.FCU_FINAL_CONTROL_RUNBOOK_JSON));
  phases.push(phaseReport("fieldArm", "现场 Arm-Check", runNodeScript("fieldArm", childEnv), childEnv.FCU_FIELD_ARM_CHECK_JSON));
  phases.push(phaseReport("canaryPackage", "生成首台 Canary 执行包", runNodeScript("canaryPackage", childEnv), childEnv.FCU_CANARY_EXECUTION_PACKAGE_JSON));
  phases.push(phaseReport("baAdapter", "BA 写适配器自检", runNodeScript("baAdapter", childEnv), childEnv.FCU_BA_WRITE_ADAPTER_READINESS_JSON));
  phases.push(phaseReport("canaryReadiness", "Canary 总门禁", runNodeScript("canaryReadiness", childEnv), childEnv.FCU_CANARY_READINESS_JSON));
  phases.push(phaseReport("finalGates", "最终控制总门禁", runNodeScript("finalGates", childEnv), childEnv.FCU_FINAL_CONTROL_GATES_JSON));

  const finalGates = readJsonFile(childEnv.FCU_FINAL_CONTROL_GATES_JSON);
  const finalGatesReady = finalGates?.ok === true;
  if (FINAL_CONFIRM === CONFIRM_PHRASE && finalGatesReady) {
    phases.push(phaseReport("canaryDispatch", "执行首台 Canary", runNodeScript("canaryDispatch", childEnv), childEnv.FCU_CANARY_DISPATCH_JSON));
    phases.push(phaseReport("smallBatchDispatch", "执行小批量", runNodeScript("smallBatchDispatch", childEnv), childEnv.FCU_SMALL_BATCH_EXECUTION_JSON));
    phases.push(phaseReport("allDeviceDispatch", "执行全量波次", runNodeScript("allDeviceDispatch", childEnv), childEnv.FCU_ALL_DEVICE_EXECUTION_JSON));
  } else {
    const dispatchSkipReason = FINAL_CONFIRM === CONFIRM_PHRASE ? "final gates not ready" : "missing FCU_FINAL_CONTROL_ROLLOUT_CONFIRM";
    skipped.push({
      key: "canaryDispatch",
      label: "执行首台 Canary",
      reason: dispatchSkipReason
    });
    skipped.push({
      key: "smallBatchDispatch",
      label: "执行小批量",
      reason: dispatchSkipReason
    });
    skipped.push({
      key: "allDeviceDispatch",
      label: "执行全量波次",
      reason: dispatchSkipReason
    });
  }

  phases.push(phaseReport("finalCompletion", "最终控制完成度检查", runNodeScript("finalCompletion", childEnv), childEnv.FCU_FINAL_CONTROL_COMPLETION_JSON));
  const finalWorklistJson = childEnv.FCU_FINAL_CONTROL_WORKLIST_JSON;
  const finalWorklistMd = childEnv.FCU_FINAL_CONTROL_WORKLIST_MD;
  phases.push(phaseReport("finalWorklist", "生成最终控制投运清单", runNodeScript("finalWorklist", {
    ...childEnv,
    FCU_FINAL_CONTROL_WORKLIST_JSON: finalWorklistJson,
    FCU_FINAL_CONTROL_WORKLIST_MD: finalWorklistMd
  }), finalWorklistJson));

  const evidence = {
    finalCompletion: readJsonFile(childEnv.FCU_FINAL_CONTROL_COMPLETION_JSON),
    finalGates,
    finalWorklist: readJsonFile(finalWorklistJson),
    canaryDispatch: readJsonFile(childEnv.FCU_CANARY_DISPATCH_JSON),
    smallBatchExecution: readJsonFile(childEnv.FCU_SMALL_BATCH_EXECUTION_JSON),
    allDeviceExecution: readJsonFile(childEnv.FCU_ALL_DEVICE_EXECUTION_JSON),
    allDevicePlan: readJsonFile(childEnv.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON)
  };
  const report = buildReport(phases, skipped, evidence);
  writeReport(report);
  console.log(`FCU_FINAL_CONTROL_ROLLOUT ok=${report.ok} mode=${report.mode} mutation=${report.controlMutation} blockers=${report.blockers.length}`);
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const REQUESTED_DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE);
const TARGET_DEVICE_CODE = REQUESTED_DEVICE_CODE || "BGS01";
const OUTPUT_JSON_DEFAULT =
  process.env.FCU_CANARY_WINDOW_JSON ||
  path.join(DOCS_DIR, "fcu-canary-window-latest.json");
const OUTPUT_MD_DEFAULT =
  process.env.FCU_CANARY_WINDOW_MD ||
  path.join(DOCS_DIR, "fcu-canary-window-latest.md");

const SCRIPT_PATHS = {
  canaryPackage: path.join(__dirname, "build-fcu-canary-execution-package.js"),
  baReadiness: path.join(__dirname, "check-fcu-ba-write-adapter-readiness.js"),
  canaryDispatch: path.join(__dirname, "execute-fcu-canary-dispatch.js"),
  feedbackMonitor: path.join(__dirname, "check-fcu-canary-feedback-monitor.js"),
  finalCompletion: path.join(__dirname, "check-fcu-final-control-completion.js"),
  finalWorklist: path.join(__dirname, "build-fcu-final-control-worklist.js")
};

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
  if (!REQUESTED_DEVICE_CODE) {
    return defaultPath;
  }
  return defaultPath.replace(/-latest\.[^.]+$/, `-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.${extension}`);
}

const OUTPUT_JSON = resolveDevicePath(OUTPUT_JSON_DEFAULT, "json");
const OUTPUT_MD = resolveDevicePath(OUTPUT_MD_DEFAULT, "md");

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function outputPathFromEnv(key, fallback) {
  return normalizeText(process.env[key]) || path.resolve(process.cwd(), fallback);
}

function runNodeScript(key, extraEnv = {}) {
  const scriptPath = SCRIPT_PATHS[key];
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_CANARY_DEVICE_CODE: TARGET_DEVICE_CODE,
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

function summarizeEvidence() {
  const readiness = readJsonFile(outputPathFromEnv("FCU_BA_WRITE_ADAPTER_READINESS_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-ba-write-adapter-readiness-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-ba-write-adapter-readiness-latest.json")) || {};
  const dispatch = readJsonFile(outputPathFromEnv("FCU_CANARY_DISPATCH_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-canary-dispatch-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-canary-dispatch-latest.json")) || {};
  const feedback = readJsonFile(outputPathFromEnv("FCU_CANARY_FEEDBACK_MONITOR_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-canary-feedback-monitor-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-canary-feedback-monitor-latest.json")) || {};
  const finalCompletion = readJsonFile(outputPathFromEnv("FCU_FINAL_CONTROL_COMPLETION_JSON", "../../docs/fcu-final-control-completion-latest.json")) || {};
  const worklist = readJsonFile(outputPathFromEnv("FCU_FINAL_CONTROL_WORKLIST_JSON", "../../docs/fcu-final-control-worklist-latest.json")) || {};
  return {
    readiness,
    dispatch,
    feedback,
    finalCompletion,
    worklist
  };
}

function buildNextActions(evidence, skippedDispatch) {
  const actions = [];
  if (skippedDispatch) {
    for (const item of evidence.readiness?.blockingItems || []) {
      actions.push({
        priority: item.severity || "P0",
        action: item.label || item.key || "处理 BA 写入阻断",
        reason: item.evidence || item.message || "",
        command: item.action || ""
      });
    }
  }
  if (evidence.feedback?.verdict === "waiting_for_canary_dispatch") {
    actions.push({
      priority: "P0",
      action: `执行 ${TARGET_DEVICE_CODE} 单台真实下发`,
      reason: "反馈监视仍在等待 canary dispatch。",
      command: `FCU_CANARY_DEVICE_CODE=${TARGET_DEVICE_CODE} FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-window`
    });
  }
  if (evidence.feedback?.verdict === "rollback_required") {
    actions.push({
      priority: "P0",
      action: "执行回退",
      reason: "Canary 反馈异常，不能扩批。",
      command: "按 feedback monitor 的 recordId 调用 rollback 接口"
    });
  }
  if (evidence.feedback?.verdict === "canary_feedback_confirmed") {
    actions.push({
      priority: "P1",
      action: "进入小批量前检查",
      reason: "首台 Canary 已反馈确认。",
      command: "npm --prefix apps/chiller-bff run check:fcu-final-control-completion"
    });
  }
  return actions.slice(0, 8);
}

function buildReport(phases, skipped, evidence) {
  const readinessOk = evidence.readiness?.ok === true;
  const feedbackOk = evidence.feedback?.ok === true;
  const dispatchMutation = evidence.dispatch?.controlMutation === true || evidence.dispatch?.dispatch?.controlMutation === true;
  const controlMutation = dispatchMutation === true;
  const skippedDispatch = skipped.some((item) => item.key === "canaryDispatch");
  return {
    ok: readinessOk && feedbackOk && evidence.finalCompletion?.milestones?.canary?.ok === true,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_canary_window",
    mode: skippedDispatch ? "blocked_before_dispatch" : "canary_window_attempted",
    verdict:
      readinessOk && feedbackOk
        ? "canary_window_confirmed"
        : skippedDispatch
          ? "canary_window_blocked"
          : "canary_window_incomplete",
    controlMutation,
    canary: {
      deviceCode: evidence.feedback?.canary?.deviceCode || evidence.readiness?.canary?.deviceCode || "BGS01",
      dispatchConfirmed: evidence.feedback?.canary?.dispatchConfirmed === true,
      feedbackStatus: evidence.feedback?.canary?.feedbackStatus || null,
      feedbackConfirmed: evidence.feedback?.canary?.feedbackConfirmed === true,
      rollbackTriggered: evidence.feedback?.canary?.rollbackTriggered === true
    },
    phases,
    skipped,
    evidence: {
      readiness: {
        ok: readinessOk,
        verdict: evidence.readiness?.verdict || null,
        blockers: evidence.readiness?.blockingItems || []
      },
      dispatch: {
        ok: evidence.dispatch?.ok === true,
        mode: evidence.dispatch?.mode || null,
        controlMutation: evidence.dispatch?.controlMutation === true
      },
      feedback: {
        ok: feedbackOk,
        verdict: evidence.feedback?.verdict || null,
        canary: evidence.feedback?.canary || null
      },
      finalCompletion: {
        ok: evidence.finalCompletion?.ok === true,
        verdict: evidence.finalCompletion?.verdict || null,
        milestones: evidence.finalCompletion?.milestones || null
      },
      worklist: {
        ok: evidence.worklist?.ok === true,
        verdict: evidence.worklist?.verdict || null,
        summary: evidence.worklist?.summary || null
      }
    },
    nextActions: buildNextActions(evidence, skippedDispatch),
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# FCU ${report.canary.deviceCode} 单台投运窗口`);
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 设备: ${report.canary.deviceCode}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 结论: ${report.verdict}`);
  lines.push(`- 反馈: ${report.canary.feedbackStatus || "--"}`);
  lines.push(`- 写入副作用: ${report.controlMutation ? "存在" : "无"}`);
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

async function main() {
  const phases = [];
  const skipped = [];
  const packageResult = runNodeScript("canaryPackage");
  phases.push(phaseReport("canaryPackage", "生成单台执行包", packageResult, outputPathFromEnv("FCU_CANARY_EXECUTION_PACKAGE_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-canary-execution-package-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-canary-execution-package-latest.json")));
  const readinessResult = runNodeScript("baReadiness");
  phases.push(phaseReport("baReadiness", "BA 写适配器就绪自检", readinessResult, outputPathFromEnv("FCU_BA_WRITE_ADAPTER_READINESS_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-ba-write-adapter-readiness-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-ba-write-adapter-readiness-latest.json")));

  const readiness = readJsonFile(outputPathFromEnv("FCU_BA_WRITE_ADAPTER_READINESS_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-ba-write-adapter-readiness-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-ba-write-adapter-readiness-latest.json")) || {};
  if (readiness.ok === true) {
    phases.push(phaseReport("canaryDispatch", `执行 ${TARGET_DEVICE_CODE} 单台真实下发`, runNodeScript("canaryDispatch"), outputPathFromEnv("FCU_CANARY_DISPATCH_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-canary-dispatch-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-canary-dispatch-latest.json")));
  } else {
    skipped.push({
      key: "canaryDispatch",
      label: `执行 ${TARGET_DEVICE_CODE} 单台真实下发`,
      reason: "BA readiness is not ok"
    });
  }

  phases.push(phaseReport("feedbackMonitor", "单台反馈监视", runNodeScript("feedbackMonitor"), outputPathFromEnv("FCU_CANARY_FEEDBACK_MONITOR_JSON", REQUESTED_DEVICE_CODE ? `../../docs/fcu-canary-feedback-monitor-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.json` : "../../docs/fcu-canary-feedback-monitor-latest.json")));
  phases.push(phaseReport("finalCompletion", "最终完成度检查", runNodeScript("finalCompletion"), outputPathFromEnv("FCU_FINAL_CONTROL_COMPLETION_JSON", "../../docs/fcu-final-control-completion-latest.json")));
  phases.push(phaseReport("finalWorklist", "刷新最终投运清单", runNodeScript("finalWorklist"), outputPathFromEnv("FCU_FINAL_CONTROL_WORKLIST_JSON", "../../docs/fcu-final-control-worklist-latest.json")));

  const report = buildReport(phases, skipped, summarizeEvidence());
  writeReport(report);
  console.log(`FCU_CANARY_WINDOW ok=${report.ok} mode=${report.mode} verdict=${report.verdict} mutation=${report.controlMutation}`);
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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");
const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.md");

const REPORTS = {
  finalGates: envPath("FCU_FINAL_CONTROL_GATES_JSON", "fcu-final-control-gates-latest.json"),
  finalWorklist: envPath("FCU_FINAL_CONTROL_WORKLIST_JSON", "fcu-final-control-worklist-latest.json"),
  signoff: envPath("FCU_FIELD_REMEDIATION_SIGNOFF_JSON", "fcu-field-remediation-signoff-latest.json"),
  signoffClean: envPath("FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON", "fcu-field-remediation-signoff-clean-input-latest.json"),
  closeout: envPath("FCU_FIELD_REMEDIATION_CLOSEOUT_JSON", "fcu-field-remediation-closeout-latest.json"),
  canaryReadiness: envPath("FCU_CANARY_READINESS_JSON", "fcu-canary-readiness-latest.json"),
  allDevicePlan: envPath("FCU_ALL_DEVICE_DISPATCH_PLAN_JSON", "fcu-all-device-dispatch-plan-latest.json"),
  finalCompletion: envPath("FCU_FINAL_CONTROL_COMPLETION_JSON", "fcu-final-control-completion-latest.json")
};

function envPath(envName, fileName) {
  return process.env[envName] || path.resolve(DOCS_DIR, fileName);
}

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
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
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickActionText(action) {
  return normalizeText(action.action || action.title || action.key || action.id || "未命名动作");
}

function rankRunbookAction(action) {
  const haystack = [
    action.phase,
    action.key,
    action.id,
    action.action,
    action.title,
    action.target,
    action.command,
    action.acceptance,
    action.reason
  ]
    .map((item) => normalizeText(item).toLowerCase())
    .join(" ");

  if (
    haystack.includes("communication") ||
    haystack.includes("通讯") ||
    haystack.includes("temperature") ||
    haystack.includes("温度") ||
    haystack.includes("quality") ||
    haystack.includes("质量") ||
    haystack.includes("0°") ||
    haystack.includes("0c")
  ) {
    return 10;
  }
  if (
    haystack.includes("signoff") ||
    haystack.includes("签字") ||
    haystack.includes("签核") ||
    haystack.includes("current-only") ||
    haystack.includes("过期")
  ) {
    return haystack.includes("current-only") || haystack.includes("过期") || haystack.includes("clean") ? 20 : 30;
  }
  if (
    haystack.includes("closeout") ||
    haystack.includes("消缺") ||
    haystack.includes("field_remediation") ||
    haystack.includes("现场 p0")
  ) {
    return 20;
  }
  if (haystack.includes("setpoint") || haystack.includes("设定反馈") || haystack.includes("分步")) {
    return 40;
  }
  if (haystack.includes("canary readiness") || haystack.includes("canary 总门禁") || haystack.includes("最终总门禁")) {
    return 50;
  }
  if (haystack.includes("canary") || haystack.includes("首台")) {
    return 60;
  }
  if (
    haystack.includes("confirm") ||
    haystack.includes("确认短语") ||
    haystack.includes("real_ba_write") ||
    haystack.includes("真实写入") ||
    haystack.includes("最终控制编排")
  ) {
    return 90;
  }
  return 70;
}

function sortRunbookActions(actions) {
  return actions
    .map((action, index) => ({ action, index, rank: rankRunbookAction(action) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.action);
}

function buildRunbook(reports) {
  const finalGates = reports.finalGates.payload || {};
  const finalWorklist = reports.finalWorklist.payload || {};
  const signoff = reports.signoff.payload || {};
  const signoffClean = reports.signoffClean.payload || {};
  const closeout = reports.closeout.payload || {};
  const canaryReadiness = reports.canaryReadiness.payload || {};
  const allDevicePlan = reports.allDevicePlan.payload || {};
  const finalCompletion = reports.finalCompletion.payload || {};

  const gates = asArray(finalGates.gates);
  const blockers = asArray(finalGates.blockers).length > 0 ? asArray(finalGates.blockers) : gates.filter((gate) => gate.ok !== true);
  const nextActions = sortRunbookActions(
    asArray(finalGates.nextActions).length > 0 ? asArray(finalGates.nextActions) : asArray(finalWorklist.actions)
  );
  const releaseMatrix = asArray(signoff.releaseMatrix);
  const openSignoffRows = releaseMatrix.filter((row) => row.signoffComplete !== true);
  const staleSignoffRows = asArray(signoffClean.staleRecords);
  const p0Actions = nextActions.filter((action) => normalizeText(action.priority || "P0").toUpperCase() === "P0");
  const finalGateReady = reports.finalGates.ok && finalGates.ok === true;
  const canaryReady = canaryReadiness.summary?.canaryReady === true || canaryReadiness.ok === true;
  const finalComplete = finalCompletion.ok === true;

  return {
    ok: finalGateReady && finalComplete,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    verdict: finalGateReady
      ? finalComplete
        ? "final_control_complete"
        : "final_gate_passed_waiting_feedback"
      : "final_dispatch_blocked",
    conclusion: finalGateReady
      ? finalComplete
        ? "最终控制已完成。"
        : "最终总门禁已过，但仍需完成反馈闭环。"
      : "最终总门禁未通过，禁止真实 BA/PLC 写入。",
    controlMutation: false,
    dispatch: false,
    summary: {
      finalGatePassed: finalGateReady,
      gateCount: finalGates.summary?.gateCount ?? gates.length,
      passedGates: finalGates.summary?.passed ?? gates.filter((gate) => gate.ok === true).length,
      blockedGates: finalGates.summary?.blocked ?? blockers.length,
      canaryReady,
      finalComplete,
      worklistOpenActions: finalWorklist.summary?.openActions ?? nextActions.length,
      p0OpenActions: finalWorklist.summary?.p0OpenActions ?? p0Actions.length,
      signoffCompleteRows: signoff.summary?.completeRows ?? releaseMatrix.filter((row) => row.signoffComplete === true).length,
      signoffExpectedRows: signoff.summary?.expectedWorkOrders ?? releaseMatrix.length,
      signoffOpenRows: signoff.summary?.openRows ?? openSignoffRows.length,
      signoffSourceRows: signoffClean.summary?.sourceRows ?? null,
      signoffCurrentRows: signoffClean.summary?.currentRows ?? null,
      signoffStaleRows: signoffClean.summary?.staleRows ?? staleSignoffRows.length,
      fieldCloseoutReady: closeout.ok === true,
      plannedDeviceCount: finalWorklist.summary?.plannedDeviceCount ?? allDevicePlan.summary?.total ?? null,
      blockedDeviceCount: finalWorklist.summary?.blockedDeviceCount ?? allDevicePlan.summary?.blockedDevices ?? null,
      stagedSetpointDevices: finalWorklist.summary?.stagedSetpointDevices ?? allDevicePlan.summary?.stagedSetpoint ?? null
    },
    evidence: {
      finalGates: { ok: reports.finalGates.ok && finalGates.ok === true, path: reports.finalGates.path },
      finalWorklist: { ok: reports.finalWorklist.ok && finalWorklist.ok === true, path: reports.finalWorklist.path },
      signoff: { ok: reports.signoff.ok && signoff.ok === true, path: reports.signoff.path },
      signoffClean: { ok: reports.signoffClean.ok && signoffClean.ok === true, path: reports.signoffClean.path },
      closeout: { ok: reports.closeout.ok && closeout.ok === true, path: reports.closeout.path },
      canaryReadiness: { ok: reports.canaryReadiness.ok && canaryReadiness.ok === true, path: reports.canaryReadiness.path },
      allDevicePlan: { ok: reports.allDevicePlan.ok && allDevicePlan.ok === true, path: reports.allDevicePlan.path },
      finalCompletion: { ok: reports.finalCompletion.ok && finalCompletion.ok === true, path: reports.finalCompletion.path }
    },
    blockers: blockers.map((item) => ({
      label: item.label || item.key || "未命名门禁",
      value: item.value ?? null,
      blocker: item.blocker || item.reason || item.message || "未给出阻断原因",
      evidence: item.evidence || null
    })),
    openSignoffRows: openSignoffRows.map((row) => ({
      workOrderId: row.workOrderId || null,
      deviceCode: row.deviceCode || null,
      deviceName: row.deviceName || null,
      canaryBlockReason: row.canaryBlockReason || null,
      missingFields: asArray(row.missingFields),
      nextActions: asArray(row.nextActions).slice(0, 5)
    })),
    staleSignoffRows: staleSignoffRows.map((row) => ({
      workOrderId: row.workOrderId || null,
      deviceCode: row.deviceCode || null,
      deviceName: row.deviceName || null,
      reason: row.reason || "not_in_current_work_orders"
    })),
    nextActions: nextActions.map((action) => ({
      key: action.key || action.id || null,
      priority: normalizeText(action.priority || "P0"),
      phase: action.phase || null,
      action: pickActionText(action),
      target: action.target || null,
      command: action.command || null,
      acceptance: action.acceptance || null,
      reason: action.reason || null
    })),
    safeExecutionOrder: [
      {
        step: "刷新数据质量与现场消缺证据",
        command:
          "npm --prefix apps/chiller-bff run check:fcu-quality-remediation && npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout",
        dispatchesControl: false
      },
      {
        step: "清理过期签核行并复核",
        command:
          "npm --prefix apps/chiller-bff run build:fcu-field-remediation-signoff-clean-input && FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input && npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff",
        dispatchesControl: false
      },
      {
        step: "刷新 Canary readiness 与最终总门禁",
        command:
          "npm --prefix apps/chiller-bff run check:fcu-canary-readiness && FCU_FINAL_CONTROL_GATES_REFRESH=false npm --prefix apps/chiller-bff run check:fcu-final-control-gates",
        dispatchesControl: false
      },
      {
        step: "最终总门禁全部通过后，才允许执行真实写入编排",
        command:
          "FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-final-control-rollout",
        dispatchesControl: true,
        requiresFinalGatePassed: true
      }
    ]
  };
}

function renderMarkdown(runbook) {
  const lines = [];
  lines.push("# FCU 最终控制现场执行 Runbook");
  lines.push("");
  lines.push(`- 站点: ${runbook.siteId}`);
  lines.push(`- 结论: ${runbook.conclusion}`);
  lines.push(`- 最终门禁: ${runbook.summary.passedGates}/${runbook.summary.gateCount} 通过，阻断 ${runbook.summary.blockedGates}`);
  lines.push(`- Canary readiness: ${runbook.summary.canaryReady ? "ready" : "blocked"}`);
  lines.push(`- 现场签核: ${runbook.summary.signoffCompleteRows}/${runbook.summary.signoffExpectedRows} 完成`);
  if (runbook.summary.signoffStaleRows > 0) {
    lines.push(`- 过期签核行: ${runbook.summary.signoffStaleRows} 行，必须先清理后再让现场填写`);
  }
  lines.push(`- 控制写入副作用: ${runbook.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${runbook.generatedAt}`);
  lines.push("");

  lines.push("## 当前阻断");
  lines.push("");
  if (runbook.blockers.length === 0) {
    lines.push("- 无最终总门禁阻断。");
  } else {
    for (const item of runbook.blockers) {
      const value = item.value === null || item.value === undefined ? "" : ` / ${item.value}`;
      lines.push(`- ${item.label}${value}: ${item.blocker}`);
    }
  }
  lines.push("");

  if (runbook.staleSignoffRows.length > 0) {
    lines.push("## 过期签核行");
    lines.push("");
    lines.push("- 以下行不在当前现场工单内，不能继续让现场填写；先执行清理命令生成 current-only 输入表。");
    for (const row of runbook.staleSignoffRows) {
      lines.push(`- ${row.workOrderId || "--"} ${row.deviceCode || "--"} ${row.deviceName || ""}: ${row.reason}`);
    }
    lines.push("");
    lines.push("清理命令:");
    lines.push("");
    lines.push("`npm --prefix apps/chiller-bff run build:fcu-field-remediation-signoff-clean-input && FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input`");
    lines.push("");
  }

  lines.push("## 未签核 FCU");
  lines.push("");
  if (runbook.openSignoffRows.length === 0) {
    lines.push("- 无未签核工单。");
  } else {
    for (const row of runbook.openSignoffRows) {
      const missing = row.missingFields.length > 0 ? row.missingFields.join(", ") : "无";
      lines.push(`- ${row.deviceCode} ${row.deviceName || ""}: ${row.canaryBlockReason || "未放行"}；缺字段 ${missing}`);
    }
  }
  lines.push("");

  lines.push("## 下一步动作");
  lines.push("");
  for (const item of runbook.nextActions) {
    lines.push(`- [${item.priority}] ${item.action}${item.target ? `：${item.target}` : ""}`);
    if (item.command) {
      lines.push(`  - 命令: \`${item.command}\``);
    }
    if (item.acceptance) {
      lines.push(`  - 验收: ${item.acceptance}`);
    }
  }
  lines.push("");

  lines.push("## 安全执行顺序");
  lines.push("");
  for (const item of runbook.safeExecutionOrder) {
    lines.push(`### ${item.step}`);
    lines.push("");
    lines.push(`\`${item.command}\``);
    if (item.dispatchesControl) {
      lines.push("");
      lines.push("- 会请求真实 BA 写入；必须最终总门禁通过且现场授权后执行。");
    }
    lines.push("");
  }

  lines.push("## 证据文件");
  lines.push("");
  for (const [key, value] of Object.entries(runbook.evidence)) {
    lines.push(`- ${key}: ${value.ok ? "ok" : "blocked/missing"} / ${value.path}`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const reports = Object.fromEntries(Object.entries(REPORTS).map(([key, filePath]) => [key, readJsonFile(filePath)]));
  const runbook = buildRunbook(reports);
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(runbook, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(runbook));
  console.log(
    `FCU_FINAL_CONTROL_RUNBOOK ok=${runbook.ok} verdict=${runbook.verdict} gates=${runbook.summary.passedGates}/${runbook.summary.gateCount} signoff=${runbook.summary.signoffCompleteRows}/${runbook.summary.signoffExpectedRows} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!runbook.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}

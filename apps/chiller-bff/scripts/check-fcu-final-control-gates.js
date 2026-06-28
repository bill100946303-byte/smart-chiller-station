import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = process.env.FCU_FINAL_CONTROL_GATES_OUTPUT_DIR || path.resolve(REPO_ROOT, "docs");
const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const SHOULD_REFRESH = process.env.FCU_FINAL_CONTROL_GATES_REFRESH !== "false";
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_GATES_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-gates-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_GATES_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-gates-latest.md");

const FILES = {
  quality: path.resolve(DOCS_DIR, "fcu-quality-remediation-latest.json"),
  plan: path.resolve(DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json"),
  closeout: path.resolve(DOCS_DIR, "fcu-field-remediation-closeout-latest.json"),
  workOrders: path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json"),
  executionPack: path.resolve(DOCS_DIR, "fcu-field-remediation-execution-pack-latest.json"),
  signoff: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json"),
  signoffInput: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv"),
  signoffClean: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json"),
  signoffPromote: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-promote-latest.json"),
  returnTemplate: path.resolve(DOCS_DIR, "fcu-field-remediation-return-template-latest.json"),
  fieldHandoff: path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.json"),
  deviceMatrix: path.resolve(DOCS_DIR, "fcu-device-control-matrix-latest.json"),
  smallBatchPlan: path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json"),
  goLivePreflight: path.resolve(DOCS_DIR, "fcu-go-live-preflight-latest.json"),
  canaryQueue: path.resolve(DOCS_DIR, "fcu-canary-queue-latest.json"),
  fieldArm: path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json"),
  canaryPackage: path.resolve(DOCS_DIR, "fcu-canary-execution-package-latest.json"),
  baAdapter: path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json"),
  canaryReadiness: path.resolve(DOCS_DIR, "fcu-canary-readiness-latest.json"),
  finalCompletion: path.resolve(DOCS_DIR, "fcu-final-control-completion-latest.json"),
  finalWorklist: path.resolve(DOCS_DIR, "fcu-final-control-worklist-latest.json")
};

const REFRESH_STEPS = [
  {
    key: "quality",
    script: "check-fcu-quality-remediation.js",
    env: {
      FCU_QUALITY_REMEDIATION_JSON: FILES.quality,
      FCU_QUALITY_REMEDIATION_MD: FILES.quality.replace(/\.json$/, ".md"),
      FCU_QUALITY_REMEDIATION_CSV: FILES.quality.replace(/\.json$/, ".csv")
    }
  },
  {
    key: "plan",
    script: "plan-fcu-all-device-dispatch.js",
    env: {
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: FILES.plan,
      FCU_ALL_DEVICE_DISPATCH_PLAN_MD: FILES.plan.replace(/\.json$/, ".md")
    }
  },
  {
    key: "closeout",
    script: "check-fcu-field-remediation-closeout.js",
    env: {
      FCU_QUALITY_REMEDIATION_JSON: FILES.quality,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: FILES.plan,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FILES.closeout,
      FCU_FIELD_REMEDIATION_CLOSEOUT_MD: FILES.closeout.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: FILES.closeout.replace(/\.json$/, ".csv")
    }
  },
  {
    key: "workOrders",
    script: "build-fcu-field-remediation-work-orders.js",
    env: {
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FILES.closeout,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FILES.workOrders,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: FILES.workOrders.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: FILES.workOrders.replace(/\.json$/, ".csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv")
    }
  },
  {
    key: "executionPack",
    script: "build-fcu-field-remediation-execution-pack.js",
    env: {
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FILES.workOrders,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: FILES.executionPack,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: FILES.executionPack.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: FILES.executionPack.replace(/\.json$/, ".csv")
    }
  },
  {
    key: "signoff",
    script: "check-fcu-field-remediation-signoff.js",
    env: {
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FILES.workOrders,
      FCU_FIELD_REMEDIATION_SIGNOFF_CSV: path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FILES.signoff,
      FCU_FIELD_REMEDIATION_SIGNOFF_MD: FILES.signoff.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: FILES.signoff.replace(/\.json$/, ".csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: FILES.signoff.replace(/\.json$/, "-release-matrix.csv")
    }
  },
  {
    key: "deviceMatrix",
    script: "check-fcu-device-control-matrix.js",
    env: {
      FCU_DEVICE_CONTROL_MATRIX_JSON: FILES.deviceMatrix,
      FCU_DEVICE_CONTROL_MATRIX_MD: FILES.deviceMatrix.replace(/\.json$/, ".md")
    }
  },
  {
    key: "smallBatchPlan",
    script: "plan-fcu-small-batch-dispatch.js",
    env: {
      FCU_SMALL_BATCH_PLAN_JSON: FILES.smallBatchPlan,
      FCU_SMALL_BATCH_PLAN_MD: FILES.smallBatchPlan.replace(/\.json$/, ".md")
    }
  },
  {
    key: "goLivePreflight",
    script: "check-fcu-go-live-preflight.js",
    env: {
      FCU_SMALL_BATCH_PLAN_JSON: FILES.smallBatchPlan,
      FCU_DEVICE_CONTROL_MATRIX_JSON: FILES.deviceMatrix,
      FCU_GO_LIVE_PREFLIGHT_JSON: FILES.goLivePreflight,
      FCU_GO_LIVE_PREFLIGHT_MD: FILES.goLivePreflight.replace(/\.json$/, ".md")
    }
  },
  {
    key: "canaryQueue",
    script: "build-fcu-canary-queue.js",
    env: {
      FCU_SMALL_BATCH_PLAN_JSON: FILES.smallBatchPlan,
      FCU_GO_LIVE_PREFLIGHT_JSON: FILES.goLivePreflight,
      FCU_CANARY_QUEUE_JSON: FILES.canaryQueue,
      FCU_CANARY_QUEUE_MD: FILES.canaryQueue.replace(/\.json$/, ".md")
    }
  },
  {
    key: "fieldArm",
    script: "check-fcu-field-arm.js",
    env: {
      FCU_CANARY_QUEUE_JSON: FILES.canaryQueue,
      FCU_GO_LIVE_PREFLIGHT_JSON: FILES.goLivePreflight,
      FCU_FIELD_ARM_CHECK_JSON: FILES.fieldArm,
      FCU_FIELD_ARM_CHECK_MD: FILES.fieldArm.replace(/\.json$/, ".md")
    }
  },
  {
    key: "canaryPackage",
    script: "build-fcu-canary-execution-package.js",
    env: {
      FCU_CANARY_QUEUE_JSON: FILES.canaryQueue,
      FCU_SMALL_BATCH_PLAN_JSON: FILES.smallBatchPlan,
      FCU_GO_LIVE_PREFLIGHT_JSON: FILES.goLivePreflight,
      FCU_FIELD_ARM_CHECK_JSON: FILES.fieldArm,
      FCU_FINAL_CONTROL_RUNBOOK_JSON: path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.json"),
      FCU_QUALITY_REMEDIATION_JSON: FILES.quality,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: FILES.canaryPackage,
      FCU_CANARY_EXECUTION_PACKAGE_MD: FILES.canaryPackage.replace(/\.json$/, ".md"),
      FCU_CANARY_EXECUTION_PACKAGE_CSV: FILES.canaryPackage.replace(/\.json$/, ".csv")
    }
  },
  {
    key: "baAdapter",
    script: "check-fcu-ba-write-adapter-readiness.js",
    env: {
      FCU_CANARY_EXECUTION_PACKAGE_JSON: FILES.canaryPackage,
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: FILES.baAdapter,
      FCU_BA_WRITE_ADAPTER_READINESS_MD: FILES.baAdapter.replace(/\.json$/, ".md"),
      FCU_BA_WRITE_ADAPTER_READINESS_CSV: FILES.baAdapter.replace(/\.json$/, ".csv")
    }
  },
  {
    key: "canaryReadiness",
    script: "check-fcu-canary-readiness.js",
    env: {
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FILES.closeout,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FILES.signoff,
      FCU_FIELD_ARM_CHECK_JSON: FILES.fieldArm,
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: FILES.baAdapter,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: FILES.canaryPackage,
      FCU_CANARY_READINESS_JSON: FILES.canaryReadiness,
      FCU_CANARY_READINESS_MD: FILES.canaryReadiness.replace(/\.json$/, ".md")
    }
  },
  {
    key: "finalCompletion",
    script: "check-fcu-final-control-completion.js",
    env: {
      FCU_FINAL_CONTROL_COMPLETION_JSON: FILES.finalCompletion,
      FCU_FINAL_CONTROL_COMPLETION_MD: FILES.finalCompletion.replace(/\.json$/, ".md")
    }
  },
  {
    key: "finalWorklist",
    script: "build-fcu-final-control-worklist.js",
    env: {
      FCU_QUALITY_REMEDIATION_JSON: FILES.quality,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: FILES.plan,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FILES.closeout,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FILES.workOrders,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: FILES.executionPack,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: FILES.signoffInput,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FILES.signoff,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: FILES.signoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: FILES.signoffClean.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: FILES.signoffClean.replace(/clean-input-latest\.json$/, "current-only-latest.csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: FILES.signoffClean.replace(/clean-input-latest\.json$/, "stale-rows-latest.csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: FILES.signoffPromote,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: FILES.signoffPromote.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: FILES.returnTemplate,
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: FILES.returnTemplate.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: FILES.returnTemplate.replace(/\.json$/, ".csv"),
      FCU_FIELD_HANDOFF_PACK_JSON: FILES.fieldHandoff,
      FCU_FIELD_HANDOFF_PACK_MD: FILES.fieldHandoff.replace(/\.json$/, ".md"),
      FCU_FIELD_HANDOFF_PACK_CSV: FILES.fieldHandoff.replace(/\.json$/, ".csv"),
      FCU_CANARY_READINESS_JSON: FILES.canaryReadiness,
      FCU_FINAL_CONTROL_COMPLETION_JSON: FILES.finalCompletion,
      FCU_FINAL_CONTROL_WORKLIST_JSON: FILES.finalWorklist,
      FCU_FINAL_CONTROL_WORKLIST_MD: FILES.finalWorklist.replace(/\.json$/, ".md"),
      FCU_FINAL_WORKLIST_REFRESH_QUALITY: "false",
      FCU_FINAL_WORKLIST_REFRESH_PLAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
      FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
      FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
      FCU_FINAL_WORKLIST_REFRESH_HANDOFF: "false",
      FCU_FINAL_WORKLIST_REFRESH_RETURN_TEMPLATE: "false",
      FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false"
    }
  }
];

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
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
      payload: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function runRefreshSteps() {
  if (!SHOULD_REFRESH) {
    return REFRESH_STEPS.map((step) => ({
      key: step.key,
      skipped: true,
      status: null,
      ok: true,
      stdout: "",
      stderr: "",
      reason: "refresh_disabled"
    }));
  }
  return REFRESH_STEPS.map((step) => {
    const result = spawnSync(process.execPath, [path.resolve(SCRIPT_DIR, step.script)], {
      cwd: path.resolve(SCRIPT_DIR, ".."),
      env: {
        ...process.env,
        SITE_ID,
        ...step.env
      },
      encoding: "utf8"
    });
    return {
      key: step.key,
      skipped: false,
      status: result.status,
      ok: result.status === 0,
      accepted: result.status === 0 || result.status === 2,
      stdout: (result.stdout || "").slice(-2000),
      stderr: (result.stderr || "").slice(-2000)
    };
  });
}

function gate(label, ok, value, blocker, evidence) {
  return {
    label,
    ok: ok === true,
    value,
    blocker: ok === true ? "" : blocker,
    evidence
  };
}

function buildReport(refreshResults) {
  const reports = Object.fromEntries(Object.entries(FILES).map(([key, filePath]) => [key, readJson(filePath)]));
  const quality = reports.quality.payload;
  const plan = reports.plan.payload;
  const closeout = reports.closeout.payload;
  const executionPack = reports.executionPack.payload;
  const signoff = reports.signoff.payload;
  const canaryReadiness = reports.canaryReadiness.payload;
  const finalCompletion = reports.finalCompletion.payload;
  const finalWorklist = reports.finalWorklist.payload;
  const refreshHardFailed = refreshResults.some((item) => item.accepted === false);
  const gates = [
    gate(
      "数据质量 P0",
      Number(quality.summary?.p0Count ?? 0) === 0,
      `${quality.summary?.p0Count ?? "--"} 台 P0`,
      "仍有通讯/温度/反馈硬阻断设备",
      reports.quality.path
    ),
    gate(
      "全量分批计划",
      plan.summary?.canCompleteAllNow === true,
      `immediate=${plan.summary?.immediateReady ?? "--"}, staged=${plan.summary?.stagedSetpoint ?? "--"}, blocked=${plan.summary?.blocked ?? "--"}`,
      "仍有 blocked 或 staged 设备",
      reports.plan.path
    ),
    gate(
      "现场执行包",
      executionPack.summary?.openP0Devices === 0,
      `${executionPack.summary?.openP0Devices ?? "--"} 台待处理`,
      "现场执行包仍有 P0 设备",
      reports.executionPack.path
    ),
    gate(
      "现场 closeout",
      closeout.summary?.readyForCanary === true,
      closeout.verdict || "unknown",
      "现场消缺未关闭",
      reports.closeout.path
    ),
    gate(
      "现场签字",
      signoff.summary?.signoffComplete === true,
      `${signoff.summary?.completeRows ?? "--"}/${signoff.summary?.expectedWorkOrders ?? "--"}`,
      "现场签字未完成",
      reports.signoff.path
    ),
    gate(
      "Canary readiness",
      canaryReadiness.summary?.canaryReady === true && canaryReadiness.verdict === "canary_ready",
      canaryReadiness.verdict || "unknown",
      "Canary 总门禁阻断",
      reports.canaryReadiness.path
    ),
    gate(
      "最终完成",
      finalCompletion.ok === true,
      finalCompletion.verdict || "incomplete",
      "首台/小批量/全量反馈未全部闭环",
      reports.finalCompletion.path
    ),
    gate(
      "最终 worklist",
      finalWorklist.ok === true,
      finalWorklist.verdict || "worklist_open",
      "最终投运清单仍有未完成动作",
      reports.finalWorklist.path
    )
  ];
  const blockers = gates.filter((item) => !item.ok);
  return {
    ok: !refreshHardFailed && blockers.length === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_final_control_gates",
    siteId: SITE_ID,
    controlMutation: false,
    refresh: {
      enabled: SHOULD_REFRESH,
      hardFailed: refreshHardFailed,
      results: refreshResults
    },
    summary: {
      gateCount: gates.length,
      passed: gates.length - blockers.length,
      blocked: blockers.length,
      qualityP0Devices: quality.summary?.p0Count ?? null,
      fieldP0Devices: executionPack.summary?.openP0Devices ?? null,
      signoffCompleteRows: signoff.summary?.completeRows ?? null,
      signoffExpectedRows: signoff.summary?.expectedWorkOrders ?? null,
      canaryReady: canaryReadiness.summary?.canaryReady === true,
      finalWorklistOpenActions: finalWorklist.summary?.openActions ?? null
    },
    gates,
    blockers,
    nextActions: Array.isArray(finalWorklist.actions) ? finalWorklist.actions.slice(0, 8) : [],
    files: FILES,
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制总门禁");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 结论: ${report.ok ? "可进入最终控制归档" : "仍被阻断"}`);
  lines.push(`- 通过门禁: ${report.summary.passed}/${report.summary.gateCount}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 门禁");
  lines.push("");
  lines.push("| 门禁 | 状态 | 当前值 | 阻断 | 证据 |");
  lines.push("|---|---|---|---|---|");
  for (const item of report.gates) {
    lines.push(`| ${item.label} | ${item.ok ? "通过" : "阻断"} | ${item.value || "--"} | ${item.blocker || "--"} | ${item.evidence} |`);
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  if (report.nextActions.length === 0) {
    lines.push("- 暂无动作。");
  } else {
    for (const action of report.nextActions) {
      lines.push(`- ${action.priority || "P2"} / ${action.phase || "--"}: ${action.action || "--"} (${action.target || "--"})`);
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

try {
  const refreshResults = runRefreshSteps();
  const report = buildReport(refreshResults);
  writeReport(report);
  console.log(
    `FCU_FINAL_CONTROL_GATES ok=${report.ok} passed=${report.summary.passed}/${report.summary.gateCount} blocked=${report.summary.blocked} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}

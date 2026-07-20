import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_DOCS_DIR = path.resolve(REPO_ROOT, "docs");
const GO_LIVE_PREFLIGHT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-go-live-preflight-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-arm-check-latest.json");
const FINAL_COMPLETION_JSON =
  process.env.FCU_FINAL_CONTROL_COMPLETION_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-completion-latest.json");
const QUALITY_REMEDIATION_JSON =
  process.env.FCU_QUALITY_REMEDIATION_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-quality-remediation-latest.json");
const CANARY_EXECUTION_PACKAGE_JSON =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-canary-execution-package-latest.json");
const CANARY_READINESS_JSON =
  process.env.FCU_CANARY_READINESS_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-canary-readiness-latest.json");
const BA_WRITE_ADAPTER_READINESS_JSON =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json");
const CANARY_FEEDBACK_MONITOR_JSON =
  process.env.FCU_CANARY_FEEDBACK_MONITOR_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-canary-feedback-monitor-latest.json");
const CANARY_WINDOW_JSON =
  process.env.FCU_CANARY_WINDOW_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-canary-window-latest.json");
const ALL_DEVICE_PLAN_JSON =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const FIELD_REMEDIATION_CLOSEOUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-closeout-latest.json");
const FIELD_REMEDIATION_WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const FIELD_REMEDIATION_EXECUTION_PACK_JSON =
  process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-execution-pack-latest.json");
const FIELD_HANDOFF_PACK_JSON =
  process.env.FCU_FIELD_HANDOFF_PACK_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-handoff-pack-latest.json");
const FIELD_REMEDIATION_RETURN_TEMPLATE_JSON =
  process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-return-template-latest.json");
const FIELD_REMEDIATION_SIGNOFF_INPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv");
const FIELD_REMEDIATION_SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json");
const FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-promote-latest.json");
const FINAL_ROLLOUT_JSON =
  process.env.FCU_FINAL_CONTROL_ROLLOUT_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-rollout-latest.json");
const FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON =
  process.env.FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-field-execution-pack-latest.json");
const SITE_AUTHORIZATION_JSON =
  process.env.FCU_SITE_AUTHORIZATION_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-site-authorization-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_WORKLIST_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-worklist-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_WORKLIST_MD ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-worklist-latest.md");
const QUALITY_REMEDIATION_SCRIPT = path.resolve(SCRIPT_DIR, "check-fcu-quality-remediation.js");
const ALL_DEVICE_PLAN_SCRIPT = path.resolve(SCRIPT_DIR, "plan-fcu-all-device-dispatch.js");
const FIELD_REMEDIATION_CLOSEOUT_SCRIPT = path.resolve(SCRIPT_DIR, "check-fcu-field-remediation-closeout.js");
const FIELD_REMEDIATION_WORK_ORDERS_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-field-remediation-work-orders.js");
const FIELD_REMEDIATION_EXECUTION_PACK_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-field-remediation-execution-pack.js");
const FIELD_HANDOFF_PACK_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-field-handoff-pack.js");
const FIELD_REMEDIATION_RETURN_TEMPLATE_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-field-remediation-return-template.js");
const FIELD_REMEDIATION_SIGNOFF_SCRIPT = path.resolve(SCRIPT_DIR, "check-fcu-field-remediation-signoff.js");
const FIELD_REMEDIATION_SIGNOFF_CLEAN_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-field-remediation-signoff-clean-input.js");
const FIELD_REMEDIATION_SIGNOFF_PROMOTE_SCRIPT = path.resolve(SCRIPT_DIR, "promote-fcu-field-remediation-signoff-input.js");
const CANARY_READINESS_SCRIPT = path.resolve(SCRIPT_DIR, "check-fcu-canary-readiness.js");
const FINAL_CONTROL_FIELD_EXECUTION_PACK_SCRIPT = path.resolve(SCRIPT_DIR, "build-fcu-final-control-field-execution-pack.js");
const SHOULD_REFRESH_QUALITY_REMEDIATION =
  process.env.FCU_FINAL_WORKLIST_REFRESH_QUALITY !== "false" &&
  !process.env.FCU_QUALITY_REMEDIATION_JSON &&
  QUALITY_REMEDIATION_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-quality-remediation-latest.json");
const SHOULD_REFRESH_ALL_DEVICE_PLAN =
  process.env.FCU_FINAL_WORKLIST_REFRESH_PLAN !== "false" &&
  !process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON &&
  ALL_DEVICE_PLAN_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const SHOULD_REFRESH_FIELD_REMEDIATION_CLOSEOUT =
  process.env.FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_JSON ||
      FIELD_REMEDIATION_CLOSEOUT_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-closeout-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_WORK_ORDERS =
  process.env.FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
      FIELD_REMEDIATION_WORK_ORDERS_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-work-orders-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_EXECUTION_PACK =
  process.env.FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON ||
      FIELD_REMEDIATION_EXECUTION_PACK_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-execution-pack-latest.json")
  );
const SHOULD_REFRESH_FIELD_HANDOFF_PACK =
  process.env.FCU_FINAL_WORKLIST_REFRESH_HANDOFF !== "false" &&
  Boolean(
    process.env.FCU_FIELD_HANDOFF_PACK_JSON ||
      FIELD_HANDOFF_PACK_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-handoff-pack-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_RETURN_TEMPLATE =
  process.env.FCU_FINAL_WORKLIST_REFRESH_RETURN_TEMPLATE !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON ||
      FIELD_REMEDIATION_RETURN_TEMPLATE_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-return-template-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF =
  process.env.FCU_FINAL_WORKLIST_REFRESH_SIGNOFF !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
      FIELD_REMEDIATION_SIGNOFF_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF_CLEAN =
  process.env.FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
      FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json")
  );
const SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF_PROMOTE =
  process.env.FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE !== "false" &&
  Boolean(
    process.env.FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON ||
      FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-signoff-promote-latest.json")
  );
const SHOULD_REFRESH_CANARY_READINESS =
  process.env.FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS !== "false" &&
  Boolean(
    process.env.FCU_CANARY_READINESS_JSON ||
      CANARY_READINESS_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-canary-readiness-latest.json")
  );
const SHOULD_REFRESH_FINAL_CONTROL_FIELD_EXECUTION_PACK =
  process.env.FCU_FINAL_WORKLIST_REFRESH_FINAL_FIELD_EXECUTION_PACK === "true" &&
  Boolean(
    process.env.FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON ||
      FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON === path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-field-execution-pack-latest.json")
  );

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

function refreshQualityRemediationReport() {
  if (!SHOULD_REFRESH_QUALITY_REMEDIATION) {
    return {
      skipped: true,
      reason: "custom_quality_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [QUALITY_REMEDIATION_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_QUALITY_REMEDIATION_JSON: QUALITY_REMEDIATION_JSON,
      FCU_QUALITY_REMEDIATION_MD: QUALITY_REMEDIATION_JSON.replace(/\.json$/, ".md"),
      FCU_QUALITY_REMEDIATION_CSV: QUALITY_REMEDIATION_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshAllDevicePlanReport() {
  if (!SHOULD_REFRESH_ALL_DEVICE_PLAN) {
    return {
      skipped: true,
      reason: "custom_all_device_plan_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [ALL_DEVICE_PLAN_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: ALL_DEVICE_PLAN_JSON,
      FCU_ALL_DEVICE_DISPATCH_PLAN_MD: ALL_DEVICE_PLAN_JSON.replace(/\.json$/, ".md")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationCloseoutReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_CLOSEOUT) {
    return {
      skipped: true,
      reason: "custom_closeout_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_CLOSEOUT_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_QUALITY_REMEDIATION_JSON: QUALITY_REMEDIATION_JSON,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: ALL_DEVICE_PLAN_JSON,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FIELD_REMEDIATION_CLOSEOUT_JSON,
      FCU_FIELD_REMEDIATION_CLOSEOUT_MD: FIELD_REMEDIATION_CLOSEOUT_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: FIELD_REMEDIATION_CLOSEOUT_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationWorkOrdersReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_WORK_ORDERS) {
    return {
      skipped: true,
      reason: "custom_work_orders_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_WORK_ORDERS_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FIELD_REMEDIATION_CLOSEOUT_JSON,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: FIELD_REMEDIATION_WORK_ORDERS_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: FIELD_REMEDIATION_WORK_ORDERS_JSON.replace(/\.json$/, ".csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: FIELD_REMEDIATION_SIGNOFF_INPUT_CSV
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationExecutionPackReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_EXECUTION_PACK) {
    return {
      skipped: true,
      reason: "custom_execution_pack_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_EXECUTION_PACK_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: FIELD_REMEDIATION_EXECUTION_PACK_JSON,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: FIELD_REMEDIATION_EXECUTION_PACK_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: FIELD_REMEDIATION_EXECUTION_PACK_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldHandoffPackReport() {
  if (!SHOULD_REFRESH_FIELD_HANDOFF_PACK) {
    return {
      skipped: true,
      reason: "custom_handoff_pack_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_HANDOFF_PACK_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: FIELD_REMEDIATION_EXECUTION_PACK_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON,
      FCU_FINAL_CONTROL_RUNBOOK_JSON:
        process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
        path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-runbook-latest.json"),
      FCU_FIELD_HANDOFF_PACK_JSON: FIELD_HANDOFF_PACK_JSON,
      FCU_FIELD_HANDOFF_PACK_MD: FIELD_HANDOFF_PACK_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_HANDOFF_PACK_CSV: FIELD_HANDOFF_PACK_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFinalControlFieldExecutionPackReport() {
  if (!SHOULD_REFRESH_FINAL_CONTROL_FIELD_EXECUTION_PACK) {
    return {
      skipped: true,
      reason: "custom_final_field_execution_pack_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FINAL_CONTROL_FIELD_EXECUTION_PACK_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FINAL_CONTROL_WORKLIST_JSON: OUTPUT_JSON,
      FCU_FINAL_CONTROL_RUNBOOK_JSON:
        process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
        path.resolve(DEFAULT_DOCS_DIR, "fcu-final-control-runbook-latest.json"),
      FCU_FIELD_HANDOFF_PACK_JSON: FIELD_HANDOFF_PACK_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FIELD_REMEDIATION_SIGNOFF_JSON,
      FCU_CANARY_READINESS_JSON: CANARY_READINESS_JSON,
      FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON: FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON,
      FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD: FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON.replace(/\.json$/, ".md"),
      FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV: FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationReturnTemplateReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_RETURN_TEMPLATE) {
    return {
      skipped: true,
      reason: "custom_return_template_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_RETURN_TEMPLATE_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FIELD_REMEDIATION_SIGNOFF_JSON,
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: FIELD_REMEDIATION_RETURN_TEMPLATE_JSON,
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: FIELD_REMEDIATION_RETURN_TEMPLATE_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: FIELD_REMEDIATION_RETURN_TEMPLATE_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationSignoffReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF) {
    return {
      skipped: true,
      reason: "custom_signoff_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_SIGNOFF_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_CSV:
        process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CSV || FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FIELD_REMEDIATION_SIGNOFF_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_MD: FIELD_REMEDIATION_SIGNOFF_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: FIELD_REMEDIATION_SIGNOFF_JSON.replace(/\.json$/, ".csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationSignoffCleanReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF_CLEAN) {
    return {
      skipped: true,
      reason: "custom_signoff_clean_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_SIGNOFF_CLEAN_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: FIELD_REMEDIATION_WORK_ORDERS_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON.replace(/clean-input-latest\.json$/, "current-only-latest.csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON.replace(/clean-input-latest\.json$/, "stale-rows-latest.csv")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshFieldRemediationSignoffPromoteReport() {
  if (!SHOULD_REFRESH_FIELD_REMEDIATION_SIGNOFF_PROMOTE) {
    return {
      skipped: true,
      reason: "custom_signoff_promote_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [FIELD_REMEDIATION_SIGNOFF_PROMOTE_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON.replace(/\.json$/, ".md")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function refreshCanaryReadinessReport() {
  if (!SHOULD_REFRESH_CANARY_READINESS) {
    return {
      skipped: true,
      reason: "custom_canary_readiness_report_or_refresh_disabled"
    };
  }
  const result = spawnSync(process.execPath, [CANARY_READINESS_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, ".."),
    env: {
      ...process.env,
      SITE_ID,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: FIELD_REMEDIATION_SIGNOFF_JSON,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: FIELD_REMEDIATION_CLOSEOUT_JSON,
      FCU_FIELD_ARM_CHECK_JSON: FIELD_ARM_JSON,
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: BA_WRITE_ADAPTER_READINESS_JSON,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: CANARY_EXECUTION_PACKAGE_JSON,
      FCU_CANARY_READINESS_JSON: CANARY_READINESS_JSON,
      FCU_CANARY_READINESS_MD: CANARY_READINESS_JSON.replace(/\.json$/, ".md")
    },
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function uniq(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean))];
}

function pushAction(actions, item) {
  const key = normalizeText(item.key || `${item.priority}-${item.action}-${item.target}`);
  if (!key || actions.some((action) => action.key === key)) {
    return;
  }
  actions.push({
    key,
    priority: item.priority || "P1",
    phase: item.phase || "commissioning",
    action: item.action || "待处理",
    target: item.target || "--",
    command: item.command || "",
    reason: item.reason || "",
    acceptance: item.acceptance || "",
    source: item.source || ""
  });
}

function phaseStatus(ok, blocked, readyLabel = "ready") {
  if (ok) {
    return readyLabel;
  }
  return blocked ? "blocked" : "pending";
}

function topQualityDevices(quality, limit = 8) {
  return (Array.isArray(quality.devices) ? quality.devices : []).slice(0, limit).map((device) => ({
    deviceCode: device.deviceCode,
    deviceName: device.deviceName,
    severity: device.severity,
    reasons: device.reasons || [],
    fieldActions: device.fieldActions || [],
    releaseCriteria: device.releaseCriteria || []
  }));
}

function buildFieldRemediationPlaybook(fieldWorkOrders, fieldReturnTemplate, fieldSignoff, firstCanary) {
  const templateDevices = Array.isArray(fieldReturnTemplate.devices) ? fieldReturnTemplate.devices : [];
  const workOrders = Array.isArray(fieldWorkOrders.workOrders) ? fieldWorkOrders.workOrders : [];
  const signoffRecords = Array.isArray(fieldSignoff.records) ? fieldSignoff.records : [];
  const signoffByWorkOrder = new Map(
    signoffRecords.map((record) => [normalizeText(record.workOrderId), record])
  );
  const sourceDevices = templateDevices.length > 0
    ? templateDevices
    : workOrders.map((workOrder) => {
        const currentEvidence = workOrder.currentEvidence || {};
        const signoff = signoffByWorkOrder.get(normalizeText(workOrder.workOrderId)) || {};
        return {
          workOrderId: workOrder.workOrderId,
          deviceCode: workOrder.deviceCode,
          deviceName: workOrder.deviceName,
          currentEvidence: {
            reasons: Array.isArray(currentEvidence.reasons) ? currentEvidence.reasons : [],
            reasonLabels: []
          },
          missingFields: Array.isArray(signoff.issues)
            ? signoff.issues.map((issue) => normalizeText(issue).replace(/_(missing|not_.*|out_of_range)$/g, "")).filter(Boolean)
            : [],
          releaseCriteria: Array.isArray(workOrder.releaseCriteria) ? workOrder.releaseCriteria : []
        };
      });
  const devices = sourceDevices.map((device) => {
    const reasons = Array.isArray(device.currentEvidence?.reasons)
      ? device.currentEvidence.reasons.map(normalizeText).filter(Boolean)
      : [];
    const missingFields = Array.isArray(device.missingFields)
      ? device.missingFields.map(normalizeText).filter(Boolean)
      : [];
    const fieldPriority = [
      reasons.includes("communication_alarm") ? "通讯恢复" : null,
      reasons.some((reason) => reason === "zero_temperature" || reason === "invalid_temperature" || reason === "temperature_quality_guard") ? "温度点复核" : null,
      reasons.includes("setpoint_feedback_out_of_bounds") ? "设定反馈拉回" : null,
      "写点映射复核",
      "连续两次采样",
      "现场双人签核"
    ].filter(Boolean);
    return {
      workOrderId: normalizeText(device.workOrderId),
      deviceCode: normalizeText(device.deviceCode),
      deviceName: normalizeText(device.deviceName || device.deviceCode),
      reasons,
      reasonLabels: Array.isArray(device.currentEvidence?.reasonLabels)
        ? device.currentEvidence.reasonLabels.map(normalizeText).filter(Boolean)
        : reasons.map((reason) => reason),
      missingFields,
      fieldPriority,
      releaseCriteria: Array.isArray(device.releaseCriteria) ? device.releaseCriteria.slice(0, 8) : []
    };
  });
  const reasonGroups = templateDevices.length === 0 && Array.isArray(fieldWorkOrders.summary?.reasonGroups)
    ? fieldWorkOrders.summary.reasonGroups.map((group) => ({
        reason: normalizeText(group.reason),
        devices: Array.isArray(group.devices) ? group.devices.map(normalizeText).filter(Boolean) : []
      }))
    : ["communication_alarm", "zero_temperature", "invalid_temperature", "temperature_quality_guard", "setpoint_feedback_out_of_bounds"]
        .map((reason) => ({
          reason,
          devices: devices.filter((device) => device.reasons.includes(reason)).map((device) => device.deviceCode)
        }))
        .filter((group) => group.devices.length > 0);
  const missingFieldCounts = {};
  for (const device of devices) {
    for (const field of device.missingFields) {
      missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
    }
  }
  const recommendedOrder = Array.isArray(fieldWorkOrders.summary?.recommendedOrder)
    ? fieldWorkOrders.summary.recommendedOrder.map(normalizeText).filter(Boolean)
    : [
        "先恢复 communication_alarm，通讯报警未恢复时禁止任何真实写入。",
        "再复核 0°C/无效温度，区域温度未恢复到 5-45°C 前不参与控制。",
        "再分步处理 setpoint_feedback_out_of_bounds，避免一次性大幅改设定。",
        "最后核对写点映射、连续两次采样和现场双人签核。"
      ];
  const canaryBlockedByField = devices.length > 0;
  return {
    fieldReady: devices.length === 0,
    firstCanary,
    canaryBlockedByField,
    deviceCount: devices.length,
    reasonGroups,
    missingFieldCounts,
    recommendedOrder,
    devices: devices.slice(0, 12),
    acceptance: [
      "每台 releaseDecision=release",
      "communicationAlarmAfter=0",
      "zoneTemperatureAfterC 在 5-45°C",
      "writePointMappingChecked=yes",
      "twoSampleNormal=yes",
      "localManualLockout=none",
      "handledBy/handledAt/reviewedBy/reviewedAt 完整"
    ]
  };
}

function deriveQualityP0Count(quality, plan) {
  const summaryP0 = Number(quality.summary?.p0Count);
  const explicitDeviceCount = Array.isArray(quality.devices)
    ? quality.devices.filter((device) => device?.severity === "P0").length
    : 0;
  const planBlocked = Number(plan.summary?.blocked);
  if (quality.ok !== true || quality.summary?.canCompleteFinalControl === false || quality.summary?.evidenceIncomplete === true) {
    return Math.max(
      Number.isFinite(summaryP0) ? summaryP0 : 0,
      explicitDeviceCount,
      Number.isFinite(planBlocked) ? planBlocked : 0,
      1
    );
  }
  return Math.max(Number.isFinite(summaryP0) ? summaryP0 : 0, explicitDeviceCount);
}

function fieldArmMentions(fieldArm, token) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return false;
  }
  const chunks = [
    ...((Array.isArray(fieldArm.blockingItems) ? fieldArm.blockingItems : []).map((item) => `${item.key || ""} ${item.label || ""} ${item.message || ""}`)),
    ...((Array.isArray(fieldArm.checks) ? fieldArm.checks : []).map((item) => `${item.key || ""} ${item.label || ""} ${item.message || ""}`))
  ];
  return chunks.some((item) => item.includes(normalizedToken));
}

function buildSiteAuthorizationPersistCommand(siteAuthorization) {
  if (!isSiteAuthorizationReadyToPersist(siteAuthorization)) {
    return buildSiteAuthorizationDraftCommand(siteAuthorization);
  }
  const after = siteAuthorization.after || {};
  const args = [
    `--authorized-by=${after.siteAuthorizationBy || ""}`,
    `--commissioning-owner=${after.commissioningOwner || ""}`,
    `--ba-owner=${after.baOwner || ""}`,
    `--window-start=${after.siteAuthorizationWindowStart || siteAuthorization.window?.start || ""}`,
    `--window-end=${after.siteAuthorizationWindowEnd || siteAuthorization.window?.end || ""}`,
    `--ba-confirm-armed=${after.baWriteConfirmArmed === true ? "true" : "false"}`,
    `--final-confirm-armed=${after.finalRolloutConfirmArmed === true ? "true" : "false"}`
  ];
  return `FCU_SITE_AUTHORIZATION_CONFIRM=I_APPROVE_FCU_SITE_AUTHORIZATION npm --prefix apps/chiller-bff run prepare:fcu-site-authorization -- ${args.join(" ")}`;
}

function buildSiteAuthorizationDraftCommand(siteAuthorization = {}) {
  const after = siteAuthorization.after || {};
  const nowMs = Date.now();
  const defaultStart = new Date(nowMs - 5 * 60 * 1000).toISOString();
  const defaultEnd = new Date(nowMs + 55 * 60 * 1000).toISOString();
  const args = [
    `--authorized-by=${after.siteAuthorizationBy || "业主值班长"}`,
    `--commissioning-owner=${after.commissioningOwner || "平台工程师"}`,
    `--ba-owner=${after.baOwner || "BA工程师"}`,
    `--window-start=${after.siteAuthorizationWindowStart || siteAuthorization.window?.start || defaultStart}`,
    `--window-end=${after.siteAuthorizationWindowEnd || siteAuthorization.window?.end || defaultEnd}`,
    `--ba-confirm-armed=${after.baWriteConfirmArmed === false ? "false" : "true"}`,
    `--final-confirm-armed=${after.finalRolloutConfirmArmed === false ? "false" : "true"}`
  ];
  return `npm --prefix apps/chiller-bff run prepare:fcu-site-authorization -- ${args.join(" ")}`;
}

function evaluateSiteAuthorizationWindow(siteAuthorization, nowMs = Date.now()) {
  const startValue = siteAuthorization?.after?.siteAuthorizationWindowStart || siteAuthorization?.window?.start || "";
  const endValue = siteAuthorization?.after?.siteAuthorizationWindowEnd || siteAuthorization?.window?.end || "";
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (!startValue || !endValue || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return {
      configured: false,
      active: false,
      status: "authorization_window_invalid"
    };
  }
  if (nowMs < start) {
    return {
      configured: true,
      active: false,
      status: "authorization_window_not_started"
    };
  }
  if (nowMs > end) {
    return {
      configured: true,
      active: false,
      status: "authorization_window_expired"
    };
  }
  return {
    configured: true,
    active: true,
    status: "authorization_window_active"
  };
}

function isSiteAuthorizationReadyToPersist(siteAuthorization) {
  if (siteAuthorization?.ok !== true || siteAuthorization?.persisted === true || siteAuthorization?.dryRun !== true) {
    return false;
  }
  const after = siteAuthorization.after || {};
  return Boolean(
    normalizeText(after.siteAuthorizationBy) &&
      normalizeText(after.commissioningOwner) &&
      normalizeText(after.baOwner) &&
      after.baWriteConfirmArmed === true &&
      after.finalRolloutConfirmArmed === true &&
      evaluateSiteAuthorizationWindow(siteAuthorization).active
  );
}

function buildReport(files) {
  const preflight = files.preflight.payload || {};
  const fieldArm = files.fieldArm.payload || {};
  const finalCompletion = files.finalCompletion.payload || {};
  const quality = files.quality.payload || {};
  const canaryPackage = files.canaryPackage.payload || {};
  const canaryReadiness = files.canaryReadiness?.payload || {};
  const adapterReadiness = files.adapterReadiness.payload || {};
  const canaryFeedback = files.canaryFeedback.payload || {};
  const canaryWindow = files.canaryWindow.payload || {};
  const plan = files.plan.payload || {};
  const fieldCloseout = files.fieldCloseout?.payload || {};
  const fieldWorkOrders = files.fieldWorkOrders?.payload || {};
  const fieldExecutionPack = files.fieldExecutionPack?.payload || {};
  const fieldHandoff = files.fieldHandoff?.payload || {};
  const fieldReturnTemplate = files.fieldReturnTemplate?.payload || {};
  const fieldSignoff = files.fieldSignoff?.payload || {};
  const fieldSignoffClean = files.fieldSignoffClean?.payload || {};
  const fieldSignoffPromote = files.fieldSignoffPromote?.payload || {};
  const finalControlFieldExecutionPack = files.finalControlFieldExecutionPack?.payload || {};
  const rollout = files.rollout.payload || {};
  const finalRolloutConfirmPresent =
    rollout.confirm?.finalRolloutConfirmPresent === true ||
    normalizeText(process.env.FCU_FINAL_CONTROL_ROLLOUT_CONFIRM) === CONFIRM_PHRASE;
  const smallBatchConfirmPresent =
    rollout.confirm?.smallBatchConfirmPresent === true ||
    normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM) === CONFIRM_PHRASE;
  const backendWriteGateReady =
    adapterReadiness.ok === true ||
    adapterReadiness.evidence?.health?.readOnlyMode === false ||
    (
      fieldArm.ok === true &&
      fieldArm.verdict === "field_arm_ready" &&
      !(Array.isArray(fieldArm.blockingItems) ? fieldArm.blockingItems : []).some((item) =>
        ["backend_write_gate", "execution_gate_open"].includes(normalizeText(item.key))
      )
    );
  const siteAuthorization = files.siteAuthorization.payload || {};
  const siteAuthorizationReadyToPersist = isSiteAuthorizationReadyToPersist(siteAuthorization);
  const siteAuthorizationPrepared = siteAuthorizationReadyToPersist || siteAuthorization.persisted === true;
  const siteAuthorizationWindowState = evaluateSiteAuthorizationWindow(siteAuthorization);
  const completionMilestones = finalCompletion.milestones || {};
  const firstCanary = finalCompletion.firstCanary || fieldArm.firstCanary || plan.firstCanary || "BGS01";
  const targetDevices = completionMilestones.allDevice?.targetDevices || plan.summary?.total || 0;
  const confirmedDevices = completionMilestones.allDevice?.confirmedDevices || 0;
  const remediationDevices = topQualityDevices(quality, 8);
  const qualityP0Count = deriveQualityP0Count(quality, plan);
  const stagedSetpointCount = Number(plan.summary?.stagedSetpoint ?? 0);
  const fieldCloseoutReady = fieldCloseout.summary?.readyForCanary === true;
  const canaryReady = canaryReadiness.summary?.canaryReady === true && canaryReadiness.verdict === "canary_ready";
  const signoffInputStaleRows = Number(fieldSignoffPromote.summary?.staleRows ?? fieldSignoffClean.summary?.staleRows ?? 0);
  const signoffInputPromoted = fieldSignoffPromote.fileMutation === true && fieldSignoffPromote.confirmMatched === true;
  const expectedSignoffRows = Number(fieldSignoff.summary?.expectedWorkOrders ?? 0);
  const completeSignoffRows = Number(fieldSignoff.summary?.completeRows ?? 0);
  const fieldSignoffComplete = expectedSignoffRows === 0 || fieldSignoff.summary?.signoffComplete === true;
  const actions = [];
  const qualityFieldPackage = quality.fieldPackage || {};
  const fieldRemediationPlaybook = buildFieldRemediationPlaybook(
    fieldWorkOrders,
    fieldReturnTemplate,
    fieldSignoff,
    firstCanary
  );

  if (fieldArmMentions(fieldArm, "site_authorization_approved")) {
    pushAction(actions, {
      key: "approve-site-authorization-in-3002",
      priority: "P0",
      phase: "authorization",
      action: siteAuthorizationReadyToPersist ? "确认并写入 3002 FCU 现场授权" : "在 3002 配置中心批准现场授权",
      target: "FCU control-policy.fieldAuthorization.siteAuthorizationStatus",
      command: siteAuthorization.ok === true ? buildSiteAuthorizationPersistCommand(siteAuthorization) : "",
      reason: siteAuthorizationReadyToPersist
        ? "授权准备报告已完成 dry-run，但尚未显式确认写入配置中心。"
        : "现场未授权时，3001 只能生成建议和预演，不能进入真实 BA 写入。",
      acceptance: "BFF control-policy executionGate.authorizationStatus=approved，field-preflight 不再因 site_authorization_approved 阻断",
      source: siteAuthorization.ok === true ? "siteAuthorization" : "fieldArm"
    });
  }
  if (!siteAuthorizationPrepared && fieldArmMentions(fieldArm, "site_authorization_owner_recorded")) {
    pushAction(actions, {
      key: "record-site-authorization-owners-in-3002",
      priority: "P0",
      phase: "authorization",
      action: "在 3002 补齐授权确认人、投运负责人和 BA 负责人",
      target: "fieldAuthorization.siteAuthorizationBy / commissioningOwner / baOwner",
      command: buildSiteAuthorizationDraftCommand(siteAuthorization),
      reason: "最终控制必须能追溯现场授权、平台执行和 BA 写点责任人。",
      acceptance: "BFF executionGate.authorizationOwnerReady=true，field-preflight 不再因 site_authorization_owner_recorded 阻断",
      source: "fieldArm"
    });
  }
  if (!siteAuthorizationPrepared && fieldArmMentions(fieldArm, "site_authorization_window_configured")) {
    pushAction(actions, {
      key: "configure-site-authorization-window-in-3002",
      priority: "P0",
      phase: "authorization",
      action: "在 3002 配置 FCU 真实写入授权窗口",
      target: "fieldAuthorization.siteAuthorizationWindowStart / siteAuthorizationWindowEnd",
      command: buildSiteAuthorizationDraftCommand(siteAuthorization),
      reason: "真实 BA 写入必须限定现场值守窗口，不能长期裸开。",
      acceptance: "BFF executionGate.authorizationWindowConfigured=true，且返回授权窗口起止时间",
      source: "fieldArm"
    });
  }
  if (!siteAuthorizationPrepared && fieldArmMentions(fieldArm, "site_authorization_window_active")) {
    pushAction(actions, {
      key: "activate-site-authorization-window",
      priority: "P0",
      phase: "authorization",
      action: "调整或等待 FCU 真实写入授权窗口生效",
      target: "fieldAuthorization.siteAuthorizationWindowStart / siteAuthorizationWindowEnd",
      command: buildSiteAuthorizationDraftCommand(siteAuthorization),
      reason: "真实 BA 写入只能在现场值守授权窗口内执行。",
      acceptance: "BFF executionGate.authorizationWindowActive=true，field-preflight 不再因 site_authorization_window_active 阻断",
      source: "fieldArm"
    });
  }
  if (!finalRolloutConfirmPresent) {
    pushAction(actions, {
      key: "set-final-rollout-confirm",
      priority: "P0",
      phase: "authorization",
      action: "设置最终控制总确认短语",
      target: "FCU_FINAL_CONTROL_ROLLOUT_CONFIRM",
      command: `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE}`,
      reason: "没有总确认时编排器不会调用 Canary/小批量/全量真实执行脚本。",
      acceptance: "最终编排报告 confirm.finalRolloutConfirmPresent=true",
      source: "finalRollout"
    });
  }
  if (!smallBatchConfirmPresent) {
    pushAction(actions, {
      key: "set-ba-write-confirm",
      priority: "P0",
      phase: "authorization",
      action: "设置 BA 写入确认短语",
      target: "FCU_SMALL_BATCH_CONFIRM",
      command: `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`,
      reason: "真实 BA 写入需要二次确认，防止误触发。",
      acceptance: "最终编排报告 confirm.smallBatchConfirmPresent=true",
      source: "finalRollout"
    });
  }
  if (!backendWriteGateReady && (finalCompletion.blockingItems || []).some((item) => item.key === "backend_write_gate")) {
    pushAction(actions, {
      key: "open-backend-write-gate",
      priority: "P0",
      phase: "environment",
      action: "关闭 BFF 只读总闸并重启",
      target: "READ_ONLY_MODE / CHILLER_READ_ONLY_MODE",
      command: "READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev",
      reason: "当前 readOnlyMode=true，后端禁止真实 BA 写入。",
      acceptance: "/healthz readOnlyMode=false，且 Arm-Check backend_write_gate 通过",
      source: "finalCompletion"
    });
  }
  if (preflight.ok !== true) {
    pushAction(actions, {
      key: "rerun-go-live-preflight",
      priority: "P0",
      phase: "preflight",
      action: "重跑上线前预检",
      target: "FCU go-live preflight",
      command: "npm --prefix apps/chiller-bff run check:fcu-go-live-preflight",
      reason: "预检必须为 go_live_ready 才允许真实下发。",
      acceptance: "docs/fcu-go-live-preflight-latest.json verdict=go_live_ready",
      source: "goLivePreflight"
    });
  }
  if (fieldArm.ok !== true) {
    pushAction(actions, {
      key: "rerun-field-arm",
      priority: "P0",
      phase: "field_arm",
      action: "重跑现场 Arm-Check",
      target: firstCanary,
      command: "npm --prefix apps/chiller-bff run check:fcu-field-arm",
      reason: "现场 Arm-Check 必须 ready，才能执行首台 Canary。",
      acceptance: "docs/fcu-field-arm-check-latest.json verdict=field_arm_ready",
      source: "fieldArm"
    });
  }
  if (completionMilestones.canary?.ok !== true) {
    pushAction(actions, {
      key: "execute-canary",
      priority: "P0",
      phase: "canary",
      action: "执行首台 Canary 并确认反馈",
      target: firstCanary,
      command: `FCU_CANARY_DEVICE_CODE=${firstCanary} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`,
      reason: "最终控制必须先完成首台真实下发和反馈确认。",
      acceptance: "canary mode=confirmed_canary_dispatch 且 verification.recordStatus=feedback_confirmed",
      source: "finalCompletion"
    });
  }
  if (completionMilestones.canary?.ok === true && completionMilestones.smallBatch?.ok !== true) {
    pushAction(actions, {
      key: "execute-small-batch",
      priority: "P1",
      phase: "small_batch",
      action: "执行小批量并确认反馈",
      target: "small batch whitelist",
      command: `FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch`,
      reason: "Canary 反馈确认后才允许扩大到小批量。",
      acceptance: "small-batch mode=confirmed_dispatch，所有设备 feedback_confirmed",
      source: "finalCompletion"
    });
  }
  if (qualityP0Count > 0) {
    pushAction(actions, {
      key: "remediate-p0-quality-devices",
      priority: "P0",
      phase: "quality",
      action: "整改通讯报警、0°C/无效温度和写点缺失设备",
      target: `${qualityP0Count} 台 P0 FCU`,
      command: "npm --prefix apps/chiller-bff run check:fcu-quality-remediation",
      reason: quality.summary?.evidenceIncomplete === true || quality.ok !== true
        ? "质量证据不完整或读取失败时必须按 P0 阻断处理，不能进入全量闭环。"
        : "P0 质量设备不能进入全量闭环。",
      acceptance: "communicationAlarm=0，zoneTemperatureC 在 5-45°C，启停/设定/风速写点映射通过，quality.status=ok，连续两次采样正常",
      source: "qualityRemediation"
    });
  }
  if (stagedSetpointCount > 0) {
    pushAction(actions, {
      key: "normalize-staged-setpoint-devices",
      priority: qualityP0Count > 0 ? "P1" : "P0",
      phase: "setpoint_normalization",
      action: "分步拉回设定反馈越界 FCU",
      target: `${stagedSetpointCount} 台 FCU`,
      command: "npm --prefix apps/chiller-bff run plan:fcu-all-device-dispatch",
      reason: "设定反馈越界设备不能一次性拉到目标值；需按 0.5-2.0°C 分步恢复后再进入全量闭环。",
      acceptance: "全量分批计划 stagedSetpoint=0，或每台设备形成已审批的分步执行记录和反馈确认。",
      source: "allDevicePlan"
    });
  }
  if (fieldCloseoutReady !== true) {
    pushAction(actions, {
      key: "close-field-remediation-before-canary",
      priority: "P0",
      phase: "field_closeout",
      action: "关闭 FCU 现场 P0 消缺后再进入 Canary",
      target: `${fieldCloseout.summary?.remainingDeviceCount ?? qualityP0Count} 台未关闭`,
      command: "npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout",
      reason: "只有质量整改清零、全量分批计划无设备阻断后，才允许进入首台真实写入 Canary。",
      acceptance: "docs/fcu-field-remediation-closeout-latest.json verdict=field_remediation_ready_for_canary",
      source: "fieldRemediationCloseout"
    });
  }
  if (signoffInputStaleRows > 0 && !signoffInputPromoted) {
    pushAction(actions, {
      key: "promote-current-signoff-input",
      priority: "P0",
      phase: "signoff_input",
      action: "确认提升 current-only 现场签字输入并归档旧行",
      target: FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
      command: "FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input",
      reason: `现场签字主输入仍包含 ${signoffInputStaleRows} 行旧工单，容易造成签字验收和 Canary 门禁反复跳变。`,
      acceptance: "fcu-field-remediation-signoff-promote-latest.json fileMutation=true，confirmMatched=true；随后重跑 check:fcu-field-remediation-signoff",
      source: "fieldRemediationSignoffPromote"
    });
  }
  if (!fieldSignoffComplete) {
    pushAction(actions, {
      key: "complete-field-remediation-signoff",
      priority: "P0",
      phase: "field_signoff",
      action: "补齐 FCU 现场消缺签字和复核字段",
      target: `${completeSignoffRows}/${expectedSignoffRows} 行已完成`,
      command: "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff",
      reason: "现场签字未完成时，Canary 总门禁必须阻断，不能进入真实 BA 写入。",
      acceptance: "fcu-field-remediation-signoff-latest.json summary.signoffComplete=true；随后重跑 closeout 和 Canary readiness",
      source: "fieldRemediationSignoff"
    });
  }
  if (canaryReady !== true) {
    pushAction(actions, {
      key: "pass-canary-readiness",
      priority: "P0",
      phase: "canary_readiness",
      action: "通过 FCU Canary 总门禁后再执行首台下发",
      target: canaryReadiness.firstCanary || firstCanary,
      command: "npm --prefix apps/chiller-bff run check:fcu-canary-readiness",
      reason: "首台 Canary 必须同时满足现场签字、实时 closeout、Arm-Check、BA 写适配器和执行包门禁，不能只看单个执行命令。",
      acceptance: "docs/fcu-canary-readiness-latest.json verdict=canary_ready 且 summary.canaryReady=true",
      source: "canaryReadiness"
    });
  }
  if (completionMilestones.smallBatch?.ok === true && completionMilestones.allDevice?.ok !== true) {
    pushAction(actions, {
      key: "execute-all-device-waves",
      priority: "P1",
      phase: "all_device",
      action: "执行全量剩余波次并确认反馈",
      target: `${confirmedDevices}/${targetDevices} 台`,
      command: `FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE} FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-all-device-dispatch`,
      reason: "小批量通过后，按全量分批计划补齐所有白名单设备反馈。",
      acceptance: `final completion allDevice.confirmedDevices=${targetDevices}`,
      source: "finalCompletion"
    });
  }

  const phases = [
    {
      key: "authorization",
      label: "现场授权",
      status: phaseStatus(
        finalRolloutConfirmPresent &&
          smallBatchConfirmPresent &&
          !actions.some((item) => item.key === "approve-site-authorization-in-3002"),
        true
      ),
      evidence: actions.some((item) => item.key === "approve-site-authorization-in-3002")
        ? "fieldArm.siteAuthorization"
        : "finalRollout.confirm/env"
    },
    {
      key: "environment",
      label: "写入环境",
      status: phaseStatus(backendWriteGateReady, !backendWriteGateReady && actions.some((item) => item.key === "open-backend-write-gate")),
      evidence: adapterReadiness.ok === true ? "baWriteAdapterReadiness" : "health.readOnlyMode"
    },
    {
      key: "preflight",
      label: "上线前预检",
      status: phaseStatus(preflight.ok === true && preflight.verdict === "go_live_ready", preflight.ok !== true),
      evidence: "goLivePreflight"
    },
    {
      key: "field_arm",
      label: "现场 Arm-Check",
      status: phaseStatus(fieldArm.ok === true && fieldArm.verdict === "field_arm_ready", fieldArm.ok !== true),
      evidence: "fieldArm"
    },
    {
      key: "canary_readiness",
      label: "Canary 总门禁",
      status: phaseStatus(canaryReady, !canaryReady),
      evidence: canaryReadiness.verdict || "canaryReadiness"
    },
    {
      key: "canary",
      label: "首台 Canary",
      status: phaseStatus(completionMilestones.canary?.ok === true, completionMilestones.canary?.ok !== true),
      evidence: firstCanary
    },
    {
      key: "small_batch",
      label: "小批量",
      status: phaseStatus(completionMilestones.smallBatch?.ok === true, completionMilestones.canary?.ok !== true ? false : completionMilestones.smallBatch?.ok !== true),
      evidence: `${completionMilestones.smallBatch?.devices || 0} 台`
    },
    {
      key: "quality",
      label: "质量整改",
      status: phaseStatus(qualityP0Count === 0, qualityP0Count > 0),
      evidence: `${qualityP0Count} 台 P0`
    },
    {
      key: "setpoint_normalization",
      label: "设定分步拉回",
      status: phaseStatus(stagedSetpointCount === 0, stagedSetpointCount > 0),
      evidence: `${stagedSetpointCount} 台`
    },
    {
      key: "field_closeout",
      label: "现场消缺关闭",
      status: phaseStatus(fieldCloseoutReady, fieldCloseoutReady !== true),
      evidence: fieldCloseout.verdict || "fieldRemediationCloseout"
    },
    {
      key: "signoff_input",
      label: "签字输入",
      status: phaseStatus(signoffInputStaleRows === 0 || signoffInputPromoted, signoffInputStaleRows > 0 && !signoffInputPromoted),
      evidence: signoffInputStaleRows > 0 ? `${signoffInputStaleRows} 行旧工单` : "current-only"
    },
    {
      key: "field_signoff",
      label: "现场签字",
      status: phaseStatus(fieldSignoffComplete, !fieldSignoffComplete),
      evidence: `${completeSignoffRows}/${expectedSignoffRows}`
    },
    {
      key: "all_device",
      label: "全量反馈",
      status: phaseStatus(completionMilestones.allDevice?.ok === true, completionMilestones.allDevice?.ok !== true),
      evidence: `${confirmedDevices}/${targetDevices}`
    }
  ];
  const p0OpenActions = actions.filter((item) => item.priority === "P0").length;
  return {
    ok: finalCompletion.ok === true && p0OpenActions === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_final_control_worklist",
    verdict: finalCompletion.ok === true && p0OpenActions === 0 ? "ready_to_archive" : "worklist_open",
    controlMutation: false,
    firstCanary,
    targetDevices,
    confirmedDevices,
    summary: {
      openActions: actions.length,
      p0OpenActions,
      qualityP0Devices: qualityP0Count,
      stagedSetpointDevices: stagedSetpointCount,
      fieldCloseoutReady,
      plannedDeviceCount: plan.summary?.plannedDeviceCount || 0,
      blockedDeviceCount: plan.summary?.blocked || 0
    },
    phases,
    actions,
    remediationDevices,
    fieldRemediationPlaybook,
    fieldPackages: {
      qualityRemediation: {
        csv: qualityFieldPackage.csv || "",
        markdown: qualityFieldPackage.markdown || files.quality.path.replace(/\.json$/, ".md"),
        json: qualityFieldPackage.json || files.quality.path
      },
      allDevicePlan: {
        markdown: files.plan.path.replace(/\.json$/, ".md"),
        json: files.plan.path,
        firstCanary: plan.firstCanary || firstCanary,
        total: plan.summary?.total ?? null,
        immediateReady: plan.summary?.immediateReady ?? null,
        stagedSetpoint: stagedSetpointCount,
        blocked: plan.summary?.blocked ?? null,
        plannedDeviceCount: plan.summary?.plannedDeviceCount ?? null,
        canCompleteAllNow: plan.summary?.canCompleteAllNow === true,
        stagedSetpointDevices: (Array.isArray(plan.stagedSetpointDevices) ? plan.stagedSetpointDevices : [])
          .slice(0, 12)
          .map((item) => ({
            deviceCode: item.deviceCode || "",
            deviceName: item.deviceName || "",
            setpointC: item.setpointC ?? null,
            zoneTemperatureC: item.zoneTemperatureC ?? null,
            blockedReasons: Array.isArray(item.blockedReasons) ? item.blockedReasons.slice(0, 8) : []
          })),
        blockedDevices: (Array.isArray(plan.blockedDevices) ? plan.blockedDevices : [])
          .slice(0, 12)
          .map((item) => ({
            deviceCode: item.deviceCode || "",
            deviceName: item.deviceName || "",
            setpointC: item.setpointC ?? null,
            zoneTemperatureC: item.zoneTemperatureC ?? null,
            blockedReasons: Array.isArray(item.blockedReasons) ? item.blockedReasons.slice(0, 8) : []
          }))
      },
      fieldRemediationCloseout: {
        csv: fieldCloseout.outputs?.csv || files.fieldCloseout?.path?.replace(/\.json$/, ".csv") || "",
        markdown: fieldCloseout.outputs?.markdown || files.fieldCloseout?.path?.replace(/\.json$/, ".md") || "",
        json: fieldCloseout.outputs?.json || files.fieldCloseout?.path || "",
        verdict: fieldCloseout.verdict || null,
        readyForCanary: fieldCloseoutReady,
        remainingDeviceCount: fieldCloseout.summary?.remainingDeviceCount ?? null
      },
      fieldRemediationWorkOrders: {
        csv: fieldWorkOrders.outputs?.csv || files.fieldWorkOrders?.path?.replace(/\.json$/, ".csv") || "",
        signoffInputCsv: fieldWorkOrders.outputs?.signoffInputCsv || FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
        markdown: fieldWorkOrders.outputs?.markdown || files.fieldWorkOrders?.path?.replace(/\.json$/, ".md") || "",
        json: fieldWorkOrders.outputs?.json || files.fieldWorkOrders?.path || "",
        totalWorkOrders: fieldWorkOrders.summary?.totalWorkOrders ?? null,
        openCount: fieldWorkOrders.summary?.openCount ?? null,
        requiresFieldSignoff: fieldWorkOrders.summary?.requiresFieldSignoff === true
      },
      fieldRemediationExecutionPack: {
        csv: fieldExecutionPack.outputs?.csv || files.fieldExecutionPack?.path?.replace(/\.json$/, ".csv") || "",
        markdown: fieldExecutionPack.outputs?.markdown || files.fieldExecutionPack?.path?.replace(/\.json$/, ".md") || "",
        json: fieldExecutionPack.outputs?.json || files.fieldExecutionPack?.path || "",
        totalDevices: fieldExecutionPack.summary?.totalDevices ?? null,
        openP0Devices: fieldExecutionPack.summary?.openP0Devices ?? null,
        reasonCounts: fieldExecutionPack.summary?.reasonCounts || {},
        executionOrder: (Array.isArray(fieldExecutionPack.executionOrder) ? fieldExecutionPack.executionOrder : [])
          .slice(0, 8)
          .map((item) => ({
            phase: item.phase || "",
            deviceCount: item.deviceCount ?? null,
            deviceCodes: Array.isArray(item.deviceCodes) ? item.deviceCodes.slice(0, 12) : [],
            owners: Array.isArray(item.owners) ? item.owners.slice(0, 8) : [],
            acceptance: item.acceptance || ""
          }))
      },
      fieldHandoff: {
        csv: fieldHandoff.outputFiles?.csv || files.fieldHandoff?.path?.replace(/\.json$/, ".csv") || "",
        markdown: fieldHandoff.outputFiles?.markdown || files.fieldHandoff?.path?.replace(/\.json$/, ".md") || "",
        json: fieldHandoff.outputFiles?.json || files.fieldHandoff?.path || "",
        openP0Devices: fieldHandoff.summary?.openP0Devices ?? null,
        staleSignoffRows: fieldHandoff.summary?.staleSignoffRows ?? null,
        signoffCompleteRows: fieldHandoff.summary?.signoffCompleteRows ?? null,
        signoffExpectedRows: fieldHandoff.summary?.signoffExpectedRows ?? null,
        nextAllowedStep: fieldHandoff.summary?.nextAllowedStep || "",
        currentOnlyCsv: fieldHandoff.outputFiles?.currentOnlyCsv || "",
        staleCsv: fieldHandoff.outputFiles?.staleCsv || "",
        signoffInputCsv: fieldHandoff.outputFiles?.signoffInputCsv || FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
        devices: (Array.isArray(fieldHandoff.devices) ? fieldHandoff.devices : [])
          .slice(0, 8)
          .map((item) => ({
            workOrderId: item.workOrderId || "",
            deviceCode: item.deviceCode || "",
            deviceName: item.deviceName || "",
            owner: item.owner || "",
            reasonLabels: Array.isArray(item.reasonLabels) ? item.reasonLabels.slice(0, 8) : [],
            todayAction: item.todayAction || ""
          }))
      },
      fieldReturnTemplate: {
        csv: fieldReturnTemplate.outputs?.csv || files.fieldReturnTemplate?.path?.replace(/\.json$/, ".csv") || "",
        markdown: fieldReturnTemplate.outputs?.markdown || files.fieldReturnTemplate?.path?.replace(/\.json$/, ".md") || "",
        json: fieldReturnTemplate.outputs?.json || files.fieldReturnTemplate?.path || "",
        deviceCount: fieldReturnTemplate.summary?.deviceCount ?? null,
        communicationBlocked: fieldReturnTemplate.summary?.communicationBlocked ?? null,
        temperatureBlocked: fieldReturnTemplate.summary?.temperatureBlocked ?? null,
        setpointBlocked: fieldReturnTemplate.summary?.setpointBlocked ?? null,
        draftSuggestibleDevices: fieldReturnTemplate.summary?.draftSuggestibleDevices ?? null,
        draftTemperatureSuggestions: fieldReturnTemplate.summary?.draftTemperatureSuggestions ?? null,
        draftSetpointSuggestions: fieldReturnTemplate.summary?.draftSetpointSuggestions ?? null,
        signoffCompleteRows: fieldReturnTemplate.summary?.signoffCompleteRows ?? null,
        signoffExpectedRows: fieldReturnTemplate.summary?.signoffExpectedRows ?? null,
        requiredColumns: Array.isArray(fieldReturnTemplate.requiredColumns) ? fieldReturnTemplate.requiredColumns : [],
        devices: (Array.isArray(fieldReturnTemplate.devices) ? fieldReturnTemplate.devices : [])
          .slice(0, 8)
          .map((item) => ({
            workOrderId: item.workOrderId || "",
            deviceCode: item.deviceCode || "",
            deviceName: item.deviceName || "",
            missingFields: Array.isArray(item.missingFields) ? item.missingFields.slice(0, 12) : [],
            reviewDraft: item.reviewDraft
              ? {
                  releaseDecisionDefault: item.reviewDraft.releaseDecisionDefault || "",
                  suggestedValues: item.reviewDraft.suggestedValues || {},
                  blockedAutoFillFields: Array.isArray(item.reviewDraft.blockedAutoFillFields)
                    ? item.reviewDraft.blockedAutoFillFields.slice(0, 8)
                    : [],
                  manualOnlyFields: Array.isArray(item.reviewDraft.manualOnlyFields)
                    ? item.reviewDraft.manualOnlyFields.slice(0, 8)
                    : []
                }
              : null,
            releaseCriteria: Array.isArray(item.releaseCriteria) ? item.releaseCriteria.slice(0, 8) : []
          }))
      },
      fieldRemediationSignoff: {
        csv: fieldSignoff.outputs?.csv || files.fieldSignoff?.path?.replace(/\.json$/, ".csv") || "",
        releaseMatrixCsv:
          fieldSignoff.outputs?.releaseMatrixCsv ||
          files.fieldSignoff?.path?.replace(/\.json$/, "-release-matrix.csv") ||
          "",
        inputCsv: fieldSignoff.source?.signoffCsv || FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
        markdown: fieldSignoff.outputs?.markdown || files.fieldSignoff?.path?.replace(/\.json$/, ".md") || "",
        json: fieldSignoff.outputs?.json || files.fieldSignoff?.path || "",
        signoffComplete: fieldSignoff.summary?.signoffComplete === true,
        completeRows: fieldSignoff.summary?.completeRows ?? null,
        expectedWorkOrders: fieldSignoff.summary?.expectedWorkOrders ?? null,
        stillRequiresRealtimeCloseout: fieldSignoff.summary?.stillRequiresRealtimeCloseout !== false,
        onsiteReleasePrecheck: fieldSignoff.onsiteReleasePrecheck
          ? {
              ok: fieldSignoff.onsiteReleasePrecheck.ok === true,
              onsiteReleaseReadyCount: fieldSignoff.onsiteReleasePrecheck.onsiteReleaseReadyCount ?? null,
              onsiteReleaseBlockedCount: fieldSignoff.onsiteReleasePrecheck.onsiteReleaseBlockedCount ?? null,
              canaryCandidateCount: fieldSignoff.onsiteReleasePrecheck.canaryCandidateCount ?? null,
              canaryStillBlockedCount: fieldSignoff.onsiteReleasePrecheck.canaryStillBlockedCount ?? null,
              blockFieldCounts: fieldSignoff.onsiteReleasePrecheck.blockFieldCounts || {},
              nextGlobalActions: Array.isArray(fieldSignoff.onsiteReleasePrecheck.nextGlobalActions)
                ? fieldSignoff.onsiteReleasePrecheck.nextGlobalActions.slice(0, 8)
                : [],
              devices: (Array.isArray(fieldSignoff.onsiteReleasePrecheck.devices)
                ? fieldSignoff.onsiteReleasePrecheck.devices
                : []
              ).slice(0, 8).map((item) => ({
                workOrderId: item.workOrderId || "",
                deviceCode: item.deviceCode || "",
                deviceName: item.deviceName || "",
                onsiteReleaseReady: item.onsiteReleaseReady === true,
                canEnterCanary: item.canEnterCanary === true,
                canaryBlockReason: item.canaryBlockReason || "",
                nextBlockingFields: Array.isArray(item.nextBlockingFields) ? item.nextBlockingFields.slice(0, 8) : [],
                nextAction: item.nextAction || ""
              }))
            }
          : null,
        openRecords: (Array.isArray(fieldSignoff.records) ? fieldSignoff.records : [])
          .filter((record) => record?.signoffComplete !== true)
          .slice(0, 6)
          .map((record) => ({
            workOrderId: record.workOrderId || "",
            deviceCode: record.deviceCode || "",
            deviceName: record.deviceName || "",
            issues: Array.isArray(record.issues) ? record.issues.slice(0, 10) : [],
            missingChecklist: (Array.isArray(record.missingChecklist) ? record.missingChecklist : [])
              .slice(0, 6)
              .map((item) => ({
                field: item.field || "",
                requiredValue: item.requiredValue || "",
                action: item.action || ""
              }))
          })),
        releaseMatrix: (Array.isArray(fieldSignoff.releaseMatrix) ? fieldSignoff.releaseMatrix : [])
          .slice(0, 8)
          .map((item) => ({
            workOrderId: item.workOrderId || "",
            deviceCode: item.deviceCode || "",
            deviceName: item.deviceName || "",
            owner: item.owner || "",
            signoffComplete: item.signoffComplete === true,
            canEnterCanary: item.canEnterCanary === true,
            canaryBlockReason: item.canaryBlockReason || "",
            missingFields: Array.isArray(item.missingFields) ? item.missingFields.slice(0, 8) : [],
            requiredValues: Array.isArray(item.requiredValues) ? item.requiredValues.slice(0, 8) : [],
            nextActions: Array.isArray(item.nextActions) ? item.nextActions.slice(0, 4) : [],
            releaseCriteria: Array.isArray(item.releaseCriteria) ? item.releaseCriteria.slice(0, 4) : [],
            verificationTarget: item.verificationTarget || "",
            rerunCommand: item.rerunCommand || ""
          }))
      },
      fieldRemediationSignoffCleanInput: {
        markdown: fieldSignoffClean.outputs?.markdown || files.fieldSignoffClean?.path?.replace(/\.json$/, ".md") || "",
        json: fieldSignoffClean.outputs?.json || files.fieldSignoffClean?.path || "",
        currentCsv: fieldSignoffClean.outputs?.currentCsv || files.fieldSignoffClean?.path?.replace(/clean-input-latest\.json$/, "current-only-latest.csv") || "",
        staleCsv: fieldSignoffClean.outputs?.staleCsv || files.fieldSignoffClean?.path?.replace(/clean-input-latest\.json$/, "stale-rows-latest.csv") || "",
        currentRows: fieldSignoffClean.summary?.currentRows ?? null,
        staleRows: fieldSignoffClean.summary?.staleRows ?? null,
        generatedMissingRows: fieldSignoffClean.summary?.generatedMissingRows ?? null
      },
      fieldRemediationSignoffPromote: {
        markdown: fieldSignoffPromote.outputs?.markdown || files.fieldSignoffPromote?.path?.replace(/\.json$/, ".md") || "",
        json: fieldSignoffPromote.outputs?.json || files.fieldSignoffPromote?.path || "",
        mode: fieldSignoffPromote.mode || null,
        fileMutation: fieldSignoffPromote.fileMutation === true,
        confirmMatched: fieldSignoffPromote.confirmMatched === true,
        currentRows: fieldSignoffPromote.summary?.currentRows ?? null,
        staleRows: fieldSignoffPromote.summary?.staleRows ?? null,
        signoffInputCsv: fieldSignoffPromote.target?.signoffInputCsv || FIELD_REMEDIATION_SIGNOFF_INPUT_CSV,
        backupCsv: fieldSignoffPromote.target?.backupCsv || ""
      },
      canaryExecution: {
        csv: canaryPackage.outputs?.csv || files.canaryPackage.path.replace(/\.json$/, ".csv"),
        markdown: canaryPackage.outputs?.markdown || files.canaryPackage.path.replace(/\.json$/, ".md"),
        json: canaryPackage.outputs?.json || files.canaryPackage.path,
        deviceCode: canaryPackage.canary?.deviceCode || firstCanary,
        verdict: canaryPackage.verdict || null
      },
      canaryReadiness: {
        markdown: canaryReadiness.outputs?.markdown || files.canaryReadiness?.path?.replace(/\.json$/, ".md") || "",
        json: canaryReadiness.outputs?.json || files.canaryReadiness?.path || "",
        verdict: canaryReadiness.verdict || null,
        canaryReady: canaryReadiness.summary?.canaryReady === true,
        blockedCount: canaryReadiness.summary?.blockedCount ?? null,
        firstCanary: canaryReadiness.firstCanary || firstCanary,
        readinessPlaybook: canaryReadiness.readinessPlaybook
          ? {
              canExecuteCanary: canaryReadiness.readinessPlaybook.canExecuteCanary === true,
              readyGateCount: canaryReadiness.readinessPlaybook.readyGateCount ?? null,
              blockedGateCount: canaryReadiness.readinessPlaybook.blockedGateCount ?? null,
              firstBlockedPhase: canaryReadiness.readinessPlaybook.firstBlockedPhase || null,
              firstBlockedOwner: canaryReadiness.readinessPlaybook.firstBlockedOwner || null,
              firstBlockedAction: canaryReadiness.readinessPlaybook.firstBlockedAction || null,
              fieldBlocked: canaryReadiness.readinessPlaybook.fieldBlocked === true,
              baBlocked: canaryReadiness.readinessPlaybook.baBlocked === true,
              canaryPackageBlocked: canaryReadiness.readinessPlaybook.canaryPackageBlocked === true,
              phasePlan: Array.isArray(canaryReadiness.readinessPlaybook.phasePlan)
                ? canaryReadiness.readinessPlaybook.phasePlan.map((item) => ({
                    key: item.key || "",
                    phase: item.phase || "",
                    owner: item.owner || "",
                    ready: item.ready === true,
                    blocking: item.blocking === true,
                    evidence: item.evidence || "",
                    sourceFile: item.sourceFile || "",
                    nextAction: item.nextAction || ""
                  }))
                : []
            }
          : null
      },
      finalControlFieldExecutionPack: {
        csv: finalControlFieldExecutionPack.outputFiles?.csv || files.finalControlFieldExecutionPack?.path?.replace(/\.json$/, ".csv") || "",
        markdown: finalControlFieldExecutionPack.outputFiles?.markdown || files.finalControlFieldExecutionPack?.path?.replace(/\.json$/, ".md") || "",
        json: finalControlFieldExecutionPack.outputFiles?.json || files.finalControlFieldExecutionPack?.path || "",
        ok: finalControlFieldExecutionPack.ok === true,
        totalDevices: finalControlFieldExecutionPack.summary?.totalDevices ?? null,
        openDevices: finalControlFieldExecutionPack.summary?.openDevices ?? null,
        canaryReadyDevices: finalControlFieldExecutionPack.summary?.canaryReadyDevices ?? null,
        signoffCompleteRows: finalControlFieldExecutionPack.summary?.signoffCompleteRows ?? null,
        signoffExpectedRows: finalControlFieldExecutionPack.summary?.signoffExpectedRows ?? null,
        finalGatePassed: finalControlFieldExecutionPack.summary?.finalGatePassed === true,
        canaryReady: finalControlFieldExecutionPack.summary?.canaryReady === true,
        finalReleaseChecklistReady: finalControlFieldExecutionPack.summary?.finalReleaseChecklistReady ?? null,
        finalReleaseChecklistTotal: finalControlFieldExecutionPack.summary?.finalReleaseChecklistTotal ?? null,
        firstBlocker: finalControlFieldExecutionPack.summary?.firstBlocker || "",
        nextAction: finalControlFieldExecutionPack.summary?.nextAction || "",
        controlMutation: finalControlFieldExecutionPack.controlMutation === true,
        dispatch: finalControlFieldExecutionPack.dispatch === true,
        finalReleaseChecklist: (Array.isArray(finalControlFieldExecutionPack.finalReleaseChecklist)
          ? finalControlFieldExecutionPack.finalReleaseChecklist
          : []
        ).map((item) => ({
          key: item.key || "",
          label: item.label || "",
          ok: item.ok === true,
          detail: item.detail || "",
          action: item.action || ""
        })),
        deviceQueue: (Array.isArray(finalControlFieldExecutionPack.deviceQueue)
          ? finalControlFieldExecutionPack.deviceQueue
          : []
        ).slice(0, 12).map((item) => ({
          sequence: item.sequence ?? null,
          workOrderId: item.workOrderId || "",
          deviceCode: item.deviceCode || "",
          deviceName: item.deviceName || "",
          owner: item.owner || "",
          canEnterCanary: item.canEnterCanary === true,
          signoffComplete: item.signoffComplete === true,
          reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 8) : [],
          missingFields: Array.isArray(item.missingFields) ? item.missingFields.slice(0, 12) : [],
          todayAction: item.todayAction || "",
          canaryBlockReason: item.canaryBlockReason || ""
        })),
        safetyBoundary: Array.isArray(finalControlFieldExecutionPack.safetyBoundary)
          ? finalControlFieldExecutionPack.safetyBoundary.slice(0, 8)
          : []
      },
      baWriteAdapterReadiness: {
        csv: adapterReadiness.outputs?.csv || files.adapterReadiness.path.replace(/\.json$/, ".csv"),
        markdown: adapterReadiness.outputs?.markdown || files.adapterReadiness.path.replace(/\.json$/, ".md"),
        json: adapterReadiness.outputs?.json || files.adapterReadiness.path,
        deviceCode: adapterReadiness.canary?.deviceCode || firstCanary,
        verdict: adapterReadiness.verdict || null
      },
      canaryFeedbackMonitor: {
        csv: canaryFeedback.outputs?.csv || files.canaryFeedback.path.replace(/\.json$/, ".csv"),
        markdown: canaryFeedback.outputs?.markdown || files.canaryFeedback.path.replace(/\.json$/, ".md"),
        json: canaryFeedback.outputs?.json || files.canaryFeedback.path,
        deviceCode: canaryFeedback.canary?.deviceCode || firstCanary,
        verdict: canaryFeedback.verdict || null,
        feedbackStatus: canaryFeedback.canary?.feedbackStatus || null
      },
      canaryWindow: {
        markdown: canaryWindow.outputs?.markdown || files.canaryWindow.path.replace(/\.json$/, ".md"),
        json: canaryWindow.outputs?.json || files.canaryWindow.path,
        deviceCode: canaryWindow.canary?.deviceCode || firstCanary,
        verdict: canaryWindow.verdict || null,
        mode: canaryWindow.mode || null,
        controlMutation: canaryWindow.controlMutation === true
      },
      siteAuthorization: {
        markdown: files.siteAuthorization.path.replace(/\.json$/, ".md"),
        json: files.siteAuthorization.path,
        ok: siteAuthorization.ok === true,
        persisted: siteAuthorization.persisted === true,
        dryRun: siteAuthorization.dryRun === true,
        controlMutation: siteAuthorization.controlMutation === true,
        windowActive: siteAuthorizationWindowState.active,
        windowStatus: siteAuthorizationWindowState.status,
        confirmMatched: siteAuthorization.confirmMatched === true
      }
    },
    reportStatuses: Object.fromEntries(
      Object.entries(files).map(([key, value]) => [key, { ok: value.ok, path: value.path, error: value.error || null }])
    )
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制投运清单");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 结论: ${report.ok ? "可归档" : "仍需处理"}`);
  lines.push(`- 首台 Canary: ${report.firstCanary}`);
  lines.push(`- 全量反馈: ${report.confirmedDevices}/${report.targetDevices}`);
  lines.push(`- P0 动作: ${report.summary.p0OpenActions}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 阶段");
  lines.push("");
  lines.push("| 阶段 | 状态 | 证据 |");
  lines.push("|---|---|---|");
  for (const phase of report.phases) {
    lines.push(`| ${phase.label} | ${phase.status} | ${phase.evidence || "--"} |`);
  }
  lines.push("");
  lines.push("## 动作清单");
  lines.push("");
  lines.push("| 优先级 | 阶段 | 动作 | 对象 | 命令 | 验收 |");
  lines.push("|---|---|---|---|---|---|");
  for (const action of report.actions) {
    lines.push(`| ${action.priority} | ${action.phase} | ${action.action} | ${action.target} | ${action.command ? `\`${action.command}\`` : "--"} | ${action.acceptance || "--"} |`);
  }
  if (report.remediationDevices.length > 0) {
    lines.push("");
    lines.push("## P0 质量设备");
    lines.push("");
    for (const device of report.remediationDevices) {
      lines.push(`- ${device.deviceCode} ${device.deviceName || ""}: ${(device.reasons || []).join(", ")}`);
      for (const action of (device.fieldActions || []).slice(0, 2)) {
        lines.push(`  - ${action}`);
      }
    }
  }
  if (report.fieldRemediationPlaybook?.deviceCount > 0) {
    lines.push("");
    lines.push("## 现场消缺作战表");
    lines.push("");
    lines.push(`- 首台 Canary: ${report.fieldRemediationPlaybook.firstCanary || report.firstCanary}`);
    lines.push(`- Canary 是否被现场消缺阻断: ${report.fieldRemediationPlaybook.canaryBlockedByField ? "是" : "否"}`);
    lines.push(`- 待处理设备: ${report.fieldRemediationPlaybook.deviceCount}`);
    lines.push("- 推荐顺序:");
    for (const item of report.fieldRemediationPlaybook.recommendedOrder || []) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
    lines.push("| 阻断类别 | 设备 |");
    lines.push("|---|---|");
    for (const group of report.fieldRemediationPlaybook.reasonGroups || []) {
      lines.push(`| ${group.reason || "--"} | ${(group.devices || []).join("、") || "--"} |`);
    }
    lines.push("");
    lines.push("| 设备 | 当前阻断 | 待补字段 | 现场顺序 |");
    lines.push("|---|---|---|---|");
    for (const device of report.fieldRemediationPlaybook.devices || []) {
      lines.push(`| ${device.deviceCode || "--"} ${device.deviceName || ""} | ${(device.reasonLabels || device.reasons || []).join("、") || "--"} | ${(device.missingFields || []).join("、") || "--"} | ${(device.fieldPriority || []).join(" -> ") || "--"} |`);
    }
    lines.push("");
  }
  if (report.fieldPackages?.canaryExecution?.json) {
    lines.push("");
    lines.push("## 首台 Canary 执行包");
    lines.push("");
    lines.push(`- 设备: ${report.fieldPackages.canaryExecution.deviceCode || report.firstCanary}`);
    lines.push(`- 状态: ${report.fieldPackages.canaryExecution.verdict || "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.canaryExecution.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.canaryExecution.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.canaryExecution.csv}`);
  }
  if (report.fieldPackages?.fieldRemediationCloseout?.json) {
    lines.push("## 现场消缺关闭");
    lines.push("");
    lines.push(`- 状态: ${report.fieldPackages.fieldRemediationCloseout.verdict || "--"}`);
    lines.push(`- 可进入 Canary: ${report.fieldPackages.fieldRemediationCloseout.readyForCanary ? "是" : "否"}`);
    lines.push(`- 未关闭设备: ${report.fieldPackages.fieldRemediationCloseout.remainingDeviceCount ?? "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationCloseout.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationCloseout.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldRemediationCloseout.csv}`);
    lines.push("");
  }
  if (report.fieldPackages?.fieldRemediationWorkOrders?.json) {
    lines.push("## 现场消缺工单");
    lines.push("");
    lines.push(`- 工单数: ${report.fieldPackages.fieldRemediationWorkOrders.totalWorkOrders ?? "--"}`);
    lines.push(`- 未关闭: ${report.fieldPackages.fieldRemediationWorkOrders.openCount ?? "--"}`);
    lines.push(`- 需要现场签字: ${report.fieldPackages.fieldRemediationWorkOrders.requiresFieldSignoff ? "是" : "否"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationWorkOrders.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationWorkOrders.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldRemediationWorkOrders.csv}`);
    lines.push(`- 现场填写 CSV: ${report.fieldPackages.fieldRemediationWorkOrders.signoffInputCsv}`);
    lines.push("");
  }
  if (report.fieldPackages?.fieldRemediationExecutionPack?.json) {
    lines.push("## 现场消缺执行包");
    lines.push("");
    lines.push(`- 待处理设备: ${report.fieldPackages.fieldRemediationExecutionPack.openP0Devices ?? "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationExecutionPack.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationExecutionPack.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldRemediationExecutionPack.csv}`);
    for (const item of report.fieldPackages.fieldRemediationExecutionPack.executionOrder || []) {
      lines.push(`- ${item.phase}: ${item.deviceCount ?? "--"} 台 (${(item.deviceCodes || []).join("、") || "--"})；验收: ${item.acceptance || "--"}`);
    }
    lines.push("");
  }
  if (report.fieldPackages?.fieldHandoff?.json) {
    lines.push("## 现场交接包");
    lines.push("");
    lines.push(`- 待处理 P0: ${report.fieldPackages.fieldHandoff.openP0Devices ?? "--"}`);
    lines.push(`- 过期签核行: ${report.fieldPackages.fieldHandoff.staleSignoffRows ?? "--"}`);
    lines.push(`- 现场签核: ${report.fieldPackages.fieldHandoff.signoffCompleteRows ?? "--"}/${report.fieldPackages.fieldHandoff.signoffExpectedRows ?? "--"}`);
    lines.push(`- 下一步: ${report.fieldPackages.fieldHandoff.nextAllowedStep || "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldHandoff.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldHandoff.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldHandoff.csv}`);
    lines.push(`- current-only CSV: ${report.fieldPackages.fieldHandoff.currentOnlyCsv || "--"}`);
    for (const item of report.fieldPackages.fieldHandoff.devices || []) {
      lines.push(`- ${item.deviceCode || "--"} ${item.deviceName || ""}: ${(item.reasonLabels || []).join("、") || "--"}；${item.todayAction || "--"}`);
    }
    lines.push("");
  }
  if (report.fieldPackages?.fieldReturnTemplate?.json) {
    lines.push("## 现场回填模板");
    lines.push("");
    lines.push(`- 待回填设备: ${report.fieldPackages.fieldReturnTemplate.deviceCount ?? "--"}`);
    lines.push(`- 通讯阻断: ${report.fieldPackages.fieldReturnTemplate.communicationBlocked ?? "--"}`);
    lines.push(`- 温度阻断: ${report.fieldPackages.fieldReturnTemplate.temperatureBlocked ?? "--"}`);
    lines.push(`- 设定反馈阻断: ${report.fieldPackages.fieldReturnTemplate.setpointBlocked ?? "--"}`);
    lines.push(`- 可参考草稿设备: ${report.fieldPackages.fieldReturnTemplate.draftSuggestibleDevices ?? "--"}`);
    lines.push(`- 温度可参考: ${report.fieldPackages.fieldReturnTemplate.draftTemperatureSuggestions ?? "--"}`);
    lines.push(`- 设定反馈可参考: ${report.fieldPackages.fieldReturnTemplate.draftSetpointSuggestions ?? "--"}`);
    lines.push(`- 现场签核: ${report.fieldPackages.fieldReturnTemplate.signoffCompleteRows ?? "--"}/${report.fieldPackages.fieldReturnTemplate.signoffExpectedRows ?? "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldReturnTemplate.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldReturnTemplate.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldReturnTemplate.csv}`);
    for (const item of report.fieldPackages.fieldReturnTemplate.devices || []) {
      lines.push(`- ${item.deviceCode || "--"} ${item.deviceName || ""}: 待补字段 ${(item.missingFields || []).join("、") || "按模板全部回填"}`);
      if (item.reviewDraft?.suggestedValues && Object.keys(item.reviewDraft.suggestedValues).length > 0) {
        lines.push(`  - 复核草稿: ${Object.entries(item.reviewDraft.suggestedValues).map(([field, value]) => `${field}:${value}`).join("；")}`);
      }
    }
    lines.push("");
  }
  if (report.fieldPackages?.fieldRemediationSignoff?.json) {
    lines.push("## 现场签字校验");
    lines.push("");
    lines.push(`- 签字完成: ${report.fieldPackages.fieldRemediationSignoff.signoffComplete ? "是" : "否"}`);
    lines.push(`- 完成行: ${report.fieldPackages.fieldRemediationSignoff.completeRows ?? "--"}/${report.fieldPackages.fieldRemediationSignoff.expectedWorkOrders ?? "--"}`);
    lines.push(`- 仍需实时 closeout: ${report.fieldPackages.fieldRemediationSignoff.stillRequiresRealtimeCloseout ? "是" : "否"}`);
    if (report.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck) {
      lines.push(`- 现场放行预检: ${report.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck.onsiteReleaseReadyCount ?? "--"} ready / ${report.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck.onsiteReleaseBlockedCount ?? "--"} blocked；Canary 仍阻断 ${report.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck.canaryStillBlockedCount ?? "--"} 台`);
    }
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationSignoff.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationSignoff.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.fieldRemediationSignoff.csv}`);
    lines.push(`- 逐台放行矩阵 CSV: ${report.fieldPackages.fieldRemediationSignoff.releaseMatrixCsv}`);
    lines.push(`- 输入 CSV: ${report.fieldPackages.fieldRemediationSignoff.inputCsv}`);
    lines.push("");
  }
  if (report.fieldPackages?.fieldRemediationSignoffCleanInput?.json) {
    lines.push("## 现场签字输入清理包");
    lines.push("");
    lines.push(`- 当前有效行: ${report.fieldPackages.fieldRemediationSignoffCleanInput.currentRows ?? "--"}`);
    lines.push(`- 旧行: ${report.fieldPackages.fieldRemediationSignoffCleanInput.staleRows ?? "--"}`);
    lines.push(`- 补生成缺失行: ${report.fieldPackages.fieldRemediationSignoffCleanInput.generatedMissingRows ?? "--"}`);
    lines.push(`- 当前有效 CSV: ${report.fieldPackages.fieldRemediationSignoffCleanInput.currentCsv}`);
    lines.push(`- 旧行归档 CSV: ${report.fieldPackages.fieldRemediationSignoffCleanInput.staleCsv}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationSignoffCleanInput.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationSignoffCleanInput.markdown}`);
    lines.push("");
  }
  if (report.fieldPackages?.fieldRemediationSignoffPromote?.json) {
    lines.push("## 现场签字输入提升");
    lines.push("");
    lines.push(`- 模式: ${report.fieldPackages.fieldRemediationSignoffPromote.mode || "--"}`);
    lines.push(`- 已确认: ${report.fieldPackages.fieldRemediationSignoffPromote.confirmMatched ? "是" : "否"}`);
    lines.push(`- 文件写入: ${report.fieldPackages.fieldRemediationSignoffPromote.fileMutation ? "是" : "否"}`);
    lines.push(`- 当前有效行: ${report.fieldPackages.fieldRemediationSignoffPromote.currentRows ?? "--"}`);
    lines.push(`- 旧行: ${report.fieldPackages.fieldRemediationSignoffPromote.staleRows ?? "--"}`);
    lines.push(`- 目标输入 CSV: ${report.fieldPackages.fieldRemediationSignoffPromote.signoffInputCsv}`);
    lines.push(`- 备份 CSV: ${report.fieldPackages.fieldRemediationSignoffPromote.backupCsv || "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.fieldRemediationSignoffPromote.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.fieldRemediationSignoffPromote.markdown}`);
    lines.push("");
  }
  if (report.fieldPackages?.canaryReadiness?.json) {
    lines.push("## Canary 总门禁");
    lines.push("");
    lines.push(`- 状态: ${report.fieldPackages.canaryReadiness.verdict || "--"}`);
    lines.push(`- 可执行 Canary: ${report.fieldPackages.canaryReadiness.canaryReady ? "是" : "否"}`);
    lines.push(`- 阻断项: ${report.fieldPackages.canaryReadiness.blockedCount ?? "--"}`);
    lines.push(`- 首台: ${report.fieldPackages.canaryReadiness.firstCanary || report.firstCanary}`);
    if (report.fieldPackages.canaryReadiness.readinessPlaybook) {
      const playbook = report.fieldPackages.canaryReadiness.readinessPlaybook;
      lines.push(`- Readiness 作战表: ${playbook.readyGateCount ?? "--"} ready / ${playbook.blockedGateCount ?? "--"} blocked`);
      lines.push(`- 第一阻断: ${playbook.firstBlockedPhase || "无"} / ${playbook.firstBlockedOwner || "无"}`);
      lines.push(`- 第一动作: ${playbook.firstBlockedAction || "无"}`);
      lines.push("");
      lines.push("| 阶段 | 责任 | 状态 | 证据 | 下一步 |");
      lines.push("|---|---|---|---|---|");
      for (const item of playbook.phasePlan || []) {
        lines.push(`| ${item.phase || "--"} | ${item.owner || "--"} | ${item.ready ? "通过" : "阻断"} | ${item.evidence || "--"} | ${item.nextAction || "--"} |`);
      }
    }
    lines.push(`- JSON: ${report.fieldPackages.canaryReadiness.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.canaryReadiness.markdown}`);
    lines.push("");
  }
  if (report.fieldPackages?.finalControlFieldExecutionPack?.json) {
    const pack = report.fieldPackages.finalControlFieldExecutionPack;
    lines.push("## 最终控制现场执行包");
    lines.push("");
    lines.push(`- 状态: ${pack.ok ? "ready" : "blocked"}`);
    lines.push(`- 设备队列: ${pack.openDevices ?? "--"}/${pack.totalDevices ?? "--"} 未放行`);
    lines.push(`- Canary 就绪设备: ${pack.canaryReadyDevices ?? "--"}`);
    lines.push(`- 现场签核: ${pack.signoffCompleteRows ?? "--"}/${pack.signoffExpectedRows ?? "--"}`);
    lines.push(`- 最终核对清单: ${pack.finalReleaseChecklistReady ?? "--"}/${pack.finalReleaseChecklistTotal ?? "--"}`);
    lines.push(`- 第一阻断: ${pack.firstBlocker || "--"}`);
    lines.push(`- 下一步: ${pack.nextAction || "--"}`);
    lines.push(`- 写入副作用: ${pack.controlMutation ? "存在" : "无"}`);
    lines.push(`- 真实下发: ${pack.dispatch ? "存在" : "无"}`);
    lines.push(`- JSON: ${pack.json}`);
    lines.push(`- Markdown: ${pack.markdown}`);
    lines.push(`- CSV: ${pack.csv}`);
    if ((pack.finalReleaseChecklist || []).length > 0) {
      lines.push("");
      lines.push("| 放行项 | 状态 | 细节 | 下一步 |");
      lines.push("|---|---|---|---|");
      for (const item of pack.finalReleaseChecklist || []) {
        lines.push(`| ${item.label || item.key || "--"} | ${item.ok ? "通过" : "阻断"} | ${item.detail || "--"} | ${item.action || "--"} |`);
      }
    }
    if ((pack.deviceQueue || []).length > 0) {
      lines.push("");
      lines.push("| 顺序 | 设备 | Canary | 阻断 | 今日动作 |");
      lines.push("|---|---|---|---|---|");
      for (const item of pack.deviceQueue || []) {
        lines.push(`| ${item.sequence ?? "--"} | ${item.deviceCode || "--"} ${item.deviceName || ""} | ${item.canEnterCanary ? "可进" : "阻断"} | ${(item.reasons || []).join("、") || item.canaryBlockReason || "--"} | ${item.todayAction || "--"} |`);
      }
    }
    lines.push("");
  }
  if (report.fieldPackages?.baWriteAdapterReadiness?.json) {
    lines.push("");
    lines.push("## BA 写适配器自检包");
    lines.push("");
    lines.push(`- 设备: ${report.fieldPackages.baWriteAdapterReadiness.deviceCode || report.firstCanary}`);
    lines.push(`- 状态: ${report.fieldPackages.baWriteAdapterReadiness.verdict || "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.baWriteAdapterReadiness.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.baWriteAdapterReadiness.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.baWriteAdapterReadiness.csv}`);
  }
  if (report.fieldPackages?.canaryFeedbackMonitor?.json) {
    lines.push("");
    lines.push("## 首台 Canary 反馈监视");
    lines.push("");
    lines.push(`- 设备: ${report.fieldPackages.canaryFeedbackMonitor.deviceCode || report.firstCanary}`);
    lines.push(`- 状态: ${report.fieldPackages.canaryFeedbackMonitor.verdict || "--"}`);
    lines.push(`- 反馈: ${report.fieldPackages.canaryFeedbackMonitor.feedbackStatus || "--"}`);
    lines.push(`- JSON: ${report.fieldPackages.canaryFeedbackMonitor.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.canaryFeedbackMonitor.markdown}`);
    lines.push(`- CSV: ${report.fieldPackages.canaryFeedbackMonitor.csv}`);
  }
  if (report.fieldPackages?.canaryWindow?.json) {
    lines.push("");
    lines.push("## 首台 Canary 投运窗口");
    lines.push("");
    lines.push(`- 设备: ${report.fieldPackages.canaryWindow.deviceCode || report.firstCanary}`);
    lines.push(`- 状态: ${report.fieldPackages.canaryWindow.verdict || "--"}`);
    lines.push(`- 模式: ${report.fieldPackages.canaryWindow.mode || "--"}`);
    lines.push(`- 写入副作用: ${report.fieldPackages.canaryWindow.controlMutation ? "存在" : "无"}`);
    lines.push(`- JSON: ${report.fieldPackages.canaryWindow.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.canaryWindow.markdown}`);
  }
  if (report.fieldPackages?.siteAuthorization?.json) {
    lines.push("");
    lines.push("## 现场授权准备");
    lines.push("");
    lines.push(`- 状态: ${report.fieldPackages.siteAuthorization.ok ? "ready" : "blocked"}`);
    lines.push(`- 已写配置中心: ${report.fieldPackages.siteAuthorization.persisted ? "是" : "否"}`);
    lines.push(`- Dry-run: ${report.fieldPackages.siteAuthorization.dryRun ? "是" : "否"}`);
    lines.push(`- 授权窗口生效: ${report.fieldPackages.siteAuthorization.windowActive ? "是" : "否"}`);
    lines.push(`- 写入副作用: ${report.fieldPackages.siteAuthorization.controlMutation ? "存在" : "无"}`);
    lines.push(`- JSON: ${report.fieldPackages.siteAuthorization.json}`);
    lines.push(`- Markdown: ${report.fieldPackages.siteAuthorization.markdown}`);
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

const qualityRefresh = refreshQualityRemediationReport();
const allDevicePlanRefresh = refreshAllDevicePlanReport();
const fieldRemediationCloseoutRefresh = refreshFieldRemediationCloseoutReport();
const fieldRemediationWorkOrdersRefresh = refreshFieldRemediationWorkOrdersReport();
const fieldRemediationExecutionPackRefresh = refreshFieldRemediationExecutionPackReport();
const fieldRemediationSignoffRefresh = refreshFieldRemediationSignoffReport();
const fieldRemediationSignoffCleanRefresh = refreshFieldRemediationSignoffCleanReport();
const fieldRemediationSignoffPromoteRefresh = refreshFieldRemediationSignoffPromoteReport();
const fieldHandoffRefresh = refreshFieldHandoffPackReport();
const fieldRemediationReturnTemplateRefresh = refreshFieldRemediationReturnTemplateReport();
const canaryReadinessRefresh = refreshCanaryReadinessReport();
const finalControlFieldExecutionPackRefresh = refreshFinalControlFieldExecutionPackReport();
const report = buildReport({
  preflight: readJsonFile(GO_LIVE_PREFLIGHT_JSON),
  fieldArm: readJsonFile(FIELD_ARM_JSON),
  finalCompletion: readJsonFile(FINAL_COMPLETION_JSON),
  quality: readJsonFile(QUALITY_REMEDIATION_JSON),
  canaryPackage: readJsonFile(CANARY_EXECUTION_PACKAGE_JSON),
  canaryReadiness: readJsonFile(CANARY_READINESS_JSON),
  adapterReadiness: readJsonFile(BA_WRITE_ADAPTER_READINESS_JSON),
  canaryFeedback: readJsonFile(CANARY_FEEDBACK_MONITOR_JSON),
  canaryWindow: readJsonFile(CANARY_WINDOW_JSON),
  plan: readJsonFile(ALL_DEVICE_PLAN_JSON),
  fieldCloseout: readJsonFile(FIELD_REMEDIATION_CLOSEOUT_JSON),
  fieldWorkOrders: readJsonFile(FIELD_REMEDIATION_WORK_ORDERS_JSON),
  fieldExecutionPack: readJsonFile(FIELD_REMEDIATION_EXECUTION_PACK_JSON),
  fieldHandoff: readJsonFile(FIELD_HANDOFF_PACK_JSON),
  fieldReturnTemplate: readJsonFile(FIELD_REMEDIATION_RETURN_TEMPLATE_JSON),
  fieldSignoff: readJsonFile(FIELD_REMEDIATION_SIGNOFF_JSON),
  fieldSignoffClean: readJsonFile(FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON),
  fieldSignoffPromote: readJsonFile(FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON),
  finalControlFieldExecutionPack: readJsonFile(FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON),
  rollout: readJsonFile(FINAL_ROLLOUT_JSON),
  siteAuthorization: readJsonFile(SITE_AUTHORIZATION_JSON)
});
report.qualityRefresh = qualityRefresh;
report.allDevicePlanRefresh = allDevicePlanRefresh;
report.fieldRemediationCloseoutRefresh = fieldRemediationCloseoutRefresh;
report.fieldRemediationWorkOrdersRefresh = fieldRemediationWorkOrdersRefresh;
report.fieldRemediationExecutionPackRefresh = fieldRemediationExecutionPackRefresh;
report.fieldRemediationSignoffRefresh = fieldRemediationSignoffRefresh;
report.fieldRemediationSignoffCleanRefresh = fieldRemediationSignoffCleanRefresh;
report.fieldRemediationSignoffPromoteRefresh = fieldRemediationSignoffPromoteRefresh;
report.fieldHandoffRefresh = fieldHandoffRefresh;
report.fieldRemediationReturnTemplateRefresh = fieldRemediationReturnTemplateRefresh;
report.canaryReadinessRefresh = canaryReadinessRefresh;
report.finalControlFieldExecutionPackRefresh = finalControlFieldExecutionPackRefresh;
writeReport(report);
console.log(`FCU_FINAL_CONTROL_WORKLIST ok=${report.ok} verdict=${report.verdict} p0=${report.summary.p0OpenActions} actions=${report.summary.openActions} mutation=false`);
console.log(`json=${OUTPUT_JSON}`);
console.log(`md=${OUTPUT_MD}`);
if (!report.ok) {
  process.exitCode = 2;
}

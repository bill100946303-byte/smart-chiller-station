import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const BFF_BASE_URL = normalizeText(process.env.BFF_BASE_URL) || "http://127.0.0.1:8787";
const APP_BASE_URL = normalizeText(process.env.APP_BASE_URL) || "";
const RUN_DEPENDENCIES = !["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_CLIENT_DEMO_SKIP_RUNS).toLowerCase()
);
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_CLIENT_DEMO_STRICT).toLowerCase()
);

const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_CLIENT_DEMO_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-client-demo-readiness-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_CLIENT_DEMO_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-client-demo-readiness-latest.md");
const MIN_SCREENSHOT_BYTES = parsePositiveInteger(
  process.env.OPTIMIZE_DEMO_CLIENT_DEMO_MIN_SCREENSHOT_BYTES,
  50 * 1024
);

const REPORTS = {
  diagnosticReadiness: path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.json"),
  diagnosticUiSmoke: path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-ui-smoke-latest.json"),
  fieldVerificationPackage: path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-verification-package-latest.json"),
  fieldCollectionPackage: path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-collection-package-latest.json"),
  fieldDataPreflight: path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.json"),
  fieldDataPromote: path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-promote-latest.json"),
  shadowSuite: path.resolve(ROOT_DIR, "docs/optimize-demo-140-shadow-suite-latest.json")
};

const VISUALS = {
  clientDemoReadinessScreenshot: path.resolve(
    ROOT_DIR,
    "output/playwright/optimize-demo-140-client-demo-readiness.png"
  )
};

const DOCS = {
  clientDemoAcceptance: path.resolve(ROOT_DIR, "docs/OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md"),
  advisorStatus: path.resolve(ROOT_DIR, "docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md"),
  demoRoutes: path.resolve(ROOT_DIR, "docs/DEMO_ROUTES_CURRENT.md")
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(normalizeText(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      readError: error instanceof Error ? error.message : String(error)
    };
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return `__READ_ERROR__${error instanceof Error ? error.message : String(error)}`;
  }
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function relFromBff(filePath) {
  return path.relative(BFF_DIR, filePath);
}

function pushUnique(target, message) {
  const normalized = normalizeText(message);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function runScript({ key, label, script, env = {} }) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [path.resolve(__dirname, script)], {
    cwd: BFF_DIR,
    env: {
      ...process.env,
      SITE_ID,
      BFF_BASE_URL,
      ...(APP_BASE_URL ? { APP_BASE_URL } : {}),
      ...env
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30
  });
  const endedAt = new Date().toISOString();
  return {
    key,
    label,
    script,
    exitCode: typeof result.status === "number" ? result.status : 1,
    signal: result.signal || null,
    startedAt,
    endedAt,
    stdout: normalizeText(result.stdout),
    stderr: normalizeText(result.stderr),
    error: result.error ? result.error.message : null
  };
}

function runDependencyScripts() {
  if (!RUN_DEPENDENCIES) {
    return [];
  }
  return [
    runScript({
      key: "diagnosticReadiness",
      label: "诊断可行性 API gate",
      script: "check-optimize-demo-diagnostic-readiness.js"
    }),
    runScript({
      key: "diagnosticUiSmoke",
      label: "登录态诊断矩阵 UI smoke",
      script: "check-b25-ui-smoke.js",
      env: {
        B25_UI_SMOKE_OPTIMIZE_DIAGNOSTIC_ONLY: "1",
        B25_SMOKE_OUTPUT_PATH: relFromBff(REPORTS.diagnosticUiSmoke)
      }
    }),
    runScript({
      key: "fieldVerificationPackage",
      label: "140 现场复核交付包",
      script: "check-optimize-demo-140-field-verification-package.js"
    }),
    runScript({
      key: "fieldCollectionPackage",
      label: "140 现场采集包 readiness",
      script: "check-optimize-demo-140-field-collection-package.js"
    }),
    runScript({
      key: "fieldDataPreflight",
      label: "140 正式现场 CSV 总预检",
      script: "check-optimize-demo-140-field-data-preflight.js"
    }),
    runScript({
      key: "fieldDataPromote",
      label: "140 正式现场 CSV 导入 Gate",
      script: "promote-optimize-demo-140-field-data-ledgers.js"
    }),
    runScript({
      key: "shadowSuite",
      label: "140 shadow suite",
      script: "check-optimize-demo-140-shadow-suite.js"
    })
  ];
}

function assertRunResults(runs, blockers) {
  for (const run of runs) {
    if (run.exitCode !== 0) {
      pushUnique(blockers, `${run.label} 退出码 ${run.exitCode}`);
    }
  }
}

function summarizeDiagnosticReadiness(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `诊断可行性报告读取失败：${report.readError}`);
    return null;
  }
  const matrix = report?.summary?.matrix || null;
  if (report?.finalDecision !== "DIAGNOSTIC_READINESS_READY") {
    pushUnique(blockers, `诊断可行性不是 DIAGNOSTIC_READINESS_READY：${report?.finalDecision || "--"}`);
  }
  if (matrix?.controlBoundary !== "read_only_or_shadow_only") {
    pushUnique(blockers, `诊断矩阵控制边界异常：${matrix?.controlBoundary || "--"}`);
  }
  if (Number(matrix?.total) !== 10) {
    pushUnique(blockers, `诊断矩阵总项异常：${matrix?.total ?? "--"}`);
  }
  if (Number(matrix?.readyNowCount) !== 4 || Number(matrix?.directionalCount) !== 5 || Number(matrix?.pointGapCount) !== 1) {
    pushUnique(
      blockers,
      `诊断矩阵计数与当前演示口径不一致：${matrix?.readyNowCount ?? "--"}/${matrix?.directionalCount ?? "--"}/${matrix?.pointGapCount ?? "--"}`
    );
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  return {
    finalDecision: report?.finalDecision || null,
    readyNowCount: matrix?.readyNowCount ?? null,
    directionalCount: matrix?.directionalCount ?? null,
    pointGapCount: matrix?.pointGapCount ?? null,
    total: matrix?.total ?? null,
    controlBoundary: matrix?.controlBoundary || null,
    reportJson: rel(REPORTS.diagnosticReadiness)
  };
}

function summarizeDiagnosticUiSmoke(report, blockers) {
  if (report?.readError) {
    pushUnique(blockers, `诊断 UI smoke 报告读取失败：${report.readError}`);
    return null;
  }
  const ui = report?.ui || {};
  const readiness = ui?.diagnosticReadiness || {};
  if (ui?.skipped === true) {
    pushUnique(blockers, `诊断 UI smoke 被跳过：${ui.reason || "--"}`);
  }
  if (readiness.finalDecision !== "UI_DIAGNOSTIC_READINESS_READY") {
    pushUnique(blockers, `诊断 UI smoke 不是 UI_DIAGNOSTIC_READINESS_READY：${readiness.finalDecision || "--"}`);
  }
  if (ui?.optimizeExecution?.noSubmitApproveDispatchRollback !== true) {
    pushUnique(blockers, "诊断 UI smoke 未证明跳过提交/审批/dispatch/回退。");
  }
  if (ui?.optimizeDemo?.hasDiagnosticReadinessSection !== true) {
    pushUnique(blockers, "页面未显示“数据资源与诊断可行性”。");
  }
  if (ui?.optimizeDemo?.hasDiagnosticReadinessNoFault !== true || ui?.optimizeDemo?.hasDiagnosticReadinessNoPlc !== true) {
    pushUnique(blockers, "页面未显示“不判定设备故障 / 不写 PLC”边界。");
  }
  if (ui?.optimizeDemo?.hasDiagnosticReadinessNoAutoDispatch !== true) {
    pushUnique(blockers, "页面文案疑似暗示自动下发。");
  }
  if (ui?.optimizeDemo?.hasChillerStagingAdvisorSection !== true) {
    pushUnique(blockers, "页面未显示“主机组合优化”。");
  }
  if (ui?.optimizeDemo?.hasChillerEmpiricalPerformance !== true) {
    pushUnique(blockers, "页面未显示“组合实测性能”口径。");
  }
  if (ui?.optimizeDemo?.hasChillerShadowVerification !== true) {
    pushUnique(blockers, "页面未显示“shadow 验证”。");
  }
  if (ui?.optimizeDemo?.hasChillerNoSingleCop !== true) {
    pushUnique(blockers, "页面未明确多机无单台流量时不计算单台 COP。");
  }
  if (ui?.optimizeDemo?.hasFieldCollectionPackageReadiness !== true) {
    pushUnique(blockers, "页面未显示现场采集包 readiness。");
  }
  if (ui?.optimizeDemo?.hasFormalCsvReadiness !== true) {
    pushUnique(blockers, "页面未显示正式 CSV 投放状态。");
  }
  if (ui?.optimizeDemo?.hasFormalCsvMissingDetails !== true) {
    pushUnique(blockers, "页面未列出 4 个正式 CSV 缺口文件。");
  }
  if (
    Number(readiness.readyNowCount) !== 4 ||
    Number(readiness.directionalCount) !== 5 ||
    Number(readiness.pointGapCount) !== 1 ||
    readiness.controlBoundary !== "read_only_or_shadow_only"
  ) {
    pushUnique(
      blockers,
      `页面诊断矩阵与当前演示口径不一致：${readiness.readyNowCount ?? "--"}/${readiness.directionalCount ?? "--"}/${readiness.pointGapCount ?? "--"} ${readiness.controlBoundary || "--"}`
    );
  }
  return {
    finalDecision: readiness.finalDecision || null,
    noSubmitApproveDispatchRollback: ui?.optimizeExecution?.noSubmitApproveDispatchRollback === true,
    readyNowCount: readiness.readyNowCount ?? null,
    directionalCount: readiness.directionalCount ?? null,
    pointGapCount: readiness.pointGapCount ?? null,
    controlBoundary: readiness.controlBoundary || null,
    chillerStagingVisible: ui?.optimizeDemo?.hasChillerStagingAdvisorSection === true,
    chillerEmpiricalPerformanceVisible: ui?.optimizeDemo?.hasChillerEmpiricalPerformance === true,
    chillerShadowVerificationVisible: ui?.optimizeDemo?.hasChillerShadowVerification === true,
    chillerNoSingleCopVisible: ui?.optimizeDemo?.hasChillerNoSingleCop === true,
    fieldCollectionPackageVisible: ui?.optimizeDemo?.hasFieldCollectionPackageReadiness === true,
    formalCsvReadinessVisible: ui?.optimizeDemo?.hasFormalCsvReadiness === true,
    formalCsvMissingDetailsVisible: ui?.optimizeDemo?.hasFormalCsvMissingDetails === true,
    pageUrl: ui?.optimizeDemo?.url || null,
    reportJson: rel(REPORTS.diagnosticUiSmoke)
  };
}

function summarizeFieldVerificationPackage(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `现场复核交付包读取失败：${report.readError}`);
    return null;
  }
  const checklist = report?.summary?.fieldVerificationChecklist || null;
  const summary = report?.summary?.engineeringSummary || {};
  if (report?.finalDecision !== "FIELD_VERIFICATION_PACKAGE_READY") {
    pushUnique(blockers, `现场复核交付包不是 FIELD_VERIFICATION_PACKAGE_READY：${report?.finalDecision || "--"}`);
  }
  if (checklist?.controlBoundary !== "read_only_point_verification_only") {
    pushUnique(blockers, `现场复核交付包边界异常：${checklist?.controlBoundary || "--"}`);
  }
  if (Number(checklist?.total) !== 7 || Number(checklist?.p0Count) !== 4 || Number(checklist?.p1Count) !== 3) {
    pushUnique(
      blockers,
      `现场复核交付包任务计数异常：total=${checklist?.total ?? "--"} p0=${checklist?.p0Count ?? "--"} p1=${checklist?.p1Count ?? "--"}`
    );
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  return {
    finalDecision: report?.finalDecision || null,
    fieldTaskSummary: summary.fieldTaskSummary || null,
    controlBoundary: summary.controlBoundary || checklist?.controlBoundary || null,
    p0Count: checklist?.p0Count ?? null,
    p1Count: checklist?.p1Count ?? null,
    reportJson: rel(REPORTS.fieldVerificationPackage),
    reportMarkdown: "docs/optimize-demo-140-field-verification-package-latest.md",
    reportHtml: "docs/optimize-demo-140-field-verification-package-latest.html"
  };
}

function summarizeFieldCollectionPackage(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `现场采集包 readiness 读取失败：${report.readError}`);
    return null;
  }
  if (report?.finalDecision !== "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT") {
    pushUnique(blockers, `现场采集包 readiness 不是 FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT：${report?.finalDecision || "--"}`);
  }
  const formalInputs = Array.isArray(report?.formalInputs) ? report.formalInputs : [];
  const missingFormalInputs = formalInputs.filter((item) => item?.status === "missing").length;
  const presentFormalInputs = formalInputs.filter((item) => item?.status === "present_with_rows").length;
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  return {
    finalDecision: report?.finalDecision || null,
    formalInputCount: formalInputs.length,
    missingFormalInputs,
    presentFormalInputs,
    templateCount: Array.isArray(report?.templates) ? report.templates.length : null,
    reportJson: rel(REPORTS.fieldCollectionPackage),
    reportMarkdown: "docs/optimize-demo-140-field-collection-package-latest.md"
  };
}

function summarizeFieldDataPreflight(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `正式现场 CSV 总预检读取失败：${report.readError}`);
    return null;
  }
  const finalDecision = report?.finalDecision || null;
  const acceptedForClientDemo = new Set([
    "FIELD_DATA_PREFLIGHT_READY",
    "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS",
    "FIELD_DATA_PREFLIGHT_PARTIAL"
  ]);
  const reportBlockers = Array.isArray(report?.blockers) ? report.blockers : [];
  if (!acceptedForClientDemo.has(finalDecision)) {
    pushUnique(blockers, `正式现场 CSV 总预检不可用于甲方演示：${finalDecision || "--"}`);
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else if (finalDecision === "FIELD_DATA_PREFLIGHT_READY") {
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else {
    reportBlockers.forEach((item) => pushUnique(warnings, item));
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const inputs = Array.isArray(report?.inputs) ? report.inputs : [];
  return {
    finalDecision,
    inputCount: inputs.length,
    presentInputs: inputs.filter((item) => item?.exists === true).length,
    missingInputs: inputs.filter((item) => item?.exists !== true).length,
    sensorStatus: report?.sensorLedger?.status || null,
    importStatus: report?.import?.status || null,
    controlBoundary: report?.controlBoundary || null,
    reportJson: rel(REPORTS.fieldDataPreflight),
    reportMarkdown: "docs/optimize-demo-140-field-data-preflight-latest.md"
  };
}

function summarizeFieldDataPromote(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `正式现场 CSV 导入 Gate 读取失败：${report.readError}`);
    return null;
  }
  const finalDecision = report?.finalDecision || null;
  const acceptedForClientDemo = new Set([
    "FIELD_DATA_PROMOTE_READY",
    "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT"
  ]);
  const reportBlockers = Array.isArray(report?.blockers) ? report.blockers : [];
  if (!acceptedForClientDemo.has(finalDecision)) {
    pushUnique(blockers, `正式现场 CSV 导入 Gate 不可用于甲方演示：${finalDecision || "--"}`);
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else if (finalDecision === "FIELD_DATA_PROMOTE_READY") {
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else {
    reportBlockers.forEach((item) => pushUnique(warnings, item));
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const inputs = Array.isArray(report?.inputs) ? report.inputs : [];
  return {
    finalDecision,
    preflightDecision: report?.preflight?.finalDecision || null,
    inputCount: inputs.length,
    presentInputs: inputs.filter((item) => item?.exists === true).length,
    missingInputs: inputs.filter((item) => item?.exists !== true).length,
    importStatus: report?.import?.status || null,
    controlBoundary: report?.controlBoundary || null,
    reportJson: rel(REPORTS.fieldDataPromote),
    reportMarkdown: "docs/optimize-demo-140-field-data-promote-latest.md"
  };
}

function summarizeShadowSuite(report, blockers, warnings) {
  if (report?.readError) {
    pushUnique(blockers, `140 shadow suite 报告读取失败：${report.readError}`);
    return null;
  }
  const components = report?.components || {};
  const expected = {
    advisors: "ADVISOR_CONTRACT_READY",
    diagnosticReadiness: "DIAGNOSTIC_READINESS_READY",
    fieldCollectionPackage: "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT",
    fieldDataPreflight: "FIELD_DATA_PREFLIGHT_READY_OR_WAITING",
    fieldDataPromote: "FIELD_DATA_PROMOTE_READY_OR_WAITING",
    uiCopy: "UI_BOUNDARY_COPY_READY",
    mutationGuard: "NO_CONTROL_MUTATION",
    tower: "GO_SHADOW",
    pump: "GO_SHADOW_ONLY",
    governance: "GO_SHADOW_PENDING"
  };
  if (report?.finalDecision !== "GO_SHADOW_PENDING") {
    pushUnique(blockers, `140 shadow suite 不是 GO_SHADOW_PENDING：${report?.finalDecision || "--"}`);
  }
  for (const [key, expectedDecision] of Object.entries(expected)) {
    const actual = components[key]?.finalDecision || null;
    if (
      key === "fieldDataPreflight" &&
      ["FIELD_DATA_PREFLIGHT_READY", "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS", "FIELD_DATA_PREFLIGHT_PARTIAL"].includes(actual)
    ) {
      continue;
    }
    if (
      key === "fieldDataPromote" &&
      ["FIELD_DATA_PROMOTE_READY", "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT"].includes(actual)
    ) {
      continue;
    }
    if (actual !== expectedDecision) {
      pushUnique(blockers, `${key} 结果异常：expected=${expectedDecision} actual=${actual || "--"}`);
    }
  }
  if (components?.tower?.latestExecutionId && components?.governance?.towerLatestExecution?.dispatch) {
    pushUnique(blockers, "最新 tower 待审单已出现 dispatch，不符合演示前只读/shadow 边界。");
  }
  if (components?.governance?.pumpLatestExecution?.dispatch) {
    pushUnique(blockers, "最新 pump 待审单已出现 dispatch，不符合演示前只读/shadow 边界。");
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  return {
    finalDecision: report?.finalDecision || null,
    advisors: components?.advisors?.finalDecision || null,
    diagnosticReadiness: components?.diagnosticReadiness?.finalDecision || null,
    fieldDataPreflight: components?.fieldDataPreflight?.finalDecision || null,
    fieldDataPromote: components?.fieldDataPromote?.finalDecision || null,
    uiCopy: components?.uiCopy?.finalDecision || null,
    mutationGuard: components?.mutationGuard?.finalDecision || null,
    tower: components?.tower?.finalDecision || null,
    pump: components?.pump?.finalDecision || null,
    governance: components?.governance?.finalDecision || null,
    reportJson: rel(REPORTS.shadowSuite),
    reportMarkdown: "docs/optimize-demo-140-shadow-suite-latest.md"
  };
}

function summarizeDocs(blockers) {
  const requiredText = {
    clientDemoAcceptance: [
      "AI 优化建议 + 数据边界透明 + shadow 审批演示",
      "不自动启停",
      "不写 PLC",
      "4 可做 / 5 疑似 / 1 补点",
      "现场复核交付包",
      "现场采集包",
      "output/playwright/optimize-demo-140-client-demo-readiness.png",
      "不能验收"
    ],
    advisorStatus: [
      "OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md",
      "UI_DIAGNOSTIC_READINESS_READY",
      "output/playwright/optimize-demo-140-client-demo-readiness.png"
    ],
    demoRoutes: ["shadow 验收挂起", "OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md", "不拆单台主机 COP"]
  };
  const result = {};
  for (const [key, filePath] of Object.entries(DOCS)) {
    const text = readText(filePath);
    const readOk = !text.startsWith("__READ_ERROR__");
    if (!readOk) {
      pushUnique(blockers, `${key} 文档读取失败：${text.replace("__READ_ERROR__", "")}`);
    }
    const missing = [];
    for (const expected of requiredText[key] || []) {
      if (!text.includes(expected)) {
        missing.push(expected);
        pushUnique(blockers, `${key} 文档缺少关键口径：${expected}`);
      }
    }
    result[key] = {
      path: rel(filePath),
      ok: readOk && missing.length === 0,
      missing
    };
  }
  return result;
}

function summarizeVisualEvidence(blockers) {
  const result = {};
  for (const [key, filePath] of Object.entries(VISUALS)) {
    let ok = false;
    let bytes = 0;
    let error = null;
    try {
      const stat = fs.statSync(filePath);
      bytes = stat.size;
      if (!stat.isFile()) {
        error = "not_file";
        pushUnique(blockers, `${key} 不是文件：${rel(filePath)}`);
      } else if (bytes < MIN_SCREENSHOT_BYTES) {
        error = `too_small_${bytes}_bytes`;
        pushUnique(blockers, `${key} 截图证据过小：${bytes} bytes < ${MIN_SCREENSHOT_BYTES} bytes`);
      } else {
        ok = true;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      pushUnique(blockers, `${key} 截图证据缺失：${rel(filePath)}`);
    }
    result[key] = {
      path: rel(filePath),
      ok,
      bytes,
      minBytes: MIN_SCREENSHOT_BYTES,
      error
    };
  }
  return result;
}

function renderMarkdown(report) {
  return `# 140 /optimize-demo 甲方演示 readiness

- 结论：${report.finalDecision}
- 站点：${report.siteId}
- BFF：${report.bffBaseUrl}
- 前端：${report.appBaseUrl || "--"}
- 生成时间：${report.generatedAt}

## 组件结果

| 项 | 结果 |
| --- | --- |
| 诊断 API gate | ${report.summary.diagnosticReadiness?.finalDecision || "--"} |
| 诊断 UI smoke | ${report.summary.diagnosticUiSmoke?.finalDecision || "--"} |
| 现场复核交付包 | ${report.summary.fieldVerificationPackage?.finalDecision || "--"} |
| 现场采集包 readiness | ${report.summary.fieldCollectionPackage?.finalDecision || "--"} |
| 正式现场 CSV 总预检 | ${report.summary.fieldDataPreflight?.finalDecision || "--"} |
| 正式现场 CSV 导入 Gate | ${report.summary.fieldDataPromote?.finalDecision || "--"} |
| 140 shadow suite | ${report.summary.shadowSuite?.finalDecision || "--"} |
| 控制副作用 | ${report.summary.shadowSuite?.mutationGuard || "--"} |
| 诊断矩阵 | ${report.summary.diagnosticReadiness ? `${report.summary.diagnosticReadiness.readyNowCount} 可做 / ${report.summary.diagnosticReadiness.directionalCount} 疑似 / ${report.summary.diagnosticReadiness.pointGapCount} 补点` : "--"} |
| 现场复核任务 | ${report.summary.fieldVerificationPackage?.fieldTaskSummary || "--"} |
| 正式现场 CSV | ${report.summary.fieldCollectionPackage ? `${report.summary.fieldCollectionPackage.presentFormalInputs} 已投放 / ${report.summary.fieldCollectionPackage.missingFormalInputs} 未投放` : "--"} |
| 正式 CSV 预检输入 | ${report.summary.fieldDataPreflight ? `${report.summary.fieldDataPreflight.presentInputs}/${report.summary.fieldDataPreflight.inputCount} 已投放` : "--"} |
| 正式 CSV 可导入 | ${report.summary.fieldDataPromote?.finalDecision === "FIELD_DATA_PROMOTE_READY" ? "yes" : "no"} |
| UI 无提交/审批/回退 | ${report.summary.diagnosticUiSmoke?.noSubmitApproveDispatchRollback === true ? "yes" : "no"} |
| UI 主机组合优化 | ${report.summary.diagnosticUiSmoke?.chillerStagingVisible === true && report.summary.diagnosticUiSmoke?.chillerNoSingleCopVisible === true ? "yes" : "no"} |
| UI 现场采集包/正式CSV | ${report.summary.diagnosticUiSmoke?.fieldCollectionPackageVisible === true && report.summary.diagnosticUiSmoke?.formalCsvReadinessVisible === true ? "yes" : "no"} |
| UI 正式CSV缺口明细 | ${report.summary.diagnosticUiSmoke?.formalCsvMissingDetailsVisible === true ? "yes" : "no"} |

## 视觉证据

| 证据 | 状态 | 大小 | 最小要求 | 路径 |
| --- | --- | ---: | ---: | --- |
${Object.entries(report.summary.visualEvidence).map(([key, item]) => `| ${key} | ${item.ok ? "ok" : "missing"} | ${item.bytes} | ${item.minBytes} | ${item.path} |`).join("\n")}

## 文档入口

| 文档 | 状态 | 路径 |
| --- | --- | --- |
${Object.entries(report.summary.docs).map(([key, item]) => `| ${key} | ${item.ok ? "ok" : "missing"} | ${item.path} |`).join("\n")}

## 阻断项

${report.blockers.length ? report.blockers.map((item) => `- ${item}`).join("\n") : "- 无"}

## 警告

${report.warnings.length ? report.warnings.map((item) => `- ${item}`).join("\n") : "- 无"}

## 对外口径

- 通过时表示可演示 AI 优化建议、诊断矩阵、shadow 审批和人工审阅边界。
- 不表示可真实 PLC 下发，不表示可自动启停主机，不表示进入 enforced。
- 若本报告为 NO_CLIENT_DEMO，只能演示静态说明和 blockers/warnings，不做 shadow 审批演示。
`;
}

async function main() {
  const runs = runDependencyScripts();
  const blockers = [];
  const warnings = [];
  assertRunResults(runs, blockers);

  const diagnosticReadiness = summarizeDiagnosticReadiness(readJson(REPORTS.diagnosticReadiness), blockers, warnings);
  const diagnosticUiSmoke = summarizeDiagnosticUiSmoke(readJson(REPORTS.diagnosticUiSmoke), blockers);
  const fieldVerificationPackage = summarizeFieldVerificationPackage(
    readJson(REPORTS.fieldVerificationPackage),
    blockers,
    warnings
  );
  const fieldCollectionPackage = summarizeFieldCollectionPackage(
    readJson(REPORTS.fieldCollectionPackage),
    blockers,
    warnings
  );
  const fieldDataPreflight = summarizeFieldDataPreflight(readJson(REPORTS.fieldDataPreflight), blockers, warnings);
  const fieldDataPromote = summarizeFieldDataPromote(readJson(REPORTS.fieldDataPromote), blockers, warnings);
  const shadowSuite = summarizeShadowSuite(readJson(REPORTS.shadowSuite), blockers, warnings);
  const visualEvidence = summarizeVisualEvidence(blockers);
  const docs = summarizeDocs(blockers);

  const report = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    appBaseUrl: APP_BASE_URL || null,
    finalDecision: blockers.length === 0 ? "CLIENT_DEMO_READY_SHADOW_PENDING" : "NO_CLIENT_DEMO",
    runs,
    summary: {
      diagnosticReadiness,
      diagnosticUiSmoke,
      fieldVerificationPackage,
      fieldCollectionPackage,
      fieldDataPreflight,
      fieldDataPromote,
      shadowSuite,
      visualEvidence,
      docs
    },
    blockers,
    warnings,
    reportFiles: {
      json: rel(OUTPUT_JSON),
      markdown: rel(OUTPUT_MD)
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 client demo readiness: ${report.finalDecision}\n`);
  process.stdout.write(
    `diagnostic=${diagnosticReadiness?.finalDecision || "--"} ui=${diagnosticUiSmoke?.finalDecision || "--"} fieldPackage=${fieldVerificationPackage?.finalDecision || "--"} fieldCollection=${fieldCollectionPackage?.finalDecision || "--"} fieldDataPreflight=${fieldDataPreflight?.finalDecision || "--"} fieldDataPromote=${fieldDataPromote?.finalDecision || "--"} suite=${shadowSuite?.finalDecision || "--"} mutation=${shadowSuite?.mutationGuard || "--"}\n`
  );
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (blockers.length) {
    process.stdout.write(`blockers=${blockers.length}\n`);
    blockers.slice(0, 12).forEach((item) => process.stdout.write(`- ${item}\n`));
  }
  if (warnings.length) {
    process.stdout.write(`warnings=${warnings.length}\n`);
    warnings.slice(0, 12).forEach((item) => process.stdout.write(`- ${item}\n`));
  }

  if (STRICT && report.finalDecision !== "CLIENT_DEMO_READY_SHADOW_PENDING") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`optimize-demo 140 client demo readiness failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

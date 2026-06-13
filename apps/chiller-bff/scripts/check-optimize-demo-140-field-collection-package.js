import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_STRICT).toLowerCase()
);

const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-collection-package-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-collection-package-latest.md");

const DATA_DIR = path.resolve(ROOT_DIR, "docs/field-data/optimize-demo-140");
const TEMPLATE_DIR = path.resolve(DATA_DIR, "templates");

const DOCS = {
  readme: path.resolve(DATA_DIR, "README.md"),
  chillerCollection: path.resolve(DATA_DIR, "CHILLER_COMBINATION_FIELD_COLLECTION.md"),
  chillerSamplingPlan: path.resolve(ROOT_DIR, "docs/OPTIMIZE_DEMO_140_CHILLER_SAMPLING_PLAN_CURRENT.md"),
  advisorStatus: path.resolve(ROOT_DIR, "docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md")
};

const TEMPLATES = {
  sensorLedger: {
    path: path.resolve(TEMPLATE_DIR, "sensor-calibration-installation.template.csv"),
    requiredHeaders: [
      "pointCode",
      "pointName",
      "sensorType",
      "systemSide",
      "equipmentId",
      "location",
      "installPosition",
      "unit",
      "rangeLow",
      "rangeHigh",
      "accuracyClass",
      "lastCalibrationDate",
      "calibrationDueDate",
      "calibrationProvider",
      "owner",
      "sourceSystem",
      "remark"
    ]
  },
  controlCommandFeedback: {
    path: path.resolve(TEMPLATE_DIR, "control-command-feedback.template.csv"),
    requiredHeaders: [
      "timestamp",
      "siteId",
      "loopKey",
      "equipmentType",
      "equipmentId",
      "signalRole",
      "pointCode",
      "pointName",
      "value",
      "unit",
      "controlMode",
      "sampleIntervalSec",
      "qualityFlag",
      "sourceSystem",
      "remark"
    ]
  },
  startStopEvent: {
    path: path.resolve(TEMPLATE_DIR, "start-stop-event.template.csv"),
    requiredHeaders: [
      "eventAt",
      "siteId",
      "equipmentType",
      "equipmentId",
      "eventType",
      "previousStatus",
      "nextStatus",
      "commandSource",
      "reasonCode",
      "runMinutesBeforeEvent",
      "stopMinutesBeforeEvent",
      "alarmActive",
      "sourceSystem",
      "remark"
    ]
  },
  controlParameter: {
    path: path.resolve(TEMPLATE_DIR, "control-parameter.template.csv"),
    requiredHeaders: [
      "effectiveAt",
      "siteId",
      "loopKey",
      "equipmentType",
      "equipmentId",
      "parameterKey",
      "parameterName",
      "value",
      "unit",
      "previousValue",
      "rollbackValue",
      "changeTicket",
      "approvedBy",
      "sourceSystem",
      "remark"
    ]
  },
  chillerCombinationSamplingLog: {
    path: path.resolve(TEMPLATE_DIR, "chiller-combination-sampling-log.template.csv"),
    requiredHeaders: [
      "windowStart",
      "windowEnd",
      "runningCombination",
      "combinationRunMinutes",
      "loadKwAvg",
      "loadKwMin",
      "loadKwMax",
      "combinationPlrPctAvg",
      "wetBulbCAvg",
      "wetBulbCMin",
      "wetBulbCMax",
      "chilledSupplyTempCAvg",
      "chilledReturnTempCAvg",
      "chillerPowerKwAvg",
      "stationPowerKwAvg",
      "comboCopAvg",
      "stationCopAvg",
      "alarmCount",
      "manualSwitchApproved",
      "operatorConfirmed",
      "sourceReportId",
      "remark"
    ]
  }
};

const FORMAL_INPUTS = {
  sensorLedger: {
    path: path.resolve(DATA_DIR, "sensor-calibration-installation.csv"),
    templateKey: "sensorLedger",
    label: "传感器校准/安装位置台账"
  },
  controlCommandFeedback: {
    path: path.resolve(DATA_DIR, "control-command-feedback.csv"),
    templateKey: "controlCommandFeedback",
    label: "控制命令/反馈高频趋势"
  },
  startStopEvent: {
    path: path.resolve(DATA_DIR, "start-stop-event.csv"),
    templateKey: "startStopEvent",
    label: "设备启停事件台账"
  },
  controlParameter: {
    path: path.resolve(DATA_DIR, "control-parameter.csv"),
    templateKey: "controlParameter",
    label: "PID/死区/延时参数台账"
  }
};

const LATEST_REPORTS = {
  sensorLedgerPreflight: path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.json"),
  chillerSamplingPlan: path.resolve(ROOT_DIR, "docs/optimize-demo-140-chiller-sampling-plan-latest.json"),
  diagnosticReadiness: path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.json"),
  clientDemoReadiness: path.resolve(ROOT_DIR, "docs/optimize-demo-140-client-demo-readiness-latest.json")
};

const REQUIRED_README_PHRASES = [
  "templates/",
  "sensor-calibration-installation.csv",
  "control-command-feedback.template.csv",
  "start-stop-event.template.csv",
  "control-parameter.template.csv",
  "CHILLER_COMBINATION_FIELD_COLLECTION.md",
  "check:optimize-demo-140-sensor-ledger-preflight",
  "check:optimize-demo-140-chiller-sampling-plan",
  "不自动启停主机",
  "不写真实 PLC"
];

const REQUIRED_CHILLER_COLLECTION_PHRASES = [
  "CH1",
  "CH2",
  "CH3",
  "CH4",
  "CH5",
  "CH6",
  "CH7",
  "1500RT",
  "1700RT",
  "CH2+CH5+CH7",
  "CH5+CH7",
  "CH4+CH7",
  "不拆单台主机 COP",
  "不为了采样由 AI 自动启停主机",
  "容量余量仍按 1500RT"
];

const REQUIRED_SAMPLING_PLAN_PHRASES = [
  "CHILLER_COMBINATION_FIELD_COLLECTION.md",
  "chiller-combination-sampling-log.template.csv",
  "不拆单机 COP",
  "不自动启停主机"
];

const REQUIRED_ADVISOR_STATUS_PHRASES = [
  "现场采样清单",
  "具体实时计数以 `docs/optimize-demo-140-chiller-sampling-plan-latest.json` 为准",
  "不能给真实切换收益承诺"
];

const REQUIRED_BOUNDARIES = [
  "不写真实 PLC",
  "不自动启停主机",
  "不自动修正测点",
  "不拆单台主机 COP",
  "不把单一组合样本高置信解释为切换节能结论",
  "模板本身不作为现场证据"
];

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function pushUnique(target, message) {
  const normalized = normalizeText(message);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return `__READ_ERROR__${error instanceof Error ? error.message : String(error)}`;
  }
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

function parseCsvHeader(text) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return [];
  }
  return firstLine.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
}

function countNonEmptyLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim()).length;
}

function checkDocument({ key, filePath, requiredPhrases }, blockers) {
  const text = readText(filePath);
  const exists = !text.startsWith("__READ_ERROR__");
  const missingPhrases = [];
  if (!exists) {
    pushUnique(blockers, `${key} 缺失：${rel(filePath)}`);
  } else {
    for (const phrase of requiredPhrases) {
      if (!text.includes(phrase)) {
        missingPhrases.push(phrase);
        pushUnique(blockers, `${key} 缺少必要口径：${phrase}`);
      }
    }
  }
  return {
    key,
    path: rel(filePath),
    exists,
    missingPhrases
  };
}

function checkTemplate(key, config, blockers) {
  const text = readText(config.path);
  const exists = !text.startsWith("__READ_ERROR__");
  const header = exists ? parseCsvHeader(text) : [];
  const missingHeaders = [];
  if (!exists) {
    pushUnique(blockers, `${key} 模板缺失：${rel(config.path)}`);
  } else {
    for (const headerName of config.requiredHeaders) {
      if (!header.includes(headerName)) {
        missingHeaders.push(headerName);
        pushUnique(blockers, `${key} 模板缺少表头：${headerName}`);
      }
    }
  }
  return {
    key,
    path: rel(config.path),
    exists,
    headerCount: header.length,
    requiredHeaderCount: config.requiredHeaders.length,
    missingHeaders
  };
}

function checkFormalInput(key, config, templatesByKey, blockers, warnings) {
  const text = readText(config.path);
  const exists = !text.startsWith("__READ_ERROR__");
  if (!exists) {
    pushUnique(warnings, `${config.label} 尚未投放：${rel(config.path)}`);
    return {
      key,
      label: config.label,
      path: rel(config.path),
      status: "missing",
      lineCount: 0
    };
  }

  const lineCount = countNonEmptyLines(text);
  const header = parseCsvHeader(text);
  const template = config.templateKey ? templatesByKey[config.templateKey] : null;
  const templateHeader = template?.exists ? parseCsvHeader(readText(path.resolve(ROOT_DIR, template.path))) : [];
  const headerMatchesTemplate =
    templateHeader.length > 0 &&
    header.length === templateHeader.length &&
    header.every((item, index) => item === templateHeader[index]);

  if (lineCount <= 1) {
    pushUnique(blockers, `${config.label} 已投放但没有数据行，不能作为现场证据：${rel(config.path)}`);
  }
  if (headerMatchesTemplate && lineCount <= 1) {
    pushUnique(blockers, `${config.label} 疑似只复制了模板表头：${rel(config.path)}`);
  }

  return {
    key,
    label: config.label,
    path: rel(config.path),
    status: lineCount > 1 ? "present_with_rows" : "present_header_only",
    lineCount,
    headerCount: header.length,
    headerMatchesTemplate
  };
}

function summarizeLatestReports(warnings) {
  const reports = {};
  const sensor = readJson(LATEST_REPORTS.sensorLedgerPreflight);
  reports.sensorLedgerPreflight = {
    path: rel(LATEST_REPORTS.sensorLedgerPreflight),
    finalDecision: sensor?.finalDecision || null,
    readError: sensor?.readError || null,
    blockers: Array.isArray(sensor?.blockers) ? sensor.blockers.length : null
  };
  if (sensor?.readError) {
    pushUnique(warnings, `传感器台账 latest 报告不可读：${sensor.readError}`);
  }

  const sampling = readJson(LATEST_REPORTS.chillerSamplingPlan);
  reports.chillerSamplingPlan = {
    path: rel(LATEST_REPORTS.chillerSamplingPlan),
    finalDecision: sampling?.finalDecision || null,
    coverageStatus: sampling?.coverageStatus || null,
    total: sampling?.sampleSource?.total ?? null,
    warnings: Array.isArray(sampling?.warnings) ? sampling.warnings.length : null,
    readError: sampling?.readError || null
  };
  if (sampling?.readError) {
    pushUnique(warnings, `主机组合采样 latest 报告不可读：${sampling.readError}`);
  }

  const diagnostic = readJson(LATEST_REPORTS.diagnosticReadiness);
  reports.diagnosticReadiness = {
    path: rel(LATEST_REPORTS.diagnosticReadiness),
    finalDecision: diagnostic?.finalDecision || null,
    matrix: diagnostic?.summary?.matrix || null,
    readError: diagnostic?.readError || null
  };

  const clientDemo = readJson(LATEST_REPORTS.clientDemoReadiness);
  reports.clientDemoReadiness = {
    path: rel(LATEST_REPORTS.clientDemoReadiness),
    finalDecision: clientDemo?.finalDecision || null,
    mutationBoundary: clientDemo?.summary?.mutationBoundary || null,
    readError: clientDemo?.readError || null
  };

  return reports;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# 140 现场采集包 readiness");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.finalDecision}\``);
  lines.push("");
  lines.push("## 1. 文档与模板");
  lines.push("");
  lines.push("| 项 | 状态 | 路径 |");
  lines.push("| --- | --- | --- |");
  for (const doc of report.documents) {
    lines.push(`| ${doc.key} | ${doc.exists ? "ok" : "missing"} | \`${doc.path}\` |`);
  }
  for (const template of report.templates) {
    const status = template.exists && template.missingHeaders.length === 0 ? "ok" : "blocked";
    lines.push(`| ${template.key} | ${status} | \`${template.path}\` |`);
  }

  lines.push("");
  lines.push("## 2. 正式现场输入状态");
  lines.push("");
  lines.push("| 输入 | 状态 | 行数 | 路径 |");
  lines.push("| --- | --- | ---: | --- |");
  for (const input of report.formalInputs) {
    lines.push(`| ${input.label} | \`${input.status}\` | ${input.lineCount} | \`${input.path}\` |`);
  }

  lines.push("");
  lines.push("## 3. Latest 报告引用");
  lines.push("");
  lines.push("| 报告 | 结论 | 关键状态 | 路径 |");
  lines.push("| --- | --- | --- | --- |");
  lines.push(
    `| 传感器台账预检 | \`${report.latestReports.sensorLedgerPreflight.finalDecision || "--"}\` | blockers=${report.latestReports.sensorLedgerPreflight.blockers ?? "--"} | \`${report.latestReports.sensorLedgerPreflight.path}\` |`
  );
  lines.push(
    `| 主机组合采样计划 | \`${report.latestReports.chillerSamplingPlan.finalDecision || "--"}\` | ${report.latestReports.chillerSamplingPlan.coverageStatus || "--"} / total=${report.latestReports.chillerSamplingPlan.total ?? "--"} | \`${report.latestReports.chillerSamplingPlan.path}\` |`
  );
  lines.push(
    `| 诊断 readiness | \`${report.latestReports.diagnosticReadiness.finalDecision || "--"}\` | ${report.latestReports.diagnosticReadiness.matrix?.readyNowCount ?? "--"} ready / ${report.latestReports.diagnosticReadiness.matrix?.directionalCount ?? "--"} directional / ${report.latestReports.diagnosticReadiness.matrix?.pointGapCount ?? "--"} point-gap | \`${report.latestReports.diagnosticReadiness.path}\` |`
  );
  lines.push(
    `| 甲方演示 readiness | \`${report.latestReports.clientDemoReadiness.finalDecision || "--"}\` | ${report.latestReports.clientDemoReadiness.mutationBoundary || "--"} | \`${report.latestReports.clientDemoReadiness.path}\` |`
  );

  lines.push("");
  lines.push("## 4. Blockers / Warnings");
  lines.push("");
  lines.push("Blockers:");
  if (report.blockers.length === 0) {
    lines.push("- 无。");
  } else {
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`);
    }
  }
  lines.push("");
  lines.push("Warnings:");
  if (report.warnings.length === 0) {
    lines.push("- 无。");
  } else {
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  lines.push("## 5. 边界");
  lines.push("");
  for (const boundary of report.boundaries) {
    lines.push(`- ${boundary}`);
  }
  lines.push("");
  lines.push("本检查只验证现场采集包是否可发给现场和是否存在误投放风险；不写 PLC、不创建 shadow 单、不判断真实节能。");
  return `${lines.join("\n")}\n`;
}

function main() {
  const blockers = [];
  const warnings = [];

  const documents = [
    checkDocument({ key: "field-data-readme", filePath: DOCS.readme, requiredPhrases: REQUIRED_README_PHRASES }, blockers),
    checkDocument(
      {
        key: "chiller-combination-field-collection",
        filePath: DOCS.chillerCollection,
        requiredPhrases: REQUIRED_CHILLER_COLLECTION_PHRASES
      },
      blockers
    ),
    checkDocument(
      {
        key: "chiller-sampling-plan",
        filePath: DOCS.chillerSamplingPlan,
        requiredPhrases: REQUIRED_SAMPLING_PLAN_PHRASES
      },
      blockers
    ),
    checkDocument(
      { key: "advisor-status", filePath: DOCS.advisorStatus, requiredPhrases: REQUIRED_ADVISOR_STATUS_PHRASES },
      blockers
    )
  ];

  const templates = Object.entries(TEMPLATES).map(([key, config]) => checkTemplate(key, config, blockers));
  const templatesByKey = Object.fromEntries(templates.map((template) => [template.key, template]));
  const formalInputs = Object.entries(FORMAL_INPUTS).map(([key, config]) =>
    checkFormalInput(key, config, templatesByKey, blockers, warnings)
  );
  const latestReports = summarizeLatestReports(warnings);

  const finalDecision =
    blockers.length > 0 ? "FIELD_COLLECTION_PACKAGE_BLOCKED" : "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT";
  const report = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    finalDecision,
    scope: "optimize-demo-140-field-collection-package",
    documents,
    templates,
    formalInputs,
    latestReports,
    boundaries: REQUIRED_BOUNDARIES,
    blockers,
    warnings
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(report));

  console.log(`optimize-demo 140 field collection package: ${report.finalDecision}`);
  console.log(`documents=${documents.length} templates=${templates.length} formalInputs=${formalInputs.length}`);
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`markdown=${OUTPUT_MD}`);
  if (warnings.length > 0) {
    console.log(`warnings=${warnings.length}`);
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
  if (blockers.length > 0) {
    console.error(`blockers=${blockers.length}`);
    for (const blocker of blockers) {
      console.error(`- ${blocker}`);
    }
  }

  if (blockers.length > 0 || (STRICT && report.finalDecision !== "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT")) {
    process.exitCode = 1;
  }
}

main();

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_FIELD_FILE = "docs/field-dictionary.json";
const DEFAULT_DISPLAY_FILE = "docs/field-display-dictionary-v1.json";

function parseArgs(argv) {
  const options = {
    field: DEFAULT_FIELD_FILE,
    display: DEFAULT_DISPLAY_FILE,
    report: null,
    failOn: "blocking"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--field" && next) {
      options.field = next;
      i += 1;
      continue;
    }
    if (token === "--display" && next) {
      options.display = next;
      i += 1;
      continue;
    }
    if (token === "--report" && next) {
      options.report = next;
      i += 1;
      continue;
    }
    if (token === "--fail-on" && next) {
      options.failOn = next;
      i += 1;
      continue;
    }
  }
  return options;
}

function readJson(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(fullPath, "utf8");
  return { fullPath, json: JSON.parse(text) };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function addIssue(collection, checkId, level, pathKey, message) {
  collection.push({ checkId, level, path: pathKey, message });
}

function checkFieldDisplayConsistency(fieldDict, displayDict) {
  const issues = [];
  const baseFields = asArray(fieldDict?.fields);
  const displayFields = asArray(displayDict?.fields);
  const nonBusiness = asArray(displayDict?.nonBusinessDirectFields);
  const baseFieldSet = new Set(baseFields.map((item) => item?.field_name).filter(Boolean));
  const fieldUnitMap = new Map(baseFields.map((item) => [item?.field_name, item?.unit]));

  const requiredDisplayLangKeys = ["zh", "en", "vi"];
  const requiredDisplaySections = ["displayName", "unitDisplay", "shortHint"];
  const requiredProtectedFields = new Set(["legacy.totalElectricity", "cooling_tower_power_kw"]);

  const allowedUnitMap = {
    kW: { zh: ["kw"], en: ["kw"], vi: ["kw"] },
    kWh: { zh: ["kwh"], en: ["kwh"], vi: ["kwh"] },
    "%": { zh: ["%"], en: ["%"], vi: ["%"] },
    Hz: { zh: ["hz"], en: ["hz"], vi: ["hz"] },
    "℃": { zh: ["℃"], en: ["degc", "°c"], vi: ["degc", "°c"] },
    台: { zh: ["台"], en: ["units"], vi: ["thiet bi"] },
    条: { zh: ["条"], en: ["items"], vi: ["muc"] },
    次: { zh: ["次"], en: ["times"], vi: ["lan"] },
    个: { zh: ["个"], en: ["items", "count"], vi: ["muc", "so luong"] },
    "-": { zh: ["-"], en: ["-"], vi: ["-"] }
  };
  const dynamicUnitFieldSet = new Set(["trend_value", "trend_min", "trend_max"]);
  const dynamicUnitExpected = { zh: "随指标", en: "metric-based", vi: "theo chi so" };

  if (displayFields.length === 0) {
    addIssue(issues, "FDCS-001", "blocking", "display.fields", "must be non-empty array");
  }
  if (baseFields.length === 0) {
    addIssue(issues, "FDCS-001", "blocking", "field-dictionary.fields", "must be non-empty array");
  }

  const displayKeySet = new Set();
  for (let i = 0; i < displayFields.length; i += 1) {
    const item = displayFields[i];
    const fieldKey = item?.fieldKey;
    const itemPath = `fields[${i}]`;
    if (!isNonEmptyString(fieldKey)) {
      addIssue(issues, "FDCS-002", "blocking", `${itemPath}.fieldKey`, "must be non-empty string");
      continue;
    }
    displayKeySet.add(fieldKey);
    if (!baseFieldSet.has(fieldKey)) {
      addIssue(
        issues,
        "FDCS-003",
        "blocking",
        `${itemPath}.fieldKey`,
        `unknown fieldKey "${fieldKey}" (not found in field-dictionary)`
      );
    }

    for (const section of requiredDisplaySections) {
      const sectionValue = item?.[section];
      if (!sectionValue || typeof sectionValue !== "object" || Array.isArray(sectionValue)) {
        addIssue(issues, "FDCS-004", "blocking", `${itemPath}.${section}`, "must be object");
        continue;
      }
      for (const langKey of requiredDisplayLangKeys) {
        if (!isNonEmptyString(sectionValue[langKey])) {
          addIssue(
            issues,
            "FDCS-004",
            "blocking",
            `${itemPath}.${section}.${langKey}`,
            "must be non-empty string"
          );
        }
      }
    }

    const shortHint = item?.shortHint || {};
    for (const langKey of requiredDisplayLangKeys) {
      const text = String(shortHint[langKey] || "");
      if (text.length > 32) {
        addIssue(
          issues,
          "FDCS-006",
          "blocking",
          `${itemPath}.shortHint.${langKey}`,
          `length ${text.length} exceeds 32`
        );
      } else if (text.length > 24) {
        addIssue(
          issues,
          "FDCS-006",
          "warning",
          `${itemPath}.shortHint.${langKey}`,
          `length ${text.length} exceeds recommended 24`
        );
      }
    }

    const dictUnit = fieldUnitMap.get(fieldKey);
    if (!isNonEmptyString(dictUnit)) {
      addIssue(
        issues,
        "FDCS-005",
        "blocking",
        `${itemPath}.fieldKey`,
        "cannot validate unit consistency because source unit is missing"
      );
    } else if (dynamicUnitFieldSet.has(fieldKey)) {
      for (const langKey of requiredDisplayLangKeys) {
        const actual = normalizeText(item?.unitDisplay?.[langKey]);
        const expected = normalizeText(dynamicUnitExpected[langKey]);
        if (actual !== expected) {
          addIssue(
            issues,
            "FDCS-005",
            "blocking",
            `${itemPath}.unitDisplay.${langKey}`,
            `expected "${dynamicUnitExpected[langKey]}", got "${item?.unitDisplay?.[langKey] || ""}"`
          );
        }
      }
    } else {
      const allowed = allowedUnitMap[dictUnit];
      if (!allowed) {
        addIssue(
          issues,
          "FDCS-005",
          "warning",
          `${itemPath}.fieldKey`,
          `no unit mapping rule for source unit "${dictUnit}"`
        );
      } else {
        for (const langKey of requiredDisplayLangKeys) {
          const actual = normalizeText(item?.unitDisplay?.[langKey]);
          const allowList = allowed[langKey] || [];
          if (!allowList.includes(actual)) {
            addIssue(
              issues,
              "FDCS-005",
              "blocking",
              `${itemPath}.unitDisplay.${langKey}`,
              `unit mismatch: source "${dictUnit}" does not allow "${item?.unitDisplay?.[langKey] || ""}" for ${langKey}`
            );
          }
        }
      }
    }

    if (!isNonEmptyString(item?.semanticNote)) {
      addIssue(issues, "FDCS-004", "blocking", `${itemPath}.semanticNote`, "must be non-empty string");
    }
    if (!isNonEmptyString(item?.compareConstraint)) {
      addIssue(issues, "FDCS-011", "warning", `${itemPath}.compareConstraint`, "must be non-empty string");
    }
  }

  if (!displayKeySet.has("cooling_tower_power_kw")) {
    addIssue(
      issues,
      "FDCS-009",
      "blocking",
      "fields",
      "missing cooling_tower_power_kw in display fields"
    );
  } else {
    const item = displayFields.find((entry) => entry?.fieldKey === "cooling_tower_power_kw");
    const hasCompositeWord =
      String(item?.displayName?.zh || "").includes("组合") || String(item?.semanticNote || "").includes("组合");
    if (!hasCompositeWord) {
      addIssue(
        issues,
        "FDCS-009",
        "blocking",
        "fields[cooling_tower_power_kw]",
        "displayName.zh or semanticNote must contain '组合'"
      );
    }
  }

  if (displayKeySet.has("legacy.totalElectricity")) {
    addIssue(
      issues,
      "FDCS-010",
      "blocking",
      "fields",
      "legacy.totalElectricity must not appear in business display fields[]"
    );
  }

  if (!Array.isArray(displayDict?.nonBusinessDirectFields)) {
    addIssue(issues, "FDCS-007", "blocking", "nonBusinessDirectFields", "must be array");
  }
  if (nonBusiness.length === 0) {
    addIssue(issues, "FDCS-007", "blocking", "nonBusinessDirectFields", "must include required protected fields");
  }

  const protectedFieldSet = new Set();
  for (let i = 0; i < nonBusiness.length; i += 1) {
    const item = nonBusiness[i];
    const itemPath = `nonBusinessDirectFields[${i}]`;
    if (!isNonEmptyString(item?.fieldKey)) {
      addIssue(issues, "FDCS-008", "blocking", `${itemPath}.fieldKey`, "must be non-empty string");
      continue;
    }
    protectedFieldSet.add(item.fieldKey);
    if (!["P0", "P1"].includes(item?.riskLevel)) {
      addIssue(issues, "FDCS-008", "blocking", `${itemPath}.riskLevel`, "must be P0 or P1");
    }
    if (!isNonEmptyString(item?.whyNotDirect)) {
      addIssue(issues, "FDCS-008", "blocking", `${itemPath}.whyNotDirect`, "must be non-empty string");
    }
    if (!isNonEmptyString(item?.frontendAlternative)) {
      addIssue(
        issues,
        "FDCS-008",
        "blocking",
        `${itemPath}.frontendAlternative`,
        "must be non-empty string"
      );
    }
  }

  for (const requiredField of requiredProtectedFields) {
    if (!protectedFieldSet.has(requiredField)) {
      addIssue(
        issues,
        "FDCS-007",
        "blocking",
        "nonBusinessDirectFields",
        `must include "${requiredField}"`
      );
    }
  }

  return issues;
}

function buildReport(options, issues) {
  const blockingCount = issues.filter((item) => item.level === "blocking").length;
  const warningCount = issues.filter((item) => item.level === "warning").length;
  const failOn = options.failOn === "warning" ? "warning" : "blocking";
  const shouldFail = failOn === "warning" ? blockingCount + warningCount > 0 : blockingCount > 0;

  return {
    specVersion: "1.0.0",
    status: shouldFail ? "fail" : "pass",
    summary: {
      failOn,
      blockingCount,
      warningCount
    },
    results: issues.map((item) => ({
      checkId: item.checkId,
      level: item.level,
      passed: false,
      path: item.path,
      message: item.message
    }))
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const bootstrapIssues = [];
  let fieldJson = null;
  let displayJson = null;
  let fieldPath = "";
  let displayPath = "";

  try {
    const loaded = readJson(options.field);
    fieldPath = loaded.fullPath;
    fieldJson = loaded.json;
  } catch (error) {
    addIssue(
      bootstrapIssues,
      "FDCS-001",
      "blocking",
      options.field,
      `read or parse failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    const loaded = readJson(options.display);
    displayPath = loaded.fullPath;
    displayJson = loaded.json;
  } catch (error) {
    addIssue(
      bootstrapIssues,
      "FDCS-001",
      "blocking",
      options.display,
      `read or parse failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const detailIssues = fieldJson && displayJson ? checkFieldDisplayConsistency(fieldJson, displayJson) : [];
  const report = buildReport(options, [...bootstrapIssues, ...detailIssues]);

  if (options.report) {
    const reportPath = path.resolve(process.cwd(), options.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(`Field display consistency check status: ${report.status}`);
  console.log(`- field: ${fieldPath || options.field}`);
  console.log(`- display: ${displayPath || options.display}`);
  console.log(`- blocking=${report.summary.blockingCount}, warning=${report.summary.warningCount}`);
  if (report.results.length > 0) {
    for (const item of report.results) {
      console.log(`- [${item.level}] ${item.path}: ${item.message}`);
    }
  }

  if (report.status === "fail") {
    process.exit(1);
  }
}

main();

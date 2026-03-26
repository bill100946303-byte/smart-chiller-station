#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {
    input: "/tmp/chiller_readiness_report.json",
    output: "/Users/billchow/Documents/智慧冷冻站/docs/ui-badge-state-v1.8.json"
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      options.input = argv[++i];
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      options.output = argv[++i];
      continue;
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pickBadgeText(pass) {
  return {
    "zh-CN": pass ? "非降级态：通过" : "非降级态：未通过",
    "en-US": pass ? "Non-Degraded: PASS" : "Non-Degraded: NOT PASS",
    "vi-VN": pass ? "Phi suy giảm: Đạt" : "Phi suy giảm: Chưa đạt"
  };
}

function main() {
  const options = parseArgs(process.argv);
  const readiness = readJson(options.input);

  const dashboardPass = readiness?.m123?.dashboard?.pass === true;
  const systemPass = readiness?.m123?.systemOverview?.pass === true;
  const globalPass = readiness?.nonDegradedReady === true;

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceReadinessReport: options.input,
    rule: "badge_result_must_come_from_backend_readiness_only",
    global: {
      pass: globalPass,
      text: pickBadgeText(globalPass)
    },
    pages: {
      dashboard: {
        pass: dashboardPass,
        text: pickBadgeText(dashboardPass)
      },
      systemOverview: {
        pass: systemPass,
        text: pickBadgeText(systemPass)
      }
    },
    evidence: {
      attribution: readiness?.attribution ?? null,
      ndFailedCount: readiness?.nd?.failedCount ?? null,
      m123: readiness?.m123 ?? null
    }
  };

  ensureDir(options.output);
  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`badge state written: ${options.output}\n`);
}

main();

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildByxPowerAssignmentCsv,
  buildByxPowerAssignmentRows,
  getByxPowerMonitoring
} from "../src/adapters/byxPowerAdapter.js";
import {
  buildByxPowerCheckConfigFromEnv,
  loadLocalEnvDefaults
} from "./check-byx-power-assignments.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const DEFAULT_OUTPUT_DIR = path.resolve(ROOT_DIR, "docs/byx");
const READ_ONLY_BOUNDARY = "read_only_no_open_close_no_scene_execute";

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function parseArgs(argv) {
  const args = {
    siteId: "",
    outputDir: process.env.BYX_POWER_HANDOFF_DIR || DEFAULT_OUTPUT_DIR
  };
  for (const item of argv) {
    if (item.startsWith("--site-id=")) {
      args.siteId = item.slice("--site-id=".length);
    } else if (item.startsWith("--output-dir=")) {
      args.outputDir = item.slice("--output-dir=".length);
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = normalizeText(row[key]) || "未填写";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildSummary(powerData, rows, files, options = {}) {
  const reviewStatusCounts = countBy(rows, "reviewLabel");
  const categoryCounts = countBy(rows, "suggestedCategoryLabel");
  const boundaryCounts = countBy(rows, "controlBoundary");
  const confirmedDeviceCount = rows.filter((row) => normalizeText(row.reviewLabel) === "已确认").length;
  return {
    ok: true,
    siteId: normalizeText(powerData?.site?.siteId) || options.siteId || "",
    generatedAt: powerData?.generatedAt || new Date().toISOString(),
    mode: "read_only_assignment_handoff",
    controlMutation: false,
    boundary: READ_ONLY_BOUNDARY,
    files,
    summary: {
      projectCount: powerData?.summary?.projectCount || 0,
      deviceCount: rows.length,
      onlineDeviceCount: powerData?.summary?.onlineDeviceCount || 0,
      diagnosticDeviceCount: powerData?.summary?.diagnosticDeviceCount || 0,
      confirmedDeviceCount,
      unconfirmedDeviceCount: rows.length - confirmedDeviceCount,
      reviewStatusCounts,
      categoryCounts,
      boundaryCounts
    },
    checks: {
      allRowsReadOnly: rows.every((row) => row.controlBoundary === READ_ONLY_BOUNDARY),
      openCloseConnected: false,
      sceneExecuteConnected: false,
      plcWriteConnected: false
    }
  };
}

function markdownTableFromCounts(counts) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .map(([label, count]) => `| ${label} | ${count} |`)
    .join("\n");
}

export function buildByxPowerAssignmentHandoff(powerData, options = {}) {
  if (!powerData?.ok || !powerData?.configured) {
    throw new Error(powerData?.missingConfig?.length
      ? `BYX power config missing: ${powerData.missingConfig.join(", ")}`
      : "BYX power monitoring data is not ready");
  }
  const siteId = normalizeText(powerData?.site?.siteId) || normalizeText(options.siteId) || "unknown";
  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const files = {
    csv: path.join(outputDir, `byx-power-assignment-${siteId}-latest.csv`),
    markdown: path.join(outputDir, `byx-power-assignment-${siteId}-handoff.md`),
    summaryJson: path.join(outputDir, `byx-power-assignment-${siteId}-summary.json`)
  };
  const rows = buildByxPowerAssignmentRows(powerData);
  const summary = buildSummary(powerData, rows, files, { siteId });
  const markdown = buildHandoffMarkdown(summary);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(files.csv, `\uFEFF${buildByxPowerAssignmentCsv(powerData)}`, "utf8");
  fs.writeFileSync(files.markdown, markdown, "utf8");
  fs.writeFileSync(files.summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

export function buildHandoffMarkdown(summary) {
  const s = summary.summary;
  return `# 百益信电力回路归属确认交付说明

## 结论

- 站点：${summary.siteId}
- 文件：\`${path.relative(ROOT_DIR, summary.files.csv)}\`
- 当前设备数：${s.deviceCount} 台
- 当前复核状态：${Object.entries(s.reviewStatusCounts).map(([label, count]) => `${count} 台${label}`).join("，")}
- 控制边界：只读采集，不接分合闸，不接场景执行，不反写 PLC

## 汇总

| 项目 | 数量 |
| --- | ---: |
| 百益信项目 | ${s.projectCount} |
| 设备总数 | ${s.deviceCount} |
| 在线设备 | ${s.onlineDeviceCount} |
| 诊断关注 | ${s.diagnosticDeviceCount} |
| 已确认归属 | ${s.confirmedDeviceCount} |
| 待确认归属 | ${s.unconfirmedDeviceCount} |

## 用途分布

| 用途 | 设备数 |
| --- | ---: |
${markdownTableFromCounts(s.categoryCounts)}

## 现场需要填写的列

| 列名 | 是否必填 | 填写要求 |
| --- | --- | --- |
| 业主确认用途 | 必填 | 从系统建议用途中确认或改正，例如：照明、插座、空调末端、弱电/IT、后勤用电、备用/其他 |
| 业主确认系统 | 建议必填 | 例如：办公配电、照明系统、空调末端、弱电机柜 |
| 安装位置 | 必填 | 现场可识别的位置，例如：电话厅、过道、前台、会议室、厨房 |
| 配电箱/回路 | 建议必填 | 配电箱名称和回路编号，例如：AL-1/回路05 |
| 现场备注 | 选填 | 用于记录“设备名称不准”“疑似备用”“需二次核查”等信息 |

不要修改以下列：

- 百益信项目ID
- 设备ID
- 设备名称
- 在线状态
- 开关状态
- 控制边界

## 重点复核设备

CSV 中 \`复核状态 = 需复核诊断\` 的设备优先核对现场回路归属和实际负载类型。当前主要是功率因数偏低、温度、漏电流或电压等诊断项，先确认用途是否正确，不代表可以远程操作开关。

## 导入命令

现场回填后，保存为 CSV，再执行：

\`\`\`bash
npm --prefix apps/chiller-bff run import:byx-power-assignments -- --input=/path/to/byx-power-assignment-${summary.siteId}.csv --site-id=${summary.siteId} --merge
\`\`\`

导入脚本只写本地 JSON 映射文件，不调用百益信控制接口、不调用 PLC、不执行场景。

## 验收命令

\`\`\`bash
npm --prefix apps/chiller-bff run check:byx-power-assignments -- --site-id=${summary.siteId} --min-confirmed=1
\`\`\`

通过标准：

- \`ok=true\`
- \`confirmedDeviceCount >= 1\`
- \`unmatchedAssignmentCount = 0\`
- 无 \`assignment_file_missing\`
- 无 \`confirmed_coverage_too_low\`

## 页面验收

打开：

\`\`\`text
http://127.0.0.1:3001/power-monitoring?siteId=${summary.siteId}
\`\`\`

应看到：

- 百益信设备总数 ${s.deviceCount} 台
- 归属确认数量大于 0
- 归属校验通过或阻断原因明确
- 页面仍显示只读边界：\`/Api/OpenOrClose\` 和 \`/Api/Scene/Execute\` 未接入运行端
`;
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/build-byx-power-assignment-handoff.js --site-id=140 [--output-dir=docs/byx]",
    "",
    "Notes:",
    "  - Reads current BYX devices through /Api/Project/List only.",
    "  - Writes CSV, Markdown handoff, and summary JSON for field owner confirmation.",
    "  - Does not call BYX OpenOrClose, scene execution, PLC, or any write API."
  ].join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    loadLocalEnvDefaults();
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const config = buildByxPowerCheckConfigFromEnv();
    const siteId = normalizeText(args.siteId) || config.defaultSiteId;
    const powerData = await getByxPowerMonitoring(config, siteId);
    const summary = buildByxPowerAssignmentHandoff(powerData, {
      siteId,
      outputDir: args.outputDir
    });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exit(1);
  }
}

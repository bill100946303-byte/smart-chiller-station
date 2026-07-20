import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function requireSingleH1(source, message) {
  const count = (source.match(/<h1(?:\s|>)/g) || []).length;
  if (count !== 1) {
    throw new Error(`${message}: expected 1, received ${count}`);
  }
}

const alarmSource = read("src/pages/AlarmPage.tsx");
const workOrderSource = read("src/pages/WorkOrdersPage.tsx");
const energySource = read("src/pages/EnergyAnalysisPage.tsx");
const diagnosticsSource = read("src/pages/OperationalDiagnosticsPage.tsx");

requireSingleH1(alarmSource, "alarm workspace page heading contract failed");
requireSingleH1(workOrderSource, "work-order workspace page heading contract failed");
requireSingleH1(energySource, "energy-analysis workspace page heading contract failed");
requireSingleH1(diagnosticsSource, "operational-diagnostics workspace page heading contract failed");

requireText(energySource, "countNegativeEnergyEvidence", "energy analysis must inspect negative energy evidence");
requireText(energySource, "data-energy-analysis-quality=", "energy analysis must expose a machine-checkable quality state");
requireText(energySource, "已停止总量、峰谷和平均值判读", "negative energy values must fail aggregate KPI interpretation closed");
requireText(energySource, 'value: energyStatisticsReady ? formatValue(energyStats.totalValue) : "不可用"', "invalid aggregate energy must not be displayed as a valid total");
requireText(energySource, "formatEnergyEvidenceValue", "negative raw energy evidence must remain visible for investigation");

requireText(diagnosticsSource, "OPERATIONAL_DIAGNOSTICS_TIMEOUT_MS = 12_000", "operational diagnostics must have a bounded read timeout");
requireText(diagnosticsSource, "Promise.race", "operational diagnostics timeout must race the source request");
requireText(diagnosticsSource, "已停止等待", "operational diagnostics timeout must explain the stopped wait state");
requireText(diagnosticsSource, "诊断链路不可用，禁止进入 shadow 验证", "diagnostics failure must not fail open into shadow validation");
requireText(diagnosticsSource, "诊断证据未返回，不能判定无硬阻断", "diagnostics failure must expose an explicit evidence blocker");
requireText(diagnosticsSource, "1 阻断 / 风险未知", "diagnostics failure must not report zero blockers");

console.log("Cross-site associated workspace contract passed.");
console.log("- checked one H1 for alarm, work-order, energy-analysis and diagnostics workspaces");
console.log("- checked negative-energy fail-closed KPI semantics");
console.log("- checked bounded operational-diagnostics loading");

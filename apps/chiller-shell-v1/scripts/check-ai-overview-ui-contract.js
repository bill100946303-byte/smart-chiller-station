import fs from "node:fs";
import path from "node:path";

const SHELL_ROOT = path.resolve(process.cwd());
const PAGE_FILE = path.join(SHELL_ROOT, "src/pages/AiOverviewPage.tsx");
const APP_FILE = path.join(SHELL_ROOT, "src/App.tsx");
const APP_SHELL_FILE = path.join(SHELL_ROOT, "src/layout/AppShell.tsx");
const ZH_CN_FILE = path.join(SHELL_ROOT, "src/i18n/zhCN.ts");
const STYLE_FILE = path.join(SHELL_ROOT, "src/styles/global.css");
const README_FILE = path.join(SHELL_ROOT, "README.md");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assertIncludes(source, needle, label, errors) {
  if (!source.includes(needle)) {
    errors.push(`${label}: missing \`${needle}\``);
  }
}

function assertNotIncludes(source, needle, label, errors) {
  if (source.includes(needle)) {
    errors.push(`${label}: should not include \`${needle}\``);
  }
}

function assertMatches(source, pattern, label, errors) {
  if (!pattern.test(source)) {
    errors.push(`${label}: pattern not found ${pattern}`);
  }
}

function main() {
  const errors = [];
  const pageSource = read(PAGE_FILE);
  const appSource = read(APP_FILE);
  const shellSource = read(APP_SHELL_FILE);
  const zhCnSource = read(ZH_CN_FILE);
  const styleSource = read(STYLE_FILE);
  const readmeSource = read(README_FILE);

  assertIncludes(appSource, "const AiOverviewPage = lazy(() => import(\"./pages/AiOverviewPage\"));", "route lazy import", errors);
  assertIncludes(appSource, "<Route path=\"/ai-overview\" element={renderLazyPage(AiOverviewPage)} />", "route registration", errors);
  assertIncludes(readmeSource, "- `/ai-overview`", "README route scope", errors);

  assertIncludes(shellSource, "defaultTo: \"/ai-overview\"", "AI nav default route", errors);
  assertIncludes(shellSource, "to: \"/ai-overview\"", "AI nav overview item", errors);
  assertIncludes(shellSource, "zhCN.appShell.navAiOverview", "AI nav localized label", errors);
  assertIncludes(zhCnSource, "navAiOverview: \"AI总览大屏\"", "AI nav zh-CN label", errors);

  [
    "智慧冷冻站 AI优化总览",
    "影子建议模式",
    "PLC安全边界在线",
    "AI只建议不接管",
    "人工确认后下发",
    "实时寄存器在线",
    "实时摘要驱动",
    "湿球",
    "最低冷凝温度",
    "实时接通后",
    "约束边界与回退条件",
    "复核与审计",
    "进入建议复核"
  ].forEach((copy) => assertIncludes(pageSource, copy, "operator-facing control boundary copy", errors));

  [
    "系统COP",
    "节能潜力",
    "当前负荷",
    "实时点数",
    "待确认建议",
    "冷站设备链路与运行状态",
    "AI优化建议队列",
    "PLC硬保护优先"
  ].forEach((copy) => assertIncludes(pageSource, copy, "AI overview information architecture", errors));

  [
    "冷却塔台数优化",
    "冷却泵频率复核",
    "冷冻泵频率微调",
    "实时运行数待接入",
    "待模型评估",
    "先恢复冷却泵运行/频率反馈",
    "先恢复冷冻泵运行/频率反馈"
  ].forEach((copy) => assertIncludes(pageSource, copy, "AI recommendation queue", errors));

  [
    "目标COP",
    "今日节电",
    "目标 7.35",
    "当前 6.90",
    "数据在线率 100%",
    "60/60",
    "当前 45Hz",
    "建议 43Hz",
    "+0.4% COP",
    "泵频可微调",
    "当前 28台运行",
    "建议 26台运行",
    "风机 48Hz",
    "+0.8% COP",
    "当前 30.4℃",
    "建议目标 29.8℃",
    "+0.6% COP",
    "冷却水出/进 30.4℃ / 35.1℃",
    "逼近度 2.6℃",
    "处于可优化区"
  ].forEach((copy) => assertNotIncludes(pageSource, copy, "AI recommendation source guard", errors));

  assertIncludes(pageSource, "fetchRuntimePointSummary", "runtime summary API wiring", errors);
  assertIncludes(pageSource, "fetchDashboardOverview", "dashboard overview API wiring", errors);
  assertIncludes(pageSource, "AI_OVERVIEW_REFRESH_MS = 15_000", "runtime refresh cadence", errors);
  assertIncludes(pageSource, "useState<string[]>([])", "approval state", errors);
  assertIncludes(pageSource, "pendingCount", "pending recommendation count", errors);
  assertIncludes(pageSource, "toggleApprove", "approval interaction handler", errors);
  assertIncludes(pageSource, "setApprovedIds", "approval state mutation", errors);
  assertIncludes(pageSource, "aria-expanded={isExpanded}", "recommendation disclosure accessibility", errors);
  assertIncludes(pageSource, "isApproved ? \"撤回\" : item.actionLabel", "approved button state copy", errors);

  assertIncludes(styleSource, "/* AI overview board: executable concept version for owner-facing demo review. */", "AI overview CSS marker", errors);
  assertIncludes(styleSource, ".content.is-subpage-compact:has(> .ai-overview-page)", "AI overview shell-scoped background", errors);
  assertIncludes(styleSource, "grid-template-rows: 56px 88px minmax(0, 1fr) 124px;", "desktop first-screen row contract", errors);
  assertIncludes(styleSource, "height: calc(100dvh - 150px);", "desktop shell viewport fit", errors);
  assertIncludes(styleSource, ".ai-kpi-card::after", "KPI decorative-line guard block", errors);
  assertMatches(styleSource, /\.ai-kpi-card::after\s*\{[\s\S]*?display:\s*none;/, "KPI no-overprint guard", errors);
  assertIncludes(styleSource, ".ai-kpi-card p", "KPI note readability guard", errors);
  assertIncludes(styleSource, "font-size: 11px;", "KPI note size guard", errors);
  assertIncludes(styleSource, "line-height: 1.15;", "KPI note line-height guard", errors);
  assertIncludes(styleSource, ".ai-rec-row.is-approved", "approved recommendation visual state", errors);
  assertIncludes(styleSource, ".ai-constraint-grid", "constraint grid layout", errors);
  assertIncludes(styleSource, ".ai-audit-copy", "review audit card layout", errors);
  assertIncludes(styleSource, "max-width: 100%;", "recommendation queue width guard", errors);
  assertIncludes(styleSource, "@media (max-width: 1180px)", "tablet responsive guard", errors);
  assertIncludes(styleSource, "@media (max-width: 760px)", "mobile responsive guard", errors);

  if (errors.length > 0) {
    console.error("AI overview UI contract check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("AI overview UI contract check passed.");
  console.log("- checked /ai-overview route and AI navigation entry");
  console.log("- checked shadow/advisory boundary and PLC safety copy");
  console.log("- checked recommendation approval interaction contract");
  console.log("- checked desktop fit and responsive CSS guards");
}

main();

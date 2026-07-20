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

const policySource = read("src/config/navigationPolicy.ts");
const shellSource = read("src/layout/AppShell.tsx");
const alarmSource = read("src/pages/AlarmPage.tsx");
const alarmCss = read("src/pages/AlarmPageExtracted.css");
const closureSource = read("src/components/alarm/AlarmClosureRail.tsx");
const closureCss = read("src/components/alarm/AlarmClosureRail.css");
const alarmMobileCss = read("src/pages/AlarmMobile.css");
const workOrderSource = read("src/pages/WorkOrdersPage.tsx");
const workOrderMobileCss = read("src/pages/WorkOrdersMobile.css");
const routingSource = read("src/services/siteRouting.ts");

requireText(policySource, 'label: "运行观察"', "read-only observer navigation perspective is missing");
requireText(policySource, 'label: "运行值守"', "operator navigation perspective is missing");
requireText(policySource, 'label: "工程运维"', "engineer navigation perspective is missing");
requireText(policySource, "if (readOnlyMode)", "navigation perspective must prioritize read-only safety");
requireText(shellSource, "resolveNavigationPerspective(session?.role, runtimeConfig.readOnlyMode)", "shell does not resolve role-aware navigation");
requireText(shellSource, "prioritizeNavigationModules", "shell does not apply navigation priority policy");
requireText(shellSource, "data-navigation-perspective", "shell does not expose the active work perspective");
requireText(shellSource, 'className="shell-skip-link"', "shell needs a keyboard skip link before dense navigation");
requireText(shellSource, 'href="#app-shell-main-content"', "shell skip link target is missing");
requireText(shellSource, 'id="app-shell-main-content"', "shell main-content landmark target is missing");

requireText(alarmSource, "buildAlarmWorkOrderDraftPath", "alarm rows cannot carry context to a work-order draft");
requireText(alarmSource, "alarmSiteId: siteId", "alarm draft path must carry immutable source-site evidence");
requireText(alarmSource, "<h1>告警处置中心</h1>", "alarm workspace must expose one page-level heading");
requireText(alarmSource, "<AlarmClosureRail", "alarm closure rail is not rendered");
requireText(alarmSource, "转工单草稿", "row-level work-order draft action is missing");
requireText(closureSource, "告警恢复不等于闭环", "closure rail must distinguish recovery from closure");
requireText(closureSource, "不在告警页直接下发控制", "alarm closure rail is missing the no-control boundary");
requireText(closureSource, "带入工单草稿", "closure rail is missing the safe work-order handoff");
requireText(closureCss, "grid-template-columns: repeat(4, minmax(0, 1fr))", "desktop four-stage closure grid is missing");
requireText(closureCss, "grid-template-columns: 1fr", "mobile closure sequence is missing");
requireText(alarmMobileCss, "min-height: 44px", "mobile alarm controls must keep a 44px touch target");
requireText(alarmMobileCss, ".alarm-page-v2 .alarm-filter-button", "mobile alarm filters are not covered by the touch-target guard");
requireText(alarmMobileCss, ".alarm-page-v2 .alarm-closure-link", "mobile alarm closure actions are not covered by the touch-target guard");
requireText(alarmMobileCss, ".alarm-page-v2 .alarm-queue-draft-link", "mobile alarm row draft actions are not covered by the touch-target guard");
requireText(alarmMobileCss, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important", "mobile alarm KPI cards must not collapse into desktop columns");
requireText(alarmMobileCss, "height: auto", "mobile alarm page must escape the fixed desktop viewport height");
requireText(alarmCss, "grid-template-rows: auto auto auto minmax(0, 1fr) auto", "compact alarm page must reserve a dedicated closure-rail row");
requireText(alarmCss, ".alarm-page-v2 .alarm-closure-panel", "compact alarm page is missing its closure-rail containment guard");
requireText(alarmCss, ".alarm-kpi-card-wide > div:first-child", "optimization-admission status needs a separated label/value layout");

requireText(workOrderSource, 'searchParams.get("source") !== "alarm"', "work-order page does not validate alarm draft context");
requireText(workOrderSource, "siteIdsEquivalent(sourceSiteId, activeSiteId)", "work-order draft must fail closed when source and active sites differ");
requireText(workOrderSource, "alarmDraftRejected", "work-order page must explain why a mismatched alarm draft was rejected");
requireText(workOrderSource, "<h1>{zhCN.workOrderPage.heading}</h1>", "work-order workspace must expose one page-level heading");
requireText(workOrderSource, '"[告警转工单草稿]"', "alarm provenance is not preserved in work-order draft copy");
requireText(workOrderSource, "设备、执行人、处置时间和关闭证据必须人工核对", "work-order draft lacks manual verification guidance");
requireText(workOrderSource, "onClick={() => openCreateDialog(alarmDraftContext)}", "alarm draft inspection action is missing");
requireText(workOrderSource, "disabled={submitting}", "alarm draft inspection must remain available when device or assignee sources degrade");
requireText(workOrderSource, "disabled={submitting || runtimeConfig.readOnlyMode}", "read-only work-order submit guard is not reflected in the UI");
requireText(workOrderSource, 'import "./WorkOrdersMobile.css";', "work-order mobile overrides are not loaded after page styles");
requireText(workOrderSource, "zhCN.common.unitPerson", "work-order assignee count must use a person unit");
requireText(workOrderMobileCss, "writing-mode: horizontal-tb !important;", "mobile work-order heading must remain horizontal");
requireText(workOrderMobileCss, "flex: 0 0 auto !important;", "mobile work-order cards must not collapse inside the scroll container");
requireText(workOrderMobileCss, "overflow-y: auto !important;", "mobile work-order page must provide a bounded vertical scroll path");
requireText(workOrderMobileCss, "grid-template-columns: repeat(2, minmax(0, 1fr)) !important;", "mobile work-order summary and actions need usable two-column layouts");
requireText(workOrderMobileCss, "min-height: 44px !important;", "mobile work-order controls must keep a 44px touch target");
requireText(routingSource, "clearCrossProjectTransientContextFromSearch", "project switching must clear transient cross-project route context");
requireText(shellSource, "clearCrossProjectTransientContextFromSearch(", "shell project switching does not clear alarm draft route state");

for (const forbidden of ["acknowledgeAlarm(", "closeAlarm(", "dispatchAlarm("]) {
  if (alarmSource.includes(forbidden)) {
    throw new Error(`alarm page must not fake an unsupported mutation: ${forbidden}`);
  }
}

console.log("Role-aware navigation and alarm closure UI contract passed.");
console.log("- checked observer/operator/engineer navigation perspectives");
console.log("- checked four-stage alarm closure truth and no-control boundary");
console.log("- checked alarm-to-work-order draft context and read-only submit guard");
console.log("- checked mobile work-order flow, horizontal heading and 44px touch targets");

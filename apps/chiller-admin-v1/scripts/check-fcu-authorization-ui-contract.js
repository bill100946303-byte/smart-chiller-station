import fs from "node:fs";
import path from "node:path";

const ADMIN_ROOT = path.resolve(process.cwd());
const SUBSYSTEM_CONFIG_PAGE_FILE = path.join(ADMIN_ROOT, "src/pages/SubsystemConfigPage.tsx");
const FCU_WORK_ORDER_DETAIL_PAGE_FILE = path.join(ADMIN_ROOT, "src/pages/FcuWorkOrderDetailPage.tsx");
const ADMIN_CLIENT_FILE = path.join(ADMIN_ROOT, "src/services/adminClient.ts");
const ADMIN_TYPES_FILE = path.join(ADMIN_ROOT, "src/services/adminTypes.ts");
const STYLE_FILE = path.join(ADMIN_ROOT, "src/styles/global.css");

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertRegex(source, regex, message) {
  if (!regex.test(source)) {
    throw new Error(message);
  }
}

const pageSource = fs.readFileSync(SUBSYSTEM_CONFIG_PAGE_FILE, "utf8");
const workOrderPageSource = fs.readFileSync(FCU_WORK_ORDER_DETAIL_PAGE_FILE, "utf8");
const clientSource = fs.readFileSync(ADMIN_CLIENT_FILE, "utf8");
const typeSource = fs.readFileSync(ADMIN_TYPES_FILE, "utf8");
const styleSource = fs.readFileSync(STYLE_FILE, "utf8");

assertContains(
  pageSource,
  "function handleFillFcuAuthorizationDraft()",
  "3002 must keep the FCU one-hour authorization draft helper."
);
assertContains(
  pageSource,
  "function handleRevokeFcuAuthorizationDraft()",
  "3002 must keep the FCU authorization revoke helper."
);
assertRegex(
  pageSource,
  /siteAuthorizationStatus:\s*"approved"[\s\S]+?baWriteConfirmArmed:\s*true[\s\S]+?finalRolloutConfirmArmed:\s*true/,
  "FCU authorization draft must fill approved status and both confirmation-armed flags."
);
assertRegex(
  pageSource,
  /siteAuthorizationStatus:\s*"revoked"[\s\S]+?baWriteConfirmArmed:\s*false[\s\S]+?finalRolloutConfirmArmed:\s*false/,
  "FCU authorization revoke helper must close both confirmation-armed flags."
);
assertContains(
  pageSource,
  "填入一小时授权草稿",
  "3002 must expose the one-hour FCU authorization draft action."
);
assertContains(
  pageSource,
  "撤销授权草稿",
  "3002 must expose the FCU authorization revoke action."
);
assertContains(
  pageSource,
  "草稿只补齐配置字段",
  "3002 must clearly state that the authorization draft does not execute BA/PLC writes."
);
assertContains(
  pageSource,
  "真实写入仍受 3001 单台确认",
  "3002 authorization copy must preserve the 3001 single-device confirmation boundary."
);
assertContains(
  pageSource,
  "fcuFinalDispatchReady",
  "3002 must derive the final FCU dispatch gate separately from field authorization."
);
assertContains(
  pageSource,
  "最终写入总门禁阻断",
  "3002 must show that final write dispatch remains blocked until final gates pass."
);
assertContains(
  pageSource,
  "普通闭环写入仍锁定",
  "3002 must distinguish authorized configuration from ordinary closed-loop write release."
);
assertContains(
  pageSource,
  "3002 授权不等于最终写入放行",
  "3002 must explicitly state that authorization alone is not final write release."
);
assertRegex(
  pageSource,
  /const authorizationIssues = validateApprovedFcuAuthorization\(fcuPolicy\);[\s\S]+?FCU 已授权状态不能保存/,
  "Saving an approved FCU authorization must keep validation before persistence."
);
assertContains(
  clientSource,
  `/admin/v1/sites/\${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/control-policy`,
  "Admin client must keep the FCU control-policy endpoint."
);
assertContains(
  styleSource,
  ".admin-action-row",
  "3002 must keep compact action-row styling for FCU authorization actions."
);
assertContains(
  styleSource,
  ".admin-inline-note",
  "3002 must keep inline safety-note styling for FCU authorization actions."
);
assertContains(
  styleSource,
  ".admin-inline-toggle",
  "3002 must style compact inline toggles used by the FCU single-device workflow."
);
assertContains(
  pageSource,
  "现场核查表 CSV",
  "3002 must expose the FCU onsite checklist CSV output."
);
assertContains(
  pageSource,
  "执行包 Markdown",
  "3002 must expose the FCU execution-pack markdown output."
);
assertContains(
  pageSource,
  "执行包 JSON",
  "3002 must expose the FCU execution-pack JSON output."
);
assertContains(
  pageSource,
  "fcuReturnTemplate",
  "3002 must consume the FCU field remediation return template."
);
assertContains(
  pageSource,
  "现场回填模板 CSV",
  "3002 must expose the FCU onsite return-template CSV output."
);
assertContains(
  pageSource,
  "可参考草稿",
  "3002 must show review-draft counts for FCU onsite return templates."
);
assertContains(
  pageSource,
  "reviewDraft 只作现场复核参考",
  "3002 must state FCU review drafts do not auto-release or dispatch."
);
assertContains(
  pageSource,
  "fcuFieldHandoff",
  "3002 must consume the FCU field handoff package."
);
assertContains(
  pageSource,
  "fcuFieldPlaybook",
  "3002 must consume the FCU onsite remediation playbook from final worklist."
);
assertContains(
  pageSource,
  "现场消缺作战表",
  "3002 must expose the FCU onsite remediation playbook."
);
assertContains(
  pageSource,
  "fieldPriority",
  "3002 must show per-device onsite remediation sequence."
);
assertContains(
  pageSource,
  "canaryBlockedByField",
  "3002 must distinguish whether Canary is still blocked by field remediation."
);
assertContains(
  pageSource,
  "现场交接包发现过期签核行",
  "3002 must surface stale signoff rows from the field handoff package before CSV preview."
);
assertContains(
  pageSource,
  "清理过期签核行",
  "3002 must expose a current-only cleanup action for stale FCU signoff rows."
);
assertContains(
  pageSource,
  "旧行不允许参与 Canary 或最终控制放行",
  "3002 must state stale signoff rows cannot release Canary or final control."
);
assertContains(
  pageSource,
  "fcuExecutionOrder.map",
  "3002 must render the FCU field execution order table."
);
assertContains(
  typeSource,
  "finalControlFieldExecutionPack",
  "3002 types must include the FCU final-control field execution pack."
);
assertContains(
  pageSource,
  "fcuFinalFieldExecutionPack",
  "3002 must consume the FCU final-control field execution pack."
);
assertContains(
  pageSource,
  "最终控制现场执行包",
  "3002 must expose the FCU final-control field execution pack."
);
assertContains(
  pageSource,
  "最终执行 CSV",
  "3002 must expose the FCU final-control field execution CSV."
);
assertContains(
  pageSource,
  "最终放行项",
  "3002 must render the FCU final-release checklist."
);
assertContains(
  pageSource,
  "本页不调用 control-cycle、control-command 或 Canary dispatch",
  "3002 must state the final-control field execution pack does not dispatch BA/PLC commands."
);
assertContains(
  pageSource,
  "fcuFieldWorkOrders.map((item) => (",
  "3002 must render every FCU field work order, so each device can open its single-device control page."
);
if (pageSource.includes("fcuFieldWorkOrders.slice(0, 6).map")) {
  throw new Error("3002 must not truncate the FCU field work-order table to six rows.");
}
assertContains(
  pageSource,
  "/subsystems/fcu/${encodeURIComponent(item.workOrderId || \"\")}",
  "3002 must keep a per-FCU work-order route action for each field device."
);
assertContains(
  pageSource,
  "function handleBuildFcuSignoffBatchTemplate()",
  "3002 must keep the FCU batch signoff template generator."
);
assertContains(
  pageSource,
  "function handleBuildFcuSignoffBatchRows()",
  "3002 must keep the FCU batch signoff row generator."
);
assertContains(
  pageSource,
  "生成全部回填模板",
  "3002 must expose the FCU batch field-fill template action."
);
assertContains(
  pageSource,
  "批量套用当前复核值",
  "3002 must expose the FCU batch apply reviewed-values action."
);
assertContains(
  pageSource,
  "批量生成只更新下方 CSV 草稿",
  "3002 must state that FCU batch generation does not persist or dispatch."
);
assertContains(
  pageSource,
  "fcuSignoffIssueGroups",
  "3002 must keep grouped FCU signoff issue-diff preview."
);
assertContains(
  pageSource,
  "可进 Canary",
  "3002 must expose Canary readiness in the FCU signoff diff preview."
);
assertContains(
  pageSource,
  "fcuSignoffReleaseMatrix",
  "3002 must render the FCU signoff release matrix."
);
assertContains(
  pageSource,
  "fcuSignoffReleaseRows",
  "3002 must derive per-device FCU signoff release review rows."
);
assertContains(
  pageSource,
  "fcuSignoffActionQueue",
  "3002 must derive a prioritized per-device FCU signoff action queue."
);
assertContains(
  pageSource,
  "fcuFieldExecutionProgress",
  "3002 must derive onsite field execution progress from the FCU signoff action queue."
);
assertContains(
  pageSource,
  "现场执行模式",
  "3002 must expose onsite field execution mode for FCU signoff."
);
assertContains(
  pageSource,
  "开始现场执行",
  "3002 must expose a first-pending-device entry for onsite field execution."
);
assertContains(
  pageSource,
  "全部可进 Canary 后再刷新总门禁",
  "3002 onsite field execution mode must preserve final-gate sequencing."
);
assertContains(
  pageSource,
  "单台签核处理队列",
  "3002 must expose the prioritized FCU signoff action queue."
);
assertContains(
  pageSource,
  "先处理不能进 Canary 的设备",
  "3002 signoff action queue must explain the onsite processing order."
);
assertContains(
  pageSource,
  "打开工单",
  "3002 signoff action queue must link each device to its single work-order page."
);
assertContains(
  pageSource,
  "不保存签核、不下发 BA/PLC",
  "3002 signoff action queue must preserve no-save and no-dispatch boundaries."
);
assertRegex(
  pageSource,
  /navigate\(item\.rowHref\)/,
  "3002 signoff action queue must navigate to the per-device work-order route."
);
assertContains(
  pageSource,
  "逐台放行视图",
  "3002 must expose a per-device FCU release review view after signoff preview."
);
assertContains(
  pageSource,
  "签字通过不等于真实下发",
  "3002 must state signoff release does not equal real dispatch."
);
assertContains(
  pageSource,
  "可进 Canary 仍需实时 closeout、现场授权、BA 写适配器和总门禁全部通过",
  "3002 must state Canary candidate still requires downstream gates."
);
assertContains(
  pageSource,
  "fcuOnsiteReleasePrecheck",
  "3002 must consume onsite release precheck from signoff validation."
);
assertContains(
  pageSource,
  "现场放行预检",
  "3002 must expose onsite release precheck before final Canary release."
);
assertContains(
  pageSource,
  "fcuSignoffPersistLocked",
  "3002 must lock FCU signoff persistence until preview has no blocking issues."
);
assertContains(
  pageSource,
  "保存前复核锁定",
  "3002 must show a clear pre-save review lock state for FCU signoff CSV."
);
assertContains(
  pageSource,
  "保存前复核通过",
  "3002 must show a clear pre-save review pass state for FCU signoff CSV."
);
assertContains(
  pageSource,
  "fcuSignoffPromoteRefreshChain",
  "3002 must derive the post-save FCU signoff refresh chain."
);
assertContains(
  pageSource,
  "自动刷新链已执行",
  "3002 must show the automatic post-save final-control refresh chain."
);
assertContains(
  pageSource,
  "runbook",
  "3002 post-save refresh chain must include final runbook evidence."
);
assertContains(
  pageSource,
  "evidence consistency",
  "3002 post-save refresh chain must include evidence consistency evidence."
);
assertContains(
  pageSource,
  "无下发",
  "3002 post-save refresh chain must state no dispatch happened."
);
assertContains(
  pageSource,
  "fcuFirstOnsiteCanaryCandidate",
  "3002 must derive the first FCU onsite/Canary precheck candidate from the signoff release matrix."
);
assertContains(
  pageSource,
  "fcuCandidateAutoLink",
  "3002 must derive candidate auto-link status from signoff and Canary blockers."
);
assertContains(
  pageSource,
  "首台预检候选",
  "3002 must expose the first FCU onsite/Canary precheck candidate panel."
);
assertContains(
  pageSource,
  "候选联动",
  "3002 must show whether a Canary candidate was auto-linked after signoff validation."
);
assertContains(
  pageSource,
  "自动推送到候选预检包区域",
  "3002 must state when the candidate is linked to the precheck package area."
);
assertContains(
  pageSource,
  "无候选时先处理首要缺项",
  "3002 must state what to do when there is no Canary candidate."
);
assertContains(
  typeSource,
  "readinessPlaybook",
  "3002 field-remediation status type must carry the Canary readiness playbook."
);
assertContains(
  pageSource,
  "Canary Readiness 作战表",
  "3002 must expose the Canary readiness playbook from the final worklist."
);
assertContains(
  pageSource,
  "function handleBuildFcuReadinessDraftSignoffRows()",
  "3002 must generate onsite signoff draft rows from the Canary readiness playbook."
);
assertContains(
  pageSource,
  "按 Readiness 生成现场草稿",
  "3002 must expose a readiness-driven onsite signoff draft action."
);
assertContains(
  pageSource,
  "复核值保持空白/hold",
  "3002 readiness-driven signoff draft must not fake onsite verification values."
);
assertContains(
  pageSource,
  "不保存文件、不下发 BA/PLC、不放行 Canary",
  "3002 readiness-driven signoff draft must preserve no-write and no-release boundaries."
);
assertContains(
  pageSource,
  "第一阻断",
  "3002 must show the first blocked Canary readiness phase."
);
assertContains(
  pageSource,
  "第一动作",
  "3002 must show the first actionable Canary readiness step."
);
assertContains(
  pageSource,
  "禁止生成真实 Canary 下发",
  "3002 must clearly block real Canary dispatch when no candidate is ready."
);
assertContains(
  pageSource,
  "function handleBuildCandidateFieldArmPackage()",
  "3002 must keep the first-candidate Field Arm package generator."
);
assertContains(
  pageSource,
  "生成候选预检包",
  "3002 must expose the candidate Field Arm / Canary precheck package action."
);
assertContains(
  pageSource,
  "fcuCandidatePrecheckChain",
  "3002 must derive the candidate Canary precheck chain."
);
assertContains(
  pageSource,
  "fcuFinalReleaseChecklist",
  "3002 must derive the final release checklist from signoff, closeout, canary and adapter evidence."
);
assertContains(
  pageSource,
  "fcuFinalReleaseFirstBlocker",
  "3002 final release checklist must identify the first blocking gate."
);
assertContains(
  pageSource,
  "最终放行前核对清单",
  "3002 must expose a final pre-release checklist before real Canary/final dispatch."
);
assertContains(
  pageSource,
  "该清单只汇总现有证据，不放宽任何门禁",
  "3002 final release checklist must preserve backend gate authority."
);
assertContains(
  pageSource,
  "最终写入仍必须由 3001 单台确认、后端总闸、审计和反馈回退共同放行",
  "3002 final release checklist must keep 3001/backend/audit/rollback boundaries."
);
assertContains(
  pageSource,
  "BA 写适配器",
  "3002 candidate precheck chain must expose BA write adapter readiness."
);
assertContains(
  pageSource,
  "反馈监视",
  "3002 candidate precheck chain must expose Canary feedback monitoring."
);
assertContains(
  pageSource,
  "预检链只生成证据",
  "3002 must state the candidate precheck chain does not execute real dispatch."
);
assertContains(
  pageSource,
  "未通过前禁止进入 3001 真实 Canary 执行",
  "3002 must block real Canary execution until candidate precheck chain passes."
);
assertContains(
  pageSource,
  "disabled={saving || !fcuFirstOnsiteCanaryCandidate}",
  "3002 must lock candidate Field Arm package generation when no onsite/Canary candidate is ready."
);
assertContains(
  pageSource,
  "现场候选不等于真实 Canary 放行",
  "3002 must state onsite candidates are not real Canary release."
);
assertContains(
  pageSource,
  "不执行真实 BA 写入",
  "3002 must state candidate precheck package generation has no real BA write."
);
assertContains(
  workOrderPageSource,
  "保存后闭环刷新结果",
  "3002 single-FCU work-order page must show the post-save final-control refresh result."
);
assertContains(
  workOrderPageSource,
  "最终执行队列定位",
  "3002 single-FCU work-order page must show the final-control field execution queue context."
);
assertContains(
  workOrderPageSource,
  "finalControlFieldExecutionPack",
  "3002 single-FCU work-order page must consume the final-control field execution pack."
);
assertContains(
  workOrderPageSource,
  "按 reviewDraft 填草稿",
  "3002 single-FCU work-order page must provide a reviewDraft-based onsite draft-fill helper."
);
assertContains(
  workOrderPageSource,
  "reviewDraft 草稿只填表单，不保存、不放行、不下发 BA/PLC",
  "3002 single-FCU reviewDraft helper must state it does not persist, release, or dispatch."
);
assertContains(
  workOrderPageSource,
  "现场复核草稿",
  "3002 single-FCU work-order page must show the per-device reviewDraft panel."
);
assertContains(
  workOrderPageSource,
  "现场候选/待预检",
  "3002 single-FCU work-order page must distinguish onsite canary candidates from real Canary readiness."
);
assertContains(
  workOrderPageSource,
  "未通过前仍禁止真实下发",
  "3002 single-FCU onsite candidate copy must keep the real dispatch boundary."
);
assertContains(
  workOrderPageSource,
  "reviewDraft 只把当前可信读数作为现场复核参考",
  "3002 single-FCU reviewDraft panel must state that reviewDraft cannot replace BA engineer signoff."
);
assertContains(
  workOrderPageSource,
  "releaseDecisionDefault === \"release\" ? \"recheck\"",
  "3002 single-FCU reviewDraft helper must not auto-fill release even if a draft default is unsafe."
);
assertContains(
  workOrderPageSource,
  "返回签核队列继续下一台",
  "3002 single-FCU work-order page must let operators return to the signoff queue after saving one device."
);
assertContains(
  workOrderPageSource,
  "nextPendingWorkOrder",
  "3002 single-FCU work-order page must derive the next pending FCU after saving one device."
);
assertContains(
  workOrderPageSource,
  "findNextPendingFcuWorkOrder",
  "3002 single-FCU work-order page must prefer the final-control execution queue when choosing the next pending FCU."
);
assertContains(
  workOrderPageSource,
  "autoAdvanceAfterSave",
  "3002 single-FCU work-order page must support auto-advancing through the final-control execution queue after save."
);
assertContains(
  workOrderPageSource,
  "保存后按最终执行包队列自动跳转下一台",
  "3002 single-FCU work-order page must expose the auto-advance toggle text."
);
assertContains(
  workOrderPageSource,
  "当前队列没有下一台待处理设备，请刷新 signoff / closeout / final gates",
  "3002 single-FCU work-order page must prompt final gate refresh when the execution queue is exhausted."
);
assertContains(
  workOrderPageSource,
  "nextPendingWorkOrderHref",
  "3002 single-FCU work-order page must build a safe route for the next pending FCU."
);
assertContains(
  workOrderPageSource,
  "下一台待处理 FCU",
  "3002 single-FCU work-order page must expose a one-click next pending FCU action."
);
assertContains(
  workOrderPageSource,
  "系统已定位下一台待处理设备",
  "3002 single-FCU work-order page must explain which next FCU was selected."
);
assertContains(
  workOrderPageSource,
  "latestSignoffCompleteRows",
  "3002 single-FCU work-order page must derive refreshed signoff progress after row save."
);
assertContains(
  workOrderPageSource,
  "latestGatePassedCount",
  "3002 single-FCU work-order page must derive refreshed final gate progress after row save."
);
assertContains(
  workOrderPageSource,
  "latestControlMutation",
  "3002 single-FCU work-order page must expose whether a save/refresh caused control mutation."
);
assertContains(
  workOrderPageSource,
  "latestDispatch",
  "3002 single-FCU work-order page must expose whether a save/refresh caused dispatch."
);
assertContains(
  workOrderPageSource,
  "保存签核和刷新门禁只更新证据链，不执行 BA/PLC 写入",
  "3002 single-FCU work-order page must preserve no-write semantics after saving one signoff row."
);
assertContains(
  workOrderPageSource,
  "单台 release 只是现场证据完成，不等于最终控制完成",
  "3002 single-FCU work-order page must state that single-device release is not final control completion."
);
assertContains(
  styleSource,
  ".admin-fcu-output-grid",
  "3002 must keep compact output-card styling for FCU field execution package outputs."
);
assertContains(
  styleSource,
  ".admin-fcu-field-execution-mode",
  "3002 must style the FCU onsite field execution progress panel."
);
assertContains(
  styleSource,
  ".admin-fcu-field-progress",
  "3002 must style the FCU onsite field execution progress bar."
);
assertContains(
  styleSource,
  ".admin-fcu-final-release-grid",
  "3002 must style the FCU final release checklist grid."
);
assertContains(
  styleSource,
  ".admin-fcu-signoff-diff-grid",
  "3002 must keep compact styling for FCU signoff diff preview cards."
);
assertContains(
  styleSource,
  ".admin-fcu-canary-candidate",
  "3002 must keep styling for the first FCU Canary candidate panel."
);

console.log("FCU_AUTHORIZATION_UI_CONTRACT ok=true draft_action=true revoke_action=true safety_boundary=true final_dispatch_gate=true field_pack_outputs=true all_work_orders=true batch_signoff=true signoff_diff=true presave_lock=true canary_candidate=true candidate_precheck=true");

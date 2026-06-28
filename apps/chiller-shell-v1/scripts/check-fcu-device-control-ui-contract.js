import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHELL_ROOT = path.resolve(SCRIPT_DIR, "..");
const HVAC_TERMINAL_PAGE_FILE = path.join(SHELL_ROOT, "src/pages/HvacTerminalMonitoringPage.tsx");
const BFF_CLIENT_FILE = path.join(SHELL_ROOT, "src/services/bffClient.ts");

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

const pageSource = fs.readFileSync(HVAC_TERMINAL_PAGE_FILE, "utf8");
const clientSource = fs.readFileSync(BFF_CLIENT_FILE, "utf8");

assertContains(
  pageSource,
  'type TerminalView = "overview" | "control" | "quality" | "devices" | "device";',
  "HVAC terminal page must keep the single-device route state."
);
assertContains(
  pageSource,
  'const selectedDeviceCode = normalizeDeviceKey(searchParams.get("deviceCode") || searchParams.get("device"));',
  "HVAC terminal page must resolve selected FCU from deviceCode/device query."
);
assertContains(
  pageSource,
  "function buildFanCoilDeviceHref",
  "HVAC terminal page must provide per-FCU detail links."
);
assertContains(
  pageSource,
  "fanCoilItems.map((item) =>",
  "HVAC terminal page must render every FCU item."
);
assertRegex(
  pageSource,
  /<Link[\s\S]+?className="fan-coil-card-link"[\s\S]+?to=\{buildFanCoilDeviceHref\(item\)\}/,
  "Every FCU card must link to its own single-device control page."
);
assertContains(
  pageSource,
  "台 FCU 均支持点进单台控制页",
  "FCU list must explicitly tell operators that every FCU can open a single-device control page."
);
assertContains(
  pageSource,
  "FCU 逐台切换",
  "Single-device page must provide a per-FCU switcher."
);
assertContains(
  pageSource,
  "FCU 控制索引",
  "Device list page must expose a direct control index for every FCU."
);
assertContains(
  pageSource,
  "FCU 逐台控制入口",
  "Overview page must expose a direct per-FCU control entry section."
);
assertContains(
  pageSource,
  "hvac-terminal-floor-control-grid",
  "Overview page must render every FCU as a clickable control node."
);
assertRegex(
  pageSource,
  /fanCoilItems\.map\(\(item\) =>[\s\S]+?className=\{`hvac-terminal-floor-control-node/,
  "Overview FCU floor/control index must map every FCU item to a clickable node."
);
assertContains(
  pageSource,
  "hvac-terminal-device-picker--list",
  "Device list page must keep the all-FCU control index visually distinct from detail cards."
);
assertRegex(
  pageSource,
  /fanCoilItems\.map\(\(item\) =>[\s\S]+?className=\{`hvac-terminal-device-chip/,
  "Single-device page must render a chip for every FCU so operators can switch devices without returning to the list."
);
assertRegex(
  pageSource,
  /handleRunControlCycle\(false,\s*selectedDeviceCode\)/,
  "Single-device preview must target selectedDeviceCode."
);
assertRegex(
  pageSource,
  /handleRunControlCycle\(true,\s*selectedDeviceCode\)/,
  "Single-device dispatch confirmation must target selectedDeviceCode."
);
assertRegex(
  pageSource,
  /runFcuManualControlCommand\(siteId,[\s\S]+?deviceCode:\s*targetDeviceCode/,
  "Manual FCU command must pass the selected device code to BFF."
);
assertRegex(
  pageSource,
  /fetchFcuControlRecords\(siteId,[\s\S]+?deviceCode:\s*selectedDeviceCode \|\| undefined/,
  "Single-device feedback verification must reload records for the selected FCU, not the global recent list."
);
assertRegex(
  pageSource,
  /generateFcuCanaryWindow\(siteId,[\s\S]+?deviceCode:\s*selectedDeviceCode/,
  "Canary window generation must be per selected FCU."
);
assertRegex(
  pageSource,
  /generateFcuFieldArmPackage\(siteId,[\s\S]+?deviceCode:\s*selectedDeviceCode/,
  "Field arm package generation must be per selected FCU."
);
assertContains(
  pageSource,
  "previousFanCoil",
  "Single-device page must keep previous-device navigation."
);
assertContains(
  pageSource,
  "nextFanCoil",
  "Single-device page must keep next-device navigation."
);
assertContains(
  pageSource,
  "现场 P0 消缺清单",
  "Runtime FCU final-control panel must expose a field remediation checklist."
);
assertContains(
  pageSource,
  "finalFieldCloseoutPackage",
  "Runtime FCU final-control panel must consume the field remediation closeout package."
);
assertContains(
  pageSource,
  "现场消缺",
  "Runtime FCU final-control panel must show field closeout as a canary gate."
);
assertContains(
  pageSource,
  "消缺关闭报告",
  "Runtime FCU final-control panel must expose the closeout report package."
);
assertContains(
  pageSource,
  "finalFieldWorkOrdersPackage",
  "Runtime FCU final-control panel must consume the field remediation work-order package."
);
assertContains(
  pageSource,
  "现场工单包",
  "Runtime FCU final-control panel must expose work orders for onsite remediation."
);
assertContains(
  pageSource,
  "signoffInputCsv",
  "Runtime FCU final-control panel must distinguish signoff input CSV from generated work-order template."
);
assertContains(
  pageSource,
  "finalFieldSignoffPackage",
  "Runtime FCU final-control panel must consume onsite signoff validation."
);
assertContains(
  pageSource,
  "签字校验",
  "Runtime FCU final-control panel must expose onsite signoff validation."
);
assertContains(
  pageSource,
  "现场放行预检",
  "Runtime FCU final-control panel must expose onsite release precheck separately from Canary release."
);
assertContains(
  clientSource,
  "onsiteReleasePrecheck",
  "BFF client final-control DTO must carry onsite release precheck."
);
assertContains(
  pageSource,
  "签字缺项",
  "Runtime FCU final-control panel must show per-device onsite signoff missing fields."
);
assertContains(
  pageSource,
  "releaseMatrixCsv",
  "Runtime FCU final-control panel must expose the onsite signoff release matrix CSV."
);
assertContains(
  pageSource,
  "fcu-release-matrix-grid",
  "Runtime FCU final-control panel must render per-device signoff release matrix cards."
);
assertContains(
  pageSource,
  "finalAllDevicePlanPackage",
  "Runtime FCU final-control panel must consume the all-device staged rollout plan package."
);
assertContains(
  pageSource,
  "全量分批计划",
  "Runtime FCU final-control panel must show immediate, staged-setpoint, and hard-blocked rollout buckets."
);
assertContains(
  pageSource,
  "分步设定",
  "Runtime FCU final-control panel must distinguish staged setpoint normalization from hard P0 remediation."
);
assertContains(
  clientSource,
  "allDevicePlan",
  "BFF client final-control DTO must carry the all-device rollout plan package."
);
assertContains(
  clientSource,
  "finalDispatchGate",
  "BFF client control-policy DTO must carry the final dispatch gate."
);
assertContains(
  pageSource,
  "formatFcuFinalDispatchGateSummary",
  "Runtime FCU page must summarize the final dispatch gate separately from policy authorization."
);
assertContains(
  pageSource,
  "fcuExecutionGate?.dispatchAllowed === true && fcuFinalDispatchGate?.dispatchAllowed === true",
  "Runtime FCU page must require both policy gate and final control gate before showing write enabled."
);
assertContains(
  pageSource,
  "现场签核、Canary 与最终验收全部通过后才允许普通闭环写入",
  "Runtime FCU page must explain that ordinary closed-loop writes require final signoff and Canary."
);
assertContains(
  clientSource,
  "stagedSetpointDevices",
  "BFF client final-control DTO must carry staged setpoint device counts and examples."
);
assertContains(
  pageSource,
  "Canary 阻断",
  "Runtime FCU final-control panel must clearly state when a signed device is still blocked from Canary."
);
assertContains(
  pageSource,
  "签字输入清理",
  "Runtime FCU final-control panel must show current-only and stale signoff input files."
);
assertContains(
  pageSource,
  "签字输入提升",
  "Runtime FCU final-control panel must show explicit signoff input promotion status."
);
assertContains(
  clientSource,
  "missingChecklist",
  "BFF client final-control DTO must carry per-device signoff missing checklist."
);
assertContains(
  clientSource,
  "releaseMatrix",
  "BFF client final-control DTO must carry per-device signoff release matrix."
);
assertContains(
  clientSource,
  "canEnterCanary",
  "BFF client final-control DTO must carry per-device Canary release status."
);
assertContains(
  clientSource,
  "fieldRemediationSignoffCleanInput",
  "BFF client final-control DTO must carry signoff input cleanup package."
);
assertContains(
  clientSource,
  "fieldRemediationSignoffPromote",
  "BFF client final-control DTO must carry signoff input promotion package."
);
assertContains(
  clientSource,
  "fieldRemediationExecutionPack",
  "BFF client final-control DTO must carry onsite remediation execution package."
);
assertContains(
  pageSource,
  "finalFieldExecutionPackPackage",
  "Runtime FCU final-control panel must consume onsite remediation execution package."
);
assertContains(
  pageSource,
  "现场执行包",
  "Runtime FCU final-control panel must expose onsite remediation execution order."
);
assertContains(
  clientSource,
  "fieldRemediationPlaybook",
  "BFF client final-control DTO must carry the onsite remediation playbook."
);
assertContains(
  pageSource,
  "finalFieldPlaybook",
  "Runtime FCU final-control panel must consume the onsite remediation playbook."
);
assertContains(
  pageSource,
  "现场消缺作战表",
  "Runtime FCU final-control panel must expose the onsite remediation playbook."
);
assertContains(
  pageSource,
  "fieldPriority",
  "Runtime FCU final-control panel must show per-device onsite remediation sequence."
);
assertContains(
  pageSource,
  "finalEvidenceConsistency",
  "Runtime FCU final-control panel must consume final evidence consistency."
);
assertContains(
  pageSource,
  "证据一致性",
  "Runtime FCU final-control panel must expose final evidence consistency."
);
assertContains(
  clientSource,
  "evidenceConsistency",
  "BFF client final-control DTO must carry final evidence consistency."
);
assertContains(
  clientSource,
  "finalRunbook",
  "BFF client final-control DTO must carry final runbook evidence."
);
assertContains(
  pageSource,
  "finalFieldHandoffPackage",
  "Runtime FCU final-control panel must consume the field handoff package."
);
assertContains(
  pageSource,
  "现场交接包",
  "Runtime FCU final-control panel must expose onsite handoff package before dispatch."
);
assertContains(
  clientSource,
  "fieldHandoff",
  "BFF client final-control DTO must carry the field handoff package."
);
assertContains(
  pageSource,
  "实时 closeout",
  "Runtime FCU final-control panel must state signoff still requires realtime closeout."
);
assertContains(
  pageSource,
  "finalCanaryReadinessPackage",
  "Runtime FCU final-control panel must consume canary readiness gate."
);
assertContains(
  pageSource,
  "Canary总门禁",
  "Runtime FCU final-control panel must expose canary readiness gate."
);
assertContains(
  clientSource,
  "readinessPlaybook",
  "BFF client final-control DTO must carry Canary readiness playbook."
);
assertContains(
  pageSource,
  "Readiness 作战表",
  "Runtime FCU final-control panel must expose the Canary readiness playbook."
);
assertContains(
  pageSource,
  "第一阻断",
  "Runtime FCU final-control panel must show the first blocked readiness phase."
);
assertContains(
  pageSource,
  "第一动作",
  "Runtime FCU final-control panel must show the first actionable readiness step."
);
assertContains(
  pageSource,
  "selectedCanaryExecutionLockChain",
  "Runtime FCU single-device page must derive the Canary execution precheck lock chain."
);
assertContains(
  pageSource,
  "Canary执行前置锁定",
  "Runtime FCU single-device page must show the Canary execution precheck lock view."
);
assertContains(
  pageSource,
  "BA 写适配器",
  "Runtime FCU Canary execution lock view must include BA write adapter readiness."
);
assertContains(
  pageSource,
  "反馈监视",
  "Runtime FCU Canary execution lock view must include feedback monitoring."
);
assertContains(
  pageSource,
  "未通过前禁止进入 3001 真实 Canary 执行",
  "Runtime FCU Canary execution lock view must block real Canary until all prechecks pass."
);
assertContains(
  pageSource,
  "不保存确认短语、不下发 BA/PLC",
  "Runtime FCU Canary execution lock view must state it is read-only evidence."
);
assertContains(
  pageSource,
  "selectedCanaryDispatchLocked",
  "Runtime FCU Canary execution button must be hard-locked by the precheck chain."
);
assertContains(
  pageSource,
  "selectedCanaryDispatchLockReason",
  "Runtime FCU Canary execution button must expose the first precheck blocker."
);
assertRegex(
  pageSource,
  /disabled=\{!selectedDeviceCode \|\| canaryDispatchRunning \|\| !canaryDispatchConfirmText \|\| selectedCanaryDispatchLocked\}/,
  "Runtime FCU Canary execution button must be disabled while precheck chain is blocked."
);
assertContains(
  pageSource,
  "Canary 执行已锁定",
  "Runtime FCU Canary handler must refuse execution before calling BFF when precheck chain is blocked."
);
assertRegex(
  pageSource,
  /finalFieldCloseoutPackage\?\.readyForCanary/,
  "Runtime FCU final-control panel must distinguish whether canary is allowed by closeout."
);
assertContains(
  pageSource,
  "fcu-final-remediation-card",
  "Runtime FCU final-control panel must render per-device remediation cards."
);
assertRegex(
  pageSource,
  /item\.fieldActions[\s\S]+?slice\(0,\s*2\)/,
  "Per-device remediation cards must show field actions for onsite commissioning."
);
assertContains(
  pageSource,
  "item.releaseCriteria",
  "Per-device remediation cards must show release criteria before final control."
);
assertContains(
  pageSource,
  "selectedQualityRemediation",
  "Single-device FCU page must resolve the selected device remediation record."
);
assertContains(
  pageSource,
  "本机 P0 消缺",
  "Single-device FCU page must show onsite remediation actions for the current device."
);
assertRegex(
  pageSource,
  /selectedQualityRemediation\.releaseCriteria[\s\S]+?slice\(0,\s*4\)/,
  "Single-device FCU remediation panel must show release criteria."
);
assertContains(
  pageSource,
  "selectedSignoffReleaseMatrix",
  "Single-device FCU page must resolve the selected device signoff release matrix row."
);
assertContains(
  pageSource,
  "selectedOnsiteReleasePrecheck",
  "Single-device FCU page must resolve the selected device onsite release precheck row."
);
assertContains(
  pageSource,
  "selectedSignoffMissingChecklist",
  "Single-device FCU page must expose missing signoff checklist fields."
);
assertContains(
  pageSource,
  "本机现场签核缺口",
  "Single-device FCU page must show the current device onsite signoff gap."
);
assertContains(
  pageSource,
  "只读证据链",
  "Single-device FCU signoff gap card must state it is a read-only evidence chain."
);
assertContains(
  pageSource,
  "不保存签核、不生成真实 Canary、不下发 BA/PLC",
  "Single-device FCU signoff gap card must not imply it can release or write control."
);
assertRegex(
  pageSource,
  /selectedSignoffMissingChecklist\.slice\(0,\s*5\)/,
  "Single-device FCU signoff gap card must list required checklist fields."
);
assertRegex(
  pageSource,
  /selectedSignoffNextActions\.length[\s\S]+?selectedSignoffReleaseCriteria/,
  "Single-device FCU signoff gap card must show next onsite actions or release criteria."
);

assertRegex(
  clientSource,
  /runFcuControlCycle\([\s\S]+?deviceCode\?: string[\s\S]+?search\.set\("deviceCode", options\.deviceCode\)/,
  "BFF client control-cycle helper must support deviceCode."
);
assertRegex(
  clientSource,
  /runFcuManualControlCommand\([\s\S]+?deviceCode: string[\s\S]+?search\.set\("deviceCode", options\.deviceCode\)/,
  "BFF client manual command helper must require and send deviceCode."
);

console.log("FCU_DEVICE_CONTROL_UI_CONTRACT ok=true per_device_detail=true per_device_control=true");

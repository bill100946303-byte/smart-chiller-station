import { Building2, ChevronLeft, ChevronRight, Fan, Gauge, RefreshCw, ShieldCheck, SlidersHorizontal, Thermometer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentProject, resolveEnergyConfigSiteId } from "../services/auth";
import {
  fetchFcuControlPolicy,
  fetchFcuControlRecords,
  fetchFcuDeviceCommissioningStatus,
  fetchFcuFieldArmCheck,
  fetchFcuFieldPreflight,
  fetchFcuFinalControlStatus,
  fetchFanCoilTerminalHistory,
  fetchFanCoilTerminalSnapshot,
  fetchSiteCapabilities,
  executeFcuCanaryDispatch,
  executeFcuFinalControlRollout,
  generateFcuCanaryWindow,
  generateFcuFieldArmPackage,
  refreshFcuFinalControlStatus,
  runFcuControlCycle,
  runFcuManualControlCommand,
  verifyFcuControlRecordFeedback,
  type FcuControlPolicyResponseDto,
  type FcuControlRecordDto,
  type FcuControlRecordListDto,
  type FcuControlCycleDto,
  type FcuCanaryDispatchResponseDto,
  type FcuCanaryWindowResponseDto,
  type FcuDeviceCommissioningStatusResponseDto,
  type FcuFieldArmCheckResponseDto,
  type FcuFieldArmPackageResponseDto,
  type FcuFinalControlRolloutResponseDto,
  type FcuFinalControlStatusDto,
  type FanCoilTerminalHistoryDto,
  type FanCoilTerminalItemDto,
  type FanCoilTerminalSnapshotDto,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto
} from "../services/bffClient";

type Tone = "good" | "warn" | "neutral";
type TerminalView = "overview" | "control" | "quality" | "devices" | "device";

const HVAC_TERMINAL_REFRESH_MS = 20_000;
const OFFICE_TERMINAL_BUILD = 1;
const OFFICE_TERMINAL_FLOOR = 1;
const CONTROL_QUEUE_STATUSES = new Set(["ready", "blocked", "held", "shadow", "pending_approval", "dispatch_failed", "dispatched"]);
type ManualFcuCommandKind = "start" | "stop" | "setpoint" | "fan_speed";

function normalizeTerminalView(value: string | null): TerminalView {
  if (value === "control" || value === "quality" || value === "devices" || value === "device") {
    return value;
  }
  return "overview";
}

function normalizeDeviceKey(value: string | null | undefined): string {
  return String(value || "").trim();
}

function resolveFanCoilDeviceKey(item: Pick<FanCoilTerminalItemDto, "deviceCode" | "deviceId" | "deviceName">): string {
  return normalizeDeviceKey(item.deviceCode || item.deviceId || item.deviceName);
}

function isOfficeTerminalSiteCandidate(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized === "126" || normalized.startsWith("126lnoffice") || normalized.startsWith("126");
}

function resolveHvacTerminalConfigSiteId(
  project: ReturnType<typeof getCurrentProject>,
  fallbackSiteId: string,
  routeSiteId: string | null
): string {
  const resolved = resolveEnergyConfigSiteId(project, fallbackSiteId);
  const candidates = [
    routeSiteId,
    fallbackSiteId,
    resolved,
    project?.siteId,
    project?.siteCode,
    project?.siteName,
    project?.appExplain,
    project?.databaseKey,
    project?.modelKey,
    project?.projectId
  ];
  if (candidates.some(isOfficeTerminalSiteCandidate)) {
    return "126lnoffice";
  }
  return resolved;
}

function formatManualFanSpeed(value: string): string {
  if (value === "low") {
    return "低";
  }
  if (value === "medium") {
    return "中";
  }
  if (value === "high") {
    return "高";
  }
  return "自动";
}

function isDemoData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return item?.status === "enabled" && item.sourceStatus === "demo_data";
}

function waitingForRealData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return item?.status === "enabled" && item.sourceStatus === "waiting_points";
}

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  if (isDemoData(item)) {
    return "演示数据 / 只读";
  }
  if (waitingForRealData(item)) {
    return "配置已发布 / 待接实时";
  }
  if (item?.status === "enabled") {
    return "已接入实时";
  }
  if (item?.status === "not_configured") {
    return "未配置 / 可接入";
  }
  if (item?.status === "not_applicable") {
    return "不适用";
  }
  return item?.status || "未知";
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  if (isDemoData(item)) {
    return "neutral";
  }
  if (waitingForRealData(item) || item?.status === "not_configured") {
    return "warn";
  }
  if (item?.status === "enabled") {
    return "good";
  }
  return "neutral";
}

function formatBoundaryMode(value: string): string {
  if (value === "shadow") {
    return "影子建议";
  }
  if (value === "assisted") {
    return "人工确认";
  }
  if (value === "enforced") {
    return "闭环预留";
  }
  return "只读";
}

function formatDataStatus(item: RuntimeSubsystemCapabilityDto | null, fanCoilReady: boolean): string {
  if (fanCoilReady) {
    return "BA实时快照";
  }
  if (isDemoData(item)) {
    return "演示数据";
  }
  if (waitingForRealData(item)) {
    return "待接现场点";
  }
  if (item?.sourceStatus === "ok") {
    return "实时正常";
  }
  if (item?.status === "enabled") {
    return item.sourceStatus || "待核对";
  }
  return "不参与";
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatMetricValue(enabled: boolean, ready: boolean, value: string): string {
  if (!enabled) {
    return "未配置";
  }
  return ready ? value : "待接入";
}

function formatSampleTime(value: string | null | undefined): string {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function formatRunState(value: boolean | null | undefined): string {
  if (value === true) {
    return "运行";
  }
  if (value === false) {
    return "停止";
  }
  return "未知";
}

function formatAlarmState(value: boolean | null | undefined): string {
  if (value === true) {
    return "通讯报警";
  }
  if (value === false) {
    return "正常";
  }
  return "未知";
}

function formatQualityStatus(value: string | null | undefined): string {
  if (value === "ok") {
    return "质量正常";
  }
  if (value === "invalid") {
    return "质量剔除";
  }
  return value || "待判断";
}

function qualityTone(value: string | null | undefined): Tone {
  if (value === "ok") {
    return "good";
  }
  if (value === "invalid") {
    return "warn";
  }
  return "neutral";
}

function statusPillTone(value: boolean | null | undefined, positiveIsGood = true): Tone {
  if (value == null) {
    return "neutral";
  }
  return value === positiveIsGood ? "good" : "warn";
}

function formatFcuControlMode(value: string | null | undefined): string {
  if (value === "enforced") {
    return "自动闭环";
  }
  if (value === "assisted") {
    return "人工确认";
  }
  return "影子建议";
}

function formatFcuControlStatus(value: string | null | undefined): string {
  if (value === "blocked") {
    return "保护阻断";
  }
  if (value === "shadow") {
    return "影子记录";
  }
  if (value === "pending_approval") {
    return "待审批";
  }
  if (value === "ready") {
    return "待适配器下发";
  }
  if (value === "dispatched") {
    return "已下发";
  }
  if (value === "feedback_confirmed") {
    return "反馈已确认";
  }
  if (value === "feedback_pending") {
    return "反馈待确认";
  }
  if (value === "feedback_partial") {
    return "反馈部分确认";
  }
  if (value === "feedback_mismatch_locked") {
    return "反馈不一致锁定";
  }
  if (value === "feedback_not_checkable") {
    return "反馈不可校验";
  }
  if (value === "dispatch_failed") {
    return "下发失败";
  }
  if (value === "rolled_back") {
    return "已回退";
  }
  if (value === "held") {
    return "保持";
  }
  return value || "未知";
}

function fcuControlTone(value: string | null | undefined): Tone {
  if (value === "blocked" || value === "pending_approval" || value === "dispatch_failed" || value === "feedback_mismatch_locked") {
    return "warn";
  }
  if (value === "shadow" || value === "ready" || value === "dispatched" || value === "feedback_confirmed") {
    return "good";
  }
  return "neutral";
}

function formatControlExecutionBoundary(policy: FcuControlPolicyResponseDto["policy"] | null | undefined, terminalSubsystem: RuntimeSubsystemCapabilityDto | null): string {
  if (!policy?.enabled) {
    return "策略未启用";
  }
  if (policy.defaultMode === "enforced") {
    if (terminalSubsystem?.controlBoundary?.writeEnabled === false) {
      return "策略已闭环 / 子系统总闸只读";
    }
    return "策略已闭环 / 等待后端总闸";
  }
  if (policy.defaultMode === "assisted") {
    return "人工确认后下发";
  }
  return "仅输出影子建议";
}

function formatFcuFieldAuthorizationStatus(value: string | null | undefined): string {
  if (value === "approved") {
    return "现场已授权";
  }
  if (value === "requested") {
    return "授权已申请";
  }
  if (value === "revoked") {
    return "授权已撤销";
  }
  return "现场未授权";
}

function fcuFieldAuthorizationTone(value: string | null | undefined): Tone {
  if (value === "approved") {
    return "good";
  }
  if (value === "requested") {
    return "neutral";
  }
  return "warn";
}

function formatFcuExecutionGateSummary(gate: FcuControlPolicyResponseDto["executionGate"] | null | undefined): string {
  if (!gate) {
    return "投运状态待读取";
  }
  if (gate.dispatchAllowed) {
    return "允许真实下发";
  }
  if (gate.readOnlyMode) {
    return "后端只读总闸";
  }
  if (!gate.subsystemWriteEnabled) {
    return "子系统写总闸关闭";
  }
  if (!gate.adapterConfigured) {
    return "BA适配器未配置";
  }
  if (!gate.whitelistCount) {
    return "白名单为空";
  }
  return "投运条件未满足";
}

function formatFcuFinalDispatchGateSummary(gate: FcuControlPolicyResponseDto["finalDispatchGate"] | null | undefined): string {
  if (!gate) {
    return "总门禁待读取";
  }
  if (gate.dispatchAllowed) {
    return "总门禁通过";
  }
  const finalGateBlocked = gate.blockedReasons?.includes("final_control_gates_passed");
  const canaryBlocked = gate.blockedReasons?.includes("final_canary_ready");
  if (finalGateBlocked && canaryBlocked) {
    return "签核/Canary阻断";
  }
  if (finalGateBlocked) {
    return "最终总门禁阻断";
  }
  if (canaryBlocked) {
    return "Canary未放行";
  }
  return "总门禁未满足";
}

function formatFcuCommissioningStatus(value: string | null | undefined): string {
  if (value === "ready") {
    return "可真实下发";
  }
  if (value === "environment_blocked") {
    return "设备侧就绪 / 环境阻断";
  }
  if (value === "blocked") {
    return "单台阻断";
  }
  if (value === "not_found") {
    return "未找到设备";
  }
  return value || "投运状态待读取";
}

function formatFcuControlEntryStatus(
  commissioningStatus?: FcuDeviceCommissioningStatusResponseDto["commissioningStatus"] | null
): { label: string; tone: Tone } {
  if (!commissioningStatus) {
    return { label: "可进入控制", tone: "neutral" };
  }
  if (commissioningStatus.canDispatch) {
    return { label: "可确认下发", tone: "good" };
  }
  if (commissioningStatus.deviceReady) {
    return { label: "可预演 / 总闸阻断", tone: "neutral" };
  }
  if (commissioningStatus.status === "not_found") {
    return { label: "快照未找到", tone: "warn" };
  }
  return { label: "可预演 / 待投运", tone: "warn" };
}

function formatFcuFinalVerdict(value: string | null | undefined): string {
  if (value === "fcu_all_device_control_complete") {
    return "全量最终控制完成";
  }
  if (value === "final_control_incomplete") {
    return "最终控制未完成";
  }
  if (value === "final_control_status_unavailable") {
    return "验收证据缺失";
  }
  return value || "状态待读取";
}

function classifyFcuFieldArmAction(key: string | null | undefined, phase: string | null | undefined): { label: string; tone: Tone } {
  const normalizedKey = String(key || "").toLowerCase();
  const normalizedPhase = String(phase || "").toLowerCase();
  if (
    normalizedKey.includes("backend") ||
    normalizedKey.includes("confirm") ||
    normalizedKey.includes("readonly") ||
    normalizedKey.includes("preflight") ||
    normalizedPhase === "environment"
  ) {
    return { label: "软件/环境", tone: "warn" };
  }
  if (normalizedKey.includes("ba") || normalizedKey.includes("mapping") || normalizedKey.includes("write") || normalizedPhase === "mapping") {
    return { label: "BA/点位", tone: "neutral" };
  }
  if (normalizedKey.includes("arm") || normalizedKey.includes("authorization") || normalizedPhase === "authorization") {
    return { label: "现场授权", tone: "warn" };
  }
  if (
    normalizedKey.includes("canary") ||
    normalizedKey.includes("feedback") ||
    normalizedKey.includes("rollback") ||
    normalizedPhase === "dispatch" ||
    normalizedPhase === "feedback" ||
    normalizedPhase === "rollback"
  ) {
    return { label: "投运验证", tone: "neutral" };
  }
  if (normalizedKey.includes("quality") || normalizedKey.includes("temperature") || normalizedKey.includes("communication")) {
    return { label: "现场质量", tone: "warn" };
  }
  return { label: "待归类", tone: "neutral" };
}

function rankFcuFieldArmAction(key: string | null | undefined, category: string): number {
  const normalizedKey = String(key || "").toLowerCase();
  if (normalizedKey.includes("backend") || normalizedKey.includes("write_gate") || normalizedKey.includes("readonly")) {
    return 10;
  }
  if (normalizedKey.includes("confirm")) {
    return 20;
  }
  if (normalizedKey.includes("arm") || category === "现场授权") {
    return 30;
  }
  if (normalizedKey.includes("preflight")) {
    return 40;
  }
  if (normalizedKey.includes("canary")) {
    return 50;
  }
  if (normalizedKey.includes("feedback")) {
    return 60;
  }
  if (normalizedKey.includes("quality") || normalizedKey.includes("temperature") || normalizedKey.includes("communication")) {
    return 70;
  }
  return 90;
}

function pickVisibleFcuFieldArmActions<T extends { category: string }>(items: T[], limit = 8): T[] {
  const picked: T[] = [];
  const categoryCounts = new Map<string, number>();
  const categoryLimit = (category: string) => {
    if (category === "软件/环境") {
      return 4;
    }
    if (category === "现场授权") {
      return 2;
    }
    return 2;
  };
  for (const item of items) {
    const count = categoryCounts.get(item.category) || 0;
    if (count >= categoryLimit(item.category)) {
      continue;
    }
    picked.push(item);
    categoryCounts.set(item.category, count + 1);
    if (picked.length >= limit) {
      return picked;
    }
  }
  for (const item of items) {
    if (picked.includes(item)) {
      continue;
    }
    picked.push(item);
    if (picked.length >= limit) {
      return picked;
    }
  }
  return picked;
}

function formatFcuBlockReason(value: string | null | undefined): string {
  if (value === "backend_write_gate") {
    return "后端只读总闸";
  }
  if (value === "field_arm_ready") {
    return "现场 Arm-Check 未通过";
  }
  if (value === "canary_dispatch_confirmed") {
    return "首台未真实下发";
  }
  if (value === "canary_feedback_confirmed") {
    return "首台反馈未确认";
  }
  if (value === "small_batch_confirmed") {
    return "小批量未确认";
  }
  if (value === "all_device_feedback_confirmed") {
    return "全量反馈未确认";
  }
  if (value === "communication_alarm") {
    return "通讯报警";
  }
  if (value === "zero_temperature") {
    return "0°C 异常";
  }
  if (value === "invalid_temperature") {
    return "温度无效";
  }
  return value || "--";
}

function formatFcuWorklistStatus(value: string | null | undefined): string {
  if (value === "ready") {
    return "通过";
  }
  if (value === "blocked") {
    return "阻断";
  }
  return "待处理";
}

function fcuWorklistTone(value: string | null | undefined): Tone {
  if (value === "ready") {
    return "good";
  }
  if (value === "blocked") {
    return "warn";
  }
  return "neutral";
}

function StatTile({
  title,
  value,
  unit,
  note,
  tone
}: {
  title: string;
  value: string;
  unit?: string;
  note: string;
  tone: Tone;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <p className="stat-title">{title}</p>
      <div className="stat-main">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <span className={`status-pill ${tone}`}>{note}</span>
    </div>
  );
}

function FanCoilCard({
  item,
  controlRecord,
  commissioningStatus,
  entryLabel = "进入控制"
}: {
  item: FanCoilTerminalItemDto;
  controlRecord?: FcuControlRecordDto | null;
  commissioningStatus?: FcuDeviceCommissioningStatusResponseDto["commissioningStatus"] | null;
  entryLabel?: string;
}) {
  const setpoint = item.setpointFeedbackC ?? item.setpointC;
  const runTone = statusPillTone(item.running, true);
  const alarmTone = item.communicationAlarm === true ? "warn" : item.communicationAlarm === false ? "good" : "neutral";
  const qualityStatus = item.quality?.status || "unknown";
  const controlEntry = formatFcuControlEntryStatus(commissioningStatus);
  return (
    <article className={`fan-coil-card ${item.communicationAlarm ? "is-alarm" : item.running ? "is-running" : "is-stopped"}`}>
      <header>
        <div>
          <strong>{item.deviceName || "风机盘管"}</strong>
          <span>{item.deviceCode || "--"} · {item.deviceTypeName || "FCU"}</span>
        </div>
        <span className={`status-pill ${alarmTone}`}>{formatAlarmState(item.communicationAlarm)}</span>
      </header>
      <div className="fan-coil-values">
        <div>
          <span>温度</span>
          <strong>{formatNumber(item.zoneTemperatureC, 1)}<small>°C</small></strong>
        </div>
        <div>
          <span>设定</span>
          <strong>{formatNumber(setpoint, 1)}<small>°C</small></strong>
        </div>
        <div>
          <span>阀门</span>
          <strong>{item.valveOpen == null ? "--" : item.valveOpen ? "开" : "关"}</strong>
        </div>
      </div>
      <div className="fan-coil-status-line">
        <span className={`status-pill ${runTone}`}>{formatRunState(item.running)}</span>
        <span className={`status-pill ${qualityTone(qualityStatus)}`}>{formatQualityStatus(qualityStatus)}</span>
        {controlRecord ? (
          <span className={`status-pill ${fcuControlTone(controlRecord.status)}`}>{formatFcuControlStatus(controlRecord.status)}</span>
        ) : null}
        {commissioningStatus ? (
          <span className={`status-pill ${controlEntry.tone}`}>
            {controlEntry.label}
          </span>
        ) : null}
        <span>风速 {formatNumber(item.fanSpeedState, 0)}</span>
      </div>
      <footer>
        <span>快照 {formatSampleTime(item.sampledAt)}</span>
        <span>{item.pointCount || 0}点 · 写点展示 {item.writablePointCount || 0}</span>
      </footer>
      <span className="fan-coil-card-action">
        {entryLabel}
        <ChevronRight size={13} />
      </span>
    </article>
  );
}

export default function HvacTerminalMonitoringPage() {
  const [searchParams] = useSearchParams();
  const currentProject = getCurrentProject();
  const siteId = resolveHvacTerminalConfigSiteId(currentProject, runtimeConfig.siteId, searchParams.get("siteId"));
  const terminalView = normalizeTerminalView(searchParams.get("view"));
  const selectedDeviceCode = normalizeDeviceKey(searchParams.get("deviceCode") || searchParams.get("device"));
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [capabilities, setCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);
  const [fanCoils, setFanCoils] = useState<FanCoilTerminalSnapshotDto | null>(null);
  const [fanCoilHistory, setFanCoilHistory] = useState<FanCoilTerminalHistoryDto | null>(null);
  const [controlPolicy, setControlPolicy] = useState<FcuControlPolicyResponseDto | null>(null);
  const [controlRecords, setControlRecords] = useState<FcuControlRecordListDto | null>(null);
  const [deviceCommissioningStatus, setDeviceCommissioningStatus] = useState<FcuDeviceCommissioningStatusResponseDto | null>(null);
  const [fieldArmCheck, setFieldArmCheck] = useState<FcuFieldArmCheckResponseDto | null>(null);
  const [finalControlStatus, setFinalControlStatus] = useState<FcuFinalControlStatusDto | null>(null);
  const [controlRunning, setControlRunning] = useState(false);
  const [controlDispatching, setControlDispatching] = useState(false);
  const [feedbackVerifyingId, setFeedbackVerifyingId] = useState("");
  const [lastControlPreview, setLastControlPreview] = useState<FcuControlCycleDto | null>(null);
  const [lastControlPreviewTarget, setLastControlPreviewTarget] = useState("");
  const [lastControlPreviewSignature, setLastControlPreviewSignature] = useState("");
  const [controlNotice, setControlNotice] = useState("");
  const [manualSetpointText, setManualSetpointText] = useState("");
  const [manualSetpointInputDeviceCode, setManualSetpointInputDeviceCode] = useState("");
  const [manualFanSpeed, setManualFanSpeed] = useState("auto");
  const [manualCommandRunning, setManualCommandRunning] = useState(false);
  const [manualCommandDispatching, setManualCommandDispatching] = useState(false);
  const [canaryWindowGenerating, setCanaryWindowGenerating] = useState(false);
  const [selectedCanaryWindow, setSelectedCanaryWindow] = useState<FcuCanaryWindowResponseDto | null>(null);
  const [fieldArmPackageGenerating, setFieldArmPackageGenerating] = useState(false);
  const [selectedFieldArmPackage, setSelectedFieldArmPackage] = useState<FcuFinalControlStatusDto["fieldArmPackage"] | null>(null);
  const [selectedFieldArmPrecheckResult, setSelectedFieldArmPrecheckResult] = useState<FcuFieldArmPackageResponseDto | null>(null);
  const [canaryDispatchRunning, setCanaryDispatchRunning] = useState(false);
  const [canaryDispatchConfirmText, setCanaryDispatchConfirmText] = useState("");
  const [selectedCanaryDispatch, setSelectedCanaryDispatch] = useState<FcuCanaryDispatchResponseDto | null>(null);
  const [finalStatusRefreshing, setFinalStatusRefreshing] = useState(false);
  const [finalRolloutRunning, setFinalRolloutRunning] = useState(false);
  const [finalRolloutBaConfirmText, setFinalRolloutBaConfirmText] = useState("");
  const [finalRolloutConfirmText, setFinalRolloutConfirmText] = useState("");
  const [selectedFinalRolloutExecution, setSelectedFinalRolloutExecution] = useState<FcuFinalControlRolloutResponseDto | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorText("");
    try {
      const capabilityData = await fetchSiteCapabilities(siteId);
      setCapabilities(capabilityData);
      const terminal = capabilityData.items?.find((item) => item.subsystemType === "hvac_terminal") || null;
      if (terminal?.status === "enabled") {
        const selectedDevice = terminalView === "device" ? selectedDeviceCode : "";
        const snapshot = await fetchFanCoilTerminalSnapshot(siteId, {
          build: OFFICE_TERMINAL_BUILD,
          floor: OFFICE_TERMINAL_FLOOR
        });
        const [historyResult, policyResult, recordsResult, commissioningResult, armCheckResult, finalStatusResult] =
          await Promise.allSettled([
            fetchFanCoilTerminalHistory(siteId, {
              floor: OFFICE_TERMINAL_FLOOR,
              limit: 240
            }),
            fetchFcuControlPolicy(siteId),
            fetchFcuControlRecords(siteId, {
              limit: selectedDevice ? 50 : 20,
              deviceCode: selectedDevice || undefined
            }),
            fetchFcuDeviceCommissioningStatus(siteId, {
              build: OFFICE_TERMINAL_BUILD,
              floor: OFFICE_TERMINAL_FLOOR,
              deviceCode: selectedDevice || undefined
            }),
            fetchFcuFieldArmCheck(siteId, {
              build: OFFICE_TERMINAL_BUILD,
              floor: OFFICE_TERMINAL_FLOOR
            }),
            fetchFcuFinalControlStatus(siteId)
          ]);
        setFanCoils(snapshot);
        setFanCoilHistory(historyResult.status === "fulfilled" ? historyResult.value : null);
        setControlPolicy(policyResult.status === "fulfilled" ? policyResult.value : null);
        setControlRecords(recordsResult.status === "fulfilled" ? recordsResult.value : null);
        setDeviceCommissioningStatus(commissioningResult.status === "fulfilled" ? commissioningResult.value : null);
        setFieldArmCheck(armCheckResult.status === "fulfilled" ? armCheckResult.value : null);
        setFinalControlStatus(finalStatusResult.status === "fulfilled" ? finalStatusResult.value : null);
      } else {
        setFanCoils(null);
        setFanCoilHistory(null);
        setControlPolicy(null);
        setControlRecords(null);
        setDeviceCommissioningStatus(null);
        setFieldArmCheck(null);
        setFinalControlStatus(null);
        setLastControlPreview(null);
        setLastControlPreviewTarget("");
        setLastControlPreviewSignature("");
      }
    } catch (error) {
      setFanCoils(null);
      setFanCoilHistory(null);
      setControlPolicy(null);
      setControlRecords(null);
      setDeviceCommissioningStatus(null);
      setFieldArmCheck(null);
      setFinalControlStatus(null);
      setLastControlPreview(null);
      setLastControlPreviewTarget("");
      setLastControlPreviewSignature("");
      setErrorText(error instanceof Error ? error.message : "空调末端数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunControlCycle(dispatch = false, deviceCode = "") {
    if (controlRunning || controlDispatching) {
      return;
    }
    const targetDeviceCode = normalizeDeviceKey(deviceCode);
    if (dispatch) {
      setControlDispatching(true);
    } else {
      setControlRunning(true);
    }
    setControlNotice("");
    setErrorText("");
    try {
      const result = await runFcuControlCycle(siteId, {
        build: OFFICE_TERMINAL_BUILD,
        floor: OFFICE_TERMINAL_FLOOR,
        dispatch,
        deviceCode: targetDeviceCode || undefined
      });
      const records = await fetchFcuControlRecords(siteId, {
        limit: 20,
        deviceCode: targetDeviceCode || undefined
      });
      const commissioning = targetDeviceCode
        ? await fetchFcuDeviceCommissioningStatus(siteId, {
            build: OFFICE_TERMINAL_BUILD,
            floor: OFFICE_TERMINAL_FLOOR,
            deviceCode: targetDeviceCode
          })
        : null;
      setControlRecords(records);
      setDeviceCommissioningStatus(commissioning);
      setLastControlPreview(dispatch ? null : result);
      setLastControlPreviewTarget(dispatch ? "" : targetDeviceCode);
      setLastControlPreviewSignature(dispatch ? "" : `auto:${targetDeviceCode}`);
      setControlNotice(
        `${dispatch ? (result.dispatchAllowed ? "确认下发完成" : "确认请求已按只读保护记录") : "控制预演完成"}${targetDeviceCode ? `（${targetDeviceCode}）` : ""}：${result.summary?.commandCount || 0} 条命令候选，${result.summary?.blockedCount || 0} 台保护阻断，写控制副作用 ${result.summary?.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 控制周期执行失败");
    } finally {
      setControlRunning(false);
      setControlDispatching(false);
    }
  }

  function buildManualCommand(kind: ManualFcuCommandKind) {
    if (kind === "start") {
      return { start: true };
    }
    if (kind === "stop") {
      return { stop: true };
    }
    if (kind === "fan_speed") {
      return { fanSpeed: manualFanSpeed };
    }
    const setpointC = Number(manualSetpointText);
    return { setpointC: Number.isFinite(setpointC) ? setpointC : Number.NaN };
  }

  function buildManualCommandSignature(kind: ManualFcuCommandKind, deviceCode: string) {
    const command = buildManualCommand(kind);
    return `manual:${deviceCode}:${kind}:${JSON.stringify(command)}`;
  }

  async function handleRunManualCommand(kind: ManualFcuCommandKind, dispatch = false) {
    if (!selectedDeviceCode || !selectedFanCoil || manualCommandRunning || manualCommandDispatching) {
      return;
    }
    const targetDeviceCode = selectedDeviceCode;
    const command = buildManualCommand(kind);
    const signature = buildManualCommandSignature(kind, targetDeviceCode);
    if (kind === "setpoint" && !Number.isFinite(Number(manualSetpointText))) {
      setErrorText("温度设定值无效，请输入数字。");
      return;
    }
    if (dispatch && lastControlPreviewSignature !== signature) {
      setErrorText("当前手动命令未完成同目标预演，请先预演后再确认下发。");
      return;
    }
    if (dispatch) {
      setManualCommandDispatching(true);
    } else {
      setManualCommandRunning(true);
    }
    setControlNotice("");
    setErrorText("");
    try {
      const result = await runFcuManualControlCommand(siteId, {
        build: OFFICE_TERMINAL_BUILD,
        floor: OFFICE_TERMINAL_FLOOR,
        dispatch,
        deviceCode: targetDeviceCode,
        command
      });
      const records = await fetchFcuControlRecords(siteId, {
        limit: 20,
        deviceCode: targetDeviceCode
      });
      const commissioning = await fetchFcuDeviceCommissioningStatus(siteId, {
        build: OFFICE_TERMINAL_BUILD,
        floor: OFFICE_TERMINAL_FLOOR,
        deviceCode: targetDeviceCode
      });
      setControlRecords(records);
      setDeviceCommissioningStatus(commissioning);
      setLastControlPreview(dispatch ? null : result);
      setLastControlPreviewTarget(dispatch ? "" : targetDeviceCode);
      setLastControlPreviewSignature(dispatch ? "" : signature);
      setControlNotice(
        `${dispatch ? (result.dispatchAllowed ? "手动命令确认下发完成" : "手动命令确认请求已按只读保护记录") : "手动命令预演完成"}（${targetDeviceCode}）：${result.summary?.commandCount || 0} 条命令候选，${result.summary?.blockedCount || 0} 台保护阻断，写控制副作用 ${result.summary?.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 手动命令执行失败");
    } finally {
      setManualCommandRunning(false);
      setManualCommandDispatching(false);
    }
  }

  async function handleGenerateCanaryWindow() {
    if (!selectedDeviceCode || canaryWindowGenerating) {
      return;
    }
    setCanaryWindowGenerating(true);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await generateFcuCanaryWindow(siteId, {
        deviceCode: selectedDeviceCode
      });
      setSelectedCanaryWindow(result);
      const finalStatus = await fetchFcuFinalControlStatus(siteId);
      setFinalControlStatus(finalStatus);
      setControlNotice(
        `单台投运窗口已生成（${selectedDeviceCode}）：${result.verdict || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 单台投运窗口生成失败");
    } finally {
      setCanaryWindowGenerating(false);
    }
  }

  async function handleGenerateFieldArmPackage() {
    if (!selectedDeviceCode || fieldArmPackageGenerating) {
      return;
    }
    setFieldArmPackageGenerating(true);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await generateFcuFieldArmPackage(siteId, {
        deviceCode: selectedDeviceCode
      });
      setSelectedFieldArmPackage(result.fieldArmPackage || null);
      setSelectedFieldArmPrecheckResult(result);
      const [commissioning, armCheck, finalStatus, policy] = await Promise.all([
        fetchFcuDeviceCommissioningStatus(siteId, {
          build: OFFICE_TERMINAL_BUILD,
          floor: OFFICE_TERMINAL_FLOOR,
          deviceCode: selectedDeviceCode
        }),
        fetchFcuFieldArmCheck(siteId, {
          build: OFFICE_TERMINAL_BUILD,
          floor: OFFICE_TERMINAL_FLOOR
        }),
        fetchFcuFinalControlStatus(siteId),
        fetchFcuControlPolicy(siteId)
      ]);
      setDeviceCommissioningStatus(commissioning);
      setFieldArmCheck(armCheck);
      setFinalControlStatus(finalStatus);
      setControlPolicy(policy);
      const p0Blockers = (result.fieldArmPackage?.blockers || []).filter((item) => item.severity === "P0").length;
      setControlNotice(
        `现场开闸包已生成（${selectedDeviceCode}）：${result.fieldArmPackage?.verdict || result.verdict || "状态未知"}，P0 ${p0Blockers} 项，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 现场开闸包生成失败");
    } finally {
      setFieldArmPackageGenerating(false);
    }
  }

  async function handleRefreshFieldPreflight() {
    if (!selectedDeviceCode || finalStatusRefreshing) {
      return;
    }
    setFinalStatusRefreshing(true);
    setControlNotice("");
    setErrorText("");
  try {
      const [preflight, finalStatus] = await Promise.all([
        fetchFcuFieldPreflight(siteId, {
          build: OFFICE_TERMINAL_BUILD,
          floor: OFFICE_TERMINAL_FLOOR,
          deviceCode: selectedDeviceCode
        }),
        fetchFcuFinalControlStatus(siteId)
      ]);
      setDeviceCommissioningStatus(preflight);
      setFieldArmCheck(preflight.fieldArmCheck || null);
      setFinalControlStatus(finalStatus);
      setControlPolicy({
        site: preflight.site,
        generatedAt: preflight.generatedAt,
        policy: preflight.policy,
        executionGate: preflight.executionGate,
        sourceStatus: preflight.sourceStatus
      });
      setControlRecords({
        site: preflight.site,
        generatedAt: preflight.generatedAt,
        total: preflight.recentRecords?.length || 0,
        items: preflight.recentRecords || []
      });
      const authorizationReady = preflight.authorizationGate?.ready === true;
      const gateReady = preflight.executionGate?.dispatchAllowed === true;
      const armReady = preflight.fieldArmCheck?.ok === true;
      setControlNotice(
        `开闸前预检已刷新（${selectedDeviceCode}）：${preflight.verdict || "状态未知"}，授权${authorizationReady ? "就绪" : "未就绪"}，投运闸门${gateReady ? "允许" : "阻断"}，Arm-Check${armReady ? "通过" : "阻断"}，写控制副作用 ${preflight.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 开闸前预检刷新失败");
    } finally {
      setFinalStatusRefreshing(false);
    }
  }

  function extractBffErrorPayload<T>(error: unknown): T | null {
    if (error && typeof error === "object" && "payload" in error) {
      return (error as { payload?: T }).payload || null;
    }
    return null;
  }

  async function handleExecuteCanaryDispatch() {
    if (!selectedDeviceCode || canaryDispatchRunning) {
      return;
    }
    if (selectedCanaryDispatchLocked) {
      setControlNotice(`Canary 执行已锁定（${selectedDeviceCode}）：${selectedCanaryDispatchLockReason}。`);
      setErrorText("");
      return;
    }
    setCanaryDispatchRunning(true);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await executeFcuCanaryDispatch(siteId, {
        deviceCode: selectedDeviceCode,
        confirmPhrase: canaryDispatchConfirmText,
        commandKind: "setpoint"
      });
      setSelectedCanaryDispatch(result);
      const records = await fetchFcuControlRecords(siteId, {
        limit: 20,
        deviceCode: selectedDeviceCode
      });
      const finalStatus = await fetchFcuFinalControlStatus(siteId);
      setControlRecords(records);
      setFinalControlStatus(finalStatus);
      setControlNotice(
        `Canary 执行返回（${selectedDeviceCode}）：${result.mode || result.code || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      const payload = extractBffErrorPayload<FcuCanaryDispatchResponseDto>(error);
      if (payload) {
        setSelectedCanaryDispatch(payload);
        setControlNotice(
          `Canary 执行被阻断（${selectedDeviceCode}）：${payload.code || payload.error || "未满足投运条件"}，写控制副作用 ${payload.controlMutation ? "存在" : "无"}。`
        );
      } else {
        setErrorText(error instanceof Error ? error.message : "FCU Canary 执行失败");
      }
    } finally {
      setCanaryDispatchRunning(false);
    }
  }

  async function handleRefreshFinalControlStatus() {
    if (finalStatusRefreshing) {
      return;
    }
    setFinalStatusRefreshing(true);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await refreshFcuFinalControlStatus(siteId);
      setFinalControlStatus(result);
      const blockers = result.finalCompletion?.blockingItems?.length || 0;
      setControlNotice(
        `最终控制验收已刷新：${formatFcuFinalVerdict(result.verdict)}，P0 阻断 ${blockers} 项，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 最终控制验收刷新失败");
    } finally {
      setFinalStatusRefreshing(false);
    }
  }

  async function handleExecuteFinalControlRollout() {
    if (finalRolloutRunning) {
      return;
    }
    setFinalRolloutRunning(true);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await executeFcuFinalControlRollout(siteId, {
        confirmPhrase: finalRolloutBaConfirmText,
        finalRolloutConfirmPhrase: finalRolloutConfirmText
      });
      setSelectedFinalRolloutExecution(result);
      if (result.finalRollout) {
        setFinalControlStatus((current) => ({
          ...(current || {}),
          site: result.site || current?.site,
          generatedAt: result.generatedAt || current?.generatedAt,
          controlMutation: result.controlMutation === true,
          verdict: result.verdict || current?.verdict,
          finalRollout: result.finalRollout
        }));
      } else {
        const finalStatus = await fetchFcuFinalControlStatus(siteId);
        setFinalControlStatus(finalStatus);
      }
      setControlNotice(
        `最终控制编排返回：${result.verdict || result.code || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`
      );
    } catch (error) {
      const payload = extractBffErrorPayload<FcuFinalControlRolloutResponseDto>(error);
      if (payload) {
        setSelectedFinalRolloutExecution(payload);
        setControlNotice(
          `最终控制编排被阻断：${payload.code || payload.error || "未满足投运条件"}，写控制副作用 ${payload.controlMutation ? "存在" : "无"}。`
        );
      } else {
        setErrorText(error instanceof Error ? error.message : "FCU 最终控制编排执行失败");
      }
    } finally {
      setFinalRolloutRunning(false);
    }
  }

  async function handleVerifyFeedback(recordId: string | null | undefined) {
    const normalizedRecordId = recordId || "";
    if (!normalizedRecordId || feedbackVerifyingId) {
      return;
    }
    setFeedbackVerifyingId(normalizedRecordId);
    setControlNotice("");
    setErrorText("");
    try {
      const result = await verifyFcuControlRecordFeedback(siteId, normalizedRecordId, {
        build: OFFICE_TERMINAL_BUILD,
        floor: OFFICE_TERMINAL_FLOOR
      });
      const records = await fetchFcuControlRecords(siteId, {
        limit: 20,
        deviceCode: selectedDeviceCode || undefined
      });
      setControlRecords(records);
      setControlNotice(`反馈校验完成：${formatFcuControlStatus(result.record?.status)}。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 反馈校验失败");
    } finally {
      setFeedbackVerifyingId("");
    }
  }

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, HVAC_TERMINAL_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, selectedDeviceCode]);

  const terminalSubsystem: RuntimeSubsystemCapabilityDto | null = useMemo(() => {
    return capabilities?.items?.find((item) => item.subsystemType === "hvac_terminal") || null;
  }, [capabilities]);

  const fanCoilItems = fanCoils?.items || [];
  const fanCoilSummary = fanCoils?.summary || {};
  const configEnabled = terminalSubsystem?.status === "enabled";
  const configDemoData = isDemoData(terminalSubsystem);
  const fanCoilReady =
    configEnabled &&
    fanCoilItems.length > 0 &&
    (fanCoilSummary.dataStatus === "ok" || fanCoils?.sourceStatus?.overall === "ok");
  const boundaryMode = terminalSubsystem?.controlBoundary?.mode || "read_only";
  const requiredRoles = (terminalSubsystem?.requiredPointRoles || []).filter((item) => item.required !== false);
  const optionalRoles = (terminalSubsystem?.requiredPointRoles || []).filter((item) => item.required === false);
  const pointProgress = terminalSubsystem?.pointMappingProgress || 0;
  const roleSummary = configEnabled && requiredRoles.length ? `模板 ${pointProgress}% / ${requiredRoles.length}类` : "未配置";
  const requiredRoleLabel = requiredRoles.length
    ? requiredRoles.map((item) => item.label).join(" / ")
    : "区域温度 / 末端状态";
  const optionalRoleLabel = optionalRoles.length
    ? optionalRoles.map((item) => item.label).join(" / ")
    : "阀门反馈 / 温度设定 / 末端告警";
  const statusLabel = fanCoilReady ? "BA快照 / 只读" : formatStatus(terminalSubsystem);
  const statusLabelTone: Tone = fanCoilReady
    ? (fanCoilSummary.alarmCount || 0) > 0
      ? "warn"
      : "good"
    : statusTone(terminalSubsystem);
  const floorName = fanCoils?.floorName || "10楼";
  const projectLabel =
    currentProject?.appExplain || currentProject?.siteName || currentProject?.siteCode || "当前项目";
  const terminalSubtitle = fanCoilReady
    ? `${fanCoils?.building || "盛世绿能办公楼"} ${floorName}风机盘管逐台只读快照：区域温度、运行状态、风速、阀门、设定值和通讯报警。`
    : configEnabled
      ? `${projectLabel} 空调末端已发布配置，等待现场 BA / PLC / 网关实时点位接入；未接入实时数据不显示假 KPI。`
      : `${projectLabel} 未配置空调末端；未接入实时数据不显示假 KPI，不参与综合统计，仅保留未来接入入口。`;
  const sourceOverall = fanCoils?.sourceStatus?.overall || capabilities?.sourceStatus?.overall || (loading ? "loading" : "unknown");
  const averageTempValue = fanCoilReady ? formatNumber(fanCoilSummary.averageZoneTemperatureC, 1) : "";
  const runningValue = fanCoilReady ? `${fanCoilSummary.runningCount || 0}/${fanCoilSummary.total || 0}` : "";
  const onlineValue = fanCoilReady ? `${fanCoilSummary.onlineCount || 0}/${fanCoilSummary.total || 0}` : "";
  const alarmValue = fanCoilReady ? String(fanCoilSummary.communicationAlarmCount || 0) : "";
  const historyItems = fanCoilHistory?.items || [];
  const recentHistoryItems = historyItems.slice(-8);
  const latestHistory = recentHistoryItems[recentHistoryItems.length - 1] || null;
  const fcuPolicy = controlPolicy?.policy || null;
  const fcuExecutionGate = controlPolicy?.executionGate || null;
  const fcuFinalDispatchGate = controlPolicy?.finalDispatchGate || null;
  const fcuFieldAuthorization = fcuPolicy?.fieldAuthorization || null;
  const recentControlRecords = controlRecords?.items || [];
  const controlRecordsByDeviceCode = useMemo(() => {
    const pairs = new Map<string, FcuControlRecordDto>();
    for (const record of recentControlRecords) {
      const key = record.deviceCode || record.deviceId || record.deviceName || "";
      if (key && !pairs.has(key)) {
        pairs.set(key, record);
      }
    }
    return pairs;
  }, [recentControlRecords]);
  const selectedFanCoil = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return fanCoilItems.find((item) =>
      [item.deviceCode, item.deviceId, item.deviceName].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [fanCoilItems, selectedDeviceCode]);
  const selectedDeviceRecords = useMemo(() => {
    if (!selectedDeviceCode) {
      return [];
    }
    return recentControlRecords.filter((record) =>
      [record.deviceCode, record.deviceId, record.deviceName].map(normalizeDeviceKey).includes(selectedDeviceCode)
    );
  }, [recentControlRecords, selectedDeviceCode]);
  const selectedDeviceSetpoint = selectedFanCoil?.setpointFeedbackC ?? selectedFanCoil?.setpointC;
  const selectedDeviceLastRecord = selectedDeviceRecords[0] || null;
  const commissioningByDeviceCode = useMemo(() => {
    const pairs = new Map<string, FcuDeviceCommissioningStatusResponseDto["commissioningStatus"]>();
    for (const status of deviceCommissioningStatus?.items || []) {
      const key = status?.device?.deviceCode || status?.device?.deviceId || status?.device?.deviceName || "";
      if (key && !pairs.has(key)) {
        pairs.set(key, status);
      }
    }
    return pairs;
  }, [deviceCommissioningStatus]);

  useEffect(() => {
    if (terminalView !== "device") {
      return;
    }
    const deviceChanged = manualSetpointInputDeviceCode !== selectedDeviceCode;
    if (deviceChanged) {
      setManualFanSpeed("auto");
      setLastControlPreviewSignature("");
      setSelectedCanaryWindow(null);
      setSelectedFieldArmPackage(null);
      setSelectedFieldArmPrecheckResult(null);
      setSelectedCanaryDispatch(null);
      setCanaryDispatchConfirmText("");
      setManualSetpointInputDeviceCode(selectedDeviceCode);
    }
    if (deviceChanged || manualSetpointText === "") {
      setManualSetpointText(typeof selectedDeviceSetpoint === "number" && Number.isFinite(selectedDeviceSetpoint)
        ? selectedDeviceSetpoint.toFixed(1)
        : "");
    }
  }, [manualSetpointInputDeviceCode, manualSetpointText, selectedDeviceCode, selectedDeviceSetpoint, terminalView]);

  const activeControlTarget = terminalView === "device" ? selectedDeviceCode : "";
  const selectedDevicePanelLoading = terminalView === "device" && loading && Boolean(selectedDeviceCode);
  const activeAutoControlSignature = `auto:${activeControlTarget}`;
  const previewMatchesCurrentTarget = lastControlPreviewTarget === activeControlTarget && lastControlPreviewSignature === activeAutoControlSignature;
  const manualPreviewReadyCount = lastControlPreviewTarget === selectedDeviceCode ? lastControlPreview?.summary?.readyCount || 0 : 0;
  const selectedCommissioning =
    deviceCommissioningStatus?.commissioningStatus ||
    commissioningByDeviceCode.get(selectedDeviceCode) ||
    null;
  const fcuWriteEnabled =
    fcuExecutionGate?.dispatchAllowed === true && fcuFinalDispatchGate?.dispatchAllowed === true;
  const selectedFcuWriteEnabled =
    terminalView === "device" && selectedDeviceCode
      ? selectedCommissioning?.canDispatch === true && fcuFinalDispatchGate?.dispatchAllowed === true
      : fcuWriteEnabled;
  const selectedFieldPreflightVerdict =
    terminalView === "device" && deviceCommissioningStatus?.targetDeviceCode === selectedDeviceCode
      ? deviceCommissioningStatus.verdict || ""
      : "";
  const selectedFieldPreflightReady =
    selectedFieldPreflightVerdict === "canary_ready" ||
    selectedFieldPreflightVerdict === "final_control_complete";
  function canConfirmManualCommand(kind: ManualFcuCommandKind): boolean {
    if (!selectedDeviceCode || !selectedFanCoil || !selectedFcuWriteEnabled || !selectedFieldPreflightReady || manualPreviewReadyCount <= 0) {
      return false;
    }
    return lastControlPreviewSignature === buildManualCommandSignature(kind, selectedDeviceCode);
  }
  const controlQueueRecords = recentControlRecords
    .filter((record) => CONTROL_QUEUE_STATUSES.has(record.status || ""))
    .slice(0, 8);
  const controlQueuePreview = controlQueueRecords
    .slice(0, 3)
    .map((record) => `${record.deviceName || record.deviceCode || "FCU"} ${formatFcuControlStatus(record.status)}`)
    .join(" · ");
  const readyControlCount = recentControlRecords.filter((record) => record.status === "ready").length;
  const blockedControlCount = recentControlRecords.filter((record) => record.status === "blocked").length;
  const dispatchedControlCount = recentControlRecords.filter((record) => record.status === "dispatched").length;
  const controlModeLabel = formatFcuControlMode(fcuPolicy?.defaultMode);
  const whitelistCount = fcuPolicy?.whitelist?.length || 0;
  const canaryDeviceCode = fcuPolicy?.whitelist?.[0] || "";
  const canaryDeviceLabel = canaryDeviceCode || "未配置";
  const executionBoundaryLabel = formatControlExecutionBoundary(fcuPolicy, terminalSubsystem);
  const selectedCommissioningConditions = selectedCommissioning?.conditions || [];
  const selectedCommissioningBlockedText = selectedCommissioning?.blockedReasons?.length
    ? selectedCommissioning.blockedReasons.slice(0, 3).join(" / ")
    : selectedCommissioning?.controlBlockReasons?.slice(0, 3).join(" / ") || "无";
  const fieldArmReady = fieldArmCheck?.verdict === "field_arm_ready";
  const fieldArmBlockedText = fieldArmCheck?.blockingItems?.length
    ? fieldArmCheck.blockingItems.slice(0, 3).map((item) => item.message || item.label || item.key).join(" / ")
    : "无";
  const fieldArmNextActions = fieldArmCheck?.nextActions || [];
  const commissioningSummary = deviceCommissioningStatus?.summary || {};
  const commissioningReport = deviceCommissioningStatus?.report || null;
  const finalCompletion = finalControlStatus?.finalCompletion || null;
  const finalRollout = finalControlStatus?.finalRollout || null;
  const finalRunbook = finalControlStatus?.finalRunbook || null;
  const finalEvidenceConsistency = finalControlStatus?.evidenceConsistency || null;
  const finalEvidenceConsistencySummary = finalEvidenceConsistency?.summary || null;
  const finalEvidenceConsistencyIssues = finalEvidenceConsistency?.issues || [];
  const finalMilestones = finalCompletion?.milestones || {};
  const finalRolloutSummary = finalControlStatus?.rolloutPlan?.summary || null;
  const finalQualitySummary = finalControlStatus?.qualityRemediation?.summary || null;
  const finalBlockingItems = finalCompletion?.blockingItems || [];
  const finalNextActions = finalCompletion?.nextActions || [];
  const finalQualityDevices = finalControlStatus?.qualityRemediation?.devices || [];
  const selectedQualityRemediation = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return finalQualityDevices.find((item) =>
      [item.deviceCode, item.deviceName].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalQualityDevices, selectedDeviceCode]);
  const finalQualityReasons = finalControlStatus?.qualityRemediation?.reasonCounts || [];
  const finalWorklist = finalControlStatus?.finalWorklist || null;
  const finalControlGates = finalControlStatus?.finalControlGates || null;
  const finalControlGateSummary = finalControlGates?.summary || null;
  const finalControlGateBlockers = finalControlGates?.blockers || [];
  const finalControlGateNextActions = finalControlGates?.nextActions || [];
  const finalControlGateMarkdown = finalControlGates?.outputs?.markdown?.split("/").pop() || "";
  const finalWorklistActions = finalWorklist?.actions || [];
  const finalWorklistPhases = finalWorklist?.phases || [];
  const finalFieldPlaybook = finalWorklist?.fieldRemediationPlaybook || null;
  const finalFieldPlaybookDevices = finalFieldPlaybook?.devices || [];
  const finalFieldPlaybookReasonGroups = finalFieldPlaybook?.reasonGroups || [];
  const finalQualityPackage = finalWorklist?.fieldPackages?.qualityRemediation || null;
  const finalAllDevicePlanPackage = finalWorklist?.fieldPackages?.allDevicePlan || null;
  const finalFieldCloseoutPackage = finalWorklist?.fieldPackages?.fieldRemediationCloseout || null;
  const finalFieldWorkOrdersPackage = finalWorklist?.fieldPackages?.fieldRemediationWorkOrders || null;
  const finalFieldExecutionPackPackage = finalWorklist?.fieldPackages?.fieldRemediationExecutionPack || null;
  const finalFieldExecutionPackOrder = finalFieldExecutionPackPackage?.executionOrder || [];
  const finalFieldExecutionPackLastPhase = finalFieldExecutionPackOrder[finalFieldExecutionPackOrder.length - 1];
  const finalFieldSignoffPackage = finalWorklist?.fieldPackages?.fieldRemediationSignoff || null;
  const finalFieldSignoffCleanPackage = finalWorklist?.fieldPackages?.fieldRemediationSignoffCleanInput || null;
  const finalFieldSignoffPromotePackage = finalWorklist?.fieldPackages?.fieldRemediationSignoffPromote || null;
  const finalFieldHandoffPackage = finalWorklist?.fieldPackages?.fieldHandoff || null;
  const finalFieldReturnTemplatePackage = finalWorklist?.fieldPackages?.fieldReturnTemplate || null;
  const finalCanaryReadinessPackage = finalWorklist?.fieldPackages?.canaryReadiness || null;
  const finalCanaryReadinessPlaybook = finalCanaryReadinessPackage?.readinessPlaybook || null;
  const finalCanaryReadinessPhasePlan = finalCanaryReadinessPlaybook?.phasePlan || [];
  const selectedFieldPlaybookDevice = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return finalFieldPlaybookDevices.find((item) =>
      [item.deviceCode, item.deviceName, item.workOrderId].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalFieldPlaybookDevices, selectedDeviceCode]);
  const selectedSignoffReleaseMatrix = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return (finalFieldSignoffPackage?.releaseMatrix || []).find((item) =>
      [item.deviceCode, item.deviceName, item.workOrderId].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalFieldSignoffPackage?.releaseMatrix, selectedDeviceCode]);
  const selectedSignoffOpenRecord = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return (finalFieldSignoffPackage?.openRecords || []).find((item) =>
      [item.deviceCode, item.deviceName, item.workOrderId].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalFieldSignoffPackage?.openRecords, selectedDeviceCode]);
  const selectedOnsiteReleasePrecheck = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return (finalFieldSignoffPackage?.onsiteReleasePrecheck?.devices || []).find((item) =>
      [item.deviceCode, item.deviceName, item.workOrderId].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalFieldSignoffPackage?.onsiteReleasePrecheck?.devices, selectedDeviceCode]);
  const selectedReturnTemplateDevice = useMemo(() => {
    if (!selectedDeviceCode) {
      return null;
    }
    return (finalFieldReturnTemplatePackage?.devices || []).find((item) =>
      [item.deviceCode, item.deviceName, item.workOrderId].map(normalizeDeviceKey).includes(selectedDeviceCode)
    ) || null;
  }, [finalFieldReturnTemplatePackage?.devices, selectedDeviceCode]);
  const selectedSignoffMissingChecklist = selectedSignoffOpenRecord?.missingChecklist || [];
  const selectedSignoffMissingFields =
    selectedSignoffReleaseMatrix?.missingFields ||
    selectedOnsiteReleasePrecheck?.nextBlockingFields ||
    selectedReturnTemplateDevice?.missingFields ||
    selectedFieldPlaybookDevice?.missingFields ||
    [];
  const selectedSignoffNextActions =
    selectedSignoffReleaseMatrix?.nextActions ||
    (selectedOnsiteReleasePrecheck?.nextAction ? [selectedOnsiteReleasePrecheck.nextAction] : []) ||
    selectedFieldPlaybookDevice?.fieldPriority ||
    [];
  const selectedSignoffReleaseCriteria =
    selectedSignoffReleaseMatrix?.releaseCriteria ||
    selectedReturnTemplateDevice?.releaseCriteria ||
    selectedFieldPlaybookDevice?.releaseCriteria ||
    [];
  const finalFieldCloseoutReady = finalFieldCloseoutPackage?.readyForCanary === true || finalWorklist?.summary?.fieldCloseoutReady === true;
  const finalFieldCloseoutRemaining = finalFieldCloseoutPackage?.remainingDeviceCount ?? finalWorklist?.summary?.qualityP0Devices ?? finalQualitySummary?.p0Count ?? null;
  const finalCanaryPackage = finalWorklist?.fieldPackages?.canaryExecution || finalControlStatus?.canaryExecutionPackage?.outputs
    ? {
        ...(finalControlStatus?.canaryExecutionPackage?.outputs || {}),
        ...(finalWorklist?.fieldPackages?.canaryExecution || {}),
        deviceCode:
          finalWorklist?.fieldPackages?.canaryExecution?.deviceCode ||
          finalControlStatus?.canaryExecutionPackage?.canary?.deviceCode,
        verdict:
          finalWorklist?.fieldPackages?.canaryExecution?.verdict ||
          finalControlStatus?.canaryExecutionPackage?.verdict ||
          null
      }
    : null;
  const finalCanaryPackageStatus = finalCanaryPackage?.verdict || "";
  const finalAdapterPackage = finalWorklist?.fieldPackages?.baWriteAdapterReadiness || finalControlStatus?.baWriteAdapterReadiness?.outputs
    ? {
        ...(finalControlStatus?.baWriteAdapterReadiness?.outputs || {}),
        ...(finalWorklist?.fieldPackages?.baWriteAdapterReadiness || {}),
        deviceCode:
          finalWorklist?.fieldPackages?.baWriteAdapterReadiness?.deviceCode ||
          finalControlStatus?.baWriteAdapterReadiness?.canary?.deviceCode,
        verdict:
          finalWorklist?.fieldPackages?.baWriteAdapterReadiness?.verdict ||
          finalControlStatus?.baWriteAdapterReadiness?.verdict ||
          null
      }
    : null;
  const finalCanaryFeedbackPackage = finalWorklist?.fieldPackages?.canaryFeedbackMonitor || finalControlStatus?.canaryFeedbackMonitor?.outputs
    ? {
        ...(finalControlStatus?.canaryFeedbackMonitor?.outputs || {}),
        ...(finalWorklist?.fieldPackages?.canaryFeedbackMonitor || {}),
        deviceCode:
          finalWorklist?.fieldPackages?.canaryFeedbackMonitor?.deviceCode ||
          finalControlStatus?.canaryFeedbackMonitor?.canary?.deviceCode,
        verdict:
          finalWorklist?.fieldPackages?.canaryFeedbackMonitor?.verdict ||
          finalControlStatus?.canaryFeedbackMonitor?.verdict ||
          null,
        feedbackStatus:
          finalWorklist?.fieldPackages?.canaryFeedbackMonitor?.feedbackStatus ||
          finalControlStatus?.canaryFeedbackMonitor?.canary?.feedbackStatus ||
          null
      }
    : null;
	  const finalCanaryWindowPackage = finalWorklist?.fieldPackages?.canaryWindow || finalControlStatus?.canaryWindow?.outputs
    ? {
        ...(finalControlStatus?.canaryWindow?.outputs || {}),
        ...(finalWorklist?.fieldPackages?.canaryWindow || {}),
        deviceCode:
          finalWorklist?.fieldPackages?.canaryWindow?.deviceCode ||
          finalControlStatus?.canaryWindow?.canary?.deviceCode,
        verdict:
          finalWorklist?.fieldPackages?.canaryWindow?.verdict ||
          finalControlStatus?.canaryWindow?.verdict ||
          null,
        mode:
          finalWorklist?.fieldPackages?.canaryWindow?.mode ||
          finalControlStatus?.canaryWindow?.mode ||
          null,
        controlMutation:
          finalWorklist?.fieldPackages?.canaryWindow?.controlMutation ||
          finalControlStatus?.canaryWindow?.controlMutation ||
          false
	      }
	    : null;
  const finalFieldArmPackage = finalControlStatus?.fieldArmPackage?.outputs
    ? {
        ...(finalControlStatus.fieldArmPackage.outputs || {}),
        deviceCode: finalControlStatus.fieldArmPackage.deviceCode,
        verdict: finalControlStatus.fieldArmPackage.verdict,
        blockers: finalControlStatus.fieldArmPackage.blockers || [],
        checklist: finalControlStatus.fieldArmPackage.checklist || [],
        controlMutation: finalControlStatus.fieldArmPackage.controlMutation === true
      }
    : null;
  const selectedGeneratedCanaryWindowMatches =
    Boolean(selectedDeviceCode && selectedCanaryWindow?.deviceCode) &&
    normalizeDeviceKey(selectedCanaryWindow?.deviceCode) === selectedDeviceCode;
  const selectedLatestCanaryWindowMatches =
    Boolean(selectedDeviceCode && finalCanaryWindowPackage?.deviceCode) &&
    normalizeDeviceKey(finalCanaryWindowPackage?.deviceCode) === selectedDeviceCode;
  const selectedCanaryWindowReport = selectedGeneratedCanaryWindowMatches
    ? selectedCanaryWindow
    : selectedLatestCanaryWindowMatches
      ? finalCanaryWindowPackage
      : null;
  const selectedCanaryWindowStatus = selectedCanaryWindowReport
    ? selectedCanaryWindowReport.verdict || "待投运"
    : "可生成";
  const selectedCanaryWindowOutputName =
    (selectedGeneratedCanaryWindowMatches
      ? selectedCanaryWindow?.outputs?.markdown
      : selectedLatestCanaryWindowMatches
        ? finalCanaryWindowPackage?.markdown
        : "")?.split("/").pop() ||
    "";
  const selectedCanaryWindowCommand = selectedDeviceCode
    ? `FCU_CANARY_DEVICE_CODE=${selectedDeviceCode} npm --prefix apps/chiller-bff run execute:fcu-canary-window`
    : "";
  const selectedGeneratedFieldArmPackageMatches =
    Boolean(selectedDeviceCode && selectedFieldArmPackage?.deviceCode) &&
    normalizeDeviceKey(selectedFieldArmPackage?.deviceCode) === selectedDeviceCode;
  const selectedGeneratedFieldArmPrecheckMatches =
    Boolean(selectedDeviceCode && selectedFieldArmPrecheckResult?.deviceCode) &&
    normalizeDeviceKey(selectedFieldArmPrecheckResult?.deviceCode) === selectedDeviceCode;
  const selectedLatestFieldArmPackageMatches =
    Boolean(selectedDeviceCode && finalControlStatus?.fieldArmPackage?.deviceCode) &&
    normalizeDeviceKey(finalControlStatus?.fieldArmPackage?.deviceCode) === selectedDeviceCode;
  const selectedFieldArmPrecheckReport = selectedGeneratedFieldArmPrecheckMatches
    ? selectedFieldArmPrecheckResult
    : selectedLatestFieldArmPackageMatches
      ? finalControlStatus
      : null;
  const selectedFieldArmPackageReport = selectedGeneratedFieldArmPackageMatches
    ? selectedFieldArmPackage
    : selectedLatestFieldArmPackageMatches
      ? finalControlStatus?.fieldArmPackage
      : null;
  const selectedFieldArmPackageStatus = selectedFieldArmPackageReport
    ? selectedFieldArmPackageReport.verdict || (selectedFieldArmPackageReport.ok ? "已生成" : "已阻断")
    : "可生成";
  const selectedFieldArmPackageOutputName =
    selectedFieldArmPackageReport?.outputs?.markdown?.split("/").pop() ||
    selectedFieldArmPackageReport?.outputs?.json?.split("/").pop() ||
    "";
  const selectedFieldArmPackageP0Count =
    selectedFieldArmPackageReport?.blockers?.filter((item) => item.severity === "P0").length || 0;
  const selectedCanaryExecutionPrecheck = selectedFieldArmPrecheckReport?.canaryExecutionPackage || null;
  const selectedBaAdapterPrecheck = selectedFieldArmPrecheckReport?.baWriteAdapterReadiness || null;
  const selectedCanaryFeedbackPrecheck = selectedFieldArmPrecheckReport?.canaryFeedbackMonitor || null;
  const selectedCanaryExecutionPrecheckBlockers = selectedCanaryExecutionPrecheck?.blockers?.length || 0;
  const selectedBaAdapterPrecheckBlockers = selectedBaAdapterPrecheck?.blockingItems?.length || 0;
  const selectedCanaryFeedbackPrecheckBlockers =
    selectedCanaryFeedbackPrecheck?.checks?.filter((item) => item.ok === false).length ||
    selectedCanaryFeedbackPrecheck?.nextActions?.length ||
    0;
  const selectedCanaryExecutionLockChain = [
    {
      key: "field-arm",
      label: "Field Arm",
      ok: selectedFieldArmPackageReport?.ok === true,
      verdict: selectedFieldArmPackageReport?.verdict || "未生成",
      blockers: selectedFieldArmPackageP0Count
    },
    {
      key: "ba-adapter",
      label: "BA 写适配器",
      ok: selectedBaAdapterPrecheck?.ok === true,
      verdict: selectedBaAdapterPrecheck?.verdict || "未生成",
      blockers: selectedBaAdapterPrecheckBlockers
    },
    {
      key: "canary-package",
      label: "Canary执行包",
      ok: selectedCanaryExecutionPrecheck?.ok === true,
      verdict: selectedCanaryExecutionPrecheck?.verdict || "未生成",
      blockers: selectedCanaryExecutionPrecheckBlockers
    },
    {
      key: "feedback-monitor",
      label: "反馈监视",
      ok: selectedCanaryFeedbackPrecheck?.ok === true,
      verdict: selectedCanaryFeedbackPrecheck?.verdict || "未生成",
      blockers: selectedCanaryFeedbackPrecheckBlockers
    }
  ];
  const selectedCanaryExecutionPrecheckReady = selectedCanaryExecutionLockChain.every((item) => item.ok);
  const selectedCanaryExecutionFirstBlocker = selectedCanaryExecutionLockChain.find((item) => !item.ok) || null;
  const selectedCanaryDispatchLocked = !selectedCanaryExecutionPrecheckReady;
  const selectedCanaryDispatchLockReason = selectedCanaryDispatchLocked
    ? `${selectedCanaryExecutionFirstBlocker?.label || "前置链"}：${selectedCanaryExecutionFirstBlocker?.verdict || "未通过"}`
    : "前置链已通过，仍需确认短语和后端总闸。";
  const fcuAuthorizationGateItems = [
    {
      key: "site_authorization",
      label: "现场授权",
      ok: fcuFieldAuthorization?.siteAuthorizationStatus === "approved",
      value: formatFcuFieldAuthorizationStatus(fcuFieldAuthorization?.siteAuthorizationStatus),
      note: fcuFieldAuthorization?.siteAuthorizationBy || "3002 未记录授权确认人"
    },
    {
      key: "ba_write_confirm",
      label: "BA写入确认",
      ok: fcuFieldAuthorization?.baWriteConfirmArmed === true,
      value: fcuFieldAuthorization?.baWriteConfirmArmed ? "已装载" : "未装载",
      note: "只记录状态，不保存真实确认短语明文"
    },
    {
      key: "final_rollout_confirm",
      label: "总确认短语",
      ok: fcuFieldAuthorization?.finalRolloutConfirmArmed === true,
      value: fcuFieldAuthorization?.finalRolloutConfirmArmed ? "已装载" : "未装载",
      note: "最终控制编排必须二次确认"
    },
    {
      key: "commissioning_window",
      label: "投运窗口",
      ok: Boolean(fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd),
      value:
        fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd
          ? "已设定"
          : "未设定",
      note:
        fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd
          ? `${fcuFieldAuthorization.siteAuthorizationWindowStart} 至 ${fcuFieldAuthorization.siteAuthorizationWindowEnd}`
          : "3002 未记录授权时间窗"
    }
  ];
  const fcuAuthorizationReady = fcuAuthorizationGateItems.every((item) => item.ok);
  const selectedAllP0FieldArmBlockerActions = (selectedFieldArmPackageReport?.blockers || [])
    .filter((item) => item.severity === "P0")
    .map((item) => {
      const category = classifyFcuFieldArmAction(item.key, "");
      return {
        key: item.key || item.label || item.action || "field-arm-blocker",
        label: item.label || formatFcuBlockReason(item.key) || "P0 阻断项",
        evidence: item.evidence || "缺少证据",
        action: item.action || "补齐现场证据后重跑开闸包",
        category: category.label,
        tone: category.tone,
        rank: rankFcuFieldArmAction(item.key, category.label)
      };
    })
    .sort((left, right) => left.rank - right.rank || left.label.localeCompare(right.label, "zh-Hans-CN"));
  const selectedFieldArmBlockerActions = pickVisibleFcuFieldArmActions(selectedAllP0FieldArmBlockerActions, 8);
  const selectedFieldArmChecklistActions = (selectedFieldArmPackageReport?.checklist || [])
    .filter((item) => item.status !== "ready")
    .slice(0, 6)
    .map((item) => {
      const category = classifyFcuFieldArmAction(item.key, item.phase);
      return {
        key: item.key || item.label || item.action || "field-arm-checklist",
        label: item.label || item.key || "开闸检查项",
        evidence: item.evidence || item.status || "待补齐",
        action: item.action || "补齐后重跑开闸包",
        owner: item.owner || "待分配",
        writesControl: item.writesControl === true,
        category: category.label,
        tone: category.tone
      };
    });
  const selectedLiveGateActions =
    terminalView === "device" &&
    deviceCommissioningStatus?.targetDeviceCode === selectedDeviceCode &&
    Array.isArray(deviceCommissioningStatus.actionPlan)
      ? deviceCommissioningStatus.actionPlan.slice(0, 8).map((item) => {
          const category = classifyFcuFieldArmAction(item.key, item.phase);
          return {
            key: item.key || item.action || "fcu-live-gate-action",
            label: item.action || item.key || "下一步",
            evidence: item.acceptance || item.reason || "待现场确认",
            action: item.reason || item.target || "按责任人处理后刷新开闸预检",
            owner: item.owner || "待分配",
            writesControl: item.writesControl === true,
            category: category.label,
            tone: category.tone
          };
        })
      : [];
  const selectedFieldArmActionSummary = selectedAllP0FieldArmBlockerActions.reduce<Record<string, number>>((summary, item) => {
    summary[item.category] = (summary[item.category] || 0) + 1;
    return summary;
  }, {});
  const selectedLiveGateActionSummary = selectedLiveGateActions.reduce<Record<string, number>>((summary, item) => {
    summary[item.category] = (summary[item.category] || 0) + 1;
    return summary;
  }, {});
  const finalVerdictTone: Tone = finalCompletion?.ok ? "good" : finalControlStatus ? "warn" : "neutral";
  const finalControlGateTone: Tone = finalControlGates?.ok ? "good" : finalControlGates ? "warn" : "neutral";
  const finalEvidenceTone: Tone = finalEvidenceConsistency?.ok ? "good" : finalEvidenceConsistency ? "warn" : "neutral";
  const selectedIsFinalCanary =
    Boolean(selectedDeviceCode && (finalMilestones.canary?.deviceCode || finalCompletion?.firstCanary || canaryDeviceCode)) &&
    normalizeDeviceKey(finalMilestones.canary?.deviceCode || finalCompletion?.firstCanary || canaryDeviceCode) === selectedDeviceCode;
  const selectedHasFeedbackConfirmed = selectedDeviceRecords.some((record) => record.status === "feedback_confirmed");
  const selectedBackendFinalGate = selectedCommissioning?.finalGate || null;
  const fallbackSelectedFinalGateItems = [
    {
      key: "device_readiness",
      label: "本机点位质量",
      ok: selectedCommissioning?.deviceReady === true,
      value: selectedCommissioning?.deviceReady ? "通过" : "阻断",
      note: selectedCommissioning?.deviceReady ? "白名单/通讯/温度/写点已通过" : selectedCommissioningBlockedText
    },
    {
      key: "backend_write_gate",
      label: "后端写总闸",
      ok: fcuExecutionGate?.dispatchAllowed === true,
      value: fcuExecutionGate?.dispatchAllowed ? "允许" : formatFcuExecutionGateSummary(fcuExecutionGate),
      note: fcuExecutionGate?.blockedReasons?.map(formatFcuBlockReason).join(" / ") || "等待环境门禁"
    },
    {
      key: "final_dispatch_gate",
      label: "最终总门禁",
      ok: fcuFinalDispatchGate?.dispatchAllowed === true,
      value: formatFcuFinalDispatchGateSummary(fcuFinalDispatchGate),
      note: fcuFinalDispatchGate?.blockedReasons?.map(formatFcuBlockReason).join(" / ") || "现场签核、Canary 与最终验收全部通过后才允许普通闭环写入"
    },
    {
      key: "field_arm",
      label: "现场 Arm-Check",
      ok: fieldArmReady,
      value: fieldArmReady ? "通过" : "禁止",
      note: fieldArmReady ? "允许进入 Canary" : fieldArmBlockedText
    },
    {
      key: "canary_sequence",
      label: "Canary顺序",
      ok: selectedIsFinalCanary && finalMilestones.canary?.ok === true,
      value: selectedIsFinalCanary ? (finalMilestones.canary?.ok ? "完成" : "首台待执行") : "非首台",
      note: selectedIsFinalCanary ? "该 FCU 是当前首台候选" : `首台候选 ${canaryDeviceLabel}`
    },
    {
      key: "feedback",
      label: "反馈确认",
      ok: selectedHasFeedbackConfirmed,
      value: selectedHasFeedbackConfirmed ? "已确认" : "未确认",
      note: selectedDeviceLastRecord
        ? `${formatSampleTime(selectedDeviceLastRecord.createdAt)} · ${formatFcuControlStatus(selectedDeviceLastRecord.status)}`
        : "暂无单台反馈记录"
    },
    {
      key: "final_acceptance",
      label: "最终验收",
      ok: finalCompletion?.ok === true,
      value: finalCompletion?.ok ? "完成" : "未完成",
      note: finalBlockingItems.length
        ? finalBlockingItems.slice(0, 2).map((item) => formatFcuBlockReason(item.key || item.label)).join(" / ")
        : "等待验收证据"
    }
  ];
  const selectedFinalGateItems = selectedBackendFinalGate?.items?.length
    ? selectedBackendFinalGate.items.map((item) => ({
        key: item.key || item.label || "unknown",
        label: item.label || item.key || "门禁",
        ok: item.ok === true,
        value: item.value || (item.ok ? "通过" : "未通过"),
        note: item.note || "--"
      }))
    : fallbackSelectedFinalGateItems;
  const selectedFinalGateOk = selectedBackendFinalGate
    ? selectedBackendFinalGate.ok === true
    : finalCompletion?.ok === true && selectedHasFeedbackConfirmed;
  const selectedFinalGateMutation = selectedBackendFinalGate
    ? selectedBackendFinalGate.controlMutation === true
    : finalControlStatus?.controlMutation === true;
  const finalRolloutPhases = finalRollout?.phases || [];
  const finalRolloutSkipped = finalRollout?.skipped || [];
  const finalRolloutBlockers = finalRollout?.blockers || [];
  const finalRolloutExecutionBlockers = selectedFinalRolloutExecution?.blockers || [];
  const previewReadyCount = previewMatchesCurrentTarget ? lastControlPreview?.summary?.readyCount || 0 : 0;
  const canConfirmDispatch = selectedFcuWriteEnabled && selectedFieldPreflightReady && previewReadyCount > 0;
  const executableCount = fanCoilReady
    ? Math.max(0, (fanCoilSummary.comfortEligibleCount || fanCoilSummary.validTemperatureCount || 0))
    : 0;
  const qualityIssueCount =
    (fanCoilSummary.qualityIssues?.communicationAlarm || 0) +
    (fanCoilSummary.qualityIssues?.zeroTemperature || 0) +
    (fanCoilSummary.qualityIssues?.outOfRangeTemperature || 0) +
    (fanCoilSummary.qualityIssues?.missingTemperature || 0);
  const terminalViewItems: Array<{ key: TerminalView; label: string; note: string }> = [
    { key: "overview", label: "总览", note: "值班首屏" },
    { key: "control", label: "控制", note: `${readyControlCount} ready` },
    { key: "quality", label: "数据质量", note: `${qualityIssueCount} 异常` },
    { key: "devices", label: "逐台控制", note: fanCoilReady ? `${fanCoilSummary.total || 0} 台` : "待接入" },
    ...(selectedDeviceCode ? [{ key: "device" as TerminalView, label: "当前 FCU", note: selectedDeviceCode }] : [])
  ];
  function buildTerminalViewHref(view: TerminalView): string {
    const next = new URLSearchParams(searchParams);
    next.set("siteId", siteId);
    if (view !== "device") {
      next.delete("deviceCode");
      next.delete("device");
    }
    if (view === "overview") {
      next.delete("view");
    } else {
      next.set("view", view);
    }
    return `/hvac-terminal?${next.toString()}`;
  }

  function buildFanCoilDeviceHref(item: FanCoilTerminalItemDto): string {
    const next = new URLSearchParams(searchParams);
    next.set("siteId", siteId);
    next.set("view", "device");
    next.set("deviceCode", resolveFanCoilDeviceKey(item));
    next.delete("device");
    return `/hvac-terminal?${next.toString()}`;
  }

  const selectedFanCoilIndex = selectedDeviceCode
    ? fanCoilItems.findIndex((item) =>
        [item.deviceCode, item.deviceId, item.deviceName].map(normalizeDeviceKey).includes(selectedDeviceCode)
      )
    : -1;
  const previousFanCoil = selectedFanCoilIndex > 0 ? fanCoilItems[selectedFanCoilIndex - 1] : null;
  const nextFanCoil =
    selectedFanCoilIndex >= 0 && selectedFanCoilIndex < fanCoilItems.length - 1
      ? fanCoilItems[selectedFanCoilIndex + 1]
      : null;

  return (
    <div className={`power-monitor-page hvac-terminal-page hvac-terminal-page--${terminalView}`}>
      <section className="section-card power-monitor-hero">
        <header className="section-card-header">
          <div>
            <h3>空调末端监控</h3>
            <p className="power-monitor-subtitle">
              {terminalSubtitle}
            </p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${statusLabelTone}`}>{statusLabel}</span>
            <span className="status-pill neutral">{formatBoundaryMode(boundaryMode)}</span>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {errorText ? <div className="source-banner warn">{errorText}</div> : null}
          {fanCoilReady ? (
            <div className="source-banner">
              已读取另一个 BA 末端系统的 {floorName} 风机盘管快照；采样时间采用系统抓取时间
              {fanCoils?.sampledAt ? ` ${formatSampleTime(fanCoils.sampledAt)}` : ""}，上游 rawTagTime 不作为历史时间戳。
            </div>
          ) : null}
          {configDemoData && fanCoilReady ? (
            <div className="source-banner warn">
              配置中心仍按盛世绿能办公楼全系统演示口径标记；本页末端数值来自 BA 接口。通用子系统写点保持禁用，
              FCU 单台控制另受白名单、适配器、后端只读总闸和审计回退保护。
            </div>
          ) : null}
          {waitingForRealData(terminalSubsystem) ? (
            <div className="source-banner warn">
              当前未接入真实空调末端实时数据；已发布的是只读点位角色模板，等待现场 BA / PLC / 网关点位绑定。
            </div>
          ) : null}
          {configDemoData && !fanCoilReady ? (
            <div className="source-banner">
              盛世绿能办公楼为空调末端演示配置；未读取到风机盘管快照时不显示假 KPI。
            </div>
          ) : null}
          <div className="power-monitor-summary">
            <div>
              <span>数据来源</span>
              <strong>{sourceOverall}</strong>
            </div>
            <div>
              <span>点位角色模板</span>
              <strong>{roleSummary}</strong>
            </div>
            <div>
              <span>实时数据</span>
              <strong>{formatDataStatus(terminalSubsystem, fanCoilReady)}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title="风机盘管" value={formatMetricValue(configEnabled, fanCoilReady, String(fanCoilSummary.total || 0))} unit={fanCoilReady ? "台" : undefined} note={fanCoilReady ? floorName : configEnabled ? "等待 BA 快照" : "未接入"} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="10楼均温" value={formatMetricValue(configEnabled, fanCoilReady, averageTempValue)} unit={fanCoilReady ? "°C" : undefined} note={fanCoilReady ? `${fanCoilSummary.comfortEligibleCount || fanCoilSummary.validTemperatureCount || 0}个舒适样本` : configEnabled ? "等待温度点" : "未接入"} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="运行盘管" value={formatMetricValue(configEnabled, fanCoilReady, runningValue)} note={fanCoilReady ? "运行/总数" : configEnabled ? "等待运行点" : "未接入"} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title="通讯报警" value={formatMetricValue(configEnabled, fanCoilReady, alarmValue)} note={fanCoilReady ? `${onlineValue} 无通讯报警` : configEnabled ? "等待报警点" : "未接入"} tone={fanCoilReady && (fanCoilSummary.communicationAlarmCount || 0) > 0 ? "warn" : fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
      </div>

      <nav className="hvac-terminal-view-tabs" aria-label="空调末端二级视图">
        {terminalViewItems.map((item) => (
          <Link key={item.key} to={buildTerminalViewHref(item.key)} className={terminalView === item.key ? "is-active" : ""}>
            <strong>{item.label}</strong>
            <span>{item.note}</span>
          </Link>
        ))}
      </nav>

      {(terminalView === "overview" || terminalView === "control") ? (
      <section className="section-card hvac-terminal-quality-card fcu-control-card">
        <header className="section-card-header">
          <div>
            <h3>FCU 值班控制台</h3>
            <p className="power-monitor-subtitle">
              可控数量、Ready、保护阻断和真实下发集中显示；前端不直接写 BA/PLC，真实写入由后端适配器和总闸判定。
            </p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${fcuPolicy?.defaultMode === "enforced" ? "warn" : "neutral"}`}>
              {controlModeLabel}
            </span>
            <button type="button" onClick={() => void handleRunControlCycle(false)} disabled={!fanCoilReady || controlRunning || controlDispatching}>
              <ShieldCheck size={14} />
              {controlRunning ? "预演中" : "预演控制周期"}
            </button>
            {terminalView === "control" ? (
              <button
                type="button"
                className="is-danger"
                onClick={() => void handleRunControlCycle(true)}
                disabled={!fanCoilReady || !canConfirmDispatch || controlRunning || controlDispatching}
                title={canConfirmDispatch ? "确认后将通过 BA 写适配器下发 ready 命令" : "需先完成预演并生成 ready 命令"}
              >
                <ShieldCheck size={14} />
                {controlDispatching ? "下发中" : "确认下发"}
              </button>
            ) : null}
          </div>
        </header>
        <div className="section-card-body">
          {controlNotice ? <div className="source-banner">{controlNotice}</div> : null}
          <div className="fcu-control-compact-grid">
            <article className="tone-good">
              <span>设备侧就绪</span>
              <strong>{fanCoilReady ? `${commissioningSummary.deviceReady ?? executableCount}/${commissioningSummary.total ?? fanCoilSummary.total ?? 0}` : "--"}</strong>
              <small>白名单/点位/质量通过</small>
            </article>
            <article className={(commissioningSummary.deviceBlocked || 0) > 0 ? "tone-warn" : "tone-good"}>
              <span>单台阻断</span>
              <strong>{fanCoilReady ? commissioningSummary.deviceBlocked ?? blockedControlCount : "--"}</strong>
              <small>通讯/温度/写点保护</small>
            </article>
            <article className={(commissioningSummary.canDispatch || 0) > 0 ? "tone-good" : "tone-neutral"}>
              <span>可真实下发</span>
              <strong>{fanCoilReady ? commissioningSummary.canDispatch ?? readyControlCount : "--"}</strong>
              <small>{whitelistCount} 台白名单</small>
            </article>
            <article className={dispatchedControlCount > 0 ? "tone-good" : "tone-neutral"}>
              <span>最近真实下发</span>
              <strong>{dispatchedControlCount}</strong>
              <small>{executionBoundaryLabel}</small>
            </article>
          </div>
          <div className="fcu-final-status-panel">
            <div className="fcu-final-status-head">
              <div>
                <strong>最终控制完成度</strong>
                <span>以验收报告为准：真实下发、反馈确认、回退保护和全量设备闭环必须全部满足。</span>
              </div>
              <div className="section-action">
                <span className={`status-pill ${finalVerdictTone}`}>
                  {formatFcuFinalVerdict(finalControlStatus?.verdict)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRefreshFinalControlStatus()}
                  disabled={finalStatusRefreshing}
                  title="重新生成最终控制完成度和投运清单；该动作不下发 BA/PLC"
                >
                  <RefreshCw size={14} />
                  {finalStatusRefreshing ? "刷新中" : "刷新验收"}
                </button>
              </div>
            </div>
            <div className="fcu-final-gate-strip">
              <div>
                <strong>最终控制总门禁</strong>
                <span>
                  {finalControlGates
                    ? `通过 ${finalControlGateSummary?.passed ?? 0}/${finalControlGateSummary?.gateCount ?? 0}，阻断 ${finalControlGateSummary?.blocked ?? 0} 项；P0 ${finalControlGateSummary?.qualityP0Devices ?? "--"} 台，签字 ${finalControlGateSummary?.signoffCompleteRows ?? "--"}/${finalControlGateSummary?.signoffExpectedRows ?? "--"}，Canary ${finalControlGateSummary?.canaryReady ? "就绪" : "阻断"}，下一步 ${finalControlGateNextActions.length} 项`
                    : "总门禁证据待读取"}
                  {finalControlGateMarkdown ? ` · ${finalControlGateMarkdown}` : ""}
                </span>
              </div>
              <span className={`status-pill ${finalControlGateTone}`}>
                {finalControlGates?.ok ? "允许归档" : finalControlGates ? "禁止下发" : "待读取"}
              </span>
            </div>
            {finalControlGateBlockers.length > 0 ? (
              <div className="fcu-final-gate-blockers">
                {finalControlGateBlockers.slice(0, 4).map((item) => (
                  <span key={item.label || item.blocker || item.evidence || "gate-blocker"}>
                    {item.label || "门禁"}：{item.value || item.blocker || "阻断"}
                  </span>
                ))}
              </div>
            ) : null}
            {finalEvidenceConsistency ? (
              <div className="fcu-worklist-package-strip">
                <strong>证据一致性</strong>
                <span>
                  {finalEvidenceConsistency.ok ? "一致" : "不一致"} ·{" "}
                  问题 {finalEvidenceConsistencySummary?.issueCount ?? finalEvidenceConsistencyIssues.length ?? "--"} 项 ·{" "}
                  P0 {finalEvidenceConsistencySummary?.openP0Devices ?? "--"} 台 ·{" "}
                  过期签核 {finalEvidenceConsistencySummary?.staleSignoffRows ?? "--"} 行 ·{" "}
                  签核 {finalEvidenceConsistencySummary?.signoffCompleteRows ?? "--"}/{finalEvidenceConsistencySummary?.signoffExpectedRows ?? "--"} ·{" "}
                  Runbook {finalRunbook?.verdict || "待读取"}
                </span>
                <span className={`status-pill ${finalEvidenceTone}`}>
                  {finalEvidenceConsistency.ok ? "证据可信" : "禁止推进"}
                </span>
              </div>
            ) : null}
            {finalEvidenceConsistencyIssues.length > 0 ? (
              <div className="fcu-final-gate-blockers">
                {finalEvidenceConsistencyIssues.slice(0, 4).map((item) => (
                  <span key={`${item.key || "evidence"}-${item.field || item.message || item.source || "issue"}`}>
                    {item.key || "evidence"}：{item.message || item.field || item.source || "证据不一致"}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="fcu-final-status-grid">
              <article className={finalMilestones.canary?.ok ? "tone-good" : "tone-warn"}>
                <span>首台 Canary</span>
                <strong>{finalMilestones.canary?.ok ? "完成" : "未完成"}</strong>
                <small>{finalMilestones.canary?.deviceCode || finalCompletion?.firstCanary || canaryDeviceLabel} · {finalMilestones.canary?.feedbackStatus || "反馈未确认"}</small>
              </article>
              <article className={finalMilestones.smallBatch?.ok ? "tone-good" : "tone-warn"}>
                <span>小批量</span>
                <strong>{finalMilestones.smallBatch?.ok ? "完成" : "未完成"}</strong>
                <small>{finalMilestones.smallBatch?.devices || 0} 台 · 反馈{finalMilestones.smallBatch?.feedbackConfirmed ? "已确认" : "未确认"}</small>
              </article>
              <article className={finalMilestones.allDevice?.ok ? "tone-good" : "tone-warn"}>
                <span>全量反馈</span>
                <strong>{finalMilestones.allDevice?.confirmedDevices || 0}/{finalMilestones.allDevice?.targetDevices || finalRolloutSummary?.total || 0}</strong>
                <small>最终验收设备数</small>
              </article>
              <article className={(finalQualitySummary?.remediationCount || 0) > 0 ? "tone-warn" : finalQualitySummary ? "tone-good" : "tone-neutral"}>
                <span>质量整改</span>
                <strong>{finalQualitySummary?.remediationCount ?? "--"}</strong>
                <small>P0 {finalQualitySummary?.p0Count ?? "--"} · 通讯 {finalQualitySummary?.communicationAlarmCount ?? 0} · 0°C {finalQualitySummary?.zeroTemperatureCount ?? 0}</small>
              </article>
              <article className={finalFieldCloseoutReady ? "tone-good" : finalFieldCloseoutPackage ? "tone-warn" : "tone-neutral"}>
                <span>现场消缺</span>
                <strong>{finalFieldCloseoutReady ? "已关闭" : finalFieldCloseoutRemaining ?? "--"}</strong>
                <small>{finalFieldCloseoutPackage?.verdict || "closeout 待读取"} · Canary 前置</small>
              </article>
            </div>
            <div className="fcu-final-status-detail">
              <div>
                <strong>全量批次</strong>
                <span>
                  可规划 {finalRolloutSummary?.plannedDeviceCount ?? finalRolloutSummary?.deviceReady ?? 0}/{finalRolloutSummary?.total ?? fanCoilSummary.total ?? 0} 台；
                  立即批次 {finalRolloutSummary?.immediateReady ?? 0} 台，分步设定 {finalRolloutSummary?.stagedSetpoint ?? 0} 台，阻断 {finalRolloutSummary?.blocked ?? 0} 台。
                </span>
              </div>
              <div>
                <strong>当前 P0 阻断</strong>
                <span>
                  {finalBlockingItems.length
                    ? finalBlockingItems.slice(0, 4).map((item) => formatFcuBlockReason(item.key || item.label)).join(" / ")
                    : finalControlStatus ? "无 P0 阻断" : "验收证据待读取"}
                </span>
              </div>
              <div>
                <strong>Canary 前置</strong>
                <span>
                  {finalFieldCloseoutReady
                    ? "现场消缺已关闭，可进入首台 Canary 的下一道门禁"
                    : finalFieldCloseoutPackage
                      ? `现场消缺未关闭：剩余 ${finalFieldCloseoutRemaining ?? "--"} 台，先完成 P0 复检`
                      : "现场消缺 closeout 证据待读取"}
                </span>
              </div>
            </div>
            {finalQualityDevices.length > 0 ? (
              <div className="fcu-final-remediation-panel">
                <div className="fcu-final-remediation-head">
                  <div>
                    <strong>现场 P0 消缺清单</strong>
                    <span>逐台处理后刷新验收；未满足放行标准前不进入全量闭环。</span>
                  </div>
                  <span className="status-pill warn">{finalQualitySummary?.p0Count ?? finalQualityDevices.length} 台 P0</span>
                </div>
                <div className="fcu-final-remediation-grid">
                  {finalQualityDevices.slice(0, 8).map((item) => {
                    const deviceCode = resolveFanCoilDeviceKey(item);
                    return (
                      <Link
                        key={deviceCode || item.deviceName}
                        to={deviceCode ? buildFanCoilDeviceHref({ ...item, deviceCode } as FanCoilTerminalItemDto) : buildTerminalViewHref("devices")}
                        className="fcu-final-remediation-card"
                      >
                        <div className="fcu-final-remediation-card-head">
                          <strong>{item.deviceName || deviceCode || "FCU"}</strong>
                          <span>{deviceCode || "未编码"} · {item.severity || "P0"}</span>
                        </div>
                        <div className="fcu-final-remediation-reasons">
                          {(item.reasons || []).slice(0, 4).map((reason) => (
                            <span key={`${deviceCode}-${reason}`}>{formatFcuBlockReason(reason)}</span>
                          ))}
                        </div>
                        <ul>
                          {(item.fieldActions || []).slice(0, 2).map((action) => (
                            <li key={`${deviceCode}-${action}`}>{action}</li>
                          ))}
                        </ul>
                        <em>{(item.releaseCriteria || [])[0] || "处理后重跑质量整改检查"}</em>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {finalQualityReasons.length > 0 ? (
              <div className="fcu-final-reason-row">
                {finalQualityReasons.map((item) => (
                  <span key={item.reason}>
                    {formatFcuBlockReason(item.reason)} {item.count || 0}
                  </span>
                ))}
              </div>
            ) : null}
            {finalRollout ? (
              <div className="fcu-rollout-status-panel">
                <div className="fcu-rollout-status-head">
                  <div>
                    <strong>最终控制编排</strong>
                    <span>
                      {finalRollout.mode || "状态待读取"} · 写入副作用 {finalRollout.controlMutation ? "存在" : "无"}
                    </span>
                  </div>
                  <div className="fcu-rollout-confirm-row">
                    <span className={`status-pill ${finalRollout.confirm?.finalRolloutConfirmPresent ? "good" : "warn"}`}>
                      总确认{finalRollout.confirm?.finalRolloutConfirmPresent ? "已设置" : "缺失"}
                    </span>
                    <span className={`status-pill ${finalRollout.confirm?.smallBatchConfirmPresent ? "good" : "warn"}`}>
                      BA确认{finalRollout.confirm?.smallBatchConfirmPresent ? "已设置" : "缺失"}
                    </span>
                  </div>
                </div>
                {finalRolloutPhases.length > 0 ? (
                  <div className="fcu-rollout-phase-row">
                    {finalRolloutPhases.map((phase) => (
                      <span key={phase.key || phase.label} className={phase.ok ? "is-ok" : "is-blocked"}>
                        {phase.label || phase.key} · {phase.ok ? "通过" : `exit ${phase.status ?? "--"}`}
                      </span>
                    ))}
                    {finalRolloutSkipped.map((phase) => (
                      <span key={phase.key || phase.label} className="is-skipped">
                        {phase.label || phase.key} · 跳过
                      </span>
                    ))}
                  </div>
                ) : null}
                {finalRolloutBlockers.length > 0 ? (
                  <div className="fcu-final-remediation-strip">
                    <strong>编排阻断</strong>
                    <span>{finalRolloutBlockers.slice(0, 5).map((item) => item.label || formatFcuBlockReason(item.key)).join(" / ")}</span>
                  </div>
                ) : null}
                <div className="fcu-rollout-execute-panel">
                  <div>
                    <strong>执行最终编排</strong>
                    <span>必须同时输入 BA 写入确认和最终总确认；后端会再次检查只读总闸、3002 授权和现场 Arm-Check。</span>
                    {selectedFinalRolloutExecution ? (
                      <small>
                        最近返回：{selectedFinalRolloutExecution.code || selectedFinalRolloutExecution.verdict || (selectedFinalRolloutExecution.ok ? "已执行" : "已阻断")}
                        {finalRolloutExecutionBlockers.length ? ` · 阻断 ${finalRolloutExecutionBlockers.slice(0, 4).map((item) => item.label || item.key).join(" / ")}` : ""}
                      </small>
                    ) : null}
                  </div>
                  <div className="fcu-rollout-execute-controls">
                    <input
                      type="password"
                      value={finalRolloutBaConfirmText}
                      onChange={(event) => setFinalRolloutBaConfirmText(event.target.value)}
                      placeholder="BA 写入确认短语"
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      value={finalRolloutConfirmText}
                      onChange={(event) => setFinalRolloutConfirmText(event.target.value)}
                      placeholder="最终总确认短语"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => void handleExecuteFinalControlRollout()}
                      disabled={finalRolloutRunning || !finalRolloutBaConfirmText || !finalRolloutConfirmText}
                      title="请求后端最终控制编排；后端仍会检查 read-only、授权门禁、Arm-Check、Canary 和反馈顺序"
                    >
                      <ShieldCheck size={14} />
                      {finalRolloutRunning ? "执行中" : "执行最终编排"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {finalWorklist ? (
              <div className="fcu-worklist-panel">
                <div className="fcu-worklist-head">
                  <div>
                    <strong>最终控制投运清单</strong>
                    <span>
                      {finalWorklist.verdict || "状态待读取"} · P0 {finalWorklist.summary?.p0OpenActions ?? 0} 项 · 全量反馈 {finalWorklist.confirmedDevices ?? 0}/{finalWorklist.targetDevices ?? 0}
                    </span>
                  </div>
                  <span className={`status-pill ${finalWorklist.ok ? "good" : "warn"}`}>
                    {finalWorklist.ok ? "可归档" : "待处理"}
                  </span>
                </div>
                {finalWorklistPhases.length > 0 ? (
                  <div className="fcu-worklist-phase-grid">
                    {finalWorklistPhases.map((phase) => (
                      <span key={phase.key || phase.label} className={`tone-${fcuWorklistTone(phase.status)}`}>
                        <strong>{phase.label || phase.key}</strong>
                        <small>{formatFcuWorklistStatus(phase.status)} · {phase.evidence || "--"}</small>
                      </span>
                    ))}
                  </div>
                ) : null}
                {finalWorklistActions.length > 0 ? (
                  <div className="fcu-worklist-actions">
                    {finalWorklistActions.slice(0, 5).map((action) => (
                      <article key={action.key || `${action.priority}-${action.phase}-${action.action}`}>
                        <span className={`status-pill ${action.priority === "P0" ? "warn" : "neutral"}`}>
                          {action.priority || "P1"} · {action.phase || "投运"}
                        </span>
                        <strong>{action.action || "待处理"}</strong>
                        <small>{action.target || "--"} · {action.reason || action.acceptance || "--"}</small>
                      </article>
                    ))}
                  </div>
                ) : null}
                {finalFieldPlaybook?.deviceCount ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>现场消缺作战表</strong>
                      <span>
                        待处理 {finalFieldPlaybook.deviceCount ?? "--"} 台 ·{" "}
                        首台 {finalFieldPlaybook.firstCanary || canaryDeviceLabel} ·{" "}
                        Canary {finalFieldPlaybook.canaryBlockedByField ? "现场阻断" : "现场已放行"} ·{" "}
                        {finalFieldPlaybook.fieldReady ? "现场 ready" : "先消缺再签核"}
                      </span>
                    </div>
                    {finalFieldPlaybook.recommendedOrder?.length ? (
                      <div className="fcu-worklist-actions">
                        <article>
                          <span className="status-pill warn">处理顺序 · 不写 BA</span>
                          <strong>先消除硬阻断，再进入 Canary</strong>
                          <small>{finalFieldPlaybook.recommendedOrder.slice(0, 4).join(" / ")}</small>
                          <em>{(finalFieldPlaybook.acceptance || []).slice(0, 4).join("；") || "全部回填 release 后仍需重跑最终门禁。"}</em>
                        </article>
                        {finalFieldPlaybookReasonGroups.slice(0, 3).map((group) => (
                          <article key={group.reason || "reason"}>
                            <span className="status-pill warn">{group.reason || "现场阻断"}</span>
                            <strong>{(group.devices || []).length} 台设备</strong>
                            <small>{(group.devices || []).slice(0, 8).join(" / ") || "--"}</small>
                            <em>该分类清零前，不允许进入真实闭环投运。</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldPlaybookDevices.length ? (
                      <div className="fcu-worklist-actions fcu-plan-device-grid">
                        {finalFieldPlaybookDevices.slice(0, 4).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className="status-pill warn">现场P0 · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || "未命名 FCU"}</strong>
                            <small>{(item.reasonLabels || item.reasons || []).slice(0, 4).join(" / ") || "待现场复核"}</small>
                            <em>{(item.fieldPriority || []).join(" -> ") || "按现场消缺作战表处理并回填签核。"}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalQualityPackage?.csv || finalQualityPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>现场整改包</strong>
                    <span>
                      {finalQualityPackage.csv ? `CSV ${finalQualityPackage.csv.split("/").pop()}` : ""}
                      {finalQualityPackage.csv && finalQualityPackage.markdown ? " · " : ""}
                      {finalQualityPackage.markdown ? `Markdown ${finalQualityPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalAllDevicePlanPackage?.json || finalAllDevicePlanPackage?.markdown ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>全量分批计划</strong>
                      <span>
                        立即 {finalAllDevicePlanPackage.immediateReady ?? "--"} 台 ·{" "}
                        分步设定 {finalAllDevicePlanPackage.stagedSetpoint ?? "--"} 台 ·{" "}
                        硬阻断 {finalAllDevicePlanPackage.blocked ?? "--"} 台 ·{" "}
                        首台 {finalAllDevicePlanPackage.firstCanary || canaryDeviceLabel} ·{" "}
                        {finalAllDevicePlanPackage.markdown ? `Markdown ${finalAllDevicePlanPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    {(finalAllDevicePlanPackage.stagedSetpointDevices?.length || finalAllDevicePlanPackage.blockedDevices?.length) ? (
                      <div className="fcu-worklist-actions fcu-plan-device-grid">
                        {(finalAllDevicePlanPackage.stagedSetpointDevices || []).slice(0, 4).map((item) => (
                          <article key={`staged-${item.deviceCode || item.deviceName}`}>
                            <span className="status-pill neutral">分步设定 · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || "未命名 FCU"}</strong>
                            <small>
                              设定 {formatNumber(item.setpointC, 1)}°C · 区温 {formatNumber(item.zoneTemperatureC, 1)}°C
                            </small>
                            <em>按 0.5-2.0°C 分步拉回，完成反馈后进入全量白名单。</em>
                          </article>
                        ))}
                        {(finalAllDevicePlanPackage.blockedDevices || []).slice(0, 4).map((item) => (
                          <article key={`blocked-${item.deviceCode || item.deviceName}`}>
                            <span className="status-pill warn">硬阻断 · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || "未命名 FCU"}</strong>
                            <small>
                              设定 {formatNumber(item.setpointC, 1)}°C · 区温 {formatNumber(item.zoneTemperatureC, 1)}°C
                            </small>
                            <em>{(item.blockedReasons || []).map(formatFcuBlockReason).slice(0, 3).join(" / ") || "需现场消缺后重跑计划"}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalFieldCloseoutPackage?.csv || finalFieldCloseoutPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>消缺关闭报告</strong>
                    <span>
                      {finalFieldCloseoutPackage.verdict || "待关闭"} ·{" "}
                      Canary {finalFieldCloseoutPackage.readyForCanary ? "可进入" : "阻断"} ·{" "}
                      未关闭 {finalFieldCloseoutPackage.remainingDeviceCount ?? "--"} 台 ·{" "}
                      {finalFieldCloseoutPackage.csv ? `CSV ${finalFieldCloseoutPackage.csv.split("/").pop()}` : ""}
                      {finalFieldCloseoutPackage.csv && finalFieldCloseoutPackage.markdown ? " · " : ""}
                      {finalFieldCloseoutPackage.markdown ? `Markdown ${finalFieldCloseoutPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldWorkOrdersPackage?.csv || finalFieldWorkOrdersPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>现场工单包</strong>
                    <span>
                      工单 {finalFieldWorkOrdersPackage.totalWorkOrders ?? "--"} 项 ·{" "}
                      未关闭 {finalFieldWorkOrdersPackage.openCount ?? "--"} 项 ·{" "}
                      签字 {finalFieldWorkOrdersPackage.requiresFieldSignoff ? "必需" : "无需"} ·{" "}
                      {finalFieldWorkOrdersPackage.csv ? `模板 ${finalFieldWorkOrdersPackage.csv.split("/").pop()}` : ""}
                      {finalFieldWorkOrdersPackage.signoffInputCsv ? ` · 填写 ${finalFieldWorkOrdersPackage.signoffInputCsv.split("/").pop()}` : ""}
                      {(finalFieldWorkOrdersPackage.csv || finalFieldWorkOrdersPackage.signoffInputCsv) && finalFieldWorkOrdersPackage.markdown ? " · " : ""}
                      {finalFieldWorkOrdersPackage.markdown ? `Markdown ${finalFieldWorkOrdersPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldExecutionPackPackage?.json || finalFieldExecutionPackPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>现场执行包</strong>
                    <span>
                      P0 {finalFieldExecutionPackPackage.openP0Devices ?? "--"} 台 ·{" "}
                      通讯 {finalFieldExecutionPackPackage.reasonCounts?.communication_alarm ?? 0} 台 ·{" "}
                      0°C/温度 {finalFieldExecutionPackPackage.reasonCounts?.zero_temperature ?? 0} 台 ·{" "}
                      设定反馈 {finalFieldExecutionPackPackage.reasonCounts?.setpoint_feedback_out_of_bounds ?? 0} 台 ·{" "}
                      {finalFieldExecutionPackOrder[0]?.phase || "restore_communication"} →{" "}
                      {finalFieldExecutionPackLastPhase?.phase || "rerun_closeout"} ·{" "}
                      {finalFieldExecutionPackPackage.markdown ? `Markdown ${finalFieldExecutionPackPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldHandoffPackage?.json || finalFieldHandoffPackage?.markdown || finalFieldHandoffPackage?.csv ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>现场交接包</strong>
                      <span>
                        P0 {finalFieldHandoffPackage.openP0Devices ?? "--"} 台 ·{" "}
                        过期签核 {finalFieldHandoffPackage.staleSignoffRows ?? "--"} 行 ·{" "}
                        签字 {finalFieldHandoffPackage.signoffCompleteRows ?? "--"}/{finalFieldHandoffPackage.signoffExpectedRows ?? "--"} ·{" "}
                        {finalFieldHandoffPackage.csv ? `CSV ${finalFieldHandoffPackage.csv.split("/").pop()}` : ""}
                        {finalFieldHandoffPackage.csv && finalFieldHandoffPackage.markdown ? " · " : ""}
                        {finalFieldHandoffPackage.markdown ? `Markdown ${finalFieldHandoffPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    <div className="fcu-worklist-actions">
                      <article>
                        <span className="status-pill warn">下一步 · 只读交接</span>
                        <strong>{finalFieldHandoffPackage.nextAllowedStep || "先完成现场 P0 消缺和签核"}</strong>
                        <small>
                          {finalFieldHandoffPackage.currentOnlyCsv
                            ? `current-only ${finalFieldHandoffPackage.currentOnlyCsv.split("/").pop()}`
                            : finalFieldHandoffPackage.signoffInputCsv
                              ? `签核表 ${finalFieldHandoffPackage.signoffInputCsv.split("/").pop()}`
                              : "等待现场签核输入表"}
                        </small>
                        <em>此包不产生 BA/PLC 写入，完成后仍需重跑 closeout、signoff、Canary readiness 和最终总门禁。</em>
                      </article>
                      {(finalFieldHandoffPackage.devices || []).slice(0, 3).map((item) => (
                        <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                          <span className="status-pill warn">P0现场 · {item.deviceCode || "FCU"}</span>
                          <strong>{item.deviceName || item.deviceCode || item.workOrderId || "未命名 FCU"}</strong>
                          <small>{(item.reasonLabels || []).slice(0, 3).join(" / ") || "待现场复核"}</small>
                          <em>{item.todayAction || "按交接包执行消缺并回填签字字段。"}</em>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
                {finalFieldReturnTemplatePackage?.json || finalFieldReturnTemplatePackage?.markdown || finalFieldReturnTemplatePackage?.csv ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>现场回填模板</strong>
                      <span>
                        设备 {finalFieldReturnTemplatePackage.deviceCount ?? "--"} 台 ·{" "}
                        通讯 {finalFieldReturnTemplatePackage.communicationBlocked ?? "--"} 台 ·{" "}
                        温度 {finalFieldReturnTemplatePackage.temperatureBlocked ?? "--"} 台 ·{" "}
                        设定 {finalFieldReturnTemplatePackage.setpointBlocked ?? "--"} 台 ·{" "}
                        {finalFieldReturnTemplatePackage.csv ? `CSV ${finalFieldReturnTemplatePackage.csv.split("/").pop()}` : ""}
                        {finalFieldReturnTemplatePackage.csv && finalFieldReturnTemplatePackage.markdown ? " · " : ""}
                        {finalFieldReturnTemplatePackage.markdown ? `Markdown ${finalFieldReturnTemplatePackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    <div className="fcu-worklist-actions">
                      {(finalFieldReturnTemplatePackage.devices || []).slice(0, 3).map((item) => (
                        <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                          <span className="status-pill warn">待回填 · {item.deviceCode || "FCU"}</span>
                          <strong>{item.deviceName || item.deviceCode || item.workOrderId || "未命名 FCU"}</strong>
                          <small>{(item.missingFields || []).slice(0, 4).join(" / ") || "按模板字段回填"}</small>
                          <em>{(item.releaseCriteria || []).slice(0, 2).join("；") || "回填后仍需重跑签核、closeout 和最终总门禁。"}</em>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
                {finalFieldSignoffPackage?.json || finalFieldSignoffPackage?.markdown ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>签字校验</strong>
                      <span>
                        {finalFieldSignoffPackage.signoffComplete ? "已完成" : "未完成"} ·{" "}
                        {finalFieldSignoffPackage.completeRows ?? "--"}/{finalFieldSignoffPackage.expectedWorkOrders ?? "--"} 行 ·{" "}
                        实时 closeout {finalFieldSignoffPackage.stillRequiresRealtimeCloseout ? "仍必需" : "无要求"} ·{" "}
                        {finalFieldSignoffPackage.inputCsv ? `输入 ${finalFieldSignoffPackage.inputCsv.split("/").pop()} · ` : ""}
                        {finalFieldSignoffPackage.releaseMatrixCsv ? `矩阵 ${finalFieldSignoffPackage.releaseMatrixCsv.split("/").pop()} · ` : ""}
                        {finalFieldSignoffPackage.markdown ? `Markdown ${finalFieldSignoffPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    {finalFieldSignoffPackage.releaseMatrix?.length ? (
                      <div className="fcu-worklist-actions fcu-release-matrix-grid">
                        {finalFieldSignoffPackage.releaseMatrix.slice(0, 6).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className={`status-pill ${item.canEnterCanary ? "good" : "warn"}`}>
                              {item.canEnterCanary ? "可 Canary" : "Canary 阻断"} · {item.deviceCode || item.workOrderId || "FCU"}
                            </span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || "未命名 FCU"}</strong>
                            <small>
                              {item.canaryBlockReason || "需重跑实时 closeout"} · {item.verificationTarget || "复检目标待读取"}
                            </small>
                            <em>
                              {(item.nextActions || []).slice(0, 2).join(" / ") ||
                                (item.releaseCriteria || []).slice(0, 2).join(" / ") ||
                                "补齐现场签字后重跑最终控制清单"}
                            </em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldSignoffPackage.onsiteReleasePrecheck ? (
                      <div className="fcu-worklist-actions">
                        <article>
                          <span className={`status-pill ${finalFieldSignoffPackage.onsiteReleasePrecheck.ok ? "good" : "warn"}`}>
                            现场放行预检 · {finalFieldSignoffPackage.onsiteReleasePrecheck.ok ? "签字完整" : "仍阻断"}
                          </span>
                          <strong>
                            Ready {finalFieldSignoffPackage.onsiteReleasePrecheck.onsiteReleaseReadyCount ?? "--"} / Blocked {finalFieldSignoffPackage.onsiteReleasePrecheck.onsiteReleaseBlockedCount ?? "--"}
                          </strong>
                          <small>
                            Canary 仍阻断 {finalFieldSignoffPackage.onsiteReleasePrecheck.canaryStillBlockedCount ?? "--"} 台 ·{" "}
                            候选 {finalFieldSignoffPackage.onsiteReleasePrecheck.canaryCandidateCount ?? "--"} 台
                          </small>
                          <em>
                            {(finalFieldSignoffPackage.onsiteReleasePrecheck.nextGlobalActions || []).slice(0, 3).join(" / ") ||
                              "签字完整后仍需实时 closeout、Canary readiness 和最终总门禁。"}
                          </em>
                        </article>
                        {(finalFieldSignoffPackage.onsiteReleasePrecheck.devices || []).slice(0, 3).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className={`status-pill ${item.onsiteReleaseReady ? "neutral" : "warn"}`}>
                              {item.onsiteReleaseReady ? "签字候选" : "签字阻断"} · {item.deviceCode || "FCU"}
                            </span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || "未命名 FCU"}</strong>
                            <small>{(item.nextBlockingFields || []).slice(0, 4).join(" / ") || item.canaryBlockReason || "--"}</small>
                            <em>{item.nextAction || "补齐现场字段后重跑签字校验。"}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldSignoffPackage.openRecords?.length ? (
                      <div className="fcu-worklist-actions">
                        {finalFieldSignoffPackage.openRecords.slice(0, 3).map((record) => (
                          <article key={record.workOrderId || record.deviceCode || record.deviceName}>
                            <span className="status-pill warn">
                              签字缺项 · {record.deviceCode || record.workOrderId || "FCU"}
                            </span>
                            <strong>{record.deviceName || record.deviceCode || record.workOrderId || "未命名 FCU"}</strong>
                            <small>
                              {(record.missingChecklist || [])
                                .slice(0, 4)
                                .map((item) => `${item.field || "--"}=${item.requiredValue || "--"}`)
                                .join(" / ") || (record.issues || []).slice(0, 4).join(" / ") || "缺项待读取"}
                            </small>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalFieldSignoffCleanPackage?.json || finalFieldSignoffCleanPackage?.currentCsv ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>签字输入清理</strong>
                    <span>
                      当前有效 {finalFieldSignoffCleanPackage.currentRows ?? "--"} 行 ·{" "}
                      旧行 {finalFieldSignoffCleanPackage.staleRows ?? "--"} 行 ·{" "}
                      补生成 {finalFieldSignoffCleanPackage.generatedMissingRows ?? "--"} 行 ·{" "}
                      {finalFieldSignoffCleanPackage.currentCsv ? `填写 ${finalFieldSignoffCleanPackage.currentCsv.split("/").pop()}` : ""}
                      {finalFieldSignoffCleanPackage.currentCsv && finalFieldSignoffCleanPackage.staleCsv ? " · " : ""}
                      {finalFieldSignoffCleanPackage.staleCsv ? `归档 ${finalFieldSignoffCleanPackage.staleCsv.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldSignoffPromotePackage?.json || finalFieldSignoffPromotePackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>签字输入提升</strong>
                    <span>
                      {finalFieldSignoffPromotePackage.mode || "dry_run"} ·{" "}
                      确认{finalFieldSignoffPromotePackage.confirmMatched ? "已匹配" : "未匹配"} ·{" "}
                      写入{finalFieldSignoffPromotePackage.fileMutation ? "已执行" : "未执行"} ·{" "}
                      当前 {finalFieldSignoffPromotePackage.currentRows ?? "--"} 行 ·{" "}
                      旧行 {finalFieldSignoffPromotePackage.staleRows ?? "--"} 行 ·{" "}
                      {finalFieldSignoffPromotePackage.markdown ? `Markdown ${finalFieldSignoffPromotePackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryReadinessPackage?.json || finalCanaryReadinessPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>Canary总门禁</strong>
                    <span>
                      {finalCanaryReadinessPackage.canaryReady ? "可执行" : "阻断"} ·{" "}
                      {finalCanaryReadinessPackage.verdict || "readiness --"} ·{" "}
                      阻断 {finalCanaryReadinessPackage.blockedCount ?? "--"} 项 ·{" "}
                      首台 {finalCanaryReadinessPackage.firstCanary || canaryDeviceLabel} ·{" "}
                      {finalCanaryReadinessPackage.markdown ? `Markdown ${finalCanaryReadinessPackage.markdown.split("/").pop()}` : ""}
                    </span>
                    {finalCanaryReadinessPlaybook ? (
                      <>
                        <span>
                          Readiness 作战表 · {finalCanaryReadinessPlaybook.readyGateCount ?? "--"} ready /{" "}
                          {finalCanaryReadinessPlaybook.blockedGateCount ?? "--"} blocked · 第一阻断{" "}
                          {finalCanaryReadinessPlaybook.firstBlockedPhase || "无"} /{" "}
                          {finalCanaryReadinessPlaybook.firstBlockedOwner || "无"}
                        </span>
                        <em>第一动作：{finalCanaryReadinessPlaybook.firstBlockedAction || "全部门禁通过后才允许进入 Canary。"}</em>
                        {finalCanaryReadinessPhasePlan.length > 0 ? (
                          <div className="fcu-worklist-phase-grid">
                            {finalCanaryReadinessPhasePlan.slice(0, 6).map((item) => (
                              <div key={item.key || item.phase} className="fcu-worklist-phase-item">
                                <span className={`status-pill ${item.ready ? "good" : "warn"}`}>
                                  {item.ready ? "通过" : "阻断"}
                                </span>
                                <strong>{item.phase || item.key || "门禁"}</strong>
                                <span>{item.owner || "责任未定"} · {item.evidence || "无证据"}</span>
                                <em>{item.ready ? "保持证据" : item.nextAction || "按门禁动作处理"}</em>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
                {finalFieldArmPackage?.json || finalFieldArmPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>现场开闸包</strong>
                    <span>
                      {finalFieldArmPackage.deviceCode ? `${finalFieldArmPackage.deviceCode} · ` : ""}
                      {finalFieldArmPackage.verdict || "待生成"} ·{" "}
                      P0 {finalFieldArmPackage.blockers.filter((item) => item.severity === "P0").length} ·{" "}
                      {finalFieldArmPackage.controlMutation ? "已写入" : "无写入"} ·{" "}
                      {finalFieldArmPackage.markdown ? `Markdown ${finalFieldArmPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryPackage?.json || finalCanaryPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>首台 Canary 包</strong>
                    <span>
                      {finalCanaryPackage.deviceCode ? `${finalCanaryPackage.deviceCode} · ` : ""}
                      {finalCanaryPackageStatus || "待现场开闸"} ·{" "}
                      {finalCanaryPackage.csv ? `CSV ${finalCanaryPackage.csv.split("/").pop()}` : ""}
                      {finalCanaryPackage.csv && finalCanaryPackage.markdown ? " · " : ""}
                      {finalCanaryPackage.markdown ? `Markdown ${finalCanaryPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalAdapterPackage?.json || finalAdapterPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>BA适配器自检</strong>
                    <span>
                      {finalAdapterPackage.deviceCode ? `${finalAdapterPackage.deviceCode} · ` : ""}
                      {finalAdapterPackage.verdict || "待自检"} ·{" "}
                      {finalAdapterPackage.csv ? `CSV ${finalAdapterPackage.csv.split("/").pop()}` : ""}
                      {finalAdapterPackage.csv && finalAdapterPackage.markdown ? " · " : ""}
                      {finalAdapterPackage.markdown ? `Markdown ${finalAdapterPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryFeedbackPackage?.json || finalCanaryFeedbackPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>Canary反馈监视</strong>
                    <span>
                      {finalCanaryFeedbackPackage.deviceCode ? `${finalCanaryFeedbackPackage.deviceCode} · ` : ""}
                      {finalCanaryFeedbackPackage.verdict || "待反馈"} ·{" "}
                      {finalCanaryFeedbackPackage.feedbackStatus || "feedback --"} ·{" "}
                      {finalCanaryFeedbackPackage.csv ? `CSV ${finalCanaryFeedbackPackage.csv.split("/").pop()}` : ""}
                      {finalCanaryFeedbackPackage.csv && finalCanaryFeedbackPackage.markdown ? " · " : ""}
                      {finalCanaryFeedbackPackage.markdown ? `Markdown ${finalCanaryFeedbackPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryWindowPackage?.json || finalCanaryWindowPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>Canary投运窗口</strong>
                    <span>
                      {finalCanaryWindowPackage.deviceCode ? `${finalCanaryWindowPackage.deviceCode} · ` : ""}
                      {finalCanaryWindowPackage.verdict || "待投运"} ·{" "}
                      {finalCanaryWindowPackage.mode || "window --"} ·{" "}
                      {finalCanaryWindowPackage.controlMutation ? "已写入" : "无写入"} ·{" "}
                      {finalCanaryWindowPackage.markdown ? `Markdown ${finalCanaryWindowPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {finalNextActions.length > 0 ? (
              <div className="fcu-commissioning-actions">
                {finalNextActions.slice(0, 3).map((action) => (
                  <span key={`${action.priority || "P"}-${action.action || action.reason}`}>
                    <strong>{action.priority || "P0"} · {action.action || "下一步"}</strong>
                    {action.reason ? <small>{action.reason}</small> : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="fcu-canary-runbook">
            <div>
              <strong>真实投运顺序</strong>
              <span>先跑上线前预检，再对 {canaryDeviceLabel} 执行单台设定 canary；反馈正常后才扩大到小批量白名单。</span>
            </div>
            <div className="fcu-canary-steps">
              <span className={fcuExecutionGate?.dispatchAllowed ? "is-ok" : "is-blocked"}>预检</span>
              <span className="is-next">Canary</span>
              <span>反馈校验</span>
              <span>小批量</span>
            </div>
          </div>
          <div className="fcu-control-inline-queue">
            <strong>最近动作</strong>
            <span>{controlQueuePreview || "暂无控制队列；运行控制周期后生成 Ready、保护阻断或保持记录。"}</span>
          </div>
          {commissioningReport ? (
            <div className="fcu-commissioning-report">
              <div className="fcu-commissioning-report-head">
                <strong>投运报告</strong>
                <span className={`status-pill ${commissioningReport.verdict === "ready_for_control" ? "good" : commissioningReport.verdict === "environment_blocked" ? "neutral" : "warn"}`}>
                  {commissioningReport.summaryText || "投运状态待读取"}
                </span>
              </div>
              <div className="fcu-commissioning-report-grid">
                <article>
                  <span>候选设备</span>
                  <strong>{commissioningReport.releaseCandidateDeviceCodes?.length || 0}</strong>
                  <small>{commissioningReport.releaseCandidateDeviceCodes?.slice(0, 6).join(" / ") || "暂无"}</small>
                </article>
                <article>
                  <span>阻断设备</span>
                  <strong>{commissioningReport.blockedDeviceCodes?.length || 0}</strong>
                  <small>{commissioningReport.blockedDeviceCodes?.slice(0, 6).join(" / ") || "暂无"}</small>
                </article>
                <article>
                  <span>主要阻断</span>
                  <strong>{commissioningReport.conditionBlockers?.[0]?.count || 0}</strong>
                  <small>{commissioningReport.conditionBlockers?.[0]?.label || "无"}</small>
                </article>
              </div>
              <div className="fcu-commissioning-actions">
                {(commissioningReport.nextActions || []).slice(0, 3).map((action) => (
                  <span key={`${action.priority}-${action.action}-${action.target}`}>
                    <strong>{action.priority || "P2"}</strong>
                    {action.action || "待处理"} · {action.target || "FCU"}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {terminalView === "control" && recentControlRecords.length > 0 ? (
            <div className="hvac-terminal-trend fcu-control-record-detail">
              {recentControlRecords.slice(0, 8).map((record) => (
                <div key={record.recordId || `${record.deviceCode}-${record.createdAt}`} className="hvac-terminal-trend-point">
                  <span>{formatSampleTime(record.createdAt)}</span>
                  <strong>{record.deviceName || record.deviceCode || "FCU"}</strong>
                  <small>
                    <span className={`status-pill ${fcuControlTone(record.status)}`}>{formatFcuControlStatus(record.status)}</span>
                    {record.commands?.length ? ` ${record.commands.length}条命令` : ` ${record.reason || "保持"}`}
                    {record.feedback?.status ? ` · 反馈${formatFcuControlStatus(record.status).replace(/^反馈/, "")}` : ""}
                    {["dispatched", "feedback_pending", "feedback_mismatch_locked"].includes(record.status || "") && record.recordId ? (
                      <button
                        type="button"
                        className="fcu-feedback-check-button"
                        onClick={() => void handleVerifyFeedback(record.recordId)}
                        disabled={feedbackVerifyingId === record.recordId}
                      >
                        {feedbackVerifyingId === record.recordId ? "校验中" : "校验反馈"}
                      </button>
                    ) : null}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {terminalView === "quality" ? (
      <section className="section-card hvac-terminal-quality-card hvac-terminal-quality-detail-card">
        <header className="section-card-header">
          <h3>数据质量与采样趋势</h3>
          <span className={`status-pill ${fanCoilReady && qualityIssueCount === 0 ? "good" : fanCoilReady ? "warn" : "neutral"}`}>
            {fanCoilReady ? fanCoils?.historySampling?.status || "未采样" : "无实时样本"}
          </span>
        </header>
        <div className="section-card-body">
          <div className="hvac-quality-grid">
            <article>
              <span>舒适性样本</span>
              <strong>{fanCoilReady ? `${fanCoilSummary.comfortEligibleCount || 0}/${fanCoilSummary.total || 0}` : "--"}</strong>
              <small>剔除 0°C、超限、通讯报警</small>
            </article>
            <article>
              <span>质量异常</span>
              <strong>{fanCoilReady ? qualityIssueCount : "--"}</strong>
              <small>0°C {fanCoilSummary.zeroTemperatureCount || 0} · 超限 {fanCoilSummary.outOfRangeTemperatureCount || 0} · 缺失 {fanCoilSummary.missingTemperatureCount || 0}</small>
            </article>
            <article>
              <span>趋势样本</span>
              <strong>{historyItems.length}</strong>
              <small>最近 {latestHistory?.sampledAt ? formatSampleTime(latestHistory.sampledAt) : "暂无历史"}</small>
            </article>
          </div>
          {recentHistoryItems.length > 0 ? (
            <div className="hvac-terminal-trend">
              {recentHistoryItems.map((item) => (
                <div key={item.sampledAt} className="hvac-terminal-trend-point">
                  <span>{formatSampleTime(item.sampledAt)}</span>
                  <strong>{formatNumber(item.averageZoneTemperatureC, 1)}°C</strong>
                  <small>有效 {item.comfortEligibleCount || 0} / 报警 {item.communicationAlarmCount || 0}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="source-banner">暂无历史采样；实时快照读取成功后会按最小间隔自动沉淀。</div>
          )}
        </div>
      </section>
      ) : null}

      {terminalView === "devices" ? (
      <div className="power-monitor-layout hvac-terminal-layout">
        <section className="section-card">
          <header className="section-card-header">
            <h3>末端空气侧链路</h3>
            <span className="status-pill neutral">只读</span>
          </header>
          <div className="section-card-body">
            <div className={`power-single-line hvac-terminal-chain${configEnabled ? " is-enabled" : ""}`}>
              <div className="power-node power-node-source">
                <Building2 size={20} />
                <strong>{floorName} 末端</strong>
                <span>{fanCoilReady ? "BA快照已接入" : configEnabled ? "实时待接入" : "未配置"}</span>
              </div>
              <div className="power-bus" aria-hidden="true" />
              <div className="power-node-grid">
                <div className="power-node">
                  <Fan size={18} />
                  <strong>风机盘管</strong>
                  <span>{fanCoilReady ? `${fanCoilSummary.total || 0}台` : configEnabled ? "点位待接" : "未配置"}</span>
                </div>
                <div className="power-node">
                  <Thermometer size={18} />
                  <strong>区域温度</strong>
                  <span>{fanCoilReady ? `${formatNumber(fanCoilSummary.averageZoneTemperatureC, 1)}°C` : configEnabled ? "温度待接" : "未配置"}</span>
                </div>
                <div className="power-node">
                  <Gauge size={18} />
                  <strong>阀门反馈</strong>
                  <span>{fanCoilReady ? `${formatNumber(fanCoilSummary.averageValveOpenPct, 0)}%开` : configEnabled ? "阀位待接" : "未配置"}</span>
                </div>
                <div className="power-node">
                  <ShieldCheck size={18} />
                  <strong>控制边界</strong>
                  <span>{configEnabled ? (fcuWriteEnabled ? "FCU闭环/白名单" : "写点禁用") : "未参与"}</span>
                </div>
              </div>
            </div>
            <div className="source-banner" style={{ marginTop: 14 }}>
              必需只读点位：{requiredRoleLabel}。可选增强：{optionalRoleLabel}。
            </div>
            <div className="source-banner" style={{ marginTop: 10 }}>
              FCU 自动控制只对白名单单台设备开放；阀门只作为反馈，不直接写阀门开度。所有启停、设定和风速命令必须经过
              数据质量、手动优先、最小保持时间、后端总闸、审计和回退保护。
            </div>
          </div>
        </section>

        <section className="section-card">
          <header className="section-card-header">
            <h3>风机盘管列表</h3>
            <span className={`status-pill ${fanCoilReady ? "good" : "neutral"}`}>
              {fanCoilReady ? `${fanCoilSummary.total || 0}台可点选` : "无假数据"}
            </span>
          </header>
          <div className="section-card-body">
            {fanCoilReady ? (
              <>
              <div className="source-banner hvac-terminal-device-list-guide">
                <strong>{fanCoilSummary.total || fanCoilItems.length} 台 FCU 均支持点进单台控制页。</strong>
                <span>每台可查看投运闸门、保护阻断、最近记录，并分别预演启停、设定温度和风速命令。</span>
              </div>
              <div className="hvac-terminal-device-picker hvac-terminal-device-picker--list">
                <div className="hvac-terminal-device-picker-head">
                  <strong>FCU 控制索引</strong>
                  <span>全部 {fanCoilItems.length} 台；点击任意设备进入独立控制面板。</span>
                </div>
                <div className="hvac-terminal-device-picker-grid">
                  {fanCoilItems.map((item) => {
                    const deviceKey = resolveFanCoilDeviceKey(item);
                    const commissioningStatus = commissioningByDeviceCode.get(deviceKey);
                    const controlEntry = formatFcuControlEntryStatus(commissioningStatus);
                    const chipTone = item.communicationAlarm
                      ? "is-warn"
                      : item.running
                        ? "is-running"
                        : "is-idle";
                    return (
                      <Link
                        key={`list-picker-${item.deviceId || item.deviceCode || item.deviceName}`}
                        to={buildFanCoilDeviceHref(item)}
                        className={`hvac-terminal-device-chip ${chipTone}`}
                        title={`${item.deviceName || deviceKey}：进入单台控制，${controlEntry.label}`}
                      >
                        <strong>{item.deviceCode || item.deviceName || "--"}</strong>
                        <span>{formatNumber(item.zoneTemperatureC, 1)}°C · 控制</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="fan-coil-grid">
                {fanCoilItems.map((item) => {
                  const deviceKey = resolveFanCoilDeviceKey(item);
                  const commissioningStatus = commissioningByDeviceCode.get(deviceKey);
                  return (
                    <Link
                      key={item.deviceId || item.deviceCode || item.deviceName}
                      className="fan-coil-card-link"
                      to={buildFanCoilDeviceHref(item)}
                    >
                      <FanCoilCard
                        item={item}
                        controlRecord={controlRecordsByDeviceCode.get(deviceKey)}
                        commissioningStatus={commissioningStatus}
                        entryLabel="进入单台控制"
                      />
                    </Link>
                  );
                })}
              </div>
              </>
            ) : (
              <div className="source-banner warn">
                {configEnabled ? "未读取到风机盘管实时快照，暂不显示盘管 KPI。" : "该项目未配置空调末端，不参与统计。"}
              </div>
            )}
          </div>
        </section>
      </div>
      ) : null}

      {terminalView === "device" ? (
      <section className="section-card hvac-terminal-device-control-card">
        <header className="section-card-header">
          <div>
            <h3>{selectedFanCoil?.deviceName || selectedDeviceCode || "单台 FCU"}</h3>
            <p className="power-monitor-subtitle">
              单台风机盘管控制页；预演和确认下发都只针对当前设备，阀门只作为反馈，不直接写阀门开度。
            </p>
          </div>
          <div className="section-action">
            <Link to={buildTerminalViewHref("devices")} className="ghost-link-button">
              返回列表
            </Link>
            {previousFanCoil ? (
              <Link to={buildFanCoilDeviceHref(previousFanCoil)} className="ghost-link-button hvac-terminal-device-switch">
                <ChevronLeft size={13} />
                上一台
              </Link>
            ) : null}
            {nextFanCoil ? (
              <Link to={buildFanCoilDeviceHref(nextFanCoil)} className="ghost-link-button hvac-terminal-device-switch">
                下一台
                <ChevronRight size={13} />
              </Link>
            ) : null}
            <span className={`status-pill ${selectedFanCoil?.communicationAlarm ? "warn" : selectedFanCoil ? "good" : "neutral"}`}>
              {selectedFanCoil ? formatAlarmState(selectedFanCoil.communicationAlarm) : "未找到"}
            </span>
            <button
              type="button"
              onClick={() => void handleRunControlCycle(false, selectedDeviceCode)}
              disabled={selectedDevicePanelLoading || !selectedFanCoil || controlRunning || controlDispatching}
            >
              <ShieldCheck size={14} />
              {selectedDevicePanelLoading ? "加载中" : controlRunning ? "预演中" : "预演单台"}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => void handleRunControlCycle(true, selectedDeviceCode)}
              disabled={selectedDevicePanelLoading || !selectedFanCoil || !canConfirmDispatch || controlRunning || controlDispatching}
              title={canConfirmDispatch ? "确认后只向当前 FCU 下发 ready 命令" : "需先在当前单台页完成预演并生成 ready 命令"}
            >
              <ShieldCheck size={14} />
              {controlDispatching ? "下发中" : "确认下发"}
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {controlNotice ? <div className="source-banner">{controlNotice}</div> : null}
          {!selectedDeviceCode ? (
            <div className="source-banner warn">未指定 FCU，请从盘管列表点击单台设备进入控制。</div>
          ) : null}
          {selectedDevicePanelLoading ? (
            <div className="source-banner">
              正在加载 {selectedDeviceCode} 单台控制面板；加载完成后会显示启停、设定温度、风速、开闸预检和投运包入口。
            </div>
          ) : null}
          {selectedDeviceCode && !selectedDevicePanelLoading && !selectedFanCoil ? (
            <div className="source-banner warn">当前快照中未找到 {selectedDeviceCode}，禁止下发控制。请刷新或回到盘管列表重新选择。</div>
          ) : null}
          {selectedFanCoil ? (
            <>
              <div className={`source-banner${selectedFcuWriteEnabled ? "" : " warn"}`}>
                当前 FCU 已进入单台控制页：可执行单台预演、查看投运闸门和最近记录。
                {selectedFcuWriteEnabled
                  ? "该设备满足白名单与投运条件，当前预演生成 ready 后才允许确认下发。"
                  : "真实确认下发仍受白名单、后端只读总闸、适配器、数据质量和回退保护限制。"}
              </div>
              <div className="fcu-final-status-panel hvac-terminal-device-final-gate">
                <div className="fcu-final-status-head">
                  <div>
                    <strong>单台最终控制门禁</strong>
                    <span>当前 FCU 必须逐项通过设备质量、写总闸、Arm-Check、Canary、反馈确认和最终验收，才算进入真实闭环。</span>
                  </div>
                  <span className={`status-pill ${selectedFinalGateOk ? "good" : "warn"}`}>
                    {selectedFinalGateOk ? "闭环完成" : "闭环未完成"}
                  </span>
                </div>
                <div className="fcu-final-status-grid">
                  {selectedFinalGateItems.map((item) => (
                    <article key={item.key} className={item.ok ? "tone-good" : "tone-warn"}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.note}</small>
                    </article>
                  ))}
                </div>
                <div className="fcu-final-status-detail">
                  <div>
                    <strong>当前设备</strong>
                    <span>{selectedFanCoil.deviceCode || selectedFanCoil.deviceName || "--"} · {selectedFanCoil.deviceName || selectedFanCoil.floorName || floorName}</span>
                  </div>
                  <div>
                    <strong>真实写入边界</strong>
                    <span>{selectedFinalGateMutation ? "已有写入副作用，需核对审计记录" : "当前未产生 BA/PLC 写入副作用"}</span>
                  </div>
                </div>
              </div>
              <div className="hvac-terminal-device-picker">
                <div className="hvac-terminal-device-picker-head">
                  <strong>FCU 逐台切换</strong>
                  <span>{fanCoilItems.length} 台均可点进单台控制页；当前命令只作用于选中的 FCU。</span>
                </div>
                <div className="hvac-terminal-device-picker-grid">
                  {fanCoilItems.map((item) => {
                    const deviceKey = resolveFanCoilDeviceKey(item);
                    const selected = [item.deviceCode, item.deviceId, item.deviceName]
                      .map(normalizeDeviceKey)
                      .includes(selectedDeviceCode);
                    const commissioningStatus = commissioningByDeviceCode.get(deviceKey);
                    const controlEntry = formatFcuControlEntryStatus(commissioningStatus);
                    const chipTone = selected
                      ? "is-selected"
                      : item.communicationAlarm
                        ? "is-warn"
                        : item.running
                          ? "is-running"
                          : "is-idle";
                    return (
                      <Link
                        key={`picker-${item.deviceId || item.deviceCode || item.deviceName}`}
                        to={buildFanCoilDeviceHref(item)}
                        className={`hvac-terminal-device-chip ${chipTone}`}
                        aria-current={selected ? "page" : undefined}
                        title={`${item.deviceName || deviceKey}：${controlEntry.label}`}
                      >
                        <strong>{item.deviceCode || item.deviceName || "--"}</strong>
                        <span>{formatNumber(item.zoneTemperatureC, 1)}°C · {controlEntry.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className={`hvac-terminal-commissioning-gate${fieldArmReady ? "" : " is-blocked"}`}>
                <div className="hvac-terminal-commissioning-gate-head">
                  <strong>现场开闸 Arm-Check</strong>
                  <span className={`status-pill ${fieldArmReady ? "good" : "warn"}`}>
                    {fieldArmReady ? "允许 Canary" : "禁止真实下发"}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-summary">
                  <span>
                    首台 Canary：{fieldArmCheck?.firstCanary || canaryDeviceLabel}；队列设备：
                    {fieldArmCheck?.commissioningSummary?.deviceReady || 0} 台设备侧就绪。
                  </span>
                  <span>
                    {fieldArmReady
                      ? "现场闸门已满足；仍需先单台反馈校验，再扩大。"
                      : `阻断项：${fieldArmBlockedText}`}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {(fieldArmCheck?.checks || []).slice(0, 8).map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {condition.label || condition.key}
                    </span>
                  ))}
                </div>
                {fieldArmNextActions.length > 0 ? (
                  <div className="fcu-commissioning-actions">
                    {fieldArmNextActions.slice(0, 4).map((action) => (
                      <span key={`${action.priority || "P"}-${action.action || action.target || action.reason}`}>
                        <strong>{action.priority || "P"} · {action.action || "下一步"}</strong>
                        {action.target ? <small>{action.target}</small> : null}
                        {action.reason ? <small>{action.reason}</small> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="hvac-terminal-device-grid">
                <article className="hvac-terminal-device-primary">
                  <span>设备编号</span>
                  <strong>{selectedFanCoil.deviceCode || selectedFanCoil.deviceId || "--"}</strong>
                  <small>{selectedFanCoil.deviceTypeName || "FCU"} · {selectedFanCoil.floorName || floorName}</small>
                </article>
                <article className="tone-good">
                  <span>区域温度</span>
                  <strong>{formatNumber(selectedFanCoil.zoneTemperatureC, 1)}°C</strong>
                  <small>{formatQualityStatus(selectedFanCoil.quality?.status || "unknown")}</small>
                </article>
                <article>
                  <span>设定反馈</span>
                  <strong>{formatNumber(selectedDeviceSetpoint, 1)}°C</strong>
                  <small>单次调整 0.5°C</small>
                </article>
                <article className={selectedFanCoil.running ? "tone-good" : "tone-neutral"}>
                  <span>运行状态</span>
                  <strong>{formatRunState(selectedFanCoil.running)}</strong>
                  <small>风速 {formatNumber(selectedFanCoil.fanSpeedState, 0)}</small>
                </article>
                <article className={selectedFanCoil.communicationAlarm ? "tone-warn" : "tone-good"}>
                  <span>控制保护</span>
                  <strong>{selectedFanCoil.communicationAlarm ? "阻断" : fcuWriteEnabled ? "可预演" : "只读"}</strong>
                  <small>{executionBoundaryLabel}</small>
                </article>
              </div>
              <div className="hvac-terminal-commissioning-gate hvac-terminal-device-commissioning">
                <div className="hvac-terminal-commissioning-gate-head">
                  <strong>单台投运状态</strong>
                  <span className={`status-pill ${selectedCommissioning?.canDispatch ? "good" : selectedCommissioning?.deviceReady ? "neutral" : "warn"}`}>
                    {formatFcuCommissioningStatus(selectedCommissioning?.status)}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-summary">
                  <span>
                    {selectedCommissioning?.deviceReady
                      ? "该 FCU 的白名单、点位、通讯、温度质量已通过。"
                      : `阻断项：${selectedCommissioningBlockedText}`}
                  </span>
                  <span>
                    最近记录：
                    {selectedCommissioning?.latestRecord
                      ? `${formatSampleTime(selectedCommissioning.latestRecord.createdAt)} · ${formatFcuControlStatus(selectedCommissioning.latestRecord.status)}`
                      : "暂无"}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {selectedCommissioningConditions.map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {condition.label || condition.key}
                    </span>
                  ))}
                </div>
              </div>
              {selectedQualityRemediation ? (
                <div className="hvac-terminal-commissioning-gate hvac-terminal-device-remediation">
                  <div className="hvac-terminal-commissioning-gate-head">
                    <strong>本机 P0 消缺</strong>
                    <span className="status-pill warn">{selectedQualityRemediation.severity || "P0"}</span>
                  </div>
                  <div className="hvac-terminal-device-remediation-reasons">
                    {(selectedQualityRemediation.reasons || []).slice(0, 5).map((reason) => (
                      <span key={`${selectedDeviceCode}-${reason}`}>{formatFcuBlockReason(reason)}</span>
                    ))}
                  </div>
                  <div className="hvac-terminal-device-remediation-body">
                    <div>
                      <strong>现场动作</strong>
                      <ul>
                        {(selectedQualityRemediation.fieldActions || []).slice(0, 4).map((action) => (
                          <li key={`${selectedDeviceCode}-${action}`}>{action}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>放行标准</strong>
                      <ul>
                        {(selectedQualityRemediation.releaseCriteria || []).slice(0, 4).map((criterion) => (
                          <li key={`${selectedDeviceCode}-${criterion}`}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
              {(selectedSignoffReleaseMatrix || selectedSignoffOpenRecord || selectedOnsiteReleasePrecheck || selectedFieldPlaybookDevice || selectedReturnTemplateDevice) ? (
                <div className={`hvac-terminal-commissioning-gate hvac-terminal-device-remediation${selectedSignoffReleaseMatrix?.canEnterCanary ? "" : " is-blocked"}`}>
                  <div className="hvac-terminal-commissioning-gate-head">
                    <strong>本机现场签核缺口</strong>
                    <span className={`status-pill ${selectedSignoffReleaseMatrix?.canEnterCanary ? "good" : "warn"}`}>
                      {selectedSignoffReleaseMatrix?.canEnterCanary ? "可进 Canary" : "签核/closeout 阻断"}
                    </span>
                  </div>
                  <div className="hvac-terminal-commissioning-summary">
                    <span>
                      工单：{selectedSignoffReleaseMatrix?.workOrderId || selectedSignoffOpenRecord?.workOrderId || selectedFieldPlaybookDevice?.workOrderId || "--"}；
                      现场放行：{selectedOnsiteReleasePrecheck?.onsiteReleaseReady ? "签字候选" : "未放行"}；
                      Canary：{selectedOnsiteReleasePrecheck?.canEnterCanary || selectedSignoffReleaseMatrix?.canEnterCanary ? "候选" : "阻断"}。
                    </span>
                    <span>
                      {selectedSignoffReleaseMatrix?.canaryBlockReason ||
                        selectedOnsiteReleasePrecheck?.canaryBlockReason ||
                        "补齐现场签核后仍需重跑实时 closeout、Canary readiness 和最终总门禁。"}
                    </span>
                  </div>
                  {selectedSignoffMissingFields.length > 0 ? (
                    <div className="hvac-terminal-device-remediation-reasons">
                      {selectedSignoffMissingFields.slice(0, 8).map((field) => (
                        <span key={`${selectedDeviceCode}-signoff-field-${field}`}>{field}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="hvac-terminal-device-remediation-body">
                    <div>
                      <strong>必填签核字段</strong>
                      <ul>
                        {selectedSignoffMissingChecklist.length > 0
                          ? selectedSignoffMissingChecklist.slice(0, 5).map((item) => (
                              <li key={`${selectedDeviceCode}-${item.field}`}>
                                {item.field || "--"} = {item.requiredValue || "--"}；{item.action || "现场复核后回填"}
                              </li>
                            ))
                          : selectedSignoffMissingFields.slice(0, 5).map((field) => (
                              <li key={`${selectedDeviceCode}-${field}`}>{field}</li>
                            ))}
                        {selectedSignoffMissingChecklist.length === 0 && selectedSignoffMissingFields.length === 0 ? (
                          <li>当前未列出缺项；仍需以签字校验、实时 closeout 和 Canary 总门禁为准。</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <strong>下一步现场动作</strong>
                      <ul>
                        {selectedSignoffNextActions.length > 0
                          ? selectedSignoffNextActions.slice(0, 5).map((action) => (
                              <li key={`${selectedDeviceCode}-signoff-action-${action}`}>{action}</li>
                            ))
                          : selectedSignoffReleaseCriteria.slice(0, 5).map((criterion) => (
                              <li key={`${selectedDeviceCode}-signoff-criterion-${criterion}`}>{criterion}</li>
                            ))}
                        {selectedSignoffNextActions.length === 0 && selectedSignoffReleaseCriteria.length === 0 ? (
                          <li>按现场回填模板补齐后，刷新签字校验、现场消缺 closeout 和最终控制清单。</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                  <div className="fcu-worklist-package-strip">
                    <strong>只读证据链</strong>
                    <span>
                      该卡片只读取 releaseMatrix / onsiteReleasePrecheck / readinessPlaybook，不保存签核、不生成真实 Canary、不下发 BA/PLC。
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="hvac-terminal-commissioning-gate">
                <div className="hvac-terminal-commissioning-gate-head">
                  <strong>投运闸门</strong>
                  <span className={`status-pill ${fcuWriteEnabled ? "good" : "warn"}`}>
                    {fcuWriteEnabled ? "允许真实下发" : formatFcuFinalDispatchGateSummary(fcuFinalDispatchGate)}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {(fcuExecutionGate?.conditions || []).map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {condition.label || condition.key}
                    </span>
                  ))}
                  {(fcuFinalDispatchGate?.conditions || []).map((condition) => (
                    <span key={`final-${condition.key || condition.label}`} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {condition.label || condition.key}
                    </span>
                  ))}
                </div>
              </div>
              <div className="hvac-terminal-canary-panel is-canary">
                <div>
                  <strong>当前 FCU 逐台控制 · {selectedDeviceCode}</strong>
                  <span>
                    所有 FCU 均可从列表进入此单台页；当前命令只作用于本设备。确认下发仍受当前设备白名单、数据质量、后端总闸和审计保护。
                    现场批量投运首台建议仍为 {canaryDeviceLabel}。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefreshFieldPreflight()}
                  disabled={!selectedDeviceCode || finalStatusRefreshing}
                  title="刷新当前 FCU 的授权、投运闸门、Arm-Check、最终验收和最近记录；不生成新文件，不下发 BA/PLC"
                >
                  <RefreshCw size={14} />
                  {finalStatusRefreshing ? "刷新中" : "刷新开闸预检"}
                </button>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>单台投运窗口 · {selectedDeviceCode}</strong>
                  <span>
                    每台 FCU 都可以生成独立投运窗口、自检报告和反馈监视报告；真实下发仍必须按首台 Canary、反馈确认、小批量、全量的顺序推进。
                  </span>
                  <span>
                    状态：{selectedCanaryWindowStatus}
                    {selectedCanaryWindowOutputName ? ` · ${selectedCanaryWindowOutputName}` : ""}
                  </span>
                  {selectedCanaryWindowCommand ? <code>{selectedCanaryWindowCommand}</code> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateCanaryWindow()}
                  disabled={!selectedDeviceCode || canaryWindowGenerating}
                >
                  <ShieldCheck size={14} />
                  {canaryWindowGenerating ? "生成中" : "生成/刷新投运包"}
                </button>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>现场开闸包 · {selectedDeviceCode}</strong>
                  <span>
                    为当前 FCU 独立生成现场授权、写点白名单、BA 写入门禁、反馈校验、回退触发和验收记录清单；该动作只生成文件，不下发 BA/PLC。
                  </span>
                  <span>
                    状态：{selectedFieldArmPackageStatus}
                    {selectedFieldArmPackageOutputName ? ` · ${selectedFieldArmPackageOutputName}` : ""}
                    {selectedFieldArmPackageReport ? ` · P0 ${selectedFieldArmPackageP0Count}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateFieldArmPackage()}
                  disabled={!selectedDeviceCode || fieldArmPackageGenerating}
                >
                  <ShieldCheck size={14} />
                  {fieldArmPackageGenerating ? "生成中" : "生成开闸包"}
                </button>
              </div>
              <div className={`fcu-authorization-gate-panel${fcuAuthorizationReady ? "" : " is-blocked"}`}>
                <div className="fcu-authorization-gate-head">
                  <div>
                    <strong>3002 现场授权门禁</strong>
                    <span>
                      授权状态来自配置中心；这里只显示是否具备现场开闸条件，不保存、不展示真实确认短语。
                    </span>
                  </div>
                  <span className={`status-pill ${fcuAuthorizationReady ? "good" : fcuFieldAuthorizationTone(fcuFieldAuthorization?.siteAuthorizationStatus)}`}>
                    {fcuAuthorizationReady ? "授权就绪" : "授权未就绪"}
                  </span>
                </div>
                <div className="fcu-authorization-gate-grid">
                  {fcuAuthorizationGateItems.map((item) => (
                    <article key={item.key} className={item.ok ? "tone-good" : "tone-warn"}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.note}</small>
                    </article>
                  ))}
                </div>
                <div className="fcu-authorization-gate-detail">
                  <span>投运负责人：{fcuFieldAuthorization?.commissioningOwner || "未配置"}</span>
                  <span>BA负责人：{fcuFieldAuthorization?.baOwner || "未配置"}</span>
                  {fcuFieldAuthorization?.notes ? <span>{fcuFieldAuthorization.notes}</span> : null}
                </div>
              </div>
              {selectedLiveGateActions.length > 0 ? (
                <div className="fcu-field-arm-actions-panel">
                  <div className="fcu-field-arm-actions-head">
                    <div>
                      <strong>实时开闸动作清单 · {selectedDeviceCode}</strong>
                      <span>
                        来自当前 FCU 开闸预检；按责任角色处理后刷新预检，确认不保存真实确认短语。
                      </span>
                    </div>
                    <span className="status-pill warn">P0 {selectedLiveGateActions.length}</span>
                  </div>
                  <div className="fcu-field-arm-summary">
                    {Object.entries(selectedLiveGateActionSummary).map(([category, count]) => (
                      <span key={category}>
                        <strong>{count}</strong>
                        {category}
                      </span>
                    ))}
                  </div>
                  <div className="fcu-field-arm-checklist">
                    {selectedLiveGateActions.map((item) => (
                      <article key={`live-${item.key}`} className={`tone-${item.tone}`}>
                        <span>
                          {item.category}
                          {item.writesControl ? " · 涉及真实写入" : ""}
                        </span>
                        <strong>{item.label}</strong>
                        <small>{item.owner} · {item.evidence}</small>
                        <em>{item.action}</em>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedFieldArmPackageReport ? (
                <div className="fcu-field-arm-actions-panel">
                  <div className="fcu-field-arm-actions-head">
                    <div>
                      <strong>开闸消缺清单 · {selectedDeviceCode}</strong>
                      <span>
                        按最终控制投运顺序拆解 P0 阻断项；先消除软件/环境和现场授权，再进入 Canary 与反馈验收。
                      </span>
                    </div>
                    <span className="status-pill warn">P0 {selectedFieldArmPackageP0Count}</span>
                  </div>
                  <div className="fcu-field-arm-summary">
                    {Object.entries(selectedFieldArmActionSummary).map(([category, count]) => (
                      <span key={category}>
                        <strong>{count}</strong>
                        {category}
                      </span>
                    ))}
                  </div>
                  <div className="fcu-field-arm-action-grid">
                    {selectedFieldArmBlockerActions.map((item) => (
                      <article key={`blocker-${item.key}`} className={`tone-${item.tone}`}>
                        <span>{item.category}</span>
                        <strong>{item.label}</strong>
                        <small>{item.evidence}</small>
                        <em>{item.action}</em>
                      </article>
                    ))}
                  </div>
                  {selectedFieldArmChecklistActions.length > 0 ? (
                    <div className="fcu-field-arm-checklist">
                      {selectedFieldArmChecklistActions.map((item) => (
                        <article key={`checklist-${item.key}`} className={`tone-${item.tone}`}>
                          <span>
                            {item.category}
                            {item.writesControl ? " · 涉及真实写入" : ""}
                          </span>
                          <strong>{item.label}</strong>
                          <small>{item.owner} · {item.evidence}</small>
                          <em>{item.action}</em>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={`fcu-field-arm-actions-panel${selectedCanaryExecutionPrecheckReady ? "" : " is-blocked"}`}>
                <div className="fcu-field-arm-actions-head">
                  <div>
                    <strong>Canary执行前置锁定 · {selectedDeviceCode}</strong>
                    <span>
                      真实 Canary 执行前必须依次通过 Field Arm、BA 写适配器、Canary 执行包和反馈监视；任一阻断时执行按钮只能返回阻断结果。
                    </span>
                  </div>
                  <span className={`status-pill ${selectedCanaryExecutionPrecheckReady ? "good" : "warn"}`}>
                    {selectedCanaryExecutionPrecheckReady ? "预检通过" : "预检阻断"}
                  </span>
                </div>
                <div className="fcu-field-arm-summary">
                  {selectedCanaryExecutionLockChain.map((item) => (
                    <span key={item.key}>
                      <strong>{item.ok ? "通过" : "阻断"}</strong>
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="fcu-field-arm-checklist">
                  {selectedCanaryExecutionLockChain.map((item) => (
                    <article key={`canary-lock-${item.key}`} className={item.ok ? "tone-good" : "tone-warn"}>
                      <span>{item.label}</span>
                      <strong>{item.verdict}</strong>
                      <small>blockers {item.blockers}</small>
                      <em>{item.ok ? "保持证据" : "未通过前禁止进入 3001 真实 Canary 执行"}</em>
                    </article>
                  ))}
                </div>
                <div className="fcu-field-arm-actions-head">
                  <span>
                    第一阻断：{selectedCanaryExecutionFirstBlocker?.label || "无"} ·{" "}
                    {selectedCanaryExecutionFirstBlocker?.verdict || "全部通过"}。
                    该视图只读取预检证据，不保存确认短语、不下发 BA/PLC。
                  </span>
                </div>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>现场授权 Canary · {selectedDeviceCode}</strong>
                  <span>
                    该入口会请求后端真实 Canary 下发；必须后端非只读、确认短语正确、首台顺序和现场 Arm-Check 全部满足。当前环境会被只读总闸阻断。
                  </span>
                  <span>
                    执行按钮锁定：{selectedCanaryDispatchLocked ? selectedCanaryDispatchLockReason : "前置链已通过，等待确认短语和后端总闸"}。
                  </span>
                  {selectedCanaryDispatch ? (
                    <span>
                      状态：{selectedCanaryDispatch.code || selectedCanaryDispatch.mode || (selectedCanaryDispatch.ok ? "已执行" : "已阻断")}
                      {selectedCanaryDispatch.error ? ` · ${selectedCanaryDispatch.error}` : ""}
                    </span>
                  ) : null}
                  <div className="hvac-terminal-manual-input-row">
                    <input
                      type="password"
                      value={canaryDispatchConfirmText}
                      onChange={(event) => setCanaryDispatchConfirmText(event.target.value)}
                      placeholder="输入真实 BA 写入确认短语"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => void handleExecuteCanaryDispatch()}
                  disabled={!selectedDeviceCode || canaryDispatchRunning || !canaryDispatchConfirmText || selectedCanaryDispatchLocked}
                  title={selectedCanaryDispatchLocked
                    ? `前置链未通过：${selectedCanaryDispatchLockReason}`
                    : "必须输入确认短语；后端仍会检查 read-only、Arm-Check、首台顺序和反馈门禁"}
                >
                  <ShieldCheck size={14} />
                  {canaryDispatchRunning ? "执行中" : "执行 Canary"}
                </button>
              </div>
              <div className="hvac-terminal-manual-control-panel">
                <div className="hvac-terminal-manual-control-head">
                  <strong>单台手动控制</strong>
                  <span>先预演，后确认；命令仍通过白名单、质量门槛、保持时间、审计和回退保护。</span>
                </div>
                <div className="hvac-terminal-manual-control-grid">
                  <article>
                    <span>启停</span>
                    <div className="hvac-terminal-manual-actions">
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("start", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        预演启动
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("start", true)}
                        disabled={!canConfirmManualCommand("start") || manualCommandRunning || manualCommandDispatching}
                      >
                        确认启动
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("stop", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        预演停止
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("stop", true)}
                        disabled={!canConfirmManualCommand("stop") || manualCommandRunning || manualCommandDispatching}
                      >
                        确认停止
                      </button>
                    </div>
                  </article>
                  <article>
                    <label htmlFor="fcu-manual-setpoint">设定温度</label>
                    <div className="hvac-terminal-manual-input-row">
                      <input
                        id="fcu-manual-setpoint"
                        type="number"
                        inputMode="decimal"
                        min={fcuPolicy?.minSetpointC ?? 22}
                        max={fcuPolicy?.maxSetpointC ?? 28}
                        step={fcuPolicy?.setpointStepC ?? 0.5}
                        value={manualSetpointText}
                        onChange={(event) => setManualSetpointText(event.target.value)}
                      />
                      <span>°C</span>
                    </div>
                    <div className="hvac-terminal-manual-actions">
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("setpoint", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        预演设定
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("setpoint", true)}
                        disabled={!canConfirmManualCommand("setpoint") || manualCommandRunning || manualCommandDispatching}
                      >
                        确认设定
                      </button>
                    </div>
                  </article>
                  <article>
                    <label htmlFor="fcu-manual-fan-speed">风速模式</label>
                    <select
                      id="fcu-manual-fan-speed"
                      value={manualFanSpeed}
                      onChange={(event) => setManualFanSpeed(event.target.value)}
                    >
                      <option value="auto">自动</option>
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                    </select>
                    <div className="hvac-terminal-manual-actions">
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("fan_speed", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        预演风速
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("fan_speed", true)}
                        disabled={!canConfirmManualCommand("fan_speed") || manualCommandRunning || manualCommandDispatching}
                      >
                        确认{formatManualFanSpeed(manualFanSpeed)}
                      </button>
                    </div>
                  </article>
                </div>
              </div>
              <div className="fcu-control-inline-queue">
                <strong>最近动作</strong>
                <span>
                  {selectedDeviceLastRecord
                    ? `${formatSampleTime(selectedDeviceLastRecord.createdAt)} · ${formatFcuControlStatus(selectedDeviceLastRecord.status)} · ${selectedDeviceLastRecord.commands?.length ? `${selectedDeviceLastRecord.commands.length}条命令` : selectedDeviceLastRecord.reason || "保持"}`
                    : "暂无单台控制记录；先执行预演单台。"}
                </span>
              </div>
              {selectedDeviceRecords.length > 0 ? (
                <div className="hvac-terminal-trend fcu-control-record-detail">
                  {selectedDeviceRecords.slice(0, 8).map((record) => (
                    <div key={record.recordId || `${record.deviceCode}-${record.createdAt}`} className="hvac-terminal-trend-point">
                      <span>{formatSampleTime(record.createdAt)}</span>
                      <strong>{formatFcuControlStatus(record.status)}</strong>
                      <small>
                        {record.commands?.length ? `${record.commands.length}条命令` : record.reason || "保持"}
                        {record.blockReasons?.length ? ` · ${record.blockReasons[0]}` : ""}
                        {["dispatched", "feedback_pending", "feedback_mismatch_locked"].includes(record.status || "") && record.recordId ? (
                          <button
                            type="button"
                            className="fcu-feedback-check-button"
                            onClick={() => void handleVerifyFeedback(record.recordId)}
                            disabled={feedbackVerifyingId === record.recordId}
                          >
                            {feedbackVerifyingId === record.recordId ? "校验中" : "校验反馈"}
                          </button>
                        ) : null}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
      ) : null}

      {terminalView === "overview" && fanCoilReady ? (
      <section className="section-card hvac-terminal-floor-control-card">
        <header className="section-card-header">
          <div>
            <h3>FCU 逐台控制入口</h3>
            <p className="power-monitor-subtitle">
              {floorName} 每台风机盘管都可进入独立二级控制页；预演、确认下发、反馈校验和开闸包都按单台设备隔离。
            </p>
          </div>
          <div className="section-action">
            <span className="status-pill neutral">{fanCoilItems.length} 台</span>
            <Link to={buildTerminalViewHref("devices")} className="ghost-link-button">
              查看列表
            </Link>
          </div>
        </header>
        <div className="section-card-body">
          <div className="hvac-terminal-floor-control-grid">
            {fanCoilItems.map((item) => {
              const deviceKey = resolveFanCoilDeviceKey(item);
              const commissioningStatus = commissioningByDeviceCode.get(deviceKey);
              const controlEntry = formatFcuControlEntryStatus(commissioningStatus);
              const nodeTone = item.communicationAlarm
                ? "is-warn"
                : item.running
                  ? "is-running"
                  : "is-idle";
              return (
                <Link
                  key={`floor-control-${item.deviceId || item.deviceCode || item.deviceName}`}
                  to={buildFanCoilDeviceHref(item)}
                  className={`hvac-terminal-floor-control-node ${nodeTone}`}
                  title={`${item.deviceName || deviceKey}：进入单台控制页，${controlEntry.label}`}
                >
                  <span className="hvac-terminal-floor-control-temp">
                    {formatNumber(item.zoneTemperatureC, 1)}°C
                  </span>
                  <Fan size={18} aria-hidden="true" />
                  <strong>{item.deviceName || deviceKey || "FCU"}</strong>
                  <small>{deviceKey || "未编码"} · {controlEntry.label}</small>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      ) : null}

      {terminalView === "overview" ? (
      <section className="section-card hvac-terminal-advisor-card">
        <header className="section-card-header">
          <h3>末端节能观察</h3>
          <span className="status-pill neutral">建议值输出</span>
        </header>
        <div className="section-card-body">
          <div className="hvac-terminal-advisor-grid">
            <article>
              <SlidersHorizontal size={18} />
              <strong>{fanCoilReady ? "舒适性约束已可观测" : configEnabled ? "等待末端快照" : "未配置"}</strong>
              <span>{fanCoilReady ? "可用盘管温度、设定值、阀门和通讯状态判断冷站供水温度是否受末端约束。" : configEnabled ? "接入真实点位后再评估末端舒适性和冷站供水温度联动。" : "该项目未接入空调末端，不生成末端节能建议。"}</span>
            </article>
            <article>
              <Gauge size={18} />
              <strong>{fanCoilReady ? "闭环受保护" : configEnabled ? "待实时闭环" : "不参与统计"}</strong>
              <span>{fanCoilReady ? "FCU 命令必须通过白名单、适配器、后端总闸和审计回退；阀门只反馈不直控。" : "接入真实点位后才可评估冷站供水温度、末端阀位和舒适性约束。"}</span>
            </article>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}

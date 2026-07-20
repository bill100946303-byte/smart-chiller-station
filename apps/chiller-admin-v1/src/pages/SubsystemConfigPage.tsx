import { ArrowLeft, History, RefreshCw, RotateCcw, Save, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { getAdminSession } from "../services/adminAuth";
import {
  buildFcuFieldArmPackage,
  getAdminBackendHealth,
  getAdminSite,
  getFcuControlPolicy,
  getFcuFieldRemediationStatus,
  cleanPromoteFcuFieldRemediationSignoff,
  listConfigVersions,
  listPointRoleMappings,
  listSiteSubsystems,
  listSubsystemRegistry,
  previewPointRoleMappingImport,
  previewFcuFieldRemediationSignoff,
  promoteFcuFieldRemediationSignoff,
  publishConfigVersion,
  refreshFcuFieldRemediationStatus,
  rollbackConfigVersion,
  updatePointRoleMappings,
  updateFcuControlPolicy,
  updateSiteSubsystems,
  type AdminControlBoundaryMode,
  type AdminBackendHealth,
  type AdminConfigVersion,
  type AdminFcuControlPolicy,
  type AdminFcuFieldArmPackageResult,
  type AdminFcuFieldRemediationRefreshResult,
  type AdminFcuFieldRemediationStatus,
  type AdminFcuFieldRemediationSignoffPreview,
  type AdminFcuFieldRemediationSignoffPromoteResult,
  type AdminFcuSignoffCleanPromoteResult,
  type AdminPointRoleImportPreview,
  type AdminPointRoleMapping,
  type AdminSiteDetail,
  type AdminSiteSubsystemCapability,
  type AdminSubsystemRegistryItem,
  type AdminSubsystemStatus
} from "../services/adminClient";

const UNKNOWN_BACKEND_HEALTH: AdminBackendHealth = {
  reachable: false,
  ok: false,
  readOnlyMode: null,
  writeAllowed: false,
  checkedAt: "",
  source: "unavailable",
  reason: "正在核验服务端写入总闸。"
};

const STATUS_LABELS: Record<AdminSubsystemStatus, string> = {
  enabled: "配置启用",
  not_configured: "未配置",
  not_applicable: "不适用"
};

const BOUNDARY_LABELS: Record<AdminControlBoundaryMode, string> = {
  read_only: "只读",
  shadow: "影子建议",
  assisted: "人工确认",
  enforced: "闭环执行"
};

function formatAdvisorPluginStatus(value: string): string {
  switch (value) {
    case "available":
      return "可用";
    case "ready":
      return "已就绪";
    case "enabled":
      return "已启用";
    case "disabled":
      return "已停用";
    case "error":
      return "异常";
    case "not_configured":
      return "未配置";
    default:
      return value || "未配置";
  }
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  rolled_back: "已回滚"
};

const FCU_AUTH_STATUS_LABELS: Record<AdminFcuControlPolicy["fieldAuthorization"]["siteAuthorizationStatus"], string> = {
  not_started: "未授权",
  requested: "已申请",
  approved: "已授权",
  revoked: "已撤销"
};

const FCU_SIGNOFF_CSV_HEADER =
  "workOrderId,deviceCode,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes";
const FCU_SIGNOFF_COLUMNS = FCU_SIGNOFF_CSV_HEADER.split(",");
const FCU_SIGNOFF_PROMOTE_CONFIRM = "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT";
const FCU_REASON_LABELS: Record<string, string> = {
  communication_alarm: "通讯报警",
  zero_temperature: "0°C",
  invalid_temperature: "温度无效",
  temperature_quality_guard: "温度质量",
  setpoint_feedback_out_of_bounds: "设定越界",
  missing_write_point: "写点缺失",
  local_manual: "就地手动",
  rollback_lockout: "回退锁定"
};

const FCU_REASON_ACTIONS: Record<string, string> = {
  communication_alarm: "先查控制器供电、通讯线、地址、网关轮询和 BA 报警点，报警未归零前禁止平台控制。",
  zero_temperature: "核对内置温度点与房间实际温度，0°C 原始点恢复前不能进入闭环。",
  invalid_temperature: "复核区域温度点量程、单位和数据源，必须稳定在 5-45°C。",
  temperature_quality_guard: "补齐或修复区域温度质量证据，至少连续两次采样正常。",
  setpoint_feedback_out_of_bounds: "复核设定反馈点，超 10-32°C 的设备需人工确认后按 0.5°C 步长拉回。",
  missing_write_point: "核对启停、设定、风速写点映射和 writable 白名单。",
  local_manual: "确认温控器/面板不在就地手动或禁控状态。",
  rollback_lockout: "等待回退锁定解除并复核上一轮反馈。"
};
const FCU_SIGNOFF_FIELD_LABELS: Record<string, string> = {
  handledBy: "处理人",
  handledAt: "处理时间",
  reviewedBy: "复核人",
  reviewedAt: "复核时间",
  releaseDecision: "放行决定",
  communicationAlarmAfter: "通讯报警复核",
  zoneTemperatureAfterC: "区域温度复核",
  setpointFeedbackAfterC: "设定反馈复核",
  writePointMappingChecked: "写点映射复核",
  twoSampleNormal: "连续两次采样",
  localManualLockout: "就地/手动锁定"
};

type FcuSignoffForm = {
  handledBy: string;
  handledAt: string;
  communicationAlarmAfter: string;
  zoneTemperatureAfterC: string;
  setpointFeedbackAfterC: string;
  writePointMappingChecked: string;
  twoSampleNormal: string;
  localManualLockout: string;
  releaseDecision: string;
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
};

const DEFAULT_FCU_SIGNOFF_FORM: FcuSignoffForm = {
  handledBy: "",
  handledAt: "",
  communicationAlarmAfter: "0",
  zoneTemperatureAfterC: "",
  setpointFeedbackAfterC: "",
  writePointMappingChecked: "yes",
  twoSampleNormal: "yes",
  localManualLockout: "none",
  releaseDecision: "hold",
  reviewedBy: "",
  reviewedAt: "",
  notes: ""
};

const DEFAULT_IMPORT_TEXT_BY_SUBSYSTEM: Record<string, string> = {
  chilled_plant: [
    "冷站总功率,CHP_TOTAL_KW,kW",
    "冷冻水供水温度,CHW_SUP_TEMP,°C",
    "冷冻水回水温度,CHW_RET_TEMP,°C",
    "冷冻水流量,CHW_FLOW,m3/h",
    "冷机运行状态,CHILLER_RUN_STATUS,",
    "冷站设备告警,CHP_ALARM_STATUS,"
  ].join("\n"),
  power_monitoring: [
    "总进线有功功率,P_MAIN_KW,kW",
    "今日总用电,P_TODAY_KWH,kWh",
    "最大需量,P_MAX_DEMAND,kW",
    "功率因数,P_POWER_FACTOR,",
    "馈线一有功功率,P_FEEDER_1_KW,kW"
  ].join("\n"),
  compressed_air: [
    "空压站总功率,AIR_TOTAL_KW,kW",
    "管网压力,AIR_NET_BAR,bar",
    "供气流量,AIR_FLOW_NM3_MIN,Nm3/min",
    "空压机加载状态,AIR_COMP_LOAD_STATUS,",
    "空压站故障报警,AIR_ALARM_STATUS,",
    "干燥机露点,AIR_DRYER_DEW_TEMP,°C",
    "空压单耗,AIR_SPECIFIC_KWH_NM3,kWh/Nm3",
    "空压机启停命令,AIR_COMP_START_CMD,"
  ].join("\n"),
  boiler_room: [
    "锅炉供水温度,BOILER_SUP_TEMP,°C",
    "锅炉回水温度,BOILER_RET_TEMP,°C",
    "锅炉系统压力,BOILER_SYS_MPA,MPa",
    "锅炉运行状态,BOILER_RUN_STATUS,",
    "锅炉故障报警,BOILER_ALARM_STATUS,"
  ].join("\n"),
  hvac_terminal: [
    "办公区平均温度,AHU_ZONE_AVG_TEMP,°C",
    "末端运行状态,AHU_RUN_STATUS,",
    "末端设备告警,AHU_ALARM_STATUS,",
    "供风温度,AHU_SUP_AIR_TEMP,°C"
  ].join("\n")
};

function getDefaultImportText(subsystemType: string): string {
  return DEFAULT_IMPORT_TEXT_BY_SUBSYSTEM[subsystemType] || DEFAULT_IMPORT_TEXT_BY_SUBSYSTEM.chilled_plant;
}

function buildVersionId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const randomSuffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `cfg-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${randomSuffix}`;
}

function cloneSubsystem(item: AdminSiteSubsystemCapability): AdminSiteSubsystemCapability {
  return {
    ...item,
    advisorBindings: [...item.advisorBindings],
    requiredPointRoles: [...item.requiredPointRoles],
    controlBoundary: {
      ...item.controlBoundary
    }
  };
}

function buildFallbackSite(siteId: string): AdminSiteDetail {
  return {
    siteId,
    siteName: siteId,
    status: "active",
    sourceStatus: "partial",
    runtimeStatus: "partial",
    remark: "站点详情暂未进入配置中心台账，子系统配置可先行维护。"
  };
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "--";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatOutputPath(value?: string | null): string {
  if (!value) {
    return "--";
  }
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/") || value;
}

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }
  return rows;
}

function updateFcuSignoffCsvRow(
  csvText: string,
  workOrder: NonNullable<NonNullable<AdminFcuFieldRemediationStatus["workOrders"]>["items"]>[number],
  form: FcuSignoffForm
): string {
  const rows = parseCsvRows(csvText);
  const header = rows[0]?.length ? rows[0] : FCU_SIGNOFF_COLUMNS;
  const outputHeader = Array.from(new Set([...header, ...FCU_SIGNOFF_COLUMNS]));
  const records = rows.slice(1).map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
  const nextRecord: Record<string, string> = {
    workOrderId: workOrder.workOrderId || "",
    deviceCode: workOrder.deviceCode || "",
    handledBy: form.handledBy,
    handledAt: form.handledAt,
    communicationAlarmAfter: form.communicationAlarmAfter,
    zoneTemperatureAfterC: form.zoneTemperatureAfterC,
    setpointFeedbackAfterC: form.setpointFeedbackAfterC,
    writePointMappingChecked: form.writePointMappingChecked,
    twoSampleNormal: form.twoSampleNormal,
    localManualLockout: form.localManualLockout,
    releaseDecision: form.releaseDecision,
    reviewedBy: form.reviewedBy,
    reviewedAt: form.reviewedAt,
    notes: form.notes
  };
  const existingIndex = records.findIndex((record) => record.workOrderId === nextRecord.workOrderId);
  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...nextRecord
    };
  } else {
    records.push(nextRecord);
  }
  return `${[outputHeader, ...records.map((record) => outputHeader.map((column) => record[column] ?? ""))]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}\n`;
}

function updateFcuSignoffCsvRows(
  csvText: string,
  workOrders: NonNullable<NonNullable<AdminFcuFieldRemediationStatus["workOrders"]>["items"]>,
  form: FcuSignoffForm
): string {
  return workOrders.reduce((nextCsv, workOrder) => updateFcuSignoffCsvRow(nextCsv, workOrder, form), csvText);
}

function buildFcuReadinessDraftSignoffForm(
  workOrder: NonNullable<NonNullable<AdminFcuFieldRemediationStatus["workOrders"]>["items"]>[number],
  firstBlockedAction?: string | null
): FcuSignoffForm {
  const reasons = (workOrder.currentEvidence?.reasons || [])
    .map((reason) => FCU_REASON_LABELS[reason] || reason)
    .filter(Boolean);
  const reasonText = reasons.length > 0 ? reasons.join("/") : "待现场核查";
  const firstAction = firstBlockedAction || "按 Readiness 作战表补齐现场签字、实时 closeout、现场授权和 BA 写适配器证据。";
  return {
    ...DEFAULT_FCU_SIGNOFF_FORM,
    communicationAlarmAfter: "",
    zoneTemperatureAfterC: "",
    setpointFeedbackAfterC: "",
    writePointMappingChecked: "",
    twoSampleNormal: "",
    localManualLockout: "",
    releaseDecision: "hold",
    notes: `Readiness现场草稿：${reasonText}；${firstAction}；复核值必须由现场填写，草稿不代表放行。`
  };
}

function isWaitingForRealData(item: AdminSiteSubsystemCapability): boolean {
  return item.status === "enabled" && item.sourceStatus === "waiting_points";
}

function isDemoData(item: AdminSiteSubsystemCapability): boolean {
  return item.status === "enabled" && item.sourceStatus === "demo_data";
}

function isRealtimeReady(item: AdminSiteSubsystemCapability): boolean {
  return item.status === "enabled" && item.sourceStatus === "ok";
}

function formatRealtimeStatus(item: AdminSiteSubsystemCapability): string {
  if (isDemoData(item)) {
    return "演示数据";
  }
  if (isWaitingForRealData(item)) {
    return "实时待接";
  }
  if (isRealtimeReady(item)) {
    return "实时正常";
  }
  if (item.status === "enabled") {
    return "配置启用";
  }
  if (item.status === "not_configured") {
    return "未配置";
  }
  if (item.status === "not_applicable") {
    return "不适用";
  }
  return item.sourceStatus || item.status;
}

function realtimeStatusTone(item: AdminSiteSubsystemCapability): "good" | "warn" | "neutral" {
  if (isDemoData(item)) {
    return "neutral";
  }
  if (isRealtimeReady(item)) {
    return "good";
  }
  if (isWaitingForRealData(item) || item.status === "not_configured") {
    return "warn";
  }
  return "neutral";
}

function validateApprovedFcuAuthorization(policy: AdminFcuControlPolicy | null): string[] {
  if (!policy || policy.fieldAuthorization.siteAuthorizationStatus !== "approved") {
    return [];
  }
  const authorization = policy.fieldAuthorization;
  const missing: string[] = [];
  if (!authorization.siteAuthorizationBy.trim()) {
    missing.push("授权确认人");
  }
  if (!authorization.commissioningOwner.trim()) {
    missing.push("投运负责人");
  }
  if (!authorization.baOwner.trim()) {
    missing.push("BA 负责人");
  }
  if (!authorization.siteAuthorizationWindowStart.trim()) {
    missing.push("授权窗口开始");
  }
  if (!authorization.siteAuthorizationWindowEnd.trim()) {
    missing.push("授权窗口结束");
  }
  const start = Date.parse(authorization.siteAuthorizationWindowStart);
  const end = Date.parse(authorization.siteAuthorizationWindowEnd);
  if (
    authorization.siteAuthorizationWindowStart &&
    authorization.siteAuthorizationWindowEnd &&
    (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
  ) {
    missing.push("授权窗口结束必须晚于开始");
  }
  return missing;
}

function getFcuAuthorizationWindowState(policy: AdminFcuControlPolicy | null): {
  configured: boolean;
  valid: boolean;
  active: boolean;
  label: string;
} {
  const authorization = policy?.fieldAuthorization;
  if (!authorization?.siteAuthorizationWindowStart || !authorization.siteAuthorizationWindowEnd) {
    return {
      configured: false,
      valid: false,
      active: false,
      label: "授权窗口未配置"
    };
  }

  const start = Date.parse(authorization.siteAuthorizationWindowStart);
  const end = Date.parse(authorization.siteAuthorizationWindowEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return {
      configured: true,
      valid: false,
      active: false,
      label: "授权窗口无效"
    };
  }

  const now = Date.now();
  if (now < start) {
    return {
      configured: true,
      valid: true,
      active: false,
      label: `授权窗口未开始（${formatDateTime(authorization.siteAuthorizationWindowStart)}）`
    };
  }
  if (now > end) {
    return {
      configured: true,
      valid: true,
      active: false,
      label: `授权窗口已过期（${formatDateTime(authorization.siteAuthorizationWindowEnd)}）`
    };
  }

  return {
    configured: true,
    valid: true,
    active: true,
    label: "当前处于授权窗口内"
  };
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join("T");
}

export default function SubsystemConfigPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");
  const [backendHealth, setBackendHealth] = useState<AdminBackendHealth>(UNKNOWN_BACKEND_HEALTH);
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [registry, setRegistry] = useState<AdminSubsystemRegistryItem[]>([]);
  const [subsystems, setSubsystems] = useState<AdminSiteSubsystemCapability[]>([]);
  const [mappings, setMappings] = useState<AdminPointRoleMapping[]>([]);
  const [versions, setVersions] = useState<AdminConfigVersion[]>([]);
  const [selectedSubsystem, setSelectedSubsystem] = useState("chilled_plant");
  const [importText, setImportText] = useState(() => getDefaultImportText("chilled_plant"));
  const [preview, setPreview] = useState<AdminPointRoleImportPreview | null>(null);
  const [versionId, setVersionId] = useState(buildVersionId);
  const [fcuPolicy, setFcuPolicy] = useState<AdminFcuControlPolicy | null>(null);
  const [fcuFieldRemediationStatus, setFcuFieldRemediationStatus] = useState<AdminFcuFieldRemediationStatus | null>(null);
  const [fcuSignoffCsvText, setFcuSignoffCsvText] = useState(FCU_SIGNOFF_CSV_HEADER);
  const [fcuSignoffPreview, setFcuSignoffPreview] = useState<AdminFcuFieldRemediationSignoffPreview | null>(null);
  const [fcuSignoffConfirmText, setFcuSignoffConfirmText] = useState("");
  const [fcuSignoffPromoteResult, setFcuSignoffPromoteResult] = useState<AdminFcuFieldRemediationSignoffPromoteResult | null>(null);
  const [fcuSignoffCleanResult, setFcuSignoffCleanResult] = useState<AdminFcuSignoffCleanPromoteResult | null>(null);
  const [fcuFieldRefreshResult, setFcuFieldRefreshResult] = useState<AdminFcuFieldRemediationRefreshResult | null>(null);
  const [fcuCandidateFieldArmResult, setFcuCandidateFieldArmResult] = useState<AdminFcuFieldArmPackageResult | null>(null);
  const [selectedFcuWorkOrderId, setSelectedFcuWorkOrderId] = useState("");
  const [fcuSignoffForm, setFcuSignoffForm] = useState<FcuSignoffForm>(DEFAULT_FCU_SIGNOFF_FORM);
  const [fcuWhitelistText, setFcuWhitelistText] = useState("");

  async function loadData() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    setNotice("");
    try {
      const [siteRecord, registryItems, subsystemItems, mappingItems, versionItems, fcuPolicyRecord, fcuFieldStatus, health] = await Promise.all([
        getAdminSite(session.token, session.userId, siteId).catch(() => buildFallbackSite(siteId)),
        listSubsystemRegistry(session.token, session.userId),
        listSiteSubsystems(session.token, session.userId, siteId),
        listPointRoleMappings(session.token, session.userId, siteId),
        listConfigVersions(session.token, session.userId, siteId),
        getFcuControlPolicy(session.token, session.userId, siteId).catch(() => null),
        getFcuFieldRemediationStatus(session.token, session.userId, siteId).catch(() => null),
        getAdminBackendHealth()
      ]);
      setSite(siteRecord);
      setRegistry(registryItems);
      setSubsystems(subsystemItems.map(cloneSubsystem));
      setMappings(mappingItems);
      setVersions(versionItems);
      const nextSelectedSubsystem = subsystemItems[0]?.subsystemType || "chilled_plant";
      setSelectedSubsystem(nextSelectedSubsystem);
      setImportText(getDefaultImportText(nextSelectedSubsystem));
      setPreview(null);
      setFcuPolicy(fcuPolicyRecord);
      setFcuFieldRemediationStatus(fcuFieldStatus);
      setBackendHealth(health);
      setFcuSignoffPreview(null);
      setFcuCandidateFieldArmResult(null);
      setFcuWhitelistText((fcuPolicyRecord?.whitelist || []).join("\n"));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "子系统配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId]);

  const summary = useMemo(() => {
    const activeSubsystems = subsystems.filter((item) => item.status === "enabled" && !item.reserved);
    const configEnabled = activeSubsystems.length;
    const realtimeReady = activeSubsystems.filter(isRealtimeReady).length;
    const demoData = activeSubsystems.filter(isDemoData).length;
    const waitingRealData = activeSubsystems.filter(isWaitingForRealData).length;
    const configurable = subsystems.filter((item) => !item.reserved).length;
    const reserved = subsystems.filter((item) => item.reserved).length;
    const avgProgress = activeSubsystems.length
      ? Math.round(activeSubsystems.reduce((sum, item) => sum + item.pointMappingProgress, 0) / activeSubsystems.length)
      : 0;
    return {
      configEnabled,
      realtimeReady,
      demoData,
      waitingRealData,
      configurable,
      reserved,
      avgProgress
    };
  }, [subsystems]);

  const selectedMappings = mappings.filter((item) => item.subsystemType === selectedSubsystem);
  const configurableSubsystems = useMemo(() => subsystems.filter((item) => !item.reserved), [subsystems]);
  const reservedSubsystems = useMemo(() => subsystems.filter((item) => item.reserved), [subsystems]);
  const selectedRegistry = registry.find((item) => item.subsystemType === selectedSubsystem);
  const selectedMappedRoles = new Set(selectedMappings.map((item) => item.pointRole));
  const selectedRoleCoverage = (selectedRegistry?.pointRoles || []).map((role) => ({
    ...role,
    mapped: selectedMappedRoles.has(role.role),
    required: role.required !== false
  }));
  const previewItems = (preview?.items || [])
    .slice(0, 12)
    .sort((left, right) => Number(right.warnings.length > 0) - Number(left.warnings.length > 0) || left.rowNumber - right.rowNumber);
  const hasDemoSubsystems = summary.demoData > 0;
  const hvacTerminal = subsystems.find((item) => item.subsystemType === "hvac_terminal") || null;
  const showFcuPolicy = hvacTerminal?.status === "enabled" && fcuPolicy !== null;
  const fcuWriteConfigured =
    hvacTerminal?.controlBoundary?.writeEnabled === true &&
    fcuPolicy?.enabled === true &&
    fcuPolicy.defaultMode === "enforced" &&
    Boolean(fcuPolicy.dispatchAdapter && fcuPolicy.dispatchAdapter !== "none");
  const globalWriteGateOpen =
    runtimeConfig.readOnlyMode !== true &&
    backendHealth.writeAllowed === true;
  const fcuEffectiveWriteEnabled = fcuWriteConfigured && globalWriteGateOpen;
  const fcuWriteBlockedByGlobalGate = fcuWriteConfigured && !globalWriteGateOpen;
  const fcuFieldSummary = fcuFieldRemediationStatus?.summary || null;
  const fcuFieldBlockers = fcuFieldRemediationStatus?.finalControlGates?.blockers || [];
  const fcuFieldNextActions = fcuFieldRemediationStatus?.finalControlGates?.nextActions || [];
  const fcuFieldWorkOrders = fcuFieldRemediationStatus?.workOrders?.items || [];
  const fcuReasonGroups = useMemo(() => {
    const groups = new Map<string, typeof fcuFieldWorkOrders>();
    for (const item of fcuFieldWorkOrders) {
      for (const reason of item.currentEvidence?.reasons || []) {
        const current = groups.get(reason) || [];
        groups.set(reason, [...current, item]);
      }
    }
    const priority = [
      "communication_alarm",
      "zero_temperature",
      "invalid_temperature",
      "temperature_quality_guard",
      "setpoint_feedback_out_of_bounds",
      "missing_write_point",
      "local_manual",
      "rollback_lockout"
    ];
    return Array.from(groups.entries())
      .map(([reason, items]) => ({
        reason,
        label: FCU_REASON_LABELS[reason] || reason,
        action: FCU_REASON_ACTIONS[reason] || "按现场消缺工单处理并复核连续采样。",
        items,
        deviceCodes: items.map((item) => item.deviceCode || item.deviceName || item.workOrderId || "--").filter(Boolean)
      }))
      .sort((left, right) => {
        const leftRank = priority.indexOf(left.reason);
        const rightRank = priority.indexOf(right.reason);
        return (leftRank < 0 ? 999 : leftRank) - (rightRank < 0 ? 999 : rightRank) || right.items.length - left.items.length;
      });
  }, [fcuFieldWorkOrders]);
  const fcuPrimaryReason = fcuReasonGroups[0] || null;
  const selectedFcuWorkOrder =
    fcuFieldWorkOrders.find((item) => item.workOrderId === selectedFcuWorkOrderId) || fcuFieldWorkOrders[0] || null;
  const fcuExecutionOrder = fcuFieldRemediationStatus?.executionPack?.executionOrder || [];
  const fcuFieldHandoff = fcuFieldRemediationStatus?.handoff || null;
  const fcuFieldHandoffSummary = fcuFieldHandoff?.summary || null;
  const fcuFieldHandoffOutputs = fcuFieldHandoff?.outputFiles || null;
  const fcuFieldPlaybook = fcuFieldRemediationStatus?.fieldRemediationPlaybook || null;
  const fcuFieldPlaybookDevices = fcuFieldPlaybook?.devices || [];
  const fcuFieldPlaybookReasonGroups = fcuFieldPlaybook?.reasonGroups || [];
  const fcuCanaryReadiness = fcuFieldRemediationStatus?.canaryReadiness || null;
  const fcuCanaryReadinessPlaybook = fcuCanaryReadiness?.readinessPlaybook || null;
  const fcuCanaryReadinessPhasePlan = fcuCanaryReadinessPlaybook?.phasePlan || [];
  const fcuFinalFieldExecutionPack = fcuFieldRemediationStatus?.finalControlFieldExecutionPack || null;
  const fcuFinalFieldExecutionPackSummary = fcuFinalFieldExecutionPack?.summary || null;
  const fcuFinalFieldExecutionPackOutputs = fcuFinalFieldExecutionPack?.outputFiles || null;
  const fcuReturnTemplate = fcuFieldRemediationStatus?.returnTemplate || null;
  const fcuReturnTemplateSummary = fcuReturnTemplate?.summary || null;
  const fcuReturnTemplateOutputs = fcuReturnTemplate?.outputs || null;
  const fcuHandoffStaleRows = fcuFieldHandoffSummary?.staleSignoffRows ?? null;
  const fcuSignoffReady = fcuFieldSummary?.signoffComplete === true;
  const fcuFinalGatePassed = fcuFieldSummary?.finalGatePassed === true;
  const fcuSignoffPreviewSummary = fcuSignoffPreview?.summary || null;
  const fcuIgnoredRows =
    fcuSignoffCleanResult?.signoff?.summary && "ignoredRows" in fcuSignoffCleanResult.signoff.summary
      ? Number(fcuSignoffCleanResult.signoff.summary.ignoredRows)
      : fcuFieldRemediationStatus?.signoff?.summary && "ignoredRows" in fcuFieldRemediationStatus.signoff.summary
        ? Number(fcuFieldRemediationStatus.signoff.summary.ignoredRows)
        : null;
  const fcuSignoffPreviewOpenRecords = (fcuSignoffPreview?.records || []).filter((item) => item.signoffComplete !== true);
  const fcuSignoffPreviewReadyRows = (fcuSignoffPreview?.records || []).filter((item) => item.signoffComplete === true);
  const fcuSignoffReleaseMatrix = fcuSignoffPreview?.releaseMatrix || fcuFieldRemediationStatus?.signoff?.releaseMatrix || [];
  const fcuOnsiteReleasePrecheck =
    fcuSignoffPreview?.onsiteReleasePrecheck ||
    fcuFieldRemediationStatus?.signoff?.onsiteReleasePrecheck ||
    null;
  const fcuCanaryReadyRows = fcuSignoffReleaseMatrix.filter((item) => item.canEnterCanary === true);
  const fcuOnsiteCanaryCandidateRows = fcuSignoffReleaseMatrix.filter((item) => item.onsiteCanaryCandidate === true && item.canEnterCanary !== true);
  const fcuCanaryBlockedRows = fcuSignoffReleaseMatrix.filter((item) => item.canEnterCanary !== true);
  const fcuFirstCanaryCandidate = fcuCanaryReadyRows[0] || null;
  const fcuFirstOnsiteCanaryCandidate = fcuFirstCanaryCandidate || fcuOnsiteCanaryCandidateRows[0] || null;
  const fcuCanaryBlockReasons = useMemo(() => {
    const groups = new Map<string, { reason: string; count: number; devices: string[] }>();
    for (const item of fcuCanaryBlockedRows) {
      const reason = item.canaryBlockReason || "unknown";
      const current = groups.get(reason) || { reason, count: 0, devices: [] };
      current.count += 1;
      current.devices.push(item.deviceCode || item.deviceName || item.workOrderId || "--");
      groups.set(reason, current);
    }
    return Array.from(groups.values()).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  }, [fcuCanaryBlockedRows]);
  const fcuSignoffReleaseRows = useMemo(() => {
    return [...fcuSignoffReleaseMatrix]
      .sort((left, right) => {
        const leftBlocked = left.canEnterCanary === true ? 2 : left.onsiteCanaryCandidate === true ? 1 : 0;
        const rightBlocked = right.canEnterCanary === true ? 2 : right.onsiteCanaryCandidate === true ? 1 : 0;
        return rightBlocked - leftBlocked || (left.deviceCode || left.deviceName || "").localeCompare(right.deviceCode || right.deviceName || "", "zh-CN");
      })
      .map((item) => {
        const missingFields = item.missingFields || [];
        const nextActions = item.nextActions || [];
        return {
          ...item,
          statusLabel: item.canEnterCanary ? "可进 Canary" : item.onsiteCanaryCandidate ? "现场候选/待预检" : item.signoffComplete ? "签字完成/待后续门禁" : "签字缺项",
          statusClass: item.canEnterCanary ? "is-ready" : item.onsiteCanaryCandidate ? "is-pending" : "is-blocked",
          missingText: missingFields.length > 0
            ? missingFields.map((field) => FCU_SIGNOFF_FIELD_LABELS[field] || field).slice(0, 4).join(" / ")
            : item.canaryBlockReason || "--",
          nextAction: nextActions[0] || item.verificationTarget || item.canaryBlockReason || "补齐现场字段后重新校验签字 CSV。"
        };
      });
  }, [fcuSignoffReleaseMatrix]);
  const fcuSignoffActionQueue = useMemo(() => {
    const openByWorkOrder = new Map(fcuSignoffPreviewOpenRecords.map((item) => [item.workOrderId || item.deviceCode || item.deviceName || "", item]));
    const precheckByWorkOrder = new Map((fcuOnsiteReleasePrecheck?.devices || []).map((item) => [item.workOrderId || item.deviceCode || item.deviceName || "", item]));
    return fcuSignoffReleaseRows
      .map((item) => {
        const key = item.workOrderId || item.deviceCode || item.deviceName || "";
        const openRecord = openByWorkOrder.get(key);
        const precheck = precheckByWorkOrder.get(key);
        const missingChecklist = openRecord?.missingChecklist || [];
        const missingFields =
          missingChecklist.map((entry) => FCU_SIGNOFF_FIELD_LABELS[entry.field || ""] || entry.field || "签核缺项") ||
          [];
        const blockingFields =
          missingFields.length > 0
            ? missingFields
            : (precheck?.nextBlockingFields || item.missingFields || []).map((field) => FCU_SIGNOFF_FIELD_LABELS[field] || field);
        const priority = item.canEnterCanary
          ? 30
          : item.onsiteCanaryCandidate
            ? 25
          : item.signoffComplete
            ? 20
            : blockingFields.length > 0
              ? 0
              : 10;
        return {
          ...item,
          priority,
          blockingFields,
          onsiteReleaseReady: precheck?.onsiteReleaseReady === true,
          onsiteCanaryCandidate: item.onsiteCanaryCandidate === true || precheck?.onsiteCanaryCandidate === true,
          onsiteNextAction: precheck?.nextAction || "",
          firstChecklistAction: missingChecklist[0]?.action || "",
          rowHref: item.workOrderId ? `/sites/${encodeURIComponent(siteId)}/subsystems/fcu/${encodeURIComponent(item.workOrderId)}` : ""
        };
      })
      .sort((left, right) =>
        left.priority - right.priority ||
        (left.deviceCode || left.deviceName || left.workOrderId || "").localeCompare(
          right.deviceCode || right.deviceName || right.workOrderId || "",
          "zh-CN"
        )
      );
  }, [fcuOnsiteReleasePrecheck?.devices, fcuSignoffPreviewOpenRecords, fcuSignoffReleaseRows, siteId]);
  const fcuFieldExecutionProgress = useMemo(() => {
    const total = fcuSignoffActionQueue.length;
    const canaryReady = fcuSignoffActionQueue.filter((item) => item.canEnterCanary === true).length;
    const onsiteCandidates = fcuSignoffActionQueue.filter((item) => item.onsiteCanaryCandidate === true && item.canEnterCanary !== true).length;
    const signoffComplete = fcuSignoffActionQueue.filter((item) => item.signoffComplete === true).length;
    const blocked = Math.max(0, total - canaryReady);
    const percent = total > 0 ? Math.round((canaryReady / total) * 100) : 0;
    const firstPending = fcuSignoffActionQueue.find((item) => item.canEnterCanary !== true) || fcuSignoffActionQueue[0] || null;
    return {
      total,
      canaryReady,
      onsiteCandidates,
      signoffComplete,
      blocked,
      percent,
      firstPending
    };
  }, [fcuSignoffActionQueue]);
  const fcuSignoffHasPreviewBlockingIssues =
    !fcuSignoffPreview ||
    fcuSignoffPreviewOpenRecords.length > 0 ||
    (fcuSignoffPreviewSummary?.missingColumns || []).length > 0 ||
    (fcuSignoffPreviewSummary?.missingWorkOrders || []).length > 0;
  const fcuSignoffPersistLocked = fcuSignoffHasPreviewBlockingIssues || fcuSignoffConfirmText !== FCU_SIGNOFF_PROMOTE_CONFIRM;
  const fcuSignoffIssueGroups = useMemo(() => {
    const groups = new Map<string, { field: string; label: string; count: number; devices: string[]; action?: string }>();
    for (const record of fcuSignoffPreviewOpenRecords) {
      for (const item of record.missingChecklist || []) {
        const field = item.field || item.issue || "unknown";
        const current = groups.get(field) || {
          field,
          label: FCU_SIGNOFF_FIELD_LABELS[field] || field,
          count: 0,
          devices: [],
          action: item.action
        };
        current.count += 1;
        current.devices.push(record.deviceCode || record.deviceName || record.workOrderId || "--");
        if (!current.action && item.action) {
          current.action = item.action;
        }
        groups.set(field, current);
      }
    }
    return Array.from(groups.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"));
  }, [fcuSignoffPreviewOpenRecords]);
  const fcuCandidateAutoLink = useMemo(() => {
    if (fcuFirstCanaryCandidate || fcuFirstOnsiteCanaryCandidate) {
      const candidate = fcuFirstCanaryCandidate || fcuFirstOnsiteCanaryCandidate;
      return {
        ready: true,
        title: `已联动${fcuFirstCanaryCandidate ? "Canary 候选" : "现场候选"} ${candidate?.deviceName || candidate?.deviceCode || candidate?.workOrderId}`,
        detail: fcuFirstCanaryCandidate
          ? "可直接生成候选预检包；仍只生成证据，不执行真实 BA 写入。"
          : "现场签核已完整，可生成 Field Arm / Canary 预检包；未通过后续门禁前禁止真实下发。"
      };
    }
    const firstIssue = fcuSignoffIssueGroups[0];
    const firstBlock = fcuCanaryBlockReasons[0];
    return {
      ready: false,
      title: "暂无可联动候选",
      detail: firstIssue
        ? `先补 ${firstIssue.label}：${firstIssue.devices.slice(0, 4).join(" / ")}`
        : firstBlock
          ? `先处理 ${firstBlock.reason}：${firstBlock.devices.slice(0, 4).join(" / ")}`
          : "先校验签字 CSV，或补齐现场签字和实时 closeout。"
    };
  }, [fcuCanaryBlockReasons, fcuFirstCanaryCandidate, fcuFirstOnsiteCanaryCandidate, fcuSignoffIssueGroups]);
  const fcuSignoffPromoteSummary = fcuSignoffPromoteResult?.signoff?.summary as
    | {
        completeRows?: number;
        expectedWorkOrders?: number;
        signoffComplete?: boolean;
      }
    | null
    | undefined;
  const fcuSignoffPromoteRefreshChain = fcuSignoffPromoteResult
    ? [
        {
          key: "signoff",
          label: "签字校验",
          ok: fcuSignoffPromoteResult.signoff?.ok === true,
          detail: `${fcuSignoffPromoteSummary?.completeRows ?? 0}/${fcuSignoffPromoteSummary?.expectedWorkOrders ?? 0}`
        },
        {
          key: "final-gates",
          label: "最终门禁",
          ok: fcuSignoffPromoteResult.finalControlGates?.ok === true,
          detail: `${fcuSignoffPromoteResult.finalControlGates?.summary?.passed ?? 0}/${fcuSignoffPromoteResult.finalControlGates?.summary?.gateCount ?? 8}`
        },
        {
          key: "runbook",
          label: "Runbook",
          ok: fcuSignoffPromoteResult.finalControlRunbook?.ok === true,
          detail: fcuSignoffPromoteResult.finalControlRunbook?.verdict || "--"
        },
        {
          key: "consistency",
          label: "证据一致性",
          ok: fcuSignoffPromoteResult.evidenceConsistency?.ok === true,
          detail: fcuSignoffPromoteResult.evidenceConsistency?.verdict || "--"
        }
      ]
    : [];
  const fcuCandidatePrecheckChain = fcuCandidateFieldArmResult
    ? [
        {
          key: "field-arm",
          label: "Field Arm",
          ok: fcuCandidateFieldArmResult.fieldArmPackage?.ok === true,
          verdict: fcuCandidateFieldArmResult.fieldArmPackage?.verdict || "--",
          blockers: fcuCandidateFieldArmResult.fieldArmPackage?.blockers?.length ?? 0
        },
        {
          key: "ba-adapter",
          label: "BA 写适配器",
          ok: fcuCandidateFieldArmResult.baWriteAdapterReadiness?.ok === true,
          verdict: fcuCandidateFieldArmResult.baWriteAdapterReadiness?.verdict || "--",
          blockers: fcuCandidateFieldArmResult.baWriteAdapterReadiness?.blockingItems?.length ?? 0
        },
        {
          key: "canary-package",
          label: "Canary 执行包",
          ok: fcuCandidateFieldArmResult.canaryExecutionPackage?.ok === true,
          verdict: fcuCandidateFieldArmResult.canaryExecutionPackage?.verdict || "--",
          blockers: fcuCandidateFieldArmResult.canaryExecutionPackage?.blockers?.length ?? 0
        },
        {
          key: "feedback-monitor",
          label: "反馈监视",
          ok: fcuCandidateFieldArmResult.canaryFeedbackMonitor?.ok === true,
          verdict: fcuCandidateFieldArmResult.canaryFeedbackMonitor?.verdict || "--",
          blockers: fcuCandidateFieldArmResult.canaryFeedbackMonitor?.blockers?.length ?? 0
        }
      ]
    : [];
  const fcuFinalDispatchReady = fcuFinalGatePassed && fcuFieldSummary?.canaryReady === true;
  const fcuFinalReleaseChecklist = [
    {
      key: "signoff",
      label: "现场签核",
      ok: fcuSignoffReady,
      detail: `${fcuFieldSummary?.signoffCompleteRows ?? 0}/${fcuFieldSummary?.signoffExpectedRows ?? 0}`,
      action: fcuSignoffReady ? "保持签核证据，继续 closeout。" : "按现场执行模式逐台补齐签核。"
    },
    {
      key: "closeout",
      label: "实时 closeout",
      ok: (fcuFieldSummary?.openP0Devices || 0) === 0,
      detail: `P0 ${fcuFieldSummary?.openP0Devices ?? "--"} 台`,
      action: (fcuFieldSummary?.openP0Devices || 0) === 0 ? "P0 已清零，继续 Canary readiness。" : "关闭所有 P0 消缺后重跑 closeout。"
    },
    {
      key: "canary-readiness",
      label: "Canary readiness",
      ok: fcuFieldSummary?.canaryReady === true,
      detail: fcuCanaryReadiness?.verdict || "readiness 待读取",
      action: fcuFieldSummary?.canaryReady === true ? "可以进入候选预检包。" : fcuCanaryReadinessPlaybook?.firstBlockedAction || "重跑 Canary readiness。"
    },
    {
      key: "field-arm",
      label: "Field Arm",
      ok: fcuCandidateFieldArmResult?.fieldArmPackage?.ok === true,
      detail: fcuCandidateFieldArmResult?.fieldArmPackage?.verdict || "未生成候选预检包",
      action: fcuCandidateFieldArmResult?.fieldArmPackage?.ok === true ? "保持现场授权证据。" : "生成候选预检包并处理 Field Arm 阻断。"
    },
    {
      key: "ba-adapter",
      label: "BA 写适配器",
      ok: fcuCandidateFieldArmResult?.baWriteAdapterReadiness?.ok === true,
      detail: fcuCandidateFieldArmResult?.baWriteAdapterReadiness?.verdict || "未校验",
      action: fcuCandidateFieldArmResult?.baWriteAdapterReadiness?.ok === true ? "写适配器就绪。" : "核对写点白名单、确认短语和 BA 适配器。"
    },
    {
      key: "feedback-monitor",
      label: "反馈监视",
      ok: fcuCandidateFieldArmResult?.canaryFeedbackMonitor?.ok === true,
      detail: fcuCandidateFieldArmResult?.canaryFeedbackMonitor?.feedbackStatus || fcuCandidateFieldArmResult?.canaryFeedbackMonitor?.verdict || "待真实 Canary 后确认",
      action: fcuCandidateFieldArmResult?.canaryFeedbackMonitor?.ok === true ? "反馈监视通过。" : "首台 Canary 后必须确认反馈和回退链。"
    },
    {
      key: "final-gate",
      label: "最终总门禁",
      ok: fcuFinalDispatchReady,
      detail: `${fcuFieldSummary?.finalGatePassedCount ?? 0}/${fcuFieldSummary?.finalGateCount ?? 0}`,
      action: fcuFinalDispatchReady ? "允许进入最终写入窗口。" : "总门禁未全绿，3001 继续锁定真实下发。"
    }
  ];
  const fcuFinalReleaseReadyCount = fcuFinalReleaseChecklist.filter((item) => item.ok).length;
  const fcuFinalReleaseFirstBlocker = fcuFinalReleaseChecklist.find((item) => !item.ok) || null;
  const fcuAuthorizationSaveIssues = useMemo(() => validateApprovedFcuAuthorization(fcuPolicy), [fcuPolicy]);
  const fcuAuthorizationWindowState = useMemo(() => getFcuAuthorizationWindowState(fcuPolicy), [fcuPolicy]);
  const fcuAuthorizationGateIssues = useMemo(() => {
    if (!fcuPolicy || fcuPolicy.fieldAuthorization.siteAuthorizationStatus !== "approved") {
      return [];
    }
    const issues = [...fcuAuthorizationSaveIssues];
    if (issues.length === 0 && !fcuAuthorizationWindowState.active) {
      issues.push(fcuAuthorizationWindowState.label);
    }
    if (!fcuPolicy.fieldAuthorization.baWriteConfirmArmed) {
      issues.push("BA 写入确认短语未装载");
    }
    if (!fcuPolicy.fieldAuthorization.finalRolloutConfirmArmed) {
      issues.push("最终控制总确认短语未装载");
    }
    return issues;
  }, [fcuAuthorizationSaveIssues, fcuAuthorizationWindowState, fcuPolicy]);
  const fcuAuthorizationReady = fcuPolicy
    ? fcuPolicy.fieldAuthorization.siteAuthorizationStatus === "approved" &&
      fcuPolicy.fieldAuthorization.baWriteConfirmArmed &&
      fcuPolicy.fieldAuthorization.finalRolloutConfirmArmed &&
      fcuAuthorizationSaveIssues.length === 0 &&
      fcuAuthorizationWindowState.active
    : false;
  const fcuFinalDispatchGateIssues = [
    ...(fcuFinalGatePassed ? [] : ["最终控制总门禁未通过"]),
    ...(fcuFieldSummary?.canaryReady === true ? [] : ["Canary 未放行"]),
    ...(fcuSignoffReady ? [] : ["现场签字未完成"]),
    ...((fcuFieldSummary?.openP0Devices || 0) > 0 ? [`P0 消缺未关闭 ${fcuFieldSummary?.openP0Devices} 台`] : [])
  ];

  useEffect(() => {
    if (!selectedFcuWorkOrderId && fcuFieldWorkOrders[0]?.workOrderId) {
      setSelectedFcuWorkOrderId(fcuFieldWorkOrders[0].workOrderId);
    }
  }, [fcuFieldWorkOrders, selectedFcuWorkOrderId]);

  useEffect(() => {
    if (!selectedFcuWorkOrder) {
      return;
    }
    setFcuSignoffForm((current) => ({
      ...current,
      handledBy: selectedFcuWorkOrder.signoff?.handledBy || current.handledBy,
      handledAt: selectedFcuWorkOrder.signoff?.handledAt || current.handledAt,
      reviewedBy: selectedFcuWorkOrder.signoff?.reviewedBy || current.reviewedBy,
      reviewedAt: selectedFcuWorkOrder.signoff?.reviewedAt || current.reviewedAt,
      notes: selectedFcuWorkOrder.signoff?.notes || current.notes
    }));
  }, [selectedFcuWorkOrder]);

  function patchSubsystem(subsystemType: string, patch: Partial<AdminSiteSubsystemCapability>) {
    setSubsystems((current) =>
      current.map((item) => {
        if (item.subsystemType !== subsystemType) {
          return item;
        }
        const nextStatus = patch.status || item.status;
        return {
          ...item,
          ...patch,
          enabled: nextStatus === "enabled",
          kpis: nextStatus === "enabled" ? item.kpis : [],
          alarmCount: nextStatus === "enabled" ? item.alarmCount || 0 : null,
          advisorBindings: nextStatus === "enabled" ? item.advisorBindings : [],
          controlBoundary: patch.controlBoundary
            ? {
                ...item.controlBoundary,
                ...patch.controlBoundary
              }
            : item.controlBoundary
        };
      })
    );
  }

  function handleSelectedSubsystemChange(subsystemType: string) {
    setSelectedSubsystem(subsystemType);
    setImportText(getDefaultImportText(subsystemType));
    setPreview(null);
    setNotice("");
  }

  function patchFcuPolicy(patch: Partial<AdminFcuControlPolicy>) {
    setFcuPolicy((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        ...patch
      };
    });
  }

  function patchFcuFieldAuthorization(patch: Partial<AdminFcuControlPolicy["fieldAuthorization"]>) {
    setFcuPolicy((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        fieldAuthorization: {
          ...current.fieldAuthorization,
          ...patch
        }
      };
    });
  }

  function handleFillFcuAuthorizationDraft() {
    if (!fcuPolicy) {
      return;
    }
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 55 * 60 * 1000);
    patchFcuFieldAuthorization({
      siteAuthorizationStatus: "approved",
      siteAuthorizationBy: fcuPolicy.fieldAuthorization.siteAuthorizationBy || "业主值班长",
      commissioningOwner: fcuPolicy.fieldAuthorization.commissioningOwner || "平台工程师",
      baOwner: fcuPolicy.fieldAuthorization.baOwner || "BA工程师",
      siteAuthorizationWindowStart: toDateTimeLocalValue(windowStart),
      siteAuthorizationWindowEnd: toDateTimeLocalValue(windowEnd),
      baWriteConfirmArmed: true,
      finalRolloutConfirmArmed: true,
      notes:
        fcuPolicy.fieldAuthorization.notes ||
        "现场一小时值守授权草稿；真实 BA 写入仍需 3001 单台确认、后端非只读、Arm-Check 和反馈校验。"
    });
    setNotice("已填入 FCU 现场授权草稿；请核对授权人、负责人和窗口后再保存。");
    setErrorText("");
  }

  function handleRevokeFcuAuthorizationDraft() {
    if (!fcuPolicy) {
      return;
    }
    patchFcuFieldAuthorization({
      siteAuthorizationStatus: "revoked",
      baWriteConfirmArmed: false,
      finalRolloutConfirmArmed: false,
      notes: fcuPolicy.fieldAuthorization.notes || "现场授权已撤销；禁止 3001 真实确认下发。"
    });
    setNotice("已撤销 FCU 授权草稿；保存后 3001 真实下发门禁保持关闭。");
    setErrorText("");
  }

  async function handleSaveFcuPolicy() {
    if (!session || !siteId || !fcuPolicy || saving) {
      return;
    }
    const authorizationIssues = validateApprovedFcuAuthorization(fcuPolicy);
    if (authorizationIssues.length > 0) {
      setErrorText(`FCU 已授权状态不能保存：请补齐 ${authorizationIssues.join("、")}。`);
      setNotice("");
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const whitelist = fcuWhitelistText
        .split(/\r?\n|,|，/)
        .map((item) => item.trim())
        .filter(Boolean);
      const updated = await updateFcuControlPolicy(session.token, session.userId, siteId, {
        ...fcuPolicy,
        whitelist
      });
      setFcuPolicy(updated);
      setFcuWhitelistText(updated.whitelist.join("\n"));
      setNotice("FCU 控制策略已保存；闭环执行仍需现场 BA 写适配器和逐台 commissioning。");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存 FCU 控制策略失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewFcuSignoff() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await previewFcuFieldRemediationSignoff(session.token, session.userId, siteId, fcuSignoffCsvText);
      setFcuSignoffPreview(result);
      const completeRows = result.summary?.completeRows ?? 0;
      const expectedRows = result.summary?.expectedWorkOrders ?? 0;
      setNotice(`FCU 签字预览完成：${completeRows}/${expectedRows} 行通过；未保存 CSV，未下发 BA/PLC。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 签字预览失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePromoteFcuSignoff() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await promoteFcuFieldRemediationSignoff(
        session.token,
        session.userId,
        siteId,
        fcuSignoffCsvText,
        fcuSignoffConfirmText
      );
      setFcuSignoffPromoteResult(result);
      if (result.preview) {
        setFcuSignoffPreview(result.preview);
      }
      if (result.refreshedStatus) {
        setFcuFieldRemediationStatus(result.refreshedStatus);
      } else {
        setFcuFieldRemediationStatus(await getFcuFieldRemediationStatus(session.token, session.userId, siteId));
      }
      const completeRows = result.signoff?.summary && "completeRows" in result.signoff.summary
        ? Number(result.signoff.summary.completeRows)
        : 0;
      const expectedRows = result.signoff?.summary && "expectedWorkOrders" in result.signoff.summary
        ? Number(result.signoff.summary.expectedWorkOrders)
        : 0;
      const gatePassed = result.finalControlGates?.ok === true;
      setNotice(
        `FCU 签字 CSV 已保存：${Number.isFinite(completeRows) ? completeRows : 0}/${Number.isFinite(expectedRows) ? expectedRows : 0} 行通过；总门禁${gatePassed ? "已通过" : "仍阻断"}，未下发 BA/PLC。`
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 签字 CSV 保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleCleanPromoteFcuSignoff() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await cleanPromoteFcuFieldRemediationSignoff(session.token, session.userId, siteId, fcuSignoffConfirmText);
      setFcuSignoffCleanResult(result);
      if (result.refreshedStatus) {
        setFcuFieldRemediationStatus(result.refreshedStatus);
      }
      const staleRows = result.clean?.summary?.staleRows ?? 0;
      const ignoredRows = result.signoff?.summary && "ignoredRows" in result.signoff.summary
        ? Number(result.signoff.summary.ignoredRows)
        : 0;
      setNotice(`FCU 签字旧行已清理：移除 ${staleRows} 行；当前 ignoredRows=${Number.isFinite(ignoredRows) ? ignoredRows : 0}。未下发 BA/PLC。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 签字旧行清理失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshFcuFieldStatus() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await refreshFcuFieldRemediationStatus(session.token, session.userId, siteId);
      setFcuFieldRefreshResult(result);
      if (result.status) {
        setFcuFieldRemediationStatus(result.status);
      }
      const passed = result.status?.summary?.finalGatePassedCount ?? 0;
      const total = result.status?.summary?.finalGateCount ?? 0;
      setNotice(`FCU 最终门禁已刷新：${passed}/${total} 项通过；未下发 BA/PLC。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 最终门禁刷新失败");
    } finally {
      setSaving(false);
    }
  }

  function patchFcuSignoffForm(patch: Partial<FcuSignoffForm>) {
    setFcuSignoffForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function handleSelectFcuWorkOrder(workOrderId: string) {
    setSelectedFcuWorkOrderId(workOrderId);
    setFcuSignoffPreview(null);
    setFcuSignoffPromoteResult(null);
    setNotice("");
  }

  function handleBuildFcuSignoffCsvRow() {
    if (!selectedFcuWorkOrder) {
      setErrorText("请先选择一条 FCU 现场工单。");
      setNotice("");
      return;
    }
    setFcuSignoffCsvText((current) => updateFcuSignoffCsvRow(current, selectedFcuWorkOrder, fcuSignoffForm));
    setFcuSignoffPreview(null);
    setFcuSignoffPromoteResult(null);
    setErrorText("");
    setNotice(`已生成 ${selectedFcuWorkOrder.deviceName || selectedFcuWorkOrder.deviceCode || selectedFcuWorkOrder.workOrderId} 的签字 CSV 行；请继续校验后再保存。`);
  }

  function handleBuildFcuSignoffBatchTemplate() {
    if (fcuFieldWorkOrders.length === 0) {
      setErrorText("暂无 FCU 现场工单，不能生成批量模板。");
      setNotice("");
      return;
    }
    const templateForm: FcuSignoffForm = {
      ...DEFAULT_FCU_SIGNOFF_FORM,
      communicationAlarmAfter: "",
      writePointMappingChecked: "",
      twoSampleNormal: "",
      localManualLockout: "",
      releaseDecision: "hold"
    };
    setFcuSignoffCsvText(updateFcuSignoffCsvRows(FCU_SIGNOFF_CSV_HEADER, fcuFieldWorkOrders, templateForm));
    setFcuSignoffPreview(null);
    setFcuSignoffPromoteResult(null);
    setErrorText("");
    setNotice(`已生成 ${fcuFieldWorkOrders.length} 台 FCU 的现场回填模板；请填写处理/复核信息后校验。`);
  }

  function handleBuildFcuReadinessDraftSignoffRows() {
    if (fcuFieldWorkOrders.length === 0) {
      setErrorText("暂无 FCU 现场工单，不能按 Readiness 生成草稿。");
      setNotice("");
      return;
    }
    const firstBlockedAction = fcuCanaryReadinessPlaybook?.firstBlockedAction || null;
    const nextCsv = fcuFieldWorkOrders.reduce(
      (csv, workOrder) => updateFcuSignoffCsvRow(csv, workOrder, buildFcuReadinessDraftSignoffForm(workOrder, firstBlockedAction)),
      FCU_SIGNOFF_CSV_HEADER
    );
    setFcuSignoffCsvText(nextCsv);
    setFcuSignoffPreview(null);
    setFcuSignoffPromoteResult(null);
    setErrorText("");
    setNotice(`已按 Readiness 作战表生成 ${fcuFieldWorkOrders.length} 台 FCU 现场签字草稿；复核值保持空白/hold，必须现场填写后再校验保存。`);
  }

  function handleBuildFcuSignoffBatchRows() {
    if (fcuFieldWorkOrders.length === 0) {
      setErrorText("暂无 FCU 现场工单，不能批量生成签字行。");
      setNotice("");
      return;
    }
    setFcuSignoffCsvText((current) => updateFcuSignoffCsvRows(current, fcuFieldWorkOrders, fcuSignoffForm));
    setFcuSignoffPreview(null);
    setFcuSignoffPromoteResult(null);
    setErrorText("");
    setNotice(`已按当前表单批量生成 ${fcuFieldWorkOrders.length} 台 FCU 签字行；保存前仍需校验 CSV 和输入确认短语。`);
  }

  async function handleBuildCandidateFieldArmPackage() {
    if (!session || !siteId || saving) {
      return;
    }
    const candidate = fcuFirstCanaryCandidate || fcuFirstOnsiteCanaryCandidate;
    const deviceCode = candidate?.deviceCode;
    if (!deviceCode) {
      setErrorText("当前没有可进入预检的 FCU 候选，不能生成开闸预检包。");
      setNotice("");
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await buildFcuFieldArmPackage(session.token, session.userId, siteId, deviceCode);
      setFcuCandidateFieldArmResult(result);
      if (result.refreshedStatus) {
        setFcuFieldRemediationStatus(result.refreshedStatus);
      }
      setNotice(`已生成 ${candidate?.deviceName || deviceCode} 的 Field Arm / Canary 预检包；未下发 BA/PLC。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "生成候选 FCU 预检包失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSubsystems() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const updated = await updateSiteSubsystems(session.token, session.userId, siteId, subsystems);
      setSubsystems(updated.map(cloneSubsystem));
      setNotice("子系统能力已保存，3001 运行端仍只读取已发布配置。");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存子系统配置失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewImport() {
    if (!session || !siteId) {
      return;
    }
    setErrorText("");
    setNotice("");
    try {
      const result = await previewPointRoleMappingImport(session.token, session.userId, siteId, {
        subsystemType: selectedSubsystem,
        text: importText
      });
      setPreview(result);
      setNotice("点位表已完成预览，当前未写入控制点。");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "点位表预览失败");
    }
  }

  async function handleSavePreviewMappings() {
    if (!session || !siteId || !preview || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const accepted = preview.items
        .filter((item) => item.warnings.length === 0)
        .map((item) => ({
          subsystemType: item.subsystemType,
          pointRole: item.pointRole,
          pointName: item.pointName,
          pointCode: item.pointCode,
          unit: item.unit,
          dataType: item.dataType,
          required: item.required,
          writable: false,
          source: "import_preview"
        }));
      const updated = await updatePointRoleMappings(session.token, session.userId, siteId, {
        subsystemType: selectedSubsystem,
        items: accepted
      });
      setMappings((current) => [
        ...current.filter((item) => item.subsystemType !== selectedSubsystem),
        ...updated
      ]);
      setNotice("已保存为点位角色映射；仍不会启用真实控制写点。");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存点位角色映射失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!session || !siteId || saving) {
      return;
    }
    const publishedVersionId = versionId.trim();
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      await publishConfigVersion(session.token, session.userId, siteId, publishedVersionId, "能源站配置中心发布");
      setVersions(await listConfigVersions(session.token, session.userId, siteId));
      setVersionId(buildVersionId());
      setNotice(`配置版本 ${publishedVersionId} 已发布，3001 将消费已发布能力。已生成下一次发布的新版本号。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "配置发布失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRollback() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      await rollbackConfigVersion(session.token, session.userId, siteId, versionId);
      await loadData();
      setNotice(`配置版本 ${versionId} 已回滚，请刷新确认当前能力。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "配置回滚失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="能源站子系统配置"
        headingLevel={2}
        action={
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
              <ArrowLeft size={14} />
              返回详情
            </button>
            <button className="admin-button" type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        }
      >
        <div className="admin-section-stack">
          <div className="admin-chip-row">
            <StatusPill label={site?.siteName || siteId} tone="good" />
            <StatusPill
              label={fcuEffectiveWriteEnabled
                ? "FCU 写入总闸已放行"
                : fcuWriteBlockedByGlobalGate
                  ? "FCU 闭环配置 · 总闸阻断"
                  : "只读 / 影子"}
              tone={fcuEffectiveWriteEnabled || fcuWriteBlockedByGlobalGate ? "warn" : "neutral"}
            />
            <StatusPill label="3001 消费已发布配置" tone="neutral" />
          </div>
          <p className="admin-note">
            当前配置中心管理子系统能力、点位角色、建议器插件和控制边界；配置启用不等于真实实时接入。FCU 写控制仅对白名单单台设备开放，并受 BA 适配器、审计和回退保护。
          </p>
          {fcuWriteBlockedByGlobalGate ? (
            <p className="admin-warning-note" data-fcu-global-write-gate="blocked">
              当前 FCU 保存的是闭环配置意图，但运行时写入总闸仍关闭：{backendHealth.reason} 这里不得显示为“闭环可写”。
            </p>
          ) : null}
          {hasDemoSubsystems ? (
            <p className="admin-warning-note">
              当前站点包含演示数据子系统，不代表真实现场接入；建议器只输出只读建议，不允许写 PLC 或呈现为可执行控制。
            </p>
          ) : null}
        </div>
      </SectionCard>

      <div className="admin-summary-grid">
        <StatCard title="配置启用子系统" value={String(summary.configEnabled)} delta={`${summary.realtimeReady} 个实时正常 / ${summary.demoData} 个演示数据 / ${summary.waitingRealData} 个实时待接`} tone="good" />
        <StatCard title="平均映射进度" value={`${summary.avgProgress}%`} delta="点位角色" tone={summary.avgProgress >= 60 ? "good" : "warn"} />
        <StatCard title="预留扩展" value={String(summary.reserved)} delta="预留子系统" tone="neutral" />
        <StatCard
          title="当前边界"
          value={fcuEffectiveWriteEnabled ? "FCU闭环可写" : fcuWriteBlockedByGlobalGate ? "全局只读" : "只读/影子"}
          delta={fcuEffectiveWriteEnabled
            ? `${fcuPolicy?.whitelist.length || 0} 台白名单 / ${fcuPolicy?.dispatchAdapter}`
            : fcuWriteBlockedByGlobalGate
              ? "闭环配置仅为配置态 / BFF总闸未放行"
              : "不写 PLC"}
          tone={fcuEffectiveWriteEnabled || fcuWriteBlockedByGlobalGate ? "warn" : "neutral"}
        />
      </div>

      {errorText ? <p className="admin-error">{errorText}</p> : null}
      {notice ? <p className="admin-success">{notice}</p> : null}

      {showFcuPolicy && fcuFieldRemediationStatus ? (
        <SectionCard
          title="FCU 现场消缺与签字闭环"
          action={
            <button className="admin-button" type="button" onClick={() => void handleRefreshFcuFieldStatus()} disabled={saving}>
              <RefreshCw size={14} />
              刷新 FCU 门禁
            </button>
          }
        >
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill
                label={fcuFinalGatePassed ? "总门禁通过" : "总门禁阻断"}
                tone={fcuFinalGatePassed ? "good" : "warn"}
              />
              <StatusPill
                label={`P0 ${fcuFieldSummary?.openP0Devices ?? "--"} 台`}
                tone={(fcuFieldSummary?.openP0Devices || 0) > 0 ? "warn" : "good"}
              />
              <StatusPill
                label={`签字 ${fcuFieldSummary?.signoffCompleteRows ?? "--"}/${fcuFieldSummary?.signoffExpectedRows ?? "--"}`}
                tone={fcuSignoffReady ? "good" : "warn"}
              />
              <StatusPill
                label={fcuFieldSummary?.canaryReady ? "Canary 就绪" : "Canary 阻断"}
                tone={fcuFieldSummary?.canaryReady ? "good" : "warn"}
              />
            </div>
            <p className="admin-warning-note">
              现场消缺和签字是 FCU 真实闭环的前置条件；即使 3002 授权已批准，未关闭 P0、未完成签字、总门禁未通过时，3001 仍禁止真实下发。
            </p>
            {fcuFieldHandoff ? (
              <div className="admin-fcu-priority-panel">
                <div>
                  <span>现场交接包</span>
                  <strong>
                    P0 {fcuFieldHandoffSummary?.openP0Devices ?? "--"} 台 · 过期签核 {fcuFieldHandoffSummary?.staleSignoffRows ?? "--"} 行
                  </strong>
                  <p>{fcuFieldHandoffSummary?.nextAllowedStep || fcuFieldHandoff.conclusion || "按现场交接包执行消缺、签字和复核。"}</p>
                </div>
                <div className="admin-fcu-priority-devices">
                  {(fcuFieldHandoff.devices || []).slice(0, 8).map((item) => (
                    <span key={item.workOrderId || item.deviceCode || item.deviceName}>
                      {item.deviceCode || item.deviceName || item.workOrderId}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {fcuFieldHandoffOutputs ? (
              <div className="admin-fcu-output-grid">
                <div>
                  <span>交接包 CSV</span>
                  <strong>{formatOutputPath(fcuFieldHandoffOutputs.csv || undefined)}</strong>
                  <p>给现场逐台处理 P0、填写复核结果和签字字段。</p>
                </div>
                <div>
                  <span>current-only 签核表</span>
                  <strong>{formatOutputPath(fcuFieldHandoffOutputs.currentOnlyCsv || fcuFieldHandoffOutputs.signoffInputCsv || undefined)}</strong>
                  <p>优先使用当前有效工单，避免过期行继续参与放行判断。</p>
                </div>
                <div>
                  <span>交接包 Markdown</span>
                  <strong>{formatOutputPath(fcuFieldHandoffOutputs.markdown || undefined)}</strong>
                  <p>适合发给 BA/自控、现场值班和调试负责人。</p>
                </div>
              </div>
            ) : null}
            {fcuFieldPlaybook?.deviceCount ? (
              <>
                <div className="admin-fcu-priority-panel">
                  <div>
                    <span>现场消缺作战表</span>
                    <strong>
                      待处理 {fcuFieldPlaybook.deviceCount ?? "--"} 台 · 首台 {fcuFieldPlaybook.firstCanary || "BGS01"} ·{" "}
                      Canary {fcuFieldPlaybook.canaryBlockedByField ? "现场阻断" : "现场已放行"}
                    </strong>
                    <p>
                      {(fcuFieldPlaybook.recommendedOrder || []).slice(0, 3).join("；") ||
                        "先恢复通讯，再复核温度和设定反馈，最后补齐写点映射、连续采样和双人签核。"}
                    </p>
                  </div>
                  <div className="admin-fcu-priority-devices">
                    {fcuFieldPlaybookDevices.slice(0, 8).map((item) => (
                      <span key={item.workOrderId || item.deviceCode || item.deviceName}>
                        {item.deviceCode || item.deviceName || item.workOrderId}
                      </span>
                    ))}
                  </div>
                </div>
                {fcuFieldPlaybookReasonGroups.length > 0 ? (
                  <div className="admin-fcu-reason-grid">
                    {fcuFieldPlaybookReasonGroups.slice(0, 5).map((group) => (
                      <div className="admin-fcu-reason-card" key={group.reason}>
                        <div>
                          <span>{FCU_REASON_LABELS[group.reason || ""] || group.reason || "现场阻断"}</span>
                          <strong>{(group.devices || []).length} 台</strong>
                        </div>
                        <p>{FCU_REASON_ACTIONS[group.reason || ""] || "按现场消缺作战表处理并回填签核字段。"}</p>
                        <small>{(group.devices || []).slice(0, 8).join(" / ") || "--"}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
                {fcuFieldPlaybookDevices.length > 0 ? (
                  <div className="admin-fcu-signoff-preview">
                    {fcuFieldPlaybookDevices.slice(0, 4).map((item) => (
                      <div className="admin-fcu-auth-check is-blocked" key={item.workOrderId || item.deviceCode || item.deviceName}>
                        <strong>{item.deviceCode || item.deviceName || item.workOrderId} · {item.deviceName || "FCU"}</strong>
                        <span>{(item.reasonLabels || item.reasons || []).slice(0, 4).join(" / ") || "待现场复核"}</span>
                        <span>{(item.fieldPriority || []).join(" -> ") || "按作战表消缺并回填签核。"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {fcuReturnTemplateOutputs ? (
              <div className="admin-fcu-output-grid">
                <div>
                  <span>现场回填模板 CSV</span>
                  <strong>{formatOutputPath(fcuReturnTemplateOutputs.csv)}</strong>
	                  <p>
	                    {fcuReturnTemplateSummary?.deviceCount ?? "--"} 台待回填；
	                    通讯 {fcuReturnTemplateSummary?.communicationBlocked ?? "--"}，
	                    温度 {fcuReturnTemplateSummary?.temperatureBlocked ?? "--"}，
	                    设定 {fcuReturnTemplateSummary?.setpointBlocked ?? "--"}。
	                  </p>
	                  <p>
	                    可参考草稿 {fcuReturnTemplateSummary?.draftSuggestibleDevices ?? "--"} 台；
	                    温度 {fcuReturnTemplateSummary?.draftTemperatureSuggestions ?? "--"}，
	                    设定 {fcuReturnTemplateSummary?.draftSetpointSuggestions ?? "--"}。
	                  </p>
                </div>
                <div>
                  <span>回填模板 Markdown</span>
                  <strong>{formatOutputPath(fcuReturnTemplateOutputs.markdown)}</strong>
                  <p>逐台列出当前异常、必填值、放行验收和回填后必须重跑的门禁。</p>
                </div>
                <div>
	                  <span>回填模板 JSON</span>
	                  <strong>{formatOutputPath(fcuReturnTemplateOutputs.json)}</strong>
	                  <p>3002 用于展示现场回填状态；reviewDraft 只作现场复核参考，不自动 release、不产生 BA/PLC 写入。</p>
	                </div>
              </div>
            ) : null}
            {fcuHandoffStaleRows !== null && fcuHandoffStaleRows > 0 ? (
              <div className="admin-fcu-auth-check is-blocked">
                <strong>现场交接包发现过期签核行：{fcuHandoffStaleRows} 行</strong>
                <span>
                  先清理过期行并切换到 current-only 签核表；旧行不允许参与 Canary 或最终控制放行。
                </span>
                <div className="admin-action-row">
                  <button
                    className="admin-button"
                    type="button"
                    onClick={() => void handleCleanPromoteFcuSignoff()}
                    disabled={saving || fcuSignoffConfirmText !== FCU_SIGNOFF_PROMOTE_CONFIRM}
                  >
                    清理过期签核行
                  </button>
                  <span className="admin-inline-note">
                    需要先输入保存确认短语；该动作只备份并替换签核输入 CSV，不下发 BA/PLC。
                  </span>
                </div>
              </div>
            ) : null}
            {fcuPrimaryReason ? (
              <div className="admin-fcu-priority-panel">
                <div>
                  <span>当前优先处理</span>
                  <strong>{fcuPrimaryReason.label} · {fcuPrimaryReason.items.length} 台</strong>
                  <p>{fcuPrimaryReason.action}</p>
                </div>
                <div className="admin-fcu-priority-devices">
                  {fcuPrimaryReason.deviceCodes.slice(0, 8).map((deviceCode) => (
                    <span key={deviceCode}>{deviceCode}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {fcuReasonGroups.length > 0 ? (
              <div className="admin-fcu-reason-grid">
                {fcuReasonGroups.slice(0, 5).map((group) => (
                  <div className="admin-fcu-reason-card" key={group.reason}>
                    <div>
                      <span>{group.label}</span>
                      <strong>{group.items.length} 台</strong>
                    </div>
                    <p>{group.action}</p>
                    <small>{group.deviceCodes.slice(0, 6).join(" / ")}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {fcuFieldRemediationStatus.executionPack?.outputs ? (
              <div className="admin-fcu-output-grid">
                <div>
                  <span>现场核查表 CSV</span>
                  <strong>{formatOutputPath(fcuFieldRemediationStatus.executionPack.outputs.csv)}</strong>
                  <p>逐台列出通讯、温度、设定反馈、签字字段和放行口径。</p>
                </div>
                <div>
                  <span>执行包 Markdown</span>
                  <strong>{formatOutputPath(fcuFieldRemediationStatus.executionPack.outputs.markdown)}</strong>
                  <p>适合发给 BA/自控和现场值班人员按步骤执行。</p>
                </div>
                <div>
                  <span>执行包 JSON</span>
                  <strong>{formatOutputPath(fcuFieldRemediationStatus.executionPack.outputs.json)}</strong>
                  <p>3002/脚本验收使用的结构化证据。</p>
                </div>
              </div>
            ) : null}
            {fcuExecutionOrder.length > 0 ? (
              <div className="admin-table-scroll" role="region" aria-label="FCU 执行顺序表，可横向滚动查看更多字段" tabIndex={0}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>阶段</th>
                      <th>设备数</th>
                      <th>设备</th>
                      <th>验收口径</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fcuExecutionOrder.map((item) => (
                      <tr key={item.phase || item.acceptance}>
                        <td>{item.phase || "--"}</td>
                        <td>{item.deviceCount ?? "--"}</td>
                        <td>{(item.deviceCodes || []).slice(0, 8).join(" / ") || "--"}</td>
                        <td>{item.acceptance || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {fcuFinalFieldExecutionPack ? (
              <div className={`admin-fcu-auth-check ${fcuFinalFieldExecutionPack.ok ? "is-ready" : "is-blocked"}`}>
                <strong>
                  最终控制现场执行包：
                  {fcuFinalFieldExecutionPackSummary?.finalReleaseChecklistReady ?? 0}/
                  {fcuFinalFieldExecutionPackSummary?.finalReleaseChecklistTotal ?? 0} 项通过
                </strong>
                <span>
                  待放行 {fcuFinalFieldExecutionPackSummary?.openDevices ?? "--"}/
                  {fcuFinalFieldExecutionPackSummary?.totalDevices ?? "--"} 台；
                  Canary 就绪 {fcuFinalFieldExecutionPackSummary?.canaryReadyDevices ?? "--"} 台；
                  第一阻断 {fcuFinalFieldExecutionPackSummary?.firstBlocker || "--"}。
                </span>
                <span>
                  下一步：{fcuFinalFieldExecutionPackSummary?.nextAction || "按现场签核、实时 closeout、Canary readiness、最终总门禁顺序处理。"}
                </span>
                <span>
                  安全边界：controlMutation={fcuFinalFieldExecutionPack.controlMutation ? "true" : "false"}；
                  dispatch={fcuFinalFieldExecutionPack.dispatch ? "true" : "false"}；本页不调用 control-cycle、control-command 或 Canary dispatch。
                </span>
              </div>
            ) : null}
            {fcuFinalFieldExecutionPackOutputs ? (
              <div className="admin-fcu-output-grid">
                <div>
                  <span>最终执行 CSV</span>
                  <strong>{formatOutputPath(fcuFinalFieldExecutionPackOutputs.csv)}</strong>
                  <p>按设备顺序列出最终控制前的现场放行、Canary 阻断和回填字段。</p>
                </div>
                <div>
                  <span>最终执行 Markdown</span>
                  <strong>{formatOutputPath(fcuFinalFieldExecutionPackOutputs.markdown)}</strong>
                  <p>给现场、BA 和平台工程师共同核对的最终控制执行清单。</p>
                </div>
                <div>
                  <span>最终执行 JSON</span>
                  <strong>{formatOutputPath(fcuFinalFieldExecutionPackOutputs.json)}</strong>
                  <p>3002 用于验收和状态汇总的结构化证据。</p>
                </div>
              </div>
            ) : null}
            {(fcuFinalFieldExecutionPack?.finalReleaseChecklist || []).length > 0 ? (
              <div className="admin-table-scroll" role="region" aria-label="FCU 最终放行检查表，可横向滚动查看更多字段" tabIndex={0}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>最终放行项</th>
                      <th>状态</th>
                      <th>细节</th>
                      <th>下一步</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fcuFinalFieldExecutionPack?.finalReleaseChecklist || []).map((item) => (
                      <tr key={item.key || item.label}>
                        <td>{item.label || item.key || "--"}</td>
                        <td>{item.ok ? "通过" : "阻断"}</td>
                        <td>{item.detail || "--"}</td>
                        <td>{item.action || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {(fcuFinalFieldExecutionPack?.deviceQueue || []).length > 0 ? (
              <div className="admin-table-scroll" role="region" aria-label="FCU 设备队列表，可横向滚动查看更多字段" tabIndex={0}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>顺序</th>
                      <th>设备</th>
                      <th>Canary</th>
                      <th>阻断/缺项</th>
                      <th>今日动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fcuFinalFieldExecutionPack?.deviceQueue || []).slice(0, 10).map((item) => (
                      <tr key={item.workOrderId || item.deviceCode}>
                        <td>{item.sequence ?? "--"}</td>
                        <td>{item.deviceCode || "--"} {item.deviceName || ""}</td>
                        <td>{item.canEnterCanary ? "可进 Canary" : item.canaryBlockReason || "阻断"}</td>
                        <td>
                          {(item.reasons || []).slice(0, 3).join(" / ") ||
                            (item.missingFields || []).slice(0, 3).join(" / ") ||
                            "--"}
                        </td>
                        <td>{item.todayAction || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {fcuFieldRefreshResult ? (
              <div className={`admin-fcu-auth-check ${fcuFieldRefreshResult.status?.summary?.finalGatePassed ? "is-ready" : "is-blocked"}`}>
                <strong>
                  门禁刷新：{fcuFieldRefreshResult.status?.summary?.finalGatePassedCount ?? 0}/
                  {fcuFieldRefreshResult.status?.summary?.finalGateCount ?? 0} 项通过
                </strong>
                <span>
                  脚本 {fcuFieldRefreshResult.scripts?.finalControlGates?.accepted ? "已完成" : "失败"}；
                  Canary {fcuFieldRefreshResult.status?.summary?.canaryReady ? "就绪" : "阻断"}；
                  BA/PLC 写入 {fcuFieldRefreshResult.controlMutation ? "存在" : "无"}。
                </span>
              </div>
            ) : null}
            <div className="admin-metric-grid">
              <StatCard
                title="现场工单"
                value={`${fcuFieldSummary?.openWorkOrders ?? "--"}`}
                delta={`总数 ${fcuFieldSummary?.totalWorkOrders ?? "--"}`}
                tone={(fcuFieldSummary?.openWorkOrders || 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                title="总门禁"
                value={`${fcuFieldSummary?.finalGatePassedCount ?? 0}/${fcuFieldSummary?.finalGateCount ?? 0}`}
                delta="通过/总数"
                tone={fcuFinalGatePassed ? "good" : "warn"}
              />
              <StatCard
                title="签字放行"
                value={fcuSignoffReady ? "完成" : "未完成"}
                delta="release matrix"
                tone={fcuSignoffReady ? "good" : "warn"}
              />
            </div>
            {fcuFieldBlockers.length > 0 ? (
              <div className="admin-fcu-auth-check is-blocked">
                <strong>当前阻断</strong>
                <span>
                  {fcuFieldBlockers.slice(0, 4).map((item) => `${item.label || "门禁"} ${item.value || item.blocker || ""}`).join(" / ")}
                </span>
              </div>
            ) : null}
            <div className="admin-table-scroll" role="region" aria-label="FCU 现场放行状态表，可横向滚动查看更多字段" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>工单</th>
                    <th>设备</th>
                    <th>优先级</th>
                    <th>原因</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {fcuFieldWorkOrders.map((item) => (
                    <tr key={item.workOrderId || item.deviceCode}>
                      <td>{item.workOrderId || "--"}</td>
                      <td>{item.deviceName || item.deviceCode || "--"}</td>
                      <td>{item.priority || "P0"}</td>
                      <td>
                        <div className="admin-fcu-reason-tags">
                          {(item.currentEvidence?.reasons || []).slice(0, 3).map((reason) => (
                            <span key={reason}>{FCU_REASON_LABELS[reason] || reason}</span>
                          ))}
                        </div>
                      </td>
                      <td>{item.status || "open"}</td>
                      <td>
                        <button
                          className="admin-button"
                          type="button"
                          onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/subsystems/fcu/${encodeURIComponent(item.workOrderId || "")}`)}
                          disabled={!item.workOrderId}
                        >
                          处理
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fcuFieldWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6}>暂无现场工单证据；请先刷新最终控制验收包。</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {fcuFieldWorkOrders.length > 0 ? (
              <div className="admin-fcu-signoff-preview">
                <div className="admin-fcu-remediation-foot">
                  <span>逐台工单填报会生成或更新下方 CSV 中对应设备的一行。</span>
                  <span>生成行不等于保存，仍需校验签字 CSV、输入确认短语并保存。</span>
                </div>
                <div className="admin-form-grid">
                  <label className="admin-field-block">
                    <span>选择 FCU 工单</span>
                    <select value={selectedFcuWorkOrder?.workOrderId || ""} onChange={(event) => handleSelectFcuWorkOrder(event.target.value)}>
                      {fcuFieldWorkOrders.map((item) => (
                        <option key={item.workOrderId || item.deviceCode} value={item.workOrderId || ""}>
                          {item.deviceName || item.deviceCode || item.workOrderId} · {item.workOrderId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>处理人</span>
                    <input value={fcuSignoffForm.handledBy} onChange={(event) => patchFcuSignoffForm({ handledBy: event.target.value })} />
                  </label>
                  <label className="admin-field-block">
                    <span>处理时间</span>
                    <input type="datetime-local" value={fcuSignoffForm.handledAt} onChange={(event) => patchFcuSignoffForm({ handledAt: event.target.value })} />
                  </label>
                  <label className="admin-field-block">
                    <span>通讯报警复核</span>
                    <select
                      value={fcuSignoffForm.communicationAlarmAfter}
                      onChange={(event) => patchFcuSignoffForm({ communicationAlarmAfter: event.target.value })}
                    >
                      <option value="0">0 - 已恢复</option>
                      <option value="1">1 - 仍报警</option>
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>区域温度复核 °C</span>
                    <input value={fcuSignoffForm.zoneTemperatureAfterC} onChange={(event) => patchFcuSignoffForm({ zoneTemperatureAfterC: event.target.value })} placeholder="5-45" />
                  </label>
                  <label className="admin-field-block">
                    <span>设定反馈复核 °C</span>
                    <input value={fcuSignoffForm.setpointFeedbackAfterC} onChange={(event) => patchFcuSignoffForm({ setpointFeedbackAfterC: event.target.value })} placeholder="10-32，可留空" />
                  </label>
                  <label className="admin-field-block">
                    <span>写点映射复核</span>
                    <select
                      value={fcuSignoffForm.writePointMappingChecked}
                      onChange={(event) => patchFcuSignoffForm({ writePointMappingChecked: event.target.value })}
                    >
                      <option value="yes">yes - 已复核</option>
                      <option value="no">no - 未复核</option>
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>连续两次采样</span>
                    <select value={fcuSignoffForm.twoSampleNormal} onChange={(event) => patchFcuSignoffForm({ twoSampleNormal: event.target.value })}>
                      <option value="yes">yes - 正常</option>
                      <option value="no">no - 不正常</option>
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>就地/手动锁定</span>
                    <select value={fcuSignoffForm.localManualLockout} onChange={(event) => patchFcuSignoffForm({ localManualLockout: event.target.value })}>
                      <option value="none">none - 无锁定</option>
                      <option value="manual">manual - 手动优先</option>
                      <option value="lockout">lockout - 禁控</option>
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>放行决定</span>
                    <select value={fcuSignoffForm.releaseDecision} onChange={(event) => patchFcuSignoffForm({ releaseDecision: event.target.value })}>
                      <option value="hold">hold - 继续阻断</option>
                      <option value="recheck">recheck - 需复核</option>
                      <option value="release">release - 允许进入后续门禁</option>
                    </select>
                  </label>
                  <label className="admin-field-block">
                    <span>复核人</span>
                    <input value={fcuSignoffForm.reviewedBy} onChange={(event) => patchFcuSignoffForm({ reviewedBy: event.target.value })} />
                  </label>
                  <label className="admin-field-block">
                    <span>复核时间</span>
                    <input type="datetime-local" value={fcuSignoffForm.reviewedAt} onChange={(event) => patchFcuSignoffForm({ reviewedAt: event.target.value })} />
                  </label>
                  <label className="admin-field-block is-full">
                    <span>备注</span>
                    <input value={fcuSignoffForm.notes} onChange={(event) => patchFcuSignoffForm({ notes: event.target.value })} placeholder="例如：现场复位通讯后连续两次采样正常" />
                  </label>
                </div>
                {selectedFcuWorkOrder ? (
                  <div className="admin-fcu-auth-check is-blocked">
                    <strong>{selectedFcuWorkOrder.deviceName || selectedFcuWorkOrder.deviceCode} 当前证据</strong>
                    <span>
                      通讯报警 {selectedFcuWorkOrder.currentEvidence?.communicationAlarm === true ? "1" : selectedFcuWorkOrder.currentEvidence?.communicationAlarm === false ? "0" : "--"}；
                      温度 {selectedFcuWorkOrder.currentEvidence?.zoneTemperatureC ?? "--"}°C；
                      设定反馈 {selectedFcuWorkOrder.currentEvidence?.setpointC ?? "--"}°C；
                      原因 {(selectedFcuWorkOrder.currentEvidence?.reasons || []).slice(0, 4).join(" / ") || "--"}。
                    </span>
                  </div>
                ) : null}
                <div className="admin-action-row">
                  <button className="admin-button" type="button" onClick={() => patchFcuSignoffForm({ handledAt: toDateTimeLocalValue(new Date()) })}>
                    填入处理时间
                  </button>
                  <button className="admin-button" type="button" onClick={() => patchFcuSignoffForm({ reviewedAt: toDateTimeLocalValue(new Date()) })}>
                    填入复核时间
                  </button>
                  <button className="admin-button is-primary" type="button" onClick={handleBuildFcuSignoffCsvRow}>
                    生成/更新本台签字行
                  </button>
                </div>
              </div>
            ) : null}
            <div className="admin-fcu-remediation-foot">
              <span>
                执行阶段：{fcuExecutionOrder.slice(0, 4).map((item) => `${item.phase || "--"}(${item.deviceCount ?? "--"})`).join(" / ") || "待读取"}
              </span>
              <span>
                下一步：{fcuFieldNextActions.slice(0, 2).map((item) => `${item.priority || "P1"} ${item.action || item.phase || "--"}`).join(" / ") || "补齐现场证据后重跑总门禁"}
              </span>
            </div>
            <div className="admin-fcu-signoff-preview">
              <div className="admin-fcu-remediation-foot">
                <span>签字 CSV 预览只做格式和放行字段校验，不保存现场文件。</span>
                <span>全部通过后仍需重跑实时质量、closeout 和总门禁。</span>
              </div>
              <div className="admin-action-row">
                <button className="admin-button" type="button" onClick={handleBuildFcuSignoffBatchTemplate} disabled={saving || fcuFieldWorkOrders.length === 0}>
                  生成全部回填模板
                </button>
                <button className="admin-button" type="button" onClick={handleBuildFcuReadinessDraftSignoffRows} disabled={saving || fcuFieldWorkOrders.length === 0}>
                  按 Readiness 生成现场草稿
                </button>
                <button className="admin-button" type="button" onClick={handleBuildFcuSignoffBatchRows} disabled={saving || fcuFieldWorkOrders.length === 0}>
                  批量套用当前复核值
                </button>
                <span className="admin-inline-note">
                  批量生成只更新下方 CSV 草稿，不保存文件、不下发 BA/PLC。
                  按 Readiness 生成现场草稿只预填工单、原因和动作，复核值保持空白/hold；不保存文件、不下发 BA/PLC、不放行 Canary。
                </span>
              </div>
              <label className="admin-field-block">
                <span>现场签字 CSV</span>
                <textarea
                  value={fcuSignoffCsvText}
                  onChange={(event) => setFcuSignoffCsvText(event.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={FCU_SIGNOFF_CSV_HEADER}
                />
              </label>
              <div className="admin-action-row">
                <button className="admin-button" type="button" onClick={() => void handlePreviewFcuSignoff()} disabled={saving}>
                  {saving ? "校验中..." : "校验签字 CSV"}
                </button>
                <button
                  className="admin-button is-primary"
                  type="button"
                  onClick={() => void handlePromoteFcuSignoff()}
                  disabled={saving || fcuSignoffPersistLocked}
                >
                  <Save size={14} />
                  保存签字 CSV
                </button>
                {fcuSignoffPreview ? (
                  <StatusPill
                    label={fcuSignoffPreview.ok ? "签字格式通过" : "签字仍阻断"}
                    tone={fcuSignoffPreview.ok ? "good" : "warn"}
                  />
                ) : null}
              </div>
              <label className="admin-field-block">
                <span>保存确认短语</span>
                <input
                  value={fcuSignoffConfirmText}
                  onChange={(event) => setFcuSignoffConfirmText(event.target.value)}
                  spellCheck={false}
                  placeholder={FCU_SIGNOFF_PROMOTE_CONFIRM}
                />
              </label>
              <div className="admin-fcu-remediation-foot">
                <span>保存会备份并替换现场签字输入 CSV。</span>
                <span>该动作只更新签字证据和门禁报告，不下发 BA/PLC，不进入自动闭环。</span>
              </div>
              <div className={`admin-fcu-auth-check ${fcuSignoffPersistLocked ? "is-blocked" : "is-ready"}`}>
                <strong>{fcuSignoffPersistLocked ? "保存前复核锁定" : "保存前复核通过"}</strong>
                <span>
                  {!fcuSignoffPreview
                    ? "请先校验签字 CSV。"
                    : fcuSignoffPreviewOpenRecords.length > 0
                      ? `${fcuSignoffPreviewOpenRecords.length} 台仍缺签字字段或未 release。`
                      : (fcuSignoffPreviewSummary?.missingColumns || []).length > 0
                        ? "CSV 缺少必要列。"
                        : (fcuSignoffPreviewSummary?.missingWorkOrders || []).length > 0
                          ? "CSV 缺少当前工单行。"
                          : fcuSignoffConfirmText !== FCU_SIGNOFF_PROMOTE_CONFIRM
                            ? "签字 CSV 已通过，请输入确认短语后保存。"
                            : "所有当前工单签字行已通过，可保存证据；保存仍不下发 BA/PLC。"}
                </span>
              </div>
              {fcuIgnoredRows !== null && fcuIgnoredRows > 0 ? (
                <div className="admin-fcu-auth-check is-blocked">
                  <strong>签字 CSV 存在旧行：{fcuIgnoredRows} 行</strong>
                  <span>旧行不属于当前工单，会被签字校验忽略。清理动作会备份原 CSV，只保留当前工单行。</span>
                  <div className="admin-action-row">
                    <button
                      className="admin-button"
                      type="button"
                      onClick={() => void handleCleanPromoteFcuSignoff()}
                      disabled={saving || fcuSignoffConfirmText !== FCU_SIGNOFF_PROMOTE_CONFIRM}
                    >
                      清理旧签字行
                    </button>
                  </div>
                </div>
              ) : null}
              {fcuSignoffPreview ? (
                <div className={`admin-fcu-auth-check ${fcuSignoffPreview.ok ? "is-ready" : "is-blocked"}`}>
                  <strong>
                    预览结果：{fcuSignoffPreviewSummary?.completeRows ?? 0}/{fcuSignoffPreviewSummary?.expectedWorkOrders ?? 0} 行通过
                  </strong>
                  <span>
                    缺列 {(fcuSignoffPreviewSummary?.missingColumns || []).join(" / ") || "无"}；
                    缺工单 {(fcuSignoffPreviewSummary?.missingWorkOrders || []).slice(0, 4).join(" / ") || "无"}；
                    未完成 {fcuSignoffPreviewOpenRecords.length} 行。
                  </span>
                </div>
              ) : null}
              {fcuSignoffPreview ? (
                <div className="admin-fcu-signoff-diff-grid">
                  <div>
                    <span>可 release</span>
                    <strong>{fcuSignoffPreviewReadyRows.length}</strong>
                    <p>{fcuSignoffPreviewReadyRows.slice(0, 6).map((item) => item.deviceCode || item.deviceName || item.workOrderId).join(" / ") || "暂无"}</p>
                  </div>
                  <div>
                    <span>仍缺项</span>
                    <strong>{fcuSignoffPreviewOpenRecords.length}</strong>
                    <p>{fcuSignoffIssueGroups.slice(0, 3).map((item) => `${item.label} ${item.count}`).join(" / ") || "无"}</p>
                  </div>
                  <div>
                    <span>现场候选 / Canary</span>
                    <strong>{fcuOnsiteCanaryCandidateRows.length} / {fcuCanaryReadyRows.length}</strong>
                    <p>{fcuCanaryBlockedRows.length > 0 ? `${fcuCanaryBlockedRows.length} 台仍被签字或实时 closeout 阻断` : "签字矩阵已放行"}</p>
                  </div>
                </div>
              ) : null}
              {fcuSignoffReleaseMatrix.length > 0 ? (
                <div className={`admin-fcu-canary-candidate ${fcuFirstCanaryCandidate ? "is-ready" : fcuFirstOnsiteCanaryCandidate ? "is-pending" : "is-blocked"}`}>
                  <div>
                    <span>首台预检候选</span>
                    <strong>
                      {fcuFirstOnsiteCanaryCandidate
                        ? `${fcuFirstOnsiteCanaryCandidate.deviceName || fcuFirstOnsiteCanaryCandidate.deviceCode || fcuFirstOnsiteCanaryCandidate.workOrderId}`
                        : "暂无可选"}
                    </strong>
                    <p>
                      {fcuFirstCanaryCandidate
                        ? "该设备签字矩阵允许进入 Canary；仍需总门禁、现场授权、BA 适配器和反馈校验。"
                        : fcuFirstOnsiteCanaryCandidate
                          ? "该设备现场签核已完整，可生成预检证据；仍禁止真实 Canary 下发。"
                          : "没有设备满足现场候选或 Canary 矩阵条件，禁止生成真实 Canary 下发。"}
                    </p>
                    <p>
                      候选联动：{fcuCandidateAutoLink.title}；{fcuCandidateAutoLink.detail}
                    </p>
                  </div>
                  <div className="admin-fcu-canary-blocks">
                    <span>
                      {fcuCandidateAutoLink.ready ? "自动推送到候选预检包区域" : "无候选时先处理首要缺项"}
                    </span>
                    {fcuCanaryBlockReasons.length > 0 ? (
                      fcuCanaryBlockReasons.slice(0, 4).map((item) => (
                        <span key={item.reason}>
                          {item.reason} · {item.count} 台
                        </span>
                      ))
                    ) : (
                      <span>签字矩阵未返回阻断原因</span>
                    )}
                  </div>
                  <div className="admin-action-row">
                    <button
                      className="admin-button"
                      type="button"
                      onClick={() => void handleBuildCandidateFieldArmPackage()}
                      disabled={saving || !fcuFirstOnsiteCanaryCandidate}
                    >
                      生成候选预检包
                    </button>
                    <span className="admin-inline-note">
                      只生成 Field Arm / Canary 预检证据，不执行真实 BA 写入；现场候选不等于真实 Canary 放行。
                    </span>
                  </div>
                </div>
              ) : null}
              {fcuCanaryReadiness ? (
                <div className={`admin-fcu-canary-candidate ${fcuCanaryReadiness.canaryReady ? "is-ready" : "is-blocked"}`}>
                  <div>
                    <span>Canary Readiness 作战表</span>
                    <strong>
                      {fcuCanaryReadiness.canaryReady ? "可执行 Canary" : "Canary 仍阻断"}
                    </strong>
                    <p>
                      {fcuCanaryReadiness.verdict || "readiness --"} · 阻断 {fcuCanaryReadiness.blockedCount ?? "--"} 项 ·{" "}
                      首台 {fcuCanaryReadiness.firstCanary || "BGS01"}
                    </p>
                    {fcuCanaryReadinessPlaybook ? (
                      <p>
                        {fcuCanaryReadinessPlaybook.readyGateCount ?? "--"} ready /{" "}
                        {fcuCanaryReadinessPlaybook.blockedGateCount ?? "--"} blocked；第一阻断{" "}
                        {fcuCanaryReadinessPlaybook.firstBlockedPhase || "无"} /{" "}
                        {fcuCanaryReadinessPlaybook.firstBlockedOwner || "无"}。
                      </p>
                    ) : null}
                  </div>
                  {fcuCanaryReadinessPlaybook ? (
                    <div className="admin-fcu-canary-blocks">
                      <span>
                        第一动作 · {fcuCanaryReadinessPlaybook.firstBlockedAction || "全部门禁通过后才允许进入 Canary"}
                      </span>
                      {fcuCanaryReadinessPhasePlan.slice(0, 6).map((item) => (
                        <span key={item.key || item.phase}>
                          {item.phase || item.key || "门禁"} · {item.ready ? "通过" : "阻断"} · {item.owner || "责任未定"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {fcuCandidateFieldArmResult ? (
                <div className={`admin-fcu-auth-check ${fcuCandidateFieldArmResult.fieldArmPackage?.ok ? "is-ready" : "is-blocked"}`}>
                  <strong>
                    候选预检包：{fcuCandidateFieldArmResult.deviceCode || "--"} ·
                    Field Arm {fcuCandidateFieldArmResult.fieldArmPackage?.ok ? "就绪" : "阻断"} ·
                    Canary {fcuCandidateFieldArmResult.canaryExecutionPackage?.ok ? "就绪" : "阻断"}
                  </strong>
                  <span>
                    阻断 {(fcuCandidateFieldArmResult.fieldArmPackage?.blockers || [])
                      .slice(0, 3)
                      .map((item) => `${item.label || item.key || "blocker"} ${item.evidence || ""}`)
                      .join(" / ") || "无"}；
                    BA/PLC 写入 {fcuCandidateFieldArmResult.controlMutation ? "存在" : "无"}；
                    下发 {fcuCandidateFieldArmResult.dispatch ? "存在" : "无"}。
                  </span>
                  <div className="admin-fcu-canary-blocks">
                    {fcuCandidatePrecheckChain.map((item) => (
                      <span key={item.key}>
                        {item.label} · {item.ok ? "通过" : "阻断"} · {item.verdict} · blockers {item.blockers}
                      </span>
                    ))}
                  </div>
                  <span>
                    预检链只生成证据：Field Arm → BA 写适配器 → Canary 执行包 → 反馈监视；未通过前禁止进入 3001 真实 Canary 执行。
                    反馈监视 {fcuCandidateFieldArmResult.canaryFeedbackMonitor?.feedbackStatus || "待真实 Canary 后确认"}。
                  </span>
                </div>
              ) : null}
              <div className={`admin-fcu-auth-check ${fcuFinalDispatchReady ? "is-ready" : "is-blocked"}`}>
                <strong>
                  最终放行前核对清单：{fcuFinalReleaseReadyCount}/{fcuFinalReleaseChecklist.length} 项通过
                </strong>
                <span>
                  第一阻断：{fcuFinalReleaseFirstBlocker?.label || "无"}；
                  下一步：{fcuFinalReleaseFirstBlocker?.action || "全部门禁通过后仍需按授权窗口执行。"}
                </span>
                <div className="admin-fcu-final-release-grid">
                  {fcuFinalReleaseChecklist.map((item) => (
                    <div key={item.key} className={item.ok ? "is-ready" : "is-blocked"}>
                      <span>{item.label}</span>
                      <strong>{item.ok ? "通过" : "阻断"}</strong>
                      <p>{item.detail}</p>
                      <em>{item.action}</em>
                    </div>
                  ))}
                </div>
                <span>
                  该清单只汇总现有证据，不放宽任何门禁；最终写入仍必须由 3001 单台确认、后端总闸、审计和反馈回退共同放行。
                </span>
              </div>
              {fcuOnsiteReleasePrecheck ? (
                <div className={`admin-fcu-auth-check ${fcuOnsiteReleasePrecheck.ok ? "is-ready" : "is-blocked"}`}>
                  <strong>
                    现场放行预检：Ready {fcuOnsiteReleasePrecheck.onsiteReleaseReadyCount ?? "--"} / Blocked {fcuOnsiteReleasePrecheck.onsiteReleaseBlockedCount ?? "--"}
                  </strong>
                  <span>
                    Canary 仍阻断 {fcuOnsiteReleasePrecheck.canaryStillBlockedCount ?? "--"} 台；
                    现场候选 {fcuOnsiteReleasePrecheck.onsiteCanaryCandidateCount ?? 0} 台；
                    Canary 候选 {fcuOnsiteReleasePrecheck.canaryCandidateCount ?? "--"} 台；
                    {(fcuOnsiteReleasePrecheck.nextGlobalActions || []).slice(0, 3).join(" / ") || "签字完整后仍需实时 closeout 和最终总门禁。"}
                  </span>
                  {(fcuOnsiteReleasePrecheck.devices || []).slice(0, 4).map((item) => (
                    <span key={item.workOrderId || item.deviceCode || item.deviceName}>
                      {item.deviceCode || item.workOrderId || "FCU"}：{(item.nextBlockingFields || []).slice(0, 4).join(" / ") || item.canaryBlockReason || "--"}
                    </span>
                  ))}
                </div>
              ) : null}
              {fcuSignoffActionQueue.length > 0 ? (
                <div className="admin-fcu-release-review">
                  <div className="admin-fcu-field-execution-mode">
                    <div>
                      <span>现场执行模式</span>
                      <strong>
                        {fcuFieldExecutionProgress.canaryReady}/{fcuFieldExecutionProgress.total} 台可进 Canary
                      </strong>
                      <p>
                        已签字 {fcuFieldExecutionProgress.signoffComplete} 台 · 仍阻断 {fcuFieldExecutionProgress.blocked} 台 · 进度 {fcuFieldExecutionProgress.percent}%
                        {fcuFieldExecutionProgress.onsiteCandidates > 0 ? ` · 现场候选 ${fcuFieldExecutionProgress.onsiteCandidates} 台` : ""}
                      </p>
                    </div>
                    <div className="admin-fcu-field-progress">
                      <div>
                        <span style={{ width: `${Math.min(100, Math.max(0, fcuFieldExecutionProgress.percent))}%` }} />
                      </div>
                      <p>
                        当前首台：{fcuFieldExecutionProgress.firstPending?.deviceCode || fcuFieldExecutionProgress.firstPending?.deviceName || fcuFieldExecutionProgress.firstPending?.workOrderId || "暂无"}
                        ；按队列逐台处理，全部可进 Canary 后再刷新总门禁。
                      </p>
                    </div>
                    <button
                      className="admin-button is-primary"
                      type="button"
                      onClick={() => fcuFieldExecutionProgress.firstPending?.rowHref && navigate(fcuFieldExecutionProgress.firstPending.rowHref)}
                      disabled={!fcuFieldExecutionProgress.firstPending?.rowHref}
                    >
                      开始现场执行
                    </button>
                  </div>
                  <div className="admin-fcu-remediation-foot">
                    <span>单台签核处理队列：先处理不能进 Canary 的设备，再处理已签字但仍受 closeout / readiness 阻断的设备。</span>
                    <span>点击“打开工单”只进入单台签核页，不保存签核、不下发 BA/PLC。</span>
                  </div>
                  <div className="admin-table-scroll" role="region" aria-label="FCU 单台签核队列表，可横向滚动查看更多字段" tabIndex={0}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>优先级</th>
                          <th>设备</th>
                          <th>签核/Canary</th>
                          <th>缺项</th>
                          <th>下一步</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fcuSignoffActionQueue.slice(0, 12).map((item) => (
                          <tr key={`signoff-queue-${item.workOrderId || item.deviceCode || item.deviceName}`}>
                            <td>{item.priority < 10 ? "P0" : item.canEnterCanary ? "候选" : item.onsiteCanaryCandidate ? "现场候选" : "P1"}</td>
                            <td>{item.deviceName || item.deviceCode || item.workOrderId || "--"}</td>
                            <td>
                              <StatusPill
                                label={item.canEnterCanary ? "可进 Canary" : item.onsiteCanaryCandidate ? "现场候选/待预检" : item.signoffComplete ? "签字完成/仍阻断" : "签字缺项"}
                                tone={item.canEnterCanary ? "good" : item.onsiteCanaryCandidate ? "neutral" : item.signoffComplete ? "neutral" : "warn"}
                              />
                            </td>
                            <td>{item.blockingFields.slice(0, 4).join(" / ") || item.canaryBlockReason || "--"}</td>
                            <td>{item.firstChecklistAction || item.onsiteNextAction || item.nextAction || "补齐现场字段后重新校验签字 CSV。"}</td>
                            <td>
                              <button
                                className="admin-button"
                                type="button"
                                onClick={() => item.rowHref && navigate(item.rowHref)}
                                disabled={!item.rowHref}
                              >
                                打开工单
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {fcuSignoffIssueGroups.length > 0 ? (
                <div className="admin-table-scroll" role="region" aria-label="FCU 签核问题分类表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>缺项字段</th>
                        <th>影响设备</th>
                        <th>设备</th>
                        <th>现场动作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fcuSignoffIssueGroups.slice(0, 8).map((item) => (
                        <tr key={item.field}>
                          <td>{item.label}</td>
                          <td>{item.count}</td>
                          <td>{item.devices.slice(0, 8).join(" / ")}</td>
                          <td>{item.action || "补齐该字段后重新校验"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {fcuSignoffReleaseMatrix.length > 0 ? (
                <div className="admin-fcu-release-review">
                  <div className="admin-fcu-remediation-foot">
                    <span>逐台放行视图：优先显示仍阻断设备，签字通过不等于真实下发。</span>
                    <span>可进 Canary 仍需实时 closeout、现场授权、BA 写适配器和总门禁全部通过。</span>
                  </div>
                  <div className="admin-table-scroll" role="region" aria-label="FCU Canary 放行队列表，可横向滚动查看更多字段" tabIndex={0}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>设备</th>
                          <th>逐台状态</th>
                          <th>缺项/阻断</th>
                          <th>下一步动作</th>
                          <th>复核目标</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fcuSignoffReleaseRows.slice(0, 12).map((item) => (
                          <tr key={item.workOrderId || item.deviceCode}>
                            <td>{item.deviceName || item.deviceCode || item.workOrderId || "--"}</td>
                            <td>
                              <StatusPill
                                label={item.statusLabel}
                                tone={item.canEnterCanary ? "good" : item.signoffComplete ? "neutral" : "warn"}
                              />
                            </td>
                            <td>{item.missingText}</td>
                            <td>{item.nextAction}</td>
                            <td>{item.verificationTarget || (item.requiredValues || []).slice(0, 2).join(" / ") || "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {fcuSignoffCleanResult ? (
                <div className={`admin-fcu-auth-check ${fcuSignoffCleanResult.signoff?.summary && "ignoredRows" in fcuSignoffCleanResult.signoff.summary && Number(fcuSignoffCleanResult.signoff.summary.ignoredRows) === 0 ? "is-ready" : "is-blocked"}`}>
                  <strong>
                    清理结果：旧行 {fcuSignoffCleanResult.clean?.summary?.staleRows ?? 0} 行；
                    ignoredRows {fcuSignoffCleanResult.signoff?.summary && "ignoredRows" in fcuSignoffCleanResult.signoff.summary ? Number(fcuSignoffCleanResult.signoff.summary.ignoredRows) : "--"}
                  </strong>
                  <span>
                    备份 {fcuSignoffCleanResult.promote?.target?.backupCsv || "--"}；
                    BA/PLC 写入 {fcuSignoffCleanResult.controlMutation ? "存在" : "无"}。
                  </span>
                </div>
              ) : null}
              {fcuSignoffPromoteResult ? (
                <div className={`admin-fcu-auth-check ${fcuSignoffPromoteResult.finalControlGates?.ok ? "is-ready" : "is-blocked"}`}>
                  <strong>
                    保存结果：{fcuSignoffPromoteSummary?.completeRows ?? 0}/{fcuSignoffPromoteSummary?.expectedWorkOrders ?? 0} 行通过；
                    总门禁 {fcuSignoffPromoteResult.finalControlGates?.ok ? "通过" : "仍阻断"}
                  </strong>
                  <span>
                    目标 {fcuSignoffPromoteResult.promote?.target?.signoffInputCsv || "--"}；
                    备份 {fcuSignoffPromoteResult.promote?.target?.backupCsv || "--"}；
                    BA/PLC 写入 {fcuSignoffPromoteResult.controlMutation ? "存在" : "无"}。
                  </span>
                  <div className="admin-fcu-canary-blocks">
                    {fcuSignoffPromoteRefreshChain.map((item) => (
                      <span key={item.key}>
                        {item.label} · {item.ok ? "通过" : "阻断"} · {item.detail}
                      </span>
                    ))}
                  </div>
                  <span>
                    自动刷新链已执行：signoff → closeout/worklist → final gates → runbook → evidence consistency；
                    当前候选 {fcuFirstCanaryCandidate ? fcuFirstCanaryCandidate.deviceCode || fcuFirstCanaryCandidate.deviceName || "FCU" : "暂无"}。
                    {fcuSignoffPromoteResult.dispatch ? "存在下发，请复核。" : "无下发。"}
                  </span>
                </div>
              ) : null}
              {fcuSignoffPreviewOpenRecords.length > 0 ? (
                <div className="admin-table-scroll" role="region" aria-label="FCU 未闭环记录表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>工单</th>
                        <th>设备</th>
                        <th>问题</th>
                        <th>动作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fcuSignoffPreviewOpenRecords.slice(0, 6).map((item) => (
                        <tr key={item.workOrderId || item.deviceCode}>
                          <td>{item.workOrderId || "--"}</td>
                          <td>{item.deviceName || item.deviceCode || "--"}</td>
                          <td>{(item.issues || []).slice(0, 3).join(" / ") || "--"}</td>
                          <td>{item.missingChecklist?.[0]?.action || "补齐签字字段后重试"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {showFcuPolicy ? (
        <SectionCard
          title="FCU 单台自动控制策略"
          action={
            <button className="admin-button is-primary" type="button" onClick={() => void handleSaveFcuPolicy()} disabled={saving}>
              <Save size={14} />
              保存 FCU 策略
            </button>
          }
        >
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill label={`模式 ${BOUNDARY_LABELS[fcuPolicy.defaultMode] || fcuPolicy.defaultMode}`} tone={fcuPolicy.defaultMode === "enforced" ? "warn" : "neutral"} />
              <StatusPill label={`白名单 ${fcuPolicy.whitelist.length} 台`} tone={fcuPolicy.whitelist.length > 0 ? "good" : "warn"} />
              <StatusPill label={`适配器 ${fcuPolicy.dispatchAdapter || "none"}`} tone={fcuPolicy.dispatchAdapter && fcuPolicy.dispatchAdapter !== "none" ? "good" : "warn"} />
            </div>
            <p className="admin-warning-note">
              FCU 闭环只对白名单设备生效；未配置 BA 写适配器时，闭环模式也只会记录命令候选和阻断原因，不会伪装成真实下发。
            </p>
            <div className="admin-fcu-authorization-panel">
              <div>
                <strong>现场授权与开闸门禁</strong>
                <span>这里只记录授权状态和环境门禁，不保存真实确认短语明文；真实下发仍必须在 3001 单台页二次确认并通过后端总闸。</span>
              </div>
              <div className="admin-action-row">
                <button className="admin-button" type="button" onClick={handleFillFcuAuthorizationDraft}>
                  填入一小时授权草稿
                </button>
                <button className="admin-button" type="button" onClick={handleRevokeFcuAuthorizationDraft}>
                  撤销授权草稿
                </button>
                <span className="admin-inline-note">
                  草稿只补齐配置字段；真实写入仍受 3001 单台确认、后端非只读、Arm-Check、反馈校验和回退保护限制。
                </span>
              </div>
              <div className="admin-chip-row">
                <StatusPill
                  label={FCU_AUTH_STATUS_LABELS[fcuPolicy.fieldAuthorization.siteAuthorizationStatus]}
                  tone={fcuPolicy.fieldAuthorization.siteAuthorizationStatus === "approved" ? "good" : "warn"}
                />
                <StatusPill label={fcuPolicy.fieldAuthorization.baWriteConfirmArmed ? "BA确认已装载" : "BA确认未装载"} tone={fcuPolicy.fieldAuthorization.baWriteConfirmArmed ? "good" : "warn"} />
                <StatusPill label={fcuPolicy.fieldAuthorization.finalRolloutConfirmArmed ? "总确认已装载" : "总确认未装载"} tone={fcuPolicy.fieldAuthorization.finalRolloutConfirmArmed ? "good" : "warn"} />
                <StatusPill label={fcuAuthorizationReady ? "授权门禁就绪" : "授权门禁阻断"} tone={fcuAuthorizationReady ? "good" : "warn"} />
                <StatusPill label={fcuFinalDispatchReady ? "最终写入总门禁通过" : "最终写入总门禁阻断"} tone={fcuFinalDispatchReady ? "good" : "warn"} />
              </div>
              <div className={`admin-fcu-auth-check ${fcuAuthorizationReady ? "is-ready" : "is-blocked"}`}>
                <strong>{fcuAuthorizationReady ? "可进入现场开闸预检" : "开闸门禁阻断"}</strong>
                <span>
                  {fcuAuthorizationGateIssues.length > 0
                    ? fcuAuthorizationGateIssues.join(" / ")
                    : fcuPolicy.fieldAuthorization.siteAuthorizationStatus === "approved"
                      ? `${fcuAuthorizationWindowState.label}；真实下发仍需 3001 二次确认与后端非只读。`
                      : "未批准授权时可保存草稿，但不会打开 3001 真实下发门禁。"}
                </span>
              </div>
              <div className={`admin-fcu-auth-check ${fcuFinalDispatchReady ? "is-ready" : "is-blocked"}`}>
                <strong>{fcuFinalDispatchReady ? "普通闭环写入已放行" : "普通闭环写入仍锁定"}</strong>
                <span>
                  {fcuFinalDispatchReady
                    ? "最终控制总门禁和 Canary 均已通过，普通 control-cycle / control-command 才允许真实 BA 写入。"
                    : `${fcuFinalDispatchGateIssues.join(" / ") || "等待最终门禁证据"}；3002 授权不等于最终写入放行。`}
                </span>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span>现场授权状态</span>
                  <select
                    value={fcuPolicy.fieldAuthorization.siteAuthorizationStatus}
                    onChange={(event) =>
                      patchFcuFieldAuthorization({
                        siteAuthorizationStatus: event.target.value as AdminFcuControlPolicy["fieldAuthorization"]["siteAuthorizationStatus"]
                      })
                    }
                  >
                    <option value="not_started">未授权</option>
                    <option value="requested">已申请</option>
                    <option value="approved">已授权</option>
                    <option value="revoked">已撤销</option>
                  </select>
                </label>
                <label>
                  <span>授权确认人</span>
                  <input
                    value={fcuPolicy.fieldAuthorization.siteAuthorizationBy}
                    onChange={(event) => patchFcuFieldAuthorization({ siteAuthorizationBy: event.target.value })}
                    placeholder="甲方/运维负责人"
                  />
                </label>
                <label>
                  <span>投运负责人</span>
                  <input
                    value={fcuPolicy.fieldAuthorization.commissioningOwner}
                    onChange={(event) => patchFcuFieldAuthorization({ commissioningOwner: event.target.value })}
                    placeholder="平台工程师"
                  />
                </label>
                <label>
                  <span>BA 负责人</span>
                  <input
                    value={fcuPolicy.fieldAuthorization.baOwner}
                    onChange={(event) => patchFcuFieldAuthorization({ baOwner: event.target.value })}
                    placeholder="自控/BA 工程师"
                  />
                </label>
                <label>
                  <span>授权窗口开始</span>
                  <input
                    type="datetime-local"
                    value={fcuPolicy.fieldAuthorization.siteAuthorizationWindowStart}
                    onChange={(event) => patchFcuFieldAuthorization({ siteAuthorizationWindowStart: event.target.value })}
                  />
                </label>
                <label>
                  <span>授权窗口结束</span>
                  <input
                    type="datetime-local"
                    value={fcuPolicy.fieldAuthorization.siteAuthorizationWindowEnd}
                    onChange={(event) => patchFcuFieldAuthorization({ siteAuthorizationWindowEnd: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-form-grid">
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={fcuPolicy.fieldAuthorization.baWriteConfirmArmed}
                    onChange={(event) => patchFcuFieldAuthorization({ baWriteConfirmArmed: event.target.checked })}
                  />
                  <span>运行环境已设置 BA 写入确认短语</span>
                </label>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={fcuPolicy.fieldAuthorization.finalRolloutConfirmArmed}
                    onChange={(event) => patchFcuFieldAuthorization({ finalRolloutConfirmArmed: event.target.checked })}
                  />
                  <span>运行环境已设置最终控制总确认短语</span>
                </label>
              </div>
              <label className="admin-field-block">
                <span>现场授权备注</span>
                <textarea
                  value={fcuPolicy.fieldAuthorization.notes}
                  onChange={(event) => patchFcuFieldAuthorization({ notes: event.target.value })}
                  rows={3}
                  placeholder="记录授权边界、现场值守、回退约定；不要填写真实确认短语。"
                />
              </label>
            </div>
            <div className="admin-form-grid">
              <label>
                <span>控制模式</span>
                <select
                  value={fcuPolicy.defaultMode}
                  onChange={(event) => patchFcuPolicy({ defaultMode: event.target.value as AdminFcuControlPolicy["defaultMode"] })}
                >
                  <option value="shadow">影子建议</option>
                  <option value="assisted">人工确认</option>
                  <option value="enforced">自动闭环</option>
                </select>
              </label>
              <label>
                <span>目标下限 °C</span>
                <input type="number" step="0.5" value={fcuPolicy.targetLowC} onChange={(event) => patchFcuPolicy({ targetLowC: Number(event.target.value) })} />
              </label>
              <label>
                <span>目标上限 °C</span>
                <input type="number" step="0.5" value={fcuPolicy.targetHighC} onChange={(event) => patchFcuPolicy({ targetHighC: Number(event.target.value) })} />
              </label>
              <label>
                <span>设定步长 °C</span>
                <input type="number" step="0.5" value={fcuPolicy.setpointStepC} onChange={(event) => patchFcuPolicy({ setpointStepC: Number(event.target.value) })} />
              </label>
              <label>
                <span>设定保持 min</span>
                <input type="number" value={fcuPolicy.setpointDwellMinutes} onChange={(event) => patchFcuPolicy({ setpointDwellMinutes: Number(event.target.value) })} />
              </label>
              <label>
                <span>启停保持 min</span>
                <input type="number" value={fcuPolicy.startStopDwellMinutes} onChange={(event) => patchFcuPolicy({ startStopDwellMinutes: Number(event.target.value) })} />
              </label>
              <label>
                <span>回退锁定 min</span>
                <input type="number" value={fcuPolicy.rollbackLockoutMinutes} onChange={(event) => patchFcuPolicy({ rollbackLockoutMinutes: Number(event.target.value) })} />
              </label>
              <label>
                <span>BA 写适配器</span>
                <input value={fcuPolicy.dispatchAdapter} onChange={(event) => patchFcuPolicy({ dispatchAdapter: event.target.value })} placeholder="none / legacy-scene-command" />
              </label>
            </div>
            <div className="admin-form-grid">
              <label className="admin-checkbox-row">
                <input type="checkbox" checked={fcuPolicy.allowSetpoint} onChange={(event) => patchFcuPolicy({ allowSetpoint: event.target.checked })} />
                <span>允许温度设定</span>
              </label>
              <label className="admin-checkbox-row">
                <input type="checkbox" checked={fcuPolicy.allowFanSpeed} onChange={(event) => patchFcuPolicy({ allowFanSpeed: event.target.checked })} />
                <span>允许风速模式</span>
              </label>
              <label className="admin-checkbox-row">
                <input type="checkbox" checked={fcuPolicy.allowStartStop} onChange={(event) => patchFcuPolicy({ allowStartStop: event.target.checked })} />
                <span>允许启停</span>
              </label>
              <label className="admin-checkbox-row">
                <input type="checkbox" checked={fcuPolicy.occupied} onChange={(event) => patchFcuPolicy({ occupied: event.target.checked })} />
                <span>当前按有人时段</span>
              </label>
            </div>
            <label className="admin-field-block">
              <span>单台 FCU 白名单（一行一个 deviceCode / deviceName）</span>
              <textarea
                value={fcuWhitelistText}
                onChange={(event) => setFcuWhitelistText(event.target.value)}
                rows={5}
                placeholder="办公室01-BGS01"
              />
            </label>
          </div>
        </SectionCard>
      ) : null}

      {loading ? (
        <div className="admin-loading-grid">
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
        </div>
      ) : (
        <>
          <SectionCard
            title="可配置子系统能力矩阵"
            action={
              <button className="admin-button is-primary" type="button" onClick={() => void handleSaveSubsystems()} disabled={saving}>
                <Save size={14} />
                {saving ? "保存中..." : "保存能力"}
              </button>
            }
          >
            <div className="admin-table-shell admin-subsystem-matrix-table" role="region" aria-label="子系统配置矩阵表，可横向滚动查看更多字段" tabIndex={0}>
              <table className="admin-table admin-subsystem-table">
                <colgroup>
                  <col className="admin-subsystem-col-name" />
                  <col className="admin-subsystem-col-status" />
                  <col className="admin-subsystem-col-progress" />
                  <col className="admin-subsystem-col-advisor" />
                  <col className="admin-subsystem-col-boundary" />
                  <col className="admin-subsystem-col-published" />
                  <col className="admin-subsystem-col-notes" />
                </colgroup>
                <thead>
                  <tr>
                    <th>子系统</th>
                    <th>配置状态</th>
                    <th>点位映射</th>
                    <th>建议器</th>
                    <th>控制边界</th>
                    <th>发布</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {configurableSubsystems.map((item) => (
                    <tr key={item.subsystemType}>
                      <td>
                        <strong>{item.displayName}</strong>
                        <div className="admin-table-cell-muted">{item.subsystemType}</div>
                      </td>
                      <td>
                        <select
                          value={item.status}
                          onChange={(event) =>
                            patchSubsystem(item.subsystemType, {
                              status: event.target.value as AdminSubsystemStatus
                            })
                          }
                        >
                          <option value="enabled">配置启用</option>
                          <option value="not_configured">未配置</option>
                          <option value="not_applicable">不适用</option>
                        </select>
                        <div className="admin-table-cell-muted">
                          <StatusPill label={formatRealtimeStatus(item)} tone={realtimeStatusTone(item)} />
                        </div>
                      </td>
                      <td>
                        <StatusPill
                          label={item.status === "enabled" ? `${item.pointMappingProgress}%` : "未配置"}
                          tone={item.status === "enabled" && item.pointMappingProgress >= 70 ? "good" : item.status === "enabled" ? "warn" : "neutral"}
                        />
                      </td>
                      <td>{item.enabled ? formatAdvisorPluginStatus(item.advisorPluginStatus) : "不参与"}</td>
                      <td>
                        <select
                          value={item.controlBoundary.mode}
                          onChange={(event) => {
                            const mode = event.target.value as AdminControlBoundaryMode;
                            patchSubsystem(item.subsystemType, {
                              controlBoundary: {
                                ...item.controlBoundary,
                                mode,
                                writeEnabled: mode === "enforced"
                              }
                            });
                          }}
                        >
                          <option value="read_only">只读</option>
                          <option value="shadow">影子建议</option>
                          <option value="assisted">人工确认</option>
                          <option value="enforced">闭环执行</option>
                        </select>
                        <div className="admin-table-cell-muted">
                          {BOUNDARY_LABELS[item.controlBoundary.mode]} · {item.controlBoundary.writeEnabled ? "写入启用" : "写入关闭"}
                        </div>
                      </td>
                      <td>
                        <label className="admin-inline-check">
                          <input
                            type="checkbox"
                            checked={item.published}
                            onChange={(event) => patchSubsystem(item.subsystemType, { published: event.target.checked })}
                          />
                          已发布
                        </label>
                      </td>
                      <td>
                        <input
                          className="admin-subsystem-note-input"
                          value={item.notes || ""}
                          placeholder={STATUS_LABELS[item.status]}
                          onChange={(event) => patchSubsystem(item.subsystemType, { notes: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reservedSubsystems.length ? (
              <div className="admin-reserved-subsystems" aria-label="预留扩展入口">
                <div>
                  <strong>预留扩展入口</strong>
                  <span>只保留能力模型，不参与当前项目统计和 3001 KPI。</span>
                </div>
                <div className="admin-reserved-subsystem-list">
                  {reservedSubsystems.map((item) => (
                    <span key={item.subsystemType} className="admin-reserved-subsystem-chip">
                      {item.displayName}
                      <small>{STATUS_LABELS[item.status] || item.status}</small>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <div className="admin-detail-grid">
            <SectionCard title="点位表导入预览">
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>子系统</span>
                  <select value={selectedSubsystem} onChange={(event) => handleSelectedSubsystemChange(event.target.value)}>
                    {configurableSubsystems.map((item) => (
                      <option key={item.subsystemType} value={item.subsystemType}>
                        {item.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-field">
                  <span>已保存映射</span>
                  <strong>{selectedMappings.length} 条</strong>
                </div>
                <div className="admin-field">
                  <span>必需角色</span>
                  <strong>{selectedRegistry?.pointRoles.filter((item) => item.required !== false).length || 0} 类</strong>
                </div>
                {selectedRoleCoverage.length ? (
                  <div className="admin-field is-full">
                    <span>角色覆盖</span>
                    <div className="admin-chip-row">
                      {selectedRoleCoverage.map((role, index) => (
                        <span
                          key={`${role.role}-${role.label}-${index}`}
                          className={`admin-chip ${role.mapped ? "good" : role.required ? "warn" : "neutral"}`}
                        >
                          {role.label}
                          {role.required ? "必需" : "可选"}
                          {role.mapped ? "已映射" : "待映射"}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="admin-field is-full">
                  <span>点位表文本</span>
                  <textarea
                    className="admin-import-textarea"
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    rows={6}
                    placeholder="点位名称,点位编码,单位"
                  />
                </label>
              </div>
              <div className="admin-form-actions">
                <button className="admin-button" type="button" onClick={() => void handlePreviewImport()}>
                  <UploadCloud size={14} />
                  预览识别
                </button>
                <button className="admin-button is-primary" type="button" onClick={() => void handleSavePreviewMappings()} disabled={!preview || saving}>
                  <Save size={14} />
                  保存为角色映射
                </button>
              </div>
              {preview ? (
                <div className={`admin-preview-risk-summary ${preview.writableCandidates > 0 ? "is-danger" : "is-good"}`}>
                  <strong>{preview.writableCandidates > 0 ? `写点/命令点 ${preview.writableCandidates} 个` : "未发现写点/命令点"}</strong>
                  <span>{preview.writableCandidates > 0 ? "第一版只预览，不启用控制写入。" : `${preview.acceptedRows} 行可保存为只读角色映射。`}</span>
                </div>
              ) : null}
              {preview ? (
                <div className="admin-table-shell admin-import-preview-table" style={{ marginTop: 14 }} role="region" aria-label="点位角色导入预览表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="admin-table admin-table-preview">
                    <thead>
                      <tr>
                        <th>行</th>
                        <th>点位</th>
                        <th>角色</th>
                        <th>置信度</th>
                        <th>风险</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((item) => (
                        <tr key={`${item.rowNumber}-${item.pointCode}-${item.pointName}`}>
                          <td>{item.rowNumber}</td>
                          <td>
                            <strong>{item.pointName || item.pointCode}</strong>
                            <div className="admin-table-cell-muted">{item.pointCode || "无编码"} · {item.unit || "无单位"}</div>
                          </td>
                          <td>{item.pointRole}</td>
                          <td>{Math.round(item.confidence * 100)}%</td>
                          <td>
                            <span className={`admin-chip ${item.warnings.length ? "danger" : "good"}`} title={item.warnings.join("；")}>
                              {item.warnings.length ? "写点/命令点：只预览" : "可保存"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="配置发布 / 回滚">
              <div className="admin-form-grid">
                <label className="admin-field is-full">
                  <span>版本号</span>
                  <input value={versionId} onChange={(event) => setVersionId(event.target.value)} />
                </label>
              </div>
              <p className="admin-note" style={{ marginTop: 12 }}>
                发布会固化不可变配置快照；每次发布必须使用新版本号，成功后会自动生成下一版本号。3001 运行端只消费已发布配置，回滚按历史版本快照恢复能力和点位角色映射。
              </p>
              <div className="admin-form-actions">
                <button className="admin-button is-primary" type="button" onClick={() => void handlePublish()} disabled={saving || !versionId.trim()}>
                  <Save size={14} />
                  发布配置
                </button>
                <button className="admin-button" type="button" onClick={() => void handleRollback()} disabled={saving || !versionId.trim()}>
                  <RotateCcw size={14} />
                  回滚版本
                </button>
              </div>
              <div className="admin-version-history">
                <div className="admin-inline-heading">
                  <History size={14} />
                  <span>版本历史</span>
                </div>
                {versions.length ? (
                  <div className="admin-table-shell" role="region" aria-label="子系统配置版本历史表，可横向滚动查看更多字段" tabIndex={0}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>版本</th>
                          <th>状态</th>
                          <th>发布时间</th>
                          <th>回滚时间</th>
                          <th>操作人</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((item) => (
                          <tr key={`${item.siteId}-${item.versionId}`}>
                            <td>
                              <strong>{item.versionId}</strong>
                              <div className="admin-table-cell-muted">{item.summary || "无说明"}</div>
                            </td>
                            <td>{VERSION_STATUS_LABELS[item.status] || item.status}</td>
                            <td>{formatDateTime(item.publishedAt || item.createdAt)}</td>
                            <td>{formatDateTime(item.rolledBackAt)}</td>
                            <td>{item.updatedBy || item.createdBy || "--"}</td>
                            <td>
                              <button className="admin-button" type="button" onClick={() => setVersionId(item.versionId)}>
                                选用
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-note">暂无已发布版本。发布后会在这里形成可审计快照。</p>
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

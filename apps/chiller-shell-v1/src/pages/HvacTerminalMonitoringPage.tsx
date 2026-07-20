import { Building2, ChevronLeft, ChevronRight, Fan, Gauge, RefreshCw, ShieldCheck, SlidersHorizontal, Thermometer } from "lucide-react";
import "./PowerMonitoringShared.css";
import "./HvacTerminalExtracted.css";
import "./DistributionEnergyWorkspace.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentLocale, type LocaleCode } from "../i18n/zhCN";
import {
  getCurrentProject,
  resolveAuthProjectDisplayName,
  resolveEnergyConfigSiteId
} from "../services/auth";
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
import {
  getSubsystemStatusPresentation,
  isSubsystemDemoData,
  isSubsystemWaitingForRealData
} from "../utils/subsystemStatus";
import { formatControlBoundaryMode } from "../utils/stationWorkspacePresentation";
import { siteIdsEquivalent } from "../services/siteRouting";

type Tone = "good" | "warn" | "neutral";
type TerminalView = "overview" | "control" | "quality" | "devices" | "device";

const HVAC_TERMINAL_REFRESH_MS = 20_000;
const HVAC_TERMINAL_STALE_MS = 5 * 60 * 1000;
const OFFICE_TERMINAL_BUILD = 1;
const OFFICE_TERMINAL_FLOOR = 1;
const CONTROL_QUEUE_STATUSES = new Set(["ready", "blocked", "held", "shadow", "pending_approval", "dispatch_failed", "dispatched"]);
type ManualFcuCommandKind = "start" | "stop" | "setpoint" | "fan_speed";

const HVAC_TERMINAL_TEXT: Record<string, Partial<Record<LocaleCode, string>>> = {
  "低": { "en-US": "Low", "vi-VN": "Thấp" },
  "中": { "en-US": "Medium", "vi-VN": "Trung bình" },
  "高": { "en-US": "High", "vi-VN": "Cao" },
  "自动": { "en-US": "Auto", "vi-VN": "Tự động" },
  "风机盘管": { "en-US": "Fan coil", "vi-VN": "FCU" },
  "演示数据 / 只读": { "en-US": "Demo data / read-only", "vi-VN": "Dữ liệu demo / chỉ đọc" },
  "配置已发布 / 待接实时": { "en-US": "Configured / waiting live points", "vi-VN": "Đã cấu hình / chờ điểm thời gian thực" },
  "已接入实时": { "en-US": "Live connected", "vi-VN": "Đã kết nối thời gian thực" },
  "未配置 / 可接入": { "en-US": "Not configured / ready to connect", "vi-VN": "Chưa cấu hình / có thể kết nối" },
  "不适用": { "en-US": "Not applicable", "vi-VN": "Không áp dụng" },
  "实时数据陈旧": { "en-US": "Live data stale", "vi-VN": "Dữ liệu thời gian thực đã cũ" },
  "实时链路异常": { "en-US": "Live link fault", "vi-VN": "Lỗi liên kết thời gian thực" },
  "已配置 / 状态待核": { "en-US": "Configured / needs review", "vi-VN": "Đã cấu hình / cần kiểm tra" },
  "未知": { "en-US": "Unknown", "vi-VN": "Không rõ" },
  "影子建议": { "en-US": "Shadow advice", "vi-VN": "Khuyến nghị shadow" },
  "人工确认": { "en-US": "Manual approval", "vi-VN": "Xác nhận thủ công" },
  "闭环预留": { "en-US": "Closed-loop reserved", "vi-VN": "Dự phòng vòng kín" },
  "只读": { "en-US": "Read-only", "vi-VN": "Chỉ đọc" },
  "BA实时快照": { "en-US": "BA live snapshot", "vi-VN": "Ảnh chụp BA thời gian thực" },
  "演示数据": { "en-US": "Demo data", "vi-VN": "Dữ liệu demo" },
  "待接现场点": { "en-US": "Waiting field points", "vi-VN": "Chờ điểm hiện trường" },
  "实时正常": { "en-US": "Live healthy", "vi-VN": "Thời gian thực bình thường" },
  "数据陈旧": { "en-US": "Data stale", "vi-VN": "Dữ liệu đã cũ" },
  "链路异常": { "en-US": "Link fault", "vi-VN": "Lỗi liên kết" },
  "待核对": { "en-US": "Needs review", "vi-VN": "Cần kiểm tra" },
  "不参与": { "en-US": "Excluded", "vi-VN": "Không tham gia" },
  "未配置": { "en-US": "Not configured", "vi-VN": "Chưa cấu hình" },
  "待接入": { "en-US": "Pending connection", "vi-VN": "Chờ kết nối" },
  "暂无": { "en-US": "None", "vi-VN": "Chưa có" },
  "运行": { "en-US": "Running", "vi-VN": "Đang chạy" },
  "停止": { "en-US": "Stopped", "vi-VN": "Đã dừng" },
  "通讯报警": { "en-US": "Communication alarm", "vi-VN": "Cảnh báo truyền thông" },
  "正常": { "en-US": "Normal", "vi-VN": "Bình thường" },
  "质量正常": { "en-US": "Quality OK", "vi-VN": "Chất lượng OK" },
  "质量剔除": { "en-US": "Excluded by quality", "vi-VN": "Loại do chất lượng" },
  "待判断": { "en-US": "Pending", "vi-VN": "Chờ đánh giá" },
  "自动闭环": { "en-US": "Auto closed-loop", "vi-VN": "Vòng kín tự động" },
  "策略未启用": { "en-US": "Policy disabled", "vi-VN": "Chưa bật chiến lược" },
  "策略已闭环 / 子系统总闸只读": { "en-US": "Closed-loop policy / subsystem read-only", "vi-VN": "Chiến lược vòng kín / tổng khóa chỉ đọc" },
  "策略已闭环 / 等待后端总闸": { "en-US": "Closed-loop policy / waiting backend gate", "vi-VN": "Chiến lược vòng kín / chờ tổng khóa backend" },
  "人工确认后下发": { "en-US": "Dispatch after approval", "vi-VN": "Phát lệnh sau xác nhận" },
  "仅输出影子建议": { "en-US": "Shadow advice only", "vi-VN": "Chỉ xuất khuyến nghị shadow" },
  "保护阻断": { "en-US": "Protection blocked", "vi-VN": "Bị bảo vệ chặn" },
  "影子记录": { "en-US": "Shadow record", "vi-VN": "Bản ghi shadow" },
  "待审批": { "en-US": "Pending approval", "vi-VN": "Chờ phê duyệt" },
  "待适配器下发": { "en-US": "Ready for adapter", "vi-VN": "Chờ adapter phát lệnh" },
  "已下发": { "en-US": "Dispatched", "vi-VN": "Đã phát lệnh" },
  "反馈已确认": { "en-US": "Feedback confirmed", "vi-VN": "Đã xác nhận phản hồi" },
  "反馈待确认": { "en-US": "Feedback pending", "vi-VN": "Chờ xác nhận phản hồi" },
  "反馈部分确认": { "en-US": "Feedback partially confirmed", "vi-VN": "Phản hồi xác nhận một phần" },
  "反馈不一致锁定": { "en-US": "Feedback mismatch locked", "vi-VN": "Khóa do phản hồi không khớp" },
  "反馈不可校验": { "en-US": "Feedback not checkable", "vi-VN": "Không thể kiểm tra phản hồi" },
  "下发失败": { "en-US": "Dispatch failed", "vi-VN": "Phát lệnh thất bại" },
  "已回退": { "en-US": "Rolled back", "vi-VN": "Đã rollback" },
  "保持": { "en-US": "Hold", "vi-VN": "Giữ nguyên" },
  "现场已授权": { "en-US": "Field authorized", "vi-VN": "Hiện trường đã ủy quyền" },
  "授权已申请": { "en-US": "Authorization requested", "vi-VN": "Đã yêu cầu ủy quyền" },
  "授权已撤销": { "en-US": "Authorization revoked", "vi-VN": "Đã thu hồi ủy quyền" },
  "现场未授权": { "en-US": "Field not authorized", "vi-VN": "Chưa ủy quyền hiện trường" },
  "投运状态待读取": { "en-US": "Commissioning status pending", "vi-VN": "Chờ trạng thái chạy thử" },
  "允许真实下发": { "en-US": "Live dispatch allowed", "vi-VN": "Cho phép phát lệnh thật" },
  "后端只读总闸": { "en-US": "Backend read-only gate", "vi-VN": "Tổng khóa backend chỉ đọc" },
  "子系统写总闸关闭": { "en-US": "Subsystem write gate off", "vi-VN": "Tổng khóa ghi phân hệ đang tắt" },
  "BA适配器未配置": { "en-US": "BA adapter missing", "vi-VN": "Chưa cấu hình adapter BA" },
  "白名单为空": { "en-US": "Whitelist empty", "vi-VN": "Danh sách trắng trống" },
  "投运条件未满足": { "en-US": "Commissioning conditions unmet", "vi-VN": "Chưa đủ điều kiện chạy thử" },
  "总门禁待读取": { "en-US": "Final gate pending", "vi-VN": "Chờ tổng gate cuối" },
  "总门禁通过": { "en-US": "Final gate passed", "vi-VN": "Tổng gate đã qua" },
  "签核/Canary阻断": { "en-US": "Signoff / Canary blocked", "vi-VN": "Bị chặn bởi ký xác nhận / Canary" },
  "最终总门禁阻断": { "en-US": "Final master gate blocked", "vi-VN": "Tổng gate cuối bị chặn" },
  "Canary未放行": { "en-US": "Canary not released", "vi-VN": "Canary chưa được cho phép" },
  "总门禁未满足": { "en-US": "Final gate unmet", "vi-VN": "Chưa đạt tổng gate" },
  "可真实下发": { "en-US": "Dispatchable", "vi-VN": "Có thể phát lệnh" },
  "设备侧就绪 / 环境阻断": { "en-US": "Device ready / environment blocked", "vi-VN": "Thiết bị sẵn sàng / môi trường chặn" },
  "单台阻断": { "en-US": "Device blocked", "vi-VN": "Thiết bị bị chặn" },
  "未找到设备": { "en-US": "Device not found", "vi-VN": "Không tìm thấy thiết bị" },
  "可进入控制": { "en-US": "Open control", "vi-VN": "Mở điều khiển" },
  "可确认下发": { "en-US": "Ready to confirm", "vi-VN": "Sẵn sàng xác nhận phát lệnh" },
  "可预演 / 总闸阻断": { "en-US": "Can simulate / master gate blocked", "vi-VN": "Có thể mô phỏng / tổng khóa chặn" },
  "快照未找到": { "en-US": "Snapshot missing", "vi-VN": "Không có ảnh chụp" },
  "可预演 / 待投运": { "en-US": "Can simulate / pending commissioning", "vi-VN": "Có thể mô phỏng / chờ chạy thử" },
  "全量最终控制完成": { "en-US": "All-device final control complete", "vi-VN": "Hoàn tất điều khiển cuối toàn bộ thiết bị" },
  "最终控制未完成": { "en-US": "Final control incomplete", "vi-VN": "Chưa hoàn tất điều khiển cuối" },
  "验收证据缺失": { "en-US": "Acceptance evidence missing", "vi-VN": "Thiếu bằng chứng nghiệm thu" },
  "状态待读取": { "en-US": "Status pending", "vi-VN": "Chờ trạng thái" },
  "软件/环境": { "en-US": "Software / environment", "vi-VN": "Phần mềm / môi trường" },
  "BA/点位": { "en-US": "BA / points", "vi-VN": "BA / điểm đo" },
  "现场授权": { "en-US": "Field authorization", "vi-VN": "Ủy quyền hiện trường" },
  "投运验证": { "en-US": "Commissioning validation", "vi-VN": "Xác minh chạy thử" },
  "现场质量": { "en-US": "Field quality", "vi-VN": "Chất lượng hiện trường" },
  "待归类": { "en-US": "Unclassified", "vi-VN": "Chưa phân loại" },
  "现场 Arm-Check 未通过": { "en-US": "Field Arm-Check failed", "vi-VN": "Field Arm-Check chưa đạt" },
  "首台未真实下发": { "en-US": "First device not dispatched", "vi-VN": "Thiết bị đầu tiên chưa phát lệnh thật" },
  "首台反馈未确认": { "en-US": "First feedback unconfirmed", "vi-VN": "Phản hồi thiết bị đầu chưa xác nhận" },
  "小批量未确认": { "en-US": "Small batch unconfirmed", "vi-VN": "Lô nhỏ chưa xác nhận" },
  "全量反馈未确认": { "en-US": "All-device feedback unconfirmed", "vi-VN": "Phản hồi toàn bộ chưa xác nhận" },
  "0°C 异常": { "en-US": "0°C abnormal", "vi-VN": "Bất thường 0°C" },
  "温度无效": { "en-US": "Invalid temperature", "vi-VN": "Nhiệt độ không hợp lệ" },
  "通过": { "en-US": "Pass", "vi-VN": "Đạt" },
  "阻断": { "en-US": "Blocked", "vi-VN": "Bị chặn" },
  "待处理": { "en-US": "Pending", "vi-VN": "Chờ xử lý" },
  "开": { "en-US": "Open", "vi-VN": "Mở" },
  "关": { "en-US": "Closed", "vi-VN": "Đóng" },
  "台": { "en-US": "units", "vi-VN": "máy" },
  "项": { "en-US": "items", "vi-VN": "mục" },
  "行": { "en-US": "rows", "vi-VN": "dòng" },
  "条命令": { "en-US": "commands", "vi-VN": "lệnh" },
  "门禁": { "en-US": "Gate", "vi-VN": "Gate" },
  "未通过": { "en-US": "Failed", "vi-VN": "Chưa đạt" },
  "已生成": { "en-US": "Generated", "vi-VN": "Đã tạo" },
  "已阻断": { "en-US": "Blocked", "vi-VN": "Bị chặn" },
  "可生成": { "en-US": "Ready to generate", "vi-VN": "Có thể tạo" },
  "待投运": { "en-US": "Pending commissioning", "vi-VN": "Chờ chạy thử" },
  "未生成": { "en-US": "Not generated", "vi-VN": "Chưa tạo" },
  "P0 阻断项": { "en-US": "P0 blocker", "vi-VN": "Mục chặn P0" },
  "缺少证据": { "en-US": "Evidence missing", "vi-VN": "Thiếu bằng chứng" },
  "补齐现场证据后重跑开闸包": { "en-US": "Complete field evidence, then rerun the arm package", "vi-VN": "Bổ sung bằng chứng hiện trường rồi chạy lại gói mở gate" },
  "开闸检查项": { "en-US": "Arm checklist item", "vi-VN": "Mục kiểm tra mở gate" },
  "待补齐": { "en-US": "Pending completion", "vi-VN": "Chờ bổ sung" },
  "补齐后重跑开闸包": { "en-US": "Complete, then rerun the arm package", "vi-VN": "Bổ sung rồi chạy lại gói mở gate" },
  "待分配": { "en-US": "Unassigned", "vi-VN": "Chưa phân công" },
  "下一步": { "en-US": "Next step", "vi-VN": "Bước tiếp theo" },
  "待现场确认": { "en-US": "Pending field confirmation", "vi-VN": "Chờ xác nhận hiện trường" },
  "按责任人处理后刷新开闸预检": { "en-US": "Assign owner, resolve, then refresh arm precheck", "vi-VN": "Xử lý theo người phụ trách rồi làm mới precheck mở gate" },
  "签字候选": { "en-US": "Signoff candidate", "vi-VN": "Ứng viên ký xác nhận" },
  "未放行": { "en-US": "Not released", "vi-VN": "Chưa cho phép" },
  "候选": { "en-US": "Candidate", "vi-VN": "Ứng viên" },
  "已执行": { "en-US": "Executed", "vi-VN": "Đã thực thi" },
  "状态未知": { "en-US": "Status unknown", "vi-VN": "Trạng thái không rõ" },
  "存在": { "en-US": "present", "vi-VN": "có" },
  "无": { "en-US": "none", "vi-VN": "không có" },
  "就绪": { "en-US": "ready", "vi-VN": "sẵn sàng" },
  "未就绪": { "en-US": "not ready", "vi-VN": "chưa sẵn sàng" },
  "允许": { "en-US": "allowed", "vi-VN": "cho phép" },
  "禁止": { "en-US": "blocked", "vi-VN": "bị chặn" },
  "校验中": { "en-US": "Checking", "vi-VN": "Đang kiểm tra" },
  "校验反馈": { "en-US": "Check feedback", "vi-VN": "Kiểm tra phản hồi" },
  "未打开": { "en-US": "Not open", "vi-VN": "Chưa mở" },
  "首台待执行": { "en-US": "First device pending", "vi-VN": "Thiết bị đầu chờ chạy" },
  "未确认": { "en-US": "Unconfirmed", "vi-VN": "Chưa xác nhận" },
  "未完成": { "en-US": "Incomplete", "vi-VN": "Chưa hoàn tất" },
  "白名单/通讯/温度/写点已通过": { "en-US": "Whitelist / communication / temperature / write points passed", "vi-VN": "Whitelist / truyền thông / nhiệt độ / điểm ghi đã đạt" },
  "本机点位质量": { "en-US": "Device point quality", "vi-VN": "Chất lượng điểm thiết bị" },
  "后端写总闸": { "en-US": "Backend write gate", "vi-VN": "Tổng khóa ghi backend" },
  "后端写入总闸": { "en-US": "Backend write master gate", "vi-VN": "Tổng khóa ghi backend" },
  "现场 Arm-Check": { "en-US": "Field Arm-Check", "vi-VN": "Field Arm-Check" },
  "Canary顺序": { "en-US": "Canary sequence", "vi-VN": "Trình tự Canary" },
  "最终验收": { "en-US": "Final acceptance", "vi-VN": "Nghiệm thu cuối" },
  "本机反馈确认": { "en-US": "Device feedback confirmation", "vi-VN": "Xác nhận phản hồi thiết bị" },
  "完成": { "en-US": "Complete", "vi-VN": "Hoàn tất" },
  "已确认": { "en-US": "Confirmed", "vi-VN": "Đã xác nhận" },
  "跳过": { "en-US": "Skipped", "vi-VN": "Đã bỏ qua" },
  "待读取": { "en-US": "Pending data", "vi-VN": "Chờ dữ liệu" },
  "允许归档": { "en-US": "Archivable", "vi-VN": "Cho phép lưu trữ" },
  "禁止下发": { "en-US": "Dispatch blocked", "vi-VN": "Chặn phát lệnh" },
  "一致": { "en-US": "Consistent", "vi-VN": "Nhất quán" },
  "不一致": { "en-US": "Inconsistent", "vi-VN": "Không nhất quán" },
  "证据可信": { "en-US": "Evidence trusted", "vi-VN": "Bằng chứng đáng tin cậy" },
  "禁止推进": { "en-US": "Progress blocked", "vi-VN": "Chặn tiếp tục" },
  "已关闭": { "en-US": "Closed", "vi-VN": "Đã đóng" },
  "未编码": { "en-US": "No code", "vi-VN": "Chưa có mã" },
  "可归档": { "en-US": "Ready to archive", "vi-VN": "Sẵn sàng lưu trữ" },
  "已设置": { "en-US": "Set", "vi-VN": "Đã thiết lập" },
  "缺失": { "en-US": "Missing", "vi-VN": "Thiếu" }
};

function hvacText(text: string, locale: LocaleCode = getCurrentLocale()): string {
  return HVAC_TERMINAL_TEXT[text]?.[locale] || text;
}

function hvacCopy(zh: string, en: string, vi: string, locale: LocaleCode = getCurrentLocale()): string {
  if (locale === "en-US") {
    return en;
  }
  if (locale === "vi-VN") {
    return vi;
  }
  return zh;
}

let fcuBackendTextReplacements: Array<[string, string, string]> | null = null;

function translateFcuBackendText(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return "--";
  }
  const locale = getCurrentLocale();
  const direct = hvacText(raw, locale);
  if (direct !== raw || locale === "zh-CN") {
    return direct;
  }
  const literalReplacements = fcuBackendTextReplacements ?? (fcuBackendTextReplacements = ([
    ["当前时间不在授权窗口内：", "Authorization window is inactive: ", "Cửa sổ ủy quyền chưa hiệu lực: "],
    ["设备侧就绪", "Device ready", "Thiết bị sẵn sàng"],
    ["未打开：", "Not open: ", "Chưa mở: "],
    ["该 FCU 是当前首台 Canary 候选", "This FCU is the current first Canary candidate", "FCU này là ứng viên Canary đầu tiên hiện tại"],
    ["后端写入总闸", "Backend write master gate", "Tổng khóa ghi backend"],
    ["后端写总闸", "Backend write gate", "Tổng khóa ghi backend"],
    ["本机点位质量", "Device point quality", "Chất lượng điểm thiết bị"],
    ["现场 Arm-Check", "Field Arm-Check", "Field Arm-Check"],
    ["Canary顺序", "Canary sequence", "Trình tự Canary"],
    ["最终验收", "Final acceptance", "Nghiệm thu cuối"],
    ["最终控制总门禁报告可用", "Final master-gate report available", "Có báo cáo tổng gate cuối"],
    ["最终控制总门禁通过", "Final master gate passed", "Tổng gate cuối đã đạt"],
    ["最终控制证据一致", "Final evidence consistent", "Bằng chứng cuối nhất quán"],
    ["Canary 已放行", "Canary released", "Canary đã được cho phép"],
    ["设备快照存在", "Device snapshot exists", "Có ảnh chụp thiết bị"],
    ["策略启用", "Policy enabled", "Đã bật chiến lược"],
    ["单台自动闭环", "Single-device auto closed loop", "Vòng kín tự động từng thiết bị"],
    ["单台白名单非空", "Single-device whitelist is not empty", "Whitelist từng thiết bị không rỗng"],
    ["单台白名单", "Single-device whitelist", "Whitelist từng thiết bị"],
    ["通讯正常", "Communication normal", "Truyền thông bình thường"],
    ["温度有效", "Valid temperature", "Nhiệt độ hợp lệ"],
    ["设定反馈有效", "Setpoint feedback valid", "Phản hồi điểm đặt hợp lệ"],
    ["非本地手动", "Not local manual", "Không phải thủ công cục bộ"],
    ["启动写点", "Start write point", "Điểm ghi bật"],
    ["停止写点", "Stop write point", "Điểm ghi tắt"],
    ["设定写点", "Setpoint write point", "Điểm ghi cài đặt"],
    ["风速写点", "Fan-speed write point", "Điểm ghi tốc độ quạt"],
    ["反馈未锁定", "Feedback not locked", "Phản hồi chưa bị khóa"],
    ["FCU策略启用", "FCU policy enabled", "Đã bật chiến lược FCU"],
    ["控制模式为自动闭环", "Control mode is auto closed loop", "Chế độ điều khiển là vòng kín tự động"],
    ["空调末端子系统写总闸", "HVAC terminal subsystem write gate", "Tổng khóa ghi phân hệ FCU"],
    ["BA写适配器已配置", "BA write adapter configured", "Đã cấu hình adapter ghi BA"],
    ["现场授权已批准", "Field authorization approved", "Ủy quyền hiện trường đã duyệt"],
    ["现场授权责任人已记录", "Field authorization owner recorded", "Đã ghi người phụ trách ủy quyền hiện trường"],
    ["现场授权窗口已配置", "Field authorization window configured", "Đã cấu hình cửa sổ ủy quyền hiện trường"],
    ["现场授权窗口当前有效", "Field authorization window active", "Cửa sổ ủy quyền hiện trường đang hiệu lực"],
    ["FCU策略自动闭环", "FCU auto closed-loop policy", "Chiến lược vòng kín tự động FCU"],
    ["BA写适配器", "BA write adapter", "Adapter ghi BA"],
    ["白名单覆盖", "Whitelist coverage", "Phạm vi whitelist"],
    ["现场授权批准", "Field authorization approved", "Ủy quyền hiện trường đã duyệt"],
    ["授权责任人记录", "Authorization owner recorded", "Đã ghi người phụ trách ủy quyền"],
    ["授权窗口配置", "Authorization window configured", "Đã cấu hình cửa sổ ủy quyền"],
    ["授权窗口当前有效", "Authorization window active", "Cửa sổ ủy quyền đang hiệu lực"],
    ["BA写入确认已装载", "BA write confirmation armed", "Xác nhận ghi BA đã nạp"],
    ["最终控制总确认已装载", "Final rollout confirmation armed", "Xác nhận tổng cuối đã nạp"],
    ["后端环境允许真实写入", "Backend allows live writes", "Backend cho phép ghi thật"],
    ["当前后端处于只读模式", "Backend is currently read-only", "Backend hiện ở chế độ chỉ đọc"],
    ["后端允许真实写入", "Backend allows live writes", "Backend cho phép ghi thật"],
    ["当前时间处于授权窗口内", "Current time is within the authorization window", "Thời điểm hiện tại nằm trong cửa sổ ủy quyền"],
    ["全局投运闸门已打开", "Global commissioning gate is open", "Gate chạy thử toàn cục đã mở"],
    ["全局投运闸门", "Global commissioning gate", "Gate chạy thử toàn cục"],
    ["反馈后再扩大", "Expand after feedback", "Mở rộng sau phản hồi"],
    ["执行策略要求单台反馈校验通过后再扩大", "Policy requires one-device feedback verification before expansion", "Chiến lược yêu cầu xác minh phản hồi từng thiết bị trước khi mở rộng"],
    ["白名单/通讯/温度/写点已通过", "Whitelist / communication / temperature / write points passed", "Whitelist / truyền thông / nhiệt độ / điểm ghi đã đạt"],
    ["重跑 Arm-Check 后执行 Canary 首台", "Rerun Arm-Check before first Canary", "Chạy lại Arm-Check trước Canary đầu"],
    ["只允许先下发单台设定或风速命令；反馈校验通过后再进入下一台", "Only one setpoint or fan-speed command may be sent first; move to the next device after feedback verification passes", "Chỉ được phát một lệnh điểm đặt hoặc tốc độ quạt trước; chuyển sang thiết bị tiếp theo sau khi xác minh phản hồi đạt"],
    ["真实下发后必须在 60-120 秒内校验设定反馈；不一致时锁定设备并回退", "After live dispatch, verify setpoint feedback within 60-120 seconds; lock and roll back if mismatched", "Sau phát lệnh thật, xác minh phản hồi điểm đặt trong 60-120 giây; khóa và rollback nếu không khớp"],
    ["BF" + "F 写入总闸", "Interface write master gate", "Tổng khóa ghi giao diện"],
    ["BA 写入二次确认", "BA write secondary confirmation", "Xác nhận ghi BA lần hai"],
    ["真实 BA 写入需要二次确认，防止误触发", "Live BA write requires secondary confirmation to prevent accidental triggering", "Ghi BA thật cần xác nhận lần hai để tránh kích hoạt nhầm"],
    ["执行首台 Canary 并确认反馈", "Execute first Canary and confirm feedback", "Thực thi Canary đầu và xác nhận phản hồi"],
    ["最终控制必须先完成首台真实下发和反馈确认", "Final control must first complete first-device live dispatch and feedback confirmation", "Điều khiển cuối phải hoàn tất phát lệnh thật thiết bị đầu và xác nhận phản hồi trước"],
    ["Canary 写点映射完整", "Canary write-point mapping complete", "Hoàn tất ánh xạ điểm ghi Canary"],
    ["只有质量整改清零、全量分批计划无设备阻断后，才允许进入首台真实写入 Canary", "Enter first live-write Canary only after quality remediation is cleared and the all-device batch plan has no device blockers", "Chỉ vào Canary ghi thật đầu sau khi xử lý chất lượng xong và kế hoạch phân lô toàn bộ không còn thiết bị bị chặn"],
    ["人工签字确认后再设置确认短语", "Set the confirmation phrase after manual signoff", "Thiết lập cụm xác nhận sau khi ký xác nhận thủ công"],
    ["执行 verify-feedback，确认 feedback_confirmed 后才允许扩批", "Run verify-feedback; expand only after feedback_confirmed is confirmed", "Chạy verify-feedback; chỉ mở rộng sau khi xác nhận feedback_confirmed"],
    ["反馈不一致、通讯报警、温度异常、投诉或本地抢控制即回退", "Rollback on feedback mismatch, communication alarm, abnormal temperature, complaint, or local control override", "Rollback khi phản hồi không khớp, cảnh báo truyền thông, nhiệt độ bất thường, khiếu nại hoặc điều khiển cục bộ giành quyền"],
    ["如执行报告生成 recordId：", "If the execution report generated recordId: ", "Nếu báo cáo thực thi tạo recordId: "],
    ["通过 FCU Canary 总门禁后再执行首台下发", "Run the first dispatch only after the FCU Canary master gate passes", "Chỉ phát lệnh đầu sau khi tổng gate FCU Canary đạt"],
    ["没有总确认时编排器不会调用 Canary/小批量/全量真实执行" + "脚" + "本", "The orchestrator will not call Canary, small-batch, or all-device live execution routines without final confirmation", "Bộ điều phối sẽ không gọi quy trình thực thi thật Canary, lô nhỏ hoặc toàn bộ nếu thiếu xác nhận tổng"],
    ["首台 Canary 必须同时满足现场签字、实时 closeout、Arm-Check、BA 写适配器和执行包门禁，不能只看单个执行命令", "The first Canary must satisfy field signoff, live closeout, Arm-Check, BA write adapter, and execution-package gates together; a single execution command is not enough", "Canary đầu phải đồng thời đạt ký xác nhận hiện trường, closeout live, Arm-Check, adapter ghi BA và gate gói thực thi; không chỉ nhìn một lệnh thực thi riêng lẻ"],
    ["关闭 FCU 现场 P0 消缺后再进入 Canary", "Close FCU field P0 remediation before entering Canary", "Đóng khắc phục P0 hiện trường FCU trước khi vào Canary"],
    ["设置 BA 写入确认短语", "Set BA write confirmation phrase", "Thiết lập cụm xác nhận ghi BA"],
    ["设置最终控制总确认短语", "Set final rollout confirmation phrase", "Thiết lập cụm xác nhận tổng cuối"],
    ["真实写入确认短语", "Live-write confirmation phrase", "Cụm xác nhận ghi thật"],
    ["反馈校验与失败回退", "Feedback verification and rollback on failure", "Xác minh phản hồi và rollback khi lỗi"],
    ["60-120 秒内反馈校验", "Verify feedback within 60-120 seconds", "Xác minh phản hồi trong 60-120 giây"],
    ["回退和锁定准备", "Rollback and lockout preparation", "Chuẩn bị rollback và khóa"],
    ["现场授权真实 BA 写入", "Authorize live BA write on site", "Ủy quyền ghi BA thật tại hiện trường"],
    ["执行 BGS01 单台 Canary", "Execute BGS01 single-device Canary", "Thực thi Canary một thiết bị BGS01"],
    ["业主值班长", "Owner duty lead", "Trưởng ca chủ đầu tư"],
    ["平台工程师", "Platform engineer", "Kỹ sư nền tảng"],
    ["BA工程师", "BA engineer", "Kỹ sư BA"],
    ["现场值班", "site duty", "trực hiện trường"],
    ["现场负责人", "site owner", "phụ trách hiện trường"],
    ["项目负责人", "project owner", "phụ trách dự án"],
    ["甲方/运维", "owner / O&M", "chủ đầu tư / vận hành"],
    ["明确授权单台", "explicitly authorized single-device", "ủy quyền rõ ràng cho từng thiết bị"],
    ["试写，窗口内有人值守", "test write with staffed authorization window", "ghi thử trong cửa sổ có người trực"],
    ["数据质量 P0", "Data quality P0", "Chất lượng dữ liệu P0"],
    ["全量分批计划", "All-device batch plan", "Kế hoạch theo lô toàn bộ thiết bị"],
    ["现场执行包", "Field execution pack", "Gói thực hiện hiện trường"],
    ["现场 closeout", "Field closeout", "Closeout hiện trường"],
    ["反馈未确认", "Feedback unconfirmed", "Phản hồi chưa xác nhận"],
    ["复核设定反馈点", "Review setpoint feedback point", "Kiểm tra điểm phản hồi điểm đặt"],
    ["，超出策略边界时禁止自动闭环，需人工确认后分步拉回", "; block auto closed loop when outside policy limits and return in stages after manual confirmation", "; chặn vòng kín tự động khi vượt giới hạn chiến lược và điều chỉnh về theo bước sau xác nhận thủ công"],
    ["现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位", "Verify FCU controller power, communication wiring, address, gateway polling, and BA communication-alarm reset on site", "Kiểm tra tại hiện trường nguồn bộ điều khiển FCU, dây truyền thông, địa chỉ, polling gateway và reset cảnh báo truyền thông BA"],
    ["核对通讯报警点", "Check communication-alarm point", "Kiểm tra điểm cảnh báo truyền thông"],
    ["是否仍为 1", "whether it remains 1", "xem còn bằng 1 hay không"],
    ["生成小批量预演执行单", "Generate small-batch simulation sheet", "Tạo phiếu mô phỏng lô nhỏ"],
    ["生成全量分批计划", "Generate all-device batch plan", "Tạo kế hoạch theo lô toàn bộ thiết bị"],
    ["上线前预检", "Go-live preflight", "Kiểm tra trước khi vận hành"],
    ["生成首台 Canary 队列", "Generate first Canary queue", "Tạo hàng đợi Canary đầu tiên"],
    ["生成最终控制 Runbook", "Generate final-control runbook", "Tạo runbook điều khiển cuối"],
    ["生成首台 Canary 执行包", "Generate first Canary execution pack", "Tạo gói thực thi Canary đầu tiên"],
    ["BA 写适配器自检", "BA write-adapter self-check", "Tự kiểm tra adapter ghi BA"],
    ["Canary 总门禁", "Canary master gate", "Gate tổng Canary"],
    ["最终控制总门禁", "Final-control master gate", "Gate tổng điều khiển cuối"],
    ["最终控制完成度检查", "Final-control completion check", "Kiểm tra mức hoàn tất điều khiển cuối"],
    ["生成最终控制投运清单", "Generate final-control commissioning checklist", "Tạo checklist chạy thử điều khiển cuối"],
    ["执行首台 Canary", "Execute first Canary", "Thực thi Canary đầu tiên"],
    ["执行小批量", "Execute small batch", "Thực thi lô nhỏ"],
    ["执行全量波次", "Execute all-device waves", "Thực thi các đợt toàn bộ thiết bị"],
    ["最终控制总确认短语", "Final-control master confirmation phrase", "Cụm xác nhận tổng điều khiển cuối"],
    ["真实 BA 写入确认短语", "Live BA write confirmation phrase", "Cụm xác nhận ghi BA thật"],
    ["写入环境", "Write environment", "Môi trường ghi"],
    ["首台 Canary", "First Canary", "Canary đầu tiên"],
    ["小批量", "Small batch", "Lô nhỏ"],
    ["质量整改", "Quality remediation", "Xử lý chất lượng"],
    ["设定分步拉回", "Staged setpoint return", "Điều chỉnh điểm đặt theo bước"],
    ["现场消缺关闭", "Field remediation closeout", "Đóng xử lý hiện trường"],
    ["签字输入", "Signoff input", "Dữ liệu ký xác nhận"],
    ["旧工单", "stale work orders", "phiếu việc cũ"],
    ["现场签字", "Field signoff", "Ký xác nhận hiện trường"],
    ["全量反馈", "All-device feedback", "Phản hồi toàn bộ thiết bị"],
    ["关闭 BF" + "F 只读总闸并重启", "Disable the BF" + "F read-only gate and restart", "Tắt gate chỉ đọc BF" + "F và khởi động lại"],
    ["当前 readOnlyMode=true，后端禁止真实 BA 写入", "readOnlyMode is currently true; the backend blocks live BA writes", "readOnlyMode hiện là true; backend chặn ghi BA thật"],
    ["重跑上线前预检", "Rerun go-live preflight", "Chạy lại kiểm tra trước khi vận hành"],
    ["预检必须为 go_live_ready 才允许真实下发", "Preflight must be go_live_ready before live dispatch is allowed", "Preflight phải là go_live_ready mới cho phép phát lệnh thật"],
    ["重跑Field Arm-Check", "Rerun Field Arm-Check", "Chạy lại Field Arm-Check"],
    ["Field Arm-Check 必须 ready，才能执行首台 Canary", "Field Arm-Check must be ready before the first Canary can run", "Field Arm-Check phải ready mới được chạy Canary đầu tiên"],
    ["先清理过期签核行，生成 current-only 输入表", "Clean stale signoff rows first and generate the current-only input sheet", "Dọn các dòng ký xác nhận cũ trước và tạo bảng đầu vào current-only"],
    ["0°C异常", "0°C abnormal", "Bất thường 0°C"],
    ["先恢复通讯报警，再做温度和设定反馈复核", "Restore communication alarms first, then review temperature and setpoint feedback", "Khôi phục cảnh báo truyền thông trước, sau đó kiểm tra nhiệt độ và phản hồi điểm đặt"],
    ["在 5-45°C", "within 5-45°C", "trong 5-45°C"],
    ["通讯=必填：0；温度=必填：5-45；设定反馈=必填：10-32；写点=必填：yes/no；连续采样=必填：yes/no；手动锁定=必填：none/manual/lockout；放行=必填：hold/recheck/release", "communication=required: 0; temperature=required: 5-45; setpoint feedback=required: 10-32; write point=required: yes/no; continuous samples=required: yes/no; manual lock=required: none/manual/lockout; release=required: hold/recheck/release", "truyền thông=bắt buộc: 0; nhiệt độ=bắt buộc: 5-45; phản hồi điểm đặt=bắt buộc: 10-32; điểm ghi=bắt buộc: yes/no; mẫu liên tục=bắt buộc: yes/no; khóa thủ công=bắt buộc: none/manual/lockout; cho phép=bắt buộc: hold/recheck/release"],
    ["通讯=必填：0；温度=可选；设定反馈=可选；写点=必填：yes/no；连续采样=必填：yes/no；手动锁定=必填：none/manual/lockout；放行=必填：hold/recheck/release", "communication=required: 0; temperature=optional; setpoint feedback=optional; write point=required: yes/no; continuous samples=required: yes/no; manual lock=required: none/manual/lockout; release=required: hold/recheck/release", "truyền thông=bắt buộc: 0; nhiệt độ=tùy chọn; phản hồi điểm đặt=tùy chọn; điểm ghi=bắt buộc: yes/no; mẫu liên tục=bắt buộc: yes/no; khóa thủ công=bắt buộc: none/manual/lockout; cho phép=bắt buộc: hold/recheck/release"],
    ["填写实际处理人，不能用空值或系统默认值", "Enter the actual handler; empty or system-default values are not allowed", "Nhập người xử lý thực tế; không được để trống hoặc dùng giá trị mặc định hệ thống"],
    ["填写处理完成时间，例如", "Enter the completion time, for example", "Nhập thời gian hoàn tất, ví dụ"],
    ["补齐所有 onsiteReleaseReady=false 的现场签字字段", "Complete all field signoff fields where onsiteReleaseReady=false", "Hoàn tất mọi trường ký xác nhận hiện trường có onsiteReleaseReady=false"],
    ["重跑", "Rerun ", "Chạy lại "],
    ["handledBy=现场处理人姓名 / handledAt=现场处理完成时间，建议 ISO 时间 / reviewedBy=复核人姓名 / reviewedAt=复核完成时间，建议 ISO 时间", "handledBy=field handler name / handledAt=field completion time, ISO recommended / reviewedBy=reviewer name / reviewedAt=review completion time, ISO recommended", "handledBy=tên người xử lý hiện trường / handledAt=thời gian hoàn tất hiện trường, nên dùng ISO / reviewedBy=tên người kiểm tra / reviewedAt=thời gian hoàn tất kiểm tra, nên dùng ISO"],
    ["现场/运维", "Field / O&M", "Hiện trường / vận hành"],
    ["实时消缺", "Live remediation", "Xử lý thời gian thực"],
    ["现场/平台", "Field / platform", "Hiện trường / nền tảng"],
    ["现场/BA", "Field / BA", "Hiện trường / BA"],
    ["BA/自控", "BA / controls", "BA / tự động hóa"],
    ["Canary执行包", "Canary execution pack", "Gói thực thi Canary"],
    ["安全边界", "Safety boundary", "Biên an toàn"],
    ["保持证据", "Keep evidence", "Giữ bằng chứng"],
    ["当前 /healthz readOnlyMode=true 时禁止真实写 BA", "Live BA writes are blocked while /healthz reports readOnlyMode=true", "Chặn ghi BA thật khi /healthz báo readOnlyMode=true"],
    ["只有 field_arm_ready 才允许进入 Canary", "Canary is allowed only when field_arm_ready", "Chỉ cho phép vào Canary khi field_arm_ready"],
    ["执行首台 Canary 并等待反馈确认", "Execute the first Canary and wait for feedback confirmation", "Thực thi Canary đầu tiên và chờ xác nhận phản hồi"],
    ["最终控制最小完成口径要求首台真实下发并反馈确认", "Minimum final-control completion requires first-device live dispatch and feedback confirmation", "Mức hoàn tất tối thiểu của điều khiển cuối yêu cầu phát lệnh thật thiết bị đầu tiên và xác nhận phản hồi"],
    ["打开全局投运闸门", "Open the global commissioning gate", "Mở gate chạy thử toàn cục"],
    ["后端只读总闸 / 子系统写总闸 / BA适配器", "Backend read-only gate / subsystem write gate / BA adapter", "Gate chỉ đọc backend / gate ghi phân hệ / adapter BA"],
    ["必须 ready，才能", "must be ready before ", "phải ready mới được "],
    ["现场处理人姓名", "field handler name", "tên người xử lý hiện trường"],
    ["现场处理完成时间", "field completion time", "thời gian hoàn tất hiện trường"],
    ["复核人姓名", "reviewer name", "tên người kiểm tra"],
    ["复核完成时间", "review completion time", "thời gian hoàn tất kiểm tra"],
    ["建议 ISO 时间", "ISO time recommended", "nên dùng thời gian ISO"],
    ["填写并复核", "Complete and review", "Điền và kiểm tra"],
    ["后重跑", "then rerun", "sau đó chạy lại"],
    ["，必须", "; must be", "; phải"],
    ["窗口、确认短语和 readOnly 必须通过", "authorization window, confirmation phrase, and readOnly checks must pass", "cửa sổ ủy quyền, cụm xác nhận và kiểm tra readOnly phải đạt"],
    ["写点映射、确认短语和执行闸门必须通过", "write-point mapping, confirmation phrase, and execution gate must pass", "ánh xạ điểm ghi, cụm xác nhận và gate thực thi phải đạt"],
    ["确保 blockers 为空", "ensure blockers is empty", "đảm bảo blockers rỗng"],
    ["平台", "Platform", "Nền tảng"],
    ["仍需处理单台通讯、温度或写点问题", "still require per-device communication, temperature, or write-point remediation", "vẫn cần xử lý vấn đề truyền thông, nhiệt độ hoặc điểm ghi từng thiết bị"],
    ["处理单台质量阻断", "Resolve per-device quality blockers", "Xử lý chặn chất lượng từng thiết bị"],
    ...Object.entries(HVAC_TERMINAL_TEXT)
      .filter(([zh]) => zh.length > 1)
      .map(([zh, translations]) => [zh, translations["en-US"], translations["vi-VN"]] as [string, string, string])
  ] as Array<[string, string, string]>).sort((left, right) => right[0].length - left[0].length));
  let output = raw;
  literalReplacements.forEach(([zh, en, vi]) => {
    output = output.split(zh).join(hvacCopy(zh, en, vi, locale));
  });
  output = output.replace(/(\d+)\/(\d+)\s*台(?=[\p{L}\p{N}])/gu, `$1/$2 ${hvacText("台", locale)} `);
  output = output.replace(/(\d+)\s*台(?=[\p{L}\p{N}])/gu, `$1 ${hvacText("台", locale)} `);
  output = output.replace(/(\d+)\s*行(?=[\p{L}\p{N}])/gu, `$1 ${hvacText("行", locale)} `);
  output = output.replace(/(\d+)\s*项(?=[\p{L}\p{N}])/gu, `$1 ${hvacText("项", locale)} `);
  output = output.replace(/(\d+)\/(\d+)\s*台/g, `$1/$2 ${hvacText("台", locale)}`);
  output = output.replace(/(\d+)\s*台/g, `$1 ${hvacText("台", locale)}`);
  output = output.replace(/(\d+)\s*行/g, `$1 ${hvacText("行", locale)}`);
  output = output.replace(/(\d+)\s*项/g, `$1 ${hvacText("项", locale)}`);
  output = output
    .replace(/，/g, ", ")
    .replace(/；/g, "; ")
    .replace(/、/g, " / ")
    .replace(/：/g, ": ")
    .replace(/。/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  return output;
}

function formatFcuError(error: unknown, zh: string, en: string, vi: string): string {
  if (error instanceof Error && error.message.trim()) {
    return translateFcuBackendText(error.message);
  }
  return hvacCopy(zh, en, vi);
}

function hvacUnit(unit: string): string {
  return hvacText(unit);
}

function formatCompactCount(count: number | null | undefined, unitZh: string): string {
  return `${count ?? 0} ${hvacUnit(unitZh)}`;
}

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

function isCurrentSiteFanCoilSnapshot(snapshot: FanCoilTerminalSnapshotDto, siteId: string): boolean {
  return siteIdsEquivalent(snapshot.site?.siteId, siteId)
    && snapshot.subsystemType === "hvac_terminal"
    && snapshot.equipmentType === "fan_coil";
}

function hasFanCoilOperationalEvidence(snapshot: FanCoilTerminalSnapshotDto): boolean {
  return (snapshot.items?.length || 0) > 0
    && (snapshot.summary?.dataStatus === "ok" || snapshot.sourceStatus?.overall === "ok");
}

function isCurrentSiteFinalControlStatus(status: FcuFinalControlStatusDto, siteId: string): boolean {
  return status.dataScope?.applied === true
    && siteIdsEquivalent(status.dataScope.siteId, siteId)
    && status.dataScope.effectiveSubsystemType === "hvac_terminal";
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
    return hvacText("低");
  }
  if (value === "medium") {
    return hvacText("中");
  }
  if (value === "high") {
    return hvacText("高");
  }
  return hvacText("自动");
}

function isDemoData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return isSubsystemDemoData(item);
}

function waitingForRealData(item: RuntimeSubsystemCapabilityDto | null): boolean {
  return isSubsystemWaitingForRealData(item);
}

function formatStatus(item: RuntimeSubsystemCapabilityDto | null): string {
  return hvacText(getSubsystemStatusPresentation(item).detailLabel);
}

function statusTone(item: RuntimeSubsystemCapabilityDto | null): Tone {
  return getSubsystemStatusPresentation(item).tone;
}

function formatDataStatus(item: RuntimeSubsystemCapabilityDto | null, fanCoilReady: boolean): string {
  if (fanCoilReady) {
    return hvacText("BA实时快照");
  }
  return hvacText(getSubsystemStatusPresentation(item).dataLabel);
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatMetricValue(enabled: boolean, ready: boolean, stale: boolean, value: string): string {
  if (!enabled) {
    return hvacText("未配置");
  }
  if (stale) {
    return hvacCopy("不可用", "Unavailable", "Không khả dụng");
  }
  return ready ? value : hvacText("待接入");
}

function formatSampleTime(value: string | null | undefined): string {
  if (!value) {
    return hvacText("暂无");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const locale = getCurrentLocale();
  return date.toLocaleString(locale, {
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
    return hvacText("运行");
  }
  if (value === false) {
    return hvacText("停止");
  }
  return hvacText("未知");
}

function formatAlarmState(value: boolean | null | undefined): string {
  if (value === true) {
    return hvacText("通讯报警");
  }
  if (value === false) {
    return hvacText("正常");
  }
  return hvacText("未知");
}

function formatQualityStatus(value: string | null | undefined): string {
  if (value === "ok") {
    return hvacText("质量正常");
  }
  if (value === "invalid") {
    return hvacText("质量剔除");
  }
  return value || hvacText("待判断");
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
    return hvacText("自动闭环");
  }
  if (value === "assisted") {
    return hvacText("人工确认");
  }
  return hvacText("影子建议");
}

function formatFcuControlStatus(value: string | null | undefined): string {
  if (value === "blocked") {
    return hvacText("保护阻断");
  }
  if (value === "shadow") {
    return hvacText("影子记录");
  }
  if (value === "pending_approval") {
    return hvacText("待审批");
  }
  if (value === "ready") {
    return hvacText("待适配器下发");
  }
  if (value === "dispatched") {
    return hvacText("已下发");
  }
  if (value === "feedback_confirmed") {
    return hvacText("反馈已确认");
  }
  if (value === "feedback_pending") {
    return hvacText("反馈待确认");
  }
  if (value === "feedback_partial") {
    return hvacText("反馈部分确认");
  }
  if (value === "feedback_mismatch_locked") {
    return hvacText("反馈不一致锁定");
  }
  if (value === "feedback_not_checkable") {
    return hvacText("反馈不可校验");
  }
  if (value === "dispatch_failed") {
    return hvacText("下发失败");
  }
  if (value === "rolled_back") {
    return hvacText("已回退");
  }
  if (value === "held") {
    return hvacText("保持");
  }
  return value || hvacText("未知");
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
    return hvacText("策略未启用");
  }
  if (policy.defaultMode === "enforced") {
    if (terminalSubsystem?.controlBoundary?.writeEnabled === false) {
      return hvacText("策略已闭环 / 子系统总闸只读");
    }
    return hvacText("策略已闭环 / 等待后端总闸");
  }
  if (policy.defaultMode === "assisted") {
    return hvacText("人工确认后下发");
  }
  return hvacText("仅输出影子建议");
}

function formatFcuFieldAuthorizationStatus(value: string | null | undefined): string {
  if (value === "approved") {
    return hvacText("现场已授权");
  }
  if (value === "requested") {
    return hvacText("授权已申请");
  }
  if (value === "revoked") {
    return hvacText("授权已撤销");
  }
  return hvacText("现场未授权");
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
    return hvacText("投运状态待读取");
  }
  if (gate.dispatchAllowed) {
    return hvacText("允许真实下发");
  }
  if (gate.readOnlyMode) {
    return hvacText("后端只读总闸");
  }
  if (!gate.subsystemWriteEnabled) {
    return hvacText("子系统写总闸关闭");
  }
  if (!gate.adapterConfigured) {
    return hvacText("BA适配器未配置");
  }
  if (!gate.whitelistCount) {
    return hvacText("白名单为空");
  }
  return hvacText("投运条件未满足");
}

function formatFcuFinalDispatchGateSummary(gate: FcuControlPolicyResponseDto["finalDispatchGate"] | null | undefined): string {
  if (!gate) {
    return hvacText("总门禁待读取");
  }
  if (gate.dispatchAllowed) {
    return hvacText("总门禁通过");
  }
  const finalGateBlocked = gate.blockedReasons?.includes("final_control_gates_passed");
  const canaryBlocked = gate.blockedReasons?.includes("final_canary_ready");
  if (finalGateBlocked && canaryBlocked) {
    return hvacText("签核/Canary阻断");
  }
  if (finalGateBlocked) {
    return hvacText("最终总门禁阻断");
  }
  if (canaryBlocked) {
    return hvacText("Canary未放行");
  }
  return hvacText("总门禁未满足");
}

function formatFcuCommissioningStatus(value: string | null | undefined): string {
  if (value === "ready") {
    return hvacText("可真实下发");
  }
  if (value === "environment_blocked") {
    return hvacText("设备侧就绪 / 环境阻断");
  }
  if (value === "blocked") {
    return hvacText("单台阻断");
  }
  if (value === "not_found") {
    return hvacText("未找到设备");
  }
  return value || hvacText("投运状态待读取");
}

function formatFcuControlEntryStatus(
  commissioningStatus?: FcuDeviceCommissioningStatusResponseDto["commissioningStatus"] | null
): { label: string; tone: Tone } {
  if (!commissioningStatus) {
    return { label: hvacText("可进入控制"), tone: "neutral" };
  }
  if (commissioningStatus.canDispatch) {
    return { label: hvacText("可确认下发"), tone: "good" };
  }
  if (commissioningStatus.deviceReady) {
    return { label: hvacText("可预演 / 总闸阻断"), tone: "neutral" };
  }
  if (commissioningStatus.status === "not_found") {
    return { label: hvacText("快照未找到"), tone: "warn" };
  }
  return { label: hvacText("可预演 / 待投运"), tone: "warn" };
}

function formatFcuFinalVerdict(value: string | null | undefined): string {
  if (value === "fcu_all_device_control_complete") {
    return hvacText("全量最终控制完成");
  }
  if (value === "final_control_incomplete") {
    return hvacText("最终控制未完成");
  }
  if (value === "final_control_status_unavailable") {
    return hvacText("验收证据缺失");
  }
  return value || hvacText("状态待读取");
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
    return { label: hvacText("软件/环境"), tone: "warn" };
  }
  if (normalizedKey.includes("ba") || normalizedKey.includes("mapping") || normalizedKey.includes("write") || normalizedPhase === "mapping") {
    return { label: hvacText("BA/点位"), tone: "neutral" };
  }
  if (normalizedKey.includes("arm") || normalizedKey.includes("authorization") || normalizedPhase === "authorization") {
    return { label: hvacText("现场授权"), tone: "warn" };
  }
  if (
    normalizedKey.includes("canary") ||
    normalizedKey.includes("feedback") ||
    normalizedKey.includes("rollback") ||
    normalizedPhase === "dispatch" ||
    normalizedPhase === "feedback" ||
    normalizedPhase === "rollback"
  ) {
    return { label: hvacText("投运验证"), tone: "neutral" };
  }
  if (normalizedKey.includes("quality") || normalizedKey.includes("temperature") || normalizedKey.includes("communication")) {
    return { label: hvacText("现场质量"), tone: "warn" };
  }
  return { label: hvacText("待归类"), tone: "neutral" };
}

function rankFcuFieldArmAction(key: string | null | undefined, category: string): number {
  const normalizedKey = String(key || "").toLowerCase();
  if (normalizedKey.includes("backend") || normalizedKey.includes("write_gate") || normalizedKey.includes("readonly")) {
    return 10;
  }
  if (normalizedKey.includes("confirm")) {
    return 20;
  }
  if (normalizedKey.includes("arm") || category === hvacText("现场授权")) {
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
    if (category === hvacText("软件/环境")) {
      return 4;
    }
    if (category === hvacText("现场授权")) {
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
    return hvacText("后端只读总闸");
  }
  if (value === "field_arm_ready") {
    return hvacText("现场 Arm-Check 未通过");
  }
  if (value === "canary_dispatch_confirmed") {
    return hvacText("首台未真实下发");
  }
  if (value === "canary_feedback_confirmed") {
    return hvacText("首台反馈未确认");
  }
  if (value === "small_batch_confirmed") {
    return hvacText("小批量未确认");
  }
  if (value === "all_device_feedback_confirmed") {
    return hvacText("全量反馈未确认");
  }
  if (value === "communication_alarm") {
    return hvacText("通讯报警");
  }
  if (value === "zero_temperature") {
    return hvacText("0°C 异常");
  }
  if (value === "invalid_temperature") {
    return hvacText("温度无效");
  }
  return value || "--";
}

function formatFcuWorklistStatus(value: string | null | undefined): string {
  if (value === "ready") {
    return hvacText("通过");
  }
  if (value === "blocked") {
    return hvacText("阻断");
  }
  return hvacText("待处理");
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
  entryLabel = hvacText("可进入控制")
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
          <strong>{item.deviceName || hvacCopy("风机盘管", "Fan coil", "FCU")}</strong>
          <span>{item.deviceCode || "--"} · {translateFcuBackendText(item.deviceTypeName || "FCU")}</span>
        </div>
        <span className={`status-pill ${alarmTone}`}>{formatAlarmState(item.communicationAlarm)}</span>
      </header>
      <div className="fan-coil-values">
        <div>
          <span>{hvacCopy("温度", "Temp", "Nhiệt độ")}</span>
          <strong>{formatNumber(item.zoneTemperatureC, 1)}<small>°C</small></strong>
        </div>
        <div>
          <span>{hvacCopy("设定", "Setpoint", "Cài đặt")}</span>
          <strong>{formatNumber(setpoint, 1)}<small>°C</small></strong>
        </div>
        <div>
          <span>{hvacCopy("阀门", "Valve", "Van")}</span>
          <strong>{item.valveOpen == null ? "--" : item.valveOpen ? hvacText("开") : hvacText("关")}</strong>
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
        <span>{hvacCopy("风速", "Fan", "Gió")} {formatNumber(item.fanSpeedState, 0)}</span>
      </div>
      <footer>
        <span>{hvacCopy("快照", "Snapshot", "Ảnh chụp")} {formatSampleTime(item.sampledAt)}</span>
        <span>{item.pointCount || 0} {hvacCopy("点", "points", "điểm")} · {hvacCopy("写点展示", "Writable shown", "Điểm ghi hiển thị")} {item.writablePointCount || 0}</span>
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

  function clearFcuOperationalEvidence() {
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
        if (!isCurrentSiteFanCoilSnapshot(snapshot, siteId)) {
          setFanCoils(null);
          clearFcuOperationalEvidence();
          setErrorText(hvacCopy(
            "空调末端响应未能证明属于当前项目，已阻止加载控制与验收证据。",
            "The HVAC-terminal response did not prove it belongs to the current project. Control and acceptance evidence was blocked.",
            "Phản hồi thiết bị đầu cuối HVAC không chứng minh thuộc dự án hiện tại; bằng chứng điều khiển và nghiệm thu đã bị chặn."
          ));
          return;
        }
        setFanCoils(snapshot);
        if (!hasFanCoilOperationalEvidence(snapshot)) {
          clearFcuOperationalEvidence();
          return;
        }
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
        setFanCoilHistory(historyResult.status === "fulfilled" ? historyResult.value : null);
        setControlPolicy(policyResult.status === "fulfilled" ? policyResult.value : null);
        setControlRecords(recordsResult.status === "fulfilled" ? recordsResult.value : null);
        setDeviceCommissioningStatus(commissioningResult.status === "fulfilled" ? commissioningResult.value : null);
        setFieldArmCheck(armCheckResult.status === "fulfilled" ? armCheckResult.value : null);
        setFinalControlStatus(
          finalStatusResult.status === "fulfilled" && isCurrentSiteFinalControlStatus(finalStatusResult.value, siteId)
            ? finalStatusResult.value
            : null
        );
      } else {
        setFanCoils(null);
        clearFcuOperationalEvidence();
      }
    } catch (error) {
      setCapabilities(null);
      setFanCoils(null);
      clearFcuOperationalEvidence();
      setErrorText(formatFcuError(error, "空调末端数据读取失败", "Failed to load HVAC terminal data", "Không thể tải dữ liệu FCU"));
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
        hvacCopy(
          `${dispatch ? (result.dispatchAllowed ? "确认下发完成" : "确认请求已按只读保护记录") : "控制预演完成"}${targetDeviceCode ? `（${targetDeviceCode}）` : ""}：${result.summary?.commandCount || 0} 条命令候选，${result.summary?.blockedCount || 0} 台保护阻断，写控制副作用 ${result.summary?.controlMutation ? "存在" : "无"}。`,
          `${dispatch ? (result.dispatchAllowed ? "Confirmed dispatch completed" : "Confirmation recorded under read-only protection") : "Control simulation completed"}${targetDeviceCode ? ` (${targetDeviceCode})` : ""}: ${result.summary?.commandCount || 0} command candidates, ${result.summary?.blockedCount || 0} devices blocked by protection, control write side effect ${result.summary?.controlMutation ? "present" : "none"}.`,
          `${dispatch ? (result.dispatchAllowed ? "Đã hoàn tất phát lệnh xác nhận" : "Yêu cầu xác nhận đã được ghi theo bảo vệ chỉ đọc") : "Đã hoàn tất mô phỏng điều khiển"}${targetDeviceCode ? ` (${targetDeviceCode})` : ""}: ${result.summary?.commandCount || 0} lệnh ứng viên, ${result.summary?.blockedCount || 0} thiết bị bị bảo vệ chặn, tác dụng ghi điều khiển ${result.summary?.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 控制周期执行失败", "FCU control cycle failed", "Chu kỳ điều khiển FCU thất bại"));
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
      setErrorText(hvacCopy("温度设定值无效，请输入数字。", "Invalid temperature setpoint. Enter a number.", "Điểm đặt nhiệt độ không hợp lệ. Hãy nhập số."));
      return;
    }
    if (dispatch && lastControlPreviewSignature !== signature) {
      setErrorText(hvacCopy(
        "当前手动命令未完成同目标预演，请先预演后再确认下发。",
        "This manual command has not been simulated for the current target. Simulate it before confirming dispatch.",
        "Lệnh thủ công này chưa được mô phỏng cho thiết bị hiện tại. Hãy mô phỏng trước khi xác nhận phát lệnh."
      ));
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
        hvacCopy(
          `${dispatch ? (result.dispatchAllowed ? "手动命令确认下发完成" : "手动命令确认请求已按只读保护记录") : "手动命令预演完成"}（${targetDeviceCode}）：${result.summary?.commandCount || 0} 条命令候选，${result.summary?.blockedCount || 0} 台保护阻断，写控制副作用 ${result.summary?.controlMutation ? "存在" : "无"}。`,
          `${dispatch ? (result.dispatchAllowed ? "Manual command dispatch completed" : "Manual command confirmation recorded under read-only protection") : "Manual command simulation completed"} (${targetDeviceCode}): ${result.summary?.commandCount || 0} command candidates, ${result.summary?.blockedCount || 0} devices blocked by protection, control write side effect ${result.summary?.controlMutation ? "present" : "none"}.`,
          `${dispatch ? (result.dispatchAllowed ? "Đã hoàn tất phát lệnh thủ công" : "Xác nhận lệnh thủ công đã được ghi theo bảo vệ chỉ đọc") : "Đã hoàn tất mô phỏng lệnh thủ công"} (${targetDeviceCode}): ${result.summary?.commandCount || 0} lệnh ứng viên, ${result.summary?.blockedCount || 0} thiết bị bị bảo vệ chặn, tác dụng ghi điều khiển ${result.summary?.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 手动命令执行失败", "FCU manual command failed", "Lệnh thủ công FCU thất bại"));
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
        hvacCopy(
          `单台投运窗口已生成（${selectedDeviceCode}）：${result.verdict || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`,
          `Single-device commissioning window generated (${selectedDeviceCode}): ${result.verdict || "status unknown"}; control write side effect ${result.controlMutation ? "present" : "none"}.`,
          `Đã tạo cửa sổ chạy thử từng thiết bị (${selectedDeviceCode}): ${result.verdict || "không rõ trạng thái"}; tác dụng ghi điều khiển ${result.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 单台投运窗口生成失败", "Failed to generate the FCU commissioning window", "Không thể tạo cửa sổ chạy thử FCU"));
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
        hvacCopy(
          `现场开闸包已生成（${selectedDeviceCode}）：${result.fieldArmPackage?.verdict || result.verdict || "状态未知"}，P0 ${p0Blockers} 项，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`,
          `Field arm package generated (${selectedDeviceCode}): ${result.fieldArmPackage?.verdict || result.verdict || "status unknown"}; ${p0Blockers} P0 items, control write side effect ${result.controlMutation ? "present" : "none"}.`,
          `Đã tạo gói mở gate hiện trường (${selectedDeviceCode}): ${result.fieldArmPackage?.verdict || result.verdict || "không rõ trạng thái"}; ${p0Blockers} mục P0, tác dụng ghi điều khiển ${result.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 现场开闸包生成失败", "Failed to generate the FCU field arm package", "Không thể tạo gói mở gate hiện trường FCU"));
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
        hvacCopy(
          `开闸前预检已刷新（${selectedDeviceCode}）：${preflight.verdict || "状态未知"}，授权${authorizationReady ? "就绪" : "未就绪"}，投运闸门${gateReady ? "允许" : "阻断"}，Arm-Check${armReady ? "通过" : "阻断"}，写控制副作用 ${preflight.controlMutation ? "存在" : "无"}。`,
          `Arm precheck refreshed (${selectedDeviceCode}): ${preflight.verdict || "Status unknown"}; authorization ${authorizationReady ? "ready" : "not ready"}; commissioning gate ${gateReady ? "allowed" : "blocked"}; Arm-Check ${armReady ? "passed" : "blocked"}; write side effect ${preflight.controlMutation ? "present" : "none"}.`,
          `Đã làm mới precheck mở gate (${selectedDeviceCode}): ${preflight.verdict || "không rõ trạng thái"}; ủy quyền ${authorizationReady ? "sẵn sàng" : "chưa sẵn sàng"}; gate chạy thử ${gateReady ? "cho phép" : "bị chặn"}; Arm-Check ${armReady ? "đạt" : "bị chặn"}; tác dụng ghi ${preflight.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 开闸前预检刷新失败", "Failed to refresh the FCU arm precheck", "Không thể làm mới precheck mở gate FCU"));
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
      setControlNotice(
        hvacCopy(
          `Canary 执行已锁定（${selectedDeviceCode}）：${selectedCanaryDispatchLockReason}。`,
          `Canary execution is locked (${selectedDeviceCode}): ${selectedCanaryDispatchLockReason}.`,
          `Thực thi Canary đang bị khóa (${selectedDeviceCode}): ${selectedCanaryDispatchLockReason}.`
        )
      );
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
        hvacCopy(
          `Canary 执行返回（${selectedDeviceCode}）：${result.mode || result.code || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`,
          `Canary execution returned (${selectedDeviceCode}): ${result.mode || result.code || "status unknown"}; control write side effect ${result.controlMutation ? "present" : "none"}.`,
          `Thực thi Canary đã trả về (${selectedDeviceCode}): ${result.mode || result.code || "không rõ trạng thái"}; tác dụng ghi điều khiển ${result.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      const payload = extractBffErrorPayload<FcuCanaryDispatchResponseDto>(error);
      if (payload) {
        setSelectedCanaryDispatch(payload);
        setControlNotice(
          hvacCopy(
            `Canary 执行被阻断（${selectedDeviceCode}）：${payload.code || payload.error || "未满足投运条件"}，写控制副作用 ${payload.controlMutation ? "存在" : "无"}。`,
            `Canary execution blocked (${selectedDeviceCode}): ${payload.code || payload.error || "commissioning conditions unmet"}; control write side effect ${payload.controlMutation ? "present" : "none"}.`,
            `Thực thi Canary bị chặn (${selectedDeviceCode}): ${payload.code || payload.error || "chưa đạt điều kiện chạy thử"}; tác dụng ghi điều khiển ${payload.controlMutation ? "có" : "không có"}.`
          )
        );
      } else {
        setErrorText(formatFcuError(error, "FCU Canary 执行失败", "FCU Canary execution failed", "Thực thi Canary FCU thất bại"));
      }
    } finally {
      setCanaryDispatchRunning(false);
    }
  }

  async function handleRefreshFinalControlStatus() {
    if (!fanCoilReady || finalStatusRefreshing) {
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
        hvacCopy(
          `最终控制验收已刷新：${formatFcuFinalVerdict(result.verdict)}，P0 阻断 ${blockers} 项，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`,
          `Final-control acceptance refreshed: ${formatFcuFinalVerdict(result.verdict)}; ${blockers} P0 blockers, control write side effect ${result.controlMutation ? "present" : "none"}.`,
          `Đã làm mới nghiệm thu điều khiển cuối: ${formatFcuFinalVerdict(result.verdict)}; ${blockers} mục chặn P0, tác dụng ghi điều khiển ${result.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 最终控制验收刷新失败", "Failed to refresh FCU final-control acceptance", "Không thể làm mới nghiệm thu điều khiển cuối FCU"));
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
        hvacCopy(
          `最终控制编排返回：${result.verdict || result.code || "状态未知"}，写控制副作用 ${result.controlMutation ? "存在" : "无"}。`,
          `Final-control rollout returned: ${result.verdict || result.code || "status unknown"}; control write side effect ${result.controlMutation ? "present" : "none"}.`,
          `Điều phối điều khiển cuối đã trả về: ${result.verdict || result.code || "không rõ trạng thái"}; tác dụng ghi điều khiển ${result.controlMutation ? "có" : "không có"}.`
        )
      );
    } catch (error) {
      const payload = extractBffErrorPayload<FcuFinalControlRolloutResponseDto>(error);
      if (payload) {
        setSelectedFinalRolloutExecution(payload);
        setControlNotice(
          hvacCopy(
            `最终控制编排被阻断：${payload.code || payload.error || "未满足投运条件"}，写控制副作用 ${payload.controlMutation ? "存在" : "无"}。`,
            `Final-control rollout blocked: ${payload.code || payload.error || "commissioning conditions unmet"}; control write side effect ${payload.controlMutation ? "present" : "none"}.`,
            `Điều phối điều khiển cuối bị chặn: ${payload.code || payload.error || "chưa đạt điều kiện chạy thử"}; tác dụng ghi điều khiển ${payload.controlMutation ? "có" : "không có"}.`
          )
        );
      } else {
        setErrorText(formatFcuError(error, "FCU 最终控制编排执行失败", "FCU final-control rollout failed", "Điều phối điều khiển cuối FCU thất bại"));
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
      setControlNotice(hvacCopy(
        `反馈校验完成：${formatFcuControlStatus(result.record?.status)}。`,
        `Feedback verification completed: ${formatFcuControlStatus(result.record?.status)}.`,
        `Đã hoàn tất xác minh phản hồi: ${formatFcuControlStatus(result.record?.status)}.`
      ));
    } catch (error) {
      setErrorText(formatFcuError(error, "FCU 反馈校验失败", "FCU feedback verification failed", "Xác minh phản hồi FCU thất bại"));
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
  const statusPresentation = getSubsystemStatusPresentation(terminalSubsystem);
  const configEnabled = terminalSubsystem?.status === "enabled";
  const configDemoData = isDemoData(terminalSubsystem);
  const fanCoilPayloadReady =
    configEnabled &&
    fanCoilItems.length > 0 &&
    (fanCoilSummary.dataStatus === "ok" || fanCoils?.sourceStatus?.overall === "ok");
  const fanCoilTimestampMs = Number.isFinite(Date.parse(fanCoils?.sampledAt || fanCoils?.generatedAt || ""))
    ? Date.parse(fanCoils?.sampledAt || fanCoils?.generatedAt || "")
    : null;
  const fanCoilAgeMs = fanCoilTimestampMs == null ? null : Math.max(0, Date.now() - fanCoilTimestampMs);
  const fanCoilFreshnessStale = Boolean(
    fanCoilPayloadReady && (
      fanCoils?.freshness?.stale === true ||
      fanCoils?.freshness?.label === "stale" ||
      fanCoilAgeMs == null ||
      fanCoilAgeMs > HVAC_TERMINAL_STALE_MS
    )
  );
  const fanCoilReady = Boolean(fanCoilPayloadReady && !fanCoilFreshnessStale);
  const boundaryMode = terminalSubsystem?.controlBoundary?.mode || "read_only";
  const requiredRoles = (terminalSubsystem?.requiredPointRoles || []).filter((item) => item.required !== false);
  const optionalRoles = (terminalSubsystem?.requiredPointRoles || []).filter((item) => item.required === false);
  const pointProgress = terminalSubsystem?.pointMappingProgress || 0;
  const roleSummary = configEnabled && requiredRoles.length
    ? hvacCopy(`模板 ${pointProgress}% / ${requiredRoles.length}类`, `Template ${pointProgress}% / ${requiredRoles.length} roles`, `Mẫu ${pointProgress}% / ${requiredRoles.length} vai trò`)
    : hvacText("未配置");
  const requiredRoleLabel = requiredRoles.length
    ? requiredRoles.map((item) => item.label).join(" / ")
    : hvacCopy("区域温度 / 末端状态", "Zone temp / terminal status", "Nhiệt độ vùng / trạng thái FCU");
  const optionalRoleLabel = optionalRoles.length
    ? optionalRoles.map((item) => item.label).join(" / ")
    : hvacCopy("阀门反馈 / 温度设定 / 末端告警", "Valve feedback / temp setpoint / terminal alarm", "Phản hồi van / cài nhiệt độ / cảnh báo FCU");
  const statusLabel = fanCoilReady
    ? hvacCopy("BA快照 / 只读", "BA snapshot / read-only", "Ảnh chụp BA / chỉ đọc")
    : fanCoilFreshnessStale
      ? hvacCopy("BA快照陈旧 / 停止判读", "BA snapshot stale / evaluation stopped", "Ảnh chụp BA cũ / dừng đánh giá")
      : formatStatus(terminalSubsystem);
  const statusLabelTone: Tone = fanCoilReady
    ? (fanCoilSummary.alarmCount || 0) > 0
      ? "warn"
      : "good"
    : fanCoilFreshnessStale
      ? "warn"
      : statusTone(terminalSubsystem);
  const floorName = fanCoils?.floorName || hvacCopy("10楼", "10F", "Tầng 10");
  const projectLabel = resolveAuthProjectDisplayName(
    currentProject,
    hvacCopy("当前项目", "Current project", "Dự án hiện tại")
  );
  const terminalSubtitle = fanCoilReady
    ? hvacCopy(
        `${fanCoils?.building || projectLabel} ${floorName}风机盘管逐台只读快照：区域温度、运行状态、风速、阀门、设定值和通讯报警。`,
        `${fanCoils?.building || projectLabel} ${floorName} fan-coil read-only snapshot: zone temperature, running status, fan speed, valve, setpoint, and communication alarm.`,
        `${fanCoils?.building || projectLabel} ${floorName} ảnh chụp FCU chỉ đọc: nhiệt độ vùng, trạng thái chạy, tốc độ quạt, van, điểm đặt và cảnh báo truyền thông.`
      )
    : fanCoilFreshnessStale
      ? hvacCopy(
          `${projectLabel} ${floorName} BA 快照已超过 5 分钟，当前停止舒适度与运行状态判读。`,
          `${projectLabel} ${floorName} BA snapshot is older than 5 minutes; comfort and operating-state evaluation is stopped.`,
          `Ảnh chụp BA ${floorName} của ${projectLabel} đã quá 5 phút; dừng đánh giá tiện nghi và trạng thái vận hành.`
        )
      : configEnabled
      ? hvacCopy(
          `${projectLabel} 空调末端已发布配置，等待现场 BA / PLC / 网关实时点位接入；未接入实时数据不显示假 KPI。`,
          `${projectLabel} HVAC terminal config is published and waiting for BA / PLC / gateway live points; no fake KPI is shown before live data is connected.`,
          `${projectLabel} đã có cấu hình FCU, đang chờ điểm BA / PLC / gateway thời gian thực; không hiển thị KPI giả khi chưa có dữ liệu thật.`
        )
      : hvacCopy(
          `${projectLabel} 未配置空调末端；未接入实时数据不显示假 KPI，不参与综合统计，仅保留未来接入入口。`,
          `${projectLabel} has no HVAC terminal configuration; no fake KPI is shown and this subsystem is excluded from totals until connected.`,
          `${projectLabel} chưa cấu hình FCU; không hiển thị KPI giả và không tham gia tổng hợp cho tới khi kết nối.`
        );
  const sourceOverallCode = fanCoils?.sourceStatus?.overall || capabilities?.sourceStatus?.overall;
  const sourceOverall = sourceOverallCode === "ok"
    ? hvacCopy("正常", "Healthy", "Bình thường")
    : sourceOverallCode === "partial"
      ? hvacCopy("部分可用", "Partially available", "Khả dụng một phần")
      : sourceOverallCode === "failed"
        ? hvacCopy("失败", "Failed", "Thất bại")
        : loading
          ? hvacCopy("加载中", "Loading", "Đang tải")
          : hvacCopy("未知", "Unknown", "Không rõ");
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
    fanCoilReady && fcuExecutionGate?.dispatchAllowed === true && fcuFinalDispatchGate?.dispatchAllowed === true;
  const selectedFcuWriteEnabled =
    terminalView === "device" && selectedDeviceCode
      ? fanCoilReady && selectedCommissioning?.canDispatch === true && fcuFinalDispatchGate?.dispatchAllowed === true
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
    ? selectedCommissioning.blockedReasons.slice(0, 3).map(translateFcuBackendText).join(" / ")
    : selectedCommissioning?.controlBlockReasons?.slice(0, 3).map(translateFcuBackendText).join(" / ") || hvacText("无");
  const fieldArmReady = fieldArmCheck?.verdict === "field_arm_ready";
  const fieldArmBlockedText = fieldArmCheck?.blockingItems?.length
    ? fieldArmCheck.blockingItems.slice(0, 3).map((item) => translateFcuBackendText(item.message || item.label || item.key)).join(" / ")
    : hvacText("无");
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
    ? selectedCanaryWindowReport.verdict || hvacText("待投运")
    : hvacText("可生成");
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
    ? selectedFieldArmPackageReport.verdict || (selectedFieldArmPackageReport.ok ? hvacText("已生成") : hvacText("已阻断"))
    : hvacText("可生成");
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
      verdict: selectedFieldArmPackageReport?.verdict || hvacCopy("未生成", "Not generated", "Chưa tạo"),
      blockers: selectedFieldArmPackageP0Count
    },
    {
      key: "ba-adapter",
      label: hvacCopy("BA 写适配器", "BA write adapter", "Adapter ghi BA"),
      ok: selectedBaAdapterPrecheck?.ok === true,
      verdict: selectedBaAdapterPrecheck?.verdict || hvacCopy("未生成", "Not generated", "Chưa tạo"),
      blockers: selectedBaAdapterPrecheckBlockers
    },
    {
      key: "canary-package",
      label: hvacCopy("Canary执行包", "Canary package", "Gói Canary"),
      ok: selectedCanaryExecutionPrecheck?.ok === true,
      verdict: selectedCanaryExecutionPrecheck?.verdict || hvacCopy("未生成", "Not generated", "Chưa tạo"),
      blockers: selectedCanaryExecutionPrecheckBlockers
    },
    {
      key: "feedback-monitor",
      label: hvacCopy("反馈监视", "Feedback monitor", "Giám sát phản hồi"),
      ok: selectedCanaryFeedbackPrecheck?.ok === true,
      verdict: selectedCanaryFeedbackPrecheck?.verdict || hvacCopy("未生成", "Not generated", "Chưa tạo"),
      blockers: selectedCanaryFeedbackPrecheckBlockers
    }
  ];
  const selectedCanaryExecutionPrecheckReady = selectedCanaryExecutionLockChain.every((item) => item.ok);
  const selectedCanaryExecutionFirstBlocker = selectedCanaryExecutionLockChain.find((item) => !item.ok) || null;
  const selectedCanaryDispatchLocked = !selectedCanaryExecutionPrecheckReady;
  const selectedCanaryDispatchLockReason = selectedCanaryDispatchLocked
    ? `${selectedCanaryExecutionFirstBlocker?.label || hvacCopy("前置链", "Precheck chain", "Chuỗi precheck")}: ${selectedCanaryExecutionFirstBlocker?.verdict || hvacCopy("未通过", "Failed", "Chưa đạt")}`
    : hvacCopy("前置链已通过，仍需确认短语和后端总闸。", "Precheck chain passed; confirmation phrase and backend gate are still required.", "Chuỗi precheck đã đạt; vẫn cần cụm xác nhận và tổng khóa backend.");
  const fcuAuthorizationGateItems = [
    {
      key: "site_authorization",
      label: hvacText("现场授权"),
      ok: fcuFieldAuthorization?.siteAuthorizationStatus === "approved",
      value: formatFcuFieldAuthorizationStatus(fcuFieldAuthorization?.siteAuthorizationStatus),
      note: translateFcuBackendText(fcuFieldAuthorization?.siteAuthorizationBy || hvacCopy("3002 未记录授权确认人", "3002 has no authorization confirmer", "3002 chưa ghi người xác nhận ủy quyền"))
    },
    {
      key: "ba_write_confirm",
      label: hvacCopy("BA写入确认", "BA write confirmation", "Xác nhận ghi BA"),
      ok: fcuFieldAuthorization?.baWriteConfirmArmed === true,
      value: fcuFieldAuthorization?.baWriteConfirmArmed ? hvacCopy("已装载", "Armed", "Đã nạp") : hvacCopy("未装载", "Not armed", "Chưa nạp"),
      note: hvacCopy("只记录状态，不保存真实确认短语明文", "Only state is recorded; the real phrase is not stored in plaintext.", "Chỉ ghi trạng thái; không lưu cụm xác nhận thật dạng rõ.")
    },
    {
      key: "final_rollout_confirm",
      label: hvacCopy("总确认短语", "Final confirmation phrase", "Cụm xác nhận cuối"),
      ok: fcuFieldAuthorization?.finalRolloutConfirmArmed === true,
      value: fcuFieldAuthorization?.finalRolloutConfirmArmed ? hvacCopy("已装载", "Armed", "Đã nạp") : hvacCopy("未装载", "Not armed", "Chưa nạp"),
      note: hvacCopy("最终控制编排必须二次确认", "Final rollout requires secondary confirmation.", "Điều phối cuối cần xác nhận lần hai.")
    },
    {
      key: "commissioning_window",
      label: hvacCopy("投运窗口", "Commissioning window", "Cửa sổ chạy thử"),
      ok: Boolean(fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd),
      value:
        fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd
          ? hvacCopy("已设定", "Set", "Đã đặt")
          : hvacCopy("未设定", "Not set", "Chưa đặt"),
      note:
        fcuFieldAuthorization?.siteAuthorizationWindowStart && fcuFieldAuthorization?.siteAuthorizationWindowEnd
          ? `${fcuFieldAuthorization.siteAuthorizationWindowStart} ${hvacCopy("至", "to", "đến")} ${fcuFieldAuthorization.siteAuthorizationWindowEnd}`
          : hvacCopy("3002 未记录授权时间窗", "3002 has no authorization time window", "3002 chưa ghi cửa sổ ủy quyền")
    }
  ];
  const fcuAuthorizationReady = fcuAuthorizationGateItems.every((item) => item.ok);
  const selectedAllP0FieldArmBlockerActions = (selectedFieldArmPackageReport?.blockers || [])
    .filter((item) => item.severity === "P0")
    .map((item) => {
      const category = classifyFcuFieldArmAction(item.key, "");
      return {
        key: item.key || item.label || item.action || "field-arm-blocker",
        label: translateFcuBackendText(item.label || formatFcuBlockReason(item.key) || hvacText("P0 阻断项")),
        evidence: translateFcuBackendText(item.evidence || hvacText("缺少证据")),
        action: translateFcuBackendText(item.action || hvacText("补齐现场证据后重跑开闸包")),
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
        label: translateFcuBackendText(item.label || item.key || hvacText("开闸检查项")),
        evidence: translateFcuBackendText(item.evidence || item.status || hvacText("待补齐")),
        action: translateFcuBackendText(item.action || hvacText("补齐后重跑开闸包")),
        owner: translateFcuBackendText(item.owner || hvacText("待分配")),
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
            label: translateFcuBackendText(item.action || item.key || hvacText("下一步")),
            evidence: translateFcuBackendText(item.acceptance || item.reason || hvacText("待现场确认")),
            action: translateFcuBackendText(item.reason || item.target || hvacText("按责任人处理后刷新开闸预检")),
            owner: translateFcuBackendText(item.owner || hvacText("待分配")),
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
      label: hvacCopy("本机点位质量", "Device point quality", "Chất lượng điểm thiết bị"),
      ok: selectedCommissioning?.deviceReady === true,
      value: selectedCommissioning?.deviceReady ? hvacText("通过") : hvacText("阻断"),
      note: selectedCommissioning?.deviceReady ? hvacCopy("白名单/通讯/温度/写点已通过", "Whitelist / communication / temperature / write points passed", "Whitelist / truyền thông / nhiệt độ / điểm ghi đã đạt") : selectedCommissioningBlockedText
    },
    {
      key: "backend_write_gate",
      label: hvacCopy("后端写总闸", "Backend write gate", "Tổng khóa ghi backend"),
      ok: fcuExecutionGate?.dispatchAllowed === true,
      value: fcuExecutionGate?.dispatchAllowed ? hvacCopy("允许", "Allowed", "Cho phép") : formatFcuExecutionGateSummary(fcuExecutionGate),
      note: fcuExecutionGate?.blockedReasons?.map(formatFcuBlockReason).join(" / ") || hvacCopy("等待环境门禁", "Waiting environment gate", "Chờ gate môi trường")
    },
    {
      key: "final_dispatch_gate",
      label: hvacCopy("最终总门禁", "Final master gate", "Tổng gate cuối"),
      ok: fcuFinalDispatchGate?.dispatchAllowed === true,
      value: formatFcuFinalDispatchGateSummary(fcuFinalDispatchGate),
      note: fcuFinalDispatchGate?.blockedReasons?.map(formatFcuBlockReason).join(" / ") || hvacCopy("现场签核、Canary 与最终验收全部通过后才允许普通闭环写入", "Normal closed-loop writes require field signoff, Canary, and final acceptance.", "Ghi vòng kín thường chỉ cho phép sau ký xác nhận, Canary và nghiệm thu cuối.")
    },
    {
      key: "field_arm",
      label: hvacCopy("现场 Arm-Check", "Field Arm-Check", "Field Arm-Check"),
      ok: fieldArmReady,
      value: fieldArmReady ? hvacText("通过") : hvacCopy("禁止", "Blocked", "Bị chặn"),
      note: fieldArmReady ? hvacCopy("允许进入 Canary", "Can enter Canary", "Có thể vào Canary") : fieldArmBlockedText
    },
    {
      key: "canary_sequence",
      label: hvacCopy("Canary顺序", "Canary sequence", "Trình tự Canary"),
      ok: selectedIsFinalCanary && finalMilestones.canary?.ok === true,
      value: selectedIsFinalCanary ? (finalMilestones.canary?.ok ? hvacCopy("完成", "Complete", "Hoàn tất") : hvacCopy("首台待执行", "First device pending", "Thiết bị đầu chờ chạy")) : hvacCopy("非首台", "Not first device", "Không phải thiết bị đầu"),
      note: selectedIsFinalCanary ? hvacCopy("该 FCU 是当前首台候选", "This FCU is the current first candidate", "FCU này là ứng viên đầu tiên hiện tại") : hvacCopy(`首台候选 ${canaryDeviceLabel}`, `First candidate ${canaryDeviceLabel}`, `Ứng viên đầu ${canaryDeviceLabel}`)
    },
    {
      key: "feedback",
      label: hvacCopy("反馈确认", "Feedback confirmation", "Xác nhận phản hồi"),
      ok: selectedHasFeedbackConfirmed,
      value: selectedHasFeedbackConfirmed ? hvacCopy("已确认", "Confirmed", "Đã xác nhận") : hvacCopy("未确认", "Unconfirmed", "Chưa xác nhận"),
      note: selectedDeviceLastRecord
        ? `${formatSampleTime(selectedDeviceLastRecord.createdAt)} · ${formatFcuControlStatus(selectedDeviceLastRecord.status)}`
        : hvacCopy("暂无单台反馈记录", "No device feedback record", "Chưa có bản ghi phản hồi thiết bị")
    },
    {
      key: "final_acceptance",
      label: hvacCopy("最终验收", "Final acceptance", "Nghiệm thu cuối"),
      ok: finalCompletion?.ok === true,
      value: finalCompletion?.ok ? hvacCopy("完成", "Complete", "Hoàn tất") : hvacCopy("未完成", "Incomplete", "Chưa hoàn tất"),
      note: finalBlockingItems.length
        ? finalBlockingItems.slice(0, 2).map((item) => formatFcuBlockReason(item.key || item.label)).join(" / ")
        : hvacCopy("等待验收证据", "Waiting acceptance evidence", "Chờ bằng chứng nghiệm thu")
    }
  ];
  const selectedFinalGateItems = selectedBackendFinalGate?.items?.length
    ? selectedBackendFinalGate.items.map((item) => ({
        key: item.key || item.label || "unknown",
        label: translateFcuBackendText(item.label || item.key || "门禁"),
        ok: item.ok === true,
        value: item.value ? translateFcuBackendText(item.value) : (item.ok ? hvacText("通过") : hvacCopy("未通过", "Failed", "Chưa đạt")),
        note: item.note ? translateFcuBackendText(item.note) : "--"
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
    { key: "overview", label: hvacCopy("总览", "Overview", "Tổng quan"), note: hvacCopy("值班首屏", "Duty first screen", "Màn trực chính") },
    { key: "control", label: hvacCopy("控制", "Control", "Điều khiển"), note: `${readyControlCount} ready` },
    { key: "quality", label: hvacCopy("数据质量", "Data quality", "Chất lượng dữ liệu"), note: hvacCopy(`${qualityIssueCount} 异常`, `${qualityIssueCount} issues`, `${qualityIssueCount} lỗi`) },
    { key: "devices", label: hvacCopy("逐台控制", "Device control", "Điều khiển từng máy"), note: fanCoilReady ? formatCompactCount(fanCoilSummary.total || 0, "台") : hvacText("待接入") },
    ...(selectedDeviceCode ? [{ key: "device" as TerminalView, label: hvacCopy("当前 FCU", "Current FCU", "FCU hiện tại"), note: selectedDeviceCode }] : [])
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
    <div
      className={`power-monitor-page distribution-energy-workspace hvac-terminal-page hvac-terminal-page--${terminalView}`}
      data-distribution-energy-workspace
      data-subsystem-type="hvac_terminal"
      data-subsystem-status={fanCoilReady ? "live" : fanCoilFreshnessStale ? "stale" : statusPresentation.kind}
      data-object-scope="fixed_floor"
      data-terminal-runtime-ready={fanCoilReady ? "true" : "false"}
    >
      <section className="section-card power-monitor-hero">
        <header className="section-card-header">
          <div>
            <h1 className="distribution-workspace-title">{hvacCopy("空调末端监控", "HVAC Terminal Monitoring", "Giám sát FCU")}</h1>
            <p className="power-monitor-subtitle">
              {terminalSubtitle}
            </p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${statusLabelTone}`}>{statusLabel}</span>
            <span className="status-pill neutral">{hvacText(formatControlBoundaryMode(boundaryMode))}</span>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              {hvacCopy("刷新", "Refresh", "Làm mới")}
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {errorText ? <div className="source-banner warn distribution-critical-banner">{errorText}</div> : null}
          {fanCoilFreshnessStale ? (
            <div className="source-banner warn distribution-critical-banner">
              {hvacCopy(
                "BA 快照数据已超过 5 分钟，KPI、舒适度和控制就绪判读均已失效关闭；刷新恢复后方可继续。",
                "The BA snapshot is older than 5 minutes. KPI, comfort, and control-readiness evaluation are fail-closed until refresh recovers.",
                "Ảnh chụp BA đã quá 5 phút. KPI, tiện nghi và trạng thái sẵn sàng điều khiển đều đóng an toàn cho tới khi làm mới phục hồi."
              )}
            </div>
          ) : null}
          {fanCoilReady ? (
            <div className="source-banner">
              {hvacCopy(
                `已读取另一个 BA 末端系统的 ${floorName} 风机盘管快照；采样时间采用系统抓取时间${fanCoils?.sampledAt ? ` ${formatSampleTime(fanCoils.sampledAt)}` : ""}，上游 rawTagTime 不作为历史时间戳。`,
                `Loaded ${floorName} fan-coil snapshot from the BA terminal system; sample time uses backend fetch time${fanCoils?.sampledAt ? ` ${formatSampleTime(fanCoils.sampledAt)}` : ""}; upstream rawTagTime is not used as history time.`,
                `Đã đọc ảnh chụp FCU ${floorName} từ hệ BA; thời gian mẫu dùng thời gian backend lấy dữ liệu${fanCoils?.sampledAt ? ` ${formatSampleTime(fanCoils.sampledAt)}` : ""}; rawTagTime không dùng làm thời gian lịch sử.`
              )}
            </div>
          ) : null}
          {configDemoData && fanCoilReady ? (
            <div className="source-banner warn">
              {hvacCopy(
                `配置中心仍按${projectLabel}全系统演示口径标记；本页末端数值来自 BA 接口。通用子系统写点保持禁用，FCU 单台控制另受白名单、适配器、后端只读总闸和审计回退保护。`,
                "Config center still marks the office project as full-system demo; this page reads terminal values from BA. Generic subsystem writes remain disabled, and single-FCU control is protected by whitelist, adapter, backend gate, audit, and rollback.",
                "Trung tâm cấu hình vẫn đánh dấu dự án văn phòng theo demo toàn hệ thống; trang này lấy giá trị FCU từ BA. Ghi phân hệ chung vẫn tắt, điều khiển từng FCU được bảo vệ bởi whitelist, adapter, gate backend, audit và rollback."
              )}
            </div>
          ) : null}
          {waitingForRealData(terminalSubsystem) ? (
            <div className="source-banner warn">
              {hvacCopy(
                "当前未接入真实空调末端实时数据；已发布的是只读点位角色模板，等待现场 BA / PLC / 网关点位绑定。",
                "No live HVAC terminal data is connected; only the read-only point-role template is published while waiting for BA / PLC / gateway binding.",
                "Chưa có dữ liệu FCU thời gian thực; hiện chỉ có mẫu vai trò điểm chỉ đọc, chờ BA / PLC / gateway hiện trường liên kết điểm."
              )}
            </div>
          ) : null}
          {configDemoData && !fanCoilReady ? (
            <div className="source-banner">
              {hvacCopy(
                `${projectLabel}为空调末端演示配置；未读取到风机盘管快照时不显示假 KPI。`,
                "The office project has HVAC terminal demo configuration; fake KPIs are hidden until a fan-coil snapshot is read.",
                "Dự án văn phòng có cấu hình demo FCU; KPI giả sẽ không hiển thị khi chưa đọc được ảnh chụp FCU."
              )}
            </div>
          ) : null}
          <div className="power-monitor-summary">
            <div>
              <span>{hvacCopy("配置中心链路", "Config-center link", "Liên kết trung tâm cấu hình")}</span>
              <strong>{sourceOverall}</strong>
            </div>
            <div>
              <span>{hvacCopy("当前范围", "Current scope", "Phạm vi hiện tại")}</span>
              <strong>{fanCoilReady ? `${floorName} / ${fanCoilSummary.total || 0}${hvacUnit("台")}` : `${floorName} / ${hvacCopy("固定楼层", "Fixed floor", "Tầng cố định")}`}</strong>
            </div>
            <div>
              <span>{hvacCopy("点位角色模板", "Point-role template", "Mẫu vai trò điểm")}</span>
              <strong>{roleSummary}</strong>
            </div>
            <div>
              <span>{hvacCopy("实时数据", "Live data", "Dữ liệu thời gian thực")}</span>
              <strong>{formatDataStatus(terminalSubsystem, fanCoilReady)}</strong>
            </div>
            <div>
              <span>{hvacCopy("控制边界", "Control boundary", "Biên điều khiển")}</span>
              <strong>{hvacCopy("前端不直写 BA/PLC", "Frontend never writes BA/PLC", "Frontend không ghi BA/PLC")}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid power-kpi-grid">
        <StatTile title={hvacCopy("风机盘管", "Fan coils", "FCU")} value={formatMetricValue(configEnabled, fanCoilReady, fanCoilFreshnessStale, String(fanCoilSummary.total || 0))} unit={fanCoilReady ? hvacUnit("台") : undefined} note={fanCoilReady ? floorName : fanCoilFreshnessStale ? hvacCopy("数据陈旧，停止判读", "Data stale; evaluation stopped", "Dữ liệu cũ; dừng đánh giá") : configEnabled ? hvacCopy("等待 BA 快照", "Waiting BA snapshot", "Chờ ảnh chụp BA") : hvacText("待接入")} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title={hvacCopy("10楼均温", "10F avg temp", "Nhiệt độ TB tầng 10")} value={formatMetricValue(configEnabled, fanCoilReady, fanCoilFreshnessStale, averageTempValue)} unit={fanCoilReady ? "°C" : undefined} note={fanCoilReady ? hvacCopy(`${fanCoilSummary.comfortEligibleCount || fanCoilSummary.validTemperatureCount || 0}个舒适样本`, `${fanCoilSummary.comfortEligibleCount || fanCoilSummary.validTemperatureCount || 0} comfort samples`, `${fanCoilSummary.comfortEligibleCount || fanCoilSummary.validTemperatureCount || 0} mẫu tiện nghi`) : fanCoilFreshnessStale ? hvacCopy("数据陈旧，停止判读", "Data stale; evaluation stopped", "Dữ liệu cũ; dừng đánh giá") : configEnabled ? hvacCopy("等待温度点", "Waiting temp points", "Chờ điểm nhiệt độ") : hvacText("待接入")} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title={hvacCopy("运行盘管", "Running FCUs", "FCU đang chạy")} value={formatMetricValue(configEnabled, fanCoilReady, fanCoilFreshnessStale, runningValue)} note={fanCoilReady ? hvacCopy("运行/总数", "Running / total", "Đang chạy / tổng") : fanCoilFreshnessStale ? hvacCopy("数据陈旧，停止判读", "Data stale; evaluation stopped", "Dữ liệu cũ; dừng đánh giá") : configEnabled ? hvacCopy("等待运行点", "Waiting run points", "Chờ điểm chạy") : hvacText("待接入")} tone={fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
        <StatTile title={hvacText("通讯报警")} value={formatMetricValue(configEnabled, fanCoilReady, fanCoilFreshnessStale, alarmValue)} note={fanCoilReady ? hvacCopy(`${onlineValue} 无通讯报警`, `${onlineValue} no comm alarm`, `${onlineValue} không cảnh báo truyền thông`) : fanCoilFreshnessStale ? hvacCopy("数据陈旧，停止判读", "Data stale; evaluation stopped", "Dữ liệu cũ; dừng đánh giá") : configEnabled ? hvacCopy("等待报警点", "Waiting alarm points", "Chờ điểm cảnh báo") : hvacText("待接入")} tone={fanCoilReady && (fanCoilSummary.communicationAlarmCount || 0) > 0 ? "warn" : fanCoilReady ? "good" : configEnabled ? "warn" : "neutral"} />
      </div>

      <nav
        className="hvac-terminal-view-tabs"
        aria-label={hvacCopy("空调末端二级视图", "HVAC terminal secondary views", "Điều hướng phụ FCU")}
      >
        {terminalViewItems.map((item) => (
          <Link key={item.key} to={buildTerminalViewHref(item.key)} className={terminalView === item.key ? "is-active" : ""}>
            <strong>{item.label}</strong>
            <span>{item.note}</span>
          </Link>
        ))}
      </nav>

      {(terminalView === "overview" || terminalView === "control") ? fanCoilReady ? (
      <section className="section-card hvac-terminal-quality-card fcu-control-card">
        <header className="section-card-header">
          <div>
            <h3>{hvacCopy("FCU 值班控制台", "FCU duty console", "Bảng điều khiển trực FCU")}</h3>
            <p className="power-monitor-subtitle">
              {hvacCopy(
                "可控数量、Ready、保护阻断和真实下发集中显示；前端不直接写 BA/PLC，真实写入由后端适配器和总闸判定。",
                "Controllable count, Ready state, protection blocks, and live dispatch are shown together. The frontend never writes BA/PLC directly; backend adapters and master gates decide live writes.",
                "Hiển thị tập trung số lượng có thể điều khiển, trạng thái Ready, mục chặn bảo vệ và phát lệnh thật. Frontend không ghi trực tiếp BA/PLC; adapter backend và tổng gate quyết định ghi thật."
              )}
            </p>
          </div>
          <div className="section-action">
            <span className={`status-pill ${fcuPolicy?.defaultMode === "enforced" ? "warn" : "neutral"}`}>
              {controlModeLabel}
            </span>
            <button type="button" onClick={() => void handleRunControlCycle(false)} disabled={!fanCoilReady || controlRunning || controlDispatching}>
              <ShieldCheck size={14} />
              {controlRunning ? hvacCopy("预演中", "Simulating", "Đang mô phỏng") : hvacCopy("预演控制周期", "Simulate control cycle", "Mô phỏng chu kỳ điều khiển")}
            </button>
            {terminalView === "control" ? (
              <button
                type="button"
                className="is-danger"
                onClick={() => void handleRunControlCycle(true)}
                disabled={!fanCoilReady || !canConfirmDispatch || controlRunning || controlDispatching}
                title={canConfirmDispatch
                  ? hvacCopy("确认后将通过 BA 写适配器下发 ready 命令", "Confirmation dispatches ready commands through the BA write adapter", "Xác nhận sẽ phát lệnh ready qua adapter ghi BA")
                  : hvacCopy("需先完成预演并生成 ready 命令", "Complete simulation and generate ready commands first", "Cần hoàn tất mô phỏng và tạo lệnh ready trước")}
              >
                <ShieldCheck size={14} />
                {controlDispatching ? hvacCopy("下发中", "Dispatching", "Đang phát lệnh") : hvacCopy("确认下发", "Confirm dispatch", "Xác nhận phát lệnh")}
              </button>
            ) : null}
          </div>
        </header>
        <div className="section-card-body">
          {controlNotice ? <div className="source-banner">{controlNotice}</div> : null}
          <div className="fcu-control-compact-grid">
            <article className="tone-good">
              <span>{hvacCopy("设备侧就绪", "Device-side ready", "Thiết bị sẵn sàng")}</span>
              <strong>{fanCoilReady ? `${commissioningSummary.deviceReady ?? executableCount}/${commissioningSummary.total ?? fanCoilSummary.total ?? 0}` : "--"}</strong>
              <small>{hvacCopy("白名单/点位/质量通过", "Whitelist / points / quality passed", "Whitelist / điểm đo / chất lượng đã đạt")}</small>
            </article>
            <article className={(commissioningSummary.deviceBlocked || 0) > 0 ? "tone-warn" : "tone-good"}>
              <span>{hvacText("单台阻断")}</span>
              <strong>{fanCoilReady ? commissioningSummary.deviceBlocked ?? blockedControlCount : "--"}</strong>
              <small>{hvacCopy("通讯/温度/写点保护", "Communication / temperature / write-point protection", "Bảo vệ truyền thông / nhiệt độ / điểm ghi")}</small>
            </article>
            <article className={(commissioningSummary.canDispatch || 0) > 0 ? "tone-good" : "tone-neutral"}>
              <span>{hvacText("可真实下发")}</span>
              <strong>{fanCoilReady ? commissioningSummary.canDispatch ?? readyControlCount : "--"}</strong>
              <small>{hvacCopy(`${whitelistCount} 台白名单`, `${whitelistCount} whitelisted devices`, `${whitelistCount} thiết bị trong whitelist`)}</small>
            </article>
            <article className={dispatchedControlCount > 0 ? "tone-good" : "tone-neutral"}>
              <span>{hvacCopy("最近真实下发", "Recent live dispatch", "Phát lệnh thật gần đây")}</span>
              <strong>{dispatchedControlCount}</strong>
              <small>{executionBoundaryLabel}</small>
            </article>
          </div>
          <div className="fcu-final-status-panel">
            <div className="fcu-final-status-head">
              <div>
                <strong>{hvacCopy("最终控制完成度", "Final-control completion", "Mức hoàn tất điều khiển cuối")}</strong>
                <span>{hvacCopy(
                  "以验收报告为准：真实下发、反馈确认、回退保护和全量设备闭环必须全部满足。",
                  "The acceptance report is authoritative: live dispatch, feedback confirmation, rollback protection, and all-device closed loop must all pass.",
                  "Báo cáo nghiệm thu là căn cứ: phát lệnh thật, xác nhận phản hồi, bảo vệ rollback và vòng kín toàn bộ thiết bị đều phải đạt."
                )}</span>
              </div>
              <div className="section-action">
                <span className={`status-pill ${finalVerdictTone}`}>
                  {formatFcuFinalVerdict(finalControlStatus?.verdict)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRefreshFinalControlStatus()}
                  disabled={!fanCoilReady || finalStatusRefreshing}
                  title={fanCoilReady
                    ? hvacCopy(
                        "重新生成最终控制完成度和投运清单；该动作不下发 BA/PLC",
                        "Regenerate final-control completion and commissioning checklist; this action does not dispatch BA/PLC",
                        "Tạo lại mức hoàn tất điều khiển cuối và checklist chạy thử; thao tác này không phát lệnh BA/PLC"
                      )
                    : hvacCopy(
                        "需先取得当前项目的有效末端快照",
                        "A valid current-project terminal snapshot is required first",
                        "Trước tiên cần ảnh chụp thiết bị đầu cuối hợp lệ của dự án hiện tại"
                      )}
                >
                  <RefreshCw size={14} />
                  {finalStatusRefreshing ? hvacCopy("刷新中", "Refreshing", "Đang làm mới") : hvacCopy("刷新验收", "Refresh acceptance", "Làm mới nghiệm thu")}
                </button>
              </div>
            </div>
            <div className="fcu-final-gate-strip">
              <div>
                <strong>{hvacCopy("最终控制总门禁", "Final-control master gate", "Tổng gate điều khiển cuối")}</strong>
                <span>
                  {finalControlGates
                    ? hvacCopy(
                        `通过 ${finalControlGateSummary?.passed ?? 0}/${finalControlGateSummary?.gateCount ?? 0}，阻断 ${finalControlGateSummary?.blocked ?? 0} 项；P0 ${finalControlGateSummary?.qualityP0Devices ?? "--"} 台，签字 ${finalControlGateSummary?.signoffCompleteRows ?? "--"}/${finalControlGateSummary?.signoffExpectedRows ?? "--"}，Canary ${finalControlGateSummary?.canaryReady ? "就绪" : "阻断"}，下一步 ${finalControlGateNextActions.length} 项`,
                        `Passed ${finalControlGateSummary?.passed ?? 0}/${finalControlGateSummary?.gateCount ?? 0}; ${finalControlGateSummary?.blocked ?? 0} blocked. P0 ${finalControlGateSummary?.qualityP0Devices ?? "--"} devices, signoff ${finalControlGateSummary?.signoffCompleteRows ?? "--"}/${finalControlGateSummary?.signoffExpectedRows ?? "--"}, Canary ${finalControlGateSummary?.canaryReady ? "ready" : "blocked"}, ${finalControlGateNextActions.length} next steps.`,
                        `Đạt ${finalControlGateSummary?.passed ?? 0}/${finalControlGateSummary?.gateCount ?? 0}; ${finalControlGateSummary?.blocked ?? 0} mục bị chặn. P0 ${finalControlGateSummary?.qualityP0Devices ?? "--"} thiết bị, ký xác nhận ${finalControlGateSummary?.signoffCompleteRows ?? "--"}/${finalControlGateSummary?.signoffExpectedRows ?? "--"}, Canary ${finalControlGateSummary?.canaryReady ? "sẵn sàng" : "bị chặn"}, ${finalControlGateNextActions.length} bước tiếp theo.`
                      )
                    : hvacCopy("总门禁证据待读取", "Master-gate evidence pending", "Chờ bằng chứng tổng gate")}
                  {finalControlGateMarkdown ? ` · ${finalControlGateMarkdown}` : ""}
                </span>
              </div>
              <span className={`status-pill ${finalControlGateTone}`}>
                {finalControlGates?.ok ? hvacText("允许归档") : finalControlGates ? hvacText("禁止下发") : hvacText("待读取")}
              </span>
            </div>
            {finalControlGateBlockers.length > 0 ? (
              <div className="fcu-final-gate-blockers">
                {finalControlGateBlockers.slice(0, 4).map((item) => (
                  <span key={item.label || item.blocker || item.evidence || "gate-blocker"}>
                    {translateFcuBackendText(item.label || hvacText("门禁"))}{hvacCopy("：", ": ", ": ")}
                    {translateFcuBackendText(item.value || item.blocker || hvacText("阻断"))}
                  </span>
                ))}
              </div>
            ) : null}
            {finalEvidenceConsistency ? (
              <div className="fcu-worklist-package-strip">
                <strong>{hvacCopy("证据一致性", "Evidence consistency", "Tính nhất quán bằng chứng")}</strong>
                <span>
                  {hvacCopy(
                    `${finalEvidenceConsistency.ok ? "一致" : "不一致"} · 问题 ${finalEvidenceConsistencySummary?.issueCount ?? finalEvidenceConsistencyIssues.length ?? "--"} 项 · P0 ${finalEvidenceConsistencySummary?.openP0Devices ?? "--"} 台 · 过期签核 ${finalEvidenceConsistencySummary?.staleSignoffRows ?? "--"} 行 · 签核 ${finalEvidenceConsistencySummary?.signoffCompleteRows ?? "--"}/${finalEvidenceConsistencySummary?.signoffExpectedRows ?? "--"} · Runbook ${finalRunbook?.verdict || "待读取"}`,
                    `${finalEvidenceConsistency.ok ? "Consistent" : "Inconsistent"} · ${finalEvidenceConsistencySummary?.issueCount ?? finalEvidenceConsistencyIssues.length ?? "--"} issues · P0 ${finalEvidenceConsistencySummary?.openP0Devices ?? "--"} devices · ${finalEvidenceConsistencySummary?.staleSignoffRows ?? "--"} stale signoff rows · signoff ${finalEvidenceConsistencySummary?.signoffCompleteRows ?? "--"}/${finalEvidenceConsistencySummary?.signoffExpectedRows ?? "--"} · Runbook ${finalRunbook?.verdict || "pending"}`,
                    `${finalEvidenceConsistency.ok ? "Nhất quán" : "Không nhất quán"} · ${finalEvidenceConsistencySummary?.issueCount ?? finalEvidenceConsistencyIssues.length ?? "--"} vấn đề · P0 ${finalEvidenceConsistencySummary?.openP0Devices ?? "--"} thiết bị · ${finalEvidenceConsistencySummary?.staleSignoffRows ?? "--"} dòng ký xác nhận cũ · ký xác nhận ${finalEvidenceConsistencySummary?.signoffCompleteRows ?? "--"}/${finalEvidenceConsistencySummary?.signoffExpectedRows ?? "--"} · Runbook ${finalRunbook?.verdict || "đang chờ"}`
                  )}
                </span>
                <span className={`status-pill ${finalEvidenceTone}`}>
                  {finalEvidenceConsistency.ok ? hvacText("证据可信") : hvacText("禁止推进")}
                </span>
              </div>
            ) : null}
            {finalEvidenceConsistencyIssues.length > 0 ? (
              <div className="fcu-final-gate-blockers">
                {finalEvidenceConsistencyIssues.slice(0, 4).map((item) => (
                  <span key={`${item.key || "evidence"}-${item.field || item.message || item.source || "issue"}`}>
                    {item.key || "evidence"}{hvacCopy("：", ": ", ": ")}
                    {translateFcuBackendText(item.message || item.field || item.source || hvacCopy("证据不一致", "Evidence is inconsistent", "Bằng chứng không nhất quán"))}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="fcu-final-status-grid">
              <article className={finalMilestones.canary?.ok ? "tone-good" : "tone-warn"}>
                <span>{hvacCopy("首台 Canary", "First Canary", "Canary đầu tiên")}</span>
                <strong>{finalMilestones.canary?.ok ? hvacText("完成") : hvacText("未完成")}</strong>
                <small>{finalMilestones.canary?.deviceCode || finalCompletion?.firstCanary || canaryDeviceLabel} · {translateFcuBackendText(finalMilestones.canary?.feedbackStatus || hvacText("反馈未确认"))}</small>
              </article>
              <article className={finalMilestones.smallBatch?.ok ? "tone-good" : "tone-warn"}>
                <span>{hvacCopy("小批量", "Small batch", "Lô nhỏ")}</span>
                <strong>{finalMilestones.smallBatch?.ok ? hvacText("完成") : hvacText("未完成")}</strong>
                <small>{hvacCopy(
                  `${finalMilestones.smallBatch?.devices || 0} 台 · 反馈${finalMilestones.smallBatch?.feedbackConfirmed ? "已确认" : "未确认"}`,
                  `${finalMilestones.smallBatch?.devices || 0} devices · feedback ${finalMilestones.smallBatch?.feedbackConfirmed ? "confirmed" : "unconfirmed"}`,
                  `${finalMilestones.smallBatch?.devices || 0} thiết bị · phản hồi ${finalMilestones.smallBatch?.feedbackConfirmed ? "đã xác nhận" : "chưa xác nhận"}`
                )}</small>
              </article>
              <article className={finalMilestones.allDevice?.ok ? "tone-good" : "tone-warn"}>
                <span>{hvacCopy("全量反馈", "All-device feedback", "Phản hồi toàn bộ thiết bị")}</span>
                <strong>{finalMilestones.allDevice?.confirmedDevices || 0}/{finalMilestones.allDevice?.targetDevices || finalRolloutSummary?.total || 0}</strong>
                <small>{hvacCopy("最终验收设备数", "Final accepted devices", "Số thiết bị nghiệm thu cuối")}</small>
              </article>
              <article className={(finalQualitySummary?.remediationCount || 0) > 0 ? "tone-warn" : finalQualitySummary ? "tone-good" : "tone-neutral"}>
                <span>{hvacCopy("质量整改", "Quality remediation", "Xử lý chất lượng")}</span>
                <strong>{finalQualitySummary?.remediationCount ?? "--"}</strong>
                <small>{hvacCopy(
                  `P0 ${finalQualitySummary?.p0Count ?? "--"} · 通讯 ${finalQualitySummary?.communicationAlarmCount ?? 0} · 0°C ${finalQualitySummary?.zeroTemperatureCount ?? 0}`,
                  `P0 ${finalQualitySummary?.p0Count ?? "--"} · communication ${finalQualitySummary?.communicationAlarmCount ?? 0} · 0°C ${finalQualitySummary?.zeroTemperatureCount ?? 0}`,
                  `P0 ${finalQualitySummary?.p0Count ?? "--"} · truyền thông ${finalQualitySummary?.communicationAlarmCount ?? 0} · 0°C ${finalQualitySummary?.zeroTemperatureCount ?? 0}`
                )}</small>
              </article>
              <article className={finalFieldCloseoutReady ? "tone-good" : finalFieldCloseoutPackage ? "tone-warn" : "tone-neutral"}>
                <span>{hvacCopy("现场消缺", "Field remediation", "Xử lý hiện trường")}</span>
                <strong>{finalFieldCloseoutReady ? hvacText("已关闭") : finalFieldCloseoutRemaining ?? "--"}</strong>
                <small>{translateFcuBackendText(finalFieldCloseoutPackage?.verdict || hvacCopy("closeout 待读取", "closeout pending", "chờ closeout"))} · {hvacCopy("Canary 前置", "Canary prerequisite", "Điều kiện trước Canary")}</small>
              </article>
            </div>
            <div className="fcu-final-status-detail">
              <div>
                <strong>{hvacCopy("全量批次", "All-device batches", "Các lô toàn bộ thiết bị")}</strong>
                <span>
                  {hvacCopy(
                    `可规划 ${finalRolloutSummary?.plannedDeviceCount ?? finalRolloutSummary?.deviceReady ?? 0}/${finalRolloutSummary?.total ?? fanCoilSummary.total ?? 0} 台；立即批次 ${finalRolloutSummary?.immediateReady ?? 0} 台，分步设定 ${finalRolloutSummary?.stagedSetpoint ?? 0} 台，阻断 ${finalRolloutSummary?.blocked ?? 0} 台。`,
                    `${finalRolloutSummary?.plannedDeviceCount ?? finalRolloutSummary?.deviceReady ?? 0}/${finalRolloutSummary?.total ?? fanCoilSummary.total ?? 0} devices can be planned; ${finalRolloutSummary?.immediateReady ?? 0} immediate, ${finalRolloutSummary?.stagedSetpoint ?? 0} staged setpoint, ${finalRolloutSummary?.blocked ?? 0} blocked.`,
                    `Có thể lập kế hoạch ${finalRolloutSummary?.plannedDeviceCount ?? finalRolloutSummary?.deviceReady ?? 0}/${finalRolloutSummary?.total ?? fanCoilSummary.total ?? 0} thiết bị; ${finalRolloutSummary?.immediateReady ?? 0} thực hiện ngay, ${finalRolloutSummary?.stagedSetpoint ?? 0} chỉnh điểm đặt theo bước, ${finalRolloutSummary?.blocked ?? 0} bị chặn.`
                  )}
                </span>
              </div>
              <div>
                <strong>{hvacCopy("当前 P0 阻断", "Current P0 blockers", "Mục chặn P0 hiện tại")}</strong>
                <span>
                  {finalBlockingItems.length
                    ? finalBlockingItems.slice(0, 4).map((item) => formatFcuBlockReason(item.key || item.label)).join(" / ")
                    : finalControlStatus ? hvacCopy("无 P0 阻断", "No P0 blockers", "Không có mục chặn P0") : hvacCopy("验收证据待读取", "Acceptance evidence pending", "Chờ bằng chứng nghiệm thu")}
                </span>
              </div>
              <div>
                <strong>{hvacCopy("Canary 前置", "Canary prerequisite", "Điều kiện trước Canary")}</strong>
                <span>
                  {finalFieldCloseoutReady
                    ? hvacCopy("现场消缺已关闭，可进入首台 Canary 的下一道门禁", "Field remediation is closed; proceed to the next first-Canary gate.", "Đã đóng xử lý hiện trường; chuyển sang gate tiếp theo của Canary đầu tiên.")
                    : finalFieldCloseoutPackage
                      ? hvacCopy(
                          `现场消缺未关闭：剩余 ${finalFieldCloseoutRemaining ?? "--"} 台，先完成 P0 复检`,
                          `Field remediation remains open for ${finalFieldCloseoutRemaining ?? "--"} devices; complete the P0 recheck first.`,
                          `Xử lý hiện trường vẫn mở cho ${finalFieldCloseoutRemaining ?? "--"} thiết bị; hoàn tất kiểm tra lại P0 trước.`
                        )
                      : hvacCopy("现场消缺 closeout 证据待读取", "Field-remediation closeout evidence pending", "Chờ bằng chứng closeout xử lý hiện trường")}
                </span>
              </div>
            </div>
            {finalQualityDevices.length > 0 ? (
              <div className="fcu-final-remediation-panel">
                <div className="fcu-final-remediation-head">
                  <div>
                    <strong>{hvacCopy("现场 P0 消缺清单", "Field P0 remediation checklist", "Checklist xử lý P0 hiện trường")}</strong>
                    <span>{hvacCopy("逐台处理后刷新验收；未满足放行标准前不进入全量闭环。", "Refresh acceptance after each device is handled; do not enter all-device closed loop before release criteria pass.", "Làm mới nghiệm thu sau khi xử lý từng thiết bị; không vào vòng kín toàn bộ trước khi đạt tiêu chí cho phép.")}</span>
                  </div>
                  <span className="status-pill warn">{hvacCopy(`${finalQualitySummary?.p0Count ?? finalQualityDevices.length} 台 P0`, `${finalQualitySummary?.p0Count ?? finalQualityDevices.length} P0 devices`, `${finalQualitySummary?.p0Count ?? finalQualityDevices.length} thiết bị P0`)}</span>
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
                          <span>{deviceCode || hvacText("未编码")} · {item.severity || "P0"}</span>
                        </div>
                        <div className="fcu-final-remediation-reasons">
                          {(item.reasons || []).slice(0, 4).map((reason) => (
                            <span key={`${deviceCode}-${reason}`}>{formatFcuBlockReason(reason)}</span>
                          ))}
                        </div>
                        <ul>
                          {(item.fieldActions || []).slice(0, 2).map((action) => (
                            <li key={`${deviceCode}-${action}`}>{translateFcuBackendText(action)}</li>
                          ))}
                        </ul>
                        <em>{translateFcuBackendText((item.releaseCriteria || [])[0] || hvacCopy("处理后重跑质量整改检查", "Rerun the quality-remediation check after handling", "Chạy lại kiểm tra xử lý chất lượng sau khi hoàn tất"))}</em>
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
                    <strong>{hvacCopy("最终控制编排", "Final-control rollout", "Điều phối điều khiển cuối")}</strong>
                    <span>
                      {translateFcuBackendText(finalRollout.mode || hvacText("状态待读取"))} · {hvacCopy("写入副作用", "write side effect", "tác dụng ghi")} {finalRollout.controlMutation ? hvacText("存在") : hvacText("无")}
                    </span>
                  </div>
                  <div className="fcu-rollout-confirm-row">
                    <span className={`status-pill ${finalRollout.confirm?.finalRolloutConfirmPresent ? "good" : "warn"}`}>
                      {hvacCopy("总确认", "Master confirmation", "Xác nhận tổng")} {finalRollout.confirm?.finalRolloutConfirmPresent ? hvacText("已设置") : hvacText("缺失")}
                    </span>
                    <span className={`status-pill ${finalRollout.confirm?.smallBatchConfirmPresent ? "good" : "warn"}`}>
                      {hvacCopy("BA确认", "BA confirmation", "Xác nhận BA")} {finalRollout.confirm?.smallBatchConfirmPresent ? hvacText("已设置") : hvacText("缺失")}
                    </span>
                  </div>
                </div>
                {finalRolloutPhases.length > 0 ? (
                  <div className="fcu-rollout-phase-row">
                    {finalRolloutPhases.map((phase) => (
                      <span key={phase.key || phase.label} className={phase.ok ? "is-ok" : "is-blocked"}>
                        {translateFcuBackendText(phase.label || phase.key)} · {phase.ok ? hvacText("通过") : `exit ${phase.status ?? "--"}`}
                      </span>
                    ))}
                    {finalRolloutSkipped.map((phase) => (
                      <span key={phase.key || phase.label} className="is-skipped">
                        {translateFcuBackendText(phase.label || phase.key)} · {hvacText("跳过")}
                      </span>
                    ))}
                  </div>
                ) : null}
                {finalRolloutBlockers.length > 0 ? (
                  <div className="fcu-final-remediation-strip">
                    <strong>{hvacCopy("编排阻断", "Rollout blockers", "Mục chặn điều phối")}</strong>
                    <span>{finalRolloutBlockers.slice(0, 5).map((item) => translateFcuBackendText(item.label || formatFcuBlockReason(item.key))).join(" / ")}</span>
                  </div>
                ) : null}
                <div className="fcu-rollout-execute-panel">
                  <div>
                    <strong>{hvacCopy("执行最终编排", "Execute final rollout", "Thực thi điều phối cuối")}</strong>
                    <span>{hvacCopy("必须同时输入 BA 写入确认和最终总确认；后端会再次检查只读总闸、3002 授权和现场 Arm-Check。", "Enter both BA write confirmation and final master confirmation. The backend rechecks the read-only gate, 3002 authorization, and field Arm-Check.", "Phải nhập cả xác nhận ghi BA và xác nhận tổng cuối. Backend sẽ kiểm tra lại gate chỉ đọc, ủy quyền 3002 và Arm-Check hiện trường.")}</span>
                    {selectedFinalRolloutExecution ? (
                      <small>
                        {hvacCopy("最近返回：", "Latest response: ", "Phản hồi gần nhất: ")}{selectedFinalRolloutExecution.code || selectedFinalRolloutExecution.verdict || (selectedFinalRolloutExecution.ok ? hvacText("已执行") : hvacText("已阻断"))}
                        {finalRolloutExecutionBlockers.length ? ` · ${hvacCopy("阻断", "blocked", "bị chặn")} ${finalRolloutExecutionBlockers.slice(0, 4).map((item) => translateFcuBackendText(item.label || item.key)).join(" / ")}` : ""}
                      </small>
                    ) : null}
                  </div>
                  <div className="fcu-rollout-execute-controls">
                    <input
                      type="password"
                      value={finalRolloutBaConfirmText}
                      onChange={(event) => setFinalRolloutBaConfirmText(event.target.value)}
                      placeholder={hvacCopy("BA 写入确认短语", "BA write confirmation phrase", "Cụm xác nhận ghi BA")}
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      value={finalRolloutConfirmText}
                      onChange={(event) => setFinalRolloutConfirmText(event.target.value)}
                      placeholder={hvacCopy("最终总确认短语", "Final master confirmation phrase", "Cụm xác nhận tổng cuối")}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => void handleExecuteFinalControlRollout()}
                      disabled={finalRolloutRunning || !finalRolloutBaConfirmText || !finalRolloutConfirmText}
                      title={hvacCopy(
                        "请求后端最终控制编排；后端仍会检查 read-only、授权门禁、Arm-Check、Canary 和反馈顺序",
                        "Request backend final-control rollout; backend still checks read-only mode, authorization gates, Arm-Check, Canary, and feedback order",
                        "Yêu cầu backend điều phối điều khiển cuối; backend vẫn kiểm tra chế độ chỉ đọc, gate ủy quyền, Arm-Check, Canary và thứ tự phản hồi"
                      )}
                    >
                      <ShieldCheck size={14} />
                      {finalRolloutRunning ? hvacCopy("执行中", "Executing", "Đang thực thi") : hvacCopy("执行最终编排", "Execute final rollout", "Thực thi điều phối cuối")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {finalWorklist ? (
              <div className="fcu-worklist-panel">
                <div className="fcu-worklist-head">
                  <div>
                    <strong>{hvacCopy("最终控制投运清单", "Final-control commissioning checklist", "Checklist chạy thử điều khiển cuối")}</strong>
                    <span>
                      {translateFcuBackendText(finalWorklist.verdict || hvacText("状态待读取"))} · P0 {finalWorklist.summary?.p0OpenActions ?? 0} {hvacText("项")} · {hvacCopy("全量反馈", "all-device feedback", "phản hồi toàn bộ")} {finalWorklist.confirmedDevices ?? 0}/{finalWorklist.targetDevices ?? 0}
                    </span>
                  </div>
                  <span className={`status-pill ${finalWorklist.ok ? "good" : "warn"}`}>
                    {finalWorklist.ok ? hvacText("可归档") : hvacText("待处理")}
                  </span>
                </div>
                {finalWorklistPhases.length > 0 ? (
                  <div className="fcu-worklist-phase-grid">
                    {finalWorklistPhases.map((phase) => (
                      <span key={phase.key || phase.label} className={`tone-${fcuWorklistTone(phase.status)}`}>
                        <strong>{translateFcuBackendText(phase.label || phase.key)}</strong>
                        <small>{formatFcuWorklistStatus(phase.status)} · {translateFcuBackendText(phase.evidence || "--")}</small>
                      </span>
                    ))}
                  </div>
                ) : null}
                {finalWorklistActions.length > 0 ? (
                  <div className="fcu-worklist-actions">
                    {finalWorklistActions.slice(0, 5).map((action) => (
                      <article key={action.key || `${action.priority}-${action.phase}-${action.action}`}>
                        <span className={`status-pill ${action.priority === "P0" ? "warn" : "neutral"}`}>
                          {action.priority || "P1"} · {translateFcuBackendText(action.phase || hvacCopy("投运", "Commissioning", "Chạy thử"))}
                        </span>
                        <strong>{translateFcuBackendText(action.action || hvacText("待处理"))}</strong>
                        <small>{translateFcuBackendText(action.target || "--")} · {translateFcuBackendText(action.reason || action.acceptance || "--")}</small>
                      </article>
                    ))}
                  </div>
                ) : null}
                {finalFieldPlaybook?.deviceCount ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>{hvacCopy("现场消缺作战表", "Field remediation playbook", "Bảng xử lý hiện trường")}</strong>
                      <span>
                        {hvacCopy("待处理", "Pending", "Chờ xử lý")} {finalFieldPlaybook.deviceCount ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("首台", "First unit", "Thiết bị đầu tiên")} {finalFieldPlaybook.firstCanary || canaryDeviceLabel} ·{" "}
                        Canary {finalFieldPlaybook.canaryBlockedByField
                          ? hvacCopy("现场阻断", "field blocked", "bị chặn tại hiện trường")
                          : hvacCopy("现场已放行", "field released", "đã được hiện trường cho phép")} ·{" "}
                        {finalFieldPlaybook.fieldReady
                          ? hvacCopy("现场 ready", "field ready", "hiện trường sẵn sàng")
                          : hvacCopy("先消缺再签核", "remediate before signoff", "xử lý trước khi ký xác nhận")}
                      </span>
                    </div>
                    {finalFieldPlaybook.recommendedOrder?.length ? (
                      <div className="fcu-worklist-actions">
                        <article>
                          <span className="status-pill warn">
                            {hvacCopy("处理顺序 · 不写 BA", "Work order · no BA writes", "Thứ tự xử lý · không ghi BA")}
                          </span>
                          <strong>{hvacCopy("先消除硬阻断，再进入 Canary", "Clear hard blockers before Canary", "Xóa chặn cứng trước khi vào Canary")}</strong>
                          <small>{finalFieldPlaybook.recommendedOrder.slice(0, 4).map(translateFcuBackendText).join(" / ")}</small>
                          <em>
                            {(finalFieldPlaybook.acceptance || []).slice(0, 4).map(translateFcuBackendText).join("; ") ||
                              hvacCopy(
                                "全部回填 release 后仍需重跑最终门禁。",
                                "Rerun the final gate after all release fields are completed.",
                                "Chạy lại gate cuối sau khi hoàn tất mọi trường release."
                              )}
                          </em>
                        </article>
                        {finalFieldPlaybookReasonGroups.slice(0, 3).map((group) => (
                          <article key={group.reason || "reason"}>
                            <span className="status-pill warn">{translateFcuBackendText(group.reason || "现场阻断")}</span>
                            <strong>{(group.devices || []).length} {hvacCopy("台设备", "devices", "thiết bị")}</strong>
                            <small>{(group.devices || []).slice(0, 8).join(" / ") || "--"}</small>
                            <em>{hvacCopy("该分类清零前，不允许进入真实闭环投运。", "Live closed-loop commissioning is blocked until this category is cleared.", "Không được chạy vòng kín thật cho đến khi nhóm này được xử lý hết.")}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldPlaybookDevices.length ? (
                      <div className="fcu-worklist-actions fcu-plan-device-grid">
                        {finalFieldPlaybookDevices.slice(0, 4).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className="status-pill warn">{hvacCopy("现场P0", "Field P0", "P0 hiện trường")} · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {(item.reasonLabels || item.reasons || []).slice(0, 4).map(translateFcuBackendText).join(" / ") ||
                                hvacCopy("待现场复核", "Pending field review", "Chờ kiểm tra hiện trường")}
                            </small>
                            <em>
                              {(item.fieldPriority || []).map(translateFcuBackendText).join(" -> ") ||
                                hvacCopy(
                                  "按现场消缺作战表处理并回填签核。",
                                  "Follow the field remediation playbook and complete signoff.",
                                  "Xử lý theo bảng hiện trường và hoàn tất ký xác nhận."
                                )}
                            </em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalQualityPackage?.csv || finalQualityPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("现场整改包", "Field remediation pack", "Gói xử lý hiện trường")}</strong>
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
                      <strong>{hvacCopy("全量分批计划", "All-device batch plan", "Kế hoạch theo lô toàn bộ thiết bị")}</strong>
                      <span>
                        {hvacCopy("立即", "Immediate", "Ngay")} {finalAllDevicePlanPackage.immediateReady ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("分步设定", "Staged setpoint", "Điểm đặt theo bước")} {finalAllDevicePlanPackage.stagedSetpoint ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("硬阻断", "Hard blocked", "Chặn cứng")} {finalAllDevicePlanPackage.blocked ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("首台", "First unit", "Thiết bị đầu tiên")} {finalAllDevicePlanPackage.firstCanary || canaryDeviceLabel} ·{" "}
                        {finalAllDevicePlanPackage.markdown ? `Markdown ${finalAllDevicePlanPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    {(finalAllDevicePlanPackage.stagedSetpointDevices?.length || finalAllDevicePlanPackage.blockedDevices?.length) ? (
                      <div className="fcu-worklist-actions fcu-plan-device-grid">
                        {(finalAllDevicePlanPackage.stagedSetpointDevices || []).slice(0, 4).map((item) => (
                          <article key={`staged-${item.deviceCode || item.deviceName}`}>
                            <span className="status-pill neutral">{hvacCopy("分步设定", "Staged setpoint", "Điểm đặt theo bước")} · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {hvacCopy("设定", "Setpoint", "Điểm đặt")} {formatNumber(item.setpointC, 1)}°C · {hvacCopy("区温", "Zone", "Nhiệt độ vùng")} {formatNumber(item.zoneTemperatureC, 1)}°C
                            </small>
                            <em>{hvacCopy("按 0.5-2.0°C 分步拉回，完成反馈后进入全量白名单。", "Return in 0.5-2.0°C steps; add to the full whitelist after feedback is confirmed.", "Điều chỉnh về theo bước 0,5-2,0°C; thêm vào danh sách trắng toàn bộ sau khi xác nhận phản hồi.")}</em>
                          </article>
                        ))}
                        {(finalAllDevicePlanPackage.blockedDevices || []).slice(0, 4).map((item) => (
                          <article key={`blocked-${item.deviceCode || item.deviceName}`}>
                            <span className="status-pill warn">{hvacCopy("硬阻断", "Hard blocked", "Chặn cứng")} · {item.deviceCode || "FCU"}</span>
                            <strong>{item.deviceName || item.deviceCode || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {hvacCopy("设定", "Setpoint", "Điểm đặt")} {formatNumber(item.setpointC, 1)}°C · {hvacCopy("区温", "Zone", "Nhiệt độ vùng")} {formatNumber(item.zoneTemperatureC, 1)}°C
                            </small>
                            <em>{(item.blockedReasons || []).map(formatFcuBlockReason).slice(0, 3).join(" / ") || hvacCopy("需现场消缺后重跑计划", "Rerun the plan after field remediation", "Chạy lại kế hoạch sau khi xử lý hiện trường")}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalFieldCloseoutPackage?.csv || finalFieldCloseoutPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("消缺关闭报告", "Remediation closeout report", "Báo cáo đóng xử lý")}</strong>
                    <span>
                      {translateFcuBackendText(finalFieldCloseoutPackage.verdict || "待关闭")} ·{" "}
                      Canary {finalFieldCloseoutPackage.readyForCanary ? hvacCopy("可进入", "allowed", "được phép") : hvacText("阻断")} ·{" "}
                      {hvacCopy("未关闭", "Open", "Chưa đóng")} {finalFieldCloseoutPackage.remainingDeviceCount ?? "--"} {hvacText("台")} ·{" "}
                      {finalFieldCloseoutPackage.csv ? `CSV ${finalFieldCloseoutPackage.csv.split("/").pop()}` : ""}
                      {finalFieldCloseoutPackage.csv && finalFieldCloseoutPackage.markdown ? " · " : ""}
                      {finalFieldCloseoutPackage.markdown ? `Markdown ${finalFieldCloseoutPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldWorkOrdersPackage?.csv || finalFieldWorkOrdersPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("现场工单包", "Field work-order pack", "Gói phiếu việc hiện trường")}</strong>
                    <span>
                      {hvacCopy("工单", "Work orders", "Phiếu việc")} {finalFieldWorkOrdersPackage.totalWorkOrders ?? "--"} {hvacText("项")} ·{" "}
                      {hvacCopy("未关闭", "Open", "Chưa đóng")} {finalFieldWorkOrdersPackage.openCount ?? "--"} {hvacText("项")} ·{" "}
                      {hvacCopy("签字", "Signoff", "Ký xác nhận")} {finalFieldWorkOrdersPackage.requiresFieldSignoff ? hvacCopy("必需", "required", "bắt buộc") : hvacCopy("无需", "not required", "không bắt buộc")} ·{" "}
                      {finalFieldWorkOrdersPackage.csv ? `${hvacCopy("模板", "Template", "Mẫu")} ${finalFieldWorkOrdersPackage.csv.split("/").pop()}` : ""}
                      {finalFieldWorkOrdersPackage.signoffInputCsv ? ` · ${hvacCopy("填写", "Complete", "Điền")} ${finalFieldWorkOrdersPackage.signoffInputCsv.split("/").pop()}` : ""}
                      {(finalFieldWorkOrdersPackage.csv || finalFieldWorkOrdersPackage.signoffInputCsv) && finalFieldWorkOrdersPackage.markdown ? " · " : ""}
                      {finalFieldWorkOrdersPackage.markdown ? `Markdown ${finalFieldWorkOrdersPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldExecutionPackPackage?.json || finalFieldExecutionPackPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("现场执行包", "Field execution pack", "Gói thực hiện hiện trường")}</strong>
                    <span>
                      P0 {finalFieldExecutionPackPackage.openP0Devices ?? "--"} {hvacText("台")} ·{" "}
                      {hvacCopy("通讯", "Communication", "Truyền thông")} {finalFieldExecutionPackPackage.reasonCounts?.communication_alarm ?? 0} {hvacText("台")} ·{" "}
                      0°C/{hvacCopy("温度", "temperature", "nhiệt độ")} {finalFieldExecutionPackPackage.reasonCounts?.zero_temperature ?? 0} {hvacText("台")} ·{" "}
                      {hvacCopy("设定反馈", "Setpoint feedback", "Phản hồi điểm đặt")} {finalFieldExecutionPackPackage.reasonCounts?.setpoint_feedback_out_of_bounds ?? 0} {hvacText("台")} ·{" "}
                      {translateFcuBackendText(finalFieldExecutionPackOrder[0]?.phase || "restore_communication")} →{" "}
                      {translateFcuBackendText(finalFieldExecutionPackLastPhase?.phase || "rerun_closeout")} ·{" "}
                      {finalFieldExecutionPackPackage.markdown ? `Markdown ${finalFieldExecutionPackPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldHandoffPackage?.json || finalFieldHandoffPackage?.markdown || finalFieldHandoffPackage?.csv ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>{hvacCopy("现场交接包", "Field handoff pack", "Gói bàn giao hiện trường")}</strong>
                      <span>
                        P0 {finalFieldHandoffPackage.openP0Devices ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("过期签核", "Stale signoffs", "Ký xác nhận cũ")} {finalFieldHandoffPackage.staleSignoffRows ?? "--"} {hvacText("行")} ·{" "}
                        {hvacCopy("签字", "Signoff", "Ký xác nhận")} {finalFieldHandoffPackage.signoffCompleteRows ?? "--"}/{finalFieldHandoffPackage.signoffExpectedRows ?? "--"} ·{" "}
                        {finalFieldHandoffPackage.csv ? `CSV ${finalFieldHandoffPackage.csv.split("/").pop()}` : ""}
                        {finalFieldHandoffPackage.csv && finalFieldHandoffPackage.markdown ? " · " : ""}
                        {finalFieldHandoffPackage.markdown ? `Markdown ${finalFieldHandoffPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    <div className="fcu-worklist-actions">
                      <article>
                        <span className="status-pill warn">{hvacCopy("下一步 · 只读交接", "Next step · read-only handoff", "Bước tiếp theo · bàn giao chỉ đọc")}</span>
                        <strong>{translateFcuBackendText(finalFieldHandoffPackage.nextAllowedStep || "先完成现场 P0 消缺和签核")}</strong>
                        <small>
                          {finalFieldHandoffPackage.currentOnlyCsv
                            ? `current-only ${finalFieldHandoffPackage.currentOnlyCsv.split("/").pop()}`
                            : finalFieldHandoffPackage.signoffInputCsv
                              ? `${hvacCopy("签核表", "Signoff sheet", "Bảng ký xác nhận")} ${finalFieldHandoffPackage.signoffInputCsv.split("/").pop()}`
                              : hvacCopy("等待现场签核输入表", "Waiting for the field signoff sheet", "Đang chờ bảng ký xác nhận hiện trường")}
                        </small>
                        <em>{hvacCopy("此包不产生 BA/PLC 写入，完成后仍需重跑 closeout、signoff、Canary readiness 和最终总门禁。", "This pack makes no BA/PLC writes. Rerun closeout, signoff, Canary readiness, and the final gate after completion.", "Gói này không ghi BA/PLC. Sau khi hoàn tất, chạy lại closeout, signoff, Canary readiness và gate cuối.")}</em>
                      </article>
                      {(finalFieldHandoffPackage.devices || []).slice(0, 3).map((item) => (
                        <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                          <span className="status-pill warn">{hvacCopy("P0现场", "Field P0", "P0 hiện trường")} · {item.deviceCode || "FCU"}</span>
                          <strong>{item.deviceName || item.deviceCode || item.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                          <small>
                            {(item.reasonLabels || []).slice(0, 3).map(translateFcuBackendText).join(" / ") ||
                              hvacCopy("待现场复核", "Pending field review", "Chờ kiểm tra hiện trường")}
                          </small>
                          <em>{translateFcuBackendText(item.todayAction || "按交接包执行消缺并回填签字字段。")}</em>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
                {finalFieldReturnTemplatePackage?.json || finalFieldReturnTemplatePackage?.markdown || finalFieldReturnTemplatePackage?.csv ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>{hvacCopy("现场回填模板", "Field return template", "Mẫu phản hồi hiện trường")}</strong>
                      <span>
                        {hvacCopy("设备", "Devices", "Thiết bị")} {finalFieldReturnTemplatePackage.deviceCount ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("通讯", "Communication", "Truyền thông")} {finalFieldReturnTemplatePackage.communicationBlocked ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("温度", "Temperature", "Nhiệt độ")} {finalFieldReturnTemplatePackage.temperatureBlocked ?? "--"} {hvacText("台")} ·{" "}
                        {hvacCopy("设定", "Setpoint", "Điểm đặt")} {finalFieldReturnTemplatePackage.setpointBlocked ?? "--"} {hvacText("台")} ·{" "}
                        {finalFieldReturnTemplatePackage.csv ? `CSV ${finalFieldReturnTemplatePackage.csv.split("/").pop()}` : ""}
                        {finalFieldReturnTemplatePackage.csv && finalFieldReturnTemplatePackage.markdown ? " · " : ""}
                        {finalFieldReturnTemplatePackage.markdown ? `Markdown ${finalFieldReturnTemplatePackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    <div className="fcu-worklist-actions">
                      {(finalFieldReturnTemplatePackage.devices || []).slice(0, 3).map((item) => (
                        <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                          <span className="status-pill warn">{hvacCopy("待回填", "Awaiting return", "Chờ phản hồi")} · {item.deviceCode || "FCU"}</span>
                          <strong>{item.deviceName || item.deviceCode || item.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                          <small>
                            {(item.missingFields || []).slice(0, 4).map(translateFcuBackendText).join(" / ") ||
                              hvacCopy("按模板字段回填", "Complete the template fields", "Điền các trường trong mẫu")}
                          </small>
                          <em>
                            {(item.releaseCriteria || []).slice(0, 2).map(translateFcuBackendText).join("; ") ||
                              hvacCopy(
                                "回填后仍需重跑签核、closeout 和最终总门禁。",
                                "Rerun signoff, closeout, and the final gate after the fields are completed.",
                                "Chạy lại signoff, closeout và gate cuối sau khi điền xong."
                              )}
                          </em>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
                {finalFieldSignoffPackage?.json || finalFieldSignoffPackage?.markdown ? (
                  <>
                    <div className="fcu-worklist-package-strip">
                      <strong>{hvacCopy("签字校验", "Signoff validation", "Xác thực ký xác nhận")}</strong>
                      <span>
                        {finalFieldSignoffPackage.signoffComplete ? hvacCopy("已完成", "Complete", "Hoàn tất") : hvacCopy("未完成", "Incomplete", "Chưa hoàn tất")} ·{" "}
                        {finalFieldSignoffPackage.completeRows ?? "--"}/{finalFieldSignoffPackage.expectedWorkOrders ?? "--"} {hvacText("行")} ·{" "}
                        {hvacCopy("实时 closeout", "Realtime closeout", "Closeout thời gian thực")} {finalFieldSignoffPackage.stillRequiresRealtimeCloseout ? hvacCopy("仍必需", "still required", "vẫn bắt buộc") : hvacCopy("无要求", "not required", "không bắt buộc")} ·{" "}
                        {finalFieldSignoffPackage.inputCsv ? `${hvacCopy("输入", "Input", "Đầu vào")} ${finalFieldSignoffPackage.inputCsv.split("/").pop()} · ` : ""}
                        {finalFieldSignoffPackage.releaseMatrixCsv ? `${hvacCopy("矩阵", "Matrix", "Ma trận")} ${finalFieldSignoffPackage.releaseMatrixCsv.split("/").pop()} · ` : ""}
                        {finalFieldSignoffPackage.markdown ? `Markdown ${finalFieldSignoffPackage.markdown.split("/").pop()}` : ""}
                      </span>
                    </div>
                    {finalFieldSignoffPackage.releaseMatrix?.length ? (
                      <div className="fcu-worklist-actions fcu-release-matrix-grid">
                        {finalFieldSignoffPackage.releaseMatrix.slice(0, 6).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className={`status-pill ${item.canEnterCanary ? "good" : "warn"}`}>
                              {item.canEnterCanary ? hvacCopy("可 Canary", "Canary allowed", "Cho phép Canary") : hvacCopy("Canary 阻断", "Canary blocked", "Canary bị chặn")} · {item.deviceCode || item.workOrderId || "FCU"}
                            </span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {translateFcuBackendText(item.canaryBlockReason || "需重跑实时 closeout")} · {translateFcuBackendText(item.verificationTarget || "复检目标待读取")}
                            </small>
                            <em>
                              {(item.nextActions || []).slice(0, 2).map(translateFcuBackendText).join(" / ") ||
                                (item.releaseCriteria || []).slice(0, 2).map(translateFcuBackendText).join(" / ") ||
                                hvacCopy("补齐现场签字后重跑最终控制清单", "Rerun the final-control checklist after completing field signoff", "Chạy lại checklist điều khiển cuối sau khi hoàn tất ký xác nhận hiện trường")}
                            </em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldSignoffPackage.onsiteReleasePrecheck ? (
                      <div className="fcu-worklist-actions">
                        <article>
                          <span className={`status-pill ${finalFieldSignoffPackage.onsiteReleasePrecheck.ok ? "good" : "warn"}`}>
                            {hvacCopy("现场放行预检", "Field release precheck", "Kiểm tra trước khi cho phép tại hiện trường")} · {finalFieldSignoffPackage.onsiteReleasePrecheck.ok
                              ? hvacCopy("签字完整", "signoff complete", "ký xác nhận đầy đủ")
                              : hvacCopy("仍阻断", "still blocked", "vẫn bị chặn")}
                          </span>
                          <strong>
                            Ready {finalFieldSignoffPackage.onsiteReleasePrecheck.onsiteReleaseReadyCount ?? "--"} / Blocked {finalFieldSignoffPackage.onsiteReleasePrecheck.onsiteReleaseBlockedCount ?? "--"}
                          </strong>
                          <small>
                            Canary {hvacCopy("仍阻断", "still blocked", "vẫn bị chặn")} {finalFieldSignoffPackage.onsiteReleasePrecheck.canaryStillBlockedCount ?? "--"} {hvacText("台")} ·{" "}
                            {hvacCopy("候选", "Candidates", "Ứng viên")} {finalFieldSignoffPackage.onsiteReleasePrecheck.canaryCandidateCount ?? "--"} {hvacText("台")}
                          </small>
                          <em>
                            {(finalFieldSignoffPackage.onsiteReleasePrecheck.nextGlobalActions || []).slice(0, 3).map(translateFcuBackendText).join(" / ") ||
                              hvacCopy(
                                "签字完整后仍需实时 closeout、Canary readiness 和最终总门禁。",
                                "Realtime closeout, Canary readiness, and the final gate are still required after signoff is complete.",
                                "Sau khi ký xác nhận đầy đủ vẫn cần realtime closeout, Canary readiness và gate cuối."
                              )}
                          </em>
                        </article>
                        {(finalFieldSignoffPackage.onsiteReleasePrecheck.devices || []).slice(0, 3).map((item) => (
                          <article key={item.workOrderId || item.deviceCode || item.deviceName}>
                            <span className={`status-pill ${item.onsiteReleaseReady ? "neutral" : "warn"}`}>
                              {item.onsiteReleaseReady ? hvacCopy("签字候选", "Signoff candidate", "Ứng viên ký xác nhận") : hvacCopy("签字阻断", "Signoff blocked", "Ký xác nhận bị chặn")} · {item.deviceCode || "FCU"}
                            </span>
                            <strong>{item.deviceName || item.deviceCode || item.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {(item.nextBlockingFields || []).slice(0, 4).map(translateFcuBackendText).join(" / ") ||
                                translateFcuBackendText(item.canaryBlockReason || "--")}
                            </small>
                            <em>{translateFcuBackendText(item.nextAction || "补齐现场字段后重跑签字校验。")}</em>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {finalFieldSignoffPackage.openRecords?.length ? (
                      <div className="fcu-worklist-actions">
                        {finalFieldSignoffPackage.openRecords.slice(0, 3).map((record) => (
                          <article key={record.workOrderId || record.deviceCode || record.deviceName}>
                            <span className="status-pill warn">
                              {hvacCopy("签字缺项", "Missing signoff fields", "Thiếu trường ký xác nhận")} · {record.deviceCode || record.workOrderId || "FCU"}
                            </span>
                            <strong>{record.deviceName || record.deviceCode || record.workOrderId || hvacCopy("未命名 FCU", "Unnamed FCU", "FCU chưa đặt tên")}</strong>
                            <small>
                              {(record.missingChecklist || [])
                                .slice(0, 4)
                                .map((item) => `${translateFcuBackendText(item.field || "--")}=${translateFcuBackendText(item.requiredValue || "--")}`)
                                .join(" / ") || (record.issues || []).slice(0, 4).map(translateFcuBackendText).join(" / ") || hvacCopy("缺项待读取", "Missing fields pending", "Đang chờ đọc trường thiếu")}
                            </small>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {finalFieldSignoffCleanPackage?.json || finalFieldSignoffCleanPackage?.currentCsv ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("签字输入清理", "Signoff input cleanup", "Dọn dữ liệu ký xác nhận")}</strong>
                    <span>
                      {hvacCopy("当前有效", "Current valid", "Hiện tại hợp lệ")} {finalFieldSignoffCleanPackage.currentRows ?? "--"} {hvacText("行")} ·{" "}
                      {hvacCopy("旧行", "Stale rows", "Dòng cũ")} {finalFieldSignoffCleanPackage.staleRows ?? "--"} {hvacText("行")} ·{" "}
                      {hvacCopy("补生成", "Generated missing", "Tạo bù")} {finalFieldSignoffCleanPackage.generatedMissingRows ?? "--"} {hvacText("行")} ·{" "}
                      {finalFieldSignoffCleanPackage.currentCsv ? `${hvacCopy("填写", "Complete", "Điền")} ${finalFieldSignoffCleanPackage.currentCsv.split("/").pop()}` : ""}
                      {finalFieldSignoffCleanPackage.currentCsv && finalFieldSignoffCleanPackage.staleCsv ? " · " : ""}
                      {finalFieldSignoffCleanPackage.staleCsv ? `${hvacCopy("归档", "Archive", "Lưu trữ")} ${finalFieldSignoffCleanPackage.staleCsv.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalFieldSignoffPromotePackage?.json || finalFieldSignoffPromotePackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("签字输入提升", "Signoff input promotion", "Nâng cấp dữ liệu ký xác nhận")}</strong>
                    <span>
                      {finalFieldSignoffPromotePackage.mode || "dry_run"} ·{" "}
                      {hvacCopy("确认", "Confirm", "Xác nhận")} {finalFieldSignoffPromotePackage.confirmMatched ? hvacCopy("已匹配", "matched", "đã khớp") : hvacCopy("未匹配", "not matched", "chưa khớp")} ·{" "}
                      {hvacCopy("写入", "Write", "Ghi")} {finalFieldSignoffPromotePackage.fileMutation ? hvacCopy("已执行", "executed", "đã thực hiện") : hvacCopy("未执行", "not executed", "chưa thực hiện")} ·{" "}
                      {hvacCopy("当前", "Current", "Hiện tại")} {finalFieldSignoffPromotePackage.currentRows ?? "--"} {hvacText("行")} ·{" "}
                      {hvacCopy("旧行", "Stale rows", "Dòng cũ")} {finalFieldSignoffPromotePackage.staleRows ?? "--"} {hvacText("行")} ·{" "}
                      {finalFieldSignoffPromotePackage.markdown ? `Markdown ${finalFieldSignoffPromotePackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryReadinessPackage?.json || finalCanaryReadinessPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("Canary总门禁", "Canary master gate", "Gate tổng Canary")}</strong>
                    <span>
                      {finalCanaryReadinessPackage.canaryReady ? hvacCopy("可执行", "Executable", "Có thể thực hiện") : hvacText("阻断")} ·{" "}
                      {translateFcuBackendText(finalCanaryReadinessPackage.verdict || "readiness --")} ·{" "}
                      {hvacText("阻断")} {finalCanaryReadinessPackage.blockedCount ?? "--"} {hvacText("项")} ·{" "}
                      {hvacCopy("首台", "First unit", "Thiết bị đầu tiên")} {finalCanaryReadinessPackage.firstCanary || canaryDeviceLabel} ·{" "}
                      {finalCanaryReadinessPackage.markdown ? `Markdown ${finalCanaryReadinessPackage.markdown.split("/").pop()}` : ""}
                    </span>
                    {finalCanaryReadinessPlaybook ? (
                      <>
                        <span>
                          {hvacCopy("Readiness 作战表", "Readiness playbook", "Bảng readiness")} · {finalCanaryReadinessPlaybook.readyGateCount ?? "--"} ready /{" "}
                          {finalCanaryReadinessPlaybook.blockedGateCount ?? "--"} blocked · {hvacCopy("第一阻断", "First blocker", "Chặn đầu tiên")}{" "}
                          {translateFcuBackendText(finalCanaryReadinessPlaybook.firstBlockedPhase || "无")} /{" "}
                          {translateFcuBackendText(finalCanaryReadinessPlaybook.firstBlockedOwner || "无")}
                        </span>
                        <em>{hvacCopy("第一动作：", "First action: ", "Hành động đầu: ")}{translateFcuBackendText(finalCanaryReadinessPlaybook.firstBlockedAction || "全部门禁通过后才允许进入 Canary。")}</em>
                        {finalCanaryReadinessPhasePlan.length > 0 ? (
                          <div className="fcu-worklist-phase-grid">
                            {finalCanaryReadinessPhasePlan.slice(0, 6).map((item) => (
                              <div key={item.key || item.phase} className="fcu-worklist-phase-item">
                                <span className={`status-pill ${item.ready ? "good" : "warn"}`}>
                                  {item.ready ? hvacText("通过") : hvacText("阻断")}
                                </span>
                                <strong>{translateFcuBackendText(item.phase || item.key || "门禁")}</strong>
                                <span>{translateFcuBackendText(item.owner || "责任未定")} · {translateFcuBackendText(item.evidence || "无证据")}</span>
                                <em>{translateFcuBackendText(item.ready ? "保持证据" : item.nextAction || "按门禁动作处理")}</em>
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
                    <strong>{hvacCopy("现场开闸包", "Field arm pack", "Gói mở gate hiện trường")}</strong>
                    <span>
                      {finalFieldArmPackage.deviceCode ? `${finalFieldArmPackage.deviceCode} · ` : ""}
                      {translateFcuBackendText(finalFieldArmPackage.verdict || "待生成")} ·{" "}
                      P0 {finalFieldArmPackage.blockers.filter((item) => item.severity === "P0").length} ·{" "}
                      {finalFieldArmPackage.controlMutation ? hvacCopy("已写入", "write applied", "đã ghi") : hvacCopy("无写入", "no writes", "không ghi")} ·{" "}
                      {finalFieldArmPackage.markdown ? `Markdown ${finalFieldArmPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryPackage?.json || finalCanaryPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("首台 Canary 包", "First Canary pack", "Gói Canary đầu tiên")}</strong>
                    <span>
                      {finalCanaryPackage.deviceCode ? `${finalCanaryPackage.deviceCode} · ` : ""}
                      {translateFcuBackendText(finalCanaryPackageStatus || "待现场开闸")} ·{" "}
                      {finalCanaryPackage.csv ? `CSV ${finalCanaryPackage.csv.split("/").pop()}` : ""}
                      {finalCanaryPackage.csv && finalCanaryPackage.markdown ? " · " : ""}
                      {finalCanaryPackage.markdown ? `Markdown ${finalCanaryPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalAdapterPackage?.json || finalAdapterPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("BA适配器自检", "BA adapter self-check", "Tự kiểm tra bộ chuyển đổi BA")}</strong>
                    <span>
                      {finalAdapterPackage.deviceCode ? `${finalAdapterPackage.deviceCode} · ` : ""}
                      {translateFcuBackendText(finalAdapterPackage.verdict || "待自检")} ·{" "}
                      {finalAdapterPackage.csv ? `CSV ${finalAdapterPackage.csv.split("/").pop()}` : ""}
                      {finalAdapterPackage.csv && finalAdapterPackage.markdown ? " · " : ""}
                      {finalAdapterPackage.markdown ? `Markdown ${finalAdapterPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryFeedbackPackage?.json || finalCanaryFeedbackPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("Canary反馈监视", "Canary feedback monitor", "Giám sát phản hồi Canary")}</strong>
                    <span>
                      {finalCanaryFeedbackPackage.deviceCode ? `${finalCanaryFeedbackPackage.deviceCode} · ` : ""}
                      {translateFcuBackendText(finalCanaryFeedbackPackage.verdict || "待反馈")} ·{" "}
                      {translateFcuBackendText(finalCanaryFeedbackPackage.feedbackStatus || "feedback --")} ·{" "}
                      {finalCanaryFeedbackPackage.csv ? `CSV ${finalCanaryFeedbackPackage.csv.split("/").pop()}` : ""}
                      {finalCanaryFeedbackPackage.csv && finalCanaryFeedbackPackage.markdown ? " · " : ""}
                      {finalCanaryFeedbackPackage.markdown ? `Markdown ${finalCanaryFeedbackPackage.markdown.split("/").pop()}` : ""}
                    </span>
                  </div>
                ) : null}
                {finalCanaryWindowPackage?.json || finalCanaryWindowPackage?.markdown ? (
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("Canary投运窗口", "Canary commissioning window", "Cửa sổ chạy thử Canary")}</strong>
                    <span>
                      {finalCanaryWindowPackage.deviceCode ? `${finalCanaryWindowPackage.deviceCode} · ` : ""}
                      {translateFcuBackendText(finalCanaryWindowPackage.verdict || "待投运")} ·{" "}
                      {translateFcuBackendText(finalCanaryWindowPackage.mode || "window --")} ·{" "}
                      {finalCanaryWindowPackage.controlMutation ? hvacCopy("已写入", "write applied", "đã ghi") : hvacCopy("无写入", "no writes", "không ghi")} ·{" "}
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
                    <strong>{action.priority || "P0"} · {translateFcuBackendText(action.action || "下一步")}</strong>
                    {action.reason ? <small>{translateFcuBackendText(action.reason)}</small> : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="fcu-canary-runbook">
            <div>
              <strong>{hvacCopy("真实投运顺序", "Live commissioning sequence", "Trình tự chạy thử thật")}</strong>
              <span>
                {hvacCopy(
                  `先跑上线前预检，再对 ${canaryDeviceLabel} 执行单台设定 canary；反馈正常后才扩大到小批量白名单。`,
                  `Run the preflight check first, then execute a single-device setpoint Canary on ${canaryDeviceLabel}; expand to the small-batch whitelist only after feedback is normal.`,
                  `Chạy kiểm tra trước trước, sau đó thực hiện Canary điểm đặt một thiết bị trên ${canaryDeviceLabel}; chỉ mở rộng sang danh sách trắng lô nhỏ khi phản hồi bình thường.`
                )}
              </span>
            </div>
            <div className="fcu-canary-steps">
              <span className={fcuExecutionGate?.dispatchAllowed ? "is-ok" : "is-blocked"}>{hvacCopy("预检", "Preflight", "Kiểm tra trước")}</span>
              <span className="is-next">Canary</span>
              <span>{hvacCopy("反馈校验", "Feedback validation", "Xác thực phản hồi")}</span>
              <span>{hvacCopy("小批量", "Small batch", "Lô nhỏ")}</span>
            </div>
          </div>
          <div className="fcu-control-inline-queue">
            <strong>{hvacCopy("最近动作", "Recent actions", "Hành động gần đây")}</strong>
            <span>
              {translateFcuBackendText(
                controlQueuePreview ||
                  hvacCopy(
                    "暂无控制队列；运行控制周期后生成 Ready、保护阻断或保持记录。",
                    "No control queue yet; run a control cycle to generate Ready, protected-block, or hold records.",
                    "Chưa có hàng đợi điều khiển; chạy một chu kỳ điều khiển để tạo bản ghi Ready, chặn bảo vệ hoặc giữ."
                  )
              )}
            </span>
          </div>
          {commissioningReport ? (
            <div className="fcu-commissioning-report">
              <div className="fcu-commissioning-report-head">
                <strong>{hvacCopy("投运报告", "Commissioning report", "Báo cáo chạy thử")}</strong>
                <span className={`status-pill ${commissioningReport.verdict === "ready_for_control" ? "good" : commissioningReport.verdict === "environment_blocked" ? "neutral" : "warn"}`}>
                  {translateFcuBackendText(commissioningReport.summaryText || "投运状态待读取")}
                </span>
              </div>
              <div className="fcu-commissioning-report-grid">
                <article>
                  <span>{hvacCopy("候选设备", "Candidate devices", "Thiết bị ứng viên")}</span>
                  <strong>{commissioningReport.releaseCandidateDeviceCodes?.length || 0}</strong>
                  <small>{commissioningReport.releaseCandidateDeviceCodes?.slice(0, 6).join(" / ") || hvacText("暂无")}</small>
                </article>
                <article>
                  <span>{hvacCopy("阻断设备", "Blocked devices", "Thiết bị bị chặn")}</span>
                  <strong>{commissioningReport.blockedDeviceCodes?.length || 0}</strong>
                  <small>{commissioningReport.blockedDeviceCodes?.slice(0, 6).join(" / ") || hvacText("暂无")}</small>
                </article>
                <article>
                  <span>{hvacCopy("主要阻断", "Primary blocker", "Chặn chính")}</span>
                  <strong>{commissioningReport.conditionBlockers?.[0]?.count || 0}</strong>
                  <small>{translateFcuBackendText(commissioningReport.conditionBlockers?.[0]?.label || "无")}</small>
                </article>
              </div>
              <div className="fcu-commissioning-actions">
                {(commissioningReport.nextActions || []).slice(0, 3).map((action) => (
                  <span key={`${action.priority}-${action.action}-${action.target}`}>
                    <strong>{action.priority || "P2"}</strong>
                    {translateFcuBackendText(action.action || "待处理")} · {translateFcuBackendText(action.target || "FCU")}
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
                    {record.commands?.length
                      ? ` ${record.commands.length} ${hvacCopy("条命令", "commands", "lệnh")}`
                      : ` ${translateFcuBackendText(record.reason || "保持")}`}
                    {record.feedback?.status ? ` · ${hvacText("反馈")}${formatFcuControlStatus(record.status).replace(/^反馈/, "")}` : ""}
                    {["dispatched", "feedback_pending", "feedback_mismatch_locked"].includes(record.status || "") && record.recordId ? (
                      <button
                        type="button"
                        className="fcu-feedback-check-button"
                        onClick={() => void handleVerifyFeedback(record.recordId)}
                        disabled={feedbackVerifyingId === record.recordId}
                      >
                        {feedbackVerifyingId === record.recordId
                          ? hvacCopy("校验中", "Validating", "Đang xác thực")
                          : hvacCopy("校验反馈", "Validate feedback", "Xác thực phản hồi")}
                      </button>
                    ) : null}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      ) : (
      <section className="section-card hvac-terminal-quality-card fcu-control-card fcu-control-card--scope-locked" data-fcu-evidence-scope-locked>
        <header className="section-card-header">
          <div>
            <h3>{hvacCopy("FCU 运行证据待接入", "FCU operational evidence pending", "Chờ bằng chứng vận hành FCU")}</h3>
            <p className="power-monitor-subtitle">
              {hvacCopy(
                "当前项目末端快照未就绪；控制预演、验收刷新和投运证据已全部锁定。",
                "The current-project terminal snapshot is not ready. Control simulation, acceptance refresh, and commissioning evidence are locked.",
                "Ảnh chụp thiết bị đầu cuối của dự án hiện tại chưa sẵn sàng; mô phỏng điều khiển, làm mới nghiệm thu và bằng chứng chạy thử đều bị khóa."
              )}
            </p>
          </div>
          <span className="status-pill neutral">{hvacCopy("只读锁定", "Read-only locked", "Khóa chỉ đọc")}</span>
        </header>
        <div className="section-card-body">
          <div className="fcu-scope-lock-grid">
            <article>
              <span>{hvacCopy("第一步", "Step 1", "Bước 1")}</span>
              <strong>{hvacCopy("接入本站 BA 快照", "Connect this site's BA snapshot", "Kết nối ảnh chụp BA của trạm")}</strong>
            </article>
            <article>
              <span>{hvacCopy("第二步", "Step 2", "Bước 2")}</span>
              <strong>{hvacCopy("核验项目与楼层范围", "Verify project and floor scope", "Xác minh dự án và phạm vi tầng")}</strong>
            </article>
            <article>
              <span>{hvacCopy("放行条件", "Release condition", "Điều kiện mở khóa")}</span>
              <strong>{hvacCopy("设备、时间戳、质量均可信", "Devices, timestamps, and quality verified", "Thiết bị, thời gian và chất lượng đều tin cậy")}</strong>
            </article>
          </div>
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
                        title={hvacCopy(
                          `${item.deviceName || deviceKey}：进入单台控制，${controlEntry.label}`,
                          `${item.deviceName || deviceKey}: open single-device control, ${controlEntry.label}`,
                          `${item.deviceName || deviceKey}: mở điều khiển từng thiết bị, ${controlEntry.label}`
                        )}
                      >
                        <strong>{item.deviceCode || item.deviceName || "--"}</strong>
                        <span>{formatNumber(item.zoneTemperatureC, 1)}°C · {hvacCopy("控制", "Control", "Điều khiển")}</span>
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
            <h3>{selectedFanCoil?.deviceName || selectedDeviceCode || hvacCopy("单台 FCU", "Single FCU", "FCU đơn")}</h3>
            <p className="power-monitor-subtitle">
              {hvacCopy(
                "单台风机盘管控制页；预演和确认下发都只针对当前设备，阀门只作为反馈，不直接写阀门开度。",
                "Single fan-coil control page; simulation and confirmed dispatch target only this device. Valve position is feedback only and is not written directly.",
                "Trang điều khiển từng FCU; mô phỏng và xác nhận phát lệnh chỉ áp dụng cho thiết bị hiện tại. Van chỉ dùng làm phản hồi, không ghi trực tiếp độ mở van."
              )}
            </p>
          </div>
          <div className="section-action">
            <Link to={buildTerminalViewHref("devices")} className="ghost-link-button">
              {hvacCopy("返回列表", "Back to list", "Về danh sách")}
            </Link>
            {previousFanCoil ? (
              <Link to={buildFanCoilDeviceHref(previousFanCoil)} className="ghost-link-button hvac-terminal-device-switch">
                <ChevronLeft size={13} />
                {hvacCopy("上一台", "Previous", "Trước")}
              </Link>
            ) : null}
            {nextFanCoil ? (
              <Link to={buildFanCoilDeviceHref(nextFanCoil)} className="ghost-link-button hvac-terminal-device-switch">
                {hvacCopy("下一台", "Next", "Sau")}
                <ChevronRight size={13} />
              </Link>
            ) : null}
            <span className={`status-pill ${selectedFanCoil?.communicationAlarm ? "warn" : selectedFanCoil ? "good" : "neutral"}`}>
              {selectedFanCoil ? formatAlarmState(selectedFanCoil.communicationAlarm) : hvacCopy("未找到", "Not found", "Không tìm thấy")}
            </span>
            <button
              type="button"
              onClick={() => void handleRunControlCycle(false, selectedDeviceCode)}
              disabled={selectedDevicePanelLoading || !selectedFanCoil || controlRunning || controlDispatching}
            >
              <ShieldCheck size={14} />
              {selectedDevicePanelLoading ? hvacCopy("加载中", "Loading", "Đang tải") : controlRunning ? hvacCopy("预演中", "Simulating", "Đang mô phỏng") : hvacCopy("预演单台", "Simulate device", "Mô phỏng thiết bị")}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => void handleRunControlCycle(true, selectedDeviceCode)}
              disabled={selectedDevicePanelLoading || !selectedFanCoil || !canConfirmDispatch || controlRunning || controlDispatching}
              title={canConfirmDispatch
                ? hvacCopy("确认后只向当前 FCU 下发 ready 命令", "Confirmation dispatches only ready commands for the current FCU", "Xác nhận chỉ phát lệnh ready cho FCU hiện tại")
                : hvacCopy("需先在当前单台页完成预演并生成 ready 命令", "Simulate this device first and generate ready commands", "Cần mô phỏng thiết bị này trước và tạo lệnh ready")}
            >
              <ShieldCheck size={14} />
              {controlDispatching ? hvacCopy("下发中", "Dispatching", "Đang phát lệnh") : hvacCopy("确认下发", "Confirm dispatch", "Xác nhận phát lệnh")}
            </button>
          </div>
        </header>
        <div className="section-card-body">
          {controlNotice ? <div className="source-banner">{controlNotice}</div> : null}
          {!selectedDeviceCode ? (
            <div className="source-banner warn">{hvacCopy("未指定 FCU，请从盘管列表点击单台设备进入控制。", "No FCU selected. Open a device from the fan-coil list.", "Chưa chọn FCU. Hãy mở một thiết bị từ danh sách FCU.")}</div>
          ) : null}
          {selectedDevicePanelLoading ? (
            <div className="source-banner">
              {hvacCopy(
                `正在加载 ${selectedDeviceCode} 单台控制面板；加载完成后会显示启停、设定温度、风速、开闸预检和投运包入口。`,
                `Loading ${selectedDeviceCode} control panel; start/stop, setpoint, fan speed, gate precheck, and commissioning package entries will appear after loading.`,
                `Đang tải bảng điều khiển ${selectedDeviceCode}; sau khi tải sẽ hiển thị bật/tắt, điểm đặt, tốc độ quạt, precheck mở gate và gói chạy thử.`
              )}
            </div>
          ) : null}
          {selectedDeviceCode && !selectedDevicePanelLoading && !selectedFanCoil ? (
            <div className="source-banner warn">
              {hvacCopy(
                `当前快照中未找到 ${selectedDeviceCode}，禁止下发控制。请刷新或回到盘管列表重新选择。`,
                `${selectedDeviceCode} is missing in the current snapshot. Dispatch is blocked. Refresh or select another fan coil.`,
                `Không thấy ${selectedDeviceCode} trong ảnh chụp hiện tại. Chặn phát lệnh. Hãy làm mới hoặc chọn FCU khác.`
              )}
            </div>
          ) : null}
          {selectedFanCoil ? (
            <>
              <div className={`source-banner${selectedFcuWriteEnabled ? "" : " warn"}`}>
                {hvacCopy(
                  "当前 FCU 已进入单台控制页：可执行单台预演、查看投运闸门和最近记录。",
                  "Current FCU is in single-device control: simulate the device and review commissioning gates and recent records.",
                  "FCU hiện tại đang ở trang điều khiển đơn: có thể mô phỏng, xem gate chạy thử và bản ghi gần nhất."
                )}
                {selectedFcuWriteEnabled
                  ? hvacCopy("该设备满足白名单与投运条件，当前预演生成 ready 后才允许确认下发。", "This device meets whitelist and commissioning gates; confirmed dispatch is allowed only after simulation generates ready commands.", "Thiết bị đạt whitelist và gate chạy thử; chỉ được xác nhận phát lệnh sau khi mô phỏng tạo lệnh ready.")
                  : hvacCopy("真实确认下发仍受白名单、后端只读总闸、适配器、数据质量和回退保护限制。", "Real confirmed dispatch is still limited by whitelist, backend gate, adapter, data quality, and rollback protection.", "Phát lệnh thật vẫn bị giới hạn bởi whitelist, tổng khóa backend, adapter, chất lượng dữ liệu và bảo vệ rollback.")}
              </div>
              <div className="fcu-final-status-panel hvac-terminal-device-final-gate">
                <div className="fcu-final-status-head">
                  <div>
                    <strong>{hvacCopy("单台最终控制门禁", "Single-device final gate", "Gate cuối từng FCU")}</strong>
                    <span>
                      {hvacCopy(
                        "当前 FCU 必须逐项通过设备质量、写总闸、Arm-Check、Canary、反馈确认和最终验收，才算进入真实闭环。",
                        "The current FCU must pass device quality, write gate, Arm-Check, Canary, feedback confirmation, and final acceptance before entering real closed-loop control.",
                        "FCU hiện tại phải đạt chất lượng thiết bị, tổng khóa ghi, Arm-Check, Canary, xác nhận phản hồi và nghiệm thu cuối trước khi vào điều khiển vòng kín thật."
                      )}
                    </span>
                  </div>
                  <span className={`status-pill ${selectedFinalGateOk ? "good" : "warn"}`}>
                    {selectedFinalGateOk ? hvacCopy("闭环完成", "Closed-loop complete", "Hoàn tất vòng kín") : hvacCopy("闭环未完成", "Closed-loop incomplete", "Chưa hoàn tất vòng kín")}
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
                    <strong>{hvacCopy("当前设备", "Current device", "Thiết bị hiện tại")}</strong>
                    <span>{selectedFanCoil.deviceCode || selectedFanCoil.deviceName || "--"} · {selectedFanCoil.deviceName || selectedFanCoil.floorName || floorName}</span>
                  </div>
                  <div>
                    <strong>{hvacCopy("真实写入边界", "Real-write boundary", "Ranh giới ghi thật")}</strong>
                    <span>{selectedFinalGateMutation ? hvacCopy("已有写入副作用，需核对审计记录", "Write side effects exist; audit records must be checked.", "Đã có tác dụng ghi; cần kiểm tra audit.") : hvacCopy("当前未产生 BA/PLC 写入副作用", "No BA/PLC write side effect currently.", "Hiện chưa có tác dụng ghi BA/PLC.")}</span>
                  </div>
                </div>
              </div>
              <div className="hvac-terminal-device-picker">
                <div className="hvac-terminal-device-picker-head">
                  <strong>{hvacCopy("FCU 逐台切换", "FCU device switcher", "Chuyển từng FCU")}</strong>
                  <span>{hvacCopy(`${fanCoilItems.length} 台均可点进单台控制页；当前命令只作用于选中的 FCU。`, `${fanCoilItems.length} FCUs can open the single-device page; commands apply only to the selected FCU.`, `${fanCoilItems.length} FCU có thể mở trang từng thiết bị; lệnh chỉ áp dụng cho FCU được chọn.`)}</span>
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
                        title={`${item.deviceName || deviceKey}: ${controlEntry.label}`}
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
                  <strong>{hvacCopy("现场开闸 Arm-Check", "Field Arm-Check", "Field Arm-Check")}</strong>
                  <span className={`status-pill ${fieldArmReady ? "good" : "warn"}`}>
                    {fieldArmReady ? hvacCopy("允许 Canary", "Can enter Canary", "Có thể vào Canary") : hvacCopy("禁止真实下发", "Live dispatch blocked", "Chặn phát lệnh thật")}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-summary">
                  <span>
                    {hvacCopy(
                      `首台 Canary：${fieldArmCheck?.firstCanary || canaryDeviceLabel}；队列设备：${fieldArmCheck?.commissioningSummary?.deviceReady || 0} 台设备侧就绪。`,
                      `First Canary: ${fieldArmCheck?.firstCanary || canaryDeviceLabel}; queue: ${fieldArmCheck?.commissioningSummary?.deviceReady || 0} device-side ready.`,
                      `Canary đầu: ${fieldArmCheck?.firstCanary || canaryDeviceLabel}; hàng đợi: ${fieldArmCheck?.commissioningSummary?.deviceReady || 0} thiết bị sẵn sàng phía thiết bị.`
                    )}
                  </span>
                  <span>
                    {fieldArmReady
                      ? hvacCopy("现场闸门已满足；仍需先单台反馈校验，再扩大。", "Field gate is satisfied; verify single-device feedback before expanding.", "Gate hiện trường đã đạt; cần kiểm tra phản hồi từng thiết bị trước khi mở rộng.")
                      : hvacCopy(`阻断项：${fieldArmBlockedText}`, `Blockers: ${fieldArmBlockedText}`, `Mục chặn: ${fieldArmBlockedText}`)}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {(fieldArmCheck?.checks || []).slice(0, 8).map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {translateFcuBackendText(condition.label || condition.key)}
                    </span>
                  ))}
                </div>
                {fieldArmNextActions.length > 0 ? (
                  <div className="fcu-commissioning-actions">
                    {fieldArmNextActions.slice(0, 4).map((action) => (
                      <span key={`${action.priority || "P"}-${action.action || action.target || action.reason}`}>
                        <strong>{action.priority || "P"} · {translateFcuBackendText(action.action || hvacText("下一步"))}</strong>
                        {action.target ? <small>{translateFcuBackendText(action.target)}</small> : null}
                        {action.reason ? <small>{translateFcuBackendText(action.reason)}</small> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="hvac-terminal-device-grid">
                <article className="hvac-terminal-device-primary">
                  <span>{hvacCopy("设备编号", "Device code", "Mã thiết bị")}</span>
                  <strong>{selectedFanCoil.deviceCode || selectedFanCoil.deviceId || "--"}</strong>
                  <small>{translateFcuBackendText(selectedFanCoil.deviceTypeName || "FCU")} · {selectedFanCoil.floorName || floorName}</small>
                </article>
                <article className="tone-good">
                  <span>{hvacCopy("区域温度", "Zone temp", "Nhiệt độ vùng")}</span>
                  <strong>{formatNumber(selectedFanCoil.zoneTemperatureC, 1)}°C</strong>
                  <small>{formatQualityStatus(selectedFanCoil.quality?.status || "unknown")}</small>
                </article>
                <article>
                  <span>{hvacCopy("设定反馈", "Setpoint feedback", "Phản hồi điểm đặt")}</span>
                  <strong>{formatNumber(selectedDeviceSetpoint, 1)}°C</strong>
                  <small>{hvacCopy("单次调整 0.5°C", "Single adjustment 0.5°C", "Mỗi lần chỉnh 0.5°C")}</small>
                </article>
                <article className={selectedFanCoil.running ? "tone-good" : "tone-neutral"}>
                  <span>{hvacCopy("运行状态", "Run status", "Trạng thái chạy")}</span>
                  <strong>{formatRunState(selectedFanCoil.running)}</strong>
                  <small>{hvacCopy("风速", "Fan", "Gió")} {formatNumber(selectedFanCoil.fanSpeedState, 0)}</small>
                </article>
                <article className={selectedFanCoil.communicationAlarm ? "tone-warn" : "tone-good"}>
                  <span>{hvacCopy("控制保护", "Control protection", "Bảo vệ điều khiển")}</span>
                  <strong>{selectedFanCoil.communicationAlarm ? hvacText("阻断") : fcuWriteEnabled ? hvacCopy("可预演", "Can simulate", "Có thể mô phỏng") : hvacText("只读")}</strong>
                  <small>{executionBoundaryLabel}</small>
                </article>
              </div>
              <div className="hvac-terminal-commissioning-gate hvac-terminal-device-commissioning">
                <div className="hvac-terminal-commissioning-gate-head">
                  <strong>{hvacCopy("单台投运状态", "Device commissioning status", "Trạng thái chạy thử thiết bị")}</strong>
                  <span className={`status-pill ${selectedCommissioning?.canDispatch ? "good" : selectedCommissioning?.deviceReady ? "neutral" : "warn"}`}>
                    {formatFcuCommissioningStatus(selectedCommissioning?.status)}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-summary">
                  <span>
                    {selectedCommissioning?.deviceReady
                      ? hvacCopy("该 FCU 的白名单、点位、通讯、温度质量已通过。", "This FCU passed whitelist, point, communication, and temperature quality checks.", "FCU này đạt whitelist, điểm đo, truyền thông và chất lượng nhiệt độ.")
                      : hvacCopy(`阻断项：${selectedCommissioningBlockedText}`, `Blockers: ${selectedCommissioningBlockedText}`, `Mục chặn: ${selectedCommissioningBlockedText}`)}
                  </span>
                  <span>
                    {hvacCopy("最近记录：", "Latest record: ", "Bản ghi gần nhất: ")}
                    {selectedCommissioning?.latestRecord
                      ? `${formatSampleTime(selectedCommissioning.latestRecord.createdAt)} · ${formatFcuControlStatus(selectedCommissioning.latestRecord.status)}`
                      : hvacText("暂无")}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {selectedCommissioningConditions.map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {translateFcuBackendText(condition.label || condition.key)}
                    </span>
                  ))}
                </div>
              </div>
              {selectedQualityRemediation ? (
                <div className="hvac-terminal-commissioning-gate hvac-terminal-device-remediation">
                  <div className="hvac-terminal-commissioning-gate-head">
                    <strong>{hvacCopy("本机 P0 消缺", "This FCU P0 remediation", "Xử lý P0 của FCU này")}</strong>
                    <span className="status-pill warn">{selectedQualityRemediation.severity || "P0"}</span>
                  </div>
                  <div className="hvac-terminal-device-remediation-reasons">
                    {(selectedQualityRemediation.reasons || []).slice(0, 5).map((reason) => (
                      <span key={`${selectedDeviceCode}-${reason}`}>{formatFcuBlockReason(reason)}</span>
                    ))}
                  </div>
                  <div className="hvac-terminal-device-remediation-body">
                    <div>
                      <strong>{hvacCopy("现场动作", "Field actions", "Hành động hiện trường")}</strong>
                      <ul>
                        {(selectedQualityRemediation.fieldActions || []).slice(0, 4).map((action) => (
                          <li key={`${selectedDeviceCode}-${action}`}>{action}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>{hvacCopy("放行标准", "Release criteria", "Tiêu chí cho phép")}</strong>
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
                    <strong>{hvacCopy("本机现场签核缺口", "This FCU field signoff gap", "Thiếu ký xác nhận hiện trường của FCU này")}</strong>
                    <span className={`status-pill ${selectedSignoffReleaseMatrix?.canEnterCanary ? "good" : "warn"}`}>
                      {selectedSignoffReleaseMatrix?.canEnterCanary ? hvacCopy("可进 Canary", "Can enter Canary", "Có thể vào Canary") : hvacCopy("签核/closeout 阻断", "Signoff / closeout blocked", "Bị chặn bởi ký xác nhận / closeout")}
                    </span>
                  </div>
                  <div className="hvac-terminal-commissioning-summary">
                    <span>
                      {hvacCopy("工单：", "Work order: ", "Phiếu việc: ")}
                      {selectedSignoffReleaseMatrix?.workOrderId || selectedSignoffOpenRecord?.workOrderId || selectedFieldPlaybookDevice?.workOrderId || "--"}
                      {hvacCopy("；现场放行：", "; onsite release: ", "; cho phép hiện trường: ")}
                      {selectedOnsiteReleasePrecheck?.onsiteReleaseReady ? hvacText("签字候选") : hvacText("未放行")}
                      {hvacCopy("；Canary：", "; Canary: ", "; Canary: ")}
                      {selectedOnsiteReleasePrecheck?.canEnterCanary || selectedSignoffReleaseMatrix?.canEnterCanary ? hvacText("候选") : hvacText("阻断")}
                      {hvacCopy("。", ".", ".")}
                    </span>
                    <span>
                      {selectedSignoffReleaseMatrix?.canaryBlockReason ||
                        selectedOnsiteReleasePrecheck?.canaryBlockReason ||
                        hvacCopy(
                          "补齐现场签核后仍需重跑实时 closeout、Canary readiness 和最终总门禁。",
                          "After field signoff is completed, rerun live closeout, Canary readiness, and the final master gate.",
                          "Sau khi hoàn tất ký xác nhận hiện trường, cần chạy lại closeout thời gian thực, Canary readiness và tổng gate cuối."
                        )}
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
                      <strong>{hvacCopy("必填签核字段", "Required signoff fields", "Trường ký xác nhận bắt buộc")}</strong>
                      <ul>
                        {selectedSignoffMissingChecklist.length > 0
                          ? selectedSignoffMissingChecklist.slice(0, 5).map((item) => (
                              <li key={`${selectedDeviceCode}-${item.field}`}>
                                {item.field || "--"} = {item.requiredValue || "--"}
                                {hvacCopy("；", "; ", "; ")}
                                {item.action || hvacCopy("现场复核后回填", "Review onsite, then fill back", "Kiểm tra hiện trường rồi cập nhật lại")}
                              </li>
                            ))
                          : selectedSignoffMissingFields.slice(0, 5).map((field) => (
                              <li key={`${selectedDeviceCode}-${field}`}>{field}</li>
                            ))}
                        {selectedSignoffMissingChecklist.length === 0 && selectedSignoffMissingFields.length === 0 ? (
                          <li>
                            {hvacCopy(
                              "当前未列出缺项；仍需以签字校验、实时 closeout 和 Canary 总门禁为准。",
                              "No missing item is listed now; the signoff check, live closeout, and Canary master gate remain authoritative.",
                              "Hiện chưa liệt kê mục thiếu; vẫn lấy kiểm tra ký xác nhận, closeout thời gian thực và tổng gate Canary làm chuẩn."
                            )}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <strong>{hvacText("下一步")}{hvacCopy("现场动作", " field actions", " hành động hiện trường")}</strong>
                      <ul>
                        {selectedSignoffNextActions.length > 0
                          ? selectedSignoffNextActions.slice(0, 5).map((action) => (
                              <li key={`${selectedDeviceCode}-signoff-action-${action}`}>{action}</li>
                            ))
                          : selectedSignoffReleaseCriteria.slice(0, 5).map((criterion) => (
                              <li key={`${selectedDeviceCode}-signoff-criterion-${criterion}`}>{criterion}</li>
                            ))}
                        {selectedSignoffNextActions.length === 0 && selectedSignoffReleaseCriteria.length === 0 ? (
                          <li>
                            {hvacCopy(
                              "按现场回填模板补齐后，刷新签字校验、现场消缺 closeout 和最终控制清单。",
                              "Complete the onsite return template, then refresh the signoff check, field closeout, and final control checklist.",
                              "Hoàn tất mẫu cập nhật hiện trường rồi làm mới kiểm tra ký xác nhận, closeout hiện trường và checklist điều khiển cuối."
                            )}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                  <div className="fcu-worklist-package-strip">
                    <strong>{hvacCopy("只读证据链", "Read-only evidence chain", "Chuỗi bằng chứng chỉ đọc")}</strong>
                    <span>
                      {hvacCopy(
                        "该卡片只读取 releaseMatrix / onsiteReleasePrecheck / readinessPlaybook，不保存签核、不生成真实 Canary、不下发 BA/PLC。",
                        "This card only reads releaseMatrix / onsiteReleasePrecheck / readinessPlaybook; it does not save signoff, generate live Canary, or dispatch BA/PLC.",
                        "Thẻ này chỉ đọc releaseMatrix / onsiteReleasePrecheck / readinessPlaybook; không lưu ký xác nhận, không tạo Canary thật, không phát lệnh BA/PLC."
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="hvac-terminal-commissioning-gate">
                <div className="hvac-terminal-commissioning-gate-head">
                  <strong>{hvacCopy("投运闸门", "Commissioning gate", "Gate chạy thử")}</strong>
                  <span className={`status-pill ${fcuWriteEnabled ? "good" : "warn"}`}>
                    {fcuWriteEnabled ? hvacText("允许真实下发") : formatFcuFinalDispatchGateSummary(fcuFinalDispatchGate)}
                  </span>
                </div>
                <div className="hvac-terminal-commissioning-gate-grid">
                  {(fcuExecutionGate?.conditions || []).map((condition) => (
                    <span key={condition.key || condition.label} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {translateFcuBackendText(condition.label || condition.key)}
                    </span>
                  ))}
                  {(fcuFinalDispatchGate?.conditions || []).map((condition) => (
                    <span key={`final-${condition.key || condition.label}`} className={condition.ok ? "is-ok" : "is-blocked"}>
                      {translateFcuBackendText(condition.label || condition.key)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="hvac-terminal-canary-panel is-canary">
                <div>
                  <strong>{hvacCopy("当前 FCU 逐台控制", "Current FCU device control", "Điều khiển FCU hiện tại")} · {selectedDeviceCode}</strong>
                  <span>
                    {hvacCopy(
                      `所有 FCU 均可从列表进入此单台页；当前命令只作用于本设备。确认下发仍受当前设备白名单、数据质量、后端总闸和审计保护。现场批量投运首台建议仍为 ${canaryDeviceLabel}。`,
                      `Every FCU can open this single-device page from the list; commands apply only to this device. Confirmed dispatch is still protected by this device's whitelist, data quality, backend gate, and audit controls. The recommended first field batch commissioning device remains ${canaryDeviceLabel}.`,
                      `Mỗi FCU đều có thể mở trang từng thiết bị từ danh sách; lệnh chỉ áp dụng cho thiết bị này. Phát lệnh xác nhận vẫn được bảo vệ bởi whitelist, chất lượng dữ liệu, gate backend và audit của thiết bị. Thiết bị đầu tiên khuyến nghị cho chạy thử batch hiện trường vẫn là ${canaryDeviceLabel}.`
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefreshFieldPreflight()}
                  disabled={!selectedDeviceCode || finalStatusRefreshing}
                  title={hvacCopy(
                    "刷新当前 FCU 的授权、投运闸门、Arm-Check、最终验收和最近记录；不生成新文件，不下发 BA/PLC",
                    "Refresh authorization, commissioning gate, Arm-Check, final acceptance, and recent records for this FCU; no files are generated and no BA/PLC dispatch occurs.",
                    "Làm mới ủy quyền, gate chạy thử, Arm-Check, nghiệm thu cuối và bản ghi gần đây của FCU này; không tạo file mới, không phát lệnh BA/PLC."
                  )}
                >
                  <RefreshCw size={14} />
                  {finalStatusRefreshing ? hvacCopy("刷新中", "Refreshing", "Đang làm mới") : hvacCopy("刷新开闸预检", "Refresh arm precheck", "Làm mới precheck mở gate")}
                </button>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>{hvacCopy("单台投运窗口", "Single-device commissioning window", "Cửa sổ chạy thử từng thiết bị")} · {selectedDeviceCode}</strong>
                  <span>
                    {hvacCopy(
                      "每台 FCU 都可以生成独立投运窗口、自检报告和反馈监视报告；真实下发仍必须按首台 Canary、反馈确认、小批量、全量的顺序推进。",
                      "Each FCU can generate its own commissioning window, self-check report, and feedback monitor; live dispatch must still proceed through first Canary, feedback confirmation, small batch, then full rollout.",
                      "Mỗi FCU có thể tạo cửa sổ chạy thử, báo cáo tự kiểm tra và giám sát phản hồi riêng; phát lệnh thật vẫn phải theo thứ tự Canary đầu, xác nhận phản hồi, batch nhỏ rồi toàn bộ."
                    )}
                  </span>
                  <span>
                    {hvacCopy("状态：", "Status: ", "Trạng thái: ")}{selectedCanaryWindowStatus}
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
                  {canaryWindowGenerating ? hvacCopy("生成中", "Generating", "Đang tạo") : hvacCopy("生成/刷新投运包", "Generate / refresh package", "Tạo / làm mới gói")}
                </button>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>{hvacCopy("现场开闸包", "Field arm package", "Gói mở gate hiện trường")} · {selectedDeviceCode}</strong>
                  <span>
                    {hvacCopy(
                      "为当前 FCU 独立生成现场授权、写点白名单、BA 写入门禁、反馈校验、回退触发和验收记录清单；该动作只生成文件，不下发 BA/PLC。",
                      "Generate field authorization, write whitelist, BA write gates, feedback checks, rollback triggers, and acceptance records for this FCU; this only creates files and never dispatches BA/PLC.",
                      "Tạo riêng ủy quyền hiện trường, whitelist điểm ghi, gate ghi BA, kiểm tra phản hồi, trigger rollback và danh sách nghiệm thu cho FCU này; thao tác chỉ tạo file, không phát lệnh BA/PLC."
                    )}
                  </span>
                  <span>
                    {hvacCopy("状态：", "Status: ", "Trạng thái: ")}{selectedFieldArmPackageStatus}
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
                  {fieldArmPackageGenerating ? hvacCopy("生成中", "Generating", "Đang tạo") : hvacCopy("生成开闸包", "Generate arm package", "Tạo gói mở gate")}
                </button>
              </div>
              <div className={`fcu-authorization-gate-panel${fcuAuthorizationReady ? "" : " is-blocked"}`}>
                <div className="fcu-authorization-gate-head">
                  <div>
                    <strong>{hvacCopy("3002 现场授权门禁", "3002 field authorization gate", "Gate ủy quyền hiện trường 3002")}</strong>
                    <span>
                      {hvacCopy(
                        "授权状态来自配置中心；这里只显示是否具备现场开闸条件，不保存、不展示真实确认短语。",
                        "Authorization state comes from config center. This view only shows field-arm readiness and never stores or displays the real phrase.",
                        "Trạng thái ủy quyền lấy từ trung tâm cấu hình. Trang này chỉ hiển thị điều kiện mở gate hiện trường, không lưu hoặc hiển thị cụm xác nhận thật."
                      )}
                    </span>
                  </div>
                  <span className={`status-pill ${fcuAuthorizationReady ? "good" : fcuFieldAuthorizationTone(fcuFieldAuthorization?.siteAuthorizationStatus)}`}>
                    {fcuAuthorizationReady ? hvacCopy("授权就绪", "Authorization ready", "Ủy quyền sẵn sàng") : hvacCopy("授权未就绪", "Authorization not ready", "Ủy quyền chưa sẵn sàng")}
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
                  <span>{hvacCopy("投运负责人：", "Commissioning owner: ", "Phụ trách chạy thử: ")}{translateFcuBackendText(fcuFieldAuthorization?.commissioningOwner || hvacText("未配置"))}</span>
                  <span>{hvacCopy("BA负责人：", "BA owner: ", "Phụ trách BA: ")}{translateFcuBackendText(fcuFieldAuthorization?.baOwner || hvacText("未配置"))}</span>
                  {fcuFieldAuthorization?.notes ? <span>{translateFcuBackendText(fcuFieldAuthorization.notes)}</span> : null}
                </div>
              </div>
              {selectedLiveGateActions.length > 0 ? (
                <div className="fcu-field-arm-actions-panel">
                  <div className="fcu-field-arm-actions-head">
                    <div>
                      <strong>{hvacCopy("实时开闸动作清单", "Live arm action list", "Danh sách hành động mở gate live")} · {selectedDeviceCode}</strong>
                      <span>
                        {hvacCopy(
                          "来自当前 FCU 开闸预检；按责任角色处理后刷新预检，确认不保存真实确认短语。",
                          "Generated from this FCU's arm precheck; resolve by owner role, then refresh the precheck. The real confirmation phrase is never stored.",
                          "Lấy từ precheck mở gate của FCU hiện tại; xử lý theo vai trò phụ trách rồi làm mới precheck. Không lưu cụm xác nhận thật."
                        )}
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
                          {item.writesControl ? hvacCopy(" · 涉及真实写入", " · real write involved", " · có ghi thật") : ""}
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
                      <strong>{hvacCopy("开闸消缺清单", "Arm remediation checklist", "Checklist xử lý mở gate")} · {selectedDeviceCode}</strong>
                      <span>
                        {hvacCopy(
                          "按最终控制投运顺序拆解 P0 阻断项；先消除软件/环境和现场授权，再进入 Canary 与反馈验收。",
                          "P0 blockers are split by final-control commissioning order; clear software/environment and field authorization first, then enter Canary and feedback acceptance.",
                          "Các mục chặn P0 được tách theo trình tự chạy thử điều khiển cuối; xử lý phần mềm/môi trường và ủy quyền hiện trường trước, rồi vào Canary và nghiệm thu phản hồi."
                        )}
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
                            {item.writesControl ? hvacCopy(" · 涉及真实写入", " · real write involved", " · có ghi thật") : ""}
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
                    <strong>{hvacCopy("Canary执行前置锁定", "Canary execution prelock", "Khóa trước thực thi Canary")} · {selectedDeviceCode}</strong>
                    <span>
                      {hvacCopy(
                        "真实 Canary 执行前必须依次通过 Field Arm、BA 写适配器、Canary 执行包和反馈监视；任一阻断时执行按钮只能返回阻断结果。",
                        "Live Canary execution must pass Field Arm, BA write adapter, Canary package, and feedback monitor in order. If any item is blocked, the execute button can only return a blocked result.",
                        "Trước khi thực thi Canary thật phải lần lượt đạt Field Arm, adapter ghi BA, gói Canary và giám sát phản hồi. Nếu bất kỳ mục nào bị chặn, nút thực thi chỉ trả về kết quả bị chặn."
                      )}
                    </span>
                  </div>
                  <span className={`status-pill ${selectedCanaryExecutionPrecheckReady ? "good" : "warn"}`}>
                    {selectedCanaryExecutionPrecheckReady ? hvacCopy("预检通过", "Precheck passed", "Precheck đạt") : hvacCopy("预检阻断", "Precheck blocked", "Precheck bị chặn")}
                  </span>
                </div>
                <div className="fcu-field-arm-summary">
                  {selectedCanaryExecutionLockChain.map((item) => (
                    <span key={item.key}>
                      <strong>{item.ok ? hvacText("通过") : hvacText("阻断")}</strong>
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
                      <em>
                        {item.ok
                          ? hvacCopy("保持证据", "Keep evidence", "Giữ bằng chứng")
                          : hvacCopy("未通过前禁止进入 3001 真实 Canary 执行", "Do not enter 3001 live Canary execution before this passes.", "Không vào thực thi Canary thật 3001 trước khi mục này đạt.")}
                      </em>
                    </article>
                  ))}
                </div>
                <div className="fcu-field-arm-actions-head">
                  <span>
                    {hvacCopy("第一阻断：", "First blocker: ", "Mục chặn đầu tiên: ")}
                    {selectedCanaryExecutionFirstBlocker?.label || hvacText("无")}
                    {" · "}
                    {selectedCanaryExecutionFirstBlocker?.verdict || hvacCopy("全部通过", "All passed", "Tất cả đã đạt")}
                    {hvacCopy(
                      "。该视图只读取预检证据，不保存确认短语、不下发 BA/PLC。",
                      ". This view only reads precheck evidence; it does not save the confirmation phrase or dispatch BA/PLC.",
                      ". Trang này chỉ đọc bằng chứng precheck; không lưu cụm xác nhận và không phát lệnh BA/PLC."
                    )}
                  </span>
                </div>
              </div>
              <div className="hvac-terminal-canary-panel">
                <div>
                  <strong>{hvacCopy("现场授权 Canary", "Field-authorized Canary", "Canary được ủy quyền hiện trường")} · {selectedDeviceCode}</strong>
                  <span>
                    {hvacCopy(
                      "该入口会请求后端真实 Canary 下发；必须后端非只读、确认短语正确、首台顺序和现场 Arm-Check 全部满足。当前环境会被只读总闸阻断。",
                      "This entry requests a live Canary dispatch from the backend. Backend write mode, correct confirmation phrase, first-device sequence, and Field Arm-Check must all pass. The current environment is blocked by the read-only master gate.",
                      "Lối vào này yêu cầu backend phát lệnh Canary thật. Backend phải không ở chế độ chỉ đọc, cụm xác nhận đúng, đúng thứ tự thiết bị đầu và Field Arm-Check đều đạt. Môi trường hiện tại bị tổng khóa chỉ đọc chặn."
                    )}
                  </span>
                  <span>
                    {hvacCopy("执行按钮锁定：", "Execute button lock: ", "Khóa nút thực thi: ")}
                    {selectedCanaryDispatchLocked
                      ? selectedCanaryDispatchLockReason
                      : hvacCopy("前置链已通过，等待确认短语和后端总闸", "Precheck chain passed; waiting for confirmation phrase and backend master gate", "Chuỗi precheck đã đạt; chờ cụm xác nhận và tổng khóa backend")}
                    {hvacCopy("。", ".", ".")}
                  </span>
                  {selectedCanaryDispatch ? (
                    <span>
                      {hvacCopy("状态：", "Status: ", "Trạng thái: ")}
                      {selectedCanaryDispatch.code || selectedCanaryDispatch.mode || (selectedCanaryDispatch.ok ? hvacText("已执行") : hvacText("已阻断"))}
                      {selectedCanaryDispatch.error ? ` · ${selectedCanaryDispatch.error}` : ""}
                    </span>
                  ) : null}
                  <div className="hvac-terminal-manual-input-row">
                    <input
                      type="password"
                      value={canaryDispatchConfirmText}
                      onChange={(event) => setCanaryDispatchConfirmText(event.target.value)}
                      placeholder={hvacCopy("输入真实 BA 写入确认短语", "Enter the real BA write confirmation phrase", "Nhập cụm xác nhận ghi BA thật")}
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
                    ? hvacCopy(`前置链未通过：${selectedCanaryDispatchLockReason}`, `Precheck chain failed: ${selectedCanaryDispatchLockReason}`, `Chuỗi precheck chưa đạt: ${selectedCanaryDispatchLockReason}`)
                    : hvacCopy(
                        "必须输入确认短语；后端仍会检查 read-only、Arm-Check、首台顺序和反馈门禁",
                        "A confirmation phrase is required; the backend still checks read-only mode, Arm-Check, first-device order, and feedback gates.",
                        "Bắt buộc nhập cụm xác nhận; backend vẫn kiểm tra chế độ chỉ đọc, Arm-Check, thứ tự thiết bị đầu và gate phản hồi."
                      )}
                >
                  <ShieldCheck size={14} />
                  {canaryDispatchRunning ? hvacCopy("执行中", "Executing", "Đang thực thi") : hvacCopy("执行 Canary", "Execute Canary", "Thực thi Canary")}
                </button>
              </div>
              <div className="hvac-terminal-manual-control-panel">
                <div className="hvac-terminal-manual-control-head">
                  <strong>{hvacCopy("单台手动控制", "Single-device manual control", "Điều khiển thủ công từng thiết bị")}</strong>
                  <span>
                    {hvacCopy(
                      "先预演，后确认；命令仍通过白名单、质量门槛、保持时间、审计和回退保护。",
                      "Simulate first, then confirm; commands still pass whitelist, quality thresholds, hold time, audit, and rollback protection.",
                      "Mô phỏng trước, xác nhận sau; lệnh vẫn qua whitelist, ngưỡng chất lượng, thời gian giữ, audit và bảo vệ rollback."
                    )}
                  </span>
                </div>
                <div className="hvac-terminal-manual-control-grid">
                  <article>
                    <span>{hvacCopy("启停", "Start / stop", "Bật / tắt")}</span>
                    <div className="hvac-terminal-manual-actions">
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("start", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("预演启动", "Simulate start", "Mô phỏng bật")}
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("start", true)}
                        disabled={!canConfirmManualCommand("start") || manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("确认启动", "Confirm start", "Xác nhận bật")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("stop", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("预演停止", "Simulate stop", "Mô phỏng tắt")}
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("stop", true)}
                        disabled={!canConfirmManualCommand("stop") || manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("确认停止", "Confirm stop", "Xác nhận tắt")}
                      </button>
                    </div>
                  </article>
                  <article>
                    <label htmlFor="fcu-manual-setpoint">{hvacCopy("设定温度", "Temperature setpoint", "Nhiệt độ cài đặt")}</label>
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
                        {hvacCopy("预演设定", "Simulate setpoint", "Mô phỏng cài đặt")}
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("setpoint", true)}
                        disabled={!canConfirmManualCommand("setpoint") || manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("确认设定", "Confirm setpoint", "Xác nhận cài đặt")}
                      </button>
                    </div>
                  </article>
                  <article>
                    <label htmlFor="fcu-manual-fan-speed">{hvacCopy("风速模式", "Fan speed mode", "Chế độ tốc độ quạt")}</label>
                    <select
                      id="fcu-manual-fan-speed"
                      value={manualFanSpeed}
                      onChange={(event) => setManualFanSpeed(event.target.value)}
                    >
                      <option value="auto">{hvacText("自动")}</option>
                      <option value="low">{hvacText("低")}</option>
                      <option value="medium">{hvacText("中")}</option>
                      <option value="high">{hvacText("高")}</option>
                    </select>
                    <div className="hvac-terminal-manual-actions">
                      <button
                        type="button"
                        onClick={() => void handleRunManualCommand("fan_speed", false)}
                        disabled={manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("预演风速", "Simulate fan", "Mô phỏng quạt")}
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void handleRunManualCommand("fan_speed", true)}
                        disabled={!canConfirmManualCommand("fan_speed") || manualCommandRunning || manualCommandDispatching}
                      >
                        {hvacCopy("确认", "Confirm ", "Xác nhận ")}{formatManualFanSpeed(manualFanSpeed)}
                      </button>
                    </div>
                  </article>
                </div>
              </div>
              <div className="fcu-control-inline-queue">
                <strong>{hvacCopy("最近动作", "Recent action", "Hành động gần đây")}</strong>
                <span>
                  {selectedDeviceLastRecord
                    ? `${formatSampleTime(selectedDeviceLastRecord.createdAt)} · ${formatFcuControlStatus(selectedDeviceLastRecord.status)} · ${selectedDeviceLastRecord.commands?.length ? formatCompactCount(selectedDeviceLastRecord.commands.length, "条命令") : selectedDeviceLastRecord.reason || hvacText("保持")}`
                    : hvacCopy("暂无单台控制记录；先执行预演单台。", "No single-device control record yet; simulate this device first.", "Chưa có bản ghi điều khiển từng thiết bị; hãy mô phỏng thiết bị này trước.")}
                </span>
              </div>
              {selectedDeviceRecords.length > 0 ? (
                <div className="hvac-terminal-trend fcu-control-record-detail">
                  {selectedDeviceRecords.slice(0, 8).map((record) => (
                    <div key={record.recordId || `${record.deviceCode}-${record.createdAt}`} className="hvac-terminal-trend-point">
                      <span>{formatSampleTime(record.createdAt)}</span>
                      <strong>{formatFcuControlStatus(record.status)}</strong>
                      <small>
                        {record.commands?.length ? formatCompactCount(record.commands.length, "条命令") : record.reason || hvacText("保持")}
                        {record.blockReasons?.length ? ` · ${record.blockReasons[0]}` : ""}
                        {["dispatched", "feedback_pending", "feedback_mismatch_locked"].includes(record.status || "") && record.recordId ? (
                          <button
                            type="button"
                            className="fcu-feedback-check-button"
                            onClick={() => void handleVerifyFeedback(record.recordId)}
                            disabled={feedbackVerifyingId === record.recordId}
                          >
                            {feedbackVerifyingId === record.recordId ? hvacText("校验中") : hvacText("校验反馈")}
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
                  title={hvacCopy(
                    `${item.deviceName || deviceKey}：进入单台控制页，${controlEntry.label}`,
                    `${item.deviceName || deviceKey}: open the single-device control page, ${controlEntry.label}`,
                    `${item.deviceName || deviceKey}: mở trang điều khiển từng thiết bị, ${controlEntry.label}`
                  )}
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

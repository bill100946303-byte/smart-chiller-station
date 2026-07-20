import type { SourceEndpointStatusDto, SourceStatusDto } from "../services/bffClient";
import { getCurrentLocale, zhCN } from "./zhCN";

type LocaleCode = ReturnType<typeof getCurrentLocale>;
type LabelMode = "short" | "full";
type LocaleLabel = { short: string; full: string };

const SOURCE_KEY_ALIAS_MAP: Record<string, string> = {
  subsystemInfo: "subsystemSummary"
};

const SOURCE_KEY_LABEL_MAP: Record<string, Record<LocaleCode, LocaleLabel>> = {
  energy: {
    "zh-CN": { short: "能耗总览", full: "能耗总览来源" },
    "en-US": { short: "Energy", full: "Energy Overview Source" },
    "vi-VN": { short: "Năng lượng", full: "Nguồn tổng quan năng lượng" }
  },
  homepageRealtime: {
    "zh-CN": { short: "实时首页", full: "首页实时链路来源" },
    "en-US": { short: "Realtime", full: "Homepage Realtime Source" },
    "vi-VN": { short: "Realtime", full: "Nguồn thời gian thực trang chủ" }
  },
  devices: {
    "zh-CN": { short: "设备清单", full: "设备清单来源" },
    "en-US": { short: "Devices", full: "Device List Source" },
    "vi-VN": { short: "Thiết bị", full: "Nguồn danh sách thiết bị" }
  },
  devicesTree: {
    "zh-CN": { short: "设备树", full: "设备树来源" },
    "en-US": { short: "Tree", full: "Device Tree Source" },
    "vi-VN": { short: "Cây TB", full: "Nguồn cây thiết bị" }
  },
  devicesCatalog: {
    "zh-CN": { short: "设备主数据", full: "设备主数据来源" },
    "en-US": { short: "Catalog", full: "Device Catalog Source" },
    "vi-VN": { short: "Danh mục", full: "Nguồn master-data thiết bị" }
  },
  devicesPlaceholder: {
    "zh-CN": { short: "设备占位", full: "设备占位回退" },
    "en-US": { short: "Placeholder", full: "Device Placeholder Fallback" },
    "vi-VN": { short: "Du phong", full: "Nguon du phong thiet bi" }
  },
  devicesPlaceholderSummary: {
    "zh-CN": { short: "摘要占位", full: "设备摘要占位回退" },
    "en-US": { short: "Sum Fallback", full: "Device Summary Placeholder Fallback" },
    "vi-VN": { short: "Du phong tong", full: "Nguon du phong tom tat thiet bi" }
  },
  devicesPlaceholderList: {
    "zh-CN": { short: "列表占位", full: "设备列表占位回退" },
    "en-US": { short: "List Fallback", full: "Device List Placeholder Fallback" },
    "vi-VN": { short: "Du phong DS", full: "Nguon du phong danh sach thiet bi" }
  },
  deviceDetailPlaceholder: {
    "zh-CN": { short: "详情占位", full: "设备详情占位回退" },
    "en-US": { short: "Detail Fallback", full: "Device Detail Placeholder Fallback" },
    "vi-VN": { short: "Du phong CT", full: "Nguon du phong chi tiet thiet bi" }
  },
  energyAnalysisTree: {
    "zh-CN": { short: "能耗树", full: "能耗分析树来源" },
    "en-US": { short: "Energy Tree", full: "Energy Analysis Tree Source" },
    "vi-VN": { short: "Cây năng lượng", full: "Nguồn cây phân tích năng lượng" }
  },
  energyAnalysisDevices: {
    "zh-CN": { short: "能耗设备", full: "能耗分析设备目录来源" },
    "en-US": { short: "Energy Devices", full: "Energy Analysis Device Catalog Source" },
    "vi-VN": { short: "Thiết bị NL", full: "Nguồn danh mục thiết bị phân tích năng lượng" }
  },
  energyAnalysisCurve: {
    "zh-CN": { short: "能耗曲线", full: "能耗分析曲线来源" },
    "en-US": { short: "Energy Curve", full: "Energy Analysis Curve Source" },
    "vi-VN": { short: "Đường NL", full: "Nguồn đường phân tích năng lượng" }
  },
  energyEfficiencySearch: {
    "zh-CN": { short: "能效查询", full: "能效查询来源" },
    "en-US": { short: "Eff Search", full: "Energy Efficiency Search Source" },
    "vi-VN": { short: "Tra cứu HQ", full: "Nguồn tra cứu hiệu suất năng lượng" }
  },
  energyEfficiencyCalendar: {
    "zh-CN": { short: "能效日历", full: "能效日历来源" },
    "en-US": { short: "Eff Calendar", full: "Energy Efficiency Calendar Source" },
    "vi-VN": { short: "Lịch HQ", full: "Nguồn lịch hiệu suất năng lượng" }
  },
  energyEfficiencyCalendarSummary: {
    "zh-CN": { short: "月汇总", full: "能效月汇总来源" },
    "en-US": { short: "Month Sum", full: "Energy Efficiency Month Summary Source" },
    "vi-VN": { short: "Tong thang", full: "Nguon tong hop thang hieu suat nang luong" }
  },
  energyEfficiencyCalendarPie: {
    "zh-CN": { short: "能耗分项", full: "能效日历分项来源" },
    "en-US": { short: "Eff Pie", full: "Energy Efficiency Composition Source" },
    "vi-VN": { short: "Co cau HQ", full: "Nguon co cau nang luong hieu suat" }
  },
  energyEfficiencyCompare: {
    "zh-CN": { short: "能效对比", full: "能效对比来源" },
    "en-US": { short: "Eff Compare", full: "Energy Efficiency Compare Source" },
    "vi-VN": { short: "So sánh HQ", full: "Nguồn so sánh hiệu suất năng lượng" }
  },
  energyEfficiencyProportion: {
    "zh-CN": { short: "负荷比重", full: "负荷比重来源" },
    "en-US": { short: "Load Mix", full: "Load Proportion Source" },
    "vi-VN": { short: "Tỷ trọng tải", full: "Nguồn tỷ trọng phụ tải" }
  },
  energyEfficiencyImbalanceCurve: {
    "zh-CN": { short: "热平衡曲线", full: "热平衡偏差曲线来源" },
    "en-US": { short: "Imb Curve", full: "Thermal Imbalance Curve Source" },
    "vi-VN": { short: "Duong mat can", full: "Nguon duong mat can bang nhiet" }
  },
  energyEfficiencyImbalanceTable: {
    "zh-CN": { short: "热平衡统计", full: "热平衡偏差统计来源" },
    "en-US": { short: "Imb Table", full: "Thermal Imbalance Statistics Source" },
    "vi-VN": { short: "Thong ke mat can", full: "Nguon thong ke mat can bang nhiet" }
  },
  sceneLegacyTrend: {
    "zh-CN": { short: "旧点位趋势", full: "旧点位趋势来源" },
    "en-US": { short: "Legacy Trend", full: "Legacy Point Trend Source" },
    "vi-VN": { short: "Xu huong cu", full: "Nguon xu huong diem cu" }
  },
  sceneOnlineMonitor: {
    "zh-CN": { short: "在线监测", full: "在线监测来源" },
    "en-US": { short: "Online", full: "Online Monitor Source" },
    "vi-VN": { short: "Giam sat online", full: "Nguon giam sat truc tuyen" }
  },
  knowledgeDocuments: {
    "zh-CN": { short: "说明书", full: "知识库说明书来源" },
    "en-US": { short: "Docs", full: "Knowledge Documents Source" },
    "vi-VN": { short: "Tai lieu", full: "Nguon tai lieu kho kien thuc" }
  },
  knowledgeDeviceTypes: {
    "zh-CN": { short: "设备类型", full: "知识库设备类型来源" },
    "en-US": { short: "Types", full: "Knowledge Device Types Source" },
    "vi-VN": { short: "Loai TB", full: "Nguon loai thiet bi kho kien thuc" }
  },
  workOrders: {
    "zh-CN": { short: "工单列表", full: "工单列表来源" },
    "en-US": { short: "Orders", full: "Work Order List Source" },
    "vi-VN": { short: "Cong viec", full: "Nguon danh sach cong viec" }
  },
  workOrderAssignees: {
    "zh-CN": { short: "接单人", full: "工单接单人来源" },
    "en-US": { short: "Assignees", full: "Work Order Assignee Source" },
    "vi-VN": { short: "Nguoi nhan", full: "Nguon nguoi nhan cong viec" }
  },
  environmentBuildings: {
    "zh-CN": { short: "楼栋", full: "环境楼栋来源" },
    "en-US": { short: "Buildings", full: "Environment Building Source" },
    "vi-VN": { short: "Toa nha", full: "Nguon toa nha moi truong" }
  },
  environmentConditions: {
    "zh-CN": { short: "工况点位", full: "环境工况点位来源" },
    "en-US": { short: "Conditions", full: "Environment Condition Source" },
    "vi-VN": { short: "Diem do", full: "Nguon diem dieu kien moi truong" }
  },
  environmentConditionsLegacy: {
    "zh-CN": { short: "旧工况表", full: "环境工况主源" },
    "en-US": { short: "Legacy Cond", full: "Environment Legacy Condition Source" },
    "vi-VN": { short: "Nguon cu", full: "Nguon dieu kien moi truong cu" }
  },
  environmentConditionsCatalog: {
    "zh-CN": { short: "房间目录", full: "环境工况房间目录来源" },
    "en-US": { short: "Room Catalog", full: "Environment Room Catalog Source" },
    "vi-VN": { short: "Danh muc phong", full: "Nguon danh muc phong moi truong" }
  },
  environmentConditionsRuntime: {
    "zh-CN": { short: "房间寄存器", full: "环境工况房间寄存器来源" },
    "en-US": { short: "Room Runtime", full: "Environment Room Runtime Source" },
    "vi-VN": { short: "Runtime phong", full: "Nguon runtime phong moi truong" }
  },
  deviceDetailCatalog: {
    "zh-CN": { short: "详情主数据", full: "设备详情主数据来源" },
    "en-US": { short: "Detail Catalog", full: "Device Detail Catalog Source" },
    "vi-VN": { short: "Chi tiết gốc", full: "Nguồn master-data chi tiết thiết bị" }
  },
  deviceDetailTree: {
    "zh-CN": { short: "详情树骨架", full: "设备详情树骨架来源" },
    "en-US": { short: "Detail Tree", full: "Device Detail Tree Source" },
    "vi-VN": { short: "Cây chi tiết", full: "Nguồn cây chi tiết thiết bị" }
  },
  deviceDetailRuntime: {
    "zh-CN": { short: "详情运行态", full: "设备详情运行/告警态来源" },
    "en-US": { short: "Detail Runtime", full: "Device Detail Runtime/Alarm Source" },
    "vi-VN": { short: "Runtime chi tiết", full: "Nguồn runtime/cảnh báo chi tiết thiết bị" }
  },
  alarms: {
    "zh-CN": { short: "告警摘要", full: "告警摘要来源" },
    "en-US": { short: "Alarm Sum", full: "Alarm Summary Source" },
    "vi-VN": { short: "Tổng báo động", full: "Nguồn tóm tắt báo động" }
  },
  energyCurve: {
    "zh-CN": { short: "能耗趋势", full: "能耗趋势来源" },
    "en-US": { short: "Energy Trend", full: "Energy Trend Source" },
    "vi-VN": { short: "Xu hướng NL", full: "Nguồn xu hướng năng lượng" }
  },
  runParams: {
    "zh-CN": { short: "运行参数", full: "运行参数趋势来源" },
    "en-US": { short: "Params", full: "Runtime Parameter Trend Source" },
    "vi-VN": { short: "Tham số", full: "Nguồn xu hướng tham số vận hành" }
  },
  subsystemSummary: {
    "zh-CN": { short: "子系统", full: "子系统概览来源" },
    "en-US": { short: "Subsys", full: "Subsystem Summary Source" },
    "vi-VN": { short: "Phân hệ", full: "Nguồn tổng quan phân hệ" }
  },
  latestAlarmLog: {
    "zh-CN": { short: "最新告警", full: "最新告警日志来源" },
    "en-US": { short: "Alarms", full: "Latest Alarm Log Source" },
    "vi-VN": { short: "Báo động", full: "Nguồn nhật ký báo động mới nhất" }
  },
  rules: {
    "zh-CN": { short: "规则配置", full: "规则配置来源" },
    "en-US": { short: "Rules", full: "Rule Config Source" },
    "vi-VN": { short: "Luật", full: "Nguồn cấu hình luật" }
  },
  dashboardOverview: {
    "zh-CN": { short: "总览聚合", full: "总览聚合内部来源" },
    "en-US": { short: "Overview", full: "Overview Aggregation Internal Source" },
    "vi-VN": { short: "Tổng quan", full: "Nguồn nội bộ tổng hợp tổng quan" }
  },
  anomalySummary: {
    "zh-CN": { short: "异常聚合", full: "异常聚合内部来源" },
    "en-US": { short: "Anomaly", full: "Anomaly Aggregation Internal Source" },
    "vi-VN": { short: "Bất thường", full: "Nguồn nội bộ tổng hợp bất thường" }
  },
  recommendations: {
    "zh-CN": { short: "建议聚合", full: "建议聚合内部来源" },
    "en-US": { short: "Recs", full: "Recommendations Internal Source" },
    "vi-VN": { short: "Khuyến nghị", full: "Nguồn nội bộ tổng hợp khuyến nghị" }
  },
  historyBenchmark: {
    "zh-CN": { short: "历史对标", full: "历史对标来源" },
    "en-US": { short: "History", full: "Historical Benchmark Source" },
    "vi-VN": { short: "Đối chiếu LS", full: "Nguồn đối chiếu lịch sử" }
  },
  optimizeDraft: {
    "zh-CN": { short: "优化草案", full: "优化草案来源" },
    "en-US": { short: "Draft", full: "Optimize Draft Source" },
    "vi-VN": { short: "Bản nháp", full: "Nguồn bản nháp optimize" }
  },
  alarmDiagnosis: {
    "zh-CN": { short: "告警诊断", full: "告警诊断来源" },
    "en-US": { short: "Alarm Diagnosis", full: "Alarm Diagnosis Source" },
    "vi-VN": { short: "Chan doan bao dong", full: "Nguon chan doan bao dong" }
  },
  trendBaseline: {
    "zh-CN": { short: "趋势基线", full: "趋势基线来源" },
    "en-US": { short: "Trend Baseline", full: "Trend Baseline Source" },
    "vi-VN": { short: "Nen xu huong", full: "Nguon duong co so xu huong" }
  },
  trendQuality: {
    "zh-CN": { short: "趋势质量", full: "趋势质量来源" },
    "en-US": { short: "Trend Quality", full: "Trend Quality Source" },
    "vi-VN": { short: "Chat luong xu huong", full: "Nguon chat luong du lieu xu huong" }
  },
  alarmSeveritySplit: {
    "zh-CN": { short: "告警分级", full: "告警等级拆分来源" },
    "en-US": { short: "Alarm Split", full: "Alarm Severity Split Source" },
    "vi-VN": { short: "Phan cap bao dong", full: "Nguon tach cap do bao dong" }
  },
  ruleMetrics: {
    "zh-CN": { short: "规则聚合", full: "规则指标聚合来源" },
    "en-US": { short: "Rule Agg", full: "Rule Metrics Aggregation Source" },
    "vi-VN": { short: "Tổng hợp luật", full: "Nguồn tổng hợp chỉ số luật" }
  }
};

const METRIC_KEY_LABEL_MAP: Record<string, Record<LocaleCode, LocaleLabel>> = {
  chilled_delta_t_c: {
    "zh-CN": { short: "冷冻温差", full: "规则指标：冷冻水温差" },
    "en-US": { short: "CHW dT", full: "Rule Metric: Chilled Water Delta-T" },
    "vi-VN": { short: "DeltaT lạnh", full: "Chỉ số luật: chênh nhiệt nước lạnh" }
  },
  cooling_delta_t_c: {
    "zh-CN": { short: "冷却温差", full: "规则指标：冷却水温差" },
    "en-US": { short: "CW dT", full: "Rule Metric: Cooling Water Delta-T" },
    "vi-VN": { short: "DeltaT giải nhiệt", full: "Chỉ số luật: chênh nhiệt nước giải nhiệt" }
  },
  station_cop: {
    "zh-CN": { short: "冷站COP", full: "规则指标：冷站COP" },
    "en-US": { short: "COP", full: "Rule Metric: Station COP" },
    "vi-VN": { short: "COP trạm", full: "Chỉ số luật: COP trạm lạnh" }
  },
  station_total_power_kw: {
    "zh-CN": { short: "总站功率", full: "规则指标：冷站实时总功率" },
    "en-US": { short: "Power", full: "Rule Metric: Station Total Power" },
    "vi-VN": { short: "Công suất trạm", full: "Chỉ số luật: tổng công suất trạm lạnh" }
  }
};

const UNKNOWN_SOURCE_LABEL: Record<LocaleCode, LocaleLabel> = {
  "zh-CN": {
    short: "数据来源",
    full: "数据来源"
  },
  "en-US": {
    short: "Data Source",
    full: "Data Source"
  },
  "vi-VN": {
    short: "Nguồn dữ liệu",
    full: "Nguồn dữ liệu"
  }
};

const METRIC_FALLBACK_LABEL: Record<LocaleCode, LocaleLabel> = {
  "zh-CN": {
    short: "规则指标",
    full: "规则指标"
  },
  "en-US": {
    short: "Rule Agg",
    full: "Rule Metric"
  },
  "vi-VN": {
    short: "Tổng hợp luật",
    full: "Chỉ số luật"
  }
};

function normalizeText(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

type SourceStateKind = "ok" | "warn" | "error";

function resolveSourceKeyAlias(key: string | undefined): string | undefined {
  if (!key) {
    return undefined;
  }
  return SOURCE_KEY_ALIAS_MAP[key] || key;
}

function getMetricFallbackLabel(metricKey: string, mode: LabelMode, locale: LocaleCode): string {
  const knownLabel = METRIC_KEY_LABEL_MAP[metricKey]?.[locale];
  if (knownLabel) {
    return knownLabel[mode];
  }

  if (mode === "short") {
    return METRIC_FALLBACK_LABEL[locale].short;
  }
  if (locale === "zh-CN") {
    return `${METRIC_FALLBACK_LABEL[locale].full}：${metricKey}`;
  }
  return `${METRIC_FALLBACK_LABEL[locale].full}: ${metricKey}`;
}

function getUnknownSourceLabel(key: string, mode: LabelMode, locale: LocaleCode): string {
  if (mode === "short") {
    return UNKNOWN_SOURCE_LABEL[locale].short;
  }
  if (locale === "zh-CN") {
    return UNKNOWN_SOURCE_LABEL[locale].full;
  }
  if (locale === "en-US") {
    return `${UNKNOWN_SOURCE_LABEL[locale].full} (${key})`;
  }
  if (locale === "vi-VN") {
    return `${UNKNOWN_SOURCE_LABEL[locale].full} (${key})`;
  }
  return UNKNOWN_SOURCE_LABEL["zh-CN"].full;
}

function getSourceLabel(key: string | undefined, endpoint: string | undefined, mode: LabelMode): string {
  const locale = getCurrentLocale();
  if (!key) {
    if (!endpoint) {
      return zhCN.common.unknown;
    }
    return getUnknownSourceLabel(endpoint, mode, locale);
  }

  const canonicalKey = resolveSourceKeyAlias(key);
  if (canonicalKey && SOURCE_KEY_LABEL_MAP[canonicalKey]) {
    return SOURCE_KEY_LABEL_MAP[canonicalKey][locale][mode];
  }

  if (canonicalKey?.startsWith("metric.")) {
    const metricKey = canonicalKey.slice("metric.".length);
    return getMetricFallbackLabel(metricKey, mode, locale);
  }

  return getUnknownSourceLabel(canonicalKey || key, mode, locale);
}

function getSourceStateText(source: SourceEndpointStatusDto): string {
  const locale = getCurrentLocale();
  const reasonCode = normalizeText(source.reasonCode);
  if (source.fallback === true) {
    if (locale === "en-US") {
      return "Fallback Active";
    }
    if (locale === "vi-VN") {
      return "Dang dung che do du phong";
    }
    return "兼容回退中";
  }
  const state = classifySourceState(source);
  if (state === "ok") {
    if (locale === "en-US") {
      return "Healthy";
    }
    if (locale === "vi-VN") {
      return "Bình thường";
    }
    return "数据正常";
  }
  if (state === "warn") {
    if (reasonCode === "draft_not_implemented") {
      if (locale === "en-US") {
        return "Context Draft Only";
      }
      if (locale === "vi-VN") {
        return "Chỉ có bản nháp ngữ cảnh";
      }
      return "仅提供治理态草案";
    }
    if (reasonCode === "history_samples_unavailable") {
      if (locale === "en-US") {
        return "Historical Samples Unavailable";
      }
      if (locale === "vi-VN") {
        return "Thiếu mẫu lịch sử";
      }
      return "历史样本不足";
    }
    if (
      reasonCode === "baseline_snapshot_missing" ||
      reasonCode === "alarm_snapshot_missing" ||
      reasonCode === "recommendation_cards_missing" ||
      reasonCode === "field_missing_or_invalid"
    ) {
      if (locale === "en-US") {
        return "Field Missing/Invalid";
      }
      if (locale === "vi-VN") {
        return "Thiếu hoặc sai trường dữ liệu";
      }
      return "字段缺失或无效";
    }
    if (reasonCode === "partial_fallback") {
      if (locale === "en-US") {
        return "Partial Fallback";
      }
      if (locale === "vi-VN") {
        return "Đang dùng một phần dự phòng";
      }
      return "部分兼容回退";
    }
    if (locale === "en-US") {
      return "Field Missing/Invalid";
    }
    if (locale === "vi-VN") {
      return "Thiếu hoặc sai trường dữ liệu";
    }
    return "字段缺失或无效";
  }

  const message = normalizeText(source.message);
  const error = normalizeText(source.error);
  const detail = `${message} ${error}`;

  if (reasonCode === "upstream_5xx") {
    if (locale === "en-US") {
      return "Upstream 5xx";
    }
    if (locale === "vi-VN") {
      return "Upstream trả về 5xx";
    }
    return "上游接口 5xx";
  }

  if (reasonCode === "upstream_4xx") {
    if (locale === "en-US") {
      return "Upstream 4xx";
    }
    if (locale === "vi-VN") {
      return "Upstream trả về 4xx";
    }
    return "上游接口 4xx";
  }

  if (typeof source.status === "number" && source.status >= 500) {
    if (locale === "en-US") {
      return "Upstream Service Error";
    }
    if (locale === "vi-VN") {
      return "Lỗi dịch vụ upstream";
    }
    return "上游服务异常";
  }

  if (detail.includes("upstream_unreachable") || detail.includes("unreachable") || detail.includes("fetch failed")) {
    if (locale === "en-US") {
      return "Upstream Unreachable";
    }
    if (locale === "vi-VN") {
      return "Không truy cập được upstream";
    }
    return "上游不可达";
  }

  if (source.status == null) {
    if (locale === "en-US") {
      return "Upstream Unreachable/Parse Failed";
    }
    if (locale === "vi-VN") {
      return "Không truy cập upstream hoặc lỗi phân tích";
    }
    return "上游不可达或解析失败";
  }

  if (locale === "en-US") {
    return "Abnormal";
  }
  if (locale === "vi-VN") {
    return "Bất thường";
  }
  return "状态异常";
}

function getLabelStateSeparator(): string {
  const locale = getCurrentLocale();
  if (locale === "zh-CN") {
    return "：";
  }
  return ": ";
}

function normalizeBaseUrl(value: string | null | undefined): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveBaseHost(baseUrl: string): string {
  if (!baseUrl) {
    return "";
  }
  try {
    return new URL(baseUrl).host;
  } catch (_error) {
    return "";
  }
}

function getOriginLabel(
  locale: LocaleCode,
  kind:
    | "cloudDocument"
    | "localDocument"
    | "documentInterface"
    | "cloudDevice"
    | "localDevice"
    | "deviceInterface"
    | "cloudRealtime"
    | "localRealtime"
    | "realtimeInterface"
    | "localCompat"
): string {
  switch (kind) {
    case "cloudDocument":
      return locale === "en-US"
        ? "Cloud Document API"
        : locale === "vi-VN"
          ? "API tai lieu tren cloud"
          : "云端文档接口";
    case "localDocument":
      return locale === "en-US"
        ? "Local Document API"
        : locale === "vi-VN"
          ? "API tai lieu local"
          : "本地文档接口";
    case "documentInterface":
      return locale === "en-US"
        ? "Document API"
        : locale === "vi-VN"
          ? "API tai lieu"
          : "文档接口";
    case "cloudDevice":
      return locale === "en-US"
        ? "Cloud Device API"
        : locale === "vi-VN"
          ? "API thiet bi tren cloud"
          : "云端设备接口";
    case "localDevice":
      return locale === "en-US"
        ? "Local Device API"
        : locale === "vi-VN"
          ? "API thiet bi local"
          : "本地设备接口";
    case "deviceInterface":
      return locale === "en-US"
        ? "Device API"
        : locale === "vi-VN"
          ? "API thiet bi"
          : "设备实时接口";
    case "cloudRealtime":
      return locale === "en-US"
        ? "Cloud Realtime"
        : locale === "vi-VN"
          ? "Realtime tren cloud"
          : "云端实时";
    case "localRealtime":
      return locale === "en-US"
        ? "Local Realtime"
        : locale === "vi-VN"
          ? "Realtime local"
          : "本地实时";
    case "realtimeInterface":
      return locale === "en-US"
        ? "Realtime API"
        : locale === "vi-VN"
          ? "API realtime"
          : "实时接口";
    case "localCompat":
      return locale === "en-US"
        ? "Local Compatibility"
        : locale === "vi-VN"
          ? "Tuong thich local"
          : "本地兼容";
    default:
      return "";
  }
}

function resolveSourceOriginText(source: SourceEndpointStatusDto, mode: LabelMode): string {
  const locale = getCurrentLocale();
  const explicit = String(source.originLabel || "").trim();
  if (explicit && !/legacy/i.test(explicit)) {
    return explicit;
  }

  const endpoint = String(source.endpoint || "");
  const interfaceKind = normalizeText(source.interfaceKind);
  const baseUrl = normalizeBaseUrl(source.baseUrl);
  const host = resolveBaseHost(baseUrl);
  const lowerHost = host.toLowerCase();
  const isCloud = lowerHost.includes("ssge.com.cn");
  const isLocal = lowerHost.includes("127.0.0.1") || lowerHost.includes("localhost");

  let label = "";
  if (interfaceKind === "legacy-reg-findallbydrtypeid" || endpoint.includes("/findAllByDrTypeId")) {
    label = getOriginLabel(locale, isCloud ? "cloudDocument" : isLocal ? "localDocument" : "documentInterface");
  } else if (interfaceKind === "api-device-data" || endpoint.includes("/api/device/")) {
    label = getOriginLabel(locale, isCloud ? "cloudDevice" : isLocal ? "localDevice" : "deviceInterface");
  } else if (
    interfaceKind === "homepage-realtime" ||
    interfaceKind.startsWith("legacy-homepage-") ||
    endpoint.includes("/zsqy/homepage/") ||
    endpoint.startsWith("/ws/")
  ) {
    label = getOriginLabel(locale, isCloud ? "cloudRealtime" : isLocal ? "localRealtime" : "realtimeInterface");
  } else if (isLocal) {
    label = getOriginLabel(locale, "localCompat");
  } else if (isCloud) {
    label = getOriginLabel(locale, "cloudRealtime");
  } else if (host) {
    label = host;
  }

  if (!label) {
    return "";
  }
  if (mode === "short" || !host || explicit) {
    return label;
  }
  if (locale === "zh-CN") {
    return `${label}（${host}）`;
  }
  return `${label} (${host})`;
}

function formatStateWithOrigin(state: string, origin: string): string {
  if (!origin) {
    return state;
  }
  return `${state} · ${origin}`;
}

function classifySourceState(source: SourceEndpointStatusDto): SourceStateKind {
  const reasonCode = normalizeText(source.reasonCode);
  if (source.fallback === true) {
    return "warn";
  }
  if (source.ok === true) {
    return "ok";
  }

  const message = normalizeText(source.message);
  const error = normalizeText(source.error);
  const detail = `${message} ${error}`;

  if (detail.includes("field_missing_or_invalid") || detail.includes("field missing") || detail.includes("invalid")) {
    return "warn";
  }

  if (
    reasonCode === "draft_not_implemented" ||
    reasonCode === "history_samples_unavailable" ||
    reasonCode === "baseline_snapshot_missing" ||
    reasonCode === "alarm_snapshot_missing" ||
    reasonCode === "recommendation_cards_missing" ||
    reasonCode === "field_missing_or_invalid" ||
    reasonCode === "partial_fallback"
  ) {
    return "warn";
  }

  if (
    reasonCode === "upstream_5xx" ||
    reasonCode === "upstream_4xx" ||
    reasonCode === "upstream_unreachable" ||
    reasonCode === "upstream_unavailable"
  ) {
    return "error";
  }

  if (typeof source.status === "number" && source.status >= 500) {
    return "error";
  }

  if (typeof source.status === "number" && source.status >= 400) {
    return "error";
  }

  if (detail.includes("upstream_unreachable") || detail.includes("unreachable") || detail.includes("fetch failed")) {
    return "error";
  }

  if (source.status == null) {
    return "error";
  }

  return "warn";
}

export function formatSourceStatusLine(source: SourceEndpointStatusDto): string {
  const label = getSourceLabel(source.key, source.endpoint, "full");
  const state = formatStateWithOrigin(getSourceStateText(source), resolveSourceOriginText(source, "full"));
  return `${label}${getLabelStateSeparator()}${state}`;
}

export function formatSourceStatusLineCompact(source: SourceEndpointStatusDto): string {
  const label = getSourceLabel(source.key, source.endpoint, "short");
  const state = formatStateWithOrigin(getSourceStateText(source), resolveSourceOriginText(source, "short"));
  return `${label}${getLabelStateSeparator()}${state}`;
}

function mergeSourceEntries(sourceStatuses: Array<SourceStatusDto | null | undefined>): SourceEndpointStatusDto[] {
  const merged = new Map<string, SourceEndpointStatusDto>();

  sourceStatuses.forEach((sourceStatus) => {
    (sourceStatus?.sources || []).forEach((source, index) => {
      const canonicalKey = resolveSourceKeyAlias(source.key);
      const mergeKey = canonicalKey || source.endpoint || `unknown-${index}`;
      const current = merged.get(mergeKey);
      if (!current) {
        merged.set(mergeKey, source);
        return;
      }

      merged.set(mergeKey, {
        ...current,
        ...source,
        baseUrl: current.baseUrl || source.baseUrl,
        interfaceKind: current.interfaceKind || source.interfaceKind,
        originLabel: current.originLabel || source.originLabel
      });
    });
  });

  return Array.from(merged.values());
}

export function buildSourceStatusLines(
  sourceStatuses: Array<SourceStatusDto | null | undefined>,
  options?: {
    limit?: number;
    labelMode?: LabelMode;
  }
): string[] {
  const limit = options?.limit;
  const labelMode = options?.labelMode || "full";
  const sortedSources = mergeSourceEntries(sourceStatuses).sort((a, b) => {
    const rank = (source: SourceEndpointStatusDto) => {
      const state = classifySourceState(source);
      if (state === "error") {
        return 0;
      }
      if (state === "warn") {
        return 1;
      }
      return 2;
    };
    return rank(a) - rank(b);
  });

  const lines = sortedSources.map((source) =>
    labelMode === "short" ? formatSourceStatusLineCompact(source) : formatSourceStatusLine(source)
  );
  if (typeof limit !== "number" || limit <= 0 || lines.length <= limit) {
    return lines;
  }

  const rest = lines.length - limit;
  return [
    ...lines.slice(0, limit),
    `${zhCN.sourceBanner.foldedRestPrefix} ${rest} ${zhCN.sourceBanner.foldedRestSuffix}`
  ];
}

export function summarizeSourceOrigins(
  sourceStatuses: Array<SourceStatusDto | null | undefined>,
  options?: {
    limit?: number;
    labelMode?: LabelMode;
  }
): string {
  const limit = options?.limit;
  const labelMode = options?.labelMode || "short";
  const origins = [];
  const seen = new Set<string>();

  for (const source of mergeSourceEntries(sourceStatuses)) {
    const origin = resolveSourceOriginText(source, labelMode);
    if (!origin || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    origins.push(origin);
    if (typeof limit === "number" && limit > 0 && origins.length >= limit) {
      break;
    }
  }

  return origins.join(" / ");
}

export function summarizeSourceStatus(sourceStatuses: Array<SourceStatusDto | null | undefined>): {
  text: string;
  warn: boolean;
} {
  const sources = mergeSourceEntries(sourceStatuses);
  if (sources.length === 0) {
    return { text: zhCN.sourceBanner.noSource, warn: false };
  }

  const abnormal = sources.filter((source) => classifySourceState(source) !== "ok").length;
  if (abnormal === 0) {
    return {
      text: `${zhCN.sourceBanner.summaryPrefix}${sources.length}/${sources.length} ${zhCN.sourceBanner.summaryOkSuffix}`,
      warn: false
    };
  }

  return {
    text: `${zhCN.sourceBanner.summaryPrefix}${abnormal}/${sources.length} ${zhCN.sourceBanner.summaryAbnormalSuffix}`,
    warn: true
  };
}

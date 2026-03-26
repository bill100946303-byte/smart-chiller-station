type RiskLevel = "high" | "medium" | "low";
type SeverityLevel = "critical" | "major" | "minor" | "normal";
type SkipCategory = "upstream_unreachable" | "field_missing_or_invalid" | "unknown";
import { getCurrentLocale } from "./zhCN";

type RuleCopy = {
  nameZh: string;
  descriptionZh: string;
  opsAdviceZh: string;
};

type LocaleCode = ReturnType<typeof getCurrentLocale>;

const ruleCopyMapByLocale: Record<LocaleCode, Record<string, RuleCopy>> = {
  "zh-CN": {
  "low-delta-t-chilled-loop": {
    nameZh: "冷冻侧低温差",
    descriptionZh: "在有一定负荷时，冷冻水供回水温差持续偏低，通常表示换热利用不足或旁通偏大。",
    opsAdviceZh: "先查末端阀门与旁通，再校核供水温度设定。"
  },
  "pump-frequency-too-high": {
    nameZh: "冷冻泵高频低效",
    descriptionZh: "冷冻泵频率长期偏高，但温差提升有限，存在输配侧能耗偏高风险。",
    opsAdviceZh: "下调泵频并观察压差/舒适度，复核压差传感器。"
  },
  "cooling-side-low-efficiency": {
    nameZh: "冷却侧效率偏低",
    descriptionZh: "冷却侧功率投入较高但散热效果偏弱，导致系统COP被拉低。",
    opsAdviceZh: "优化塔风机分级与冷却水设定，检查冷凝器污垢。"
  },
  "frequent-start-stop": {
    nameZh: "设备频繁启停",
    descriptionZh: "主机或水泵在短时间内反复启停，可能引发控制震荡与设备磨损。",
    opsAdviceZh: "启用最小启停锁定时间，放宽控制死区。"
  },
  "stale-data-detection": {
    nameZh: "数据新鲜度不足",
    descriptionZh: "关键指标更新时间滞后或缺失，当前建议结论可信度下降。",
    opsAdviceZh: "优先恢复数据链路，再执行节能优化动作。"
  }
  },
  "en-US": {
    "low-delta-t-chilled-loop": {
      nameZh: "Low Delta-T (Chilled Loop)",
      descriptionZh: "Under meaningful load, chilled-water delta-T remains too low, indicating poor heat utilization or bypass risk.",
      opsAdviceZh: "Check terminal valves/bypass first, then verify chilled-water supply setpoint."
    },
    "pump-frequency-too-high": {
      nameZh: "High Pump Frequency, Low Efficiency",
      descriptionZh: "Chilled pump frequency stays high while delta-T gain is limited, indicating distribution-side energy waste.",
      opsAdviceZh: "Reduce pump frequency and observe pressure/comfort, then verify pressure sensor quality."
    },
    "cooling-side-low-efficiency": {
      nameZh: "Low Cooling-Side Efficiency",
      descriptionZh: "High cooling-side power with weak heat rejection drags overall station COP.",
      opsAdviceZh: "Optimize tower fan staging and cooling-water setpoint; inspect condenser fouling."
    },
    "frequent-start-stop": {
      nameZh: "Frequent Start/Stop",
      descriptionZh: "Frequent starts/stops in short windows may indicate control oscillation and increase wear.",
      opsAdviceZh: "Enable minimum run/stop lock time and widen control deadband."
    },
    "stale-data-detection": {
      nameZh: "Data Freshness Insufficient",
      descriptionZh: "Critical metrics are stale or missing, reducing recommendation confidence.",
      opsAdviceZh: "Recover data pipeline first, then execute optimization actions."
    }
  },
  "vi-VN": {
    "low-delta-t-chilled-loop": {
      nameZh: "Delta-T thấp (vòng nước lạnh)",
      descriptionZh: "Khi tải đủ lớn nhưng chênh nhiệt nước lạnh vẫn thấp kéo dài, thường cho thấy trao đổi nhiệt kém hoặc bypass lớn.",
      opsAdviceZh: "Kiểm tra van đầu cuối/bypass trước, sau đó rà lại setpoint nước cấp."
    },
    "pump-frequency-too-high": {
      nameZh: "Tần số bơm cao, hiệu suất thấp",
      descriptionZh: "Tần số bơm lạnh duy trì cao nhưng cải thiện delta-T hạn chế, có nguy cơ hao điện phía phân phối.",
      opsAdviceZh: "Hạ tần số bơm và theo dõi áp suất/độ tiện nghi, rồi kiểm tra cảm biến áp."
    },
    "cooling-side-low-efficiency": {
      nameZh: "Hiệu suất phía giải nhiệt thấp",
      descriptionZh: "Công suất phía giải nhiệt cao nhưng hiệu quả tản nhiệt yếu, làm giảm COP toàn trạm.",
      opsAdviceZh: "Tối ưu cấp quạt tháp và setpoint nước giải nhiệt; kiểm tra cáu cặn bình ngưng."
    },
    "frequent-start-stop": {
      nameZh: "Khởi động/dừng quá thường xuyên",
      descriptionZh: "Thiết bị khởi động dừng lặp lại trong thời gian ngắn, dễ gây dao động điều khiển và mài mòn.",
      opsAdviceZh: "Bật khóa thời gian chạy/dừng tối thiểu và nới dải chết điều khiển."
    },
    "stale-data-detection": {
      nameZh: "Độ mới dữ liệu không đạt",
      descriptionZh: "Chỉ số quan trọng bị trễ hoặc thiếu, làm giảm độ tin cậy của khuyến nghị.",
      opsAdviceZh: "Khôi phục luồng dữ liệu trước, sau đó mới thực hiện tối ưu."
    }
  }
};

const skippedCategoryMainCopyByLocale: Record<LocaleCode, Record<SkipCategory, string>> = {
  "zh-CN": {
    upstream_unreachable: "上游接口不可达",
    field_missing_or_invalid: "关键字段缺失或无效",
    unknown: "数据异常（待确认）"
  },
  "en-US": {
    upstream_unreachable: "Upstream Unreachable",
    field_missing_or_invalid: "Field Missing/Invalid",
    unknown: "Data Abnormal (Pending Check)"
  },
  "vi-VN": {
    upstream_unreachable: "Không truy cập được upstream",
    field_missing_or_invalid: "Thiếu/không hợp lệ trường dữ liệu",
    unknown: "Dữ liệu bất thường (chờ xác minh)"
  }
};

const skippedCategoryDetailCopyByLocale: Record<LocaleCode, Record<SkipCategory, string>> = {
  "zh-CN": {
    upstream_unreachable: "上游数据源暂不可达，本条规则已跳过；请先恢复接口连通后重试。",
    field_missing_or_invalid: "缺少规则所需关键字段或字段值无效，本条规则已跳过。",
    unknown: "当前规则暂不可执行，系统已降级处理，请稍后重试。"
  },
  "en-US": {
    upstream_unreachable: "Upstream data source is unreachable. This rule is skipped; restore connectivity and retry.",
    field_missing_or_invalid: "Required fields are missing or invalid. This rule is skipped.",
    unknown: "Rule cannot be evaluated now. System falls back safely; please retry later."
  },
  "vi-VN": {
    upstream_unreachable: "Nguồn dữ liệu upstream không truy cập được. Luật này đã bị bỏ qua; hãy khôi phục kết nối rồi thử lại.",
    field_missing_or_invalid: "Thiếu trường bắt buộc hoặc dữ liệu không hợp lệ. Luật này đã bị bỏ qua.",
    unknown: "Hiện chưa thể đánh giá luật. Hệ thống đã hạ cấp an toàn; vui lòng thử lại sau."
  }
};

const riskCopyMapByLocale: Record<LocaleCode, Record<RiskLevel, string>> = {
  "zh-CN": { high: "高风险", medium: "中风险", low: "低风险" },
  "en-US": { high: "High Risk", medium: "Medium Risk", low: "Low Risk" },
  "vi-VN": { high: "Rủi ro cao", medium: "Rủi ro trung bình", low: "Rủi ro thấp" }
};

const severityCopyMapByLocale: Record<LocaleCode, Record<SeverityLevel, string>> = {
  "zh-CN": { critical: "紧急", major: "重要", minor: "提示", normal: "正常" },
  "en-US": { critical: "Critical", major: "Major", minor: "Minor", normal: "Normal" },
  "vi-VN": { critical: "Khẩn cấp", major: "Quan trọng", minor: "Nhắc nhở", normal: "Bình thường" }
};

function hasChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function hasVietnamese(value: string): boolean {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(value);
}

function isSkipCategory(value: string | undefined): value is SkipCategory {
  return value === "upstream_unreachable" || value === "field_missing_or_invalid" || value === "unknown";
}

export function getRuleCopy(ruleId: string | null | undefined): RuleCopy | null {
  if (!ruleId) {
    return null;
  }
  return ruleCopyMapByLocale[getCurrentLocale()][ruleId] || null;
}

export function preferChineseText(primary: string | null | undefined, fallback: string): string {
  if (!primary) {
    return fallback;
  }
  const locale = getCurrentLocale();
  if (locale === "zh-CN") {
    return hasChinese(primary) ? primary : fallback;
  }
  if (locale === "vi-VN") {
    return hasVietnamese(primary) ? primary : fallback;
  }
  return hasChinese(primary) || hasVietnamese(primary) ? fallback : primary;
}

export function getSkippedCategoryLabel(category: string | undefined): string {
  const locale = getCurrentLocale();
  const map = skippedCategoryMainCopyByLocale[locale];
  if (!isSkipCategory(category)) {
    return map.unknown;
  }
  return map[category];
}

export function getSkippedCategoryDetail(category: string | undefined, message?: string | null): string {
  const locale = getCurrentLocale();
  if (message && preferChineseText(message, "") === message) {
    return message;
  }
  const map = skippedCategoryDetailCopyByLocale[locale];
  if (!isSkipCategory(category)) {
    return map.unknown;
  }
  return map[category];
}

export function normalizeRiskLevel(value: string | null | undefined): RiskLevel | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().trim();
  if (
    normalized === "high" ||
    normalized === "cao" ||
    value === "高" ||
    value === "高风险" ||
    value === "Rủi ro cao"
  ) {
    return "high";
  }
  if (
    normalized === "medium" ||
    normalized === "trung bình" ||
    value === "中" ||
    value === "中风险" ||
    value === "Rủi ro trung bình"
  ) {
    return "medium";
  }
  if (
    normalized === "low" ||
    normalized === "thấp" ||
    value === "低" ||
    value === "低风险" ||
    value === "Rủi ro thấp"
  ) {
    return "low";
  }
  return null;
}

export function getRiskCopy(value: string | null | undefined): string {
  const locale = getCurrentLocale();
  const level = normalizeRiskLevel(value);
  if (!level) {
    return riskCopyMapByLocale[locale].medium;
  }
  return riskCopyMapByLocale[locale][level];
}

export function getSeverityCopy(value: string | null | undefined): string {
  const locale = getCurrentLocale();
  if (!value) {
    if (locale === "en-US") {
      return "Unknown";
    }
    if (locale === "vi-VN") {
      return "Không xác định";
    }
    return "未知";
  }
  const normalized = value.toLowerCase().trim();
  if (normalized === "critical") {
    return severityCopyMapByLocale[locale].critical;
  }
  if (normalized === "major") {
    return severityCopyMapByLocale[locale].major;
  }
  if (normalized === "minor") {
    return severityCopyMapByLocale[locale].minor;
  }
  if (normalized === "normal") {
    return severityCopyMapByLocale[locale].normal;
  }
  if (normalized === "high") {
    if (locale === "en-US") {
      return "High";
    }
    if (locale === "vi-VN") {
      return "Cao";
    }
    return "高";
  }
  if (normalized === "medium") {
    if (locale === "en-US") {
      return "Medium";
    }
    if (locale === "vi-VN") {
      return "Trung bình";
    }
    return "中";
  }
  if (normalized === "low") {
    if (locale === "en-US") {
      return "Low";
    }
    if (locale === "vi-VN") {
      return "Thấp";
    }
    return "低";
  }
  if ((locale === "zh-CN" && hasChinese(value)) || (locale === "vi-VN" && hasVietnamese(value))) {
    return value;
  }
  if (locale === "en-US") {
    return "Unknown";
  }
  if (locale === "vi-VN") {
    return "Không xác định";
  }
  return "未知";
}

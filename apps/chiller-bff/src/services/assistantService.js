import { buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";
import { getAnomalySummary } from "./anomalyService.js";
import { getDashboardOverview } from "./dashboardService.js";
import { getDeviceList } from "./deviceService.js";
import { getRecommendations } from "./recommendationService.js";
import { matchOperationsKnowledgeQuery } from "./operationsKnowledgeService.js";

const DATASET_LABELS = {
  zh: {
    dashboardOverview: "站点总览",
    anomalySummary: "异常摘要",
    recommendations: "建议卡片",
    deviceList: "设备清单",
    operationsKnowledge: "运维知识"
  },
  vi: {
    dashboardOverview: "Tổng quan trạm",
    anomalySummary: "Tóm tắt cảnh báo",
    recommendations: "Thẻ khuyến nghị",
    deviceList: "Danh sách thiết bị",
    operationsKnowledge: "Tri thuc van hanh"
  }
};

const CORE_METRICS = {
  zh: [
    { key: "totalPowerKw", label: "总功率" },
    { key: "currentCop", label: "站点 COP" },
    { key: "chilledDeltaT", label: "冷冻水温差" },
    { key: "coolingDeltaT", label: "冷却水温差" }
  ],
  vi: [
    { key: "totalPowerKw", label: "tổng công suất" },
    { key: "currentCop", label: "COP trạm" },
    { key: "chilledDeltaT", label: "chênh nhiệt nước lạnh" },
    { key: "coolingDeltaT", label: "chênh nhiệt nước giải nhiệt" }
  ]
};

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLocale(locale) {
  return String(locale || "").trim().toLowerCase().startsWith("vi") ? "vi" : "zh";
}

function normalizeSurface(value) {
  if (typeof value !== "string") {
    return "legacy-home-chat";
  }
  const trimmed = value.trim();
  return trimmed || "legacy-home-chat";
}

function formatNumber(value, locale, digits = 2) {
  const number = asFiniteNumber(value);
  if (number === null) {
    return locale === "vi" ? "không rõ" : "未知";
  }
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(number);
}

function formatTimestamp(value, locale) {
  if (!value) {
    return locale === "vi" ? "không rõ" : "未知";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "vi" ? "không rõ" : "未知";
  }
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function localizeSeverity(value, locale) {
  const key = String(value || "").toLowerCase();
  if (locale === "vi") {
    if (key === "critical") {
      return "khẩn cấp";
    }
    if (key === "major") {
      return "nghiêm trọng";
    }
    if (key === "minor") {
      return "thông thường";
    }
    if (key === "normal") {
      return "bình thường";
    }
    return "không rõ";
  }
  if (key === "critical") {
    return "紧急";
  }
  if (key === "major") {
    return "严重";
  }
  if (key === "minor") {
    return "一般";
  }
  if (key === "normal") {
    return "正常";
  }
  return "未知";
}

function localizeRisk(value, locale) {
  const key = String(value || "").toLowerCase();
  if (locale === "vi") {
    if (key === "high") {
      return "cao";
    }
    if (key === "medium") {
      return "trung bình";
    }
    if (key === "low") {
      return "thấp";
    }
    return "không rõ";
  }
  if (key === "high") {
    return "高";
  }
  if (key === "medium") {
    return "中";
  }
  if (key === "low") {
    return "低";
  }
  return "未知";
}

function localizePriority(value, locale) {
  const key = String(value || "").toLowerCase();
  if (locale === "vi") {
    if (key === "high") {
      return "ưu tiên cao";
    }
    if (key === "medium") {
      return "ưu tiên trung bình";
    }
    if (key === "low") {
      return "ưu tiên thấp";
    }
    return "không rõ";
  }
  if (key === "high") {
    return "高优先级";
  }
  if (key === "medium") {
    return "中优先级";
  }
  if (key === "low") {
    return "低优先级";
  }
  return "未知";
}

function buildFreshnessLabel(latestTimestamp, stale) {
  if (!latestTimestamp) {
    return "unknown";
  }
  return stale ? "stale" : "fresh";
}

function combineFreshnessState(freshnessItems) {
  const candidates = freshnessItems.filter(Boolean);
  const timestamps = candidates
    .map((item) => item?.latestTimestamp)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const latestTimestamp = timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
  const stale = candidates.some((item) => item?.stale === true);

  return {
    label: buildFreshnessLabel(latestTimestamp, stale),
    latestTimestamp,
    stale: latestTimestamp ? stale : false
  };
}

function buildDatasetHealth(key, endpoint, data) {
  const overall = data?.sourceStatus?.overall || "failed";
  const sources = Array.isArray(data?.sourceStatus?.sources) ? data.sourceStatus.sources : [];
  const ok = overall === "ok" || overall === "partial";
  const fallback = overall === "partial" || sources.some((source) => source?.fallback === true);
  return {
    key,
    endpoint,
    ok,
    fallback,
    status: null,
    message: overall,
    error: ok ? null : `${key} unavailable`,
    rows: sources.length > 0 ? sources.length : null
  };
}

function buildCitations(locale, keys) {
  const labels = DATASET_LABELS[locale] || DATASET_LABELS.zh;
  return keys.map((key) => ({
    sourceKey: key,
    label: labels[key] || key
  }));
}

function pickPrimaryRecommendation(recommendations) {
  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards : [];
  return cards[0] || null;
}

function countDeviceStatuses(deviceList) {
  const counts = {
    online: 0,
    offline: 0,
    unknown: 0
  };
  for (const item of Array.isArray(deviceList?.items) ? deviceList.items : []) {
    const status = String(item?.status || "unknown").toLowerCase();
    if (status === "online") {
      counts.online += 1;
    } else if (status === "offline") {
      counts.offline += 1;
    } else {
      counts.unknown += 1;
    }
  }
  return counts;
}

function listMissingCoreMetrics(energyCards, locale) {
  const metricDefs = CORE_METRICS[locale] || CORE_METRICS.zh;
  return metricDefs.filter((metric) => asFiniteNumber(energyCards?.[metric.key]) === null);
}

function formatMetricLabels(metricDefs) {
  return metricDefs.map((metric) => metric.label).join("、");
}

function analyzeDeviceObservability(deviceList, deviceSummary, locale) {
  const counts = countDeviceStatuses(deviceList);
  const deviceTotal = deviceList?.total ?? deviceSummary?.totalDevices ?? 0;
  const summaryTotal =
    (deviceSummary?.chillerCount ?? 0) +
    (deviceSummary?.chilledPumpCount ?? 0) +
    (deviceSummary?.coolingPumpCount ?? 0) +
    (deviceSummary?.coolingTowerCount ?? 0);
  const sourceEntries = Array.isArray(deviceList?.sourceStatus?.sources) ? deviceList.sourceStatus.sources : [];
  const hasPlaceholderSource = sourceEntries.some((source) => source?.fallback === true);
  const allUnknownStatuses =
    deviceTotal > 0 &&
    counts.online === 0 &&
    counts.offline === 0 &&
    counts.unknown >= deviceTotal;
  const missingTypeBreakdown = deviceTotal > 0 && summaryTotal === 0;
  const incompleteTypeBreakdown = deviceTotal > 0 && summaryTotal > 0 && summaryTotal < deviceTotal;
  const limited =
    hasPlaceholderSource || allUnknownStatuses || missingTypeBreakdown || incompleteTypeBreakdown;

  let detail = null;
  if (locale === "vi") {
    if (hasPlaceholderSource) {
      detail =
        "Lưu ý chuỗi thiết bị: danh sách thiết bị hiện có dữ liệu fallback hoặc placeholder, không nên dùng trực tiếp để phán đoán trạng thái online.";
    } else if (missingTypeBreakdown && allUnknownStatuses) {
      detail =
        "Lưu ý chuỗi thiết bị: tổng số thiết bị đã trả về, nhưng phân loại thiết bị và trạng thái online vẫn chưa đầy đủ.";
    } else if (allUnknownStatuses) {
      detail =
        "Lưu ý chuỗi thiết bị: trạng thái của toàn bộ thiết bị hiện đều là không rõ, cần quay lại trang gốc để xác nhận.";
    } else if (incompleteTypeBreakdown) {
      detail =
        "Lưu ý chuỗi thiết bị: tổng số thiết bị đã trả về, nhưng phân loại theo loại thiết bị vẫn chưa đầy đủ.";
    }
  } else if (hasPlaceholderSource) {
    detail = "设备链路提示：设备清单当前包含 fallback 或占位数据，暂不宜据此判断设备在线情况。";
  } else if (missingTypeBreakdown && allUnknownStatuses) {
    detail = "设备链路提示：设备总数已返回，但设备类型拆分与在线状态仍不完整，暂不宜据此判断设备分布。";
  } else if (allUnknownStatuses) {
    detail = "设备链路提示：设备清单状态当前全部为未知，建议回原始页面或现场确认在线情况。";
  } else if (incompleteTypeBreakdown) {
    detail = "设备链路提示：设备总数已返回，但设备类型拆分仍不完整，建议结合原始页面核对。";
  }

  return {
    counts,
    deviceTotal,
    summaryTotal,
    limited,
    detail
  };
}

function normalizePromptOrigin(value) {
  return String(value || "").trim().toLowerCase() === "suggested" ? "suggested" : "manual";
}

function dedupeTextList(items, limit = 4) {
  const deduped = [];
  for (const item of Array.isArray(items) ? items : []) {
    const text = String(item || "").trim();
    if (!text || deduped.includes(text)) {
      continue;
    }
    deduped.push(text);
    if (deduped.length >= limit) {
      break;
    }
  }
  return deduped;
}

function buildAnswerPayload(kind, summary, details = [], nextSteps = [], pageHints = []) {
  return {
    kind,
    summary,
    details: dedupeTextList(details, 6),
    nextSteps: dedupeTextList(nextSteps, 4),
    pageHints: dedupeTextList(pageHints, 4)
  };
}

function localizePageHint(locale, key) {
  if (locale === "vi") {
    const viLabels = {
      dashboardOverview: "Tong quan tram",
      anomalySummary: "Trang canh bao",
      recommendations: "The khuyen nghi",
      deviceList: "Danh sach thiet bi",
      rawPage: "Trang goc"
    };
    return viLabels[key] || key;
  }
  const zhLabels = {
    dashboardOverview: "站点总览",
    anomalySummary: "告警页面",
    recommendations: "建议卡片",
    deviceList: "设备清单",
    rawPage: "原始页面"
  };
  return zhLabels[key] || key;
}

function buildPageHints(locale, keys) {
  return dedupeTextList(
    (Array.isArray(keys) ? keys : []).map((key) => localizePageHint(locale, key)).filter(Boolean),
    4
  );
}

function guessDeviceFocusCategory(primaryCard, latestEvent) {
  const corpus = [
    primaryCard?.title,
    primaryCard?.reason,
    ...(Array.isArray(primaryCard?.actions) ? primaryCard.actions : []),
    ...(Array.isArray(primaryCard?.evidence) ? primaryCard.evidence : []),
    latestEvent?.title,
    latestEvent?.source
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!corpus) {
    return null;
  }
  if (/主机|冷机|冷水机组|机组|chiller/.test(corpus)) {
    return "chiller";
  }
  if (/冷冻泵|冷冻水泵|chilled pump/.test(corpus)) {
    return "chilledPump";
  }
  if (/冷却泵|冷却水泵|cooling pump/.test(corpus)) {
    return "coolingPump";
  }
  if (/冷却塔|tower/.test(corpus)) {
    return "coolingTower";
  }
  return null;
}

function localizeDeviceCategory(category, locale) {
  const zhLabels = {
    chiller: "主机",
    chilledPump: "冷冻泵",
    coolingPump: "冷却泵",
    coolingTower: "冷却塔"
  };
  const viLabels = {
    chiller: "chiller",
    chilledPump: "bom nuoc lanh",
    coolingPump: "bom nuoc giai nhiet",
    coolingTower: "thap giai nhiet"
  };
  return (locale === "vi" ? viLabels : zhLabels)[category] || null;
}

function createUnsupportedAnswer(locale) {
  if (locale === "vi") {
    return buildAnswerPayload(
      "unsupported",
      "Tro ly hien ho tro trang thai tram, giai thich canh bao, giai thich khuyen nghi va mot phan hoi dap van hanh.",
      [
        "Hien chua ho tro xu huong lich su, toi uu hoa, mo phong hoac tra cuu tai lieu tu do.",
        "Hiện chưa hỗ trợ điều khiển thiết bị, bật/tắt máy hoặc ghi PLC.",
        "Hay hoi theo cac dang nhu: trang thai hien tai, canh bao nao can uu tien, khuyen nghi nay co nghia gi, COP thap thuong do dau."
      ],
      [
        "Hay doi cau hoi sang trang thai hien tai, canh bao uu tien, giai thich khuyen nghi hoac hoi dap van hanh."
      ],
      []
    );
  }
  return buildAnswerPayload(
    "unsupported",
    "当前助手支持站点现态、异常解释、建议解读，以及部分冷冻站运维知识问答。",
    [
      "当前不支持历史趋势、优化计算、仿真推演或自由文档检索。",
      "当前不支持设备控制、开停机指令或 PLC 写入。",
      "可改问：当前冷站状态如何、哪条异常最值得优先看、这条建议是什么意思、冷冻水温差偏低通常说明什么。"
    ],
    ["请改问站点现态、异常优先级、建议解读或运维知识类问题。"],
    []
  );
}

function createUnavailableAnswer(locale, kind = "status") {
  if (locale === "vi") {
    return buildAnswerPayload(
      kind,
      "Dữ liệu chính của trạm hiện chưa đủ ổn định, chưa thể đưa ra câu trả lời đáng tin cậy.",
      [
        "Hãy kiểm tra lại freshness và sourceStatus bên dưới trước khi dùng câu trả lời này để ra quyết định.",
        "Nếu đang trực vận hành, nên đối chiếu thêm với hiện trường hoặc trang gốc."
      ],
      [
        "Truoc tien doi chieu trang goc, hien truong hoac thoi diem thu thap moi nhat.",
        "Neu van can phan loai, hay uu tien xem canh bao va tinh trang du lieu truoc."
      ],
      buildPageHints(locale, ["dashboardOverview", "anomalySummary", "rawPage"])
    );
  }
  return buildAnswerPayload(
    kind,
    "当前站点关键数据暂不稳定，暂时无法给出可靠回答。",
    [
      "请先查看下方 freshness 与 sourceStatus，再决定是否采用本回答。",
      "若正在值班，建议同时结合现场与原始页面核对。"
    ],
    [
      "先核对原始页面、现场或最新采集时间，再决定是否继续使用本回答。",
      "若需继续判断，建议优先查看告警页面和站点总览。"
    ],
    buildPageHints(locale, ["dashboardOverview", "anomalySummary", "rawPage"])
  );
}

export function buildStatusAnswer(locale, overview, anomalies, recommendations, deviceList, freshness) {
  const unavailable =
    overview?.sourceStatus?.overall === "failed" &&
    anomalies?.sourceStatus?.overall === "failed" &&
    recommendations?.sourceStatus?.overall === "failed" &&
    (!deviceList || deviceList?.sourceStatus?.overall === "failed");

  if (unavailable) {
    return createUnavailableAnswer(locale, "status");
  }

  const energyCards = overview?.energyCards || {};
  const deviceSummary = overview?.deviceSummary || {};
  const counts = anomalies?.counts || {};
  const recommendationSummary = recommendations?.summary || {};
  const primaryCard = pickPrimaryRecommendation(recommendations);
  const missingCoreMetrics = listMissingCoreMetrics(energyCards, locale);
  const deviceAnalysis = analyzeDeviceObservability(deviceList, deviceSummary, locale);
  const deviceStatusCounts = deviceAnalysis.counts;
  const deviceTotal = deviceAnalysis.deviceTotal;
  const staleData = freshness.label === "stale";
  const severeMetricGap =
    missingCoreMetrics.length >= 3 || (staleData && missingCoreMetrics.length >= 2);

  const details = [];
  const nextSteps = [];
  const pageHints = buildPageHints(locale, [
    "dashboardOverview",
    counts.total > 0 ? "anomalySummary" : null,
    primaryCard ? "recommendations" : null,
    deviceTotal > 0 ? "deviceList" : null,
    severeMetricGap || staleData ? "rawPage" : null
  ]);

  let summary;
  if (locale === "vi") {
    if (severeMetricGap && staleData) {
      summary = "Chỉ số vận hành chính đang thiếu và dữ liệu hiện đã cũ; hiện chưa thể đánh giá trạng thái trạm một cách đáng tin cậy.";
    } else if (severeMetricGap) {
      summary = "Chỉ số vận hành chính đang thiếu; hiện chưa thể đánh giá trạng thái trạm một cách đáng tin cậy.";
    } else if (staleData && deviceAnalysis.limited) {
      summary = "Dữ liệu tổng hợp hiện đã cũ và chuỗi thiết bị chưa hoàn chỉnh; cần đối chiếu với hiện trường trước khi kết luận.";
    } else if (staleData) {
      summary =
        (counts.critical || 0) > 0
          ? `Hiện còn ${counts.critical || 0} cảnh báo khẩn cấp, nhưng dữ liệu đã cũ; cần xác nhận lại tại hiện trường trước.`
          : "Dữ liệu tổng hợp hiện đã cũ; cần đối chiếu với hiện trường trước khi đánh giá trạng thái trạm.";
    } else if (counts.critical > 0) {
      summary = `Trạm hiện cần ưu tiên xử lý cảnh báo: tổng ${counts.total || 0} cảnh báo, trong đó khẩn cấp ${counts.critical || 0}.`;
    } else if (primaryCard) {
      summary = `Trạng thái trạm hiện có thể đọc được; khuyến nghị cần chú ý trước là “${primaryCard.title || "không rõ"}”.`;
    } else {
      summary = `Trạng thái trạm hiện có thể đọc được; tổng cảnh báo ${counts.total || 0}, chưa có khuyến nghị nào được kích hoạt.`;
    }

    if (missingCoreMetrics.length > 0) {
      details.push(
        severeMetricGap
          ? `Chỉ số còn thiếu: ${formatMetricLabels(missingCoreMetrics)}; không nên chỉ dựa vào dữ liệu tổng hợp để đánh giá vận hành.`
          : `Chỉ số còn thiếu: ${formatMetricLabels(missingCoreMetrics)}; độ tin cậy của kết luận hiện bị hạn chế.`
      );
    }
    if (staleData) {
      details.push("Dữ liệu tổng hợp hiện đã cũ; nếu đang trực vận hành, hãy ưu tiên đối chiếu với hiện trường và trang gốc.");
    }
    if (deviceAnalysis.detail) {
      details.push(deviceAnalysis.detail);
    }
    if (missingCoreMetrics.length === (CORE_METRICS[locale] || CORE_METRICS.zh).length) {
      details.push("Tóm tắt vận hành: các chỉ số chính hiện chưa lấy đủ từ chuỗi tổng hợp.");
    } else {
      details.push(
        `Tóm tắt vận hành: tổng công suất ${formatNumber(energyCards.totalPowerKw, locale)} kW, COP trạm ${formatNumber(energyCards.currentCop, locale)}, chênh nhiệt nước lạnh ${formatNumber(energyCards.chilledDeltaT, locale)}°C, chênh nhiệt nước giải nhiệt ${formatNumber(energyCards.coolingDeltaT, locale)}°C.`
      );
    }
    details.push(
      `Tóm tắt thiết bị: tổng ${deviceTotal} thiết bị; chiller ${deviceSummary.chillerCount ?? 0}, bơm nước lạnh ${deviceSummary.chilledPumpCount ?? 0}, bơm nước giải nhiệt ${deviceSummary.coolingPumpCount ?? 0}, tháp giải nhiệt ${deviceSummary.coolingTowerCount ?? 0}.`
    );
    details.push(
      `Tình hình cảnh báo: tổng ${counts.total || 0}, khẩn cấp ${counts.critical || 0}, nghiêm trọng ${counts.major || 0}, thông thường ${counts.minor || 0}.`
    );
    details.push(
      primaryCard
        ? `Khuyến nghị hiện tại: ${primaryCard.title || "không rõ"}; mức ưu tiên ${localizePriority(primaryCard.priority, locale)}, rủi ro ${localizeRisk(primaryCard.risk, locale)}.`
        : `Khuyến nghị hiện tại: ${recommendationSummary.total || 0} thẻ; rủi ro cao ${recommendationSummary.highRisk || 0}, mức nghiêm trọng tới hạn ${recommendationSummary.criticalSeverity || 0}.`
    );
    if (deviceTotal > 0) {
      details.push(
        `Trạng thái trong danh sách thiết bị: online ${deviceStatusCounts.online}, offline ${deviceStatusCounts.offline}, chưa rõ ${deviceStatusCounts.unknown}.`
      );
    }

    if (severeMetricGap || staleData) {
      nextSteps.push("Truoc tien doi chieu trang goc, hien truong hoac thoi diem thu thap moi nhat roi moi ket luan.");
    }
    if ((counts.critical || 0) > 0 || (counts.major || 0) > 0) {
      nextSteps.push("Mo trang canh bao va xac nhan cac muc khan cap/nghiem trong con ton tai hay khong.");
    }
    if (Array.isArray(primaryCard?.actions) && primaryCard.actions.length > 0) {
      nextSteps.push(...primaryCard.actions.slice(0, 2));
    } else if (primaryCard) {
      nextSteps.push(`Mo the khuyen nghi “${primaryCard.title || "khong ro"}” va doi chieu tung hanh dong de xac nhan.`);
    }
    if (deviceAnalysis.limited) {
      nextSteps.push("Kiem tra lai danh sach thiet bi xem co du lieu placeholder, trang thai khong ro hoac thieu phan loai hay khong.");
    } else if (deviceTotal > 0) {
      nextSteps.push("Ket hop danh sach thiet bi de uu tien xem cac thiet bi offline hoac co trang thai bat thuong.");
    }

    return buildAnswerPayload("status", summary, details, nextSteps, pageHints);
  }

  if (severeMetricGap && staleData) {
    summary = "当前站点关键指标缺失且数据已陈旧，暂无法可靠评估运行状态。";
  } else if (severeMetricGap) {
    summary = "当前站点关键指标缺失，暂无法可靠评估运行状态。";
  } else if (staleData && deviceAnalysis.limited) {
    summary = "当前聚合数据已陈旧，且设备链路不完整，需先结合现场确认。";
  } else if (staleData) {
    summary =
      (counts.critical || 0) > 0
        ? `当前仍有 ${counts.critical || 0} 条紧急告警，但数据已陈旧，需先结合现场确认。`
        : "当前聚合数据已陈旧，需先结合现场确认后再判断站点状态。";
  } else if (counts.critical > 0) {
    summary = `当前站点需要优先处理告警：共 ${counts.total || 0} 条异常，其中紧急 ${counts.critical || 0} 条。`;
  } else if (primaryCard) {
    summary = `当前站点现态可读；当前最值得优先关注的建议是“${primaryCard.title || "未知"}”。`;
  } else {
    summary = `当前站点现态可读；当前异常 ${counts.total || 0} 条，暂无命中的建议卡。`;
  }

  if (missingCoreMetrics.length > 0) {
    details.push(
      severeMetricGap
        ? `关键指标缺失：${formatMetricLabels(missingCoreMetrics)}；当前不宜仅根据聚合结果判断冷站运行状态。`
        : `关键指标仍有缺失：${formatMetricLabels(missingCoreMetrics)}；当前结论可信度受限。`
    );
  }
  if (staleData) {
    details.push("当前聚合数据已陈旧；若正在值班，建议优先核对现场、原始页面或最新采集时间。");
  }
  if (deviceAnalysis.detail) {
    details.push(deviceAnalysis.detail);
  }
  if (missingCoreMetrics.length === (CORE_METRICS[locale] || CORE_METRICS.zh).length) {
    details.push("运行概况：当前聚合链路未能完整返回总功率、COP 与关键温差指标。");
  } else {
    details.push(
      `运行概况：总功率 ${formatNumber(energyCards.totalPowerKw, locale)} kW，站点 COP ${formatNumber(energyCards.currentCop, locale)}，冷冻水温差 ${formatNumber(energyCards.chilledDeltaT, locale)}°C，冷却水温差 ${formatNumber(energyCards.coolingDeltaT, locale)}°C。`
    );
  }
  details.push(
    `设备概况：共 ${deviceTotal} 台设备；主机 ${deviceSummary.chillerCount ?? 0} 台，冷冻泵 ${deviceSummary.chilledPumpCount ?? 0} 台，冷却泵 ${deviceSummary.coolingPumpCount ?? 0} 台，冷却塔 ${deviceSummary.coolingTowerCount ?? 0} 台。`
  );
  details.push(
    `异常概况：总计 ${counts.total || 0} 条，其中紧急 ${counts.critical || 0} 条、严重 ${counts.major || 0} 条、一般 ${counts.minor || 0} 条。`
  );
  details.push(
    primaryCard
      ? `当前建议：${primaryCard.title || "未知"}；优先级 ${localizePriority(primaryCard.priority, locale)}，风险 ${localizeRisk(primaryCard.risk, locale)}。`
      : `当前建议卡 ${recommendationSummary.total || 0} 条；高风险 ${recommendationSummary.highRisk || 0} 条，严重级 ${recommendationSummary.criticalSeverity || 0} 条。`
  );
  if (deviceTotal > 0) {
    details.push(
      `设备清单状态：在线 ${deviceStatusCounts.online} 台，离线 ${deviceStatusCounts.offline} 台，未知 ${deviceStatusCounts.unknown} 台。`
    );
  }

  if (severeMetricGap || staleData) {
    nextSteps.push("先核对原始页面、现场或最新采集时间，再判断当前运行状态。");
  }
  if ((counts.critical || 0) > 0 || (counts.major || 0) > 0) {
    nextSteps.push("优先打开告警页面，确认紧急或严重告警是否仍在持续。");
  }
  if (Array.isArray(primaryCard?.actions) && primaryCard.actions.length > 0) {
    nextSteps.push(...primaryCard.actions.slice(0, 2));
  } else if (primaryCard) {
    nextSteps.push(`先查看建议卡片“${primaryCard.title || "当前建议"}”对应动作，再决定是否下钻处理。`);
  }
  if (deviceAnalysis.limited) {
    nextSteps.push("再核对设备清单是否仍存在占位、未知状态或类型拆分缺失。");
  } else if (deviceTotal > 0) {
    nextSteps.push("结合设备清单，优先检查当前离线或状态异常的设备。");
  }

  return buildAnswerPayload("status", summary, details, nextSteps, pageHints);
}

export function buildAnomalyAnswer(locale, anomalies, recommendations, freshness) {
  const unavailable =
    anomalies?.sourceStatus?.overall === "failed" &&
    recommendations?.sourceStatus?.overall === "failed";

  if (unavailable) {
    return createUnavailableAnswer(locale, "anomaly");
  }

  const counts = anomalies?.counts || {};
  const latestEvent = Array.isArray(anomalies?.latestEvents) ? anomalies.latestEvents[0] : null;
  const recommendationSummary = recommendations?.summary || {};
  const primaryCard = pickPrimaryRecommendation(recommendations);
  const staleFlag = anomalies?.diagnosisFlags?.staleAlarmFeed === true || freshness.label === "stale";
  const pageHints = buildPageHints(locale, [
    "anomalySummary",
    primaryCard ? "recommendations" : null,
    "dashboardOverview",
    staleFlag ? "rawPage" : null
  ]);

  let summary;
  let details;
  let nextSteps;

  if (locale === "vi") {
    summary =
      (counts.critical || 0) > 0
        ? `Cảnh báo hiện cần được xử lý trước vì còn ${counts.critical || 0} cảnh báo khẩn cấp chưa được xóa.${staleFlag ? " Dữ liệu cảnh báo hiện đã cũ." : ""}`
        : (counts.major || 0) > 0
          ? `Cảnh báo hiện nên được rà soát trước vì còn ${counts.major || 0} cảnh báo nghiêm trọng.${staleFlag ? " Dữ liệu cảnh báo hiện đã cũ." : ""}`
          : `Cảnh báo hiện chủ yếu ở mức thông thường; có thể rà soát theo nguồn và thời điểm phát sinh.${staleFlag ? " Dữ liệu cảnh báo hiện đã cũ." : ""}`;

    details = [
      `Số lượng cảnh báo: tổng ${counts.total || 0}, khẩn cấp ${counts.critical || 0}, nghiêm trọng ${counts.major || 0}, thông thường ${counts.minor || 0}.`,
      latestEvent
        ? `Sự kiện gần nhất: ${latestEvent.title || "không rõ"}; mức ${localizeSeverity(latestEvent.severity, locale)}, thời điểm ${formatTimestamp(latestEvent.occurredAt, locale)}, nguồn ${latestEvent.source || "không rõ"}.`
        : "Chưa lấy được sự kiện cảnh báo gần nhất từ nguồn hiện tại.",
      staleFlag
        ? "Nguồn cảnh báo đang có dấu hiệu cũ hoặc chưa tươi; cần kết hợp kiểm tra tại hiện trường."
        : "Nguồn cảnh báo hiện vẫn có thể dùng để hỗ trợ ưu tiên xử lý.",
      primaryCard
        ? `Khuyến nghị hỗ trợ: ${primaryCard.title || "không rõ"}; có thể dùng để đối chiếu nguyên nhân và hành động xử lý.`
        : `Khuyến nghị hỗ trợ hiện có ${recommendationSummary.total || 0} thẻ; nếu vẫn cần ưu tiên, hãy bám theo mức cảnh báo hiện tại.`
    ];
    nextSteps = [
      (counts.critical || 0) > 0 || (counts.major || 0) > 0
        ? "Mo trang canh bao va sap xep theo muc khan cap/nghiem trong de xem muc nao con ton tai."
        : "Mo trang canh bao va ra soat theo thoi diem phat sinh gan nhat.",
      latestEvent
        ? `Uu tien doi chieu su kien “${latestEvent.title || "khong ro"}” voi hien truong va nguon phat sinh.`
        : "Kiem tra nguon canh bao tren trang goc de xac nhan su kien moi nhat.",
      staleFlag
        ? "Neu du lieu canh bao da cu, hay xac nhan lai tren trang goc hoac hien truong truoc khi xu ly."
        : primaryCard
          ? `Ket hop the khuyen nghi “${primaryCard.title || "khong ro"}” de xac dinh huong xu ly dau tien.`
          : "Neu can sap uu tien, hay xu ly theo muc canh bao truoc."
    ];
    return buildAnswerPayload("anomaly", summary, details, nextSteps, pageHints);
  }

  summary =
    (counts.critical || 0) > 0
      ? `当前异常需要优先处理，因为仍有 ${counts.critical || 0} 条紧急告警未清零。${staleFlag ? " 当前告警数据已陈旧。" : ""}`
      : (counts.major || 0) > 0
        ? `当前异常建议优先排查，因为仍有 ${counts.major || 0} 条严重告警。${staleFlag ? " 当前告警数据已陈旧。" : ""}`
        : `当前异常以一般级为主，可按来源和发生时间逐项核查。${staleFlag ? " 当前告警数据已陈旧。" : ""}`;

  details = [
    `异常数量：总计 ${counts.total || 0} 条，其中紧急 ${counts.critical || 0} 条、严重 ${counts.major || 0} 条、一般 ${counts.minor || 0} 条。`,
    latestEvent
      ? `最近事件：${latestEvent.title || "未知"}；等级 ${localizeSeverity(latestEvent.severity, locale)}，时间 ${formatTimestamp(latestEvent.occurredAt, locale)}，来源 ${latestEvent.source || "未知"}。`
      : "当前来源未返回最近异常事件。",
    staleFlag
      ? "告警源存在陈旧或时效不足信号，请结合现场再确认。"
      : "当前告警源仍可用于辅助排序处理优先级。",
    primaryCard
      ? `辅助建议：${primaryCard.title || "未知"}；可用于补充判断原因和处理动作。`
      : `当前建议卡 ${recommendationSummary.total || 0} 条；若仍需排序，建议先按告警等级处理。`
  ];
  nextSteps = [
    (counts.critical || 0) > 0 || (counts.major || 0) > 0
      ? "先打开告警页面，按紧急和严重等级确认哪些告警仍在持续。"
      : "先在告警页面按发生时间倒序核查最新异常。",
    latestEvent
      ? `优先核对最近事件“${latestEvent.title || "未知"}”与现场、来源设备是否一致。`
      : "先回原始页面确认最近异常事件和触发来源。",
    staleFlag
      ? "若告警数据已陈旧，处理前先回原始页面或现场确认。"
      : primaryCard
        ? `结合建议卡“${primaryCard.title || "未知"}”补充原因与动作判断。`
        : "若仍需排序，建议先按告警等级逐项处理。"
  ];
  return buildAnswerPayload("anomaly", summary, details, nextSteps, pageHints);
}

export function buildRecommendationAnswer(locale, recommendations, anomalies, freshness) {
  const unavailable = recommendations?.sourceStatus?.overall === "failed";
  if (unavailable) {
    return createUnavailableAnswer(locale, "recommendation");
  }

  const cards = Array.isArray(recommendations?.cards) ? recommendations.cards : [];
  const primaryCard = cards[0] || null;
  const matchedRuleCount = Array.isArray(recommendations?.ruleEvaluation?.matchedRuleIds)
    ? recommendations.ruleEvaluation.matchedRuleIds.length
    : 0;
  const skippedRuleCount = Array.isArray(recommendations?.ruleEvaluation?.skippedRuleIds)
    ? recommendations.ruleEvaluation.skippedRuleIds.length
    : 0;
  const counts = anomalies?.counts || {};
  const staleFlag = freshness.label === "stale";
  const pageHints = buildPageHints(locale, [
    "recommendations",
    "dashboardOverview",
    counts.total > 0 ? "anomalySummary" : null,
    staleFlag ? "rawPage" : null
  ]);

  if (locale === "vi") {
    if (!primaryCard) {
      return buildAnswerPayload(
        "recommendation",
        skippedRuleCount > 0
          ? `Hiện chưa có thẻ khuyến nghị ổn định để giải thích; đánh giá luật vẫn còn ${skippedRuleCount} mục bị bỏ qua.${staleFlag ? " Dữ liệu hiện đã cũ." : ""}`
          : "Hiện chưa có thẻ khuyến nghị nào được kích hoạt từ trạng thái trạm hiện tại.",
        [
          `Đánh giá luật: khớp ${matchedRuleCount}, bỏ qua ${skippedRuleCount}.`,
          `Tình hình cảnh báo hiện tại: tổng ${counts.total || 0}, khẩn cấp ${counts.critical || 0}, nghiêm trọng ${counts.major || 0}.`,
          skippedRuleCount > 0
            ? "Nên kiểm tra lại tính khả dụng của dữ liệu trước khi diễn giải khuyến nghị."
            : "Trạng thái hiện tại chưa chạm ngưỡng để sinh thêm khuyến nghị."
        ],
        [
          skippedRuleCount > 0
            ? "Kiem tra truoc tinh kha dung cua du lieu va trang thai nguon truoc khi giai thich khuyen nghi."
            : "Tiep tuc theo doi tong quan tram va canh bao de xem co khuyen nghi moi hay khong."
        ],
        pageHints
      );
    }

    return buildAnswerPayload(
      "recommendation",
      `Khuyến nghị đáng ưu tiên giải thích trước là “${primaryCard.title || "không rõ"}”; hãy rà soát hành động đi kèm trước.${staleFlag ? " Dữ liệu hiện đã cũ." : ""}`,
      [
        `Thông tin thẻ: mức ưu tiên ${localizePriority(primaryCard.priority, locale)}, rủi ro ${localizeRisk(primaryCard.risk, locale)}, mức nghiêm trọng ${localizeSeverity(primaryCard.severity, locale)}.`,
        `Lý do: ${primaryCard.reason || "không rõ"}.`,
        Array.isArray(primaryCard.actions) && primaryCard.actions.length > 0
          ? `Hành động đề xuất: ${primaryCard.actions.slice(0, 2).join("; ")}.`
          : "Thẻ hiện chưa trả về hành động cụ thể; nên kiểm tra lại hiện trường và dữ liệu nguồn.",
        Array.isArray(primaryCard.evidence) && primaryCard.evidence.length > 0
          ? `Dấu hiệu tham chiếu: ${primaryCard.evidence.slice(0, 2).join("; ")}.`
          : `Đánh giá luật: khớp ${matchedRuleCount}, bỏ qua ${skippedRuleCount}.`
      ],
      Array.isArray(primaryCard.actions) && primaryCard.actions.length > 0
        ? primaryCard.actions.slice(0, 2)
        : [
            `Mo the khuyen nghi “${primaryCard.title || "khong ro"}” va doi chieu voi hien truong.`,
            staleFlag
              ? "Neu du lieu da cu, hay quay lai trang goc de xac nhan truoc khi xu ly."
              : "Kiem tra them bang chung va chi so lien quan truoc khi thuc hien."
          ],
      pageHints
    );
  }

  if (!primaryCard) {
    return buildAnswerPayload(
      "recommendation",
      skippedRuleCount > 0
        ? `当前没有稳定建议卡可供解读；规则评估仍有 ${skippedRuleCount} 个跳过项。${staleFlag ? " 当前数据已陈旧。" : ""}`
        : "当前没有命中的建议卡，站点现态尚未触发规则建议。",
      [
        `规则评估：命中 ${matchedRuleCount} 条，跳过 ${skippedRuleCount} 条。`,
        `当前异常：总计 ${counts.total || 0} 条，其中紧急 ${counts.critical || 0} 条、严重 ${counts.major || 0} 条。`,
        skippedRuleCount > 0
          ? "建议先核查数据可观测性和来源状态，再解读建议结果。"
          : "当前现态尚未触发新的建议动作，可继续关注告警与总览状态。"
      ],
      [
        skippedRuleCount > 0
          ? "先核查数据来源是否可用，再判断为什么当前没有稳定建议卡。"
          : "继续关注站点总览与告警页面，等待新的建议触发。"
      ],
      pageHints
    );
  }

  return buildAnswerPayload(
    "recommendation",
    `当前最值得优先解读的建议是“${primaryCard.title || "未知"}”；建议先按卡片动作逐项核查。${staleFlag ? " 当前数据已陈旧。" : ""}`,
    [
      `卡片信息：优先级 ${localizePriority(primaryCard.priority, locale)}，风险 ${localizeRisk(primaryCard.risk, locale)}，严重度 ${localizeSeverity(primaryCard.severity, locale)}。`,
      `原因：${primaryCard.reason || "未知"}。`,
      Array.isArray(primaryCard.actions) && primaryCard.actions.length > 0
        ? `建议动作：${primaryCard.actions.slice(0, 2).join("；")}。`
        : "当前卡片未返回具体动作，建议先核查现场与来源数据。",
      Array.isArray(primaryCard.evidence) && primaryCard.evidence.length > 0
        ? `参考证据：${primaryCard.evidence.slice(0, 2).join("；")}。`
        : `规则评估：命中 ${matchedRuleCount} 条，跳过 ${skippedRuleCount} 条。`
    ],
    Array.isArray(primaryCard.actions) && primaryCard.actions.length > 0
      ? primaryCard.actions.slice(0, 2)
      : [
          `先回到建议卡片，逐项核对“${primaryCard.title || "当前建议"}”对应动作。`,
          staleFlag ? "处理前先核对原始页面或现场，避免按陈旧数据执行。" : "再结合证据与相关指标，确认动作是否成立。"
        ],
    pageHints
  );
}

export function buildDeviceAnswer(locale, overview, anomalies, recommendations, deviceList, freshness) {
  const deviceSummary = overview?.deviceSummary || {};
  const counts = anomalies?.counts || {};
  const latestEvent = Array.isArray(anomalies?.latestEvents) ? anomalies.latestEvents[0] : null;
  const primaryCard = pickPrimaryRecommendation(recommendations);
  const deviceAnalysis = analyzeDeviceObservability(deviceList, deviceSummary, locale);
  const focusCategory = guessDeviceFocusCategory(primaryCard, latestEvent);
  const focusLabel = localizeDeviceCategory(focusCategory, locale);
  const staleFlag = freshness.label === "stale";
  const unavailable = !deviceList || deviceList?.sourceStatus?.overall === "failed";

  if (unavailable) {
    return createUnavailableAnswer(locale, "device");
  }

  const pageHints = buildPageHints(locale, [
    "deviceList",
    latestEvent ? "anomalySummary" : null,
    primaryCard ? "recommendations" : null,
    staleFlag || deviceAnalysis.limited ? "rawPage" : null
  ]);

  if (locale === "vi") {
    if (deviceAnalysis.limited) {
      return buildAnswerPayload(
        "device",
        focusLabel
          ? `Hien nghieng ve nhom ${focusLabel}, nhung chuoi thiet bi chua du on dinh nen chua the diem ten mot thiet bi cu the.`
          : "Hien chua nen diem ten mot thiet bi cu the, vi chuoi thiet bi va trang thai online chua du on dinh.",
        [
          deviceAnalysis.detail || "Danh sach thiet bi hien co dau hieu thieu phan loai, trang thai hoac du lieu placeholder.",
          `Tong quan thiet bi hien co ${deviceAnalysis.deviceTotal} thiet bi; online ${deviceAnalysis.counts.online}, offline ${deviceAnalysis.counts.offline}, khong ro ${deviceAnalysis.counts.unknown}.`
        ],
        [
          "Truoc tien mo danh sach thiet bi de xac nhan trang thai offline/khong ro va loai thiet bi.",
          staleFlag
            ? "Neu du lieu da cu, hay doi chieu them voi trang goc hoac hien truong truoc khi khoanh vung."
            : "Sau do doi chieu them voi canh bao va khuyen nghi truoc khi chi dinh mot thiet bi."
        ],
        pageHints
      );
    }

    return buildAnswerPayload(
      "device",
      focusLabel
        ? `Hien nen uu tien xem nhom ${focusLabel} truoc, roi moi quyet dinh co can dao sau den tung thiet bi hay khong.`
        : "Hien nen uu tien xem danh sach thiet bi theo trang thai bat thuong va theo nhom lien quan den canh bao/khuyen nghi.",
      [
        focusLabel
          ? `Dau moi hien tai nghieng ve nhom ${focusLabel} qua canh bao hoac khuyen nghi gan nhat.`
          : "Chua co dau moi du de chi dinh mot thiet bi cu the; nen khoanh vung theo nhom va trang thai.",
        latestEvent
          ? `Su kien gan nhat: ${latestEvent.title || "khong ro"}; co the dung de doi chieu nguon phat sinh.`
          : "Nguon canh bao hien chua tra ve mot su kien gan nhat de chi dich danh.",
        `Danh sach thiet bi: online ${deviceAnalysis.counts.online}, offline ${deviceAnalysis.counts.offline}, khong ro ${deviceAnalysis.counts.unknown}.`
      ],
      [
        focusLabel
          ? `Loc danh sach thiet bi theo nhom ${focusLabel} va uu tien xem thiet bi offline hoac bat thuong.`
          : "Mo danh sach thiet bi va uu tien xem cac thiet bi offline, khong ro trang thai hoac thuoc nhom dang co canh bao.",
        primaryCard
          ? `Doi chieu them voi the khuyen nghi “${primaryCard.title || "khong ro"}” de khoanh vung dung nhom thiet bi.`
          : "Neu van chua ro, hay doi chieu tiep voi canh bao va tong quan tram."
      ],
      pageHints
    );
  }

  if (deviceAnalysis.limited) {
    return buildAnswerPayload(
      "device",
      focusLabel
        ? `当前更倾向先看${focusLabel}相关设备，但设备链路暂不稳定，暂不宜点名具体设备。`
        : "当前还不适合直接点名某一台设备，因为设备链路和在线状态暂不稳定。",
      [
        deviceAnalysis.detail || "当前设备清单仍存在占位、未知状态或类型拆分缺失。",
        `当前设备概况：共 ${deviceAnalysis.deviceTotal} 台；在线 ${deviceAnalysis.counts.online} 台，离线 ${deviceAnalysis.counts.offline} 台，未知 ${deviceAnalysis.counts.unknown} 台。`
      ],
      [
        "先打开设备清单，确认离线、未知状态和设备类型拆分是否完整。",
        staleFlag
          ? "若数据已陈旧，请结合原始页面或现场再缩小范围。"
          : "再结合告警与建议卡，确认当前更该先看哪一类设备。"
      ],
      pageHints
    );
  }

  return buildAnswerPayload(
    "device",
    focusLabel
      ? `当前更适合先看${focusLabel}相关设备，再判断是否需要下钻到单台。`
      : "当前更适合先从设备清单中筛出状态异常的设备，再决定是否下钻到单台。",
    [
      focusLabel
        ? `当前线索更偏向${focusLabel}，可先按这一类设备做第一轮排查。`
        : "当前没有足够线索直接点名单台设备，建议先按状态与设备类别缩小范围。",
      latestEvent
        ? `最近事件：${latestEvent.title || "未知"}；可作为排查来源的第一条线索。`
        : "当前来源未返回足够明确的最近事件来源。",
      `设备清单状态：在线 ${deviceAnalysis.counts.online} 台，离线 ${deviceAnalysis.counts.offline} 台，未知 ${deviceAnalysis.counts.unknown} 台。`
    ],
    [
      focusLabel
        ? `先在设备清单里筛选${focusLabel}相关设备，并优先查看离线或状态异常项。`
        : "先在设备清单里优先查看离线、未知状态或与当前告警相关的设备。",
      primaryCard
        ? `再对照建议卡“${primaryCard.title || "当前建议"}”，确认是否与同一类设备相关。`
        : "若仍无法缩小范围，再回到告警页面与站点总览交叉核对。"
    ],
    pageHints
  );
}

export function buildReliabilityAnswer(locale, overview, anomalies, recommendations, deviceList, freshness, sourceStatus) {
  const energyCards = overview?.energyCards || {};
  const missingCoreMetrics = listMissingCoreMetrics(energyCards, locale);
  const deviceAnalysis = analyzeDeviceObservability(deviceList, overview?.deviceSummary || {}, locale);
  const staleData = freshness.label === "stale";
  const degraded = staleData || sourceStatus?.overall === "partial" || sourceStatus?.overall === "failed";
  const pageHints = buildPageHints(locale, [
    "dashboardOverview",
    "anomalySummary",
    deviceList ? "deviceList" : null,
    "rawPage"
  ]);

  if (locale === "vi") {
    const summary = degraded
      ? "Cau tra loi hien tai chi nen dung de tham khao; freshness, chi so thieu hoac nguon du lieu dang han che do tin cay."
      : "Du lieu hien tai tuong doi doc duoc, nhung van nen doi chieu trang goc truoc khi ra quyet dinh quan trong.";
    const details = [
      `Do moi du lieu: ${freshness.label || "unknown"}; thoi diem moi nhat ${formatTimestamp(freshness.latestTimestamp, locale)}.`,
      missingCoreMetrics.length > 0
        ? `Chi so con thieu: ${formatMetricLabels(missingCoreMetrics)}.`
        : "Cac chi so cot loi hien khong co dau hieu thieu ro rang.",
      `Tinh trang chuoi du lieu: ${sourceStatus?.overall || "failed"}.`,
      deviceAnalysis.detail || "Chuoi thiet bi hien khong co canh bao giam chat luong noi bat."
    ];
    const nextSteps = [
      degraded
        ? "Truoc tien doi chieu trang goc, hien truong hoac thoi diem thu thap moi nhat."
        : "Truoc khi ra quyet dinh quan trong, van nen doi chieu mot lan voi trang goc.",
      missingCoreMetrics.length > 0
        ? "Kiem tra lai cac chi so cot loi dang thieu truoc khi ket luan."
        : "Neu can chac hon, hay doi chieu them voi canh bao va danh sach thiet bi.",
      deviceAnalysis.limited
        ? "Xac nhan them tinh day du cua danh sach thiet bi va trang thai online."
        : "Neu du lieu on dinh, co the tiep tuc dung tong quan tram de danh gia."
    ];
    return buildAnswerPayload("reliability", summary, details, nextSteps, pageHints);
  }

  const summary = degraded
    ? "当前这次判断只能作为辅助参考；freshness、缺失指标或数据来源状态正在限制可信度。"
    : "当前数据整体可读，但在做关键判断前仍建议回原始页面复核一次。";
  const details = [
    `数据新鲜度：${freshness.label || "unknown"}；最新时间 ${formatTimestamp(freshness.latestTimestamp, locale)}。`,
    missingCoreMetrics.length > 0
      ? `当前缺失的关键指标：${formatMetricLabels(missingCoreMetrics)}。`
      : "当前核心指标没有明显缺失。",
    `当前链路状态：${sourceStatus?.overall || "failed"}。`,
    deviceAnalysis.detail || "当前设备链路没有额外暴露出明显的可观测性告警。"
  ];
  const nextSteps = [
    degraded
      ? "先核对原始页面、现场或最新采集时间，再决定是否采用这次判断。"
      : "即便当前数据可读，关键决策前仍建议回原始页面复核一次。",
    missingCoreMetrics.length > 0
      ? "先补核关键指标是否缺数，再做运行状态结论。"
      : "如需更稳妥，可继续结合告警页面与设备清单交叉核对。",
    deviceAnalysis.limited
      ? "再确认设备清单是否完整、是否仍有占位或未知状态。"
      : "若链路稳定，可继续使用站点总览做第一轮判断。"
  ];
  return buildAnswerPayload("reliability", summary, details, nextSteps, pageHints);
}

export function classifyAssistantQuery(text) {
  const normalized = String(text || "").trim().toLowerCase();

  const unsupportedKeywords = [
    "趋势",
    "历史",
    "history",
    "historical",
    "trend",
    "xu hướng",
    "lịch sử",
    "知识库",
    "文档",
    "knowledge",
    "manual",
    "tài liệu",
    "优化",
    "optimize",
    "optimization",
    "tối ưu",
    "simulate",
    "simulation",
    "仿真",
    "mô phỏng",
    "开机",
    "停机",
    "启动",
    "关闭",
    "控制",
    "plc",
    "setpoint",
    "control",
    "shutdown",
    "start machine",
    "bật máy",
    "tắt máy",
    "điều khiển"
  ];
  if (unsupportedKeywords.some((keyword) => normalized.includes(keyword))) {
    return "unsupported";
  }

  const reliabilityKeywords = [
    "数据新鲜",
    "新鲜吗",
    "可靠吗",
    "可信",
    "不可信",
    "缺失",
    "freshness",
    "reliable",
    "reliability",
    "data fresh",
    "dang tin",
    "du lieu moi",
    "thieu chi so"
  ];
  if (reliabilityKeywords.some((keyword) => normalized.includes(keyword))) {
    return "reliability";
  }

  const deviceKeywords = [
    "设备",
    "哪台设备",
    "先看哪台",
    "设备状态",
    "device",
    "thiet bi"
  ];
  if (deviceKeywords.some((keyword) => normalized.includes(keyword))) {
    return "device";
  }

  const recommendationKeywords = [
    "建议",
    "推荐",
    "recommend",
    "recommendation",
    "khuyến nghị",
    "đề xuất"
  ];
  if (recommendationKeywords.some((keyword) => normalized.includes(keyword))) {
    return "recommendation";
  }

  const anomalyKeywords = [
    "异常",
    "告警",
    "alarm",
    "anomaly",
    "warning",
    "cảnh báo",
    "bất thường"
  ];
  if (anomalyKeywords.some((keyword) => normalized.includes(keyword))) {
    return "anomaly";
  }

  return "status";
}

export function validateAssistantQueryRequest(body, routeSiteId) {
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const query = body?.query && typeof body.query === "object" ? body.query : {};
  const bodySiteId =
    typeof context.siteId === "string" && context.siteId.trim() ? context.siteId.trim() : null;
  const queryText = typeof query.text === "string" ? query.text.trim() : "";

  if (!queryText) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid assistant query: query.text is required",
      details: {
        field: "query.text",
        expected: "non-empty string"
      }
    };
  }

  if (bodySiteId && bodySiteId !== routeSiteId) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: `Invalid assistant query: context.siteId must match route siteId=${routeSiteId}`,
      details: {
        field: "context.siteId",
        expected: routeSiteId
      }
    };
  }

  return {
    ok: true,
    request: {
      siteId: routeSiteId,
      surface: normalizeSurface(context.surface),
      locale: normalizeLocale(context.locale),
      promptOrigin: normalizePromptOrigin(context.promptOrigin),
      text: queryText
    }
  };
}

export async function buildAssistantQueryResponse(config, siteId, request, requestContext = {}) {
  const locale = normalizeLocale(request?.locale);
  const knowledgeAnswer = matchOperationsKnowledgeQuery(request?.text, locale);
  if (knowledgeAnswer) {
    const knowledgeDetails =
      locale === "vi"
        ? [
            ...knowledgeAnswer.details,
            ...knowledgeAnswer.riskNotes,
            "Day la tri thuc van hanh thong dung; xu ly thuc te van can doi chieu du lieu tram, lien dong va quy trinh hien truong."
          ]
        : [
            ...knowledgeAnswer.details,
            ...knowledgeAnswer.riskNotes,
            "以上为冷冻站通用运维知识；实际处置仍应结合当前站点数据、联锁逻辑和现场规程。"
          ];
    return {
      site: {
        siteId
      },
      answer: {
        kind: "knowledge",
        summary: knowledgeAnswer.summary,
        details: dedupeTextList(knowledgeDetails, 6),
        nextSteps: dedupeTextList(knowledgeAnswer.checkFirst, 4),
        pageHints: [],
        citations: buildCitations(locale, ["operationsKnowledge"])
      },
      freshness: {
        label: "unknown",
        latestTimestamp: null,
        stale: false
      },
      sourceStatus: buildSourceStatus([
        {
          key: "operationsKnowledge",
          endpoint: `seed://operations-knowledge/${knowledgeAnswer.id}`,
          ok: true,
          fallback: false,
          status: 200,
          message: "ok",
          error: null,
          rows: 1
        }
      ]),
      generatedAt: buildGeneratedAt(config)
    };
  }

  const kind = classifyAssistantQuery(request?.text);

  if (kind === "unsupported") {
    const answer = createUnsupportedAnswer(locale);
    return {
      site: {
        siteId
      },
      answer: {
        kind: answer.kind,
        summary: answer.summary,
        details: answer.details,
        nextSteps: answer.nextSteps,
        pageHints: answer.pageHints,
        citations: []
      },
      freshness: {
        label: "unknown",
        latestTimestamp: null,
        stale: false
      },
      sourceStatus: {
        overall: "ok",
        sources: []
      },
      generatedAt: buildGeneratedAt(config)
    };
  }

  const anomalies = await getAnomalySummary(config, siteId);
  const overview = await getDashboardOverview(config, siteId, anomalies, requestContext);
  const recommendations = await getRecommendations(config, siteId, overview, anomalies);
  const deviceList =
    kind === "status" || kind === "device" || kind === "reliability"
      ? await getDeviceList(config, siteId, {
          page: "1",
          pageSize: "200",
          projectKey: requestContext?.projectKey
        })
      : null;

  const freshness = combineFreshnessState(
    [overview?.freshness, anomalies?.freshness, recommendations?.freshness, deviceList?.freshness].filter(Boolean)
  );

  let answer;
  let citationKeys;
  let sourceStatusEntries;

  if (kind === "anomaly") {
    answer = buildAnomalyAnswer(locale, anomalies, recommendations, freshness);
    citationKeys = ["anomalySummary", "dashboardOverview", "recommendations"];
    sourceStatusEntries = [
      buildDatasetHealth(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies
      ),
      buildDatasetHealth(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview
      ),
      buildDatasetHealth(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations
      )
    ];
  } else if (kind === "recommendation") {
    answer = buildRecommendationAnswer(locale, recommendations, anomalies, freshness);
    citationKeys = ["recommendations", "dashboardOverview", "anomalySummary"];
    sourceStatusEntries = [
      buildDatasetHealth(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations
      ),
      buildDatasetHealth(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview
      ),
      buildDatasetHealth(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies
      )
    ];
  } else if (kind === "device") {
    answer = buildDeviceAnswer(locale, overview, anomalies, recommendations, deviceList, freshness);
    citationKeys = ["deviceList", "anomalySummary", "recommendations", "dashboardOverview"];
    sourceStatusEntries = [
      buildDatasetHealth(
        "deviceList",
        `/bff/v1/sites/${siteId}/devices/list?page=1&pageSize=200`,
        deviceList
      ),
      buildDatasetHealth(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies
      ),
      buildDatasetHealth(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations
      ),
      buildDatasetHealth(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview
      )
    ];
  } else if (kind === "reliability") {
    sourceStatusEntries = [
      buildDatasetHealth(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview
      ),
      buildDatasetHealth(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies
      ),
      buildDatasetHealth(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations
      ),
      buildDatasetHealth(
        "deviceList",
        `/bff/v1/sites/${siteId}/devices/list?page=1&pageSize=200`,
        deviceList
      )
    ];
    answer = buildReliabilityAnswer(
      locale,
      overview,
      anomalies,
      recommendations,
      deviceList,
      freshness,
      buildSourceStatus(sourceStatusEntries)
    );
    citationKeys = ["dashboardOverview", "anomalySummary", "recommendations", "deviceList"];
  } else {
    answer = buildStatusAnswer(locale, overview, anomalies, recommendations, deviceList, freshness);
    citationKeys = ["dashboardOverview", "anomalySummary", "recommendations", "deviceList"];
    sourceStatusEntries = [
      buildDatasetHealth(
        "dashboardOverview",
        `/bff/v1/sites/${siteId}/dashboard/overview`,
        overview
      ),
      buildDatasetHealth(
        "anomalySummary",
        `/bff/v1/sites/${siteId}/anomalies/summary`,
        anomalies
      ),
      buildDatasetHealth(
        "recommendations",
        `/bff/v1/sites/${siteId}/recommendations`,
        recommendations
      ),
      buildDatasetHealth(
        "deviceList",
        `/bff/v1/sites/${siteId}/devices/list?page=1&pageSize=200`,
        deviceList
      )
    ];
  }

  return {
    site: {
      siteId
    },
    answer: {
      kind: answer.kind,
      summary: answer.summary,
      details: answer.details,
      nextSteps: answer.nextSteps,
      pageHints: answer.pageHints,
      citations: buildCitations(locale, citationKeys)
    },
    freshness,
    sourceStatus: buildSourceStatus(sourceStatusEntries),
    generatedAt: buildGeneratedAt(config)
  };
}

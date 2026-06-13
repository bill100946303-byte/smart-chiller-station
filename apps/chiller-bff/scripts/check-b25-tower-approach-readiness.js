import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");

const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SITE_ID = process.env.SITE_ID || process.env.B25_LEGACY_APP_ID || "140";
const SITE_CODE = process.env.B25_SITE_CODE || "btwentyfive";
const DATABASE_KEY = process.env.B25_DATABASE_KEY || "140btwentyfive";
const PROJECT_KEY = process.env.B25_PROJECT_KEY || "126lnoffice";
const PROJECT_TEMPLATE = process.env.B25_PROJECT_TEMPLATE || "1";
const ACTOR_USER_ID = process.env.B25_ACTOR_USER_ID || process.env.USER_ID || "";
const WET_BULB_TAGNAME = process.env.B25_WET_BULB_TAGNAME || "SY-1-509-42048";
const WET_BULB_TITLE = process.env.B25_WET_BULB_TITLE || "Wet Bulb Temperature";
const WET_BULB_UNIT = process.env.B25_WET_BULB_UNIT || "℃";
const TOWER_APPROACH_MAX_PLAUSIBLE_C = 20;
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.B25_TOWER_APPROACH_TIMEOUT_MS || "30000", 10);
const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.B25_TOWER_APPROACH_STRICT || "").trim().toLowerCase()
);
const OUTPUT_JSON =
  process.env.B25_TOWER_APPROACH_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-readiness-latest.json");
const OUTPUT_MD =
  process.env.B25_TOWER_APPROACH_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-readiness-latest.md");

function asTrimmedText(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function asFiniteNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(/,/g, "").replace(/%/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeThermalUnbalanceRate(value) {
  const normalized = asFiniteNumber(value, null);
  if (normalized === null) {
    return null;
  }
  return Math.abs(normalized) > 1 ? normalized / 100 : normalized;
}

function formatValue(value, digits = 1, unit = "") {
  const number = asFiniteNumber(value, null);
  if (number === null) {
    return "--";
  }
  return `${number.toFixed(digits)}${unit}`;
}

function formatNullableText(value) {
  const normalized = asTrimmedText(value);
  return normalized || "--";
}

function roundNullable(value, digits = 1) {
  const number = asFiniteNumber(value, null);
  return number === null ? null : Number(number.toFixed(digits));
}

function resolveTowerApproachMeasurement(tcwsC, wetBulbC) {
  const tcws = asFiniteNumber(tcwsC, null);
  const wetBulb = asFiniteNumber(wetBulbC, null);
  if (tcws === null || wetBulb === null) {
    return {
      value: null,
      rawValue: null,
      plausible: false,
      reason: "缺湿球温度或冷却水出水温，无法计算当前接近度。"
    };
  }
  const rawValue = roundNullable(tcws - wetBulb, 1);
  if (rawValue < 0) {
    return {
      value: null,
      rawValue,
      plausible: false,
      reason: "当前接近度计算结果为负值，冷却水出水温低于湿球，疑似湿球温度或冷却水温点位异常。"
    };
  }
  if (rawValue > TOWER_APPROACH_MAX_PLAUSIBLE_C) {
    return {
      value: null,
      rawValue,
      plausible: false,
      reason: "当前接近度超过 20℃，疑似冷却塔温度点位、湿球点位或单位异常。"
    };
  }
  return {
    value: rawValue,
    rawValue,
    plausible: true,
    reason: null
  };
}

function buildHeaders(extra = {}) {
  const headers = {
    "x-chiller-site-id": SITE_ID,
    "x-chiller-site-code": SITE_CODE,
    "x-chiller-project-database-key": DATABASE_KEY,
    "x-chiller-project-key": PROJECT_KEY,
    "x-chiller-project-template": PROJECT_TEMPLATE,
    ...extra
  };
  if (ACTOR_USER_ID) {
    headers["x-chiller-user-id"] = ACTOR_USER_ID;
  }
  return headers;
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      parseError: true,
      raw: text.slice(0, 500)
    };
  }
}

function requestJson(method, routePath, payload = null) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = buildHeaders(
    body
      ? {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        }
      : {}
  );

  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            url: target.toString(),
            payload: parseJsonSafely(raw),
            error: status >= 200 && status < 300 ? null : `HTTP ${status}`
          });
        });
      }
    );

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: null,
        url: target.toString(),
        payload: null,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    req.setTimeout(Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 15000, () => {
      req.destroy(new Error("request timeout"));
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function sourceStatusOverall(payload) {
  return asTrimmedText(payload?.sourceStatus?.overall, "unknown");
}

function summarizeSources(payload) {
  const sources = Array.isArray(payload?.sourceStatus?.sources) ? payload.sourceStatus.sources : [];
  return sources.map((source) => ({
    key: asTrimmedText(source?.key, "unknown"),
    ok: source?.ok === true,
    status: source?.status ?? null,
    reasonCode: source?.reasonCode ?? null,
    rows: source?.rows ?? null,
    endpoint: source?.endpoint ?? null,
    message: source?.message ?? null,
    error: source?.error ?? null
  }));
}

function getTrendPointCount(payload) {
  if (Array.isArray(payload?.points)) {
    return payload.points.length;
  }
  if (Array.isArray(payload?.series)) {
    return payload.series.reduce((sum, item) => sum + (Array.isArray(item?.points) ? item.points.length : 0), 0);
  }
  return 0;
}

function chooseOptimizeInputs(energyCards) {
  const envLoadKw = asFiniteNumber(process.env.B25_OPTIMIZE_LOAD_KW, null);
  const envOutdoorTempC = asFiniteNumber(process.env.B25_OPTIMIZE_OUTDOOR_TEMP_C, null);
  const liveCoolingCapacity = asFiniteNumber(energyCards?.totalCoolingCapacity, null);
  const liveOutdoorTempC = asFiniteNumber(energyCards?.outdoorTempC, null);
  const liveWetBulbC = asFiniteNumber(energyCards?.outdoorWetBulbC, null);
  const loadKw = envLoadKw ?? liveCoolingCapacity ?? 13500;
  const outdoorTempC = envOutdoorTempC ?? liveOutdoorTempC ?? liveWetBulbC ?? 32.5;
  const notes = [];
  if (envLoadKw !== null) {
    notes.push("loadKw 使用环境变量 B25_OPTIMIZE_LOAD_KW");
  } else if (liveCoolingCapacity !== null) {
    notes.push("loadKw 使用 dashboard.totalCoolingCapacity");
  } else {
    notes.push("loadKw 使用默认 13500，实时负荷缺失");
  }
  if (envOutdoorTempC !== null) {
    notes.push("outdoorTempC 使用环境变量 B25_OPTIMIZE_OUTDOOR_TEMP_C");
  } else if (liveOutdoorTempC !== null) {
    notes.push("outdoorTempC 使用 dashboard.outdoorTempC");
  } else if (liveWetBulbC !== null) {
    notes.push("outdoorTempC 使用 dashboard.outdoorWetBulbC 兜底");
  } else {
    notes.push("outdoorTempC 使用默认 32.5，室外温湿度缺失");
  }
  return {
    inputs: {
      loadKw,
      outdoorTempC,
      mode: "cooling"
    },
    notes
  };
}

function readSignal(advisor, key) {
  const signals = Array.isArray(advisor?.inputSignals) ? advisor.inputSignals : [];
  return signals.find((item) => item?.key === key) || null;
}

function readGuardrail(advisor, key) {
  const guardrails = Array.isArray(advisor?.guardrails) ? advisor.guardrails : [];
  return guardrails.find((item) => item?.key === key) || null;
}

function pushUnique(items, message) {
  const normalized = asTrimmedText(message);
  if (normalized && !items.includes(normalized)) {
    items.push(normalized);
  }
}

function buildDataReadinessGate({ dashboard, trend, energyCards, advisor, wetBulbTrendPoints }) {
  const advisorBlockers = Array.isArray(advisor?.blockers) ? advisor.blockers.join(" | ") : "";
  const wetBulbSignal = readSignal(advisor, "outdoorWetBulbC");
  const tcwsSignal = readSignal(advisor, "currentTcwsC");
  const dashboardOverall = sourceStatusOverall(dashboard.payload);
  const trendOverall = sourceStatusOverall(trend.payload);

  const items = [
    {
      key: "dashboard_overview",
      label: "Dashboard 实时总览",
      ok: dashboard.ok && dashboardOverall !== "failed",
      evidence: `http=${dashboard.status || "--"} / overall=${dashboardOverall}`,
      recoveryAction: "先恢复 dashboard/overview 数据源；核对 siteId=140、databaseKey=140btwentyfive、projectKey=126lnoffice 与上游接口可用性。"
    },
    {
      key: "system_power",
      label: "系统总功率",
      ok: asFiniteNumber(energyCards.totalPowerKw, null) !== null,
      evidence: `totalPowerKw=${formatValue(energyCards.totalPowerKw, 1, " kW")}`,
      recoveryAction: "核对冷站总电表、主机/泵/塔功率汇总点和 Dashboard 能源卡片映射。"
    },
    {
      key: "cooling_load",
      label: "系统总冷量",
      ok: asFiniteNumber(energyCards.totalCoolingCapacity, null) !== null,
      evidence: `totalCoolingCapacity=${formatValue(energyCards.totalCoolingCapacity, 1, " kW")}`,
      recoveryAction: "核对冷冻水总流量、供回水温差、冷量计算和额定冷量配置。"
    },
    {
      key: "tcws",
      label: "冷却水出水/Tcws",
      ok: asFiniteNumber(energyCards.coolingReturnTemp, null) !== null || tcwsSignal?.ok === true,
      evidence: `coolingReturnTemp=${formatValue(energyCards.coolingReturnTemp, 1, "℃")} / signal=${tcwsSignal?.ok === true ? "ok" : "missing"}`,
      recoveryAction: "核对冷却塔出水、冷机冷凝器进水或冷却回水点位；确认物理位置和单位。"
    },
    {
      key: "wet_bulb_live",
      label: "实时湿球",
      ok: asFiniteNumber(energyCards.outdoorWetBulbC, null) !== null || wetBulbSignal?.ok === true,
      evidence: `outdoorWetBulbC=${formatValue(energyCards.outdoorWetBulbC, 1, "℃")} / signal=${wetBulbSignal?.ok === true ? "ok" : "missing"}`,
      recoveryAction: "核对室外湿球点位、气象站通讯和湿球计算来源；缺失时 Approach 只能只读。"
    },
    {
      key: "wet_bulb_trend",
      label: "湿球历史趋势",
      ok: wetBulbTrendPoints > 0,
      evidence: `tag=${WET_BULB_TAGNAME} / points=${wetBulbTrendPoints} / overall=${trendOverall}`,
      recoveryAction: `核对湿球趋势 tagname=${WET_BULB_TAGNAME} 是否正确，并确认历史曲线接口有 30-60min 对比样本。`
    },
    {
      key: "tower_fan_feedback",
      label: "冷却塔风机功率/反馈",
      ok: asFiniteNumber(energyCards.coolingTowerPowerKw, null) !== null && !/缺冷却塔风机功率|冷却塔风机/.test(advisorBlockers),
      evidence: `coolingTowerPowerKw=${formatValue(energyCards.coolingTowerPowerKw, 1, " kW")}`,
      recoveryAction: "核对塔风机运行反馈、频率反馈、功率或分组运行状态；无反馈时不做闭环目标。"
    },
    {
      key: "active_chillers",
      label: "活跃主机上下文",
      ok: !/缺冷机运行状态|活跃机组上下文/.test(advisorBlockers),
      evidence: /缺冷机运行状态|活跃机组上下文/.test(advisorBlockers) ? "advisor blocker matched" : "advisor blocker not present",
      recoveryAction: "核对 CH1-CH7 运行状态、机组启停信号和当前主机组合；缺失时不能判断最低冷凝水温边界。"
    }
  ];

  const blockedItems = items.filter((item) => !item.ok);
  return {
    finalDecision: blockedItems.length ? "NO_GO" : "READY",
    readyCount: items.length - blockedItems.length,
    total: items.length,
    items: items.map((item) => ({
      key: item.key,
      label: item.label,
      status: item.ok ? "ready" : "blocked",
      evidence: item.evidence,
      recoveryAction: item.recoveryAction
    }))
  };
}

function buildAssessment({ dashboard, trend, advice, executionList, optimizeInputs }) {
  const energyCards = dashboard.payload?.energyCards || {};
  const details = advice.payload?.details || {};
  const advisor = details.towerApproachAdvisor || null;
  const advisorResult = advisor?.advisorResult || null;
  const wetBulbTrendPoints = getTrendPointCount(trend.payload);
  const currentTcwsC =
    asFiniteNumber(energyCards.coolingReturnTemp, null) !== null
      ? roundNullable(asFiniteNumber(energyCards.coolingReturnTemp), 1)
      : null;
  const calculatedApproachMeasurement = resolveTowerApproachMeasurement(
    currentTcwsC,
    asFiniteNumber(energyCards.outdoorWetBulbC, null)
  );
  const calculatedApproachC = calculatedApproachMeasurement.value;
  const normalizedThermalUnbalance = normalizeThermalUnbalanceRate(energyCards.thermalUnbalanceRate);

  const blockers = [];
  const warnings = [];
  const humanIntervention = [];
  const dataReadinessGate = buildDataReadinessGate({
    dashboard,
    trend,
    energyCards,
    advisor,
    wetBulbTrendPoints
  });

  if (!dashboard.ok) {
    pushUnique(blockers, `dashboard/overview 请求失败：${dashboard.error || dashboard.status}`);
  }
  if (!advice.ok || advice.payload?.ok !== true || !advisor) {
    pushUnique(blockers, `tower-approach advice 生成失败：${advice.error || advice.status || "payload invalid"}`);
  }
  if (sourceStatusOverall(dashboard.payload) === "failed") {
    pushUnique(blockers, "dashboard 数据源整体失败，不能做 Approach 闭环判断。");
  }
  if (sourceStatusOverall(advice.payload?.details) === "failed") {
    pushUnique(blockers, "optimize/advice 数据源整体失败，不能创建执行单。");
  }

  for (const item of Array.isArray(advisor?.blockers) ? advisor.blockers : []) {
    pushUnique(blockers, item);
  }
  for (const item of Array.isArray(advisor?.warnings) ? advisor.warnings : []) {
    pushUnique(warnings, item);
  }

  const wetBulbSignal = readSignal(advisor, "outdoorWetBulbC");
  const tcwsSignal = readSignal(advisor, "currentTcwsC");
  const approachSignal = readSignal(advisor, "currentApproachC");
  const minCondenserSignal = readSignal(advisor, "minCondenserInletTempC");
  const minCondenserGuardrail = readGuardrail(advisor, "chillerMinCondenserInletTempC");
  const plcGuardrail = readGuardrail(advisor, "plcControlPointMapping");

  if (wetBulbSignal && wetBulbSignal.ok !== true) {
    pushUnique(humanIntervention, "核对室外湿球温度点位，缺失时只能保留只读建议。");
  }
  if (tcwsSignal && tcwsSignal.ok !== true) {
    pushUnique(humanIntervention, "核对冷却水出水温/Tcws 点位或冷却水温差来源。");
  }
  if (approachSignal && approachSignal.ok !== true) {
    pushUnique(humanIntervention, approachSignal.reason || "核对 Approach 计算链路。");
  }
  if (minCondenserSignal && minCondenserSignal.ok !== true) {
    pushUnique(humanIntervention, "补齐冷机厂家最低冷凝器进水温边界。");
  }
  if (minCondenserGuardrail?.status === "missing") {
    pushUnique(humanIntervention, "在站点配置中补 towerApproach.minCondenserInletTempC 或按机组/型号补边界。");
  }
  if (plcGuardrail?.status === "missing") {
    pushUnique(humanIntervention, "补 targetApproachC/targetTcwsC 到 PLC/SCADA 的控制点映射和 rollback 映射；shadow 可先不写 PLC，但 assisted/enforced 必须补齐。");
  }
  if (wetBulbTrendPoints <= 0) {
    pushUnique(warnings, `湿球趋势点位 ${WET_BULB_TAGNAME} 当前返回 0 个点，shadow 节能验证缺少同湿球工况对比样本。`);
    pushUnique(humanIntervention, `核对湿球趋势 tagname=${WET_BULB_TAGNAME} 是否正确，或补历史趋势点位映射。`);
  }
  if (calculatedApproachMeasurement.rawValue !== null && !calculatedApproachMeasurement.plausible) {
    pushUnique(
      blockers,
      "dashboard 原始 Approach 超出物理可信范围，需先校准湿球/Tcws 点位。"
    );
    pushUnique(humanIntervention, calculatedApproachMeasurement.reason);
  }
  if (normalizedThermalUnbalance !== null && Math.abs(normalizedThermalUnbalance) >= 0.15) {
    pushUnique(warnings, `热平衡偏差 ${roundNullable(normalizedThermalUnbalance * 100, 1)}% 已接近/超过 15%，建议先稳定水力平衡再验证节能。`);
  }
  if (asFiniteNumber(energyCards.currentLoadRate, null) !== null && energyCards.currentLoadRate > 120) {
    pushUnique(warnings, `当前负荷率 ${roundNullable(energyCards.currentLoadRate, 1)}% 超过 120%，需核对额定冷量或负荷计算口径。`);
    pushUnique(humanIntervention, "核对 B25 ratedCoolingCapacityKw、总冷量和负荷率计算口径，避免用超载样本做节能验收基准。");
  }
  if (asFiniteNumber(energyCards.activeAnomalyCount, null) !== null && energyCards.activeAnomalyCount > 0) {
    pushUnique(warnings, `当前活动告警 ${energyCards.activeAnomalyCount} 条，shadow 前需确认无严重告警、传感器冻结或塔风机反馈异常。`);
    pushUnique(humanIntervention, "复核当前活动告警等级；存在严重告警、传感器冻结、塔风机反馈异常时禁止下发。");
  }
  if (advisor?.dispatchMode !== "shadow") {
    pushUnique(blockers, `当前 dispatchMode=${advisor?.dispatchMode || "unknown"}，尚未进入 shadow 模式。`);
    pushUnique(humanIntervention, "确认现场允许 shadow 后，将 towerApproachDispatchMode 设置为 shadow。");
  }
  if (advisorResult?.execution?.allowedToCreateExecution !== true) {
    pushUnique(blockers, "后端 advisor 未允许创建可执行执行单。");
  }
  if (advisorResult?.execution?.allowedToDispatch !== true) {
    pushUnique(blockers, "后端 advisor 未允许 dispatch。");
  }

  const readOnlyAdviceReady = Boolean(advice.ok && advice.payload?.ok === true && advisor);
  const shadowReady =
    readOnlyAdviceReady &&
    blockers.length === 0 &&
    advisor?.status === "ready" &&
    advisor?.executionReady === true &&
    advisor?.dispatchReady === true &&
    advisor?.dispatchMode === "shadow";

  return {
    generatedAt: new Date().toISOString(),
    site: {
      siteId: SITE_ID,
      siteCode: SITE_CODE,
      databaseKey: DATABASE_KEY,
      projectKey: PROJECT_KEY,
      template: PROJECT_TEMPLATE
    },
    bffBaseUrl: BFF_BASE_URL,
    finalDecision: shadowReady ? "GO_SHADOW" : "NO_GO",
    readOnlyAdviceStatus: readOnlyAdviceReady ? "READY" : "BLOCKED",
    shadowReadinessStatus: shadowReady ? "GO" : "NO_GO",
    optimizeInputs,
    telemetry: {
      systemCop: asFiniteNumber(energyCards.currentCop, null),
      totalPowerKw: asFiniteNumber(energyCards.totalPowerKw, null),
      totalCoolingCapacity: asFiniteNumber(energyCards.totalCoolingCapacity, null),
      currentLoadRate: asFiniteNumber(energyCards.currentLoadRate, null),
      coolingReturnTemp: asFiniteNumber(energyCards.coolingReturnTemp, null),
      coolingDeltaT: asFiniteNumber(energyCards.coolingDeltaT, null),
      calculatedTcwsC: currentTcwsC,
      outdoorWetBulbC: asFiniteNumber(energyCards.outdoorWetBulbC, null),
      calculatedApproachC,
      advisorApproachC: asFiniteNumber(advisor?.currentApproachC, null),
      advisorTargetApproachC: asFiniteNumber(advisor?.targetApproachC, null),
      advisorTargetTcwsC: asFiniteNumber(advisor?.targetTcwsC, null),
      coolingTowerPowerKw: asFiniteNumber(energyCards.coolingTowerPowerKw, null),
      chillerPowerKw: asFiniteNumber(energyCards.chillerPowerKw, null),
      thermalUnbalanceRateRaw: asFiniteNumber(energyCards.thermalUnbalanceRate, null),
      thermalUnbalancePct: normalizedThermalUnbalance === null ? null : roundNullable(normalizedThermalUnbalance * 100, 1),
      activeAlarmCount: asFiniteNumber(energyCards.activeAnomalyCount, null)
    },
    advisor: advisor
      ? {
          status: advisor.status,
          reason: advisor.reason,
          executionMode: advisor.executionMode,
          dispatchMode: advisor.dispatchMode,
          controlMode: advisor.controlMode,
          executionReady: advisor.executionReady,
          dispatchReady: advisor.dispatchReady,
          blockers: advisor.blockers || [],
          warnings: advisor.warnings || [],
          inputSignals: advisor.inputSignals || [],
          guardrails: advisor.guardrails || [],
          execution: advisorResult?.execution || null,
          outputTargets: advisor.outputTargets || null
        }
      : null,
    wetBulbTrend: {
      tagname: WET_BULB_TAGNAME,
      title: WET_BULB_TITLE,
      pointCount: wetBulbTrendPoints,
      latest: trend.payload?.latest || null,
      sourceStatus: trend.payload?.sourceStatus || null
    },
    executionGovernance: {
      listOk: executionList.ok,
      total: executionList.payload?.total ?? null,
      latestExecutionId: executionList.payload?.items?.[0]?.executionId || null,
      latestStatus: executionList.payload?.items?.[0]?.status || null
    },
    sourceEvidence: {
      dashboard: {
        ok: dashboard.ok,
        status: dashboard.status,
        overall: sourceStatusOverall(dashboard.payload),
        sources: summarizeSources(dashboard.payload)
      },
      advice: {
        ok: advice.ok,
        status: advice.status,
        overall: sourceStatusOverall(advice.payload?.details),
        sources: summarizeSources(advice.payload?.details)
      },
      wetBulbTrend: {
        ok: trend.ok,
        status: trend.status,
        overall: sourceStatusOverall(trend.payload),
        sources: summarizeSources(trend.payload)
      }
    },
    dataReadinessGate,
    blockers,
    warnings,
    humanIntervention,
    nextActions: shadowReady
      ? [
          "保留 read_only 与 shadow 双轨观察，先不要打开 enforced。",
          "按同负荷/相近湿球工况对比 COP、kW/RT、总功率、冷机功率、塔风机功率和告警次数。",
          "shadow 至少覆盖高/中/低负荷样本后，再评审 assisted。"
        ]
      : [
          "先处理 blockers 中的点位和模式问题，不创建可下发执行单。",
          "补齐湿球/Tcws/最低冷凝水温/控制映射后，重新运行 npm run check:b25-tower-approach-readiness。",
          "只有 shadow 报告 GO 后，再考虑 assisted；enforced 必须等 PLC 边界和回退验证完成。"
        ]
  };
}

function renderMarkdown(report) {
  const telemetry = report.telemetry;
  const lines = [
    "# B25 冷却塔 Approach Shadow 前置检查",
    "",
    `- 结论：${report.finalDecision}`,
    `- 只读建议：${report.readOnlyAdviceStatus}`,
    `- Shadow 前置：${report.shadowReadinessStatus}`,
    `- 站点：${report.site.siteId} / ${report.site.databaseKey} / ${report.site.projectKey}`,
    `- 生成时间：${report.generatedAt}`,
    "",
    "## 关键现态",
    "",
    "| 项目 | 数值 |",
    "| --- | --- |",
    `| COP | ${formatValue(telemetry.systemCop, 2)} |`,
    `| 总功率 | ${formatValue(telemetry.totalPowerKw, 1, " kW")} |`,
    `| 当前负荷 | ${formatValue(telemetry.totalCoolingCapacity, 1, " kW")} |`,
    `| 负荷率 | ${formatValue(telemetry.currentLoadRate, 1, "%")} |`,
    `| 冷却水回水 | ${formatValue(telemetry.coolingReturnTemp, 1, "℃")} |`,
    `| 冷却水温差 | ${formatValue(telemetry.coolingDeltaT, 1, "℃")} |`,
    `| Tcws（冷却回水/塔出水） | ${formatValue(telemetry.calculatedTcwsC, 1, "℃")} |`,
    `| 湿球温度 | ${formatValue(telemetry.outdoorWetBulbC, 1, "℃")} |`,
    `| 推算 Approach | ${formatValue(telemetry.calculatedApproachC, 1, "℃")} |`,
    `| AI 目标 Approach | ${formatValue(telemetry.advisorTargetApproachC, 1, "℃")} |`,
    `| AI 目标 Tcws | ${formatValue(telemetry.advisorTargetTcwsC, 1, "℃")} |`,
    `| 热平衡偏差 | ${formatValue(telemetry.thermalUnbalancePct, 1, "%")} |`,
    "",
    "## 阻断项",
    "",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- 无"]),
    "",
    "## 风险与提示",
    "",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- 无"]),
    "",
    "## 需要人工介入",
    "",
    ...(report.humanIntervention.length ? report.humanIntervention.map((item) => `- ${item}`) : ["- 暂无"]),
    "",
    "## 数据门禁缺口",
    "",
    `- 结论：${report.dataReadinessGate.finalDecision}`,
    `- 通过项：${report.dataReadinessGate.readyCount}/${report.dataReadinessGate.total}`,
    "",
    "| key | 状态 | 证据 | 恢复动作 |",
    "| --- | --- | --- | --- |",
    ...report.dataReadinessGate.items.map(
      (item) => `| ${item.key} | ${item.status} | ${item.evidence} | ${item.recoveryAction} |`
    ),
    "",
    "## 数据源证据",
    "",
    `- dashboard overall：${report.sourceEvidence.dashboard.overall}`,
    `- advice overall：${report.sourceEvidence.advice.overall}`,
    `- 湿球趋势点数：${report.wetBulbTrend.pointCount}`,
    `- 执行单列表：${report.executionGovernance.listOk ? "ok" : "failed"}，total=${formatNullableText(report.executionGovernance.total)}`,
    "",
    "## 下一步",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
    ""
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const dashboard = await requestJson("GET", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/dashboard/overview`);
  const trendQuery = new URLSearchParams({
    tagname: WET_BULB_TAGNAME,
    title: WET_BULB_TITLE,
    unit: WET_BULB_UNIT
  });
  const trend = await requestJson(
    "GET",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/scene/legacy-trend?${trendQuery.toString()}`
  );
  const optimizeInputs = chooseOptimizeInputs(dashboard.payload?.energyCards || {});
  const advice = await requestJson(
    "POST",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/tower-approach/advice`,
    optimizeInputs
  );
  const executionList = await requestJson(
    "GET",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/tower-approach/executions?limit=5`
  );

  const report = buildAssessment({
    dashboard,
    trend,
    advice,
    executionList,
    optimizeInputs
  });

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`B25 tower approach readiness: ${report.finalDecision}\n`);
  process.stdout.write(`readOnlyAdvice=${report.readOnlyAdviceStatus} shadow=${report.shadowReadinessStatus}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (report.blockers.length) {
    process.stdout.write(`blockers=${report.blockers.length}\n`);
    for (const item of report.blockers.slice(0, 8)) {
      process.stdout.write(`- ${item}\n`);
    }
  }

  if (STRICT && report.shadowReadinessStatus !== "GO") {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`B25 tower approach readiness check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

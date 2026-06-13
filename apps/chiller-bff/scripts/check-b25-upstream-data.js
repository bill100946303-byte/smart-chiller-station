import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parsePayloadText } from "../src/lib/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_BASE_URL = (process.env.LEGACY_BASE_URL || "https://www.ssge.com.cn:8098").replace(/\/+$/, "");
const SITE_ID = process.env.SITE_ID || "btwentyfive";
const DATABASE_KEY = process.env.B25_DATABASE_KEY || "140btwentyfive";
const LEGACY_APP_ID = process.env.B25_LEGACY_APP_ID || "140";
const REPORT_FILE =
  process.env.B25_UPSTREAM_DATA_OUTPUT ||
  path.resolve(__dirname, "../../../docs/b25-upstream-data-latest.json");
const END_DATE = normalizeDateInput(process.env.END_DATE, formatDate(new Date()));

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function toFiniteNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = asTrimmedString(value, "").replace(/,/g, "").replace(/%/g, "");
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateInput(value, fallback) {
  const normalized = asTrimmedString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatDate(date);
}

function buildPreview(payload, limit = 240) {
  if (payload == null) {
    return null;
  }
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return serialized.length > limit ? `${serialized.slice(0, limit)}…` : serialized;
}

function detectBusinessStatus(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const status = asTrimmedString(payload?.status, "");
  if (status) {
    return status;
  }
  if (payload?.ok === true) {
    return "ok=true";
  }
  if (payload?.ok === false) {
    return "ok=false";
  }
  return null;
}

function classifyOutcome(response) {
  if (response.status == null) {
    return "transport_failed";
  }
  if (response.status >= 500) {
    return "http_5xx";
  }
  if (response.status >= 400) {
    return "http_4xx";
  }
  const businessStatus = detectBusinessStatus(response.payload);
  if (businessStatus === "20000" || businessStatus === "ok=true") {
    return "ready";
  }
  if (businessStatus === "ok=false") {
    return "business_failed";
  }
  if (response.status >= 200 && response.status < 300) {
    return "ready";
  }
  return "unknown";
}

function baseProbeRecord(key, pathName, response) {
  return {
    siteId: SITE_ID,
    key,
    path: pathName,
    url: response.url || `${DEFAULT_BASE_URL}${pathName}`,
    attempts: 1,
    transportOk: response.status != null,
    ok: response.ok,
    status: response.status,
    httpStatus: response.status,
    businessStatus: detectBusinessStatus(response.payload),
    outcome: classifyOutcome(response),
    error: response.error,
    transportError: response.status == null ? response.error : null,
    bodyPreview: buildPreview(response.payload)
  };
}

function readWorkOrderCount(payload) {
  return toFiniteNumber(payload?.data?.rowCount, 0);
}

function readKnowledgeCount(payload) {
  return toFiniteNumber(payload?.data?.rowCount, 0);
}

function readWorkOrderStates(payload) {
  return toArray(payload?.data).map((item) => ({
    name: asTrimmedString(item?.name, "--"),
    value: toFiniteNumber(item?.value, 0)
  }));
}

function readDeviceTypeItems(payload) {
  return toArray(payload?.data).map((item) => ({
    id: asTrimmedString(item?.drtypeid),
    name: asTrimmedString(item?.drtypename, "--")
  }));
}

function readInstructionsFindAllItems(payload) {
  return toArray(payload?.data).map((item) => ({
    id: asTrimmedString(item?.id || item?.instructionsid),
    name: asTrimmedString(item?.instructionsName || item?.name, "--"),
    typeId: asTrimmedString(item?.instructionsTypeid || item?.drtypeid)
  }));
}

function readImbalanceCurveSummary(payload) {
  const data = payload?.data;
  const curveRows = toArray(data?.curveValueList?.curveValueList || data?.curveValueList);
  return {
    title: asTrimmedString(data?.title, "--"),
    pointCount: curveRows.length,
    latestPointLabel: asTrimmedString(curveRows.at(-1)?.name, null),
    latestPointValue: toFiniteNumber(curveRows.at(-1)?.value, null)
  };
}

function readImbalanceTableSummary(payload) {
  const section = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const statisticsRows = toArray(section?.dataStatisticsList);
  const deviceRows = toArray(section?.tableList);
  const firstStatistic = statisticsRows[0] || null;
  const firstDevice = deviceRows[0] || null;
  return {
    statisticsCount: statisticsRows.length,
    deviceCount: deviceRows.length,
    firstStatistic: firstStatistic
      ? {
          acquisitionValue: asTrimmedString(firstStatistic?.acquisitionValue, null),
          scalar: toFiniteNumber(firstStatistic?.scalar, null),
          noScalar: toFiniteNumber(firstStatistic?.noScalar, null),
          scalarRate: toFiniteNumber(firstStatistic?.scalarRate, null)
        }
      : null,
    firstDevice: firstDevice
      ? {
          drName: asTrimmedString(firstDevice?.drName, null) || null,
          drTypeName: asTrimmedString(firstDevice?.drTypeName, null) || null,
          scalarRate: toFiniteNumber(firstDevice?.scalarRate, null)
        }
      : null
  };
}

async function probe(baseUrl, key, pathName) {
  const url = `${baseUrl}${pathName}`;
  let response;
  try {
    const output = execFileSync(
      "curl",
      ["-sS", "-m", "8", "-w", "\n__HTTP_STATUS__:%{http_code}", url],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const markerIndex = output.lastIndexOf("\n__HTTP_STATUS__:");
    const body = markerIndex >= 0 ? output.slice(0, markerIndex) : output;
    const statusText = markerIndex >= 0 ? output.slice(markerIndex + "\n__HTTP_STATUS__:".length).trim() : "0";
    let payload = null;
    try {
      payload = body ? parsePayloadText(body) : null;
    } catch (error) {
      payload = { parseError: String(error), raw: body.slice(0, 240) };
    }
    const httpStatus = Number.parseInt(statusText, 10) || 0;
    response = {
      ok: httpStatus >= 200 && httpStatus < 300,
      status: httpStatus,
      url,
      error: httpStatus >= 200 && httpStatus < 300 ? null : `Legacy request failed: ${httpStatus}`,
      payload
    };
  } catch (error) {
    response = {
      ok: false,
      status: null,
      url,
      error: error instanceof Error ? error.message : String(error),
      payload: null
    };
  }
  return {
    ...baseProbeRecord(key, pathName, response),
    payload: response.payload
  };
}

function buildImbalanceWindows(endDate) {
  return [0, -1, -2].map((offset) => {
    const shiftedEnd = addDays(endDate, offset);
    return {
      startDate: addDays(shiftedEnd, -1),
      endDate: shiftedEnd
    };
  });
}

async function run() {
  const runtimeDiagnostics = {
    baseUrl: DEFAULT_BASE_URL,
    hostname: new URL(DEFAULT_BASE_URL).hostname,
    loopbackHost: ["127.0.0.1", "localhost", "::1"].includes(new URL(DEFAULT_BASE_URL).hostname)
  };
  const windows = buildImbalanceWindows(END_DATE);

  const imbalanceCurvePath = `/zsqy/energyanalysis/getEnergyAnalysisCurve?appId=${LEGACY_APP_ID}&date=${windows[0].endDate}&dateType=0&energyType=4&startTime=${windows[0].startDate}&endTime=${windows[0].endDate}`;
  const imbalanceTableBadPath = `/zsqy/energyanalysis/${LEGACY_APP_ID}/getEnergyAnalysisDeviceList?appId=${LEGACY_APP_ID}&date=${windows[0].endDate}&dateType=0&energyType=4&startTime=${windows[0].startDate}&endTime=${windows[0].endDate}`;
  const imbalanceTableGoodPath = `/zsqy/energyanalysis/${DATABASE_KEY}/getEnergyAnalysisDeviceList?appId=${LEGACY_APP_ID}&date=${windows[0].endDate}&dateType=0&energyType=4&startTime=${windows[0].startDate}&endTime=${windows[0].endDate}`;

  const [
    imbalanceCurve,
    imbalanceTableLegacyAppPath,
    imbalanceTableDatabasePath,
    workOrdersDefault,
    workOrdersStatePending,
    workOrdersStateDone,
    workOrdersFindEc,
    workOrdersFindList,
    knowledgeDocuments,
    knowledgeDeviceTypes,
    knowledgeFindAll
  ] = await Promise.all([
    probe(DEFAULT_BASE_URL, "imbalanceCurve", imbalanceCurvePath),
    probe(DEFAULT_BASE_URL, "imbalanceTableLegacyAppPath", imbalanceTableBadPath),
    probe(DEFAULT_BASE_URL, "imbalanceTableDatabasePath", imbalanceTableGoodPath),
    probe(DEFAULT_BASE_URL, "workOrdersDefault", `/zsqy/qsworkorder/${DATABASE_KEY}/findObject?pageCurrent=1&pageSize=10`),
    probe(DEFAULT_BASE_URL, "workOrdersStatePending", `/zsqy/qsworkorder/${DATABASE_KEY}/findObject?pageCurrent=1&pageSize=50&state=1`),
    probe(DEFAULT_BASE_URL, "workOrdersStateDone", `/zsqy/qsworkorder/${DATABASE_KEY}/findObject?pageCurrent=1&pageSize=50&state=0`),
    probe(DEFAULT_BASE_URL, "workOrdersFindEc", `/zsqy/qsworkorder/${DATABASE_KEY}/findEC`),
    probe(DEFAULT_BASE_URL, "workOrdersFindWorkOrderList", `/zsqy/qsworkorder/${DATABASE_KEY}/findWorkOrderList`),
    probe(DEFAULT_BASE_URL, "knowledgeDocuments", `/zsqy/instructions/${DATABASE_KEY}/findObject?pageCurrent=1&pageSize=50`),
    probe(DEFAULT_BASE_URL, "knowledgeDeviceTypes", `/zsqy/Drtypeinfo/${DATABASE_KEY}/findObject`),
    probe(DEFAULT_BASE_URL, "knowledgeFindAll", `/zsqy/instructions/${DATABASE_KEY}/findAll`)
  ]);

  const deviceTypes = readDeviceTypeItems(knowledgeDeviceTypes.payload);
  const knowledgeFindAllByType = await Promise.all(
    deviceTypes.map(async (item) => {
      const pathName = `/zsqy/instructions/${DATABASE_KEY}/findAll?instructionsTypeid=${encodeURIComponent(item.id)}`;
      const response = await probe(DEFAULT_BASE_URL, `knowledgeFindAll:${item.id}`, pathName);
      return {
        typeId: item.id,
        typeName: item.name,
        path: pathName,
        ok: response.ok,
        status: response.status,
        error: response.error,
        items: readInstructionsFindAllItems(response.payload),
        payloadPreview: response.payloadPreview
      };
    })
  );

  const imbalanceTableSamples = await Promise.all(
    windows.map(async (window) => {
      const pathName = `/zsqy/energyanalysis/${DATABASE_KEY}/getEnergyAnalysisDeviceList?appId=${LEGACY_APP_ID}&date=${window.endDate}&dateType=0&energyType=4&startTime=${window.startDate}&endTime=${window.endDate}`;
      const response = await probe(DEFAULT_BASE_URL, `imbalanceTable:${window.endDate}`, pathName);
      return {
        startDate: window.startDate,
        endDate: window.endDate,
        path: pathName,
        ok: response.ok,
        status: response.status,
        error: response.error,
        ...readImbalanceTableSummary(response.payload)
      };
    })
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: DEFAULT_BASE_URL,
    siteIds: [SITE_ID],
    runtimeDiagnostics,
    site: {
      siteId: SITE_ID,
      databaseKey: DATABASE_KEY,
      legacyAppId: LEGACY_APP_ID
    },
    probes: [
      baseProbeRecord(imbalanceCurve.key, imbalanceCurve.path, imbalanceCurve),
      baseProbeRecord(imbalanceTableLegacyAppPath.key, imbalanceTableLegacyAppPath.path, imbalanceTableLegacyAppPath),
      baseProbeRecord(imbalanceTableDatabasePath.key, imbalanceTableDatabasePath.path, imbalanceTableDatabasePath),
      baseProbeRecord(workOrdersDefault.key, workOrdersDefault.path, workOrdersDefault),
      baseProbeRecord(workOrdersStatePending.key, workOrdersStatePending.path, workOrdersStatePending),
      baseProbeRecord(workOrdersStateDone.key, workOrdersStateDone.path, workOrdersStateDone),
      baseProbeRecord(workOrdersFindEc.key, workOrdersFindEc.path, workOrdersFindEc),
      baseProbeRecord(workOrdersFindList.key, workOrdersFindList.path, workOrdersFindList),
      baseProbeRecord(knowledgeDocuments.key, knowledgeDocuments.path, knowledgeDocuments),
      baseProbeRecord(knowledgeDeviceTypes.key, knowledgeDeviceTypes.path, knowledgeDeviceTypes),
      baseProbeRecord(knowledgeFindAll.key, knowledgeFindAll.path, knowledgeFindAll),
      ...knowledgeFindAllByType.map((item) => ({
        siteId: SITE_ID,
        key: `knowledgeFindAll:${item.typeId}`,
        path: item.path,
        url: `${DEFAULT_BASE_URL}${item.path}`,
        attempts: 1,
        transportOk: item.status != null,
        ok: item.ok,
        status: item.status,
        httpStatus: item.status,
        businessStatus: item.ok ? "20000" : null,
        outcome: item.ok ? "ready" : item.status >= 500 ? "http_5xx" : item.status >= 400 ? "http_4xx" : "transport_failed",
        error: item.error,
        transportError: item.status == null ? item.error : null,
        bodyPreview: item.payloadPreview
      })),
      ...imbalanceTableSamples.map((item) => ({
        siteId: SITE_ID,
        key: `imbalanceTableSample:${item.endDate}`,
        path: item.path,
        url: `${DEFAULT_BASE_URL}${item.path}`,
        attempts: 1,
        transportOk: item.status != null,
        ok: item.ok,
        status: item.status,
        httpStatus: item.status,
        businessStatus: item.ok ? "20000" : null,
        outcome: item.ok ? "ready" : item.status >= 500 ? "http_5xx" : item.status >= 400 ? "http_4xx" : "transport_failed",
        error: item.error,
        transportError: item.status == null ? item.error : null,
        bodyPreview: null
      }))
    ],
    imbalance: {
      curve: {
        ...baseProbeRecord(imbalanceCurve.key, imbalanceCurve.path, imbalanceCurve),
        ...readImbalanceCurveSummary(imbalanceCurve.payload)
      },
      table: {
        legacyAppPath: {
          ...baseProbeRecord(
            imbalanceTableLegacyAppPath.key,
            imbalanceTableLegacyAppPath.path,
            imbalanceTableLegacyAppPath
          ),
          ...readImbalanceTableSummary(imbalanceTableLegacyAppPath.payload)
        },
        databaseKeyPath: {
          ...baseProbeRecord(
            imbalanceTableDatabasePath.key,
            imbalanceTableDatabasePath.path,
            imbalanceTableDatabasePath
          ),
          ...readImbalanceTableSummary(imbalanceTableDatabasePath.payload)
        },
        samples: imbalanceTableSamples
      }
    },
    workOrders: {
      findObject: {
        default: {
          ...baseProbeRecord(workOrdersDefault.key, workOrdersDefault.path, workOrdersDefault),
          rowCount: readWorkOrderCount(workOrdersDefault.payload)
        },
        statePending: {
          ...baseProbeRecord(workOrdersStatePending.key, workOrdersStatePending.path, workOrdersStatePending),
          rowCount: readWorkOrderCount(workOrdersStatePending.payload)
        },
        stateDone: {
          ...baseProbeRecord(workOrdersStateDone.key, workOrdersStateDone.path, workOrdersStateDone),
          rowCount: readWorkOrderCount(workOrdersStateDone.payload)
        }
      },
      findEc: {
        ...baseProbeRecord(workOrdersFindEc.key, workOrdersFindEc.path, workOrdersFindEc),
        states: readWorkOrderStates(workOrdersFindEc.payload)
      },
      findWorkOrderList: {
        ...baseProbeRecord(workOrdersFindList.key, workOrdersFindList.path, workOrdersFindList),
        rowCount: readWorkOrderCount(workOrdersFindList.payload)
      }
    },
    knowledge: {
      deviceTypes: {
        ...baseProbeRecord(knowledgeDeviceTypes.key, knowledgeDeviceTypes.path, knowledgeDeviceTypes),
        items: deviceTypes
      },
      findObject: {
        ...baseProbeRecord(knowledgeDocuments.key, knowledgeDocuments.path, knowledgeDocuments),
        rowCount: readKnowledgeCount(knowledgeDocuments.payload)
      },
      findAll: {
        ...baseProbeRecord(knowledgeFindAll.key, knowledgeFindAll.path, knowledgeFindAll),
        items: readInstructionsFindAllItems(knowledgeFindAll.payload)
      },
      findAllByType: knowledgeFindAllByType
    },
    conclusions: {
      imbalanceTablePreferredPath:
        imbalanceTableDatabasePath.ok && !imbalanceTableLegacyAppPath.ok ? DATABASE_KEY : null,
      imbalanceTableFieldDegradation:
        !readImbalanceTableSummary(imbalanceTableDatabasePath.payload).firstDevice?.drName,
      workOrdersLikelyUpstreamEmpty:
        readWorkOrderCount(workOrdersDefault.payload) === 0
        && readWorkOrderCount(workOrdersStatePending.payload) === 0
        && readWorkOrderCount(workOrdersStateDone.payload) === 0
        && readWorkOrderStates(workOrdersFindEc.payload).every((item) => item.value === 0),
      knowledgeLikelyUpstreamEmpty:
        readKnowledgeCount(knowledgeDocuments.payload) === 0
        && readInstructionsFindAllItems(knowledgeFindAll.payload).length === 0
        && knowledgeFindAllByType.every((item) => item.items.length === 0)
    },
    summary: {
      identifiers: {
        [SITE_ID]: {
          readyCount: 0,
          failedCount: 0,
          transportFailures: 0,
          probeKeys: {}
        }
      }
    }
  };

  for (const item of report.probes) {
    const summaryEntry = report.summary.identifiers[SITE_ID];
    summaryEntry.probeKeys[item.key] = item.outcome;
    if (item.outcome === "ready") {
      summaryEntry.readyCount += 1;
    } else if (item.outcome === "transport_failed") {
      summaryEntry.transportFailures += 1;
    } else {
      summaryEntry.failedCount += 1;
    }
  }

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`[b25-upstream-data] wrote ${REPORT_FILE}\n`);
  process.stdout.write(
    `[b25-upstream-data] ${SITE_ID}: ready=${report.summary.identifiers[SITE_ID].readyCount} failed=${report.summary.identifiers[SITE_ID].failedCount} transport=${report.summary.identifiers[SITE_ID].transportFailures}\n`
  );
}

run().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});

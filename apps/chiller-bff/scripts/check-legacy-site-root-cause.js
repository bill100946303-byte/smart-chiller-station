import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = process.env.LEGACY_BASE_URL || "http://127.0.0.1:8098";
const DEFAULT_SITE_IDS = ["140", "140btwentyfive", "126lnoffice"];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = path.resolve(__dirname, "../../../docs/legacy-site-root-cause-latest.json");

const PROBES = [
  {
    key: "subsystemSummary",
    buildPath(siteId) {
      return `/${siteId}/getAllSubsystemInfo`;
    }
  },
  {
    key: "drinfo",
    buildPath(siteId) {
      return `/zsqy/drinfo/${siteId}/findObject?pageCurrent=1&pageSize=1`;
    }
  },
  {
    key: "energyCurve",
    buildPath(siteId) {
      return `/zsqy/homepage/${siteId}/getEnergyStatisticsCurve`;
    }
  },
  {
    key: "runParamsCurve",
    buildPath(siteId) {
      return `/zsqy/homepage/${siteId}/getRunParamsCurve`;
    }
  },
  {
    key: "equipmentEnergyCurve",
    buildPath(siteId) {
      return `/zsqy/homepage/${siteId}/getEquipmentEnergyStatisticsCurve`;
    }
  },
  {
    key: "alarmLog",
    buildPath(siteId) {
      return `/zsqy/qsAlarmlog/${siteId}/findNewAlarmLog`;
    }
  }
];

function parseSiteIds(argv) {
  const values = argv.slice(2).map((item) => String(item || "").trim()).filter(Boolean);
  return values.length > 0 ? values : DEFAULT_SITE_IDS;
}

function isLoopbackHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function detectRuntimeDiagnostics(baseUrl) {
  const target = new URL(baseUrl);
  const diagnostics = {
    baseUrl,
    hostname: target.hostname,
    loopbackHost: isLoopbackHostname(target.hostname),
    nodeFetchLoopback: "not_checked",
    nodeFetchError: null,
    nodeFetchCauseCode: null,
    caveat: null
  };

  if (!diagnostics.loopbackHost) {
    return diagnostics;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(new URL("/", target), {
      method: "HEAD",
      signal: controller.signal
    });
    diagnostics.nodeFetchLoopback = "ok";
  } catch (error) {
    const causeCode =
      error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object"
        ? error.cause.code || null
        : null;
    diagnostics.nodeFetchLoopback = causeCode === "EPERM" ? "blocked" : "failed";
    diagnostics.nodeFetchError = error instanceof Error ? error.message : String(error);
    diagnostics.nodeFetchCauseCode = causeCode;
    if (causeCode === "EPERM") {
      diagnostics.caveat =
        "Current Node runtime cannot access loopback URLs. Transport-failed probe results may be sandbox false negatives.";
    }
  } finally {
    clearTimeout(timeout);
  }

  return diagnostics;
}

function detectBusinessStatus(body) {
  if (typeof body !== "string" || !body.trim()) {
    return null;
  }

  const xmlStatus = body.match(/<status>([^<]+)<\/status>/i)?.[1]?.trim();
  if (xmlStatus) {
    return xmlStatus;
  }

  const jsonStatus = body.match(/"status"\s*:\s*"?([A-Za-z0-9_-]+)"?/i)?.[1]?.trim();
  if (jsonStatus) {
    return jsonStatus;
  }

  const jsonOk = body.match(/"ok"\s*:\s*(true|false)/i)?.[1]?.trim();
  if (jsonOk) {
    return jsonOk.toLowerCase() === "true" ? "ok=true" : "ok=false";
  }

  return null;
}

function classifyOutcome(httpStatus, body, transportError) {
  if (transportError) {
    return "transport_failed";
  }
  if (httpStatus >= 500) {
    return "http_5xx";
  }
  if (httpStatus >= 400) {
    return "http_4xx";
  }
  const businessStatus = detectBusinessStatus(body);
  if (businessStatus === "20000" || businessStatus === "ok=true") {
    return "ready";
  }
  if (businessStatus === "ok=false") {
    return "business_failed";
  }
  if (httpStatus === 200) {
    return "ready";
  }
  return "unknown";
}

function runCurl(url) {
  try {
    const output = execFileSync(
      "curl",
      [
        "-sS",
        "-m",
        "5",
        "-w",
        "\n__HTTP_STATUS__:%{http_code}",
        url
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const markerIndex = output.lastIndexOf("\n__HTTP_STATUS__:");
    const body = markerIndex >= 0 ? output.slice(0, markerIndex) : output;
    const statusText = markerIndex >= 0 ? output.slice(markerIndex + "\n__HTTP_STATUS__:".length).trim() : "0";
    return {
      transportOk: true,
      httpStatus: Number.parseInt(statusText, 10) || 0,
      body,
      transportError: null
    };
  } catch (error) {
    return {
      transportOk: false,
      httpStatus: null,
      body: "",
      transportError: error instanceof Error ? error.message : String(error)
    };
  }
}

function probeUrl(url, retries = 3) {
  let bestResult = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const current = runCurl(url);
    bestResult = current;
    if (current.transportOk) {
      return { ...current, attempts: attempt };
    }
  }
  return { ...bestResult, attempts: retries };
}

function buildReport(baseUrl, siteIds, runtimeDiagnostics = null) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    siteIds,
    runtimeDiagnostics,
    probes: [],
    summary: {
      identifiers: {},
      caveat: runtimeDiagnostics?.caveat || null
    }
  };

  for (const siteId of siteIds) {
    const summaryEntry = {
      readyCount: 0,
      failedCount: 0,
      transportFailures: 0,
      probeKeys: {}
    };
    report.summary.identifiers[siteId] = summaryEntry;

    for (const probe of PROBES) {
      const pathName = probe.buildPath(siteId);
      const url = new URL(pathName, baseUrl).toString();
      const result = probeUrl(url);
      const outcome = classifyOutcome(result.httpStatus, result.body, result.transportError);
      const businessStatus = detectBusinessStatus(result.body);
      const entry = {
        siteId,
        key: probe.key,
        path: pathName,
        url,
        attempts: result.attempts,
        transportOk: result.transportOk,
        httpStatus: result.httpStatus,
        businessStatus,
        outcome,
        bodyPreview: result.body ? result.body.slice(0, 240) : null,
        transportError: result.transportError
      };
      report.probes.push(entry);
      summaryEntry.probeKeys[probe.key] = outcome;
      if (outcome === "ready") {
        summaryEntry.readyCount += 1;
      } else if (outcome === "transport_failed") {
        summaryEntry.transportFailures += 1;
      } else {
        summaryEntry.failedCount += 1;
      }
    }
  }

  return report;
}

function printSummary(report) {
  console.log(`legacy root-cause probe written: ${REPORT_FILE}`);
  if (report.summary.caveat) {
    console.log(`warning: ${report.summary.caveat}`);
  }
  for (const siteId of report.siteIds) {
    const entry = report.summary.identifiers[siteId];
    console.log(
      `- ${siteId}: ready=${entry.readyCount}, failed=${entry.failedCount}, transportFailures=${entry.transportFailures}`
    );
    for (const probe of PROBES) {
      console.log(`  - ${probe.key}: ${entry.probeKeys[probe.key]}`);
    }
  }
}

async function main() {
  const siteIds = parseSiteIds(process.argv);
  const runtimeDiagnostics = await detectRuntimeDiagnostics(DEFAULT_BASE_URL);
  const report = buildReport(DEFAULT_BASE_URL, siteIds, runtimeDiagnostics);
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

await main();

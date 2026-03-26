import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, "../../../docs");

const defaultDiffPath = path.resolve(DOCS_DIR, "release-snapshot-diff-latest.json");
const latestSnapshotPath = path.resolve(DOCS_DIR, "release-snapshot-latest.json");
const snapshotArchiveDir = path.resolve(DOCS_DIR, "release-snapshots");

const diffPath = process.env.RELEASE_SNAPSHOT_DIFF_PATH
  ? path.resolve(process.env.RELEASE_SNAPSHOT_DIFF_PATH)
  : defaultDiffPath;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function mustObject(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!isObject(value)) {
    pushError(errors, jsonPath, "must be object");
    return null;
  }
  return value;
}

function mustBoolean(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (typeof value !== "boolean") {
    pushError(errors, jsonPath, "must be boolean");
    return null;
  }
  return value;
}

function mustStringOrNull(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!(value === null || typeof value === "string")) {
    pushError(errors, jsonPath, "must be string or null");
    return null;
  }
  return value;
}

function mustStringArray(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!Array.isArray(value)) {
    pushError(errors, jsonPath, "must be array");
    return null;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      pushError(errors, `${jsonPath}[${i}]`, "must be string");
    }
  }
  return value;
}

function readJsonOrNull(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadJson(filePath, errors, pathLabel = "/report") {
  if (!fs.existsSync(filePath)) {
    pushError(errors, pathLabel, `file not found: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    pushError(errors, pathLabel, `invalid json: ${error.message}`);
    return null;
  }
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((item) => typeof item === "string");
}

function uniqueSorted(input) {
  return Array.from(new Set(input)).sort((a, b) => a.localeCompare(b));
}

function diffAdded(currentArr, previousArr) {
  const currentSet = new Set(currentArr);
  const previousSet = new Set(previousArr);
  return uniqueSorted(Array.from(currentSet).filter((item) => !previousSet.has(item)));
}

function diffRemoved(currentArr, previousArr) {
  const currentSet = new Set(currentArr);
  const previousSet = new Set(previousArr);
  return uniqueSorted(Array.from(previousSet).filter((item) => !currentSet.has(item)));
}

function listArchiveSnapshotFiles() {
  if (!fs.existsSync(snapshotArchiveDir)) {
    return [];
  }
  return fs
    .readdirSync(snapshotArchiveDir)
    .filter((name) => /^release-snapshot-\d{8}-\d{6}\.json$/.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map((name) => path.join(snapshotArchiveDir, name));
}

function buildDerivedDiffPayload(errors) {
  const current = loadJson(latestSnapshotPath, errors, "/currentSnapshot");
  if (!current) {
    return null;
  }

  const archiveFiles = listArchiveSnapshotFiles();
  const currentArchivePath =
    typeof current?.artifacts?.archiveJson === "string" && fs.existsSync(current.artifacts.archiveJson)
      ? current.artifacts.archiveJson
      : null;

  const previousArchivePath = archiveFiles.find((oneFile) => oneFile !== currentArchivePath) || null;
  let previous = null;
  if (previousArchivePath) {
    previous = readJsonOrNull(previousArchivePath);
  }

  const currentDecision = typeof current?.decision === "string" ? current.decision : null;
  const previousDecision = typeof previous?.decision === "string" ? previous.decision : null;
  const currentReasons = normalizeStringArray(current?.reasons);
  const previousReasons = normalizeStringArray(previous?.reasons);
  const currentAdvisories = normalizeStringArray(current?.advisories);
  const previousAdvisories = normalizeStringArray(previous?.advisories);

  return {
    hasPrevious: Boolean(previous),
    current: {
      decision: currentDecision
    },
    previous: {
      decision: previousDecision
    },
    decisionChanged: previous ? currentDecision !== previousDecision : false,
    reasonsAdded: diffAdded(currentReasons, previousReasons),
    reasonsRemoved: diffRemoved(currentReasons, previousReasons),
    advisoriesAdded: diffAdded(currentAdvisories, previousAdvisories),
    advisoriesRemoved: diffRemoved(currentAdvisories, previousAdvisories)
  };
}

function loadOrBuildDiffPayload(errors) {
  if (fs.existsSync(diffPath)) {
    return loadJson(diffPath, errors, "/releaseSnapshotDiff");
  }
  return buildDerivedDiffPayload(errors);
}

function validateDiffPayload(payload) {
  const errors = [];
  if (!isObject(payload)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  mustBoolean(payload, "hasPrevious", "", errors);

  const current = mustObject(payload, "current", "", errors);
  if (current) {
    const decision = mustStringOrNull(current, "decision", "/current", errors);
    if (decision === null) {
      pushError(errors, "/current/decision", "must not be null");
    } else if (!["GO", "NO-GO", "UNKNOWN"].includes(decision)) {
      pushError(errors, "/current/decision", 'must be one of "GO" | "NO-GO" | "UNKNOWN"');
    }
  }

  const previous = mustObject(payload, "previous", "", errors);
  if (previous) {
    const decision = mustStringOrNull(previous, "decision", "/previous", errors);
    if (typeof decision === "string" && !["GO", "NO-GO", "UNKNOWN"].includes(decision)) {
      pushError(errors, "/previous/decision", 'must be one of "GO" | "NO-GO" | "UNKNOWN"');
    }
  }

  mustBoolean(payload, "decisionChanged", "", errors);
  mustStringArray(payload, "reasonsAdded", "", errors);
  mustStringArray(payload, "reasonsRemoved", "", errors);
  mustStringArray(payload, "advisoriesAdded", "", errors);
  mustStringArray(payload, "advisoriesRemoved", "", errors);

  return errors;
}

function assertSelfCheckCase(caseName, caseErrors, expectedPathPrefix, failures) {
  const matched = caseErrors.find((entry) => entry.startsWith(expectedPathPrefix));
  if (!matched) {
    pushError(
      failures,
      `/selfcheck/${caseName}`,
      `expected error path "${expectedPathPrefix}" not found`
    );
    return;
  }
  if (!/^\/[^:]+: .+/.test(matched)) {
    pushError(
      failures,
      `/selfcheck/${caseName}`,
      `error format mismatch, got "${matched}"`
    );
    return;
  }
  process.stdout.write(`selfcheck.${caseName}: ${matched}\n`);
}

function runSelfCheck() {
  const loadErrors = [];
  const baseline = loadOrBuildDiffPayload(loadErrors);
  if (loadErrors.length > 0 || !baseline) {
    process.stderr.write("Release snapshot diff self-check failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    if (!baseline) {
      process.stderr.write("- /selfcheck/base: baseline payload unavailable\n");
    }
    process.exit(1);
  }

  const failures = [];
  const cases = [
    {
      name: "missing-has-previous",
      expectedPathPrefix: "/hasPrevious:",
      mutate: (payload) => {
        delete payload.hasPrevious;
      }
    },
    {
      name: "current-decision-invalid-type",
      expectedPathPrefix: "/current/decision:",
      mutate: (payload) => {
        if (!isObject(payload.current)) {
          payload.current = {};
        }
        payload.current.decision = 1;
      }
    },
    {
      name: "reasons-added-not-array",
      expectedPathPrefix: "/reasonsAdded:",
      mutate: (payload) => {
        payload.reasonsAdded = "none";
      }
    }
  ];

  process.stdout.write("Release snapshot diff self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(baseline));
    oneCase.mutate(payload);
    const caseErrors = validateDiffPayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release snapshot diff self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release snapshot diff self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  if (process.env.RELEASE_SNAPSHOT_DIFF_SELFTEST === "1") {
    runSelfCheck();
    return;
  }

  const loadErrors = [];
  const payload = loadOrBuildDiffPayload(loadErrors);
  const errors = [...loadErrors];
  if (payload) {
    errors.push(...validateDiffPayload(payload));
  } else {
    pushError(errors, "/releaseSnapshotDiff", "payload unavailable");
  }

  if (errors.length > 0) {
    process.stderr.write("Release snapshot diff validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  const source = fs.existsSync(diffPath) ? diffPath : `${latestSnapshotPath} + ${snapshotArchiveDir}`;
  process.stdout.write(`Release snapshot diff validation passed: ${source}\n`);
}

main();

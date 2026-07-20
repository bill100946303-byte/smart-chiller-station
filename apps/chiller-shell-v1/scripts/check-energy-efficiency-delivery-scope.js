import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SHELL_ROOT = path.resolve(process.cwd());

const REQUIRED_ARTIFACTS = [
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js",
  "docs/ENERGY_EFFICIENCY_UI_ACCEPTANCE_CURRENT.md",
  "output/playwright/energy-efficiency-qa/calendar-1280x720.png",
  "output/playwright/energy-efficiency-qa/proportion-1280x720.png",
  "output/playwright/energy-efficiency-qa/thermal-balance-1280x720.png"
];

const DELIVERY_PATHS = [
  "apps/chiller-shell-v1/package.json",
  "apps/chiller-shell-v1/scripts/check-source-status-dictionary.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-delivery-scope.js",
  "apps/chiller-shell-v1/src/i18n/sourceStatusCN.ts",
  "apps/chiller-shell-v1/src/i18n/zhCN.ts",
  "apps/chiller-shell-v1/src/pages/EnergyEfficiencyPage.tsx",
  "apps/chiller-shell-v1/src/pages/EnergyEfficiencyExtracted.css",
  "apps/chiller-shell-v1/src/styles/global.css",
  "docs/source-status-key-dictionary-v1.2.json",
  "docs/ENERGY_EFFICIENCY_UI_ACCEPTANCE_CURRENT.md",
  "output/playwright/energy-efficiency-qa/"
];

const MANUAL_REVIEW_PATHS = [
  "apps/chiller-shell-v1/package-lock.json"
];

const REQUIRED_STAGED_DELIVERY_PATHS = [
  "apps/chiller-shell-v1/package.json",
  "apps/chiller-shell-v1/scripts/check-source-status-dictionary.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-delivery-scope.js",
  "apps/chiller-shell-v1/src/i18n/sourceStatusCN.ts",
  "apps/chiller-shell-v1/src/i18n/zhCN.ts",
  "apps/chiller-shell-v1/src/pages/EnergyEfficiencyPage.tsx",
  "apps/chiller-shell-v1/src/styles/global.css",
  "docs/ENERGY_EFFICIENCY_UI_ACCEPTANCE_CURRENT.md",
  "docs/source-status-key-dictionary-v1.2.json",
  "output/playwright/energy-efficiency-qa/calendar-1280x720.png",
  "output/playwright/energy-efficiency-qa/proportion-1280x720.png",
  "output/playwright/energy-efficiency-qa/thermal-balance-1280x720.png"
];

const DIRECT_STAGE_PATHS = [
  "apps/chiller-shell-v1/scripts/check-source-status-dictionary.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-ui-contract.js",
  "apps/chiller-shell-v1/scripts/check-energy-efficiency-delivery-scope.js",
  "apps/chiller-shell-v1/src/i18n/sourceStatusCN.ts",
  "apps/chiller-shell-v1/src/i18n/zhCN.ts",
  "apps/chiller-shell-v1/src/pages/EnergyEfficiencyPage.tsx",
  "docs/source-status-key-dictionary-v1.2.json",
  "docs/ENERGY_EFFICIENCY_UI_ACCEPTANCE_CURRENT.md",
  "output/playwright/energy-efficiency-qa/"
];

function quoteShellArg(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd || SHELL_ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  }).trimEnd();
}

function tryRunGit(args, options = {}) {
  try {
    return runGit(args, options);
  } catch {
    return null;
  }
}

function getRepoRoot() {
  return runGit(["rev-parse", "--show-toplevel"]);
}

function parseStatusLine(line) {
  const status = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const renameArrow = " -> ";
  const filePath = rawPath.includes(renameArrow) ? rawPath.split(renameArrow).at(-1) : rawPath;
  return { status, filePath };
}

function parseNameStatusLine(line) {
  const [status, ...pathParts] = line.split("\t");
  const filePath = pathParts.at(-1) || "";
  return { status: status.padEnd(2, " "), filePath };
}

function isUnder(filePath, candidatePath) {
  return filePath === candidatePath || filePath.startsWith(candidatePath.endsWith("/") ? candidatePath : `${candidatePath}/`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readIndexJson(repoRoot, filePath) {
  const source = tryRunGit(["show", `:${filePath}`], { cwd: repoRoot });
  return source ? JSON.parse(source) : null;
}

function readHeadJson(repoRoot, filePath) {
  try {
    const source = runGit(["show", `HEAD:${filePath}`], { cwd: repoRoot });
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function artifactExists(repoRoot, artifactPath, target) {
  if (target === "staged") {
    return tryRunGit(["cat-file", "-e", `:${artifactPath}`], { cwd: repoRoot }) !== null;
  }
  return fs.existsSync(path.join(repoRoot, artifactPath));
}

function hasScopedStatus(scopedStatusRows, candidatePath) {
  return scopedStatusRows.some((row) => isUnder(row.filePath, candidatePath));
}

function getNumstat(repoRoot, filePath, target) {
  const args = target === "staged"
    ? ["diff", "--cached", "--numstat", "--", filePath]
    : ["diff", "--numstat", "--", filePath];
  const output = tryRunGit(args, { cwd: repoRoot });
  if (!output) {
    return null;
  }
  const [addedText, deletedText] = output.split("\t");
  const added = Number(addedText);
  const deleted = Number(deletedText);
  if (!Number.isFinite(added) || !Number.isFinite(deleted)) {
    return null;
  }
  return { added, deleted };
}

function getAddedDiffLines(repoRoot, filePath, target) {
  const args = target === "staged"
    ? ["diff", "--cached", "--unified=0", "--", filePath]
    : ["diff", "--unified=0", "--", filePath];
  const output = tryRunGit(args, { cwd: repoRoot });
  if (!output) {
    return [];
  }
  return output
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

function auditGlobalCssDiff(repoRoot, target) {
  const addedLines = getAddedDiffLines(repoRoot, "apps/chiller-shell-v1/src/styles/global.css", target);
  const selectorLines = addedLines.filter((line) => line.includes("."));
  const energySelectorLines = selectorLines.filter((line) => /energy-efficiency/.test(line));
  const crossPageFamilies = [
    "report-record",
    "dashboard-cockpit",
    "system-overview",
    "energy-analysis",
    "meter-reading",
    "energy-parameter",
    "environment",
    "work-order",
    "knowledge",
    "cold-log",
    "project-switch",
    "device-overview",
    "optimize"
  ];
  const familyCounts = new Map();
  selectorLines.forEach((line) => {
    crossPageFamilies.forEach((family) => {
      if (line.includes(family)) {
        familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
      }
    });
  });
  const nonEnergySelectorLines = selectorLines.length - energySelectorLines.length;
  const topFamilies = Array.from(familyCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  return {
    addedLines: addedLines.length,
    selectorLines: selectorLines.length,
    energySelectorLines: energySelectorLines.length,
    nonEnergySelectorLines,
    topFamilies
  };
}

function getRootThreeRange(lockJson) {
  return lockJson?.packages?.[""]?.dependencies?.three || null;
}

function main() {
  const repoRoot = getRepoRoot();
  const target = process.env.DELIVERY_SCOPE_TARGET === "staged" ? "staged" : "worktree";
  const strictMode = process.env.STRICT_DELIVERY_SCOPE === "1";
  const allowBroadCssStage = process.env.ALLOW_BROAD_CSS_STAGE === "1";
  const allowCrossPageCssStage = process.env.ALLOW_CROSS_PAGE_CSS_STAGE === "1";
  const errors = [];
  const warnings = [];

  const missingArtifacts = REQUIRED_ARTIFACTS.filter((artifactPath) => !artifactExists(repoRoot, artifactPath, target));
  missingArtifacts.forEach((artifactPath) => {
    errors.push(`required artifact missing from ${target}: ${artifactPath}`);
  });

  const packageJsonPath = path.join(repoRoot, "apps/chiller-shell-v1/package.json");
  const packageJson = (target === "staged"
    ? readIndexJson(repoRoot, "apps/chiller-shell-v1/package.json")
    : readJson(packageJsonPath)) || {};
  if (Object.keys(packageJson).length === 0) {
    errors.push(`package.json missing from ${target}`);
  }
  if (packageJson.scripts?.["check:energy-efficiency-ui"] !== "node scripts/check-energy-efficiency-ui-contract.js") {
    errors.push("package.json script missing: check:energy-efficiency-ui");
  }
  if (packageJson.scripts?.["check:energy-efficiency-delivery-scope"] !== "node scripts/check-energy-efficiency-delivery-scope.js") {
    errors.push("package.json script missing: check:energy-efficiency-delivery-scope");
  }

  const headPackageJson = readHeadJson(repoRoot, "apps/chiller-shell-v1/package.json");
  const headThreeRange = headPackageJson?.dependencies?.three || null;
  const currentThreeRange = packageJson.dependencies?.three || null;
  const hasPackageJsonDependencyDrift = Boolean(headThreeRange && currentThreeRange && headThreeRange !== currentThreeRange);
  if (headThreeRange && currentThreeRange && headThreeRange !== currentThreeRange) {
    warnings.push(`package.json dependency drift: three ${headThreeRange} -> ${currentThreeRange}`);
  }

  let hasPackageLockDependencyDrift = false;
  const packageLockPath = path.join(repoRoot, "apps/chiller-shell-v1/package-lock.json");
  if (fs.existsSync(packageLockPath)) {
    const headPackageLock = readHeadJson(repoRoot, "apps/chiller-shell-v1/package-lock.json");
    const currentPackageLock = target === "staged"
      ? readIndexJson(repoRoot, "apps/chiller-shell-v1/package-lock.json")
      : readJson(packageLockPath);
    const headLockThreeRange = getRootThreeRange(headPackageLock);
    const currentLockThreeRange = getRootThreeRange(currentPackageLock);
    if (headLockThreeRange && currentLockThreeRange && headLockThreeRange !== currentLockThreeRange) {
      hasPackageLockDependencyDrift = true;
      warnings.push(`package-lock.json dependency drift: three ${headLockThreeRange} -> ${currentLockThreeRange}`);
    }
  }

  const statusOutput = target === "staged"
    ? runGit(["diff", "--cached", "--name-status"], { cwd: repoRoot })
    : runGit(["status", "--short"], { cwd: repoRoot });
  const scopedStatusOutput = target === "staged"
    ? runGit(["diff", "--cached", "--name-status", "--", ...DELIVERY_PATHS, ...MANUAL_REVIEW_PATHS], { cwd: repoRoot })
    : runGit(["status", "--short", "--", ...DELIVERY_PATHS, ...MANUAL_REVIEW_PATHS], { cwd: repoRoot });
  const parseRow = target === "staged" ? parseNameStatusLine : parseStatusLine;
  const statusRows = statusOutput ? statusOutput.split("\n").map(parseRow) : [];
  const scopedStatusRows = scopedStatusOutput ? scopedStatusOutput.split("\n").map(parseRow) : [];
  const deliveryRows = scopedStatusRows.filter((row) => DELIVERY_PATHS.some((candidatePath) => isUnder(row.filePath, candidatePath)));
  const manualRows = scopedStatusRows.filter((row) => MANUAL_REVIEW_PATHS.some((candidatePath) => isUnder(row.filePath, candidatePath)));
  const directlyStageableRows = scopedStatusRows.filter((row) => DIRECT_STAGE_PATHS.some((candidatePath) => isUnder(row.filePath, candidatePath)));
  const unrelatedRows = statusRows.filter((row) => {
    const inDelivery = DELIVERY_PATHS.some((candidatePath) => isUnder(row.filePath, candidatePath));
    const inManual = MANUAL_REVIEW_PATHS.some((candidatePath) => isUnder(row.filePath, candidatePath));
    return !inDelivery && !inManual;
  });

  if (manualRows.length > 0) {
    warnings.push(`manual review required before staging: ${manualRows.map((row) => row.filePath).join(", ")}`);
  }

  const globalCssChangedInTarget = hasScopedStatus(scopedStatusRows, "apps/chiller-shell-v1/src/styles/global.css");
  let globalCssAudit = null;
  if (globalCssChangedInTarget) {
    const globalCssNumstat = getNumstat(repoRoot, "apps/chiller-shell-v1/src/styles/global.css", target);
    globalCssAudit = auditGlobalCssDiff(repoRoot, target);
    const lineChangeSummary = globalCssNumstat
      ? `${globalCssNumstat.added} insertions / ${globalCssNumstat.deleted} deletions`
      : "line-count unavailable";
    if (!allowBroadCssStage) {
      warnings.push(`global.css broad diff requires manual review before staging (${lineChangeSummary}); rerun with ALLOW_BROAD_CSS_STAGE=1 only after review`);
    }
    if (globalCssAudit.nonEnergySelectorLines > 0 && !allowCrossPageCssStage) {
      warnings.push(`global.css cross-page selectors require separate approval (${globalCssAudit.nonEnergySelectorLines} non-energy selector-ish lines); rerun with ALLOW_CROSS_PAGE_CSS_STAGE=1 only after cross-page review`);
    }
  }

  if (target === "staged") {
    REQUIRED_STAGED_DELIVERY_PATHS.forEach((requiredPath) => {
      if (!hasScopedStatus(scopedStatusRows, requiredPath)) {
        errors.push(`required delivery path missing from staged diff: ${requiredPath}`);
      }
    });
  }

  if (strictMode && warnings.length > 0) {
    warnings.forEach((warning) => {
      errors.push(`strict delivery scope warning: ${warning}`);
    });
  }

  if (errors.length > 0) {
    console.error("Energy efficiency delivery scope check failed.");
    errors.forEach((error) => console.error(`- ${error}`));
    warnings.forEach((warning) => console.error(`- warning: ${warning}`));
    process.exit(1);
  }

  console.log("Energy efficiency delivery scope check passed.");
  console.log(`- target: ${target}`);
  console.log(`- strict mode: ${strictMode ? "on" : "off"}`);
  console.log(`- allow broad CSS stage: ${allowBroadCssStage ? "on" : "off"}`);
  console.log(`- allow cross-page CSS stage: ${allowCrossPageCssStage ? "on" : "off"}`);
  console.log(`- required artifacts present: ${REQUIRED_ARTIFACTS.length}`);
  console.log(`- delivery-scope dirty entries: ${deliveryRows.length}`);
  deliveryRows.forEach((row) => console.log(`  ${row.status} ${row.filePath}`));
  console.log("- staging recommendation:");
  const recommendedDirectStagePaths = hasPackageJsonDependencyDrift
    ? DIRECT_STAGE_PATHS
    : [...DIRECT_STAGE_PATHS, "apps/chiller-shell-v1/package.json"];
  console.log("  direct stage:");
  recommendedDirectStagePaths.forEach((stagePath) => console.log(`    ${stagePath}`));
  if (target === "worktree" && directlyStageableRows.length > 0) {
    const directlyChangedPaths = Array.from(new Set(
      directlyStageableRows.map((row) => row.filePath)
    ));
    console.log("  suggested direct-stage command:");
    console.log(`    git add -- ${directlyChangedPaths.map(quoteShellArg).join(" ")}`);
  }
  if (hasPackageJsonDependencyDrift) {
    console.log("  partial stage:");
    console.log("    apps/chiller-shell-v1/package.json (stage script additions only; keep three dependency drift out unless approved)");
    console.log("    use git add -p -- apps/chiller-shell-v1/package.json and accept only the scripts hunk");
  }
  console.log("  manual review before stage:");
  console.log("    apps/chiller-shell-v1/src/styles/global.css (broad cross-page diff; set ALLOW_BROAD_CSS_STAGE=1 and ALLOW_CROSS_PAGE_CSS_STAGE=1 only after review)");
  if (globalCssAudit) {
    console.log("- global.css selector audit:");
    console.log(`  added diff lines: ${globalCssAudit.addedLines}`);
    console.log(`  added selector-ish lines: ${globalCssAudit.selectorLines}`);
    console.log(`  energy-efficiency selector-ish lines: ${globalCssAudit.energySelectorLines}`);
    console.log(`  non-energy selector-ish lines: ${globalCssAudit.nonEnergySelectorLines}`);
    if (globalCssAudit.topFamilies.length > 0) {
      console.log(`  cross-page families: ${globalCssAudit.topFamilies.map(([family, count]) => `${family}=${count}`).join(", ")}`);
    }
  }
  if (manualRows.length > 0 || hasPackageLockDependencyDrift) {
    console.log("  do not stage without approval:");
    MANUAL_REVIEW_PATHS.forEach((stagePath) => console.log(`    ${stagePath}`));
  }
  if (warnings.length > 0) {
    console.log(`- manual review warnings: ${warnings.length}`);
    warnings.forEach((warning) => console.log(`  ${warning}`));
    if (!strictMode) {
      console.log("  rerun with STRICT_DELIVERY_SCOPE=1 to fail on these warnings before staging");
    }
  } else {
    console.log("- manual review warnings: none");
  }
  console.log(`- unrelated dirty entries ignored: ${unrelatedRows.length}`);
}

main();

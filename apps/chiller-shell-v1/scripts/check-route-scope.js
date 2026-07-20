import fs from "node:fs";
import path from "node:path";

// Keeps App routes, README scope, and side navigation aligned.
// /login and /projects are entry flows and intentionally excluded from side-nav coverage.

const SHELL_ROOT = path.resolve(process.cwd());
const APP_FILE = path.join(SHELL_ROOT, "src/App.tsx");
const APP_SHELL_FILE = path.join(SHELL_ROOT, "src/layout/AppShell.tsx");
const STATION_NAV_FILE = path.join(SHELL_ROOT, "src/config/energyStationNavigation.ts");
const ZH_CN_FILE = path.join(SHELL_ROOT, "src/i18n/zhCN.ts");
const README_FILE = path.join(SHELL_ROOT, "README.md");

function extractObjectLiteral(source, constName) {
  const marker = `const ${constName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Cannot find constant: ${constName}`);
  }

  const equalIndex = source.indexOf("=", markerIndex);
  if (equalIndex < 0) {
    throw new Error(`Cannot find '=' for constant: ${constName}`);
  }

  const braceStart = source.indexOf("{", equalIndex);
  if (braceStart < 0) {
    throw new Error(`Cannot find object literal start for constant: ${constName}`);
  }

  let index = braceStart;
  let depth = 0;
  let quote = null;
  let escaped = false;

  while (index < source.length) {
    const ch = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (ch === "'" || ch === "\"" || ch === "`") {
      quote = ch;
      index += 1;
      continue;
    }

    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart, index + 1);
      }
    }

    index += 1;
  }

  throw new Error(`Cannot find object literal end for constant: ${constName}`);
}

function parseObjectLiteral(literal, constName) {
  try {
    return Function(`"use strict"; return (${literal});`)();
  } catch (error) {
    throw new Error(`Failed to parse ${constName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractCanonicalRoutes(appSource) {
  const routes = [];
  const routePattern = /<Route\s+path="([^"]+)"\s+element=\{([^}]+)\}/g;
  let match;

  while ((match = routePattern.exec(appSource))) {
    const routePath = match[1];
    const element = match[2];
    if (
      routePath.startsWith("/") &&
      (element.includes("renderLazyPage(") || element.includes("<LoginEntry"))
    ) {
      routes.push(routePath);
    }
  }

  return Array.from(new Set(routes)).sort();
}

function extractReadmeScope(readmeSource) {
  const lines = readmeSource.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === "Current scope:");
  if (startIndex < 0) {
    throw new Error("README.md is missing `Current scope:` section.");
  }

  const routes = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      break;
    }
    const match = line.match(/^-\s+`([^`]+)`\s*$/);
    if (match) {
      routes.push(match[1]);
      continue;
    }
    throw new Error(`Unexpected README scope line ${index + 1}: ${line}`);
  }

  return routes;
}

function extractNavigationRoutes(shellSource) {
  return extractNavigationEntries(shellSource).map((entry) => entry.route);
}

function extractNavigationEntries(shellSource) {
  const entries = [];
  const navPattern = /\{\s*to:\s*"([^"]+)".*?label:\s*([^ }\n]+(?:\.[^ }\n]+)*)\s*\}/g;
  let match;

  while ((match = navPattern.exec(shellSource))) {
    if (match[1].startsWith("/")) {
      entries.push({
        route: match[1],
        label: match[2]
      });
    }
  }

  return entries;
}

function extractStationNavigationEntries(stationSource) {
  const entries = [];
  const navPattern = /\{\s*to:\s*"([^"]+)"\s*,\s*labelKey:\s*"([A-Za-z0-9_]+)"/g;
  let match;

  while ((match = navPattern.exec(stationSource))) {
    if (match[1].startsWith("/")) {
      entries.push({
        route: match[1],
        label: `zhCN.appShell.${match[2]}`
      });
    }
  }

  return entries;
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicated = new Set();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicated.add(value);
      return;
    }
    seen.add(value);
  });
  return Array.from(duplicated).sort();
}

function resolveZhCnAppShellValue(expression, zhBase) {
  const match = expression.match(/^zhCN\.appShell\.([A-Za-z0-9_]+)$/);
  if (!match) {
    return null;
  }
  const value = zhBase?.appShell?.[match[1]];
  return typeof value === "string" ? value.trim() : "";
}

function main() {
  const appSource = fs.readFileSync(APP_FILE, "utf8");
  const shellSource = fs.readFileSync(APP_SHELL_FILE, "utf8");
  const stationNavSource = fs.readFileSync(STATION_NAV_FILE, "utf8");
  const zhCnSource = fs.readFileSync(ZH_CN_FILE, "utf8");
  const readmeSource = fs.readFileSync(README_FILE, "utf8");
  const zhBase = parseObjectLiteral(extractObjectLiteral(zhCnSource, "zhBase"), "zhBase");
  const appRoutes = extractCanonicalRoutes(appSource);
  const navEntries = [
    ...extractNavigationEntries(shellSource),
    ...extractStationNavigationEntries(stationNavSource)
  ];
  const navRoutes = Array.from(new Set(navEntries.map((entry) => entry.route))).sort();
  const readmeRoutes = extractReadmeScope(readmeSource);

  const appSet = new Set(appRoutes);
  const navSet = new Set(navRoutes);
  const readmeSet = new Set(readmeRoutes);
  const duplicates = findDuplicates(readmeRoutes);
  const duplicateNavRoutes = findDuplicates(navEntries.map((entry) => entry.route));
  const repeatedStationOverviewExpression = "zhCN.appShell.navStationOverview";
  const duplicateNavLabels = findDuplicates(
    navEntries.map((entry) => entry.label).filter((label) => label !== repeatedStationOverviewExpression)
  );
  const missingNavLabelValues = navEntries
    .map((entry) => ({
      ...entry,
      value: resolveZhCnAppShellValue(entry.label, zhBase)
    }))
    .filter((entry) => entry.value === "");
  const repeatedStationOverviewValue = resolveZhCnAppShellValue(repeatedStationOverviewExpression, zhBase);
  const duplicateNavLabelValues = findDuplicates(
    navEntries
      .map((entry) => resolveZhCnAppShellValue(entry.label, zhBase))
      .filter((value) => Boolean(value) && value !== repeatedStationOverviewValue)
  );
  const missing = appRoutes.filter((routePath) => !readmeSet.has(routePath));
  const extra = readmeRoutes.filter((routePath) => !appSet.has(routePath));
  const extraNavRoutes = navRoutes.filter((routePath) => !appSet.has(routePath));
  const routesExcludedFromNav = new Set(["/login", "/projects"]);
  const missingNavRoutes = appRoutes.filter(
    (routePath) => !routesExcludedFromNav.has(routePath) && !navSet.has(routePath)
  );

  if (
    duplicates.length > 0 ||
    duplicateNavRoutes.length > 0 ||
    duplicateNavLabels.length > 0 ||
    missingNavLabelValues.length > 0 ||
    duplicateNavLabelValues.length > 0 ||
    missing.length > 0 ||
    extra.length > 0 ||
    extraNavRoutes.length > 0 ||
    missingNavRoutes.length > 0
  ) {
    console.error("Route scope check failed:");
    if (duplicates.length > 0) {
      console.error(`- duplicate README routes: ${duplicates.join(", ")}`);
    }
    if (duplicateNavRoutes.length > 0) {
      console.error(`- duplicate navigation routes: ${duplicateNavRoutes.join(", ")}`);
    }
    if (duplicateNavLabels.length > 0) {
      console.error(`- duplicate navigation labels: ${duplicateNavLabels.join(", ")}`);
    }
    if (missingNavLabelValues.length > 0) {
      console.error(
        `- navigation labels missing zh-CN values: ${missingNavLabelValues
          .map((entry) => `${entry.route}:${entry.label}`)
          .join(", ")}`
      );
    }
    if (duplicateNavLabelValues.length > 0) {
      console.error(`- duplicate navigation label text: ${duplicateNavLabelValues.join(", ")}`);
    }
    if (missing.length > 0) {
      console.error(`- missing README routes: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      console.error(`- extra README routes not found in App.tsx: ${extra.join(", ")}`);
    }
    if (extraNavRoutes.length > 0) {
      console.error(`- navigation routes not found in App.tsx: ${extraNavRoutes.join(", ")}`);
    }
    if (missingNavRoutes.length > 0) {
      console.error(`- canonical routes missing from AppShell navigation: ${missingNavRoutes.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("Route scope check passed.");
  console.log(`- canonical routes: ${appRoutes.length}`);
  console.log(`- navigation routes: ${navRoutes.length}`);
  console.log(`- navigation labels: ${navEntries.length}`);
}

main();

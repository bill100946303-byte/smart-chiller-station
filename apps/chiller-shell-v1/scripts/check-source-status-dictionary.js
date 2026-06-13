import fs from "node:fs";
import path from "node:path";

const SHELL_ROOT = path.resolve(process.cwd());
const SOURCE_STATUS_FILE = path.join(SHELL_ROOT, "src/i18n/sourceStatusCN.ts");
const DICT_FILE = path.resolve(SHELL_ROOT, "../..", "docs/source-status-key-dictionary-v1.2.json");
const FORBIDDEN_SOURCE_STATUS_COPY = [
  { name: "unmapped source wording", pattern: /未收录|Unmapped/i }
];

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

function getSourceLabelRecord(key, maps) {
  const { sourceMap, metricMap, aliasMap } = maps;
  const canonicalKey = aliasMap[key] || key;

  if (canonicalKey.startsWith("metric.")) {
    return metricMap[canonicalKey.slice("metric.".length)] || null;
  }
  return sourceMap[canonicalKey] || null;
}

function compareLabels(expected, actual, key, errors) {
  if (!actual) {
    errors.push(`labels.${key}: missing in sourceStatusCN.ts`);
    return;
  }
  const zh = actual["zh-CN"];
  if (!zh) {
    errors.push(`labels.${key}.zh-CN: missing locale mapping`);
    return;
  }
  if (zh.short !== expected.shortLabel) {
    errors.push(
      `labels.${key}.shortLabel: expected "${expected.shortLabel}", got "${zh.short}"`
    );
  }
  if (zh.full !== expected.fullLabel) {
    errors.push(
      `labels.${key}.fullLabel: expected "${expected.fullLabel}", got "${zh.full}"`
    );
  }
}

function compareTop10I18n(dictTop10, maps, warnings) {
  const locales = ["en-US", "vi-VN"];
  Object.entries(dictTop10).forEach(([key, localePack]) => {
    const actual = getSourceLabelRecord(key, maps);
    if (!actual) {
      warnings.push(`i18nLite.top10.${key}: missing key mapping`);
      return;
    }
    locales.forEach((locale) => {
      const expectedLocale = localePack[locale];
      if (!expectedLocale) {
        return;
      }
      const actualLocale = actual[locale];
      if (!actualLocale) {
        warnings.push(`i18nLite.top10.${key}.${locale}: missing locale mapping`);
        return;
      }
      if (actualLocale.short !== expectedLocale.shortLabel) {
        warnings.push(
          `i18nLite.top10.${key}.${locale}.shortLabel: expected "${expectedLocale.shortLabel}", got "${actualLocale.short}"`
        );
      }
      if (actualLocale.full !== expectedLocale.fullLabel) {
        warnings.push(
          `i18nLite.top10.${key}.${locale}.fullLabel: expected "${expectedLocale.fullLabel}", got "${actualLocale.full}"`
        );
      }
    });
  });
}

function main() {
  const sourceText = fs.readFileSync(SOURCE_STATUS_FILE, "utf8");
  const dict = JSON.parse(fs.readFileSync(DICT_FILE, "utf8"));

  const sourceMap = parseObjectLiteral(
    extractObjectLiteral(sourceText, "SOURCE_KEY_LABEL_MAP"),
    "SOURCE_KEY_LABEL_MAP"
  );
  const metricMap = parseObjectLiteral(
    extractObjectLiteral(sourceText, "METRIC_KEY_LABEL_MAP"),
    "METRIC_KEY_LABEL_MAP"
  );
  const aliasMap = parseObjectLiteral(
    extractObjectLiteral(sourceText, "SOURCE_KEY_ALIAS_MAP"),
    "SOURCE_KEY_ALIAS_MAP"
  );
  const unknownSourceLabel = parseObjectLiteral(
    extractObjectLiteral(sourceText, "UNKNOWN_SOURCE_LABEL"),
    "UNKNOWN_SOURCE_LABEL"
  );
  const metricFallbackLabel = parseObjectLiteral(
    extractObjectLiteral(sourceText, "METRIC_FALLBACK_LABEL"),
    "METRIC_FALLBACK_LABEL"
  );

  const errors = [];
  const warnings = [];
  const maps = { sourceMap, metricMap, aliasMap };

  FORBIDDEN_SOURCE_STATUS_COPY.forEach(({ name, pattern }) => {
    if (pattern.test(sourceText)) {
      errors.push(`sourceStatusCN.ts: forbidden ${name}`);
    }
    if (pattern.test(JSON.stringify(dict))) {
      errors.push(`source-status-key-dictionary-v1.2.json: forbidden ${name}`);
    }
  });

  Object.entries(dict.labels || {}).forEach(([key, expected]) => {
    const actual = getSourceLabelRecord(key, maps);
    compareLabels(expected, actual, key, errors);
  });

  Object.entries(dict.convergence?.aliases || {}).forEach(([alias, canonical]) => {
    if (aliasMap[alias] !== canonical) {
      errors.push(
        `convergence.aliases.${alias}: expected "${canonical}", got "${aliasMap[alias] || "<missing>"}"`
      );
    }
  });

  const expectedUnknownShort = dict.fallback?.shortLabel;
  const expectedUnknownFullPrefix = String(dict.fallback?.fullLabelTemplate || "")
    .split("{rawKey}")[0]
    .replace(/[（(]\s*$/, "");
  if (unknownSourceLabel?.["zh-CN"]?.short !== expectedUnknownShort) {
    errors.push(
      `fallback.shortLabel: expected "${expectedUnknownShort}", got "${unknownSourceLabel?.["zh-CN"]?.short}"`
    );
  }
  if (!String(unknownSourceLabel?.["zh-CN"]?.full || "").startsWith(expectedUnknownFullPrefix)) {
    errors.push(
      `fallback.fullLabelTemplate: expected prefix "${expectedUnknownFullPrefix}", got "${unknownSourceLabel?.["zh-CN"]?.full}"`
    );
  }

  if (metricFallbackLabel?.["zh-CN"]?.short !== dict.metricTemplate?.unknownFallback?.shortLabel) {
    errors.push(
      `metricTemplate.unknownFallback.shortLabel: expected "${dict.metricTemplate?.unknownFallback?.shortLabel}", got "${metricFallbackLabel?.["zh-CN"]?.short}"`
    );
  }
  if (metricFallbackLabel?.["zh-CN"]?.full !== "规则指标") {
    errors.push(
      `metricTemplate.unknownFallback.fullLabelTemplate: expected prefix "规则指标", got "${metricFallbackLabel?.["zh-CN"]?.full}"`
    );
  }

  compareTop10I18n(dict.i18nLite?.top10 || {}, maps, warnings);

  if (errors.length > 0) {
    console.error("Source status dictionary consistency check failed:");
    errors.forEach((message) => console.error(`- ${message}`));
    if (warnings.length > 0) {
      console.error("Warnings:");
      warnings.forEach((message) => console.error(`- ${message}`));
    }
    process.exit(1);
  }

  console.log("Source status dictionary consistency check passed.");
  console.log(`- checked labels: ${Object.keys(dict.labels || {}).length}`);
  if (warnings.length > 0) {
    console.log(`- warnings: ${warnings.length}`);
    warnings.forEach((message) => console.log(`  - ${message}`));
  } else {
    console.log("- warnings: none");
  }
}

main();

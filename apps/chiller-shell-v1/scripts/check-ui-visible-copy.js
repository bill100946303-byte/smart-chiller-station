import fs from "node:fs";
import path from "node:path";

// Guards operator-facing Chinese UI copy from leaking implementation details.
// Keep this focused on visible product language; code identifiers belong in allow rules.

const SHELL_ROOT = path.resolve(process.cwd());

const ZH_CN_FILE = path.join(SHELL_ROOT, "src/i18n/zhCN.ts");
const UI_SOURCE_DIRS = [
  "src/pages",
  "src/components",
  "src/layout"
].map((item) => path.join(SHELL_ROOT, item));
const SOURCE_ROOT = path.join(SHELL_ROOT, "src");
const STALE_SOURCE_ARTIFACT_PATTERN = /\.(?:bak|orig|rej)$|pre_rollback|corrupt_/i;

const FORBIDDEN_COPY_PATTERNS = [
  { name: "legacy", pattern: /\blegacy\b/i },
  { name: "endpoint", pattern: /\bendpoint\b/i },
  { name: "BFF", pattern: /\bBFF\b/ },
  { name: "mock", pattern: /\bmock\b/i },
  { name: "siteId", pattern: /\bsiteId\b/ },
  { name: "Site number", pattern: /\bSite\s+\d+\b/ },
  { name: "performance endpoint", pattern: /chillerperformancecure/i },
  { name: "environment update path", pattern: /condition\/update/i },
  { name: "scene model method", pattern: /findAllFloorModel/i },
  { name: "source method", pattern: /find(?:Object|All|Energy)/i },
  { name: "raw path", pattern: /\/(?:zsqy|module|models)\/[^\s"'`<>，。；、)）]*/i },
  { name: "video URL", pattern: /ws:\/\/|RTSP\s+地址|RTSP\s+over\s+WebSocket|WebSocket/i },
  { name: "script wording", pattern: /运行时脚本|播放器脚本|脚本(?:就绪|失败|加载中|已配置)?/ },
  { name: "interface state", pattern: /接口(?:正常|异常|返回业务异常|路径|不可用|未开放|返回|加载失败)/ },
  { name: "internal path wording", pattern: /原始接口路径|目标路径/ },
  { name: "old English control terms", pattern: /\b(?:Approach|Shadow|Trim)\b/ },
  { name: "local dev label", pattern: /本地开发/ },
  { name: "unmapped source", pattern: /未收录|Unmapped/i },
  { name: "mojibake", pattern: /�|Ã|æ|ç|绌洪棿|鏆|銆|谩|峄|瓢|膼|茫|岷/ }
];

const HARDCODED_LINE_ALLOW_PATTERNS = [
  /const\s+PLAYER_SCRIPT_/,
  /\b(?:rtspURL|wsURL)\s*:/,
  /type\s+Legacy/,
  /function\s+loadPlayerControlScript/,
  /PlayerControl/,
  /contentWindow|contentDocument|HTMLIFrameElement/,
  /Cross-origin frames/,
  /fetchSceneLegacyTrend/,
  /toLegacyDateTime|mapLegacyLanguage/,
  /legacyBaseUrl/,
  /siteId[:),]/,
  /endpoint[:),]/,
  /interfaceKind/,
  /source\.endpoint/,
  /querySource\?\.endpoint/,
  /runtimeConfig\.siteId|currentProject\.siteId|candidateProject\.siteId|project\.siteId/,
  /localeText\(/,
  /SOURCE_KEY_LABEL_MAP|SOURCE_KEY_ALIAS_MAP/,
  /en-US|vi-VN/
];

const ZH_BASE_NON_CHINESE_ALLOW_PATTERNS = [
  /^(?:English|Tiếng Việt)$/,
  /^(?:AI|COP|PLC|CSV|PDF|DRAFT|E|P|C|M|Min|Max)$/,
  /^(?:2D|3D)(?:\s*\/\s*(?:2D|3D))?$/,
  /^(?:ASHRAE|DOE|NREL)(?:\s*\/\s*(?:ASHRAE|DOE|NREL))*$/,
  /^(?:kW\/Rt|kWh|GPM\/RT|Rt)$/i,
  /^[\d\s./:：~\-+%℃°()（）]+$/
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

function walkFiles(dir, output = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return;
      }
      walkFiles(fullPath, output);
      return;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.bak$|pre_rollback|corrupt_/i.test(entry.name)) {
      output.push(fullPath);
    }
  });
  return output;
}

function findStaleSourceArtifacts(dir, output = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return;
      }
      findStaleSourceArtifacts(fullPath, output);
      return;
    }
    if (STALE_SOURCE_ARTIFACT_PATTERN.test(entry.name)) {
      output.push(fullPath);
    }
  });
  return output;
}

function flattenStrings(value, prefix = "", output = []) {
  if (typeof value === "string") {
    output.push({ path: prefix || "<root>", value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenStrings(item, `${prefix}[${index}]`, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => flattenStrings(item, prefix ? `${prefix}.${key}` : key, output));
  }
  return output;
}

function isForbidden(text) {
  return FORBIDDEN_COPY_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
}

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function hasLongLatinText(text) {
  return /[A-Za-z]{4,}/.test(text);
}

function isAllowedZhBaseNonChinese(text) {
  return ZH_BASE_NON_CHINESE_ALLOW_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function scanZhBase(errors) {
  const source = fs.readFileSync(ZH_CN_FILE, "utf8");
  const zhBase = parseObjectLiteral(extractObjectLiteral(source, "zhBase"), "zhBase");

  flattenStrings(zhBase).forEach((entry) => {
    const hits = isForbidden(entry.value);
    if (hits.length > 0) {
      errors.push({
        file: path.relative(SHELL_ROOT, ZH_CN_FILE),
        location: entry.path,
        hits,
        text: entry.value
      });
    }
    if (!hasChinese(entry.value) && hasLongLatinText(entry.value) && !isAllowedZhBaseNonChinese(entry.value)) {
      errors.push({
        file: path.relative(SHELL_ROOT, ZH_CN_FILE),
        location: entry.path,
        hits: ["non-Chinese zh-CN baseline"],
        text: entry.value
      });
    }
  });
}

function scanHardcodedChinese(errors) {
  const files = UI_SOURCE_DIRS.flatMap((dir) => walkFiles(dir));
  files.forEach((file) => {
    const relative = path.relative(SHELL_ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!hasChinese(line)) {
        return;
      }
      if (HARDCODED_LINE_ALLOW_PATTERNS.some((pattern) => pattern.test(line))) {
        return;
      }
      const hits = isForbidden(line);
      if (hits.length > 0) {
        errors.push({
          file: relative,
          location: `line ${index + 1}`,
          hits,
          text: line.trim()
        });
      }
    });
  });
}

function scanStaleSourceArtifacts(errors) {
  findStaleSourceArtifacts(SOURCE_ROOT).forEach((file) => {
    errors.push({
      file: path.relative(SHELL_ROOT, file),
      location: "<file>",
      hits: ["stale source artifact"],
      text: "Remove rollback/corrupt backup files from src before delivery."
    });
  });
}

function main() {
  const errors = [];
  scanStaleSourceArtifacts(errors);
  scanZhBase(errors);
  scanHardcodedChinese(errors);

  if (errors.length > 0) {
    console.error("Visible UI copy check failed:");
    errors.slice(0, 80).forEach((error) => {
      console.error(`- ${error.file}:${error.location} [${error.hits.join(", ")}] ${error.text}`);
    });
    if (errors.length > 80) {
      console.error(`- ... ${errors.length - 80} more issues`);
    }
    process.exit(1);
  }

  console.log("Visible UI copy check passed.");
  console.log(`- checked zh-CN dictionary: ${path.relative(SHELL_ROOT, ZH_CN_FILE)}`);
  console.log(`- checked source dirs: ${UI_SOURCE_DIRS.map((dir) => path.relative(SHELL_ROOT, dir)).join(", ")}`);
}

main();

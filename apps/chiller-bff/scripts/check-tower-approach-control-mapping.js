import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { resolveSiteRuntimeConfig } from "../src/lib/site-runtime-config.js";
import { resolveTowerApproachDispatchConfig } from "../src/services/optimizeExecutionDispatchService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || normalizeText(process.env.B25_LEGACY_APP_ID) || "140";
const DB_FILE = path.resolve(process.env.ADMIN_DB_FILE || appConfig.adminDbFile);
const OUTPUT_JSON =
  process.env.TOWER_APPROACH_CONTROL_MAPPING_JSON ||
  path.resolve(ROOT_DIR, "docs/tower-approach-control-mapping-latest.json");
const OUTPUT_MD =
  process.env.TOWER_APPROACH_CONTROL_MAPPING_MD ||
  path.resolve(ROOT_DIR, "docs/tower-approach-control-mapping-latest.md");

const REQUIRED_CONTEXT = ["userId", "appId", "drTypeId", "drId", "tagName"];
const APPROVE_VALUE_SOURCES = new Set([
  "targetTcwsC",
  "targetApproachC",
  "execution.targetTcwsC",
  "execution.targetApproachC"
]);
const ROLLBACK_VALUE_SOURCES = new Set([
  "rollbackTarget.targetTcwsC",
  "rollbackTarget.targetApproachC",
  "execution.rollbackTarget.targetTcwsC",
  "execution.rollbackTarget.targetApproachC"
]);

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(String(item))).filter(Boolean)
    : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushUnique(target, value) {
  const normalized = normalizeText(value);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function isDoimplementsEndpoint(endpoint) {
  return /\/zsqy\/qstag\/[^/]+\/doimplements/i.test(normalizeText(endpoint));
}

function readTarget(towerApproach, operation) {
  const controlTargets = isPlainObject(towerApproach?.controlTargets) ? towerApproach.controlTargets : {};
  const target = isPlainObject(controlTargets[operation]) ? controlTargets[operation] : null;
  return target;
}

function readEndpoint(target, fallbackEndpoint) {
  return normalizeText(target?.endpoint) || normalizeText(fallbackEndpoint);
}

function normalizeCommandList(target) {
  if (!isPlainObject(target)) {
    return [];
  }
  if (Array.isArray(target.commands) && target.commands.length > 0) {
    return target.commands.filter(isPlainObject);
  }
  if (
    normalizeText(target.drTypeId) ||
    normalizeText(target.drId) ||
    normalizeText(target.tagName) ||
    normalizeText(target.valueSource)
  ) {
    return [target];
  }
  return [];
}

function validateCommand(command, operation, index, allowedValueSources) {
  const blockers = [];
  const warnings = [];
  const fieldPrefix = `${operation}.commands[${index}]`;
  const valueSource = normalizeText(command.valueSource);

  if (!normalizeText(command.drTypeId)) {
    pushUnique(blockers, `${fieldPrefix}.drTypeId 缺失`);
  }
  if (!normalizeText(command.drId)) {
    pushUnique(blockers, `${fieldPrefix}.drId 缺失`);
  }
  if (!normalizeText(command.tagName)) {
    pushUnique(blockers, `${fieldPrefix}.tagName 缺失`);
  }
  if (!valueSource) {
    pushUnique(blockers, `${fieldPrefix}.valueSource 缺失`);
  } else if (!allowedValueSources.has(valueSource)) {
    pushUnique(
      blockers,
      `${fieldPrefix}.valueSource=${valueSource} 不在 ${Array.from(allowedValueSources).join(" / ")} 范围内`
    );
  }

  const transform = normalizeText(command.valueTransform);
  if (transform && !["identity", "round1", "round0", "clamp"].includes(transform)) {
    pushUnique(warnings, `${fieldPrefix}.valueTransform=${transform} 不是内置变换，需现场说明`);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    command: {
      drTypeId: normalizeText(command.drTypeId),
      drId: normalizeText(command.drId),
      tagName: normalizeText(command.tagName),
      valueSource,
      valueTransform: transform || "identity",
      drTypeName: normalizeText(command.drTypeName) || null,
      drName: normalizeText(command.drName) || null
    }
  };
}

function validateOperationMapping(operation, target, endpointFallback, allowedValueSources) {
  const blockers = [];
  const warnings = [];
  const endpoint = readEndpoint(target, endpointFallback);

  if (!isPlainObject(target)) {
    pushUnique(blockers, `${operation} 映射缺失`);
  }
  if (!endpoint) {
    pushUnique(blockers, `${operation}.endpoint 缺失`);
  }

  const strategy = normalizeText(target?.strategy);
  if (!strategy) {
    pushUnique(blockers, `${operation}.strategy 缺失`);
  } else if (!["device-reg-command", "multi-step-command", "json-command"].includes(strategy)) {
    pushUnique(warnings, `${operation}.strategy=${strategy} 不是当前推荐策略`);
  }

  const requiredContext = normalizeArray(target?.requiredContext);
  for (const required of REQUIRED_CONTEXT) {
    if (!requiredContext.includes(required)) {
      pushUnique(blockers, `${operation}.requiredContext 缺 ${required}`);
    }
  }

  const commandTemplate =
    normalizeText(target?.commandTemplate) ||
    normalizeText(target?.msgTemplate) ||
    normalizeText(target?.msg);
  if (!commandTemplate) {
    pushUnique(blockers, `${operation}.commandTemplate/msgTemplate 缺失`);
  }

  const commands = normalizeCommandList(target);
  if (commands.length === 0) {
    pushUnique(blockers, `${operation}.commands 缺失，无法确认 drTypeId/drId/tagName/valueSource`);
  }

  const commandChecks = commands.map((command, index) =>
    validateCommand(command, operation, index, allowedValueSources)
  );
  for (const check of commandChecks) {
    check.blockers.forEach((item) => pushUnique(blockers, item));
    check.warnings.forEach((item) => pushUnique(warnings, item));
  }

  if (isDoimplementsEndpoint(endpoint) && strategy !== "device-reg-command" && strategy !== "multi-step-command") {
    pushUnique(warnings, `${operation}.endpoint 指向 legacy doimplements，strategy 建议使用 device-reg-command 或 multi-step-command`);
  }

  return {
    operation,
    status: blockers.length === 0 ? "ready" : isPlainObject(target) ? "partial" : "missing",
    endpoint: endpoint || null,
    strategy: strategy || null,
    requiredContext,
    commandTemplate: commandTemplate || null,
    commandCount: commands.length,
    commands: commandChecks.map((check) => check.command),
    blockers,
    warnings
  };
}

function buildReport(siteConfig) {
  const towerApproach = isPlainObject(siteConfig?.towerApproach) ? siteConfig.towerApproach : {};
  const dispatchConfig = resolveTowerApproachDispatchConfig(siteConfig);
  const approve = validateOperationMapping(
    "approve",
    readTarget(towerApproach, "approve"),
    dispatchConfig.approveEndpoint,
    APPROVE_VALUE_SOURCES
  );
  const rollback = validateOperationMapping(
    "rollback",
    readTarget(towerApproach, "rollback"),
    dispatchConfig.rollbackEndpoint,
    ROLLBACK_VALUE_SOURCES
  );
  const blockers = [...approve.blockers, ...rollback.blockers];
  const warnings = [...approve.warnings, ...rollback.warnings];
  const usesLegacyDointerfaces = [approve.endpoint, rollback.endpoint].some(isDoimplementsEndpoint);
  const doimplementsRequiresTranslator = false;
  if (usesLegacyDointerfaces && blockers.length === 0) {
    pushUnique(
      warnings,
      "endpoint 指向 legacy doimplements；dispatch 服务会按 controlTargets.commands 顺序翻译并下发 GET 命令，仍需现场确认回执语义。"
    );
  }

  const realDispatchReady = blockers.length === 0;
  const conclusion = realDispatchReady ? "GO_REAL_DISPATCH_MAPPING" : "NO_GO_REAL_DISPATCH_MAPPING";
  return {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    dbFile: DB_FILE,
    conclusion,
    dispatchMode: dispatchConfig.mode,
    realDispatchReady,
    shadowAllowedWithoutMapping: dispatchConfig.mode === "shadow",
    usesLegacyDointerfaces,
    doimplementsRequiresTranslator,
    operations: {
      approve,
      rollback
    },
    blockers,
    warnings,
    nextActions: realDispatchReady
      ? [
          "先在 shadow/assisted 中验证 endpoint 回执语义，不直接打开 enforced。",
          "确认 PLC 侧最小/最大值、单步限幅、死区、告警闭锁和回退逻辑已上线。"
        ]
      : [
          "补齐 approve/rollback 的 endpoint、requiredContext、commandTemplate 和 commands。",
          "逐条确认 drTypeId、drId、tagName、valueSource 与现场 PLC/SCADA 点位一致。",
          "如果使用 legacy doimplements，先用 shadow/assisted 验证 msg 格式和 legacy 回执语义，再评估 enforced。"
        ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 冷却塔 Approach 控制点映射审计");
  lines.push("");
  lines.push(`- 结论：${report.conclusion}`);
  lines.push(`- 站点：${report.siteId}`);
  lines.push(`- dispatchMode：${report.dispatchMode}`);
  lines.push(`- 真实下发映射就绪：${report.realDispatchReady ? "是" : "否"}`);
  lines.push(`- shadow 可无点位映射运行：${report.shadowAllowedWithoutMapping ? "是" : "否"}`);
  lines.push(`- 使用 legacy doimplements：${report.usesLegacyDointerfaces ? "是" : "否"}`);
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push("## 映射状态");
  lines.push("");
  lines.push("| operation | status | endpoint | strategy | commands |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const item of [report.operations.approve, report.operations.rollback]) {
    lines.push(
      `| ${item.operation} | ${item.status} | ${item.endpoint || "--"} | ${item.strategy || "--"} | ${item.commandCount} |`
    );
  }
  lines.push("");
  lines.push("## 阻断项");
  lines.push("");
  if (report.blockers.length) {
    report.blockers.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 风险与提示");
  lines.push("");
  if (report.warnings.length) {
    report.warnings.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  report.nextActions.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## 命令明细");
  for (const item of [report.operations.approve, report.operations.rollback]) {
    lines.push("");
    lines.push(`### ${item.operation}`);
    lines.push("");
    lines.push(`- commandTemplate：${item.commandTemplate || "--"}`);
    lines.push(`- requiredContext：${item.requiredContext.length ? item.requiredContext.join(", ") : "--"}`);
    if (item.commands.length) {
      lines.push("");
      lines.push("| drTypeId | drId | tagName | valueSource | valueTransform |");
      lines.push("| --- | --- | --- | --- | --- |");
      item.commands.forEach((command) => {
        lines.push(
          `| ${command.drTypeId || "--"} | ${command.drId || "--"} | ${command.tagName || "--"} | ${command.valueSource || "--"} | ${command.valueTransform || "--"} |`
        );
      });
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

function main() {
  const adminStore = createAdminStore({ dbFile: DB_FILE });
  try {
    const siteConfig = resolveSiteRuntimeConfig(appConfig, adminStore, SITE_ID);
    const report = buildReport(siteConfig);
    writeReport(report);
    process.stdout.write(
      `tower approach control mapping: ${report.conclusion}\njson=${OUTPUT_JSON}\nmarkdown=${OUTPUT_MD}\n`
    );
    if (process.env.TOWER_APPROACH_CONTROL_MAPPING_STRICT === "1" && !report.realDispatchReady) {
      process.exitCode = 1;
    }
  } finally {
    adminStore.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`check-tower-approach-control-mapping failed: ${message}\n`);
  process.exit(1);
}

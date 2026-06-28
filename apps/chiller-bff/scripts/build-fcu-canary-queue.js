import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const PLAN_JSON =
  process.env.FCU_SMALL_BATCH_PLAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json");
const PREFLIGHT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.resolve(DOCS_DIR, "fcu-go-live-preflight-latest.json");
const OUTPUT_JSON =
  process.env.FCU_CANARY_QUEUE_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-queue-latest.json");
const OUTPUT_MD =
  process.env.FCU_CANARY_QUEUE_MD ||
  path.resolve(DOCS_DIR, "fcu-canary-queue-latest.md");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      path: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
}

function readReadyCommand(device, kind) {
  const preview = kind === "fan_speed" ? device?.previews?.fanSpeed : device?.previews?.setpoint;
  if (preview?.decisionStatus !== "ready" || preview.commandCount <= 0) {
    return null;
  }
  const command = Array.isArray(preview.commands) ? preview.commands[0] || null : null;
  if (!command) {
    return null;
  }
  return {
    kind,
    commandType: command.commandType || kind,
    pointKey: command.pointKey || null,
    pointName: command.pointName || null,
    tagName: command.tagName || null,
    value: command.value,
    unit: command.unit ?? null
  };
}

function buildQueue(planFile, preflightFile) {
  const plan = planFile.payload || {};
  const preflight = preflightFile.payload || {};
  const devices = Array.isArray(plan.devices) ? plan.devices : [];
  const queue = devices
    .map((device, index) => {
      const setpoint = readReadyCommand(device, "setpoint");
      const fanSpeed = readReadyCommand(device, "fan_speed");
      const primaryCommand = setpoint || fanSpeed;
      const secondaryCommand = setpoint && fanSpeed ? fanSpeed : null;
      return {
        order: index + 1,
        deviceCode: normalizeText(device.deviceCode),
        deviceName: normalizeText(device.deviceName) || normalizeText(device.deviceCode),
        zoneTemperatureC: device.zoneTemperatureC ?? null,
        setpointC: device.setpointC ?? null,
        running: device.running ?? null,
        primaryCommand,
        secondaryCommand,
        commandCount: [primaryCommand, secondaryCommand].filter(Boolean).length,
        canaryCommandEnv: primaryCommand?.kind === "fan_speed" ? "FCU_CANARY_COMMAND_KIND=fan_speed" : "FCU_CANARY_COMMAND_KIND=setpoint",
        command:
          primaryCommand
            ? `FCU_CANARY_DEVICE_CODE=${normalizeText(device.deviceCode)} FCU_CANARY_COMMAND_KIND=${primaryCommand.kind} FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
            : ""
      };
    })
    .filter((item) => item.deviceCode && item.primaryCommand);
  return {
    ok: queue.length > 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    mode: "sequential_canary_queue",
    controlMutation: false,
    planFile: PLAN_JSON,
    preflightFile: PREFLIGHT_JSON,
    preflightVerdict: preflight.verdict || null,
    preflightOk: preflight.ok === true,
    blockingItems: preflight.blockingItems || [],
    warningItems: preflight.warningItems || [],
    summary: {
      plannedDevices: queue.length,
      readyPrimaryCommands: queue.filter((item) => item.primaryCommand).length,
      readySecondaryCommands: queue.filter((item) => item.secondaryCommand).length,
      firstCanary: queue[0]?.deviceCode || null,
      requiresPreflightGo: true,
      requiresFeedbackBeforeNext: true
    },
    queue,
    evidence: {
      plan: {
        ok: planFile.ok,
        path: planFile.path,
        summary: plan.summary || null
      },
      preflight: {
        ok: preflightFile.ok,
        path: preflightFile.path,
        verdict: preflight.verdict || null
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 逐台 Canary 队列");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 结论: ${report.ok ? "已生成逐台 Canary 队列" : "队列未就绪"}`);
  lines.push(`- 预检: ${report.preflightOk ? "GO" : "NO-GO"} / ${report.preflightVerdict || "--"}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- 队列设备: ${report.summary.plannedDevices}`);
  lines.push(`- 首台 Canary: ${report.summary.firstCanary || "--"}`);
  lines.push(`- 主命令 ready: ${report.summary.readyPrimaryCommands}`);
  lines.push(`- 次命令 ready: ${report.summary.readySecondaryCommands}`);
  lines.push("- 执行要求: 每台先执行主命令，反馈校验通过后才允许进入下一台；次命令在该台主命令反馈正常后执行。");
  lines.push("");
  if (report.blockingItems.length > 0) {
    lines.push("## 当前 P0 阻断");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  lines.push("## 队列");
  lines.push("");
  lines.push("| 顺序 | 设备 | 当前温度 | 当前设定 | 主命令 | 次命令 | 执行命令 |");
  lines.push("|---:|---|---:|---:|---|---|---|");
  for (const item of report.queue) {
    const temp = typeof item.zoneTemperatureC === "number" ? `${item.zoneTemperatureC.toFixed(1)}°C` : "--";
    const setpoint = typeof item.setpointC === "number" ? `${item.setpointC.toFixed(1)}°C` : "--";
    const primary = item.primaryCommand ? `${item.primaryCommand.kind}=${item.primaryCommand.value}` : "--";
    const secondary = item.secondaryCommand ? `${item.secondaryCommand.kind}=${item.secondaryCommand.value}` : "--";
    lines.push(
      `| ${item.order} | ${item.deviceName} ${item.deviceCode} | ${temp} | ${setpoint} | ${primary} | ${secondary} | \`${item.command}\` |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const report = buildQueue(readJsonFile(PLAN_JSON), readJsonFile(PREFLIGHT_JSON));
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  console.log(
    `FCU_CANARY_QUEUE ok=${report.ok} devices=${report.summary.plannedDevices} first=${report.summary.firstCanary || "--"} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}

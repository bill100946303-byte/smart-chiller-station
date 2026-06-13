import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const SOURCE_FILE =
  process.env.OPTIMIZE_DEMO_UI_SOURCE ||
  path.resolve(ROOT_DIR, "apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx");
const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_UI_BOUNDARY_COPY_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-ui-boundary-copy-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_UI_BOUNDARY_COPY_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-ui-boundary-copy-latest.md");
const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.OPTIMIZE_DEMO_UI_BOUNDARY_COPY_STRICT || "").trim().toLowerCase()
);

const REQUIRED_COPY_GROUPS = [
  {
    key: "real_plc_locked",
    label: "真实 PLC 下发锁定",
    anyOf: ["真实 PLC 下发锁定", "真实PLC锁定", "真实 PLC 仍锁定"]
  },
  {
    key: "shadow_only_execution",
    label: "只生成影子记录",
    anyOf: ["审批后只生成影子记录", "当前只处理影子记录", "写入影子记录"]
  },
  {
    key: "no_multi_chiller_single_cop",
    label: "多机不计算单台 COP",
    anyOf: ["不计算多机单台 COP", "不拆分单台主机 COP", "多机运行只评价组合 COP"]
  },
  {
    key: "no_new_plc_dispatch",
    label: "不新增 PLC 下发能力",
    anyOf: ["不新增 PLC 下发能力", "不新增真实 PLC 下发能力"]
  },
  {
    key: "read_only_diagnostics",
    label: "只读诊断",
    anyOf: ["只读诊断", "只读诊断边界", "只做只读诊断"]
  },
  {
    key: "advisor_operational_scope",
    label: "运行诊断覆盖口径",
    anyOf: ["仪表、水力、控制震荡、低温差、冷却塔和主机样本只读诊断", "仪表、水力、低温差、冷却塔和主机样本只读诊断"]
  },
  {
    key: "instrument_drift_v1",
    label: "仪表偏移 V1",
    anyOf: ["仪表偏移 V1"]
  },
  {
    key: "instrument_no_auto_correction",
    label: "不自动修正测点",
    anyOf: ["不自动修正测点"]
  },
  {
    key: "hydraulic_balance_v1",
    label: "水力平衡 V1",
    anyOf: ["水力平衡 V1"]
  },
  {
    key: "hydraulic_no_auto_pump_down",
    label: "不自动降泵",
    anyOf: ["不自动降泵"]
  },
  {
    key: "hydraulic_no_terminal_fault",
    label: "不直接判定末端阀门故障",
    anyOf: ["不直接判定末端阀门故障"]
  },
  {
    key: "control_oscillation_v1",
    label: "控制震荡 V1",
    anyOf: ["控制震荡 V1"]
  },
  {
    key: "control_no_auto_pid",
    label: "不自动改 PID",
    anyOf: ["不自动改 PID"]
  },
  {
    key: "control_no_auto_start_stop",
    label: "不自动启停设备",
    anyOf: ["不自动启停设备", "不自动启停"]
  },
  {
    key: "manual_review_gate",
    label: "人工审阅门禁",
    anyOf: ["人工审阅门禁"]
  },
  {
    key: "shadow_suite_gate",
    label: "140 shadow suite",
    anyOf: ["140 shadow suite"]
  },
  {
    key: "no_control_mutation_gate",
    label: "控制副作用防护",
    anyOf: ["NO_CONTROL_MUTATION", "控制副作用"]
  },
  {
    key: "one_vote_stop_gate",
    label: "一票否决",
    anyOf: ["一票否决", "停止审阅"]
  },
  {
    key: "shadow_verification_record",
    label: "Shadow 验证记录",
    anyOf: ["Shadow 验证记录"]
  },
  {
    key: "shadow_verification_window",
    label: "30-60min 同工况验证",
    anyOf: ["30-60min 同负荷/湿球 band 对比", "30-60 min", "30-60min"]
  },
  {
    key: "manual_recording_boundary",
    label: "人工记录边界",
    anyOf: ["人工记录", "只记录人工审阅后的观察窗口"]
  },
  {
    key: "no_fixed_savings_commitment",
    label: "不承诺固定节能",
    anyOf: ["不作为固定节能承诺", "不代表真实节能结果"]
  },
  {
    key: "append_only_shadow_record",
    label: "append-only 验证记录",
    anyOf: ["append-only 记录", "append-only 审计记录"]
  },
  {
    key: "manual_shadow_record_save",
    label: "保存人工验证记录",
    anyOf: ["保存人工验证记录"]
  },
  {
    key: "shadow_review_append_only",
    label: "补录复核结果",
    anyOf: ["补录复核结果"]
  },
  {
    key: "shadow_review_summary",
    label: "Shadow 复核统计",
    anyOf: ["Shadow 复核统计"]
  },
  {
    key: "readonly_shadow_summary",
    label: "只读统计摘要",
    anyOf: ["只读统计摘要"]
  },
  {
    key: "advisor_type_filter",
    label: "Advisor 类型筛选",
    anyOf: ["Advisor 类型筛选"]
  },
  {
    key: "advisor_type_summary",
    label: "按 Advisor 类型统计",
    anyOf: ["按 Advisor 类型统计"]
  },
  {
    key: "execution_drilldown_filter",
    label: "执行单 ID 下钻",
    anyOf: ["执行单 ID 下钻"]
  },
  {
    key: "execution_drilldown_boundary",
    label: "执行单下钻只读边界",
    anyOf: ["按单个 shadow 执行单查看", "筛选只影响统计和列表，不改变执行单"]
  },
  {
    key: "single_shadow_review_summary",
    label: "单次 shadow 复盘摘要",
    anyOf: ["单次 shadow 复盘摘要"]
  },
  {
    key: "single_shadow_review_boundary",
    label: "单次复盘只读边界",
    anyOf: ["只做审计复盘", "不作为节能结算依据"]
  },
  {
    key: "shadow_review_archive_checksum",
    label: "报告ID/校验码",
    anyOf: ["报告ID/校验码", "报告校验"]
  },
  {
    key: "shadow_review_not_e_signature",
    label: "不是电子签名",
    anyOf: ["不是电子签名"]
  },
  {
    key: "single_shadow_review_report_export",
    label: "导出复盘报告",
    anyOf: ["导出复盘报告"]
  },
  {
    key: "shadow_review_print_style",
    label: "A4 打印样式",
    anyOf: ["A4 打印样式", "打印样式"]
  },
  {
    key: "shadow_review_print_page",
    label: "打开打印版",
    anyOf: ["打开打印版"]
  },
  {
    key: "shadow_review_signature_area",
    label: "甲方/值班员签字确认区",
    anyOf: ["甲方/值班员签字确认区"]
  },
  {
    key: "advisor_type_split",
    label: "主机组合 / 冷却塔 / 泵 Delta-T",
    anyOf: ["主机组合 / 冷却塔 / 泵 Delta-T"]
  },
  {
    key: "shadow_record_audit_export",
    label: "导出审计 CSV",
    anyOf: ["导出审计 CSV"]
  },
  {
    key: "diagnostic_readiness_matrix",
    label: "数据资源与诊断可行性",
    anyOf: ["数据资源与诊断可行性"]
  },
  {
    key: "directional_diagnostics_boundary",
    label: "只能疑似判断",
    anyOf: ["只能疑似判断"]
  },
  {
    key: "point_gap_plan",
    label: "暂不能做",
    anyOf: ["暂不能做"]
  },
  {
    key: "field_verification_checklist",
    label: "现场复核清单",
    anyOf: ["现场复核清单"]
  },
  {
    key: "field_verification_readonly_boundary",
    label: "只读点位/资料补齐",
    anyOf: ["只读点位/资料补齐", "不触发审批、dispatch 或 PLC 写入"]
  },
  {
    key: "no_fault_diagnosis_commitment",
    label: "不判定设备故障",
    anyOf: ["不判定设备故障"]
  },
  {
    key: "client_demo_readiness_gate",
    label: "甲方演示 readiness",
    anyOf: ["甲方演示 readiness", "CLIENT_DEMO_READY_SHADOW_PENDING"]
  }
];

const FORBIDDEN_COPY_PATTERNS = [
  {
    key: "automatic_start_stop",
    label: "自动启停",
    pattern: /(允许|开启|启用|执行|进入|支持|可以|可用)\s*(自动启停|自动开停|自动开机|自动停机)|(自动启停|自动开停|自动开机|自动停机)\s*(已开启|开启|启用|允许|可用|成功)/
  },
  {
    key: "real_plc_dispatch_enabled",
    label: "真实 PLC 下发已开启",
    pattern: /真实\s*PLC\s*下发\s*(已开启|开启|启用|可用|允许|成功|已写入)/
  },
  {
    key: "automatic_dispatch",
    label: "自动下发",
    pattern: /自动下发|自动写入\s*PLC|自动写入\s*SCADA/
  },
  {
    key: "unattended_closed_loop",
    label: "无人值守闭环",
    pattern: /无人值守闭环|无人值守自动控制/
  },
  {
    key: "enforced_enabled",
    label: "enforced 已启用",
    pattern: /enforced\s*(已开启|开启|启用|允许)|进入\s*enforced/
  }
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function findLineNumber(content, needle) {
  const index = content.indexOf(needle);
  if (index < 0) {
    return null;
  }
  return content.slice(0, index).split(/\r?\n/).length;
}

function findPatternLineNumber(content, pattern) {
  const match = pattern.exec(content);
  if (!match) {
    return null;
  }
  return content.slice(0, match.index).split(/\r?\n/).length;
}

function renderMarkdown(report) {
  return `# /optimize-demo UI 边界文案检查

- 结论：${report.finalDecision}
- 源文件：${report.sourceFile}
- 生成时间：${report.generatedAt}

## 必须出现的边界文案

| key | 结果 | 命中文案 | 行号 |
| --- | --- | --- | --- |
${report.required.map((item) => `| ${item.key} | ${item.ok ? "通过" : "缺失"} | ${item.matchedText || "--"} | ${item.lineNumber ?? "--"} |`).join("\n")}

## 禁止出现的承诺文案

| key | 结果 | 命中文案 | 行号 |
| --- | --- | --- | --- |
${report.forbidden.map((item) => `| ${item.key} | ${item.ok ? "通过" : "命中禁语"} | ${item.matchedText || "--"} | ${item.lineNumber ?? "--"} |`).join("\n")}

## 阻断项

${report.blockers.length ? report.blockers.map((item) => `- ${item}`).join("\n") : "- 无"}

## 结论口径

- 本检查是静态 UI 文案检查，不登录、不审批、不 dispatch、不 rollback。
- 它证明源代码中保留了 shadow/read-only/PLC 锁定/多机不拆单机 COP 的可见文案边界。
- 真实页面渲染仍以浏览器 smoke 或人工截图复核为准。
`;
}

function main() {
  const content = fs.readFileSync(SOURCE_FILE, "utf8");
  const normalized = normalizeText(content);
  const blockers = [];

  const required = REQUIRED_COPY_GROUPS.map((group) => {
    const matchedText = group.anyOf.find((candidate) => normalized.includes(normalizeText(candidate))) || null;
    const lineNumber = matchedText ? findLineNumber(content, matchedText) : null;
    if (!matchedText) {
      blockers.push(`缺少 UI 边界文案：${group.label}`);
    }
    return {
      key: group.key,
      label: group.label,
      ok: Boolean(matchedText),
      matchedText,
      lineNumber
    };
  });

  const forbidden = FORBIDDEN_COPY_PATTERNS.map((item) => {
    item.pattern.lastIndex = 0;
    const match = item.pattern.exec(content);
    const matchedText = match?.[0] || null;
    const lineNumber = matchedText ? findPatternLineNumber(content, item.pattern) : null;
    if (matchedText) {
      blockers.push(`UI 出现禁止承诺文案：${item.label}（${matchedText}）`);
    }
    return {
      key: item.key,
      label: item.label,
      ok: !matchedText,
      matchedText,
      lineNumber
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(ROOT_DIR, SOURCE_FILE),
    finalDecision: blockers.length === 0 ? "UI_BOUNDARY_COPY_READY" : "NO_GO",
    required,
    forbidden,
    blockers
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo UI boundary copy: ${report.finalDecision}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (blockers.length) {
    process.stdout.write(`blockers=${blockers.length}\n`);
    blockers.forEach((item) => process.stdout.write(`- ${item}\n`));
  }

  if (STRICT && blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();

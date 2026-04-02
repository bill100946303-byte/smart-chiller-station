import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BFF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  {
    name: "optimize-l3-smoke",
    script: "scripts/check-optimize-l3-smoke.js"
  },
  {
    name: "b25-ui-smoke",
    script: "scripts/check-b25-ui-smoke.js"
  }
];

function runCheck(check) {
  process.stdout.write(`\n[SUITE] start ${check.name}\n`);
  const result = spawnSync("node", [check.script], {
    cwd: BFF_DIR,
    env: process.env,
    stdio: "inherit"
  });
  const code = typeof result.status === "number" ? result.status : 1;
  if (code === 0) {
    process.stdout.write(`[SUITE] pass ${check.name}\n`);
    return true;
  }
  process.stderr.write(`[SUITE] fail ${check.name} (exit=${code})\n`);
  return false;
}

function main() {
  const failed = [];
  for (const check of checks) {
    const ok = runCheck(check);
    if (!ok) {
      failed.push(check.name);
    }
  }

  if (failed.length > 0) {
    process.stderr.write(`\n[SUITE] failed ${failed.length}/${checks.length}: ${failed.join(", ")}\n`);
    process.exit(1);
  }

  process.stdout.write(`\n[SUITE] all passed ${checks.length}/${checks.length}\n`);
}

main();

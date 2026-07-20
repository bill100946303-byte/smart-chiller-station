import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BFF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOULD_ENSURE_RUNTIME_CONFIG = process.env.B25_ENSURE_RUNTIME_CONFIG === "1";
const SHOULD_VERIFY_TOWER_APPROACH_CONTROLS = process.env.B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS === "1";
const REQUIRE_TOWER_APPROACH_CONTROLS = process.env.B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS === "1";

function buildChecks() {
  const checks = [];
  if (SHOULD_ENSURE_RUNTIME_CONFIG) {
    checks.push({
      name: "ensure-runtime-config",
      script: "scripts/ensure-site-runtime-config.js"
    });
  }
  checks.push(
    {
      name: "optimize-l3-smoke",
      script: "scripts/check-optimize-l3-smoke.js"
    },
    {
      name: "b25-ui-smoke",
      script: "scripts/check-b25-ui-smoke.js",
      env: {
        B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS: "0",
        B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS: "0"
      }
    }
  );
  if (SHOULD_VERIFY_TOWER_APPROACH_CONTROLS) {
    checks.push({
      name: "b25-ui-smoke-tower-approach-controls",
      script: "scripts/check-b25-ui-smoke.js",
      env: {
        B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS: "1",
        B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS: REQUIRE_TOWER_APPROACH_CONTROLS ? "1" : "0"
      }
    });
  }
  return checks;
}

function runCheck(check) {
  process.stdout.write(`\n[SUITE] start ${check.name}\n`);
  const result = spawnSync("node", [check.script], {
    cwd: BFF_DIR,
    env: {
      ...process.env,
      ...(check.env || {})
    },
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
  const checks = buildChecks();
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

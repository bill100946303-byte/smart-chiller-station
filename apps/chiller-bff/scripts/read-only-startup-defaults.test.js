import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

for (const relativePath of ["scripts/start_local_stack.sh", "scripts/repair-bff-8787.sh"]) {
  test(`${relativePath} defaults unattended startup to read-only`, () => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.match(source, /READ_ONLY_MODE="\$\{READ_ONLY_MODE:-1\}"/);
    assert.doesNotMatch(source, /READ_ONLY_MODE="\$\{READ_ONLY_MODE:-0\}"/);
  });
}

test("repair health contract rejects a writable BFF when read-only recovery is expected", () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/repair-bff-8787.sh"), "utf8");
  assert.match(source, /payload\.readOnlyMode === expectedReadOnly/);
  assert.match(source, /"\$\{BFF_PORT\}" "\$\{expected_read_only\}"/);
});

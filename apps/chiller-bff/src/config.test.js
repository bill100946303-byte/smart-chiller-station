import test from "node:test";
import assert from "node:assert/strict";

async function readConfigWithReadOnlyMode(value, cacheKey) {
  const previous = process.env.READ_ONLY_MODE;
  try {
    if (value == null) {
      delete process.env.READ_ONLY_MODE;
    } else {
      process.env.READ_ONLY_MODE = value;
    }
    const module = await import(`./config.js?read-only-default=${cacheKey}`);
    return module.config;
  } finally {
    if (previous == null) {
      delete process.env.READ_ONLY_MODE;
    } else {
      process.env.READ_ONLY_MODE = previous;
    }
  }
}

test("BFF defaults to read-only when READ_ONLY_MODE is missing", async () => {
  const loaded = await readConfigWithReadOnlyMode(undefined, "missing");
  assert.equal(loaded.readOnlyMode, true);
});

test("BFF only leaves read-only mode when READ_ONLY_MODE is explicitly false", async () => {
  const loaded = await readConfigWithReadOnlyMode("false", "explicit-false");
  assert.equal(loaded.readOnlyMode, false);
});

test("BFF keeps the safe default for an invalid READ_ONLY_MODE value", async () => {
  const loaded = await readConfigWithReadOnlyMode("unexpected", "invalid");
  assert.equal(loaded.readOnlyMode, true);
});

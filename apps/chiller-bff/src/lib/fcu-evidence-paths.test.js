import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resolveFcuEvidenceDirectory,
  slugifyFcuEvidenceSiteId
} from "./fcu-evidence-paths.js";

test("legacy FCU evidence keeps the configured flat directory", () => {
  assert.equal(resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "126lnoffice"), "/tmp/fcu-evidence");
  assert.equal(resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "126LNOFFICE"), "/tmp/fcu-evidence");
});

test("additional sites receive stable independent FCU evidence directories", () => {
  assert.equal(
    resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "factory-a"),
    path.join("/tmp/fcu-evidence", "sites", "factory-a", "fcu-final-control")
  );
  assert.notEqual(
    resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "factory-a"),
    resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "factory-b")
  );
});

test("unsafe or non-ASCII site identifiers cannot escape the evidence root", () => {
  const siteSlug = slugifyFcuEvidenceSiteId("../华东/一厂");
  const resolved = resolveFcuEvidenceDirectory("/tmp/fcu-evidence", "../华东/一厂");
  assert.equal(siteSlug.includes("/"), false);
  assert.equal(siteSlug.includes(".."), false);
  assert.equal(resolved.startsWith(path.join("/tmp/fcu-evidence", "sites")), true);
  assert.equal(resolved.endsWith(path.join(siteSlug, "fcu-final-control")), true);
});

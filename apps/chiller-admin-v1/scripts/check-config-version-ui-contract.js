import fs from "node:fs";
import path from "node:path";

const ADMIN_ROOT = path.resolve(process.cwd());
const SUBSYSTEM_CONFIG_PAGE_FILE = path.join(ADMIN_ROOT, "src/pages/SubsystemConfigPage.tsx");
const pageSource = fs.readFileSync(SUBSYSTEM_CONFIG_PAGE_FILE, "utf8");

function assertContains(needle, message) {
  if (!pageSource.includes(needle)) {
    throw new Error(message);
  }
}

function assertRegex(regex, message) {
  if (!regex.test(pageSource)) {
    throw new Error(message);
  }
}

assertContains(
  "pad(now.getSeconds())",
  "The default config version id must include seconds, not only minute precision."
);
assertContains(
  "globalThis.crypto.randomUUID().slice(0, 8)",
  "The default config version id must include a cryptographically random suffix when available."
);
assertRegex(
  /const publishedVersionId = versionId\.trim\(\);[\s\S]+?publishConfigVersion\([\s\S]+?publishedVersionId[\s\S]+?setVersionId\(buildVersionId\(\)\)/,
  "Publishing must use the trimmed id and generate a fresh default only after success."
);
assertContains(
  "发布会固化不可变配置快照；每次发布必须使用新版本号",
  "The UI must explain the immutable-version contract to operators."
);

process.stdout.write("config version UI contract passed\n");

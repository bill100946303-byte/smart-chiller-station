import fs from "node:fs";
import path from "node:path";

const SHELL_ROOT = path.resolve(process.cwd());
const APP_FILE = path.join(SHELL_ROOT, "src/App.tsx");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function main() {
  const errors = [];
  const appSource = read(APP_FILE);
  const pageImports = Array.from(
    appSource.matchAll(
      /const\s+(\w+Page)\s*=\s*lazy\(\(\)\s*=>\s*import\("\.\/pages\/(\w+Page)"\)\);/g
    ),
    (match) => ({ componentName: match[1], fileStem: match[2] })
  );

  if (pageImports.length === 0) {
    errors.push("App.tsx: no lazy route-page imports found");
  }

  for (const { componentName, fileStem } of pageImports) {
    if (componentName !== fileStem) {
      errors.push(`${componentName}: lazy import does not match ${fileStem}`);
      continue;
    }

    const pageFile = path.join(SHELL_ROOT, `src/pages/${fileStem}.tsx`);
    if (!fs.existsSync(pageFile)) {
      errors.push(`${componentName}: missing ${path.relative(SHELL_ROOT, pageFile)}`);
      continue;
    }

    const pageSource = read(pageFile);
    const h1Count = (pageSource.match(/<h1(?:\s|>)/g) || []).length;
    if (h1Count !== 1) {
      errors.push(`${componentName}: expected exactly one page-level <h1>, found ${h1Count}`);
    }

    const isWiredToApp = appSource.includes(`renderLazyPage(${componentName})`);
    if (!isWiredToApp) {
      errors.push(`${componentName}: imported page is not wired to a formal route entry`);
    }
  }

  if (errors.length > 0) {
    console.error("Route heading contract check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Route heading contract check passed.");
  console.log(`- checked ${pageImports.length} formal route pages`);
  console.log("- each page owns exactly one semantic H1");
}

main();

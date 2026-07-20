import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const pagesDir = path.join(root, "src/pages");
const errors = [];
let wrapperCount = 0;

for (const fileName of fs.readdirSync(pagesDir).filter((name) => name.endsWith(".tsx"))) {
  const source = fs.readFileSync(path.join(pagesDir, fileName), "utf8");
  const pattern = /<div\b[^>]*className="[^"]*admin-table-(?:shell|scroll)[^"]*"[^>]*>/g;
  for (const match of source.matchAll(pattern)) {
    wrapperCount += 1;
    const tag = match[0];
    if (!tag.includes('role="region"') || !tag.includes("aria-label=") || !tag.includes("tabIndex={0}")) {
      errors.push(`${fileName}: admin table wrapper must be a named keyboard-focusable region`);
    }
  }
}

const styles = fs.readFileSync(path.join(root, "src/styles/global.css"), "utf8");
if (!styles.includes(".admin-table-shell:focus-visible") || !styles.includes(".admin-table-scroll:focus-visible")) {
  errors.push("global.css: admin table regions need visible keyboard focus styles");
}
if (wrapperCount === 0) {
  errors.push("no admin table wrappers were discovered");
}

if (errors.length > 0) {
  console.error("admin table region accessibility contract failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`admin table region accessibility contract: OK (${wrapperCount} regions)`);

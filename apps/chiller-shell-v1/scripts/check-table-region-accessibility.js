import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const pagesDir = path.join(root, "src/pages");
const tableWrapperClasses = [
  "report-record-table-shell",
  "energy-analysis-compact-table-wrap",
  "meter-reading-compact-table-wrap",
  "power-device-table-wrap",
  "work-order-table-shell",
  "environment-compact-table-wrap",
  "knowledge-table-shell",
  "table-scroll-shell",
  "cold-log-table-shell"
];

const errors = [];
for (const fileName of fs.readdirSync(pagesDir).filter((name) => name.endsWith(".tsx"))) {
  const source = fs.readFileSync(path.join(pagesDir, fileName), "utf8");
  for (const className of tableWrapperClasses) {
    const pattern = new RegExp(`<div\\b[^>]*className="[^"]*${className}[^"]*"[^>]*>`, "g");
    for (const match of source.matchAll(pattern)) {
      const tag = match[0];
      if (!tag.includes('role="region"') || !tag.includes("aria-label=") || !tag.includes("tabIndex={0}")) {
        errors.push(`${fileName}: ${className} must be a named keyboard-focusable region`);
      }
    }
  }
}

const styles = fs.readFileSync(path.join(root, "src/styles/global.css"), "utf8");
if (!styles.includes(".report-record-table-shell:focus-visible") || !styles.includes(".table-scroll-shell:focus-visible")) {
  errors.push("global.css: scrollable table regions need visible keyboard focus styles");
}

if (errors.length > 0) {
  console.error("table region accessibility contract failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("table region accessibility contract: OK");
console.log("- named, focusable scroll regions and visible focus state: OK");

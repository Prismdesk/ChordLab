// Copies the finished website from dist/ into this folder, so the repository root IS the published site.
// GitHub Pages ("Deploy from a branch", main, / root) then serves index.html, app.js, app.css and sw.js directly.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const out = "dist";
const copied = [];
for (const name of readdirSync(out)) {
  if (statSync(join(out, name)).isDirectory()) continue;
  copyFileSync(join(out, name), name);
  copied.push(name);
}
console.log(`Published ${copied.length} files to the project root: ${copied.join(", ")}`);

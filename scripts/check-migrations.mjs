#!/usr/bin/env node
// Lint check on db/ migration filenames. Run by CI / by hand.
//
// Rules (see db/README.md):
//   - File names match  /^[0-9]{2}_[a-z][a-z0-9_]*\.sql$/
//   - Numeric prefixes are unique and contiguous starting at 01

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dbDir = path.join(repoRoot, "db");

const files = fs.readdirSync(dbDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const re = /^([0-9]{2})_([a-z][a-z0-9_]*)\.sql$/;

let problems = 0;
const numbers = [];

for (const f of files) {
  const m = re.exec(f);
  if (!m) {
    console.error(`Bad name: ${f}`);
    problems++;
    continue;
  }
  numbers.push(parseInt(m[1], 10));
}

const seen = new Set();
for (const n of numbers) {
  if (seen.has(n)) {
    console.error(`Duplicate number: ${String(n).padStart(2, "0")}`);
    problems++;
  }
  seen.add(n);
}

const sorted = [...seen].sort((a, b) => a - b);
for (let i = 0; i < sorted.length; i++) {
  if (sorted[i] !== i + 1) {
    console.error(
      `Gap in numbering: expected ${String(i + 1).padStart(2, "0")} but next is ${String(sorted[i]).padStart(2, "0")}`,
    );
    problems++;
    break;
  }
}

if (problems) {
  console.error(`\n${problems} problem(s). See db/README.md.`);
  process.exit(1);
}
console.log(`db/: ${files.length} migrations, naming clean.`);

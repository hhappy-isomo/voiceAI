#!/usr/bin/env node
// Detect prompt drift: regenerate the 24 session files into a tmp dir
// and diff against agent/prompts/. Exits non-zero on any difference,
// so CI catches hand-edits that would be wiped by the next regen.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const promptsDir = path.join(repoRoot, "agent", "prompts");
const builder = path.join(repoRoot, "agent", "build_prompts.py");

if (!fs.existsSync(builder)) {
  console.error(`build_prompts.py not found at ${builder}`);
  process.exit(2);
}

const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "prompts-check-"));
const python = process.env.PYTHON || "python3";

const r = spawnSync(python, [builder], {
  env: { ...process.env, PROMPTS_OUT: tmpOut },
  stdio: ["ignore", "inherit", "inherit"],
});
if (r.status !== 0) {
  console.error(`build_prompts.py exited ${r.status}`);
  process.exit(2);
}

const tmpFiles = fs.readdirSync(tmpOut).sort();
const realFiles = fs.readdirSync(promptsDir).filter((f) => f.endsWith(".txt")).sort();

const missing = realFiles.filter((f) => !tmpFiles.includes(f));
const extra = tmpFiles.filter((f) => !realFiles.includes(f));

let drift = 0;
if (missing.length) {
  console.error(`Missing in regen output: ${missing.join(", ")}`);
  drift += missing.length;
}
if (extra.length) {
  console.error(`In regen output but not committed: ${extra.join(", ")}`);
  drift += extra.length;
}

for (const f of tmpFiles) {
  if (!realFiles.includes(f)) continue;
  const a = fs.readFileSync(path.join(promptsDir, f), "utf8");
  const b = fs.readFileSync(path.join(tmpOut, f), "utf8");
  if (a !== b) {
    drift++;
    console.error(`Drift in ${f}:`);
    try {
      execSync(`diff -u "${path.join(promptsDir, f)}" "${path.join(tmpOut, f)}" | head -40`, {
        stdio: "inherit",
      });
    } catch {
      // diff exits 1 when files differ — expected
    }
  }
}

fs.rmSync(tmpOut, { recursive: true, force: true });

if (drift) {
  console.error(
    `\n${drift} drift item(s). Run \`python3 agent/build_prompts.py\` to regenerate.`,
  );
  process.exit(1);
}
console.log(`agent/prompts/ matches build_prompts.py output (${realFiles.length} files).`);

#!/usr/bin/env node
/* BuiltDiff Step 3: copy curriculum/*.json -> frontend/public/problems/** (paths preserved).
 * Run via: npm run build:manifest
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'curriculum');
const DEST = path.join(ROOT, 'frontend', 'public', 'problems');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function main() {
  const files = walk(SRC);
  let copied = 0;
  for (const src of files) {
    const rel = path.relative(SRC, src);
    const dest = path.join(DEST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied += 1;
  }
  console.log(`problems: ${copied} files -> frontend/public/problems/`);
}

main();

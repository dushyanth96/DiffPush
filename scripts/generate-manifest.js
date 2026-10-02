#!/usr/bin/env node
/* BuiltDiff Step 1: ingest curriculum/*.json -> frontend/public/curriculum_manifest.json
 * Usage: npm run build:manifest  (from frontend/)
 * Defensive: missing/differently-named fields fall back to null/[] — never crashes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CURRICULUM_DIR = path.join(ROOT, 'curriculum');
const OUT_FILE = path.join(ROOT, 'frontend', 'public', 'curriculum_manifest.json');

  const DIFFICULTY_LABEL = { Easy: 'Baseline', Medium: 'Standard Bar', Hard: 'DiffPush Tier' };
const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

const pick = (obj, keys, fallback = null) => {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
};

const slugifyTopic = (raw) => {
  if (!raw) return 'unknown';
  return String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

const topicName = (raw) => {
  if (!raw) return 'Unknown';
  const stripped = String(raw).replace(/^[0-9]+[._-]+/, '');
  return stripped.replace(/[_-]+/g, ' ').trim() || 'Unknown';
};

// Level = immediate subfolder inside the topic dir (e.g. "1.Easy", "2.1D_DP").
// Humanize: strip numeric prefix, prettify separators. Order: leading number.
const levelOrderOf = (dirName) => {
  const m = String(dirName ?? '').match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
};

const levelNameOf = (dirName) => {
  if (!dirName) return 'General';
  const stripped = String(dirName).replace(/^\d+[._-]+/, '');
  return stripped.replace(/[_-]+/g, ' ').trim() || String(dirName);
};

function walkJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

function summarize(file, data) {
  const canonical = pick(data, ['canonical'], {});
  const narrative = pick(data, ['narrative'], {});
  const complexity = pick(data, ['complexity'], {});
  const aiContext = pick(data, ['aiContext'], {});
  const rawDiff = pick(data, ['difficulty', 'level', 'tier'], 'Unknown');
  const topicRaw = pick(data, ['topic', 'module', 'category'], 'unknown');

  const testCases = Array.isArray(data.testCases) ? data.testCases : [];
  const starter = data.starterCode && typeof data.starterCode === 'object' ? data.starterCode : {};
  const tags = Array.isArray(aiContext.intentTags)
    ? aiContext.intentTags
    : Array.isArray(data.tags) ? data.tags : [];

  // Level derived from folder: curriculum/<topic>/<level>/<file>.json
  const relParts = path.relative(CURRICULUM_DIR, file).split(path.sep);
  const levelDir = relParts.length > 2 ? relParts[relParts.length - 2] : null;

  return {
    id: pick(data, ['id', 'slug'], path.basename(file, '.json')),
    index: Number.isFinite(Number(pick(data, ['index', 'order', 'sequence'], NaN)))
      ? Number(pick(data, ['index', 'order', 'sequence']))
      : null,
    topic: slugifyTopic(topicRaw),
    topicName: topicName(topicRaw),
    level: levelDir,
    levelName: levelNameOf(levelDir),
    levelOrder: levelOrderOf(levelDir),
    title: pick(narrative, ['title', 'storyTitle', 'scenario'], null),
    canonicalTitle: pick(canonical, ['title', 'name'], null),
    difficulty: DIFFICULTY_LABEL[rawDiff] ?? rawDiff,
    difficultyRaw: rawDiff,
    optimalTime: pick(complexity, ['optimalTime', 'time', 'timeComplexity'], null),
    optimalSpace: pick(complexity, ['optimalSpace', 'space', 'spaceComplexity'], null),
    tags,
    hintLevels: Array.isArray(aiContext.hintLevels) ? aiContext.hintLevels.length : 0,
    testCaseCounts: {
      total: testCases.length,
      public: testCases.filter((t) => t && t.isPublic).length,
      hidden: testCases.filter((t) => !(t && t.isPublic)).length,
    },
    starterLangs: Object.keys(starter),
    // Client-fetchable path (Step 3 asset pipeline mirrors curriculum/ -> public/problems/).
    filePath: '/problems/' + path.relative(CURRICULUM_DIR, file).split(path.sep).join('/'),
    sourcePath: path.relative(ROOT, file).split(path.sep).join('/'),
  };
}

function main() {
  if (!fs.existsSync(CURRICULUM_DIR)) {
    console.error(`curriculum dir missing: ${CURRICULUM_DIR}`);
    process.exit(1);
  }
  const files = walkJsonFiles(CURRICULUM_DIR);
  const problems = [];
  const skipped = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      problems.push(summarize(file, data && typeof data === 'object' ? data : {}));
    } catch (err) {
      skipped.push({ file: path.relative(ROOT, file), error: err.message });
    }
  }
  problems.sort((a, b) =>
    a.topic.localeCompare(b.topic) ||
    (a.levelOrder ?? 999) - (b.levelOrder ?? 999) ||
    (DIFFICULTY_ORDER[a.difficultyRaw] ?? 99) - (DIFFICULTY_ORDER[b.difficultyRaw] ?? 99) ||
    (a.index ?? 9999) - (b.index ?? 9999) ||
    a.id.localeCompare(b.id)
  );

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(problems, null, 2) + '\n');
  console.log(`manifest: ${problems.length} problems from ${files.length} files -> ${path.relative(ROOT, OUT_FILE)}`);
  if (skipped.length) {
    console.warn(`skipped ${skipped.length} unreadable file(s):`);
    skipped.forEach((s) => console.warn(`  - ${s.file}: ${s.error}`));
  }
}

main();

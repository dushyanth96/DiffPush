#!/usr/bin/env node
/* BuiltDiff SEO: prerender one static HTML page per problem + sitemap.xml.
 * Runs AFTER `vite build` (vite empties dist/, so this must come second).
 * Output: dist/solve/<slug>/index.html (369 pages), dist/sitemap.xml
 * Each page carries OG tags, narrative, Big-O, public examples, and a
 * canonical link into the app. No fake content — straight from curriculum JSON.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const PROBLEMS = path.join(ROOT, 'frontend', 'public', 'problems');
const MANIFEST = path.join(ROOT, 'frontend', 'public', 'curriculum_manifest.json');
const SITE = 'https://diffpush.com';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function page(meta, full) {
  const title = `${meta.canonicalTitle} | DiffPush`;
  const desc = `${meta.title ?? ''} — ${meta.optimalTime ?? ''} time, ${meta.optimalSpace ?? ''} space. Solve in your browser, auto-commit to GitHub.`;
  const url = `${SITE}/solve/${meta.id}/`;
  const appUrl = `/#/solve/${meta.id}`;
  const pub = (full.testCases ?? []).filter((t) => t.isPublic).slice(0, 3);
  const examples = pub.map((t, i) =>
    `<h3>Example ${i + 1}</h3><pre>Input: ${esc(JSON.stringify(t.input))}\nOutput: ${esc(JSON.stringify(t.expected))}${t.explanation ? `\n${esc(t.explanation)}` : ''}</pre>`).join('\n');
  const constraints = (full.narrative?.constraints ?? []).map((c) => `<li><code>${esc(c)}</code></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<style>body{background:#07090E;color:#E6EAF2;font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 16px;line-height:1.6}a{color:#10B981}pre{background:#0D111A;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;overflow-x:auto;font-size:13px}code{font-family:monospace}.cta{display:inline-block;background:#10B981;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0}.pill{display:inline-block;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:2px 10px;font-size:12px;color:#94A3B8;margin-right:6px}</style>
</head>
<body>
  <p><a href="/">← DiffPush</a></p>
<h1>${esc(full.canonical?.title ?? meta.canonicalTitle)}</h1>
<p><span class="pill">${esc(meta.difficulty)}</span> <span class="pill">${esc(meta.topicName)} · ${esc(meta.levelName)}</span> <span class="pill">${esc(meta.optimalTime)} · ${esc(meta.optimalSpace)}</span></p>
<h2>${esc(full.narrative?.title ?? '')}</h2>
<p>${esc(full.narrative?.scenario ?? '')}</p>
<p><strong>Input:</strong> ${esc(full.narrative?.inputFormat ?? '')}</p>
<p><strong>Output:</strong> ${esc(full.narrative?.outputFormat ?? '')}</p>
${constraints ? `<h2>Constraints</h2><ul>${constraints}</ul>` : ''}
${examples ? `<h2>Examples</h2>${examples}` : ''}
<p><a class="cta" href="${appUrl}">Solve this in your browser →</a></p>
<p><a href="${esc(full.canonical?.leetcodeSearch ?? 'https://leetcode.com/problemset/all/')}">Also on LeetCode ↗</a></p>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ missing — run `vite build` first.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  let n = 0;
  const urls = [`${SITE}/`];
  for (const meta of manifest) {
    const src = path.join(PROBLEMS, meta.filePath.replace('/problems/', ''));
    if (!fs.existsSync(src)) continue;
    const full = JSON.parse(fs.readFileSync(src, 'utf8'));
    const dir = path.join(DIST, 'solve', meta.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page(meta, full));
    urls.push(`${SITE}/solve/${meta.id}/`);
    n += 1;
  }
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sm);
  console.log(`prerender: ${n} problem pages + sitemap (${urls.length} urls)`);
}

main();

#!/usr/bin/env node
/* Submit the built sitemap to IndexNow (Bing, Yandex, and partners).
 * Usage: `npm run build` then `npm run seo:indexnow`.
 * Preview without submitting: `npm run seo:indexnow -- --dry-run`.
 * The key file lives at frontend/public/<key>.txt and is copied into dist/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const SITE = process.env.SITE_URL || 'https://diffpush.pages.dev';
const KEY = process.env.INDEXNOW_KEY || '2c0a6731f10ca25790b11b5b2dd82eac';
const SITEMAP = path.join(DIST, 'sitemap.xml');

if (!fs.existsSync(SITEMAP)) {
  console.error('dist/sitemap.xml missing — run `npm run build` first.');
  process.exit(1);
}

const sitemap = fs.readFileSync(SITEMAP, 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!urlList.length) {
  console.error('No <loc> entries found in dist/sitemap.xml.');
  process.exit(1);
}

const payload = {
  host: new URL(SITE).host,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList,
};

if (process.argv.includes('--dry-run') || process.env.DRY_RUN === '1') {
  console.log(`IndexNow dry run: ${urlList.length} URLs, host ${payload.host}, key ${KEY}`);
  console.log(urlList.slice(0, 5).join('\n'));
  process.exit(0);
}

(async () => {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => '');
  console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URLs${text ? ` — ${text.slice(0, 300)}` : ''}`);
  if (!res.ok) process.exitCode = 1;
})().catch((err) => {
  console.error(`IndexNow request failed: ${err.message}`);
  process.exitCode = 1;
});

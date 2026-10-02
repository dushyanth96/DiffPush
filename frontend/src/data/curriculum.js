// In-memory manifest engine over /curriculum_manifest.json (built by
// `npm run build:manifest`). Single fetch, cached, then zero-latency lookups.
// Call loadManifest() once at app startup; all getters below are synchronous.
let cache = null;
let byId = new Map();

export async function loadManifest() {
  if (cache) return cache;
  const res = await fetch('/curriculum_manifest.json');
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  cache = await res.json();
  byId = new Map(cache.map((p) => [p.id, p]));
  return cache;
}

function requireLoaded() {
  if (!cache) throw new Error('manifest not loaded — call loadManifest() first');
  return cache;
}

export function getProblems() { return requireLoaded(); }
export function getProblemMeta(id) { requireLoaded(); return byId.get(id) ?? null; }

export function getTopics() {
  const map = new Map();
  for (const p of requireLoaded()) {
    if (!map.has(p.topic)) map.set(p.topic, { id: p.topic, name: p.topicName, total: 0 });
    map.get(p.topic).total += 1;
  }
  return [...map.values()];
}

export function getByTopic(topic, difficulty = null) {
  return requireLoaded().filter(
    (p) => p.topic === topic && (!difficulty || p.difficulty === difficulty || p.difficultyRaw === difficulty)
  );
}

export function searchProblems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return requireLoaded().filter(
    (p) =>
      (p.canonicalTitle ?? '').toLowerCase().includes(q) ||
      (p.title ?? '').toLowerCase().includes(q) ||
      p.id.includes(q) ||
      p.tags.some((t) => t.includes(q))
  ).slice(0, 50);
}

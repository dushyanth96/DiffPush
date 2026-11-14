import { get, set, del } from 'idb-keyval'

// Custom sheet store: user-imported problem lists (Striver's sheet, college
// sheets, NeetCode lists — any JSON with {name, problems}). Stored entirely
// in IndexedDB, one key per sheet plus a tiny index for the list view.
// Imported problems are external links (they don't ship statements/tests),
// so progress is tracked per-sheet and never touches the A2Z tracker.
const KEY_PREFIX = 'builtdiff:sheet:'
const INDEX_KEY = 'builtdiff:sheets-index'

const MAX_SHEETS = 20
const MAX_PROBLEMS = 2000

const slugify = (s) =>
  String(s || 'sheet').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sheet'

const problemId = (p) =>
  String(p.id || p.title || p.link || 'problem')
    .toLowerCase().trim().replace(/\s+/g, '-').slice(0, 80)

// Accepts a scraped/exported sheet shape and normalizes it. Everything is
// optional except a title or link per problem.
function normalizeProblems(raw) {
  const list = Array.isArray(raw) ? raw : raw?.problems ?? raw?.questions
  if (!Array.isArray(list)) throw new Error('JSON must contain a "problems" array')
  if (list.length === 0) throw new Error('Sheet has no problems')
  if (list.length > MAX_PROBLEMS) throw new Error(`Too many problems (${list.length} — cap is ${MAX_PROBLEMS})`)

  const seen = new Set()
  const out = []
  for (const item of list) {
    if (typeof item === 'string') item = { title: item }
    if (!item || typeof item !== 'object') continue
    const title = String(item.title ?? item.name ?? item.problem ?? '').trim()
    const link = String(item.link ?? item.url ?? item.href ?? '').trim()
    if (!title && !link) continue
    const id = problemId({ title, link })
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      title: title || link,
      link: link || `https://www.google.com/search?q=${encodeURIComponent(title + ' dsa problem')}`,
      topic: String(item.topic ?? item.topicName ?? 'Imported').trim(),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : null,
      note: String(item.note ?? item.notes ?? '').trim() || null,
    })
  }
  if (!out.length) throw new Error('No usable problems found (each needs a title or link)')
  return out
}

export async function listSheets() {
  const index = (await get(INDEX_KEY)) ?? []
  const sheets = await Promise.all(index.map((slug) => get(KEY_PREFIX + slug).catch(() => null)))
  return sheets.filter(Boolean).map((s) => ({
    slug: s.slug,
    name: s.name,
    createdAt: s.createdAt,
    count: s.problems.length,
    solved: Object.keys(s.solvedMap ?? {}).length,
  }))
}

export async function getSheet(slug) {
  return get(KEY_PREFIX + slug).catch(() => null)
}

// Returns { slug, count } for the stored sheet. Slug is derived from the name
// (re-imports under the same name replace the previous version — that's the
// update path, deliberate and simple).
export async function importSheet({ name, problems }) {
  const list = normalizeProblems(problems)
  const cleanName = String(name ?? 'Imported sheet').trim().slice(0, 80) || 'Imported sheet'
  const slug = slugify(cleanName)

  const index = (await get(INDEX_KEY)) ?? []
  if (!index.includes(slug) && index.length >= MAX_SHEETS) {
    throw new Error(`Sheet limit reached (${MAX_SHEETS}) — delete one first`)
  }

  const sheet = {
    slug,
    name: cleanName,
    createdAt: Date.now(),
    problems: list,
    solvedMap: (await getSheet(slug))?.solvedMap ?? {},
  }
  await set(KEY_PREFIX + slug, sheet)
  if (!index.includes(slug)) {
    index.push(slug)
    await set(INDEX_KEY, index)
  }
  return { slug, count: list.length }
}

export async function deleteSheet(slug) {
  await del(KEY_PREFIX + slug)
  const index = (await get(INDEX_KEY)) ?? []
  await set(INDEX_KEY, index.filter((s) => s !== slug))
}

// Per-sheet solved flag — independent of the A2Z tracker on purpose.
export async function setSheetSolved(slug, problemId, solved) {
  const sheet = await getSheet(slug)
  if (!sheet) return
  const solvedMap = { ...sheet.solvedMap }
  if (solved) solvedMap[problemId] = { solvedAt: Date.now() }
  else delete solvedMap[problemId]
  await set(KEY_PREFIX + slug, { ...sheet, solvedMap })
}

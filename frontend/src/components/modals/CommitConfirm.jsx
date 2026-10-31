import React, { useEffect, useMemo } from 'react'
import { GitCommitHorizontal, FileCode2, X, ExternalLink, AlertTriangle } from 'lucide-react'

// Minimal line diff (LCS). Enough to show exactly what the commit changes
// without pulling a diff library into the bundle.
function lineDiff(before = '', after = '') {
  const a = before ? before.split('\n') : []
  const b = after ? after.split('\n') : []
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'ctx', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++ }
    else { out.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < n) { out.push({ type: 'del', text: a[i++] }) }
  while (j < m) { out.push({ type: 'add', text: b[j++] }) }
  return out
}

const TONE = {
  add: 'text-diff-emerald bg-diff-emerald/10',
  del: 'text-rose-300 bg-rose-500/10',
  ctx: 'text-slate-500',
}
const SIGN = { add: '+', del: '−', ctx: ' ' }

export function CommitConfirm({
  login, repo = 'diffpush-solutions', path, code, existing, loading, committing, error,
  connected, onConfirm, onCancel, onConnect,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !committing) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, committing])

  const existingContent = existing?.content ?? ''
  const isNewFile = !loading && !existingContent
  const diff = useMemo(() => lineDiff(existingContent, code ?? ''), [existingContent, code])
  const lines = useMemo(() => {
    // Context-only files can be long: keep the first and last 120 diff lines.
    if (diff.length <= 240) return diff
    return [...diff.slice(0, 120), { type: 'ctx', text: `… ${diff.length - 240} unchanged lines …`, skip: true }, ...diff.slice(-120)]
  }, [diff])

  const repoUrl = login ? `https://github.com/${login}/${repo}` : null
  const fileUrl = login && path ? `${repoUrl}/blob/main/${path}` : null

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 p-3 sm:p-4" onClick={committing ? undefined : onCancel} role="dialog" aria-modal="true" aria-labelledby="commit-title">
      <div className="card w-full max-w-2xl !bg-popover overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="w-9 h-9 rounded-md bg-diff-emerald/10 hairline flex items-center justify-center text-diff-emerald shrink-0">
            <GitCommitHorizontal size={17} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">GitHub commit</p>
            <h2 id="commit-title" className="text-[16px] font-bold text-slate-100 mt-0.5">Review before pushing</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">This is the only step that writes to your repository.</p>
          </div>
          <button onClick={onCancel} disabled={committing} aria-label="Cancel commit" className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised shrink-0 disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="px-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
            <div className="bg-surface hairline rounded-md p-2.5 min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Repository</dt>
              <dd className="mt-1 font-mono text-slate-200 truncate">
                {repoUrl ? (
                  <a href={repoUrl} target="_blank" rel="noreferrer" className="hover:text-diff-emerald inline-flex items-center gap-1 max-w-full">
                    <span className="truncate">{login}/{repo}</span> <ExternalLink size={11} className="shrink-0" />
                  </a>
                ) : 'Connect GitHub first'}
              </dd>
            </div>
            <div className="bg-surface hairline rounded-md p-2.5 min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Branch</dt>
              <dd className="mt-1 font-mono text-slate-200">main</dd>
            </div>
            <div className="bg-surface hairline rounded-md p-2.5 sm:col-span-2 min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">File path</dt>
              <dd className="mt-1 font-mono text-slate-200 break-all flex items-center gap-1.5">
                <FileCode2 size={12} className="text-slate-500 shrink-0" />
                {loading ? 'checking existing file…' : path}
              </dd>
            </div>
          </dl>
        </div>

        <div className="px-5 mt-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-slate-400">Code change</p>
            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${isNewFile ? 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10' : 'text-diff-amber border-diff-amber/30 bg-diff-amber/10'}`}>
              {loading ? '…' : isNewFile ? 'new file' : 'update'}
            </span>
            <span className="ml-auto font-mono text-[10px] text-slate-500">
              +{diff.filter((d) => d.type === 'add').length} / −{diff.filter((d) => d.type === 'del').length}
            </span>
          </div>
          <div className="mt-1.5 rounded-md hairline bg-[#07090E] max-h-[38vh] overflow-auto">
            <pre className="p-3 font-mono text-[11px] leading-[1.6]">
              {lines.map((d, i) => (
                <div key={i} className={d.skip ? 'text-slate-600 italic' : TONE[d.type]}>
                  <span className="inline-block w-4 shrink-0 select-none opacity-70">{SIGN[d.type]}</span>
                  {d.text || ' '}
                </div>
              ))}
            </pre>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
            Also updates <span className="font-mono">.builtdiff/tracker.json</span> and the repo README with your progress.
          </p>
        </div>

        {error && (
          <p className="mx-5 mt-3 flex items-start gap-1.5 text-[12px] text-diff-amber">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 p-5">
          {connected ? (
            <>
              <button onClick={onConfirm} disabled={loading || committing} className="btn-emerald sm:order-2 sm:ml-auto px-4 h-10 rounded-md text-[13px] font-semibold disabled:opacity-60">
                {committing ? 'Committing…' : 'Commit to GitHub'}
              </button>
              <button onClick={onCancel} disabled={committing} className="btn-ghost px-4 h-10 rounded-md text-[13px] font-medium text-slate-300 disabled:opacity-60">
                Keep local only
              </button>
            </>
          ) : (
            <>
              <button onClick={onConnect} className="btn-emerald sm:order-2 sm:ml-auto px-4 h-10 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2">
                <GitCommitHorizontal size={14} /> Connect GitHub
              </button>
              <button onClick={onCancel} className="btn-ghost px-4 h-10 rounded-md text-[13px] font-medium text-slate-300">
                Keep local only
              </button>
            </>
          )}
        </div>
        {fileUrl && (
          <p className="px-5 pb-4 -mt-2 font-mono text-[10px] text-slate-600 truncate">
            Current file: <a href={fileUrl} target="_blank" rel="noreferrer" className="hover:text-slate-400">{path}</a>
          </p>
        )}
      </div>
    </div>
  )
}

import React from 'react'

// Last line of defence: a render error in any view shows a readable fallback
// instead of a blank white page. Local data is untouched — progress, drafts,
// and the GitHub token stay in the browser.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('DiffPush crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-canvas text-slate-200 flex items-center justify-center px-4">
        <div className="card p-8 max-w-[520px] w-full text-center">
          <p className="font-mono text-[11px] tracking-wider text-diff-emerald">RUNTIME ERROR</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-100">Something broke in the renderer.</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            Your solutions, progress, and GitHub token are saved on this device and were not affected.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-surface hairline p-3 text-left font-mono text-[11px] text-slate-400 whitespace-pre-wrap break-words">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => window.location.reload()} className="btn-emerald px-4 h-10 rounded-md text-[13px] font-semibold">
              Reload app
            </button>
            <button onClick={() => { window.location.href = '/' }} className="btn-ghost px-4 h-10 rounded-md text-[13px] font-medium text-slate-200">
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}

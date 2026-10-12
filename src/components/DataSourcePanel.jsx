import { useState, useEffect, useCallback } from 'react'

// Where the app's data actually lives. The sheet is hand-editable, so this panel exists to make
// that visible — which sheet, whether the app can reach it, and what to do after editing it by hand.
export default function DataSourcePanel() {
  const [info, setInfo] = useState(null)   // null = loading
  const [error, setError] = useState(null)

  const check = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch('/api/budget?resource=data-source', { credentials: 'include' })
      const body = await r.json().catch(() => null)
      if (!r.ok) { setError(body?.error || `Check failed (${r.status})`); setInfo(null); return }
      setInfo(body)
    } catch (e) {
      setError(e.message)
      setInfo(null)
    }
  }, [])

  useEffect(() => { check() }, [check])

  const ok = info?.ok
  const problems = info?.problems || []

  return (
    <div className="space-y-3">
      <div className="bg-nb-750 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Google Sheet</h3>
          <button
            onClick={check}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-nb-700 hover:bg-nb-600 text-slate-300 transition-colors">
            Re-check
          </button>
        </div>

        {info === null && !error && <p className="text-xs text-slate-500">Checking the connection…</p>}

        {error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {info && (
          <>
            <div className={`rounded-lg px-3 py-2 text-xs mb-3 ${ok
              ? 'bg-emerald-950/30 border border-emerald-800/40 text-emerald-300/90'
              : 'bg-amber-950/30 border border-amber-800/50 text-amber-300/90'}`}>
              {ok
                ? <><strong>Connected.</strong> Every tab and column the app needs is present.</>
                : <><strong>The sheet needs attention.</strong> Run <code className="font-mono">node --env-file=.env.local scripts/sheet-sync.mjs init</code> to add what&rsquo;s missing.</>}
            </div>

            {problems.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1 mb-3">
                {problems.map(p => (
                  <li key={p.tab}>
                    <span className="text-slate-300 font-medium">{p.tab}</span>
                    {p.missing === 'tab' ? ' — tab is missing' : ` — missing column(s): ${p.columns.join(', ')}`}
                  </li>
                ))}
              </ul>
            )}

            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-neuro-400 hover:text-neuro-300 transition-colors">
              Open the sheet
              <span aria-hidden="true">↗</span>
            </a>
          </>
        )}
      </div>

      <div className="bg-nb-750 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Editing the sheet</h3>
        <ul className="text-xs text-slate-400 space-y-2">
          <li>
            Columns are matched by <span className="text-slate-300">header name</span>, so you can reorder them or
            add your own. 
          </li>
          <li>
            The app is <span className="text-slate-300">read-only</span> — it never writes to the sheet. Make changes
            in the sheet and reload the app to see them.
          </li>
          <li>
            Anything the app doesn&rsquo;t recognise is preserved in each tab&rsquo;s{' '}
            <span className="text-slate-300">Extra</span> column, and tabs it doesn&rsquo;t know about
            (Summary, Dashboard, Pots, Guide, Lists) are left entirely alone.
          </li>
        </ul>
      </div>
    </div>
  )
}

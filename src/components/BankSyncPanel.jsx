import { useState, useEffect, useCallback } from 'react'

// ── helpers ───────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const s = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

function daysUntil(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.round((then - Date.now()) / 86_400_000)
}

function Cmd({ children }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }
  return (
    <div className="flex items-stretch gap-2 mt-1.5">
      <code className="flex-1 min-w-0 overflow-x-auto whitespace-pre bg-nb-900 border border-nb-600 rounded-lg px-3 py-2 text-xs text-cyan-300 tabular-nums">
        {children}
      </code>
      <button onClick={copy}
        className="flex-shrink-0 text-xs px-2.5 rounded-lg border border-nb-500 text-slate-400 hover:text-slate-100 hover:border-nb-400 transition-colors">
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

function StepDot({ done }) {
  return done
    ? <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-900/50 border border-emerald-600 text-emerald-400 text-xs flex items-center justify-center">✓</span>
    : <span className="flex-shrink-0 w-5 h-5 rounded-full bg-nb-700 border border-nb-500 text-slate-500 text-xs flex items-center justify-center">○</span>
}

function BankStatus({ label, colour, bank }) {
  const connected = bank?.connected
  const reDays = daysUntil(bank?.reauthDueAt)
  return (
    <div className="flex items-center justify-between bg-nb-800 border border-nb-600 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: connected ? colour : '#64748b' }} />
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {typeof bank?.count === 'number' && (
          <span className="text-xs text-slate-500 tabular-nums">· {bank.count} txns</span>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-medium ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </div>
        {connected && reDays != null && (
          <div className={`text-xs tabular-nums ${reDays <= 7 ? 'text-amber-400' : 'text-slate-500'}`}>
            re-approve in {reDays}d
          </div>
        )}
      </div>
    </div>
  )
}

// ── panel ─────────────────────────────────────────────────────────────
export default function BankSyncPanel() {
  const [tokens, setTokens] = useState([])
  const [status, setStatus] = useState(null)     // sync-status blob (null until loaded / never synced)
  const [newToken, setNewToken] = useState(null) // plaintext shown once after creation
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [apiReady, setApiReady] = useState(null)  // null = not checked yet
  const [apiIssue, setApiIssue] = useState(null)  // why the probe failed, when it did

  const load = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/budget?resource=sync-token', { credentials: 'include' }),
        fetch('/api/budget?resource=sync-status', { credentials: 'include' }),
      ])
      // Probe the token route. Each failure mode needs a different fix, so name which one it is
      // rather than reporting a generic "not ready".
      if (tRes.ok) {
        // A deployment without this route ignores ?resource and answers with the budget blob
        // instead. An array means the route exists; anything else means it does not.
        const body = await tRes.json()
        if (Array.isArray(body)) {
          setTokens(body); setApiReady(true); setApiIssue(null)
        } else {
          setApiReady(false)
          setApiIssue({ kind: 'stale-deployment' })
        }
      } else {
        let detail = null
        try { detail = (await tRes.json())?.error } catch { /* not JSON */ }
        setApiReady(false)
        setApiIssue({
          kind: tRes.status === 401 || tRes.status === 403 ? 'auth'
              : tRes.status >= 500 ? 'server'
              : 'http',
          status: tRes.status,
          detail,
        })
      }
      if (sRes.ok) setStatus(await sRes.json())
    } catch {
      setError('Could not load bank-sync status.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createToken = async () => {
    // Never POST against a deployment lacking the route: it would write this request body
    // over the budget blob and answer 200.
    if (apiReady === false) {
      setError('The deployed API does not have the sync-token route yet — deploy step 1 first. (Sending this request to an older deployment would overwrite your budget.)')
      return
    }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/budget?resource=sync-token', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bank sync agent' }),
      })
      // Surface the real reason rather than silently doing nothing.
      let data = null
      try { data = await r.json() } catch { /* non-JSON (e.g. HTML error page) */ }
      if (!r.ok) {
        const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`
        setError(`Could not create token: ${msg}${r.status === 401 || r.status === 403 ? ' — are you logged in (with MFA)?' : ''}`)
        return
      }
      if (!data || !data.token) {
        // 200 but no token means an older backend handled this route (or the DB isn't migrated).
        setError('The server responded but returned no token. The latest API may not be deployed, or the `api_tokens` table has not been created yet.')
        return
      }
      setNewToken(data.token)
      await load()
    } catch (e) {
      setError(`Could not reach the server: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const revokeToken = async (id) => {
    setBusy(true); setError(null)
    try {
      await fetch(`/api/budget?resource=sync-token&id=${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (newToken) setNewToken(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const hasToken = tokens.length > 0
  // The agent posts back to this app, so the URL it needs is wherever you are reading this.
  const appUrl = window.location.origin
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(appUrl)
  const starling = status?.banks?.starling
  const monzo = status?.banks?.monzo
  const freshness = timeAgo(status?.syncedAt)

  return (
    <div className="space-y-4">
      {/* ── How it works ── */}
      <div className="bg-nb-750 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Bank Sync — how it works</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-3">
          A small helper runs on <strong className="text-slate-300">your Mac</strong>. On a schedule it pulls your
          latest Monzo &amp; Starling transactions and categorises them with an AI model running
          <strong className="text-slate-300"> on your machine (Ollama)</strong> — your transactions are
          <strong className="text-slate-300"> never sent to a third-party AI</strong>. It then saves the finished
          results to your private storage, so when you open the app everything is already up to date.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-3">
          {['Your Mac fetches your banks', 'On-device AI categorises', 'Results pushed to the app', 'You open the app → fresh'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="bg-nb-800 border border-nb-600 rounded-lg px-2.5 py-1.5">{s}</span>
              {i < arr.length - 1 && <span className="text-slate-600">→</span>}
            </span>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2 text-emerald-300/90">
            <strong>Stays on your Mac:</strong> your bank credentials and the AI model. Nothing about how your
            transactions are categorised leaves your machine.
          </div>
          <div className="bg-nb-800 border border-nb-600 rounded-lg px-3 py-2 text-slate-400">
            <strong className="text-slate-300">Leaves your Mac:</strong> only the finished, categorised transactions
            and pot balances — saved to your own private cloud storage, behind your login (never to any AI provider).
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Note: Monzo requires you to re-approve access in the Monzo app roughly every 90 days (a banking rule, not us).
          Starling’s token does not expire.
        </p>
      </div>

      {/* ── Status dashboard ── */}
      <div className="bg-nb-750 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Status</h3>
          <span className="text-xs text-slate-500">
            {freshness ? <>Updated <span className="text-slate-300">{freshness}</span></> : 'No sync yet'}
          </span>
        </div>
        {status?.error && (
          <div className="mb-3 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300">
            Last sync failed: {status.error}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          <BankStatus label="Starling" colour="#8b5cf6" bank={starling} />
          <BankStatus label="Monzo" colour="#14b8a6" bank={monzo} />
        </div>
        {!status && (
          <p className="text-xs text-slate-500 mt-3">
            Once the agent runs its first sync, live status will appear here. Follow the setup steps below.
          </p>
        )}
      </div>

      {/* ── Setup checklist ── */}
      <div className="bg-nb-750 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Set up (one time)</h3>
        <ol className="space-y-4">
          {/* 1. Deploy the API that serves the rest of this page */}
          <li className="flex gap-3">
            <StepDot done={apiReady === true} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">1 · Deploy the bank-sync API</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bank sync adds new API routes. Until the deployment your browser is talking to has them, nothing below can work.
              </p>
              <Cmd>vercel --prod</Cmd>
              {apiReady === false && (
                <div className="mt-1.5 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300 space-y-1.5">
                  {apiIssue?.kind === 'stale-deployment' && (
                    <p>This deployment does not have the sync-token route yet — it answered with your budget instead. Deploy the latest commit.</p>
                  )}
                  {apiIssue?.kind === 'auth' && (
                    <p>You are not signed in (HTTP {apiIssue.status}). Sign in again, then reload this page.</p>
                  )}
                  {apiIssue?.kind === 'server' && (
                    <>
                      <p>
                        The route is deployed but the database rejected it{apiIssue.detail ? <> — <code className="text-red-200">{apiIssue.detail}</code></> : null}.
                        This is usually the <code className="text-red-200">api_tokens</code> table not existing yet: it ships in
                        {' '}<code className="text-red-200">api/db/schema.sql</code>, which nothing applies automatically.
                      </p>
                      <p className="text-red-300/80">Apply it once against your database (every statement is IF NOT EXISTS, so re-running is safe):</p>
                      <Cmd>psql "$DATABASE_URL" -f api/db/schema.sql</Cmd>
                    </>
                  )}
                  {apiIssue?.kind === 'http' && (
                    <p>The token route returned HTTP {apiIssue.status}{apiIssue.detail ? ` — ${apiIssue.detail}` : ''}.</p>
                  )}
                  <p className="text-red-300/70">Token creation stays disabled until this clears — sending it to a backend that cannot store it would overwrite your budget.</p>
                </div>
              )}
              {apiReady === true && (
                <p className="text-xs text-emerald-400 mt-1.5">Deployed — the sync-token route is live.</p>
              )}
            </div>
          </li>

          {/* 2. Install */}
          <li className="flex gap-3">
            <StepDot done={hasToken || !!status} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">2 · Install the sync agent</div>
              <p className="text-xs text-slate-500 mt-0.5">Installs Ollama + the local model + the <code className="text-slate-400">nb-transactions</code> helper. Run once from the app repo.</p>
              <Cmd>bash scripts/install.sh</Cmd>
            </div>
          </li>

          {/* 3. Token */}
          <li className="flex gap-3">
            <StepDot done={hasToken} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">3 · Point the agent at this app &amp; give it a token</div>
              <p className="text-xs text-slate-500 mt-0.5">
                The token lets the agent write to your account without your password, and is revocable any time.
                Both this and the app URL must be set — sync refuses to run without them.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={createToken} disabled={busy || apiReady !== true}
                  title={apiReady !== true ? 'Deploy the bank-sync API first (step 1)' : undefined}
                  className="text-xs px-3 py-1.5 rounded-lg bg-neuro-600 hover:bg-neuro-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {hasToken ? 'Create another token' : 'Create sync token'}
                </button>
                {busy && <span className="text-xs text-slate-500">Working…</span>}
                {hasToken && !busy && <span className="text-xs text-slate-500">{tokens.length} active</span>}
              </div>
              {error && (
                <div className="mt-2 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              {newToken ? (
                <div className="mt-2">
                  <p className="text-xs text-amber-400">Copy this now — the token is shown only once. It sets both values at once:</p>
                  <Cmd>{`nb-transactions config set appUrl ${appUrl} syncToken ${newToken}`}</Cmd>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xs text-slate-500">
                    Already created a token? Then you only need the app URL:
                  </p>
                  <Cmd>{`nb-transactions config set appUrl ${appUrl}`}</Cmd>
                </div>
              )}
              {isLocalhost && (
                <p className="text-xs text-amber-400/90 mt-1.5">
                  You are viewing this on <code>{appUrl}</code>. The agent runs in the background and needs the address your
                  app is actually deployed at — substitute that instead.
                </p>
              )}
              {tokens.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {tokens.map(t => (
                    <li key={t.id} className="flex items-center justify-between text-xs text-slate-500 bg-nb-800 border border-nb-600 rounded-lg px-3 py-1.5">
                      <span className="truncate">{t.name} · created {timeAgo(t.created_at) || '—'}{t.last_used_at ? ` · used ${timeAgo(t.last_used_at)}` : ' · never used'}</span>
                      <button onClick={() => revokeToken(t.id)} disabled={busy} className="text-red-500 hover:text-red-400 ml-2 flex-shrink-0">Revoke</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>

          {/* 4. Starling */}
          <li className="flex gap-3">
            <StepDot done={!!starling?.connected} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">4 · Connect Starling</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Create a Personal Access Token at{' '}
                <a href="https://developer.starlingbank.com/personal/token" target="_blank" rel="noreferrer" className="text-neuro-400 hover:text-neuro-300 underline">developer.starlingbank.com</a>{' '}
                with scopes <code className="text-slate-400">account:read</code>, <code className="text-slate-400">transaction:read</code>, <code className="text-slate-400">space:read</code>, then:
              </p>
              <Cmd>nb-transactions config set starlingPat &lt;your-token&gt;</Cmd>
            </div>
          </li>

          {/* 5. Monzo */}
          <li className="flex gap-3">
            <StepDot done={!!monzo?.connected} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">5 · Connect Monzo</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monzo has no simple “copy a token” option — you register your own OAuth client first. Five sub-steps, about 5 minutes.
              </p>

              <ol className="mt-2.5 space-y-3 border-l border-nb-600 pl-3">
                <li>
                  <div className="text-xs text-slate-300 font-medium">4a · Register a client</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sign in at{' '}
                    <a href="https://developers.monzo.com" target="_blank" rel="noreferrer" className="text-neuro-400 hover:text-neuro-300 underline">developers.monzo.com</a>{' '}
                    (they email you a magic link — open it on the same computer), then choose <strong className="text-slate-400">Clients → New OAuth Client</strong>. Name and description can be anything.
                  </p>
                </li>

                <li>
                  <div className="text-xs text-slate-300 font-medium">4b · Use these two settings exactly</div>
                  <p className="text-xs text-slate-500 mt-0.5">Redirect URL — must match character for character:</p>
                  <Cmd>http://localhost:47000/callback</Cmd>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Confidentiality — set to <strong className="text-slate-400">Confidential</strong>.
                  </p>
                  <div className="mt-1.5 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 text-xs text-amber-300/90">
                    If this is left on <em>Non-confidential</em>, Monzo returns no refresh token and sync will stop working after ~30 hours. It cannot be changed later — you would have to create a new client.
                  </div>
                </li>

                <li>
                  <div className="text-xs text-slate-300 font-medium">4c · Copy the client’s credentials to the agent</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Open the client you just created — it shows a <strong className="text-slate-400">Client ID</strong> (starts <code className="text-slate-400">oauth2client_</code>) and a <strong className="text-slate-400">Client secret</strong> (starts <code className="text-slate-400">mnzconf.</code>). Paste both in place of the placeholders:
                  </p>
                  <Cmd>nb-transactions config set monzoClientId &lt;client-id&gt; monzoClientSecret &lt;client-secret&gt;</Cmd>
                </li>

                <li>
                  <div className="text-xs text-slate-300 font-medium">4d · Authorise</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Opens your browser and asks for your email; Monzo sends another magic link. Return to the terminal when the page says “Monzo connected”.
                  </p>
                  <Cmd>nb-transactions connect-monzo</Cmd>
                </li>

                <li>
                  <div className="text-xs text-slate-300 font-medium">4e · Approve on your phone</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Open the <strong className="text-slate-400">Monzo app</strong> — there is a notification asking to allow access to your data. <strong className="text-slate-400">Tap Approve.</strong> Until you do, every sync fails with “access denied”, even though the terminal said it connected.
                  </p>
                </li>
              </ol>

              <p className="text-xs text-slate-500 mt-2.5">
                Monzo makes you repeat 4d and 4e roughly every 90 days. The status card above warns you a week ahead.
              </p>
            </div>
          </li>

          {/* 6. Schedule */}
          <li className="flex gap-3">
            <StepDot done={!!status?.syncedAt} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 font-medium">6 · Turn on automatic sync</div>
              <p className="text-xs text-slate-500 mt-0.5">Test it once, then enable the background schedule (runs at login, hourly, and on wake):</p>
              <Cmd>nb-transactions sync</Cmd>
              <Cmd>nb-transactions schedule on</Cmd>
            </div>
          </li>
        </ol>
      </div>
    </div>
  )
}

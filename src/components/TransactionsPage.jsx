import { useState, useMemo, useRef, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ChevronLeftIcon, ChevronRightIcon, ArrowUpTrayIcon,
  ClipboardDocumentIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon,
  TrashIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import { useTransactions } from '../context/TransactionContext'
import {
  TRANSACTION_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORIES,
  isTransfer,
  CATEGORY_COLOURS,
  CATEGORY_TO_BUDGET_GROUP,
} from '../data/transactionCategories'
import { MERCHANT_RULES, buildMerchantRulesPromptSection } from '../data/merchantRules'
import { mergeTransactions } from '../utils/mergeTransactions'

// ── Formatting helpers ───────────────────────────────────────────────
const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtSigned = (n) => `${n >= 0 ? '+' : '−'}£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Corrections (teach the AI via manual category fixes) ─────────────
const CORRECTIONS_KEY = 'nb:corrections'

function loadCorrections() {
  try { return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]') } catch { return [] }
}

function recordCorrection(description, from, to) {
  const all = loadCorrections()
  const idx = all.findIndex(c => c.description === description)
  if (idx >= 0) { all[idx] = { description, from, to } } else { all.push({ description, from, to }) }
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(all))
}

// ── Merchant rules (custom, stored in Blob) ───────────────────────────
function useMerchantRules() {
  const [rules, setRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesSaving, setRulesSaving] = useState(false)

  useEffect(() => {
    fetch('/api/budget?resource=merchant-rules')
      .then(r => r.json())
      .then(data => setRules(Array.isArray(data) ? data : []))
      .catch(() => setRules([]))
      .finally(() => setRulesLoading(false))
  }, [])

  async function saveRules(newRules) {
    setRulesSaving(true)
    try {
      await fetch('/api/budget?resource=merchant-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRules),
      })
      setRules(newRules)
    } finally {
      setRulesSaving(false)
    }
  }

  return { rules, rulesLoading, rulesSaving, saveRules }
}

// ── Merchant Rules Manager UI ─────────────────────────────────────────
function MerchantRulesManager({ customRules, rulesLoading, rulesSaving, onSaveRules }) {
  const [open, setOpen] = useState(false)
  const [showSeeded, setShowSeeded] = useState(false)
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState(TRANSACTION_CATEGORIES[0])

  function exportForCli() {
    const blob = new Blob([JSON.stringify(customRules, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'merchant-rules.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function addRule() {
    const p = pattern.trim()
    if (!p) return
    onSaveRules([{ pattern: p, matchType: 'contains', category }, ...customRules])
    setPattern('')
  }

  function deleteRule(idx) {
    onSaveRules(customRules.filter((_, i) => i !== idx))
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 bg-nb-800 rounded-xl border border-nb-600 text-slate-400 text-sm hover:text-slate-300 hover:bg-nb-750 transition-colors mb-4"
      >
        <span>
          Teach the AI your categories
          {!rulesLoading && (
            <span className="ml-2 text-xs text-slate-500">
              {customRules.length > 0 ? `${customRules.length} custom · ` : ''}{MERCHANT_RULES.length} pre-seeded
            </span>
          )}
        </span>
        <ChevronDownIcon className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="bg-nb-800 rounded-xl border border-nb-600 overflow-hidden mb-4"
      style={{ boxShadow: '0 0 30px #22d3ee15' }}>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #22d3eecc, transparent)' }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-slate-200 font-semibold text-sm">Teach the AI your categories</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Map merchant names to categories so the AI always gets them right — no more guessing "AMZN MKTP" or "SQ *COFFEE".
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronUpIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Add rule form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRule()}
            placeholder='Description contains… e.g. "MONZO FLEX REPAYMENT"'
            className="flex-1 bg-nb-900 border border-nb-500 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-nb-400 min-w-0"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-nb-900 border border-nb-500 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-nb-400"
          >
            {TRANSACTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={addRule}
            disabled={!pattern.trim() || rulesSaving}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-nb-700 border border-nb-500 text-slate-300 hover:bg-nb-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Custom rules list */}
        {customRules.length === 0 ? (
          <p className="text-slate-600 text-xs mb-4 italic">No custom rules yet. Add one above.</p>
        ) : (
          <div className="mb-4 space-y-1">
            {customRules.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-nb-750 rounded-lg border border-nb-600">
                <span className="flex-1 font-mono text-xs text-slate-300 truncate">"{r.pattern}"</span>
                <span className="text-slate-500 text-xs">→</span>
                <span className="text-xs text-slate-400 truncate max-w-36">{r.category}</span>
                <button
                  onClick={() => deleteRule(i)}
                  className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pre-seeded rules toggle */}
        <button
          onClick={() => setShowSeeded(v => !v)}
          className="text-slate-500 hover:text-slate-400 text-xs transition-colors mb-1"
        >
          {showSeeded ? '▾' : '▸'} {MERCHANT_RULES.length} pre-seeded rules (read-only)
        </button>
        {showSeeded && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {MERCHANT_RULES.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-60">
                <span className="flex-1 font-mono text-xs text-slate-400 truncate">"{r.pattern}"</span>
                <span className="text-slate-600 text-xs">→</span>
                <span className="text-xs text-slate-500 truncate max-w-36">{r.category}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {customRules.length > 0 && (
          <div className="mt-4 pt-3 border-t border-nb-600">
            <button
              onClick={exportForCli}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              Export rules for CLI (merchant-rules.json)
            </button>
            <span className="text-slate-700 text-xs ml-1">— copy to ~/.config/nb-transactions/</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Claude prompt builder ────────────────────────────────────────────
function buildClaudePrompt(month, customRules = []) {
  const label = monthLabel(month)
  const catList = TRANSACTION_CATEGORIES.join('\n')
  const corrections = loadCorrections()
  const correctionSection = corrections.length > 0
    ? `\n\n## Learned corrections — apply these exact mappings\n\nThe user has manually corrected these transactions before. Apply the same category when you see matching or similar descriptions:\n\n${corrections.map(c => `- "${c.description}" → ${c.to}  (not "${c.from}")`).join('\n')}`
    : ''
  const merchantSection = '\n\n' + buildMerchantRulesPromptSection(customRules)
  return `You are a personal finance assistant. I will give you my bank CSV data and you must categorise every transaction and output a specific JSON format for my budgeting app.

## IMPORTANT: Output format

Output ONLY a single JSON code block, tagged \`\`\`transactions-json (exactly that tag). No explanation before or after. The shape must be exactly:

\`\`\`transactions-json
{
  "month": "${month}",
  "importedAt": "${new Date().toISOString()}",
  "transactions": [
    {
      "id": "txn-1744704600000-0",
      "date": "2026-04-03",
      "description": "SAINSBURYS SUPERSTORE",
      "amount": -62.14,
      "category": "Groceries",
      "account": "HSBC",
      "notes": ""
    }
  ]
}
\`\`\`

## Rules — follow these exactly

1. **amount**: always a number. Money leaving the account is NEGATIVE. Income, refunds, and transfers in are POSITIVE.
2. **date**: always YYYY-MM-DD format.
3. **category**: must be EXACTLY one of the 39 strings listed below. No variations, no new categories.
4. **id**: \`txn-\` followed by the current Unix timestamp in milliseconds, then \`-\`, then the row index starting at 0. Example: \`txn-1744704600000-0\`, \`txn-1744704600000-1\`.
5. **account**: the name of the bank account (e.g. "HSBC", "Barclays", "Nationwide").
6. Include EVERY row from the CSV — do not skip any.
7. Output the COMPLETE JSON — never truncate or summarise.
8. Transfers between your own accounts (Faster Payments, BACS to yourself, moving money between your own banks) → "Transfer".
9. Monzo Flex repayment lines (description contains "Flex Repayment", "MONZO FLEX REPAYMENT", or similar) → "Transfer". These are you paying off your Flex balance, not purchases.
10. Monzo savings pot movements (description ends with " Pot", e.g. "Holiday Pot", "Emergency Pot") → "Transfer".
11. Monzo Flex *purchases* (actual items bought via Flex) — categorise by the actual purchase type, not as a card payment. E.g. a restaurant bought via Flex → "Eating Out & Takeaways".
12. Regular salary/BACS payments → "Income - Salary".
13. Pension deductions shown on payslip → "Savings - Pension".
14. If you are unsure which category fits, prefer a specific one over "Other".${merchantSection}${correctionSection}

## Canonical categories (use these exact strings only)

${catList}

## My bank CSV data for ${label}

[PASTE YOUR CSV HERE]`
}

// ── Validate imported JSON ───────────────────────────────────────────
function validateImport(json) {
  if (!json || typeof json !== 'object') return 'Not a valid JSON object.'
  if (typeof json.month !== 'string' || !/^\d{4}-\d{2}$/.test(json.month)) {
    return 'Missing or invalid "month" field (expected YYYY-MM format).'
  }
  if (!Array.isArray(json.transactions)) return 'Missing "transactions" array.'
  const required = ['id', 'date', 'description', 'amount', 'category', 'account']
  for (let i = 0; i < json.transactions.length; i++) {
    const t = json.transactions[i]
    for (const k of required) {
      if (t[k] === undefined) return `Transaction at index ${i} is missing required field "${k}".`
    }
    if (typeof t.amount !== 'number') return `Transaction at index ${i}: "amount" must be a number.`
    if (!TRANSACTION_CATEGORIES.includes(t.category)) {
      const suggestions = TRANSACTION_CATEGORIES.filter(c =>
        c.toLowerCase().includes(t.category.toLowerCase().split(' ')[0])
      )
      const hint = suggestions.length ? ` Did you mean "${suggestions[0]}"?` : ' Check the canonical category list.'
      return `Unknown category "${t.category}" at index ${i}.${hint}`
    }
  }
  return null
}

// ── NeonCard ─────────────────────────────────────────────────────────
function NeonCard({ accent = '#4f7ef7', children, className = '' }) {
  return (
    <div
      className={`bg-nb-750 rounded-xl border border-nb-600 overflow-hidden ${className}`}
      style={{ boxShadow: `0 0 40px ${accent}22, 0 0 0 1px ${accent}12` }}
    >
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)` }} />
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Dark tooltip ─────────────────────────────────────────────────────
function DarkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-nb-800 border border-nb-500 rounded-lg px-3 py-2 shadow-2xl text-sm"
      style={{ backgroundColor: '#0d1224', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
      <div className="text-slate-300 font-medium">{name}</div>
      <div className="text-white">{fmt(value)}</div>
    </div>
  )
}

// ── Import modal ─────────────────────────────────────────────────────
function ImportModal({ activeMonth, onClose, onImport }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [existingTxns, setExistingTxns] = useState(null) // null = not yet fetched
  const [fetchingExisting, setFetchingExisting] = useState(false)

  function handleChange(e) {
    const val = e.target.value
    setRaw(val)
    setExistingTxns(null)
    if (!val.trim()) { setParsed(null); setError(null); return }
    try {
      const json = JSON.parse(val.trim())
      const err = validateImport(json)
      if (err) { setParsed(null); setError(err); return }
      setParsed(json)
      setError(null)
    } catch {
      setParsed(null)
      setError('Could not parse JSON — make sure you copy only the content inside the code fences.')
    }
  }

  // Fetch existing transactions for the parsed month when a valid JSON is pasted
  useEffect(() => {
    if (!parsed) { setExistingTxns(null); return }
    let cancelled = false
    setFetchingExisting(true)
    fetch(`/api/transactions?month=${parsed.month}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        setExistingTxns(data?.transactions ?? [])
      })
      .catch(() => { if (!cancelled) setExistingTxns([]) })
      .finally(() => { if (!cancelled) setFetchingExisting(false) })
    return () => { cancelled = true }
  }, [parsed])

  const mergeResult = parsed && existingTxns !== null
    ? mergeTransactions(parsed.transactions, existingTxns)
    : null

  const hasExisting = existingTxns !== null && existingTxns.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-nb-800 rounded-2xl border border-nb-600 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-nb-600 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Import transactions</h2>
            <p className="text-slate-400 text-sm mt-0.5">{monthLabel(activeMonth)}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none ml-4">✕</button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto">
          <p className="text-slate-400 text-sm mb-3">
            After sending the prompt to Claude, copy the JSON it outputs (everything inside the{' '}
            <code className="text-slate-300 bg-nb-700 px-1 rounded">```transactions-json</code> block) and paste it below.
          </p>
          <textarea
            className="w-full h-48 bg-nb-900 border border-nb-500 rounded-lg px-3 py-2.5 text-slate-300 text-xs font-mono resize-none focus:outline-none focus:border-nb-400 placeholder:text-slate-600"
            placeholder={'{\n  "month": "2026-04",\n  "transactions": [...]\n}'}
            value={raw}
            onChange={handleChange}
            autoFocus
          />

          {error && (
            <div className="mt-3 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {parsed && !error && (
            <div className="mt-3 bg-emerald-950/40 border border-emerald-700/50 rounded-lg px-4 py-3 text-emerald-300 text-sm">
              {fetchingExisting ? (
                <span className="text-slate-400">Checking existing data…</span>
              ) : mergeResult && hasExisting ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckIcon className="w-4 h-4 flex-shrink-0" />
                    <strong>{monthLabel(parsed.month)}</strong> already has data — smart merge available.
                  </div>
                  <div className="text-xs text-emerald-400/80 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {mergeResult.stats.matched > 0 && (
                      <span>{mergeResult.stats.matched} matched <span className="text-emerald-600">(categories preserved)</span></span>
                    )}
                    {mergeResult.stats.added > 0 && (
                      <span>{mergeResult.stats.added} new</span>
                    )}
                    {mergeResult.stats.kept > 0 && (
                      <span>{mergeResult.stats.kept} no longer in export <span className="text-emerald-600">(will be kept)</span></span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 flex-shrink-0" />
                  Found <strong>{parsed.transactions.length}</strong> transactions for <strong>{monthLabel(parsed.month)}</strong>. Ready to import.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-nb-700 border border-nb-500 text-slate-300 text-sm font-medium hover:bg-nb-600 transition-colors">
            Cancel
          </button>
          {parsed && !error && mergeResult && hasExisting ? (
            <>
              <button
                onClick={() => onImport(parsed.month, parsed.transactions)}
                className="py-2.5 px-4 rounded-lg bg-nb-700 border border-nb-500 text-slate-400 text-sm font-medium hover:bg-nb-600 hover:text-slate-300 transition-colors"
              >
                Replace all
              </button>
              <button
                disabled={fetchingExisting}
                onClick={() => onImport(parsed.month, mergeResult.merged)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white"
                style={{ background: 'linear-gradient(135deg, #4f7ef7, #22d3ee)' }}
              >
                Smart import
              </button>
            </>
          ) : (
            <button
              disabled={!parsed || !!error || fetchingExisting}
              onClick={() => onImport(parsed.month, parsed.transactions)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-nb-500 text-white hover:bg-nb-400"
              style={parsed && !error ? { background: 'linear-gradient(135deg, #4f7ef7, #22d3ee)' } : {}}
            >
              {parsed ? `Import ${parsed.transactions.length} transactions` : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const INSTALL_CMD = 'curl -fsSL https://raw.githubusercontent.com/timgillhere/budget-app/main/scripts/install.sh | bash'

// ── How to use guide ─────────────────────────────────────────────────
function HowToGuide({ activeMonth, onCopyPrompt, onImport, copyFlash, collapsed, onToggle }) {
  const [method, setMethod] = useState('local')
  const [installCopied, setInstallCopied] = useState(false)

  function copyInstall() {
    navigator.clipboard.writeText(INSTALL_CMD).then(() => {
      setInstallCopied(true)
      setTimeout(() => setInstallCopied(false), 2500)
    })
  }

  if (collapsed) {
    return (
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-nb-800 rounded-xl border border-nb-600 text-slate-400 text-sm hover:text-slate-300 hover:bg-nb-750 transition-colors mb-6">
        <span>How to import your transactions</span>
        <ChevronDownIcon className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="bg-nb-800 rounded-xl border border-nb-600 overflow-hidden mb-6"
      style={{ boxShadow: '0 0 40px #4f7ef722' }}>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #4f7ef7cc, transparent)' }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-200 font-semibold text-sm">How to import your transactions</h3>
          {onToggle && (
            <button onClick={onToggle} className="text-slate-500 hover:text-slate-300 transition-colors">
              <ChevronUpIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Method tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMethod('local')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={method === 'local'
              ? { background: 'linear-gradient(135deg, #34d39920, #22d3ee18)', border: '1px solid #34d39950', color: '#34d399', boxShadow: '0 0 20px #34d39918' }
              : { background: 'transparent', border: '1px solid #334155', color: '#64748b' }}
          >
            <span>🔒</span>
            <span>Local AI</span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={method === 'local'
                ? { background: '#34d39930', color: '#34d399' }
                : { background: '#1e293b', color: '#475569' }}
            >
              private
            </span>
          </button>
          <button
            onClick={() => setMethod('cloud')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={method === 'cloud'
              ? { background: 'linear-gradient(135deg, #4f7ef720, #22d3ee18)', border: '1px solid #4f7ef750', color: '#93c5fd', boxShadow: '0 0 20px #4f7ef718' }
              : { background: 'transparent', border: '1px solid #334155', color: '#64748b' }}
          >
            <span>☁️</span>
            <span>Cloud AI</span>
          </button>
        </div>

        {/* ── Cloud method ── */}
        {method === 'cloud' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-nb-600 border border-nb-500 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 mt-0.5">1</div>
              <div>
                <div className="text-slate-300 text-sm font-medium">Export a CSV from your banking app</div>
                <div className="text-slate-500 text-xs mt-0.5">HSBC, Barclays, Nationwide — any bank that lets you download a CSV of transactions.</div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-nb-600 border border-nb-500 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <div className="text-slate-300 text-sm font-medium">Copy the prompt below and open Claude (or ChatGPT)</div>
                <div className="text-slate-500 text-xs mt-0.5 mb-3">The prompt tells the AI exactly which categories to use and what JSON format to output. Paste your CSV at the bottom where it says [PASTE YOUR CSV HERE] and send.</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onCopyPrompt}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copyFlash ? 'bg-emerald-700 text-white' : 'text-white'}`}
                    style={copyFlash ? {} : { background: 'linear-gradient(135deg, #4f7ef7, #22d3ee)' }}
                  >
                    {copyFlash ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                    {copyFlash ? 'Copied!' : 'Copy Claude prompt'}
                  </button>
                  <span className="text-slate-500 text-xs">for {monthLabel(activeMonth)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-nb-600 border border-nb-500 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 mt-0.5">3</div>
              <div className="flex-1">
                <div className="text-slate-300 text-sm font-medium">Copy Claude's JSON response and paste it here</div>
                <div className="text-slate-500 text-xs mt-0.5 mb-3">Claude will output a block starting with <code className="text-slate-400 bg-nb-700 px-1 rounded">```transactions-json</code> — copy the content inside those fences and click Import.</div>
                <button
                  onClick={onImport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-nb-700 border border-nb-500 text-slate-300 hover:bg-nb-600 hover:text-white transition-colors"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Import JSON
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Local AI method ── */}
        {method === 'local' && (
          <div className="space-y-5">

            {/* Privacy callout */}
            <div className="flex gap-3 px-4 py-3 rounded-lg" style={{ background: '#34d39912', border: '1px solid #34d39930' }}>
              <span className="text-lg leading-none mt-0.5">🔒</span>
              <div>
                <div className="text-emerald-300 text-sm font-medium">Your bank data never leaves your computer</div>
                <div className="text-emerald-400/60 text-xs mt-0.5">Processing happens entirely on-device using a local AI model. Nothing is sent to any server.</div>
              </div>
            </div>

            {/* What it does */}
            <div>
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2.5">What gets installed</div>
              <div className="space-y-2">
                {[
                  { name: 'Ollama', desc: 'Open source AI runtime — runs the language model locally on your Mac. Widely used and auditable.' },
                  { name: 'llama3.2:3b', desc: 'A ~2 GB language model by Meta, downloaded once and stored on your machine. Never calls home.' },
                  { name: 'nb-transactions', desc: 'A small command-line script (from this repo) that reads your CSV, runs the AI, and outputs the import JSON.' },
                ].map(item => (
                  <div key={item.name} className="flex gap-2.5 text-xs">
                    <span className="text-slate-500 mt-0.5">▸</span>
                    <span><span className="text-slate-200 font-medium font-mono">{item.name}</span><span className="text-slate-500"> — {item.desc}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div>
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2.5">Requirements</div>
              <div className="flex flex-wrap gap-2">
                {['macOS (Apple Silicon recommended)', 'Homebrew', '~3 GB free disk space', 'Node.js (installed automatically)'].map(r => (
                  <span key={r} className="px-2.5 py-1 rounded-full text-xs bg-nb-700 border border-nb-600 text-slate-400">{r}</span>
                ))}
              </div>
            </div>

            {/* Warnings */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #fbbf2430' }}>
              <div className="px-4 py-2" style={{ background: '#fbbf2410' }}>
                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Before you run this</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {[
                  'This runs a shell script downloaded from the internet. You should review it before running — the source is linked below.',
                  'Ollama installs as a background service that listens on localhost port 11434. It is not accessible from the internet.',
                  'The AI model (~4.7 GB) is downloaded from Meta\'s servers via Ollama on first install. Subsequent runs are offline.',
                  'The script modifies your ~/.zshrc to add ~/.local/bin to your PATH. This is a standard, reversible change.',
                  'To uninstall: run `brew uninstall ollama`, delete ~/.local/bin/nb-transactions and ~/.config/nb-transactions.',
                ].map((w, i) => (
                  <div key={i} className="flex gap-2.5 text-xs">
                    <span className="text-amber-500/60 flex-shrink-0 mt-0.5">!</span>
                    <span className="text-slate-400">{w}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Install command */}
            <div>
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2.5">One-time setup — paste into Terminal</div>
              <div className="flex gap-2 items-stretch">
                <div className="flex-1 bg-nb-900 border border-nb-600 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-300 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  {INSTALL_CMD}
                </div>
                <button
                  onClick={copyInstall}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all border ${installCopied ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-nb-700 border-nb-500 text-slate-300 hover:bg-nb-600 hover:text-white'}`}
                >
                  {installCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
                  {installCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a
                href="https://github.com/timgillhere/budget-app/blob/main/scripts/install.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Review the script on GitHub before running →
              </a>
            </div>

            {/* Monthly use */}
            <div>
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2.5">Each month after setup</div>
              <div className="space-y-3">
                {[
                  { n: '1', text: <>Start Ollama if it isn't already running: <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">ollama serve</code></> },
                  { n: '2', text: 'Export CSVs from each of your banks (Starling, Monzo, HSBC, Nationwide, Halifax, Barclays, Revolut).' },
                  { n: '3', text: <>In Terminal, run with your first CSV: <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">nb-transactions ~/Downloads/bank1.csv Starling</code></> },
                  { n: '4', text: <>When prompted, enter <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">y</code> to add more bank CSVs, or <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">n</code> when done. A combined <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">.json</code> is saved to <code className="text-slate-300 bg-nb-700 px-1.5 py-0.5 rounded font-mono">~/Downloads/</code> — import it below.</> },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-nb-600 border border-nb-500 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 mt-0.5">{step.n}</div>
                    <div className="text-slate-400 text-xs leading-relaxed pt-0.5">{step.text}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  onClick={onImport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-nb-700 border border-nb-500 text-slate-300 hover:bg-nb-600 hover:text-white transition-colors"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Import JSON
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── Review banner (transactions flagged by local AI) ─────────────────
function ReviewBanner({ transactions, activeMonth, onSave }) {
  const flagged = useMemo(() => transactions.filter(t => t.notes?.startsWith('needs-review:')), [transactions])
  const [selections, setSelections] = useState(() => {
    const m = {}
    flagged.forEach(t => { m[t.id] = '' })
    return m
  })
  const [saving, setSaving] = useState(false)

  if (!flagged.length) return null

  const allSelected = flagged.every(t => selections[t.id])

  function set(id, cat) {
    setSelections(prev => ({ ...prev, [id]: cat }))
  }

  async function saveOne(txn) {
    const cat = selections[txn.id]
    if (!cat) return
    recordCorrection(txn.description, txn.category, cat)
    const updated = transactions.map(t =>
      t.id === txn.id
        ? { ...t, category: cat, notes: '' }
        : t
    )
    setSaving(true)
    await onSave(activeMonth, updated)
    setSaving(false)
  }

  async function saveAll() {
    const updated = transactions.map(t => {
      const cat = selections[t.id]
      if (t.notes?.startsWith('needs-review:') && cat) {
        recordCorrection(t.description, t.category, cat)
        return { ...t, category: cat, notes: '' }
      }
      return t
    })
    setSaving(true)
    await onSave(activeMonth, updated)
    setSaving(false)
  }

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #fbbf2440', boxShadow: '0 0 40px #fbbf2412' }}>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #fbbf24cc, transparent)' }} />
      <div className="p-5" style={{ background: '#fbbf2408' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg leading-none">⚠️</span>
          <div className="flex-1">
            <h3 className="text-amber-300 font-semibold text-sm">
              {flagged.length} transaction{flagged.length > 1 ? 's' : ''} need a category
            </h3>
            <p className="text-amber-400/60 text-xs mt-0.5">The AI wasn't sure about these. Pick the right category for each one.</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {flagged.map(t => {
            const suggestion = t.notes.replace('needs-review: ', '')
            const selected = selections[t.id]
            return (
              <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-nb-800/60 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-300 text-sm truncate">{t.description}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-slate-500 text-xs font-mono">{t.date.slice(5).replace('-', '/')}</span>
                    <span className={`text-xs font-medium tabular-nums ${t.amount < 0 ? 'text-slate-400' : 'text-emerald-400'}`}>
                      {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
                    </span>
                    <span className="text-amber-500/60 text-xs">AI suggested: {suggestion}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={selected}
                    onChange={e => set(t.id, e.target.value)}
                    className="bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50 max-w-[180px]"
                  >
                    <option value="">Pick a category…</option>
                    {TRANSACTION_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => saveOne(t)}
                    disabled={!selected || saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: selected ? '#fbbf2420' : undefined, border: '1px solid #fbbf2440', color: '#fbbf24' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {flagged.length > 1 && (
          <button
            onClick={saveAll}
            disabled={!allSelected || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #fbbf2420, #f9731620)', border: '1px solid #fbbf2440', color: '#fbbf24' }}
          >
            <CheckIcon className="w-4 h-4" />
            {saving ? 'Saving…' : `Save all ${flagged.length}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Summary tiles ────────────────────────────────────────────────────
function SummaryTiles({ transactions }) {
  const spending = transactions.filter(t => t.amount < 0 && !isTransfer(t))
  const income   = transactions.filter(t => t.amount > 0 && !isTransfer(t))
  const totalOut = spending.reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIn  = income.reduce((s, t) => s + t.amount, 0)
  const net = totalIn - totalOut

  const tiles = [
    { label: 'Total in',   value: fmt(totalIn),  colour: '#34d399' },
    { label: 'Total out',  value: fmt(totalOut), colour: '#fb7185' },
    { label: 'Net',        value: fmtSigned(net), colour: net >= 0 ? '#34d399' : '#fb7185' },
    { label: 'Transactions', value: transactions.length, colour: '#4f7ef7' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {tiles.map(t => (
        <div key={t.label} className="bg-nb-800 rounded-xl border border-nb-600 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t.label}</div>
          <div className="text-lg font-bold" style={{ color: t.colour }}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Category breakdown chart ─────────────────────────────────────────
function CategoryBreakdown({ transactions }) {
  const data = useMemo(() => {
    const map = {}
    transactions.forEach(t => {
      if (t.amount >= 0 || isTransfer(t) || INCOME_CATEGORIES.has(t.category)) return
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) return null

  return (
    <NeonCard accent="#a78bfa" className="mb-6">
      <h3 className="text-slate-200 font-semibold text-sm mb-4">Spending by category</h3>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Donut chart */}
        <div className="w-full lg:w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_COLOURS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category list */}
        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-52">
          {data.map(d => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0
            const colour = CATEGORY_COLOURS[d.name] || '#94a3b8'
            return (
              <div key={d.name} className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colour }} />
                <span className="text-slate-400 text-xs flex-1 min-w-0 truncate">{d.name}</span>
                <span className="text-slate-500 text-xs w-10 text-right flex-shrink-0">{pct}%</span>
                <span className="text-slate-300 text-xs font-medium w-20 text-right flex-shrink-0">{fmt(d.value)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </NeonCard>
  )
}

// ── Actual vs budgeted table ─────────────────────────────────────────
function ActualVsBudgeted({ transactions, budget }) {
  const rows = useMemo(() => {
    // Sum actual spending per transaction category
    const actuals = {}
    transactions.forEach(t => {
      if (t.amount >= 0 || isTransfer(t)) return
      actuals[t.category] = (actuals[t.category] || 0) + Math.abs(t.amount)
    })

    // Build flat group name → monthly budget lookup
    const groupBudgets = {}
    budget?.sections?.forEach(sec => {
      sec.groups?.forEach(g => {
        const total = (g.items || []).reduce((s, i) => s + (i.monthly || 0), 0)
        groupBudgets[g.name] = total
      })
    })

    return Object.entries(actuals)
      .filter(([cat]) => !INCOME_CATEGORIES.has(cat))
      .map(([cat, actual]) => {
        const groupName = CATEGORY_TO_BUDGET_GROUP[cat]
        const budgeted = groupName ? (groupBudgets[groupName] ?? null) : null
        const variance = budgeted !== null ? actual - budgeted : null
        return { cat, actual, budgeted, variance }
      })
      .sort((a, b) => b.actual - a.actual)
  }, [transactions, budget])

  if (!rows.length) return null

  return (
    <NeonCard accent="#4f7ef7" className="mb-6">
      <h3 className="text-slate-200 font-semibold text-sm mb-4">Actual vs. budgeted</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wide border-b border-nb-600">
              <th className="pb-2 text-left font-medium">Category</th>
              <th className="pb-2 text-right font-medium">Budgeted/mo</th>
              <th className="pb-2 text-right font-medium">Actual</th>
              <th className="pb-2 text-right font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.cat} className="border-b border-nb-700/50">
                <td className="py-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLOURS[r.cat] || '#94a3b8' }} />
                    {r.cat}
                  </div>
                </td>
                <td className="py-2 text-right text-slate-400">
                  {r.budgeted !== null ? fmt(r.budgeted) : <span className="text-slate-600">—</span>}
                </td>
                <td className="py-2 text-right text-slate-200 font-medium">{fmt(r.actual)}</td>
                <td className="py-2 text-right font-medium">
                  {r.variance !== null ? (
                    <span style={{ color: r.variance > 0 ? '#fb7185' : '#34d399' }}>
                      {r.variance > 0 ? '+' : ''}{fmt(r.variance)}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-slate-600 text-xs mt-3">
        Budgeted figures are monthly amounts from your budget. Variance = actual − budgeted (red = over, green = under).
      </p>
    </NeonCard>
  )
}

// ── Transaction list ─────────────────────────────────────────────────
function TransactionList({ transactions, onUpdate, onBulkUpdate, onDelete }) {
  // ── filter state ──────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [direction, setDirection] = useState('all')   // 'all' | 'out' | 'in'
  const [amountOp, setAmountOp] = useState('any')     // 'any' | 'gt' | 'lt' | 'between'
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hideTransfers, setHideTransfers] = useState(true)

  // ── selection / delete state ──────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const selectAllRef = useRef(null)

  const categories = useMemo(() => {
    const seen = new Set(transactions.map(t => t.category))
    return ['all', ...TRANSACTION_CATEGORIES.filter(c => seen.has(c))]
  }, [transactions])

  const accounts = useMemo(() => {
    const seen = [...new Set(transactions.map(t => t.account).filter(Boolean))].sort()
    return ['all', ...seen]
  }, [transactions])

  const activeFilterCount = [
    search.trim() !== '',
    categoryFilter !== 'all',
    accountFilter !== 'all',
    direction !== 'all',
    amountOp !== 'any',
  ].filter(Boolean).length

  function clearFilters() {
    setSearch('')
    setCategoryFilter('all')
    setAccountFilter('all')
    setDirection('all')
    setAmountOp('any')
    setAmountA('')
    setAmountB('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const aVal = parseFloat(amountA)
    const bVal = parseFloat(amountB)
    return transactions.filter(t => {
      // search: description or amount
      if (q) {
        const amtStr = Math.abs(t.amount).toFixed(2)
        if (!t.description.toLowerCase().includes(q) && !amtStr.includes(q)) return false
      }
      // category
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      // account
      if (accountFilter !== 'all' && t.account !== accountFilter) return false
      // direction
      if (direction === 'out' && t.amount >= 0) return false
      if (direction === 'in' && t.amount < 0) return false
      // amount operator (works on absolute value)
      const abs = Math.abs(t.amount)
      if (amountOp === 'gt' && !isNaN(aVal) && abs <= aVal) return false
      if (amountOp === 'lt' && !isNaN(aVal) && abs >= aVal) return false
      if (amountOp === 'between' && !isNaN(aVal) && !isNaN(bVal) && (abs < aVal || abs > bVal)) return false
      if (hideTransfers && isTransfer(t)) return false
      return true
    })
  }, [transactions, search, categoryFilter, accountFilter, direction, amountOp, amountA, amountB, hideTransfers])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered]
  )

  // Clear selection when visible set changes significantly
  const prevFilterKey = useRef('')
  const filterKey = `${search}|${categoryFilter}|${accountFilter}|${direction}|${amountOp}|${amountA}|${amountB}|${hideTransfers}`
  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey
    if (selected.size > 0) setSelected(new Set())
  }

  // Keep select-all checkbox indeterminate state in sync
  const allSelected = sorted.length > 0 && sorted.every(t => selected.has(t.id))
  const someSelected = !allSelected && sorted.some(t => selected.has(t.id))
  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map(t => t.id)))
    }
  }

  function handleDelete(id) {
    if (pendingDelete === id) {
      onDelete(id)
      setPendingDelete(null)
    } else {
      setPendingDelete(id)
    }
  }

  async function applyBulk() {
    if (!bulkCategory || selected.size === 0) return
    await onBulkUpdate([...selected], { category: bulkCategory })
    setSelected(new Set())
    setBulkCategory('')
  }

  function CategorySelect({ t }) {
    const colour = CATEGORY_COLOURS[t.category] || '#94a3b8'
    return (
      <select
        value={t.category}
        onChange={e => onUpdate(t.id, { category: e.target.value })}
        className="rounded-full text-xs font-medium px-2 py-0.5 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
        style={{ background: colour + '22', color: colour }}
      >
        {TRANSACTION_CATEGORIES.map(c => (
          <option key={c} value={c} style={{ background: '#1e293b', color: '#e2e8f0' }}>{c}</option>
        ))}
      </select>
    )
  }

  const hasSelection = selected.size > 0

  return (
    <NeonCard accent="#22d3ee">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-slate-200 font-semibold text-sm">
          Transactions
          <span className="text-slate-500 font-normal ml-1.5">
            {sorted.length !== transactions.length ? `${sorted.length} of ${transactions.length}` : sorted.length}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">
              Clear filters
            </button>
          )}
          {/* Hide transfers toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-slate-500">Transfers</span>
            <button
              role="switch"
              aria-checked={hideTransfers}
              onClick={() => setHideTransfers(v => !v)}
              className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
                hideTransfers ? 'bg-nb-700 border border-nb-500' : 'border border-nb-400'
              }`}
              style={!hideTransfers ? { background: '#22d3ee40', borderColor: '#22d3ee' } : {}}
            >
              <span className={`inline-block h-3 w-3 rounded-full shadow transition-transform duration-200 mt-0.5 ${
                hideTransfers ? 'translate-x-0.5 bg-slate-500' : 'translate-x-3.5 bg-cyan-400'
              }`} />
            </button>
          </label>
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-nb-600 border-nb-400 text-slate-200'
                : 'bg-nb-700 border-nb-500 text-slate-400 hover:text-slate-200 hover:bg-nb-600'
            }`}
          >
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: '#4f7ef740', color: '#93c5fd' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Search bar (always visible) ── */}
      <div className="relative mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search description or amount…"
          className="w-full bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-nb-400 placeholder:text-slate-600"
        />
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-base leading-none">✕</button>
        )}
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div className="mb-4 p-3 rounded-lg space-y-3" style={{ background: '#0d122480', border: '1px solid #1e293b' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Category */}
            <div>
              <label className="block text-slate-500 text-xs mb-1 uppercase tracking-wide">Category</label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-nb-400"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-slate-500 text-xs mb-1 uppercase tracking-wide">Account</label>
              <select
                value={accountFilter}
                onChange={e => setAccountFilter(e.target.value)}
                className="w-full bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-nb-400"
              >
                {accounts.map(a => (
                  <option key={a} value={a}>{a === 'all' ? 'All accounts' : a}</option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-slate-500 text-xs mb-1 uppercase tracking-wide">Direction</label>
              <div className="flex rounded-lg overflow-hidden border border-nb-500">
                {[['all', 'All'], ['out', 'Out'], ['in', 'In']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDirection(val)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      direction === val ? 'bg-nb-500 text-slate-100' : 'bg-nb-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-slate-500 text-xs mb-1 uppercase tracking-wide">Amount</label>
              <div className="flex gap-1.5">
                <select
                  value={amountOp}
                  onChange={e => { setAmountOp(e.target.value); setAmountA(''); setAmountB('') }}
                  className="bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-nb-400 flex-shrink-0"
                >
                  <option value="any">Any</option>
                  <option value="gt">&gt; than</option>
                  <option value="lt">&lt; than</option>
                  <option value="between">Between</option>
                </select>
                {amountOp !== 'any' && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountA}
                    onChange={e => setAmountA(e.target.value)}
                    placeholder="£0.00"
                    className="w-0 flex-1 bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-nb-400 placeholder:text-slate-600 min-w-0"
                  />
                )}
                {amountOp === 'between' && (
                  <>
                    <span className="text-slate-500 text-xs self-center flex-shrink-0">–</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountB}
                      onChange={e => setAmountB(e.target.value)}
                      placeholder="£0.00"
                      className="w-0 flex-1 bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-nb-400 placeholder:text-slate-600 min-w-0"
                    />
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-lg flex-wrap"
          style={{ background: '#4f7ef712', border: '1px solid #4f7ef740' }}>
          <span className="text-slate-300 text-xs font-medium flex-shrink-0">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
              className="bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-nb-400 min-w-[180px]"
            >
              <option value="">Set category…</option>
              {TRANSACTION_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: bulkCategory ? 'linear-gradient(135deg, #4f7ef7, #22d3ee)' : undefined, color: 'white', border: bulkCategory ? 'none' : '1px solid #334155' }}
            >
              <CheckIcon className="w-3.5 h-3.5" />
              Apply to {selected.size}
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors flex-shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wide border-b border-nb-600">
              <th className="pb-2 w-8 pr-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-nb-500 bg-nb-700 cursor-pointer accent-blue-500"
                />
              </th>
              <th className="pb-2 text-left font-medium w-24">Date</th>
              <th className="pb-2 text-left font-medium">Description</th>
              <th className="pb-2 text-left font-medium">Category</th>
              <th className="pb-2 text-right font-medium w-24">Amount</th>
              <th className="pb-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const isSelected = selected.has(t.id)
              const delPending = pendingDelete === t.id
              return (
                <tr
                  key={t.id}
                  className={`border-b border-nb-700/40 transition-colors ${
                    delPending ? 'bg-red-950/20' : isSelected ? 'bg-blue-950/20' : 'hover:bg-nb-700/20'
                  }`}
                >
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(t.id)}
                      className="rounded border-nb-500 bg-nb-700 cursor-pointer accent-blue-500"
                    />
                  </td>
                  <td className="py-2 text-slate-500 font-mono">{t.date.slice(5).replace('-', '/')}</td>
                  <td className="py-2 text-slate-300 max-w-xs truncate pr-3">{t.description}</td>
                  <td className="py-2 pr-3">
                    <CategorySelect t={t} />
                  </td>
                  <td className={`py-2 text-right font-medium tabular-nums ${t.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}`}>
                    {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    {delPending ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 text-red-300 hover:bg-red-800/60 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="px-2 py-0.5 rounded text-xs font-medium bg-nb-700 text-slate-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                        title="Delete transaction"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {sorted.map(t => {
          const isSelected = selected.has(t.id)
          const delPending = pendingDelete === t.id
          return (
            <div
              key={t.id}
              className={`rounded-lg px-3 py-2.5 transition-colors ${
                delPending ? 'bg-red-950/30' : isSelected ? 'bg-blue-950/20' : 'bg-nb-700/30'
              }`}
              style={isSelected ? { border: '1px solid #4f7ef740' } : {}}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRow(t.id)}
                  className="mt-1 rounded border-nb-500 bg-nb-700 cursor-pointer accent-blue-500 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-300 text-sm truncate">{t.description}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-slate-500 text-xs">{t.date.slice(5).replace('-', '/')}</span>
                    <CategorySelect t={t} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`text-sm font-semibold tabular-nums ${t.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}`}>
                    {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
                  </div>
                  {delPending ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-300">Delete</button>
                      <button onClick={() => setPendingDelete(null)} className="text-xs px-2 py-0.5 rounded bg-nb-700 text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      title="Delete transaction"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <div className="text-slate-600 text-sm">No transactions match your filters.</div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </NeonCard>
  )
}

// ── Main page ────────────────────────────────────────────────────────
export default function TransactionsPage({ budget }) {
  const { transactions, loading, saveStatus, activeMonth, setActiveMonth, saveTransactions } = useTransactions()
  const { rules: merchantRules, rulesLoading, rulesSaving, saveRules } = useMerchantRules()
  const [showImport, setShowImport] = useState(false)
  const [copyFlash, setCopyFlash] = useState(false)
  const [guideCollapsed, setGuideCollapsed] = useState(false)
  const isCurrentMonth = activeMonth === currentYearMonth()

  function handleCopyPrompt() {
    const prompt = buildClaudePrompt(activeMonth, merchantRules)
    navigator.clipboard.writeText(prompt).then(() => {
      setCopyFlash(true)
      setTimeout(() => setCopyFlash(false), 2500)
    })
  }

  async function handleImport(month, txns) {
    await saveTransactions(month, txns)
    setShowImport(false)
    setGuideCollapsed(true)
  }

  async function handleUpdateTransaction(id, patch) {
    if (patch.category) {
      const original = transactions.find(t => t.id === id)
      if (original && original.category !== patch.category) {
        recordCorrection(original.description, original.category, patch.category)
      }
    }
    const updated = transactions.map(t => t.id === id ? { ...t, ...patch } : t)
    await saveTransactions(activeMonth, updated)
  }

  async function handleDeleteTransaction(id) {
    const updated = transactions.filter(t => t.id !== id)
    await saveTransactions(activeMonth, updated)
  }

  async function handleBulkUpdateTransactions(ids, patch) {
    const idSet = new Set(ids)
    if (patch.category) {
      ids.forEach(id => {
        const original = transactions.find(t => t.id === id)
        if (original && original.category !== patch.category) {
          recordCorrection(original.description, original.category, patch.category)
        }
      })
    }
    const updated = transactions.map(t => idSet.has(t.id) ? { ...t, ...patch } : t)
    await saveTransactions(activeMonth, updated)
  }

  const hasData = transactions !== null && transactions.length > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* Month nav */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMonth(prevMonth(activeMonth))}
            className="p-2 rounded-lg bg-nb-800 border border-nb-600 text-slate-400 hover:text-white hover:bg-nb-700 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <h2 className="text-slate-200 font-semibold text-base sm:text-lg w-36 sm:w-44 text-center">
            {monthLabel(activeMonth)}
          </h2>
          <button
            onClick={() => setActiveMonth(nextMonth(activeMonth))}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg bg-nb-800 border border-nb-600 text-slate-400 hover:text-white hover:bg-nb-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nb-800 border border-nb-500 text-slate-300 hover:bg-nb-700 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Import JSON</span>
          <span className="sm:hidden">Import</span>
        </button>
      </div>

      {/* Guide card */}
      <HowToGuide
        activeMonth={activeMonth}
        onCopyPrompt={handleCopyPrompt}
        onImport={() => setShowImport(true)}
        copyFlash={copyFlash}
        collapsed={hasData && guideCollapsed}
        onToggle={hasData ? () => setGuideCollapsed(v => !v) : null}
      />

      {/* Merchant rules manager */}
      <MerchantRulesManager
        customRules={merchantRules}
        rulesLoading={rulesLoading}
        rulesSaving={rulesSaving}
        onSaveRules={saveRules}
      />

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-500 text-sm">Loading...</div>
      )}

      {/* Save status */}
      {saveStatus === 'saving' && (
        <div className="text-center text-slate-500 text-xs mb-4">Saving…</div>
      )}
      {saveStatus === 'error' && (
        <div className="text-center text-red-400 text-xs mb-4">Failed to save. Please try again.</div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">💳</div>
          <div className="text-slate-400 text-base font-medium mb-1">No transactions for {monthLabel(activeMonth)}</div>
          <div className="text-slate-600 text-sm">Follow the steps above to import your bank data.</div>
        </div>
      )}

      {/* Data views */}
      {!loading && hasData && (
        <>
          <ReviewBanner transactions={transactions} activeMonth={activeMonth} onSave={saveTransactions} />
          <SummaryTiles transactions={transactions} />
          <CategoryBreakdown transactions={transactions} />
          <ActualVsBudgeted transactions={transactions} budget={budget} />
          <TransactionList
            transactions={transactions}
            onUpdate={handleUpdateTransaction}
            onBulkUpdate={handleBulkUpdateTransactions}
            onDelete={handleDeleteTransaction}
          />
        </>
      )}

      {/* Modals */}
      {showImport && (
        <ImportModal
          activeMonth={activeMonth}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

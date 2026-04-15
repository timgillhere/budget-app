import { useState, useMemo, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ChevronLeftIcon, ChevronRightIcon, ArrowUpTrayIcon,
  ClipboardDocumentIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { useTransactions } from '../context/TransactionContext'
import {
  TRANSACTION_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORIES,
  CATEGORY_COLOURS,
  CATEGORY_TO_BUDGET_GROUP,
} from '../data/transactionCategories'

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

// ── Claude prompt builder ────────────────────────────────────────────
function buildClaudePrompt(month) {
  const label = monthLabel(month)
  const catList = TRANSACTION_CATEGORIES.join('\n')
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
      "account": "Starling",
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
5. **account**: the name of the bank account (e.g. "Starling", "Monzo", "HSBC").
6. Include EVERY row from the CSV — do not skip any.
7. Output the COMPLETE JSON — never truncate or summarise.
8. Transfers between my own accounts → use "Transfer".
9. Regular salary/BACS payments → "Income - Salary".
10. Pension deductions shown on payslip → "Savings - Pension".
11. If you are unsure which category fits, prefer a specific one over "Other".

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

  function handleChange(e) {
    const val = e.target.value
    setRaw(val)
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
            <div className="mt-3 bg-emerald-950/40 border border-emerald-700/50 rounded-lg px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
              <CheckIcon className="w-4 h-4 flex-shrink-0" />
              Found <strong>{parsed.transactions.length}</strong> transactions for <strong>{monthLabel(parsed.month)}</strong>. Ready to import.
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-nb-700 border border-nb-500 text-slate-300 text-sm font-medium hover:bg-nb-600 transition-colors">
            Cancel
          </button>
          <button
            disabled={!parsed || !!error}
            onClick={() => onImport(parsed.month, parsed.transactions)}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-nb-500 text-white hover:bg-nb-400"
            style={parsed && !error ? { background: 'linear-gradient(135deg, #4f7ef7, #22d3ee)' } : {}}
          >
            {parsed ? `Import ${parsed.transactions.length} transactions` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── How to use guide ─────────────────────────────────────────────────
function HowToGuide({ activeMonth, onCopyPrompt, onImport, copyFlash, collapsed, onToggle }) {
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

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-nb-600 border border-nb-500 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 mt-0.5">1</div>
            <div>
              <div className="text-slate-300 text-sm font-medium">Export a CSV from your banking app</div>
              <div className="text-slate-500 text-xs mt-0.5">Starling, Monzo, HSBC — any bank that lets you download a CSV of transactions.</div>
            </div>
          </div>

          {/* Step 2 */}
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

          {/* Step 3 */}
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
      </div>
    </div>
  )
}

// ── Summary tiles ────────────────────────────────────────────────────
function SummaryTiles({ transactions }) {
  const spending = transactions.filter(t => t.amount < 0 && !TRANSFER_CATEGORIES.has(t.category))
  const income   = transactions.filter(t => t.amount > 0 && !TRANSFER_CATEGORIES.has(t.category))
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
      if (t.amount >= 0 || TRANSFER_CATEGORIES.has(t.category) || INCOME_CATEGORIES.has(t.category)) return
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
      if (t.amount >= 0 || TRANSFER_CATEGORIES.has(t.category)) return
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
function TransactionList({ transactions }) {
  const [filter, setFilter] = useState('all')

  const categories = useMemo(() => {
    const seen = new Set(transactions.map(t => t.category))
    return ['all', ...TRANSACTION_CATEGORIES.filter(c => seen.has(c))]
  }, [transactions])

  const filtered = useMemo(() =>
    filter === 'all' ? transactions : transactions.filter(t => t.category === filter),
    [transactions, filter]
  )

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered]
  )

  return (
    <NeonCard accent="#22d3ee">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-slate-200 font-semibold text-sm">Transactions ({sorted.length})</h3>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-nb-700 border border-nb-500 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-nb-400"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wide border-b border-nb-600">
              <th className="pb-2 text-left font-medium w-24">Date</th>
              <th className="pb-2 text-left font-medium">Description</th>
              <th className="pb-2 text-left font-medium">Category</th>
              <th className="pb-2 text-right font-medium w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} className="border-b border-nb-700/40 hover:bg-nb-700/20 transition-colors">
                <td className="py-2 text-slate-500 font-mono">{t.date.slice(5).replace('-', '/')}</td>
                <td className="py-2 text-slate-300 max-w-xs truncate pr-3">{t.description}</td>
                <td className="py-2 pr-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: (CATEGORY_COLOURS[t.category] || '#94a3b8') + '22',
                      color: CATEGORY_COLOURS[t.category] || '#94a3b8',
                    }}
                  >
                    {t.category}
                  </span>
                </td>
                <td className={`py-2 text-right font-medium tabular-nums ${t.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}`}>
                  {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {sorted.map(t => (
          <div key={t.id} className="bg-nb-700/30 rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-slate-300 text-sm truncate">{t.description}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500 text-xs">{t.date.slice(5).replace('-', '/')}</span>
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: (CATEGORY_COLOURS[t.category] || '#94a3b8') + '22',
                    color: CATEGORY_COLOURS[t.category] || '#94a3b8',
                  }}
                >
                  {t.category}
                </span>
              </div>
            </div>
            <div className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}`}>
              {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-slate-600 text-sm">No transactions match this filter.</div>
      )}
    </NeonCard>
  )
}

// ── Main page ────────────────────────────────────────────────────────
export default function TransactionsPage({ budget }) {
  const { transactions, loading, saveStatus, activeMonth, setActiveMonth, saveTransactions } = useTransactions()
  const [showImport, setShowImport] = useState(false)
  const [copyFlash, setCopyFlash] = useState(false)
  const [guideCollapsed, setGuideCollapsed] = useState(false)
  const isCurrentMonth = activeMonth === currentYearMonth()

  function handleCopyPrompt() {
    const prompt = buildClaudePrompt(activeMonth)
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
          <SummaryTiles transactions={transactions} />
          <CategoryBreakdown transactions={transactions} />
          <ActualVsBudgeted transactions={transactions} budget={budget} />
          <TransactionList transactions={transactions} />
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

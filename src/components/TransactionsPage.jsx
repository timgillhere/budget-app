import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
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
import { spentByCategory } from '../utils/budgetCalcs'

// ── Formatting helpers ───────────────────────────────────────────────
const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtSigned = (n) => `${n >= 0 ? '+' : '−'}£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

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
  return `${Math.round(h / 24)}d ago`
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
    const actuals = spentByCategory(transactions)

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

  function CategorySelect({ t }) {
    const colour = CATEGORY_COLOURS[t.category] || '#94a3b8'
    return (
      <span className="inline-block rounded-full text-xs font-medium px-2 py-0.5" style={{ background: colour + '22', color: colour }}>
        {t.category}
      </span>
    )
  }

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
                <td className="py-2 pr-3"><CategorySelect t={t} /></td>
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
          <div key={t.id} className="rounded-lg px-3 py-2.5 bg-nb-700/30">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-slate-300 text-sm truncate">{t.description}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-slate-500 text-xs">{t.date.slice(5).replace('-', '/')}</span>
                  <CategorySelect t={t} />
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}`}>
                {t.amount < 0 ? '−' : '+'}£{Math.abs(t.amount).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
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
  const { transactions, meta, loading, error, activeMonth, setActiveMonth } = useTransactions()
  const freshness = timeAgo(meta?.importedAt)
  const isCurrentMonth = activeMonth === currentYearMonth()
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
          <div className="w-36 sm:w-44 text-center">
            <h2 className="text-slate-200 font-semibold text-base sm:text-lg leading-tight">
              {monthLabel(activeMonth)}
            </h2>
            {freshness && (
              <div className="text-[11px] text-slate-500 leading-tight">
                Updated {freshness}{meta?.source === 'agent' ? ' · auto-synced' : ''}
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveMonth(nextMonth(activeMonth))}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg bg-nb-800 border border-nb-600 text-slate-400 hover:text-white hover:bg-nb-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-500 text-sm">Loading...</div>
      )}

      {/* Couldn't load — distinct from "this month is empty" */}
      {!loading && error && !hasData && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-slate-400 text-base font-medium mb-2">Couldn&rsquo;t load transactions</div>
          <div className="max-w-sm mx-auto bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300 text-left">
            {error}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasData && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">💳</div>
          <div className="text-slate-400 text-base font-medium mb-1">No transactions for {monthLabel(activeMonth)}</div>
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
    </div>
  )
}

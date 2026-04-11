import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { calcBudgetSummary, isSavingsGroup, isAnnualFundGroup, stripPrefix } from '../utils/budgetCalcs'

const SECTION_COLOURS = { starling: '#22d3ee', current: '#4f7ef7', monzo: '#a78bfa' }
const GRID_STROKE  = '#1c2844'
const TICK_FILL    = '#475569'
const CURSOR_FILL  = 'rgba(79, 126, 247, 0.05)'

const fmt     = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtFull = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Data transforms ──────────────────────────────────────────────────

function buildSurplusWaterfallRows(budget) {
  const { totalIncome } = calcBudgetSummary(budget)
  let running = totalIncome
  const rows = [{ name: 'Income', base: 0, value: totalIncome, type: 'income' }]

  budget.sections.forEach(sec => {
    sec.groups.forEach(g => {
      const groupTotal = g.items.reduce((s, i) => s + i.monthly, 0)
      if (groupTotal === 0) return
      const savingsGroup = isSavingsGroup(g)
      const annualGroup  = savingsGroup && isAnnualFundGroup(g)
      running -= groupTotal
      rows.push({
        name: stripPrefix(g.name),
        base: Math.max(running, 0),
        value: groupTotal,
        type: annualGroup ? 'annual' : savingsGroup ? 'savings' : 'spending',
        colour: annualGroup ? '#f59e0b' : savingsGroup ? '#2dd4bf' : (SECTION_COLOURS[sec.id] || '#4f7ef7'),
      })
    })
  })

  rows.push({
    name: running >= 0 ? 'Surplus' : 'Deficit',
    base: 0,
    value: Math.abs(running),
    type: running >= 0 ? 'surplus' : 'deficit',
  })

  return rows
}

function buildBreakdownSections(budget) {
  const sections = []

  // 1. Income (always first)
  const incomeItems = (budget.income?.items || []).filter(i => i.monthly > 0)
  if (incomeItems.length > 0) {
    sections.push({
      id: 'income',
      label: 'Income',
      total: incomeItems.reduce((s, i) => s + i.monthly, 0),
      colour: '#34d399',
      type: 'income',
      sectionName: null,
      items: incomeItems.map(i => ({ name: i.name, monthly: i.monthly, notes: i.notes || '' })),
    })
  }

  // 2. Spending groups (in section order)
  budget.sections.forEach(sec => {
    const secColour = SECTION_COLOURS[sec.id] || '#4f7ef7'
    const secLabel = sec.name.replace(/\p{Emoji}/gu, '').trim()
    sec.groups.forEach(g => {
      if (isSavingsGroup(g)) return
      const items = g.items.filter(i => !i.isSavings && i.monthly > 0)
      const total = items.reduce((s, i) => s + i.monthly, 0)
      if (total === 0) return
      sections.push({
        id: g.id,
        label: stripPrefix(g.name),
        total,
        colour: secColour,
        type: 'spending',
        sectionName: secLabel,
        items: items.map(i => ({ name: i.name, monthly: i.monthly, notes: i.notes || '' })),
      })
    })
  })

  // 3. Annual fund groups
  budget.sections.forEach(sec => {
    const secLabel = sec.name.replace(/\p{Emoji}/gu, '').trim()
    sec.groups.forEach(g => {
      if (!isAnnualFundGroup(g)) return
      const items = g.items.filter(i => i.monthly > 0)
      const total = items.reduce((s, i) => s + i.monthly, 0)
      if (total === 0) return
      sections.push({
        id: g.id,
        label: stripPrefix(g.name),
        total,
        colour: '#f59e0b',
        type: 'annual',
        sectionName: secLabel,
        items: items.map(i => ({ name: i.name, monthly: i.monthly, notes: i.notes || '' })),
      })
    })
  })

  // 4. Long-term savings groups
  budget.sections.forEach(sec => {
    const secLabel = sec.name.replace(/\p{Emoji}/gu, '').trim()
    sec.groups.forEach(g => {
      if (!isSavingsGroup(g) || isAnnualFundGroup(g)) return
      const items = g.items.filter(i => i.monthly > 0)
      const total = items.reduce((s, i) => s + i.monthly, 0)
      if (total === 0) return
      sections.push({
        id: g.id,
        label: stripPrefix(g.name),
        total,
        colour: '#2dd4bf',
        type: 'savings',
        sectionName: secLabel,
        items: items.map(i => ({ name: i.name, monthly: i.monthly, notes: i.notes || '' })),
      })
    })
  })

  return sections
}

// ── Sub-components ───────────────────────────────────────────────────

function SurplusEquation({ totalIncome, budgetedSpending, annualFunds, longtermSavings, surplus }) {
  const surplusClass = surplus >= 300 ? 'text-emerald-400 neon-green' : surplus >= 100 ? 'text-amber-400 neon-amber' : 'text-red-400 neon-red'
  return (
    <div className="bg-nb-800 rounded-xl border border-nb-600 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 justify-center">
        <EquationChip label="Income" value={fmtFull(totalIncome)} valueClass="text-emerald-400 neon-green" />
        <Operator>−</Operator>
        <EquationChip label="Spending" value={fmtFull(budgetedSpending)} valueClass="text-slate-200" />
        {annualFunds > 0 && (
          <>
            <Operator>−</Operator>
            <EquationChip label="Annual Funds" value={fmtFull(annualFunds)} valueClass="text-amber-400" />
          </>
        )}
        {longtermSavings > 0 && (
          <>
            <Operator>−</Operator>
            <EquationChip label="Long-term" value={fmtFull(longtermSavings)} valueClass="text-cyan-400" />
          </>
        )}
        <Operator>=</Operator>
        <EquationChip
          label="Surplus"
          value={(surplus < 0 ? '−' : '') + fmtFull(surplus)}
          valueClass={surplusClass}
          prominent
        />
      </div>
    </div>
  )
}

function EquationChip({ label, value, valueClass, prominent = false }) {
  return (
    <div className={`text-center ${prominent ? 'min-w-[96px]' : 'min-w-[80px]'}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`font-bold ${prominent ? 'text-xl' : 'text-base'} ${valueClass}`}>{value}</div>
    </div>
  )
}

function Operator({ children }) {
  return <span className="text-slate-600 text-lg font-light select-none">{children}</span>
}

function SurplusWaterfallChart({ rows, totalIncome }) {
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const valueEntry = payload.find(p => p.dataKey === 'value')
    if (!valueEntry) return null
    const row = valueEntry.payload
    const pct = totalIncome > 0 ? ((row.value / totalIncome) * 100).toFixed(1) : null
    const showPct = pct && row.type !== 'income' && row.type !== 'surplus' && row.type !== 'deficit'
    return (
      <div className="bg-nb-800 border border-nb-500 rounded-lg px-3 py-2 shadow-2xl text-sm"
           style={{ boxShadow: '0 0 20px rgba(0,0,0,0.6)' }}>
        <p className="font-semibold text-slate-200 mb-1">{row.name}</p>
        <p style={{ color: valueEntry.fill }}>{fmtFull(row.value)}/month</p>
        {showPct && <p className="text-slate-500 text-xs mt-0.5">{pct}% of income</p>}
      </div>
    )
  }

  const chartHeight = Math.max(rows.length * 40, 200)

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-400 mb-1">Money Flow</h3>
      <p className="text-xs text-slate-500 mb-3">Income flowing down through each spending group to surplus</p>
      <div style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.25))' }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={rows} layout="vertical" margin={{ top: 0, right: 72, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis
              type="number"
              tickFormatter={fmt}
              tick={{ fontSize: 10, fill: TICK_FILL }}
              axisLine={false}
              tickLine={false}
              domain={[0, totalIncome]}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(name) => name.length > 17 ? name.slice(0, 16) + '…' : name}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Bar dataKey="base" stackId="wf" fill="transparent" strokeWidth={0} />
            <Bar
              dataKey="value"
              stackId="wf"
              radius={[0, 5, 5, 0]}
              maxBarSize={26}
              label={{ position: 'right', formatter: fmt, fontSize: 10, fill: TICK_FILL }}
            >
              {rows.map((row, i) => (
                <Cell
                  key={i}
                  fill={
                    row.type === 'income'  ? '#34d399' :
                    row.type === 'savings' ? '#2dd4bf' :
                    row.type === 'annual'  ? '#f59e0b' :
                    row.type === 'surplus' ? '#4f7ef7' :
                    row.type === 'deficit' ? '#ef4444' :
                    row.colour || '#4f7ef7'
                  }
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-slate-500 justify-center flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#34d399]" />Income</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#22d3ee]" />Spending</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#f59e0b]" />Annual Fund</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#2dd4bf]" />Long-term Savings</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#4f7ef7]" />Surplus</span>
      </div>
    </div>
  )
}

function BreakdownRow({ section, isOpen, onToggle }) {
  return (
    <div className="rounded-lg border border-nb-600 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-nb-800 hover:bg-nb-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: section.colour }} />
          <div className="min-w-0">
            <span className="text-sm font-medium text-slate-200 truncate block">{section.label}</span>
            {section.sectionName && (
              <span className="text-[10px] text-slate-600">{section.sectionName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="text-sm font-semibold tabular-nums" style={{ color: section.colour }}>
            {fmtFull(section.total)}
          </span>
          {section.items.length > 0 && (
            <svg
              className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {isOpen && section.items.length > 0 && (
        <div className="bg-nb-750 border-t border-nb-600 divide-y divide-nb-700">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 pl-9">
              <div className="min-w-0">
                <span className="text-xs text-slate-300 truncate block">{item.name}</span>
                {item.notes && (
                  <span className="text-[10px] text-slate-600 truncate block">{item.notes}</span>
                )}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0 ml-3 tabular-nums">
                {fmtFull(item.monthly)}
              </span>
            </div>
          ))}
          {section.items.length > 1 && (
            <div className="flex items-center justify-between px-4 py-2 pl-9 bg-nb-800/50">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total</span>
              <span className="text-xs font-semibold text-slate-300 tabular-nums">{fmtFull(section.total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────

export default function SurplusDetailModal({ budget, onClose }) {
  const { totalIncome, budgetedSpending, annualFunds, longtermSavings, surplus } = calcBudgetSummary(budget)
  const waterfallRows = buildSurplusWaterfallRows(budget)
  const breakdownSections = buildBreakdownSections(budget)
  const [openSections, setOpenSections] = useState(new Set(['income']))

  const toggleSection = (id) => setOpenSections(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="sheet-enter sm:[animation:none] fixed sm:relative inset-x-0 bottom-0 sm:inset-auto
                   bg-nb-750 rounded-t-2xl sm:rounded-xl border border-nb-600 shadow-2xl
                   w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-nb-500" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-nb-600">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Monthly Surplus</h2>
            <p className="text-xs text-slate-500 mt-0.5">Where your income goes each month</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-nb-700"
          >&times;</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <SurplusEquation
            totalIncome={totalIncome}
            budgetedSpending={budgetedSpending}
            annualFunds={annualFunds}
            longtermSavings={longtermSavings}
            surplus={surplus}
          />

          <SurplusWaterfallChart rows={waterfallRows} totalIncome={totalIncome} />

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Breakdown</h3>
            <div className="space-y-1.5">
              {breakdownSections.map(sec => (
                <BreakdownRow
                  key={sec.id}
                  section={sec}
                  isOpen={openSections.has(sec.id)}
                  onToggle={() => toggleSection(sec.id)}
                />
              ))}
            </div>
          </div>

          {/* Bottom padding so last item isn't flush against screen edge on mobile */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}

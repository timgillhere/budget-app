import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, ComposedChart
} from 'recharts'
import { calcBudgetSummary, isSavingsGroup } from '../utils/budgetCalcs'

const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtFull = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Neon colour palette ──────────────────────────────────────────────
const SECTION_COLOURS = {
  starling: '#22d3ee',
  current:  '#4f7ef7',
  monzo:    '#a78bfa',
}
const GROUP_COLOURS = [
  '#4f7ef7','#22d3ee','#a78bfa','#34d399','#fb923c',
  '#f472b6','#60a5fa','#818cf8','#2dd4bf','#fb7185',
  '#fbbf24','#86efac','#c084fc','#67e8f9','#94a3b8',
]
const GRID_STROKE  = '#1c2844'
const TICK_FILL    = '#475569'
const CURSOR_FILL  = 'rgba(79, 126, 247, 0.05)'

// ── NeonCard: shared card wrapper with accent glow + top line ────────
function NeonCard({ accent = '#4f7ef7', children, className = '' }) {
  return (
    <div
      className={`bg-nb-750 rounded-xl border border-nb-600 overflow-hidden ${className}`}
      style={{ boxShadow: `0 0 40px ${accent}22, 0 0 0 1px ${accent}12` }}
    >
      {/* Glowing top accent line */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)` }} />
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Dark tooltip ─────────────────────────────────────────────────────
function DarkTooltip({ children }) {
  return (
    <div className="bg-nb-800 border border-nb-500 rounded-lg px-3 py-2 shadow-2xl text-sm"
      style={{ boxShadow: '0 0 20px rgba(0,0,0,0.6)' }}>
      {children}
    </div>
  )
}

// ── Chart data sources ───────────────────────────────────────────────
const CHART_DATA_SOURCES = [
  {
    id: 'spending-groups', label: 'Spending by Group',
    getChartData: (budget) => {
      const groups = []
      budget.sections.forEach(sec => {
        sec.groups.forEach(g => {
          if (!isSavingsGroup(g)) {
            const val = g.items.reduce((s, i) => s + i.monthly, 0)
            if (val > 0) groups.push({ name: g.name.replace(/[^\w\s:]/gu, '').trim(), value: val })
          }
        })
      })
      return groups.sort((a, b) => b.value - a.value).slice(0, 10)
    },
  },
  {
    id: 'savings-breakdown', label: 'Savings Breakdown',
    getChartData: (budget) => {
      const { pensionContribution, isaContribution, annualFunds, longtermSavings, surplus } = calcBudgetSummary(budget)
      return [
        { name: 'Pension', value: pensionContribution },
        { name: 'ISA', value: isaContribution },
        { name: 'Long-term Pots', value: longtermSavings },
        { name: 'Annual Funds', value: annualFunds },
        surplus > 0 ? { name: 'Surplus', value: surplus } : null,
      ].filter(Boolean).filter(d => d.value > 0)
    },
  },
  {
    id: 'holiday-progress', label: 'Holiday Budgets',
    getChartData: (budget) => (budget?.holidays?.trips || [])
      .map(t => ({ name: t.destination.replace(/\p{Emoji}/gu, '').trim().slice(0, 22), value: t.totalBudget }))
      .filter(d => d.value > 0),
  },
  {
    id: 'goal-progress', label: 'Goal Progress',
    getChartData: (budget) => (budget?.settings?.goals || [])
      .map(g => ({ name: g.name, value: g.current, target: g.target }))
      .filter(d => d.value >= 0),
  },
  {
    id: 'income-expenses', label: 'Income vs Spending',
    getChartData: (budget) => {
      const { totalIncome, budgetedSpending, annualFunds, longtermSavings } = calcBudgetSummary(budget)
      return [
        { name: 'Income', value: totalIncome },
        { name: 'Spending', value: budgetedSpending },
        { name: 'Annual Funds', value: annualFunds },
        { name: 'Long-term Savings', value: longtermSavings },
      ].filter(d => d.value > 0)
    },
  },
]

const CHART_TYPES = [
  { id: 'bar-h',  label: 'Horizontal Bar', compatibleSources: ['spending-groups', 'holiday-progress', 'goal-progress'] },
  { id: 'bar-v',  label: 'Vertical Bar',   compatibleSources: ['spending-groups', 'savings-breakdown', 'holiday-progress', 'goal-progress', 'income-expenses'] },
  { id: 'donut',  label: 'Donut / Pie',    compatibleSources: ['spending-groups', 'savings-breakdown', 'goal-progress'] },
]

const BUILTIN_CHART_DEFS = [
  { id: 'income-expense-bar',   label: 'Income vs Expenses'      },
  { id: 'savings-gauge',        label: 'Savings Rate'             },
  { id: 'section-donut',        label: 'Spend by Account'         },
  { id: 'group-breakdown',      label: 'Top Spending Groups'      },
  { id: 'holiday-progress',     label: 'Holiday Budgets'          },
  { id: 'savings-breakdown',    label: 'Savings Breakdown'        },
  { id: 'section-income-donut', label: 'Spending % of Income'     },
  { id: 'stacked-bank-bar',     label: 'Spending by Bank & Group' },
  { id: 'waterfall',            label: 'Money Flow', colSpan: 2   },
]
const DEFAULT_LAYOUT = BUILTIN_CHART_DEFS.map(d => ({ id: d.id, type: 'builtin' }))

// ── Savings rate gauge ───────────────────────────────────────────────
function SavingsGauge({ rate, target }) {
  const t = target || 10
  const maxScale = Math.max(40, t * 2)
  const clamped = Math.min(Math.max(parseFloat(rate), 0), maxScale)
  const fill = clamped < t * 0.5 ? '#ef4444' : clamped < t ? '#f59e0b' : clamped < t * 1.5 ? '#34d399' : '#22d3ee'
  const data = [{ value: clamped, fill }, { value: maxScale - clamped, fill: '#1c2844' }]
  const label = clamped < t * 0.5 ? `Below ${Math.round(t * 0.5)}%` :
    clamped < t ? `Getting there (target ${t}%)` :
    clamped < t * 1.5 ? `Healthy` : 'Excellent'

  return (
    <NeonCard accent={fill}>
      <h3 className="text-sm font-semibold text-slate-400 mb-1">💚 Savings Rate</h3>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="80%" startAngle={180} endAngle={0}
            innerRadius={55} outerRadius={75} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-10">
        <div className="text-3xl font-bold" style={{ color: fill, textShadow: `0 0 20px ${fill}` }}>{rate}%</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
      <div className="flex justify-between w-full text-xs text-slate-600 mt-3 px-2">
        <span>0%</span><span>Target: {t}%+</span><span>{maxScale}%</span>
      </div>
    </NeonCard>
  )
}

// ── Income vs Expenses (neon area chart) ────────────────────────────
function IncomeExpenseBar({ totalIncome, totalExpenses, surplus }) {
  const data = [
    { name: 'Income',   value: totalIncome,             fill: '#34d399' },
    { name: 'Expenses', value: totalExpenses,            fill: '#fb923c' },
    { name: 'Surplus',  value: Math.max(surplus, 0),     fill: surplus >= 0 ? '#4f7ef7' : '#ef4444' },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{payload[0].payload.name}</p>
        <p style={{ color: payload[0].payload.fill }}>{fmtFull(payload[0].value)}/month</p>
      </DarkTooltip>
    )
  }

  return (
    <NeonCard accent="#4f7ef7">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Income vs Expenses vs Surplus</h3>
      <div style={{ filter: 'drop-shadow(0 0 6px rgba(79,126,247,0.5))' }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: TICK_FILL }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={70}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {surplus < 0 && <p className="text-xs text-red-400 mt-2 text-center">Expenses exceed income by {fmtFull(Math.abs(surplus))}/month</p>}
    </NeonCard>
  )
}

// ── Expenses by section donut ────────────────────────────────────────
function SectionDonut({ sections }) {
  const data = sections
    .map(sec => ({ name: sec.name.replace(/[⭐💳💜]/g, '').trim(), value: sec.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0), id: sec.id }))
    .filter(d => d.value > 0)

  if (data.length === 0) return (
    <NeonCard accent="#a78bfa">
      <div className="flex items-center justify-center min-h-[260px]">
        <p className="text-sm text-slate-500">No expense data yet</p>
      </div>
    </NeonCard>
  )

  const total = data.reduce((s, d) => s + d.value, 0)
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{payload[0].name}</p>
        <p style={{ color: SECTION_COLOURS[payload[0].payload.id] || '#888' }}>{fmtFull(payload[0].value)}/month</p>
        <p className="text-slate-500">{((payload[0].value / total) * 100).toFixed(1)}%</p>
      </DarkTooltip>
    )
  }
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="700">{`${(percent * 100).toFixed(0)}%`}</text>
  }

  return (
    <NeonCard accent="#a78bfa">
      <h3 className="text-sm font-semibold text-slate-400 mb-2">Spend by Account</h3>
      <div style={{ filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.4))' }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="44%" innerRadius={60} outerRadius={78} dataKey="value" labelLine={false} label={renderLabel} strokeWidth={2} stroke="#090c17">
              {data.map((entry) => <Cell key={entry.id} fill={SECTION_COLOURS[entry.id] || '#888'} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </NeonCard>
  )
}

// ── Spending by group — horizontal bar ──────────────────────────────
function GroupBreakdown({ sections }) {
  const groups = []
  sections.forEach(sec => {
    sec.groups.forEach(grp => {
      const total = grp.items.reduce((s, i) => s + i.monthly, 0)
      if (total > 0) groups.push({ name: grp.name.replace(/[🚐🏠🎻🎯⭐💳💜]/g, '').trim(), value: total })
    })
  })
  groups.sort((a, b) => b.value - a.value)
  const top = groups.slice(0, 12)

  if (top.length === 0) return (
    <NeonCard accent="#4f7ef7">
      <div className="flex items-center justify-center min-h-[260px]">
        <p className="text-sm text-slate-500">No expense data yet</p>
      </div>
    </NeonCard>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{payload[0].payload.name}</p>
        <p className="text-cyan-400">{fmtFull(payload[0].value)}/month</p>
        <p className="text-slate-500">{fmtFull(payload[0].value * 12)}/year</p>
      </DarkTooltip>
    )
  }

  return (
    <NeonCard accent="#4f7ef7">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Spend by Group (top {top.length})</h3>
      <div style={{ filter: 'drop-shadow(0 0 4px rgba(79,126,247,0.3))' }}>
        <ResponsiveContainer width="100%" height={Math.max(top.length * 36, 180)}>
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', formatter: fmt, fontSize: 11, fill: TICK_FILL }}>
              {top.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeonCard>
  )
}

// ── Holiday budget progress ──────────────────────────────────────────
function HolidayProgress({ budget }) {
  const trips = budget?.holidays?.trips || []
  if (trips.length === 0) return null

  const data = trips.map(trip => {
    const b = trip.budget || {}
    const committed = ['flights', 'accommodation', 'onGround'].reduce((s, k) => s + (b[k]?.budgeted ?? 0), 0)
    return { name: trip.destination, totalBudget: trip.totalBudget, committed: Math.min(committed, trip.totalBudget), status: trip.status }
  })

  return (
    <NeonCard accent="#22d3ee">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Holiday Budget Progress</h3>
      <div className="space-y-5">
        {data.map((trip, i) => {
          const pct = trip.totalBudget > 0 ? (trip.committed / trip.totalBudget) * 100 : 0
          const color = trip.status === 'booked' ? '#22d3ee' : '#4f7ef7'
          const remaining = Math.max(trip.totalBudget - trip.committed, 0)
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-200 truncate max-w-[60%]">{trip.name}</span>
                <span className="text-slate-500 tabular-nums">{fmt(trip.committed)} / {fmt(trip.totalBudget)}</span>
              </div>
              <div className="w-full bg-nb-600 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}80` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>{trip.status === 'booked' ? '✓ Booked' : 'Planned'}</span>
                <span>{fmt(remaining)} unallocated</span>
              </div>
            </div>
          )
        })}
      </div>
    </NeonCard>
  )
}

// ── Savings breakdown donut ──────────────────────────────────────────
function SavingsBreakdown({ budget }) {
  const { pensionContribution, isaContribution, annualFunds, longtermSavings, surplus } = calcBudgetSummary(budget)
  const data = [
    { name: 'Pension',          value: pensionContribution, fill: '#22d3ee' },
    { name: 'ISA',              value: isaContribution,     fill: '#34d399' },
    { name: 'Long-term Pots',   value: longtermSavings,     fill: '#4f7ef7' },
    { name: 'Annual Funds',     value: annualFunds,         fill: '#f59e0b' },
    surplus > 0 ? { name: 'Surplus', value: surplus, fill: '#fbbf24' } : null,
  ].filter(Boolean).filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (data.length === 0) return null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }}>{fmtFull(payload[0].value)}/month</p>
        <p className="text-slate-500">{((payload[0].value / total) * 100).toFixed(1)}%</p>
      </DarkTooltip>
    )
  }

  return (
    <NeonCard accent="#34d399">
      <h3 className="text-sm font-semibold text-slate-400 mb-2">Savings Breakdown</h3>
      <div style={{ filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.35))' }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="43%" innerRadius={55} outerRadius={70} dataKey="value" strokeWidth={2} stroke="#090c17">
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-sm font-semibold text-slate-300 mt-1" style={{ textShadow: '0 0 10px rgba(52,211,153,0.5)' }}>{fmtFull(total)}/month total</p>
    </NeonCard>
  )
}

// ── Spend as % of income donut ───────────────────────────────────────
function SectionIncomeDonut({ sections, totalIncome }) {
  const data = sections
    .map(sec => ({ name: sec.name.replace(/[⭐💳💜]/g, '').trim(), value: sec.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0), id: sec.id }))
    .filter(d => d.value > 0)

  if (!totalIncome || data.length === 0) return null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const pct = ((payload[0].value / totalIncome) * 100).toFixed(1)
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{payload[0].name}</p>
        <p style={{ color: SECTION_COLOURS[payload[0].payload.id] || '#888' }}>{fmtFull(payload[0].value)}/month</p>
        <p className="text-slate-500">{pct}% of income</p>
      </DarkTooltip>
    )
  }
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.06) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="700">{`${((percent) * 100).toFixed(0)}%`}</text>
  }

  return (
    <NeonCard accent="#a78bfa">
      <h3 className="text-sm font-semibold text-slate-400 mb-1">Spend as % of Income</h3>
      <p className="text-xs text-slate-600 mb-2">How much of your take-home goes to each account</p>
      <div style={{ filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.4))' }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="43%" innerRadius={55} outerRadius={70} dataKey="value" labelLine={false} label={renderLabel} strokeWidth={2} stroke="#090c17">
              {data.map((entry) => <Cell key={entry.id} fill={SECTION_COLOURS[entry.id] || '#888'} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </NeonCard>
  )
}

// ── Stacked bank bar ─────────────────────────────────────────────────
function StackedBankBar({ sections }) {
  const fills = {}; const row = {}
  sections.forEach(sec => {
    sec.groups.forEach(g => {
      if (!isSavingsGroup(g)) {
        const total = g.items.reduce((s, i) => s + i.monthly, 0)
        if (total > 0) {
          const key = g.name.replace(/[^\w\s]/g, '').trim().slice(0, 22)
          row[key] = total; fills[key] = SECTION_COLOURS[sec.id] || '#888'
        }
      }
    })
  })
  const groupKeys = Object.keys(row).sort((a, b) => row[b] - row[a])
  if (groupKeys.length === 0) return null
  const data = [row]
  const legendItems = Object.entries(SECTION_COLOURS).map(([id, color]) => ({
    id, color, name: sections.find(s => s.id === id)?.name.replace(/[⭐💳💜]/g, '').trim() || id,
  }))

  return (
    <NeonCard accent="#4f7ef7">
      <h3 className="text-sm font-semibold text-slate-400 mb-1">All Spending Groups by Bank</h3>
      <p className="text-xs text-slate-600 mb-3">Each segment = one group; colour = which account it lives in</p>
      <div className="flex gap-3 mb-3 flex-wrap">
        {legendItems.map(l => (
          <div key={l.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }} />
            <span className="text-xs text-slate-500">{l.name}</span>
          </div>
        ))}
      </div>
      <div style={{ filter: 'drop-shadow(0 0 4px rgba(79,126,247,0.4))' }}>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
            <YAxis type="category" hide />
            <Tooltip formatter={(value, name) => [fmtFull(value), name]} cursor={{ fill: CURSOR_FILL }}
              contentStyle={{ background: '#0d1224', border: '1px solid #1c2844', borderRadius: 8, color: '#e2e8f0' }} />
            {groupKeys.map(k => <Bar key={k} dataKey={k} stackId="groups" fill={fills[k]} maxBarSize={36} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeonCard>
  )
}

// ── Waterfall chart ──────────────────────────────────────────────────
function WaterfallChart({ sections, totalIncome }) {
  let running = totalIncome
  const rows = [{ name: 'Income', base: 0, value: totalIncome, type: 'income' }]
  sections.forEach(sec => {
    const secTotal = sec.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)
    if (secTotal > 0) {
      running -= secTotal
      rows.push({ name: sec.name.replace(/[⭐💳💜]/g, '').trim(), base: running, value: secTotal, type: 'section', sectionId: sec.id })
    }
  })
  const surplusVal = running
  rows.push({ name: 'Surplus', base: 0, value: Math.max(surplusVal, 0), type: surplusVal >= 0 ? 'surplus' : 'deficit' })
  if (surplusVal < 0) rows.push({ name: 'Deficit', base: 0, value: Math.abs(surplusVal), type: 'deficit' })

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const entry = payload.find(p => p.dataKey === 'value')
    if (!entry) return null
    return (
      <DarkTooltip>
        <p className="font-semibold text-slate-200">{entry.payload.name}</p>
        <p style={{ color: entry.fill }}>{fmtFull(entry.value)}/month</p>
      </DarkTooltip>
    )
  }

  return (
    <NeonCard accent="#22d3ee">
      <h3 className="text-sm font-semibold text-slate-400 mb-1">🌊 Where Does the Money Go?</h3>
      <p className="text-xs text-slate-600 mb-3">Salary flows down through each account to surplus</p>
      <div style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.3))' }}>
        <ResponsiveContainer width="100%" height={Math.max(rows.length * 44, 200)}>
          <ComposedChart data={rows} layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} domain={[0, totalIncome]} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Bar dataKey="base" stackId="wf" fill="transparent" strokeWidth={0} />
            <Bar dataKey="value" stackId="wf" radius={[0, 6, 6, 0]} maxBarSize={28}
              label={{ position: 'right', formatter: fmt, fontSize: 11, fill: TICK_FILL }}>
              {rows.map((entry, i) => (
                <Cell key={i} fill={
                  entry.type === 'income'  ? '#34d399' :
                  entry.type === 'surplus' ? '#4f7ef7' :
                  entry.type === 'deficit' ? '#ef4444' :
                  SECTION_COLOURS[entry.sectionId] || '#888'
                } />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </NeonCard>
  )
}

// ── Custom chart renderer ────────────────────────────────────────────
function CustomChart({ dataSourceId, chartTypeId, budget }) {
  const source = CHART_DATA_SOURCES.find(s => s.id === dataSourceId)
  const chartType = CHART_TYPES.find(t => t.id === chartTypeId)
  if (!source || !chartType) return null
  const data = source.getChartData(budget)
  if (!data || data.length === 0) return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>

  const tooltipStyle = { background: '#0d1224', border: '1px solid #1c2844', borderRadius: 8, color: '#e2e8f0' }

  if (chartType.id === 'bar-h') return (
    <div style={{ filter: 'drop-shadow(0 0 4px rgba(79,126,247,0.3))' }}>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 38, 160)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [fmtFull(v), '']} cursor={{ fill: CURSOR_FILL }} contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', formatter: fmt, fontSize: 11, fill: TICK_FILL }}>
            {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  if (chartType.id === 'bar-v') return (
    <div style={{ filter: 'drop-shadow(0 0 4px rgba(79,126,247,0.3))' }}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} width={55} />
          <Tooltip formatter={(v) => [fmtFull(v), '']} cursor={{ fill: CURSOR_FILL }} contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  if (chartType.id === 'donut') {
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <div style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.4))' }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={2} stroke="#090c17">
              {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => [fmtFull(v), `${((v / total) * 100).toFixed(1)}%`]} contentStyle={tooltipStyle} />
            <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
}

// ── Chart builder modal ──────────────────────────────────────────────
function ChartBuilderModal({ budget, hiddenBuiltins, onAddBuiltin, onAddCustom, onClose }) {
  const [mode, setMode] = useState('main')
  const [dataSourceId, setDataSourceId] = useState(null)
  const [chartTypeId, setChartTypeId] = useState(null)
  const availableTypes = dataSourceId ? CHART_TYPES.filter(t => t.compatibleSources.includes(dataSourceId)) : []
  const handleSelectSource = (id) => { setDataSourceId(id); setChartTypeId(null); setMode('custom-2') }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-nb-750 rounded-xl border border-nb-600 shadow-2xl w-full max-w-md p-6" style={{ boxShadow: '0 0 60px rgba(79,126,247,0.15)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">
            {mode === 'main' ? 'Add a Chart' : mode === 'custom-1' ? '① Pick a data source' : '② Pick a chart type'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none transition-colors">&times;</button>
        </div>

        {mode === 'main' && (
          <div className="space-y-4">
            {hiddenBuiltins.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Built-in charts</p>
                <div className="grid grid-cols-2 gap-2">
                  {hiddenBuiltins.map(b => (
                    <button key={b.id} onClick={() => { onAddBuiltin(b.id); onClose() }}
                      className="text-left px-3 py-2.5 rounded-lg border border-nb-600 hover:border-neuro-500 hover:bg-nb-700 transition-all">
                      <span className="text-xs font-medium text-slate-300">{b.label}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-nb-600 mt-4" />
              </div>
            )}
            <button onClick={() => setMode('custom-1')}
              className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-nb-500 hover:border-neuro-500 hover:bg-nb-700 transition-all">
              <span className="text-sm font-medium text-slate-500">+ Build a custom chart</span>
            </button>
          </div>
        )}

        {mode === 'custom-1' && (
          <div className="space-y-2">
            <button onClick={() => setMode('main')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 mb-3 transition-colors">← Back</button>
            {CHART_DATA_SOURCES.map(source => (
              <button key={source.id} onClick={() => handleSelectSource(source.id)}
                className="w-full text-left px-4 py-3 rounded-lg border border-nb-600 hover:border-neuro-500 hover:bg-nb-700 transition-all">
                <span className="text-sm font-medium text-slate-300">{source.label}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'custom-2' && (
          <div className="space-y-2">
            <button onClick={() => setMode('custom-1')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 mb-3 transition-colors">← Back</button>
            {availableTypes.map(type => (
              <button key={type.id} onClick={() => setChartTypeId(type.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  chartTypeId === type.id ? 'border-neuro-500 bg-nb-700 text-neuro-300' : 'border-nb-600 hover:border-neuro-500 hover:bg-nb-700 text-slate-300'
                }`}>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={() => { if (dataSourceId && chartTypeId) { onAddCustom({ id: `chart-${Date.now()}`, dataSourceId, chartTypeId }); onClose() } }}
                disabled={!chartTypeId}
                className="flex-1 bg-neuro-600 hover:bg-neuro-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Add Chart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function renderBuiltinChart(id, budget, { totalIncome, totalExpenses, surplus, savingsRateFmt, savingsRateTarget }) {
  switch (id) {
    case 'income-expense-bar':   return <IncomeExpenseBar totalIncome={totalIncome} totalExpenses={totalExpenses} surplus={surplus} />
    case 'savings-gauge':        return <SavingsGauge rate={savingsRateFmt} target={savingsRateTarget} />
    case 'section-donut':        return <SectionDonut sections={budget.sections} />
    case 'group-breakdown':      return <GroupBreakdown sections={budget.sections} />
    case 'holiday-progress':     return <HolidayProgress budget={budget} />
    case 'savings-breakdown':    return <SavingsBreakdown budget={budget} />
    case 'section-income-donut': return <SectionIncomeDonut sections={budget.sections} totalIncome={totalIncome} />
    case 'stacked-bank-bar':     return <StackedBankBar sections={budget.sections} />
    case 'waterfall':            return <WaterfallChart sections={budget.sections} totalIncome={totalIncome} />
    default:                     return null
  }
}

export default function Charts({ budget }) {
  const { totalIncome, totalExpenses, surplus, savingsRate } = calcBudgetSummary(budget)
  const savingsRateFmt = savingsRate.toFixed(1)
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10
  const summary = { totalIncome, totalExpenses, surplus, savingsRateFmt, savingsRateTarget }

  const [chartLayout, setChartLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('chartLayout')
      if (saved) return JSON.parse(saved)
      const old = JSON.parse(localStorage.getItem('customCharts') || '[]')
      return [...DEFAULT_LAYOUT, ...old.map(c => ({ id: c.id, type: 'custom', dataSourceId: c.dataSourceId, chartTypeId: c.chartTypeId }))]
    } catch { return DEFAULT_LAYOUT }
  })
  const [showBuilder, setShowBuilder] = useState(false)

  useEffect(() => { localStorage.setItem('chartLayout', JSON.stringify(chartLayout)) }, [chartLayout])

  const removeChart = (id) => setChartLayout(prev => prev.filter(c => c.id !== id))
  const addBuiltin = (id) => setChartLayout(prev => {
    const defIdx = BUILTIN_CHART_DEFS.findIndex(d => d.id === id)
    let insertAt = 0
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].type !== 'builtin') continue
      const ci = BUILTIN_CHART_DEFS.findIndex(d => d.id === prev[i].id)
      if (ci < defIdx) insertAt = i + 1
    }
    const next = [...prev]; next.splice(insertAt, 0, { id, type: 'builtin' }); return next
  })
  const addCustom = (chart) => setChartLayout(prev => [...prev, { ...chart, type: 'custom' }])
  const hiddenBuiltins = BUILTIN_CHART_DEFS.filter(d => !chartLayout.some(c => c.id === d.id))
  const hasData = totalIncome > 0 || totalExpenses > 0

  if (!hasData) return (
    <NeonCard accent="#4f7ef7">
      <div className="p-10 text-center text-slate-500">
        <div className="text-3xl mb-2 text-neuro-500 opacity-50">◈</div>
        <p className="text-sm">Add some income and expenses to see your charts</p>
      </div>
    </NeonCard>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chartLayout.map(chart => {
          const def = chart.type === 'builtin' ? BUILTIN_CHART_DEFS.find(d => d.id === chart.id) : null
          const colSpanClass = def?.colSpan === 2 ? 'md:col-span-2' : ''

          let content
          if (chart.type === 'builtin') {
            content = renderBuiltinChart(chart.id, budget, summary)
          } else {
            const source = CHART_DATA_SOURCES.find(s => s.id === chart.dataSourceId)
            const chartType = CHART_TYPES.find(t => t.id === chart.chartTypeId)
            content = (
              <NeonCard accent="#4f7ef7">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-400">{source?.label}</h3>
                  <span className="text-xs text-slate-600">{chartType?.label}</span>
                </div>
                <CustomChart dataSourceId={chart.dataSourceId} chartTypeId={chart.chartTypeId} budget={budget} />
              </NeonCard>
            )
          }

          if (!content) return null

          return (
            <div key={chart.id} className={`relative group ${colSpanClass}`}>
              {content}
              <button
                onClick={() => removeChart(chart.id)}
                className="absolute top-4 right-4 w-6 h-6 rounded-full bg-nb-800 border border-nb-600 text-slate-500 hover:text-red-400 hover:border-red-800 text-sm leading-none opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10"
                title="Remove chart"
              >×</button>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={() => setShowBuilder(true)}
          className="px-5 py-2.5 rounded-xl border-2 border-dashed border-nb-500 text-slate-500 hover:border-neuro-500 hover:text-neuro-400 text-sm transition-all"
          style={{ ':hover': { boxShadow: '0 0 20px rgba(79,126,247,0.2)' } }}
        >
          + Add Chart
        </button>
      </div>

      {showBuilder && (
        <ChartBuilderModal budget={budget} hiddenBuiltins={hiddenBuiltins} onAddBuiltin={addBuiltin} onAddCustom={addCustom} onClose={() => setShowBuilder(false)} />
      )}
    </div>
  )
}

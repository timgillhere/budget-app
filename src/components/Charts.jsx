import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
  ComposedChart
} from 'recharts'
import { calcBudgetSummary, isSavingsGroup } from '../utils/budgetCalcs'

const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtFull = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Colour palette — distinct, works on white background
const SECTION_COLOURS = {
  starling: '#58a2a7',
  current:  '#e63119',
  monzo:    '#629d95',
}
const GROUP_COLOURS = [
  '#58a2a7','#629d95','#e63119','#829c63','#dbd224',
  '#468186','#4f7d77','#afa81d','#687c50','#b82714',
  '#3b5e59','#356164','#4e5d3c','#847e15','#82b0aa',
]

// ── Chart data sources for custom chart builder ──────────────────────
const CHART_DATA_SOURCES = [
  {
    id: 'spending-groups',
    label: '💸 Spending by Group',
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
    id: 'savings-breakdown',
    label: '🏦 Savings Breakdown',
    getChartData: (budget) => {
      const { pensionContribution, isaContribution, budgetedSavings, surplus } = calcBudgetSummary(budget)
      return [
        { name: 'Pension', value: pensionContribution },
        { name: 'ISA', value: isaContribution },
        { name: 'Savings Groups', value: budgetedSavings },
        surplus > 0 ? { name: 'Surplus', value: surplus } : null,
      ].filter(Boolean).filter(d => d.value > 0)
    },
  },
  {
    id: 'holiday-progress',
    label: '✈️ Holiday Budgets',
    getChartData: (budget) => {
      return (budget?.holidays?.trips || [])
        .map(t => ({ name: t.destination.replace(/\p{Emoji}/gu, '').trim().slice(0, 22), value: t.totalBudget }))
        .filter(d => d.value > 0)
    },
  },
  {
    id: 'goal-progress',
    label: '🎯 Goal Progress',
    getChartData: (budget) => {
      return (budget?.settings?.goals || [])
        .map(g => ({ name: g.name, value: g.current, target: g.target }))
        .filter(d => d.value >= 0)
    },
  },
  {
    id: 'income-expenses',
    label: '📊 Income vs Spending',
    getChartData: (budget) => {
      const { totalIncome, budgetedSpending, budgetedSavings } = calcBudgetSummary(budget)
      return [
        { name: 'Income', value: totalIncome },
        { name: 'Spending', value: budgetedSpending },
        { name: 'Savings', value: budgetedSavings },
      ]
    },
  },
]

const CHART_TYPES = [
  { id: 'bar-h', label: 'Horizontal Bar', compatibleSources: ['spending-groups', 'holiday-progress', 'goal-progress'] },
  { id: 'bar-v', label: 'Vertical Bar',   compatibleSources: ['spending-groups', 'savings-breakdown', 'holiday-progress', 'goal-progress', 'income-expenses'] },
  { id: 'donut', label: 'Donut / Pie',    compatibleSources: ['spending-groups', 'savings-breakdown', 'goal-progress'] },
]

// ── Savings rate gauge ───────────────────────────────────────────────
function SavingsGauge({ rate, target }) {
  const t = target || 10
  const maxScale = Math.max(40, t * 2)
  const clamped = Math.min(Math.max(parseFloat(rate), 0), maxScale)
  const fill = clamped < t * 0.5 ? '#e63119' : clamped < t ? '#dbd224' : clamped < t * 1.5 ? '#829c63' : '#4f7d77'
  const data = [{ value: clamped, fill }, { value: maxScale - clamped, fill: '#e0ebea' }]

  const label = clamped < t * 0.5 ? `⚠️ Below ${Math.round(t * 0.5)}%` :
    clamped < t ? `🟡 Getting there (target ${t}%)` :
    clamped < t * 1.5 ? `✅ Healthy` : '🌟 Excellent'

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">💚 Savings Rate</h3>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="80%"
            startAngle={180} endAngle={0}
            innerRadius={55} outerRadius={75}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-10">
        <div className="text-3xl font-bold" style={{ color: fill }}>{rate}%</div>
        <div className="text-xs text-ash-grey-400 mt-1">{label}</div>
      </div>
      <div className="flex justify-between w-full text-xs text-ash-grey-400 mt-3 px-2">
        <span>0%</span><span>Target: {t}%+</span><span>{maxScale}%</span>
      </div>
    </div>
  )
}

// ── Income vs Expenses vs Surplus ───────────────────────────────────
function IncomeExpenseBar({ totalIncome, totalExpenses, surplus }) {
  const data = [
    { name: 'Income',   value: totalIncome,   fill: '#829c63' },
    { name: 'Expenses', value: totalExpenses,  fill: '#dbd224' },
    { name: 'Surplus',  value: Math.max(surplus, 0), fill: surplus >= 0 ? '#58a2a7' : '#e63119' },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{payload[0].payload.name}</p>
        <p style={{ color: payload[0].payload.fill }}>{fmtFull(payload[0].value)}/month</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-4">📊 Income vs Expenses vs Surplus</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#629d95' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff5f4' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={70}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {surplus < 0 && (
        <p className="text-xs text-red-500 mt-2 text-center">⚠️ Expenses exceed income by {fmtFull(Math.abs(surplus))}/month</p>
      )}
    </div>
  )
}

// ── Expenses by section donut ────────────────────────────────────────
function SectionDonut({ sections }) {
  const data = sections
    .map(sec => ({
      name: sec.name.replace(/[⭐💳💜]/g, '').trim(),
      value: sec.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0),
      id: sec.id,
    }))
    .filter(d => d.value > 0)

  if (data.length === 0) return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5 flex items-center justify-center h-full min-h-[260px]">
      <p className="text-sm text-ash-grey-400">No expense data yet</p>
    </div>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{payload[0].name}</p>
        <p style={{ color: SECTION_COLOURS[payload[0].payload.id] || '#888' }}>
          {fmtFull(payload[0].value)}/month
        </p>
        <p className="text-ash-grey-400">{((payload[0].value / total) * 100).toFixed(1)}%</p>
      </div>
    )
  }

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-2">🍩 Spend by Account</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={90}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={SECTION_COLOURS[entry.id] || '#888'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ fontSize: 12, color: '#4f7d77' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
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
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5 flex items-center justify-center min-h-[260px]">
      <p className="text-sm text-ash-grey-400">No expense data yet</p>
    </div>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{payload[0].payload.name}</p>
        <p className="text-tropical-teal-600">{fmtFull(payload[0].value)}/month</p>
        <p className="text-ash-grey-400">{fmtFull(payload[0].value * 12)}/year</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-4">📋 Spend by Group (top {top.length})</h3>
      <ResponsiveContainer width="100%" height={Math.max(top.length * 36, 180)}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e0ebea" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#3b5e59' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff5f4' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', formatter: fmt, fontSize: 11, fill: '#629d95' }}>
            {top.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Holiday budget progress ──────────────────────────────────────────
function HolidayProgress({ budget }) {
  const trips = budget?.holidays?.trips || []
  if (trips.length === 0) return null

  const data = trips.map(trip => {
    const b = trip.budget || {}
    const committed = ['flights', 'accommodation', 'onGround']
      .reduce((s, k) => s + (b[k]?.budgeted ?? 0), 0)
    return {
      name: trip.destination,
      totalBudget: trip.totalBudget,
      committed: Math.min(committed, trip.totalBudget),
      status: trip.status,
    }
  })

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-4">✈️ Holiday Budget Progress</h3>
      <div className="space-y-5">
        {data.map((trip, i) => {
          const pct = trip.totalBudget > 0 ? (trip.committed / trip.totalBudget) * 100 : 0
          const color = trip.status === 'booked' ? '#58a2a7' : '#dbd224'
          const remaining = Math.max(trip.totalBudget - trip.committed, 0)
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-ash-grey-700 truncate max-w-[60%]">{trip.name}</span>
                <span className="text-ash-grey-500 tabular-nums">{fmt(trip.committed)} / {fmt(trip.totalBudget)}</span>
              </div>
              <div className="w-full bg-ash-grey-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                />
              </div>
              <div className="flex justify-between text-xs text-ash-grey-400 mt-1">
                <span>{trip.status === 'booked' ? '✓ Booked' : '📅 Planned'}</span>
                <span>{fmt(remaining)} unallocated</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Savings breakdown donut ──────────────────────────────────────────
function SavingsBreakdown({ budget }) {
  const { pensionContribution, isaContribution, budgetedSavings, surplus } = calcBudgetSummary(budget)
  const data = [
    { name: 'Pension',        value: pensionContribution, fill: '#58a2a7' },
    { name: 'ISA',            value: isaContribution,     fill: '#829c63' },
    { name: 'Savings Groups', value: budgetedSavings,     fill: '#629d95' },
    surplus > 0 ? { name: 'Surplus', value: surplus, fill: '#dbd224' } : null,
  ].filter(Boolean).filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) return null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }}>{fmtFull(payload[0].value)}/month</p>
        <p className="text-ash-grey-400">{((payload[0].value / total) * 100).toFixed(1)}%</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-2">💰 Savings Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#4f7d77' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-sm font-semibold text-ash-grey-700 mt-1">{fmtFull(total)}/month total</p>
    </div>
  )
}

// ── Spend as % of income donut ───────────────────────────────────────
function SectionIncomeDonut({ sections, totalIncome }) {
  const data = sections
    .map(sec => ({
      name: sec.name.replace(/[⭐💳💜]/g, '').trim(),
      value: sec.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0),
      id: sec.id,
    }))
    .filter(d => d.value > 0)

  if (!totalIncome || data.length === 0) return null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const pct = ((payload[0].value / totalIncome) * 100).toFixed(1)
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{payload[0].name}</p>
        <p style={{ color: SECTION_COLOURS[payload[0].payload.id] || '#888' }}>{fmtFull(payload[0].value)}/month</p>
        <p className="text-ash-grey-400">{pct}% of income</p>
      </div>
    )
  }

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.06) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
        {`${((percent) * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">🍩 Spend as % of Income</h3>
      <p className="text-xs text-ash-grey-400 mb-2">How much of your take-home goes to each account</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={82} dataKey="value"
            labelLine={false} label={renderLabel} strokeWidth={0}>
            {data.map((entry) => <Cell key={entry.id} fill={SECTION_COLOURS[entry.id] || '#888'} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => <span style={{ fontSize: 12, color: '#4f7d77' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Stacked bank bar (all groups, coloured by section) ───────────────
function StackedBankBar({ sections }) {
  const fills = {}
  const row = {}
  sections.forEach(sec => {
    sec.groups.forEach(g => {
      if (!isSavingsGroup(g)) {
        const total = g.items.reduce((s, i) => s + i.monthly, 0)
        if (total > 0) {
          const key = g.name.replace(/[^\w\s]/g, '').trim().slice(0, 22)
          row[key] = total
          fills[key] = SECTION_COLOURS[sec.id] || '#888'
        }
      }
    })
  })

  const groupKeys = Object.keys(row).sort((a, b) => row[b] - row[a])
  if (groupKeys.length === 0) return null
  const data = [row]

  const legendItems = Object.entries(SECTION_COLOURS).map(([id, color]) => ({
    id,
    color,
    name: sections.find(s => s.id === id)?.name.replace(/[⭐💳💜]/g, '').trim() || id,
  }))

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">📊 All Spending Groups by Bank</h3>
      <p className="text-xs text-ash-grey-400 mb-3">Each segment = one group; colour = which account it lives in</p>
      <div className="flex gap-3 mb-3 flex-wrap">
        {legendItems.map(l => (
          <div key={l.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-ash-grey-500">{l.name}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={70}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis type="category" hide />
          <Tooltip
            formatter={(value, name) => [fmtFull(value), name]}
            cursor={{ fill: '#eff5f4' }}
            wrapperStyle={{ fontSize: 12 }}
          />
          {groupKeys.map(k => (
            <Bar key={k} dataKey={k} stackId="groups" fill={fills[k]} maxBarSize={36}>
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── "Where does the money go" waterfall ──────────────────────────────
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
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-ash-grey-700">{entry.payload.name}</p>
        <p style={{ color: entry.fill }}>{fmtFull(entry.value)}/month</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">🌊 Where Does the Money Go?</h3>
      <p className="text-xs text-ash-grey-400 mb-3">Salary flows down through each account to surplus</p>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 44, 200)}>
        <ComposedChart data={rows} layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e0ebea" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, totalIncome]} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#3b5e59' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff5f4' }} />
          <Bar dataKey="base" stackId="wf" fill="transparent" strokeWidth={0} />
          <Bar dataKey="value" stackId="wf" radius={[0, 6, 6, 0]} maxBarSize={28}
            label={{ position: 'right', formatter: fmt, fontSize: 11, fill: '#629d95' }}>
            {rows.map((entry, i) => (
              <Cell key={i} fill={
                entry.type === 'income'  ? '#829c63' :
                entry.type === 'surplus' ? '#58a2a7' :
                entry.type === 'deficit' ? '#e63119' :
                SECTION_COLOURS[entry.sectionId] || '#888'
              } />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Custom chart renderer ────────────────────────────────────────────
function CustomChart({ dataSourceId, chartTypeId, budget }) {
  const source = CHART_DATA_SOURCES.find(s => s.id === dataSourceId)
  const chartType = CHART_TYPES.find(t => t.id === chartTypeId)
  if (!source || !chartType) return null

  const data = source.getChartData(budget)
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-ash-grey-400 text-sm">No data available</div>
  }

  if (chartType.id === 'bar-h') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(data.length * 38, 160)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e0ebea" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#3b5e59' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [fmtFull(v), '']} cursor={{ fill: '#eff5f4' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', formatter: fmt, fontSize: 11, fill: '#629d95' }}>
            {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType.id === 'bar-v') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#629d95' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip formatter={(v) => [fmtFull(v), '']} cursor={{ fill: '#eff5f4' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType.id === 'donut') {
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [fmtFull(v), `${((v / total) * 100).toFixed(1)}%`]} />
          <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#4f7d77' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return null
}

// ── Chart builder modal ──────────────────────────────────────────────
function ChartBuilderModal({ budget, onAdd, onClose }) {
  const [step, setStep] = useState(1)
  const [dataSourceId, setDataSourceId] = useState(null)
  const [chartTypeId, setChartTypeId] = useState(null)

  const availableTypes = dataSourceId
    ? CHART_TYPES.filter(t => t.compatibleSources.includes(dataSourceId))
    : []

  const handleSelectSource = (id) => {
    setDataSourceId(id)
    setChartTypeId(null)
    setStep(2)
  }

  return (
    <div className="fixed inset-0 bg-ash-grey-950/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ash-grey-800">
            {step === 1 ? '① Pick a data source' : '② Pick a chart type'}
          </h2>
          <button onClick={onClose} className="text-ash-grey-400 hover:text-ash-grey-600 text-2xl leading-none">&times;</button>
        </div>

        {step === 1 && (
          <div className="space-y-2">
            {CHART_DATA_SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => handleSelectSource(source.id)}
                className="w-full text-left px-4 py-3 rounded-lg border border-ash-grey-200 hover:border-tropical-teal-500 hover:bg-tropical-teal-50 transition-colors"
              >
                <span className="text-sm font-medium text-ash-grey-700">{source.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <button onClick={() => setStep(1)} className="text-xs text-ash-grey-400 hover:text-ash-grey-600 flex items-center gap-1 mb-3">
              ← Back
            </button>
            {availableTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setChartTypeId(type.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  chartTypeId === type.id
                    ? 'border-tropical-teal-500 bg-tropical-teal-50'
                    : 'border-ash-grey-200 hover:border-tropical-teal-400 hover:bg-ash-grey-50'
                }`}
              >
                <span className="text-sm font-medium text-ash-grey-700">{type.label}</span>
              </button>
            ))}
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 border border-ash-grey-300 text-ash-grey-700 px-4 py-2 rounded-lg text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (dataSourceId && chartTypeId) {
                    onAdd({ id: `chart-${Date.now()}`, dataSourceId, chartTypeId })
                    onClose()
                  }
                }}
                disabled={!chartTypeId}
                className="flex-1 bg-tropical-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tropical-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Chart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────
export default function Charts({ budget }) {
  const { totalIncome, totalExpenses, surplus, savingsRate } = calcBudgetSummary(budget)
  const savingsRateFmt = savingsRate.toFixed(1)
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10

  const [customCharts, setCustomCharts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('customCharts') || '[]') } catch { return [] }
  })
  const [showBuilder, setShowBuilder] = useState(false)

  useEffect(() => {
    localStorage.setItem('customCharts', JSON.stringify(customCharts))
  }, [customCharts])

  const hasData = totalIncome > 0 || totalExpenses > 0

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-10 text-center text-ash-grey-400">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm">Add some income and expenses to see your charts</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Income/Expense bar + Savings gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <IncomeExpenseBar totalIncome={totalIncome} totalExpenses={totalExpenses} surplus={surplus} />
        </div>
        <SavingsGauge rate={savingsRateFmt} target={savingsRateTarget} />
      </div>

      {/* Row 2: Section donut + Group breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionDonut sections={budget.sections} />
        <GroupBreakdown sections={budget.sections} />
      </div>

      {/* Row 3: Holiday Progress + Savings Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HolidayProgress budget={budget} />
        <SavingsBreakdown budget={budget} />
      </div>

      {/* Row 4: Spending Breakdown section */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold text-ash-grey-500 uppercase tracking-wide mb-3">💸 Spending Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionIncomeDonut sections={budget.sections} totalIncome={totalIncome} />
          <StackedBankBar sections={budget.sections} />
        </div>
      </div>

      {/* Row 5: Waterfall */}
      <WaterfallChart sections={budget.sections} totalIncome={totalIncome} />

      {/* Custom charts */}
      {customCharts.map(chart => {
        const source = CHART_DATA_SOURCES.find(s => s.id === chart.dataSourceId)
        const chartType = CHART_TYPES.find(t => t.id === chart.chartTypeId)
        return (
          <div key={chart.id} className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-ash-grey-600">{source?.label}</h3>
                <span className="text-xs text-ash-grey-400">{chartType?.label}</span>
              </div>
              <button
                onClick={() => setCustomCharts(prev => prev.filter(c => c.id !== chart.id))}
                className="text-ash-grey-300 hover:text-vibrant-coral-500 text-xl leading-none"
                title="Remove chart"
              >
                ×
              </button>
            </div>
            <CustomChart dataSourceId={chart.dataSourceId} chartTypeId={chart.chartTypeId} budget={budget} />
          </div>
        )
      })}

      {/* Add chart button */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={() => setShowBuilder(true)}
          className="px-5 py-2.5 rounded-lg border-2 border-dashed border-ash-grey-300 text-ash-grey-400 hover:border-tropical-teal-400 hover:text-tropical-teal-600 text-sm transition-colors"
        >
          + Add Chart
        </button>
      </div>

      {showBuilder && (
        <ChartBuilderModal
          budget={budget}
          onAdd={(chart) => setCustomCharts(prev => [...prev, chart])}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  )
}

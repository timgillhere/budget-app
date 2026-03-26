import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar
} from 'recharts'

const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtFull = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Colour palette — distinct, works on white background
const SECTION_COLOURS = {
  starling: '#2E75B6',
  current:  '#C55A11',
  monzo:    '#7030A0',
}
const GROUP_COLOURS = [
  '#2E75B6','#7030A0','#C55A11','#70AD47','#ED7D31',
  '#4472C4','#9C27B0','#F4B942','#00897B','#E53935',
  '#5E35B1','#1E88E5','#43A047','#FB8C00','#8D6E63',
]

// ── Savings rate gauge ───────────────────────────────────────────────
function SavingsGauge({ rate }) {
  const clamped = Math.min(Math.max(parseFloat(rate), 0), 30)
  const fill = clamped < 5 ? '#EF5350' : clamped < 10 ? '#FFA726' : '#66BB6A'
  const data = [{ value: clamped, fill }, { value: 30 - clamped, fill: '#F0F0F0' }]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-gray-600 mb-1">💚 Savings Rate</h3>
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
        <div className="text-xs text-gray-400 mt-1">
          {clamped < 5 ? '⚠️ Below 5%' : clamped < 10 ? '🟡 Getting there' : clamped < 15 ? '✅ Healthy' : '🌟 Excellent'}
        </div>
      </div>
      <div className="flex justify-between w-full text-xs text-gray-400 mt-3 px-2">
        <span>0%</span><span>Target: 10%+</span><span>30%</span>
      </div>
    </div>
  )
}

// ── Income vs Expenses vs Surplus ───────────────────────────────────
function IncomeExpenseBar({ totalIncome, totalExpenses, surplus }) {
  const data = [
    { name: 'Income',   value: totalIncome,   fill: '#70AD47' },
    { name: 'Expenses', value: totalExpenses,  fill: '#ED7D31' },
    { name: 'Surplus',  value: Math.max(surplus, 0), fill: surplus >= 0 ? '#2E75B6' : '#EF5350' },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-gray-700">{payload[0].payload.name}</p>
        <p style={{ color: payload[0].payload.fill }}>{fmtFull(payload[0].value)}/month</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">📊 Income vs Expenses vs Surplus</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-center h-full min-h-[260px]">
      <p className="text-sm text-gray-400">No expense data yet</p>
    </div>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-gray-700">{payload[0].name}</p>
        <p style={{ color: SECTION_COLOURS[payload[0].payload.id] || '#888' }}>
          {fmtFull(payload[0].value)}/month
        </p>
        <p className="text-gray-400">{((payload[0].value / total) * 100).toFixed(1)}%</p>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">🍩 Spend by Account</h3>
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
            formatter={(value) => <span style={{ fontSize: 12, color: '#4B5563' }}>{value}</span>}
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-center min-h-[260px]">
      <p className="text-sm text-gray-400">No expense data yet</p>
    </div>
  )

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-gray-700">{payload[0].payload.name}</p>
        <p className="text-blue-600">{fmtFull(payload[0].value)}/month</p>
        <p className="text-gray-400">{fmtFull(payload[0].value * 12)}/year</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">📋 Spend by Group (top {top.length})</h3>
      <ResponsiveContainer width="100%" height={Math.max(top.length * 36, 180)}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', formatter: fmt, fontSize: 11, fill: '#6B7280' }}>
            {top.map((_, i) => <Cell key={i} fill={GROUP_COLOURS[i % GROUP_COLOURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────
export default function Charts({ budget }) {
  const totalIncome = budget.income.items.reduce((s, i) => s + i.monthly, 0)
  const totalExpenses = budget.sections.reduce((s, sec) =>
    s + sec.groups.reduce((gs, g) =>
      gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
  const surplus = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? ((surplus / totalIncome) * 100).toFixed(1) : '0.0'

  const hasData = totalIncome > 0 || totalExpenses > 0

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
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
        <SavingsGauge rate={savingsRate} />
      </div>

      {/* Row 2: Section donut + Group breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionDonut sections={budget.sections} />
        <GroupBreakdown sections={budget.sections} />
      </div>
    </div>
  )
}

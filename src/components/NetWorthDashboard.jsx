import { useState } from 'react'
import { useBudget } from '../context/BudgetContext'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine } from 'recharts'
import { calcBudgetSummary } from '../utils/budgetCalcs'

const fmt = (n) => `£${Math.round(n || 0).toLocaleString('en-GB')}`
const fmtK = (n) => n >= 1000 ? `£${(n/1000).toFixed(0)}k` : fmt(n)

export default function NetWorthDashboard() {
  const { data, save } = useBudget()
  const [snapFlash, setSnapFlash] = useState(false)
  if (!data) return null

  const s = data.settings || {}
  const snapshots = data.netWorth?.snapshots || []

  const isa     = s.isaBalance || 0
  const pension = s.pensionBalance || 0
  const propVal = s.propertyValue || 0
  const mortgage = s.mortgageBalance || 0
  const buffer  = s.bufferBalance || 0
  const equity  = propVal - mortgage

  const total = isa + pension + equity + buffer

  const breakdown = [
    { name: 'Property Equity', value: equity,  fill: '#FFC000' },
    { name: 'ISA',             value: isa,     fill: '#70AD47' },
    { name: 'Pension',         value: pension, fill: '#2E75B6' },
    { name: 'Buffer',          value: buffer,  fill: '#7030A0' },
  ].filter(d => d.value > 0)

  const snapshotChartData = snapshots.map(s => ({ ...s, date: s.date.slice(0, 7) }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-xs">
        <p className="font-semibold text-ash-grey-700 mb-1">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.fill || p.color }}>{p.name}: {fmt(p.value)}</p>)}
      </div>
    )
  }

  // Add snapshot
  const addSnapshot = () => {
    const today = new Date().toISOString().slice(0, 10)
    const { surplus } = calcBudgetSummary(data)
    const newSnap = { date: today, isa, pension, propertyEquity: equity, buffer, other: 0, total, surplus: Math.round(surplus) }
    const existing = snapshots.filter(s => s.date.slice(0, 7) !== today.slice(0, 7))
    save({ ...data, netWorth: { snapshots: [...existing, newSnap].sort((a, b) => a.date.localeCompare(b.date)) } })
    setSnapFlash(true)
    setTimeout(() => setSnapFlash(false), 3000)
  }

  const tiles = [
    { label: '🏠 Property Equity',  value: equity,  sub: `£${propVal.toLocaleString('en-GB')} value − £${mortgage.toLocaleString('en-GB')} mortgage`, colour: 'text-lemon-chiffon-600' },
    { label: '📈 Vanguard ISA',     value: isa,     sub: `Update in Settings`, colour: 'text-soft-linen-700' },
    { label: '🏦 Pension',          value: pension, sub: `£${s.pensionMonthlyContribution || 537}/month contributions`, colour: 'text-tropical-teal-600' },
    { label: '🛡️ Buffer',           value: buffer,  sub: `~${Math.round(buffer / ((data.sections.reduce((t, sec) => t + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)) / 12 * 12))} months expenses`, colour: 'text-tropical-teal-600' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Total */}
      <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-6 text-center">
        <p className="text-sm text-ash-grey-500 font-medium mb-1">Total Net Worth</p>
        <p className="text-5xl font-bold text-ash-grey-800">{fmt(total)}</p>
        <p className="text-sm text-ash-grey-400 mt-2">Age {s.currentAge || 38} · Target retirement at {s.retirementAge || 66}</p>
        <button onClick={addSnapshot}
          className={`mt-3 text-xs border px-3 py-1.5 rounded-lg transition-all ${snapFlash ? 'bg-soft-linen-100 border-soft-linen-300 text-soft-linen-700' : 'text-tropical-teal-600 hover:text-tropical-teal-700 border-tropical-teal-200 hover:bg-tropical-teal-50'}`}>
          {snapFlash ? '✓ Snapshot saved!' : '📸 Snapshot today\'s values'}
        </button>
        <p className="text-xs text-ash-grey-400 mt-1.5">Saves ISA, pension, property equity & buffer from Settings — do this monthly to build the chart below</p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-4">
            <p className="text-xs text-ash-grey-500 font-medium">{t.label}</p>
            <p className={`text-2xl font-bold mt-1 ${t.colour}`}>{fmtK(t.value)}</p>
            <p className="text-xs text-ash-grey-400 mt-0.5">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Donut + snapshot chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ash-grey-600 mb-3">Allocation breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={breakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                dataKey="value" strokeWidth={0}>
                {breakdown.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ fontSize: 11, color: '#4B5563' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ash-grey-600">Net worth over time</h3>
            <p className="text-xs text-ash-grey-400 mt-0.5">
              Total = ISA + Pension + (Property value − Mortgage) + Buffer · Balances are manually updated in ⚙️ Settings
            </p>
            {snapshots.length < 2 && (
              <p className="text-xs text-amber-600 mt-0.5">Take a snapshot monthly — the chart needs at least 2 data points to draw a line.</p>
            )}
          </div>
          {snapshotChartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={snapshotChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" stroke="#2E75B6" fill="#DBEAFE" strokeWidth={2} name="Net Worth" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-ash-grey-400 text-sm gap-2">
              <span className="text-2xl">📸</span>
              <p>Click "Snapshot today's values" monthly</p>
              <p className="text-xs">to build your net worth timeline</p>
            </div>
          )}
        </div>
      </div>

      {/* Buffer over time */}
      {snapshotChartData.length >= 2 && (
        <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">🛡️ Buffer balance over time</h3>
          <p className="text-xs text-ash-grey-400 mb-3">Emergency fund growth from monthly snapshots</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={snapshotChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={10000} stroke="#dbd224" strokeDasharray="4 3" label={{ value: '£10k target', position: 'right', fontSize: 9, fill: '#a09818' }} />
              <Area type="monotone" dataKey="buffer" stroke="#629d95" fill="#deeced" strokeWidth={2} name="Buffer" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly surplus over time */}
      {snapshotChartData.filter(s => s.surplus != null).length >= 2 && (
        <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ash-grey-600 mb-1">📈 Monthly surplus over time</h3>
          <p className="text-xs text-ash-grey-400 mb-3">Budgeted surplus captured at each monthly snapshot</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={snapshotChartData.filter(s => s.surplus != null)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#e63119" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="surplus" stroke="#58a2a7" strokeWidth={2} dot={{ r: 3 }} name="Surplus" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-ash-grey-400 text-center">Balances are manually maintained. Update them in ⚙️ Settings.</p>
    </div>
  )
}

import { useBudget } from '../context/BudgetContext'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

const fmt = (n) => `£${Math.round(n || 0).toLocaleString('en-GB')}`
const fmtK = (n) => n >= 1000 ? `£${(n/1000).toFixed(0)}k` : fmt(n)

export default function NetWorthDashboard() {
  const { data, save } = useBudget()
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
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.fill || p.color }}>{p.name}: {fmt(p.value)}</p>)}
      </div>
    )
  }

  // Add snapshot
  const addSnapshot = () => {
    const today = new Date().toISOString().slice(0, 10)
    const newSnap = { date: today, isa, pension, propertyEquity: equity, buffer, other: 0, total }
    const existing = snapshots.filter(s => s.date.slice(0, 7) !== today.slice(0, 7))
    save({ ...data, netWorth: { snapshots: [...existing, newSnap].sort((a, b) => a.date.localeCompare(b.date)) } })
  }

  const tiles = [
    { label: '🏠 Property Equity',  value: equity,  sub: `£${propVal.toLocaleString('en-GB')} value − £${mortgage.toLocaleString('en-GB')} mortgage`, colour: 'text-amber-600' },
    { label: '📈 Vanguard ISA',     value: isa,     sub: `Update in Settings`, colour: 'text-green-700' },
    { label: '🏦 Pension',          value: pension, sub: `£${s.pensionMonthlyContribution || 537}/month contributions`, colour: 'text-blue-700' },
    { label: '🛡️ Buffer',           value: buffer,  sub: `~${Math.round(buffer / ((data.sections.reduce((t, sec) => t + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)) / 12 * 12))} months expenses`, colour: 'text-purple-700' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-500 font-medium mb-1">Total Net Worth</p>
        <p className="text-5xl font-bold text-gray-800">{fmt(total)}</p>
        <p className="text-sm text-gray-400 mt-2">Age {s.currentAge || 38} · Target retirement at {s.retirementAge || 66}</p>
        <button onClick={addSnapshot}
          className="mt-3 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
          📸 Snapshot today's values
        </button>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium">{t.label}</p>
            <p className={`text-2xl font-bold mt-1 ${t.colour}`}>{fmtK(t.value)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Donut + snapshot chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Allocation breakdown</h3>
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Net worth over time
            {snapshots.length < 2 && <span className="ml-2 text-xs text-gray-400">(snapshot monthly to build this chart)</span>}
          </h3>
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
            <div className="h-44 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <span className="text-2xl">📸</span>
              <p>Click "Snapshot today's values" monthly</p>
              <p className="text-xs">to build your net worth timeline</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">Balances are manually maintained. Update them in ⚙️ Settings.</p>
    </div>
  )
}

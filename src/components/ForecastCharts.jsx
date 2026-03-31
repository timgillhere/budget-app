import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts'
import { useBudget } from '../context/BudgetContext'

const fmt = (n) => `£${Math.round(Math.abs(n)).toLocaleString('en-GB')}`
const fmtK = (n) => n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${Math.round(n)}`

const HORIZONS = [
  { label: 'End 2026',    months: () => monthsUntil(new Date('2026-12-31')) },
  { label: '2 Years',     months: () => 24 },
  { label: '5 Years',     months: () => 60 },
  { label: '10 Years',    months: () => 120 },
  { label: 'Retirement',  months: (s) => (s.retirementAge - s.currentAge) * 12 },
]

function monthsUntil(date) {
  const now = new Date()
  return Math.max(1, (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth()))
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function fmtMonth(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function confidence(months) {
  if (months <= 6)  return { label: 'High ✅',        color: 'text-soft-linen-600', band: false }
  if (months <= 24) return { label: 'Moderate 🟡',    color: 'text-lemon-chiffon-600', band: true }
  return              { label: 'Illustrative 📊',      color: 'text-tropical-teal-600', band: true }
}

// ── Projections ──────────────────────────────────────────────────────

function buildSurplus(data, settings, months) {
  const base = calcSurplus(data)
  const points = []
  const now = new Date()
  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    const dateStr = d.toISOString().slice(0, 7)
    let s = base
    const vanEnd = new Date(settings.vanCostsEndDate)
    const payRise = new Date(settings.expectedPayRiseDate)
    if (d >= vanEnd)  s += settings.vanCostMonthly || 0
    if (d >= payRise) s += settings.expectedPayRiseMonthly || 0
    const event = getEvent(d, settings)
    points.push({ date: dateStr, surplus: Math.round(s), event })
  }
  return points
}

function buildMortgage(settings, months) {
  const points = []
  let balance = settings.mortgageBalance
  const monthlyRate = settings.mortgageRate / 100 / 12
  const payment = settings.mortgageMonthlyPayment
  const now = new Date()
  const remortgageDate = new Date(settings.mortgageEndDate)

  for (let i = 0; i < months && balance > 0; i++) {
    const d = addMonths(now, i)
    const rate = d > remortgageDate ? settings.mortgageRateAfterRemortgage / 100 / 12 : monthlyRate
    const interest = balance * rate
    balance = Math.max(0, balance + interest - payment)
    points.push({ date: d.toISOString().slice(0, 7), balance: Math.round(balance) })
  }
  return points
}

function buildISA(settings, months) {
  const points = []
  let base = settings.isaBalance
  let opt = base
  let pess = base
  const r = settings.investmentGrowthRatePct / 100 / 12
  const contrib = settings.isaMonthlyContribution || 0
  const now = new Date()
  const payRise = new Date(settings.expectedPayRiseDate)

  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    let c = contrib
    if (d >= payRise) c += (settings.expectedPayRiseMonthly || 0) * 0.5 // assume 50% of rise goes to ISA
    base = base * (1 + r) + c
    opt  = opt  * (1 + r * 1.3) + c
    pess = pess * (1 + r * 0.7) + c
    points.push({ date: d.toISOString().slice(0, 7), base: Math.round(base), optimistic: Math.round(opt), pessimistic: Math.round(pess) })
  }
  return points
}

function buildPension(settings, months) {
  const points = []
  let base = settings.pensionBalance
  let opt = base, pess = base
  const r = settings.investmentGrowthRatePct / 100 / 12
  const contrib = settings.pensionMonthlyContribution || 537
  const now = new Date()

  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    base = base * (1 + r) + contrib
    opt  = opt  * (1 + r * 1.3) + contrib
    pess = pess * (1 + r * 0.7) + contrib
    points.push({ date: d.toISOString().slice(0, 7), base: Math.round(base), optimistic: Math.round(opt), pessimistic: Math.round(pess) })
  }
  return points
}

function buildNetWorth(settings, months) {
  const points = []
  let mortgage = settings.mortgageBalance
  let isa = settings.isaBalance
  let pension = settings.pensionBalance
  let propVal = settings.propertyValue
  const r = settings.investmentGrowthRatePct / 100 / 12
  const propR = settings.propertyGrowthRatePct / 100 / 12
  const monthlyRate = settings.mortgageRate / 100 / 12
  const payment = settings.mortgageMonthlyPayment
  const remortgageDate = new Date(settings.mortgageEndDate)
  const now = new Date()

  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    const mRate = d > remortgageDate ? settings.mortgageRateAfterRemortgage/100/12 : monthlyRate
    if (mortgage > 0) mortgage = Math.max(0, mortgage + mortgage * mRate - payment)
    isa = isa * (1 + r) + (settings.isaMonthlyContribution || 0)
    pension = pension * (1 + r) + (settings.pensionMonthlyContribution || 537)
    propVal = propVal * (1 + propR)
    const equity = propVal - mortgage
    const total = Math.round(isa + pension + equity + (settings.bufferBalance || 0))
    points.push({ date: d.toISOString().slice(0, 7), netWorth: total, isa: Math.round(isa), pension: Math.round(pension), equity: Math.round(equity) })
  }
  return points
}

function getEvent(date, settings) {
  const m = date.toISOString().slice(0, 7)
  if (m === new Date(settings.vanCostsEndDate).toISOString().slice(0, 7)) return '🚐 Van ends'
  if (m === new Date(settings.expectedPayRiseDate).toISOString().slice(0, 7)) return '💰 Pay rise'
  if (m === new Date(settings.mortgageEndDate).toISOString().slice(0, 7).slice(0, 7)) return '🏠 Remortgage'
  return null
}

function calcSurplus(data) {
  const inc = data.income.items.reduce((s, i) => s + i.monthly, 0)
  const exp = data.sections.reduce((s, sec) =>
    s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
  return inc - exp
}

// ── Custom tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-ash-grey-200 rounded-lg px-3 py-2 shadow text-xs">
      <p className="font-semibold text-ash-grey-700 mb-1">{fmtMonth(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, confidence: conf, assumptions, children }) {
  const [showAssumptions, setShowAssumptions] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ash-grey-700">{title}</h3>
          {subtitle && <p className="text-xs text-ash-grey-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${conf.color}`}>{conf.label}</span>
          {assumptions && (
            <button onClick={() => setShowAssumptions(s => !s)} className="text-xs text-ash-grey-400 hover:text-ash-grey-600">
              {showAssumptions ? '▲' : '▼'} assumptions
            </button>
          )}
        </div>
      </div>
      {showAssumptions && assumptions && (
        <div className="mb-3 bg-ash-grey-50 rounded-lg p-3 text-xs text-ash-grey-600 space-y-0.5">
          {assumptions.map((a, i) => <p key={i}>• {a}</p>)}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Thin tick labels to avoid overlap ───────────────────────────────
function tickEvery(data, n) {
  return data.map((d, i) => i % n === 0 ? d.date : '')
}

export default function ForecastCharts() {
  const { data } = useBudget()
  const [horizonIdx, setHorizonIdx] = useState(1)

  const settings = data?.settings || {}
  const months = HORIZONS[horizonIdx].months(settings)
  const conf = confidence(months)
  const tick = months > 60 ? Math.floor(months / 10) : months > 24 ? 6 : 3

  const mortgage = useMemo(() => buildMortgage(settings, months),       [settings, months])
  const isa      = useMemo(() => buildISA(settings, months),            [settings, months])
  const pension  = useMemo(() => buildPension(settings, months),        [settings, months])
  const networth = useMemo(() => buildNetWorth(settings, months),       [settings, months])

  if (!data) return null

  const retirementMonth = addMonths(new Date(), (settings.retirementAge - settings.currentAge) * 12).toISOString().slice(0, 7)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Horizon picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ash-grey-600">Forecast horizon:</span>
        <div className="flex gap-2">
          {HORIZONS.map((h, i) => (
            <button
              key={h.label}
              onClick={() => setHorizonIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                horizonIdx === i ? 'bg-tropical-teal-600 text-white' : 'bg-ash-grey-100 text-ash-grey-600 hover:bg-ash-grey-200'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <span className={`ml-auto text-xs font-medium ${conf.color}`}>{conf.label}</span>
      </div>

      {/* 1. Mortgage balance */}
      <ChartCard
        title="🏠 Mortgage Balance"
        confidence={conf}
        assumptions={[
          `Current balance: £${settings.mortgageBalance?.toLocaleString('en-GB')}`,
          `Rate: ${settings.mortgageRate}% until ${new Date(settings.mortgageEndDate).toLocaleDateString('en-GB', {month:'short',year:'numeric'})}`,
          `Post-remortgage rate assumed: ${settings.mortgageRateAfterRemortgage}%`,
          `Monthly payment: £${settings.mortgageMonthlyPayment}`
        ]}
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={mortgage}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
            <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine x={settings.mortgageEndDate?.slice(0, 7)} stroke="#dbd224" strokeDasharray="3 3"
              label={{ value: 'Remortgage', position: 'top', fontSize: 9, fill: '#847e15' }} />
            <Area type="monotone" dataKey="balance" stroke="#e63119" fill="#fbfbe9" strokeWidth={2} name="Balance" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3 & 4. ISA + Pension side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartCard
          title="📈 ISA Projection"
          confidence={conf}
          assumptions={[
            `Current: £${settings.isaBalance?.toLocaleString('en-GB')}`,
            `Monthly contribution: £${settings.isaMonthlyContribution || 0} (update in Settings)`,
            `Growth: ${settings.investmentGrowthRatePct}% real annually`,
            conf.band ? 'Band = ±30% on growth rate' : null
          ].filter(Boolean)}
        >
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={isa}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
              <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#629d95" strokeDasharray="3 3" label={{ value: 'Retire', position: 'top', fontSize: 9, fill: '#629d95' }} />}
              {conf.band && <Area type="monotone" dataKey="optimistic" stroke="none" fill="#cdd7c1" fillOpacity={0.4} name="Optimistic" dot={false} />}
              <Area type="monotone" dataKey="base" stroke="#829c63" fill="#e6ebe0" strokeWidth={2} name="Base case" dot={false} />
              {conf.band && <Area type="monotone" dataKey="pessimistic" stroke="none" fill="#FFFFFF" fillOpacity={1} name="Pessimistic" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="🏦 Pension Projection"
          confidence={conf}
          assumptions={[
            `Current: £${settings.pensionBalance?.toLocaleString('en-GB')}`,
            `Contribution: £${settings.pensionMonthlyContribution}/month (15% combined)`,
            `Growth: ${settings.investmentGrowthRatePct}% real annually`,
            'State pension £230.25/week from age 68 not shown here'
          ]}
        >
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={pension}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
              <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#629d95" strokeDasharray="3 3" label={{ value: 'Retire', position: 'top', fontSize: 9, fill: '#629d95' }} />}
              {conf.band && <Area type="monotone" dataKey="optimistic" stroke="none" fill="#bcdadc" fillOpacity={0.4} name="Optimistic" dot={false} />}
              <Area type="monotone" dataKey="base" stroke="#58a2a7" fill="#deeced" strokeWidth={2} name="Base case" dot={false} />
              {conf.band && <Area type="monotone" dataKey="pessimistic" stroke="none" fill="#FFFFFF" fillOpacity={1} name="Pessimistic" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* 5. Net worth trajectory */}
      <ChartCard
        title="💎 Net Worth Trajectory"
        confidence={conf}
        assumptions={[
          `ISA + Pension + Property equity combined`,
          `Property growth: ${settings.propertyGrowthRatePct}% annually`,
          `Investments: ${settings.investmentGrowthRatePct}% real annually`,
          `Mortgage paid at £${settings.mortgageMonthlyPayment}/month`,
          conf.band ? 'Shading reflects investment return uncertainty only' : null
        ].filter(Boolean)}
      >
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={networth}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0ebea" />
            <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#82b0aa' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<ChartTooltip />} />
            {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#629d95" strokeDasharray="3 3" label={{ value: 'Retirement', position: 'top', fontSize: 9, fill: '#629d95' }} />}
            <Area type="monotone" dataKey="equity"  stackId="1" stroke="none" fill="#fbfbe9" name="Property Equity" dot={false} />
            <Area type="monotone" dataKey="pension" stackId="1" stroke="none" fill="#deeced" name="Pension" dot={false} />
            <Area type="monotone" dataKey="isa"     stackId="1" stroke="#58a2a7" fill="#cdd7c1" strokeWidth={2} name="ISA" dot={false} />
            <Legend formatter={v => <span style={{ fontSize: 11, color: '#4f7d77' }}>{v}</span>} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

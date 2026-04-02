import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
  BarChart, Bar, Cell
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
  if (months <= 6)  return { label: 'High confidence',   color: 'text-emerald-400', band: false }
  if (months <= 24) return { label: 'Moderate',           color: 'text-amber-400',   band: true }
  return              { label: 'Illustrative',             color: 'text-neuro-400',   band: true }
}

// ── Projections ──────────────────────────────────────────────────────

function buildSurplus(data, settings, months) {
  const base = calcSurplus(data)
  const points = []
  const now = new Date()
  const futureEvents = (settings.futureEvents || []).filter(ev => ev.date && !isNaN(new Date(ev.date).getTime()))
  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    const dateStr = d.toISOString().slice(0, 7)
    let s = base
    futureEvents.forEach(ev => { if (d >= new Date(ev.date)) s += ev.monthlyImpact || 0 })
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
  const incomeEvents = (settings.futureEvents || [])
    .filter(ev => ev.date && !isNaN(new Date(ev.date).getTime()) && (ev.monthlyImpact || 0) > 0)
    .map(ev => ({ date: new Date(ev.date), impact: ev.monthlyImpact || 0 }))

  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    let c = contrib
    incomeEvents.forEach(ev => { if (d >= ev.date) c += ev.impact * 0.5 }) // assume 50% of freed money goes to ISA
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

function buildRetirement(settings, months) {
  const points = []
  let isaBase = settings.isaBalance || 0
  let penBase = settings.pensionBalance || 0
  let isaRise = isaBase
  let penRise = penBase
  const r = (settings.investmentGrowthRatePct || 5) / 100 / 12
  const isaContrib = settings.isaMonthlyContribution || 0
  const penContrib = settings.pensionMonthlyContribution || 0
  const now = new Date()
  const incomeEvents = (settings.futureEvents || [])
    .filter(ev => ev.date && !isNaN(new Date(ev.date).getTime()) && (ev.monthlyImpact || 0) > 0)
    .map(ev => ({ date: new Date(ev.date), impact: ev.monthlyImpact || 0 }))

  for (let i = 0; i < months; i++) {
    const d = addMonths(now, i)
    isaBase = isaBase * (1 + r) + isaContrib
    penBase = penBase * (1 + r) + penContrib
    let extraPen = 0
    incomeEvents.forEach(ev => { if (d >= ev.date) extraPen += ev.impact * 0.5 })
    isaRise = isaRise * (1 + r) + isaContrib
    penRise = penRise * (1 + r) + penContrib + extraPen
    points.push({
      date: d.toISOString().slice(0, 7),
      base: Math.round(isaBase + penBase),
      withRise: Math.round(isaRise + penRise),
      isaBase: Math.round(isaBase),
      penBase: Math.round(penBase),
    })
  }
  return points
}

function getEvent(date, settings) {
  const m = date.toISOString().slice(0, 7)
  const futureEvents = settings.futureEvents || []
  const match = futureEvents.find(ev => ev.date && !isNaN(new Date(ev.date).getTime()) && new Date(ev.date).toISOString().slice(0, 7) === m)
  if (match) return `${match.icon || '📅'} ${match.label}`
  if (settings.mortgageEndDate && !isNaN(new Date(settings.mortgageEndDate).getTime()) && new Date(settings.mortgageEndDate).toISOString().slice(0, 7) === m) return '🏠 Remortgage'
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
    <div className="bg-nb-800 border border-nb-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-slate-300 mb-1">{fmtMonth(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, confidence: conf, assumptions, children }) {
  const [showAssumptions, setShowAssumptions] = useState(false)
  return (
    <div className="bg-nb-750 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${conf.color}`}>{conf.label}</span>
          {assumptions && (
            <button onClick={() => setShowAssumptions(s => !s)} className="text-xs text-slate-500 hover:text-slate-300">
              {showAssumptions ? '▲' : '▼'} assumptions
            </button>
          )}
        </div>
      </div>
      {showAssumptions && assumptions && (
        <div className="mb-3 bg-nb-800 rounded-lg p-3 text-xs text-slate-400 space-y-0.5">
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

  const retMonths = Math.max(1, ((settings.retirementAge || 66) - (settings.currentAge || 38)) * 12)
  const retirement = useMemo(() => buildRetirement(settings, retMonths), [settings, retMonths])

  if (!data) return null

  const retirementMonth = addMonths(new Date(), (settings.retirementAge - settings.currentAge) * 12).toISOString().slice(0, 7)

  // Retirement income at end of projection
  const retEnd = retirement[retirement.length - 1] || {}
  const statePensionAnnual = (settings.statePensionWeekly || 221.20) * 52
  const isaDrawdownAnnual  = Math.round((retEnd.isaBase || 0) * 0.04)
  const penDrawdownAnnual  = Math.round((retEnd.penBase || 0) * 0.04)
  const retWithRiseEnd = retirement[retirement.length - 1]
  const isaDrawdownRise = Math.round(((retWithRiseEnd?.base || 0) - (retEnd.penBase || 0)) * 0.02 + (retEnd.isaBase || 0) * 0.04)
  const totalRetirementIncome = Math.round(statePensionAnnual + isaDrawdownAnnual + penDrawdownAnnual)
  const retirementTarget = 60000
  const retirementGap = Math.max(0, retirementTarget - totalRetirementIncome)

  const retirementIncomeData = [{
    name: 'Income at retirement',
    statePension: Math.round(statePensionAnnual),
    isaDraw: isaDrawdownAnnual,
    pensionDraw: penDrawdownAnnual,
  }]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Horizon picker */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium text-slate-400">Forecast horizon:</span>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((h, i) => (
            <button
              key={h.label}
              onClick={() => setHorizonIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                horizonIdx === i
                  ? 'bg-neuro-600 text-white'
                  : 'bg-nb-700 text-slate-500 hover:bg-nb-650 hover:text-slate-300'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <span className={`text-xs font-medium ${conf.color}`}>{conf.label}</span>
      </div>

      {/* 1. Mortgage balance */}
      <ChartCard
        title="Mortgage Balance"
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2844" />
            <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine x={settings.mortgageEndDate?.slice(0, 7)} stroke="#475569" strokeDasharray="3 3"
              label={{ value: 'Remortgage', position: 'top', fontSize: 9, fill: '#475569' }} />
            <Area type="monotone" dataKey="balance" stroke="#22d3ee" fill="#22d3ee14" strokeWidth={2} name="Balance" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3 & 4. ISA + Pension side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartCard
          title="ISA Projection"
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2844" />
              <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#475569" strokeDasharray="3 3" label={{ value: 'Retire', position: 'top', fontSize: 9, fill: '#475569' }} />}
              {conf.band && <ReferenceArea dataKey="optimistic" fill="#4f7ef708" />}
              {conf.band && <Area type="monotone" dataKey="optimistic" stroke="#22d3ee" strokeWidth={1} strokeDasharray="4 3" fill="none" name="Optimistic" dot={false} />}
              <Area type="monotone" dataKey="base" stroke="#4f7ef7" fill="#4f7ef714" strokeWidth={2} name="Base case" dot={false} />
              {conf.band && <Area type="monotone" dataKey="pessimistic" stroke="#4f7ef7" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} fill="none" name="Pessimistic" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Pension Projection"
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2844" />
              <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#475569" strokeDasharray="3 3" label={{ value: 'Retire', position: 'top', fontSize: 9, fill: '#475569' }} />}
              {conf.band && <Area type="monotone" dataKey="optimistic" stroke="#c084fc" strokeWidth={1} strokeDasharray="4 3" fill="none" name="Optimistic" dot={false} />}
              <Area type="monotone" dataKey="base" stroke="#a78bfa" fill="#a78bfa14" strokeWidth={2} name="Base case" dot={false} />
              {conf.band && <Area type="monotone" dataKey="pessimistic" stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} fill="none" name="Pessimistic" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Retirement section */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Retirement Projection</h2>

        {/* ISA + Pension combined to retirement age */}
        <div className="bg-nb-750 rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">ISA + Pension Pot to Age {settings.retirementAge || 66}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Base case vs. boosting pension after August pay rise</p>
            </div>
            <span className="text-xs font-medium text-neuro-400">Illustrative</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={retirement}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2844" />
              <XAxis dataKey="date" tickFormatter={fmtMonth} interval={Math.floor(retMonths / 8)} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={retirementMonth} stroke="#475569" strokeDasharray="3 3"
                label={{ value: `Retire ${settings.retirementAge}`, position: 'insideTopLeft', fontSize: 9, fill: '#475569' }} />
              <Line type="monotone" dataKey="base" stroke="#4f7ef7" strokeWidth={2} dot={false} name="Base case" />
              <Line type="monotone" dataKey="withRise" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" dot={false} name="With pay rise boost" />
              <Legend formatter={v => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
            </LineChart>
          </ResponsiveContainer>
          {retEnd.base > 0 && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              At retirement: base pot ~{fmtK(retEnd.base)} → 4% drawdown ≈ {fmtK(retEnd.base * 0.04)}/yr ·
              With rise: ~{fmtK(retEnd.withRise)} → {fmtK(retEnd.withRise * 0.04)}/yr
            </p>
          )}
        </div>

        {/* Retirement income sources bar */}
        <div className="bg-nb-750 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Projected Retirement Income Sources</h3>
          <p className="text-xs text-slate-500 mb-3">Annual income at age {settings.retirementAge || 66} using 4% drawdown rule</p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={retirementIncomeData} layout="vertical" margin={{ top: 0, right: 100, left: 10, bottom: 0 }}>
              <XAxis type="number" tickFormatter={n => `£${(n/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip formatter={(v, n) => [`£${Math.round(v).toLocaleString('en-GB')}/yr`, n]} wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={retirementTarget} stroke="#ef4444" strokeDasharray="4 2"
                label={{ value: '£60k target', position: 'right', fontSize: 10, fill: '#ef4444' }} />
              <Bar dataKey="statePension" stackId="inc" fill="#34d399" name="State Pension" maxBarSize={32} />
              <Bar dataKey="isaDraw" stackId="inc" fill="#4f7ef7" name="ISA (4%)" maxBarSize={32} />
              <Bar dataKey="pensionDraw" stackId="inc" fill="#a78bfa" name="Pension (4%)" radius={[0,6,6,0]} maxBarSize={32} />
              <Legend formatter={v => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-300">Total: £{totalRetirementIncome.toLocaleString('en-GB')}/yr</span>
            {retirementGap > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full text-red-400">
                ⚠️ £{retirementGap.toLocaleString('en-GB')} gap to £60k target
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full text-emerald-400">
                ✅ On track for £60k target
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Net worth trajectory */}
      <ChartCard
        title="Net Worth Trajectory"
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2844" />
            <XAxis dataKey="date" tickFormatter={fmtMonth} interval={tick - 1} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<ChartTooltip />} />
            {months >= settings.retirementAge * 12 && <ReferenceLine x={retirementMonth} stroke="#475569" strokeDasharray="3 3" label={{ value: 'Retirement', position: 'top', fontSize: 9, fill: '#475569' }} />}
            <Area type="monotone" dataKey="equity"  stackId="1" stroke="none" fill="#34d39914" name="Property Equity" dot={false} />
            <Area type="monotone" dataKey="pension" stackId="1" stroke="none" fill="#a78bfa14" name="Pension" dot={false} />
            <Area type="monotone" dataKey="isa"     stackId="1" stroke="#22d3ee" fill="#22d3ee14" strokeWidth={2} name="ISA" dot={false} />
            <Legend formatter={v => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

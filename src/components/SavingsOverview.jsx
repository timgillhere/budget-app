import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useBudget } from '../context/BudgetContext'
import { calcBudgetSummary, getPensionTotals, isAnnualFundGroup, stripPrefix } from '../utils/budgetCalcs'

const fmt     = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtFull = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Colour palette ───────────────────────────────────────────────────
const COLOURS = {
  pension:  { fill: '#22d3ee', bg: 'bg-cyan-900/30',    border: 'border-cyan-700/50',    text: 'text-cyan-300'    },
  isa:      { fill: '#34d399', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50', text: 'text-emerald-300' },
  longterm: { fill: '#4f7ef7', bg: 'bg-neuro-900/30',   border: 'border-neuro-700/50',   text: 'text-neuro-300'   },
  surplus:  { fill: '#a78bfa', bg: 'bg-purple-900/30',  border: 'border-purple-700/50',  text: 'text-purple-300'  },
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

// ── Stat tile ─────────────────────────────────────────────────────────
function StatTile({ label, value, sub, accent, tooltip }) {
  return (
    <div
      className="bg-nb-750 rounded-xl border border-nb-600 px-4 py-3.5 text-center relative group/tip"
      style={{ boxShadow: `0 0 25px ${accent}18` }}
    >
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      {tooltip && (
        <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
          <span className="block rounded-lg border border-nb-600 px-3 py-2 text-xs text-left shadow-xl" style={{ backgroundColor: '#0d1224' }}>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-nb-600" />
            {tooltip.map((line, i) => (
              <span key={i} className="block">
                {line.dividerBefore && <span className="block border-t border-nb-600 my-1.5" />}
                <span className="flex justify-between gap-4">
                  <span className="text-slate-400">{line.label}</span>
                  <span className={line.highlight || 'text-slate-200'}>{line.value}</span>
                </span>
                {line.dividerAfter && <span className="block border-t border-nb-600 my-1.5" />}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  )
}

// ── Donut chart with centred total ────────────────────────────────────
function SavingsDonut({ data, total }) {
  const [active, setActive] = useState(null)

  const CustomTooltip = ({ active: a, payload }) => {
    if (!a || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-nb-800 border border-nb-500 rounded-lg px-3 py-2 shadow-2xl text-sm" style={{ backgroundColor: '#0d1224', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
        <p className="font-semibold text-slate-200 mb-0.5">{d.name}</p>
        <p style={{ color: d.fill }}>{fmtFull(d.value)}/month</p>
        <p className="text-slate-500 text-xs">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}% of savings</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={72} outerRadius={95}
            dataKey="value"
            strokeWidth={2}
            stroke="#090c17"
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.fill}
                opacity={active === null || active === i ? 1 : 0.35}
                style={{ filter: active === i ? `drop-shadow(0 0 8px ${entry.fill}99)` : 'none', transition: 'opacity 0.15s, filter 0.15s' }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centre label — hide when a segment tooltip is active */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ opacity: active !== null ? 0 : 1, transition: 'opacity 0.15s' }}>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly</span>
        <span className="text-lg font-bold text-slate-100" style={{ textShadow: '0 0 10px rgba(79,126,247,0.4)' }}>
          {fmt(total)}
        </span>
      </div>
    </div>
  )
}

// ── Legend row ────────────────────────────────────────────────────────
function LegendRow({ label, value, fill, pct, sub }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-nb-700/60 last:border-0">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: fill }} />
      <span className="flex-1 text-sm text-slate-300">{label}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
      <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-sm font-semibold tabular-nums w-20 text-right" style={{ color: fill }}>{fmtFull(value)}</span>
    </div>
  )
}

// ── Wealth card ───────────────────────────────────────────────────────
function WealthCard({ label, balance, monthly, accent, note }) {
  const annual = monthly * 12
  return (
    <div
      className="bg-nb-750 rounded-xl border border-nb-600 p-5"
      style={{ boxShadow: `0 0 30px ${accent}18` }}
    >
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)`, marginBottom: 16 }} />
      <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold mb-1" style={{ color: accent, textShadow: `0 0 12px ${accent}55` }}>
        {balance > 0 ? fmt(balance) : '—'}
      </div>
      {monthly > 0 && (
        <div className="text-xs text-slate-400 space-y-0.5">
          <div>+{fmtFull(monthly)}/month contributing</div>
          <div className="text-slate-500">+{fmt(annual)}/year</div>
        </div>
      )}
      {note && <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">{note}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function SavingsOverview() {
  const { data } = useBudget()
  if (!data) return null

  const {
    pensionContribution, isaContribution, surplus,
    savingsRate, grossIncome, totalSavings, annualFunds,
  } = calcBudgetSummary(data)

  const settings = data.settings || {}
  const savingsRateTarget = settings.savingsRateTarget || 10
  const rateColor = savingsRate >= savingsRateTarget ? '#34d399' : '#f87171'

  const { pensions } = getPensionTotals(settings)
  const pensionBalanceTotal = pensions.reduce((s, p) => s + (p.balance || 0), 0)

  const monthlySavings = pensionContribution + isaContribution

  // Donut segments — pension and ISA contributions from settings only
  const donutData = [
    pensionContribution > 0 ? { name: 'Pension', value: pensionContribution, fill: COLOURS.pension.fill } : null,
    isaContribution     > 0 ? { name: 'ISA',     value: isaContribution,     fill: COLOURS.isa.fill     } : null,
  ].filter(Boolean)

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Savings Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your complete savings picture — contributions, balances, and long-term pots</p>
      </div>

      {/* ── Stat strip ── */}
      {(() => {
        const annualProjected = monthlySavings * 12
        const retirementWealth = (settings.isaBalance || 0) + pensionBalanceTotal
        const targetMonthly = grossIncome * (savingsRateTarget / 100)
        const gapToTarget = targetMonthly - totalSavings

        // Tooltip for savings target — breaks down what makes up the rate
        const pensionLines = pensions.length > 1
          ? pensions.map(p => ({ label: p.name || 'Pension', value: fmtFull(p.monthlyContribution || 0) }))
          : (pensionContribution > 0 ? [{ label: 'Pension', value: fmtFull(pensionContribution) }] : [])
        const savingsTargetTooltip = [
          ...pensionLines,
          ...(isaContribution > 0    ? [{ label: 'ISA',          value: fmtFull(isaContribution)   }] : []),
          { label: 'Total',          value: fmtFull(totalSavings), dividerBefore: true },
          { label: '÷ Gross income', value: fmtFull(grossIncome) },
          { label: '= Savings rate', value: `${savingsRate.toFixed(1)}%`, highlight: savingsRate >= savingsRateTarget ? '#34d399' : '#f87171' },
        ]

        // Tooltip for annual savings — lists each annual fund group
        const annualGroups = []
        data.sections.forEach(sec => {
          sec.groups.forEach(g => {
            if (!isAnnualFundGroup(g)) return
            const total = g.items.reduce((s, i) => s + i.monthly, 0)
            if (total > 0) annualGroups.push({ label: stripPrefix(g.name), value: fmtFull(total) })
          })
        })
        const annualSavingsTooltip = annualGroups.length > 0
          ? [...annualGroups, { label: 'Total', value: fmtFull(annualFunds), dividerBefore: true }]
          : null

        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Annual projected"
              value={fmt(annualProjected)}
              sub="pension + ISA × 12"
              accent={COLOURS.longterm.fill}
            />
            <StatTile
              label="Retirement wealth"
              value={retirementWealth > 0 ? fmt(retirementWealth) : '—'}
              sub="ISA + pension balances"
              accent={COLOURS.pension.fill}
            />
            <StatTile
              label="Savings target"
              value={`${savingsRate.toFixed(1)}% of ${savingsRateTarget}%`}
              sub={gapToTarget > 0 ? `£${fmtFull(Math.abs(gapToTarget))}/mo short` : `£${fmtFull(Math.abs(gapToTarget))}/mo headroom`}
              accent={gapToTarget > 0 ? '#f87171' : '#34d399'}
              tooltip={savingsTargetTooltip}
            />
            <StatTile
              label="Annual savings"
              value={annualFunds > 0 ? `${fmt(annualFunds)}/mo` : '—'}
              sub="set aside for annual costs"
              accent='#f59e0b'
              tooltip={annualSavingsTooltip}
            />
          </div>
        )
      })()}

      {/* ── Composition chart + legend ── */}
      <NeonCard accent={COLOURS.longterm.fill}>
        <h2 className="text-sm font-semibold text-slate-400 mb-4">Monthly Savings Composition</h2>
        {donutData.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No savings contributions found. Add pension/ISA settings or mark groups as Long-term Savings.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="w-full sm:w-56 flex-shrink-0">
              <SavingsDonut data={donutData} total={donutTotal} />
            </div>
            <div className="flex-1 w-full">
              {donutData.map(d => (
                <LegendRow
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  fill={d.fill}
                  pct={donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : '0'}
                />
              ))}
              <div className="flex items-center justify-between pt-3 mt-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total monthly</span>
                <span className="text-base font-bold text-slate-200 tabular-nums">{fmtFull(donutTotal)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Annual</span>
                <span className="text-sm font-semibold text-slate-300 tabular-nums">{fmt(donutTotal * 12)}/year</span>
              </div>
              {surplus > 0 && (
                <p className="text-[10px] text-slate-600 mt-3 leading-relaxed border-t border-nb-700 pt-3">
                  {fmtFull(surplus)}/month unallocated surplus — consider increasing pension or ISA contributions to grow your savings rate.
                </p>
              )}
            </div>
          </div>
        )}
      </NeonCard>

      {/* ── Wealth snapshot ── */}
      {(settings.isaBalance > 0 || pensionBalanceTotal > 0 || isaContribution > 0 || pensionContribution > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Wealth Snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(settings.isaBalance > 0 || isaContribution > 0) && (
              <WealthCard
                label="ISA"
                balance={settings.isaBalance || 0}
                monthly={isaContribution}
                accent={COLOURS.isa.fill}
                note="Stocks & Shares or Cash ISA — contributions grow tax-free."
              />
            )}
            {pensions.map(p => (
              <WealthCard
                key={p.id}
                label={p.name || 'Pension'}
                balance={p.balance || 0}
                monthly={p.monthlyContribution || 0}
                accent={COLOURS.pension.fill}
                note="Pre-tax pension pot. Contribution includes both your share and any employer top-up."
              />
            ))}
            {pensions.length === 0 && pensionContribution === 0 && (
              <div className="bg-nb-750 rounded-xl border border-nb-600 p-5 flex items-center justify-center">
                <p className="text-xs text-slate-500 text-center">No pensions added yet.<br />Add them in Settings.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Savings rate context ── */}
      <NeonCard accent={rateColor}>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Savings Rate Breakdown</h2>
        <div className="space-y-2">
          {[
            { label: 'Pension (pre-tax)', value: pensionContribution, fill: COLOURS.pension.fill },
            { label: 'ISA',              value: isaContribution,     fill: COLOURS.isa.fill     },
          ].filter(r => r.value > 0).map(row => {
            const pct = grossIncome > 0 ? (row.value / grossIncome) * 100 : 0
            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: row.fill }} />
                <span className="text-xs text-slate-400 flex-1">{row.label}</span>
                <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                <div className="w-24 bg-nb-700 rounded-full h-1.5 hidden sm:block">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct / savingsRateTarget * 100, 100)}%`, backgroundColor: row.fill }} />
                </div>
                <span className="text-xs font-medium tabular-nums w-20 text-right" style={{ color: row.fill }}>{fmtFull(row.value)}/mo</span>
              </div>
            )
          })}
          <div className="border-t border-nb-600 pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">True savings rate</span>
            <span className="text-base font-bold" style={{ color: rateColor, textShadow: `0 0 8px ${rateColor}55` }}>
              {savingsRate.toFixed(1)}% <span className="text-xs font-normal text-slate-500">of gross income</span>
            </span>
          </div>
          {savingsRate < savingsRateTarget && (
            <p className="text-[10px] text-slate-600 leading-relaxed">
              {(savingsRateTarget - savingsRate).toFixed(1)}% below your {savingsRateTarget}% target —
              that's {fmtFull((savingsRateTarget / 100 * grossIncome) - totalSavings)} more per month needed to hit it.
            </p>
          )}
        </div>
      </NeonCard>

      <div className="h-4" />
    </div>
  )
}

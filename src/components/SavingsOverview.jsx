import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useBudget } from '../context/BudgetContext'
import { calcBudgetSummary, getPensionTotals, isLongtermSavingsGroup, stripPrefix } from '../utils/budgetCalcs'
import { ChevronDownIcon, ChevronRightIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline'

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
function StatTile({ label, value, sub, accent }) {
  return (
    <div
      className="bg-nb-750 rounded-xl border border-nb-600 px-4 py-3.5 text-center"
      style={{ boxShadow: `0 0 25px ${accent}18` }}
    >
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
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
      <div className="bg-nb-800 border border-nb-500 rounded-lg px-3 py-2 shadow-2xl text-sm">
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
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
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

// ── Long-term pots accordion ──────────────────────────────────────────
function PotsAccordion({ budget }) {
  const [open, setOpen] = useState(new Set())

  const pots = []
  budget.sections.forEach(sec => {
    sec.groups.forEach(g => {
      if (!isLongtermSavingsGroup(g)) return
      const items = g.items.filter(i => i.monthly > 0)
      const total = items.reduce((s, i) => s + i.monthly, 0)
      if (total === 0 && !g.currentBalance) return
      pots.push({ ...g, _sectionName: sec.name.replace(/\p{Emoji}/gu, '').trim(), _items: items, _total: total })
    })
  })

  if (pots.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No long-term saving pots yet. Mark a group as "Long-term Savings" in the budget to see it here.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {pots.map(pot => {
        const isOpen = open.has(pot.id)
        return (
          <div key={pot.id} className="rounded-xl border border-nb-600 overflow-hidden">
            <button
              onClick={() => setOpen(prev => { const n = new Set(prev); n.has(pot.id) ? n.delete(pot.id) : n.add(pot.id); return n })}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-nb-800 hover:bg-nb-700 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                  <BuildingLibraryIcon className="w-3 h-3" />
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-slate-200 block truncate">{stripPrefix(pot.name)}</span>
                  <span className="text-[10px] text-slate-500">{pot._sectionName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                {pot.currentBalance != null && (
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Balance</div>
                    <div className="text-xs font-semibold text-cyan-400 tabular-nums">{fmtFull(pot.currentBalance)}</div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly</div>
                  <div className="text-sm font-semibold text-emerald-400 tabular-nums">{fmtFull(pot._total)}</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Annual</div>
                  <div className="text-xs font-semibold text-slate-300 tabular-nums">{fmtFull(pot._total * 12)}</div>
                </div>
                {pot._items.length > 0 && (
                  isOpen
                    ? <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                    : <ChevronRightIcon className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </button>

            {isOpen && pot._items.length > 0 && (
              <div className="bg-nb-750 border-t border-nb-600 divide-y divide-nb-700">
                {pot._items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 pl-10">
                    <div className="min-w-0">
                      <span className="text-xs text-slate-300 truncate block">{item.name}</span>
                      {item.notes && <span className="text-[10px] text-slate-500 truncate block">{item.notes}</span>}
                    </div>
                    <div className="flex-shrink-0 ml-3 text-right">
                      <div className="text-xs text-slate-300 tabular-nums">{fmtFull(item.monthly)}/mo</div>
                      <div className="text-[10px] text-slate-500 tabular-nums">{fmtFull(item.monthly * 12)}/yr</div>
                    </div>
                  </div>
                ))}
                {pot._items.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 pl-10 bg-nb-800/60">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total</span>
                    <span className="text-xs font-semibold text-slate-300 tabular-nums">{fmtFull(pot._total)}/mo</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
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
    pensionContribution, isaContribution, longtermSavings, surplus,
    savingsRate, grossIncome, totalSavings,
  } = calcBudgetSummary(data)

  const settings = data.settings || {}
  const savingsRateTarget = settings.savingsRateTarget || 10
  const rateColor = savingsRate >= savingsRateTarget ? '#34d399' : '#f87171'

  const { pensions } = getPensionTotals(settings)
  const pensionBalanceTotal = pensions.reduce((s, p) => s + (p.balance || 0), 0)

  const monthlySavings = pensionContribution + isaContribution + longtermSavings

  // Donut segments — pension, ISA, long-term pots, surplus (if positive)
  const donutData = [
    pensionContribution > 0 ? { name: 'Pension',          value: pensionContribution, fill: COLOURS.pension.fill  } : null,
    isaContribution     > 0 ? { name: 'ISA',              value: isaContribution,     fill: COLOURS.isa.fill      } : null,
    longtermSavings     > 0 ? { name: 'Long-term Pots',   value: longtermSavings,     fill: COLOURS.longterm.fill } : null,
    surplus             > 0 ? { name: 'Unallocated Surplus', value: surplus,           fill: COLOURS.surplus.fill  } : null,
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          sub={`target ${savingsRateTarget}%`}
          accent={rateColor}
        />
        <StatTile
          label="Monthly Savings"
          value={fmt(monthlySavings)}
          sub="excl. annual funds"
          accent={COLOURS.longterm.fill}
        />
        <StatTile
          label="ISA Balance"
          value={settings.isaBalance > 0 ? fmt(settings.isaBalance) : '—'}
          sub={isaContribution > 0 ? `+${fmtFull(isaContribution)}/mo` : 'no contribution set'}
          accent={COLOURS.isa.fill}
        />
        <StatTile
          label={pensions.length > 1 ? `Pensions (${pensions.length})` : 'Pension'}
          value={pensionBalanceTotal > 0 ? fmt(pensionBalanceTotal) : '—'}
          sub={pensionContribution > 0 ? `+${fmtFull(pensionContribution)}/mo` : 'no contribution set'}
          accent={COLOURS.pension.fill}
        />
      </div>

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
                  Unallocated surplus of {fmtFull(surplus)}/month is counted in your savings rate but not yet assigned to a pot.
                </p>
              )}
            </div>
          </div>
        )}
      </NeonCard>

      {/* ── Long-term pots ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BuildingLibraryIcon className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-400">Long-term Saving Pots</h2>
        </div>
        <PotsAccordion budget={data} />
      </div>

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
            { label: 'Pension (pre-tax)',  value: pensionContribution, fill: COLOURS.pension.fill },
            { label: 'ISA',               value: isaContribution,     fill: COLOURS.isa.fill     },
            { label: 'Long-term pots',    value: longtermSavings,     fill: COLOURS.longterm.fill},
            { label: 'Unallocated surplus', value: Math.max(0, surplus), fill: COLOURS.surplus.fill },
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

import { calcBudgetSummary } from '../utils/budgetCalcs'

const fmtK = (n) => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${Math.round(n)}`
const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SummaryBar({ budget, compact = false }) {
  const { totalIncome, totalExpenses, surplus, savingsRate, pensionContribution, isaContribution, budgetedSavings, budgetedSpending, grossIncome, totalSavings } = calcBudgetSummary(budget)
  const monthlySavings = pensionContribution + isaContribution + budgetedSavings
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10

  const s = budget?.settings || {}
  const propertyEquity = (s.propertyValue || 0) - (s.mortgageBalance || 0)
  const netWorth = (s.isaBalance || 0) + (s.pensionBalance || 0) + propertyEquity + (s.bufferBalance || 0)
  const bufferMonths = totalExpenses > 0 ? ((s.bufferBalance || 0) / totalExpenses).toFixed(1) : '—'
  const bufferMonthsNum = totalExpenses > 0 ? (s.bufferBalance || 0) / totalExpenses : 0
  const bufferColor = bufferMonthsNum >= 3 ? 'text-emerald-400' : bufferMonthsNum >= 1 ? 'text-amber-400' : 'text-red-400'

  const surplusColor = surplus >= 300 ? 'text-emerald-400' : surplus >= 100 ? 'text-amber-400' : 'text-red-400'
  const savingsColor = monthlySavings >= 500 ? 'text-emerald-400' : monthlySavings >= 200 ? 'text-amber-400' : 'text-red-400'
  const rateColor = savingsRate >= savingsRateTarget ? 'text-emerald-400' : 'text-red-400'

  // Tooltip data
  const incomeItems = budget?.income?.items || []

  const incomeTooltip = [
    ...incomeItems.map(i => ({ label: i.name || 'Income', value: fmt(i.monthly) })),
    ...(incomeItems.length > 1 ? [{ label: 'Total', value: fmt(totalIncome), highlight: 'text-emerald-400', dividerBefore: true }] : []),
  ]

  const expensesTooltip = [
    { label: 'Spending', value: fmt(budgetedSpending) },
    { label: 'Savings pots', value: fmt(budgetedSavings) },
    { label: 'Total', value: fmt(totalExpenses), highlight: 'text-slate-200', dividerBefore: true },
  ]

  const surplusTooltip = [
    { label: 'Income', value: fmt(totalIncome), highlight: 'text-emerald-400' },
    { label: '− Expenses', value: fmt(totalExpenses), dividerAfter: true },
    { label: '= Surplus', value: (surplus < 0 ? '-' : '') + fmt(surplus), highlight: surplusColor },
  ]

  const savingsRateTooltip = [
    { label: 'Pension', value: fmt(pensionContribution) },
    { label: 'ISA', value: fmt(isaContribution) },
    { label: 'Savings pots', value: fmt(budgetedSavings) },
    { label: 'Surplus', value: (surplus < 0 ? '-' : '') + fmt(surplus), dividerAfter: true },
    { label: '÷ Gross income', value: fmt(grossIncome) },
    { label: '= Savings rate', value: `${savingsRate.toFixed(1)}%`, highlight: rateColor, dividerBefore: true },
  ]

  const monthlySavingsTooltip = [
    { label: 'Pension', value: fmt(pensionContribution) },
    { label: 'ISA', value: fmt(isaContribution) },
    { label: 'Savings pots', value: fmt(budgetedSavings) },
    { label: 'Total', value: fmt(monthlySavings), highlight: savingsColor, dividerBefore: true },
  ]

  const netWorthTooltip = [
    { label: 'ISA', value: fmt(s.isaBalance || 0) },
    { label: 'Pension', value: fmt(s.pensionBalance || 0) },
    { label: 'Property equity', value: fmt(propertyEquity) },
    { label: 'Buffer', value: fmt(s.bufferBalance || 0) },
    { label: 'Total', value: fmtK(netWorth), highlight: 'text-cyan-400', dividerBefore: true },
  ]

  const bufferTooltip = [
    { label: 'Buffer pot', value: fmt(s.bufferBalance || 0) },
    { label: '÷ Monthly expenses', value: fmt(totalExpenses), dividerAfter: true },
    { label: '= Months covered', value: bufferMonths === '—' ? '—' : `${bufferMonths}mo`, highlight: bufferColor },
  ]

  return (
    <>
      {/* ── Mobile ── */}

      {/* Mobile compact: single tight row */}
      {compact && (
        <div className="sm:hidden bg-nb-800 border-b border-nb-600 px-4 py-2 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className={`text-base font-bold flex-shrink-0 ${surplusColor}`}>{(surplus < 0 ? '-' : '') + fmtK(surplus)}</span>
          <span className="text-slate-600 flex-shrink-0 text-xs">·</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 text-xs flex-shrink-0">In {fmtK(totalIncome)}</span>
          <span className="px-2 py-0.5 rounded-full bg-nb-700 text-slate-300 text-xs flex-shrink-0">Out {fmtK(totalExpenses)}</span>
          <span className={`px-2 py-0.5 rounded-full bg-nb-700 text-xs flex-shrink-0 ${savingsRate >= savingsRateTarget ? 'text-emerald-400' : 'text-red-400'}`}>
            Save {savingsRate.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Mobile expanded: hero + chips + snap tiles */}
      {!compact && (
        <div className="sm:hidden bg-nb-800 border-b border-nb-600 px-4 py-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Monthly Surplus</div>
          <div className={`text-3xl font-bold ${surplusColor}`}>
            {(surplus < 0 ? '-' : '') + fmt(surplus)}
          </div>
          <div className="mt-2 flex gap-2 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400">In {fmtK(totalIncome)}</span>
            <span className="px-2 py-1 rounded-full bg-nb-700 text-slate-300">Out {fmtK(totalExpenses)}</span>
            <span className={`px-2 py-1 rounded-full bg-nb-700 ${savingsRate >= savingsRateTarget ? 'text-emerald-400' : 'text-red-400'}`}>
              Save {savingsRate.toFixed(0)}%
            </span>
          </div>
          {/* Secondary snap-scroll tiles */}
          <div className="mt-3 flex gap-2 overflow-x-auto snap-x pb-1" style={{ scrollbarWidth: 'none' }}>
            <SnapTile label="Net Worth" value={fmtK(netWorth)} valueClass="text-cyan-400" />
            <SnapTile label="Buffer" value={bufferMonths === '—' ? '—' : `${bufferMonths}mo`} valueClass={bufferColor} />
            <SnapTile label="Monthly Savings" value={fmtK(monthlySavings)} valueClass={savingsColor} />
          </div>
        </div>
      )}

      {/* ── Desktop ── */}
      <div className={`hidden sm:block bg-nb-800 border-t border-nb-600 px-6 transition-all duration-300 ${compact ? 'py-1.5' : 'py-3'}`}>
        <div className="max-w-5xl mx-auto grid grid-cols-4 md:grid-cols-7 gap-4">
          <Tile label="Monthly Income" value={compact ? fmtK(totalIncome) : fmt(totalIncome)} valueClass="text-emerald-400 neon-green" compact={compact} tooltip={incomeTooltip} />
          <Tile label="Total Expenses" value={compact ? fmtK(totalExpenses) : fmt(totalExpenses)} valueClass="text-slate-200 neon-white" compact={compact} tooltip={expensesTooltip} />
          <Tile
            label="Monthly Surplus"
            value={compact ? ((surplus < 0 ? '-' : '') + fmtK(surplus)) : ((surplus < 0 ? '-' : '') + fmt(surplus))}
            valueClass={surplusColor + (surplus >= 300 ? ' neon-green' : surplus >= 100 ? ' neon-amber' : ' neon-red')}
            compact={compact}
            tooltip={surplusTooltip}
          />
          <Tile
            label="Savings Rate"
            value={`${savingsRate.toFixed(compact ? 0 : 1)}%`}
            valueClass={(savingsRate >= savingsRateTarget ? 'text-emerald-400 neon-green' : 'text-red-400 neon-red')}
            compact={compact}
            tooltip={savingsRateTooltip}
          />
          <Tile
            label="Monthly Savings"
            value={compact ? fmtK(monthlySavings) : fmt(monthlySavings)}
            valueClass={savingsColor + (monthlySavings >= 500 ? ' neon-green' : monthlySavings >= 200 ? ' neon-amber' : ' neon-red')}
            subtitle={compact ? undefined : 'incl. pension'}
            compact={compact}
            tooltip={monthlySavingsTooltip}
          />
          <Tile
            label="Net Worth"
            value={fmtK(netWorth)}
            valueClass="text-cyan-400 neon-cyan"
            compact={compact}
            tooltip={netWorthTooltip}
          />
          <Tile
            label="Buffer"
            value={bufferMonths === '—' ? '—' : `${bufferMonths}mo`}
            valueClass={bufferColor + (bufferMonthsNum >= 3 ? ' neon-green' : bufferMonthsNum >= 1 ? ' neon-amber' : ' neon-red')}
            subtitle={compact ? undefined : `£${(s.bufferBalance||0).toLocaleString('en-GB')}`}
            compact={compact}
            tooltip={bufferTooltip}
          />
        </div>
      </div>
    </>
  )
}

function SummaryTooltip({ lines }) {
  return (
    <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-nb-800 border border-nb-600 text-slate-200 text-xs rounded-lg px-3 py-2 w-52 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
      {/* upward arrow */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-nb-600" />
      {lines.map((line, i) => (
        <span key={i}>
          {line.dividerBefore && <span className="block border-t border-nb-600 my-1.5" />}
          <span className="flex justify-between gap-4">
            <span className="text-slate-400">{line.label}</span>
            <span className={line.highlight || 'text-slate-200'}>{line.value}</span>
          </span>
          {line.dividerAfter && <span className="block border-t border-nb-600 my-1.5" />}
        </span>
      ))}
    </span>
  )
}

function Tile({ label, value, valueClass, subtitle, compact, tooltip }) {
  return (
    <div className="text-center relative group/tip">
      <div className={`text-slate-500 uppercase tracking-wide font-medium transition-all duration-300 ${compact ? 'text-[9px]' : 'text-xs mb-1'}`}>{label}</div>
      <div className={`font-bold transition-all duration-300 ${compact ? 'text-sm' : 'text-lg'} ${valueClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
      {tooltip && !compact && <SummaryTooltip lines={tooltip} />}
    </div>
  )
}

function SnapTile({ label, value, valueClass }) {
  return (
    <div className="snap-start flex-shrink-0 bg-nb-750 border border-nb-600 rounded-lg px-3 py-2 min-w-[110px]">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  )
}

import { calcBudgetSummary } from '../utils/budgetCalcs'

const fmtK = (n) => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${Math.round(n)}`
const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SummaryBar({ budget, compact = false }) {
  const { totalIncome, totalExpenses, surplus, savingsRate, pensionContribution, isaContribution, budgetedSavings } = calcBudgetSummary(budget)
  const monthlySavings = pensionContribution + isaContribution + budgetedSavings
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10

  const s = budget?.settings || {}
  const netWorth = (s.isaBalance || 0) + (s.pensionBalance || 0) + ((s.propertyValue || 0) - (s.mortgageBalance || 0)) + (s.bufferBalance || 0)
  const bufferMonths = totalExpenses > 0 ? ((s.bufferBalance || 0) / totalExpenses).toFixed(1) : '—'
  const bufferMonthsNum = totalExpenses > 0 ? (s.bufferBalance || 0) / totalExpenses : 0
  const bufferColor = bufferMonthsNum >= 3 ? 'text-emerald-400' : bufferMonthsNum >= 1 ? 'text-amber-400' : 'text-red-400'

  const surplusColor = surplus >= 300 ? 'text-emerald-400' : surplus >= 100 ? 'text-amber-400' : 'text-red-400'

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
            <SnapTile label="Monthly Savings" value={fmtK(monthlySavings)} valueClass={monthlySavings >= 500 ? 'text-emerald-400' : monthlySavings >= 200 ? 'text-amber-400' : 'text-red-400'} />
          </div>
        </div>
      )}

      {/* ── Desktop ── */}
      <div className={`hidden sm:block bg-nb-800 border-t border-nb-600 px-6 transition-all duration-300 ${compact ? 'py-1.5' : 'py-3'}`}>
        <div className="max-w-5xl mx-auto grid grid-cols-4 md:grid-cols-7 gap-4">
          <Tile label="Monthly Income" value={compact ? fmtK(totalIncome) : fmt(totalIncome)} valueClass="text-emerald-400 neon-green" compact={compact} />
          <Tile label="Total Expenses" value={compact ? fmtK(totalExpenses) : fmt(totalExpenses)} valueClass="text-slate-200 neon-white" compact={compact} />
          <Tile
            label="Monthly Surplus"
            value={compact ? ((surplus < 0 ? '-' : '') + fmtK(surplus)) : ((surplus < 0 ? '-' : '') + fmt(surplus))}
            valueClass={surplusColor + (surplus >= 300 ? ' neon-green' : surplus >= 100 ? ' neon-amber' : ' neon-red')}
            compact={compact}
          />
          <Tile
            label="Savings Rate"
            value={`${savingsRate.toFixed(compact ? 0 : 1)}%`}
            valueClass={(savingsRate >= savingsRateTarget ? 'text-emerald-400 neon-green' : 'text-red-400 neon-red')}
            compact={compact}
          />
          <Tile
            label="Monthly Savings"
            value={compact ? fmtK(monthlySavings) : fmt(monthlySavings)}
            valueClass={monthlySavings >= 500 ? 'text-emerald-400 neon-green' : monthlySavings >= 200 ? 'text-amber-400 neon-amber' : 'text-red-400 neon-red'}
            subtitle={compact ? undefined : 'incl. pension'}
            compact={compact}
          />
          <Tile
            label="Net Worth"
            value={fmtK(netWorth)}
            valueClass="text-cyan-400 neon-cyan"
            compact={compact}
          />
          <Tile
            label="Buffer"
            value={bufferMonths === '—' ? '—' : `${bufferMonths}mo`}
            valueClass={bufferColor + (bufferMonthsNum >= 3 ? ' neon-green' : bufferMonthsNum >= 1 ? ' neon-amber' : ' neon-red')}
            subtitle={compact ? undefined : `£${(s.bufferBalance||0).toLocaleString('en-GB')}`}
            compact={compact}
          />
        </div>
      </div>
    </>
  )
}

function Tile({ label, value, valueClass, subtitle, compact }) {
  return (
    <div className="text-center">
      <div className={`text-slate-500 uppercase tracking-wide font-medium transition-all duration-300 ${compact ? 'text-[9px]' : 'text-xs mb-1'}`}>{label}</div>
      <div className={`font-bold transition-all duration-300 ${compact ? 'text-sm' : 'text-lg'} ${valueClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
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

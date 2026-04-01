import { calcBudgetSummary } from '../utils/budgetCalcs'

const fmtK = (n) => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${Math.round(n)}`

export default function SummaryBar({ budget }) {
  const { totalIncome, totalExpenses, surplus, savingsRate, pensionContribution, isaContribution, budgetedSavings } = calcBudgetSummary(budget)
  const monthlySavings = pensionContribution + isaContribution + budgetedSavings
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10

  const s = budget?.settings || {}
  const netWorth = (s.isaBalance || 0) + (s.pensionBalance || 0) + ((s.propertyValue || 0) - (s.mortgageBalance || 0)) + (s.bufferBalance || 0)
  const bufferMonths = totalExpenses > 0 ? ((s.bufferBalance || 0) / totalExpenses).toFixed(1) : '—'
  const bufferMonthsNum = totalExpenses > 0 ? (s.bufferBalance || 0) / totalExpenses : 0
  const bufferColor = bufferMonthsNum >= 3 ? 'text-emerald-400' : bufferMonthsNum >= 1 ? 'text-amber-400' : 'text-red-400'

  const surplusColor = surplus >= 300 ? 'text-emerald-400' : surplus >= 100 ? 'text-amber-400' : 'text-red-400'

  const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="bg-nb-800 border-t border-nb-600 px-3 sm:px-6 py-2 sm:py-3">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-4">
        <Tile label="Monthly Income" value={fmt(totalIncome)} valueClass="text-emerald-400 neon-green" />
        <Tile label="Total Expenses" value={fmt(totalExpenses)} valueClass="text-slate-200 neon-white" />
        <Tile
          label="Monthly Surplus"
          value={(surplus < 0 ? '-' : '') + fmt(surplus)}
          valueClass={surplusColor + (surplus >= 300 ? ' neon-green' : surplus >= 100 ? ' neon-amber' : ' neon-red')}
        />
        <Tile
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          valueClass={(savingsRate >= savingsRateTarget ? 'text-emerald-400 neon-green' : 'text-red-400 neon-red')}
        />
        <Tile
          label="Monthly Savings"
          value={fmt(monthlySavings)}
          valueClass={monthlySavings >= 500 ? 'text-emerald-400 neon-green' : monthlySavings >= 200 ? 'text-amber-400 neon-amber' : 'text-red-400 neon-red'}
          subtitle="incl. pension"
        />
        <Tile
          label="Net Worth"
          value={fmtK(netWorth)}
          valueClass="text-cyan-400 neon-cyan"
        />
        <Tile
          label="Buffer Coverage"
          value={bufferMonths === '—' ? '—' : `${bufferMonths}mo`}
          valueClass={bufferColor + (bufferMonthsNum >= 3 ? ' neon-green' : bufferMonthsNum >= 1 ? ' neon-amber' : ' neon-red')}
          subtitle={`£${(s.bufferBalance||0).toLocaleString('en-GB')}`}
        />
      </div>
    </div>
  )
}

function Tile({ label, value, valueClass, subtitle }) {
  return (
    <div className="text-center">
      <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5 sm:mb-1">{label}</div>
      <div className={`text-sm sm:text-lg font-bold ${valueClass}`}>{value}</div>
      {subtitle && <div className="text-[10px] sm:text-xs text-slate-600 mt-0.5">{subtitle}</div>}
    </div>
  )
}

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
  const bufferColor = bufferMonthsNum >= 3 ? 'text-soft-linen-700' : bufferMonthsNum >= 1 ? 'text-lemon-chiffon-600' : 'text-vibrant-coral-600'

  const surplusColor = surplus >= 300 ? 'text-soft-linen-700' : surplus >= 100 ? 'text-lemon-chiffon-600' : 'text-vibrant-coral-600'

  const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="bg-ash-grey-50 border-t border-ash-grey-100 px-6 py-3">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
        <Tile label="Monthly Income" value={fmt(totalIncome)} valueClass="text-soft-linen-700" />
        <Tile label="Total Expenses" value={fmt(totalExpenses)} valueClass="text-ash-grey-800" />
        <Tile
          label="Monthly Surplus"
          value={(surplus < 0 ? '-' : '') + fmt(surplus)}
          valueClass={surplusColor}
        />
        <Tile
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          valueClass={savingsRate >= savingsRateTarget ? 'text-soft-linen-700' : 'text-vibrant-coral-600'}
        />
        <Tile
          label="Monthly Savings"
          value={fmt(monthlySavings)}
          valueClass={monthlySavings >= 500 ? 'text-soft-linen-700' : monthlySavings >= 200 ? 'text-lemon-chiffon-600' : 'text-vibrant-coral-600'}
          subtitle="incl. pension"
        />
        <Tile
          label="Net Worth"
          value={fmtK(netWorth)}
          valueClass="text-tropical-teal-600"
        />
        <Tile
          label="Buffer Coverage"
          value={bufferMonths === '—' ? '—' : `${bufferMonths}mo`}
          valueClass={bufferColor}
          subtitle={`£${(s.bufferBalance||0).toLocaleString('en-GB')}`}
        />
      </div>
    </div>
  )
}

function Tile({ label, value, valueClass, subtitle }) {
  return (
    <div className="text-center">
      <div className="text-xs text-ash-grey-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-ash-grey-400 mt-0.5">{subtitle}</div>}
    </div>
  )
}

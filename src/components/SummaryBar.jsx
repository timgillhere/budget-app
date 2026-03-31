import { calcBudgetSummary } from '../utils/budgetCalcs'

export default function SummaryBar({ budget }) {
  const { totalIncome, totalExpenses, surplus, savingsRate, pensionContribution, isaContribution, budgetedSavings } = calcBudgetSummary(budget)
  const monthlySavings = pensionContribution + isaContribution + budgetedSavings
  const savingsRateTarget = budget?.settings?.savingsRateTarget || 10

  const surplusColor = surplus >= 300 ? 'text-soft-linen-700' : surplus >= 100 ? 'text-lemon-chiffon-600' : 'text-vibrant-coral-600'
  const surplusBg = surplus >= 300 ? 'bg-soft-linen-50 border-soft-linen-200' : surplus >= 100 ? 'bg-lemon-chiffon-50 border-lemon-chiffon-200' : 'bg-vibrant-coral-50 border-vibrant-coral-200'

  const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="bg-ash-grey-50 border-t border-ash-grey-100 px-6 py-3">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
        <Tile label="Monthly Income" value={fmt(totalIncome)} valueClass="text-soft-linen-700" />
        <Tile label="Total Expenses" value={fmt(totalExpenses)} valueClass="text-ash-grey-800" />
        <Tile
          label="Monthly Surplus"
          value={(surplus < 0 ? '-' : '') + fmt(surplus)}
          valueClass={surplusColor}
          extra={surplusBg}
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

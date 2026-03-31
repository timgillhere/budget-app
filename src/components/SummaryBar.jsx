export default function SummaryBar({ budget }) {
  const totalIncome = budget.income.items.reduce((s, i) => s + i.monthly, 0)
  const totalExpenses = budget.sections.reduce((s, sec) =>
    s + sec.groups.reduce((gs, g) =>
      gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
  const surplus = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0
  const expensePct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0

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
          valueClass={savingsRate >= 10 ? 'text-soft-linen-700' : 'text-vibrant-coral-600'}
        />
        <Tile
          label="Expenses / Income"
          value={`${expensePct.toFixed(1)}%`}
          valueClass={expensePct <= 90 ? 'text-soft-linen-700' : 'text-vibrant-coral-600'}
        />
      </div>
    </div>
  )
}

function Tile({ label, value, valueClass }) {
  return (
    <div className="text-center">
      <div className="text-xs text-ash-grey-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

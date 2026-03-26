export default function SummaryBar({ budget }) {
  const totalIncome = budget.income.items.reduce((s, i) => s + i.monthly, 0)
  const totalExpenses = budget.sections.reduce((s, sec) =>
    s + sec.groups.reduce((gs, g) =>
      gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
  const surplus = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0
  const expensePct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0

  const surplusColor = surplus >= 300 ? 'text-green-700' : surplus >= 100 ? 'text-amber-600' : 'text-red-600'
  const surplusBg = surplus >= 300 ? 'bg-green-50 border-green-200' : surplus >= 100 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const fmt = (n) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="bg-white border-t border-gray-100 px-6 py-3">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
        <Tile label="Monthly Income" value={fmt(totalIncome)} valueClass="text-green-700" />
        <Tile label="Total Expenses" value={fmt(totalExpenses)} valueClass="text-gray-800" />
        <Tile
          label="Monthly Surplus"
          value={(surplus < 0 ? '-' : '') + fmt(surplus)}
          valueClass={surplusColor}
          extra={surplusBg}
        />
        <Tile
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          valueClass={savingsRate >= 10 ? 'text-green-700' : 'text-red-600'}
        />
        <Tile
          label="Expenses / Income"
          value={`${expensePct.toFixed(1)}%`}
          valueClass={expensePct <= 90 ? 'text-green-700' : 'text-red-600'}
        />
      </div>
    </div>
  )
}

function Tile({ label, value, valueClass }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

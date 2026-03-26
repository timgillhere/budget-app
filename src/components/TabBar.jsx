const TABS = [
  { id: 'budget',   label: 'Budget',    icon: '💰' },
  { id: 'charts',   label: 'Charts',    icon: '📊' },
  { id: 'forecast', label: 'Forecast',  icon: '🔮' },
  { id: 'holidays', label: 'Holidays',  icon: '✈️' },
  { id: 'insights', label: 'Insights',  icon: '💡' },
  { id: 'networth', label: 'Net Worth', icon: '💎' },
  { id: 'settings', label: 'Settings',  icon: '⚙️' },
]

export default function TabBar({ active, onChange, isAdmin = false }) {
  const tabs = isAdmin ? [...TABS, { id: 'users', label: 'Users', icon: '👤' }] : TABS
  return (
    <div className="bg-white border-b border-gray-200 px-4 overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              active === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

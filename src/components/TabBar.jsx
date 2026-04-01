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
    <div className="bg-ash-grey-50 border-b border-ash-grey-200 overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              active === tab.id
                ? 'border-vibrant-coral-500 text-vibrant-coral-500'
                : 'border-transparent text-ash-grey-500 hover:text-ash-grey-800 hover:border-ash-grey-300'
            }`}
          >
            <span className="text-base sm:text-sm leading-none">{tab.icon}</span>
            <span className="text-[10px] sm:text-sm leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

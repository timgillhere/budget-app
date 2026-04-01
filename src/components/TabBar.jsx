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
    <div className="bg-nb-800 border-b border-nb-600 overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              active === tab.id
                ? 'border-neuro-500 text-neuro-400'
                : 'border-transparent text-slate-500 hover:text-slate-200 hover:border-nb-500'
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

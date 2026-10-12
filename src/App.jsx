import { useState, useEffect } from 'react'
import {
  BanknotesIcon, ChartBarIcon, ArrowTrendingUpIcon, PaperAirplaneIcon,
  LightBulbIcon, CircleStackIcon, Cog6ToothIcon, UsersIcon,
  ArrowRightOnRectangleIcon, Bars3Icon,
  BuildingLibraryIcon, CreditCardIcon,
} from '@heroicons/react/24/outline'
import { BudgetProvider, useBudget } from './context/BudgetContext'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import SummaryBar from './components/SummaryBar'
import BudgetSection, { Yearly } from './components/BudgetSection'
import Charts from './components/Charts'
import ForecastCharts from './components/ForecastCharts'
import HolidayPlanner from './components/HolidayPlanner'
import Insights from './components/Insights'
import NetWorthDashboard from './components/NetWorthDashboard'
import SettingsPanel from './components/SettingsPanel'
import AdminPanel from './components/AdminPanel'
import OnboardingModal from './components/OnboardingModal'
import SavingsOverview from './components/SavingsOverview'
import TransactionsPage from './components/TransactionsPage'
import { TransactionProvider } from './context/TransactionContext'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Sidebar nav items ────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'budget',   label: 'Budget',    Icon: BanknotesIcon },
  { id: 'charts',   label: 'Charts',    Icon: ChartBarIcon },
  { id: 'savings',  label: 'Savings',   Icon: BuildingLibraryIcon },
  { id: 'transactions', label: 'Transactions', Icon: CreditCardIcon },
  { id: 'forecast', label: 'Forecast',  Icon: ArrowTrendingUpIcon },
  { id: 'holidays', label: 'Holidays',  Icon: PaperAirplaneIcon },
  { id: 'insights', label: 'Insights',  Icon: LightBulbIcon },
  { id: 'networth', label: 'Net Worth', Icon: CircleStackIcon },
  { id: 'settings', label: 'Settings',  Icon: Cog6ToothIcon },
]

// ── Sidebar contents ─────────────────────────────────────────────────
function SidebarContents({ tab, setTab, isAdmin, firstName, logout, saveStatus, onClose }) {
  const now = new Date()
  const weekday  = now.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
  const dayMonth = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }).toUpperCase()
  const tabs = isAdmin ? [...NAV_TABS, { id: 'users', label: 'Users', Icon: UsersIcon }] : NAV_TABS

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-3 pt-4 pb-3 flex items-center gap-2 flex-shrink-0">
        <img src="/logo.png" className="h-9 w-9 rounded-xl" alt="" />
        <span className="text-slate-300 font-bold text-lg">Tim's Budget</span>
      </div>

      {/* Greeting card */}
      <div className="mx-2 mb-4 flex-shrink-0">
        <div className="bg-nb-750 rounded-xl border border-nb-600 p-4"
          style={{ boxShadow: '0 0 30px rgba(79, 126, 247, 0.1)' }}>
          <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-1">
            {weekday}, {dayMonth}
          </p>
          <p className="text-xl font-extrabold text-white leading-snug">
            Welcome back,<br />{firstName || 'there'}!
          </p>
          <div className="mt-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              saveStatus === 'saved'  ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800/60' :
              saveStatus === 'saving' ? 'bg-amber-900/50 text-amber-400 border-amber-800/60' :
                                        'bg-red-900/50 text-red-400 border-red-800/60'
            }`}>
              {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '… Saving' : '! Error'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); onClose() }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
              tab === t.id
                ? 'bg-nb-650 text-slate-200'
                : 'text-slate-500 hover:bg-nb-650 hover:text-slate-200'
            }`}
          >
            <t.Icon className="w-5 h-5 flex-shrink-0" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-nb-700/40 flex-shrink-0">
        <button
          onClick={() => logout()}
          disabled={saveStatus === 'saving'}
          title={saveStatus === 'saving' ? 'Saving your data — please wait…' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-200 hover:bg-nb-650 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

// ── Budget tab (read-only) ───────────────────────────────────────────
function BudgetTab() {
  const { data } = useBudget()
  const totalIncome = data.income.items.reduce((s, i) => s + i.monthly, 0)
  // Free Spend (the 'current' section) leads the page, above Income.
  const freeSpend = data.sections.find(s => s.id === 'current')
  const otherSections = data.sections.filter(s => s.id !== 'current')

  return (
    <main className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {freeSpend && <BudgetSection section={freeSpend} />}

      {/* Income */}
      <section className="bg-nb-750 rounded-xl border border-nb-600 overflow-hidden" style={{ boxShadow: '0 0 30px rgba(52,211,153,0.08)' }}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-emerald-900/40 border-b border-nb-600">
          <div className="text-emerald-300 font-bold text-lg">Income</div>
          <div className="text-right">
            <div className="text-emerald-300 font-bold text-lg tabular-nums">{fmt(totalIncome)}</div>
            <Yearly monthly={totalIncome} className="text-emerald-400/70" />
          </div>
        </div>
        <ul className="divide-y divide-nb-600">
          {data.income.items.map(item => (
            <li key={item.id} className="flex items-start justify-between gap-4 px-4 sm:px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-slate-100">{item.name}</div>
                {item.notes && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.notes}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-base font-semibold text-slate-100 tabular-nums">{fmt(item.monthly)}</div>
                <Yearly monthly={item.monthly} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {otherSections.map(section => (
        <BudgetSection key={section.id} section={section} />
      ))}
    </main>
  )
}

// ── Main app shell ───────────────────────────────────────────────────
function AppShell({ isAdmin, logout, name }) {
  const { data, loading, error, saveStatus } = useBudget()
  const [tab, setTab] = useState('budget')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (data && showOnboarding === null) setShowOnboarding(!data?.settings?.onboardingComplete)
  }, [data, showOnboarding])

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY
      setScrolled(prev => {
        if (!prev && top > 80) return true
        if (prev && top < 40) return false
        return prev
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])



  // Close sidebar on tab change (mobile)
  const handleTabChange = (newTab) => { setTab(newTab); setSidebarOpen(false); window.scrollTo(0, 0) }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-nb-900 text-slate-500">
      <div className="text-center"><img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-3 opacity-70" /><div className="text-sm">Loading...</div></div>
    </div>
  )

  // The budget couldn't be read, but the session is fine. Everything below assumes `data` exists,
  // so this is a stop — and it says why, rather than showing an empty budget that looks like a
  // brand-new account and quietly starts the onboarding wizard.
  if (error && !data) return (
    <div className="flex items-center justify-center h-screen bg-nb-900 px-6">
      <div className="max-w-sm text-center">
        <img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-4 opacity-70" />
        <h1 className="text-base font-semibold text-slate-200 mb-3">Couldn&rsquo;t load your budget</h1>
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300 text-left mb-3">
          {error}
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Your budget is read from a Google Sheet. Your sign-in is fine &mdash; it&rsquo;s the sheet
          connection that failed.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1.5 rounded-lg bg-nb-700 hover:bg-nb-600 text-slate-300 transition-colors">
            Try again
          </button>
          <button
            onClick={() => logout()}
            className="text-xs px-3 py-1.5 rounded-lg bg-nb-800 hover:bg-nb-700 text-slate-400 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  const firstName = (data?.settings?.name || name || '').split(' ')[0] || ''

  return (
    <div className="nb-grid-bg min-h-svh bg-nb-900">

      {/* ── Desktop sidebar (fixed left) ─────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-52 bg-nb-800 border-r border-nb-700/40 z-40 overflow-y-auto">
        <SidebarContents
          tab={tab} setTab={handleTabChange} isAdmin={isAdmin}
          firstName={firstName} logout={logout} saveStatus={saveStatus}
          onClose={() => {}}
        />
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-nb-800 border-r border-nb-700/40 flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContents
          tab={tab} setTab={handleTabChange} isAdmin={isAdmin}
          firstName={firstName} logout={logout} saveStatus={saveStatus}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* ── Main content area ─────────────────────────── */}
      <div className="lg:ml-52">

        {/* Sticky header block: mobile nav + action bar + summary */}
        <div className="sticky top-0 z-30">
          {/* Mobile header */}
          <header className="lg:hidden bg-nb-800/95 backdrop-blur border-b border-nb-600 px-4 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: '0.75rem' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 hover:text-white p-2.5 -ml-1 min-w-11 min-h-11 rounded-lg hover:bg-nb-700 transition-colors flex-shrink-0 flex items-center justify-center"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <img src="/logo.png" alt="" className="h-6 w-6 flex-shrink-0" />
            <span className="text-slate-300 font-bold text-sm truncate">
              {firstName ? `${firstName}'s Budget` : 'Budget'}
            </span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${
              saveStatus === 'saved'  ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800/60' :
              saveStatus === 'saving' ? 'bg-amber-900/50 text-amber-400 border-amber-800/60' :
                                        'bg-red-900/50 text-red-400 border-red-800/60'
            }`}>
              {saveStatus === 'saved' ? '✓' : saveStatus === 'saving' ? '…' : '!'}
            </span>
          </header>

          {/* Summary bar — budget, charts, savings tabs */}
          {(tab === 'budget' || tab === 'charts' || tab === 'savings') && <SummaryBar budget={data} compact={scrolled} />}
        </div>

        {/* Tab content */}
        {tab === 'budget'   && <BudgetTab />}
        {tab === 'charts'   && <div className="max-w-5xl mx-auto px-4 py-6"><Charts budget={data} /></div>}
        {tab === 'savings'  && <SavingsOverview />}
        {tab === 'transactions' && <TransactionsPage budget={data} />}
        {tab === 'forecast' && <ForecastCharts />}
        {tab === 'holidays' && <HolidayPlanner />}
        {tab === 'insights' && <Insights />}
        {tab === 'networth' && <NetWorthDashboard />}
        {tab === 'settings' && <SettingsPanel onStartOnboarding={() => setShowOnboarding(true)} />}
        {tab === 'users'    && isAdmin && <AdminPanel />}
      </div>

      {showOnboarding && (
        <OnboardingModal userName={name} onClose={() => setShowOnboarding(false)} />
      )}

    </div>
  )
}

export default function App() {
  const { user, loading, isAdmin, login, logout } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-nb-900 text-slate-500">
      <div className="text-center"><img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-3 opacity-70" /><div className="text-sm">Loading…</div></div>
    </div>
  )

  if (!user) return <LoginScreen onLogin={login} />

  return (
    <BudgetProvider onLogout={logout}>
      <TransactionProvider onLogout={logout}>
        <AppShell isAdmin={isAdmin} logout={logout} name={user?.name} />
      </TransactionProvider>
    </BudgetProvider>
  )
}

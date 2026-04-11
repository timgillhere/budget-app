import { useState, useEffect, useRef } from 'react'
import {
  BanknotesIcon, ChartBarIcon, ArrowTrendingUpIcon, PaperAirplaneIcon,
  LightBulbIcon, CircleStackIcon, Cog6ToothIcon, UsersIcon,
  ArrowRightOnRectangleIcon, Bars3Icon,
  ArrowDownTrayIcon, ArrowUpTrayIcon, ClipboardDocumentIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BudgetProvider, useBudget } from './context/BudgetContext'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import MfaVerifyScreen from './components/MfaVerifyScreen'
import SummaryBar from './components/SummaryBar'
import BudgetSection from './components/BudgetSection'
import EditModal from './components/EditModal'
import Charts from './components/Charts'
import ForecastCharts from './components/ForecastCharts'
import HolidayPlanner from './components/HolidayPlanner'
import Insights from './components/Insights'
import NetWorthDashboard from './components/NetWorthDashboard'
import SettingsPanel from './components/SettingsPanel'
import AdminPanel from './components/AdminPanel'
import OnboardingModal from './components/OnboardingModal'

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)) }
const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function findGroup(budget, sectionId, groupId) {
  return budget.sections.find(s => s.id === sectionId)?.groups.find(g => g.id === groupId)
}

import { calcBudgetSummary } from './utils/budgetCalcs'

function generateSnapshot(data) {
  const budget = data
  const { totalIncome, totalExpenses, surplus, savingsRate, pensionContribution, isaContribution, budgetedSavings } = calcBudgetSummary(budget)
  const savingsRateFmt = savingsRate.toFixed(1)
  const lines = [
    `=== BUDGET SNAPSHOT ===`, `Generated: ${new Date().toLocaleString('en-GB')}`, ``,
    `── INCOME ──`,
    ...budget.income.items.map(i => `  ${i.name}: ${fmt(i.monthly)}/month${i.notes ? ' — ' + i.notes : ''}`),
    `  TOTAL: ${fmt(totalIncome)}/month`, ``
  ]
  budget.sections.forEach(section => {
    const sectionTotal = section.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)
    lines.push(`── ${section.name.toUpperCase()} — ${fmt(sectionTotal)}/month ──`)
    section.groups.forEach(group => {
      const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
      lines.push(`  ${group.name} [${fmt(groupTotal)}/month]`)
      group.items.forEach(item => lines.push(`    • ${item.name}: ${fmt(item.monthly)}/month${item.notes ? ' — ' + item.notes : ''}`))
    })
    lines.push(`  Section total: ${fmt(sectionTotal)}/month`); lines.push(``)
  })
  const futureEvents = budget.settings?.futureEvents || []
  if (futureEvents.length > 0) {
    lines.push(`── KNOWN FUTURE EVENTS ──`)
    futureEvents.forEach(ev => {
      const d = ev.date ? new Date(ev.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'no date'
      lines.push(`  ${ev.icon || '📅'} ${ev.label}: ${d} — ${ev.monthlyImpact > 0 ? '+' : ''}£${ev.monthlyImpact}/month`)
    })
    lines.push(``)
  }
  lines.push(`── SUMMARY ──`)
  lines.push(`  Take-home income: ${fmt(totalIncome)}/month | Total outgoings: ${fmt(totalExpenses)}/month | Surplus: ${fmt(surplus)}/month`)
  lines.push(`  Savings: Pension ${fmt(pensionContribution)} (pre-tax) + ISA ${fmt(isaContribution)} + Savings groups ${fmt(budgetedSavings)} + Surplus ${fmt(surplus)} | True savings rate: ${savingsRateFmt}% of gross income`)
  lines.push(``, `════════════════════════════════════`, `INSTRUCTIONS FOR CLAUDE`, `════════════════════════════════════`)
  lines.push(`You are a UK personal financial advisor. The full data is in the JSON block below.`)
  lines.push(`1. Acknowledge current state (surplus, savings rate, key observations)`)
  lines.push(`2. Discuss any changes requested`)
  lines.push(`3. When done, output the COMPLETE updated data as a JSON code block tagged: \`\`\`budget-json`)
  lines.push(`Rules: preserve all IDs, new items use "item-<timestamp>", new groups use "grp-<timestamp>",`)
  lines.push(`never change section ids (starling/current/monzo), all monthly values must be numbers.`)
  lines.push(`Output the FULL JSON every time.`)
  lines.push(`════════════════════════════════════`, ``, `\`\`\`budget-json`)
  lines.push(JSON.stringify(data, null, 2)); lines.push(`\`\`\``)
  return lines.join('\n')
}

function validateBudget(data) {
  if (!data || typeof data !== 'object') return 'Not a valid JSON object'
  if (!data.income || !Array.isArray(data.income.items)) return 'Missing income.items'
  if (!Array.isArray(data.sections)) return 'Missing sections'
  return null
}

// ── Sidebar nav items ────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'budget',   label: 'Budget',    Icon: BanknotesIcon },
  { id: 'charts',   label: 'Charts',    Icon: ChartBarIcon },
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
          onClick={logout}
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

// Sortable wrapper for section-level reordering — passes drag handle listeners down
function SortableSectionItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
    >
      {children(listeners)}
    </div>
  )
}

// ── Budget tab ───────────────────────────────────────────────────────
function BudgetTab() {
  const { data, save } = useBudget()
  const [incomeModal, setIncomeModal] = useState(null)

  const addItem    = (sectionId, groupId, item) => { const u = deepClone(data); findGroup(u, sectionId, groupId).items.push({ ...item, id: `item-${Date.now()}` }); save(u) }
  const editItem   = (sectionId, groupId, itemId, item) => { const u = deepClone(data); const g = findGroup(u, sectionId, groupId); const idx = g.items.findIndex(i => i.id === itemId); g.items[idx] = { ...item, id: itemId }; save(u) }
  const deleteItem = (sectionId, groupId, itemId) => { const u = deepClone(data); const g = findGroup(u, sectionId, groupId); g.items = g.items.filter(i => i.id !== itemId); save(u) }
  const addGroup   = (sectionId, { name, isSavings, color }) => { const u = deepClone(data); const grp = { id: `grp-${Date.now()}`, name, isSavings: !!isSavings, items: [] }; if (color) grp.color = color; u.sections.find(s => s.id === sectionId).groups.push(grp); save(u) }
  const editGroup  = (sectionId, groupId, { name, isSavings, currentBalance, color }) => {
    const u = deepClone(data); const g = findGroup(u, sectionId, groupId); g.name = name; g.isSavings = !!isSavings
    if (currentBalance != null) g.currentBalance = currentBalance; else delete g.currentBalance
    if (color) g.color = color; else delete g.color
    save(u)
  }
  const deleteGroup = (sectionId, groupId) => { const u = deepClone(data); const sec = u.sections.find(s => s.id === sectionId); sec.groups = sec.groups.filter(g => g.id !== groupId); save(u) }
  const reorderGroups = (sectionId, newGroupsArray) => { const u = deepClone(data); u.sections.find(s => s.id === sectionId).groups = newGroupsArray; save(u) }
  const reorderItems = (sectionId, groupId, newItemsArray) => { const u = deepClone(data); findGroup(u, sectionId, groupId).items = newItemsArray; save(u) }
  const reorderSections = (newSections) => { const u = deepClone(data); u.sections = newSections; save(u) }
  const editSection = (sectionId, { name, color }) => { const u = deepClone(data); const s = u.sections.find(s => s.id === sectionId); s.name = name; if (color) s.color = color; save(u) }

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
  const handleSectionDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = data.sections.findIndex(s => s.id === active.id)
    const newIdx = data.sections.findIndex(s => s.id === over.id)
    reorderSections(arrayMove([...data.sections], oldIdx, newIdx))
  }
  const handleIncomeModalSave = (item) => {
    const u = deepClone(data)
    if (incomeModal.mode === 'add-item') u.income.items.push({ ...item, id: `inc-${Date.now()}` })
    else { const idx = u.income.items.findIndex(i => i.id === incomeModal.item.id); u.income.items[idx] = { ...item, id: incomeModal.item.id } }
    save(u); setIncomeModal(null)
  }
  const deleteIncomeItem = (id) => { const u = deepClone(data); u.income.items = u.income.items.filter(i => i.id !== id); save(u) }

  const totalIncome = data.income.items.reduce((s, i) => s + i.monthly, 0)

  return (
    <>
      <main className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Income */}
        <div className="bg-nb-750 rounded-xl border border-nb-600 overflow-hidden" style={{ boxShadow: '0 0 30px rgba(52,211,153,0.08)' }}>
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-emerald-900/40 border-b border-nb-600">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-emerald-300 font-bold">Income</span>
              <span className="text-emerald-400/70 text-sm">{fmt(totalIncome)}/month</span>
            </div>
            <button onClick={() => setIncomeModal({ mode: 'add-item' })} className="text-emerald-400/70 hover:text-emerald-300 text-xs border border-emerald-700/50 hover:border-emerald-600 px-2 py-1 rounded transition-colors">+ Add</button>
          </div>
          {/* Mobile: tap-row-to-edit list */}
          <ul className="sm:hidden divide-y divide-nb-700">
            {data.income.items.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setIncomeModal({ mode: 'edit-item', item })}
                  className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px] text-left active:bg-nb-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] text-slate-200 truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{fmt(item.monthly * 12)}/yr</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-base font-bold text-emerald-400 tabular-nums">{fmt(item.monthly)}</span>
                    <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: full table */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed">
              <colgroup><col style={{ width: '55%' }} /><col style={{ width: '17%' }} /><col style={{ width: '17%' }} /><col style={{ width: '11%' }} /></colgroup>
              <thead><tr className="text-xs text-slate-500 border-b border-nb-600">
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Monthly</th>
                <th className="px-4 py-2 text-right font-medium">Annual</th>
                <th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {data.income.items.map(item => (
                  <tr key={item.id} className="group hover:bg-nb-700 transition-colors">
                    <td className="px-4 py-2 text-sm text-slate-400">
                      <div className="relative inline-flex items-center gap-1.5">
                        <span className="truncate">{item.name}</span>
                        {item.notes && (
                          <span className="relative flex-shrink-0 group/tip">
                            <span className="text-slate-600 hover:text-slate-400 cursor-default text-xs">ℹ</span>
                            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-nb-800 text-slate-200 text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg border border-nb-600 whitespace-normal">{item.notes}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm font-bold text-emerald-400 text-right tabular-nums">{fmt(item.monthly)}</td>
                    <td className="px-4 py-2 text-sm text-slate-500 text-right tabular-nums">{fmt(item.monthly * 12)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setIncomeModal({ mode: 'edit-item', item })} className="text-xs text-neuro-400 hover:text-neuro-300 px-2 py-1 rounded hover:bg-nb-700">Edit</button>
                        <button onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) deleteIncomeItem(item.id) }} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-nb-700">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={data.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {data.sections.map(section => (
              <SortableSectionItem key={section.id} id={section.id}>
                {(dragHandleListeners) => (
                  <BudgetSection section={section}
                    dragHandleListeners={dragHandleListeners}
                    onEditSection={(data) => editSection(section.id, data)}
                    onAddItem={(groupId, item) => addItem(section.id, groupId, item)}
                    onEditItem={(groupId, itemId, item) => editItem(section.id, groupId, itemId, item)}
                    onDeleteItem={(groupId, itemId) => deleteItem(section.id, groupId, itemId)}
                    onAddGroup={(grp) => addGroup(section.id, grp)}
                    onEditGroup={(groupId, grp) => editGroup(section.id, groupId, grp)}
                    onDeleteGroup={(groupId) => deleteGroup(section.id, groupId)}
                    onReorderGroups={(newArr) => reorderGroups(section.id, newArr)}
                    onReorderItems={(groupId, newArr) => reorderItems(section.id, groupId, newArr)}
                  />
                )}
              </SortableSectionItem>
            ))}
          </SortableContext>
        </DndContext>
        <p className="text-center text-xs text-slate-600 pb-4">Changes saved automatically</p>
      </main>

      {incomeModal && (
        <EditModal
          mode={incomeModal.mode}
          initial={incomeModal.item}
          onSave={handleIncomeModalSave}
          onClose={() => setIncomeModal(null)}
          onDelete={incomeModal.mode === 'edit-item' ? () => { deleteIncomeItem(incomeModal.item.id); setIncomeModal(null) } : undefined}
        />
      )}

    </>
  )
}


// ── Main app shell ───────────────────────────────────────────────────
function AppShell({ isAdmin, logout, name }) {
  const { data, loading, saveStatus, save } = useBudget()
  const [tab, setTab] = useState('budget')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [copyFlash, setCopyFlash] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importError, setImportError] = useState(null)

  useEffect(() => {
    if (data && showOnboarding === null) setShowOnboarding(!data?.settings?.onboardingComplete)
  }, [data, showOnboarding])


  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `budget-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateSnapshot(data)).then(() => { setCopyFlash(true); setTimeout(() => setCopyFlash(false), 2500) })
  }
  const handleFileChange = (e) => {
    setImportError(null); const file = e.target.files[0]; if (!file) return; e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const err = validateBudget(parsed); if (err) { setImportError(`Invalid file: ${err}`); return }
        const totalIncome = parsed.income.items.reduce((s, i) => s + i.monthly, 0)
        const totalExpenses = parsed.sections.reduce((s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
        setImportPreview({ data: parsed, totalIncome, totalExpenses, surplus: totalIncome - totalExpenses })
      } catch { setImportError("Couldn't parse file") }
    }
    reader.readAsText(file)
  }

  // Close sidebar on tab change (mobile)
  const handleTabChange = (newTab) => { setTab(newTab); setSidebarOpen(false) }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-nb-900 text-slate-500">
      <div className="text-center"><img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-3 opacity-70" /><div className="text-sm">Loading...</div></div>
    </div>
  )

  const firstName = (data?.settings?.name || name || '').split(' ')[0] || ''

  return (
    <div className="nb-grid-bg min-h-screen bg-nb-900">

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
      <div className="lg:ml-52 flex flex-col h-screen overflow-y-auto overflow-x-hidden" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 60)}>

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

          {/* Global action bar — all pages, mobile + desktop */}
          <div className="bg-nb-800 border-b border-nb-600 px-3 sm:px-6 py-1.5 flex justify-end gap-2">
            <label className="cursor-pointer px-3.5 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-lg text-sm sm:text-xs font-medium bg-neuro-600 text-white hover:bg-neuro-500 transition-colors flex items-center gap-1.5">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import from JSON</span><span className="sm:hidden">Import</span>
              <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
            </label>
            <button onClick={exportJSON} className="px-3.5 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-lg text-sm sm:text-xs font-medium bg-nb-600 text-slate-300 hover:bg-nb-500 hover:text-white transition-colors border border-nb-500 flex items-center gap-1.5">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export JSON</span><span className="sm:hidden">Export</span>
            </button>
            <button onClick={copyToClipboard} className={`px-3.5 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-lg text-sm sm:text-xs font-medium transition-all flex items-center gap-1.5 ${copyFlash ? 'bg-emerald-700 text-white' : 'bg-nb-600 text-slate-300 hover:bg-nb-500 hover:text-white border border-nb-500'}`}>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copyFlash ? 'Copied!' : 'Copy for Claude'}</span><span className="sm:hidden">{copyFlash ? '✓' : 'Claude'}</span>
            </button>
          </div>

          {/* Summary bar — budget + charts tabs only */}
          {(tab === 'budget' || tab === 'charts') && <SummaryBar budget={data} compact={scrolled} />}
        </div>

        {/* Tab content */}
        {tab === 'budget'   && <BudgetTab />}
        {tab === 'charts'   && <div className="max-w-5xl mx-auto px-4 py-6"><Charts budget={data} /></div>}
        {tab === 'forecast' && <ForecastCharts />}
        {tab === 'holidays' && <HolidayPlanner />}
        {tab === 'insights' && <Insights />}
        {tab === 'networth' && <NetWorthDashboard />}
        {tab === 'settings' && <SettingsPanel onStartOnboarding={() => setShowOnboarding(true)} />}
        {tab === 'users'    && isAdmin && <AdminPanel />}
      </div>

      {showOnboarding && (
        <OnboardingModal jwtName={name} onClose={() => setShowOnboarding(false)} />
      )}

      {importError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900 border border-red-700 text-red-200 text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 max-w-md">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="font-bold text-xl">&times;</button>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-nb-750 rounded-xl border border-nb-600 shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-1 text-slate-100">Import Budget from Claude</h2>
            <p className="text-sm text-slate-500 mb-4">This will <strong className="text-slate-300">replace your current budget</strong> with the imported data.</p>
            <div className="bg-nb-800 border border-nb-600 rounded-lg p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Monthly income</span><span className="font-bold text-emerald-400">{fmt(importPreview.totalIncome)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Monthly expenses</span><span className="font-bold text-slate-200">{fmt(importPreview.totalExpenses)}</span></div>
              <div className="flex justify-between border-t border-nb-600 pt-2">
                <span className="text-slate-400 font-medium">Monthly surplus</span>
                <span className={`font-bold ${importPreview.surplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(importPreview.surplus)}</span>
              </div>
              {(() => {
                const events = importPreview.data?.settings?.futureEvents || []
                return events.length > 0 ? (
                  <div className="border-t border-nb-600 pt-2 space-y-1">
                    <span className="text-slate-500">Known future events</span>
                    {events.map((ev, i) => (
                      <div key={i} className="flex justify-between pl-2">
                        <span className="text-slate-400">{ev.icon || '📅'} {ev.label}</span>
                        <span className={`font-medium ${ev.monthlyImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{ev.monthlyImpact >= 0 ? '+' : ''}£{ev.monthlyImpact}/mo</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={() => { save(importPreview.data); setImportPreview(null) }} className="flex-1 bg-neuro-600 hover:bg-neuro-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Import & Replace</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { user, loading, isAdmin, mfaPending, login, logout, completeMfa } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-nb-900 text-slate-500">
      <div className="text-center"><img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-3 opacity-70" /><div className="text-sm">Loading…</div></div>
    </div>
  )

  if (mfaPending) return <MfaVerifyScreen onVerified={completeMfa} onCancel={logout} />
  if (!user) return <LoginScreen onLogin={login} />

  return (
    <BudgetProvider onLogout={logout}>
      <AppShell isAdmin={isAdmin} logout={logout} name={user?.name} />
    </BudgetProvider>
  )
}

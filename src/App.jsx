import { useState } from 'react'
import { BudgetProvider, useBudget } from './context/BudgetContext'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import TabBar from './components/TabBar'
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
    `=== BUDGET SNAPSHOT ===`,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    ``,
    `── INCOME ──`,
    ...budget.income.items.map(i => `  ${i.name}: ${fmt(i.monthly)}/month${i.notes ? ' — ' + i.notes : ''}`),
    `  TOTAL: ${fmt(totalIncome)}/month`,
    ``
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

  lines.push(`── SUMMARY ──`)
  lines.push(`  Take-home income: ${fmt(totalIncome)}/month | Total outgoings: ${fmt(totalExpenses)}/month | Surplus: ${fmt(surplus)}/month`)
  lines.push(`  Savings: Pension ${fmt(pensionContribution)} (pre-tax) + ISA ${fmt(isaContribution)} + Savings groups ${fmt(budgetedSavings)} + Surplus ${fmt(surplus)} | True savings rate: ${savingsRateFmt}% of gross income`)
  lines.push(``)
  lines.push(`════════════════════════════════════`)
  lines.push(`INSTRUCTIONS FOR CLAUDE`)
  lines.push(`════════════════════════════════════`)
  lines.push(`You are a UK personal financial advisor. The full data is in the JSON block below.`)
  lines.push(`1. Acknowledge current state (surplus, savings rate, key observations)`)
  lines.push(`2. Discuss any changes requested`)
  lines.push(`3. When done, output the COMPLETE updated data as a JSON code block tagged: \`\`\`budget-json`)
  lines.push(`Rules: preserve all IDs, new items use "item-<timestamp>", new groups use "grp-<timestamp>",`)
  lines.push(`never change section ids (starling/current/monzo), all monthly values must be numbers.`)
  lines.push(`Output the FULL JSON every time.`)
  lines.push(`════════════════════════════════════`)
  lines.push(``)
  lines.push(`\`\`\`budget-json`)
  lines.push(JSON.stringify(data, null, 2))
  lines.push(`\`\`\``)

  return lines.join('\n')
}

function validateBudget(data) {
  if (!data || typeof data !== 'object') return 'Not a valid JSON object'
  if (!data.income || !Array.isArray(data.income.items)) return 'Missing income.items'
  if (!Array.isArray(data.sections)) return 'Missing sections'
  return null
}

// ── Budget tab (existing logic, lifted into component) ───────────────
function BudgetTab() {
  const { data, save } = useBudget()
  const [copyFlash, setCopyFlash] = useState(false)
  const [incomeModal, setIncomeModal] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importPreview, setImportPreview] = useState(null)

  const addItem = (sectionId, groupId, item) => {
    const u = deepClone(data); findGroup(u, sectionId, groupId).items.push({ ...item, id: `item-${Date.now()}` }); save(u)
  }
  const editItem = (sectionId, groupId, itemId, item) => {
    const u = deepClone(data); const g = findGroup(u, sectionId, groupId)
    const idx = g.items.findIndex(i => i.id === itemId); g.items[idx] = { ...item, id: itemId }; save(u)
  }
  const deleteItem = (sectionId, groupId, itemId) => {
    const u = deepClone(data); const g = findGroup(u, sectionId, groupId)
    g.items = g.items.filter(i => i.id !== itemId); save(u)
  }
  const addGroup = (sectionId, { name, isSavings }) => {
    const u = deepClone(data)
    u.sections.find(s => s.id === sectionId).groups.push({ id: `grp-${Date.now()}`, name, isSavings: !!isSavings, items: [] })
    save(u)
  }
  const editGroup = (sectionId, groupId, { name, isSavings, currentBalance }) => {
    const u = deepClone(data)
    const g = findGroup(u, sectionId, groupId)
    g.name = name
    g.isSavings = !!isSavings
    if (currentBalance != null) {
      g.currentBalance = currentBalance
    } else {
      delete g.currentBalance
    }
    save(u)
  }
  const deleteGroup = (sectionId, groupId) => {
    const u = deepClone(data); const sec = u.sections.find(s => s.id === sectionId)
    sec.groups = sec.groups.filter(g => g.id !== groupId); save(u)
  }
  const handleIncomeModalSave = (item) => {
    const u = deepClone(data)
    if (incomeModal.mode === 'add-item') u.income.items.push({ ...item, id: `inc-${Date.now()}` })
    else { const idx = u.income.items.findIndex(i => i.id === incomeModal.item.id); u.income.items[idx] = { ...item, id: incomeModal.item.id } }
    save(u); setIncomeModal(null)
  }
  const deleteIncomeItem = (id) => { const u = deepClone(data); u.income.items = u.income.items.filter(i => i.id !== id); save(u) }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateSnapshot(data))
      .then(() => { setCopyFlash(true); setTimeout(() => setCopyFlash(false), 2500) })
  }
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `budget-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
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

  const totalIncome = data.income.items.reduce((s, i) => s + i.monthly, 0)

  return (
    <>
      {/* Budget action bar */}
      <div className="bg-ash-grey-50 border-b border-ash-grey-200 px-6 py-2 flex justify-end gap-2">
        <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium bg-vibrant-coral-500 text-white hover:bg-vibrant-coral-600">
          📥 Import from Claude
          <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </label>
        <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ash-grey-600 text-white hover:bg-ash-grey-700">📤 Export JSON</button>
        <button onClick={copyToClipboard}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copyFlash ? 'bg-soft-linen-500 text-white' : 'bg-tropical-teal-600 text-white hover:bg-tropical-teal-700'}`}>
          {copyFlash ? '✓ Copied!' : '📋 Copy for Claude'}
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Income */}
        <div className="bg-white rounded-xl shadow-sm border border-ash-grey-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-soft-linen-600">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">💵 Income</span>
              <span className="text-white/80 text-sm">{fmt(totalIncome)}/month</span>
            </div>
            <button onClick={() => setIncomeModal({ mode: 'add-item' })} className="text-white/80 hover:text-white text-xs border border-white/40 px-2 py-1 rounded">+ Add</button>
          </div>
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '55%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead><tr className="text-xs text-ash-grey-400 border-b border-ash-grey-100">
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-4 py-2 text-right font-medium">Monthly</th>
              <th className="px-4 py-2 text-right font-medium">Annual</th>
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {data.income.items.map(item => (
                <tr key={item.id} className="group hover:bg-ash-grey-50">
                  <td className="px-4 py-2 text-sm text-ash-grey-800">
                    <div className="relative inline-flex items-center gap-1.5">
                      <span className="truncate">{item.name}</span>
                      {item.notes && (
                        <span className="relative flex-shrink-0 group/tip">
                          <span className="text-ash-grey-300 hover:text-ash-grey-500 cursor-default text-xs">ℹ</span>
                          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg whitespace-normal">
                            {item.notes}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm font-bold text-soft-linen-700 text-right tabular-nums">{fmt(item.monthly)}</td>
                  <td className="px-4 py-2 text-sm text-ash-grey-500 text-right tabular-nums">{fmt(item.monthly * 12)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => setIncomeModal({ mode: 'edit-item', item })} className="text-xs text-tropical-teal-600 hover:text-tropical-teal-700 px-2 py-1 rounded hover:bg-tropical-teal-50">Edit</button>
                      <button onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) deleteIncomeItem(item.id) }} className="text-xs text-vibrant-coral-500 hover:text-vibrant-coral-700 px-2 py-1 rounded hover:bg-vibrant-coral-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.sections.map(section => (
          <BudgetSection key={section.id} section={section}
            onAddItem={(groupId, item) => addItem(section.id, groupId, item)}
            onEditItem={(groupId, itemId, item) => editItem(section.id, groupId, itemId, item)}
            onDeleteItem={(groupId, itemId) => deleteItem(section.id, groupId, itemId)}
            onAddGroup={(name) => addGroup(section.id, name)}
            onEditGroup={(groupId, name) => editGroup(section.id, groupId, name)}
            onDeleteGroup={(groupId) => deleteGroup(section.id, groupId)}
          />
        ))}
        <p className="text-center text-xs text-gray-400 pb-4">Changes saved automatically</p>
      </main>

      {incomeModal && <EditModal mode={incomeModal.mode} initial={incomeModal.item} onSave={handleIncomeModalSave} onClose={() => setIncomeModal(null)} />}

      {importError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-vibrant-coral-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 max-w-md">
          <span>⚠️ {importError}</span>
          <button onClick={() => setImportError(null)} className="font-bold text-xl">&times;</button>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-1">📥 Import Budget from Claude</h2>
            <p className="text-sm text-ash-grey-500 mb-4">This will <strong>replace your current budget</strong> with the imported data.</p>
            <div className="bg-ash-grey-50 border border-ash-grey-200 rounded-lg p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ash-grey-600">Monthly income</span><span className="font-bold text-soft-linen-700">{fmt(importPreview.totalIncome)}</span></div>
              <div className="flex justify-between"><span className="text-ash-grey-600">Monthly expenses</span><span className="font-bold text-ash-grey-700">{fmt(importPreview.totalExpenses)}</span></div>
              <div className="flex justify-between border-t border-ash-grey-200 pt-2">
                <span className="text-ash-grey-600 font-medium">Monthly surplus</span>
                <span className={`font-bold ${importPreview.surplus >= 0 ? 'text-soft-linen-700' : 'text-vibrant-coral-600'}`}>{fmt(importPreview.surplus)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 border border-ash-grey-300 text-ash-grey-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => { save(importPreview.data); setImportPreview(null) }} className="flex-1 bg-vibrant-coral-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-vibrant-coral-600">✓ Import & Replace</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main app shell ───────────────────────────────────────────────────
function AppShell({ token, isAdmin, logout, name }) {
  const { data, loading, saveStatus } = useBudget()
  const [tab, setTab] = useState('budget')

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-ash-grey-500">
      <div className="text-center"><img src="/logo.png" alt="" className="h-10 w-10 mx-auto mb-3" /><div className="text-sm">Loading...</div></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-tropical-teal-50">
      <header className="bg-ash-grey-800 border-b border-ash-grey-700 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white flex items-center gap-2"><img src="/logo.png" alt="" className="h-6 w-6" />{(() => { const n = data?.settings?.name || name; return n ? `${n.split(' ')[0]}'s Budget` : 'Budget' })()}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            saveStatus === 'saved'  ? 'bg-soft-linen-700 text-soft-linen-100' :
            saveStatus === 'saving' ? 'bg-lemon-chiffon-700 text-lemon-chiffon-100' :
                                      'bg-vibrant-coral-700 text-vibrant-coral-100'
          }`}>
            {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⏳ Saving…' : '⚠ Error'}
          </span>
        </div>
        <button onClick={logout} className="text-xs text-ash-grey-300 hover:text-white border border-ash-grey-600 px-3 py-1.5 rounded-lg hover:bg-ash-grey-700 transition-colors">
          Sign out
        </button>
      </header>

      {/* Sticky top bar: tabs + summary */}
      <div className="sticky top-[57px] z-30 bg-white shadow-sm">
        <TabBar active={tab} onChange={setTab} isAdmin={isAdmin} />
        {(tab === 'budget' || tab === 'charts') && <SummaryBar budget={data} />}
      </div>

      {tab === 'budget'   && <BudgetTab />}
      {tab === 'charts'   && <div className="max-w-5xl mx-auto px-4 py-6"><Charts budget={data} /></div>}
      {tab === 'forecast' && <ForecastCharts />}
      {tab === 'holidays' && <HolidayPlanner />}
      {tab === 'insights' && <Insights />}
      {tab === 'networth' && <NetWorthDashboard />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'users'    && isAdmin && <AdminPanel token={token} />}

      {!data?.settings?.onboardingComplete && (
        <OnboardingModal jwtName={name} />
      )}
    </div>
  )
}

export default function App() {
  const { token, user, isAdmin, login, logout } = useAuth()

  if (!token) return <LoginScreen onLogin={login} />

  return (
    <BudgetProvider token={token} onLogout={logout}>
      <AppShell token={token} isAdmin={isAdmin} logout={logout} name={user?.name} />
    </BudgetProvider>
  )
}

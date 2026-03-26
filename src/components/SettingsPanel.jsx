import { useState } from 'react'
import { useBudget } from '../context/BudgetContext'

function Field({ label, value, onChange, type = 'number', prefix, suffix, note }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
          className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-2 text-gray-400 text-sm">{suffix}</span>}
      </div>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

export default function SettingsPanel() {
  const { data, save, saveStatus } = useBudget()
  const [local, setLocal] = useState(data?.settings || {})
  const [goals, setGoals] = useState(data?.settings?.goals || [])
  const [dirty, setDirty] = useState(false)

  const set = (key, val) => { setLocal(s => ({ ...s, [key]: val })); setDirty(true) }
  const setGoal = (id, field, val) => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, [field]: field === 'target' || field === 'current' || field === 'monthly' ? parseFloat(val) || 0 : val } : g))
    setDirty(true)
  }
  const addGoal = () => {
    setGoals(gs => [...gs, { id: `g-${Date.now()}`, name: 'New Goal', target: 0, current: 0, monthly: 0, icon: '🎯' }])
    setDirty(true)
  }
  const deleteGoal = (id) => { setGoals(gs => gs.filter(g => g.id !== id)); setDirty(true) }

  const handleSave = () => {
    save({ ...data, settings: { ...local, goals } })
    setDirty(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">⚙️ Settings & Financial Assumptions</h2>
        <button onClick={handleSave} disabled={!dirty}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-default'}`}>
          {saveStatus === 'saving' ? 'Saving…' : dirty ? 'Save Changes' : 'Saved ✓'}
        </button>
      </div>

      <Section title="👤 Personal">
        <Field label="Your name" value={local.name} onChange={v => set('name', v)} type="text" />
        <Field label="Current age" value={local.currentAge} onChange={v => set('currentAge', v)} />
        <Field label="Target retirement age" value={local.retirementAge} onChange={v => set('retirementAge', v)} />
        <Field label="State pension age" value={local.statePensionAge} onChange={v => set('statePensionAge', v)} />
        <Field label="State pension (weekly)" value={local.statePensionWeekly} onChange={v => set('statePensionWeekly', v)} prefix="£" />
      </Section>

      <Section title="💰 Account Balances (update monthly)">
        <Field label="ISA balance" value={local.isaBalance} onChange={v => set('isaBalance', v)} prefix="£" note="Update each month after login" />
        <Field label="ISA monthly contribution" value={local.isaMonthlyContribution} onChange={v => set('isaMonthlyContribution', v)} prefix="£" />
        <Field label="Pension balance" value={local.pensionBalance} onChange={v => set('pensionBalance', v)} prefix="£" />
        <Field label="Pension monthly contribution" value={local.pensionMonthlyContribution} onChange={v => set('pensionMonthlyContribution', v)} prefix="£" note="Total incl. employer" />
        <Field label="Buffer / emergency fund" value={local.bufferBalance} onChange={v => set('bufferBalance', v)} prefix="£" />
      </Section>

      <Section title="🏠 Property & Mortgage">
        <Field label="Property value" value={local.propertyValue} onChange={v => set('propertyValue', v)} prefix="£" />
        <Field label="Mortgage balance" value={local.mortgageBalance} onChange={v => set('mortgageBalance', v)} prefix="£" />
        <Field label="Mortgage rate" value={local.mortgageRate} onChange={v => set('mortgageRate', v)} suffix="%" />
        <Field label="Monthly payment" value={local.mortgageMonthlyPayment} onChange={v => set('mortgageMonthlyPayment', v)} prefix="£" />
        <Field label="Fixed rate end date" value={local.mortgageEndDate} onChange={v => set('mortgageEndDate', v)} type="date" />
        <Field label="Rate after remortgage (estimate)" value={local.mortgageRateAfterRemortgage} onChange={v => set('mortgageRateAfterRemortgage', v)} suffix="%" />
      </Section>

      <Section title="📅 Known Future Events">
        <Field label="Van costs end date" value={local.vanCostsEndDate} onChange={v => set('vanCostsEndDate', v)} type="date" />
        <Field label="Van monthly cost (to free up)" value={local.vanCostMonthly} onChange={v => set('vanCostMonthly', v)} prefix="£" />
        <Field label="Pay rise date" value={local.expectedPayRiseDate} onChange={v => set('expectedPayRiseDate', v)} type="date" />
        <Field label="Pay rise amount (monthly)" value={local.expectedPayRiseMonthly} onChange={v => set('expectedPayRiseMonthly', v)} prefix="£" note="Net monthly take-home increase" />
      </Section>

      <Section title="📊 Forecast Assumptions">
        <Field label="Investment growth rate (real)" value={local.investmentGrowthRatePct} onChange={v => set('investmentGrowthRatePct', v)} suffix="%" note="After inflation. Default 5% is standard." />
        <Field label="Property growth rate (annual)" value={local.propertyGrowthRatePct} onChange={v => set('propertyGrowthRatePct', v)} suffix="%" />
        <Field label="Inflation assumption" value={local.inflationPct} onChange={v => set('inflationPct', v)} suffix="%" />
      </Section>

      {/* Goals */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">🎯 Savings Goals (for progress rings)</h3>
          <button onClick={addGoal} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg">+ Add goal</button>
        </div>
        <div className="space-y-3">
          {goals.map(g => (
            <div key={g.id} className="grid grid-cols-6 gap-2 items-end">
              <input value={g.icon} onChange={e => setGoal(g.id, 'icon', e.target.value)}
                className="border border-gray-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400 col-span-1" />
              <input value={g.name} onChange={e => setGoal(g.id, 'name', e.target.value)}
                className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 col-span-2" placeholder="Goal name" />
              <input type="number" value={g.target} onChange={e => setGoal(g.id, 'target', e.target.value)}
                className="border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Target £" />
              <input type="number" value={g.current} onChange={e => setGoal(g.id, 'current', e.target.value)}
                className="border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Current £" />
              <button onClick={() => deleteGoal(g.id)} className="text-red-400 hover:text-red-600 text-xs py-1.5">✕</button>
            </div>
          ))}
          {goals.length === 0 && <p className="text-xs text-gray-400">No goals yet — add some above</p>}
        </div>
        <p className="text-xs text-gray-400 mt-3">Icon · Name · Target · Current balance · (monthly auto-pulled from budget)</p>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={!dirty}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-default'}`}>
          {dirty ? 'Save All Settings' : 'All saved ✓'}
        </button>
      </div>
    </div>
  )
}

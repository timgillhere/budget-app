import { useState, useEffect } from 'react'
import { useBudget } from '../context/BudgetContext'

// Derive age from ISO date string (YYYY-MM-DD)
function ageFromDob(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// Numeric field — allows clearing, stores as number in parent, uses text display
function NumField({ label, value, onChange, prefix, suffix, note, pct }) {
  const [raw, setRaw] = useState(value == null || value === 0 ? '' : String(value))

  useEffect(() => {
    // Sync external value change only if not actively editing (raw is non-empty number)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed !== value) {
      setRaw(value == null ? '' : String(value))
    }
    if (raw === '' && value != null && value !== 0) {
      setRaw(String(value))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    // Allow: empty, digits, single decimal point, minus at start
    if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
      setRaw(v)
      const parsed = parseFloat(v)
      onChange(isNaN(parsed) ? 0 : parsed)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-2 text-slate-500 text-sm">{prefix}</span>}
        <input
          type="text"
          inputMode={pct ? 'decimal' : 'decimal'}
          value={raw}
          onChange={handleChange}
          className={`w-full rounded-lg py-2 text-sm text-slate-300 neon-input ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-2 text-slate-500 text-sm">{suffix}</span>}
      </div>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  )
}

// Currency field — formats with commas on blur, shows raw on focus
function CurrencyField({ label, value, onChange, note }) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState(value == null ? '' : String(value))

  useEffect(() => {
    if (!focused) {
      setRaw(value == null ? '' : String(value))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e) => {
    const v = e.target.value.replace(/,/g, '')
    if (v === '' || /^\d*\.?\d*$/.test(v)) {
      setRaw(v)
      const parsed = parseFloat(v)
      onChange(isNaN(parsed) ? 0 : parsed)
    }
  }

  const displayValue = focused
    ? raw
    : (value ? Number(value).toLocaleString('en-GB') : '')

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-slate-500 text-sm">£</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => { setFocused(true); setRaw(value == null ? '' : String(value)) }}
          onBlur={() => setFocused(false)}
          className="w-full rounded-lg py-2 text-sm text-slate-300 neon-input pl-7 pr-3"
        />
      </div>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  )
}

// Plain text / date field (no numeric handling needed)
function Field({ label, value, onChange, type = 'text', prefix, suffix, note }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-2 text-slate-500 text-sm">{prefix}</span>}
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className={`w-full rounded-lg py-2 text-sm text-slate-300 neon-input ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-2 text-slate-500 text-sm">{suffix}</span>}
      </div>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-nb-750 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

export default function SettingsPanel({ onStartOnboarding }) {
  const { data, save, saveStatus } = useBudget()
  const [local, setLocal] = useState(data?.settings || {})
  const [goals, setGoals] = useState(data?.settings?.goals || [])
  const [events, setEvents] = useState(data?.settings?.futureEvents || [])
  const [dirty, setDirty] = useState(false)

  const set = (key, val) => { setLocal(s => ({ ...s, [key]: val })); setDirty(true) }
  const setN = (key, val) => { setLocal(s => ({ ...s, [key]: val })); setDirty(true) }

  const handleDobChange = (dob) => {
    const age = ageFromDob(dob)
    setLocal(s => ({ ...s, dob, currentAge: age ?? s.currentAge }))
    setDirty(true)
  }

  const setGoal = (id, field, val) => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, [field]: field === 'target' || field === 'current' || field === 'monthly' ? parseFloat(val) || 0 : val } : g))
    setDirty(true)
  }
  const addGoal = () => {
    setGoals(gs => [...gs, { id: `g-${Date.now()}`, name: 'New Goal', target: 0, current: 0, monthly: 0, icon: '🎯' }])
    setDirty(true)
  }
  const deleteGoal = (id) => { setGoals(gs => gs.filter(g => g.id !== id)); setDirty(true) }

  const setEvent = (id, field, val) => {
    setEvents(evs => evs.map(e => e.id === id ? { ...e, [field]: field === 'monthlyImpact' ? parseFloat(val) || 0 : val } : e))
    setDirty(true)
  }
  const addEvent = () => {
    setEvents(evs => [...evs, { id: `evt-${Date.now()}`, label: '', date: '', monthlyImpact: 0, icon: '📅' }])
    setDirty(true)
  }
  const deleteEvent = (id) => { setEvents(evs => evs.filter(e => e.id !== id)); setDirty(true) }

  const handleSave = () => {
    save({ ...data, settings: { ...local, goals, futureEvents: events } })
    setDirty(false)
  }

  const computedAge = ageFromDob(local.dob)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-300">Settings & Financial Assumptions</h2>
        <button onClick={handleSave} disabled={!dirty}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dirty ? 'bg-neuro-600 hover:bg-neuro-500 text-white' : 'bg-nb-700 text-slate-500 cursor-default'}`}>
          {saveStatus === 'saving' ? 'Saving…' : dirty ? 'Save Changes' : 'Saved ✓'}
        </button>
      </div>

      <Section title="Personal">
        <Field label="Your name" value={local.name} onChange={v => set('name', v)} />
        <div>
          <Field label="Date of birth" value={local.dob} onChange={handleDobChange} type="date" />
          {computedAge != null && (
            <p className="text-xs text-slate-500 mt-0.5">Age: {computedAge}</p>
          )}
        </div>
        <NumField label="Target retirement age" value={local.retirementAge} onChange={v => setN('retirementAge', v)} />
        <NumField label="State pension age" value={local.statePensionAge} onChange={v => setN('statePensionAge', v)} />
        <CurrencyField label="State pension (weekly)" value={local.statePensionWeekly} onChange={v => setN('statePensionWeekly', v)} />
      </Section>

      <Section title="Account Balances (update monthly)">
        <CurrencyField label="ISA balance" value={local.isaBalance} onChange={v => setN('isaBalance', v)} note="Update each month after login" />
        <CurrencyField label="ISA monthly contribution" value={local.isaMonthlyContribution} onChange={v => setN('isaMonthlyContribution', v)} />
        <CurrencyField label="Pension balance" value={local.pensionBalance} onChange={v => setN('pensionBalance', v)} />
        <CurrencyField label="Pension monthly contribution" value={local.pensionMonthlyContribution} onChange={v => setN('pensionMonthlyContribution', v)} note="Total incl. employer" />
        <CurrencyField label="Buffer / emergency fund" value={local.bufferBalance} onChange={v => setN('bufferBalance', v)} />
      </Section>

      <Section title="Property & Mortgage">
        <CurrencyField label="Property value" value={local.propertyValue} onChange={v => setN('propertyValue', v)} />
        <CurrencyField label="Mortgage balance" value={local.mortgageBalance} onChange={v => setN('mortgageBalance', v)} />
        <NumField label="Mortgage rate" value={local.mortgageRate} onChange={v => setN('mortgageRate', v)} suffix="%" />
        <CurrencyField label="Monthly payment" value={local.mortgageMonthlyPayment} onChange={v => setN('mortgageMonthlyPayment', v)} />
        <Field label="Fixed rate end date" value={local.mortgageEndDate} onChange={v => set('mortgageEndDate', v)} type="date" />
        <NumField label="Rate after remortgage (estimate)" value={local.mortgageRateAfterRemortgage} onChange={v => setN('mortgageRateAfterRemortgage', v)} suffix="%" />
      </Section>

      {/* Known Future Events */}
      <div className="bg-nb-750 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-300">Known Future Events</h3>
          <button onClick={addEvent} className="text-xs text-neuro-400 hover:text-neuro-300 border border-nb-500 hover:border-nb-400 px-2 py-1 rounded-lg">+ Add event</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Events affecting your monthly surplus — expense endings, pay rises, etc. Positive = money freed/gained.</p>
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input value={ev.icon} onChange={e => setEvent(ev.id, 'icon', e.target.value)}
                  className="w-10 flex-shrink-0 bg-nb-800 border border-nb-600 rounded px-1 py-1.5 text-sm text-center text-slate-300 focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" />
                <input value={ev.label} onChange={e => setEvent(ev.id, 'label', e.target.value)}
                  className="flex-1 min-w-0 bg-nb-800 border border-nb-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" placeholder="Event name" />
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={ev.date} onChange={e => setEvent(ev.id, 'date', e.target.value)}
                  className="flex-1 sm:w-36 bg-nb-800 border border-nb-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" />
                <div className="relative w-28 flex-shrink-0">
                  <span className="absolute left-2 top-2 text-slate-500 text-sm">£</span>
                  <input type="number" value={ev.monthlyImpact} onChange={e => setEvent(ev.id, 'monthlyImpact', e.target.value)}
                    className="w-full bg-nb-800 border border-nb-600 rounded pl-6 pr-2 py-1.5 text-sm text-slate-300 text-right focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" placeholder="/mo" />
                </div>
                <button onClick={() => deleteEvent(ev.id)} className="text-red-500 hover:text-red-400 text-lg leading-none flex-shrink-0">✕</button>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-xs text-slate-500">No events yet — add some above</p>}
        </div>
        <p className="text-xs text-slate-600 mt-3">Icon · Event name · Date it takes effect · Monthly impact (£/mo, positive = money freed)</p>
      </div>

      <Section title="Forecast Assumptions">
        <NumField label="Savings rate target" value={local.savingsRateTarget ?? 10} onChange={v => setN('savingsRateTarget', v)} suffix="%" note="Used for gauge colour thresholds" />
        <NumField label="Investment growth rate (real)" value={local.investmentGrowthRatePct} onChange={v => setN('investmentGrowthRatePct', v)} suffix="%" note="After inflation. Default 5% is standard." />
        <NumField label="Property growth rate (annual)" value={local.propertyGrowthRatePct} onChange={v => setN('propertyGrowthRatePct', v)} suffix="%" />
        <NumField label="Inflation assumption" value={local.inflationPct} onChange={v => setN('inflationPct', v)} suffix="%" />
      </Section>

      {/* Goals */}
      <div className="bg-nb-750 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">Savings Goals</h3>
          <button onClick={addGoal} className="text-xs text-neuro-400 hover:text-neuro-300 border border-nb-500 hover:border-nb-400 px-2 py-1 rounded-lg">+ Add goal</button>
        </div>
        <div className="space-y-2">
          {goals.map(g => (
            <div key={g.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input value={g.icon} onChange={e => setGoal(g.id, 'icon', e.target.value)}
                className="w-10 flex-shrink-0 bg-nb-800 border border-nb-600 rounded px-1 py-1.5 text-sm text-center text-slate-300 focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" />
              <input value={g.name} onChange={e => setGoal(g.id, 'name', e.target.value)}
                className="flex-1 min-w-[8rem] bg-nb-800 border border-nb-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" placeholder="Goal name" />
              <input type="number" value={g.target} onChange={e => setGoal(g.id, 'target', e.target.value)}
                className="w-24 bg-nb-800 border border-nb-600 rounded px-2 py-1.5 text-sm text-slate-300 text-right focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" placeholder="Target £" />
              <input type="number" value={g.current} onChange={e => setGoal(g.id, 'current', e.target.value)}
                className="w-24 bg-nb-800 border border-nb-600 rounded px-2 py-1.5 text-sm text-slate-300 text-right focus:outline-none focus:border-neuro-500 focus:ring-1 focus:ring-neuro-500/40" placeholder="Current £" />
              <button onClick={() => deleteGoal(g.id)} className="text-red-500 hover:text-red-400 text-lg leading-none flex-shrink-0">✕</button>
            </div>
          ))}
          {goals.length === 0 && <p className="text-xs text-slate-500">No goals yet — add some above</p>}
        </div>
        <p className="text-xs text-slate-600 mt-3">Icon · Name · Target · Current balance · (monthly auto-pulled from budget)</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {onStartOnboarding && (
          <button onClick={onStartOnboarding}
            className="text-xs text-slate-500 hover:text-slate-300 border border-nb-600 px-4 py-2 rounded-lg hover:bg-nb-700 transition-colors">
            ↩ Re-run setup wizard
          </button>
        )}
        <button onClick={handleSave} disabled={!dirty}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${dirty ? 'bg-neuro-600 hover:bg-neuro-500 text-white' : 'bg-nb-700 text-slate-500 cursor-default'}`}>
          {dirty ? 'Save All Settings' : 'All saved ✓'}
        </button>
      </div>
    </div>
  )
}

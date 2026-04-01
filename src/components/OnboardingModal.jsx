import { useState } from 'react'
import { useBudget } from '../context/BudgetContext'
import { emptyBudget } from '../data/defaultBudget'
import { calcBudgetSummary } from '../utils/budgetCalcs'

// ─── Starter template groups ───────────────────────────────────────────────
function buildStarterTemplate() {
  return {
    sections: [
      {
        id: 'current', name: '💳 Current Account', color: '#C55A11', bgLight: '#FEF3C7',
        groups: [
          { id: 'tmpl-housing',  name: '🏠 Housing',        isSavings: false, items: [{ id: 'i-rent', name: 'Rent / Mortgage', monthly: 0, notes: '' }] },
          { id: 'tmpl-food',     name: '🛒 Food & Drink',   isSavings: false, items: [{ id: 'i-groceries', name: 'Groceries', monthly: 0, notes: '' }, { id: 'i-eating', name: 'Eating out', monthly: 0, notes: '' }] },
          { id: 'tmpl-transport',name: '🚗 Transport',      isSavings: false, items: [{ id: 'i-fuel', name: 'Fuel / Travel', monthly: 0, notes: '' }] },
          { id: 'tmpl-subs',     name: '📱 Subscriptions',  isSavings: false, items: [{ id: 'i-subs', name: 'Streaming & apps', monthly: 0, notes: '' }] },
          { id: 'tmpl-fun',      name: '🎉 Fun & Social',   isSavings: false, items: [{ id: 'i-fun', name: 'Social & hobbies', monthly: 0, notes: '' }] },
        ]
      },
      {
        id: 'starling', name: '⭐ Starling Spaces', color: '#2E75B6', bgLight: '#DBEAFE',
        groups: [
          { id: 'tmpl-emergency', name: '🛡️ Emergency Fund', isSavings: true,  items: [{ id: 'i-emrg', name: 'Emergency fund top-up', monthly: 0, notes: '' }] },
          { id: 'tmpl-holiday',   name: '✈️ Holiday Saving',  isSavings: true,  items: [{ id: 'i-hol',  name: 'Holiday fund', monthly: 0, notes: '' }] },
        ]
      },
      {
        id: 'monzo', name: '💜 Monzo Spaces', color: '#7030A0', bgLight: '#F3E8FF',
        groups: [
          { id: 'tmpl-goals', name: '🎯 Savings & Goals', isSavings: true, items: [{ id: 'i-goals', name: 'General savings', monthly: 0, notes: '' }] },
        ]
      }
    ]
  }
}

// ─── Tiny helpers ──────────────────────────────────────────────────────────
function ageFromDob(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function fmt(n) {
  if (!n) return '£0'
  return '£' + Number(n).toLocaleString('en-GB')
}

// ─── Shared input components ───────────────────────────────────────────────
function Label({ children }) {
  return <label className="block text-xs font-medium text-slate-500 mb-1">{children}</label>
}

function TextInput({ value, onChange, placeholder, type = 'text', prefix, suffix }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-2.5 text-slate-500 text-sm">{prefix}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-nb-600 rounded-lg py-2 text-sm bg-nb-900 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-neuro-500 ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
      />
      {suffix && <span className="absolute right-3 top-2.5 text-slate-500 text-sm">{suffix}</span>}
    </div>
  )
}

function NumInput({ value, onChange, prefix, suffix, placeholder }) {
  const [raw, setRaw] = useState(value == null || value === 0 ? '' : String(value))
  const handleChange = (v) => {
    const clean = v.replace(/,/g, '')
    if (clean === '' || /^\d*\.?\d*$/.test(clean)) {
      setRaw(clean)
      const parsed = parseFloat(clean)
      onChange(isNaN(parsed) ? 0 : parsed)
    }
  }
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-2.5 text-slate-500 text-sm">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder || '0'}
        className={`w-full border border-nb-600 rounded-lg py-2 text-sm bg-nb-900 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-neuro-500 ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
      />
      {suffix && <span className="absolute right-3 top-2.5 text-slate-500 text-sm">{suffix}</span>}
    </div>
  )
}

// ─── Step components ───────────────────────────────────────────────────────

function StepWelcome({ name }) {
  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-4">👋</div>
      <h2 className="text-2xl font-bold text-slate-100 mb-2">
        Welcome, {name}!
      </h2>
      <p className="text-slate-500 mb-4 text-sm leading-relaxed max-w-sm mx-auto">
        Let's set up your personal finance dashboard. We'll walk through your income, savings, and spending in just a few steps.
      </p>
      <div className="flex items-center justify-center gap-6 bg-nb-700 rounded-xl p-4 mb-2">
        <div className="text-center">
          <div className="text-lg font-bold text-neuro-400">~3 min</div>
          <div className="text-xs text-slate-500">to complete</div>
        </div>
        <div className="w-px h-8 bg-nb-600" />
        <div className="text-center">
          <div className="text-lg font-bold text-neuro-400">6 steps</div>
          <div className="text-xs text-slate-500">of setup</div>
        </div>
        <div className="w-px h-8 bg-nb-600" />
        <div className="text-center">
          <div className="text-lg font-bold text-neuro-400">100%</div>
          <div className="text-xs text-slate-500">private</div>
        </div>
      </div>
    </div>
  )
}

function StepAboutYou({ form, setForm }) {
  const age = ageFromDob(form.dob)
  return (
    <div className="space-y-4">
      <div>
        <Label>Your first name</Label>
        <TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Alex" />
      </div>
      <div>
        <Label>Date of birth</Label>
        <TextInput type="date" value={form.dob} onChange={v => setForm(f => ({ ...f, dob: v, currentAge: ageFromDob(v) ?? f.currentAge }))} />
        {age != null && <p className="text-xs text-neuro-400 mt-1">Age: {age}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Target retirement age</Label>
          <NumInput value={form.retirementAge} onChange={v => setForm(f => ({ ...f, retirementAge: v }))} />
        </div>
        <div>
          <Label>State pension age</Label>
          <NumInput value={form.statePensionAge} onChange={v => setForm(f => ({ ...f, statePensionAge: v }))} />
        </div>
      </div>
    </div>
  )
}

function StepIncome({ incomeItems, setIncomeItems }) {
  const addRow = () => setIncomeItems(rows => [...rows, { id: `inc-${Date.now()}`, name: '', monthly: 0 }])
  const update = (id, field, val) => setIncomeItems(rows => rows.map(r => r.id === id ? { ...r, [field]: field === 'monthly' ? (parseFloat(val) || 0) : val } : r))
  const remove = (id) => setIncomeItems(rows => rows.filter(r => r.id !== id))

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Enter your monthly take-home pay after tax. Add as many income sources as you have.</p>
      <div className="space-y-2">
        {incomeItems.map((row, i) => (
          <div key={row.id} className="flex gap-2 items-center">
            <div className="flex-1">
              {i === 0 && <Label>Source name</Label>}
              <TextInput value={row.name} onChange={v => update(row.id, 'name', v)} placeholder="e.g. Net salary" />
            </div>
            <div className="w-32">
              {i === 0 && <Label>Monthly (£)</Label>}
              <NumInput value={row.monthly} onChange={v => update(row.id, 'monthly', v)} prefix="£" placeholder="0" />
            </div>
            {incomeItems.length > 1 && (
              <button onClick={() => remove(row.id)} className={`text-slate-500 hover:text-red-400 text-lg transition-colors ${i === 0 ? 'mt-5' : ''}`}>✕</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addRow} className="text-sm text-neuro-400 hover:text-neuro-300 font-medium">
        + Add another income source
      </button>
    </div>
  )
}

function StepSavings({ form, setForm }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">These help calculate your true savings rate and forecast your future wealth.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>ISA balance</Label>
          <NumInput value={form.isaBalance} onChange={v => setForm(f => ({ ...f, isaBalance: v }))} prefix="£" />
        </div>
        <div>
          <Label>ISA monthly contribution</Label>
          <NumInput value={form.isaMonthlyContribution} onChange={v => setForm(f => ({ ...f, isaMonthlyContribution: v }))} prefix="£" />
        </div>
        <div>
          <Label>Pension balance</Label>
          <NumInput value={form.pensionBalance} onChange={v => setForm(f => ({ ...f, pensionBalance: v }))} prefix="£" />
        </div>
        <div>
          <Label>Pension monthly contribution</Label>
          <NumInput value={form.pensionMonthlyContribution} onChange={v => setForm(f => ({ ...f, pensionMonthlyContribution: v }))} prefix="£" />
          <p className="text-xs text-slate-500 mt-0.5">Include employer contributions</p>
        </div>
        <div>
          <Label>Emergency buffer / cash savings</Label>
          <NumInput value={form.bufferBalance} onChange={v => setForm(f => ({ ...f, bufferBalance: v }))} prefix="£" />
        </div>
        <div>
          <Label>Savings rate target</Label>
          <NumInput value={form.savingsRateTarget} onChange={v => setForm(f => ({ ...f, savingsRateTarget: v }))} suffix="%" />
          <p className="text-xs text-slate-500 mt-0.5">Goal % of gross income saved</p>
        </div>
      </div>
    </div>
  )
}

function StepProperty({ form, setForm }) {
  const hasProperty = !!form._hasProperty
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-nb-700 rounded-xl">
        <button
          onClick={() => setForm(f => ({ ...f, _hasProperty: !f._hasProperty }))}
          className={`relative w-10 h-6 rounded-full transition-colors ${hasProperty ? 'bg-neuro-600' : 'bg-nb-500'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${hasProperty ? 'left-5' : 'left-1'}`} />
        </button>
        <span className="text-sm font-medium text-slate-300">I own a property</span>
      </div>

      {hasProperty ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Property value</Label>
            <NumInput value={form.propertyValue} onChange={v => setForm(f => ({ ...f, propertyValue: v }))} prefix="£" />
          </div>
          <div>
            <Label>Mortgage balance outstanding</Label>
            <NumInput value={form.mortgageBalance} onChange={v => setForm(f => ({ ...f, mortgageBalance: v }))} prefix="£" />
          </div>
          <div>
            <Label>Monthly mortgage payment</Label>
            <NumInput value={form.mortgageMonthlyPayment} onChange={v => setForm(f => ({ ...f, mortgageMonthlyPayment: v }))} prefix="£" />
          </div>
          <div>
            <Label>Current interest rate</Label>
            <NumInput value={form.mortgageRate} onChange={v => setForm(f => ({ ...f, mortgageRate: v }))} suffix="%" />
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <div className="text-3xl mb-2">🏠</div>
          <p className="text-sm">No property details needed. You can always add these later in Settings.</p>
        </div>
      )}
    </div>
  )
}

function StepBudgetSetup({ choice, setChoice }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">How would you like to set up your spending categories?</p>
      <div className="space-y-3">
        <button
          onClick={() => setChoice('template')}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${choice === 'template' ? 'border-neuro-500 bg-neuro-500/10' : 'border-nb-600 hover:border-nb-500'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚀</span>
            <div>
              <div className="font-semibold text-slate-200 text-sm">Use a starter template</div>
              <div className="text-xs text-slate-500 mt-1">We'll create common spending categories (housing, food, transport, etc.) with £0 amounts. Fill in your actual costs afterwards.</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {['🏠 Housing', '🛒 Food', '🚗 Transport', '📱 Subs', '🎉 Social', '🛡️ Emergency', '✈️ Holidays'].map(t => (
                  <span key={t} className="text-xs bg-neuro-900/60 text-neuro-300 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setChoice('blank')}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${choice === 'blank' ? 'border-neuro-500 bg-neuro-500/10' : 'border-nb-600 hover:border-nb-500'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">✏️</span>
            <div>
              <div className="font-semibold text-slate-200 text-sm">Start blank</div>
              <div className="text-xs text-slate-500 mt-1">Create your own groups and categories from scratch in the Budget tab. Best if you have a specific structure in mind.</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

function StepDone({ summary }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-neuro-900/60 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-neuro-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-100 mb-2">You're all set!</h2>
      <p className="text-slate-500 text-sm mb-6">Your dashboard is ready. Here's a quick summary of what we've set up:</p>
      <div className="bg-nb-700 rounded-xl p-4 text-left space-y-2">
        {summary.map((line, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-neuro-400">✓</span>
            <span className="text-slate-300">{line}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4">You can change any of this at any time in the Settings tab.</p>
    </div>
  )
}

// ─── Step config ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 'welcome',  title: 'Welcome',              icon: '👋' },
  { id: 'about',    title: 'About You',             icon: '👤' },
  { id: 'income',   title: 'Monthly Income',        icon: '💰' },
  { id: 'savings',  title: 'Savings & Investments', icon: '📈' },
  { id: 'property', title: 'Property',              icon: '🏠' },
  { id: 'budget',   title: 'Budget Setup',          icon: '📊' },
  { id: 'done',     title: 'All Done',              icon: '🎉' },
]

// ─── Main component ────────────────────────────────────────────────────────
export default function OnboardingModal({ jwtName, onClose }) {
  const { data, save } = useBudget()

  const [step, setStep] = useState(0)

  // Form state
  const [form, setForm] = useState({
    name: jwtName || '',
    dob: '',
    currentAge: 30,
    retirementAge: 66,
    statePensionAge: 68,
    isaBalance: 0,
    isaMonthlyContribution: 0,
    pensionBalance: 0,
    pensionMonthlyContribution: 0,
    bufferBalance: 0,
    savingsRateTarget: 10,
    propertyValue: 0,
    mortgageBalance: 0,
    mortgageMonthlyPayment: 0,
    mortgageRate: 0,
    _hasProperty: false,
  })
  const [incomeItems, setIncomeItems] = useState([{ id: 'inc-1', name: 'Net monthly salary', monthly: 0 }])
  const [budgetChoice, setBudgetChoice] = useState('template')

  // Build the final budget and save
  const buildAndSave = (complete) => {
    const { _hasProperty, ...settingsRaw } = form
    const sections = budgetChoice === 'template'
      ? buildStarterTemplate().sections
      : (data?.sections || emptyBudget.sections)

    const newBudget = {
      ...emptyBudget,
      income: { items: incomeItems.filter(r => r.name.trim() || r.monthly > 0) },
      sections,
      settings: {
        ...emptyBudget.settings,
        ...settingsRaw,
        onboardingComplete: complete,
      },
      holidays: data?.holidays || emptyBudget.holidays,
      netWorth: data?.netWorth || emptyBudget.netWorth,
    }
    save(newBudget)
    if (onClose) onClose()
  }

  const handleSkip = () => buildAndSave(true)

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      buildAndSave(true)
    } else {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => setStep(s => s - 1)

  // Build summary for the Done step
  const totalIncome = incomeItems.reduce((s, r) => s + (r.monthly || 0), 0)
  const draftBudget = {
    income: { items: incomeItems },
    sections: emptyBudget.sections,
    settings: { ...form, onboardingComplete: false },
    holidays: emptyBudget.holidays,
    netWorth: emptyBudget.netWorth,
  }
  const { savingsRate } = calcBudgetSummary(draftBudget)

  const summary = [
    form.name ? `Name set to "${form.name}"` : null,
    totalIncome > 0 ? `Monthly income: ${fmt(totalIncome)}` : null,
    form.isaBalance > 0 || form.isaMonthlyContribution > 0
      ? `ISA: ${fmt(form.isaBalance)} balance · ${fmt(form.isaMonthlyContribution)}/mo contribution`
      : null,
    form.pensionBalance > 0 || form.pensionMonthlyContribution > 0
      ? `Pension: ${fmt(form.pensionBalance)} balance · ${fmt(form.pensionMonthlyContribution)}/mo contribution`
      : null,
    form._hasProperty && form.propertyValue > 0
      ? `Property: ${fmt(form.propertyValue)} · mortgage ${fmt(form.mortgageBalance)}`
      : null,
    `Budget categories: ${budgetChoice === 'template' ? 'starter template applied' : 'starting blank'}`,
    totalIncome > 0 ? `Estimated savings rate: ${savingsRate.toFixed(1)}%` : null,
  ].filter(Boolean)

  const isLastStep = step === STEPS.length - 1
  const isFirstStep = step === 0
  // Steps that show dot indicators (not welcome/done)
  const indicatorSteps = STEPS.slice(1, STEPS.length - 1)
  const indicatorIndex = step - 1 // 0-based within indicator steps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-nb-800 rounded-2xl shadow-2xl border border-nb-600 w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-nb-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {isFirstStep ? 'Getting started' : isLastStep ? 'Complete' : `Step ${step} of ${STEPS.length - 2}`}
            </span>
            {!isFirstStep && !isLastStep && (
              <button onClick={handleSkip} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Skip setup →
              </button>
            )}
          </div>

          {/* Step dot indicators */}
          {!isFirstStep && !isLastStep && (
            <div className="flex items-center gap-1.5 mb-4">
              {indicatorSteps.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i < indicatorIndex ? 'bg-neuro-500 w-6' :
                    i === indicatorIndex ? 'bg-neuro-400 w-8' :
                    'bg-nb-600 w-4'
                  }`}
                />
              ))}
            </div>
          )}

          {!isFirstStep && !isLastStep && (
            <div className="flex items-center gap-2">
              <span className="text-xl">{STEPS[step].icon}</span>
              <h2 className="text-lg font-bold text-slate-100">{STEPS[step].title}</h2>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && <StepWelcome name={form.name || jwtName} />}
          {step === 1 && <StepAboutYou form={form} setForm={setForm} />}
          {step === 2 && <StepIncome incomeItems={incomeItems} setIncomeItems={setIncomeItems} />}
          {step === 3 && <StepSavings form={form} setForm={setForm} />}
          {step === 4 && <StepProperty form={form} setForm={setForm} />}
          {step === 5 && <StepBudgetSetup choice={budgetChoice} setChoice={setBudgetChoice} />}
          {step === 6 && <StepDone summary={summary} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-nb-700 flex items-center justify-between gap-3">
          {!isFirstStep && !isLastStep ? (
            <button onClick={handleBack} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-nb-600 rounded-lg transition-colors">
              ← Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            {isFirstStep && (
              <button onClick={handleSkip} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Skip for now
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 text-sm font-medium bg-neuro-600 text-white rounded-lg hover:bg-neuro-500 transition-colors"
            >
              {isFirstStep ? "Let's go →" : isLastStep ? 'Launch dashboard →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useBudget } from '../context/BudgetContext'
import AccountSettings from './AccountSettings'
import DataSourcePanel from './DataSourcePanel'

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

const money = (n) => (n == null || n === '' ? '—' : `£${Number(n).toLocaleString('en-GB')}`)
const pct = (n) => (n == null || n === '' ? '—' : `${n}%`)
const date = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const text = (v) => (v == null || v === '' ? '—' : String(v))

function Item({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200 tabular-nums text-right">{value}</span>
    </div>
  )
}

function Section({ title, children, empty }) {
  return (
    <div className="bg-nb-750 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">{title}</h3>
      {children}
      {empty && <p className="text-xs text-slate-500">{empty}</p>}
    </div>
  )
}

export default function SettingsPanel() {
  const { data } = useBudget()
  const s = data?.settings || {}
  const goals = s.goals || []
  const events = s.futureEvents || []
  const pensions = s.pensions || []
  const age = ageFromDob(s.dob)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-300">Settings & Financial Assumptions</h2>
        <p className="text-xs text-slate-500 mt-0.5">Read-only — these values come from your Google Sheet.</p>
      </div>

      <Section title="Personal">
        <Item label="Name" value={text(s.name)} />
        <Item label="Date of birth" value={date(s.dob)} />
        {age != null && <Item label="Age" value={age} />}
        <Item label="Target retirement age" value={text(s.retirementAge)} />
        <Item label="State pension age" value={text(s.statePensionAge)} />
        <Item label="State pension (weekly)" value={money(s.statePensionWeekly)} />
      </Section>

      <Section title="Account Balances">
        <Item label="ISA balance" value={money(s.isaBalance)} />
        <Item label="ISA monthly contribution" value={money(s.isaMonthlyContribution)} />
        <Item label="Buffer / emergency fund" value={money(s.bufferBalance)} />
      </Section>

      <Section title="Pensions" empty={pensions.length === 0 ? 'No pensions.' : null}>
        {pensions.map(p => (
          <Item key={p.id} label={p.name || 'Pension'} value={`${money(p.balance)} · ${money(p.monthlyContribution)}/mo`} />
        ))}
      </Section>

      <Section title="Property & Mortgage">
        <Item label="Property value" value={money(s.propertyValue)} />
        <Item label="Mortgage balance" value={money(s.mortgageBalance)} />
        <Item label="Mortgage rate" value={pct(s.mortgageRate)} />
        <Item label="Monthly payment" value={money(s.mortgageMonthlyPayment)} />
        <Item label="Fixed rate end date" value={date(s.mortgageEndDate)} />
        <Item label="Rate after remortgage (estimate)" value={pct(s.mortgageRateAfterRemortgage)} />
      </Section>

      <Section title="Known Future Events" empty={events.length === 0 ? 'No events.' : null}>
        {events.map(ev => (
          <Item key={ev.id} label={`${ev.icon || '📅'} ${ev.label || 'Event'} · ${date(ev.date)}`}
            value={`${ev.monthlyImpact > 0 ? '+' : ''}${money(ev.monthlyImpact)}/mo`} />
        ))}
      </Section>

      <Section title="Forecast Assumptions">
        <Item label="Savings rate target" value={pct(s.savingsRateTarget ?? 10)} />
        <Item label="Investment growth rate (real)" value={pct(s.investmentGrowthRatePct)} />
        <Item label="Property growth rate (annual)" value={pct(s.propertyGrowthRatePct)} />
        <Item label="Inflation assumption" value={pct(s.inflationPct)} />
      </Section>

      <Section title="Savings Goals" empty={goals.length === 0 ? 'No goals.' : null}>
        {goals.map(g => (
          <Item key={g.id} label={`${g.icon || '🎯'} ${g.name}`} value={`${money(g.current)} of ${money(g.target)}`} />
        ))}
      </Section>

      <div className="border-t border-white/[0.06] pt-5">
        <h2 className="text-lg font-bold text-slate-300 mb-4">Where Your Data Lives</h2>
        <DataSourcePanel />
      </div>

      <div className="border-t border-white/[0.06] pt-5">
        <h2 className="text-lg font-bold text-slate-300 mb-4">Account Security</h2>
        <AccountSettings />
      </div>
    </div>
  )
}

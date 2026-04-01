import { useMemo } from 'react'
import { useBudget } from '../context/BudgetContext'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { calcBudgetSummary } from '../utils/budgetCalcs'

// ── UK market benchmarks (2026) ──────────────────────────────────────
const BENCHMARKS = {
  broadband: { label: 'Broadband', avg: 28, unit: '/month' },
  energy:    { label: 'Energy',    avg: 100, unit: '/month' },
  gym:       { label: 'Gym',       avg: 40, unit: '/month' },
}

const SUBSCRIPTION_KEYWORDS = ['spotify','netflix','disney','prime','icloud','apple','google','youtube','hulu','now tv','sky','bt','gym','ring','dropbox','adobe','notion','slack','github','cursor','chatgpt','claude']

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

// Closed-form compound growth: balance after n months at monthly rate r with monthly contrib c
function projectBalance(initial, monthlyContrib, annualGrowthPct, months) {
  const r = annualGrowthPct / 100 / 12
  if (r === 0) return initial + monthlyContrib * months
  return initial * Math.pow(1 + r, months) + monthlyContrib * (Math.pow(1 + r, months) - 1) / r
}

function findItem(data, keyword) {
  const results = []
  data.sections.forEach(sec => sec.groups.forEach(grp => grp.items.forEach(item => {
    if (item.name.toLowerCase().includes(keyword.toLowerCase())) results.push(item)
  })))
  return results
}

function GoalRing({ goal }) {
  const pct = Math.min(100, goal.target > 0 ? (goal.current / goal.target) * 100 : 0)
  const colour = pct >= 100 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#4f7ef7'
  const monthsLeft = goal.monthly > 0 ? Math.ceil((goal.target - goal.current) / goal.monthly) : null

  return (
    <div className="bg-nb-750 rounded-xl p-4 text-center">
      <ResponsiveContainer width="100%" height={90}>
        <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" barSize={10}
          data={[{ value: pct, fill: colour }, { value: 100 - pct, fill: '#1c2844' }]}
          startAngle={180} endAngle={0}>
          <RadialBar dataKey="value" cornerRadius={5} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-xl font-bold -mt-4" style={{ color: colour }}>{Math.round(pct)}%</div>
      <div className="text-xs font-semibold text-slate-300 mt-1">{goal.icon} {goal.name}</div>
      <div className="text-xs text-slate-400">£{goal.current.toLocaleString()} / £{goal.target.toLocaleString()}</div>
      {monthsLeft !== null && pct < 100 && (
        <div className="text-xs text-slate-500 mt-0.5">~{monthsLeft}m to go</div>
      )}
    </div>
  )
}

function InsightCard({ icon, title, body, colour = 'blue', action, progress }) {
  const colours = {
    blue:   'bg-neuro-900/30   border-neuro-700/50   text-neuro-300',
    green:  'bg-emerald-900/30 border-emerald-700/50 text-emerald-300',
    amber:  'bg-amber-900/30   border-amber-700/50   text-amber-300',
    red:    'bg-red-900/30     border-red-700/50     text-red-300',
    purple: 'bg-purple-900/30  border-purple-700/50  text-purple-300',
    gray:   'bg-nb-700         border-nb-600         text-slate-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${colours[colour]}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{body}</p>
          {progress != null && (
            <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-current transition-all" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
            </div>
          )}
          {action && <p className="text-xs mt-2 font-medium underline cursor-pointer">{action}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Upcoming changes timeline ─────────────────────────────────────────
function buildTimeline(settings) {
  const now = new Date()
  const events = [
    { date: new Date('2026-04-01'), label: 'Water bill rises + council tax resumes', icon: '💧', fixed: true },
  ]
  const futureEvents = settings.futureEvents || []
  futureEvents.forEach(ev => {
    if (!ev.date) return
    const impact = ev.monthlyImpact || 0
    const impactStr = impact !== 0 ? ` — ${impact > 0 ? '+' : ''}£${Math.abs(impact)}/mo ${impact > 0 ? 'freed' : 'added'}` : ''
    events.push({ date: new Date(ev.date), label: `${ev.label}${impactStr}`, icon: ev.icon || '📅' })
  })
  if (settings.mortgageEndDate) {
    events.push({ date: new Date(settings.mortgageEndDate), label: 'Mortgage fixed rate expires — start comparing 6 months out', icon: '🏠' })
  }
  if (settings.statePensionAge && settings.currentAge) {
    const yearsToSP = settings.statePensionAge - settings.currentAge
    const spDate = addMonths(now, yearsToSP * 12)
    const spMonthly = Math.round((settings.statePensionWeekly || 221.20) * 52 / 12)
    events.push({ date: spDate, label: `State pension starts (age ${settings.statePensionAge}) — ~£${spMonthly.toLocaleString('en-GB')}/mo`, icon: '🏛️' })
  }
  return events.sort((a, b) => a.date - b.date)
}

export default function Insights() {
  const { data } = useBudget()
  if (!data) return null

  const { surplus, totalIncome: income, totalExpenses: expenses, savingsRate } = calcBudgetSummary(data)
  const savingsRateTarget = data?.settings?.savingsRateTarget || 10
  const settings = data.settings || {}
  const goals = settings.goals || []
  const now = new Date()

  // ── "Next goal to complete" ──────────────────────────────────────
  const nextGoal = goals
    .filter(g => g.monthly > 0 && g.target > g.current)
    .map(g => ({ ...g, monthsLeft: Math.ceil((g.target - g.current) / g.monthly) }))
    .sort((a, b) => a.monthsLeft - b.monthsLeft)[0] || null

  // ── Generate insights ────────────────────────────────────────────
  const insights = useMemo(() => {
    const cards = []

    // 1. Savings rate vs personal target
    const t = savingsRateTarget
    if (savingsRate >= t * 1.5) cards.push({ icon: '🌟', title: 'Excellent savings rate', body: `${savingsRate.toFixed(1)}% savings rate — well above your ${t}% target. You're building wealth consistently.`, colour: 'green' })
    else if (savingsRate >= t) cards.push({ icon: '✅', title: 'Healthy savings rate', body: `${savingsRate.toFixed(1)}% savings rate — above your ${t}% target. On track.`, colour: 'green' })
    else if (savingsRate >= t * 0.5) cards.push({ icon: '🟡', title: 'Savings rate could improve', body: `${savingsRate.toFixed(1)}% savings rate. Your target is ${t}%+. Consider which expenses could reduce.`, colour: 'amber' })
    else cards.push({ icon: '⚠️', title: 'Low savings rate', body: `${savingsRate.toFixed(1)}% savings rate — well below your ${t}% target. Review your biggest expense categories.`, colour: 'red' })

    // 2. Savings rate vs 15-20% UK benchmark
    const sr20pct = Math.min(savingsRate / 20 * 100, 100)
    cards.push({
      icon: '📈',
      title: `Savings rate vs benchmark: ${savingsRate.toFixed(1)}% of gross income`,
      body: savingsRate >= 20
        ? `${savingsRate.toFixed(1)}% — above the recommended 15–20%. Excellent wealth-building pace.`
        : savingsRate >= 15
          ? `${savingsRate.toFixed(1)}% — within the recommended 15–20% range. On track.`
          : `${savingsRate.toFixed(1)}% — below the recommended 15–20% range. ${sr20pct.toFixed(0)}% of the way to 20%.`,
      colour: savingsRate >= 20 ? 'green' : savingsRate >= 15 ? 'blue' : 'amber',
      progress: sr20pct,
    })

    // 3. Surplus warning
    if (surplus < 100 && surplus >= 0) cards.push({ icon: '⚠️', title: 'Tight monthly surplus', body: `Only £${Math.round(surplus)} surplus this month. One unexpected expense could push you into deficit. Consider pausing a non-essential goal contribution temporarily.`, colour: 'amber' })
    else if (surplus < 0) cards.push({ icon: '🚨', title: 'Monthly deficit', body: `Expenses exceed income by £${Math.round(Math.abs(surplus))}/month. This needs addressing before it erodes your buffer.`, colour: 'red' })

    // 4. Broadband benchmark
    const broadband = findItem(data, 'broadband')[0]
    if (broadband && broadband.monthly > BENCHMARKS.broadband.avg * 1.3) {
      cards.push({ icon: '📡', title: 'Broadband above market rate', body: `You're paying £${broadband.monthly}/month. UK average is ~£${BENCHMARKS.broadband.avg}. Deals from £20/month available — check comparison sites.`, colour: 'amber', action: '→ Check deals on BroadbandChoices' })
    }

    // 5. Energy benchmark
    const energy = findItem(data, 'energy')[0]
    if (energy && energy.monthly > BENCHMARKS.energy.avg * 1.5) {
      cards.push({ icon: '⚡', title: 'Energy spend above average', body: `£${energy.monthly}/month on energy. UK average is ~£${BENCHMARKS.energy.avg}. Ensure you're on the best Octopus tariff.`, colour: 'amber' })
    }

    // 6. Subscriptions audit
    const subs = []
    data.sections.forEach(sec => sec.groups.forEach(grp => grp.items.forEach(item => {
      if (SUBSCRIPTION_KEYWORDS.some(k => item.name.toLowerCase().includes(k))) subs.push(item)
    })))
    if (subs.length > 0) {
      const subTotal = subs.reduce((s, i) => s + i.monthly, 0)
      cards.push({ icon: '📱', title: `${subs.length} subscriptions detected — £${subTotal.toFixed(2)}/month`, body: subs.map(s => `${s.name} £${s.monthly}`).join(' · '), colour: 'blue' })
    }

    // 7. Future events happening within the next 12 months
    const futureEvents = settings.futureEvents || []
    futureEvents.forEach(ev => {
      if (!ev.date) return
      const evDate = new Date(ev.date)
      const monthsAway = Math.round((evDate - now) / (1000 * 60 * 60 * 24 * 30))
      if (monthsAway >= 0 && monthsAway <= 12) {
        const impact = ev.monthlyImpact || 0
        cards.push({
          icon: ev.icon || '📅',
          title: `${ev.label} in ~${monthsAway} month${monthsAway !== 1 ? 's' : ''}`,
          body: impact > 0
            ? `£${impact}/month freed from ${evDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. Plan ahead: pension or ISA boost recommended.`
            : impact < 0
              ? `£${Math.abs(impact)}/month additional cost from ${evDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`
              : `Upcoming: ${evDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`,
          colour: monthsAway <= 2 ? 'green' : 'blue',
        })
      }
    })

    // 8. Remortgage alert — always visible while in future, colour by proximity
    const mortEnd = settings.mortgageEndDate ? new Date(settings.mortgageEndDate) : null
    if (mortEnd && mortEnd > now) {
      const monthsToRemort = Math.round((mortEnd - now) / (1000 * 60 * 60 * 24 * 30))
      const startComparingIn = Math.max(0, monthsToRemort - 6)
      cards.push({
        icon: '🏠',
        title: `Mortgage fixed rate ends in ${monthsToRemort} months`,
        body: `${mortEnd.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. ${startComparingIn > 0 ? `Start comparing deals in ~${startComparingIn} months.` : 'Start comparing now — 6 months out is optimal.'} Halifax, Nationwide, L&C broker all worth checking.`,
        colour: monthsToRemort <= 6 ? 'red' : monthsToRemort <= 9 ? 'amber' : 'blue',
      })
    }

    // 9. Goal close to complete
    goals.forEach(g => {
      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0
      if (pct >= 90 && pct < 100) {
        const amountLeft = (g.target - g.current).toLocaleString('en-GB')
        cards.push({
          icon: '🎯',
          title: `${g.icon} ${g.name} — only £${amountLeft} away!`,
          body: `${Math.round(pct)}% funded. At £${g.monthly}/month that's ${Math.ceil((g.target - g.current) / g.monthly)} more month${Math.ceil((g.target - g.current) / g.monthly) !== 1 ? 's' : ''}.`,
          colour: 'green',
          progress: pct,
        })
      }
    })

    // 10. ISA zero/low contributions
    const isaContrib = settings.isaMonthlyContribution || 0
    if (isaContrib < 50) {
      const retYears = (settings.retirementAge || 66) - (settings.currentAge || 38)
      const projAt100 = Math.round(projectBalance(settings.isaBalance || 0, 100, settings.investmentGrowthRatePct || 5, retYears * 12))
      cards.push({
        icon: '📊',
        title: `ISA allowance mostly unused (£${isaContrib}/mo)`,
        body: `Annual allowance is £20,000 — barely anything is going in. Even £100/mo compounds to ~£${(projAt100/1000).toFixed(0)}k over ${retYears} years. Consider directing some upcoming freed funds here.`,
        colour: 'amber',
      })
    }

    // 11. Buffer progress to £10k
    const bufferBalance = settings.bufferBalance || 0
    const bufferTarget = 10000
    const bufferTopUp = 40
    const bufferPct = Math.min(bufferBalance / bufferTarget * 100, 100)
    const monthsToBuffer = bufferBalance < bufferTarget
      ? Math.ceil((bufferTarget - bufferBalance) / bufferTopUp)
      : 0
    const bufferDateStr = monthsToBuffer > 0
      ? addMonths(now, monthsToBuffer).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : null
    cards.push({
      icon: '🛡️',
      title: `Emergency buffer: £${bufferBalance.toLocaleString('en-GB')} of £10,000 target`,
      body: bufferDateStr
        ? `${bufferPct.toFixed(0)}% of 3-month fund. At £${bufferTopUp}/month top-up, you reach £10k by ${bufferDateStr}.`
        : `Target reached! A full 3-month emergency fund is in place.`,
      colour: bufferPct >= 100 ? 'green' : bufferPct >= 60 ? 'blue' : 'amber',
      progress: bufferPct,
    })

    // 12. Multiple upcoming events that free up significant money
    const upcomingPositive = futureEvents.filter(ev => {
      if (!ev.date || (ev.monthlyImpact || 0) <= 0) return false
      const monthsAway = Math.round((new Date(ev.date) - now) / (1000 * 60 * 60 * 24 * 30))
      return monthsAway >= -6 && monthsAway <= 12
    })
    if (upcomingPositive.length >= 1) {
      const totalFreed = upcomingPositive.reduce((s, ev) => s + (ev.monthlyImpact || 0), 0)
      if (totalFreed >= 100) {
        const newISA = isaContrib + Math.round(totalFreed * 0.5)
        const mortgageOverpay = Math.round(totalFreed * 0.3)
        const evLabels = upcomingPositive.map(ev => `${ev.label} (£${ev.monthlyImpact}/mo)`).join(' + ')
        cards.push({
          icon: '🚀',
          title: `Upcoming windfall: ~£${totalFreed}/month newly available`,
          body: `${evLabels} = £${totalFreed}/mo freed up. Options: (1) Boost ISA to £${newISA}/mo, (2) Overpay mortgage £${mortgageOverpay}/mo, (3) Split ISA + pension top-up. Worth deciding now before lifestyle creep sets in.`,
          colour: 'green',
        })
      }
    }

    // 13. Retirement gap
    const retYears = ((settings.retirementAge || 66) - (settings.currentAge || 38))
    const retMonths = retYears * 12
    const growthRate = settings.investmentGrowthRatePct || 5
    const projISA = projectBalance(settings.isaBalance || 0, isaContrib, growthRate, retMonths)
    const projPension = projectBalance(settings.pensionBalance || 0, settings.pensionMonthlyContribution || 0, growthRate, retMonths)
    const statePensionAnnual = (settings.statePensionWeekly || 221.20) * 52
    const isaDrawAnnual = projISA * 0.04
    const penDrawAnnual = projPension * 0.04
    const totalRetIncome = Math.round(statePensionAnnual + isaDrawAnnual + penDrawAnnual)
    const retTarget = 60000
    const retGap = Math.max(0, retTarget - totalRetIncome)
    if (retGap > 5000) {
      cards.push({
        icon: '⚠️',
        title: `Retirement income gap: ~£${Math.round(retGap / 1000)}k/yr shortfall`,
        body: `Projected at ${settings.retirementAge || 66}: state pension £${Math.round(statePensionAnnual / 1000)}k + ISA drawdown £${Math.round(isaDrawAnnual / 1000)}k + pension £${Math.round(penDrawAnnual / 1000)}k = ~£${Math.round(totalRetIncome / 1000)}k/yr vs £${retTarget / 1000}k target. An extra £${Math.round(retGap / 12 / retYears)}/mo to pension now closes the gap.`,
        colour: 'amber',
      })
    } else if (retGap === 0) {
      cards.push({
        icon: '🎉',
        title: `Retirement income: on track for £${retTarget / 1000}k+ target`,
        body: `Projected ~£${Math.round(totalRetIncome / 1000)}k/yr at ${settings.retirementAge || 66} from state pension, ISA, and pension drawdown combined.`,
        colour: 'green',
      })
    }

    return cards
  }, [data, surplus, savingsRate, settings, goals, now])

  // ── Phase 2 placeholder cards ────────────────────────────────────
  const phase2 = [
    { icon: '🏦', title: 'Transaction analysis', body: 'Connect your bank to see spending trends, merchant breakdowns, and "spent 20% more on X" insights.' },
    { icon: '📊', title: 'Cash-flow danger days', body: 'Link your account to see which days of the month your balance is lowest.' },
    { icon: '🛒', title: 'Merchant intelligence', body: 'Tesco, Deliveroo, Amazon averages and trends — needs transaction feed.' },
  ]

  const timeline = buildTimeline(settings)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Goal progress rings */}
      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Goal Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {goals.map(g => <GoalRing key={g.id} goal={g} />)}
          </div>
        </div>
      )}

      {/* Next goal to complete */}
      {nextGoal && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Next Goal</h2>
          <InsightCard
            icon={nextGoal.icon}
            title={`${nextGoal.name} — ${nextGoal.monthsLeft} month${nextGoal.monthsLeft !== 1 ? 's' : ''} away`}
            body={`£${nextGoal.current.toLocaleString('en-GB')} of £${nextGoal.target.toLocaleString('en-GB')} saved. Saving £${nextGoal.monthly}/month. ${Math.round(nextGoal.current / nextGoal.target * 100)}% there.`}
            colour="green"
            progress={Math.round(nextGoal.current / nextGoal.target * 100)}
          />
        </div>
      )}

      {/* Live insights */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Smart Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </div>

      {/* Upcoming changes timeline */}
      {timeline.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Upcoming Changes</h2>
          <div className="bg-nb-750 rounded-xl p-5">
            <div className="relative pl-5">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-nb-600" />
              <div className="space-y-3">
                {timeline.map((ev, i) => {
                  const isPast = ev.date < now
                  const monthsAway = Math.round((ev.date - now) / (1000 * 60 * 60 * 24 * 30))
                  const dotColour = isPast
                    ? 'border-nb-600 bg-nb-700'
                    : monthsAway <= 1
                      ? 'border-emerald-500 bg-emerald-900/50'
                      : monthsAway <= 4
                        ? 'border-amber-500 bg-amber-900/50'
                        : 'border-neuro-500 bg-neuro-900/50'
                  return (
                    <div key={i} className={`flex gap-3 items-start ${isPast ? 'opacity-40' : ''}`}>
                      <div className={`relative z-10 w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2 ${dotColour}`} />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-slate-300">{ev.icon} {ev.label}</span>
                          <span className="text-xs text-slate-500 flex-shrink-0">
                            {isPast ? 'Past' : monthsAway === 0 ? 'This month' : `${monthsAway}mo`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {ev.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Coming soon — requires bank connection</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {phase2.map((p, i) => <InsightCard key={i} {...p} colour="gray" />)}
        </div>
      </div>
    </div>
  )
}

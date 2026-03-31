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

function calcSurplus(data) {
  const inc = data.income.items.reduce((s, i) => s + i.monthly, 0)
  const exp = data.sections.reduce((s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.monthly, 0), 0), 0)
  return { surplus: inc - exp, income: inc, expenses: exp }
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
  const colour = pct >= 100 ? '#70AD47' : pct >= 60 ? '#FFC000' : '#2E75B6'
  const monthsLeft = goal.monthly > 0 ? Math.ceil((goal.target - goal.current) / goal.monthly) : null

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-4 text-center">
      <ResponsiveContainer width="100%" height={90}>
        <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" barSize={10}
          data={[{ value: pct, fill: colour }, { value: 100 - pct, fill: '#F3F4F6' }]}
          startAngle={180} endAngle={0}>
          <RadialBar dataKey="value" cornerRadius={5} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-xl font-bold -mt-4" style={{ color: colour }}>{Math.round(pct)}%</div>
      <div className="text-xs font-semibold text-ash-grey-700 mt-1">{goal.icon} {goal.name}</div>
      <div className="text-xs text-ash-grey-500">£{goal.current.toLocaleString()} / £{goal.target.toLocaleString()}</div>
      {monthsLeft !== null && pct < 100 && (
        <div className="text-xs text-ash-grey-400 mt-0.5">~{monthsLeft}m to go</div>
      )}
    </div>
  )
}

function InsightCard({ icon, title, body, colour = 'blue', action }) {
  const colours = {
    blue:   'bg-tropical-teal-50   border-tropical-teal-200  text-tropical-teal-700',
    green:  'bg-soft-linen-50  border-soft-linen-200 text-soft-linen-700',
    amber:  'bg-lemon-chiffon-100  border-lemon-chiffon-200 text-lemon-chiffon-700',
    red:    'bg-vibrant-coral-50    border-vibrant-coral-200   text-vibrant-coral-700',
    purple: 'bg-tropical-teal-50 border-tropical-teal-200 text-tropical-teal-700',
    gray:   'bg-ash-grey-50   border-ash-grey-200  text-ash-grey-500',
  }
  return (
    <div className={`rounded-xl border p-4 ${colours[colour]}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{body}</p>
          {action && <p className="text-xs mt-2 font-medium underline cursor-pointer">{action}</p>}
        </div>
      </div>
    </div>
  )
}

export default function Insights() {
  const { data } = useBudget()
  if (!data) return null

  const { surplus, totalIncome: income, totalExpenses: expenses, savingsRate } = calcBudgetSummary(data)
  const savingsRateTarget = data?.settings?.savingsRateTarget || 10
  const settings = data.settings || {}
  const goals = settings.goals || []

  // ── Generate insights ────────────────────────────────────────────
  const insights = useMemo(() => {
    const cards = []

    // 1. Savings rate
    const t = savingsRateTarget
    if (savingsRate >= t * 1.5) cards.push({ icon: '🌟', title: 'Excellent savings rate', body: `${savingsRate.toFixed(1)}% savings rate — well above your ${t}% target. You're building wealth consistently.`, colour: 'green' })
    else if (savingsRate >= t) cards.push({ icon: '✅', title: 'Healthy savings rate', body: `${savingsRate.toFixed(1)}% savings rate — above your ${t}% target. On track.`, colour: 'green' })
    else if (savingsRate >= t * 0.5) cards.push({ icon: '🟡', title: 'Savings rate could improve', body: `${savingsRate.toFixed(1)}% savings rate. Your target is ${t}%+. Consider which expenses could reduce.`, colour: 'amber' })
    else cards.push({ icon: '⚠️', title: 'Low savings rate', body: `${savingsRate.toFixed(1)}% savings rate — well below your ${t}% target. Review your biggest expense categories.`, colour: 'red' })

    // 2. Surplus warning
    if (surplus < 100 && surplus >= 0) cards.push({ icon: '⚠️', title: 'Tight monthly surplus', body: `Only £${Math.round(surplus)} surplus this month. One unexpected expense could push you into deficit. Consider pausing a non-essential goal contribution temporarily.`, colour: 'amber' })
    else if (surplus < 0) cards.push({ icon: '🚨', title: 'Monthly deficit', body: `Expenses exceed income by £${Math.round(Math.abs(surplus))}/month. This needs addressing before it erodes your buffer.`, colour: 'red' })

    // 3. Broadband benchmark
    const broadband = findItem(data, 'broadband')[0]
    if (broadband && broadband.monthly > BENCHMARKS.broadband.avg * 1.3) {
      cards.push({ icon: '📡', title: 'Broadband above market rate', body: `You're paying £${broadband.monthly}/month. UK average is ~£${BENCHMARKS.broadband.avg}. Deals from £20/month available — check comparison sites.`, colour: 'amber', action: '→ Check deals on BroadbandChoices' })
    }

    // 4. Energy benchmark
    const energy = findItem(data, 'energy')[0]
    if (energy && energy.monthly > BENCHMARKS.energy.avg * 1.5) {
      cards.push({ icon: '⚡', title: 'Energy spend above average', body: `£${energy.monthly}/month on energy. UK average is ~£${BENCHMARKS.energy.avg}. Ensure you're on the best Octopus tariff.`, colour: 'amber' })
    }

    // 5. Subscriptions audit
    const subs = []
    data.sections.forEach(sec => sec.groups.forEach(grp => grp.items.forEach(item => {
      if (SUBSCRIPTION_KEYWORDS.some(k => item.name.toLowerCase().includes(k))) subs.push(item)
    })))
    if (subs.length > 0) {
      const subTotal = subs.reduce((s, i) => s + i.monthly, 0)
      cards.push({ icon: '📱', title: `${subs.length} subscriptions detected — £${subTotal.toFixed(2)}/month`, body: subs.map(s => `${s.name} £${s.monthly}`).join(' · '), colour: 'blue' })
    }

    // 6. Van costs ending
    const vanEnd = settings.vanCostsEndDate ? new Date(settings.vanCostsEndDate) : null
    const now = new Date()
    if (vanEnd) {
      const monthsToVanEnd = Math.round((vanEnd - now) / (1000 * 60 * 60 * 24 * 30))
      if (monthsToVanEnd >= 0 && monthsToVanEnd <= 4) {
        cards.push({ icon: '🚐', title: `Van costs ending in ~${monthsToVanEnd} month${monthsToVanEnd !== 1 ? 's' : ''}`, body: `£${settings.vanCostMonthly}/month will free up from ${vanEnd.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. Have a plan ready for where this goes — pension or ISA boost recommended.`, colour: 'green' })
      }
    }

    // 7. Remortgage alert
    const mortEnd = settings.mortgageEndDate ? new Date(settings.mortgageEndDate) : null
    if (mortEnd) {
      const monthsToRemort = Math.round((mortEnd - now) / (1000 * 60 * 60 * 24 * 30))
      if (monthsToRemort <= 9 && monthsToRemort > 0) {
        cards.push({ icon: '🏠', title: `Remortgage in ${monthsToRemort} months`, body: `Your fixed rate ends ${mortEnd.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. Start comparing deals 6 months out — Halifax, Nationwide, and brokers like L&C all worth checking.`, colour: 'amber' })
      }
    }

    // 8. Goal close to complete
    goals.forEach(g => {
      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0
      if (pct >= 90 && pct < 100) {
        cards.push({ icon: '🎯', title: `${g.icon} ${g.name} almost funded`, body: `${Math.round(pct)}% there — only £${(g.target - g.current).toLocaleString('en-GB')} to go. At £${g.monthly}/month that's ${Math.ceil((g.target - g.current) / g.monthly)} more months.`, colour: 'green' })
      }
    })

    return cards
  }, [data, surplus, savingsRate, settings, goals])

  // ── Phase 2 placeholder cards ────────────────────────────────────
  const phase2 = [
    { icon: '🏦', title: 'Transaction analysis', body: 'Connect your bank to see spending trends, merchant breakdowns, and "spent 20% more on X" insights.' },
    { icon: '📊', title: 'Cash-flow danger days', body: 'Link your account to see which days of the month your balance is lowest.' },
    { icon: '🛒', title: 'Merchant intelligence', body: 'Tesco, Deliveroo, Amazon averages and trends — needs transaction feed.' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Goal progress rings */}
      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ash-grey-600 mb-3">🎯 Goal Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {goals.map(g => <GoalRing key={g.id} goal={g} />)}
          </div>
        </div>
      )}

      {/* Live insights */}
      <div>
        <h2 className="text-sm font-semibold text-ash-grey-600 mb-3">💡 Smart Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </div>

      {/* Phase 2 */}
      <div>
        <h2 className="text-sm font-semibold text-ash-grey-400 mb-3">🔒 Coming soon — requires bank connection</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {phase2.map((p, i) => <InsightCard key={i} {...p} colour="gray" />)}
        </div>
      </div>
    </div>
  )
}

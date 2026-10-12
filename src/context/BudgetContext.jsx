import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { emptyBudget } from '../data/defaultBudget'

const BudgetContext = createContext(null)

export function BudgetProvider({ children, onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Only 401 means "not signed in". A 403 means the account is signed in but has no sheet
  // behind it, and a 5xx means the sheet itself is unreachable — both used to be treated as a
  // logout, or as an empty budget, which made a broken data source look like a brand-new account.
  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const r = await fetch('/api/budget', { credentials: 'include', signal: controller.signal })
        if (r.status === 401) { onLogout(); return }
        if (!r.ok) {
          const body = await r.json().catch(() => null)
          setError(body?.error || `Couldn't load your budget (${r.status}).`)
          setLoading(false)
          return
        }
        const raw = await r.json()
        setData(raw ? mergeWithDefaults(raw) : emptyBudget)
        setLoading(false)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError("Couldn't reach the server to load your budget.")
        setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  // One-time migration: add savingsType where only legacy isSavings boolean exists
  function migrateSavingsTypes(budget) {
    const ANNUAL_IDS = ['monzo-van', 'monzo-prop', 'monzo-inst']
    budget.sections.forEach(sec => {
      sec.groups.forEach(g => {
        if (!g.savingsType) {
          if (ANNUAL_IDS.includes(g.id)) g.savingsType = 'annual'
          else if (g.isSavings === true)  g.savingsType = 'longterm'
        }
        g.items.forEach(item => {
          if (!item.savingsType && item.isSavings === true) item.savingsType = 'longterm'
        })
      })
    })

    // Migrate legacy single pension fields to pensions array
    const s = budget.settings || {}
    if (!s.pensions) {
      if (s.pensionBalance || s.pensionMonthlyContribution) {
        s.pensions = [{
          id: 'pension-legacy',
          name: 'Pension',
          balance: s.pensionBalance || 0,
          monthlyContribution: s.pensionMonthlyContribution || 0,
        }]
      } else {
        s.pensions = []
      }
    }

    return budget
  }

  // Merge saved JSON with default structure so new keys always exist
  function mergeWithDefaults(saved) {
    const { vanCostsEndDate, vanCostMonthly, expectedPayRiseDate, expectedPayRiseMonthly, ...restSettings } = saved.settings || {}

    // Migrate old van/pay rise fields → futureEvents array
    let futureEvents = restSettings.futureEvents
    if (!futureEvents) {
      futureEvents = []
      if (vanCostsEndDate) futureEvents.push({ id: 'evt-van', label: 'Van costs end', date: vanCostsEndDate, monthlyImpact: vanCostMonthly || 0, icon: '🚐' })
      if (expectedPayRiseDate) futureEvents.push({ id: 'evt-payrise', label: 'Pay rise', date: expectedPayRiseDate, monthlyImpact: expectedPayRiseMonthly || 0, icon: '💰' })
    }

    // If onboardingComplete was never set but real data exists, treat onboarding as done
    const hasData = (saved.income?.items?.length > 0)
    const onboardingComplete = restSettings.onboardingComplete !== undefined
      ? restSettings.onboardingComplete
      : hasData

    return migrateSavingsTypes({
      ...emptyBudget,
      ...saved,
      settings: { ...emptyBudget.settings, ...restSettings, futureEvents, onboardingComplete },
      holidays: saved.holidays || emptyBudget.holidays,
      netWorth: { ...emptyBudget.netWorth, ...(saved.netWorth || {}) }
    })
  }

  // Helper: find the holiday monthly contribution from budget line items
  const getHolidayContribution = useCallback(() => {
    if (!data) return 0
    for (const section of data.sections) {
      for (const group of section.groups) {
        for (const item of group.items) {
          if (item.name.toLowerCase().includes('holiday') || item.name.toLowerCase().includes('holidays')) {
            return item.monthly
          }
        }
      }
    }
    return 0
  }, [data])

  return (
    <BudgetContext.Provider value={{ data, loading, error, getHolidayContribution }}>
      {children}
    </BudgetContext.Provider>
  )
}

export const useBudget = () => {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget must be inside BudgetProvider')
  return ctx
}

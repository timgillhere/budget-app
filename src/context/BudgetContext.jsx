import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { defaultBudget, emptyBudget } from '../data/defaultBudget'

const BudgetContext = createContext(null)

export function BudgetProvider({ children, onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/budget', { credentials: 'include', signal: controller.signal })
      .then(r => {
        if (r.status === 401 || r.status === 403) { onLogout(); return }
        return r.json().then(raw => {
          const merged = raw ? mergeWithDefaults(raw) : emptyBudget
          setData(merged)
          setLoading(false)
        })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setData(emptyBudget); setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const save = useCallback(async (updated) => {
    setData(updated)
    setSaveStatus('saving')
    try {
      const r = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updated)
      })
      if (r.status === 401 || r.status === 403) { onLogout(); return }
      if (!r.ok) { setSaveStatus('error'); return }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
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
      ...defaultBudget,
      ...saved,
      settings: { ...emptyBudget.settings, ...restSettings, futureEvents, onboardingComplete },
      holidays: saved.holidays || defaultBudget.holidays,
      netWorth: { ...defaultBudget.netWorth, ...(saved.netWorth || {}) }
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
    <BudgetContext.Provider value={{ data, save, loading, saveStatus, getHolidayContribution }}>
      {children}
    </BudgetContext.Provider>
  )
}

export const useBudget = () => {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget must be inside BudgetProvider')
  return ctx
}

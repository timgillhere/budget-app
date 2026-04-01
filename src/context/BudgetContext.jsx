import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { defaultBudget, emptyBudget } from '../data/defaultBudget'

const BudgetContext = createContext(null)

export function BudgetProvider({ children, token, onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved')

  useEffect(() => {
    fetch('/api/budget', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { onLogout(); return }
        return r.json().then(raw => {
          const merged = raw ? mergeWithDefaults(raw) : emptyBudget
          setData(merged)
          setLoading(false)
        })
      })
      .catch(() => { setData(emptyBudget); setLoading(false) })
  }, [token])

  const save = useCallback(async (updated) => {
    setData(updated)
    setSaveStatus('saving')
    try {
      const r = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated)
      })
      if (r.status === 401) { onLogout(); return }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [token])

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

    return {
      ...defaultBudget,
      ...saved,
      settings: { ...emptyBudget.settings, ...restSettings, futureEvents },
      holidays: saved.holidays || defaultBudget.holidays,
      netWorth: { ...defaultBudget.netWorth, ...(saved.netWorth || {}) }
    }
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

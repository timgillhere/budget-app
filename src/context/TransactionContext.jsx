import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const TransactionContext = createContext(null)

function currentYearMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function TransactionProvider({ children, onLogout }) {
  const [transactions, setTransactions] = useState(null) // null = not loaded yet
  const [meta, setMeta] = useState(null)                 // { importedAt, source } from the loaded month doc
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeMonth, setActiveMonthState] = useState(currentYearMonth)

  const loadMonth = useCallback(async (yearMonth) => {
    setLoading(true)
    setTransactions(null)
    setError(null)
    try {
      const r = await fetch(`/api/transactions?month=${yearMonth}`, { credentials: 'include' })
      // Only 401 is a dead session. A 403 (no data store) or 5xx (sheet unreachable) has to be
      // shown — otherwise it renders as "no transactions for this month", which isn't true.
      if (r.status === 401) { onLogout(); return }
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        setError(body?.error || `Couldn't load transactions (${r.status}).`)
        return
      }
      const data = await r.json()
      setTransactions(data ? (data.transactions ?? []) : null)
      setMeta(data ? { importedAt: data.importedAt ?? null, source: data.source ?? null } : null)
    } catch {
      setTransactions(null)
      setMeta(null)
      setError("Couldn't reach the server to load transactions.")
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  const setActiveMonth = useCallback((yearMonth) => {
    setActiveMonthState(yearMonth)
    loadMonth(yearMonth)
  }, [loadMonth])

  useEffect(() => {
    loadMonth(activeMonth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TransactionContext.Provider value={{ transactions, meta, loading, error, activeMonth, setActiveMonth }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const ctx = useContext(TransactionContext)
  if (!ctx) throw new Error('useTransactions must be used inside TransactionProvider')
  return ctx
}

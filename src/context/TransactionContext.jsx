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
  const [saveStatus, setSaveStatus] = useState('saved')
  const [activeMonth, setActiveMonthState] = useState(currentYearMonth)

  const loadMonth = useCallback(async (yearMonth) => {
    setLoading(true)
    setTransactions(null)
    try {
      const r = await fetch(`/api/transactions?month=${yearMonth}`, { credentials: 'include' })
      if (r.status === 401 || r.status === 403) { onLogout(); return }
      if (!r.ok) { setLoading(false); return }
      const data = await r.json()
      setTransactions(data ? (data.transactions ?? []) : null)
      setMeta(data ? { importedAt: data.importedAt ?? null, source: data.source ?? null } : null)
    } catch {
      setTransactions(null)
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  const setActiveMonth = useCallback((yearMonth) => {
    setActiveMonthState(yearMonth)
    loadMonth(yearMonth)
  }, [loadMonth])

  const saveTransactions = useCallback(async (yearMonth, txns) => {
    setSaveStatus('saving')
    try {
      const payload = {
        month: yearMonth,
        importedAt: new Date().toISOString(),
        transactions: txns,
      }
      const r = await fetch(`/api/transactions?month=${yearMonth}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (r.status === 401 || r.status === 403) { onLogout(); return }
      if (!r.ok) { setSaveStatus('error'); return }
      setTransactions(txns)
      setMeta({ importedAt: payload.importedAt, source: null })
      setActiveMonthState(yearMonth)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [onLogout])

  useEffect(() => {
    loadMonth(activeMonth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TransactionContext.Provider value={{ transactions, meta, loading, saveStatus, activeMonth, setActiveMonth, saveTransactions }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const ctx = useContext(TransactionContext)
  if (!ctx) throw new Error('useTransactions must be used inside TransactionProvider')
  return ctx
}

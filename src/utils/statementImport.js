// Orchestrates a parsed statement into import-ready transactions: corrections → merchant rules → local LLM.
import { applyMerchantRules } from '../data/merchantRules.js'
import { fingerprint } from './transactionFingerprint.js'
import { categorise as ollamaCategorise } from './ollamaClient.js'

const round2 = n => Math.round(n * 100) / 100

function hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// Checks opening + rows = closing, and every end-of-day balance checkpoint, to pinpoint missed/misread rows.
export function reconcile(openingBalance, rows, closingBalance) {
  if (openingBalance == null || closingBalance == null) return { ok: null, diff: null, firstMismatch: null }
  let running = openingBalance
  let firstMismatch = null
  for (let i = 0; i < rows.length; i++) {
    running = round2(running + rows[i].amount)
    if (firstMismatch === null && rows[i].balance != null && Math.abs(running - rows[i].balance) > 0.005) {
      firstMismatch = { index: i, date: rows[i].date, expected: rows[i].balance, actual: running }
    }
  }
  const diff = round2(closingBalance - running)
  return { ok: Math.abs(diff) < 0.005 && firstMismatch === null, diff, firstMismatch }
}

// parsed: result of extractRows(). Returns { transactions, stats }.
export async function categoriseStatement(parsed, { account, customRules = [], corrections = [], categoriser = ollamaCategorise, onProgress, signal }) {
  const byDescription = new Map(corrections.map(c => [c.description, c.to]))
  const seen = new Map()
  const transactions = parsed.rows.map(r => {
    const base = { date: r.date, description: r.description, amount: r.amount, account }
    const fp = fingerprint(base)
    const n = seen.get(fp) ?? 0
    seen.set(fp, n + 1)
    const learned = byDescription.get(r.description)
    const rule = learned ? null : applyMerchantRules(r.description, customRules)
    return { id: `txn-${hash(fp)}-${n}`, ...base, category: learned ?? rule ?? null, notes: '', source: learned ? 'correction' : rule ? 'rule' : 'model' }
  })

  const todo = transactions.filter(t => t.category === null)
  if (todo.length) {
    const results = await categoriser(todo, { customRules, corrections, onProgress, signal })
    todo.forEach((t, i) => {
      t.category = results[i].category
      if (!results[i].confident) t.notes = `needs-review: ${t.category}`
    })
  }

  const stats = { total: transactions.length, byCorrection: 0, byRule: 0, byModel: 0, flagged: 0 }
  for (const t of transactions) {
    if (t.source === 'correction') stats.byCorrection++
    else if (t.source === 'rule') stats.byRule++
    else stats.byModel++
    if (t.notes.startsWith('needs-review:')) stats.flagged++
    delete t.source
  }
  return { transactions, stats }
}

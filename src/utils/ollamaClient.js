// Local Ollama categoriser. Transaction text only ever goes to the Ollama URL (localhost by default).
import { TRANSACTION_CATEGORIES } from '../data/transactionCategories.js'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_MODEL = 'qwen3:4b-instruct'
const OWN_ACCOUNTS = ['Starling', 'Monzo'] // same default as the nb-transactions CLI config
const BATCH_SIZE = 15

export class OllamaError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

const store = {
  get(k, d) { try { return localStorage.getItem(k) || d } catch { return d } },
}
export const getOllamaConfig = () => ({
  url: store.get('nb:ollamaUrl', DEFAULT_OLLAMA_URL),
  model: store.get('nb:ollamaModel', DEFAULT_MODEL),
})

// Status for the in-app chip. Browsers can't tell "not running" from "CORS blocked", so say both.
export async function checkOllama({ url, model } = getOllamaConfig(), signal) {
  let res
  try {
    res = await fetch(`${url}/api/tags`, { signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    return { status: 'unreachable', message: 'Ollama isn’t reachable. Start it with `ollama serve`.' }
  }
  if (!res.ok) return { status: 'unreachable', message: `Ollama answered with HTTP ${res.status}.` }
  const { models = [] } = await res.json().catch(() => ({}))
  const have = models.some(m => m.name === model || m.name === `${model}:latest`)
  if (!have) return { status: 'no-model', message: `Model "${model}" isn’t installed. Run: ollama pull ${model}` }
  return { status: 'ok', message: `Ollama connected · ${model}` }
}

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          category: { type: 'string', enum: TRANSACTION_CATEGORIES },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['i', 'category', 'confidence'],
      },
    },
  },
  required: ['results'],
}

export function buildSystemPrompt({ customRules = [], corrections = [] } = {}) {
  const learned = [
    ...customRules.map(r => `- "${r.pattern}" → ${r.category}`),
    ...corrections.slice(-40).map(c => `- "${c.description}" → ${c.to}`),
  ]
  return [
    'You are a UK personal-finance assistant. Categorise each bank transaction into exactly one category.',
    'Rules:',
    `- Transfers to or from the user's own accounts (${OWN_ACCOUNTS.join(', ')}, savings pots/spaces) → "Transfer".`,
    '- Regular salary / BACS payroll → "Income - Salary". Pension → "Savings - Pension". Investment platforms → "Savings - Investment". ISA → "Savings - ISA".',
    '- Categorise by the real-world purchase. Prefer a specific category over "Other".',
    '- confidence is "low" if the description is ambiguous (e.g. a payment to a person, or a bare reference).',
    '- Return one result per input row, using the row number as "i".',
    learned.length ? `\nThe user's own past decisions — apply them:\n${learned.join('\n')}` : '',
    `\nCategories: ${TRANSACTION_CATEGORIES.join(' | ')}`,
  ].join('\n')
}

async function callBatch(batch, offset, { url, model, system, signal }) {
  const user = batch.map((r, k) => `${offset + k}\t${r.description}\t${r.amount}`).join('\n')
  let res
  try {
    res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, think: false, format: SCHEMA,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Row\tDescription\tAmount (negative = money out)\n${user}` },
        ],
      }),
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new OllamaError('unreachable', 'Lost contact with Ollama. Is it still running?')
  }
  if (res.status === 404) throw new OllamaError('no-model', `Model "${model}" isn’t installed. Run: ollama pull ${model}`)
  if (!res.ok) throw new OllamaError('http', `Ollama returned HTTP ${res.status}.`)
  const body = await res.json()
  try {
    return JSON.parse(body.message?.content ?? '{}').results ?? []
  } catch {
    return []
  }
}

// rows: [{ description, amount }]  →  [{ category, confident }] aligned with rows. Never throws for model slips:
// unresolved rows come back as Other / not confident so the review UI flags them.
export async function categorise(rows, { customRules, corrections, onProgress, signal, config = getOllamaConfig() } = {}) {
  const system = buildSystemPrompt({ customRules, corrections })
  const out = new Array(rows.length).fill(null)
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    for (let attempt = 0; attempt < 2; attempt++) {
      const pending = batch.map((r, k) => [r, start + k]).filter(([, idx]) => out[idx] === null)
      if (pending.length === 0) break
      const results = await callBatch(pending.map(([r]) => r), 0, { ...config, system, signal })
      // callBatch numbered rows from 0 within `pending`, so map back through it.
      for (const res of results) {
        const target = pending[res.i]
        if (target && TRANSACTION_CATEGORIES.includes(res.category)) {
          out[target[1]] = { category: res.category, confident: res.confidence === 'high' }
        }
      }
    }
    onProgress?.(Math.min(start + BATCH_SIZE, rows.length), rows.length)
  }
  return out.map(o => o ?? { category: 'Other', confident: false })
}

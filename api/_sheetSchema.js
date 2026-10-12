// Google-Sheet <-> app-data contract.
//
// Every piece of data the app persists is mapped onto a tab below. Columns are matched BY HEADER NAME
// (never position), so the sheet owner can reorder columns, add their own, or insert formulas freely.
//
//  * "Extra" columns hold a JSON object with any field the schema doesn't know about, so a round-trip
//    through the sheet is lossless even when the app grows new fields.
//  * "computed" columns are header-cell ARRAYFORMULAs that live only in the sheet. The adapter never
//    writes to them, and ignores their values when reading.
//
// Pure functions only (no network) so they can be unit-tested.

// ── Tab definitions ──────────────────────────────────────────────────────────
// col: { h: header, path?: dotted object path, type: str|num|bool|date|json, blank?, optional?, nullable?,
//        extra?: true, computed?: (L, T) => header formula }
// L(header) = column letter in the same tab; T(tab, header) = column letter in another tab.
const rng = (L, h) => `${L(h)}2:${L(h)}`

export const TABS = {
  Sections: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Name', path: 'name', type: 'str' },
      { h: 'Colour', path: 'color', type: 'str', optional: true },
      { h: 'Light colour', path: 'bgLight', type: 'str', optional: true },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Monthly total', type: 'num', computed: (L, T) =>
        `={"Monthly total";MAP(${rng(L, 'Name')},LAMBDA(x,IF(x="","",SUMIFS(Budget!$${T('Budget', 'Monthly')}$2:$${T('Budget', 'Monthly')},Budget!$${T('Budget', 'Section')}$2:$${T('Budget', 'Section')},x))))}` },
    ],
  },
  Groups: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Section', type: 'str', virtual: true },
      { h: 'Group', path: 'name', type: 'str' },
      { h: 'Savings type', path: 'savingsType', type: 'str', optional: true },
      { h: 'Is savings', path: 'isSavings', type: 'bool', optional: true },
      // The manually-held pot balance behind the "Held" chips. blank must round-trip to ABSENT, not 0:
      // the app deletes the key when it's cleared (src/App.jsx), and a 0 would render a £0 chip instead
      // of none. `blank: undefined` is therefore load-bearing, not a no-op.
      { h: 'Balance', path: 'currentBalance', type: 'num', blank: undefined },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Monthly total', type: 'num', computed: (L, T) =>
        `={"Monthly total";MAP(${rng(L, 'Section')},${rng(L, 'Group')},LAMBDA(s,g,IF(g="","",SUMIFS(Budget!$${T('Budget', 'Monthly')}$2:$${T('Budget', 'Monthly')},Budget!$${T('Budget', 'Section')}$2:$${T('Budget', 'Section')},s,Budget!$${T('Budget', 'Group')}$2:$${T('Budget', 'Group')},g))))}` },
    ],
  },
  Budget: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Section', type: 'str', virtual: true },
      { h: 'Group', type: 'str', virtual: true },
      { h: 'Item', path: 'name', type: 'str' },
      { h: 'Monthly', path: 'monthly', type: 'num', blank: 0 },
      { h: 'Annual', type: 'num', computed: L =>
        `={"Annual";ARRAYFORMULA(IF(${rng(L, 'Monthly')}="","",${rng(L, 'Monthly')}*12))}` },
      { h: 'Notes', path: 'notes', type: 'str' },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  Income: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Name', path: 'name', type: 'str' },
      { h: 'Monthly', path: 'monthly', type: 'num', blank: 0 },
      { h: 'Annual', type: 'num', computed: L =>
        `={"Annual";ARRAYFORMULA(IF(${rng(L, 'Monthly')}="","",${rng(L, 'Monthly')}*12))}` },
      { h: 'Notes', path: 'notes', type: 'str' },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  Holidays: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Destination', path: 'destination', type: 'str' },
      { h: 'Status', path: 'status', type: 'str' },
      { h: 'Departure', path: 'departureDate', type: 'date' },
      { h: 'Return', path: 'returnDate', type: 'date' },
      { h: 'Flights budget', path: 'budget.flights.budgeted', type: 'num', blank: 0 },
      { h: 'Flights actual', path: 'budget.flights.actual', type: 'num', blank: null },
      { h: 'Accommodation budget', path: 'budget.accommodation.budgeted', type: 'num', blank: 0 },
      { h: 'Accommodation actual', path: 'budget.accommodation.actual', type: 'num', blank: null },
      { h: 'On-ground budget', path: 'budget.onGround.budgeted', type: 'num', blank: 0 },
      { h: 'On-ground actual', path: 'budget.onGround.actual', type: 'num', blank: null },
      { h: 'Total budget', path: 'totalBudget', type: 'num', blank: 0 },
      { h: 'Notes', path: 'notes', type: 'str' },
      { h: 'Itinerary URL', path: 'itineraryUrl', type: 'str' },
      { h: 'Destination options', path: 'destinationOptions', type: 'json', blank: [] },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Actual total', type: 'num', computed: L =>
        `={"Actual total";ARRAYFORMULA(IF(${rng(L, 'Destination')}="","",N(+${rng(L, 'Flights actual')})+N(+${rng(L, 'Accommodation actual')})+N(+${rng(L, 'On-ground actual')})))}` },
    ],
  },
  Pensions: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Name', path: 'name', type: 'str' },
      { h: 'Balance', path: 'balance', type: 'num', blank: 0 },
      { h: 'Monthly contribution', path: 'monthlyContribution', type: 'num', blank: 0 },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  Goals: {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Icon', path: 'icon', type: 'str', optional: true },
      { h: 'Name', path: 'name', type: 'str' },
      { h: 'Target', path: 'target', type: 'num', blank: 0 },
      { h: 'Current', path: 'current', type: 'num', blank: 0 },
      { h: 'Monthly', path: 'monthly', type: 'num', blank: 0 },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Progress', type: 'num', computed: L =>
        `={"Progress";ARRAYFORMULA(IF(${rng(L, 'Target')}="","",IFERROR(${rng(L, 'Current')}/${rng(L, 'Target')},0)))}` },
      { h: 'Months to go', type: 'num', computed: L =>
        `={"Months to go";ARRAYFORMULA(IF(${rng(L, 'Target')}="","",IF(${rng(L, 'Monthly')}>0,ROUNDUP(MAX(${rng(L, 'Target')}-${rng(L, 'Current')},0)/${rng(L, 'Monthly')}),"")))}` },
    ],
  },
  'Future events': {
    cols: [
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Icon', path: 'icon', type: 'str', optional: true },
      { h: 'Label', path: 'label', type: 'str' },
      { h: 'Date', path: 'date', type: 'date' },
      { h: 'Monthly impact', path: 'monthlyImpact', type: 'num', blank: 0 },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  'Net worth': {
    cols: [
      { h: 'Date', path: 'date', type: 'date' },
      { h: 'ISA', path: 'isa', type: 'num', blank: 0 },
      { h: 'Pension', path: 'pension', type: 'num', blank: 0 },
      { h: 'Property equity', path: 'propertyEquity', type: 'num', blank: 0 },
      { h: 'Buffer', path: 'buffer', type: 'num', blank: 0 },
      { h: 'Other', path: 'other', type: 'num', blank: 0 },
      { h: 'Total', path: 'total', type: 'num', blank: 0 },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Sum of parts', type: 'num', computed: L =>
        `={"Sum of parts";ARRAYFORMULA(IF(${rng(L, 'Date')}="","",${rng(L, 'ISA')}+${rng(L, 'Pension')}+${rng(L, 'Property equity')}+${rng(L, 'Buffer')}+${rng(L, 'Other')}))}` },
    ],
  },
  Settings: {
    // One row per scalar setting. Lists/objects the app keeps under settings are JSON rows (Type = json).
    cols: [
      { h: 'Key', type: 'str', virtual: true },
      { h: 'Value', type: 'str', virtual: true },
      { h: 'Type', type: 'str', virtual: true },
      { h: 'Label', type: 'str', computed: (L, T) =>
        `={"Label";ARRAYFORMULA(IF(${rng(L, 'Key')}="","",IFERROR(VLOOKUP(${rng(L, 'Key')},Lists!$${T('Lists', 'Setting key')}$2:$${T('Lists', 'Setting label')},2,FALSE),"")))}` },
    ],
  },
  'Merchant rules': {
    cols: [
      { h: 'Pattern', path: 'pattern', type: 'str' },
      { h: 'Match type', path: 'matchType', type: 'str' },
      { h: 'Category', path: 'category', type: 'str' },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  Transactions: {
    cols: [
      { h: 'Month', type: 'str', virtual: true },
      { h: 'ID', path: 'id', type: 'str' },
      { h: 'Date', path: 'date', type: 'date' },
      { h: 'Description', path: 'description', type: 'str' },
      { h: 'Amount', path: 'amount', type: 'num', blank: 0 },
      { h: 'Account', path: 'account', type: 'str' },
      { h: 'Category', path: 'category', type: 'str' },
      { h: 'Notes', path: 'notes', type: 'str', optional: true },
      { h: 'Extra', extra: true, type: 'json' },
    ],
  },
  Imports: {
    cols: [
      { h: 'Month', path: 'month', type: 'str' },
      { h: 'Imported at', path: 'importedAt', type: 'str', optional: true },
      { h: 'Source', path: 'source', type: 'str', optional: true },
      { h: 'Extra', extra: true, type: 'json' },
      { h: 'Transactions', type: 'num', computed: (L, T) =>
        `={"Transactions";MAP(${rng(L, 'Month')},LAMBDA(m,IF(m="","",COUNTIF(Transactions!$${T('Transactions', 'Month')}$2:$${T('Transactions', 'Month')},m))))}` },
    ],
  },
}

// Tabs the budget document is spread across (read/written together as one document).
export const BUDGET_TABS = [
  'Sections', 'Groups', 'Budget', 'Income', 'Holidays', 'Pensions', 'Goals', 'Future events', 'Net worth', 'Settings',
]

// Sheet-only reference lists + settings labels (never read by the adapter except where noted).
// Lists!"Setting key"/"Setting label" feed the Settings "Label" column. Column positions are the init layout.
export const LISTS_LAYOUT = ['Category', 'Section', 'Savings type', 'Trip status', 'Account', 'Match type', 'Setting key', 'Setting label']

// ── Column letters ───────────────────────────────────────────────────────────
export function colLetter(i) { // 0-based
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
// `layouts` ({ tab: liveHeaders[] }) lets a formula resolve against the sheet's ACTUAL column order.
// Without it the schema order is assumed, which silently misaims formulas on a reordered sheet.
export function letterFor(tab, header, layouts) {
  const live = layouts && layouts[tab]
  if (live) {
    const j = live.indexOf(header)
    if (j >= 0) return colLetter(j)
  }
  const heads = tab === 'Lists' ? LISTS_LAYOUT : TABS[tab].cols.map(c => c.h)
  const i = heads.indexOf(header)
  if (i < 0) throw new Error(`Schema: no column "${header}" in "${tab}"`)
  return colLetter(i)
}
export function headerCellValue(tab, col, layouts) {
  if (!col.computed) return col.h
  const L = h => letterFor(tab, h, layouts)
  return col.computed(L, (t, h) => letterFor(t, h, layouts))
}

// ── Cell conversion ──────────────────────────────────────────────────────────
const isBlank = v => v === undefined || v === null || v === ''

export function serialToISO(n) {
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10)
}

// The Month column reads back as a date serial if the owner formatted it as a date, so normalise
// both shapes to YYYY-MM. Shared with the migration script so it groups months identically.
export const monthOf = v => (typeof v === 'number' ? serialToISO(v).slice(0, 7) : String(v ?? '').trim())

export function fromCell(col, v) {
  switch (col.type) {
    case 'num': {
      if (isBlank(v)) return col.blank
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[£,\s]/g, ''))
      return Number.isFinite(n) ? n : col.blank
    }
    case 'bool': {
      if (isBlank(v)) return undefined
      if (typeof v === 'boolean') return v
      return /^(true|yes|y|1)$/i.test(String(v).trim())
    }
    case 'date': {
      if (isBlank(v)) return ''
      if (typeof v === 'number') return serialToISO(v)
      return String(v).trim()
    }
    case 'json': {
      if (isBlank(v)) return col.blank
      if (typeof v !== 'string') return v
      try { return JSON.parse(v) } catch { return v }
    }
    default: { // str
      if (isBlank(v)) return col.optional ? undefined : ''
      return String(v)
    }
  }
}

export function toCell(col, v) {
  if (v === undefined || v === null) return ''
  switch (col.type) {
    case 'num': return typeof v === 'number' ? v : (Number.isFinite(Number(v)) ? Number(v) : '')
    case 'bool': return !!v
    case 'json': return (typeof v === 'object' && Object.keys(v).length === 0 && !Array.isArray(v)) ? '' : (Array.isArray(v) && v.length === 0 ? '' : JSON.stringify(v))
    default: return String(v)
  }
}

// ── Object <-> row helpers ───────────────────────────────────────────────────
function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o) }
function setPath(o, p, v) {
  const ks = p.split('.')
  let a = o
  for (let i = 0; i < ks.length - 1; i++) {
    if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}
    a = a[ks[i]]
  }
  a[ks[ks.length - 1]] = v
}
function delPath(o, p) {
  const ks = p.split('.')
  const stack = [o]
  for (let i = 0; i < ks.length - 1; i++) {
    const next = stack[stack.length - 1]?.[ks[i]]
    if (next == null || typeof next !== 'object') return
    stack.push(next)
  }
  delete stack[stack.length - 1][ks[ks.length - 1]]
  for (let i = stack.length - 1; i > 0; i--) { // prune emptied parents
    if (Object.keys(stack[i]).length === 0) delete stack[i - 1][ks[i - 1]]
  }
}
function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], v)
    else target[k] = v
  }
  return target
}
const clone = o => JSON.parse(JSON.stringify(o))

// obj -> { header: cell }; `skip` = top-level keys handled elsewhere (e.g. nested items).
export function objToRow(tab, obj, virtuals = {}, skip = []) {
  const cols = TABS[tab].cols
  const row = {}
  const rest = clone(obj)
  for (const k of skip) delete rest[k]
  for (const c of cols) {
    if (c.computed) continue
    if (c.path) { row[c.h] = toCell(c, getPath(obj, c.path)); delPath(rest, c.path) }
    else if (c.virtual) row[c.h] = virtuals[c.h] ?? ''
  }
  const ex = cols.find(c => c.extra)
  if (ex) row[ex.h] = toCell(ex, rest)
  return row
}

// { header: cell } -> obj
export function rowToObj(tab, row) {
  const cols = TABS[tab].cols
  const obj = {}
  const ex = cols.find(c => c.extra)
  if (ex) {
    const e = fromCell(ex, row[ex.h])
    if (e && typeof e === 'object' && !Array.isArray(e)) deepMerge(obj, e)
  }
  for (const c of cols) {
    if (c.computed || !c.path) continue
    const v = fromCell(c, row[c.h])
    if (v !== undefined) setPath(obj, c.path, v)
  }
  return obj
}

export function rowIsEmpty(tab, row) {
  return TABS[tab].cols.every(c => c.computed || c.extra || isBlank(row[c.h]))
}

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
const DEFAULT_COLOURS = [['#2E75B6', '#DBEAFE'], ['#C55A11', '#FEF3C7'], ['#7030A0', '#F3E8FF']]

// ── Settings <-> rows ────────────────────────────────────────────────────────
const SETTINGS_LISTS = ['pensions', 'goals', 'futureEvents']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function settingRow(key, v) {
  if (v === null || v === undefined) return { Key: key, Value: '', Type: 'null' }
  if (typeof v === 'number') return { Key: key, Value: v, Type: 'number' }
  if (typeof v === 'boolean') return { Key: key, Value: v, Type: 'bool' }
  if (typeof v === 'string') return { Key: key, Value: v, Type: ISO_DATE.test(v) ? 'date' : 'text' }
  return { Key: key, Value: JSON.stringify(v), Type: 'json' }
}
function settingValue(row) {
  const raw = row.Value
  let type = row.Type ? String(row.Type).trim().toLowerCase() : ''
  if (!type) type = typeof raw === 'number' ? 'number' : typeof raw === 'boolean' ? 'bool' : (isBlank(raw) ? 'null' : 'text')
  switch (type) {
    case 'null': return isBlank(raw) ? null : raw
    case 'number': { const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[£,%\s]/g, '')); return Number.isFinite(n) ? n : 0 }
    case 'bool': return typeof raw === 'boolean' ? raw : /^(true|yes|y|1)$/i.test(String(raw).trim())
    case 'date': return isBlank(raw) ? '' : (typeof raw === 'number' ? serialToISO(raw) : String(raw).trim())
    case 'json': { try { return JSON.parse(raw) } catch { return raw } }
    default: return isBlank(raw) ? '' : String(raw)
  }
}

// ── Budget document <-> tables ───────────────────────────────────────────────
// Tables are { [tabName]: Array<{header: cell}> } – row 1 (headers) is not included.
export function budgetToTables(data) {
  const t = {}
  const sections = data.sections || []
  t.Sections = sections.map(s => objToRow('Sections', s, {}, ['groups']))
  t.Groups = []
  t.Budget = []
  for (const s of sections) {
    for (const g of s.groups || []) {
      t.Groups.push(objToRow('Groups', g, { Section: s.name }, ['items']))
      for (const it of g.items || []) t.Budget.push(objToRow('Budget', it, { Section: s.name, Group: g.name }))
    }
  }
  t.Income = (data.income?.items || []).map(i => objToRow('Income', i))
  t.Holidays = (data.holidays?.trips || []).map(i => objToRow('Holidays', i))
  const st = data.settings || {}
  t.Pensions = (st.pensions || []).map(i => objToRow('Pensions', i))
  t.Goals = (st.goals || []).map(i => objToRow('Goals', i))
  t['Future events'] = (st.futureEvents || []).map(i => objToRow('Future events', i))
  t['Net worth'] = (data.netWorth?.snapshots || []).map(i => objToRow('Net worth', i))

  const settings = []
  for (const [k, v] of Object.entries(st)) if (!SETTINGS_LISTS.includes(k)) settings.push(settingRow(k, v))
  // Anything else at document level that isn't mapped above survives as "@<area>.<key>" JSON rows.
  const known = { income: ['items'], holidays: ['trips'], netWorth: ['snapshots'] }
  for (const [k, v] of Object.entries(data)) {
    if (k === 'sections' || k === 'settings') continue
    if (known[k]) {
      for (const [k2, v2] of Object.entries(v || {})) if (!known[k].includes(k2)) settings.push({ Key: `@${k}.${k2}`, Value: JSON.stringify(v2), Type: 'json' })
    } else settings.push({ Key: `@${k}`, Value: JSON.stringify(v), Type: 'json' })
  }
  t.Settings = settings
  return t
}

export function tablesToBudget(t) {
  const rows = tab => (t[tab] || []).filter(r => !rowIsEmpty(tab, r))
  const sections = []
  const secByName = new Map()
  const grpByKey = new Map()
  const usedIds = new Set()
  const uid = (base) => { let id = base, n = 2; while (usedIds.has(id)) id = `${base}-${n++}`; usedIds.add(id); return id }

  const ensureSection = (name) => {
    name = name || 'Unsorted'
    if (secByName.has(name)) return secByName.get(name)
    const [color, bgLight] = DEFAULT_COLOURS[sections.length % DEFAULT_COLOURS.length]
    const s = { id: uid(slug(name)), name, color, bgLight, groups: [] }
    sections.push(s); secByName.set(name, s)
    return s
  }
  const ensureGroup = (secName, gName) => {
    const sec = ensureSection(secName)
    gName = gName || 'Ungrouped'
    const key = `${sec.name}\u0000${gName}`
    if (grpByKey.has(key)) return grpByKey.get(key)
    const g = { id: uid(`grp-${slug(gName)}`), name: gName, items: [] }
    sec.groups.push(g); grpByKey.set(key, g)
    return g
  }

  for (const r of rows('Sections')) {
    const o = rowToObj('Sections', r)
    if (!o.id) o.id = slug(o.name)
    o.id = uid(o.id)
    o.groups = []
    const [color, bgLight] = DEFAULT_COLOURS[sections.length % DEFAULT_COLOURS.length]
    if (!o.color) o.color = color
    if (!o.bgLight) o.bgLight = bgLight
    sections.push(o); secByName.set(o.name, o)
  }
  for (const r of rows('Groups')) {
    const o = rowToObj('Groups', r)
    const sec = ensureSection(String(r.Section ?? '').trim())
    if (!o.id) o.id = `grp-${slug(o.name)}`
    o.id = uid(o.id)
    o.items = []
    sec.groups.push(o); grpByKey.set(`${sec.name}\u0000${o.name}`, o)
  }
  let n = 1
  for (const r of rows('Budget')) {
    const it = rowToObj('Budget', r)
    if (!it.name && !it.monthly) continue
    const g = ensureGroup(String(r.Section ?? '').trim(), String(r.Group ?? '').trim())
    if (!it.id) it.id = `item-${slug(g.name)}-${n}`
    it.id = uid(it.id); n++
    g.items.push(it)
  }

  const listOf = (tab, prefix) => rows(tab).map((r, i) => {
    const o = rowToObj(tab, r)
    if (prefix && !o.id) o.id = `${prefix}-${i + 1}`
    return o
  })

  const settings = {}
  const doc = {}
  for (const r of rows('Settings')) {
    const key = String(r.Key ?? '').trim()
    if (!key) continue
    const v = settingValue(r)
    if (key.startsWith('@')) {
      const [area, sub] = key.slice(1).split('.')
      if (sub) { doc[area] = doc[area] || {}; doc[area][sub] = v } else doc[area] = v
    } else settings[key] = v
  }
  settings.pensions = listOf('Pensions', 'pension')
  settings.goals = listOf('Goals', 'goal')
  settings.futureEvents = listOf('Future events', 'evt')

  const out = {
    ...doc,
    income: { ...(doc.income || {}), items: listOf('Income', 'inc') },
    sections,
    holidays: { ...(doc.holidays || {}), trips: listOf('Holidays', 'trip') },
    settings,
    netWorth: { ...(doc.netWorth || {}), snapshots: listOf('Net worth') },
  }
  return out
}

export function isBudgetEmpty(t) {
  return !(t.Sections || []).some(r => !rowIsEmpty('Sections', r)) && !(t.Budget || []).some(r => !rowIsEmpty('Budget', r))
}

// ── Light payload validation (reject obvious garbage before touching the sheet) ─
export function validateBudget(d) {
  const bad = m => { const e = new Error(m); e.status = 400; throw e }
  if (!d || typeof d !== 'object' || Array.isArray(d)) bad('Budget must be an object.')
  if (!Array.isArray(d.sections)) bad('Budget.sections must be an array.')
  for (const s of d.sections) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.groups ?? [])) bad('Each section needs a groups array.')
    for (const g of s.groups || []) if (!g || typeof g !== 'object' || !Array.isArray(g.items ?? [])) bad('Each group needs an items array.')
  }
  if (d.income && !Array.isArray(d.income.items ?? [])) bad('income.items must be an array.')
  if (d.holidays && !Array.isArray(d.holidays.trips ?? [])) bad('holidays.trips must be an array.')
  if (d.netWorth && !Array.isArray(d.netWorth.snapshots ?? [])) bad('netWorth.snapshots must be an array.')
  const s = d.settings
  if (s !== undefined && (typeof s !== 'object' || s === null || Array.isArray(s))) bad('settings must be an object.')
  for (const k of SETTINGS_LISTS) if (s && s[k] !== undefined && !Array.isArray(s[k])) bad(`settings.${k} must be an array.`)
  return d
}

// ── Transactions ─────────────────────────────────────────────────────────────
export function txnsToRows(month, txns) {
  return (txns || []).map(t => objToRow('Transactions', t, { Month: month }))
}
export function rowsToTxns(rows) {
  return rows.map((r, i) => {
    const t = rowToObj('Transactions', r)
    if (!t.id) t.id = `sheet-${r.Month}-${i + 1}`
    return t
  })
}
export function importToRow(doc) {
  return objToRow('Imports', doc, {}, ['transactions'])
}
export function rowToImport(r) {
  return rowToObj('Imports', r)
}

// ── Merchant rules ───────────────────────────────────────────────────────────
export const rulesToRows = rules => rules.map(r => objToRow('Merchant rules', r))
export const rowsToRules = rows => rows.filter(r => !rowIsEmpty('Merchant rules', r)).map(r => rowToObj('Merchant rules', r))


// Turns the positioned text items pdf.js extracts from a bank-statement PDF into transaction rows.
// Pure (no DOM, no pdf.js) so it can be unit-tested in Node; scripts/import-statement.mjs feeds it the pdf.js items (scripts/test-statement-import.mjs).
//
// Layout it understands (the Starling-style statement): a header line with DATE / TYPE / TRANSACTION /
// IN / OUT / END OF DAY ACCOUNT BALANCE, an OPENING BALANCE line, then one line per transaction whose
// description may wrap onto following lines. The end-of-day balance only appears on the last row of a day.

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const MONEY_RE = /^-?£\s?[\d,]+\.\d{2}$/

export class StatementError extends Error {}

const money = s => Number(s.replace(/[£,\s]/g, ''))
const round2 = n => Math.round(n * 100) / 100

// items: [{ str, x, y, w, page }]   (x = left edge, y = baseline with larger = higher on the page, w = width)
function toLines(items) {
  const sorted = items
    .filter(i => i.str.trim() !== '')
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  const lines = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && last.page === it.page && Math.abs(last.y - it.y) <= 3) last.items.push(it)
    else lines.push({ page: it.page, y: it.y, items: [it] })
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x)
  return lines
}

const lineText = l => l.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()

export function extractRows(items) {
  const lines = toLines(items)

  const header = lines.find(l => {
    const t = lineText(l).toUpperCase()
    return t.includes('DATE') && t.includes('TRANSACTION') && t.includes('OUT')
  })
  if (!header) throw new StatementError("Couldn't recognise this statement layout (no Date / Transaction / In / Out header found).")

  const find = word => header.items.find(i => i.str.trim().toUpperCase() === word)
  const hType = find('TYPE'), hTxn = find('TRANSACTION'), hIn = find('IN'), hOut = find('OUT')
  // The balance header wraps over several lines ("END OF DAY / ACCOUNT / BALANCE"), so locate its right edge
  // from whatever sits to the right of OUT anywhere in the header block.
  const outRight = hOut ? hOut.x + hOut.w : null
  if (!hType || !hTxn || !hIn || !hOut) throw new StatementError("Couldn't recognise this statement layout (missing a column header).")
  const inRight = hIn.x + hIn.w
  const headerBlock = lines.filter(l => l.page === header.page && Math.abs(l.y - header.y) <= 60 && l.y >= header.y - 5)
  const balRight = Math.max(
    outRight + 20,
    ...headerBlock.flatMap(l => l.items).filter(i => i.x > outRight).map(i => i.x + i.w),
  )

  const colOf = it => {
    const right = it.x + it.w
    const d = [['in', Math.abs(right - inRight)], ['out', Math.abs(right - outRight)], ['bal', Math.abs(right - balRight)]]
    return d.sort((a, b) => a[1] - b[1])[0][0]
  }

  const rows = []
  let openingBalance = null
  let seenHeader = false

  for (const line of lines) {
    if (line === header) { seenHeader = true; continue }
    if (!seenHeader) continue
    const text = lineText(line).toUpperCase()
    if (text.includes('TRANSACTION') && text.includes('DATE') && text.includes('OUT')) continue // repeated header on later pages

    const dateItem = line.items.find(i => DATE_RE.test(i.str.trim()))
    const amounts = line.items.filter(i => MONEY_RE.test(i.str.trim()))

    if (text.startsWith('OPENING BALANCE')) {
      if (amounts.length) openingBalance = money(amounts[amounts.length - 1].str)
      continue
    }

    if (dateItem) {
      const [, dd, mm, yyyy] = DATE_RE.exec(dateItem.str.trim())
      const typeText = line.items.filter(i => i !== dateItem && !MONEY_RE.test(i.str.trim()) && i.x < hTxn.x - 2).map(i => i.str.trim()).join(' ')
      const desc = line.items.filter(i => !MONEY_RE.test(i.str.trim()) && i !== dateItem && i.x >= hTxn.x - 2).map(i => i.str.trim()).join(' ')
      let amount = null, balance = null
      for (const a of amounts) {
        const c = colOf(a), v = money(a.str)
        if (c === 'in') amount = v
        else if (c === 'out') amount = -v
        else balance = v
      }
      if (amount === null) continue // a dated line with no In/Out (e.g. a stray date in a footer)
      rows.push({ date: `${yyyy}-${mm}-${dd}`, type: typeText, description: desc, amount: round2(amount), balance })
      continue
    }

    // Continuation of a wrapped description (no date, no amounts, text in the Transaction column).
    const prev = rows[rows.length - 1]
    if (prev && amounts.length === 0 && line.items.every(i => i.x >= hTxn.x - 2)) {
      prev.description = `${prev.description} ${lineText(line)}`.trim()
    }
  }

  if (rows.length === 0) throw new StatementError('No transactions found in this PDF. Is it a scanned image? Only text-based statements are supported.')

  const closingBalance = [...rows].reverse().find(r => r.balance !== null)?.balance ?? null
  const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort()
  return { rows, openingBalance, closingBalance, months, month: months[0] }
}

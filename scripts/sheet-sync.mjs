#!/usr/bin/env node
// Admin helper for the Google-Sheets backend.
//   node scripts/sheet-sync.mjs init                 create any missing tabs + header rows (safe to re-run)
//   node scripts/sheet-sync.mjs push budget.json     overwrite the sheet's budget tabs from a JSON export
//   node scripts/sheet-sync.mjs pull [out.json]      dump the sheet's budget as JSON (stdout if no file)
//   node scripts/sheet-sync.mjs check                verify credentials + that every tab/column exists
//   node scripts/sheet-sync.mjs pots                 report Pots totals next to Groups, to map Balance by hand
// Needs GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON (e.g. `node --env-file=.env scripts/sheet-sync.mjs init`).
import fs from 'node:fs';
import { clientFromEnv } from '../api/_sheets.js';
import { createStore } from '../api/_sheetStore.js';

// Config problems are the common case when running these by hand, so fail with a sentence
// rather than a stack trace.
function envClient() {
  try {
    return clientFromEnv();
  } catch (e) {
    console.error(`${e.message}\nSet GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON, e.g. via --env-file=.env.local`);
    process.exit(1);
  }
}

const [cmd, arg] = process.argv.slice(2);
const client = envClient();
const store = createStore(client);

const gbp = n => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = v => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

switch (cmd) {
  case 'init':
    await store.init(['Lists']);
    console.log('Tabs and headers are in place.');
    break;
  case 'push': {
    if (!arg) throw new Error('Usage: push <budget.json>');
    await store.saveBudget(JSON.parse(fs.readFileSync(arg, 'utf8')));
    console.log(`Pushed ${arg} to the sheet.`);
    break;
  }
  case 'pull': {
    const budget = await store.getBudget();
    const text = JSON.stringify(budget, null, 2);
    if (arg) { fs.writeFileSync(arg, text); console.log(`Wrote ${arg}`); } else console.log(text);
    break;
  }
  case 'check': {
    const { ok, problems } = await store.check();
    for (const p of problems) {
      console.log(p.missing === 'tab' ? `✗ missing tab: ${p.tab}` : `✗ ${p.tab}: missing column(s) ${p.columns.join(', ')}`);
    }
    console.log(ok ? '✓ credentials work and every tab/column is present.' : `${problems.length} problem(s). Run "init".`);
    process.exitCode = ok ? 0 : 1;
    break;
  }
  // The Pots tab is hand-made and organised differently from Groups (several pots per group, and its
  // group names don't match Groups' names), so there is no safe automatic mapping — guessing would
  // write wrong balances. This prints both sides so Groups!Balance can be filled in once by hand.
  case 'pots': {
    let tabs;
    try {
      tabs = await store.readTabs(['Pots', 'Groups']);
    } catch (e) {
      if (/Unable to parse range/i.test(e.message)) {
        console.log('No "Pots" tab in this sheet — nothing to report.');
        break;
      }
      throw e;
    }
    const balanceHeader = tabs.Pots.headers.find(h => /^balance/i.test(h) && !/as of/i.test(h));
    if (!balanceHeader) {
      console.log(`Couldn't find a balance column in Pots. Headers: ${tabs.Pots.headers.join(', ')}`);
      process.exitCode = 1;
      break;
    }
    const totals = new Map();
    for (const r of tabs.Pots.rows) {
      const g = String(r.Group ?? '').trim();
      const pot = String(r.Pot ?? '').trim();
      if (!g && !pot) continue;
      const t = totals.get(g) || { total: 0, pots: [] };
      t.total += num(r[balanceHeader]);
      t.pots.push(`${pot || '(unnamed)'} ${gbp(num(r[balanceHeader]))}`);
      totals.set(g, t);
    }

    console.log(`Pots totals (from "${balanceHeader}"):\n`);
    let grand = 0;
    for (const [g, t] of totals) {
      grand += t.total;
      console.log(`  ${g || '(no group)'} — ${gbp(t.total)}`);
      for (const p of t.pots) console.log(`      ${p}`);
    }
    console.log(`\n  TOTAL ${gbp(grand)}`);

    console.log('\nGroups tab, and what Balance currently holds:\n');
    for (const r of tabs.Groups.rows) {
      const name = String(r.Group ?? '').trim();
      if (!name) continue;
      const bal = r.Balance === '' || r.Balance === undefined ? '—' : gbp(num(r.Balance));
      console.log(`  ${String(r.Section ?? '').trim()} / ${name}  →  Balance ${bal}`);
    }
    console.log('\nFill Groups!Balance in by hand; the app reads it as each group\'s "Held" amount.');
    break;
  }
  default:
    console.log('Usage: sheet-sync.mjs <init|push|pull|check|pots> [file]');
    process.exitCode = 1;
}

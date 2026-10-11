#!/usr/bin/env node
// Admin helper for the Google-Sheets backend.
//   node scripts/sheet-sync.mjs init                 create any missing tabs + header rows (safe to re-run)
//   node scripts/sheet-sync.mjs push budget.json     overwrite the sheet's budget tabs from a JSON export
//   node scripts/sheet-sync.mjs pull [out.json]      dump the sheet's budget as JSON (stdout if no file)
//   node scripts/sheet-sync.mjs check                verify credentials + that every tab/column exists
// Needs GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON (e.g. `node --env-file=.env scripts/sheet-sync.mjs init`).
import fs from 'node:fs';
import { clientFromEnv } from '../api/_sheets.js';
import { createStore } from '../api/_sheetStore.js';
import { TABS } from '../api/_sheetSchema.js';

const [cmd, arg] = process.argv.slice(2);
const client = clientFromEnv();
const store = createStore(client);

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
    const have = new Map((await client.tabs()).map(t => [t.title, t]));
    let bad = 0;
    const tabs = await store.readTabs(Object.keys(TABS).filter(n => have.has(n)));
    for (const [name, def] of Object.entries(TABS)) {
      if (!have.has(name)) { console.log(`✗ missing tab: ${name}`); bad++; continue; }
      const miss = def.cols.filter(c => !c.computed && !tabs[name].headers.includes(c.h)).map(c => c.h);
      if (miss.length) { console.log(`✗ ${name}: missing column(s) ${miss.join(', ')}`); bad++; }
    }
    console.log(bad ? `${bad} problem(s). Run "init".` : '✓ credentials work and every tab/column is present.');
    process.exitCode = bad ? 1 : 0;
    break;
  }
  default:
    console.log('Usage: sheet-sync.mjs <init|push|pull|check> [file]');
    process.exitCode = 1;
}

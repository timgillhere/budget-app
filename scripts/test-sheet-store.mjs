#!/usr/bin/env node
// Round-trip tests for the Google-Sheets storage adapter, using an in-memory fake of the Sheets API.
//   npm run test:sheets
import assert from 'node:assert/strict';
import { createStore } from '../api/_sheetStore.js';
import { TABS, headerCellValue, colLetter } from '../api/_sheetSchema.js';
import { defaultBudget, emptyBudget } from '../src/data/defaultBudget.js';

// ── fake sheet ───────────────────────────────────────────────────────────────
const colNum = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function parseRange(r) {
  const m = /^'(.+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/.exec(r);
  if (!m) throw new Error(`Unable to parse range: ${r}`);
  const c1 = colNum(m[2]), r1 = +m[3] - 1;
  return { tab: m[1].replace(/''/g, "'"), c1, r1, c2: m[4] ? colNum(m[4]) : c1, r2: m[5] ? +m[5] - 1 : Infinity };
}
export function fakeSheet() {
  const grids = {};
  for (const [name, def] of Object.entries(TABS)) grids[name] = [def.cols.map(c => (c.computed ? c.h : c.h))];
  const trim = g => g.map(row => { const r = [...row]; while (r.length && (r.at(-1) === '' || r.at(-1) === undefined)) r.pop(); return r; });
  return {
    grids, calls: [],
    async batchGet(ranges) {
      this.calls.push(['get', ranges.length]);
      return ranges.map(r => { const p = parseRange(r); if (!grids[p.tab]) throw new Error(`Unable to parse range: ${r}`); return trim(grids[p.tab]); });
    },
    async batchUpdate(data) {
      this.calls.push(['update', data.length]);
      for (const { range, values } of data) {
        const p = parseRange(range); const g = grids[p.tab];
        values.forEach((row, i) => row.forEach((v, j) => { (g[p.r1 + i] ||= [])[p.c1 + j] = v; }));
      }
    },
    async batchClear(ranges) {
      this.calls.push(['clear', ranges.length]);
      for (const r of ranges) {
        const p = parseRange(r); const g = grids[p.tab];
        for (let i = p.r1; i < Math.min(g.length, p.r2 + 1); i++) for (let c = p.c1; c <= p.c2; c++) if (g[i]) g[i][c] = '';
      }
    },
  };
}
// Put a sentinel in every computed column so we can prove the adapter never overwrites them.
function seedComputed(sheet, tab, n) {
  const cols = TABS[tab].cols; const g = sheet.grids[tab];
  cols.forEach((c, ci) => { if (c.computed) for (let r = 1; r <= n; r++) (g[r] ||= [])[ci] = 'CALC'; });
}
function computedIntact(sheet, tab, n) {
  const cols = TABS[tab].cols; const g = sheet.grids[tab];
  cols.forEach((c, ci) => { if (c.computed) for (let r = 1; r <= n; r++) assert.equal(g[r][ci], 'CALC', `${tab}!${colLetter(ci)}${r+1} was overwritten`); });
}

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`); };
const clone = o => JSON.parse(JSON.stringify(o));

// ── tests ────────────────────────────────────────────────────────────────────
await test('default + empty budgets round-trip losslessly', async () => {
  for (const b of [defaultBudget, emptyBudget]) {
    const sheet = fakeSheet(); const store = createStore(sheet);
    await store.saveBudget(clone(b));
    const back = await store.getBudget();
    assert.deepEqual(back, clone(b));
  }
});

await test('unknown fields survive via Extra columns', async () => {
  const b = clone(defaultBudget);
  b.sections[0].icon = 'x';
  b.sections[0].groups[0].colour = 'red'; b.sections[0].groups[0].items[0].tags = ['a', 'b'];
  b.income.items[0].taxCode = '1257L'; b.income.note = 'hello';
  b.holidays.trips[0].budget.parking = { budgeted: 10, actual: null }; b.holidays.trips[0].extra = { a: { b: 2 } };
  b.holidays.legacy = true;
  b.settings.nested = { a: [1, 2, { c: 3 }] }; b.settings.dob = '1988-03-04'; b.settings.flag = true; b.settings.nothing = null;
  b.settings.pensions[0].provider = 'Aviva'; b.settings.goals[0].deadline = '2027-01-01'; b.settings.futureEvents = [{ id: 'e1', label: 'Remortgage', date: '2027-12-01', monthlyImpact: -120, icon: '🏠', foo: 1 }];
  b.netWorth.snapshots[0].note = 'baseline'; b.netWorth.meta = { v: 2 };
  b.customTopLevel = { x: 1 };
  const sheet = fakeSheet(); const store = createStore(sheet);
  await store.saveBudget(clone(b));
  assert.deepEqual(await store.getBudget(), b);
});

await test('shrinking the budget clears leftover rows; computed columns untouched', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  await store.saveBudget(clone(defaultBudget));
  seedComputed(sheet, 'Budget', 3); seedComputed(sheet, 'Income', 1); seedComputed(sheet, 'Goals', 3);
  const small = clone(defaultBudget);
  small.sections[0].groups = small.sections[0].groups.slice(0, 1);
  small.settings.goals = small.settings.goals.slice(0, 1);
  await store.saveBudget(clone(small));
  assert.deepEqual(await store.getBudget(), small);
  computedIntact(sheet, 'Budget', 3); computedIntact(sheet, 'Income', 1); computedIntact(sheet, 'Goals', 1);
  const nItems = small.sections.flatMap(x => x.groups.flatMap(g => g.items)).length;
  assert.equal(sheet.grids.Budget.slice(1).filter(r => r[0]).length, nItems, 'no stale Budget rows');
});

await test('a save uses a bounded number of API calls', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  await store.saveBudget(clone(defaultBudget));
  assert.ok(sheet.calls.length <= 4, `calls: ${JSON.stringify(sheet.calls)}`);
});

await test('sheet edited by hand: reordered columns, text numbers, date serials, new rows, blank rows', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  await store.saveBudget(clone(defaultBudget));
  // reorder Budget columns: swap Monthly and Item headers+cells
  const g = sheet.grids.Budget; const h = g[0]; const a = h.indexOf('Item'), b = h.indexOf('Monthly');
  for (const row of g) if (row.length) [row[a], row[b]] = [row[b], row[a]];
  // user types £ text and appends a row with an unknown group + no ID, plus a fully blank row
  const monthlyCol = a; // after swap, "Item" header now at b; values: swapped
  g[1][a] = '£1,000.50'; // header at a is now 'Monthly'
  g.push([]); g.push(['', defaultBudget.sections[1].name, 'Brand new group', 'Coffee beans', 12, '', 'tasty']);
  // headers: ID, Section, Group, Monthly(was Item pos), Item(was Monthly pos)... fix to match swapped order
  const last = g[g.length - 1]; last[a] = 12; last[b] = 'Coffee beans';
  // trip date typed in Sheets becomes a serial number (46152 = 2026-05-10)
  const hol = sheet.grids.Holidays; hol[1][hol[0].indexOf('Departure')] = 46152;
  const back = await store.getBudget();
  const rent = back.sections[0].groups[0].items[0];
  assert.equal(rent.monthly, 1000.5); assert.equal(rent.name, 'Rent / Mortgage');
  const ca = back.sections.find(s => s.name.includes('Current'));
  const grp = ca.groups.find(x => x.name === 'Brand new group');
  assert.ok(grp && grp.id && grp.items[0].id && grp.items[0].name === 'Coffee beans' && grp.items[0].monthly === 12);
  assert.equal(back.holidays.trips[0].departureDate, '2026-05-10');
  // saving again keeps the user's column order
  await store.saveBudget(back);
  assert.equal(sheet.grids.Budget[0].indexOf('Monthly'), a);
});

await test('missing schema columns are appended on write', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  sheet.grids.Pensions = [['ID', 'Name']];
  await store.saveBudget(clone(defaultBudget));
  assert.ok(sheet.grids.Pensions[0].includes('Balance') && sheet.grids.Pensions[0].includes('Monthly contribution'));
  assert.deepEqual((await store.getBudget()).settings.pensions, defaultBudget.settings.pensions);
});

await test('transactions: per-month replace, other months untouched, metadata kept', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  const tx = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, date: '2026-02-0' + (i + 1), description: `Shop ${i}`, amount: -(i + 1) * 3.5, account: 'Starling', category: 'Groceries', notes: i ? '' : 'weekly', ...extra }));
  assert.equal(await store.getMonth('2026-02'), null);
  await store.saveMonth('2026-02', { month: '2026-02', importedAt: '2026-03-01T10:00:00Z', transactions: tx(3, { balance: 99.5 }) });
  await store.saveMonth('2026-03', { month: '2026-03', importedAt: '2026-04-01T10:00:00Z', source: 'agent', transactions: tx(2) });
  const feb = await store.getMonth('2026-02');
  assert.equal(feb.importedAt, '2026-03-01T10:00:00Z'); assert.equal(feb.transactions.length, 3);
  assert.deepEqual(feb.transactions[0], tx(3, { balance: 99.5 })[0]);
  assert.equal((await store.getMonth('2026-03')).source, 'agent');
  await store.saveMonth('2026-02', { month: '2026-02', importedAt: 'later', transactions: tx(1) });
  assert.equal((await store.getMonth('2026-02')).transactions.length, 1);
  assert.equal((await store.getMonth('2026-03')).transactions.length, 2);
  assert.equal(sheet.grids.Imports.slice(1).filter(r => r[0]).length, 2);
  await assert.rejects(store.saveMonth('2026-04', { transactions: 'nope' }), e => e.status === 400);
});

await test('merchant rules + sync status', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  assert.deepEqual(await store.getMerchantRules(), []); assert.equal(await store.getSyncStatus(), null);
  const rules = [{ pattern: 'TESCO', matchType: 'contains', category: 'Groceries' }, { pattern: 'X', matchType: 'startsWith', category: 'Other', note: 'n' }];
  await store.saveMerchantRules(rules); assert.deepEqual(await store.getMerchantRules(), rules);
  await store.saveMerchantRules(rules.slice(0, 1)); assert.deepEqual(await store.getMerchantRules(), rules.slice(0, 1));
  await assert.rejects(store.saveMerchantRules({}), e => e.status === 400);
  const st = { updatedAt: '2026-10-01T00:00:00Z', error: null, starling: { ok: true, count: 12 }, label: '123' };
  await store.saveSyncStatus(st); assert.deepEqual(await store.getSyncStatus(), st);
  await store.saveSyncStatus(null); assert.equal(await store.getSyncStatus(), null);
});

await test('invalid budgets are rejected before touching the sheet', async () => {
  const sheet = fakeSheet(); const store = createStore(sheet);
  for (const bad of [null, [], {}, { sections: 'x' }, { sections: [{ groups: 5 }] }, { sections: [], settings: { goals: 3 } }]) {
    await assert.rejects(store.saveBudget(bad), e => e.status === 400);
  }
  assert.equal(sheet.calls.length, 0);
});

await test('empty sheet reads as null (app falls back to defaults/onboarding)', async () => {
  assert.equal(await createStore(fakeSheet()).getBudget(), null);
});

await test('REST client: signs an RS256 assertion, caches the token, builds correct requests', async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const jwt = (await import('jsonwebtoken')).default;
  const { SheetsClient, parseCredentials, sheetsEnabledFor } = await import('../api/_sheets.js');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const creds = parseCredentials(JSON.stringify({ client_email: 'svc@x.iam.gserviceaccount.com', private_key: privateKey.replace(/\n/g, '\\n') }));
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url: String(url), opts });
    if (String(url).includes('oauth2')) {
      const claims = jwt.verify(new URLSearchParams(opts.body).get('assertion'), publicKey, { algorithms: ['RS256'] });
      assert.equal(claims.iss, 'svc@x.iam.gserviceaccount.com');
      return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    }
    return { ok: true, status: 200, json: async () => ({ valueRanges: [{ values: [['a']] }, {}] }) };
  };
  const c = new SheetsClient({ spreadsheetId: 'SID', credentials: creds, fetchImpl });
  assert.deepEqual(await c.batchGet(["'Net worth'!A1:ZZ", "'B'!A1:ZZ"]), [[['a']], []]);
  await c.batchUpdate([{ range: "'B'!A2", values: [[1]] }]);
  assert.equal(seen.filter(x => x.url.includes('oauth2')).length, 1, 'token fetched once');
  assert.ok(seen[1].url.includes("/spreadsheets/SID/values:batchGet?ranges='Net%20worth'"));
  assert.equal(seen[1].opts.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(seen[2].opts.body).valueInputOption, 'RAW');
  const env = { DATA_SOURCE: 'sheets', SHEETS_USER_ID: '7' };
  assert.ok(sheetsEnabledFor({ userId: 7 }, env)); assert.ok(!sheetsEnabledFor({ userId: 8 }, env));
  assert.ok(!sheetsEnabledFor({ userId: 7 }, { SHEETS_USER_ID: '7' })); assert.ok(!sheetsEnabledFor({ userId: 7 }, { DATA_SOURCE: 'sheets' }));
});

console.log(`\n${passed} passed`);

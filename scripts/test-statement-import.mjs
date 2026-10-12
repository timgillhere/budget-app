#!/usr/bin/env node
// Tests for PDF statement parsing + categorisation orchestration (stubbed Ollama).
//   npm run test:import
import assert from 'node:assert/strict';
import { extractRows, StatementError } from '../src/utils/statementParser.js';
import { categoriseStatement, reconcile } from '../src/utils/statementImport.js';

let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log('  ✓', name); } catch (e) { failed++; console.error('  ✗', name, '\n   ', e.message); } };

// ── fixture: the September 2026 statement as pdf.js-style positioned items ──
const X = { date: 20, type: 170, txn: 404, in: 990, out: 1143, bal: 1295 };
const raw = [
  ['01/09/2026','DIRECT DEBIT','Thames Water (900071347897)',null,66.00,null],
  ['01/09/2026','DIRECT DEBIT','Halifax (1058458245020000)',null,1119.62,null],
  ['01/09/2026','DIRECT DEBIT','Talkmobile (105601542FC4A0F2)',null,10.00,null],
  ['01/09/2026','DIRECT DEBIT','TV Licensing (4141498129)',null,14.95,null],
  ['01/09/2026','FASTER PAYMENT','monzo Tim (Monzo spaces)',null,620.00,null],
  ['01/09/2026','DIRECT DEBIT','Royal Borough of Kingston upon Thames|(200615157)',null,196.00,null],
  ['01/09/2026','DIRECT DEBIT','Nuffield Health (131116075)',null,80.00,null],
  ['01/09/2026','FASTER PAYMENT','monzo Tim (Lidl)',null,60.00,2784.41],
  ['02/09/2026','DIRECT DEBIT','Octopus Energy (7J386N8)',null,135.09,null],
  ['02/09/2026','APPLE PAY','TFL TRAVEL CH',null,16.30,2633.02],
  ['03/09/2026','CARD SUBSCRIPTION','Amazon Prime*NJ57T0YY4',null,8.99,null],
  ['03/09/2026','FASTER PAYMENT','Miss D Burns (Session40)',null,60.00,2564.03],
  ['04/09/2026','APPLE PAY','TFL TRAVEL CH',null,12.20,null],
  ['04/09/2026','APPLE PAY','Londis Surbiton',null,3.89,null],
  ['04/09/2026','APPLE PAY','WAITROSE STORES',null,8.65,2539.29],
  ['06/09/2026','CARD SUBSCRIPTION','NETFLIX.COM',null,12.99,null],
  ['06/09/2026','FASTER PAYMENT','monzo Tim (Camper)',null,85.00,2441.30],
  ['07/09/2026','FASTER PAYMENT','monzo Tim (M&s)',null,62.00,null],
  ['07/09/2026','APPLE PAY','SAINSBURYS S/MATS',null,15.25,2364.05],
  ['10/09/2026','ONLINE PAYMENT','ANTHROPIC* CLAUDE SUB',null,18.00,null],
  ['10/09/2026','FASTER PAYMENT','monzo Tim (Monzo)',null,170.00,2176.05],
  ['11/09/2026','APPLE PAY','TFL TRAVEL CH',null,11.90,null],
  ['11/09/2026','APPLE PAY','WAITROSE STORES',null,14.83,2149.32],
  ['12/09/2026','APPLE PAY','M&S FOOD',null,3.60,2145.72],
  ['13/09/2026','APPLE PAY','HOME BARGAINS ASHFORD',null,4.16,2141.56],
  ['14/09/2026','APPLE PAY','LIDL GB KINGSTON',null,116.85,2024.71],
  ['17/09/2026','DIRECT DEBIT','TfL (251126119002833586)',null,9.00,null],
  ['17/09/2026','CARD SUBSCRIPTION','Spotify P46F5C6B00',null,12.99,null],
  ['17/09/2026','FASTER PAYMENT','BELHAJ L (DRAW)',10.00,null,2012.72],
  ['18/09/2026','APPLE PAY','APPLE.COM/BILL',null,1.99,2010.73],
  ['19/09/2026','APPLE PAY','SAINSBURYS S/MKTS',null,3.35,null],
  ['19/09/2026','FASTER PAYMENT','monzo Tim (Monzo)',null,272.00,null],
  ['19/09/2026','FASTER PAYMENT','monzo Tim (Monzo)',null,1.00,1734.38],
];
const gbp = n => `£${n.toFixed(2)}`;
function fixture() {
  const items = []; let y = 1000;
  const put = (str, x, w = str.length * 7) => items.push({ str, x, y, w, page: 1 });
  put('September 2026 Statement', 20, 300); y -= 60;
  put('DATE', X.date, 30); put('TYPE', X.type, 30); put('TRANSACTION', X.txn, 90); put('IN', X.in - 12, 12); put('OUT', X.out - 25, 25); put('END OF DAY', X.bal - 70, 70); y -= 14;
  put('ACCOUNT', X.bal - 55, 55); y -= 14; put('BALANCE', X.bal - 55, 55); y -= 30;
  put('OPENING BALANCE', 170, 120); put('£4950.98', X.bal - 56, 56); y -= 28;
  for (const [date, type, desc, inn, out, bal] of raw) {
    put(date, X.date, 70); put(type, X.type, 100);
    const [d1, d2] = desc.split('|'); put(d1, X.txn, d1.length * 7);
    if (inn != null) put(gbp(inn), X.in - 50, 50);
    if (out != null) put(gbp(out), X.out - 50, 50);
    if (bal != null) put(gbp(bal), X.bal - 56, 56);
    y -= 28;
    if (d2) { put(d2, X.txn, d2.length * 7); y -= 28; }
  }
  return items;
}

console.log('statementParser');
const parsed = extractRows(fixture());
await test('reads all 33 rows, opening and closing balance, month', () => {
  assert.equal(parsed.rows.length, 33);
  assert.equal(parsed.openingBalance, 4950.98);
  assert.equal(parsed.closingBalance, 1734.38);
  assert.equal(parsed.month, '2026-09');
});
await test('joins wrapped description, signs amounts, ISO dates', () => {
  assert.equal(parsed.rows[5].description, 'Royal Borough of Kingston upon Thames (200615157)');
  assert.equal(parsed.rows[0].amount, -66);
  assert.equal(parsed.rows[0].date, '2026-09-01');
  const draw = parsed.rows.find(r => r.description.startsWith('BELHAJ'));
  assert.equal(draw.amount, 10);
});
await test('unrecognised layout and empty statements raise StatementError', () => {
  assert.throws(() => extractRows([{ str: 'hello', x: 0, y: 0, w: 30, page: 1 }]), StatementError);
});

console.log('reconcile');
await test('balances match for the full statement', () => {
  const r = reconcile(parsed.openingBalance, parsed.rows, parsed.closingBalance);
  assert.equal(r.ok, true);
});
await test('a dropped row is pinpointed at the next checkpoint', () => {
  const rows = parsed.rows.filter((_, i) => i !== 3);
  const r = reconcile(parsed.openingBalance, rows, parsed.closingBalance);
  assert.equal(r.ok, false);
  assert.equal(r.firstMismatch.date, '2026-09-01');
  assert.equal(r.diff, -14.95);
});

console.log('categoriseStatement');
let modelCalls = [];
const stub = async rows => { modelCalls.push(...rows.map(r => r.description)); return rows.map(() => ({ category: 'Transfer', confident: false })); };
const out = await categoriseStatement(parsed, { account: 'Current', categoriser: stub });
await test('rules handle known merchants without calling the model', () => {
  const cat = d => out.transactions.find(t => t.description.startsWith(d)).category;
  assert.equal(cat('Thames Water'), 'Housing - Water');
  assert.equal(cat('NETFLIX'), 'Subscriptions - Streaming');
  assert.ok(!modelCalls.some(d => d.startsWith('Thames Water') || d.startsWith('NETFLIX')));
  assert.ok(out.stats.byRule > 0 && out.stats.byModel > 0);
});
await test('low-confidence model rows are flagged needs-review', () => {
  const t = out.transactions.find(t => t.description === 'monzo Tim (Camper)');
  assert.equal(t.notes, 'needs-review: Transfer');
  assert.equal(out.stats.flagged, out.stats.byModel);
});
await test('past corrections win over rules and model', async () => {
  const o = await categoriseStatement(parsed, { account: 'Current', categoriser: stub, corrections: [{ description: 'monzo Tim (Camper)', from: 'Transfer', to: 'Holidays & Travel' }] });
  assert.equal(o.transactions.find(t => t.description === 'monzo Tim (Camper)').category, 'Holidays & Travel');
});
await test('ids are stable and unique, same-day duplicates distinguished', () => {
  const ids = out.transactions.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, (await_same()).map(t => t.id));
  function await_same() { return out.transactions; }
});

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');

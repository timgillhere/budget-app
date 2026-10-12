#!/usr/bin/env node
/**
 * One-time migration: a user's Vercel Blob documents → their Google Sheet.
 *
 *   node --env-file=.env.local scripts/migrate-blob-to-sheets.mjs            # dry run (default)
 *   node --env-file=.env.local scripts/migrate-blob-to-sheets.mjs --commit   # actually write
 *
 * Budget reconciliation: the sheet's budget tabs were populated by hand, so the Blob copy and the
 * sheet have almost certainly drifted. The script refuses to guess — it prints a field-level diff
 * and stops until you say which side wins:
 *
 *   --take-blob    overwrite the sheet's budget tabs from Blob
 *   --keep-sheet   leave the sheet's budget alone (transactions etc. still migrate)
 *
 * Transactions and merchant rules have no equivalent in the sheet yet, so they are copied across
 * without asking. Re-running is safe: each month replaces only its own rows.
 *
 * sync-status.json is deliberately skipped: bank sync was removed from the app, so nothing produces
 * or reads it any more.
 *
 * Needs BLOB_READ_WRITE_TOKEN, GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON and (for the user id)
 * SHEETS_USER_ID, or pass --user=<id>.
 */
import { list } from '@vercel/blob';
import { clientFromEnv } from '../api/_sheets.js';
import { createStore } from '../api/_sheetStore.js';
import { budgetToTables, tablesToBudget, txnsToRows, importToRow, monthOf } from '../api/_sheetSchema.js';

const args = process.argv.slice(2);
const has = f => args.includes(f);
const COMMIT = has('--commit');
const TAKE_BLOB = has('--take-blob');
const KEEP_SHEET = has('--keep-sheet');
const userId = (args.find(a => a.startsWith('--user='))?.slice(7)) || process.env.SHEETS_USER_ID;

if (!userId) {
  console.error('No user id. Set SHEETS_USER_ID or pass --user=<id>.');
  process.exit(1);
}
if (TAKE_BLOB && KEEP_SHEET) {
  console.error('--take-blob and --keep-sheet are mutually exclusive.');
  process.exit(1);
}

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

const store = createStore(envClient());
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set — the Blob side cannot be read.');
  process.exit(1);
}

const prefix = `users/${userId}/`;
const say = (...a) => console.log(...a);
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;

// ── Blob reads ───────────────────────────────────────────────────────────────
async function blobIndex() {
  const out = new Map();
  let cursor;
  do {
    const page = await list({ prefix, cursor });
    for (const b of page.blobs) out.set(b.pathname, b);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function readBlob(blob) {
  const r = await fetch(blob.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
  if (!r.ok) throw new Error(`Blob fetch failed for ${blob.pathname}: ${r.status}`);
  return r.json();
}

// ── Field-level diff ─────────────────────────────────────────────────────────
// Walks two documents and reports differing leaves by path. Arrays compare by index; a length
// mismatch is reported once rather than as a cascade of per-index differences.
function diff(a, b, path = '', out = []) {
  const kind = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
  const ka = kind(a), kb = kind(b);
  if (ka !== kb) { out.push({ path: path || '(root)', blob: summarise(a), sheet: summarise(b) }); return out; }
  if (ka === 'array') {
    if (a.length !== b.length) out.push({ path: `${path}.length`, blob: a.length, sheet: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (ka === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diff(a[k], b[k], path ? `${path}.${k}` : k, out);
    }
    return out;
  }
  if (a !== b) out.push({ path: path || '(root)', blob: summarise(a), sheet: summarise(b) });
  return out;
}

function summarise(v) {
  if (v === undefined) return '(absent)';
  if (Array.isArray(v)) return `[${plural(v.length, 'item')}]`;
  if (v !== null && typeof v === 'object') return `{${Object.keys(v).length} keys}`;
  return JSON.stringify(v);
}

// ── Main ─────────────────────────────────────────────────────────────────────
say(`${COMMIT ? 'MIGRATING' : 'DRY RUN'} — Blob ${prefix}* → sheet\n`);

const index = await blobIndex();
if (!index.size) {
  say('No blobs under that prefix. Nothing to migrate.');
  process.exit(0);
}

// ── 1. Budget reconciliation ────────────────────────────────────────────────
let budgetAction = 'skip';
const budgetBlob = index.get(`${prefix}budget.json`);
say('── Budget ──');
if (!budgetBlob) {
  say('  No budget.json in Blob — leaving the sheet as it is.\n');
} else {
  const fromBlob = await readBlob(budgetBlob);
  const fromSheet = await store.getBudget();
  if (!fromSheet) {
    say('  The sheet has no budget yet, so there is nothing to reconcile — Blob will be written.');
    budgetAction = 'write';
  } else {
    // Normalise the Blob doc through the sheet schema first, so differences that are purely about
    // how the sheet represents data (generated ids, default colours, absent-vs-empty) don't show up
    // as drift. What's left is real disagreement about the numbers.
    const normalised = tablesToBudget(budgetToTables(fromBlob));
    const d = diff(normalised, fromSheet);
    if (!d.length) {
      say('  Blob and sheet agree. Nothing to do.');
    } else {
      say(`  ${plural(d.length, 'field')} differ (Blob normalised through the sheet schema first):\n`);
      for (const { path, blob, sheet } of d.slice(0, 40)) {
        say(`    ${path}\n        blob:  ${blob}\n        sheet: ${sheet}`);
      }
      if (d.length > 40) say(`    … and ${d.length - 40} more`);
      say('');
      if (TAKE_BLOB) { say('  --take-blob: the sheet\'s budget will be overwritten from Blob.'); budgetAction = 'write'; }
      else if (KEEP_SHEET) say('  --keep-sheet: leaving the sheet\'s budget as it is.');
      else {
        say('  Refusing to guess which side is right. Re-run with --take-blob or --keep-sheet.');
        say('  (Everything below still needs doing, so decide and re-run.)');
        process.exit(2);
      }
    }
  }
  say('');
}

// ── 2. Transactions ─────────────────────────────────────────────────────────
say('── Transactions ──');
const monthBlobs = [...index.entries()]
  .filter(([k]) => /transactions\/\d{4}-\d{2}\.json$/.test(k))
  .sort(([a], [b]) => a.localeCompare(b));

const docs = [];
for (const [key, blob] of monthBlobs) {
  const month = key.match(/(\d{4}-\d{2})\.json$/)[1];
  const doc = await readBlob(blob);
  const txns = Array.isArray(doc?.transactions) ? doc.transactions : [];
  docs.push({ ...doc, month, transactions: txns });
  say(`  ${month} → ${plural(txns.length, 'row')}${doc?.source ? ` (source: ${doc.source})` : ''}`);
}
if (!docs.length) say('  No transaction months in Blob.');
else say(`  ${plural(docs.length, 'month')}, ${plural(docs.reduce((n, d) => n + d.transactions.length, 0), 'row')} total.`);
say('');

// ── 3. Merchant rules ───────────────────────────────────────────────────────
say('── Other documents ──');
const rulesBlob = index.get(`${prefix}merchant-rules.json`);
const rules = rulesBlob ? await readBlob(rulesBlob) : null;
say(rules ? `  merchant-rules.json → ${plural(Array.isArray(rules) ? rules.length : 0, 'rule')}` : '  No merchant-rules.json.');
if (index.has(`${prefix}sync-status.json`)) say('  sync-status.json → skipped (bank sync was removed from the app).');
say('');

// ── Write ───────────────────────────────────────────────────────────────────
if (!COMMIT) {
  say('Dry run — nothing written. Re-run with --commit to apply.');
  process.exit(0);
}

if (budgetAction === 'write') {
  await store.saveBudget(await readBlob(budgetBlob));
  say('✓ Budget tabs written from Blob.');
}

if (docs.length) {
  // One read and one write for the whole history rather than per month: saveMonth would cost a
  // read+write round trip each, which burns through the Sheets per-minute write quota on a long
  // history and leaves the tabs half-migrated if it trips.
  const tabs = await store.readTabs(['Transactions', 'Imports']);
  const mine = new Set(docs.map(d => d.month));
  const txRows = tabs.Transactions.rows.filter(r => !mine.has(monthOf(r.Month)));
  const impRows = tabs.Imports.rows.filter(r => !mine.has(monthOf(r.Month)));
  for (const d of docs) {
    txRows.push(...txnsToRows(d.month, d.transactions));
    impRows.push(importToRow(d));
  }
  await store.writeTabs({ Transactions: txRows, Imports: impRows }, tabs);
  say(`✓ ${plural(docs.length, 'month')} written (${plural(txRows.length, 'row')} in Transactions).`);
}

if (rules) { await store.saveMerchantRules(Array.isArray(rules) ? rules : []); say('✓ Merchant rules written.'); }

say('\nDone. Reload the app and check the Transactions page.');

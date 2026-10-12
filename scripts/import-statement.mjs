#!/usr/bin/env node
// Import a month's bank-statement PDF: parse it, categorise it with LOCAL Ollama, check the balances,
// then merge it into the sheet's Transactions tab. Nothing is sent to a hosted LLM.
//   node --env-file=.env.local scripts/import-statement.mjs statement.pdf --account "Current account" [--dry-run] [--yes]
// Options: --model <tag> (default qwen3:4b-instruct)   --ollama <url> (default http://localhost:11434)
// Needs GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON (write access), and Ollama running:
//   1. In a separate terminal, run `ollama serve` and leave it open (skip if the Ollama app is already running).
//   2. `ollama pull qwen3:4b-instruct` (first time only).
//   3. In this terminal, run the command above — start with --dry-run to preview without writing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { clientFromEnv } from '../api/_sheets.js';
import { createStore } from '../api/_sheetStore.js';
import { extractRows, StatementError } from '../src/utils/statementParser.js';
import { categoriseStatement, reconcile } from '../src/utils/statementImport.js';
import { checkOllama, categorise, DEFAULT_MODEL, DEFAULT_OLLAMA_URL } from '../src/utils/ollamaClient.js';
import { mergeTransactions } from '../src/utils/mergeTransactions.js';

const die = msg => { console.error(msg); process.exit(1); };
const gbp = n => `${n < 0 ? '-' : '+'}£${Math.abs(n).toFixed(2)}`;

// ── args ──
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const dryRun = !!flag('dry-run'), yes = !!flag('yes');
const account = flag('account') || 'Current account';
const cfgFile = path.join(os.homedir(), '.config', 'nb-transactions', 'config.json');
let fileCfg = {}; try { fileCfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { /* optional */ }
const config = { url: flag('ollama') || fileCfg.ollamaUrl || DEFAULT_OLLAMA_URL, model: flag('model') || fileCfg.model || DEFAULT_MODEL };
const pdfPath = args[0];
if (!pdfPath) die('Usage: node --env-file=.env.local scripts/import-statement.mjs <statement.pdf> [--account "Name"] [--dry-run] [--yes]');

// ── read the PDF (pdf.js, locally) ──
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const fontDir = path.join(path.dirname(new URL(import.meta.resolve('pdfjs-dist/package.json')).pathname), 'standard_fonts') + '/';
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), standardFontDataUrl: fontDir }).promise;
const items = [];
for (let p = 1; p <= doc.numPages; p++) {
  const content = await (await doc.getPage(p)).getTextContent();
  for (const it of content.items) if (typeof it.str === 'string') items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: p });
}
let parsed;
try { parsed = extractRows(items); } catch (e) { die(e instanceof StatementError ? `✗ ${e.message}` : e.stack); }
if (parsed.months.length > 1) die(`✗ This statement covers ${parsed.months.join(' and ')}. Import one month at a time.`);
console.log(`Read ${parsed.rows.length} transactions for ${parsed.month}.`);

// ── sheet (custom merchant rules + existing month) ──
let store;
try { store = createStore(clientFromEnv()); } catch (e) { die(`${e.message}\nSet GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON, e.g. via --env-file=.env.local`); }
const customRules = await store.getMerchantRules();
const existing = await store.getMonth(parsed.month);

// Optional corrections from the older CLI: [{ description, from, to }]
let corrections = [];
try { const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'nb-transactions', 'corrections.json'), 'utf8')); if (Array.isArray(c)) corrections = c.filter(x => x?.description && x?.to); } catch { /* optional */ }

// ── Ollama ──
const health = await checkOllama(config);
if (health.status !== 'ok') die(`✗ ${health.message}`);
console.log(health.message);

const { transactions, stats } = await categoriseStatement(parsed, {
  account, customRules, corrections,
  categoriser: (rows, opts) => categorise(rows, { ...opts, config }),
  onProgress: (done, total) => process.stdout.write(`\rCategorising ${done}/${total} on-device…`),
});
if (stats.byModel) process.stdout.write('\n');

// ── report ──
const rec = reconcile(parsed.openingBalance, parsed.rows, parsed.closingBalance);
if (rec.ok === true) console.log(`✓ Balances match: £${parsed.openingBalance.toFixed(2)} → £${parsed.closingBalance.toFixed(2)}`);
else if (rec.ok === false) console.log(`⚠ £${Math.abs(rec.diff).toFixed(2)} unaccounted for${rec.firstMismatch ? ` (first noticed ${rec.firstMismatch.date})` : ''} — a row may be missing or misread.`);
else console.log('• No opening/closing balance found, totals not checked.');
console.log(`${stats.byCorrection + stats.byRule} by rules/corrections, ${stats.byModel} by the local model, ${stats.flagged} to double-check.\n`);
for (const t of [...transactions].sort((a, b) => Number(b.notes.startsWith('needs-review')) - Number(a.notes.startsWith('needs-review')))) {
  console.log(`${t.notes ? '?' : ' '} ${t.date}  ${gbp(t.amount).padStart(10)}  ${t.description.slice(0, 44).padEnd(44)}  ${t.category}`);
}

// ── save ──
const { merged, stats: m } = existing ? mergeTransactions(transactions, existing.transactions) : { merged: transactions, stats: null };
if (m) console.log(`\n${parsed.month} already has data: ${m.matched} matched (your categories kept), ${m.added} new, ${m.kept} kept.`);
if (dryRun) { console.log('\n--dry-run: nothing written.'); process.exit(0); }
if (!yes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`\nWrite ${merged.length} transactions to the sheet? [y/N] `)).trim().toLowerCase();
  rl.close();
  if (a !== 'y') die('Cancelled — nothing written.');
}
await store.saveMonth(parsed.month, { importedAt: new Date().toISOString(), source: 'statement-pdf', transactions: merged });
console.log(`✓ Saved ${merged.length} transactions for ${parsed.month}. Fix flagged rows (?) by editing the Category column in the sheet.`);

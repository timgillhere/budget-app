// Sheet-backed storage with the same document shapes the Blob endpoints serve.
// `client` needs batchGet(ranges)->values[][][], batchUpdate(data,input), batchClear(ranges)
// (SheetsClient in production, an in-memory fake in tests).
import {
  TABS, BUDGET_TABS, colLetter, headerCellValue,
  budgetToTables, tablesToBudget, isBudgetEmpty, validateBudget,
  txnsToRows, rowsToTxns, importToRow, rowToImport, monthOf,
  rulesToRows, rowsToRules,
} from './_sheetSchema.js';
import { quoteTab } from './_sheets.js';

const LAST_COL = 'ZZ';
const httpError = (status, message) => Object.assign(new Error(message), { status });

export function createStore(client) {
  // Read whole tabs -> { tab: { headers: string[], rows: Array<{header: cell}> } }
  async function readTabs(names) {
    const results = await client.batchGet(names.map(n => `${quoteTab(n)}!A1:${LAST_COL}`));
    const out = {};
    names.forEach((name, i) => {
      const grid = results[i] || [];
      const headers = (grid[0] || []).map(h => String(h ?? '').trim());
      const rows = grid.slice(1).map(cells => {
        const o = {};
        headers.forEach((h, c) => { if (h && cells[c] !== undefined) o[h] = cells[c]; });
        return o;
      });
      out[name] = { headers, rows };
    });
    return out;
  }

  // Replace the data rows of each tab. Only writes schema columns that aren't computed, in contiguous runs,
  // so formula columns and any extra columns the user added are never touched.
  async function writeTabs(map, current) {
    const names = Object.keys(map);
    const existing = current || await readTabs(names);
    const headerWrites = [];
    const writes = [];
    const clears = [];
    for (const name of names) {
      const { headers, rows: oldRows } = existing[name];
      const heads = [...headers];
      for (const c of TABS[name].cols) {
        if (c.computed) continue;
        if (!heads.includes(c.h)) { // column missing from the sheet: append it
          heads.push(c.h);
          headerWrites.push({ range: `${quoteTab(name)}!${colLetter(heads.length - 1)}1`, values: [[c.h]] });
        }
      }
      const idx = TABS[name].cols.filter(c => !c.computed).map(c => heads.indexOf(c.h)).sort((a, b) => a - b);
      const runs = [];
      for (const i of idx) {
        const last = runs[runs.length - 1];
        if (last && last[last.length - 1] === i - 1) last.push(i); else runs.push([i]);
      }
      const rows = map[name];
      for (const run of runs) {
        const a = colLetter(run[0]), b = colLetter(run[run.length - 1]);
        if (rows.length) {
          writes.push({
            range: `${quoteTab(name)}!${a}2:${b}${rows.length + 1}`,
            values: rows.map(r => run.map(i => (r[heads[i]] === undefined || r[heads[i]] === null ? '' : r[heads[i]]))),
          });
        }
        if (oldRows.length > rows.length) clears.push(`${quoteTab(name)}!${a}${rows.length + 2}:${b}`);
      }
    }
    await client.batchUpdate([...headerWrites, ...writes], 'RAW');
    await client.batchClear(clears);
  }

  const guard = async (fn, what) => {
    try { return await fn(); } catch (e) {
      if (/Unable to parse range/i.test(e.message)) throw httpError(500, `The sheet is missing a tab needed for ${what}. Run: node scripts/sheet-sync.mjs init`);
      throw e;
    }
  };

  return {
    readTabs, writeTabs,

    getBudget: () => guard(async () => {
      const tabs = await readTabs(BUDGET_TABS);
      const tables = Object.fromEntries(BUDGET_TABS.map(n => [n, tabs[n].rows]));
      return isBudgetEmpty(tables) ? null : tablesToBudget(tables);
    }, 'the budget'),

    saveBudget: (data) => guard(async () => {
      validateBudget(data);
      const t = budgetToTables(data);
      // Settings are keyed rows; the Settings tab has no schema paths, so rows are already header-keyed.
      await writeTabs(Object.fromEntries(BUDGET_TABS.map(n => [n, t[n] || []])));
    }, 'the budget'),

    getMerchantRules: () => guard(async () => {
      const { 'Merchant rules': t } = await readTabs(['Merchant rules']);
      return rowsToRules(t.rows);
    }, 'merchant rules'),

    saveMerchantRules: (rules) => guard(async () => {
      if (!Array.isArray(rules)) throw httpError(400, 'Request body must be an array of rules.');
      await writeTabs({ 'Merchant rules': rulesToRows(rules) });
    }, 'merchant rules'),

    getMonth: (month) => guard(async () => {
      const tabs = await readTabs(['Transactions', 'Imports']);
      const rows = tabs.Transactions.rows.filter(r => monthOf(r.Month) === month);
      const imp = tabs.Imports.rows.find(r => monthOf(r.Month) === month);
      if (!rows.length && !imp) return null;
      return { ...(imp ? rowToImport({ ...imp, Month: month }) : { month }), month, transactions: rowsToTxns(rows) };
    }, 'transactions'),

    saveMonth: (month, body) => guard(async () => {
      if (!body || typeof body !== 'object' || !Array.isArray(body.transactions)) throw httpError(400, 'Body must include a transactions array.');
      if (body.transactions.some(t => !t || typeof t !== 'object' || Array.isArray(t))) throw httpError(400, 'Each transaction must be an object.');
      const tabs = await readTabs(['Transactions', 'Imports']);
      const keepTx = tabs.Transactions.rows.filter(r => monthOf(r.Month) !== month);
      const keepImp = tabs.Imports.rows.filter(r => monthOf(r.Month) !== month);
      const mine = txnsToRows(month, body.transactions);
      const imp = importToRow({ ...body, month });
      await writeTabs({ Transactions: [...keepTx, ...mine], Imports: [...keepImp, imp] }, tabs);
    }, 'transactions'),

    // Shared by `sheet-sync check` and GET /api/budget?resource=data-source, so the CLI and the UI
    // can never disagree about whether the sheet is wired up correctly.
    async check() {
      const have = new Set((await client.tabs()).map(t => t.title));
      const present = Object.keys(TABS).filter(n => have.has(n));
      const tabs = present.length ? await readTabs(present) : {};
      const problems = [];
      for (const [name, def] of Object.entries(TABS)) {
        if (!have.has(name)) { problems.push({ tab: name, missing: 'tab' }); continue; }
        const columns = def.cols.filter(c => !c.computed && !tabs[name].headers.includes(c.h)).map(c => c.h);
        if (columns.length) problems.push({ tab: name, missing: 'columns', columns });
      }
      return { ok: problems.length === 0, problems };
    },

    // Used by `sheet-sync init`: create missing tabs, then write each schema header into the column it
    // already occupies, appending only the ones the sheet doesn't have yet. Writing the row positionally
    // would shuffle headers away from the data beneath them on a sheet whose columns have been reordered,
    // which the whole match-by-header-name design exists to allow. Safe to re-run.
    async init(extraTabs = []) {
      const have = new Set((await client.tabs()).map(t => t.title));
      const want = [...Object.keys(TABS), ...extraTabs];
      const missing = want.filter(n => !have.has(n));
      await client.structure(missing.map(n => ({ addSheet: { properties: { title: n, gridProperties: { frozenRowCount: 1 } } } })));

      // Lists is hand-maintained, but the Settings "Label" formula points into it, so its live
      // layout is read too when it exists.
      const names = Object.keys(TABS);
      const layoutNames = [...names, ...(have.has('Lists') || extraTabs.includes('Lists') ? ['Lists'] : [])];
      const live = await readTabs(layoutNames);
      const layouts = Object.fromEntries(layoutNames.map(n => [n, [...live[n].headers]]));

      // Settle every layout before building any formula, so cross-tab references see final positions.
      for (const [name, def] of Object.entries(TABS)) {
        for (const c of def.cols) if (!layouts[name].includes(c.h)) layouts[name].push(c.h);
      }
      const data = [];
      for (const [name, def] of Object.entries(TABS)) {
        for (const c of def.cols) {
          data.push({
            range: `${quoteTab(name)}!${colLetter(layouts[name].indexOf(c.h))}1`,
            values: [[headerCellValue(name, c, layouts)]],
          });
        }
      }
      await client.batchUpdate(data, 'USER_ENTERED');
    },
  };
}

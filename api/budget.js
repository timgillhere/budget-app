import { requireAuth } from './_auth.js';
import { clientForUser, sheetUrl } from './_sheets.js';
import { createStore } from './_sheetStore.js';

// Multiplexes the data resources onto one function:
//   /api/budget                          → user's budget document
//   /api/budget?resource=merchant-rules  → user's custom merchant rules
//   /api/budget?resource=data-source     → where the data lives + health (GET only)
//
// All of it lives in the user's Google Sheet. Postgres still holds users and sessions.
const RESOURCES = new Set(['budget', 'merchant-rules', 'data-source']);

export default async function handler(req, res) {
  const resource = req.query.resource;

  const user = await requireAuth(req, res);
  if (!user) return;

  // The app is read-only: only GET is served, and the sheet connection itself is read-only.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const name = resource == null ? 'budget' : resource;
  if (!RESOURCES.has(name)) {
    return res.status(400).json({ error: `Unknown resource "${resource}".` });
  }

  try {
    // Resolved per user, so a second account can never read or write the owner's sheet.
    const client = clientForUser(user);
    if (!client) return res.status(403).json({ error: 'This account has no data store.' });
    const store = createStore(client);

    if (name === 'data-source') {
      const { ok, problems } = await store.check();
      return res.status(200).json({ kind: 'google-sheet', ok, problems, spreadsheetId: client.id, url: sheetUrl(client.id) });
    }

    if (name === 'merchant-rules') return res.status(200).json(await store.getMerchantRules());
    return res.status(200).json(await store.getBudget());
  } catch (err) {
    console.error('[sheets]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

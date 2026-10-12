import { requireAuth } from './_auth.js';
import { clientForUser } from './_sheets.js';
import { createStore } from './_sheetStore.js';

// One month of transactions, stored as rows in the sheet's Transactions tab (plus one Imports row).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Missing or invalid month parameter (expected YYYY-MM)' });
  }

  try {
    const client = clientForUser(user);
    if (!client) return res.status(403).json({ error: 'This account has no data store.' });
    const store = createStore(client);

    return res.status(200).json(await store.getMonth(month));
  } catch (err) {
    console.error('[sheets]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

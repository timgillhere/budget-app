import { list, put } from '@vercel/blob';
import { requireAuthOrToken } from './_auth.js';
import { clientFromEnv, sheetsEnabledFor } from './_sheets.js';
import { createStore } from './_sheetStore.js';

export default async function handler(req, res) {
  const user = await requireAuthOrToken(req, res);
  if (!user) return;

  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Missing or invalid month parameter (expected YYYY-MM)' });
  }

  if (sheetsEnabledFor(user)) {
    try {
      const store = createStore(clientFromEnv());
      if (req.method === 'GET') return res.status(200).json(await store.getMonth(month));
      if (req.method === 'POST') { await store.saveMonth(month, req.body); return res.status(200).json({ ok: true }); }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error('[sheets]', err.message);
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  const blobKey = `users/${user.userId}/transactions/${month}.json`;

  if (req.method === 'GET') {
    try {
      const blobs = await list({ prefix: blobKey });
      // Exact match only — never return a blob for a different user
      const blob = blobs.blobs.find(b => b.pathname === blobKey);
      if (!blob) {
        return res.status(200).json(null);
      }
      const response = await fetch(blob.url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      await put(blobKey, JSON.stringify(req.body, null, 2), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

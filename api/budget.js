import { list, put } from '@vercel/blob';
import { requireAuth } from './_auth.js';

// Handles two resources to stay within Vercel Hobby's 12-function limit:
//   /api/budget                      → user's budget JSON
//   /api/budget?resource=merchant-rules → user's custom merchant rules array

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const isMerchantRules = req.query.resource === 'merchant-rules';
  const blobKey = isMerchantRules
    ? `users/${user.userId}/merchant-rules.json`
    : `users/${user.userId}/budget.json`;

  if (req.method === 'GET') {
    try {
      const blobs = await list({ prefix: blobKey });
      const blob = blobs.blobs.find(b => b.pathname === blobKey);
      if (!blob) {
        return res.status(200).json(isMerchantRules ? [] : null);
      }
      const response = await fetch(blob.url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      const data = await response.json();
      if (isMerchantRules) {
        return res.status(200).json(Array.isArray(data) ? data : []);
      }
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      if (isMerchantRules && !Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Request body must be an array of rules.' });
      }
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

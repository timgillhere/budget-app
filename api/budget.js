import { list, put } from '@vercel/blob';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const blobKey = `budget-${user.userId}.json`;

  if (req.method === 'GET') {
    try {
      const blobs = await list({ prefix: blobKey });
      if (blobs.blobs.length === 0) {
        return res.status(200).json(null);
      }
      const response = await fetch(blobs.blobs[0].url);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      await put(blobKey, JSON.stringify(req.body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

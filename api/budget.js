import { list, put } from '@vercel/blob';
import { requireAuth } from './_auth.js';

// Multiplexes several resources onto one function to stay within Vercel Hobby's 12-function limit:
//   /api/budget                          → user's budget JSON
//   /api/budget?resource=merchant-rules  → user's custom merchant rules

// Blob-backed resources: file name + the value returned when the blob is absent.
const BLOB_RESOURCES = {
  'merchant-rules': { file: 'merchant-rules.json', empty: [] },
  budget:           { file: 'budget.json',         empty: null },
};

export default async function handler(req, res) {
  const resource = req.query.resource;

  const user = await requireAuth(req, res);
  if (!user) return;

  // An unrecognised resource must never fall through to the budget blob — a POST would
  // overwrite the user's budget with whatever that other resource's payload happened to be.
  const spec = resource == null ? BLOB_RESOURCES.budget : BLOB_RESOURCES[resource];
  if (!spec) {
    return res.status(400).json({ error: `Unknown resource "${resource}".` });
  }
  const blobKey = `users/${user.userId}/${spec.file}`;

  if (req.method === 'GET') {
    try {
      const blobs = await list({ prefix: blobKey });
      const blob = blobs.blobs.find(b => b.pathname === blobKey);
      if (!blob) {
        return res.status(200).json(spec.empty);
      }
      const response = await fetch(blob.url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      const data = await response.json();
      if (resource === 'merchant-rules') {
        return res.status(200).json(Array.isArray(data) ? data : []);
      }
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      if (resource === 'merchant-rules' && !Array.isArray(req.body)) {
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

import { list, put } from '@vercel/blob';
import { requireAuth, requireAuthOrToken, generateSyncToken, hashSyncToken } from './_auth.js';
import { getPool } from './_db.js';

// Multiplexes several resources onto one function to stay within Vercel Hobby's 12-function limit:
//   /api/budget                          → user's budget JSON            (browser or sync token)
//   /api/budget?resource=merchant-rules  → user's custom merchant rules  (browser or sync token)
//   /api/budget?resource=sync-status     → bank-sync agent status blob   (browser or sync token)
//   /api/budget?resource=sync-token      → manage bank-sync bearer tokens (browser + MFA only)

// Blob-backed resources: file name + the value returned when the blob is absent.
const BLOB_RESOURCES = {
  'merchant-rules': { file: 'merchant-rules.json', empty: [] },
  'sync-status':    { file: 'sync-status.json',    empty: null },
  budget:           { file: 'budget.json',         empty: null },
};

export default async function handler(req, res) {
  const resource = req.query.resource;

  // Token management must never be reachable via a sync token itself — full browser auth only.
  if (resource === 'sync-token') {
    return handleSyncToken(req, res);
  }

  const user = await requireAuthOrToken(req, res);
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

// Create / list / revoke long-lived bearer tokens for the local bank-sync agent.
async function handleSyncToken(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const pool = getPool();

  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query(
        'SELECT id, name, created_at, last_used_at FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC',
        [user.userId]
      );
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const token = generateSyncToken();
      const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || 'Bank sync';
      const { rows } = await pool.query(
        'INSERT INTO api_tokens (user_id, token_hash, name) VALUES ($1, $2, $3) RETURNING id, name, created_at',
        [user.userId, hashSyncToken(token), name]
      );
      // Plaintext is returned exactly once and never stored.
      return res.status(200).json({ ...rows[0], token });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing token id' });
      await pool.query('DELETE FROM api_tokens WHERE id = $1 AND user_id = $2', [id, user.userId]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

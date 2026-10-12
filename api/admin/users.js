import { requireAdmin } from '../_auth.js';
import { getPool } from '../_db.js';

// GET    — list users
// POST   — add a user { email, name } — they can then sign in with the Google account for that email
// DELETE — ?id=<userId> — remove a user and end their sessions (their budget data in Blob is kept)
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const pool = getPool();

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      `SELECT id, name, email, is_admin, (google_sub IS NOT NULL) AS has_signed_in
       FROM users ORDER BY created_at`
    );
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!name) return res.status(400).json({ error: 'Enter a name' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (email, name, is_admin) VALUES ($1, $2, false)
         RETURNING id, name, email, is_admin, false AS has_signed_in`,
        [email, name]
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That email is already a user' });
      return res.status(500).json({ error: 'Failed to add user' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing user id' });
    if (id === admin.userId) return res.status(400).json({ error: "You can't remove yourself" });
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

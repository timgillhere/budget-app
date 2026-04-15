import bcrypt from 'bcryptjs';
import { requireAdmin } from '../_auth.js';
import { getPool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const pool = getPool();

  // GET — list all users
  if (req.method === 'GET') {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email,
              (t.id IS NOT NULL AND t.enabled) AS mfa_enabled
       FROM users u
       LEFT JOIN totp_credentials t ON t.user_id = u.id
       ORDER BY u.created_at`
    );
    return res.status(200).json(rows);
  }

  // PATCH — admin emergency password override
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [await bcrypt.hash(newPassword, 10), userId]
  );

  if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
  return res.status(200).json({ ok: true });
}

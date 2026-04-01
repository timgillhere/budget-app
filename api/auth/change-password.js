import bcrypt from 'bcryptjs';
import { requireAuth } from '../_auth.js';
import { getPool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [user.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const passwordOk = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.userId]);

  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [user.userId, 'password_change']
  ).catch(() => {});

  return res.status(200).json({ ok: true });
}

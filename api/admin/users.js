import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../_auth.js';
import { getPool } from '../_db.js';
import { sendInviteEmail, sendPasswordResetEmail } from '../_email.js';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const pool = getPool();

  // GET — list all users
  if (req.method === 'GET') {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email,
              (u.password_hash IS NULL) AS pending,
              (t.id IS NOT NULL AND t.enabled) AS mfa_enabled
       FROM users u
       LEFT JOIN totp_credentials t ON t.user_id = u.id
       ORDER BY u.created_at`
    );
    return res.status(200).json(rows);
  }

  // POST — invite a new user (creates account + sends invite email)
  if (req.method === 'POST') {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let userId;
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (email, name, password_hash, is_admin)
         VALUES ($1, $2, NULL, false)
         RETURNING id`,
        [normalizedEmail, name.trim()]
      );
      userId = rows[0].id;
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }
      return res.status(500).json({ error: `Failed to create user: ${err.message}` });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'invite', NOW() + INTERVAL '7 days')`,
      [userId, tokenHash]
    );

    try {
      await sendInviteEmail(normalizedEmail, name.trim(), rawToken);
    } catch {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      return res.status(500).json({ error: 'Failed to send invite email. Check RESEND_API_KEY and FROM_EMAIL.' });
    }

    return res.status(201).json({ ok: true, email: normalizedEmail });
  }

  // PATCH — actions on existing users
  const { userId, newPassword, action } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { rows: userRows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
  if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = userRows[0];

  if (action === 'sendReset') {
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND type = 'reset' AND used_at IS NULL`,
      [userId]
    );
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'reset', NOW() + INTERVAL '1 hour')`,
      [userId, tokenHash]
    );
    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch {
      return res.status(500).json({ error: 'Failed to send reset email' });
    }
    return res.status(200).json({ ok: true });
  }

  if (action === 'resendInvite') {
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND type = 'invite' AND used_at IS NULL`,
      [userId]
    );
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'invite', NOW() + INTERVAL '7 days')`,
      [userId, tokenHash]
    );
    try {
      await sendInviteEmail(user.email, user.name, rawToken);
    } catch {
      return res.status(500).json({ error: 'Failed to send invite email' });
    }
    return res.status(200).json({ ok: true });
  }

  // Default: direct password override (admin emergency)
  if (!newPassword) return res.status(400).json({ error: 'newPassword or action required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
  return res.status(200).json({ ok: true });
}

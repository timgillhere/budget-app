import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../_db.js';
import { sendPasswordResetEmail } from '../_email.js';
import { checkRateLimit } from '../_rateLimit.js';

export default async function handler(req, res) {
  // GET /api/auth/password-reset?token=xxx  — validate a token
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(200).json({ valid: false, reason: 'No token provided' });

    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await pool.query(
      `SELECT t.type, u.email, u.name
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1
         AND t.used_at IS NULL
         AND t.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(200).json({ valid: false, reason: 'This link is invalid or has expired.' });
    }

    return res.status(200).json({
      valid: true,
      type: rows[0].type,
      email: rows[0].email,
      name: rows[0].name,
    });
  }

  // POST — two actions: 'forgot' and 'set'
  if (req.method === 'POST') {
    const { action } = req.body;

    // POST { action: 'forgot', email }  — send a password reset email
    if (action === 'forgot') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const pool = getPool();
      const normalizedEmail = email.toLowerCase().trim();

      // Rate limit: 3 requests per email per hour
      const limited = await checkRateLimit(`forgot:${normalizedEmail}`, 3, 60 * 60 * 1000);
      if (limited) return res.status(200).json({ ok: true }); // silent — prevents enumeration

      const { rows } = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND password_hash IS NOT NULL',
        [normalizedEmail]
      );

      if (rows.length === 0) return res.status(200).json({ ok: true }); // silent — prevents enumeration

      const userId = rows[0].id;

      // Invalidate any existing unused reset tokens
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
        await sendPasswordResetEmail(normalizedEmail, rawToken);
      } catch { /* swallow — don't expose internals */ }

      return res.status(200).json({ ok: true });
    }

    // POST { action: 'set', token, password }  — set the new password
    if (action === 'set') {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const pool = getPool();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const { rows } = await pool.query(
        `SELECT t.id, t.user_id, t.type
         FROM password_reset_tokens t
         WHERE t.token_hash = $1
           AND t.used_at IS NULL
           AND t.expires_at > NOW()`,
        [tokenHash]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'This link is invalid or has expired. Please request a new one.' });
      }

      const { id: tokenId, user_id: userId, type } = rows[0];
      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query('BEGIN');
      try {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
        await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
        if (type === 'reset') {
          await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
        }
        await pool.query('COMMIT');
      } catch {
        await pool.query('ROLLBACK');
        return res.status(500).json({ error: 'Failed to set password' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

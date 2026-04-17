import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { requireAuth } from '../_auth.js';
import { getPool } from '../_db.js';
import { decryptTotpSecret } from '../_crypto.js';

authenticator.options = { window: 1 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { currentPassword, totpCode } = req.body;
  if (!currentPassword || !totpCode) {
    return res.status(400).json({ error: 'currentPassword and totpCode required' });
  }

  const pool = getPool();

  // Verify current password
  const { rows: userRows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [user.userId]
  );
  if (userRows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const passwordOk = await bcrypt.compare(currentPassword, userRows[0].password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Verify TOTP
  const { rows: totpRows } = await pool.query(
    'SELECT encrypted_secret FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [user.userId]
  );
  if (totpRows.length === 0) {
    return res.status(400).json({ error: 'MFA is not enabled' });
  }

  const secret = decryptTotpSecret(totpRows[0].encrypted_secret);
  if (!authenticator.verify({ token: totpCode.replace(/\s/g, ''), secret })) {
    return res.status(401).json({ error: 'Invalid TOTP code' });
  }

  // Disable MFA and delete backup codes
  await pool.query('DELETE FROM totp_credentials WHERE user_id = $1', [user.userId]);
  await pool.query('DELETE FROM backup_codes WHERE user_id = $1', [user.userId]);

  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [user.userId, 'mfa_disabled']
  ).catch(() => {});

  return res.status(200).json({ ok: true });
}

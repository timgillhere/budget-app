import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import { requireAuth } from '../_auth.js';
import { getPool } from '../_db.js';
import { decryptTotpSecret } from '../_crypto.js';

authenticator.options = { window: 1 };

function generateBackupCode() {
  // Format: xxxxx-xxxxx (10 hex chars split in two)
  const hex = randomBytes(5).toString('hex');
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'code required' });
  }

  const pool = getPool();

  // Get the pending (not yet enabled) TOTP secret
  const { rows } = await pool.query(
    'SELECT id, encrypted_secret, enabled FROM totp_credentials WHERE user_id = $1',
    [user.userId]
  );

  if (rows.length === 0) {
    return res.status(400).json({ error: 'No pending TOTP setup. Call mfa-setup-start first.' });
  }

  const secret = decryptTotpSecret(rows[0].encrypted_secret);
  const cleanCode = code.replace(/\s/g, '');

  if (!authenticator.verify({ token: cleanCode, secret })) {
    return res.status(401).json({ error: 'Invalid code — please check the time on your device and try again.' });
  }

  // Enable TOTP
  await pool.query(
    'UPDATE totp_credentials SET enabled = true WHERE user_id = $1',
    [user.userId]
  );

  // Generate 10 backup codes, deleting any old ones first
  await pool.query('DELETE FROM backup_codes WHERE user_id = $1', [user.userId]);

  const plainCodes = [];
  for (let i = 0; i < 10; i++) {
    const code = generateBackupCode();
    plainCodes.push(code);
    const hash = await bcrypt.hash(code, 10);
    await pool.query(
      'INSERT INTO backup_codes (user_id, code_hash) VALUES ($1, $2)',
      [user.userId, hash]
    );
  }

  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [user.userId, 'mfa_enabled']
  ).catch(() => {});

  return res.status(200).json({ backupCodes: plainCodes });
}

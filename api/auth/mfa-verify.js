import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { parse as parseCookies } from 'cookie';
import { authenticator } from 'otplib';
import { getPool } from '../_db.js';
import { decryptTotpSecret } from '../_crypto.js';
import { setSessionCookie } from '../_auth.js';

authenticator.options = { window: 1 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'code required' });
  }

  // Parse the pre-auth cookie (mfaVerified: false)
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'No session' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  if (payload.mfaVerified) {
    return res.status(400).json({ error: 'Already verified' });
  }

  const pool = getPool();

  // Rate limit: 5 MFA attempts per session
  const rateLimitKey = `mfa:${payload.sessionId}`;
  const rl = await pool.query(
    `INSERT INTO rate_limit_login (key, attempts, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       attempts     = rate_limit_login.attempts + 1,
       window_start = rate_limit_login.window_start
     RETURNING attempts`,
    [rateLimitKey]
  );
  if (rl.rows[0].attempts > 5) {
    return res.status(429).json({ error: 'Too many MFA attempts. Please log in again.' });
  }

  // Try TOTP first
  const { rows: totpRows } = await pool.query(
    'SELECT encrypted_secret FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [payload.userId]
  );

  if (totpRows.length > 0) {
    const secret = decryptTotpSecret(totpRows[0].encrypted_secret);
    const cleanCode = code.replace(/\s/g, '');

    if (authenticator.verify({ token: cleanCode, secret })) {
      return issueFullSession(res, pool, payload, 'mfa_ok');
    }
  }

  // Try backup codes
  const { rows: codeRows } = await pool.query(
    'SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used_at IS NULL',
    [payload.userId]
  );

  for (const row of codeRows) {
    const match = await bcrypt.compare(code.trim(), row.code_hash);
    if (match) {
      await pool.query('UPDATE backup_codes SET used_at = NOW() WHERE id = $1', [row.id]);
      pool.query(
        'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
        [payload.userId, 'backup_code_used']
      ).catch(() => {});
      return issueFullSession(res, pool, payload, 'mfa_ok');
    }
  }

  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [payload.userId, 'mfa_fail']
  ).catch(() => {});
  return res.status(401).json({ error: 'Invalid code' });
}

async function issueFullSession(res, pool, payload, eventType) {
  // Re-sign the same session with mfaVerified: true
  const newToken = jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      isAdmin: payload.isAdmin,
      mfaVerified: true,
      sessionId: payload.sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  setSessionCookie(res, newToken);
  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [payload.userId, eventType]
  ).catch(() => {});

  return res.status(200).json({ status: 'ok' });
}

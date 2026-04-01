import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from './_db.js';
import { checkRateLimit } from './_rateLimit.js';
import { setSessionCookie } from './_auth.js';

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0] : req.socket?.remoteAddress || 'unknown').trim();
}

async function logEvent(pool, userId, eventType, ip) {
  pool.query(
    'INSERT INTO auth_events (user_id, event_type, ip_address) VALUES ($1, $2, $3)',
    [userId || null, eventType, ip]
  ).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const ip = getClientIp(req);
  const pool = getPool();

  // Rate limiting: 10 attempts per IP per 15 minutes
  const limited = await checkRateLimit(`ip:${ip}`);
  if (limited) {
    return res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes.' });
  }

  // Look up user in Postgres
  let user = null;
  const { rows } = await pool.query(
    'SELECT id, email, name, password_hash, is_admin FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  if (rows.length > 0) {
    user = rows[0];
  }

  // Check password
  let passwordOk = false;
  if (user) {
    passwordOk = await bcrypt.compare(password, user.password_hash);
  } else if (
    email === process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD_HASH &&
    (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH))
  ) {
    // Bootstrap admin via env vars (used before migration or as fallback)
    passwordOk = true;
    user = {
      id: 'bootstrap-admin',
      email: process.env.ADMIN_EMAIL,
      name: process.env.ADMIN_NAME || 'Admin',
      is_admin: true,
    };
  }

  if (!passwordOk || !user) {
    await logEvent(pool, null, 'login_fail', ip);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Check if user has MFA enabled (skip for bootstrap admin)
  let hasMfa = false;
  if (user.id !== 'bootstrap-admin') {
    const mfaRows = await pool.query(
      'SELECT id FROM totp_credentials WHERE user_id = $1 AND enabled = true',
      [user.id]
    );
    hasMfa = mfaRows.rows.length > 0;
  }

  // Create session row (skip for bootstrap admin)
  let sessionId = 'bootstrap-session';
  if (user.id !== 'bootstrap-admin') {
    const sessionRes = await pool.query(
      "INSERT INTO sessions (user_id, expires_at) VALUES ($1, NOW() + INTERVAL '1 hour') RETURNING id",
      [user.id]
    );
    sessionId = sessionRes.rows[0].id;
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.is_admin,
      mfaVerified: !hasMfa,
      sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  setSessionCookie(res, token);
  await logEvent(pool, user.id !== 'bootstrap-admin' ? user.id : null, 'login_ok', ip);

  return res.status(200).json({ status: hasMfa ? 'mfa_required' : 'ok' });
}

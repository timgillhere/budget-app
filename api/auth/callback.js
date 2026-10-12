import crypto from 'crypto';
import { getPool } from '../_db.js';
import { appendSetCookie, createSession, getCookie, getClientIp, logAuthEvent } from '../_auth.js';
import { FLOW_COOKIE, clearFlowCookie, exchangeCode, readFlowCookie } from '../_google.js';

// GET /api/auth/callback — Google redirects here after the user signs in.
// Only people already in the users table (added by an admin) can sign in; the one exception is
// ADMIN_EMAIL, which is created as an admin on first sign-in so a fresh deployment can bootstrap.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  res.setHeader('Cache-Control', 'no-store');
  appendSetCookie(res, clearFlowCookie());

  const fail = (code, userId = null) => {
    logAuthEvent(userId, 'login_fail', ip);
    res.setHeader('Location', `/?auth_error=${code}`);
    return res.status(302).end();
  };

  const { code, state, error } = req.query;
  if (error) return fail(error === 'access_denied' ? 'cancelled' : 'google_error');

  const flow = readFlowCookie(getCookie(req, FLOW_COOKIE) || '');
  if (!flow || !code || typeof state !== 'string' || !timingSafeEqual(state, flow.state)) {
    return fail('state_mismatch');
  }

  let identity;
  try {
    identity = await exchangeCode(code, flow.verifier, flow.origin);
  } catch {
    return fail('google_error');
  }
  if (!identity.emailVerified || !identity.email) return fail('email_unverified');

  const user = await findOrLinkUser(identity);
  if (!user) return fail('not_invited');

  await createSession(res, user.id);
  logAuthEvent(user.id, 'login_ok', ip);
  res.setHeader('Location', '/');
  return res.status(302).end();
}

async function findOrLinkUser({ sub, email, name }) {
  const pool = getPool();

  // Returning user: matched by Google's stable account ID, so a changed email still works.
  const bySub = await pool.query('SELECT id FROM users WHERE google_sub = $1', [sub]);
  if (bySub.rows.length) return bySub.rows[0];

  // First Google sign-in for an existing/invited user: link the Google account by email.
  const linked = await pool.query(
    'UPDATE users SET google_sub = $1 WHERE email = $2 AND google_sub IS NULL RETURNING id',
    [sub, email]
  );
  if (linked.rows.length) return linked.rows[0];

  // Bootstrap: the admin named in env vars is created on their first sign-in.
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (adminEmail && email === adminEmail) {
    const created = await pool.query(
      `INSERT INTO users (email, name, google_sub, is_admin) VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [email, process.env.ADMIN_NAME || name || 'Admin', sub]
    );
    if (created.rows.length) return created.rows[0];
  }

  return null;
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

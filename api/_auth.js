import crypto from 'crypto';
import { parse as parseCookies } from 'cookie';
import { getPool } from './_db.js';

// ── Session cookie ────────────────────────────────────────────────────────
// The cookie holds only an opaque random ID — no user data, nothing to decode.
// The server stores just its SHA-256 hash, so a database leak yields no usable sessions.
// `__Host-` makes the browser reject the cookie unless it is Secure, Path=/ and has no
// Domain, so it can't be set or read by any other subdomain.
const SESSION_COOKIE = '__Host-session';
const SESSION_IDLE = "INTERVAL '1 hour'";   // sliding: extended on every authenticated request
const SESSION_MAX = "INTERVAL '7 days'";   // absolute cap, regardless of activity
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getCookie(req, name) {
  return parseCookies(req.headers.cookie || '')[name] || null;
}

// Appends rather than overwrites, so one response can set and clear several cookies.
export function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

function setSessionCookie(res, token) {
  appendSetCookie(res,
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );
}

export function clearSessionCookie(res) {
  appendSetCookie(res, `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await getPool().query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ${SESSION_IDLE})`,
    [userId, hashToken(token)]
  );
  setSessionCookie(res, token);
}

// Deletes the session behind the request's cookie. With `everywhere`, deletes all of that user's sessions.
export async function destroySession(req, { everywhere = false } = {}) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const pool = getPool();
  const { rows } = await pool.query(
    'DELETE FROM sessions WHERE token_hash = $1 RETURNING user_id',
    [hashToken(token)]
  );
  const userId = rows[0]?.user_id || null;
  if (userId && everywhere) {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
  return userId;
}

// Returns { userId, email, name, isAdmin } for a live session, or null.
export async function getSession(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT s.id AS session_id, u.id, u.email, u.name, u.is_admin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
        AND s.created_at > NOW() - ${SESSION_MAX}`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  const row = rows[0];

  // Touch session (fire-and-forget)
  pool.query(`UPDATE sessions SET expires_at = NOW() + ${SESSION_IDLE} WHERE id = $1`, [row.session_id])
    .catch(() => {});

  return { userId: row.id, email: row.email, name: row.name, isAdmin: row.is_admin };
}

export async function requireAuth(req, res) {
  const user = await getSession(req);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0] : req.socket?.remoteAddress || 'unknown').trim();
}

export function logAuthEvent(userId, eventType, ip) {
  getPool().query(
    'INSERT INTO auth_events (user_id, event_type, ip_address) VALUES ($1, $2, $3)',
    [userId || null, eventType, ip || null]
  ).catch(() => {});
}

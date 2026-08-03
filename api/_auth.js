import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { parse as parseCookies } from 'cookie';
import { getPool } from './_db.js';

// Sync tokens are stored only as their SHA-256 hash. Prefix makes them recognisable.
export const SYNC_TOKEN_PREFIX = 'nbsync_';
export function hashSyncToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function generateSyncToken() {
  return SYNC_TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
}

function getTokenFromCookie(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.session || null;
}

export function verifyToken(req) {
  const token = getTokenFromCookie(req);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  const maxAge = 60 * 60; // 1 hour
  const secure = process.env.NODE_ENV !== 'development' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `session=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );
}

// Full auth: requires valid session row + mfaVerified=true (or no MFA enabled for user)
export async function requireAuth(req, res) {
  const payload = verifyToken(req);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const pool = getPool();

  // Session revocation check (bypass for bootstrap admin — no DB row exists)
  if (payload.sessionId !== 'bootstrap-session') {
    const { rows } = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [payload.sessionId]
    );
    if (rows.length === 0) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Session expired' });
      return null;
    }
  }

  if (!payload.mfaVerified) {
    res.status(403).json({ error: 'MFA verification required' });
    return null;
  }

  // Touch session (fire-and-forget)
  pool.query('UPDATE sessions SET expires_at = NOW() + INTERVAL \'1 hour\' WHERE id = $1', [payload.sessionId])
    .catch(() => {});

  return payload;
}

// Auth for endpoints a non-browser client (the bank-sync agent) must reach.
// Accepts an `Authorization: Bearer <sync-token>` (bypasses session/MFA by design —
// the token is pre-authorized and revocable), otherwise falls back to full browser auth.
export async function requireAuthOrToken(req, res) {
  const authz = req.headers.authorization || '';
  if (authz.startsWith('Bearer ')) {
    const token = authz.slice(7).trim();
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, user_id FROM api_tokens WHERE token_hash = $1',
      [hashSyncToken(token)]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid sync token' });
      return null;
    }
    // Touch last_used_at (fire-and-forget)
    pool.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});
    return { userId: rows[0].user_id, viaToken: true };
  }
  return requireAuth(req, res);
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

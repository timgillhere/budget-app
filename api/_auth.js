import jwt from 'jsonwebtoken';
import { parse as parseCookies } from 'cookie';
import { getPool } from './_db.js';

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

  // Session revocation check
  const { rows } = await pool.query(
    'SELECT id FROM sessions WHERE id = $1 AND expires_at > NOW()',
    [payload.sessionId]
  );
  if (rows.length === 0) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Session expired' });
    return null;
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

export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

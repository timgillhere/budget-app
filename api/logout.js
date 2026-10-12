import { clearSessionCookie, destroySession, getClientIp, logAuthEvent } from './_auth.js';

// POST /api/logout          — ends this session
// POST /api/logout?all=1    — ends every session for this user (all devices)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const everywhere = req.query.all === '1';
  try {
    const userId = await destroySession(req, { everywhere });
    if (userId) logAuthEvent(userId, everywhere ? 'logout_all' : 'logout', getClientIp(req));
  } catch {
    // Still clear the cookie even if the DB is unreachable
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

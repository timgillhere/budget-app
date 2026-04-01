import jwt from 'jsonwebtoken';
import { parse as parseCookies } from 'cookie';
import { getPool } from './_db.js';
import { clearSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;

  if (token) {
    try {
      // Decode without verification so we can delete the session even with an expired token
      const payload = jwt.decode(token);
      if (payload?.sessionId && payload.sessionId !== 'bootstrap-session') {
        const pool = getPool();
        await pool.query('DELETE FROM sessions WHERE id = $1', [payload.sessionId]);
        if (payload.userId) {
          pool.query(
            'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
            [payload.userId, 'logout']
          ).catch(() => {});
        }
      }
    } catch {
      // Ignore decode errors — still clear the cookie
    }
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

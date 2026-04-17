import { verifyToken } from '../_auth.js';
import { getPool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Session revocation check
  if (payload.sessionId !== 'bootstrap-session') {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [payload.sessionId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Check if user has MFA enabled
    const mfaRows = await pool.query(
      'SELECT id FROM totp_credentials WHERE user_id = $1 AND enabled = true',
      [payload.userId]
    );
    const mfaEnabled = mfaRows.rows.length > 0;

    return res.status(200).json({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      isAdmin: payload.isAdmin,
      mfaVerified: payload.mfaVerified,
      mfaEnabled,
    });
  }

  // Bootstrap admin has no session row
  return res.status(200).json({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    isAdmin: payload.isAdmin,
    mfaVerified: payload.mfaVerified,
    mfaEnabled: false,
  });
}

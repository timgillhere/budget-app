import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { requireAuth } from '../_auth.js';
import { getPool } from '../_db.js';

function generateBackupCode() {
  const hex = randomBytes(5).toString('hex');
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { currentPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'currentPassword required' });
  }

  const pool = getPool();

  // Verify current password
  const { rows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [user.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const passwordOk = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Check MFA is enabled
  const { rows: mfaRows } = await pool.query(
    'SELECT id FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [user.userId]
  );
  if (mfaRows.length === 0) {
    return res.status(400).json({ error: 'MFA is not enabled' });
  }

  // Delete old codes and generate 10 new ones
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

  return res.status(200).json({ backupCodes: plainCodes });
}

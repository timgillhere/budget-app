import { authenticator } from 'otplib';
import { requireAuth } from '../_auth.js';
import { getPool } from '../_db.js';
import { encryptTotpSecret } from '../_crypto.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const secret = authenticator.generateSecret();
  const appName = process.env.AUTH_RP_NAME || "Tim's Budget";
  const otpauthUrl = authenticator.keyuri(user.email, appName, secret);

  const encryptedSecret = encryptTotpSecret(secret);
  const pool = getPool();

  // Upsert: overwrite any pending (not-yet-enabled) secret
  await pool.query(
    `INSERT INTO totp_credentials (user_id, encrypted_secret, enabled)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id) DO UPDATE SET
       encrypted_secret = $2,
       enabled = CASE WHEN totp_credentials.enabled THEN totp_credentials.enabled ELSE false END`,
    [user.userId, encryptedSecret]
  );

  return res.status(200).json({ otpauthUrl });
}

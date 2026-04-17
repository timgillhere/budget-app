// Catch-all for all /api/auth/* routes.
// Vercel passes path segments as req.query.path (string array).
// Consolidates 7 individual files into 1 function to stay within
// the Vercel Hobby plan's 12-function limit.

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { parse as parseCookies } from 'cookie';
import { authenticator } from 'otplib';
import { requireAuth, verifyToken, setSessionCookie } from '../_auth.js';
import { getPool } from '../_db.js';
import { encryptTotpSecret, decryptTotpSecret } from '../_crypto.js';
import { checkRateLimit } from '../_rateLimit.js';

authenticator.options = { window: 1 };

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean)
  const route = segments.join('/')

  switch (route) {
    case 'me':                  return handleMe(req, res)
    case 'change-password':     return handleChangePassword(req, res)
    case 'mfa-setup':           return handleMfaSetup(req, res)
    case 'mfa-verify':          return handleMfaVerify(req, res)
    case 'mfa-disable':         return handleMfaDisable(req, res)
    case 'backup-codes-regen':  return handleBackupCodesRegen(req, res)
    case 'password-reset':      return handlePasswordReset(req, res)
    default:                    return res.status(404).json({ error: 'Not found' })
  }
}

// ── /api/auth/me ──────────────────────────────────────────────────────────────

async function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const payload = verifyToken(req)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  if (payload.sessionId !== 'bootstrap-session') {
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [payload.sessionId]
    )
    if (rows.length === 0) return res.status(401).json({ error: 'Session expired' })

    const mfaRows = await pool.query(
      'SELECT id FROM totp_credentials WHERE user_id = $1 AND enabled = true',
      [payload.userId]
    )
    return res.status(200).json({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      isAdmin: payload.isAdmin,
      mfaVerified: payload.mfaVerified,
      mfaEnabled: mfaRows.rows.length > 0,
    })
  }

  return res.status(200).json({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    isAdmin: payload.isAdmin,
    mfaVerified: payload.mfaVerified,
    mfaEnabled: false,
  })
}

// ── /api/auth/change-password ─────────────────────────────────────────────────

async function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const pool = getPool()
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.userId])
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' })

  const passwordOk = await bcrypt.compare(currentPassword, rows[0].password_hash)
  if (!passwordOk) return res.status(401).json({ error: 'Incorrect current password' })

  const newHash = await bcrypt.hash(newPassword, 10)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.userId])
  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [user.userId, 'password_change']
  ).catch(() => {})

  return res.status(200).json({ ok: true })
}

// ── /api/auth/mfa-setup ───────────────────────────────────────────────────────

async function handleMfaSetup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { step, code } = req.body || {}

  if (step === 'start') {
    const secret = authenticator.generateSecret()
    const appName = process.env.AUTH_RP_NAME || "Tim's Budget"
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret)
    const encryptedSecret = encryptTotpSecret(secret)
    const pool = getPool()
    await pool.query(
      `INSERT INTO totp_credentials (user_id, encrypted_secret, enabled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET
         encrypted_secret = $2,
         enabled = CASE WHEN totp_credentials.enabled THEN totp_credentials.enabled ELSE false END`,
      [user.userId, encryptedSecret]
    )
    return res.status(200).json({ otpauthUrl })
  }

  if (step === 'confirm') {
    if (!code) return res.status(400).json({ error: 'code required' })
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT id, encrypted_secret, enabled FROM totp_credentials WHERE user_id = $1',
      [user.userId]
    )
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No pending TOTP setup. Start setup first.' })
    }
    const secret = decryptTotpSecret(rows[0].encrypted_secret)
    if (!authenticator.verify({ token: code.replace(/\s/g, ''), secret })) {
      return res.status(401).json({ error: 'Invalid code — please check the time on your device and try again.' })
    }
    await pool.query('UPDATE totp_credentials SET enabled = true WHERE user_id = $1', [user.userId])
    await pool.query('DELETE FROM backup_codes WHERE user_id = $1', [user.userId])

    const plainCodes = []
    for (let i = 0; i < 10; i++) {
      const backupCode = generateBackupCode()
      plainCodes.push(backupCode)
      const hash = await bcrypt.hash(backupCode, 10)
      await pool.query('INSERT INTO backup_codes (user_id, code_hash) VALUES ($1, $2)', [user.userId, hash])
    }
    pool.query(
      'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
      [user.userId, 'mfa_enabled']
    ).catch(() => {})
    return res.status(200).json({ backupCodes: plainCodes })
  }

  return res.status(400).json({ error: 'Invalid step. Use "start" or "confirm".' })
}

// ── /api/auth/mfa-verify ──────────────────────────────────────────────────────

async function handleMfaVerify(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'code required' })

  const cookies = parseCookies(req.headers.cookie || '')
  const token = cookies.session
  if (!token) return res.status(401).json({ error: 'No session' })

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid session' })
  }

  if (payload.mfaVerified) return res.status(400).json({ error: 'Already verified' })

  const pool = getPool()
  const rateLimitKey = `mfa:${payload.sessionId}`
  const rl = await pool.query(
    `INSERT INTO rate_limit_login (key, attempts, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       attempts     = rate_limit_login.attempts + 1,
       window_start = rate_limit_login.window_start
     RETURNING attempts`,
    [rateLimitKey]
  )
  if (rl.rows[0].attempts > 5) {
    return res.status(429).json({ error: 'Too many MFA attempts. Please log in again.' })
  }

  const { rows: totpRows } = await pool.query(
    'SELECT encrypted_secret FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [payload.userId]
  )
  if (totpRows.length > 0) {
    const secret = decryptTotpSecret(totpRows[0].encrypted_secret)
    if (authenticator.verify({ token: code.replace(/\s/g, ''), secret })) {
      return issueFullSession(res, pool, payload)
    }
  }

  const { rows: codeRows } = await pool.query(
    'SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used_at IS NULL',
    [payload.userId]
  )
  for (const row of codeRows) {
    const match = await bcrypt.compare(code.trim(), row.code_hash)
    if (match) {
      await pool.query('UPDATE backup_codes SET used_at = NOW() WHERE id = $1', [row.id])
      pool.query(
        'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
        [payload.userId, 'backup_code_used']
      ).catch(() => {})
      return issueFullSession(res, pool, payload)
    }
  }

  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [payload.userId, 'mfa_fail']
  ).catch(() => {})
  return res.status(401).json({ error: 'Invalid code' })
}

async function issueFullSession(res, pool, payload) {
  const newToken = jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      isAdmin: payload.isAdmin,
      mfaVerified: true,
      sessionId: payload.sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
  setSessionCookie(res, newToken)
  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [payload.userId, 'mfa_ok']
  ).catch(() => {})
  return res.status(200).json({ status: 'ok' })
}

// ── /api/auth/mfa-disable ─────────────────────────────────────────────────────

async function handleMfaDisable(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { currentPassword, totpCode } = req.body
  if (!currentPassword || !totpCode) {
    return res.status(400).json({ error: 'currentPassword and totpCode required' })
  }

  const pool = getPool()
  const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.userId])
  if (userRows.length === 0) return res.status(404).json({ error: 'User not found' })

  const passwordOk = await bcrypt.compare(currentPassword, userRows[0].password_hash)
  if (!passwordOk) return res.status(401).json({ error: 'Incorrect password' })

  const { rows: totpRows } = await pool.query(
    'SELECT encrypted_secret FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [user.userId]
  )
  if (totpRows.length === 0) return res.status(400).json({ error: 'MFA is not enabled' })

  const secret = decryptTotpSecret(totpRows[0].encrypted_secret)
  if (!authenticator.verify({ token: totpCode.replace(/\s/g, ''), secret })) {
    return res.status(401).json({ error: 'Invalid TOTP code' })
  }

  await pool.query('DELETE FROM totp_credentials WHERE user_id = $1', [user.userId])
  await pool.query('DELETE FROM backup_codes WHERE user_id = $1', [user.userId])
  pool.query(
    'INSERT INTO auth_events (user_id, event_type) VALUES ($1, $2)',
    [user.userId, 'mfa_disabled']
  ).catch(() => {})

  return res.status(200).json({ ok: true })
}

// ── /api/auth/backup-codes-regen ─────────────────────────────────────────────

async function handleBackupCodesRegen(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { currentPassword } = req.body
  if (!currentPassword) return res.status(400).json({ error: 'currentPassword required' })

  const pool = getPool()
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.userId])
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' })

  const passwordOk = await bcrypt.compare(currentPassword, rows[0].password_hash)
  if (!passwordOk) return res.status(401).json({ error: 'Incorrect password' })

  const { rows: mfaRows } = await pool.query(
    'SELECT id FROM totp_credentials WHERE user_id = $1 AND enabled = true',
    [user.userId]
  )
  if (mfaRows.length === 0) return res.status(400).json({ error: 'MFA is not enabled' })

  await pool.query('DELETE FROM backup_codes WHERE user_id = $1', [user.userId])
  const plainCodes = []
  for (let i = 0; i < 10; i++) {
    const code = generateBackupCode()
    plainCodes.push(code)
    const hash = await bcrypt.hash(code, 10)
    await pool.query('INSERT INTO backup_codes (user_id, code_hash) VALUES ($1, $2)', [user.userId, hash])
  }

  return res.status(200).json({ backupCodes: plainCodes })
}

// ── /api/auth/password-reset ──────────────────────────────────────────────────

async function handlePasswordReset(req, res) {
  if (req.method === 'GET') {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'Email required' })
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT sq.question FROM users u
       JOIN security_questions sq ON sq.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    )
    if (rows.length === 0) return res.status(200).json({ found: false })
    return res.status(200).json({ found: true, question: rows[0].question })
  }

  if (req.method === 'POST') {
    const { email, answer, newPassword } = req.body
    if (!email || !answer || !newPassword) {
      return res.status(400).json({ error: 'Email, answer, and new password required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const pool = getPool()
    const normalizedEmail = email.toLowerCase().trim()
    const limited = await checkRateLimit(`reset:${normalizedEmail}`, 5, 60 * 60 * 1000)
    if (limited) {
      return res.status(429).json({ error: 'Too many attempts. Please wait an hour before trying again.' })
    }
    const { rows } = await pool.query(
      `SELECT u.id, sq.answer_hash FROM users u
       JOIN security_questions sq ON sq.user_id = u.id
       WHERE u.email = $1`,
      [normalizedEmail]
    )
    if (rows.length === 0) return res.status(400).json({ error: 'No account found with that email.' })
    const { id: userId, answer_hash } = rows[0]
    const answerOk = await bcrypt.compare(answer.toLowerCase().trim(), answer_hash)
    if (!answerOk) return res.status(400).json({ error: 'Incorrect answer.' })
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function generateBackupCode() {
  const hex = randomBytes(5).toString('hex')
  return `${hex.slice(0, 5)}-${hex.slice(5)}`
}
